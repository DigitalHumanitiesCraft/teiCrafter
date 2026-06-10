/**
 * Proof: the M2.5 mention projection (cell.mention) is a pure read-only layer.
 * After addEntity + linkMention, the re-parsed model exposes the linked cell's
 * entity id as cell.mention; unlinked neighbours stay null, gap cells stay null,
 * the projection never touches offsets, and the round-trip stays byte-identical.
 *
 * Run: node test/tools/mention_projection_check.mjs   (exit 0 = all pass)
 */

import { parseEdition, serialize } from "../../docs/js/editor/edition.js";
import { parseDocument } from "../../docs/js/editor/tei-document.js";
import { addEntity, linkMention, readEntities } from "../../docs/js/editor/standoff.js";
import { markCritical } from "../../docs/js/editor/criticism.js";

let passed = 0, failed = 0;
function check(cond, label) {
  if (cond) { passed++; console.log("  ok    " + label); }
  else { failed++; console.log("  FAIL  " + label); }
}
const cellByText = (state, t) => state.cells.find((c) => c.text.trim() === t);

console.log("\nMention projection proof (M2.5)");
console.log("=".repeat(60));

const HEADER =
  "<teiHeader><fileDesc><titleStmt><title>t</title></titleStmt></fileDesc></teiHeader>";

// --- 1. word-level: link one word, neighbours stay null ----------------------

const WRAW =
  '<TEI xmlns="http://www.tei-c.org/ns/1.0">' + HEADER +
  '<text><body><p><w xml:id="w1">Zweig</w> <w xml:id="w2">schreibt</w> <w xml:id="w3">heute</w></p></body></text></TEI>';
let state = parseEdition(WRAW);
check(state.cells.every((c) => c.mention === null), "before linking: every cell.mention is null");

let doc = addEntity(state.doc, "person", { name: "Stefan Zweig" });
state = parseEdition(doc.raw);
const persId = readEntities(state.doc).persons[0].id;
doc = linkMention(state.doc, state.cellById.get("w1").node, persId);
state = parseEdition(doc.raw);

check(cellByText(state, "Zweig").mention === persId,
  `linked cell projects mention === "${persId}"`);
check(cellByText(state, "schreibt").mention === null && cellByText(state, "heute").mention === null,
  "unlinked neighbour cells stay mention === null");
check(serialize(state) === doc.raw && parseDocument(doc.raw).serialize() === doc.raw,
  "round-trip after link stays byte-identical (projection is read-only)");

// --- 2. the projection changes no offsets ------------------------------------

const linked = cellByText(state, "Zweig");
check(typeof linked.start === "number" && typeof linked.end === "number"
  && doc.raw.slice(linked.start, linked.end) === "Zweig",
  "linked cell offsets still address the exact reading text");

// --- 3. line-level: the projection works without <w> wrappers ----------------

const LRAW =
  '<TEI xmlns="http://www.tei-c.org/ns/1.0">' + HEADER +
  '<text><body>\n<pb n="1"/>\n<p>\n  <lb n="1"/>Komotau liegt in Boehmen\n  <lb n="2"/>zweite Zeile\n</p>\n</body></text></TEI>';
let lstate = parseEdition(LRAW);
let ldoc = addEntity(lstate.doc, "place", { name: "Komotau" });
lstate = parseEdition(ldoc.raw);
const plcId = readEntities(lstate.doc).places[0].id;
ldoc = linkMention(lstate.doc, cellByText(lstate, "Komotau liegt in Boehmen").node, plcId);
lstate = parseEdition(ldoc.raw);
check(cellByText(lstate, "Komotau liegt in Boehmen").mention === plcId,
  "line-level cell projects the place mention");
check(cellByText(lstate, "zweite Zeile").mention === null,
  "the other line stays mention === null");
check(parseDocument(ldoc.raw).serialize() === ldoc.raw,
  "line-level round-trip stays byte-identical");

// --- 4. a gap cell projects mention === null ----------------------------------

const GRAW =
  '<TEI xmlns="http://www.tei-c.org/ns/1.0">' + HEADER +
  '<text><body><p><lb n="1"/>vor <gap reason="illegible"/> nach</p></body></text></TEI>';
const gstate = parseEdition(GRAW);
const gapCell = gstate.cells.find((c) => c.gap);
check(!!gapCell && gapCell.mention === null, "gap cell projects mention === null");

// --- 5. a dangling ref still projects (renderer falls back generically) ------

const DRAW =
  '<TEI xmlns="http://www.tei-c.org/ns/1.0">' + HEADER +
  '<text><body><p><w xml:id="w1"><name ref="#pers_missing">Hersch</name></w></p></body></text></TEI>';
const dstate = parseEdition(DRAW);
check(cellByText(dstate, "Hersch").mention === "pers_missing",
  "a mention with no index entry still projects its id (dangling ref visible)");
check(parseDocument(DRAW).serialize() === DRAW, "dangling-ref document round-trips byte-identically");

// --- 6. a <name> in a non-reading context does not leak ----------------------

const NRAW =
  '<TEI xmlns="http://www.tei-c.org/ns/1.0">' +
  '<teiHeader><fileDesc><titleStmt><title><name ref="#x">N</name></title></titleStmt></fileDesc></teiHeader>' +
  "<text><body><p>nur text</p></body></text></TEI>";
const nstate = parseEdition(NRAW);
check(nstate.cells.length === 1 && nstate.cells[0].mention === null,
  "header <name> never reaches the reading cells");

// --- 7. relinking a critically-wrapped mention retargets, never nests ---------
// Projection (mentionRef) and mutation (linkMention) must agree on "already
// linked": after link -> mark unclear -> relink, the document carries ONE
// <name> whose @ref points at the new entity (no nested conflicting refs).

let rdoc = parseEdition(WRAW).doc;
rdoc = addEntity(rdoc, "person", { name: "Stefan Zweig" });
rdoc = addEntity(rdoc, "person", { name: "Arnold Zweig" });
let rstate = parseEdition(rdoc.raw);
const [persA, persB] = readEntities(rstate.doc).persons.map((p) => p.id);
rdoc = linkMention(rstate.doc, rstate.cellById.get("w1").node, persA);
rstate = parseEdition(rdoc.raw);
rdoc = markCritical(rstate.doc, cellByText(rstate, "Zweig").node, "unclear");
rstate = parseEdition(rdoc.raw);
check(cellByText(rstate, "Zweig").mention === persA,
  "projection sees the link through the critical wrapper");

rdoc = linkMention(rstate.doc, cellByText(rstate, "Zweig").node, persB);
rstate = parseEdition(rdoc.raw);
const bodyRaw = rdoc.raw.slice(rdoc.raw.indexOf("<body>"), rdoc.raw.indexOf("</body>"));
check((bodyRaw.match(/<name\b/g) || []).length === 1,
  "relink through the wrapper keeps exactly one <name> (no nesting)");
check(bodyRaw.includes(`ref="#${persB}"`) && !bodyRaw.includes(`ref="#${persA}"`),
  "the single <name> now points at the new entity only");
check(cellByText(rstate, "Zweig").mention === persB,
  "projection follows the retargeted ref");
check(parseDocument(rdoc.raw).serialize() === rdoc.raw,
  "retargeted document round-trips byte-identically");
check(linkMention(rstate.doc, cellByText(rstate, "Zweig").node, persB) === rstate.doc,
  "relinking to the same entity through the wrapper is a no-op (SAME doc)");

// --- summary -----------------------------------------------------------------

console.log("=".repeat(60));
if (failed === 0) {
  console.log(`PASSED (${passed}/${passed})`);
  console.log("cell.mention is a pure, byte-neutral read projection.");
  process.exit(0);
} else {
  console.log(`FAILED (${passed}/${passed + failed}, ${failed} failing)`);
  process.exit(1);
}
