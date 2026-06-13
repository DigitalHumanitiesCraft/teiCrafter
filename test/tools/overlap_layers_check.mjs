/**
 * Proof: cell.layers is a pure, byte-neutral read projection of the inline
 * annotation elements wrapping a reading-text cell, INNERMOST-FIRST, up to the
 * reading-unit boundary (p/head/note/body, the mentionRef boundary). Nested
 * annotations on one text are all representable, not just the innermost wrapper.
 *
 * Verifies, via parseEdition on small in-memory TEI strings:
 *   - <seg><persName>Karl</persName></seg>: layers = persName, seg (markup, markup)
 *   - <date><name ref="#p1">: layers = name (mention "p1"), date (markup)
 *   - <unclear> wrapping text: a critical layer is present
 *   - a plain word (only <w>): layers = [] (empty)
 *   - kinds, localNames, ref, and the innermost-first ORDER
 *   - serialize()/parseDocument round-trip byte-identical for each fixture
 *   - existing fields (mention, crit) are unchanged by the addition
 *
 * Run: node test/tools/overlap_layers_check.mjs   (exit 0 = all pass)
 */

import { parseEdition, serialize } from "../../docs/js/editor/edition.js";
import { parseDocument } from "../../docs/js/editor/tei-document.js";

const checks = [];
const expect = (name, ok) => checks.push({ name, ok: !!ok });
const cellByText = (state, t) => state.cells.find((c) => c.text.trim() === t);

const HEADER =
  "<teiHeader><fileDesc><titleStmt><title>t</title></titleStmt></fileDesc></teiHeader>";
const TEI = (body) =>
  '<TEI xmlns="http://www.tei-c.org/ns/1.0">' + HEADER +
  "<text><body>" + body + "</body></text></TEI>";

const roundtrips = (raw) => parseDocument(raw).serialize() === raw;

// --- 1. nested markup: <seg><persName>Karl</persName></seg> -------------------
// Two non-structural wrappers on one text node. Both must surface, innermost
// (persName) first, then seg; both kind "markup", ref null.

const RAW1 = TEI('<p><seg><persName>Karl</persName></seg></p>');
const s1 = parseEdition(RAW1);
const c1 = cellByText(s1, "Karl");
expect("seg/persName: a cell for 'Karl' exists", !!c1);
expect("seg/persName: two layers", c1 && c1.layers.length === 2);
expect("seg/persName: innermost is persName (markup, ref null)",
  c1 && c1.layers[0].localName === "persName" && c1.layers[0].kind === "markup" && c1.layers[0].ref === null);
expect("seg/persName: outer is seg (markup, ref null)",
  c1 && c1.layers[1].localName === "seg" && c1.layers[1].kind === "markup" && c1.layers[1].ref === null);
expect("seg/persName: existing field mention stays null (no <name> ancestor)", c1 && c1.mention === null);
expect("seg/persName: existing field crit stays null (persName not critical)", c1 && c1.crit === null);
expect("seg/persName: round-trip byte-identical", roundtrips(RAW1) && serialize(s1) === RAW1);

// --- 2. mention inside markup: <date><name ref="#p1">Karl</name></date> -------
// The <name ref> is a mention layer (ref "p1", hash stripped); <date> a markup
// layer above it. Innermost-first: name then date.

const RAW2 = TEI('<p><date><name ref="#p1">Karl</name></date></p>');
const s2 = parseEdition(RAW2);
const c2 = cellByText(s2, "Karl");
expect("date/name: a cell for 'Karl' exists", !!c2);
expect("date/name: two layers", c2 && c2.layers.length === 2);
expect("date/name: innermost is name (mention, ref 'p1' hash stripped)",
  c2 && c2.layers[0].localName === "name" && c2.layers[0].kind === "mention" && c2.layers[0].ref === "p1");
expect("date/name: outer is date (markup, ref null)",
  c2 && c2.layers[1].localName === "date" && c2.layers[1].kind === "markup" && c2.layers[1].ref === null);
expect("date/name: existing field mention is the same 'p1' (unchanged by layers)", c2 && c2.mention === "p1");
expect("date/name: round-trip byte-identical", roundtrips(RAW2) && serialize(s2) === RAW2);

// --- 3. critical wrapper: <unclear>Karl</unclear> -----------------------------
// unclear is in CRITICAL_LOCALS, so it is a critical layer (and crit stays set).

const RAW3 = TEI("<p><unclear>Karl</unclear></p>");
const s3 = parseEdition(RAW3);
const c3 = cellByText(s3, "Karl");
expect("unclear: a cell for 'Karl' exists", !!c3);
expect("unclear: a critical layer is present",
  c3 && c3.layers.some((l) => l.kind === "critical" && l.localName === "unclear" && l.ref === null));
expect("unclear: exactly one layer (only the critical wrapper)", c3 && c3.layers.length === 1);
expect("unclear: existing field crit stays 'unclear'", c3 && c3.crit === "unclear");
expect("unclear: round-trip byte-identical", roundtrips(RAW3) && serialize(s3) === RAW3);

// --- 4. plain word, no annotation: <w>Karl</w> --------------------------------
// <w> is the dual-reading token, not an annotation, so layers is empty.

const RAW4 = TEI('<p><w xml:id="w1">Karl</w></p>');
const s4 = parseEdition(RAW4);
const c4 = cellByText(s4, "Karl");
expect("plain <w>: a cell for 'Karl' exists", !!c4);
expect("plain <w>: layers is the empty array (<w> excluded)", c4 && Array.isArray(c4.layers) && c4.layers.length === 0);
expect("plain <w>: existing field w is set (cell.w present)", c4 && !!c4.w);
expect("plain <w>: round-trip byte-identical", roundtrips(RAW4) && serialize(s4) === RAW4);

// --- 5. annotation inside <w>, inside structural blocks -----------------------
// <w> and structural blocks are climbed past, not reported; an inline annotation
// nested inside <w> still surfaces. Boundary p/head/note/body stops the climb.

const RAW5 = TEI('<div><p><w xml:id="w1"><persName>Karl</persName></w></p></div>');
const s5 = parseEdition(RAW5);
const c5 = cellByText(s5, "Karl");
expect("nested-in-w: only persName is a layer (w/div/p excluded)",
  c5 && c5.layers.length === 1 && c5.layers[0].localName === "persName" && c5.layers[0].kind === "markup");
expect("nested-in-w: round-trip byte-identical", roundtrips(RAW5) && serialize(s5) === RAW5);

// --- 6. <name> WITHOUT @ref is a markup layer, not a mention ------------------
// kind "mention" requires @ref; a bare <name> falls through to markup (ref null),
// consistent with cell.mention staying null.

const RAW6 = TEI("<p><name>Karl</name></p>");
const s6 = parseEdition(RAW6);
const c6 = cellByText(s6, "Karl");
expect("bare <name>: a single markup layer (no @ref => not a mention)",
  c6 && c6.layers.length === 1 && c6.layers[0].localName === "name"
  && c6.layers[0].kind === "markup" && c6.layers[0].ref === null);
expect("bare <name>: existing field mention stays null", c6 && c6.mention === null);

// --- 7. gap cell: a single critical "gap" layer (mirrors crit) ----------------

const RAW7 = TEI('<p><lb n="1"/>vor <gap reason="illegible"/> nach</p>');
const s7 = parseEdition(RAW7);
const gapCell = s7.cells.find((c) => c.gap);
expect("gap: a gap cell exists", !!gapCell);
expect("gap: layers = single critical 'gap' (consistent with crit)",
  gapCell && gapCell.layers.length === 1 && gapCell.layers[0].kind === "critical"
  && gapCell.layers[0].localName === "gap" && gapCell.layers[0].ref === null);
expect("gap: existing field crit stays 'gap'", gapCell && gapCell.crit === "gap");
expect("gap: round-trip byte-identical", roundtrips(RAW7) && serialize(s7) === RAW7);

// --- report -------------------------------------------------------------------

console.log("\ncell.layers overlap projection proof");
console.log("=".repeat(60));
let failed = 0;
for (const c of checks) { console.log(`  ${c.ok ? "ok  " : "FAIL"}  ${c.name}`); if (!c.ok) failed++; }
console.log("=".repeat(60));
if (failed === 0) {
  console.log(`PASSED (${checks.length}/${checks.length})`);
  console.log("cell.layers is a pure, byte-neutral, innermost-first read projection.");
  process.exit(0);
} else {
  console.log(`FAILED (${checks.length - failed}/${checks.length}, ${failed} failing)`);
  process.exit(1);
}
