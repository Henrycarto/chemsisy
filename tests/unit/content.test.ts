// The content rules, enforced: sourced notes, honest review status, no clinical
// wording, links to official product information, and house typography.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import type { Drug, Index } from "../../src/data/types.ts";
import { RULES } from "../../src/chem/rules.ts";

// Built at runtime so this file does not contain the character it looks for.
const EM_DASH = String.fromCharCode(0x2014);

const index: Index = JSON.parse(fs.readFileSync("public/data/index.json", "utf8"));
const drugs: Drug[] = index.drugs.map((d) => JSON.parse(fs.readFileSync(`public/data/drugs/${d.slug}.json`, "utf8")));
const notes = drugs.flatMap((d) => d.groups.filter((g) => g.note).map((g) => ({ where: `${d.slug}/${g.ruleId}`, note: g.note! })));
const comparisonNotes = index.comparisons.filter((c) => c.note).map((c) => ({ where: `${c.a}/${c.b}`, note: c.note! }));

describe("starter set", () => {
  it("has 36 drugs in 7 classes", () => {
    expect(drugs).toHaveLength(36);
    expect(index.classes).toHaveLength(7);
  });
  it("every drug has a 3D structure, an ATC code and at least one group", () => {
    for (const d of drugs) {
      expect(d.sdf, d.slug).toContain("V2000");
      expect(d.atc.length, d.slug).toBeGreaterThan(0);
      for (const a of d.atc) expect(a, d.slug).toMatch(/^[A-Z]\d{2}[A-Z]{2}\d{2}$/);
      expect(d.groups.length, d.slug).toBeGreaterThan(0);
    }
  });
  it("every drug links to official product information, or says why there is none", () => {
    for (const d of drugs) {
      if (d.product.url) {
        expect(d.product.url, d.slug).toMatch(/^https:\/\/(medikamente\.basg\.gv\.at\/documents\/[\w-]+__DOTC_FACH_INFO\.pdf|www\.ema\.europa\.eu\/en\/medicines\/human\/EPAR\/[a-z-]+)$/);
        expect(d.product.label, d.slug).toBeTruthy();
      } else {
        expect(d.product.none?.length ?? 0, d.slug).toBeGreaterThan(40);
      }
    }
  });
  it("about 12 drugs carry full notes", () => {
    const withNotes = drugs.filter((d) => d.notes > 0).length;
    expect(withNotes).toBeGreaterThanOrEqual(12);
  });
});

describe("notes", () => {
  const all = [...notes, ...comparisonNotes];
  it("exist", () => expect(notes.length).toBeGreaterThan(40));

  it("every note cites at least one source with a working-looking https link", () => {
    for (const { where, note } of all) {
      expect(note.sources.length, where).toBeGreaterThan(0);
      for (const s of note.sources) {
        expect(s.url, where).toMatch(/^https:\/\//);
        expect(s.citation.length, where).toBeGreaterThan(5);
      }
    }
  });

  it("are never marked reviewed without a named reviewer and role", () => {
    for (const { where, note } of all) {
      if (note.review.status === "reviewed") {
        expect(note.review.by, where).toBeTruthy();
        expect(note.review.role, where).toBeTruthy();
      } else expect(note.review.status, where).toBe("unreviewed");
    }
  });

  it("do not cite sources whose terms exclude AI-assisted use (OpenStax)", () => {
    for (const { where, note } of all) for (const s of note.sources) expect(s.url, where).not.toMatch(/openstax\.org/);
  });

  it("keep captions to one line of at most 90 characters", () => {
    for (const { where, note } of all) expect(note.caption.length, where).toBeLessThanOrEqual(90);
  });

  it("stay out of clinical advice: no doses, indications or side effects", () => {
    const clinical = /\b(\d+\s?(mg|g|µg|mcg)\b|dose|dosage|indicat(ed|ion)|side effects?|adverse|contraindicat|take (it|this|one)|should (take|use))\b/i;
    for (const { where, note } of all) for (const p of note.body) expect(p, where).not.toMatch(clinical);
  });
});

describe("glossary", () => {
  it("defines every term the rules point to, each with a source", () => {
    const ids = new Set(index.glossary.map((t) => t.id));
    for (const r of RULES) if (r.term) expect(ids.has(r.term), `${r.id} -> ${r.term}`).toBe(true);
    for (const t of index.glossary) {
      expect(t.source.url, t.id).toMatch(/^https:\/\//);
      expect(t.definition.length, t.id).toBeLessThanOrEqual(220);
    }
  });
});

describe("house typography", () => {
  const files = [
    ...fs.readdirSync("content/notes").map((f) => path.join("content/notes", f)),
    "content/glossary.yaml", "content/comparisons.yaml", "content/drugs.yaml",
  ];
  it("has no em dashes in the content", () => {
    for (const f of files) expect(fs.readFileSync(f, "utf8"), f).not.toContain(EM_DASH);
  });
  it("content files parse as YAML", () => {
    for (const f of files) expect(() => YAML.parse(fs.readFileSync(f, "utf8")), f).not.toThrow();
  });
});
