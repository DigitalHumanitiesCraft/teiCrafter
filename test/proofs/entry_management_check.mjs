import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getXmlId, parseDocument, teiElementsByLocal, walk } from "../../docs/js/editor/tei-document.js";
import {
  applyEntryBatch, canStartEntryCollection, createEntry, deleteEntry, duplicateEntry, entryLinks, entryReferences,
  filterEntries, hasEntryWorkspace, previewEntryBatch, readEntries, resolveEntry, updateEntry,
} from "../../docs/js/editor/entry-model.js";
import { validateWithSchemas } from "../../docs/js/editor/schema-validation.js";
import { EditorSession } from "../../docs/js/editor/editor-session.js";

const dictionarySource = readFileSync("test/fixtures-synthetic/entries-30-dictionary.xml", "utf8");
const articleSource = readFileSync("test/fixtures-synthetic/entries-30-articles.xml", "utf8");
const dictionary = parseDocument(dictionarySource);
const articles = parseDocument(articleSource);
const ids = (doc) => {
  const values = [];
  walk(doc.root, (node) => { if (node.type === "element" && getXmlId(node)) values.push(getXmlId(node)); });
  return values;
};
const subtree = (doc, id) => {
  const node = readEntries(doc).find((entry) => entry.id === id).node;
  return doc.raw.slice(node.outerStart, node.outerEnd);
};

for (const [doc, kind] of [[dictionary, "dictionary"], [articles, "articles"]]) {
  assert.equal(hasEntryWorkspace(doc), true);
  assert.equal(readEntries(doc).length, 30);
  assert.deepEqual(readEntries(doc).map((item) => item.id), Array.from({ length: 30 }, (_, i) => `term_${String(i + 1).padStart(2, "0")}`));
  assert.ok(readEntries(doc).every((item) => item.kind === kind));
  assert.deepEqual(filterEntries(doc, { incomplete: true }).map((item) => item.id), ["term_10", "term_20", "term_30"]);
  assert.deepEqual(filterEntries(doc, { query: "fahre" }).map((item) => item.id), ["term_07"]);
  assert.deepEqual(filterEntries(doc, { query: "strasse" }).map((item) => item.id), ["term_23"]);
  filterEntries(doc, { sort: "headword" });
  assert.equal(doc.raw, kind === "dictionary" ? dictionarySource : articleSource, "Display sorting is source-neutral.");
  assert.equal(updateEntry(doc, "term_03", { headword: "Bede", text: "Fictional description 3.", language: "", number: "" }), doc);
  assert.equal(updateEntry(doc, "term_03", { headword: "Bede & <name>" }).raw, doc.raw.replace(
    kind === "dictionary" ? "<orth>Bede</orth>" : "<head>Bede</head>",
    kind === "dictionary" ? "<orth>Bede &amp; &lt;name&gt;</orth>" : "<head>Bede &amp; &lt;name&gt;</head>",
  ));
  assert.equal(readEntries(doc)[4].editable.text, false);
  assert.throws(() => updateEntry(doc, "term_05", { text: "Flattened" }), /structured XML/);
  assert.equal(updateEntry(doc, "term_05", { text: "Fictional structured description 5." }), doc);
  const completed = updateEntry(doc, "term_10", { text: "Supplied definition for entry ten." });
  assert.equal(readEntries(completed).find((item) => item.id === "term_10").incomplete, false);
  assert.equal(subtree(completed, "term_01"), subtree(doc, "term_01"));

  const created = createEntry(doc, { id: "new-entry", headword: "New & supplied", text: "Original <definition>." }, { after: "term_03", kind });
  const expectedFragment = kind === "dictionary"
    ? '<entry xml:id="new-entry"><form type="lemma"><orth>New &amp; supplied</orth></form><sense><def>Original &lt;definition&gt;.</def></sense></entry>'
    : '<div type="entry" xml:id="new-entry"><head>New &amp; supplied</head><p>Original &lt;definition&gt;.</p></div>';
  const oldEntry = subtree(doc, "term_03");
  assert.equal(created.doc.raw, doc.raw.replace(oldEntry, oldEntry + expectedFragment));
  assert.equal(created.id, "new-entry");
  assert.equal(readEntries(created.doc).length, 31);
  assert.equal(deleteEntry(created.doc, "new-entry").raw, doc.raw);
  assert.throws(() => createEntry(doc, { id: "detail_01", headword: "Collision" }, { after: "term_03" }), /already exists/);
  assert.throws(() => createEntry(doc, { headword: "" }, { after: "term_03" }), /Enter a headword/);

  const clone = duplicateEntry(doc, "term_01");
  assert.equal(clone.id, "term_01-copy");
  const original = subtree(doc, "term_01");
  const expectedClone = original.replace("xml:id='term_01'", "xml:id='term_01-copy'")
    .replace("xml:id='detail_01'", "xml:id='detail_01-copy'").replace("target='#detail_01 #term_02'", "target='#detail_01-copy #term_02'");
  assert.equal(clone.doc.raw, doc.raw.replace(original, original + expectedClone));
  assert.equal(subtree(clone.doc, "term_01"), original);
  assert.ok(subtree(clone.doc, clone.id).includes("<!-- retained --><egXML xmlns='http://www.tei-c.org/ns/Examples'><x:data xmlns:x='urn:example:opaque' x:flag='retained'>Opaque &amp; literal</x:data></egXML>"));
  const secondClone = duplicateEntry(clone.doc, "term_01");
  assert.equal(secondClone.id, "term_01-copy-2");
  assert.ok(ids(secondClone.doc).includes("detail_01-copy-2"));
  assert.equal(new Set(ids(secondClone.doc)).size, ids(secondClone.doc).length);
  assert.deepEqual(entryLinks(clone.doc, clone.id).map(({ id, key }) => ({ id, key })), [
    { id: "detail_01-copy", key: "term_01-copy" }, { id: "term_02", key: "term_02" },
  ]);
  assert.equal(entryReferences(doc, "term_01").length, 1);
  assert.throws(() => deleteEntry(doc, "term_01"), /Deletion is blocked.*#term_01/);
  assert.throws(() => deleteEntry(doc, "term_02"), /Deletion is blocked/);
  assert.equal(deleteEntry(clone.doc, clone.id).raw, doc.raw, "A self-reference stays inside the removed subtree.");

  const preview = previewEntryBatch(doc, readEntries(doc).map((entry) => entry.id), { field: "language", value: "de" });
  assert.equal(preview.selected, 30);
  assert.equal(preview.changed, 28);
  assert.deepEqual(preview.changes[0], { key: "term_01", headword: "Abgabe", before: "de", after: "de", changed: false });
  assert.deepEqual(preview.changes[29], { key: "term_30", headword: "Zunft", before: "", after: "de", changed: true });
  const batched = applyEntryBatch(doc, preview);
  const expected = kind === "dictionary"
    ? doc.raw.replace(/<entry xml:id='term_(?!0[12]')[^']+'(?=>)/g, (tag) => tag.replace("<entry", '<entry xml:lang="de"'))
    : doc.raw.replace(/<div type='entry' xml:id='term_(?!0[12]')[^']+'(?=>)/g, (tag) => tag.replace("<div", '<div xml:lang="de"'));
  assert.equal(batched.raw, expected);
  const session = new EditorSession((raw) => ({ doc: parseDocument(raw) }));
  session.load({ doc });
  session.replace({ doc: batched }, "Batch language");
  assert.equal(session.history.length, 1);
  assert.equal(session.undo().state.doc.raw, doc.raw);
  assert.equal(session.canUndo(), false);
  assert.equal(session.redo().state.doc.raw, expected);
  assert.equal(applyEntryBatch(batched, previewEntryBatch(batched, ["term_01", "term_30"], { field: "language", value: "de" })), batched);
  const empty = previewEntryBatch(doc, ["term_01", "term_02"], { field: "language", value: "" });
  assert.equal(applyEntryBatch(doc, empty).raw, doc.raw.replaceAll(" xml:lang='de'", ""));
  assert.throws(() => applyEntryBatch(batched, preview), /stale/);
  assert.throws(() => applyEntryBatch(parseDocument(doc.raw), preview), /stale/);
  assert.throws(() => applyEntryBatch(doc, { ...preview }), /stale/);
  assert.throws(() => { preview.changes[0].after = "tampered"; }, TypeError);
  assert.throws(() => previewEntryBatch(doc, ["term_01", "term_01"], { field: "number", value: "1" }), /more than once/);
  assert.throws(() => previewEntryBatch(doc, ["missing"], { field: "language", value: "de" }), /missing, ambiguous/);
  assert.throws(() => previewEntryBatch(doc, ["term_01"], { field: "id", value: "rewritten" }), /only entry language/);
  assert.throws(() => previewEntryBatch(doc, ["term_01"], { field: "language", value: "not a language" }), /language tag/);
  assert.throws(() => updateEntry(doc, "term_01", { headword: "Illegal\u0000" }));
  assert.throws(() => updateEntry(doc, "missing", { headword: "Absent" }), /missing, ambiguous/);
  assert.throws(() => updateEntry(batched, resolveEntry(doc, "term_01"), { headword: "Stale" }), /older document/);
  for (const operation of [
    () => updateEntry(doc, "term_01", { headword: "Blocked" }, { readOnly: true }),
    () => createEntry(doc, { headword: "Blocked" }, { after: "term_01", readOnly: true }),
    () => duplicateEntry(doc, "term_01", { readOnly: true }),
    () => deleteEntry(doc, "term_03", { readOnly: true }),
    () => applyEntryBatch(doc, preview, { readOnly: true }),
  ]) assert.throws(operation, /Read-only/);
}

const wrapped = (body) => parseDocument(`<TEI xmlns='http://www.tei-c.org/ns/1.0'><text><body>${body}</body></text></TEI>`);
const lexical = wrapped(`<entry xml:id='lex' xml:lang='' n=''><form><orth><![CDATA[A & B]]></orth></form><sense><def>A &#38; B</def></sense></entry>`);
assert.equal(updateEntry(lexical, "lex", { headword: "A & B", text: "A & B", language: "", number: "" }), lexical);
assert.equal(applyEntryBatch(lexical, previewEntryBatch(lexical, ["lex"], { field: "language", value: "" })), lexical);
assert.equal(updateEntry(lexical, "lex", { text: "Changed" }).raw, lexical.raw.replace("A &#38; B", "Changed"));
const ambiguous = wrapped("<entry xml:id='dup'/><entry xml:id='dup'/>");
assert.throws(() => resolveEntry(ambiguous, "dup"), /ambiguous/);
const duplicateIdAttribute = wrapped("<entry xml:id='a' xml:id='b'/>");
assert.throws(() => duplicateEntry(duplicateIdAttribute, "a"), /ambiguous/);
assert.throws(() => deleteEntry(duplicateIdAttribute, "a"), /ambiguous/);
const duplicateHeaderId = parseDocument("<TEI xmlns='http://www.tei-c.org/ns/1.0' xml:id='a' xml:id='reserved'><text><body/></text></TEI>");
assert.throws(() => createEntry(duplicateHeaderId, { id: "reserved", headword: "Collision" }, { kind: "dictionary" }), /already exists/);
const duplicateLangAttribute = wrapped("<entry xml:id='a' xml:lang='de' xml:lang='en'/>");
assert.throws(() => updateEntry(duplicateLangAttribute, "a", { language: "la" }), /attribute target is ambiguous/);
assert.throws(() => duplicateEntry(duplicateLangAttribute, "a"), /ambiguous duplicate attributes/);
assert.equal(updateEntry(duplicateLangAttribute, "a", { language: "de" }), duplicateLangAttribute);
assert.throws(() => applyEntryBatch(duplicateLangAttribute, previewEntryBatch(duplicateLangAttribute, ["a"], { field: "language", value: "la" })), /attribute target is ambiguous/);
assert.throws(() => duplicateEntry(wrapped("<entry xml:id='one'><sense xml:id='dup'/></entry><entry xml:id='two'><sense xml:id='dup'/></entry>"), "one"), /descendant identifier dup is ambiguous/);
assert.throws(() => deleteEntry(wrapped("<entry xml:id='one'><sense xml:id='inside' xml:id='second'/></entry><entry xml:id='two'><xr><ref target='#second'/></xr></entry>"), "one"), /#second/);
const manySenses = wrapped("<entry xml:id='many'><form><orth>Multiple</orth></form><sense><def>One</def></sense><sense><def>Two</def></sense></entry>");
assert.throws(() => updateEntry(manySenses, "many", { text: "Collapsed" }), /ambiguous targets/);
const nestedReference = wrapped("<entry xml:id='one'><sense xml:id='inside'/></entry><entry xml:id='two'><xr><ref target='#inside'/></xr></entry>");
assert.throws(() => deleteEntry(nestedReference, "one"), /#inside/);
const encodedReference = wrapped("<entry xml:id='one'><sense xml:id='inside'><xr><ref target='#ins%69de #two'/></xr></sense></entry><entry xml:id='two'><xr><ref target='#ins%69de'/></xr></entry>");
assert.throws(() => deleteEntry(encodedReference, "one"), /#ins%69de/);
assert.deepEqual(entryLinks(encodedReference, "two").map(({ id, key }) => ({ id, key })), [{ id: "inside", key: "one" }]);
const encodedClone = duplicateEntry(encodedReference, "one");
assert.ok(subtree(encodedClone.doc, "one-copy").includes("target='#inside-copy #two'"));
assert.equal(subtree(encodedClone.doc, "one"), subtree(encodedReference, "one"));
const inheritedNs = parseDocument("<t:TEI xmlns:t='http://www.tei-c.org/ns/1.0' xmlns:x='urn:foreign'><t:text><t:body><x:entry xml:id='foreign'>Opaque</x:entry><t:entry xml:id='one'><t:form><t:orth>One</t:orth></t:form></t:entry></t:body></t:text></t:TEI>");
assert.equal(readEntries(inheritedNs).length, 1);
const namespaced = createEntry(inheritedNs, { headword: "Two", text: "Body" }, { after: "one" }).doc;
assert.ok(namespaced.raw.includes('<t:entry xml:id="entry"><t:form type="lemma"><t:orth>Two</t:orth></t:form><t:sense><t:def>Body</t:def></t:sense></t:entry>'));
assert.ok(namespaced.raw.includes("<x:entry xml:id='foreign'>Opaque</x:entry>"));
assert.equal(teiElementsByLocal(namespaced.root, "entry").length, 2);
const body = wrapped("");
assert.equal(canStartEntryCollection(body), true);
assert.equal(canStartEntryCollection(wrapped("<!-- retained --> \n")), true);
assert.equal(canStartEntryCollection(wrapped("Plain text")), false);
assert.equal(canStartEntryCollection(wrapped("<p>Paragraph</p>")), false);
assert.throws(() => createEntry(wrapped("<p>Paragraph</p>"), { headword: "No inferred collection" }, { kind: "dictionary" }), /empty document body/);
const emptyEntry = wrapped("<entry xml:id='empty'/>");
assert.equal(updateEntry(emptyEntry, "empty", { headword: "Filled", text: "Definition" }).raw,
  emptyEntry.raw.replace("<entry xml:id='empty'/>", "<entry xml:id='empty'><form type=\"lemma\"><orth>Filled</orth></form><sense><def>Definition</def></sense></entry>"));
assert.throws(() => createEntry(body, { headword: "Undeclared" }), /explicitly/);
assert.equal(readEntries(createEntry(body, { headword: "First" }, { kind: "articles" }).doc)[0].kind, "articles");
const emptyWithReservedId = parseDocument("<TEI xmlns='http://www.tei-c.org/ns/1.0' xml:id='entry'><text><body/></text></TEI>");
assert.equal(createEntry(emptyWithReservedId, { headword: "First" }, { kind: "dictionary" }).id, "entry-2");
const anonymous = wrapped("<entry><form><orth>Anonymous</orth></form></entry>");
const withoutId = duplicateEntry(anonymous, readEntries(anonymous)[0]);
assert.equal(withoutId.id, "entry-copy");
assert.equal(readEntries(withoutId.doc).length, 2);
const pointerForms = wrapped("<entry xml:id='original' corresp='#original' next='#outside'><xr><ref target='other.xml#original #original'/></xr></entry>");
assert.ok(duplicateEntry(pointerForms, "original").doc.raw.includes("target='other.xml#original #original-copy'"));
assert.throws(() => duplicateEntry(wrapped("<entry xml:id='original' corresp='#original/path'/>"), "original"), /compound syntax/);
assert.throws(() => duplicateEntry(wrapped("<entry xml:id='original' xmlns:x='urn:opaque' x:custom='#original'/>"), "original"), /unmapped attribute/);
assert.throws(() => duplicateEntry(wrapped("<entry xml:id='original' xml:base='https://example.org/elsewhere.xml' corresp='#original'/>"), "original"), /XML base/);
assert.throws(() => createEntry(dictionary, { headword: "Wrong collection" }, { after: "term_01", kind: "articles" }), /must match/);

const schema = { name: "TEI All 4.11.0", type: "relaxng", text: readFileSync("docs/schemas/tei-p5-4.11.0/tei_all.rng", "utf8") };
for (const doc of [dictionary, articles]) {
  let changed = createEntry(doc, { headword: "Editorial addition", text: "Supplied definition." }, { after: "term_03" }).doc;
  changed = duplicateEntry(changed, "term_01").doc;
  changed = updateEntry(changed, "term_10", { text: "A completed definition." });
  changed = applyEntryBatch(changed, previewEntryBatch(changed, readEntries(changed).map((entry) => entry.key), { field: "language", value: "de" }));
  const result = await validateWithSchemas(changed.raw, [schema]);
  assert.equal(result[0].status, "valid", JSON.stringify(result));
}
console.log("entry_management_check passed: both thirty-entry encodings, independent byte expectations, nested ID references, deletion guards, scoped atomic previews, stale/read-only refusal and TEI All output.");
