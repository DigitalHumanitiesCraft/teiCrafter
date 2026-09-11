/** Correlate worker results with exact requests; worker failure cannot authorize output. */
export function createSchemaWorkerClient(createWorker) {
  let worker = null;
  let serial = 0;
  const pending = new Map();

  function stop(message) {
    if (worker) worker.terminate();
    worker = null;
    for (const request of pending.values()) {
      request.cleanup();
      request.reject(new Error(message));
    }
    pending.clear();
  }
  function ensureWorker() {
    if (worker) return worker;
    const current = createWorker();
    worker = current;
    current.addEventListener("message", (event) => {
      if (current !== worker) return;
      const data = event.data;
      const request = pending.get(data?.id);
      if (!request) return;
      if (data.kind === "progress") { request.onProgress(data.phase); return; }
      pending.delete(data.id);
      request.cleanup();
      if (data.kind === "error") request.reject(new Error(data.message || "Schema validation worker failed."));
      else if (data.kind === "result" && ["valid", "invalid"].includes(data.result?.status)
        && data.result.name === request.name && data.result.type === request.type
        && Array.isArray(data.result.diagnostics)) request.resolve(data.result);
      else request.reject(new Error("Schema validation worker returned an invalid response."));
    });
    current.addEventListener("error", (event) => {
      if (current === worker) stop(event.message || "Schema validation worker could not start.");
    });
    current.addEventListener("messageerror", () => {
      if (current === worker) stop("Schema validation worker could not read its result.");
    });
    return current;
  }
  return {
    validate(raw, source, graph, onProgress = () => {}, signal = null) {
      return new Promise((resolve, reject) => {
        const id = ++serial;
        const abort = () => stop("Schema validation was cancelled before output authorization.");
        const cleanup = () => signal?.removeEventListener("abort", abort);
        try {
          signal?.throwIfAborted();
          const current = ensureWorker();
          pending.set(id, { resolve, reject, onProgress, cleanup, name: source.name, type: source.type });
          signal?.addEventListener("abort", abort, { once: true });
          current.postMessage({ id, raw, source: { name: source.name, type: source.type }, graph });
        } catch (error) { cleanup(); pending.delete(id); reject(error); }
      });
    },
    dispose: () => stop("Schema validation worker was closed before its result was available."),
  };
}
