import { Link, useTitle } from "../app/router.tsx";

export function About() {
  useTitle("About");
  return (
    <div className="page prose">
      <h1>About Chemsisy</h1>
      <p className="callout">For education. Not medical advice.</p>
      <p>
        Chemsisy shows pharmacy and medical students how drugs work at the level of the molecule. Each drug is shown as a 3D
        structure with its functional groups found automatically, and each group can carry a short note on why it matters,
        with the sources it rests on.
      </p>
      <p>
        Chemsisy never writes indications, doses or side effects. Every drug page links to the official product information
        from BASG, the Austrian medicines agency, or from the European Medicines Agency.
      </p>

      <h2>How the notes are made and checked</h2>
      <p>
        Every note cites at least one source you can open: a free review article, a ChEBI entry or another open reference.
        Notes show their review status. “Sourced, not yet reviewed” means the note cites its sources but nobody has checked it
        yet. A note is marked reviewed only after a named person has checked it, and the note says who and in what role.
        Where the science is not settled, the note says so. Where only paywalled sources exist, there is no note.
      </p>
      <p>Found a mistake? Every note has a “Suggest a correction” link that opens a form asking for the change and a source.</p>

      <h2>Where the data comes from</h2>
      <ul>
        <li>
          Structures, 3D conformers and computed properties: <a href="https://pubchem.ncbi.nlm.nih.gov/">PubChem</a>, US
          National Library of Medicine (public domain). Two molecules without a PubChem conformer were embedded with RDKit;
          their pages say so.
        </li>
        <li>
          Functional groups: matched in the structure with SMARTS patterns using <a href="https://www.rdkit.org/">RDKit</a> (BSD
          licence).
        </li>
        <li>
          ATC codes: <a href="https://www.wikidata.org/">Wikidata</a> (CC0), each checked by hand. The ATC classification belongs
          to the <a href="https://atcddd.fhi.no/">WHO Collaborating Centre for Drug Statistics Methodology</a>, which does not
          allow its index to be redistributed, so Chemsisy shows only the codes.
        </li>
        <li>
          Austrian brands and product information: <a href="https://medikamente.basg.gv.at/">Medikamente Info Austria</a> (BASG),
          linked directly. European product information: <a href="https://www.ema.europa.eu/">European Medicines Agency</a>.
        </li>
        <li>Chemical classes and roles: <a href="https://www.ebi.ac.uk/chebi/">ChEBI</a> (CC BY 4.0).</li>
        <li>
          3D viewer: <a href="https://3dmol.org/">3Dmol.js</a> (BSD licence). Typefaces: Source Serif 4 and IBM Plex Sans (SIL
          Open Font Licence).
        </li>
      </ul>

      <h2>Reusing the notes</h2>
      <p>
        The notes and the curated drug list are licensed <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>.
        Teachers can copy them into slides, a course or an exam, change them and share them, as long as they credit “Chemsisy
        notes, CC BY 4.0” and keep the original sources. The code is MIT licensed.
      </p>

      <h2>Privacy</h2>
      <p>
        No accounts, no ads, no tracking, no analytics and no cookies. The app keeps two settings in your browser only: your
        theme and whether you have seen the tour. Once loaded, the starter set works without a network connection.
      </p>

      <p><Link href="/">Back to all drugs</Link></p>
    </div>
  );
}
