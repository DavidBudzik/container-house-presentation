"""4:3 card image of a plan drawing: trim the white sheet to the drawing, add a small margin, pad to 4:3 with the
sheet's own white, resize, save WebP. Never overwrites.
  "<Blender 5.4>/python/bin/python.exe" -I tools/plan-card.py <src.png> <out.webp> [--width 1500] [--margin .035]
Made assets/img/plan-gf-natural-v4-card.webp (the Drawings card of the deliverables) from plan-gf-natural-v4.png."""
import sys
from pathlib import Path
sys.path.insert(0, r"C:\Users\bzikd\Documents\Codex\2026-11-12\use-the-revit-model-i-have\work\python_packages")
from PIL import Image, ImageChops

a = sys.argv[1:]
src, out = Path(a[0]), Path(a[1])
width = int(a[a.index('--width') + 1]) if '--width' in a else 1500
margin = float(a[a.index('--margin') + 1]) if '--margin' in a else .035
if out.exists():
    sys.exit(f'{out} exists: not overwriting')

im = Image.open(src).convert('RGB')
bg = Image.new('RGB', im.size, (255, 255, 255))
diff = ImageChops.difference(im, bg).convert('L').point(lambda v: 255 if v > 10 else 0)
x0, y0, x1, y1 = diff.getbbox()                       # the drawing, without the white sheet around it
w, h = x1 - x0, y1 - y0
m = round(max(w, h) * margin)
x0, y0, x1, y1 = x0 - m, y0 - m, x1 + m, y1 + m
w, h = x1 - x0, y1 - y0
if w / h > 4 / 3:                                     # too wide: add sheet above and below
    nh = round(w * 3 / 4); y0 -= (nh - h) // 2; h = nh
else:                                                  # too tall: add sheet left and right
    nw = round(h * 4 / 3); x0 -= (nw - w) // 2; w = nw
card = Image.new('RGB', (w, h), (255, 255, 255))
card.paste(im.crop((max(0, x0), max(0, y0), min(im.width, x0 + w), min(im.height, y0 + h))), (max(0, -x0), max(0, -y0)))
card = card.resize((width, round(width * 3 / 4)), Image.LANCZOS)
card.save(out, 'WEBP', quality=88, method=6)
print('drawing bbox', (x0 + m, y0, w, h), '->', card.size, out.stat().st_size, 'bytes')
