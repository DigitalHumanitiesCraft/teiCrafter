/**
 * Proof: generic attribute editing on the engine is lossless and no-op-safe.
 *   - addAttr inserts directly after the element name; every other byte is
 *     untouched, values are escaped, self-closing tags work;
 *   - presence is checked by EXACT qname (xml:id and id stay distinct) and an
 *     invalid name or an existing attribute is a SAME-doc no-op;
 *   - editAttrValue changes only the value slice; add then removeAttr restores
 *     the original bytes; a multi-step sequence re-parses byte-identically at
 *     every step;
 *   - attrTargetForCell resolves the element the attribute editor targets:
 *     the <w> itself at word level, the innermost inline wrapper or <l> at
 *     line level, none for container-level text and gap cells.
 *
 * Run: node test/tools/attr_edit_check.mjs   (exit 0 = all pass)
 */

import {
  parseDocument, elementsByLocal, getAttrObj,
  addAttr, editAttrValue, removeAttr, hasAttrQName,
} from "../../docs/js/editor/tei-document.js";
import { parseEdition, attrTargetForCell } from "../../docs/js/editor/edition.js";

let passed = 0, failed = 0;
function check(cond, label) {
  if (cond) { passed++; console.log("  ok    " + label); }
  else { failed++; console.log("  FAIL  " + label); }
}

console.log("\nAttribute editing proof (addAttr / editAttrValue / removeAttr / attrTargetForCell)");
console.log("=".repeat(60));

const TEI = (body) =>
  '<TEI xmlns="http://www.tei-c.org/ns/1.0">' +
  "<teiHeader><fileDesc><titleStmt><title>t</title></titleStmt></fileDesc></teiHeader>" +
  "<text><body>" + body + "</body></text></TEI>";

// --- 1. add at the exact position, escaping ------------------------------------

const RAW1 = TEI('<p><w xml:id="w1">Hallo</w> <w xml:id="w2">Welt</w></p>');
const doc = parseDocument(RAW1);
const w1 = elementsByLocal(doc.root, "w")[0];

const added = addAttr(doc, w1, "lemma", "hallo");
check(added !== doc && added.raw === RAW1.replace('<w xml:id="w1">', '<w lemma="hallo" xml:id="w1">'),
  "addAttr inserts directly after the element name; every other byte identical");
check(parseDocument(added.raw).serialize() === added.raw, "the result re-parses byte-identically");

const escaped = addAttr(doc, w1, "n", 'a&b<c"d');
check(escaped.raw.includes('n="a&amp;b&lt;c&quot;d"'), "the value is escaped by the engine's attribute rules");

// --- 2. no-ops: existing exact qname, invalid names ----------------------------

check(addAttr(doc, w1, "xml:id", "x") === doc, "adding an existing exact qname is a SAME-doc no-op");
for (const bad of ["1abc", "a b", "a:b:c", ""]) {
  check(addAttr(doc, w1, bad, "v") === doc, `an invalid name is a SAME-doc no-op ("${bad}")`);
}

// --- 3. xml:id and id are distinct attributes -----------------------------------

const withId = addAttr(doc, w1, "id", "plain");
check(withId !== doc && withId.raw.includes('<w id="plain" xml:id="w1">'),
  "adding @id next to @xml:id succeeds (exact-qname check, not localName)");
const w1b = elementsByLocal(withId.root, "w")[0];
check(hasAttrQName(w1b, "id") && hasAttrQName(w1b, "xml:id"), "hasAttrQName sees both exact names");
check(addAttr(withId, w1b, "id", "again") === withId, "re-adding @id is a no-op");
check(addAttr(withId, w1b, "xml:id", "again") === withId, "re-adding @xml:id is a no-op");

// --- 4. editAttrValue touches only the value slice ------------------------------

const idAttr = getAttrObj(w1, "id"); // localName match: this is the xml:id attribute
const edited = editAttrValue(doc, idAttr, "w1new");
check(edited.raw === RAW1.replace('xml:id="w1"', 'xml:id="w1new"'),
  "editAttrValue changes exactly the value slice");

// --- 5. add then remove restores the original byte-identically ------------------

const again = elementsByLocal(added.root, "w")[0];
check(removeAttr(added, again, "lemma").raw === RAW1, "add then removeAttr restores the original bytes");

// --- 6. a multi-step sequence stays consistent -----------------------------------

let cur = parseDocument(RAW1);
const step = (fn, label) => {
  cur = fn(cur);
  check(parseDocument(cur.raw).serialize() === cur.raw, label + ": re-parses byte-identically");
};
step((d) => addAttr(d, elementsByLocal(d.root, "w")[0], "lemma", "hallo"), "step add @lemma");
step((d) => editAttrValue(d, getAttrObj(elementsByLocal(d.root, "w")[0], "lemma"), "neu"), "step edit @lemma");
step((d) => addAttr(d, elementsByLocal(d.root, "w")[1], "type", "noun"), "step add @type on w2");
step((d) => removeAttr(d, elementsByLocal(d.root, "w")[0], "lemma"), "step remove @lemma");
check(cur.raw === RAW1.replace('<w xml:id="w2">', '<w type="noun" xml:id="w2">'),
  "after the sequence only the intended @type on w2 remains");

// --- 7. self-closing start tag ----------------------------------------------------

const RAW2 = TEI('<p><lb n="1"/>Zeile eins</p>');
const doc2 = parseDocument(RAW2);
const lbDoc = addAttr(doc2, elementsByLocal(doc2.root, "lb")[0], "facs", "#z1");
check(lbDoc.raw.includes('<lb facs="#z1" n="1"/>'), "a self-closing tag gets the attribute after the name");

// --- 8. attrTargetForCell ----------------------------------------------------------

const wstate = parseEdition(RAW1);
check(attrTargetForCell(wstate.cellById.get("w1")).localName === "w",
  "word level: the target is the <w> itself");

const lstate = parseEdition(TEI('<p>\n<lb n="1"/>Zeile eins\n</p>'));
const lcell = lstate.cells.find((c) => c.text.trim() === "Zeile eins");
check(!!lcell && attrTargetForCell(lcell) === null,
  "line level, text directly in <p>: no target (container boundary)");

const vstate = parseEdition(TEI('<l n="1">Vers eins</l>'));
const vcell = vstate.cells.find((c) => c.text.trim() === "Vers eins");
check(!!vcell && attrTargetForCell(vcell).localName === "l", "verse: the target is the <l>");

const hstate = parseEdition(TEI('<p>\n<lb n="1"/>see <hi rend="i">this</hi> word\n</p>'));
const hcell = hstate.cells.find((c) => c.text.trim() === "this");
check(!!hcell && attrTargetForCell(hcell).localName === "hi", "an inline wrapper is the innermost target");

const gstate = parseEdition(TEI('<p><lb n="1"/>text <gap/> more</p>'));
const gcell = gstate.cells.find((c) => c.gap);
check(!!gcell && attrTargetForCell(gcell) === null, "gap cells have no target in v1");

console.log("=".repeat(60));
if (failed === 0) {
  console.log(`PASSED (${passed}/${passed})`);
  console.log("Attribute edits are exact splices: no-op-safe, escaped, reversible, correctly targeted.");
  process.exit(0);
} else {
  console.log(`FAILED (${passed}/${passed + failed}, ${failed} failing)`);
  process.exit(1);
}
