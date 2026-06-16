/**
 * teiCrafter Editor -- Textual-critical markup (M3.6, DOM-free, lossless).
 *
 * Inline editorial markup over the reading text itself. This is different from
 * standOff notes/entities, which live outside the text flow: here the markup wraps
 * (or replaces) a reading-text node in place.
 *   - <unclear>, <del>, <add> WRAP a node's core content (uncertain reading,
 *     deletion in the source, authorial/scribal addition);
 *   - <gap/> REPLACES the core (the text is illegible or omitted, so a gap has no
 *     content per TEI).
 * It imports only from ./tei-document.js, so the logic the browser runs
 * (editor-app.js) is the logic the headless proof measures.
 *
 * The raw string stays canonical. Every mutation is one offset splice via
 * spliceDocument, which returns a NEW re-parsed doc; a no-op returns the SAME doc,
 * so a load -> serialize round-trip is byte-identical by construction. The wrap
 * keeps the node's edge whitespace (lead/trail) verbatim, exactly as editCellCore
 * does, so marking a line never collapses its indentation. The wrapped core is the
 * raw (already-escaped) slice, spliced as-is: no decode/re-encode, no entity churn.
 */

import {
  spliceDocument,
  escapeAttr,
  splitEdge,
  CRITICAL_LOCALS,
} from "./tei-document.js";

/**
 * The supported kinds. `wraps` distinguishes the content-wrapping markers
 * (unclear/del/add) from gap, which is an empty element that replaces the text.
 */
export const CRITICAL_KINDS = Object.freeze({
  unclear: { tag: "unclear", wraps: true, label: "unclear" },
  del: { tag: "del", wraps: true, label: "deleted" },
  add: { tag: "add", wraps: true, label: "added" },
  gap: { tag: "gap", wraps: false, label: "gap" },
});

/** True when the text node is the sole content of an element of this local-name. */
function isSoleContentOf(textNode, localName) {
  const p = textNode.parent;
  return (
    p &&
    p.type === "element" &&
    p.localName === localName &&
    p.children.length === 1 &&
    p.children[0] === textNode
  );
}

/**
 * Apply a textual-critical marker to a reading-text node.
 *   - unclear/del/add: wrap the node's CORE text in <kind>...</kind>, keeping the
 *     edge whitespace outside the tags. A no-op (SAME doc) when the node is already
 *     the sole content of exactly this kind, or when the core is empty.
 *   - gap: replace the CORE with a self-closing <gap.../> (opts.reason -> @reason),
 *     keeping the edge whitespace. The reading text is omitted by design.
 * Returns a NEW doc otherwise. Throws only on an unknown kind.
 */
export function markCritical(doc, textNode, kind, opts = {}) {
  const desc = CRITICAL_KINDS[kind];
  if (!desc) throw new Error("Unknown critical kind: " + kind);
  if (!textNode || textNode.type !== "text") return doc;

  // Splice the raw (already-escaped) slice as-is; never decode/re-escape, so the
  // wrap cannot churn entity spellings (&nbsp; etc.).
  const rawSlice = doc.raw.slice(textNode.start, textNode.end);
  const [lead, core, trail] = splitEdge(rawSlice);

  // opts.resp marks the wrapper as model-proposed (the project responsibility id,
  // "#ai" by default), so a proposed criticism reads as the AI provenance family
  // and confirm/reject can act on it. Absent for human-authored criticism.
  const respAttr = opts.resp ? ' resp="' + escapeAttr(String(opts.resp)) + '"' : "";

  if (desc.wraps) {
    if (!core) return doc; // nothing to wrap (whitespace-only node)
    // No-op when the node's immediate parent is already exactly this wrapper, so
    // re-applying the same marker never nests a redundant duplicate, even when the
    // wrapper holds more than this one node (mixed content).
    const p = textNode.parent;
    if (p && p.type === "element" && p.localName === desc.tag) return doc;
    const wrapped = lead + "<" + desc.tag + respAttr + ">" + core + "</" + desc.tag + ">" + trail;
    return spliceDocument(doc, textNode.start, textNode.end, wrapped);
  }

  // gap: replace the core with an empty element, edge whitespace preserved.
  const reason = opts.reason ? ' reason="' + escapeAttr(String(opts.reason)) + '"' : "";
  const replaced = lead + "<gap" + reason + respAttr + "/>" + trail;
  return spliceDocument(doc, textNode.start, textNode.end, replaced);
}

/**
 * Remove the critical wrapper (unclear/del/add) immediately around a reading-text
 * node, restoring plain text: the element is replaced by its inner content. The
 * node's immediate parent must be one of those wrappers. Returns a NEW doc, or the
 * SAME doc when there is nothing removable. Gap is not reversible (its text is gone).
 */
export function unwrapCritical(doc, textNode) {
  if (!textNode || textNode.type !== "text") return doc;
  const parent = textNode.parent;
  if (!parent || parent.type !== "element") return doc;
  if (!CRITICAL_LOCALS.has(parent.localName) || parent.localName === "gap") return doc;
  // Only remove a wrapper that holds EXACTLY this node. A critical wrapper over
  // mixed content (e.g. <del>Hallo <hi>X</hi> Welt</del>) is shared by several
  // cells; stripping it from one cell would silently drop the editorial markup
  // over the others. Refuse (SAME doc) rather than destroy intent.
  if (!isSoleContentOf(textNode, parent.localName)) return doc;
  if (parent.outerStart == null || parent.outerEnd == null) return doc;
  if (parent.contentStart == null || parent.contentEnd == null) return doc;
  const inner = doc.raw.slice(parent.contentStart, parent.contentEnd);
  return spliceDocument(doc, parent.outerStart, parent.outerEnd, inner);
}

/**
 * Remove a <gap/> element entirely (the only edit a gap supports, since it has no
 * text to restore). `gapEl` is the parsed gap element. Returns a NEW doc, or the
 * SAME doc when the element is absent or not a gap.
 */
export function removeGap(doc, gapEl) {
  if (!gapEl || gapEl.type !== "element" || gapEl.localName !== "gap") return doc;
  if (gapEl.outerStart == null || gapEl.outerEnd == null) return doc;
  return spliceDocument(doc, gapEl.outerStart, gapEl.outerEnd, "");
}
