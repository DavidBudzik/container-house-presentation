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
  scene.add(new THREE.HemisphereLight(0xffffff, 0xc9c2b6, real ? 1 : 1.55));      // real: enough fill that walls turned away from the sun stay light
  { const sun = new THREE.DirectionalLight(0xfff4e6, real ? 2 : 1.05); sun.position.set(.5, 1, .35); scene.add(sun); }
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

  // The viewer shows the house without plants: potted plants and pots, vase branches, ivy planters and their rails.
  const PLANT = /^(PLANT_BQ_|POT_BQ_|bq_Plant_|Vase_Branch|CP_Ivy_Planter_|CP_Lush_Ivy_|CP_\w*Ivy_Training_Rail)/i;
  const isPlant = n => { for (; n; n = n.parent) if (PLANT.test(n.name)) return true; return false; };
  // How a part meets the plan cut: 'w' wall build-up (its layers close into one band), 'g' glass, 'o' an object with its own outline.
  const capClass = (kind, name) => kind === 'glass' ? 'g'
    : kind === 'shell' || kind === 'accent' || (kind === 'interior' && !/leaf|door/i.test(name)) ? 'w' : 'o';
  const isGlass = (kind, m) => kind === 'glass' || ((m.transmission > 0 || /glass/i.test(m.name)) && !/_PV|Mirror|Screen|Diffuser/i.test(m.name));

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
      if (!n.isMesh || isPlant(n)) return;
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

  // Real look: the GLB carries the Blender materials as the flat colours Cycles measures (web-model/export_glb_viewer_v2.py). Same step/level/kind buckets as the
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
      if (!n.isMesh || isPlant(n)) return;
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
      const glassy = isGlass(kind, n.material), cap = glassy ? 'g' : capClass(kind, (a || n).name), mk = `${n.material.uuid}|${kind}|${cap}`;
      const e = b.get(mk) || { kind, cap, glassy, mat: n.material, geoms: [] }; b.set(mk, e); e.geoms.push(ng);
    });
    pieces.forEach(p => { root.remove(p.obj); p.el?.remove(); });
    pieces.length = 0;
    const byStep = new Map();
    for (const [key, mats] of buckets) {
      const [step, level, shell] = key.split('|').map(Number);
      const grp = new THREE.Group();
      for (const { kind, cap, glassy, mat, geoms } of mats.values()) {
        let m = mat.clone();
        // only 'uv' survives the merge above: textures the GLB maps to a second UV set (uv1) would not compile
        for (const t of Object.keys(m))
          if (m[t] && m[t].isTexture && m[t].channel) { m[t] = m[t].clone(); m[t].channel = 0; }
        if (glassy) m = new THREE.MeshStandardMaterial({ color: 0xBFD3DA, roughness: .05, metalness: .1, opacity: .28 });
        else if (m.roughness !== undefined) m.roughness = Math.max(m.roughness, .42);     // a diagram, not a showroom: no mirror finishes
        m.transparent = true; m.polygonOffset = true; m.polygonOffsetFactor = 1; m.polygonOffsetUnits = 1;
        if (m.opacity === 1 && m.transmission > 0) m.transmission = 0;
        const mesh = new THREE.Mesh(mergeGeometries(geoms), m); mesh.userData.kind = kind; mesh.userData.cap = cap; grp.add(mesh);
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

  /* ---------- cut caps: a closed top with a black edge wherever the plan cut slices the model ---------- */
  // The cut is rasterised at 1 cm into two masks: walls (container skin, cladding and lining, with the cavities between
  // those layers closed up) and single objects (cabinets, door leaves, curtains); glass goes in as a band. Each mask
  // becomes a distance field, and one plane at the cut height draws fill and outline from that texture. Nothing
  // changes while the view orbits: the cap is rebuilt only when the cut itself changes (height, levels, layers, build),
  // and for the state the viewer is easing towards, so it is ready by the time the cut arrives.
  const CAP = { px: .01, close: 6, join: 1, glass: .016, line: .024, minPx: 2.3, range: .08,      // close / join: gaps closed, in pixels each way
                fill: 0xF3F1EC, glassCol: 0xC6D8DE, ink: 0x131313 };                              // metres; colours of the cut face
  const CUT_TOL = { cut: .01, section: .01, explode: .004, build: .01, extrude: .01, m0: .04, m1: .04, m2: .04 };   // how near the eased state must be for the cap to show
  let cap = null, cutLines = null, cutKey = '', fat = null, cutBusy = false;
  const tick = () => new Promise(r => setTimeout(r));
  const q9 = new Float64Array(9), h4 = [0, 0, 0, 0];
  function sliceY(out, pos, M, y) {                 // triangle soup against the plane y: pushes x0, z0, x1, z1 per crossing
    const e = M.elements, n = pos.count, A = pos.array, direct = !pos.isInterleavedBufferAttribute && !pos.normalized && pos.itemSize === 3;
    for (let i = 0; i < n; i += 3) {
      for (let k = 0; k < 3; k++) {
        const j = (i + k) * 3, x = direct ? A[j] : pos.getX(i + k), v = direct ? A[j + 1] : pos.getY(i + k), z = direct ? A[j + 2] : pos.getZ(i + k), o = k * 3;
        q9[o] = e[0] * x + e[4] * v + e[8] * z + e[12]; q9[o + 1] = e[1] * x + e[5] * v + e[9] * z + e[13] - y; q9[o + 2] = e[2] * x + e[6] * v + e[10] * z + e[14];
      }
      if ((q9[1] < 0) === (q9[4] < 0) && (q9[4] < 0) === (q9[7] < 0)) continue;
      let m = 0;
      for (let k = 0; k < 3; k++) {
        const a = k * 3, b = (k + 1) % 3 * 3, d0 = q9[a + 1], d1 = q9[b + 1];
        if ((d0 < 0) === (d1 < 0)) continue;
        const t = d0 / (d0 - d1); h4[m++] = q9[a] + (q9[b] - q9[a]) * t; h4[m++] = q9[a + 2] + (q9[b + 2] - q9[a + 2]) * t;
      }
      if (m === 4) out.push(h4[0], h4[1], h4[2], h4[3]);
    }
  }
  function chain(segs, tol = .002) {               // join segments end to end: closed loops and open runs, each [x, z, x, z, ...]
    const cell = v => Math.floor(v / tol), key = (ix, iz) => (ix + 32768) * 65536 + (iz + 32768);
    const ends = new Map(), n = segs.length / 4, used = new Uint8Array(n), t2 = tol * tol;
    const put = (x, z, i) => { const k = key(cell(x), cell(z)), l = ends.get(k); if (l) l.push(i); else ends.set(k, [i]); };
    for (let i = 0; i < n; i++) { put(segs[i * 4], segs[i * 4 + 1], i); put(segs[i * 4 + 2], segs[i * 4 + 3], i); }
    const d2 = (o, x, z) => (segs[o] - x) ** 2 + (segs[o + 1] - z) ** 2;
    const next = (x, z) => {                       // an unused segment with an end within tol of (x, z), or -1
      const cx = cell(x), cz = cell(z); let best = -1, bd = t2;
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        const l = ends.get(key(cx + dx, cz + dz)); if (!l) continue;
        for (const i of l) { if (used[i]) continue; const d = Math.min(d2(i * 4, x, z), d2(i * 4 + 2, x, z)); if (d <= bd) { bd = d; best = i; } }
      }
      return best;
    };
    const closed = [], open = [];
    for (let i = 0; i < n; i++) {
      if (used[i]) continue; used[i] = 1;
      let pts = [segs[i * 4], segs[i * 4 + 1], segs[i * 4 + 2], segs[i * 4 + 3]], loop = false;
      for (let pass = 0; pass < 2 && !loop; pass++) {
        for (;;) {
          const x = pts[pts.length - 2], z = pts[pts.length - 1], j = next(x, z);
          if (j < 0) break;
          used[j] = 1; const o = j * 4, first = d2(o, x, z) <= d2(o + 2, x, z);
          pts.push(first ? segs[o + 2] : segs[o], first ? segs[o + 3] : segs[o + 1]);
          if (pts.length > 6 && (pts[pts.length - 2] - pts[0]) ** 2 + (pts[pts.length - 1] - pts[1]) ** 2 <= t2) { loop = true; break; }
        }
        if (!loop) { const r = []; for (let k = pts.length - 2; k >= 0; k -= 2) r.push(pts[k], pts[k + 1]); pts = r; }   // then grow the other end
      }
      (loop ? closed : open).push(pts);
    }
    return { closed, open };
  }
  function nestGroups(loops) {                     // even-odd by nesting: every solid loop with the holes directly inside it
    const L = loops.map(p => {
      let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, a = 0;
      for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
        a += p[j] * p[i + 1] - p[i] * p[j + 1];
        if (p[i] < x0) x0 = p[i]; if (p[i] > x1) x1 = p[i]; if (p[i + 1] < z0) z0 = p[i + 1]; if (p[i + 1] > z1) z1 = p[i + 1];
      }
      return { p, x0, x1, z0, z1, area: Math.abs(a) / 2, depth: 0, holes: [] };
    }).sort((a, b) => b.area - a.area);
    const inside = (x, z, p) => { let c = false;
      for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2)
        if ((p[i + 1] > z) !== (p[j + 1] > z) && x < (p[j] - p[i]) * (z - p[i + 1]) / (p[j + 1] - p[i + 1]) + p[i]) c = !c;
      return c; };
    for (let i = 1; i < L.length; i++) {
      const c = L[i], x = c.p[0], z = c.p[1];
      for (let j = i - 1; j >= 0; j--) {             // larger loops only, the smallest of them first
        const o = L[j];
        if (x < o.x0 || x > o.x1 || z < o.z0 || z > o.z1 || !inside(x, z, o.p)) continue;
        c.depth = o.depth + 1; if (c.depth % 2) o.holes.push(c.p); break;
      }
    }
    return L.filter(l => l.depth % 2 === 0).map(l => [l.p, ...l.holes]);
  }
  function edt(mask, w, h) {                       // exact distance (px) from each pixel to the nearest pixel outside the mask
    const INF = 1e12, n = Math.max(w, h), f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
    const out = new Float32Array(w * h);
    const line = len => {                          // 1D squared-distance transform (lower envelope of parabolas)
      let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
      for (let q = 1; q < len; q++) {
        let s;
        for (;;) { const p = v[k]; s = ((f[q] + q * q) - (f[p] + p * p)) / (2 * q - 2 * p); if (s <= z[k] && k > 0) k--; else break; }
        k++; v[k] = q; z[k] = s; z[k + 1] = INF;
      }
      k = 0;
      for (let q = 0; q < len; q++) { while (z[k + 1] < q) k++; const p = v[k]; d[q] = (q - p) * (q - p) + f[p]; }
    };
    for (let i = 0; i < w * h; i++) out[i] = mask[i] ? INF : 0;
    for (let x = 0; x < w; x++) { for (let y = 0; y < h; y++) f[y] = out[y * w + x]; line(h); for (let y = 0; y < h; y++) out[y * w + x] = d[y]; }
    for (let y = 0; y < h; y++) { const o = y * w; for (let x = 0; x < w; x++) f[x] = out[o + x]; line(w); for (let x = 0; x < w; x++) out[o + x] = Math.sqrt(d[x]); }
    return out;
  }
  function boxMorph(m, w, h, r, grow) {            // square (2r + 1) dilation or erosion of a 0/1 mask, in place: corners stay sharp
    const t = new Uint8Array(m.length), need = grow ? 1 : 2 * r + 1;
    for (let y = 0; y < h; y++) {
      const o = y * w; let c = 0;
      for (let x = 0; x < Math.min(r, w); x++) c += m[o + x];
      for (let x = 0; x < w; x++) { if (x + r < w) c += m[o + x + r]; if (x - r - 1 >= 0) c -= m[o + x - r - 1]; t[o + x] = c >= need ? 1 : 0; }
    }
    for (let x = 0; x < w; x++) {
      let c = 0;
      for (let y = 0; y < Math.min(r, h); y++) c += t[y * w + x];
      for (let y = 0; y < h; y++) { if (y + r < h) c += t[(y + r) * w + x]; if (y - r - 1 >= 0) c -= t[(y - r - 1) * w + x]; m[y * w + x] = c >= need ? 1 : 0; }
    }
  }
  function capMaterial(tex) {
    return new THREE.ShaderMaterial({
      transparent: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1, extensions: { derivatives: true },
      uniforms: { map: { value: tex }, fill: { value: new THREE.Color(CAP.fill) }, glass: { value: new THREE.Color(CAP.glassCol) }, ink: { value: new THREE.Color(CAP.ink) },
                  range: { value: CAP.range }, line: { value: CAP.line }, minPx: { value: CAP.minPx }, opacity: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: `uniform sampler2D map; uniform vec3 fill, glass, ink; uniform float range, line, minPx, opacity; varying vec2 vUv;
        void main() {
          vec4 t = texture2D(map, vUv);
          float w = (t.r * 2. - 1.) * range, o = (t.g * 2. - 1.) * range;        // metres inside the wall band / inside an object
          float aw = max(fwidth(w), 1e-5), ao = max(fwidth(o), 1e-5);
          float cw = clamp(w / aw + .5, 0., 1.), co = clamp(o / ao + .5, 0., 1.);   // coverage
          float lw = max(line, minPx * aw), lo = max(line, minPx * ao);            // the black edge: 24 mm wide, never thinner than about two screen pixels
          float ew = 1. - clamp((w - lw) / aw + .5, 0., 1.), eo = 1. - clamp((o - lo) / ao + .5, 0., 1.);
          float solid = max(cw, co), dark = max(eo * co, ew * cw * (1. - co));     // an object keeps its own outline against a wall
          vec3 col = mix(fill, ink, dark);
          float g = t.b, rim = clamp(1. - abs(g * 2. - 1.), 0., 1.);               // glass: a pale band with a darker rim
          vec3 c = mix(mix(glass, ink, rim * .8), col, solid);
          float a = max(solid, smoothstep(.04, .35, g));
          if (a < .01) discard;
          gl_FragColor = vec4(c, a * opacity);
          #include <colorspace_fragment>
        }` });
  }
  async function buildCap(S, y) {                   // S: cut segments per class (walls, objects, glass)
    let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
    for (const a of [S.w, S.o, S.g]) for (let i = 0; i < a.length; i += 2) {
      const x = a[i], z = a[i + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; }
    if (x1 < x0) return null;
    const pad = (CAP.close + 6) * CAP.px; x0 -= pad; z0 -= pad; x1 += pad; z1 += pad;
    let px = CAP.px; while ((x1 - x0) / px > 2400 || (z1 - z0) / px > 2400) px *= 1.25;
    const w = Math.ceil((x1 - x0) / px), h = Math.ceil((z1 - z0) / px), n = w * h;
    const paint = (segs, half, solids) => {         // white on black: every cut line `half` thick each way, closed loops filled
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
      g.setTransform(1 / px, 0, 0, 1 / px, -x0 / px, -z0 / px);
      g.fillStyle = g.strokeStyle = '#fff'; g.lineCap = g.lineJoin = 'round'; g.lineWidth = half * 2;
      const { closed, open } = chain(segs), trace = (p, l, shut) => { p.moveTo(l[0], l[1]); for (let i = 2; i < l.length; i += 2) p.lineTo(l[i], l[i + 1]); if (shut) p.closePath(); };
      if (solids) for (const grp of nestGroups(closed)) { const p = new Path2D(); grp.forEach(l => trace(p, l, true)); g.fill(p, 'evenodd'); }
      const p = new Path2D(); closed.forEach(l => trace(p, l, true)); open.forEach(l => trace(p, l, false)); g.stroke(p);
      return g.getImageData(0, 0, w, h).data;
    };
    const data = new Uint8Array(n * 4), mask = new Uint8Array(n);
    const field = (segs, r, ch) => {                // distance inside the closed mask into channel ch; an empty class stays 0 = far outside
      if (!segs.length) return;
      const img = paint(segs, px, true);
      for (let i = 0; i < n; i++) mask[i] = img[i * 4] > 127 ? 1 : 0;
      boxMorph(mask, w, h, r, true); boxMorph(mask, w, h, r, false);      // closing: gaps up to 2r pixels wide fill in
      const d = edt(mask, w, h);
      for (let i = 0; i < n; i++) { const sd = (d[i] - .5) * px; data[i * 4 + ch] = sd <= -CAP.range ? 0 : sd >= CAP.range ? 255 : Math.round(127.5 + sd / CAP.range * 127.5); }
    };
    field(S.w, CAP.close, 0); await tick();
    field(S.o, CAP.join, 1); await tick();
    const gl = S.g.length ? paint(S.g, CAP.glass, false) : null;
    for (let i = 0; i < n; i++) { data[i * 4 + 2] = gl ? gl[i * 4] : 0; data[i * 4 + 3] = 255; }
    const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
    tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true; tex.needsUpdate = true;
    const g = new THREE.BufferGeometry(), X1 = x0 + w * px, Z1 = z0 + h * px;
    g.setAttribute('position', new THREE.Float32BufferAttribute([x0, y, z0, X1, y, z0, X1, y, Z1, x0, y, Z1], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2)); g.setIndex([0, 2, 1, 0, 3, 2]);
    const m = new THREE.Mesh(g, capMaterial(tex)); m.renderOrder = 4; m.frustumCulled = false;
    return m;
  }
  // The vertical section (setSection) keeps plain outlines along the shell.
  const ta = new THREE.Vector3(), tb = new THREE.Vector3(), tc = new THREE.Vector3(), tri = [ta, tb, tc], dv = [0, 0, 0];
  function sliceX(out, pos, M, c, off) {
    for (let i = 0; i < pos.count; i += 3) {
      for (let k = 0; k < 3; k++) { tri[k].fromBufferAttribute(pos, i + k).applyMatrix4(M); dv[k] = tri[k].x - c; }
      let n = 0; const h = [];
      for (const [i0, i1] of [[0, 1], [1, 2], [2, 0]]) {
        if ((dv[i0] < 0) === (dv[i1] < 0)) continue;
        const t = dv[i0] / (dv[i0] - dv[i1]), p0 = tri[i0], p1 = tri[i1];
        h.push(p0.x + (p1.x - p0.x) * t, p0.y + (p1.y - p0.y) * t, p0.z + (p1.z - p0.z) * t); n++;
      }
      if (n === 2) { h[0] += off; h[3] += off; out.push(...h); }
    }
  }
  // The cut the viewer is heading for: one key per distinct result, 'off' while nothing is cut.
  const cutKeyOf = s => s.cut < 39 || s.section > .001
    ? [s.cut.toFixed(3), s.section.toFixed(3), s.explode.toFixed(3), s.build.toFixed(3), s.extrude.toFixed(3), s.m0, s.m1, s.m2, [...layerOff].sort().join()].join('|') : 'off';
  function showCuts() {                             // every frame: on only when the cap belongs to where the model now stands
    let on = !cutBusy && cutKey === cutKeyOf(target);
    if (on) for (const k in CUT_TOL) if (Math.abs(target[k] - cur[k]) > CUT_TOL[k]) { on = false; break; }
    if (cap) cap.visible = on; if (cutLines) cutLines.visible = on;
    return on;
  }
  async function updateCuts() {
    const key = cutKeyOf(target);
    if (key === cutKey || cutBusy) return;
    cutBusy = true; cutKey = key;
    if (cap) { root.remove(cap); cap.geometry.dispose(); cap.material.uniforms.map.value.dispose(); cap.material.dispose(); cap = null; }
    if (cutLines) { root.remove(cutLines); cutLines.geometry.dispose(); cutLines.material.dispose(); cutLines = null; }
    const hOn = target.cut < 39, sOn = target.section > .001, y = target.cut;
    if (hOn || sOn) {
      const S = { w: [], o: [], g: [] }, out = [], M = new THREE.Matrix4(), live = { ...cur };
      Object.assign(cur, target); apply();          // slice the model as it will stand at the end of the move, not as it is mid-way
      const xc = section.constant - root.position.x;
      pieces.forEach(p => {
        if (p.vis < .5) return; p.obj.updateMatrix();
        p.obj.traverse(n => {
          const k = n.userData.kind;
          if (!n.isMesh || !n.visible || n.userData.hull || !k) return;
          M.copy(p.obj.matrix).multiply(n.matrix);
          if (hOn) sliceY(S[n.userData.cap || capClass(k, '')], n.geometry.attributes.position, M, y);
          if (sOn && p.shell && k !== 'glass') sliceX(out, n.geometry.attributes.position, M, xc, -.004);
        });
      });
      Object.assign(cur, live); apply();
      if (hOn) { await tick(); cap = await buildCap(S, y - .0015); if (cap) { cap.visible = false; root.add(cap); } }
      if (out.length) {
        fat ||= await Promise.all([import('three/addons/lines/LineSegments2.js'), import('three/addons/lines/LineSegmentsGeometry.js'),
                                   import('three/addons/lines/LineMaterial.js')]);
        const g = new fat[1].LineSegmentsGeometry(); g.setPositions(out);
        const m = new fat[2].LineMaterial({ color: 0x131313, linewidth: 2.4 });
        m.resolution.set(canvas.clientWidth, canvas.clientHeight); m.clippingPlanes = hOn ? [hcut] : [];
        cutLines = new fat[0].LineSegments2(g, m); cutLines.renderOrder = 5; cutLines.visible = false; root.add(cutLines);
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
    if (step(dt)) dirty = true;
    if (model && pieces.length) {                       // the cut follows its own state only: orbit and zoom leave it alone
      updateCuts();
      const u = showCuts() && cap && cap.material.uniforms.opacity;
      if (u && u.value < 1) { u.value = Math.min(1, u.value + dt * 6); dirty = true; }
    }
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
