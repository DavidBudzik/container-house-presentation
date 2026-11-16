import { setLang, initialLang } from './i18n.js?v=38';

// exported from Redesign\Container_House_Redesigned.blend by web-model/export_glb_viewer_v2.py: house only, no garden and
// no plants, every material as the flat colour Cycles measures for it. Kept next to it: house-redesigned.glb (the first
// export of the same model, web-model/export_glb_redesign.py) and house-real.glb (Container House.blend, export_glb.py)
const MODEL = 'assets/models/house-redesigned-v2.glb?v=1';

function webglOK() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); }
  catch (e) { return false; }
}
function showFallback(canvas) {
  document.documentElement.classList.add('no-3d');
  canvas.hidden = true;
  const img = canvas.parentElement.querySelector('.axo-fallback');
  if (img) img.hidden = false;
}

async function boot() {
  setLang(initialLang());
  const exploreCanvas = document.getElementById('exploreAxo');
  let axo = null, explore = null;
  if (webglOK()) {
    try {
      const { createAxo } = await import('./axo.js?v=30');
      axo = createAxo(exploreCanvas, { mode: 'story', fit: 1.2, model: MODEL, sheets: false, look: 'real' });
      explore = (await import('./explore.js?v=7')).initExplore(axo);
    } catch (e) {
      console.warn('3D view unavailable, showing a static drawing.', e);
      axo = null; showFallback(exploreCanvas);
    }
  } else showFallback(exploreCanvas);
  addEventListener('resize', () => axo?.resize());

  let refresh = () => {};
  if (window.gsap && window.ScrollTrigger) {
    try { refresh = (await import('./scroll.js?v=20')).initScroll(); }
    catch (e) { console.warn('Scroll animation unavailable.', e); document.documentElement.classList.add('no-motion'); }
  } else document.documentElement.classList.add('no-motion');
  // The scroll journey (white walkthrough) was removed on 2026-11-14; its walkthrough lives on as clips in the hero,
  // the rooms list, the exterior section, #work and the deliverables. Pins are still ordered by position so earlier
  // pins add their spacer height before later ones measure their start.
  // Sorted by document order, not by start: the starts are still stale at this point.
  if (window.ScrollTrigger) {
    const order = (a, b) => !a.trigger || !b.trigger || a.trigger === b.trigger ? 0
      : a.trigger.compareDocumentPosition(b.trigger) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    ScrollTrigger.getAll().filter(s => s.trigger).sort(order).forEach((s, i, all) => s.vars.refreshPriority = all.length - i);
    ScrollTrigger.sort(); ScrollTrigger.refresh();
  }
  document.fonts?.ready.then(() => refresh());

  document.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', () => {
    setLang(b.dataset.lang); refresh(); explore?.refresh();
  }));
}

// Model-true split: drag, click or arrow keys move the divider between the plain model and the finished film.
// With a film (#mtCanvas + #mtVideo) both halves come from ONE video, model on top and film below, drawn into the
// canvas on either side of the divider, so they can never drift apart. Model on the start side, as in the CSS.
function splitFilm(fig) {
  const cv = fig.querySelector('#mtCanvas'), v = fig.querySelector('#mtVideo'); if (!cv || !v) return () => {};
  const ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
  const poster = new Image(); poster.src = v.poster;
  const draw = () => {
    const src = v.readyState >= 2 ? v : (poster.complete && poster.naturalWidth ? poster : null); if (!src) return;
    const sw = src.videoWidth || src.naturalWidth, sh = (src.videoHeight || src.naturalHeight) / 2;
    const k = Math.max(W / sw, H / sh), dw = sw * k, dh = sh * k, dx = (W - dw) / 2, dy = (H - dh) / 2;   // cover
    const s = (parseFloat(fig.style.getPropertyValue('--s')) || 50) / 100, rtl = document.documentElement.dir === 'rtl';
    ctx.drawImage(src, 0, sh, sw, sh, dx, dy, dw, dh);                                // the film, full frame
    ctx.save(); ctx.beginPath(); ctx.rect(rtl ? W * (1 - s) : 0, 0, W * s, H); ctx.clip();
    ctx.drawImage(src, 0, 0, sw, sh, dx, dy, dw, dh); ctx.restore();                   // the model, up to the divider
  };
  poster.addEventListener('load', draw);
  const frame = () => { draw(); if (!v.paused) v.requestVideoFrameCallback ? v.requestVideoFrameCallback(frame) : requestAnimationFrame(frame); };
  v.addEventListener('play', frame);
  v.addEventListener('loadeddata', draw);
  return draw;
}
function split() {
  const fig = document.getElementById('mtSplit'); if (!fig) return;
  const handle = fig.querySelector('.mt-handle');
  const redraw = splitFilm(fig);
  const set = f => { f = Math.max(0, Math.min(1, f)); fig.style.setProperty('--s', (f * 100).toFixed(2) + '%'); handle.setAttribute('aria-valuenow', Math.round(f * 100)); redraw(); };
  const at = e => { const r = fig.getBoundingClientRect(); const f = (e.clientX - r.left) / r.width; return document.documentElement.dir === 'rtl' ? 1 - f : f; };
  let down = false;
  fig.addEventListener('pointerdown', e => { down = true; fig.setPointerCapture(e.pointerId); set(at(e)); });
  fig.addEventListener('pointermove', e => { if (down) set(at(e)); });
  fig.addEventListener('pointerup', () => { down = false; });
  handle.addEventListener('keydown', e => {
    const cur = parseFloat(getComputedStyle(fig).getPropertyValue('--s')) / 100 || .5;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); set(cur + (e.key === 'ArrowRight' ? .05 : -.05) * (document.documentElement.dir === 'rtl' ? -1 : 1)); }
  });
}
split();

// How it works: the rail fills toward the viewport middle and each step lights up as the rail reaches it.
function howSteps() {
  const ol = document.getElementById('howSteps'); if (!ol) return;
  const steps = [...ol.children];
  steps.forEach((li, i) => li.style.setProperty('--i', i));
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { ol.style.setProperty('--p', 1); ol.classList.add('in'); steps.forEach(li => li.classList.add('on')); return; }
  new IntersectionObserver(([e], io) => { if (e.isIntersecting) { ol.classList.add('in'); io.disconnect(); } }, { rootMargin: '0px 0px -12% 0px' }).observe(ol);
  const row = matchMedia('(min-width: 1001px)');               // wide: steps side by side on one rail; narrow: a vertical rail
  let raf = 0;
  const update = () => {
    raf = 0;
    const r = ol.getBoundingClientRect(), n = steps.length;
    let p;
    if (row.matches) {                                          // the rail draws while the row climbs from 85 % to 40 % of the screen
      p = Math.max(0, Math.min(1, (innerHeight * .85 - r.top) / (innerHeight * .45)));
      steps.forEach((li, i) => li.classList.toggle('on', p >= i / n + .02));
    } else {
      const mid = innerHeight * .6;
      p = Math.max(0, Math.min(1, (mid - r.top - 6) / (r.height - 12)));
      steps.forEach(li => li.classList.toggle('on', li.getBoundingClientRect().top + 6 <= mid));
    }
    ol.style.setProperty('--p', p.toFixed(3));
  };
  addEventListener('scroll', () => { raf ||= requestAnimationFrame(update); }, { passive: true });
  addEventListener('resize', update);
  update();
}
howSteps();

// Clips play only while visible. With reduced motion: background loops (data-bg) are hidden, so the image under them
// shows; the #work film stays a still (its canvas draws the poster); other clips get controls instead of autoplay.
function inviewVideos() {
  const vids = document.querySelectorAll('video[data-inview]'); if (!vids.length) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
    vids.forEach(v => {
      if (v.hasAttribute('data-bg')) { v.preload = 'none'; v.hidden = true; }
      else if (v.id !== 'mtVideo') { v.preload = 'metadata'; v.controls = true; }
    });
    return;
  }
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) e.target.play().catch(() => {}); else e.target.pause(); }), { threshold: .4 });
  // start buffering about a screen ahead, so a clip is ready to play by the time it scrolls in
  const warm = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting && e.target.preload !== 'auto') { e.target.preload = 'auto'; warm.unobserve(e.target); }
  }), { rootMargin: '120% 0px' });
  vids.forEach(v => { io.observe(v); warm.observe(v); });
}
inviewVideos();

// Films (#film: the ad film's two cuts and the silent case-study reel) play on a click only, never on their own.
// Starting one pauses the others, a film pauses when it leaves the screen, and after its last frame the poster and
// the play pill come back.
function films() {
  const cards = [...document.querySelectorAll('.film-card')]; if (!cards.length) return;
  const vids = cards.map(c => c.querySelector('video'));
  cards.forEach((card, i) => {
    const v = vids[i], btn = card.querySelector('.film-play');
    const others = () => vids.forEach(o => { if (o !== v) o.pause(); });
    btn.addEventListener('click', () => {
      others(); v.controls = true; btn.hidden = true;
      v.play().catch(() => { v.controls = false; btn.hidden = false; });
      v.focus({ preventScroll: true });
    });
    v.addEventListener('play', () => { others(); v.controls = true; btn.hidden = true; });
    v.addEventListener('ended', () => { v.controls = false; btn.hidden = false; v.load(); });
  });
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.intersectionRatio < .2) e.target.pause(); }), { threshold: [0, .2] });
    vids.forEach(v => io.observe(v));
  }
}
films();

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

// Deliverables gallery: a card with data-open plays its film large in a lightbox (native <dialog>), muted and looping,
// closed by the ✕ button, Esc or a click on the backdrop. Built on first use, so the page carries no extra markup.
function outLightbox() {
  const cards = document.querySelectorAll('[data-open]'); if (!cards.length) return;
  let dlg, vid;
  const build = () => {
    dlg = document.createElement('dialog'); dlg.className = 'lightbox';
    dlg.innerHTML = '<div class="lb-frame"><video muted loop playsinline></video></div>'
      + '<button type="button" class="lb-close" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>';
    document.body.append(dlg); vid = dlg.querySelector('video');
    dlg.querySelector('.lb-close').addEventListener('click', () => dlg.close());
    dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('close', () => { vid.pause(); window.__lenis?.start?.(); });
  };
  const open = card => {
    if (!dlg) build();
    vid.src = card.dataset.open; vid.poster = card.dataset.poster || '';
    dlg.style.setProperty('--ar', card.dataset.ratio || '16/9');
    vid.setAttribute('aria-label', card.querySelector('video,img')?.getAttribute('aria-label') || '');
    window.__lenis?.stop?.(); dlg.showModal(); vid.play().catch(() => { vid.controls = true; });
  };
  cards.forEach(card => {
    card.style.cursor = 'zoom-in';
    card.addEventListener('click', () => open(card));
  });
}
outLightbox();

// Floating button to the live 3D viewer: shown once the hero has scrolled away, hidden again while the viewer itself
// (#explore) is on screen, so it never covers the thing it points to.
function fab3d() {
  const fab = document.querySelector('.fab-3d'), hero = document.querySelector('.hero'), ex = document.getElementById('explore');
  if (!fab || !hero || !ex) return;
  let pastHero = false, atViewer = false;
  const sync = () => fab.classList.toggle('show', pastHero && !atViewer);
  new IntersectionObserver(([e]) => { pastHero = !e.isIntersecting; sync(); }, { threshold: .15 }).observe(hero);
  new IntersectionObserver(([e]) => { atViewer = e.isIntersecting; sync(); }, { threshold: .25 }).observe(ex);
}
fab3d();
