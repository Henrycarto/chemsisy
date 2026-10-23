import { useEffect, useMemo, useState } from "react";
import { useData } from "../app/data.tsx";
import { Link, useTitle } from "../app/router.tsx";
import { loadDrug } from "../data/load.ts";
import type { Drug } from "../data/types.ts";
import { useMediaQuery } from "../lib/hooks.ts";
import { MoleculeView, type ViewGroup } from "../components/MoleculeView.tsx";
import { Search } from "../components/Search.tsx";
import { Term } from "../components/Term.tsx";

const FEATURED = "amoxicillin";

export function Home() {
  const { index, error } = useData();
  const [featured, setFeatured] = useState<Drug | null>(null);
  const [focus, setFocus] = useState<string | null>("beta_lactam");
  const phone = useMediaQuery("(max-width: 699px)");
  const wide = useMediaQuery("(min-width: 1100px)");
  useTitle("");

  useEffect(() => {
    loadDrug(FEATURED).then(setFeatured, () => setFeatured(null));
  }, []);
  const groups: ViewGroup[] = useMemo(
    () => (featured?.groups ?? []).map((g) => ({ key: g.ruleId, name: g.name, caption: g.note?.caption, atoms: g.atoms, ring: g.ring })),
    [featured],
  );

  if (error) {
    return (
      <div className="page prose">
        <h1>The drug list could not be loaded</h1>
        <p>Check the connection and reload. Once Chemsisy has loaded one time, it also works offline.</p>
      </div>
    );
  }
  return (
    <div className="page">
      <section className="home-intro" aria-labelledby="intro-title">
        <div>
          <h1 id="intro-title">See why each part of a drug molecule matters</h1>
          <p>
            Look up a medicine by its brand, its active substance or its <Term id="atc-code">ATC code</Term>. Turn its 3D
            structure, open a <Term id="functional-group">functional group</Term> and read a short, sourced note on what that
            group does.
          </p>
          <p>Made for pharmacy and medical students. For education, not medical advice.</p>
          <Search id="home-search" />
        </div>
        <div className="home-figure">
          {featured && (
            <figure style={{ margin: 0 }} data-tour="figure">
              <MoleculeView
                sdf={featured.sdf}
                label={`3D model of ${featured.name}`}
                groups={groups}
                focusKey={focus}
                onFocusChange={setFocus}
                layout={phone ? "rows" : "columns"}
                columnWidth={wide ? 150 : 130}
                toolRow={false}
                height={phone ? 340 : wide ? 420 : 380}
              />
              <figcaption>
                <b>Figure.</b> Amoxicillin. Click any group to put it in focus, or{" "}
                <Link href={`/drug/${FEATURED}?group=${focus ?? "beta_lactam"}`}>open amoxicillin</Link> to read its notes.
              </figcaption>
            </figure>
          )}
        </div>
      </section>

      <section aria-labelledby="browse-title">
        <h2 id="browse-title" className="section-title">All drugs, by class</h2>
        <div className="classes">
          {index?.classes.map((c) => (
            <div className="class-block" key={c.id}>
              <h3>{c.name}</h3>
              <ul className="drug-rows">
                {index.drugs.filter((d) => d.class === c.id).map((d) => (
                  <li key={d.slug}>
                    <Link href={`/drug/${d.slug}`}>
                      <span className="dn">{d.name}</span>
                      <span className="db">
                        {[d.brands.join(", "), d.notes ? `${d.notes} note${d.notes === 1 ? "" : "s"}` : "Notes in preparation"].filter(Boolean).join(". ")}
                      </span>
                      <span className="da">{d.atc[0]}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {index && index.comparisons.length > 0 && (
        <section className="block" aria-labelledby="pairs-title">
          <h2 id="pairs-title" className="section-title">Comparisons that teach</h2>
          <ul className="pairs-list">
            {index.comparisons.map((c) => {
              const n = (s: string) => index.drugs.find((d) => d.slug === s)?.name ?? s;
              return (
                <li key={`${c.a}|${c.b}`}>
                  <Link href={`/compare/${c.a}/${c.b}`}>
                    <b>{n(c.a)} and {n(c.b).toLowerCase()}</b>
                    <span>{c.title}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
