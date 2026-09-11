const validatorCache = new Map();
let runtimePromise = null;

function diagnostics(error) {
  const details = Array.isArray(error?.details) ? error.details : [];
  if (details.length) return details.map((detail) => ({
    message: String(detail.message || "Schema validation failed.").trim(),
    line: Number(detail.line || 0), column: Number(detail.col || 0),
  }));
  return [{ message: error instanceof Error ? error.message : String(error), line: 0, column: 0 }];
}

async function libxmlRuntime() {
  if (!runtimePromise) {
    runtimePromise = import("../../vendor/libxml2-wasm/lib/index.mjs").then((runtime) => {
      const provider = new runtime.XmlBufferInputProvider({});
      if (!runtime.xmlRegisterInputProvider(provider)) throw new Error("The browser XML runtime could not register its in-memory schema resolver.");
      return { ...runtime, provider, encoder: new TextEncoder() };
    });
  }
  return runtimePromise;
}

async function fingerprint(parts) {
  const body = parts.map((part) => `${String(part).length}:${String(part)}`).join("|");
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  return body;
}

async function libxmlValidator(source, graph, onProgress) {
  const resourceParts = [...graph.resources.entries()].sort(([a], [b]) => a.localeCompare(b)).flat();
  const cacheKey = await fingerprint([source.type, graph.mainUrl, ...resourceParts]);
  if (validatorCache.has(cacheKey)) return validatorCache.get(cacheKey);
  onProgress("Preparing schema");
  const runtime = await libxmlRuntime();
  for (const [url, text] of graph.resources) runtime.provider.addBuffer(url, runtime.encoder.encode(text));
  const schemaDocument = runtime.XmlDocument.fromString(graph.mainText, { url: graph.mainUrl });
  try {
    const validator = source.type === "xsd"
      ? runtime.XsdValidator.fromDoc(schemaDocument) : runtime.RelaxNGValidator.fromDoc(schemaDocument);
    const entry = { validator, XmlDocument: runtime.XmlDocument, schemaDocument };
    validatorCache.set(cacheKey, entry);
    return entry;
  } catch (error) { schemaDocument.dispose(); throw error; }
}

/**
 * Run the exact XML/schema graph in a worker, or directly in the Node proofs.
 * @param {(phase: string) => void} [onProgress]
 */
export async function validateXmlSchemaDirect(raw, source, graph, onProgress = () => {}) {
  const entry = await libxmlValidator(source, graph, onProgress);
  onProgress("Parsing XML");
  let document;
  try {
    document = entry.XmlDocument.fromString(raw);
    onProgress("Validating XML");
    entry.validator.validate(document);
    return { name: source.name, type: source.type, status: "valid", diagnostics: [] };
  } catch (error) {
    return { name: source.name, type: source.type, status: "invalid", diagnostics: diagnostics(error) };
  } finally { if (document) document.dispose(); }
}
