// Chemsisy design mocks: real 3Dmol.js rendering of PubChem 3D conformers,
// with textbook-style labels drawn in an SVG layer from modelToScreen().
/* global $3Dmol */

const params = new URLSearchParams(location.search);
const theme = params.get("theme") || "light";
const palette = params.get("palette") || "A";
document.documentElement.dataset.theme = theme;
document.documentElement.dataset.palette = palette;
let cssHost = document.documentElement;
const css = (name) => getComputedStyle(cssHost).getPropertyValue(name).trim();

export const ICON = {
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8 1c0 1.7-2.4 2.2-2.4 3.7"/><path d="M12 17.2v.1"/>',
  reset: '<path d="M4 12a8 8 0 1 0 2.6-5.9"/><path d="M4 4v4.5h4.5"/>',
  table: '<rect x="3.5" y="4.5" width="17" height="15" rx="1"/><path d="M3.5 9.5h17M3.5 14.5h17M9.5 9.5v10"/>',
  groups: '<circle cx="8" cy="9" r="2.5"/><circle cx="16" cy="15" r="2.5"/><path d="M10.2 10.4l3.6 3.2"/>',
  swap: '<path d="M7 7h12l-3-3M17 17H5l3 3"/>',
  ext: '<path d="M14 5h5v5"/><path d="M19 5l-8 8"/><path d="M17 14v5H5V7h5"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  dash: '<path d="M7 12h10"/>',
};
export const icon = (n) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICON[n]}</svg>`;

// ---- small linear algebra: Jacobi eigen for symmetric matrices -------------
function jacobi(A) {
  const n = A.length, a = A.map((r) => r.slice()), v = a.map((_, i) => a.map((_, j) => (i === j ? 1 : 0)));
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
const centroid = (pts) => pts.reduce((c, p) => [c[0] + p[0] / pts.length, c[1] + p[1] / pts.length, c[2] + p[2] / pts.length], [0, 0, 0]);
const apply = (R, p) => [0, 1, 2].map((i) => R[i][0] * p[0] + R[i][1] * p[1] + R[i][2] * p[2]);

// Principal axes: longest extent to screen x, second to y, so molecules read wide.
function principalFrame(pts) {
  const c = centroid(pts), C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const p of pts) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i][j] += (p[i] - c[i]) * (p[j] - c[j]);
  const e = jacobi(C);
  const x = e[0].vec, y = e[1].vec;
  const z = [x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0]];
  return { c, R: [x, y, z] };
}
// Horn's quaternion method: rotation taking points P onto Q (both centred).
function hornRotation(P, Q) {
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
  return [
    [w * w + x * x - y * y - z * z, 2 * (x * y - w * z), 2 * (x * z + w * y)],
    [2 * (x * y + w * z), w * w - x * x + y * y - z * z, 2 * (y * z - w * x)],
    [2 * (x * z - w * y), 2 * (y * z + w * x), w * w - x * x - y * y + z * z],
  ];
}


// ---- orientation ------------------------------------------------------------
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(...a); return a.map((v) => v / l); };
function planeNormal(pts) {
  const c = centroid(pts), C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const p of pts) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i][j] += (p[i] - c[i]) * (p[j] - c[j]);
  return { c, n: jacobi(C)[2].vec };
}
// Rotation whose third row is n: applying it sends n to +z (towards the reader).
function toZ(n) {
  const helper = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const x = norm(cross(helper, n)), y = cross(n, x);
  return [x, y, n];
}
const spinZ = (t) => [[Math.cos(t), -Math.sin(t), 0], [Math.sin(t), Math.cos(t), 0], [0, 0, 1]];
const mul = (A, B) => A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));

// Turn a ring so its plane faces the reader, with the rest of the molecule behind it,
// then spin it about the view axis so the molecule fills the figure's free area best.
export function faceRing(points, ring, aspect) {
  const rp = ring.map((i) => points[i]);
  let { c, n } = planeNormal(rp);
  const bulk = points.reduce((s, p) => s + dot([p[0] - c[0], p[1] - c[1], p[2] - c[2]], n), 0);
  if (bulk > 0) n = n.map((v) => -v);
  const R0 = toZ(n);
  let best = null;
  for (let deg = 0; deg < 360; deg += 3) {
    const R = mul(spinZ((deg * Math.PI) / 180), R0);
    const q = points.map((p) => apply(R, [p[0] - c[0], p[1] - c[1], p[2] - c[2]]));
    const xs = q.map((p) => p[0]), ys = q.map((p) => p[1]);
    const w = Math.max(...xs) - Math.min(...xs) + 2, h = Math.max(...ys) - Math.min(...ys) + 2;
    const scale = Math.min(aspect / w, 1 / h);
    if (!best || scale > best.scale + 1e-9) best = { scale, R };
  }
  return { c, R: best.R };
}

// Quality numbers for the orientation test: how face-on the ring is, the closest
// two ring atoms come on screen, and how many other atoms sit in front of the ring.
export function ringReport(points, ring, skip = new Set()) {
  const rp = ring.map((i) => points[i]);
  const { c, n } = planeNormal(rp);
  let minSep = Infinity;
  for (let i = 0; i < rp.length; i++) for (let j = i + 1; j < rp.length; j++)
    minSep = Math.min(minSep, Math.hypot(rp[i][0] - rp[j][0], rp[i][1] - rp[j][1]));
  // An occluder is a non-ring atom drawn in front of a ring atom and overlapping it on screen.
  const occluders = points.filter((p, i) => !ring.includes(i) && !skip.has(i) &&
    rp.some((r) => p[2] > r[2] + 0.2 && Math.hypot(p[0] - r[0], p[1] - r[1]) < 0.7)).length;
  return { facing: Math.abs(n[2]), minSeparation: minSep, occluders };
}

// ---- colours ---------------------------------------------------------------
const CPK = {
  light: { C: "#4d535a", H: "#e9ebed", O: "#e0301e", N: "#2f5be8", S: "#d4b000", F: "#3fbf3f", Cl: "#2fa82f" },
  dark: { C: "#aab0b6", H: "#d9dde1", O: "#ff5a48", N: "#6a8cff", S: "#f0d040", F: "#7be07b", Cl: "#5fd05f" },
};
// Context atoms: same hues, pushed towards the background so the focus reads first.
const FADE = {
  light: { C: "#d9dde1", H: "#f1f2f4", O: "#f2cdc8", N: "#cfd7f3", S: "#efe6bf", F: "#cfeccf", Cl: "#cfe8cf" },
  dark: { C: "#3d4349", H: "#4a5056", O: "#5a3a37", N: "#3a4363", S: "#575132", F: "#36503a", Cl: "#344d38" },
};
const scheme = (map) => ({ prop: "elem", map });
const VDW = { H: 1.2, C: 1.7, N: 1.55, O: 1.52, S: 1.8, F: 1.47, Cl: 1.75 };
const STYLE = { ctx: { stick: 0.1, sphere: 0.18 }, focus: { stick: 0.14, sphere: 0.23 } };

// ---- figure ---------------------------------------------------------------
export function figure(host, sdf, opts) {
  cssHost = host;
  const viewerEl = host.querySelector(".viewer");
  const overlay = host.querySelector(".overlay");
  let halo = host.querySelector(".halo");
  if (!halo) {
    halo = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    halo.setAttribute("class", "halo");
    host.insertBefore(halo, viewerEl);
  }
  const colW = opts.labelColumn ?? 190;
  const rows = !!opts.rows;
  // The free area for the molecule: between the label columns (or rows) and above the tool row.
  const roomFor = (W, H) => rows
    ? { w: W - 32, h: H - 2 * 40, cx: W / 2, cy: H / 2 }
    : opts.noTools
      ? { w: W - 2 * (colW + 16), h: H - 32, cx: W / 2, cy: H / 2 }
      : { w: W - 2 * (colW + 16), h: H - 96, cx: W / 2, cy: (H - 40) / 2 };
  const room = roomFor(viewerEl.clientWidth, viewerEl.clientHeight);

  const v = $3Dmol.createViewer(viewerEl, { backgroundColor: "white", backgroundAlpha: 0, antialias: true });
  const model = v.addModel(sdf, "sdf");
  const atoms = model.selectedAtoms({});
  const heavy = atoms.filter((a) => a.elem !== "H");
  const setXYZ = (fn) => { for (const a of atoms) { const p = fn([a.x, a.y, a.z]); a.x = p[0]; a.y = p[1]; a.z = p[2]; } };

  if (opts.frame) {
    const t = opts.frame.t || [0, 0, 0];
    setXYZ((p) => apply(opts.frame.R, [p[0] - opts.frame.c[0], p[1] - opts.frame.c[1], p[2] - opts.frame.c[2]]).map((v, k) => v + t[k]));
  } else if (opts.faceRing) {
    const pts = atoms.map((a) => [a.x, a.y, a.z]);
    const f = faceRing(pts, opts.faceRing, room.w / room.h);
    setXYZ((p) => apply(f.R, [p[0] - f.c[0], p[1] - f.c[1], p[2] - f.c[2]]));

  } else {
    const f = principalFrame(heavy.map((a) => [a.x, a.y, a.z]));
    setXYZ((p) => apply(f.R, [p[0] - f.c[0], p[1] - f.c[1], p[2] - f.c[2]]));
  }

  // Hydrogens on carbon are hidden; polar hydrogens stay because they matter for H-bonding.
  const hidden = new Set(atoms.filter((a) => a.elem === "H" && a.bonds.some((b) => atoms[b].elem === "C")).map((a) => a.index));
  const shown = atoms.filter((a) => !hidden.has(a.index));
  if (opts.faceRing) {
    const rep = ringReport(atoms.map((a) => [a.x, a.y, a.z]), opts.faceRing, hidden);
    console.log(`ring ${host.id} facing=${rep.facing.toFixed(4)} minSep=${rep.minSeparation.toFixed(2)}A occluders=${rep.occluders}`);
  }
  const focusSet = opts.emphasis ? new Set(opts.emphasis) : null;
  if (focusSet) for (const a of shown) if (a.elem === "H" && a.bonds.some((b) => focusSet.has(b))) focusSet.add(a.index);

  const mode = opts.theme || theme;
  const ctx = shown.filter((a) => !focusSet || !focusSet.has(a.index)).map((a) => a.index);
  v.setStyle({}, {});
  const ctxStyle = focusSet ? STYLE.ctx : STYLE.focus;
  v.setStyle({ index: ctx }, {
    stick: { radius: ctxStyle.stick, colorscheme: scheme(focusSet ? FADE[mode] : CPK[mode]) },
    sphere: { scale: ctxStyle.sphere, colorscheme: scheme(focusSet ? FADE[mode] : CPK[mode]) },
  });
  if (focusSet) v.setStyle({ index: [...focusSet] }, {
    stick: { radius: STYLE.focus.stick, colorscheme: scheme(CPK[mode]) },
    sphere: { scale: STYLE.focus.sphere, colorscheme: scheme(CPK[mode]) },
  });
  v.zoomTo({ index: shown.map((a) => a.index) });
  v.render();

  // modelToScreen returns page coordinates; convert to the figure's own box.
  const project = (x, y, z) => {
    const p = v.modelToScreen({ x, y, z }), r = viewerEl.getBoundingClientRect();
    return { x: p.x - (r.left + scrollX), y: p.y - (r.top + scrollY) };
  };
  const box = () => {
    const pts = shown.map((a) => project(a.x, a.y, a.z));
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    return { w: x1 - x0 + 24, h: y1 - y0 + 24, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, y0, y1 };
  };
  v.setZoomLimits(0, 1e4);
  const fitTo = (rm) => {
    for (let k = 0; k < 4; k++) {
      const b = box();
      v.zoom(Math.min(rm.w / b.w, rm.h / b.h)); v.render();
      const b0 = box();
      v.translate(10, 0); v.render(); const sx = (box().cx - b0.cx) / 10; v.translate(-10, 0);
      v.translate(0, 10); v.render(); const sy = (box().cy - b0.cy) / 10; v.translate(0, -10); v.render();
      const b1 = box();
      if (sx && sy) { v.translate((rm.cx - b1.cx) / sx, (rm.cy - b1.cy) / sy); v.render(); }
    }
  };
  fitTo(room);

  // Screen geometry of the drawn molecule: atom discs and bond segments.
  const geometry = () => {
    const c = centroid(shown.map((a) => [a.x, a.y, a.z]));
    const o = project(...c), ex = project(c[0] + 1, c[1], c[2]), ey = project(c[0], c[1] + 1, c[2]), ez = project(c[0], c[1], c[2] + 1);
    const d2 = (p) => (p.x - o.x) ** 2 + (p.y - o.y) ** 2;
    const ppa = Math.sqrt((d2(ex) + d2(ey) + d2(ez)) / 2);
    const disc = {};
    for (const a of shown) {
      const st = focusSet && !focusSet.has(a.index) ? STYLE.ctx : STYLE.focus;
      disc[a.index] = { ...project(a.x, a.y, a.z), r: (VDW[a.elem] || 1.6) * st.sphere * ppa, atom: a.index, focus: !!focusSet?.has(a.index) };
    }
    const bonds = [];
    for (const a of shown) for (const b of a.bonds) if (b > a.index && disc[b]) {
      const st = focusSet && !(focusSet.has(a.index) && focusSet.has(b)) ? STYLE.ctx : STYLE.focus;
      bonds.push({ p: disc[a.index], q: disc[b], a: a.index, b, hw: st.stick * ppa });
    }
    return { disc, bonds, ppa };
  };

  const layout = () => {
    const W = viewerEl.clientWidth, H = viewerEl.clientHeight, g = geometry();
    drawHalo(halo, g, focusSet, W, H);
    placeAndDraw(overlay, g, opts.labels || [], { W, H, rows, colW, noTools: !!opts.noTools });
  };
  layout();
  v.setViewChangeCallback(() => layout());
  const roomNow = () => roomFor(viewerEl.clientWidth, viewerEl.clientHeight);
  return { v, atoms, layout, project, shown, room, roomNow, host, fitTo, box };
}

// The halo sits behind the transparent WebGL canvas, so only a thin rim shows around the focused atoms.
function drawHalo(svg, g, focusSet, W, H) {
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  if (!focusSet) { svg.innerHTML = ""; return; }
  const col = css("--accent"), rim = 3.5;
  let s = "";
  for (const b of g.bonds) if (focusSet.has(b.a) && focusSet.has(b.b))
    s += `<line x1="${b.p.x}" y1="${b.p.y}" x2="${b.q.x}" y2="${b.q.y}" stroke="${col}" stroke-width="${2 * (b.hw + rim)}" stroke-linecap="round"/>`;
  for (const d of Object.values(g.disc)) if (d.focus) s += `<circle cx="${d.x}" cy="${d.y}" r="${d.r + rim}" fill="${col}"/>`;
  svg.innerHTML = s;
}

// ---- label placement: leaders never cross the molecule -----------------------
const segDist = (p, a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
};
const segsCross = (a, b, c, d) => {
  const o = (p, q, r) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
  return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b);
};
const segSegDist = (a, b, c, d) => (segsCross(a, b, c, d) ? 0 : Math.min(segDist(a, c, d), segDist(b, c, d), segDist(c, a, b), segDist(d, a, b)));
const rectHitsDisc = (r, d, m) => {
  const x = Math.max(r.x0, Math.min(d.x, r.x1)), y = Math.max(r.y0, Math.min(d.y, r.y1));
  return Math.hypot(d.x - x, d.y - y) < d.r + m;
};
const segHitsRect = (a, b, r) => {
  if (Math.min(a.x, b.x) > r.x1 || Math.max(a.x, b.x) < r.x0 || Math.min(a.y, b.y) > r.y1 || Math.max(a.y, b.y) < r.y0) return false;
  const c = [{ x: r.x0, y: r.y0 }, { x: r.x1, y: r.y0 }, { x: r.x1, y: r.y1 }, { x: r.x0, y: r.y1 }];
  const inside = (p) => p.x > r.x0 && p.x < r.x1 && p.y > r.y0 && p.y < r.y1;
  return inside(a) || inside(b) || [0, 1, 2, 3].some((i) => segsCross(a, b, c[i], c[(i + 1) % 4]));
};

export function placeLabels(g, labels, { W, H, rows, colW, sizes, noTools }) {
  const pad = 14, bottom = H - (rows || noTools ? 12 : 52);
  const discs = Object.values(g.disc);
  // Molecule outline as obstacles, with a little clearance so leaders never graze an atom.
  const clearDisc = 4, clearBond = 3;
  const placed = [], results = [];
  const order = labels.map((l, i) => ({ l, i })).sort((a, b) => (a.l.kind === "focus" || a.l.kind === "shared" ? -1 : 0) - (b.l.kind === "focus" || b.l.kind === "shared" ? -1 : 0));
  for (const { l, i } of order) {
    const { w, h } = sizes[i];
    const anchors = l.atoms.map((ai) => g.disc[ai]).filter(Boolean);
    const cands = [];
    const colTops = []; for (let y = pad; y + h <= bottom; y += 4) colTops.push(y);
    const rowLefts = []; for (let x = pad; x + w <= W - pad; x += 6) rowLefts.push(x);
    for (const side of ["left", "right"]) for (const top of colTops) {
      const left = side === "left" ? pad : W - pad - w;
      const s = { x: side === "left" ? left + w + 6 : left - 6, y: top + 9 };
      cands.push({ side, left, top, start: s, stub: { x: side === "left" ? s.x + 10 : s.x - 10, y: s.y }, pen: rows ? 120 : 0 });
    }
    for (const row of ["top", "bottom"]) for (const left of rowLefts) {
      const top = row === "top" ? pad : bottom - h;
      cands.push({ side: row, left, top, start: null, pen: rows ? 0 : 160 });
    }
    let best = null;
    for (const c of cands) {
      const rect = { x0: c.left - 4, y0: c.top - 4, x1: c.left + w + 4, y1: c.top + h + 4 };
      if (discs.some((d) => rectHitsDisc(rect, d, 2))) continue;
      if (g.bonds.some((b) => segHitsRect(b.p, b.q, rect))) continue;
      if (placed.some((p) => !(rect.x1 + 4 < p.rect.x0 || rect.x0 - 4 > p.rect.x1 || rect.y1 + 4 < p.rect.y0 || rect.y0 - 4 > p.rect.y1))) continue;
      for (const an of anchors) {
        let start = c.start, stub = c.stub;
        if (!start) {
          const sx = Math.min(Math.max(an.x, c.left + 6), c.left + w - 6);
          start = { x: sx, y: c.side === "top" ? c.top + h + 4 : c.top - 4 };
          stub = start;
        }
        // End at the edge of the anchor atom, on the side facing the label.
        const dx = stub.x - an.x, dy = stub.y - an.y, len = Math.hypot(dx, dy) || 1;
        const end = { x: an.x + (dx / len) * (an.r + 2), y: an.y + (dy / len) * (an.r + 2) };
        const segs = start === stub ? [[stub, end]] : [[start, stub], [stub, end]];
        const bad = segs.some(([a, b]) =>
          discs.some((d) => d.atom !== an.atom && segDist(d, a, b) < d.r + clearDisc) ||
          g.bonds.some((bd) => bd.a !== an.atom && bd.b !== an.atom && segSegDist(a, b, bd.p, bd.q) < bd.hw + clearBond) ||
          placed.some((p) => segHitsRect(a, b, p.rect)));
        if (bad) continue;
        const crossings = placed.reduce((n, p) => n + p.segs.reduce((m, [a2, b2]) => m + segs.reduce((k, [a, b]) => k + (segsCross(a, b, a2, b2) ? 1 : 0), 0), 0), 0);
        const length = segs.reduce((s, [a, b]) => s + Math.hypot(b.x - a.x, b.y - a.y), 0);
        const slope = c.start ? Math.abs(stub.y - end.y) * 0.6 : Math.abs(start.x - end.x) * 0.6;
        const cost = length + slope + c.pen + crossings * 400;
        if (!best || cost < best.cost) best = { cost, c, rect, segs, end, anchor: an };
      }
    }
    if (best) {
      placed.push({ rect: best.rect, segs: best.segs });
      results[i] = { left: best.c.left, top: best.c.top, side: best.c.side, segs: best.segs, end: best.end, anchor: best.anchor, ok: true };
    } else results[i] = { ok: false };
  }
  return results;
}

function placeAndDraw(overlay, g, labels, cfg) {
  overlay.innerHTML = "";
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  overlay.appendChild(svg);
  const els = labels.map((l) => {
    const el = document.createElement("div");
    el.className = `label ${l.kind || "muted"}`;
    el.innerHTML = l.cap && !cfg.rows ? `${l.text}<span class="cap">${l.cap}</span>` : l.text;
    overlay.appendChild(el);
    return el;
  });
  const sizes = els.map((el) => ({ w: el.offsetWidth, h: el.offsetHeight }));
  const res = placeLabels(g, labels, { ...cfg, sizes });
  overlay.dataset.unplaced = String(res.filter((r) => !r.ok).length);
  console.log(`labels ${overlay.parentElement.id} placed=${res.filter((r) => r.ok).length}/${res.length}`);
  res.forEach((r, i) => {
    const l = labels[i], el = els[i];
    if (!r.ok) { el.remove(); return; }
    if (r.side === "right") el.classList.add("right");
    el.style.left = `${r.left}px`; el.style.top = `${r.top}px`;
    const strong = l.kind === "focus" || l.kind === "shared";
    const colour = strong ? css("--accent") : l.kind === "diff" ? css("--secondary") : css("--ink-2");
    const dash = l.kind === "diff" ? ' stroke-dasharray="4 3"' : "";
    const d = r.segs.map(([a, b], k) => `${k ? "" : `M${a.x} ${a.y} `}L${b.x} ${b.y}`).join(" ");
    svg.insertAdjacentHTML("beforeend",
      `<path d="${d}" fill="none" stroke="${colour}" stroke-width="${strong ? 1.5 : 1}"${dash}/>` +
      `<circle cx="${r.end.x}" cy="${r.end.y}" r="${strong ? 2.5 : 2}" fill="${colour}"/>`);
  });
}

// Frame that superimposes molecule B's shared-core atoms onto A's (already placed) core.
export function alignFrame(sdfB, coreB, atomsA, coreA) {
  const lines = sdfB.split(String.fromCharCode(10));
  const xyz = (i) => { const l = lines[4 + i]; return [parseFloat(l.slice(0, 10)), parseFloat(l.slice(10, 20)), parseFloat(l.slice(20, 30))]; };
  const P = coreB.map(xyz), Q = coreA.map((i) => [atomsA[i].x, atomsA[i].y, atomsA[i].z]);
  const cP = centroid(P), cQ = centroid(Q);
  const R = hornRotation(P.map((p) => p.map((v, k) => v - cP[k])), Q.map((q) => q.map((v, k) => v - cQ[k])));
  return { c: cP, R, t: cQ };
}

// Compare mode: one view for both viewers, fitted to the union of both molecules,
// then the figures shrink to the height the molecules actually need.
export function fitTogether(A, B, minH = 240) {
  const box = () => {
    const pts = [...A.shown.map((a) => A.project(a.x, a.y, a.z)), ...B.shown.map((a) => B.project(a.x, a.y, a.z))];
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    return { w: x1 - x0 + 24, h: y1 - y0 + 24, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  };
  const sync = () => { B.v.setView(A.v.getView()); A.v.render(); B.v.render(); };
  const run = (room) => {
    sync();
    for (let k = 0; k < 4; k++) {
      const b = box();
      A.v.zoom(Math.min(room.w / b.w, room.h / b.h)); sync();
      const b0 = box();
      A.v.translate(10, 0); sync(); const sx = (box().cx - b0.cx) / 10; A.v.translate(-10, 0);
      A.v.translate(0, 10); sync(); const sy = (box().cy - b0.cy) / 10; A.v.translate(0, -10); sync();
      const b1 = box();
      if (sx && sy) { A.v.translate((room.cx - b1.cx) / sx, (room.cy - b1.cy) / sy); sync(); }
    }
  };
  run(A.roomNow());
  // Width usually limits elongated molecules: give the spare height back to the page.
  const spare = A.roomNow().h - box().h;
  if (spare > 24) {
    const newH = Math.max(minH, Math.round(A.host.clientHeight - spare + 8));
    for (const F of [A, B]) { F.host.style.height = `${newH}px`; F.v.resize(); }
    run(A.roomNow());
  }
  A.layout(); B.layout();
}

// Ring members of a matched group: the atoms of the match that are not exocyclic oxygens.
export function ringAtoms(sdf, idx) {
  const lines = sdf.split(String.fromCharCode(10));
  return idx.filter((i) => lines[4 + i].slice(31, 34).trim() !== "O");
}

export async function load(path) {
  const r = await fetch(path);
  return r.text();
}
export { principalFrame, hornRotation, centroid, apply, theme, palette };
