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

const rot = (ax, ay) => {
  const [ca, sa, cb, sb] = [Math.cos(ax), Math.sin(ax), Math.cos(ay), Math.sin(ay)];
  const Rx = [[1, 0, 0], [0, ca, -sa], [0, sa, ca]], Ry = [[cb, 0, sb], [0, 1, 0], [-sb, 0, cb]];
  return Rx.map((r) => [0, 1, 2].map((j) => r[0] * Ry[0][j] + r[1] * Ry[1][j] + r[2] * Ry[2][j]));
};
function faceRotation(heavy, group) {
  const gp = group.map((a) => [a.x, a.y, a.z]), gc = centroid(gp);
  const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const p of gp) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i][j] += (p[i] - gc[i]) * (p[j] - gc[j]);
  const n = jacobi(C)[2].vec;
  const hp = heavy.map((a) => [a.x, a.y, a.z]);
  let best = { s: -1, R: rot(0, 0) };
  for (let ax = -70; ax <= 70; ax += 5) for (let ay = -70; ay <= 70; ay += 5) {
    const R = rot((ax * Math.PI) / 180, (ay * Math.PI) / 180);
    const nz = Math.abs(apply(R, n)[2]);
    const pts = hp.map((p) => apply(R, p));
    const w = Math.max(...pts.map((p) => p.x)) - Math.min(...pts.map((p) => p.x));
    const h = Math.max(...pts.map((p) => p.y)) - Math.min(...pts.map((p) => p.y));
    const front = apply(R, gc)[2] >= 0 ? 0.15 : 0;
    const s = 1.6 * nz + 0.5 * Math.min(w / (h * 1.4), 1) + front;
    if (s > best.s) best = { s, R };
  }
  return best.R;
}

// ---- colours ---------------------------------------------------------------
const CPK = {
  light: { C: "#4d535a", H: "#e9ebed", O: "#e0301e", N: "#2f5be8", S: "#d4b000", F: "#3fbf3f", Cl: "#2fa82f" },
  dark: { C: "#aab0b6", H: "#d9dde1", O: "#ff5a48", N: "#6a8cff", S: "#f0d040", F: "#7be07b", Cl: "#5fd05f" },
};
const GHOST = {
  light: { C: "#c9ced3", H: "#eef0f2", O: "#ecb3ab", N: "#b3c0ee", S: "#e8dca0" },
  dark: { C: "#596067", H: "#6a7178", O: "#8a524b", N: "#525e8f", S: "#847944" },
};
const scheme = (map) => ({ prop: "elem", map });

// ---- figure ---------------------------------------------------------------
export function figure(host, sdf, opts) {
  cssHost = host;
  const viewerEl = host.querySelector(".viewer");
  const overlay = host.querySelector(".overlay");
  const v = $3Dmol.createViewer(viewerEl, { backgroundColor: css("--surface"), backgroundAlpha: 0, antialias: true });
  const model = v.addModel(sdf, "sdf");
  const atoms = model.selectedAtoms({});
  const heavy = atoms.filter((a) => a.elem !== "H");

  // Orientation: either principal axes, or a given frame (compare mode).
  const frame = opts.frame || principalFrame(heavy.map((a) => [a.x, a.y, a.z]));
  for (const a of atoms) {
    const p = apply(frame.R, [a.x - frame.c[0], a.y - frame.c[1], a.z - frame.c[2]]);
    const t = frame.t || [0, 0, 0];
    a.x = p[0] + t[0]; a.y = p[1] + t[1]; a.z = p[2] + t[2];
  }
  // Turn the focused group towards the reader while keeping the molecule wide.
  if (opts.face) {
    const R = faceRotation(heavy, opts.face.map((i) => atoms[i]));
    for (const a of atoms) { const p = apply(R, [a.x, a.y, a.z]); a.x = p[0]; a.y = p[1]; a.z = p[2]; }
  }

  // Hydrogens on carbon are hidden; polar hydrogens stay because they matter for H-bonding.
  const hidden = atoms.filter((a) => a.elem === "H" && a.bonds.some((b) => atoms[b].elem === "C")).map((a) => a.index);
  const emphasis = opts.emphasis ? new Set(opts.emphasis) : null;
  const polarHOf = (set) => atoms.filter((a) => a.elem === "H" && !hidden.includes(a.index) && a.bonds.some((b) => set.has(b))).map((a) => a.index);
  const emph = emphasis ? new Set([...emphasis, ...polarHOf(emphasis)]) : null;

  const mode = opts.theme || theme;
  const all = atoms.map((a) => a.index).filter((i) => !hidden.includes(i));
  const ctx = emph ? all.filter((i) => !emph.has(i)) : all;
  v.setStyle({}, {});
  v.setStyle({ index: ctx }, {
    stick: { radius: 0.12, colorscheme: scheme(emph ? GHOST[mode] : CPK[mode]) },
    sphere: { scale: 0.2, colorscheme: scheme(emph ? GHOST[mode] : CPK[mode]) },
  });
  if (emph) {
    v.setStyle({ index: [...emph] }, {
      stick: { radius: 0.14, colorscheme: scheme(CPK[mode]) },
      sphere: { scale: 0.23, colorscheme: scheme(CPK[mode]) },
    });
  }
  v.setViewStyle({ style: "outline", color: css("--surface"), width: 0.04 });
  v.zoomTo({ index: all });
  v.render();

  // Fit the molecule into the space between the two label columns.
  const W = viewerEl.clientWidth, H = viewerEl.clientHeight, colW = opts.labelColumn ?? 190;
  // modelToScreen returns page coordinates; convert to the figure's own box.
  const toLocal = (p) => {
    const r = viewerEl.getBoundingClientRect();
    return { x: p.x - (r.left + scrollX), y: p.y - (r.top + scrollY) };
  };
  const project = (x, y, z) => toLocal(v.modelToScreen({ x, y, z }));
  const shown = atoms.filter((a) => !hidden.includes(a.index));
  const box = () => {
    const pts = shown.map((a) => project(a.x, a.y, a.z));
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    return { w: x1 - x0 + 24, h: y1 - y0 + 24, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  };
  // Leave the label columns and the tool row free: the molecule never sits under text.
  const rows = !!opts.rows;
  const room = rows
    ? { w: W - 32, h: H - 2 * 44, cx: W / 2, cy: H / 2 }
    : { w: W - 2 * (colW + 16), h: H - 96, cx: W / 2, cy: (H - 40) / 2 };
  v.setZoomLimits(0, 1e4);
  for (let k = 0; k < 4; k++) {
    const b = box();
    v.zoom(Math.min(room.w / b.w, room.h / b.h));
    v.render();
    // translate() pans in view units; calibrate it once per pass, then centre the box.
    const b0 = box();
    v.translate(10, 0); v.render();
    const sx = (box().cx - b0.cx) / 10; v.translate(-10, 0);
    v.translate(0, 10); v.render();
    const sy = (box().cy - b0.cy) / 10; v.translate(0, -10); v.render();
    const b1 = box();
    if (sx && sy) { v.translate((room.cx - b1.cx) / sx, (room.cy - b1.cy) / sy); v.render(); }
  }

  const layout = () => (rows ? drawLabelRows : drawLabels)(project, atoms, overlay, opts.labels || [], W, H);
  layout();
  return { v, atoms, frame, layout, project, shown, room };
}

function drawLabels(project, atoms, overlay, labels, W, H) {
  overlay.innerHTML = "";
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  overlay.appendChild(svg);
  const items = labels.map((l) => {
    const pts = l.atoms.map((i) => [atoms[i].x, atoms[i].y, atoms[i].z]);
    const c = centroid(pts);
    const s = project(c[0], c[1], c[2]);
    const el = document.createElement("div");
    el.className = `label ${l.kind || "muted"}`;
    el.innerHTML = l.cap ? `${l.text}<span class="cap">${l.cap}</span>` : l.text;
    overlay.appendChild(el);
    const side = l.side || (s.x < W / 2 ? "left" : "right");
    return { l, s, el, side };
  });
  const pad = 16, gap = 12, bottomLimit = H - 56;
  for (const side of ["left", "right"]) {
    const col = items.filter((it) => it.side === side).sort((a, b) => a.s.y - b.s.y);
    let y = pad;
    for (const it of col) {
      if (side === "right") it.el.classList.add("right");
      const h = it.el.offsetHeight;
      it.top = Math.max(y, it.s.y - 9);
      y = it.top + h + gap;
    }
    const over = col.length ? col[col.length - 1].top + col[col.length - 1].el.offsetHeight - bottomLimit : 0;
    if (over > 0) col.forEach((it) => { it.top -= over; });
    for (const it of col) {
      const w = it.el.offsetWidth;
      const left = side === "left" ? pad : W - pad - w;
      it.el.style.left = `${left}px`;
      it.el.style.top = `${it.top}px`;
      const sx = side === "left" ? left + w + 8 : left - 8;
      const sy = it.top + 9;
      const stub = side === "left" ? sx + 10 : sx - 10;
      const colour = it.l.kind === "focus" || it.l.kind === "shared" ? css("--accent") : it.l.kind === "diff" ? css("--secondary") : css("--ink-2");
      const wgt = it.l.kind === "focus" || it.l.kind === "shared" ? 1.5 : 1;
      const dash = it.l.kind === "diff" ? ' stroke-dasharray="4 3"' : "";
      svg.insertAdjacentHTML("beforeend",
        `<path d="M${sx} ${sy} H${stub} L${it.s.x} ${it.s.y}" fill="none" stroke="${colour}" stroke-width="${wgt}"${dash} opacity="${it.l.kind === "muted" ? 0.75 : 1}"/>` +
        (it.l.kind === "focus" || it.l.kind === "shared"
          ? `<circle cx="${it.s.x}" cy="${it.s.y}" r="7" fill="none" stroke="${colour}" stroke-width="1.5"/><circle cx="${it.s.x}" cy="${it.s.y}" r="2" fill="${colour}"/>`
          : `<circle cx="${it.s.x}" cy="${it.s.y}" r="2.5" fill="${colour}"/>`));
    }
  }
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

// Narrow figures: labels sit in a row above or below the molecule, leader lines drop to the group.
function drawLabelRows(project, atoms, overlay, labels, W, H) {
  overlay.innerHTML = "";
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  overlay.appendChild(svg);
  const items = labels.map((l) => {
    const c = centroid(l.atoms.map((i) => [atoms[i].x, atoms[i].y, atoms[i].z]));
    const s = project(c[0], c[1], c[2]);
    const el = document.createElement("div");
    el.className = `label ${l.kind || "muted"}`;
    el.textContent = l.text;
    overlay.appendChild(el);
    return { l, s, el, row: l.row || (s.y < H / 2 ? "top" : "bottom") };
  });
  for (const row of ["top", "bottom"]) {
    const r = items.filter((it) => it.row === row).sort((a, b) => a.s.x - b.s.x);
    let x = 12;
    for (const it of r) {
      const w = it.el.offsetWidth, h = it.el.offsetHeight;
      const left = Math.min(Math.max(x, it.s.x - w / 2), W - 12 - w);
      const top = row === "top" ? 12 : H - 12 - h;
      it.el.style.left = `${left}px`; it.el.style.top = `${top}px`;
      x = left + w + 16;
      const ax = Math.min(Math.max(it.s.x, left + 6), left + w - 6), ay = row === "top" ? top + h + 4 : top - 4;
      const colour = it.l.kind === "shared" || it.l.kind === "focus" ? css("--accent") : it.l.kind === "diff" ? css("--secondary") : css("--ink-2");
      const dash = it.l.kind === "diff" ? ' stroke-dasharray="4 3"' : "";
      const strong = it.l.kind === "shared" || it.l.kind === "focus";
      svg.insertAdjacentHTML("beforeend",
        `<path d="M${ax} ${ay} L${it.s.x} ${it.s.y}" fill="none" stroke="${colour}" stroke-width="${strong ? 1.5 : 1}"${dash}/>` +
        (strong ? `<circle cx="${it.s.x}" cy="${it.s.y}" r="7" fill="none" stroke="${colour}" stroke-width="1.5"/>` : "") +
        `<circle cx="${it.s.x}" cy="${it.s.y}" r="2.5" fill="${colour}"/>`);
    }
  }
}

// Compare mode: one view for both viewers, fitted to the union of both molecules.
export function fitTogether(A, B) {
  const box = () => {
    const pts = [...A.shown.map((a) => A.project(a.x, a.y, a.z)), ...B.shown.map((a) => B.project(a.x, a.y, a.z))];
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    return { w: x1 - x0 + 24, h: y1 - y0 + 24, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  };
  const sync = () => { B.v.setView(A.v.getView()); A.v.render(); B.v.render(); };
  const room = A.room;
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
  A.layout(); B.layout();
}

export async function load(path) {
  const r = await fetch(path);
  return r.text();
}
export { principalFrame, hornRotation, centroid, apply, theme, palette };
