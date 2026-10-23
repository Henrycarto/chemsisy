"""Subset the variable fonts the app ships.

The prebuilt webfont packages drop subscript digits (U+2080 to U+2089), which
chemical formulas need, so the app ships its own subsets of the full Google
Fonts files (SIL Open Font Licence 1.1): Latin, Latin-1, Greek, punctuation,
super- and subscripts, arrows and the minus sign, with all OpenType features.

    python scripts/fonts.py
"""
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parent.parent
UNICODES = "U+0000-00FF,U+0131,U+0152-0153,U+02C6,U+02DA,U+02DC,U+0370-03FF,U+2000-206F,U+2070-209F,U+20AC,U+2122,U+2190-2199,U+21CC,U+2212,U+2215,U+2248,U+2260,U+2264-2265,U+00B7"
FONTS = [
    ("design/mocks/fonts/SourceSerif4.ttf", "src/fonts/source-serif-4.woff2"),
    ("data/cache/SourceSerif4-Italic.ttf", "src/fonts/source-serif-4-italic.woff2"),
    ("design/mocks/fonts/IBMPlexSans.ttf", "src/fonts/ibm-plex-sans.woff2"),
]
for src, out in FONTS:
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = ["*"]
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    f = subset.load_font(str(ROOT / src), opts)
    if "Italic" in src:
        # Italic only sets journal and book titles in citations: one static instance is enough.
        f = instancer.instantiateVariableFont(f, {"opsz": 14, "wght": 400})
    s = subset.Subsetter(opts)
    s.populate(unicodes=subset.parse_unicodes(UNICODES))
    s.subset(f)
    subset.save_font(f, str(ROOT / out), opts)
    print(out, (ROOT / out).stat().st_size // 1024, "KB")
