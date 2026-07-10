/**
 * Typing gate over the jsconfig.json include set (checkJs).
 *
 * Those files carry JSDoc types; this runs `tsc --noEmit -p jsconfig.json` to
 * check them. It is a hard gate on diagnostics, with one tolerated escape:
 *
 *   - tsc clean                      -> PASS
 *   - tsc reports TS#### diagnostics -> FAIL: the include set is curated to stay
 *       clean, so a diagnostic is a regression. The diagnostics are printed.
 *   - typescript / npx / network unavailable -> SKIP: the offline proof gate must
 *       never hard-FAIL on a missing optional toolchain (CI installs a pinned tsc
 *       and enforces the same check).
 *
 * PASS and SKIP exit 0; FAIL exits 1, so run_all.mjs counts a diagnostic as a
 * failure. Run: node test/tools/types_check.mjs
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..");
const CONFIG = resolve(REPO_ROOT, "jsconfig.json");

const skip = (reason) => { console.log("SKIP: " + reason); process.exit(0); };

if (!existsSync(CONFIG)) skip("jsconfig.json not found at repo root");

// Candidate invocations, in order: a globally installed tsc first (offline-friendly),
// then npx fetching the typescript package (the bin is `tsc`, not `typescript`).
// On Windows the launchers are .cmd shims that spawnSync can only start through a
// shell; the config path is quoted so its spaces survive shell word-splitting. All
// arguments are static (the path derives from import.meta.url, no external input),
// so the shell-true concatenation carries nothing untrusted.
const isWin = process.platform === "win32";
const cfg = isWin ? `"${CONFIG}"` : CONFIG;
const candidates = [
  { cmd: isWin ? "tsc.cmd" : "tsc", args: ["--noEmit", "-p", cfg] },
  { cmd: isWin ? "npx.cmd" : "npx", args: ["-y", "-p", "typescript", "tsc", "--noEmit", "-p", cfg] },
];

function run(c) {
  return spawnSync(c.cmd, c.args, { cwd: REPO_ROOT, encoding: "utf-8", shell: isWin });
}

// A line is a real TypeScript diagnostic when it matches "error TS####".
const hasTsDiagnostics = (text) => /error TS\d+/.test(text || "");
// tsc really ran when it either exited clean or printed TS diagnostics; any other
// outcome (launcher missing, npx could not resolve/fetch, network down) is "did not run".
const didRun = (r) => !!r && !r.error && (r.status === 0 || hasTsDiagnostics((r.stdout || "") + (r.stderr || "")));

let result = null;
let lastOut = "";
for (const c of candidates) {
  const r = run(c);
  lastOut = (r.stdout || "") + (r.stderr || "");
  if (didRun(r)) { result = r; break; }
}

if (!result) {
  skip("no TypeScript available (no global tsc; npx could not run it offline)"
    + (lastOut.trim() ? ": " + lastOut.trim().split(/\r?\n/)[0] : ""));
}

const out = (result.stdout || "") + (result.stderr || "");

if (result.status === 0 && !hasTsDiagnostics(out)) {
  console.log("=".repeat(60));
  console.log("PASSED (1/1)");
  console.log("Typechecks clean under checkJs over the jsconfig.json include set.");
  process.exit(0);
}

// didRun guarantees the only remaining outcome here is real TS diagnostics from
// the checkJs pass over the include set. The set is curated to stay tsc-clean, so
// a diagnostic is a regression: print it and FAIL. A missing tsc toolchain already
// SKIPped above, so this branch never fires merely because typescript is absent.
const diags = out.split(/\r?\n/).filter((l) => /error TS\d+/.test(l));
console.log("Type diagnostics over the jsconfig.json include set:");
for (const d of diags) console.log("  " + d.trim());
console.log("=".repeat(60));
console.log("FAILED (0/1)");
console.log(diags.length + " type diagnostic(s) under checkJs; the jsconfig.json include set must stay tsc-clean.");
process.exit(1);
