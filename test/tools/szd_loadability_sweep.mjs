/**
 * M1.5 proof: convert the whole szd-htr corpus and verify every converted TEI
 * loads line-level and round-trips byte-identically through the teiCrafter engine.
 *
 * Runs `python pipeline/export_tei.py --all` (reads the real corpus under SZD_DIR;
 * nothing third-party is committed) then sweeps output/szd-tei/ with edition.js.
 * Empty (pages: []) and all-blank objects legitimately yield cells === 0 and still
 * round-trip; only a byte difference, a parse error, or a text-bearing non-line
 * profile counts as a failure (converter-reference.md section 1).
 *
 * Run: node test/tools/szd_loadability_sweep.mjs   (exit 0 = all clean)
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync, rmSync } from "node:fs";
import { pathToFileURL } from "node:url";

const DIR = "output/szd-tei";
// Clean stale outputs first. The upstream corpus shrinks (e.g. the szd-htr dedup of
// duplicate objects), and export_tei.py --all does not prune, so old <folder>__<id>.xml
// from removed objects would otherwise linger and inflate the sweep count.
rmSync(DIR, { recursive: true, force: true });
console.log("converting corpus via pipeline/export_tei.py --all ...");
execFileSync("python", ["pipeline/export_tei.py", "--all", "--out", DIR], { stdio: "inherit" });

if (!existsSync(DIR)) { console.error("no output at " + DIR); process.exit(1); }
const ed = await import(pathToFileURL("docs/js/editor/edition.js").href);
const files = readdirSync(DIR).filter((f) => f.endsWith(".xml"));

let rtOk = 0, rtFail = 0, parseErr = 0, cells0 = 0, notLine = 0;
const fails = [];
for (const f of files) {
  const tei = readFileSync(`${DIR}/${f}`, "utf8");
  let model;
  try { model = ed.parseEdition(tei); }
  catch (e) { parseErr++; fails.push(`parse ${f}: ${e.message.split("\n")[0]}`); continue; }
  if (ed.serialize(model) === tei) rtOk++; else { rtFail++; fails.push(`round-trip ${f}`); }
  if (model.cells.length === 0) cells0++;
  else if (model.profile !== "line") { notLine++; fails.push(`profile ${f}: ${model.profile}`); }
}

console.log(`\nsweep over ${files.length} converted TEI:`);
console.log(`  byte-identical round-trip: ${rtOk}`);
console.log(`  round-trip FAIL: ${rtFail}   parse error: ${parseErr}   text-bearing non-line: ${notLine}`);
console.log(`  cells === 0 (empty / all-blank, valid): ${cells0}`);
const genuine = rtFail + parseErr + notLine;
if (genuine) { console.error("\nFAIL:\n  " + fails.slice(0, 40).join("\n  ")); process.exit(1); }
console.log("\nPASS: every converted TEI round-trips byte-identically and loads line-level.");
