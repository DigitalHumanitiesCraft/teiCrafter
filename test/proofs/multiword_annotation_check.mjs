/**
 * Proof: browser selections spanning adjacent word cells resolve to one safe,
 * namespace-faithful XML wrapper; unsafe boundaries fail before mutation.
 *
 * Run: node test/proofs/multiword_annotation_check.mjs
 */

import fs from "node:fs";
import {
  combineSelectionSegments,
  selectionSegmentFromTarget,
  selectionTargetFromRange,
} from "../../docs/js/editor/annotation-ui.js";
import {
  editCellCore,
  multiWordSelectionTarget,
  parseEdition,
  serialize,
} from "../../docs/js/editor/edition.js";
import { wrapSiblingElementRange } from "../../docs/js/editor/tei-document.js";
import { validateWithSchemas } from "../../docs/js/editor/schema-validation.js";
import { check, finish, readingText, section } from "./_assert.mjs";

const PREFIXED = `<?xml version="1.0"?>
<tei:TEI xmlns:tei="http://www.tei-c.org/ns/1.0">
  <tei:teiHeader><tei:fileDesc><tei:titleStmt><tei:title>Multiword</tei:title></tei:titleStmt><tei:publicationStmt><tei:p>Test</tei:p></tei:publicationStmt><tei:sourceDesc><tei:p>Synthetic</tei:p></tei:sourceDesc></tei:fileDesc></tei:teiHeader>
  <tei:text><tei:body>
    <tei:p><tei:w xml:id="w1">New</tei:w> <tei:w xml:id="w2">York</tei:w> <tei:w xml:id="w3">City</tei:w>.</tei:p>
    <tei:p><tei:w xml:id="w4">Next</tei:w> <tei:w xml:id="w5">line</tei:w>.</tei:p>
    <tei:p><tei:w xml:id="w6">Safe</tei:w> <tei:hi><tei:w xml:id="w7">crossing</tei:w></tei:hi>.</tei:p>
  </tei:body></tei:text>
</tei:TEI>`;

function renderedSpan(cell) {
  const span = {
    nodeType: 1,
    dataset: { id: cell.id },
    textContent: cell.text,
    childNodes: [],
    closest: () => span,
  };
  const text = {
    nodeType: 3,
    textContent: cell.text,
    parentElement: span,
  };
  span.childNodes.push(text);
  return { span, text };
}

function domRange(first, startOffset, last, endOffset, text) {
  return {
    startContainer: first.text,
    startOffset,
    endContainer: last.text,
    endOffset,
    toString: () => text,
  };
}

section("browser-near selection target");

const state = parseEdition(PREFIXED);
const w1 = renderedSpan(state.cellById.get("w1"));
const w2 = renderedSpan(state.cellById.get("w2"));
const target = selectionTargetFromRange(
  state,
  domRange(w1, 0, w2, w2.text.textContent.length, "New York"),
  0,
);
check("two complete adjacent DOM word cells resolve as one multi-word target",
  target.ok && target.kind === "multi-word" && target.cellIds.join(",") === "w1,w2");
check("the resolved target carries the operator's displayed selection text", target.text === "New York");

const single = selectionTargetFromRange(
  state,
  domRange(w1, 1, w1, 3, "ew"),
  0,
);
check("the established single-cell path keeps its raw sub-range semantics",
  single.ok && single.kind === "single" && single.relFrom === 1 && single.relTo === 3 && single.text === "ew");

const partial = selectionTargetFromRange(
  state,
  domRange(w1, 1, w2, w2.text.textContent.length, "ew York"),
  0,
);
check("a partial first word falls back to a stand-off range",
  partial.ok && partial.kind === "stand-off" && partial.inlineDiagnostic.code === "partial-word");

const w4 = renderedSpan(state.cellById.get("w4"));
const crossLine = selectionTargetFromRange(
  state,
  domRange(w2, 0, w4, w4.text.textContent.length, "York City. page 1/2 Next"),
  0,
);
check("a cross-line browser range falls back to a stand-off range",
  crossLine.ok && crossLine.kind === "stand-off" && crossLine.inlineDiagnostic.code === "cross-line");
check("browser gutter labels cannot pollute the persisted annotation text",
  !crossLine.text.includes("page 1/2") && crossLine.text.includes("York") && crossLine.text.includes("Next"));

const nextSingle = selectionTargetFromRange(
  state,
  domRange(w4, 0, w4, w4.text.textContent.length, "Next"),
  0,
);
const firstSegment = selectionSegmentFromTarget(state, single);
const secondSegment = selectionSegmentFromTarget(state, nextSingle);
const discontinuous = combineSelectionSegments([secondSegment, firstSegment]);
check("separately selected segments combine in source order as one stand-off target",
  discontinuous.ok && discontinuous.kind === "stand-off"
    && discontinuous.segments.length === 2
    && discontinuous.segmentTexts.join("|") === "ew|Next");
check("a duplicate or overlapping collected segment fails closed",
  !combineSelectionSegments([firstSegment, firstSegment]).ok);

const w6 = renderedSpan(state.cellById.get("w6"));
const w7 = renderedSpan(state.cellById.get("w7"));
const crossing = selectionTargetFromRange(
  state,
  domRange(w6, 0, w7, w7.text.textContent.length, "Safe crossing"),
  0,
);
check("words under different structural parents fall back to a stand-off range",
  crossing.ok && crossing.kind === "stand-off" && crossing.inlineDiagnostic.code === "structural-crossing");

section("byte- and namespace-faithful wrapper");

const beforeReading = readingText(PREFIXED);
const linked = wrapSiblingElementRange(state.doc, target.elements, (inner) =>
  '<name ref="#place-new-york">' + inner + "</name>");
check("one prefixed <name> wraps both complete <w> elements and their separator",
  linked.raw.includes('<tei:name ref="#place-new-york"><tei:w xml:id="w1">New</tei:w> <tei:w xml:id="w2">York</tei:w></tei:name>'));
check("the wrapper changes no reading text", readingText(linked.raw) === beforeReading);
check("the source outside the selected sibling range stays byte-identical",
  linked.raw === PREFIXED.replace(
    '<tei:w xml:id="w1">New</tei:w> <tei:w xml:id="w2">York</tei:w>',
    '<tei:name ref="#place-new-york"><tei:w xml:id="w1">New</tei:w> <tei:w xml:id="w2">York</tei:w></tei:name>',
  ));

const reparsed = parseEdition(linked.raw);
check("the multi-word mention projects onto both word cells",
  reparsed.cellById.get("w1").mention === "place-new-york"
    && reparsed.cellById.get("w2").mention === "place-new-york");
const edited = editCellCore(reparsed, "w3", "Town");
check("a later cell edit preserves the multi-word wrapper and canonical serialization",
  edited.raw.includes("</tei:name> <tei:w xml:id=\"w3\">Town</tei:w>")
    && serialize(edited) === edited.doc.raw);

const markupState = parseEdition(PREFIXED);
const markupTarget = multiWordSelectionTarget(markupState, {
  startCellId: "w1", endCellId: "w2", startOffset: 0, endOffset: 4, folioIndex: 0, text: "New York",
});
const marked = wrapSiblingElementRange(markupState.doc, markupTarget.elements, (inner) =>
  '<persName cert="high">' + inner + "</persName>");
check("generic TEI markup inherits the source prefix and keeps attributes",
  marked.raw.includes('<tei:persName cert="high"><tei:w xml:id="w1">New</tei:w> <tei:w xml:id="w2">York</tei:w></tei:persName>'));
check("a builder that splits or replaces the source range is a SAME-doc no-op",
  wrapSiblingElementRange(markupState.doc, markupTarget.elements, () => "<persName>New York</persName>") === markupState.doc);

const schema = fs.readFileSync("docs/schemas/tei-p5-4.11.0/tei_all.rng", "utf8");
const validation = await validateWithSchemas(linked.raw, [{ name: "tei_all.rng", type: "relaxng", text: schema }]);
check("the multi-word <name>/<w> structure validates against vendored TEI All",
  validation[0].status === "valid");

finish("PASS: adjacent word-cell selections wrap inline; cross-structure and discontinuous ranges resolve stand-off safely.");
