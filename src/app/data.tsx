import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { loadIndex } from "../data/load.ts";
import type { GlossaryTerm, Index } from "../data/types.ts";
import { createSearch } from "../search/search.ts";

interface DataState {
  index: Index | null;
  error: string | null;
  glossary: Map<string, GlossaryTerm>;
  search: ReturnType<typeof createSearch> | null;
}

const DataContext = createContext<DataState>({ index: null, error: null, glossary: new Map(), search: null });

export function DataProvider({ children }: { children: ReactNode }) {
  const [index, setIndex] = useState<Index | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    loadIndex().then(setIndex, (e: Error) => setError(e.message));
  }, []);
  const value = useMemo<DataState>(
    () => ({
      index,
      error,
      glossary: new Map((index?.glossary ?? []).map((t) => [t.id, t])),
      search: index ? createSearch(index.drugs) : null,
    }),
    [index, error],
  );
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export const useData = () => useContext(DataContext);
