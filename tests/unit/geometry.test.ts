// Orientation and label placement, tested on the real starter-set structures
// with a simple orthographic projection instead of a browser.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import {
  apply, faceGroup, matToQuat, principalAxes, quatToMat, ringReport, slerp, superimpose, type Mat3, type Vec3,
} from "../../src/viewer/math.ts";
import { leaderHitsMolecule, leadersClash, placeLabels, segmentsCross, type Geometry } from "../../src/viewer/labels.ts";
import { coreRmsd } from "../../src/viewer/compare.ts";
import type { Drug, Pair } from "../../src/data/types.ts";

const drug = (slug: string): Drug => JSON.parse(fs.readFileSync(`public/data/drugs/${slug}.json`, "utf8"));
const slugs = fs.readdirSync("public/data/drugs").map((f) => f.replace(/\.json$/, ""));

function parseSdf(sdf: string) {
  const lines = sdf.split(/\r?\n/);
  const n = parseInt(lines[3].slice(0, 3), 10), nb = parseInt(lines[3].slice(3, 6), 10);
  const atoms = lines.slice(4, 4 + n).map((l) => ({ p: [parseFloat(l.slice(0, 10)), parseFloat(l.slice(10, 20)), parseFloat(l.slice(20, 30))] as Vec3, el: l.slice(31, 34).trim() }));
  const bonds = lines.slice(4 + n, 4 + n + nb).map((l) => [parseInt(l.slice(0, 3), 10) - 1, parseInt(l.slice(3, 6), 10) - 1] as [number, number]);
  // Hydrogens on carbon are hidden in the figure, as in the app.
  const hidden = new Set(atoms.map((_, i) => i).filter((i) => atoms[i].el === "H" && bonds.some(([a, b]) => (a === i && atoms[b].el === "C") || (b === i && atoms[a].el === "C"))));
  return { atoms, bonds, hidden };
}

const randomRotation = (seed: number): Mat3 => {
  const r = (k: number) => Math.sin(seed * 12.9898 + k * 78.233) * 0.5;
  const q: [number, number, number, number] = [r(1), r(2), r(3), 1];
  const l = Math.hypot(...q);
  return quatToMat(q.map((v) => v / l) as [number, number, number, number]);
};

describe("face-on orientation of rings", () => {
  for (const slug of ["amoxicillin", "phenoxymethylpenicillin", "cefuroxime"]) {
    it(`${slug}: the β-lactam ring faces the reader with no atom in front of it`, () => {
      const d = drug(slug);
      const { atoms, hidden } = parseSdf(d.sdf);
      const g = d.groups.find((x) => x.ruleId === "beta_lactam")!;
      const pts = atoms.map((a) => a.p);
      const R = faceGroup(pts, g.atoms, g.ring, 1.6);
      const rep = ringReport(pts, g.ring, R, hidden);
      expect(rep.facing).toBeGreaterThan(0.999);
      expect(rep.minSeparation).toBeGreaterThan(1.2);
      expect(rep.occluders).toBe(0);
    });
  }

  it("every ring group in the starter set can be shown face-on without overlapping ring atoms", () => {
    let rings = 0;
    for (const slug of slugs) {
      const d = drug(slug);
      const { atoms, hidden } = parseSdf(d.sdf);
      const pts = atoms.map((a) => a.p);
      for (const g of d.groups.filter((x) => x.ring.length >= 4 && x.count === 1)) {
        const R = faceGroup(pts, g.atoms, g.ring, 1.6);
        const rep = ringReport(pts, g.ring, R, hidden);
        expect(rep.facing, `${slug} ${g.ruleId}`).toBeGreaterThan(0.95);
        expect(rep.minSeparation, `${slug} ${g.ruleId}`).toBeGreaterThan(1.0);
        rings++;
      }
    }
    expect(rings).toBeGreaterThan(30);
  });
});

describe("rotation maths", () => {
  it("quaternion and matrix convert both ways", () => {
    const R = randomRotation(3);
    const R2 = quatToMat(matToQuat(R));
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) expect(R2[i][j]).toBeCloseTo(R[i][j], 9);
  });
  it("slerp starts and ends at its endpoints", () => {
    const a = matToQuat(randomRotation(1)), b = matToQuat(randomRotation(2));
    slerp(a, b, 0).forEach((v, i) => expect(v).toBeCloseTo(a[i], 9));
    const end = slerp(a, b, 1), sign = Math.sign(end[3] * b[3]) || 1;
    end.forEach((v, i) => expect(v * sign).toBeCloseTo(b[i], 9));
  });
  it("principal axes put the longest extent on x", () => {
    const pts: Vec3[] = [[0, 0, 0], [10, 1, 0], [5, 0.5, 0.2], [2, -0.3, 0.1]];
    const R = principalAxes(pts);
    const xs = pts.map((p) => apply(R, p)[0]), ys = pts.map((p) => apply(R, p)[1]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(Math.max(...ys) - Math.min(...ys));
  });
  it("superimposition recovers a known rotation", () => {
    const P: Vec3[] = [[1, 0, 0], [0, 2, 0], [0, 0, 3], [-1, -1, 1]];
    const R = randomRotation(7);
    const Q = P.map((p) => apply(R, p));
    const R2 = superimpose(P, Q);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) expect(R2[i][j]).toBeCloseTo(R[i][j], 6);
  });
  it("comparison cores superimpose closely for the featured pairs", () => {
    const pairs: Record<string, Pair> = JSON.parse(fs.readFileSync("public/data/pairs.json", "utf8"));
    const p = pairs["amoxicillin|phenoxymethylpenicillin"];
    expect(p.size).toBe(17);
    expect(coreRmsd(drug(p.a).sdf, p.core.a, drug(p.b).sdf, p.core.b)).toBeLessThan(1.0);
  });
});

describe("label placement", () => {
  const W = 880, H = 560;
  // Project a drug the way the app does after turning a group to the reader.
  function geometryFor(slug: string, groupId?: string, W = 880, H = 560): { g: Geometry; d: Drug } {
    const d = drug(slug);
    const { atoms, bonds, hidden } = parseSdf(d.sdf);
    const pts = atoms.map((a) => a.p);
    const grp = d.groups.find((x) => x.ruleId === groupId) ?? d.groups[0];
    const R = grp ? faceGroup(pts, grp.atoms, grp.ring, (W - 2 * 196) / (H - 96)) : principalAxes(pts);
    const shown = atoms.map((_, i) => i).filter((i) => !hidden.has(i));
    const q = pts.map((p) => apply(R, p));
    const xs = shown.map((i) => q[i][0]), ys = shown.map((i) => q[i][1]);
    const scale = Math.min((W - 2 * 196) / (Math.max(...xs) - Math.min(...xs) + 2), (H - 96) / (Math.max(...ys) - Math.min(...ys) + 2));
    const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2;
    const scr = (i: number) => ({ x: W / 2 + (q[i][0] - cx) * scale, y: H / 2 - 20 - (q[i][1] - cy) * scale });
    const vdw: Record<string, number> = { H: 1.2, C: 1.7, N: 1.55, O: 1.52, S: 1.8, F: 1.47, Cl: 1.75 };
    const discs = shown.map((i) => ({ ...scr(i), r: (vdw[atoms[i].el] ?? 1.6) * 0.23 * scale, atom: i }));
    const byAtom = new Map(discs.map((x) => [x.atom, x]));
    const gb = bonds.filter(([a, b]) => byAtom.has(a) && byAtom.has(b)).map(([a, b]) => ({ p: byAtom.get(a)!, q: byAtom.get(b)!, a, b, hw: 0.14 * scale }));
    return { g: { discs, bonds: gb }, d };
  }

  it("leaders and labels never touch the molecule or each other, across the whole starter set", () => {
    let total = 0, placed = 0;
    for (const slug of slugs) {
      const { g, d } = geometryFor(slug);
      const specs = d.groups.map((x, k) => ({ atoms: x.atoms, anchor: x.anchor, w: 8 + 7 * x.name.length * 0.62, h: k === 0 ? 72 : 18, prefer: "columns" as const }));
      const res = placeLabels(g, specs, { W, H, bottomReserve: 52 });
      total += res.length;
      const ok = res.filter((r) => r.ok);
      placed += ok.length;
      for (const r of ok) {
        expect(leaderHitsMolecule(r.path, r.anchor, g), `${slug} leader`).toBe(false);
        // Leaders head away from their label.
        const [s0, e] = [r.path[r.path.length - 2], r.end];
        if (r.side === "left") expect(e.x, `${slug} leader heads back`).toBeGreaterThan(s0.x);
        if (r.side === "right") expect(e.x, `${slug} leader heads back`).toBeLessThan(s0.x);
        expect(r.left).toBeGreaterThanOrEqual(0);
        expect(r.top).toBeGreaterThanOrEqual(0);
      }
      // No two labels overlap.
      ok.forEach((a, i) => ok.slice(i + 1).forEach((b) => {
        const wa = specs[res.indexOf(a)].w, ha = specs[res.indexOf(a)].h, wb = specs[res.indexOf(b)].w, hb = specs[res.indexOf(b)].h;
        const apart = a.left + wa <= b.left || b.left + wb <= a.left || a.top + ha <= b.top || b.top + hb <= a.top;
        expect(apart, `${slug} labels overlap`).toBe(true);
      }));
    }
    // Labels that cannot be placed cleanly are left out rather than drawn across atoms.
    expect(placed / total).toBeGreaterThan(0.95);
  });

  // Wide figures put labels in columns; phone figures put them in rows.
  for (const [layout, fw, fh, prefer] of [["columns", 880, 560, "columns"], ["rows, phone", 340, 520, "rows"]] as const) {
    it(`leader lines never cross or touch each other (${layout}), across the whole starter set`, () => {
      const clashes: string[] = [];
      let total = 0, placed = 0;
      for (const slug of slugs) {
        const { g, d } = geometryFor(slug, undefined, fw, fh);
        const specs = d.groups.map((x, k) => ({ atoms: x.atoms, anchor: x.anchor, w: 8 + 7 * x.name.length * 0.62, h: k === 0 && prefer === "columns" ? 72 : 18, prefer }));
        const res = placeLabels(g, specs, { W: fw, H: fh, bottomReserve: 52 });
        const ok = res.filter((r) => r.ok);
        total += res.length; placed += ok.length;
        ok.forEach((a, i) => ok.slice(i + 1).forEach((b) => { if (leadersClash(a.path, b.path)) clashes.push(slug); }));
      }
      expect(clashes).toEqual([]);
      // The group list always names every group; the figure leaves out a label
      // it cannot place cleanly. Narrow phone figures have less room (99 of 121).
      expect(placed / total).toBeGreaterThan(prefer === "rows" ? 0.8 : 0.95);
    });
  }

  for (const [layout, fw, fh, prefer] of [["columns", 880, 560, "columns"], ["rows, phone", 340, 520, "rows"]] as const) {
    it(`a primary amine label points at its nitrogen (${layout})`, () => {
      let checked = 0;
      for (const slug of slugs) {
        const d = drug(slug);
        const k = d.groups.findIndex((x) => x.ruleId === "primary_amine");
        if (k < 0) continue;
        // Every group in focus once, as the reader steps through them.
        for (const focus of d.groups) {
          const { g } = geometryFor(slug, focus.ruleId, fw, fh);
          const order = [focus, ...d.groups.filter((x) => x !== focus)];
          const specs = order.map((x, i) => ({ atoms: x.atoms, anchor: x.anchor, w: 8 + 7 * x.name.length * 0.62, h: i === 0 && prefer === "columns" ? 72 : 18, prefer }));
          const res = placeLabels(g, specs, { W: fw, H: fh, bottomReserve: 52 });
          const r = res[order.findIndex((x) => x.ruleId === "primary_amine")];
          if (!r.ok) continue;
          expect(parseSdf(d.sdf).atoms[r.anchor].el, `${slug}, ${focus.ruleId} in focus`).toBe("N");
          checked++;
        }
      }
      expect(checked).toBeGreaterThan(5);
    });
  }

  it("detects a leader that would cross a bond", () => {
    const g: Geometry = {
      discs: [{ x: 100, y: 100, r: 8, atom: 0 }, { x: 200, y: 100, r: 8, atom: 1 }],
      bonds: [{ p: { x: 150, y: 50 }, q: { x: 150, y: 150 }, a: 2, b: 3, hw: 3 }],
    };
    expect(leaderHitsMolecule([{ x: 20, y: 100 }, { x: 192, y: 100 }], 1, g)).toBe(true);
    expect(leaderHitsMolecule([{ x: 20, y: 100 }, { x: 92, y: 100 }], 0, g)).toBe(false);
  });

  it("segment crossing is symmetric", () => {
    const a = { x: 0, y: 0 }, b = { x: 10, y: 10 }, c = { x: 0, y: 10 }, d = { x: 10, y: 0 };
    expect(segmentsCross(a, b, c, d)).toBe(true);
    expect(segmentsCross(c, d, a, b)).toBe(true);
    expect(segmentsCross(a, c, b, d)).toBe(false);
  });
});
