import { validateXmlSchemaDirect } from "./xml-schema-runtime.js";

let queue = Promise.resolve();

// One runtime owns the registered schema resolver and compiled-schema cache.
self.addEventListener("message", (event) => {
  const request = event.data;
  queue = queue.then(async () => {
    const { id, raw, source, graph } = request;
    try {
      const result = await validateXmlSchemaDirect(raw, source, graph,
        (phase) => self.postMessage({ id, kind: "progress", phase }));
      self.postMessage({ id, kind: "result", result });
    } catch (error) {
      self.postMessage({ id, kind: "error", message: error.message || "Schema validation worker failed." });
    }
  });
});
