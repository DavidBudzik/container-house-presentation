# BZIK — container house presentation

A one-page, bilingual (English / Hebrew) marketing site for a five-container modular house. It shows how a
visualization studio sells a house before it is built: an interactive 3D model, a scroll-driven journey from
assembly to a walkthrough of the finished house, drawings, renders and a lifestyle gallery.

Static HTML, CSS and ES modules. No build step.

## Run locally

The page loads ES modules and JSON, so serve the folder over HTTP rather than opening the file:

```bash
npx serve .
```

or `python -m http.server 8000`, then open the printed address.

## Structure

```
index.html        every section; English copy is inline, each string has a data-i18n key
site.css          monochrome tokens, layout, RTL, reduced motion
js/
  main.js         boot order, language toggle, fallbacks when WebGL or GSAP are missing
  i18n.js         Hebrew dictionary and setLang(); edit English in index.html, Hebrew here
  scroll.js       Lenis smooth scroll, nav tone, pinned lists, clay wipe, reveals
  journey.js      the pinned assembly → fly-in → walkthrough sequence and its chapter rail
  explore.js      "Explore it yourself" viewer: orbit, modes, floors, build scrubber
  axo.js          Three.js model renderer used by the viewer
assets/
  img/            renders, drawings and fallbacks
  assembly/       assembly frames (f_0400–f_0565.webp)
  journey/        composed assembly + fly-in frames and seq.json (optional; see below)
  tour_v12/       walkthrough frames and tour_frames.json
  models/         house-real.glb for the 3D viewer
  video/          assembly film and the terrace scene loop
  brand/          logo
tools/            dev helpers (render import, fallback image capture)
```

## The journey sequence

`journey.js` plays still frames on a canvas as you scroll. When `assets/journey/seq.json` exists it uses the
composed Blender sequence (assembly, then the camera fly-in from the iso view down to the garden path, dissolving
from clay to the real look). Without it, it falls back to `assets/assembly/` frames and bridges into the
walkthrough with an in-browser zoom-dissolve, so the page works at every stage of the render.
After re-rendering frames, bump `JOURNEY.ver` / `TOUR.ver` in `journey.js`.

## Cache busting

`?v=N` query strings on `site.css`, `main.js` and the module imports force reloads during development.
Bump them after edits, or drop them when hosting with proper cache headers.

## Dependencies (CDN)

GSAP + ScrollTrigger (cdnjs), Lenis (unpkg), Three.js (jsdelivr), Inter Tight and Heebo (Google Fonts).

## Known limitations

- The Hebrew copy is a draft and needs native review.
- Three of the four isometric scenes are still in production; their cards are hidden by CSS until the clips exist.
- No form or analytics; the contact button is a mailto link.
