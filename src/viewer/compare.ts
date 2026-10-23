// Comparison helpers: superimpose molecule B on molecule A by their shared core,
// and give both figures one camera so the cores sit on the same spot.

import { centroid, faceGroup, matToQuat, superimpose, type Mat3, type Vec3 } from "./math.ts";
import type { MoleculeFigure } from "./figure.ts";

export function readSdfCoords(sdf: string): Vec3[] {
  const lines = sdf.split(/\r?\n/);
  const n = parseInt(lines[3].slice(0, 3), 10);
  return lines.slice(4, 4 + n).map((l) => [parseFloat(l.slice(0, 10)), parseFloat(l.slice(10, 20)), parseFloat(l.slice(20, 30))]);
}

/** Transform for molecule B that lays its core atoms over molecule A's core atoms. */
export function coreTransform(sdfA: string, coreA: number[], sdfB: string, coreB: number[]): { R: Mat3; from: Vec3; to: Vec3 } {
  const A = readSdfCoords(sdfA), B = readSdfCoords(sdfB);
  const P = coreB.map((i) => B[i]), Q = coreA.map((i) => A[i]);
  const from = centroid(P), to = centroid(Q);
  const R = superimpose(P.map((p) => [p[0] - from[0], p[1] - from[1], p[2] - from[2]] as Vec3), Q.map((q) => [q[0] - to[0], q[1] - to[1], q[2] - to[2]] as Vec3));
  return { R, from, to };
}

/** Root-mean-square distance between the two cores after superimposition, in ångström. */
export function coreRmsd(sdfA: string, coreA: number[], sdfB: string, coreB: number[]): number {
  const { R, from, to } = coreTransform(sdfA, coreA, sdfB, coreB);
  const A = readSdfCoords(sdfA), B = readSdfCoords(sdfB);
  let s = 0;
  coreA.forEach((ia, k) => {
    const b = B[coreB[k]];
    const p = [b[0] - from[0], b[1] - from[1], b[2] - from[2]];
    const r = R.map((row) => row[0] * p[0] + row[1] * p[1] + row[2] * p[2]);
    s += (r[0] + to[0] - A[ia][0]) ** 2 + (r[1] + to[1] - A[ia][1]) ** 2 + (r[2] + to[2] - A[ia][2]) ** 2;
  });
  return Math.sqrt(s / coreA.length);
}

/**
 * One camera for both figures: turn A's core ring (if any) to face the reader,
 * centre on both molecules together and zoom until the larger one fits.
 */
export function shareView(A: MoleculeFigure, B: MoleculeFigure, coreA: number[], ringA: number[]) {
  const pts: Vec3[] = [...A.shown, ...B.shown].map((a) => [a.x, a.y, a.z]);
  const c = centroid(pts);
  const shownA = A.shown.map((a) => a.index);
  const pos = new Map(shownA.map((idx, i) => [idx, i]));
  const map = (xs: number[]) => xs.map((i) => pos.get(i)).filter((i): i is number => i !== undefined);
  const q = matToQuat(faceGroup(A.shown.map((a) => [a.x, a.y, a.z] as Vec3), map(coreA), map(ringA), A.roomAspect));
  const view = A.getView();
  A.setView([-c[0], -c[1], -c[2], view[3], ...q]);
  const sync = () => B.setView(A.getView());
  // Screen box around both molecules together (they share one camera).
  const union = () => {
    const ds = [...A.geometry().discs, ...B.geometry().discs];
    const x0 = Math.min(...ds.map((d) => d.x - d.r)), x1 = Math.max(...ds.map((d) => d.x + d.r));
    const y0 = Math.min(...ds.map((d) => d.y - d.r)), y1 = Math.max(...ds.map((d) => d.y + d.r));
    return { w: x1 - x0 + 16, h: y1 - y0 + 16, x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
  };
  for (let k = 0; k < 3; k++) {
    sync();
    const u = union();
    A.zoom(A.fitScaleFor(u.w, u.h));
  }
  sync();
  A.centre(() => union(), sync);
  sync();
  A.viewer.linkViewer(B.viewer);
  B.viewer.linkViewer(A.viewer);
}
