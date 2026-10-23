// Build-size budget, measured on dist/ after "npm run build". Sizes are gzip
// level 9 for code and raw for fonts (already compressed WOFF2).
import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

const DIST = "dist";
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const files = walk(DIST);
const gz = (f) => gzipSync(fs.readFileSync(f), { level: 9 }).length;
const kb = (n) => `${(n / 1024).toFixed(1)} kB`;

const js = files.filter((f) => f.endsWith(".js") && f.includes(`${path.sep}assets${path.sep}`));
const viewer = js.filter((f) => path.basename(f).startsWith("viewer-"));
const entry = js.filter((f) => path.basename(f).startsWith("index-"));
const css = files.filter((f) => f.endsWith(".css"));
const fonts = files.filter((f) => f.endsWith(".woff2"));
const data = files.filter((f) => f.includes(`${path.sep}data${path.sep}`));

const sum = (xs, fn) => xs.reduce((s, f) => s + fn(f), 0);
const raw = (f) => fs.statSync(f).size;
const BUDGET = [
  ["App entry JS (gzip)", sum(entry, gz), 110 * 1024],
  ["3D viewer chunk (gzip, loaded on demand)", sum(viewer, gz), 190 * 1024],
  ["All other JS (gzip)", sum(js.filter((f) => !viewer.includes(f) && !entry.includes(f)), gz), 40 * 1024],
  ["CSS (gzip)", sum(css, gz), 16 * 1024],
  ["Fonts (woff2)", sum(fonts, raw), 400 * 1024],
  ["Starter-set data (gzip)", sum(data, gz), 350 * 1024],
  ["Everything (raw, what the offline cache stores)", sum(files, raw), 2.6 * 1024 * 1024],
];
let failed = false;
for (const [name, size, limit] of BUDGET) {
  const ok = size <= limit;
  failed ||= !ok;
  console.log(`${ok ? "ok  " : "OVER"} ${name.padEnd(48)} ${kb(size).padStart(10)} of ${kb(limit)}`);
}
if (failed) process.exit(1);
