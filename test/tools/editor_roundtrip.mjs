/**
 * Headless proof for the Editor edition core (the "working iteration" evidence).
 *
 * Uses the SAME pure module the browser editor uses (docs/js/editor/edition.js):
 *   1. Identity round-trip: parse -> serialize is byte-identical (lossless load/save).
 *   2. Surgical edit: changing one word's text changes ONLY that word, preserves all
 *      structural counts, stays well-formed; the harness localizes exactly that change.
 *
 * Run: node test/tools/editor_roundtrip.mjs
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEdition, editWordText, serialize, countTags } from "../../docs/js/editor/edition.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const TEST = resolve(HERE, "..");
const PYTHON = process.env.TCR_PYTHON || "python";
const fixture = join(TEST, "fixtures-synthetic", "wb-synthetic-folio.xml");
const work = join(TEST, "reports", "editor");
mkdirSync(work, { recursive: true });

const checks = [];
const expect = (name, ok) => checks.push({ name, ok: !!ok });

const original = readFileSync(fixture, "utf-8");
const state = parseEdition(original);

// 1. Identity round-trip: lossless load/save
expect("parsed folios > 0", state.folios.length > 0);
expect("parsed words = 12", state.words.length === 12);
expect("identity serialize is byte-identical", serialize(state) === original);

// 2. Surgical edit: correct one diplomatic word ("anegenge" -> "aneginne")
const target = "w_1_3";
const before = state.wordById.get(target);
expect("target word w_1_3 = 'anegenge'", before && before.text === "anegenge");
const edited = editWordText(state, target, "aneginne");
const editedRaw = serialize(edited);

// only that word's span changed; everything else byte-identical
const expectedRaw = original.slice(0, before.start) + "aneginne" + original.slice(before.end);
expect("edit is surgical (only the word's span changed)", editedRaw === expectedRaw);
expect("structural counts unchanged after edit", JSON.stringify(countTags(editedRaw)) === JSON.stringify(countTags(original)));
expect("edited word now reads 'aneginne'", edited.wordById.get(target).text === "aneginne");

const candidate = join(work, "edited.xml");
writeFileSync(candidate, editedRaw, "utf-8");

// run the harness on the edited document: it must localize exactly this one change
const out = join(work, "edited.report.json");
const r = spawnSync(PYTHON, [
  join(TEST, "harness", "validate.py"),
  "--input", fixture, "--candidate", candidate,
  "--manifest", join(TEST, "fixtures-synthetic", "manifest.json"),
  "--sch", join(TEST, "fixtures-synthetic", "Bilderfassung-synthetic.sch"),
  "--json-out", out, "--quiet",
], { encoding: "utf-8" });
if (r.stderr && r.stderr.trim()) console.error(r.stderr.trim());
const rep = JSON.parse(readFileSync(out, "utf-8"));

expect("harness: candidate well-formed", rep.gates.wellFormed === "pass");
expect("harness: L3 counts preserved (structure intact)", rep.levels.L3.countsPreserved === true);
expect("harness: L1 detects the intended word change", rep.levels.L1.pass === false);
expect("harness: lost word is 'anegenge'", (rep.levels.L1.lostWords || []).includes("anegenge"));
expect("harness: added word is 'aneginne'", (rep.levels.L1.addedWords || []).includes("aneginne"));
expect("harness: exactly one word changed (no collateral)", (rep.levels.L1.lostWords || []).length === 1 && (rep.levels.L1.addedWords || []).length === 1);

console.log("\nEditor edition-core round-trip proof");
console.log("=".repeat(60));
let failed = 0;
for (const c of checks) { console.log(`  ${c.ok ? "ok  " : "FAIL"}  ${c.name}`); if (!c.ok) failed++; }
console.log("=".repeat(60));
console.log(failed ? `FAILED (${failed}/${checks.length})` : `PASSED (${checks.length}/${checks.length})`);
console.log("Identity round-trip is lossless; a word edit is surgical and the harness localizes it exactly.");
process.exit(failed ? 1 : 0);
