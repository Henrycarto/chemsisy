// The repository's house rules: no tool attribution and no em dashes in tracked text.
import { execSync } from "node:child_process";
import fs from "node:fs";

// Built at runtime so this file does not contain the character it looks for.
const EM_DASH = String.fromCharCode(0x2014);

const banned = new RegExp(["cl" + "aude", "anth" + "ropic", "co-auth" + "ored"].join("|"), "i");
const files = execSync("git ls-files", { encoding: "utf8" }).split("\n").filter(Boolean);
const problems = [];
for (const f of files) {
  let text;
  try { text = fs.readFileSync(f, "utf8"); } catch { continue; }
  if (text.includes("\u0000")) continue;
  if (banned.test(text)) problems.push(`${f}: banned attribution word`);
  if (text.includes(EM_DASH)) problems.push(`${f}: em dash`);
}
const log = execSync("git log --format=%B", { encoding: "utf8" });
if (banned.test(log)) problems.push("commit messages: banned attribution word");
if (problems.length) {
  console.error("House rules failed:\n" + problems.map((p) => "  " + p).join("\n"));
  process.exit(1);
}
console.log(`House rules passed: ${files.length} tracked files.`);
