import { readFileSync } from "node:fs";
import { parseEdition } from "../../docs/js/editor/edition.js";
import {
  firstTeiByLocal,
  parseDocument,
  teiElementsByLocal,
  textNodes,
} from "../../docs/js/editor/tei-document.js";
import {
  addSpanAnnotation,
  readSpanAnnotations,
  relinkSpanAnnotation,
  removeSpanAnnotation,
} from "../../docs/js/editor/span-annotations.js";
import { resolvedSpanGroups } from "../../docs/js/editor/span-projection.js";
import { findMentions } from "../../docs/js/editor/standoff.js";
import { validateWithSchemas } from "../../docs/js/editor/schema-validation.js";
import { check, finish, section } from "./_assert.mjs";

section("Continuous, cross-structure and discontinuous stand-off spans");

const raw = `<TEI xmlns="http://www.tei-c.org/ns/1.0"><teiHeader><fileDesc><titleStmt><title>T</title></titleStmt><publicationStmt><p>P</p></publicationStmt><sourceDesc><p>S</p></sourceDesc></fileDesc></teiHeader><text><body><pb n="1"/><p>Alpha beta.</p><pb n="2"/><p>Gamma delta.</p></body></text></TEI>`;
const doc = parseDocument(raw);
const body = firstTeiByLocal(doc.root, "body");
const texts = textNodes(body).filter((node) => doc.raw.slice(node.start, node.end).trim());
const first = texts.find((node) => doc.raw.slice(node.start, node.end).includes("Alpha"));
const second = texts.find((node) => doc.raw.slice(node.start, node.end).includes("Gamma"));

const crossPage = addSpanAnnotation(doc, [{
  start: first.start + 6,
  end: second.start + 5,
}], { type: "topic", ana: "#theme-1" });
check("a cross-page selection keeps every original text byte", parseEdition(crossPage.raw).cells.map((cell) => cell.text).join("").includes("Alpha beta.Gamma delta."));
check("cross-page boundaries become zero-width TEI anchors", (crossPage.raw.match(/<anchor\b/g) || []).length === 2);
check("one span records the cross-page range", readSpanAnnotations(crossPage)[0].spans.length === 1
  && readSpanAnnotations(crossPage)[0].spans[0].ana === "#theme-1");

const discontinuous = addSpanAnnotation(doc, [
  { start: first.start, end: first.start + 5 },
  { start: second.start, end: second.start + 5 },
], { type: "entity", ana: "#same-entity" });
check("one annotation group can carry disjoint ranges", readSpanAnnotations(discontinuous)[0].spans.length === 2);
check("four stable anchors delimit two disjoint ranges", (discontinuous.raw.match(/<anchor\b/g) || []).length === 4);
const projected = parseEdition(discontinuous.raw);
check("disjoint entity spans project onto every covered reading segment",
  projected.cells.filter((cell) => cell.mention === "same-entity")
    .map((cell) => cell.text.trim()).join(",") === "Alpha,Gamma");
check("projected span layers retain their stand-off identity",
  projected.cells.filter((cell) => cell.mention === "same-entity")
    .every((cell) => cell.layers.some((layer) => layer.standOff && layer.standOffGroupId)));
check("resolved span groups expose exact anchor intervals", resolvedSpanGroups(discontinuous)[0].ranges.length === 2);
check("entity mention discovery includes every discontinuous span range", findMentions(discontinuous, "same-entity").length === 2);
const groupId = readSpanAnnotations(discontinuous)[0].id;
const relinked = relinkSpanAnnotation(discontinuous, groupId, "other-entity");
check("relinking updates every segment in one stand-off group",
  readSpanAnnotations(relinked)[0].spans.every((span) => span.ana === "#other-entity"));
const removed = removeSpanAnnotation(relinked, groupId);
check("removing a stand-off annotation removes its group and unused anchors while retaining text",
  readSpanAnnotations(removed).length === 0 && !(removed.raw.match(/<anchor\b/g) || []).length
    && parseEdition(removed.raw).cells.map((cell) => cell.text).join("").includes("Alpha beta.Gamma delta."));
check("adding and removing a generated stand-off annotation restores the original source bytes",
  removed.raw === raw);
const sharedAnchorId = readSpanAnnotations(discontinuous)[0].spans[0].from.slice(1);
const sharedAnchor = parseDocument(discontinuous.raw.replace(
  " beta.</p>",
  ` beta.<note target="#${sharedAnchorId}">Shared boundary</note></p>`,
));
const sharedAnchorRemoved = removeSpanAnnotation(sharedAnchor, groupId);
check("removing a group preserves an anchor referenced by another TEI pointer",
  !readSpanAnnotations(sharedAnchorRemoved).length
    && sharedAnchorRemoved.raw.includes(`xml:id="${sharedAnchorId}"`)
    && sharedAnchorRemoved.raw.includes(`target="#${sharedAnchorId}"`));
const sharedGroup = parseDocument(discontinuous.raw.replace(
  " beta.</p>",
  ` beta.<note target="#${groupId}">Shared annotation</note></p>`,
));
check("removing a group that is itself referenced fails closed",
  removeSpanAnnotation(sharedGroup, groupId) === sharedGroup);

const selfClosingRaw = raw
  .replace("</teiHeader>", '</teiHeader><standOff xml:id="so1" type="scholarly"/>')
  .replace("<p>Alpha beta.</p>", '<p><note target="#so1">Container reference</note>Alpha beta.</p>');
const selfClosingDoc = parseDocument(selfClosingRaw);
const selfClosingText = textNodes(firstTeiByLocal(selfClosingDoc.root, "body"))
  .find((node) => selfClosingDoc.raw.slice(node.start, node.end).includes("Alpha"));
const selfClosingMarked = addSpanAnnotation(selfClosingDoc, [{
  start: selfClosingText.start,
  end: selfClosingText.start + 5,
}], { type: "topic" });
const selfClosingGroupId = readSpanAnnotations(selfClosingMarked)[0].id;
check("removing a span restores a pre-existing self-closing standOff with attributes byte-for-byte",
  removeSpanAnnotation(selfClosingMarked, selfClosingGroupId).raw === selfClosingRaw);
const selfClosingMarkedState = parseEdition(selfClosingMarked.raw);
const gammaCell = selfClosingMarkedState.cells.find((cell) => cell.text.includes("Gamma"));
const twoGroups = addSpanAnnotation(selfClosingMarked, [{
  start: gammaCell.start,
  end: gammaCell.start + 5,
}], { type: "topic" });
const [firstGroup, secondGroup] = readSpanAnnotations(twoGroups);
const removedFirst = removeSpanAnnotation(twoGroups, firstGroup.id);
const removedSecond = removeSpanAnnotation(removedFirst, secondGroup.id);
check("self-closing parent restoration is independent of group removal order",
  removedSecond.raw === selfClosingRaw);
check("overlapping ranges fail closed", addSpanAnnotation(doc, [
  { start: first.start, end: first.start + 7 },
  { start: first.start + 3, end: first.start + 9 },
]) === doc);

const prefixedRaw = raw.replace(/<(\/?)(?!\?)([A-Za-z][\w.-]*)/g, "<$1tei:$2")
  .replace('xmlns="http://www.tei-c.org/ns/1.0"', 'xmlns:tei="http://www.tei-c.org/ns/1.0"');
const prefixed = parseDocument(prefixedRaw);
const prefixedText = textNodes(firstTeiByLocal(prefixed.root, "body"))
  .find((node) => prefixed.raw.slice(node.start, node.end).includes("Alpha"));
const markedPrefixed = addSpanAnnotation(prefixed, [{ start: prefixedText.start, end: prefixedText.start + 5 }]);
check("prefixed TEI keeps prefix-faithful anchors and span records", markedPrefixed.raw.includes("<tei:anchor")
  && markedPrefixed.raw.includes("<tei:spanGrp") && markedPrefixed.raw.includes("<tei:span "));

const nestedStandOffRaw = raw.replace("<teiHeader>", "<teiHeader><encodingDesc><standOff><list/></standOff></encodingDesc>");
const nestedStandOffDoc = parseDocument(nestedStandOffRaw);
const nestedText = textNodes(firstTeiByLocal(nestedStandOffDoc.root, "body"))
  .find((node) => nestedStandOffDoc.raw.slice(node.start, node.end).includes("Alpha"));
const nestedMarked = addSpanAnnotation(nestedStandOffDoc, [{ start: nestedText.start, end: nestedText.start + 5 }]);
const nestedGroup = teiElementsByLocal(nestedMarked.root, "spanGrp")[0];
check("span groups are stored in the TEI-level standOff even when a header standOff exists",
  nestedGroup?.parent?.parent?.localName === "TEI");

const schema = readFileSync("docs/schemas/tei-p5-4.11.0/tei_all.rng", "utf8");
for (const [label, candidate] of [
  ["cross-page", crossPage],
  ["discontinuous", discontinuous],
  ["removed", removed],
  ["shared-anchor removal", sharedAnchorRemoved],
  ["prefixed", markedPrefixed],
]) {
  const result = await validateWithSchemas(candidate.raw, [{ name: "tei_all.rng", type: "relaxng", text: schema }]);
  check(`${label} span output validates against TEI All`, result.every((item) => item.status === "valid"));
}

finish("span_annotations_check passed");
