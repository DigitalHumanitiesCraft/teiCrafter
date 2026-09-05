import assert from "node:assert/strict";
import { encodeWorkingCopy, decodeWorkingCopy } from "../../docs/js/editor/working-copy.js";
import { createRecoveryStore, migrateLegacyDraft } from "../../docs/js/editor/session-recovery.js";
import { DRAFT_KEY } from "../../docs/js/editor/draft-recovery.js";
import { createUnusedFile } from "../../docs/js/editor/file-target.js";
import { createPageImages } from "../../docs/js/editor/page-images.js";
import { parseEdition } from "../../docs/js/editor/edition.js";

const record = { id: "test", raw: "<TEI/>", docName: "letter.xml", staged: { mode: "page", folio: 0, value: "<broken" },
  images: [{ name: "page.png", blob: new Blob([new Uint8Array([0, 127, 255])]), type: "image/png" }] };
const restored = decodeWorkingCopy(await encodeWorkingCopy(record));
assert.equal(restored.raw, record.raw);
assert.deepEqual(restored.staged, record.staged);
assert.deepEqual(new Uint8Array(await restored.images[0].blob.arrayBuffer()), new Uint8Array([0, 127, 255]));
assert.throws(() => decodeWorkingCopy('{"version":2}'), /supported/);
await assert.rejects(createRecoveryStore(null).put(record), /unavailable/);
let removed = false;
const legacyStorage = { getItem: () => JSON.stringify(record), removeItem: (key) => { assert.equal(key, DRAFT_KEY); removed = true; } };
await assert.rejects(migrateLegacyDraft({ put: async () => { throw new Error("quota"); } }, legacyStorage), /quota/);
assert.equal(removed, false, "failed migration must keep the only original copy");
await migrateLegacyDraft({ put: async () => {} }, legacyStorage);
assert.equal(removed, true);

const files = new Map([["letter.xml", new Blob(["original"])] ]);
const directory = { async getFileHandle(name, options = {}) {
  if (!files.has(name)) {
    if (!options.create) throw new DOMException("Missing", "NotFoundError");
    files.set(name, new Blob([]));
  }
  return { getFile: async () => files.get(name) };
} };
const created = await createUnusedFile(directory, "letter.xml");
assert.equal(created.name, "letter (1).xml");
assert.equal(await files.get("letter.xml").text(), "original");
await assert.rejects(createUnusedFile({ getFileHandle: async () => { throw new DOMException("Denied", "NotAllowedError"); } }, "x.xml"), /Denied/);
const image = { blob: new Blob(["uploaded"]), persisted: false };
const app = {
  state: parseEdition('<TEI xmlns="http://www.tei-c.org/ns/1.0"><facsimile><surface><graphic url="page.png"/></surface></facsimile><text><body><p>Text</p></body></text></TEI>'),
  pageImages: new Map([["page.png", image]]),
};
const imageStore = createPageImages({ app, rerenderPanel() {} });
let writes = 0;
const occupied = { getFileHandle: async () => ({ getFile: async () => new Blob(["original"]), createWritable: async () => { writes++; } }) };
assert.equal((await imageStore.persist(occupied)).failed, 1);
assert.equal(writes, 0, "different existing image bytes must not be overwritten");
assert.equal(image.persisted, false);
const identical = { getFileHandle: async () => ({ getFile: async () => new Blob(["uploaded"]), createWritable: async () => { writes++; } }) };
assert.equal((await imageStore.persist(identical)).failed, 0);
assert.equal(writes, 0, "identical existing images need no write");
assert.equal(image.persisted, true);
console.log("PASS: working copies preserve staged input and blobs; migration and filename collisions fail safely.");
