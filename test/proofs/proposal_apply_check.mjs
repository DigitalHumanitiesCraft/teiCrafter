/**
 * Proof: the general AI-proposal pipeline (ai-suggest.js parser + proposal-apply.js).
 * The parser reads a mixed reply (entity, markup, criticism, note) into normalised
 * proposals; applyProposals locates each by its surface text and inserts it as a
 * lossless, resp-marked construct via the generic engine ops, re-parsing between
 * proposals so offsets stay valid. The reading text is preserved (only the
 * deliberate annotations differ from the input), the round-trip is byte-faithful,
 * an unlocatable span is reported not crashed, and every construct projects as AI.
 *
 * Run: node test/proofs/proposal_apply_check.mjs   (exit 0 = all pass)
 */

import { parseDocument } from "../../docs/js/editor/tei-document.js";
import { parseEdition } from "../../docs/js/editor/edition.js";
import { parseSuggestions } from "../../docs/js/editor/ai-suggest.js";
import { applyProposals, createProposalScope } from "../../docs/js/editor/proposal-apply.js";
import { confirmConstruct, rejectConstruct } from "../../docs/js/editor/proposal-review.js";
import { readingText } from "./_assert.mjs";

let passed = 0, failed = 0;
function check(cond, label) {
  if (cond) { passed++; console.log("  ok    " + label); }
  else { failed++; console.log("  FAIL  " + label); }
}

console.log("\nGeneral AI-proposal pipeline proof (parse + lossless apply)");
console.log("=".repeat(66));

// --- 1. the generalised parser reads every kind ------------------------------
const reply = JSON.stringify([
  { kind: "entity", type: "person", name: "Hugo Schuchardt", span: "Schuchardt" },
  { kind: "markup", element: "date", attributes: { when: "1879" }, span: "1879" },
  { kind: "criticism", critKind: "unclear", span: "Sehr" },
  { kind: "note", text: "Honorific address.", span: "Herr" },
  { kind: "entity", type: "place", name: "Wien", span: "wien" }, // unique case-only deviation
  { kind: "entity", type: "place", name: "Zurich", span: "Zurich" }, // not in the text
]);
const proposals = parseSuggestions(reply);
check(proposals.length === 6, "all six proposals parse");
check(proposals[0].kind === "entity" && proposals[1].kind === "markup"
  && proposals[2].kind === "criticism" && proposals[3].kind === "note",
  "each proposal carries its kind");
check(proposals[1].attributes.when === "1879", "markup attributes are parsed");
// legacy entity-only items still parse (back-compat)
check(parseSuggestions('[{"type":"person","name":"Anna"}]')[0].kind === "entity",
  "a legacy {type,name} item infers kind=entity");

// --- 2. apply them losslessly ------------------------------------------------
const SRC =
  '<TEI><teiHeader><fileDesc><titleStmt><title>T</title></titleStmt></fileDesc></teiHeader><text><body>\n' +
  "<p><lb/>Wien 1879. Sehr geehrter Herr Schuchardt und Freund.</p>\n" +
  "</body></text></TEI>";
const result = applyProposals(parseEdition(SRC), proposals);

check(result.applied.length === 5, "five locatable proposals applied");
check(result.skipped.length === 1 && result.skipped[0].reason === "span-not-found",
  "the proposal whose span is absent is reported, not applied");

// each construct present and resp-marked
check(result.raw.includes('<persName resp="#ai">Schuchardt</persName>'), "entity -> resp-marked <persName> around the span");
check(result.raw.includes('<date when="1879" resp="#ai">1879</date>'), "markup -> resp-marked <date when> around the span");
check(result.raw.includes('<unclear resp="#ai">Sehr</unclear>'), "criticism -> resp-marked <unclear> around the span");
check(/<note target="#[^"]+" resp="#ai">Honorific address\.<\/note>/.test(result.raw), "note -> resp-marked <note> anchored to the span's line");
check(result.raw.includes('<placeName resp="#ai">Wien</placeName>'),
  "one unique case-only span deviation resolves to the original surface form");
const repeated = parseEdition(SRC.replace("Wien 1879", "Wien und WIEN 1879"));
const ambiguous = applyProposals(repeated,
  [{ kind: "entity", type: "place", name: "Wien", span: "wien" }]);
check(ambiguous.applied.length === 0 && ambiguous.skipped[0]?.reason === "ambiguous-span",
  "a case-insensitive fallback never chooses between repeated candidates");

const TWO_PAGES = SRC.replace("<p><lb/>", '<pb n="1"/><p><lb/>')
  .replace("</body>", '<pb n="2"/><p><lb/>Wien again.</p></body>');
const twoPageState = parseEdition(TWO_PAGES);
const firstPageScope = createProposalScope(twoPageState, 0);
const scoped = applyProposals(twoPageState,
  [{ kind: "entity", type: "place", name: "Wien", span: "Wien" }],
  { scope: firstPageScope });
check(scoped.applied.length === 1
  && scoped.raw.indexOf('<placeName resp="#ai">Wien</placeName>') < scoped.raw.indexOf('<pb n="2"/>'),
  "a folio scope places a proposal only inside the requested page snapshot");
let staleScopeRejected = false;
try {
  applyProposals(parseEdition(TWO_PAGES.replace("again", "changed")), [], { scope: firstPageScope });
} catch (error) {
  staleScopeRejected = /snapshot/.test(error.message);
}
check(staleScopeRejected, "a proposal scope cannot be reused against another raw revision");

// --- 3. losslessness: reading text preserved, round-trip byte-identical -------
const finalState = result.state;
check(readingText(result.raw) === readingText(SRC),
  "the reading text is preserved exactly (only the markup differs)");
check(parseDocument(result.raw).serialize() === result.raw, "the result round-trips byte-identically");

// --- 4. a proposed gap retains its source bytes until human confirmation -----
const gapResult = applyProposals(parseEdition(SRC),
  [{ kind: "criticism", critKind: "gap", span: "Schuchardt", reason: "illegible" }]);
check(gapResult.raw.includes('<choice resp="#ai"><orig>Schuchardt</orig><reg><gap reason="illegible" resp="#ai"/></reg></choice>'),
  "a proposed gap stores the exact reading in a reversible TEI choice");
const gapChoice = gapResult.state.cells.find((cell) => cell.text === "Schuchardt")
  .layers.find((layer) => layer.localName === "choice").el;
const gapRejected = rejectConstruct(gapResult.state.doc, gapChoice);
check(gapRejected.raw === SRC, "rejecting a proposed gap restores the original document byte-for-byte");
const gapConfirmed = confirmConstruct(gapResult.state.doc, gapChoice);
check(gapConfirmed.raw.includes('<gap reason="illegible"/>')
  && !gapConfirmed.raw.includes("Schuchardt") && !gapConfirmed.raw.includes('resp="#ai"'),
  "confirming a proposed gap commits the text-removing gap and drops AI provenance");

// --- 5. every applied construct projects as AI (resp on its layer) -----------
const cellOf = (t) => finalState.cells.find((c) => c.text.trim() === t);
check(cellOf("Schuchardt") && cellOf("Schuchardt").layers.some((l) => l.localName === "persName" && l.resp === "#ai"),
  "the Schuchardt cell projects a persName layer marked AI");
check(cellOf("1879") && cellOf("1879").layers.some((l) => l.localName === "date" && l.resp === "#ai"),
  "the 1879 cell projects a date layer marked AI");
check(cellOf("Sehr") && cellOf("Sehr").layers.some((l) => l.localName === "unclear" && l.resp === "#ai"),
  "the Sehr cell projects an unclear layer marked AI");

// --- 6. robustness: garbage and empty ----------------------------------------
check(applyProposals(parseEdition(SRC), parseSuggestions("not json")).applied.length === 0,
  "a garbage reply yields no edits and does not throw");
check(applyProposals(parseEdition(SRC), []).raw === SRC, "no proposals leaves the document byte-identical");

console.log("=".repeat(66));
if (failed === 0) {
  console.log(`PASSED (${passed}/${passed})`);
  console.log("Proposals of any kind apply as lossless, resp-marked, AI-projected constructs.");
  process.exit(0);
} else {
  console.log(`FAILED (${passed}/${passed + failed}, ${failed} failing)`);
  process.exit(1);
}
