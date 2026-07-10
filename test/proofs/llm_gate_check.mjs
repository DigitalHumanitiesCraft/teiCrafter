/**
 * Proof: the single LLM capability gate (docs/js/utils/constants.js llmEnabled()).
 * AI is reachable only when the build allows it (FEATURES.llmOnRamp) AND the
 * per-user runtime preference is not switched off, so the editor degrades to a
 * fully deterministic standalone when AI is off. The runtime half reads through
 * services/storage.js (localStorage); this proof stubs localStorage so both the
 * build-flag and the runtime-preference paths are checked headlessly. The DOM
 * consequence (no AI entry points visible when off) is a browser check.
 *
 * Run: node test/proofs/llm_gate_check.mjs   (exit 0 = all pass)
 */

// Stub localStorage BEFORE importing, so storage.js's getSetting reads this store.
// getSetting/setSetting key under the "teiCrafter_" prefix.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
const PREF = "teiCrafter_llmEnabled";

const { FEATURES, llmEnabled } = await import("../../docs/js/utils/constants.js");

let passed = 0, failed = 0;
function check(cond, label) {
  if (cond) { passed++; console.log("  ok    " + label); }
  else { failed++; console.log("  FAIL  " + label); }
}

console.log("\nLLM capability gate proof (build flag AND runtime preference)");
console.log("=".repeat(64));

// 1. Contract: a boolean.
check(typeof llmEnabled() === "boolean", "llmEnabled() returns a boolean");

// 2. No preference stored: the gate follows the build flag.
store.delete(PREF);
check(llmEnabled() === FEATURES.llmOnRamp, "with no preference set, the gate follows the build flag");

// 3. Runtime preference can switch AI off even when the build allows it.
store.set(PREF, "false");
check(llmEnabled() === false, "runtime preference false switches AI off");

// 4. Preference explicitly on: the gate follows the build flag again.
store.set(PREF, "true");
check(llmEnabled() === FEATURES.llmOnRamp, "runtime preference true defers to the build flag");

// 5. A corrupt/garbage preference value is not read as a deliberate off.
store.set(PREF, "not-json");
check(llmEnabled() === FEATURES.llmOnRamp, "a corrupt preference falls back to the build flag (only an explicit false disables)");

console.log("=".repeat(64));
if (failed === 0) {
  console.log(`PASSED (${passed}/${passed})`);
  console.log("AI is gated by build flag AND runtime preference; only an explicit false disables.");
  process.exit(0);
} else {
  console.log(`FAILED (${passed}/${passed + failed}, ${failed} failing)`);
  process.exit(1);
}
