// Fails if the maintainer's email address appears anywhere in the repository,
// or if code that builds outbound requests carries any email address or a
// User-Agent other than the app's own. The address is stored only as a hash.
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";

const OWNER_EMAIL_SHA256 = "19f1ad747774f628c2618a253271b832bfe545792f4d3b4f99f652066d758363";
const USER_AGENT = "Chemsisy/0.1 (https://henrycarto.com)";
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// Never echo an address into the CI log, which is public.
const redact = (s) => s.replace(EMAIL, "[email address]");
const sha = (s) => createHash("sha256").update(s.toLowerCase()).digest("hex");

const files = execSync("git ls-files", { encoding: "utf8" }).split("\n").filter(Boolean);
const problems = [];
for (const f of files) {
  let text;
  try { text = fs.readFileSync(f, "utf8"); } catch { continue; }
  if (text.includes("\u0000")) continue; // binary
  for (const m of text.matchAll(EMAIL)) {
    if (sha(m[0]) === OWNER_EMAIL_SHA256) problems.push(`${f}: contains the maintainer's email address`);
    else if (/^(src|scripts)\//.test(f) && /\.(ts|tsx|js|mjs|py)$/.test(f)) problems.push(`${f}: an email address in code`);
  }
  if (/^(src|scripts)\//.test(f)) {
    for (const m of text.matchAll(/(?:USER_AGENT\s*=\s*|"User-Agent"\s*:\s*)["'`]([^"'`]+)["'`]/g)) {
      if (m[1] !== USER_AGENT) problems.push(`${f}: User-Agent "${redact(m[1])}" is not "${USER_AGENT}"`);
    }
  }
}
if (problems.length) {
  console.error("Privacy check failed:\n" + problems.map((p) => "  " + p).join("\n"));
  process.exit(1);
}
console.log(`Privacy check passed: ${files.length} tracked files, no personal data in requests.`);
