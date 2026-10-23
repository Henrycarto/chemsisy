import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useData } from "../app/data.tsx";
import { navigate, useTitle } from "../app/router.tsx";
import { loadDrug, loadPairs, pairKey } from "../data/load.ts";
import type { Drug, Pair } from "../data/types.ts";
import { useMediaQuery } from "../lib/hooks.ts";
import { Icon } from "../components/Icon.tsx";
import { MoleculeView } from "../components/MoleculeView.tsx";
import { NoteBody } from "../components/Note.tsx";
import { Term } from "../components/Term.tsx";
import { Tooltip } from "../components/Tooltip.tsx";
import { Link } from "../app/router.tsx";
import type { FigureLabel, MoleculeFigure } from "../viewer/figure.ts";
import { coreTransform, shareView } from "../viewer/compare.ts";

type Mode = "shared" | "differences";

export function ComparePage({ a, b }: { a?: string; b?: string }) {
  const { index } = useData();
  const featured = index?.comparisons[0];
  // /compare on its own opens the first comparison that has a note.
  useEffect(() => {
    if ((!a || !b) && featured) navigate(`/compare/${featured.a}/${featured.b}`, true);
  }, [a, b, featured]);
  if (!a || !b) return <div className="page" aria-busy="true" />;
  return <Comparison key={`${a}|${b}`} a={a} b={b} />;
}

function Comparison({ a, b }: { a: string; b: string }) {
  const { index } = useData();
  const [drugs, setDrugs] = useState<[Drug, Drug] | null>(null);
  const [pair, setPair] = useState<Pair | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [mode, setMode] = useState<Mode>("shared");
  const wide = useMediaQuery("(min-width: 1100px)");
  const phone = useMediaQuery("(max-width: 699px)");
  const figs = useRef<{ A?: MoleculeFigure; B?: MoleculeFigure }>({});
  useTitle(drugs ? `${drugs[0].name} and ${drugs[1].name}` : "Compare");

  useEffect(() => {
    Promise.all([loadDrug(a), loadDrug(b), loadPairs()]).then(
      ([da, db, pairs]) => {
        setDrugs([da, db]);
        const p = pairs[pairKey(a, b)];
        // Stored pairs are keyed alphabetically; swap the cores if needed.
        setPair(p ? (p.a === a ? p : { a, b, size: p.size, core: { a: p.core.b, b: p.core.a } }) : null);
      },
      () => setFailed(true),
    );
  }, [a, b]);

  const transform = useMemo(
    () => (drugs && pair ? coreTransform(drugs[0].sdf, pair.core.a, drugs[1].sdf, pair.core.b) : undefined),
    [drugs, pair],
  );

  const link = useCallback(() => {
    const { A, B } = figs.current;
    if (!A || !B || !drugs || !pair) return;
    const ring = drugs[0].groups.find((g) => g.ring.length && g.ring.every((i) => pair.core.a.includes(i)))?.ring ?? [];
    shareView(A, B, pair.core.a, ring);
  }, [drugs, pair]);

  const comparison = index?.comparisons.find((c) => (c.a === a && c.b === b) || (c.a === b && c.b === a));
  const options = index?.classes.map((c) => ({ ...c, drugs: index.drugs.filter((d) => d.class === c.id) })) ?? [];

  if (failed) return <div className="page prose"><h1>These drugs could not be loaded</h1><p><Link href="/compare">Start a new comparison</Link>.</p></div>;
  if (!drugs || pair === undefined) return <div className="page" aria-busy="true"><p className="disclaimer">Loading</p></div>;

  const [da, db] = drugs;
  const ruleIds = [...new Set([...da.groups.map((g) => g.ruleId), ...db.groups.map((g) => g.ruleId)])];
  const name = (id: string) => da.groups.find((g) => g.ruleId === id)?.name ?? db.groups.find((g) => g.ruleId === id)!.name;
  const has = (d: Drug, id: string) => d.groups.some((g) => g.ruleId === id);

  const labelsFor = (d: Drug, other: Drug, core: number[] | undefined): FigureLabel[] => {
    const own = d.groups.filter((g) => !has(other, g.ruleId));
    const out: FigureLabel[] = [];
    if (core && mode === "shared") out.push({ key: "core", text: "Shared core", kind: "shared", atoms: core });
    for (const g of own) out.push({ key: g.ruleId, text: g.name, kind: mode === "differences" ? "shared" : "diff", atoms: g.atoms, anchor: g.anchor });
    return out;
  };
  const emphasisFor = (d: Drug, other: Drug, core: number[] | undefined) => {
    if (mode === "shared") return core ?? [];
    return [...new Set(d.groups.filter((g) => !has(other, g.ruleId)).flatMap((g) => g.atoms))];
  };

  const height = wide ? 380 : phone ? 340 : 360;
  const layout = wide ? "columns" : "rows";
  const pick = (side: "a" | "b", slug: string) => navigate(side === "a" ? `/compare/${slug}/${b}` : `/compare/${a}/${slug}`);

  return (
    <div className="page">
      <div className="cmp-head">
        <h1>Compare</h1>
        <div className="picker">
          <label htmlFor="pick-a">First drug</label>
          <Tooltip content="Choose the first drug">
            <select id="pick-a" value={a} onChange={(e) => pick("a", e.target.value)}>
              {options.map((c) => (
                <optgroup key={c.id} label={c.name}>
                  {c.drugs.map((d) => <option key={d.slug} value={d.slug} disabled={d.slug === b}>{d.name}</option>)}
                </optgroup>
              ))}
            </select>
          </Tooltip>
        </div>
        <Tooltip content="Swap the two drugs">
          <button type="button" className="swap" aria-label="Swap the two drugs" onClick={() => navigate(`/compare/${b}/${a}`)}>
            <Icon name="swap" />
          </button>
        </Tooltip>
        <div className="picker">
          <label htmlFor="pick-b">Second drug</label>
          <Tooltip content="Choose the second drug">
            <select id="pick-b" value={b} onChange={(e) => pick("b", e.target.value)}>
              {options.map((c) => (
                <optgroup key={c.id} label={c.name}>
                  {c.drugs.map((d) => <option key={d.slug} value={d.slug} disabled={d.slug === a}>{d.name}</option>)}
                </optgroup>
              ))}
            </select>
          </Tooltip>
        </div>
        <div className="seg" role="group" aria-label="Highlight">
          <Tooltip content="Highlight the atoms both molecules share">
            <button type="button" aria-pressed={mode === "shared"} onClick={() => setMode("shared")} disabled={!pair}>Shared core</button>
          </Tooltip>
          <Tooltip content="Highlight the groups only one of the two has">
            <button type="button" aria-pressed={mode === "differences"} onClick={() => setMode("differences")}>Differences</button>
          </Tooltip>
        </div>
      </div>

      <div className="pair">
        {[da, db].map((d, i) => {
          const other = i === 0 ? db : da;
          const core = pair ? (i === 0 ? pair.core.a : pair.core.b) : undefined;
          return (
            <figure key={d.slug} style={{ margin: 0 }}>
              <div className="ftitle">
                <b><Link href={`/drug/${d.slug}`}>{d.name}</Link></b>
                <span>{[d.brands[0], `ATC ${d.atc[0]}`].filter(Boolean).join(", ")}</span>
              </div>
              <MoleculeView
                sdf={d.sdf}
                label={`3D model of ${d.name}`}
                groups={[]}
                focusKey={null}
                layout={layout}
                columnWidth={112}
                toolRow={false}
                emphasis={emphasisFor(d, other, core)}
                extraLabels={labelsFor(d, other, core)}
                transform={i === 1 ? transform : undefined}
                height={height}
                onReady={(f) => {
                  figs.current[i === 0 ? "A" : "B"] = f;
                  link();
                }}
              />
            </figure>
          );
        })}
      </div>
      <div className="legend">
        {pair ? (
          <>
            <span><i />{mode === "shared" ? `Shared core, ${pair.size} atoms` : "Only in this drug"}</span>
            {mode === "shared" && <span><i className="d" />Only in one drug</span>}
            <span>Both views turn together; {db.name.toLowerCase()} is laid over the shared core of {da.name.toLowerCase()}.</span>
          </>
        ) : (
          <span>These two molecules share no ring system or chain of six or more atoms, so they are shown side by side without being laid over each other.</span>
        )}
      </div>

      <div className="cmp-grid">
        <table className="diff">
          <caption><Term id="functional-group">Functional groups</Term></caption>
          <thead>
            <tr><th scope="col">Group</th><th scope="col">{da.name}</th><th scope="col">{db.name}</th></tr>
          </thead>
          <tbody>
            {ruleIds.map((id) => (
              <tr key={id}>
                <th scope="row" style={{ fontWeight: 400, color: "var(--ink)" }}>{name(id)}</th>
                {[da, db].map((d) => (
                  <td key={d.slug} className={`yn${has(d, id) ? "" : " no"}`}>
                    <Icon name={has(d, id) ? "check" : "dash"} />
                    {has(d, id) ? "Yes" : "No"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {comparison?.note ? (
          <section className="note" aria-labelledby="teach-title">
            <h2 id="teach-title" className="section-title">{comparison.title}</h2>
            <NoteBody note={comparison.note} />
          </section>
        ) : (
          <section aria-labelledby="teach-title">
            <h2 id="teach-title" className="section-title">What the difference teaches</h2>
            <p className="pending-note" style={{ paddingLeft: 0 }}>
              No note for this pair yet. The table shows which groups the two drugs share and which only one has.
            </p>
          </section>
        )}
      </div>
      <p className="disclaimer">For education. Not medical advice.</p>
    </div>
  );
}
