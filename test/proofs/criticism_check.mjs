/**
 * Proof: textual-critical markup (M3.6) is applied losslessly.
 *   - <unclear>/<del>/<add> wrap a reading-text node's core, edge whitespace kept
 *     OUTSIDE the tags, so a line edit never collapses its indentation;
 *   - <gap/> replaces the core (omitted/illegible text), edge whitespace kept;
 *   - unwrapCritical restores plain text but REFUSES to strip a wrapper shared with
 *     sibling content (no silent data loss); removeGap splices a gap marker out;
 *   - every mutation covers every byte (the tokenizer reproduces the raw exactly),
 *     and reversal is byte-exact;
 *   - the cell model tags a cell crit === the IMMEDIATE wrapper kind (so the model
 *     agrees with what the ops can act on) with critSole telling whether "clear" is
 *     safe, and surfaces a gap as its own cell (gap: true).
 *
 * Run: node test/proofs/criticism_check.mjs   (exit 0 = all pass)
 */

import { parseEdition } from "../../docs/js/editor/edition.js";
import { parseDocument, tokenize, textNodes } from "../../docs/js/editor/tei-document.js";
import { markCritical, unwrapCritical, removeGap, CRITICAL_KINDS } from "../../docs/js/editor/criticism.js";

let passed = 0, failed = 0;
function check(cond, label) {
  if (cond) { passed++; console.log("  ok    " + label); }
  else { failed++; console.log("  FAIL  " + label); }
}
const cellByText = (state, t) => state.cells.find((c) => c.text.trim() === t);
// A REAL round-trip check: concatenating each token's [start,end) slice must
// reproduce the input exactly. Unlike serialize() (which returns raw verbatim and
// so can never fail), this genuinely constrains that the parse covers every byte.
const reparses = (raw) => tokenize(raw).map((t) => raw.slice(t.start, t.end)).join("") === raw;

console.log("\nTextual-critical markup proof (M3.6)");
console.log("=".repeat(60));

const HEADER =
  "<teiHeader><fileDesc><titleStmt><title>t</title></titleStmt></fileDesc></teiHeader>";
const WRAP = (body) => '<TEI xmlns="http://www.tei-c.org/ns/1.0">' + HEADER + "<text><body>" + body + "</body></text></TEI>";

// --- 1. unclear/del/add wrap a word cell losslessly --------------------------

const WRAW = WRAP('<p><w xml:id="w1">Hallo</w> <w xml:id="w2">Welt</w></p>');

for (const kind of ["unclear", "del", "add"]) {
  const state = parseEdition(WRAW);
  const tag = CRITICAL_KINDS[kind].tag;
  const doc = markCritical(state.doc, state.cellById.get("w1").node, kind);
  check(doc !== state.doc && doc.raw !== WRAW, `${kind}: a new document is produced`);
  check(doc.raw.includes('<w xml:id="w1"><' + tag + ">Hallo</" + tag + "></w>"),
    `${kind}: wraps the cell core, the other word untouched`);
  check(doc.raw.includes('<w xml:id="w2">Welt</w>'), `${kind}: sibling word is byte-identical`);
  check(reparses(doc.raw), `${kind}: tokenizer covers every byte (lossless parse)`);
  const re = parseEdition(doc.raw);
  check(re.cellById.get("w1") && re.cellById.get("w1").crit === tag && re.cellById.get("w1").critSole,
    `${kind}: the reparsed cell reports crit === "${tag}", sole content`);
}

// --- 2. wrapping preserves a line cell's edge whitespace (LF) ----------------

const LRAW = WRAP('\n<pb n="1"/>\n<p>\n  <lb n="1"/>Zeile eins\n</p>\n');
const lstate = parseEdition(LRAW);
const lcell = cellByText(lstate, "Zeile eins");
const ldoc = markCritical(lstate.doc, lcell.node, "unclear");
check(ldoc.raw.includes('<lb n="1"/><unclear>Zeile eins</unclear>\n</p>'),
  "line wrap: core wrapped, trailing newline kept outside the tags");
check(reparses(ldoc.raw), "line wrap: tokenizer covers every byte");

// --- 2b. CRLF document: \r\n stays outside the tags, unwrap is byte-exact -----

const CRLF = WRAP('\r\n<p>\r\n  <lb n="1"/>Zeile zwei\r\n</p>\r\n');
const cstate = parseEdition(CRLF);
const ccell = cellByText(cstate, "Zeile zwei");
const cdoc = markCritical(cstate.doc, ccell.node, "del");
check(cdoc.raw.includes('<lb n="1"/><del>Zeile zwei</del>\r\n</p>'),
  "CRLF wrap: the \\r\\n pair is kept outside the tags");
const cre = parseEdition(cdoc.raw);
const cBack = unwrapCritical(cre.doc, cellByText(cre, "Zeile zwei").node);
check(cBack.raw === CRLF, "CRLF unwrap: restores the original CRLF bytes exactly");

// --- 3. no-op: re-marking the SAME kind (sole and mixed content) -------------

const dOnce = parseEdition(markCritical(parseEdition(WRAW).doc, parseEdition(WRAW).cellById.get("w1").node, "del").raw);
check(markCritical(dOnce.doc, dOnce.cellById.get("w1").node, "del") === dOnce.doc,
  "no-op: re-marking an already-<del> sole-content cell returns the SAME doc");

const MIX = WRAP("<p><del>Hallo <hi>X</hi> Welt</del></p>");
const mstate = parseEdition(MIX);
const mcell = cellByText(mstate, "Hallo");
check(mcell.crit === "del" && !mcell.critSole, "mixed content: cell reports crit del, NOT sole content");
check(markCritical(mstate.doc, mcell.node, "del") === mstate.doc,
  "no-op: re-marking the same kind on mixed content does NOT nest (SAME doc)");

// --- 4. unwrapCritical restores plain text for all wrap kinds ----------------

for (const kind of ["unclear", "del", "add"]) {
  const w = parseEdition(markCritical(parseEdition(WRAW).doc, parseEdition(WRAW).cellById.get("w1").node, kind).raw);
  const back = unwrapCritical(w.doc, w.cellById.get("w1").node);
  check(back.raw === WRAW, `unwrap ${kind}: removing the wrapper restores the original bytes exactly`);
}
const plain = parseEdition(WRAW);
check(unwrapCritical(plain.doc, plain.cellById.get("w1").node) === plain.doc,
  "unwrap: a no-op when the cell has no critical wrapper (SAME doc)");

// --- 4b. unwrap REFUSES to strip a wrapper shared with siblings (no loss) ----

check(unwrapCritical(mstate.doc, mcell.node) === mstate.doc,
  "unwrap: refuses a shared (mixed-content) wrapper, returning the SAME doc (no silent data loss)");

// --- 4c. different kinds nest; clearing the inner restores the outer ---------

const nest = markCritical(dOnce.doc, dOnce.cellById.get("w1").node, "unclear"); // del-wrapped, now mark unclear
check(nest.raw.includes("<del><unclear>Hallo</unclear></del>"), "nesting: a different kind wraps inside, both markers apply");
const nstate = parseEdition(nest.raw);
check(nstate.cellById.get("w1").crit === "unclear", "nesting: the cell reports the nearest (inner) wrapper");
const inner = parseEdition(unwrapCritical(nstate.doc, nstate.cellById.get("w1").node).raw);
check(inner.raw.includes("<del>Hallo</del>") && !inner.raw.includes("unclear"), "nesting: clearing the inner wrapper restores the outer <del>");
check(inner.cellById.get("w1").crit === "del", "nesting: after clearing inner, the cell reports del again");

// --- 5. gap replaces the core, with and without a reason ---------------------

const gdoc = markCritical(lstate.doc, lcell.node, "gap", { reason: "illegible" });
check(gdoc.raw.includes('<lb n="1"/><gap reason="illegible"/>\n</p>'),
  "gap: replaces the core with <gap reason>, edge whitespace kept, text omitted");
check(reparses(gdoc.raw), "gap: tokenizer covers every byte");
const gPlain = markCritical(lstate.doc, lcell.node, "gap");
check(gPlain.raw.includes('<lb n="1"/><gap/>\n</p>'), "gap: no reason yields a bare <gap/>");

// --- 6. the cell model surfaces a gap as its own cell -----------------------

const gstate = parseEdition(gdoc.raw);
const gapCell = gstate.cells.find((c) => c.gap);
check(!!gapCell && gapCell.crit === "gap" && gapCell.text === "" && gapCell.critSole === false,
  "gap cell: appears with gap:true, crit:'gap', empty text, not sole-clearable");
check(!cellByText(gstate, "Zeile eins"), "gap cell: the omitted text is no longer an editable cell");

// --- 6b. gap at word level: own cell between two <w>, removeGap residual -----

const WGAP = WRAP('<p><w xml:id="g1">Hallo</w> <gap/> <w xml:id="g2">Welt</w></p>');
const wg = parseEdition(WGAP);
check(wg.profile === "word", "word-level gap: the profile is still word");
check(cellByText(wg, "Hallo") && wg.cells.some((c) => c.gap) && cellByText(wg, "Welt"),
  "word-level gap: the gap is its own cell between the two words");
const wgRemoved = removeGap(wg.doc, wg.cells.find((c) => c.gap).node);
check(!wgRemoved.raw.includes("<gap") && reparses(wgRemoved.raw),
  "word-level gap: removeGap splices it out, the words intact, byte coverage holds");

// --- 6c. a gap in a non-reading subtree does NOT leak as a cell --------------

const LEAK =
  '<TEI xmlns="http://www.tei-c.org/ns/1.0">' + HEADER +
  "<text><standOff><note>n <gap/></note></standOff><p>real text</p></text></TEI>";
const lk = parseEdition(LEAK);
check(!lk.cells.some((c) => c.gap), "gap guard: a <gap/> inside <standOff> does not leak into the reading view");
check(!!cellByText(lk, "real text"), "gap guard: the genuine reading text is still a cell");

// --- 7. removeGap splices the marker out; no-op on a non-gap node ------------

const removed = removeGap(gstate.doc, gapCell.node);
check(!removed.raw.includes("<gap") && reparses(removed.raw),
  "removeGap: the <gap/> element is gone and byte coverage holds");
check(removeGap(lstate.doc, lcell.node) === lstate.doc,
  "removeGap: a no-op when the node is not a gap (SAME doc)");

// --- 8. entity spellings are preserved verbatim (no decode/re-escape) --------

const ERAW = WRAP('<p><w xml:id="e1">A&amp;B</w></p>');
const estate = parseEdition(ERAW);
const edoc = markCritical(estate.doc, estate.cellById.get("e1").node, "del");
check(edoc.raw.includes("<del>A&amp;B</del>"), "entity guard: &amp; inside the core is wrapped verbatim, not churned");
check(reparses(edoc.raw), "entity guard: tokenizer covers every byte");

// --- 9. markCritical SAME-doc guard paths -----------------------------------

const doc0 = parseDocument(WRAW);
const wsNode = textNodes(doc0.root).find((n) => {
  const s = doc0.raw.slice(n.start, n.end);
  return s.length > 0 && s.trim() === "";
});
check(!!wsNode && markCritical(doc0, wsNode, "del") === doc0,
  "guard: a whitespace-only core is a no-op (SAME doc)");
check(markCritical(gstate.doc, gapCell.node, "unclear") === gstate.doc,
  "guard: marking a non-text node (a gap element) is a no-op (SAME doc)");

// --- summary -----------------------------------------------------------------

console.log("=".repeat(60));
if (failed === 0) {
  console.log(`PASSED (${passed}/${passed})`);
  console.log("Textual-critical markup is applied and reversed losslessly, sharing-safe.");
  process.exit(0);
} else {
  console.log(`FAILED (${passed}/${passed + failed}, ${failed} failing)`);
  process.exit(1);
}
