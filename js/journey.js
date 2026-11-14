// Journey: one pinned, scroll-scrubbed shot of the white model, with no cuts.
//   assembly (the house builds itself and settles on its front elevation) -> walk-through (one continuous camera:
//   front door, ground floor, stair, home office, terrace, main bedroom) -> lift-off to an overview.
// Scroll position is the only clock: frame = progress x (frames - 1). Doors, sliding panes and blinds are keyed to the
// camera position inside the frames themselves, so they open and close with the scroll in both directions.
// Frames are WebP stills rendered in Blender (assets/journey/f_0001.webp ...); assets/journey/journey.json lists how
// many there are and which frames each chapter of the sequence covers.
// A chapter rail beside the shot shows where you are; clicking a chapter scrolls to the frame where its camera rests.

// v3 = the finished Cycles render (2026-11-14): assembly as house only on the card's white (1-279), the Mediterranean
// hills and garden fading in over 280-309, then the walk-through. The white preview set stays in assets/journey/.
// 2026-11-14: back on the white-model preview frames at the user's request ("bring back ... the first black and white
// version"). The Cycles sets wait in assets/journey-v3 (720p) and, once rendered, the 1080p set: swap the base to use them.
const JOURNEY = { base: 'assets/journey/', ver: 2 };
// Optional per-range overrides { from, to, base, ver } for re-rendered stretches.
// 2026-11-14: the assembly chapters (1-279) come from the 1080p Cycles render (house only, flattened on the card's white,
// journey-redesign-1080/A_assembly_alpha -> q72 WebP); from the front view (280) on, the white model as before.
const RENDERED = [{ from: 1, to: 279, base: 'assets/journey-assembly-1080/', ver: 1 }];
const PX_PER_FRAME = 22;                 // scroll distance per frame
const STILL = 'front';                   // sequence chapter shown when there is no scroll animation (assembled, front view)

// rail chapter -> the chapters of the rendered sequence it covers (journey.json keys); rest = whose rest frame a click lands on
const CHAPTERS = [
  { key: 'found', from: ['foundation'] }, { key: 'mods', from: ['ground', 'upper_modules'] }, { key: 'roof', from: ['envelope'] },
  { key: 'arrive', from: ['front'] }, { key: 'entry', from: ['entry'] }, { key: 'living', from: ['living', 'kitchen'] },
  { key: 'up', from: ['stair', 'upper', 'office'], rest: 'office' }, { key: 'terrace', from: ['terrace'] },
  { key: 'bedroom', from: ['bedroom'] }, { key: 'over', from: ['leaving', 'overview'], rest: 'overview' },
];

export async function initJourney() {
  const sec = document.getElementById('journey'), card = document.getElementById('jrCard'), canvas = document.getElementById('jrCanvas');
  if (!sec || !canvas) return;
  const ctx = canvas.getContext('2d');
  const bar = document.getElementById('jrBar');
  const rail = [...sec.querySelectorAll('.jr-rail button')], caps = [...sec.querySelectorAll('.jr-cap')];
  const { gsap, ScrollTrigger } = window;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- the sequence ---------- */
  let seq = null;
  try { const r = await fetch(`${JOURNEY.base}journey.json?v=${JOURNEY.ver}`, { cache: 'no-cache' }); if (r.ok) seq = await r.json(); }
  catch (e) { /* handled below */ }
  if (!seq?.frames) { console.warn('Journey frames unavailable.'); return; }
  const n = seq.frames;                                   // frames are numbered 1..n
  const by = Object.fromEntries(seq.chapters.map(c => [c.key, c]));
  const chapters = CHAPTERS.map(c => {
    const parts = c.from.map(k => by[k]).filter(Boolean);
    return { key: c.key, start: Math.min(...parts.map(p => p.frame)), end: Math.max(...parts.map(p => p.end)), rest: (by[c.rest] || parts[0]).rest };
  });
  const chOf = f => { const i = chapters.findIndex(c => f >= c.start && f <= c.end); return i < 0 ? chapters.length - 1 : i; };
  // In-between frames: where the camera turns fast, extra renders sit half-way between two frames (journey.json `halves`
  // lists the frames f that have an f + 0.5, file f_####_5.webp). They take the middle half of that frame's scroll
  // distance, so chapters and scroll length are unchanged. Keys are numbers: 650 or 650.5.
  const halves = new Set(seq.halves || []);
  const src = k => {
    const f = Math.floor(k), r = RENDERED.find(x => f >= x.from && f <= x.to) || JOURNEY;
    return `${r.base}f_${String(f).padStart(4, '0')}${k === f ? '' : '_5'}.webp?v=${r.ver}`;
  };

  /* ---------- loading and drawing ---------- */
  const imgs = new Map();
  let want = 1, lastPos = 1, drawn = 0, ch = -1, dir = 1;
  const ok = k => imgs.get(k)?.ok;
  const load = k => new Promise(res => {
    const had = imgs.get(k);
    if (had) return had.ok || had.bad ? res() : had.addEventListener('load', res, { once: true });
    const m = new Image(); imgs.set(k, m);
    m.decoding = 'async';
    m.onload = () => { m.ok = true; if (Math.abs(k - want) <= AHEAD) draw(); res(); };
    m.onerror = () => { m.bad = true; res(); };
    m.src = src(k);
  });
  // While the sequence is still arriving, the frames just ahead of the scroll are fetched first (the coarse-to-fine
  // sweep in preload() keeps going alongside). Pre-decoding them into ImageBitmaps was tried and measured worse:
  // createImageBitmap(img) blocked the main thread (7-10 hitches > 50 ms per 5 s scrub, against none without it).
  const AHEAD = 12;
  function loadAround() {
    const f0 = Math.floor(want);
    for (let k = 0; k <= AHEAD; k++) {
      const f = f0 + k * dir;
      if (f < 1 || f > n) continue;
      if (!imgs.has(f)) load(f);
      if (halves.has(f) && !imgs.has(f + 0.5)) load(f + 0.5);
    }
  }
  const fit = () => {
    const r = card.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(r.width * d); canvas.height = Math.round(r.height * d);
    drawn = 0; draw();
  };
  // The frame to show while `f` is not loaded yet: the nearest loaded one BEHIND the direction of travel (it was searched
  // both ways before, so with gaps in the sequence the picture flipped ahead and back: the blinking reported 2026-11-14);
  // ahead only when nothing behind is loaded yet.
  function nearestOk(k) {
    const f = Math.floor(k);
    for (let i = 0; i < n; i++) { const j = dir > 0 ? f - i : Math.ceil(k) + i; if (j !== k && j >= 1 && j <= n && ok(j)) return j; }
    for (let i = 1; i < n; i++) { const j = dir > 0 ? Math.ceil(k) + i : f - i; if (j >= 1 && j <= n && ok(j)) return j; }
    return 0;
  }
  // Only real frames are drawn. Blending the next frame in by the scroll fraction was tried (2026-11-14) and dropped:
  // it showed two overlapping pictures on every scroll ("few frames that are trying to fit in"). Fast turns get real
  // in-between renders instead (see `halves`).
  function draw() {
    const f = ok(want) ? want : nearestOk(want);
    if (!f || f === drawn) return;
    drawn = f;
    const m = imgs.get(f), iw = m.naturalWidth, ih = m.naturalHeight, cw = canvas.width, chh = canvas.height;
    // wide cards: the 16:9 frame fills the card; tall cards (phones): zoom in at most 1.9x and crop the sides, the white
    // card shows above and below
    const s = Math.min(Math.max(cw / iw, chh / ih), Math.min(cw / iw, chh / ih) * 1.9);
    const w = iw * s, h = ih * s, x = (cw - w) / 2, y = (chh - h) / 2;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cw, chh);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(m, x, y, w, h);
  }

  // A few requests at a time: hundreds of frames fired at once queue every other image on the page behind them
  // (lazy images further down stayed blank until the whole sequence had arrived).
  async function pool(list, k = 4) {
    let p = 0;
    await Promise.all(Array.from({ length: k }, async () => { while (p < list.length) await load(list[p++]); }));
  }
  async function preload() {                             // the frame on screen, chapter rests, then everything coarse to fine
    await load(want); card.classList.add('ready'); fit();
    await pool(chapters.map(c => c.rest));
    const seen = new Set();
    for (const step of [32, 16, 8, 4, 2, 1]) {
      const list = [];
      for (let f = 1; f <= n; f += step) if (!seen.has(f)) { seen.add(f); list.push(f); }
      await pool(list);
    }
    await pool([...halves].map(f => f + 0.5));
  }

  /* ---------- state from scroll ---------- */
  function set(p) {
    p = Math.max(0, Math.min(1, p));
    const pos = 1 + p * (n - 1);                         // fractional frame
    if (pos !== lastPos) dir = pos > lastPos ? 1 : -1;
    lastPos = pos;
    const base = Math.floor(pos), frac = pos - base;
    want = halves.has(base) && frac >= 0.25 && frac < 0.75 ? base + 0.5 : Math.min(n, Math.round(pos));
    if (bar) bar.style.transform = `scaleY(${p.toFixed(4)})`;
    const c = chOf(want);
    if (c !== ch) {
      ch = c;
      rail.forEach((b, k) => { b.classList.toggle('on', k === ch); b.classList.toggle('past', k < ch); b.setAttribute('aria-current', k === ch ? 'step' : 'false'); });
      caps.forEach(el => el.classList.toggle('on', el.dataset.ch === chapters[ch].key));
    }
    if (st?.isActive) document.querySelector('.nav')?.classList.add('dark');   // white frames: the nav stays dark over them
    load(want).then(draw); loadAround(); draw();
  }

  new ResizeObserver(fit).observe(card);
  new IntersectionObserver(([e], io) => { if (e.isIntersecting) { io.disconnect(); preload(); } }, { rootMargin: '150% 0px' }).observe(card);

  let st = null, baseLerp = null;
  const jump = c => {
    const p = (chapters[c].rest - 1) / (n - 1);
    if (!st) { set(p); return; }
    const y = st.start + (st.end - st.start) * p;
    window.__lenis ? window.__lenis.scrollTo(y, { duration: 1.4 }) : window.scrollTo({ top: y, behavior: 'smooth' });
  };
  rail.forEach((b, k) => b.addEventListener('click', () => jump(k)));

  if (!gsap || !ScrollTrigger || reduce) { set(((by[STILL]?.rest || 1) - 1) / (n - 1)); return; }   // no scrubbing: the built house
  const gap = () => Math.round(parseFloat(getComputedStyle(sec).paddingLeft) || 8);   // pin the card one inset below the top
  st = ScrollTrigger.create({ trigger: card, pin: card, start: () => `top ${gap()}px`, end: () => '+=' + Math.round((n - 1) * PX_PER_FRAME),
    scrub: true, invalidateOnRefresh: true, onUpdate: s => set(s.progress),
    // Snappier smooth-scroll while the walk-through is pinned: with the site-wide Lenis lerp of 0.1 the picture trailed
    // the wheel and kept drifting after it stopped ("a bit laggy", 2026-11-14). Restored when the pin lets go.
    onToggle: s => { const l = window.__lenis; if (!l) return; if (s.isActive) { baseLerp ??= l.options.lerp; l.options.lerp = 0.2; } else if (baseLerp != null) l.options.lerp = baseLerp; } });
  set(st.progress);

  // Re-measure every pin when the page changes height after load (lazy images, the 3D viewer, late layout): with a stale
  // start the journey pin ended early and a blank gap opened above the card (reported 2026-11-14).
  let lastH = document.documentElement.scrollHeight, rt = 0;
  new ResizeObserver(() => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      const h = document.documentElement.scrollHeight;
      if (Math.abs(h - lastH) < 4) return;
      ScrollTrigger.refresh();
      lastH = document.documentElement.scrollHeight;
    }, 300);
  }).observe(document.body);
}
