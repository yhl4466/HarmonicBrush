/* =========================================================
 * 谐波画笔 · 频谱工坊 workshop.js
 * 硬核模式：不画线，只调配谐波（幅度 / 相位），用合成方程拼出目标形状
 * ========================================================= */
(function (global) {
  'use strict';
  const HP = (global.HP = global.HP || {});
  const C = HP.core, D = HP.data, S = HP.shapes, R = HP.render, U = HP.ui;
  const { h } = U;
  const N = 1024, M = 1440, RANGE = 13;

  const PUZZLES = [
    {
      id: 'w1', title: '一个圆', kicker: '合成 · 第一项',
      recipe: [{ k: 1, amp: 1 }], budget: 1,
      text: '目标是一个半径 1 的圆。先放上 k=+1 这个圆，把幅度调到与半径一致。',
      formula: 'z(t) = c_1 e^{2\\pi i t}',
      note: '一个复指数就是一个圆：|c₁| 是半径，arg c₁ 是起笔角。',
      hint: '把 k=+1 的幅度调到 1.00。',
    },
    {
      id: 'w2', title: '压扁', kicker: '合成 · 共轭对',
      recipe: [{ k: 1, amp: 1 }, { k: -1, amp: 0.45 }], budget: 2,
      text: '椭圆 = 一正一反两个圆。先放 k=+1，再放 k=-1，把第二个圆的幅度从 0 慢慢加上去。',
      formula: 'c_1 e^{i\\theta} + c_{-1} e^{-i\\theta} = (c_1+c_{-1})\\cos\\theta + i(c_1-c_{-1})\\sin\\theta',
      note: '两个反向旋转的圆合成一个椭圆：幅度差决定扁的程度。',
      hint: 'k=+1 幅度 1.00，k=-1 幅度 0.45，相位都保持 0°。',
    },
    {
      id: 'w3', title: '平移', kicker: '合成 · DC 分量',
      recipe: [{ k: 0, amp: 0.62, phase: 1.05 }, { k: 1, amp: 0.8 }], budget: 2,
      text: '目标圆不在原点。k=0（DC）只负责平移：它的幅度是偏移距离，相位是偏移方向。',
      formula: 'c_0 = \\frac{1}{N}\\sum_{n} p_n',
      note: '0 阶系数是图形的平均位置；它不改变形状，只把形状整体平移。',
      hint: 'k=0 幅度 0.62、相位 60°；k=+1 幅度 0.80。',
    },
    {
      id: 'w4', title: '五重花瓣', kicker: '合成 · 高频',
      recipe: [{ k: 1, amp: 1 }, { k: 5, amp: 0.36 }], budget: 2,
      text: '在主圆上加一个每圈转 5 圈的圆，看看 4 个鼓包从哪里冒出来。',
      formula: 'z(t) = e^{2\\pi i t} + 0.36\\, e^{2\\pi i\\cdot 5t}',
      note: 'k=5 的圆每圈转 5 圈，在主圆上刻出 4 个鼓包；k 越大，鼓包越密。',
      hint: 'k=+1 幅度 1.00，k=+5 幅度 0.36。',
    },
    {
      id: 'w5', title: '相位', kicker: '合成 · 相位',
      recipe: [{ k: 1, amp: 0.92, phase: 0.35 }, { k: -1, amp: 0.5, phase: 1.4 }], budget: 2,
      text: '幅度谱不变，只改相位，椭圆会转起来。目标和当前椭圆的朝向差在哪？',
      formula: 'c_k = |c_k|\\, e^{i\\varphi_k}',
      note: '幅度决定大小，相位决定朝向；相位差决定椭圆的轴与倾角。',
      hint: 'k=+1：0.92 ∠ 20°；k=-1：0.50 ∠ 80°。',
    },
    {
      id: 'w6', title: '方波的配料', kicker: '合成 · 奇次谐波',
      recipe: [{ k: 1, amp: 1 }, { k: 3, amp: 0.333 }, { k: 5, amp: 0.2 }, { k: 7, amp: 0.143 }], budget: 4,
      text: '方波只需要奇次谐波，幅度按 1、1/3、1/5、1/7… 递减。把四根柱子配齐。',
      formula: 'c_k \\propto 1/k,\\quad k=\\pm1,\\pm3,\\pm5,\\pm7',
      note: '这是方波傅里叶级数的前四项；角上的吉布斯过冲约 9%，不会随 K 消失。',
      hint: '只需要 k=+1、+3、+5、+7，幅度 1、0.333、0.2、0.143，相位 0°。',
    },
    {
      id: 'w7', title: '修谱', kicker: '修谱 · 反解系数',
      recipe: [{ k: 1, amp: 1 }, { k: 2, amp: 0.42, phase: 0.9 }, { k: -2, amp: 0.28, phase: 2.4 }], budget: 3,
      start: [{ k: 1, amp: 1 }, { k: 2, amp: 0.75, phase: 0.9 }, { k: -2, amp: 0.28, phase: 2.4 }],
      text: '这份频谱被改坏了一根柱子。打开目标谱提示，对照柱高，找出错的那一根并修好它。',
      formula: 'z(t) = \\sum_{k} c_k\\, e^{2\\pi i k t}',
      note: '修谱就是反解 cₖ：幅度看柱高，相位看形状的旋转。',
      hint: 'k=+2 的幅度被改大了：目标是 0.42，当前是 0.75。',
    },
  ];

  /* ------------------------- 关卡目录（教程 + 程序化生成） ------------------------- */
  const GENPACK = HP.generator ? HP.generator.getWorkshopPack() : { formal: [], super: [], chapters: { formal: [], super: [] } };
  const TUTORIALS = PUZZLES;
  TUTORIALS.forEach((p, i) => {
    p.section = 'tutorial';
    p.chapter = 0;
    p.index = i + 1;
    p.no = 'T' + String(i + 1).padStart(2, '0');
    p.hintOn = true;
    p.thresholds = [0.015, 0.04, 0.08];
  });
  const FORMAL = GENPACK.formal || [];
  const SUPER = GENPACK.super || [];
  const ALL = TUTORIALS.concat(FORMAL, SUPER);
  ALL.forEach((p, i) => { p.order = i; p.next = ALL[i + 1] ? ALL[i + 1].id : null; });
  const BY_ID = new Map(ALL.map((p) => [p.id, p]));
  const CHAPTERS = GENPACK.chapters || { formal: [], super: [] };
  const CATALOG = {
    tutorials: TUTORIALS, formal: FORMAL, super: SUPER, all: ALL, byId: BY_ID,
    formalChapters: CHAPTERS.formal || [], superChapters: CHAPTERS.super || [],
    total: ALL.length, seed: GENPACK.seed || '',
  };

  /** 由配方/系数构造一个与 core.analyse 兼容的对象，供渲染与重建使用 */
  function buildAna(coeffs, n = N) {
    const cRe = new Float64Array(n), cIm = new Float64Array(n);
    const mag = new Float64Array(n), kOf = new Int32Array(n);
    for (let i = 0; i < n; i++) kOf[i] = i < n / 2 ? i : i - n;
    const indices = [];
    const seen = new Set();
    for (const c of coeffs) {
      if (!c || Math.abs(c.amp) < 1e-12) continue;
      const k = Math.round(c.k);
      if (Math.abs(k) >= n / 2) continue;
      const idx = k >= 0 ? k : k + n;
      const ph = c.phase || 0;
      cRe[idx] = c.amp * Math.cos(ph);
      cIm[idx] = c.amp * Math.sin(ph);
      mag[idx] = Math.abs(c.amp);
      if (!seen.has(idx)) { seen.add(idx); indices.push(idx); }
    }
    indices.sort((a, b) => mag[b] - mag[a]);
    return { N: n, cRe, cIm, mag, kOf, indices, samples: [] };
  }

  function recipePoints(recipe, n) {
    return S.spectrumShape(recipe, n);
  }

  /** 参数一致的点对点 RMS 误差（不做平移/旋转归一化，因此相位与 DC 都会计入） */
  function pointwiseError(cur, target, rms) {
    const n = Math.min(cur.length, target.length);
    let s = 0;
    for (let i = 0; i < n; i++) {
      const dx = cur[i].x - target[i].x, dy = cur[i].y - target[i].y;
      s += dx * dx + dy * dy;
    }
    return Math.sqrt(s / Math.max(1, n)) / Math.max(1e-9, rms);
  }

  /** 参数一致的几何距离：与起笔/方向无关，但对 DC、相位、幅度敏感 */
  function errorOf(cur, target, rms) {
    return C.curveDistance(cur, target, 512) / Math.max(1e-9, rms);
  }

  function starFor(err, count, budget, th) {
    const t = th || [0.015, 0.04, 0.08];
    if (err == null) return 0;
    if (err <= t[0] && count <= budget) return 3;
    if (err <= t[1]) return 2;
    if (err <= t[2]) return 1;
    return 0;
  }

  class WorkshopSession {
    constructor(cfg) {
      this.puzzle = cfg.puzzle;
      this.settings = cfg.settings || {};
      this.onComplete = cfg.onComplete || function () {};
      this.onBack = cfg.onBack || function () {};
      this.best = cfg.best || null;
      this.showIntroOnMount = cfg.showIntro !== false;
      this.budget = this.puzzle.budget;
      this.th = (this.puzzle.thresholds || [0.015, 0.04, 0.08]).slice();
      this.maxCoeffs = Math.max(this.budget + 4, 14);

      this.targetPts = recipePoints(this.puzzle.recipe, N);
      this.targetM = recipePoints(this.puzzle.recipe, N);
      this.targetRms = C.rmsRadius(this.targetM);
      this.targetByK = new Map(this.puzzle.recipe.map((c) => [c.k, c]));
      this.targetMag = new Float64Array(N);
      for (const c of this.puzzle.recipe) {
        const idx = c.k >= 0 ? c.k : c.k + N;
        this.targetMag[idx] = Math.abs(c.amp);
      }

      this.coeffs = [];
      this.hintOn = this.puzzle.hintOn !== false;
      this.highlightK = null;
      this.error = null;
      this.stars = 0;
      this.loop = null;
      this.ana = buildAna([]);
      this.t = 0;
      this.speed = 1;
      this.paused = false;
      this.settled = false;
      this.startedAt = performance.now();
      this.elapsed = 0;
      this.needCompute = true;
      this.needDraw = true;
      this.destroyed = false;
      this.lastNow = 0;
      this.raf = 0;
    }

    /* ------------------------- 挂载 ------------------------- */
    mount(container) {
      this.container = container;
      this.root = h('div', { class: 'play workshop' });
      this.buildHead();
      this.buildBody();
      this.buildFoot();
      this.root.append(this.els.head, this.els.body, this.els.foot);
      container.replaceChildren(this.root);

      this.renderer = new R.Renderer(this.els.stage);
      this.renderer.setTheme(this.settings.theme || 'scope');
      this.renderer.brush = this.settings.brush || 'glow';
      this.renderer.trail = this.settings.trail || 'basic';
      this.specRenderer = new R.Renderer(this.els.spectrum);
      this.specRenderer.setTheme(this.settings.theme || 'scope');

      this.renderer.fit(C.bbox(this.targetPts), 0.34, 26);
      this.paintTargetChip();
      this.reset(true);
      this.bindEvents();
      this.updateHUD();
      this.rebuildSide();

      if (this.showIntroOnMount) this.showIntro();
      else this.hint('从' + (matchMedia('(max-width: 900px)').matches ? '下方' : '右侧') + '的 k 面板添加第一个谐波');

      this.lastNow = 0;
      this._frame = (now) => this.frame(now);
      this.raf = requestAnimationFrame(this._frame);
      this.needDraw = true;
      return this;
    }

    buildHead() {
      const p = this.puzzle;
      this.els = {};
      this.els.chapter = h('span', { class: 'chapter-tag' }, '频谱工坊 · 不画线');
      this.els.title = h('h1', { class: 'play-name' }, p.title);
      this.els.teach = h('p', { class: 'play-teach' }, p.kicker);
      this.els.targetCv = h('canvas', { class: 'target-cv', dataset: { w: 52, h: 52 } });
      this.els.targetChip = h('div', { class: 'target-chip' },
        this.els.targetCv,
        h('div', { class: 'target-meta' }, h('span', {}, '目标图形'), h('b', {}, p.title)));
      this.els.stars = h('div', { class: 'stars' });
      this.els.pct = h('span', { class: 'pct' }, '—');
      this.els.errFill = h('i');
      this.els.errBar = h('div', { class: 'err-bar' }, this.els.errFill);
      this.els.scoreBox = h('div', { class: 'score-box' }, this.els.stars,
        h('div', { class: 'err-row' }, this.els.errBar, this.els.pct));
      this.els.clock = h('div', { class: 'clock' }, h('span', {}, '用时 '), h('b', {}, '0.0s'));
      this.els.head = h('div', { class: 'play-head' },
        U.iconBtn('←', { title: '返回工坊', onClick: () => this.onBack() }),
        h('div', { class: 'play-id' }, this.els.chapter, this.els.title, this.els.teach),
        this.els.targetChip, this.els.scoreBox, this.els.clock,
        U.iconBtn('?', { title: '玩法说明', onClick: () => this.showIntro() }));
    }

    buildBody() {
      this.els.stage = h('canvas', { class: 'stage' });
      this.els.hint = h('div', { class: 'stage-hint' });
      this.els.stageWrap = h('div', { class: 'stage-wrap' }, this.els.stage, this.els.hint,
        h('div', { class: 'view-ctrl' },
          U.iconBtn('+', { title: '放大', onClick: () => this.zoomBy(1.25) }),
          U.iconBtn('−', { title: '缩小', onClick: () => this.zoomBy(0.8) }),
          U.iconBtn('⌂', { title: '重置视图', onClick: () => this.fitView() })));

      this.els.count = h('span', { class: 'count' }, '0 / ' + this.budget + ' 谐波');
      this.els.hintBtn = h('button', {
        class: 'mini-toggle' + (this.hintOn ? ' on' : ''),
        onclick: () => { this.hintOn = !this.hintOn; this.rebuildSide(); this.updateHUD(); },
        title: '显示目标幅度 / 相位',
      }, '目标谱');
      this.els.spectrum = h('canvas', { class: 'spectrum', dataset: { w: 300, h: 120 } });
      this.els.list = h('div', { class: 'coeff-list' });
      this.els.palette = h('div', { class: 'k-palette' });
      this.els.paletteWrap = h('div', { class: 'add-harm' },
        h('div', { class: 'add-head' }, h('span', {}, '添加谐波'), h('em', {}, 'k = 每圈转几圈')),
        this.els.palette,
        h('div', { class: 'panel-tip' }, '点击 k 添加；点击已有谐波可高亮对应的圆。金色柱是目标幅度。'));

      const mtab = (sec, label) => h('button', {
        class: 'panel-tab' + (sec === 'spectrum' ? ' on' : ''),
        dataset: { sec },
        onclick: () => {
          if (!this.els.side) return;
          this.els.side.dataset.mtab = sec;
          for (const b of this.els.side.querySelectorAll('.panel-tab')) b.classList.toggle('on', b.dataset.sec === sec);
        },
      }, label);
      this.els.collapseBtn = h('button', {
        class: 'mini-toggle collapse-btn', type: 'button', title: '收起 / 展开面板',
        onclick: () => {
          const collapsed = this.els.side.classList.toggle('collapsed');
          this.els.collapseBtn.textContent = collapsed ? '展开' : '收起';
          this.els.collapseBtn.classList.toggle('on', !collapsed);
        },
      }, '收起');
      this.els.side = h('aside', { class: 'side-panel workshop-side', dataset: { mtab: 'spectrum' } },
        h('div', { class: 'panel-head' }, h('span', {}, '频谱配方'), h('div', { class: 'panel-tools' }, this.els.hintBtn, this.els.count, this.els.collapseBtn)),
        h('div', { class: 'panel-tabs' }, mtab('spectrum', '频谱'), mtab('coeffs', '系数'), mtab('add', '添加')),
        h('div', { class: 'panel-sec', dataset: { sec: 'spectrum' } }, this.els.spectrum),
        h('div', { class: 'panel-sec', dataset: { sec: 'coeffs' } },
          h('div', { class: 'harm-head' }, h('span', {}, '当前谐波'), h('em', {}, '幅度 / 相位')),
          this.els.list),
        h('div', { class: 'panel-sec', dataset: { sec: 'add' } }, this.els.paletteWrap));
      this.els.body = h('div', { class: 'play-body' }, this.els.stageWrap, this.els.side);
    }

    buildFoot() {
      this.els.settleBtn = h('button', { class: 'btn primary settle-btn', onclick: () => this.settle() }, '结算');
      this.els.resetBtn = h('button', { class: 'btn ghost small', onclick: () => this.reset() }, '重置配方');
      this.els.infoBtn = h('button', { class: 'btn ghost small', onclick: () => this.showIntro() }, '玩法');
      this.els.note = h('div', { class: 'foot-note' }, '拖动滑块改变幅度与相位，误差实时更新');
      this.els.foot = h('div', { class: 'play-foot' }, this.els.settleBtn, this.els.note,
        h('div', { class: 'foot-actions' }, this.els.resetBtn, this.els.infoBtn));
    }

    bindEvents() {
      this._onResize = () => {
        if (this.destroyed) return;
        this.renderer.resize(); this.specRenderer.resize();
        this.renderer.fit(C.bbox(this.targetPts), 0.34, 26);
        this.needDraw = true;
        this.drawChart();
      };
      global.addEventListener('resize', this._onResize);
      this._onKey = (e) => {
        if (U.isModalOpen()) return;
        if (e.key === 'r' || e.key === 'R') this.reset();
      };
      global.addEventListener('keydown', this._onKey);
      this.els.spectrum.addEventListener('click', (e) => this.onChartClick(e));
    }

    onChartClick(e) {
      const rect = this.els.spectrum.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const padL = 6, padR = 6;
      const plotW = Math.max(10, rect.width - padL - padR);
      const k = Math.round(-RANGE + ((x - padL) / plotW) * RANGE * 2);
      if (k < -RANGE || k > RANGE) return;
      const has = this.coeffs.find((c) => c.k === k);
      if (has) this.highlight(k);
      else this.addHarmonic(k);
    }

    /* ------------------------- 系数操作 ------------------------- */
    reset(silent) {
      const start = this.puzzle.start || [];
      this.coeffs = start.map((c) => ({ k: c.k, amp: c.amp, phase: c.phase || 0 }));
      this.highlightK = null;
      this.settled = false;
      this.startedAt = performance.now();
      this.elapsed = 0;
      this.t = 0;
      this.recompute();
      this.rebuildSide();
      this.needDraw = true;
      this.updateHUD();
      if (!silent) U.audio.blip();
    }

    hasK(k) { return this.coeffs.some((c) => c.k === k); }

    addHarmonic(k) {
      if (this.hasK(k)) { this.highlight(k); return; }
      if (this.coeffs.length >= this.maxCoeffs) { U.toast('谐波数量已达上限'); return; }
      this.coeffs.push({ k, amp: k === 0 ? 0.4 : 0.5, phase: 0 });
      this.coeffs.sort((a, b) => a.k - b.k);
      U.audio.toggle(true);
      this.recompute();
      this.rebuildSide();
      this.needDraw = true;
    }

    removeHarmonic(k) {
      this.coeffs = this.coeffs.filter((c) => c.k !== k);
      if (this.highlightK === k) this.highlightK = null;
      this.recompute();
      this.rebuildSide();
      this.needDraw = true;
    }

    setCoeff(k, field, value) {
      const c = this.coeffs.find((x) => x.k === k);
      if (!c) return;
      c[field] = value;
      this.needCompute = true;
      const row = this.els.list.querySelector(`[data-k="${k}"]`);
      if (row) {
        if (field === 'amp') row.querySelector('.amp-val').textContent = value.toFixed(2);
        if (field === 'phase') row.querySelector('.ph-val').textContent = Math.round(value * 180 / Math.PI) + '°';
      }
    }

    highlight(k) {
      this.highlightK = this.highlightK === k ? null : k;
      if (this.highlightK != null) U.audio.harmonic(k);
      this.rebuildSide();
      this.needDraw = true;
    }

    /* ------------------------- 计算 ------------------------- */
    recompute() {
      this.ana = buildAna(this.coeffs);
      const idx = this.ana.indices;
      if (idx.length) {
        const flat = C.reconstruct(this.ana, idx, M);
        this.loop = C.reconPoints(flat, M);
        const flat1 = C.reconstruct(this.ana, idx, N);
        const cur = C.reconPoints(flat1, N);
        this.error = errorOf(cur, this.targetM, this.targetRms);
      } else {
        this.loop = null;
        this.error = null;
      }
      this.stars = starFor(this.error, this.coeffs.length, this.budget, this.th);
      this.updateHUD();
    }

    /* ------------------------- HUD ------------------------- */
    hint(text) {
      this.els.hint.textContent = text;
      this.els.hint.classList.toggle('show', !!text);
    }

    updateHUD() {
      const n = this.coeffs.length;
      const err = this.error;
      this.els.count.textContent = `${n} / ${this.budget} 谐波`;
      this.els.count.classList.toggle('over', n > this.budget);
      this.els.pct.textContent = err == null ? '—' : C.formatPct(err, 2);
      const t = this.th;
      this.els.pct.dataset.level = err == null ? '' : err <= t[0] ? '3' : err <= t[1] ? '2' : err <= t[2] ? '1' : '0';
      this.els.errFill.style.width = (err == null ? 0 : Math.min(1, err / t[2]) * 100).toFixed(1) + '%';
      this.els.errFill.dataset.level = this.els.pct.dataset.level;
      this.els.stars.replaceChildren(...[0, 1, 2].map((i) => h('span', { class: 'star' + (i < this.stars ? ' on' : '') }, '★')));
      this.elapsed = (performance.now() - this.startedAt) / 1000;
      this.els.clock.lastChild.textContent = C.formatTime(this.elapsed * 1000);
      let txt = '从' + (matchMedia('(max-width: 900px)').matches ? '下方' : '右侧') + '的 k 面板添加第一个谐波';
      if (n) {
        if (err == null) txt = '调整幅度与相位，让亮线贴合虚线';
        else if (err > t[2]) txt = '差距还很大：检查 k、幅度、相位与 DC';
        else if (this.stars >= 3) txt = '配方正确！按「结算」提交';
        else if (this.stars === 2) txt = '再准一点：幅度到 0.01、相位到 1° 试试';
        else txt = '接近了：继续微调幅度与相位';
      }
      this.hint(txt);
      this.els.settleBtn.disabled = !n;
    }

    rebuildSide() {
      this.els.count.textContent = `${this.coeffs.length} / ${this.budget} 谐波`;
      this.els.count.classList.toggle('over', this.coeffs.length > this.budget);
      this.els.hintBtn.classList.toggle('on', this.hintOn);

      if (!this.coeffs.length) {
        this.els.list.replaceChildren(h('div', { class: 'harm-empty' }, '还没有谐波。从下面的 k 面板添加，或点击频谱里的目标柱。'));
      } else {
        this.els.list.replaceChildren(...this.coeffs.map((c) => {
          const tgt = this.targetByK.get(c.k);
          const row = h('div', { class: 'coeff-row' + (this.highlightK === c.k ? ' hl' : ''), dataset: { k: String(c.k) } },
            h('div', { class: 'coeff-head' },
              h('span', { class: 'coeff-k' }, 'k = ' + (c.k > 0 ? '+' + c.k : c.k)),
              h('button', { class: 'coeff-del', title: '移除', onclick: (e) => { e.stopPropagation(); this.removeHarmonic(c.k); } }, '×')),
            h('label', { class: 'coeff-slider' }, h('span', {}, '幅度'),
              h('input', { type: 'range', min: 0, max: 1.5, step: 0.01, value: c.amp, oninput: (e) => this.setCoeff(c.k, 'amp', +e.target.value) }),
              h('b', { class: 'amp-val' }, c.amp.toFixed(2))),
            h('label', { class: 'coeff-slider' }, h('span', {}, '相位'),
              h('input', { type: 'range', min: 0, max: 360, step: 1, value: Math.round(c.phase * 180 / Math.PI), oninput: (e) => this.setCoeff(c.k, 'phase', +e.target.value * Math.PI / 180) }),
              h('b', { class: 'ph-val' }, Math.round(c.phase * 180 / Math.PI) + '°')),
            this.hintOn ? h('div', { class: 'coeff-target' },
              tgt ? `目标 ${tgt.amp.toFixed(2)} ∠ ${Math.round((tgt.phase || 0) * 180 / Math.PI)}°` : '目标中没有这个 k') : null);
          row.addEventListener('click', () => this.highlight(c.k));
          return row;
        }));
      }

      const ks = [];
      for (let k = -12; k <= 12; k++) ks.push(k);
      this.els.palette.replaceChildren(...ks.map((k) => h('button', {
        class: 'k-btn' + (this.hasK(k) ? ' on' : ''),
        title: this.hasK(k) ? '已有 k=' + k : '添加 k=' + k,
        onclick: () => this.addHarmonic(k),
      }, k > 0 ? '+' + k : String(k))));
      this.drawChart();
    }

    drawChart() {
      this.specRenderer.resize();
      this.specRenderer.drawSpectrum(this.ana, {
        range: RANGE,
        selected: new Set(this.ana.indices),
        highlightK: this.highlightK,
        ghostMags: this.hintOn ? this.targetMag : null,
      });
    }

    paintTargetChip() {
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
      this.t += dt * 0.4 * this.speed;
      if (this.t >= 1) this.t -= 1;
      this.elapsed = (performance.now() - this.startedAt) / 1000;
      if (this.els.clock) this.els.clock.lastChild.textContent = C.formatTime(this.elapsed * 1000);
      if (this.needCompute) { this.needCompute = false; this.recompute(); this.drawChart(); }
      if (this.needDraw) { this.needDraw = false; this.draw(); }
      this.needDraw = true;
      this.raf = requestAnimationFrame(this._frame);
    }

    draw() {
      const r = this.renderer;
      r.drawBackground();
      r.drawGhost(this.targetPts, { alpha: 0.7 });
      if (this.loop) r.drawTrail(this.loop, this.t);
      if (this.ana && this.ana.indices.length) {
        r.drawChain({ ana: this.ana, indices: this.ana.indices, t: this.t, highlightK: this.highlightK });
      }
    }

    zoomBy(f) { this.renderer.setZoom(this.renderer.zoom * f); this.needDraw = true; }
    fitView() { this.renderer.fit(C.bbox(this.targetPts), 0.34, 26); this.needDraw = true; }

    /* ------------------------- 结算 ------------------------- */
    settle() {
      if (this.settled) return;
      if (!this.coeffs.length) { U.toast('先添加至少一个谐波'); return; }
      const stars = starFor(this.error, this.coeffs.length, this.budget, this.th);
      if (stars < 1) { U.audio.fail(); this.showFail(); return; }
      this.settled = true;
      U.audio.success(stars);
      this.onComplete({
        id: this.puzzle.id, error: this.error, count: this.coeffs.length,
        budget: this.budget, time: this.elapsed, stars,
      });
    }

    showFail() {
      const card = h('div', { class: 'modal card fail-card' },
        h('div', { class: 'modal-kicker' }, '还差一点'),
        h('h2', {}, '误差 ' + C.formatPct(this.error, 2)),
        h('p', {}, '一星要求 ≤ 8%。配方可以这样调：'),
        h('ul', { class: 'tips' },
          h('li', {}, '看起来相似但误差大：先检查相位（朝向），再检查 k=0（位置）；'),
          h('li', {}, this.puzzle.hint || '对照目标谱的柱高与相位，检查每个 k；'),
          h('li', {}, '「目标谱」默认打开，金色柱与行内目标值就是答案提示。')),
        h('div', { class: 'modal-actions' },
          U.btn('继续调', { kind: 'primary', onClick: () => U.closeModal() }),
          U.btn('重置配方', { kind: 'ghost', onClick: () => { U.closeModal(); this.reset(); } })));
      U.modal(card);
    }

    showIntro() {
      const preview = h('canvas', { class: 'intro-shape', dataset: { w: 132, h: 132 } });
      const card = h('div', { class: 'modal card intro-card' },
        h('div', { class: 'intro-top' },
          preview,
          h('div', { class: 'intro-meta' },
            h('span', { class: 'chapter-tag' }, '频谱工坊 · ' +
              (this.puzzle.section === 'daily'
                ? this.puzzle.kicker
                : (this.puzzle.section === 'super' ? '超难' : this.puzzle.section === 'formal' ? '正式' : '教程') + ' · ' + this.puzzle.kicker)),
            h('h2', {}, this.puzzle.title),
            h('p', { class: 'intro-teach' }, '不加线，只加圆'),
            h('div', { class: 'criteria' },
              h('span', {}, '谐波预算 '), h('b', {}, String(this.budget)),
              h('span', {}, '误差目标 '), h('b', {}, '≤ ' + (this.th[0] * 100).toFixed(1) + '%')))),
        h('p', { class: 'intro-text' }, this.puzzle.text),
        this.puzzle.formula ? h('div', { class: 'formula mini', html: HP.formula.svg(this.puzzle.formula, { size: 15 }) }) : null,
        h('p', { class: 'intro-note' }, this.puzzle.note),
        h('div', { class: 'star-legend' },
          h('div', {}, U.starsRow(3), h('span', {}, `误差 ≤ ${(this.th[0] * 100).toFixed(1)}% 且不超预算`)),
          h('div', {}, U.starsRow(2), h('span', {}, `误差 ≤ ${(this.th[1] * 100).toFixed(1)}%`)),
          h('div', {}, U.starsRow(1), h('span', {}, `误差 ≤ ${(this.th[2] * 100).toFixed(1)}%`))),
        h('div', { class: 'hint-line' }, h('span', { class: 'hint-icon' }, '✎'),
          h('span', {}, this.puzzle.hintOn
            ? '从 k 面板添加谐波；拖动幅度/相位；「目标谱」默认打开，关掉它可增加难度。'
            : '超难关：「目标谱」默认关闭，只能看形状与误差；卡住时可手动打开。')),
        h('div', { class: 'modal-actions' },
          U.btn('开始调配', { kind: 'primary', onClick: () => U.closeModal() }),
          U.btn('返回工坊', { kind: 'ghost', onClick: () => { U.closeModal(); this.onBack(); } })));
      U.modal(card);
      requestAnimationFrame(() => {
        if (this.targetPts) U.paintShape(preview, this.targetPts, { width: 2, glow: 12 });
      });
    }

    destroy() {
      this.destroyed = true;
      if (this.raf) cancelAnimationFrame(this.raf);
      try {
        global.removeEventListener('resize', this._onResize);
        global.removeEventListener('keydown', this._onKey);
      } catch (e) { /* noop */ }
    }
  }

  HP.workshop = {
    PUZZLES, TUTORIALS, FORMAL, SUPER, ALL, BY_ID, CATALOG,
    create(cfg) { return new WorkshopSession(cfg); }, starFor,
    buildAna, pointwiseError, errorOf, recipePoints,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
