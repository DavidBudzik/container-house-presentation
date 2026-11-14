# BZIK — container house presentation

A one-page, bilingual (English / Hebrew) site for BZIK: David Budzik's 3D visualization and interactive presentation
work for architecture, real estate and construction. A five-container, two-storey concept house is the demonstration
project. The page shows it in several ways: drawings, a scroll-driven journey from assembly to a walkthrough, an
interactive 3D model, a finishes comparison, an exploded-view film, room images and scenes.

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
  scroll.js       Lenis smooth scroll, nav tone, pinned lists, reveals (its clay-wipe code is idle: the section is gone)
  compare.js      finishes comparison (#finishes): chips pick a finish, drag to compare it with the house as designed
  journey.js      the pinned assembly → walk-through → overview sequence and its chapter rail
  explore.js      "Explore it yourself" viewer: orbit, modes, floors, build scrubber
  axo.js          Three.js model renderer used by the viewer
assets/
  img/            renders, drawings and fallbacks
  journey/        the journey frames (f_0001–f_1395.webp, 1280×720) and journey.json
  assembly/       frames of the previous journey (assembly); no longer loaded
  tour_v12/       frames of the previous journey (walkthrough); no longer loaded
  models/         house-redesigned-v2.glb for the 3D viewer (its two predecessors are kept beside it, unused)
  video/          assembly film, the exploded-view loop and the terrace scene loop
  brand/          logo
tools/            dev helpers (render import, fallback image capture)
```

## The copy

English is inline in `index.html`, Hebrew in `js/i18n.js` under the same `data-i18n` keys. Rules the copy follows
since 2026-11-14:

- The Container House is labelled as a demonstration project (hero caption, the `#demo` intro and its facts strip).
- Headings say what the client gets; the small label above each one names the feature and where the picture comes
  from: "rendered from the model", "drawn from the model" or "AI-assisted".
- David speaks in the first person ("Tell me...", "I build..."). No promises about sales results and no comparisons
  with other studios.
- Only what works on this page is described as available. What it does not have (plans with clickable rooms, free
  virtual tours, live finish configurators, mobile and tablet apps) sits in the "Beyond this demonstration" strip
  under the deliverables, as work developed per project.

## The journey sequence

`journey.js` plays still frames on a canvas as you scroll: one pinned shot with no cuts. The white model assembles and
settles on its front elevation (frames 1–280), then a single camera walks in through the front door, through the ground
floor, up the stair, through the home office, across the terrace and the main bedroom, and lifts off to an overview.
Scroll position is the only clock (22 px of scroll per frame, `PX_PER_FRAME`), so it plays the same in both directions;
doors, sliding panes and blinds are keyed to the camera position inside the frames.

`assets/journey/journey.json` gives the frame count and the frame range and rest frame of each chapter of the sequence;
`CHAPTERS` in `journey.js` groups those into the ten rail chapters and their captions in `index.html`.
The frames come from the model project (`scripts/journey_build.py` builds the animation,
`scripts/journey_render_wire.py --style solid` renders the white-model frames). After re-rendering, replace the frames
and `journey.json` and bump `JOURNEY.ver` in `journey.js`.

## The exploded-view film

`assets/video/exploded-axo.mp4` (1080×1350, 20 s, a seamless loop) sits in the `#layers` section and plays only while
it is on screen (`data-inview`, handled in `main.js`). It is rendered in Blender from the model project
(`axo/redesign`: the exploded scene, then `encode_web_mp4.py` for the web-sized file and its poster and
`mp4_faststart.js` to put the index at the front of the file). The seven rows beside the film repeat the labels that
are part of the picture, so change both together; the labels inside the film are English only.
The same file also plays in the "Assembly film" card of the deliverables grid, shown whole (`.out-ex.film`) on the
film's own backdrop colour.

## The drawings

The plan section swaps eight drawings of the redesigned house (`assets/img/*-natural-v3.png`, 2160×1320, all at one
scale: 2048 px across 16.5 m): two plans, sections A–A and B–B and the four elevations, in a flat "natural
materials" look on a white sheet (`.plan-card` has the same white, so a swap never flashes). They come from the model
project: `drawings/build_views.py` renders each view in Blender's Workbench with one mask per category of object,
`drawings/compose_web.py --paper "#ffffff"` colours them (the ground plan is the one a Codex session made the same
way, re-sheeted). The sections and elevations are drawn without plants; the two plans keep theirs. On the upper-floor
plan the decks of the floor below appear as a dashed outline, traced from the ground plan's deck layer.
The caption in the card's corner comes from the `tags` array in `scroll.js`, one entry per row of `#planList`. The
room names inside the plans are English only.
Still in `assets/img/` and no longer referenced: the first set of these drawings on cream paper, with plants
(`*-natural.png`), and the earlier photoreal plans and sections (`plan-gf.png`, `plan-uf.png`, `sec-aa.png`,
`sec-bb.png`).

The cover of the "Interactive 3D" card (`assets/img/live-3d-cover.jpg`) is a capture of the viewer's own canvas
(`drawings/make_viewer_cover.py` trims and frames it); the card links up to `#explore`. It was captured from the
earlier model: plants, and the first export's colours.

## The room images

The rooms list (`#rooms`) shows eleven eye-level stills of the redesigned house, rendered in Cycles at 2048×1365
(`assets/img/*-mediterranean.webp`): entry, living, dining, kitchen, deck, stair, landing, main bedroom, ensuite,
studio office and roof terrace. They come from the model project: `scripts/room_stills_build.py` puts the house on
the landscape and daylight of the hero image and adds one level camera per row from `room-stills/cameras.json`
(1.48 m above the floor); `scripts/room_stills_render.py` renders them, and five of the ten on the page came from a
second batch with the same cameras (`realistic-renders/render_batch.py`; `room-stills/selected/sources.json` names
the source of each still); `scripts/room_stills_web.py` encodes the WebP files. `room-stills/README.md` in the model
project has the details. The main bedroom is the render the list already had, from the same model and light.
The row order follows the plans: ground floor, stair, upper floor. The plans also label a WC / laundry, a walk-in and
a bath, which have no row. Row names are the `room.N` keys. To change a view, edit its camera in `cameras.json`,
render that shot again and save it under a new file name.
The `hf-*.jpg` images these replaced are still in `assets/img/`.

## The 3D viewer

`#explore` shows `assets/models/house-redesigned-v2.glb` (7.4 MB, Draco), exported from the model project by
`web-model/export_glb_viewer_v2.py`. It is the house alone: no garden and no plants (potted plants and their pots,
the branches in the vases, the ivy planters and their training rails are left out; `axo.js` also skips those names at
load). Every material is one flat colour: the script measures each Blender material in Cycles (diffuse and glossy
colour, roughness, emission, and what it shows under plain white light) and writes that, because the procedural
shaders of the material library export with the library's default colour otherwise. The five materials that are a
plain UV-mapped image (the artworks, the book spines) keep their image. The measured table is
`web-model/house_redesigned_v2.materials.json`.

Inside and Plan cut the model at 2.5 m (ground floor) or 5.5 m (upper floor). Everything the cut slices gets a
closed top with a black edge: `axo.js` slices the meshes, rasterises the cut at 1 cm, closes the gaps between the
layers of a wall (cladding, container skin, lining) and draws fill and outline from a distance-field texture on one
plane at the cut height. Doors, cabinets and curtains keep their own outline; glass shows as a pale band. The cap is
built once per cut, for the state the viewer is easing towards, and stays while the view turns or zooms.
To change the look, edit `CAP` in `axo.js` (edge width, fill colour, how wide a gap is closed).

After exporting a new model: copy it to `assets/models/` under a new name, point `MODEL` in `main.js` at it and
bump the `axo.js` import version there.

## Cache busting

`?v=N` query strings on `site.css`, `main.js` and the module imports force reloads during development.
Bump them after edits, or drop them when hosting with proper cache headers.

## Dependencies (CDN)

GSAP + ScrollTrigger (cdnjs), Lenis (unpkg), Three.js (jsdelivr), Inter Tight and Heebo (Google Fonts).

## Known limitations

- The Hebrew copy is a draft and needs native review.
- The lifestyle images (`hf-*.jpg`), the clay / finished pair and the closing image are AI-assisted images of the
  house before its redesign. The page says so in the lifestyle label and in the note under the comparison; the closing
  image says it only in its alt text. The rooms list and the deliverables covers no longer use them: they show renders
  of the current model (the covers reuse `garden-front-`, `living-` and `stair-mediterranean.webp`).
- Three of the four isometric scenes are still in production; their cards are hidden by CSS until the clips exist.
- No form or analytics; the contact button is a mailto link.
