// Applies a saved review file to the notes. Only notes ticked in the sheet are
// marked reviewed, with the reviewer's name, role and date. Unticked notes keep
// (or return to) "Sourced, not yet reviewed". Comments are printed, not stored.
//
//   node scripts/apply-review.mjs review/amoxicillin-review.json

import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/apply-review.mjs <review-file.json>");
  process.exit(1);
}
const review = JSON.parse(fs.readFileSync(file, "utf8"));
const notesFile = path.join("content", "notes", `${review.drug}.yaml`);
const doc = YAML.parseDocument(fs.readFileSync(notesFile, "utf8"));
const { by, role } = review.reviewer;
if (!by || !role) throw new Error("The review file must name the reviewer and role.");

for (const [ruleId, r] of Object.entries(review.notes)) {
  if (!doc.hasIn(["groups", ruleId])) throw new Error(`${review.drug}: no note for "${ruleId}"`);
  if (r.reviewed) doc.setIn(["groups", ruleId, "review"], { status: "reviewed", by, role, date: review.date });
  else doc.deleteIn(["groups", ruleId, "review"]);
  console.log(`${r.reviewed ? "reviewed  " : "unchanged "} ${ruleId}${r.comment ? `\n           comment: ${r.comment}` : ""}`);
}
fs.writeFileSync(notesFile, doc.toString({ lineWidth: 0 }));
console.log(`\n${notesFile} updated. Run "npm run data" to rebuild the app data.`);
