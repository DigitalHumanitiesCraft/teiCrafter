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
 *     app,                      // shared state, for the open project's llm voice
 *   }
 * The prompt is assembled by the shared, pure llm-prompt.js so the on-ramp and any
 * future model-assisted step compose identically. When a project declares an "llm"
 * block (system prompt + a Markdown mapping, type-aware), that voice is used; bare
 * files fall back to the built-in per-source-type mapping.
 *   Wires its own modal listeners (close, cancel, provider change, run,
 *   backdrop click, Escape); the integrator wires the toolbar button and the
 *   #generate deep link to open().
 */

import { el, clear } from "./dom.js";
import { complete, setProvider, setModel, setApiKey, getProviderConfigs } from "../services/llm.js";
import { SOURCE_LABELS, getDefaultMapping } from "../utils/constants.js";
import { buildGenerationPrompt, extractXml } from "./llm-prompt.js";
import { llmForFile } from "./project-manifest.js";
import { requireCtx } from "./ctx.js";

const $ = (id) => document.getElementById(id);

export function setupGenModal(ctx) {
  requireCtx("setupGenModal", ctx, ["load", "markGenerated", "setDirty", "setStatus"], ["app"]);
  const { load, markGenerated, setDirty, setStatus, app } = ctx;
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
      // The project's own voice when it declares one (system prompt + a Markdown
      // mapping, resolved type-aware for the open document); otherwise the built-in
      // per-source-type mapping. One assembler for both, in llm-prompt.js.
      const eff = app && app.project ? llmForFile(app.project, app.docName) : null;
      const systemPrompt = eff && eff.systemPrompt ? eff.systemPrompt : "";
      const projMapping = eff && eff.mapping && app.project.llmMappings
        ? app.project.llmMappings[eff.mapping] : "";
      const mapping = projMapping && projMapping.trim() ? projMapping : getDefaultMapping(type);
      const response = await complete(buildGenerationPrompt({ text, systemPrompt, mapping }));
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
