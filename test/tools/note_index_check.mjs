/**
 * Proof: standoff.noteIndex reads editorial notes by tree walk, not by regex.
 * Covered: double- AND single-quoted @target (the former regex reader missed
 * single quotes), multi-id targets, child markup inside the note body (tags
 * fall away, their text stays), entity decoding, whitespace trimming, and
 * notes without @target are skipped.
 *
 * Run: node test/tools/note_index_check.mjs   (exit 0 = all pass)
 */

import { parseDocument } from "../../docs/js/editor/tei-document.js";
import { noteIndex } from "../../docs/js/editor/standoff.js";

let passed = 0, failed = 0;
function check(cond, label) {
  if (cond) { passed++; console.log("  ok    " + label); }
  else { failed++; console.log("  FAIL  " + label); }
}

console.log("\nNote index (tree-walk reader) proof");
console.log("=".repeat(60));

const RAW =
  '<TEI xmlns="http://www.tei-c.org/ns/1.0">' +
  "<teiHeader><fileDesc><titleStmt><title>t</title></titleStmt></fileDesc></teiHeader>" +
  "<standOff>" +
  '<note target="#w1">plain note</note>' +
  "<note target='#w2'>single quoted</note>" +
  '<note target="#a #b">shared note</note>' +
  '<note target="#m">see <hi rend="i">this</hi> word</note>' +
  '<note target="#e">Fischer &amp; Co &lt;1922&gt;</note>' +
  '<note target="#t">  padded  </note>' +
  "<note>orphan without target</note>" +
  "</standOff>" +
  "<text><body><p>x</p></body></text></TEI>";

const idx = noteIndex(parseDocument(RAW));

check(idx.get("w1") === "plain note", "double-quoted @target is read");
check(idx.get("w2") === "single quoted", "single-quoted @target is read (the regex reader missed it)");
check(idx.get("a") === "shared note" && idx.get("b") === "shared note",
  "a multi-id target indexes the note under every id");
check(idx.get("m") === "see this word",
  "child markup in the body falls away, its text content stays");
check(idx.get("e") === "Fischer & Co <1922>", "entities in the body are decoded");
check(idx.get("t") === "padded", "body whitespace is trimmed");
check(idx.size === 7, "the note without @target is skipped (7 indexed ids, the multi-id note counts twice)");

// An empty or note-free document yields an empty index and never throws.
const empty = noteIndex(parseDocument(
  '<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p>x</p></body></text></TEI>'));
check(empty.size === 0, "a note-free document yields an empty index");

console.log("=".repeat(60));
if (failed === 0) {
  console.log(`PASSED (${passed}/${passed})`);
  console.log("The note index is a tree walk over the parsed doc, quote-agnostic and markup-safe.");
  process.exit(0);
} else {
  console.log(`FAILED (${passed}/${passed + failed}, ${failed} failing)`);
  process.exit(1);
}
