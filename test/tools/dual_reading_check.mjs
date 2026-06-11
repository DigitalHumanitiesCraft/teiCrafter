/**
 * Proof: F4 dual reading (diplomatic|normalized) is a lossless, atomic engine edit.
 *   - editCellReadings edits a <w>'s text content and @orig/@norm in ONE re-parse;
 *     everything outside the three edited spans is byte-identical (proven by full
 *     independent reconstruction of the expected raw string);
 *   - @orig is kept in sync with the diplomatic content where it exists, never
 *     invented when absent; @norm adds, replaces, or (on "") removes;
 *   - same core and same norm is a SAME-state no-op; an element child refuses the
 *     whole op (SAME state / SAME doc); quotes and escaping are preserved;
 *   - the edition model projects w.orig/w.norm decoded and flags hasDualReadings.
 *
 * Run: node test/tools/dual_reading_check.mjs   (exit 0 = all pass)
 */

import { readFileSync, existsSync } from "node:fs";
import {
  parseEdition, editCellReadings, serialize,
} from "../../docs/js/editor/edition.js";
import {
  parseDocument, elementsByLocal, editTextAndAttrs, decodeEntities,
} from "../../docs/js/editor/tei-document.js";

let passed = 0, failed = 0;
function check(cond, label) {
  if (cond) { passed++; console.log("  ok    " + label); }
  else { failed++; console.log("  FAIL  " + label); }
}

console.log("\nDual-reading proof (editCellReadings / editTextAndAttrs / projection)");
console.log("=".repeat(60));

const FIXTURE = "test/fixtures-synthetic/wb-dual-reading.xml";
const RAW = readFileSync(FIXTURE, "utf-8");

// Find the cell whose <w> has the given xml:id.
const cellByWid = (state, id) =>
  state.cells.find((c) => c.w && c.w.el.attrs.some((a) => a.name === "xml:id" && a.value === id));

// --- 1. byte proof by full reconstruction: orig != norm word ----------------

{
  const state = parseEdition(RAW);
  const cell = cellByWid(state, "w_1"); // orig="&#383;ich" norm="sich" content &#383;ich
  const next = editCellReadings(state, cell.id, { core: "zich", norm: "zsich" });
  // Independent expected: replace exactly the three spans on w_1.
  const expected = RAW
    .replace('orig="&#383;ich"', 'orig="zich"')
    .replace('norm="sich"', 'norm="zsich"')
    .replace(">&#383;ich</w>", ">zich</w>");
  check(serialize(next) === expected, "orig!=norm edit: full reconstruction is byte-identical");
  check(serialize(next) !== RAW, "the edit actually changed the raw");
}

// --- 2. no-op: same core and same norm returns the SAME state ----------------

{
  const state = parseEdition(RAW);
  const cell = cellByWid(state, "w_2"); // orig="got" norm="got" content got
  const next = editCellReadings(state, cell.id, { core: "got", norm: "got" });
  check(next === state, "same core + same norm returns the SAME state object");
  check(serialize(next) === RAW, "no-op leaves the raw byte-identical");
}

// --- 3. add path: no-orig-no-norm word, norm given --------------------------

{
  const state = parseEdition(RAW);
  const cell = cellByWid(state, "w_4"); // <w xml:id="w_4">himel</w>
  const next = editCellReadings(state, cell.id, { core: "himil", norm: "himmel" });
  // @norm is inserted directly after the element name (same as addAttr), so it
  // precedes the existing @xml:id; @orig is NOT invented.
  const expected = RAW
    .replace('<w xml:id="w_4">himel</w>', '<w norm="himmel" xml:id="w_4">himil</w>');
  check(serialize(next) === expected, "add path: @norm after the name, content updated, no @orig invented");
  const w4Seg = serialize(next).match(/<w[^>]*"w_4"[^>]*>/)[0];
  check(!w4Seg.includes("orig="), "no @orig was invented on the bare word");
}

// --- 4. remove path: norm "" removes the attribute and a leading space -------

{
  const state = parseEdition(RAW);
  const cell = cellByWid(state, "w_3"); // <w xml:id="w_3" norm="unde">unde</w>, no orig
  const next = editCellReadings(state, cell.id, { core: "unde", norm: "" });
  const expected = RAW
    .replace('<w xml:id="w_3" norm="unde">unde</w>', '<w xml:id="w_3">unde</w>');
  check(serialize(next) === expected, "remove path: norm \"\" drops @norm including one leading space");
}

// --- 5. orig sync: editing orig==norm word's core updates content AND @orig --

{
  const state = parseEdition(RAW);
  const cell = cellByWid(state, "w_2"); // orig="got" norm="got" content got
  const next = editCellReadings(state, cell.id, { core: "gott" }); // norm undefined
  const expected = RAW
    .replace('orig="got"', 'orig="gott"')
    .replace(">got</w>", ">gott</w>");
  check(serialize(next) === expected, "orig sync: content + @orig updated, @norm untouched when norm undefined");
  check(serialize(next).includes('norm="got"'), "@norm stays 'got' (untouched)");
}

// --- 5b. norm only: core undefined leaves content and @orig untouched --------

{
  const state = parseEdition(RAW);
  const cell = cellByWid(state, "w_1"); // orig="&#383;ich" norm="sich" content &#383;ich
  const next = editCellReadings(state, cell.id, { norm: "sych" });
  const expected = RAW.replace('norm="sich"', 'norm="sych"');
  check(serialize(next) === expected, "norm-only edit: content and @orig stay byte-identical");
}

// --- 6. escaping: core with & and <, norm with a double quote ----------------

{
  const state = parseEdition(RAW);
  const cell = cellByWid(state, "w_2"); // double-quoted attrs
  const core = "a&b<c";
  const norm = 'x"y';
  const next = editCellReadings(state, cell.id, { core, norm });
  const raw = serialize(next);
  check(raw.includes(">a&amp;b&lt;c</w>"), "core & and < are escaped in text content");
  check(raw.includes('orig="a&amp;b&lt;c"'), "core & and < are escaped in @orig");
  check(raw.includes('norm="x&quot;y"'), 'norm double-quote is escaped as &quot; (double-quoted attr)');
  // Round-trip: re-parse and the projected cell.w.norm decodes back to input.
  const re = parseEdition(raw);
  const reCell = cellByWid(re, "w_2");
  check(reCell.w.norm === norm, "re-parsed cell.w.norm equals the input string");
  check(reCell.w.orig === core, "re-parsed cell.w.orig equals the input string");
  check(decodeEntities("a&amp;b&lt;c") === core, "escaped content decodes back to core");
}

// --- 7. refusal: a word with an element child -------------------------------

{
  const state = parseEdition(RAW);
  const cell = cellByWid(state, "w_8"); // <w ...><unclear>erde</unclear></w>
  const next = editCellReadings(state, cell.id, { core: "erden", norm: "erden" });
  check(next === state, "element-child word: editCellReadings returns the SAME state");
  // Direct engine: text on that element is refused (SAME doc).
  const wEl = elementsByLocal(state.doc.root, "w").find((w) =>
    w.attrs.some((a) => a.name === "xml:id" && a.value === "w_8"));
  const sameDoc = editTextAndAttrs(state.doc, wEl, { text: "erden" });
  check(sameDoc === state.doc, "editTextAndAttrs with text on an element child returns the SAME doc");
}

// --- 8. quote preservation: single-quoted attribute keeps single quotes ------

{
  const state = parseEdition(RAW);
  const cell = cellByWid(state, "w_6"); // <w xml:id="w_6" norm='vnde'>und</w>
  const next = editCellReadings(state, cell.id, { core: "und", norm: "unde" });
  const raw = serialize(next);
  check(raw.includes("norm='unde'"), "single-quoted @norm keeps its single quotes after an edit");
}

// --- 9. projection: decoded w.orig/w.norm, hasDualReadings -------------------

{
  const state = parseEdition(RAW);
  const w1 = cellByWid(state, "w_1");
  check(w1.w.orig === "ſich" && w1.w.norm === "sich", "w.orig/w.norm are decoded (long s in orig)");
  const w4 = cellByWid(state, "w_4");
  check(w4.w.orig === null && w4.w.norm === null, "a bare <w> projects orig/norm null");
  check(state.hasDualReadings === true, "fixture state hasDualReadings === true");

  // The structural twin has <w> ancestors but no @norm: hasDualReadings false.
  const TWIN = readFileSync("test/fixtures-synthetic/wb-synthetic-folio.xml", "utf-8");
  const twin = parseEdition(TWIN);
  check(twin.hasDualReadings === false, "structural twin (no @norm) hasDualReadings === false");
  const twinCell = twin.cells.find((c) => c.w);
  check(!!twinCell && twinCell.w.norm === null, "twin cells carry the <w> ancestor with norm null");
}

// --- 10. atomic multi-part: text + replace orig + add a second attribute -----

{
  const state = parseEdition(RAW);
  const wEl = elementsByLocal(state.doc.root, "w").find((w) =>
    w.attrs.some((a) => a.name === "xml:id" && a.value === "w_1"));
  const next = editTextAndAttrs(state.doc, wEl, { text: "zich", set: { orig: "zich", norm: "zzz", n: "7" } });
  // @n is absent: inserted after the element name (before @xml:id); @orig/@norm
  // are replaced in place; the content span is replaced. One re-parse.
  const expected = RAW
    .replace('<w xml:id="w_1" orig="&#383;ich" norm="sich">&#383;ich</w>',
             '<w n="7" xml:id="w_1" orig="zich" norm="zzz">zich</w>');
  check(next.serialize() === expected, "atomic multi-part: text + @orig replace + @norm replace + @n add, one re-parse");
}

// --- 11. real-codex guard (skipped silently when absent) --------------------

{
  const REAL = "docs/data/editor/wb-codex/codex-2759.xml";
  if (existsSync(REAL)) {
    const realRaw = readFileSync(REAL, "utf-8");
    const state = parseEdition(realRaw);
    const cell = state.cells.find((c) => c.w && c.w.norm != null);
    check(!!cell, "real codex has a cell with a dual reading (w.norm)");
    if (cell) {
      const [, core] = (() => {
        // core = the trimmed reading the no-op resubmits unchanged
        const t = cell.text;
        const lead = (t.match(/^\s*/) || [""])[0];
        const trail = (t.match(/\s*$/) || [""])[0];
        return [lead, t.slice(lead.length, t.length - trail.length), trail];
      })();
      const next = editCellReadings(state, cell.id, { core, norm: cell.w.norm });
      check(next === state, "real codex: identical core + norm is a SAME-state no-op");
    }
    check(state.hasDualReadings === true, "real codex hasDualReadings === true");
  } else {
    console.log("  SKIP  real-codex guard (docs/data/editor/wb-codex/codex-2759.xml absent)");
  }
}

// --- summary ----------------------------------------------------------------

console.log("=".repeat(60));
if (failed === 0) {
  console.log(`PASSED (${passed}/${passed})`);
  console.log("Dual-reading edits are atomic, byte-faithful, no-op-safe, and correctly projected.");
  process.exit(0);
} else {
  console.log(`FAILED (${passed}/${passed + failed}, ${failed} failing)`);
  process.exit(1);
}
