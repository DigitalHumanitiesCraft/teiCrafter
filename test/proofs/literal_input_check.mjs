import assert from "node:assert/strict";
import { parseEdition, editCellCore } from "../../docs/js/editor/edition.js";
import { parseDocument, firstByLocal, editAttrValue, decodeEntities, escapeText } from "../../docs/js/editor/tei-document.js";

const raw = '<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p>Original</p></body></text></TEI>';
for (const value of ['Literal &amp; and &#65;', '&unknown;', 'A & B < C', '𐍈 e\u0301', 'line\rbreak']) {
  const state = parseEdition(raw);
  const edited = editCellCore(state, state.cells[0].id, value);
  assert.equal(edited.cells[0].text, value);
  assert.equal(parseEdition(edited.raw).cells[0].text, value);
  assert.equal(editCellCore(edited, edited.cells[0].id, value), edited);
}
assert.equal(decodeEntities('&#38;#65;'), '&#65;');
for (const value of ['&amp;', 'line\nsecond\tcolumn\rreturn', '"quoted"']) {
  const doc = parseDocument('<x a="old"/>');
  const changed = editAttrValue(doc, firstByLocal(doc.root, 'x').attrs[0], value);
  assert.equal(firstByLocal(changed.root, 'x').attrs[0].value, value);
}
assert.throws(() => escapeText('\u0000'), /XML cannot represent/);
assert.throws(() => escapeText('\ud800'), /XML cannot represent/);
console.log('PASS: literal characters, attribute whitespace, entity boundaries and XML character legality.');
