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
  editTextNode,
  countLocals,
  escapeText,
  decodeEntities,
} from "./tei-document.js";

// Back-compat re-exports (old names used elsewhere).
export const escapeXmlText = escapeText;
export const unescapeXmlText = decodeEntities;

function stripHash(v) {
  return v ? v.replace(/^#/, "") : v;
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

  for (const e of events) {
    if (e.k === "pb") { newFolio(e.el); continue; }
    if (e.k === "line") {
      lineTrigger({ n: getAttr(e.el, "n"), facs: stripHash(getAttr(e.el, "facs")) });
      continue;
    }
    // cell
    if (!curLine) newLine({});
    const anc = ancestorWithXmlId(e.node);
    let id = anc ? getAttr(anc, "id") : null;
    if (!id || cellById.has(id)) id = (id ? id + "#" : "c") + cellSeq;
    cellSeq++;
    const cell = {
      id,
      text: e.text,
      node: e.node,
      start: e.node.start,
      end: e.node.end,
      rawText: doc.raw.slice(e.node.start, e.node.end),
      facs: cellFacs(e.node) || curLine.facs,
    };
    curLine.cells.push(cell);
    cells.push(cell);
    cellById.set(id, cell);
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
 * Split a cell's text into [lead, core, trail] where lead/trail are the node's
 * edge whitespace (insignificant indentation/newlines) and core is the part a
 * human actually edits. For a word-level <w>text</w> node both edges are empty.
 */
export function splitEdge(text) {
  const lead = (text.match(/^\s*/) || [""])[0];
  const trail = (text.match(/\s*$/) || [""])[0];
  return [lead, text.slice(lead.length, text.length - trail.length), trail];
}

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
