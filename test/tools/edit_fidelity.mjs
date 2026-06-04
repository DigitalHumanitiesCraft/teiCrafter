/**
 * Proof: edits stay byte-faithful on TEI that carries character/entity references,
 * and the standOff index degrades gracefully on header-less input.
 *
 * Guards two confirmed regressions:
 *  - Entity asymmetry: escapeText/escapeAttr used to re-escape an existing
 *    &nbsp;/&#233;/&quot;/&apos; (a no-op edit corrupted unrelated markup, e.g.
 *    &nbsp; -> &amp;nbsp;). A no-op must return a byte-identical document, and a
 *    real edit must not corrupt a neighbouring entity in the same node.
 *  - addEntity used to throw an uncaught TypeError on TEI lacking a teiHeader.
 *
 * Run: node test/tools/edit_fidelity.mjs   (exit 0 = all pass)
 */

import { parseEdition, editCell, serialize, xmlIdSet } from "../../docs/js/editor/edition.js";
import { parseDocument, editAttrValue, firstByLocal } from "../../docs/js/editor/tei-document.js";
import { addEntity, readEntities, linkMention } from "../../docs/js/editor/standoff.js";

const cellByText = (state, t) => state.cells.find((c) => c.text === t);

let passed = 0, failed = 0;
function check(cond, label) {
  if (cond) { passed++; console.log("  ok    " + label); }
  else { failed++; console.log("  FAIL  " + label); }
}

console.log("\nEdit-fidelity proof");
console.log("=".repeat(60));

// --- 1. Entity round-trip through the editable cell path --------------------

const RAW =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<TEI xmlns="http://www.tei-c.org/ns/1.0">\n' +
  "<teiHeader><fileDesc><titleStmt><title>t</title></titleStmt></fileDesc></teiHeader>\n" +
  "<text><body>\n" +
  '<p><w xml:id="w1">Hallo&nbsp;Welt</w> <w xml:id="w2">caf&#233;</w> ' +
  '<w xml:id="w3">a&quot;b</w> <w xml:id="w4">A&amp;B</w> <w xml:id="w5">x&apos;y</w></p>\n' +
  "</body></text>\n</TEI>";

const state0 = parseEdition(RAW);

// A no-op edit (re-submitting the cell's own text) on every cell must be a true
// byte-identical no-op, even though the decoded cell text differs from the raw.
let allNoop = true;
for (const cell of state0.cells) {
  const next = editCell(state0, cell.id, cell.text);
  if (serialize(next) !== RAW) {
    allNoop = false;
    console.log("        diverged on cell " + cell.id + ": " + JSON.stringify(serialize(next).slice(0, 120)));
  }
}
check(allNoop, "no-op editCell on entity-bearing cells is byte-identical (all cells)");

// A real edit on w1 must change only that word and leave the &nbsp; intact.
const w1 = state0.cellById.get("w1");
const edited = editCell(state0, "w1", "Hallo!" + w1.text.slice("Hallo".length)); // "Hallo!&nbsp;Welt"
const expected = RAW.replace(">Hallo&nbsp;Welt<", ">Hallo!&nbsp;Welt<");
check(serialize(edited) === expected, "real edit on w1 preserves the neighbouring &nbsp;");
check(!serialize(edited).includes("&amp;nbsp;"), "no &amp;nbsp; corruption introduced");
check(serialize(state0) === RAW, "the original state is left untouched (immutability)");

// --- 2. Entity round-trip through the attribute path ------------------------

const ATTR_RAW = '<x a="p &gt; q" b="caf&#233;" c="&nbsp;" d="o&apos;clock"/>';
const adoc = parseDocument(ATTR_RAW);
const x = firstByLocal(adoc.root, "x");
let attrNoop = true;
for (const attr of x.attrs) {
  const next = editAttrValue(adoc, attr, attr.value); // attr.value is the decoded value
  if (next.serialize() !== ATTR_RAW) {
    attrNoop = false;
    console.log("        attr " + attr.name + " diverged: " + JSON.stringify(next.serialize()));
  }
}
check(attrNoop, "no-op editAttrValue on entity-bearing attributes is byte-identical");

// A genuine attribute change still escapes a bare '&' the user introduces.
const aAttr = x.attrs.find((p) => p.name === "a");
const changed = editAttrValue(adoc, aAttr, "Tom & Jerry");
check(changed.serialize().includes('a="Tom &amp; Jerry"'), "bare & in a new attribute value is escaped");

// --- 3. standOff add on header-less and element-free input ------------------

const NOHEADER = '<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p>hi</p></body></text></TEI>';
let threw = false, out = null;
try {
  out = addEntity(parseDocument(NOHEADER), "person", { id: "p1", name: "Anna" });
} catch (e) {
  threw = true;
  console.log("        addEntity threw: " + e.message);
}
check(!threw, "addEntity does not throw on TEI without a teiHeader");
check(out != null && out.raw.includes("<standOff>"), "a standOff was scaffolded");
check(out != null && out.raw.includes("<text>") && out.raw.indexOf("<standOff>") < out.raw.indexOf("<text>"),
  "the standOff was inserted before <text>");
check(out != null && out.raw.includes("<body><p>hi</p></body>"), "the original body bytes are untouched");
check(out != null && parseDocument(out.raw).serialize() === out.raw, "the result re-parses byte-identically");
if (out) {
  const persons = readEntities(out).persons;
  check(persons.length === 1 && persons[0].name === "Anna", "the new person is readable (name 'Anna')");
}

// Element-free input cannot be anchored: return it unchanged rather than crash.
let threw2 = false, out2 = null;
try { out2 = addEntity(parseDocument("   "), "person", { name: "X" }); }
catch (e) { threw2 = true; }
check(!threw2 && out2 != null && out2.raw === "   ", "element-free input returns unchanged (no crash)");

// --- 4. relink an already-linked mention retargets @ref, never nests --------

const LINKED =
  '<TEI xmlns="http://www.tei-c.org/ns/1.0">' +
  "<teiHeader><fileDesc><titleStmt><title>t</title></titleStmt></fileDesc></teiHeader>" +
  '<text><body><p>Hello <name ref="#pers_1">Anna</name> there</p></body></text></TEI>';
const lstate = parseEdition(LINKED);
const annaCell = cellByText(lstate, "Anna");
check(!!annaCell, "the mention text 'Anna' is an editable cell inside <name>");

// Relinking to the SAME entity is a byte-identical no-op.
const sameLink = linkMention(lstate.doc, annaCell.node, "pers_1");
check(sameLink === lstate.doc, "relink to the same entity is a no-op (same doc)");

// Relinking to a DIFFERENT entity mutates @ref in place; no second <name>.
const relinked = linkMention(lstate.doc, annaCell.node, "pers_2");
const nameTagCount = (relinked.raw.match(/<name\b/g) || []).length;
check(relinked.raw.includes('<name ref="#pers_2">Anna</name>'), "relink retargets @ref to #pers_2");
check(nameTagCount === 1, "exactly one <name> remains (no nested <name>)");
check(parseDocument(relinked.raw).serialize() === relinked.raw, "the relinked document re-parses byte-identically");

// --- 5. integrity baseline tracks real xml:ids, not synthetic cell ids ------

const NOIDS =
  '<TEI xmlns="http://www.tei-c.org/ns/1.0">' +
  "<teiHeader><fileDesc><titleStmt><title>t</title></titleStmt></fileDesc></teiHeader>" +
  "<text><body><p><lb/>line one<lb/>line two</p></body></text></TEI>";
const istate = parseEdition(NOIDS);
const before = xmlIdSet(istate);
const c1 = cellByText(istate, "line two");
const emptied = editCell(istate, c1.id, ""); // a lossless edit that drops a cell
const after = xmlIdSet(emptied);
// The real-xml:id set is stable (both empty): no false "id lost"/"id added".
check(before.size === 0 && after.size === 0, "id-less edition has an empty, stable xml:id baseline");
const missing = [...before].filter((id) => !after.has(id));
const added = [...after].filter((id) => !before.has(id));
check(missing.length === 0 && added.length === 0, "emptying a line raises no false structural-loss alarm");
// Contrast: the old synthetic-cell-id approach WOULD have flagged a loss.
const cellIdsBefore = new Set(istate.cells.map((c) => c.id));
const cellIdsAfter = new Set(emptied.cells.map((c) => c.id));
const cellChurn = [...cellIdsBefore].some((id) => !cellIdsAfter.has(id));
check(cellChurn, "(control) synthetic cell ids do churn, which is why the fix avoids them");

// --- summary ----------------------------------------------------------------

console.log("=".repeat(60));
if (failed === 0) {
  console.log(`PASSED (${passed}/${passed})`);
  console.log("Edits are byte-faithful over entities; standOff add degrades gracefully.");
  process.exit(0);
} else {
  console.log(`FAILED (${passed}/${passed + failed}, ${failed} failing)`);
  process.exit(1);
}
