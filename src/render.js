/* =========================================================
 * 谐波画笔 · 渲染引擎 render.js
 * 圆环链 / 目标虚影 / 轨迹 / 频谱图 / 缩略图 / 主题
 * ========================================================= */
(function (global) {
  'use strict';
  const HP = (global.HP = global.HP || {});
  const C = HP.core;
  const { TAU, clamp, lerp } = C;

  const THEMES = {
    scope: {
      id: 'scope', name: '示波器', light: false,
      bg0: '#040a15', bg1: '#0a1a33', bg2: '#04070f',
      grid: 'rgba(90,200,255,0.060)', gridBold: 'rgba(90,200,255,0.11)',
      ghost: 'rgba(120,205,255,0.42)', ghostFill: 'rgba(80,180,255,0.045)',
      chain: 'rgba(110,200,255,0.28)', link: 'rgba(110,200,255,0.18)',
      trail: '#54e6ff', trail2: '#b6f6ff', tip: '#d8fbff',
      accent: '#54e6ff', accent2: '#ff5ed2', warn: '#ffb454', ok: '#5effb0',
      text: '#d8ecff', star: '#ffd166',
      spectrum: '#54e6ff', spectrumDim: 'rgba(120,190,255,0.24)',
      ink: '#061020',
    },
    neon: {
      id: 'neon', name: '霓虹夜', light: false,
      bg0: '#0a0418', bg1: '#1c0b34', bg2: '#06020f',
      grid: 'rgba(255,110,220,0.045)', gridBold: 'rgba(255,110,220,0.09)',
      ghost: 'rgba(255,150,230,0.40)', ghostFill: 'rgba(255,100,220,0.05)',
      chain: 'rgba(255,130,230,0.13)', link: 'rgba(160,120,255,0.10)',
      trail: '#ff6ad5', trail2: '#8ef0ff', tip: '#fff1ff',
      accent: '#ff6ad5', accent2: '#7de9ff', warn: '#ffc857', ok: '#7dffc4',
      text: '#ffe9fb', star: '#ffd166',
      spectrum: '#ff6ad5', spectrumDim: 'rgba(255,130,220,0.22)',
      ink: '#0b0318',
    },
    paper: {
      id: 'paper', name: '纸墨', light: true,
      bg0: '#f7f1e4', bg1: '#ece2cf', bg2: '#e4d9c3',
      grid: 'rgba(70,55,40,0.075)', gridBold: 'rgba(70,55,40,0.14)',
      ghost: 'rgba(80,62,44,0.42)', ghostFill: 'rgba(90,70,50,0.05)',
      chain: 'rgba(70,60,50,0.18)', link: 'rgba(70,60,50,0.12)',
      trail: '#22303a', trail2: '#5b3a2e', tip: '#b23a48',
      accent: '#b23a48', accent2: '#2d6a7a', warn: '#b06a12', ok: '#2f7a4f',
      text: '#2b2620', star: '#b8860b',
      spectrum: '#b23a48', spectrumDim: 'rgba(90,70,55,0.22)',
      ink: '#3a3228',
    },
  };

  const BRUSHES = {
    glow: { id: 'glow' },
    neon: { id: 'neon' },
    ink: { id: 'ink' },
  };

  function hash01(i) {
    let x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  class Renderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.W = 1; this.H = 1; this.dpr = 1;
      this.scale = 1; this.baseScale = 1; this.zoom = 1;
      this.camX = 0; this.camY = 0;
      this.theme = THEMES.scope;
      this.brush = 'glow';
      this.trail = 'basic';
      this.reduced = false;
      this.resize();
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      const dpr = Math.min(global.devicePixelRatio || 1, 2.5);
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      this.W = w; this.H = h; this.dpr = dpr;
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this._applyScale();
    }

    _applyScale() {
      this.scale = this.baseScale * this.zoom;
    }

    fit(bbox, pad = 0.35, padScreen = 26) {
      const w = Math.max(0.001, bbox.w), h = Math.max(0.001, bbox.h);
      const availW = Math.max(40, this.W - padScreen * 2);
      const availH = Math.max(40, this.H - padScreen * 2);
      this.baseScale = Math.min(availW / (w + pad * 2), availH / (h + pad * 2));
      this.camX = bbox.cx; this.camY = bbox.cy;
      this.zoom = 1;
      this._applyScale();
    }

    setZoom(z) {
      this.zoom = clamp(z, 0.45, 4);
      this._applyScale();
    }

    toWorld(sx, sy) {
      return {
        x: this.camX + (sx - this.W / 2) / this.scale,
        y: this.camY + (sy - this.H / 2) / this.scale,
      };
    }

    toScreen(wx, wy) {
      return {
        x: this.W / 2 + (wx - this.camX) * this.scale,
        y: this.H / 2 + (wy - this.camY) * this.scale,
      };
    }

    setTheme(id) {
      this.theme = THEMES[id] || THEMES.scope;
    }

    clear() {
      this.ctx.clearRect(0, 0, this.W, this.H);
    }

    // ---------------- 背景 ----------------
    drawBackground() {
      const { ctx, W, H, theme: T } = this;
      ctx.save();
      const g = ctx.createRadialGradient(W * 0.5, H * 0.42, 10, W * 0.5, H * 0.5, Math.max(W, H) * 0.78);
      g.addColorStop(0, T.bg1);
      g.addColorStop(0.62, T.bg0);
      g.addColorStop(1, T.bg2);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // 网格
      const unit = 1;
      const pxPerUnit = this.scale;
      let step = 0.5;
      while (step * pxPerUnit < 46) step *= 2;
      while (step * pxPerUnit > 190) step /= 2;
      const left = this.toWorld(0, 0), right = this.toWorld(W, H);
      ctx.lineWidth = 1;
      for (let x = Math.ceil(left.x / step) * step; x <= right.x; x += step) {
        const sx = this.toScreen(x, 0).x;
        ctx.strokeStyle = Math.abs(x) < 1e-6 ? T.gridBold : T.grid;
        ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, H); ctx.stroke();
      }
      for (let y = Math.ceil(left.y / step) * step; y <= right.y; y += step) {
        const sy = this.toScreen(0, y).y;
        ctx.strokeStyle = Math.abs(y) < 1e-6 ? T.gridBold : T.grid;
        ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(W, sy); ctx.stroke();
      }
      // 中心十字
      const o = this.toScreen(0, 0);
      ctx.strokeStyle = T.gridBold;
      ctx.beginPath();
      ctx.moveTo(o.x - 7, o.y); ctx.lineTo(o.x + 7, o.y);
      ctx.moveTo(o.x, o.y - 7); ctx.lineTo(o.x, o.y + 7);
      ctx.stroke();
      ctx.restore();
    }

    // ---------------- 目标虚影 ----------------
    drawGhost(points, opts = {}) {
      const { ctx, theme: T } = this;
      if (!points || points.length < 3) return;
      const alpha = opts.alpha == null ? 1 : opts.alpha;
      ctx.save();
      ctx.beginPath();
      for (let i = 0; i < points.length; i++) {
        const s = this.toScreen(points[i].x, points[i].y);
        if (i === 0) ctx.moveTo(s.x, s.y); else ctx.lineTo(s.x, s.y);
      }
      ctx.closePath();
      ctx.fillStyle = T.ghostFill;
      ctx.globalAlpha = alpha;
      ctx.fill();
      ctx.setLineDash(opts.dash || [7, 7]);
      ctx.lineDashOffset = opts.offset || 0;
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = T.ghost;
      ctx.stroke();
      ctx.restore();
    }

    // ---------------- 笔迹 ----------------
    strokePolyline(pts, color, opts = {}) {
      const { ctx } = this;
      if (!pts || pts.length < 2) return;
      ctx.save();
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      if (opts.composite) ctx.globalCompositeOperation = opts.composite;
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const s = this.toScreen(pts[i].x, pts[i].y);
        if (i === 0) ctx.moveTo(s.x, s.y); else ctx.lineTo(s.x, s.y);
      }
      if (opts.close) ctx.closePath();
      if (opts.dash) ctx.setLineDash(opts.dash);
      if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = opts.width || 2;
      ctx.stroke();
      ctx.restore();
    }

    drawBrushStroke(pts, work = null) {
      const { ctx, theme: T } = this;
      if (!pts || pts.length < 2) return;
      const brush = this.brush;
      const color = work && work.color ? work.color : T.trail;
      const light = T.light;
      ctx.save();
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      if (!light) ctx.globalCompositeOperation = 'lighter';

      const path = (width, alpha, col) => {
        ctx.beginPath();
        for (let i = 0; i < pts.length; i++) {
          const s = this.toScreen(pts[i].x, pts[i].y);
          if (i === 0) ctx.moveTo(s.x, s.y); else ctx.lineTo(s.x, s.y);
        }
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = col;
        ctx.lineWidth = width;
        ctx.stroke();
      };

      if (light) ctx.globalCompositeOperation = 'source-over';
      if (brush === 'neon' && !light) {
        path(11, 0.10, color);
        path(5.5, 0.22, color);
        path(2.4, 0.95, color);
        path(1.0, 0.55, T.trail2);
      } else if (brush === 'ink' || light) {
        const n = pts.length;
        const chunks = Math.max(1, Math.min(64, Math.floor(n / 5)));
        for (let ci = 0; ci < chunks; ci++) {
          const a = Math.floor((ci * n) / chunks);
          const b = Math.floor(((ci + 1) * n) / chunks) + 1;
          ctx.beginPath();
          for (let i = a; i < Math.min(n, b); i++) {
            const s = this.toScreen(pts[i].x, pts[i].y);
            if (i === a) ctx.moveTo(s.x, s.y); else ctx.lineTo(s.x, s.y);
          }
          ctx.globalAlpha = 0.92;
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.1 + 3.0 * Math.abs(Math.sin(ci * 1.7 + 0.6));
          ctx.stroke();
        }
      } else {
        path(10, 0.09, color);
        path(5, 0.2, color);
        path(2.2, 0.95, color);
        path(0.9, 0.5, T.trail2);
      }

      if (this.trail === 'spark' && !light) {
        ctx.globalCompositeOperation = 'lighter';
        const n = pts.length;
        for (let i = 0; i < n; i += 24) {
          const s = this.toScreen(pts[i].x, pts[i].y);
          const h = hash01(i + 3.7);
          const r = 1.2 + h * 2.6;
          ctx.globalAlpha = 0.42 + h * 0.4;
          ctx.fillStyle = h > 0.5 ? T.trail2 : T.accent2;
          ctx.beginPath(); ctx.arc(s.x + (h - 0.5) * 9, s.y + (hash01(i + 9.2) - 0.5) * 9, r, 0, TAU); ctx.fill();
        }
      }
      ctx.restore();
    }

    // ---------------- 圆环链 ----------------
    /**
     * state: { ana, indices, t, highlightK, showFull, loopPts, progress }
     */
    drawChain(state) {
      const { ctx, theme: T } = this;
      const { ana, indices, t } = state;
      if (!ana || !indices || !indices.length) return;
      const sorted = indices.slice().sort((a, b) => ana.mag[b] - ana.mag[a]);
      const orig = this.toScreen(0, 0);
      let x = 0, y = 0;
      const circles = [];
      for (let i = 0; i < sorted.length; i++) {
        const idx = sorted[i];
        const mag = ana.mag[idx];
        const k = ana.kOf[idx];
        if (mag < 1e-9) continue;
        const ph = Math.atan2(ana.cIm[idx], ana.cRe[idx]);
        const ang = ph + TAU * k * t;
        const nx = x + mag * Math.cos(ang);
        const ny = y + mag * Math.sin(ang);
        circles.push({ x, y, r: mag, nx, ny, k, idx });
        x = nx; y = ny;
      }
      const highlight = state.highlightK;

      ctx.save();
      if (!T.light) ctx.globalCompositeOperation = 'lighter';

      // 圆
      ctx.beginPath();
      for (const c of circles) {
        const s = this.toScreen(c.x, c.y);
        const r = c.r * this.scale;
        if (r < 0.25) continue;
        ctx.moveTo(s.x + r, s.y);
        ctx.arc(s.x, s.y, r, 0, TAU);
      }
      ctx.strokeStyle = T.chain;
      ctx.lineWidth = 1;
      ctx.stroke();

      // 连杆
      ctx.beginPath();
      for (const c of circles) {
        const a = this.toScreen(c.x, c.y);
        const b = this.toScreen(c.nx, c.ny);
        ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      }
      ctx.strokeStyle = T.link;
      ctx.lineWidth = 0.8;
      ctx.stroke();

      // 高亮某个谐波
      if (highlight != null) {
        const c = circles.find((cc) => cc.k === highlight);
        if (c) {
          const s = this.toScreen(c.x, c.y);
          const r = c.r * this.scale;
          ctx.globalCompositeOperation = 'source-over';
          ctx.beginPath();
          ctx.arc(s.x, s.y, Math.max(1, r), 0, TAU);
          ctx.strokeStyle = T.accent2;
          ctx.lineWidth = 2;
          ctx.globalAlpha = 0.95;
          ctx.stroke();
          const b = this.toScreen(c.nx, c.ny);
          ctx.beginPath();
          ctx.moveTo(s.x, s.y); ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = T.accent2;
          ctx.lineWidth = 2.2;
          ctx.stroke();
          // 标签
          ctx.globalAlpha = 1;
          ctx.font = '600 10px "Microsoft YaHei", sans-serif';
          ctx.fillStyle = T.accent2;
          const lx = s.x + r * 0.7 + 6, ly = s.y - r * 0.7 - 4;
          ctx.fillText('k=' + (c.k > 0 ? '+' + c.k : c.k), lx, ly);
        }
      }

      // 笔尖
      const tip = this.toScreen(x, y);
      ctx.globalCompositeOperation = T.light ? 'source-over' : 'lighter';
      const g = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, 22);
      g.addColorStop(0, T.tip);
      g.addColorStop(0.25, T.trail);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(tip.x, tip.y, 22, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = T.tip;
      ctx.beginPath(); ctx.arc(tip.x, tip.y, 2.6, 0, TAU); ctx.fill();

      // 起点
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = T.ghost;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(orig.x, orig.y, 3, 0, TAU); ctx.stroke();
      ctx.restore();
    }

    // ---------------- 轨迹（完整淡显 + 已绘制部分） ----------------
    drawTrail(loopPts, progress, opts = {}) {
      const { ctx, theme: T } = this;
      if (!loopPts || loopPts.length < 4) return;
      const n = loopPts.length;
      const upto = clamp(Math.floor(progress * n), 2, n);
      ctx.save();
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      if (!T.light) ctx.globalCompositeOperation = 'lighter';
      // 完整的淡轨迹
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const s = this.toScreen(loopPts[i].x, loopPts[i].y);
        if (i === 0) ctx.moveTo(s.x, s.y); else ctx.lineTo(s.x, s.y);
      }
      ctx.closePath();
      ctx.strokeStyle = opts.fullColor || T.trail;
      ctx.globalAlpha = opts.fullAlpha == null ? 0.11 : opts.fullAlpha;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.restore();

      // 已走过的部分
      const part = [];
      for (let i = 0; i < upto; i++) part.push(loopPts[i]);
      if (part.length > 1) this.drawBrushStroke(part);
    }

    // ---------------- 目标缩略图 ----------------
    drawMini(points, opts = {}) {
      const { ctx, theme: T } = this;
      const W = this.W, H = this.H;
      ctx.clearRect(0, 0, W, H);
      if (!points || points.length < 3) return;
      const bb = C.bbox(points);
      const pad = 8;
      const sc = Math.min((W - pad * 2) / Math.max(0.001, bb.w), (H - pad * 2) / Math.max(0.001, bb.h));
      const tx = W / 2 - bb.cx * sc, ty = H / 2 - bb.cy * sc;
      ctx.save();
      ctx.translate(tx, ty);
      ctx.scale(sc, sc);
      ctx.beginPath();
      points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
      ctx.fillStyle = opts.fill || T.ghostFill;
      ctx.fill();
      ctx.strokeStyle = opts.color || T.ghost;
      ctx.lineWidth = (opts.width || 1.6) / sc;
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.restore();
    }

    // ---------------- 频谱柱状图 ----------------
    drawSpectrum(ana, opts = {}) {
      const { ctx, theme: T } = this;
      const W = this.W, H = this.H;
      ctx.clearRect(0, 0, W, H);
      if (!ana) return;
      const range = opts.range || 32;
      const padL = 6, padR = 6, padT = 8, padB = 16;
      const plotW = W - padL - padR, plotH = H - padT - padB;
      const n = range * 2 + 1;
      const bw = plotW / n;
      const ghost = opts.ghostMags || null;
      let maxMag = 0;
      const mags = new Array(n);
      const ghosts = new Array(n);
      for (let i = 0; i < n; i++) {
        const k = i - range;
        const idx = k >= 0 ? k : k + ana.N;
        const m = idx >= 0 && idx < ana.N ? ana.mag[idx] : 0;
        const g = ghost && idx >= 0 && idx < ana.N ? ghost[idx] : 0;
        mags[i] = m;
        ghosts[i] = g;
        if (m > maxMag) maxMag = m;
        if (g > maxMag) maxMag = g;
      }
      if (maxMag <= 0) return;
      const selected = opts.selected || new Set();
      const highlightK = opts.highlightK;
      const log = (v) => Math.log1p(v * 9) / Math.log(10);

      // 基线
      ctx.strokeStyle = T.light ? 'rgba(60,50,40,0.25)' : 'rgba(150,200,255,0.18)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padL, H - padB + 0.5);
      ctx.lineTo(W - padR, H - padB + 0.5);
      ctx.stroke();

      // 目标谱（提示）柱，画在当前柱后面
      if (ghost) {
        for (let i = 0; i < n; i++) {
          if (ghosts[i] <= 0) continue;
          const k = i - range;
          const hgt = Math.max(1.5, log(ghosts[i]) * plotH);
          const x = padL + i * bw + bw * 0.18;
          const w = Math.max(1, bw * 0.64);
          ctx.fillStyle = T.warn;
          ctx.globalAlpha = 0.3;
          ctx.fillRect(x, H - padB - hgt, w, hgt);
        }
        ctx.globalAlpha = 1;
      }

      for (let i = 0; i < n; i++) {
        const k = i - range;
        const idx = k >= 0 ? k : k + ana.N;
        const on = selected.has(idx);
        const hgt = Math.max(1.5, log(mags[i]) * plotH);
        const x = padL + i * bw + bw * 0.18;
        const w = Math.max(1, bw * 0.64);
        ctx.fillStyle = on ? T.spectrum : T.spectrumDim;
        if (!on) ctx.globalAlpha = 0.55;
        else ctx.globalAlpha = k === highlightK ? 1 : 0.9;
        if (k === 0) ctx.fillStyle = T.warn;
        ctx.fillRect(x, H - padB - hgt, w, hgt);
        ctx.globalAlpha = 1;
      }

      // 预算线
      if (opts.budgetLine != null && opts.budgetLine > 0) {
        const y = H - padB - Math.max(1.5, log(opts.budgetLine) * plotH);
        ctx.save();
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = T.warn;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
        ctx.restore();
      }

      // 轴标签
      ctx.font = '9px "Microsoft YaHei", sans-serif';
      ctx.fillStyle = T.light ? 'rgba(60,50,40,0.7)' : 'rgba(160,200,255,0.62)';
      ctx.textAlign = 'center';
      const labelEvery = range <= 16 ? 4 : 8;
      for (let k = -range; k <= range; k += labelEvery) {
        const i = k + range;
        ctx.fillText(String(k), padL + i * bw + bw / 2, H - 4);
      }
      ctx.textAlign = 'start';
      ctx.fillText('', W - padR - 9, H - 4);
    }
  }

  HP.render = { Renderer, THEMES, BRUSHES };
})(typeof globalThis !== 'undefined' ? globalThis : this);
