/** Owns the libxml2 runtime and its compiled-schema cache; jobs run one at a time. */
import type { WorkerRequest, WorkerResponse } from "./schema-client";
import { createSchemaRuntime, type LibxmlModule, type SchemaSource } from "./schema-runtime";

let runtimeUrl = "";
const cancelled = new Set<number>();
let queue = Promise.resolve();

const runtime = createSchemaRuntime({
  loadLibxml: () => {
    if (!runtimeUrl) return Promise.reject(new Error("The validation worker was not initialised."));
    return import(/* @vite-ignore */ runtimeUrl) as Promise<LibxmlModule>;
  },
  fetchText: async (url) => {
    const response = await fetch(url, { credentials: "omit" });
    if (!response.ok) throw new Error(`Schema request failed (${response.status}) for ${url}.`);
    return response.text();
  },
});

function reply(message: WorkerResponse): void {
  self.postMessage(message);
}

async function run(id: number, raw: string, schemas: SchemaSource[]): Promise<void> {
  // Validation is synchronous wasm work; yielding a task first lets a cancel
  // that is already queued arrive before the job starts.
  await new Promise((resolve) => setTimeout(resolve, 0));
  try {
    if (cancelled.has(id)) return;
    reply({ id, diagnostics: await runtime.validate(raw, schemas) });
  } catch (error) {
    reply({ id, error: error instanceof Error ? error.message : String(error) });
  } finally {
    for (const done of cancelled) if (done <= id) cancelled.delete(done);
  }
}

self.addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  if (request.type === "init") runtimeUrl = request.runtimeUrl;
  else if (request.type === "cancel") cancelled.add(request.id);
  else if (request.type === "validate") queue = queue.then(() => run(request.id, request.raw, request.schemas));
});
