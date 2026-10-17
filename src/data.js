/* =========================================================
 * 谐波画笔 · 关卡与文案数据 data.js
 * ========================================================= */
(function (global) {
  'use strict';
  const HP = (global.HP = global.HP || {});

  const CHAPTERS = [
    {
      id: 1, key: 'c1', name: '圆的秘密', en: 'CIRCLES',
      subtitle: '一个圆，就是一个谐波',
      color: '#57e6ff', accent: '#9b8cff',
      desc: '从最简单的圆开始，认识幅度、相位和 0 阶圆。',
    },
    {
      id: 2, key: 'c2', name: '多边形与谐波', en: 'POLYGONS',
      subtitle: '尖角来自高频',
      color: '#68ffb0', accent: '#3fd0ff',
      desc: '正方形、三角形、六边形：对称性决定哪些频率出现。',
    },
    {
      id: 3, key: 'c3', name: '笔画与曲线', en: 'STROKES',
      subtitle: '单笔闭合的形状',
      color: '#ffd166', accent: '#ff9f43',
      desc: '字母、汉字与心形：起笔、笔顺与相位的关系。',
    },
    {
      id: 4, key: 'c4', name: '自然之形', en: 'NATURE',
      subtitle: '低频轮廓，高频细节',
      color: '#ff7ad9', accent: '#ff5e7e',
      desc: '枫叶、金鱼、蝴蝶：锯齿与细节属于高频。',
    },
    {
      id: 5, key: 'c5', name: '大师之路', en: 'MASTER',
      subtitle: '用几百个圆作画',
      color: '#b78bff', accent: '#57e6ff',
      desc: '雪花、徽章与曼陀罗：低频框架 + 高频装饰。',
    },
  ];

  const LEVELS = {
    '1-1': {
      chapter: 1, index: 0, name: '圆', shape: 'circle', budget: 1,
      teach: '第一个圆',
      text: '任意一个圆，只要一个旋转的圆就能画出来。这个圆的半径，就是第一谐波的幅度 |c₁|——第一谐波越强，圆越大。',
      hint: '贴着虚线慢慢描一圈，误差自然就下去了。',
      criteria: '误差 ≤ 2% 且 ≤ 1 个圆',
    },
    '1-2': {
      chapter: 1, index: 1, name: '椭圆', shape: 'ellipse', budget: 5,
      teach: '把圆压扁',
      text: '椭圆需要一对旋转方向相反的圆（k=+1 与 k=-1）叠加，长度在伸缩，圆就被「压扁」了。两个圆的方向相反，正是共轭对称 c₋ₖ = conj(cₖ) 的样子。',
      hint: '椭圆的长短轴比，就是正、反两个圆的半径差。',
      criteria: '误差 ≤ 2% 且 ≤ 5 个圆',
    },
    '1-3': {
      chapter: 1, index: 2, name: '偏移圆', shape: 'offsetCircle', budget: 3,
      teach: '0 阶圆负责平移',
      text: '这个圆不在画面中央。0 阶谐波（DC 分量）不改变形状，只把整个图形平移过去。把它关掉试试：圆会跳回原点，形状一模一样。',
      hint: '在频谱面板里找到 k=0，它只负责位置。',
      criteria: '误差 ≤ 2% 且 ≤ 3 个圆',
    },
    '1-B': {
      chapter: 1, index: 3, name: '双圆环', shape: 'twin', budget: 12, boss: true, timeLimit: 90,
      teach: 'Boss · 两个圆连在一起',
      text: '两个圆粘在一起，交界处是两个圆弧的相切。圆数够多，接缝才会圆润。限时 90 秒。',
      hint: '先描外圈，再处理中间的接缝。',
      criteria: '限时 90 秒 · 误差 ≤ 2% 且 ≤ 12 个圆',
    },

    '2-1': {
      chapter: 2, index: 0, name: '正方形', shape: 'square', budget: 15,
      teach: '尖角需要高频',
      text: '正方形的频谱里主要是奇次谐波（1、3、5、7…）。圆数越多，角越尖；圆数不够时，角会被圆润地抹平。',
      hint: '留意角上的「过冲」：把圆数调到 5 以下，看看角怎么消失。',
      criteria: '误差 ≤ 2% 且 ≤ 15 个圆',
    },
    '2-2': {
      chapter: 2, index: 1, name: '三角形', shape: 'triangle', budget: 15,
      teach: '另一种奇谐波组合',
      text: '三角形与正方形都靠奇次谐波，但三角的相位不同，尖角指向也就不同。',
      hint: '如果角上总是差一点点，是吉布斯现象，多给几个圆就好。',
      criteria: '误差 ≤ 2% 且 ≤ 15 个圆',
    },
    '2-3': {
      chapter: 2, index: 2, name: '六边形', shape: 'hexagon', budget: 18,
      teach: '对称性决定频谱',
      text: '正六边形有六重对称，它的频谱只会在特定的谐波上出现。形状的对称性，决定了配料表里有哪几种「料」。',
      hint: '六边形的频谱比正方形干净得多，试试更少的圆。',
      criteria: '误差 ≤ 2% 且 ≤ 18 个圆',
    },
    '2-B': {
      chapter: 2, index: 3, name: '八芒星', shape: 'star8', budget: 40, boss: true, timeLimit: 120,
      teach: 'Boss · 八个尖角',
      text: '八个尖角、八条尖谷。八重对称让频谱按 8 的倍数聚成一簇一簇。限时 120 秒。',
      hint: '每个尖角都要给足高频圆，不然会变成八瓣花。',
      criteria: '限时 120 秒 · 误差 ≤ 2% 且 ≤ 40 个圆',
    },

    '3-1': {
      chapter: 3, index: 0, name: '字母 A', shape: 'letterA', budget: 40,
      teach: '笔顺与相位',
      text: '这是一笔画完的 A：从底左出发，经过顶点，回到横杠，再沿左腿回到起点。你从哪儿起笔、往哪个方向走，不会改变形状，但会改变每个圆的初相位。',
      hint: '从任意一点起笔都可以，游戏会自动对齐起点与方向。',
      criteria: '误差 ≤ 2% 且 ≤ 40 个圆',
    },
    '3-2': {
      chapter: 3, index: 1, name: '汉字「工」', shape: 'gong', budget: 60,
      teach: '直角与线段',
      text: '三个直角、三段直线。直角是「高频大户」：角的数量越多，需要的谐波就越多。',
      hint: '如果三横的端头总是圆的，就是高频圆不够。',
      criteria: '误差 ≤ 2% 且 ≤ 60 个圆',
    },
    '3-3': {
      chapter: 3, index: 2, name: '心形', shape: 'heart', budget: 60,
      teach: '低频轮廓 + 高频细节',
      text: '心形的主体是一条平滑的低频曲线，只有顶部的凹口需要一点高频。好的频谱是「大部分圆很小」的。',
      hint: '看看频谱：是不是只有少数几根柱子特别高？',
      criteria: '误差 ≤ 2% 且 ≤ 60 个圆',
    },
    '3-B': {
      chapter: 3, index: 3, name: '音符', shape: 'note', budget: 80, boss: true, timeLimit: 150,
      teach: 'Boss · 一笔音符',
      text: '圆头、长杆、旗子，一笔画完。圆与直线的交界最难描，也是频谱里高频最集中的地方。限时 150 秒。',
      hint: '先描圆头，再描杆和旗。',
      criteria: '限时 150 秒 · 误差 ≤ 2% 且 ≤ 80 个圆',
    },

    '4-1': {
      chapter: 4, index: 0, name: '枫叶', shape: 'maple', budget: 120,
      teach: '锯齿属于高频',
      text: '枫叶的锯齿边缘是高频成分，整体轮廓是低频成分。试着把圆数从 120 往下调：锯齿会先消失，叶子的轮廓还留着。',
      hint: '如果锯齿被抹平了，就是高频圆不够。',
      criteria: '误差 ≤ 2% 且 ≤ 120 个圆',
    },
    '4-2': {
      chapter: 4, index: 1, name: '金鱼', shape: 'goldfish', budget: 150,
      teach: '尖尾与鱼鳍',
      text: '鱼尾的两个尖、背鳍的折角，都需要很多高频圆。低频圆先画出身体，高频圆补上细节。',
      hint: '先描身体的大轮廓，再描尾巴的尖。',
      criteria: '误差 ≤ 2% 且 ≤ 150 个圆',
    },
    '4-3': {
      chapter: 4, index: 2, name: '蝴蝶', shape: 'butterfly', budget: 180,
      teach: '对称可以省一半圆',
      text: '蝴蝶左右对称。对称的曲线，频谱里的圆会成对出现、方向相反——这正是共轭对称。',
      hint: '左右翅膀的弧度要一样，误差才小。',
      criteria: '误差 ≤ 2% 且 ≤ 180 个圆',
    },
    '4-B': {
      chapter: 4, index: 3, name: '螺旋星系', shape: 'galaxy', budget: 200, boss: true, timeLimit: 180,
      teach: 'Boss · 两条旋臂',
      text: '两条旋臂从星核甩出去，越靠外越细。旋臂是很长的曲线，需要高频圆去跟住它。限时 180 秒。',
      hint: '顺着旋臂从中心往外描，不要跳着描。',
      criteria: '限时 180 秒 · 误差 ≤ 2% 且 ≤ 200 个圆',
    },

    '5-1': {
      chapter: 5, index: 0, name: '雪花', shape: 'snowflake', budget: 200,
      teach: '六重旋转对称',
      text: '六条主枝、十二条分叉。六重对称让频谱按特定间隔出现。细枝是极高频，缺了它们，雪花会变成「米」字。',
      hint: '细枝要贴着描，任何一根分叉都别漏。',
      criteria: '误差 ≤ 2% 且 ≤ 200 个圆',
    },
    '5-2': {
      chapter: 5, index: 1, name: '复杂徽章', shape: 'badge', budget: 300,
      teach: '低频框架 + 高频装饰',
      text: '十六个齿轮牙是高频装饰，整体圆形是低频框架。大师关卡的秘密：先让低频圆把大形端正，再用高频圆雕牙。',
      hint: '牙尖如果糊成一圈，说明高频圆不够。',
      criteria: '误差 ≤ 2% 且 ≤ 300 个圆',
    },
    '5-3': {
      chapter: 5, index: 2, name: '星夜回旋', shape: 'nightSwirl', budget: 400,
      teach: '单线名画轮廓',
      text: '一条盘旋而出的长线，像《星夜》里的漩涡（自绘轮廓）。线越长，越需要高频圆跟住它的每一段弯曲。',
      hint: '这条路很长，别急，从中心一圈一圈往外描。',
      criteria: '误差 ≤ 2% 且 ≤ 400 个圆',
    },
    '5-B': {
      chapter: 5, index: 3, name: '星海曼陀罗', shape: 'mandala', budget: 500, boss: true, timeLimit: 240,
      teach: '最终 Boss · 五百个圆',
      text: '二十四重花瓣、三十六重细齿。这是《谐波画笔》的最后一关：把五百个圆交给你的手。限时 240 秒。',
      hint: '先描外沿的大花瓣，再补每一层细齿。',
      criteria: '限时 240 秒 · 误差 ≤ 2% 且 ≤ 500 个圆',
    },
  };

  // 修正关卡字段
  for (const id of Object.keys(LEVELS)) {
    const lv = LEVELS[id];
    lv.id = id;
    lv.name = lv.name;
    lv.label = id.replace('-B', '-B').toUpperCase();
    lv.no = id;
  }

  const ACHIEVEMENTS = [
    { id: 'first_clear', name: '初次谐波', icon: '✧', desc: '完成任意一关' },
    { id: 'first_three', name: '三星学徒', icon: '★', desc: '任意关卡获得三星' },
    { id: 'perfect', name: '完美复现', icon: '◉', desc: '误差 ≤ 0.5% 且获得三星' },
    { id: 'minimalist', name: '极简主义', icon: '◇', desc: '三星且圆数不超过预算的一半' },
    { id: 'gibbs', name: '吉布斯信徒', icon: '≈', desc: '在正方形或三角形关获得三星' },
    { id: 'spectrum', name: '频谱侦探', icon: '▤', desc: '读谱师答对 5 题' },
    { id: 'reading_all', name: '读谱大师', icon: '▥', desc: '答对全部 24 道读谱题' },
    { id: 'daily', name: '每日一形', icon: '☀', desc: '完成一次每日挑战' },
    { id: 'daily_7', name: '七日之约', icon: '☼', desc: '连续挑战每日一形 7 天' },
    { id: 'chapter1', name: '第一章毕业', icon: 'Ⅰ', desc: '通关第一章（含 Boss）' },
    { id: 'all_chapters', name: '谐波学院', icon: '✺', desc: '通关全部五章' },
    { id: 'all_three', name: '满星学院', icon: '✦', desc: '全部 20 关获得三星' },
    { id: 'sandbox500', name: '五百个圆', icon: '500', desc: '在沙盒中使用 500 个圆' },
    { id: 'collector', name: '收藏家', icon: '❖', desc: '解锁全部画笔、主题与尾迹' },
    { id: 'fast', name: '一气呵成', icon: '⚡', desc: '单关 20 秒内完成并三星' },
    { id: 'no_snap', name: '徒手描摹', icon: '✎', desc: '关闭吸附辅助并三星' },
    { id: 'workshop_first', name: '频谱炼金术士', icon: '⚗', desc: '完成一个频谱工坊配方' },
    { id: 'workshop_all', name: '配器入门', icon: '⋔', desc: '完成全部 7 个教程配方' },
    { id: 'workshop_formal_10', name: '正式学徒', icon: '⌁', desc: '完成 10 个正式工坊配方' },
    { id: 'workshop_formal_all', name: '配器工程师', icon: '⌘', desc: '完成全部 60 个正式配方' },
    { id: 'workshop_super_5', name: '盲配挑战者', icon: '◈', desc: '完成 5 个超难配方' },
    { id: 'workshop_super_all', name: '曼陀罗师', icon: '✹', desc: '完成全部 24 个超难配方' },
    { id: 'workshop_perfect', name: '零误差', icon: '∅', desc: '工坊误差 ≤ 0.2% 且三星' },
    { id: 'lessons_all', name: '学院旁听', icon: '∑', desc: '读完 9 节傅里叶讲义' },
  ];

  const BRUSHES = [
    { id: 'glow', name: '光绘', desc: '发光的青色笔迹', require: null },
    { id: 'neon', name: '霓虹', desc: '双层霓虹描边', require: { wsFormal: 5 } },
    { id: 'ink', name: '水墨', desc: '浓淡变化的墨线', require: { wsFormal: 20 } },
  ];

  const THEMES = [
    { id: 'scope', name: '示波器', desc: '深蓝网格与青色光晕', require: null },
    { id: 'neon', name: '霓虹夜', desc: '紫红霓虹、无网格', require: { wsFormal: 10 } },
    { id: 'paper', name: '纸墨', desc: '米白纸面、墨色笔迹', require: { wsFormal: 30 } },
  ];

  const TRAILS = [
    { id: 'basic', name: '光点', desc: '干净的笔尖光点', require: null },
    { id: 'spark', name: '星尘', desc: '笔尖洒出星尘粒子', require: { wsSuper: 3 } },
  ];

  const READINGS = [
    {
      id: 'r1', title: '第二根柱子',
      recipe: [{ k: 1, amp: 1 }, { k: 2, amp: 0.42 }],
      options: [
        [{ k: 1, amp: 1 }, { k: 2, amp: 0.42 }],
        [{ k: 1, amp: 1 }, { k: 3, amp: 0.42 }],
        [{ k: 1, amp: 1 }, { k: 4, amp: 0.42 }],
        [{ k: 1, amp: 1 }],
      ],
      explain: '第二根柱子在 k=2：这个圆每圈转 2 圈，与主圆合成一个鼓包。k=3、k=4 会合成两个、三个鼓包。',
    },
    {
      id: 'r2', title: '三根柱子',
      recipe: [{ k: 1, amp: 1 }, { k: 3, amp: 0.35 }, { k: 5, amp: 0.16 }],
      options: [
        [{ k: 1, amp: 1 }, { k: 3, amp: 0.35 }, { k: 5, amp: 0.16 }],
        [{ k: 1, amp: 1 }, { k: 2, amp: 0.35 }, { k: 4, amp: 0.16 }],
        [{ k: 1, amp: 1 }, { k: 4, amp: 0.35 }, { k: 6, amp: 0.16 }],
        [{ k: 2, amp: 1 }, { k: 4, amp: 0.35 }, { k: 6, amp: 0.16 }],
      ],
      explain: '柱子出现在 1、3、5：主圆每圈 1 圈，另外两个圆分别每圈 3 圈和 5 圈，于是出现了 2 个鼓包与更细的波纹。',
    },
    {
      id: 'r3', title: '第四谐波',
      recipe: [{ k: 1, amp: 1 }, { k: 4, amp: 0.4 }],
      options: [
        [{ k: 1, amp: 1 }, { k: 4, amp: 0.4 }],
        [{ k: 1, amp: 1 }, { k: 3, amp: 0.4 }],
        [{ k: 1, amp: 1 }, { k: 5, amp: 0.4 }],
        [{ k: 1, amp: 1 }, { k: 2, amp: 0.4 }],
      ],
      explain: '第四谐波（k=4）会在主圆上压出 3 个鼓包。k 越大，鼓包越密。',
    },
    {
      id: 'r4', title: '反方向的圆',
      recipe: [{ k: 1, amp: 1 }, { k: -2, amp: 0.4 }],
      options: [
        [{ k: 1, amp: 1 }, { k: -2, amp: 0.4 }],
        [{ k: 1, amp: 1 }, { k: 2, amp: 0.4 }],
        [{ k: 1, amp: 1 }, { k: -3, amp: 0.4 }],
        [{ k: 1, amp: 1 }, { k: 3, amp: 0.4 }],
      ],
      explain: '柱子在 k 的负半轴：这个圆是反着转的。正负成对、方向相反的圆，正是共轭对称，合起来会变成伸缩的连杆。',
    },
    {
      id: 'r5', title: '谁更大',
      recipe: [{ k: 1, amp: 0.55 }, { k: 2, amp: 1 }],
      options: [
        [{ k: 1, amp: 0.55 }, { k: 2, amp: 1 }],
        [{ k: 1, amp: 1 }, { k: 2, amp: 0.55 }],
        [{ k: 1, amp: 0.55 }, { k: 3, amp: 1 }],
        [{ k: 2, amp: 1 }],
      ],
      explain: '柱子高度就是圆的半径。这里 k=2 的柱子更高，所以主轮廓由转两圈的那个圆主导，形状更像一个「8」字。',
    },
    {
      id: 'r6', title: '三层花瓣',
      recipe: [{ k: 1, amp: 1 }, { k: 2, amp: 0.5 }, { k: 4, amp: 0.22 }],
      options: [
        [{ k: 1, amp: 1 }, { k: 2, amp: 0.5 }, { k: 4, amp: 0.22 }],
        [{ k: 1, amp: 1 }, { k: 3, amp: 0.5 }, { k: 6, amp: 0.22 }],
        [{ k: 1, amp: 1 }, { k: 2, amp: 0.5 }, { k: 5, amp: 0.22 }],
        [{ k: 1, amp: 1 }, { k: 4, amp: 0.5 }, { k: 2, amp: 0.22 }],
      ],
      explain: '1、2、4 三根柱子：主圆加一个两圈的圆，再加一个四圈的圆。柱子越靠右，细节越密。',
    },
    {
      id: 'r7', title: '高频细纹',
      recipe: [{ k: 1, amp: 1 }, { k: 6, amp: 0.3 }, { k: 11, amp: 0.14 }],
      options: [
        [{ k: 1, amp: 1 }, { k: 6, amp: 0.3 }, { k: 11, amp: 0.14 }],
        [{ k: 1, amp: 1 }, { k: 5, amp: 0.3 }, { k: 9, amp: 0.14 }],
        [{ k: 1, amp: 1 }, { k: 7, amp: 0.3 }, { k: 10, amp: 0.14 }],
        [{ k: 1, amp: 1 }, { k: 4, amp: 0.3 }, { k: 8, amp: 0.14 }],
      ],
      explain: '高处的柱子（k=6、11）会在圆上刻出很密的细纹。柱子越往右，纹理越密。',
    },
    {
      id: 'r8', title: '完整的配料表',
      recipe: [{ k: 1, amp: 1 }, { k: 2, amp: 0.35 }, { k: 3, amp: 0.2 }, { k: 5, amp: 0.12 }],
      options: [
        [{ k: 1, amp: 1 }, { k: 2, amp: 0.35 }, { k: 3, amp: 0.2 }, { k: 5, amp: 0.12 }],
        [{ k: 1, amp: 1 }, { k: 2, amp: 0.35 }, { k: 4, amp: 0.2 }, { k: 6, amp: 0.12 }],
        [{ k: 1, amp: 1 }, { k: 3, amp: 0.35 }, { k: 4, amp: 0.2 }, { k: 6, amp: 0.12 }],
        [{ k: 1, amp: 1 }, { k: 2, amp: 0.12 }, { k: 3, amp: 0.2 }, { k: 5, amp: 0.35 }],
      ],
      explain: '1、2、3、5 四根柱子，高度依次递减。读谱就是读这张「配料表」：哪根柱子高，哪个频率就说了算。',
    },
  ];

  HP.data = {
    CHAPTERS, LEVELS, ACHIEVEMENTS, BRUSHES, THEMES, TRAILS, READINGS,
    STAR_3: 0.02, STAR_2: 0.05, STAR_1: 0.10,
    MAX_K: 500,
    chapterLevels(chapterId) {
      return Object.keys(LEVELS).filter((id) => LEVELS[id].chapter === chapterId)
        .sort((a, b) => LEVELS[a].index - LEVELS[b].index);
    },
    levelIds() {
      return Object.keys(LEVELS).sort((a, b) => {
        const A = LEVELS[a], B = LEVELS[b];
        return A.chapter - B.chapter || A.index - B.index;
      });
    },
    nextLevel(id) {
      const ids = HP.data.levelIds();
      const i = ids.indexOf(id);
      return i >= 0 && i + 1 < ids.length ? ids[i + 1] : null;
    },
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
