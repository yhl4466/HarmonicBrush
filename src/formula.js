/* =========================================================
 * 谐波画笔 · 迷你 TeX → SVG 公式排版 formula.js
 * 零依赖，支持本作需要的 TeX 子集：
 *   字母/数字、上下标、\frac、\sum（含上下限）、希腊字母、
 *   \cos \sin \arg 等函数名、\text、\quad \, \; 间距、| |、± ∝ ≤ ∈ → …
 * 输出 <svg>，文本用当前颜色，可随主题变色、可缩放。
 * ========================================================= */
(function (global) {
  'use strict';
  const HP = (global.HP = global.HP || {});
  const FONT = "Cambria Math, 'STIX Two Math', 'Latin Modern Math', 'Times New Roman', serif";
  const FONT_ATTR = "Cambria Math, 'STIX Two Math', 'Times New Roman', serif";

  let mctx = null;
  function measure(text, size, italic) {
    if (!text) return 0;
    if (!mctx) {
      const cv = document.createElement('canvas');
      mctx = cv.getContext('2d');
    }
    mctx.font = (italic ? 'italic ' : '') + size + 'px ' + FONT;
    return mctx.measureText(text).width;
  }

  const OPS = ['+', '−', '=', '±', '∝', '≤', '≥', '∈', '→', '/', '·'];
  const isOp = (t) => OPS.indexOf(t) >= 0;
  const isRel = (t) => ['=', '≤', '≥', '∈', '→', '∝'].indexOf(t) >= 0;

  function atom(text, opts) {
    return { type: 'atom', text, italic: !!(opts && opts.italic), fn: !!(opts && opts.fn) };
  }
  function space(em) { return { type: 'space', em }; }
  function row(items) { return { type: 'row', items: items.filter(Boolean) }; }

  function parse(tex) {
    const src = String(tex || '').replace(/\n/g, ' ');
    let i = 0;
    const n = src.length;
    function skip() { while (i < n && src[i] === ' ') i++; }
    function readGroup() {
      skip();
      if (src[i] === '{') { i++; return parseRow('}'); }
      return single() || row([]);
    }
    function rawGroup() {
      skip();
      if (src[i] !== '{') return '';
      i++;
      let depth = 1, out = '';
      while (i < n && depth > 0) {
        const c = src[i++];
        if (c === '{') depth++;
        else if (c === '}') { depth--; if (!depth) break; }
        if (depth) out += c;
      }
      return out;
    }
    function command() {
      i++; // backslash
      if (i < n && !/[a-zA-Z]/.test(src[i])) {
        const c = src[i++];
        if (c === ',') return space(0.18);
        if (c === ';') return space(0.28);
        if (c === ':') return space(0.22);
        if (c === '!') return space(-0.08);
        if (c === ' ') return space(0.25);
        if (c === '{' || c === '}' || c === '|') return atom(c, {});
        return atom(c, {});
      }
      let name = '';
      while (i < n && /[a-zA-Z]/.test(src[i])) name += src[i++];
      switch (name) {
        case 'frac': {
          const a = readGroup();
          const b = readGroup();
          return { type: 'frac', num: a, den: b };
        }
        case 'sum': return { type: 'bigop', op: 'Σ', sup: null, sub: null };
        case 'pi': return atom('π', {});
        case 'theta': return atom('θ', { italic: true });
        case 'varphi': return atom('φ', { italic: true });
        case 'phi': return atom('ϕ', { italic: true });
        case 'lambda': return atom('λ', { italic: true });
        case 'omega': return atom('ω', { italic: true });
        case 'cdot': return atom('·', {});
        case 'pm': return atom('±', {});
        case 'propto': return atom('∝', {});
        case 'le': case 'leq': return atom('≤', {});
        case 'ge': case 'geq': return atom('≥', {});
        case 'in': return atom('∈', {});
        case 'to': return atom('→', {});
        case 'dots': case 'ldots': case 'cdots': return atom('⋯', {});
        case 'quad': return space(1.0);
        case ' ': return space(0.25);
        case 'sin': case 'cos': case 'tan': case 'log': case 'exp': case 'max': case 'min': case 'arg':
          return atom(name, { fn: true });
        case 'text': case 'mathrm': {
          const s = rawGroup();
          return atom(s, {});
        }
        case 'left': case 'right': {
          skip();
          const c = src[i++] || '';
          return atom(c, {});
        }
        default:
          return atom(name, {});
      }
    }
    function single() {
      skip();
      if (i >= n) return null;
      const c = src[i];
      if (c === '{') { i++; return parseRow('}'); }
      if (c === '\\') return command();
      if (/[a-zA-Z]/.test(c)) { i++; return atom(c, { italic: true }); }
      if (/[0-9.]/.test(c)) {
        let s = '';
        while (i < n && /[0-9.]/.test(src[i])) s += src[i++];
        return atom(s, {});
      }
      i++;
      if (c === '-') return atom('−', {});
      if (c === '|') return atom('|', {});
      if (c === ' ') return null;
      return atom(c, {});
    }
    function attach(base) {
      if (!base) return null;
      let sup = null, sub = null;
      for (;;) {
        skip();
        if (src[i] === '^') { i++; sup = readGroup(); }
        else if (src[i] === '_') { i++; sub = readGroup(); }
        else break;
      }
      if (!sup && !sub) return base;
      if (base.type === 'bigop') {
        return { type: 'bigop', op: base.op, sup, sub };
      }
      return { type: 'scripts', base, sup, sub };
    }
    function parseRow(stop) {
      const items = [];
      while (i < n) {
        skip();
        if (stop && src[i] === stop) { i++; break; }
        if (src[i] === '}') { i++; break; }
        const base = single();
        if (base) items.push(attach(base));
      }
      return row(items);
    }
    return parseRow(null);
  }

  function layout(node, size) {
    if (!node) return { w: 0, h: 0, d: 0, draw() {} };
    if (node.type === 'space') {
      return { w: node.em * size, h: 0, d: 0, draw() {} };
    }
    if (node.type === 'atom') {
      const fs = size;
      // 斜体字母加一点 italic correction，避免 i 与后面的括号/字母粘连
      const w = measure(node.text, fs, node.italic) + (node.italic ? 0.055 * size : 0);
      const h = fs * 0.72, d = fs * 0.22;
      return {
        w, h, d,
        draw(x, baseY, out) {
          out.push({ t: 'text', x, y: baseY, s: node.text, size: fs, italic: node.italic });
        },
      };
    }
    if (node.type === 'row') {
      const items = node.items;
      const parts = [];
      let x = 0, h = 0, d = 0;
      for (let k = 0; k < items.length; k++) {
        const it = items[k];
        const b = layout(it, size);
        let before = 0, after = 0;
        if (it.type === 'atom' && isOp(it.text)) {
          const prev = items[k - 1], next = items[k + 1];
          const prevOp = prev && prev.type === 'atom' && isOp(prev.text);
          const nextOp = next && next.type === 'atom' && isOp(next.text);
          const rel = isRel(it.text);
          before = k > 0 && !prevOp ? (rel ? 0.26 : 0.18) * size : 0;
          after = next && !nextOp ? (rel ? 0.26 : 0.18) * size : 0;
        }
        parts.push({ b, x: x + before });
        x += before + b.w + after;
        h = Math.max(h, b.h);
        d = Math.max(d, b.d);
      }
      return {
        w: x, h, d,
        draw(x0, baseY, out) { for (const p of parts) p.b.draw(x0 + p.x, baseY, out); },
      };
    }
    if (node.type === 'scripts') {
      const b = layout(node.base, size);
      const ss = size * 0.66;
      const sup = node.sup ? layout(node.sup, ss) : null;
      const sub = node.sub ? layout(node.sub, ss) : null;
      const sw = Math.max(sup ? sup.w : 0, sub ? sub.w : 0);
      const up = 0.42 * size, down = 0.16 * size;
      const w = b.w + (sw ? 0.05 * size + sw : 0);
      const h = Math.max(b.h, sup ? up + sup.h : 0);
      const d = Math.max(b.d, sub ? down + sub.d : 0);
      return {
        w, h, d,
        draw(x, baseY, out) {
          b.draw(x, baseY, out);
          if (sup) sup.draw(x + b.w + 0.05 * size, baseY - up, out);
          if (sub) sub.draw(x + b.w + 0.05 * size, baseY + down, out);
        },
      };
    }
    if (node.type === 'frac') {
      const fs = size * 0.8;
      const num = layout(node.num, fs), den = layout(node.den, fs);
      const axis = 0.3 * size, gap = 0.13 * size;
      const w = Math.max(num.w, den.w) + 0.26 * size;
      const numBase = axis + gap + num.d;
      const denBase = axis - gap - den.h;
      const h = numBase + num.h;
      const d = -denBase + den.d;
      return {
        w, h, d,
        draw(x, baseY, out) {
          num.draw(x + (w - num.w) / 2, baseY - numBase, out);
          den.draw(x + (w - den.w) / 2, baseY - denBase, out);
          out.push({ t: 'rect', x: x + 0.03 * size, y: baseY - axis, w: w - 0.06 * size, h: Math.max(1, size * 0.05) });
        },
      };
    }
    if (node.type === 'bigop') {
      const opSize = size * 1.35;
      const opW = measure(node.op, opSize, false);
      const ss = size * 0.64;
      const sup = node.sup ? layout(node.sup, ss) : null;
      const sub = node.sub ? layout(node.sub, ss) : null;
      const w = Math.max(opW, sup ? sup.w : 0, sub ? sub.w : 0) + 0.12 * size;
      const opH = 0.98 * size, opD = 0.26 * size;
      const supBase = opH + 0.16 * size;
      const subBase = opD + 0.14 * size;
      const h = Math.max(opH, sup ? supBase + sup.h : 0);
      const d = Math.max(opD, sub ? subBase + sub.d : 0);
      return {
        w, h, d,
        draw(x, baseY, out) {
          out.push({ t: 'text', x: x + w / 2, y: baseY, s: node.op, size: opSize, italic: false, anchor: 'middle' });
          if (sup) sup.draw(x + (w - sup.w) / 2, baseY - supBase, out);
          if (sub) sub.draw(x + (w - sub.w) / 2, baseY + subBase, out);
        },
      };
    }
    return { w: 0, h: 0, d: 0, draw() {} };
  }

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const escAttr = (s) => esc(s).replace(/"/g, '&quot;');

  function svg(tex, opts = {}) {
    const size = opts.size || 17;
    let ast;
    try { ast = parse(tex); } catch (e) { ast = row([atom(String(tex), {})]); }
    const box = layout(ast, size);
    const pad = 2;
    const W = Math.max(4, Math.ceil(box.w + pad * 2));
    const H = Math.max(4, Math.ceil(box.h + box.d + pad * 2));
    const prims = [];
    box.draw(pad, pad + box.h, prims);
    let body = '';
    for (const p of prims) {
      if (p.t === 'text') {
        body += `<text x="${p.x.toFixed(2)}" y="${p.y.toFixed(2)}" font-family="${FONT_ATTR}" font-size="${p.size.toFixed(2)}"` +
          (p.italic ? ' font-style="italic"' : '') +
          (p.anchor ? ` text-anchor="${p.anchor}"` : '') +
          ` fill="currentColor">${esc(p.s)}</text>`;
      } else if (p.t === 'rect') {
        body += `<rect x="${p.x.toFixed(2)}" y="${p.y.toFixed(2)}" width="${p.w.toFixed(2)}" height="${p.h.toFixed(2)}" rx="${(p.h / 2).toFixed(2)}" fill="currentColor"/>`;
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${escAttr(tex)}" style="max-width:100%;height:auto;overflow:visible">${body}</svg>`;
  }

  HP.formula = { svg, parse, measure };
})(typeof globalThis !== 'undefined' ? globalThis : this);
