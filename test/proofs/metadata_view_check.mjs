import assert from "node:assert/strict";

import { parseDocument } from "../../docs/js/editor/tei-document.js";
import { applyMetadataEdits, readMetadataFields } from "../../docs/js/editor/metadata-view.js";

const raw = `<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <teiHeader>
    <fileDesc>
      <titleStmt><title>A &amp; B</title><editor>Editor One</editor></titleStmt>
      <editionStmt><edition><date>2026-08-24</date></edition></editionStmt>
      <publicationStmt><publisher>Publisher</publisher><pubPlace>Graz</pubPlace><date>2026</date><idno type="PID">o:test</idno></publicationStmt>
      <sourceDesc><msDesc><msIdentifier><repository>Archive</repository><collection>Books</collection><idno>MS 1</idno><msName>Book</msName></msIdentifier></msDesc></sourceDesc>
    </fileDesc>
    <encodingDesc><projectDesc><p>Project <ref target="x">linked</ref></p></projectDesc></encodingDesc>
    <revisionDesc><change></change></revisionDesc>
    <x:projectData xmlns:x="urn:project" status='draft' data="A &amp; B">
      <x:simple xml:lang="de"> Keep &amp; exact </x:simple>
      <x:whitespace>   </x:whitespace>
      <x:mixed>Before <x:token key="1">inside</x:token> after</x:mixed>
      <x:empty flag="yes"/>
    </x:projectData>
  </teiHeader>
  <text><body><pb/><p>Text</p></body></text>
</TEI>`;

const doc = parseDocument(raw);
const fields = readMetadataFields(doc);
const byKey = (key) => fields.find((field) => field.key === key);
const byPath = (suffix) => fields.find((field) => field.path.endsWith(suffix));

assert.equal(byKey("title").value, "A & B");
assert.equal(byKey("title").editable, true);
assert.equal(byKey("publicationId").label, "Identifier (PID)");
assert.equal(byKey("project").editable, false, "mixed content stays XML-only");
assert.equal(byKey("project").value, "Project linked");
assert.equal(byKey("change").editable, true, "an empty paired element is editable");

const header = doc.root.children.find((node) => node.type === "element").children
  .find((node) => node.type === "element" && node.localName === "teiHeader");
const elements = [];
const attributes = [];
function inventory(node) {
  elements.push(node);
  attributes.push(...(node.attrs || []));
  for (const child of node.children || []) {
    if (child.type === "element") inventory(child);
  }
}
inventory(header);
assert.equal(fields.filter((field) => field.kind === "text").length, elements.length,
  "every header element has one inventory projection");
assert.equal(fields.filter((field) => field.kind === "attribute").length, attributes.length,
  "every header attribute has one inventory projection");

const customSimple = byPath("x:projectData[1]/x:simple[1]");
const customMixed = byPath("x:projectData[1]/x:mixed[1]");
const whitespaceOnly = byPath("x:projectData[1]/x:whitespace[1]");
const customData = byPath("x:projectData[1]/@data");
const customStatus = byPath("x:projectData[1]/@status");
const namespaceDeclaration = byPath("x:projectData[1]/@xmlns:x");
assert.equal(customSimple.editable, true, "project-specific simple text is editable");
assert.equal(customSimple.value, "Keep & exact");
assert.equal(customMixed.editable, false, "project-specific mixed content stays XML-only");
assert.equal(whitespaceOnly.value, "", "whitespace-only paired content projects as empty text");
assert.equal(customData.value, "A & B", "generic attributes expose decoded values safely");
assert.equal(customData.editable, true);
assert.equal(namespaceDeclaration.editable, false, "namespace declarations stay XML-only");

const noOp = applyMetadataEdits(doc, fields, new Map([
  [byKey("title").id, "A & B"],
  [customData.id, "A & B"],
  [customSimple.id, "Keep & exact"],
]));
assert.equal(noOp, doc, "a semantic no-op preserves the original entity spelling and object");

const values = new Map([
  [byKey("title").id, "A <new> title"],
  [byKey("publisher").id, "New Publisher"],
  [byKey("change").id, "Metadata corrected"],
  [byKey("project").id, "must be ignored"],
  [customSimple.id, "Project <value> & exact"],
  [customData.id, 'A "quoted" & more'],
  [customStatus.id, "editor's"],
  [whitespaceOnly.id, "Added"],
  [customMixed.id, "must also be ignored"],
]);
const edited = applyMetadataEdits(doc, fields, values);
const expected = raw
  .replace("A &amp; B", "A &lt;new&gt; title")
  .replace("Publisher</publisher>", "New Publisher</publisher>")
  .replace("<change></change>", "<change>Metadata corrected</change>")
  .replace(" Keep &amp; exact ", " Project &lt;value&gt; &amp; exact ")
  .replace("<x:whitespace>   </x:whitespace>", "<x:whitespace>Added   </x:whitespace>")
  .replace('data="A &amp; B"', 'data="A &quot;quoted&quot; &amp; more"')
  .replace("status='draft'", "status='editor&apos;s'");
assert.equal(edited.raw, expected, "only the selected simple-text spans change");
assert.equal(readMetadataFields(edited).find((field) => field.key === "title").value, "A <new> title");
assert.ok(edited.raw.includes('<x:mixed>Before <x:token key="1">inside</x:token> after</x:mixed>'),
  "structured project metadata is byte-identical");

const decoy = parseDocument(`<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <x:teiHeader xmlns:x="urn:foreign"><x:title>Foreign decoy</x:title></x:teiHeader>
  <teiHeader><fileDesc><titleStmt><title>Legitimate header</title></titleStmt></fileDesc></teiHeader>
  <text><body/></text>
</TEI>`);
const decoyFields = readMetadataFields(decoy);
assert.equal(decoyFields.find((field) => field.key === "title").value, "Legitimate header",
  "inventory selects the document TEI namespace instead of a foreign same-local-name decoy");
assert.equal(decoyFields.some((field) => field.value === "Foreign decoy"), false);

console.log("metadata view: projection, mixed-content guard and byte-faithful apply PASS");
