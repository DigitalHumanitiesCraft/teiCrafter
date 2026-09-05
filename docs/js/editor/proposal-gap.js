/** Reversible TEI representation for a proposed gap. */

import { escapeAttr, getAttr, parseDocument, spliceDocument } from "./tei-document.js";
import { acceptProposal, isPendingProposal } from "./proposal-provenance.js";

const directChild = (el, localName) => (el.children || [])
  .find((child) => child.type === "element" && child.localName === localName) || null;

/**
 * Keep the exact source text in <orig> until a human resolves the proposal.
 * The proposed <gap/> remains visible as the alternative reading.
 */
export function proposalGapMarkup(inner, resp, reason) {
  const marker = ` resp="${escapeAttr(String(resp))}"`;
  const reasonAttr = reason ? ` reason="${escapeAttr(String(reason))}"` : "";
  return `<choice${marker}><orig>${inner}</orig><reg><gap${reasonAttr}${marker}/></reg></choice>`;
}

/** Return the reversible gap parts when el is the choice or its nested gap. */
export function proposalGapParts(el, expectedResp) {
  let choice = el;
  while (choice && choice.type === "element" && choice.localName !== "choice") choice = choice.parent;
  if (!choice || choice.type !== "element" || choice.localName !== "choice") return null;
  const resp = getAttr(choice, "resp");
  if (!resp || (expectedResp != null && !isPendingProposal(choice, expectedResp))) return null;
  const orig = directChild(choice, "orig");
  const reg = directChild(choice, "reg");
  const gap = reg && directChild(reg, "gap");
  if (!orig || !gap || (expectedResp != null && !isPendingProposal(gap, expectedResp))) return null;
  if (orig.contentStart == null || orig.contentEnd == null) return null;
  return { choice, orig, gap, resp, expectedResp };
}

/** Accept the gap while retaining its responsibility and acceptance markers. */
export function confirmProposalGap(doc, parts) {
  const fragment = parseDocument(doc.raw.slice(parts.gap.outerStart, parts.gap.outerEnd));
  const gap = fragment.root.children.find((node) => node.type === "element");
  const gapRaw = acceptProposal(fragment, gap, parts.expectedResp || parts.resp).raw;
  return spliceDocument(doc, parts.choice.outerStart, parts.choice.outerEnd, gapRaw);
}

/** Reject the proposal by restoring the original raw reading bytes. */
export function rejectProposalGap(doc, parts) {
  const original = doc.raw.slice(parts.orig.contentStart, parts.orig.contentEnd);
  return spliceDocument(doc, parts.choice.outerStart, parts.choice.outerEnd, original);
}
