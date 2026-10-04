/**
 * A proposal is a suggested replacement of one raw range, produced by a model
 * or a deterministic rule and applied only after a person accepts it.
 */
import { spliceDocument } from "./tei-document.js";

/** @typedef {import("./tei-document.js").TeiDocument} TeiDocument */

/**
 * @typedef {Object} Proposal
 * @property {number} from Raw start offset of the range to replace.
 * @property {number} to Raw end offset (exclusive).
 * @property {string} replacement Raw XML that replaces the range.
 * @property {string} rationale Why the change is proposed, shown to the person deciding.
 * @property {string} origin The producer, kept so an accepted change stays attributable.
 */

/**
 * Splice an accepted proposal into the document.
 * @param {TeiDocument} doc
 * @param {Proposal} proposal
 * @returns {TeiDocument} The new document.
 */
export function applyProposal(doc, proposal) {
  const { from, to } = proposal;
  // A proposal computed on another version of the text may point past its end.
  if (!(Number.isInteger(from) && Number.isInteger(to) && 0 <= from && from <= to && to <= doc.raw.length)) {
    throw new RangeError(`Proposal range ${from}..${to} lies outside the document (length ${doc.raw.length}).`);
  }
  return spliceDocument(doc, from, to, proposal.replacement);
}
