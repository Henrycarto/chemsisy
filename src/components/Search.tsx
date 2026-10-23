import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useData } from "../app/data.tsx";
import { navigate } from "../app/router.tsx";
import { Icon } from "./Icon.tsx";
import { Tooltip } from "./Tooltip.tsx";
import type { SearchHit } from "../search/search.ts";

const describe = (h: SearchHit) => {
  if (h.matched === "brand") return `Brand ${h.matchedText}`;
  if (h.matched === "synonym") return `Also called ${h.matchedText}`;
  if (h.matched === "atc") return `ATC ${h.matchedText}`;
  return h.brands.length ? `Brand ${h.brands.join(", ")}` : h.className;
};

/** Search by brand, substance or ATC code. A combobox in the ARIA 1.2 pattern. */
export function Search({ id = "search", autoFocus = false }: { id?: string; autoFocus?: boolean }) {
  const { search } = useData();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const hits = useMemo(() => (search ? search(q) : []), [search, q]);

  const go = (h: SearchHit | undefined) => {
    if (!h) return;
    setOpen(false);
    setQ("");
    input.current?.blur();
    navigate(`/drug/${h.slug}`);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, hits.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); go(hits[active]); }
    else if (e.key === "Escape") { if (open) { e.stopPropagation(); setOpen(false); } else setQ(""); }
  };

  const showList = open && q.trim().length > 0;
  return (
    <div className="search" role="search">
        <label className="search-field" htmlFor={id}>
          <Icon name="search" />
          <span className="sr-only">Search drugs</span>
          <Tooltip content="Search by brand name (Voltaren), substance (diclofenac) or ATC code (M01AB05). Press / to jump here." placement="bottom" disabled={showList}>
          <input
            ref={input}
            id={id}
            type="text"
            role="combobox"
            autoComplete="off"
            spellCheck={false}
            autoFocus={autoFocus}
            placeholder="Brand, substance or ATC code"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={showList && hits[active] ? `${listId}-${active}` : undefined}
            value={q}
            onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 120)}
            onKeyDown={onKey}
          />
          </Tooltip>
          <kbd aria-hidden="true">/</kbd>
        </label>
      {showList && (
        <ul className="search-list" id={listId} role="listbox" aria-label="Matching drugs">
          {hits.length === 0 && <li className="search-empty" role="option" aria-selected="false" aria-disabled="true">No drug in the starter set matches "{q.trim()}". Try the substance name or an ATC code.</li>}
          {hits.map((h, i) => (
            <li
              key={h.slug}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className="search-option"
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => go(h)}
            >
              <span className="name">{h.name}</span>
              <span className="atc">{h.atc[0]}</span>
              <span className="meta">{describe(h)}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="sr-only" aria-live="polite">{showList ? `${hits.length} result${hits.length === 1 ? "" : "s"}` : ""}</div>
    </div>
  );
}
