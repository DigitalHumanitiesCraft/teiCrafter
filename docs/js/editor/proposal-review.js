/**
 * teiCrafter Editor -- confirm / reject AI-proposed constructs (DOM-free, pure).
 *
 * The human gate for the general proposal layer (proposal-apply.js): every model
 * construct is inserted carrying a @resp marker (default "#ai") and rendered violet.
 * This resolves one, for ANY construct kind, not only entity mentions:
 *   - confirmConstruct drops the @resp marker, so the construct stays as ordinary,
 *     human-accepted markup; every byte of reading text is untouched.
 *   - rejectConstruct removes the construct. A reading-text wrapper (an entity name
 *     wrap, a markup wrap, an <unclear>/<del>/<add>) is unwrapped, restoring the
 *     surrounded reading text verbatim, so reject is the exact inverse of the wrap.
 *     A standOff <note> is removed with its body; a self-closing <gap/> is removed
 *     in place (a gap's replaced text is gone by TEI design, not recoverable from
 *     the gap alone).
 *
 * Both act on the construct ELEMENT the cell.layers projection already surfaces
 * (layer.el, or the gap cell's single layer), reuse the generic engine ops only,
 * and a no-op returns the SAME doc, so the round-trip stays byte-identical. No new
 * engine primitive. The complement of proposal-apply.js.
 */

import { getAttr, removeAttr, spliceDocument, isReadingContext } from "./tei-document.js";
import { AI_RESP } from "./standoff.js";

/**
 * Confirm a proposed construct: drop its responsibility marker so it reads as
 * human-accepted markup, keeping the construct and all reading text. By default
 * only a construct carrying the AI marker is confirmed; opts.resp overrides the
 * expected value (null confirms whatever @resp is present). A no-op (SAME doc) when
 * el is not an element, carries no @resp, or carries a different responsibility.
 */
export function confirmConstruct(doc, el, opts = {}) {
  if (!el || el.type !== "element") return doc;
  const cur = getAttr(el, "resp");
  if (cur == null) return doc;
  const want = opts.resp === undefined ? AI_RESP : opts.resp;
  if (want != null && cur !== want) return doc;
  return removeAttr(doc, el, "resp");
}

/**
 * Reject a proposed construct: remove it. A reading-text wrapper is unwrapped (its
 * inner reading text restored verbatim, the exact inverse of the wrap); a
 * non-reading construct (a standOff <note>) is removed with the one line of
 * indentation that preceded it; a self-closing reading element (<gap/>) is removed
 * in place, its surrounding edge whitespace kept. By default only a construct
 * carrying the AI marker is rejected, so the gate cannot delete human-authored
 * markup; opts.resp overrides (null rejects regardless). A no-op (SAME doc) when
 * there is nothing to remove.
 */
export function rejectConstruct(doc, el, opts = {}) {
  if (!el || el.type !== "element") return doc;
  if (el.outerStart == null || el.outerEnd == null) return doc;
  const want = opts.resp === undefined ? AI_RESP : opts.resp;
  if (want != null && getAttr(el, "resp") !== want) return doc;

  // A non-reading construct (a standOff <note>) carries no reading text to keep:
  // remove it outright, eating the one inserted line of indentation.
  if (!isReadingContext(el)) return removeBlock(doc, el);

  // A self-closing reading element (<gap/>) has no content to restore: remove just
  // its bytes, leaving the surrounding edge whitespace intact.
  if (el.selfClosing || el.contentStart == null || el.contentEnd == null) {
    return spliceDocument(doc, el.outerStart, el.outerEnd, "");
  }

  // A reading-text wrapper: replace it with its inner content, restoring the exact
  // surrounded reading text (the inverse of the wrap that applied it).
  const inner = doc.raw.slice(el.contentStart, el.contentEnd);
  return spliceDocument(doc, el.outerStart, el.outerEnd, inner);
}

/**
 * Remove an element's whole span plus the single preceding line of indentation
 * (one run of spaces/tabs and at most one newline), so removing an appended
 * standOff note leaves no blank line. Only non-reading callers reach this, so
 * significant reading-text edge whitespace is never touched.
 */
function removeBlock(doc, el) {
  let start = el.outerStart;
  while (start > 0 && (doc.raw[start - 1] === " " || doc.raw[start - 1] === "\t")) start--;
  if (start > 0 && doc.raw[start - 1] === "\n") {
    start--;
    if (start > 0 && doc.raw[start - 1] === "\r") start--;
  }
  return spliceDocument(doc, start, el.outerEnd, "");
}
