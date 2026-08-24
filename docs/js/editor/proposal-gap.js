/** Reversible TEI representation for a proposed gap. */

import { escapeAttr, getAttr, getAttrObj, spliceDocument } from "./tei-document.js";

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
  if (!resp || (expectedResp != null && resp !== expectedResp)) return null;
  const orig = directChild(choice, "orig");
  const reg = directChild(choice, "reg");
  const gap = reg && directChild(reg, "gap");
  if (!orig || !gap || getAttr(gap, "resp") !== resp) return null;
  if (orig.contentStart == null || orig.contentEnd == null) return null;
  return { choice, orig, gap, resp };
}

/** Accept the proposal by replacing the reversible choice with its clean gap. */
export function confirmProposalGap(doc, parts) {
  const attr = getAttrObj(parts.gap, "resp");
  let gapRaw = doc.raw.slice(parts.gap.outerStart, parts.gap.outerEnd);
  if (attr) {
    let start = attr.start - parts.gap.outerStart;
    const end = attr.end - parts.gap.outerStart;
    if (start > 0 && /\s/.test(gapRaw[start - 1])) start -= 1;
    gapRaw = gapRaw.slice(0, start) + gapRaw.slice(end);
  }
  return spliceDocument(doc, parts.choice.outerStart, parts.choice.outerEnd, gapRaw);
}

/** Reject the proposal by restoring the original raw reading bytes. */
export function rejectProposalGap(doc, parts) {
  const original = doc.raw.slice(parts.orig.contentStart, parts.orig.contentEnd);
  return spliceDocument(doc, parts.choice.outerStart, parts.choice.outerEnd, original);
}
