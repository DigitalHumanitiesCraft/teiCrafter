/**
 * Aggregate runner for Node proof scripts in test/tools/.
 *
 * Selection rules (applied once at startup):
 *   include: *_check.mjs, files with "roundtrip" in name, plus explicit extras
 *   exclude: make_* files, szd-pagejson-to-tei.mjs, run_all.mjs itself
 *
 * Spawn cwd is the repo root (two directories above this file): scripts that
 * use relative paths for cwd-sensitive operations (port_parity.mjs mkdirSync,
 * szd_loadability_sweep.mjs pathToFileURL) require it, and import.meta.url-
 * based imports are unaffected by cwd.
 *
 * CLI:
 *   --list              print selected scripts without running
 *   <substring>         filter scripts to those whose name includes the term
 */

import { readdirSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..");

// --- script selection --------------------------------------------------------

const EXTRA = [
  "edit_fidelity.mjs",
  "port_parity.mjs",
  "hersch_loadability.mjs",
  "szd_loadability_sweep.mjs",
];

const EXCLUDE = new Set(["szd-pagejson-to-tei.mjs", "run_all.mjs"]);

function isIncluded(name) {
  if (EXCLUDE.has(name)) return false;
  if (name.startsWith("make_")) return false;
  if (name.endsWith("_check.mjs")) return true;
  if (name.includes("roundtrip")) return true;
  if (EXTRA.includes(name)) return true;
  return false;
}

const allFiles = readdirSync(HERE).filter((f) => f.endsWith(".mjs"));
const selected = [];
const seen = new Set();

// add pattern-matched files first (preserves directory order)
for (const f of allFiles) {
  if (isIncluded(f)) { selected.push(f); seen.add(f); }
}

// add any extra-list entries not already in the set; report missing ones
const missing = [];
for (const e of EXTRA) {
  if (!seen.has(e)) {
    const path = join(HERE, e);
    if (existsSync(path)) { selected.push(e); seen.add(e); }
    else missing.push(e);
  }
}

if (missing.length) {
  console.error("WARNING: extra-list scripts not found: " + missing.join(", "));
}

// --- CLI parsing -------------------------------------------------------------

const args = process.argv.slice(2);
const listOnly = args.includes("--list");
const filter = args.find((a) => !a.startsWith("-"));

const scripts = filter
  ? selected.filter((s) => s.includes(filter))
  : selected;

if (listOnly) {
  console.log("Selected scripts (" + scripts.length + "):");
  for (const s of scripts) console.log("  " + s);
  process.exit(0);
}

// --- run ---------------------------------------------------------------------

let passed = 0;
let failed = 0;
const t0Total = Date.now();
const failures = [];

for (const name of scripts) {
  const scriptPath = join(HERE, name);
  const t0 = Date.now();
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: REPO_ROOT,
    encoding: "utf-8",
  });
  const ms = Date.now() - t0;
  const ok = result.status === 0;
  if (ok) {
    passed++;
    console.log("PASS  " + name + "  (" + ms + " ms)");
  } else {
    failed++;
    failures.push({ name, ms, result });
    console.log("FAIL  " + name + "  (" + ms + " ms)");
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
  "\n" + passed + " passed, " + failed + " failed, " + totalMs + " ms total"
);
process.exit(failed > 0 ? 1 : 0);
