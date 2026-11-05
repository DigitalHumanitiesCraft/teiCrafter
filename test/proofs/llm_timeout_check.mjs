/**
 * Proof: a provider that never answers ends in a readable timeout instead of
 * an endless wait, and a user cancel keeps its own error.
 *   - complete() rejects after timeoutMs with a message naming the provider;
 *   - the bound also covers a response whose body never arrives;
 *   - cancelling through the caller's signal is not reported as a timeout;
 *   - a prompt answer within the bound is returned unchanged.
 *
 * Run: node test/proofs/llm_timeout_check.mjs   (exit 0 = all pass)
 */

globalThis.localStorage = { getItem() { return null; }, setItem() {} };

const { complete, setApiKey, setProvider } = await import("../../docs/js/services/llm.js");
import { check, finish, section } from "./_assert.mjs";

// A fetch that settles only when its signal aborts, as a hanging server does.
function hangingFetch(_url, init) {
  return new Promise((_resolve, reject) => {
    init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
  });
}

// Without a bound the request would never settle; the guard turns that into a failure.
async function settle(promise, guardMs = 2000) {
  let guard;
  const timedOut = new Promise((resolve) => { guard = setTimeout(() => resolve({ hung: true }), guardMs); });
  const outcome = promise.then((value) => ({ value }), (error) => ({ error }));
  const result = await Promise.race([outcome, timedOut]);
  clearTimeout(guard);
  return result;
}

setProvider("anthropic");
setApiKey("anthropic", "sk-ant-test-not-a-real-key");
const originalFetch = globalThis.fetch;

section("Request timeout");
globalThis.fetch = hangingFetch;
let result = await settle(complete("prompt", { timeoutMs: 50 }));
check("a hanging provider settles", !result.hung);
check("the result is an error", result.error instanceof Error);
check("the message names the provider and the timeout", /Anthropic did not answer within/.test(result.error?.message || ""));

globalThis.fetch = async (_url, init) => ({
  ok: true,
  status: 200,
  json: () => hangingFetch(null, init),
  text: () => hangingFetch(null, init),
});
result = await settle(complete("prompt", { timeoutMs: 50 }));
check("a body that never arrives also times out", /did not answer within/.test(result.error?.message || ""));

section("User cancel");
globalThis.fetch = hangingFetch;
const controller = new AbortController();
const pending = settle(complete("prompt", { signal: controller.signal, timeoutMs: 5000 }));
controller.abort();
result = await pending;
check("cancel settles", !result.hung);
check("cancel is not reported as a timeout", result.error && !/did not answer/.test(result.error.message));

section("Answer within the bound");
globalThis.fetch = async () => ({
  ok: true,
  status: 200,
  json: async () => ({ content: [{ type: "text", text: "<TEI/>" }] }),
});
result = await settle(complete("prompt", { timeoutMs: 1000 }));
check("the answer text is returned", result.value === "<TEI/>");

globalThis.fetch = originalFetch;
finish("llm_timeout_check: all checks passed.");
