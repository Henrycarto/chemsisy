// The molecule figure: a 3Dmol.js viewer with a focus halo behind the canvas and
// textbook labels in front of it. Framework-free; MoleculeView.tsx wraps it.

import * as $3Dmol from "3dmol";
import { apply, centroid, faceGroup, matToQuat, principalAxes, slerp, type Mat3, type Quat, type Vec3 } from "./math.ts";
import { placeLabels, type Geometry, type Placement } from "./labels.ts";

export type Theme = "light" | "dark";
export type LabelKind = "focus" | "muted" | "shared" | "diff";

export interface FigureLabel {
  key: string;
  text: string;
  caption?: string;
  kind: LabelKind;
  atoms: number[];
}

export interface FigureOptions {
  theme: Theme;
  layout: "columns" | "rows";
  columnWidth: number;
  toolRow: boolean;
  reducedMotion: boolean;
  transform?: { R: Mat3; from: Vec3; to: Vec3 };
  onAtomClick?: (atom: number) => void;
  onLabelClick?: (key: string) => void;
  onViewChange?: () => void;
}

interface Atom3 { x: number; y: number; z: number; elem: string; index: number; bonds: number[] }

const CPK: Record<Theme, Record<string, string>> = {
  light: { C: "#4d535a", H: "#e9ebed", O: "#e0301e", N: "#2f5be8", S: "#d4b000", F: "#3fbf3f", Cl: "#2fa82f", Na: "#ab5cf2" },
  dark: { C: "#aab0b6", H: "#d9dde1", O: "#ff5a48", N: "#6a8cff", S: "#f0d040", F: "#7be07b", Cl: "#5fd05f", Na: "#c38cf5" },
};
// Context atoms keep their element's hue but recede towards the background.
const FADE: Record<Theme, Record<string, string>> = {
  light: { C: "#d9dde1", H: "#f1f2f4", O: "#f2cdc8", N: "#cfd7f3", S: "#efe6bf", F: "#cfeccf", Cl: "#cfe8cf", Na: "#e6d6f6" },
  dark: { C: "#3d4349", H: "#4a5056", O: "#5a3a37", N: "#3a4363", S: "#575132", F: "#36503a", Cl: "#344d38", Na: "#463a55" },
};
const VDW: Record<string, number> = { H: 1.2, C: 1.7, N: 1.55, O: 1.52, S: 1.8, F: 1.47, Cl: 1.75, Na: 2.27 };
const STYLE = { context: { stick: 0.1, sphere: 0.18 }, focus: { stick: 0.14, sphere: 0.23 } };
const ANIMATION_MS = 240;
const HALO_RIM = 3.5;

const scheme = (map: Record<string, string>) => ({ prop: "elem", map });
// 3Dmol fogs distant atoms towards the background colour. The canvas stays
// transparent, but the colour must match the figure surface, or far atoms glow.
const SURFACE: Record<Theme, string> = { light: "#ffffff", dark: "#1b1e21" };

export class MoleculeFigure {
  readonly viewer: $3Dmol.GLViewer;
  readonly atoms: Atom3[];
  readonly shown: Atom3[];
  private readonly hidden: Set<number>;
  private host: HTMLElement;
  private canvasBox: HTMLElement;
  private halo: SVGSVGElement;
  private overlay: HTMLElement;
  private leaders: SVGSVGElement;
  private opts: FigureOptions;
  private focus: Set<number> | null = null;
  private labels: FigureLabel[] = [];
  private frameRequested = false;
  private settleTimer = 0;
  private animating = 0;
  private placements: Placement[] = [];

  constructor(host: HTMLElement, sdf: string, opts: FigureOptions) {
    this.host = host;
    this.opts = opts;
    host.classList.add("figure-host");
    this.halo = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.halo.setAttribute("class", "figure-halo");
    this.halo.setAttribute("aria-hidden", "true");
    this.canvasBox = document.createElement("div");
    this.canvasBox.className = "figure-canvas";
    this.overlay = document.createElement("div");
    this.overlay.className = "figure-overlay";
    this.overlay.setAttribute("aria-hidden", "true");
    this.leaders = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.leaders.setAttribute("class", "figure-leaders");
    this.overlay.appendChild(this.leaders);
    host.prepend(this.halo, this.canvasBox, this.overlay);

    this.viewer = $3Dmol.createViewer(this.canvasBox, { backgroundColor: SURFACE[opts.theme], backgroundAlpha: 0, antialias: true });
    const model = this.viewer.addModel(sdf, "sdf");
    this.atoms = model.selectedAtoms({}) as unknown as Atom3[];
    if (opts.transform) {
      const { R, from, to } = opts.transform;
      for (const a of this.atoms) {
        const p = apply(R, [a.x - from[0], a.y - from[1], a.z - from[2]]);
        a.x = p[0] + to[0]; a.y = p[1] + to[1]; a.z = p[2] + to[2];
      }
    }
    // Hydrogens on carbon are hidden; polar hydrogens stay because they take part in hydrogen bonds.
    this.hidden = new Set(this.atoms.filter((a) => a.elem === "H" && a.bonds.some((b) => this.atoms[b].elem === "C")).map((a) => a.index));
    this.shown = this.atoms.filter((a) => !this.hidden.has(a.index));
    this.viewer.setZoomLimits(0, 1e4);
    this.viewer.setClickable({}, true, (atom: { index: number }) => this.opts.onAtomClick?.(atom.index));
    this.viewer.setViewChangeCallback(() => this.viewChanged(true));
    this.restyle();
    this.viewer.zoomTo({ index: this.shown.map((a) => a.index) });
    this.orient(null, false);
  }

  get points(): Vec3[] {
    return this.atoms.map((a) => [a.x, a.y, a.z]);
  }

  /** Width-to-height ratio of the free area the molecule is fitted into. */
  get roomAspect(): number {
    const r = this.room();
    return r.w / r.h;
  }

  setTheme(theme: Theme) {
    this.opts.theme = theme;
    this.viewer.setBackgroundColor(SURFACE[theme], 0);
    this.restyle();
    this.layout();
  }

  setLabels(labels: FigureLabel[]) {
    this.labels = labels;
    this.layout();
  }

  /** Put a group in focus and turn it towards the reader. */
  setFocus(group: { atoms: number[]; ring: number[] } | null, animate = true) {
    this.focus = group ? new Set(group.atoms) : null;
    if (this.focus) for (const a of this.shown) if (a.elem === "H" && a.bonds.some((b) => this.focus!.has(b))) this.focus.add(a.index);
    this.restyle();
    this.orient(group, animate);
  }

  /** Highlight atoms without turning the molecule (comparison view). */
  setEmphasis(atoms: number[] | null) {
    this.focus = atoms ? new Set(atoms) : null;
    if (this.focus) for (const a of this.shown) if (a.elem === "H" && a.bonds.some((b) => this.focus!.has(b))) this.focus.add(a.index);
    this.restyle();
    this.layout();
  }

  rotate(degrees: number, axis: "vx" | "vy") {
    this.viewer.rotate(degrees, axis);
    this.viewChanged(false);
  }

  zoom(factor: number) {
    this.viewer.zoom(factor);
    this.viewer.render();
    this.viewChanged(false);
  }

  resetView(animate = true) {
    this.orient(this.lastGroup, animate);
  }

  getView(): number[] {
    return this.viewer.getView();
  }

  setView(view: number[]) {
    this.viewer.setView(view, true);
    this.viewer.render();
    this.layout();
  }

  resize() {
    this.viewer.resize();
    this.viewer.render();
    this.layout();
  }

  destroy() {
    window.clearTimeout(this.settleTimer);
    cancelAnimationFrame(this.animating);
    this.viewer.setViewChangeCallback(null);
    this.viewer.clear();
    const canvas = this.canvasBox.querySelector("canvas");
    (canvas?.getContext("webgl2") ?? canvas?.getContext("webgl"))?.getExtension("WEBGL_lose_context")?.loseContext();
    this.halo.remove();
    this.canvasBox.remove();
    this.overlay.remove();
  }

  // ---- internals ------------------------------------------------------------

  private lastGroup: { atoms: number[]; ring: number[] } | null = null;

  private room() {
    const W = this.canvasBox.clientWidth, H = this.canvasBox.clientHeight;
    const tools = this.opts.toolRow ? 48 : 12;
    // Symmetric around the canvas centre, so user rotation pivots on the molecule.
    return this.opts.layout === "rows"
      ? { w: W - 32, h: H - 2 * Math.max(40, tools) }
      : { w: W - 2 * (this.opts.columnWidth + 16), h: H - 2 * tools };
  }

  private restyle() {
    const t = this.opts.theme;
    const ctx = this.shown.filter((a) => !this.focus?.has(a.index)).map((a) => a.index);
    const v = this.viewer;
    v.setStyle({}, {});
    const ctxStyle = this.focus ? STYLE.context : STYLE.focus;
    const ctxColours = scheme(this.focus ? FADE[t] : CPK[t]);
    v.setStyle({ index: ctx }, { stick: { radius: ctxStyle.stick, colorscheme: ctxColours }, sphere: { scale: ctxStyle.sphere, colorscheme: ctxColours } });
    if (this.focus) {
      v.setStyle({ index: [...this.focus] }, { stick: { radius: STYLE.focus.stick, colorscheme: scheme(CPK[t]) }, sphere: { scale: STYLE.focus.sphere, colorscheme: scheme(CPK[t]) } });
    }
    v.render();
  }

  // Local screen position of a model point.
  project(p: Vec3) {
    const s = this.viewer.modelToScreen({ x: p[0], y: p[1], z: p[2] }) as unknown as { x: number; y: number };
    const r = this.canvasBox.getBoundingClientRect();
    return { x: s.x - (r.left + window.scrollX), y: s.y - (r.top + window.scrollY) };
  }

  /** Screen extent of the drawn atoms, including their sphere radii and the halo rim. */
  extent() {
    const { discs } = this.geometry();
    const pad = HALO_RIM + 4;
    const x0 = Math.min(...discs.map((d) => d.x - d.r)), x1 = Math.max(...discs.map((d) => d.x + d.r));
    const y0 = Math.min(...discs.map((d) => d.y - d.r)), y1 = Math.max(...discs.map((d) => d.y + d.r));
    return { w: x1 - x0 + 2 * pad, h: y1 - y0 + 2 * pad };
  }

  /** Zoom factor that makes a screen extent of w by h fill the free area. */
  fitScaleFor(w: number, h: number): number {
    const r = this.room();
    return Math.min(r.w / w, r.h / h);
  }

  /** Screen centre of the drawn atoms' bounding box. */
  boxCentre() {
    const { discs } = this.geometry();
    const xs = discs.flatMap((d) => [d.x - d.r, d.x + d.r]), ys = discs.flatMap((d) => [d.y - d.r, d.y + d.r]);
    return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
  }

  /**
   * Move the molecule so its drawn box sits in the middle of the canvas. This
   * shifts the scene (part of the shared view state), not the camera.
   */
  centre(boxCentre: () => { x: number; y: number } = () => this.boxCentre(), afterMove: () => void = () => {}) {
    const W = this.canvasBox.clientWidth, H = this.canvasBox.clientHeight;
    for (let k = 0; k < 2; k++) {
      const c0 = boxCentre();
      this.viewer.translateScene(10, 10);
      this.viewer.render();
      afterMove();
      const c1 = boxCentre();
      const sx = (c1.x - c0.x) / 10, sy = (c1.y - c0.y) / 10;
      this.viewer.translateScene(-10, -10);
      if (Math.abs(sx) < 1e-3 || Math.abs(sy) < 1e-3) { this.viewer.render(); afterMove(); return; }
      this.viewer.translateScene((W / 2 - c0.x) / sx, (H / 2 - c0.y) / sy);
      this.viewer.render();
      afterMove();
    }
  }

  /** Zoom so the molecule fills the free area, then centre it. Returns the scale factor applied. */
  fit(): number {
    const room = this.room();
    let applied = 1;
    for (let k = 0; k < 3; k++) {
      const e = this.extent();
      const f = Math.min(room.w / e.w, room.h / e.h);
      applied *= f;
      this.viewer.zoom(f);
      this.viewer.render();
    }
    this.centre();
    return applied;
  }

  private targetQuat(group: { atoms: number[]; ring: number[] } | null): Quat {
    const pts = this.points;
    const heavyPts = this.shown.map((a) => pts[a.index]);
    if (!group) return matToQuat(principalAxes(heavyPts));
    // faceGroup works on the drawn atoms only; map group indices into that list.
    const pos = new Map(this.shown.map((a, i) => [a.index, i]));
    const g = group.atoms.map((i) => pos.get(i)).filter((i): i is number => i !== undefined);
    const r = group.ring.map((i) => pos.get(i)).filter((i): i is number => i !== undefined);
    return matToQuat(faceGroup(heavyPts, g, r, this.roomAspect));
  }

  private orient(group: { atoms: number[]; ring: number[] } | null, animate: boolean) {
    this.lastGroup = group;
    const v = this.viewer;
    const from = v.getView();
    const q = this.targetQuat(group);
    // Work out the end state (rotation and fitted zoom), then animate to it.
    const c = centroid(this.shown.map((a) => [a.x, a.y, a.z] as Vec3));
    v.setView([-c[0], -c[1], -c[2], from[3], q[0], q[1], q[2], q[3]], true);
    v.render();
    this.fit();
    const to = v.getView();
    if (!animate || this.opts.reducedMotion) {
      this.layout();
      this.opts.onViewChange?.();
      return;
    }
    v.setView(from, true);
    const start = performance.now();
    const q0 = from.slice(4, 8) as Quat, q1 = to.slice(4, 8) as Quat;
    cancelAnimationFrame(this.animating);
    this.overlay.classList.add("is-moving");
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ANIMATION_MS);
      const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      const qq = slerp(q0, q1, e);
      v.setView([0, 1, 2, 3].map((i) => from[i] + (to[i] - from[i]) * e).concat(qq), true);
      v.render();
      this.drawHalo();
      if (t < 1) this.animating = requestAnimationFrame(step);
      else {
        this.layout();
        this.opts.onViewChange?.();
      }
    };
    this.animating = requestAnimationFrame(step);
  }

  private viewChanged(fromUser: boolean) {
    if (!this.frameRequested) {
      this.frameRequested = true;
      requestAnimationFrame(() => {
        this.frameRequested = false;
        this.drawHalo();
      });
    }
    // Labels step aside while the molecule turns and come back when it settles.
    this.overlay.classList.add("is-moving");
    window.clearTimeout(this.settleTimer);
    this.settleTimer = window.setTimeout(() => this.layout(), fromUser ? 140 : 60);
    this.opts.onViewChange?.();
  }

  geometry(): Geometry & { scale: number } {
    const c = centroid(this.shown.map((a) => [a.x, a.y, a.z] as Vec3));
    const o = this.project(c);
    const d2 = (p: { x: number; y: number }) => (p.x - o.x) ** 2 + (p.y - o.y) ** 2;
    const scale = Math.sqrt((d2(this.project([c[0] + 1, c[1], c[2]])) + d2(this.project([c[0], c[1] + 1, c[2]])) + d2(this.project([c[0], c[1], c[2] + 1]))) / 2);
    const discs = this.shown.map((a) => {
      const st = this.focus && !this.focus.has(a.index) ? STYLE.context : STYLE.focus;
      return { ...this.project([a.x, a.y, a.z]), r: (VDW[a.elem] ?? 1.6) * st.sphere * scale, atom: a.index };
    });
    const byAtom = new Map(discs.map((d) => [d.atom, d]));
    const bonds: Geometry["bonds"] = [];
    for (const a of this.shown) for (const b of a.bonds) {
      if (b <= a.index || !byAtom.has(b)) continue;
      const strong = !this.focus || (this.focus.has(a.index) && this.focus.has(b));
      bonds.push({ p: byAtom.get(a.index)!, q: byAtom.get(b)!, a: a.index, b, hw: (strong ? STYLE.focus : STYLE.context).stick * scale });
    }
    return { discs, bonds, scale };
  }

  private drawHalo() {
    const W = this.canvasBox.clientWidth, H = this.canvasBox.clientHeight;
    this.halo.setAttribute("viewBox", `0 0 ${W} ${H}`);
    if (!this.focus) { this.halo.replaceChildren(); return; }
    const g = this.geometry();
    let s = "";
    for (const b of g.bonds) if (this.focus.has(b.a) && this.focus.has(b.b))
      s += `<line x1="${b.p.x.toFixed(1)}" y1="${b.p.y.toFixed(1)}" x2="${b.q.x.toFixed(1)}" y2="${b.q.y.toFixed(1)}" stroke-width="${(2 * (b.hw + HALO_RIM)).toFixed(1)}"/>`;
    for (const d of g.discs) if (this.focus.has(d.atom))
      s += `<circle cx="${d.x.toFixed(1)}" cy="${d.y.toFixed(1)}" r="${(d.r + HALO_RIM).toFixed(1)}"/>`;
    this.halo.innerHTML = s;
  }

  /** Place labels and leaders. Labels that cannot be placed without crossing the molecule are left out. */
  layout() {
    this.drawHalo();
    const W = this.canvasBox.clientWidth, H = this.canvasBox.clientHeight;
    for (const el of [...this.overlay.querySelectorAll(".figure-label")]) el.remove();
    this.leaders.setAttribute("viewBox", `0 0 ${W} ${H}`);
    this.leaders.replaceChildren();
    const order = this.labels.map((l, i) => ({ l, i })).sort((a, b) => rank(a.l.kind) - rank(b.l.kind));
    const els = order.map(({ l }) => {
      const el = document.createElement("button");
      el.type = "button";
      el.tabIndex = -1;
      el.className = `figure-label is-${l.kind}`;
      el.dataset.key = l.key;
      el.textContent = l.text;
      if (l.caption && this.opts.layout === "columns") {
        const cap = document.createElement("span");
        cap.className = "figure-label-caption";
        cap.textContent = l.caption;
        el.appendChild(cap);
      }
      el.addEventListener("click", () => this.opts.onLabelClick?.(l.key));
      this.overlay.appendChild(el);
      return el;
    });
    const g = this.geometry();
    this.placements = placeLabels(
      g,
      order.map(({ l }, k) => ({ atoms: l.atoms, w: els[k].offsetWidth, h: els[k].offsetHeight, prefer: this.opts.layout })),
      { W, H, bottomReserve: this.opts.toolRow ? 52 : 12 },
    );
    let svg = "";
    this.placements.forEach((p, k) => {
      const el = els[k], l = order[k].l;
      if (!p.ok) { el.remove(); return; }
      if (p.side === "right") el.classList.add("is-right");
      el.style.left = `${p.left}px`;
      el.style.top = `${p.top}px`;
      const d = p.path.map((pt, i) => `${i ? "L" : "M"}${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(" ");
      svg += `<path class="leader is-${l.kind}" d="${d}"/><circle class="leader-end is-${l.kind}" cx="${p.end.x.toFixed(1)}" cy="${p.end.y.toFixed(1)}" r="${l.kind === "focus" || l.kind === "shared" ? 2.5 : 2}"/>`;
    });
    this.leaders.innerHTML = svg;
    this.overlay.classList.remove("is-moving");
    this.host.dataset.labelsPlaced = String(this.placements.filter((p) => p.ok).length);
    this.host.dataset.labelsTotal = String(this.placements.length);
  }

  get placedLabels(): Placement[] {
    return this.placements;
  }
}

const rank = (k: LabelKind) => (k === "focus" || k === "shared" ? 0 : k === "diff" ? 1 : 2);

/** Frame that superimposes molecule B's core atoms onto molecule A's core (Horn's method). */
export { superimpose } from "./math.ts";
