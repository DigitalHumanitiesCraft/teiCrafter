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
} from "./edition.js";
import { createFacsimile, plainImageTileSource } from "./facsimile.js";
import * as standoff from "./standoff.js";
import { markCritical, unwrapCritical, removeGap, CRITICAL_KINDS } from "./criticism.js";
import { createIndexPanel } from "./index-panel.js";
import { buildSuggestPrompt, parseSuggestions } from "./ai-suggest.js";
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
  linkTarget: null,   // entity selected for the next "link a mention" click, or null
  noteMode: false,    // true while waiting for a cell click to attach an editorial note
  critMode: false,    // true while waiting for a cell click to apply textual-critical markup
  facsHidden: false,  // user choice: hide the facsimile pane (auto-hidden when no images)
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
  for (const id of ["btn-validate", "btn-download", "btn-suggest"]) $(id).disabled = !on;
  $("btn-save").disabled = !on;
  if (!on) { setNoteMode(false); setCritMode(false); }
  // M2.5 legend strip (hint + chips): visible while a document is loaded;
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
 * The strip itself also hosts the mode hint (#ed-edit-hint), which stays put.
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
  // Default: no known page images and no pending link target. loadZbz() sets the
  // image base afterwards; every other entry (open, demo, generate) stays null.
  app.imageBase = null;
  app.linkTarget = null;
  // Reset the click-capture modes so a mode left on in the previous document does
  // not silently apply to the freshly opened one (button/hint would disagree).
  setNoteMode(false);
  setCritMode(false);
  // Track real @xml:id values (not synthetic positional cell ids, which churn on
  // a lossless line-emptying edit and would raise a false "id lost" alarm).
  app.baseline = { wordCount: app.state.words.length, xmlIds: xmlIdSet(app.state), counts: countTags(raw) };
  $("ed-doc-name").textContent = name;
  enableControls(true);
  setDirty(false);
  markGenerated(false); // opening a real file clears the AI-generated flag
  render();
  renderIndex();
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
  const folio = app.state.folios[app.folio];
  app.currentLines = folio ? folio.lines : [];
  // hint reflects the active click-capture mode, else the detected granularity, so
  // the hint and the toolbar mode buttons never disagree after a re-render.
  const hint = $("ed-edit-hint");
  if (hint) hint.textContent = critHint();
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
      const linking = app.linkTarget != null;
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
        title: critTitle(cell, note, linking, meta),
      });
      span.addEventListener("click", (e) => {
        // A span can never legitimately receive the second click of a
        // double-click (click 1 replaces it with a box or input), so e.detail > 1
        // here means the first click's UI vanished and the words reflowed under
        // the cursor: ignore it instead of opening something unintended.
        if (e.detail > 1) return;
        if (app.critMode || cell.gap) beginCritic(span, cell);
        else if (app.noteMode) beginNote(span, cell);
        else beginEdit(span, cell, lineIndex);
      });
      span.addEventListener("mouseenter", () => highlightLine(lineIndex));
      span.addEventListener("mouseleave", () => clearLinks());
      row.appendChild(span);
    });
    host.appendChild(row);
  });
}

function beginEdit(span, cell, lineIndex) {
  // A gap is a marker, not editable text: route any stray edit to the critical
  // chooser (which offers removal) instead of splicing its empty content.
  if (cell.gap) { beginCritic(span, cell); return; }

  // Link mode: a "link" was started from the index panel, so the next click on a
  // word/line wraps that mention in <name ref="#id"> instead of editing it. This
  // precedence is kept OUTSIDE the action chooser, so an index-initiated link
  // still completes on the next text click without an extra step (M2.6 contract).
  if (app.linkTarget) {
    const target = app.linkTarget;
    // Same shared mutation path as the picker, so both link entries honour the
    // engine's SAME-doc no-op contract (no false dirty flag, truthful status).
    applyDocFn(
      (doc) => standoff.linkMention(doc, cell.node, target.id),
      `Linked "${cell.text.trim()}" to ${target.name}`,
      "Link",
      `Already linked to ${target.name}`,
    );
    app.linkTarget = null;
    render();
    renderIndex();
    return;
  }

  // M2.6: the default click opens the inline action chooser; nothing hides
  // behind a pre-toggled mode anymore.
  beginActions(span, cell, lineIndex);
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

// ---- inline action chooser (M2.6) -------------------------------------------

/**
 * M2.6: clicking a cell offers every operation at the text itself: Edit / note /
 * mark / link (with an in-place entity picker) / entity (jump to the linked index
 * entry) / cancel. Follows the proven beginCritic pattern (box replaces the span,
 * Escape closes, orphan guard). The toolbar toggles stay as shortcuts; the second
 * click of a double-click triggers "edit" (quick edit), because non-edit buttons
 * ignore the second click (e.detail > 1) and the box handles dblclick.
 */
function beginActions(span, cell) {
  const host = $("ed-reading");
  // Only one inline chooser at a time: rebuild the view first so we never leave
  // an orphaned one behind, then re-acquire this cell's freshly rendered span.
  if (host.querySelector(".ed-crit-pick, .ed-act-pick")) {
    render();
    span = host.querySelector(`.ed-w[data-id="${CSS.escape(cell.id)}"]`);
    if (!span) return;
  }
  const box = el("span", { class: "ed-act-pick" });
  let acted = false; // every action runs at most once per chooser instance

  // Pure close: put the original span back without re-rendering, so a
  // look-and-cancel never resets the reading-pane scroll or the facsimile zoom.
  // Returns false when the box was already destroyed by an external render.
  const restore = () => {
    document.removeEventListener("keydown", onKey);
    if (!box.isConnected) return false;
    box.replaceWith(span);
    return true;
  };
  // Mutating close: the document changed, so rebuild the view.
  const closeRender = () => {
    document.removeEventListener("keydown", onKey);
    render();
    renderIndex();
  };
  // Self-healing: if an external render destroyed the box, the next keydown
  // removes this stale listener instead of acting on a dead chooser.
  const onKey = (e) => {
    if (!box.isConnected) { document.removeEventListener("keydown", onKey); return; }
    if (e.key === "Escape") { e.preventDefault(); acted = true; restore(); }
  };
  const once = (handler) => () => {
    if (acted) return;
    acted = true;
    handler();
  };
  const addBtn = (text, title, handler, opts = {}) => {
    const b = el("button", { class: "ed-act-btn" + (opts.class ? " " + opts.class : ""), text, title });
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      // The second click of a double-click (e.detail > 1) belongs to quick edit
      // (the box's dblclick handler), not to whichever button it happens to hit.
      if (e.detail > 1 && !opts.acceptDouble) return;
      handler();
    });
    box.appendChild(b);
    return b;
  };

  // Handoffs restore the original span in place (state cannot have changed while
  // the chooser was open: every external mutation destroys it), then continue on
  // the freshly resolved cell. No render in between, so the handed-off UI opens
  // exactly where the user clicked, never off-screen.
  const doEdit = once(() => {
    if (!restore()) return;
    const c = app.state.cellById.get(cell.id);
    if (c) beginTextInput(span, c);
  });
  const handOff = (fn) => once(() => {
    if (!restore()) return;
    const c = app.state.cellById.get(cell.id);
    if (c) fn(span, c);
  });

  const editBtn = addBtn("edit",
    app.state.profile === "word" ? "correct this word" : "correct this line",
    doEdit, { acceptDouble: true });
  addBtn("note", "attach an editorial note", handOff(beginNote));
  addBtn("mark", "mark as unclear / deleted / added / gap", handOff(beginCritic));
  addBtn("link", "link this text to an index entity", () => openLinkPicker());
  if (cell.mention) {
    addBtn("entity", "show the linked entity in the index", once(() => {
      const id = cell.mention;
      restore();
      revealEntity(id);
    }));
  }
  addBtn("x", "cancel", once(() => restore()));

  // The in-place entity picker (second box state): groups and labels identical
  // with the index panel, so the same entity reads the same everywhere.
  const openLinkPicker = () => {
    if (acted) return;
    clear(box);
    box.classList.add("ed-act-pick-entities");
    const all = standoff.readEntities(app.state.doc);
    const groups = [
      ["Persons", all.persons], ["Places", all.places], ["Organisations", all.orgs],
      ["Works", all.works], ["Events", all.events],
    ];
    let any = false;
    for (const [label, items] of groups) {
      if (!items || !items.length) continue;
      any = true;
      box.appendChild(el("span", { class: "ed-act-group", text: label }));
      for (const ent of items) {
        const b = el("button", {
          class: "ed-act-btn",
          text: `${ent.name || "(unnamed)"} (${ent.id})`,
          title: `link this text to ${ent.name || ent.id}`,
        });
        b.addEventListener("click", (e) => {
          e.stopPropagation();
          // Same double-click discipline as the first box state: the stray
          // second click of a double-click must never link to an arbitrary
          // entity that happened to reflow under the cursor.
          if (e.detail > 1) return;
          once(() => {
            applyDocFn(
              (doc) => standoff.linkMention(doc, cell.node, ent.id),
              `Linked "${cell.text.trim()}" to ${ent.name}`,
              "Link",
              `Already linked to ${ent.name}`,
            );
            closeRender();
          })();
        });
        box.appendChild(b);
      }
    }
    if (!any) {
      box.appendChild(el("span", { class: "ed-act-empty", text: "no entities yet; add one in the Index first" }));
    }
    const cancelBtn = el("button", { class: "ed-act-btn", text: "x", title: "cancel" });
    cancelBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (e.detail > 1) return;
      if (!acted) { acted = true; restore(); }
    });
    box.appendChild(cancelBtn);
  };

  span.replaceWith(box);
  box.addEventListener("dblclick", (e) => {
    e.stopPropagation();
    // Quick edit belongs to the first box state only: in the entity picker a
    // double-click on a group label must not abandon the pick into a text edit.
    if (box.classList.contains("ed-act-pick-entities")) return;
    doEdit();
  });
  // Focus "edit" so plain Enter triggers quick edit (and the focus ring shows
  // where the chooser sits in the text).
  editBtn.focus();
  document.addEventListener("keydown", onKey);
}

/** Jump to an entity's row in the index panel and flash it (M2.6 "entity"). */
function revealEntity(id) {
  selectTab("index");
  if (indexPanel) indexPanel.setActive(id);
  const row = document.querySelector(`#ed-index .ed-idx-row[data-id="${CSS.escape(id)}"]`);
  if (!row) { setStatus(`No index entry for ${id}`); return; }
  row.scrollIntoView({ block: "center" });
  row.classList.add("ed-idx-row-flash");
  setTimeout(() => row.classList.remove("ed-idx-row-flash"), 1200);
}

// ---- editorial notes (M3.5) ------------------------------------------------

/** Toggle "add note" mode: the next cell click attaches a note instead of editing. */
function setNoteMode(on) {
  app.noteMode = on;
  // The three click-capture modes (note, mark, link) are mutually exclusive.
  if (on) { if (app.critMode) setCritMode(false); app.linkTarget = null; }
  const btn = $("btn-note");
  if (btn) btn.classList.toggle("active", on);
  const hint = $("ed-edit-hint");
  if (hint && app.state) hint.textContent = critHint();
}

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
    setNoteMode(false);
    render();
    renderIndex();
  };
  inp.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); finish(true); }
    else if (e.key === "Escape") { e.preventDefault(); finish(false); }
  });
  inp.addEventListener("blur", () => finish(true));
}

// ---- textual-critical markup (M3.6) ----------------------------------------

/** The reading-pane hint, reflecting the active click-capture mode. */
function critHint() {
  if (app.critMode) return "click a line to mark it (unclear / deleted / added / gap)";
  if (app.noteMode) return "click a line to attach a note";
  if (app.linkTarget) return `click a line to link it to ${app.linkTarget.name}`;
  return app.state && app.state.profile === "word" ? "click a word for actions" : "click a line for actions";
}

/** Tooltip for a reading cell, composed from its link / note / critical state. */
function critTitle(cell, note, linking, meta) {
  // A gap always routes to its remove chooser, even while a link is pending, so
  // its tooltip must say so first (tooltip and click action never disagree).
  if (cell.gap) return "gap: omitted or illegible text; click to remove";
  if (linking) return `click to link to ${app.linkTarget.name}`;
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
  parts.push(app.critMode ? "click to mark this text"
    : app.noteMode ? "click to attach a note"
    : "click for actions");
  return parts.join("; ");
}

/** Toggle "mark text" mode: the next cell click applies textual-critical markup. */
function setCritMode(on) {
  app.critMode = on;
  // The three click-capture modes (mark, note, link) are mutually exclusive.
  if (on) { if (app.noteMode) setNoteMode(false); app.linkTarget = null; }
  const btn = $("btn-critic");
  if (btn) btn.classList.toggle("active", on);
  const hint = $("ed-edit-hint");
  if (hint && app.state) hint.textContent = critHint();
}

/**
 * Replace a cell with a small chooser of textual-critical actions, then apply the
 * chosen one losslessly. A gap cell offers only removal; any other cell offers the
 * four markers, plus "clear" when it already carries a wrapper.
 */
function beginCritic(span, cell) {
  const host = $("ed-reading");
  // If an inline chooser (critical or action) is already open, rebuild the reading
  // view first so we never leave an orphaned one behind, then re-acquire this
  // cell's freshly rendered span.
  if (host.querySelector(".ed-crit-pick, .ed-act-pick")) {
    render();
    span = host.querySelector(`.ed-w[data-id="${CSS.escape(cell.id)}"]`);
    if (!span) return;
  }
  const box = el("span", { class: "ed-crit-pick" });

  // Pure cancel: put the original span back without re-rendering (scroll and
  // facsimile zoom survive a look-and-cancel). Mutations go through apply(),
  // which re-renders. When the chooser was entered via the toolbar mark mode,
  // cancelling ends that mode, which changes every cell's tooltip, so only then
  // a re-render is needed. The keydown listener self-heals when an external
  // render destroyed the box.
  const wasCritMode = app.critMode;
  const cancel = () => {
    document.removeEventListener("keydown", onKey);
    setCritMode(false);
    if (wasCritMode) { render(); renderIndex(); return; }
    if (box.isConnected) box.replaceWith(span);
  };
  const onKey = (e) => {
    if (!box.isConnected) { document.removeEventListener("keydown", onKey); return; }
    if (e.key === "Escape") { e.preventDefault(); cancel(); }
  };
  const apply = (fn, label) => {
    applyDocFn(fn, label, "Markup");
    document.removeEventListener("keydown", onKey);
    setCritMode(false);
    render();
    renderIndex();
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
// The right pane's "Index" tab manages standOff entities (person/place/org/work/
// event), their authority ids (<idno>), and the in-text mentions that link to them.
// Every mutation goes through standoff.js (lossless offset splice) and re-parses the
// edition so all offsets stay correct.

/** Lazily create the single index panel bound to #ed-index, with its hooks. */
function ensureIndexPanel() {
  if (indexPanel) return indexPanel;
  // The panel renders into its own host inside the Index tab, so the tab's
  // AI-suggest block above it survives every panel re-render.
  const host = $("ed-index-host") || $("ed-index");
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
    onSelect: (entity) => highlightMentions(entity),
    onStartLink: (entity) => {
      // Link is the third click-capture mode; clear the other two so a click is
      // never claimed by mark/note mode while a link is pending.
      setNoteMode(false);
      setCritMode(false);
      app.linkTarget = entity;
      setStatus(`Click a line or word to link it to <name> -> ${entity.name}`);
      render(); // refresh titles/affordances for link mode
    },
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

/** Render the entity index from the current document. */
function renderIndex() {
  const panel = ensureIndexPanel();
  if (panel) panel.render(standoff.readEntities(app.state.doc));
}

/** After any standOff edit: re-render the whole view and the index panel. */
function refreshAfterStandoffEdit() {
  render();
  renderIndex();
}

/**
 * M3.7: ask the configured LLM to propose entities for the current folio. Each is
 * inserted as an unverified resp="#ai" entity (rendered violet) for the human to
 * confirm or delete. The model assists; the human decides. Requires a provider key
 * configured via the "New from text (LLM)" dialog.
 */
async function suggestEntities() {
  if (!app.state) return;
  const folio = app.state.folios[app.folio];
  const lines = folio ? folio.lines : [];
  const text = lines.map((l) => l.cells.map((c) => c.text.trim()).join(" ").trim())
    .filter(Boolean).join("\n").trim();
  if (!text) { setStatus("No text on this folio to analyse"); return; }

  const btn = $("btn-suggest");
  if (btn) btn.disabled = true;
  setStatus("Asking the model for entity suggestions...");
  try {
    const reply = await complete(buildSuggestPrompt(text));
    const items = parseSuggestions(reply);
    if (!items.length) { setStatus("The model proposed no entities"); return; }
    let doc = app.state.doc;
    let added = 0;
    for (const it of items) {
      doc = standoff.addEntity(doc, it.type, { name: it.name, ai: true });
      added++;
    }
    if (added) {
      app.state = parseEdition(doc.raw);
      setDirty(true);
      refreshAfterStandoffEdit();
      selectTab("index");
    }
    setStatus(`${added} AI suggestion(s) added in violet. Confirm or delete each.`);
  } catch (err) {
    setStatus(`Suggestion failed: ${err.message}`);
  } finally {
    if (btn) btn.disabled = false;
  }
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

function renderValidation() {
  const host = $("ed-side");
  clear(host);
  const raw = serialize(app.state);
  const summary = structuralSummary(app.state);

  // Well-formedness
  const wf = isWellFormed(raw);
  const sec1 = el("div", { class: "ed-section" }, [el("h4", { text: "Live checks" })]);
  sec1.appendChild(valRow(wf.ok ? "ok" : "err", wf.ok ? "Well-formed XML" : `Not well-formed: ${wf.message}`));

  // Structural integrity vs the loaded baseline (lossless round-trip evidence).
  // Compares real @xml:id values, so a lossless edit that drops a synthetic cell
  // id (e.g. emptying a line in an id-less edition) does not raise a false alarm.
  const base = app.baseline;
  const curIds = xmlIdSet(app.state);
  const missing = [...base.xmlIds].filter((id) => !curIds.has(id));
  const added = [...curIds].filter((id) => !base.xmlIds.has(id)).length;
  if (!missing.length && added === 0) {
    sec1.appendChild(valRow("ok", base.xmlIds.size
      ? `All ${base.xmlIds.size} xml:id(s) preserved (no structural loss)`
      : `All ${base.wordCount} reading unit(s) preserved (no xml:id to lose)`));
  } else {
    if (missing.length) sec1.appendChild(valRow("err", `${missing.length} xml:id(s) lost: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "..." : ""}`));
    if (added) sec1.appendChild(valRow("warn", `${added} new xml:id(s) added`));
  }

  // Tag-count drift vs baseline
  const drift = [];
  for (const t of Object.keys(base.counts)) {
    if (summary.counts[t] !== base.counts[t]) drift.push(`${t}: ${base.counts[t]} -> ${summary.counts[t]}`);
  }
  sec1.appendChild(drift.length
    ? valRow("warn", `Tag counts changed: ${drift.join("; ")}`)
    : valRow("ok", "Element counts unchanged"));
  host.appendChild(sec1);

  // Structure overview
  const sec2 = el("div", { class: "ed-section" }, [el("h4", { text: "Structure" })]);
  sec2.appendChild(kv("Folios", summary.folios));
  sec2.appendChild(kv("Words", summary.words));
  sec2.appendChild(kv("xml:id count", summary.ids));
  for (const t of ["surface", "zone", "l", "lb", "pb", "note", "standOff"]) {
    if (summary.counts[t]) sec2.appendChild(kv(`<${t}>`, summary.counts[t]));
  }
  host.appendChild(sec2);

  // Honest scope note: heavy validation is the offline harness, not the browser.
  const sec3 = el("div", { class: "ed-section" }, [el("h4", { text: "Full validation" })]);
  sec3.appendChild(el("div", {
    class: "ed-hint",
    text: "RelaxNG (tei_all.rng) and Schematron run in the offline harness (test/harness). The browser checks well-formedness and structural integrity only.",
  }));
  host.appendChild(sec3);
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
  if (document.querySelector("#ed-reading .ed-crit-pick, #ed-reading .ed-act-pick")) return;
  if (!$("gen-modal").hidden) return;
  gotoFolio(app.folio + (e.key === "ArrowRight" ? 1 : -1));
});
$("btn-suggest").addEventListener("click", suggestEntities);
$("btn-validate").addEventListener("click", () => { renderValidation(); setStatus("Live checks refreshed"); });
$("btn-save").addEventListener("click", save);
$("btn-download").addEventListener("click", download);

// Right-pane tabs: validation (default) <-> entity index.
function selectTab(which) {
  const onIndex = which === "index";
  $("ed-side").hidden = onIndex;
  $("ed-index").hidden = !onIndex;
  $("tab-validation").classList.toggle("active", !onIndex);
  $("tab-index").classList.toggle("active", onIndex);
}
$("tab-validation").addEventListener("click", () => selectTab("validation"));
$("tab-index").addEventListener("click", () => selectTab("index"));

window.addEventListener("beforeunload", (e) => {
  if (app.dirty) { e.preventDefault(); e.returnValue = ""; }
});

setStatus("Ready. Open a TEI edition, pick an example, or generate from text.");
updateFacsState(); // start state: no document, facsimile pane collapsed

// Deep link from the landing page: editor.html#generate opens the LLM entry.
if (location.hash === "#generate") openGenModal();
