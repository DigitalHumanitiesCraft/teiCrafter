/**
 * teiCrafter Editor -- LLM on-ramp modal ("New from text").
 *
 * One workbench, two entries. The model produces the first draft; the human
 * verifies and corrects it deterministically in the same editor. The API key
 * is held in memory only (llm.js keeps it in a module-scoped map), never
 * persisted. Extracted from editor-app.js in the M2.13 module split; the
 * behaviour is unchanged.
 *
 * Contract:
 *   setupGenModal(ctx) -> { open() }
 *   ctx: {
 *     load(raw, name, handle),  // open the generated TEI in the editor
 *     markGenerated(on),        // flag the edition as machine-made, unreviewed
 *     setDirty(d), setStatus(msg),
 *   }
 *   Wires its own modal listeners (close, cancel, provider change, run,
 *   backdrop click, Escape); the integrator wires the toolbar button and the
 *   #generate deep link to open().
 */

import { el, clear } from "./dom.js";
import { complete, setProvider, setModel, setApiKey, getProviderConfigs } from "../services/llm.js";
import { SOURCE_LABELS, getDefaultMapping } from "../utils/constants.js";

const $ = (id) => document.getElementById(id);

// Self-contained prompt + response parsing (the old transform.js pipeline depends
// on a missing prompt.js, so the editor builds its own minimal annotate prompt and
// calls the LLM service directly via complete()).
function buildPrompt(text, mappingRules) {
  return [
    "You are a TEI-XML assistant. Convert the source text into a well-formed TEI P5 document.",
    "Rules:",
    '1. Output a complete <TEI xmlns="http://www.tei-c.org/ns/1.0"> with a minimal <teiHeader> and <text><body>.',
    "2. Preserve every character of the source text exactly. Do not paraphrase, translate, or omit anything.",
    "3. Apply the mapping rules below where they fit; do not invent markup beyond them.",
    "4. Return ONLY the XML inside a single ```xml code block, with no commentary.",
    "",
    mappingRules || "",
    "",
    "Source text:",
    text,
  ].join("\n");
}

function extractXml(resp) {
  if (!resp) return null;
  const fenced = resp.match(/```xml\s*([\s\S]*?)```/i) || resp.match(/```\s*([\s\S]*?)```/);
  let xml = (fenced ? fenced[1] : resp).trim();
  const lt = xml.indexOf("<");
  if (lt > 0) xml = xml.slice(lt);
  return xml.startsWith("<") ? xml : null;
}

export function setupGenModal(ctx) {
  const { load, markGenerated, setDirty, setStatus } = ctx;
  const gen = { key: "", provider: "anthropic", model: "", type: "generic" };

  function fillSelect(sel, entries, current) {
    clear(sel);
    for (const [val, label] of entries) {
      const opt = el("option", { value: val, text: label });
      if (val === current) opt.selected = true;
      sel.appendChild(opt);
    }
  }

  function refreshModels() {
    const cfg = getProviderConfigs()[$("gen-provider").value];
    const models = (cfg && cfg.models) || [];
    fillSelect($("gen-model"), models.map((m) => [m, m]), gen.model || (cfg && cfg.defaultModel));
  }

  function open() {
    const configs = getProviderConfigs();
    fillSelect($("gen-type"), Object.entries(SOURCE_LABELS), gen.type);
    fillSelect($("gen-provider"), Object.entries(configs).map(([id, c]) => [id, c.name]), gen.provider);
    refreshModels();
    $("gen-key").value = gen.key;
    const status = $("gen-status");
    status.textContent = "";
    status.className = "ed-modal-status";
    $("gen-modal").hidden = false;
    $("gen-text").focus();
  }

  function close() {
    $("gen-modal").hidden = true;
  }

  async function runGenerate() {
    const text = $("gen-text").value;
    const type = $("gen-type").value;
    const provider = $("gen-provider").value;
    const model = $("gen-model").value;
    const apiKey = $("gen-key").value.trim();
    gen.key = apiKey; gen.provider = provider; gen.model = model; gen.type = type;

    const status = $("gen-status");
    if (!text.trim()) { status.className = "ed-modal-status err"; status.textContent = "Please paste some source text."; return; }

    // Configure the LLM service. The key is stored inside llm.js (module-scoped),
    // not here, and never persisted.
    setProvider(provider);
    if (model) setModel(model);
    const cfg = getProviderConfigs()[provider];
    if (apiKey && !setApiKey(provider, apiKey)) {
      status.className = "ed-modal-status err"; status.textContent = "API key format is invalid."; return;
    }
    if (cfg && cfg.authType !== "none" && !apiKey && !cfg.hasKey) {
      status.className = "ed-modal-status err"; status.textContent = "An API key is required (kept in memory only)."; return;
    }

    $("gen-run").disabled = true;
    status.className = "ed-modal-status busy";
    status.textContent = `Contacting ${cfg ? cfg.name : provider}...`;
    try {
      const response = await complete(buildPrompt(text, getDefaultMapping(type)));
      const xml = extractXml(response);
      if (!xml) throw new Error("The model response contained no XML.");
      await load(xml, `generated-${type}.xml`, null);
      markGenerated(true);
      setDirty(true);
      close();
      setStatus("Generated an initial TEI. Review and correct it; nothing is saved until you save or download.");
    } catch (err) {
      status.className = "ed-modal-status err";
      status.textContent = `Generation failed: ${err.message}`;
    } finally {
      $("gen-run").disabled = false;
    }
  }

  $("gen-close").addEventListener("click", close);
  $("gen-cancel").addEventListener("click", close);
  $("gen-provider").addEventListener("change", refreshModels);
  $("gen-run").addEventListener("click", runGenerate);
  $("gen-modal").addEventListener("click", (e) => { if (e.target.id === "gen-modal") close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("gen-modal").hidden) close(); });

  return { open };
}
