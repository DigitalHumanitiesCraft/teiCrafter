import assert from "node:assert/strict";
import { createRecoveryCoordinator } from "../../docs/js/editor/recovery-coordinator.js";
import { createOutputController } from "../../docs/js/editor/output-controller.js";

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

// Recovery captures before an asynchronous queue, preserves nested values and
// keeps later writes usable after an actual storage failure.
const block = deferred();
const events = [], errors = [];
let record = { id: "one", raw: "first", settings: { schema: "original" } };
const recovery = createRecoveryCoordinator({
  capture: () => record,
  store: {
    put: async (value) => { await block.promise; events.push(value); if (value.raw === "quota") throw new Error("QuotaExceededError"); },
    remove: async (id) => { events.push(`remove:${id}`); },
    list: async () => events,
  },
  onError: (error) => errors.push(error.message),
});
const first = recovery.persist();
record.settings.schema = "modified";
record = { id: "two", raw: "quota" };
const failed = recovery.persist();
const removed = recovery.remove("one");
record = { id: "two", raw: "newer" };
const newer = recovery.persist();
block.resolve();
assert.deepEqual(await Promise.all([first, failed, removed, newer]), [true, false, true, true]);
assert.deepEqual(events, [
  { id: "one", raw: "first", settings: { schema: "original" } },
  { id: "two", raw: "quota" }, "remove:one", { id: "two", raw: "newer" },
]);
assert.deepEqual(errors, ["QuotaExceededError"]);

function fixture(overrides = {}) {
  const state = { sessionId: 1, revision: 0, staged: false, dirty: true, writes: [], aborts: 0,
    closes: 0, saved: 0, removed: [], persisted: 0, downloads: [], statuses: [], imageCalls: 0 };
  const handle = {
    getFile: async () => ({ size: 10, lastModified: 123 }),
    createWritable: async () => ({
      write: async (bytes) => state.writes.push(new TextDecoder().decode(bytes)),
      close: async () => { state.closes++; },
      abort: async () => { state.aborts++; },
    }),
  };
  const ctx = {
    capture: (kind) => ({ raw: "<TEI/>", name: `${kind}.xml`, bom: false, inlineGND: kind === "inline-gnd", sessionId: state.sessionId, recoveryId: "first" }),
    sessionId: () => state.sessionId,
    resolveStaged: () => !state.staged,
    hasStaged: () => state.staged,
    authorize: async () => ({ revision: state.revision }),
    authorizationCurrent: (auth) => auth.revision === state.revision,
    prepareSaveTarget: async () => {},
    target: () => ({ handle, baseline: { size: 10, lastModified: 123 }, name: "first.xml", directory: "first-directory" }),
    setFileSnapshot: () => {},
    persistImages: async () => { state.imageCalls++; return { written: 0, failed: 0 }; },
    countImages: () => 0,
    markSaved: () => { state.dirty = false; state.saved++; },
    markDirty: () => { state.dirty = true; },
    persistRecovery: async () => { state.persisted++; return true; },
    clearRecovery: async (id) => { state.removed.push(id); return true; },
    download: (bytes, name) => state.downloads.push({ raw: new TextDecoder().decode(bytes), name }),
    status: (message) => state.statuses.push(message),
    ...overrides,
  };
  return { state, handle, ctx, output: createOutputController(ctx) };
}

{
  const f = fixture();
  assert.equal(await f.output.save(), true);
  assert.equal(f.state.saved, 1);
  assert.deepEqual(f.state.removed, ["first"]);
  assert.equal(f.state.closes, 1);
}
{
  const f = fixture();
  f.ctx.target = () => ({ handle: null });
  assert.equal(await f.output.save(), true);
  assert.equal(f.state.downloads.length, 1);
  assert.equal(f.state.dirty, true);
  assert.equal(f.state.persisted, 1);
  assert.deepEqual(f.state.removed, []);
}
{
  const f = fixture();
  f.handle.getFile = async () => ({ size: 11, lastModified: 123 });
  assert.equal(await f.output.save(), false);
  assert.equal(f.state.writes.length, 0);
  assert.equal(f.state.downloads.length, 0);
  assert.match(f.state.statuses.at(-1), /changed outside/);
}
{
  const f = fixture();
  f.ctx.authorize = async () => { f.state.staged = true; return { revision: 0 }; };
  assert.equal(await f.output.save(), false);
  assert.equal(f.state.writes.length, 0, "input typed during validation blocks output");
}
{
  const f = fixture();
  f.handle.createWritable = async () => { f.state.sessionId++; return { abort: async () => { f.state.aborts++; } }; };
  assert.equal(await f.output.save(), false);
  assert.equal(f.state.aborts, 1);
  assert.equal(f.state.statuses.length, 0, "old operation must not overwrite the new document's status");
  assert.equal(f.state.saved, 0);
}
{
  const f = fixture();
  f.handle.createWritable = async () => ({
    write: async () => { f.state.staged = true; },
    abort: async () => { f.state.aborts++; },
    close: async () => { f.state.closes++; },
  });
  assert.equal(await f.output.save(), false);
  assert.equal(f.state.aborts, 1, "unfinished input during write aborts before close");
  assert.equal(f.state.closes, 0);
  assert.equal(f.state.saved, 0);
}
{
  const f = fixture();
  f.handle.createWritable = async () => ({ write: async () => {}, close: async () => { f.state.sessionId++; } });
  assert.equal(await f.output.save(), false);
  assert.equal(f.state.saved, 0);
  assert.equal(f.state.imageCalls, 0, "old save must not write the new document's images");
  assert.deepEqual(f.state.removed, []);
}
{
  const f = fixture({ persistImages: async () => ({ written: 1, failed: 1 }) });
  assert.equal(await f.output.save(), false);
  assert.equal(f.state.dirty, true);
  assert.equal(f.state.saved, 0);
  assert.deepEqual(f.state.removed, []);
}
{
  const f = fixture();
  f.ctx.persistImages = async () => { f.state.revision++; return { written: 0, failed: 0 }; };
  assert.equal(await f.output.save(), false);
  assert.equal(f.state.saved, 0, "an older saved revision cannot mark current work clean");
}
{
  const f = fixture();
  const pending = deferred();
  f.ctx.authorize = async () => { await pending.promise; return { revision: 0 }; };
  const save = f.output.save();
  assert.equal(await f.output.save(), false, "repeated Save cannot start concurrent writers");
  pending.resolve();
  await save;
  assert.equal(f.state.closes, 1);
}
{
  const f = fixture();
  f.handle.createWritable = async () => { throw new Error("permission denied"); };
  assert.equal(await f.output.save(), true);
  assert.equal(f.state.downloads.length, 1);
  assert.equal(f.state.saved, 0);
  assert.equal(f.state.persisted, 1);
}
{
  const f = fixture();
  f.state.staged = true;
  assert.equal(await f.output.download("inline-gnd"), false, "every export resolves visible input");
  assert.equal(f.state.downloads.length, 0);
}
console.log("PASS: immutable recovery queue, quota recovery, output ownership, staged edits, conflicts, fallback and delayed writes.");
