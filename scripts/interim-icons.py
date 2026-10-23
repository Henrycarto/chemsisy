"""Interim app icons (a plain ring) until the Phase 5 identity icon replaces them."""
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "public" / "icons"
OUT.mkdir(parents=True, exist_ok=True)
INK, BG = (168, 34, 106, 255), (247, 248, 248, 255)


def ring(size, pad, maskable=False):
    s = size * 4
    im = Image.new("RGBA", (s, s), BG if maskable else (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    p = int(s * (0.22 if maskable else pad))
    d.ellipse([p, p, s - p, s - p], outline=INK, width=int(s * 0.09))
    return im.resize((size, size), Image.LANCZOS)


ring(192, 0.12).save(OUT / "icon-192.png")
ring(512, 0.12).save(OUT / "icon-512.png")
ring(512, 0, maskable=True).save(OUT / "icon-512-maskable.png")
ring(180, 0, maskable=True).save(OUT / "apple-touch-icon.png")
(OUT / "favicon.svg").write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="none" stroke="#a8226a" stroke-width="2.5"/></svg>\n')
print("interim icons written")
