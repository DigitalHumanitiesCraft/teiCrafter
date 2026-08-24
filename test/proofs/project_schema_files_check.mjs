import {
  loadProjectSchemaFiles,
  projectSchemaRequests,
} from "../../docs/js/editor/project-schema-files.js";
import { check, finish, section } from "./_assert.mjs";

section("Flat project-folder schema sets");

const schema = { relaxng: "edition.rng", xsd: null, schematron: "rules.xsl" };
const requests = projectSchemaRequests(schema);
check("RelaxNG and compiled Schematron filenames are recognized",
  requests.length === 2 && requests[0].type === "relaxng" && requests[1].type === "schematron");

const repeatedKinds = projectSchemaRequests({ schemas: [
  { type: "relaxng", path: "base.rng" },
  { type: "relaxng", path: "specialization.rng" },
  { type: "xsd", path: "exchange.xsd" },
] });
check("canonical schema sets retain repeated kinds and RNG/XSD combinations",
  repeatedKinds.length === 3
  && repeatedKinds.filter((request) => request.type === "relaxng").length === 2
  && repeatedKinds[2].type === "xsd");

const files = new Map([
  ["edition.rng", "<grammar/>"] ,
  ["rules.xsl", "<stylesheet/>"] ,
]);
const loaded = await loadProjectSchemaFiles(schema, async (name) => files.get(name) ?? null);
check("schema text is held in memory for browser validation",
  loaded["edition.rng"].text === "<grammar/>" && loaded["rules.xsl"].text === "<stylesheet/>");

const rngMain = '<grammar xmlns="http://relaxng.org/ns/structure/1.0"><include href="part.rng"/></grammar>';
const xsdMain = '<schema xmlns="http://www.w3.org/2001/XMLSchema"><import namespace="urn:part" schemaLocation="part.xsd"/></schema>';
const dependencyFiles = new Map([
  ["main.rng", rngMain],
  ["part.rng", '<grammar xmlns="http://relaxng.org/ns/structure/1.0"/>'],
  ["main.xsd", xsdMain],
  ["part.xsd", '<schema xmlns="http://www.w3.org/2001/XMLSchema" targetNamespace="urn:part"/>'],
]);
const dependencyReads = [];
const withDependencies = await loadProjectSchemaFiles({ schemas: [
  { type: "relaxng", path: "main.rng" },
  { type: "xsd", path: "main.xsd" },
] }, async (name) => {
  dependencyReads.push(name);
  return dependencyFiles.get(name) ?? null;
});
check("same-folder RNG includes and XSD imports are discovered recursively",
  withDependencies["part.rng"].text.includes("grammar")
  && withDependencies["part.xsd"].text.includes("schema")
  && dependencyReads.length === 4);

const missingDependency = await loadProjectSchemaFiles(
  { schemas: [{ type: "relaxng", path: "main.rng" }] },
  async (name) => name === "main.rng" ? rngMain : null,
);
check("a missing discovered dependency receives an explicit unavailable record",
  missingDependency["part.rng"].unavailable.includes("file is missing"));

const nestedDependency = await loadProjectSchemaFiles(
  { schemas: [{ type: "relaxng", path: "nested-main.rng" }] },
  async (name) => name === "nested-main.rng"
    ? '<grammar xmlns="http://relaxng.org/ns/structure/1.0"><include href="schema/part.rng"/></grammar>'
    : null,
);
check("a nested dependency fails closed at the project-folder capability boundary",
  nestedDependency["schema/part.rng"].unavailable.includes("nested paths are not supported"));

const unavailable = await loadProjectSchemaFiles(
  { relaxng: "schema/edition.rng", xsd: null, schematron: "missing.sch" },
  async () => null,
);
check("nested references have an explicit unavailable diagnosis",
  unavailable["schema/edition.rng"].unavailable.includes("nested paths are not supported"));
check("missing flat files have an explicit unavailable diagnosis",
  unavailable["missing.sch"].unavailable.includes("file is missing"));

const wrongExtension = await loadProjectSchemaFiles(
  { relaxng: "edition.xml", xsd: null, schematron: null },
  async () => "<schema/>",
);
check("schema kinds enforce their supported local extensions",
  wrongExtension["edition.xml"].unavailable.includes("unsupported extension"));

finish("project_schema_files_check passed");
