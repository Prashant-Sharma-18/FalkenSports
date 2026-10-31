"""Cut every sport icon out of the 3D icon sheet, with transparent backgrounds.

    python tools/cut_sport_icons.py

Reads design/sport-icons/sheet.png and writes:
  design/sport-icons/<name>.png   every icon, 256px, full colour (the library)
  src/assets/sports/<name>.png    the icons the app uses, 96px, 256-colour palette

Needs Python 3 with Pillow and NumPy.
"""
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SHEET = ROOT / "design" / "sport-icons" / "sheet.png"
LIBRARY = ROOT / "design" / "sport-icons"
APP = ROOT / "src" / "assets" / "sports"
LIBRARY_SIZE, APP_SIZE = 256, 96

# Tile boundaries measured from the sheet's empty gutters (pixels).
COLS = [(53, 332), (350, 610), (632, 922), (951, 1223), (1250, 1529), (1558, 1842), (1863, 2137), (2164, 2422), (2444, 2700)]
ROWS = [(51, 302), (338, 594), (644, 915), (951, 1223), (1251, 1500)]

# The sheet, row by row, left to right.
GRID = [
    ["basketball", "football", "american-football", "golf", "volleyball", "ice-hockey", "tennis", "swimming", "lacrosse"],
    ["cricket", "surfing", "baseball", "table-tennis", "badminton", "bowling", "darts", "curling", "softball"],
    ["golf-green", "archery", "snowboarding", "skateboarding", "skiing", "rowing", "kayaking", "figure-skating", "ultimate"],
    ["running", "gymnastics", "climbing", "rugby", "boxing", "fencing", "martial-arts", "high-jump", "diving"],
    ["weightlifting", "cycling", "billiards", "water-polo", "disc-sports", "triathlon", "mma", "f1", "motorsport"],
]

# The icons the app uses (see SPORT_ICONS in src/components/Icons.js).
APP_ICONS = ["football", "basketball", "cricket", "rugby", "american-football", "ice-hockey", "baseball", "lacrosse", "volleyball", "tennis", "f1", "motorsport", "golf", "mma"]

# Light objects whose edge is almost exactly the sheet colour, so the
# background would leak into them: circles (x, y, radius, in tile pixels)
# kept whole.
PROTECT = {
    "football": [(79, 168, 67)],
    "baseball": [(83, 87, 37)],
}

# Warm white objects (cloth, pins, feathers) too close to the cream for the
# usual match: the background is matched more tightly around them.
TOLERANCE = {
    "martial-arts": 12,
    "bowling": 12,
    "badminton": 12,
}

BG = np.array([250.0, 247.0, 242.0])  # the sheet's cream


def background_region(rgb, tolerance=46, saturation=26, warmth=3):
    """Pixels joined to the tile's edge through background-like colours:
    close to the sheet colour, nearly grey, and warm like the cream (red above
    blue) -- snow, ice and white cloth are cool, so they're left alone."""
    dist = np.sqrt(((rgb - BG) ** 2).sum(axis=2))
    sat = rgb.max(axis=2) - rgb.min(axis=2)
    warm = rgb[..., 0] - rgb[..., 2] >= warmth
    allowed = (dist < tolerance) & (sat < saturation) & warm
    region = np.zeros_like(allowed)
    region[0, :], region[-1, :], region[:, 0], region[:, -1] = (
        allowed[0, :], allowed[-1, :], allowed[:, 0], allowed[:, -1])
    while True:
        grown = region.copy()
        grown[1:, :] |= region[:-1, :]
        grown[:-1, :] |= region[1:, :]
        grown[:, 1:] |= region[:, :-1]
        grown[:, :-1] |= region[:, 1:]
        grown &= allowed
        if (grown == region).all():
            return region
        region = grown


def cut(sheet, name, row, col):
    (x0, x1), (y0, y1) = COLS[col], ROWS[row]
    rgb = sheet[y0:y1, x0:x1]
    region = background_region(rgb, tolerance=TOLERANCE.get(name, 46))
    for cx, cy, radius in PROTECT.get(name, []):
        yy, xx = np.ogrid[: region.shape[0], : region.shape[1]]
        region &= (xx - cx) ** 2 + (yy - cy) ** 2 > radius**2

    # In the background only shadows count (darker than the sheet), as a
    # softened, semi-transparent dark: near-zero opacity is just noise.
    shade = np.clip(((BG - rgb) / BG).max(axis=2), 0, 1)
    shade = np.clip((shade - 0.035) / 0.965, 0, 1) * 0.85
    alpha = np.where(region, shade, 1.0)
    rgba = np.dstack([np.where(region[..., None], 0, rgb), alpha * 255]).astype(np.uint8)

    # Trim to what's visible, pad a little, centre on a square.
    ys, xs = np.nonzero(alpha > 0.04)
    rgba = rgba[ys.min(): ys.max() + 1, xs.min(): xs.max() + 1]
    h, w = rgba.shape[:2]
    side = int(max(h, w) * 1.06)
    canvas = np.zeros((side, side, 4), np.uint8)
    canvas[(side - h) // 2:(side - h) // 2 + h, (side - w) // 2:(side - w) // 2 + w] = rgba
    return Image.fromarray(canvas, "RGBA")


def resized(icon, size):
    # Premultiplied alpha, so edges don't pick up dark fringes.
    return icon.convert("RGBa").resize((size, size), Image.LANCZOS).convert("RGBA")


def main():
    sheet = np.asarray(Image.open(SHEET).convert("RGB")).astype(float)
    APP.mkdir(parents=True, exist_ok=True)
    for row, names in enumerate(GRID):
        for col, name in enumerate(names):
            icon = cut(sheet, name, row, col)
            resized(icon, LIBRARY_SIZE).save(LIBRARY / f"{name}.png", optimize=True)
            if name in APP_ICONS:
                small = resized(icon, APP_SIZE).quantize(256, method=Image.FASTOCTREE, dither=Image.FLOYDSTEINBERG)
                small.save(APP / f"{name}.png", optimize=True)
            print(name)


if __name__ == "__main__":
    main()
