/**
 * teiCrafter Editor (Editor path) -- UI controller / shell.
 *
 * Wires the deterministic, DOM-free edition core (edition.js) to the shell in
 * editor.html. No LLM anywhere in this path: every change is a direct,
 * human-driven, lossless offset splice on the raw TEI string.
 *
 * Since the M2.13 module split this file is the integrator: it owns the shared
 * app state, loading, rendering of the reading text, the live checks,
 * save/download, the inline cell editing (text / note / critical chooser), and
 * the dual-view shell (M2.14): the left pane is the text work surface (reading
 * text or XML source), the right pane hosts a switchable context panel from an
 * open registry (facsimile, entity index; a project profile can contribute
 * more via project.panels). The feature surfaces live in their own modules and
 * receive their dependencies via a ctx object:
 *   - annotation-ui.js   context menu, annotate popover, annotation editor
 *   - entity-index.js    entity index panel + live authority lookup
 *   - source-view.js     editable XML source view
 *   - gen-modal.js       LLM on-ramp ("New from text")
 */

import {
  parseEdition,
  editCellCore,
  editCellReadings,
  splitEdge,
  serialize,
  xmlIdSet,
  countTags,
  attrTargetForCell,
} from "./edition.js";
import { el, clear } from "./dom.js";
import { createFacsimile, plainImageTileSource } from "./facsimile.js";
import * as standoff from "./standoff.js";
import { markCritical, unwrapCritical, removeGap, CRITICAL_KINDS } from "./criticism.js";
import { createAnnotationUi } from "./annotation-ui.js";
import { createEntityIndex } from "./entity-index.js";
import { mountSourceView } from "./source-view.js";
import { setupGenModal } from "./gen-modal.js";
import { FEATURES } from "../utils/constants.js";
import { teiFromPlaintext } from "./plaintext-import.js";
import { detectProject, projectTileSource } from "./project-profiles.js";
import { parseManifest, resolveMarkup, teiScopeForFile, typeForFile } from "./project-manifest.js";
import { createProjectFolder } from "./project-folder.js";
import { createValidationView } from "./validation-view.js";
import { createDocumentFacts } from "./document-facts.js";
import {
  parseGuidelines, elementsForScope,
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
  noteByWord: new Map(), // wordId -> note text (for has-note marker + tooltip)
  currentLines: [],   // lines of the folio currently rendered (for zone <-> line linking)
  generated: false,   // true when the current edition came from the LLM (unreviewed)
  source: null,       // load provenance: { kind: "tei"|"draft"|"example", txtName?, label? } or null
  imageBase: null,    // base dir for per-folio page images, or null (no known images)
  panel: "facs",      // id of the active right-pane context panel (see PANELS)
  sourceMode: false,  // true while the left pane shows the editable XML source
  readingVariant: "dipl", // F4: "dipl" | "norm", which reading the pane shows (only meaningful when state.hasDualReadings)
  project: null,      // active project: manifest-parsed or PID-detected, or null
  projectFolder: null, // open project folder: { dir, name, files[], project }, or null (M2.9)
  markup: null,       // markup wrap list for the CURRENT document (per its type), or null (built-ins)
  saveTarget: null,   // { dir, name }: create this file in the project folder on first save (plaintext drafts)
  rightCollapsed: false, // true while the context pane is folded away (per-document, persisted)
};

// Persistent facsimile controller (one OSD instance reused across folios),
// created lazily once the DOM host exists.
let facsimile = null;

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
  app.dirty = d;
  const dot = $("ed-status-dot");
  dot.classList.toggle("dirty", d);
  $("btn-save").disabled = !app.state;
  if (d) { setStatus("Unsaved changes"); documentFacts.persistDraftIfNeeded(); }
  if (app.state) documentFacts.updateDocStrip();
}

function enableControls(on) {
  $("btn-download").disabled = !on;
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
  updateFolioButtons();
  updatePanels();
}

/** The left pane's view switcher reflects app.sourceMode (one source of truth). */
function syncViewTabs() {
  const reading = $("view-reading");
  const xml = $("view-xml");
  if (!reading || !xml) return;
  // Both text views need a document; until one loads the tabs stay inert.
  reading.disabled = xml.disabled = !app.state;
  // The view controls (zoom, collapse) belong with a loaded document.
  const vc = $("ed-view-controls");
  if (vc) vc.hidden = !app.state;
  reading.classList.toggle("active", !app.sourceMode);
  reading.setAttribute("aria-selected", String(!app.sourceMode));
  xml.classList.toggle("active", app.sourceMode);
  xml.setAttribute("aria-selected", String(app.sourceMode));
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
function buildLegend() {
  const host = $("ed-legend-chips");
  if (!host) return;
  clear(host);
  // The legend explains the reading-text codes; in the XML source view it is
  // dead vertical space, so it hides with the reading text.
  $("ed-legend").hidden = !app.state || app.sourceMode;
  if (!app.state || app.sourceMode) return;

  // Collect the codes the loaded document actually renders.
  const meta = entityMetaMap();
  const kinds = new Set();
  const crits = new Set();
  let ai = false, dangling = false;
  for (const cell of app.state.cells) {
    if (cell.crit) crits.add(cell.crit);
    if (cell.gap || !cell.mention) continue;
    const m = meta.get(cell.mention);
    if (!m) { dangling = true; continue; }
    kinds.add(m.kind);
    if (m.ai) ai = true;
  }
  const hasNote = app.noteByWord.size > 0;

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

  if (!chips.length) return;
  host.appendChild(el("span", { class: "ed-legend-title", text: "legend" }));
  for (const c of chips) host.appendChild(c);
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

async function load(raw, name, handle, project) {
  if (raw.length <= BIG_DOC_CHARS) { applyLoad(raw, name, handle, project); return; }
  showLoading(name);
  await nextPaint();
  try { applyLoad(raw, name, handle, project); }
  finally { hideLoading(); }
}

function applyLoad(raw, name, handle, project) {
  const t0 = performance.now();
  app.state = parseEdition(raw);
  app.folio = 0;
  app.fileHandle = handle || null;
  app.docName = name;
  app.noteByWord = standoff.noteIndex(app.state.doc);
  // Default: no known page images. An example with an imageBase (loadExample)
  // sets it afterwards; every other entry (open, drop, generate) stays null.
  app.imageBase = null;
  // Project: an explicit manifest (teicrafter.project.json, parsed by the
  // caller) wins; PID detection stays the fallback for bare files. The markup
  // wrap list binds to the document's TYPE within the project, not the project.
  app.project = project || detectProject(app.state.doc);
  // Load provenance for the Document panel's Source row. Default: an opened TEI
  // file. The plaintext and example paths override this after load() returns.
  app.source = { kind: "tei" };
  app.markup = resolveMarkup(app.project, name, guidelinesNow());
  maybePrefetchGuidelines(name);
  app.saveTarget = null;
  // Track real @xml:id values (not synthetic positional cell ids, which churn on
  // a lossless line-emptying edit and would raise a false "id lost" alarm).
  app.baseline = { wordCount: app.state.words.length, xmlIds: xmlIdSet(app.state), counts: countTags(raw) };
  // Default context panel: the facsimile when the document has page images, the
  // Document context panel otherwise (the empty entity Index is one click away).
  app.panel = docHasImages() ? "facs" : "document";
  // F4: the reading variant resets to diplomatic per load; applyDocLayout then
  // restores the persisted value when this document had one.
  app.readingVariant = "dipl";
  enableControls(true);
  applyDocLayout();
  if (handle) { recents.rememberRecent(handle, name); }
  setDirty(false);
  // The recovery slot is NOT cleared here: loading another document must not
  // silently discard a stored draft. It clears only when the draft itself is
  // saved or the operator discards the offer; a new draft overwrites the slot.
  markGenerated(false); // opening a real file clears the AI-generated flag
  // The plaintext-draft banner belongs to a draft only; any load hides it, the
  // draft paths re-show it afterwards. It must never linger over an opened .xml.
  documentFacts.hideDraftBanner();
  refreshAfterStandoffEdit();
  const unit = app.state.profile === "word" ? "word" : "line";
  const secs = ((performance.now() - t0) / 1000).toFixed(1);
  const docType = typeForFile(app.project, name);
  setStatus(`Loaded ${app.state.folios.length} folio(s), ${app.state.cells.length} ${unit}(s) [${app.state.profile}-level]`
    + (app.project ? `, project: ${app.project.name} (${app.project.source === "manifest" ? "manifest" : "detected"})` : "")
    + (docType ? `, type: ${docType.label}` : "")
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

async function loadPlaintextDraft(text, txtName) {
  const baseName = txtName.replace(RE_PLAINTEXT, "");
  const xmlName = `${baseName}.xml`;
  await load(teiFromPlaintext(text, baseName), xmlName, null);
  // Mirror the project-flow wording; a direct draft has no save target, so Save
  // downloads the TEI file (the project flow says "writes it into the folder").
  app.source = { kind: "draft", txtName };
  setStatus(`Drafted ${xmlName} deterministically from ${txtName} (text carried verbatim). `
    + "Save downloads the TEI file.");
  documentFacts.showDraftBanner(txtName);
  documentFacts.updateDocStrip();
  renderActivePanel();
}

async function openLocal() {
  if (!confirmDiscard()) return;
  // Preferred: File System Access API (lets us save in place later).
  if (window.showOpenFilePicker) {
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
      if (RE_PLAINTEXT.test(file.name)) {
        await loadPlaintextDraft(await file.text(), file.name);
      } else {
        await load(await file.text(), file.name, handle);
      }
      return;
    } catch (err) {
      if (err && err.name === "AbortError") return; // user cancelled
      // fall through to the input fallback on any other failure
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
    if (RE_PLAINTEXT.test(file.name)) {
      await loadPlaintextDraft(await file.text(), file.name);
    } else {
      await load(await file.text(), file.name, null);
    }
    _fileInput.value = "";
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
  return !app.dirty || window.confirm(`Discard unsaved changes in ${app.docName}?`);
}

async function loadExample(key) {
  let ex = EXAMPLES[key];
  if (!ex || !confirmDiscard()) return;
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
        if (mres.ok) project = parseManifest(await mres.text());
      } catch (err) {
        manifestNote = ` ${err.message}; built-in detection used instead.`;
      }
    }
    await load(await res.text(), ex.file, null, project);
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
    if (!confirmDiscard()) return;
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
  if (!confirmDiscard()) return;
  const h = await handlePromise;
  const handle = h && h.kind === "file" ? h : null;
  try {
    await load(await file.text(), file.name, handle);
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
  if (!confirmDiscard()) return;
  try {
    let perm = await rec.handle.queryPermission({ mode: "readwrite" });
    if (perm !== "granted") perm = await rec.handle.requestPermission({ mode: "readwrite" });
    if (perm !== "granted") {
      setStatus(`Permission to reopen ${rec.name} was not granted.`);
      return;
    }
    const file = await rec.handle.getFile();
    await load(await file.text(), file.name, rec.handle);
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

function updateFolioButtons() {
  const n = app.state ? app.state.folios.length : 0;
  $("btn-prev").disabled = !app.state || app.folio <= 0;
  $("btn-next").disabled = !app.state || app.folio >= n - 1;
  const f = app.state ? app.state.folios[app.folio] : null;
  $("ed-folio-label").textContent = f
    ? `page ${app.folio + 1}/${n}${f.n ? ` (${f.n})` : ""}`
    : "-";
}

function gotoFolio(i) {
  if (!app.state) return;
  app.folio = Math.max(0, Math.min(app.state.folios.length - 1, i));
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
// positional fallback (line index == zone index) for editions without it.
function highlightLine(lineIndex) {
  clearLinks();
  if (lineIndex == null || lineIndex < 0) return;
  for (const w of document.querySelectorAll(`#ed-reading [data-line="${lineIndex}"]`)) w.classList.add("linked");
  // When the context pane is collapsed the @facs sync simply has no target.
  if (!facsimile || app.rightCollapsed) return;
  const line = (app.currentLines || [])[lineIndex];
  facsimile.highlightZone(line && line.facs ? line.facs : lineIndex);
}

function highlightZone(zoneId, zoneIndex) {
  const lines = app.currentLines || [];
  let li = zoneId ? lines.findIndex((l) => l.facs === zoneId) : -1;
  if (li < 0) li = zoneIndex; // positional fallback
  highlightLine(li);
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
  const meta = new Map();
  if (!app.state) return meta;
  const all = standoff.readEntities(app.state.doc);
  for (const [key, type] of [
    ["persons", "person"], ["places", "place"], ["orgs", "org"],
    ["works", "work"], ["events", "event"],
  ]) {
    for (const e of all[key] || []) {
      if (e.id) meta.set(e.id, { name: e.name, kind: MENTION_KIND[type], ai: !!e.ai });
    }
  }
  return meta;
}

/**
 * Where has each entity been used? id -> { count, onPage } over all mention
 * cells, so the popovers and the index can say WHERE an entry comes from
 * (this page / this document / index only) instead of listing the raw standOff.
 */
function entityUsage() {
  const usage = new Map();
  app.state.folios.forEach((folio, fi) => {
    for (const line of folio.lines) {
      for (const c of line.cells) {
        if (!c.mention) continue;
        const rec = usage.get(c.mention) || { count: 0, onPage: false };
        rec.count += 1;
        if (fi === app.folio) rec.onPage = true;
        usage.set(c.mention, rec);
      }
    }
  });
  return usage;
}

// Text-structure wrappers that carry no scholarly semantics: they must not get
// the semantic-wrap treatment. Critical locals are styled by their own crit-*
// classes (handled separately), so they are excluded here too.
const STRUCTURE_WRAPS = new Set(["w", "l", "lb"]);
const SEM_WRAP_EXCLUDE = new Set(["unclear", "del", "add", "gap"]);

/**
 * The inline semantic element wrapping a cell's text (date, ref, salute, signed,
 * persName, ...), or null. Reuses attrTargetForCell (which already excludes the
 * reading containers p/head/note/body), then drops the bare text-structure
 * wrappers and the critical locals: what remains is a scholarly inline wrap whose
 * presence should be visible in the reading view. A linked mention is left to the
 * mention layer (it already shows). Returns the element node or null.
 */
function semanticWrapFor(cell) {
  if (!cell || cell.gap || cell.mention) return null;
  const elNode = attrTargetForCell(cell);
  if (!elNode) return null;
  if (STRUCTURE_WRAPS.has(elNode.localName) || SEM_WRAP_EXCLUDE.has(elNode.localName)) return null;
  return elNode;
}

/** Tooltip naming a semantic wrap and its attributes, e.g. "date when=1879-02-14". */
function semanticWrapTitle(elNode) {
  const attrs = (elNode.attrs || []).map((a) => `${a.name}=${a.value}`).join(" ");
  return attrs ? `${elNode.localName} ${attrs}` : elNode.localName;
}

function renderReading() {
  const host = $("ed-reading");
  clear(host);
  // The view tabs name what the pane currently shows; the source view drops
  // the body padding (the editor frame brings its own) so nothing overflows.
  syncViewTabs();
  if (!app.state) { host.classList.remove("src"); renderEmptyReading(host); return; }
  host.classList.toggle("src", app.sourceMode);
  if (app.sourceMode) { renderSourceView(host); return; }
  const folio = app.state.folios[app.folio];
  app.currentLines = folio ? folio.lines : [];
  if (!folio || !folio.lines.length) {
    host.appendChild(el("div", { class: "ed-empty", text: "This folio has no transcribed text." }));
    return;
  }
  const mentions = entityMetaMap();
  folio.lines.forEach((line, lineIndex) => {
    const row = el("div", { class: "ed-line", dataset: { line: String(lineIndex) } });
    // The line label (the document's @n) sits in the gutter; the cells go into a
    // body cell that wraps independently of the fixed-width number channel.
    row.appendChild(el("span", { class: "ed-line-n", text: line.n != null ? line.n : "" }));
    const body = el("span", { class: "ed-line-body" });
    line.cells.forEach((cell, k) => {
      if (k > 0) body.appendChild(document.createTextNode(" "));
      const note = app.noteByWord.get(cell.id);
      // A gap is a read-only marker (no text); other critical kinds add a class so
      // the wrapped reading text shows its editorial status (dotted / struck / added).
      const critClass = cell.crit ? " crit-" + cell.crit : "";
      // M2.5 visibility layer: a linked mention renders in its entity-type colour;
      // a mention of an AI-proposed (unconfirmed) entity renders in the violet AI
      // family, so machine output stays separable (design.md). A mention whose
      // target id is missing keeps the generic fallback style.
      const meta = !cell.gap && cell.mention ? mentions.get(cell.mention) || null : null;
      const mentionClass = !cell.gap && cell.mention
        ? " mention" + (meta ? ` mention-${meta.kind}${meta.ai ? " mention-ai" : ""}` : "")
        : "";
      // F4: the normalized variant shows @norm where a word carries one, the
      // text as written otherwise; gap cells keep their marker. The diplomatic
      // variant always shows the text as written.
      const display = cell.gap
        ? "[...]"
        : (app.readingVariant === "norm" && cell.w && cell.w.norm != null ? cell.w.norm : cell.text);
      // Semantic-wrap visibility (M2.5 family): text inside a scholarly inline
      // element (date, ref, salute, ...) that is neither a mention nor critical
      // gets a subtle dotted underline and a tooltip naming the element and its
      // attributes, so the markup is visible without changing text metrics.
      const semWrap = semanticWrapFor(cell);
      const semClass = semWrap ? " ed-w-sem" : "";
      const semTitlePart = semWrap ? semanticWrapTitle(semWrap) : null;
      const baseTitle = critTitle(cell, note, meta);
      const span = el("span", {
        class: "ed-w" + (note ? " has-note" : "") + critClass + mentionClass + semClass,
        dataset: { id: cell.id, line: String(lineIndex), start: String(cell.start) },
        text: display,
        title: semTitlePart ? `${semTitlePart}; ${baseTitle}` : baseTitle,
      });
      // Editor paradigm (operator decision 2026-06-10): a plain click only sets
      // the cursor. Clicking an ANNOTATED element opens its annotation editor;
      // a gap opens its remove chooser; double-click edits the text directly;
      // right-click opens the context menu; selecting text annotates it.
      span.addEventListener("click", (e) => {
        if (e.detail > 1) return; // second click of a double-click
        const sel = window.getSelection();
        if (sel && !sel.isCollapsed) return; // the selection owns this click
        if (cell.gap) { beginCritic(span, cell); return; }
        if (cell.mention) { annot.openAnnotationEditor(span, cell); return; }
        // plain reading text: the click is just a cursor, not a command
      });
      span.addEventListener("dblclick", (e) => {
        e.stopPropagation();
        if (cell.gap) return;
        const c = app.state.cellById.get(cell.id);
        if (!c) return;
        // F4: a word whose text sits directly inside its <w> takes the two-field
        // diplomatic/normalized editor (the engine's atomic op accepts it). A <w>
        // wrapping further markup (e.g. <unclear>) is refused there, so it keeps
        // the single-field text edit.
        if (c.w && c.node.parent === c.w.el) beginReadingsInput(span, c);
        else beginTextInput(span, c);
      });
      span.addEventListener("mouseenter", () => highlightLine(lineIndex));
      span.addEventListener("mouseleave", () => clearLinks());
      body.appendChild(span);
    });
    row.appendChild(body);
    host.appendChild(row);
  });
}

// ---- empty state (no document loaded) --------------------------------------
// No separate welcome screen: the editor opens on its empty two-pane layout
// and the reading pane carries a lean prompt to load a document or project,
// plus the recent files (when any) for quick re-entry.
function renderEmptyReading(host) {
  const box = el("div", { class: "ed-empty-start" });
  box.appendChild(el("p", { class: "ed-empty-lead",
    text: "Open a TEI document or a project folder to start editing." }));
  box.appendChild(el("p", { class: "ed-empty-hint",
    text: "Use the Load... menu above, or drop a .xml, .txt or .md file anywhere on this page. Plaintext opens as a line-level draft; saving produces the TEI file." }));
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
 * Editable XML source view (the Oxygen text-mode counterpart to the reading
 * view), mounted from source-view.js: syntax-highlighted overlay, line
 * numbers, explicit Check XML, Apply gated on well-formedness (the integrity
 * chip then shows any drift against the load baseline). The caret starts at
 * the current page's first reading cell.
 */
// Above this size the source view would freeze the tab (the gutter alone would
// hold millions of line numbers); the reading view and Download stay available.
const SOURCE_VIEW_LIMIT = 8_000_000;

function renderSourceView(host) {
  const leave = () => {
    app.sourceMode = false;
    refreshAfterStandoffEdit();
  };
  if (app.state.raw.length > SOURCE_VIEW_LIMIT) {
    const mb = (app.state.raw.length / 1_000_000).toFixed(0);
    host.appendChild(el("div", { class: "ed-empty", text:
      `This document is too large for the in-browser source editor (${mb} MB). `
      + "Edit it in the reading view, or use Download and a desktop editor for raw XML work." }));
    return;
  }
  const folio = app.state.folios[app.folio];
  const firstCell = folio && folio.lines[0] && folio.lines[0].cells[0];
  mountSourceView(host, {
    value: serialize(app.state),
    caret: firstCell && Number.isInteger(firstCell.start) ? firstCell.start : 0,
    wellFormed: validationView.isWellFormed,
    onApply: (text) => {
      try {
        const changed = text !== app.state.raw;
        app.state = parseEdition(text);
        app.noteByWord = standoff.noteIndex(app.state.doc);
        app.folio = Math.max(0, Math.min(app.folio, app.state.folios.length - 1));
        if (changed) setDirty(true);
        setStatus(changed ? "XML source applied" : "XML source unchanged");
        leave();
        return true;
      } catch (err) {
        setStatus(`Not applied, parse failed: ${err.message}`);
        return false;
      }
    },
    onCancel: () => { setStatus("Source edits discarded"); leave(); },
  });
}

/** The plain text-correction input, extracted from beginEdit (M2.6 refactor). */
function beginTextInput(span, cell) {
  // Edit only the trimmed core; the node's edge whitespace (indentation/newlines)
  // is re-attached on commit, so a line edit never collapses the surrounding
  // formatting. Word-level <w> nodes have no edge whitespace (core === cell.text).
  const [, core] = splitEdge(cell.text);

  const inp = el("input", { class: "ed-w-input", type: "text", value: core });
  inp.style.width = `${Math.min(60, Math.max(2, core.length + 1))}ch`;
  inp.style.maxWidth = "100%";
  span.replaceWith(inp);
  inp.focus();
  inp.select();

  let done = false;
  const commit = () => {
    if (done) return;
    done = true;
    const nextCore = inp.value;
    if (nextCore !== core) {
      try {
        app.state = editCellCore(app.state, cell.id, nextCore);
        setDirty(true);
      } catch (err) {
        setStatus(`Edit failed: ${err.message}`);
      }
    }
    render(); // re-render the folio with refreshed offsets
  };
  const cancel = () => {
    if (done) return;
    done = true;
    render();
  };
  inp.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); commit(); }
    else if (e.key === "Escape") { e.preventDefault(); cancel(); }
  });
  inp.addEventListener("blur", commit);
}

/**
 * F4 two-field edit on a dual-reading word: the diplomatic core (text content,
 * @orig kept in sync by the engine) and the normalized reading (@norm). Used in
 * place of beginTextInput when the cell's text sits directly inside its <w>
 * (the dblclick handler gates this; the engine refuses a <w> that wraps further
 * markup). An empty Normalized field removes @norm, which claims no normalization.
 */
function beginReadingsInput(span, cell) {
  const [, core] = splitEdge(cell.text);
  const norm = cell.w.norm != null ? cell.w.norm : "";

  const form = el("span", { class: "ed-readings-form" });
  const field = (label, value) => {
    const wrap = el("label", { class: "ed-readings-field" });
    wrap.appendChild(el("span", { class: "ed-readings-label", text: label }));
    const inp = el("input", { class: "ed-w-input", type: "text", value });
    inp.style.width = `${Math.min(40, Math.max(2, value.length + 1))}ch`;
    inp.style.maxWidth = "100%";
    wrap.appendChild(inp);
    form.appendChild(wrap);
    return inp;
  };
  const diplInp = field("Diplomatic", core);
  const normInp = field("Normalized", norm);

  span.replaceWith(form);
  // Focus the field matching the current variant, so the variant on screen is
  // the one the cursor lands in.
  const focusInp = app.readingVariant === "norm" ? normInp : diplInp;
  focusInp.focus();
  focusInp.select();

  let done = false;
  const commit = () => {
    if (done) return;
    done = true;
    const diplVal = diplInp.value;
    const normVal = normInp.value;
    if (diplVal !== core || normVal !== norm) {
      try {
        const next = editCellReadings(app.state, cell.id, { core: diplVal, norm: normVal });
        if (next !== app.state) { app.state = next; setDirty(true); }
        else setStatus("Edit not applied: this word wraps further markup.");
      } catch (err) {
        setStatus(`Edit failed: ${err.message}`);
      }
    }
    render();
  };
  const cancel = () => {
    if (done) return;
    done = true;
    render();
  };
  const onKey = (e) => {
    if (e.key === "Enter") { e.preventDefault(); commit(); }
    else if (e.key === "Escape") { e.preventDefault(); cancel(); }
  };
  diplInp.addEventListener("keydown", onKey);
  normInp.addEventListener("keydown", onKey);
  // Commit only when focus leaves the whole form; moving between the two fields
  // (relatedTarget still inside the form) must not commit.
  form.addEventListener("focusout", (e) => {
    if (!form.contains(e.relatedTarget)) commit();
  });
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
  try {
    const r = standoff.applyMutation(app.state.doc, fn);
    if (!r.changed) {
      if (noopLabel) setStatus(noopLabel);
      return false;
    }
    app.state = r.edition;
    app.noteByWord = r.notes;
    setDirty(true);
    if (label) setStatus(label);
    refreshAfterStandoffEdit();
    return true;
  } catch (err) {
    setStatus(`${failPrefix} failed: ${err.message}`);
    return false;
  }
}

// ---- editorial notes (M3.5) ------------------------------------------------

/** Attach an editorial note to a cell: a small input, then a lossless standOff insert. */
function beginNote(span, cell) {
  const existing = app.noteByWord.get(cell.id) || "";
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
function critTitle(cell, note, meta) {
  if (cell.gap) return "gap: omitted or illegible text; click to remove";
  const parts = [];
  if (cell.mention) {
    // "unverified" is the one term for the unconfirmed-AI state everywhere
    // (index panel, standOff contract); label consistency is a rule.
    parts.push(meta
      ? `Linked to ${meta.name || "(unnamed)"} (${cell.mention})${meta.ai ? "; AI-proposed, unverified" : ""}`
      : `Linked to a missing entity (${cell.mention})`);
  }
  if (cell.crit) {
    // The tooltip uses the same human label as the legend and the chooser
    // buttons (CRITICAL_KINDS), never the raw TEI localName ("del"/"add").
    const critLabel = (CRITICAL_KINDS[cell.crit] || {}).label || cell.crit;
    parts.push(cell.critSole ? critLabel : `${critLabel} (shared markup)`);
  }
  if (note) parts.push(`note: ${note}`);
  // F4: a dual-reading cell names the other reading, so the variant not on
  // screen is still visible in the tooltip.
  if (cell.w && cell.w.norm != null) {
    parts.push(app.readingVariant === "norm"
      ? `as written: ${cell.text.trim()}`
      : `normalized: ${cell.w.norm}`);
  }
  parts.push(cell.mention ? "click to edit the annotation"
    : "double-click to edit; right-click for actions");
  return parts.join("; ");
}

/**
 * Replace a cell with a small chooser of textual-critical actions, then apply the
 * chosen one losslessly. A gap cell offers only removal; any other cell offers the
 * four markers, plus "clear" when it already carries a wrapper.
 */
function beginCritic(span, cell) {
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
  facsimile = createFacsimile(host, {
    tileSourceFor: (url) => projectTileSource(app.project, url) || plainImageTileSource(url),
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
  return app.state.folios.some((f) => f.surface && f.surface.graphic);
}

// ---- right-pane context panels (M2.14 dual view) -----------------------------
// The right pane is always there; WHAT it shows is a panel from this registry.
// Built-ins: facsimile and entity index. The registry is open: a project
// profile may contribute panels via project.panels, each
// { id, label, title, available()?, render()? | mount(hostEl)? }; a panel
// without a static host element in editor.html gets one created on demand.

const PANELS = [
  {
    id: "document", label: "Document", host: "ed-panel-document",
    title: "The loaded document's facts: name, source, project, editing unit, counts and save target",
    available: () => true,
    render: () => documentFacts.renderDocumentPanel(),
  },
  {
    id: "facs", label: "Facsimile", host: "ed-panel-facs",
    title: "Page image with TEI zones; hovering a zone highlights the linked text and vice versa",
    unavailableTitle: "This document carries no page images",
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
    host = el("div", { class: "ed-panel", id: `ed-panel-${p.id}` });
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
    const avail = !!app.state && (!p.available || p.available());
    const active = p.id === app.panel;
    const tab = el("button", {
      class: "ed-tab" + (active ? " active" : ""), type: "button", role: "tab",
      "aria-selected": String(active),
      title: avail ? p.title : (p.unavailableTitle || p.title),
      text: p.label,
    });
    tab.disabled = !avail;
    tab.addEventListener("click", () => showPanel(p.id));
    tabsHost.appendChild(tab);
    panelHost(p).hidden = !active;
  }
}

function showPanel(id) {
  app.panel = id;
  saveDocLayout({ panel: id });
  updatePanels();
  renderActivePanel();
}

/** Render the active panel's content (called by render() and showPanel()). */
function renderActivePanel() {
  if (!app.state) return;
  const p = activePanels().find((x) => x.id === app.panel);
  if (!p) return;
  if (p.render) p.render();
  else if (p.mount) p.mount(panelHost(p));
}

function renderFacsimile() {
  if (!app.state || app.panel !== "facs" || app.rightCollapsed) return;
  const ctrl = ensureFacsimile();
  if (!ctrl) return;
  const folio = app.state.folios[app.folio];
  const surface = folio && folio.surface;
  // Prefer the hardcoded demo image base; otherwise fall back to a <graphic url>
  // carried by the surface itself, so any opened TEI with facsimile images shows.
  const imageUrl = imageUrlForFolio(app.folio) || (surface && surface.graphic) || null;
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

async function save() {
  if (!app.state) return;
  const raw = serialize(app.state);
  // Whether THIS document owns the recovery slot: only a draft's own save may
  // clear it; saving an unrelated document must not discard a stored draft.
  const wasDraft = documentFacts.isUnsavedDraft();
  // A plaintext draft has no file yet: first save creates the .xml in the
  // project folder, then the normal in-place path takes over.
  await projectFolderUi.finalizeSaveTarget();
  if (app.fileHandle && app.fileHandle.createWritable) {
    try {
      const writable = await app.fileHandle.createWritable();
      await writable.write(raw);
      await writable.close();
      setDirty(false);
      if (wasDraft) documentFacts.clearDraftRecovery(); // the draft now has a real file
      setStatus(`Saved in place: ${app.docName}`);
      return;
    } catch (err) {
      setStatus(`Save in place failed (${err.message}); downloading instead`);
    }
  }
  download();
  setDirty(false);
  // The download also produced the TEI file; the draft's recovery slot (and
  // only the draft's) is no longer the only copy.
  if (wasDraft) documentFacts.clearDraftRecovery();
}

function download() {
  if (!app.state) return;
  const raw = serialize(app.state);
  const blob = new Blob([raw], { type: "application/xml" });
  const url = URL.createObjectURL(blob);
  const a = el("a", { href: url, download: app.docName || "edition.xml" });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  setStatus(`Downloaded ${app.docName || "edition.xml"}`);
}

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
  const btn = $("ed-collapse-btn");
  if (btn) {
    btn.setAttribute("aria-pressed", String(on));
    btn.title = on ? "Show the context pane" : "Hide the context pane";
    btn.textContent = on ? "⇤" : "⇥"; // expand back / collapse away
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
  let dragging = false;
  splitter.addEventListener("pointerdown", (e) => {
    if (main.classList.contains("right-collapsed")) return;
    dragging = true;
    splitter.setPointerCapture(e.pointerId);
    document.body.style.cursor = "col-resize";
    e.preventDefault();
  });
  splitter.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const rect = main.getBoundingClientRect();
    setSplitPct(clamp(widthPct(e.clientX - rect.left)), false);
  });
  const end = (e) => {
    if (!dragging) return;
    dragging = false;
    try { splitter.releasePointerCapture(e.pointerId); } catch (_) { /* not captured */ }
    document.body.style.cursor = "";
    saveDocLayout({ split: Math.round(curPct() * 10) / 10 });
  };
  splitter.addEventListener("pointerup", end);
  splitter.addEventListener("pointercancel", end);
  splitter.addEventListener("dblclick", () => setSplitPct(50));
  splitter.addEventListener("keydown", (e) => {
    const step = e.shiftKey ? 5 : 2;
    if (e.key === "ArrowLeft") { setSplitPct(clamp(curPct() - step)); e.preventDefault(); }
    else if (e.key === "ArrowRight") { setSplitPct(clamp(curPct() + step)); e.preventDefault(); }
    else if (e.key === "Home") { setSplitPct(50); e.preventDefault(); }
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
}

// ---- feature modules (M2.13 split) ------------------------------------------
// Instantiated once at startup; dependencies flow in via a ctx object, the
// surfaces (popovers, overlay, modal) flow back through the returned APIs.

const overlay = createEntityIndex({
  app, setStatus, commitStandoff,
  gotoFolio, highlightMentions, entityUsage,
  showPanel,
});
const annot = createAnnotationUi({
  app, setStatus, commitStandoff,
  entityMetaMap, entityUsage,
  runLookup: overlay.runLookup,
  revealEntity: overlay.revealEntity,
  highlightMentions, beginTextInput, beginNote, beginCritic,
  ensureGuidelines, guidelinesNow,
});
const projectFolderUi = createProjectFolder({
  app, setStatus, setDirty, confirmDiscard, load,
  showPanel, updatePanels, teiVocabularyLine,
  getProjectPanelHost: () => panelHost(activePanels().find((p) => p.id === "project")),
  // Project-flow plaintext draft: same neutral banner and Source provenance as
  // the direct draft path (the wording differs: a project draft saves in place).
  onPlaintextDraft: (txtName) => { app.source = { kind: "draft", txtName }; documentFacts.showDraftBanner(txtName); },
});
const validationView = createValidationView({ app });
const documentFacts = createDocumentFacts({
  app, setStatus, setDirty, load, render, renderActivePanel,
});
// LLM on-ramp ("New from text"), hidden while the flag is off. The flag
// restores the toolbar button and the #generate deep link.
if (FEATURES.llmOnRamp) {
  const genModal = setupGenModal({ load, markGenerated, setDirty, setStatus });
  $("btn-generate").hidden = false;
  $("btn-generate").addEventListener("click", genModal.open);
  // Deep link from the landing page: editor.html#generate opens the LLM entry.
  if (location.hash === "#generate") genModal.open();
}

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
setupDragDrop();
// Left pane view switcher: reading text or XML source, one always active.
function setSourceMode(on) {
  if (!app.state) return; // no document: the text views stay inert
  if (app.sourceMode === on) return;
  app.sourceMode = on;
  annot.removeSelPopover();
  annot.removeMenu();
  render();
}
$("view-reading").addEventListener("click", () => setSourceMode(false));
$("view-xml").addEventListener("click", () => setSourceMode(true));
// F4 reading-variant switcher (visible only for dual-reading documents).
$("variant-dipl").addEventListener("click", () => setReadingVariant("dipl"));
$("variant-norm").addEventListener("click", () => setReadingVariant("norm"));
$("btn-prev").addEventListener("click", () => gotoFolio(app.folio - 1));
$("btn-next").addEventListener("click", () => gotoFolio(app.folio + 1));
// Page turning where one expects it: arrow keys, unless typing in an input or
// an inline chooser is open.
document.addEventListener("keydown", (e) => {
  if (!app.state) return;
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
  const t = e.target;
  if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
  if (document.querySelector("#ed-reading .ed-crit-pick, #ed-sel-pop, #ed-menu")) return;
  if (!$("gen-modal").hidden) return;
  gotoFolio(app.folio + (e.key === "ArrowRight" ? 1 : -1));
});
$("btn-save").addEventListener("click", save);
$("btn-download").addEventListener("click", download);

// The document strip opens the Document context panel; its Dismiss button hides
// the plaintext-draft banner until the next draft.
$("ed-docstrip").addEventListener("click", () => { if (app.state) showPanel("document"); });
$("ed-draftbanner-dismiss").addEventListener("click", documentFacts.hideDraftBanner);

// View controls: text zoom (a global preference) and the context-pane collapse
// toggle. Ctrl/Cmd+\ mirrors the collapse button; the splitter resizes the panes.
$("ed-zoom-in").addEventListener("click", () => applyZoom(currentZoom() + ZOOM_STEP));
$("ed-zoom-out").addEventListener("click", () => applyZoom(currentZoom() - ZOOM_STEP));
$("ed-zoom-reset").addEventListener("click", () => applyZoom(1));
$("ed-collapse-btn").addEventListener("click", () => setRightCollapsed(!app.rightCollapsed));
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
  if (app.dirty) { e.preventDefault(); e.returnValue = ""; }
});

render(); // start state: the empty editor (no document) with its load prompt

// Deep link from the landing page: editor.html#example=KEY loads that example.
// Gated like the menu entries: inert on the public deployment.
const exampleLink = location.hash.match(/^#example=([a-z]+)$/);
if (exampleLink && FEATURES.examples) loadExample(exampleLink[1]);
