// Small 3D maths for orienting molecules. No dependencies, so it is unit-tested directly.

export type Vec3 = [number, number, number];
export type Mat3 = [Vec3, Vec3, Vec3];

export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(...a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
export const apply = (R: Mat3, p: Vec3): Vec3 => [dot(R[0], p), dot(R[1], p), dot(R[2], p)];
export const mul = (A: Mat3, B: Mat3): Mat3 =>
  A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j])) as Mat3;
export const identity = (): Mat3 => [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

export function centroid(pts: Vec3[]): Vec3 {
  const c: Vec3 = [0, 0, 0];
  for (const p of pts) for (let k = 0; k < 3; k++) c[k] += p[k] / pts.length;
  return c;
}

// Jacobi eigen-decomposition of a symmetric matrix, eigenvalues sorted high to low.
export function jacobi(A: number[][]): { val: number; vec: number[] }[] {
  const n = A.length;
  const a = A.map((r) => r.slice());
  const v: number[][] = a.map((_, i) => a.map((__, j) => (i === j ? 1 : 0)));
  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += a[p][q] ** 2;
    if (off < 1e-14) break;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
      if (Math.abs(a[p][q]) < 1e-15) continue;
      const th = (a[q][q] - a[p][p]) / (2 * a[p][q]);
      const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < n; k++) {
        const akp = a[k][p], akq = a[k][q];
        a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq;
      }
      for (let k = 0; k < n; k++) {
        const apk = a[p][k], aqk = a[q][k];
        a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk;
      }
      for (let k = 0; k < n; k++) {
        const vkp = v[k][p], vkq = v[k][q];
        v[k][p] = c * vkp - s * vkq; v[k][q] = s * vkp + c * vkq;
      }
    }
  }
  return a.map((_, i) => ({ val: a[i][i], vec: v.map((r) => r[i]) })).sort((x, y) => y.val - x.val);
}

function covariance(pts: Vec3[], c: Vec3): number[][] {
  const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const p of pts) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i][j] += (p[i] - c[i]) * (p[j] - c[j]);
  return C;
}

// Rotation whose rows are the principal axes: the longest extent goes to screen x.
export function principalAxes(pts: Vec3[]): Mat3 {
  const e = jacobi(covariance(pts, centroid(pts)));
  const x = norm(e[0].vec as Vec3), y = norm(e[1].vec as Vec3);
  return [x, y, cross(x, y)];
}

export function planeNormal(pts: Vec3[]): Vec3 {
  return norm(jacobi(covariance(pts, centroid(pts)))[2].vec as Vec3);
}

// Rotation that sends unit vector n to +z (towards the reader).
export function toZ(n: Vec3): Mat3 {
  const helper: Vec3 = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const x = norm(cross(helper, n));
  return [x, cross(n, x), n];
}

export const spinZ = (t: number): Mat3 => [[Math.cos(t), -Math.sin(t), 0], [Math.sin(t), Math.cos(t), 0], [0, 0, 1]];

// Rotation that lays a bond in the screen plane (perpendicular to the view).
function bondInPlane(d: Vec3): Mat3 {
  const x = norm(d);
  const helper: Vec3 = Math.abs(x[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0];
  const y = norm(cross(helper, x));
  return [x, y, cross(x, y)];
}

/**
 * Orientation that shows a group best: a ring (or any planar group) faces the
 * reader, a two-atom group lies flat in the screen. The rest of the molecule is
 * kept behind the group, and the spin about the view axis is chosen so the
 * molecule fills a frame of the given aspect ratio (width / height).
 */
export function faceGroup(points: Vec3[], group: number[], ring: number[], aspect: number): Mat3 {
  const focus = ring.length >= 3 ? ring : group;
  const fp = focus.map((i) => points[i]);
  const c = centroid(fp);
  let R0: Mat3;
  if (fp.length >= 3) {
    let n = planeNormal(fp);
    const bulk = points.reduce((s, p) => s + dot(sub(p, c), n), 0);
    if (bulk > 0) n = [-n[0], -n[1], -n[2]];
    R0 = toZ(n);
  } else if (fp.length === 2) {
    R0 = bondInPlane(sub(fp[1], fp[0]));
    // Put the bulk behind: flip about x if most atoms are in front.
    const bulk = points.reduce((s, p) => s + apply(R0, sub(p, c))[2], 0);
    if (bulk > 0) R0 = mul([[1, 0, 0], [0, -1, 0], [0, 0, -1]], R0);
  } else {
    R0 = principalAxes(points);
  }
  let best = { score: -Infinity, R: R0 };
  for (let deg = 0; deg < 360; deg += 3) {
    const R = mul(spinZ((deg * Math.PI) / 180), R0);
    const q = points.map((p) => apply(R, sub(p, c)));
    const xs = q.map((p) => p[0]), ys = q.map((p) => p[1]);
    const w = Math.max(...xs) - Math.min(...xs) + 2, h = Math.max(...ys) - Math.min(...ys) + 2;
    const score = Math.min(aspect / w, 1 / h);
    if (score > best.score + 1e-9) best = { score, R };
  }
  return best.R;
}

/**
 * Quality of a face-on orientation, for tests: how square-on the ring is (1 is
 * perfect), the smallest on-screen distance between two ring atoms in ångström,
 * and how many other drawn atoms sit in front of a ring atom and overlap it.
 */
export function ringReport(points: Vec3[], ring: number[], R: Mat3, skip: Set<number> = new Set()) {
  const q = points.map((p) => apply(R, p));
  const rp = ring.map((i) => q[i]);
  const n = planeNormal(rp);
  let minSeparation = Infinity;
  for (let i = 0; i < rp.length; i++) for (let j = i + 1; j < rp.length; j++)
    minSeparation = Math.min(minSeparation, Math.hypot(rp[i][0] - rp[j][0], rp[i][1] - rp[j][1]));
  const occluders = q.filter((p, i) => !ring.includes(i) && !skip.has(i) &&
    rp.some((r) => p[2] > r[2] + 0.2 && Math.hypot(p[0] - r[0], p[1] - r[1]) < 0.7)).length;
  return { facing: Math.abs(n[2]), minSeparation, occluders };
}

// Horn's method: the rotation that best superimposes centred points P onto Q.
export function superimpose(P: Vec3[], Q: Vec3[]): Mat3 {
  const S = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  P.forEach((p, k) => { for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) S[i][j] += p[i] * Q[k][j]; });
  const [[xx, xy, xz], [yx, yy, yz], [zx, zy, zz]] = S;
  const N = [
    [xx + yy + zz, yz - zy, zx - xz, xy - yx],
    [yz - zy, xx - yy - zz, xy + yx, zx + xz],
    [zx - xz, xy + yx, -xx + yy - zz, yz + zy],
    [xy - yx, zx + xz, yz + zy, -xx - yy + zz],
  ];
  const [w, x, y, z] = jacobi(N)[0].vec;
  return quatToMat([x, y, z, w]);
}

export type Quat = [number, number, number, number]; // x, y, z, w

export function quatToMat([x, y, z, w]: Quat): Mat3 {
  return [
    [w * w + x * x - y * y - z * z, 2 * (x * y - w * z), 2 * (x * z + w * y)],
    [2 * (x * y + w * z), w * w - x * x + y * y - z * z, 2 * (y * z - w * x)],
    [2 * (x * z - w * y), 2 * (y * z + w * x), w * w - x * x - y * y + z * z],
  ];
}

export function matToQuat(m: Mat3): Quat {
  const t = m[0][0] + m[1][1] + m[2][2];
  let x, y, z, w;
  if (t > 0) {
    const s = 0.5 / Math.sqrt(t + 1);
    w = 0.25 / s; x = (m[2][1] - m[1][2]) * s; y = (m[0][2] - m[2][0]) * s; z = (m[1][0] - m[0][1]) * s;
  } else if (m[0][0] > m[1][1] && m[0][0] > m[2][2]) {
    const s = 2 * Math.sqrt(1 + m[0][0] - m[1][1] - m[2][2]);
    w = (m[2][1] - m[1][2]) / s; x = 0.25 * s; y = (m[0][1] + m[1][0]) / s; z = (m[0][2] + m[2][0]) / s;
  } else if (m[1][1] > m[2][2]) {
    const s = 2 * Math.sqrt(1 + m[1][1] - m[0][0] - m[2][2]);
    w = (m[0][2] - m[2][0]) / s; x = (m[0][1] + m[1][0]) / s; y = 0.25 * s; z = (m[1][2] + m[2][1]) / s;
  } else {
    const s = 2 * Math.sqrt(1 + m[2][2] - m[0][0] - m[1][1]);
    w = (m[1][0] - m[0][1]) / s; x = (m[0][2] + m[2][0]) / s; y = (m[1][2] + m[2][1]) / s; z = 0.25 * s;
  }
  const l = Math.hypot(x, y, z, w);
  return [x / l, y / l, z / l, w / l];
}

export function slerp(a: Quat, b: Quat, t: number): Quat {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  const bb = d < 0 ? (b.map((v) => -v) as Quat) : b;
  d = Math.abs(d);
  if (d > 0.9995) {
    const r = a.map((v, i) => v + (bb[i] - v) * t) as Quat;
    const l = Math.hypot(...r);
    return r.map((v) => v / l) as Quat;
  }
  const th = Math.acos(d), s = Math.sin(th);
  const wa = Math.sin((1 - t) * th) / s, wb = Math.sin(t * th) / s;
  return a.map((v, i) => wa * v + wb * bb[i]) as Quat;
}
