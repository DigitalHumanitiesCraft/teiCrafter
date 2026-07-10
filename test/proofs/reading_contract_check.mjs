/**
 * Proof: two properties of how the engine reads TEI that the Engine Reading
 * Contract (knowledge/architecture.md) states, pinned here so a parser change
 * that alters them is noticed.
 *
 *   1. Lossless even on malformed nesting. The offset core keeps the raw string
 *      canonical and edits it by offsets, so serialize() is byte-identical even
 *      when the input is NOT well-formed. The derived projection (mention scope,
 *      the ancestor walk) closes the nearest matching ancestor and may therefore
 *      diverge from the author's intent; the browser's live well-formedness check
 *      (DOMParser) is the separate safety net that flags such input. This proof
 *      pins the unconditional lossless guarantee and the observed projection.
 *
 *   2. A single global editing profile. The profile is read once for the whole
 *      document: word if any <w xml:id> is present anywhere, else line. There is
 *      no per-folio detection, so a <w>-free folio inside an otherwise
 *      word-tokenized document is edited as whole-line cells, not words.
 *
 * Run: node test/proofs/reading_contract_check.mjs   (exit 0 = all pass)
 */

import { parseDocument, elementsByLocal } from "../../docs/js/editor/tei-document.js";
import { parseEdition } from "../../docs/js/editor/edition.js";

let passed = 0, failed = 0;
function check(cond, label) {
  if (cond) { passed++; console.log("  ok    " + label); }
  else { failed++; console.log("  FAIL  " + label); }
}

console.log("\nEngine reading contract proof (lossless-on-malformed, global profile)");
console.log("=".repeat(70));

// ===========================================================================
// 1. Lossless even on malformed nesting
// ===========================================================================
// </hi> in line 2 has no opener; line 3 closes </name> before </hi>, so <name>
// and <hi> are mis-nested. This is deliberately NOT well-formed XML.
const mal = `<TEI><text><body>
<p><lb/>alpha</p>
<p><lb/>beta gamma</hi>
<p><lb/><name ref="#p1">delta <hi>epsilon</name> zeta</hi> eta</p>
</body></text></TEI>`;

const docMal = parseDocument(mal);
check(docMal.serialize() === mal, "serialize() is byte-identical on not-well-formed input (lossless unconditionally)");

const stMal = parseEdition(mal);
check(stMal.profile === "line", "a document with no <w> reads as the line profile");
check(Array.isArray(stMal.cells) && stMal.cells.length > 0, "the projection of malformed input does not throw and yields cells");

// The observed mention scope: <name ref="#p1"> covers delta and the <hi>epsilon
// up to the (early) </name>; zeta and eta fall outside. Pinned so a parser change
// to the ancestor walk is noticed, not silently accepted.
const byText = (t) => stMal.cells.find((c) => c.text.trim() === t);
check(byText("delta") && byText("delta").mention === "p1", "delta projects mention p1 (inside <name>)");
check(byText("epsilon") && byText("epsilon").mention === "p1", "epsilon projects mention p1 (mis-nested, still inside the open <name>)");
const zeta = stMal.cells.find((c) => c.text.includes("zeta"));
check(zeta && zeta.mention == null, "zeta (after the early </name>) carries no mention");

// The stray/mis-nested <hi> in line 3 is parsed but never cleanly closed.
const his = elementsByLocal(docMal.root, "hi");
check(his.length === 1, "one <hi> element is recognised (the line-3 opener)");
check(his[0].outerEnd == null, "the mis-nested <hi> has no recorded close (outerEnd unset), yet the round-trip stayed byte-identical");

// ===========================================================================
// 2. A single global editing profile (no per-folio detection)
// ===========================================================================
// Folio 1 is word-tagged; folio 2 is plain line-level prose.
const mixed = `<TEI><text><body>
<pb n="1"/>
<p><lb/><w xml:id="w1">Wien</w> <w xml:id="w2">1879</w></p>
<pb n="2"/>
<p><lb/>Mit hochachtungsvollem Gruss</p>
</body></text></TEI>`;

const stMixed = parseEdition(mixed);
check(stMixed.profile === "word", "a single <w> anywhere sets the WHOLE document to the word profile");
check(stMixed.folios.length === 2, "the document splits into two folios on <pb>");
check(parseDocument(mixed).serialize() === mixed, "the mixed document round-trips byte-identically");

const f1cells = stMixed.folios[0].lines.flatMap((l) => l.cells.map((c) => c.text));
check(f1cells.length === 2 && f1cells[0] === "Wien" && f1cells[1] === "1879", "the word-tagged folio yields two word cells (Wien, 1879)");

const f2cells = stMixed.folios[1].lines.flatMap((l) => l.cells);
check(f2cells.length === 1 && f2cells[0].text.includes("Mit hochachtungsvollem Gruss"),
  "the <w>-free folio under the global word profile is ONE whole-line cell, not words");

// ===========================================================================
console.log("=".repeat(70));
if (failed === 0) {
  console.log(`PASSED (${passed}/${passed})`);
  console.log("Lossless holds on malformed input; the editing profile is one global property.");
  process.exit(0);
} else {
  console.log(`FAILED (${passed}/${passed + failed}, ${failed} failing)`);
  process.exit(1);
}
