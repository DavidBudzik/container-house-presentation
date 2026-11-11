# Copies the high-fidelity Blender renders into assets/img/hf-<view>.jpg (and the matching clay into clay-<view>.jpg).
# Source priority per view: the Portra photographic set (AI finish over the 50° model cameras, clay-to-reality export),
# then the V12 graded golden-hour Cycles set, then the V3 1920 px Cycles set.
#   python3 tools/import-renders.py
import json, pathlib
from PIL import Image

SITE = pathlib.Path(__file__).resolve().parents[1]
CH = pathlib.Path('/Users/davidbudzik/Documents/arcviz-concepts/Container House/output')
SOURCES = [('portra', CH.parent / 'exports/clay-to-reality-viewer/assets/high-fi'), ('v12', CH / 'hifi-v12/final'), ('v3', CH / 'stills-updated-v3/images')]
CLAY = CH / 'hifi-v12/clay'
LINE = CH / 'hifi-v12/linework'
VIEWS = ['01-open-plan', '02-living', '03-dining', '04-kitchen', '05-entry', '06-stair', '07-main-bedroom',
         '08-guest-studio', '09-ensuite', '10-gallery', '11-deck-exterior', '12-upper-terrace', '13-reading-corner',
         '13-reading-people', '14-living-people', '15-dining-people', '16-terrace-people']
OUT = SITE / 'assets/img'

def save(src, dest):
    im = Image.open(src).convert('RGB')
    if im.width > 1920: im = im.resize((1920, round(im.height * 1920 / im.width)), Image.LANCZOS)
    im.save(dest, quality=86, optimize=True, progressive=True)
    return im.size

report = {}
for v in VIEWS:
    for tag, folder in SOURCES:
        f = next((p for p in (folder / f'{v}.png', folder / f'{v}.jpg') if p.exists()), None)
        if f:
            report[v] = {'source': tag, 'size': save(f, OUT / f'hf-{v}.jpg')}
            break
    c = CLAY / f'{v}.png'
    if c.exists():
        report.setdefault(v, {})['clay'] = save(c, OUT / f'clay-{v}.jpg')
for v in VIEWS:
    l = LINE / f'{v}.png'
    if l.exists():                                                   # neutral paper tone: drop Workbench's slight colour cast
        im = Image.open(l).convert('L').convert('RGB')
        if im.width > 1920: im = im.resize((1920, round(im.height * 1920 / im.width)), Image.LANCZOS)
        im.save(OUT / f'lw-{v}.jpg', quality=88, optimize=True, progressive=True)
        report.setdefault(v, {})['linework'] = im.size
(OUT / 'renders.json').write_text(json.dumps(report, indent=2))
for v in VIEWS: print(v, report.get(v, 'missing'))
