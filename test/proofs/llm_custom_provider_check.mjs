/**
 * Proof: a researcher can route the shared LLM service to an arbitrary
 * OpenAI-compatible HTTP endpoint without persisting the API key.
 */

globalThis.localStorage = {
  getItem() { return null; },
  setItem() {},
};

const {
  complete,
  getProviderConfigs,
  setApiKey,
  setEndpoint,
  setModel,
  setProvider,
} = await import("../../docs/js/services/llm.js");

let passed = 0;
let failed = 0;
function check(condition, label) {
  if (condition) {
    passed++;
    console.log(`  ok    ${label}`);
  } else {
    failed++;
    console.log(`  FAIL  ${label}`);
  }
}

console.log("\nCustom OpenAI-compatible provider proof");
console.log("=".repeat(60));

const config = getProviderConfigs().custom;
check(config && config.allowCustomEndpoint && config.allowCustomModel,
  "the provider exposes free endpoint and model fields");
check(config && config.authType === "optional-bearer",
  "the provider works with hosted keys and keyless local endpoints");
check(setEndpoint("custom", "ftp://example.org/model") === false,
  "non-HTTP endpoints are rejected");
check(setEndpoint("custom", "https://user:pass@example.org/v1/chat/completions") === false,
  "credentials embedded in an endpoint URL are rejected");
check(setEndpoint("custom", "https://models.example.org/v1/chat/completions") === true,
  "a valid HTTPS endpoint is accepted");
check(setApiKey("custom", "") === true,
  "a keyless custom endpoint is accepted");

setProvider("custom");
setModel("research-model-v7");
let request = null;
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  request = { url: String(url), init };
  return {
    ok: true,
    async json() {
      return { choices: [{ message: { content: "<TEI/>" } }] };
    },
  };
};

try {
  const result = await complete("Create TEI");
  const body = request ? JSON.parse(request.init.body) : null;
  check(result === "<TEI/>", "the standard response shape is extracted");
  check(request && request.url === "https://models.example.org/v1/chat/completions",
    "the request uses the configured endpoint exactly");
  check(body && body.model === "research-model-v7"
    && body.messages[0].content === "Create TEI",
  "the free model id and prompt reach the compatible request body");
  check(request && !Object.hasOwn(request.init.headers, "Authorization"),
    "a keyless endpoint receives no Authorization header");
} finally {
  globalThis.fetch = originalFetch;
}

console.log("=".repeat(60));
if (failed === 0) {
  console.log(`PASSED (${passed}/${passed})`);
  process.exit(0);
}
console.log(`FAILED (${passed}/${passed + failed}, ${failed} failing)`);
process.exit(1);
