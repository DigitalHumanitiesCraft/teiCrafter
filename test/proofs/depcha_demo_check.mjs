/**
 * Proof for the DEPCHA Wheaton demo project (a "Open project folder" use case).
 *
 * The committed teicrafter.project.json is always checked: it parses, types
 * both volumes as `account`, and binds the bookkeeping markup inventory. The
 * real TEI (wheaton.1.xml, wheaton.2.xml) is third-party data with no
 * redistribution licence, so it is gitignored and local-only; when present
 * (materialize via make_depcha_demo.mjs) this also proves the engine reads it
 * losslessly and line-level. It SKIPs cleanly when the content is absent, so
 * the repo regression never depends on uncommittable data.
 *
 * Run: node test/proofs/depcha_demo_check.mjs
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseDocument, elementsByLocal } from "../../docs/js/editor/tei-document.js";
import { parseEdition } from "../../docs/js/editor/edition.js";
import { parseManifest, typeForFile, markupForFile, MANIFEST_FILENAME } from "../../docs/js/editor/project-manifest.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const FOLDER = resolve(HERE, "..", "..", "docs", "data", "editor", "depcha-wheaton");
const FILES = ["wheaton.1.xml", "wheaton.2.xml"];

let failed = 0;
const skips = [];
const ok = (c, m) => { console.log((c ? "  ok   " : "  FAIL ") + " " + m); if (!c) failed++; };

console.log("\nDEPCHA Wheaton demo project proof");
console.log("=".repeat(60));

// --- manifest (committed; always checked) ------------------------------------

const manifestPath = join(FOLDER, MANIFEST_FILENAME);
const project = parseManifest(readFileSync(manifestPath, "utf-8"));
ok(project.source === "manifest" && /DEPCHA/.test(project.name),
  `manifest parses, project name "${project.name}"`);
for (const f of FILES) {
  const t = typeForFile(project, f);
  ok(t && t.key === "account", `manifest types ${f} as 'account'`);
}
const wraps = markupForFile(project, FILES[0]);
ok(Array.isArray(wraps) && wraps.length >= 1, `manifest binds a bookkeeping markup inventory (${wraps && wraps.length} wraps)`);
ok(wraps.some(([label]) => /bk:money/.test(label)) && wraps.some(([label]) => /bk:when/.test(label)),
  "markup inventory carries the bk: money and date descriptors");

// --- real TEI (gitignored, local-only; SKIP when absent) ---------------------

for (const f of FILES) {
  const path = join(FOLDER, f);
  if (!existsSync(path)) { skips.push(f); continue; }
  const raw = readFileSync(path, "utf-8");
  const doc = parseDocument(raw);
  ok(doc.serialize() === raw, `${f}: serialize() byte-identical (${raw.length} chars)`);
  ok(elementsByLocal(doc.root, "w").length === 0, `${f}: no <w> tokens -> line-level granularity`);
  ok(elementsByLocal(doc.root, "measure").length > 0, `${f}: carries <measure> (bookkeeping amounts)`);
  const st = parseEdition(raw);
  ok(st.profile === "line", `${f}: editor model profile = 'line'`);
  ok(st.folios.length >= 1, `${f}: ${st.folios.length} folio(s) split by <pb>`);
}

console.log("=".repeat(60));
if (skips.length) console.log(`  skipped (content absent, gitignored): ${skips.join(", ")} -- run make_depcha_demo.mjs`);
console.log(failed ? `FAILED (${failed})` : `PASSED`);
process.exit(failed ? 1 : 0);
