// Shapes of the static JSON in public/data, written by scripts/build-data.ts.

export interface Source {
  citation: string;
  url: string;
  licence?: string;
}

export interface Review {
  // "unreviewed" is the default. "reviewed" is only set by a real reviewer.
  status: "unreviewed" | "reviewed";
  by?: string;
  role?: string;
  date?: string;
}

export interface Note {
  caption: string;
  body: string[];
  sources: Source[];
  review: Review;
}

export interface DrugGroup {
  ruleId: string;
  name: string;
  atoms: number[];
  ring: number[];
  count: number;
  term?: string;
  note?: Note;
}

export interface ProductInfo {
  label?: string;
  url?: string;
  source?: "BASG" | "EMA";
  none?: string;
}

export interface Brand {
  name: string;
  url?: string;
}

export interface DrugSummary {
  slug: string;
  name: string;
  class: string;
  className: string;
  atc: string[];
  brands: string[];
  synonyms: string[];
  formula: string;
  notes: number;
}

export interface Drug extends DrugSummary {
  cid: number;
  sdf: string;
  conformer: { source: string; url: string };
  properties: { weight: number; xlogp: number | null; hbd: number; hba: number; tpsa: number };
  brandList: Brand[];
  product: ProductInfo;
  activeFormOf?: string;
  groups: DrugGroup[];
  pubchemUrl: string;
}

export interface Pair {
  a: string;
  b: string;
  core: { a: number[]; b: number[] };
  size: number;
}

export interface Comparison {
  a: string;
  b: string;
  title: string;
  note?: Note;
}

export interface GlossaryTerm {
  id: string;
  term: string;
  aliases?: string[];
  definition: string;
  source: Source;
}

export interface Index {
  generated: string;
  classes: { id: string; name: string }[];
  drugs: DrugSummary[];
  comparisons: Comparison[];
  glossary: GlossaryTerm[];
}
