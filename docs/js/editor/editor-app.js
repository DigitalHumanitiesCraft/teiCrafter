/**
 * teiCrafter Editor (Editor path) -- UI controller.
 *
 * Wires the deterministic, DOM-free edition core (edition.js) to the three-pane
 * shell in editor.html. No LLM anywhere in this path: every change is a direct,
 * human-driven, lossless offset splice on the raw TEI string.
 *
 * Responsibilities:
 *   - Open a local TEI edition (File System Access API, with a file-input fallback),
 *     load the served synthetic Wenzelsbibel demo, or the real ZBZ Jeanne Hersch
 *     example (local XML plus page images).
 *   - Navigate folios (one <pb> to the next).
 *   - Render the diplomatic reading text word-by-word; click a word for the inline
 *     action chooser (edit / note / mark / link / entity). Corrections run through
 *     editCellCore (surgical, lossless, edge-whitespace preserving).
 *   - Show the folio's page image in an OpenSeadragon viewer (facsimile.js) with the
 *     <zone> rectangles overlaid and bidirectionally linked to the reading text
 *     (real @facs link when present, positional fallback otherwise).
 *   - Manage standOff entities (person/org/event) and in-text <name> mentions via the
 *     index panel (index-panel.js) and the lossless standoff.js splices.
 *   - Hybrid validation: browser-light here (well-formed + structural integrity vs
 *     the loaded baseline); the heavy RNG + Schematron pass is the offline harness.
 *   - Save in place (File System Access) when a handle exists, else download.
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
  rawRangeForDisplay,
} from "./edition.js";
import { createFacsimile, plainImageTileSource } from "./facsimile.js";
import * as standoff from "./standoff.js";
import { markCritical, unwrapCritical, removeGap, CRITICAL_KINDS } from "./criticism.js";
import { createIndexPanel } from "./index-panel.js";
import { buildAuthorityForm } from "./authority-form.js";
import { mountSourceView } from "./source-view.js";
import { lookup as authorityLookup } from "../services/authority-lookup.js";
import { complete, setProvider, setModel, setApiKey, getProviderConfigs } from "../services/llm.js";
import { SOURCE_LABELS, getDefaultMapping } from "../utils/constants.js";

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
};

// Persistent facsimile controller (one OSD instance reused across folios) and the
// entity index panel. Both created lazily once the DOM hosts exist.
let facsimile = null;
let indexPanel = null;

// ---- tiny DOM helpers ------------------------------------------------------

const $ = (id) => document.getElementById(id);

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (k === "dataset") for (const [dk, dv] of Object.entries(v)) node.dataset[dk] = dv;
    else if (v != null) node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
}

function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

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
  app.state = parseEdition(raw);
  app.folio = 0;
  app.fileHandle = handle || null;
  app.docName = name;
  app.noteByWord = indexNotes(raw);
  // Default: no known page images. loadZbz() sets the image base afterwards;
  // every other entry (open, demo, generate) stays null.
  app.imageBase = null;
  // Track real @xml:id values (not synthetic positional cell ids, which churn on
  // a lossless line-emptying edit and would raise a false "id lost" alarm).
  app.baseline = { wordCount: app.state.words.length, xmlIds: xmlIdSet(app.state), counts: countTags(raw) };
  $("ed-doc-name").textContent = name;
  enableControls(true);
  setDirty(false);
  markGenerated(false); // opening a real file clears the AI-generated flag
  refreshAfterStandoffEdit();
  const unit = app.state.profile === "word" ? "word" : "line";
  setStatus(`Loaded ${app.state.folios.length} folio(s), ${app.state.cells.length} ${unit}(s) [${app.state.profile}-level]`);
}

function markGenerated(on) {
  app.generated = on;
  const b = $("ed-genbanner");
  if (b) b.hidden = !on;
}

async function openLocal() {
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

// Example registry: the dropdown and the start-screen cards load the same way.
const EXAMPLES = { wb: loadDemo, zbz: loadZbz, szd: loadSzd };

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
        if (cell.mention) { openAnnotationEditor(span, cell); return; }
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
function renderSourceView(host) {
  const leave = () => {
    app.sourceMode = false;
    const b = $("btn-xml");
    if (b) b.classList.remove("active");
    refreshAfterStandoffEdit();
  };
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

// ---- context menu (editor paradigm, 2026-06-10) ------------------------------

function removeMenu() {
  const old = document.getElementById("ed-menu");
  if (old) old.remove();
}

/**
 * Oxygen-style right-click menu on the reading text. Contextual: a live
 * selection offers annotation; an annotated element offers its editor; every
 * cell offers edit / note / mark. Closes on click elsewhere or Escape.
 */
function openContextMenu(x, y, span, cell) {
  removeMenu();
  removeSelPopover();
  const menu = el("div", { class: "ed-menu", id: "ed-menu" });
  const item = (label, fn) => {
    const b = el("button", { class: "ed-menu-item", text: label });
    b.addEventListener("click", (e) => { e.stopPropagation(); removeMenu(); fn(); });
    menu.appendChild(b);
  };

  const target = selectionTarget();
  if (target) {
    const shortText = target.text.length > 28 ? target.text.slice(0, 28) + "..." : target.text;
    item(`Annotate "${shortText}"...`, () => openSelPopover());
  }
  if (cell) {
    const c = () => app.state.cellById.get(cell.id);
    if (cell.mention) item("Edit annotation...", () => { if (c()) openAnnotationEditor(span, c()); });
    if (!cell.gap) {
      item(app.state.profile === "word" ? "Edit word" : "Edit line", () => { if (c()) beginTextInput(span, c()); });
      item("Add note...", () => { if (c()) beginNote(span, c()); });
      item("Mark: unclear / deleted / added / gap...", () => { if (c()) beginCritic(span, c()); });
      if (app.state.profile === "word") {
        item("Link this word to an entity...", () => { if (c()) openEntityPickerFor(span, c()); });
      }
    } else {
      item("Remove gap...", () => { if (c()) beginCritic(span, c()); });
    }
  }
  if (!menu.childElementCount) return;

  document.body.appendChild(menu);
  menu.style.left = Math.min(x, window.innerWidth - menu.offsetWidth - 8) + "px";
  menu.style.top = Math.min(y, window.innerHeight - menu.offsetHeight - 8) + "px";
  const onAway = (e) => {
    if (!(e.target instanceof Element && e.target.closest("#ed-menu"))) {
      removeMenu();
      document.removeEventListener("mousedown", onAway, true);
    }
  };
  document.addEventListener("mousedown", onAway, true);
  const onKey = (e) => {
    if (e.key === "Escape") { removeMenu(); document.removeEventListener("keydown", onKey); }
    if (!document.getElementById("ed-menu")) document.removeEventListener("keydown", onKey);
  };
  document.addEventListener("keydown", onKey);
}

/** Word-profile whole-cell link via a small anchored entity picker. */
function openEntityPickerFor(span, cell) {
  const host = $("ed-reading");
  removeSelPopover();
  const pop = el("div", { class: "ed-sel-pop", id: "ed-sel-pop" });
  pop.appendChild(el("span", { class: "ed-sel-pop-title", text: `link "${cell.text.trim()}"` }));
  buildEntityChoiceRows(pop, cell.text.trim(), (entId) => {
    removeSelPopover();
    applyDocFn(
      (doc) => standoff.linkMention(doc, cell.node, entId),
      `Linked "${cell.text.trim()}" to ${entId}`,
      "Link",
      "Already linked to this entity",
    );
    refreshAfterStandoffEdit();
  }, null);
  const xBtn = el("button", { class: "ed-act-btn", text: "x", title: "cancel" });
  xBtn.addEventListener("click", (e) => { e.stopPropagation(); removeSelPopover(); });
  pop.appendChild(xBtn);
  anchorPopAt(pop, span.getBoundingClientRect(), host);
}

// ---- annotation editor (click an annotated element) --------------------------

/** The full entity record for an id, or null. */
function findEntity(id) {
  const all = standoff.readEntities(app.state.doc);
  return ["persons", "places", "orgs", "works", "events"]
    .flatMap((k) => all[k] || [])
    .find((e) => e.id === id) || null;
}

/**
 * Commit a standOff edit from inside the annotation editor, then reopen the
 * editor on the same cell (render() rebuilds the reading pane, which removes
 * the popover; the cell id is stable across standOff-region edits), so adding
 * several authority ids in a row stays one uninterrupted gesture.
 */
function commitAndReopen(fn, label, cellId) {
  applyDocFn(fn, label, "Edit");
  refreshAfterStandoffEdit();
  const c = app.state.cellById.get(cellId);
  const s = c && document.querySelector(`#ed-reading .ed-w[data-id="${CSS.escape(c.id)}"]`);
  if (c && s && c.mention) openAnnotationEditor(s, c);
}

/**
 * Clicking an annotated element edits the annotation in place: what it is
 * linked to, the entity's authority ids (add / remove / live lookup, moved
 * here from the index pane, operator decision 2026-06-10), its occurrences,
 * confirm for AI proposals, relink, or remove the link (lossless unwrap).
 */
function openAnnotationEditor(span, cell) {
  removeSelPopover();
  const host = $("ed-reading");
  const meta = entityMetaMap().get(cell.mention) || null;
  const entity = findEntity(cell.mention);
  const pop = el("div", { class: "ed-sel-pop", id: "ed-sel-pop" });
  pop.appendChild(el("span", {
    class: "ed-sel-pop-title",
    text: meta
      ? `linked to ${meta.name || "(unnamed)"} (${cell.mention})${meta.ai ? "; AI-proposed, unverified" : ""}`
      : `linked to a missing entity (${cell.mention})`,
  }));

  if (entity) pop.appendChild(buildAuthorityEditor(entity, cell));

  const row = el("div", { class: "ed-sel-pop-row" });
  const btn = (text, title, fn, cls) => {
    const b = el("button", { class: "ed-act-btn" + (cls ? " " + cls : ""), text, title });
    b.addEventListener("click", (e) => { e.stopPropagation(); fn(); });
    row.appendChild(b);
  };
  if (entity) {
    const u = entityUsage().get(entity.id);
    const n = u ? u.count : 0;
    btn(`occurrences (${n})`, "highlight every mention of this entity; the first one on another page is reachable via the Index", () => {
      removeSelPopover();
      highlightMentions(entity);
    });
    if (meta && meta.ai) {
      btn("confirm", "accept this AI proposal as verified (removes the violet marking)", () => {
        commitAndReopen(
          (doc) => standoff.confirmEntity(doc, entity.id),
          `Confirmed ${entity.name || entity.id}`,
          cell.id,
        );
      }, "ed-btn-ai");
    }
  }
  btn("open in index", "show this entity in the full index overlay", () => {
    removeSelPopover();
    revealEntity(cell.mention);
  });
  btn("relink...", "point this text at a different entity", () => {
    clear(row);
    buildEntityChoiceRows(row, cell.text.trim(), (entId) => {
      removeSelPopover();
      applyDocFn(
        (doc) => standoff.linkMention(doc, cell.node, entId),
        `Relinked "${cell.text.trim()}" to ${entId}`,
        "Relink",
        "Already linked to this entity",
      );
      refreshAfterStandoffEdit();
    }, cell.mention);
  });
  btn("remove link", "unwrap the <name> around this text (the text itself survives)", () => {
    removeSelPopover();
    applyDocFn(
      (doc) => standoff.unwrapMention(doc, cell.node),
      `Removed the link on "${cell.text.trim()}" (index entry kept)`,
      "Unlink",
    );
    refreshAfterStandoffEdit();
  });
  btn("x", "close", () => removeSelPopover());
  pop.appendChild(row);
  anchorPopAt(pop, span.getBoundingClientRect(), host);
}

/**
 * Authority ids (GND / GeoNames / Wikidata) of the linked entity, editable at
 * the mention: the shared form (authority-form.js, same UI as in the index
 * overlay), committing losslessly and reopening the editor on the same cell.
 */
function buildAuthorityEditor(entity, cell) {
  const form = buildAuthorityForm(entity, {
    onSet: (authority, value) => commitAndReopen(
      (doc) => standoff.setAuthority(doc, entity.id, authority, value),
      value
        ? `Set ${authority} id on ${entity.name || entity.id}`
        : `Removed ${authority} id from ${entity.name || entity.id}`,
      cell.id,
    ),
    onLookup: runLookup,
  });
  form.classList.add("ed-sel-auth");
  return form;
}

/** Open the index overlay scrolled to an entity's row and flash it. */
function revealEntity(id) {
  openIndexOverlay();
  if (indexPanel) indexPanel.setActive(id);
  const row = document.querySelector(`#ed-index-host .ed-idx-row[data-id="${CSS.escape(id)}"]`);
  if (!row) { setStatus(`No index entry for ${id}`); return; }
  row.scrollIntoView({ block: "center" });
  row.classList.add("ed-idx-row-flash");
  setTimeout(() => row.classList.remove("ed-idx-row-flash"), 1200);
}

// ---- selection annotation (M2.8) --------------------------------------------
// Select any words inside a line with the mouse and annotate exactly that text:
// a popover offers "new entity from selection" per type, or linking an existing
// entity. The wrap is a lossless sub-range splice (standoff.linkMentionRange);
// afterwards the index entry is revealed so authority ids (GND, Wikidata,
// GeoNames) are one click away via the existing live lookup.

const ENTITY_TYPE_LABELS = [
  ["person", "person"], ["place", "place"], ["org", "organisation"],
  ["work", "work"], ["event", "event"],
];

function removeSelPopover() {
  const old = document.getElementById("ed-sel-pop");
  if (old) old.remove();
}

/** Resolve the current selection to { cell, relFrom, relTo, text } or null. */
function selectionTarget() {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0 || !app.state) return null;
  const range = sel.getRangeAt(0);
  const spanOf = (node) => {
    const elNode = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    return elNode ? elNode.closest("#ed-reading .ed-w") : null;
  };
  const startSpan = spanOf(range.startContainer);
  const endSpan = spanOf(range.endContainer);
  if (!startSpan || startSpan !== endSpan) return null; // one segment at a time
  const cell = app.state.cellById.get(startSpan.dataset.id);
  if (!cell || cell.gap) return null;
  // Display offsets inside the span's single text node, trimmed to the words.
  let dFrom = Math.min(range.startOffset, range.endOffset);
  let dTo = Math.max(range.startOffset, range.endOffset);
  const shown = startSpan.textContent;
  while (dFrom < dTo && /\s/.test(shown[dFrom])) dFrom++;
  while (dTo > dFrom && /\s/.test(shown[dTo - 1])) dTo--;
  if (dFrom >= dTo) return null;
  const rel = rawRangeForDisplay(cell.rawText, dFrom, dTo);
  if (!rel) return null;
  const text = shown.slice(dFrom, dTo);
  // Safety: the mapped raw slice must decode to exactly the selected text,
  // otherwise refuse rather than wrap the wrong bytes.
  if (unescapeXmlText(cell.rawText.slice(rel[0], rel[1])) !== text) return null;
  return { cell, span: startSpan, relFrom: rel[0], relTo: rel[1], text };
}

/** Apply: optionally create the entity, then wrap the selected sub-range. */
function annotateSelection(target, entityId, createType) {
  try {
    let doc = app.state.doc;
    let id = entityId;
    if (createType) {
      const before = new Set(allEntityIds(doc));
      doc = standoff.addEntity(doc, createType, { name: target.text });
      id = allEntityIds(doc).find((x) => !before.has(x));
      if (!id) throw new Error("could not resolve the new entity's id");
    }
    // Re-locate the cell: addEntity shifted offsets, but the cell id is stable
    // and the relative offsets address the unchanged node content.
    const st = parseEdition(doc.raw);
    const c = st.cellById.get(target.cell.id);
    if (!c) throw new Error("the selected line is no longer addressable");
    const next = standoff.linkMentionRange(doc, c.node, target.relFrom, target.relTo, id);
    if (next === doc && !createType) {
      setStatus("Nothing annotated (the text may already sit inside a link)");
      return;
    }
    app.state = parseEdition(next.raw);
    app.noteByWord = indexNotes(app.state.raw);
    setDirty(true);
    setStatus(`Annotated "${target.text}" (${id})`);
    refreshAfterStandoffEdit();
    // Continue in place: open the annotation editor on the fresh mention so
    // authority ids (GND, Wikidata, GeoNames) are attachable without leaving
    // the text (the index logic lives where the annotating happens).
    openAnnotationEditorFor(id);
  } catch (err) {
    setStatus(`Annotate failed: ${err.message}`);
  }
}

/** Open the annotation editor on the current folio's first mention of an entity. */
function openAnnotationEditorFor(id) {
  const folio = app.state.folios[app.folio];
  if (!folio) return;
  for (const line of folio.lines) {
    for (const c of line.cells) {
      if (c.mention !== id) continue;
      const span = document.querySelector(`#ed-reading .ed-w[data-id="${CSS.escape(c.id)}"]`);
      if (span) openAnnotationEditor(span, c);
      return;
    }
  }
}

function allEntityIds(doc) {
  const all = standoff.readEntities(doc);
  return ["persons", "places", "orgs", "works", "events"]
    .flatMap((k) => (all[k] || []).map((e) => e.id));
}

/** Anchor a popover at a viewport rect, inside the scrolling reading pane. */
function anchorPopAt(pop, rect, host) {
  const hostRect = host.getBoundingClientRect();
  host.appendChild(pop);
  pop.style.left = Math.max(0, Math.min(rect.left - hostRect.left, host.clientWidth - pop.offsetWidth - 8)) + "px";
  pop.style.top = (rect.bottom - hostRect.top + host.scrollTop + 6) + "px";
}

/**
 * Where has each entity been used? id -> { count, onPage } over all mention
 * cells, so the popovers can say WHERE an entry comes from (this page / this
 * document / index only) instead of listing the raw standOff.
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

const TYPE_LABEL = { pers: "person", plc: "place", org: "organisation", wrk: "work", evt: "event" };

/**
 * Shared entity-choice list with provenance: suggestions first (same name as
 * the selection, or the same text already annotated), then groups "annotated
 * on this page" / "annotated in this document" / "in the index (not yet
 * linked)", with a filter once the list grows. onPick(entityId) applies;
 * excludeId hides the entity the text is currently linked to.
 */
function buildEntityChoiceRows(container, selText, onPick, excludeId) {
  const meta = entityMetaMap();
  const usage = entityUsage();
  const all = standoff.readEntities(app.state.doc);
  const entities = ["persons", "places", "orgs", "works", "events"]
    .flatMap((k) => all[k] || [])
    .filter((ent) => ent.id !== excludeId);
  if (!entities.length) {
    container.appendChild(el("span", { class: "ed-act-empty", text: "no entities yet" }));
    return;
  }
  const norm = (s) => (s || "").trim().toLowerCase();
  const want = norm(selText);

  const entBtn = (ent, why) => {
    const m = meta.get(ent.id);
    const u = usage.get(ent.id);
    const kindLabel = m ? TYPE_LABEL[m.kind] : "entity";
    const b = el("button", {
      class: "ed-act-btn" + (m && m.ai ? " ed-btn-ai" : ""),
      text: `${ent.name || "(unnamed)"} (${kindLabel})`,
      title: `${ent.id}${why ? "; " + why : ""}${u ? `; ${u.count} mention(s) in this document` : "; no mentions yet"}`,
    });
    b.addEventListener("click", (e) => { e.stopPropagation(); if (e.detail > 1) return; onPick(ent.id); });
    return b;
  };

  // Suggestions: hard evidence only (name equals the selection, or the exact
  // selected text is already annotated with this entity somewhere).
  const suggested = new Set();
  const sugRow = el("div", { class: "ed-sel-pop-row" });
  for (const ent of entities) {
    if (norm(ent.name) === want && want) { suggested.add(ent.id); sugRow.appendChild(entBtn(ent, "index entry with exactly this name")); }
  }
  for (const folio of app.state.folios) {
    for (const line of folio.lines) {
      for (const c of line.cells) {
        if (!c.mention || suggested.has(c.mention)) continue;
        if (norm(c.text) !== want || !want) continue;
        const ent = entities.find((x) => x.id === c.mention);
        if (ent) { suggested.add(ent.id); sugRow.appendChild(entBtn(ent, "this exact text is already annotated with it")); }
      }
    }
  }
  if (sugRow.childElementCount) {
    container.appendChild(el("span", { class: "ed-act-group", text: "suggested (matches this text)" }));
    container.appendChild(sugRow);
  }

  // Provenance groups for the rest, filterable when long.
  const rest = entities.filter((ent) => !suggested.has(ent.id));
  const groups = [
    ["annotated on this page", (ent) => { const u = usage.get(ent.id); return u && u.onPage; }],
    ["annotated in this document", (ent) => { const u = usage.get(ent.id); return u && !u.onPage; }],
    ["in the index, not yet linked", (ent) => !usage.get(ent.id)],
  ];
  const listHost = el("div", {});
  const renderGroups = (filter) => {
    clear(listHost);
    const f = norm(filter);
    for (const [label, match] of groups) {
      const items = rest.filter((ent) => match(ent) && (!f || norm(ent.name).includes(f) || ent.id.toLowerCase().includes(f)));
      if (!items.length) continue;
      listHost.appendChild(el("span", { class: "ed-act-group", text: label }));
      const row = el("div", { class: "ed-sel-pop-row" });
      for (const ent of items) row.appendChild(entBtn(ent, label));
      listHost.appendChild(row);
    }
    if (!listHost.childElementCount && f) {
      listHost.appendChild(el("span", { class: "ed-act-empty", text: "no entity matches the filter" }));
    }
  };
  if (rest.length > 8) {
    const filter = el("input", { class: "ed-sel-filter", type: "text", placeholder: `filter ${rest.length} entities...` });
    filter.addEventListener("input", () => renderGroups(filter.value));
    filter.addEventListener("mouseup", (e) => e.stopPropagation());
    container.appendChild(filter);
  }
  renderGroups("");
  container.appendChild(listHost);
}

// Full-TEI markup wraps (no standOff entity): the scholarly elements first,
// then any element by name. Each build keeps the reading text byte-identical
// (enforced by standoff.wrapRange).
const MARKUP_WRAPS = [
  ["persName", (inner) => `<persName>${inner}</persName>`],
  ["persName + forename/surname", (inner) => {
    const m = inner.match(/^(\s*)([\s\S]*\S)(\s+)(\S+)(\s*)$/);
    if (!m) return `<persName>${inner}</persName>`;
    return `${m[1]}<persName><forename>${m[2]}</forename>${m[3]}<surname>${m[4]}</surname></persName>${m[5]}`;
  }],
  ["placeName", (inner) => `<placeName>${inner}</placeName>`],
  ["orgName", (inner) => `<orgName>${inner}</orgName>`],
  ["date", (inner) => `<date>${inner}</date>`],
  ["term", (inner) => `<term>${inner}</term>`],
  ["foreign", (inner) => `<foreign>${inner}</foreign>`],
  ["hi", (inner) => `<hi>${inner}</hi>`],
  ["title", (inner) => `<title>${inner}</title>`],
];

function applyMarkupWrap(target, build, label) {
  applyDocFn(
    (doc) => standoff.wrapRange(doc, target.cell.node, target.relFrom, target.relTo, build),
    `Marked "${target.text}" as ${label}`,
    "Annotate",
    "Nothing changed (invalid range or text would be lost)",
  );
  refreshAfterStandoffEdit();
}

/**
 * The annotate popover on a finished selection. Evidence first (suggestions
 * with provenance), then collapsed sections: link an existing entity, create a
 * new index entity, or apply plain TEI markup (full flexibility, no entity).
 */
function openSelPopover() {
  removeSelPopover();
  removeMenu();
  const target = selectionTarget();
  if (!target) return;
  if (target.cell.mention) {
    setStatus("This text already sits inside a link; click it to edit the annotation.");
    return;
  }
  const host = $("ed-reading");
  const pop = el("div", { class: "ed-sel-pop", id: "ed-sel-pop" });
  pop.appendChild(el("span", { class: "ed-sel-pop-title", text: `annotate "${target.text.length > 40 ? target.text.slice(0, 40) + "..." : target.text}"` }));

  // Collapsible section helper: header toggles the body.
  const section = (label, open) => {
    const body = el("div", { class: "ed-sel-sec-body" });
    body.hidden = !open;
    const head = el("button", { class: "ed-sel-sec-head", text: label, type: "button" });
    head.addEventListener("click", (e) => { e.stopPropagation(); body.hidden = !body.hidden; });
    pop.appendChild(head);
    pop.appendChild(body);
    return body;
  };

  // 1. Entities: suggestions (always visible inside) + provenance groups.
  const all = standoff.readEntities(app.state.doc);
  const haveEntities = ["persons", "places", "orgs", "works", "events"].some((k) => (all[k] || []).length);
  if (haveEntities) {
    const entBody = section("link to an index entity", true);
    buildEntityChoiceRows(entBody, target.text, (entId) => {
      removeSelPopover();
      annotateSelection(target, entId, null);
    }, null);
  }

  // 2. New index entity from the selection (collapsed when entities exist:
  //    not every selection is an entity, so this must not be the loudest offer).
  const newBody = section("new index entity from this text", !haveEntities);
  const newRow = el("div", { class: "ed-sel-pop-row" });
  for (const [type, label] of ENTITY_TYPE_LABELS) {
    const b = el("button", { class: "ed-act-btn", text: label, title: `create a ${label} named "${target.text}", link this text, then add authority ids right here` });
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      removeSelPopover();
      annotateSelection(target, null, type);
    });
    newRow.appendChild(b);
  }
  newBody.appendChild(newRow);

  // 3. Plain TEI markup (full flexibility, no index entry).
  const muBody = section("TEI markup (no index entry)", false);
  const muRow = el("div", { class: "ed-sel-pop-row" });
  for (const [label, build] of MARKUP_WRAPS) {
    const b = el("button", { class: "ed-act-btn", text: label, title: `wrap the selection in <${label.split(" ")[0]}>` });
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      removeSelPopover();
      applyMarkupWrap(target, build, label);
    });
    muRow.appendChild(b);
  }
  // Any element by name (the full-TEI escape hatch).
  const freeWrap = el("div", { class: "ed-sel-pop-row" });
  const freeInput = el("input", { class: "ed-sel-filter", type: "text", placeholder: "any element name..." });
  freeInput.addEventListener("mouseup", (e) => e.stopPropagation());
  const freeBtn = el("button", { class: "ed-act-btn", text: "wrap", title: "wrap the selection in the named element" });
  freeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const tag = freeInput.value.trim();
    if (!/^[A-Za-z_][\w.-]*$/.test(tag)) { setStatus("Not a valid element name"); return; }
    removeSelPopover();
    applyMarkupWrap(target, (inner) => `<${tag}>${inner}</${tag}>`, `<${tag}>`);
  });
  freeWrap.appendChild(freeInput);
  freeWrap.appendChild(freeBtn);
  muBody.appendChild(muRow);
  muBody.appendChild(freeWrap);

  const xBtn = el("button", { class: "ed-act-btn", text: "x", title: "cancel" });
  xBtn.addEventListener("click", (e) => { e.stopPropagation(); removeSelPopover(); });
  pop.appendChild(xBtn);

  anchorPopAt(pop, window.getSelection().getRangeAt(0).getBoundingClientRect(), host);
}

// Selection handling: a finished mouse DRAG selection inside the reading pane
// opens the annotate popover; Escape or a click elsewhere closes it. A
// double-click (e.detail > 1) belongs to direct text editing, not annotation.
document.addEventListener("mouseup", (e) => {
  if (!app.state || app.sourceMode) return;
  if (e.detail > 1) return;
  const inReading = e.target instanceof Element && e.target.closest("#ed-reading");
  const inPop = e.target instanceof Element && (e.target.closest("#ed-sel-pop") || e.target.closest("#ed-menu"));
  if (inPop) return;
  setTimeout(() => {
    if (!inReading) { removeSelPopover(); return; }
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) { removeSelPopover(); return; }
    openSelPopover();
  }, 0);
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && document.getElementById("ed-sel-pop")) removeSelPopover();
});
// Right-click: the Oxygen-style context menu, on words and on selections.
$("ed-reading").addEventListener("contextmenu", (e) => {
  if (!app.state || app.sourceMode) return;
  e.preventDefault();
  const span = e.target instanceof Element ? e.target.closest(".ed-w") : null;
  const cell = span ? app.state.cellById.get(span.dataset.id) : null;
  openContextMenu(e.clientX, e.clientY, span, cell || null);
});

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
  facsimile = createFacsimile(host, { tileSourceFor: plainImageTileSource });
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

// ---- entity index / standOff ----------------------------------------------
// The on-demand Index overlay (toolbar button) manages standOff entities
// (person/place/org/work/event); day-to-day authority work happens in the
// annotation popover on the text itself (operator decision 2026-06-10).
// Every mutation goes through standoff.js (lossless offset splice) and re-parses
// the edition so all offsets stay correct.

/** Lazily create the single index panel bound to the overlay host, with its hooks. */
function ensureIndexPanel() {
  if (indexPanel) return indexPanel;
  const host = $("ed-index-host");
  if (!host) return null;
  indexPanel = createIndexPanel(host, {
    onAdd: (type, { name }) => {
      try {
        app.state = parseEdition(standoff.addEntity(app.state.doc, type, { name }).raw);
        setDirty(true);
        refreshAfterStandoffEdit();
      } catch (err) {
        setStatus(`Could not add entity: ${err.message}`);
      }
    },
    onUpdate: (id, { name }) => {
      try {
        app.state = parseEdition(standoff.updateEntity(app.state.doc, id, { name }).raw);
        setDirty(true);
        refreshAfterStandoffEdit();
      } catch (err) {
        setStatus(`Could not rename entity: ${err.message}`);
      }
    },
    onDelete: (id) => {
      try {
        app.state = parseEdition(standoff.deleteEntity(app.state.doc, id).raw);
        setDirty(true);
        refreshAfterStandoffEdit();
      } catch (err) {
        setStatus(`Could not delete entity: ${err.message}`);
      }
    },
    onSelect: (entity) => jumpToEntity(entity),
    onSetAuthority: (id, { authority, value }) => {
      try {
        app.state = parseEdition(standoff.setAuthority(app.state.doc, id, authority, value).raw);
        setDirty(true);
        refreshAfterStandoffEdit();
      } catch (err) {
        setStatus(`Could not set authority id: ${err.message}`);
      }
    },
    onConfirm: (id) => {
      try {
        app.state = parseEdition(standoff.confirmEntity(app.state.doc, id).raw);
        setDirty(true);
        refreshAfterStandoffEdit();
        setStatus("AI suggestion confirmed");
      } catch (err) {
        setStatus(`Could not confirm entity: ${err.message}`);
      }
    },
    onLookup: (id, { authority, query, anchor, onPick }) => runLookup(authority, query, anchor, onPick),
  });
  return indexPanel;
}

/**
 * M3.3 live lookup: query an authority register and show the hits in a small
 * popover anchored to the entity's id form. Picking one fills the id field via
 * onPick (which commits through onSetAuthority). The human chooses the match.
 */
async function runLookup(authority, query, anchor, onPick) {
  if (!anchor) return;
  let pop = anchor.querySelector(".ed-idx-lookupresults");
  if (pop) pop.remove();
  if (!query) { setStatus("Type a name (or name the entity) before looking up"); return; }
  pop = el("div", { class: "ed-idx-lookupresults" });
  pop.appendChild(el("div", { class: "ed-idx-lookupmsg", text: `Searching ${authority}...` }));
  anchor.appendChild(pop);
  try {
    const hits = await authorityLookup(authority, query, { limit: 7 });
    // If a newer lookup replaced this popover, or the index re-rendered while we
    // awaited, this node is detached: drop the stale result instead of writing to
    // an orphaned element. isConnected (not parentElement) is required, since a
    // re-render detaches the whole subtree while the local parent link survives.
    if (!pop.isConnected) return;
    clear(pop);
    if (!hits.length) {
      pop.appendChild(el("div", { class: "ed-idx-lookupmsg", text: `No ${authority} match for "${query}"` }));
      return;
    }
    for (const h of hits) {
      pop.appendChild(el("button", {
        class: "ed-idx-lookuphit", type: "button",
        title: h.description || h.id,
        onclick: () => { pop.remove(); onPick(h.id); },
      }, [
        el("span", { class: "ed-idx-lookuplabel", text: h.label || h.id }),
        el("span", { class: "ed-idx-lookupid", text: h.id }),
        h.description ? el("span", { class: "ed-idx-lookupdesc", text: h.description }) : null,
      ]));
    }
  } catch (err) {
    if (!pop.isConnected) return;
    clear(pop);
    pop.appendChild(el("div", { class: "ed-idx-lookupmsg", text: err.message }));
  }
}

/** Render the entity index from the current document, with mention counts. */
function renderIndex() {
  const panel = ensureIndexPanel();
  if (!panel || !app.state) return;
  const all = standoff.readEntities(app.state.doc);
  const usage = entityUsage();
  for (const k of ["persons", "places", "orgs", "works", "events"]) {
    for (const e of all[k] || []) e.count = (usage.get(e.id) || {}).count || 0;
  }
  panel.render(all);
}

// ---- index overlay (M2.11) --------------------------------------------------

function openIndexOverlay() {
  if (!app.state) return;
  renderIndex();
  $("ed-idx-overlay").hidden = false;
  $("btn-index").classList.add("active");
  const f = $("idx-filter");
  f.value = "";
  applyIndexFilter("");
  f.focus();
}

function closeIndexOverlay() {
  $("ed-idx-overlay").hidden = true;
  $("btn-index").classList.remove("active");
}

/** DOM-level filter over the rendered panel: rows by name/id, empty sections fold. */
function applyIndexFilter(q) {
  const f = q.trim().toLowerCase();
  for (const row of document.querySelectorAll("#ed-index-host .ed-idx-row")) {
    row.hidden = !!f && !row.textContent.toLowerCase().includes(f);
  }
  for (const sec of document.querySelectorAll("#ed-index-host .ed-idx-section")) {
    sec.hidden = !!f && !sec.querySelector(".ed-idx-row:not([hidden])");
  }
}

/**
 * Index row clicked: close the overlay and jump to the entity's first in-text
 * mention (switching the page when needed), then highlight all its mentions.
 */
function jumpToEntity(entity) {
  closeIndexOverlay();
  let targetFolio = -1;
  let targetCellId = null;
  outer: for (let fi = 0; fi < app.state.folios.length; fi++) {
    for (const line of app.state.folios[fi].lines) {
      for (const c of line.cells) {
        if (c.mention === entity.id) { targetFolio = fi; targetCellId = c.id; break outer; }
      }
    }
  }
  if (targetFolio < 0) {
    setStatus(`${entity.name}: no in-text mentions on any folio`);
    return;
  }
  if (targetFolio !== app.folio) gotoFolio(targetFolio);
  highlightMentions(entity);
  const span = document.querySelector(`#ed-reading .ed-w[data-id="${CSS.escape(targetCellId)}"]`);
  if (span) span.scrollIntoView({ block: "center" });
}

/** After any standOff edit: re-render the whole view and the index panel. */
function refreshAfterStandoffEdit() {
  render();
  renderIndex();
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
 */
function renderValidation() {
  const chip = $("ed-val-chip");
  const pop = $("ed-val-pop");
  if (!chip || !pop) return;
  if (!app.state) { chip.hidden = true; pop.hidden = true; return; }

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

// ---- LLM entry: generate an initial TEI, then edit it here -----------------
// One workbench, two entries. The model produces the first draft; the human
// verifies and corrects it deterministically in the same editor. The API key is
// held in memory only (llm.js keeps it in a module-scoped map), never persisted.

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

function openGenModal() {
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

function closeGenModal() {
  $("gen-modal").hidden = true;
}

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
    load(xml, `generated-${type}.xml`, null);
    markGenerated(true);
    setDirty(true);
    closeGenModal();
    setStatus("Generated an initial TEI. Review and correct it; nothing is saved until you save or download.");
  } catch (err) {
    status.className = "ed-modal-status err";
    status.textContent = `Generation failed: ${err.message}`;
  } finally {
    $("gen-run").disabled = false;
  }
}

// ---- wire-up ---------------------------------------------------------------

$("btn-open").addEventListener("click", openLocal);
// Examples: the toolbar dropdown and the start-screen cards share one registry.
$("ed-examples").addEventListener("change", (e) => {
  const loader = EXAMPLES[e.target.value];
  e.target.value = ""; // reset to the placeholder so the same example can reload
  if (loader) loader();
});
for (const [id, key] of [["start-wb", "wb"], ["start-zbz", "zbz"], ["start-szd", "szd"]]) {
  const b = $(id);
  if (b) b.addEventListener("click", () => EXAMPLES[key]());
}
if ($("start-open")) $("start-open").addEventListener("click", openLocal);
$("btn-facs").addEventListener("click", () => {
  app.facsHidden = !app.facsHidden;
  renderFacsimile(); // re-applies visibility and repopulates the viewer on show
});
$("btn-xml").addEventListener("click", () => {
  app.sourceMode = !app.sourceMode;
  $("btn-xml").classList.toggle("active", app.sourceMode);
  removeSelPopover();
  removeMenu();
  render();
});
$("btn-generate").addEventListener("click", openGenModal);
$("gen-close").addEventListener("click", closeGenModal);
$("gen-cancel").addEventListener("click", closeGenModal);
$("gen-provider").addEventListener("change", refreshModels);
$("gen-run").addEventListener("click", runGenerate);
$("gen-modal").addEventListener("click", (e) => { if (e.target.id === "gen-modal") closeGenModal(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("gen-modal").hidden) closeGenModal(); });
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
// Index overlay: toolbar toggle, close button, backdrop click, Escape, filter.
$("btn-index").addEventListener("click", () => {
  if ($("ed-idx-overlay").hidden) openIndexOverlay();
  else closeIndexOverlay();
});
$("idx-close").addEventListener("click", closeIndexOverlay);
$("ed-idx-overlay").addEventListener("click", (e) => { if (e.target.id === "ed-idx-overlay") closeIndexOverlay(); });
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !$("ed-idx-overlay").hidden) closeIndexOverlay();
});
$("idx-filter").addEventListener("input", (e) => applyIndexFilter(e.target.value));
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
if (location.hash === "#generate") openGenModal();
