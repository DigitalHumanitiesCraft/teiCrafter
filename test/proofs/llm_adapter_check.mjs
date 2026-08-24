globalThis.localStorage = { getItem() { return null; }, setItem() {} };

const {
  complete,
  getProviderConfigs,
  registerProviderAdapter,
  setApiKey,
  setModel,
  setProvider,
} = await import("../../docs/js/services/llm.js");
import { check, finish, section } from "./_assert.mjs";

section("Open LLM provider-adapter contract");

check("built-in providers cannot be replaced", !registerProviderAdapter("openai", {}));
check("invalid or credential-bearing adapter endpoints are rejected", !registerProviderAdapter("unsafe", {
  name: "Unsafe",
  endpoint: "https://user:secret@example.org/generate",
  defaultModel: "x",
  authType: "bearer",
  buildRequest() { return {}; },
  extractResponse() { return ""; },
}));

check("a nonstandard JSON protocol can register an explicit adapter", registerProviderAdapter("research-rest", {
  name: "Research REST model",
  endpoint: "https://models.example.org/{model}/infer",
  defaultModel: "tei-model",
  models: [],
  allowCustomModel: true,
  authType: "x-api-key",
  buildRequest(prompt, model) { return { input: prompt, engine: model, output: "xml" }; },
  extractResponse(data) { return data?.result?.tei || ""; },
}));
check("registered adapters appear in the common provider catalogue",
  getProviderConfigs()["research-rest"]?.allowCustomModel === true);

setProvider("research-rest");
setModel("specialized-v2");
setApiKey("research-rest", "session-secret");
let request = null;
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  request = { url: String(url), init };
  return { ok: true, async json() { return { result: { tei: "<TEI/>" } }; } };
};
try {
  check("the adapter extracts its provider-specific response", await complete("Encode") === "<TEI/>");
  const body = JSON.parse(request.init.body);
  check("the adapter controls URL, auth and request shape", request.url.endsWith("/specialized-v2/infer")
    && request.init.headers["x-api-key"] === "session-secret"
    && body.input === "Encode" && body.engine === "specialized-v2");
} finally {
  globalThis.fetch = originalFetch;
}

finish("llm_adapter_check passed");
