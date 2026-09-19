import test from 'node:test';
import assert from 'node:assert/strict';
import { MAPPING_ROLES } from '../docs/js/szd-mapping-export.js';
import { makeWorkingCopy, restoreWorkingCopy, saveWorkingCopy, sourceRangeForSelection, selectionRangeForSource } from '../docs/js/szd-mapping-state.js';

const page = { id: 'example:p1', objectId: 'example', pageNumber: 1, sourceHash: 'fixture', text: 'First\r\n😀Date\rLast' };
const provenance = { experiment: 'fixture-experiment' };
const decisions = Object.fromEntries(MAPPING_ROLES.map((role) => [role, { status: 'unresolved', value: '', start: null, end: null, origin: 'jev', reviewed: false }]));

test('textarea selections preserve CRLF, lone CR and Unicode source offsets', () => {
  const normalized = page.text.replace(/\r\n?/g, '\n');
  const start = normalized.indexOf('😀Date');
  const selected = sourceRangeForSelection(page.text, start, start + '😀Date'.length);
  assert.equal(page.text.slice(selected.start, selected.end), '😀Date');
  assert.deepEqual(selectionRangeForSource(page.text, selected.start, selected.end), { start, end: start + '😀Date'.length });
  assert.equal(page.text.slice(...Object.values(sourceRangeForSelection(page.text, 0, normalized.length))), page.text);
  assert.deepEqual(sourceRangeForSelection('a\nb', 2, 3), { start: 2, end: 3 });
  assert.throws(() => selectionRangeForSource(page.text, 6, 7));
  assert.throws(() => sourceRangeForSelection(page.text, -1, 2));
});

test('working copies require matching source, experiment and all roles', () => {
  const record = makeWorkingCopy(page, provenance, decisions);
  assert.deepEqual(restoreWorkingCopy(page, provenance, record), decisions);
  for (const change of [{ pageId: 'other' }, { sourceHash: 'other' }, { experiment: 'other' }, { decisions: {} }, { schemaVersion: 'other' }]) {
    assert.throws(() => restoreWorkingCopy(page, provenance, { ...record, ...change }));
  }
  const restored = restoreWorkingCopy(page, provenance, record);
  restored['metadata.date'].reviewed = true;
  assert.equal(record.decisions['metadata.date'].reviewed, false);
});

test('restoration rejects contradictory absence and inaccurate evidence', () => {
  const record = makeWorkingCopy(page, provenance, decisions);
  record.decisions['metadata.date'] = { status: 'present', value: 'Date', start: 0, end: 4, origin: 'manual', reviewed: true };
  assert.throws(() => restoreWorkingCopy(page, provenance, record));
  record.decisions['metadata.date'] = { status: 'absent', value: 'Date', origin: 'manual', reviewed: true };
  assert.throws(() => restoreWorkingCopy(page, provenance, record));
});

test('a stale tab cannot overwrite newer persisted decisions', () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const record = makeWorkingCopy(page, provenance, decisions);
  const initial = saveWorkingCopy(storage, 'page', null, record);
  const newer = { ...record, decisions: { ...record.decisions, 'metadata.date': { ...record.decisions['metadata.date'], reviewed: true } } };
  const updated = saveWorkingCopy(storage, 'page', initial, newer);
  assert.throws(() => saveWorkingCopy(storage, 'page', initial, record), /Another tab/);
  assert.equal(storage.getItem('page'), updated);
});

test('storage failure remains visible and does not mutate the working copy', () => {
  const storage = { getItem: () => null, setItem: () => { throw new Error('Storage is full'); } };
  const record = makeWorkingCopy(page, provenance, decisions);
  assert.throws(() => saveWorkingCopy(storage, 'page', null, record), /Storage is full/);
  assert.deepEqual(record.decisions, decisions);
});
