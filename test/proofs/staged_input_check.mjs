import assert from "node:assert/strict";
import { createStagedInput } from "../../docs/js/editor/staged-input.js";

const owner = { sessionId: 1, raw: "original" };
const blocked = [];
const input = createStagedInput({ current: () => owner, blocked: (message) => blocked.push(message) });
let value = { core: "unfinished" }, changes = true, fail = true, applications = 0, disposed = 0;
const surface = {
  hasChanges: () => changes, value: () => value, restore: (next) => { value = next; },
  dispose: () => { disposed++; },
  apply: () => input.commit(() => {
    applications++;
    if (fail) return false;
    owner.raw = value.core;
    changes = false;
    return true;
  }),
};
input.mount(surface, { mode: "inline", folio: 0, cellId: "c1" });
assert.equal(input.allowChange("undoing"), false);
const snapshot = input.snapshot();
value.core = "corrected";
assert.equal(snapshot.value.core, "unfinished");
assert.throws(() => input.mount(surface, { mode: "page", folio: 0 }), /Apply or cancel/);
assert.equal(input.apply(), false);
assert.equal(input.hasChanges(), true, "failed input remains registered and recoverable");
owner.raw = "external revision";
fail = false;
assert.equal(input.apply(), false);
assert.equal(applications, 1, "a stale editor cannot call its mutation callback");
assert.equal(input.snapshot().value.core, "corrected", "stale input remains preservable");
owner.raw = "original";
assert.equal(input.apply(), true);
assert.equal(owner.raw, "corrected");
assert.equal(input.hasChanges(), false);
assert.equal(disposed, 1);
assert.equal(input.allowChange("undoing"), true);
changes = true;
input.mount(surface, { mode: "metadata-form", folio: 0 });
owner.sessionId++;
assert.equal(input.apply(), false, "identical source in another session does not grant edit ownership");
input.clear();
assert.equal(input.snapshot(), null);
assert.equal(disposed, 2);
console.log("PASS: one staged-input contract preserves failed edits and refuses stale mutations and destructive remounts.");
