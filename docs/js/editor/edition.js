/**
 * teiCrafter Editor -- Edition model (Layer 3, built on the generic core).
 *
 * This is no longer word-specific. It reads ARBITRARY TEI via tei-document.js
 * and projects it into the shape the editor UI consumes: folios (split by <pb>),
 * lines (split by <lb>/<l>), and editable "cells". A cell is simply a
 * non-whitespace reading-text node, so:
 *   - a word-level edition (Wenzelsbibel: <w xml:id>text</w>) yields one cell per
 *     word, edited word by word;
 *   - a line-level edition (Jeanne Hersch: <p><lb .../>line text</p>) yields one
 *     cell per line, edited line by line, with the line's real @facs zone link.
 * Same engine, same lossless offset splice, no project profile branching.
 *
 * The public API (parseEdition, editWordText, serialize, countTags,
 * structuralSummary, escapeXmlText, unescapeXmlText) is preserved so the headless
 * round-trip proof and the browser app keep working unchanged.
 */

import {
  parseDocument,
  walk,
  getAttr,
  elementsByLocal,
  textOf,
  isReadingText,
  readingRoot,
  readSurfaces,
  indexZonesById,
  ancestorWithXmlId,
  isReadingContext,
  CRITICAL_LOCALS,
  editTextNode,
  countLocals,
  escapeText,
  decodeEntities,
  splitEdge,
} from "./tei-document.js";

// Back-compat re-exports (old names used elsewhere).
export const escapeXmlText = escapeText;
export const unescapeXmlText = decodeEntities;
// splitEdge now lives in the shared core (used by the cell editor and the
// textual-critical wrappers); re-export it so existing importers keep working.
export { splitEdge } from "./tei-document.js";

function stripHash(v) {
  return v ? v.replace(/^#/, "") : v;
}

// Entity tokens decodeEntities resolves, for the display->raw offset scanner.
const RE_ENTITY_TOKEN = /&(?:lt|gt|quot|apos|amp|#x[0-9a-fA-F]+|#\d+);/y;

/**
 * Map a DISPLAY range (offsets into the decoded text the renderer shows, i.e.
 * textOf()/cell.text) back to RAW offsets relative to the text node's slice.
 * Scans the raw slice once; an entity reference counts as its decoded length
 * in display units (UTF-16). Returns [relFrom, relTo] or null when the range
 * does not land on scannable positions. The caller should verify the decoded
 * raw slice equals the selected text before splicing.
 */
export function rawRangeForDisplay(rawSlice, dFrom, dTo) {
  if (!(Number.isInteger(dFrom) && Number.isInteger(dTo)) || dFrom < 0 || dFrom >= dTo) return null;
  let rawPos = 0, dispPos = 0, relFrom = -1, relTo = -1;
  while (rawPos <= rawSlice.length) {
    if (dispPos === dFrom && relFrom < 0) relFrom = rawPos;
    if (dispPos === dTo) { relTo = rawPos; break; }
    if (rawPos === rawSlice.length) break;
    RE_ENTITY_TOKEN.lastIndex = rawPos;
    const m = RE_ENTITY_TOKEN.exec(rawSlice);
    if (m) {
      dispPos += decodeEntities(m[0]).length;
      rawPos += m[0].length;
    } else {
      dispPos += 1;
      rawPos += 1;
    }
  }
  return relFrom >= 0 && relTo > relFrom ? [relFrom, relTo] : null;
}

/** Count tracked element tags in a raw TEI string (namespace-agnostic, regex).
 *  Kept string-based because the harness calls it on a serialized candidate. */
export function countTags(raw) {
  const tags = ["surface", "zone", "standOff", "note", "w", "lb", "l", "pb", "p"];
  const out = {};
  for (const t of tags) {
    const re = new RegExp("<" + t + "\\b", "g");
    out[t] = (raw.match(re) || []).length;
  }
  return out;
}

/**
 * Build the editor model from a parsed generic document.
 * Returns { raw, doc, profile, words, wordById, cells, cellById, lines,
 *           surfaces, surfaceById, zoneIndex, folios }.
 * (words/wordById are aliases of cells/cellById for API back-compat.)
 */
function buildState(doc) {
  const root = readingRoot(doc);
  const { surfaces, byId: surfaceById } = readSurfaces(doc);
  const zoneIndex = indexZonesById(surfaces);
  const profile = elementsByLocal(root, "w").length > 0 ? "word" : "line";

  // Pre-order event stream: page breaks, line starts, and reading-text cells,
  // all in document order.
  const events = [];
  walk(root, (n) => {
    if (n.type === "element") {
      if (n.localName === "pb") events.push({ k: "pb", el: n });
      else if (n.localName === "lb" || n.localName === "l") events.push({ k: "line", el: n });
      // A <gap/> stands in for omitted/illegible text: it has no text node, so emit
      // it as its own event to keep the line visible and the marker navigable. Gate
      // it the same way text cells are (no header/facsimile/standOff ancestor), so a
      // gap in a non-reading subtree never leaks into the reading view.
      else if (n.localName === "gap" && isReadingContext(n)) events.push({ k: "gap", el: n });
    } else if (n.type === "text" && isReadingText(n)) {
      const text = textOf(doc, n);
      if (text.trim()) events.push({ k: "cell", node: n, text });
    }
  });

  const folios = [];
  const lines = [];
  const cells = [];
  const cellById = new Map();
  let curFolio = null;
  let curLine = null;
  let cellSeq = 0;

  const newFolio = (pbEl) => {
    const surfaceId = pbEl ? stripHash(getAttr(pbEl, "facs")) : null;
    curFolio = {
      index: folios.length,
      n: pbEl ? getAttr(pbEl, "n") : null,
      surfaceId,
      surface: surfaceId ? surfaceById.get(surfaceId) || null : null,
      lines: [],
    };
    folios.push(curFolio);
    curLine = null;
  };
  const newLine = (meta) => {
    if (!curFolio) newFolio(null); // reading text before any <pb>
    curLine = { n: meta.n ?? null, facs: meta.facs ?? null, cells: [] };
    curFolio.lines.push(curLine);
    lines.push(curLine);
  };
  // Coalesce <l> + its child <lb> into a single line (don't create an empty one).
  const lineTrigger = (meta) => {
    if (curLine && curLine.cells.length === 0) {
      if (meta.n != null) curLine.n = meta.n;
      if (meta.facs != null) curLine.facs = meta.facs;
    } else {
      newLine(meta);
    }
  };

  const cellFacs = (node) => {
    let p = node.parent;
    while (p && p.type === "element") {
      const f = getAttr(p, "facs");
      if (f) return stripHash(f);
      if (p.localName === "l" || p.localName === "p" || p.localName === "body") break;
      p = p.parent;
    }
    return null;
  };

  // M2.5: read-only mention projection. Walk the text node's parent chain to the
  // nearest <name ref> wrapper (the shape linkMention writes) and surface the
  // referenced entity id, so the renderer can make the link visible. The walk
  // stops at the line/paragraph level: a mention never leaks across reading
  // units. No offsets, splices, or serialize() behaviour change.
  const mentionRef = (node) => {
    let p = node.parent;
    while (p && p.type === "element") {
      if (p.localName === "name") return stripHash(getAttr(p, "ref"));
      if (p.localName === "p" || p.localName === "head" || p.localName === "note" || p.localName === "body") return null;
      p = p.parent;
    }
    return null;
  };

  // A cell id is the nearest ancestor xml:id, made unique against ids already used
  // for cells (synthetic positional fallback otherwise). Shared by text and gap cells.
  const makeCellId = (node) => {
    const anc = ancestorWithXmlId(node);
    let id = anc ? getAttr(anc, "id") : null;
    if (!id || cellById.has(id)) id = (id ? id + "#" : "c") + cellSeq;
    cellSeq++;
    return id;
  };
  const pushCell = (cell) => {
    curLine.cells.push(cell);
    cells.push(cell);
    cellById.set(cell.id, cell);
  };

  for (const e of events) {
    if (e.k === "pb") { newFolio(e.el); continue; }
    if (e.k === "line") {
      lineTrigger({ n: getAttr(e.el, "n"), facs: stripHash(getAttr(e.el, "facs")) });
      continue;
    }
    if (e.k === "gap") {
      // A gap is a read-only marker cell (no text node to edit): it shows the
      // omitted-text marker and can only be removed, not corrected inline.
      if (!curLine) newLine({});
      pushCell({
        id: makeCellId(e.el),
        text: "",
        node: e.el,
        start: e.el.outerStart,
        end: e.el.outerEnd,
        rawText: doc.raw.slice(e.el.outerStart, e.el.outerEnd),
        facs: cellFacs(e.el) || curLine.facs,
        gap: true,
        crit: "gap",
        critSole: false,
        mention: null,
      });
      continue;
    }
    // text cell
    if (!curLine) newLine({});
    // Tag the cell's critical status from its IMMEDIATE parent only, so the model
    // agrees with what the criticism ops can act on (they wrap/unwrap the node's
    // direct parent). critSole records whether this node is the wrapper's sole
    // content, i.e. whether "clear" can remove it without touching sibling content.
    const cp = e.node.parent;
    const critParent = cp && cp.type === "element" && CRITICAL_LOCALS.has(cp.localName) ? cp : null;
    pushCell({
      id: makeCellId(e.node),
      text: e.text,
      node: e.node,
      start: e.node.start,
      end: e.node.end,
      rawText: doc.raw.slice(e.node.start, e.node.end),
      facs: cellFacs(e.node) || curLine.facs,
      gap: false,
      crit: critParent ? critParent.localName : null,
      critSole: critParent ? (critParent.children.length === 1 && critParent.children[0] === e.node) : false,
      mention: mentionRef(e.node),
    });
  }

  // Drop render lines that ended up with no editable cell (stray milestones,
  // figure-only lines): they would render as blank rows. The raw is untouched,
  // so this is lossless; it only cleans the reading view.
  for (const f of folios) f.lines = f.lines.filter((l) => l.cells.length > 0);

  return {
    raw: doc.raw,
    doc,
    profile,
    cells,
    cellById,
    words: cells,        // alias (back-compat)
    wordById: cellById,  // alias (back-compat)
    lines: lines.filter((l) => l.cells.length > 0),
    surfaces,
    surfaceById,
    zoneIndex,
    folios,
  };
}

/** Parse a raw TEI string into the editor model. */
export function parseEdition(raw) {
  return buildState(parseDocument(raw));
}

/**
 * Edit one cell's text content (a word, a line, any reading-text node). Returns a
 * NEW model re-built from the spliced document, so all offsets stay correct.
 * Named editWordText for back-compat; editCell is the clearer alias.
 */
export function editCell(state, cellId, newText) {
  const cell = state.cellById.get(cellId);
  if (!cell) throw new Error("Unknown cell id: " + cellId);
  const newDoc = editTextNode(state.doc, cell.node, newText);
  if (newDoc === state.doc) return state;
  return buildState(newDoc);
}
export const editWordText = editCell;

/**
 * Edit a cell by its trimmed CORE text, re-attaching the original edge whitespace
 * so a line edit never collapses the surrounding indentation. This is what the UI
 * commits: the input shows the core, the splice keeps lead/trail verbatim.
 */
export function editCellCore(state, cellId, newCore) {
  const cell = state.cellById.get(cellId);
  if (!cell) throw new Error("Unknown cell id: " + cellId);
  const [lead, , trail] = splitEdge(cell.text);
  return editCell(state, cellId, lead + newCore + trail);
}

/** The canonical serialization is the raw string itself (lossless). */
export function serialize(state) {
  return state.raw;
}

/**
 * The set of real @xml:id values in the reading text (body/text, never the
 * teiHeader/facsimile/standOff). This is the stable baseline for the live
 * integrity check: synthetic positional cell ids (c0..cN) churn when a line is
 * emptied even though the round-trip stays lossless, so they must not be used.
 */
export function xmlIdSet(state) {
  const ids = new Set();
  walk(readingRoot(state.doc), (n) => {
    if (n.type === "element") {
      const id = getAttr(n, "id");
      if (id) ids.add(id);
    }
  });
  return ids;
}

/** A lightweight structural summary for the in-browser validation panel. */
export function structuralSummary(state) {
  const counts = countLocals(state.doc, [
    "surface", "zone", "standOff", "note", "w", "lb", "l", "pb", "p", "div", "hi", "figure",
  ]);
  const ids = new Set();
  walk(state.doc.root, (n) => {
    if (n.type === "element") { const id = getAttr(n, "id"); if (id) ids.add(id); }
  });
  return {
    counts,
    profile: state.profile,
    folios: state.folios.length,
    lines: state.lines.length,
    words: state.cells.length,
    ids: ids.size,
  };
}
