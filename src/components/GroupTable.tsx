import type { DrugGroup } from "../data/types.ts";

const ELEMENTS: Record<string, string> = { C: "carbon", N: "nitrogen", O: "oxygen", S: "sulfur", F: "fluorine", Cl: "chlorine", H: "hydrogen", Na: "sodium" };

/** Element symbols of the heavy atoms in the SDF, in file order. */
export function atomSymbols(sdf: string): string[] {
  const lines = sdf.split(/\r?\n/);
  const n = parseInt(lines[3].slice(0, 3), 10);
  return lines.slice(4, 4 + n).map((l) => l.slice(31, 34).trim());
}

/** A text alternative to the 3D view: every group with its atoms, numbered as in the structure file. */
export function GroupTable({ name, groups, sdf, onSelect }: { name: string; groups: DrugGroup[]; sdf: string; onSelect: (key: string) => void }) {
  const symbols = atomSymbols(sdf);
  return (
    <table className="group-table">
      <caption>Functional groups of {name.toLowerCase()}, with their atoms</caption>
      <thead>
        <tr><th scope="col">Group</th><th scope="col">Atoms</th><th scope="col">Note</th></tr>
      </thead>
      <tbody>
        {groups.map((g) => (
          <tr key={g.ruleId}>
            <th scope="row">
              <button type="button" className="term" onClick={() => onSelect(g.ruleId)}>{g.name}</button>
            </th>
            <td className="atoms">
              {g.atoms.map((a) => `${symbols[a]}${a + 1}`).join(", ")}
              <span className="sr-only"> ({g.atoms.map((a) => `${ELEMENTS[symbols[a]] ?? symbols[a]} ${a + 1}`).join(", ")})</span>
            </td>
            <td>{g.note ? "Written" : "In preparation"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
