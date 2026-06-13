/**
 * Proof: the Anthropic model catalog in services/llm.js is current and
 * self-consistent. The default model is in the model list, the retired
 * claude-haiku-3-5-20241022 (and any other stale dated ID) is gone, and the
 * three model IDs match the current bare-alias naming. The catalog is consumed
 * by gen-modal.js via getProviderConfigs(); this guards the source values.
 *
 * Run: node test/tools/llm_catalog_check.mjs   (exit 0 = all pass)
 */

import {
  ANTHROPIC_MODELS,
  ANTHROPIC_DEFAULT_MODEL,
  getProviderConfigs,
} from "../../docs/js/services/llm.js";

let passed = 0, failed = 0;
function check(cond, label) {
  if (cond) { passed++; console.log("  ok    " + label); }
  else { failed++; console.log("  FAIL  " + label); }
}

console.log("\nAnthropic model catalog proof");
console.log("=".repeat(60));

const EXPECTED = ["claude-opus-4-8", "claude-sonnet-4-6", "claude-haiku-4-5"];
const RETIRED = "claude-haiku-3-5-20241022";

// --- default is a member of the list -----------------------------------------

check(
  ANTHROPIC_MODELS.includes(ANTHROPIC_DEFAULT_MODEL),
  "default model is present in the model list",
);
check(ANTHROPIC_DEFAULT_MODEL === "claude-haiku-4-5", "default model is claude-haiku-4-5");

// --- the retired ID is absent ------------------------------------------------

check(!ANTHROPIC_MODELS.includes(RETIRED), "retired claude-haiku-3-5-20241022 is absent");

// --- the catalog is exactly the current naming -------------------------------

check(
  ANTHROPIC_MODELS.length === EXPECTED.length &&
    EXPECTED.every((m) => ANTHROPIC_MODELS.includes(m)),
  "model IDs match current naming (opus-4-8 / sonnet-4-6 / haiku-4-5)",
);

// --- no stale dated snapshot IDs survive -------------------------------------

check(
  ANTHROPIC_MODELS.every((m) => !/-\d{8}$/.test(m)),
  "no dated snapshot suffixes remain in the catalog",
);

// --- the public consumer view agrees with the exported catalog ---------------

const cfg = getProviderConfigs().anthropic;
check(
  cfg &&
    cfg.defaultModel === ANTHROPIC_DEFAULT_MODEL &&
    cfg.models.length === ANTHROPIC_MODELS.length &&
    cfg.models.every((m, i) => m === ANTHROPIC_MODELS[i]),
  "getProviderConfigs() exposes the same default and model list",
);

// --- summary -----------------------------------------------------------------

console.log("=".repeat(60));
if (failed === 0) {
  console.log(`PASSED (${passed}/${passed})`);
  console.log("The Anthropic model catalog is current and self-consistent.");
  process.exit(0);
} else {
  console.log(`FAILED (${passed}/${passed + failed}, ${failed} failing)`);
  process.exit(1);
}
