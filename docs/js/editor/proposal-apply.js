/**
 * teiCrafter Editor -- apply AI annotation proposals to the document (DOM-free, pure).
 *
 * Turns the normalised proposals from ai-suggest.js into lossless, resp-marked
 * engine edits, anchored to the surface text they name. Every construct is inserted
 * with the project's responsibility id (default "#ai"), so it shows as the AI family
 * and a human confirms (drops @resp) or rejects (unwraps/removes) it. Each proposal
 * is located by its span text against a freshly re-parsed edition, so shifting
 * offsets after one edit never corrupt the next. Reuses the generic ops only
 * (wrapRange / markCritical / addNoteForNode), so the layer is TEI-vocabulary-general
 * (an edition, a dictionary, a corpus), not entity-specific. No new engine primitive.
 *
 * applyProposals(state, proposals, { resp }) -> { raw, state, applied, skipped }
 */

import { parseEdition, rawRangeForDisplay } from "./edition.js";
import { wrapRange, addNoteForNode, AI_RESP } from "./standoff.js";
import { markCritical } from "./criticism.js";

// Entity type -> the TEI name element a proposed mention is wrapped in. A proposed
// entity is an inline, resp-marked name wrap (not a standOff entry): lossless, shows
// violet, confirmable by dropping @resp, and promotable to a standOff entity later.
const ENTITY_ELEMENT = { person: "persName", place: "placeName", org: "orgName", work: "title", event: "name" };

function escA(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Find the first cell whose displayed text contains the span, with the raw range. */
function locate(state, span) {
  const s = String(span == null ? "" : span).trim();
  if (!s) return null;
  for (const cell of state.cells) {
    if (cell.gap || cell.start == null || typeof cell.text !== "string") continue;
    const idx = cell.text.indexOf(s);
    if (idx < 0) continue;
    const range = rawRangeForDisplay(cell.rawText, idx, idx + s.length);
    if (!range) continue;
    return { cell, relFrom: range[0], relTo: range[1] };
  }
  return null;
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
    // gap removes content (no surviving text), so it cannot go through wrapRange:
    // it replaces the whole cell core via markCritical. unclear/del/add wrap the span.
    if (p.critKind === "gap") return markCritical(doc, node, "gap", { resp, reason: p.reason });
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
 * the applied / skipped lists (skip reasons: "span-not-found" or "no-op"). The doc is
 * never mutated; each step is a fresh offset splice, so the result round-trips
 * byte-faithfully (only the deliberate annotations differ from the input).
 */
export function applyProposals(state, proposals, opts = {}) {
  const resp = opts.resp || AI_RESP;
  let raw = state.doc.serialize();
  const applied = [];
  const skipped = [];
  for (const p of Array.isArray(proposals) ? proposals : []) {
    const st = parseEdition(raw);
    const loc = locate(st, p.span);
    if (!loc) { skipped.push({ proposal: p, reason: "span-not-found" }); continue; }
    const next = applyOne(st.doc, loc, p, resp);
    if (next === st.doc) { skipped.push({ proposal: p, reason: "no-op" }); continue; }
    raw = next.serialize();
    applied.push(p);
  }
  return { raw, state: parseEdition(raw), applied, skipped };
}
