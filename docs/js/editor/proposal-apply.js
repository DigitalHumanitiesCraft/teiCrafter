/**
 * teiCrafter Editor -- apply AI annotation proposals to the document (DOM-free, pure).
 *
 * Turns the normalised proposals from ai-suggest.js into lossless, resp-marked
 * engine edits, anchored to the surface text they name. Every construct is inserted
 * with the project's responsibility id (default "#ai"), so it shows as the AI family
 * and a human confirms (drops @resp) or rejects (unwraps/removes) it. Each proposal
 * is located unambiguously inside the requested folio snapshot against a freshly
 * re-parsed edition, so shifting offsets after one edit never corrupt the next.
 * (wrapRange / markCritical / addNoteForNode), so the layer is TEI-vocabulary-general
 * (an edition, a dictionary, a corpus), not entity-specific. No new engine primitive.
 *
 * applyProposals(state, proposals, { resp }) -> { raw, state, applied, skipped }
 */

import { folioSourceSlice, parseEdition, rawRangeForDisplay } from "./edition.js";
import { wrapRange, addNoteForNode, AI_RESP } from "./standoff.js";
import { escapeAttr } from "./tei-document.js";
import { proposalGapMarkup } from "./proposal-gap.js";

// Entity type -> the TEI name element a proposed mention is wrapped in. A proposed
// entity is an inline, resp-marked name wrap (not a standOff entry): lossless, shows
// violet, confirmable by dropping @resp, and promotable to a standOff entity later.
const ENTITY_ELEMENT = { person: "persName", place: "placeName", org: "orgName", work: "title", event: "name" };

const escA = (s) => escapeAttr(String(s));

/** Capture the requested folio and its cells against the immutable raw snapshot. */
export function createProposalScope(state, folioIndex) {
  const count = state && Array.isArray(state.folios) ? state.folios.length : 0;
  if (!count) throw new Error("The document has no proposal scope");
  const index = Math.max(0, Math.min(count - 1, Number(folioIndex) || 0));
  const folio = state.folios[index];
  const slice = folioSourceSlice(state, index);
  const cells = [];
  folio.lines.forEach((line, lineIndex) => line.cells.forEach((cell, cellIndex) => {
    cells.push({
      lineIndex,
      cellIndex,
      id: cell.id,
      start: cell.start,
      end: cell.end,
      rawText: cell.rawText,
      text: cell.text,
    });
  }));
  return {
    documentRaw: state.doc.raw,
    folioIndex: index,
    folioStart: slice.start,
    folioEnd: slice.end,
    folioRaw: slice.value,
    cells,
  };
}

function cellsInScope(state, scope) {
  if (!scope) return state.cells;
  const folio = state.folios[scope.folioIndex];
  return folio ? folio.lines.flatMap((line) => line.cells) : [];
}

function matches(cells, span, folded) {
  const out = [];
  for (const cell of cells) {
    if (cell.gap || cell.start == null || typeof cell.text !== "string") continue;
    const haystack = folded ? cell.text.toLocaleLowerCase() : cell.text;
    const needle = folded ? span.toLocaleLowerCase() : span;
    let from = 0;
    while (from <= haystack.length - needle.length) {
      const idx = haystack.indexOf(needle, from);
      if (idx < 0) break;
      const range = rawRangeForDisplay(cell.rawText, idx, idx + span.length);
      if (range) out.push({ cell, relFrom: range[0], relTo: range[1] });
      from = idx + Math.max(needle.length, 1);
    }
  }
  return out;
}

/** Locate exactly one occurrence inside the requested snapshot scope. */
function locate(state, span, scope) {
  const s = String(span == null ? "" : span).trim();
  if (!s) return { match: null, reason: "span-not-found" };
  const cells = cellsInScope(state, scope);
  const exact = matches(cells, s, false);
  if (exact.length === 1) return { match: exact[0], reason: null };
  if (exact.length > 1) return { match: null, reason: "ambiguous-span" };
  const folded = matches(cells, s, true);
  if (folded.length === 1) return { match: folded[0], reason: null };
  return { match: null, reason: folded.length > 1 ? "ambiguous-span" : "span-not-found" };
}

/** Apply ONE proposal to doc at the located range, marked with resp. Returns a doc. */
function applyOne(doc, loc, p, resp) {
  const { cell, relFrom, relTo } = loc;
  const node = cell.node;
  const respAttr = ` resp="${escA(resp)}"`;

  if (p.kind === "entity") {
    const el = ENTITY_ELEMENT[p.type] || "name";
    const typeAttr = el === "name" ? ` type="${escA(p.type)}"` : "";
    return wrapRange(doc, node, relFrom, relTo, (inner) => `<${el}${typeAttr}${respAttr}>${inner}</${el}>`);
  }
  if (p.kind === "markup") {
    const attrStr = Object.entries(p.attributes || {}).map(([k, v]) => ` ${k}="${escA(v)}"`).join("");
    return wrapRange(doc, node, relFrom, relTo, (inner) => `<${p.element}${attrStr}${respAttr}>${inner}</${p.element}>`);
  }
  if (p.kind === "criticism") {
    if (p.critKind === "gap") {
      return wrapRange(doc, node, relFrom, relTo,
        (inner) => proposalGapMarkup(inner, resp, p.reason));
    }
    return wrapRange(doc, node, relFrom, relTo, (inner) => `<${p.critKind}${respAttr}>${inner}</${p.critKind}>`);
  }
  if (p.kind === "note") {
    return addNoteForNode(doc, node, cell.facs, p.text, { resp });
  }
  return doc;
}

/**
 * Apply every proposal, re-parsing between each so offsets stay valid. `state` is an
 * edition state (it only needs state.doc). Returns the final raw, a fresh state, and
 * the applied / skipped lists. Ambiguous spans are refused. The doc is
 * never mutated; each step is a fresh offset splice, so the result round-trips
 * byte-faithfully (only the deliberate annotations differ from the input).
 */
export function applyProposals(state, proposals, opts = {}) {
  const resp = opts.resp || AI_RESP;
  const scope = opts.scope || null;
  if (scope && state.doc.raw !== scope.documentRaw) {
    throw new Error("Proposal scope does not match the document snapshot");
  }
  let raw = state.doc.serialize();
  const applied = [];
  const skipped = [];
  for (const p of Array.isArray(proposals) ? proposals : []) {
    const st = parseEdition(raw);
    const located = locate(st, p.span, scope);
    if (!located.match) { skipped.push({ proposal: p, reason: located.reason }); continue; }
    const loc = located.match;
    const next = applyOne(st.doc, loc, p, resp);
    if (next === st.doc) { skipped.push({ proposal: p, reason: "no-op" }); continue; }
    raw = next.serialize();
    applied.push(p);
  }
  return { raw, state: parseEdition(raw), applied, skipped };
}
