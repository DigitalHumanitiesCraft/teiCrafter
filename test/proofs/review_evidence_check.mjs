import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { contentDigest } from "../../docs/js/editor/content-digest.js";
import { parseEdition, editCellCore } from "../../docs/js/editor/edition.js";
import { reviewPageSummary, setFolioReviewed } from "../../docs/js/editor/review-progress.js";
import { readReviewRecords } from "../../docs/js/editor/review-record.js";
import { EditorSession } from "../../docs/js/editor/editor-session.js";

for (const value of ["", "abc", "𐍈 &amp; e\u0301", "a".repeat(55), "a".repeat(56), "a".repeat(64), "a".repeat(1000000)]) {
  assert.equal(contentDigest(value), createHash("sha256").update(value).digest("hex"));
}
const raw = '<TEI xmlns="http://www.tei-c.org/ns/1.0"><teiHeader><fileDesc><titleStmt><title>Test</title></titleStmt><publicationStmt><p>Test</p></publicationStmt><sourceDesc><p>Test</p></sourceDesc></fileDesc></teiHeader><text><body><pb n="1"/><p>one</p><pb n="2"/><p>two</p></body></text></TEI>';
const checked = setFolioReviewed(parseEdition(raw), 0, true);
assert.equal(reviewPageSummary(checked).pages[0].status, "reviewed");
const other = editCellCore(checked, checked.cells[1].id, "different second page");
assert.equal(reviewPageSummary(other).pages[0].status, "reviewed");
const edited = editCellCore(checked, checked.cells[0].id, "different first page");
assert.equal(reviewPageSummary(edited).pages[0].status, "changed");
assert.equal(reviewPageSummary(parseEdition(edited.raw)).pages[0].reviewed, false);
assert.equal(readReviewRecords(edited.doc).length, 1);
const session = new EditorSession(parseEdition);
session.load(checked);
session.replace(edited);
session.undo();
assert.equal(reviewPageSummary(session.state).pages[0].status, "reviewed");
const rechecked = setFolioReviewed(edited, 0, true);
assert.equal(readReviewRecords(rechecked.doc).length, 2);
assert.equal(reviewPageSummary(rechecked).pages[0].status, "reviewed");
const reopened = setFolioReviewed(rechecked, 0, false);
assert.equal(readReviewRecords(reopened.doc).length, 3);
assert.equal(reviewPageSummary(reopened).pages[0].status, "reopened");
assert.equal(setFolioReviewed(reopened, 0, false), reopened);
const whole = setFolioReviewed(parseEdition(raw.replaceAll('<pb n="1"/>', '').replaceAll('<pb n="2"/>', '')), 0, true);
assert.equal(reviewPageSummary(whole).pages[0].status, "reviewed", "inserting revision history does not invalidate its own document review");
console.log("PASS: independent SHA-256 reference, review scope, history, edit/reopen and undo.");
