/**
 * teiCrafter Editor -- Author-mode structural primitives.
 *
 * The minimal set of element-structure edits the WYSIWYG reading surface maps
 * keystrokes to: split a line element at the caret, merge two adjacent sibling
 * elements, insert an <lb/> milestone, delete an empty element. Each is ONE
 * spliceDocument over the offsets the parser already records, so the byte-faithful
 * core is untouched (only the bytes the user's edit inserts or removes change).
 * Every op returns a NEW re-parsed doc on a real change, the SAME doc on a no-op,
 * so they commit through the existing applyMutation / commitStandoff contract.
 *
 * These are constrained, document-derived acts: a split makes two of the SAME
 * element, a merge joins two of the SAME element, an insert adds the milestone the
 * document already uses. They are not free restructuring (no arbitrary new block;
 * that stays out, behind a later flag).
 */

import { spliceDocument, getAttrObj, decodeEntities } from "./tei-document.js";
import { uniquify, collectIds } from "./standoff.js";

/** The whitespace+newline that indents `el` (reused so a split line lines up). */
function leadingSep(doc, el) {
  const before = doc.raw.slice(0, el.outerStart);
  const m = before.match(/(\r?\n[ \t]*)$/);
  return m ? m[1] : "\n";
}

/** Clone `el`'s start tag, regenerating an xml:id so the new sibling stays unique. */
function cloneStartTagFreshId(doc, el) {
  let tag = doc.raw.slice(el.stagStart, el.stagEnd);
  const idAttr = getAttrObj(el, "id");
  if (idAttr) {
    const newId = uniquify(idAttr.value + "_2", collectIds(doc));
    const a = idAttr.valueStart - el.stagStart;
    const b = idAttr.valueEnd - el.stagStart;
    tag = tag.slice(0, a) + newId + tag.slice(b);
  }
  return tag;
}

/**
 * Split `el` at an absolute raw caret offset into two siblings of the same
 * element. Content before the caret stays in the original (which keeps its id);
 * content after moves into a fresh sibling (a regenerated id). No-op (SAME doc)
 * when el is self-closing or the caret is outside its content.
 */
export function splitElement(doc, el, rawCaret) {
  if (!el || el.type !== "element" || el.contentStart == null || el.contentEnd == null) return doc;
  if (rawCaret < el.contentStart || rawCaret > el.contentEnd) return doc;
  const endTag = doc.raw.slice(el.etagStart, el.etagEnd);
  const startTag = cloneStartTagFreshId(doc, el);
  return spliceDocument(doc, rawCaret, rawCaret, endTag + leadingSep(doc, el) + startTag);
}

/**
 * Merge two adjacent sibling elements of the same name: delete the first's end
 * tag, the inter-element whitespace, and the second's start tag, so the two
 * contents join inside the first element (which keeps its id; the second's id is
 * dropped). No-op unless both are non-self-closing, same-named, and ordered.
 */
export function mergeElements(doc, firstEl, secondEl) {
  if (!firstEl || !secondEl || firstEl.type !== "element" || secondEl.type !== "element") return doc;
  if (firstEl.localName !== secondEl.localName) return doc;
  if (firstEl.contentEnd == null || secondEl.contentStart == null) return doc;
  if (firstEl.outerEnd == null || secondEl.outerStart == null || firstEl.outerEnd > secondEl.outerStart) return doc;
  return spliceDocument(doc, firstEl.contentEnd, secondEl.contentStart, "");
}

/** Insert a bare <lb/> milestone at an absolute raw offset (matches the draft shape). */
export function insertLb(doc, rawOffset) {
  if (!Number.isInteger(rawOffset) || rawOffset < 0 || rawOffset > doc.raw.length) return doc;
  return spliceDocument(doc, rawOffset, rawOffset, "<lb/>");
}

/**
 * Delete an element losslessly (its whole outer span). Refuses (SAME doc) an
 * element that still carries non-whitespace reading text unless `force`, so a
 * structural delete cannot silently drop content; Phase 1 only removes empty
 * <l>/<lb/>.
 */
export function deleteElement(doc, el, { force = false } = {}) {
  if (!el || el.type !== "element" || el.outerStart == null || el.outerEnd == null) return doc;
  if (!force && el.contentStart != null && el.contentEnd != null) {
    if (decodeEntities(doc.raw.slice(el.contentStart, el.contentEnd)).trim() !== "") return doc;
  }
  return spliceDocument(doc, el.outerStart, el.outerEnd, "");
}
