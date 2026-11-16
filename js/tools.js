// Sales tools (#tools): a tablet and a phone that both run the live 3D model of the house.
// One WebGL renderer draws both screens. Each frame it renders the tablet view and the phone view into two regions of
// one offscreen canvas and copies each region into that screen's own 2D canvas, so the model is downloaded, parsed and
// kept on the GPU once. Each screen has its own camera (drag it; it idles on a slow turntable). What the presenter
// changes on the tablet (finish, floors apart) is shared, so the buyer's phone follows it. The sun's shadow map is
// drawn only when the geometry moves (floors apart), never just because a camera turns.
import * as THREE from 'three';

const MODEL = 'assets/models/house-redesigned-v2.glb?v=1';   // same URL as main.js, so the browser reuses that download
const DRACO = 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/gltf/';
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const DEBUG = /[?&]toolsdebug/.test(location.search);

// Finish palettes: the four illustrative palettes of #finishes (drawings/compose_finishes.py: walls, roof edge, pergola
// fins, deck), put on the model's own parts. A part a palette leaves out keeps the colour the model was exported with
// ("as designed" leaves them all out).
const FINISHES = [
  {},
  { wall: '#4b504f', fascia: '#3f4443', fins: '#cfae78', deck: '#c8a97a', oak: '#cfae78' },   // charcoal & larch
  { wall: '#8d927b', fascia: '#80856f', fins: '#b58d58', deck: '#c0a074' },                  // olive & oak
  { wall: '#c98f6c', fascia: '#b98361', fins: '#7b5b3e', deck: '#a98663', oak: '#7b5b3e' },   // terracotta & walnut
  { wall: '#d8c7a4', fascia: '#cbb994', fins: '#2f3231', deck: '#b99b6d' },                  // sand & black steel
];
// Which parts a palette repaints, by the Blender object name the GLB keeps on each node.
const ROLES = [
  ['wall', /^(V18_Exterior_Continuous_White|D02_Overclad)/, /Warm_White_Walls/],
  ['wall', /_Steel(Header|Jamb)$/, /Continuous_White/],          // the white steel surrounds of the openings
  ['fascia', /^V19_White_Roof_Fascia/],
  ['fins', /^RF_Pergola_(South|East)_Fin/],
  ['deck', /^(INST_(Entry_)?Deck_Plank|PG_Deck_Timber|DJ1_\w+Edge_|V2_Entry_Deck)/],
  ['oak', /^V18_Exterior_Oak_Accent/],
];
const roleOf = (name, mat) => { for (const [r, n, m] of ROLES) if (n.test(name) && (!m || m.test(mat))) return r; return ''; };
const PLANT = /^(PLANT_BQ_|POT_BQ_|bq_Plant_|Vase_Branch|CP_Ivy_Planter_|CP_Lush_Ivy_|CP_\w*Ivy_Training_Rail)/i;   // as the #explore viewer: no plants
const isPlant = n => { for (; n; n = n.parent) if (PLANT.test(n.name)) return true; return false; };
// Floors apart: the upper floor and the roof rise (m), and each floor is cut below its ceiling so its rooms show from
// above. Heights are the model's own (m above its zero): upper floor from 3.3, roof from 6.15. Some upper furniture is
// tagged as ground level in the GLB, so a part's level is also taken from where it really starts.
const LIFT = [0, 3.1, 5.7];
const UPPER_Y = 3.3, ROOF_Y = 6.15, CUT = [2.9, 5.8];
const UNCUT = /^(RF_Pergola|RF_Fin|RF_Base|RF_Post|CP_|DJ1_|PG_|V2_Entry|E1_TerraceShade)/;   // pergola, deck and terrace shade stay whole
const isGlass = (kind, m) => kind === 'glass' || ((m.transmission > 0 || /glass/i.test(m.name)) && !/_PV|Mirror|Screen|Diffuser/i.test(m.name));

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export function initTools() {
  const stage = document.getElementById('toolsStage');
  if (!stage) return;
  const section = stage.closest('section');
  const screens = [...stage.querySelectorAll('.scr[data-view]')];
  const state = { finish: 0, floors: 0, floorsAt: 0, floorsFrom: 0, floorsT: 1, colorT: 1 };
  let ctx3d = null;                                   // set once the model is in

  /* ---------- controls: tablet dock, phone sheet and the narrow-screen row share one state ---------- */
  const names = [...section.querySelectorAll('.tl-names li')];
  const finBtns = [...section.querySelectorAll('[data-fin]')];
  const viewBtns = [...section.querySelectorAll('[data-floors]')];
  const sendBtns = [...section.querySelectorAll('[data-send]')];
  const nameOuts = [...section.querySelectorAll('.tl-fin-name')];
  const note = section.querySelector('.ph-note');
  function showName() { nameOuts.forEach(o => o.textContent = names[state.finish]?.textContent || ''); }
  function setFinish(i) {
    if (i === state.finish) return;
    state.finish = i;
    finBtns.forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.fin === i)));
    showName();
    ctx3d?.paint(i);
  }
  function setFloors(on) {
    on = on ? 1 : 0;
    viewBtns.forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.floors === on)));
    if (on === state.floors) return;
    state.floors = on; state.floorsFrom = state.floorsAt; state.floorsT = 0;
    ctx3d?.kick();
  }
  let noteTimer = 0, sentTimer = 0;
  function send() {
    sendBtns.forEach(b => b.classList.add('sent'));
    clearTimeout(sentTimer); sentTimer = setTimeout(() => sendBtns.forEach(b => b.classList.remove('sent')), 2400);
    if (note) {
      note.classList.remove('show'); void note.offsetWidth; note.classList.add('show');
      clearTimeout(noteTimer); noteTimer = setTimeout(() => note.classList.remove('show'), 4200);
    }
    ctx3d?.follow();                                   // the phone turns to the angle the tablet shows
  }
  finBtns.forEach(b => b.addEventListener('click', () => setFinish(+b.dataset.fin)));
  viewBtns.forEach(b => b.addEventListener('click', () => setFloors(+b.dataset.floors)));
  sendBtns.forEach(b => b.addEventListener('click', send));
  showName();
  new MutationObserver(showName).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

  /* ---------- the devices rise into place, then the callouts; the link arrives once, the first time they are seen ---------- */
  const notes = callouts(stage);
  if ('IntersectionObserver' in window && !DEBUG) {
    if (!reduce) stage.classList.add('pre', 'npre');
    const io = new IntersectionObserver(es => {
      if (!es[0].isIntersecting) return;
      io.disconnect(); stage.classList.add('in');
      setTimeout(notes.show, reduce ? 0 : 1400);       // the phone settles last: 0.14 s late, 1.2 s long
      if (note && !reduce) setTimeout(() => { if (!note.classList.contains('show')) { note.classList.add('show'); noteTimer = setTimeout(() => note.classList.remove('show'), 4200); } }, 1600);
    }, { threshold: .35 });
    io.observe(stage);
  } else { stage.classList.add('in'); notes.show(); }   // (and when testing in a hidden pane, where observers never fire)

  /* ---------- 3D: start loading about a screen and a half before the devices arrive ---------- */
  if (!webglOK()) { stage.classList.add('no-3d'); return; }
  const go = () => start(stage, screens, state).then(c => { ctx3d = c; if (state.finish) c.paint(state.finish, true); })
    .catch(e => { console.warn('Sales-tools 3D unavailable, keeping the stills.', e); stage.classList.add('no-3d'); });
  if (DEBUG) { go(); return; }
  const warm = new IntersectionObserver(es => { if (es[0].isIntersecting) { warm.disconnect(); go(); } }, { rootMargin: '150% 0px' });
  warm.observe(stage);
}

function webglOK() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); }
  catch (e) { return false; }
}

/* ---------- callouts: each card's arrow, drawn to its live target in the artboard ---------- */
// Leaders are straight orthogonal runs only (2026-11-15, user: "only straight orthogonal lines"): one straight line
// when card and target share a band of x or y, otherwise one right-angle elbow that leaves the card from the side
// facing the target and turns once into it.
// to = the target; at = a point inside it (fractions of its box), else the line ends on the target's facing edge;
// first = optional [en, he] axis the line leaves the card on ('h' or 'v'), to override the automatic choice.
const ARROWS = {
  flow:   [{ to: '.tablet .ap-send' }, { to: '.phone .scr', at: [.5, 0] }],
  drag:   [{ to: '.tablet .scr', at: [.42, .5] }],
  floors: [{ to: '.tablet [data-floors="1"]' }],
  finish: [{ to: '.tablet .ap-dock .sw' }],
};
// Orthogonal route from card box c to target box t (or point P inside it): polyline points from the card edge to the
// target, 2 points when straight, 3 with an elbow.
function route(c, t, P, first) {
  const g = 8;                                                     // stay this far inside an edge where the line can slide
  const overlap = (a0, a1, b0, b1) => (Math.max(a0, b0) < Math.min(a1, b1) ? [Math.max(a0, b0), Math.min(a1, b1)] : null);
  const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
  const tx = P ? P[0] : t.x + t.w / 2, ty = P ? P[1] : t.y + t.h / 2;
  const below = ty > cy, right = tx > cx;
  const spanX = P ? (tx > c.x + g && tx < c.x + c.w - g ? [tx, tx] : null) : overlap(c.x + g, c.x + c.w - g, t.x + g, t.x + t.w - g);
  const spanY = P ? (ty > c.y + g && ty < c.y + c.h - g ? [ty, ty] : null) : overlap(c.y + g, c.y + c.h - g, t.y + g, t.y + t.h - g);
  const endY = P ? ty : below ? t.y : t.y + t.h, endX = P ? tx : right ? t.x : t.x + t.w;
  if (spanX && first !== 'h') { const x = (spanX[0] + spanX[1]) / 2; return [[x, below ? c.y + c.h : c.y], [x, endY]]; }
  if (spanY && first !== 'v') { const y = (spanY[0] + spanY[1]) / 2; return [[right ? c.x + c.w : c.x, y], [endX, y]]; }
  const h = first ? first === 'h' : Math.abs(tx - cx) - c.w / 2 > Math.abs(ty - cy) - c.h / 2;
  return h ? [[right ? c.x + c.w : c.x, cy], [tx, cy], [tx, endY]]    // out of the side, then up / down into the target
           : [[cx, below ? c.y + c.h : c.y], [cx, ty], [endX, ty]];   // out of the top / bottom, then across into it
}
function callouts(stage) {
  const wrap = stage.querySelector('.tl-notes');
  if (!wrap) return { show() {} };
  const set = stage.querySelector('.tl-set'), svg = wrap.querySelector('.tl-arrows');
  const cards = [...wrap.querySelectorAll('.tl-note[data-note]')];
  const f1 = v => v.toFixed(1);
  let timer = 0;
  function draw() {
    timer = 0;
    if (!wrap.offsetWidth) return;                                   // hidden on narrow screens
    const o = set.getBoundingClientRect(), W = set.offsetWidth, H = set.offsetHeight, s = W / (o.width || W);
    const box = el => { const r = el.getBoundingClientRect(); return { x: (r.left - o.left) * s, y: (r.top - o.top) * s, w: r.width * s, h: r.height * s }; };
    const rtl = document.documentElement.dir === 'rtl';
    const unit = (p, q) => { const dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; };
    let out = '';
    cards.forEach((card, ci) => {
      const c = box(card);
      (ARROWS[card.dataset.note] || []).forEach((a, ai) => {
        const el = set.querySelector(a.to); if (!el || !el.offsetWidth) return;
        const t = box(el);
        const P = a.at ? [t.x + a.at[0] * t.w, t.y + a.at[1] * t.h] : null;
        const pts = route(c, t, P, a.first && a.first[rtl ? 1 : 0]);
        const n = pts.length, u0 = unit(pts[0], pts[1]), u = unit(pts[n - 2], pts[n - 1]);   // first and last leg
        const lastLen = Math.hypot(pts[n - 1][0] - pts[n - 2][0], pts[n - 1][1] - pts[n - 2][1]);
        if (lastLen < 14) return;
        pts[0] = [pts[0][0] + u0[0] * 3, pts[0][1] + u0[1] * 3];             // just off the card
        pts[n - 1] = [pts[n - 1][0] - u[0] * 7, pts[n - 1][1] - u[1] * 7];   // tip short of the target
        const e0 = pts[n - 1], s0 = pts[0];
        const hs = clamp(lastLen * .09, 6, 9), ca = Math.cos(.47), sa = Math.sin(.47);   // open head along the last leg
        const h1 = [e0[0] - hs * (u[0] * ca - u[1] * sa), e0[1] - hs * (u[1] * ca + u[0] * sa)];
        const h2 = [e0[0] - hs * (u[0] * ca + u[1] * sa), e0[1] - hs * (u[1] * ca - u[0] * sa)];
        const d = .5 + ci * .12 + ai * .18;
        out += `<path class="ln" pathLength="1" style="transition-delay:${d.toFixed(2)}s" d="M${pts.map(p => `${f1(p[0])} ${f1(p[1])}`).join('L')}"/>`
          + `<path class="hd" style="transition-delay:${(d + .6).toFixed(2)}s" d="M${f1(h1[0])} ${f1(h1[1])}L${f1(e0[0])} ${f1(e0[1])}L${f1(h2[0])} ${f1(h2[1])}"/>`
          + `<circle class="dt" style="transition-delay:${d.toFixed(2)}s" cx="${f1(s0[0])}" cy="${f1(s0[1])}" r="2.4"/>`;
      });
    });
    svg.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`);
    svg.innerHTML = out;
  }
  const later = () => { if (!timer) timer = setTimeout(draw, 40); };   // a timer, not a frame: it also runs in a hidden tab
  new ResizeObserver(later).observe(stage);
  new MutationObserver(later).observe(document.documentElement, { attributes: true, attributeFilter: ['lang', 'dir'] });
  document.fonts?.ready.then(later);
  stage.querySelectorAll('.dev').forEach(d => d.addEventListener('transitionend', later));
  // first draw with the arrows still hidden, then lift .npre so the cards rise and the lines draw themselves
  return { show() { draw(); setTimeout(() => stage.classList.remove('npre'), 40); } };
}

async function start(stage, screens, state) {
  const [{ GLTFLoader }, { DRACOLoader }, { mergeGeometries }, { RoomEnvironment }] = await Promise.all([
    import('three/addons/loaders/GLTFLoader.js'), import('three/addons/loaders/DRACOLoader.js'),
    import('three/addons/utils/BufferGeometryUtils.js'), import('three/addons/environments/RoomEnvironment.js')]);

  /* ---------- renderer: offscreen, both screens are copied out of it ---------- */
  const gl = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), .04).texture; pm.dispose(); }
  scene.add(new THREE.HemisphereLight(0xffffff, 0xcdc6ba, .55));
  const sun = new THREE.DirectionalLight(0xfff1de, 2.4);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -.0004; sun.shadow.normalBias = .035;
  scene.add(sun, sun.target);

  /* ---------- the model: merged per level, part and material, so draw calls stay low ---------- */
  const loader = new GLTFLoader(), draco = new DRACOLoader().setDecoderPath(DRACO);
  loader.setDRACOLoader(draco);
  const t0 = performance.now();
  const gltf = await loader.loadAsync(MODEL);
  draco.dispose();
  const t1 = performance.now();
  gltf.scene.updateMatrixWorld(true);
  // the build runs in slices of about 10 ms, so it never stalls the page's own scrolling
  let slice = performance.now();
  const breathe = async () => { if (performance.now() - slice > 10) { await new Promise(r => setTimeout(r, 0)); slice = performance.now(); } };
  const buckets = new Map(), nodes = [];
  gltf.scene.traverse(n => { if (n.isMesh) nodes.push(n); });
  for (const n of nodes) {
    await breathe();
    if (isPlant(n)) continue;
    let a = n; while (a && a.userData.web_step === undefined) a = a.parent;
    const x = a ? a.userData : {}, level = x.web_level ?? 0, name = (a || n).name;
    const kind = /Louver|Shade|Pergola|Timber/i.test(name) && x.web_kind !== 'steel' ? 'timber' : (x.web_kind || 'interior');
    const glass = isGlass(kind, n.material), role = glass ? '' : roleOf(name, n.material.name);
    const g = n.geometry.clone(); g.applyMatrix4(n.matrixWorld);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.index) { const c = g.attributes.position.count, ix = new (c > 65535 ? Uint32Array : Uint16Array)(c); for (let i = 0; i < c; i++) ix[i] = i; g.setIndex(new THREE.BufferAttribute(ix, 1)); }
    g.computeBoundingBox();
    const y0 = g.boundingBox.min.y, lv = Math.max(Math.min(2, level), y0 >= ROOF_Y ? 2 : y0 >= UPPER_Y ? 1 : 0);
    const cut = lv < 2 && !UNCUT.test(name);
    const key = `${lv}|${role}|${cut ? 1 : 0}|${glass ? 'glass' : n.material.uuid}`;
    const b = buckets.get(key) || { level: lv, role, glass, cut, kind, mat: n.material, geoms: [] }; buckets.set(key, b); b.geoms.push(g);
  }
  const house = new THREE.Group(), levels = [0, 1, 2].map(() => new THREE.Group());
  levels.forEach(l => house.add(l));
  const paintable = [];
  const cuts = [new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e4), new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e4)];   // keep y <= constant
  renderer.localClippingEnabled = true;
  for (const { level, role, glass, cut, mat, geoms } of buckets.values()) {
    await breathe();
    let m;
    if (glass) m = new THREE.MeshStandardMaterial({ color: 0xBFD3DA, roughness: .05, metalness: .1, transparent: true, opacity: .26, depthWrite: false });
    else {
      m = mat.clone();
      for (const t of Object.keys(m)) if (m[t] && m[t].isTexture && m[t].channel) { m[t] = m[t].clone(); m[t].channel = 0; }
      if (m.roughness !== undefined) m.roughness = Math.max(m.roughness, .42);
      if (m.transmission > 0 && m.opacity === 1) m.transmission = 0;
    }
    if (cut) m.clippingPlanes = [cuts[level]];
    const mesh = new THREE.Mesh(mergeGeometries(geoms, false), m);
    mesh.castShadow = !glass; mesh.receiveShadow = !glass;
    levels[level].add(mesh);
    if (role) { m.userData.base = m.color.clone(); m.userData.from = m.color.clone(); m.userData.to = m.color.clone(); paintable.push({ role, m }); }
  }
  geomsDone(buckets);
  // centre the footprint on the origin, ground at y = 0
  const box = new THREE.Box3().setFromObject(house), ctr = box.getCenter(new THREE.Vector3());
  house.position.set(-ctr.x, -box.min.y, -ctr.z);
  scene.add(house);
  const size = box.getSize(new THREE.Vector3()), R = .5 * Math.hypot(size.x, size.z), H = size.y;

  // ground: the sun's shadow plus a soft contact shade under the footprint
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.ShadowMaterial({ opacity: .17 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(size.x * 1.35, size.z * 1.45),
    new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, opacity: .55, toneMapped: false }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = .005; scene.add(blob);

  // sun from the south-west, high: the pergola fins draw their shadows across the deck
  const S = Math.max(size.x, size.z) * .78;
  sun.position.set(-11, 19, 15); sun.target.position.set(0, H * .3, 0);
  Object.assign(sun.shadow.camera, { left: -S, right: S, top: S, bottom: -S, near: 1, far: 70 }); sun.shadow.camera.updateProjectionMatrix();
  renderer.shadowMap.needsUpdate = true;

  /* ---------- views ---------- */
  const views = screens.map(el => {
    const cv = el.querySelector('canvas.scr-gl');
    const d = el.dataset;
    return { el, cv, ctx: cv.getContext('2d'), cam: new THREE.PerspectiveCamera(+d.fov || 28, 1, .5, 400),
      az: +d.az, elv: +d.el, fit: +d.fit || 1, lift: +d.lift || 0, spin: +d.spin || .09,
      vel: 0, idleAt: 0, drag: null, w: 1, h: 1, y: 0, follow: null };
  });
  let scale = Math.min(devicePixelRatio || 1, 2), W = 1, Hgl = 1;
  function layout() {
    views.forEach(v => { v.cssW = v.el.clientWidth; v.cssH = v.el.clientHeight; });
    // both screens share one drawing buffer: keep it near 4 million pixels, even on a large high-DPI display
    const area = Math.max(...views.map(v => v.cssW)) * views.reduce((a, v) => a + v.cssH, 0);
    const s = Math.min(scale, Math.sqrt(4.2e6 / Math.max(1, area)));
    views.forEach(v => {
      v.w = Math.max(2, Math.round(v.cssW * s)); v.h = Math.max(2, Math.round(v.cssH * s));
      if (v.cv.width !== v.w || v.cv.height !== v.h) { v.cv.width = v.w; v.cv.height = v.h; }
      v.cam.aspect = v.w / v.h;
    });
    W = Math.max(...views.map(v => v.w)); Hgl = 0;
    views.forEach(v => { v.y = Hgl; Hgl += v.h; });
    renderer.setSize(W, Hgl, false);
    dirty = true; kick();
  }
  const fitDist = v => {
    const vf = THREE.MathUtils.degToRad(v.cam.fov) / 2, hf = Math.atan(Math.tan(vf) * v.cam.aspect);
    const f = 1 + .4 * state.floorsAt;                                 // floors apart stand taller: step back
    return Math.max(R / Math.sin(Math.min(vf, hf)) * .74, (H * .62) / Math.tan(vf)) * v.fit * f;
  };
  function place(v) {
    const d = fitDist(v), ty = H * (.36 + .52 * state.floorsAt);
    const el = Math.min(1.2, v.elv + .2 * state.floorsAt), ce = Math.cos(el);   // look down into the opened floors
    v.cam.position.set(Math.sin(v.az) * ce * d, ty + Math.sin(el) * d, Math.cos(v.az) * ce * d);
    v.cam.lookAt(0, ty, 0);
    // shift the model up or down in the frame, clear of the app's own bars
    v.cam.setViewOffset(v.w, v.h, 0, v.lift * v.h, v.w, v.h);
  }

  /* ---------- turning: drag, arrow keys, momentum, then a slow turntable ---------- */
  views.forEach(v => {
    const c = v.cv;
    c.addEventListener('pointerdown', e => {
      if (e.button) return;
      v.drag = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
      v.vel = 0; v.follow = null; c.classList.add('dragging'); stage.classList.add('touched'); kick();
      try { c.setPointerCapture(e.pointerId); } catch (err) {}
    });
    c.addEventListener('pointermove', e => {
      const g = v.drag; if (!g || g.id !== e.pointerId) return;
      const now = performance.now(), dt = Math.max(8, now - g.t), dx = e.clientX - g.x, dy = e.clientY - g.y;
      const k = 3.4 / Math.max(260, v.cssW);
      v.az -= dx * k; if (e.pointerType === 'mouse') v.elv = clamp(v.elv + dy * k * .8, .04, 1.05);
      v.vel = -dx * k / dt * 16.7;
      g.x = e.clientX; g.y = e.clientY; g.t = now; dirty = true;
    });
    const up = e => { if (!v.drag || v.drag.id !== e.pointerId) return; v.drag = null; v.idleAt = performance.now() + 3200; c.classList.remove('dragging'); if (reduce) v.vel = 0; };
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    c.addEventListener('keydown', e => {
      const s = { ArrowLeft: [-.2, 0], ArrowRight: [.2, 0], ArrowUp: [0, .08], ArrowDown: [0, -.08] }[e.key]; if (!s) return;
      e.preventDefault(); v.az += s[0]; v.elv = clamp(v.elv + s[1], .04, 1.05); v.idleAt = performance.now() + 3200; v.follow = null; dirty = true; kick();
    });
  });

  /* ---------- finishes: colours ease across in 0.45 s ---------- */
  const tmp = new THREE.Color();
  function paint(i, now) {
    const pal = FINISHES[i] || {};
    paintable.forEach(({ role, m }) => {
      m.userData.from.copy(m.color);
      // a palette colour is the colour of the swatch; the sun lifts it on the model, so it goes in a little darker
      m.userData.to.copy(pal[role] ? tmp.set(pal[role]).multiplyScalar(.8) : m.userData.base);
    });
    state.colorT = now ? .999 : 0; dirty = true; kick();
  }

  /* ---------- loop: runs while the devices are on screen ---------- */
  let raf = 0, last = 0, onScreen = false, dirty = true, slow = 0, frames = 0;
  function kick() { if (!raf && onScreen && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  function frame(now) {
    raf = 0;
    const dt = clamp((now - last) / 1000, 0, .05); last = now;
    let moving = false;
    // floors apart
    if (state.floorsT < 1) {
      state.floorsT = Math.min(1, state.floorsT + dt / (reduce ? .01 : 1.1));
      const k = state.floorsAt = state.floorsFrom + (state.floors - state.floorsFrom) * ease(state.floorsT);
      levels.forEach((l, i) => l.position.y = LIFT[i] * k);
      // each floor's cut comes down from just above its roof to just below its ceiling as the floors part
      cuts.forEach((p, i) => p.constant = k > .001 ? house.position.y + LIFT[i] * k + CUT[i] + (1 - k) * .6 : 1e4);
      renderer.shadowMap.needsUpdate = true; moving = true;
    }
    if (state.colorT < 1) {
      state.colorT = Math.min(1, state.colorT + dt / (reduce ? .01 : .45));
      const t = ease(state.colorT);
      paintable.forEach(({ m }) => m.color.copy(m.userData.from).lerp(m.userData.to, t));
      moving = true;
    }
    views.forEach(v => {
      if (v.drag) { moving = true; return; }
      if (v.follow) {                                   // eases to the tablet's angle after "send"
        const f = v.follow; f.t = Math.min(1, f.t + dt / 1.4); const t = ease(f.t);
        v.az = f.az0 + (f.az1 - f.az0) * t; v.elv = f.el0 + (f.el1 - f.el0) * t;
        if (f.t >= 1) { v.follow = null; v.idleAt = now + 2500; }
        moving = true; return;
      }
      if (Math.abs(v.vel) > .0004) { v.az += v.vel * dt * 60; v.vel *= Math.pow(.92, dt * 60); moving = true; }
      else if (!reduce && now > v.idleAt) { v.az += v.spin * dt; moving = true; }
    });
    if (moving || dirty) { render(); dirty = false; }
    // a device that cannot keep up draws fewer pixels
    if (moving && ++frames > 40) {
      slow = dt > .034 ? slow + 1 : Math.max(0, slow - 1);
      if (slow > 25 && scale > .75) { scale = Math.max(.75, scale * .8); slow = 0; layout(); }
    }
    if (moving && onScreen && !document.hidden) raf = requestAnimationFrame(frame);
  }
  function render() {
    renderer.setScissorTest(true);
    for (const v of views) {
      place(v);
      const y = Hgl - v.y - v.h;
      renderer.setViewport(0, y, v.w, v.h); renderer.setScissor(0, y, v.w, v.h);
      renderer.render(scene, v.cam);
      v.ctx.clearRect(0, 0, v.w, v.h);
      v.ctx.drawImage(gl, 0, v.y, v.w, v.h, 0, 0, v.w, v.h);
    }
    renderer.setScissorTest(false);
  }
  function follow() {
    const [tab, ph] = views; if (!tab || !ph) return;
    let az1 = tab.az; while (az1 - ph.az > Math.PI) az1 -= 2 * Math.PI; while (az1 - ph.az < -Math.PI) az1 += 2 * Math.PI;
    ph.vel = 0; ph.follow = { t: 0, az0: ph.az, az1, el0: ph.elv, el1: tab.elv }; kick();
  }

  new ResizeObserver(layout).observe(stage);
  new IntersectionObserver(es => { onScreen = es[0].isIntersecting; if (onScreen) { dirty = true; kick(); } }, { rootMargin: '10% 0px' }).observe(stage);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { dirty = true; kick(); } });
  views.forEach(v => v.idleAt = performance.now() + 900);
  layout(); render();                                  // draw before the stills give way, so the screens never blink
  stage.classList.add('live');
  if (DEBUG) window.__tools = { renderer, scene, views, house, levels, paintable, render, layout, state, sun, ground, blob, frame,
    ms: { load: Math.round(t1 - t0), build: Math.round(performance.now() - t1) },
    show: v => { onScreen = v; dirty = true; kick(); }, scale: s => { scale = s; layout(); } };
  return { paint, kick: () => { dirty = true; kick(); }, follow };
}

function geomsDone(buckets) { buckets.forEach(b => b.geoms.forEach(g => g.dispose())); buckets.clear(); }

// soft rectangular shade under the house, drawn once into a small canvas (a shape's blurred shadow, drawn from off
// the canvas: ctx.filter is missing in older Safari)
function blobTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d');
  x.shadowColor = 'rgba(0,0,0,.9)'; x.shadowBlur = 34; x.shadowOffsetX = 1000;
  x.fillStyle = '#000'; x.fillRect(48 - 1000, 52, 160, 152);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

initTools();
