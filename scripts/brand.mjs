// Exports the Chemsisy icon ("the halo": one atom of a ring picked out) and the
// social preview into assets/brand/, and copies the files the app serves into
// public/. PNGs are rendered with Playwright's Chromium.
//
//   node scripts/brand.mjs

import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const OUT = path.join("assets", "brand");
const PUBLIC_ICONS = path.join("public", "icons");
const MAGENTA = "#a8226a";
const TINT = "#f07bb5"; // the same hue, light enough for dark backgrounds
const PAGE_BG = "#f7f8f8";

// The drawing, on the 24 unit grid of the henrycarto.com icon family.
const BODY = (c) =>
  `<path d="M11.50 4.30 L19.30 9.97 L16.32 19.13 L6.68 19.13 L3.70 9.97Z"/>` +
  `<circle cx="19.30" cy="9.97" r="1.7" fill="${c}" stroke="none"/>` +
  `<circle cx="19.30" cy="9.97" r="3.2" stroke-width="1.5"/>`;
const svg = (c, size = 24, extra = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" ` +
  `stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><title>Chemsisy</title>${extra}${BODY(c)}</svg>\n`;

// At 16 px the halo blurs into the ring, so small renders draw the picked atom as
// a larger solid dot instead. Both drawings keep the same idea: one atom picked out.
const SMALL = (c) =>
  `<path d="M11.50 4.30 L19.30 9.97 L16.32 19.13 L6.68 19.13 L3.70 9.97Z"/>` +
  `<circle cx="19.30" cy="9.97" r="2.8" fill="${c}" stroke="none"/>`;
const svgSmall = (c, size) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" ` +
  `stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><title>Chemsisy</title>${SMALL(c)}</svg>
`;

// Adaptive SVG: magenta on light, the light tint when the system is dark (browser
// tabs follow this), and the small-size drawing when it is rendered under 20 px.
const adaptive =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke-width="2" ` +
  `stroke-linecap="round" stroke-linejoin="round"><title>Chemsisy</title>` +
  `<style>.s{stroke:${MAGENTA}}.f{fill:${MAGENTA}}.sm{display:none}` +
  `@media (prefers-color-scheme:dark){.s{stroke:${TINT}}.f{fill:${TINT}}}` +
  `@media (max-width:20px){.lg{display:none}.sm{display:inline}}</style>` +
  `<path class="s" d="M11.50 4.30 L19.30 9.97 L16.32 19.13 L6.68 19.13 L3.70 9.97Z"/>` +
  `<g class="lg"><circle class="f" cx="19.30" cy="9.97" r="1.7"/>` +
  `<circle class="s" cx="19.30" cy="9.97" r="3.2" stroke-width="1.5"/></g>` +
  `<circle class="f sm" cx="19.30" cy="9.97" r="2.8"/></svg>
`;

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(PUBLIC_ICONS, { recursive: true });
fs.writeFileSync(path.join(OUT, "icon.svg"), adaptive);
fs.writeFileSync(path.join(OUT, "icon-light.svg"), svg(MAGENTA));
fs.writeFileSync(path.join(OUT, "icon-dark.svg"), svg(TINT));

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });

async function png(file, size, { pad = 0, bg = null, colour = MAGENTA, small = false } = {}) {
  const inner = Math.round(size * (1 - 2 * pad));
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;width:${size}px;height:${size}px;display:grid;place-items:center;background:${bg ?? "transparent"}">` +
      (small ? svgSmall(colour, inner) : svg(colour, inner)) + `</body></html>`,
  );
  await page.screenshot({ path: file, omitBackground: !bg });
}

const files = [
  ["icon-512.png", 512, { pad: 0.08 }],
  ["icon-192.png", 192, { pad: 0.08 }],
  ["favicon-16.png", 16, { small: true }],
  ["favicon-32.png", 32, {}],
  ["favicon-48.png", 48, {}],
  // Maskable: the drawing inside the central safe zone, on the app's page colour.
  ["icon-512-maskable.png", 512, { pad: 0.22, bg: PAGE_BG }],
  ["apple-touch-icon.png", 180, { pad: 0.16, bg: PAGE_BG }],
];
for (const [name, size, opts] of files) await png(path.join(OUT, name), size, opts);

// favicon.ico with 16, 32 and 48 px PNG images inside (the ICO container allows PNG entries).
const sizes = [16, 32, 48];
const images = sizes.map((s) => fs.readFileSync(path.join(OUT, `favicon-${s}.png`)));
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
sizes.forEach((s, i) => {
  const e = 6 + 16 * i;
  header.writeUInt8(s, e);
  header.writeUInt8(s, e + 1);
  header.writeUInt16LE(1, e + 4);
  header.writeUInt16LE(32, e + 6);
  header.writeUInt32LE(images[i].length, e + 8);
  header.writeUInt32LE(offset, e + 12);
  offset += images[i].length;
});
fs.writeFileSync(path.join(OUT, "favicon.ico"), Buffer.concat([header, ...images]));

// Social preview, in the henrycarto.com family layout (1280 x 640).
await page.setViewportSize({ width: 1280, height: 640 });
await page.setContent(`<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400&family=Inter:wght@400&family=Space+Mono&display=swap" rel="stylesheet">
<style>
html,body{margin:0;width:1280px;height:640px;background:#ffffff}
.wrap{position:relative;width:1280px;height:640px;display:flex;align-items:center;gap:72px;padding:0 110px;box-sizing:border-box}
.icon{flex:none;width:300px;height:300px}
.name{font-family:Newsreader,Georgia,serif;font-size:84px;line-height:1.02;color:#14181c;letter-spacing:-0.01em}
.desc{font-family:Inter,system-ui,sans-serif;font-size:30px;line-height:1.35;color:#5e666d;margin-top:22px;max-width:640px}
.site{position:absolute;left:110px;bottom:52px;font-family:'Space Mono',monospace;font-size:20px;letter-spacing:.08em;color:#5e666d}
</style></head><body><div class="wrap"><div class="icon">${svg(MAGENTA, 300)}</div>
<div><div class="name">Chemsisy</div><div class="desc">Open-source molecule explorer for pharmacy and medical students.</div></div>
<div class="site">henrycarto.com</div></div></body></html>`);
await page.waitForLoadState("networkidle");
await page.evaluate("document.fonts.ready");
await page.screenshot({ path: path.join(OUT, "social-preview.png") });
await browser.close();

// What the app serves.
const serve = {
  "icon.svg": "favicon.svg",
  "favicon.ico": "favicon.ico",
  "icon-192.png": "icon-192.png",
  "icon-512.png": "icon-512.png",
  "icon-512-maskable.png": "icon-512-maskable.png",
  "apple-touch-icon.png": "apple-touch-icon.png",
};
for (const [from, to] of Object.entries(serve)) fs.copyFileSync(path.join(OUT, from), path.join(PUBLIC_ICONS, to));
console.log(`assets/brand: ${fs.readdirSync(OUT).length} files; public/icons updated`);
