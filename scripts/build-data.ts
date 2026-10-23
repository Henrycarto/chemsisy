// Builds the static data the app ships with: public/data/index.json,
// public/data/drugs/<slug>.json and public/data/pairs.json.
//
// Network is only used to fill data/cache (PubChem structures and properties).
// The cache is committed, so a rebuild works offline and gives the same output.
//
//   npm run data                 build from cache, fetch what is missing
//   npm run data -- --check-links  also check every product-information link

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import YAML from "yaml";
import { RULES, resolveOverlaps, groupMatches } from "../src/chem/rules.ts";
import type { Drug, DrugGroup, Index, Note, Pair, Comparison, GlossaryTerm, ProductInfo } from "../src/data/types.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const CACHE = path.join(ROOT, "data", "cache");
const OUT = path.join(ROOT, "public", "data");
const USER_AGENT = "Chemsisy/0.1 (https://henrycarto.com)";
const PUG = "https://pubchem.ncbi.nlm.nih.gov/rest/pug";
const checkLinks = process.argv.includes("--check-links");

const require = createRequire(import.meta.url);
const initRDKit = require("@rdkit/rdkit") as () => Promise<RDKitModule>;

interface RDKitMol {
  get_substruct_matches(q: RDKitMol): string;
  get_num_atoms(): number;
  delete(): void;
}
interface RDKitModule {
  get_mol(input: string, details?: string): RDKitMol | null;
  get_qmol(smarts: string): RDKitMol | null;
  get_mcs_as_json(mols: unknown, details: string): string;
  MolList: new () => { append(m: RDKitMol): void; delete(): void };
}

interface DrugSource {
  slug: string;
  name: string;
  cid: number;
  class: string;
  atc: string[];
  synonyms: string[];
  brands: { name: string; zulnr?: string }[];
  product: { basg?: string; ema?: string; label?: string; none?: string };
  activeFormOf?: string;
}

const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchText(url: string): Promise<{ status: number; text: string }> {
  // PubChem asks for at most 5 requests per second.
  await sleep(250);
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  return { status: res.status, text: await res.text() };
}

async function cached(file: string, url: string): Promise<string | null> {
  const p = path.join(CACHE, file);
  if (fs.existsSync(p)) return fs.readFileSync(p, "utf8");
  const { status, text } = await fetchText(url);
  if (status !== 200) return null;
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text);
  return text;
}

const basgUrl = (zulnr: string) => `https://medikamente.basg.gv.at/documents/${zulnr}__DOTC_FACH_INFO.pdf`;
const emaUrl = (slug: string) => `https://www.ema.europa.eu/en/medicines/human/EPAR/${slug}`;

function product(p: DrugSource["product"]): ProductInfo {
  if (p.basg) return { label: p.label, url: basgUrl(p.basg), source: "BASG" };
  if (p.ema) return { label: p.label, url: emaUrl(p.ema), source: "EMA" };
  return { none: p.none };
}

// Heavy atoms must come first in the SDF so heavy-atom indices match the 3D file.
function assertHeavyFirst(sdf: string, slug: string): number {
  const lines = sdf.split(/\r?\n/);
  const n = parseInt(lines[3].slice(0, 3), 10);
  const els = lines.slice(4, 4 + n).map((l) => l.slice(31, 34).trim());
  const firstH = els.indexOf("H");
  const heavy = firstH === -1 ? n : firstH;
  if (els.slice(heavy).some((e) => e !== "H")) throw new Error(`${slug}: hydrogens are not last in the SDF`);
  return heavy;
}

function loadNotes(slug: string): Record<string, Note> {
  const p = path.join(ROOT, "content", "notes", `${slug}.yaml`);
  if (!fs.existsSync(p)) return {};
  const doc = YAML.parse(fs.readFileSync(p, "utf8")) as { groups?: Record<string, Omit<Note, "review"> & { review?: Note["review"] }> };
  const out: Record<string, Note> = {};
  for (const [ruleId, n] of Object.entries(doc.groups ?? {})) {
    if (!n.sources?.length) throw new Error(`${slug}/${ruleId}: a note without a source is not allowed`);
    out[ruleId] = { ...n, body: Array.isArray(n.body) ? n.body : [n.body], review: n.review ?? { status: "unreviewed" } };
    if (out[ruleId].review.status === "reviewed" && !(out[ruleId].review.by && out[ruleId].review.role))
      throw new Error(`${slug}/${ruleId}: "reviewed" needs the reviewer's name and role`);
  }
  return out;
}

async function main() {
  const src = YAML.parse(read("content/drugs.yaml")) as { classes: { id: string; name: string }[]; drugs: DrugSource[] };
  const classes = new Map(src.classes.map((c) => [c.id, c.name]));
  const glossary = (YAML.parse(read("content/glossary.yaml")) as { terms: GlossaryTerm[] }).terms;
  const comparisonsSrc = (YAML.parse(read("content/comparisons.yaml")) as { comparisons: Comparison[] }).comparisons;
  const RDKit = await initRDKit();
  fs.mkdirSync(path.join(OUT, "drugs"), { recursive: true });

  const drugs: Drug[] = [];
  const mols = new Map<string, RDKitMol>();
  for (const d of src.drugs) {
    let sdf = await cached(`sdf/${d.cid}.sdf`, `${PUG}/compound/cid/${d.cid}/record/SDF?record_type=3d`);
    let conformer = { source: "PubChem 3D conformer", url: `https://pubchem.ncbi.nlm.nih.gov/compound/${d.cid}#section=3D-Conformer` };
    if (!sdf) {
      // PubChem computes no 3D conformer for molecules this large; scripts/conformer.py makes one with RDKit.
      const own = path.join(CACHE, "sdf-generated", `${d.cid}.sdf`);
      if (!fs.existsSync(own)) throw new Error(`${d.slug}: no PubChem 3D conformer; run scripts/conformer.py ${d.cid}`);
      sdf = fs.readFileSync(own, "utf8");
      conformer = { source: "Conformer generated with RDKit (ETKDG and MMFF94) from the PubChem structure", url: `https://pubchem.ncbi.nlm.nih.gov/compound/${d.cid}` };
    }
    const propsCsv = await cached(`props/${d.cid}.json`, `${PUG}/compound/cid/${d.cid}/property/MolecularFormula,MolecularWeight,XLogP,HBondDonorCount,HBondAcceptorCount,TPSA/JSON`);
    if (!propsCsv) throw new Error(`${d.slug}: properties not available`);
    const props = JSON.parse(propsCsv).PropertyTable.Properties[0];

    assertHeavyFirst(sdf, d.slug);
    const mol = RDKit.get_mol(sdf, JSON.stringify({ removeHs: true }));
    if (!mol) throw new Error(`${d.slug}: RDKit could not read the SDF`);
    mols.set(d.slug, mol);

    const raw = [];
    for (const rule of RULES) {
      const q = RDKit.get_qmol(rule.smarts);
      if (!q) throw new Error(`rule ${rule.id}: invalid SMARTS`);
      const res = JSON.parse(mol.get_substruct_matches(q));
      q.delete();
      for (const m of Array.isArray(res) ? res : []) raw.push({ ruleId: rule.id, atoms: m.atoms as number[], priority: rule.priority });
    }
    const notes = loadNotes(d.slug);
    const groups: DrugGroup[] = groupMatches(resolveOverlaps(raw)).map((g) => ({
      ...g,
      term: RULES.find((r) => r.id === g.ruleId)?.term,
      note: notes[g.ruleId],
    }));
    for (const id of Object.keys(notes))
      if (!groups.some((g) => g.ruleId === id)) throw new Error(`${d.slug}: note for "${id}" but no such group was detected`);

    const drug: Drug = {
      slug: d.slug,
      name: d.name,
      class: d.class,
      className: classes.get(d.class) ?? d.class,
      atc: d.atc,
      brands: d.brands.map((b) => b.name),
      synonyms: d.synonyms,
      formula: props.MolecularFormula,
      notes: groups.filter((g) => g.note).length,
      cid: d.cid,
      sdf,
      conformer,
      properties: {
        weight: Number(props.MolecularWeight),
        xlogp: props.XLogP ?? null,
        hbd: props.HBondDonorCount,
        hba: props.HBondAcceptorCount,
        tpsa: props.TPSA,
      },
      brandList: d.brands.map((b) => ({ name: b.name, url: b.zulnr ? basgUrl(b.zulnr) : undefined })),
      product: product(d.product),
      activeFormOf: d.activeFormOf,
      groups,
      pubchemUrl: `https://pubchem.ncbi.nlm.nih.gov/compound/${d.cid}`,
    };
    drugs.push(drug);
    fs.writeFileSync(path.join(OUT, "drugs", `${d.slug}.json`), JSON.stringify(drug));
    console.log(`${d.slug.padEnd(24)} ${String(groups.length).padStart(2)} groups, ${drug.notes} notes  ${groups.map((g) => g.ruleId).join(" ")}`);
  }

  // Shared cores for every pair, on heavy atoms. Cached because it is the slow part.
  const pairCache = path.join(CACHE, "pairs.json");
  const prev: Record<string, Pair | null> = fs.existsSync(pairCache) ? JSON.parse(fs.readFileSync(pairCache, "utf8")) : {};
  const pairs: Record<string, Pair> = {};
  const slugs = drugs.map((d) => d.slug).sort();
  for (let i = 0; i < slugs.length; i++) for (let j = i + 1; j < slugs.length; j++) {
    const [a, b] = [slugs[i], slugs[j]];
    const key = `${a}|${b}`;
    if (!(key in prev)) {
      const list = new RDKit.MolList();
      list.append(mols.get(a)!);
      list.append(mols.get(b)!);
      const mcs = JSON.parse(RDKit.get_mcs_as_json(list, JSON.stringify({ RingMatchesRingOnly: true, CompleteRingsOnly: true, Timeout: 2 })));
      list.delete();
      if (mcs.numAtoms >= 6) {
        const q = RDKit.get_qmol(mcs.smarts)!;
        const ma = JSON.parse(mols.get(a)!.get_substruct_matches(q))[0]?.atoms ?? [];
        const mb = JSON.parse(mols.get(b)!.get_substruct_matches(q))[0]?.atoms ?? [];
        q.delete();
        prev[key] = { a, b, core: { a: ma, b: mb }, size: mcs.numAtoms };
      } else prev[key] = null;
    }
    if (prev[key]) pairs[key] = prev[key]!;
  }
  fs.writeFileSync(pairCache, JSON.stringify(prev));
  fs.writeFileSync(path.join(OUT, "pairs.json"), JSON.stringify(pairs));

  const comparisons = comparisonsSrc.map((c) => {
    if (!slugs.includes(c.a) || !slugs.includes(c.b)) throw new Error(`comparison ${c.a}/${c.b}: unknown drug`);
    if (c.note && !c.note.sources?.length) throw new Error(`comparison ${c.a}/${c.b}: note without a source`);
    return { ...c, note: c.note ? { ...c.note, review: c.note.review ?? { status: "unreviewed" as const } } : undefined };
  });

  const index: Index = {
    generated: new Date().toISOString().slice(0, 10),
    classes: src.classes,
    drugs: drugs.map(({ slug, name, class: cls, className, atc, brands, synonyms, formula, notes }) => ({ slug, name, class: cls, className, atc, brands, synonyms, formula, notes })),
    comparisons,
    glossary,
  };
  fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify(index));
  console.log(`\n${drugs.length} drugs, ${Object.keys(pairs).length} pairs with a shared core of 6+ atoms, ${drugs.reduce((s, d) => s + d.notes, 0)} notes`);

  if (checkLinks) {
    const urls = [...new Set(drugs.flatMap((d) => [d.product.url, ...d.brandList.map((b) => b.url)]).filter(Boolean) as string[])];
    let bad = 0;
    for (const u of urls) {
      const res = await fetch(u, { method: "HEAD", headers: { "User-Agent": USER_AGENT } }).catch(() => null);
      if (!res || res.status !== 200) { bad++; console.log(`link ${res?.status ?? "error"} ${u}`); }
      await sleep(300);
    }
    console.log(`${urls.length - bad}/${urls.length} product links answer 200`);
    if (bad) process.exitCode = 1;
  }
  for (const m of mols.values()) m.delete();
}

main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
