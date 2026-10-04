/// <reference types="vite/client" />
import { EditorState, Facet, Prec, StateEffect, StateField } from "@codemirror/state";
import { Decoration, EditorView, lineNumbers } from "@codemirror/view";
import { baseExtensions } from "../../src/editor/xml-editor";
import { createXmlState, lineSeparatorOf, rawOf, toPos } from "../../src/editor/offsets";
import { structuralFolding } from "../../src/editor/structural-fold";
import { checkWellFormed } from "../../src/core/well-formed";
import { type TeiDocument, type TeiNode, getAttr, getXmlId, isTeiElement, parseDocument, spliceDocument, textNodes, textOf } from "../../src/core/tei-document.js";
import { ExternalChangeError, type OpenedXml, decodeXmlFile, dragCarriesFiles, fileFromDrop, openXmlFile, saveXml } from "../../src/io/open-save";
// Imported rather than linked: the tokens lie outside the prototype root, and Vite resolves imports, not HTML links.
import "../../src/ui/tokens.css";
import "./b-focus.css";

const SAMPLE_DIR = "/samples/";
const DEFAULT_SAMPLE = "zbz-hersch-synthetic.xml";

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}
const ui = {
  fileName: byId<HTMLHeadingElement>("file-name"),
  sample: byId<HTMLSelectElement>("sample"),
  tree: byId<HTMLUListElement>("tree"),
  toggle: byId<HTMLButtonElement>("outline-toggle"),
  crumbs: byId<HTMLOListElement>("crumbs"),
  editor: byId<HTMLDivElement>("editor"),
  cursor: byId<HTMLSpanElement>("cursor"),
  wellformed: byId<HTMLSpanElement>("wellformed"),
  problemLink: byId<HTMLButtonElement>("problem-link"),
  dirty: byId<HTMLSpanElement>("dirty"),
  message: byId<HTMLOutputElement>("message"),
  discard: byId<HTMLDialogElement>("discard-dialog"),
};

// An outline unit is a range of the canonical raw string with a label taken from the source.
interface Unit {
  id: string;
  name: string;
  label: string;
  start: number;
  end: number;
  parent: Unit | null;
  children: Unit[];
}

const STRUCTURE = new Set(["TEI", "teiCorpus", "text", "front", "body", "back", "group", "div", "div1", "div2", "div3", "div4", "div5", "div6", "div7"]);
// The JSDoc of isTeiElement infers its default null as the only parameter type.
const isTei = isTeiElement as (node: TeiNode, localName?: string | null) => boolean;
const clip = (s: string) => (s.length > 60 ? `${s.slice(0, 59)}…` : s);
const elementsOf = (el: TeiNode) => (el.children ?? []).filter((c) => c.type === "element");

function elementLabel(doc: TeiDocument, el: TeiNode): string {
  const local = el.localName ?? "";
  if (local.startsWith("div")) {
    const head = elementsOf(el).find((c) => isTei(c, "head"));
    const text = head ? textNodes(head).map((t) => textOf(doc, t)).join("").replace(/\s+/g, " ").trim() : "";
    if (text) return clip(text);
  }
  const parts = [getAttr(el, "type"), getAttr(el, "n")].filter((v) => v);
  if (parts.length) return clip(parts.join(" "));
  return local === "TEI" ? (getXmlId(el) ?? "") : "";
}

/**
 * Units below an element. Inside text structure only divisions and pages are listed, so a body of
 * lines or paragraphs stays one unit. Header children are listed two levels deep.
 */
function childUnits(doc: TeiDocument, el: TeiNode, parent: Unit, mode: "all" | "structure" | "header", depth: number): Unit[] {
  const kids = elementsOf(el);
  const pages = mode === "structure" ? kids.filter((c) => isTei(c, "pb")) : [];
  const limit = el.contentEnd ?? parent.end;
  const out: Unit[] = [];
  for (const c of kids) {
    const local = c.localName ?? "";
    const start = c.outerStart ?? 0;
    const id = `${parent.id}.${out.length}`;
    if (pages.includes(c)) {
      const next = pages[pages.indexOf(c) + 1];
      const n = getAttr(c, "n") ?? getXmlId(c);
      out.push({ id, name: "pb", label: n ? `page ${n}` : "page", start, end: next?.outerStart ?? limit, parent, children: [] });
      continue;
    }
    const structural = isTei(c) && STRUCTURE.has(local);
    if (mode === "structure" && !structural) continue;
    const unit: Unit = { id, name: c.qname ?? local, label: elementLabel(doc, c), start, end: c.outerEnd ?? limit, parent, children: [] };
    out.push(unit);
    if (isTei(c, "teiHeader")) unit.children = childUnits(doc, c, unit, "header", 1);
    else if (mode === "header") unit.children = depth < 2 ? childUnits(doc, c, unit, "header", depth + 1) : [];
    else if (local === "TEI" || local === "teiCorpus") unit.children = childUnits(doc, c, unit, "all", 0);
    else if (structural) unit.children = childUnits(doc, c, unit, "structure", 0);
  }
  return out;
}

function buildOutline(doc: TeiDocument): Unit {
  const root: Unit = { id: "u", name: "#document", label: "Document", start: 0, end: doc.raw.length, parent: null, children: [] };
  const top = elementsOf(doc.root)[0];
  if (top) root.children = childUnits(doc, top, root, "all", 0);
  return root;
}

const flatten = (u: Unit): Unit[] => [u, ...u.children.flatMap(flatten)];
const ancestry = (u: Unit): Unit[] => (u.parent ? [...ancestry(u.parent), u] : [u]);
const findUnit = (start: number, name: string) => flatten(outline).find((u) => u.start === start && u.name === name) ?? null;
function deepestAt(offset: number): Unit {
  let u = outline;
  for (;;) {
    const inner = u.children.find((c) => c.start <= offset && offset < c.end);
    if (!inner) return u;
    u = inner;
  }
}

// Line numbers and well-formedness marks speak in document lines; the focus knows how many lines precede it.
const lineOffset = Facet.define<number, number>({ combine: (values) => values[0] ?? 0 });
const setProblem = StateEffect.define<number | null>();
const problemLine = StateField.define<number | null>({
  create: () => null,
  update(value, tr) {
    for (const e of tr.effects) if (e.is(setProblem)) return e.value;
    return value;
  },
  provide: (field) => EditorView.decorations.compute([field], (state) => {
    const n = state.field(field);
    if (n === null || n < 1 || n > state.doc.lines) return Decoration.none;
    return Decoration.set([Decoration.line({ class: "cm-problemLine" }).range(state.doc.line(n).from)]);
  }),
});

// Session state. doc.raw is the canonical document; the editor holds only raw.slice(focus.start, focus.end).
let doc: TeiDocument = parseDocument("");
let outline: Unit = buildOutline(doc);
let separator = "\n";
let savedRaw = "";
let file: { name: string; bom: boolean; handle: FileSystemFileHandle | null; size?: number; lastModified?: number } = { name: "", bom: false, handle: null };
let focus = { start: 0, end: 0, name: "#document", lines: 0, column: 1 };
let pending = false;
let commitTimer = 0;
let flashTimer = 0;
let currentSample = "";
const expanded = new Set<string>(["u"]);
let activeId = "u";
const narrow = window.matchMedia("(max-width: 48rem)");

function makeState(slice: string): EditorState {
  return createXmlState(slice, [
    // The slice may lack a line break of its own; Enter must still insert the document's separator.
    Prec.highest(EditorState.lineSeparator.of(separator)),
    lineOffset.of(focus.lines),
    ...baseExtensions(),
    lineNumbers({ formatNumber: (n, state) => String(n + state.facet(lineOffset)) }),
    structuralFolding(),
    problemLine,
    EditorView.contentAttributes.of({ "aria-label": "XML source of the focused unit" }),
    EditorView.domEventHandlers({
      // Leave file drops to the document handler instead of CodeMirror inserting the file text.
      drop: (e) => dragCarriesFiles(e),
    }),
    EditorView.updateListener.of((u) => {
      if (u.docChanged) {
        pending = true;
        clearTimeout(commitTimer);
        commitTimer = window.setTimeout(commit, 300);
      }
      if (u.docChanged || u.selectionSet) updateStatus();
    }),
  ]);
}
const view = new EditorView({ state: makeState(""), parent: ui.editor });

/** Splice the editor text into the canonical raw string at the recorded range. */
function commit(force = false) {
  if (!pending && !force) return;
  clearTimeout(commitTimer);
  pending = false;
  const slice = rawOf(view.state);
  doc = spliceDocument(doc, focus.start, focus.end, slice);
  focus.end = focus.start + slice.length;
  outline = buildOutline(doc);
  analyse();
  render();
}

function focusUnit(u: Unit, caret?: number) {
  commit();
  const raw = doc.raw;
  const before = raw.slice(0, u.start);
  focus = { start: u.start, end: u.end, name: u.name, lines: before.split(separator).length - 1, column: u.start - (before.lastIndexOf("\n") + 1) + 1 };
  const slice = raw.slice(u.start, u.end);
  const state = makeState(slice);
  view.setState(state);
  if (caret !== undefined && caret >= u.start && caret <= u.end) {
    view.dispatch({ selection: { anchor: toPos(state, slice, caret - u.start) }, scrollIntoView: true });
  }
  for (const a of ancestry(u).slice(0, -1)) expanded.add(a.id);
  activeId = u.id;
  analyse();
  render();
}

function analyse() {
  const result = checkWellFormed(doc.raw);
  ui.wellformed.classList.toggle("is-problem", !result.ok);
  ui.problemLink.hidden = true;
  let inside: number | null = null;
  if (result.ok) ui.wellformed.textContent = "well-formed";
  else {
    const reason = /error on line \d+ at column \d+:\s*(.*?)\s*(?:Below is a rendering|$)/.exec(result.message ?? "")?.[1]
      ?? /XML Parsing Error:\s*(.*?)\s*Location/.exec(result.message ?? "")?.[1] ?? result.message ?? "";
    const line = result.line;
    if (line !== null && line > focus.lines && line <= focus.lines + view.state.doc.lines) inside = line - focus.lines;
    ui.wellformed.textContent = `not well-formed${inside !== null ? ` (line ${line})` : ""}. ${reason}`;
    if (line !== null && inside === null) {
      ui.problemLink.textContent = `Go to line ${line}`;
      ui.problemLink.dataset.line = String(line);
      ui.problemLink.dataset.column = String(result.column ?? 1);
      ui.problemLink.hidden = false;
    }
  }
  view.dispatch({ effects: setProblem.of(inside) });
}

/** Refocus on the innermost unit containing a document line and put the cursor there. */
function goToLine(line: number, column: number) {
  commit();
  const raw = doc.raw;
  let offset = 0;
  for (let n = 1; n < line; n++) {
    const next = raw.indexOf(separator, offset);
    if (next < 0) break;
    offset = next + separator.length;
  }
  const lineEnd = raw.indexOf(separator, offset);
  offset = Math.min(offset + column - 1, lineEnd < 0 ? raw.length : lineEnd);
  focusUnit(deepestAt(offset), offset);
  view.focus();
}

const focusedUnit = () => findUnit(focus.start, focus.name);
const isDirty = () => pending || doc.raw !== savedRaw;

function updateStatus() {
  const { state } = view;
  const head = state.selection.main.head;
  const line = state.doc.lineAt(head);
  const column = head - line.from + (line.number === 1 ? focus.column : 1);
  ui.cursor.textContent = `${focus.lines + line.number}:${column}`;
  ui.dirty.hidden = !isDirty();
}

function render() {
  renderTree();
  const current = focusedUnit();
  const chain = ancestry(current ?? deepestAt(focus.start));
  ui.crumbs.replaceChildren(...chain.map((u) => {
    const li = document.createElement("li");
    if (u === current) {
      li.append(Object.assign(document.createElement("span"), { textContent: u.label || u.name }));
      li.setAttribute("aria-current", "location");
    } else {
      const button = Object.assign(document.createElement("button"), { type: "button", textContent: u.label || u.name });
      button.addEventListener("click", () => { focusUnit(u, focus.start); view.focus(); });
      li.append(button);
    }
    return li;
  }));
  // On a narrow screen the path scrolls; its end, the focused unit, is the part that must stay visible.
  ui.crumbs.parentElement?.scrollTo({ left: ui.crumbs.scrollWidth });
  updateStatus();
}

function visibleUnits(): Unit[] {
  const out: Unit[] = [];
  const visit = (u: Unit) => {
    out.push(u);
    if (expanded.has(u.id)) u.children.forEach(visit);
  };
  visit(outline);
  return out;
}

function treeItem(u: Unit, current: Unit | null): HTMLLIElement {
  const li = document.createElement("li");
  li.setAttribute("role", "treeitem");
  li.id = `t-${u.id}`;
  li.dataset.id = u.id;
  li.tabIndex = u.id === activeId ? 0 : -1;
  li.setAttribute("aria-labelledby", `l-${u.id}`);
  if (u === current) li.setAttribute("aria-selected", "true");
  const row = Object.assign(document.createElement("div"), { className: "row" });
  const twisty = Object.assign(document.createElement("span"), { className: "twisty" });
  twisty.setAttribute("aria-hidden", "true");
  row.append(twisty);
  const label = Object.assign(document.createElement("span"), { id: `l-${u.id}`, className: "label" });
  if (u.label && u.name !== "pb" && u.name !== "#document") {
    label.append(Object.assign(document.createElement("code"), { textContent: u.name }), " ");
  }
  label.append(u.label || u.name);
  row.append(label);
  li.append(row);
  if (u.children.length) {
    const open = expanded.has(u.id);
    li.setAttribute("aria-expanded", String(open));
    twisty.textContent = open ? "▾" : "▸";
    if (open) {
      const group = document.createElement("ul");
      group.setAttribute("role", "group");
      group.append(...u.children.map((c) => treeItem(c, current)));
      li.append(group);
    }
  }
  return li;
}

function renderTree() {
  const hadFocus = ui.tree.contains(document.activeElement);
  if (!visibleUnits().some((u) => u.id === activeId)) activeId = focusedUnit()?.id ?? "u";
  ui.tree.replaceChildren(treeItem(outline, focusedUnit()));
  if (hadFocus) document.getElementById(`t-${activeId}`)?.focus();
}

function moveTreeFocus(id: string) {
  activeId = id;
  renderTree();
  document.getElementById(`t-${id}`)?.focus();
}

function setOutlineOpen(open: boolean) {
  document.body.classList.toggle("outline-open", open);
  ui.toggle.setAttribute("aria-expanded", String(open));
  if (open) document.getElementById(`t-${activeId}`)?.focus();
}

function activate(id: string) {
  commit();
  const u = flatten(outline).find((x) => x.id === id);
  if (!u) return;
  focusUnit(u);
  if (narrow.matches) setOutlineOpen(false);
  view.focus();
}

ui.tree.addEventListener("click", (e) => {
  const li = (e.target as HTMLElement).closest<HTMLLIElement>("[role=treeitem]");
  const id = li?.dataset.id;
  if (!id) return;
  if ((e.target as HTMLElement).classList.contains("twisty")) {
    if (expanded.has(id)) expanded.delete(id);
    else expanded.add(id);
    moveTreeFocus(id);
  } else {
    activeId = id;
    activate(id);
  }
});

ui.tree.addEventListener("keydown", (e) => {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  const items = visibleUnits();
  const index = items.findIndex((u) => u.id === activeId);
  const u = items[index];
  if (!u) return;
  const go = (target: Unit | undefined) => { if (target) moveTreeFocus(target.id); };
  switch (e.key) {
    case "ArrowDown": go(items[index + 1]); break;
    case "ArrowUp": go(items[index - 1]); break;
    case "Home": go(items[0]); break;
    case "End": go(items.at(-1)); break;
    case "ArrowRight":
      if (!u.children.length) break;
      if (expanded.has(u.id)) go(u.children[0]);
      else { expanded.add(u.id); moveTreeFocus(u.id); }
      break;
    case "ArrowLeft":
      if (u.children.length && expanded.has(u.id)) { expanded.delete(u.id); moveTreeFocus(u.id); } else go(u.parent ?? undefined);
      break;
    case "Enter": activate(u.id); break;
    case "Escape":
      if (!narrow.matches) return;
      setOutlineOpen(false);
      ui.toggle.focus();
      break;
    default: return;
  }
  e.preventDefault();
});

ui.toggle.addEventListener("click", () => setOutlineOpen(!document.body.classList.contains("outline-open")));
ui.problemLink.addEventListener("click", () => goToLine(Number(ui.problemLink.dataset.line), Number(ui.problemLink.dataset.column)));

// Captured before CodeMirror, whose default keymap binds Alt+Up to moving the line.
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && !e.altKey && e.key.toLowerCase() === "s") { e.preventDefault(); void save(); return; }
  if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || !["ArrowUp", "ArrowLeft", "ArrowRight"].includes(e.key)) return;
  e.preventDefault();
  e.stopPropagation();
  commit();
  const current = focusedUnit() ?? deepestAt(focus.start);
  const siblings = current.parent?.children ?? [current];
  const step = e.key === "ArrowLeft" ? -1 : 1;
  const target = e.key === "ArrowUp" ? current.parent : siblings[siblings.indexOf(current) + step];
  if (!target) { flash(e.key === "ArrowUp" ? "The whole document is in focus." : `No ${step < 0 ? "previous" : "next"} unit.`); return; }
  const inEditor = view.hasFocus;
  focusUnit(target, e.key === "ArrowUp" ? current.start : undefined);
  if (inEditor || !ui.tree.contains(document.activeElement)) view.focus();
}, true);

function flash(text: string) {
  ui.message.classList.remove("is-problem");
  ui.message.textContent = text;
  clearTimeout(flashTimer);
  flashTimer = window.setTimeout(() => { if (!ui.message.classList.contains("is-problem")) ui.message.textContent = ""; }, 4000);
}
function showProblem(text: string) {
  clearTimeout(flashTimer);
  ui.message.classList.add("is-problem");
  ui.message.textContent = text;
}

/** Focus every unit and its parent without edits, forcing a write-back each time; raw must not change. */
function byteFidelityCheck(): boolean {
  const original = doc.raw;
  for (const u of flatten(outline)) {
    focusUnit(u);
    commit(true);
    if (u.parent) {
      focusUnit(findUnit(u.parent.start, u.parent.name) ?? outline);
      commit(true);
    }
    if (doc.raw !== original) return false;
  }
  return true;
}

function mount(opened: OpenedXml, sample: boolean) {
  clearTimeout(commitTimer);
  ui.message.classList.remove("is-problem");
  ui.message.textContent = "";
  pending = false;
  separator = lineSeparatorOf(opened.text);
  doc = parseDocument(opened.text);
  savedRaw = opened.text;
  file = { name: opened.name, bom: opened.bom, handle: opened.handle, size: opened.size, lastModified: opened.lastModified };
  outline = buildOutline(doc);
  expanded.clear();
  expanded.add("u");
  const units = flatten(outline);
  const identical = byteFidelityCheck();
  console.info(`Byte fidelity self-check for ${opened.name}: ${units.length} outline units focused in and out, raw ${identical ? "identical" : "CHANGED"}.`);
  if (!identical) showProblem(`Byte fidelity self-check failed for ${opened.name}; do not save.`);
  expanded.clear();
  expanded.add("u");
  const body = units.find((u) => u.name.replace(/^.*:/, "") === "body");
  let first = body ?? outline;
  while (first.children[0]) first = first.children[0];
  focusUnit(first);
  ui.fileName.textContent = opened.name;
  document.title = `${opened.name} (teiCrafter)`;
  currentSample = sample ? opened.name : "";
  ui.sample.value = currentSample;
}

async function openDecoded(decode: () => Promise<OpenedXml>, name: string, sample = false) {
  try {
    mount(await decode(), sample);
    if (!ui.message.classList.contains("is-problem")) flash(`${name} opened.`);
  } catch (error) {
    showProblem(`${name} was not opened. ${(error as Error).message}`);
  }
}

async function openSample(name: string) {
  const response = await fetch(SAMPLE_DIR + encodeURIComponent(name));
  if (!response.ok) { showProblem(`${name} could not be loaded (HTTP ${response.status}).`); return; }
  const buffer = await response.arrayBuffer();
  await openDecoded(() => decodeXmlFile(new File([buffer], name)), name, true);
}

function confirmDiscard(): Promise<boolean> {
  commit();
  if (!isDirty()) return Promise.resolve(true);
  byId("discard-text").textContent = `${file.name} has changes that are not saved.`;
  ui.discard.returnValue = "";
  const returnTo = document.activeElement as HTMLElement | null;
  return new Promise((resolve) => {
    ui.discard.addEventListener("close", () => {
      returnTo?.focus();
      resolve(ui.discard.returnValue === "discard");
    }, { once: true });
    ui.discard.showModal();
  });
}

async function save() {
  commit();
  const raw = doc.raw;
  try {
    const result = await saveXml(file, raw);
    if (!result) return;
    if (result.method === "download") flash(`Download of ${file.name} requested.`);
    else {
      file = { ...file, name: result.handle.name, handle: result.handle, size: result.size, lastModified: result.lastModified };
      ui.fileName.textContent = file.name;
      flash(`${file.name} saved.`);
    }
    savedRaw = raw;
    updateStatus();
  } catch (error) {
    showProblem(error instanceof ExternalChangeError ? error.message : `${file.name} was not saved. ${(error as Error).message}`);
  }
}

byId("open").addEventListener("click", async () => {
  if (!(await confirmDiscard())) return;
  try {
    const opened = await openXmlFile();
    if (opened) await openDecoded(async () => opened, opened.name);
  } catch (error) {
    showProblem(`The file was not opened. ${(error as Error).message}`);
  }
});
byId("save").addEventListener("click", () => void save());
ui.sample.addEventListener("change", async () => {
  const name = ui.sample.value;
  if (await confirmDiscard()) await openSample(name);
  else ui.sample.value = currentSample;
});
document.addEventListener("dragover", (e) => { if (dragCarriesFiles(e)) e.preventDefault(); });
document.addEventListener("drop", async (e) => {
  if (!dragCarriesFiles(e)) return;
  e.preventDefault();
  // Called before any await, because the dropped item is live only during the event.
  const found = await fileFromDrop(e);
  if (!found) return;
  if (found.kind !== "xml") { showProblem(`${found.file.name} was not opened. Only .xml files open here.`); return; }
  if (await confirmDiscard()) await openDecoded(() => decodeXmlFile(found.file, found.handle), found.file.name);
});
window.addEventListener("beforeunload", (e) => { if (isDirty()) e.preventDefault(); });

void openSample(DEFAULT_SAMPLE);
