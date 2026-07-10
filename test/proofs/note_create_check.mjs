/**
 * Proof: editorial notes (M3.5) are created losslessly and target a stable
 * xml:id. addNoteForNode resolves the @target in three ways, in order:
 *   1. the nearest ancestor xml:id (word-level <w xml:id>),
 *   2. the line's @facs zone id (line-level with <lb facs>),
 *   3. a freshly injected xml:id on the enclosing element (neither present).
 * Notes land inside <standOff>; standoff.noteIndex (the reader the editor
 * uses) finds them.
 *
 * Run: node test/proofs/note_create_check.mjs   (exit 0 = all pass)
 */

import { parseEdition, serialize } from "../../docs/js/editor/edition.js";
import { parseDocument } from "../../docs/js/editor/tei-document.js";
import { addNote, addNoteForNode, ensureXmlId, noteIndex } from "../../docs/js/editor/standoff.js";

let passed = 0, failed = 0;
function check(cond, label) {
  if (cond) { passed++; console.log("  ok    " + label); }
  else { failed++; console.log("  FAIL  " + label); }
}
const cellByText = (state, t) => state.cells.find((c) => c.text.trim() === t);

console.log("\nEditorial note creation proof");
console.log("=".repeat(60));

const HEADER =
  "<teiHeader><fileDesc><titleStmt><title>t</title></titleStmt></fileDesc></teiHeader>";

// --- 1. word-level node resolves to its ancestor xml:id ----------------------

const WRAW =
  '<TEI xmlns="http://www.tei-c.org/ns/1.0">' + HEADER +
  '<text><body><p><w xml:id="w1">Hallo</w> <w xml:id="w2">Welt</w></p></body></text></TEI>';
const wstate = parseEdition(WRAW);
const wdoc = addNoteForNode(wstate.doc, wstate.cellById.get("w1").node, null, "needs check");
check(serialize({ raw: wdoc.raw }) === wdoc.raw && wdoc.raw !== WRAW, "word note: a new document is produced");
let notes = noteIndex(wdoc);
check(notes.size === 1 && notes.get("w1") === "needs check",
  "word note: target is the ancestor xml:id w1, text preserved");
check(wdoc.raw.includes("<standOff>") && wdoc.raw.indexOf("<note") > wdoc.raw.indexOf("<standOff>"),
  "word note: lives inside the scaffolded <standOff>");
check(parseDocument(wdoc.raw).serialize() === wdoc.raw, "word note: re-parses byte-identically");

// --- 2. line-level node falls back to the line's @facs zone id ---------------

const LRAW =
  '<TEI xmlns="http://www.tei-c.org/ns/1.0">' + HEADER +
  '<text><body>\n<pb n="1"/>\n<p>\n  <lb n="1" facs="#z1"/>Zeile eins\n</p>\n</body></text></TEI>';
const lstate = parseEdition(LRAW);
const lcell = cellByText(lstate, "Zeile eins");
check(!!lcell && lcell.facs === "z1", "line cell carries the line's @facs zone id (z1)");
const ldoc = addNoteForNode(lstate.doc, lcell.node, lcell.facs, "ambiguous reading");
notes = noteIndex(ldoc);
check(notes.size === 1 && notes.get("z1") === "ambiguous reading",
  "line note: target falls back to the zone id z1");
check(/Zeile eins/.test(ldoc.raw) && parseDocument(ldoc.raw).serialize() === ldoc.raw,
  "line note: body text untouched, byte-identical re-parse");

// --- 3. no ancestor id and no facs: an xml:id is injected --------------------

const PRAW =
  '<TEI xmlns="http://www.tei-c.org/ns/1.0">' + HEADER +
  "<text><body><p>nur text</p></body></text></TEI>";
const pstate = parseEdition(PRAW);
const pcell = cellByText(pstate, "nur text");
check(!!pcell && !pcell.facs, "plain cell has no ancestor id and no facs");
const pdoc = addNoteForNode(pstate.doc, pcell.node, pcell.facs, "see archive");
notes = noteIndex(pdoc);
check(notes.size === 1 && notes.values().next().value === "see archive",
  "injected note: a target id was created");
const injectedId = notes.keys().next().value;
check(pdoc.raw.includes('<p xml:id="' + injectedId + '">nur text</p>'),
  "injected note: the xml:id was added to the enclosing <p>, text intact");
check(parseDocument(pdoc.raw).serialize() === pdoc.raw, "injected note: re-parses byte-identically");

// --- 4. ensureXmlId is a no-op when the id already exists ---------------------

const e1 = ensureXmlId(pstate.doc, pstate.cells[0].node.parent, "x");
check(e1.doc !== pstate.doc, "ensureXmlId injects when absent (new doc)");
const reparsed = parseEdition(e1.doc.raw);
const e2 = ensureXmlId(reparsed.doc, reparsed.cells[0].node.parent, "x");
check(e2.doc === reparsed.doc && e2.id === e1.id, "ensureXmlId is a no-op when the id is already present");

// --- 5. empty text is a no-op, addNote without a node still anchors ----------

check(addNoteForNode(wstate.doc, wstate.cellById.get("w1").node, null, "   ") === wstate.doc,
  "empty note text is a byte-identical no-op (same doc)");
const direct = addNote(parseEdition(WRAW).doc, "w2", "direct note");
check(noteIndex(direct).get("w2") === "direct note",
  "addNote(doc, id, text) targets a given id directly");

// --- summary -----------------------------------------------------------------

console.log("=".repeat(60));
if (failed === 0) {
  console.log(`PASSED (${passed}/${passed})`);
  console.log("Notes are created losslessly with a stable, resolvable @target.");
  process.exit(0);
} else {
  console.log(`FAILED (${passed}/${passed + failed}, ${failed} failing)`);
  process.exit(1);
}
