// Functional-group rules. Each SMARTS is matched against the heavy-atom graph
// (hydrogens implicit). When two matches overlap, the one with the higher
// priority wins if it contains every atom of the other: the specific name
// ("2-arylpropionic acid") replaces the generic one ("carboxylic acid").
//
// `ring` lists the positions, in pattern order, of the atoms that form the ring
// the viewer turns face-on when the group is in focus.

export interface GroupRule {
  id: string;
  name: string;
  smarts: string;
  priority: number;
  ring?: number[];
  term?: string;
}

export const RULES: GroupRule[] = [
  // Rings that define a drug class
  { id: "beta_lactam", name: "β-lactam ring", smarts: "O=[#6]1[#6][#6][#7]1", priority: 90, ring: [1, 2, 3, 4], term: "beta-lactam" },
  { id: "thiazolidine", name: "Thiazolidine ring", smarts: "[#16]1[#6][#6][#7][#6]1", priority: 60, ring: [0, 1, 2, 3, 4] },
  { id: "dihydrothiazine", name: "Dihydrothiazine ring", smarts: "[#16]1[#6][#6]=[#6][#7][#6]1", priority: 60, ring: [0, 1, 2, 3, 4, 5] },
  { id: "macrolactone", name: "14-membered macrolactone", smarts: "[#6][CX3;r14](=O)[OX2;r14][#6]", priority: 85, term: "lactone" },
  { id: "quinolone_acid", name: "4-Quinolone-3-carboxylic acid", smarts: "[#8]=[#6]1~[#6](-[#6](=[#8])-[#8;H1,-])~[#6]~[#7]~[#6]2~[#6]~1~[#6]~[#6]~[#6]~[#6]~2", priority: 88, ring: [1, 2, 6, 7, 8, 9] },
  { id: "benzimidazole", name: "Benzimidazole", smarts: "[#6]1:[#7]:[#6]2:[#6]:[#6]:[#6]:[#6]:[#6]:2:[#7]:1", priority: 70, ring: [0, 1, 2, 7, 8] },
  { id: "pyridine", name: "Pyridine ring", smarts: "[nX2;r6]1:[c]:[c]:[c]:[c]:[c]:1", priority: 40, ring: [0, 1, 2, 3, 4, 5] },
  { id: "tetrazole", name: "Tetrazole", smarts: "[#6]1:[#7]:[#7]:[#7]:[#7]:1", priority: 70, ring: [0, 1, 2, 3, 4], term: "bioisostere" },
  { id: "imidazole", name: "Imidazole", smarts: "[#6]1:[#7]:[#6]:[#6]:[#7]:1", priority: 45, ring: [0, 1, 2, 3, 4] },
  { id: "triazole", name: "1,2,4-Triazole", smarts: "[#6]1:[#7]:[#7]:[#6]:[#7]:1", priority: 45, ring: [0, 1, 2, 3, 4] },
  { id: "thiophene", name: "Thiophene", smarts: "[#6]1:[#6]:[#6]:[#16]:[#6]:1", priority: 45, ring: [0, 1, 2, 3, 4] },
  { id: "oxazolidinone", name: "Oxazolidinone", smarts: "O=[#6]1[#8][#6][#6][#7]1", priority: 65, ring: [1, 2, 3, 4, 5] },
  { id: "morpholinone", name: "Morpholinone", smarts: "O=[#6]1[#6][#8][#6][#6][#7]1", priority: 65, ring: [1, 2, 3, 4, 5, 6] },
  { id: "piperazine", name: "Piperazine", smarts: "[#7]1[#6][#6][#7][#6][#6]1", priority: 45, ring: [0, 1, 2, 3, 4, 5] },
  { id: "dihydropyridine", name: "1,4-Dihydropyridine", smarts: "[#6]1=[#6]-[#6;X4]-[#6]=[#6]-[#7;H1]-1", priority: 70, ring: [0, 1, 2, 3, 4, 5] },
  { id: "pyrazolone", name: "Pyrazolone", smarts: "[#8]=[#6]1~[#6]~[#6]~[#7]~[#7]~1", priority: 65, ring: [1, 2, 3, 4, 5] },
  { id: "hydroxycoumarin", name: "4-Hydroxycoumarin", smarts: "[#8]=[#6]1~[#8]~[#6]2~[#6]~[#6]~[#6]~[#6]~[#6]~2~[#6](-[#8;H1])~[#6]~1", priority: 80, ring: [1, 2, 3, 8, 9, 11] },
  { id: "glucose_ring", name: "Glucose-like ring", smarts: "[#8]1[#6][#6]([OX2H1])[#6]([OX2H1])[#6]([OX2H1])[#6]1", priority: 60, ring: [0, 1, 2, 4, 6, 8] },
  { id: "biphenyl", name: "Biphenyl", smarts: "c1ccccc1-c1ccccc1", priority: 35 },
  { id: "cyclopropyl", name: "Cyclopropyl", smarts: "[CX4]1[CX4][CX4]1", priority: 30, ring: [0, 1, 2] },
  { id: "proline_like", name: "Proline-like ring with carboxylic acid", smarts: "[#7]1[#6][#6][#6][#6]1[CX3](=O)[OX2H1]", priority: 75, ring: [0, 1, 2, 3, 4] },

  // Pharmacophores and specific motifs
  { id: "statin_diol_acid", name: "3,5-Dihydroxy acid (statin pharmacophore)", smarts: "[OX2H1][CX4][CH2][CX4]([OX2H1])[CH2][CX3](=O)[OX2H1]", priority: 92, term: "pharmacophore" },
  { id: "aryloxypropanolamine", name: "Aryloxypropanolamine", smarts: "c[OX2][CH2][CH1]([OX2H1])[CH2][NX3;H1][CX4]", priority: 85 },
  { id: "aryl_propionic_acid", name: "2-Arylpropionic acid", smarts: "c[CX4H1]([CH3])[CX3](=O)[OX2H1]", priority: 80, term: "stereocentre" },
  { id: "aryl_acetic_acid", name: "Arylacetic acid", smarts: "c[CH2][CX3](=O)[OX2H1]", priority: 78 },
  { id: "anthranilic_acid", name: "N-Aryl anthranilic acid", smarts: "[OX2H1][CX3](=O)c1ccccc1[NH]c", priority: 80 },
  { id: "acetyl_ester", name: "Acetyl ester on a phenol", smarts: "c[OX2][CX3](=O)[CH3]", priority: 80 },
  { id: "acetanilide", name: "Acetanilide (aryl amide)", smarts: "c[NH][CX3](=O)[CH3]", priority: 78 },
  { id: "biguanide", name: "Biguanide", smarts: "[#7][#6](~[#7])~[#7]~[#6](~[#7])~[#7]", priority: 85 },
  { id: "sulfonylurea", name: "Sulfonylurea", smarts: "[#6]S(=O)(=O)[NH][CX3](=O)[#7]", priority: 85 },
  { id: "benzamidine", name: "Benzamidine", smarts: "c[CX3](=[NX2])[NX3]", priority: 75 },
  { id: "carbamate", name: "Carbamate", smarts: "[#7][CX3;!R](=O)[OX2;!R][#6]", priority: 60 },
  { id: "sulfonic_acid", name: "Sulfonic acid", smarts: "[#6]S(=O)(=O)[OX2H1,OX1-]", priority: 60 },
  { id: "difluoromethoxy", name: "Difluoromethoxy", smarts: "[OX2][CX4H1](F)F", priority: 60 },
  { id: "trifluoromethyl", name: "Trifluoromethyl", smarts: "[CX4](F)(F)F", priority: 55 },
  { id: "diarylamine", name: "Diarylamine", smarts: "c[NX3H1]c", priority: 50 },

  // General functional groups
  { id: "carboxylic_acid", name: "Carboxylic acid", smarts: "[#6][CX3](=O)[OX2H1,OX1-]", priority: 20, term: "ionisable" },
  { id: "lactone", name: "Lactone", smarts: "[#6][CX3;R;!r14](=O)[OX2;R][#6;R]", priority: 30, term: "lactone" },
  { id: "ester", name: "Ester", smarts: "[#6][CX3;!R](=O)[OX2H0;!R][#6]", priority: 20, term: "prodrug" },
  { id: "lactam", name: "Lactam", smarts: "[#6;R][CX3;R;!r4](=O)[NX3;R]", priority: 25 },
  { id: "primary_amide", name: "Primary amide", smarts: "[#6][CX3](=O)[NX3H2]", priority: 25 },
  { id: "amide", name: "Amide", smarts: "[#6][CX3;!R](=[OX1])[NX3;!$(N([CX3]=O)[CX3]=O);!$(N-S(=O)=O)]", priority: 15 },
  { id: "sulfoxide", name: "Sulfoxide", smarts: "[#6][SX3](=O)[#6]", priority: 50, term: "prodrug" },
  { id: "sulfonamide", name: "Sulfonamide", smarts: "[#6]S(=O)(=O)[NX3;!$(N[CX3](=O)[#7])]", priority: 30 },
  { id: "primary_amine", name: "Primary amine", smarts: "[NX3;H2;!$(N[CX3]=[O,N,S]);!$(N-a)][CX4]", priority: 20, term: "ionisable" },
  { id: "secondary_amine", name: "Secondary amine", smarts: "[NX3;H1;!$(N[CX3]=[O,S,N]);!$(N-a);!$(N-S(=O)=O)]([CX4])[CX4]", priority: 20, term: "ionisable" },
  { id: "tertiary_amine", name: "Tertiary amine", smarts: "[NX3;H0;!$(N[CX3]=[O,S,N]);!$(N-a);!$(N-S(=O)=O);!$(N-[#7])]([CX4])([CX4])[CX4]", priority: 20, term: "ionisable" },
  { id: "phenol", name: "Phenol", smarts: "c[OX2H1]", priority: 20, term: "hydrogen-bond-donor" },
  { id: "aryl_ether", name: "Aryl ether", smarts: "c[OX2;H0][#6;!$([#6]=O)]", priority: 15 },
  { id: "alcohol", name: "Hydroxyl group", smarts: "[CX4][OX2H1]", priority: 10, term: "hydrogen-bond-donor" },
  { id: "ketone", name: "Ketone", smarts: "[#6][CX3](=O)[#6]", priority: 10 },
  { id: "aryl_fluoride", name: "Aryl fluoride", smarts: "c[F]", priority: 30 },
  { id: "aryl_chloride", name: "Aryl chloride", smarts: "c[Cl]", priority: 30 },
];

export interface Match {
  ruleId: string;
  atoms: number[];
}

export interface Group {
  ruleId: string;
  name: string;
  atoms: number[];
  ring: number[];
  count: number;
}

// Keep a match unless a higher-priority match covers all of its atoms.
export function resolveOverlaps(matches: (Match & { priority: number })[]): Match[] {
  return matches.filter((m) =>
    !matches.some((o) => o !== m && o.priority > m.priority && m.atoms.every((a) => o.atoms.includes(a))),
  );
}

// Merge several matches of the same rule into one group, as the reader sees it.
export function groupMatches(matches: Match[], rules: GroupRule[] = RULES): Group[] {
  const byRule = new Map<string, Match[]>();
  for (const m of matches) byRule.set(m.ruleId, [...(byRule.get(m.ruleId) ?? []), m]);
  const out: Group[] = [];
  for (const rule of rules) {
    const ms = byRule.get(rule.id);
    if (!ms) continue;
    const atoms = [...new Set(ms.flatMap((m) => m.atoms))].sort((a, b) => a - b);
    const ring = rule.ring ? [...new Set(ms.flatMap((m) => rule.ring!.map((p) => m.atoms[p])))] : [];
    out.push({ ruleId: rule.id, name: rule.name, atoms, ring, count: ms.length });
  }
  return out;
}
