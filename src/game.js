"use strict";
/* ============================================================
   机甲防线 MECHA FRONTLINE v4 — 真 3D（Three.js / WebGL）
   玩法：Thronefall（可操纵指挥机）× Tower Madness（开放地形迷宫）
   美术：程序化建模机体 + 实时光影 + 可旋转轨道镜头
   ============================================================ */
const CELL = 40, COLS = 20, ROWS = 12;
const W2 = COLS * CELL / 2, H2 = ROWS * CELL / 2;

/* ---------- 地图：目标 & 入侵口 ---------- */
const GOAL = { c: 19, r: 6 };
const SPAWNS = [
  { c: 0,  r: 6,  from: 1 },
  { c: 10, r: 0,  from: 7 }
];
const goalPx = { x: (GOAL.c + 0.5) * CELL, y: (GOAL.r + 0.5) * CELL };
function spawnActive(s, wave) { return wave >= s.from; }
function isReserved(c, r) {
  if (c === GOAL.c && r === GOAL.r) return true;
  return SPAWNS.some(s => s.c === c && s.r === r);
}

/* ---------- 机体（塔）定义 ---------- */
const TOWERS = {
  gm: {
    name:'EVA量产机', cost:100,
    desc:'SEELE量产型EVA，白色无眼机体。机枪高射速点射，成群列阵兼作迷宫壁。',
    range:[125,135,150], dmg:[12,21,36], rate:[0.32,0.28,0.24], pierce:0,
    up:[80,150], kind:'gun', air:true, muzzle:22
  },
  sniper: {
    name:'EVA零号机', cost:180,
    desc:'零号机（改）。阳电子狙击枪超远程精确射击，完全穿透使徒装甲——八岛作战再现。',
    range:[250,270,290], dmg:[90,155,265], rate:[1.8,1.7,1.6], pierce:1,
    up:[150,260], kind:'snipe', air:true, muzzle:20
  },
  funnel: {
    name:'EVA8号机', cost:260,
    desc:'8号机。多联装转管机炮同时锁定 3 个目标扫射。',
    range:[165,180,195], dmg:[15,26,44], rate:[0.5,0.45,0.4], pierce:0.5,
    up:[210,360], kind:'funnel', air:true, muzzle:18
  },
  cannon: {
    name:'EVA二号机', cost:220,
    desc:'2号机，近接战特化。肩扛火箭炮范围溅射，克制密集地面使徒。⚠ 无法对空。',
    range:[155,168,182], dmg:[38,66,110], rate:[1.4,1.3,1.2], pierce:0, splash:[62,74,88],
    up:[180,320], kind:'cannon', air:false, muzzle:14
  },
  atfield: {
    name:'EVA Mark.06', cost:150,
    desc:'月面制造的Mark.06。头顶光环展开反A.T.力场，大幅减速范围内使徒（含飞行）。不造成伤害。',
    range:[105,122,140], dmg:[0,0,0], rate:[1,1,1], pierce:0, slow:[0.58,0.46,0.34],
    up:[130,220], kind:'slow', air:true, muzzle:20
  },
  eva: {
    name:'EVA第13号机', cost:550,
    desc:'禁忌的13号机。双管步枪高出力射击，15%几率觉醒造成3倍伤害。',
    range:[195,210,225], dmg:[200,340,560], rate:[2.2,2.0,1.8], pierce:0.6,
    up:[420,720], kind:'eva', air:true, muzzle:26
  }
};
const TOWER_KEYS = Object.keys(TOWERS);

/* ---------- 指挥机 ---------- */
const HERO_LV = [
  { dmg: 32, hp: 320, ab: 140, range: 150 },
  { dmg: 58, hp: 480, ab: 240, range: 160 },
  { dmg: 95, hp: 700, ab: 380, range: 170 }
];
const HERO_UP = [220, 380];
const HERO_ABILITY_CD = 8, HERO_ABILITY_R = 95;

/* ---------- 敌机定义 ---------- */
const ENEMIES = {
  drone:  { name:'第4使徒·沙姆谢尔', hp:42,  spd:95,  armor:0,  bounty:8,   r:9,  fly:true  },
  soldier:{ name:'第3使徒·萨基尔', hp:105, spd:62,  armor:2,  bounty:13,  r:12, fly:false },
  runner: { name:'第9使徒·马特里尔', hp:70,  spd:135, armor:0,  bounty:11,  r:10, fly:false },
  heavy:  { name:'第13使徒·巴尔迪尔', hp:320, spd:40,  armor:9,  bounty:28,  r:14, fly:false },
  gunship:{ name:'第10使徒·萨哈魁尔', hp:230, spd:58,  armor:4,  bounty:24,  r:13, fly:true  },
  angel:  { name:'第5使徒·拉米尔',  hp:1600,spd:32,  armor:6,  bounty:160, r:20, fly:false, boss:true, shield:420,  regen:32 },
  bigangel:{name:'第14使徒·塞路尔',hp:7000,spd:25,  armor:12, bounty:600, r:28, fly:false, boss:true, shield:1600, regen:65 }
};

/* ---------- 波次 ---------- */
function grp(type, n, gap) { return { type, n, gap }; }
const WAVE_DEFS = [
  [grp('drone',8,0.9)],
  [grp('drone',10,0.8), grp('soldier',4,1.0)],
  [grp('soldier',10,0.85), grp('drone',6,0.6)],
  [grp('runner',8,0.7), grp('soldier',6,0.9)],
  [grp('drone',8,0.5), grp('angel',1,1)],
  [grp('gunship',3,1.6), grp('soldier',10,0.75)],
  [grp('heavy',4,1.4), grp('runner',8,0.55)],
  [grp('drone',14,0.4), grp('gunship',4,1.3)],
  [grp('heavy',6,1.2), grp('soldier',12,0.65)],
  [grp('heavy',4,1.3), grp('angel',1,1)],
  [grp('runner',14,0.45), grp('gunship',5,1.1)],
  [grp('heavy',8,1.0), grp('runner',10,0.45)],
  [grp('soldier',18,0.5), grp('drone',16,0.32)],
  [grp('gunship',8,0.9), grp('heavy',8,0.95)],
  [grp('soldier',12,0.55), grp('angel',2,4)],
  [grp('heavy',12,0.8), grp('runner',12,0.4)],
  [grp('runner',20,0.32), grp('gunship',8,0.8)],
  [grp('heavy',14,0.72), grp('angel',1,1)],
  [grp('drone',20,0.28), grp('runner',16,0.32), grp('heavy',10,0.75), grp('gunship',6,0.8)],
  [grp('heavy',8,0.85), grp('angel',2,5), grp('bigangel',1,1)]
];
const TOTAL_WAVES = WAVE_DEFS.length;
function hpScale(w) { return 1 + (w - 1) * 0.16; }
function waveHasBoss(w) { return WAVE_DEFS[w-1].some(g => ENEMIES[g.type].boss); }

/* ============================================================
   Three.js 场景
   ============================================================ */
const stage = document.getElementById('stage');
const glCanvas = document.getElementById('gl');
const ov = document.getElementById('ov');
const octx = ov.getContext('2d');

const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05070c);
scene.fog = new THREE.Fog(0x05070c, 900, 2100);

const camera = new THREE.PerspectiveCamera(45, 16/9, 5, 4000);
const ORBIT = {
  az: -Math.PI / 4, pol: 0.8, dist: 790,
  target: new THREE.Vector3(0, 0, 0),
  AZ0: -Math.PI / 4, POL0: 0.8, DIST0: 790
};
function updateCamera() {
  const t = ORBIT.target;
  camera.position.set(
    t.x + ORBIT.dist * Math.sin(ORBIT.pol) * Math.sin(ORBIT.az),
    t.y + ORBIT.dist * Math.cos(ORBIT.pol),
    t.z + ORBIT.dist * Math.sin(ORBIT.pol) * Math.cos(ORBIT.az)
  );
  camera.lookAt(t);
}
updateCamera();

/* 光照 */
scene.add(new THREE.HemisphereLight(0x7a9cc9, 0x1a1512, 0.7));
const sun = new THREE.DirectionalLight(0xfff2dd, 1.5);
sun.position.set(320, 560, 180);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -560; sun.shadow.camera.right = 560;
sun.shadow.camera.top = 420; sun.shadow.camera.bottom = -420;
sun.shadow.camera.near = 50; sun.shadow.camera.far = 1500;
sun.shadow.bias = -0.0006;
scene.add(sun);

/* 坐标：游戏平面 (x,y) → 世界 (x-W2, z, y-H2)，z 为高度 */
function gw(x, y, z) { return new THREE.Vector3(x - W2, z || 0, y - H2); }
const _pv = new THREE.Vector3();
function toScreen(x, y, z) {
  _pv.set(x - W2, z || 0, y - H2).project(camera);
  if (_pv.z > 1) return null;
  return { x: (_pv.x + 1) / 2 * ov.width, y: (-_pv.y + 1) / 2 * ov.height };
}

/* ---------- 地面与环境 ---------- */
(function buildGround() {
  // 棋盘格贴图
  const tc = document.createElement('canvas');
  tc.width = COLS * 32; tc.height = ROWS * 32;
  const g = tc.getContext('2d');
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
    g.fillStyle = (c + r) % 2 ? '#1b2433' : '#161e2b';
    g.fillRect(c*32, r*32, 32, 32);
    g.strokeStyle = 'rgba(120,160,210,0.16)';
    g.strokeRect(c*32 + 0.5, r*32 + 0.5, 31, 31);
  }
  for (let i = 0; i < 500; i++) {
    g.fillStyle = 'rgba(150,190,235,' + (0.02 + Math.random()*0.05) + ')';
    g.fillRect(Math.random()*tc.width, Math.random()*tc.height, 2, 2);
  }
  const tex = new THREE.CanvasTexture(tc);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(COLS*CELL, ROWS*CELL),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0.1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  // 外围暗色大地
  const outer = new THREE.Mesh(
    new THREE.PlaneGeometry(6000, 6000),
    new THREE.MeshStandardMaterial({ color: 0x0a0e15, roughness: 1 })
  );
  outer.rotation.x = -Math.PI / 2; outer.position.y = -0.5;
  outer.receiveShadow = true;
  scene.add(outer);
  // 发光边框
  const frame = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.PlaneGeometry(COLS*CELL, ROWS*CELL)),
    new THREE.LineBasicMaterial({ color: 0x4dd7ff, transparent: true, opacity: 0.5 })
  );
  frame.rotation.x = -Math.PI / 2; frame.position.y = 0.6;
  scene.add(frame);
  // 星空
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(360 * 3);
  for (let i = 0; i < 360; i++) {
    const a = Math.random() * Math.PI * 2, e = Math.random() * 0.9 + 0.08, R = 1700;
    starPos[i*3] = R * Math.cos(e) * Math.cos(a);
    starPos[i*3+1] = R * Math.sin(e);
    starPos[i*3+2] = R * Math.cos(e) * Math.sin(a);
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x8fb4d9, size: 2.2, sizeAttenuation: false, fog: false })));
})();

/* ---------- 材质 / 几何工具 ---------- */
const MATS = {}, GEOS = {};
function mat(color, o) {
  const key = 'm' + color + JSON.stringify(o || 0);
  if (!MATS[key]) MATS[key] = new THREE.MeshStandardMaterial(
    Object.assign({ color, metalness: 0.35, roughness: 0.55 }, o));
  return MATS[key];
}
function emat(color, i) {
  const key = 'e' + color + i;
  if (!MATS[key]) MATS[key] = new THREE.MeshStandardMaterial({
    color, emissive: color, emissiveIntensity: i || 1.8, metalness: 0.1, roughness: 0.4 });
  return MATS[key];
}
function geo(kind, ...a) {
  const key = kind + a.join(',');
  if (!GEOS[key]) GEOS[key] =
    kind === 'box'  ? new THREE.BoxGeometry(...a) :
    kind === 'cyl'  ? new THREE.CylinderGeometry(...a) :
    kind === 'sph'  ? new THREE.SphereGeometry(...a) :
    kind === 'cone' ? new THREE.ConeGeometry(...a) :
    kind === 'octa' ? new THREE.OctahedronGeometry(...a) :
    kind === 'tor'  ? new THREE.TorusGeometry(...a) :
    kind === 'cap'  ? new THREE.CapsuleGeometry(...a) : null;
  return GEOS[key];
}
function P(parent, kind, a, m, x, y, z, rx, ry, rz) {
  const mesh = new THREE.Mesh(geo(kind, ...a), m);
  mesh.position.set(x || 0, y || 0, z || 0);
  if (rx) mesh.rotation.x = rx;
  if (ry) mesh.rotation.y = ry;
  if (rz) mesh.rotation.z = rz;
  mesh.castShadow = true; mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

/* ============================================================
   程序化机体模型（Y 轴向上，机体面朝 +X）
   我方 = NERV 侧 EVA 机体；敌方 = 使徒
   turret 命名组 = 可旋转上半身
   ============================================================ */
function twoLegs(g, col, h, spread, rTop, rBot) {
  P(g, 'cyl', [rTop, rBot, h, 8], mat(col), 0, h/2, spread);
  P(g, 'cyl', [rTop, rBot, h, 8], mat(col), 0, h/2, -spread);
  P(g, 'box', [rBot*2.6, 1.6, rBot*2.4], mat(col), 1, 0.8, spread);
  P(g, 'box', [rBot*2.6, 1.6, rBot*2.4], mat(col), 1, 0.8, -spread);
}
/* EVA 通用骨架：双腿/骨盆/躯干/肩甲/垂臂/头 */
function evaBody(c) {
  const g = new THREE.Group();
  twoLegs(g, c.leg, 11, 3.6, 1.7, 2.1);
  P(g, 'box', [6, 3, 8.5], mat(c.main), 0, 12.5, 0);
  const tur = new THREE.Group(); tur.name = 'turret'; tur.position.y = 14; g.add(tur);
  P(tur, 'box', [6.5, 9, 7.5], mat(c.main), 0, 4.5, 0);                  // 躯干
  P(tur, 'box', [2.4, 4, 5.2], mat(c.chest), 2.8, 4.8, 0);               // 胸甲
  P(tur, 'box', [4.2, 6, 3.6], mat(c.pylon), 0, 6.8, 5.8);               // 肩部Pylon
  P(tur, 'box', [4.2, 6, 3.6], mat(c.pylon), 0, 6.8, -5.8);
  P(tur, 'cyl', [1.05, 1.2, 9, 6], mat(c.leg), 0, 1.5, 5.8);             // 垂臂
  P(tur, 'cyl', [1.05, 1.2, 9, 6], mat(c.leg), 0, 1.5, -5.8);
  const head = new THREE.Group(); head.name = 'head'; head.position.y = 11.4; tur.add(head);
  P(head, 'box', [3.4, 3.6, 4.2], mat(c.main), 0, 0, 0);
  return { g, tur, head };
}

/* --- EVA量产机：白色无眼圆头 + 折叠翼 + 机枪 --- */
function buildMassProd() {
  const c = { main: 0xcfd4cd, leg: 0x8f978d, pylon: 0xb9c0b6, chest: 0x9aa398 };
  const { g, tur, head } = evaBody(c);
  head.clear();
  P(head, 'sph', [2.4, 12, 10], mat(0xe2e6df), 0.4, 0.2, 0).scale.set(1.5, 1.05, 1.05); // 无眼圆头
  P(head, 'box', [1.2, 2.2, 0.5], mat(0x3a3f3a), 3.4, -0.7, 0);          // 竖直嘴缝
  P(tur, 'box', [1.2, 9, 5], mat(0xc4cabf), -4.8, 6.5, 3.6, 0.55, 0, -0.45);  // 折叠翼
  P(tur, 'box', [1.2, 9, 5], mat(0xc4cabf), -4.8, 6.5, -3.6, -0.55, 0, -0.45);
  P(tur, 'cyl', [0.7, 0.8, 12, 6], mat(0x4a4f4a), 7.5, 3.5, 4.2, 0, 0, Math.PI/2); // 机枪
  P(tur, 'box', [3, 2, 2], mat(0x4a4f4a), 3.5, 3.5, 4.2);
  return g;
}
/* --- EVA零号机(改)：蓝色 + 单眼 + 阳电子狙击枪 --- */
function buildEva00() {
  const c = { main: 0x2e62c8, leg: 0x24488f, pylon: 0xe8ecf0, chest: 0xd8dde2 };
  const { g, tur, head } = evaBody(c);
  head.clear();
  P(head, 'sph', [2.3, 12, 10], mat(0x3a6ed0), 0.3, 0.2, 0).scale.set(1.35, 1.05, 1);
  P(head, 'sph', [0.85, 8, 6], emat(0xff4a3a, 2.6), 3.0, 0.4, 0);        // 红色单眼
  P(head, 'box', [2.2, 0.7, 3.6], mat(0xe8ecf0), 0.8, 2.1, 0);           // 白色头饰带
  P(tur, 'cyl', [0.62, 0.8, 26, 8], mat(0x33383f), 13, 4.5, 4.6, 0, 0, Math.PI/2); // 阳电子狙击枪
  P(tur, 'box', [5, 2.6, 2.6], mat(0x282c31), 3, 4.5, 4.6);              // 枪机
  P(tur, 'cyl', [1.15, 1.15, 3, 8], mat(0x282c31), 24.5, 4.5, 4.6, 0, 0, Math.PI/2);
  P(tur, 'cyl', [0.8, 0.8, 2, 8], emat(0xffb04d, 1.6), 5, 6.6, 4.6, 0, 0, Math.PI/2); // 瞄准镜
  return g;
}
/* --- EVA8号机：粉色 + 绿色护目镜 + 加特林转管炮 --- */
function buildEva08() {
  const c = { main: 0xdd6ba2, leg: 0xb04f7e, pylon: 0xf2e9ee, chest: 0xe9c8d8 };
  const { g, tur, head } = evaBody(c);
  P(head, 'box', [1.2, 1.6, 4.4], emat(0x51e87a, 2.0), 1.6, 0.3, 0);     // 绿色护目镜
  P(head, 'box', [1.6, 0.8, 2.4], mat(0xf2e9ee), 0.8, 2.2, 0);
  const drum = new THREE.Group(); drum.name = 'drum';
  drum.position.set(8, 4.5, 4.8); drum.rotation.z = Math.PI / 2; tur.add(drum);
  P(drum, 'cyl', [1.7, 1.7, 3, 8], mat(0x2b2f35), 0, 1, 0);              // 炮座
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    P(drum, 'cyl', [0.5, 0.5, 12, 6], mat(0x33383f), Math.cos(a) * 1.1, -4, Math.sin(a) * 1.1);
  }
  P(tur, 'box', [4, 2.6, 2.6], mat(0x2b2f35), 3.5, 4.5, 4.8);
  return g;
}
/* --- EVA二号机：红色 + 头冠 + 火箭炮 --- */
function buildEva02() {
  const c = { main: 0xd8332a, leg: 0xa22019, pylon: 0xf0e6d4, chest: 0xe8b93a };
  const { g, tur, head } = evaBody(c);
  P(head, 'box', [2.8, 2.8, 0.8], mat(0xf0e6d4), 0.2, 2.9, 0);           // 标志性头冠
  P(head, 'box', [0.7, 1.0, 3.4], emat(0x74f04a, 2.4), 1.9, 0.5, 0);     // 四眼帯
  P(tur, 'cyl', [2.0, 2.2, 18, 8], mat(0x2c2c30), 6, 9.8, 3.9, 0, 0, Math.PI/2);   // 肩扛火箭炮
  P(tur, 'cyl', [2.5, 2.5, 2.4, 8], mat(0x1d1d20), 15.5, 9.8, 3.9, 0, 0, Math.PI/2);
  P(tur, 'box', [3, 2, 2], emat(0xffd24d, 1.2), -3, 9.8, 3.9);           // 尾部观瞄
  return g;
}
/* --- EVA Mark.06：藏青 + 金色光环（反A.T.力场） --- */
function buildMark06() {
  const c = { main: 0x272a52, leg: 0x1d2040, pylon: 0x3c3f72, chest: 0x14162e };
  const { g, tur, head } = evaBody(c);
  P(head, 'box', [0.7, 0.9, 3.2], emat(0xffb04d, 1.6), 1.9, 0.4, 0);     // 橙色眼帯
  P(head, 'cone', [0.5, 3, 5], mat(0xd8b64a), 0, 3.4, 1.4, 0, 0, 0);     // 金色冠饰
  P(head, 'cone', [0.5, 3, 5], mat(0xd8b64a), 0, 3.4, -1.4, 0, 0, 0);
  const halo = P(tur, 'tor', [4.6, 0.4, 8, 28], emat(0xffd24d, 2.2), 0, 19, 0, Math.PI/2, 0, 0);
  halo.name = 'ring'; halo.castShadow = false;                           // 头顶光环
  P(tur, 'cyl', [0.4, 0.4, 18, 6], mat(0x8a8f9a), 4, 4, -4.6, 0, 0, Math.PI/2);   // 长枪
  return g;
}
/* --- EVA第13号机：灰紫 + 双管步枪，「觉醒」 --- */
function buildEva13() {
  const c = { main: 0x4c4668, leg: 0x373250, pylon: 0x9aa0aa, chest: 0x2c2840 };
  const { g, tur, head } = evaBody(c);
  P(head, 'box', [0.7, 0.8, 1.4], emat(0x39ff6a, 2.6), 1.9, 0.6, 1.2);   // 双对绿眼
  P(head, 'box', [0.7, 0.8, 1.4], emat(0x39ff6a, 2.6), 1.9, 0.6, -1.2);
  P(head, 'box', [0.7, 0.6, 1.2], emat(0x39ff6a, 2.0), 1.9, -0.6, 0);
  P(head, 'cone', [0.45, 3.4, 5], mat(0xd9dee6), 0.6, 3.2, 1.0, 0, 0, -0.3); // 双小角
  P(head, 'cone', [0.45, 3.4, 5], mat(0xd9dee6), 0.6, 3.2, -1.0, 0, 0, -0.3);
  P(tur, 'box', [0.5, 7.5, 0.5], emat(0x39ff6a, 1.5), 3.35, 4, 2.4);     // 躯干发光线
  P(tur, 'box', [0.5, 7.5, 0.5], emat(0x39ff6a, 1.5), 3.35, 4, -2.4);
  P(tur, 'cyl', [0.75, 0.9, 17, 8], mat(0x1d1d22), 10, 4.2, 4.6, 0, 0, Math.PI/2); // 双管步枪
  P(tur, 'cyl', [0.75, 0.9, 17, 8], mat(0x1d1d22), 10, 6.2, 4.6, 0, 0, Math.PI/2);
  P(tur, 'box', [4.5, 4, 2.8], mat(0x2b3036), 3.5, 5.2, 4.6);
  return g;
}
/* --- EVA初号机（玩家机）：紫 + 绿甲 + 独角，暴走 --- */
function buildHero() {
  const c = { main: 0x5a3aa0, leg: 0x3b2a72, pylon: 0xe8ecf0, chest: 0x2aa84a };
  const { g, tur, head } = evaBody(c);
  P(head, 'box', [0.8, 0.9, 1.3], emat(0x39ff6a, 2.8), 1.85, 0.5, 1.15); // 绿色双眼
  P(head, 'box', [0.8, 0.9, 1.3], emat(0x39ff6a, 2.8), 1.85, 0.5, -1.15);
  P(head, 'cone', [0.55, 7, 6], mat(0xe8ecf0), 1.0, 4.2, 0, 0, 0, -0.55);// 独角
  P(head, 'box', [1.4, 0.7, 2.6], mat(0x2aa84a), 0.6, 2.1, 0);           // 绿色头饰
  P(tur, 'box', [0.6, 5.5, 3.8], emat(0x39ff6a, 1.4), -3.55, 5, 5.8);    // 肩甲绿纹
  P(tur, 'box', [0.6, 5.5, 3.8], emat(0x39ff6a, 1.4), -3.55, 5, -5.8);
  P(tur, 'sph', [1.1, 8, 6], emat(0x39ff6a, 2.2), 3.4, 2.2, 0);          // 核心指示
  P(tur, 'box', [3, 5.5, 6.5], mat(0x3a3f46), -5, 4.5, 0);               // 背部组件
  const fl1 = P(tur, 'cone', [1.1, 6, 6], emat(0x4dd7ff, 2.2), -7.2, 3, 2, 0, 0, Math.PI/2);
  const fl2 = P(tur, 'cone', [1.1, 6, 6], emat(0x4dd7ff, 2.2), -7.2, 3, -2, 0, 0, Math.PI/2);
  fl1.name = 'flame1'; fl2.name = 'flame2';
  P(tur, 'cyl', [0.75, 0.85, 15, 8], mat(0x22262b), 9, 4, 4.8, 0, 0, Math.PI/2);   // 步枪
  P(tur, 'box', [3.5, 2.2, 2.2], mat(0x2b3036), 3.5, 4, 4.8);
  return g;
}

/* ============ 使徒 ============ */
/* --- 第4使徒 沙姆谢尔：悬浮圆筒 + 发光能量触鞭 --- */
function buildShamshel() {
  const g = new THREE.Group();
  P(g, 'cap', [3.6, 13, 6, 10], mat(0xb59ad2), 0, 0, 0, 0, 0, Math.PI/2);      // 横置躯体
  P(g, 'sph', [3.9, 10, 8], mat(0x51455f), 8, 0, 0).scale.set(0.75, 1, 1);     // 前端钝头
  P(g, 'sph', [1.6, 8, 6], emat(0xff3b3b, 2.4), 1.5, -3.6, 0);                 // 核心
  for (const s of [1, -1]) {
    P(g, 'cyl', [0.38, 0.55, 9, 5], emat(0xff8ad9, 1.4), 4.5, -6, s*2.2, 0, 0, 0.55);   // 触鞭上段
    P(g, 'cyl', [0.24, 0.36, 9, 5], emat(0xffb3e6, 1.8), 8, -12.5, s*2.7, 0, 0, 0.2);   // 触鞭下段
  }
  return g;
}
/* --- 第3使徒 萨基尔：长臂人形 + 白色鸟面 + 红核心 --- */
function buildSachiel() {
  const g = new THREE.Group();
  twoLegs(g, 0x4e5c49, 12, 3.4, 1.5, 1.9);
  P(g, 'box', [5.5, 3, 7.5], mat(0x5c6b58), 0, 13.5, 0);
  P(g, 'box', [5.5, 10, 6.5], mat(0x5c6b58), 0, 19.5, 0);                // 细长躯干
  P(g, 'cyl', [1, 1.25, 15, 6], mat(0x50604c), 0.5, 14.5, 4.6, 0, 0, 0.08);    // 过膝长臂
  P(g, 'cyl', [1, 1.25, 15, 6], mat(0x50604c), 0.5, 14.5, -4.6, 0, 0, 0.08);
  P(g, 'cone', [0.7, 3, 5], mat(0xd8d4c8), 1, 6.5, 4.9, Math.PI, 0, 0);        // 臂端骨刺
  P(g, 'cone', [0.7, 3, 5], mat(0xd8d4c8), 1, 6.5, -4.9, Math.PI, 0, 0);
  P(g, 'sph', [2, 10, 8], emat(0xff3b3b, 2.2), 2.9, 16.5, 0);            // 红色核心
  P(g, 'sph', [2.5, 10, 8], mat(0xe6e2d6), 2.6, 26, 0).scale.set(0.75, 1.35, 0.95);  // 白色鸟面
  P(g, 'sph', [0.55, 6, 5], mat(0x14140f), 4.1, 26.8, 0.95);             // 眼窝
  P(g, 'sph', [0.55, 6, 5], mat(0x14140f), 4.1, 26.8, -0.95);
  return g;
}
/* --- 第9使徒 马特里尔：蜘蛛型 + 底部巨眼 --- */
function buildMatariel() {
  const g = new THREE.Group();
  const dome = P(g, 'sph', [6.5, 14, 10], mat(0x40331f), 0, 13, 0);
  dome.scale.set(1.25, 0.62, 1.25);
  for (let i = 0; i < 4; i++) {
    const leg = new THREE.Group();
    leg.rotation.y = Math.PI / 4 + i * Math.PI / 2;
    P(leg, 'cyl', [0.7, 0.95, 13, 6], mat(0x38290f), 5.5, 10.5, 0, 0, 0, 1.0);   // 腿上段(外张)
    P(leg, 'cyl', [0.45, 0.7, 12, 6], mat(0x2c2010), 10.5, 4, 0, 0, 0, -0.35);   // 腿下段
    g.add(leg);
  }
  P(g, 'sph', [2.6, 10, 8], mat(0xe8e4d8), 4.2, 10.5, 0);                // 垂下的巨眼
  P(g, 'sph', [1.15, 8, 6], emat(0x8a2020, 2.0), 5.8, 9.9, 0);           // 瞳
  P(g, 'sph', [1.4, 8, 6], emat(0xff3b3b, 2.2), 0, 16.5, 0);             // 核心
  return g;
}
/* --- 第13使徒 巴尔迪尔：黑色寄生EVA + 白色面甲 --- */
function buildBardiel() {
  const c = { main: 0x17171c, leg: 0x0f0f13, pylon: 0x24242b, chest: 0x101014 };
  const { g, tur, head } = evaBody(c);
  tur.rotation.z = -0.14;                                                // 前倾姿态
  P(head, 'box', [1, 3, 3.6], mat(0xd9d5c9), 2.0, 0, 0);                 // 白色面甲
  P(head, 'sph', [0.4, 6, 5], mat(0x0a0a0d), 2.6, 0.6, 0.9);
  P(head, 'sph', [0.4, 6, 5], mat(0x0a0a0d), 2.6, 0.6, -0.9);
  P(tur, 'box', [0.5, 7, 0.5], mat(0xcfccc0), 3.35, 3.5, 1.6, 0, 0, 0.25);     // 白色蚀纹
  P(tur, 'box', [0.5, 5, 0.5], mat(0xcfccc0), 3.35, 3, -1.8, 0, 0, -0.35);
  P(g, 'box', [0.45, 6, 0.45], mat(0xcfccc0), 1.2, 4, 3.8, 0, 0, 0.2);
  P(tur, 'sph', [1.9, 10, 8], emat(0xff3b3b, 2.2), 3.0, 1.6, 0);         // 核心
  P(tur, 'cyl', [1, 1.35, 14, 6], mat(0x101014), 1, -1.5, 5.9, 0, 0, 0.12);    // 垂长臂
  P(tur, 'cyl', [1, 1.35, 14, 6], mat(0x101014), 1, -1.5, -5.9, 0, 0, 0.12);
  return g;
}
/* --- 第10使徒 萨哈魁尔：巨大眼球圆盘（空降型） --- */
function buildSahaquiel() {
  const g = new THREE.Group();
  const disc = new THREE.Group(); disc.name = 'octa'; g.add(disc);       // 复用缓旋动画
  P(disc, 'sph', [15, 18, 12], mat(0xd4551f), 0, 0, 0).scale.set(1, 0.22, 1);  // 橙色主盘
  P(disc, 'sph', [6.5, 14, 10], mat(0xe8e2d2), 0, 1.6, 0).scale.set(1, 0.5, 1);// 眼白
  P(disc, 'tor', [4.2, 0.7, 8, 20], mat(0x6e2a12), 0, 3.2, 0, Math.PI/2, 0, 0);// 虹膜环
  P(disc, 'sph', [2.1, 10, 8], emat(0x2fe86a, 2.2), 0, 3.5, 0);          // 发光瞳
  P(disc, 'sph', [3.6, 10, 8], mat(0xb3431a), 12, 0, 4).scale.set(1, 0.32, 1); // 外缘裂叶
  P(disc, 'sph', [3.6, 10, 8], mat(0xb3431a), -9.5, 0, -9.5).scale.set(1, 0.32, 1);
  P(disc, 'sph', [3.6, 10, 8], mat(0xb3431a), -3, 0, 12.5).scale.set(1, 0.32, 1);
  P(disc, 'sph', [1.6, 8, 6], emat(0xff3b3b, 2.2), 5.5, -1.8, 0);        // 核心
  return g;
}
/* --- 第5使徒 拉米尔：蓝色正八面体 --- */
function buildRamiel() {
  const g = new THREE.Group();
  const R = 21;
  const oct = new THREE.Group(); oct.name = 'octa'; g.add(oct);
  P(oct, 'octa', [R, 0], mat(0x2f6fe4, {
    transparent: true, opacity: 0.9, roughness: 0.12, metalness: 0.2,
    emissive: 0x16368a, emissiveIntensity: 0.6
  }), 0, 0, 0);
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geo('octa', R, 0)),
    new THREE.LineBasicMaterial({ color: 0x9cc4ff, transparent: true, opacity: 0.9 }));
  oct.add(edges);
  P(oct, 'sph', [R * 0.22, 12, 10], emat(0xff3b3b, 2.4), 0, 0, 0);       // 掘进核心
  const at = P(g, 'tor', [R + 12, 0.9, 8, 8], emat(0xff9a3d, 1.8), 0, 0, 0, Math.PI/2, 0, 0);
  at.name = 'atring';
  return g;
}
/* --- 第14使徒 塞路尔：骷髅面甲 + 纸带手臂（最强使徒） --- */
function buildZeruel() {
  const g = new THREE.Group();
  P(g, 'cap', [8.5, 20, 6, 12], mat(0x363845), 0, 2, 0);                 // 暗色主体
  P(g, 'cone', [10.5, 14, 10], mat(0x282a34), 0, -13, 0, Math.PI, 0, 0); // 下裾
  P(g, 'sph', [5.5, 10, 8], mat(0x454857), -1, 12, 8).scale.set(1, 0.85, 1);   // 肩部隆起
  P(g, 'sph', [5.5, 10, 8], mat(0x454857), -1, 12, -8).scale.set(1, 0.85, 1);
  P(g, 'box', [1.8, 10.5, 7], mat(0xe4e0d4), 8.2, 7, 0);                 // 白色骷髅面甲
  P(g, 'sph', [1.0, 8, 6], mat(0x0c0c10), 9.1, 9.2, 1.9);                // 眼窝
  P(g, 'sph', [1.0, 8, 6], mat(0x0c0c10), 9.1, 9.2, -1.9);
  P(g, 'box', [0.8, 3.2, 0.9], mat(0x0c0c10), 9.05, 4.2, 0);             // 面甲裂口
  P(g, 'sph', [2.8, 10, 8], emat(0xff3b3b, 2.6), 8.2, 0, 0);             // 核心
  P(g, 'box', [0.8, 27, 3.4], mat(0xc9c6bc), 2, -4, 11.5, 0.16, 0, 0);   // 纸带状手臂
  P(g, 'box', [0.8, 27, 3.4], mat(0xc9c6bc), 2, -4, -11.5, -0.16, 0, 0);
  P(g, 'box', [0.7, 14, 2.6], mat(0xb8b5ab), 4, -9, 14.5, 0.35, 0, 0.1); // 手臂折段
  P(g, 'box', [0.7, 14, 2.6], mat(0xb8b5ab), 4, -9, -14.5, -0.35, 0, 0.1);
  const at = P(g, 'tor', [40, 1.0, 8, 8], emat(0xff9a3d, 1.8), 0, 0, 0, Math.PI/2, 0, 0);
  at.name = 'atring';
  return g;
}
const ENEMY_BUILDERS = {
  drone: buildShamshel, soldier: buildSachiel, runner: buildMatariel,
  heavy: buildBardiel, gunship: buildSahaquiel,
  angel: buildRamiel, bigangel: buildZeruel
};
const TOWER_BUILDERS = {
  gm: buildMassProd, sniper: buildEva00, funnel: buildEva08,
  cannon: buildEva02, atfield: buildMark06, eva: buildEva13
};

/* ---------- 传送门与本部 ---------- */
const portalMeshes = [];
for (const s of SPAWNS) {
  const grp2 = new THREE.Group();
  grp2.position.copy(gw((s.c + 0.5) * CELL, (s.r + 0.5) * CELL, 0.8));
  const t1 = P(grp2, 'tor', [14, 0.8, 8, 32], emat(0xff3b3b, 1.6), 0, 0, 0, Math.PI/2, 0, 0);
  const t2 = P(grp2, 'tor', [8, 0.5, 8, 24], emat(0xff6a6a, 1.4), 0, 0, 0, Math.PI/2, 0, 0);
  t1.castShadow = t2.castShadow = false;
  scene.add(grp2);
  portalMeshes.push({ s, grp: grp2 });
}
const baseGroup = (() => {
  const g = new THREE.Group();
  g.position.copy(gw(goalPx.x, goalPx.y, 0));
  const cone = P(g, 'cone', [22, 42, 4], mat(0x40296e, { roughness: 0.35, metalness: 0.3 }), 0, 21, 0, 0, Math.PI/4, 0);
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(cone.geometry),
    new THREE.LineBasicMaterial({ color: 0x9a6bff, transparent: true, opacity: 0.8 }));
  edges.position.y = 21; edges.rotation.y = Math.PI/4;
  g.add(edges);
  P(g, 'sph', [3, 10, 8], emat(0x9a6bff, 2.4), 0, 16, 12).castShadow = false;
  const light = new THREE.PointLight(0x9a6bff, 1.6, 180, 1.8);
  light.position.y = 30;
  g.add(light);
  scene.add(g);
  return g;
})();

/* ---------- 特效池 ---------- */
const beamPool = [];
for (let i = 0; i < 64; i++) {
  const m = new THREE.Mesh(geo('cyl', 0.5, 0.5, 1, 5, 1, true),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.visible = false;
  scene.add(m);
  beamPool.push({ mesh: m, ttl: 0, life: 1 });
}
const _bq = new THREE.Quaternion(), _bd = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
function addBeam(x1, y1, z1, x2, y2, z2, color, w, life) {
  const b = beamPool.find(b => b.ttl <= 0);
  if (!b) return;
  const p1 = gw(x1, y1, z1), p2 = gw(x2, y2, z2);
  const len = p1.distanceTo(p2);
  if (len < 1) return;
  b.mesh.position.copy(p1).add(p2).multiplyScalar(0.5);
  _bd.copy(p2).sub(p1).normalize();
  _bq.setFromUnitVectors(_up, _bd);
  b.mesh.quaternion.copy(_bq);
  b.mesh.scale.set(w, len, w);
  b.mesh.material.color.set(color);
  b.mesh.visible = true;
  b.ttl = life; b.life = life;
}
const ringPool = [];
for (let i = 0; i < 12; i++) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 40),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2; m.visible = false;
  scene.add(m);
  ringPool.push({ mesh: m, ttl: 0, life: 1, R: 1 });
}
function addRing(x, y, R, color) {
  const r = ringPool.find(r => r.ttl <= 0);
  if (!r) return;
  r.mesh.position.copy(gw(x, y, 2));
  r.mesh.material.color.set(color);
  r.mesh.visible = true;
  r.ttl = 0.35; r.life = 0.35; r.R = R;
}
/* 粒子（单次绘制 Points） */
const PMAX = 1200;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(PMAX * 3), pCol = new Float32Array(PMAX * 3);
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
const pMat = new THREE.PointsMaterial({ size: 3.6, vertexColors: true, transparent: true,
  blending: THREE.AdditiveBlending, depthWrite: false });
const pMesh = new THREE.Points(pGeo, pMat);
pMesh.frustumCulled = false;
scene.add(pMesh);
const particles = [];
for (let i = 0; i < PMAX; i++) particles.push({ ttl: 0, life: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 0, g: 0, b: 0 });
let pCursor = 0;
const _col = new THREE.Color();
function addParts(x, y, z, color, n, spd) {
  _col.set(color);
  for (let i = 0; i < n; i++) {
    const p = particles[pCursor]; pCursor = (pCursor + 1) % PMAX;
    const a = Math.random() * Math.PI * 2, v = (0.3 + Math.random()) * spd;
    p.x = x; p.y = y; p.z = z + Math.random() * 6;
    p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v; p.vz = (Math.random() - 0.15) * spd * 0.8;
    p.ttl = p.life = 0.5 + Math.random() * 0.4;
    p.r = _col.r; p.g = _col.g; p.b = _col.b;
  }
}
function updateParticleBuffer() {
  for (let i = 0; i < PMAX; i++) {
    const p = particles[i];
    if (p.ttl <= 0) { pPos[i*3+1] = -9999; pCol[i*3] = pCol[i*3+1] = pCol[i*3+2] = 0; continue; }
    pPos[i*3] = p.x - W2; pPos[i*3+1] = p.z; pPos[i*3+2] = p.y - H2;
    const f = Math.max(0, p.ttl / p.life);
    pCol[i*3] = p.r * f; pCol[i*3+1] = p.g * f; pCol[i*3+2] = p.b * f;
  }
  pGeo.attributes.position.needsUpdate = true;
  pGeo.attributes.color.needsUpdate = true;
}

/* ---------- 部署辅助（格子高亮 / 射程圈 / 幽灵机体） ---------- */
const tileMark = new THREE.Mesh(new THREE.PlaneGeometry(CELL, CELL),
  new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.3, depthWrite: false }));
tileMark.rotation.x = -Math.PI / 2; tileMark.visible = false;
scene.add(tileMark);
const rangeRing = new THREE.Mesh(new THREE.RingGeometry(0.965, 1, 64),
  new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
rangeRing.rotation.x = -Math.PI / 2; rangeRing.visible = false;
scene.add(rangeRing);
const rangeFill = new THREE.Mesh(new THREE.CircleGeometry(1, 64),
  new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false }));
rangeFill.rotation.x = -Math.PI / 2; rangeFill.visible = false;
scene.add(rangeFill);
function showRange(x, y, R, color, on) {
  rangeRing.visible = rangeFill.visible = on;
  if (!on) return;
  rangeRing.position.copy(gw(x, y, 1.2));
  rangeFill.position.copy(gw(x, y, 1.0));
  rangeRing.scale.set(R, R, 1);
  rangeFill.scale.set(R, R, 1);
  rangeRing.material.color.set(color);
  rangeFill.material.color.set(color);
}
let ghost = null, ghostKey = null;
function setGhost(key) {
  if (ghost) { scene.remove(ghost); ghost = null; ghostKey = null; }
  if (!key) return;
  ghost = TOWER_BUILDERS[key]();
  ghost.traverse(o => {
    if (o.isMesh) {
      o.material = o.material.clone();
      o.material.transparent = true;
      o.material.opacity = 0.45;
      o.castShadow = false;
    }
  });
  ghost.visible = false;
  ghostKey = key;
  scene.add(ghost);
}

/* ============================================================
   游戏状态与逻辑（流场迷宫 / 波次 / 战斗 — 与 2D 版一致）
   ============================================================ */
let G;
function resetGame() {
  if (G) {
    for (const t of G.towers) scene.remove(t.mesh);
    for (const e of G.enemies) scene.remove(e.mesh);
    if (G.hero.mesh) scene.remove(G.hero.mesh);
  }
  G = {
    money: 350, lives: 20, kills: 0,
    wave: 0, state: 'idle',
    towers: [], towerGrid: new Map(),
    enemies: [], projs: [], texts: [],
    spawnQ: [], spawnT: 0,
    placing: null, selected: null,
    speed: 1, paused: false, time: 0, autoNextT: -1,
    flowV: 0,
    hero: makeHero()
  };
  G.hero.mesh = buildHero();
  scene.add(G.hero.mesh);
  refreshFlow();
  setGhost(null);
  document.getElementById('overlay').classList.remove('on');
  refreshShop(); refreshInfo(); refreshNextWave(); refreshTop();
}
function makeHero() {
  return {
    x: (GOAL.c - 2.5) * CELL, y: goalPx.y,
    lv: 0, hp: HERO_LV[0].hp,
    cool: 0, abCd: 0, angle: Math.PI,
    dead: false, respawnT: 0, moving: false, mesh: null
  };
}

/* ---------- 流场寻路 ---------- */
const DIRS = [[1,0],[-1,0],[0,1],[0,-1]];
let DIST = null;
function inGrid(c, r) { return c >= 0 && c < COLS && r >= 0 && r < ROWS; }
function blockedBy(c, r, xc, xr) {
  return G.towerGrid.has(c + ',' + r) || (c === xc && r === xr);
}
function computeDist(xc, xr) {
  const dist = Array.from({ length: ROWS }, () => Array(COLS).fill(Infinity));
  dist[GOAL.r][GOAL.c] = 0;
  const q = [[GOAL.c, GOAL.r]];
  let head = 0;
  while (head < q.length) {
    const [c, r] = q[head++];
    for (const [dx, dy] of DIRS) {
      const nc = c + dx, nr = r + dy;
      if (!inGrid(nc, nr) || blockedBy(nc, nr, xc, xr)) continue;
      if (dist[nr][nc] === Infinity) { dist[nr][nc] = dist[r][c] + 1; q.push([nc, nr]); }
    }
  }
  return dist;
}
function refreshFlow() {
  DIST = computeDist(-1, -1);
  G.flowV++;
  for (const e of G.enemies) {
    if (e.dead || e.fly) continue;
    if (e.tx != null && DIST[e.ty][e.tx] === Infinity) e.tx = null;
  }
}
function enemyOn(c, r) {
  return G.enemies.some(e => !e.dead && !e.fly &&
    ((e.cx === c && e.cy === r) || (e.tx === c && e.ty === r)));
}
function canBuild(c, r) {
  if (!inGrid(c, r) || isReserved(c, r)) return false;
  if (G.towerGrid.has(c + ',' + r)) return false;
  if (enemyOn(c, r)) return false;
  const d = computeDist(c, r);
  for (const s of SPAWNS) if (d[s.r][s.c] === Infinity) return false;
  for (const e of G.enemies) {
    if (e.dead || e.fly) continue;
    if (d[e.cy][e.cx] === Infinity) return false;
  }
  return true;
}

/* ---------- 音效 ---------- */
let AC = null, muted = false;
function ac() { if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); return AC; }
function tone(f0, f1, dur, type, vol) {
  if (muted) return;
  try {
    const a = ac(), t = a.currentTime;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur);
  } catch (e) {}
}
const SFX = {
  shoot: () => tone(700, 300, 0.06, 'square', 0.013),
  snipe: () => tone(1400, 150, 0.18, 'sawtooth', 0.03),
  beam:  () => tone(1100, 500, 0.1, 'sawtooth', 0.013),
  boom:  () => tone(160, 40, 0.3, 'triangle', 0.06),
  place: () => tone(400, 800, 0.12, 'sine', 0.05),
  sell:  () => tone(800, 300, 0.15, 'sine', 0.05),
  up:    () => { tone(500, 1000, 0.1, 'sine', 0.05); setTimeout(() => tone(700, 1400, 0.12, 'sine', 0.05), 90); },
  leak:  () => tone(300, 80, 0.4, 'sawtooth', 0.07),
  kill:  () => tone(500, 100, 0.12, 'triangle', 0.025),
  crit:  () => tone(200, 900, 0.25, 'sawtooth', 0.06),
  slash: () => tone(900, 200, 0.22, 'sawtooth', 0.05),
  alarm: () => { tone(880, 880, 0.25, 'square', 0.04); setTimeout(() => tone(660, 660, 0.25, 'square', 0.04), 300); }
};

/* ---------- 文本特效 ---------- */
function fmt(n) { return Math.round(n).toString(); }
function towerAt(c, r) { return G.towerGrid.get(c + ',' + r); }
function addText(wx, wy, wz, txt, color, size) {
  G.texts.push({ wx, wy, wz, txt, color, size: size || 13, ttl: 1, life: 1, screen: false });
}
function announce(txt, color, size) {
  G.texts.push({ x: 0.5, y: 0.32, txt, color, size: size || 20, ttl: 1.4, life: 1.4, screen: true });
}

/* ---------- 伤害 ---------- */
function hitEnemy(e, dmg, pierce) {
  if (e.dead) return;
  const eff = Math.max(1, dmg - e.armor * (1 - pierce));
  e.shieldHitT = 0;
  if (e.shield > 0) {
    e.shield -= eff;
    if (e.shield < 0) { e.hp += e.shield; e.shield = 0; }
    addParts(e.x, e.y, e.z + 14, '#ffb04d', 3, 60);
  } else {
    e.hp -= eff;
  }
  e.flash = 0.1;
  if (e.hp <= 0) killEnemy(e);
}
function killEnemy(e) {
  if (e.dead) return;
  e.dead = true;
  G.money += e.bounty; G.kills++;
  addText(e.x, e.y, e.z + 28, '+' + e.bounty, '#8dff4d');
  addParts(e.x, e.y, e.z + 10, e.boss ? '#4dd7ff' : '#ff9a3d', e.boss ? 60 : 16, e.boss ? 150 : 95);
  if (e.boss) { SFX.boom(); addText(e.x, e.y, e.z + 50, '目标沉默', '#4dd7ff', 18); }
  else SFX.kill();
}
function leak(e) {
  if (e.dead) return;
  e.dead = true;
  const dmgL = e.boss ? 5 : 1;
  G.lives -= dmgL; SFX.leak();
  addParts(goalPx.x, goalPx.y, 14, '#ff3b3b', 20, 100);
  addText(goalPx.x, goalPx.y, 58, '-' + dmgL + ' 耐久', '#ff3b3b', 16);
  if (G.lives <= 0) { G.lives = 0; gameOver(false); }
}

/* ---------- 敌机 ---------- */
function spawnEnemy(type, wave) {
  const B = ENEMIES[type], s = hpScale(wave);
  const acts = SPAWNS.filter(sp => spawnActive(sp, wave));
  const sp = acts[Math.floor(Math.random() * acts.length)];
  let x = (sp.c + 0.5) * CELL, y = (sp.r + 0.5) * CELL;
  if (sp.c === 0) x = -24; else y = -24;
  const e = {
    type, name: B.name, boss: !!B.boss, fly: !!B.fly,
    x, y, z: 0, dir: 0,
    cx: sp.c, cy: sp.r, tx: sp.c, ty: sp.r,
    ox: (Math.random() - 0.5) * 12, oy: (Math.random() - 0.5) * 12,
    hp: B.hp * s, maxHp: B.hp * s,
    shield: (B.shield || 0) * s, shieldMax: (B.shield || 0) * s,
    regen: (B.regen || 0) * s, shieldHitT: 99,
    spd: B.spd, armor: B.armor, bounty: B.bounty, r: B.r,
    slowT: 0, slowF: 1, flash: 0, dead: false, spin: Math.random() * 6,
    mesh: ENEMY_BUILDERS[type]()
  };
  scene.add(e.mesh);
  G.enemies.push(e);
}
function nextStep(e) {
  if (DIST[e.cy][e.cx] === 0) { leak(e); return; }
  let best = null, bd = Infinity;
  for (const [dx, dy] of DIRS) {
    const nc = e.cx + dx, nr = e.cy + dy;
    if (!inGrid(nc, nr) || G.towerGrid.has(nc + ',' + nr)) continue;
    let d = DIST[nr][nc];
    if (d === Infinity) continue;
    if (dx === e.ldx && dy === e.ldy) d -= 0.01;
    if (d < bd) { bd = d; best = [nc, nr, dx, dy]; }
  }
  if (!best) { e.tx = null; return; }
  e.tx = best[0]; e.ty = best[1]; e.ldx = best[2]; e.ldy = best[3];
}
function remaining(e) {
  if (e.fly) return Math.hypot(goalPx.x - e.x, goalPx.y - e.y);
  if (e.tx == null) return (DIST[e.cy][e.cx] === Infinity ? 999 : DIST[e.cy][e.cx]) * CELL;
  return DIST[e.ty][e.tx] * CELL +
    Math.hypot((e.tx + 0.5) * CELL + e.ox - e.x, (e.ty + 0.5) * CELL + e.oy - e.y);
}
function updateEnemies(dt) {
  for (const e of G.enemies) {
    if (e.dead) continue;
    e.slowT -= dt; if (e.slowT <= 0) e.slowF = 1;
    e.flash = Math.max(0, e.flash - dt);
    e.spin += dt * 1.5;
    e.shieldHitT += dt;
    if (e.fly) e.z = 30 + Math.sin(e.spin * 2.2) * 4;
    else if (e.boss) e.z = (e.type === 'bigangel' ? 40 : 30) + Math.sin(e.spin * 1.6) * 4;
    if (e.shieldMax > 0 && e.shield < e.shieldMax && e.shieldHitT > 2.5)
      e.shield = Math.min(e.shieldMax, e.shield + e.regen * dt);
    const step = e.spd * e.slowF * dt;
    if (e.fly) {
      const dx = goalPx.x - e.x, dy = goalPx.y - e.y, dist = Math.hypot(dx, dy);
      if (dist < 16) { leak(e); continue; }
      e.x += dx / dist * step; e.y += dy / dist * step;
      e.dir = Math.atan2(dy, dx);
    } else {
      if (e.tx == null) { nextStep(e); if (e.tx == null) continue; }
      const gx = (e.tx + 0.5) * CELL + e.ox, gy = (e.ty + 0.5) * CELL + e.oy;
      const dx = gx - e.x, dy = gy - e.y, dist = Math.hypot(dx, dy);
      if (dist <= step) {
        e.x = gx; e.y = gy; e.cx = e.tx; e.cy = e.ty;
        nextStep(e);
      } else {
        e.x += dx / dist * step; e.y += dy / dist * step;
        e.dir = Math.atan2(dy, dx);
      }
    }
  }
  for (const e of G.enemies) if (e.dead) scene.remove(e.mesh);
  G.enemies = G.enemies.filter(e => !e.dead);
}

/* ---------- 塔 ---------- */
function placeTower(key, c, r) {
  const T = TOWERS[key];
  if (G.money < T.cost || !canBuild(c, r)) return false;
  G.money -= T.cost;
  const t = {
    key, c, r, lv: 0, invested: T.cost,
    x: c * CELL + CELL / 2, y: r * CELL + CELL / 2,
    cool: 0, angle: -Math.PI / 4, anim: Math.random() * 6, flashT: 0,
    mesh: TOWER_BUILDERS[key]()
  };
  t.mesh.position.copy(gw(t.x, t.y, 0));
  scene.add(t.mesh);
  G.towers.push(t);
  G.towerGrid.set(c + ',' + r, t);
  refreshFlow();
  SFX.place();
  addParts(t.x, t.y, 10, '#8dff4d', 14, 75);
  return true;
}
function towerStat(t, field) { return TOWERS[t.key][field][t.lv]; }
function upgradeTower(t) {
  const T = TOWERS[t.key];
  if (t.lv >= 2) return;
  const cost = T.up[t.lv];
  if (G.money < cost) return;
  G.money -= cost; t.invested += cost; t.lv++;
  t.mesh.scale.setScalar(1 + t.lv * 0.12);       // 升级机体小幅增大
  SFX.up(); addParts(t.x, t.y, 14, '#4dd7ff', 16, 85);
  addText(t.x, t.y, 38, 'LV' + (t.lv + 1), '#4dd7ff', 14);
}
function sellTower(t) {
  const back = Math.round(t.invested * 0.7);
  G.money += back;
  scene.remove(t.mesh);
  G.towers = G.towers.filter(x => x !== t);
  G.towerGrid.delete(t.c + ',' + t.r);
  refreshFlow();
  if (G.selected === t) G.selected = null;
  SFX.sell(); addText(t.x, t.y, 22, '+' + back, '#8dff4d');
}
function pickTarget(x, y, range, air) {
  let best = null, bd = Infinity;
  for (const e of G.enemies) {
    if (e.dead || (e.fly && !air)) continue;
    if (Math.hypot(e.x - x, e.y - y) > range) continue;
    const rem = remaining(e);
    if (rem < bd) { bd = rem; best = e; }
  }
  return best;
}
function updateTowers(dt) {
  for (const t of G.towers) {
    const T = TOWERS[t.key];
    t.anim += dt; t.flashT = Math.max(0, t.flashT - dt);
    const range = towerStat(t, 'range');
    if (T.kind === 'slow') {
      const f = T.slow[t.lv];
      for (const e of G.enemies) {
        if (!e.dead && Math.hypot(e.x - t.x, e.y - t.y) <= range) {
          e.slowT = 0.25; e.slowF = Math.min(e.slowF, e.boss ? (f + 1) / 2 : f);
        }
      }
      continue;
    }
    t.cool -= dt;
    if (t.cool > 0) continue;
    const dmg = towerStat(t, 'dmg'), rate = towerStat(t, 'rate');
    if (T.kind === 'funnel') {
      const targets = G.enemies
        .filter(e => !e.dead && Math.hypot(e.x - t.x, e.y - t.y) <= range)
        .sort((a, b) => remaining(a) - remaining(b)).slice(0, 3);
      if (!targets.length) continue;
      t.cool = rate;
      for (let i = 0; i < targets.length; i++) {
        const e = targets[i];
        const fa = t.anim * 2.4 + i * (Math.PI * 2 / 3);
        const fx = t.x + Math.cos(fa) * 13, fy = t.y + Math.sin(fa) * 13;
        addBeam(fx, fy, 16, e.x, e.y, e.z + 12, '#ff7ad9', 1.6, 0.12);
        hitEnemy(e, dmg, T.pierce);
      }
      SFX.beam();
      continue;
    }
    const e = pickTarget(t.x, t.y, range, T.air);
    if (!e) continue;
    t.angle = Math.atan2(e.y - t.y, e.x - t.x);
    t.cool = rate; t.flashT = 0.07;
    const mx = t.x + Math.cos(t.angle) * 14, my = t.y + Math.sin(t.angle) * 14;
    const mz = T.muzzle;
    if (T.kind === 'gun') {
      addBeam(mx, my, mz, e.x, e.y, e.z + 12, '#ffe14d', 1.1, 0.06);
      hitEnemy(e, dmg, T.pierce); SFX.shoot();
    } else if (T.kind === 'snipe') {
      addBeam(mx, my, mz, e.x, e.y, e.z + 12, '#ff5a5a', 2, 0.2);
      addParts(e.x, e.y, e.z + 12, '#ff5a5a', 8, 105);
      hitEnemy(e, dmg, T.pierce); SFX.snipe();
    } else if (T.kind === 'cannon') {
      const d0 = Math.hypot(e.x - mx, e.y - my);
      G.projs.push({ x: mx, y: my, z: 16, tgt: e, tx: e.x, ty: e.y,
        spd: 260, dmg, splash: T.splash[t.lv], d0: Math.max(d0, 1) });
      SFX.shoot();
    } else if (T.kind === 'eva') {
      const crit = Math.random() < 0.15;
      const d2 = crit ? dmg * 3 : dmg;
      addBeam(mx, my, mz, e.x, e.y, e.z + 12, crit ? '#ff3b3b' : '#b78dff', crit ? 4.5 : 3, 0.25);
      addParts(e.x, e.y, e.z + 12, crit ? '#ff3b3b' : '#b78dff', 18, 125);
      if (crit) { addText(t.x, t.y, 48, '觉 醒 !!', '#ff3b3b', 17); SFX.crit(); }
      else SFX.snipe();
      hitEnemy(e, d2, T.pierce);
    }
  }
}

/* ---------- 指挥机 ---------- */
const KEYS = {};
function updateHero(dt) {
  const H = G.hero, S = HERO_LV[H.lv];
  if (H.dead) {
    H.respawnT -= dt;
    if (H.respawnT <= 0) {
      H.dead = false; H.hp = S.hp;
      H.x = (GOAL.c - 2.5) * CELL; H.y = goalPx.y;
      addParts(H.x, H.y, 12, '#8dff4d', 20, 95);
      addText(H.x, H.y, 42, '初号机·再启动', '#8dff4d', 14);
      SFX.place();
    }
    return;
  }
  // 相机相对方向移动（W = 屏幕上方）
  let ix = 0, iz = 0;
  if (KEYS['w'] || KEYS['arrowup']) iz -= 1;
  if (KEYS['s'] || KEYS['arrowdown']) iz += 1;
  if (KEYS['a'] || KEYS['arrowleft']) ix -= 1;
  if (KEYS['d'] || KEYS['arrowright']) ix += 1;
  H.moving = !!(ix || iz);
  if (H.moving) {
    const fwd = new THREE.Vector3().subVectors(ORBIT.target, camera.position);
    fwd.y = 0; fwd.normalize();
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const mv = new THREE.Vector3()
      .addScaledVector(fwd, -iz)
      .addScaledVector(right, ix);
    if (mv.lengthSq() > 0.001) {
      mv.normalize();
      H.x += mv.x * 190 * dt; H.y += mv.z * 190 * dt;
      H.x = Math.max(10, Math.min(COLS * CELL - 10, H.x));
      H.y = Math.max(10, Math.min(ROWS * CELL - 10, H.y));
      H.angle = Math.atan2(mv.z, mv.x);
    }
  }
  H.cool -= dt;
  if (H.cool <= 0) {
    const e = pickTarget(H.x, H.y, S.range, true);
    if (e) {
      H.cool = 0.38;
      H.angle = Math.atan2(e.y - H.y, e.x - H.x);
      const mx = H.x + Math.cos(H.angle) * 12, my = H.y + Math.sin(H.angle) * 12;
      addBeam(mx, my, 17, e.x, e.y, e.z + 12, '#7dffee', 1.8, 0.1);
      hitEnemy(e, S.dmg, 0.5);
      SFX.shoot();
    }
  }
  H.abCd = Math.max(0, H.abCd - dt);
  for (const e of G.enemies) {
    if (e.dead) continue;
    if (Math.hypot(e.x - H.x, e.y - H.y) < e.r + 13)
      H.hp -= (e.boss ? 34 : 12) * dt;
  }
  if (H.hp <= 0) {
    H.dead = true; H.respawnT = 8; H.hp = 0;
    addParts(H.x, H.y, 14, '#ff9a3d', 40, 135);
    addText(H.x, H.y, 40, '初号机机能停止！', '#ff3b3b', 15);
    SFX.boom();
    if (G.selected === 'HERO') refreshInfo();
  }
}
function heroAbility() {
  const H = G.hero;
  if (G.paused || G.state === 'won' || G.state === 'lost' || H.dead || H.abCd > 0) return;
  const S = HERO_LV[H.lv];
  H.abCd = HERO_ABILITY_CD;
  addRing(H.x, H.y, HERO_ABILITY_R, '#8dff4d');
  addParts(H.x, H.y, 14, '#8dff4d', 30, 135);
  SFX.slash();
  for (const e of G.enemies) {
    if (!e.dead && Math.hypot(e.x - H.x, e.y - H.y) <= HERO_ABILITY_R + e.r)
      hitEnemy(e, S.ab, 0.8);
  }
}
function upgradeHero() {
  const H = G.hero;
  if (H.lv >= 2 || G.money < HERO_UP[H.lv]) return;
  G.money -= HERO_UP[H.lv]; H.lv++;
  H.hp = HERO_LV[H.lv].hp;
  H.mesh.scale.setScalar(1 + H.lv * 0.1);
  SFX.up(); addParts(H.x, H.y, 14, '#4dd7ff', 20, 95);
  addText(H.x, H.y, 46, '机体强化 LV' + (H.lv + 1), '#4dd7ff', 14);
}

/* ---------- 炮弹 ---------- */
const shellMeshes = [];
function getShellMesh() {
  let m = shellMeshes.find(s => !s.visible);
  if (!m) {
    m = new THREE.Mesh(geo('sph', 2.4, 8, 6), emat(0xffae4d, 1.8));
    m.castShadow = false;
    scene.add(m);
    shellMeshes.push(m);
  }
  m.visible = true;
  return m;
}
function updateProjs(dt) {
  for (const p of G.projs) {
    if (!p.mesh) p.mesh = getShellMesh();
    if (p.tgt && !p.tgt.dead) { p.tx = p.tgt.x; p.ty = p.tgt.y; }
    const dx = p.tx - p.x, dy = p.ty - p.y, dist = Math.hypot(dx, dy);
    const step = p.spd * dt;
    p.z = 14 + 46 * Math.sin(Math.PI * Math.min(1, Math.max(0, 1 - dist / p.d0)));
    if (dist <= step) {
      p.done = true;
      p.mesh.visible = false;
      addParts(p.tx, p.ty, 12, '#ffae4d', 20, 115);
      addRing(p.tx, p.ty, p.splash, '#ffae4d');
      SFX.boom();
      for (const e of G.enemies) {
        if (!e.dead && !e.fly && Math.hypot(e.x - p.tx, e.y - p.ty) <= p.splash + e.r)
          hitEnemy(e, p.dmg, 0);
      }
    } else {
      p.x += dx / dist * step; p.y += dy / dist * step;
      p.mesh.position.copy(gw(p.x, p.y, p.z));
    }
  }
  G.projs = G.projs.filter(p => !p.done);
}

/* ---------- 波次控制 ---------- */
function startWave() {
  if (G.state !== 'idle' || G.wave >= TOTAL_WAVES) return;
  G.wave++; G.state = 'wave'; G.autoNextT = -1;
  G.spawnQ = []; let tAcc = 0.5;
  for (const g of WAVE_DEFS[G.wave - 1]) {
    for (let i = 0; i < g.n; i++) { G.spawnQ.push({ type: g.type, at: tAcc }); tAcc += g.gap; }
    tAcc += 1.2;
  }
  G.spawnT = 0;
  if (waveHasBoss(G.wave)) {
    SFX.alarm();
    const w = document.getElementById('warning');
    w.classList.add('on');
    setTimeout(() => w.classList.remove('on'), 2600);
  }
  if (G.wave === SPAWNS[1].from)
    addText((SPAWNS[1].c + 0.5) * CELL, (SPAWNS[1].r + 0.5) * CELL, 50, '⚠ 第二入侵口开放！', '#ff7a1a', 16);
  announce('第 ' + G.wave + ' 波 · 使徒接近中', '#4dd7ff', 20);
  refreshNextWave();
}
function updateWave(dt) {
  if (G.state !== 'wave') {
    if (G.autoNextT > 0) {
      G.autoNextT -= dt;
      if (G.autoNextT <= 0) startWave();
    }
    return;
  }
  G.spawnT += dt;
  while (G.spawnQ.length && G.spawnQ[0].at <= G.spawnT) {
    spawnEnemy(G.spawnQ.shift().type, G.wave);
  }
  if (!G.spawnQ.length && !G.enemies.length) {
    const bonus = 70 + G.wave * 12;
    G.money += bonus;
    announce('波次肃清 · 补给 +' + bonus, '#8dff4d', 18);
    G.state = 'idle';
    if (G.wave >= TOTAL_WAVES) { gameOver(true); return; }
    if (document.getElementById('chkAuto').checked) G.autoNextT = 3;
    refreshNextWave();
  }
}
function gameOver(win) {
  G.state = win ? 'won' : 'lost';
  const ovl = document.getElementById('overlay');
  document.getElementById('ovTitle').textContent = win ? '作 战 完 成' : '本 部 陷 落';
  document.getElementById('ovTitle').className = 'big ' + (win ? 'win' : 'lose');
  document.getElementById('ovDetail').textContent =
    (win ? '全部 ' + TOTAL_WAVES + ' 波使徒已歼灭，人类补完计划阻止成功。' : '第 ' + G.wave + ' 波防线崩溃，第三新东京市陷落。') +
    ' 总击破 ' + G.kills + ' · 剩余耐久 ' + G.lives;
  ovl.classList.add('on');
  if (win) SFX.up(); else SFX.alarm();
}

/* ============================================================
   网格同步与动画
   ============================================================ */
function syncMeshes(dt) {
  for (const t of G.towers) {
    const tur = t.mesh.getObjectByName('turret');
    if (tur) tur.rotation.y = -t.angle;
    const fins = t.mesh.getObjectByName('fins');
    if (fins) { fins.rotation.y = t.anim * 2.4; fins.position.y = 16 + Math.sin(t.anim * 2) * 1.5; }
    const ring = t.mesh.getObjectByName('ring');
    if (ring) { ring.rotation.z = t.anim * 1.4; ring.position.y = 19 + Math.sin(t.anim * 2.4) * 2.4; }
    const core = t.mesh.getObjectByName('core');
    if (core) core.rotation.y = t.anim * 2.2;
    const drum = t.mesh.getObjectByName('drum');
    if (drum) drum.rotation.y = t.anim * 8;
  }
  for (const e of G.enemies) {
    e.mesh.position.copy(gw(e.x, e.y, e.z));
    e.mesh.rotation.y = -e.dir;
    const flashS = 1 + e.flash * 1.2;
    const bossBase = 1;
    e.mesh.scale.setScalar(bossBase * flashS);
    const rotor = e.mesh.getObjectByName('rotor');
    if (rotor) rotor.rotation.y = e.spin * 14;
    const rt = e.mesh.getObjectByName('rotorTail');
    if (rt) rt.rotation.x = e.spin * 18;
    const oct = e.mesh.getObjectByName('octa');
    if (oct) { oct.rotation.y = e.spin * 0.7; oct.rotation.x = Math.sin(e.spin * 0.4) * 0.2; }
    const halo = e.mesh.getObjectByName('halo');
    if (halo) halo.rotation.y = -e.spin * 0.4;
    const at = e.mesh.getObjectByName('atring');
    if (at) {
      at.visible = e.shield > 0;
      at.rotation.z = e.spin * 1.2;
      at.material.emissiveIntensity = 1.4 + Math.sin(e.spin * 3) * 0.6;
    }
    for (const nm of ['flame1', 'flame2']) {
      const f = e.mesh.getObjectByName(nm);
      if (f) f.scale.setScalar(0.8 + Math.random() * 0.5);
    }
  }
  const H = G.hero;
  H.mesh.visible = !H.dead;
  if (!H.dead) {
    H.mesh.position.copy(gw(H.x, H.y, 0));
    H.mesh.rotation.y = -H.angle;
    for (const nm of ['flame1', 'flame2']) {
      const f = H.mesh.getObjectByName(nm);
      if (f) { f.visible = H.moving; if (H.moving) f.scale.setScalar(0.8 + Math.random() * 0.6); }
    }
  }
  // 光束衰减
  for (const b of beamPool) {
    if (b.ttl <= 0) continue;
    b.ttl -= dt;
    b.mesh.material.opacity = Math.max(0, b.ttl / b.life) * 0.9;
    if (b.ttl <= 0) b.mesh.visible = false;
  }
  for (const r of ringPool) {
    if (r.ttl <= 0) continue;
    r.ttl -= dt;
    const a = Math.max(0, r.ttl / r.life);
    r.mesh.material.opacity = a * 0.8;
    const s = r.R * (1.35 - a * 0.35);
    r.mesh.scale.set(s, s, 1);
    if (r.ttl <= 0) r.mesh.visible = false;
  }
  // 传送门脉动
  const nextW = G.wave + (G.state === 'wave' ? 0 : 1);
  for (const pm of portalMeshes) {
    const act = spawnActive(pm.s, Math.max(nextW, G.wave));
    const pulse = act ? 1 + Math.sin(G.time * 4) * 0.08 : 1;
    pm.grp.scale.setScalar(pulse);
    pm.grp.traverse(o => {
      if (o.isMesh) o.material.emissiveIntensity = act ? 1.6 : 0.35;
    });
  }
  baseGroup.rotation.y = G.time * 0.25;
}

/* ---------- 覆盖层 2D（血条/文字/HUD） ---------- */
function drawOverlay() {
  octx.clearRect(0, 0, ov.width, ov.height);
  // 敌机血条
  for (const e of G.enemies) {
    const p = toScreen(e.x, e.y, e.z + (e.boss ? e.r * 1.6 + 16 : 30));
    if (!p) continue;
    const bw = e.boss ? 48 : 26;
    octx.fillStyle = 'rgba(0,0,0,0.6)';
    octx.fillRect(p.x - bw/2, p.y, bw, 4);
    octx.fillStyle = e.boss ? '#4dd7ff' : '#8dff4d';
    octx.fillRect(p.x - bw/2, p.y, bw * Math.max(0, e.hp / e.maxHp), 4);
    if (e.shieldMax > 0) {
      octx.fillStyle = 'rgba(0,0,0,0.6)';
      octx.fillRect(p.x - bw/2, p.y - 5, bw, 3);
      octx.fillStyle = '#ffb04d';
      octx.fillRect(p.x - bw/2, p.y - 5, bw * (e.shield / e.shieldMax), 3);
    }
  }
  const H = G.hero;
  if (!H.dead) {
    const p = toScreen(H.x, H.y, 40);
    if (p) {
      octx.fillStyle = 'rgba(0,0,0,0.6)';
      octx.fillRect(p.x - 15, p.y, 30, 4);
      octx.fillStyle = '#7dffee';
      octx.fillRect(p.x - 15, p.y, 30 * Math.max(0, H.hp / HERO_LV[H.lv].hp), 4);
    }
  } else {
    const p = toScreen((GOAL.c - 2.5) * CELL, goalPx.y, 34);
    if (p) {
      octx.fillStyle = 'rgba(255,122,26,0.85)';
      octx.font = 'bold 12px sans-serif'; octx.textAlign = 'center';
      octx.fillText('初号机再启动中 ' + Math.ceil(H.respawnT) + 's', p.x, p.y);
    }
  }
  // 标签
  octx.font = 'bold 11px sans-serif'; octx.textAlign = 'center';
  for (const pm of portalMeshes) {
    const act = spawnActive(pm.s, Math.max(G.wave + (G.state === 'wave' ? 0 : 1), G.wave));
    const p = toScreen((pm.s.c + 0.5) * CELL, (pm.s.r + 0.5) * CELL, 26);
    if (p) {
      octx.fillStyle = act ? 'rgba(255,100,100,0.95)' : 'rgba(255,100,100,0.45)';
      octx.fillText(act ? '敌袭口' : '第' + pm.s.from + '波启用', p.x, p.y);
    }
  }
  const bp = toScreen(goalPx.x, goalPx.y, 56);
  if (bp) { octx.fillStyle = '#b18aff'; octx.fillText('本部', bp.x, bp.y); }
  // 不可部署提示
  if (G.placing && mouse.c >= 0 && !(canBuild(mouse.c, mouse.r) && G.money >= TOWERS[G.placing].cost)) {
    const p = toScreen((mouse.c + 0.5) * CELL, (mouse.r + 0.5) * CELL, 50);
    if (p) {
      octx.fillStyle = 'rgba(255,90,90,0.95)';
      octx.font = 'bold 12px sans-serif';
      octx.fillText('不可部署（勿堵死通路）', p.x, p.y);
    }
  }
  // 漂浮文字
  for (const t of G.texts) {
    let x, y;
    if (t.screen) { x = t.x * ov.width; y = t.y * ov.height - (1 - t.ttl / t.life) * 30; }
    else {
      const p = toScreen(t.wx, t.wy, t.wz + (1 - t.ttl / t.life) * 26);
      if (!p) continue;
      x = p.x; y = p.y;
    }
    octx.globalAlpha = Math.max(0, Math.min(1, t.ttl / t.life * 1.6));
    octx.fillStyle = t.color;
    octx.font = 'bold ' + t.size + 'px sans-serif';
    octx.textAlign = 'center';
    octx.fillText(t.txt, x, y);
  }
  octx.globalAlpha = 1;
  // 技能 HUD
  octx.fillStyle = 'rgba(10,16,24,0.75)';
  octx.fillRect(10, ov.height - 40, 138, 28);
  octx.strokeStyle = 'rgba(125,255,238,0.4)';
  octx.strokeRect(10, ov.height - 40, 138, 28);
  const pct = H.dead ? 0 : 1 - H.abCd / HERO_ABILITY_CD;
  octx.fillStyle = 'rgba(125,255,238,0.25)';
  octx.fillRect(10, ov.height - 40, 138 * pct, 28);
  octx.fillStyle = pct >= 1 ? '#7dffee' : '#7d8ea0';
  octx.font = 'bold 12px sans-serif'; octx.textAlign = 'left';
  octx.fillText('E 暴走' + (pct >= 1 ? ' READY' : ' ' + Math.ceil(H.abCd) + 's'), 18, ov.height - 21);
  // 视角提示
  octx.fillStyle = 'rgba(125,142,160,0.55)';
  octx.font = '11px sans-serif'; octx.textAlign = 'right';
  octx.fillText('右键拖动旋转 · 滚轮缩放 · R 重置视角', ov.width - 12, ov.height - 12);
  if (G.paused && G.state !== 'won' && G.state !== 'lost') {
    octx.fillStyle = 'rgba(5,8,12,0.55)';
    octx.fillRect(0, 0, ov.width, ov.height);
    octx.fillStyle = '#8dff4d';
    octx.font = 'bold 30px sans-serif'; octx.textAlign = 'center';
    octx.fillText('‖ 作战暂停', ov.width/2, ov.height/2);
  }
}

/* ---------- UI 面板 ---------- */
function refreshTop() {
  document.getElementById('uiMoney').textContent = fmt(G.money);
  document.getElementById('uiLives').textContent = fmt(G.lives);
  document.getElementById('uiWave').textContent = Math.min(G.wave, TOTAL_WAVES) + '/' + TOTAL_WAVES;
  document.getElementById('uiKills').textContent = fmt(G.kills);
  document.getElementById('btnWave').disabled = !(G.state === 'idle' && G.wave < TOTAL_WAVES);
  for (const el of document.querySelectorAll('.card')) {
    const key = el.dataset.key;
    el.classList.toggle('poor', G.money < TOWERS[key].cost);
    el.classList.toggle('sel', G.placing === key);
  }
}
function refreshShop() {
  const shop = document.getElementById('shop');
  if (shop.childElementCount) return;   // 图标只生成一次
  const iconRd = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  iconRd.setSize(96, 96);
  iconRd.outputColorSpace = THREE.SRGBColorSpace;
  iconRd.toneMapping = THREE.ACESFilmicToneMapping;
  const iScene = new THREE.Scene();
  iScene.add(new THREE.HemisphereLight(0x8aa8cc, 0x22201c, 0.9));
  const iSun = new THREE.DirectionalLight(0xffffff, 1.6);
  iSun.position.set(40, 60, 50);
  iScene.add(iSun);
  const iCam = new THREE.PerspectiveCamera(34, 1, 1, 500);
  TOWER_KEYS.forEach((key, i) => {
    const T = TOWERS[key];
    const model = TOWER_BUILDERS[key]();
    model.rotation.y = -Math.PI * 0.72;
    iScene.add(model);
    const bb = new THREE.Box3().setFromObject(model);
    const ctr = bb.getCenter(new THREE.Vector3()), size = bb.getSize(new THREE.Vector3());
    const d = Math.max(size.x, size.y, size.z) * 1.55;
    iCam.position.set(ctr.x + d * 0.75, ctr.y + d * 0.65, ctr.z + d * 0.75);
    iCam.lookAt(ctr);
    iRdRender();
    function iRdRender() { iconRd.render(iScene, iCam); }
    const url = iconRd.domElement.toDataURL();
    iScene.remove(model);
    const card = document.createElement('div');
    card.className = 'card'; card.dataset.key = key;
    card.innerHTML =
      '<div class="hk">' + (i+1) + '</div>' +
      '<img src="' + url + '" width="48" height="48" alt="">' +
      '<div class="nm">' + T.name + '</div><div class="cost">💰' + T.cost + '</div>';
    card.onclick = () => { selectPlacing(G.placing === key ? null : key); };
    shop.appendChild(card);
  });
  iconRd.dispose();
}
function selectPlacing(key) {
  G.placing = key; G.selected = null;
  setGhost(key);
  refreshInfo(); refreshTop();
}
function row(k, v) { return '<div class="row"><span>' + k + '</span><b>' + v + '</b></div>'; }
function refreshInfo() {
  const el = document.getElementById('info');
  if (G.placing) {
    const T = TOWERS[G.placing];
    el.innerHTML =
      '<div class="tname">' + T.name + '</div><div class="desc">' + T.desc + '</div>' +
      row('部署费用', '💰' + T.cost) +
      (T.slow ? row('减速至', Math.round(T.slow[0]*100) + '%') : row('伤害', T.dmg[0])) +
      row('射程', T.range[0]) +
      (T.slow ? '' : row('射速', '每 ' + T.rate[0] + 's')) +
      (T.splash ? row('溅射半径', T.splash[0]) : '') +
      (T.pierce ? row('装甲穿透', Math.round(T.pierce*100) + '%') : '') +
      row('对空', T.air ? '✔' : '✘') +
      '<div class="desc" style="margin-top:6px;">点击地图空地部署 · 右键轻点取消<br>机体会阻挡地面敌军进路</div>';
    return;
  }
  if (G.selected === 'HERO') {
    const H = G.hero, S = HERO_LV[H.lv];
    const maxed = H.lv >= 2;
    el.innerHTML =
      '<div class="tname">EVA初号机 <span style="color:#7dffee">LV' + (H.lv+1) + '</span></div>' +
      '<div class="desc">适格者搭乘的初号机。WASD 机动（跟随镜头方向），自动开火，E 触发暴走范围冲击。机能停止后 8 秒再启动。</div>' +
      row('伤害', S.dmg) + row('耐久', Math.ceil(Math.max(0,H.hp)) + '/' + S.hp) +
      row('射程', S.range) + row('暴走冲击伤害', S.ab) +
      '<div class="btns">' +
      '<button id="btnUpH" ' + (maxed || G.money < (HERO_UP[H.lv]||0) ? 'disabled' : '') + '>' +
      (maxed ? '已满级' : '⬆ 强化 💰' + HERO_UP[H.lv]) + '</button></div>';
    const b = document.getElementById('btnUpH');
    if (b) b.onclick = () => { upgradeHero(); refreshInfo(); };
    return;
  }
  if (G.selected) {
    const t = G.selected, T = TOWERS[t.key];
    const maxed = t.lv >= 2;
    el.innerHTML =
      '<div class="tname">' + T.name + ' <span style="color:#4dd7ff">LV' + (t.lv+1) + '</span></div>' +
      '<div class="desc">' + T.desc + '</div>' +
      (T.slow ? row('减速至', Math.round(T.slow[t.lv]*100) + '%（Boss减半）') : row('伤害', towerStat(t,'dmg'))) +
      row('射程', towerStat(t,'range')) +
      (T.slow ? '' : row('射速', '每 ' + towerStat(t,'rate') + 's')) +
      (T.splash ? row('溅射半径', T.splash[t.lv]) : '') +
      row('对空', T.air ? '✔' : '✘') +
      '<div class="btns">' +
      '<button id="btnUp" ' + (maxed || G.money < (T.up[t.lv]||0) ? 'disabled' : '') + '>' +
      (maxed ? '已满级' : '⬆ 强化 💰' + T.up[t.lv]) + '</button>' +
      '<button id="btnSell">♻ 出售 💰' + Math.round(t.invested*0.7) + '</button></div>';
    document.getElementById('btnUp').onclick = () => { upgradeTower(t); refreshInfo(); };
    document.getElementById('btnSell').onclick = () => { sellTower(t); refreshInfo(); };
    return;
  }
  el.innerHTML = '<span style="color:var(--dim);font-size:12px;">选择格纳库中的机体部署迷宫，<br>点击已部署机体或初号机查看/强化。</span>';
}
function refreshNextWave() {
  const el = document.getElementById('nextwave');
  const n = G.wave + (G.state === 'wave' ? 0 : 1);
  if (G.state === 'wave') {
    el.innerHTML = '第 <b>' + G.wave + '</b> 波交战中… 剩余使徒 ' + (G.spawnQ.length + G.enemies.length);
    return;
  }
  if (n > TOTAL_WAVES) { el.innerHTML = '全部使徒已歼灭。'; return; }
  const parts = WAVE_DEFS[n-1].map(g => {
    const E = ENEMIES[g.type];
    return E.name + (E.fly ? '✈' : '') + '×' + g.n;
  }).join('、');
  el.innerHTML = '下一波（第 <b>' + n + '</b> 波）：<br>' + parts +
    (waveHasBoss(n) ? '<br><b>⚠ 侦测到使徒级反应！</b>' : '') +
    (n === SPAWNS[1].from ? '<br><b>⚠ 北侧第二入侵口将开放！</b>' : '') +
    '<br><span style="color:#556;">✈ = 飞行单位，无视迷宫直线突进</span>';
}

/* ============================================================
   输入：拾取 / 轨道镜头
   ============================================================ */
const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const mouse = { x: -1, y: -1, c: -1, r: -1 };
const _ndc = new THREE.Vector2(), _hit = new THREE.Vector3();
function pickGround(clientX, clientY) {
  const rect = glCanvas.getBoundingClientRect();
  _ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  _ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(_ndc, camera);
  if (!raycaster.ray.intersectPlane(groundPlane, _hit)) return null;
  return { x: _hit.x + W2, y: _hit.z + H2 };
}
let rmb = { down: false, moved: 0, lx: 0, ly: 0 };
glCanvas.addEventListener('mousedown', ev => {
  if (ev.button === 2) { rmb.down = true; rmb.moved = 0; rmb.lx = ev.clientX; rmb.ly = ev.clientY; }
});
window.addEventListener('mouseup', ev => {
  if (ev.button === 2 && rmb.down) {
    rmb.down = false;
    if (rmb.moved < 5) {   // 右键轻点 = 取消
      selectPlacing(null); G.selected = null; refreshInfo();
    }
  }
});
glCanvas.addEventListener('mousemove', ev => {
  if (rmb.down) {
    const dx = ev.clientX - rmb.lx, dy = ev.clientY - rmb.ly;
    rmb.moved += Math.abs(dx) + Math.abs(dy);
    ORBIT.az -= dx * 0.0058;
    ORBIT.pol = Math.max(0.32, Math.min(1.32, ORBIT.pol - dy * 0.004));
    rmb.lx = ev.clientX; rmb.ly = ev.clientY;
    updateCamera();
  }
  const g = pickGround(ev.clientX, ev.clientY);
  if (g) {
    const c = Math.floor(g.x / CELL), r = Math.floor(g.y / CELL);
    if (inGrid(c, r)) { mouse.c = c; mouse.r = r; } else { mouse.c = -1; mouse.r = -1; }
    mouse.x = g.x; mouse.y = g.y;
  } else { mouse.c = -1; mouse.r = -1; }
});
glCanvas.addEventListener('mouseleave', () => { mouse.c = -1; mouse.r = -1; });
glCanvas.addEventListener('wheel', ev => {
  ev.preventDefault();
  ORBIT.dist = Math.max(240, Math.min(1300, ORBIT.dist * (1 + ev.deltaY * 0.001)));
  updateCamera();
}, { passive: false });
glCanvas.addEventListener('contextmenu', ev => ev.preventDefault());
glCanvas.addEventListener('click', ev => {
  if (G.state === 'won' || G.state === 'lost') return;
  const g = pickGround(ev.clientX, ev.clientY);
  if (!g) return;
  const c = Math.floor(g.x / CELL), r = Math.floor(g.y / CELL);
  if (G.placing) {
    if (inGrid(c, r) && placeTower(G.placing, c, r)) {
      if (G.money < TOWERS[G.placing].cost) selectPlacing(null);
      refreshInfo();
    }
    return;
  }
  const H = G.hero;
  if (!H.dead && Math.hypot(g.x - H.x, g.y - H.y) < 24) {
    G.selected = 'HERO'; refreshInfo(); return;
  }
  const t = inGrid(c, r) ? towerAt(c, r) : null;
  G.selected = t || null;
  refreshInfo();
});
function resetView() {
  ORBIT.az = ORBIT.AZ0; ORBIT.pol = ORBIT.POL0; ORBIT.dist = ORBIT.DIST0;
  updateCamera();
}
document.addEventListener('keydown', ev => {
  const k = ev.key.toLowerCase();
  if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k) || 'wasder'.includes(k))
    ev.preventDefault();
  KEYS[k] = true;
  if (k === 'escape') { selectPlacing(null); G.selected = null; refreshInfo(); }
  else if (k === ' ') startWave();
  else if (k === 'p') togglePause();
  else if (k === 'e') heroAbility();
  else if (k === 'r') resetView();
  else {
    const i = parseInt(ev.key) - 1;
    if (i >= 0 && i < TOWER_KEYS.length) selectPlacing(TOWER_KEYS[i]);
  }
});
document.addEventListener('keyup', ev => { KEYS[ev.key.toLowerCase()] = false; });
window.addEventListener('blur', () => { for (const k in KEYS) KEYS[k] = false; });
document.getElementById('btnWave').onclick = () => startWave();
function togglePause() {
  G.paused = !G.paused;
  document.getElementById('btnPause').textContent = G.paused ? '▶ 继续' : '⏸ 暂停';
}
document.getElementById('btnPause').onclick = togglePause;
document.getElementById('btnSpeed').onclick = () => {
  G.speed = G.speed === 1 ? 2 : G.speed === 2 ? 3 : 1;
  document.getElementById('btnSpeed').textContent = '⏩ ' + G.speed + 'x';
};
document.getElementById('btnSound').onclick = () => {
  muted = !muted;
  document.getElementById('btnSound').textContent = muted ? '🔇' : '🔊';
};
document.getElementById('btnView').onclick = resetView;
document.getElementById('btnRestart').onclick = () => resetGame();

/* ---------- 尺寸自适应 ---------- */
function resize() {
  const w = stage.clientWidth || 900;
  const h = Math.round(w * 0.58);
  renderer.setSize(w, h, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  ov.width = w; ov.height = h;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

/* ---------- 部署预览同步 ---------- */
function syncPlacement() {
  const placing = G.placing && mouse.c >= 0;
  tileMark.visible = !!placing;
  if (placing) {
    const ok = canBuild(mouse.c, mouse.r) && G.money >= TOWERS[G.placing].cost;
    tileMark.position.copy(gw((mouse.c + 0.5) * CELL, (mouse.r + 0.5) * CELL, 0.8));
    tileMark.material.color.set(ok ? 0x4dff77 : 0xff4444);
    if (ghost) {
      ghost.visible = true;
      ghost.position.copy(gw((mouse.c + 0.5) * CELL, (mouse.r + 0.5) * CELL, 0));
    }
    showRange((mouse.c + 0.5) * CELL, (mouse.r + 0.5) * CELL, TOWERS[G.placing].range[0],
      ok ? 0x6dff8d : 0xff6a6a, true);
  } else {
    if (ghost) ghost.visible = false;
    if (G.selected && G.selected !== 'HERO') {
      const t = G.selected;
      showRange(t.x, t.y, towerStat(t, 'range'), 0x4dd7ff, true);
    } else if (G.selected === 'HERO' && !G.hero.dead) {
      showRange(G.hero.x, G.hero.y, HERO_LV[G.hero.lv].range, 0x7dffee, true);
    } else {
      showRange(0, 0, 1, 0, false);
    }
  }
}

/* ---------- 主循环 ---------- */
let lastT = performance.now();
let infoTick = 0;
function loop(now) {
  requestAnimationFrame(loop);
  let dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  if (!G.paused && G.state !== 'won' && G.state !== 'lost') {
    for (let i = 0; i < G.speed; i++) {
      G.time += dt;
      updateWave(dt);
      updateEnemies(dt);
      updateTowers(dt);
      updateHero(dt);
      updateProjs(dt);
      for (let j = 0; j < PMAX; j++) {
        const p = particles[j];
        if (p.ttl <= 0) continue;
        p.ttl -= dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.z += p.vz * dt; p.vz -= 210 * dt;
        if (p.z < 0) { p.z = 0; p.vz *= -0.4; }
        p.vx *= 0.96; p.vy *= 0.96;
      }
      for (const t of G.texts) t.ttl -= dt;
      G.texts = G.texts.filter(t => t.ttl > 0);
      if (G.state === 'won' || G.state === 'lost') break;
    }
  }
  syncMeshes(dt);
  syncPlacement();
  updateParticleBuffer();
  renderer.render(scene, camera);
  drawOverlay();
  refreshTop();
  if (G.state === 'wave') refreshNextWave();
  if (G.selected === 'HERO' && (infoTick++ % 20 === 0)) refreshInfo();
}
resize();
resetGame();
requestAnimationFrame(loop);
