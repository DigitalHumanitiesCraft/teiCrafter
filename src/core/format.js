/**
 * Mixed-content-aware formatter. Formatting re-indents only elements whose
 * content is element-only; text-bearing elements are copied byte for byte,
 * because their whitespace is content (word separation in <l>, for example).
 */
import { spliceDocument } from "./tei-document.js";

/** @typedef {import("./tei-document.js").TeiNode} TeiNode */
/** @typedef {import("./tei-document.js").TeiDocument} TeiDocument */

/**
 * @typedef {Object} FormatResult
 * @property {{ from: number, to: number }} range Raw range that is replaced.
 * @property {string} before The raw text of the range.
 * @property {string} after The formatted replacement; equal to before when nothing changes.
 * @property {TeiNode} element The element that was formatted.
 */

/** Elements that may start their own line. Everything else is treated as inline. */
export const DEFAULT_BLOCKS = new Set([
  "TEI", "teiHeader", "fileDesc", "titleStmt", "publicationStmt", "sourceDesc", "profileDesc", "revisionDesc",
  "text", "front", "body", "back", "div", "p", "lg", "l", "ab", "head", "list", "item", "listPerson", "person",
  "listPlace", "place", "standOff", "facsimile", "surface", "zone", "note", "bibl", "msDesc", "change",
]);

const XML_SPACE = /^[ \t\r\n]*$/;

/** @param {TeiNode} n */
const span = (n) => ({ from: n.outerStart ?? n.start ?? 0, to: n.outerEnd ?? n.end ?? 0 });

/**
 * Element-only content: no non-whitespace text and no two inline siblings on
 * the same line, since whitespace between them separates words.
 * @param {TeiNode} el
 * @param {string} raw
 * @param {Set<string>} blocks
 */
function isStructural(el, raw, blocks) {
  const kids = el.children ?? [];
  if (el.selfClosing || el.etagStart == null || !kids.some((k) => k.type === "element")) return false;
  /** @param {TeiNode} n */
  const isInline = (n) => n.type === "element" && !blocks.has(n.localName ?? "");
  /** @type {TeiNode | null} */
  let prev = null;
  let gap = "";
  for (const k of kids) {
    if (k.type === "text") {
      const text = raw.slice(k.start, k.end);
      if (!XML_SPACE.test(text)) return false;
      gap += text;
      continue;
    }
    if (prev && isInline(prev) && isInline(k) && !gap.includes("\n")) return false;
    prev = k;
    gap = "";
  }
  return true;
}

/**
 * @param {TeiNode} el
 * @param {string} raw
 * @param {string} indent Indentation of the element's own line.
 * @param {{ blocks: Set<string>, indent: string, newline: string }} opts
 * @returns {string}
 */
function formatNode(el, raw, indent, opts) {
  const { from, to } = span(el);
  if (!isStructural(el, raw, opts.blocks)) return raw.slice(from, to);
  let out = raw.slice(el.stagStart, el.stagEnd);
  for (const k of el.children ?? []) {
    if (k.type === "text") continue;
    const r = span(k);
    const child = k.type === "element" && opts.blocks.has(k.localName ?? "")
      ? formatNode(k, raw, indent + opts.indent, opts)
      : raw.slice(r.from, r.to);
    out += opts.newline + indent + opts.indent + child;
  }
  return out + opts.newline + indent + raw.slice(el.etagStart ?? to, el.etagEnd ?? to);
}

/**
 * Format the innermost block element containing a raw offset, or the document
 * element when no block contains it.
 * @param {TeiDocument} doc
 * @param {number} offset Raw offset.
 * @param {{ blocks?: Set<string>, indent?: string, newline?: string }} [options]
 *   newline defaults to the file's own separator.
 * @returns {FormatResult | null} Null when the document has no element.
 */
export function formatElement(doc, offset, options = {}) {
  const { raw, root } = doc;
  const opts = {
    blocks: options.blocks ?? DEFAULT_BLOCKS,
    indent: options.indent ?? "  ",
    newline: options.newline ?? (raw.includes("\r\n") ? "\r\n" : "\n"),
  };
  /** @type {TeiNode | null} */
  let target = null;
  for (let node = /** @type {TeiNode | undefined} */ (root); node;) {
    node = node.children?.find((c) => c.type === "element" && span(c).from <= offset && offset < span(c).to);
    if (node && opts.blocks.has(node.localName ?? "")) target = node;
  }
  target ??= root.children?.find((c) => c.type === "element") ?? null;
  if (!target || target.outerEnd == null) return null;
  const range = span(target);
  let depth = 0;
  for (let p = target.parent; p && p.type === "element"; p = p.parent) depth++;
  const indent = opts.indent.repeat(depth);
  const body = formatNode(target, raw, indent, opts);
  // An element that starts its line also gets its own indentation corrected, so the range grows to the line start.
  const lineStart = raw.lastIndexOf("\n", range.from - 1) + 1;
  const whole = /^[ \t]*$/.test(raw.slice(lineStart, range.from));
  const from = whole ? lineStart : range.from;
  return {
    range: { from, to: range.to },
    before: raw.slice(from, range.to),
    after: whole ? indent + body : body,
    element: target,
  };
}

/**
 * Map a raw offset of the unformatted text to the formatted text. Formatting
 * changes whitespace only, so the count of non-whitespace characters before
 * the offset identifies the same place.
 * @param {FormatResult} result
 * @param {number} offset Raw offset before formatting.
 * @returns {number} Raw offset after formatting.
 */
export function mapFormattedOffset(result, offset) {
  const { range, before, after } = result;
  if (offset <= range.from) return offset;
  if (offset >= range.to) return offset + after.length - before.length;
  const target = before.slice(0, offset - range.from).replace(/\s/g, "").length;
  let seen = 0;
  let i = 0;
  while (i < after.length && seen < target) { if (!/\s/.test(after[i])) seen++; i++; }
  return range.from + i;
}

/**
 * Apply a format result to a document.
 * @param {TeiDocument} doc
 * @param {FormatResult} result
 * @returns {TeiDocument}
 */
export function applyFormat(doc, result) {
  return spliceDocument(doc, result.range.from, result.range.to, result.after);
}
