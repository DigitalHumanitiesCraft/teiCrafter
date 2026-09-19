import { buildTei, validateDecisions, MAPPING_ROLES } from './szd-mapping-export.js';
import { makeWorkingCopy, restoreWorkingCopy, saveWorkingCopy, sourceRangeForSelection, selectionRangeForSource } from './szd-mapping-state.js';

const base = 'data/editor/szd-mapping-local/';
const storagePrefix = 'teicrafter-szd-decisions-v1:';
const $ = (id) => document.getElementById(id);
let dataset;
let page;
let decisions = {};
let history = [];
let selection = null;
let storageAvailable = true;
let revision = 0;
const pageChanges = new Map();
const unsavedPages = new Set();
const storageVersions = new Map();

const describe = (decision) => decision.status === 'present' ? decision.value
  : decision.status === 'absent' ? 'Not present' : 'Uncertain';
const activeRole = () => $('role-picker').value;
const activeField = () => page.fields.find((field) => field.id === activeRole());
const storageKey = () => `${storagePrefix}${page.id}:${page.sourceHash}`;
const exportPage = () => ({ ...page, image: `${base}${page.image}` });

function status(message, error = false) {
  $('status').textContent = message;
  $('status').dataset.error = String(error);
}

function record() {
  return makeWorkingCopy(page, dataset.provenance, decisions);
}

function checkRecord(value) {
  return restoreWorkingCopy(exportPage(), dataset.provenance, value);
}

function persist() {
  pageChanges.set(storageKey(), structuredClone(record()));
  let failure = '';
  try {
    const serialized = saveWorkingCopy(localStorage, storageKey(), storageVersions.get(storageKey()) ?? null, record());
    storageVersions.set(storageKey(), serialized);
    unsavedPages.delete(storageKey());
    storageAvailable = true;
  } catch (error) {
    storageAvailable = false;
    unsavedPages.add(storageKey());
    failure = error.message;
  }
  status(storageAvailable ? 'Decisions saved in this browser. Source transcription and recorded proposals remain unchanged.'
    : `Changes remain in this tab. ${failure} Use Save decisions to preserve them.`, !storageAvailable);
}

function change(next, message) {
  const errors = validateDecisions(exportPage(), next);
  if (errors.length) { status(errors.join(' '), true); return; }
  history.push(structuredClone(decisions));
  decisions = next;
  revision += 1;
  persist();
  renderDecision();
  if (storageAvailable && message) status(message);
}

function assign(decision) {
  change({ ...decisions, [activeRole()]: decision });
}

function chooseRole(role) {
  $('role-picker').value = role;
  selection = null;
  renderDecision();
  const decision = decisions[role];
  if (decision.status === 'present') {
    try {
      const range = selectionRangeForSource(page.text, decision.start, decision.end);
      $('source-text').setSelectionRange(range.start, range.end);
    } catch (error) { status(error.message, true); }
  } else {
    $('source-text').setSelectionRange(0, 0);
  }
}

function renderSelection() {
  $('selected-text').textContent = selection ? page.text.slice(selection.start, selection.end) : 'No text selected.';
  $('use-selection').disabled = !selection;
}

function renderDecision() {
  const field = activeField();
  const decision = decisions[field.id];
  const current = $('current-decision');
  current.replaceChildren();
  current.dataset.origin = decision.origin;
  const quote = document.createElement('p');
  quote.textContent = describe(decision);
  const source = document.createElement('small');
  source.textContent = `${decision.origin === 'jev' ? 'Jev proposal' : decision.origin === 'rules' ? 'Rule-based proposal' : 'Manual decision'} · ${decision.reviewed ? 'Confirmed in working copy' : 'Not reviewed'}`;
  current.append(quote, source);
  for (const origin of ['rules', 'jev']) {
    $(`use-${origin}`).querySelector('span').textContent = describe(field[origin]);
  }
  $('confirm-role').textContent = decision.reviewed ? 'Remove confirmation' : 'Confirm this role';
  $('review-count').textContent = `${Object.values(decisions).filter((item) => item.reviewed).length} / ${MAPPING_ROLES.length} confirmed`;
  $('role-list').replaceChildren();
  for (const item of page.fields.filter((item) => MAPPING_ROLES.includes(item.id))) {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-pressed', String(item.id === field.id));
    const name = document.createElement('span');
    name.textContent = item.label;
    const state = document.createElement('small');
    const currentItem = decisions[item.id];
    state.textContent = currentItem.reviewed ? 'Confirmed' : currentItem.status === 'present' ? 'Proposed' : describe(currentItem);
    button.append(name, state);
    button.addEventListener('click', () => chooseRole(item.id));
    $('role-list').append(button);
  }
  $('xml-preview').textContent = buildTei(exportPage(), decisions);
  $('undo').disabled = history.length === 0;
  renderSelection();
}

function loadPage(id) {
  revision += 1;
  page = dataset.pages.find((item) => item.id === id);
  decisions = Object.fromEntries(page.fields.filter((field) => MAPPING_ROLES.includes(field.id))
    .map((field) => [field.id, { ...field.jev, reviewed: false }]));
  history = [];
  selection = null;
  let restoreError = '';
  try {
    const memory = pageChanges.get(storageKey());
    if (memory) decisions = checkRecord(memory);
    else {
      const saved = localStorage.getItem(storageKey());
      storageVersions.set(storageKey(), saved);
      if (saved) decisions = checkRecord(JSON.parse(saved));
    }
  } catch (error) {
    restoreError = `Saved changes could not be restored: ${error.message}`;
  }
  $('source-text').value = page.text;
  $('scan').src = `${base}${page.image}`;
  $('scan').alt = `Scan of ${page.objectId}, page ${page.pageNumber}`;
  $('full-image').href = `${base}${page.image}`;
  const kind = page.fields.find((field) => field.id === 'structure.document_type');
  $('page-kind').textContent = `Jev: ${kind?.jev.value || 'unresolved'}`;
  $('role-picker').replaceChildren();
  for (const field of page.fields.filter((field) => MAPPING_ROLES.includes(field.id))) {
    $('role-picker').add(new Option(field.label, field.id));
  }
  $('role-picker').value = 'metadata.date';
  renderDecision();
  const unsaved = unsavedPages.has(storageKey());
  status(restoreError || (unsaved ? 'Changes are held in this tab only. Use Save decisions to preserve them.'
    : 'Recorded proposals and any saved decisions loaded. Select a role and compare it with the scan.'), !!restoreError || unsaved);
}

$('page-picker').addEventListener('change', (event) => loadPage(event.target.value));
$('role-picker').addEventListener('change', () => chooseRole(activeRole()));
$('source-text').addEventListener('select', () => {
  const text = $('source-text');
  selection = text.selectionEnd > text.selectionStart
    ? sourceRangeForSelection(page.text, text.selectionStart, text.selectionEnd) : null;
  renderSelection();
});
$('use-selection').addEventListener('click', () => {
  if (!selection) return;
  assign({ status: 'present', ...selection, value: page.text.slice(selection.start, selection.end), origin: 'manual', reviewed: false });
});
for (const origin of ['rules', 'jev']) {
  $(`use-${origin}`).addEventListener('click', () => assign({ ...activeField()[origin], reviewed: false }));
}
for (const [id, value] of [['mark-absent', 'absent'], ['mark-unresolved', 'unresolved']]) {
  $(id).addEventListener('click', () => assign({ status: value, start: null, end: null, value: '', origin: 'manual', reviewed: false }));
}
$('confirm-role').addEventListener('click', () => {
  const decision = decisions[activeRole()];
  assign({ ...decision, reviewed: !decision.reviewed });
});
$('undo').addEventListener('click', () => {
  if (!history.length) return;
  decisions = history.pop();
  revision += 1;
  persist();
  renderDecision();
});
$('save-work').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(record(), null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${page.objectId}-p${page.pageNumber}-decisions.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  status('Decisions download requested.');
});
$('restore-work').addEventListener('click', () => $('restore-file').click());
$('restore-file').addEventListener('change', async () => {
  const input = $('restore-file');
  const file = input.files[0];
  if (!file) return;
  const capturedRevision = revision;
  try {
    const value = JSON.parse(await file.text());
    if (revision !== capturedRevision) throw new Error('The page or decisions changed while reading this file. Restore it again.');
    change(checkRecord(value), 'Saved decisions restored for this source page.');
  }
  catch (error) { status(error.message, true); }
  input.value = '';
});
$('open-editor').addEventListener('click', () => {
  try {
    const key = crypto.randomUUID();
    const raw = buildTei(exportPage(), decisions);
    sessionStorage.setItem(`teicrafter-szd-import:${key}`, JSON.stringify({ raw, name: `${page.objectId}-p${page.pageNumber}-mapping.tei.xml` }));
    location.href = `editor.html#szd-import=${key}`;
  } catch (error) { status(`Cannot open this draft: ${error.message}`, true); }
});
$('scan').addEventListener('error', () => status('The facsimile could not be loaded. Source review is incomplete.', true));
window.addEventListener('beforeunload', (event) => {
  if (unsavedPages.size) { event.preventDefault(); event.returnValue = ''; }
});

async function start() {
  if (!['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) {
    throw new Error('This source mapping view is available on the local development server.');
  }
  const response = await fetch(`${base}dataset.json`);
  if (!response.ok) throw new Error('Local SZD examples are missing. Run the documented fixture builder first.');
  dataset = await response.json();
  if (dataset.schemaVersion !== 'szd-mapping-1' || !dataset.pages?.length) throw new Error('Unsupported SZD dataset.');
  for (const item of dataset.pages) {
    $('page-picker').add(new Option(`${item.objectId} · page ${item.pageNumber}`, item.id));
  }
  loadPage(dataset.pages[0].id);
  for (const id of ['page-picker', 'save-work', 'restore-work', 'open-editor']) $(id).disabled = false;
  $('workspace').hidden = false;
  $('preview-panel').hidden = false;
}
start().catch((error) => status(error.message, true));
