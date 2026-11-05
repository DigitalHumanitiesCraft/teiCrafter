/**
 * Proof: provider failures reach the researcher as sentences, not raw bodies.
 *   - 401/403, 429, 5xx and other statuses each get a sentence naming the provider;
 *   - a provider's own JSON error message is kept as detail, HTML error pages are not;
 *   - an unreachable endpoint and a body that is not JSON are explained.
 *
 * Run: node test/proofs/llm_errors_check.mjs   (exit 0 = all pass)
 */

globalThis.localStorage = { getItem() { return null; }, setItem() {} };

const { complete, describeProviderFailure, setApiKey, setProvider } = await import("../../docs/js/services/llm.js");
import { check, finish, section } from "./_assert.mjs";

section("HTTP failures");
const auth = describeProviderFailure("Anthropic", 401, '{"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"}}');
check("401 names the refused key", /^Anthropic refused the API key \(HTTP 401\)/.test(auth));
check("401 keeps the provider's message", auth.endsWith("Provider message: invalid x-api-key."));
check("401 shows no raw JSON", !auth.includes("{"));
check("403 is treated as a key problem", /refused the API key \(HTTP 403\)/.test(describeProviderFailure("OpenAI", 403, "")));
check("429 says to wait", /too many requests or an exhausted quota \(HTTP 429\)/.test(describeProviderFailure("OpenAI", 429, "")));
const server = describeProviderFailure("Anthropic", 500, "<html><body><h1>Internal Server Error</h1></body></html>");
check("5xx names a server error", /^Anthropic had a server error \(HTTP 500\)/.test(server));
check("an HTML error page is not shown", !server.includes("<"));
check("other statuses are named", /did not accept the request \(HTTP 400\)/.test(describeProviderFailure("Gemini", 400, '{"error":"bad"}')));

section("Transport and body failures");
setProvider("anthropic");
setApiKey("anthropic", "sk-ant-test-not-a-real-key");
const originalFetch = globalThis.fetch;
const failure = async (fetchImpl) => {
  globalThis.fetch = fetchImpl;
  try { await complete("prompt", { timeoutMs: 1000 }); return null; } catch (err) { return err.message; } finally { globalThis.fetch = originalFetch; }
};
const unreachable = await failure(async () => { throw new TypeError("Failed to fetch"); });
check("an unreachable endpoint is explained", /could not be reached/.test(unreachable || "") && /Ollama/.test(unreachable || ""));
const notJson = await failure(async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError("Unexpected end of JSON input"); } }));
check("a body that is not JSON is explained", /not valid JSON/.test(notJson || "") && !/Unexpected end/.test(notJson || ""));
const rejected = await failure(async () => ({ ok: false, status: 401, text: async () => '{"error":{"message":"invalid x-api-key"}}' }));
check("complete() uses the sentence for an HTTP failure", /refused the API key/.test(rejected || ""));

finish("llm_errors_check: all checks passed.");
