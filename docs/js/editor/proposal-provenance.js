import { editTextAndAttrs, getUnqualifiedAttr } from "./tei-document.js";

const ACCEPTED_PREFIX = "urn:teicrafter:proposal:accepted:";
const tokens = (value) => String(value || "").trim().split(/\s+/).filter(Boolean);
const acceptedToken = (responsibility) => ACCEPTED_PREFIX + encodeURIComponent(responsibility);

export function hasResponsibility(element, responsibility) {
  return tokens(getUnqualifiedAttr(element, "resp")).includes(responsibility);
}

export function isAcceptedProposal(element, responsibility) {
  return hasResponsibility(element, responsibility)
    && tokens(getUnqualifiedAttr(element, "ana")).includes(acceptedToken(responsibility));
}

export function isPendingProposal(element, responsibility) {
  return hasResponsibility(element, responsibility) && !isAcceptedProposal(element, responsibility);
}

/** Acceptance adds evidence independently of origin and preserves all responsibility pointers. */
export function acceptProposal(doc, element, responsibility) {
  const origin = tokens(getUnqualifiedAttr(element, "resp"));
  const requested = responsibility == null ? origin : tokens(responsibility);
  const accepted = requested.filter((value) => origin.includes(value));
  if (!accepted.length) return doc;
  const analysis = tokens(getUnqualifiedAttr(element, "ana"));
  const next = [...new Set([...analysis, ...accepted.map(acceptedToken)])];
  if (next.length === analysis.length) return doc;
  return editTextAndAttrs(doc, element, { set: { ana: next.join(" ") } });
}
