import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { FigureLabel, FigureOptions, MoleculeFigure } from "../viewer/figure.ts";
import type { Mat3, Vec3 } from "../viewer/math.ts";
import { useEffectiveTheme, useReducedMotion } from "../lib/hooks.ts";

export interface ViewGroup {
  key: string;
  name: string;
  caption?: string;
  atoms: number[];
  ring: number[];
}

interface Props {
  sdf: string;
  label: string;
  groups: ViewGroup[];
  focusKey: string | null;
  onFocusChange?: (key: string | null) => void;
  layout: "columns" | "rows";
  columnWidth?: number;
  toolRow?: boolean;
  showLabels?: boolean;
  /** Comparison view: atoms drawn in full colour without turning the molecule. */
  emphasis?: number[];
  extraLabels?: FigureLabel[];
  transform?: { R: Mat3; from: Vec3; to: Vec3 };
  onReady?: (fig: MoleculeFigure) => void;
  className?: string;
  height: number;
  children?: ReactNode;
}

const KEY_HELP = "Arrow keys rotate, plus and minus zoom, 0 resets the view, [ and ] step through the groups, Escape clears the focus.";

export function MoleculeView(p: Props) {
  const host = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const fig = useRef<MoleculeFigure | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const theme = useEffectiveTheme();
  const reducedMotion = useReducedMotion();
  const latest = useRef(p);
  useLayoutEffect(() => {
    latest.current = p;
  });

  // Create the figure once per molecule.
  useEffect(() => {
    let disposed = false;
    let created: MoleculeFigure | null = null;
    import("../viewer/figure.ts")
      .then(({ MoleculeFigure }) => {
        if (disposed || !stage.current) return;
        const opts: FigureOptions = {
          theme,
          layout: p.layout,
          columnWidth: p.columnWidth ?? 180,
          toolRow: !!p.toolRow,
          reducedMotion,
          transform: p.transform,
          onAtomClick: (atom) => {
            const g = latest.current.groups.find((x) => x.atoms.includes(atom));
            latest.current.onFocusChange?.(g ? g.key : null);
          },
          onLabelClick: (key) => latest.current.groups.some((g) => g.key === key) && latest.current.onFocusChange?.(key),
        };
        created = new MoleculeFigure(stage.current, p.sdf, opts);
        fig.current = created;
        setStatus("ready");
        latest.current.onReady?.(created);
      })
      .catch(() => !disposed && setStatus("failed"));
    return () => {
      disposed = true;
      created?.destroy();
      fig.current = null;
    };
    // The figure is rebuilt only when the molecule itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.sdf, p.transform, p.layout]);

  useEffect(() => {
    fig.current?.setTheme(theme);
  }, [theme, status]);

  // Focus and labels.
  const focusGroup = p.groups.find((g) => g.key === p.focusKey) ?? null;
  const labelKey = JSON.stringify([p.focusKey, p.showLabels, p.groups.map((g) => g.key), p.extraLabels?.map((l) => l.key + l.kind), p.emphasis?.length]);
  const firstFocus = useRef(true);
  useEffect(() => {
    const f = fig.current;
    if (!f) return;
    if (p.emphasis) f.setEmphasis(p.emphasis);
    else {
      f.setFocus(focusGroup ? { atoms: focusGroup.atoms, ring: focusGroup.ring } : null, !firstFocus.current);
      firstFocus.current = false;
    }
    const labels: FigureLabel[] = (p.showLabels === false ? p.groups.filter((g) => g.key === p.focusKey) : p.groups).map((g) => ({
      key: g.key,
      text: g.name,
      caption: g.key === p.focusKey ? g.caption : undefined,
      kind: g.key === p.focusKey ? "focus" : "muted",
      atoms: g.atoms,
    }));
    f.setLabels([...(p.extraLabels ?? []), ...labels]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labelKey, status]);

  // Keep the drawing sharp and fitted when the figure changes size.
  useEffect(() => {
    if (!host.current) return;
    let t = 0;
    const ro = new ResizeObserver(() => {
      window.clearTimeout(t);
      t = window.setTimeout(() => {
        fig.current?.resize();
        if (!latest.current.emphasis) fig.current?.resetView(false);
      }, 80);
    });
    ro.observe(host.current);
    return () => { ro.disconnect(); window.clearTimeout(t); };
  }, [status]);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const f = fig.current;
    if (!f || e.target !== e.currentTarget) return;
    const step = e.shiftKey ? 45 : 15;
    const keys = latest.current.groups.map((g) => g.key);
    const i = p.focusKey ? keys.indexOf(p.focusKey) : -1;
    switch (e.key) {
      case "ArrowLeft": f.rotate(-step, "vy"); break;
      case "ArrowRight": f.rotate(step, "vy"); break;
      case "ArrowUp": f.rotate(-step, "vx"); break;
      case "ArrowDown": f.rotate(step, "vx"); break;
      case "+": case "=": f.zoom(1.15); break;
      case "-": case "_": f.zoom(1 / 1.15); break;
      case "0": case "Home": f.resetView(); break;
      case "]": if (keys.length) p.onFocusChange?.(keys[(i + 1) % keys.length]); break;
      case "[": if (keys.length) p.onFocusChange?.(keys[(i - 1 + keys.length) % keys.length]); break;
      case "Escape": if (p.focusKey) p.onFocusChange?.(null); else return; break;
      default: return;
    }
    e.preventDefault();
  };

  const announce = focusGroup ? `${focusGroup.name} in focus${focusGroup.caption ? `: ${focusGroup.caption}` : ""}` : "";
  return (
    <div
      ref={host}
      className={`figure ${p.className ?? ""}`}
      style={{ height: p.height }}
      tabIndex={0}
      role="application"
      aria-roledescription="3D molecule viewer"
      aria-label={`${p.label}. ${p.groups.length} functional groups. ${KEY_HELP}`}
      onKeyDown={onKey}
      data-status={status}
    >
      <div ref={stage} className="figure-stage" />
      {status === "loading" && <div className="figure-status">Loading the 3D viewer</div>}
      {status === "failed" && <div className="figure-status">The 3D viewer could not start on this device. The table of groups below has the same information.</div>}
      {p.children}
      <div className="sr-only" aria-live="polite">{announce}</div>
    </div>
  );
}
