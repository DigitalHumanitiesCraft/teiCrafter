import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { parseDocument, teiElementsByLocal, getXmlId } from "../../docs/js/editor/tei-document.js";
import {
  createImageAnnotation, indexWenzelsCodex, readImageAnnotation, readImageAnnotations,
  updateImageAnnotation, validateImageAnnotationPointers,
} from "../../docs/js/editor/wenzels-image-model.js";
import { validateWithSchemas } from "../../docs/js/editor/schema-validation.js";

const source = `<?xml version="1.0"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0" xmlns:x="urn:retained"><teiHeader><fileDesc><titleStmt><title>Synthetic image annotations</title></titleStmt><editionStmt><edition/><respStmt><resp>Artists</resp><persName xml:id="AA">Synthetic Artist</persName></respStmt></editionStmt><publicationStmt><p>Original fixture.</p></publicationStmt><sourceDesc><p>Fictional source.</p></sourceDesc></fileDesc></teiHeader><text><body><div><list type="image-annotations" subtype="miniatures"><item xml:id="item_1" corresp='#Image_test'><title resp="#AA">An &amp; image</title><note type="description" subtype="short"> Short
 description. </note><note type="description">Detailed description.</note><dimensions><height unit="line">4</height></dimensions><ref type="folio" target="1r" n="2-5"/><listPerson type="artists"><person corresp="#AA" instant="false"/></listPerson><listPerson type="related"><person corresp="#Person_test"/></listPerson><listPlace type="related"><place corresp="#Place_test"/></listPlace><listRef><ref type="iconclass-label" corresp="https://iconclass.org/test"><desc xml:lang="de">Beschreibung</desc><desc xml:lang="en">Description</desc></ref></listRef><objectType rend="miniature">Miniature</objectType><note type="text-relation" subtype="content">Illustrates the text.</note><note type="text-relation" subtype="statistic" corresp="#range(word_1, word_2)">Two words.</note><!-- preserve this comment --><x:data x:flag='retained'>Opaque</x:data></item></list></div></body></text></TEI>`;
const doc = parseDocument(source);
const inventory = readImageAnnotations(doc);
assert.equal(inventory.items.length, 1);
assert.deepEqual(inventory.artists, [{ id: "AA", name: "Synthetic Artist" }]);
const item = inventory.items[0];
assert.equal(item.shortDescription, "Short description.");
assert.equal(item.zone, "#Image_test");
assert.deepEqual(item.artists, ["#AA"]);
const { id, editable, issues, ...fields } = item;
assert.equal(updateImageAnnotation(doc, id, fields), doc, "A projected form is a semantic no-op.");

const changed = updateImageAnnotation(doc, id, { title: "New <title> & text" });
assert.equal(changed.raw, source.replace("An &amp; image", "New &lt;title&gt; &amp; text"));
const extensive = updateImageAnnotation(changed, id, {
  shortDescription: "Summary", description: "Full description", height: "6", heightUnit: "line",
  folio: "2v", folioLines: "5-10", objectType: "Initial", objectRend: "initial",
  textRelation: "Relation", range: "#range(word_2, word_2)", rangeDescription: "One word",
  artists: ["#AA", "#BB"], persons: ["#Person_other"], places: ["#Place_other"],
  iconclass: [{ corresp: "https://iconclass.org/other", de: "Neu", en: "New" },
    { corresp: "https://iconclass.org/addition", de: "Zusatz", en: "Addition" }],
});
const after = readImageAnnotation(extensive, id);
assert.deepEqual(after.artists, ["#AA", "#BB"]);
assert.equal(after.iconclass[1].en, "Addition");
assert.equal(after.folio, "2v");
assert.ok(extensive.raw.includes("<!-- preserve this comment --><x:data x:flag='retained'>Opaque</x:data>"));
assert.ok(extensive.raw.includes('resp="#AA"'));
assert.ok(extensive.raw.includes('instant="false"'));
const withResponsibility = updateImageAnnotation(doc, id, {
  titleResp: "#BB", descriptionResp: "#AA", descriptionAnchored: "true",
  iconclass: [{ corresp: "https://iconclass.org/test", resp: "#ICONCLASS", de: "Beschreibung", en: "Description" }],
});
assert.equal(readImageAnnotation(withResponsibility, id).descriptionAnchored, "true");
const changedLabel = updateImageAnnotation(withResponsibility, id, { iconclass: [{ de: "Neue Beschreibung" }] });
assert.equal(readImageAnnotation(changedLabel, id).iconclass[0].resp, "#ICONCLASS");
assert.equal(readImageAnnotation(changedLabel, id).iconclass[0].en, "Description");
const clearedResponsibility = updateImageAnnotation(withResponsibility, id, { titleResp: "" });
assert.ok(clearedResponsibility.raw.includes('<title>An &amp; image</title>'));
const reduced = updateImageAnnotation(extensive, id, { artists: ["#AA"], iconclass: [] });
assert.deepEqual(readImageAnnotation(reduced, id).iconclass, []);
assert.deepEqual(readImageAnnotation(reduced, id).artists, ["#AA"]);

const mixed = parseDocument(source.replace("Detailed description.", "Detailed <hi>description</hi>."));
assert.equal(readImageAnnotation(mixed, id).editable.description, false);
assert.throws(() => updateImageAnnotation(mixed, id, { description: "Would flatten markup" }), /structured/u);
assert.equal(mixed.raw, source.replace("Detailed description.", "Detailed <hi>description</hi>."));
const placesWithNotes = parseDocument(source.replace('<place corresp="#Place_test"/>', '<place><desc>Unknown location.</desc></place>'));
assert.throws(() => updateImageAnnotation(placesWithNotes, id, { places: [] }), /discard structured XML/u);
const withComment = parseDocument(source.replace("An &amp; image", "An <!-- retained --> image"));
assert.throws(() => updateImageAnnotation(withComment, id, { title: "Changed" }), /structured/u);
const ambiguous = parseDocument(source.replace("<dimensions>", "<title>Another title</title><dimensions>"));
assert.equal(readImageAnnotation(ambiguous, id).editable.title, false);
assert.throws(() => updateImageAnnotation(ambiguous, id, { title: "Changed" }), /ambiguous/u);
assert.throws(() => updateImageAnnotation(doc, id, { constructor: "Invalid" }), /Unknown/u);
assert.throws(() => updateImageAnnotation(doc, id, { title: "Illegal\u0000" }));

const created = createImageAnnotation(doc, {
  title: "Created", zone: "#Image_test", shortDescription: "Short", description: "Long",
  artists: ["#AA"], persons: ["#Person_test"], places: ["#Place_test"],
  iconclass: [{ corresp: "https://iconclass.org/test", de: "Bild", en: "Image" }],
  height: "3", heightUnit: "line", folio: "1r", objectType: "Miniature",
  range: "#range(word_1, word_2)", textRelation: "Relation",
});
assert.equal(readImageAnnotations(created.doc).items.length, 2);
assert.equal(readImageAnnotation(created.doc, created.id).title, "Created");
const originalElement = teiElementsByLocal(created.doc.root, "item").find((element) => getXmlId(element) === id);
const beforeElement = teiElementsByLocal(doc.root, "item")[0];
assert.equal(created.doc.raw.slice(originalElement.outerStart, originalElement.outerEnd), doc.raw.slice(beforeElement.outerStart, beforeElement.outerEnd));

const codex = parseDocument(`<TEI xmlns="http://www.tei-c.org/ns/1.0"><facsimile><surface><zone xml:id="Image_test" type="ImageRegion"/><zone xml:id="line_test" type="Line"/></surface></facsimile><text><body><p><w xml:id="word_1">Alpha</w><w xml:id="word_2">Beta</w></p></body></text></TEI>`);
const index = indexWenzelsCodex(codex);
assert.deepEqual(validateImageAnnotationPointers(item, index), []);
assert.equal(validateImageAnnotationPointers({ ...item, range: "#range(,)" }, index)[0].code, "invalid-range");
assert.equal(validateImageAnnotationPointers({ ...item, zone: "#line_test" }, index)[0].code, "not-image-zone");
assert.equal(validateImageAnnotationPointers({ ...item, range: "#range(word_2, word_1)" }, index)[0].code, "reversed-range");
assert.equal(validateImageAnnotationPointers({ ...item, zone: "#missing" }, index)[0].code, "missing-target");
assert.equal(validateImageAnnotationPointers(item, null)[0].code, "missing-codex");
assert.equal(codex.raw, codex.serialize());

const prefixed = parseDocument(source.replace('<TEI xmlns="http://www.tei-c.org/ns/1.0"', '<t:TEI xmlns:t="http://www.tei-c.org/ns/1.0"')
  .replace(/<(\/?)(?!t:|x:)([A-Za-z][A-Za-z0-9]*)(?=[\s/>])/gu, '<$1t:$2'));
const prefixCreated = createImageAnnotation(prefixed, { title: "Prefixed", shortDescription: "New", artists: ["#AA"] });
assert.equal(readImageAnnotation(prefixCreated.doc, prefixCreated.id).shortDescription, "New");
assert.ok(prefixCreated.doc.raw.includes('<t:note type="description" subtype="short">'));
assert.ok(prefixCreated.doc.raw.includes('<x:data x:flag=\'retained\'>Opaque</x:data>'));

const cleanSchemaSource = created.doc.raw.replace(/<x:data[^>]*>[^<]*<\/x:data>/u, "");
const schema = readFileSync(new URL("../../docs/schemas/tei-p5-4.11.0/tei_all.rng", import.meta.url), "utf8");
const validation = await validateWithSchemas(cleanSchemaSource, [{ name: "TEI All", type: "relaxng", text: schema }]);
assert.ok(validation.every((result) => result.status === "valid"), JSON.stringify(validation));

const imageFile = process.env.WB_IMAGES;
if (imageFile) {
  assert.ok(existsSync(imageFile), "WB_IMAGES must name the local image-annotation source.");
  const real = parseDocument(readFileSync(imageFile, "utf8"));
  const realItems = readImageAnnotations(real);
  assert.ok(realItems.items.length > 600);
  const first = realItems.items[0];
  const { id: realId, editable: realEditable, issues: realIssues, ...realFields } = first;
  assert.equal(updateImageAnnotation(real, realId, realFields), real, "Real data form no-op preserves every byte.");
  const edited = updateImageAnnotation(real, realId, { title: `${first.title} [local model check]` });
  assert.equal(readImageAnnotation(edited, realId).title, `${first.title} [local model check]`);
  console.log("Real local image annotations: inventory, byte-identical form no-op and in-memory title edit passed.");
} else console.log("Optional real image annotations not run; set WB_IMAGES to the local source.");
console.log("Wenzelsbibel image form, preservation, namespace, pointer and schema checks passed.");
