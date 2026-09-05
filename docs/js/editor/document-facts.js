/**
 * teiCrafter Editor -- document-identity surfaces.
 *
 * The factual, no-invented-data views of the loaded document: the slim strip
 * under the toolbar (#ed-docstrip), including the neutral plaintext-draft badge;
 * the editing-unit derivation it shares; and versioned local recovery wiring
 * for canonical XML, staged input, project settings and attached image blobs.
 *
 * Contract:
 *   createDocumentFacts(ctx) -> {
 *     editingUnit,
 *     updateDocStrip,
 *     showDraftBanner, hideDraftBanner,
 *     isUnsavedDraft, persistDraftIfNeeded, clearDraftRecovery,
 *     renderDraftRecovery, restoreDraft,
 *   }
 *   ctx: {
 *     app,                       // shared mutable editor state (state, source, fileHandle, docName, ...)
 *     setStatus(msg), setDirty(d),
 *     load(raw, name, handle, project) -> Promise<boolean>,  // for restoreDraft
 *     render(),                  // full re-render (empty pane offer, after discard)
 *     renderActivePanel(),       // re-render the active context panel after a restore
 *   }
 */

import { el, clear } from "./dom.js";
import { typeForFile, parseManifest } from "./project-manifest.js";
import { captureCheckpoint, createRecoveryStore, migrateLegacyDraft } from "./session-recovery.js";
import { createRecoveryCoordinator } from "./recovery-coordinator.js";
import { requireCtx } from "./ctx.js";
import { unitTerms } from "./unit-labels.js";

const $ = (id) => document.getElementById(id);

export function createDocumentFacts(ctx) {
  requireCtx("createDocumentFacts", ctx,
    ["setStatus", "setDirty", "load", "render", "renderActivePanel"],
    ["app"]);
  const { app, setStatus, setDirty, load, render, renderActivePanel } = ctx;
  const recovery = createRecoveryStore();
  const reportRecoveryError = (err) => setStatus(`Local recovery failed: ${err.message}. Download a working copy to keep your work.`);
  const checkpoints = createRecoveryCoordinator({
    store: recovery,
    capture: () => app.state && app.recoveryId
      ? captureCheckpoint(app, ctx.stagedSnapshot?.() || null, ctx.schemaSnapshot?.() || null) : null,
    onError: reportRecoveryError,
  });

  /** The project in force: the open folder's project wins over a detected one. */
  function activeProject() {
    return app.projectFolder ? app.projectFolder.project : app.project;
  }

  // ---- document facts (strip, panel, title) ---------------------------------

  /** The local editing units present in the current reading projection. */
  function editingUnit(plural = true) {
    const kinds = new Set((app.state?.cells || []).map((cell) => cell.editingKind));
    if (kinds.has("token") && kinds.has("text-run")) return "text runs and tokens";
    if (kinds.has("token")) return plural ? "tokens" : "token";
    if (kinds.has("gap") && kinds.size === 1) return plural ? "gaps" : "gap";
    return plural ? "text runs" : "text run";
  }

  /**
   * The slim document strip under the toolbar: factual, dot-separated, no invented
   * data. Visible only while a document is loaded. It also carries the draft status
   * as a neutral badge (see draftBadgeText); there is no separate Document panel.
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

    // Draft badge: a plaintext-derived, machine-transport, unsaved draft. Neutral
    // by construction (the strip-fact tone, --color-text-secondary), never the
    // violet --color-ai: a deterministic line-by-line transport is not AI output.
    if (isUnsavedDraft()) {
      strip.appendChild(el("span", { class: "ed-docstrip-sep", text: "·" }));
      const badge = el("span", { class: "ed-docstrip-fact",
        text: draftBadgeText(),
        title: "A draft built from a plaintext file: each line became an editable "
          + "line and the text was carried over verbatim, no model involved. Your "
          + "source file is untouched; saving produces the TEI file. Not yet saved." });
      strip.appendChild(badge);
    }

    const facts = [];
    const project = activeProject();
    if (project && project.name) facts.push(`Project: ${project.name}`);
    const docType = typeForFile(app.project, app.docName);
    if (docType) facts.push(`Type: ${docType.label}`);
    facts.push(`Editing unit: ${editingUnit()}`);
    const terms = unitTerms(app.state.sourceProfile);
    facts.push(`${app.state.folios.length} ${app.state.folios.length === 1 ? terms.singular : terms.plural}`);

    for (const f of facts) {
      strip.appendChild(el("span", { class: "ed-docstrip-sep", text: "·" }));
      strip.appendChild(el("span", { class: "ed-docstrip-fact", text: f }));
    }
  }

  /** The draft badge wording, naming the plaintext source when it is known. */
  function draftBadgeText() {
    const src = app.source && app.source.txtName ? app.source.txtName : null;
    return src ? `Draft from ${src} (unsaved)` : "Draft from text (unsaved)";
  }

  // ---- plaintext-draft status -----------------------------------------------
  // The draft status lives in the document strip as a neutral badge (updateDocStrip),
  // derived from app.source; there is no standalone banner. These two remain as the
  // call-site contract: a draft load records its source and refreshes the strip, any
  // other load clears the source so the badge disappears. Deterministic transport,
  // not AI: the badge is neutral, never the violet --color-ai.

  function showDraftBanner(txtName) {
    if (txtName && (!app.source || app.source.kind !== "draft")) {
      app.source = { kind: "draft", txtName };
    }
    updateDocStrip();
  }

  function hideDraftBanner() {
    updateDocStrip();
  }

  // ---- document recovery ---------------------------------------------------
  // Each session has its own checkpoint. Switching files retains earlier work;
  // only a complete native save or explicit discard removes that checkpoint.

  /** True when the current document is an unsaved draft with no file to fall back on. */
  function isUnsavedDraft() {
    return !!(app.state && app.source && app.source.kind === "draft" && !app.fileHandle);
  }

  /** Capture before queueing so a file switch cannot replace the pending revision. */
  function persistDraftIfNeeded() {
    return checkpoints.persist();
  }

  /** Remove this session's checkpoint after earlier queued writes have completed. */
  function clearDraftRecovery(id = app.recoveryId) {
    return checkpoints.remove(id);
  }

  /**
   * Offer to restore an unsaved draft persisted by a previous session (never
   * silent): a small section above Recent files naming the source and the saved
   * time, with Restore and Discard. A restored project draft has no directory
   * handle anymore, so it restores as a handle-less draft (Save downloads).
   */
  async function renderDraftRecovery(box) {
    try {
      await migrateLegacyDraft(recovery);
      const records = await checkpoints.list();
      for (const record of records) renderRecoveryRecord(box, record);
    } catch (err) { reportRecoveryError(err); }
  }

  function renderRecoveryRecord(box, record) {
    const sec = el("div", { class: "ed-recent" });
    sec.appendChild(el("h2", { text: "Recover local work" }));
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
      title: "Restore XML, staged changes and attached images as a working copy" });
    restore.addEventListener("click", () => restoreDraft(record));
    row.appendChild(restore);

    const discard = el("button", { class: "ed-recent-forget", type: "button", text: "Discard",
      title: "Remove this recovered draft" });
    discard.addEventListener("click", async () => {
      if (await checkpoints.remove(record.id)) sec.remove();
    });
    row.appendChild(discard);

    sec.appendChild(list);
    box.appendChild(sec);
  }

  async function restoreDraft(record) {
    // Load the stored raw with no handle, then re-mark it as a handle-less draft
    // so Save falls back to a download and the strip wording matches a draft.
    const project = record.projectManifest ? parseManifest(record.projectManifest) : null;
    if (project && record.localSchemas) project.localSchemas = record.localSchemas;
    if (project && record.schemaBaseUrl) project.schemaBaseUrl = record.schemaBaseUrl;
    const opened = await load(record.raw, record.docName || "draft.xml", null, project, { projectFolder: null });
    if (!opened) return;
    ctx.restoreSchema?.(record.schemaSettings);
    app.recoveryId = record.id;
    app.source = record.source || { kind: "draft", txtName: record.sourceName || null };
    app.fileEncoding = record.fileEncoding || { encoding: "UTF-8", bom: false };
    app.pageImages = new Map((record.images || []).filter((item) => item.blob instanceof Blob)
      .map((item) => [item.name, { blob: item.blob, type: item.type, url: URL.createObjectURL(item.blob), persisted: false }]));
    if (record.staged) ctx.restoreStaged?.(record.staged);
    updateDocStrip();
    renderActivePanel();
    setDirty(true); // unsaved by definition; this also re-persists the slot
    setStatus("Restored local work and attached images. Reopen the project folder to save files there; reconnect any unavailable schema resources before validated export.");
  }

  return {
    editingUnit,
    updateDocStrip,
    showDraftBanner, hideDraftBanner,
    isUnsavedDraft, persistDraftIfNeeded, clearDraftRecovery,
    renderDraftRecovery, restoreDraft,
  };
}
