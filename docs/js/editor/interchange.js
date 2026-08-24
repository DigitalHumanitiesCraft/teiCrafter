/**
 * Project-controlled interchange at the editor boundary.
 *
 * The working document stays in teiCrafter's register model. A project may
 * choose a different on-disk model without leaking that choice into editing
 * operations: import happens once on load, export happens only for a save or
 * download artifact.
 */

import {
  INLINE_GND_ENTITY_TYPES,
  fromInlineGND,
  inlineGndCapabilityReport,
  toInlineGND,
} from "./inline-gnd.js";

/** True when the active project stores documents in the inline-GND shape. */
export function usesInlineGND(project) {
  return project?.interchange === "inline-gnd";
}

/** Entity types a project target can persist, or null when it imposes no limit. */
export function exportableEntityTypes(project) {
  return usesInlineGND(project) ? INLINE_GND_ENTITY_TYPES : null;
}

/** Lift an interchange document into the register model used by the editor. */
export function workingDocument(doc, project) {
  return usesInlineGND(project) ? fromInlineGND(doc) : doc;
}

/** Project the register model into the project's on-disk interchange shape. */
export function targetDocument(doc, project) {
  return usesInlineGND(project) ? toInlineGND(doc) : doc;
}

/** Describe whether the current document can reach the project's target shape. */
export function targetCapabilityReport(doc, project) {
  if (usesInlineGND(project)) return inlineGndCapabilityReport(doc);
  return Object.freeze({
    ok: true,
    profile: null,
    supportedEntityTypes: null,
    counts: Object.freeze({ entities: 0, mentions: 0 }),
    issues: Object.freeze([]),
  });
}
