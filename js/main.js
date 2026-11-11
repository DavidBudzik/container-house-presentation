import { setLang, initialLang } from './i18n.js?v=17';

const MODEL = 'assets/models/house-real.glb?v=2';   // exported from Container House.blend with its materials (web-model/export_glb.py)

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
      const { createAxo } = await import('./axo.js?v=25');
      axo = createAxo(exploreCanvas, { mode: 'story', fit: 1.2, model: MODEL, sheets: false, look: 'real' });
      explore = (await import('./explore.js?v=6')).initExplore(axo);
    } catch (e) {
      console.warn('3D view unavailable, showing a static drawing.', e);
      axo = null; showFallback(exploreCanvas);
    }
  } else showFallback(exploreCanvas);
  addEventListener('resize', () => axo?.resize());

  let refresh = () => {};
  if (window.gsap && window.ScrollTrigger) {
    try { refresh = (await import('./scroll.js?v=15')).initScroll(); }
    catch (e) { console.warn('Scroll animation unavailable.', e); document.documentElement.classList.add('no-motion'); }
  } else document.documentElement.classList.add('no-motion');
  await (await import('./journey.js?v=4')).initJourney();   // async (fetches its frame lists): wait so its pin is sorted below
  // Pins created after scroll.js (the journey) sit higher on the page: order triggers by position so earlier pins
  // add their spacer height before later ones measure their start.
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

// Model-true split: drag, click or arrow keys move the divider between clay and finished.
function split() {
  const fig = document.getElementById('mtSplit'); if (!fig) return;
  const handle = fig.querySelector('.mt-handle');
  const set = f => { f = Math.max(0, Math.min(1, f)); fig.style.setProperty('--s', (f * 100).toFixed(2) + '%'); handle.setAttribute('aria-valuenow', Math.round(f * 100)); };
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
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { ol.style.setProperty('--p', 1); steps.forEach(li => li.classList.add('on')); return; }
  let raf = 0;
  const update = () => {
    raf = 0;
    const mid = innerHeight * .6, r = ol.getBoundingClientRect();
    ol.style.setProperty('--p', Math.max(0, Math.min(1, (mid - r.top - 24) / (r.height - 48))).toFixed(3));
    steps.forEach(li => li.classList.toggle('on', li.querySelector('b').getBoundingClientRect().top + 24 <= mid));
  };
  addEventListener('scroll', () => { raf ||= requestAnimationFrame(update); }, { passive: true });
  addEventListener('resize', update);
  update();
}
howSteps();

// Example clips in the deliverables grid play only while visible.
function inviewVideos() {
  const vids = document.querySelectorAll('video[data-inview]'); if (!vids.length) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) { vids.forEach(v => { v.preload = 'metadata'; v.controls = true; }); return; }
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) e.target.play().catch(() => {}); else e.target.pause(); }), { threshold: .4 });
  vids.forEach(v => io.observe(v));
}
inviewVideos();

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
