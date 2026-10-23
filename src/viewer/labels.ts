// Label placement for the molecule figure. Pure: it works on the projected
// screen geometry, so it is tested without a browser.
//
// A label sits in a column at the figure's left or right edge, or in a row at
// its top or bottom. Its leader line starts at the label, may take a short
// horizontal stub, and ends at the edge of one atom of its group. A candidate
// is rejected if the label box or the leader touches any other atom or bond,
// or another label, or comes near another leader. Among the rest, the shortest, flattest leader wins.

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
// Two leaders closer than this read as crossing, even if they only touch.
export const LEADER_GAP = 8;

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

/** Do two leader paths cross or come within LEADER_GAP of each other? */
export function leadersClash(a: Pt[], b: Pt[]): boolean {
  for (let i = 1; i < a.length; i++) for (let j = 1; j < b.length; j++)
    if (segSegDist(a[i - 1], a[i], b[j - 1], b[j]) < LEADER_GAP) return true;
  return false;
}

/** Does any part of the leader path touch the molecule, other than its own anchor atom? */
export function leaderHitsMolecule(path: Pt[], anchor: number, g: Geometry): boolean {
  for (let k = 0; k + 1 < path.length; k++) {
    const [a, b] = [path[k], path[k + 1]];
    if (g.discs.some((d) => d.atom !== anchor && segDist(d, a, b) < d.r + CLEAR_DISC)) return true;
    if (g.bonds.some((bd) => bd.a !== anchor && bd.b !== anchor && segSegDist(a, b, bd.p, bd.q) < bd.hw + CLEAR_BOND)) return true;
  }
  return false;
}

/**
 * Places labels in turn, the first (the focused group) always first. Placement
 * is greedy, so an early label can block a later one; a few orders are tried
 * until one places them all; otherwise the one that places the most wins.
 */
export function placeLabels(g: Geometry, labels: LabelSpec[], f: Frame): Placement[] {
  const byAtom = new Map(g.discs.map((d) => [d.atom, d]));
  const centre = (l: LabelSpec) => {
    const ds = l.atoms.map((a) => byAtom.get(a)).filter((d): d is Disc => !!d);
    return ds.length ? { x: ds.reduce((s, d) => s + d.x, 0) / ds.length, y: ds.reduce((s, d) => s + d.y, 0) / ds.length } : { x: 0, y: 0 };
  };
  const rest = labels.map((_, i) => i).slice(1);
  const orders = [
    rest,
    [...rest].reverse(),
    [...rest].sort((a, b) => centre(labels[a]).x - centre(labels[b]).x),
    [...rest].sort((a, b) => centre(labels[a]).y - centre(labels[b]).y),
  ].map((o) => (labels.length ? [0, ...o] : []));
  let best: { out: Placement[]; n: number; cost: number } | null = null;
  for (const order of orders) {
    const r = placeInOrder(g, labels, f, byAtom, order);
    if (!best || r.n > best.n || (r.n === best.n && r.cost < best.cost - 1e-6)) best = r;
    // Usually the first order places every label; only then is the rest skipped.
    if (best.n === labels.length) break;
  }
  return best ? best.out : [];
}

function placeInOrder(g: Geometry, labels: LabelSpec[], f: Frame, byAtom: Map<number, Disc>, order: number[]) {
  const pad = 14;
  const bottom = f.H - f.bottomReserve;
  const placed: { rect: Rect; path: Pt[] }[] = [];
  const out: Placement[] = new Array(labels.length);
  let n = 0, total = 0;

  order.forEach((i) => {
    const l = labels[i];
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
        // A leader heads away from its label, never back past it.
        if (c.side === "left" && end.x < stub.x + 4) continue;
        if (c.side === "right" && end.x > stub.x - 4) continue;
        if (leaderHitsMolecule(path, an.atom, g)) continue;
        if (placed.some((p) => path.some((pt, k) => k > 0 && segHitsRect(path[k - 1], pt, p.rect)))) continue;
        // Crossing or touching leaders are never drawn: the label is moved, or left out.
        if (placed.some((p) => leadersClash(path, p.path))) continue;
        let length = 0;
        for (let k = 1; k < path.length; k++) length += Math.hypot(path[k].x - path[k - 1].x, path[k].y - path[k - 1].y);
        const slope = c.side === "left" || c.side === "right" ? Math.abs(stub.y - end.y) * 0.6 : Math.abs(start.x - end.x) * 0.6;
        // Two leaders ending side by side read as labels for the same atom.
        const crowded = placed.some((p) => { const e = p.path[p.path.length - 1]; return Math.hypot(e.x - end.x, e.y - end.y) < 24; });
        const cost = length + slope + c.pen + (crowded ? 150 : 0);
        if (!best || cost < best.cost) best = { ok: true, left: c.left, top: c.top, side: c.side, path, end, anchor: an.atom, cost, rect };
      }
    }
    if (best) {
      placed.push({ rect: best.rect, path: best.path });
      out[i] = { ok: true, left: best.left, top: best.top, side: best.side, path: best.path, end: best.end, anchor: best.anchor };
      n++; total += best.cost;
    } else {
      out[i] = { ok: false, left: 0, top: 0, side: "left", path: [], end: { x: 0, y: 0 }, anchor: -1 };
    }
  });
  return { out, n, cost: total };
}
