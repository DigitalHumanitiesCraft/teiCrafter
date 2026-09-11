import assert from "node:assert/strict";
import { captureProjectDocuments, restoreProjectDocuments, snapshotProjectDocument, projectForSnapshot, projectHasUnsavedDocuments, checkpointFromProjectDocuments } from "../../docs/js/editor/project-documents.js";
import { createProjectBundle, decodeProjectBundle } from "../../docs/js/editor/project-bundle.js";
import { captureCheckpoint } from "../../docs/js/editor/session-recovery.js";
import { encodeWorkingCopy, decodeWorkingCopy } from "../../docs/js/editor/working-copy.js";
import { createRecoveryCoordinator } from "../../docs/js/editor/recovery-coordinator.js";
import { encodeXmlBytes } from "../../docs/js/editor/file-encoding.js";

const codexRaw = '<?xml version="1.0" encoding="UTF-8"?>\r\n<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p xml:id="ä">A&amp;B</p></body></text></TEI>\r\n';
const registerRaw = '<TEI xmlns="http://www.tei-c.org/ns/1.0" type="wenzelsbibel-registers"><!-- retain exact spaces -->  <standOff/></TEI>';
const project = { id: "wenzelsbibel", name: "Test", workspace: "wenzelsbibel", schema: { schemas: [{ type: "relaxng", path: "local.rng" }] },
  localSchemas: [{ type: "relaxng", xml: '<grammar xmlns="http://relaxng.org/ns/structure/1.0"/>' }], schemaBaseUrl: "https://example.org/project/" };
const app = { state: { doc: { raw: codexRaw } }, docName: "codex.xml", recoveryId: "first-recovery", dirty: true,
  source: { kind: "tei" }, project, fileEncoding: { encoding: "UTF-8", bom: true }, readingWitness: "B", pageImages: new Map() };
app.projectDocuments = captureProjectDocuments(app, { customSchema: { xml: "codex-schema" } });
app.projectDocuments.documents[0].role = "codex";
const register = snapshotProjectDocument({ ...app, state: { doc: { raw: registerRaw } }, docName: "registers.xml", dirty: false,
  fileEncoding: { encoding: "UTF-8", bom: false } }, { customSchema: { xml: "register-schema" } });
register.role = "registers";
app.projectDocuments.documents.push(register);
const checkpoint = captureCheckpoint(app, { mode: "witness", folio: 0, value: { selected: "B", creating: false, fields: { description: "unapplied" } } },
  { customSchema: { xml: "codex-schema" } });
app.project.schema.schemas[0].path = "later.rng";
assert.equal(checkpoint.projectDocuments.documents[0].project.schema.schemas[0].path, "local.rng");
const restored = decodeWorkingCopy(await encodeWorkingCopy(checkpoint));
assert.equal(restored.projectDocuments.documents.length, 2);
assert.equal(restored.projectDocuments.documents[0].raw, codexRaw);
assert.equal(restored.projectDocuments.documents[0].fileEncoding.bom, true);
assert.equal(restored.projectDocuments.documents[1].raw, registerRaw);
assert.equal(restored.projectDocuments.documents[1].dirty, false);
assert.equal(restored.projectDocuments.documents[0].readingWitness, "B");
assert.equal(restored.projectDocuments.documents[1].schemaSettings.customSchema.xml, "register-schema");
assert.equal(projectForSnapshot(restored.projectDocuments.documents[0]).schema.schemas[0].path, "local.rng");
assert.equal(restored.staged.value.fields.description, "unapplied");
assert.deepEqual(decodeWorkingCopy(JSON.stringify({ format: "teicrafter-working-copy", version: 1,
  record: { raw: codexRaw, docName: "codex.xml", images: [], staged: null } })).raw, codexRaw);
for (const mode of ["witness", "entries"]) {
  const value = mode === "witness" ? { selected: "", creating: true, fields: { name: "Neue Hand" } }
    : { section: "batch", selected: "entry1", kind: "dictionary", fields: { label: "x" }, targets: ["entry1", "entry2"] };
  const copy = { ...checkpoint, staged: { mode, folio: 0, value } };
  assert.deepEqual(decodeWorkingCopy(await encodeWorkingCopy(copy)).staged.value, value);
}
const switched = { ...app, state: { doc: { raw: registerRaw + "\n" } }, docName: register.name,
  fileEncoding: register.fileEncoding, dirty: true, projectDocuments: { ...restored.projectDocuments, activeId: register.id } };
const switchedCopy = captureProjectDocuments(switched, register.schemaSettings);
assert.equal(switchedCopy.documents[0].raw, codexRaw, "switching must retain the previously edited XML");
assert.equal(switchedCopy.documents[0].dirty, true);
assert.equal(switchedCopy.documents[1].raw, registerRaw + "\n");
assert.equal(projectHasUnsavedDocuments({ dirty: false, projectDocuments: switchedCopy }), true);

for (const badName of ["../a.xml", "/a.xml", "a\\b.xml", "a//b.xml", "a/./b.xml", "C:a.xml", "a%2fb.xml", "NUL.xml", "a .xml/../b.xml"]) {
  assert.throws(() => restoreProjectDocuments({ ...switchedCopy, documents: [{ ...switchedCopy.documents[0], name: badName }] }), /relative paths/);
}
assert.throws(() => restoreProjectDocuments({ ...switchedCopy, documents: [switchedCopy.documents[0], { ...register, name: "CODEX.xml" }] }), /duplicate/);
assert.throws(() => restoreProjectDocuments({ ...switchedCopy, documents: [{ ...switchedCopy.documents[0],
  raw: '<?xml version="1.0" encoding="UTF-16"?><TEI/>', id: "bad", name: "bad.xml" }], activeId: "bad" }), /requires UTF-8/);
assert.throws(() => restoreProjectDocuments({ ...switchedCopy, documents: [switchedCopy.documents[0], { ...register, id: switchedCopy.activeId }], activeId: "missing" }), /missing/);

const errors = [], writes = [];
let fail = true;
const coordinator = createRecoveryCoordinator({ capture: () => captureCheckpoint(switched),
  store: { put: async (record) => { if (fail) throw new Error("quota"); writes.push(record); }, remove: async () => {}, list: async () => writes },
  onError: (error) => errors.push(error.message) });
assert.equal(await coordinator.persist(), false);
assert.equal(switched.projectDocuments.documents.length, 2, "failed storage must retain the in-memory project");
assert.deepEqual(errors, ["quota"]);
fail = false;
const pending = coordinator.persist();
switched.state.doc.raw = "changed after capture";
assert.equal(await pending, true);
assert.equal(writes[0].projectDocuments.documents[1].raw, registerRaw + "\n", "queued writes own an immutable captured revision");

const snapshot = restored.projectDocuments;
const approved = [];
const ctx = { authorize: async (entry) => { approved.push(entry.name); return { raw: entry.raw }; },
  authorizationCurrent: (entry, token) => token.raw === entry.raw, isCurrent: () => true };
const result = await createProjectBundle(snapshot, ctx);
assert.deepEqual(approved, ["codex.xml", "registers.xml"]);
assert.equal(result.type, "application/zip");
const unpacked = decodeProjectBundle(result.bytes);
assert.deepEqual(unpacked, snapshot);
assert.deepEqual(encodeXmlBytes(unpacked.documents[0].raw, unpacked.documents[0].fileEncoding), encodeXmlBytes(codexRaw, { bom: true }));
assert.equal(checkpointFromProjectDocuments(unpacked).docName, "codex.xml");
await assert.rejects(createProjectBundle(snapshot, { ...ctx, authorize: async (entry) => entry.name === "codex.xml" ? { raw: entry.raw } : null }), /registers.xml did not pass/);
let revision = 0;
await assert.rejects(createProjectBundle(snapshot, { ...ctx, isCurrent: () => revision === 0,
  authorize: async (entry) => { if (entry.name === "registers.xml") revision++; return { raw: entry.raw }; } }), /changed/);
let schemaChanged = false;
await assert.rejects(createProjectBundle(snapshot, { ...ctx,
  authorize: async (entry) => { if (entry.name === "registers.xml") schemaChanged = true; return true; },
  authorizationCurrent: (entry) => !(schemaChanged && entry.name === "codex.xml") }), /changed/);
const controller = new AbortController();
await assert.rejects(createProjectBundle(snapshot, { ...ctx, signal: controller.signal,
  authorize: async () => { controller.abort(); return true; } }), /cancelled/);
const corrupt = result.bytes.slice(); corrupt[40] ^= 1;
assert.throws(() => decodeProjectBundle(corrupt), /checksum/);
assert.throws(() => decodeProjectBundle(result.bytes.subarray(0, result.bytes.length - 1)), /supported/);
const appended = new Uint8Array(result.bytes.length + 1); appended.set(result.bytes);
assert.throws(() => decodeProjectBundle(appended), /supported/);
const compressed = result.bytes.slice(); new DataView(compressed.buffer).setUint16(8, 8, true);
assert.throws(() => decodeProjectBundle(compressed), /sizes or offsets/);
const withImages = structuredClone(snapshot);
withImages.documents[0].images = [{ name: "image.png", type: "image/png", blob: new Blob([new Uint8Array([0, 255, 12, 45])]) }];
const imageBundle = await createProjectBundle(withImages, ctx);
const imageRoundtrip = decodeProjectBundle(imageBundle.bytes);
assert.deepEqual(new Uint8Array(await imageRoundtrip.documents[0].images[0].blob.arrayBuffer()), new Uint8Array([0, 255, 12, 45]));
assert.equal(imageRoundtrip.documents[0].images[0].type, "image/png");
withImages.documents[1].images = [{ name: "IMAGE.png", type: "image/png", blob: new Blob(["different"]) }];
await assert.rejects(createProjectBundle(withImages, ctx), /Conflicting package filename/);
withImages.documents[1].images = [{ name: "unchecked.xml", type: "image/png", blob: new Blob(["<invalid/>"]) }];
await assert.rejects(createProjectBundle(withImages, ctx), /unvalidated XML/);
withImages.documents[1].images = [{ name: "unchecked.png", type: "image/png", blob: new Blob(["<invalid/>"]) }];
await assert.rejects(createProjectBundle(withImages, ctx), /unvalidated XML/);
let imageStarted, releaseImage;
const imageReading = new Promise((resolve) => { imageStarted = resolve; });
const imageReady = new Promise((resolve) => { releaseImage = resolve; });
class DelayedImage extends Blob {
  async arrayBuffer() { imageStarted(); await imageReady; return super.arrayBuffer(); }
}
const delayed = structuredClone(snapshot);
delayed.documents[0].images = [{ name: "delayed.png", type: "image/png", blob: new DelayedImage([new Uint8Array([137, 80, 78, 71])]) }];
let assemblingCurrent = true;
const assembling = createProjectBundle(delayed, { ...ctx, isCurrent: () => assemblingCurrent });
await imageReading; assemblingCurrent = false; releaseImage();
await assert.rejects(assembling, /changed/, "state changes after all schema approvals still block the assembled package");
const equalLengthNames = { ...snapshot, documents: snapshot.documents.map((entry, index) => ({ ...entry, name: index ? "bbbb.xml" : "aaaa.xml" })) };
const namesBundle = (await createProjectBundle(equalLengthNames, ctx)).bytes;
function replaceName(bytes, from, to) {
  const result = bytes.slice(), needle = new TextEncoder().encode(from), replacement = new TextEncoder().encode(to);
  assert.equal(needle.length, replacement.length);
  for (let index = 0; index <= result.length - needle.length; index++) {
    if (needle.every((byte, offset) => result[index + offset] === byte)) result.set(replacement, index);
  }
  return result;
}
// XML names occur in the manifest too, so keep its bytes intact while changing ZIP names.
function replaceZipNames(bytes, from, to) {
  const result = bytes.slice(), view = new DataView(result.buffer);
  const end = result.length - 22, start = view.getUint32(end + 16, true);
  const changed = replaceName(result.subarray(start, end), from, to); result.set(changed, start);
  let offset = 0;
  while (offset < start) {
    const length = view.getUint16(offset + 26, true), size = view.getUint32(offset + 22, true);
    result.set(replaceName(result.subarray(offset + 30, offset + 30 + length), from, to), offset + 30);
    offset += 30 + length + size;
  }
  return result;
}
assert.throws(() => decodeProjectBundle(replaceZipNames(namesBundle, "bbbb.xml", "AAAA.xml")), /duplicate filenames/);
assert.throws(() => decodeProjectBundle(replaceZipNames(namesBundle, "aaaa.xml", "../a.xml")), /relative paths/);
console.log("PASS: companion recovery and portable XML packages preserve bytes, metadata and independent schema decisions; unsafe or stale packages fail closed.");
