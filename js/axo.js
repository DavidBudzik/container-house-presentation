// Dimension-true line axonometry of the five-container house, built on the client's own drawing.
// Geometry follows drawing set P1 (A-101, A-102, A-501) and the E1 member schedule.
// Sheet textures are the PDF pages at 200 dpi; at 1:50 that is 157.48 px per metre.
import * as THREE from 'three';

const C = { ink:0x2A2A28, hl:0x2F3A44, shell:0xFFFFFF, steel:0xB4B5B0, glass:0xE4ECEF, oak:0xE8D8C2, pier:0xDDDDD8, mesh:0x8E8F8A, pv:0xC6CCD3, paver:0xF4F4F3, red:0x2F3A44,
  frame:0x9D9E99, timber:0xE3CFB4, roof:0xEDECE7, interior:0xF7F6F2, accent:0x2F3A44, floor:0xF5EFE6, furniture:0xDCD3C5 };
const L = 12.19, Wd = 2.44, Hc = 2.9, P = 0.3;           // 40 ft HC module, pier height (m)
const GF = P, UF = P + Hc, RF = P + 2 * Hc, S = 3 * Wd;   // level bases, south face z
const LEVEL = [0, 2.4, 4.2];                               // explode offsets per level (m)
const N = 10;
const PPM = 200 / 25.4 * 20;                               // sheet px per model metre
// Outer face of the north-west container corner sits at px (393, 369) on A-101 and A-102.
const SHEET = { url: 'assets/img/sheet-a101.jpg', x: -393 / PPM, z: -369 / PPM, w: 3308 / PPM, d: 2339 / PPM };
const UPPER = { url: 'assets/img/sheet-a102-crop.jpg', x: -.8, z: -.8, w: 13.8, d: 8.9 };
const DAMP = 7;                                            // eased approach rate, 1/s

const clamp01 = v => Math.max(0, Math.min(1, v));
const smooth = v => { v = clamp01(v); return v * v * (3 - 2 * v); };
const ease = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

export function createAxo(canvas, { mode = 'story', fit = 1, model = null, sheets: withSheets = true, look = 'line' } = {}) {   // fit > 1 frames wider; model = GLB exported from the master; look = 'line' drawing or 'real' Blender materials; sheets = show the client's PDF pages
  const hero = mode === 'hero', sheets = !hero && withSheets;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.localClippingEnabled = true;
  const scene = new THREE.Scene();
  // Soft key light so members read as solids: top ~ base colour, lit side a little darker, shaded side darker still.
  const real = look === 'real';
  if (real) { renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; }
  scene.add(new THREE.HemisphereLight(0xffffff, 0xc9c2b6, real ? .55 : 1.55));
  { const sun = new THREE.DirectionalLight(0xfff4e6, real ? 2.2 : 1.05); sun.position.set(.5, 1, .35); scene.add(sun); }
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, -200, 400);
  const spin = new THREE.Group(); scene.add(spin);
  const root = new THREE.Group(); spin.add(root);
  if (hero) root.position.set(-L / 2 - .6, 0, -4.7);
  const labelHost = canvas.parentElement.querySelector('.axo-labels');

  const section = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 1e3);
  const hcut = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e3);          // horizontal plan cut for floor focus
  const AZ0 = Math.PI / 4, EL0 = Math.atan2(.82, Math.SQRT2);       // default SE isometric
  const FOCUS0 = { fx: L / 2 + .5, fy: 2.4, fz: 4.6, m0: 1, m1: 1, m2: 1, cut: 40 };
  const target = { build: N, extrude: 1, view: 1, explode: 0, section: 0, az: AZ0, el: EL0, zoom: 1, sheet: 1, ...FOCUS0 };
  const cur = { ...target };
  let labels = !hero, inset = 0;
  let dirty = true, visible = true, raf = 0, last = performance.now();

  /* ---------- builders ---------- */
  const pieces = [];
  const face = color => new THREE.MeshBasicMaterial({ color, transparent: true, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  const faceLit = color => new THREE.MeshLambertMaterial({ color, transparent: true, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  const LIT = new Set(['timber', 'steel', 'frame', 'furniture', 'pier']);
  const edge = (opacity = .62) => { const m = new THREE.LineBasicMaterial({ color: C.ink, transparent: true, opacity }); m.userData.base = m.color.clone(); return m; };
  function box(w, h, d, color, { x = 0, y = 0, z = 0, edges = true } = {}) {
    const g = new THREE.BoxGeometry(w, h, d); g.translate(w / 2, h / 2, d / 2);
    const m = new THREE.Mesh(g, face(color)); m.position.set(x, y, z);
    if (edges) m.add(new THREE.LineSegments(new THREE.EdgesGeometry(g), edge()));
    return m;
  }
  const lines = (pts, opacity = .62) => new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), edge(opacity));
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  function add(obj, step, o = {}) {
    root.add(obj);
    const p = { obj, step, type: o.type || 'drop', delay: o.delay || 0, lift: o.lift ?? 7, level: o.level || 0,
      label: o.label || null, anchor: o.anchor || null, shell: !!o.shell, extrude: !!o.extrude,
      base: obj.position.clone(), mats: [], baseOp: [], edges: [], vis: 0 };
    obj.traverse(n => { if (!n.material) return; p.mats.push(n.material); p.baseOp.push(n.material.opacity);
      if (n.isLineSegments && !n.userData.noHL) p.edges.push(n.material);
      n.material.clippingPlanes = p.shell ? [section, hcut] : [hcut]; });
    pieces.push(p); return p;
  }

  function container(name, x0, y0, z0, step, level, ax, lift = 8) {
    const g = new THREE.Group(); g.position.set(x0, y0, z0);
    g.add(box(L, Hc, Wd, C.shell));
    const pts = [];
    for (let x = .2; x < L - .15; x += .3) pts.push(V(x, .12, -.004), V(x, Hc - .12, -.004), V(x, .12, Wd + .004), V(x, Hc - .12, Wd + .004));
    for (let z = .2; z < Wd - .15; z += .3) pts.push(V(-.004, .12, z), V(-.004, Hc - .12, z), V(L + .004, .12, z), V(L + .004, Hc - .12, z));
    g.add(Object.assign(lines(pts, .14), { userData: { noHL: true } }));
    const rp = []; [.12, Hc - .12].forEach(y => [-.004, Wd + .004].forEach(z => rp.push(V(0, y, z), V(L, y, z))));
    g.add(Object.assign(lines(rp, .32), { userData: { noHL: true } }));
    [[0, 0], [L - .18, 0], [0, Wd - .16], [L - .18, Wd - .16]].forEach(([x, z]) => [0, Hc - .12].forEach(y => g.add(box(.18, .12, .16, C.steel, { x, y, z, edges: false }))));
    return add(g, step, { level, lift, shell: true, extrude: level === 0, label: name, anchor: V(x0 + L * ax, y0 + Hc + .05, z0 + Wd / 2) });
  }

  /* ---------- the client's drawings ---------- */
  const tex = [];
  function sheetPlane(def, y, { order = 0 } = {}) {
    const t = new THREE.TextureLoader().load(def.url, () => { dirty = true; kick(); });
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); tex.push(t);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(def.w, def.d),
      new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 }));
    m.rotation.x = -Math.PI / 2; m.position.set(def.x + def.w / 2, y, def.z + def.d / 2); m.renderOrder = order;
    root.add(m); return m;
  }
  let sheet = null, upper = null, sheetEdge = null;
  if (sheets) {
    sheet = sheetPlane(SHEET, 0);
    sheetEdge = lines([V(SHEET.x, 0, SHEET.z), V(SHEET.x + SHEET.w, 0, SHEET.z), V(SHEET.x + SHEET.w, 0, SHEET.z), V(SHEET.x + SHEET.w, 0, SHEET.z + SHEET.d),
      V(SHEET.x + SHEET.w, 0, SHEET.z + SHEET.d), V(SHEET.x, 0, SHEET.z + SHEET.d), V(SHEET.x, 0, SHEET.z + SHEET.d), V(SHEET.x, 0, SHEET.z)], .25);
    root.add(sheetEdge);
    upper = sheetPlane(UPPER, UF + .015, { order: 1 });
  }

  /* ---------- 0 · piers ---------- */
  let k = 0;
  [.15, 4.25, 8.2, 12.04].forEach(x => [.1, 2.44, 4.88, 7.22].forEach(z =>
    add(box(.32, P, .32, C.pier, { x: x - .16, z: z - .16 }), 0, { type: 'grow', delay: (k++) * .03 })));
  if (!sheets) add(lines([V(0, .02, -1.2), V(L, .02, -1.2), V(0, .02, -1.45), V(0, .02, -.95), V(L, .02, -1.45), V(L, .02, -.95),
    V(-1.2, .02, 0), V(-1.2, .02, S), V(-1.45, .02, 0), V(-.95, .02, 0), V(-1.45, .02, S), V(-.95, .02, S)], .9), 0, { type: 'fade' });

  /* ---------- 1–3 · ground modules ---------- */
  container('C1', 0, GF, 0, 1, 0, .93);
  container('C2', 0, GF, Wd, 2, 0, .8);
  container('C3', 0, GF, 2 * Wd, 3, 0, .67);

  /* ---------- 4 · seam steel + stair ---------- */
  const steel = new THREE.Group();
  [Wd, 2 * Wd].forEach(z => {
    steel.add(box(11.89, .3, .2, C.steel, { x: .15, y: GF + Hc - .35, z: z - .1 }));
    [4.25, 8.2].forEach(x => steel.add(box(.12, Hc - .38, .12, C.steel, { x: x - .06, y: GF, z: z - .06 })));
  });
  steel.add(box(11.89, .3, .2, C.steel, { x: .15, y: UF + Hc - .35, z: Wd - .1 }));
  steel.add(box(8.3, .2, .15, C.steel, { x: .15, y: GF + Hc - .32, z: S - .15 }));
  add(steel, 4, { lift: 3, extrude: true, label: 'Seam girders RHS 300×200', anchor: V(2.2, GF + Hc - .2, 2 * Wd) });
  const stair = new THREE.Group();
  for (let i = 0; i < 17; i++) stair.add(box(.26, .05, 1, C.oak, { x: 11 - i * .225, y: GF + .25 + i * .171, z: .15 }));
  add(stair, 4, { lift: 3, extrude: true });

  /* ---------- 5–6 · upper modules ---------- */
  container('C4', 0, UF, 0, 5, 1, .93, 9);
  container('C5', 0, UF, Wd, 6, 1, .78, 9);

  /* ---------- 7 · glazing + doors ---------- */
  const glzG = new THREE.Group(), glzU = new THREE.Group();
  function pane(grp, w, h, { x, y, z, axis = 'z', color = C.glass, mull = 0 }) {
    const t = .05, g = axis === 'z' ? box(w, h, t, color, { x, y, z }) : box(t, h, w, color, { x, y, z });
    if (mull > 1) { const pts = []; for (let i = 1; i < mull; i++) { const f = w * i / mull;
      if (axis === 'z') pts.push(V(f, 0, t + .003), V(f, h, t + .003), V(f, 0, -.003), V(f, h, -.003));
      else pts.push(V(-.003, 0, f), V(-.003, h, f), V(t + .003, 0, f), V(t + .003, h, f)); }
      g.add(lines(pts)); }
    grp.add(g); return g;
  }
  pane(glzG, 3.9, 2.45, { x: .25, y: GF + .25, z: S, mull: 2 }); pane(glzG, 3.9, 2.45, { x: 4.35, y: GF + .25, z: S, mull: 2 });
  [0, 1, 2].forEach(i => pane(glzG, 2.2, 2.45, { x: -.05, y: GF + .25, z: i * Wd + .12, axis: 'x', mull: i === 2 ? 2 : 0 }));
  pane(glzG, 2.19, 2.45, { x: L, y: GF + .25, z: 2 * Wd + .12, axis: 'x' });
  pane(glzG, 1.2, 2.4, { x: L, y: GF + .25, z: Wd + .5, axis: 'x', color: C.steel });
  pane(glzG, .6, 2.4, { x: L, y: GF + .25, z: Wd + 1.75, axis: 'x' });
  pane(glzG, 2.34, 2.59, { x: L, y: GF + .15, z: .05, axis: 'x', color: C.red, mull: 2 });
  [9.0, 10.2].forEach(x => pane(glzG, .6, 1.8, { x, y: GF + .6, z: -.05 }));
  pane(glzG, 2.4, .6, { x: 4.6, y: GF + 1.35, z: -.05 });
  [0, 1].forEach(i => pane(glzU, 2.2, 2.45, { x: -.05, y: UF + .25, z: i * Wd + .12, axis: 'x' }));
  pane(glzU, 3, 2.45, { x: .6, y: UF + .2, z: 2 * Wd, mull: 2 });
  pane(glzU, 2.4, 2.45, { x: 8.8, y: UF + .2, z: 2 * Wd, mull: 2 });
  pane(glzU, 1.2, 2.45, { x: L, y: UF + .2, z: Wd + .6, axis: 'x' });
  [4.8, 7.0, 9.6].forEach(x => pane(glzU, .6, 1.8, { x, y: UF + .6, z: -.05 }));
  add(glzG, 7, { type: 'fade', label: 'W01 sliding glass 3.9 × 2.45', anchor: V(2.2, GF + 2.7, S) });
  add(glzU, 7, { type: 'fade', level: 1 });

  /* ---------- 8 · deck + pergolas ---------- */
  const deck = new THREE.Group();
  deck.add(box(13, .12, 2.4, C.oak, { x: -.3, y: .28, z: S }));
  deck.add(box(2.2, .12, 2.4 + Wd, C.oak, { x: L, y: .28, z: 2 * Wd }));
  { const pts = []; for (let x = -.3; x < 12.7; x += .15) pts.push(V(x, .401, S), V(x, .401, S + 2.4)); deck.add(lines(pts, .15)); }
  add(deck, 8, { type: 'grow' });
  const perg = new THREE.Group(), pz = S + 2.3;
  [0, 4.1, 8.15, 12.09].forEach(x => perg.add(box(.1, UF - .4, .1, C.steel, { x, y: .4, z: pz })));
  perg.add(box(L, .2, .1, C.steel, { x: 0, y: UF - .2, z: pz }));
  for (let x = .05; x < L; x += .45) perg.add(box(.05, .15, 2.4, C.steel, { x, y: UF - .15, z: S, edges: false }));
  [[L + 2.1, 2 * Wd + .05], [L + 2.1, S + 2.3]].forEach(([x, z]) => perg.add(box(.1, UF - .4, .1, C.steel, { x, y: .4, z })));
  perg.add(box(.1, .2, 2.4 + Wd, C.steel, { x: L + 2.1, y: UF - .2, z: 2 * Wd }));
  for (let z = 2 * Wd + .1; z < S + 2.4; z += .45) perg.add(box(2.2, .15, .05, C.steel, { x: L, y: UF - .15, z, edges: false }));
  add(perg, 8, { lift: 4, delay: .25, label: 'South pergola 12.19 × 2.4', anchor: V(L - .5, UF, pz) });

  /* ---------- 9 · terrace, louver shade, PV ---------- */
  const ter = new THREE.Group();
  ter.add(box(L - .1, .06, Wd - .1, C.paver, { x: .05, y: UF, z: 2 * Wd + .05 }));
  const rail = (len, x, z, ax) => { const h = 1.1;
    ter.add(ax === 'x' ? box(len, .05, .05, C.steel, { x, y: UF + h, z }) : box(.05, .05, len, C.steel, { x, y: UF + h, z }));
    const m = ax === 'x' ? box(len, h, .02, C.mesh, { x, y: UF, z, edges: false }) : box(.02, h, len, C.mesh, { x, y: UF, z, edges: false });
    m.material.opacity = .12; ter.add(m); };
  rail(L, 0, S - .05, 'x'); rail(Wd, 0, 2 * Wd, 'z'); rail(Wd, L - .05, 2 * Wd, 'z');
  add(ter, 9, { lift: 3, level: 1, label: 'Roof terrace 29.7 m²', anchor: V(6, UF + 1.15, S - .05) });
  const shade = new THREE.Group();
  [.05, 6.05, 12.05].forEach(x => shade.add(box(.08, Hc - .05, .08, C.steel, { x, y: UF, z: S - .12 })));
  shade.add(box(L, .12, .1, C.steel, { x: 0, y: RF - .1, z: S - .15 }));
  for (let i = 0; i < 48; i++) { const b = box(.04, .2, Wd, C.steel, { x: .12 + i * .25, y: RF - .05, z: 2 * Wd, edges: false }); b.rotation.z = 20 * Math.PI / 180; shade.add(b); }
  add(shade, 9, { lift: 4, level: 2, delay: .2 });
  const pv = new THREE.Group();
  for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) { const p = box(1.1, .04, 1.9, C.pv, { x: 1 + i * 1.2, y: RF + .12, z: .3 + j * 2.2 }); p.rotation.x = -.08; pv.add(p); }
  pv.add(box(1.6, .5, .55, C.pier, { x: 10.5, y: RF, z: 3.9 }));
  add(pv, 9, { lift: 4, level: 2, delay: .35, label: 'PV array', anchor: V(5.8, RF + .3, .4) });

  /* ---------- labels ---------- */
  function mkLabel(text, cls = '') { if (!labelHost) return null; const d = document.createElement('div'); d.className = 'lbl ' + cls; d.innerHTML = '<b></b>'; d.firstChild.textContent = text; d.style.opacity = 0; labelHost.appendChild(d); return d; }
  pieces.forEach(p => { if (p.label) p.el = mkLabel(p.label); });
  // Pinned to the drawing's own dimension strings and title block on A-101.
  const fixed = sheets ? [
    { t: 'A-101 · your PDF · 1:50', a: V(SHEET.x + 3055 / PPM, 0, SHEET.z + 2080 / PPM), cls: 'tag', when: () => cur.view < .5 },
    { t: '12 190 mm', a: V(L / 2, 0, SHEET.z + 196 / PPM), cls: 'dim live', when: () => cur.view < .85 },
    { t: '7 320 mm', a: V(SHEET.x + 150 / PPM, 0, S / 2), cls: 'dim live', when: () => cur.view < .85 },
    { t: 'A-102 · upper floor', a: V(UPPER.x + .4, UF, UPPER.z + .3), cls: 'tag', when: () => upperOp > .5 },
  ] : [];
  fixed.forEach(f => f.el = mkLabel(f.t, f.cls));

  /* ---------- camera ---------- */
  const tgt = new THREE.Vector3(), dir = new THREE.Vector3(), up = new THREE.Vector3();
  const D_PLAN = V(0, 1, .0001).normalize(), D_ISO = new THREE.Vector3(), U_PLAN = V(0, 0, -1), U_ISO = V(0, 1, 0);
  const T_PLAN = V(SHEET.x + SHEET.w / 2, 0, SHEET.z + SHEET.d / 2);
  function placeCamera() {
    const k = smooth(cur.view), w = canvas.clientWidth || 1, h = canvas.clientHeight || 1, aspect = w / h;
    const vis = 1 - Math.abs(inset), u = (1 - inset) / 2;     // visible width fraction, model centre position
    let half;
    if (hero) half = Math.max(6.6, 9.2 / aspect);
    else {
      const planHalf = Math.max(SHEET.d / 2 * 1.06, SHEET.w / 2 * 1.04 / (aspect * vis));
      const isoHalf = Math.max(6.5, 8.8 / (aspect * vis)) * (1 + .5 * cur.explode);
      half = planHalf + (isoHalf - planHalf) * k;
    }
    half *= fit / cur.zoom;
    const W2 = 2 * half * aspect;
    cam.left = -u * W2; cam.right = (1 - u) * W2; cam.top = half; cam.bottom = -half; cam.updateProjectionMatrix();
    D_ISO.set(Math.cos(cur.el) * Math.sin(cur.az), Math.sin(cur.el), Math.cos(cur.el) * Math.cos(cur.az));
    dir.copy(D_PLAN).lerp(D_ISO, k).normalize(); up.copy(U_PLAN).lerp(U_ISO, k).normalize();
    if (hero) tgt.set(0, 2.6, 0);
    else { tgt.copy(T_PLAN).lerp(V(cur.fx, cur.fy + 3 * cur.explode, cur.fz), k); }
    cam.position.copy(tgt).addScaledVector(dir, 80); cam.up.copy(up); cam.lookAt(tgt);
  }

  /* ---------- apply state ---------- */
  const hl = new THREE.Color(C.hl), ink = new THREE.Color(C.ink), v3 = new THREE.Vector3();
  let upperOp = 0;
  function apply() {
    const t = cur.build, focus = Math.max(0, Math.min(N - 1, Math.ceil(t - 1e-3) - 1));
    const ext = Math.max(.001, cur.extrude), trace = cur.extrude < .999;   // walls traced off the drawing, then raised
    hcut.constant = cur.cut < 39 ? root.position.y + cur.cut : 1e3;
    section.constant = cur.section > 0 ? (root.position.x + L + .5) - cur.section * (L * .55) : 1e3;    pieces.forEach(p => {
      const q = ease(clamp01((t - p.step) * 1.25 - p.delay)); p.vis = q;
      const lv = [cur.m0, cur.m1, cur.m2][p.level] ?? 1;
      p.vis = q * lv;                                   // callouts hide with their level
      p.obj.visible = q * lv > .002;
      p.obj.position.y = p.base.y + cur.explode * LEVEL[p.level] + (p.type === 'drop' ? (1 - q) * p.lift : 0);
      const e = p.extrude ? ext : 1;
      p.obj.scale.y = p.type === 'grow' ? Math.max(.001, q) * e : e;
      const faceK = p.extrude ? smooth(cur.extrude * 1.4) : 1;          // faces appear as walls rise, drawing stays readable
      p.mats.forEach((m, i) => {
        const base = p.baseOp[i] * (p.type === 'grow' ? 1 : q) * lv;
        m.opacity = m.isLineBasicMaterial ? base : base * faceK; m.depthWrite = m.opacity > .6; });
      const on = !hero && ((p.extrude && trace && p.step <= 3) || (p.step === focus && t - p.step > 0 && t - p.step < 1.6 && t > 4.05 && t < N - .01));
      p.edges.forEach(m => m.color.copy(on ? hl : m.userData.base || ink));
    });
    if (sheet) {
      sheet.material.opacity = (1 - .25 * smooth(cur.view)) * cur.sheet; sheet.visible = sheetEdge.visible = cur.sheet > .01;
      sheetEdge.material.opacity = .25 * cur.sheet;
      upperOp = smooth((t - 4.55) / .45) * (1 - smooth((t - 6.6) / .6));
      upper.visible = upperOp > .01; upper.material.opacity = upperOp * .9;
      upper.position.y = UF + .015 + cur.explode * LEVEL[1];
    }
    placeCamera();
    const w = canvas.clientWidth, h = canvas.clientHeight, lbl = labels && w >= 560;
    const put = (el, a, lvl, show) => { if (!el) return;
      v3.copy(a); v3.y += cur.explode * LEVEL[lvl || 0]; root.localToWorld(v3); v3.project(cam);
      el.style.left = ((v3.x + 1) / 2 * w) + 'px'; el.style.top = ((1 - v3.y) / 2 * h) + 'px'; el.style.opacity = show ? 1 : 0; };
    callouts(pieces.filter(p => p.el), lbl && cur.view > .6, w, h);
    fixed.forEach(f => put(f.el, f.a, 0, lbl && f.when()));
  }


  /* ---------- callout labels: columns beside the model, leader lines to the part ---------- */
  let svg = null;
  function callouts(list, on, w, h) {
    if (!labelHost) return;
    if (!svg) { svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', 'leaders'); labelHost.prepend(svg); }
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    const cx = w * (1 - inset) / 2, pad = 18, gap = 30, cols = { l: [], r: [] };
    list.forEach(p => {
      const show = on && p.vis > .85;
      p.el.classList.add('call'); p.el.style.opacity = show ? 1 : 0;
      if (!show) return;
      v3.copy(p.anchor); v3.y += cur.explode * LEVEL[p.level || 0]; root.localToWorld(v3); v3.project(cam);
      const ax = (v3.x + 1) / 2 * w, ay = (1 - v3.y) / 2 * h;
      (ax < cx ? cols.l : cols.r).push({ p, ax, ay });
    });
    let d = '', dots = '';
    for (const side of ['l', 'r']) {
      const col = cols[side].sort((a, b) => a.ay - b.ay);
      let y = 64;
      col.forEach(c => { c.y = Math.max(c.ay, y); y = c.y + gap; });
      const over = y - gap - (h - 48); if (over > 0) col.forEach(c => c.y -= over);   // keep the column on screen
      col.forEach(c => {
        const lw = c.p.el.offsetWidth || 120;
        const L0 = inset < 0 ? -inset * w : 0, R0 = inset > 0 ? w * (1 - inset) : w;      // visible area beside a floating panel
        const x = side === 'l' ? L0 + pad : (R0 - pad - lw), ex = side === 'l' ? x + lw + 6 : x - 6;
        c.p.el.style.left = x + 'px'; c.p.el.style.top = c.y + 'px';
        const kx = side === 'l' ? Math.min(c.ax - 12, ex + 28) : Math.max(c.ax + 12, ex - 28);
        d += `M${ex} ${c.y}H${kx}L${c.ax} ${c.ay}`; dots += `M${c.ax} ${c.ay}m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0`;
      });
    }
    svg.innerHTML = `<path class="ld" d="${d}"/><path class="dt" d="${dots}"/>`;
  }

  /* ---------- real geometry: GLB exported from Container House.blend (see Container House/blender/web-model) ---------- */
  const KIND = { shell: C.shell, steel: C.steel, frame: C.frame, glass: C.glass, timber: C.timber, pier: C.pier,
                 roof: C.roof, pv: C.pv, interior: C.interior, accent: C.accent, floor: C.floor, furniture: C.furniture };
  const LABEL = { 0: 'Piers', 1: 'C1', 2: 'C2', 3: 'C3', 4: 'Seam steel + return stair', 5: 'C4', 6: 'C5',
                  7: 'Glazing + furniture', 8: 'Deck + timber pergola', 9: 'Terrace shade + PV' };
  // Black silhouette for rounded furniture: back faces pushed out along smooth normals (inverted hull).
  function outline(geom) {
    geom.computeVertexNormals();
    const m = new THREE.MeshBasicMaterial({ color: 0x131313, side: THREE.BackSide, transparent: true });
    m.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\n  transformed += normalize(normal) * 0.011;'); };
    const hull = new THREE.Mesh(geom, m); hull.userData.kind = 'furniture'; hull.userData.hull = true; hull.renderOrder = -1;
    return hull;
  }

  async function loadModel(url) {
    const [{ GLTFLoader }, { DRACOLoader }, { mergeGeometries, mergeVertices }] = await Promise.all([
      import('three/addons/loaders/GLTFLoader.js'), import('three/addons/loaders/DRACOLoader.js'),
      import('three/addons/utils/BufferGeometryUtils.js')]);
    const loader = new GLTFLoader();
    loader.setDRACOLoader(new DRACOLoader().setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/gltf/'));
    const gltf = await loader.loadAsync(url);
    gltf.scene.position.set(4.55, 0, 5.38);   // Blender NW container corner (-4.55, 5.38) -> drawing origin
    gltf.scene.updateMatrixWorld(true);
    const buckets = new Map();                                   // step|level|shell -> kind -> {faces[], edges[]}
    gltf.scene.traverse(n => {
      if (!n.isMesh) return;
      let a = n; while (a && a.userData.web_step === undefined) a = a.parent;          // instance children carry no extras
      const x = a ? a.userData : {}, step = x.web_step ?? 4, level = x.web_level ?? 0;
      const kind = /Louver|Shade|Pergola|Timber/i.test((a || n).name) && x.web_kind !== 'steel' ? 'timber' : (x.web_kind || 'interior');
      const key = `${step}|${level}|${kind === 'shell' ? 1 : 0}`;
      const g = n.geometry.clone(); g.applyMatrix4(n.matrixWorld);
      for (const a of Object.keys(g.attributes)) if (a !== 'position') g.deleteAttribute(a);
      const ng = g.index ? g.toNonIndexed() : g;
      const e = new THREE.EdgesGeometry(g, kind === 'shell' ? 60 : kind === 'furniture' ? 70 : 28);
      const b = buckets.get(key) || new Map(); buckets.set(key, b);
      const k = b.get(kind) || { faces: [], edges: [] }; b.set(kind, k);
      k.faces.push(ng); k.edges.push(e);
    });
    // replace the procedural massing
    pieces.forEach(p => { root.remove(p.obj); p.el?.remove(); });
    pieces.length = 0;
    const byStep = new Map();
    for (const [key, kinds] of buckets) {
      const [step, level, shell] = key.split('|').map(Number);
      const grp = new THREE.Group();
      for (const [kind, k] of kinds) {
        const lit = LIT.has(kind), merged = mergeGeometries(k.faces);
        if (lit) merged.computeVertexNormals();                          // flat normals: one tone per face
        const fm = (lit ? faceLit : face)(KIND[kind] ?? C.interior); if (kind === 'glass') fm.opacity = .45;
        const mesh = new THREE.Mesh(merged, fm); mesh.userData.kind = kind; grp.add(mesh);
        const em = edge(kind === 'shell' ? .22 : kind === 'glass' ? .3 : kind === 'timber' ? 1 : kind === 'furniture' ? .9 : kind === 'steel' ? .42 : .5);
        if (kind === 'timber' || kind === 'furniture') { em.color.set(0x131313); em.opacity = 1; em.userData.base = em.color.clone(); }
        if (kind === 'furniture') grp.add(outline(mergeVertices(mergeGeometries(k.faces), 1e-3)));
        if (kind === 'shell') em.userData.base = new THREE.Color(0x6E6F6A);
        const ls = new THREE.LineSegments(mergeGeometries(k.edges), em); ls.userData.kind = kind; grp.add(ls);
      }
      const box = new THREE.Box3().setFromObject(grp);
      const type = step === 0 ? 'grow' : step === 7 ? 'fade' : 'drop';
      const p = add(grp, step, { type, level, lift: step >= 5 ? 9 : step === 4 ? 3 : 7, shell: !!shell,
        extrude: level === 0 && step <= 4 && step > 0, delay: step === 0 ? 0 : .05 * level });
      p.box = box;
      const best = byStep.get(step); if (!best || box.getSize(v3).length() > best.box.getSize(new THREE.Vector3()).length()) byStep.set(step, p);
    }
    for (const [step, p] of byStep) {
      if (!LABEL[step] || step === 0) continue;
      const b = p.box; p.label = LABEL[step];
      p.anchor = new THREE.Vector3((b.min.x + b.max.x) / 2, b.max.y, (b.min.z + b.max.z) / 2);
      p.el = mkLabel(p.label);
    }
    applyLayers(); dirty = true; kick();
  }

  // Real look: the GLB carries the Blender materials (web-model/export_glb.py). Same step/level/kind buckets as the
  // drawing, merged per material so draw calls stay low; every bucket gets its own material copies so pieces fade apart.
  async function loadModelReal(url) {
    const [{ GLTFLoader }, { DRACOLoader }, { mergeGeometries }, { RoomEnvironment }] = await Promise.all([
      import('three/addons/loaders/GLTFLoader.js'), import('three/addons/loaders/DRACOLoader.js'),
      import('three/addons/utils/BufferGeometryUtils.js'), import('three/addons/environments/RoomEnvironment.js')]);
    const loader = new GLTFLoader();
    loader.setDRACOLoader(new DRACOLoader().setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/gltf/'));
    const gltf = await loader.loadAsync(url);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(new RoomEnvironment(), .04).texture; pm.dispose();
    gltf.scene.position.set(4.55, 0, 5.38);   // Blender NW container corner (-4.55, 5.38) -> drawing origin
    gltf.scene.updateMatrixWorld(true);
    const buckets = new Map();                                   // step|level|shell -> material -> {kind, geoms[]}
    gltf.scene.traverse(n => {
      if (!n.isMesh) return;
      let a = n; while (a && a.userData.web_step === undefined) a = a.parent;
      const x = a ? a.userData : {}, step = x.web_step ?? 4, level = x.web_level ?? 0;
      const kind = /Louver|Shade|Pergola|Timber/i.test((a || n).name) && x.web_kind !== 'steel' ? 'timber' : (x.web_kind || 'interior');
      const key = `${step}|${level}|${kind === 'shell' ? 1 : 0}`;
      const g = n.geometry.clone(); g.applyMatrix4(n.matrixWorld);
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
      if (!g.attributes.normal) g.computeVertexNormals();
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      const ng = g.index ? g.toNonIndexed() : g;
      const b = buckets.get(key) || new Map(); buckets.set(key, b);
      const mk = `${n.material.uuid}|${kind}`;
      const e = b.get(mk) || { kind, mat: n.material, geoms: [] }; b.set(mk, e); e.geoms.push(ng);
    });
    pieces.forEach(p => { root.remove(p.obj); p.el?.remove(); });
    pieces.length = 0;
    const byStep = new Map();
    for (const [key, mats] of buckets) {
      const [step, level, shell] = key.split('|').map(Number);
      const grp = new THREE.Group();
      for (const { kind, mat, geoms } of mats.values()) {
        let m = mat.clone();
        if (kind === 'glass' || m.transmission > 0 || /glass/i.test(m.name)) {
          m = new THREE.MeshStandardMaterial({ color: 0xBFD3DA, roughness: .05, metalness: .1, opacity: .28 });
        }
        m.transparent = true; m.polygonOffset = true; m.polygonOffsetFactor = 1; m.polygonOffsetUnits = 1;
        if (m.opacity === 1 && m.transmission > 0) m.transmission = 0;
        const mesh = new THREE.Mesh(mergeGeometries(geoms), m); mesh.userData.kind = kind; grp.add(mesh);
      }
      const box = new THREE.Box3().setFromObject(grp);
      const type = step === 0 ? 'grow' : step === 7 ? 'fade' : 'drop';
      const p = add(grp, step, { type, level, lift: step >= 5 ? 9 : step === 4 ? 3 : 7, shell: !!shell,
        extrude: level === 0 && step <= 4 && step > 0, delay: step === 0 ? 0 : .05 * level });
      p.box = box;
      const best = byStep.get(step); if (!best || box.getSize(v3).length() > best.box.getSize(new THREE.Vector3()).length()) byStep.set(step, p);
    }
    for (const [step, p] of byStep) {
      if (!LABEL[step] || step === 0) continue;
      const b = p.box; p.label = LABEL[step];
      p.anchor = new THREE.Vector3((b.min.x + b.max.x) / 2, b.max.y, (b.min.z + b.max.z) / 2);
      p.el = mkLabel(p.label);
    }
    applyLayers(); dirty = true; kick();
  }

  const layerOff = new Set();
  function applyLayers() { root.traverse(n => { if (n.userData.kind) n.visible = !layerOff.has(n.userData.kind); }); }

  /* ---------- cut edges: outline where the plan cut or section plane slices the model ---------- */
  let cutLines = null, cutKey = '', fat = null, cutBusy = false;
  const ta = new THREE.Vector3(), tb = new THREE.Vector3(), tc = new THREE.Vector3(), tri = [ta, tb, tc], dv = [0, 0, 0];
  function slice(out, pos, M, axis, c, off) {             // axis 0 = x (section), 1 = y (plan cut)
    for (let i = 0; i < pos.count; i += 3) {
      for (let k = 0; k < 3; k++) { tri[k].fromBufferAttribute(pos, i + k).applyMatrix4(M); dv[k] = tri[k].getComponent(axis) - c; }
      let n = 0; const h = [];
      for (const [i0, i1] of [[0, 1], [1, 2], [2, 0]]) {
        if ((dv[i0] < 0) === (dv[i1] < 0)) continue;
        const t = dv[i0] / (dv[i0] - dv[i1]), p0 = tri[i0], p1 = tri[i1];
        h.push(p0.x + (p1.x - p0.x) * t, p0.y + (p1.y - p0.y) * t, p0.z + (p1.z - p0.z) * t); n++;
      }
      if (n === 2) { h[axis] += off; h[3 + axis] += off; out.push(...h); }
    }
  }
  // Wall tops: the containers are a corrugated skin plus a lining ~10 cm inside it, with nothing between.
  // At a plan cut each lining run is joined to the outer face, filled and closed with end lines at openings.
  const WALL_TOP = 0x6E6F6A, NEAR = .25;
  const FOOT = [[0, L, 0, 3 * Wd], [0, L, 0, 2 * Wd]];          // outer faces per level: x0, x1, z0, z1
  let wallFill = null;
  function liningRuns(runs, seg, lvl) {
    const f = FOOT[lvl] || FOOT[0];
    for (let i = 0; i < seg.length; i += 6) {
      const [x0, y, z0, x1, , z1] = seg.slice(i, i + 6);
      const alongX = Math.abs(z1 - z0) < .01, alongZ = Math.abs(x1 - x0) < .01;
      if (!alongX && !alongZ) continue;
      const w = alongX ? (z0 + z1) / 2 : (x0 + x1) / 2, lo = alongX ? f[2] : f[0], hi = alongX ? f[3] : f[1];
      const edge = w - lo < NEAR ? lo : hi - w < NEAR ? hi : null; if (edge === null) continue;
      const key = `${alongX ? 'x' : 'z'}|${edge}|${w.toFixed(2)}|${lvl}`;
      const r = runs.get(key) || { alongX, w, edge, y, lvl, iv: [] }; runs.set(key, r);
      r.iv.push(alongX ? [Math.min(x0, x1), Math.max(x0, x1)] : [Math.min(z0, z1), Math.max(z0, z1)]);
    }
  }
  function wallTops(runs, lineOut) {
    const tri = [];
    for (const r of runs.values()) {
      const f = FOOT[r.lvl] || FOOT[0], lo = r.alongX ? f[0] : f[2], hi = r.alongX ? f[1] : f[3];
      const iv = r.iv.sort((a, b) => a[0] - b[0]), merged = [];
      iv.forEach(([a, b]) => { const m = merged[merged.length - 1]; if (m && a - m[1] < .02) m[1] = Math.max(m[1], b); else merged.push([a, b]); });
      const P = (u, v) => r.alongX ? [u, r.y - .006, v] : [v, r.y - .006, u];        // u along the wall, v across it
      merged.forEach(([a, b]) => {
        const ca = a - lo < NEAR, cb = hi - b < NEAR; if (ca) a = lo; if (cb) b = hi;   // run into the corner
        if (b - a < .03) return;
        const p = [P(a, r.w), P(b, r.w), P(b, r.edge), P(a, r.edge)];
        tri.push(...p[0], ...p[1], ...p[2], ...p[0], ...p[2], ...p[3]);
        const L2 = (u, v0, v1) => { const s = P(u, v0), e = P(u, v1); s[1] = e[1] = r.y - .004; lineOut.push(...s, ...e); };
        if (!ca) L2(a, r.w, r.edge); if (!cb) L2(b, r.w, r.edge);                    // close the wall at openings
      });
    }
    if (!tri.length) return null;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(tri, 3));
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: WALL_TOP, side: THREE.DoubleSide }));
    m.renderOrder = 4; return m;
  }
  async function updateCuts() {
    const hOn = cur.cut < 39, sOn = cur.section > .001, xc = section.constant - root.position.x;
    const key = [hOn ? cur.cut.toFixed(3) : '-', sOn ? xc.toFixed(3) : '-', cur.explode.toFixed(3), cur.build.toFixed(3),
                 cur.m0, cur.m1, cur.m2, [...layerOff].sort().join()].join('|');
    if (key === cutKey) { if (cutLines) cutLines.visible = true; if (wallFill) wallFill.visible = true; return; }
    if (cutBusy) return; cutBusy = true; cutKey = key;
    if (cutLines) { root.remove(cutLines); cutLines.geometry.dispose(); cutLines = null; }
    if (wallFill) { root.remove(wallFill); wallFill.geometry.dispose(); wallFill = null; }
    if (hOn || sOn) {
      fat ||= await Promise.all([import('three/addons/lines/LineSegments2.js'), import('three/addons/lines/LineSegmentsGeometry.js'),
                                 import('three/addons/lines/LineMaterial.js')]);
      const out = [], M = new THREE.Matrix4(), runs = new Map();
      pieces.forEach(p => {
        if (p.vis < .5) return; p.obj.updateMatrix();
        p.obj.traverse(n => {
          if (!n.isMesh || !n.visible || n.userData.hull || n.userData.kind === 'glass' || !n.userData.kind) return;
          M.copy(p.obj.matrix).multiply(n.matrix);
          if (hOn) {
            const n0 = out.length; slice(out, n.geometry.attributes.position, M, 1, cur.cut, -.004);
            if (n.userData.kind === 'interior' && (p.step === 4 || p.step === 6)) liningRuns(runs, out.slice(n0), p.level);
          }
          if (sOn && p.shell) slice(out, n.geometry.attributes.position, M, 0, xc, -.004);
        });
      });
      if (runs.size && (wallFill = wallTops(runs, out))) { wallFill.material.clippingPlanes = [hcut]; root.add(wallFill); }
      if (out.length) {
        const g = new fat[1].LineSegmentsGeometry(); g.setPositions(out);
        const m = new fat[2].LineMaterial({ color: 0x131313, linewidth: 2.4 });
        m.resolution.set(canvas.clientWidth, canvas.clientHeight); m.clippingPlanes = hOn ? [hcut] : [];
        cutLines = new fat[0].LineSegments2(g, m); cutLines.renderOrder = 5; root.add(cutLines);
      }
    }
    cutBusy = false; dirty = true; kick();
  }

  /* ---------- loop: ease displayed state toward target ---------- */
  function step(dt) {
    const a = 1 - Math.exp(-DAMP * dt); let moving = false;
    for (const key in target) { const d = target[key] - cur[key];
      if (Math.abs(d) > 1e-4) { cur[key] += d * a; moving = true; } else cur[key] = target[key]; }
    return moving;
  }
  function frame(now) {
    raf = 0;
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (step(dt)) { dirty = true; if (cutLines) cutLines.visible = false; if (wallFill) wallFill.visible = false; }
    else if (model && pieces.length) updateCuts();
    if (hero) { spin.rotation.y += dt * .08; dirty = true; }
    if (dirty && visible) { apply(); renderer.render(scene, cam); dirty = false; raf = requestAnimationFrame(frame); }
  }
  function kick() { dirty = true; if (!raf && visible) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) kick(); });
  io.observe(canvas);

  function resize() {
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, innerWidth < 768 ? 1.5 : 2));
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    if (cutLines) cutLines.material.resolution.set(canvas.clientWidth, canvas.clientHeight);
    kick();
  }
  resize();
  const ro = new ResizeObserver(resize); ro.observe(canvas);
  if (model) (real ? loadModelReal : loadModel)(model).catch(e => console.warn('Web model unavailable, keeping the drawn massing.', e));

  const set = key => v => { if (target[key] !== v) { target[key] = v; kick(); } };
  return {
    setBuild: set('build'), setExtrude: set('extrude'), setView: set('view'),
    setExplode: set('explode'), setSection: set('section'),
    setLabels(on) { labels = on; kick(); },
    setInset(f) { if (f !== inset) { inset = f; kick(); } },         // fraction of width covered by a side panel; negative = left side
    snap() { Object.assign(cur, target); kick(); },
    setOrbit(az, el) { target.az = az; target.el = Math.max(.12, Math.min(1.45, el)); kick(); },   // radians; el clamped below vertical
    getOrbit() { return { az: target.az, el: target.el, zoom: target.zoom }; },
    setZoom(z) { target.zoom = Math.max(.6, Math.min(3.2, z)); kick(); },
    resetOrbit() { target.az = AZ0; target.el = EL0; target.zoom = 1; kick(); },
    setSheet(v) { target.sheet = v; kick(); },
    setLayer(kinds, on) { [].concat(kinds).forEach(k => on ? layerOff.delete(k) : layerOff.add(k)); applyLayers(); dirty = true; kick(); },
    // focus: {fx, fy, fz} camera target (m), zoom, levels shown [0|1, 0|1, 0|1], cut = plan-cut height above ground (m) or null
    setFocus(f) { Object.assign(target, FOCUS0, f.at ? { fx: f.at[0], fy: f.at[1], fz: f.at[2] } : {},
      f.levels ? { m0: f.levels[0], m1: f.levels[1], m2: f.levels[2] } : {}, { cut: f.cut ?? 40, zoom: f.zoom ?? 1 }); kick(); },
    resize,
    dispose() { io.disconnect(); ro.disconnect(); cancelAnimationFrame(raf); tex.forEach(t => t.dispose()); renderer.dispose(); labelHost && (labelHost.innerHTML = ''); },
  };
}
