import assert from "node:assert/strict";
import { createProjectOutputController } from "../../docs/js/editor/project-output-controller.js";
import { captureProjectDocuments, snapshotProjectDocument } from "../../docs/js/editor/project-documents.js";
import { decodeProjectBundle } from "../../docs/js/editor/project-bundle.js";

const raw = '<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p>A&amp;B</p></body></text></TEI>';
const app = { state: { doc: { raw } }, docName: "codex.xml", fileEncoding: { bom: true }, dirty: true,
  project: { id: "wenzelsbibel", workspace: "wenzelsbibel", name: "Proof" }, pageImages: new Map() };
const snapshot = captureProjectDocuments(app, { customSchema: { type: "relaxng", name: "Codex only", text: "codex schema" } });
snapshot.documents[0].role = "codex";
const companion = snapshotProjectDocument({ ...app, docName: "registers.xml", fileEncoding: { bom: false } }, null);
companion.role = "registers"; snapshot.documents.push(companion);
function harness(validate, overrides = {}) {
  const downloads = [], statuses = [], busy = [], opened = [];
  let revision = 0;
  const ctx = { capture: () => { const captured = revision; return { snapshot, isCurrent: () => captured === revision }; },
    resolveStaged: () => true, persist: async () => true, status: (message) => statuses.push(message), busy: (value) => busy.push(value),
    download: (...args) => downloads.push(args), restore: async (record) => opened.push(record), ...overrides };
  return { controller: createProjectOutputController(ctx, { validate }), downloads, statuses, busy, opened, change: () => { revision++; } };
}
const calls = [];
const valid = async (xml, sources, { signal }) => {
  assert.equal(signal.aborted, false); calls.push({ raw: xml, sources });
  return sources.map((source) => ({ name: source.name, status: "valid", diagnostics: [] }));
};
const positive = harness(valid);
assert.equal(await positive.controller.download(), true);
assert.equal(positive.downloads.length, 1);
assert.deepEqual(positive.busy, [true, false]);
assert.equal(calls[0].sources.length, 1);
assert.equal(calls[0].sources[0].text, "codex schema");
assert.equal(calls[1].sources.length, 2, "the companion retains its own Wenzelsbibel project schema set");
assert.equal(calls[1].sources.some((source) => source.text === "codex schema"), false);
assert.deepEqual(decodeProjectBundle(positive.downloads[0][0]), snapshot);
await positive.controller.open(new Blob([positive.downloads[0][0]]));
assert.equal(positive.opened.length, 1);
assert.equal(positive.opened[0].projectDocuments.documents.length, 2);
assert.equal(positive.opened[0].authorization, undefined);
const refusedOpen = harness(valid, { restore: async () => false });
assert.equal(await refusedOpen.controller.open(new Blob([positive.downloads[0][0]])), false);

let invocation = 0;
const invalid = harness(async () => [{ status: ++invocation === 1 ? "valid" : "invalid", diagnostics: [{ message: "invalid companion marker" }] }]);
assert.equal(await invalid.controller.download(), false);
assert.equal(invalid.downloads.length, 0);
assert.match(invalid.statuses.at(-1), /registers.xml: invalid companion marker/);
const unavailable = harness(async () => [{ status: "unavailable", diagnostics: [{ message: "missing dependency" }] }]);
assert.equal(await unavailable.controller.download(), false);
assert.match(unavailable.statuses.at(-1), /missing dependency/);
assert.equal(unavailable.downloads.length, 0);
const empty = harness(async () => []);
assert.equal(await empty.controller.download(), false);
assert.equal(empty.downloads.length, 0);
const staged = harness(valid, { resolveStaged: () => false });
assert.equal(await staged.controller.download(), false);
assert.equal(staged.downloads.length, 0);
assert.deepEqual(staged.busy, []);

let release;
const pending = new Promise((resolve) => { release = resolve; });
const stale = harness(async () => { await pending; return [{ status: "valid" }]; });
const running = stale.controller.download();
stale.change(); release();
assert.equal(await running, false);
assert.equal(stale.downloads.length, 0);
assert.match(stale.statuses.at(-1), /blocked/);
let begin;
const begun = new Promise((resolve) => { begin = resolve; });
const cancelled = harness(async (_raw, _sources, { signal }) => {
  begin(); await new Promise((resolve) => signal.addEventListener("abort", resolve, { once: true }));
  return [{ status: "valid" }];
});
const cancelling = cancelled.controller.download();
await begun; cancelled.controller.cancel();
assert.equal(await cancelling, false);
assert.equal(cancelled.downloads.length, 0);
assert.match(cancelled.statuses.at(-1), /cancelled/);
assert.deepEqual(cancelled.busy, [true, false]);
const failedStorage = harness(valid, { persist: async () => { throw new Error("quota"); } });
assert.equal(await failedStorage.controller.download(), true, "a requested package remains an output when subsequent local recovery fails");
assert.equal(failedStorage.downloads.length, 1);
assert.match(failedStorage.statuses.at(-1), /download was requested.*quota/);
const writeFailure = harness(valid, { download: () => { throw new Error("download unavailable"); } });
assert.equal(await writeFailure.controller.download(), false);
assert.match(writeFailure.statuses.at(-1), /download unavailable/);
console.log("PASS: the project controller independently validates each schema set, binds all results to the project revision, and gives truthful failure and cancellation outcomes.");
