/**
 * teiCrafter Editor (Editor path) -- UI controller / shell.
 *
 * Wires the deterministic, DOM-free edition core (edition.js) to the shell in
 * editor.html. No LLM anywhere in this path: every change is a direct,
 * human-driven, lossless offset splice on the raw TEI string.
 *
 * Since the M2.13 module split this file is the integrator: it owns the shared
 * app state, loading, rendering of the reading text, the facsimile, the live
 * checks, save/download, and the inline cell editing (text / note / critical
 * chooser). The feature surfaces live in their own modules and receive their
 * dependencies via a ctx object:
 *   - annotation-ui.js   context menu, annotate popover, annotation editor
 *   - index-overlay.js   on-demand entity index + live authority lookup
 *   - source-view.js     editable XML source view
 *   - gen-modal.js       LLM on-ramp ("New from text")
 */

import {
  parseEdition,
  editCellCore,
  splitEdge,
  serialize,
  structuralSummary,
  xmlIdSet,
  countTags,
  unescapeXmlText,
} from "./edition.js";
import { el, clear } from "./dom.js";
import { createFacsimile, plainImageTileSource } from "./facsimile.js";
import * as standoff from "./standoff.js";
import { markCritical, unwrapCritical, removeGap, CRITICAL_KINDS } from "./criticism.js";
import { createAnnotationUi } from "./annotation-ui.js";
import { createIndexOverlay } from "./index-overlay.js";
import { mountSourceView } from "./source-view.js";
import { setupGenModal } from "./gen-modal.js";
import { detectProject, projectTileSource } from "./project-profiles.js";
import * as recents from "./recent-files.js";

const DEMO_URL = "data/editor/wenzelsbibel-synthetic-codex.xml";
const ZBZ_URL = "data/editor/zbz-100/zbz-hersch-100.xml";
const ZBZ_IMAGE_BASE = "data/editor/zbz-100/";
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
  imageBase: null,    // base dir for per-folio page images, or null (no known images)
  facsHidden: false,  // user choice: hide the facsimile pane (auto-hidden when no images)
  sourceMode: false,  // true while the reading pane shows the editable XML source
  project: null,      // detected project profile (project-profiles.js), or null
};

// Persistent facsimile controller (one OSD instance reused across folios),
// created lazily once the DOM host exists.
let facsimile = null;

const $ = (id) => document.getElementById(id);

// ---- status / dirty --------------------------------------------------------

function setStatus(msg) {
  $("ed-status").textContent = msg;
}

function setDirty(d) {
  app.dirty = d;
  const dot = $("ed-status-dot");
  dot.classList.toggle("dirty", d);
  $("btn-save").disabled = !app.state;
  if (d) setStatus("Unsaved changes");
}

function enableControls(on) {
  for (const id of ["btn-download", "btn-index", "btn-xml"]) $(id).disabled = !on;
  $("btn-save").disabled = !on;
  // The welcome surface and the editor chrome are mutually exclusive: the
  // document toolbar group, pane heads, pager and legend only exist with a
  // document; before that the full-width welcome screen owns the space.
  $("ed-welcome").hidden = on;
  $("ed-main").hidden = !on;
  for (const n of document.querySelectorAll(".ed-tool-doc")) n.hidden = !on;
  if (!on) {
    app.sourceMode = false;
    $("btn-xml").classList.remove("active");
  }
  // M2.5 legend strip: visible while a document is loaded;
  // render() keeps the chips current after every mutation.
  const legend = $("ed-legend");
  if (legend) {
    if (on) buildLegend();
    legend.hidden = !on;
  }
  updateFolioButtons();
  updateFacsState();
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
  if (!app.state) return;

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

// ---- note index (for has-note markers) -------------------------------------

const RE_NOTE = /<note\b[^>]*\btarget="([^"]*)"[^>]*>([\s\S]*?)<\/note>/g;

function indexNotes(raw) {
  const map = new Map();
  let m;
  RE_NOTE.lastIndex = 0;
  while ((m = RE_NOTE.exec(raw)) !== null) {
    const text = unescapeXmlText(m[2]).trim();
    for (const t of m[1].split(/\s+/)) {
      const id = t.replace(/^#/, "");
      if (id) map.set(id, text);
    }
  }
  return map;
}

// ---- loading ---------------------------------------------------------------

function load(raw, name, handle) {
  const t0 = performance.now();
  app.state = parseEdition(raw);
  app.folio = 0;
  app.fileHandle = handle || null;
  app.docName = name;
  app.noteByWord = indexNotes(raw);
  // Default: no known page images. loadZbz() sets the image base afterwards;
  // every other entry (open, demo, generate) stays null.
  app.imageBase = null;
  // Project profile (e.g. Wenzelsbibel): detected from the document's PID,
  // currently contributes the IIIF image resolver for the facsimile.
  app.project = detectProject(app.state.doc);
  // Track real @xml:id values (not synthetic positional cell ids, which churn on
  // a lossless line-emptying edit and would raise a false "id lost" alarm).
  app.baseline = { wordCount: app.state.words.length, xmlIds: xmlIdSet(app.state), counts: countTags(raw) };
  $("ed-doc-name").textContent = name;
  $("ed-doc-name").hidden = false;
  enableControls(true);
  if (handle) { recents.rememberRecent(handle, name).then(renderRecents); }
  setDirty(false);
  markGenerated(false); // opening a real file clears the AI-generated flag
  refreshAfterStandoffEdit();
  const unit = app.state.profile === "word" ? "word" : "line";
  const secs = ((performance.now() - t0) / 1000).toFixed(1);
  setStatus(`Loaded ${app.state.folios.length} folio(s), ${app.state.cells.length} ${unit}(s) [${app.state.profile}-level]`
    + (app.project ? `, project: ${app.project.name}` : "") + ` in ${secs}s`);
}

function markGenerated(on) {
  app.generated = on;
  const b = $("ed-genbanner");
  if (b) b.hidden = !on;
}

async function openLocal() {
  if (!confirmDiscard()) return;
  // Preferred: File System Access API (lets us save in place later).
  if (window.showOpenFilePicker) {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{ description: "TEI XML", accept: { "application/xml": [".xml"], "text/xml": [".xml"] } }],
        excludeAcceptAllOption: false,
        multiple: false,
      });
      const file = await handle.getFile();
      load(await file.text(), file.name, handle);
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
  _fileInput = el("input", { type: "file", accept: ".xml,application/xml,text/xml", style: "display:none" });
  _fileInput.addEventListener("change", async () => {
    const file = _fileInput.files && _fileInput.files[0];
    if (!file) return;
    load(await file.text(), file.name, null);
    _fileInput.value = "";
  });
  document.body.appendChild(_fileInput);
  return _fileInput;
}

async function loadDemo() {
  setStatus("Loading synthetic Wenzelsbibel...");
  try {
    const res = await fetch(DEMO_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    load(await res.text(), "wenzelsbibel-synthetic-codex.xml", null);
  } catch (err) {
    setStatus(`Could not load the demo: ${err.message}`);
  }
}

async function loadZbz() {
  setStatus("Loading ZBZ Jeanne Hersch example...");
  try {
    const res = await fetch(ZBZ_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    load(await res.text(), "zbz-hersch-100.xml", null);
    // The real example ships local page images p001.png..pNNN.png next to the XML.
    app.imageBase = ZBZ_IMAGE_BASE;
    render(); // re-render the facsimile now that the image base is known
    setStatus("Loaded the ZBZ Jeanne Hersch example with real page images.");
  } catch (err) {
    setStatus(`Could not load the ZBZ example: ${err.message}`);
  }
}

async function loadSzd() {
  setStatus("Loading Stefan Zweig Digital example...");
  try {
    const res = await fetch(SZD_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    load(await res.text(), "o_szd.1079.tei.xml", null);
    // Facsimile comes from the <graphic url> on each surface (GAMS), no image base.
    setStatus("Loaded the Stefan Zweig Digital example (facsimile via GAMS).");
  } catch (err) {
    setStatus(`Could not load the SZD example: ${err.message}`);
  }
}

// Example registry: the toolbar menu and the welcome cards load the same way.
const EXAMPLES = { wb: loadDemo, zbz: loadZbz, szd: loadSzd };

/** Guard before any in-app document replacement (open, example, drop, recent). */
function confirmDiscard() {
  return !app.dirty || window.confirm(`Discard unsaved changes in ${app.docName}?`);
}

function loadExample(key) {
  const loader = EXAMPLES[key];
  if (loader && confirmDiscard()) loader();
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
  if (!/\.xml$/i.test(file.name)) {
    setStatus(`Not opened: ${file.name} is not an .xml file.`);
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
    load(await file.text(), file.name, handle);
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

// ---- recent files (welcome screen) ------------------------------------------

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
    load(await file.text(), file.name, rec.handle);
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
  if (!facsimile) return;
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
  buildLegend();
  renderReading();
  renderFacsimile();
  renderValidation();
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

function renderReading() {
  const host = $("ed-reading");
  clear(host);
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
    row.appendChild(el("span", { class: "ed-line-n", text: line.n != null ? line.n : "" }));
    line.cells.forEach((cell, k) => {
      if (k > 0) row.appendChild(document.createTextNode(" "));
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
      const span = el("span", {
        class: "ed-w" + (note ? " has-note" : "") + critClass + mentionClass,
        dataset: { id: cell.id, line: String(lineIndex), start: String(cell.start) },
        text: cell.gap ? "[...]" : cell.text,
        title: critTitle(cell, note, meta),
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
        if (c) beginTextInput(span, c);
      });
      span.addEventListener("mouseenter", () => highlightLine(lineIndex));
      span.addEventListener("mouseleave", () => clearLinks());
      row.appendChild(span);
    });
    host.appendChild(row);
  });
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
    const b = $("btn-xml");
    if (b) b.classList.remove("active");
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
    wellFormed: isWellFormed,
    onApply: (text) => {
      try {
        const changed = text !== app.state.raw;
        app.state = parseEdition(text);
        app.noteByWord = indexNotes(text);
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

// ---- shared document-mutation helper (M2.6 refactor) ------------------------

/**
 * Apply a doc -> doc function to the current document, then refresh state, the
 * note index, the dirty flag, and the status line. A no-op (SAME doc) changes
 * nothing; when noopLabel is given, the status line says so instead of staying
 * silent. Shared by the critical chooser and both link entries, so every inline
 * mutation runs through one code path.
 */
function applyDocFn(fn, label, failPrefix = "Edit", noopLabel = null) {
  try {
    const next = fn(app.state.doc);
    if (next !== app.state.doc) {
      app.state = parseEdition(next.raw);
      app.noteByWord = indexNotes(app.state.raw);
      setDirty(true);
      setStatus(label);
    } else if (noopLabel) {
      setStatus(noopLabel);
    }
  } catch (err) {
    setStatus(`${failPrefix} failed: ${err.message}`);
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
    if (save && text) {
      try {
        const next = standoff.addNoteForNode(app.state.doc, cell.node, cell.facs, text);
        if (next !== app.state.doc) {
          app.state = parseEdition(next.raw);
          app.noteByWord = indexNotes(app.state.raw);
          setDirty(true);
          setStatus(`Note attached to "${cell.text.trim()}"`);
        }
      } catch (err) {
        setStatus(`Note failed: ${err.message}`);
      }
    }
    refreshAfterStandoffEdit();
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
    applyDocFn(fn, label, "Markup");
    document.removeEventListener("keydown", onKey);
    refreshAfterStandoffEdit();
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

/**
 * Facsimile pane visibility: hidden on the user's toggle, and auto-hidden when
 * the document carries no page images at all (a facsimile pane with a permanent
 * empty state is noise). The grid collapses to two panes so the reading text
 * gets the space.
 */
function updateFacsState() {
  const main = $("ed-main");
  const pane = $("ed-pane-facs");
  const btn = $("btn-facs");
  if (!main || !pane) return;
  const has = docHasImages();
  const hidden = !app.state || app.facsHidden || !has;
  pane.hidden = hidden;
  main.classList.toggle("no-facs", hidden);
  if (btn) {
    btn.disabled = !app.state || !has;
    btn.classList.toggle("active", !hidden);
    btn.title = !app.state ? "Show or hide the facsimile pane"
      : !has ? "This document carries no page images"
      : hidden ? "Show the facsimile pane" : "Hide the facsimile pane";
  }
}

function renderFacsimile() {
  updateFacsState();
  if ($("ed-pane-facs") && $("ed-pane-facs").hidden) return;
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

/** After any standOff edit: re-render the whole view and the index panel. */
function refreshAfterStandoffEdit() {
  render();
  overlay.renderIndex();
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

// ---- validation (browser-light half of the hybrid) -------------------------

function isWellFormed(raw) {
  const doc = new DOMParser().parseFromString(raw, "application/xml");
  const err = doc.querySelector("parsererror");
  return { ok: !err, message: err ? err.textContent.replace(/\s+/g, " ").trim().slice(0, 200) : "" };
}

/**
 * Live checks resolved into the footer: a status chip (ok / warning / error)
 * that updates on every render, with the detail rows in a click popover. The
 * checks themselves are unchanged (well-formedness, xml:id integrity vs the
 * loaded baseline, tag-count drift); only their surface moved out of the way.
 *
 * The expensive half (DOMParser well-formedness, two full tree walks) runs
 * only when the document actually changed: results are cached by doc identity,
 * so turning pages in a large edition (the 78 MB Wenzelsbibel codex) re-renders
 * the chip from the cache instead of re-validating per folio.
 */
let _valCache = null; // { doc, rows, summary }

function computeValidation() {
  if (_valCache && _valCache.doc === app.state.doc) return _valCache;

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

  _valCache = { doc: app.state.doc, rows, summary };
  return _valCache;
}

function renderValidation() {
  const chip = $("ed-val-chip");
  const pop = $("ed-val-pop");
  if (!chip || !pop) return;
  if (!app.state) { chip.hidden = true; pop.hidden = true; _valCache = null; return; }

  const { rows, summary } = computeValidation();

  // Chip: worst level wins; the label stays short and truthful.
  const errs = rows.filter((r) => r[0] === "err").length;
  const warns = rows.filter((r) => r[0] === "warn").length;
  const level = errs ? "err" : warns ? "warn" : "ok";
  chip.hidden = false;
  chip.className = "ed-val-chip " + level;
  chip.textContent = errs ? "checks failing" : warns ? `checks: ${warns} warning(s)` : "well-formed, lossless";

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

// ---- save / download -------------------------------------------------------

async function save() {
  if (!app.state) return;
  const raw = serialize(app.state);
  if (app.fileHandle && app.fileHandle.createWritable) {
    try {
      const writable = await app.fileHandle.createWritable();
      await writable.write(raw);
      await writable.close();
      setDirty(false);
      setStatus(`Saved in place: ${app.docName}`);
      return;
    } catch (err) {
      setStatus(`Save in place failed (${err.message}); downloading instead`);
    }
  }
  download();
  setDirty(false);
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

// ---- feature modules (M2.13 split) ------------------------------------------
// Instantiated once at startup; dependencies flow in via a ctx object, the
// surfaces (popovers, overlay, modal) flow back through the returned APIs.

const overlay = createIndexOverlay({
  app, setStatus, setDirty,
  refresh: refreshAfterStandoffEdit,
  gotoFolio, highlightMentions, entityUsage,
});
const annot = createAnnotationUi({
  app, setStatus, setDirty, applyDocFn,
  refresh: refreshAfterStandoffEdit,
  entityMetaMap, entityUsage, indexNotes,
  runLookup: overlay.runLookup,
  revealEntity: overlay.revealEntity,
  highlightMentions, beginTextInput, beginNote, beginCritic,
});
const genModal = setupGenModal({ load, markGenerated, setDirty, setStatus });

// ---- wire-up ---------------------------------------------------------------

$("btn-open").addEventListener("click", openLocal);
$("start-open").addEventListener("click", openLocal);

// Examples: the toolbar menu and the welcome cards share one registry.
// The menu is a real button menu (not a select-as-action): toggle on the
// button, close on item click, outside click, or Escape.
const examplesBtn = $("btn-examples");
const examplesMenu = $("ed-examples-menu");
function closeExamplesMenu() {
  examplesMenu.hidden = true;
  examplesBtn.setAttribute("aria-expanded", "false");
}
examplesBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  examplesMenu.hidden = !examplesMenu.hidden;
  examplesBtn.setAttribute("aria-expanded", String(!examplesMenu.hidden));
});
document.addEventListener("click", (e) => {
  if (!examplesMenu.hidden && !(e.target instanceof Element && e.target.closest(".ed-dd-wrap"))) {
    closeExamplesMenu();
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !examplesMenu.hidden) closeExamplesMenu();
});
for (const item of document.querySelectorAll("[data-example]")) {
  item.addEventListener("click", () => {
    closeExamplesMenu();
    loadExample(item.dataset.example);
  });
}
$("card-generate").addEventListener("click", () => genModal.open());

setupDragDrop();
renderRecents();
$("btn-facs").addEventListener("click", () => {
  app.facsHidden = !app.facsHidden;
  renderFacsimile(); // re-applies visibility and repopulates the viewer on show
});
$("btn-xml").addEventListener("click", () => {
  app.sourceMode = !app.sourceMode;
  $("btn-xml").classList.toggle("active", app.sourceMode);
  annot.removeSelPopover();
  annot.removeMenu();
  render();
});
$("btn-generate").addEventListener("click", genModal.open);
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
  if (!$("gen-modal").hidden || !$("ed-idx-overlay").hidden) return;
  gotoFolio(app.folio + (e.key === "ArrowRight" ? 1 : -1));
});
$("btn-save").addEventListener("click", save);
$("btn-download").addEventListener("click", download);

// Validation chip: the live checks run on every render; the chip opens the
// detail popover, a click elsewhere or Escape closes it.
$("ed-val-chip").addEventListener("click", (e) => {
  e.stopPropagation();
  $("ed-val-pop").hidden = !$("ed-val-pop").hidden;
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

setStatus("Ready. Open a TEI edition, pick an example, or generate from text.");
updateFacsState(); // start state: no document, facsimile pane collapsed

// Deep link from the landing page: editor.html#generate opens the LLM entry.
if (location.hash === "#generate") genModal.open();
