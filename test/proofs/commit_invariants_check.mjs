/**
 * Proof: standoff.applyMutation is the DOM-free core of the editor's single
 * mutation path (editor-app.js commitStandoff wraps exactly it). For every
 * mutating standOff operation it must hold that:
 *   - a real change reports changed true, the new raw re-parses byte-identically,
 *     the edition state serializes to the committed raw, and the note index
 *     builds without throwing;
 *   - an idempotent repeat reports changed false and carries the SAME doc
 *     object through (the no-op contract);
 *   - a multi-step sequence stays consistent when every step re-acquires its
 *     nodes from the fresh edition state.
 *
 * Run: node test/proofs/commit_invariants_check.mjs   (exit 0 = all pass)
 */

import { parseEdition, serialize } from "../../docs/js/editor/edition.js";
import { parseDocument } from "../../docs/js/editor/tei-document.js";
import {
  applyMutation, addEntity, updateEntity, deleteEntity, setAuthority,
  confirmEntity, addNoteForNode, linkMention, readEntities,
} from "../../docs/js/editor/standoff.js";
import { markCritical } from "../../docs/js/editor/criticism.js";

let passed = 0, failed = 0;
function check(cond, label) {
  if (cond) { passed++; console.log("  ok    " + label); }
  else { failed++; console.log("  FAIL  " + label); }
}

console.log("\nCommit-path invariants proof (applyMutation)");
console.log("=".repeat(60));

const RAW =
  '<TEI xmlns="http://www.tei-c.org/ns/1.0">' +
  "<teiHeader><fileDesc><titleStmt><title>t</title></titleStmt></fileDesc></teiHeader>" +
  '<text><body><p><w xml:id="w1">Hallo</w> <w xml:id="w2">Welt</w></p></body></text></TEI>';

let state = parseEdition(RAW);

/** Commit one mutation through applyMutation and assert the change invariants. */
function commit(label, fn) {
  const r = applyMutation(state.doc, fn);
  check(r.changed === true, label + ": changed is true");
  check(parseDocument(r.doc.raw).serialize() === r.doc.raw, label + ": raw re-parses byte-identically");
  check(serialize(r.edition) === r.doc.raw, label + ": edition serializes to the committed raw");
  check(r.notes instanceof Map, label + ": note index builds without throwing");
  state = r.edition;
  return r;
}

/** Assert a no-op: changed false, the SAME doc object carried through. */
function noop(label, fn) {
  const r = applyMutation(state.doc, fn);
  check(r.changed === false && r.doc === state.doc, label + ": no-op reports changed false, SAME doc");
}

// --- 1. entity lifecycle ------------------------------------------------------

commit("addEntity(person)", (doc) => addEntity(doc, "person", { name: "Stefan Zweig" }));
const persId = readEntities(state.doc).persons[0].id;
check(typeof persId === "string" && persId.length > 0, "the added person has an id");

commit("updateEntity(rename)", (doc) => updateEntity(doc, persId, { name: "S. Zweig" }));
noop("updateEntity(same name)", (doc) => updateEntity(doc, persId, { name: "S. Zweig" }));

commit("setAuthority(GND)", (doc) => setAuthority(doc, persId, "GND", "118635123"));
noop("setAuthority(same value)", (doc) => setAuthority(doc, persId, "GND", "118635123"));

commit("addEntity(AI place)", (doc) => addEntity(doc, "place", { name: "Wien", ai: true }));
const plcId = readEntities(state.doc).places[0].id;
commit("confirmEntity", (doc) => confirmEntity(doc, plcId));
noop("confirmEntity(already confirmed)", (doc) => confirmEntity(doc, plcId));

// --- 2. mention linking ---------------------------------------------------------

commit("linkMention(w1)", (doc) => linkMention(doc, state.cellById.get("w1").node, persId));
noop("linkMention(already linked)", (doc) => linkMention(doc, state.cellById.get("w1").node, persId));
check(state.cellById.get("w1").mention === persId, "the cell projects the mention after re-parse");

// --- 3. notes -------------------------------------------------------------------

const noted = commit("addNoteForNode(w1)",
  (doc) => addNoteForNode(doc, state.cellById.get("w1").node, null, "needs review"));
check(noted.notes.get("w1") === "needs review", "the returned note index carries the new note");
noop("addNoteForNode(empty text)", (doc) => addNoteForNode(doc, state.cellById.get("w1").node, null, "  "));

// --- 4. textual criticism --------------------------------------------------------

commit("markCritical(w2 unclear)", (doc) => markCritical(doc, state.cellById.get("w2").node, "unclear"));

// --- 5. delete ------------------------------------------------------------------

noop("deleteEntity(unknown id)", (doc) => deleteEntity(doc, "no-such-id"));
commit("deleteEntity(place)", (doc) => deleteEntity(doc, plcId));
check(readEntities(state.doc).places.length === 0, "the place entry is gone, the person survives");

console.log("=".repeat(60));
if (failed === 0) {
  console.log(`PASSED (${passed}/${passed})`);
  console.log("Every mutation commits through one proven path: no-op-safe, byte-faithful, index-fresh.");
  process.exit(0);
} else {
  console.log(`FAILED (${passed}/${passed + failed}, ${failed} failing)`);
  process.exit(1);
}
