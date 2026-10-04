import assert from "node:assert/strict";
import { test } from "node:test";
import { importTs } from "./load-ts.mjs";

const { createSchemaClient } = await importTs("src/validate/schema-client.ts");

function harness() {
  const workers = [];
  const client = createSchemaClient(() => {
    const listeners = new Map();
    const worker = {
      sent: [],
      terminated: false,
      addEventListener: (name, callback) => listeners.set(name, callback),
      postMessage(message) { this.sent.push(structuredClone(message)); },
      terminate() { this.terminated = true; },
      emit: (name, event) => listeners.get(name)?.(event),
      lastId() { return this.sent.filter((item) => item.type === "validate").at(-1).id; },
    };
    workers.push(worker);
    return worker;
  }, "https://example.test/app/");
  return { client, workers };
}

const schema = { kind: "rng", url: "schemas/tei.rng", label: "TEI" };

test("requests are correlated and relative schema URLs resolve against the public root", async () => {
  const { client, workers } = harness();
  const first = client.validate("<a/>", [schema]);
  const second = client.validate("<b/>", [{ kind: "xsd", text: "<xs/>", label: "x" }]);
  const [worker] = workers;
  assert.deepEqual(worker.sent[0], { type: "init", runtimeUrl: "https://example.test/app/vendor/libxml2-wasm/lib/index.mjs" });
  assert.equal(worker.sent[1].schemas[0].url, "https://example.test/app/schemas/tei.rng");
  assert.deepEqual(worker.sent[2].schemas[0], { kind: "xsd", label: "x", text: "<xs/>" });
  worker.emit("message", { data: { id: 2, diagnostics: [] } });
  worker.emit("message", { data: { id: 1, error: "boom" } });
  assert.deepEqual(await second, []);
  await assert.rejects(first, /boom/);
});

test("abort settles the caller, cancels in the worker and keeps the worker alive", async () => {
  const { client, workers } = harness();
  const controller = new AbortController();
  const pending = client.validate("<a/>", [schema], controller.signal);
  const id = workers[0].lastId();
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
  assert.deepEqual(workers[0].sent.at(-1), { type: "cancel", id });
  assert.equal(workers[0].terminated, false);
  workers[0].emit("message", { data: { id, diagnostics: [] } });
  await assert.rejects(client.validate("<a/>", [schema], controller.signal), { name: "AbortError" });
  const next = client.validate("<b/>", [schema]);
  assert.equal(workers.length, 1);
  workers[0].emit("message", { data: { id: workers[0].lastId(), diagnostics: [] } });
  assert.deepEqual(await next, []);
});

test("a worker crash rejects pending requests and the next call starts a new worker", async () => {
  const { client, workers } = harness();
  const pending = Promise.allSettled([client.validate("<a/>", [schema]), client.validate("<b/>", [schema])]);
  workers[0].emit("error", { message: "failed to load" });
  assert.ok((await pending).every((item) => item.status === "rejected"));
  assert.equal(workers[0].terminated, true);
  const recovered = client.validate("<c/>", [schema]);
  assert.equal(workers.length, 2);
  workers[0].emit("message", { data: { id: workers[1].lastId(), error: "stale worker" } });
  workers[1].emit("message", { data: { id: workers[1].lastId(), diagnostics: [] } });
  assert.deepEqual(await recovered, []);
  const closed = client.validate("<d/>", [schema]);
  client.dispose();
  await assert.rejects(closed, /disposed/);
  assert.equal(workers[1].terminated, true);
});
