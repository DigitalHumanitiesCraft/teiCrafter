// Read-only reproductions for the project assessment. Run from any directory.
import { parseEdition, editCellCore } from '../docs/js/editor/edition.js';
import { parseDocument, firstTeiByLocal } from '../docs/js/editor/tei-document.js';
import { setFolioReviewed, reviewPageSummary } from '../docs/js/editor/review-progress.js';
import { confirmConstruct } from '../docs/js/editor/proposal-review.js';
import { createProjectFolder } from '../docs/js/editor/project-folder.js';
import { createPageImages } from '../docs/js/editor/page-images.js';

const header = '<teiHeader><fileDesc><titleStmt><title>Audit fixture</title></titleStmt><publicationStmt><p>Synthetic test</p></publicationStmt><sourceDesc><p>Synthetic source</p></sourceDesc></fileDesc></teiHeader>';
const documentOf = content => `<TEI xmlns="http://www.tei-c.org/ns/1.0">${header}<text><body>${content}</body></text></TEI>`;
const findings = [];

for (const typed of ['Literal &amp;', 'Literal &#65;', '&unknown;']) {
  const original = parseEdition(documentOf('<p>Original</p>'));
  const edited = editCellCore(original, original.cells[0].id, typed);
  findings.push({ case: 'literal-text-entry', typed, displayed: edited.cells[0].text, xml: edited.raw.match(/<body>(.*?)<\/body>/s)[1] });
}

for (const content of [
  '<p>un<hi>klar</hi>!</p>',
  '<p><choice><orig>olde</orig><reg>old</reg></choice></p>',
  '<p><app><lem>alpha</lem><rdg>beta</rdg></app></p>',
  '<p><![CDATA[Visible text]]></p>',
]) {
  const state = parseEdition(documentOf(content));
  findings.push({ case: 'reading-projection', content, cells: state.cells.map(c => ({ text: c.text, joinLeft: c.joinLeft })), sourcePreserved: state.raw === documentOf(content) });
}

const frontBack = `<TEI xmlns="http://www.tei-c.org/ns/1.0">${header}<text><front><div><p>FRONT</p></div></front><body><p>BODY</p></body><back><div><p>BACK</p></div></back></text></TEI>`;
findings.push({ case: 'front-body-back', cells: parseEdition(frontBack).cells.map(c => c.text) });

let reviewed = parseEdition(documentOf('<pb xml:id="page1"/><p>Original</p>'));
reviewed = setFolioReviewed(reviewed, 0, true);
const before = reviewPageSummary(reviewed).reviewedPages;
reviewed = editCellCore(reviewed, reviewed.cells[0].id, 'Changed after review');
findings.push({ case: 'review-after-edit', before, after: reviewPageSummary(reviewed).reviewedPages });

for (const resp of ['#ai', '#ai #editor']) {
  const original = parseDocument(documentOf(`<p><hi resp="${resp}">Proposed</hi></p>`));
  const changed = confirmConstruct(original, firstTeiByLocal(original.root, 'hi'));
  findings.push({ case: 'confirm-provenance', resp, changed: changed !== original, remainingMarkup: changed.raw.match(/<hi[^>]*>/)[0] });
}

// No native handles or files are touched. The stub represents an existing target.
const calls = [];
const existingHandle = { name: 'letter.xml' };
const dir = { getFileHandle: async (name, options) => { calls.push({ name, options }); return existingHandle; } };
const app = { saveTarget: { dir, name: 'letter.xml' }, fileHandle: null, fileSnapshot: null };
const noop = () => {};
const folder = createProjectFolder({ app, setStatus: noop, setDirty: noop, load: noop, showPanel: noop, updatePanels: noop, teiVocabularyLine: noop, getProjectPanelHost: noop });
await folder.finalizeSaveTarget();
findings.push({ case: 'first-save-existing-target', calls, adoptedExistingHandle: app.fileHandle === existingHandle, snapshot: app.fileSnapshot });

let imageContents = 'existing image';
const imageApp = { state: { surfaces: [{ graphic: 'page.jpg' }] }, pageImages: new Map([['page.jpg', { blob: 'new image', persisted: false }]]) };
const images = createPageImages({ app: imageApp, rerenderPanel: noop });
await images.persist({ getFileHandle: async () => ({ createWritable: async () => ({ write: async value => { imageContents = value; }, close: async () => {} }) }) });
findings.push({ case: 'image-name-collision-stub', finalContents: imageContents });

console.log(JSON.stringify(findings, null, 2));
