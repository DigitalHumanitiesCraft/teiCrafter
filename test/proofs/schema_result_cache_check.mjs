import assert from "node:assert/strict";
import { validateXmlSchemaDirect } from "../../docs/js/editor/xml-schema-runtime.js";

const source = { type: "relaxng", name: "Exact grammar" };
const grammar = '<grammar xmlns="http://relaxng.org/ns/structure/1.0"><start><element name="root"><text/></element></start></grammar>';
const url = "https://example.test/exact.rng";
const graph = (text = grammar) => ({ mainText: text, mainUrl: url, resources: new Map([[url, text]]) });
const phases = [];
const run = (raw, schemaGraph = graph(), label = source.name) => {
  phases.length = 0;
  return validateXmlSchemaDirect(raw, { ...source, name: label }, schemaGraph, (phase) => phases.push(phase));
};
assert.equal((await run("<root>exact</root>")).status, "valid");
assert.ok(phases.includes("Validating XML"));
const mutationUrl = "https://example.test/snapshot-before-await.rng";
const mutableGraph = { mainText: grammar, mainUrl: mutationUrl, resources: new Map([[mutationUrl, grammar]]) };
const duringHash = validateXmlSchemaDirect("<other/>", source, mutableGraph);
mutableGraph.mainText = grammar.replace('name="root"', 'name="other"');
mutableGraph.resources.set(mutationUrl, mutableGraph.mainText);
assert.equal((await duringHash).status, "invalid", "a caller cannot change the schema after hashing begins");
assert.equal((await validateXmlSchemaDirect("<other/>", source,
  { mainText: grammar, mainUrl: mutationUrl, resources: new Map([[mutationUrl, grammar]]) })).status, "invalid",
  "a changed graph must never poison the validator or successful-document cache under the original graph key");
assert.equal((await run("<root>exact</root>", graph(), "New display name")).name, "New display name");
assert.deepEqual(phases, ["Reusing identical XML and schema validation"]);
assert.equal((await run("<root>different</root>")).status, "valid");
assert.ok(phases.includes("Validating XML"));
assert.equal((await run("<other/>")).status, "invalid");
assert.equal((await run("<other/>")).status, "invalid");
assert.ok(phases.includes("Validating XML"));
assert.equal((await run("<root>exact</root>", graph(grammar.replace('name="root"', 'name="other"')))).status, "invalid");
assert.ok(phases.includes("Validating XML"));
const included = '<grammar xmlns="http://relaxng.org/ns/structure/1.0"><include href="part.rng"/><start><ref name="item"/></start></grammar>';
const part = '<grammar xmlns="http://relaxng.org/ns/structure/1.0"><define name="item"><element name="root"><text/></element></define></grammar>';
const dependencies = (text) => ({ mainText: included, mainUrl: url, resources: new Map([[url, included], ["https://example.test/part.rng", text]]) });
assert.equal((await run("<root>exact</root>", dependencies(part))).status, "valid");
assert.equal((await run("<root>exact</root>", dependencies(part.replace('name="root"', 'name="other"')))).status, "invalid");
await run("<root>evicted</root>");
for (let index = 0; index < 25; index++) await run(`<root>${index}</root>`);
await run("<root>evicted</root>");
assert.ok(phases.includes("Validating XML"));
console.log("Exact XML/schema graph cache: changed bytes, grammar, dependencies, labels, invalid results and bounded eviction passed.");
