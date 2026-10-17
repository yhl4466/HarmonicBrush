/* =========================================================
 * 谐波画笔 · UI 基础组件 ui.js
 * ========================================================= */
(function (global) {
  'use strict';
  const HP = (global.HP = global.HP || {});
  const C = HP.core, R = HP.render;

  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'style') {
          if (typeof v === 'string') el.style.cssText = v;
          else for (const s in v) {
            if (s.startsWith('--')) el.style.setProperty(s, v[s]);
            else el.style[s] = v[s];
          }
        } else if (k === 'html') el.innerHTML = v;
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'value') el.value = v;
        else if (k === 'checked' || k === 'disabled' || k === 'hidden' || k === 'selected') el[k] = !!v;
        else el.setAttribute(k, v);
      }
    }
    addKids(el, kids);
    return el;
  }

  function addKids(el, kids) {
    for (const kid of kids) {
      if (kid == null || kid === false) continue;
      if (Array.isArray(kid)) addKids(el, kid);
      else if (kid instanceof Node) el.appendChild(kid);
      else el.appendChild(document.createTextNode(String(kid)));
    }
  }

  function frag(...kids) {
    const f = document.createDocumentFragment();
    addKids(f, kids);
    return f;
  }

  /* ---------------- 音效 ---------------- */
  const audio = {
    ctx: null,
    enabled: true,
    ensure() {
      if (!this.enabled) return null;
      if (!this.ctx) {
        const AC = global.AudioContext || global.webkitAudioContext;
        if (!AC) return null;
        try { this.ctx = new AC(); } catch (e) { return null; }
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    },
    tone(freq, opts = {}) {
      const ac = this.ensure();
      if (!ac) return;
      const t0 = ac.currentTime + (opts.delay || 0);
      const dur = opts.dur || 0.16;
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = opts.type || 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      const peak = Math.max(0.0001, opts.gain == null ? 0.05 : opts.gain);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g); g.connect(ac.destination);
      osc.start(t0); osc.stop(t0 + dur + 0.03);
    },
    blip() { this.tone(620, { dur: 0.05, type: 'triangle', gain: 0.025 }); },
    toggle(on) { this.tone(on ? 880 : 440, { dur: 0.06, type: 'sine', gain: 0.03 }); },
    harmonic(k) {
      const f = Math.max(60, Math.min(2400, 110 * Math.max(1, Math.abs(k))));
      this.tone(f, { dur: 0.22, type: 'sine', gain: 0.035 });
    },
    success(stars) {
      const notes = stars >= 3 ? [523, 659, 784, 1046] : stars >= 2 ? [523, 659, 784] : [440, 554];
      notes.forEach((f, i) => this.tone(f, { dur: 0.3, gain: 0.045, delay: i * 0.09, type: 'triangle' }));
    },
    fail() {
      [330, 277, 220].forEach((f, i) => this.tone(f, { dur: 0.22, gain: 0.04, delay: i * 0.1, type: 'sine' }));
    },
    unlock() {
      [784, 988, 1318].forEach((f, i) => this.tone(f, { dur: 0.3, gain: 0.04, delay: i * 0.08 }));
    },
  };

  /* ---------------- 弹层 ---------------- */
  function ensureLayers() {
    if (!document.getElementById('overlay')) {
      document.body.appendChild(h('div', { id: 'overlay', class: 'overlay' }));
    }
    if (!document.getElementById('toasts')) {
      document.body.appendChild(h('div', { id: 'toasts', class: 'toasts' }));
    }
  }

  let activeModal = null;
  let closeTimer = 0;

  function modal(node, opts = {}) {
    ensureLayers();
    closeModal();
    clearTimeout(closeTimer);
    const overlay = document.getElementById('overlay');
    const wrap = h('div', { class: 'modal-wrap' }, node);
    const scrim = h('div', {
      class: 'scrim',
      onclick: () => { if (opts.dismissible !== false) closeModal(); },
    });
    overlay.replaceChildren(scrim, wrap);
    overlay.classList.add('open');
    requestAnimationFrame(() => node.classList.add('in'));
    const api = {
      close: closeModal,
      node,
      onEsc: opts.onEsc,
      dismissible: opts.dismissible !== false,
    };
    activeModal = api;
    return api;
  }

  function closeModal() {
    const overlay = document.getElementById('overlay');
    if (!overlay) return;
    const modalEl = overlay.querySelector('.modal');
    if (modalEl) modalEl.classList.remove('in');
    overlay.classList.remove('open');
    if (activeModal) {
      const m = activeModal;
      activeModal = null;
      if (m.onClose) m.onClose();
    }
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => { overlay.replaceChildren(); }, 200);
  }

  function isModalOpen() {
    return !!activeModal;
  }

  function toast(msg, kind = 'info', dur = 2600) {
    ensureLayers();
    const box = document.getElementById('toasts');
    const t = h('div', { class: 'toast ' + kind },
      kind === 'ach' ? h('span', { class: 'toast-icon' }, '✦') : null,
      h('span', {}, msg));
    box.appendChild(t);
    requestAnimationFrame(() => t.classList.add('in'));
    setTimeout(() => {
      t.classList.remove('in');
      t.classList.add('out');
      setTimeout(() => t.remove(), 320);
    }, dur);
  }

  /* ---------------- 组件 ---------------- */
  function starsRow(n, cls = '') {
    return h('span', { class: 'stars ' + cls },
      [0, 1, 2].map((i) => h('span', { class: 'star' + (i < n ? ' on' : '') }, '★')));
  }

  function haptic(ms = 6) {
    try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* noop */ }
  }

  function btn(label, opts = {}) {
    return h('button', {
      class: 'btn ' + (opts.kind || '') + ' ' + (opts.cls || ''),
      onclick: (e) => { haptic(6); if (opts.onClick) opts.onClick(e); },
      disabled: opts.disabled,
      title: opts.title,
    }, label);
  }

  function iconBtn(label, opts = {}) {
    return h('button', {
      class: 'icon-btn ' + (opts.cls || ''),
      onclick: (e) => { haptic(5); if (opts.onClick) opts.onClick(e); },
      title: opts.title,
      'aria-label': opts.title || label,
    }, label);
  }

  function chip(text, cls = '') {
    return h('span', { class: 'chip ' + cls }, text);
  }

  /* ---------------- 缩略图绘制 ---------------- */
  function paintShape(cv, pts, opts = {}) {
    if (!cv) return;
    const dpr = Math.min(global.devicePixelRatio || 1, 2.5);
    const rect = cv.getBoundingClientRect();
    const w = Math.max(24, Math.round(rect.width || cv.clientWidth || cv.dataset.w || 120));
    const hgt = Math.max(24, Math.round(rect.height || cv.clientHeight || cv.dataset.h || 120));
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(hgt * dpr);
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, hgt);
    if (!pts || pts.length < 3) return;
    const bb = C.bbox(pts);
    const pad = opts.pad == null ? 7 : opts.pad;
    const sc = Math.min((w - pad * 2) / Math.max(0.001, bb.w), (hgt - pad * 2) / Math.max(0.001, bb.h));
    ctx.save();
    ctx.translate(w / 2, hgt / 2);
    ctx.scale(sc, sc);
    ctx.translate(-bb.cx, -bb.cy);
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    if (opts.fill !== false) {
      ctx.fillStyle = opts.fill || 'rgba(90,200,255,0.07)';
      ctx.fill();
    }
    const color = opts.color || '#54e6ff';
    ctx.strokeStyle = color;
    ctx.lineWidth = (opts.width || 2) / sc;
    ctx.lineJoin = 'round';
    if (!opts.noGlow) { ctx.shadowColor = color; ctx.shadowBlur = (opts.glow || 10) / sc; }
    ctx.stroke();
    ctx.restore();
  }

  function paintSpectrum(cv, spec, opts = {}) {
    if (!cv) return;
    const r = new R.Renderer(cv);
    r.theme = R.THEMES[opts.theme || 'scope'];
    r.drawSpectrum(spec, opts);
  }

  function drawStar(ctx, x, y, r, fill) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 === 0 ? r : r * 0.45;
      const px = x + rr * Math.cos(a), py = y + rr * Math.sin(a);
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  }

  /* ---------------- 全局快捷键 ---------------- */
  global.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && activeModal) {
      if (activeModal.onEsc) activeModal.onEsc();
      else if (activeModal.dismissible) closeModal();
    }
  });

  HP.ui = {
    h, frag, btn, iconBtn, chip, toast, modal, closeModal, isModalOpen,
    starsRow, paintShape, paintSpectrum, drawStar, audio, ensureLayers, haptic,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
