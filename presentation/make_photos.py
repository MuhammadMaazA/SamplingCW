"""Copy the real camera crops used on the 'patch the camera averages' slide into plots/.

The small facing and reflection patches are enlarged with nearest-neighbour so every
camera pixel stays a crisp square. The glare crops are used as recorded, with the right
edge of the laptop reflection trimmed off to leave only the screen.
"""
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
RES = HERE.parent / "experiments" / "results"
OUT = HERE / "plots"

SOURCES = {
    "photo-facing.png": ("final-comparison-20261031-150350-900428Z", 10, None),
    "photo-reflection.png": ("full1b-lab-comparison-20261027-174408-573804Z", 10, None),
    "photo-glare-ipad.png": ("quiet1c-lab-repetition-3-20261026-170042-409100Z", 1, None),
    "photo-glare-laptop.png": ("quiet1e-lab-repetition-3-20261026-171657-143340Z", 1, (0, 0, 335, 320)),
}

for name, (session, scale, crop) in SOURCES.items():
    im = Image.open(RES / session / "capture.png").convert("RGB")
    if crop:
        im = im.crop(crop)
    if scale > 1:
        im = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
    im.save(OUT / name)
    print(name, im.size)
