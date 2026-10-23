import type { ReactNode } from "react";
import { useData } from "../app/data.tsx";
import { Tooltip } from "./Tooltip.tsx";

/** A chemistry term with its definition and source in a tooltip. */
export function Term({ id, children }: { id: string; children: ReactNode }) {
  const { glossary } = useData();
  const t = glossary.get(id);
  if (!t) return <>{children}</>;
  return (
    <Tooltip
      content={
        <>
          <b>{t.term}.</b> {t.definition}
          <span className="tip-src">Source: {t.source.citation}</span>
        </>
      }
    >
      <button type="button" className="term">
        {children}
      </button>
    </Tooltip>
  );
}
