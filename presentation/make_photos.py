"""Copy the recorded camera crops used on the box slide into plots/.

The small normal light boxes are enlarged with nearest-neighbour so every camera pixel
stays a crisp square. The glare box is used as recorded, it shows only the iPad glass.
"""
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
RES = HERE.parent / "experiments" / "results"
OUT = HERE / "plots"

SOURCES = {
    "photo-normal-3bps.png": ("monitor-room-comparison-20261030-180441-714350Z", 10, None),
    "photo-normal-8bps.png": ("final-comparison-20261031-150350-900428Z", 10, None),
    "photo-normal-4bps.png": ("full1b-lab-comparison-20261027-174408-573804Z", 10, None),
    "photo-glare-4bps.png": ("quiet1-lab-repetition-3-20261026-163304-310902Z", 1, None),
}

for name, (session, scale, crop) in SOURCES.items():
    im = Image.open(RES / session / "capture.png").convert("RGB")
    if crop:
        im = im.crop(crop)
    if scale > 1:
        im = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
    im.save(OUT / name)
    print(name, im.size)
