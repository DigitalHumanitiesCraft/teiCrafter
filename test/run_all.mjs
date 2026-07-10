/**
 * Aggregate runner for the Node proof suite. This is THE regression gate.
 *
 * Selection: every test/proofs/*.mjs, no include/exclude lists. Underscore-
 * prefixed files (shared helpers like _assert.mjs) are skipped, they are not
 * proofs. Generators live in test/generators/ and are not part of the gate.
 *
 * Classification per script:
 *   PASS  exit 0, no full-skip marker
 *   SKIP  exit 0 and a line beginning with "SKIP" in the output; a proof
 *         signals a full skip this way when its local-only input is absent
 *         (rights-encumbered data, a sibling checkout, python+lxml). SKIP is a
 *         non-failure: on a bare checkout (CI) such proofs skip loudly.
 *   FAIL  nonzero exit; the captured output is printed at the end.
 *
 * Spawn cwd is the repo root (one directory above this file): scripts that use
 * cwd-relative paths (port_parity.mjs mkdirSync, szd_loadability_sweep.mjs
 * pathToFileURL, pipeline/export_tei.py) require it; import.meta.url-based
 * imports are unaffected by cwd.
 *
 * CLI:
 *   --list          print selected scripts without running
 *   <substring>     filter scripts to those whose name includes the term
 */

import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..");
const PROOFS = join(HERE, "proofs");

const selected = readdirSync(PROOFS)
  .filter((f) => f.endsWith(".mjs") && !f.startsWith("_"))
  .sort();

const args = process.argv.slice(2);
const listOnly = args.includes("--list");
const filter = args.find((a) => !a.startsWith("-"));

const scripts = filter ? selected.filter((s) => s.includes(filter)) : selected;

if (listOnly) {
  console.log("Selected proofs (" + scripts.length + "):");
  for (const s of scripts) console.log("  " + s);
  process.exit(0);
}

const isSkip = (out) => /^SKIP\b/m.test(out || "");

let passed = 0;
let skipped = 0;
let failed = 0;
const t0Total = Date.now();
const failures = [];

for (const name of scripts) {
  const scriptPath = join(PROOFS, name);
  const t0 = Date.now();
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: REPO_ROOT,
    encoding: "utf-8",
  });
  const ms = Date.now() - t0;
  if (result.status !== 0) {
    failed++;
    failures.push({ name, result });
    console.log("FAIL  " + name + "  (" + ms + " ms)");
  } else if (isSkip(result.stdout)) {
    skipped++;
    console.log("SKIP  " + name + "  (" + ms + " ms)");
  } else {
    passed++;
    console.log("PASS  " + name + "  (" + ms + " ms)");
  }
}

// print captured output for every failing script
for (const { name, result } of failures) {
  console.log("\n--- " + name + " (FAIL) ---");
  const combined = (result.stdout || "") + (result.stderr || "");
  if (combined.trim()) console.log(combined.trimEnd());
  else console.log("(no output captured; exit code " + result.status + ")");
}

const totalMs = Date.now() - t0Total;
console.log(
  "\n" + passed + " passed, " + skipped + " skipped, " + failed + " failed, " +
  totalMs + " ms total"
);
process.exit(failed > 0 ? 1 : 0);
