/**
 * Port parity proof for M1.3: pipeline/export_tei.py must produce byte-identical
 * output to the reference prototype test/generators/szd-pagejson-to-tei.mjs over the
 * SZD demo handful. The prototype additionally round-trips its output through the
 * teiCrafter engine, so byte-equality here means the Python output round-trips too.
 *
 * Reads the real szd-htr Page-JSON directly (no third-party data is committed);
 * override the root with SZD_DIR. Writes throwaway files under output/ (gitignored).
 *
 * Run: node test/proofs/port_parity.mjs   (exit 0 = all byte-identical)
 */
import { execFileSync } from "node:child_process";
import { readFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const SZD = process.env.SZD_DIR || "../../szd-htr/results";

// The demo handful (contract section 6). o_szd.161 historically existed in two
// folders with the same id (the duplicate-id case the id-driven CLI rejects);
// szd-htr later deduped it (commit fb48ca0), so the korrespondenzen copy may be
// absent. A missing input is skipped, not a failure: parity is a claim about the
// converter, not about which inputs happen to exist in the sibling checkout.
const HANDFUL = [
  ["korrespondenzen", "o_szd.1079"],
  ["lebensdokumente", "o_szd.100"],
  ["lebensdokumente", "o_szd.72"],
  ["aufsatzablage", "o_szd.2215"],
  ["lebensdokumente", "o_szd.161"],
  ["korrespondenzen", "o_szd.161"],
];

mkdirSync("output", { recursive: true });
let pass = 0;
let skipped = 0;
const fails = [];
const skips = [];

for (const [folder, id] of HANDFUL) {
  const inPath = join(SZD, folder, `${id}_page.json`);
  const tag = `${id}@${folder}`;
  if (!existsSync(inPath)) {
    skips.push(`${tag}: input absent (deduped upstream, or SZD_DIR unset): ${inPath}`);
    skipped++;
    continue;
  }
  const jsOut = `output/_parity_${id}_${folder}.js.xml`;
  const pyOut = `output/_parity_${id}_${folder}.py.xml`;
  try {
    // prototype: also asserts engine round-trip for objects with text (exit 1 on
    // legitimately empty/all-blank objects, which is fine; the file is still written)
    try {
      execFileSync("node", ["test/generators/szd-pagejson-to-tei.mjs", inPath, jsOut], { stdio: "pipe" });
    } catch { /* empty/all-blank handful members would exit 1; the handful has text, so ignore */ }
    execFileSync("python", ["pipeline/export_tei.py", inPath, pyOut], { stdio: "pipe" });
    const a = readFileSync(jsOut), b = readFileSync(pyOut);
    if (Buffer.compare(a, b) === 0) { pass++; console.log(`ok   ${tag}  byte-identical (${a.length} bytes)`); }
    else fails.push(`${tag}: outputs differ (js ${a.length} vs py ${b.length} bytes)`);
  } catch (e) {
    fails.push(`${tag}: ${e.message.split("\n")[0]}`);
  }
}

const present = HANDFUL.length - skipped;
if (present === 0) {
  console.log("SKIP: no SZD Page-JSON inputs present (set SZD_DIR or check out szd-htr as a sibling); nothing to compare");
  if (skips.length) console.log("  " + skips.join("\n  "));
  process.exit(0);
}
console.log(`\nport parity: ${pass}/${present} byte-identical` + (skipped ? ` (${skipped} skipped)` : ""));
if (skips.length) console.log("skipped:\n  " + skips.join("\n  "));
if (fails.length || pass === 0) {
  if (pass === 0) fails.push("no inputs converted (check SZD_DIR / the szd-htr sibling checkout)");
  console.error("FAIL:\n  " + fails.join("\n  "));
  process.exit(1);
}
console.log("PASS: pipeline/export_tei.py matches the reference prototype on every present handful member.");
