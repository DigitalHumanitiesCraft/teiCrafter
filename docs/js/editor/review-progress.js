import {
  editAttrValue,
  getAttrObjInNamespace,
  getUnqualifiedAttr,
  spliceDocument,
} from "./tei-document.js";
import { parseEdition } from "./edition.js?v=20260824-ui4";
import {
  canStoreReviewRecord,
  clearReviewRecords,
  findElementByXmlId,
  reviewRecordForAnchor,
  setReviewRecord,
} from "./review-record.js";

export const REVIEW_TOKEN = "#teicrafter-reviewed";

function anaTokens(element) {
  return new Set(String(getUnqualifiedAttr(element, "ana") || "").split(/\s+/).filter(Boolean));
}

function reviewAnchor(folio) {
  return folio?.navigationUnit?.anchor || folio?.pb || null;
}

function legacyIsReviewed(anchor) {
  return Boolean(anchor && anaTokens(anchor).has(REVIEW_TOKEN));
}

export function folioIsReviewed(folio, doc = null) {
  const anchor = reviewAnchor(folio);
  return Boolean(anchor && (
    (doc && reviewRecordForAnchor(doc, anchor)) || legacyIsReviewed(anchor)
  ));
}

export function reviewPageSummary(state) {
  const pages = (state && state.folios || []).map((folio, index) => ({
    index,
    label: folio.n != null ? String(folio.n) : String(index + 1),
    reviewed: folioIsReviewed(folio, state.doc),
    markable: Boolean(reviewAnchor(folio) && (
      folioIsReviewed(folio, state.doc) || canStoreReviewRecord(state.doc, reviewAnchor(folio)).ok
    )),
  }));
  return {
    totalPages: pages.length,
    reviewedPages: pages.filter((page) => page.reviewed).length,
    pages,
  };
}

function removeLegacyToken(doc, anchor) {
  const attr = getAttrObjInNamespace(anchor, null, "ana");
  if (!attr || !anaTokens(anchor).has(REVIEW_TOKEN)) return doc;
  const raw = attr.rawValue;
  let next = raw.replace(new RegExp(`^${REVIEW_TOKEN}(?:\\s+|$)`), "");
  if (next === raw) next = raw.replace(new RegExp(`\\s+${REVIEW_TOKEN}(?=\\s|$)`), "");
  if (next === raw) {
    const tokens = [...anaTokens(anchor)].filter((token) => token !== REVIEW_TOKEN);
    return editAttrValue(doc, attr, tokens.join(" "));
  }
  if (!next) {
    let start = attr.start;
    if (start > 0 && /\s/.test(doc.raw[start - 1])) start -= 1;
    return spliceDocument(doc, start, attr.end, "");
  }
  return spliceDocument(doc, attr.valueStart, attr.valueEnd, next);
}

export function setFolioReviewed(state, folioIndex, reviewed, options = {}) {
  const folio = state && state.folios && state.folios[folioIndex];
  const anchor = reviewAnchor(folio);
  if (!folio || !anchor) return state;

  if (reviewed) {
    const stored = setReviewRecord(state.doc, anchor, {
      hint: folio.n != null ? String(folio.n) : String(folioIndex + 1),
      ...options,
    });
    return stored.doc === state.doc ? state : parseEdition(stored.doc.raw);
  }

  const cleared = clearReviewRecords(state.doc, anchor, options);
  if (!cleared.ok) return state;
  let nextDocument = cleared.doc;
  const nextAnchor = cleared.anchorId
    ? findElementByXmlId(nextDocument, cleared.anchorId)
    : anchor;
  if (nextAnchor) nextDocument = removeLegacyToken(nextDocument, nextAnchor);
  return nextDocument === state.doc ? state : parseEdition(nextDocument.raw);
}
