#!/usr/bin/env python3
"""Generates the app's icon files from the H.O.L.Y app-icon design.

    pip install pillow
    python3 apps/mobile/assets/brand/make-icons.py

Source: app-icon@2x.png (880x880, cream ring + note on green, drawn with
white rounded corners). Phones round the corners themselves, so the icon
files must be full squares: the cream glyph is extracted (keeping its
anti-aliased edges) and recomposed on the brand green.
"""
import math
from pathlib import Path

from PIL import Image

HERE = Path(__file__).parent
ASSETS = HERE.parent
GREEN = (0x16, 0x38, 0x2B)
CREAM = (0xF4, 0xF1, 0xE8)

src = Image.open(HERE / 'app-icon@2x.png').convert('RGB')
W = src.size[0]

# Alpha = how far each pixel goes from the green towards the cream; only
# inside the central disc, so the white corners are ignored.
mask = Image.new('L', src.size, 0)
mp, sp = mask.load(), src.load()
den = sum((c - g) ** 2 for c, g in zip(CREAM, GREEN))
for y in range(W):
    for x in range(W):
        if math.hypot(x - W / 2, y - W / 2) > W * 0.36:
            continue
        t = sum((p - g) * (c - g) for p, g, c in zip(sp[x, y], GREEN, CREAM)) / den
        mp[x, y] = max(0, min(255, round(t * 255)))
bbox = mask.getbbox()
glyph = mask.crop(bbox)
ring = (bbox[2] - bbox[0]) / W  # the ring's width in the original design


def compose(size, frac, fg=CREAM, transparent=False):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0) if transparent else GREEN + (255,))
    side = round(size * frac)
    layer = Image.new('RGBA', (side, side), fg + (255,))
    layer.putalpha(glyph.resize((side, side), Image.LANCZOS))
    img.alpha_composite(layer, ((size - side) // 2, (size - side) // 2))
    return img


compose(1024, ring).convert('RGB').save(ASSETS / 'icon.png')  # iOS / main
# Android adaptive icon: foreground inside the safe zone (66 of 108 dp).
compose(512, 0.56, transparent=True).save(ASSETS / 'android-icon-foreground.png')
Image.new('RGB', (512, 512), GREEN).save(ASSETS / 'android-icon-background.png')
compose(432, 0.56, fg=(255, 255, 255), transparent=True).save(ASSETS / 'android-icon-monochrome.png')
compose(1024, 0.62, transparent=True).save(ASSETS / 'splash-icon.png')  # background from app.json
compose(48, ring).convert('RGB').save(ASSETS / 'favicon.png')
print('icons written to', ASSETS)
