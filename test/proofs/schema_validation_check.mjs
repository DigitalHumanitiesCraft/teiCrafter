import fs from "node:fs";
import { check, finish, section } from "./_assert.mjs";
import {
  DEFAULT_SCHEMA,
  schemaGate,
  schemaRuntimeNotes,
  schemaSetKey,
  schemaSources,
  validateWithSchemas,
} from "../../docs/js/editor/schema-validation.js";
import { normalizeSchemaSet } from "../../docs/js/editor/schema-set.js";

const valid = fs.readFileSync("test/fixtures-synthetic/wb-synthetic-folio.xml", "utf8");
const invalid = valid.replace("<teiHeader>", "<notAHeader>").replace("</teiHeader>", "</notAHeader>");

const fallback = schemaSources(null);
section("Browser schema validation");
check("no project schema selects the pinned TEI All fallback", fallback[0].name === DEFAULT_SCHEMA.name);
const schemaSet = normalizeSchemaSet({
  schemas: [
    { type: "relaxng", path: "project.rng", name: "Project structure" },
    { type: "schematron", path: "project.sch" },
    { type: "xsd", path: "project.xsd" },
  ],
});
check("the canonical parser seam preserves an ordered multi-schema set",
  schemaSet.declared && schemaSet.entries.length === 3
  && schemaSet.entries[0].name === "Project structure"
  && schemaSet.entries[2].type === "xsd");
const setFromSet = normalizeSchemaSet(new Set([
  { type: "relaxng", path: "one.rng" },
  { type: "relaxng", path: "two.rng" },
]));
check("runtime schema sets accept Set collections without dropping repeated kinds",
  setFromSet.entries.length === 2 && setFromSet.entries.every((entry) => entry.type === "relaxng"));
const legacy = { relaxng: "legacy.rng" };
check("legacy schema objects remain accepted", normalizeSchemaSet(legacy).entries[0].path === "legacy.rng");
check("served project schema paths resolve against the manifest directory",
  schemaSources(legacy, null, "https://example.org/project/")[0].url === "https://example.org/project/legacy.rng");
const local = schemaSources(legacy, null, null, { "legacy.rng": { text: "<grammar/>" } });
check("a folder-loaded schema overrides URL loading with its local text",
  local[0].text === "<grammar/>" && !local[0].url);
const missing = schemaSources(legacy, null, null, {});
check("a missing folder schema becomes unavailable instead of a relative fetch",
  missing[0].unavailable.includes("was not loaded from the project folder") && !missing[0].url);
const malformedSet = schemaSources({ schemas: "project.rng" });
check("a malformed declared set fails closed instead of selecting TEI All",
  malformedSet.length === 1 && malformedSet[0].type === "configuration" && malformedSet[0].unavailable);

const tinySchema = `<?xml version="1.0"?>
<grammar xmlns="http://relaxng.org/ns/structure/1.0">
  <start><element name="root"><empty/></element></start>
</grammar>`;
const source = [{ name: "tiny.rng", type: "relaxng", text: tinySchema }];
const ok = await validateWithSchemas("<root/>", source);
check("RelaxNG accepts a matching document in the browser engine", ok[0].status === "valid");
const okSet = await validateWithSchemas("<root/>", new Set(source));
check("validation and gating accept Set collections of normalized sources",
  okSet[0].status === "valid" && schemaGate(new Set(okSet)).ok);
check("a session Set replaces the configured project set without reordering",
  schemaSources(legacy, new Set(source))[0] === source[0]);
const bad = await validateWithSchemas("<other/>", source);
check("RelaxNG rejects a non-matching document in the browser engine", bad[0].status === "invalid");
check("invalid schema result carries diagnostics", bad[0].diagnostics.length > 0);

const otherSchema = tinySchema.replace('name="root"', 'name="other"');
const multi = await validateWithSchemas("<root/>", [
  source[0],
  { name: "other.rng", type: "relaxng", text: otherSchema },
]);
check("every schema in a normalized set executes", multi.length === 2
  && multi[0].status === "valid" && multi[1].status === "invalid");
check("one invalid result blocks a multi-schema output gate",
  !schemaGate(multi).ok && schemaGate(multi).invalid.length === 1);
check("one unavailable result blocks a multi-schema output gate",
  !schemaGate([{ name: "one", status: "valid" }, { name: "two", status: "unavailable" }]).ok);
check("only a non-empty all-valid result authorizes output",
  schemaGate([{ name: "one", status: "valid" }, { name: "two", status: "valid" }]).ok
  && !schemaGate([]).ok);

const rngMain = `<?xml version="1.0"?>
<grammar xmlns="http://relaxng.org/ns/structure/1.0">
  <include href="content.rng"/>
  <start><ref name="document"/></start>
</grammar>`;
const rngContent = `<?xml version="1.0"?>
<grammar xmlns="http://relaxng.org/ns/structure/1.0">
  <define name="document"><element name="root"><text/></element></define>
</grammar>`;
const rngIncludedSources = schemaSources(
  { schemas: [{ type: "relaxng", path: "main.rng" }] },
  null,
  null,
  { "main.rng": { text: rngMain }, "content.rng": { text: rngContent } },
);
const rngIncluded = await validateWithSchemas("<root>included</root>", rngIncludedSources);
check("RelaxNG include resolves from an opened flat project schema set",
  rngIncluded[0].status === "valid");
const rngMissing = await validateWithSchemas("<root>included</root>", schemaSources(
  { schemas: [{ type: "relaxng", path: "main.rng" }] },
  null,
  null,
  { "main.rng": { text: rngMain } },
));
check("a missing RelaxNG include is unavailable and blocks output",
  rngMissing[0].status === "unavailable" && !schemaGate(rngMissing).ok);

const xsdMain = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:m="urn:main" xmlns:e="urn:external"
  targetNamespace="urn:main" elementFormDefault="qualified">
  <xs:include schemaLocation="types.xsd"/>
  <xs:import namespace="urn:external" schemaLocation="external.xsd"/>
  <xs:element name="root">
    <xs:complexType>
      <xs:sequence><xs:element ref="e:item"/></xs:sequence>
      <xs:attribute name="code" type="m:Code" use="required"/>
    </xs:complexType>
  </xs:element>
</xs:schema>`;
const xsdTypes = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" targetNamespace="urn:main">
  <xs:simpleType name="Code"><xs:restriction base="xs:string"><xs:pattern value="[A-Z]{2}"/></xs:restriction></xs:simpleType>
</xs:schema>`;
const xsdExternal = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" targetNamespace="urn:external" elementFormDefault="qualified">
  <xs:element name="item" type="xs:string"/>
</xs:schema>`;
const xsdSources = schemaSources(
  { schemas: [{ type: "xsd", path: "main.xsd" }] },
  null,
  null,
  {
    "main.xsd": { text: xsdMain },
    "types.xsd": { text: xsdTypes },
    "external.xsd": { text: xsdExternal },
  },
);
const xsdIncluded = await validateWithSchemas(
  '<m:root xmlns:m="urn:main" xmlns:e="urn:external" code="AB"><e:item>ok</e:item></m:root>',
  xsdSources,
);
check("XSD include and import share one in-memory dependency graph",
  xsdIncluded[0].status === "valid");
const xsdInvalid = await validateWithSchemas(
  '<m:root xmlns:m="urn:main" xmlns:e="urn:external" code="lower"><e:item>ok</e:item></m:root>',
  xsdSources,
);
check("an included XSD datatype participates in validation", xsdInvalid[0].status === "invalid");

const rawSchematron = [{
  name: "raw.sch",
  type: "schematron",
  text: '<schema xmlns="http://purl.oclc.org/dsdl/schematron"><pattern><rule context="root"><assert test="@ok">required</assert></rule></pattern></schema>',
}];
const rawWithoutBrowser = await validateWithSchemas("<root/>", rawSchematron);
check("raw Schematron fails closed when browser XPath is unavailable",
  rawWithoutBrowser[0].status === "unavailable");
const runtimeNotes = schemaRuntimeNotes([...rngIncludedSources, ...xsdSources, ...rawSchematron]);
check("runtime notes expose dependency and raw Schematron limits",
  runtimeNotes.some((note) => note.includes("Missing dependencies"))
  && runtimeNotes.some((note) => note.includes("advanced match patterns")));
check("schema-set identity includes in-memory dependency bytes",
  schemaSetKey(rngIncludedSources) !== schemaSetKey(schemaSources(
    { schemas: [{ type: "relaxng", path: "main.rng" }] },
    null,
    null,
    { "main.rng": { text: rngMain }, "content.rng": { text: rngContent.replace("<text/>", "<empty/>") } },
  )));

const vendoredSchema = fs.readFileSync("docs/schemas/tei-p5-4.11.0/tei_all.rng", "utf8");
const vendoredSource = [{ ...fallback[0], text: vendoredSchema }];
const defaultResult = await validateWithSchemas(valid, vendoredSource);
check("vendored TEI All validates the synthetic TEI fixture", defaultResult[0].status === "valid");
const invalidResult = await validateWithSchemas(invalid, vendoredSource);
check("vendored TEI All rejects structurally invalid TEI", invalidResult[0].status === "invalid");

finish("schema_validation_check passed");
