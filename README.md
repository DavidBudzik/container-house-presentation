# BZIK — container house presentation

A one-page, bilingual (English / Hebrew) site for BZIK: David Budzik's 3D visualization and interactive presentation
work for architecture, real estate and construction. A five-container, two-storey concept house is the demonstration
project. The page shows it in several ways: drawings, an interactive 3D model, a finishes comparison, an exploded-view
film, room images, short walkthrough clips, a tablet and a phone running the live model as the sales tools it could
power, an ad film and scenes.

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
  explore.js      "Explore it yourself" viewer: orbit, modes, floors, build scrubber
  axo.js          Three.js model renderer used by the viewer
  tools.js        sales tools (#tools): the tablet and phone screens, both drawn by one WebGL renderer
assets/
  img/            renders, drawings and fallbacks
  models/         house-redesigned-v2.glb for the 3D viewer
  video/          the exploded-view film and its poster
  video/walk/     the walkthrough clips (hero, rooms, exterior, #work comparison) and their posters
  video/film/     #film: the 30 s case-study reel (on the page); "A Week, Slowly" (60 s, 30 s vertical) and the 60 s case-study film (off the page), with posters
  brand/          logo
tools/            dev helpers (render and editorial image import, fallback image capture)
```

Files the page no longer loads are not kept in the repo. On 2026-11-16 the last of them (the frames of the previous
journey, earlier renders and drawings, an earlier 3D model, the assembly and terrace films) moved to
`../archive/previous-project-files/bzik-site-unused/` beside this folder, under the same paths; the git history still
has them (up to `c39d1e7`).

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
  under the deliverables, as work developed per project. The `#tools` section shows the tablet and phone tools the
  same way: its label says "developed per project" and its note calls the app screens a concept, while the model on
  them is live.

## The walkthrough clips

The scroll-driven journey (white model assembling, then one camera walking through the house) was taken off the page
on 2026-11-14; `journey.js` and its frame folders are in `archive/previous-project-files/bzik-site-unused/` of the
model project. Its camera path lives on as short clips in `assets/video/walk/`, each 3–6 s played forward then back so
the loop never jumps:

- `hero-entry` behind the hero: the walk in from the garden through the front door, the same moment as `room-entry`
  but cut at 1080p (Gemini V02, 9.5–13.6 s). It replaced the `hero-aerial` loop on 2026-11-14; that file stays in the
  folder, unused. `exterior-roof` plays in the full-width exterior section. Both are `data-bg`: hidden with reduced
  motion, so the image under them shows.
- `room-*` in the rooms list: one `<video class="room-clip" data-room="n">` per room (n = row index; Deck and Ensuite
  have none). `scroll.js` fades the selected room's clip in over its still once it is playing, only while the list is
  on screen.
- `compare-kitchen-stair` in `#work`: ONE video with the plain model on top and the film below, drawn into
  `#mtCanvas` on either side of the divider by `main.js`, so the two halves cannot drift apart.
- `room-stair` again in the "Walkthrough film" card of the deliverables.

The clips are AI-finished: Higgsfield (Gemini Omni Flash 1.2, edit mode) over white-model renders of the redesigned
house on a retimed, calmer camera path. Everything is in the model project: `journey-higgsfield/` (sources, clips,
checks), `scripts/journey_timewarp.py`, `scripts/web_loop.py` (cuts a loop and its poster) and
`axo/redesign/mp4_faststart.js` (moves the index to the front of the file).

## The exploded-view film

`assets/video/exploded-axo.mp4` (1080×1350, 20 s, a seamless loop) sits in the `#layers` section and plays only while
it is on screen (`data-inview`, handled in `main.js`). It is rendered in Blender from the model project
(`axo/redesign`: the exploded scene, then `encode_web_mp4.py` for the web-sized file and its poster and
`mp4_faststart.js` to put the index at the front of the file). The seven rows beside the film repeat the labels that
are part of the picture, so change both together; the labels inside the film are English only.
The same file also plays in the "Assembly film" card of the deliverables grid, shown whole (`.out-ex.film`) on the
film's own backdrop colour.

## The ad film

**On the page now (2026-11-15, user: "i want to add this video to the website"): `#film` with the 30 s case-study reel
only**, after `#tools`. One row on the 256 : 81 grid: the silent 16:9 card (`case-study-reel-30s.mp4`, the web copy of
`Cinematic Concepts/Case Study Reel/reel/out/Container_House_Case_Study_Reel_30s_v3_web.mp4`, x264 CRF 23, moov first,
20 MB; poster `case-study-reel-30s.jpg` 1920×1080) and its text in the narrow column. The text comes first in the
markup, so the heading (the section's `h2`, `film.rt`) is read before the film and sits above it under 1201 px; from
1201 px the grid places it beside the card at h3 size. The keys `film.r*` hold the 30 s wording again (EN in the markup,
HE draft in `i18n.js`); the caption's "30 s · 16:9" is an LTR isolate so it stays in order on the Hebrew page.
Click to play only (`films()`), checked at 375, 1440 and 2560 px.

**The ad film and the 60 s case-study film stay off the page** (user: "remove this section for now", then "Keep it
off"): their markup is kept in `../archive/previous-project-files/bzik-site-unused/film-section.removed-2026-11-15.html`
(that file still shows the 60 s reel in the second row); `films()`, the CSS and the `film.*` keys stay in place. What
follows describes the section as it is in that file.

The `#film` section (after the sales tools) shows "A Week, Slowly", a story film cut from the AI-generated clips in the
model project's `Cinematic Concepts/` to an original score: the 60 s 16:9 cut beside its 30 s 9:16 cutdown, the two
cards equal in height (columns 256 : 81). Unlike every other video on the page they never start on their own: a click
on the pill plays with sound and native controls, starting one pauses the other, a film pauses when it leaves the
screen and the poster returns after the end (`films()` in `main.js`). On phones the pill shows only the icon and the
length.

The files are web copies of the masters in `Cinematic Concepts/Ad Film/` (where the screenplay, all four versions
and the build scripts live): `a-week-slowly-60s.mp4` 1920×1080, CRF 26, AAC 192 kbps (38 MB) and
`a-week-slowly-30s-vertical.mp4` 720×1280 (12 MB), both made with `Ad Film/build/encode.py --crf LOW|MEDIUM --size
--abr 192` and `mp4_faststart.js`. Each poster is the title card decoded from its own web file, so the first frame
matches. The 60 s 9:16 and 30 s 16:9 versions are not on the page.

Below the ad film, on the same 256 : 81 grid, the 60 s case-study film (`.film-reel`: the 16:9 card, its heading and
text in the narrow column; keys `film.r*`). It has no sound, so its pill says "Play". `case-study-reel-60s.mp4` is
the web copy of `Cinematic Concepts/Case Study Reel/reel/out/Container_House_Case_Study_Reel_60s_pro_v4_web.mp4`
(1920×1080, 30 fps, x264 CRF 24, moov first, 30 MB; Remotion project and README in that folder); the poster is its
frame at 1.5 s. `films()` picks it up like the other two cards. It replaced the 30 s reel the same day (user:
"Replace the 30 s"); the 30 s files moved to `../archive/previous-project-files/bzik-site-unused/assets/video/film/`
and came back to `assets/video/film/` when the 30 s reel returned to the page on its own (see the top of this section).

## The drawings

The plan section swaps six drawings of the redesigned house (curated from twelve, user 2026-11-15: "too many views,
lets kee curate 6 max"): both plans, section B–B, the south elevation, the isometric view from the south-east and the
same view with the ground floor cut away (the two isometric views share one frame, so a swap opens the house in
place). They are drawn in the "Ink Clean" look (user, 2026-11-15: "I meant Ink Clean"): the ink drawing set of 11 Nov
in `Container House Looks`, without plants or ground, as its unfinished "Ink Clean" variant was meant to be, but drawn
from the redesigned house (that set and its two Ink Clean tests show the house before the redesign): black Freestyle
lines, every cut face solid ink, the floors' own patterns (parquet, tiles, deck boards) in a lighter line, glass a
warm light grey, a faint shade, room names in Courier. Files `assets/img/*-ink-clean.webp` (2160×1320, WebP q90; the
plans, section and elevation at one scale, 2048 px across 16.5 m). They come from the model project:
`drawings/build_views.py --lines` (Workbench masks and shade, plus Freestyle lines at 2× in Cycles, 1 sample, on a flat
white override; plans and sections are really cut, as the 11 Nov exporter did) into `drawings/views_v5`, then
`drawings/compose_ink.py` into `drawings/web_ink_v1` (all twelve views exist there). On the upper-floor plan the decks
of the floor below appear as a dashed outline, traced from the ground plan's deck layer. The cut-away views slice
everything that crosses the cut; curves that cross it (the rainwater downpipes) are left out.
The same views in the earlier "natural materials" look are unused: `*-natural-v4.png` (plans without plants and the
four isometric views, from `drawings/compose_web.py`) stays in the local folder but not in the repo; `*-natural-v3.png`
(sections, elevations and the plans with plants) moved to the archive on 2026-11-16.
The caption in the card's corner comes from the `tags` array in `scroll.js`, one entry per row of `#planList`. The
room names inside the plans are English only.
No longer referenced either: the first set of these drawings on cream paper, with plants (`*-natural.png`, local
folder only), and the earlier photoreal plans and sections (`plan-gf.png`, `plan-uf.png`, `sec-aa.png`, `sec-bb.png`),
which moved to the archive on 2026-11-16.

The cover of the "Interactive 3D" card (`assets/img/live-3d-cover.jpg`) is a capture of the viewer's own canvas
(`drawings/make_viewer_cover.py` trims and frames it); the card links up to `#explore`. It was captured from the
earlier model: plants, and the first export's colours.

The "Drawings" card of the deliverables shows `assets/img/plan-gf-natural-v4-card.webp`: the v4 ground plan (the set
with the furniture fixed and no plants) trimmed to the drawing and set on its own white sheet at the card's 4:3 by
`tools/plan-card.py` (user, 2026-11-15: "replace to fixed furniture set similar image"). It replaced
`plan-gf-pastel-rooms.webp` (rooms in pastel colours, rough furniture), which stays in `assets/img/`. A light grey
hairline (`.out-ex.sheet`) keeps its edge on the white page, as one does round the film card in `#film`.

## The finishes comparison

`#finishes` (`js/compare.js`) splits the south elevation between the house as designed and one of four illustrative
palettes. Since 2026-11-15 these are Cycles renders of the model, not drawings (user: "realistic views 2d front camera
angle ... without the bg"): `assets/img/finish-south-{designed,charcoal,olive,terracotta,sand}-photo.webp`, 2160×1350,
transparent outside the house, pixel-registered with each other and with the drawn south elevation (same orthographic
camera as `drawings/build_views.py` Elev_South). Made by `drawings/render_finishes_cycles.py` (per-palette shader edits
on the exterior cladding, oak panels and pergola timber; SW sun; neutral sky in reflections) and
`drawings/compose_finishes_photo.py --ground` (masters in `drawings/finishes_cycles_v1`, web copies in
`drawings/web_finishes_photo_v1`). Because the images are transparent, `.cmp-top` carries the card colour so the
selected finish never blends with the as-designed image under it. The drawn versions (`finish-south-*.webp`) moved to
the archive on 2026-11-16.

## The room images

The rooms list (`#rooms`) has eleven rows: entry, living, dining, kitchen, deck, stair, landing, main bedroom,
ensuite, studio office and roof terrace. Nine show editorial images (next section). The editorial set has no view of
the main bedroom or the roof terrace, so since 2026-11-15 those two rows use the first frame of their own walkthrough
clip as the still (`assets/video/walk/room-bedroom.jpg`, `room-terrace.jpg`, 1280×720) and are shown by the clip only:
the user asked for the final page to use no photograph from outside the set. Until then they showed Cycles renders of
the redesigned house at 2048×1365 (`assets/img/*-mediterranean.webp`). Renders exist for all eleven rows; they moved to
the archive on 2026-11-16. They come from the model project: `scripts/room_stills_build.py` puts the house on
the landscape and daylight of the hero image and adds one level camera per row from `room-stills/cameras.json`
(1.48 m above the floor); `scripts/room_stills_render.py` renders them, and five of the ten on the page came from a
second batch with the same cameras (`realistic-renders/render_batch.py`; `room-stills/selected/sources.json` names
the source of each still); `scripts/room_stills_web.py` encodes the WebP files. `room-stills/README.md` in the model
project has the details. The main bedroom is the render the list already had, from the same model and light.
The row order follows the plans: ground floor, stair, upper floor. The plans also label a WC / laundry, a walk-in and
a bath, which have no row. Row names are the `room.N` keys. To change a view, edit its camera in `cameras.json`,
render that shot again and save it under a new file name.
The `hf-*.jpg` images they replaced moved to the archive on 2026-11-16.

## The editorial images

Every photograph on the page comes from `Architectural Editorial - Consistent v3` in the model project (since
2026-11-15; the user: "use only images of this set for the final website version"): 16 AI-assisted editorial images,
each one generated over a camera view of the model. They are the 16 views of the earlier Olive Grove v2 set,
regenerated with the dining room as one shared colour reference: warm-neutral daylight, warm-white plaster, restrained
oak, silver-green olives, and the entry mirror now shows the white steel stair. The folder's `README.txt` and
`Edit notes/` (`image-manifest.csv`, `CONSISTENCY-REVIEW.txt`) record the source render and the prompt of each. Tree
placement and fine detail are a generative interpretation, so the page labels these images "AI-assisted" in each
section's label, note or caption. The `Evening party` subfolder next to them is not part of the set the user sent
(it is missing from the set's zip) and is not used.

`tools/import-editorial.py` encodes them: `<view>-editorial-v3.webp` at native size (1536 px; living room 1670 px,
pergola 1672 px), and for the three full-bleed images also `-v3-2560.webp` from the 4K exports, with the native file
as the smaller `srcset` entry. The 4K exports are bicubic enlargements, so 1536 px is the real detail.

| Slot | Image |
| --- | --- |
| hero | `mediterranean-blue-sky` |
| exterior section | `pergola-ivy` |
| rooms list | `entry-b`, `living-refined`, `dining-b`, `kitchen-c`, `deck-a`, `stair-b`, `landing-d`, `ensuite-c`, `office-c` |
| deliverables covers 02 / 03 | `pergola-ivy`, `living-refined` (card 06 plays the stair clip) |
| closing card | `deck-b` |

`entry-c`, `office-b`, `ensuite-b` and `landing-e` were the four Lifestyle tiles; that section made way for the sales
tools on 2026-11-15, and the four files stay in `assets/img/`, unused.

The hero, the exterior section and nine of the rooms play a walkthrough clip over their still (see "The walkthrough
clips"). The clips were finished with the Olive Grove v2 images as reference, before v3 existed. The images they
replaced are off the page: the Olive Grove v2 files (`<view>-editorial.webp`,
`-editorial-2560.webp`, made by the same script with `--src "…/Architectural Editorial - Olive Grove v2" --suffix ""`),
which stay in the local folder but not in the repo; the `*-mediterranean.webp` renders, `hf-*.jpg`, `ed-l0*.jpg`
and `clay-*.jpg` moved to the archive on 2026-11-16.

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
closed top with a hairline edge (1.25 CSS pixels at any zoom), and cut walls carry a diagonal hatch: `axo.js` slices
the meshes, rasterises the cut at 1 cm, closes the gaps between the layers of a wall (cladding, container skin,
lining) and draws fill, hatch and outline from a signed-distance texture on one plane at the cut height. The hatch
lies on that plane, 45° to the walls and 10 cm apart, so it turns with the model: in Plan it is the usual plan hatch,
in 3D its angle on screen changes as the view turns, and zoomed far out, where its lines would come closer than about
3 pixels, it becomes an even grey. Doors, cabinets and curtains keep their own outline and no hatch; glass shows as a
pale band. The cap is built once per cut, for the state the viewer is easing towards (and again once the model has
loaded), and stays while the view turns or zooms. To change the look, edit `CAP` in `axo.js` (outline width, hatch
spacing, width and strength, fill colour, how wide a gap is closed).

After exporting a new model: copy it to `assets/models/` under a new name, point `MODEL` in `main.js` at it and
bump the `axo.js` import version there. Point `MODEL` in `js/tools.js` at the same file, so the browser downloads it
once.

## The sales tools section

`#tools` (after `#rooms`, before `#film`) shows what the model can become for a seller: a tablet presenter for
meetings in the sales office and the link a buyer opens on a phone afterwards. It took the place of the Lifestyle
section (`#life`, four AI-assisted editorial tiles) on 2026-11-15, the user's choice. The removed markup, its CSS and
its Hebrew keys (`gal.*`) are in git (`8ce4699`) and in `archive/previous-project-files/bzik-site-unused/lifestyle-section.html`
of the model project. (For a moment the same day it stood in for `#scenes` instead; that section is back as it was,
and `scenes-section.html` beside it holds the copy made then.)

- **The devices** are drawn in CSS. The first block ("tools") builds them in full (metal band, keys, camera, sheen,
  studio sweep); the block "tools, minimal mockups" at the end of `site.css` overrides that with the look the user
  chose: flat black bodies, one soft shadow, the tablet and the phone side by side, the tablet set higher. Corners are
  one outer radius per device (`--r`, in `cqw` of that device) and the screen's corner is `--r` less the bezel (`--bez`),
  so the curves stay concentric at any size; tablet 3.2 / 2.2, phone 10.5 / 2.6 `cqw`. A 100 × 58 artboard (`--k`,
  100 × 128 under 760 px) scales to fit the stage; inside a device `cqw` is 1 % of its width; inside a screen `--u` is
  one point of the app's own layout (1194 × 834 on the tablet, 393 × 852 on the phone), so the app scales with its
  device like a picture.
- **Callouts**: four notification-style cards around the devices (send it to the buyer, drag to turn, open the floors,
  try a finish; keys `tl.c1t` … `tl.c4b`), placed in artboard units (block "callouts" in `site.css`). `callouts()` in
  `tools.js` draws a thin ink arrow from each card to its live target (`ARROWS`: the Send button and the top of the
  phone, the model, the floors switch, the swatches), so the arrows follow the layout; it redraws on resize, on a
  language switch and once the fonts are in. In Hebrew the app mirrors, so the two cards under the tablet trade places
  and the send arrow reaches across to the button. Since 2026-11-15 (user: "only straight orthogonal lines") the
  leaders are orthogonal only (`route()`): one straight line when card and target share a band of x or y, else one
  square elbow out of the side facing the target; an `ARROWS` entry may force the first axis per language with
  `first: ['h' | 'v', ...]`. The icon tiles take `--note-ico` (terracotta `#C8502A`, set on `.tl-notes`). The cards rise and the arrows draw once the devices have settled
  (class `.npre` lifted 1.4 s after `.in`). Hidden at 1200 px and below, where the hint pill and the three notes under
  the stage say the same.
- **The 3D**: `js/tools.js` loads the viewer's GLB once (about 1.5 screens before the section arrives), merges it per
  level, part and material (about 125 draw calls), and renders the tablet view and the phone view into two regions of
  one offscreen canvas, then copies each into its screen's 2D canvas. Each screen has its own camera (drag, arrow
  keys, momentum, then a slow turntable). Sun shadows are drawn only when the geometry moves. The build is cut into
  slices of about 10 ms so it never stalls scrolling. A device that cannot keep up gets fewer pixels.
- **Finishes** are the four illustrative palettes of `#finishes` (`drawings/compose_finishes.py`), put on the model's
  own parts by Blender object name (`ROLES` in `tools.js`): exterior walls and the white steel surrounds, the roof
  fascia, the pergola fins, the deck and the exterior oak accents. The swatch shows the palette colour; the model gets
  it at 80 %, because the sun lifts it.
- **Floors apart** lifts the upper floor 3.1 m and the roof 5.7 m and cuts each floor just below its ceiling (2.9 and
  5.8 m above the model's zero), so both floors open to the camera; the pergola, the deck and the terrace shade are
  never cut. Some upper-floor furniture is tagged as ground level in the GLB, so a part's level is also taken from
  where it really starts (from 3.3 m up = upper floor, from 6.15 m = roof).
- **Send to buyer** shows the phone's notification and turns the phone to the tablet's angle. The link also arrives
  once by itself, 1.6 s after the devices first come into view. Finish and floors are shared by both screens; the
  phone's swatches work too. Under 760 px the same controls also sit under the stage at thumb size.
- **Stills**: `assets/img/tools-tablet.webp` and `tools-phone.webp` are each screen's first frame, rendered by the page
  itself at 2× (1440 × 900 window, default angles, as designed). They show until the model is in and stay where WebGL
  is missing. Render them again after changing the model, the cameras (`data-az`, `data-el`, `data-fov`, `data-fit`,
  `data-lift` on each `.scr`) or the light.
- **Testing**: `?toolsdebug` starts the 3D at once (in a hidden preview pane no observer and no animation frame ever
  fires) and exposes `window.__tools` (`render()`, `frame(t)`, `scale(s)`, the views and the state).

Measured on this machine (2026-11-15): loading and decoding 0.7–1.2 s, building 0.4 s of work, one frame of both
screens at 2× 3.8 ms.

## Cache busting

`?v=N` query strings on `site.css`, `main.js` and the module imports force reloads during development.
Bump them after edits, or drop them when hosting with proper cache headers.

## Dependencies (CDN)

GSAP + ScrollTrigger (cdnjs), Lenis (unpkg), Three.js (jsdelivr), Inter Tight and Heebo (Google Fonts).

## Known limitations

- The Hebrew copy is a draft and needs native review.
- Every photograph on the page is an AI-assisted editorial image (see "The editorial images"): the garden, furniture
  and small details are illustrative, and each section says so. Straight from the model: the drawings, the finish
  elevations, the 3D viewer, the exploded film and the model half of the `#work` comparison. The walkthrough clips are
  AI-finished over the model's camera path.
- Three of the four isometric scenes are still in production; their cards are hidden by CSS until the clips exist.
- The app screens in `#tools` are a concept: the finish swatches, the floors switch and "Send to buyer" work; the
  phone's "Ask the sales team" button and the status bars are pictures.
- The ad film's music is an original score composed for it in code; it has not had a listening check yet.
- No form or analytics; the contact button is a mailto link.
