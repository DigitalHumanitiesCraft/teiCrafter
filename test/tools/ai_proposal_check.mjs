/**
 * Proof: AI-proposed entities (M3.7) carry a lossless, schema-valid marker
 * (resp="#ai"), are readable as unverified, and the human gate works:
 *   - confirm drops the marker (entity becomes verified), keeping name + idno;
 *   - reject (deleteEntity) removes the entity entirely;
 *   - every step round-trips byte-identically.
 * This is the "AI assists, human decides" mechanism the expert-in-the-loop thesis rests on.
 *
 * Run: node test/tools/ai_proposal_check.mjs   (exit 0 = all pass)
 */

import { parseDocument } from "../../docs/js/editor/tei-document.js";
import {
  addEntity, readEntities, confirmEntity, deleteEntity, setAuthority, AI_RESP,
} from "../../docs/js/editor/standoff.js";

let passed = 0, failed = 0;
function check(cond, label) {
  if (cond) { passed++; console.log("  ok    " + label); }
  else { failed++; console.log("  FAIL  " + label); }
}
const reparses = (doc) => parseDocument(doc.raw).serialize() === doc.raw;

console.log("\nAI annotation proposal proof (M3.7)");
console.log("=".repeat(60));

const RAW =
  '<TEI xmlns="http://www.tei-c.org/ns/1.0">' +
  "<teiHeader><fileDesc><titleStmt><title>t</title></titleStmt></fileDesc></teiHeader>" +
  "<text><body><p>Anna lebt in Wien.</p></body></text></TEI>";

// --- 1. an AI-proposed entity is marked resp="#ai" and reads as unverified ----

let doc = addEntity(parseDocument(RAW), "person", { name: "Anna", ai: true });
const person = readEntities(doc).persons[0];
check(person && person.name === "Anna", "AI person was added with its name");
check(person.ai === true, "AI person reads as unverified (ai === true)");
check(doc.raw.includes('resp="' + AI_RESP + '"'), "the resp=\"#ai\" marker is present in the markup");
check(reparses(doc), "AI add re-parses byte-identically");

// A plain (human) add carries no marker.
const plain = addEntity(parseDocument(RAW), "place", { name: "Wien" });
check(readEntities(plain).places[0].ai === false, "a human-added entity is not marked AI");
check(!plain.raw.includes("resp="), "a human-added entity has no resp attribute");

// --- 2. an AI entity can still receive an authority id before confirmation ----

doc = setAuthority(doc, person.id, "GND", "118649" + "919");
check(doc.raw.includes('<idno type="GND">118649919</idno>'), "an authority idno attaches to the AI entity");
check(readEntities(doc).persons[0].ai === true, "it stays unverified until a human confirms");
check(reparses(doc), "authority on an AI entity re-parses byte-identically");

// --- 3. confirm drops the marker, keeping the name and the idno --------------

const confirmed = confirmEntity(doc, person.id);
const cp = readEntities(confirmed).persons[0];
check(cp.ai === false, "confirm clears the AI marker (now verified)");
check(cp.name === "Anna" && cp.authorities.some((a) => a.type === "GND" && a.value === "118649919"),
  "confirm preserves the name and the GND idno");
check(!confirmed.raw.includes("resp="), "the resp attribute is fully removed");
check(/<person xml:id="[^"]*"><persName>/.test(confirmed.raw), "the start tag is clean (no leftover double space)");
check(reparses(confirmed), "confirm re-parses byte-identically");

// confirm again is a no-op (no marker left).
check(confirmEntity(confirmed, person.id) === confirmed, "confirm on a verified entity is a no-op (same doc)");

// --- 4. reject removes the entity entirely ----------------------------------

const rejected = deleteEntity(doc, person.id);
check(readEntities(rejected).persons.length === 0, "reject (deleteEntity) removes the AI entity");
check(!rejected.raw.includes("resp=") && reparses(rejected), "after reject no marker remains, byte-identical re-parse");

// --- summary -----------------------------------------------------------------

console.log("=".repeat(60));
if (failed === 0) {
  console.log(`PASSED (${passed}/${passed})`);
  console.log("AI proposals are marked, gated, and confirmed/rejected losslessly.");
  process.exit(0);
} else {
  console.log(`FAILED (${passed}/${passed + failed}, ${failed} failing)`);
  process.exit(1);
}
