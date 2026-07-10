/**
 * Proof: per-construct confirm / reject for AI-proposed constructs
 * (proposal-review.js), the human gate generalised beyond entity mentions.
 *
 *   - confirm drops the @resp marker, keeping the construct and the reading text;
 *   - reject unwraps a reading-text wrapper (entity/markup/criticism) so the text
 *     is restored byte-for-byte (the exact inverse of the wrap), removes a standOff
 *     <note>, and removes a <gap/>;
 *   - the AI guard refuses to touch human-authored markup;
 *   - every step re-parses byte-identically.
 *
 * Run: node test/proofs/proposal_review_check.mjs   (exit 0 = all pass)
 */

import { parseDocument, elementsByLocal, getAttr } from "../../docs/js/editor/tei-document.js";
import { parseEdition } from "../../docs/js/editor/edition.js";
import { parseSuggestions } from "../../docs/js/editor/ai-suggest.js";
import { applyProposals } from "../../docs/js/editor/proposal-apply.js";
import { markCritical } from "../../docs/js/editor/criticism.js";
import { confirmConstruct, rejectConstruct } from "../../docs/js/editor/proposal-review.js";
import { AI_RESP } from "../../docs/js/editor/standoff.js";

let passed = 0, failed = 0;
function check(cond, label) {
  if (cond) { passed++; console.log("  ok    " + label); }
  else { failed++; console.log("  FAIL  " + label); }
}
const reparses = (doc) => parseDocument(doc.raw).serialize() === doc.raw;

console.log("\nPer-construct confirm/reject proof (proposal-review.js)");
console.log("=".repeat(66));

// A line with several annotatable spans; line-level (no <w>), one cell to start.
const SRC =
  '<TEI><teiHeader><fileDesc><titleStmt><title>T</title></titleStmt></fileDesc></teiHeader><text><body>\n' +
  "<p><lb/>Wien 1879. Sehr geehrter Herr Schuchardt und Freund.</p>\n" +
  "</body></text></TEI>";

const proposals = parseSuggestions(JSON.stringify([
  { kind: "entity", type: "person", name: "Hugo Schuchardt", span: "Schuchardt" },
  { kind: "markup", element: "date", attributes: { when: "1879" }, span: "1879" },
  { kind: "criticism", critKind: "unclear", span: "Sehr" },
  { kind: "note", text: "Honorific address.", span: "Herr" },
]));
const applied = applyProposals(parseEdition(SRC), proposals);
check(applied.applied.length === 4, "all four proposals applied to the source");
const base = applied.raw;

// --- helpers ----------------------------------------------------------------
// The construct element of the AI layer over the cell whose trimmed text is `t`.
function layerEl(raw, t, localName) {
  const st = parseEdition(raw);
  const cell = st.cells.find((c) => c.text.trim() === t);
  const layer = cell && (cell.layers || []).find((l) => l.localName === localName && l.resp === AI_RESP);
  return layer ? layer.el : null;
}
// The AI-marked <note> element (lives in standOff, not a reading cell).
function aiNoteEl(raw) {
  const doc = parseDocument(raw);
  return elementsByLocal(doc.root, "note").find((n) => getAttr(n, "resp") === AI_RESP) || null;
}

// --- 1. confirm drops @resp, keeps the construct and the reading text ---------
{
  const el = layerEl(base, "Schuchardt", "persName");
  check(!!el, "the proposed persName projects as an AI layer");
  const doc = confirmConstruct(parseDocument(base), el);
  check(doc.raw.includes("<persName>Schuchardt</persName>"), "confirm keeps the persName, drops @resp");
  check(!doc.raw.includes("<persName resp"), "no resp-marked persName remains");
  check(reparses(doc), "confirm re-parses byte-identically");
  check(doc.raw.includes('<date when="1879" resp="#ai">'), "the date proposal is untouched (confirm is per-construct)");
}

// --- 2. reject unwraps a markup wrap, restoring the span byte-for-byte --------
{
  const el = layerEl(base, "1879", "date");
  check(!!el, "the proposed date projects as an AI layer");
  const doc = rejectConstruct(parseDocument(base), el);
  check(!doc.raw.includes("<date"), "reject removes the <date> wrapper");
  check(doc.raw.includes("Wien 1879. "), "the reading text 1879 is restored in place");
  check(reparses(doc), "reject re-parses byte-identically");
  check(doc.raw.includes('<persName resp="#ai">Schuchardt</persName>'), "the other proposals are untouched");
}

// --- 3. reject is the EXACT inverse of apply for each wrap kind ---------------
{
  const one = parseSuggestions(JSON.stringify([{ kind: "entity", type: "person", name: "X", span: "Schuchardt" }]));
  const laden = applyProposals(parseEdition(SRC), one).raw;
  check(laden !== SRC, "entity: the single proposal changed the source");
  const back = rejectConstruct(parseDocument(laden), layerEl(laden, "Schuchardt", "persName"));
  check(back.raw === SRC, "entity: reject restores the source byte-for-byte (exact inverse of apply)");
}
{
  const one = parseSuggestions(JSON.stringify([{ kind: "criticism", critKind: "unclear", span: "Sehr" }]));
  const laden = applyProposals(parseEdition(SRC), one).raw;
  check(laden !== SRC, "criticism: the single proposal changed the source");
  const back = rejectConstruct(parseDocument(laden), layerEl(laden, "Sehr", "unclear"));
  check(back.raw === SRC, "criticism: reject restores the source byte-for-byte (exact inverse of apply)");
}

// --- 4. note: confirm keeps it, reject removes it; reading text never moves ---
{
  const noteConfirm = confirmConstruct(parseDocument(base), aiNoteEl(base));
  check(/<note target="#[^"]+">Honorific address\.<\/note>/.test(noteConfirm.raw), "confirm keeps the note, drops @resp");
  check(reparses(noteConfirm), "note confirm re-parses byte-identically");

  const noteReject = rejectConstruct(parseDocument(base), aiNoteEl(base));
  check(!noteReject.raw.includes("Honorific address."), "reject removes the note and its body");
  check(!noteReject.raw.includes("<note "), "no note element remains");
  check(reparses(noteReject), "note reject re-parses byte-identically");
  const readBefore = parseEdition(base).cells.map((c) => c.text).join("");
  const readAfter = parseEdition(noteReject.raw).cells.map((c) => c.text).join("");
  check(readBefore === readAfter, "removing the standOff note leaves the reading text unchanged");
}

// --- 5. gap: confirm drops @resp, reject removes the marker -------------------
{
  const gsrc = "<TEI><text><body><p><lb/>verbum</p></body></text></TEI>";
  const st = parseEdition(gsrc);
  const cell = st.cells.find((c) => c.text.trim() === "verbum");
  const gapDoc = markCritical(st.doc, cell.node, "gap", { resp: AI_RESP });
  check(gapDoc.raw.includes('<gap resp="#ai"/>'), "a proposed gap carries the AI marker");

  const gEl = parseEdition(gapDoc.raw).cells.find((c) => c.gap).layers[0].el;
  const conf = confirmConstruct(gapDoc, gEl);
  check(conf.raw.includes("<gap/>") && !conf.raw.includes("<gap resp"), "gap confirm drops @resp");
  check(reparses(conf), "gap confirm re-parses byte-identically");

  const gEl2 = parseEdition(gapDoc.raw).cells.find((c) => c.gap).layers[0].el;
  const rej = rejectConstruct(gapDoc, gEl2);
  check(!rej.raw.includes("<gap"), "gap reject removes the marker");
  check(reparses(rej), "gap reject re-parses byte-identically");
}

// --- 6. the AI guard protects human markup -----------------------------------
{
  const human = '<TEI><text><body><p><lb/>am <date when="1879">1879</date> heute</p></body></text></TEI>';
  const hst = parseEdition(human);
  const dEl = hst.cells.find((c) => c.text.trim() === "1879").layers.find((l) => l.localName === "date").el;
  check(confirmConstruct(hst.doc, dEl) === hst.doc, "confirm is a no-op on human markup (no #ai)");
  check(rejectConstruct(hst.doc, dEl) === hst.doc, "reject refuses human markup (no #ai), same doc");
  check(rejectConstruct(hst.doc, dEl, { resp: null }) !== hst.doc, "an explicit resp:null override does act");
}

// --- 7. no-op safety ---------------------------------------------------------
{
  const doc = parseDocument(base);
  check(confirmConstruct(doc, null) === doc, "confirm on a null element is a no-op");
  check(rejectConstruct(doc, null) === doc, "reject on a null element is a no-op");
}

console.log("=".repeat(66));
if (failed === 0) {
  console.log(`PASSED (${passed}/${passed})`);
  console.log("AI-proposed constructs of any kind confirm (drop @resp) or reject (remove) losslessly.");
  process.exit(0);
} else {
  console.log(`FAILED (${passed}/${passed + failed}, ${failed} failing)`);
  process.exit(1);
}
