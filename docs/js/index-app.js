import { FEATURES, llmEnabled } from "./utils/constants.js";

if (FEATURES.examples) {
  document.getElementById("examples").hidden = false;
  document.getElementById("lp-try-example").hidden = false;
}

if (llmEnabled()) {
  document.getElementById("lp-llm-onramp").hidden = false;
}
