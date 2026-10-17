/* =========================================================
 * 谐波画笔 · 傅里叶讲义 lessons.js
 * 9 节交互式数学课：公式 + 可拖动参数的实时演示
 * ========================================================= */
(function (global) {
  'use strict';
  const HP = (global.HP = global.HP || {});
  const C = HP.core, S = HP.shapes, R = HP.render, U = HP.ui;
  const { h } = U;
  const N = 1024, M = 1440;
  const SAMPLE_N = [4, 8, 16, 32, 64, 128, 256, 512, 1024];

  const LESSONS = [
    {
      id: 'l1', no: '01', title: '为什么是一圈圈圆', kicker: '合成方程',
      summary: '任意闭合曲线，都可以写成一串旋转向量的首尾相接。',
      paragraphs: [
        { h: '把曲线看成复数', p: '平面上的点 (x, y) 可以写成一个复数 z = x + iy。一条闭合曲线，就是一个随时间转动的复数。', f: 'z(t) = x(t) + i\\,y(t),\\quad t \\in [0,1)' },
        { h: '合成', p: '傅里叶级数说：只要把不同转速的圆首尾相接，就能拼出任意闭合曲线。', f: 'z(t) = \\sum_{k} c_k\\, e^{i2\\pi kt}' },
        { h: '每个 cₖ 是什么', p: 'cₖ 是一个复数：模 |cₖ| 是这个圆的半径，辐角 arg cₖ 是它的初相位，整数 k 是它每圈转几圈。把所有圆的末端连起来，就是笔尖的轨迹。' },
        { h: '圆数', p: '游戏里的「圆数」就是非零 cₖ 的个数。K 越大，叠出来的形状越接近原图。' },
      ],
      points: ['每个 cₖ 对应一个旋转的圆', '半径 = |cₖ|', '转速 = k', '初相 = arg cₖ'],
      demo: {
        kind: 'harmonics', shape: 'heart',
        control: { label: '圆数 K', min: 1, max: 64, step: 1, value: 8 },
        caption: '拖动 K，看看圆链如何一点点长出心形。',
      },
    },
    {
      id: 'l2', no: '02', title: '一个旋转的圆', kicker: '复指数',
      summary: '一个复指数就是匀速圆周运动；相位只决定从哪里起笔。',
      paragraphs: [
        { h: '匀速圆周', p: '当只有一个 k=1 的项时，笔尖就在一个圆上匀速转动。', f: 'z(t) = c_1 e^{i2\\pi t},\\quad |c_1| = r' },
        { h: '相位', p: 'arg c₁ 不改变圆本身，只改变起笔点。游戏里从哪儿起笔都不影响误差，因为误差只看形状。' },
        { h: '负频率呢', p: '一个圆只需要 k=+1 一个系数；它的 k=−1 系数是 0。只有当形状被「压扁」时，负频率才会登场。' },
      ],
      points: ['圆 = 1 个复系数', '半径 = |c₁|', '相位 = 起笔角'],
      demo: {
        kind: 'circle',
        control: { label: '相位 φ（度）', min: 0, max: 360, step: 1, value: 0 },
        caption: '拖动相位：圆不变，起点在转。',
      },
    },
    {
      id: 'l3', no: '03', title: '两个圆 = 椭圆', kicker: '共轭对',
      summary: '一正一反两个圆，合成一个长度在伸缩的连杆。',
      paragraphs: [
        { h: '反向旋转', p: '把 k=+1 与 k=−1 两个圆叠在一起，它们反向旋转：', f: 'z(\\theta) = c_1 e^{i\\theta} + c_{-1} e^{-i\\theta} = (c_1+c_{-1})\\cos\\theta + i(c_1-c_{-1})\\sin\\theta' },
        { h: '压扁', p: '取 c₁ = (a+b)/2、c₋₁ = (a−b)/2，轨迹正好是半轴 a、b 的椭圆。两个反向圆，就是「共轭对称」最直观的样子。' },
        { h: '游戏里的体现', p: '椭圆关里，两个反向的圆一个变大、一个变小，圆就被压扁了。' },
      ],
      points: ['椭圆 = 2 个圆', '反向旋转', '幅度差决定扁的程度'],
      demo: {
        kind: 'ellipse',
        control: { label: 'c₋₁ 幅度', min: 0, max: 1, step: 0.01, value: 0 },
        caption: '拖动 c₋₁：从圆到椭圆，再到一条线。',
      },
    },
    {
      id: 'l4', no: '04', title: '0 阶圆负责平移', kicker: 'DC 分量',
      summary: 'c₀ 是图形的平均位置，它不改变形状。',
      paragraphs: [
        { h: '平均位置', p: 'k=0 的项 e<sup>i0</sup>=1 不随时间转，它只是把整个图形平移。', f: 'c_0 = \\frac{1}{N}\\sum_{n} p_n' },
        { h: '游戏里的体现', p: '偏移圆关卡里，关掉 k=0，圆会跳回原点，形状一模一样。' },
      ],
      points: ['c₀ = 平移', '不改变形状', '在频谱中间'],
      demo: {
        kind: 'dc',
        control: { label: '|c₀| 幅度', min: 0, max: 1, step: 0.01, value: 0 },
        caption: '拖动 c₀：整圆平移，形状不变。',
      },
    },
    {
      id: 'l5', no: '05', title: '幅度谱不等于形状', kicker: '幅度与相位',
      summary: '同样的 |cₖ|，相位不同，形状就不同。',
      paragraphs: [
        { h: '复数的两个数', p: '频谱柱状图只画了 |cₖ|，它丢掉了 φₖ。要还原形状，必须同时知道幅度与相位。', f: 'c_k = |c_k|\\, e^{i\\varphi_k}' },
        { h: '旋转', p: '改变某个 φₖ，对应的圆会从一个角度起步，合成的曲线就跟着转或变形。' },
        { h: '读谱师', p: '游戏里的读谱师只给幅度谱，所以候选形状都选了相位差异明显的例子；真实的完整频谱一定包含相位。' },
      ],
      points: ['幅度 = 多大', '相位 = 从哪个角度开始', '缺一不可'],
      demo: {
        kind: 'phase',
        control: { label: 'arg c₋₁（度）', min: 0, max: 360, step: 1, value: 0 },
        caption: '只改一个相位，椭圆就转起来了。',
      },
    },
    {
      id: 'l6', no: '06', title: '尖角来自高频', kicker: '奇次谐波',
      summary: '正方形只需要奇次谐波，但角永远差一点。',
      paragraphs: [
        { h: '方波的配方', p: '正方形的复傅里叶系数集中在奇次谐波上，幅度大约按 1/k 衰减。', f: 'c_k \\propto 1/k,\\quad k=\\pm1,\\pm3,\\pm5,\\dots' },
        { h: '越加越尖', p: 'K 越大，角越接近直角；但角上总会有过冲与振铃——这就是吉布斯现象。' },
        { h: '游戏里的体现', p: '正方形关卡里，把圆数从 5 拉到 15，看看角的变化。' },
      ],
      points: ['奇次谐波', '高频 = 尖角', '过冲约 9%'],
      demo: {
        kind: 'harmonics', shape: 'square',
        control: { label: '圆数 K', min: 1, max: 60, step: 1, value: 5 },
        caption: '拖动 K：角越来越尖，但过冲一直在。',
      },
    },
    {
      id: 'l7', no: '07', title: '9% 的过冲', kicker: '吉布斯现象',
      summary: '方波的傅里叶部分和，在跳变处永远会冲过头。',
      paragraphs: [
        { h: '部分和', p: '用前 K 个奇次谐波逼近方波：', f: 'y_K(t) = \\frac{4}{\\pi}\\sum_{m\\ \\text{odd}\\le K}\\frac{\\sin(2\\pi m t)}{m}' },
        { h: '极限', p: '随着 K 增大，过冲不会消失，而是趋近于跳变高度的 8.95%。这是傅里叶级数在间断点处的固有行为，不是画错了。' },
        { h: '游戏里的体现', p: '正方形关的角上那一点点「冒出去」就是它。' },
      ],
      points: ['过冲 ≈ 8.95% of jump', '不随 K 消失', '振铃'],
      demo: {
        kind: 'gibbs',
        control: { label: '谐波数 K', min: 1, max: 31, step: 2, value: 9 },
        caption: '拖动 K：振铃变密，但峰值稳定在 1.179 附近。',
      },
    },
    {
      id: 'l8', no: '08', title: '高频是细节', kicker: '低频与高频',
      summary: '枫叶的锯齿在 k 很大的地方，整体轮廓在 k 很小的地方。',
      paragraphs: [
        { h: '低频轮廓', p: '前几个圆决定整体形状：叶子的外轮廓、鱼的身体。' },
        { h: '高频细节', p: '锯齿、鱼鳍、尖尾都在高频。减少圆数时，细节先消失，轮廓还留着。' },
        { h: '怎么读频谱', p: '频谱的尾巴（k 很大的柱子）就是细节。尾巴很长，说明边缘很「扎」。' },
      ],
      points: ['低频 = 轮廓', '高频 = 细节', '看频谱的尾巴'],
      demo: {
        kind: 'detail', shape: 'maple',
        control: { label: '圆数 K', min: 2, max: 120, step: 1, value: 12 },
        caption: '把 K 从 120 拉到 8，看锯齿怎么消失。',
      },
    },
    {
      id: 'l9', no: '09', title: '采样与混叠', kicker: '离散傅里叶',
      summary: 'N 个采样点只能表示 N 个独立频率。',
      paragraphs: [
        { h: '离散', p: '我们对曲线均匀采样 N 个点，就得到 N 个复系数，能表示的频率是 k ∈ [−N/2, N/2)。', f: 'c_k = \\frac{1}{N}\\sum_{n=0}^{N-1} p_n\\, e^{-2\\pi i kn/N}' },
        { h: '混叠', p: '如果形状的高频细节超过 N/2，它们会「折」进低频，形状就变形了。这就是混叠。' },
        { h: '游戏用多少', p: '《谐波画笔》取 N=1024，最多 500 个圆，所以 500 个圆以内不会混叠。' },
      ],
      points: ['N 点 → N 个系数', '最高 |k| = N/2', '混叠'],
      demo: {
        kind: 'sampling', shape: 'heart',
        control: { label: '采样数 N', min: 0, max: SAMPLE_N.length - 1, step: 1, value: 2 },
        caption: '拖动 N：采样点越少，形状越「折」。',
      },
    },
  ];

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

  function pointwise(cur, target, rms) {
    const n = Math.min(cur.length, target.length);
    let s = 0;
    for (let i = 0; i < n; i++) {
      const dx = cur[i].x - target[i].x, dy = cur[i].y - target[i].y;
      s += dx * dx + dy * dy;
    }
    return Math.sqrt(s / Math.max(1, n)) / Math.max(1e-9, rms);
  }

  const pct = (v) => (v * 100).toFixed(2) + '%';

  class LessonDemo {
    constructor(canvas, lesson, opts) {
      this.canvas = canvas;
      this.lesson = lesson;
      this.kind = lesson.demo.kind;
      this.settings = opts.settings || {};
      this.onReadout = opts.onReadout || function () {};
      this.param = lesson.demo.control ? lesson.demo.control.value : 0;
      this.renderer = new R.Renderer(canvas);
      this.renderer.setTheme(this.settings.theme || 'scope');
      this.renderer.brush = 'glow';
      this.t = 0.2;
      this.lastNow = 0;
      this.destroyed = false;
      this.raf = 0;
      this.samples = null;
      this.build();
      this.update();
      this.draw();
      this._onResize = () => {
        if (this.destroyed) return;
        this.renderer.resize();
        this.renderer.fit(C.bbox(this.targetPts), 0.32, 20);
        this.draw();
      };
      global.addEventListener('resize', this._onResize);
      this._frame = (now) => this.frame(now);
      this.raf = requestAnimationFrame(this._frame);
    }

    build() {
      const k = this.kind, d = this.lesson.demo;
      if (k === 'harmonics' || k === 'detail') {
        this.targetPts = S.get(d.shape);
        this.anaTarget = C.analyse(this.targetPts, N);
        this.targetPts = this.anaTarget.samples;
        this.targetSamples = this.anaTarget.samples;
        this.targetRms = C.rmsRadius(this.targetSamples);
      } else if (k === 'circle') {
        this.targetPts = C.ellipsePoints(0, 0, 1, 1, 0, 900);
        this.targetSamples = C.resampleClosed(this.targetPts, N);
        this.targetRms = C.rmsRadius(this.targetSamples);
      } else if (k === 'ellipse') {
        this.targetPts = S.spectrumShape([{ k: 1, amp: 1 }, { k: -1, amp: 0.45 }], N);
        this.targetSamples = this.targetPts;
        this.targetRms = C.rmsRadius(this.targetSamples);
      } else if (k === 'dc') {
        this.targetPts = S.spectrumShape([{ k: 0, amp: 0.6, phase: 1.0 }, { k: 1, amp: 0.8 }], N);
        this.targetSamples = this.targetPts;
        this.targetRms = C.rmsRadius(this.targetSamples);
      } else if (k === 'phase') {
        this.targetPts = S.spectrumShape([{ k: 1, amp: 1 }, { k: -1, amp: 0.5, phase: 1.2 }], N);
        this.targetSamples = this.targetPts;
        this.targetRms = C.rmsRadius(this.targetSamples);
      } else if (k === 'sampling') {
        this.targetPts = S.get(d.shape);
        this.targetSamples = C.resampleClosed(this.targetPts, N);
        this.targetRms = C.rmsRadius(this.targetSamples);
      }
      this.renderer.fit(C.bbox(this.targetPts), 0.32, 20);
    }

    setParam(v) {
      this.param = v;
      this.update();
      this.draw();
    }

    update() {
      const k = this.kind;
      if (k === 'harmonics' || k === 'detail') {
        const K = Math.max(1, Math.round(this.param));
        this.ana = this.anaTarget;
        this.indices = C.topIndices(this.ana, K);
        this.loop = C.reconPoints(C.reconstruct(this.ana, this.indices, M), M);
        const cur = C.reconPoints(C.reconstruct(this.ana, this.indices, N), N);
        this.err = pointwise(cur, this.targetSamples, this.targetRms);
        this.readout = `K = ${K} · 误差 ${pct(this.err)}`;
      } else if (k === 'circle') {
        const ph = this.param * Math.PI / 180;
        this.ana = buildAna([{ k: 1, amp: 1, phase: ph }]);
        this.indices = this.ana.indices;
        this.loop = C.reconPoints(C.reconstruct(this.ana, this.indices, M), M);
        this.err = 0;
        this.readout = `c₁ = 1.00 ∠ ${Math.round(this.param)}° · 形状不变，只换起点`;
      } else if (k === 'ellipse') {
        this.ana = buildAna([{ k: 1, amp: 1 }, { k: -1, amp: this.param }]);
        this.indices = this.ana.indices;
        this.loop = C.reconPoints(C.reconstruct(this.ana, this.indices, M), M);
        const cur = C.reconPoints(C.reconstruct(this.ana, this.indices, N), N);
        this.err = C.curveDistance(cur, this.targetSamples, 512) / this.targetRms;
        this.readout = `c₋₁ = ${this.param.toFixed(2)} · 误差 ${pct(this.err)}`;
      } else if (k === 'dc') {
        this.ana = buildAna([{ k: 0, amp: this.param, phase: 1.0 }, { k: 1, amp: 0.8 }]);
        this.indices = this.ana.indices;
        this.loop = C.reconPoints(C.reconstruct(this.ana, this.indices, M), M);
        const cur = C.reconPoints(C.reconstruct(this.ana, this.indices, N), N);
        this.err = C.curveDistance(cur, this.targetSamples, 512) / this.targetRms;
        this.readout = `|c₀| = ${this.param.toFixed(2)} · 误差 ${pct(this.err)}`;
      } else if (k === 'phase') {
        const ph = this.param * Math.PI / 180;
        this.ana = buildAna([{ k: 1, amp: 1 }, { k: -1, amp: 0.5, phase: ph }]);
        this.indices = this.ana.indices;
        this.loop = C.reconPoints(C.reconstruct(this.ana, this.indices, M), M);
        const cur = C.reconPoints(C.reconstruct(this.ana, this.indices, N), N);
        this.err = C.curveDistance(cur, this.targetSamples, 512) / this.targetRms;
        this.readout = `arg c₋₁ = ${Math.round(this.param)}° · 误差 ${pct(this.err)}`;
      } else if (k === 'sampling') {
        this.N = SAMPLE_N[C.clamp(Math.round(this.param), 0, SAMPLE_N.length - 1)];
        this.ana = C.analyse(this.targetPts, this.N);
        this.indices = C.topIndices(this.ana, this.N);
        this.loop = C.reconPoints(C.reconstruct(this.ana, this.indices, M), M);
        const cur = C.reconPoints(C.reconstruct(this.ana, this.indices, N), N);
        this.err = pointwise(cur, this.targetSamples, this.targetRms);
        this.samples = this.ana.samples;
        this.readout = `N = ${this.N} · ${this.N} 个系数 · 最高 |k| = ${Math.floor(this.N / 2)} · 误差 ${pct(this.err)}`;
      }
      this.onReadout(this.readout);
    }

    frame(now) {
      if (this.destroyed) return;
      if (!this.lastNow) this.lastNow = now;
      const dt = Math.min(0.06, (now - this.lastNow) / 1000);
      this.lastNow = now;
      this.t += dt * 0.3;
      if (this.t >= 1) this.t -= 1;
      this.draw();
      this.raf = requestAnimationFrame(this._frame);
    }

    draw() {
      const r = this.renderer;
      r.drawBackground();
      r.drawGhost(this.targetPts, { alpha: 0.55 });
      if (this.samples) {
        const ctx = r.ctx;
        ctx.save();
        ctx.fillStyle = r.theme.warn;
        ctx.globalAlpha = 0.8;
        for (const p of this.samples) {
          const s = r.toScreen(p.x, p.y);
          ctx.beginPath();
          ctx.arc(s.x, s.y, 2.4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      if (this.loop) r.drawTrail(this.loop, this.t, { fullAlpha: 0.07 });
      if (this.ana && this.indices && this.indices.length) {
        r.drawChain({ ana: this.ana, indices: this.indices, t: this.t });
      }
      if (this.kind === 'circle' && this.loop) {
        const s = r.toScreen(this.loop[0].x, this.loop[0].y);
        const ctx = r.ctx;
        ctx.save();
        ctx.fillStyle = r.theme.warn;
        ctx.beginPath(); ctx.arc(s.x, s.y, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = r.theme.text;
        ctx.font = '10px "Microsoft YaHei", sans-serif';
        ctx.fillText('t=0', s.x + 7, s.y - 6);
        ctx.restore();
      }
    }

    destroy() {
      this.destroyed = true;
      if (this.raf) cancelAnimationFrame(this.raf);
      try { global.removeEventListener('resize', this._onResize); } catch (e) { /* noop */ }
    }
  }

  /* ---------------- 吉布斯：1D 方波部分和 ---------------- */
  class GibbsDemo {
    constructor(canvas, lesson, opts) {
      this.canvas = canvas;
      this.param = lesson.demo.control.value;
      this.settings = opts.settings || {};
      this.onReadout = opts.onReadout || function () {};
      this.draw();
      this._onResize = () => this.draw();
      global.addEventListener('resize', this._onResize);
    }

    setParam(v) {
      this.param = v;
      this.draw();
    }

    partial(t, K) {
      let y = 0;
      for (let m = 1; m <= K; m += 2) y += Math.sin(2 * Math.PI * m * t) / m;
      return (4 / Math.PI) * y;
    }

    draw() {
      const cv = this.canvas;
      const dpr = Math.min(global.devicePixelRatio || 1, 2.5);
      const rect = cv.getBoundingClientRect();
      const W = Math.max(200, Math.round(rect.width || 600));
      const H = Math.max(180, Math.round(rect.height || 360));
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      const ctx = cv.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const T = R.THEMES[this.settings.theme || 'scope'];
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, T.bg1); g.addColorStop(1, T.bg2);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

      const L = 46, Rm = 20, Tm = 26, Bm = 34;
      const pw = W - L - Rm, ph = H - Tm - Bm;
      const x0 = 0, x1 = 1.5, y0 = -1.45, y1 = 1.45;
      const X = (t) => L + ((t - x0) / (x1 - x0)) * pw;
      const Y = (y) => Tm + ((y1 - y) / (y1 - y0)) * ph;

      // 网格
      ctx.strokeStyle = T.grid;
      ctx.lineWidth = 1;
      for (let t = 0; t <= 1.5; t += 0.25) {
        ctx.beginPath(); ctx.moveTo(X(t), Tm); ctx.lineTo(X(t), Tm + ph); ctx.stroke();
      }
      for (let y = -1; y <= 1; y += 0.5) {
        ctx.beginPath(); ctx.moveTo(L, Y(y)); ctx.lineTo(L + pw, Y(y)); ctx.stroke();
      }
      // 坐标轴
      ctx.strokeStyle = T.gridBold;
      ctx.beginPath(); ctx.moveTo(L, Y(0)); ctx.lineTo(L + pw, Y(0)); ctx.stroke();

      // 目标方波
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = T.ghost;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      const sq = (t) => (Math.sin(2 * Math.PI * t) >= 0 ? 1 : -1);
      let started = false;
      for (let t = 0; t <= 1.5; t += 0.002) {
        const y = sq(t);
        if (!started) { ctx.moveTo(X(t), Y(y)); started = true; } else ctx.lineTo(X(t), Y(y));
      }
      ctx.stroke();
      ctx.restore();

      // 部分和
      let peak = -Infinity, peakT = 0;
      ctx.beginPath();
      const K = Math.max(1, Math.round(this.param));
      for (let i = 0; i <= 900; i++) {
        const t = (i / 900) * 1.5;
        const y = this.partial(t, K);
        if (y > peak) { peak = y; peakT = t; }
        if (i === 0) ctx.moveTo(X(t), Y(y)); else ctx.lineTo(X(t), Y(y));
      }
      ctx.strokeStyle = T.trail;
      ctx.lineWidth = 2;
      ctx.stroke();

      // 峰值标记
      const over = ((peak - 1) / 2) * 100;
      if (peak > 1.02) {
        ctx.save();
        ctx.fillStyle = T.warn;
        ctx.beginPath(); ctx.arc(X(peakT), Y(peak), 3.4, 0, Math.PI * 2); ctx.fill();
        ctx.font = '10px "Microsoft YaHei", sans-serif';
        ctx.fillText(`峰值 ${peak.toFixed(3)}`, Math.min(X(peakT) + 8, W - 92), Y(peak) - 8);
        ctx.restore();
      }

      // 标签
      ctx.fillStyle = T.muted;
      ctx.font = '10px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('+1', L - 10, Y(1) + 3);
      ctx.fillText('0', L - 10, Y(0) + 3);
      ctx.fillText('−1', L - 10, Y(-1) + 3);
      ctx.textAlign = 'center';
      for (let t = 0; t <= 1.5; t += 0.5) ctx.fillText(t.toFixed(1), X(t), Tm + ph + 15);
      ctx.textAlign = 'left';
      ctx.fillText('t', L + pw + 3, Tm + ph + 15);
      ctx.fillStyle = T.muted;
      ctx.fillText('方波的目标 vs 前 K 个奇次谐波的部分和', L, 16);
      ctx.textAlign = 'start';

      this.onReadout(`K = ${K} · 峰值 ${peak.toFixed(3)} · 过冲 ${over.toFixed(2)}%（极限 8.95%）`);
    }

    destroy() {
      try { global.removeEventListener('resize', this._onResize); } catch (e) { /* noop */ }
    }
  }

  HP.lessons = {
    LESSONS, SAMPLE_N,
    createDemo(canvas, lesson, opts) {
      return lesson.demo.kind === 'gibbs'
        ? new GibbsDemo(canvas, lesson, opts)
        : new LessonDemo(canvas, lesson, opts);
    },
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
