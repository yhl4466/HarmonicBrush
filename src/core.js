/* =========================================================
 * 谐波画笔 · 数学核心 core.js
 * 傅里叶分解 / 弧长重采样 / 形状对齐 / 误差度量 / 轮廓提取
 * 该文件同时运行于浏览器（window.HP）与 Node（global.HP）
 * ========================================================= */
(function (global) {
  'use strict';
  const HP = (global.HP = global.HP || {});
  const TAU = Math.PI * 2;
  const SAMPLE_N = 1024; // 参与 DFT 的采样点数（支持 500 圆上限）
  const CMP_N = 512;     // 误差比较时的弧长采样点数

  /* ------------------------- 基础工具 ------------------------- */
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const isNum = (v) => typeof v === 'number' && isFinite(v);
  const hypot = Math.hypot;

  function hashString(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(a) {
    a = a >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function formatPct(v, d = 1) {
    if (!isNum(v)) return '—';
    return (v * 100).toFixed(d) + '%';
  }

  function formatTime(ms) {
    const s = Math.max(0, ms / 1000);
    return s.toFixed(1) + 's';
  }

  function formatClock(sec) {
    const s = Math.max(0, Math.ceil(sec));
    const m = Math.floor(s / 60);
    return m + ':' + String(s % 60).padStart(2, '0');
  }

  /* ------------------------- 折线几何 ------------------------- */
  function toPoints(arr) {
    // 接受 [[x,y],...] 或 [{x,y},...]，统一为 {x,y}
    if (!arr || !arr.length) return [];
    if (Array.isArray(arr[0])) return arr.map((p) => ({ x: p[0], y: p[1] }));
    return arr.map((p) => ({ x: p.x, y: p.y }));
  }

  function dedupe(points, eps = 1e-9) {
    const out = [];
    for (const p of points) {
      const q = out[out.length - 1];
      if (!q || hypot(p.x - q.x, p.y - q.y) > eps) out.push({ x: p.x, y: p.y });
    }
    // 去掉与首点重合的尾点
    while (out.length > 1) {
      const a = out[0], b = out[out.length - 1];
      if (hypot(a.x - b.x, a.y - b.y) <= eps) out.pop();
      else break;
    }
    return out;
  }

  function pathLength(points, closed = true) {
    if (!points || points.length < 2) return 0;
    let L = 0;
    for (let i = 1; i < points.length; i++) L += hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    if (closed) L += hypot(points[0].x - points[points.length - 1].x, points[0].y - points[points.length - 1].y);
    return L;
  }

  function polyArea(points) {
    let a = 0;
    const n = points.length;
    for (let i = 0; i < n; i++) {
      const p = points[i], q = points[(i + 1) % n];
      a += p.x * q.y - q.x * p.y;
    }
    return a / 2;
  }

  function centroid(points) {
    let x = 0, y = 0;
    for (const p of points) { x += p.x; y += p.y; }
    const n = points.length || 1;
    return { x: x / n, y: y / n };
  }

  function rmsRadius(points) {
    const c = centroid(points);
    let s = 0;
    for (const p of points) s += (p.x - c.x) ** 2 + (p.y - c.y) ** 2;
    return Math.sqrt(s / (points.length || 1));
  }

  function bbox(points) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
  }

  /** 按弧长均匀重采样闭合折线，返回 n 个点（不含重复首点） */
  function resampleClosed(points, n) {
    const pts = dedupe(toPoints(points));
    if (pts.length < 2 || n < 2) return pts.slice();
    const m = pts.length;
    const cum = new Float64Array(m + 1);
    for (let i = 0; i < m; i++) {
      const a = pts[i], b = pts[(i + 1) % m];
      cum[i + 1] = cum[i] + hypot(b.x - a.x, b.y - a.y);
    }
    const total = cum[m];
    if (total < 1e-12) return new Array(n).fill(0).map(() => ({ x: pts[0].x, y: pts[0].y }));
    const out = new Array(n);
    let seg = 0;
    for (let i = 0; i < n; i++) {
      const target = (total * i) / n;
      while (seg < m - 1 && cum[seg + 1] < target) seg++;
      const segLen = cum[seg + 1] - cum[seg];
      const t = segLen > 1e-12 ? (target - cum[seg]) / segLen : 0;
      const a = pts[seg], b = pts[(seg + 1) % m];
      out[i] = { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
    }
    return out;
  }

  function pointSegDist(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const l2 = dx * dx + dy * dy;
    let t = l2 > 1e-12 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2 : 0;
    t = clamp(t, 0, 1);
    return hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
  }

  /** 求点到闭合折线的最近点 */
  function nearestOnPolyline(points, p) {
    let best = { dist: Infinity, x: p.x, y: p.y, index: -1, t: 0 };
    const n = points.length;
    for (let i = 0; i < n; i++) {
      const a = points[i], b = points[(i + 1) % n];
      const dx = b.x - a.x, dy = b.y - a.y;
      const l2 = dx * dx + dy * dy;
      let t = l2 > 1e-12 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2 : 0;
      t = clamp(t, 0, 1);
      const px = a.x + t * dx, py = a.y + t * dy;
      const d = hypot(p.x - px, p.y - py);
      if (d < best.dist) best = { dist: d, x: px, y: py, index: i, t };
    }
    return best;
  }

  /** 归一化：平移到质心、缩放到 RMS 半径 = 1 */
  function normalizeShape(points) {
    const pts = toPoints(points);
    if (pts.length < 3) return null;
    const c = centroid(pts);
    let s = 0;
    for (const p of pts) s += (p.x - c.x) ** 2 + (p.y - c.y) ** 2;
    const rms = Math.sqrt(s / pts.length);
    if (!(rms > 1e-9)) return null;
    return pts.map((p) => ({ x: (p.x - c.x) / rms, y: (p.y - c.y) / rms }));
  }

  /** 平移到包围盒中心并缩放到 [-half, half]²（保持长宽比） */
  function fitShape(points, half = 1) {
    const pts = toPoints(points);
    if (!pts.length) return pts;
    const bb = bbox(pts);
    const span = Math.max(bb.w, bb.h) || 1;
    const s = (2 * half) / span;
    return pts.map((p) => ({ x: (p.x - bb.cx) * s, y: (p.y - bb.cy) * s }));
  }

  function ensureCCW(points) {
    return polyArea(points) < 0 ? points.slice().reverse() : points;
  }

  /* ------------------------- 平滑与简化 ------------------------- */
  function smoothClosed(points, iterations = 2, weight = 0.5) {
    let pts = points.slice();
    for (let it = 0; it < iterations; it++) {
      const n = pts.length;
      const out = new Array(n);
      for (let i = 0; i < n; i++) {
        const a = pts[(i - 1 + n) % n], b = pts[i], c = pts[(i + 1) % n];
        out[i] = {
          x: lerp(b.x, (a.x + c.x) / 2, weight),
          y: lerp(b.y, (a.y + c.y) / 2, weight),
        };
      }
      pts = out;
    }
    return pts;
  }

  function catmullRomClosed(ctrl, perSeg = 12) {
    const pts = toPoints(ctrl);
    const n = pts.length;
    if (n < 3) return pts.slice();
    const out = [];
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      for (let k = 0; k < perSeg; k++) {
        const t = k / perSeg, t2 = t * t, t3 = t2 * t;
        out.push({
          x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
          y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
        });
      }
    }
    return out;
  }

  /** 闭合折线的 Douglas-Peucker 简化 */
  function simplifyClosed(points, eps) {
    const pts = dedupe(toPoints(points));
    const n = pts.length;
    if (n < 6) return pts.slice();
    const c = centroid(pts);
    let bi = 0, bd = -1;
    for (let i = 0; i < n; i++) {
      const d = (pts[i].x - c.x) ** 2 + (pts[i].y - c.y) ** 2;
      if (d > bd) { bd = d; bi = i; }
    }
    const rot = pts.slice(bi).concat(pts.slice(0, bi));
    const keep = new Uint8Array(n);
    keep[0] = 1; keep[n - 1] = 1;
    const stack = [[0, n - 1]];
    while (stack.length) {
      const [a, b] = stack.pop();
      let maxD = -1, idx = -1;
      for (let i = a + 1; i < b; i++) {
        const d = pointSegDist(rot[i], rot[a], rot[b]);
        if (d > maxD) { maxD = d; idx = i; }
      }
      if (maxD > eps && idx > 0) {
        keep[idx] = 1;
        stack.push([a, idx], [idx, b]);
      }
    }
    const out = [];
    for (let i = 0; i < n; i++) if (keep[i]) out.push(rot[i]);
    return out.length >= 3 ? out : pts.slice();
  }

  /* ------------------------- FFT ------------------------- */
  const fftPlans = new Map();
  function getPlan(n) {
    if (fftPlans.has(n)) return fftPlans.get(n);
    let bits = 0;
    while ((1 << bits) < n) bits++;
    const rev = new Uint32Array(n);
    for (let i = 0; i < n; i++) {
      let r = 0;
      for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
      rev[i] = r;
    }
    const cos = new Float64Array(n / 2), sin = new Float64Array(n / 2);
    for (let i = 0; i < n / 2; i++) {
      cos[i] = Math.cos((TAU * i) / n);
      sin[i] = Math.sin((TAU * i) / n);
    }
    const plan = { n, rev, cos, sin };
    fftPlans.set(n, plan);
    return plan;
  }

  /** 原地基数-2 FFT；inverse=true 时含 1/n 归一化 */
  function fft(re, im, inverse) {
    const n = re.length;
    if (n <= 1) return;
    const plan = getPlan(n);
    for (let i = 0; i < n; i++) {
      const j = plan.rev[i];
      if (j > i) {
        let t = re[i]; re[i] = re[j]; re[j] = t;
        t = im[i]; im[i] = im[j]; im[j] = t;
      }
    }
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1;
      const step = n / size;
      for (let i = 0; i < n; i += size) {
        for (let j = 0; j < half; j++) {
          const k = j * step;
          const wr = plan.cos[k];
          const wi = inverse ? plan.sin[k] : -plan.sin[k];
          const a = i + j, b = a + half;
          const xr = re[b] * wr - im[b] * wi;
          const xi = re[b] * wi + im[b] * wr;
          re[b] = re[a] - xr; im[b] = im[a] - xi;
          re[a] += xr; im[a] += xi;
        }
      }
    }
    if (inverse) {
      for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
    }
  }

  /* ------------------------- 傅里叶分析 ------------------------- */
  /**
   * 对闭合路径做离散傅里叶分解。
   * 返回 { N, samples, kOf, re, im, mag, list, ranked, ... }
   * c_k = (1/N) Σ p_n e^{-2πikn/N}，k ∈ [-N/2, N/2)
   */
  function analyse(points, N = SAMPLE_N) {
    const samples = resampleClosed(points, N);
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let i = 0; i < N; i++) { re[i] = samples[i].x; im[i] = samples[i].y; }
    fft(re, im, false);
    const kOf = new Int32Array(N);
    const cRe = new Float64Array(N), cIm = new Float64Array(N), mag = new Float64Array(N);
    for (let idx = 0; idx < N; idx++) {
      const k = idx < N / 2 ? idx : idx - N;
      kOf[idx] = k;
      cRe[idx] = re[idx] / N;
      cIm[idx] = im[idx] / N;
      mag[idx] = Math.hypot(cRe[idx], cIm[idx]);
    }
    const order = new Array(N);
    for (let i = 0; i < N; i++) order[i] = i;
    order.sort((a, b) => mag[b] - mag[a]);
    const list = new Array(N);
    for (let idx = 0; idx < N; idx++) {
      list[idx] = {
        idx,
        k: kOf[idx],
        re: cRe[idx],
        im: cIm[idx],
        mag: mag[idx],
        phase: Math.atan2(cIm[idx], cRe[idx]),
      };
    }
    return {
      N, samples, kOf, cRe, cIm, mag, list, ranked: order,
      points: samples,
      length: pathLength(samples),
      centroid: centroid(samples),
      bbox: bbox(samples),
      area: polyArea(samples),
    };
  }

  function topIndices(ana, k) {
    const n = clamp(Math.round(k), 0, ana.N);
    return ana.ranked.slice(0, n);
  }

  /**
   * 由选中的系数重建轨迹。
   * M 采样点，返回 Float64Array（x0,y0,x1,y1...）
   */
  function reconstruct(ana, indices, M = 1024) {
    const out = new Float64Array(M * 2);
    for (let s = 0; s < indices.length; s++) {
      const idx = indices[s];
      const k = ana.kOf[idx];
      const cr = ana.cRe[idx], ci = ana.cIm[idx];
      if (cr === 0 && ci === 0) continue;
      const step = (TAU * k) / M;
      const sr = Math.cos(step), si = Math.sin(step);
      let wr = 1, wi = 0;
      for (let m = 0; m < M; m++) {
        out[2 * m] += cr * wr - ci * wi;
        out[2 * m + 1] += cr * wi + ci * wr;
        const nwr = wr * sr - wi * si;
        wi = wr * si + wi * sr;
        wr = nwr;
      }
    }
    return out;
  }

  function reconPoints(flat, M) {
    const out = new Array(M);
    for (let m = 0; m < M; m++) out[m] = { x: flat[2 * m], y: flat[2 * m + 1] };
    return out;
  }

  /* ------------------------- 形状对齐与误差 ------------------------- */
  function complexFFT(pts) {
    const n = pts.length;
    const re = new Float64Array(n), im = new Float64Array(n);
    for (let i = 0; i < n; i++) { re[i] = pts[i].x; im[i] = pts[i].y; }
    fft(re, im, false);
    return { re, im };
  }

  /* -------- 线段网格：用于曲线间最近距离（Chamfer 距离） -------- */
  function buildSegmentGrid(points) {
    const n = points.length;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    let L = 0;
    for (let i = 0; i < n; i++) {
      const a = points[i], b = points[(i + 1) % n];
      L += hypot(b.x - a.x, b.y - a.y);
    }
    const mean = L / Math.max(1, n);
    const cell = Math.max(mean * 2.5, 1e-5);
    minX -= cell; minY -= cell;
    const cols = Math.max(1, Math.ceil((maxX - minX) / cell) + 1);
    const rows = Math.max(1, Math.ceil((maxY - minY) / cell) + 1);
    const buckets = new Array(cols * rows);
    for (let i = 0; i < n; i++) {
      const a = points[i], b = points[(i + 1) % n];
      const i0 = clamp(Math.floor((Math.min(a.x, b.x) - minX) / cell), 0, cols - 1);
      const i1 = clamp(Math.floor((Math.max(a.x, b.x) - minX) / cell), 0, cols - 1);
      const j0 = clamp(Math.floor((Math.min(a.y, b.y) - minY) / cell), 0, rows - 1);
      const j1 = clamp(Math.floor((Math.max(a.y, b.y) - minY) / cell), 0, rows - 1);
      for (let j = j0; j <= j1; j++) {
        for (let i2 = i0; i2 <= i1; i2++) {
          const k = j * cols + i2;
          let arr = buckets[k];
          if (!arr) { arr = []; buckets[k] = arr; }
          arr.push(i);
        }
      }
    }
    return { points, n, cell, minX, minY, cols, rows, buckets };
  }

  function nearestSegDist(grid, px, py) {
    const { points, n, cell, minX, minY, cols, rows, buckets } = grid;
    let best = Infinity;
    let ci = clamp(Math.floor((px - minX) / cell), -2, cols + 1);
    let cj = clamp(Math.floor((py - minY) / cell), -2, rows + 1);
    const maxR = Math.max(cols, rows) + 1;
    for (let r = 0; r <= maxR; r++) {
      if (best <= (r - 1) * cell) break;
      const i0 = ci - r, i1 = ci + r, j0 = cj - r, j1 = cj + r;
      for (let j = Math.max(0, j0); j <= Math.min(rows - 1, j1); j++) {
        for (let i = Math.max(0, i0); i <= Math.min(cols - 1, i1); i++) {
          if (r > 0 && Math.abs(i - ci) < r && Math.abs(j - cj) < r) continue;
          const arr = buckets[j * cols + i];
          if (!arr) continue;
          for (let s = 0; s < arr.length; s++) {
            const si = arr[s];
            const a = points[si], b = points[(si + 1) % n];
            const dx = b.x - a.x, dy = b.y - a.y;
            const l2 = dx * dx + dy * dy;
            let t = l2 > 1e-12 ? ((px - a.x) * dx + (py - a.y) * dy) / l2 : 0;
            t = clamp(t, 0, 1);
            const d = hypot(px - (a.x + t * dx), py - (a.y + t * dy));
            if (d < best) best = d;
          }
        }
      }
    }
    if (best === Infinity) {
      // 兜底：全量扫描
      for (let i = 0; i < n; i++) {
        const d = pointSegDist({ x: px, y: py }, points[i], points[(i + 1) % n]);
        if (d < best) best = d;
      }
    }
    return best;
  }

  /** 预计算目标形状（归一化点集 + 线段网格），用于快速比较 */
  function prepareTarget(points) {
    const pts = dedupe(toPoints(points));
    const cmp = resampleClosed(pts, CMP_N);
    const norm = normalizeShape(cmp);
    if (!norm) throw new Error('目标图形退化');
    const ana = analyse(pts, SAMPLE_N);
    return {
      points: pts,
      cmp,
      norm,
      grid: buildSegmentGrid(norm),
      ana,
      bbox: bbox(pts),
      length: pathLength(pts),
      area: polyArea(pts),
      rms: rmsRadius(cmp),
    };
  }

  /**
   * 双向 RMS 形状距离（参数无关）：先把两条曲线归一化到同一尺度，
   * 再计算彼此最近点距离的均方根。对起点、方向、平移、缩放均不敏感。
   */
  function errorAgainstPrepared(prep, reconPts) {
    const pts = dedupe(toPoints(reconPts));
    if (pts.length < 4) return 2;
    const cmp = resampleClosed(pts, CMP_N);
    const norm = normalizeShape(cmp);
    if (!norm) return 2;
    const gridA = buildSegmentGrid(norm);
    let s1 = 0;
    for (let i = 0; i < CMP_N; i++) {
      const d = nearestSegDist(prep.grid, norm[i].x, norm[i].y);
      s1 += d * d;
    }
    let s2 = 0;
    const b = prep.norm;
    for (let i = 0; i < CMP_N; i++) {
      const d = nearestSegDist(gridA, b[i].x, b[i].y);
      s2 += d * d;
    }
    return Math.sqrt((s1 + s2) / (2 * CMP_N));
  }

  function errorOfReconstruction(prep, ana, indices, M = 1024) {
    const flat = reconstruct(ana, indices, M);
    return errorAgainstPrepared(prep, reconPoints(flat, M));
  }

  /** 目标自身在 K 个最大系数下的误差（截断误差地板） */
  function floorError(prep, k, M = 1024) {
    const indices = topIndices(prep.ana, k);
    return errorOfReconstruction(prep, prep.ana, indices, M);
  }

  /** 找到使目标截断误差 ≤ tol 的最小圆数 */
  function requiredK(prep, tol, maxK = 500) {
    let lo = 1, hi = Math.min(maxK, prep.ana.N);
    if (floorError(prep, hi) > tol) return null;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (floorError(prep, mid) <= tol) hi = mid;
      else lo = mid + 1;
    }
    return lo;
  }

  /**
   * 参数无关的几何距离（不做平移/旋转/缩放归一化）：
   * 两条曲线各自到对方最近点的双向 RMS。用于工坊——形状相似但起笔/方向不同时仍接近 0，
   * 而平移（DC）、朝向（相位）、大小（幅度）不对时会被正确惩罚。
   */
  function curveDistance(aPts, bPts, n = 512) {
    const a = resampleClosed(dedupe(toPoints(aPts)), n);
    const b = resampleClosed(dedupe(toPoints(bPts)), n);
    if (a.length < 4 || b.length < 4) return 2;
    const ga = buildSegmentGrid(a);
    const gb = buildSegmentGrid(b);
    let s = 0;
    for (let i = 0; i < n; i++) {
      const d = nearestSegDist(gb, a[i].x, a[i].y);
      s += d * d;
    }
    for (let i = 0; i < n; i++) {
      const d = nearestSegDist(ga, b[i].x, b[i].y);
      s += d * d;
    }
    return Math.sqrt(s / (2 * n));
  }

  function starFor(error, used, budget) {
    if (!isNum(error)) return 0;
    if (error <= 0.02 && used <= budget) return 3;
    if (error <= 0.05) return 2;
    if (error <= 0.10) return 1;
    return 0;
  }

  /* ------------------------- 距离场轮廓提取 ------------------------- */
  /**
   * 由基本图元并集提取单条闭合轮廓（Marching Squares）。
   * prims: [{type:'seg',x1,y1,x2,y2,r} | {type:'disk',x,y,r}]
   */
  function outlineFromPrimitives(prims, opts = {}) {
    const res = opts.res || 340;
    const margin = opts.margin == null ? 0.12 : opts.margin;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const grow = (x, y) => {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    };
    for (const p of prims) {
      if (p.type === 'disk') {
        grow(p.x - p.r, p.y - p.r); grow(p.x + p.r, p.y + p.r);
      } else if (p.type === 'ellipse') {
        const R = Math.max(p.rx, p.ry);
        grow(p.x - R, p.y - R); grow(p.x + R, p.y + R);
      } else {
        grow(Math.min(p.x1, p.x2) - p.r, Math.min(p.y1, p.y2) - p.r);
        grow(Math.max(p.x1, p.x2) + p.r, Math.max(p.y1, p.y2) + p.r);
      }
    }
    minX -= margin; maxX += margin; minY -= margin; maxY += margin;
    const span = Math.max(maxX - minX, maxY - minY);
    const cell = span / res;
    const W = Math.ceil((maxX - minX) / cell) + 1;
    const H = Math.ceil((maxY - minY) / cell) + 1;
    const f = new Float64Array(W * H).fill(1e9);

    // 逐图元只更新其包围盒内的网格
    for (const p of prims) {
      const r = p.r;
      let bx0, bx1, by0, by1;
      if (p.type === 'disk') {
        bx0 = p.x - r; bx1 = p.x + r; by0 = p.y - r; by1 = p.y + r;
      } else if (p.type === 'ellipse') {
        const R = Math.max(p.rx, p.ry);
        bx0 = p.x - R; bx1 = p.x + R; by0 = p.y - R; by1 = p.y + R;
      } else {
        bx0 = Math.min(p.x1, p.x2) - r; bx1 = Math.max(p.x1, p.x2) + r;
        by0 = Math.min(p.y1, p.y2) - r; by1 = Math.max(p.y1, p.y2) + r;
      }
      const i0 = Math.max(0, Math.floor((bx0 - minX) / cell));
      const i1 = Math.min(W - 1, Math.ceil((bx1 - minX) / cell));
      const j0 = Math.max(0, Math.floor((by0 - minY) / cell));
      const j1 = Math.min(H - 1, Math.ceil((by1 - minY) / cell));
      if (p.type === 'disk') {
        for (let j = j0; j <= j1; j++) {
          const y = minY + j * cell;
          const row = j * W;
          for (let i = i0; i <= i1; i++) {
            const x = minX + i * cell;
            const d = hypot(x - p.x, y - p.y) - r;
            if (d < f[row + i]) f[row + i] = d;
          }
        }
      } else if (p.type === 'ellipse') {
        const c = Math.cos(p.rot || 0), s = Math.sin(p.rot || 0);
        const k = Math.min(p.rx, p.ry);
        for (let j = j0; j <= j1; j++) {
          const y = minY + j * cell;
          const row = j * W;
          for (let i = i0; i <= i1; i++) {
            const x = minX + i * cell;
            const dx = x - p.x, dy = y - p.y;
            const u = (dx * c + dy * s) / p.rx;
            const v = (-dx * s + dy * c) / p.ry;
            const d = (Math.hypot(u, v) - 1) * k;
            if (d < f[row + i]) f[row + i] = d;
          }
        }
      } else {
        const dx = p.x2 - p.x1, dy = p.y2 - p.y1;
        const l2 = dx * dx + dy * dy || 1e-12;
        for (let j = j0; j <= j1; j++) {
          const y = minY + j * cell;
          const row = j * W;
          for (let i = i0; i <= i1; i++) {
            const x = minX + i * cell;
            let t = ((x - p.x1) * dx + (y - p.y1) * dy) / l2;
            t = clamp(t, 0, 1);
            const d = hypot(x - (p.x1 + t * dx), y - (p.y1 + t * dy)) - r;
            if (d < f[row + i]) f[row + i] = d;
          }
        }
      }
    }

    const loops = extractLoops(f, W, H, minX, minY, cell);
    if (!loops.length) throw new Error('轮廓提取失败');
    let best = loops[0], bestArea = 0;
    for (const loop of loops) {
      const a = Math.abs(polyArea(loop));
      if (a > bestArea) { bestArea = a; best = loop; }
    }
    let pts = resampleClosed(best, 2048);
    pts = smoothClosed(pts, opts.smooth == null ? 2 : opts.smooth, 0.5);
    pts = resampleClosed(pts, 1024);
    if (opts.fit !== false) pts = fitShape(pts, 1);
    return pts;
  }

  function extractLoops(f, W, H, minX, minY, cell) {
    const edgeCache = new Map();
    function edgePoint(type, i, j) {
      const key = type + ':' + j + ',' + i;
      const hit = edgeCache.get(key);
      if (hit) return hit;
      let x, y;
      if (type === 'h') {
        const a = f[j * W + i], b = f[j * W + i + 1];
        let t = a / (a - b);
        if (!isFinite(t)) t = 0.5;
        t = clamp(t, 0, 1);
        x = minX + (i + t) * cell; y = minY + j * cell;
      } else {
        const a = f[j * W + i], b = f[(j + 1) * W + i];
        let t = a / (a - b);
        if (!isFinite(t)) t = 0.5;
        t = clamp(t, 0, 1);
        x = minX + i * cell; y = minY + (j + t) * cell;
      }
      const pt = { x, y, key };
      edgeCache.set(key, pt);
      return pt;
    }

    const segs = [];
    const addSeg = (p1, p2) => segs.push({ a: p1, b: p2 });

    for (let j = 0; j < H - 1; j++) {
      for (let i = 0; i < W - 1; i++) {
        const f00 = f[j * W + i], f10 = f[j * W + i + 1];
        const f11 = f[(j + 1) * W + i + 1], f01 = f[(j + 1) * W + i];
        let ci = 0;
        if (f00 < 0) ci |= 1;
        if (f10 < 0) ci |= 2;
        if (f11 < 0) ci |= 4;
        if (f01 < 0) ci |= 8;
        if (ci === 0 || ci === 15) continue;
        const A = () => edgePoint('h', i, j);
        const B = () => edgePoint('v', i + 1, j);
        const C = () => edgePoint('h', i, j + 1);
        const D = () => edgePoint('v', i, j);
        const center = (f00 + f10 + f11 + f01) / 4;
        switch (ci) {
          case 1: addSeg(D(), A()); break;
          case 2: addSeg(A(), B()); break;
          case 3: addSeg(D(), B()); break;
          case 4: addSeg(B(), C()); break;
          case 5:
            if (center < 0) { addSeg(A(), B()); addSeg(C(), D()); }
            else { addSeg(D(), A()); addSeg(B(), C()); }
            break;
          case 6: addSeg(A(), C()); break;
          case 7: addSeg(C(), D()); break;
          case 8: addSeg(C(), D()); break;
          case 9: addSeg(C(), A()); break;
          case 10:
            if (center < 0) { addSeg(A(), D()); addSeg(B(), C()); }
            else { addSeg(A(), B()); addSeg(C(), D()); }
            break;
          case 11: addSeg(B(), C()); break;
          case 12: addSeg(B(), D()); break;
          case 13: addSeg(B(), A()); break;
          case 14: addSeg(A(), D()); break;
          default: break;
        }
      }
    }
    if (!segs.length) return [];

    const adj = new Map();
    for (let s = 0; s < segs.length; s++) {
      for (const key of [segs[s].a.key, segs[s].b.key]) {
        let arr = adj.get(key);
        if (!arr) { arr = []; adj.set(key, arr); }
        arr.push(s);
      }
    }
    const visited = new Uint8Array(segs.length);
    const loops = [];
    for (let s = 0; s < segs.length; s++) {
      if (visited[s]) continue;
      visited[s] = 1;
      const loop = [];
      let startKey = segs[s].a.key;
      let cur = segs[s];
      let key = startKey;
      const first = cur;
      loop.push({ x: cur.a.x, y: cur.a.y });
      let guard = 0;
      while (guard++ < segs.length + 8) {
        const to = cur.a.key === key ? cur.b : cur.a;
        loop.push({ x: to.x, y: to.y });
        key = to.key;
        if (key === startKey) break;
        let next = -1;
        const cands = adj.get(key) || [];
        for (const c of cands) if (!visited[c]) { next = c; break; }
        if (next < 0) break;
        visited[next] = 1;
        cur = segs[next];
      }
      if (loop.length >= 6) loops.push(loop);
    }
    return loops;
  }

  /* ------------------------- 采样辅助 ------------------------- */
  function ellipsePoints(cx, cy, rx, ry, rot = 0, n = 720) {
    const out = [];
    const c = Math.cos(rot), s = Math.sin(rot);
    for (let i = 0; i < n; i++) {
      const a = (TAU * i) / n;
      const x = rx * Math.cos(a), y = ry * Math.sin(a);
      out.push({ x: cx + x * c - y * s, y: cy + x * s + y * c });
    }
    return out;
  }

  function polygonPoints(verts) {
    const pts = toPoints(verts);
    return pts.length >= 3 ? pts : [];
  }

  function regularPolygon(n, r, rot = -Math.PI / 2, cx = 0, cy = 0) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = rot + (TAU * i) / n;
      out.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
    }
    return out;
  }

  function starPolygon(points, rOuter, rInner, rot = -Math.PI / 2, cx = 0, cy = 0, innerRatio = null) {
    const out = [];
    const n = points * 2;
    const rIn = rInner == null ? rOuter * (innerRatio == null ? 0.45 : innerRatio) : rInner;
    for (let i = 0; i < n; i++) {
      const a = rot + (TAU * i) / n;
      const r = i % 2 === 0 ? rOuter : rIn;
      out.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
    }
    return out;
  }

  function polarPoints(fn, n = 1024, cx = 0, cy = 0) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = (TAU * i) / n;
      const r = fn(a, i / n);
      out.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
    }
    return out;
  }

  /* ------------------------- 自检 ------------------------- */
  function selfTest() {
    const errs = [];
    // FFT → IFFT 往返
    const n = 64;
    const re = new Float64Array(n), im = new Float64Array(n);
    const rr = mulberry32(7);
    for (let i = 0; i < n; i++) { re[i] = rr() * 2 - 1; im[i] = rr() * 2 - 1; }
    const re2 = re.slice(), im2 = im.slice();
    fft(re2, im2, false);
    fft(re2, im2, true);
    for (let i = 0; i < n; i++) {
      if (Math.abs(re2[i] - re[i]) > 1e-9 || Math.abs(im2[i] - im[i]) > 1e-9) { errs.push('FFT 往返失败'); break; }
    }
    // 圆的傅里叶分解：一个圆 = 一个复指数（k=±1），第二个分量应接近 0
    const circle = ellipsePoints(0, 0, 1, 1, 0, 512);
    const ana = analyse(circle, 256);
    const top = ana.ranked.slice(0, 3).map((i) => ana.list[i]);
    if (Math.abs(top[0].k) !== 1 || top[0].mag < 0.9) errs.push('圆的主谐波异常：k=' + top[0].k + ' mag=' + top[0].mag.toFixed(3));
    if (top[1].mag > 0.02) errs.push('圆的第二分量过大：' + top[1].mag.toFixed(4));
    // 重建精度：全部系数应几乎完美重建
    const recon = reconPoints(reconstruct(ana, ana.ranked.slice(0, 256), 512), 512);
    const prep = prepareTarget(circle);
    const e = errorAgainstPrepared(prep, recon);
    if (e > 1e-3) errs.push('全系数重建误差过大：' + e);
    // 目标自对齐误差应为 0
    const e0 = errorAgainstPrepared(prep, circle);
    if (e0 > 1e-3) errs.push('自对齐误差非零：' + e0);
    // 平移/旋转/缩放不变性（旋转不保证，此处只测平移缩放）
    const moved = circle.map((p) => ({ x: p.x * 2.3 + 5, y: p.y * 2.3 - 4 }));
    const e1 = errorAgainstPrepared(prep, moved);
    if (e1 > 1e-3) errs.push('平移缩放不变性失败：' + e1);
    // 起点/方向不变性
    const rotated = circle.slice(137).concat(circle.slice(0, 137)).reverse();
    const e2 = errorAgainstPrepared(prep, rotated);
    if (e2 > 1e-3) errs.push('起点/方向不变性失败：' + e2);
    return errs;
  }

  HP.core = {
    TAU, SAMPLE_N, CMP_N,
    clamp, lerp, isNum, hypot, hashString, mulberry32,
    formatPct, formatTime, formatClock,
    toPoints, dedupe, pathLength, polyArea, centroid, rmsRadius, bbox,
    resampleClosed, pointSegDist, nearestOnPolyline, normalizeShape, fitShape, ensureCCW,
    smoothClosed, catmullRomClosed, simplifyClosed,
    fft, analyse, topIndices, reconstruct, reconPoints,
    prepareTarget, errorAgainstPrepared, errorOfReconstruction, floorError, requiredK,
    curveDistance, starFor, complexFFT,
    outlineFromPrimitives, extractLoops,
    ellipsePoints, polygonPoints, regularPolygon, starPolygon, polarPoints,
    selfTest,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
