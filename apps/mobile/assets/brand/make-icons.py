#!/usr/bin/env python3
"""Generates the app's icon files and the in-app wordmark from the HOLY design.

    pip install pillow
    python3 apps/mobile/assets/brand/make-icons.py

Sources (this folder):
  app-icon.png  1024x1024, full square: cream ring + note on the brand colour
  wordmark.png  the HOLY wordmark on a transparent background

The brand colour is read from the icon's corner, so changing the design
only needs new source images.
"""
import math
from pathlib import Path

from PIL import Image

HERE = Path(__file__).parent
ASSETS = HERE.parent
CREAM = (0xF4, 0xF1, 0xE8)

src = Image.open(HERE / 'app-icon.png').convert('RGB')
W = src.size[0]
BRAND = src.getpixel((0, 0))  # #4A1942 in the current design
print('brand colour: #%02X%02X%02X' % BRAND)

# The glyph (ring + note) as an alpha mask: how far each pixel goes from the
# brand colour towards the cream, which keeps the anti-aliased edges.
mask = Image.new('L', src.size, 0)
mp, sp = mask.load(), src.load()
den = sum((c - b) ** 2 for c, b in zip(CREAM, BRAND))
for y in range(W):
    for x in range(W):
        if math.hypot(x - W / 2, y - W / 2) > W * 0.40:
            continue
        t = sum((p - b) * (c - b) for p, b, c in zip(sp[x, y], BRAND, CREAM)) / den
        mp[x, y] = max(0, min(255, round(t * 255)))
bbox = mask.getbbox()
glyph = mask.crop(bbox)
ring = (bbox[2] - bbox[0]) / W  # the ring's width in the design


def compose(size, frac, fg=CREAM, transparent=False):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0) if transparent else BRAND + (255,))
    side = round(size * frac)
    layer = Image.new('RGBA', (side, side), fg + (255,))
    layer.putalpha(glyph.resize((side, side), Image.LANCZOS))
    img.alpha_composite(layer, ((size - side) // 2, (size - side) // 2))
    return img


src.save(ASSETS / 'icon.png')  # already a full square: phones round the corners
# Android adaptive icon: foreground inside the safe zone (66 of 108 dp).
compose(512, 0.56, transparent=True).save(ASSETS / 'android-icon-foreground.png')
Image.new('RGB', (512, 512), BRAND).save(ASSETS / 'android-icon-background.png')
compose(432, 0.56, fg=(255, 255, 255), transparent=True).save(ASSETS / 'android-icon-monochrome.png')
compose(1024, 0.62, transparent=True).save(ASSETS / 'splash-icon.png')  # background colour from app.json
compose(48, ring).convert('RGB').save(ASSETS / 'favicon.png')

# In-app wordmark for the dark screens: the same shape, in the light text
# colour, cropped to the letters.
word = Image.open(HERE / 'wordmark.png').convert('RGBA')
alpha = word.getchannel('A')
light = Image.new('RGBA', word.size, (0xD1, 0xCD, 0xCC, 255))
light.putalpha(alpha)
light.crop(alpha.getbbox()).save(ASSETS / 'wordmark-light.png')
print('written to', ASSETS)
