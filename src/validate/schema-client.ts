/**
 * Main-thread side of the validation worker: correlates requests with
 * replies and turns worker failure into rejected promises. Kept free of Vite
 * specifics so a fake worker can exercise it in Node.
 */
import type { Diagnostic, SchemaSource } from "./schema-runtime";

export type WorkerRequest =
  | { type: "init"; runtimeUrl: string }
  | { type: "validate"; id: number; raw: string; schemas: SchemaSource[] }
  | { type: "cancel"; id: number };

export type WorkerResponse = { id: number; diagnostics: Diagnostic[] } | { id: number; error: string };

export interface Validator {
  validate(raw: string, schemas: readonly SchemaSource[], signal?: AbortSignal): Promise<Diagnostic[]>;
  dispose(): void;
}

interface Pending {
  resolve(diagnostics: Diagnostic[]): void;
  reject(reason: unknown): void;
  cleanup(): void;
}

export const RUNTIME_PATH = "vendor/libxml2-wasm/lib/index.mjs";

/** `publicBase` is the absolute URL of the app's public root; relative schema URLs resolve against it. */
export function createSchemaClient(createWorker: () => Worker, publicBase: string): Validator {
  const runtimeUrl = new URL(RUNTIME_PATH, publicBase).href;
  let worker: Worker | null = null;
  let serial = 0;
  const pending = new Map<number, Pending>();

  function settle(id: unknown): Pending | undefined {
    if (typeof id !== "number") return undefined;
    const request = pending.get(id);
    if (!request) return undefined;
    pending.delete(id);
    request.cleanup();
    return request;
  }

  function stop(reason: Error): void {
    worker?.terminate();
    worker = null;
    for (const id of [...pending.keys()]) settle(id)?.reject(reason);
  }

  function ensureWorker(): Worker {
    if (worker) return worker;
    const current = createWorker();
    worker = current;
    current.addEventListener("message", (event: MessageEvent<WorkerResponse>) => {
      if (current !== worker) return;
      const data = event.data;
      const request = settle(data?.id);
      if (!request) return;
      if ("diagnostics" in data && Array.isArray(data.diagnostics)) request.resolve(data.diagnostics);
      else request.reject(new Error(("error" in data && data.error) || "The validation worker returned an invalid response."));
    });
    current.addEventListener("error", (event: ErrorEvent) => {
      if (current === worker) stop(new Error(event.message || "The validation worker failed."));
    });
    current.addEventListener("messageerror", () => {
      if (current === worker) stop(new Error("The validation worker reply could not be read."));
    });
    current.postMessage({ type: "init", runtimeUrl } satisfies WorkerRequest);
    return current;
  }

  function validate(raw: string, schemas: readonly SchemaSource[], signal?: AbortSignal): Promise<Diagnostic[]> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(signal.reason);
        return;
      }
      const id = ++serial;
      // Abort settles the caller at once but keeps the worker: terminating it
      // would discard the compiled TEI All, which takes seconds to rebuild.
      const onAbort = () => {
        const request = settle(id);
        if (!request) return;
        worker?.postMessage({ type: "cancel", id } satisfies WorkerRequest);
        request.reject(signal?.reason);
      };
      pending.set(id, { resolve, reject, cleanup: () => signal?.removeEventListener("abort", onAbort) });
      signal?.addEventListener("abort", onAbort, { once: true });
      try {
        const wire = schemas.map((schema): SchemaSource => typeof schema.text === "string"
          ? { kind: schema.kind, label: schema.label, text: schema.text }
          : { kind: schema.kind, label: schema.label, url: schema.url && new URL(schema.url, publicBase).href });
        ensureWorker().postMessage({ type: "validate", id, raw, schemas: wire } satisfies WorkerRequest);
      } catch (error) {
        settle(id)?.reject(error);
      }
    });
  }

  return { validate, dispose: () => stop(new Error("The validator was disposed.")) };
}
