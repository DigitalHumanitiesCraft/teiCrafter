/**
 * Shared spawn seam for the harness consumers (run.mjs, selftest.mjs).
 *
 * Resolves the python interpreter (TCR_PYTHON or "python"), runs validate.py with
 * the caller's argument list (the validate.py path is prepended), echoes any spawn
 * error or stderr, and returns the exit code. The caller owns building the
 * fixture-specific args (--input/--candidate/--manifest/--sch/--rng/--json-out)
 * and reading the JSON report validate.py writes.
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const VALIDATE = join(dirname(fileURLToPath(import.meta.url)), "validate.py");

export function runValidate(fixtureArgs) {
  const python = process.env.TCR_PYTHON || "python";
  const r = spawnSync(python, [VALIDATE, ...fixtureArgs], { encoding: "utf-8" });
  if (r.error) { console.error(`Failed to run ${python}: ${r.error.message}`); process.exit(4); }
  if (r.stderr && r.stderr.trim()) console.error(r.stderr.trim());
  return r.status;
}
