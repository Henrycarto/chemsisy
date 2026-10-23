import { Fragment, type ReactNode } from "react";
import { useData } from "../app/data.tsx";
import type { GlossaryTerm, Note, Review } from "../data/types.ts";
import { Term } from "./Term.tsx";
import { Tooltip } from "./Tooltip.tsx";

const ISSUE_URL = "https://github.com/Henrycarto/chemsisy/issues/new?template=chemistry-note.yml";

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Wrap the first mention of each glossary term in a paragraph with its tooltip. */
function linkTerms(text: string, terms: GlossaryTerm[], used: Set<string>): ReactNode[] {
  const spans: { start: number; end: number; id: string }[] = [];
  for (const t of terms) {
    if (used.has(t.id)) continue;
    for (const form of [t.term, ...(t.aliases ?? [])]) {
      const re = new RegExp(`(?<![\\p{L}\\p{N}-])${escapeRegExp(form)}(?![\\p{L}\\p{N}])`, "iu");
      const m = re.exec(text);
      if (m && !spans.some((s) => m.index < s.end && m.index + m[0].length > s.start)) {
        spans.push({ start: m.index, end: m.index + m[0].length, id: t.id });
        used.add(t.id);
        break;
      }
    }
  }
  spans.sort((a, b) => a.start - b.start);
  const out: ReactNode[] = [];
  let at = 0;
  for (const s of spans) {
    out.push(text.slice(at, s.start));
    out.push(<Term key={s.start} id={s.id}>{text.slice(s.start, s.end)}</Term>);
    at = s.end;
  }
  out.push(text.slice(at));
  return out;
}

export function ReviewStatus({ review }: { review: Review }) {
  const reviewed = review.status === "reviewed" && review.by && review.role;
  return (
    <Tooltip
      content={
        reviewed
          ? `${review.by} (${review.role}) checked this note${review.date ? ` on ${review.date}` : ""}.`
          : "Every claim here cites a source you can open. No chemist or pharmacist has checked this note yet."
      }
    >
      <button type="button" className={`status${reviewed ? " is-reviewed" : ""}`}>
        {reviewed ? `Reviewed by ${review.by}, ${review.role}` : "Sourced, not yet reviewed"}
      </button>
    </Tooltip>
  );
}

export function NoteBody({ note }: { note: Note }) {
  const { index } = useData();
  const terms = index?.glossary ?? [];
  const used = new Set<string>();
  return (
    <>
      {note.body.map((para, i) => (
        <p key={i}>{linkTerms(para, terms, used)}</p>
      ))}
      <p className="sources-label">Sources</p>
      <ul className="sources">
        {note.sources.map((s, i) => (
          <li key={i}>
            <a href={s.url} target="_blank" rel="noopener noreferrer">
              {s.citation.split(/\*([^*]+)\*/).map((part, k) => (k % 2 ? <i key={k}>{part}</i> : <Fragment key={k}>{part}</Fragment>))}
            </a>{" "}
            {s.licence && <span className="lic">{s.licence}</span>}
          </li>
        ))}
      </ul>
      <div className="status-row">
        <ReviewStatus review={note.review} />
        <Tooltip content="Opens a form on GitHub that asks for the change and a source. You need a free GitHub account.">
          <a className="linkish" href={ISSUE_URL} target="_blank" rel="noopener noreferrer">Suggest a correction</a>
        </Tooltip>
      </div>
    </>
  );
}
