import { editTextAndAttrs, getUnqualifiedAttr } from "./tei-document.js";
import { DEFAULT_REVIEWER } from "./review-record.js";

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

/**
 * Acceptance adds evidence independently of origin: every origin pointer stays in
 * @resp, the accepted responsibility is recorded in @ana, and the confirming person's
 * pointer joins @resp, so the file names who took responsibility for the model
 * proposal. Without a configured person the unnamed local editor is recorded.
 * Already accepted evidence is left unchanged, so the first confirmation stands.
 */
export function acceptProposal(doc, element, responsibility, confirmer = DEFAULT_REVIEWER) {
  const origin = tokens(getUnqualifiedAttr(element, "resp"));
  const requested = responsibility == null ? origin : tokens(responsibility);
  const accepted = requested.filter((value) => origin.includes(value));
  if (!accepted.length) return doc;
  const analysis = tokens(getUnqualifiedAttr(element, "ana"));
  const next = [...new Set([...analysis, ...accepted.map(acceptedToken)])];
  if (next.length === analysis.length) return doc;
  const person = tokens(confirmer);
  const added = (person.length ? person : [DEFAULT_REVIEWER]).filter((value) => !origin.includes(value));
  const set = { ana: next.join(" ") };
  if (added.length) set.resp = [...origin, ...added].join(" ");
  return editTextAndAttrs(doc, element, { set });
}
