import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const source = process.argv[2];
if (!source) {
  throw new Error('Usage: node test/tools/make_szd_mapping_fixture.mjs <frozen-result-directory>');
}
const sourceRoot = path.resolve(source);
const destination = path.join(repository, 'docs/data/editor/szd-mapping-local');
const hash = (value) => createHash('sha256').update(value).digest('hex');
const readJson = async (relative) => JSON.parse(await readFile(path.join(sourceRoot, relative), 'utf8'));
const [plan, scores, freeze] = await Promise.all([
  readJson('plan.json'), readJson('scores.json'), readJson('reference-freeze.json'),
]);
assert.equal(hash(await readFile(path.join(sourceRoot, 'plan.json'))), freeze.plan_sha256);
assert.equal(scores.human_approved, false);

const labels = {
  dateline: 'Dateline', opening_salutation: 'Opening salutation',
  closing_formula: 'Closing formula', signature_line: 'Signature',
  document_type: 'Page function', sender: 'Sender', recipient: 'Recipient',
  date: 'Date', place: 'Writing place',
};
const fieldOrder = [
  'structure.document_type', 'structure.dateline', 'structure.opening_salutation',
  'structure.closing_formula', 'structure.signature_line',
  'metadata.sender', 'metadata.recipient', 'metadata.date', 'metadata.place',
];

function convertSelection(row, text, rawChoice) {
  assert.equal(row.choice, rawChoice, `Prediction mismatch: ${row.task_id}/${row.field}`);
  assert.ok(row.selected_evidence.length <= 1, 'Multiple evidence spans require an explicit UI contract');
  const span = row.selected_evidence[0];
  const codePoints = Array.from(text);
  let start = null;
  let end = null;
  let value = '';
  let status;
  if (span) {
    assert.equal(codePoints.slice(span.start, span.end).join(''), span.quote);
    start = codePoints.slice(0, span.start).join('').length;
    end = codePoints.slice(0, span.end).join('').length;
    value = text.slice(start, end);
    assert.equal(value, span.quote);
    status = 'present';
  } else if (row.choice === 'none') {
    status = 'absent';
  } else if (row.choice === 'unresolved') {
    status = 'unresolved';
  } else {
    assert.equal(row.field, 'document_type', 'Unresolved non-classification value');
    status = 'classified';
    value = row.choice;
  }
  return { status, value, start, end, origin: row.variant, candidateId: row.choice };
}

const pages = [];
const images = [];
for (const object of plan.objects) {
  const objectRoot = `data/objects/${object.object_id}`;
  const sourcePages = await readJson(`${objectRoot}/pages.json`);
  for (const page of sourcePages) {
    const id = `${object.object_id}:p${page.page}`;
    const tasks = plan.tasks.filter((task) => task.case_id === id);
    if (!tasks.length) continue;
    const sourceHash = hash(page.text);
    const fields = [];
    for (const task of tasks) {
      assert.equal(task.source_text, page.text);
      const run = await readJson(`runs/${task.id}.json`);
      assert.equal(run.status, 'ok');
      assert.equal(run.source_hashes[id], hash(JSON.stringify(page.text)));
      for (const field of Object.keys(task.rule_prediction)) {
        const pair = {};
        for (const variant of ['rules', 'jev']) {
          const rows = scores.rows.filter((row) => row.task_id === task.id && row.field === field && row.variant === variant);
          assert.equal(rows.length, 1, `Missing or duplicated prediction: ${task.id}/${field}/${variant}`);
          const choice = variant === 'rules' ? task.rule_prediction[field] : run.response.answers[field].choice;
          pair[variant] = convertSelection(rows[0], page.text, choice);
        }
        fields.push({ id: `${task.branch}.${field}`, label: labels[field], ...pair });
      }
    }
    fields.sort((a, b) => fieldOrder.indexOf(a.id) - fieldOrder.indexOf(b.id));
    assert.equal(fields.length, 9);
    const image = `${object.object_id}-p${page.page}.jpg`;
    const imagePath = `${objectRoot}/${page.image}`;
    const fileRecord = object.files.find((file) => file.path.replaceAll('\\', '/') === imagePath);
    assert.ok(fileRecord, `Missing frozen image record: ${imagePath}`);
    assert.equal(hash(await readFile(path.join(sourceRoot, imagePath))), fileRecord.sha256);
    images.push({ source: path.join(sourceRoot, imagePath), destination: path.join(destination, image) });
    pages.push({ id, objectId: object.object_id, pageNumber: page.page, text: page.text, image, sourceHash, fields });
  }
}
assert.equal(pages.length, 3);
const dataset = {
  schemaVersion: 'szd-mapping-1',
  provenance: {
    experiment: 'szd-blind-2026-09-19',
    sourceCommit: plan.source_commit,
    planSha256: freeze.plan_sha256,
    scoresSha256: hash(await readFile(path.join(sourceRoot, 'scores.json'))),
    humanApproved: false,
    model: 'jev-1.13.0',
    offsetUnit: 'utf16',
  },
  pages,
};
await mkdir(destination, { recursive: true });
for (const image of images) await copyFile(image.source, image.destination);
await writeFile(path.join(destination, 'dataset.json'), `${JSON.stringify(dataset, null, 2)}\n`, 'utf8');
console.log(`Exported ${pages.length} pages with verified source spans and scans to ${destination}`);
