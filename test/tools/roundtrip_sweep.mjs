/**
 * Adversarial sweep: prove the generic tokenizer round-trips byte-identically
 * across EVERY available real TEI file, not just the hand-picked samples.
 *
 * Reads directly from the source repos (nothing copied/committed) plus the
 * committed synthetic fixtures. Reports any file whose serialize() != input,
 * with the first byte offset of divergence.
 *
 * Override the source dirs with env vars if your checkout differs:
 *   HERSCH_DIR  (default: ../DHCraft/zbz-ocr-tei/output/tei_final)
 *   SZD_DIR     (default: ../../szd-htr/data)
 *
 * Run: node test/tools/roundtrip_sweep.mjs
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseDocument, tokenize } from "../../docs/js/editor/tei-document.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const TEST = resolve(HERE, "..");
const GH = resolve(TEST, "..", "..", "..");                       // .../GitHub
const HERSCH_DIR = process.env.HERSCH_DIR || join(GH, "DHCraft", "zbz-ocr-tei", "output", "tei_final");
const SZD_DIR = process.env.SZD_DIR || join(GH, "szd-htr", "data");
const SYNTH = join(TEST, "fixtures-synthetic");

function listXml(dir) {
  if (!dir || !existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".xml")).map((f) => join(dir, f));
}

function firstDivergence(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i;
  return a.length === b.length ? -1 : n;
}

function check(path) {
  const raw = readFileSync(path, "utf-8");
  // tokens cover the whole input contiguously
  let concat = "";
  for (const t of tokenize(raw)) concat += raw.slice(t.start, t.end);
  const out = parseDocument(raw).serialize();
  const ok = concat === raw && out === raw;
  return { ok, bytes: raw.length, at: ok ? -1 : firstDivergence(raw, out) };
}

const groups = [
  ["Hersch (zbz-ocr-tei)", listXml(HERSCH_DIR)],
  ["SZD (szd-htr)", listXml(SZD_DIR)],
  ["Synthetic fixtures", [...listXml(SYNTH), ...listXml(join(SYNTH, "tiers"))]],
];

let total = 0, passed = 0;
const failures = [];
for (const [label, files] of groups) {
  if (!files.length) { console.log(`  --  ${label}: no files found (skipped)`); continue; }
  let p = 0, bytes = 0;
  for (const f of files) {
    const r = check(f);
    total++; bytes += r.bytes;
    if (r.ok) { p++; passed++; }
    else failures.push({ f, at: r.at });
  }
  console.log(`  ${p === files.length ? "ok  " : "FAIL"}  ${label}: ${p}/${files.length} byte-identical (${(bytes / 1024).toFixed(0)} KB)`);
}

console.log("=".repeat(64));
if (failures.length) {
  console.log(`FAILED: ${failures.length} file(s) did not round-trip:`);
  for (const x of failures.slice(0, 20)) console.log(`   ${x.f}  (first divergence @ byte ${x.at})`);
} else {
  console.log(`PASSED: ${passed}/${total} files round-trip byte-identically.`);
}
process.exit(failures.length ? 1 : 0);
