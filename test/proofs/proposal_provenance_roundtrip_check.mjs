/**
 * Proof: responsibility and certainty of a model proposal survive serialisation,
 * both while the construct is pending and after a named person confirmed it.
 * A proposal with @cert is applied, saved, reopened and confirmed; each stage must
 * re-serialise byte-identically, keep @resp origin and @cert, record the confirming
 * person and the acceptance, and stay valid against TEI All.
 *
 * Run: node test/proofs/proposal_provenance_roundtrip_check.mjs   (exit 0 = all pass)
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { firstTeiByLocal, getUnqualifiedAttr, parseDocument } from "../../docs/js/editor/tei-document.js";
import { parseEdition } from "../../docs/js/editor/edition.js";
import { applyProposals } from "../../docs/js/editor/proposal-apply.js";
import { confirmConstruct } from "../../docs/js/editor/proposal-review.js";
import { isAcceptedProposal, isPendingProposal } from "../../docs/js/editor/proposal-provenance.js";
import { validateWithSchemas, schemaSources } from "../../docs/js/editor/schema-validation.js";

const SRC = '<TEI xmlns="http://www.tei-c.org/ns/1.0"><teiHeader><fileDesc><titleStmt><title>T</title></titleStmt>'
  + "<publicationStmt><p>P</p></publicationStmt><sourceDesc><p>S</p></sourceDesc></fileDesc></teiHeader>"
  + "<text><body><p>Geschrieben 1879 in Graz.</p></body></text></TEI>";
const CONFIRMER = "https://example.org/editor";
const schema = [{ ...schemaSources(null)[0], text: readFileSync("docs/schemas/tei-p5-4.11.0/tei_all.rng", "utf8") }];

/** Save and reopen: the serialised bytes are the persisted file. */
function roundTrip(raw) {
  const reopened = parseDocument(raw);
  assert.equal(reopened.serialize(), raw, "serialisation is byte-identical");
  return reopened;
}

const proposed = applyProposals(parseEdition(SRC), [
  { kind: "markup", element: "date", attributes: { when: "1879", cert: "medium" }, span: "1879" },
]);
assert.equal(proposed.applied.length, 1);
const pendingDoc = roundTrip(proposed.raw);
const pending = firstTeiByLocal(pendingDoc.root, "date");
assert.equal(getUnqualifiedAttr(pending, "resp"), "#ai");
assert.equal(getUnqualifiedAttr(pending, "cert"), "medium");
assert.equal(isPendingProposal(pending, "#ai"), true);

const confirmedDoc = roundTrip(confirmConstruct(pendingDoc, pending, { confirmer: CONFIRMER }).raw);
const confirmed = firstTeiByLocal(confirmedDoc.root, "date");
assert.equal(getUnqualifiedAttr(confirmed, "resp"), `#ai ${CONFIRMER}`, "origin and confirming person are recorded");
assert.equal(getUnqualifiedAttr(confirmed, "cert"), "medium", "certainty survives confirmation");
assert.equal(getUnqualifiedAttr(confirmed, "ana"), "urn:teicrafter:proposal:accepted:%23ai");
assert.equal(isAcceptedProposal(confirmed, "#ai"), true);
assert.equal(confirmConstruct(confirmedDoc, confirmed, { confirmer: "urn:other" }), confirmedDoc,
  "a second confirmation leaves the first record unchanged");

for (const raw of [pendingDoc.raw, confirmedDoc.raw]) {
  assert.equal((await validateWithSchemas(raw, schema))[0].status, "valid");
}
console.log("PASS: @resp and @cert survive serialisation on pending and confirmed proposals; the confirmer is recorded.");
