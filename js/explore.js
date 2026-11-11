// Free-orbit viewer, kept simple: four modes (House / Explode / Inside / Plan), a floor switch that only
// appears when it matters, and a build scrubber. The model itself is the main control: it idles on a slow
// turntable, spins with momentum when dragged, and builds itself the first time it scrolls into view.
// Page scrolling is never captured: the wheel only zooms with Ctrl/⌘ (which is also how trackpad pinch arrives).
export function initExplore(axo) {
  const stage = document.getElementById('exploreStage');
  const canvas = document.getElementById('exploreAxo'), box = document.getElementById('exploreBox');
  const hint = document.getElementById('exHint');
  const slider = document.getElementById('exBuild'), stepOut = document.getElementById('exStep'), nameOut = document.getElementById('exName');
  const playBtn = document.getElementById('exPlay');
  const modeBtns = [...stage.querySelectorAll('[data-mode]')], floorBtns = [...stage.querySelectorAll('[data-floor]')];
  const floors = stage.querySelector('.ex-floors');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let mode = 'whole', floor = 'ground', build = 10;
  axo.setBuild(build); axo.setView(1); axo.setExtrude(1); axo.setSheet(0); axo.setInset(0); axo.setLabels(false); axo.snap();

  /* ---------- modes ---------- */
  const ALL = ['shell', 'steel', 'frame', 'glass', 'timber', 'interior', 'accent', 'floor', 'furniture', 'roof', 'pv', 'pier'];
  const INSIDE = new Set(['shell', 'interior', 'accent', 'floor', 'furniture', 'glass']);
  // at = camera target (m, drawing origin = NW container corner), levels shown, cut = plan-cut height (m)
  const FLOOR = {
    ground: { at: [6.1, 1.0, 3.7], zoom: 1.3,  levels: [1, 0, 0], cut: 2.5 },
    upper:  { at: [6.1, 3.9, 2.5], zoom: 1.45, levels: [1, 1, 0], cut: 5.5 },
  };
  const layers = set => ALL.forEach(k => axo.setLayer(k, !set || set.has(k)));

  function setMode(m) {
    mode = m;
    modeBtns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
    const cut = m === 'inside' || m === 'plan';
    floors.hidden = !cut;
    axo.setView(m === 'plan' ? 0 : 1);
    axo.setExplode(m === 'explode' ? 1 : 0);
    axo.setLabels(m === 'explode');                     // part names only where they explain something
    layers(cut ? INSIDE : null);
    axo.setFocus(cut ? FLOOR[floor] : {});
    if (m !== 'whole' && m !== 'explode') stopSpin();
    stage.dataset.mode = m;
  }
  modeBtns.forEach(b => b.addEventListener('click', () => { setMode(b.dataset.mode); poke(); }));
  floorBtns.forEach(b => b.addEventListener('click', () => {
    floor = b.dataset.floor;
    floorBtns.forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    axo.setFocus(FLOOR[floor]); poke();
  }));

  /* ---------- idle turntable + momentum ---------- */
  let vel = 0, idleAt = performance.now() + 2500, spinRaf = 0, onScreen = false, dragging = false;
  const IDLE_SPEED = reduce ? 0 : .0016;               // rad per frame-ish, scaled by dt below
  function poke() { idleAt = performance.now() + 5000; dismissHint(); }
  function stopSpin() { vel = 0; }
  function spin(now) {
    spinRaf = 0;
    if (!onScreen) return;
    const o = axo.getOrbit();
    if (!dragging) {
      if (Math.abs(vel) > .0002) { axo.setOrbit(o.az + vel, o.el); vel *= .94; }
      else if (now > idleAt && IDLE_SPEED && mode !== 'plan') axo.setOrbit(o.az + IDLE_SPEED, o.el);
    }
    spinRaf = requestAnimationFrame(spin);
  }
  new IntersectionObserver(es => {
    onScreen = es[0].isIntersecting;
    if (onScreen && !spinRaf) spinRaf = requestAnimationFrame(spin);
  }, { threshold: .15 }).observe(stage);

  /* ---------- orbit / zoom input ---------- */
  const pts = new Map();
  let pinch0 = 0, zoom0 = 1;
  const dist = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  function toIso() { if (mode === 'plan') setMode('inside'); }
  function dismissHint() { hint.classList.add('gone'); }

  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) { pinch0 = dist(); zoom0 = axo.getOrbit().zoom; }
    dragging = true; vel = 0; box.classList.add('dragging'); toIso(); poke();
  });
  canvas.addEventListener('pointermove', e => {
    const p = pts.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (pts.size === 1) { const o = axo.getOrbit(); axo.setOrbit(o.az - dx * .008, o.el + dy * .006); vel = -dx * .008; }
    else if (pts.size === 2 && pinch0) axo.setZoom(zoom0 * dist() / pinch0);
  });
  const end = e => {
    pts.delete(e.pointerId); if (pts.size < 2) pinch0 = 0;
    if (!pts.size) { dragging = false; box.classList.remove('dragging'); if (reduce) vel = 0; poke(); }
  };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('dblclick', () => { axo.resetOrbit(); poke(); });

  canvas.addEventListener('wheel', e => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault(); toIso(); axo.setZoom(axo.getOrbit().zoom * Math.exp(-e.deltaY * .004)); poke();
  }, { passive: false });

  canvas.addEventListener('keydown', e => {
    const o = axo.getOrbit(), step = .12;
    const keys = {
      ArrowLeft: () => axo.setOrbit(o.az + step, o.el), ArrowRight: () => axo.setOrbit(o.az - step, o.el),
      ArrowUp: () => axo.setOrbit(o.az, o.el + step), ArrowDown: () => axo.setOrbit(o.az, o.el - step),
      '+': () => axo.setZoom(o.zoom * 1.2), '=': () => axo.setZoom(o.zoom * 1.2), '-': () => axo.setZoom(o.zoom / 1.2),
      '0': () => axo.resetOrbit(),
    };
    if (keys[e.key]) { e.preventDefault(); toIso(); keys[e.key](); poke(); }
  });
  box.querySelectorAll('[data-zoom]').forEach(b => b.addEventListener('click', () => {
    toIso(); axo.setZoom(axo.getOrbit().zoom * (b.dataset.zoom > 0 ? 1.25 : 1 / 1.25)); poke(); }));
  box.querySelector('[data-reset]').addEventListener('click', () => { axo.resetOrbit(); setMode('whole'); poke(); });

  /* ---------- full screen ---------- */
  const fsBtn = box.querySelector('[data-fs]');
  if (!stage.requestFullscreen && !stage.webkitRequestFullscreen) fsBtn.hidden = true;
  fsBtn.addEventListener('click', () => {
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    if (fsEl) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else (stage.requestFullscreen || stage.webkitRequestFullscreen).call(stage);
  });
  const onFs = () => fsBtn.setAttribute('aria-pressed', String(!!(document.fullscreenElement || document.webkitFullscreenElement)));
  document.addEventListener('fullscreenchange', onFs); document.addEventListener('webkitfullscreenchange', onFs);

  /* ---------- build sequence ---------- */
  let raf = 0, playing = false;
  const stepName = t => {
    const i = Math.max(0, Math.min(9, Math.ceil(t - 1e-3) - 1));
    return t < .05 ? '' : document.querySelector(`[data-i18n="step.${i}"]`)?.textContent || '';
  };
  function setBuild(t, fromSlider) {
    build = t; axo.setBuild(t);
    if (!fromSlider) slider.value = t;
    slider.style.setProperty('--p', (t / 10 * 100) + '%');
    stepOut.textContent = String(Math.ceil(t - 1e-3)).padStart(2, '0') + ' / 10';
    nameOut.textContent = stepName(t) || '—';
  }
  function setPlaying(on) { playing = on; playBtn.classList.toggle('on', on); playBtn.querySelector('span').textContent = on ? '❚❚' : '▶'; }
  slider.addEventListener('input', () => { cancelAnimationFrame(raf); setPlaying(false); setBuild(+slider.value, true); poke(); });

  function play() {
    cancelAnimationFrame(raf);
    if (reduce) { setBuild(10); return; }
    if (mode === 'plan' || mode === 'inside') setMode('whole');
    const from = build >= 9.99 ? 0 : build, t0 = performance.now(), dur = 7000 * (10 - from) / 10;
    if (from === 0) { setBuild(0); axo.snap(); }
    setPlaying(true);
    const tick = now => {
      const f = Math.min(1, (now - t0) / dur); setBuild(from + f * (10 - from));
      if (f < 1) raf = requestAnimationFrame(tick); else setPlaying(false);
    };
    raf = requestAnimationFrame(tick);
  }
  playBtn.addEventListener('click', () => { if (playing) { cancelAnimationFrame(raf); setPlaying(false); } else play(); });

  // build itself once, the first time most of the stage is on screen
  if (!reduce) {
    const once = new IntersectionObserver(es => {
      if (es[0].intersectionRatio > .45) { once.disconnect(); play(); }
    }, { threshold: [.45] });
    once.observe(stage);
  }

  setMode('whole');
  setBuild(10);
  return { refresh: () => { nameOut.textContent = stepName(build) || '—'; } };    // re-read step names after a language switch
}
