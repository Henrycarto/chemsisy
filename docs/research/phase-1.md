# Chemsisy: Phase 1 research

Date: 2026-10-23. No code written. Measurements were taken locally (npm tarballs, Node, curl) unless a link is given.

## 1. Viewer: Mol*, 3Dmol.js, NGL

| | Mol* (molstar 5.13.1) | 3Dmol.js (2.5.5) | NGL (2.5.0) |
|---|---|---|---|
| Licence | MIT | BSD-3-Clause | MIT |
| Size, gzipped | 1.50 MB (prebuilt viewer); plugin core still several hundred KB after tree shaking | 157 KB (`3Dmol-min.js`) | 232 KB (`ngl.esm.js`) |
| Activity | Very active (release 2026-10-08) | Active (2026-05-22) | Slow: 2.4.0 in 2024-09, 2.5.0 in 2026-09 |
| Built for | Macromolecules, cryo-EM, huge assemblies | Small molecules and proteins, embedding | Proteins, trajectories |
| Atom-set highlight | Yes, via selection queries and overpaint; verbose API | `setStyle({serial:[...]}, ...)`, one line | Selection strings, fine |
| Label with leader line | Built-in labels, no leader lines | `addLabel` (no leader lines), plus `modelToScreen()` and `setViewChangeCallback()` to drive our own SVG overlay | Built-in labels, screen projection possible but less direct |
| Two synced viewers | Possible, manual | `linkViewer()` built in | Manual |
| iPad / phone | Heavy initial parse; fine once loaded | Light; WebGL renderer with touch rotate and pinch | Fine; Safari quirks reported historically |

**Recommendation: 3Dmol.js.** It is the smallest, the licence is permissive, small molecules are its home ground, and two methods decide it: `modelToScreen()` plus `setViewChangeCallback()` let us draw textbook-style labels in an SVG layer that follows the molecule as it rotates (label, leader line to the group centroid, caption), and `linkViewer()` gives the side-by-side comparison synced rotation for free. Mol* is the better tool for proteins and would be ten times the payload for no gain here. Wrapped in a thin React component; no hand-built Three.js.

## 2. Chemistry engine: RDKit.js

- `@rdkit/rdkit` 2026.9.1, BSD-3-Clause. `RDKit_minimal.wasm` is 7.4 MB raw, **2.4 MB gzipped**, plus a 107 KB JS loader.
- Tested in Node: init in 316 ms on this laptop. `get_qmol(smarts)` plus `get_substruct_matches()` returns atom indices. Checked against aspirin, amoxicillin, atorvastatin, pantoprazole and paracetamol: carboxylic acid, ester, β-lactam, phenol, amide, sulfoxide, benzimidazole, aryl fluoride and H-bond donors all matched as expected, with no false hits in that sample.
- `get_mcs_as_smarts()` / `get_mcs_as_json()` exist, which gives the shared-scaffold highlight for comparisons (aspirin vs paracetamol returned the aryl-oxygen core).
- Caveat: RDKit does not perceive aromaticity in SMARTS queries, so patterns must be written in aromatic form (`c`, `n`). Phase 4 tests will pin this.

**Keeping it fast.** The starter set does not need RDKit at runtime: group matches and comparison scaffolds for the bundled drugs are precomputed at build time with the same RDKit.js version and shipped as JSON. The wasm is lazy-loaded in a Web Worker only for live lookups (a drug outside the starter set) or an ad hoc comparison, and the service worker caches it after first use. First load stays small on school Wi-Fi.

## 3. Data and licences

**PubChem PUG REST.** NCBI states that data it creates is public domain and asks for acknowledgement; contributed records can carry their depositors' terms ([NLM copyright and data terms](https://www.nlm.nih.gov/databases/download.html)). Structures, identifiers and computed 3D conformers are produced by PubChem, so bundling them is fine with attribution. We do not copy depositor text (for example DrugBank descriptions shown in PubChem). The API answers with `Access-Control-Allow-Origin: *`, so browser live lookups work; the documented limit is 5 requests per second ([programmatic access](https://pubchem.ncbi.nlm.nih.gov/docs/programmatic-access)). 3D conformers exist for 34 of the 37 candidates below; clarithromycin, azithromycin and dabigatran etexilate have none (PubChem skips molecules over 50 heavy atoms). For those we generate a conformer at build time with RDKit (ETKDG plus MMFF), seeded and reproducible.

**Wikidata (CC0).** Tested the 10 Austrian brands:

| Brand | Wikidata | PubChem synonym | Substance | ATC |
|---|---|---|---|---|
| Thrombo ASS | no | no | acetylsalicylic acid | B01AC06 |
| Parkemed | no | yes (CID 4044) | mefenamic acid | M01AG01 |
| Mexalen | no | yes (CID 1983) | paracetamol | N02BE01 |
| Voltaren | yes (product item with active ingredient) | yes, salt CID 5018304 | diclofenac | M01AB05 |
| Seractil | yes (alias) | yes (CID 39912) | dexibuprofen | M01AE14 |
| Novalgin | yes (alias on metamizole sodium) | yes, salt CID 522325 | metamizole | N02BB02 |
| Aspirin | yes (trade-name item) | yes (CID 2244) | acetylsalicylic acid | N02BA01, B01AC06 |
| Sortis | no | yes (CID 60823) | atorvastatin | C10AA05 |
| Pantoloc | yes (alias) | yes (CID 4679) | pantoprazole | A02BC02 |
| Amoxilan | no | no | amoxicillin (unconfirmed for Austria) | J01CA04 |

Result: Wikidata alone resolves 5 of 10, PubChem synonyms 8 of 10, both together 9 of 10. Salts must be mapped to the parent compound. **So brand names come from a curated, bundled `brands.json`** (brand, substance, BASG authorisation number), with Wikidata and PubChem as an optional live fallback for brands not in the file. Substance to ATC via Wikidata worked for 34 of 37 candidates; gaps and stale codes exist (empagliflozin still carries the retired A10BX12 next to A10BK03), so every ATC code in the starter set is reviewed by hand.

**WHO ATC index.** The WHOCC terms say: "Copying and distribution for commercial purposes is not allowed. Changing or manipulating the material is not allowed." and require a reference to the centre ([WHOCC copyright](https://atcddd.fhi.no/copyright_disclaimer/)). An MIT-licensed project can be used commercially by anyone, so we must not bundle the index (names, hierarchy, DDDs). Instead: ATC codes per substance from Wikidata (CC0), group headings we write ourselves at the level students need (A02, B01, C09 and so on), and a link to the WHOCC search page for the official hierarchy.

**Product information links.**
- EMA EPAR, for centrally authorised medicines: `https://www.ema.europa.eu/en/medicines/human/EPAR/<name>` (checked live: Eliquis, Xarelto, Januvia). EMA also publishes a nightly "Download medicine data" table we can use to verify slugs.
- BASG, for national authorisations (most of the classic drugs here): the old register now redirects to Medikamente Info Austria. The document link `https://aspregister.basg.gv.at/document/servlet?action=show&zulnr=<number>&type=DOTC_FACH_INFO` redirects to `https://medikamente.basg.gv.at/documents/<number>__DOTC_FACH_INFO.pdf` and returns the SmPC PDF (checked live). BASG's usage notes explicitly allow direct document links, offer no public API, and ask that exports stay at about one per day ([Nutzungshinweise](https://www.basg.gv.at/fuer-unternehmen/online-service/nutzungshinweise)). The portal has an internal API used by its own front end; we do not call it. Authorisation numbers are collected by hand from the public portal and stored in `brands.json`.

**ChEBI.** CC BY 4.0 ([ChEBI](https://www.ebi.ac.uk/chebi/aboutChebiForward.do)). Role annotations ("cyclooxygenase inhibitor", "prodrug") are citable sources for notes. ChEBI IDs are available for all 37 candidates via Wikidata.

## 4. Explanations: note format

One note per functional group per drug, stored as data next to the drug:

```yaml
drug: amoxicillin
group: beta-lactam            # id of the SMARTS rule that found it
atoms: [8, 9, 10, 11]         # filled by the build from the rule, never by hand
title: β-lactam ring
caption: The strained four-membered amide that acylates bacterial transpeptidases.   # max ~90 chars, shown on the figure
body: >
  Two to four sentences in our own words. No indications, doses or side effects.
sources:
  - type: textbook | review | chebi | pubchem
    citation: OpenStax, Pharmacology for Nurses, section ...
    url: https://...
    licence: CC BY 4.0
reviewed: false               # true only after a second person checks it
```

Rules: every note has at least one source; text is written fresh, never pasted (so the source licence does not bind our wording); a note without a source is not shipped and the group shows only its name.

Source pool: OpenStax *Pharmacology for Nurses* (CC BY 4.0) and *Organic Chemistry* (OpenStax), LibreTexts chemistry books (licence varies per book, checked per citation), ChEBI roles (CC BY 4.0), PubChem computed descriptors, and open-access review articles for mechanisms.

**Flagged, hard to source cleanly:**
- Metamizole: the mechanism is not fully established; the note must say so rather than pick a theory.
- Mefenamic acid: the fenamate-specific binding story is mostly in paywalled medicinal chemistry texts; needs an open review.
- Enantiomer notes (dexibuprofen vs ibuprofen, esomeprazole vs omeprazole): the chiral inversion and metabolism points need a review article each.
- Anything that drifts into clinical effect (for example why esomeprazole is "better") is out of scope by rule.

## 5. Starter set (37 candidates, grouped)

| Class | Drugs |
|---|---|
| Analgesics and NSAIDs | acetylsalicylic acid, paracetamol, ibuprofen, dexibuprofen, diclofenac, naproxen, mefenamic acid, metamizole |
| Antibiotics | phenoxymethylpenicillin, amoxicillin, cefuroxime, ciprofloxacin, doxycycline, clarithromycin |
| Anticoagulants | warfarin, apixaban, rivaroxaban, dabigatran (and its prodrug dabigatran etexilate) |
| Statins | simvastatin, atorvastatin, rosuvastatin |
| Antihypertensives | ramipril, enalapril, losartan, valsartan, amlodipine, bisoprolol, metoprolol |
| PPIs | omeprazole, esomeprazole, pantoprazole |
| Antidiabetics | metformin, gliclazide, sitagliptin, empagliflozin |

That is 34 drugs plus the etexilate prodrug. Azithromycin was checked and dropped in favour of clarithromycin (one macrolide is enough).

**Comparison pairs that teach the most:**
1. Ibuprofen vs dexibuprofen: racemate vs single enantiomer, same graph.
2. Omeprazole vs esomeprazole: chirality at sulfur.
3. Omeprazole vs pantoprazole: same benzimidazole sulfoxide core, different substituents.
4. Phenoxymethylpenicillin vs amoxicillin: shared penam core, side chain decides spectrum and absorption.
5. Amoxicillin vs cefuroxime: penam vs cephem.
6. Simvastatin vs atorvastatin: lactone prodrug vs open hydroxy acid; shared HMG-like motif.
7. Enalapril vs ramipril: ester prodrugs of ACE inhibitors.
8. Losartan vs valsartan: biphenyl tetrazole.
9. Bisoprolol vs metoprolol: aryloxypropanolamine.
10. Apixaban vs rivaroxaban: two factor Xa inhibitors.
11. Dabigatran etexilate vs dabigatran: double prodrug.
12. Acetylsalicylic acid vs paracetamol: why one is an NSAID and the other is not.

## 6. Existing tools and the gap

| Tool | What it does | Licence |
|---|---|---|
| PubChem 3D viewer | Shows the computed conformer, rotate and style | Public domain data |
| MolView | Draw a structure, view in 3D, search databases | README says AGPL-3.0; the site's legal page forbids redistribution; contradictory |
| ChemTube3D (Liverpool) | Curated 3D animations of reactions and some drugs, very good teaching | CC BY-NC-SA 2.0 UK on most pages, BY-NC-ND 4.0 on some |
| DrugBank | Deep reference: targets, interactions, structures | Data CC BY-NC 4.0; academic downloads currently paused |
| KemLore | Commercial medicinal chemistry course with a functional group explorer | Proprietary |
| Pharmit, ZincPharmer | Research pharmacophore search | Research tools |

**The gap, honestly stated.** None of them starts where an Austrian student starts (brand name or ATC code), and none puts short, sourced, openly licensed explanations of why each group matters on the molecule itself. ChemTube3D comes closest in spirit but is a fixed set of pages under a non-commercial licence, so a teacher cannot freely remix it into course material. The gap is real but narrow: the code is not the hard part, the sourced notes are. Chemsisy's value is the curated, CC-licensed note layer plus brand-first search, the comparison view and offline use. If the notes are thin, there is no product.

## 7. Name check (report only)

- GitHub: no repository or user named `chemsisy`. Nearby: `drnazmul/chemsis`, `pkell/Chemsistant`, and several `chemsys` repos.
- npm: `chemsisy` not taken (404).
- Domains: chemsisy.com, .org, .app, .io have no RDAP record, so they appear unregistered. Similar: chemsis.com is registered (since 2020), chemsys.com is registered.
- Risk: "ChemSys" is a common generic name in industry software; "Chemsisy" is distinct enough in spelling.

## 8. Proposed stack

Vite, React, TypeScript, static output (no server). 3Dmol.js. RDKit.js in a worker, lazy. MiniSearch for fuzzy search (typo tolerance, prefix, German and English synonyms such as "ASS" and "Acetylsalicylsäure"). vite-plugin-pwa (Workbox) for offline. Floating UI for tooltips, styled by us. Vitest, Playwright, @axe-core/playwright. A Node build script fetches PubChem and Wikidata once, applies SMARTS rules and MCS, and writes the bundled JSON; the app never needs the network for the starter set.

## 9. MVP plan, about one week

| Day | Work |
|---|---|
| 1 | Scaffold, data pipeline (CIDs, 3D SDF, ATC, curated brands), SMARTS rule library with first tests |
| 2 | Viewer component, SVG label overlay with leader lines, keyboard rotate, zoom, cycle groups |
| 3 | Search, drug screen, note panel with sources, product information links |
| 4 | Comparison: precomputed MCS, linked viewers, scaffold highlight |
| 5 | Tooltips, tour, offline PWA, groups text table, screen-reader labels |
| 6 | Tests, axe in both themes, CI with size budget |
| 7 | Notes: the long pole. Realistic MVP: full notes for the 12 comparison-pair drugs, the rest show detected groups with names only until notes are written |

## 10. Open questions

1. Notes licence: I recommend **CC BY 4.0**. A teacher can drop a note into slides, a Moodle course or an exam without relicensing the whole deck, and it combines with OpenStax (also CC BY). CC BY-SA would force share-alike onto teachers' own materials and clash with the NC-licensed resources many already use. OK?
2. Amoxilan: I could not confirm it as an Austrian product (the only hits are Hungarian and Czech Zentiva packs). Is it the brand you meant, or should the amoxicillin brand be Ospamox or another Austrian product?
3. Starter set: confirm the 34 drugs above, or name swaps (for example clopidogrel, or levothyroxine, which many curricula include).
4. Note review: who checks chemistry notes before `reviewed: true`? A pharmacist or lecturer would make the project much more credible.
5. Live lookups for drugs outside the set: in the MVP (groups detected, no notes) or after?
6. Accept that the MVP ships full notes for about 12 drugs, with the rest following?

## 11. Decisions at the checkpoint

- Notes licence: CC BY 4.0.
- Amoxicillin brand: Ospamox (Sandoz), confirmed in Medikamente Info Austria with 12 authorisations, for example 17653 (1000 mg film-coated tablets); the SmPC link `https://medikamente.basg.gv.at/documents/17653__DOTC_FACH_INFO.pdf` works. Older numbers have no `1-` prefix in document links. Thrombo ASS 100 mg is 1-19830.
- Starter set: the 34 drugs above, no additions.
- Every note shows its review status: "Sourced, not yet reviewed" by default, "Reviewed by [name, role]" only after a real review.
- MVP: full notes for about 12 drugs; the rest show group names with "Note in preparation". Live lookups are a stretch goal.
- Unsettled science (metamizole) is stated as unsettled, with a source. Paywall-only topics (mefenamic acid binding) get no note until an open source exists. Enantiomer pairs come after the first 12.

## 12. Correction (Phase 3, 2026-10-23)

Sections 4 and 10 above call OpenStax *Pharmacology for Nurses* CC BY 4.0 and say CC BY notes combine with OpenStax. That was wrong. Checked on the live pages: OpenStax *Pharmacology for Nurses*, *Microbiology* and *Organic Chemistry* are now licensed CC BY-NC-SA 4.0, and the pages add that the content may not be ingested into large language models or generative AI offerings without permission. Chemsisy therefore does not cite or rely on OpenStax in its notes or glossary. The CC BY 4.0 choice for Chemsisy's own notes is unaffected: the notes are written fresh and cite their sources.
