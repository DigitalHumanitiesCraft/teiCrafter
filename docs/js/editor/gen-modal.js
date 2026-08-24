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
 *     load(raw, name, handle, project, opts),
 *     markGenerated(on),        // flag the edition as machine-made, unreviewed
 *     setDirty(d), setStatus(msg),
 *     authorizeDocumentReplacement(),
 *     beginAiJob(kind), aiJobCurrent(job), finishAiJob(job), abortAiJob(job),
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
import {
  complete, setProvider, setModel, setApiKey, setEndpoint, getProviderConfigs,
} from "../services/llm.js";
import { SOURCE_LABELS, getDefaultMapping } from "../utils/constants.js";
import { buildGenerationPrompt, extractXml } from "./llm-prompt.js";
import { llmForFile } from "./project-manifest.js";
import { requireCtx } from "./ctx.js";
import { persistGeneratedProvenance } from "./generated-provenance.js";

const $ = (id) => document.getElementById(id);

export function setupGenModal(ctx) {
  requireCtx("setupGenModal", ctx, [
    "load", "markGenerated", "setDirty", "setStatus", "authorizeDocumentReplacement",
    "beginAiJob", "aiJobCurrent", "finishAiJob", "abortAiJob",
  ], ["app"]);
  const {
    load, markGenerated, setDirty, setStatus, app, authorizeDocumentReplacement,
    beginAiJob, aiJobCurrent, finishAiJob, abortAiJob,
  } = ctx;
  const gen = { key: "", provider: "anthropic", model: "", endpoint: "", type: "generic" };
  let activeJob = null;

  function generatedStructureIssue(xml) {
    const parsed = new DOMParser().parseFromString(xml, "application/xml");
    if (parsed.querySelector("parsererror")) return "The model response is not well-formed XML.";
    if (parsed.doctype) return "The model response contains a DOCTYPE; generated drafts must be self-contained.";
    const root = parsed.documentElement;
    if (!root || root.localName !== "TEI") return "The model response has no TEI root element.";
    if (root.namespaceURI !== "http://www.tei-c.org/ns/1.0") return "The TEI root has the wrong namespace.";
    const child = (parent, name) => Array.from(parent.children).find((el) => el.localName === name) || null;
    const header = child(root, "teiHeader");
    const text = child(root, "text");
    const fileDesc = header && child(header, "fileDesc");
    const titleStmt = fileDesc && child(fileDesc, "titleStmt");
    const publicationStmt = fileDesc && child(fileDesc, "publicationStmt");
    const sourceDesc = fileDesc && child(fileDesc, "sourceDesc");
    if (!fileDesc || !titleStmt || !child(titleStmt, "title")
      || !publicationStmt || !child(publicationStmt, "p")
      || !sourceDesc || !child(sourceDesc, "p")) {
      return "The model response lacks the minimum TEI P5 fileDesc (titleStmt/title, publicationStmt, sourceDesc).";
    }
    if (!text || !child(text, "body")) return "The model response lacks text/body.";
    return null;
  }

  function fillSelect(sel, entries, current) {
    clear(sel);
    for (const [val, label] of entries) {
      const opt = el("option", { value: val, text: label });
      if (val === current) opt.selected = true;
      sel.appendChild(opt);
    }
  }

  function refreshModels() {
    const provider = $("gen-provider").value;
    const cfg = getProviderConfigs()[provider];
    const models = (cfg && cfg.models) || [];
    const current = gen.provider === provider ? gen.model : "";
    const custom = !!(cfg && cfg.allowCustomModel);
    const select = $("gen-model");
    const input = $("gen-custom-model");
    const endpointField = $("gen-endpoint-field");
    const endpointInput = $("gen-endpoint");
    select.hidden = custom;
    input.hidden = !custom;
    endpointField.hidden = !(cfg && cfg.allowCustomEndpoint);
    if (custom) {
      input.value = current || cfg.defaultModel || "";
    } else {
      fillSelect(select, models.map((m) => [m, m]), current || (cfg && cfg.defaultModel));
    }
    if (cfg && cfg.allowCustomEndpoint) {
      endpointInput.value = gen.provider === provider && gen.endpoint
        ? gen.endpoint
        : (cfg.endpoint || "");
    }
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
    if (activeJob) abortAiJob(activeJob, "Generation cancelled");
    $("gen-modal").hidden = true;
  }

  async function runGenerate() {
    const text = $("gen-text").value;
    const type = $("gen-type").value;
    const provider = $("gen-provider").value;
    const cfg = getProviderConfigs()[provider];
    const model = cfg && cfg.allowCustomModel
      ? $("gen-custom-model").value.trim()
      : $("gen-model").value;
    const apiKey = $("gen-key").value.trim();
    const endpoint = cfg && cfg.allowCustomEndpoint ? $("gen-endpoint").value.trim() : "";
    gen.key = apiKey; gen.provider = provider; gen.model = model; gen.endpoint = endpoint; gen.type = type;

    const status = $("gen-status");
    if (!text.trim()) { status.className = "ed-modal-status err"; status.textContent = "Please paste some source text."; return; }

    // Configure the LLM service. The key is stored inside llm.js (module-scoped),
    // not here, and never persisted.
    setProvider(provider);
    if (model) setModel(model);
    if (cfg && cfg.allowCustomEndpoint && !setEndpoint(provider, endpoint)) {
      status.className = "ed-modal-status err";
      status.textContent = "Enter a valid HTTP or HTTPS OpenAI-compatible endpoint.";
      return;
    }
    if (apiKey && !setApiKey(provider, apiKey)) {
      status.className = "ed-modal-status err"; status.textContent = "API key format is invalid."; return;
    }
    if (cfg && !["none", "optional-bearer"].includes(cfg.authType) && !apiKey && !cfg.hasKey) {
      status.className = "ed-modal-status err"; status.textContent = "An API key is required (kept in memory only)."; return;
    }
    const replacement = authorizeDocumentReplacement();
    if (!replacement) {
      status.className = "ed-modal-status";
      status.textContent = "The current document was kept.";
      return;
    }

    $("gen-run").disabled = true;
    status.className = "ed-modal-status busy";
    status.textContent = `Contacting ${cfg ? cfg.name : provider}...`;
    const job = beginAiJob("generation");
    activeJob = job;
    try {
      // The project's own voice when it declares one (system prompt + a Markdown
      // mapping, resolved type-aware for the open document); otherwise the built-in
      // per-source-type mapping. One assembler for both, in llm-prompt.js.
      const eff = app && app.project ? llmForFile(app.project, app.docName) : null;
      const systemPrompt = eff && eff.systemPrompt ? eff.systemPrompt : "";
      const projMapping = eff && eff.mapping && app.project.llmMappings
        ? app.project.llmMappings[eff.mapping] : "";
      const mapping = projMapping && projMapping.trim() ? projMapping : getDefaultMapping(type);
      const response = await complete(buildGenerationPrompt({ text, systemPrompt, mapping }), { signal: job.signal });
      if (!aiJobCurrent(job)) return;
      let xml = extractXml(response);
      if (!xml) throw new Error("The model response contained no XML.");
      const structureIssue = generatedStructureIssue(xml);
      if (structureIssue) throw new Error(structureIssue);
      xml = persistGeneratedProvenance(xml, (eff && eff.responsibility) || "#ai");
      const opened = await load(xml, `generated-${type}.xml`, null, null, { replacement });
      if (!opened) return;
      markGenerated(true);
      setDirty(true);
      close();
      setStatus("Generated an initial TEI. Review and correct it; nothing is saved until you save or download.");
    } catch (err) {
      if (job.signal.aborted || (err && err.name === "AbortError")) return;
      status.className = "ed-modal-status err";
      status.textContent = `Generation failed: ${err.message}`;
    } finally {
      finishAiJob(job);
      if (activeJob === job) activeJob = null;
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
