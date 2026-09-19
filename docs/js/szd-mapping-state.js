import { MAPPING_ROLES, validateDecisions } from './szd-mapping-export.js';

function textareaBoundaries(text) {
  const boundaries = [0];
  for (let offset = 0; offset < text.length; offset += 1) {
    if (text[offset] === '\r' && text[offset + 1] === '\n') offset += 1;
    boundaries.push(offset + 1);
  }
  return boundaries;
}

/** Textareas normalize CRLF; stored evidence keeps the original source offsets. */
export function sourceRangeForSelection(text, start, end) {
  const boundaries = textareaBoundaries(text);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end >= boundaries.length) {
    throw new Error('Selection is outside the source transcription.');
  }
  return { start: boundaries[start], end: boundaries[end] };
}

export function selectionRangeForSource(text, start, end) {
  const boundaries = textareaBoundaries(text);
  const first = boundaries.indexOf(start);
  const last = boundaries.indexOf(end);
  if (first < 0 || last < first) throw new Error('This source boundary cannot be selected in a text field.');
  return { start: first, end: last };
}

export function makeWorkingCopy(page, provenance, decisions) {
  return { schemaVersion: 'szd-decisions-1', pageId: page.id, sourceHash: page.sourceHash,
    experiment: provenance.experiment, decisions: structuredClone(decisions) };
}

export function restoreWorkingCopy(page, provenance, value) {
  if (value?.schemaVersion !== 'szd-decisions-1' || value.pageId !== page.id || value.sourceHash !== page.sourceHash) {
    throw new Error('These decisions belong to a different source page or transcription.');
  }
  if (value.experiment !== provenance.experiment) throw new Error('These decisions belong to a different experiment.');
  if (!value.decisions || Object.keys(value.decisions).length !== MAPPING_ROLES.length
    || MAPPING_ROLES.some((role) => !Object.hasOwn(value.decisions, role))) {
    throw new Error('The saved decisions do not contain the complete role set.');
  }
  const errors = validateDecisions(page, value.decisions);
  if (errors.length) throw new Error(errors.join(' '));
  return structuredClone(value.decisions);
}

/** Refuse stale-tab writes; the caller retains its unsaved in-memory decisions. */
export function saveWorkingCopy(storage, key, expected, value) {
  if (storage.getItem(key) !== expected) {
    throw new Error('Another tab changed these decisions. Save your decisions to a file before reloading.');
  }
  const serialized = JSON.stringify(value);
  storage.setItem(key, serialized);
  return serialized;
}
