# Encodes an "Architectural Editorial" image set as WebP for assets/img.
#
# Each set is 16 AI-assisted editorial images of the redesigned house: each one was generated over a camera view of the
# model (see the folder's README.txt and "Edit notes/image-manifest.csv"). Tree placement and fine material detail are a
# generative interpretation, not a render, and the page labels them that way.
#   - "Architectural Editorial - Consistent v3" (default, on the page since 2026-11-15, the user: "use only images of
#     this set for the final website version"): the same 16 views regenerated with one colour reference. Suffix "-v3".
#   - "Architectural Editorial - Olive Grove v2" (on the page 2026-11-14 evening): --src <its folder> --suffix "".
#
#   "<Blender 5.4>/5.4/python/bin/python.exe" -I tools/import-editorial.py [--src <folder>] [--suffix -v3] [--force]
#
# Plain Python, no Blender process; Pillow comes from the Codex work folder, as in scripts/room_stills_web.py.
# Two kinds of output, named after the source file:
#   <stem>-editorial<suffix>.webp        from "Native edits/" at its native size (1536 px wide; v3 living 1670 px and
#                                        pergola 1672 px)
#   <stem>-editorial<suffix>-2560.webp   for full-bleed slots, from the 4K export scaled down to 2560 px. The 4K files are
#                                        bicubic enlargements of the native ones: this adds no detail, it only spares the
#                                        browser the upscale.
# Existing files are kept unless --force.
import sys
from pathlib import Path

CODEX = Path(r"C:\Users\bzikd\Documents\Codex\2026-11-12\use-the-revit-model-i-have")
sys.path.insert(0, str(CODEX / "work" / "python_packages"))
from PIL import Image

SITE = Path(__file__).resolve().parents[1]
argv = sys.argv[1:]
SRC = Path(argv[argv.index("--src") + 1]) if "--src" in argv else SITE.parent / "Architectural Editorial - Consistent v3"
SUFFIX = argv[argv.index("--suffix") + 1] if "--suffix" in argv else "-v3"
FORCE = "--force" in argv
OUT = SITE / "assets" / "img"

VIEWS = ["Living_Refined", "Mediterranean_Blue_Sky", "Pergola_Ivy", "deck_a", "deck_b", "dining_b", "ensuite_b", "ensuite_c",
         "entry_b", "entry_c", "kitchen_c", "landing_d", "landing_e", "office_b", "office_c", "stair_b"]
WIDE = ["Mediterranean_Blue_Sky", "Pergola_Ivy", "deck_b"]        # hero, full-width section, closing card


def web_name(view):
    return view.lower().replace("_", "-") + "-editorial" + SUFFIX


def save(im, dest, quality):
    if dest.exists() and not FORCE:
        print("exists, kept:", dest.name)
        return
    im.save(dest, "WEBP", quality=quality, method=6)
    print(f"{dest.name:48s} {im.width}x{im.height}  {dest.stat().st_size / 1024:.0f} KB")


for v in VIEWS:
    native = SRC / "Native edits" / f"{v}_editorial.png"
    if not native.exists():
        print("MISSING", native)
        continue
    save(Image.open(native).convert("RGB"), OUT / (web_name(v) + ".webp"), 88)
for v in WIDE:
    big = SRC / f"{v}_editorial_4K.png"
    if not big.exists():
        print("MISSING", big)
        continue
    im = Image.open(big).convert("RGB")
    save(im.resize((2560, round(im.height * 2560 / im.width)), Image.LANCZOS), OUT / (web_name(v) + "-2560.webp"), 84)
