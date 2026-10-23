import type { Drug, Index, Pair } from "./types.ts";

const cache = new Map<string, Promise<unknown>>();

function getJson<T>(path: string): Promise<T> {
  if (!cache.has(path)) {
    const p = fetch(path).then((r) => {
      if (!r.ok) throw new Error(`${path}: ${r.status}`);
      return r.json();
    });
    p.catch(() => cache.delete(path));
    cache.set(path, p);
  }
  return cache.get(path) as Promise<T>;
}

export const loadIndex = () => getJson<Index>("/data/index.json");
export const loadDrug = (slug: string) => getJson<Drug>(`/data/drugs/${encodeURIComponent(slug)}.json`);
export const loadPairs = () => getJson<Record<string, Pair>>("/data/pairs.json");

export const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
