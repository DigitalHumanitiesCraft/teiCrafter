/**
 * Proof: cellRawOffset (edition.js) maps a caret offset in a cell's DISPLAYED
 * text to an ABSOLUTE raw offset in doc.raw, correctly across entity references
 * and any in-cell markup, and the returned offset is a real raw boundary that
 * splitElement / insertLb act on to produce the intended byte change.
 *
 * This is the pure half of the Structure context-menu actions: the DOM half
 * (document.caretPositionFromPoint -> a (textNode, domOffset) pair) is
 * browser-only, but the cell-display-offset -> absolute-raw-offset mapping is
 * deterministic and is proven here against a synthetic edition fixture.
 *
 * Run: node test/tools/author_caret_check.mjs   (exit 0 = all pass)
 */

import { parseEdition, cellRawOffset } from "../../docs/js/editor/edition.js";
import { splitElement, insertLb } from "../../docs/js/editor/structural.js";

let passed = 0, failed = 0;
function check(cond, label) {
  if (cond) { passed++; console.log("  ok    " + label); }
  else { failed++; console.log("  FAIL  " + label); }
}

console.log("\nAuthor caret -> absolute raw offset proof");
console.log("=".repeat(60));

const HEADER =
  "<teiHeader><fileDesc><titleStmt><title>t</title></titleStmt></fileDesc></teiHeader>";

// A line-level edition: one <l> whose text carries an entity (&amp;) so the
// displayed text ("Tom & Jerry foo") is shorter than the raw slice
// ("Tom &amp; Jerry foo"). The display/raw divergence is the whole point.
const RAW =
  '<TEI xmlns="http://www.tei-c.org/ns/1.0">' + HEADER +
  '<text><body>\n        <l xml:id="l1">Tom &amp; Jerry foo</l>\n      </body></text></TEI>';

const state = parseEdition(RAW);
const cell = state.cells.find((c) => c.text.includes("Tom"));

// Sanity: the cell's displayed text is decoded, its raw slice keeps the entity.
check(cell.text === "Tom & Jerry foo", "cell.text is the DECODED display text");
check(cell.rawText === "Tom &amp; Jerry foo", "cell.rawText keeps the raw entity bytes");
const display = cell.text; // "Tom & Jerry foo"

// Helper: the absolute raw offset must point at the byte the display caret means.
// For a display offset d, doc.raw[absolute] is the first raw char of whatever the
// display char at d begins (or end-of-slice). We verify by reconstructing.
const at = (d) => cellRawOffset(cell, d);

// --- 1. start of cell --------------------------------------------------------
{
  const abs = at(0);
  check(abs === cell.start, "display 0 -> cell.start (raw start of the text node)");
  check(state.raw.slice(abs, abs + 3) === "Tom", "start offset sits exactly before 'Tom'");
}

// --- 2. end of cell (and past-end clamps to end) -----------------------------
{
  const abs = at(display.length);
  check(abs === cell.end, "display length -> cell.end (raw end of the text node)");
  check(state.raw.slice(abs - 3, abs) === "foo", "end offset sits exactly after 'foo'");
  check(at(display.length + 50) === cell.end, "a past-end display offset clamps to cell.end");
}

// --- 3. mid-word position ----------------------------------------------------
{
  // caret after "Jer" inside "Jerry": display index of the 'r' boundary.
  const d = display.indexOf("Jerry") + 3;
  const abs = at(d);
  check(state.raw.slice(abs - 3, abs) === "Jer" && state.raw[abs] === "r",
    "mid-word display offset lands between 'Jer' and 'ry' in the raw");
}

// --- 4. immediately BEFORE the entity reference ------------------------------
{
  // display "Tom " is 4 chars; the next display char is '&' (the decoded entity).
  const d = display.indexOf("&");
  check(d === 4, "the '&' is at display index 4 (after 'Tom ')");
  const abs = at(d);
  check(state.raw.slice(abs, abs + 5) === "&amp;",
    "the offset before the entity points at the raw '&amp;' run, not into it");
  check(state.raw.slice(cell.start, abs) === "Tom ",
    "everything before the entity offset is the raw 'Tom '");
}

// --- 5. immediately AFTER the entity reference -------------------------------
{
  // display char after '&' is ' ' (space) at index 5; its raw offset must be
  // PAST the whole "&amp;" run, never inside it.
  const d = display.indexOf("&") + 1;
  const abs = at(d);
  check(state.raw.slice(cell.start, abs) === "Tom &amp;",
    "the offset after the entity sits just past the full '&amp;' run");
  check(state.raw[abs] === " ", "the raw char at the after-entity offset is the following space");
}

// --- 6. splitElement at the returned offset produces the intended bytes ------
{
  // Split the <l> after "Tom &" (display index 5, just past the entity). The
  // line element is the cell's line.el; re-find it the way a commit callback would.
  const lineEl = state.lines.find((l) => l.cells.includes(cell)).el;
  check(lineEl && lineEl.localName === "l", "the cell's render line is driven by an <l>");

  const dAfterEntity = display.indexOf("&") + 1; // after "Tom &"
  const abs = cellRawOffset(cell, dAfterEntity);
  const d2 = splitElement(state.doc, lineEl, abs);

  const ls = [];
  const walkEls = (n) => { if (n.type === "element") { if (n.localName === "l") ls.push(n); (n.children || []).forEach(walkEls); } else (n.children || []).forEach(walkEls); };
  walkEls(d2.root);
  check(ls.length === 2, "splitElement at the caret yields two <l>");
  check(d2.raw.slice(ls[0].contentStart, ls[0].contentEnd) === "Tom &amp;",
    "first <l> keeps the bytes up to (and including) the whole entity, never a half '&amp'");
  check(d2.raw.slice(ls[1].contentStart, ls[1].contentEnd) === " Jerry foo",
    "second <l> carries the bytes after the entity");
  check(d2.raw.includes('xml:id="l1"') && d2.raw.includes('xml:id="l1_2"'),
    "split preserves the first id and regenerates a unique sibling id");
}

// --- 7. insertLb at the returned offset produces the intended bytes ----------
{
  const dAfterEntity = display.indexOf("&") + 1; // after "Tom &"
  const abs = cellRawOffset(cell, dAfterEntity);
  const d2 = insertLb(state.doc, abs);
  check(d2.raw.includes("Tom &amp;<lb/> Jerry foo"),
    "insertLb places <lb/> exactly past the entity run (not inside '&amp;')");
}

// --- 8. a word-level cell with an entity, and contract guards ----------------
{
  const WRAW =
    '<TEI xmlns="http://www.tei-c.org/ns/1.0">' + HEADER +
    '<text><body><p><w xml:id="w1">A&amp;B</w></p></body></text></TEI>';
  const ws = parseEdition(WRAW);
  const wc = ws.cells.find((c) => c.text === "A&B");
  check(wc.text === "A&B" && wc.rawText === "A&amp;B", "word cell decodes 'A&B' from 'A&amp;B'");
  // display offset 1 is between 'A' and '&': raw offset must point at the '&amp;' run.
  const abs = cellRawOffset(wc, 1);
  check(ws.raw.slice(wc.start, abs) === "A" && ws.raw.slice(abs, abs + 5) === "&amp;",
    "word cell: display offset before the entity maps past 'A' onto the raw entity run");
  // display offset 2 is after the decoded '&', before 'B'.
  const abs2 = cellRawOffset(wc, 2);
  check(ws.raw.slice(wc.start, abs2) === "A&amp;" && ws.raw[abs2] === "B",
    "word cell: display offset after the entity maps past the full '&amp;' run");

  // contract guards
  check(cellRawOffset(null, 0) === null, "null cell -> null");
  check(cellRawOffset(wc, -1) === null, "negative display offset -> null");
  check(cellRawOffset(wc, 1.5) === null, "non-integer display offset -> null");
  const gap = ws.cells.find((c) => c.gap);
  if (gap) check(cellRawOffset(gap, 0) === null, "gap cell (no editable text node) -> null");
}

console.log("=".repeat(60));
console.log(passed + " passed, " + failed + " failed");
process.exit(failed > 0 ? 1 : 0);
