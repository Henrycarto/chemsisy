// Search the way students meet a drug: brand name, active substance or ATC code.
// Typo tolerant (MiniSearch fuzzy matching), prefix aware, accent insensitive.

import MiniSearch from "minisearch";
import type { DrugSummary } from "../data/types.ts";

export interface SearchHit {
  slug: string;
  name: string;
  matched: "name" | "brand" | "synonym" | "atc";
  matchedText: string;
  brands: string[];
  atc: string[];
  className: string;
}

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss").toLowerCase();
const ATC = /^[A-Za-z]\d{2}([A-Za-z]{1,2}(\d{1,2})?)?$/;

export function createSearch(drugs: DrugSummary[]) {
  const ms = new MiniSearch<DrugSummary & { id: string }>({
    fields: ["name", "brands", "synonyms"],
    storeFields: ["slug"],
    extractField: (doc, field) => {
      const v = (doc as unknown as Record<string, unknown>)[field];
      return Array.isArray(v) ? v.join(" ") : (v as string);
    },
    processTerm: (t) => fold(t),
    searchOptions: {
      boost: { name: 3, brands: 3, synonyms: 1.5 },
      prefix: true,
      fuzzy: (term) => (term.length <= 3 ? 0 : term.length <= 5 ? 1 : 2),
      combineWith: "AND",
    },
  });
  ms.addAll(drugs.map((d) => ({ ...d, id: d.slug })));
  const bySlug = new Map(drugs.map((d) => [d.slug, d]));

  function hitFor(d: DrugSummary, q: string): SearchHit {
    const fq = fold(q.trim());
    const words = fq.split(/\s+/);
    const near = (s: string) => {
      const f = fold(s);
      return words.every((w) => f.includes(w)) || f.startsWith(fq);
    };
    const brand = d.brands.find(near);
    const syn = d.synonyms.find(near);
    const base = { slug: d.slug, name: d.name, brands: d.brands, atc: d.atc, className: d.className };
    if (near(d.name)) return { ...base, matched: "name", matchedText: d.name };
    if (brand) return { ...base, matched: "brand", matchedText: brand };
    if (syn) return { ...base, matched: "synonym", matchedText: syn };
    // Fuzzy hit: say which field it most likely came from.
    const best = [d.name, ...d.brands, ...d.synonyms].sort((a, b) => distance(fold(a), fq) - distance(fold(b), fq))[0];
    const matched = d.brands.includes(best) ? "brand" : d.synonyms.includes(best) ? "synonym" : "name";
    return { ...base, matched, matchedText: best };
  }

  return function search(query: string, limit = 8): SearchHit[] {
    const q = query.trim();
    if (!q) return [];
    if (ATC.test(q.replace(/\s/g, ""))) {
      const code = q.replace(/\s/g, "").toUpperCase();
      const hits = drugs.filter((d) => d.atc.some((a) => a.startsWith(code)));
      if (hits.length) {
        return hits.slice(0, limit).map((d) => ({
          slug: d.slug, name: d.name, brands: d.brands, atc: d.atc, className: d.className,
          matched: "atc" as const, matchedText: d.atc.find((a) => a.startsWith(code))!,
        }));
      }
    }
    return ms.search(q).slice(0, limit).map((r) => hitFor(bySlug.get(r.id as string)!, q));
  };
}

// Levenshtein distance, only used to name the field a fuzzy hit came from.
function distance(a: string, b: string): number {
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...new Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}
