/* =========================================================
 * 谐波画笔 · 程序化关卡生成器 generator.js
 *  - 确定性种子：同一 seed/版本永远生成同一批关卡
 *  - 工坊：正式关卡 6×10 + 超难关 3×8，形状家族 / 难度 / 题型多样
 *  - 读谱：程序化生成 4 种题型（读谱选形 / 看形选谱 / 找缺失 / 数圆）
 *  - 工具页 generator.html 可换种子、预览、导出、应用到游戏
 * ========================================================= */
(function (global) {
  'use strict';
  const HP = (global.HP = global.HP || {});
  const C = HP.core, S = HP.shapes;
  const VERSION = 1;
  const DEG = Math.PI / 180;
  const KMAX = 12;
  const DEFAULT_SEED = 'harmonicbrush.gen.v1';
  const SEED_KEY = 'harmonicbrush.gen.seed.v1';

  /* ------------------------- 种子 RNG ------------------------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function hex8(n) { return ('0000000' + (n >>> 0).toString(16)).slice(-8); }
  function rngOf() { return mulberry32(hash(Array.prototype.join.call(arguments, '|'))); }
  const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
  const rand = (rng, a, b) => a + (b - a) * rng();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const q = (v, step) => Math.round(v / step) * step;
  const degOf = (c) => (c.phase || 0) * 180 / Math.PI;
  const gcd2 = (a, b) => (b ? gcd2(b, a % b) : Math.abs(a));
  const gcdAll = (arr) => arr.reduce((a, b) => gcd2(a, b), 0);

  function currentSeed() {
    try {
      const s = global.localStorage && global.localStorage.getItem(SEED_KEY);
      if (s) {
        const t = String(s).trim();
        if (t && t.length <= 80) return t;
      }
    } catch (e) { /* noop */ }
    return DEFAULT_SEED;
  }

  /* ------------------------- 配方工具 ------------------------- */
  function mk(k, amp, deg) {
    return { k: k, amp: clamp(amp, 0.08, 1), phase: deg * DEG };
  }
  function dedupe(recipe) {
    const seen = new Set();
    const out = [];
    for (const c of recipe) {
      if (!c || !Number.isFinite(c.k) || !Number.isFinite(c.amp)) continue;
      if (Math.abs(c.k) > KMAX) continue;
      const k = Math.round(c.k);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ k: k, amp: c.amp, phase: c.phase || 0 });
    }
    return out;
  }
  function quantize(recipe, opts) {
    const ampStep = opts && opts.ampStep ? opts.ampStep : 0.05;
    const degStep = opts && opts.degStep ? opts.degStep : 15;
    return dedupe(recipe).map((c) => ({
      k: c.k,
      amp: clamp(q(c.amp, ampStep), ampStep, 1),
      phase: q(degOf(c), degStep) * DEG,
    }));
  }
  function ensureGcd(recipe, rng) {
    if (!recipe.length) return recipe;
    const ks = recipe.filter((c) => c.k !== 0).map((c) => Math.abs(c.k));
    if (!ks.length) return recipe;
    if (gcdAll(ks) === 1) return recipe;
    // 频率有公因数 → 曲线会自我重复；插一个 k=1 打破它
    const has1 = recipe.some((c) => Math.abs(c.k) === 1);
    if (!has1) recipe.push(mk(1, rand(rng, 0.35, 0.7), Math.floor(rng() * 24) * 15));
    return recipe;
  }
  function fitCount(recipe, rng, count, opts) {
    const allowZero = !!(opts && opts.allowZero);
    let r = dedupe(recipe);
    if (!allowZero) r = r.filter((c) => c.k !== 0);
    ensureGcd(r, rng);
    if (r.length > count) {
      // 先保 k=±1，再删最小的
      r.sort((a, b) => Math.abs(b.k) - Math.abs(a.k));
      while (r.length > count) {
        let idx = -1, min = Infinity;
        for (let i = 0; i < r.length; i++) {
          if (Math.abs(r[i].k) === 1 && r.length > 2) continue;
          if (r[i].amp < min) { min = r[i].amp; idx = i; }
        }
        if (idx < 0) idx = r.length - 1;
        r.splice(idx, 1);
      }
    }
    let guard = 0;
    while (r.length < count && guard++ < 80) {
      const pool = [];
      for (let k = 1; k <= Math.min(KMAX, 9); k++) {
        if (!r.some((c) => c.k === k)) pool.push(k);
        if (!r.some((c) => c.k === -k)) pool.push(-k);
      }
      const k = pick(rng, pool);
      if (k == null) break;
      r.push(mk(k, rand(rng, 0.1, 0.28), Math.floor(rng() * 24) * 15));
    }
    ensureGcd(r, rng);
    if (!r.some((c) => Math.abs(c.k) === 1)) r.push(mk(1, 0.6, 0));
    return quantize(r, opts);
  }

  /* ------------------------- 形状家族 ------------------------- */
  const FAMILIES = {
    flower: {
      id: 'flower', name: '花瓣', noun: ['花冠', '星花', '瓣轮', '旋花', '蕊环', '双瓣', '细齿花', '逆旋花', '折瓣', '薄暮花'],
      kicker: '合成 · 花瓣',
      formula: 'z(t) = e^{2\\pi i t} + a\\, e^{2\\pi i m t}',
      note: '低音的圆定轮廓，高音的圆刻出重复的鼓包；鼓包数 = m − 1。',
      build(rng, cfg) {
        const m = 3 + Math.floor(rng() * 7);
        const r = [
          mk(1, 1, Math.floor(rng() * 24) * 15),
          mk(m, rand(rng, 0.2, 0.55), Math.floor(rng() * 24) * 15),
        ];
        if (cfg.count >= 3 && rng() < 0.65) r.push(mk(2, rand(rng, 0.1, 0.26), Math.floor(rng() * 24) * 15));
        if (cfg.count >= 4 && rng() < 0.4) r.push(mk(-m, rand(rng, 0.08, 0.2), Math.floor(rng() * 24) * 15));
        return r;
      },
    },
    star: {
      id: 'star', name: '星轮', noun: ['星轮', '齿轮', '尖星', '芒星', '棘轮', '棱星', '光刺', '折星', '霜齿'],
      kicker: '合成 · 星轮',
      formula: 'z(t) = a_1 e^{2\\pi i t} + a_m e^{2\\pi i m t}',
      note: '主圆和高速圆叠在一起：高速圆越大，尖角越尖、齿越深。',
      build(rng, cfg) {
        const m = 3 + Math.floor(rng() * 8);
        const r = [
          mk(1, rand(rng, 0.5, 1), Math.floor(rng() * 24) * 15),
          mk(m, rand(rng, 0.5, 0.95), Math.floor(rng() * 24) * 15),
        ];
        if (cfg.count >= 3) r.push(mk(2, rand(rng, 0.08, 0.22), Math.floor(rng() * 24) * 15));
        if (cfg.count >= 4) r.push(mk(-1, rand(rng, 0.1, 0.3), Math.floor(rng() * 24) * 15));
        return r;
      },
    },
    spiral: {
      id: 'spiral', name: '螺旋', noun: ['螺旋', '涡卷', '螺贝', '回旋', '卷云', '盘涡', '旋臂', '螺线'],
      kicker: '合成 · 螺旋',
      formula: 'z(t) = \\sum_{k=1}^{3} c_k e^{2\\pi i k t}',
      note: '几个同向旋转的圆以不同速度叠加，会拉出螺旋臂与偏心环。',
      build(rng, cfg) {
        const r = [
          mk(1, 1, Math.floor(rng() * 24) * 15),
          mk(2, rand(rng, 0.35, 0.65), Math.floor(rng() * 24) * 15),
          mk(3, rand(rng, 0.15, 0.4), Math.floor(rng() * 24) * 15),
        ];
        if (cfg.count >= 4) r.push(mk(4, rand(rng, 0.08, 0.22), Math.floor(rng() * 24) * 15));
        if (cfg.count >= 5) r.push(mk(-2, rand(rng, 0.1, 0.2), Math.floor(rng() * 24) * 15));
        return r;
      },
    },
    leaf: {
      id: 'leaf', name: '叶', noun: ['叶脉', '双生叶', '翼叶', '镜叶', '对生叶', '薄叶', '折叶'],
      kicker: '合成 · 共轭叶',
      formula: 'c_{-k} = \\overline{c_k}',
      note: '一对共轭的频率（k 与 −k）会合成一条来回伸缩的连杆；再加主圆，就成了叶片。',
      build(rng, cfg) {
        const m = 2 + Math.floor(rng() * 3);
        const a = rand(rng, 0.35, 0.6);
        const ph = Math.floor(rng() * 24) * 15;
        const r = [
          mk(1, 1, Math.floor(rng() * 24) * 15),
          mk(m, a, ph),
          mk(-m, a, -ph),
        ];
        if (cfg.count >= 4) r.push(mk(2, rand(rng, 0.08, 0.2), Math.floor(rng() * 24) * 15));
        return r;
      },
    },
    offset: {
      id: 'offset', name: '偏移', noun: ['偏心环', '漂移花', '移心轮', '偏移星', '漂叶', '离芯盘'],
      kicker: '合成 · DC 偏移',
      formula: 'z(t) = c_0 + z_0(t)',
      note: 'k=0 只负责平移：它不改变形状，只把整个图形挪到别处。',
      build(rng, cfg) {
        const r = [
          mk(0, rand(rng, 0.3, 0.6), Math.floor(rng() * 24) * 15),
          mk(1, rand(rng, 0.6, 0.9), Math.floor(rng() * 24) * 15),
        ];
        const m = 2 + Math.floor(rng() * 4);
        r.push(mk(m, rand(rng, 0.2, 0.4), Math.floor(rng() * 24) * 15));
        if (cfg.count >= 4) r.push(mk(-1, rand(rng, 0.1, 0.25), Math.floor(rng() * 24) * 15));
        return r;
      },
    },
    wobble: {
      id: 'wobble', name: '波纹', noun: ['波纹环', '涟漪', '细浪', '颤环', '微波', '水纹', '漾环'],
      kicker: '合成 · 近频波纹',
      formula: 'z(t) = e^{2\\pi i t} + \\sum_{k=2}^{4} c_k e^{2\\pi i k t}',
      note: '邻近的低次谐波会在大圆上压出缓慢起伏的波纹；幅度越小，波纹越浅。',
      build(rng, cfg) {
        const r = [
          mk(1, 1, Math.floor(rng() * 24) * 15),
          mk(2, rand(rng, 0.12, 0.3), Math.floor(rng() * 24) * 15),
          mk(3, rand(rng, 0.06, 0.2), Math.floor(rng() * 24) * 15),
        ];
        if (cfg.count >= 4) r.push(mk(4, rand(rng, 0.05, 0.14), Math.floor(rng() * 24) * 15));
        return r;
      },
    },
    symmetric: {
      id: 'symmetric', name: '对称', noun: ['对称翼', '镜面花', '双旋翼', '对折星', '镜像环', '双翼'],
      kicker: '合成 · 共轭对称',
      formula: 'c_{-k} = \\overline{c_k}',
      note: '频谱左右对称（c₋ₖ = conj cₖ）时，图形关于横轴镜像；相位一破，对称就歪。',
      build(rng, cfg) {
        const r = [mk(1, rand(rng, 0.7, 0.95), Math.floor(rng() * 24) * 15)];
        const pairs = 2 + Math.floor(rng() * 2);
        for (let k = 2; k <= pairs + 1; k++) {
          const a = rand(rng, 0.15, 0.4) / (k - 1);
          const ph = Math.floor(rng() * 24) * 15;
          r.push(mk(k, a, ph));
          r.push(mk(-k, a, -ph));
        }
        if (cfg.count >= 4) r.push(mk(-1, rand(rng, 0.1, 0.25), Math.floor(rng() * 24) * 15));
        return r;
      },
    },
    dense: {
      id: 'dense', name: '密纹', noun: ['碎光轮', '万花筒', '密纹盘', '繁花', '织纹', '星尘盘', '叠瓣'],
      kicker: '合成 · 密集频谱',
      formula: 'z(t) = \\sum_{k} c_k e^{2\\pi i k t}',
      note: '柱子越多，细节越多；先配大柱定轮廓，再补小柱加纹理。',
      build(rng, cfg) {
        const r = [mk(1, 1, Math.floor(rng() * 24) * 15)];
        const n = Math.max(4, cfg.count);
        const used = new Set([1]);
        let guard = 0;
        while (r.length < n && guard++ < 60) {
          const k = (rng() < 0.35 ? -1 : 1) * (2 + Math.floor(rng() * 8));
          if (used.has(k)) continue;
          used.add(k);
          r.push(mk(k, rand(rng, 0.12, 0.55) / Math.sqrt(r.length), Math.floor(rng() * 24) * 15));
        }
        return r;
      },
    },
    high: {
      id: 'high', name: '高频', noun: ['高音齿轮', '细齿星', '高频花', '密齿轮', '尖啸环', '高频盘'],
      kicker: '合成 · 高次谐波',
      formula: 'z(t) = e^{2\\pi i t} + a\\, e^{2\\pi i m t}',
      note: '高次谐波决定细节与尖角；把它调小，尖齿立刻变圆。',
      build(rng, cfg) {
        const m = 6 + Math.floor(rng() * 7);
        const r = [
          mk(1, 1, Math.floor(rng() * 24) * 15),
          mk(m, rand(rng, 0.3, 0.7), Math.floor(rng() * 24) * 15),
        ];
        if (cfg.count >= 3) r.push(mk(m - 1, rand(rng, 0.08, 0.2), Math.floor(rng() * 24) * 15));
        if (cfg.count >= 4) r.push(mk(2, rand(rng, 0.08, 0.16), Math.floor(rng() * 24) * 15));
        return r;
      },
    },
    random: {
      id: 'random', name: '随机', noun: ['曼陀罗', '混沌花', '随机盘', '星尘环', '杂音轮', '无序纹', '噪谱'],
      kicker: '合成 · 随机稀疏',
      formula: 'z(t) = \\sum_{k} c_k e^{2\\pi i k t}',
      note: '没有两条相同的随机谱；读柱高、试相位，把散落的频率拼回形状。',
      build(rng, cfg) {
        const r = [mk(1, 1, Math.floor(rng() * 24) * 15)];
        const n = Math.max(3, cfg.count);
        const used = new Set([1]);
        let guard = 0;
        while (r.length < n && guard++ < 60) {
          const k = Math.round(rand(rng, -10, 10));
          if (!k || used.has(k)) continue;
          used.add(k);
          r.push(mk(k, rand(rng, 0.1, 0.6) / Math.sqrt(r.length), Math.floor(rng() * 24) * 15));
        }
        return r;
      },
    },
  };
  const FAMILY_ORDER = Object.keys(FAMILIES);
  const ADJ = ['微光', '折返', '逆旋', '双生', '细密', '高音', '低语', '偏心', '薄暮', '碎光', '暗涌', '霜纹', '回响', '浮游', '冷焰', '轻颤', '远星', '潜行'];

  /* ------------------------- 单关生成 ------------------------- */
  function makeStart(recipe, rng, type, superMode) {
    if (type === 'synth') return null;
    const start = recipe.map((c) => ({ k: c.k, amp: c.amp, phase: c.phase || 0 }));
    if (type === 'phase') {
      for (const c of start) c.phase = 0;
      return start;
    }
    // repair：改 1–2 根柱子
    const idx = [];
    for (let i = 0; i < start.length; i++) idx.push(i);
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = idx[i]; idx[i] = idx[j]; idx[j] = t;
    }
    const n = Math.min(start.length, 1 + Math.floor(rng() * 2));
    for (let i = 0; i < n; i++) {
      const c = start[idx[i]];
      if (rng() < 0.6) {
        const dir = rng() < 0.5 ? -1 : 1;
        c.amp = clamp(c.amp + dir * rand(rng, 0.15, 0.3), 0.08, 0.95);
      } else {
        const dir = rng() < 0.5 ? -1 : 1;
        c.phase = (degOf(c) + dir * rand(rng, 60, 140)) * DEG;
      }
    }
    return start;
  }

  function makeInfo(fam, recipe, type) {
    const ks = recipe.map((c) => c.k).sort((a, b) => a - b);
    const maxK = Math.max.apply(null, ks.map((k) => Math.abs(k)));
    const n = recipe.length;
    const kList = ks.join('、');
    const text = type === 'repair'
      ? `这份频谱被改坏了 ${n > 2 ? '1–2' : '1'} 根柱子。对照目标，把错的幅度或相位修好。`
      : type === 'phase'
        ? '幅度已经对了，但相位被清零。把每个圆的起笔角调回去，让形状转回目标朝向。'
        : `目标用了 ${n} 个圆${n >= 8 ? '，细节很多' : ''}。先找主轮廓，再补细节。`;
    const hint = type === 'repair'
      ? `被改的是较小的柱子之一；对照目标谱的金色柱与行内目标值。`
      : type === 'phase'
        ? '相位决定朝向：幅度对了但形状歪了，就调相位。'
        : `目标有 ${n} 根柱子，最大 |k| = ${maxK}。看形状的瓣数与尖角猜高次项。`;
    return { text, hint, maxK, ks, kList, n };
  }

  function makeLevel(cfg) {
    const { section, chapter, index, rng, family, type, count, hintOn, thresholds, seedTag } = cfg;
    const fam = FAMILIES[family] || FAMILIES.random;
    let recipe = fitCount(fam.build(rng, { count }), rng, count, { ampStep: section === 'super' ? 0.1 : 0.05, degStep: section === 'super' ? 30 : 15 });
    if (section === 'super' && type === 'phase') {
      // 保证相位题有非零相位
      const allZero = recipe.every((c) => Math.abs(c.phase) < 1e-6);
      if (allZero) {
        const rot = 60 + Math.floor(rng() * 5) * 30;
        recipe = recipe.map((c) => ({ k: c.k, amp: c.amp, phase: (c.phase + rot * DEG) % (2 * Math.PI) }));
      }
    }
    const info = makeInfo(fam, recipe, type);
    const start = makeStart(recipe, rng, type, section === 'super');
    const id = (section === 'formal' ? 'f' : 's') + seedTag + '-' + chapter + '-' + String(index).padStart(2, '0');
    const no = (section === 'formal' ? 'F' : 'S') + chapter + '-' + String(index).padStart(2, '0');
    const note = type === 'repair'
      ? '修谱就是反解 cₖ：幅度看柱高，相位看形状的旋转。'
      : type === 'phase'
        ? '幅度决定大小，相位决定朝向；同一组幅度可以转出完全不同的形状。'
        : fam.note;
    return {
      id, section, chapter, index, no,
      title: '',
      family: family,
      kicker: (type === 'repair' ? '修谱 · ' : type === 'phase' ? '相位 · ' : '') + fam.kicker + ' · ' + info.n + ' 圆',
      type, recipe, start, budget: recipe.length,
      hintOn: hintOn, thresholds: thresholds.slice(),
      formula: fam.formula, note,
      text: info.text, hint: info.hint,
      maxK: info.maxK, ks: info.ks,
      difficulty: info.n * 10 + info.maxK + (hintOn ? 0 : 20) + (type === 'repair' ? 6 : type === 'phase' ? 4 : 0),
    };
  }

  function assignTitles(levels) {
    const used = new Set();
    for (const lv of levels) {
      const fam = FAMILIES[lv.family] || FAMILIES.random;
      let title = '';
      for (let guard = 0; guard < 80; guard++) {
        const adj = pick(mulberry32(hash(lv.id + ':' + guard)), ADJ);
        const noun = pick(mulberry32(hash(lv.id + 'n:' + guard)), fam.noun);
        title = adj + noun;
        if (!used.has(title)) break;
        title = adj + noun + '·' + lv.index;
      }
      used.add(title);
      lv.title = title;
    }
  }

  /* ------------------------- 关卡包 ------------------------- */
  const FORMAL_CHAPTERS = [
    { title: '花瓣与星轮', families: ['flower', 'star', 'wobble'], base: 3, step: 0.25 },
    { title: '偏移与对称', families: ['offset', 'symmetric', 'leaf'], base: 4, step: 0.3 },
    { title: '螺旋与高频', families: ['spiral', 'high', 'flower'], base: 5, step: 0.35 },
    { title: '修谱与相位', families: ['leaf', 'wobble', 'symmetric'], base: 5, step: 0.35 },
    { title: '密集频谱', families: ['dense', 'random', 'high'], base: 6, step: 0.4 },
    { title: '综合配方', families: ['dense', 'random', 'spiral'], base: 7, step: 0.4 },
  ];
  const SUPER_CHAPTERS = [
    { title: '盲配', families: ['flower', 'star', 'spiral'], base: 6, step: 0.45 },
    { title: '盲修', families: ['leaf', 'symmetric', 'wobble'], base: 7, step: 0.5 },
    { title: '混沌', families: ['dense', 'random', 'high'], base: 8, step: 0.5 },
  ];

  function buildWorkshopPack(seedStr) {
    const seed = seedStr || DEFAULT_SEED;
    const seedTag = hex8(hash(seed)).slice(0, 4);
    const formal = [];
    const superLv = [];
    for (let ch = 1; ch <= FORMAL_CHAPTERS.length; ch++) {
      const conf = FORMAL_CHAPTERS[ch - 1];
      for (let i = 1; i <= 10; i++) {
        const rng = rngOf(seed, 'formal', ch, i);
        const family = conf.families[(i - 1) % conf.families.length];
        let type = 'synth';
        if (ch === 4) type = i % 3 === 0 ? 'repair' : (i % 3 === 1 ? 'phase' : 'synth');
        else if (i === 9) type = 'repair';
        else if (i === 10) type = 'phase';
        const count = clamp(Math.round(conf.base + (i - 1) * conf.step), 3, 10);
        formal.push(makeLevel({
          section: 'formal', chapter: ch, index: i, rng, family, type, count,
          hintOn: true, thresholds: [0.015, 0.04, 0.08], seedTag,
        }));
      }
    }
    for (let ch = 1; ch <= SUPER_CHAPTERS.length; ch++) {
      const conf = SUPER_CHAPTERS[ch - 1];
      for (let i = 1; i <= 8; i++) {
        const rng = rngOf(seed, 'super', ch, i);
        const family = conf.families[(i - 1) % conf.families.length];
        let type = 'synth';
        if (ch === 2) type = i % 3 === 0 ? 'repair' : (i % 3 === 1 ? 'phase' : 'synth');
        else if (ch === 3) type = i <= 2 ? 'repair' : (i <= 4 ? 'phase' : 'synth');
        const count = clamp(Math.round(conf.base + (i - 1) * conf.step), 6, 12);
        superLv.push(makeLevel({
          section: 'super', chapter: ch, index: i, rng, family, type, count,
          hintOn: false, thresholds: [0.025, 0.06, 0.12], seedTag,
        }));
      }
    }
    assignTitles(formal);
    assignTitles(superLv);
    return { version: VERSION, seed, formal, super: superLv, chapters: { formal: FORMAL_CHAPTERS, super: SUPER_CHAPTERS } };
  }

  /* ------------------------- 每日一形 ------------------------- */
  function buildDaily(dateStr) {
    const date = String(dateStr || '');
    const rng = rngOf('harmonicbrush.daily.', date);
    const families = ['flower', 'star', 'spiral', 'leaf', 'offset', 'wobble', 'symmetric', 'dense', 'high', 'random'];
    const family = families[Math.floor(rng() * families.length)];
    const fam = FAMILIES[family];
    const count = 3 + Math.floor(rng() * 4);
    let recipe = fitCount(fam.build(rng, { count }), rng, count, { ampStep: 0.05, degStep: 15 });
    const tr = rng();
    const type = tr < 0.62 ? 'synth' : tr < 0.82 ? 'repair' : 'phase';
    if (type === 'phase') {
      const allZero = recipe.every((c) => Math.abs(c.phase) < 1e-6);
      if (allZero) {
        const rot = 30 + Math.floor(rng() * 9) * 30;
        recipe = recipe.map((c) => ({ k: c.k, amp: c.amp, phase: (c.phase + rot * DEG) % (2 * Math.PI) }));
      }
    }
    const info = makeInfo(fam, recipe, type);
    const start = makeStart(recipe, rng, type, false);
    const title = pick(rng, ADJ) + pick(rng, fam.noun);
    const note = type === 'repair'
      ? '修谱就是反解 cₖ：幅度看柱高，相位看形状的旋转。'
      : type === 'phase'
        ? '幅度决定大小，相位决定朝向；同一组幅度可以转出完全不同的形状。'
        : fam.note;
    const text = type === 'repair'
      ? '今天的配方有 1–2 根柱子被改坏了。目标谱已打开，对照修好。'
      : type === 'phase'
        ? '今天的相位被清零了。目标谱已打开，把每个圆的起笔角调回去。'
        : `今天的配方用了 ${info.n} 个圆。目标谱已打开：先读谱，再调配。`;
    return {
      id: 'daily-' + date,
      section: 'daily', chapter: 0, index: 0, no: 'D',
      title, family, kicker: '每日 · ' + fam.kicker + ' · ' + info.n + ' 圆',
      type, recipe, start, budget: recipe.length,
      hintOn: true, thresholds: [0.015, 0.04, 0.08],
      formula: fam.formula, note, text, hint: info.hint,
      maxK: info.maxK, difficulty: info.n * 10 + info.maxK,
      date,
    };
  }

  /* ------------------------- 读谱题生成 ------------------------- */
  function distractorRecipes(target, rng, n) {
    const out = [];
    const base = target.map((c) => ({ k: c.k, amp: c.amp, phase: 0 }));
    const sig = (r) => r.map((c) => c.k + ':' + c.amp.toFixed(2)).sort().join('|');
    const used = new Set([sig(base)]);
    let guard = 0;
    while (out.length < n && guard++ < 100) {
      const r = base.map((c) => ({ k: c.k, amp: c.amp, phase: 0 }));
      const ranked = r.slice().sort((a, b) => b.amp - a.amp);
      const mode = Math.floor(rng() * 3);
      if (mode === 0) {
        // 移动一根“有存在感”的柱子：瓣数/鼓包数会明显改变
        const c = ranked[Math.floor(rng() * Math.min(3, ranked.length))];
        const dir = rng() < 0.5 ? -1 : 1;
        let nk = c.k + dir;
        if (!nk || Math.abs(nk) > KMAX || r.some((x) => x.k === nk)) nk = c.k - dir;
        if (!nk || Math.abs(nk) > KMAX || r.some((x) => x.k === nk)) continue;
        c.k = nk;
      } else if (mode === 1) {
        // 改一根大柱的高度：形状的“胖瘦/偏向”会变
        const c = ranked[Math.floor(rng() * Math.min(2, ranked.length))];
        const baseAmp = base.find((x) => x.k === c.k).amp;
        c.amp = clamp(q(baseAmp * (rng() < 0.5 ? 0.55 : 1.7), 0.05), 0.1, 1);
        if (Math.abs(c.amp - baseAmp) < 0.05) continue;
      } else {
        // 拿掉一根非主轮廓的柱子：细节消失
        if (r.length <= 2) continue;
        const removable = ranked.filter((c) => Math.abs(c.k) !== 1);
        if (!removable.length) continue;
        const c = removable[0];
        r.splice(r.findIndex((x) => x.k === c.k), 1);
      }
      const s = sig(r);
      if (used.has(s)) continue;
      used.add(s);
      out.push(r);
    }
    return out;
  }

  function recipeText(recipe) {
    const ks = recipe.filter((c) => c.k !== 0).map((c) => c.k).sort((a, b) => a - b);
    const ds = recipe.filter((c) => c.k === 0).length ? ' + DC' : '';
    return 'k = ' + ks.join('、') + ds;
  }

  function makeReading(cfg) {
    const { type, recipe, rng, index, seedTag } = cfg;
    const sig = (r) => r.map((c) => c.k + ':' + c.amp.toFixed(2)).sort().join('|');
    const target = recipe.map((c) => ({ k: c.k, amp: c.amp, phase: 0 }));
    const n = target.length;
    const ks = target.filter((c) => c.k !== 0).map((c) => c.k).sort((a, b) => a - b);
    const id = 'gr' + seedTag + '-' + String(index).padStart(2, '0');
    let title = '';
    let options = [];
    let answer = 0;
    let explain = '';
    let shown = target;
    let targetRecipe = target;
    if (type === 'shape' || type === 'match') {
      const ds = distractorRecipes(target, rng, 3);
      options = [target].concat(ds);
      for (let i = options.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        const t = options[i]; options[i] = options[j]; options[j] = t;
      }
      answer = options.findIndex((o) => sig(o) === sig(target));
      title = type === 'shape'
        ? pick(rng, ['柱子的含义', '读谱选形', '频谱翻译', '哪一个是它', '柱高与轮廓', '频谱指纹'])
        : pick(rng, ['看形选谱', '形状的配料表', '反查频谱', '这条曲线吃什么', '从形到谱', '谱线对照']);
      explain = `目标谱的柱子出现在 ${recipeText(target)}。${ks.length >= 3 ? '柱子越多、越靠右，形状的细节越密。' : '柱子的位置决定鼓包数，高度决定影响大小。'}`;
    } else if (type === 'missing') {
      const removable = target.filter((c) => c.k !== 0);
      const miss = pick(rng, removable);
      shown = target.filter((c) => c.k !== miss.k);
      targetRecipe = target;
      const pool = [];
      for (let k = 1; k <= 10; k++) {
        if (!shown.some((c) => Math.abs(c.k) === k)) { pool.push(k); pool.push(-k); }
      }
      const opts = [miss.k];
      let guard = 0;
      while (opts.length < 4 && guard++ < 50) {
        const k = pick(rng, pool);
        if (!opts.includes(k)) opts.push(k);
      }
      options = opts;
      answer = miss.k;
      title = pick(rng, ['少了一根柱子', '缺了哪个谐波', '频谱的缺口', '被拿掉的圆', '找缺失', '消失的频率']);
      explain = `少了 k=${miss.k} 的圆。它在完整频谱里对应一根高 ${miss.amp.toFixed(2)} 的柱子。`;
    } else {
      options = [];
      const base = target.filter((c) => c.k !== 0).length;
      const cand = [base - 1, base, base + 1, base + 2].filter((v) => v > 0);
      for (let i = cand.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        const t = cand[i]; cand[i] = cand[j]; cand[j] = t;
      }
      options = cand.slice(0, 4);
      if (!options.includes(base)) options[0] = base;
      answer = base;
      title = pick(rng, ['数一数', '需要几个圆', '柱子的数量', '圆的预算', '数柱子', '配器数量']);
      explain = `非零柱子有 ${base} 根，所以需要 ${base} 个圆；k=0 的那根只是平移，不算轮廓圆。`;
    }
    return {
      id, type, title, recipe: shown, targetRecipe,
      options, answer, explain,
      family: cfg.family || '', index,
    };
  }

  function buildReadingPack(seedStr) {
    const seed = seedStr || DEFAULT_SEED;
    const seedTag = hex8(hash(seed + ':read')).slice(0, 4);
    const types = ['shape', 'shape', 'match', 'count', 'shape', 'missing', 'match', 'shape', 'count', 'missing', 'match', 'shape', 'missing', 'count', 'match', 'shape'];
    const fams = ['star', 'flower', 'high', 'star', 'flower', 'high', 'star', 'dense', 'flower', 'high', 'star', 'flower', 'high', 'star', 'flower', 'dense'];
    const out = [];
    for (let i = 0; i < types.length; i++) {
      const rng = rngOf(seed, 'read', i);
      const fam = FAMILIES[fams[i % fams.length]];
      const count = 2 + Math.floor(rng() * 3);
      let recipe = fitCount(fam.build(rng, { count: count + 1 }), rng, Math.max(3, count + 1), { ampStep: 0.05, degStep: 15 });
      recipe = recipe.map((c) => ({ k: c.k, amp: c.amp, phase: 0 }));
      // 读谱题不要 DC（柱状图只显示频率），但可以保留负频率
      recipe = recipe.filter((c) => c.k !== 0);
      if (recipe.length < 2) continue;
      out.push(makeReading({ type: types[i], recipe, rng, index: out.length + 1, seedTag, family: fam.id }));
    }
    return out;
  }

  /* ------------------------- 读谱题并入数据 ------------------------- */
  let _workshopPack = null;
  let _readingPack = null;
  function getWorkshopPack() {
    if (!_workshopPack) _workshopPack = buildWorkshopPack(currentSeed());
    return _workshopPack;
  }
  function getReadingPack() {
    if (!_readingPack) _readingPack = buildReadingPack(currentSeed());
    return _readingPack;
  }
  if (HP.data && HP.data.READINGS) {
    try {
      const gen = getReadingPack();
      const existing = new Set(HP.data.READINGS.map((r) => r.id));
      for (const r of gen) if (!existing.has(r.id)) HP.data.READINGS.push(r);
    } catch (e) { /* noop */ }
  }

  HP.generator = {
    VERSION, DEFAULT_SEED, SEED_KEY, KMAX, FAMILIES, FAMILY_ORDER, ADJ,
    currentSeed, buildWorkshopPack, buildReadingPack, buildDaily,
    getWorkshopPack, getReadingPack,
    FORMAL_CHAPTERS, SUPER_CHAPTERS, recipeText, hex8, hash,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
