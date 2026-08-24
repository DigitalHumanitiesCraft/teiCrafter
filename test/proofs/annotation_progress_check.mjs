import assert from "node:assert/strict";

import { parseEdition } from "../../docs/js/editor/edition.js";
import { annotationPageSummary } from "../../docs/js/editor/annotation-progress.js";
import { noteIndex } from "../../docs/js/editor/standoff.js";
import { addSpanAnnotation } from "../../docs/js/editor/span-annotations.js";

const raw = `<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <teiHeader><fileDesc><titleStmt><title>Header title</title></titleStmt><publicationStmt><p>x</p></publicationStmt><sourceDesc><p>x</p></sourceDesc></fileDesc></teiHeader>
  <text><body>
    <pb n="1"/><p>plain<lb/>text</p>
    <pb n="2"/><p><persName ref="#p1">Ada</persName> in <date when="1843">1843</date></p>
    <pb n="3"/><p xml:id="l3">noted</p>
  </body></text>
  <standOff><listPerson><person xml:id="p1"><persName>Ada</persName></person></listPerson><note target="#l3">review</note></standOff>
</TEI>`;

const state = parseEdition(raw);
const summary = annotationPageSummary(state, noteIndex(state.doc));

assert.equal(summary.totalPages, 3);
assert.equal(summary.annotatedPages, 2);
assert.equal(summary.pages[0].count, 0, "header markup does not leak into page 1");
assert.equal(summary.pages[1].count, 2);
assert.deepEqual([...summary.pages[1].kinds].sort(), ["entities", "markup"]);
assert.equal(summary.pages[2].count, 1);
assert.deepEqual([...summary.pages[2].kinds], ["notes"]);
assert.equal(summary.totalAnnotations, 3);

const empty = parseEdition(`<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><pb/><p>plain</p></body></text></TEI>`);
assert.equal(annotationPageSummary(empty).annotatedPages, 0);

const namespaceRaw = `<TEI xmlns="http://www.tei-c.org/ns/1.0" xmlns:x="urn:foreign">
  <text><body>
    <pb n="1"/><p><x:persName ref="#p1" x:resp="#ai">Foreign</x:persName><w x:ref="#p1" x:resp="#ai">shadow</w></p>
    <pb n="2"/><p><persName ref="#p1" resp="#ai">Ada</persName><w ref="#p1">linked by attribute</w></p>
  </body></text>
  <standOff><listPerson><person xml:id="p1"><persName>Ada</persName></person></listPerson></standOff>
</TEI>`;
const namespaceSummary = annotationPageSummary(parseEdition(namespaceRaw));
assert.equal(namespaceSummary.pages[0].count, 0,
  "foreign equal-local-name elements and namespaced attributes do not count");
assert.equal(namespaceSummary.pages[0].ai, false,
  "a foreign @resp does not mark a page as AI-annotated");
assert.equal(namespaceSummary.pages[1].count, 2,
  "TEI elements and unqualified TEI annotation attributes still count");
assert.deepEqual([...namespaceSummary.pages[1].kinds].sort(), ["entities", "markup"]);
assert.equal(namespaceSummary.pages[1].ai, true);

const spanBase = parseEdition(`<TEI xmlns="http://www.tei-c.org/ns/1.0"><teiHeader><fileDesc><titleStmt><title>S</title></titleStmt><publicationStmt><p>P</p></publicationStmt><sourceDesc><p>S</p></sourceDesc></fileDesc></teiHeader><text><body><pb n="1"/><p>Alpha</p><pb n="2"/><p>Beta</p></body></text></TEI>`);
const alpha = spanBase.cells.find((cell) => cell.text === "Alpha");
const beta = spanBase.cells.find((cell) => cell.text === "Beta");
const spanned = addSpanAnnotation(spanBase.doc, [{ start: alpha.start, end: beta.end }], {
  type: "entity",
  ana: "#person-1",
});
const spanSummary = annotationPageSummary(parseEdition(spanned.raw));
assert.equal(spanSummary.annotatedPages, 2, "a cross-page stand-off span marks every covered page");
assert.deepEqual(spanSummary.pages.map((page) => [...page.kinds]), [["entities"], ["entities"]]);

console.log("annotation progress: page scope, namespace isolation, standOff notes and spans PASS");
