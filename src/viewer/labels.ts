// Label placement for the molecule figure. Pure: it works on the projected
// screen geometry, so it is tested without a browser.
//
// A label sits in a column at the figure's left or right edge, or in a row at
// its top or bottom. Its leader line starts at the label, may take a short
// horizontal stub, and ends at the edge of one atom of its group. A candidate
// is rejected if the label box or the leader touches any other atom or bond,
// or another label. Among the rest, the shortest, flattest leader wins.

export interface Pt { x: number; y: number }
export interface Disc extends Pt { r: number; atom: number }
export interface Bond { p: Pt; q: Pt; a: number; b: number; hw: number }
export interface Geometry { discs: Disc[]; bonds: Bond[] }

export interface LabelSpec { atoms: number[]; w: number; h: number; prefer?: "columns" | "rows" }
export interface Placement {
  ok: boolean;
  left: number;
  top: number;
  side: "left" | "right" | "top" | "bottom";
  path: Pt[];
  end: Pt;
  anchor: number;
}
export interface Frame { W: number; H: number; bottomReserve: number }

const CLEAR_DISC = 4;
const CLEAR_BOND = 3;

const segDist = (p: Pt, a: Pt, b: Pt) => {
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
};
const orient = (p: Pt, q: Pt, r: Pt) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
export const segmentsCross = (a: Pt, b: Pt, c: Pt, d: Pt) =>
  orient(a, b, c) !== orient(a, b, d) && orient(c, d, a) !== orient(c, d, b);
const segSegDist = (a: Pt, b: Pt, c: Pt, d: Pt) =>
  segmentsCross(a, b, c, d) ? 0 : Math.min(segDist(a, c, d), segDist(b, c, d), segDist(c, a, b), segDist(d, a, b));

interface Rect { x0: number; y0: number; x1: number; y1: number }
const rectHitsDisc = (r: Rect, d: Disc, m: number) => {
  const x = Math.max(r.x0, Math.min(d.x, r.x1)), y = Math.max(r.y0, Math.min(d.y, r.y1));
  return Math.hypot(d.x - x, d.y - y) < d.r + m;
};
const segHitsRect = (a: Pt, b: Pt, r: Rect) => {
  if (Math.min(a.x, b.x) > r.x1 || Math.max(a.x, b.x) < r.x0 || Math.min(a.y, b.y) > r.y1 || Math.max(a.y, b.y) < r.y0) return false;
  const inside = (p: Pt) => p.x > r.x0 && p.x < r.x1 && p.y > r.y0 && p.y < r.y1;
  const c = [{ x: r.x0, y: r.y0 }, { x: r.x1, y: r.y0 }, { x: r.x1, y: r.y1 }, { x: r.x0, y: r.y1 }];
  return inside(a) || inside(b) || [0, 1, 2, 3].some((i) => segmentsCross(a, b, c[i], c[(i + 1) % 4]));
};

/** Does any part of the leader path touch the molecule, other than its own anchor atom? */
export function leaderHitsMolecule(path: Pt[], anchor: number, g: Geometry): boolean {
  for (let k = 0; k + 1 < path.length; k++) {
    const [a, b] = [path[k], path[k + 1]];
    if (g.discs.some((d) => d.atom !== anchor && segDist(d, a, b) < d.r + CLEAR_DISC)) return true;
    if (g.bonds.some((bd) => bd.a !== anchor && bd.b !== anchor && segSegDist(a, b, bd.p, bd.q) < bd.hw + CLEAR_BOND)) return true;
  }
  return false;
}

export function placeLabels(g: Geometry, labels: LabelSpec[], f: Frame): Placement[] {
  const pad = 14;
  const bottom = f.H - f.bottomReserve;
  const byAtom = new Map(g.discs.map((d) => [d.atom, d]));
  const placed: { rect: Rect; path: Pt[] }[] = [];
  const out: Placement[] = new Array(labels.length);

  labels.forEach((l, i) => {
    const anchors = l.atoms.map((a) => byAtom.get(a)).filter((d): d is Disc => !!d);
    const cands: { side: Placement["side"]; left: number; top: number; pen: number }[] = [];
    for (let top = pad; top + l.h <= bottom; top += 4) {
      cands.push({ side: "left", left: pad, top, pen: l.prefer === "rows" ? 120 : 0 });
      cands.push({ side: "right", left: f.W - pad - l.w, top, pen: l.prefer === "rows" ? 120 : 0 });
    }
    for (let left = pad; left + l.w <= f.W - pad; left += 6) {
      cands.push({ side: "top", left, top: pad, pen: l.prefer === "rows" ? 0 : 160 });
      cands.push({ side: "bottom", left, top: bottom - l.h, pen: l.prefer === "rows" ? 0 : 160 });
    }
    let best: (Placement & { cost: number; rect: Rect }) | null = null;
    for (const c of cands) {
      const rect = { x0: c.left - 4, y0: c.top - 4, x1: c.left + l.w + 4, y1: c.top + l.h + 4 };
      if (g.discs.some((d) => rectHitsDisc(rect, d, 2))) continue;
      if (g.bonds.some((b) => segHitsRect(b.p, b.q, rect))) continue;
      if (placed.some((p) => !(rect.x1 + 4 < p.rect.x0 || rect.x0 - 4 > p.rect.x1 || rect.y1 + 4 < p.rect.y0 || rect.y0 - 4 > p.rect.y1))) continue;
      // A new label must not sit on a leader that is already drawn.
      if (placed.some((p) => p.path.some((pt, k) => k > 0 && segHitsRect(p.path[k - 1], pt, rect)))) continue;
      for (const an of anchors) {
        let start: Pt, stub: Pt;
        if (c.side === "left" || c.side === "right") {
          start = { x: c.side === "left" ? c.left + l.w + 6 : c.left - 6, y: c.top + 9 };
          stub = { x: c.side === "left" ? start.x + 10 : start.x - 10, y: start.y };
        } else {
          start = { x: Math.min(Math.max(an.x, c.left + 6), c.left + l.w - 6), y: c.side === "top" ? c.top + l.h + 4 : c.top - 4 };
          stub = start;
        }
        const dx = stub.x - an.x, dy = stub.y - an.y, len = Math.hypot(dx, dy) || 1;
        const end = { x: an.x + (dx / len) * (an.r + 2), y: an.y + (dy / len) * (an.r + 2) };
        const path = stub === start ? [start, end] : [start, stub, end];
        if (leaderHitsMolecule(path, an.atom, g)) continue;
        if (placed.some((p) => path.some((pt, k) => k > 0 && segHitsRect(path[k - 1], pt, p.rect)))) continue;
        let crossings = 0;
        for (const p of placed) for (let a = 1; a < p.path.length; a++) for (let b = 1; b < path.length; b++)
          if (segmentsCross(path[b - 1], path[b], p.path[a - 1], p.path[a])) crossings++;
        let length = 0;
        for (let k = 1; k < path.length; k++) length += Math.hypot(path[k].x - path[k - 1].x, path[k].y - path[k - 1].y);
        const slope = c.side === "left" || c.side === "right" ? Math.abs(stub.y - end.y) * 0.6 : Math.abs(start.x - end.x) * 0.6;
        const cost = length + slope + c.pen + crossings * 400;
        if (!best || cost < best.cost) best = { ok: true, left: c.left, top: c.top, side: c.side, path, end, anchor: an.atom, cost, rect };
      }
    }
    if (best) {
      placed.push({ rect: best.rect, path: best.path });
      out[i] = { ok: true, left: best.left, top: best.top, side: best.side, path: best.path, end: best.end, anchor: best.anchor };
    } else {
      out[i] = { ok: false, left: 0, top: 0, side: "left", path: [], end: { x: 0, y: 0 }, anchor: -1 };
    }
  });
  return out;
}
