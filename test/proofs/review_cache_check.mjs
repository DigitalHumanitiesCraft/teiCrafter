import assert from "node:assert/strict";
import { parseEdition } from "../../docs/js/editor/edition.js";
import { EditorSession } from "../../docs/js/editor/editor-session.js";
import { editTextAndAttrs, firstTeiByLocal, parseDocument, teiElementsByLocal, walk } from "../../docs/js/editor/tei-document.js";
import {
  canStoreReviewRecord, clearReviewRecords, ensureReviewAnchor, findElementByXmlId,
  readReviewRecords, reviewRecordForAnchor, reviewStateForAnchor, setReviewRecord,
} from "../../docs/js/editor/review-record.js";
import { folioIsReviewed, reviewPageSummary, setFolioReviewed } from "../../docs/js/editor/review-progress.js";

const HEADER = '<teiHeader><fileDesc><titleStmt><title>Cache proof</title></titleStmt><publicationStmt><p>Test</p></publicationStmt><sourceDesc><p>Test</p></sourceDesc></fileDesc></teiHeader>';
const wrap = (body, revision = "") => `<TEI xmlns="http://www.tei-c.org/ns/1.0">${HEADER.replace("</teiHeader>", `${revision}</teiHeader>`)}<text><body>${body}</body></text></TEI>`;
const DETAILS = { who: "#editor", when: "2026-09-11T12:00:00Z", rationale: "Compared with the manuscript." };
const anchorOf = (state, index = 0) => state.folios[index].navigationUnit?.anchor || state.folios[index].pb;
const snapshot = (state) => reviewPageSummary(state).pages.map(({ label, reviewed, status, markable }) => ({ label, reviewed, status, markable }));

function agreesWithPreviousSummary(state) {
  const summary = reviewPageSummary(state);
  assert.equal(summary.totalPages, state.folios.length);
  let reviewedPages = 0;
  state.folios.forEach((folio, index) => {
    const anchor = anchorOf(state, index);
    const previousReviewed = folioIsReviewed(folio, state.doc);
    const previousState = anchor ? reviewStateForAnchor(state.doc, anchor) : { status: "unreviewed", record: null };
    assert.equal(summary.pages[index].reviewed, previousReviewed);
    assert.equal(summary.pages[index].reviewed, summary.pages[index].status === "reviewed");
    assert.equal(summary.pages[index].status, previousState.status);
    assert.equal(summary.pages[index].record, previousState.record);
    assert.equal(summary.pages[index].markable, Boolean(anchor && (previousReviewed || canStoreReviewRecord(state.doc, anchor).ok)));
    assert.equal(summary.pages[index].label, folio.n != null ? String(folio.n) : String(index + 1));
    if (previousReviewed) reviewedPages++;
  });
  assert.equal(summary.reviewedPages, reviewedPages);
}

const raw = wrap('<pb xml:id="page1" n="1r"/><p xml:id="p1">One &amp; ſ</p><pb xml:id="page2" n="1v"/><p xml:id="p2">Two</p>');
const original = parseEdition(raw);
assert.equal(readReviewRecords(original.doc).length, 0);
assert.equal(findElementByXmlId(original.doc, "page1"), anchorOf(original));
const reviewed = setFolioReviewed(original, 0, true, DETAILS);
const twiceReviewed = setFolioReviewed(reviewed, 1, true, DETAILS);
assert.deepEqual(snapshot(twiceReviewed).map((page) => page.status), ["reviewed", "reviewed"]);
assert.equal(readReviewRecords(original.doc).length, 0);
assert.equal(readReviewRecords(reviewed.doc).length, 1);
assert.equal(readReviewRecords(twiceReviewed.doc).length, 2);
assert.equal(original.doc.raw, raw);

const independent = parseEdition(twiceReviewed.raw);
assert.notEqual(findElementByXmlId(independent.doc, "page1"), findElementByXmlId(twiceReviewed.doc, "page1"));
assert.notEqual(readReviewRecords(independent.doc)[0].element, readReviewRecords(twiceReviewed.doc)[0].element);
assert.deepEqual(snapshot(independent), snapshot(twiceReviewed));
const returned = readReviewRecords(twiceReviewed.doc);
returned.pop();
assert.equal(readReviewRecords(twiceReviewed.doc).length, 2, "caller-owned result arrays do not alter the record cache");
const protectedRecord = readReviewRecords(twiceReviewed.doc)[0];
assert.throws(() => { protectedRecord.status = "reopened"; }, TypeError);
for (const key of ["targets", "targetIds", "whoTokens"]) assert.throws(() => { protectedRecord[key].push("#injected"); }, TypeError);
assert.deepEqual(snapshot(twiceReviewed).map((page) => page.status), ["reviewed", "reviewed"], "returned records cannot poison subsequent status checks");
assert.deepEqual(readReviewRecords(null), []);
assert.deepEqual(readReviewRecords(undefined), []);
assert.equal(readReviewRecords(twiceReviewed.doc, { status: "reopened" }).length, 0);
assert.equal(readReviewRecords(twiceReviewed.doc, { status: "verified" }).length, 2);

const changedDoc = editTextAndAttrs(twiceReviewed.doc, findElementByXmlId(twiceReviewed.doc, "p1"), { text: "Changed 🕮" });
const changed = parseEdition(changedDoc.raw);
assert.deepEqual(snapshot(changed).map((page) => page.status), ["changed", "reviewed"]);
assert.deepEqual(snapshot(twiceReviewed).map((page) => page.status), ["reviewed", "reviewed"]);
assert.equal(reviewRecordForAnchor(changed.doc, anchorOf(twiceReviewed)), null, "anchors from the old document are rejected after a rewrite");
assert.equal(reviewStateForAnchor(changed.doc, anchorOf(twiceReviewed)).status, "unreviewed");
assert.equal(ensureReviewAnchor(changed.doc, anchorOf(twiceReviewed)).ok, false);
assert.equal(clearReviewRecords(changed.doc, anchorOf(twiceReviewed)).ok, false);
assert.equal(setReviewRecord(changed.doc, anchorOf(twiceReviewed), DETAILS).doc, changed.doc);
const staleState = { ...changed, folios: twiceReviewed.folios };
assert.ok(snapshot(staleState).every((page) => page.status === "unreviewed" && !page.markable));

const rechecked = setFolioReviewed(changed, 0, true, DETAILS);
const reopened = setFolioReviewed(rechecked, 1, false, DETAILS);
assert.deepEqual(snapshot(reopened).map((page) => page.status), ["reviewed", "reopened"]);
assert.equal(readReviewRecords(reopened.doc).length, 4);
assert.equal(readReviewRecords(reopened.doc, { status: "verified" }).length, 3);
assert.equal(readReviewRecords(reopened.doc, { status: "reopened" }).length, 1);
const cleared = clearReviewRecords(reopened.doc, anchorOf(reopened, 1));
assert.equal(cleared.ok, true);
assert.equal(readReviewRecords(cleared.doc, { status: "verified" }).length, 2);
assert.equal(readReviewRecords(reopened.doc, { status: "verified" }).length, 3);
assert.equal(reviewStateForAnchor(cleared.doc, findElementByXmlId(cleared.doc, "page2")).status, "reopened");

const session = new EditorSession(parseEdition);
session.load(twiceReviewed);
session.replace(changed);
session.replace(rechecked);
session.replace(reopened);
assert.deepEqual(snapshot(session.state), snapshot(reopened));
session.undo();
assert.deepEqual(snapshot(session.state), snapshot(rechecked));
session.undo();
assert.deepEqual(snapshot(session.state), snapshot(changed));
session.undo();
assert.deepEqual(snapshot(session.state), snapshot(twiceReviewed));
session.redo();
assert.deepEqual(snapshot(session.state), snapshot(changed));

const historical = parseEdition(wrap('<pb xml:id="page1" n="1r"/><p>Historical</p>', '<revisionDesc><change type="review" subtype="verified" target="#page1" who="#editor" when="2026-01-01">Historical evidence</change></revisionDesc>'));
assert.equal(snapshot(historical)[0].status, "historical");
const noAnchor = { doc: original.doc, folios: [{ n: null }] };
assert.deepEqual(snapshot(noAnchor), [{ label: "1", reviewed: false, status: "unreviewed", markable: false }]);
const noHeader = parseEdition('<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><pb xml:id="page1"/><p>x</p></body></text></TEI>');
assert.equal(snapshot(noHeader)[0].markable, false);

for (const repetitions of [2, 3, 4]) {
  const duplicate = parseDocument(wrap(`<pb xml:id="duplicate"/><p>One</p>${'<x:unit xmlns:x="urn:foreign" xml:id="duplicate"/>'.repeat(repetitions - 1)}`));
  const anchor = firstTeiByLocal(duplicate.root, "pb");
  assert.equal(findElementByXmlId(duplicate, "duplicate"), null, `${repetitions} duplicate IDs remain ambiguous`);
  assert.equal(ensureReviewAnchor(duplicate, anchor).ok, false);
  assert.equal(setReviewRecord(duplicate, anchor, DETAILS).doc, duplicate);
  assert.equal(canStoreReviewRecord(duplicate, anchor).ok, false);
  agreesWithPreviousSummary({ doc: duplicate, folios: [{ n: "ambiguous", pb: anchor }] });
}

const foreignDoc = parseDocument(wrap('<x:pb xmlns:x="urn:foreign" xml:id="foreign"/><pb xml:id="__proto__"/><p>x</p>'));
const foreignAnchor = findElementByXmlId(foreignDoc, "foreign");
assert.ok(foreignAnchor, "global ID lookup retains foreign IDs for ambiguity checks");
assert.equal(ensureReviewAnchor(foreignDoc, foreignAnchor).ok, false);
assert.equal(findElementByXmlId(foreignDoc, "__proto__").localName, "pb");
const copiedAnchor = { ...findElementByXmlId(foreignDoc, "__proto__") };
assert.equal(ensureReviewAnchor(foreignDoc, copiedAnchor).ok, false, "copying source offsets and parent pointers does not establish membership");
agreesWithPreviousSummary({ doc: foreignDoc, folios: [{ pb: foreignAnchor }] });

const mixedRevision = parseDocument(wrap('<pb xml:id="page1"/><p>x</p>', '<revisionDesc><change type="review" subtype="verified" target="#page1">TEI</change><x:change xmlns:x="urn:foreign" type="review" subtype="verified" target="#page1">Foreign</x:change><change xmlns:x="urn:foreign" x:type="review" target="#page1">Foreign type</change><change type="encoding">Keep</change></revisionDesc>'));
assert.deepEqual(readReviewRecords(mixedRevision).map((record) => record.rationale), ["TEI"]);
assert.equal(readReviewRecords(mixedRevision, { status: "verified" }).length, 1);
assert.equal(readReviewRecords(mixedRevision, { status: "reopened" }).length, 0);

const corpus = parseDocument(`<teiCorpus xmlns="http://www.tei-c.org/ns/1.0">${HEADER}<TEI xml:id="member1">${HEADER}<text><body><pb xml:id="Äpfel"/><p>First</p></body></text></TEI><TEI xml:id="member2">${HEADER}<text><body><pb xml:id="constructor"/><p>Second</p></body></text></TEI></teiCorpus>`);
assert.equal(readReviewRecords(corpus).length, 0);
const member2 = setReviewRecord(corpus, findElementByXmlId(corpus, "constructor"), DETAILS);
const bothMembers = setReviewRecord(member2.doc, findElementByXmlId(member2.doc, "Äpfel"), DETAILS);
assert.equal(readReviewRecords(member2.doc).length, 1);
assert.deepEqual(readReviewRecords(bothMembers.doc).map((record) => record.targetIds), [["Äpfel"], ["constructor"]], "record inventory retains document order across member headers");
assert.equal(readReviewRecords(corpus).length, 0);
assert.equal(teiElementsByLocal(bothMembers.doc.root, "revisionDesc").length, 2);

const nodeSet = new Set();
walk(bothMembers.doc.root, (node) => nodeSet.add(node));
for (const record of readReviewRecords(bothMembers.doc)) assert.ok(nodeSet.has(record.element));
for (const state of [original, reviewed, twiceReviewed, independent, changed, staleState, rechecked, reopened, historical, noAnchor, noHeader]) agreesWithPreviousSummary(state);
assert.deepEqual(reviewPageSummary(null), { totalPages: 0, reviewedPages: 0, pages: [] });
console.log("PASS: review cache isolation, duplicate and foreign IDs, stale membership, status equivalence, rewrite and undo/redo.");
