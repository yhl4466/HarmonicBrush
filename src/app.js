/* =========================================================
 * 谐波画笔 · 主应用 app.js
 * 存档 / 路由 / 首页 / 战役地图 / 读谱师 / 每日 / 图库 / 成就 / 设置
 * ========================================================= */
(function (global) {
  'use strict';
  const HP = (global.HP = global.HP || {});
  const C = HP.core, D = HP.data, S = HP.shapes, R = HP.render, U = HP.ui;
  const { h } = U;
  const TAU = Math.PI * 2;
  const SAVE_KEY = 'harmonicbrush.save.v1';
  const BACKUP_KEY = SAVE_KEY + '.backup';
  const APP_VERSION = '1.0.0';
  const BUILD_DATE = '2026-10-17';
  const UPDATE_DEFAULT = 'https://harmonic-brush.pages.dev/version.json';
  const UPDATE_FALLBACK = 'https://yhl4466.github.io/HarmonicBrush/version.json';
  const CHANGELOG = [
    { version: '1.0.0', date: '2026-10-17', notes: [
      '测试版：版本号回退到 1.0.0，用于验证「检查更新 / 更新说明 / 下载新版」流程',
      '界面与功能延续 v1.6.0；存档沿用，可导出 / 导入与恢复自动备份',
      '播放页固定全屏 + 可收起的底部抽屉，切换页签时画布不变形',
    ] },
    { version: '1.6.0', date: '2026-10-17', notes: [
      '播放页固定全屏（100vh），修复 Android WebView 压矮画布、下半屏黑块',
      '手机端频谱面板改为可收起的底部抽屉（频谱 / 系数 / 添加），切换页签时画布不再变形',
      '底部操作收成一行；提示按布局显示「下方 / 右侧 k 面板」',
      '手机首页双列 + 底部导航；横屏仪表盘；工坊 / 关卡 / 沙盒统一',
      'Android 自定义自适应图标与深色启动图',
      '新增版本与更新：检查更新、更新说明、下载入口；新增存档导出 / 导入与自动备份，更新前后都可保留进度',
    ] },
    { version: '1.5.0', date: '2026-10-15', notes: [
      '频谱工坊 91 关、读谱 24 题、9 节讲义与每日一形',
      '外观改为工坊进度解锁；战役 20 关保留为反向练习',
      'Electron 便携 exe 与 Capacitor Android 工程',
    ] },
  ];

  /* ========================= 存档 ========================= */
  function defaultSave() {
    return {
      v: 1,
      levels: {},
      reading: {},
      achievements: {},
      unlocks: { brushes: ['glow'], themes: ['scope'], trails: ['basic'] },
      settings: {
        sound: true, snap: false, reduced: false,
        theme: 'scope', brush: 'glow', trail: 'basic', showGhost: true,
        updateSource: UPDATE_DEFAULT,
      },
      daily: { date: '', stars: 0, err: null, count: 0, time: 0, streak: 0, lastDate: '' },
      workshop: {},
      lessons: {},
      stats: { plays: 0, time: 0, bestErr: null },
    };
  }

  function mergeSave(def, raw) {
    if (!raw || typeof raw !== 'object') return def;
    const out = def;
    if (raw.levels && typeof raw.levels === 'object') {
      for (const id of Object.keys(raw.levels)) {
        const r = raw.levels[id];
        if (r && typeof r === 'object') {
          out.levels[id] = {
            stars: C.clamp(r.stars || 0, 0, 3),
            err: typeof r.err === 'number' ? r.err : null,
            count: r.count || 0,
            time: r.time || 0,
            plays: r.plays || 0,
          };
        }
      }
    }
    if (raw.reading && typeof raw.reading === 'object') out.reading = { ...raw.reading };
    if (raw.achievements && typeof raw.achievements === 'object') out.achievements = { ...raw.achievements };
    if (raw.unlocks) {
      for (const k of ['brushes', 'themes', 'trails']) {
        if (Array.isArray(raw.unlocks[k])) out.unlocks[k] = raw.unlocks[k].filter((x) => typeof x === 'string');
      }
    }
    if (raw.settings && typeof raw.settings === 'object') {
      out.settings = { ...def.settings, ...raw.settings };
      for (const k of ['sound', 'snap', 'reduced', 'showGhost']) out.settings[k] = !!out.settings[k];
    }
    if (raw.daily && typeof raw.daily === 'object') out.daily = { ...def.daily, ...raw.daily };
    if (raw.workshop && typeof raw.workshop === 'object') out.workshop = { ...raw.workshop };
    if (raw.lessons && typeof raw.lessons === 'object') out.lessons = { ...raw.lessons };
    if (raw.stats && typeof raw.stats === 'object') out.stats = { ...def.stats, ...raw.stats };
    return out;
  }

  function loadSave() {
    try {
      const raw = global.localStorage.getItem(SAVE_KEY);
      if (!raw) return defaultSave();
      return mergeSave(defaultSave(), JSON.parse(raw));
    } catch (e) {
      return defaultSave();
    }
  }

  function persist() {
    try { global.localStorage.setItem(SAVE_KEY, JSON.stringify(app.save)); } catch (e) { /* 隐私模式 */ }
  }

  /* ========================= 存档备份 / 导出 / 导入 ========================= */
  function backupSave() {
    try {
      global.localStorage.setItem(BACKUP_KEY, JSON.stringify({ at: Date.now(), version: APP_VERSION, save: app.save }));
    } catch (e) { /* noop */ }
  }

  function restoreBackup() {
    let raw = null;
    try { raw = global.localStorage.getItem(BACKUP_KEY); } catch (e) {}
    if (!raw) { U.toast('还没有自动备份'); return; }
    let data = null;
    try { data = JSON.parse(raw); } catch (e) {}
    const at = data && data.at ? new Date(data.at).toLocaleString() : '上次';
    U.modal(h('div', { class: 'modal card' },
      h('h2', {}, '恢复自动备份？'),
      h('p', {}, `备份时间：${at}。会用这份备份替换当前进度（当前进度会再备份一次）。`),
      h('div', { class: 'modal-actions' },
        U.btn('恢复', { kind: 'primary', onClick: () => {
          backupSave();
          app.save = mergeSave(defaultSave(), (data && data.save) || {});
          persist(); applySettings(); refreshUnlocks(false);
          U.closeModal(); renderRoute(); U.toast('已恢复自动备份');
        } }),
        U.btn('取消', { kind: 'ghost', onClick: () => U.closeModal() }))));
  }

  function exportSave() {
    try {
      const data = { app: '谐波画笔', version: APP_VERSION, exportedAt: new Date().toISOString(), save: app.save };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      const d = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      a.download = `harmonicbrush-save-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      U.toast('存档已导出');
    } catch (e) { U.toast('导出失败，请換个浏览器试试'); }
  }

  function importSave(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const raw = parsed && parsed.save ? parsed.save : parsed;
        if (!raw || typeof raw !== 'object' || !raw.levels || !raw.reading) throw new Error('bad save');
        U.modal(h('div', { class: 'modal card' },
          h('h2', {}, '导入存档？'),
          h('p', {}, '将用文件里的进度替换当前存档（关卡、工坊、读谱、成就、外观）。当前进度会先自动备份。'),
          h('div', { class: 'modal-actions' },
            U.btn('导入并替换', { kind: 'primary', onClick: () => {
              backupSave();
              app.save = mergeSave(defaultSave(), raw);
              persist(); applySettings(); refreshUnlocks(false);
              U.closeModal(); renderRoute(); U.toast('存档已导入');
            } }),
            U.btn('取消', { kind: 'ghost', onClick: () => U.closeModal() }))));
      } catch (e) { U.toast('文件不是有效的存档'); }
    };
    reader.readAsText(file);
  }

  /* ========================= 版本更新 ========================= */
  function semverGt(a, b) {
    const pa = String(a || '0').split('.').map(Number);
    const pb = String(b || '0').split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      const x = Number.isFinite(pa[i]) ? pa[i] : 0;
      const y = Number.isFinite(pb[i]) ? pb[i] : 0;
      if (x !== y) return x > y;
    }
    return false;
  }

  function updateStatusText() {
    if (app.updateStatus === 'checking') return '检查中…';
    if (app.updateStatus === 'available' && app.updateLatest) return '发现 v' + app.updateLatest.version;
    if (app.updateStatus === 'latest') return '已是最新';
    if (app.updateStatus === 'failed') return '检查失败';
    return '未检查';
  }

  async function checkUpdate() {
    const primary = (app.save.settings.updateSource || UPDATE_DEFAULT).trim() || UPDATE_DEFAULT;
    const sources = [primary, UPDATE_FALLBACK].filter((v, i, a) => v && a.indexOf(v) === i);
    app.updateStatus = 'checking';
    U.toast('正在检查更新…');
    renderRoute();
    for (const src of sources) {
      try {
        const res = await fetch(src, { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        app.updateLatest = data;
        app.updateBase = new URL(src, location.href).href;
        app.updateCheckedAt = Date.now();
        app.updateStatus = semverGt(data.version, APP_VERSION) ? 'available' : 'latest';
        U.toast(app.updateStatus === 'available' ? '发现新版本 v' + data.version : '已是最新版本 v' + APP_VERSION);
        renderRoute();
        return;
      } catch (e) { /* 试下一个源 */ }
    }
    app.updateStatus = 'failed';
    U.toast('检查失败：国内镜像与 GitHub 备用源都连不上');
    renderRoute();
  }

  function downloadUpdate() {
    const d = app.updateLatest;
    if (!d) { U.toast('先点「检查更新」'); return; }
    const ua = navigator.userAgent || '';
    let url = '';
    if (/Android/i.test(ua) && d.apk) url = d.apk;
    else if (/Electron/i.test(ua) && d.exe) url = d.exe;
    else url = d.url || d.exe || d.apk || '';
    if (!url) { U.toast('该版本没有提供下载地址'); return; }
    const base = app.updateBase || location.href;
    try { global.open(new URL(url, base).href, '_blank'); } catch (e) { global.open(url, '_blank'); }
    U.toast('已打开下载；安装前可先导出存档，更新不会清空进度');
  }

  function showChangelog() {
    U.modal(h('div', { class: 'modal card update-modal' },
      h('h2', {}, '更新说明'),
      h('p', { class: 'muted' }, `当前 v${APP_VERSION} · ${BUILD_DATE}`),
      h('div', { class: 'changelog' }, CHANGELOG.map((c) => h('section', {},
        h('h3', {}, `v${c.version} · ${c.date}`),
        h('ul', {}, c.notes.map((n) => h('li', {}, n)))))),
      h('div', { class: 'modal-actions' }, U.btn('关闭', { kind: 'primary', onClick: () => U.closeModal() }))));
  }

  const app = {
    save: null,
    play: null,
    ambient: null,
    dailyCache: null,
    readingId: null,
    lessonDemo: null,
    ws: { tab: 'tutorial', chapter: 1 },
    customPuzzle: null,
    galleryTab: 'campaign',
    updateLatest: null,
    updateStatus: '',
    updateCheckedAt: 0,
    updateBase: '',
  };

  /* ========================= 通用 ========================= */
  const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const yesterdayStr = () => {
    const d = new Date(Date.now() - 86400000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  function totalStars() {
    return Object.values(app.save.levels).reduce((s, x) => s + (x.stars || 0), 0);
  }
  function clearedCount() {
    return Object.values(app.save.levels).filter((x) => (x.stars || 0) >= 1).length;
  }
  function chapterCleared(n) {
    return D.chapterLevels(n).every((id) => ((app.save.levels[id] || {}).stars || 0) >= 1);
  }
  function chapterStars(n) {
    return D.chapterLevels(n).reduce((s, id) => s + ((app.save.levels[id] || {}).stars || 0), 0);
  }
  function isLevelUnlocked(id) {
    const lv = D.LEVELS[id];
    if (!lv) return false;
    if (lv.chapter > 1 && !chapterCleared(lv.chapter - 1)) return false;
    if (lv.index === 0) return true;
    const prev = D.chapterLevels(lv.chapter)[lv.index - 1];
    return ((app.save.levels[prev] || {}).stars || 0) >= 1;
  }
  function nextPlayable() {
    for (const id of D.levelIds()) {
      if (isLevelUnlocked(id) && ((app.save.levels[id] || {}).stars || 0) < 3) return id;
    }
    return D.levelIds()[0];
  }
  function achievedCount() {
    return Object.keys(app.save.achievements).length;
  }

  function navigate(path) {
    const target = '#/' + path.replace(/^#?\/?/, '');
    if (location.hash === target) renderRoute();
    else location.hash = target;
  }

  function topbar(opts = {}) {
    const right = opts.right || null;
    return h('header', { class: 'topbar' },
      opts.back
        ? U.iconBtn('←', { title: '返回', onClick: opts.back })
        : h('div', { class: 'brand' }, logoMark(), h('span', {}, '谐波画笔')),
      h('div', { class: 'topbar-title' }, opts.title || ''),
      h('div', { class: 'topbar-space' }),
      h('div', { class: 'star-total', title: '累计星数' }, h('span', { class: 's' }, '★'), String(totalStars())),
      right);
  }

  function logoMark() {
    return h('span', { class: 'logo-mark', html: '<svg viewBox="0 0 40 40" width="30" height="30" aria-hidden="true"><circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" stroke-opacity=".35" stroke-width="1.2"/><circle cx="20" cy="20" r="10" fill="none" stroke="currentColor" stroke-opacity=".6" stroke-width="1.4"/><circle cx="20" cy="20" r="3.2" fill="currentColor"/><circle cx="30" cy="20" r="2.2" fill="currentColor" fill-opacity=".9"/></svg>' });
  }

  /* ========================= 启动 ========================= */
  const DEV = new URLSearchParams(global.location.search);
  const dev = {
    screen: DEV.get('screen'),
    level: DEV.get('level'),
    id: DEV.get('id'),
    wtab: DEV.get('wtab'),
    wch: DEV.get('wch') ? parseInt(DEV.get('wch'), 10) : null,
    gtab: DEV.get('gtab'),
    sandboxWorkshop: DEV.get('sw') === '1',
    demo: DEV.get('demo') === '1',
    settle: DEV.get('settle') === '1',
    t: parseFloat(DEV.get('t') || '0.78'),
    k: DEV.get('k') ? parseInt(DEV.get('k'), 10) : null,
    theme: DEV.get('theme'),
    reset: DEV.get('reset') === '1',
    selftest: DEV.get('selftest') === '1',
    check: DEV.get('check') === '1',
    answer: DEV.get('answer') === '1',
    sample: DEV.get('sample') === '1',
  };

  function applySettings() {
    const s = app.save.settings;
    document.documentElement.dataset.theme = s.theme;
    document.documentElement.dataset.motion = s.reduced ? 'reduced' : 'full';
    U.audio.enabled = !!s.sound;
  }

  /* ========================= 首页 ========================= */
  function renderHome(screen) {
    const save = app.save;
    const stars = totalStars();
    const cleared = clearedCount();
    const nextId = nextPlayable();
    const today = todayStr();
    const dailyDone = save.daily.date === today && (save.daily.stars || 0) > 0;
    const solved = Object.keys(save.reading).length;
    const cat = HP.workshop.CATALOG;
    const wsNext = (cat.all.find((p) => (((save.workshop[p.id] || {}).stars) || 0) < 1) || {}).id || null;
    const wsDone = cat.all.filter((p) => ((save.workshop[p.id] || {}).stars || 0) > 0).length;
    const heroCv = h('canvas', { class: 'hero-canvas', dataset: { w: 420, h: 420 } });

    const hero = h('section', { class: 'hero' },
      h('div', { class: 'hero-copy' },
        h('div', { class: 'eyebrow' }, 'FOURIER DRAWING GAME'),
        h('h1', { class: 'hero-title' }, '谐波', h('span', {}, '画笔')),
        h('p', { class: 'hero-tagline' }, '给你一组频率，', h('br'), '让旋转的圆拼出目标图像。'),
        h('p', { class: 'hero-sub' }, '不画线，只调配谐波：用幅度与相位拼出目标形状。7 教程 + 60 正式 + 24 超难。'),
        h('div', { class: 'hero-actions' },
          U.btn(wsNext ? '继续调配 · ' + cat.byId.get(wsNext).no : '工坊全通', { kind: 'primary lg', onClick: () => navigate(wsNext ? 'workshop/' + wsNext : 'workshop') }),
          U.btn(nextId ? '战役 · ' + nextId : '战役地图', { kind: 'ghost lg', onClick: () => navigate(nextId ? 'play/level/' + nextId : 'map') })),
        h('div', { class: 'hero-stats' },
          h('span', {}, h('b', {}, String(wsDone)), ' / ' + cat.total + ' 配方'),
          h('i'),
          h('span', {}, h('b', {}, String(stars)), ' / 60 战役星'),
          h('i'),
          h('span', {}, h('b', {}, String(achievedCount())), ' 个成就'))),
      h('div', { class: 'hero-art' }, heroCv,
        h('div', { class: 'hero-caption' }, h('span', {}, '实时谐波合成'))));

    const modeCampaign = h('button', { class: 'mode-card', onclick: () => navigate('map') },
      h('div', { class: 'mode-icon' }, '✺'),
      h('div', { class: 'mode-body' },
        h('div', { class: 'mode-kicker' }, 'CAMPAIGN'),
        h('h3', {}, '战役 · 谐波学院'),
        h('p', {}, '反向练习：先画一笔，再看它拆成哪些圆。五章 20 关。'),
        h('div', { class: 'mode-bar' }, h('i', { style: { width: (cleared / 20) * 100 + '%' } })),
        h('div', { class: 'mode-foot' }, h('span', {}, `${cleared} / 20 关`), h('span', {}, `★ ${stars} / 60`))),
      h('div', { class: 'mode-arrow' }, '→'));

    const modeSandbox = h('button', { class: 'mode-card', onclick: () => navigate('play/sandbox') },
      h('div', { class: 'mode-icon' }, '∿'),
      h('div', { class: 'mode-body' },
        h('div', { class: 'mode-kicker' }, 'SANDBOX'),
        h('h3', {}, '自由绘'),
        h('p', {}, '反向沙盒：先画一笔，看它拆成哪些圆；可把笔迹带进工坊继续调。'),
        h('div', { class: 'mode-foot' }, h('span', {}, '实时频谱'), h('span', {}, '500 圆'))),
      h('div', { class: 'mode-arrow' }, '→'));

    const modeReading = h('button', { class: 'mode-card', onclick: () => navigate('reading') },
      h('div', { class: 'mode-icon' }, '▤'),
      h('div', { class: 'mode-body' },
        h('div', { class: 'mode-kicker' }, 'SPECTRUM'),
        h('h3', {}, '读谱师'),
        h('p', {}, '24 题，四种题型：读谱选形、看形选谱、找缺失、数圆。'),
        h('div', { class: 'mode-bar' }, h('i', { style: { width: (solved / D.READINGS.length) * 100 + '%' } })),
        h('div', { class: 'mode-foot' }, h('span', {}, `${solved} / ${D.READINGS.length} 题`), h('span', {}, '频谱直觉'))),
      h('div', { class: 'mode-arrow' }, '→'));

    const modeDaily = h('button', { class: 'mode-card', onclick: () => navigate('daily') },
      h('div', { class: 'mode-icon' }, '☀'),
      h('div', { class: 'mode-body' },
        h('div', { class: 'mode-kicker' }, 'DAILY'),
        h('h3', {}, '每日一形'),
        h('p', {}, '每天一个配方，同一个日期全世界同一形。'),
        h('div', { class: 'mode-foot' },
          h('span', {}, dailyDone ? `今日已挑战 · ★${save.daily.stars || 0}` : '今日待挑战'),
          h('span', {}, `连续 ${save.daily.streak || 0} 天`))),
      h('div', { class: 'mode-arrow' }, '→'));

    const modeVersus = h('button', { class: 'mode-card disabled', onclick: () => U.toast('圆舞对决在研中，敬请期待') },
      h('div', { class: 'mode-icon' }, '⚔'),
      h('div', { class: 'mode-body' },
        h('div', { class: 'mode-kicker' }, 'VERSUS'),
        h('h3', {}, '圆舞对决'),
        h('p', {}, '双人同时调同一组频率，拼出目标图像，比拼速度与精度。'),
        h('div', { class: 'mode-foot' }, h('span', {}, '远期计划'), h('span', { class: 'tag' }, '研发中'))),
      h('div', { class: 'mode-arrow' }, '…'));

    const modeWorkshop = h('button', { class: 'mode-card campaign', onclick: () => navigate('workshop') },
      h('div', { class: 'mode-icon' }, '◈'),
      h('div', { class: 'mode-body' },
        h('div', { class: 'mode-kicker' }, 'MAIN · HARDCORE'),
        h('h3', {}, '频谱工坊'),
        h('p', {}, '不画线，只调配 cₖ：7 教程 + 60 正式 + 24 超难，每一关都是一组能拼出目标的谐波。'),
        h('div', { class: 'mode-bar' }, h('i', { style: { width: (wsDone / cat.total) * 100 + '%' } })),
        h('div', { class: 'mode-foot' }, h('span', {}, `${wsDone} / ${cat.total} 配方`), h('span', { class: 'tag' }, '主玩法'))),
      h('div', { class: 'mode-arrow' }, '→'));

    const lessonsDone = Object.keys(save.lessons).length;
    const lessonsTotal = HP.lessons.LESSONS.length;
    const modeLessons = h('button', { class: 'mode-card lessons', onclick: () => navigate('lessons') },
      h('div', { class: 'mode-icon' }, '∑'),
      h('div', { class: 'mode-body' },
        h('div', { class: 'mode-kicker' }, 'FOURIER NOTES'),
        h('h3', {}, '傅里叶讲义'),
        h('p', {}, '9 节交互式数学课：从复指数、共轭对，到吉布斯现象与采样混叠，每一节都能亲手拖。'),
        h('div', { class: 'mode-bar' }, h('i', { style: { width: (lessonsDone / lessonsTotal) * 100 + '%' } })),
        h('div', { class: 'mode-foot' }, h('span', {}, `${lessonsDone} / ${lessonsTotal} 节`), h('span', {}, '公式 + 实时演示'))),
      h('div', { class: 'mode-arrow' }, '→'));

    screen.replaceChildren(h('div', { class: 'screen home' },
      topbar({ right: h('div', { class: 'top-actions' },
        h('button', { class: 'text-btn', onclick: () => navigate('gallery') }, '图库'),
        h('button', { class: 'text-btn', onclick: () => navigate('achievements') }, '成就'),
        U.iconBtn('⚙', { title: '设置', onClick: () => navigate('settings') })) }),
      hero,
      h('section', { class: 'modes' }, modeWorkshop, modeCampaign, modeLessons, modeSandbox, modeReading, modeDaily, modeVersus),
      h('footer', { class: 'home-foot' },
        h('span', {}, '《谐波画笔》· 用旋转的圆画出任意形状 · 离线可玩 · v' + APP_VERSION + ' · 测试版'),
        h('span', {}, '圆 = 一个频率分量 · 半径 = 幅度 · 转角 = 相位'))));

    startAmbient(heroCv);
  }

  function startAmbient(canvas) {
    if (app.ambient) { app.ambient.stop(); app.ambient = null; }
    if (app.save.settings.reduced) return;
    let pts;
    try { pts = S.get('heart'); } catch (e) { return; }
    const ana = C.analyse(pts, C.SAMPLE_N);
    const indices = C.topIndices(ana, 26);
    const loop = C.reconPoints(C.reconstruct(ana, indices, 900), 900);
    const prep = C.prepareTarget(pts);
    const renderer = new R.Renderer(canvas);
    renderer.setTheme(app.save.settings.theme);
    renderer.brush = 'glow';
    let t = 0.42, last = 0, raf = 0;
    const fit = () => { renderer.resize(); renderer.fit(prep.bbox, 0.4, 12); };
    fit();
    const frame = (now) => {
      if (!last) last = now;
      const dt = Math.min(0.06, (now - last) / 1000);
      last = now;
      t = (t + dt * 0.055) % 1;
      renderer.clear();
      renderer.drawGhost(pts, { alpha: 0.2, dash: [4, 6] });
      renderer.drawTrail(loop, t, { fullAlpha: 0.09 });
      renderer.drawChain({ ana, indices, t });
    };
    const loopFn = (now) => { frame(now); raf = requestAnimationFrame(loopFn); };
    raf = requestAnimationFrame(loopFn);
    const onResize = () => { fit(); };
    global.addEventListener('resize', onResize);
    app.ambient = {
      stop() {
        cancelAnimationFrame(raf);
        global.removeEventListener('resize', onResize);
      },
    };
  }

  /* ========================= 战役地图 ========================= */
  function levelNode(id, chapterColor) {
    const lv = D.LEVELS[id];
    const rec = app.save.levels[id] || {};
    const unlocked = isLevelUnlocked(id);
    const cv = h('canvas', { class: 'node-canvas', dataset: { w: 88, h: 88 } });
    const node = h('button', {
      class: 'level-node' + (lv.boss ? ' boss' : '') + (unlocked ? '' : ' locked') + (rec.stars ? ' cleared' : ''),
      style: { '--ch': chapterColor },
      onclick: () => {
        if (!unlocked) {
          U.toast(lv.chapter > 1 && !chapterCleared(lv.chapter - 1) ? '先通关上一章' : '先通过上一关');
          return;
        }
        navigate('play/level/' + id);
      },
    },
      h('div', { class: 'node-thumb' }, cv, lv.boss ? h('span', { class: 'boss-badge' }, 'BOSS') : null,
        unlocked ? null : h('span', { class: 'lock' }, '⌑')),
      h('div', { class: 'node-meta' },
        h('span', { class: 'node-id' }, id),
        h('b', { class: 'node-name' }, lv.name),
        U.starsRow(rec.stars || 0, 'small'),
        h('span', { class: 'node-best' }, rec.err != null ? C.formatPct(rec.err, 1) + ' · ' + rec.count + ' 圆' : (unlocked ? '未挑战' : '未解锁'))));
    if (unlocked) queuePaint(cv, S.get(lv.shape), { color: chapterColor, width: 2, glow: 8, fill: false });
    return node;
  }

  function renderMap(screen) {
    const chapters = D.CHAPTERS.map((ch) => {
      const ids = D.chapterLevels(ch.id);
      const locked = ch.id > 1 && !chapterCleared(ch.id - 1);
      const cleared = chapterCleared(ch.id);
      return h('section', { class: 'chapter' + (locked ? ' locked' : '') + (cleared ? ' cleared' : ''), style: { '--ch': ch.color, '--ch2': ch.accent } },
        h('div', { class: 'chapter-head' },
          h('div', { class: 'chapter-no' }, String(ch.id).padStart(2, '0')),
          h('div', { class: 'chapter-titles' },
            h('h2', {}, ch.name, cleared ? h('span', { class: 'cleared-tag' }, '已通关') : null),
            h('p', {}, ch.subtitle)),
          h('div', { class: 'chapter-stars' }, h('span', { class: 's' }, '★'), `${chapterStars(ch.id)} / 12`),
          locked ? h('div', { class: 'chapter-lock' }, '通关上一章解锁') : null),
        h('div', { class: 'level-row' }, ids.map((id) => levelNode(id, ch.color))),
        h('p', { class: 'chapter-desc' }, ch.desc));
    });
    screen.replaceChildren(h('div', { class: 'screen map' },
      topbar({ back: () => navigate('home'), title: '战役 · 谐波学院' }),
      h('div', { class: 'map-hero' },
        h('div', {},
          h('div', { class: 'eyebrow' }, 'CAMPAIGN'),
          h('h1', {}, '谐波学院'),
          h('p', {}, '反向练习场：先描出目标，再看它被拆成哪些圆。每一关只讲一个知识点，从「一个圆」到「五百个圆」。主玩法在频谱工坊。'),
          h('div', { class: 'map-actions' },
            U.btn('频谱工坊 · 91 关', { kind: 'ghost', onClick: () => navigate('workshop') }))),
        h('div', { class: 'map-progress' },
          h('div', { class: 'big-star' }, h('span', { class: 's' }, '★'), String(totalStars()), h('em', {}, '/ 60')),
          h('div', { class: 'bar' }, h('i', { style: { width: (totalStars() / 60) * 100 + '%' } })),
          h('span', { class: 'sub' }, `${clearedCount()} / 20 关通过`))),
      h('div', { class: 'chapter-list' }, chapters)));
  }

  /* ========================= 播放路由 ========================= */
  function openPlay(screen, kind, id) {
    let cfg;
    if (kind === 'level') {
      const lv = D.LEVELS[id];
      if (!lv) { navigate('map'); return; }
      if (!isLevelUnlocked(id) && !dev.screen) { U.toast('关卡尚未解锁'); navigate('map'); return; }
      cfg = {
        kind: 'level', level: lv, shapePts: S.get(lv.shape),
        budget: lv.budget, timeLimit: lv.timeLimit || 0, name: lv.name,
        showIntro: !app.save.levels[id] && !dev.demo,
        settings: app.save.settings, persist,
        onBack: (retry) => { if (retry) navigate('play/level/' + id); else navigate('map'); },
        onComplete: handleResult,
        onMilestone: handleMilestone,
      };
    } else if (kind === 'sandbox') {
      cfg = {
        kind: 'sandbox', name: '自由绘', budget: 500,
        settings: app.save.settings, persist,
        onBack: () => navigate('home'),
        onComplete: handleResult,
        onMilestone: handleMilestone,
        onToWorkshop: (p) => { app.customPuzzle = p; navigate('workshop/custom'); },
      };
    } else if (kind === 'daily') {
      return renderDailyPlay(screen);
    } else {
      navigate('map'); return;
    }
    app.play = HP.play.create(cfg).mount(screen);
    if (dev.sample && kind === 'sandbox') {
      setTimeout(() => { if (app.play && !app.play.destroyed) app.play.loadSample(); }, 300);
    }
    if (dev.sandboxWorkshop && kind === 'sandbox') {
      setTimeout(() => {
        if (!app.play || app.play.destroyed) return;
        const p = app.play.sandboxPuzzle();
        if (p) { app.customPuzzle = p; navigate('workshop/custom'); }
      }, 1000);
    }
    if (dev.demo && app.play.prep) {
      setTimeout(() => {
        if (!app.play || app.play.destroyed) return;
        app.play.demo(dev.t, dev.k);
        if (dev.check) {
          setTimeout(() => {
            document.title = 'CHECK:' + app.play.error.toFixed(5) + ':' + app.play.stars + ':' + app.play.selection.size;
          }, 200);
        }
        if (dev.settle) setTimeout(() => { if (app.play && !app.play.settled) app.play.settle(); }, 220);
      }, 80);
    }
  }

  function handleMilestone(key) {
    if (key === 'sandbox500') checkAchievements({ sandbox500: true });
  }

  /* ========================= 结算 ========================= */
  function starsWord(n) {
    return n >= 3 ? '三星达成' : n === 2 ? '完成挑战' : '过关';
  }

  function efficiencyGrade(count, budget) {
    if (!budget) return '—';
    const r = count / budget;
    if (r <= 0.35) return 'S';
    if (r <= 0.6) return 'A';
    if (r <= 0.85) return 'B';
    return 'C';
  }

  function handleResult(res) {
    const save = app.save;
    const today = todayStr();
    let isBest = false;
    let chapterDone = false;
    let prev = null;
    save.stats.plays += 1;
    save.stats.time += res.time || 0;
    if (save.stats.bestErr == null || res.error < save.stats.bestErr) save.stats.bestErr = res.error;

    if (res.kind === 'daily') {
      if (save.daily.date !== today) {
        save.daily = { ...save.daily, date: today, stars: 0, err: null, count: 0, time: 0 };
      }
      prev = { stars: save.daily.stars || 0, err: save.daily.err, count: save.daily.count, time: save.daily.time };
      isBest = !prev.stars || res.stars > prev.stars ||
        (res.stars === prev.stars && (res.error < (prev.err == null ? 9 : prev.err) - 1e-9 || (Math.abs(res.error - (prev.err || 0)) < 1e-9 && res.time < prev.time)));
      if (isBest) {
        save.daily.stars = res.stars;
        save.daily.err = res.error;
        save.daily.count = res.count;
        save.daily.time = res.time;
      }
      if (save.daily.lastDate !== today) {
        save.daily.streak = save.daily.lastDate === yesterdayStr() ? (save.daily.streak || 0) + 1 : 1;
        save.daily.lastDate = today;
      }
      save.daily.date = today;
    } else {
      const id = res.levelId;
      prev = save.levels[id] || null;
      const better = !prev || res.stars > (prev.stars || 0) ||
        (res.stars === (prev.stars || 0) && (res.error < (prev.err == null ? 9 : prev.err) - 1e-9 ||
          (Math.abs(res.error - (prev.err || 0)) < 1e-9 && res.time < (prev.time || 1e9))));
      isBest = better;
      save.levels[id] = better
        ? { stars: Math.max(res.stars, prev ? prev.stars || 0 : 0), err: res.error, count: res.count, time: res.time, plays: (prev ? prev.plays || 0 : 0) + 1 }
        : { ...prev, plays: (prev ? prev.plays || 0 : 0) + 1 };
      if (res.level && res.level.boss && res.stars >= 1) {
        chapterDone = true;
      }
    }

    const unlockedItems = refreshUnlocks();
    const newAch = checkAchievements({ result: res, isBest });
    persist();
    showResult(res, { isBest, unlockedItems, newAch, chapterDone });
  }

  function showResult(res, info) {
    const lv = res.level;
    const isDaily = res.kind === 'daily';
    const nextId = lv ? D.nextLevel(lv.id) : null;
    const nextLv = nextId ? D.LEVELS[nextId] : null;
    const title = starsWord(res.stars);
    const grade = efficiencyGrade(res.count, res.budget);
    const chapter = lv ? D.CHAPTERS.find((c) => c.id === lv.chapter) : null;

    let nextChapterLine = null;
    if (lv && lv.boss && res.stars >= 1) {
      const nch = D.CHAPTERS.find((c) => c.id === lv.chapter + 1);
      if (nch) nextChapterLine = h('div', { class: 'unlock-line' }, h('span', { class: 'unlock-icon' }, '✦'), `第 ${nch.id} 章「${nch.name}」已解锁`);
      else nextChapterLine = h('div', { class: 'unlock-line' }, h('span', { class: 'unlock-icon' }, '✦'), '全部五章通关！你已经能用圆画出一切。');
    }

    const starEls = [0, 1, 2].map((i) => h('span', {
      class: 'big-star' + (i < res.stars ? ' on' : ''),
      style: { animationDelay: 0.08 * i + 's' },
    }, '★'));

    const achEls = (info.newAch || []).map((id) => {
      const a = D.ACHIEVEMENTS.find((x) => x.id === id);
      return h('div', { class: 'unlock-line ach' }, h('span', { class: 'unlock-icon' }, a ? a.icon : '✦'), '成就 · ' + (a ? a.name : id));
    });
    const uqEls = (info.unlockedItems || []).map((u) =>
      h('div', { class: 'unlock-line' }, h('span', { class: 'unlock-icon' }, '◈'), '解锁 · ' + u.name + '（' + u.desc + '）'));

    const card = h('div', { class: 'modal card result-card' + (res.stars >= 3 ? ' three' : '') },
      h('div', { class: 'result-head' },
        h('div', { class: 'result-kicker' }, chapter ? `第 ${lv.chapter} 章 · ${chapter.name}` : isDaily ? '每日一形' : '自由绘'),
        h('div', { class: 'result-stars' }, starEls),
        h('h2', {}, title + (isDaily ? ' · 今日之形' : '')),
        h('p', { class: 'result-sub' }, (lv ? lv.name + ' · ' : '') +
          `误差 ${C.formatPct(res.error, 2)} · ${res.count} 圆 · ${C.formatTime(res.time * 1000)}`),
        info.isBest ? h('div', { class: 'new-record' }, '新纪录') : null),
      h('div', { class: 'result-grid' },
        h('div', {}, h('span', {}, '误差'), h('b', {}, C.formatPct(res.error, 2))),
        h('div', {}, h('span', {}, '圆数'), h('b', {}, res.count + ' / ' + res.budget)),
        h('div', {}, h('span', {}, '用时'), h('b', {}, C.formatTime(res.time * 1000))),
        h('div', {}, h('span', {}, '谐波效率'), h('b', { class: 'grade g' + grade }, grade))),
      lv ? h('div', { class: 'result-teach' }, h('span', { class: 'teach-icon' }, '✧'), lv.text) : null,
      nextChapterLine,
      uqEls, achEls,
      h('div', { class: 'modal-actions' },
        nextLv ? U.btn(`下一关 · ${nextLv.id} ${nextLv.name}`, { kind: 'primary', onClick: () => navigate('play/level/' + nextId) }) : null,
        U.btn(isDaily ? '再战一次' : '再试一次', { kind: nextLv ? 'ghost' : 'primary', onClick: () => navigate(isDaily ? 'daily' : lv ? 'play/level/' + lv.id : 'play/sandbox') }),
        U.btn(isDaily ? '返回' : '返回地图', { kind: 'ghost', onClick: () => navigate(isDaily ? 'daily' : 'map') })));
    U.modal(card, { dismissible: false });
  }

  /* ========================= 解锁与成就 ========================= */
  function requireText(req) {
    if (!req) return '';
    if (req.wsFormal != null) return `工坊正式 ${req.wsFormal} 关`;
    if (req.wsSuper != null) return `工坊超难 ${req.wsSuper} 关`;
    if (req.wsStar3 != null) return `工坊 3★ ${req.wsStar3} 关`;
    if (req.chapter != null) return `通关第 ${req.chapter} 章`;
    if (req.stars != null) return `累计 ${req.stars} 颗星`;
    return '';
  }

  function refreshUnlocks(announce = true) {
    const save = app.save;
    const newly = [];
    const add = (kind, item) => {
      if (!save.unlocks[kind].includes(item.id)) {
        save.unlocks[kind].push(item.id);
        newly.push(item);
      }
    };
    const W = HP.workshop;
    const ws = save.workshop || {};
    const done = (p) => (((ws[p.id] || {}).stars) || 0) > 0;
    const three = (p) => (((ws[p.id] || {}).stars) || 0) >= 3;
    const formalDone = W.FORMAL.filter(done).length;
    const superDone = W.SUPER.filter(done).length;
    const star3 = W.FORMAL.concat(W.SUPER).filter(three).length;
    const reqOk = (req) => {
      if (!req) return false;
      if (req.wsFormal != null && formalDone < req.wsFormal) return false;
      if (req.wsSuper != null && superDone < req.wsSuper) return false;
      if (req.wsStar3 != null && star3 < req.wsStar3) return false;
      return true;
    };
    for (const b of D.BRUSHES) if (reqOk(b.require)) add('brushes', b);
    for (const t of D.THEMES) if (reqOk(t.require)) add('themes', t);
    for (const t of D.TRAILS) if (reqOk(t.require)) add('trails', t);
    if (newly.length) {
      if (announce) {
        U.audio.unlock();
        for (const n of newly) U.toast('解锁 · ' + n.name, 'ach');
        fireConfetti();
      }
      persist();
    }
    return newly;
  }

  function fireConfetti() {
    try {
      if (global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      if (document.documentElement.dataset.motion === 'reduced') return;
      const layer = h('div', { class: 'confetti-layer' });
      const colors = ['#7ae7ff', '#ff7ad9', '#ffd166', '#8affc1', '#c4a7ff'];
      for (let i = 0; i < 26; i++) {
        layer.appendChild(h('i', {
          style: {
            left: (6 + Math.random() * 88) + '%',
            background: colors[i % colors.length],
            animationDelay: (Math.random() * 0.18) + 's',
            animationDuration: (1.1 + Math.random() * 0.7) + 's',
            '--x': (Math.random() * 160 - 80) + 'px',
            '--r': (Math.random() * 720 - 360) + 'deg',
          },
        }));
      }
      document.body.appendChild(layer);
      setTimeout(() => layer.remove(), 2200);
    } catch (e) { /* noop */ }
  }

  function checkAchievements(opts = {}) {
    const save = app.save;
    const newly = [];
    const give = (id) => {
      if (save.achievements[id]) return;
      save.achievements[id] = Date.now();
      newly.push(id);
      const a = D.ACHIEVEMENTS.find((x) => x.id === id);
      U.toast('成就解锁 · ' + (a ? a.name : id), 'ach', 3200);
      U.audio.unlock();
    };
    const L = save.levels;
    const ids = D.levelIds();
    if (ids.some((id) => (L[id] || {}).stars >= 1)) give('first_clear');
    if (ids.some((id) => (L[id] || {}).stars >= 3)) give('first_three');
    if (ids.some((id) => (L[id] || {}).stars >= 3 && (L[id] || {}).err != null && L[id].err <= 0.005)) give('perfect');
    if (ids.some((id) => (L[id] || {}).stars >= 3 && (L[id] || {}).count <= D.LEVELS[id].budget / 2)) give('minimalist');
    if ((L['2-1'] || {}).stars >= 3 || (L['2-2'] || {}).stars >= 3) give('gibbs');
    if (Object.keys(save.reading).length >= 5) give('spectrum');
    if (save.daily.stars >= 1) give('daily');
    if ((save.daily.streak || 0) >= 7) give('daily_7');
    if (D.READINGS.length && Object.keys(save.reading).length >= D.READINGS.length) give('reading_all');
    if (D.chapterLevels(1).every((id) => (L[id] || {}).stars >= 1)) give('chapter1');
    if (ids.every((id) => (L[id] || {}).stars >= 1)) give('all_chapters');
    if (ids.every((id) => (L[id] || {}).stars >= 3)) give('all_three');
    if (D.BRUSHES.every((b) => save.unlocks.brushes.includes(b.id)) &&
      D.THEMES.every((t) => save.unlocks.themes.includes(t.id)) &&
      D.TRAILS.every((t) => save.unlocks.trails.includes(t.id))) give('collector');
    const r = opts.result;
    if (r && r.stars >= 3 && r.time <= 20) give('fast');
    if (r && r.stars >= 3 && !save.settings.snap) give('no_snap');
    if (opts.sandbox500 && (app.play ? app.play.selection.size : 0) >= 500) give('sandbox500');
    if (Object.values(save.workshop || {}).some((x) => (x.stars || 0) >= 1)) give('workshop_first');
    const W = HP.workshop;
    const wsStars = (p) => (((save.workshop || {})[p.id] || {}).stars || 0);
    if (W.TUTORIALS.every((p) => wsStars(p) >= 1)) give('workshop_all');
    const formalDone = W.FORMAL.filter((p) => wsStars(p) >= 1).length;
    if (formalDone >= 10) give('workshop_formal_10');
    if (W.FORMAL.length && formalDone === W.FORMAL.length) give('workshop_formal_all');
    const superDone = W.SUPER.filter((p) => wsStars(p) >= 1).length;
    if (superDone >= 5) give('workshop_super_5');
    if (W.SUPER.length && superDone === W.SUPER.length) give('workshop_super_all');
    const wr = opts.workshop;
    if (wr && wr.stars >= 3 && wr.error <= 0.002) give('workshop_perfect');
    if (HP.lessons.LESSONS.every((l) => !!save.lessons[l.id])) give('lessons_all');
    if (newly.length) { persist(); fireConfetti(); }
    return newly;
  }

  /* ========================= 读谱师 ========================= */
  function spectrumFromRecipe(recipe, N = C.SAMPLE_N) {
    const mag = new Float64Array(N);
    const kOf = new Int32Array(N);
    for (let i = 0; i < N; i++) kOf[i] = i < N / 2 ? i : i - N;
    const selected = new Set();
    for (const c of recipe) {
      const idx = c.k >= 0 ? c.k : c.k + N;
      mag[idx] = c.amp;
      selected.add(idx);
    }
    return { N, mag, kOf, selected };
  }

  function shuffleSeeded(arr, seed) {
    const rng = C.mulberry32(seed);
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function renderReading(screen, id) {
    if (id) renderReadingPuzzle(screen, id);
    else renderReadingList(screen);
  }

  function readingTypeLabel(type) {
    return type === 'match' ? '看形选谱' : type === 'missing' ? '找缺失' : type === 'count' ? '数圆' : '读谱选形';
  }
  function readingShort(type) {
    return type === 'match' ? '给一个形状，选出对应的频谱'
      : type === 'missing' ? '找出频谱里少了哪一根'
        : type === 'count' ? '数一数，这张频谱要几个圆'
          : '给一组柱子，选出对应的形状';
  }
  function readingQuestion(type) {
    return type === 'match' ? '下面哪一张频谱，对应这个形状？'
      : type === 'missing' ? '这个形状的频谱少了一根柱子。少了哪一个 k？'
        : type === 'count' ? '这张频谱需要几个圆？'
          : '下面哪一个形状，对应这张频谱？';
  }

  function renderReadingList(screen) {
    const solved = Object.keys(app.save.reading).length;
    const cards = D.READINGS.map((p, i) => {
      const done = !!app.save.reading[p.id];
      const type = p.type || 'shape';
      const cv = h('canvas', { class: 'reading-mini', dataset: { w: 220, h: 76 } });
      if (type === 'match') {
        queuePaint(cv, () => S.spectrumShape(p.targetRecipe || p.recipe, 720), { color: '#ffd166', width: 1.7, glow: 8 });
      } else {
        const spec = spectrumFromRecipe(p.recipe);
        queuePaintSpectrum(cv, spec, { selected: spec.selected, range: 14 });
      }
      return h('button', { class: 'reading-card' + (done ? ' done' : ''), onclick: () => navigate('reading/' + p.id) },
        h('div', { class: 'reading-no' }, String(i + 1).padStart(2, '0')),
        h('div', { class: 'reading-body' },
          h('div', { class: 'reading-kicker' }, readingTypeLabel(type)),
          h('h3', {}, p.title),
          h('p', {}, done ? '已答对' : readingShort(type)),
          cv),
        h('div', { class: 'reading-mark' }, done ? '✓' : '→'));
    });
    screen.replaceChildren(h('div', { class: 'screen reading' },
      topbar({ back: () => navigate('home'), title: '读谱师' }),
      h('div', { class: 'map-hero' },
        h('div', {},
          h('div', { class: 'eyebrow' }, 'SPECTRUM READER'),
          h('h1', {}, '读谱师'),
          h('p', {}, '主玩法是「出频谱 → 拼目标形」；读谱师把它拆成四种读谱练习：读谱选形、看形选谱、找缺失、数圆。24 题，四种题型轮流出现。')),
        h('div', { class: 'map-progress' },
          h('div', { class: 'big-star' }, h('span', { class: 's' }, '✓'), String(solved), h('em', {}, '/ ' + D.READINGS.length)),
          h('div', { class: 'bar' }, h('i', { style: { width: (solved / D.READINGS.length) * 100 + '%' } })),
          h('span', { class: 'sub' }, solved >= D.READINGS.length ? '全部答对' : '答对 5 题解锁「频谱侦探」'))),
      h('div', { class: 'reading-grid' }, cards)));
  }

  function renderReadingPuzzle(screen, id) {
    const p = D.READINGS.find((x) => x.id === id);
    if (!p) { navigate('reading'); return; }
    const type = p.type || 'shape';
    const index = D.READINGS.indexOf(p);
    const solved = !!app.save.reading[p.id];
    const shownSpec = spectrumFromRecipe(p.recipe);
    const sig = (r) => r.map((c) => c.k + ':' + c.amp.toFixed(2)).sort().join('|');
    const isPick = type === 'shape' || type === 'match';
    const correctIndex = isPick ? p.options.findIndex((o) => sig(o) === sig(p.recipe)) : -1;
    const correctK = type === 'missing' ? p.answer : null;
    const correctN = type === 'count' ? p.answer : null;
    const order = shuffleSeeded(p.options.map((_, i) => i), C.hashString(p.id + '-order'));
    let attempts = 0;
    let answered = solved;

    const bigCv = h('canvas', { class: 'big-spectrum', dataset: { w: 720, h: 240 } });
    queuePaintSpectrum(bigCv, shownSpec, { selected: shownSpec.selected, range: 14, budgetLine: null });
    const targetPts = (type === 'match' || type === 'missing') ? S.spectrumShape(p.targetRecipe || p.recipe, 900) : null;
    const shapeCv = targetPts ? h('canvas', {
      class: 'big-shape',
      dataset: { w: type === 'missing' ? 380 : 760, h: type === 'missing' ? 240 : 330 },
    }) : null;
    if (shapeCv) queuePaint(shapeCv, targetPts, { color: '#ffd166', width: 2, glow: 12 });

    const board = type === 'match'
      ? h('div', { class: 'reading-shape-board' }, shapeCv)
      : type === 'missing'
        ? h('div', { class: 'reading-compare' },
          h('div', { class: 'reading-panel' }, h('div', { class: 'reading-panel-label' }, '目标形状'), shapeCv),
          h('div', { class: 'reading-panel' }, h('div', { class: 'reading-panel-label' }, '少了一根的频谱'), bigCv))
        : h('div', { class: 'spectrum-board' }, bigCv);

    const nextP = D.READINGS[index + 1];
    const explain = h('div', { class: 'reading-explain' + (answered ? ' show' : '') },
      h('div', { class: 'explain-icon' }, '✧'),
      h('p', {}, p.explain),
      h('button', {
        class: 'btn primary reading-next',
        onclick: () => navigate(nextP ? 'reading/' + nextP.id : 'reading'),
      }, nextP ? '下一题' : '返回列表'));

    const optionEls = [];
    let wrap;
    function finish(card) {
      if (answered) return;
      answered = true;
      app.save.reading[p.id] = { at: Date.now(), attempts: attempts + 1 };
      persist();
      card.classList.add('correct');
      wrap.classList.add('answered');
      explain.classList.add('show');
      optionEls.forEach((o) => { if (o.card !== card) o.card.classList.add('dim'); });
      U.audio.success(3);
      checkAchievements();
    }
    function wrong(card, msg) {
      if (answered) return;
      attempts += 1;
      card.classList.add('wrong');
      U.audio.fail();
      U.toast(attempts >= 2 ? msg : '再想想：柱子的位置与高度分别代表什么');
      if (attempts >= 2) card.classList.add('shake');
    }

    if (isPick) {
      wrap = h('div', { class: 'candidate-grid' });
      order.forEach((optIdx, slot) => {
        const recipe = p.options[optIdx];
        const card = h('button', {
          class: 'candidate' + (answered && optIdx === correctIndex ? ' correct' : ''),
          dataset: { idx: String(optIdx) },
          onclick: () => onPick(optIdx, card),
        });
        const letter = h('div', { class: 'candidate-letter' }, String.fromCharCode(65 + slot));
        if (type === 'match') {
          const cv = h('canvas', { class: 'match-spectrum', dataset: { w: 220, h: 70 } });
          const spec = spectrumFromRecipe(recipe);
          queuePaintSpectrum(cv, spec, { selected: spec.selected, range: 14 });
          card.append(letter, cv, h('div', { class: 'candidate-foot' }, answered && optIdx === correctIndex ? '正确答案' : '选择这张频谱'));
        } else {
          const pts = S.spectrumShape(recipe, 720);
          const cv = h('canvas', { class: 'candidate-cv', dataset: { w: 240, h: 240 } });
          queuePaint(cv, pts, { color: '#7fe3ff', width: 2, glow: 10 });
          card.append(letter, cv, h('div', { class: 'candidate-foot' }, answered && optIdx === correctIndex ? '正确答案' : '选择这个形状'));
        }
        optionEls.push({ card, val: optIdx });
        wrap.appendChild(card);
      });
      function onPick(optIdx, card) {
        if (answered) return;
        if (optIdx === correctIndex) finish(card);
        else wrong(card, type === 'match' ? '比较柱子的位置与高度：哪张谱和形状的鼓包/尖角一致' : '不对，再看看柱子在第几根 k 上');
      }
    } else {
      wrap = h('div', { class: 'choice-grid' });
      order.forEach((optIdx, slot) => {
        const val = p.options[optIdx];
        const card = h('button', {
          class: 'choice-btn' + (answered && val === (type === 'missing' ? correctK : correctN) ? ' correct' : ''),
          onclick: () => onChoice(val, card),
        },
          h('div', { class: 'candidate-letter' }, String.fromCharCode(65 + slot)),
          h('b', {}, type === 'missing' ? 'k = ' + (val > 0 ? '+' + val : val) : String(val)),
          h('span', {}, type === 'missing' ? '缺失的谐波' : '个圆'));
        optionEls.push({ card, val });
        wrap.appendChild(card);
      });
      function onChoice(val, card) {
        if (answered) return;
        if (val === (type === 'missing' ? correctK : correctN)) finish(card);
        else wrong(card, type === 'missing' ? '看看哪个鼓包/细节对不上；缺的柱子可能在任何 k' : '数非零柱子的数量，k=0 不算轮廓圆');
      }
    }

    const legend = type === 'missing'
      ? h('div', { class: 'puzzle-legend' },
        h('span', {}, h('b', {}, '缺口'), ' 可能在任何 k'),
        h('span', {}, h('b', {}, 'k=0'), ' 只平移'),
        h('span', {}, h('b', {}, '|k| 大'), ' 细节密'))
      : type === 'count'
        ? h('div', { class: 'puzzle-legend' },
          h('span', {}, h('b', {}, '非零柱'), ' 才算一个圆'),
          h('span', {}, h('b', {}, 'k=0'), ' 只平移'),
          h('span', {}, h('b', {}, '柱高'), ' 不影响数量'))
        : h('div', { class: 'puzzle-legend' },
          h('span', {}, h('b', {}, 'k=0'), ' 平移'),
          h('span', {}, h('b', {}, 'k=±1'), ' 主轮廓'),
          h('span', {}, h('b', {}, '|k| 越大'), ' 细节越密'));

    const actions = h('div', { class: 'reading-actions' },
      U.btn('返回列表', { kind: 'ghost', onClick: () => navigate('reading') }));

    screen.replaceChildren(h('div', { class: 'screen puzzle' },
      topbar({ back: () => navigate('reading'), title: `读谱师 · ${index + 1} / ${D.READINGS.length}` }),
      h('div', { class: 'puzzle-head' },
        h('div', {},
          h('div', { class: 'eyebrow' }, 'READ THE SPECTRUM · ' + readingTypeLabel(type)),
          h('h1', {}, p.title),
          h('p', {}, readingQuestion(type))),
        legend),
      board,
      wrap,
      explain,
      actions));
    if (dev.answer) {
      setTimeout(() => {
        const hit = isPick
          ? optionEls.find((o) => o.val === correctIndex)
          : optionEls.find((o) => o.val === (type === 'missing' ? correctK : correctN));
        if (hit) hit.card.click();
      }, 240);
    }
  }

  /* ========================= 每日一形 ========================= */
  function getDailyInfo() {
    const today = todayStr();
    if (app.dailyCache && app.dailyCache.date === today) return app.dailyCache;
    const puzzle = HP.generator.buildDaily(today);
    const pts = HP.workshop.recipePoints(puzzle.recipe, 1024);
    const info = { date: today, name: puzzle.title, puzzle, pts, budget: puzzle.budget };
    app.dailyCache = info;
    return info;
  }

  function dailyTypeLabel(t) {
    return t === 'repair' ? '修谱' : t === 'phase' ? '相位' : '合成';
  }

  function renderDaily(screen) {
    let info;
    try { info = getDailyInfo(); } catch (e) {
      screen.replaceChildren(h('div', { class: 'screen' }, topbar({ back: () => navigate('home') }), h('p', {}, '今日配方生成失败：' + e.message)));
      return;
    }
    const today = info.date;
    const p = info.puzzle;
    const done = app.save.daily.date === today && (app.save.daily.stars || 0) > 0;
    const cv = h('canvas', { class: 'daily-shape', dataset: { w: 320, h: 320 } });
    queuePaint(cv, info.pts, { color: '#ffd166', width: 2.2, glow: 14 });
    const streak = app.save.daily.streak || 0;
    const typeLabel = dailyTypeLabel(p.type);
    screen.replaceChildren(h('div', { class: 'screen daily' },
      topbar({ back: () => navigate('home'), title: '每日一形' }),
      h('div', { class: 'daily-grid' },
        h('div', { class: 'daily-art' }, cv, h('div', { class: 'daily-tag' }, info.name + ' · ' + typeLabel)),
        h('div', { class: 'daily-info' },
          h('div', { class: 'eyebrow' }, 'DAILY · ' + today),
          h('h1', {}, '今日配方'),
          h('p', {}, '每天 0 点刷新，同一个日期全世界同一配方。不画线，只调配谐波。'),
          h('div', { class: 'daily-stats' },
            h('div', {}, h('span', {}, '今日预算'), h('b', {}, info.budget + ' 圆')),
            h('div', {}, h('span', {}, '连续挑战'), h('b', {}, streak + ' 天')),
            h('div', {}, h('span', {}, '今日最佳'), h('b', {}, done ? `★ ${app.save.daily.stars}` : '—'))),
          h('div', { class: 'daily-actions' },
            U.btn(done ? '再挑战一次' : '开始今日挑战', { kind: 'primary lg', onClick: () => navigate('play/daily') }),
            U.btn('看工坊', { kind: 'ghost', onClick: () => navigate('workshop') })),
          h('p', { class: 'daily-note' }, `今日题型：${typeLabel} · 目标谱默认打开；三星标准：误差 ≤ 1.5% 且不超预算。`))),
      h('div', { class: 'daily-steps' },
        h('div', { class: 'daily-step' }, h('b', {}, '01'), h('h4', {}, '读谱'), h('p', {}, `今天的配方是 ${p.budget} 个圆；先看目标谱的柱高与相位。`)),
        h('div', { class: 'daily-step' }, h('b', {}, '02'), h('h4', {}, '调配'), h('p', {}, '添加 k，拖幅度与相位，让亮线贴合虚线；误差实时更新。')),
        h('div', { class: 'daily-step' }, h('b', {}, '03'), h('h4', {}, '结算'), h('p', {}, '三星要求误差 ≤ 1.5% 且不超预算；连续挑战累计天数。')))));
  }

  function renderDailyPlay(screen) {
    let info;
    try { info = getDailyInfo(); } catch (e) {
      screen.replaceChildren(h('div', { class: 'screen' }, topbar({ back: () => navigate('daily') }), h('p', {}, '今日配方生成失败：' + e.message)));
      return;
    }
    const p = info.puzzle;
    app.play = HP.workshop.create({
      puzzle: p,
      settings: app.save.settings,
      showIntro: app.save.daily.date !== info.date,
      onBack: () => navigate('daily'),
      onComplete: handleDailyResult,
    }).mount(screen);
    if (dev.demo) {
      setTimeout(() => {
        if (!app.play || app.play.destroyed) return;
        for (const c of p.recipe) {
          app.play.addHarmonic(c.k);
          app.play.setCoeff(c.k, 'amp', c.amp);
          app.play.setCoeff(c.k, 'phase', c.phase || 0);
        }
        app.play.recompute();
        app.play.rebuildSide();
        if (dev.settle) setTimeout(() => app.play.settle(), 200);
      }, 120);
    }
  }

  function handleDailyResult(res) {
    const save = app.save;
    const today = todayStr();
    const info = getDailyInfo();
    save.stats.plays += 1;
    save.stats.time += res.time || 0;
    if (save.stats.bestErr == null || res.error < save.stats.bestErr) save.stats.bestErr = res.error;
    if (save.daily.date !== today) {
      save.daily = { ...save.daily, date: today, stars: 0, err: null, count: 0, time: 0 };
    }
    const prev = { stars: save.daily.stars || 0, err: save.daily.err, count: save.daily.count, time: save.daily.time };
    const isBest = !prev.stars || res.stars > prev.stars ||
      (res.stars === prev.stars && (res.error < (prev.err == null ? 9 : prev.err) - 1e-9 ||
        (Math.abs(res.error - (prev.err || 0)) < 1e-9 && res.time < prev.time)));
    if (isBest) {
      save.daily.stars = res.stars;
      save.daily.err = res.error;
      save.daily.count = res.count;
      save.daily.time = res.time;
    }
    if (save.daily.lastDate !== today) {
      save.daily.streak = save.daily.lastDate === yesterdayStr() ? (save.daily.streak || 0) + 1 : 1;
      save.daily.lastDate = today;
    }
    save.daily.date = today;
    const newAch = checkAchievements({ result: res });
    persist();
    showDailyResult(res, { isBest, newAch, info });
  }

  function showDailyResult(res, meta) {
    const info = (meta && meta.info) || getDailyInfo();
    const p = info.puzzle;
    const streak = app.save.daily.streak || 0;
    const starEls = [0, 1, 2].map((i) => h('span', {
      class: 'big-star' + (i < res.stars ? ' on' : ''),
      style: { animationDelay: 0.08 * i + 's' },
    }, '★'));
    const achEls = ((meta && meta.newAch) || []).map((id) => {
      const a = D.ACHIEVEMENTS.find((x) => x.id === id);
      return h('div', { class: 'unlock-line ach' }, h('span', { class: 'unlock-icon' }, a ? a.icon : '✦'), '成就 · ' + (a ? a.name : id));
    });
    const card = h('div', { class: 'modal card result-card' + (res.stars >= 3 ? ' three' : '') },
      h('div', { class: 'result-head' },
        h('div', { class: 'result-kicker' }, p.kicker),
        h('div', { class: 'result-stars' }, starEls),
        h('h2', {}, '今日配方完成'),
        h('p', { class: 'result-sub' }, `${p.title} · 误差 ${C.formatPct(res.error, 2)} · ${res.count} 谐波 · ${C.formatTime(res.time * 1000)}`),
        meta && meta.isBest ? h('div', { class: 'new-record' }, '新纪录') : null),
      h('div', { class: 'result-grid' },
        h('div', {}, h('span', {}, '误差'), h('b', {}, C.formatPct(res.error, 2))),
        h('div', {}, h('span', {}, '谐波'), h('b', {}, res.count + ' / ' + res.budget)),
        h('div', {}, h('span', {}, '用时'), h('b', {}, C.formatTime(res.time * 1000))),
        h('div', {}, h('span', {}, '效率'), h('b', {}, efficiencyGrade(res.count, res.budget)))),
      h('div', { class: 'result-teach' }, h('span', { class: 'teach-icon' }, '☀'), p.note),
      h('div', { class: 'unlock-line' }, h('span', { class: 'unlock-icon' }, '☀'), `连续挑战 ${streak} 天`),
      achEls,
      h('div', { class: 'modal-actions' },
        U.btn('再试一次', { kind: 'primary', onClick: () => navigate('play/daily') }),
        U.btn('返回每日', { kind: 'ghost', onClick: () => navigate('daily') }),
        U.btn('看工坊', { kind: 'ghost', onClick: () => navigate('workshop') })));
    U.modal(card, { dismissible: false });
  }

  /* ========================= 频谱工坊 ========================= */
  function renderWorkshop(screen, id) {
    if (id === 'custom') { renderCustomWorkshop(screen); return; }
    if (id) renderWorkshopPuzzle(screen, id);
    else renderWorkshopList(screen);
  }

  function renderCustomWorkshop(screen) {
    const p = app.customPuzzle;
    if (!p) { navigate('play/sandbox'); return; }
    app.play = HP.workshop.create({
      puzzle: p,
      settings: app.save.settings,
      showIntro: false,
      onBack: () => navigate('play/sandbox'),
      onComplete: (res) => showCustomResult(res, p),
    }).mount(screen);
  }

  function showCustomResult(res, p) {
    const starEls = [0, 1, 2].map((i) => h('span', {
      class: 'big-star' + (i < res.stars ? ' on' : ''),
      style: { animationDelay: 0.08 * i + 's' },
    }, '★'));
    const card = h('div', { class: 'modal card result-card' + (res.stars >= 3 ? ' three' : '') },
      h('div', { class: 'result-head' },
        h('div', { class: 'result-kicker' }, p.kicker),
        h('div', { class: 'result-stars' }, starEls),
        h('h2', {}, '笔迹复现'),
        h('p', { class: 'result-sub' }, `我的笔迹 · 误差 ${C.formatPct(res.error, 2)} · ${res.count} 谐波 · ${C.formatTime(res.time * 1000)}`)),
      h('div', { class: 'result-grid' },
        h('div', {}, h('span', {}, '误差'), h('b', {}, C.formatPct(res.error, 2))),
        h('div', {}, h('span', {}, '谐波'), h('b', {}, res.count + ' / ' + res.budget)),
        h('div', {}, h('span', {}, '用时'), h('b', {}, C.formatTime(res.time * 1000))),
        h('div', {}, h('span', {}, '效率'), h('b', {}, efficiencyGrade(res.count, res.budget)))),
      h('div', { class: 'result-teach' }, h('span', { class: 'teach-icon' }, '✧'), p.note),
      h('div', { class: 'modal-actions' },
        U.btn('再调一次', { kind: 'primary', onClick: () => navigate('workshop/custom') }),
        U.btn('回沙盒', { kind: 'ghost', onClick: () => navigate('play/sandbox') })));
    U.modal(card, { dismissible: false });
  }

  function renderWorkshopList(screen) {
    const cat = HP.workshop.CATALOG;
    if (!app.ws) app.ws = { tab: 'tutorial', chapter: 1 };
    const ws = app.ws;
    const tabs = [
      { id: 'tutorial', label: '教程', list: cat.tutorials },
      { id: 'formal', label: '正式', list: cat.formal },
      { id: 'super', label: '超难', list: cat.super },
    ];
    const active = tabs.find((t) => t.id === ws.tab) || tabs[0];
    ws.tab = active.id;
    const chapters = active.id === 'tutorial' ? [] : (active.id === 'formal' ? cat.formalChapters : cat.superChapters);
    if (active.id !== 'tutorial') {
      ws.chapter = Math.max(1, Math.min(chapters.length, ws.chapter || 1));
    }
    const list = active.id === 'tutorial' ? cat.tutorials : active.list.filter((p) => p.chapter === ws.chapter);
    const chapter = chapters[ws.chapter - 1] || null;
    const starsOf = (p) => ((app.save.workshop[p.id] || {}).stars || 0);
    const doneAll = cat.all.filter((p) => starsOf(p) > 0).length;
    const doneSec = active.list.filter((p) => starsOf(p) > 0).length;
    const doneCh = list.filter((p) => starsOf(p) > 0).length;

    const tabEls = tabs.map((t) => {
      const n = t.list.filter((p) => starsOf(p) > 0).length;
      return h('button', {
        class: 'ws-tab' + (t.id === active.id ? ' on' : '') + (t.id === 'super' ? ' super' : ''),
        onclick: () => { ws.tab = t.id; ws.chapter = 1; renderRoute(); },
      }, h('b', {}, t.label), h('em', {}, n + ' / ' + t.list.length));
    });

    const chapterEls = chapters.map((c, idx) => h('button', {
      class: 'ws-chapter' + (idx + 1 === ws.chapter ? ' on' : ''),
      onclick: () => { ws.chapter = idx + 1; renderRoute(); },
    }, h('b', {}, '第 ' + (idx + 1) + ' 章'), h('span', {}, c.title)));

    const cards = list.map((p, i) => {
      const rec = app.save.workshop[p.id] || {};
      const unlocked = active.id !== 'tutorial' || i === 0 || starsOf(list[i - 1]) >= 1;
      const typeTag = p.type === 'repair' ? '修谱' : p.type === 'phase' ? '相位' : '合成';
      const cv = h('canvas', { class: 'workshop-canvas', dataset: { w: 240, h: 170 } });
      queuePaint(cv, () => HP.workshop.recipePoints(p.recipe, 1024), {
        color: unlocked ? (p.section === 'super' ? '#ff7bd5' : '#ffd166') : 'rgba(160,170,190,0.35)',
        width: 1.9, glow: unlocked ? 10 : 0, fill: false,
      });
      return h('button', {
        class: 'workshop-card' + (unlocked ? '' : ' locked') + (p.section === 'super' ? ' super' : ''),
        onclick: () => {
          if (!unlocked) { U.toast('先完成上一个教程配方'); return; }
          navigate('workshop/' + p.id);
        },
      },
        cv,
        h('span', { class: 'ws-type' + (p.section === 'super' ? ' super' : '') }, typeTag),
        unlocked ? null : h('span', { class: 'gallery-lock' }, '⌑ 未解锁'),
        h('div', { class: 'workshop-meta' },
          h('div', { class: 'workshop-line' }, h('b', {}, p.no), h('span', {}, p.title)),
          h('p', { class: 'workshop-kicker' }, p.kicker),
          U.starsRow(rec.stars || 0, 'small'),
          h('span', { class: 'workshop-best' }, rec.err != null ? `最佳 ${C.formatPct(rec.err, 2)} · ${rec.count} 谐波` : '未完成')));
    });

    const sectionHead = active.id === 'tutorial'
      ? h('div', { class: 'ws-section-head' },
        h('div', {}, h('h2', {}, '教程 · 先学会规则'), h('p', {}, '7 个手写配方：从一圈到方波。目标谱默认打开，可以照着填。')),
        h('div', { class: 'ws-section-prog' }, h('b', {}, doneSec + ' / ' + active.list.length), h('span', {}, '目标谱 开')))
      : h('div', { class: 'ws-section-head' },
        h('div', {}, h('h2', {}, chapter ? chapter.title : ''), h('p', {}, '第 ' + ws.chapter + ' 章 · ' + active.label + '关卡' + (active.id === 'super' ? '：目标谱默认关闭' : '：目标谱默认打开'))),
        h('div', { class: 'ws-section-prog' }, h('b', {}, doneCh + ' / ' + list.length), h('span', {}, '目标谱 ' + (active.id === 'super' ? '关' : '开'))));

    screen.replaceChildren(h('div', { class: 'screen workshop-page' },
      topbar({ back: () => navigate('home'), title: '频谱工坊' }),
      h('div', { class: 'map-hero' },
        h('div', {},
          h('div', { class: 'eyebrow' }, 'SPECTRUM WORKSHOP · ' + cat.total + ' LEVELS'),
          h('h1', {}, '频谱工坊'),
          h('p', {}, '这里不画线。你只有频谱：添加谐波 k，拖动幅度与相位，让合成出来的形状贴合目标。7 教程 + 60 正式 + 24 超难。')),
        h('div', { class: 'map-progress' },
          h('div', { class: 'big-star' }, h('span', { class: 's' }, '◈'), String(doneAll), h('em', {}, '/ ' + cat.all.length)),
          h('div', { class: 'bar' }, h('i', { style: { width: (doneAll / cat.all.length) * 100 + '%' } })),
          h('span', { class: 'sub' }, `正式 ${cat.formal.filter((p) => starsOf(p) > 0).length} / ${cat.formal.length} · 超难 ${cat.super.filter((p) => starsOf(p) > 0).length} / ${cat.super.length}`))),
      h('div', { class: 'ws-tabs' }, tabEls),
      chapters.length ? h('div', { class: 'ws-chapters' }, chapterEls) : null,
      sectionHead,
      h('div', { class: 'workshop-grid' }, cards),
      h('div', { class: 'workshop-foot' },
        h('p', {}, '误差只比形状：位置、朝向、大小不对都会扣分；「目标谱」在正式关默认打开，超难关默认关闭。'),
        h('div', { class: 'foot-links' },
          U.btn('先看傅里叶讲义', { kind: 'ghost', onClick: () => navigate('lessons') })))));
  }

  function renderWorkshopPuzzle(screen, id) {
    const cat = HP.workshop.CATALOG;
    const p = cat.byId.get(id);
    if (!p) { navigate('workshop'); return; }
    if (p.section === 'tutorial') {
      const i = cat.tutorials.indexOf(p);
      const unlocked = i === 0 || ((app.save.workshop[cat.tutorials[i - 1].id] || {}).stars || 0) >= 1;
      if (!unlocked && !dev.demo) { U.toast('先完成上一个教程配方'); navigate('workshop'); return; }
    }
    app.play = HP.workshop.create({
      puzzle: p,
      settings: app.save.settings,
      best: app.save.workshop[p.id],
      showIntro: !app.save.workshop[p.id] && !dev.demo,
      onBack: () => navigate('workshop'),
      onComplete: handleWorkshopResult,
    }).mount(screen);
    if (dev.demo) {
      setTimeout(() => {
        if (!app.play || app.play.destroyed) return;
        for (const c of p.recipe) {
          app.play.addHarmonic(c.k);
          app.play.setCoeff(c.k, 'amp', c.amp);
          app.play.setCoeff(c.k, 'phase', c.phase || 0);
        }
        app.play.recompute();
        app.play.rebuildSide();
        if (dev.settle) setTimeout(() => app.play.settle(), 200);
      }, 120);
    }
  }

  function handleWorkshopResult(res) {
    const save = app.save;
    const prev = save.workshop[res.id] || null;
    const better = !prev || res.stars > (prev.stars || 0) ||
      (res.stars === (prev.stars || 0) && res.error < (prev.err == null ? 9 : prev.err) - 1e-9);
    if (better) {
      save.workshop[res.id] = { stars: res.stars, err: res.error, count: res.count, time: res.time, at: Date.now() };
    }
    save.stats.plays++;
    const unlockedItems = refreshUnlocks();
    const newAch = checkAchievements({ workshop: res });
    persist();
    showWorkshopResult(res, { prev, better, newAch, unlockedItems });
  }

  function showWorkshopResult(res, info) {
    const cat = HP.workshop.CATALOG;
    const p = cat.byId.get(res.id);
    const next = p && p.next ? cat.byId.get(p.next) : null;
    const starEls = [0, 1, 2].map((k) => h('span', {
      class: 'big-star' + (k < res.stars ? ' on' : ''),
      style: { animationDelay: 0.08 * k + 's' },
    }, '★'));
    const achEls = (info.newAch || []).map((id) => {
      const a = D.ACHIEVEMENTS.find((x) => x.id === id);
      return h('div', { class: 'unlock-line ach' }, h('span', { class: 'unlock-icon' }, a ? a.icon : '✦'), '成就 · ' + (a ? a.name : id));
    });
    const unlockEls = (info.unlockedItems || []).map((u) =>
      h('div', { class: 'unlock-line' }, h('span', { class: 'unlock-icon' }, '◈'), '解锁 · ' + u.name + '（' + u.desc + '）'));
    const sec = p.section === 'super' ? '超难' : p.section === 'formal' ? '正式' : '教程';
    const card = h('div', { class: 'modal card result-card' + (res.stars >= 3 ? ' three' : '') },
      h('div', { class: 'result-head' },
        h('div', { class: 'result-kicker' }, '频谱工坊 · ' + sec + ' · ' + p.kicker),
        h('div', { class: 'result-stars' }, starEls),
        h('h2', {}, '配方完成'),
        h('p', { class: 'result-sub' }, `${p.title} · 误差 ${C.formatPct(res.error, 2)} · ${res.count} 谐波 · ${C.formatTime(res.time * 1000)}`),
        info.better ? h('div', { class: 'new-record' }, '新纪录') : null),
      h('div', { class: 'result-grid' },
        h('div', {}, h('span', {}, '误差'), h('b', {}, C.formatPct(res.error, 2))),
        h('div', {}, h('span', {}, '谐波'), h('b', {}, res.count + ' / ' + res.budget)),
        h('div', {}, h('span', {}, '用时'), h('b', {}, C.formatTime(res.time * 1000))),
        h('div', {}, h('span', {}, '效率'), h('b', {}, efficiencyGrade(res.count, res.budget)))),
      h('div', { class: 'result-teach' }, h('span', { class: 'teach-icon' }, '✧'), p.note),
      unlockEls,
      achEls,
      h('div', { class: 'modal-actions' },
        next ? U.btn(`下一题 · ${next.title}`, { kind: 'primary', onClick: () => navigate('workshop/' + next.id) }) : U.btn('返回工坊', { kind: 'primary', onClick: () => navigate('workshop') }),
        U.btn('再调一次', { kind: 'ghost', onClick: () => navigate('workshop/' + p.id) }),
        U.btn('返回目录', { kind: 'ghost', onClick: () => navigate('workshop') })));
    U.modal(card, { dismissible: false });
  }

  /* ========================= 傅里叶讲义 ========================= */
  function renderLessons(screen, id) {
    if (id) renderLesson(screen, id);
    else renderLessonsList(screen);
  }

  function renderLessonsList(screen) {
    const L = HP.lessons.LESSONS;
    const read = L.filter((l) => app.save.lessons[l.id]).length;
    const cards = L.map((l) => {
      const done = !!app.save.lessons[l.id];
      return h('button', {
        class: 'lesson-card' + (done ? ' read' : ''),
        onclick: () => navigate('lessons/' + l.id),
      },
        h('div', { class: 'lesson-no' }, l.no),
        h('div', { class: 'lesson-card-body' },
          h('div', { class: 'lesson-card-kicker' }, l.kicker),
          h('h3', {}, l.title),
          h('p', {}, l.summary)),
        h('div', { class: 'lesson-card-state' }, done ? '✓ 已读' : '→'));
    });
    screen.replaceChildren(h('div', { class: 'screen lessons-page' },
      topbar({ back: () => navigate('home'), title: '傅里叶讲义' }),
      h('div', { class: 'map-hero' },
        h('div', {},
          h('div', { class: 'eyebrow' }, 'FOURIER NOTES'),
          h('h1', {}, '傅里叶讲义'),
          h('p', {}, '9 节短课，每节都带一个能拖的演示。公式不是背景板：拖一下，看它怎么改变形状。')),
        h('div', { class: 'map-progress' },
          h('div', { class: 'big-star' }, h('span', { class: 's' }, '∑'), String(read), h('em', {}, '/ ' + L.length)),
          h('div', { class: 'bar' }, h('i', { style: { width: (read / L.length) * 100 + '%' } })),
          h('span', { class: 'sub' }, read === L.length ? '全部读完' : '读完 9 节解锁「学院旁听」'))),
      h('div', { class: 'lesson-grid-list' }, cards),
      h('div', { class: 'workshop-foot' },
        h('p', {}, '读完讲义，去工坊把公式变成你的配方：不画线，只调 cₖ。'),
        U.btn('去频谱工坊', { kind: 'ghost', onClick: () => navigate('workshop') }))));
  }

  function renderLesson(screen, id) {
    const L = HP.lessons.LESSONS;
    const idx = L.findIndex((l) => l.id === id);
    if (idx < 0) { navigate('lessons'); return; }
    const l = L[idx];
    app.save.lessons[l.id] = Date.now();
    persist();
    checkAchievements();

    const cv = h('canvas', { class: 'lesson-canvas' });
    const readout = h('div', { class: 'lesson-readout' }, '…');
    const ctrl = l.demo.control;
    const slider = h('input', {
      type: 'range', min: ctrl.min, max: ctrl.max, step: ctrl.step, value: ctrl.value,
      oninput: (e) => { if (app.lessonDemo) app.lessonDemo.setParam(+e.target.value); },
    });
    const sections = l.paragraphs.map((p) => h('div', { class: 'lesson-section' },
      p.h ? h('h3', {}, p.h) : null,
      p.p ? h('p', { html: p.p }) : null,
      p.f ? h('div', { class: 'formula', html: HP.formula.svg(p.f, { size: 18 }) }) : null));
    const points = h('ul', { class: 'lesson-points' }, l.points.map((x) => h('li', {}, x)));
    const prev = L[idx - 1], next = L[idx + 1];

    screen.replaceChildren(h('div', { class: 'screen lesson-page' },
      topbar({ back: () => navigate('lessons'), title: `傅里叶讲义 · ${l.no}` }),
      h('div', { class: 'lesson-grid' },
        h('article', { class: 'lesson-text' },
          h('div', { class: 'eyebrow' }, 'LESSON ' + l.no + ' · ' + l.kicker),
          h('h1', {}, l.title),
          h('p', { class: 'lesson-summary' }, l.summary),
          sections,
          h('div', { class: 'lesson-points-wrap' }, h('h3', {}, '本课要点'), points),
          h('div', { class: 'lesson-nav' },
            prev ? U.btn('上一课 · ' + prev.title, { kind: 'ghost', onClick: () => navigate('lessons/' + prev.id) }) : null,
            next ? U.btn('下一课 · ' + next.title, { kind: 'primary', onClick: () => navigate('lessons/' + next.id) }) : null,
            U.btn('返回目录', { kind: 'ghost', onClick: () => navigate('lessons') }))),
        h('div', { class: 'lesson-demo' },
          h('div', { class: 'demo-head' }, h('span', {}, '交互演示'), h('b', {}, l.title)),
          cv,
          h('div', { class: 'lesson-controls' },
            h('label', { class: 'lesson-control' }, h('span', {}, ctrl.label), slider),
            readout),
          h('p', { class: 'lesson-caption' }, l.demo.caption)))));

    requestAnimationFrame(() => {
      if (app.lessonDemo) { app.lessonDemo.destroy(); app.lessonDemo = null; }
      app.lessonDemo = HP.lessons.createDemo(cv, l, {
        settings: app.save.settings,
        onReadout: (html) => { readout.innerHTML = html; },
      });
    });
  }

  /* ========================= 图库 ========================= */
  function renderGallery(screen) {
    if (!app.galleryTab) app.galleryTab = 'campaign';
    const cat = HP.workshop.CATALOG;
    const wsStars = (p) => (((app.save.workshop || {})[p.id] || {}).stars || 0);
    const wsDone = cat.all.filter((p) => wsStars(p) > 0).length;
    const tab = app.galleryTab === 'workshop' ? 'workshop' : 'campaign';
    const tabDefs = [
      { id: 'campaign', label: '战役', done: clearedCount(), total: 20 },
      { id: 'workshop', label: '工坊', done: wsDone, total: cat.total },
    ];
    const tabs = tabDefs.map((t) => h('button', {
      class: 'ws-tab' + (t.id === tab ? ' on' : ''),
      onclick: () => { app.galleryTab = t.id; renderRoute(); },
    }, h('b', {}, t.label), h('em', {}, `${t.done} / ${t.total}`)));

    const progress = tab === 'campaign'
      ? h('div', { class: 'map-progress' },
        h('div', { class: 'big-star' }, h('span', { class: 's' }, '★'), String(totalStars()), h('em', {}, '/ 60')),
        h('div', { class: 'bar' }, h('i', { style: { width: (totalStars() / 60) * 100 + '%' } })),
        h('span', { class: 'sub' }, `${clearedCount()} / 20 关通过`))
      : h('div', { class: 'map-progress' },
        h('div', { class: 'big-star' }, h('span', { class: 's' }, '◈'), String(wsDone), h('em', {}, '/ ' + cat.total)),
        h('div', { class: 'bar' }, h('i', { style: { width: (wsDone / cat.total) * 100 + '%' } })),
        h('span', { class: 'sub' }, '教程 7 · 正式 60 · 超难 24'));

    let body;
    if (tab === 'campaign') {
      const cards = D.levelIds().map((id) => {
        const lv = D.LEVELS[id];
        const rec = app.save.levels[id] || {};
        const unlocked = isLevelUnlocked(id);
        const cv = h('canvas', { class: 'gallery-canvas', dataset: { w: 200, h: 160 } });
        const ch = D.CHAPTERS.find((c) => c.id === lv.chapter);
        queuePaint(cv, () => S.get(lv.shape), {
          color: unlocked ? ch.color : 'rgba(130,160,190,0.34)',
          width: 1.6, glow: unlocked ? 9 : 0, fill: false,
        });
        return h('button', {
          class: 'gallery-card' + (unlocked ? '' : ' locked'),
          onclick: () => unlocked ? navigate('play/level/' + id) : U.toast('尚未解锁'),
        },
          cv,
          unlocked ? null : h('span', { class: 'gallery-lock' }, '⌑ 未解锁'),
          h('div', { class: 'gallery-meta' },
            h('div', { class: 'gallery-line' }, h('b', {}, id), h('span', {}, lv.name)),
            U.starsRow(rec.stars || 0, 'small'),
            h('span', { class: 'gallery-best' }, rec.err != null ? `最佳 ${C.formatPct(rec.err, 2)} · ${rec.count} 圆` : (unlocked ? '尚无记录' : '继续通关解锁'))));
      });
      body = h('div', { class: 'gallery-grid' }, cards);
    } else {
      const sections = [];
      const addGroup = (title, sub, list) => {
        if (!list.length) return;
        const done = list.filter((p) => wsStars(p) > 0).length;
        sections.push(h('div', { class: 'ws-section-head' },
          h('div', {}, h('h2', {}, title), h('p', {}, sub)),
          h('div', { class: 'ws-section-prog' }, h('b', {}, done + ' / ' + list.length))));
        sections.push(h('div', { class: 'workshop-grid' }, list.map((p) => {
          const rec = app.save.workshop[p.id] || {};
          const typeTag = p.type === 'repair' ? '修谱' : p.type === 'phase' ? '相位' : '合成';
          const cv = h('canvas', { class: 'workshop-canvas', dataset: { w: 240, h: 170 } });
          queuePaint(cv, () => HP.workshop.recipePoints(p.recipe, 1024), {
            color: p.section === 'super' ? '#ff7bd5' : '#ffd166',
            width: 1.9, glow: 10, fill: false,
          });
          return h('button', {
            class: 'workshop-card' + (p.section === 'super' ? ' super' : ''),
            onclick: () => navigate('workshop/' + p.id),
          },
            cv,
            h('span', { class: 'ws-type' + (p.section === 'super' ? ' super' : '') }, typeTag),
            h('div', { class: 'workshop-meta' },
              h('div', { class: 'workshop-line' }, h('b', {}, p.no), h('span', {}, p.title)),
              h('p', { class: 'workshop-kicker' }, p.kicker),
              U.starsRow(rec.stars || 0, 'small'),
              h('span', { class: 'workshop-best' }, rec.err != null ? `最佳 ${C.formatPct(rec.err, 2)} · ${rec.count} 谐波` : '未完成')));
        })));
      };
      addGroup('教程 · 7 个手写配方', '从一圈到方波', cat.tutorials);
      cat.formalChapters.forEach((ch, idx) => addGroup('第 ' + (idx + 1) + ' 章 · ' + ch.title, '正式 · 目标谱默认打开', cat.formal.filter((p) => p.chapter === idx + 1)));
      cat.superChapters.forEach((ch, idx) => addGroup('超难 ' + (idx + 1) + ' · ' + ch.title, '盲配 · 目标谱默认关闭', cat.super.filter((p) => p.chapter === idx + 1)));
      body = h('div', { class: 'gallery-ws' }, sections);
    }

    screen.replaceChildren(h('div', { class: 'screen gallery' },
      topbar({ back: () => navigate('home'), title: '图库' }),
      h('div', { class: 'map-hero' },
        h('div', {},
          h('div', { class: 'eyebrow' }, 'GALLERY'),
          h('h1', {}, '图库'),
          h('p', {}, '主玩法 91 个配方 + 反向战役 20 关；点击开始调配或重玩。')),
        progress),
      h('div', { class: 'ws-tabs' }, tabs),
      body));
  }

  /* ========================= 成就 ========================= */
  function renderAchievements(screen) {
    const cards = D.ACHIEVEMENTS.map((a) => {
      const on = !!app.save.achievements[a.id];
      return h('div', { class: 'ach-card' + (on ? ' on' : '') },
        h('div', { class: 'ach-icon' }, a.icon),
        h('div', { class: 'ach-body' }, h('h3', {}, a.name), h('p', {}, a.desc)),
        h('div', { class: 'ach-state' }, on ? '已解锁' : '未解锁'));
    });
    screen.replaceChildren(h('div', { class: 'screen achievements' },
      topbar({ back: () => navigate('home'), title: '成就' }),
      h('div', { class: 'map-hero' },
        h('div', {}, h('div', { class: 'eyebrow' }, 'ACHIEVEMENTS'), h('h1', {}, '数学里程碑'),
          h('p', {}, '从「初次谐波」到「满星学院」，把每一次理解都记下来。')),
        h('div', { class: 'map-progress' },
          h('div', { class: 'big-star' }, h('span', { class: 's' }, '✦'), String(achievedCount()), h('em', {}, '/ ' + D.ACHIEVEMENTS.length)))),
      h('div', { class: 'ach-grid' }, cards)));
  }

  /* ========================= 设置 ========================= */
  function renderSettings(screen) {
    const s = app.save.settings;
    const wsDone = HP.workshop.CATALOG.all.filter((p) => ((app.save.workshop[p.id] || {}).stars || 0) > 0).length;
    const ws3 = HP.workshop.CATALOG.all.filter((p) => ((app.save.workshop[p.id] || {}).stars || 0) >= 3).length;
    const swatch = (item, kind) => {
      const unlocked = app.save.unlocks[kind].includes(item.id);
      const active = s[kind === 'brushes' ? 'brush' : kind === 'themes' ? 'theme' : 'trail'] === item.id;
      return h('button', {
        class: 'pick' + (active ? ' active' : '') + (unlocked ? '' : ' locked'),
        onclick: () => {
          if (!unlocked) {
            U.toast('完成' + requireText(item.require) + '解锁「' + item.name + '」');
            return;
          }
          const key = kind === 'brushes' ? 'brush' : kind === 'themes' ? 'theme' : 'trail';
          s[key] = item.id;
          applySettings();
          persist();
          renderRoute();
          U.toast('已切换 · ' + item.name);
        },
      },
        h('div', { class: 'pick-swatch', dataset: { kind, id: item.id } }, unlocked ? '' : '⌑'),
        h('div', { class: 'pick-meta' }, h('b', {}, item.name), h('span', {}, unlocked ? item.desc : requireText(item.require))));
    };
    const toggle = (label, key, onChange) => h('label', { class: 'toggle-row' },
      h('span', {}, label),
      h('button', {
        class: 'toggle' + (s[key] ? ' on' : ''),
        onclick: () => { s[key] = !s[key]; applySettings(); persist(); onChange && onChange(); renderRoute(); U.audio.toggle(s[key]); },
      }, h('i')));
    const importInput = h('input', {
      type: 'file', accept: '.json,application/json', class: 'hidden-file',
      onchange: (e) => { const f = e.target.files && e.target.files[0]; importSave(f); e.target.value = ''; },
    });
    screen.replaceChildren(h('div', { class: 'screen settings' },
      topbar({ back: () => navigate('home'), title: '设置' }),
      h('div', { class: 'settings-grid' },
        h('section', { class: 'set-card' },
          h('h2', {}, '外观'),
          h('h3', {}, '主题'),
          h('div', { class: 'picks' }, D.THEMES.map((t) => swatch(t, 'themes'))),
          h('h3', {}, '画笔'),
          h('div', { class: 'picks' }, D.BRUSHES.map((b) => swatch(b, 'brushes'))),
          h('h3', {}, '尾迹'),
          h('div', { class: 'picks' }, D.TRAILS.map((t) => swatch(t, 'trails')))),
        h('section', { class: 'set-card' },
          h('h2', {}, '操作'),
          toggle('音效', 'sound'),
          toggle('吸附辅助（靠近虚线时自动吸附）', 'snap'),
          toggle('显示目标虚影', 'showGhost'),
          toggle('减少动画', 'reduced'),
          h('p', { class: 'set-note' }, '吸附辅助会降低描摹难度；关闭它获得的三星会记入「徒手描摹」成就。')),
        h('section', { class: 'set-card' },
          h('h2', {}, '数据'),
          h('div', { class: 'stat-list' },
            h('div', {}, h('span', {}, '工坊进度'), h('b', {}, `${wsDone} / ${HP.workshop.CATALOG.total}`)),
            h('div', {}, h('span', {}, '工坊 3★'), h('b', {}, `${ws3} / ${HP.workshop.CATALOG.total}`)),
            h('div', {}, h('span', {}, '战役星'), h('b', {}, `${totalStars()} / 60`)),
            h('div', {}, h('span', {}, '战役通关'), h('b', {}, `${clearedCount()} / 20`)),
            h('div', {}, h('span', {}, '游玩次数'), h('b', {}, String(app.save.stats.plays || 0))),
            h('div', {}, h('span', {}, '最佳误差'), h('b', {}, app.save.stats.bestErr != null ? C.formatPct(app.save.stats.bestErr, 2) : '—')),
            h('div', {}, h('span', {}, '成就'), h('b', {}, `${achievedCount()} / ${D.ACHIEVEMENTS.length}`))),
          h('button', {
            class: 'btn danger', onclick: () => {
              const card = h('div', { class: 'modal card' },
                h('h2', {}, '清除全部进度？'),
                h('p', {}, '所有星级、成就与解锁都会被删除，且无法恢复。清除前会自动备份一份。'),
                h('div', { class: 'modal-actions' },
                  U.btn('确认清除', { kind: 'danger', onClick: () => { backupSave(); try { localStorage.removeItem(SAVE_KEY); } catch (e) {} location.reload(); } }),
                  U.btn('取消', { kind: 'ghost', onClick: () => U.closeModal() })));
              if (res.stars >= 2) fireConfetti();
    U.modal(card);
            },
          }, '清除进度')),
        h('section', { class: 'set-card save-card' },
          h('h2', {}, '存档'),
          h('p', { class: 'set-note' }, '进度保存在本机；覆盖安装或更新不会清空。导出后可换设备导入。'),
          h('div', { class: 'save-actions' },
            h('button', { class: 'btn', onclick: () => exportSave() }, '导出存档'),
            h('button', { class: 'btn', onclick: () => importInput.click() }, '导入存档'),
            h('button', { class: 'btn ghost', onclick: () => restoreBackup() }, '恢复自动备份'),
            importInput),
          h('p', { class: 'set-note' }, '自动备份在每次启动、导入与清除前各保留一份；更新前也已留底。')),
        h('section', { class: 'set-card update-card' },
          h('h2', {}, '版本与更新'),
          h('div', { class: 'stat-list' },
            h('div', {}, h('span', {}, '当前版本'), h('b', {}, 'v' + APP_VERSION)),
            h('div', {}, h('span', {}, '构建日期'), h('b', {}, BUILD_DATE)),
            h('div', {}, h('span', {}, '更新状态'), h('b', {}, updateStatusText())),
            app.updateCheckedAt ? h('div', {}, h('span', {}, '上次检查'), h('b', {}, new Date(app.updateCheckedAt).toLocaleString())) : null),
          h('div', { class: 'update-actions' },
            h('button', { class: 'btn primary', onclick: () => checkUpdate() }, '检查更新'),
            h('button', { class: 'btn ghost', onclick: () => showChangelog() }, '更新说明'),
            h('button', { class: 'btn ghost', disabled: !app.updateLatest, onclick: () => downloadUpdate() }, '下载新版')),
          h('label', { class: 'field' }, h('span', {}, '更新源'),
            h('input', {
              class: 'inp', value: s.updateSource || UPDATE_DEFAULT,
              onchange: (e) => { s.updateSource = e.target.value.trim() || UPDATE_DEFAULT; persist(); },
            })),
          h('p', { class: 'set-note' }, '默认读取同目录 version.json；也可填自己的更新清单地址。更新不会清空存档。')),
        h('section', { class: 'set-card about' },
          h('h2', {}, '关于'),
          h('p', {}, '《谐波画笔》—— 一组频率，拼出目标图像。'),
          h('p', {}, '每个圆是一个频率分量：半径是幅度，转速是频率 k，转角是相位。同一条曲线可以由很多组圆拼出来。'),
          h('div', { class: 'formula', html: HP.formula.svg('c_k = \\frac{1}{N}\\sum_{n} p_n\\, e^{-2\\pi i kn/N}', { size: 15 }) }),
          h('p', {}, '主玩法：频谱工坊——给你目标与它的频谱，只调配谐波；另有反向描摹、读谱、每日一形与 9 节讲义。'),
          h('p', { class: 'muted' }, `进度保存在本机，无需联网 · v${APP_VERSION} · ${BUILD_DATE}`)))));
  }

  /* ========================= 缩略图绘制队列 ========================= */
  let paintQueue = [];
  let paintScheduled = false;
  function queuePaint(cv, pts, opts) {
    paintQueue.push({ cv, pts, opts });
    if (!paintScheduled) {
      paintScheduled = true;
      requestAnimationFrame(flushPaint);
    }
  }
  function queuePaintSpectrum(cv, spec, opts) {
    paintQueue.push({ cv, spec, opts });
    if (!paintScheduled) {
      paintScheduled = true;
      requestAnimationFrame(flushPaint);
    }
  }
  function flushPaint() {
    paintScheduled = false;
    const batch = paintQueue.splice(0, 6);
    for (const job of batch) {
      if (!job.cv.isConnected) continue;
      try {
        if (job.spec) U.paintSpectrum(job.cv, job.spec, job.opts);
        else U.paintShape(job.cv, typeof job.pts === 'function' ? job.pts() : job.pts, job.opts);
      } catch (e) { /* noop */ }
    }
    if (paintQueue.length) {
      paintScheduled = true;
      requestAnimationFrame(flushPaint);
    }
  }

  /* ========================= 路由 ========================= */
  function teardown() {
    U.closeModal();
    U.ensureLayers();
    if (app.play) { app.play.destroy(); app.play = null; }
    if (app.lessonDemo) { app.lessonDemo.destroy(); app.lessonDemo = null; }
    if (app.ambient) { app.ambient.stop(); app.ambient = null; }
    paintQueue = [];
    document.body.dataset.screen = '';
  }

  function parseHash() {
    let raw = location.hash.replace(/^#\/?/, '');
    if (!raw) return ['home'];
    return raw.split('/').filter(Boolean);
  }

  /* ========================= 移动端底部导航 ========================= */
  function installDock() {
    if (document.querySelector('.dock')) return;
    const items = [
      ['home', '◉', '首页'],
      ['workshop', '◈', '工坊'],
      ['map', '✺', '战役'],
      ['reading', '▤', '读谱'],
      ['settings', '⚙', '设置'],
    ];
    const dock = h('nav', { class: 'dock', 'aria-label': '主导航' },
      items.map(([route, icon, label]) => h('button', {
        class: 'dock-btn', type: 'button', dataset: { route },
        onclick: () => navigate(route),
      }, h('span', { class: 'dock-icon' }, icon), h('span', { class: 'dock-label' }, label))));
    document.body.appendChild(dock);
  }

  function updateDock(parts) {
    const dock = document.querySelector('.dock');
    if (!dock) return;
    const name = (parts && parts[0]) || 'home';
    const sub = parts && parts[1];
    const full = name === 'play' || (name === 'workshop' && !!sub);
    document.body.classList.toggle('in-play', full);
    let active = 'home';
    if (name === 'workshop') active = 'workshop';
    else if (name === 'map' || name === 'play') active = 'map';
    else if (name === 'reading') active = 'reading';
    else if (name === 'settings') active = 'settings';
    for (const b of dock.querySelectorAll('.dock-btn')) b.classList.toggle('on', b.dataset.route === active);
  }

  function renderRoute() {
    teardown();
    const parts = parseHash();
    const name = parts[0] || 'home';
    const screen = document.getElementById('screen');
    document.body.dataset.screen = name;
    try {
      if (name === 'home') renderHome(screen);
      else if (name === 'map') renderMap(screen);
      else if (name === 'play') openPlay(screen, parts[1] || 'sandbox', parts[2]);
      else if (name === 'reading') renderReading(screen, parts[1]);
      else if (name === 'workshop') renderWorkshop(screen, parts[1]);
      else if (name === 'lessons') renderLessons(screen, parts[1]);
      else if (name === 'daily') renderDaily(screen);
      else if (name === 'gallery') renderGallery(screen);
      else if (name === 'achievements') renderAchievements(screen);
      else if (name === 'settings') renderSettings(screen);
      else navigate('home');
    } catch (e) {
      console.error(e);
      screen.replaceChildren(h('div', { class: 'screen' }, topbar({ back: () => navigate('home') }),
        h('div', { class: 'fatal' }, h('h1', {}, '页面出错了'), h('p', {}, String(e && e.message || e)),
          U.btn('回到首页', { kind: 'primary', onClick: () => navigate('home') }))));
    }
    updateDock(parts);
    if (screen) {
      screen.classList.remove('screen-enter');
      void screen.offsetWidth;
      screen.classList.add('screen-enter');
    }
    global.scrollTo(0, 0);
  }

  /* ========================= 自检 ========================= */
  async function runSelfTest() {
    const out = [];
    const ok = (name, cond, extra) => out.push({ name, ok: !!cond, extra: extra === undefined ? '' : String(extra) });
    const coreErrs = C.selfTest();
    ok('core.selfTest', coreErrs.length === 0, coreErrs.join('; '));

    for (const id of Object.keys(S.defs)) {
      try {
        const pts = S.get(id);
        const bb = C.bbox(pts);
        ok('shape ' + id, pts.length > 100 && bb.w > 0.1 && bb.h > 0.1 && C.pathLength(pts) > 0.5);
      } catch (e) { ok('shape ' + id, false, e.message); }
    }

    const levelIds = D.levelIds();
    ok('20 关', levelIds.length === 20);
    ok('关卡图形引用', levelIds.every((id) => !!S.defs[D.LEVELS[id].shape]));
    ok('预算合法', levelIds.every((id) => D.LEVELS[id].budget >= 1 && D.LEVELS[id].budget <= 500));
    ok('每章四关', D.CHAPTERS.every((ch) => D.chapterLevels(ch.id).length === 4));

    const prep = C.prepareTarget(S.get('heart'));
    ok('自比较误差≈0', C.errorAgainstPrepared(prep, S.get('heart')) < 1e-3, C.errorAgainstPrepared(prep, S.get('heart')));
    ok('三星判定', C.starFor(0.01, 10, 10) === 3);
    ok('超预算降为两星', C.starFor(0.01, 11, 10) === 2);
    ok('误差超限零星', C.starFor(0.2, 3, 10) === 0);

    for (const p of D.READINGS) {
      if (p.type === 'missing') {
        const shownKs = p.recipe.map((c) => c.k);
        const fullKs = p.targetRecipe.map((c) => c.k);
        ok('读谱缺失题 ' + p.id,
          p.options.length === 4 && p.options.includes(p.answer) && !shownKs.includes(p.answer) && fullKs.includes(p.answer));
      } else if (p.type === 'count') {
        const n = p.recipe.filter((c) => c.k !== 0).length;
        ok('读谱数圆题 ' + p.id, p.options.length === 4 && p.options.includes(p.answer) && p.answer === n);
      } else {
        const sig = (recipe) => recipe.map((c) => c.k + ':' + c.amp).sort().join('|');
        const correct = sig(p.recipe);
        const matching = p.options.filter((o) => sig(o) === correct).length;
        ok('读谱唯一答案 ' + p.id, matching === 1 && p.options.length >= 3, 'matching=' + matching);
      }
    }
    ok('读谱题量', D.READINGS.length === 24);
    {
      const rts = new Set(D.READINGS.map((p) => p.type || 'shape'));
      ok('读谱四种题型', rts.has('shape') && rts.has('match') && rts.has('missing') && rts.has('count'), [...rts].join(','));
    }

    // 存档往返
    const before = JSON.stringify(app.save);
    const merged = mergeSave(defaultSave(), JSON.parse(before));
    ok('存档合并', JSON.stringify(merged).length === before.length);

    // 浏览器内集成测试：画一条模拟笔迹 → 误差 → 星级
    let backCalled = false;
    const holder = h('div', { style: { position: 'fixed', left: '-3000px', top: '0', width: '900px', height: '700px' } });
    document.body.appendChild(holder);
    const errsBefore = out.length;
    try {
      const sess = HP.play.create({
        kind: 'level', level: D.LEVELS['1-1'], shapePts: S.get('circle'),
        budget: 1, showIntro: false, settings: { ...app.save.settings }, persist: () => {},
        onBack: () => { backCalled = true; }, onComplete: () => {},
      }).mount(holder);
      await new Promise((r) => setTimeout(r, 120));
      sess.demo(0.8);
      await new Promise((r) => setTimeout(r, 120));
      ok('会话误差', sess.error != null && sess.error > 0 && sess.error < 0.02, sess.error);
      ok('会话三星', sess.stars === 3, sess.stars);
      ok('会话圆数', sess.selection.size === 1, sess.selection.size);
      ok('会话画布', sess.els.stage.width > 100);
      sess.els.head.querySelector('.icon-btn').click();
      ok('返回按钮回调', backCalled);
      sess.destroy();
    } catch (e) {
      ok('会话集成', false, e.message + '\n' + (e.stack || ''));
    }
    holder.remove();

    // 真实指针事件绘制测试（含自动闭合与评分）
    const holder2 = h('div', { style: { position: 'fixed', left: '-3000px', top: '0', width: '900px', height: '700px' } });
    document.body.appendChild(holder2);
    try {
      const sess2 = HP.play.create({
        kind: 'level', level: D.LEVELS['2-3'], shapePts: S.get('hexagon'),
        budget: 18, showIntro: false, settings: { ...app.save.settings }, persist: () => {},
        onBack: () => {}, onComplete: () => {},
      }).mount(holder2);
      await new Promise((r) => setTimeout(r, 120));
      const target = C.resampleClosed(S.get('hexagon'), 180);
      const stage = sess2.els.stage;
      const rect = stage.getBoundingClientRect();
      const fire = (type, wx, wy) => {
        const s = sess2.renderer.toScreen(wx, wy);
        stage.dispatchEvent(new PointerEvent(type, {
          clientX: rect.left + s.x, clientY: rect.top + s.y,
          button: 0, buttons: type === 'pointerup' ? 0 : 1,
          pointerId: 7, pointerType: 'mouse', bubbles: true,
        }));
      };
      fire('pointerdown', target[0].x, target[0].y);
      for (let i = 1; i <= target.length; i++) {
        const p = target[i % target.length];
        fire('pointermove', p.x, p.y);
      }
      fire('pointerup', target[0].x, target[0].y);
      await new Promise((r) => setTimeout(r, 180));
      ok('指针绘制分析', !!sess2.ana);
      ok('指针绘制误差', sess2.error != null && sess2.error < 0.02, sess2.error);
      ok('指针绘制三星', sess2.stars === 3, sess2.stars);
      sess2.destroy();
    } catch (e) {
      ok('指针绘制集成', false, e.message + '\n' + (e.stack || ''));
    }
    holder2.remove();

    // 频谱工坊：配方自洽 + 会话集成
    const WS = HP.workshop;
    ok('工坊配方数', WS.PUZZLES.length >= 6, WS.PUZZLES.length);
    let wsAllSolvable = true;
    for (const p of WS.PUZZLES) {
      const tgt = WS.recipePoints(p.recipe, 1024);
      const ana = WS.buildAna(p.recipe, 1024);
      const cur = C.reconPoints(C.reconstruct(ana, ana.indices, 1024), 1024);
      const e = WS.errorOf(cur, tgt, C.rmsRadius(tgt));
      if (!(e < 1e-6)) { wsAllSolvable = false; break; }
    }
    ok('工坊全部配方可解', wsAllSolvable);
    ok('工坊三星阈值', WS.starFor(0.001, 1, 1) === 3 && WS.starFor(0.05, 1, 1) === 1);
    {
      const d1 = HP.generator.buildDaily('2025-01-01');
      const d2 = HP.generator.buildDaily('2025-01-01');
      ok('每日配方确定性', d1.id === d2.id && JSON.stringify(d1.recipe) === JSON.stringify(d2.recipe));
      ok('每日配方配置', d1.hintOn === true && d1.budget === d1.recipe.length && d1.thresholds.length === 3);
      const dPts = WS.recipePoints(d1.recipe, 1024);
      const dAna = WS.buildAna(d1.recipe, 1024);
      const dCur = C.reconPoints(C.reconstruct(dAna, dAna.indices, 1024), 1024);
      ok('每日配方可解', WS.errorOf(dCur, dPts, C.rmsRadius(dPts)) < 1e-6);
    }
    {
      const p5 = WS.PUZZLES.find((p) => p.id === 'w5');
      const tgt = WS.recipePoints(p5.recipe, 1024);
      const shiftedRecipe = p5.recipe.map((c) => ({ k: c.k, amp: c.amp, phase: (c.phase || 0) + (c.k > 0 ? 1.1 : -1.1) }));
      const shifted = WS.recipePoints(shiftedRecipe, 1024);
      const e = C.curveDistance(shifted, tgt) / C.rmsRadius(tgt);
      ok('工坊误差与起笔/时序无关', e < 0.001, e);
      const off = WS.recipePoints([{ k: 0, amp: 0.6, phase: 1 }, { k: 1, amp: 0.8 }], 1024);
      const cen = WS.recipePoints([{ k: 1, amp: 0.8 }], 1024);
      ok('工坊误差对 DC 敏感', C.curveDistance(off, cen) / C.rmsRadius(off) > 0.1);
    }
    ok('工坊目录规模', WS.CATALOG.formal.length === 60 && WS.CATALOG.super.length === 24 && WS.CATALOG.total === 91);
    {
      let solvable = true, badId = '';
      for (const lv of WS.ALL) {
        const tgt = WS.recipePoints(lv.recipe, 1024);
        const ana = WS.buildAna(lv.recipe, 1024);
        const cur = C.reconPoints(C.reconstruct(ana, ana.indices, 1024), 1024);
        const e = WS.errorOf(cur, tgt, C.rmsRadius(tgt));
        if (!(e < 1e-6) || lv.recipe.length > lv.budget) { solvable = false; badId = lv.id; break; }
      }
      ok('91 关全部可解', solvable, badId);
      const fams = new Set(WS.ALL.map((p) => p.family).filter(Boolean));
      const types = new Set(WS.ALL.map((p) => p.type).filter(Boolean));
      ok('生成关卡多样性',
        fams.size >= 8 && types.size >= 3 && new Set(WS.ALL.map((p) => p.id)).size === WS.ALL.length &&
        new Set(WS.ALL.map((p) => p.title)).size === WS.ALL.length,
        'families=' + fams.size + ' types=' + types.size);
    }
    {
      const holder5 = h('div', { style: { position: 'fixed', left: '-3000px', top: '0', width: '900px', height: '700px' } });
      document.body.appendChild(holder5);
      try {
        const gp = WS.FORMAL[0];
        let gRes = null;
        const s5 = WS.create({
          puzzle: gp, settings: { ...app.save.settings }, showIntro: false,
          onBack: () => {}, onComplete: (r) => { gRes = r; },
        }).mount(holder5);
        await new Promise((r) => setTimeout(r, 100));
        for (const c of gp.recipe) { s5.addHarmonic(c.k); s5.setCoeff(c.k, 'amp', c.amp); s5.setCoeff(c.k, 'phase', c.phase || 0); }
        s5.recompute(); s5.rebuildSide();
        ok('生成关卡会话三星', s5.error < 1e-6 && s5.stars === 3, s5.error);
        s5.settle();
        await new Promise((r) => setTimeout(r, 80));
        ok('生成关卡结算', gRes && gRes.stars === 3);
        s5.destroy();
      } catch (e) {
        ok('生成关卡会话', false, e.message);
      }
      holder5.remove();
    }
    {
      const holder6 = h('div', { style: { position: 'fixed', left: '-3000px', top: '0', width: '900px', height: '700px' } });
      document.body.appendChild(holder6);
      try {
        const s6 = HP.play.create({
          kind: 'sandbox', name: '自由绘', budget: 500,
          settings: { ...app.save.settings }, persist: () => {}, onBack: () => {}, onComplete: () => {},
        }).mount(holder6);
        await new Promise((r) => setTimeout(r, 120));
        s6.loadSample();
        await new Promise((r) => setTimeout(r, 220));
        const cp = s6.sandboxPuzzle();
        ok('沙盒带进工坊配方', !!cp && cp.recipe.length >= 2 && cp.recipe.length <= 12 &&
          cp.recipe.every((c) => Math.abs(c.k) <= 12 && c.amp > 0 && c.amp <= 1));
        if (cp) {
          const tgt = WS.recipePoints(cp.recipe, 1024);
          const ana = WS.buildAna(cp.recipe, 1024);
          const cur = C.reconPoints(C.reconstruct(ana, ana.indices, 1024), 1024);
          ok('沙盒配方可复现', C.curveDistance(cur, tgt) / C.rmsRadius(tgt) < 1e-6);
        }
        s6.destroy();
      } catch (e) {
        ok('沙盒配方生成', false, e.message);
      }
      holder6.remove();
    }
    ok('成就数量 24', D.ACHIEVEMENTS.length === 24, D.ACHIEVEMENTS.length);
    ok('版本号合法', /^\d+\.\d+\.\d+$/.test(APP_VERSION), APP_VERSION);
    ok('存档导出/导入往返', (() => {
      const round = mergeSave(defaultSave(), JSON.parse(JSON.stringify({ save: app.save })).save);
      return !!round.levels && !!round.settings && !!round.unlocks;
    })());
    ok('自动备份键', BACKUP_KEY === SAVE_KEY + '.backup', BACKUP_KEY);

    const holder3 = h('div', { style: { position: 'fixed', left: '-3000px', top: '0', width: '900px', height: '700px' } });
    document.body.appendChild(holder3);
    let wsRes = null;
    try {
      const sess3 = WS.create({
        puzzle: WS.PUZZLES[1], settings: { ...app.save.settings }, showIntro: false,
        onBack: () => {}, onComplete: (r) => { wsRes = r; },
      }).mount(holder3);
      await new Promise((r) => setTimeout(r, 120));
      sess3.addHarmonic(1); sess3.setCoeff(1, 'amp', 1);
      sess3.addHarmonic(-1); sess3.setCoeff(-1, 'amp', 0.45);
      sess3.recompute(); sess3.rebuildSide();
      ok('工坊会话误差', sess3.error != null && sess3.error < 0.001, sess3.error);
      ok('工坊会话三星', sess3.stars === 3, sess3.stars);
      sess3.settle();
      await new Promise((r) => setTimeout(r, 60));
      ok('工坊会话结算', wsRes && wsRes.stars === 3);
      sess3.destroy();
    } catch (e) {
      ok('工坊会话集成', false, e.message + '\n' + (e.stack || ''));
    }
    holder3.remove();

    // 讲义：数据 + 演示
    ok('讲义 9 节', HP.lessons.LESSONS.length === 9);
    ok('讲义配置完整', HP.lessons.LESSONS.every((l) => l.demo && l.demo.kind && l.paragraphs.length >= 2 && l.demo.control));
    ok('工坊公式齐全', HP.workshop.PUZZLES.every((p) => !!p.formula));
    ok('讲义公式为 TeX', HP.lessons.LESSONS.every((l) => l.paragraphs.every((p) => !p.f || (p.f.indexOf('<') < 0 && p.f.indexOf('&nbsp;') < 0))));
    {
      const fsvg = HP.formula.svg('z(t) = \\sum_{k} c_k\\, e^{2\\pi i k t}');
      ok('公式渲染为 SVG', fsvg.indexOf('<svg') === 0 && fsvg.indexOf('Σ') > 0 && fsvg.indexOf('font-family') > 0);
    }
    const holder4 = h('div', { style: { position: 'fixed', left: '-3000px', top: '0', width: '900px', height: '700px' } });
    const lcv = h('canvas', { style: { width: '400px', height: '300px' } });
    holder4.appendChild(lcv);
    document.body.appendChild(holder4);
    try {
      let readout = '';
      const demo = HP.lessons.createDemo(lcv, HP.lessons.LESSONS[0], {
        settings: { ...app.save.settings }, onReadout: (html) => { readout = html; },
      });
      await new Promise((r) => setTimeout(r, 80));
      ok('讲义演示运行', readout.indexOf('K =') >= 0, readout);
      demo.setParam(20);
      await new Promise((r) => setTimeout(r, 40));
      ok('讲义参数联动', readout.indexOf('K = 20') >= 0, readout);
      demo.destroy();
      const gcv = h('canvas', { style: { width: '400px', height: '300px' } });
      holder4.appendChild(gcv);
      let gout = '';
      const gdemo = HP.lessons.createDemo(gcv, HP.lessons.LESSONS[6], {
        settings: { ...app.save.settings }, onReadout: (html) => { gout = html; },
      });
      await new Promise((r) => setTimeout(r, 40));
      ok('吉布斯演示', gout.indexOf('峰值') >= 0, gout);
      gdemo.destroy();
    } catch (e) {
      ok('讲义集成', false, e.message + '\n' + (e.stack || ''));
    }
    holder4.remove();

    const fails = out.filter((x) => !x.ok);
    document.body.innerHTML = '';
    const pre = document.createElement('pre');
    pre.id = 'selftest-result';
    pre.style.cssText = 'white-space:pre-wrap;font:13px/1.6 monospace;padding:20px;color:#d8ecff;background:#050b16';
    pre.textContent = out.map((x) => (x.ok ? 'OK   ' : 'FAIL ') + x.name + (x.extra ? '  ' + x.extra : '')).join('\n') +
      `\n\nTOTAL ${out.length}  FAIL ${fails.length}`;
    document.body.appendChild(pre);
    document.title = fails.length ? 'SELFTEST:FAIL:' + fails.length : 'SELFTEST:OK';
    return { out, fails };
  }

  /* ========================= 启动 ========================= */
  function boot() {
    app.save = loadSave();
    if (dev.reset) {
      app.save = defaultSave();
      try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    }
    if (dev.theme) app.save.settings.theme = dev.theme;
    if (dev.wtab) { app.ws = { tab: dev.wtab, chapter: dev.wch || 1 }; }
    if (dev.gtab) app.galleryTab = dev.gtab;
    if (DEV.get('seed') === 'played') {
      // 仅供视觉验收：构造一份“已游玩”的存档
      for (const id of D.levelIds()) {
        const lv = D.LEVELS[id];
        const hsh = C.hashString(id);
        const stars = Math.min(3, (hsh % 3) + 1 + (lv.index === 0 ? 1 : 0));
        const baseErr = stars === 3 ? 0.0035 + (hsh % 14) / 1000 : stars === 2 ? 0.024 + (hsh % 20) / 1000 : 0.055 + (hsh % 35) / 1000;
        app.save.levels[id] = {
          stars,
          err: baseErr,
          count: Math.max(1, Math.round(lv.budget * (0.45 + (hsh % 50) / 100))),
          time: 22 + (hsh % 40),
          plays: 2,
        };
      }
      for (const r of D.READINGS.slice(0, 5)) app.save.reading[r.id] = { at: 1, attempts: 1 };
      for (const p of HP.workshop.TUTORIALS.slice(0, 4)) app.save.workshop[p.id] = { stars: 3, err: 0.004, count: p.budget, time: 40 };
      for (const p of HP.workshop.FORMAL.slice(0, 9)) app.save.workshop[p.id] = { stars: 2, err: 0.031, count: p.budget, time: 36 };
      for (const p of HP.workshop.SUPER.slice(0, 2)) app.save.workshop[p.id] = { stars: 1, err: 0.09, count: p.budget, time: 88 };
      for (const l of HP.lessons.LESSONS.slice(0, 7)) app.save.lessons[l.id] = 1;
      app.save.unlocks = { brushes: ['glow', 'neon', 'ink'], themes: ['scope', 'neon', 'paper'], trails: ['basic', 'spark'] };
      for (const a of D.ACHIEVEMENTS.slice(0, 8)) app.save.achievements[a.id] = 1;
      app.save.daily = { date: todayStr(), stars: 2, err: 0.031, count: 12, time: 40, streak: 3, lastDate: todayStr() };
      app.save.stats = { plays: 42, time: 3600, bestErr: 0.0021 };
    }
    applySettings();
    refreshUnlocks(false);
    backupSave();

    if (dev.selftest) {
      document.body.innerHTML = '<div style="color:#9fd8ff;font:14px sans-serif;padding:20px">正在自检…</div>';
      runSelfTest();
      return;
    }

    installDock();
    if (!location.hash) {
      let initial = 'home';
      if (dev.screen === 'play') initial = 'play/level/' + (dev.level || '2-1');
      else if (dev.screen === 'sandbox') initial = 'play/sandbox';
      else if (dev.screen === 'reading') initial = dev.id ? 'reading/' + dev.id : 'reading';
      else if (dev.screen === 'workshop') initial = dev.id ? 'workshop/' + dev.id : 'workshop';
      else if (dev.screen === 'lessons') initial = dev.id ? 'lessons/' + dev.id : 'lessons';
      else if (dev.screen === 'playdaily') initial = 'play/daily';
      else if (dev.screen) initial = dev.screen;
      history.replaceState(null, '', '#/' + initial);
    }
    global.addEventListener('hashchange', renderRoute);
    renderRoute();
  }

  HP.app = {
    app, boot, renderRoute, navigate, getDailyInfo, handleResult,
    totalStars, chapterCleared, isLevelUnlocked, dev,
    version: APP_VERSION,
    fireConfetti,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof globalThis !== 'undefined' ? globalThis : this);
