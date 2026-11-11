// Scroll choreography after the villa site: Lenis smooth scroll, a nav that reads light over dark media,
// a slow hero push-in, pinned lists (plan drawings, rooms) that swap their media with scroll, the clay wipe and reveals.
export function initScroll() {
  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wide = () => matchMedia('(min-width: 1001px)').matches;

  let lenis = null;
  if (window.Lenis && !reduce) {
    lenis = window.__lenis = new window.Lenis({ lerp: .1 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
      const t = document.querySelector(a.getAttribute('href')); if (!t) return;
      e.preventDefault(); lenis.scrollTo(t, { offset: 0 });
    }));
  }
  const scrollTo = y => lenis ? lenis.scrollTo(y) : scrollTo_(y);
  const scrollTo_ = y => window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });

  /* nav: light while a dark section sits under it */
  const nav = document.querySelector('.nav');
  const darks = () => [...document.querySelectorAll("[data-theme=dark]")];   // live: the journey switches its own theme
  const navTone = () => {
    const y = nav.getBoundingClientRect().bottom - 8;
    const over = darks().some(s => { const r = s.getBoundingClientRect(); return r.top <= y && r.bottom >= y; });
    nav.classList.toggle('dark', !over);
  };
  ScrollTrigger.create({ start: 0, end: 'max', onUpdate: navTone }); navTone();

  if (!reduce) gsap.fromTo('.hero-img', { scale: 1.08 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });

  /* pinned pick list: scroll position picks the item, clicks scroll to it */
  function pinList(stageSel, listSel, mediaSel, onPick) {
    const stage = document.querySelector(stageSel), btns = [...document.querySelectorAll(listSel + ' button')];
    const imgs = [...document.querySelectorAll(mediaSel + ' img')];
    let cur = -1;
    const pick = i => {
      if (i === cur) return; cur = i;
      btns.forEach((b, k) => b.classList.toggle('on', k === i)); imgs.forEach((m, k) => m.classList.toggle('on', k === i));
      onPick?.(i);
    };
    pick(0);
    const per = 55;                                            // vh of scroll per item
    let st = null;
    gsap.matchMedia().add('(min-width: 1001px)', () => {
      st = ScrollTrigger.create({ trigger: stage, start: 'top top', end: `+=${btns.length * per}%`, pin: true,
        onUpdate: s => pick(Math.min(btns.length - 1, Math.floor(s.progress * btns.length))) });
      return () => { st = null; };
    });
    btns.forEach((b, i) => b.addEventListener('click', () => {
      if (st) scrollTo(st.start + (st.end - st.start) * (i + .5) / btns.length); else pick(i);
    }));
  }
  const tags = ['5 × 40 ft HC · 12 190 × 7 320 mm', '2 × 40 ft HC · terrace 29.7 m²', 'A–A · +0.40 / +3.30 / +6.20', 'B–B · 12 190 mm'];
  pinList('.plan-stage', '#planList', '#planMedia', i => { const t = document.getElementById('planTag'); if (t) t.textContent = tags[i]; });
  pinList('.rooms-stage', '#roomList', '#roomMedia');

  /* clay → finished wipe */
  const wipe = document.getElementById('wipe');
  if (wipe) {
    if (reduce) wipe.style.setProperty('--w', '50%');
    else ScrollTrigger.create({ trigger: wipe, start: 'top 75%', end: 'bottom 40%', scrub: true,
      onUpdate: s => wipe.style.setProperty('--w', (s.progress * 100).toFixed(2) + '%') });
  }

  /* reveals */
  const rv = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); rv.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('[data-reveal]').forEach(el => rv.observe(el));

  addEventListener('load', () => ScrollTrigger.refresh());
  return () => { ScrollTrigger.refresh(); navTone(); };
}
