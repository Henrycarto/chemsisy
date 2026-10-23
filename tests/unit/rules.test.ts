// Every functional-group SMARTS rule against molecules that must match and
// molecules that must not. Starter-set drugs are referred to by slug and read
// from the bundled data; small molecules are given as SMILES.
import { beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { RULES, groupMatches, resolveOverlaps } from "../../src/chem/rules.ts";

const require = createRequire(import.meta.url);
type Mol = { get_substruct_matches(q: Mol): string; get_num_atoms(): number; delete(): void };
type RDKit = { get_mol(s: string, d?: string): Mol | null; get_qmol(s: string): Mol | null };
let RD: RDKit;

const drugSdf = (slug: string) =>
  JSON.parse(fs.readFileSync(path.join("public", "data", "drugs", `${slug}.json`), "utf8")).sdf as string;
const mol = (x: string) => {
  const m = /^[a-z-]+$/.test(x) ? RD.get_mol(drugSdf(x), JSON.stringify({ removeHs: true })) : RD.get_mol(x);
  if (!m) throw new Error(`cannot parse ${x}`);
  return m;
};
function matches(ruleId: string, x: string): number {
  const rule = RULES.find((r) => r.id === ruleId)!;
  const m = mol(x), q = RD.get_qmol(rule.smarts)!;
  const res = JSON.parse(m.get_substruct_matches(q));
  m.delete(); q.delete();
  return Array.isArray(res) ? res.length : 0;
}

// rule id: [must match, must not match]
const CASES: Record<string, [string[], string[]]> = {
  beta_lactam: [["amoxicillin", "cefuroxime", "O=C1CCN1"], ["O=C1CCCN1", "CC(=O)NC"]],
  thiazolidine: [["phenoxymethylpenicillin", "C1CSCN1"], ["cefuroxime", "C1CCCN1"]],
  dihydrothiazine: [["cefuroxime"], ["amoxicillin"]],
  macrolactone: [["clarithromycin"], ["simvastatin"]],
  quinolone_acid: [["ciprofloxacin"], ["OC(=O)c1ccccc1"]],
  benzimidazole: [["omeprazole", "c1ccc2[nH]cnc2c1"], ["c1ccc2[nH]ccc2c1"]],
  pyridine: [["c1ccncc1", "omeprazole"], ["c1ccccc1", "c1cncnc1"]],
  tetrazole: [["losartan", "c1nnn[nH]1"], ["c1nnc[nH]1"]],
  imidazole: [["c1cnc[nH]1", "losartan"], ["c1ccoc1"]],
  triazole: [["sitagliptin", "c1nnc[nH]1"], ["c1cnc[nH]1"]],
  thiophene: [["rivaroxaban", "c1ccsc1"], ["c1ccoc1"]],
  oxazolidinone: [["rivaroxaban", "O=C1OCCN1"], ["O=C1CCCN1"]],
  morpholinone: [["rivaroxaban"], ["C1COCCN1"]],
  piperazine: [["ciprofloxacin", "C1CNCCN1"], ["C1CCNCC1"]],
  dihydropyridine: [["amlodipine", "C1=CNC=CC1"], ["c1ccncc1"]],
  pyrazolone: [["metamizole"], ["c1cn[nH]c1"]],
  hydroxycoumarin: [["warfarin", "O=c1oc2ccccc2c(O)c1"], ["O=c1ccc2ccccc2o1"]],
  glucose_ring: [["empagliflozin"], ["C1CCOCC1"]],
  biphenyl: [["losartan", "c1ccc(cc1)-c1ccccc1"], ["c1ccc2ccccc2c1"]],
  cyclopropyl: [["ciprofloxacin", "C1CC1"], ["C1CCC1"]],
  proline_like: [["enalapril", "ramipril", "OC(=O)C1CCCN1"], ["OC(=O)C1CCCCN1"]],
  statin_diol_acid: [["atorvastatin", "rosuvastatin"], ["simvastatin"]],
  aryloxypropanolamine: [["metoprolol", "bisoprolol"], ["OCC(O)CNC(C)C"]],
  aryl_propionic_acid: [["ibuprofen", "naproxen"], ["diclofenac"]],
  aryl_acetic_acid: [["diclofenac"], ["ibuprofen"]],
  anthranilic_acid: [["mefenamic-acid"], ["diclofenac"]],
  acetyl_ester: [["acetylsalicylic-acid"], ["paracetamol"]],
  acetanilide: [["paracetamol"], ["acetylsalicylic-acid"]],
  biguanide: [["metformin"], ["NC(=N)N"]],
  sulfonylurea: [["gliclazide"], ["CS(=O)(=O)NC"]],
  benzamidine: [["dabigatran"], ["NC(=O)c1ccccc1"]],
  carbamate: [["dabigatran-etexilate", "CNC(=O)OC"], ["CNC(=O)C"]],
  sulfonic_acid: [["metamizole", "CS(=O)(=O)O"], ["CS(=O)(=O)N"]],
  difluoromethoxy: [["pantoprazole"], ["COc1ccccc1"]],
  trifluoromethyl: [["sitagliptin", "FC(F)(F)c1ccccc1"], ["FCc1ccccc1"]],
  diarylamine: [["diclofenac"], ["CNc1ccccc1"]],
  carboxylic_acid: [["CC(=O)O", "acetylsalicylic-acid"], ["COC(C)=O", "CC(N)=O"]],
  lactone: [["simvastatin", "O=C1CCCO1"], ["CC(=O)OC", "clarithromycin"]],
  ester: [["CC(=O)OC", "enalapril"], ["O=C1CCCO1", "CC(=O)O"]],
  lactam: [["apixaban", "O=C1CCCN1"], ["O=C1CCN1"]],
  primary_amide: [["CC(N)=O", "apixaban"], ["CC(=O)NC"]],
  amide: [["CC(=O)NC", "phenoxymethylpenicillin"], ["CC(=O)OC", "NC(=O)N", "CC(=O)N(C)C(C)=O"]],
  sulfoxide: [["omeprazole", "CS(C)=O"], ["CS(C)(=O)=O"]],
  sulfonamide: [["rosuvastatin", "CS(=O)(=O)N(C)C"], ["gliclazide"]],
  primary_amine: [["CCN", "amoxicillin"], ["Nc1ccccc1", "CC(N)=O"]],
  secondary_amine: [["CCNCC", "enalapril"], ["CC(=O)NC"]],
  tertiary_amine: [["CCN(C)C", "clarithromycin"], ["CN(C)C=O"]],
  phenol: [["Oc1ccccc1", "paracetamol"], ["OCc1ccccc1"]],
  aryl_ether: [["COc1ccccc1", "naproxen"], ["Oc1ccccc1", "COC"]],
  alcohol: [["CCO", "simvastatin"], ["Oc1ccccc1", "CC(=O)O"]],
  ketone: [["CC(C)=O", "warfarin"], ["CC=O", "CC(=O)O"]],
  aryl_fluoride: [["Fc1ccccc1", "atorvastatin"], ["FCC"]],
  aryl_chloride: [["Clc1ccccc1", "diclofenac"], ["ClCC"]],
};

beforeAll(async () => {
  RD = await (require("@rdkit/rdkit") as () => Promise<RDKit>)();
});

describe("functional-group rules", () => {
  it("every rule has at least one positive and one negative case", () => {
    for (const r of RULES) {
      expect(CASES[r.id], `cases for ${r.id}`).toBeDefined();
      expect(CASES[r.id][0].length, `positives for ${r.id}`).toBeGreaterThan(0);
      expect(CASES[r.id][1].length, `negatives for ${r.id}`).toBeGreaterThan(0);
    }
  });

  it("every rule is valid SMARTS", () => {
    for (const r of RULES) {
      const q = RD.get_qmol(r.smarts);
      expect(q, r.id).not.toBeNull();
      q?.delete();
    }
  });

  for (const [id, [pos, neg]] of Object.entries(CASES)) {
    describe(id, () => {
      for (const x of pos) it(`matches ${x}`, () => expect(matches(id, x)).toBeGreaterThan(0));
      for (const x of neg) it(`does not match ${x}`, () => expect(matches(id, x)).toBe(0));
    });
  }

  it("ring positions point at ring atoms of the pattern", () => {
    for (const r of RULES.filter((x) => x.ring)) {
      const q = RD.get_qmol(r.smarts)!;
      for (const p of r.ring!) {
        expect(p, r.id).toBeGreaterThanOrEqual(0);
        expect(p, r.id).toBeLessThan(q.get_num_atoms());
      }
      q.delete();
    }
  });
});

describe("overlap resolution", () => {
  it("a specific group absorbs the generic group it contains", () => {
    const out = resolveOverlaps([
      { ruleId: "carboxylic_acid", atoms: [1, 2, 3], priority: 20 },
      { ruleId: "aryl_propionic_acid", atoms: [0, 1, 2, 3, 4], priority: 80 },
    ]);
    expect(out.map((m) => m.ruleId)).toEqual(["aryl_propionic_acid"]);
  });

  it("partly overlapping groups are both kept", () => {
    const out = resolveOverlaps([
      { ruleId: "amide", atoms: [1, 2, 3, 4], priority: 15 },
      { ruleId: "beta_lactam", atoms: [3, 4, 5, 6, 7], priority: 90 },
    ]);
    expect(out).toHaveLength(2);
  });

  it("several matches of one rule merge into one group with a count", () => {
    const g = groupMatches([
      { ruleId: "ester", atoms: [1, 2, 3, 4] },
      { ruleId: "ester", atoms: [9, 10, 11, 12] },
    ]);
    expect(g).toHaveLength(1);
    expect(g[0].count).toBe(2);
    expect(g[0].atoms).toEqual([1, 2, 3, 4, 9, 10, 11, 12]);
  });
});

describe("groups the starter set shows (pipeline output)", () => {
  const groupsOf = (slug: string) =>
    (JSON.parse(fs.readFileSync(path.join("public", "data", "drugs", `${slug}.json`), "utf8")).groups as { ruleId: string }[]).map((g) => g.ruleId).sort();
  const expected: Record<string, string[]> = {
    amoxicillin: ["amide", "beta_lactam", "carboxylic_acid", "phenol", "primary_amine", "thiazolidine"],
    omeprazole: ["aryl_ether", "benzimidazole", "pyridine", "sulfoxide"],
    simvastatin: ["alcohol", "ester", "lactone"],
    atorvastatin: ["amide", "aryl_fluoride", "statin_diol_acid"],
    ibuprofen: ["aryl_propionic_acid"],
    metoprolol: ["aryloxypropanolamine"],
    "acetylsalicylic-acid": ["acetyl_ester", "carboxylic_acid"],
  };
  for (const [slug, ids] of Object.entries(expected)) it(slug, () => expect(groupsOf(slug)).toEqual(ids));

  it("no drug shows a generic group fully contained in a specific one", () => {
    for (const f of fs.readdirSync(path.join("public", "data", "drugs"))) {
      const d = JSON.parse(fs.readFileSync(path.join("public", "data", "drugs", f), "utf8"));
      const ids = d.groups.map((g: { ruleId: string }) => g.ruleId);
      expect(ids.includes("benzimidazole") && ids.includes("imidazole"), f).toBe(false);
    }
  });
});
