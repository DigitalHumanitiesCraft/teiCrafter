/**
 * teiCrafter Editor (Editor path) -- UI controller / shell.
 *
 * Wires the deterministic, DOM-free edition core (edition.js) to the shell in
 * editor.html. Deterministic edits and optional model proposals share the
 * canonical session and lossless offset-splice mutation boundary.
 *
 * Since the M2.13 module split this file is the integrator: it owns the shared
 * app state, loading, rendering of the reading text, the live checks,
 * output adapters, note and critical choosers, and
 * the dual-view shell (M2.14): the left pane is the text work surface (reading
 * text or XML source), the right pane hosts a switchable context panel from an
 * open registry (facsimile, entity index; a project profile can contribute
 * more via project.panels). The feature surfaces live in their own modules and
 * receive their dependencies via a ctx object:
 *   - annotation-ui.js   context menu, annotate popover, annotation editor
 *   - entity-index.js    entity index panel + live authority lookup
 *   - source-view.js     editable XML source view
 *   - inline-editor.js   reading text and dual-reading inputs
 *   - staged-input.js    shared unfinished-input ownership
 *   - output-controller.js validated save and download orchestration
 *   - gen-modal.js       LLM on-ramp ("New from text")
 */

import {
  parseEdition,
  xmlIdSet,
  countTags,
  cellRawOffset,
  folioSourceSlice,
  elementSourceSlice,
  spliceSourceSlice,
  applySourceProfile,
} from "./edition.js";
import { splitElement, mergeElements, insertLb, deleteElement } from "./structural.js";
import { walk, decodeEntities } from "./tei-document.js";
import { el, clear } from "./dom.js";
import { createFacsimile, plainImageTileSource } from "./facsimile.js";
import * as standoff from "./standoff.js";
import { markCritical, unwrapCritical, removeGap, CRITICAL_KINDS } from "./criticism.js";
import { createAnnotationUi } from "./annotation-ui.js";
import { createEntityIndex } from "./entity-index.js";
import { mountSourceView } from "./source-view.js";
import { mountMetadataView } from "./metadata-view.js";
import { annotationPageSummary } from "./annotation-progress.js";
import { reviewPageSummary, setFolioReviewed } from "./review-progress.js";
import { chooseReviewDetails } from "./review-dialog.js";
import { setupGenModal } from "./gen-modal.js";
import { setupImageOnramp } from "./image-onramp.js";
import { createPageImages } from "./page-images.js";
import { FEATURES, llmEnabled } from "../utils/constants.js";
import { teiFromPlaintext } from "./plaintext-import.js";
import { teiFromStarter, draftFilename } from "./starter-profiles.js";
import { detectProject, projectTileSource } from "./project-profiles.js";
import { parseManifest, resolveMarkup, teiScopeForFile, typeForFile, mappingFiles, llmForFile } from "./project-manifest.js";
import { complete } from "../services/llm.js";
import { buildSuggestPrompt, parseSuggestions } from "./ai-suggest.js";
import { applyProposals, createProposalScope } from "./proposal-apply.js";
import { createSessionSafety, stageContext } from "./session-safety.js";
import { EditorSession } from "./editor-session.js";
import { historyCommand } from "./history-shortcuts.js";
import { createRevisionCache } from "./revision-cache.js";
import { toInlineGND, inlineGndFilename } from "./inline-gnd.js";
import { targetDocument, usesInlineGND, workingDocument } from "./interchange.js";
import { createProjectFolder } from "./project-folder.js";
import { createValidationView } from "./validation-view.js";
import { schemaSetKey, schemaSources } from "./schema-validation.js";
import { inspectSchemaSources } from "./schema-profile.js";
import { hasGeneratedDraftProvenance } from "./generated-provenance.js";
import { resolveSourceProfile } from "./source-profile.js";
import { unitPositionLabel, unitTerms } from "./unit-labels.js";
import { setupTablist, syncTablist } from "./tabs.js";
import { decodeXmlBytes } from "./file-encoding.js";
import { fileVersion } from "./file-version.js";
import { createDocumentFacts } from "./document-facts.js";
import { captureCheckpoint } from "./session-recovery.js";
import { createStagedInput } from "./staged-input.js";
import { createInlineEditor } from "./inline-editor.js";
import { createOutputController } from "./output-controller.js";
import { downloadFile } from "./download-file.js";
import { encodeWorkingCopy, decodeWorkingCopy } from "./working-copy.js";
import { createReadingView } from "./reading-view.js";
import { hasResponsibility, isPendingProposal } from "./proposal-provenance.js";
import {
  parseGuidelines, elementsForScope, elementByName,
  VENDORED_GUIDELINES_PATH, VENDORED_GUIDELINES_VERSION,
} from "./tei-guidelines.js";
import * as recents from "./recent-files.js";
import { getSetting, setSetting } from "../services/storage.js";

const DEMO_URL = "data/editor/wenzelsbibel-synthetic-codex.xml";
const WB_CODEX_URL = "data/editor/wb-codex/codex-2759.xml";
const ZBZ_URL = "data/editor/zbz-100/zbz-hersch-100.xml";
const ZBZ_IMAGE_BASE = "data/editor/zbz-100/";
const ZBZ_SYNTH_URL = "data/editor/zbz-hersch-synthetic.xml";
const SZD_URL = "data/editor/szd/o_szd.1079.tei.xml";

// ---- state -----------------------------------------------------------------

const app = {
  state: null,        // current edition model (from parseEdition)
  folio: 0,           // current folio index
  fileHandle: null,   // FileSystemFileHandle for save-in-place, or null
  docName: null,      // displayed document name
  dirty: false,       // unsaved changes since last load/save
  baseline: null,     // { wordCount, xmlIds:Set, counts } captured at load, for integrity checks
  noteByWord: new Map(), // target id -> note text array
  noteDetails: new Map(), // target id -> proposal detail array
  currentLines: [],   // lines of the folio currently rendered (for zone <-> line linking)
  generated: false,   // true when the current edition came from the LLM (unreviewed)
  source: null,       // load provenance: { kind: "tei"|"draft"|"example", txtName?, label? } or null
  imageBase: null,    // base dir for per-folio page images, or null (no known images)
  coordScale: 1,      // zone-to-image scale for the facsimile (1 = no scaling). Becomes > 1 only when a IIIF Presentation manifest declares a canvas size different from the served image's pixel size; the live manifest pre-resolution that computes it is deferred (W7), so today it stays 1.
  pageImages: new Map(), // filename -> { url, blob, type }: in-memory page images (uploaded via the on-ramp or read back from the project folder), resolving a surface's <graphic url> to a displayable URL
  panel: "facs",      // id of the active right-pane context panel (see PANELS)
  sourceMode: false,  // false | "page" | "metadata-form" | "metadata" for the left text surface
  readingVariant: "dipl", // F4: "dipl" | "norm", which reading the pane shows (only meaningful when state.hasDualReadings)
  viewMode: "paged",  // reading view: "paged" (one folio, pager) | "continuous" (all folios stacked); persisted per document
  project: null,      // active project: manifest-parsed or PID-detected, or null
  projectFolder: null, // open project folder: { dir, name, files[], project }, or null (M2.9)
  markup: null,       // markup wrap list for the CURRENT document (per its type), or null (built-ins)
  saveTarget: null,   // { dir, name }: create this file in the project folder on first save (plaintext drafts)
  rightCollapsed: false, // true while the context pane is folded away (per-document, persisted)
  proposalRespCreated: new Set(), // @resp declarations inserted during this open document's proposal session
  proposalBaseline: null, // { raw, dirty } before the current group of proposals
  sessionId: 0,
  revision: 0,
  fileEncoding: { encoding: "UTF-8", bom: false },
  fileSnapshot: null,
  recoveryId: null,
  documentDirectory: null,
  readOnly: false,
};

// Persistent facsimile controller (one OSD instance reused across folios),
// created lazily once the DOM host exists.
let facsimile = null;
const stagedInput = createStagedInput({
  current: () => ({ sessionId: app.sessionId, raw: app.state?.raw || "" }),
  blocked: setStatus,
});
const stagedSnapshot = () => stagedInput.snapshot();

function resolveStagedOutput(action) {
  if (stagedInput.apply()) return true;
  void documentFacts.persistDraftIfNeeded();
  setStatus(`${action} needs the visible edits to be applied. Correct them or use Working copy to preserve the unfinished input.`);
  return false;
}
const sessionSafety = createSessionSafety();
let activeSchemaProfile = null;
let schemaProfileRequest = 0;
const schemaProfileCache = new Map();
function profileEditionState(
  state,
  project = app.project,
  fileName = app.docName,
  schemaEvidence = activeSchemaProfile?.evidence || null,
) {
  const sourceProfile = resolveSourceProfile({ doc: state.doc, project, fileName, schemaEvidence });
  return applySourceProfile(state, sourceProfile);
}
const editorSession = new EditorSession((raw) => profileEditionState(parseEdition(raw)));
const projectionCache = createRevisionCache();

function reprojectSchemaProfile(evidence) {
  if (!app.state) return;
  const hadSchemaRestriction = app.state.sourceProfile?.capabilities
    .some((capability) => capability.allowed === false);
  const hasSchemaRestriction = Object.values(evidence?.capabilities || {})
    .some((allowed) => allowed === false);
  const changesNavigation = hadSchemaRestriction || hasSchemaRestriction;
  const nextState = changesNavigation
    ? profileEditionState(parseEdition(app.state.doc.raw), app.project, app.docName, evidence)
    : {
      ...app.state,
      sourceProfile: resolveSourceProfile({
        doc: app.state.doc,
        project: app.project,
        fileName: app.docName,
        schemaEvidence: evidence,
      }),
    };
  editorSession.reproject(nextState);
  app.state = editorSession.state;
  app.noteByWord = standoff.noteIndex(app.state.doc);
  app.noteDetails = standoff.noteDetailIndex(app.state.doc);
  app.folio = Math.max(0, Math.min(app.folio, app.state.folios.length - 1));
  projectionCache.clear();
  if (!changesNavigation || stagedInput.hasChanges()) {
    updateFolioButtons();
    documentFacts.updateDocStrip();
    if (app.panel === "source") renderActivePanel();
    validationView.renderValidation();
  } else {
    render();
  }
}

async function refreshSchemaProfile(sources = validationView.activeSchemaSources()) {
  if (!app.state) return;
  const request = ++schemaProfileRequest;
  const sessionId = app.sessionId;
  const key = schemaSetKey(sources);
  let evidence = schemaProfileCache.get(key);
  if (!evidence) {
    try {
      evidence = await inspectSchemaSources(sources);
    } catch (error) {
      evidence = {
        kind: "schema-set",
        capabilities: {},
        completeness: "unknown",
        issues: [{
          code: "schema-profile-unavailable",
          severity: "warning",
          message: `The active schema set could not be inspected: ${error.message}`,
        }],
      };
    }
    schemaProfileCache.set(key, evidence);
  }
  if (request !== schemaProfileRequest || sessionId !== app.sessionId) return;
  if (schemaSetKey(validationView.activeSchemaSources()) !== key) return;
  activeSchemaProfile = { key, evidence };
  reprojectSchemaProfile(evidence);
}

function handleSchemaSourcesChanged(sources) {
  schemaProfileRequest++;
  activeSchemaProfile = null;
  reprojectSchemaProfile(null);
  void refreshSchemaProfile(sources);
}

const $ = (id) => document.getElementById(id);

// ---- status / dirty --------------------------------------------------------

/**
 * Action feedback in the footer: what just happened (loaded, saved, failed).
 * Empty by default and hidden when empty; it is a transient report line, not
 * an ambient state display (the live checks have their own chip).
 */
function setStatus(msg) {
  $("ed-status").textContent = msg || "";
  const wrap = $("ed-status-wrap");
  if (wrap) wrap.hidden = !msg;
}

function setDirty(d) {
  if (app.state) {
    sessionSafety.sync(app.state.doc.raw);
    app.sessionId = editorSession.sessionId;
    app.revision = editorSession.revision;
    if (!d) editorSession.markSaved();
  }
  app.dirty = d;
  const dot = $("ed-status-dot");
  dot.classList.toggle("dirty", d);
  $("btn-save").disabled = !app.state;
  if (d) { setStatus("Unsaved changes"); documentFacts.persistDraftIfNeeded(); }
  if (app.state) documentFacts.updateDocStrip();
  updateHistoryControls();
}

function updateHistoryControls() {
  const undo = $("btn-undo");
  const redo = $("btn-redo");
  if (!undo || !redo) return;
  const undoLabel = app.state ? editorSession.undoLabel() : null;
  const redoLabel = app.state ? editorSession.redoLabel() : null;
  undo.disabled = !undoLabel;
  redo.disabled = !redoLabel;
  undo.setAttribute("aria-label", undoLabel ? `Undo ${undoLabel}` : "Undo document edit");
  redo.setAttribute("aria-label", redoLabel ? `Redo ${redoLabel}` : "Redo document edit");
  undo.title = undoLabel
    ? `Undo ${undoLabel} (Ctrl/Cmd+Z)`
    : "Nothing to undo (Ctrl/Cmd+Z)";
  redo.title = redoLabel
    ? `Redo ${redoLabel} (Ctrl/Cmd+Shift+Z)`
    : "Nothing to redo (Ctrl/Cmd+Shift+Z)";
}

/** Adopt the EditorSession state and refresh every revision-derived projection. */
function adoptSessionState(notes = null) {
  app.state = editorSession.state;
  app.noteByWord = notes || standoff.noteIndex(app.state.doc);
  app.noteDetails = standoff.noteDetailIndex(app.state.doc);
  app.folio = Math.max(0, Math.min(app.folio, app.state.folios.length - 1));
  setDirty(editorSession.dirty);
  if (!editorSession.dirty) void documentFacts.persistDraftIfNeeded();
}

function replaceSessionState(nextState, label, notes = null) {
  if (stagedInput.hasChanges()) throw new Error("Apply or cancel the visible edits before changing the document.");
  if (!editorSession.replace(profileEditionState(nextState), label)) return false;
  adoptSessionState(notes);
  return true;
}

function syncDocumentMode() {
  const button = $("btn-read-only");
  button.textContent = app.readOnly ? "Edit document" : "Read only";
  button.setAttribute("aria-pressed", String(app.readOnly));
  button.title = app.readOnly ? "Document is read only. Enable editing deliberately." : "Read and navigate without changing document content";
  document.body.classList.toggle("ed-read-only", app.readOnly);
  updateHistoryControls();
  applyLlmGate();
}

function toggleDocumentMode() {
  if (!app.state) return;
  if (stagedSnapshot()) {
    setStatus("Apply or cancel the visible edits before entering Read only. Working copy can preserve unfinished input.");
    return;
  }
  app.readOnly = !app.readOnly;
  editorSession.readOnly = app.readOnly;
  annot.removeMenu();
  annot.removeSelPopover();
  syncDocumentMode();
  render();
  setStatus(app.readOnly ? "Read only: text, XML, metadata, annotations and review are protected. Navigation and copying remain available." : "Document editing enabled.");
}

function applyHistory(command) {
  if (!app.state || app.readOnly) return false;
  if (!stagedInput.allowChange("undoing document edits")) return false;
  const result = command === "redo" ? editorSession.redo() : editorSession.undo();
  if (!result) return false;
  adoptSessionState();
  setStatus(`${command === "redo" ? "Redid" : "Undid"}: ${result.label}`);
  refreshAfterStandoffEdit();
  return true;
}

function enableControls(on) {
  $("btn-download").disabled = !on;
  $("btn-working-copy").disabled = !on;
  $("btn-save").disabled = !on;
  // The editor chrome is always present; only the document-scoped toolbar
  // group (Save/Download and the document name) toggles with a loaded document.
  for (const n of document.querySelectorAll(".ed-tool-doc")) n.hidden = !on;
  if (!on) {
    app.sourceMode = false;
    syncViewTabs();
  }
  // M2.5 legend strip: visible while a document is loaded;
  // render() keeps the chips current after every mutation.
  if (on) buildLegend(); else $("ed-legend").hidden = true;
  syncInlineExport();
  syncFacsimileFolderAction();
  updateFolioButtons();
  updatePanels();
}

/** The left pane's view switcher reflects app.sourceMode (one source of truth). */
function syncViewTabs() {
  const reading = $("view-reading");
  const xml = $("view-xml");
  const metadata = $("view-metadata");
  if (!reading || !xml || !metadata) return;
  // All text views need a document; until one loads the tabs stay inert.
  reading.disabled = xml.disabled = !app.state;
  metadata.disabled = !app.state || !elementSourceSlice(app.state, "teiHeader");
  // The view controls (zoom, collapse) belong with a loaded document.
  const vc = $("ed-view-controls");
  if (vc) vc.hidden = !app.state;
  reading.classList.toggle("active", !app.sourceMode);
  reading.setAttribute("aria-selected", String(!app.sourceMode));
  xml.classList.toggle("active", app.sourceMode === "page");
  xml.setAttribute("aria-selected", String(app.sourceMode === "page"));
  const metadataActive = app.sourceMode === "metadata-form" || app.sourceMode === "metadata";
  metadata.classList.toggle("active", metadataActive);
  metadata.setAttribute("aria-selected", String(metadataActive));
  const panel = $("ed-reading");
  if (panel) panel.setAttribute("aria-labelledby",
    metadataActive ? metadata.id : app.sourceMode === "page" ? xml.id : reading.id);
  syncReadingVariant();
}

/**
 * F4 reading-variant switcher (Diplomatic / Normalized): only meaningful for a
 * document that carries dual readings, and only in the reading view. Hidden (not
 * disabled) otherwise, like the other document controls. Reflects app.readingVariant.
 */
function syncReadingVariant() {
  const wrap = $("ed-reading-variant");
  if (!wrap) return;
  const show = !!app.state && app.state.hasDualReadings && !app.sourceMode;
  wrap.hidden = !show;
  const dipl = $("variant-dipl");
  const norm = $("variant-norm");
  if (!dipl || !norm) return;
  const isNorm = app.readingVariant === "norm";
  dipl.classList.toggle("active", !isNorm);
  dipl.setAttribute("aria-selected", String(!isNorm));
  norm.classList.toggle("active", isNorm);
  norm.setAttribute("aria-selected", String(isNorm));
}

function setReadingVariant(variant) {
  if (!stagedInput.allowChange("changing the reading variant")) return;
  if (variant !== "dipl" && variant !== "norm") return;
  if (app.readingVariant === variant) return;
  app.readingVariant = variant;
  saveDocLayout({ reading: variant });
  render();
}

/**
 * M2.5 legend chips: one chip per visual code PRESENT in the current document,
 * rebuilt on every render, so the legend names exactly what the reading text can
 * show (no violet chip in a purely human edition, no chip for an absent code).
 * Chip labels reuse the index-panel section terms (singular) and the
 * CRITICAL_KINDS labels, so every code reads the same everywhere. The temporary
 * selection highlight (mention-hit) is announced by the status line instead.
 * Help is tooltip-only (operator decision 2026-06-10): no ambient hint text.
 */
// One source for "does this cell carry a model-proposed (AI) wrapping layer": the
// projection records each layer's @resp, and the active responsibility id is
// app.aiResp (the project's, or the default). Shared by the render, the legend and
// the tooltip so the three cannot drift, and so a custom responsibility id is honoured.
function cellHasAiLayer(cell) {
  return !!(cell && cell.layers && cell.layers.some((layer) => isPendingProposal(layer.el, app.aiResp)));
}

function buildLegend() {
  const host = $("ed-legend-chips");
  if (!host) return;
  clear(host);
  // The legend explains the reading-text codes; in the XML source view it is
  // dead vertical space, so it hides with the reading text.
  $("ed-legend").hidden = !app.state || app.sourceMode;
  if (!app.state || app.sourceMode) return;

  const { kinds, crits, ai, dangling, hasNote } = legendProjection();

  const chips = [];
  const chip = (cls, label) => chips.push(el("span", { class: "ed-legend-chip " + cls, text: label }));
  if (kinds.has("pers")) chip("mention mention-pers", "person");
  if (kinds.has("plc")) chip("mention mention-plc", "place");
  if (kinds.has("org")) chip("mention mention-org", "organisation");
  if (kinds.has("wrk")) chip("mention mention-wrk", "work");
  if (kinds.has("evt")) chip("mention mention-evt", "event");
  if (ai) chip("mention mention-ai", "AI-proposed");
  if (dangling) chip("mention", "missing entity");
  for (const kind of Object.keys(CRITICAL_KINDS)) {
    if (crits.has(kind)) chip("crit-" + kind, CRITICAL_KINDS[kind].label);
  }
  if (hasNote) chip("has-note", "note");

  // Nothing to legend (no mentions, criticism or notes in this document): hide
  // the strip rather than leave an empty rule, like the other ambient surfaces.
  if (!chips.length) { $("ed-legend").hidden = true; return; }
  host.appendChild(el("span", { class: "ed-legend-title", text: "legend" }));
  for (const c of chips) host.appendChild(c);
}

function legendProjection() {
  return projectionCache.get(app, "legend", () => {
    const meta = entityMetaMap();
    const kinds = new Set();
    const crits = new Set();
    let ai = false, dangling = false;
    for (const cell of app.state.cells) {
      if (cell.crit) crits.add(cell.crit);
      if (cellHasAiLayer(cell)) ai = true;
      if (cell.gap || !cell.mention) continue;
      const mention = meta.get(cell.mention);
      if (!mention) { dangling = true; continue; }
      kinds.add(mention.kind);
      if (mention.ai) ai = true;
    }
    return { kinds, crits, ai, dangling, hasNote: app.noteByWord.size > 0 };
  });
}

// ---- TEI Guidelines (lazy, never at boot) -----------------------------------
// The vendored P5 compilation (docs/data/tei/, see its NOTICE.md) loads once on
// demand: an idle prefetch fires when a loaded document's project declares a
// TEI scope; any other consumer awaits ensureGuidelines() as the fallback.
// Every failure resolves to null with one status line; the editor then keeps
// working on the explicit markup alone (the degradation contract).

let _guidelines = null;
let _guidelinesPromise = null;
let _guidelinesFailed = false;

function ensureGuidelines() {
  if (_guidelinesPromise) return _guidelinesPromise;
  _guidelinesPromise = fetch(VENDORED_GUIDELINES_PATH, { cache: "force-cache" })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((json) => {
      _guidelines = parseGuidelines(json, VENDORED_GUIDELINES_VERSION);
      recomputeMarkup();
      updatePanels();
      return _guidelines;
    })
    .catch((err) => {
      _guidelinesFailed = true;
      setStatus(`TEI vocabulary not available (${err.message}); explicit markup stays in force`);
      updatePanels();
      return null;
    });
  return _guidelinesPromise;
}

const guidelinesNow = () => _guidelines;

/** Re-derive the wrap list when the guidelines arrive after the document. */
function recomputeMarkup() {
  if (!app.state) return;
  app.markup = resolveMarkup(app.project, app.docName, _guidelines);
}

/** Idle prefetch once a loaded document's project declares a TEI scope. */
function maybePrefetchGuidelines(name) {
  if (_guidelinesPromise) return;
  const scope = teiScopeForFile(app.project, name);
  if (!scope.modules.length && !scope.elements.length) return;
  const idle = window.requestIdleCallback || ((f) => setTimeout(f, 0));
  idle(() => ensureGuidelines());
}

/**
 * The project panel's TEI vocabulary line: which scope the project declares
 * and whether the vendored data is loaded. Null when no scope is declared
 * (detected profiles and pre-scope manifests show nothing).
 */
function teiVocabularyLine() {
  const project = app.projectFolder ? app.projectFolder.project : app.project;
  if (!project) return null;
  const modules = new Set(project.teiScope ? project.teiScope.modules : []);
  const elements = new Set(project.teiScope ? project.teiScope.elements : []);
  for (const t of project.documentTypes || []) {
    if (!t.teiScope) continue;
    for (const m of t.teiScope.modules) modules.add(m);
    for (const e of t.teiScope.elements) elements.add(e);
  }
  if (!modules.size && !elements.size) return null;
  if (_guidelinesFailed) return "TEI vocabulary not available; explicit markup applies";
  if (!_guidelines) return `TEI vocabulary (P5 ${VENDORED_GUIDELINES_VERSION}) loads on first use`;
  const inScope = elementsForScope(_guidelines, { modules: [...modules], elements: [...elements] }).length;
  const parts = [];
  if (modules.size) parts.push(`modules ${[...modules].join(", ")}`);
  if (elements.size) parts.push(`${elements.size} named element(s)`);
  return `TEI P5 ${VENDORED_GUIDELINES_VERSION}: ${parts.join(", ")} (${inScope} elements in scope)`;
}

// ---- loading ---------------------------------------------------------------

// Large documents (the Wenzelsbibel codex is tens of MB) parse synchronously on
// the main thread for a second or more. Above this size load() shows a loading
// overlay and yields two frames so the spinner actually paints before the parse
// blocks the thread; smaller documents take the synchronous fast path.
const BIG_DOC_CHARS = 2_000_000;
const nextPaint = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
const currentRaw = () => app.state ? app.state.doc.raw : null;

async function readXmlFile(file) {
  const decoded = decodeXmlBytes(await file.arrayBuffer());
  return {
    raw: decoded.text,
    fileEncoding: { encoding: decoded.encoding, bom: decoded.bom },
    fileSnapshot: fileVersion(file),
  };
}

function authorizeDocumentReplacement() {
  if (!confirmDiscard()) return null;
  return sessionSafety.snapshot({ kind: "document-replacement" });
}

function showLoading(name) {
  const label = $("ed-loading-label");
  if (label) label.textContent = name ? `Loading ${name}...` : "Loading...";
  const o = $("ed-loading");
  if (o) o.hidden = false;
}
function hideLoading() {
  const o = $("ed-loading");
  if (o) o.hidden = true;
}

async function load(raw, name, handle, project, opts) {
  const options = opts || {};
  const suppliedAuthorization = Object.prototype.hasOwnProperty.call(options, "replacement");
  const replacement = suppliedAuthorization ? options.replacement : authorizeDocumentReplacement();
  if (!replacement || !sessionSafety.isSnapshotCurrent(replacement, currentRaw())) {
    if (!suppliedAuthorization) setStatus("The current document was kept.");
    return false;
  }
  const adoptsFolder = Object.prototype.hasOwnProperty.call(options, "projectFolder");
  const folderContext = adoptsFolder ? stageContext(app, "projectFolder", options.projectFolder) : null;
  if (raw.length <= BIG_DOC_CHARS) {
    try {
      applyLoad(raw, name, handle, project, options);
      if (folderContext) folderContext.commit();
    } catch (err) {
      if (folderContext) folderContext.rollback();
      throw err;
    }
    return true;
  }
  showLoading(name);
  await nextPaint();
  try {
    if (!sessionSafety.isSnapshotCurrent(replacement, currentRaw())) {
      if (folderContext) folderContext.rollback();
      return false;
    }
    applyLoad(raw, name, handle, project, options);
    if (folderContext) folderContext.commit();
    return true;
  } catch (err) {
    if (folderContext) folderContext.rollback();
    throw err;
  } finally { hideLoading(); }
}

function applyLoad(raw, name, handle, project, opts = {}) {
  const t0 = performance.now();
  schemaProfileRequest++;
  activeSchemaProfile = null;
  const openedState = parseEdition(raw);
  const resolvedProject = project || detectProject(openedState.doc);
  const workingDoc = workingDocument(openedState.doc, resolvedProject);
  const importedInterchange = workingDoc !== openedState.doc;
  const workingState = importedInterchange ? parseEdition(workingDoc.raw) : openedState;
  stagedInput.clear();
  editorSession.load(profileEditionState(workingState, resolvedProject, name));
  app.readOnly = editorSession.readOnly = !!opts.readOnly;
  syncDocumentMode();
  app.state = editorSession.state;
  sessionSafety.replace(app.state.doc.raw);
  app.sessionId = editorSession.sessionId;
  app.revision = editorSession.revision;
  app.folio = 0;
  app.recoveryId = crypto.randomUUID();
  app.sourceMode = false;
  app.fileHandle = handle || null;
  app.documentDirectory = opts.directory || null;
  app.fileEncoding = opts.fileEncoding || { encoding: "UTF-8", bom: false };
  app.fileSnapshot = handle && opts.fileSnapshot ? opts.fileSnapshot : null;
  app.docName = name;
  app.noteByWord = standoff.noteIndex(app.state.doc);
  app.noteDetails = standoff.noteDetailIndex(app.state.doc);
  // Default: no known page images. An example with an imageBase (loadExample)
  // sets it afterwards; every other entry (open, drop, generate) stays null.
  app.imageBase = null;
  // No zone-to-image scaling until a project source declares one (deferred IIIF
  // Presentation pre-resolution). Reset per load so a prior document's scale
  // never lingers.
  app.coordScale = 1;
  // In-memory page images: revoke the previous document's, then adopt the set the
  // caller hands in (the on-ramp builds one keyed by the surface <graphic url>).
  // A document opened from a project folder resolves its filenames afterwards
  // (pageImageStore.resolveFromFolder), so reopening a saved edition shows them.
  pageImageStore.revoke();
  if (opts.pageImages instanceof Map) app.pageImages = opts.pageImages;
  // Project: an explicit manifest (teicrafter.project.json, parsed by the
  // caller) wins; PID detection stays the fallback for bare files. The markup
  // wrap list binds to the document's TYPE within the project, not the project.
  app.project = resolvedProject;
  // Load provenance for the draft badge in the document strip. Default: an opened
  // TEI file. The plaintext and example paths override this after load() returns.
  app.source = { kind: "tei" };
  app.markup = resolveMarkup(app.project, name, guidelinesNow());
  // The active AI responsibility id for this document: a project may set its own via
  // the llm block (type-aware), else the default "#ai". The provenance render reads
  // this, so a proposed construct shows violet whatever the configured id.
  app.aiResp = (llmForFile(app.project, name) || {}).responsibility || standoff.AI_RESP;
  app.proposalRespCreated = new Set();
  app.proposalBaseline = null;
  maybePrefetchGuidelines(name);
  app.saveTarget = null;
  // Track real @xml:id values (not synthetic positional cell ids, which churn on
  // a lossless line-emptying edit and would raise a false "id lost" alarm).
  app.baseline = {
    wordCount: app.state.words.length,
    xmlIds: xmlIdSet(app.state),
    counts: countTags(app.state.doc.raw),
  };
  // Default context panel: the facsimile when the document has page images, the
  // entity Index otherwise.
  app.panel = docHasImages() ? "facs" : "index";
  // F4: the reading variant resets to diplomatic per load; applyDocLayout then
  // restores the persisted value when this document had one.
  app.readingVariant = "dipl";
  // Reading view defaults to paged; applyDocLayout restores a persisted choice.
  app.viewMode = "paged";
  enableControls(true);
  applyDocLayout();
  if (handle) { recents.rememberRecent(handle, name); }
  setDirty(false);
  // The recovery slot is NOT cleared here: loading another document must not
  // silently discard a stored draft. It clears only when the draft itself is
  // saved or the operator discards the offer; a new draft overwrites the slot.
  markGenerated(hasGeneratedDraftProvenance(app.state.doc, app.aiResp));
  // The draft badge is derived from app.source, which this load already reset to
  // { kind: "tei" }; refreshing the strip clears any draft badge from a prior
  // document. The draft paths re-set app.source afterwards. It must never linger
  // over an opened .xml.
  documentFacts.hideDraftBanner();
  refreshAfterStandoffEdit();
  void refreshSchemaProfile();
  // A folder-opened edition resolves its page-image filenames against the folder
  // (async, best-effort); the on-ramp's in-memory images are already resolved.
  pageImageStore.resolveFromFolder();
  const editingKinds = new Set(app.state.cells.map((cell) => cell.editingKind));
  const editingUnits = editingKinds.has("token") && editingKinds.has("text-run")
    ? "mixed text runs and tokens"
    : editingKinds.has("token") ? "tokens" : "text runs";
  const terms = unitTerms(app.state.sourceProfile);
  const secs = ((performance.now() - t0) / 1000).toFixed(1);
  const docType = typeForFile(app.project, name);
  setStatus(`Loaded ${app.state.folios.length} ${app.state.folios.length === 1 ? terms.singular : terms.plural}, ${app.state.cells.length} ${editingUnits}`
    + (app.project ? `, project: ${app.project.name} (${app.project.source === "manifest" ? "manifest" : "detected"})` : "")
    + (docType ? `, type: ${docType.label}` : "")
    + (importedInterchange ? ", inline-GND opened in the editable register model" : "")
    + ` in ${secs}s`);
}

function markGenerated(on) {
  app.generated = on;
  const b = $("ed-genbanner");
  if (b) b.hidden = !on;
}

// Plaintext (.txt or .md) opened directly (picker, input fallback, or drop)
// becomes the same deterministic line-level draft as in the project flow, but
// without a save target: the draft carries no file handle, so the first save
// falls back to downloading the .xml. Only the project flow creates it in place.
const RE_PLAINTEXT = /\.(txt|md)$/i;

/**
 * Load a freshly built plaintext draft and mark it as such: draft provenance,
 * the neutral banner, the document strip, and the status line. Shared by the
 * direct plaintext path and the text+image on-ramp (opts.pageImages flows the
 * attached images through load). The caller sets dirty/saveTarget as it needs.
 */
async function adoptDraft({ tei, xmlName, txtName, project, pageImages, statusMsg, replacement }) {
  const options = {};
  if (pageImages) options.pageImages = pageImages;
  if (replacement) options.replacement = replacement;
  const opened = await load(tei, xmlName, null, project || null, options);
  if (!opened) return false;
  app.source = { kind: "draft", txtName };
  if (statusMsg) setStatus(statusMsg);
  documentFacts.updateDocStrip(); // app.source set above; the strip derives the draft badge
  renderActivePanel();
  return true;
}

async function loadPlaintextDraft(text, txtName) {
  const baseName = txtName.replace(RE_PLAINTEXT, "");
  const xmlName = `${baseName}.xml`;
  // A direct draft has no save target, so Save downloads the TEI file (the
  // project flow's wording differs: "writes it into the folder").
  await adoptDraft({
    tei: teiFromPlaintext(text, baseName), xmlName, txtName,
    statusMsg: `Drafted ${xmlName} deterministically from ${txtName} (text carried verbatim). Save downloads the TEI file.`,
  });
}

async function openLocal() {
  // Preferred: File System Access API (lets us save in place later).
  if (window.showOpenFilePicker) {
    let picked = false;
    let pickedName = "the selected file";
    try {
      const [handle] = await window.showOpenFilePicker({
        // One combined filter: the picker shows all supported files at once
        // instead of hiding .txt/.md behind a second dropdown entry.
        types: [{
          description: "XML or text files",
          accept: {
            "application/xml": [".xml"],
            "text/xml": [".xml"],
            "text/plain": [".txt"],
            "text/markdown": [".md"],
          },
        }],
        excludeAcceptAllOption: false,
        multiple: false,
      });
      const file = await handle.getFile();
      picked = true;
      pickedName = file.name;
      if (RE_PLAINTEXT.test(file.name)) {
        await loadPlaintextDraft(await file.text(), file.name);
      } else {
        const decoded = await readXmlFile(file);
        await load(decoded.raw, file.name, handle, null, decoded);
      }
      return;
    } catch (err) {
      if (err && err.name === "AbortError") return; // user cancelled
      if (picked) {
        setStatus(`Could not open ${pickedName}: ${err.message}`);
        return;
      }
      // The picker itself failed before yielding a file; use the input fallback.
    }
  }
  fileInput().click();
}

let _fileInput = null;
function fileInput() {
  if (_fileInput) return _fileInput;
  _fileInput = el("input", { type: "file", accept: ".xml,.txt,.md,application/xml,text/xml,text/plain,text/markdown", style: "display:none" });
  _fileInput.addEventListener("change", async () => {
    const file = _fileInput.files && _fileInput.files[0];
    if (!file) return;
    try {
      if (RE_PLAINTEXT.test(file.name)) {
        await loadPlaintextDraft(await file.text(), file.name);
      } else {
        const decoded = await readXmlFile(file);
        await load(decoded.raw, file.name, null, null, decoded);
      }
    } catch (err) {
      setStatus(`Could not open ${file.name}: ${err.message}`);
    } finally {
      _fileInput.value = "";
    }
  });
  document.body.appendChild(_fileInput);
  return _fileInput;
}

// Example registry: the toolbar menu and the landing-page deep links
// (#example=KEY) load the same way. imageBase: local page images
// next to the XML; without it the facsimile uses each surface's <graphic url>.
// fallback: tried when the primary URL is absent (the real Wenzelsbibel codex
// is licence-restricted, lives only on machines that materialized it, and the
// public deployment serves the synthetic twin instead).
const EXAMPLES = {
  wb: {
    label: "Wenzelsbibel", url: WB_CODEX_URL, file: "codex-2759.xml",
    manifest: "data/editor/wb-codex/teicrafter.project.json",
    done: "Loaded the real Wenzelsbibel codex (facsimile via IIIF).",
    fallback: {
      label: "synthetic Wenzelsbibel", url: DEMO_URL, file: "wenzelsbibel-synthetic-codex.xml",
      done: "Loaded the synthetic Wenzelsbibel twin (the real codex is not present here).",
    },
  },
  zbz: {
    label: "ZBZ Jeanne Hersch example", url: ZBZ_URL, file: "zbz-hersch-100.xml",
    manifest: "data/editor/zbz-100/teicrafter.project.json",
    imageBase: ZBZ_IMAGE_BASE, done: "Loaded the ZBZ Jeanne Hersch example with real page images.",
    fallback: {
      label: "synthetic ZBZ Hersch sample", url: ZBZ_SYNTH_URL, file: "zbz-hersch-synthetic.xml",
      done: "Loaded the synthetic ZBZ Hersch sample (the rights-restricted original is not present here).",
    },
  },
  szd: {
    label: "Stefan Zweig Digital example", url: SZD_URL, file: "o_szd.1079.tei.xml",
    manifest: "data/editor/szd/teicrafter.project.json",
    done: "Loaded the Stefan Zweig Digital example (facsimile via GAMS).",
  },
};

/** Guard before any in-app document replacement (open, example, drop, recent). */
function confirmDiscard() {
  const staged = !!stagedSnapshot();
  return (!app.dirty && !staged)
    || window.confirm(`Discard unsaved changes in ${app.docName}?`);
}

async function loadExample(key) {
  let ex = EXAMPLES[key];
  if (!ex) return;
  const replacement = authorizeDocumentReplacement();
  if (!replacement) return;
  setStatus(`Loading ${ex.label}...`);
  try {
    let res = await fetch(ex.url, { cache: "no-store" });
    if (!res.ok && ex.fallback) {
      ex = ex.fallback;
      setStatus(`Loading ${ex.label}...`);
      res = await fetch(ex.url, { cache: "no-store" });
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // Project manifest next to the example's TEI: a 404 is the normal public
    // deployment (PID detection takes over); a malformed manifest is reported
    // but never blocks the load.
    let project = null, manifestNote = "";
    if (ex.manifest) {
      try {
        const mres = await fetch(ex.manifest, { cache: "no-store" });
        if (mres.ok) {
          project = parseManifest(await mres.text());
          project.schemaBaseUrl = new URL(".", new URL(ex.manifest, location.href)).href;
          // Ingest any Markdown mapping files the manifest references, next to it.
          // A missing mapping degrades to the built-in fallback, never blocks.
          const base = ex.manifest.replace(/[^/]+$/, "");
          const names = mappingFiles(project);
          if (names.length) {
            project.llmMappings = {};
            for (const name of names) {
              try {
                const fr = await fetch(base + name, { cache: "no-store" });
                if (fr.ok) project.llmMappings[name] = await fr.text();
              } catch { /* leave it out; gen-modal falls back to the built-in mapping */ }
            }
          }
        }
      } catch (err) {
        manifestNote = ` ${err.message}; built-in detection used instead.`;
      }
    }
    const decoded = decodeXmlBytes(await res.arrayBuffer());
    const opened = await load(decoded.text, ex.file, null, project, {
      replacement,
      fileEncoding: { encoding: decoded.encoding, bom: decoded.bom },
    });
    if (!opened) return;
    app.source = { kind: "example", label: `Loaded example: ${ex.label}` };
    if (manifestNote && ex.done) ex = { ...ex, done: ex.done + manifestNote };
    if (ex.imageBase) {
      app.imageBase = ex.imageBase;
      app.panel = "facs"; // images exist now; load() chose before imageBase was set
      render();
    }
    if (ex.done) setStatus(ex.done);
  } catch (err) {
    setStatus(`Could not load the ${ex.label}: ${err.message}`);
  }
}

// ---- drag and drop ----------------------------------------------------------
// The whole window is a drop target; a fixed overlay signals the state. When the
// browser can hand over a FileSystemFileHandle, save-in-place works for dropped
// files exactly as for picked ones.

function dragHasFile(e) {
  return e.dataTransfer && Array.from(e.dataTransfer.types || []).includes("Files");
}

async function openDropped(dt) {
  const item = dt.items && dt.items[0];
  const file = dt.files && dt.files[0];
  if (!file) return;
  if (RE_PLAINTEXT.test(file.name)) {
    try {
      await loadPlaintextDraft(await file.text(), file.name);
    } catch (err) {
      setStatus(`Could not open ${file.name}: ${err.message}`);
    }
    return;
  }
  if (!/\.xml$/i.test(file.name)) {
    setStatus(`Not opened: ${file.name} is not an .xml, .txt or .md file.`);
    return;
  }
  // Start the handle request synchronously: a DataTransferItem is only live
  // during the drop event itself (the confirm dialog and any await end that).
  const handlePromise = item && item.getAsFileSystemHandle
    ? item.getAsFileSystemHandle().catch(() => null)
    : Promise.resolve(null);
  const h = await handlePromise;
  const handle = h && h.kind === "file" ? h : null;
  try {
    const decoded = await readXmlFile(file);
    await load(decoded.raw, file.name, handle, null, decoded);
  } catch (err) {
    setStatus(`Could not open ${file.name}: ${err.message}`);
  }
}

function setupDragDrop() {
  const overlay = $("ed-drop");
  let depth = 0;
  const hide = () => { depth = 0; overlay.hidden = true; };
  window.addEventListener("dragenter", (e) => {
    if (!dragHasFile(e)) return;
    e.preventDefault();
    depth++;
    overlay.hidden = false;
  });
  window.addEventListener("dragover", (e) => {
    if (dragHasFile(e)) e.preventDefault();
  });
  window.addEventListener("dragleave", () => {
    if (depth > 0 && --depth === 0) overlay.hidden = true;
  });
  window.addEventListener("drop", (e) => {
    if (!dragHasFile(e)) return;
    e.preventDefault();
    const dt = e.dataTransfer;
    hide();
    openDropped(dt);
  });
}

// ---- recent files (empty-state list) ----------------------------------------

async function reopenRecent(rec) {
  try {
    let perm = await rec.handle.queryPermission({ mode: "readwrite" });
    if (perm !== "granted") perm = await rec.handle.requestPermission({ mode: "readwrite" });
    if (perm !== "granted") {
      setStatus(`Permission to reopen ${rec.name} was not granted.`);
      return;
    }
    const file = await rec.handle.getFile();
    const decoded = await readXmlFile(file);
    await load(decoded.raw, file.name, rec.handle, null, decoded);
  } catch (err) {
    // The file moved or the handle died: drop the stale row instead of failing again.
    await recents.forgetRecent(rec.name);
    renderRecents();
    setStatus(`Could not reopen ${rec.name} (${err.message}); removed it from the recent list.`);
  }
}

async function renderRecents() {
  const sec = $("ed-recent");
  const host = $("ed-recent-list");
  if (!sec || !host || !recents.supported) return;
  const list = await recents.listRecents();
  clear(host);
  sec.hidden = !list.length;
  for (const rec of list) {
    const row = el("button", { class: "ed-recent-row", type: "button",
      title: `Reopen ${rec.name} (asks for file permission again)` });
    row.appendChild(el("span", { class: "ed-recent-name", text: rec.name }));
    row.appendChild(el("span", { class: "ed-recent-when", text: new Date(rec.when).toLocaleDateString() }));
    const forget = el("span", { class: "ed-recent-forget", text: "remove", role: "button",
      title: "Remove this entry from the recent list (the file itself is untouched)" });
    forget.addEventListener("click", async (e) => {
      e.stopPropagation();
      await recents.forgetRecent(rec.name);
      renderRecents();
    });
    row.appendChild(forget);
    row.addEventListener("click", () => reopenRecent(rec));
    host.appendChild(row);
  }
}

// ---- folio navigation ------------------------------------------------------

function closeAnnotationProgress() {
  const popover = $("ed-ann-popover");
  const button = $("ed-ann-summary");
  if (popover) popover.hidden = true;
  if (button) button.setAttribute("aria-expanded", "false");
}

function updateAnnotationProgress() {
  const wrap = $("ed-ann-progress");
  const button = $("ed-ann-summary");
  const caption = $("ed-ann-caption");
  const pagesHost = $("ed-ann-pages");
  if (!wrap || !button || !caption || !pagesHost) return;
  const metadata = app.sourceMode === "metadata" || app.sourceMode === "metadata-form";
  wrap.hidden = !app.state || metadata;
  if (!app.state || metadata) { closeAnnotationProgress(); return; }

  const summary = projectionCache.get(app, "annotation-pages",
    () => annotationPageSummary(app.state, app.noteByWord));
  const current = summary.pages[app.folio];
  const terms = unitTerms(app.state.sourceProfile);
  button.textContent = `Markup ${summary.annotatedPages}/${summary.totalPages}`;
  button.classList.toggle("current", !!(current && current.count));
  button.title = current && current.count
    ? `This ${terms.singular} contains ${current.count} annotation${current.count === 1 ? "" : "s"}. Show all annotated ${terms.plural}.`
    : `This ${terms.singular} has no detected annotations. Show all annotated ${terms.plural}.`;
  caption.textContent = `${summary.annotatedPages} of ${summary.totalPages} ${terms.plural} contain ${summary.totalAnnotations} detected annotations.`;
  clear(pagesHost);
  for (const page of summary.pages.filter((item) => item.count > 0)) {
    const sourceLabel = page.label !== String(page.index + 1) ? `; source label ${page.label}` : "";
    const kinds = [...page.kinds].join(", ");
    const pageButton = el("button", {
      class: "ed-ann-page" + (page.index === app.folio ? " active" : ""),
      type: "button", text: String(page.index + 1),
      title: `${terms.singular} ${page.index + 1}${sourceLabel}: ${page.count} annotation${page.count === 1 ? "" : "s"}${kinds ? ` (${kinds})` : ""}`,
      "aria-label": `Go to annotated ${terms.singular} ${page.index + 1}`,
    });
    pageButton.addEventListener("click", () => {
      closeAnnotationProgress();
      gotoFolio(page.index);
      if (app.viewMode === "continuous") requestAnimationFrame(() => {
        const target = document.querySelector(`#ed-reading [data-folio="${page.index}"]`);
        if (target) target.scrollIntoView({ block: "start" });
      });
    });
    pagesHost.appendChild(pageButton);
  }
  if (!summary.annotatedPages) {
    pagesHost.appendChild(el("span", { class: "ed-ann-empty", text: `No annotation-bearing ${terms.plural} detected.` }));
  }
}

function currentReviewSummary() {
  return projectionCache.get(app, "review-pages", () => reviewPageSummary(app.state));
}

function updateReviewProgress() {
  const button = $("ed-review-summary");
  if (!button) return;
  const metadata = app.sourceMode === "metadata" || app.sourceMode === "metadata-form";
  button.hidden = !app.state || metadata;
  if (!app.state || metadata) return;
  const summary = currentReviewSummary();
  const current = summary.pages[app.folio] || null;
  const terms = unitTerms(app.state.sourceProfile);
  button.textContent = `Reviewed ${summary.reviewedPages}/${summary.totalPages}`;
  if (current?.status === "changed") button.textContent += " · changed since review";
  else if (current?.status === "historical") button.textContent += " · historical review";
  button.disabled = app.readOnly || !current || !current.markable;
  button.setAttribute("aria-pressed", String(!!(current && current.reviewed)));
  button.title = current && current.reviewed
    ? `This ${terms.singular} is editorially reviewed. Click to reopen it for review.`
    : current && current.markable
      ? `Mark the current ${terms.singular} as editorially reviewed.`
      : `This projected ${terms.singular} has no TEI anchor on which to store review state.`;
}

function updateFolioButtons() {
  const n = app.state ? app.state.folios.length : 0;
  const metadata = app.sourceMode === "metadata" || app.sourceMode === "metadata-form";
  const pager = $("ed-folio-label") && $("ed-folio-label").parentElement;
  if (pager) pager.hidden = metadata;
  // XML source is always unit-scoped, even when the reading view is stored as
  // continuous. Returning to Reading text restores that stored choice.
  const continuous = app.viewMode === "continuous" && !app.sourceMode;
  // In continuous view the prev/next arrows have nothing to step through; the
  // label states the total instead, and the view-mode toggle stays.
  $("btn-prev").hidden = continuous;
  $("btn-next").hidden = continuous;
  $("btn-prev").disabled = !app.state || app.folio <= 0;
  $("btn-next").disabled = !app.state || app.folio >= n - 1;
  const terms = unitTerms(app.state?.sourceProfile);
  $("ed-folio-label").textContent = !app.state ? "-"
    : continuous ? `${n} ${n === 1 ? terms.singular : terms.plural}`
    : unitPositionLabel(app.state, app.folio);
  const vm = $("btn-viewmode");
  if (vm) {
    // The toggle is meaningful only with more than one navigation unit.
    vm.hidden = !app.state || n <= 1 || app.sourceMode;
    vm.textContent = continuous ? "▤" : "□"; // stacked vs single page
    vm.title = continuous
      ? `Continuous view (all ${terms.plural}). Click for one ${terms.singular} at a time.`
      : `One ${terms.singular} at a time. Click for continuous view.`;
    vm.setAttribute("aria-pressed", String(continuous));
  }
  updateAnnotationProgress();
  updateReviewProgress();
}

function setViewMode(mode) {
  if (!app.state || (mode !== "paged" && mode !== "continuous") || app.viewMode === mode) return;
  if (!stagedInput.allowChange("changing the reading layout")) return;
  app.viewMode = mode;
  saveDocLayout({ viewMode: mode });
  render();
}

function gotoFolio(i) {
  if (!app.state) return;
  if (!stagedInput.allowChange("changing navigation units")) return;
  const next = Math.max(0, Math.min(app.state.folios.length - 1, i));
  if (next !== app.folio) sessionSafety.abortKind("proposal", "Requested page changed");
  app.folio = next;
  render();
}

// ---- linking (zone <-> line) ----------------------------------------------
// Real link when the line carries an @facs zone id (e.g. Hersch <lb facs="#z">);
// positional fallback (line index == zone index) for editions without it (WB).

function clearLinks() {
  for (const n of document.querySelectorAll("#ed-reading .linked")) n.classList.remove("linked");
  if (facsimile) facsimile.clearHighlight();
}

// Reading line -> facsimile zone. Real link when the line carries an @facs zone id;
// positional fallback (line index == zone index) for editions without it. The
// folio index scopes the highlight so the continuous view (every folio in one
// scroll) targets the right page; in the paged view it is always app.folio.
function highlightLine(folioIndex, lineIndex) {
  clearLinks();
  if (lineIndex == null || lineIndex < 0) return;
  const sel = app.viewMode === "continuous"
    ? `#ed-reading [data-folio="${folioIndex}"][data-line="${lineIndex}"]`
    : `#ed-reading [data-line="${lineIndex}"]`;
  for (const w of document.querySelectorAll(sel)) w.classList.add("linked");
  // When the context pane is collapsed the @facs sync simply has no target.
  if (!facsimile || app.rightCollapsed) return;
  // Continuous view: the facsimile tracks the hovered line's page.
  if (app.viewMode === "continuous" && folioIndex !== app.folio) {
    app.folio = folioIndex;
    app.currentLines = (app.state.folios[folioIndex] || {}).lines || [];
    updateFolioButtons();
    if (app.panel === "facs") renderActivePanel();
  }
  const line = ((app.state.folios[folioIndex] || {}).lines || [])[lineIndex];
  facsimile.highlightZone(line && line.facs ? line.facs : lineIndex);
}

function highlightZone(zoneId, zoneIndex) {
  const lines = app.currentLines || [];
  let li = zoneId ? lines.findIndex((l) => l.facs === zoneId) : -1;
  if (li < 0) li = zoneIndex; // positional fallback
  highlightLine(app.folio, li);
}

// ---- reading text ----------------------------------------------------------

function render() {
  updateFolioButtons();
  documentFacts.updateDocStrip();
  buildLegend();
  renderReading();
  updatePanels();
  renderActivePanel();
  validationView.renderValidation();
}

// M2.5: one id -> { name, kind, ai } map per render, so every linked mention can
// carry its entity-type colour and a tooltip naming the entity. The kind comes
// from the entity TYPE readEntities reports (not from the id prefix), so
// hand-authored ids without a pers_/plc_ prefix still colour correctly.
const MENTION_KIND = Object.freeze({
  person: "pers", place: "plc", org: "org", work: "wrk", event: "evt",
});

function entityMetaMap() {
  if (!app.state) return new Map();
  return projectionCache.get(app, "entity-meta", () => {
    const meta = new Map();
    const all = standoff.readEntities(app.state.doc);
    for (const [key, type] of [
      ["persons", "person"], ["places", "place"], ["orgs", "org"],
      ["works", "work"], ["events", "event"],
    ]) {
      for (const e of all[key] || []) {
        if (e.id) meta.set(e.id, { name: e.name, kind: MENTION_KIND[type], ai: isPendingProposal(e.node, app.aiResp), aiOrigin: hasResponsibility(e.node, app.aiResp) });
      }
    }
    return meta;
  });
}

/**
 * Where has each entity been used? id -> { count, onPage } over all mention
 * cells, so the popovers and the index can say WHERE an entry comes from
 * (this page / this document / index only) instead of listing the raw standOff.
 */
function entityUsage() {
  const index = projectionCache.get(app, "entity-usage", () => {
    const usage = new Map();
    const seen = new Set();
    app.state.folios.forEach((folio, fi) => {
      for (const line of folio.lines) {
        for (const cell of line.cells) {
          const layers = (cell.layers || []).filter((candidate) =>
            candidate.kind === "mention" && candidate.ref);
          if (!layers.length && cell.mention) {
            layers.push({ kind: "mention", ref: cell.mention });
          }
          for (const layer of layers) {
            const record = usage.get(layer.ref) || { count: 0, pages: new Set() };
            record.pages.add(fi);
            const key = layer.standOffGroupId
              ? `${layer.ref}:stand-off:${layer.standOffGroupId}`
              : layer.el?.outerStart != null
                ? `${layer.ref}:inline:${layer.el.outerStart}`
                : `${layer.ref}:cell:${cell.id}`;
            if (!seen.has(key)) {
              seen.add(key);
              record.count += 1;
            }
            usage.set(layer.ref, record);
          }
        }
      }
    });
    return usage;
  });
  const usage = new Map();
  for (const [id, record] of index) {
    usage.set(id, { count: record.count, onPage: record.pages.has(app.folio) });
  }
  return usage;
}

// Text-structure wrappers that carry no scholarly semantics: they must not get
// the semantic-wrap treatment. Critical locals are styled by their own crit-*
// classes (handled separately), so they are excluded here too.
function renderReading() {
  // Keep the actual controls, selection and caret while input is unfinished.
  if (stagedInput.hasChanges()) return;
  const host = $("ed-reading");
  stagedInput.clear();
  clear(host);
  syncViewTabs();
  if (!app.state) { host.classList.remove("src"); renderEmptyReading(host); return; }
  host.classList.toggle("src", app.sourceMode);
  if (app.sourceMode) {
    if (app.sourceMode === "metadata-form") renderMetadataForm(host);
    else renderSourceView(host);
    return;
  }
  const continuous = app.viewMode === "continuous";
  host.classList.toggle("continuous", continuous);
  const folios = app.state.folios;
  if (!folios.length) {
    app.currentLines = [];
    host.appendChild(el("div", { class: "ed-empty", text: "This document has no transcribed text." }));
    return;
  }
  const mentions = entityMetaMap();
  if (continuous) {
    // All units stacked under separators. The active unit (which the
    // facsimile tracks) stays app.folio and follows the hovered line.
    app.currentLines = (folios[app.folio] || {}).lines || [];
    folios.forEach((folio, fi) => {
      host.appendChild(renderPageSeparator(folio, fi));
      renderFolioInto(host, folio, fi, mentions);
    });
  } else {
    const folio = folios[app.folio];
    app.currentLines = folio ? folio.lines : [];
    if (!folio || !folio.lines.length) {
      const terms = unitTerms(app.state.sourceProfile);
      host.appendChild(el("div", { class: "ed-empty", text: `This ${terms.singular} has no transcribed text.` }));
      return;
    }
    renderFolioInto(host, folio, app.folio, mentions);
  }
}

/** A labelled rule between units in the continuous view. */
function renderPageSeparator(folio, fi) {
  const terms = unitTerms(app.state.sourceProfile);
  const label = folio.navigationUnit?.label
    || (folio.n != null ? `${terms.singular} ${folio.n}` : `${terms.singular} ${fi + 1}`);
  const sep = el("div", { class: "ed-page-sep", dataset: { folio: String(fi) } },
    [el("span", { class: "ed-page-sep-label", text: label })]);
  sep.addEventListener("click", () => {
    if (app.folio === fi) return;
    sessionSafety.abortKind("proposal", "Requested page changed");
    app.folio = fi;
    app.currentLines = (app.state.folios[fi] || {}).lines || [];
    updateFolioButtons();
    renderActivePanel();
  });
  return sep;
}

// ---- empty state (no document loaded) --------------------------------------
// No separate welcome screen: the editor opens on its empty two-pane layout
// and the reading pane carries a lean prompt to load a document or project,
// plus the recent files (when any) for quick re-entry.
function renderEmptyReading(host) {
  const box = el("div", { class: "ed-empty-start" });
  box.appendChild(el("p", { class: "ed-empty-lead",
    text: "Open a TEI document, open a project folder, or start from a plaintext file." }));
  box.appendChild(el("p", { class: "ed-empty-hint",
    text: "Use the Load... menu above (Open TEI or text, Open project folder, New project), or drop a .xml, .txt or .md file anywhere on this page. A plaintext file opens as a line-level draft; saving produces the TEI file." }));
  documentFacts.renderDraftRecovery(box);
  const recent = el("div", { class: "ed-recent", id: "ed-recent" });
  recent.hidden = true;
  recent.appendChild(el("h2", { text: "Recent files" }));
  recent.appendChild(el("div", { class: "ed-recent-list", id: "ed-recent-list" }));
  box.appendChild(recent);
  host.appendChild(box);
  renderRecents();
}

/**
 * Editable page or metadata XML source, mounted from source-view.js. The view
 * stages one exact raw span and substitutes it into the complete canonical
 * document before validation or parsing, so every other byte stays untouched.
 */
// A pathologically large source span still gets a safety gate. Whole books do
// not hit it because page source follows the folio segmentation and metadata
// source is confined to teiHeader.
const SOURCE_VIEW_LIMIT = 8_000_000;

function computeSourceVocabulary() {
  const elements = new Map();
  const attributes = new Map();
  const guidelines = guidelinesNow();
  const addElement = (name, localName = name.replace(/^.*:/, "")) => {
    if (!name || elements.has(name)) return;
    const spec = guidelines ? elementByName(guidelines, localName) : null;
    elements.set(name, {
      name,
      description: spec ? (spec.gloss || spec.desc || "") : "Used in the loaded document",
    });
    if (!attributes.has(localName)) attributes.set(localName, new Map());
    const target = attributes.get(localName);
    if (spec) for (const attr of spec.attributes || []) {
      target.set(attr.ident, {
        name: attr.ident,
        description: attr.desc || "TEI attribute",
        values: attr.valList ? attr.valList.items.map((item) => ({
          value: item.ident,
          description: item.desc || "TEI closed value",
        })) : [],
      });
    }
  };

  walk(app.state.doc.root, (node) => {
    if (node.type !== "element") return;
    addElement(node.qname || node.localName, node.localName);
    if (!attributes.has(node.localName)) attributes.set(node.localName, new Map());
    const target = attributes.get(node.localName);
    for (const attr of node.attrs || []) {
      if (!target.has(attr.name)) target.set(attr.name, {
        name: attr.name,
        description: "Used on this element in the loaded document",
        values: [],
      });
    }
  });

  if (guidelines && app.project) {
    const scope = teiScopeForFile(app.project, app.docName);
    for (const name of elementsForScope(guidelines, scope)) addElement(name);
  }
  for (const wrap of app.markup || []) if (wrap[2]) addElement(wrap[2]);

  const attrObject = {};
  for (const [elementName, items] of attributes) attrObject[elementName] = [...items.values()];
  return { elements: [...elements.values()], attributes: attrObject };
}

function sourceVocabulary() {
  const guidelinesKey = _guidelines ? "p5" : "document";
  return projectionCache.get(app, `source-vocabulary:${guidelinesKey}`, computeSourceVocabulary);
}

function sourceValidationLabels() {
  const schema = app.project && app.project.schema;
  const sources = schemaSources(
    schema,
    null,
    app.project && app.project.schemaBaseUrl,
    app.project && app.project.localSchemas,
  );
  const names = sources.map((source) => source.name).join(", ");
  return {
    validationLabel: `Well-formedness · ${schema ? "project schema" : "TEI All"} on demand`,
    validationTitle: `The browser checks XML well-formedness before Apply. Run browser schema validation for ${names} from the live-check details.`,
  };
}

function renderMetadataForm(host) {
  const sourceDoc = app.state.doc;
  stagedInput.mount(mountMetadataView(host, {
    doc: sourceDoc,
    readOnly: app.readOnly,
    onApply: (nextDoc) => stagedInput.commit(() => {
      if (nextDoc === sourceDoc) return true;
      try {
        const nextState = parseEdition(nextDoc.raw);
        replaceSessionState(nextState, "Edit metadata");
        setStatus("Metadata fields applied to the complete document");
        render();
        return true;
      } catch (err) {
        setStatus(`Metadata fields were not applied: ${err.message}`);
        return false;
      }
    }),
    onEditXml: () => setSourceMode("metadata"),
  }), { mode: app.sourceMode, folio: app.folio });
}

function renderSourceView(host) {
  const metadata = app.sourceMode === "metadata";
  const leave = () => {
    app.sourceMode = metadata ? "metadata-form" : false;
    refreshAfterStandoffEdit();
  };
  const slice = metadata
    ? elementSourceSlice(app.state, "teiHeader")
    : folioSourceSlice(app.state, app.folio);
  if (!slice) {
    host.appendChild(el("div", { class: "ed-empty", text:
      "This document has no teiHeader metadata to edit." }));
    return;
  }
  if (slice.value.length > SOURCE_VIEW_LIMIT) {
    const mb = (slice.value.length / 1_000_000).toFixed(0);
    const terms = unitTerms(app.state.sourceProfile);
    host.appendChild(el("div", { class: "ed-empty", text:
      `This ${metadata ? "teiHeader" : terms.singular} is too large for the in-browser source editor (${mb} MB). `
      + "Use Download and a desktop editor for this raw XML span." }));
    return;
  }
  const sourceState = app.state;
  const pageTotal = app.state.folios.length;
  const terms = unitTerms(app.state.sourceProfile);
  const sourceLabel = metadata
    ? "Metadata (teiHeader)"
    : pageTotal
      ? `${unitPositionLabel(app.state, app.folio)} XML`
      : "Document XML";
  const statusLabel = metadata ? "Metadata XML" : sourceLabel;
  let lineStart = 1;
  for (let at = sourceState.raw.indexOf("\n"); at >= 0 && at < slice.start;
    at = sourceState.raw.indexOf("\n", at + 1)) lineStart++;
  const lineEnd = lineStart + slice.value.split(/\r\n|\r|\n/).length - 1;
  const stagedValue = slice.value.replace(/\r\n|\r/g, "\n");
  const sourceNewline = (/\r\n|\r|\n/.exec(slice.value) || ["\n"])[0];
  const sourceText = (text) => text === stagedValue
    ? slice.value
    : text.replace(/\r\n|\r|\n/g, sourceNewline);
  const candidate = (text) => spliceSourceSlice(sourceState, slice, sourceText(text));
  stagedInput.mount(mountSourceView(host, {
    value: slice.value,
    readOnly: app.readOnly,
    caret: 0,
    lineStart,
    scopeLabel: `${sourceLabel} · lines ${lineStart}-${lineEnd}`,
    scopeTitle: metadata
      ? "The complete teiHeader is staged here. Check and Apply validate the complete document."
      : pageTotal
        ? `Only this ${terms.singular}'s exact raw XML is staged here. Check and Apply validate the complete document.`
        : "The complete document XML is staged here because no navigation boundary was found.",
    vocabulary: sourceVocabulary(),
    ...sourceValidationLabels(),
    wellFormed: (text) => validationView.isWellFormed(candidate(text)),
    onApply: (text) => stagedInput.commit(() => {
      try {
        const raw = candidate(text);
        const changed = raw !== sourceState.raw;
        if (changed) {
          const nextState = parseEdition(raw);
          replaceSessionState(nextState, statusLabel);
        }
        setStatus(changed ? `${statusLabel} applied to the complete document` : `${statusLabel} unchanged`);
        leave();
        return true;
      } catch (err) {
        setStatus(`Not applied, parse failed: ${err.message}`);
        return false;
      }
    }),
    onCancel: () => { stagedInput.clear(); setStatus(`${statusLabel} edits discarded`); leave(); },
  }), { mode: app.sourceMode, folio: app.folio });
}

// ---- the single standOff mutation path ---------------------------------------

/**
 * Commit a doc -> doc mutation: standoff.applyMutation does the DOM-free core
 * (SAME-doc no-op check, re-parse, note index), this wrapper adopts the new
 * state, sets the dirty flag and the status line, and re-renders exactly once.
 * A no-op changes nothing; with noopLabel the status line says so. Returns
 * true on a real change, false on a no-op or failure.
 */
function commitStandoff(fn, { label, failPrefix = "Edit", noopLabel = null } = {}) {
  if (app.readOnly) {
    setStatus("The document is read only. Choose Edit document to change it.");
    return false;
  }
  try {
    const r = standoff.applyMutation(app.state.doc, fn);
    if (!r.changed) {
      if (noopLabel) setStatus(noopLabel);
      return false;
    }
    replaceSessionState(r.edition, label || failPrefix, r.notes);
    if (label) setStatus(label);
    refreshAfterStandoffEdit();
    return true;
  } catch (err) {
    setStatus(`${failPrefix} failed: ${err.message}`);
    return false;
  }
}

// ---- Author-mode structural acts (context menu) ----------------------------
// Four thin handlers that each run ONE structural primitive (structural.js)
// through commitStandoff. Each re-finds its target element inside the callback
// against the doc commitStandoff passes, keyed by the element's raw outerStart
// (a stable, unique offset in the unchanged pre-mutation doc), so no parsed node
// is held across the re-parse. Context-menu only; no key bindings.

// Block-level reading containers an <lb/>-driven line lives inside, so a split on
// an lb line targets the enclosing block (the empty milestone is not a container).
const STRUCT_BLOCK_LOCALS = new Set(["p", "head", "lg", "ab", "div", "body"]);

/** The render line a cell belongs to, or null. */
function lineForCell(cell) {
  if (!cell || !app.state) return null;
  for (const line of app.state.lines) {
    if (line.cells.some((c) => c.id === cell.id)) return line;
  }
  return null;
}

/** Find the element in `doc` whose start tag begins at outerStart and whose
 *  localName matches, or null. The pre-mutation doc is unchanged, so outerStart
 *  is a unique key; this is the re-find that avoids holding a stale node. */
function elByOuterStart(doc, outerStart, localName) {
  if (outerStart == null) return null;
  let found = null;
  walk(doc.root, (n) => {
    if (found) return false;
    if (n.type === "element" && n.outerStart === outerStart &&
        (localName == null || n.localName === localName)) { found = n; return false; }
  });
  return found;
}

/** The structural element a split/merge/delete acts on for a cell's line:
 *  the verse <l> itself, or the block enclosing an <lb/>-driven line. Returns
 *  { outerStart, localName } as a re-find key, or null. */
function structTargetKey(cell) {
  const line = lineForCell(cell);
  if (!line || !line.el) return null;
  if (line.kind === "l") return { outerStart: line.el.outerStart, localName: line.el.localName };
  // lb-driven line: climb the milestone's ancestors to the enclosing block.
  let p = line.el.parent;
  while (p && p.type === "element" && !STRUCT_BLOCK_LOCALS.has(p.localName)) p = p.parent;
  if (!p || p.type !== "element") return null;
  return { outerStart: p.outerStart, localName: p.localName };
}

/** Absolute raw caret offset at the menu's click point, mapped through the cell's
 *  display text, or null. Falls back to the cell end when the caret does not land
 *  in the cell's own text node (e.g. on the inter-cell space). */
function caretRawOffset(x, y, cell) {
  let node = null, offset = 0;
  if (document.caretPositionFromPoint) {
    const cp = document.caretPositionFromPoint(x, y);
    if (cp) { node = cp.offsetNode; offset = cp.offset; }
  } else if (document.caretRangeFromPoint) {
    const r = document.caretRangeFromPoint(x, y);
    if (r) { node = r.startContainer; offset = r.startOffset; }
  }
  const span = node && (node.nodeType === Node.TEXT_NODE ? node.parentElement : node);
  const w = span && span.closest && span.closest("#ed-reading .ed-w");
  // Use the caret offset only when it lands inside this very cell's text; otherwise
  // act at the cell's end so split/insert still has a sensible boundary.
  const disp = (w && w.dataset.id === cell.id) ? offset : decodeEntities(cell.rawText || "").length;
  return cellRawOffset(cell, disp);
}

/** Author-mode: split the cell's line element into two siblings at the caret. */
function authorSplitLine(x, y, cell) {
  const key = structTargetKey(cell);
  const abs = caretRawOffset(x, y, cell);
  if (!key || abs == null) { setStatus("Cannot split here."); return; }
  commitStandoff(
    (doc) => { const el = elByOuterStart(doc, key.outerStart, key.localName); return el ? splitElement(doc, el, abs) : doc; },
    { label: `Split <${key.localName}> at the caret`, failPrefix: "Split",
      noopLabel: "Nothing split (caret outside the line)" },
  );
}

/** Author-mode: merge the cell's line element with its previous same-name sibling. */
function authorMergePrev(cell) {
  const key = structTargetKey(cell);
  if (!key) { setStatus("Cannot merge here."); return; }
  commitStandoff(
    (doc) => {
      const second = elByOuterStart(doc, key.outerStart, key.localName);
      if (!second || !second.parent) return doc;
      const sibs = (second.parent.children || []).filter((c) => c.type === "element" && c.localName === second.localName);
      const i = sibs.indexOf(second);
      const first = i > 0 ? sibs[i - 1] : null;
      return first ? mergeElements(doc, first, second) : doc;
    },
    { label: `Merged <${key.localName}> into the previous one`, failPrefix: "Merge",
      noopLabel: "No previous same-kind line to merge with" },
  );
}

/** Author-mode: insert the document's own <lb/> milestone at the caret. */
function authorInsertLb(x, y, cell) {
  const abs = caretRawOffset(x, y, cell);
  if (abs == null) { setStatus("Cannot insert here."); return; }
  commitStandoff(
    (doc) => insertLb(doc, abs),
    { label: "Inserted a line break", failPrefix: "Insert line break",
      noopLabel: "Nothing inserted (caret out of range)" },
  );
}

/** True when the cell's structural element carries no non-whitespace content. */
function structIsEmpty(cell) {
  const line = lineForCell(cell);
  if (!line || !line.el) return false;
  const el = line.el;
  if (el.selfClosing) return true; // an empty <lb/> milestone
  if (el.contentStart == null || el.contentEnd == null) return false;
  return decodeEntities(app.state.doc.raw.slice(el.contentStart, el.contentEnd)).trim() === "";
}

/** Author-mode: delete the cell's line element, only when it is empty. */
function authorDeleteElement(cell) {
  const line = lineForCell(cell);
  if (!line || !line.el) { setStatus("Nothing to delete here."); return; }
  const key = { outerStart: line.el.outerStart, localName: line.el.localName };
  commitStandoff(
    (doc) => {
      const el = elByOuterStart(doc, key.outerStart, key.localName);
      return el ? deleteElement(doc, el) : doc;
    },
    { label: `Deleted empty <${key.localName}>`, failPrefix: "Delete",
      noopLabel: "Not deleted (the element is not empty)" },
  );
}

// ---- editorial notes (M3.5) ------------------------------------------------

/** Attach an editorial note to a cell: a small input, then a lossless standOff insert. */
function beginNote(span, cell) {
  if (app.readOnly) return;
  const existingNotes = app.noteByWord.get(cell.id) || app.noteByWord.get(cell.facs) || [];
  const existing = existingNotes[0] || "";
  const inp = el("input", {
    class: "ed-w-input",
    type: "text",
    value: existing,
    placeholder: "note text",
  });
  inp.style.width = `${Math.min(60, Math.max(8, (existing.length || 8) + 1))}ch`;
  inp.style.maxWidth = "100%";
  span.replaceWith(inp);
  inp.focus();
  inp.select();

  let done = false;
  const finish = (save) => {
    if (done) return;
    done = true;
    const text = inp.value.trim();
    const changed = (save && text)
      ? commitStandoff((doc) => standoff.addNoteForNode(doc, cell.node, cell.facs, text),
          { label: `Note attached to "${cell.text.trim()}"`, failPrefix: "Note" })
      : false;
    // No commit still re-renders once: the input swapped the cell's span out.
    if (!changed) refreshAfterStandoffEdit();
  };
  inp.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); finish(true); }
    else if (e.key === "Escape") { e.preventDefault(); finish(false); }
  });
  inp.addEventListener("blur", () => finish(true));
}

// ---- textual-critical markup (M3.6) ----------------------------------------

/** Tooltip for a reading cell, composed from its link / note / critical state. */
/**
 * Replace a cell with a small chooser of textual-critical actions, then apply the
 * chosen one losslessly. A gap cell offers only removal; any other cell offers the
 * four markers, plus "clear" when it already carries a wrapper.
 */
function beginCritic(span, cell) {
  if (app.readOnly) return;
  const host = $("ed-reading");
  // If a critical chooser is already open, rebuild the reading view first so we
  // never leave an orphaned one behind, then re-acquire this cell's span.
  if (host.querySelector(".ed-crit-pick")) {
    render();
    span = host.querySelector(`.ed-w[data-id="${CSS.escape(cell.id)}"]`);
    if (!span) return;
  }
  const box = el("span", { class: "ed-crit-pick" });

  // Pure cancel: put the original span back without re-rendering (scroll and
  // facsimile zoom survive a look-and-cancel). Mutations go through apply(),
  // which re-renders. The keydown listener self-heals when an external render
  // destroyed the box.
  const cancel = () => {
    document.removeEventListener("keydown", onKey);
    if (box.isConnected) box.replaceWith(span);
  };
  const onKey = (e) => {
    if (!box.isConnected) { document.removeEventListener("keydown", onKey); return; }
    if (e.key === "Escape") { e.preventDefault(); cancel(); }
  };
  const apply = (fn, label) => {
    document.removeEventListener("keydown", onKey);
    // No commit still re-renders once: the chooser box swapped the span out.
    if (!commitStandoff(fn, { label, failPrefix: "Markup" })) refreshAfterStandoffEdit();
  };
  const addBtn = (text, title, handler) => {
    const b = el("button", { class: "ed-crit-btn", text, title });
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      if (e.detail > 1) return;
      handler();
    });
    box.appendChild(b);
  };

  if (cell.gap) {
    addBtn("remove gap", "remove the gap marker",
      () => apply((doc) => removeGap(doc, cell.node), "Gap removed"));
  } else {
    for (const kind of Object.keys(CRITICAL_KINDS)) {
      const label = CRITICAL_KINDS[kind].label;
      addBtn(label, `mark as ${label}`,
        () => apply((doc) => markCritical(doc, cell.node, kind), `Marked ${label}`));
    }
    // "clear" only when this cell is the SOLE content of its wrapper, so removing
    // it can never strip a wrapper shared with sibling content (a silent data loss).
    if (cell.crit && cell.critSole) {
      addBtn("clear", "remove the critical markup",
        () => apply((doc) => unwrapCritical(doc, cell.node), "Markup cleared"));
    }
  }
  addBtn("x", "cancel", () => cancel());

  span.replaceWith(box);
  document.addEventListener("keydown", onKey);
}

// ---- facsimile (OpenSeadragon viewer with zone overlays) ------------------

/** Lazily create the single persistent OSD controller bound to #ed-osd. */
function ensureFacsimile() {
  if (facsimile) return facsimile;
  const host = $("ed-osd");
  if (!host) return null;
  // A project profile may rewrite a bare <graphic url> filename to a IIIF
  // info.json tile source (deep zoom); otherwise the plain image loads as-is.
  // coordScale is fixed at controller creation: it is 1 unless a project source
  // (a IIIF Presentation manifest) declares a canvas size different from the
  // served image's pixel size. The live pre-resolution that would compute a
  // non-1 value is deferred (W7), so this is a no-op for template/plain pages.
  facsimile = createFacsimile(host, {
    tileSourceFor: (url) => projectTileSource(app.project, url) || plainImageTileSource(url),
    coordScale: app.coordScale ?? 1,
  });
  return facsimile;
}

/**
 * Per-folio page image URL. For the ZBZ example, folio i (0-based) maps to
 * imageBase + 'p' + (i+1, zero-padded to 3) + '.png'. Null when no image base is
 * known (synthetic Wenzelsbibel, opened files), so the viewer shows its empty state.
 */
function imageUrlForFolio(i) {
  if (!app.imageBase) return null;
  return app.imageBase + "p" + String(i + 1).padStart(3, "0") + ".png";
}

/** True when the loaded document can show any page image (image base or <graphic url>). */
function docHasImages() {
  if (!app.state) return false;
  if (app.imageBase) return true;
  return app.state.folios.some((f) => f.surface && f.surface.graphic)
    || app.state.sourceProfile?.facsimile?.mode === "source-doc";
}

// ---- right-pane context panels (M2.14 dual view) -----------------------------
// The right pane is always there; WHAT it shows is a panel from this registry.
// Built-ins: facsimile and entity index. The registry is open: a project
// profile may contribute panels via project.panels, each
// { id, label, title, available()?, render()? | mount(hostEl)? }; a panel
// without a static host element in editor.html gets one created on demand.

const PANELS = [
  {
    id: "facs", label: "Facsimile", host: "ed-panel-facs",
    title: "Page image with TEI zones; hovering a zone highlights the linked text and vice versa",
    unavailableTitle: "This document carries no resolvable facsimile resources",
    available: () => docHasImages(),
    render: () => renderFacsimile(),
  },
  {
    id: "index", label: "Index", host: "ed-panel-index",
    title: "All index entities (persons, places, organisations, works, events) with their authority ids and mention counts",
    available: () => true,
    render: () => overlay.renderIndex(),
  },
  {
    id: "source", label: "Source",
    title: "The source model inferred from this TEI's structure and the available navigation channels",
    available: () => !!app.state,
    render: () => renderSourceProfilePanel(),
  },
  {
    id: "project", label: "Project", host: "ed-panel-project",
    title: "The open project folder's files; click one to open it in the editor",
    unavailableTitle: "No project folder is open (Load... > Open project folder)",
    available: () => !!app.projectFolder,
    render: () => projectFolderUi.renderProjectPanel(),
  },
];

function activePanels() {
  const extra = app.project && Array.isArray(app.project.panels) ? app.project.panels : [];
  return PANELS.concat(extra);
}

function panelHost(p) {
  let host = $(p.host || `ed-panel-${p.id}`);
  if (!host) {
    host = el("div", { class: "ed-panel", id: `ed-panel-${p.id}`, role: "tabpanel" });
    host.hidden = true;
    document.querySelector(".ed-panel-body").appendChild(host);
  }
  return host;
}

/**
 * Reconcile the right pane with the registry: rebuild the tabs (label, enabled
 * state, tooltip), make sure the active panel is an available one (fall back to
 * the first available, e.g. Index when a document has no page images), and show
 * exactly the active panel's host.
 */
function updatePanels() {
  const tabsHost = $("ed-panel-tabs");
  if (!tabsHost) return;
  const panels = activePanels();
  if (app.state) {
    const cur = panels.find((p) => p.id === app.panel);
    if (!cur || (cur.available && !cur.available())) {
      const fallback = panels.find((p) => !p.available || p.available());
      app.panel = fallback ? fallback.id : null;
    }
  }
  clear(tabsHost);
  for (const p of panels) {
    // Panels need a loaded document, except the project panel: an adopted folder
    // (with or without an openable file) enables its tab so the empty-project
    // onboarding note is reachable before any document is open.
    const avail = p.id === "project"
      ? !!app.projectFolder
      : !!app.state && (!p.available || p.available());
    const active = p.id === app.panel;
    const host = panelHost(p);
    const tab = el("button", {
      class: "ed-tab" + (active ? " active" : ""), type: "button", role: "tab",
      id: `ed-panel-tab-${p.id}`,
      "aria-selected": String(active),
      "aria-controls": host.id,
      title: avail ? p.title : (p.unavailableTitle || p.title),
      text: p.label,
    });
    host.setAttribute("aria-labelledby", tab.id);
    tab.disabled = !avail;
    tab.addEventListener("click", () => showPanel(p.id));
    tabsHost.appendChild(tab);
    host.hidden = !active;
  }
  syncTablist(tabsHost);
}

function showPanel(id) {
  app.panel = id;
  saveDocLayout({ panel: id });
  updatePanels();
  renderActivePanel();
}

/** Render the active panel's content (called by render() and showPanel()). */
function renderActivePanel() {
  // The project panel renders before any document is loaded (empty-project
  // onboarding): an adopted folder with no openable file shows its own note.
  const p = activePanels().find((x) => x.id === app.panel);
  if (!p) return;
  if (p.id !== "project" && !app.state) return;
  if (p.render) p.render();
  else if (p.mount) p.mount(panelHost(p));
}

function sourceProfileLabel(id) {
  return String(id || "").split("-").map((part) =>
    part ? part[0].toUpperCase() + part.slice(1) : "").join(" ");
}

function renderSourceProfilePanel() {
  const host = $("ed-panel-source");
  const profile = app.state?.sourceProfile;
  if (!host || !profile) return;
  clear(host);

  const summary = el("div", { class: "ed-section" });
  summary.appendChild(el("h4", { text: "Source model" }));
  summary.appendChild(el("div", { class: "ed-kv" }, [
    el("b", { text: "Primary navigation" }),
    el("span", { class: "ed-kv-value", text: profile.navigation.primary.label }),
  ]));
  summary.appendChild(el("div", { class: "ed-kv" }, [
    el("b", { text: "Units" }),
    el("span", { class: "ed-kv-value", text: String(profile.navigation.primary.units.length) }),
  ]));
  summary.appendChild(el("div", { class: "ed-kv" }, [
    el("b", { text: "Facsimile model" }),
    el("span", { class: "ed-kv-value", text: sourceProfileLabel(profile.facsimile.mode || "none") }),
  ]));
  summary.appendChild(el("p", {
    class: "ed-val-note",
    text: "This model is derived from TEI structures. A project manifest may select another navigation channel only when matching units exist.",
  }));
  host.appendChild(summary);

  const structures = el("div", { class: "ed-section" });
  structures.appendChild(el("h4", { text: "Detected structures" }));
  const present = profile.capabilities.filter((capability) => capability.present);
  if (!present.length) {
    structures.appendChild(el("span", { class: "ed-empty", text: "No specialised TEI structures were detected." }));
  } else {
    const capabilityList = el("div", { class: "ed-source-capabilities" });
    for (const capability of present) {
      capabilityList.appendChild(el("span", {
        class: `ed-val-chip ${capability.enabled ? "ok" : "warn"}`,
        text: sourceProfileLabel(capability.id),
        title: capability.evidence.join("; ") || sourceProfileLabel(capability.id),
      }));
    }
    structures.appendChild(capabilityList);
  }
  host.appendChild(structures);

  const navigation = el("div", { class: "ed-section" });
  navigation.appendChild(el("h4", { text: "Available navigation" }));
  for (const channel of profile.navigation.channels.filter((candidate) => candidate.units.length)) {
    navigation.appendChild(el("div", { class: "ed-kv" }, [
      el("b", { text: channel.label }),
      el("span", {
        class: "ed-kv-value",
        text: `${channel.units.length} unit${channel.units.length === 1 ? "" : "s"}${channel.id === profile.navigation.primary.id ? " (primary)" : ""}`,
      }),
    ]));
  }
  host.appendChild(navigation);

  if (profile.issues.length) {
    const issues = el("div", { class: "ed-section" });
    issues.appendChild(el("h4", { text: "Profile notes" }));
    for (const issue of profile.issues) {
      issues.appendChild(el("div", { class: "ed-val-warn", text: `${issue.message} ${issue.resolution || ""}`.trim() }));
    }
    host.appendChild(issues);
  }
}

function renderFacsimile() {
  if (!app.state || app.panel !== "facs" || app.rightCollapsed) return;
  const folio = app.state.folios[app.folio];
  const surface = folio && folio.surface;
  const externalRef = folio?.navigationUnit?.facsimileRefs
    ?.find((value) => /^https?:\/\//i.test(value)) || null;
  // Prefer the hardcoded demo image base; otherwise resolve the surface's
  // <graphic url> (absolute URL, or a local filename via the page-image store),
  // so opened TEI and on-ramp drafts with attached page images both show.
  const imageUrl = imageUrlForFolio(app.folio) || pageImageStore.resolve(surface) || null;
  if (!imageUrl && externalRef) {
    if (facsimile) {
      facsimile.destroy();
      facsimile = null;
    }
    const host = $("ed-osd");
    if (!host) return;
    clear(host);
    host.appendChild(el("div", { class: "ed-empty" }, [
      el("p", { text: "This unit links to an external facsimile resource." }),
      el("a", {
        class: "ed-btn",
        href: externalRef,
        target: "_blank",
        rel: "noopener noreferrer",
        text: "Open linked facsimile",
      }),
    ]));
    return;
  }
  const ctrl = ensureFacsimile();
  if (!ctrl) return;
  ctrl.showPage({
    imageUrl,
    surface,
    onZoneEnter: (zoneId, zoneIndex) => highlightZone(zoneId, zoneIndex),
    onZoneLeave: () => clearLinks(),
    onZoneClick: (zoneId, zoneIndex) => highlightZone(zoneId, zoneIndex),
  });
}

/** After any standOff edit: re-render the whole view, including the active panel
 * (an inactive index panel is re-rendered on its next showPanel). */
function refreshAfterStandoffEdit() {
  render();
}

/**
 * Highlight an entity's mentions: mark reading spans whose cell.start falls inside
 * a mention node's content range, and highlight the zone(s) of those lines via the
 * facsimile controller. findMentions returns element nodes, so the mention range is
 * the element's [contentStart, contentEnd] (its inner text), with the outer span as
 * a fallback for self-contained markup.
 */
function highlightMentions(entity) {
  clearLinks();
  // Temporary selection highlight: its own class (mention-hit), so clearing it
  // never strips the permanent M2.5 visibility classes (.mention.mention-*).
  for (const w of document.querySelectorAll("#ed-reading .mention-hit")) w.classList.remove("mention-hit");
  const mentions = standoff.findMentions(app.state.doc, entity.id);
  if (!mentions.length) {
    setStatus(`${entity.name}: no in-text mentions on any folio`);
    return;
  }
  // Precompute each mention's [from, to) range over the raw string.
  const ranges = mentions.map((m) => {
    const from = m.node.contentStart != null ? m.node.contentStart : m.node.outerStart;
    const to = m.node.contentEnd != null ? m.node.contentEnd : m.node.outerEnd;
    return { from, to };
  });
  let hitsHere = 0;
  const linesToHighlight = new Set();
  for (const span of document.querySelectorAll("#ed-reading .ed-w[data-start]")) {
    const start = Number(span.dataset.start);
    for (const r of ranges) {
      if (r.from != null && r.to != null && r.from <= start && start < r.to) {
        span.classList.add("mention-hit");
        hitsHere++;
        const li = Number(span.dataset.line);
        if (Number.isInteger(li)) linesToHighlight.add(li);
        break;
      }
    }
  }
  // Highlight the zone of the first mention-bearing line on this folio. The
  // controller keeps a single highlight, so we point it at the first hit.
  if (facsimile && linesToHighlight.size) {
    const li = Math.min(...linesToHighlight);
    const line = (app.currentLines || [])[li];
    facsimile.highlightZone(line && line.facs ? line.facs : li);
  }
  setStatus(`${entity.name}: ${mentions.length} mention(s) total, ${hitsHere} on this folio`);
}

// ---- save / download -------------------------------------------------------

async function authorizeOutput(raw, action) {
  const sessionId = app.sessionId;
  setStatus(`Validating the configured schema set before ${action.toLowerCase()}...`);
  try {
    const result = await validationView.requireValidForOutput(raw, action);
    if (sessionId !== app.sessionId) return null;
    if (result.ok) return result.authorization;
    setStatus(result.message);
    validationView.showDetails();
  } catch (err) {
    if (sessionId !== app.sessionId) return null;
    setStatus(`${action} blocked because schema validation could not complete: ${err.message}`);
    validationView.showDetails();
  }
  return null;
}

async function downloadWorkingCopy() {
  if (!app.state) return;
  try {
    const record = captureCheckpoint(app, stagedSnapshot(), validationView.recoverySettings());
    const text = await encodeWorkingCopy(record);
    const name = `${record.docName || "edition"}.teicrafter.json`;
    downloadFile(text, name, "application/json");
    setStatus(`Working copy download requested: ${name}. Includes XML, unfinished input and attached images; it is not a validated export. Local recovery is retained.`);
  } catch (err) { setStatus(`Working copy failed: ${err.message}`); }
}

function openWorkingCopy() {
  const input = el("input", { type: "file", accept: ".json" });
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const record = decodeWorkingCopy(await file.text());
      await documentFacts.restoreDraft(record);
    } catch (err) { setStatus(`Working copy was not opened: ${err.message}`); }
  });
  input.click();
}

const save = () => outputController.save();
const download = () => outputController.download();

/** True when the loaded document's project opts into the inline-GND interchange. */
function docHasInlineGndExport() {
  return !!(app.state && usesInlineGND(app.project));
}

/**
 * Show the inline-GND export only where it is meaningful: a document under a
 * project that declares the inline-GND interchange profile. The register model
 * stays the editing model; this is a one-way handover copy for the ZBZ pipeline.
 */
function syncInlineExport() {
  const btn = $("btn-export-inline");
  if (btn) btn.hidden = !docHasInlineGndExport();
  const saveBtn = $("btn-save");
  const downloadBtn = $("btn-download");
  if (saveBtn) saveBtn.title = docHasInlineGndExport()
    ? "Save the inline-GND project format in place, or download it when direct save is unavailable"
    : "Save in place (File System Access) or download";
  if (downloadBtn) downloadBtn.title = docHasInlineGndExport()
    ? "Download this document in its inline-GND project format"
    : "Download a copy of the current TEI";
}

/** Show the folder attachment only when the TEI names local facsimile files. */
function syncFacsimileFolderAction() {
  const btn = $("btn-attach-facsimiles");
  if (!btn) return;
  btn.hidden = !(app.state && pageImageStore.referencedNames().size);
}

async function attachFacsimileFolder() {
  if (!app.state) return;
  if (!pageImageStore.supportsFolderAttachment()) {
    setStatus("This browser cannot attach a local facsimile folder. Use a Chromium-based browser with the File System Access API. Editing and XML downloads remain available.");
    return;
  }
  try {
    const result = await pageImageStore.attachFolder();
    if (result.cancelled) {
      setStatus("Facsimile folder selection cancelled");
      return;
    }
    const unresolved = result.missing.length;
    const missingNote = unresolved ? ` ${unresolved} referenced image(s) were not found.` : "";
    setStatus(`Attached ${result.folderName}: resolved ${result.found} of ${result.requested} referenced image(s). Files remain local and were not copied.${missingNote}`);
  } catch (err) {
    setStatus(`Facsimile folder could not be attached: ${err.message}`);
  }
}

/**
 * Export the current register-model document to the inline-GND interchange shape
 * (authority inline at each mention, no standOff) and download it as the
 * pipeline's "_final.xml". Reading text is byte-preserved; only the markup shape
 * changes (toInlineGND). The in-editor document is untouched.
 */
const downloadInlineGND = () => outputController.download("inline-gnd");

// ---- view controls: zoom, collapse, splitter, layout persistence ------------
// One persistence mechanism (storage.js, localStorage): text zoom is a global
// preference; the per-document layout (split position, collapsed pane, active
// context tab) is keyed by document name. No second store.

const ZOOM_MIN = 0.7, ZOOM_MAX = 1.8, ZOOM_STEP = 0.1;

function currentZoom() { return getSetting("editorZoom", 1); }
function applyZoom(z) {
  z = Math.round(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z)) * 10) / 10;
  setSetting("editorZoom", z);
  const main = $("ed-main");
  if (main) main.style.setProperty("--ed-zoom", String(z));
  const lbl = $("ed-zoom-reset");
  if (lbl) lbl.textContent = Math.round(z * 100) + "%";
}

function layoutKey() { return app.docName ? "layout:" + app.docName : null; }
function loadDocLayout() { const k = layoutKey(); return k ? getSetting(k, {}) : {}; }
function saveDocLayout(patch) {
  const k = layoutKey();
  if (!k) return;
  setSetting(k, { ...getSetting(k, {}), ...patch });
}

function setRightCollapsed(on, persist = true, rerender = true) {
  app.rightCollapsed = on;
  const main = $("ed-main");
  if (main) main.classList.toggle("right-collapsed", on);
  const splitter = $("ed-splitter");
  if (splitter) {
    splitter.setAttribute("aria-valuetext", on
      ? "Context pane hidden"
      : `Left pane ${splitter.getAttribute("aria-valuenow") || "52"} percent`);
    splitter.title = on
      ? "Click or press Enter to show the context pane"
      : "Drag or use arrow keys to resize; Enter toggles the context pane; Home resets";
  }
  if (persist) saveDocLayout({ collapsed: on });
  // Re-render the now-visible panel so OpenSeadragon sizes to the restored width.
  if (rerender && !on && app.state) renderActivePanel();
}

const SPLIT_MIN_PX = 320;
function setSplitPct(pct, persist = true) {
  const main = $("ed-main");
  if (!main) return;
  pct = Math.max(10, Math.min(90, pct));
  main.style.setProperty("--ed-split", pct + "%");
  const splitter = $("ed-splitter");
  if (splitter) {
    const rounded = Math.round(pct);
    splitter.setAttribute("aria-valuenow", String(rounded));
    if (!app.rightCollapsed) splitter.setAttribute("aria-valuetext", `Left pane ${rounded} percent`);
  }
  if (persist) saveDocLayout({ split: Math.round(pct * 10) / 10 });
}

function setupSplitter() {
  const main = $("ed-main");
  const splitter = $("ed-splitter");
  const left = $("ed-pane-left");
  if (!main || !splitter || !left) return;
  const widthPct = (px) => (px / (main.getBoundingClientRect().width || 1)) * 100;
  const clamp = (pct) => {
    const minPct = widthPct(SPLIT_MIN_PX);
    return Math.max(minPct, Math.min(100 - minPct, pct));
  };
  const curPct = () => widthPct(left.getBoundingClientRect().width);
  let dragging = false, moved = false, startX = 0;
  splitter.addEventListener("pointerdown", (e) => {
    dragging = true; moved = false; startX = e.clientX;
    splitter.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  splitter.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    // A clean press without travel stays a click (rail-click restores when
    // collapsed); only a real drag past a few pixels resizes.
    if (!moved) {
      if (Math.abs(e.clientX - startX) < 3) return;
      moved = true;
      document.body.style.cursor = "col-resize";
    }
    const rect = main.getBoundingClientRect();
    // Collapsed: a leftward drag reopens the pane and sizes it in one gesture,
    // but only once the pointer has pulled in far enough to form a 320px pane.
    if (main.classList.contains("right-collapsed")) {
      if (rect.right - e.clientX < SPLIT_MIN_PX) return;
      setRightCollapsed(false);
    }
    setSplitPct(clamp(widthPct(e.clientX - rect.left)), false);
  });
  const end = (e) => {
    if (!dragging) return;
    dragging = false;
    try { splitter.releasePointerCapture(e.pointerId); } catch (_) { /* not captured */ }
    document.body.style.cursor = "";
    const collapsed = main.classList.contains("right-collapsed");
    const onChevron = e.clientX < splitter.getBoundingClientRect().left;
    if (!moved && (collapsed || onChevron)) setRightCollapsed(!collapsed);
    else if (moved && !collapsed) saveDocLayout({ split: Math.round(curPct() * 10) / 10 });
    moved = false;
  };
  splitter.addEventListener("pointerup", end);
  splitter.addEventListener("pointercancel", end);
  splitter.addEventListener("dblclick", () => setSplitPct(50));
  splitter.addEventListener("keydown", (e) => {
    const step = e.shiftKey ? 5 : 2;
    if (e.key === "ArrowLeft") { setSplitPct(clamp(curPct() - step)); e.preventDefault(); }
    else if (e.key === "ArrowRight") { setSplitPct(clamp(curPct() + step)); e.preventDefault(); }
    else if (e.key === "Home") { setSplitPct(50); e.preventDefault(); }
    else if (e.key === "Enter" || e.key === " ") { setRightCollapsed(!app.rightCollapsed); e.preventDefault(); }
  });
}

// Restore the per-document layout after a load: collapsed state, split position,
// and the active context tab (only when that tab is available for this document).
function applyDocLayout() {
  const L = loadDocLayout();
  setRightCollapsed(!!L.collapsed, false, false);
  const main = $("ed-main");
  if (typeof L.split === "number") setSplitPct(L.split, false);
  else if (main) main.style.removeProperty("--ed-split");
  if (L.panel) {
    const p = activePanels().find((x) => x.id === L.panel);
    if (p && (!p.available || p.available())) app.panel = L.panel;
  }
  // F4: only restore the reading variant for a document that carries dual
  // readings (it is meaningless otherwise, and the switcher stays hidden).
  if (L.reading === "norm" && app.state && app.state.hasDualReadings) app.readingVariant = "norm";
  if (L.viewMode === "continuous" && app.state && app.state.folios.length > 1) app.viewMode = "continuous";
}

// ---- feature modules (M2.13 split) ------------------------------------------
// Instantiated once at startup; dependencies flow in via a ctx object, the
// surfaces (popovers, overlay, modal) flow back through the returned APIs.

function aiAnchor(scope = null) {
  let resolved = scope;
  if (!resolved && app.state && app.state.folios.length) {
    resolved = createProposalScope(app.state, app.folio);
  }
  return {
    documentName: app.docName,
    sourceMode: app.sourceMode,
    folio: resolved ? {
      index: resolved.folioIndex,
      start: resolved.folioStart,
      end: resolved.folioEnd,
      raw: resolved.folioRaw,
    } : null,
    cells: resolved ? resolved.cells : [],
  };
}

const beginAiJob = (kind, scope = null) => sessionSafety.beginJob(kind, aiAnchor(scope));
const aiJobCurrent = (job) => !app.readOnly && sessionSafety.isJobCurrent(job, currentRaw());
const finishAiJob = (job) => sessionSafety.finishJob(job);
const abortAiJob = (job, reason) => sessionSafety.abortJob(job, reason);

const { beginTextInput, beginReadingsInput } = createInlineEditor({
  app, stagedInput, replaceSessionState, setStatus, render,
  persistRecovery: () => documentFacts.persistDraftIfNeeded(),
});

const overlay = createEntityIndex({
  app, setStatus, commitStandoff,
  gotoFolio, highlightMentions, entityUsage,
  showPanel,
});
const annot = createAnnotationUi({
  app, setStatus, setDirty, commitStandoff,
  entityMetaMap, entityUsage,
  runLookup: overlay.runLookup,
  revealEntity: overlay.revealEntity,
  highlightMentions, beginTextInput, beginNote, beginCritic,
  ensureGuidelines, guidelinesNow,
  // Author-mode structural acts, surfaced in the reading context menu.
  author: {
    splitLine: authorSplitLine,
    mergePrev: authorMergePrev,
    insertLb: authorInsertLb,
    deleteElement: authorDeleteElement,
    isEmpty: structIsEmpty,
  },
});
const { renderFolioInto } = createReadingView({
  app, annot, overlay, cellHasAiLayer, beginCritic, beginTextInput, beginReadingsInput,
  setSourceMode, highlightLine, clearLinks,
});
const projectFolderUi = createProjectFolder({
  app, setStatus, setDirty, load,
  showPanel, updatePanels, teiVocabularyLine,
  getProjectPanelHost: () => panelHost(activePanels().find((p) => p.id === "project")),
  // Project-flow plaintext draft: same neutral draft badge and Source provenance
  // as the direct draft path (the wording differs: a project draft saves in place).
  onPlaintextDraft: (txtName) => { app.source = { kind: "draft", txtName }; documentFacts.updateDocStrip(); },
});
const validationView = createValidationView({
  app,
  schemaDocumentRaw: () => targetDocument(app.state.doc, app.project).raw,
  onSchemaSourcesChanged: handleSchemaSourcesChanged,
});
const documentFacts = createDocumentFacts({
  app, setStatus, setDirty, load, render, renderActivePanel,
  stagedSnapshot,
  schemaSnapshot: () => validationView.recoverySettings(),
  restoreSchema: (settings) => validationView.restoreSettings(settings),
  restoreStaged: (staged) => {
    app.sourceMode = staged.mode === "inline" ? false : staged.mode;
    app.folio = Math.max(0, Math.min(staged.folio, app.state.folios.length - 1));
    render();
    if (staged.mode === "inline") {
      const cell = app.state.cellById.get(staged.cellId);
      const span = [...document.querySelectorAll("#ed-reading .ed-w")].find((node) => node.dataset.id === staged.cellId);
      if (cell && span) {
        if (staged.value.norm != null && cell.w) beginReadingsInput(span, cell);
        else beginTextInput(span, cell);
        stagedInput.restore(staged.value);
      }
    } else stagedInput.restore(staged.value);
  },
});
// Page-image store: resolves a surface <graphic url> to a displayable URL and
// writes attached images next to the TEI on save (used by applyLoad, the
// facsimile render, save, and the text+image on-ramp).
const pageImageStore = createPageImages({ app, rerenderPanel: () => renderActivePanel() });
const outputController = createOutputController({
  capture: (kind) => app.state ? {
    raw: (kind === "inline-gnd" ? toInlineGND(app.state.doc) : targetDocument(app.state.doc, app.project)).raw,
    name: kind === "inline-gnd" ? inlineGndFilename(app.docName) : app.docName || "edition.xml",
    bom: !!app.fileEncoding?.bom,
    inlineGND: kind === "inline-gnd" || usesInlineGND(app.project),
    sessionId: app.sessionId,
    recoveryId: app.recoveryId,
  } : null,
  sessionId: () => app.sessionId,
  resolveStaged: resolveStagedOutput,
  hasStaged: () => stagedInput.hasChanges(),
  authorize: authorizeOutput,
  authorizationCurrent: (authorization) => validationView.isOutputAuthorizationCurrent(authorization),
  prepareSaveTarget: async () => {
    if (!app.fileHandle && !app.saveTarget?.dir && app.projectFolder?.dir && pageImageStore.countUnpersisted()) {
      app.saveTarget = { dir: app.projectFolder.dir, name: app.docName };
    }
    await projectFolderUi.finalizeSaveTarget();
  },
  target: () => ({ handle: app.fileHandle, baseline: app.fileSnapshot,
    directory: app.documentDirectory || app.projectFolder?.dir, name: app.docName }),
  setFileSnapshot: (handle, snapshot) => { if (app.fileHandle === handle) app.fileSnapshot = snapshot; },
  persistImages: (directory) => pageImageStore.persist(directory),
  countImages: () => pageImageStore.countUnpersisted(),
  markSaved: () => setDirty(false),
  markDirty: () => setDirty(true),
  persistRecovery: () => documentFacts.persistDraftIfNeeded(),
  clearRecovery: (id) => documentFacts.clearDraftRecovery(id),
  download: downloadFile,
  status: setStatus,
});
// LLM on-ramp ("New from text"). The modal is always wired (its DOM exists either
// way); llmEnabled() (the build flag AND the per-user runtime preference) controls
// whether the AI entry points are visible, so turning AI off leaves a fully
// deterministic editor with no AI surfaces. applyLlmGate() re-runs on the toggle.
const genModal = setupGenModal({
  load, markGenerated, setDirty, setStatus, app,
  authorizeDocumentReplacement, beginAiJob, aiJobCurrent, finishAiJob, abortAiJob,
});
function applyLlmGate() {
  const on = llmEnabled();
  $("btn-generate").hidden = !on;
  const propose = $("btn-propose");
  if (propose) propose.hidden = !on || app.readOnly;
}

// In-context proposal flow: ask the model for annotations on the current page, in
// the project's voice, and apply them as lossless, resp-marked (violet, unverified)
// constructs the human confirms or rejects. The provider/model/key are the ones the
// on-ramp set (in memory); without a key the call fails with a clear hint.
async function proposeOnFolio() {
  if (app.readOnly) return;
  if (!app.state || !llmEnabled()) return;
  if (app.sourceMode) {
    setStatus("Return to Reading text before requesting annotation proposals.");
    return;
  }
  const stateSnapshot = app.state;
  const folioIndex = app.folio;
  const folio = stateSnapshot.folios[folioIndex];
  if (!folio) return;
  const terms = unitTerms(stateSnapshot.sourceProfile);
  const scope = createProposalScope(stateSnapshot, folioIndex);
  const folioText = folio.lines.map((l) => l.cells.map((c) => c.text).join("")).join("\n").trim();
  if (!folioText) { setStatus(`Nothing to propose in this ${terms.singular}.`); return; }
  const eff = app.project ? llmForFile(app.project, app.docName) : null;
  const systemPrompt = eff && eff.systemPrompt ? eff.systemPrompt : "";
  const mapping = eff && eff.mapping && app.project && app.project.llmMappings
    ? (app.project.llmMappings[eff.mapping] || "") : "";
  const vocabulary = (app.markup || []).map((w) => w[2]).filter(Boolean);
  const resp = (eff && eff.responsibility) || standoff.AI_RESP;
  const btn = $("btn-propose");
  if (btn) btn.disabled = true;
  setStatus(`Asking the model for annotation proposals in this ${terms.singular}...`);
  const job = beginAiJob("proposal", scope);
  try {
    const reply = await complete(buildSuggestPrompt(folioText, { systemPrompt, mapping, vocabulary }),
      { signal: job.signal });
    if (!aiJobCurrent(job)) return;
    if (app.folio !== folioIndex || app.sourceMode !== job.snapshot.anchor.sourceMode) {
      setStatus(`The proposal response was discarded because the requested ${terms.singular} is no longer active.`);
      return;
    }
    const proposals = parseSuggestions(reply);
    if (!proposals.length) { setStatus(`The model proposed no annotations for this ${terms.singular}.`); return; }
    const result = applyProposals(stateSnapshot, proposals, { resp, scope });
    if (!result.applied.length) {
      setStatus(`None of the ${proposals.length} proposal(s) could be placed in this ${terms.singular}.`);
      return;
    }
    // Make the @resp a real pointer, then adopt the proposed doc through the single
    // mutation path so it renders violet, marks dirty, and stays reviewable.
    const marked = standoff.ensureRespStmt(result.state.doc, resp);
    const createdDeclaration = marked !== result.state.doc;
    const proposalBaseline = app.proposalBaseline || { raw: stateSnapshot.doc.raw, dirty: app.dirty };
    const skip = result.skipped.length ? ` ${result.skipped.length} could not be placed.` : "";
    const committed = commitStandoff(() => marked, {
      label: `Proposed ${result.applied.length} annotation(s): violet and unverified, confirm or reject each.${skip}`,
      failPrefix: "Propose",
    });
    if (committed) {
      if (createdDeclaration) app.proposalRespCreated.add(resp);
      app.proposalBaseline = proposalBaseline;
    }
  } catch (err) {
    if (job.signal.aborted || (err && err.name === "AbortError")) return;
    setStatus(`Proposal failed: ${err.message}. Set a provider and API key via "New from text (LLM)" first.`);
  } finally {
    finishAiJob(job);
    if (btn) btn.disabled = false;
  }
}

$("btn-generate").addEventListener("click", genModal.open);
const proposeBtn = $("btn-propose");
if (proposeBtn) proposeBtn.addEventListener("click", proposeOnFolio);
applyLlmGate();
// Deep link from the landing page: editor.html#generate opens the LLM entry.
if (llmEnabled() && location.hash === "#generate") genModal.open();

/**
 * Deterministic on-ramp build: the SAME plaintext->TEI draft, plus a <facsimile>
 * whose surfaces bind by page order to the attached images. Page images are held
 * in memory (object URLs) until a Save into a project folder writes them to disk;
 * the on-ramp adopts the open folder as the save target so the first Save lands
 * the .xml and the images together.
 */
async function buildFromTextAndImages({ text, title, images, profile = "generic", metadata = {} }) {
  const replacement = authorizeDocumentReplacement();
  if (!replacement) return false;
  const tei = teiFromStarter({ text, title, profile, metadata, images: images.map((im) => ({ name: im.name })) });
  const pageImages = pageImageStore.fromUploads(images);
  const xmlName = draftFilename(title);
  const inFolder = !!app.projectFolder;
  const opened = await adoptDraft({
    tei, xmlName, txtName: title,
    project: inFolder ? app.projectFolder.project : null,
    pageImages,
    replacement,
    statusMsg: `Crafted ${xmlName} from text with ${images.length} page image(s) attached. `
      + (inFolder
        ? "Save writes the TEI and the images into the project folder."
        : "Save downloads the TEI; open or create a project folder to keep the images with it."),
  });
  if (!opened) {
    for (const rec of pageImages.values()) if (rec && rec.url) URL.revokeObjectURL(rec.url);
    return false;
  }
  if (inFolder) app.saveTarget = { dir: app.projectFolder.dir, name: xmlName };
  setDirty(true);
  return true;
}
const imageOnramp = setupImageOnramp({ build: buildFromTextAndImages });

// ---- wire-up ---------------------------------------------------------------

// One loading entry (operator feedback 2026-06-10): the "Load..." menu carries
// the local-file picker AND the three examples. A real button menu, not a
// select-as-action: toggle on the button, close on item click, outside click,
// or Escape.
const loadBtn = $("btn-load");
const loadMenu = $("ed-load-menu");
function closeLoadMenu() {
  loadMenu.hidden = true;
  loadBtn.setAttribute("aria-expanded", "false");
}
loadBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  loadMenu.hidden = !loadMenu.hidden;
  loadBtn.setAttribute("aria-expanded", String(!loadMenu.hidden));
});
document.addEventListener("click", (e) => {
  if (!loadMenu.hidden && !(e.target instanceof Element && e.target.closest(".ed-dd-wrap"))) {
    closeLoadMenu();
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !loadMenu.hidden) closeLoadMenu();
});
$("menu-open").addEventListener("click", () => {
  closeLoadMenu();
  openLocal();
});
$("menu-open-project").addEventListener("click", () => {
  closeLoadMenu();
  projectFolderUi.openProjectFolder();
});
$("menu-new-project").addEventListener("click", () => {
  closeLoadMenu();
  projectFolderUi.newProject();
});
$("menu-new-from-text").addEventListener("click", () => {
  closeLoadMenu();
  imageOnramp.open();
});
// Built-in examples: shown during local development, removed on the public
// deployment (FEATURES.examples), together with their menu separator.
if (FEATURES.examples) {
  for (const item of document.querySelectorAll("[data-example]")) {
    item.addEventListener("click", () => {
      closeLoadMenu();
      loadExample(item.dataset.example);
    });
  }
} else {
  for (const node of document.querySelectorAll("#ed-load-menu [data-example], #ed-load-menu .ed-dd-sep")) {
    node.remove();
  }
}
// Runtime AI on/off toggle in the Load menu: present only when the build allows AI
// at all (else there is nothing to toggle). Persists per browser and re-applies the
// gate without a reload, so the operator can work in a deterministic standalone mode.
const aiToggle = $("menu-toggle-ai");
if (aiToggle && FEATURES.llmOnRamp) {
  const syncAiToggle = () => {
    const on = getSetting("llmEnabled", true) !== false;
    aiToggle.setAttribute("aria-checked", String(on));
    aiToggle.textContent = on ? "AI assistance: on" : "AI assistance: off";
  };
  syncAiToggle();
  aiToggle.addEventListener("click", () => {
    closeLoadMenu();
    setSetting("llmEnabled", getSetting("llmEnabled", true) === false);
    syncAiToggle();
    applyLlmGate();
  });
} else if (aiToggle) {
  const sep = aiToggle.previousElementSibling;
  if (sep && sep.classList && sep.classList.contains("ed-dd-sep")) sep.remove();
  aiToggle.remove();
}
setupDragDrop();
setupTablist($("ed-view-tabs"));
setupTablist($("ed-reading-variant"));
setupTablist($("ed-panel-tabs"));
// Left pane view switcher: reading text, page XML, or structured/raw metadata.
function setSourceMode(mode) {
  if (!app.state) return; // no document: the text views stay inert
  const next = mode === "page" || mode === "metadata" || mode === "metadata-form" ? mode : false;
  if (app.sourceMode === next) return;
  if (!stagedInput.allowChange("changing views")) return;
  sessionSafety.abortKind("proposal", "Requested page context changed");
  app.sourceMode = next;
  annot.removeSelPopover();
  annot.removeMenu();
  render();
}
$("view-reading").addEventListener("click", () => setSourceMode(false));
$("view-xml").addEventListener("click", () => setSourceMode("page"));
$("view-metadata").addEventListener("click", () => setSourceMode("metadata-form"));
// F4 reading-variant switcher (visible only for dual-reading documents).
$("variant-dipl").addEventListener("click", () => setReadingVariant("dipl"));
$("variant-norm").addEventListener("click", () => setReadingVariant("norm"));
$("btn-prev").addEventListener("click", () => gotoFolio(app.folio - 1));
$("btn-next").addEventListener("click", () => gotoFolio(app.folio + 1));
$("btn-viewmode").addEventListener("click", () => setViewMode(app.viewMode === "continuous" ? "paged" : "continuous"));
$("ed-ann-summary").addEventListener("click", (event) => {
  event.stopPropagation();
  const popover = $("ed-ann-popover");
  const open = popover.hidden;
  popover.hidden = !open;
  $("ed-ann-summary").setAttribute("aria-expanded", String(open));
});
$("btn-read-only").addEventListener("pointerdown", (event) => event.preventDefault());
$("btn-read-only").addEventListener("click", toggleDocumentMode);
$("ed-review-summary").addEventListener("click", async () => {
  if (!app.state || app.readOnly) return;
  if (!resolveStagedOutput("Review")) return;
  const current = currentReviewSummary().pages[app.folio];
  if (!current || !current.markable) return;
  const unit = unitTerms(app.state.sourceProfile).singular;
  const state = app.state;
  const details = current.reviewed ? { who: getSetting("reviewerIdentity", "urn:teicrafter:local-reviewer") }
    : await chooseReviewDetails(unit, current.record);
  if (!details) return;
  if (app.state !== state) { setStatus("The document changed while review details were open. Review the current revision again."); return; }
  const next = setFolioReviewed(app.state, app.folio, !current.reviewed, details);
  commitStandoff(() => next.doc, {
    label: current.reviewed
      ? `${unit[0].toUpperCase()}${unit.slice(1)} reopened for editorial review`
      : `${unit[0].toUpperCase()}${unit.slice(1)} marked as editorially reviewed`,
    failPrefix: "Review state",
  });
});
document.addEventListener("click", (event) => {
  const wrap = $("ed-ann-progress");
  if (wrap && !wrap.contains(event.target)) closeAnnotationProgress();
});
// Page turning where one expects it: arrow keys, unless typing in an input or
// an inline chooser is open, or the continuous view (which has no pages to step).
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !$("ed-ann-popover").hidden) {
    closeAnnotationProgress();
    $("ed-ann-summary").focus();
    return;
  }
  if (!app.state || app.viewMode === "continuous"
    || app.sourceMode === "metadata" || app.sourceMode === "metadata-form") return;
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
  const t = e.target;
  if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
  if (document.querySelector("#ed-reading .ed-crit-pick, #ed-sel-pop, #ed-menu")) return;
  if (!$("gen-modal").hidden) return;
  gotoFolio(app.folio + (e.key === "ArrowRight" ? 1 : -1));
});
$("btn-save").addEventListener("click", save);
$("btn-download").addEventListener("click", () => download());
$("btn-working-copy").addEventListener("click", () => downloadWorkingCopy());
$("btn-open-working-copy").addEventListener("click", openWorkingCopy);
$("btn-undo").addEventListener("click", () => applyHistory("undo"));
$("btn-redo").addEventListener("click", () => applyHistory("redo"));
document.addEventListener("keydown", (event) => {
  const command = historyCommand(event);
  if (!command) return;
  event.preventDefault();
  applyHistory(command);
});
$("btn-export-inline").addEventListener("click", downloadInlineGND);
$("btn-attach-facsimiles").addEventListener("click", attachFacsimileFolder);

// View controls: text zoom and the context-pane separator. Ctrl/Cmd+\ mirrors
// the separator's Enter action; arrow keys resize the panes.
$("ed-zoom-in").addEventListener("click", () => applyZoom(currentZoom() + ZOOM_STEP));
$("ed-zoom-out").addEventListener("click", () => applyZoom(currentZoom() - ZOOM_STEP));
$("ed-zoom-reset").addEventListener("click", () => applyZoom(1));
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "\\" && app.state) {
    e.preventDefault();
    setRightCollapsed(!app.rightCollapsed);
  }
});
setupSplitter();
applyZoom(currentZoom());

// Validation chip (in the reading-pane header, next to where the work happens):
// the live checks run on every render; the chip opens the detail popover
// anchored under itself, a click elsewhere or Escape closes it.
$("ed-val-chip").addEventListener("click", (e) => {
  e.stopPropagation();
  const pop = $("ed-val-pop");
  if (pop.hidden) {
    const r = e.currentTarget.getBoundingClientRect();
    pop.style.top = `${r.bottom + 8}px`;
    pop.style.right = `${Math.max(8, window.innerWidth - r.right)}px`;
  }
  pop.hidden = !pop.hidden;
});
document.addEventListener("click", (e) => {
  const pop = $("ed-val-pop");
  if (!pop.hidden && !(e.target instanceof Element && e.target.closest("#ed-val-pop"))) pop.hidden = true;
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !$("ed-val-pop").hidden) $("ed-val-pop").hidden = true;
});

window.addEventListener("beforeunload", (e) => {
  if (app.dirty || stagedSnapshot()) { e.preventDefault(); e.returnValue = ""; }
});
document.addEventListener("input", (event) => {
  if (event.target instanceof Element && event.target.closest(".ed-src-wrap, .ed-meta-form")) {
    void documentFacts.persistDraftIfNeeded();
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && (app.dirty || stagedInput.hasChanges())) void documentFacts.persistDraftIfNeeded();
});

render(); // start state: the empty editor (no document) with its load prompt

// Deep link from the landing page: editor.html#example=KEY loads that example.
// Gated like the menu entries: inert on the public deployment.
const exampleLink = location.hash.match(/^#example=([a-z]+)$/);
if (exampleLink && FEATURES.examples) loadExample(exampleLink[1]);
