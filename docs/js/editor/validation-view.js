/**
 * Live structural checks plus the schema gate shared by Save and Download.
 * Schema results are bound to session, revision, exact output bytes and schema set.
 */

import { el, clear } from "./dom.js";
import { serialize, structuralSummary, xmlIdSet } from "./edition.js";
import { requireCtx } from "./ctx.js";
import {
  customSchemaFromFile,
  schemaGate,
  schemaRuntimeNotes,
  schemaSetKey,
  schemaSources,
  validateWithSchemas,
} from "./schema-validation.js";

const $ = (id) => document.getElementById(id);

export function createValidationView(ctx) {
  requireCtx("createValidationView", ctx, [], ["app"]);
  const { app } = ctx;

  let valCache = null;
  let customSchema = null;
  let schemaRecord = null;
  let inFlight = null;

  function isWellFormed(raw) {
    const doc = new DOMParser().parseFromString(raw, "application/xml");
    const err = doc.querySelector("parsererror");
    return {
      ok: !err,
      message: err ? err.textContent.replace(/\s+/g, " ").trim().slice(0, 200) : "",
    };
  }

  function computeValidation() {
    if (valCache && valCache.doc === app.state.doc) return valCache;
    const raw = serialize(app.state);
    const summary = structuralSummary(app.state);
    const rows = [];
    const wf = isWellFormed(raw);
    rows.push([wf.ok ? "ok" : "err", wf.ok ? "Well-formed XML" : `Not well-formed: ${wf.message}`]);

    const base = app.baseline;
    const curIds = xmlIdSet(app.state);
    const missing = [...base.xmlIds].filter((id) => !curIds.has(id));
    const added = [...curIds].filter((id) => !base.xmlIds.has(id)).length;
    const unit = app.state.profile === "word" ? "word" : "line";
    const cellDelta = summary.words - base.wordCount;
    if (!missing.length && added === 0 && cellDelta === 0) {
      rows.push(["ok", base.xmlIds.size
        ? `All ${base.xmlIds.size} xml:id(s) preserved (no structural loss)`
        : `${base.wordCount} ${unit}(s) remain present (this document has no tracked xml:id)`]);
    } else {
      if (missing.length) rows.push(["err", `${missing.length} xml:id(s) lost: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "..." : ""}`]);
      if (added) rows.push(["info", `${added} new xml:id(s) added by your edits`]);
      if (cellDelta) rows.push(["info", `${Math.abs(cellDelta)} ${unit}(s) ${cellDelta > 0 ? "added" : "removed"} by your edits`]);
    }

    const drift = [];
    for (const tag of Object.keys(base.counts)) {
      if (summary.counts[tag] !== base.counts[tag]) {
        drift.push(`${tag}: ${base.counts[tag]} -> ${summary.counts[tag]}`);
      }
    }
    rows.push(drift.length
      ? ["info", `Element counts changed by your edits: ${drift.join("; ")}`]
      : ["ok", "Element counts unchanged"]);
    valCache = { doc: app.state.doc, rows, summary };
    return valCache;
  }

  function activeSources() {
    return schemaSources(
      app.project && app.project.schema,
      customSchema,
      app.project && app.project.schemaBaseUrl,
      app.project && app.project.localSchemas,
    );
  }

  function outputRaw() {
    return typeof ctx.schemaDocumentRaw === "function"
      ? ctx.schemaDocumentRaw()
      : serialize(app.state);
  }

  function snapshot(raw = outputRaw(), sources = activeSources()) {
    return {
      sessionId: app.sessionId,
      revision: app.revision,
      doc: app.state && app.state.doc,
      raw,
      schemaKey: schemaSetKey(sources),
      sources,
    };
  }

  function sameSnapshot(left, right) {
    return !!(left && right
      && left.sessionId === right.sessionId
      && left.revision === right.revision
      && left.doc === right.doc
      && left.raw === right.raw
      && left.schemaKey === right.schemaKey);
  }

  function currentRecord() {
    if (!app.state || !schemaRecord) return null;
    try {
      return sameSnapshot(schemaRecord, snapshot()) ? schemaRecord : null;
    } catch {
      return null;
    }
  }

  function outputLabel() {
    if (customSchema) return "Session override";
    if (app.project && app.project.schema) return "Project schema set";
    return "Repository default";
  }

  function renderValidation() {
    const chip = $("ed-val-chip");
    const pop = $("ed-val-pop");
    if (!chip || !pop) return;
    if (!app.state) {
      chip.hidden = true;
      pop.hidden = true;
      valCache = null;
      schemaRecord = null;
      inFlight = null;
      return;
    }

    const { rows, summary } = computeValidation();
    const record = currentRecord();
    const gate = record ? schemaGate(record.results) : null;
    const liveErrors = rows.filter((row) => row[0] === "err").length;
    const liveWarnings = rows.filter((row) => row[0] === "warn").length;
    const schemaBlocked = gate && !gate.ok;
    const level = liveErrors || schemaBlocked ? "err" : liveWarnings || inFlight ? "warn" : "ok";
    chip.hidden = false;
    chip.className = `ed-val-chip ${level}`;
    chip.textContent = schemaBlocked
      ? "output blocked by schema"
      : inFlight
        ? "validating schemas..."
        : liveErrors
          ? "checks failing"
          : record
            ? "schema and structural checks passed"
            : "structural checks passed";
    chip.title = "Automatic checks cover XML structure. Save and Download require every configured schema to validate the current document revision.";

    clear(pop);
    const liveSection = el("div", { class: "ed-section" }, [el("h4", { text: "Live checks" })]);
    for (const [kind, text] of rows) liveSection.appendChild(valRow(kind, text));
    liveSection.appendChild(el("div", {
      class: "ed-val-note",
      text: "Well-formed: the XML parses without errors.",
    }));
    liveSection.appendChild(el("div", {
      class: "ed-val-note",
      text: "Structural checks compare tracked identifiers, editing-unit counts and selected element counts with the opened document. They do not prove scholarly correctness or saved-file byte identity.",
    }));
    pop.appendChild(liveSection);

    const sources = activeSources();
    const schemaSection = el("div", { class: "ed-section" }, [el("h4", { text: "Output schema gate" })]);
    schemaSection.appendChild(el("div", {
      class: "ed-val-note",
      text: `${outputLabel()}: ${sources.map((source) => source.name).join(", ")}. Save and Download validate the exact XML output prepared from the current revision.`,
    }));

    if (!record) {
      schemaSection.appendChild(valRow("warn", "Current revision: schema validation required before output"));
      schemaSection.appendChild(el("div", {
        class: "ed-val-note",
        text: schemaRecord
          ? "The previous successful or failed result belongs to another document revision or schema set and cannot authorize output."
          : "No schema result exists for this document revision. Save or Download runs the validation automatically.",
      }));
      for (const source of sources.filter((item) => item.unavailable)) {
        schemaSection.appendChild(valRow("err", `${source.name}: unavailable`));
        schemaSection.appendChild(el("div", { class: "ed-val-note", text: source.unavailable }));
      }
    } else {
      for (const result of record.results) {
        const kind = result.status === "valid" ? "ok" : "err";
        schemaSection.appendChild(valRow(kind, `${result.name}: ${result.status}`));
        for (const item of result.diagnostics.slice(0, 20)) {
          const where = item.line
            ? `line ${item.line}${item.column ? `:${item.column}` : ""}: `
            : item.location ? `${item.location}: ` : "";
          schemaSection.appendChild(el("div", { class: "ed-val-note", text: `${where}${item.message}` }));
        }
      }
    }

    for (const note of schemaRuntimeNotes(sources)) {
      schemaSection.appendChild(el("div", { class: "ed-val-note", text: note }));
    }

    const actions = el("div", { class: "ed-val-actions" });
    const runButton = el("button", {
      class: "ed-btn",
      type: "button",
      text: inFlight ? "Validating..." : "Validate schema set",
      disabled: !!inFlight,
    });
    runButton.addEventListener("click", runSchemaValidation);
    const chooseButton = el("button", {
      class: "ed-btn",
      type: "button",
      text: "Use session schema...",
      disabled: !!inFlight,
    });
    chooseButton.addEventListener("click", chooseCustomSchema);
    actions.append(runButton, chooseButton);
    if (customSchema) {
      const resetButton = el("button", { class: "ed-btn", type: "button", text: "Use configured default" });
      resetButton.addEventListener("click", () => {
        customSchema = null;
        schemaRecord = null;
        if (typeof ctx.onSchemaSourcesChanged === "function") {
          ctx.onSchemaSourcesChanged(activeSources());
        }
        renderValidation();
      });
      actions.appendChild(resetButton);
    }
    schemaSection.appendChild(actions);
    pop.appendChild(schemaSection);

    const unitLabel = summary.profile === "word" ? "Words" : "Lines";
    const structureSection = el("div", { class: "ed-section" }, [el("h4", { text: "Structure" })]);
    structureSection.appendChild(kv("Folios", summary.folios));
    structureSection.appendChild(kv(unitLabel, summary.words));
    structureSection.appendChild(kv("xml:id count", summary.ids));
    for (const tag of ["surface", "zone", "l", "lb", "pb", "note", "standOff"]) {
      if (summary.counts[tag]) structureSection.appendChild(kv(`<${tag}>`, summary.counts[tag]));
    }
    pop.appendChild(structureSection);
  }

  async function validateSnapshot(target) {
    if (schemaRecord && sameSnapshot(schemaRecord, target)) return schemaRecord;
    if (inFlight && sameSnapshot(inFlight, target)) return inFlight.promise;
    const promise = validateWithSchemas(target.raw, target.sources).then((results) => {
      const completed = { ...target, results };
      schemaRecord = completed;
      return completed;
    }).finally(() => {
      if (inFlight && sameSnapshot(inFlight, target)) inFlight = null;
      renderValidation();
    });
    inFlight = { ...target, promise };
    renderValidation();
    return promise;
  }

  async function runSchemaValidation() {
    if (!app.state || inFlight) return;
    try {
      await validateSnapshot(snapshot());
    } catch (error) {
      schemaRecord = {
        ...snapshot(),
        results: [{
          name: "Schema set",
          status: "unavailable",
          diagnostics: [{ message: error.message, line: 0, column: 0 }],
        }],
      };
      renderValidation();
    }
  }

  /** Validate and authorize only the exact revision/output bytes supplied by Save. */
  async function requireValidForOutput(raw, action = "Output") {
    if (!app.state) return { ok: false, message: `${action} blocked: no document is loaded.` };
    const target = snapshot(raw);
    const record = await validateSnapshot(target);
    if (!sameSnapshot(target, snapshot())) {
      return {
        ok: false,
        stale: true,
        message: `${action} blocked: the document or configured schema set changed while validation was running. Run ${action} again for the current revision.`,
      };
    }
    const gate = schemaGate(record.results);
    if (gate.ok) return { ok: true, results: record.results, authorization: target };
    const invalid = gate.invalid.map((item) => item.name).join(", ");
    const unavailable = gate.unavailable.map((item) => item.name).join(", ");
    const reasons = [];
    if (invalid) reasons.push(`invalid: ${invalid}`);
    if (unavailable) reasons.push(`unavailable: ${unavailable}`);
    return {
      ok: false,
      results: record.results,
      message: `${action} blocked for the current revision because every configured schema must return valid (${reasons.join("; ")}). Open the validation details for diagnostics.`,
    };
  }

  function chooseCustomSchema() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".rng,.xsd,.sch,.xsl,.xslt,application/xml,text/xml";
    input.addEventListener("change", async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      try {
        customSchema = await customSchemaFromFile(file);
        schemaRecord = null;
      } catch (error) {
        customSchema = {
          name: file.name,
          type: "configuration",
          unavailable: error.message,
        };
        schemaRecord = null;
      }
      if (typeof ctx.onSchemaSourcesChanged === "function") {
        ctx.onSchemaSourcesChanged(activeSources());
      }
      renderValidation();
    }, { once: true });
    input.click();
  }

  function showDetails() {
    renderValidation();
    const chip = $("ed-val-chip");
    const pop = $("ed-val-pop");
    if (!chip || !pop) return;
    const bounds = chip.getBoundingClientRect();
    pop.style.top = `${bounds.bottom + 8}px`;
    pop.style.right = `${Math.max(8, window.innerWidth - bounds.right)}px`;
    pop.hidden = false;
    const heading = pop.querySelector("h4");
    if (heading) heading.setAttribute("tabindex", "-1");
  }

  function isOutputAuthorizationCurrent(authorization) {
    if (!authorization || !app.state) return false;
    try {
      return sameSnapshot(authorization, snapshot());
    } catch {
      return false;
    }
  }

  function valRow(kind, text) {
    const cls = kind === "ok"
      ? "ed-val-ok"
      : kind === "warn"
        ? "ed-val-warn"
        : kind === "info" ? "ed-val-info" : "ed-val-err";
    const icon = kind === "ok" ? "OK" : kind === "warn" ? "!" : kind === "info" ? "i" : "x";
    return el("div", { class: `ed-val-row ${cls}` }, [
      el("span", { class: "ed-val-icon", text: icon }),
      el("span", { text }),
    ]);
  }

  function kv(label, value) {
    return el("div", { class: "ed-kv" }, [
      el("span", { text: label }),
      el("b", { text: String(value) }),
    ]);
  }

  return {
    isWellFormed,
    renderValidation,
    requireValidForOutput,
    isOutputAuthorizationCurrent,
    showDetails,
    activeSchemaSources: activeSources,
  };
}
