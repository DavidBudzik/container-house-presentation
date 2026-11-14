// Finishes comparison, after the villa site's "studies": chips pick the finish shown right of the divider;
// drag, click or arrow keys move the divider. The left side is always the house as designed.
// The images are pixel-registered drawings of one view (drawings/compose_finishes.py), so any two can be split.
function initCompare() {
  const fig = document.getElementById('cmp'); if (!fig) return;
  const handle = fig.querySelector('.cmp-handle'), imgs = [...fig.querySelectorAll('.cmp-top img')];
  const chipBox = document.getElementById('cmpChips'), chips = [...chipBox.querySelectorAll('.chip')];
  const name = document.getElementById('cmpName');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let s = 50, cur = 0, tween = null;

  const set = v => {
    s = Math.max(0, Math.min(100, v));
    fig.style.setProperty('--s', s.toFixed(2) + '%'); handle.setAttribute('aria-valuenow', Math.round(s));
  };
  const glide = (from, to, duration) => {
    tween?.kill(); tween = null;
    if (!window.gsap || reduce) return set(to);
    const o = { v: from };
    tween = window.gsap.to(o, { v: to, duration, ease: 'power3.out', onUpdate: () => set(o.v) });
  };

  // physical on purpose (no right-to-left flip): "as designed" stays on the left under its tag in both languages
  const at = e => { const r = fig.getBoundingClientRect(); return (e.clientX - r.left) / r.width * 100; };
  let down = false;
  fig.addEventListener('pointerdown', e => { down = true; tween?.kill(); fig.setPointerCapture(e.pointerId); set(at(e)); });
  fig.addEventListener('pointermove', e => { if (down) set(at(e)); });
  ['pointerup', 'pointercancel'].forEach(t => fig.addEventListener(t, () => { down = false; }));
  handle.addEventListener('keydown', e => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault(); tween?.kill(); set(s + (e.key === 'ArrowRight' ? 5 : -5));
  });

  const label = () => { if (name && chips[cur] && name.textContent !== chips[cur].textContent) name.textContent = chips[cur].textContent; };
  const pick = i => {
    if (i === cur) return; cur = i;
    chips.forEach((c, k) => { c.classList.toggle('on', k === i); c.setAttribute('aria-pressed', String(k === i)); });
    imgs.forEach((m, k) => m.classList.toggle('front', k === i));
    imgs[i].loading = 'eager'; imgs[i].classList.add('on');             // fades in over the previous finish...
    setTimeout(() => imgs.forEach((m, k) => { if (k !== cur) m.classList.remove('on'); }), 480);   // ...which then goes
    label(); glide(0, 50, .9);                                          // the new finish across the whole frame, then half and half
  };
  chips.forEach((c, i) => c.addEventListener('click', () => pick(i)));
  // the language switch rewrites the chip texts: keep the frame's name tag in step
  new MutationObserver(label).observe(chipBox, { childList: true, characterData: true, subtree: true });
  label();

  if (!reduce && 'IntersectionObserver' in window) {                    // first time in view: sweep from "as designed" to half
    set(92);
    const io = new IntersectionObserver(es => { if (es[0].isIntersecting) { io.disconnect(); glide(92, 50, 1.4); } }, { threshold: .45 });
    io.observe(fig);
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initCompare); else initCompare();
