import assert from "node:assert/strict";
import { projectPath, projectFile, projectFiles } from "../../docs/js/editor/project-path.js";
import { loadProjectSchemaFiles } from "../../docs/js/editor/project-schema-files.js";
import { schemaSources, validateWithSchemas } from "../../docs/js/editor/schema-validation.js";

for (const path of ["../secret.rng", "/outside.rng", "C:/outside.rng", "https://example.org/x.rng", "a/%2fetc.rng", "%2e%2e/outside.rng", "a/%00.rng"]) {
  assert.throws(() => projectPath(path), undefined, path);
}
assert.equal(projectPath("schema/parts/../main.rng"), "schema/main.rng");
assert.equal(projectPath("schema/a%20b.rng"), "schema/a b.rng");
assert.equal(projectPath("schema/100%25.rng"), "schema/100%.rng");
const file = { name: "100%.rng", kind: "file" };
const calls = [];
const sub = { name: "schema", kind: "directory", async *values() { yield file; },
  async getFileHandle(name) { calls.push(name); assert.equal(name, file.name); return file; } };
const root = { async *values() { yield sub; }, async getDirectoryHandle(name) { assert.equal(name, "schema"); return sub; } };
assert.equal(await projectFile(root, "schema/100%.rng", true), file);
assert.deepEqual(calls, ["100%.rng"]);
const inventory = await projectFiles(root);
assert.equal(inventory[0].name, "schema/100%.rng");
assert.equal(inventory[0].directory, sub);

const ns = "http://relaxng.org/ns/structure/1.0";
const files = {
  "schema/100%/main schema.rng": `<grammar xmlns="${ns}"><include href="parts/child%20schema.rng"/></grammar>`,
  "schema/100%/parts/child schema.rng": `<grammar xmlns="${ns}"><start><element name="root"><empty/></element></start></grammar>`,
};
const set = { relaxng: "schema/100%25/main%20schema.rng" };
const reads = [];
const loaded = await loadProjectSchemaFiles(set, async (path) => { reads.push(path); return files[path] ?? null; });
assert.deepEqual(reads, Object.keys(files));
const sources = schemaSources(set, null, null, loaded);
const result = await validateWithSchemas("<root/>", sources);
assert.equal(result[0].status, "valid", JSON.stringify(result));
const invalid = await validateWithSchemas("<other/>", sources);
assert.equal(invalid[0].status, "invalid");
console.log("project_path_check passed: bounded traversal, filename decoding, nested RelaxNG validation");
