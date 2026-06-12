/**
 * teiCrafter Editor -- document-identity surfaces.
 *
 * The factual, no-invented-data views of the loaded document: the slim strip
 * under the toolbar (#ed-docstrip), the Document context panel (#ed-document-host),
 * the small derivations they share (editing unit, title, source wording, save
 * target), the plaintext-draft banner (#ed-draftbanner), and the unsaved-draft
 * recovery wiring (persist a handle-less plaintext draft to localStorage on the
 * first dirty change, offer to restore it in the empty reading pane).
 *
 * Contract:
 *   createDocumentFacts(ctx) -> {
 *     editingUnit, docTitle, sourceLabel, saveTargetLabel,
 *     updateDocStrip, renderDocumentPanel,
 *     showDraftBanner, hideDraftBanner,
 *     isUnsavedDraft, persistDraftIfNeeded, clearDraftRecovery,
 *     renderDraftRecovery, restoreDraft,
 *   }
 *   ctx: {
 *     app,                       // shared mutable editor state (state, source, fileHandle, docName, ...)
 *     setStatus(msg), setDirty(d),
 *     load(raw, name, handle, project) -> Promise,  // for restoreDraft
 *     render(),                  // full re-render (empty pane offer, after discard)
 *     renderActivePanel(),       // re-render the active context panel after a restore
 *   }
 */

import { el, clear } from "./dom.js";
import { serialize, xmlIdSet } from "./edition.js";
import { firstByLocal, textOf } from "./tei-document.js";
import { typeForFile } from "./project-manifest.js";
import { saveDraft, loadDraft, clearDraft } from "./draft-recovery.js";
import { requireCtx } from "./ctx.js";

const $ = (id) => document.getElementById(id);

export function createDocumentFacts(ctx) {
  requireCtx("createDocumentFacts", ctx,
    ["setStatus", "setDirty", "load", "render", "renderActivePanel"],
    ["app"]);
  const { app, setStatus, setDirty, load, render, renderActivePanel } = ctx;

  /** The project in force: the open folder's project wins over a detected one. */
  function activeProject() {
    return app.projectFolder ? app.projectFolder.project : app.project;
  }

  // ---- document facts (strip, panel, title) ---------------------------------

  /** The detected editing unit as a plain noun ("words" or "lines"). */
  function editingUnit(plural = true) {
    const word = app.state && app.state.profile === "word";
    return plural ? (word ? "words" : "lines") : (word ? "word" : "line");
  }

  /** The teiHeader <title> text, trimmed, or null when there is none. */
  function docTitle() {
    if (!app.state) return null;
    const node = firstByLocal(app.state.doc.root, "title");
    if (!node) return null;
    const t = textOf(app.state.doc, node).replace(/\s+/g, " ").trim();
    return t || null;
  }

  /** The Source-row wording, shared by the strip context and the Document panel. */
  function sourceLabel() {
    const s = app.source;
    if (!s) return null;
    if (s.kind === "draft") return s.txtName ? `Drafted from ${s.txtName}` : "Drafted from a plaintext file";
    if (s.kind === "example") return s.label || "Loaded example";
    return "Opened TEI file";
  }

  /** Where Save sends the bytes: in place when a target exists, else a download. */
  function saveTargetLabel() {
    if (app.fileHandle) return `in place: ${app.docName}`;
    if (app.saveTarget && app.saveTarget.name) return `in place: ${app.saveTarget.name}`;
    return "download";
  }

  /**
   * The slim document strip under the toolbar: factual, dot-separated, no invented
   * data. Visible only while a document is loaded; a click opens the Document panel.
   */
  function updateDocStrip() {
    const strip = $("ed-docstrip");
    if (!strip) return;
    if (!app.state) { strip.hidden = true; return; }
    strip.hidden = false;
    clear(strip);

    const name = el("span", { class: "ed-docstrip-name" + (app.dirty ? " dirty" : ""),
      text: app.docName || "" });
    if (app.dirty) name.title = "Unsaved changes";
    strip.appendChild(name);

    const facts = [];
    const project = activeProject();
    if (project && project.name) facts.push(`Project: ${project.name}`);
    const docType = typeForFile(app.project, app.docName);
    if (docType) facts.push(`Type: ${docType.label}`);
    facts.push(`Editing unit: ${editingUnit()}`);
    facts.push(`${app.state.folios.length} page(s)`);

    for (const f of facts) {
      strip.appendChild(el("span", { class: "ed-docstrip-sep", text: "·" }));
      strip.appendChild(el("span", { class: "ed-docstrip-fact", text: f }));
    }
  }

  // ---- plaintext-draft banner -----------------------------------------------
  // Deterministic transport, not AI: neutral surface family, never the violet
  // --color-ai. Shown after any plaintext draft creation; dismissible; re-shown
  // only on the next draft. Never shown for an opened .xml.

  function showDraftBanner(txtName) {
    const banner = $("ed-draftbanner");
    const text = $("ed-draftbanner-text");
    if (!banner || !text) return;
    text.textContent = `Drafted from ${txtName}: each line became an editable line, the text was `
      + "carried over verbatim. Your source file is untouched; saving produces the TEI file.";
    banner.hidden = false;
  }

  function hideDraftBanner() {
    const banner = $("ed-draftbanner");
    if (banner) banner.hidden = true;
  }

  // ---- right-pane Document panel ---------------------------------------------

  /**
   * The Document context panel: key-value facts about the loaded document. No
   * invented values; a row whose value is unknown is omitted rather than guessed.
   */
  function renderDocumentPanel() {
    const host = $("ed-document-host");
    if (!host || !app.state) return;
    clear(host);
    const sec = el("div", { class: "ed-section" }, [el("h4", { text: "Document" })]);
    const kv = (label, value) => sec.appendChild(
      el("div", { class: "ed-kv" }, [el("span", { text: label }), el("b", { text: String(value) })]));

    const title = docTitle();
    if (title) kv("Title", title);
    kv("File", app.docName || "(unnamed)");
    const src = sourceLabel();
    if (src) kv("Source", src);
    const project = activeProject();
    kv("Project", project && project.name ? project.name : "none");
    const docType = typeForFile(app.project, app.docName);
    kv("Document type", docType ? docType.label : "not assigned");
    kv("Editing unit", editingUnit());
    kv("Pages", app.state.folios.length);
    kv(editingUnit() === "words" ? "Words" : "Lines", app.state.cells.length);
    kv("xml:id count", xmlIdSet(app.state).size);
    kv("Save target", saveTargetLabel());

    host.appendChild(sec);
  }

  // ---- unsaved-draft recovery -----------------------------------------------
  // A plaintext-derived draft (kind "draft", no file handle) is the only document
  // that has no file behind it: a reload loses it. On the first dirty change it is
  // persisted to localStorage (debounced); a successful save or a non-draft load
  // clears the slot. The empty reading pane offers to restore it (renderDraftRecovery).

  /** True when the current document is an unsaved draft with no file to fall back on. */
  function isUnsavedDraft() {
    return !!(app.state && app.source && app.source.kind === "draft" && !app.fileHandle);
  }

  let _draftTimer = null;
  const DRAFT_DEBOUNCE_MS = 1000;

  /** Debounced persist of the current draft; a no-op for any non-draft document. */
  function persistDraftIfNeeded() {
    if (!isUnsavedDraft()) return;
    if (_draftTimer) clearTimeout(_draftTimer);
    _draftTimer = setTimeout(() => {
      _draftTimer = null;
      if (!isUnsavedDraft()) return;
      saveDraft({
        raw: serialize(app.state),
        docName: app.docName,
        sourceName: app.source.txtName || null,
        savedAt: new Date().toISOString(),
      });
    }, DRAFT_DEBOUNCE_MS);
  }

  /** Drop any pending persist and clear the stored slot (on save or non-draft load). */
  function clearDraftRecovery() {
    if (_draftTimer) { clearTimeout(_draftTimer); _draftTimer = null; }
    clearDraft();
  }

  /**
   * Offer to restore an unsaved draft persisted by a previous session (never
   * silent): a small section above Recent files naming the source and the saved
   * time, with Restore and Discard. A restored project draft has no directory
   * handle anymore, so it restores as a handle-less draft (Save downloads).
   */
  function renderDraftRecovery(box) {
    const record = loadDraft();
    if (!record) return;
    const sec = el("div", { class: "ed-recent" });
    const source = record.sourceName || "a plaintext file";
    sec.appendChild(el("h2", { text: `Unsaved draft from ${source}` }));
    const list = el("div", { class: "ed-recent-list" });

    const row = el("div", { class: "ed-recent-row" });
    row.appendChild(el("span", { class: "ed-recent-name", text: record.docName || "draft" }));
    let when = "";
    if (record.savedAt) {
      const d = new Date(record.savedAt);
      if (!Number.isNaN(d.getTime())) when = d.toLocaleString();
    }
    row.appendChild(el("span", { class: "ed-recent-when", text: when }));
    list.appendChild(row);

    const restore = el("button", { class: "ed-recent-forget", type: "button", text: "Restore",
      title: "Reopen this draft in the editor (Save downloads the TEI file)" });
    restore.addEventListener("click", () => restoreDraft(record));
    row.appendChild(restore);

    const discard = el("button", { class: "ed-recent-forget", type: "button", text: "Discard",
      title: "Remove this recovered draft" });
    discard.addEventListener("click", () => { clearDraftRecovery(); render(); });
    row.appendChild(discard);

    sec.appendChild(list);
    box.appendChild(sec);
  }

  async function restoreDraft(record) {
    // Load the stored raw with no handle, then re-mark it as a handle-less draft
    // so Save falls back to a download and the strip wording matches a draft.
    await load(record.raw, record.docName || "draft.xml", null);
    app.source = { kind: "draft", txtName: record.sourceName || null };
    updateDocStrip();
    renderActivePanel();
    setDirty(true); // unsaved by definition; this also re-persists the slot
    setStatus("Restored an unsaved draft. Save downloads the TEI file.");
  }

  return {
    editingUnit, docTitle, sourceLabel, saveTargetLabel,
    updateDocStrip, renderDocumentPanel,
    showDraftBanner, hideDraftBanner,
    isUnsavedDraft, persistDraftIfNeeded, clearDraftRecovery,
    renderDraftRecovery, restoreDraft,
  };
}
