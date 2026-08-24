import fs from "node:fs";
import { annotationPageSummary } from "../../docs/js/editor/annotation-progress.js";
import { parseEdition } from "../../docs/js/editor/edition.js";
import {
  readReviewRecords,
  reviewRecordForAnchor,
  setReviewRecord,
} from "../../docs/js/editor/review-record.js";
import {
  REVIEW_TOKEN,
  reviewPageSummary,
  setFolioReviewed,
} from "../../docs/js/editor/review-progress.js";
import {
  firstTeiByLocal,
  getXmlId,
  parseDocument,
  teiElementsByLocal,
} from "../../docs/js/editor/tei-document.js";
import {
  schemaSources,
  validateWithSchemas,
} from "../../docs/js/editor/schema-validation.js";
import { check, finish, section } from "./_assert.mjs";

const HEADER = `<teiHeader><fileDesc><titleStmt><title>Review proof</title></titleStmt><publicationStmt><p>Test</p></publicationStmt><sourceDesc><p>Test</p></sourceDesc></fileDesc></teiHeader>`;
const wrap = (body, header = HEADER) => `<TEI xmlns="http://www.tei-c.org/ns/1.0">${header}<text><body>${body}</body></text></TEI>`;
const DETAILS = {
  who: "https://example.org/reviewers/chris",
  when: "2026-08-24T10:30:00Z",
  rationale: "Compared with the source image.",
};

section("Standard editorial review records");

const raw = wrap(`<pb n="1" ana="#source-reviewed"/><p>one</p><pb n="2"/><p>two</p>`);
const state = parseEdition(raw);
const initial = reviewPageSummary(state);
check("markup and review are separate states", initial.reviewedPages === 0 && initial.totalPages === 2);
check("pages backed by TEI anchors are markable", initial.pages.every((page) => page.markable));

const reviewed = setFolioReviewed(state, 0, true, DETAILS);
const reviewedSummary = reviewPageSummary(reviewed);
const reviewedAnchor = reviewed.folios[0].pb;
const record = reviewRecordForAnchor(reviewed.doc, reviewedAnchor);
check("reviewing creates a stable xml:id on an unanchored unit",
  getXmlId(reviewedAnchor) === "teicrafter-review-pb-1");
check("reviewing writes a TEI revisionDesc/change record",
  reviewed.doc.raw.includes(`<change type="review" subtype="verified" target="#teicrafter-review-pb-1" who="${DETAILS.who}" when="${DETAILS.when}">${DETAILS.rationale}</change>`));
check("the record exposes reviewer, timestamp, rationale and target",
  record?.who === DETAILS.who && record.when === DETAILS.when
    && record.rationale === DETAILS.rationale && record.targetIds[0] === getXmlId(reviewedAnchor));
check("the summary reports the reviewed page", reviewedSummary.reviewedPages === 1);
check("standard review writes do not add a legacy ana marker", !reviewed.doc.raw.includes(REVIEW_TOKEN));
check("pre-existing ana data is preserved", reviewed.doc.raw.includes('ana="#source-reviewed"'));
check("review state does not inflate semantic-markup coverage",
  annotationPageSummary(reviewed).annotatedPages === annotationPageSummary(state).annotatedPages);
const again = setFolioReviewed(reviewed, 0, true, DETAILS);
check("setting the same review information is a SAME-state no-op", again === reviewed);

const cleared = setFolioReviewed(reviewed, 0, false);
check("clearing removes the review record", readReviewRecords(cleared.doc).length === 0);
check("clearing preserves the stable unit anchor and unrelated ana data",
  cleared.doc.raw.includes('xml:id="teicrafter-review-pb-1"')
    && cleared.doc.raw.includes('ana="#source-reviewed"'));
check("an empty generated revisionDesc is removed", !cleared.doc.raw.includes("revisionDesc"));
check("clearing is idempotent", setFolioReviewed(cleared, 0, false) === cleared);

section("Legacy fallback and non-destructive migration");

const legacy = parseEdition(wrap(`<pb n="1" ana="#source-reviewed ${REVIEW_TOKEN}"/><p>legacy</p>`));
check("a legacy ana token remains readable", reviewPageSummary(legacy).reviewedPages === 1);
const migrated = setFolioReviewed(legacy, 0, true, DETAILS);
check("setting a legacy review also creates the standard record", readReviewRecords(migrated.doc).length === 1);
check("migration retains the legacy marker", migrated.doc.raw.includes(REVIEW_TOKEN));
const reopened = setFolioReviewed(migrated, 0, false);
check("explicit clear removes both standard and legacy review state",
  reviewPageSummary(reopened).reviewedPages === 0 && !reopened.doc.raw.includes(REVIEW_TOKEN));
check("legacy clear preserves every unrelated ana token", reopened.doc.raw.includes('ana="#source-reviewed"'));

section("Source-independent review units");

const dictionary = parseEdition(wrap(`<entry><form><orth>Wort</orth></form><sense><def>Definition</def></sense></entry>`));
const reviewedEntry = setFolioReviewed(dictionary, 0, true, DETAILS);
check("dictionary-entry navigation stores review state on the entry",
  reviewedEntry.folios[0].navigationUnit.anchor.localName === "entry"
    && getXmlId(reviewedEntry.folios[0].navigationUnit.anchor).startsWith("teicrafter-review-entry-"));

const scan = parseEdition(`<TEI xmlns="http://www.tei-c.org/ns/1.0">${HEADER}<facsimile><surface><graphic url="one.jpg"/></surface><surface><graphic url="two.jpg"/></surface></facsimile></TEI>`);
const reviewedSurface = setFolioReviewed(scan, 1, true, DETAILS);
check("facsimile-only navigation stores review state on the selected surface",
  reviewPageSummary(reviewedSurface).pages[1].reviewed
    && getXmlId(reviewedSurface.folios[1].navigationUnit.anchor).startsWith("teicrafter-review-surface-"));

const corpusHeader = (title) => `<teiHeader><fileDesc><titleStmt><title>${title}</title></titleStmt><publicationStmt><p>Test</p></publicationStmt><sourceDesc><p>Test</p></sourceDesc></fileDesc></teiHeader>`;
const corpusRaw = `<teiCorpus xmlns="http://www.tei-c.org/ns/1.0">${corpusHeader("Corpus")}<TEI xml:id="member-1">${corpusHeader("One")}<text><body><pb xml:id="m1-page"/><p>one</p></body></text></TEI><TEI xml:id="member-2">${corpusHeader("Two")}<text><body><pb xml:id="m2-page"/><p>two</p></body></text></TEI></teiCorpus>`;
const corpusDoc = parseDocument(corpusRaw);
const secondMemberAnchor = teiElementsByLocal(corpusDoc.root, "pb")[1];
const reviewedMember = setReviewRecord(corpusDoc, secondMemberAnchor, DETAILS);
const memberRevision = teiElementsByLocal(reviewedMember.doc.root, "revisionDesc")[0];
let owningMember = memberRevision?.parent;
while (owningMember && owningMember.localName !== "TEI") owningMember = owningMember.parent;
check("teiCorpus review records stay in the anchored member's header",
  getXmlId(owningMember) === "member-2" && readReviewRecords(reviewedMember.doc).length === 1);

section("Prefixes, existing revision data, and shared targets");

const prefixedRaw = `<t:TEI xmlns:t="http://www.tei-c.org/ns/1.0"><t:teiHeader><t:fileDesc><t:titleStmt><t:title>Prefixed</t:title></t:titleStmt><t:publicationStmt><t:p>Test</t:p></t:publicationStmt><t:sourceDesc><t:p>Test</t:p></t:sourceDesc></t:fileDesc><t:revisionDesc><t:change type="encoding" when="2026-08-01">Existing revision</t:change></t:revisionDesc></t:teiHeader><t:text><t:body><t:pb n="A"/><t:p>text</t:p></t:body></t:text></t:TEI>`;
const prefixed = setFolioReviewed(parseEdition(prefixedRaw), 0, true, DETAILS);
check("inserted review elements retain the source TEI prefix",
  prefixed.doc.raw.includes("<t:change type=\"review\"") && !prefixed.doc.raw.includes("<change type=\"review\""));
check("unrelated revision history is byte-preserved",
  prefixed.doc.raw.includes('<t:change type="encoding" when="2026-08-01">Existing revision</t:change>'));

const sharedRaw = wrap(
  `<pb xml:id="p1"/><p>one</p><pb xml:id="p2"/><p>two</p>`,
  `<teiHeader><fileDesc><titleStmt><title>Shared</title></titleStmt><publicationStmt><p>Test</p></publicationStmt><sourceDesc><p>Test</p></sourceDesc></fileDesc><revisionDesc><listChange><change type="review" subtype="verified" target="#p1 #p1 #p2" who="${DETAILS.who}" when="${DETAILS.when}" xml:lang="en">${DETAILS.rationale}</change><change type="encoding" when="2026-08-01">Keep</change></listChange></revisionDesc></teiHeader>`,
);
const sharedState = parseEdition(sharedRaw);
const sharedNoop = setReviewRecord(sharedState.doc, sharedState.folios[0].pb, DETAILS);
check("an unchanged shared review record is idempotent", sharedNoop.doc === sharedState.doc);
const split = setReviewRecord(sharedState.doc, sharedState.folios[0].pb, {
  ...DETAILS,
  rationale: "First page checked separately.",
});
const splitRecords = readReviewRecords(split.doc);
check("editing one unit splits a shared target without changing the other unit",
  splitRecords.some((item) => item.targets.length === 1 && item.targets[0] === "#p2")
    && splitRecords.some((item) => item.targets.length === 1 && item.targets[0] === "#p1"
      && item.rationale === "First page checked separately."));
check("foreign revision entries survive shared-target edits",
  split.doc.raw.includes('<change type="encoding" when="2026-08-01">Keep</change>'));
check("unmanaged attributes survive an edited review record",
  split.doc.raw.includes('target="#p2"') && split.doc.raw.includes('xml:lang="en"'));
const splitState = parseEdition(split.doc.raw);
const firstCleared = setFolioReviewed(splitState, 0, false);
check("clearing one unit preserves the other unit's shared review",
  reviewPageSummary(firstCleared).reviewedPages === 1
    && reviewPageSummary(firstCleared).pages[1].reviewed);

section("Fail-closed anchors and TEI All validity");

const headerless = parseEdition(`<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><pb/><p>x</p></body></text></TEI>`);
check("a headerless document cannot acquire a dangling review anchor",
  setFolioReviewed(headerless, 0, true, DETAILS) === headerless
    && !reviewPageSummary(headerless).pages[0].markable);

const duplicateRaw = wrap(`<pb xml:id="duplicate"/><p>one</p><pb xml:id="duplicate"/><p>two</p>`);
const duplicate = parseEdition(duplicateRaw);
check("duplicate xml:id anchors fail closed", setFolioReviewed(duplicate, 0, true, DETAILS) === duplicate);

const foreign = parseDocument(wrap(`<pb xml:id="p1"/><p>x</p>`).replace(
  "</teiHeader>",
  `<revisionDesc><change type="review" subtype="verified" target="#p1" who="${DETAILS.who}" when="${DETAILS.when}">TEI review</change><x:change xmlns:x="urn:foreign" type="review" subtype="verified" target="#p1">Foreign</x:change></revisionDesc></teiHeader>`,
));
check("review reads are namespace-aware", readReviewRecords(foreign).length === 1);

const structuredRaw = wrap(
  `<pb xml:id="structured"/><p>x</p>`,
  `<teiHeader><fileDesc><titleStmt><title>Structured</title></titleStmt><publicationStmt><p>Test</p></publicationStmt><sourceDesc><p>Test</p></sourceDesc></fileDesc><revisionDesc><change type="review" subtype="verified" target="#structured" who="${DETAILS.who}" when="${DETAILS.when}">Checked by <name>Chris</name>.</change></revisionDesc></teiHeader>`,
);
const structuredState = parseEdition(structuredRaw);
const refusedStructuredEdit = setReviewRecord(structuredState.doc, structuredState.folios[0].pb, {
  ...DETAILS,
  rationale: "Flattened replacement",
});
check("structured review rationale fails closed instead of losing inline data",
  !refusedStructuredEdit.ok && refusedStructuredEdit.doc === structuredState.doc
    && refusedStructuredEdit.doc.raw.includes("<name>Chris</name>"));

const schemaText = fs.readFileSync("docs/schemas/tei-p5-4.11.0/tei_all.rng", "utf8");
const schema = [{ ...schemaSources(null)[0], text: schemaText }];
for (const [label, candidate] of [
  ["default-namespace record", reviewed.doc.raw],
  ["prefixed record", prefixed.doc.raw],
  ["shared listChange record", split.doc.raw],
  ["cleared record", cleared.doc.raw],
  ["dictionary-entry record", reviewedEntry.doc.raw],
  ["facsimile-surface record", reviewedSurface.doc.raw],
]) {
  const validation = await validateWithSchemas(candidate, schema);
  check(`${label} validates against vendored TEI All`, validation[0].status === "valid");
}

check("the proof exercises a real TEI root", firstTeiByLocal(reviewed.doc.root, "TEI") != null);
check("the proof retains both page anchors", teiElementsByLocal(reviewed.doc.root, "pb").length === 2);

finish("review_progress_check passed");
