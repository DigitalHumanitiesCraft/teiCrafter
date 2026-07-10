/**
 * Proof: the unified AI-provenance data layer (Phase 2). Model output is marked
 * with a @resp responsibility id ("#ai" by default), the cell projection exposes
 * that @resp per layer so the renderer can show ANY proposed construct (not only
 * entity mentions) as the AI family, the criticism and note ops can carry the
 * marker, and ensureRespStmt makes the @resp a real, non-dangling pointer. Every
 * op stays a byte-faithful offset splice.
 *
 * Run: node test/proofs/provenance_check.mjs   (exit 0 = all pass)
 */

import { parseDocument } from "../../docs/js/editor/tei-document.js";
import { parseEdition } from "../../docs/js/editor/edition.js";
import { markCritical, unwrapCritical } from "../../docs/js/editor/criticism.js";
import { addNote, ensureRespStmt } from "../../docs/js/editor/standoff.js";

let passed = 0, failed = 0;
function check(cond, label) {
  if (cond) { passed++; console.log("  ok    " + label); }
  else { failed++; console.log("  FAIL  " + label); }
}
const idempotent = (doc) => parseDocument(doc.serialize()).serialize() === doc.serialize();

console.log("\nUnified AI-provenance proof (@resp projection + resp-marked ops)");
console.log("=".repeat(66));

// --- 1. the cell projection exposes @resp per layer --------------------------
const HEADER = '<TEI><teiHeader><fileDesc><titleStmt><title>T</title></titleStmt></fileDesc></teiHeader>';
const projDoc =
  HEADER + "<text><body>\n" +
  '<p><lb/>Wien <date resp="#ai">1879</date> und <hi>Ende</hi></p>\n' +
  "</body></text></TEI>";
const st = parseEdition(projDoc);
const cell1879 = st.cells.find((c) => c.text.trim() === "1879");
const cellEnde = st.cells.find((c) => c.text.trim() === "Ende");
check(!!cell1879 && cell1879.layers.some((l) => l.localName === "date" && l.resp === "#ai"),
  "a cell inside <date resp=\"#ai\"> projects a layer with resp \"#ai\"");
check(!!cellEnde && cellEnde.layers.every((l) => l.resp === null),
  "a cell inside a human <hi> (no @resp) projects layers with resp null");
check(parseDocument(projDoc).serialize() === projDoc, "the projection does not alter the raw (byte-identical)");

// --- 2. markCritical carries the resp marker, byte-faithfully ----------------
const critDoc = HEADER + "<text><body>\n<p><lb/>schwer lesbar</p>\n</body></text></TEI>";
const cst = parseEdition(critDoc);
const target = cst.cells.find((c) => c.text.includes("schwer"));
const wrapped = markCritical(cst.doc, target.node, "unclear", { resp: "#ai" });
check(wrapped !== cst.doc, "markCritical with a resp returns a new doc");
check(wrapped.serialize().includes('<unclear resp="#ai">schwer lesbar</unclear>'),
  "the unclear wrapper carries resp=\"#ai\" around the exact core");
check(idempotent(wrapped), "the resp-marked criticism round-trips byte-identically");
// reversible: unwrapping restores the original bytes
const cst2 = parseEdition(wrapped.serialize());
const tgt2 = cst2.cells.find((c) => c.text.includes("schwer"));
check(unwrapCritical(cst2.doc, tgt2.node).serialize() === critDoc,
  "unwrapping the resp-marked criticism restores the original bytes exactly");
// a human criticism (no resp) carries no resp attribute
const human = markCritical(parseEdition(critDoc).doc, parseEdition(critDoc).cells.find((c) => c.text.includes("schwer")).node, "unclear");
check(!human.serialize().includes("resp="), "a human criticism (no opts.resp) carries no resp attribute");

// --- 3. addNote carries the resp marker --------------------------------------
const noteDoc = HEADER + '<text><body>\n<p xml:id="p1"><lb/>text</p>\n</body></text></TEI>';
const withNote = addNote(parseDocument(noteDoc), "p1", "Proposed by the model.", { resp: "#ai" });
check(withNote.serialize().includes('<note target="#p1" resp="#ai">Proposed by the model.</note>'),
  "addNote with a resp writes a note carrying resp=\"#ai\"");
check(idempotent(withNote), "the resp-marked note round-trips byte-identically");
check(!addNote(parseDocument(noteDoc), "p1", "Human note.").serialize().includes("resp="),
  "a human note (no opts.resp) carries no resp attribute");

// --- 4. ensureRespStmt makes #ai a real, non-dangling pointer ----------------
const e1 = ensureRespStmt(parseDocument(noteDoc), "#ai");
check(e1.serialize().includes('<respStmt xml:id="ai">'),
  "ensureRespStmt injects a <respStmt xml:id=\"ai\"> into the titleStmt");
check(idempotent(e1), "the injected respStmt round-trips byte-identically");
check(ensureRespStmt(e1, "#ai").serialize() === e1.serialize(),
  "ensureRespStmt is idempotent: a second call is a no-op once the id exists");
// no titleStmt to anchor to: degrade to the SAME doc
const noTitle = parseDocument("<TEI><text><body><p>x</p></body></text></TEI>");
check(ensureRespStmt(noTitle, "#ai") === noTitle, "ensureRespStmt no-ops (SAME doc) when there is no titleStmt");
// a custom responsibility id
check(ensureRespStmt(parseDocument(noteDoc), "#model").serialize().includes('<respStmt xml:id="model">'),
  "ensureRespStmt honours a custom responsibility id");

console.log("=".repeat(66));
if (failed === 0) {
  console.log(`PASSED (${passed}/${passed})`);
  console.log("AI provenance is one @resp marker, projected per layer, written byte-faithfully.");
  process.exit(0);
} else {
  console.log(`FAILED (${passed}/${passed + failed}, ${failed} failing)`);
  process.exit(1);
}
