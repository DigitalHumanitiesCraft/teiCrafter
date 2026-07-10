/**
 * Harness self-test (DoD negative test): proves the validator actually catches
 * problems. If this passes, the "other side" is trustworthy before we measure
 * any real round-trip with it.
 *
 *   identity candidate  (copy of fixture) -> MUST gate PASS
 *   corrupted candidate (one <w> removed) -> MUST gate FAIL at L1 and L3
 *
 * Usage: node test/harness/selftest.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runValidate } from "./_validate_runner.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const TEST = resolve(HERE, "..");

const fixture = join(TEST, "fixtures-synthetic", "wb-synthetic-folio.xml");
const manifest = join(TEST, "fixtures-synthetic", "manifest.json");
const sch = join(TEST, "fixtures-synthetic", "Bilderfassung-synthetic.sch");
const work = join(TEST, "reports", "selftest");
mkdirSync(work, { recursive: true });

const src = readFileSync(fixture, "utf-8");

// identity
const identity = join(work, "identity.xml");
writeFileSync(identity, src, "utf-8");

// corrupted: drop the first <w ...>...</w> (removes one word + one xml:id, unreferenced)
const corrupted = join(work, "corrupted.xml");
const broken = src.replace(/<w xml:id="w_1_1">In<\/w>\s*/, "");
if (broken === src) { console.error("SELFTEST SETUP ERROR: could not corrupt fixture"); process.exit(4); }
writeFileSync(corrupted, broken, "utf-8");

function run(candidate, tag) {
  const out = join(work, `${tag}.report.json`);
  const args = ["--input", fixture, "--candidate", candidate,
    "--manifest", manifest, "--sch", sch, "--json-out", out, "--quiet"];
  const code = runValidate(args);
  return { code, report: JSON.parse(readFileSync(out, "utf-8")) };
}

const checks = [];
function expect(name, cond) { checks.push({ name, ok: !!cond }); }

const idn = run(identity, "identity");
expect("identity: exit code 0", idn.code === 0);
expect("identity: verdict pass", idn.report.verdict === "pass");
expect("identity: L1 fidelity pass", idn.report.levels.L1.pass === true);
expect("identity: L3 counts preserved", idn.report.levels.L3.countsPreserved === true);
expect("identity: w count 12", idn.report.levels.L1.wCountCandidate === 12);
expect("identity: Schematron valid", idn.report.levels.L2.sch && idn.report.levels.L2.sch.valid === true);

const cor = run(corrupted, "corrupted");
expect("corrupted: exit code 2 (gate fail)", cor.code === 2);
expect("corrupted: verdict fail", cor.report.verdict === "fail");
expect("corrupted: L1 fidelity FAILS", cor.report.levels.L1.pass === false);
expect("corrupted: L1 reports a divergence", !!cor.report.levels.L1.firstDivergence);
expect("corrupted: L3 counts NOT preserved", cor.report.levels.L3.countsPreserved === false);
expect("corrupted: w delta is -1", cor.report.levels.L3.counts.w.delta === -1);
expect("corrupted: lostWords names the removed word 'In'", cor.report.levels.L1.lostWords.includes("In"));
expect("corrupted: firstDivergence is the deletion at index 0", cor.report.levels.L1.firstDivergence && cor.report.levels.L1.firstDivergence.index === 0);

console.log("\nHarness self-test");
console.log("=".repeat(60));
let failed = 0;
for (const c of checks) {
  console.log(`  ${c.ok ? "ok  " : "FAIL"}  ${c.name}`);
  if (!c.ok) failed++;
}
console.log("=".repeat(60));
console.log(failed ? `SELF-TEST FAILED (${failed}/${checks.length})` : `SELF-TEST PASSED (${checks.length}/${checks.length})`);
process.exit(failed ? 1 : 0);
