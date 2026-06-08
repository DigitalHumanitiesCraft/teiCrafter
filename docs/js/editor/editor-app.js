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
 *   - Render the diplomatic reading text word-by-word; click a word to correct it
 *     in place via editWordText (surgical, lossless).
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
  editWordText,
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
import { createIndexPanel } from "./index-panel.js";
import { complete, setProvider, setModel, setApiKey, getProviderConfigs } from "../services/llm.js";
import { SOURCE_LABELS, getDefaultMapping } from "../utils/constants.js";

const DEMO_URL = "data/editor/wenzelsbibel-synthetic-codex.xml";
const ZBZ_URL = "data/editor/zbz-100/zbz-hersch-100.xml";
const ZBZ_IMAGE_BASE = "data/editor/zbz-100/";

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
  for (const id of ["btn-validate", "btn-download"]) $(id).disabled = !on;
  $("btn-save").disabled = !on;
  updateFolioButtons();
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

// ---- folio navigation ------------------------------------------------------

function updateFolioButtons() {
  const n = app.state ? app.state.folios.length : 0;
  $("btn-prev").disabled = !app.state || app.folio <= 0;
  $("btn-next").disabled = !app.state || app.folio >= n - 1;
  const f = app.state ? app.state.folios[app.folio] : null;
  $("ed-folio-label").textContent = f
    ? `folio ${app.folio + 1}/${n}${f.n ? ` (${f.n})` : ""}`
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
  renderReading();
  renderFacsimile();
  renderValidation();
}

function renderReading() {
  const host = $("ed-reading");
  clear(host);
  const folio = app.state.folios[app.folio];
  app.currentLines = folio ? folio.lines : [];
  // hint reflects the detected granularity
  const hint = $("ed-edit-hint");
  if (hint) hint.textContent = app.state.profile === "word" ? "click a word to correct it" : "click a line to correct it";
  if (!folio || !folio.lines.length) {
    host.appendChild(el("div", { class: "ed-empty", text: "This folio has no transcribed text." }));
    return;
  }
  folio.lines.forEach((line, lineIndex) => {
    const row = el("div", { class: "ed-line", dataset: { line: String(lineIndex) } });
    row.appendChild(el("span", { class: "ed-line-n", text: line.n != null ? line.n : "" }));
    line.cells.forEach((cell, k) => {
      if (k > 0) row.appendChild(document.createTextNode(" "));
      const note = app.noteByWord.get(cell.id);
      const linking = app.linkTarget != null;
      const span = el("span", {
        class: "ed-w" + (note ? " has-note" : ""),
        dataset: { id: cell.id, line: String(lineIndex), start: String(cell.start) },
        text: cell.text,
        title: linking
          ? `click to link to ${app.linkTarget.name}`
          : (note ? `note: ${note}` : "click to correct"),
      });
      span.addEventListener("click", () => beginEdit(span, cell, lineIndex));
      span.addEventListener("mouseenter", () => highlightLine(lineIndex));
      span.addEventListener("mouseleave", () => clearLinks());
      row.appendChild(span);
    });
    host.appendChild(row);
  });
}

function beginEdit(span, cell, lineIndex) {
  // Link mode: a "link" was started from the index panel, so the next click on a
  // word/line wraps that mention in <name ref="#id"> instead of editing it.
  if (app.linkTarget) {
    const target = app.linkTarget;
    try {
      app.state = parseEdition(standoff.linkMention(app.state.doc, cell.node, target.id).raw);
      setDirty(true);
      setStatus(`Linked "${cell.text}" to ${target.name}`);
    } catch (err) {
      setStatus(`Link failed: ${err.message}`);
    }
    app.linkTarget = null;
    render();
    renderIndex();
    return;
  }

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

function renderFacsimile() {
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
  const host = $("ed-index");
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
  });
  return indexPanel;
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
 * Highlight an entity's mentions: mark reading spans whose cell.start falls inside
 * a mention node's content range, and highlight the zone(s) of those lines via the
 * facsimile controller. findMentions returns element nodes, so the mention range is
 * the element's [contentStart, contentEnd] (its inner text), with the outer span as
 * a fallback for self-contained markup.
 */
function highlightMentions(entity) {
  clearLinks();
  for (const w of document.querySelectorAll("#ed-reading .mention")) w.classList.remove("mention");
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
        span.classList.add("mention");
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
$("btn-demo").addEventListener("click", loadDemo);
$("btn-zbz").addEventListener("click", loadZbz);
$("btn-generate").addEventListener("click", openGenModal);
$("gen-close").addEventListener("click", closeGenModal);
$("gen-cancel").addEventListener("click", closeGenModal);
$("gen-provider").addEventListener("change", refreshModels);
$("gen-run").addEventListener("click", runGenerate);
$("gen-modal").addEventListener("click", (e) => { if (e.target.id === "gen-modal") closeGenModal(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("gen-modal").hidden) closeGenModal(); });
$("btn-prev").addEventListener("click", () => gotoFolio(app.folio - 1));
$("btn-next").addEventListener("click", () => gotoFolio(app.folio + 1));
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

setStatus("Ready. Open a local TEI edition, load the synthetic Wenzelsbibel, or generate from text.");

// Deep link from the landing page: editor.html#generate opens the LLM entry.
if (location.hash === "#generate") openGenModal();
