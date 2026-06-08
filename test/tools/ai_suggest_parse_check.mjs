/**
 * Proof: the LLM reply parser (ai-suggest.js) is robust. It tolerates a code
 * fence and surrounding prose, normalises free-form type labels to teiCrafter
 * types, drops malformed/unknown items, de-duplicates, and never throws. This is
 * the only part of the M3.7 flow that is deterministic; the network call itself
 * is browser-verified. The marking/confirm/reject engine is in ai_proposal_check.
 *
 * Run: node test/tools/ai_suggest_parse_check.mjs   (exit 0 = all pass)
 */

import { parseSuggestions, buildSuggestPrompt } from "../../docs/js/editor/ai-suggest.js";

let passed = 0, failed = 0;
function check(cond, label) {
  if (cond) { passed++; console.log("  ok    " + label); }
  else { failed++; console.log("  FAIL  " + label); }
}
const sameSet = (a, b) =>
  a.length === b.length &&
  a.every((x, i) => x.type === b[i].type && x.name === b[i].name);

console.log("\nAI suggestion parser proof (M3.7)");
console.log("=".repeat(60));

// --- clean array -------------------------------------------------------------

check(sameSet(
  parseSuggestions('[{"type":"person","name":"Anna"},{"type":"place","name":"Wien"}]'),
  [{ type: "person", name: "Anna" }, { type: "place", name: "Wien" }]
), "clean JSON array parses in order");

// --- code fence + prose around the array ------------------------------------

check(sameSet(
  parseSuggestions('Here you go:\n```json\n[{"type":"org","name":"PEN Club"}]\n```\nHope it helps.'),
  [{ type: "org", name: "PEN Club" }]
), "code fence and surrounding prose are tolerated");

// --- type normalisation ------------------------------------------------------

check(sameSet(
  parseSuggestions('[{"type":"Organisation","name":"X"},{"type":"location","name":"Y"},{"type":"people","name":"Z"},{"type":"title","name":"W"}]'),
  [{ type: "org", name: "X" }, { type: "place", name: "Y" }, { type: "person", name: "Z" }, { type: "work", name: "W" }]
), "free-form type labels normalise (Organisation/location/people/title)");

// --- drop malformed / unknown / empty ---------------------------------------

check(sameSet(
  parseSuggestions('[{"type":"person","name":"Keep"},{"type":"alien","name":"Drop"},{"type":"place","name":""},{"name":"NoType"},null,42]'),
  [{ type: "person", name: "Keep" }]
), "unknown type, empty name, missing type, and non-objects are dropped");

// --- de-duplication (case-insensitive on name) ------------------------------

check(sameSet(
  parseSuggestions('[{"type":"person","name":"Anna"},{"type":"person","name":"anna"},{"type":"place","name":"Anna"}]'),
  [{ type: "person", name: "Anna" }, { type: "place", name: "Anna" }]
), "duplicates by type+name (case-insensitive) collapse; different type stays");

// --- whitespace trimming on names -------------------------------------------

check(sameSet(parseSuggestions('[{"type":"place","name":"  Komotau  "}]'), [{ type: "place", name: "Komotau" }]),
  "names are trimmed");

// --- never throws: garbage in, [] out ----------------------------------------

for (const bad of [null, undefined, "", "not json", "{}", "[", '{"type":"person"}', '"a string"', "[1,2,3"]) {
  if (parseSuggestions(bad).length !== 0) { check(false, "garbage -> [] for " + JSON.stringify(bad)); }
}
check(true, "all garbage inputs return [] without throwing");

// --- prompt carries the text -------------------------------------------------

const p = buildSuggestPrompt("Anna lebt in Wien.");
check(p.includes("Anna lebt in Wien.") && /JSON array/i.test(p), "prompt embeds the text and asks for a JSON array");

// --- summary -----------------------------------------------------------------

console.log("=".repeat(60));
if (failed === 0) {
  console.log(`PASSED (${passed}/${passed})`);
  console.log("The suggestion parser is robust and deterministic.");
  process.exit(0);
} else {
  console.log(`FAILED (${passed}/${passed + failed}, ${failed} failing)`);
  process.exit(1);
}
