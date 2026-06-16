/**
 * Proof: the pure generation-prompt assembler (docs/js/editor/llm-prompt.js).
 * The prompt composes in a fixed order [system prompt] [task] [mapping] [source
 * text], omits empty parts, and carries the source text verbatim (the task itself
 * demands character-exact preservation). extractXml pulls the XML payload from a
 * fenced or bare reply. Both are pure, so they are pinned headlessly here; the
 * actual model call is browser/network-verified.
 *
 * Run: node test/tools/llm_prompt_check.mjs   (exit 0 = all pass)
 */

import { buildGenerationPrompt, extractXml } from "../../docs/js/editor/llm-prompt.js";

let passed = 0, failed = 0;
function check(cond, label) {
  if (cond) { passed++; console.log("  ok    " + label); }
  else { failed++; console.log("  FAIL  " + label); }
}

console.log("\nLLM generation-prompt assembler proof");
console.log("=".repeat(64));

// --- 1. full composition: order and presence ---------------------------------
const sys = "PROJECT VOICE: a Stefan Zweig letter edition.";
const map = "Mapping rules:\n* <persName> Person";
const text = "Wien, 14. Februar 1879. Sehr geehrter Herr <Professor> & Freund.";
const full = buildGenerationPrompt({ text, systemPrompt: sys, mapping: map });

check(full.indexOf(sys) === 0, "the project system prompt leads the prompt");
check(full.indexOf(sys) < full.indexOf("You are a TEI-XML assistant"), "system prompt precedes the task instruction");
check(full.indexOf("You are a TEI-XML assistant") < full.indexOf(map), "task instruction precedes the mapping");
check(full.indexOf(map) < full.indexOf("Source text:"), "mapping precedes the source-text marker");
check(full.indexOf("Source text:") < full.indexOf(text), "the source text comes last");
check(full.includes(text), "the source text is carried verbatim (special chars, <>, & unchanged)");
check(full.endsWith(text), "the prompt ends with the source text, nothing appended after it");

// --- 2. empty parts are omitted ----------------------------------------------
const noSys = buildGenerationPrompt({ text, mapping: map });
check(!noSys.startsWith("\n") && noSys.indexOf("You are a TEI-XML assistant") === 0,
  "no system prompt: the task instruction leads, no leading blank");
const noMap = buildGenerationPrompt({ text });
check(!noMap.includes("Mapping rules"), "no mapping: no mapping block appears");
check(noMap.includes("You are a TEI-XML assistant") && noMap.endsWith(text), "no mapping: task + source text still present and ordered");

// --- 3. whitespace-only parts count as empty ---------------------------------
check(buildGenerationPrompt({ text, systemPrompt: "   " }).indexOf("You are a TEI-XML assistant") === 0,
  "a whitespace-only system prompt is treated as absent");

// --- 4. extractXml ------------------------------------------------------------
check(extractXml("```xml\n<TEI>x</TEI>\n```") === "<TEI>x</TEI>", "fenced ```xml block is extracted");
check(extractXml("```\n<TEI>y</TEI>\n```") === "<TEI>y</TEI>", "a generic fenced block is extracted");
check(extractXml("Here you go:\n<TEI>z</TEI>") === "<TEI>z</TEI>", "leading prose is dropped to the first '<'");
check(extractXml("no xml here") === null, "a reply with no '<' yields null");
check(extractXml("") === null && extractXml(null) === null, "empty/null reply yields null");

console.log("=".repeat(64));
if (failed === 0) {
  console.log(`PASSED (${passed}/${passed})`);
  console.log("The prompt composes in order, omits empty parts, preserves the source verbatim.");
  process.exit(0);
} else {
  console.log(`FAILED (${passed}/${passed + failed}, ${failed} failing)`);
  process.exit(1);
}
