import type { DrugGroup } from "../data/types.ts";
import { NoteBody } from "./Note.tsx";
import { Term } from "./Term.tsx";

interface Props {
  groups: DrugGroup[];
  openKey: string | null;
  onToggle: (key: string | null) => void;
}

/** The functional groups as an accordion. One open group at a time; its note opens in place. */
export function GroupList({ groups, openKey, onToggle }: Props) {
  return (
    <section aria-labelledby="groups-title" data-tour="groups">
      <h2 className="col-title" id="groups-title">
        <span>
          <Term id="functional-group">Functional groups</Term>
        </span>
        <span className="count">{groups.length}</span>
      </h2>
      <ul className="groups">
        {groups.map((g) => {
          const open = g.ruleId === openKey;
          const panel = `note-${g.ruleId}`;
          return (
            <li key={g.ruleId} className={`group${open ? " is-open" : ""}`}>
              <button
                type="button"
                className="group-btn"
                aria-expanded={open}
                aria-controls={panel}
                onClick={() => onToggle(open ? null : g.ruleId)}
              >
                <span className="gname">
                  {g.name}
                  {g.count > 1 && <span className="sr-only">, {g.count} occurrences</span>}
                  {g.count > 1 && <span aria-hidden="true"> ×{g.count}</span>}
                </span>
                {!g.note && <span className="gstate">Note in preparation</span>}
                {open && g.note && <span className="gcap">{g.note.caption}</span>}
              </button>
              {open && (
                <div id={panel} role="region" aria-label={`${g.name} note`}>
                  {g.note ? (
                    <div className="note">
                      <NoteBody note={g.note} />
                    </div>
                  ) : (
                    <p className="pending-note">
                      The group is highlighted in the figure. Its note is still being written and sourced.
                    </p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
