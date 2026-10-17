/* =========================================================
 * 谐波画笔 · 游戏会话 play.js
 * 绘制 → 重采样 → DFT → 圆数取舍 → 圆环动画 → 评分
 * ========================================================= */
(function (global) {
  'use strict';
  const HP = (global.HP = global.HP || {});
  const C = HP.core, D = HP.data, S = HP.shapes, R = HP.render, U = HP.ui;
  const { h } = U;
  const TAU = Math.PI * 2;

  /** 模拟一条手绘轨迹：目标曲线 + 低频噪声，并错开起点 */
  function demoTrace(pts, seed = 7, amp = 0.004) {
    const n = 540;
    const base = C.resampleClosed(pts, n);
    const rng = C.mulberry32(seed);
    const p1 = rng() * TAU, p2 = rng() * TAU, p3 = rng() * TAU;
    const offset = Math.floor(n * (0.2 + rng() * 0.5));
    const out = [];
    for (let i = 0; i < n; i++) {
      const j = (i + offset) % n;
      const t = i / n;
      const wob = amp * (Math.sin(TAU * 2 * t + p1) * 0.6 + Math.sin(TAU * 5 * t + p2) * 0.3 + Math.sin(TAU * 11 * t + p3) * 0.14);
      const a = base[(j - 1 + n) % n], b = base[(j + 1) % n];
      let nx = b.y - a.y, ny = -(b.x - a.x);
      const len = Math.hypot(nx, ny) || 1;
      nx /= len; ny /= len;
      out.push({ x: base[j].x + nx * wob, y: base[j].y + ny * wob });
    }
    return out;
  }

  class PlaySession {
    constructor(cfg) {
      this.cfg = cfg;
      this.kind = cfg.kind || 'level';
      this.level = cfg.level || null;
      this.isSandbox = this.kind === 'sandbox';
      this.isDaily = this.kind === 'daily';
      this.budget = cfg.budget || (this.level ? this.level.budget : 500);
      this.maxK = this.isSandbox ? 500 : Math.min(500, Math.max(Math.round(this.budget * 3), 30));
      this.name = cfg.name || (this.level ? this.level.name : '沙盒');
      this.targetPts = cfg.shapePts || null;
      this.prep = this.targetPts ? C.prepareTarget(this.targetPts) : null;
      this.timeLimit = cfg.timeLimit || (this.level && this.level.timeLimit) || 0;
      this.settings = cfg.settings || {};
      this.onComplete = cfg.onComplete || function () {};
      this.onBack = cfg.onBack || function () {};
      this.settings.persist = cfg.persist || function () {};

      this.ana = null;
      this.selection = new Set();
      this.highlightK = null;
      this.drawPts = [];
      this.drawing = false;
      this.error = null;
      this.stars = 0;
      this.loopPts = null;
      this.t = 0;
      this.speed = 1;
      this.playing = false;
      this.paused = true;
      this.clockStarted = false;
      this.elapsed = 0;
      this.timeLeft = this.timeLimit;
      this.settled = false;
      this.ghostOn = this.settings.showGhost !== false;
      this.autoK = this.isSandbox ? 48 : this.budget;
      this.needCompute = false;
      this.needDraw = true;
      this.destroyed = false;
      this.lastNow = 0;
      this.raf = 0;
      this.pan = null;
    }

    /* ------------------------- 挂载 ------------------------- */
    mount(container) {
      this.container = container;
      this.root = h('div', { class: 'play' + (this.isSandbox ? ' sandbox' : '') });
      this.buildHead();
      this.buildBody();
      this.buildFoot();
      this.root.append(this.els.head, this.els.body, this.els.foot);
      container.replaceChildren(this.root);

      this.renderer = new R.Renderer(this.els.stage);
      this.renderer.setTheme(this.settings.theme || 'scope');
      this.renderer.brush = this.settings.brush || 'glow';
      this.renderer.trail = this.settings.trail || 'basic';
      this.renderer.reduced = !!this.settings.reduced;
      this.specRenderer = new R.Renderer(this.els.spectrum);
      this.specRenderer.setTheme(this.settings.theme || 'scope');

      this.fitView();
      this.bindEvents();
      this.updateHUD();
      this.rebuildList();
      this.paintTargetChip();
      this.drawSpectrumChart();

      if (this.level && this.cfg.showIntro) this.showIntro();
      else if (this.isSandbox) this.hint('按住并拖动，画一个闭合图形；松手自动闭合');

      this.lastNow = 0;
      this._frame = (now) => this.frame(now);
      this.raf = requestAnimationFrame(this._frame);
      this.needDraw = true;
      return this;
    }

    buildHead() {
      const lv = this.level;
      const chapter = lv ? D.CHAPTERS.find((c) => c.id === lv.chapter) : null;
      this.els = {};
      this.els.chapter = h('span', { class: 'chapter-tag' }, chapter ? `第 ${lv.chapter} 章 · ${chapter.name}` : this.isDaily ? '每日一形' : '自由绘');
      this.els.title = h('h1', { class: 'play-name' }, lv ? `${lv.id} · ${lv.name}` : this.isDaily ? '今日之形' : '自由绘');
      this.els.teach = h('p', { class: 'play-teach' }, lv ? lv.teach : this.isDaily ? '描摹今日形状，拿到三星' : '反向沙盒：画一笔，看它拆成哪些圆');

      this.els.targetCv = h('canvas', { class: 'target-cv', dataset: { w: 52, h: 52 } });
      this.els.targetChip = h('div', { class: 'target-chip' + (this.prep ? '' : ' hidden') },
        this.els.targetCv,
        h('div', { class: 'target-meta' }, h('span', {}, '目标图形'), h('b', {}, lv ? S.defs[lv.shape].name : this.name)));

      this.els.stars = h('div', { class: 'stars' });
      this.els.pct = h('span', { class: 'pct' }, '—');
      this.els.errFill = h('i');
      this.els.errBar = h('div', { class: 'err-bar' }, this.els.errFill);
      this.els.scoreBox = h('div', { class: 'score-box' },
        this.els.stars,
        h('div', { class: 'err-row' }, this.els.errBar, this.els.pct));

      this.els.timer = h('div', { class: 'timer hidden' }, h('span', { class: 'timer-icon' }, '◔'), h('b', {}, '1:30'));
      this.els.clock = h('div', { class: 'clock' }, h('span', {}, '用时 '), h('b', {}, '0.0s'));

      this.els.head = h('div', { class: 'play-head' },
        U.iconBtn('←', { class: 'back-btn', title: '返回', onClick: () => this.onBack() }),
        h('div', { class: 'play-id' }, this.els.chapter, this.els.title, this.els.teach),
        this.els.targetChip,
        this.els.scoreBox,
        this.els.clock,
        this.els.timer,
        U.iconBtn('?', { title: '关卡说明', onClick: () => this.showIntro() }));
    }

    buildBody() {
      this.els.stage = h('canvas', { class: 'stage' });
      this.els.hint = h('div', { class: 'stage-hint' });
      this.els.stageWrap = h('div', { class: 'stage-wrap' },
        this.els.stage,
        this.els.hint,
        h('div', { class: 'view-ctrl' },
          U.iconBtn('+', { title: '放大', onClick: () => this.zoomBy(1.25) }),
          U.iconBtn('−', { title: '缩小', onClick: () => this.zoomBy(0.8) }),
          U.iconBtn('⌂', { title: '重置视图', onClick: () => this.fitView() })));

      this.els.count = h('span', { class: 'count' }, '0 / ' + this.budget + ' 圆');
      this.els.spectrum = h('canvas', { class: 'spectrum', dataset: { w: 280, h: 130 } });
      this.els.list = h('div', { class: 'harm-list' });
      this.els.panelTip = h('div', { class: 'panel-tip' }, '点击柱子或行可高亮对应的圆；右侧开关决定是否使用这个圆。');

      this.els.collapseBtn = h('button', {
        class: 'mini-toggle collapse-btn', type: 'button', title: '收起 / 展开面板',
        onclick: () => {
          const collapsed = this.els.side.classList.toggle('collapsed');
          this.els.collapseBtn.textContent = collapsed ? '展开' : '收起';
          this.els.collapseBtn.classList.toggle('on', !collapsed);
        },
      }, '收起');
      this.els.side = h('aside', { class: 'side-panel' },
        h('div', { class: 'panel-head' }, h('span', {}, '频谱'), h('div', { class: 'panel-tools' }, this.els.count, this.els.collapseBtn)),
        this.els.spectrum,
        h('div', { class: 'harm-head' }, h('span', {}, '主要谐波'), h('em', {}, '按幅度排序')),
        this.els.list,
        this.els.panelTip);

      this.els.body = h('div', { class: 'play-body' }, this.els.stageWrap, this.els.side);
    }

    buildFoot() {
      this.els.settleBtn = h('button', {
        class: 'btn primary settle-btn foot-settle',
        onclick: () => this.isSandbox ? this.exportPNG() : this.settle(),
      }, this.isSandbox ? '导出 PNG' : '结算');

      this.els.kLabel = h('b', { class: 'kval' }, String(this.autoK));
      this.els.kSlider = h('input', {
        type: 'range', min: '0', max: String(this.maxK),
        value: String(this.autoK), oninput: (e) => this.setK(+e.target.value),
      });

      this.els.speedLabel = h('b', { class: 'kval' }, '×1.0');
      this.els.speedSlider = h('input', {
        type: 'range', min: '15', max: '250', value: '100',
        oninput: (e) => {
          this.speed = +e.target.value / 100;
          this.els.speedLabel.textContent = '×' + this.speed.toFixed(1);
        },
      });

      this.els.pauseBtn = U.iconBtn('❚❚', { title: '暂停 / 继续', onClick: () => this.togglePause() });
      this.els.playBtn = U.iconBtn('↻', { title: '重播动画', onClick: () => this.replay() });
      this.els.ghostBtn = U.iconBtn('◌', { title: '显示 / 隐藏目标虚影', onClick: () => this.toggleGhost() });
      this.els.clearBtn = U.iconBtn('✕', { title: '清除笔迹', onClick: () => this.clearStroke() });
      this.els.helpBtn = U.iconBtn('?', { title: '关卡说明', onClick: () => this.showIntro() });

      const groups = [
        h('div', { class: 'slider-group foot-k' }, h('label', {}, '圆数'), this.els.kSlider, this.els.kLabel),
        h('div', { class: 'slider-group foot-speed' }, h('label', {}, '速度'), this.els.speedSlider, this.els.speedLabel),
        h('div', { class: 'foot-actions' }, this.els.pauseBtn, this.els.playBtn, this.els.ghostBtn, this.els.clearBtn, this.els.helpBtn),
      ];
      if (this.isSandbox) {
        groups.splice(2, 0,
          h('button', { class: 'btn ghost small foot-sandbox foot-important', onclick: () => this.toWorkshop() }, '带进工坊'),
          h('button', { class: 'btn ghost small foot-sandbox', onclick: () => this.loadSample() }, '随机示例'));
      }
      this.els.foot = h('div', { class: 'play-foot' }, this.els.settleBtn, groups);
    }

    /** 把当前笔迹的最强低次谐波整理成一个工坊配方 */
    sandboxPuzzle() {
      if (!this.ana || !this.selection || !this.selection.size) return null;
      const picks = [];
      for (const i of this.selection) {
        const k = this.ana.kOf[i];
        if (!k || Math.abs(k) > 12) continue;
        const amp = this.ana.mag[i];
        if (!(amp > 1e-6)) continue;
        let ph = Math.atan2(this.ana.cIm[i], this.ana.cRe[i]);
        if (ph < 0) ph += TAU;
        picks.push({ k, amp, phase: ph });
      }
      picks.sort((a, b) => b.amp - a.amp);
      const top = picks.slice(0, 12);
      if (top.length < 2) return null;
      const sig = top.filter((c) => c.amp >= top[0].amp * 0.02);
      const chosen = sig.length >= 2 ? sig : top;
      const max = chosen[0].amp;
      const recipe = chosen.map((c) => ({ k: c.k, amp: c.amp / max, phase: c.phase }));
      const n = recipe.length;
      return {
        id: 'sandbox-' + Date.now(),
        section: 'custom', chapter: 0, index: 0, no: 'S',
        title: '我的笔迹',
        kicker: '沙盒 · 自定义配方 · ' + n + ' 圆',
        family: 'custom', type: 'synth', recipe, budget: n,
        hintOn: true, thresholds: [0.015, 0.04, 0.08],
        formula: 'z(t) = \\sum_{k} c_k\\, e^{2\\pi i k t}',
        note: '这条配方来自你在沙盒里画的笔迹：取最强的 ' + n + ' 个低次谐波。',
        text: '把刚才的笔迹拆成 ' + n + ' 个主谐波，再只用这些圆把它拼回来。目标谱已打开。',
        hint: '目标谱里有 ' + n + ' 根柱子；对照幅度与相位填回去。',
        maxK: Math.max.apply(null, recipe.map((c) => Math.abs(c.k))),
        difficulty: n * 10, date: '',
      };
    }

    toWorkshop() {
      const p = this.sandboxPuzzle();
      if (!p) { U.toast('先画一个图形，再带进工坊'); return; }
      if (this.cfg.onToWorkshop) this.cfg.onToWorkshop(p);
    }

    /* ------------------------- 事件 ------------------------- */
    bindEvents() {
      const stage = this.els.stage;
      this._onDown = (e) => this.onDown(e);
      this._onMove = (e) => this.onMove(e);
      this._onUp = (e) => this.onUp(e);
      this._onWheel = (e) => this.onWheel(e);
      this._onCtx = (e) => e.preventDefault();
      this._onKey = (e) => this.onKey(e);
      this._onResize = () => {
        if (this.destroyed) return;
        this.renderer.resize();
        this.specRenderer.resize();
        this.fitView();
        this.needDraw = true;
        this.drawSpectrumChart();
      };
      stage.addEventListener('pointerdown', this._onDown);
      stage.addEventListener('pointermove', this._onMove);
      stage.addEventListener('pointerup', this._onUp);
      stage.addEventListener('pointercancel', this._onUp);
      stage.addEventListener('contextmenu', this._onCtx);
      stage.addEventListener('wheel', this._onWheel, { passive: false });
      global.addEventListener('resize', this._onResize);
      global.addEventListener('keydown', this._onKey);
      this.els.spectrum.addEventListener('click', (e) => this.onSpectrumClick(e));
      if (typeof ResizeObserver !== 'undefined') {
        this._ro = new ResizeObserver(() => this._onResize());
        this._ro.observe(this.els.stageWrap);
      }
    }

    onKey(e) {
      if (U.isModalOpen()) return;
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === ' ') { e.preventDefault(); this.togglePause(); }
      else if (e.key === 'r' || e.key === 'R') { this.clearStroke(); }
      else if (e.key === '[') { this.setK(Math.max(0, this.selection.size - 1)); }
      else if (e.key === ']') { this.setK(Math.min(500, this.selection.size + 1)); }
    }

    eventPos(e) {
      const rect = this.els.stage.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top, sx: e.clientX, sy: e.clientY };
    }

    onDown(e) {
      if (this.settled) return;
      if (e.button === 2 || e.button === 1 || e.altKey) {
        this.pan = { sx: e.clientX, sy: e.clientY, cx: this.renderer.camX, cy: this.renderer.camY };
        try { this.els.stage.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
        this.root.classList.add('panning');
        return;
      }
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      e.preventDefault();
      U.audio.ensure();
      try { this.els.stage.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
      const p = this.eventPos(e);
      const w = this.renderer.toWorld(p.x, p.y);
      this.drawing = true;
      this.drawPts = [this.snap(w)];
      this.ana = null;
      this.selection = new Set();
      this.error = null;
      this.stars = 0;
      this.loopPts = null;
      this.playing = false;
      this.paused = true;
      this.t = 0;
      this.highlightK = null;
      this.clockStarted = true;
      this.root.classList.add('drawing');
      this.hint('正在记录笔迹…松手自动闭合');
      this.updateHUD();
      this.rebuildList();
      this.drawSpectrumChart();
      this.needDraw = true;
    }

    snap(w) {
      if (!this.settings.snap || !this.targetPts) return w;
      const near = C.nearestOnPolyline(this.targetPts, w);
      const radius = 13 / this.renderer.scale;
      if (near.dist < radius) return { x: near.x, y: near.y };
      return w;
    }

    onMove(e) {
      if (this.pan) {
        const dx = e.clientX - this.pan.sx, dy = e.clientY - this.pan.sy;
        this.renderer.camX = this.pan.cx - dx / this.renderer.scale;
        this.renderer.camY = this.pan.cy - dy / this.renderer.scale;
        this.needDraw = true;
        return;
      }
      if (!this.drawing) return;
      const p = this.eventPos(e);
      const w = this.renderer.toWorld(p.x, p.y);
      const q = this.snap(w);
      const last = this.drawPts[this.drawPts.length - 1];
      const minD = 0.35 / this.renderer.scale;
      if (Math.hypot(q.x - last.x, q.y - last.y) < minD) return;
      this.drawPts.push(q);
      this.needDraw = true;
    }

    onUp(e) {
      if (this.pan) { this.pan = null; this.root.classList.remove('panning'); return; }
      if (!this.drawing) return;
      this.drawing = false;
      this.root.classList.remove('drawing');
      const pts = this.drawPts.slice();
      const perim = C.pathLength(pts);
      if (pts.length < 6 || perim * this.renderer.scale < 50) {
        this.hint('这一笔太短了，再画一次');
        this.clearStroke(true);
        U.toast('笔画太短，请画一个闭合图形');
        return;
      }
      const gap = Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y);
      if (gap > perim * 0.08) U.toast('已自动闭合到起点');
      this.analyze(pts);
    }

    onWheel(e) {
      e.preventDefault();
      const p = this.eventPos(e);
      const before = this.renderer.toWorld(p.x, p.y);
      const factor = Math.exp(-e.deltaY * 0.0012);
      this.renderer.setZoom(this.renderer.zoom * factor);
      const after = this.renderer.toWorld(p.x, p.y);
      this.renderer.camX += before.x - after.x;
      this.renderer.camY += before.y - after.y;
      this.needDraw = true;
    }

    onSpectrumClick(e) {
      if (!this.ana) return;
      const rect = this.els.spectrum.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const range = 32, padL = 6, padR = 6;
      const plotW = Math.max(10, rect.width - padL - padR);
      const k = Math.round(-range + ((x - padL) / plotW) * range * 2);
      if (k < -range || k > range) return;
      this.highlight(k, true);
    }

    /* ------------------------- 分析 ------------------------- */
    analyze(pts, opts = {}) {
      const perim = C.pathLength(pts);
      const simplified = C.simplifyClosed(pts, perim * 0.0012);
      this.ana = C.analyse(simplified, C.SAMPLE_N);
      const k = Math.min(this.isSandbox ? Math.max(this.autoK, 1) : this.budget, this.ana.N);
      this.autoK = k;
      this.selection = new Set(C.topIndices(this.ana, k));
      this.els.kSlider.max = String(Math.min(this.maxK, this.ana.N));
      this.els.kSlider.value = String(k);
      this.els.kLabel.textContent = String(k);
      if (this.isSandbox && !opts.keepView) {
        const bb = C.bbox(this.ana.samples);
        const view = this.currentView();
        if (bb.minX < view.minX || bb.maxX > view.maxX || bb.minY < view.minY || bb.maxY > view.maxY) {
          this.renderer.fit(bb, 0.45, 24);
        }
      }
      this.recompute();
      this.rebuildList();
      this.drawSpectrumChart();
      this.playing = true;
      this.paused = false;
      this.t = 0;
      this.clockStarted = true;
      this.needDraw = true;
      this.updateHUD();
    }

    currentView() {
      const a = this.renderer.toWorld(0, 0), b = this.renderer.toWorld(this.renderer.W, this.renderer.H);
      return { minX: a.x, maxX: b.x, minY: a.y, maxY: b.y };
    }

    recompute() {
      if (!this.ana) {
        this.error = null;
        this.loopPts = null;
        this.stars = 0;
        this.updateHUD();
        return;
      }
      const idx = Array.from(this.selection);
      if (!idx.length) {
        this.loopPts = null;
        this.error = this.prep ? 2 : null;
        this.stars = 0;
        this.updateHUD();
        return;
      }
      const M = 1440;
      const flat = C.reconstruct(this.ana, idx, M);
      this.loopPts = C.reconPoints(flat, M);
      this.error = this.prep ? C.errorAgainstPrepared(this.prep, this.loopPts) : null;
      this.stars = this.prep ? C.starFor(this.error, idx.length, this.budget) : 0;
      this.updateHUD();
    }

    /* ------------------------- 控制 ------------------------- */
    setK(v) {
      this.autoK = Math.max(0, Math.min(v, this.els.kSlider ? +this.els.kSlider.max : 500));
      this.els.kLabel.textContent = String(this.autoK);
      if (this.ana) {
        this.selection = new Set(C.topIndices(this.ana, Math.min(this.autoK, this.ana.N)));
        this.needCompute = true;
        if (this.highlightK != null) {
          const has = Array.from(this.selection).some((i) => this.ana.kOf[i] === this.highlightK);
          if (!has) this.highlightK = null;
        }
        this.rebuildList();
        this.drawSpectrumChart();
      }
      this.updateHUD();
      this.needDraw = true;
      if (this.isSandbox && this.selection.size >= 500 && this.cfg.onMilestone) this.cfg.onMilestone('sandbox500');
    }

    toggleCoeff(idx) {
      if (!this.ana) return;
      const size = this.selection.size;
      if (this.selection.has(idx)) this.selection.delete(idx);
      else {
        if (size >= Math.min(this.maxK, this.ana.N)) { U.toast('已达到本关最多可用圆数'); return; }
        this.selection.add(idx);
      }
      this.autoK = this.selection.size;
      this.els.kSlider.value = String(this.autoK);
      this.els.kLabel.textContent = String(this.autoK);
      U.audio.toggle(this.selection.has(idx));
      this.recompute();
      this.rebuildList();
      this.drawSpectrumChart();
      this.needDraw = true;
    }

    highlight(k, playTone) {
      if (!this.ana) return;
      const idx = k >= 0 ? k : k + this.ana.N;
      if (idx < 0 || idx >= this.ana.N) return;
      this.highlightK = this.highlightK === k ? null : k;
      if (playTone && this.highlightK != null) U.audio.harmonic(k);
      this.rebuildList();
      this.drawSpectrumChart();
      this.needDraw = true;
    }

    togglePause() {
      if (!this.ana) { U.toast('先画一笔，才有圆环动画'); return; }
      this.paused = !this.paused;
      this.els.pauseBtn.textContent = this.paused ? '▶' : '❚❚';
      this.needDraw = true;
    }

    replay() {
      if (!this.loopPts) { U.toast('先画一笔'); return; }
      this.t = 0;
      this.paused = false;
      this.playing = true;
      this.els.pauseBtn.textContent = '❚❚';
      this.needDraw = true;
    }

    toggleGhost() {
      this.ghostOn = !this.ghostOn;
      this.settings.showGhost = this.ghostOn;
      this.settings.persist();
      this.els.ghostBtn.classList.toggle('active', this.ghostOn);
      this.needDraw = true;
      U.toast(this.ghostOn ? '已显示目标虚影' : '已隐藏目标虚影（盲画模式）');
    }

    clearStroke(opts = {}) {
      this.ana = null;
      this.selection = new Set();
      this.error = null;
      this.stars = 0;
      this.loopPts = null;
      this.drawPts = [];
      this.t = 0;
      this.playing = false;
      this.paused = true;
      this.highlightK = null;
      this.clockStarted = false;
      this.elapsed = 0;
      this.timeLeft = this.timeLimit;
      this.els.kSlider.value = String(this.isSandbox ? 48 : this.budget);
      this.els.kLabel.textContent = this.els.kSlider.value;
      this.autoK = +this.els.kSlider.value;
      this.hint(this.prep ? '贴着虚线，一笔画完整个轮廓' : '按住并拖动，画一个闭合图形');
      this.updateHUD();
      this.rebuildList();
      this.drawSpectrumChart();
      this.needDraw = true;
      if (!opts.silent) U.audio.blip();
    }

    zoomBy(f) {
      this.renderer.setZoom(this.renderer.zoom * f);
      this.needDraw = true;
    }

    fitView() {
      if (this.prep) this.renderer.fit(this.prep.bbox, 0.24, 24);
      else if (this.ana && this.ana.samples.length) this.renderer.fit(C.bbox(this.ana.samples), 0.42, 24);
      else this.renderer.fit({ cx: 0, cy: 0, w: 3.4, h: 3.4 }, 0, 20);
      this.needDraw = true;
    }

    /* ------------------------- HUD ------------------------- */
    hint(text) {
      this.els.hint.textContent = text;
      this.els.hint.classList.toggle('show', !!text);
    }

    updateHUD() {
      const n = this.selection.size;
      const err = this.error;
      this.els.count.textContent = this.isSandbox ? `${n} 圆` : `${n} / ${this.budget} 圆`;
      this.els.count.classList.toggle('over', n > this.budget);
      this.els.pct.textContent = err == null ? '—' : C.formatPct(err, 2);
      this.els.pct.dataset.level = err == null ? '' : err <= 0.02 ? '3' : err <= 0.05 ? '2' : err <= 0.1 ? '1' : '0';
      const w = err == null ? 0 : Math.min(1, err / 0.1);
      this.els.errFill.style.width = (w * 100).toFixed(1) + '%';
      this.els.errFill.dataset.level = this.els.pct.dataset.level;
      this.els.stars.replaceChildren(...[0, 1, 2].map((i) => h('span', { class: 'star' + (i < this.stars ? ' on' : '') }, '★')));
      this.els.clock.lastChild.textContent = C.formatTime(this.elapsed * 1000);

      if (this.prep) {
        let txt = '贴着虚线，一笔画完整个轮廓';
        if (this.drawing) txt = '正在记录笔迹…';
        else if (err == null) txt = '贴着虚线，一笔画完整个轮廓';
        else if (err > 0.1) txt = '误差偏高：慢慢描，或增加圆数试试';
        else if (this.stars >= 3) txt = '三星达成！按「结算」提交';
        else if (this.stars === 2) txt = '两星：再准一点就能三星';
        else if (this.stars === 1) txt = '一星：继续贴近虚线';
        this.hint(txt);
      }
      if (this.isSandbox && !this.ana) this.hint('按住并拖动，画一个闭合图形；松手自动闭合');

      const timerVisible = this.timeLimit > 0;
      this.els.timer.classList.toggle('hidden', !timerVisible);
      if (timerVisible) {
        this.els.timer.lastChild.textContent = C.formatClock(this.timeLeft);
        this.els.timer.classList.toggle('urgent', this.timeLeft <= 15);
      }
      this.els.settleBtn.disabled = !this.ana;
      this.els.pauseBtn.textContent = this.paused ? '▶' : '❚❚';
    }

    updateClock() {
      this.els.clock.lastChild.textContent = C.formatTime(this.elapsed * 1000);
      if (this.timeLimit) {
        this.els.timer.lastChild.textContent = C.formatClock(this.timeLeft);
        this.els.timer.classList.toggle('urgent', this.timeLeft <= 15);
      }
    }

    rebuildList() {
      if (!this.ana) {
        this.els.list.replaceChildren(h('div', { class: 'harm-empty' }, '画一笔后，这里会出现你的频谱'));
        return;
      }
      const maxMag = this.ana.mag[this.ana.ranked[0]] || 1;
      const cut = Math.max(1e-9, maxMag * 0.0015);
      const ranked = this.ana.ranked.filter((i) => this.ana.mag[i] > cut).slice(0, 64);
      const items = ranked.map((i) => this.ana.list[i]).sort((a, b) => b.mag - a.mag || a.k - b.k);
      const rows = items.map((it) => {
        const on = this.selection.has(it.idx);
        const row = h('div', {
          class: 'harm-row' + (on ? ' on' : '') + (this.highlightK === it.k ? ' hl' : ''),
          dataset: { k: String(it.k) },
        },
          h('span', { class: 'hk' }, (it.k > 0 ? '+' : '') + it.k),
          h('span', { class: 'hbar' }, h('i', { style: { width: Math.max(2, Math.pow(it.mag / maxMag, 0.5) * 100) + '%' } })),
          h('span', { class: 'hmag' }, Math.round((it.mag / maxMag) * 100) + '%'),
          h('button', {
            class: 'switch' + (on ? ' on' : ''),
            title: on ? '关闭这个圆' : '启用这个圆',
            'aria-label': (on ? '关闭' : '启用') + ' k=' + it.k,
            onclick: (e) => { e.stopPropagation(); this.toggleCoeff(it.idx); },
          }, h('span')));
        row.addEventListener('click', () => this.highlight(it.k, true));
        return row;
      });
      this.els.list.replaceChildren(...rows);
      this.els.count.textContent = this.isSandbox ? `${this.selection.size} 圆` : `${this.selection.size} / ${this.budget} 圆`;
    }

    drawSpectrumChart() {
      if (!this.ana) {
        const ctx = this.els.spectrum.getContext('2d');
        const dpr = Math.min(global.devicePixelRatio || 1, 2.5);
        const rect = this.els.spectrum.getBoundingClientRect();
        const w = Math.max(40, Math.round(rect.width || 280)), hgt = Math.max(30, Math.round(rect.height || 130));
        this.els.spectrum.width = Math.round(w * dpr);
        this.els.spectrum.height = Math.round(hgt * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, hgt);
        ctx.strokeStyle = 'rgba(140,190,255,0.18)';
        ctx.beginPath(); ctx.moveTo(8, hgt - 16); ctx.lineTo(w - 8, hgt - 16); ctx.stroke();
        return;
      }
      this.specRenderer.resize();
      let minSel = Infinity;
      for (const idx of this.selection) minSel = Math.min(minSel, this.ana.mag[idx]);
      this.specRenderer.drawSpectrum(this.ana, {
        range: 32,
        selected: this.selection,
        highlightK: this.highlightK,
        budgetLine: this.selection.size && isFinite(minSel) ? minSel : null,
      });
    }

    paintTargetChip() {
      if (!this.targetPts || !this.els.targetCv) return;
      requestAnimationFrame(() => {
        if (this.destroyed) return;
        const theme = R.THEMES[this.settings.theme || 'scope'];
        U.paintShape(this.els.targetCv, this.targetPts, { color: theme.ghost, fill: theme.ghostFill, width: 1.6, glow: 6 });
      });
    }

    /* ------------------------- 渲染 ------------------------- */
    frame(now) {
      if (this.destroyed) return;
      if (!this.lastNow) this.lastNow = now;
      const dt = Math.min(0.06, Math.max(0, (now - this.lastNow) / 1000));
      this.lastNow = now;
      if (this.clockStarted && !this.paused && !this.settled) {
        this.elapsed += dt;
        if (this.timeLimit) {
          this.timeLeft -= dt;
          if (this.timeLeft <= 0) { this.timeLeft = 0; this.onTimeout(); }
        }
        this.updateClock();
      }
      if (this.playing && !this.paused) {
        this.t += dt * 0.4 * this.speed;
        if (this.t >= 1) this.t -= 1;
        this.needDraw = true;
      }
      if (this.needCompute) { this.needCompute = false; this.recompute(); }
      if (this.needDraw) { this.needDraw = false; this.draw(); }
      this.raf = requestAnimationFrame(this._frame);
    }

    draw() {
      const r = this.renderer;
      if (!r) return;
      r.drawBackground();
      if (this.targetPts && this.ghostOn) {
        r.drawGhost(this.targetPts, { alpha: this.drawing ? 0.9 : 0.72, offset: -performance.now() * 0.012 });
      }
      if (this.drawing) {
        if (this.drawPts.length > 1) r.drawBrushStroke(this.drawPts);
        else {
          const s = r.toScreen(this.drawPts[0].x, this.drawPts[0].y);
          const ctx = r.ctx;
          ctx.fillStyle = r.theme.tip;
          ctx.beginPath(); ctx.arc(s.x, s.y, 3, 0, TAU); ctx.fill();
        }
      } else if (this.loopPts && this.ana) {
        r.drawTrail(this.loopPts, this.t);
        r.drawChain({
          ana: this.ana,
          indices: Array.from(this.selection),
          t: this.t,
          highlightK: this.highlightK,
        });
      }
    }

    /* ------------------------- 结束 ------------------------- */
    settle() {
      if (this.settled) return;
      if (this.drawing) { U.toast('先松手，再结算'); return; }
      if (!this.ana) { U.toast('先画一笔，才有成绩'); return; }
      if (this.error == null) return;
      const count = this.selection.size;
      const stars = C.starFor(this.error, count, this.budget);
      if (stars < 1) {
        U.audio.fail();
        this.showFailModal();
        return;
      }
      this.settled = true;
      this.paused = true;
      this.playing = false;
      U.audio.success(stars);
      const result = {
        kind: this.kind,
        levelId: this.level ? this.level.id : null,
        level: this.level,
        name: this.name,
        error: this.error,
        count,
        budget: this.budget,
        time: this.elapsed,
        stars,
        dailyKey: this.cfg.dailyKey || null,
        shapePts: this.targetPts,
      };
      this.onComplete(result, this);
    }

    suggestK(targetErr = 0.1) {
      if (!this.ana || !this.prep) return null;
      const maxK = Math.min(this.maxK, this.ana.N);
      const start = Math.max(1, this.selection.size + 1);
      const step = Math.max(1, Math.round(maxK / 16));
      let last = null;
      for (let k = start; k <= maxK; k += step) {
        const idx = C.topIndices(this.ana, k);
        const e = C.errorOfReconstruction(this.prep, this.ana, idx, 1024);
        last = { k, e };
        if (e <= targetErr) return last;
      }
      return last && last.e < this.error ? last : null;
    }

    showFailModal() {
      const s = this.suggestK(0.1);
      const tip = s
        ? `把圆数从 ${this.selection.size} 调到约 ${s.k}，误差可降到 ${C.formatPct(s.e, 1)}；`
        : '形状偏差较大：重新描摹通常比继续加圆更有效；';
      const card = h('div', { class: 'modal card fail-card' },
        h('div', { class: 'modal-kicker' }, '还差一点'),
        h('h2', {}, '误差 ' + C.formatPct(this.error, 2)),
        h('p', {}, '本关一星要求误差 ≤ 10%。现在 ' + C.formatPct(this.error, 1) + '，可以试试：'),
        h('ul', { class: 'tips' },
          h('li', {}, tip),
          h('li', {}, '贴着目标虚线慢慢描，别急着画完；'),
          h('li', {}, '关掉手抖带进来的高频小圆（频谱列表右侧开关）。')),
        h('div', { class: 'modal-actions' },
          U.btn('继续调整', { kind: 'primary', onClick: () => U.closeModal() }),
          U.btn('重新描摹', { kind: 'ghost', onClick: () => { U.closeModal(); this.clearStroke(); } })));
      U.modal(card);
    }

    onTimeout() {
      if (this.settled) return;
      this.settled = true;
      this.paused = true;
      this.playing = false;
      U.audio.fail();
      const card = h('div', { class: 'modal card fail-card' },
        h('div', { class: 'modal-kicker' }, '时间到'),
        h('h2', {}, '差一点点'),
        h('p', {}, 'Boss 关限时 ' + C.formatClock(this.timeLimit) + '。再来一次？'),
        h('div', { class: 'modal-actions' },
          U.btn('再试一次', { kind: 'primary', onClick: () => { U.closeModal(); this.onBack(true); } }),
          U.btn('返回地图', { kind: 'ghost', onClick: () => { U.closeModal(); this.onBack(); } })));
      U.modal(card, { dismissible: false });
    }

    exportPNG() {
      try {
        const url = this.els.stage.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url;
        a.download = '谐波画笔-' + Date.now() + '.png';
        a.click();
        U.toast('已导出当前画面');
      } catch (e) {
        U.toast('导出失败');
      }
    }

    loadSample() {
      const ids = S.ids.filter((id) => !['offsetCircle'].includes(id));
      const id = ids[Math.floor(Math.random() * ids.length)];
      const pts = S.get(id);
      this.drawPts = demoTrace(pts, Math.floor(Math.random() * 9999), 0.0025);
      this.analyze(this.drawPts);
      this.autoK = Math.min(120, this.autoK);
      this.setK(this.autoK);
      this.renderer.fit(C.bbox(pts), 0.45, 24);
      this.needDraw = true;
      U.toast('示例：' + S.defs[id].name);
    }

    /* ------------------------- 关卡说明 ------------------------- */
    showIntro() {
      const lv = this.level;
      const chapter = lv ? D.CHAPTERS.find((c) => c.id === lv.chapter) : null;
      const preview = h('canvas', { class: 'intro-shape', dataset: { w: 132, h: 132 } });
      const card = h('div', { class: 'modal card intro-card' },
        h('div', { class: 'intro-top' },
          preview,
          h('div', { class: 'intro-meta' },
            h('span', { class: 'chapter-tag' }, chapter ? `第 ${lv ? lv.chapter : ''} 章 · ${chapter.name}` : this.isDaily ? '每日一形' : '自由绘'),
            h('h2', {}, lv ? lv.name : this.isDaily ? '今日之形' : '自由绘'),
            h('p', { class: 'intro-teach' }, lv ? lv.teach : this.isDaily ? '描摹今日形状，拿到三星' : '反向沙盒：画一笔，看它拆成哪些圆'),
            h('div', { class: 'criteria' },
              h('span', {}, '谐波预算 '), h('b', {}, String(this.budget)),
              this.timeLimit ? [h('span', {}, '限时 '), h('b', {}, C.formatClock(this.timeLimit))] : null))),
        h('p', { class: 'intro-text' }, lv ? lv.text : this.isDaily
          ? '今天的配方已经生成：先看目标谱，再调配谐波。'
          : '反向沙盒：画任意闭合图形，看看它由哪些旋转的圆组成。'),
        h('div', { class: 'star-legend' },
          h('div', {}, U.starsRow(3), h('span', {}, '误差 ≤ 2% 且不超预算')),
          h('div', {}, U.starsRow(2), h('span', {}, '误差 ≤ 5%（可超预算）')),
          h('div', {}, U.starsRow(1), h('span', {}, '误差 ≤ 10% 且路径闭合'))),
        h('div', { class: 'hint-line' },
          h('span', { class: 'hint-icon' }, '✎'),
          h('span', {}, lv ? lv.hint : '按住拖动，松手自动闭合；用「圆数」滑块决定用多少个圆。')),
        h('div', { class: 'modal-actions' },
          U.btn('开始绘制', { kind: 'primary', onClick: () => { U.closeModal(); this.els.stage.focus && this.els.stage.focus(); } }),
          U.btn('稍后再画', { kind: 'ghost', onClick: () => U.closeModal() })));
      U.modal(card);
      requestAnimationFrame(() => {
        if (this.targetPts) U.paintShape(preview, this.targetPts, { width: 2, glow: 12 });
      });
    }

    /* ------------------------- 演示 / 调试 ------------------------- */
    demo(t = 0.78, k = null) {
      if (!this.targetPts) return;
      this.drawPts = demoTrace(this.targetPts, 11, 0.0035);
      this.analyze(this.drawPts);
      if (k != null) this.setK(k);
      this.t = t;
      this.playing = true;
      this.paused = true;
      this.clockStarted = false;
      this.elapsed = 18.4;
      this.timeLeft = this.timeLimit;
      this.els.pauseBtn.textContent = '▶';
      this.needDraw = true;
      this.updateHUD();
      this.updateClock();
      this.draw();
    }

    destroy() {
      this.destroyed = true;
      if (this.raf) cancelAnimationFrame(this.raf);
      try {
        this.els.stage.removeEventListener('pointerdown', this._onDown);
        this.els.stage.removeEventListener('pointermove', this._onMove);
        this.els.stage.removeEventListener('pointerup', this._onUp);
        this.els.stage.removeEventListener('pointercancel', this._onUp);
        this.els.stage.removeEventListener('contextmenu', this._onCtx);
        this.els.stage.removeEventListener('wheel', this._onWheel);
        global.removeEventListener('resize', this._onResize);
        global.removeEventListener('keydown', this._onKey);
        if (this._ro) this._ro.disconnect();
      } catch (e) { /* noop */ }
    }
  }

  HP.play = {
    create(cfg) { return new PlaySession(cfg); },
    demoTrace,
    PlaySession,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
