/**
 * Proof: the M2.5 mention projection (cell.mention) is a pure read-only layer.
 * After addEntity + linkMention, the re-parsed model exposes the linked cell's
 * entity id as cell.mention; unlinked neighbours stay null, gap cells stay null,
 * the projection never touches offsets, and the round-trip stays byte-identical.
 *
 * Run: node test/proofs/mention_projection_check.mjs   (exit 0 = all pass)
 */

import { parseEdition, serialize, rawRangeForDisplay, unescapeXmlText } from "../../docs/js/editor/edition.js";
import { parseDocument } from "../../docs/js/editor/tei-document.js";
import { addEntity, linkMention, linkMentionRange, unwrapMention, wrapRange, readEntities } from "../../docs/js/editor/standoff.js";
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

// --- 8. selection annotation: wrap a SUB-RANGE of a line (M2.8) ---------------
// The Hersch flow: select "Komotau" inside a prose line, annotate it as a
// place. The wrap is a lossless splice of exactly the selected bytes; the
// re-parsed line splits and the selected words project the mention.

let sdoc = parseEdition(LRAW).doc;
sdoc = addEntity(sdoc, "place", { name: "Komotau" });
let sstate = parseEdition(sdoc.raw);
const splc = readEntities(sstate.doc).places[0].id;
const lineCell = sstate.cells.find((c) => c.text.includes("Komotau liegt"));
const beforeRaw = sdoc.raw;
const dFrom = lineCell.text.indexOf("Komotau");
const dTo = dFrom + "Komotau".length;
const rel = rawRangeForDisplay(lineCell.rawText, dFrom, dTo);
check(rel !== null && lineCell.rawText.slice(rel[0], rel[1]) === "Komotau",
  "display range maps to the exact raw bytes of the selection");

sdoc = linkMentionRange(sstate.doc, lineCell.node, rel[0], rel[1], splc);
sstate = parseEdition(sdoc.raw);
const expected = beforeRaw.slice(0, lineCell.node.start + rel[0])
  + `<name ref="#${splc}">Komotau</name>`
  + beforeRaw.slice(lineCell.node.start + rel[1]);
check(sdoc.raw === expected,
  "sub-range wrap is a pure insertion around the selected bytes (full reconstruction)");
check(cellByText(sstate, "Komotau").mention === splc,
  "the selected words project the mention after the line splits");
check(cellByText(sstate, "liegt in Boehmen").mention === null,
  "the rest of the line stays unlinked");
check(parseDocument(sdoc.raw).serialize() === sdoc.raw,
  "sub-range annotated document round-trips byte-identically");
check(linkMentionRange(sstate.doc, cellByText(sstate, "Komotau").node, 0, 3, splc) === sstate.doc,
  "a sub-range inside an existing <name> is refused (SAME doc, no nesting)");

// Display->raw mapping across entity references: "&amp;" shows as 1 char.
const eraw = "vor &amp; nach";
const erel = rawRangeForDisplay(eraw, 6, 10); // display "nach" in "vor & nach"
check(erel !== null && eraw.slice(erel[0], erel[1]) === "nach"
  && unescapeXmlText(eraw).slice(6, 10) === "nach",
  "display offsets map correctly across entity references");

// --- 9. unwrapMention and generic TEI markup wraps (editor paradigm) ----------

// link -> unwrap is byte-identical to never having linked.
let udoc = parseEdition(WRAW).doc;
udoc = addEntity(udoc, "person", { name: "Stefan Zweig" });
const uBase = udoc.raw;
let ustate = parseEdition(udoc.raw);
const uid = readEntities(ustate.doc).persons[0].id;
udoc = linkMention(ustate.doc, ustate.cellById.get("w1").node, uid);
ustate = parseEdition(udoc.raw);
udoc = unwrapMention(ustate.doc, cellByText(ustate, "Zweig").node);
check(udoc.raw === uBase, "link -> unwrap restores the exact pre-link bytes");
const ustate2 = parseEdition(udoc.raw);
check(unwrapMention(ustate2.doc, ustate2.cellById.get("w1").node) === ustate2.doc,
  "unwrap outside any <name> is a no-op (SAME doc)");

// wrapRange: structured persName keeps the reading text byte-identical.
let wstate = parseEdition(LRAW);
const wcell = cellByText(wstate, "Komotau liegt in Boehmen");
const wrel = rawRangeForDisplay(wcell.rawText, 0, "Komotau liegt".length);
const structured = (inner) => inner.replace(/^([\s\S]*\S)(\s+)(\S+)$/,
  "<persName><forename>$1</forename>$2<surname>$3</surname></persName>");
const wdoc = wrapRange(wstate.doc, wcell.node, wrel[0], wrel[1], structured);
check(wdoc.raw.includes("<persName><forename>Komotau</forename> <surname>liegt</surname></persName>"),
  "wrapRange applies structured markup (forename/surname) around the selection");
check(parseDocument(wdoc.raw).serialize() === wdoc.raw,
  "markup-wrapped document round-trips byte-identically");
check(wrapRange(wstate.doc, wcell.node, wrel[0], wrel[1], () => "<persName>oops</persName>") === wstate.doc,
  "a build that loses reading text is refused (SAME doc)");

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
