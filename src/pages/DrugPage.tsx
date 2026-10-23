import { useEffect, useMemo, useState } from "react";
import { useData } from "../app/data.tsx";
import { Link, useTitle } from "../app/router.tsx";
import { loadDrug } from "../data/load.ts";
import type { Drug } from "../data/types.ts";
import { Formula } from "../lib/formula.tsx";
import { useMediaQuery } from "../lib/hooks.ts";
import { GroupList } from "../components/GroupList.tsx";
import { GroupTable } from "../components/GroupTable.tsx";
import { Icon } from "../components/Icon.tsx";
import { MoleculeView, type ViewGroup } from "../components/MoleculeView.tsx";
import { Term } from "../components/Term.tsx";
import { Tooltip } from "../components/Tooltip.tsx";

const readGroup = () => new URLSearchParams(location.search).get("group");

export function DrugPage({ slug }: { slug: string }) {
  const { index } = useData();
  const [drug, setDrug] = useState<Drug | null>(null);
  const [missing, setMissing] = useState(false);
  const [focus, setFocus] = useState<string | null>(readGroup);
  const [labels, setLabels] = useState<"all" | "focus">("all");
  const [view, setView] = useState<"3d" | "table">("3d");
  const wide = useMediaQuery("(min-width: 1100px)");
  const phone = useMediaQuery("(max-width: 699px)");
  useTitle(drug?.name ?? "");

  useEffect(() => {
    let live = true;
    loadDrug(slug).then(
      (d) => {
        if (!live) return;
        setDrug(d);
        // Open the group given in the link, else the first group that has a note.
        setFocus((f) => (f && d.groups.some((g) => g.ruleId === f) ? f : d.groups.find((g) => g.note)?.ruleId ?? null));
      },
      () => live && setMissing(true),
    );
    return () => { live = false; };
  }, [slug]);

  // Keep the open group in the address, so a teacher can link to it.
  useEffect(() => {
    if (!drug) return;
    const url = focus ? `${location.pathname}?group=${focus}` : location.pathname;
    history.replaceState(null, "", url);
  }, [focus, drug]);

  const viewGroups: ViewGroup[] = useMemo(
    () => (drug?.groups ?? []).map((g) => ({ key: g.ruleId, name: g.name, caption: g.note?.caption, atoms: g.atoms, ring: g.ring, anchor: g.anchor })),
    [drug],
  );
  const comparisons = (index?.comparisons ?? []).filter((c) => c.a === slug || c.b === slug);

  if (missing) {
    return (
      <div className="page prose">
        <h1>No drug called “{slug}”</h1>
        <p>The starter set has 36 drugs. Search for a brand, a substance or an ATC code, or <Link href="/">browse them by class</Link>.</p>
      </div>
    );
  }
  if (!drug) return <div className="page" aria-busy="true"><p className="disclaimer">Loading</p></div>;

  const focusGroup = drug.groups.find((g) => g.ruleId === focus);
  const product = drug.product;
  return (
    <div className="page drug-page">
      <section aria-labelledby="drug-name">
        <div className="drug-head">
          <h1 id="drug-name">{drug.name}</h1>
          <dl className="facts">
            {drug.brands.length > 0 && (
              <div><dt>Brand in Austria</dt><dd>{drug.brands.join(", ")}</dd></div>
            )}
            <div>
              <dt><Term id="atc-code">ATC</Term></dt>
              <dd>{drug.atc.join(", ")}</dd>
            </div>
            <div><dt>Class</dt><dd>{drug.className}</dd></div>
            <div><dt>Formula</dt><dd><Formula value={drug.formula} /></dd></div>
            <div>
              <dd>
                {product.url ? (
                  <Tooltip content={`Official text from ${product.source === "EMA" ? "the European Medicines Agency" : "BASG, the Austrian medicines agency"}: ${product.label}`}>
                    <a className="ext" href={product.url} target="_blank" rel="noopener noreferrer">
                      Product information <Icon name="ext" />
                    </a>
                  </Tooltip>
                ) : (
                  <span>No Austrian product information</span>
                )}
              </dd>
            </div>
          </dl>
        </div>

        <figure style={{ margin: 0 }} data-tour="figure">
          {view === "3d" ? (
            <MoleculeView
              sdf={drug.sdf}
              label={`3D model of ${drug.name}`}
              groups={viewGroups}
              focusKey={focus}
              onFocusChange={setFocus}
              layout={phone ? "rows" : "columns"}
              columnWidth={wide ? 180 : 150}
              toolRow
              showLabels={labels === "all"}
              height={wide ? 560 : phone ? 420 : 500}
            >
              <div className="fig-tools">
                <Tooltip content="Turn the molecule back to the view that shows the open group best (key 0)">
                  <button type="button" className="tool" onClick={() => document.dispatchEvent(new CustomEvent("chemsisy:reset"))}>
                    <Icon name="reset" /> Reset view
                  </button>
                </Tooltip>
                <Tooltip content={labels === "all" ? "Show only the label of the open group" : "Show a label for every group"}>
                  <button type="button" className="tool" aria-pressed={labels === "all"} onClick={() => setLabels(labels === "all" ? "focus" : "all")}>
                    <Icon name="labels" /> All labels
                  </button>
                </Tooltip>
                <Tooltip content="Show the groups and their atoms as a table instead of the 3D view">
                  <button type="button" className="tool" onClick={() => setView("table")}>
                    <Icon name="table" /> Table
                  </button>
                </Tooltip>
              </div>
              <div className="keys" aria-hidden="true">
                <span><kbd>←</kbd><kbd>→</kbd> rotate</span>
                <span><kbd>[</kbd><kbd>]</kbd> group</span>
              </div>
            </MoleculeView>
          ) : (
            <div>
              <GroupTable name={drug.name} groups={drug.groups} sdf={drug.sdf} onSelect={(k) => { setFocus(k); setView("3d"); }} />
              <p>
                <button type="button" className="tool" onClick={() => setView("3d")}>
                  <Icon name="cube" /> Back to the 3D view
                </button>
              </p>
            </div>
          )}
          <figcaption>
            <b>Figure.</b> {drug.name}
            {focusGroup ? ` with the ${focusGroup.name.charAt(0).toLowerCase() + focusGroup.name.slice(1)} in focus` : ""}.{" "}
            {drug.conformer.source} (<a href={drug.pubchemUrl} target="_blank" rel="noopener noreferrer">PubChem CID {drug.cid}</a>); hydrogens on carbon are hidden.
            {view === "3d" && " Drag to rotate, pinch or scroll to zoom."}
          </figcaption>
        </figure>
      </section>

      <aside className="reading" aria-label="Functional groups and sources">
        <div className="reading-split">
          <GroupList groups={drug.groups} openKey={focus} onToggle={setFocus} />
          <div>
            <section className="product" aria-labelledby="product-title">
              <h3 id="product-title">Product information</h3>
              {product.url ? (
                <>
                  <a className="ext" href={product.url} target="_blank" rel="noopener noreferrer">
                    {product.label} <Icon name="ext" />
                  </a>
                  <p>
                    Official text from {product.source === "EMA" ? "the European Medicines Agency" : "BASG, the Austrian medicines agency"}.
                    Indications and doses live there, not here.
                  </p>
                </>
              ) : (
                <p>{product.none}</p>
              )}
              {drug.activeFormOf && (
                <p>
                  {drug.name} is the active form of <Link href={`/drug/${drug.activeFormOf}`}>{drug.activeFormOf.replace(/-/g, " ")}</Link>, the medicine that is actually taken.
                </p>
              )}
            </section>
            <dl className="props" aria-label="Computed properties from PubChem">
              <div><dt>Molar mass</dt><dd>{drug.properties.weight.toFixed(1)} g/mol</dd></div>
              <div><dt><Term id="hydrogen-bond-donor">H-bond donors</Term></dt><dd>{drug.properties.hbd}</dd></div>
              <div><dt><Term id="hydrogen-bond-acceptor">H-bond acceptors</Term></dt><dd>{drug.properties.hba}</dd></div>
            </dl>
            {comparisons.length > 0 && (
              <section className="block" style={{ marginTop: "var(--s8)" }} aria-labelledby="cmp-title">
                <h3 id="cmp-title" className="col-title">Compare with</h3>
                <ul className="drug-rows">
                  {comparisons.map((c) => {
                    const other = c.a === slug ? c.b : c.a;
                    const name = index?.drugs.find((d) => d.slug === other)?.name ?? other;
                    return (
                      <li key={other}>
                        <Link href={`/compare/${c.a}/${c.b}`}>
                          <span className="dn">{name}</span>
                          <span className="db">{c.title}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
            <p className="disclaimer">For education. Not medical advice.</p>
          </div>
        </div>
      </aside>
    </div>
  );
}
