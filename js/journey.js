// Journey: one pinned, scroll-scrubbed shot from the assembly to the walkthrough of the built house.
//   assembly (house builds itself in iso, on white) -> fly-in (camera swoops down to the garden path while the
//   studio look dissolves into the real one) -> walkthrough (the animated walkthrough cameras).
// Frames are WebP stills rendered in Blender (walkthrough/flyin/*). When the composed assembly + fly-in sequence
// (assets/journey/seq.json) is not there yet, the old portrait assembly frames are used and the fly-in is bridged
// by a zoom-dissolve in the browser, so the page works at every stage of the render.
// A chapter rail beside the shot shows where you are; clicking a chapter scrolls there.

const ASM = { first: 400, last: 565, src: f => `assets/assembly/f_${String(f).padStart(4, '0')}.webp?v=2` };
const TOUR = { base: 'assets/tour_v12/', ver: 2 };
const JOURNEY = { base: 'assets/journey/', ver: 1 };

// chapter -> which frames it owns
const CHAPTERS = [
  { key: 'found', asm: [0, .3] }, { key: 'mods', asm: [.3, .66] }, { key: 'roof', asm: [.66, 1.01] },
  { key: 'arrive', fly: true, shots: [1] }, { key: 'entry', shots: [2] }, { key: 'living', shots: [3] },
  { key: 'up', shots: [5, 6] }, { key: 'garden', shots: [9] },
];

export async function initJourney() {
  const sec = document.getElementById('journey'), card = document.getElementById('jrCard'), canvas = document.getElementById('jrCanvas');
  if (!sec || !canvas) return;
  const ctx = canvas.getContext('2d');
  const bar = document.getElementById('jrBar');
  const rail = [...sec.querySelectorAll('.jr-rail button')], caps = [...sec.querySelectorAll('.jr-cap')];
  const { gsap, ScrollTrigger } = window;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- frame list ---------- */
  const items = [];                       // { src, fit, ch, light } or { mix: [a, b], t, ch, light }
  let tour = [];
  try { tour = (await (await fetch(`${TOUR.base}tour_frames.json?v=${TOUR.ver}`, { cache: 'no-cache' })).json()).map((e, file) => ({ ...e, file })).filter(e => !e.skip); }
  catch (e) { console.warn('Walkthrough frames unavailable.', e); }
  let seq = null;
  try { const r = await fetch(`${JOURNEY.base}seq.json?v=${JOURNEY.ver}`, { cache: 'no-cache' }); if (r.ok) seq = await r.json(); }
  catch (e) { /* not rendered yet */ }

  const chOfAsm = u => CHAPTERS.findIndex(c => c.asm && u >= c.asm[0] && u < c.asm[1]);
  const chOfShot = s => CHAPTERS.findIndex(c => c.shots?.includes(s));
  const jsrc = i => `${JOURNEY.base}s_${String(i).padStart(4, '0')}.webp?v=${JOURNEY.ver}`;
  const tsrc = f => `${TOUR.base}t_${String(f).padStart(4, '0')}.webp?v=${TOUR.ver}`;
  const arrive = CHAPTERS.findIndex(c => c.fly);

  if (seq) {
    for (let i = 0; i < seq.assembly; i++) items.push({ src: jsrc(i), fit: 'cover', ch: chOfAsm(i / (seq.assembly - 1)), light: true });
    for (let i = 0; i < seq.flyin; i++) items.push({ src: jsrc(seq.assembly + i), fit: 'cover', ch: arrive, light: (seq.real?.[i] ?? 1) < .5 });
  } else {
    const n = ASM.last - ASM.first + 1;
    for (let i = 0; i < n; i++) items.push({ src: ASM.src(ASM.first + i), fit: 'contain', ch: chOfAsm(i / (n - 1)), light: true });
    const a = items.length - 1, B = 48;                // bridge: zoom into the finished house, dissolve to the path
    for (let k = 1; k <= B; k++) items.push({ mix: [a, a + B + 1], t: k / (B + 1), ch: arrive, light: k / (B + 1) < .55 });
  }
  tour.forEach(e => items.push({ src: tsrc(e.file), fit: 'cover', ch: chOfShot(e.shot) }));
  const n = items.length;
  const chStart = CHAPTERS.map((_, c) => items.findIndex(it => it.ch === c));

  /* ---------- loading and drawing ---------- */
  const imgs = new Map();
  let want = 0, drawn = -1, ch = -1;
  const img = i => imgs.get(items[i].src);
  const ok = i => items[i].src ? img(i)?.ok : items[i].mix.every(ok);
  const load = i => new Promise(res => {
    const it = items[i];
    if (it.mix) return Promise.all(it.mix.map(load)).then(res);
    if (imgs.has(it.src)) { const m = imgs.get(it.src); return m.ok || m.bad ? res() : m.addEventListener('load', res, { once: true }); }
    const m = new Image(); imgs.set(it.src, m);
    m.decoding = 'async';
    m.onload = () => { m.ok = true; if (Math.abs(i - want) < 4) draw(); res(); };
    m.onerror = () => { m.bad = true; res(); };
    m.src = it.src;
  });
  const fit = () => {
    const r = card.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(r.width * d); canvas.height = Math.round(r.height * d);
    drawn = -1; draw();
  };
  function paint(m, mode, alpha = 1, zoom = 1) {
    const cw = canvas.width, ch = canvas.height;
    let s = mode === 'contain' ? Math.min(cw / m.naturalWidth, ch * .92 / m.naturalHeight) : Math.max(cw / m.naturalWidth, ch / m.naturalHeight);
    s *= zoom;
    const w = m.naturalWidth * s, h = m.naturalHeight * s;
    ctx.globalAlpha = alpha;
    ctx.drawImage(m, (cw - w) / 2, (ch - h) / 2 + (mode === 'contain' ? ch * .02 : 0), w, h);
    ctx.globalAlpha = 1;
  }
  function nearestOk(i) {
    for (let k = 0; k < n; k++) for (const j of [i - k, i + k]) if (j >= 0 && j < n && ok(j)) return j;
    return -1;
  }
  function draw() {
    const i = ok(want) ? want : nearestOk(want);
    if (i < 0 || (i === drawn && i === want)) return;
    drawn = i;
    const it = items[i];
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (it.mix) {
      const t = it.t, e = t * t * (3 - 2 * t);
      paint(img(it.mix[0]), 'contain', 1 - e * e, 1 + e * 1.4);
      paint(img(it.mix[1]), 'cover', e, 1.12 - .12 * e);
    } else paint(img(i), it.fit);
  }

  // A few requests at a time: hundreds of frames fired at once queue every other image on the page behind them
  // (lazy images further down stayed blank until the whole sequence had arrived).
  async function pool(list, k = 4) {
    let p = 0;
    await Promise.all(Array.from({ length: k }, async () => { while (p < list.length) await load(list[p++]); }));
  }
  async function preload() {                           // chapter starts first, then everything coarse to fine
    await load(0); card.classList.add('ready'); fit();
    await pool(chStart.filter(i => i >= 0));
    const seen = new Set();
    for (const step of [24, 12, 6, 3, 1]) {
      const list = [];
      for (let i = 0; i < n; i += step) if (!seen.has(i)) { seen.add(i); list.push(i); }
      await pool(list);
    }
  }

  /* ---------- state from scroll ---------- */
  function set(p) {
    p = Math.max(0, Math.min(1, p));
    want = Math.round(p * (n - 1));
    if (bar) bar.style.transform = `scaleY(${p.toFixed(4)})`;
    const it = items[want];
    if (it.ch !== ch) {
      ch = it.ch;
      rail.forEach((b, k) => { b.classList.toggle('on', k === ch); b.classList.toggle('past', k < ch); b.setAttribute('aria-current', k === ch ? 'step' : 'false'); });
      caps.forEach(c => c.classList.toggle('on', c.dataset.ch === CHAPTERS[ch]?.key));
    }
    const light = !!it.light;
    card.classList.toggle('light', light);
    if (light) sec.removeAttribute('data-theme'); else sec.setAttribute('data-theme', 'dark');
    if (st?.isActive) document.querySelector('.nav')?.classList.toggle('dark', light);   // nav tone runs before this update
    load(want).then(draw); draw();
  }

  new ResizeObserver(fit).observe(card);
  new IntersectionObserver(([e], io) => { if (e.isIntersecting) { io.disconnect(); preload(); } }, { rootMargin: '150% 0px' }).observe(card);

  let st = null;
  const jump = c => {
    const i = chStart[c]; if (i < 0) return;
    const p = (i + .5) / (n - 1);
    if (!st) { set(p); load(want).then(draw); return; }
    const y = st.start + (st.end - st.start) * p;
    window.__lenis ? window.__lenis.scrollTo(y, { duration: 1.4 }) : window.scrollTo({ top: y, behavior: 'smooth' });
  };
  rail.forEach((b, k) => b.addEventListener('click', () => jump(k)));

  if (!gsap || !ScrollTrigger || reduce) { set(0); return; }
  // ~5.5 viewport heights of scroll per 100 frames feels like walking pace; long enough to read each caption
  const gap = () => Math.round(parseFloat(getComputedStyle(sec).paddingLeft) || 8);   // pin the card one inset below the top
  st = ScrollTrigger.create({ trigger: card, pin: card, start: () => `top ${gap()}px`, end: () => '+=' + Math.round(innerHeight * n / 100 * 1.6), pin: true, scrub: true, onUpdate: s => set(s.progress) });
  set(st.progress);
}
