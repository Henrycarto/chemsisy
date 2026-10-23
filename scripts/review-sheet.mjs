// Writes review/<slug>.html: a self-contained sheet for checking one drug's
// notes. Each note shows its claims (one per sentence) and its sources, with a
// "Reviewed" box and a comment field. "Save review file" downloads
// <slug>-review.json, which scripts/apply-review.mjs applies to the notes.
//
//   node scripts/review-sheet.mjs amoxicillin

import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";

const slug = process.argv[2];
if (!slug) {
  console.error("Usage: node scripts/review-sheet.mjs <drug-slug>");
  process.exit(1);
}
const REVIEWER = { by: "Henry Carto", role: "B.Sc. Industrial Chemistry" };
const notesFile = path.join("content", "notes", `${slug}.yaml`);
const doc = YAML.parse(fs.readFileSync(notesFile, "utf8"));
const drug = JSON.parse(fs.readFileSync(path.join("public", "data", "drugs", `${slug}.json`), "utf8"));
const names = Object.fromEntries(drug.groups.map((g) => [g.ruleId, g.name]));

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// Split a paragraph into sentences; each sentence is one claim to check.
// A full stop inside a number ("2.4") does not end a sentence.
const claims = (p) => p.split(/(?<=[.!?])\s+(?=[A-ZΑ-Ωβ])/u).map((s) => s.trim()).filter(Boolean);

const cards = Object.entries(doc.groups).map(([ruleId, n], i) => {
  const reviewed = n.review?.status === "reviewed";
  const list = n.body.flatMap(claims).map((c) => `<li>${esc(c)}</li>`).join("");
  const sources = n.sources.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.citation)}</a> <span class="lic">${esc(s.licence ?? "")}</span></li>`).join("");
  return `
  <section class="note" data-rule="${esc(ruleId)}">
    <header>
      <span class="num">${i + 1}</span>
      <div><h2>${esc(names[ruleId] ?? ruleId)}</h2><p class="cap">${esc(n.caption)}</p></div>
      <span class="state">${reviewed ? `Reviewed by ${esc(n.review.by)}` : "Sourced, not yet reviewed"}</span>
    </header>
    <h3>Claims</h3><ol class="claims">${list}</ol>
    <h3>Sources</h3><ul class="sources">${sources}</ul>
    <label class="tick"><input type="checkbox" name="reviewed"${reviewed ? " checked" : ""}> I checked every claim against its sources. Mark this note “Reviewed by ${REVIEWER.by}, ${REVIEWER.role}”.</label>
    <label class="comment">Comment (what to change, or why not ticked)<textarea name="comment" rows="3"></textarea></label>
  </section>`;
}).join("");

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Review: ${esc(drug.name)} notes</title>
<style>
:root{--bg:#f7f8f8;--surface:#fff;--ink:#1c2024;--ink-2:#555d66;--rule:#d5dadf;--accent:#a8226a}
*{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 Georgia,serif}
main{max-width:860px;margin:0 auto;padding:32px 24px 80px}
h1{font-size:28px;margin:0 0 4px} .intro{color:var(--ink-2);font-family:system-ui,sans-serif;font-size:14px;margin:0 0 24px}
.note{background:var(--surface);border:1px solid var(--rule);border-radius:3px;padding:20px 24px;margin:0 0 16px}
.note header{display:grid;grid-template-columns:28px 1fr auto;gap:12px;align-items:start}
.num{font-family:system-ui,sans-serif;font-size:13px;color:var(--ink-2);padding-top:4px}
h2{font-size:20px;margin:0} .cap{margin:2px 0 0;color:var(--ink-2)}
.state{font-family:system-ui,sans-serif;font-size:12px;color:var(--ink-2);border:1px solid var(--rule);border-radius:3px;padding:2px 6px;white-space:nowrap}
h3{font-family:system-ui,sans-serif;font-size:13px;font-weight:600;margin:16px 0 6px}
.claims{margin:0;padding-left:22px} .claims li{margin:0 0 6px}
.sources{margin:0;padding-left:18px;font-family:system-ui,sans-serif;font-size:13px} .sources a{color:var(--ink)} .lic{color:var(--ink-2)}
.tick{display:flex;gap:10px;align-items:flex-start;margin:16px 0 8px;font-family:system-ui,sans-serif;font-size:14px;border-top:1px solid var(--rule);padding-top:14px}
.tick input{width:18px;height:18px;margin-top:2px;accent-color:var(--accent)}
.comment{display:block;font-family:system-ui,sans-serif;font-size:13px;color:var(--ink-2)}
textarea{display:block;width:100%;margin-top:4px;font:14px/1.4 system-ui,sans-serif;padding:8px;border:1px solid #7f8891;border-radius:3px}
.bar{position:sticky;bottom:0;background:var(--surface);border-top:1px solid var(--rule);padding:12px 24px;display:flex;gap:16px;align-items:center;justify-content:center;font-family:system-ui,sans-serif;font-size:14px}
button{font:inherit;padding:8px 14px;border-radius:6px;border:1px solid var(--ink);background:var(--ink);color:#fff;cursor:pointer}
#status{color:var(--ink-2)}
</style></head>
<body><main>
<h1>Review: ${esc(drug.name)}</h1>
<p class="intro">${Object.keys(doc.groups).length} notes. Open each source, check every claim, then tick the box. Only ticked notes are marked reviewed; everything else stays “Sourced, not yet reviewed”. When you are done, press “Save review file” and leave the downloaded file in the project’s review folder.</p>
${cards}
</main>
<div class="bar"><span id="status"></span><button type="button" id="save">Save review file</button></div>
<script>
const KEY = "chemsisy.review.${slug}";
const notes = [...document.querySelectorAll(".note")];
const collect = () => ({
  drug: "${slug}",
  reviewer: ${JSON.stringify(REVIEWER)},
  date: new Date().toISOString().slice(0, 10),
  notes: Object.fromEntries(notes.map((n) => [n.dataset.rule, { reviewed: n.querySelector("[name=reviewed]").checked, comment: n.querySelector("[name=comment]").value.trim() }])),
});
const status = () => {
  const c = collect(), ticked = Object.values(c.notes).filter((n) => n.reviewed).length;
  document.getElementById("status").textContent = ticked + " of " + notes.length + " notes ticked";
  try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {}
};
try {
  const saved = JSON.parse(localStorage.getItem(KEY) || "null");
  if (saved) notes.forEach((n) => { const s = saved.notes[n.dataset.rule]; if (s) { n.querySelector("[name=reviewed]").checked = s.reviewed; n.querySelector("[name=comment]").value = s.comment; } });
} catch (e) {}
document.addEventListener("input", status);
document.getElementById("save").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(collect(), null, 2) + "\\n"], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "${slug}-review.json";
  a.click();
  URL.revokeObjectURL(a.href);
});
status();
</script></body></html>
`;
fs.mkdirSync("review", { recursive: true });
fs.writeFileSync(path.join("review", `${slug}.html`), html);
console.log(`review/${slug}.html: ${Object.keys(doc.groups).length} notes`);
