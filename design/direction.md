# Chemsisy: design direction

Phase 2 design checkpoint, 2026-10-23. The mocks in `design/mocks/` are real pages: they render PubChem 3D conformers with 3Dmol.js, and every highlighted atom set comes from RDKit SMARTS matching, not from drawing. Screenshots are in `design/shots/`.

## The idea in one line

A textbook figure you can turn in your hand. The molecule fills the page; around it, labels with leader lines and short captions, the way a well-set chemistry plate is annotated; beside it, a reading column with the note and its sources. Everything that is not the molecule is quiet: hairline rules, one accent, no shadows.

## References and what each one gives

| Reference | What I take |
|---|---|
| Textbook figures (a well-set organic or medicinal chemistry plate) | Labels sit in columns at the figure's edges with thin leader lines to the group, never on top of atoms. Focus by greying the context, not by painting the focus. Hydrogens on carbon hidden, polar hydrogens shown (they matter for hydrogen bonding). Every figure has a caption that says what is shown and where the coordinates come from. |
| Distill | The figure is the argument and the text sits next to it, not below a fold. Terms are defined in place (dotted underline, tooltip) instead of sending the reader away. Citations are visible at the point of the claim. A reading measure of about 62 characters in a serif. |
| Observable | Linked views: in the comparison, both viewers turn together and the second molecule is superimposed on the shared core, so the eye compares like with like. A plain table carries the same data as the picture. |
| Linear | Keyboard first: `/` focuses search, arrow keys rotate, `Tab` steps through groups, `Escape` closes. A strict 4 px grid, small radii, hairline borders, one accent used only for state (focus, selection, the open group). Nothing moves unless the user asked for it. |

## Type

- **Source Serif 4** (OFL) for reading: drug names, notes, figure captions. It has optical sizes (display cuts for the 40 px drug name, text cuts for 16 px notes), Greek (β renders as a real Greek letter, not a substitute), true subscript and superscript glyphs, and tabular figures.
- **IBM Plex Sans** (OFL) for the interface and the figure labels: tabular figures by default (ATC codes and values align), Greek, subscript glyphs, and a width axis for tight labels on iPad.
- Checked with fontTools against the full font files: both have β, α, subscript digits (₂), real minus (−), `subs`/`sinf`/`sups`; Commissioner was rejected for proportional-only digits, Newsreader and Spectral for missing Greek.
- Formulas use Unicode subscript digits (C₁₆H₁₉N₃O₅S) with an `aria-label` that reads them plainly.

**Scale** (px, line height in brackets): 12 (16) meta, 13 (18) labels and table text, 14 (20) interface, 16 (26) note body, 20 (28) section titles, 28 (36) page titles, 40 (44) drug name. Sentence case everywhere; no all-caps labels.

## Space and grid

4 px base: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64. Desktop: 32 px margins, figure column plus a 420 px reading column, 40 px gutter. iPad portrait: 24 px margins, one column; figure full width, then groups and note. Touch targets at least 44 px tall in lists.

## Colour

Atoms keep CPK colours (carbon grey, oxygen red, nitrogen blue, sulfur yellow, polar hydrogen white), tuned per theme so carbon reads on both. Context atoms use a pale version of the same colours, so oxygen still reads as oxygen while it recedes.

The interface palette is separate. Three options, all AA in light and dark (measured: text 6.0:1 or higher; strong borders 3.3:1 or higher):

| | Accent | Secondary | Ink | Background | Rule | Idea |
|---|---|---|---|---|---|---|
| **A. Phenolphthalein** (recommended) | #A8226A / dark #F07BB5 | #5C6A14 / #B9C76A | #1C2024 / #E6E9EC | #F7F8F8 / #141618 | #D5DADF / #30363C | The indicator that turns magenta at the endpoint. Magenta is a hue CPK leaves unused, so a highlight is never read as an element. |
| B. Sepia plate | #8A4A12 / #E3A469 | #46596A / #9DB2C4 | #1E1F21 / #E9E8E5 | #F8F8F7 / #151514 | #D8D9DB / #33332F | The brown of engraved atlas plates, steel second ink. Calm and bookish; the highlight carries less. |
| C. Notebook olive | #566500 / #C4D45C | #8C4A1E / #E2A47A | #1D201B / #E7EAE3 | #F7F8F6 / #141613 | #D6DAD2 / #30352C | Lab notebook ink with rust for differences. Olive sits between sulfur yellow and halogen green, which makes it riskier next to those atoms. |

None is purple (FSHNiSTA's #53057F), wardkit's blue or Wardread's teal, and none repeats the portfolio's group colours. I found no palette in the Passayge folder to compare against, so Passayge should avoid magenta if A is picked.

The secondary colour marks "only in one drug" in comparisons and is always paired with a dashed line, so it does not rely on colour alone.

## Component principles

- **Figure**: 1 px rule, 3 px radius, no shadow. The canvas is transparent over the surface colour. Tools sit inside the figure's lower edge; keyboard hints on the right.
- **Labels**: plain label text; the focused group adds a short serif caption. The leader starts with a 10 px horizontal stub, then runs straight to the group's centroid, ending in a dot; the focused group gets a ring. Labels are laid out in two edge columns, sorted by height so leaders do not cross, and the molecule is fitted and centred into the space between them. On narrow figures (comparison on iPad), labels move to rows above and below.
- **Orientation**: each molecule is turned to its principal axes so it reads wide, then the focused group is turned towards the reader. When a student picks another group, this turn is the one teaching motion (under 300 ms, skipped with reduced motion).
- **Groups list**: an accordion. One open group at a time; its note opens in place with sources, review status and "Suggest a correction". Groups without a note say "Note in preparation".
- **Review status**: a hollow dot with "Sourced, not yet reviewed" by default; a filled dot with "Reviewed by [name, role]" only when a real review happened.
- **Tooltips**: dark ink box, 3 px radius, 300 px wide, on hover, focus and tap; `Escape` closes; announced via `aria-describedby`. Shown open on "transpeptidase" in the dark desktop shot.
- **Comparison**: two linked viewers with one shared view fitted to both molecules; the second molecule superimposed on the shared core (Horn's method on the RDKit maximum common substructure). A table and a sourced "What the difference teaches" note follow.
- **Product information**: separated from the chemistry by a full-ink rule, says plainly that indications and doses live in the official text, links straight to the BASG or EMA document.
- **Copy**: plain verbs, sentence case, no selling. "For education. Not medical advice." on every drug and comparison screen.

## Screens delivered

| Screen | Desktop 1440 x 900 | iPad portrait 820 x 1180 |
|---|---|---|
| Drug with groups and open note | `drug-desktop-light.png`, `drug-desktop-dark.png` (tooltip open) | `drug-ipad-light.png`, `drug-ipad-dark.png` |
| Comparison | `compare-desktop-light.png`, `compare-desktop-dark.png` | `compare-ipad-light.png`, `compare-ipad-dark.png` |
| Palettes | `palettes.png` | |

## Things I would still change, and things the mocks taught

- The comparison figures carry more empty space than I like for elongated molecules; the app will size the figure height to the fitted molecule.
- Leader lines can cross a side chain when a group sits in the middle of the molecule. The app should try both sides and pick the one with fewer crossings.
- Shared-core search must run on heavy atoms only: with hydrogens it timed out at 5 s; without, 187 ms. Precomputed at build time for the starter set anyway.
- Phone width was not part of this checkpoint; the iPad layout collapses to one column there, with the label rows mode used for the single figure.
