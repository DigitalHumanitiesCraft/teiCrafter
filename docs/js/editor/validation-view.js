/**
 * teiCrafter Editor -- live validation (the browser-light half of the hybrid).
 *
 * A status chip (ok / warning / error) in the footer that updates on every
 * render, with the detail rows in a click popover. Checks: well-formedness
 * (DOMParser), xml:id integrity against the loaded baseline, tag-count drift.
 * The heavy half (RelaxNG + Schematron) runs in the offline harness.
 *
 * The expensive part (DOMParser parse, two full tree walks) runs only when the
 * document actually changed: results are cached by doc identity, so turning
 * pages in a large edition (the 78 MB Wenzelsbibel codex) re-renders the chip
 * from the cache instead of re-validating per folio.
 *
 * Contract:
 *   createValidationView(ctx) -> { isWellFormed, renderValidation }
 *   ctx: { app }   // shared mutable editor state (state, baseline)
 */

import { el, clear } from "./dom.js";
import { serialize, structuralSummary, xmlIdSet } from "./edition.js";
import { requireCtx } from "./ctx.js";

const $ = (id) => document.getElementById(id);

export function createValidationView(ctx) {
  requireCtx("createValidationView", ctx, [], ["app"]);
  const { app } = ctx;

  let valCache = null; // { doc, rows, summary }

  function isWellFormed(raw) {
    const doc = new DOMParser().parseFromString(raw, "application/xml");
    const err = doc.querySelector("parsererror");
    return { ok: !err, message: err ? err.textContent.replace(/\s+/g, " ").trim().slice(0, 200) : "" };
  }

  function computeValidation() {
    if (valCache && valCache.doc === app.state.doc) return valCache;

    const raw = serialize(app.state);
    const summary = structuralSummary(app.state);
    const rows = [];

    // Well-formedness
    const wf = isWellFormed(raw);
    rows.push([wf.ok ? "ok" : "err", wf.ok ? "Well-formed XML" : `Not well-formed: ${wf.message}`]);

    // Structural integrity vs the loaded baseline (lossless round-trip evidence).
    // Compares real @xml:id values, so a lossless edit that drops a synthetic cell
    // id (e.g. emptying a line in an id-less edition) does not raise a false alarm.
    const base = app.baseline;
    const curIds = xmlIdSet(app.state);
    const missing = [...base.xmlIds].filter((id) => !curIds.has(id));
    const added = [...curIds].filter((id) => !base.xmlIds.has(id)).length;
    if (!missing.length && added === 0) {
      rows.push(["ok", base.xmlIds.size
        ? `All ${base.xmlIds.size} xml:id(s) preserved (no structural loss)`
        : `All ${base.wordCount} reading unit(s) preserved (no xml:id to lose)`]);
    } else {
      if (missing.length) rows.push(["err", `${missing.length} xml:id(s) lost: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "..." : ""}`]);
      if (added) rows.push(["warn", `${added} new xml:id(s) added`]);
    }

    // Tag-count drift vs baseline
    const drift = [];
    for (const t of Object.keys(base.counts)) {
      if (summary.counts[t] !== base.counts[t]) drift.push(`${t}: ${base.counts[t]} -> ${summary.counts[t]}`);
    }
    rows.push(drift.length
      ? ["warn", `Tag counts changed: ${drift.join("; ")}`]
      : ["ok", "Element counts unchanged"]);

    valCache = { doc: app.state.doc, rows, summary };
    return valCache;
  }

  function renderValidation() {
    const chip = $("ed-val-chip");
    const pop = $("ed-val-pop");
    if (!chip || !pop) return;
    if (!app.state) { chip.hidden = true; pop.hidden = true; valCache = null; return; }

    const { rows, summary } = computeValidation();

    // Chip: worst level wins; the label stays short and truthful.
    const errs = rows.filter((r) => r[0] === "err").length;
    const warns = rows.filter((r) => r[0] === "warn").length;
    const level = errs ? "err" : warns ? "warn" : "ok";
    chip.hidden = false;
    chip.className = "ed-val-chip " + level;
    chip.textContent = errs ? "checks failing" : warns ? `checks: ${warns} warning(s)` : "well-formed, lossless";
    chip.title = "Live checks. well-formed: the XML parses without errors. "
      + "lossless: saving now would reproduce the opened file byte for byte, apart from your own edits "
      + "(no ids lost, element counts unchanged). Full RelaxNG and Schematron run in the offline harness. "
      + "Click for details.";

    // Detail popover
    clear(pop);
    const sec1 = el("div", { class: "ed-section" }, [el("h4", { text: "Live checks" })]);
    for (const [kind, text] of rows) sec1.appendChild(valRow(kind, text));
    pop.appendChild(sec1);

    const sec2 = el("div", { class: "ed-section" }, [el("h4", { text: "Structure" })]);
    sec2.appendChild(kv("Folios", summary.folios));
    sec2.appendChild(kv("Words", summary.words));
    sec2.appendChild(kv("xml:id count", summary.ids));
    for (const t of ["surface", "zone", "l", "lb", "pb", "note", "standOff"]) {
      if (summary.counts[t]) sec2.appendChild(kv(`<${t}>`, summary.counts[t]));
    }
    pop.appendChild(sec2);
  }

  function valRow(kind, text) {
    const cls = kind === "ok" ? "ed-val-ok" : kind === "warn" ? "ed-val-warn" : "ed-val-err";
    const icon = kind === "ok" ? "OK" : kind === "warn" ? "!" : "x";
    return el("div", { class: `ed-val-row ${cls}` }, [
      el("span", { class: "ed-val-icon", text: icon }),
      el("span", { text }),
    ]);
  }

  function kv(label, value) {
    return el("div", { class: "ed-kv" }, [el("span", { text: label }), el("b", { text: String(value) })]);
  }

  return { isWellFormed, renderValidation };
}
