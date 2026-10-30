import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDocument } from "../../src/core/tei-document.js";
import { importTs } from "../validate/load-ts.mjs";

const { buildOutline, unitAt } = await importTs("src/core/outline.ts");
const { ENTITY_BY_KIND, entityOf, idIndex, summaryOf } = await importTs("src/core/element-facts.ts");
const { wellFormedReason } = await importTs("src/core/well-formed.ts");

const RAW = `<?xml version="1.0"?>
<t:TEI xmlns:t="http://www.tei-c.org/ns/1.0" xml:id="doc1">
  <t:teiHeader><t:fileDesc><t:titleStmt><t:title>A   letter</t:title></t:titleStmt></t:fileDesc></t:teiHeader>
  <t:text><t:body>
    <t:div type="letter" n="1"><t:head>To  the editor</t:head>
      <t:pb n="1r"/><t:p>First <t:name ref="#p1">Anna</t:name> page.</t:p>
      <t:pb n="1v"/><t:p>Second <t:rs type="place">page</t:rs>.</t:p>
    </t:div>
    <t:div type="appendix"><t:p>x</t:p></t:div>
  </t:body></t:text>
  <t:standOff><t:listPerson><t:person xml:id="p1"/></t:listPerson></t:standOff>
  <foreign:div xmlns:foreign="urn:x"/>
</t:TEI>`;

const doc = parseDocument(RAW);
const outline = buildOutline(doc);
const shape = (u) => [u.name, u.label, ...(u.children.length ? [u.children.map(shape)] : [])];

test("the outline lists the root's header, text structure and pages with source labels", () => {
  assert.deepEqual(shape(outline), ["#document", "Document", [
    ["t:teiHeader", "", [["t:fileDesc", "", [["t:titleStmt", ""]]]]],
    ["t:text", "", [["t:body", "", [
      ["t:div", "To the editor", [["pb", "page 1r"], ["pb", "page 1v"]]],
      ["t:div", "appendix"],
    ]]]],
    ["t:standOff", ""],
    ["foreign:div", ""],
  ]]);
});

test("a page runs to the next page break or the end of its parent's content", () => {
  const div = outline.children[1].children[0].children[0];
  const [first, second] = div.children;
  assert.equal(RAW.slice(first.start, first.end).trimEnd(), '<t:pb n="1r"/><t:p>First <t:name ref="#p1">Anna</t:name> page.</t:p>');
  assert.equal(second.end, RAW.indexOf("</t:div>"));
  assert.equal(unitAt(outline, RAW.indexOf("Second")), second);
  assert.equal(unitAt(outline, 0), outline);
});

test("entity classes come from the element name, @type or the referenced element", () => {
  const ids = idIndex(doc.root);
  assert.equal(ENTITY_BY_KIND.person, "persName");
  assert.equal(entityOf(find(doc.root, "name"), ids), "persName", "name/@ref points at a person");
  assert.equal(entityOf(find(doc.root, "rs"), ids), "placeName", "rs/@type place");
  assert.equal(entityOf(find(doc.root, "name"), new Map()), null, "an unresolved @ref gives no class");
  assert.equal(entityOf(find(doc.root, "head"), ids), null);
  const other = parseDocument('<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p><persName>B</persName></p></body></text></TEI>');
  assert.equal(entityOf(find(other.root, "persName"), new Map()), "persName");
});

test("summaries prefer the header title, then text, then inner element names", () => {
  assert.equal(summaryOf(doc, find(doc.root, "teiHeader")), "A letter");
  assert.equal(summaryOf(doc, find(doc.root, "head")), "To the editor");
  assert.equal(summaryOf(doc, find(doc.root, "standOff")), "t:listPerson, t:person");
});

test("the well-formedness reason drops each browser's framing text", () => {
  assert.equal(wellFormedReason("This page contains the following errors:error on line 3 at column 5: Opening and ending tag mismatch: a line 1 and b Below is a rendering of the page up to the first error."), "Opening and ending tag mismatch: a line 1 and b");
  assert.equal(wellFormedReason("XML Parsing Error: mismatched tag. Expected: </a>. Location: http://x/ Line Number 3, Column 5:"), "mismatched tag. Expected: </a>.");
  assert.equal(wellFormedReason("unknown wording"), "unknown wording");
  assert.equal(wellFormedReason(null), null);
});

function find(root, localName) {
  let found = null;
  const go = (n) => {
    if (found) return;
    if (n.type === "element" && n.localName === localName) { found = n; return; }
    for (const c of n.children ?? []) go(c);
  };
  go(root);
  return found;
}
