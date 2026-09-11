import assert from "node:assert/strict";
import { createSchemaWorkerClient } from "../../docs/js/editor/schema-validation-worker-client.js";

const workers = [];
function fakeWorker() {
  const events = new Map();
  const worker = {
    requests: [], terminated: false,
    addEventListener(name, callback) { events.set(name, callback); },
    postMessage(message) { this.requests.push(structuredClone(message)); },
    terminate() { this.terminated = true; },
    emit(name, event) { events.get(name)?.(event); },
  };
  workers.push(worker);
  return worker;
}
const client = createSchemaWorkerClient(fakeWorker);
const source = { name: "Test schema", type: "relaxng" };
const graph = { mainText: "schema", mainUrl: "https://example.test/schema.rng", resources: new Map([["https://example.test/schema.rng", "schema"]]) };
const phases = [];
const first = client.validate("<first/>", source, graph, (phase) => phases.push(phase));
const second = client.validate("<second/>", source, graph);
assert.equal(workers.length, 1);
assert.deepEqual(workers[0].requests.map((request) => request.raw), ["<first/>", "<second/>"]);
assert.deepEqual(workers[0].requests[0].graph.resources, graph.resources);
const result = (status) => ({ ...source, status, diagnostics: status === "valid" ? [] : [{ message: "Invalid" }] });
workers[0].emit("message", { data: { id: 999, kind: "result", result: result("valid") } });
workers[0].emit("message", { data: { id: 1, kind: "progress", phase: "Preparing schema" } });
workers[0].emit("message", { data: { id: 2, kind: "result", result: result("invalid") } });
workers[0].emit("message", { data: { id: 1, kind: "result", result: result("valid") } });
assert.equal((await first).status, "valid");
assert.equal((await second).status, "invalid");
assert.deepEqual(phases, ["Preparing schema"]);

const malformed = client.validate("<third/>", source, graph);
workers[0].emit("message", { data: { id: 3, kind: "result", result: { ...result("valid"), name: "Different schema" } } });
await assert.rejects(malformed, /invalid response/u);
const crashA = client.validate("<fourth/>", source, graph);
const crashB = client.validate("<fifth/>", source, graph);
const crashes = Promise.allSettled([crashA, crashB]);
workers[0].emit("error", { message: "Worker failed to load" });
assert.ok((await crashes).every((item) => item.status === "rejected"));
assert.equal(workers[0].terminated, true);

const recovered = client.validate("<sixth/>", source, graph);
assert.equal(workers.length, 2);
workers[0].emit("message", { data: { id: 6, kind: "result", result: result("valid") } });
workers[1].emit("message", { data: { id: 6, kind: "result", result: result("valid") } });
assert.equal((await recovered).status, "valid");
const closed = client.validate("<seventh/>", source, graph);
client.dispose();
await assert.rejects(closed, /closed/u);
const cancelled = new AbortController();
const pendingAbort = client.validate("<cancel/>", source, graph, () => {}, cancelled.signal);
const concurrent = client.validate("<concurrent/>", source, graph);
const abortedResults = Promise.allSettled([pendingAbort, concurrent]);
const interrupted = workers.at(-1);
cancelled.abort();
assert.ok((await abortedResults).every((item) => item.status === "rejected"));
assert.ok(interrupted.terminated);
const beforeRestart = workers.length;
await assert.rejects(client.validate("<already-aborted/>", source, graph, () => {}, cancelled.signal), { name: "AbortError" });
assert.equal(workers.length, beforeRestart);
const afterAbort = client.validate("<after-abort/>", source, graph);
const restarted = workers.at(-1);
const finalId = restarted.requests.at(-1).id;
interrupted.emit("message", { data: { id: finalId, kind: "result", result: result("invalid") } });
restarted.emit("message", { data: { id: finalId, kind: "result", result: result("valid") } });
assert.equal((await afterAbort).status, "valid");
client.dispose();
console.log("Schema worker correlation, progress, fail-closed errors, cancellation and restart passed.");
