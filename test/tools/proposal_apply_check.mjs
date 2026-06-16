/**
 * Proof: the general AI-proposal pipeline (ai-suggest.js parser + proposal-apply.js).
 * The parser reads a mixed reply (entity, markup, criticism, note) into normalised
 * proposals; applyProposals locates each by its surface text and inserts it as a
 * lossless, resp-marked construct via the generic engine ops, re-parsing between
 * proposals so offsets stay valid. The reading text is preserved (only the
 * deliberate annotations differ from the input), the round-trip is byte-faithful,
 * an unlocatable span is reported not crashed, and every construct projects as AI.
 *
 * Run: node test/tools/proposal_apply_check.mjs   (exit 0 = all pass)
 */

import { parseDocument } from "../../docs/js/editor/tei-document.js";
import { parseEdition } from "../../docs/js/editor/edition.js";
import { parseSuggestions } from "../../docs/js/editor/ai-suggest.js";
import { applyProposals } from "../../docs/js/editor/proposal-apply.js";

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
  { kind: "entity", type: "place", name: "Zurich", span: "Zurich" }, // not in the text
]);
const proposals = parseSuggestions(reply);
check(proposals.length === 5, "all five proposals parse");
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
const lineText = "Wien 1879. Sehr geehrter Herr Schuchardt und Freund.";
const result = applyProposals(parseEdition(SRC), proposals);

check(result.applied.length === 4, "four locatable proposals applied");
check(result.skipped.length === 1 && result.skipped[0].reason === "span-not-found",
  "the proposal whose span is absent is reported, not applied");

// each construct present and resp-marked
check(result.raw.includes('<persName resp="#ai">Schuchardt</persName>'), "entity -> resp-marked <persName> around the span");
check(result.raw.includes('<date when="1879" resp="#ai">1879</date>'), "markup -> resp-marked <date when> around the span");
check(result.raw.includes('<unclear resp="#ai">Sehr</unclear>'), "criticism -> resp-marked <unclear> around the span");
check(/<note target="#[^"]+" resp="#ai">Honorific address\.<\/note>/.test(result.raw), "note -> resp-marked <note> anchored to the span's line");

// --- 3. losslessness: reading text preserved, round-trip byte-identical -------
const finalState = result.state;
const bodyText = finalState.cells.map((c) => c.text).join("");
check(bodyText === lineText, "the reading text is preserved exactly (only the markup differs)");
check(parseDocument(result.raw).serialize() === result.raw, "the result round-trips byte-identically");

// --- 4. every applied construct projects as AI (resp on its layer) -----------
const cellOf = (t) => finalState.cells.find((c) => c.text.trim() === t);
check(cellOf("Schuchardt") && cellOf("Schuchardt").layers.some((l) => l.localName === "persName" && l.resp === "#ai"),
  "the Schuchardt cell projects a persName layer marked AI");
check(cellOf("1879") && cellOf("1879").layers.some((l) => l.localName === "date" && l.resp === "#ai"),
  "the 1879 cell projects a date layer marked AI");
check(cellOf("Sehr") && cellOf("Sehr").layers.some((l) => l.localName === "unclear" && l.resp === "#ai"),
  "the Sehr cell projects an unclear layer marked AI");

// --- 5. robustness: garbage and empty ----------------------------------------
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
