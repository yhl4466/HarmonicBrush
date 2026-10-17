/* =========================================================
 * 谐波画笔 · 图形库 shapes.js
 * 所有关卡目标形状均由代码生成（自绘 / 参数曲线 / 笔画轮廓）
 * ========================================================= */
(function (global) {
  'use strict';
  const HP = (global.HP = global.HP || {});
  const C = HP.core;
  const { TAU, clamp, fitShape, resampleClosed, catmullRomClosed, polarPoints, ellipsePoints,
    regularPolygon, starPolygon, outlineFromPrimitives, polygonPoints } = C;

  const cache = new Map();

  function reg(id, def) { def.id = id; return def; }

  /* ---------- 基本形状构造 ---------- */
  const circle = reg('circle', { name: '圆', build: () => ellipsePoints(0, 0, 1, 1, 0, 900) });

  const ellipse = reg('ellipse', {
    name: '椭圆',
    build: () => ellipsePoints(0, 0, 1.32, 0.72, 0.18, 900),
  });

  const offsetCircle = reg('offsetCircle', {
    name: '偏移圆',
    build: () => ellipsePoints(0.62, 0.38, 0.82, 0.82, 0, 900),
  });

  const twin = reg('twin', {
    name: '双圆环',
    build: () => outlineFromPrimitives([
      { type: 'disk', x: -0.62, y: 0, r: 0.74 },
      { type: 'disk', x: 0.62, y: 0, r: 0.74 },
    ], { res: 320 }),
  });

  const square = reg('square', {
    name: '正方形',
    build: () => [{ x: -1, y: -1 }, { x: 1, y: -1 }, { x: 1, y: 1 }, { x: -1, y: 1 }],
  });

  const triangle = reg('triangle', {
    name: '三角形',
    build: () => regularPolygon(3, 1.18, -Math.PI / 2),
  });

  const hexagon = reg('hexagon', {
    name: '六边形',
    build: () => regularPolygon(6, 1.12, 0),
  });

  const star8 = reg('star8', {
    name: '八芒星',
    build: () => starPolygon(8, 1.18, 0.52, -Math.PI / 2),
  });

  // 单笔闭合字母 A：底左 → 顶点 → 底右 → 沿右腿回到横杠 → 横杠 → 沿左腿回到起点
  const letterA = reg('letterA', {
    name: '字母 A',
    build: () => {
      const apex = { x: 0, y: -1 };
      const bl = { x: -0.62, y: 1 };
      const br = { x: 0.62, y: 1 };
      const yBar = 0.22;
      const t = (yBar + 1) / 2;
      const cr = { x: 0.62 * t, y: yBar };
      const cl = { x: -0.62 * t, y: yBar };
      return [{ ...bl }, { ...apex }, { ...br }, cr, cl, { ...bl }];
    },
  });

  const gong = reg('gong', {
    name: '汉字「工」',
    build: () => outlineFromPrimitives([
      { type: 'seg', x1: -0.82, y1: 0.82, x2: 0.82, y2: 0.82, r: 0.13 },
      { type: 'seg', x1: 0, y1: 0.86, x2: 0, y2: -0.86, r: 0.13 },
      { type: 'seg', x1: -0.82, y1: -0.82, x2: 0.82, y2: -0.82, r: 0.13 },
    ], { res: 340 }),
  });

  const heart = reg('heart', {
    name: '心形',
    build: () => {
      const n = 900, out = [];
      for (let i = 0; i < n; i++) {
        const t = (TAU * i) / n;
        const x = 16 * Math.pow(Math.sin(t), 3);
        const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
        out.push({ x: x / 17, y: y / 17 });
      }
      return fitShape(out, 1);
    },
  });

  const note = reg('note', {
    name: '音符',
    build: () => outlineFromPrimitives([
      { type: 'disk', x: -0.34, y: -0.6, r: 0.34 },
      { type: 'seg', x1: 0.04, y1: -0.55, x2: 0.04, y2: 0.95, r: 0.085 },
      { type: 'seg', x1: 0.04, y1: 0.95, x2: 0.58, y2: 0.62, r: 0.07 },
      { type: 'seg', x1: 0.58, y1: 0.62, x2: 0.66, y2: 0.4, r: 0.06 },
    ], { res: 330 }),
  });

  /* ---------- 自然形 ---------- */
  const maple = reg('maple', {
    name: '枫叶',
    build: () => {
      const half = [
        [0, 1.06], [0.05, 0.86], [0.07, 0.68], [0.17, 0.6],
        [0.27, 0.68], [0.5, 0.66], [0.44, 0.54], [0.63, 0.57],
        [0.34, 0.41], [0.5, 0.34], [0.79, 0.3], [0.71, 0.19],
        [0.97, 0.11], [0.41, 0.0], [0.31, -0.14], [0.35, -0.4],
        [0.23, -0.55], [0.13, -0.94], [0, -1.02],
      ];
      const pts = half.map((p) => [p[0], p[1]]);
      for (let i = half.length - 2; i >= 1; i--) pts.push([-half[i][0], half[i][1]]);
      const smooth = catmullRomClosed(pts, 14);
      return fitShape(resampleClosed(smooth, 1200), 1);
    },
  });

  const goldfish = reg('goldfish', {
    name: '金鱼',
    build: () => {
      const ctrl = [
        [-0.95, -0.18], [-0.55, -0.5], [-0.15, -0.62], [0.08, -0.95], [0.3, -0.6],
        [0.62, -0.5], [0.92, -0.3], [1.12, -0.08], [0.95, 0.14], [0.7, 0.34],
        [0.32, 0.52], [-0.15, 0.55], [-0.08, 0.88], [-0.42, 0.5],
        [-0.8, 0.3], [-1.45, 0.72], [-1.12, 0.05], [-1.5, -0.62], [-1.05, -0.4],
      ];
      const pts = catmullRomClosed(ctrl, 18);
      return fitShape(resampleClosed(pts, 1024), 1);
    },
  });

  const butterfly = reg('butterfly', {
    name: '蝴蝶',
    build: () => outlineFromPrimitives([
      { type: 'seg', x1: 0, y1: -0.6, x2: 0, y2: 0.6, r: 0.06 },
      { type: 'disk', x: 0, y: -0.66, r: 0.085 },
      { type: 'ellipse', x: -0.47, y: -0.2, rx: 0.47, ry: 0.27, rot: -0.5 },
      { type: 'ellipse', x: 0.47, y: -0.2, rx: 0.47, ry: 0.27, rot: 0.5 },
      { type: 'ellipse', x: -0.36, y: 0.4, rx: 0.31, ry: 0.24, rot: 0.62 },
      { type: 'ellipse', x: 0.36, y: 0.4, rx: 0.31, ry: 0.24, rot: -0.62 },
    ], { res: 400, margin: 0.06, smooth: 2 }),
  });

  /* ---------- 复杂形 ---------- */
  function spiralPrims(arms, turns, r0, r1, wStart, wEnd, steps) {
    const prims = [];
    for (let a = 0; a < arms; a++) {
      const base = (a / arms) * TAU;
      let prev = null;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const th = base + t * turns * TAU;
        const rr = r0 + (r1 - r0) * Math.pow(t, 0.9);
        const p = { x: rr * Math.cos(th), y: rr * Math.sin(th) };
        const w = wStart + (wEnd - wStart) * t;
        if (prev) prims.push({ type: 'seg', x1: prev.x, y1: prev.y, x2: p.x, y2: p.y, r: w });
        prev = p;
      }
    }
    return prims;
  }

  const galaxy = reg('galaxy', {
    name: '螺旋星系',
    build: () => {
      const prims = spiralPrims(2, 2.15, 0.08, 1.05, 0.15, 0.035, 80);
      prims.push({ type: 'disk', x: 0, y: 0, r: 0.2 });
      return outlineFromPrimitives(prims, { res: 320, margin: 0.06, smooth: 2 });
    },
  });

  const snowflake = reg('snowflake', {
    name: '雪花',
    build: () => {
      const prims = [];
      const R = 1.06;
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i * TAU) / 6;
        const c = Math.cos(a), s = Math.sin(a);
        prims.push({ type: 'seg', x1: 0, y1: 0, x2: R * c, y2: R * s, r: 0.045 });
        for (const f of [0.46, 0.72]) {
          const bx = R * f * c, by = R * f * s;
          for (const side of [-1, 1]) {
            const ba = a + side * 0.72;
            const len = 0.34 * (1 - f * 0.5);
            prims.push({ type: 'seg', x1: bx, y1: by, x2: bx + len * Math.cos(ba), y2: by + len * Math.sin(ba), r: 0.035 });
          }
        }
      }
      return outlineFromPrimitives(prims, { res: 420, margin: 0.1, smooth: 1 });
    },
  });

  const badge = reg('badge', {
    name: '复杂徽章',
    build: () => {
      const out = polarPoints((a) => {
        const u = ((a * 16) / TAU) % 1;
        const tri = 2 * Math.abs(2 * u - 1) - 1;
        let da = a - Math.PI / 2;
        da = Math.atan2(Math.sin(da), Math.cos(da));
        const ribbon = 0.24 * Math.exp(-Math.pow(da / 0.17, 2));
        return 0.66 + 0.1 * tri + 0.04 * Math.cos(6 * a + 0.35) +
          0.02 * Math.cos(10 * a + 1.1) + ribbon;
      }, 1600);
      return fitShape(out, 1);
    },
  });

  const nightSwirl = reg('nightSwirl', {
    name: '星夜回旋',
    build: () => {
      const prims = spiralPrims(1, 2.55, 0.06, 1.06, 0.16, 0.045, 130);
      // 沿外圈点缀“星”圆点（与旋臂相连，轮廓上形成鼓包）
      const starT = [0.42, 0.52, 0.61, 0.7, 0.79, 0.87, 0.95];
      for (let i = 0; i < starT.length; i++) {
        const t = starT[i];
        const th = t * 2.55 * TAU;
        const rr = 0.06 + (1.06 - 0.06) * Math.pow(t, 0.9);
        prims.push({ type: 'disk', x: rr * Math.cos(th), y: rr * Math.sin(th), r: 0.05 + (i % 3) * 0.018 });
      }
      return outlineFromPrimitives(prims, { res: 360, margin: 0.07, smooth: 2 });
    },
  });

  const mandala = reg('mandala', {
    name: '星海曼陀罗',
    build: () => {
      const out = polarPoints((a) => 0.68 + 0.1 * Math.cos(24 * a) + 0.055 * Math.cos(12 * a + 0.5) +
        0.035 * Math.cos(36 * a + 1.3) + 0.02 * Math.sin(48 * a + 0.7) + 0.014 * Math.cos(60 * a) +
        0.012 * Math.sin(7 * a + 0.2), 1600);
      return fitShape(out, 1);
    },
  });

  const defs = {
    circle, ellipse, offsetCircle, twin, square, triangle, hexagon, star8, letterA,
    gong, heart, note, maple, goldfish, butterfly, galaxy, snowflake, badge, nightSwirl, mandala,
  };

  function get(id) {
    if (cache.has(id)) return cache.get(id);
    const def = defs[id];
    if (!def) throw new Error('未知图形: ' + id);
    const pts = resampleClosed(def.build(), 1024);
    cache.set(id, pts);
    return pts;
  }

  /** 由复系数配方直接生成闭合曲线：z(t)=Σ a_k e^{i(2πkt+φ)} */
  function spectrumShape(coeffs, n = 1024) {
    const out = new Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / n;
      let x = 0, y = 0;
      for (const c of coeffs) {
        const ang = TAU * c.k * t + (c.phase || 0);
        x += c.amp * Math.cos(ang);
        y += c.amp * Math.sin(ang);
      }
      out[i] = { x, y };
    }
    return out;
  }

  /* ---------- 每日一形：程序化随机图形 ---------- */
  function randomShape(seed) {
    const rng = C.mulberry32(seed);
    const kind = Math.floor(rng() * 5);
    const rot = rng() * TAU;
    if (kind === 0) {
      const n = 3 + Math.floor(rng() * 7);
      const R = 0.95 + rng() * 0.2;
      const inner = 0.32 + rng() * 0.36;
      return {
        name: `${n}芒星`,
        build: () => fitShape(starPolygon(n, R, R * inner, rot), 1),
      };
    }
    if (kind === 1) {
      const terms = [];
      const count = 2 + Math.floor(rng() * 3);
      for (let i = 0; i < count; i++) {
        terms.push({
          k: 2 + Math.floor(rng() * 10),
          amp: 0.06 + rng() * 0.2,
          phase: rng() * TAU,
        });
      }
      return {
        name: '谐波花',
        build: () => {
          const out = polarPoints((a) => {
            let r = 0.62;
            for (const t of terms) r += t.amp * Math.cos(t.k * a + t.phase);
            return Math.max(0.16, r);
          }, 1400);
          return fitShape(out, 1);
        },
      };
    }
    if (kind === 2) {
      const turns = 1.5 + rng() * 1.4;
      return {
        name: '回旋',
        build: () => outlineFromPrimitives(spiralPrims(1, turns, 0.06, 1.0, 0.14, 0.04, 110),
          { res: 340, margin: 0.08, smooth: 2 }),
      };
    }
    if (kind === 3) {
      const n = 5 + Math.floor(rng() * 5);
      const pts = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + rot * 0.2;
        const r = 0.72 + rng() * 0.35;
        pts.push([r * Math.cos(a), r * Math.sin(a)]);
      }
      return {
        name: '碎石多边形',
        build: () => fitShape(resampleClosed(catmullRomClosed(pts, 10), 1024), 1),
      };
    }
    const n = 9 + Math.floor(rng() * 5);
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const r = 0.6 + rng() * 0.42;
      pts.push([r * Math.cos(a), r * Math.sin(a)]);
    }
    return {
      name: '有机形',
      build: () => fitShape(resampleClosed(catmullRomClosed(pts, 12), 1024), 1),
    };
  }

  HP.shapes = {
    defs, get, ids: Object.keys(defs), spectrumShape, randomShape, spiralPrims,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
