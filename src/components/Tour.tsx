import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { readStore, writeStore } from "../lib/hooks.ts";

// A short first-visit tour. It is a sequence, so its steps are numbered.
const STEPS = [
  { target: "search", title: "Search the way you meet a drug", body: "Type a brand name, the active substance or an ATC code. Small typos are fine." },
  { target: "figure", title: "The molecule is the figure", body: "Drag to turn it, pinch or scroll to zoom. With the keyboard: arrow keys turn it, [ and ] step through the groups." },
  { target: "groups", title: "Every group has a reason", body: "Open a group to put it in focus and read why it matters. Each note names its sources and whether anyone has reviewed it." },
  { target: "compare", title: "Compare two drugs", body: "See two molecules side by side, turned the same way, with the core they share highlighted." },
  { target: "help", title: "Back to this tour", body: "This button opens the tour again. Chemsisy is for learning; it is not medical advice." },
];
const DONE_KEY = "chemsisy.tour.v1";

const TourContext = createContext<{ start: () => void }>({ start: () => {} });
export const useTour = () => useContext(TourContext);

export function TourProvider({ children }: { children: ReactNode }) {
  const [step, setStep] = useState<number | null>(null);
  const start = useCallback(() => setStep(0), []);
  useEffect(() => {
    if (readStore(DONE_KEY) !== "done") {
      const t = window.setTimeout(() => setStep(0), 600);
      return () => window.clearTimeout(t);
    }
  }, []);
  const close = useCallback(() => {
    writeStore(DONE_KEY, "done");
    setStep(null);
    document.querySelector<HTMLElement>("[data-tour='help']")?.focus();
  }, []);
  return (
    <TourContext.Provider value={{ start }}>
      {children}
      {step !== null && <TourCard step={step} setStep={setStep} close={close} />}
    </TourContext.Provider>
  );
}

function TourCard({ step, setStep, close }: { step: number; setStep: (n: number) => void; close: () => void }) {
  const card = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: 16, top: 72 });
  const s = STEPS[step];

  useLayoutEffect(() => {
    // Skip steps whose target is not on this page.
    const el = document.querySelector<HTMLElement>(`[data-tour='${s.target}']`);
    if (!el) {
      if (step < STEPS.length - 1) setStep(step + 1);
      else close();
      return;
    }
    el.classList.add("tour-target");
    el.scrollIntoView({ block: "nearest" });
    const r = el.getBoundingClientRect();
    const w = card.current?.offsetWidth ?? 340, h = card.current?.offsetHeight ?? 180;
    const below = r.bottom + 12 + h < window.innerHeight;
    setPos({
      left: Math.min(Math.max(16, r.left), window.innerWidth - w - 16),
      top: below ? r.bottom + 12 : Math.max(16, r.top - h - 12),
    });
    card.current?.focus();
    return () => el.classList.remove("tour-target");
  }, [step, s.target, setStep, close]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  return (
    <div ref={card} className="tour" role="dialog" aria-modal="false" aria-labelledby="tour-title" aria-describedby="tour-body" tabIndex={-1} style={pos}>
      <h2 id="tour-title">{s.title}</h2>
      <p id="tour-body">{s.body}</p>
      <div className="tour-foot">
        <span className="step">Step {step + 1} of {STEPS.length}</span>
        <button type="button" className="btn" onClick={close}>Skip tour</button>
        {step > 0 && <button type="button" className="btn" onClick={() => setStep(step - 1)}>Back</button>}
        <button type="button" className="btn primary" onClick={() => (step < STEPS.length - 1 ? setStep(step + 1) : close())}>
          {step < STEPS.length - 1 ? "Next" : "Done"}
        </button>
      </div>
    </div>
  );
}
