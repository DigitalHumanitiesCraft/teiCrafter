import { readFileSync } from "node:fs";
import {
  inspectOdd,
  inspectRelaxNg,
  inspectSchemaProfile,
  inspectSchemaSources,
  inspectXsd,
} from "../../docs/js/editor/schema-profile.js";
import { check, finish, section } from "./_assert.mjs";

section("Schema vocabulary evidence for source profiles");

const odd = inspectOdd(`<TEI xmlns="http://www.tei-c.org/ns/1.0"><teiHeader/><text><body><schemaSpec ident="custom"><moduleRef key="dictionaries" include="entry form sense"/><elementSpec ident="localEntry"><classes><memberOf key="model.entryLike"/></classes></elementSpec></schemaSpec></body></text></TEI>`);
check("ODD modules and explicit elements are inventoried", odd.modules.includes("dictionaries")
  && odd.elements.includes("entry") && odd.elements.includes("localEntry"));
check("ODD entry vocabulary permits entry authoring", odd.capabilities.entries === true);
const oddExcept = inspectOdd(`<TEI xmlns="http://www.tei-c.org/ns/1.0"><teiHeader/><text><body><schemaSpec ident="custom"><moduleRef key="dictionaries" include="entry form" except="sp entryFree"/></schemaSpec></body></text></TEI>`);
check("ODD module exclusions remain exclusions rather than positive vocabulary evidence",
  oddExcept.elements.includes("entry") && !oddExcept.elements.includes("sp")
    && oddExcept.excludedElements.includes("sp") && oddExcept.excludedElements.includes("entryFree"));

const rng = inspectRelaxNg(`<grammar xmlns="http://relaxng.org/ns/structure/1.0"><start><ref name="root"/></start><define name="root"><element name="TEI"><zeroOrMore><ref name="record"/></zeroOrMore></element></define><define name="record"><choice><element name="entry"><text/></element><element name="pb"><empty/></element></choice></define><define name="unreachable"><element name="sp"><text/></element></define></grammar>`);
check("RNG inspection follows only start-reachable defines", rng.elements.includes("entry")
  && rng.elements.includes("pb") && !rng.elements.includes("sp"));
check("a closed reachable RNG can prohibit absent capabilities", rng.capabilities.entries === true
  && rng.capabilities["speech-turns"] === false && rng.completeness === "reachable");

const partial = inspectRelaxNg(`<grammar xmlns="http://relaxng.org/ns/structure/1.0"><include href="other.rng"/><start><ref name="missing"/></start></grammar>`);
check("unresolved RNG dependencies remain explicit", partial.completeness === "unknown"
  && partial.issues.some((issue) => issue.code === "unresolved-schema-import"));

const xsd = inspectXsd(`<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"><xs:element name="TEI"/><xs:element name="correspDesc"/><xs:import schemaLocation="other.xsd"/></xs:schema>`);
check("XSD evidence is approximate and positive-only", xsd.completeness === "approximate"
  && xsd.capabilities["correspondence-metadata"] === true
  && xsd.capabilities.entries === undefined);

const teiAll = inspectRelaxNg(readFileSync("docs/schemas/tei-p5-4.11.0/tei_all.rng", "utf8"));
check("TEI All is identified as broad, never a source classifier", teiAll.issues.some((issue) => issue.code === "broad-schema"));
check("Schematron stays validation-only", inspectSchemaProfile("<schema/>", "schematron").capabilities.entries === undefined);

const includedRng = await inspectSchemaSources([{
  name: "Included vocabulary",
  type: "relaxng",
  text: `<grammar xmlns="http://relaxng.org/ns/structure/1.0"><include href="parts.rng"/><start><ref name="root"/></start></grammar>`,
  documentUrl: "https://example.test/root.rng",
  resources: {
    "https://example.test/parts.rng": `<grammar xmlns="http://relaxng.org/ns/structure/1.0"><define name="root"><element name="entry"><text/></element></define></grammar>`,
  },
}]);
check("resolved RNG includes contribute reachable vocabulary evidence",
  includedRng.capabilities.entries === true && includedRng.completeness === "reachable");

const conjunctive = await inspectSchemaSources([
  {
    name: "Entries and pages",
    type: "relaxng",
    text: `<grammar xmlns="http://relaxng.org/ns/structure/1.0"><start><choice><element name="entry"><text/></element><element name="pb"><empty/></element></choice></start></grammar>`,
  },
  {
    name: "Pages only",
    type: "relaxng",
    text: `<grammar xmlns="http://relaxng.org/ns/structure/1.0"><start><element name="pb"><empty/></element></start></grammar>`,
  },
  { name: "Project constraints", type: "schematron", text: "<schema/>" },
]);
check("multiple vocabulary schemas combine conjunctively while Schematron stays constraint evidence",
  conjunctive.capabilities.entries === false && conjunctive.capabilities.pages === true
    && conjunctive.constraints.length === 1);

const unavailable = await inspectSchemaSources([{
  name: "Missing session schema",
  type: "relaxng",
  unavailable: "The upload is unavailable.",
}]);
check("unavailable vocabulary evidence cannot prohibit a structural capability",
  unavailable.capabilities.entries === undefined && unavailable.completeness === "unknown"
    && unavailable.issues.some((issue) => issue.code === "schema-profile-unavailable"));

finish("schema_profile_check passed");
