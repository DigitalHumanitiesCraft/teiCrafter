/// <reference types="vite/client" />
import { EditorState, Prec } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { searchPanelOpen } from "@codemirror/search";
import { baseExtensions } from "../../src/editor/xml-editor";
import { lineSeparatorOf, rawOf, toPos } from "../../src/editor/offsets";
import { checkWellFormed } from "../../src/core/well-formed";
import {
  type TeiDocument, type TeiNode, decodeEntities, firstByLocal, getAttr, getXmlId,
  parseDocument, spliceDocument, textNodes, textOf, walk,
} from "../../src/core/tei-document.js";
import { DEFAULT_BLOCKS } from "../../src/core/format.js";
import {
  type OpenedXml, type SaveTarget, decodeXmlFile, dragCarriesFiles, fileFromDrop, openXmlFile, saveXml,
} from "../../src/io/open-save";
// Imported rather than linked: the tokens lie outside the prototype root, and Vite resolves imports, not HTML links.
import "../../src/ui/tokens.css";
import "./c-hybrid.css";

const SAMPLE_DIR = "/samples/";
type Level = "marks" | "reading";

/** Apparatus that renders as one summary row until the reader expands it. */
const COLLAPSED = new Set(["teiHeader", "standOff", "facsimile", "revisionDesc"]);
const ENTITY_NAMES = new Set(["persName", "placeName", "orgName"]);
/** name and rs carry no entity class of their own; their @type or the element their @ref points at supplies it. */
const ENTITY_BY_KIND: Record<string, string> = {
  person: "persName", place: "placeName", org: "orgName", organisation: "orgName", organization: "orgName",
};
const WHITESPACE = /^[ \t\r\n]*$/;

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}
const ui = {
  fileName: byId<HTMLHeadingElement>("file-name"),
  scroller: byId<HTMLElement>("scroller"),
  doc: byId<HTMLElement>("doc"),
  wellformed: byId<HTMLSpanElement>("wellformed"),
  dirty: byId<HTMLSpanElement>("dirty"),
  message: byId<HTMLOutputElement>("message"),
  sample: byId<HTMLSelectElement>("sample"),
  marks: byId<HTMLButtonElement>("level-marks"),
  reading: byId<HTMLButtonElement>("level-reading"),
  discardDialog: byId<HTMLDialogElement>("discard-dialog"),
};

interface InlineEdit {
  from: number;
  to: number;
  original: string;
  view: EditorView;
  host: HTMLElement;
  wrapper: HTMLElement;
  status: HTMLElement;
}

// Session state. raw is canonical; the tree, the rendered text and the editor are derived from it.
let raw = "";
let savedRaw = "";
let model: TeiDocument = parseDocument("");
let target: SaveTarget = { name: "", bom: false };
let expanded = new Set<number>();
let ids = new Map<string, TeiNode>();
let edit: InlineEdit | null = null;
let currentSample = "";
let wellFormed = true;
let flashTimer = 0;

const spanOf = (n: TeiNode) => ({ from: n.outerStart ?? n.start ?? 0, to: n.outerEnd ?? n.stagEnd ?? n.end ?? 0 });
const nodes = new Map<number, TeiNode>();

// ---- rendering

const blockCache = new WeakMap<TeiNode, boolean>();
const elementOnlyCache = new WeakMap<TeiNode, boolean>();

function isElementOnly(n: TeiNode): boolean {
  let v = elementOnlyCache.get(n);
  if (v === undefined) {
    v = !(n.children ?? []).some((k) => (k.type === "text" && !WHITESPACE.test(raw.slice(k.start, k.end))) || k.type === "cdata");
    elementOnlyCache.set(n, v);
  }
  return v;
}

/**
 * DEFAULT_BLOCKS plus pb, and any element that stands on its own source line inside element-only content of a
 * block. Without the second rule the header's title, author and idno run together into one line.
 */
function isBlock(el: TeiNode): boolean {
  let v = blockCache.get(el);
  if (v !== undefined) return v;
  const name = el.localName ?? "";
  v = DEFAULT_BLOCKS.has(name) || name === "pb";
  const parent = el.parent;
  if (!v && name !== "lb" && parent && parent.type === "element" && isBlock(parent) && isElementOnly(parent)) {
    const kids = parent.children ?? [];
    const prev = kids[kids.indexOf(el) - 1];
    v = !!prev && prev.type === "text" && raw.slice(prev.start, prev.end).includes("\n");
  }
  blockCache.set(el, v);
  return v;
}

function entityOf(el: TeiNode): string | null {
  const name = el.localName ?? "";
  if (ENTITY_NAMES.has(name)) return name;
  if (name !== "name" && name !== "rs") return null;
  const kind = ENTITY_BY_KIND[getAttr(el, "type") ?? ""];
  if (kind) return kind;
  const ref = /^#(\S+)/.exec(getAttr(el, "ref") ?? "")?.[1];
  const referenced = ref ? ids.get(ref) : undefined;
  return referenced ? (ENTITY_BY_KIND[referenced.localName ?? ""] ?? null) : null;
}

function summaryOf(el: TeiNode): string {
  const clip = (s: string) => (s.length > 160 ? `${s.slice(0, 159)}…` : s);
  const textIn = (n: TeiNode) => textNodes(n).map((t) => textOf(model, t)).join(" ").replace(/\s+/g, " ").trim();
  if (el.localName === "teiHeader") {
    const stmt = firstByLocal(el, "titleStmt");
    const title = stmt && firstByLocal(stmt, "title");
    if (title) return clip(textIn(title));
  }
  const text = textIn(el);
  if (text) return clip(text);
  // Without text, the distinct element names inside say what the block holds.
  const names = new Set<string>();
  walk(el, (n: TeiNode) => { if (n !== el && n.type === "element" && names.size < 4) names.add(n.qname ?? ""); });
  return [...names].join(", ") || "empty";
}

function chip(className: string, from: number, label: string, detail: string): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = className;
  b.dataset.from = String(from);
  b.tabIndex = -1;
  b.append(Object.assign(document.createElement("span"), { className: "mark-name", textContent: label }));
  if (detail) b.append(Object.assign(document.createElement("span"), { className: "mark-attrs", textContent: detail }));
  return b;
}

function startMark(el: TeiNode): HTMLButtonElement {
  const attrs = (el.attrs ?? []).map((a) => raw.slice(a.start, a.end)).join(" ");
  return chip("mark", el.outerStart ?? 0, el.qname ?? "", attrs);
}

/** The end mark repeats the element for the pointer; the keyboard reaches the element through its start mark. */
function endMark(el: TeiNode): HTMLSpanElement {
  const s = document.createElement("span");
  s.className = "end";
  s.dataset.from = String(el.outerStart ?? 0);
  s.setAttribute("aria-hidden", "true");
  s.textContent = `/${el.qname ?? ""}`;
  return s;
}

function leafLabel(n: TeiNode): { label: string; detail: string } {
  const text = raw.slice(n.start, n.end);
  const clip = (s: string) => { const t = s.replace(/\s+/g, " ").trim(); return t.length > 80 ? `${t.slice(0, 79)}…` : t; };
  switch (n.type) {
    case "comment": return { label: "comment", detail: clip(text.slice(4, -3)) };
    case "cdata": return { label: "CDATA", detail: clip(text.slice(9, -3)) };
    case "doctype": return { label: "DOCTYPE", detail: clip(text.slice(9, -1)) };
    default: {
      const m = /^<\?(\S+)\s*([\s\S]*?)\??>?$/.exec(text);
      return { label: `?${m?.[1] ?? ""}`, detail: clip(m?.[2]?.replace(/\?$/, "") ?? "") };
    }
  }
}

function renderChildren(parent: TeiNode, into: HTMLElement) {
  const skipSpace = parent.type === "root" || (parent.type === "element" && isBlock(parent) && isElementOnly(parent));
  for (const k of parent.children ?? []) {
    if (k.type === "text") {
      const text = raw.slice(k.start, k.end);
      if (skipSpace && WHITESPACE.test(text)) continue;
      const run = document.createElement("span");
      run.className = "run";
      run.dataset.from = String(k.start);
      run.dataset.to = String(k.end);
      run.textContent = decodeEntities(text);
      into.append(run);
    } else if (k.type === "element") {
      into.append(renderElement(k));
    } else {
      const { label, detail } = leafLabel(k);
      nodes.set(k.start ?? 0, k);
      const wrap = document.createElement("span");
      wrap.className = "node leaf";
      wrap.dataset.node = String(k.start);
      wrap.append(chip("mark", k.start ?? 0, label, detail));
      into.append(wrap);
    }
  }
}

function isLeadingChild(el: TeiNode): boolean {
  const kids = el.parent?.children ?? [];
  return kids.slice(0, kids.indexOf(el)).every((k) => k.type === "text" && WHITESPACE.test(raw.slice(k.start, k.end)));
}

function renderElement(el: TeiNode): HTMLElement {
  const from = el.outerStart ?? 0;
  nodes.set(from, el);
  const name = el.localName ?? "";
  const block = isBlock(el);
  const wrap = document.createElement(block ? "div" : "span");
  wrap.className = block ? "node block" : "node inline";
  wrap.dataset.node = String(from);
  wrap.dataset.name = name;
  // lb is a line boundary: it starts a new line unless it already opens its block.
  if (name === "lb") wrap.classList.add(isLeadingChild(el) ? "lb-lead" : "lb");
  wrap.append(startMark(el));
  if (name === "pb") {
    const n = getAttr(el, "n");
    wrap.classList.add("page");
    wrap.append(Object.assign(document.createElement("span"), { className: "page-label", textContent: n ? `Page ${n}` : "Page" }));
  }
  if (el.selfClosing) return wrap;

  if (COLLAPSED.has(name)) {
    const open = expanded.has(from);
    const toggle = chip("toggle", from, summaryOf(el), "");
    // At the Reading level the start mark is hidden, so the toggle names the element itself.
    toggle.prepend(Object.assign(document.createElement("span"), { className: "toggle-name", textContent: el.qname ?? "" }));
    toggle.setAttribute("aria-expanded", String(open));
    wrap.append(toggle);
    if (!open) return wrap;
  }
  const entity = entityOf(el);
  const content = block && !entity ? wrap : document.createElement("span");
  if (content !== wrap) {
    content.className = entity ? `content ent ent-${entity}` : "content";
    wrap.append(content);
  }
  renderChildren(el, content);
  if (el.etagStart != null) wrap.append(endMark(el));
  return wrap;
}

function render() {
  nodes.clear();
  const fragment = document.createDocumentFragment();
  renderChildren(model.root, fragment as unknown as HTMLElement);
  ui.doc.replaceChildren(fragment);
  const first = items()[0];
  if (first) first.tabIndex = 0;
}

// ---- keyboard model: one tab stop in the document, arrows move between marks

const items = () => [...ui.doc.querySelectorAll<HTMLButtonElement>(".mark, .toggle")].filter((b) => !b.closest("[hidden]"));

function focusItem(b: HTMLButtonElement | undefined, preventScroll = false) {
  if (!b) return;
  for (const other of ui.doc.querySelectorAll<HTMLButtonElement>(".mark[tabindex='0'], .toggle[tabindex='0']")) other.tabIndex = -1;
  b.tabIndex = 0;
  b.focus({ preventScroll });
}

/** Focus the mark of the node now starting at a raw offset, else the first mark after it. */
function focusMarkAt(from: number) {
  const all = items();
  const exact = all.find((b) => b.classList.contains("mark") && Number(b.dataset.from) === from);
  focusItem(exact ?? all.find((b) => Number(b.dataset.from) >= from) ?? all.at(-1), true);
}

ui.doc.addEventListener("focusin", (e) => {
  const t = e.target as HTMLElement;
  if (t.matches(".mark, .toggle")) focusItem(t as HTMLButtonElement, true);
});

ui.doc.addEventListener("keydown", (e) => {
  const t = e.target as HTMLElement;
  if (t.closest(".inline-editor") || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === "1" || e.key === "2") {
    e.preventDefault();
    setLevel(e.key === "1" ? "marks" : "reading");
    return;
  }
  if (!t.matches(".mark, .toggle")) return;
  const all = items();
  const i = all.indexOf(t as HTMLButtonElement);
  const blockOf = (b: HTMLElement) => b.closest(".block");
  let next: HTMLButtonElement | undefined;
  if (e.key === "ArrowRight") next = all[i + 1];
  else if (e.key === "ArrowLeft") next = all[i - 1];
  else if (e.key === "Home") next = all[0];
  else if (e.key === "End") next = all.at(-1);
  else if (e.key === "ArrowDown") next = all.slice(i + 1).find((b) => blockOf(b) !== blockOf(t));
  else if (e.key === "ArrowUp") {
    let j = i - 1;
    while (j >= 0 && blockOf(all[j]) === blockOf(t)) j--;
    while (j > 0 && blockOf(all[j - 1]) === blockOf(all[j])) j--;
    next = all[j];
  } else return;
  e.preventDefault();
  focusItem(next);
});

ui.doc.addEventListener("click", (e) => {
  const t = e.target as HTMLElement;
  if (t.closest(".inline-editor")) return;
  const toggle = t.closest<HTMLButtonElement>(".toggle");
  if (toggle) { toggleBlock(toggle); return; }
  const markEl = t.closest<HTMLElement>(".mark, .end");
  if (markEl) { openEditor(Number(markEl.dataset.from)); return; }
  const run = t.closest<HTMLElement>(".run");
  // A drag that selected text is a reading gesture, not a request to edit.
  if (!run || !(window.getSelection()?.isCollapsed ?? true)) return;
  const owner = run.parentElement?.closest<HTMLElement>(".node");
  if (owner) openEditor(Number(owner.dataset.node), caretOffset(run, e));
});

type CaretDocument = Document & { caretPositionFromPoint?(x: number, y: number): { offsetNode: Node; offset: number } | null };

/** Raw offset of a click inside a text run; the run shows decoded text, so references count as one character. */
function caretOffset(run: HTMLElement, e: MouseEvent): number {
  const start = Number(run.dataset.from);
  const source = raw.slice(start, Number(run.dataset.to));
  const pos = (document as CaretDocument).caretPositionFromPoint?.(e.clientX, e.clientY);
  const decodedIndex = pos && pos.offsetNode.parentNode === run ? pos.offset : 0;
  let i = 0;
  let seen = 0;
  while (i < source.length && seen < decodedIndex) {
    const ref = source[i] === "&" ? /^&(?:#x[0-9a-fA-F]+|#\d+|[A-Za-z][\w.-]*);/.exec(source.slice(i)) : null;
    const step = ref ? ref[0].length : 1;
    seen += ref ? decodeEntities(ref[0]).length : 1;
    i += step;
  }
  return start + i;
}

function toggleBlock(toggle: HTMLButtonElement) {
  const from = Number(toggle.dataset.from);
  const wrapper = toggle.closest<HTMLElement>(".node");
  const el = nodes.get(from);
  if (!wrapper || !el) return;
  if (edit && wrapper.contains(edit.host)) {
    setEditProblem("Apply or cancel this edit before collapsing the block around it.");
    edit.view.focus();
    return;
  }
  if (expanded.has(from)) expanded.delete(from);
  else expanded.add(from);
  const fresh = renderElement(el);
  wrapper.replaceWith(fresh);
  focusItem(fresh.querySelector<HTMLButtonElement>(".toggle") ?? undefined, true);
}

function setLevel(next: Level) {
  ui.doc.classList.toggle("level-marks", next === "marks");
  ui.doc.classList.toggle("level-reading", next === "reading");
  ui.marks.setAttribute("aria-pressed", String(next === "marks"));
  ui.reading.setAttribute("aria-pressed", String(next === "reading"));
}

// ---- inline source editor

const editChanged = () => !!edit && rawOf(edit.view.state) !== edit.original;

function setEditProblem(text: string) {
  if (!edit) return;
  edit.status.textContent = text;
  edit.status.hidden = !text;
}

function openEditor(from: number, caret?: number) {
  if (edit) {
    if (edit.from === from) { edit.view.focus(); return; }
    if (editChanged()) {
      setEditProblem("Apply or cancel this edit first.");
      edit.view.focus();
      return;
    }
    closeEditor(false);
  }
  const node = nodes.get(from);
  const wrapper = ui.doc.querySelector<HTMLElement>(`.node[data-node="${from}"]`);
  if (!node || !wrapper) return;
  const { to } = spanOf(node);
  const original = raw.slice(from, to);
  const label = node.type === "element" ? (node.qname ?? "") : leafLabel(node).label;

  const host = document.createElement("div");
  host.className = "inline-editor";
  host.setAttribute("role", "group");
  host.setAttribute("aria-label", `Edit ${label}`);
  const cm = document.createElement("div");
  cm.className = "inline-cm";
  const status = Object.assign(document.createElement("p"), { className: "edit-problem", hidden: true });
  status.setAttribute("role", "alert");
  const apply = Object.assign(document.createElement("button"), { type: "button", className: "primary", textContent: "Apply" });
  apply.setAttribute("aria-keyshortcuts", "Control+Enter");
  const cancel = Object.assign(document.createElement("button"), { type: "button", textContent: "Cancel" });
  cancel.setAttribute("aria-keyshortcuts", "Escape");
  apply.addEventListener("click", applyEdit);
  cancel.addEventListener("click", () => closeEditor(true));
  const actions = Object.assign(document.createElement("div"), { className: "edit-actions" });
  actions.append(apply, cancel, status);
  host.append(cm, actions);
  host.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !e.defaultPrevented) { e.preventDefault(); closeEditor(true); }
  });

  wrapper.hidden = true;
  wrapper.after(host);
  // The fragment uses the document's separator, so Enter in a CRLF file inserts CRLF even in a one-line element.
  const view = new EditorView({
    parent: cm,
    state: EditorState.create({
      doc: original,
      extensions: [
        EditorState.lineSeparator.of(lineSeparatorOf(raw)),
        baseExtensions(),
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({ "aria-label": `Source of ${label}` }),
        EditorView.updateListener.of((u) => { if (u.docChanged) updateStatus(); }),
        Prec.highest(keymap.of([
          { key: "Mod-Enter", run: () => { applyEdit(); return true; } },
          { key: "Escape", run: (v) => { if (searchPanelOpen(v.state)) return false; closeEditor(true); return true; } },
        ])),
      ],
    }),
  });
  edit = { from, to, original, view, host, wrapper, status };
  const anchor = caret === undefined ? 0 : toPos(view.state, original, Math.max(0, Math.min(caret - from, original.length)));
  view.dispatch({ selection: { anchor } });
  view.focus();
  updateStatus();
}

function closeEditor(refocus: boolean) {
  if (!edit) return;
  const { from, view, host, wrapper } = edit;
  edit = null;
  view.destroy();
  host.remove();
  wrapper.hidden = false;
  if (refocus) focusMarkAt(from);
  updateStatus();
}

function wellFormedReason(message: string | null): string {
  if (!message) return "";
  return /error on line \d+ at column \d+:\s*(.*?)\s*(?:Below is a rendering|$)/.exec(message)?.[1]
    ?? /XML Parsing Error:\s*(.*?)\s*Location/.exec(message)?.[1] ?? message;
}

function applyEdit() {
  if (!edit) return;
  const text = rawOf(edit.view.state);
  if (text === edit.original) { closeEditor(true); return; }
  const { from, to } = edit;
  const candidate = raw.slice(0, from) + text + raw.slice(to);
  const result = checkWellFormed(candidate);
  // A document that is already not well-formed must stay repairable, so only a regression blocks Apply.
  if (!result.ok && wellFormed) {
    const before = raw.slice(0, from).split("\n").length - 1;
    const line = result.line === null ? null : result.line - before;
    const where = line !== null && line >= 1 && line <= text.split("\n").length ? `Line ${line} of this element: ` : "";
    setEditProblem(`Not applied, the document would not be well-formed. ${where}${wellFormedReason(result.message)}`);
    return;
  }
  const delta = text.length - (to - from);
  expanded = new Set([...expanded].flatMap((o) => (o < from ? [o] : o >= to ? [o + delta] : o === from ? [o] : [])));
  const scrollTop = ui.scroller.scrollTop;
  edit.view.destroy();
  edit.host.remove();
  edit = null;
  setRaw(spliceDocument(model, from, to, text).raw);
  ui.scroller.scrollTop = scrollTop;
  focusMarkAt(from);
  flash(result.ok ? "Edit applied." : "Edit applied. The document is still not well-formed.");
}

// ---- document state

function setRaw(next: string) {
  raw = next;
  model = parseDocument(raw);
  ids = new Map();
  collectIds(model.root);
  render();
  analyse();
}

function collectIds(n: TeiNode) {
  for (const k of n.children ?? []) {
    if (k.type !== "element") continue;
    const id = getXmlId(k);
    if (id) ids.set(id, k);
    collectIds(k);
  }
}

function analyse() {
  const result = checkWellFormed(raw);
  wellFormed = result.ok;
  ui.wellformed.textContent = result.ok
    ? "well-formed"
    : `not well-formed${result.line ? ` (line ${result.line})` : ""}. ${wellFormedReason(result.message)}`;
  ui.wellformed.classList.toggle("is-problem", !result.ok);
  updateStatus();
}

const isDirty = () => raw !== savedRaw || editChanged();
function updateStatus() { ui.dirty.hidden = !isDirty(); }

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

function mount(opened: OpenedXml, sample: boolean) {
  closeEditor(false);
  target = { name: opened.name, bom: opened.bom, handle: opened.handle, size: opened.size, lastModified: opened.lastModified };
  expanded = new Set();
  savedRaw = opened.text;
  setRaw(opened.text);
  ui.scroller.scrollTop = 0;
  ui.fileName.textContent = opened.name;
  document.title = `${opened.name} (teiCrafter)`;
  currentSample = sample ? opened.name : "";
  ui.sample.value = currentSample;
  flash(`${opened.name} opened.`);
}

function confirmDiscard(): Promise<boolean> {
  if (!isDirty()) return Promise.resolve(true);
  byId("discard-text").textContent = `${target.name} has changes that are not saved.`;
  ui.discardDialog.returnValue = "";
  const returnTo = document.activeElement as HTMLElement | null;
  return new Promise((resolve) => {
    ui.discardDialog.addEventListener("close", () => {
      returnTo?.focus();
      resolve(ui.discardDialog.returnValue === "discard");
    }, { once: true });
    ui.discardDialog.showModal();
  });
}

async function openFile(file: File, handle: FileSystemFileHandle | null, sample = false) {
  try {
    mount(await decodeXmlFile(file, handle), sample);
  } catch (e) {
    showProblem(`${file.name} was not opened. ${(e as Error).message}`);
  }
}

async function openSample(name: string) {
  const response = await fetch(SAMPLE_DIR + encodeURIComponent(name));
  if (!response.ok) { showProblem(`${name} could not be loaded (HTTP ${response.status}).`); return; }
  await openFile(new File([await response.arrayBuffer()], name, { type: "application/xml" }), null, true);
}

async function openCommand() {
  if (!(await confirmDiscard())) return;
  try {
    const opened = await openXmlFile();
    if (opened) mount(opened, false);
  } catch (e) {
    showProblem(`The file was not opened. ${(e as Error).message}`);
  }
}

async function save() {
  if (!target.name) return;
  const pending = editChanged();
  const bytesOf = raw;
  try {
    const result = await saveXml(target, bytesOf);
    if (!result) return;
    if (result.method !== "download") {
      target = { ...target, handle: result.handle, name: result.handle.name, size: result.size, lastModified: result.lastModified };
      ui.fileName.textContent = target.name;
    }
    savedRaw = bytesOf;
    updateStatus();
    const done = result.method === "download" ? `Download of ${target.name} requested.` : `${target.name} saved.`;
    flash(pending ? `${done} The open edit is not applied and was not saved.` : done);
  } catch (e) {
    showProblem(`${target.name} was not saved. ${(e as Error).message}`);
  }
}

// ---- commands

byId("open").addEventListener("click", () => void openCommand());
byId("save").addEventListener("click", () => void save());
ui.marks.addEventListener("click", () => setLevel("marks"));
ui.reading.addEventListener("click", () => setLevel("reading"));
ui.sample.addEventListener("change", async () => {
  const name = ui.sample.value;
  if (await confirmDiscard()) await openSample(name);
  else ui.sample.value = currentSample;
});
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "s") { e.preventDefault(); void save(); }
});
document.addEventListener("dragover", (e) => { if (dragCarriesFiles(e)) e.preventDefault(); });
document.addEventListener("drop", (e) => {
  if (!dragCarriesFiles(e)) return;
  e.preventDefault();
  // The handle request must start inside the event, before any await.
  const dropped = fileFromDrop(e);
  void (async () => {
    const found = await dropped;
    if (!found) return;
    if (found.kind !== "xml") { showProblem(`${found.file.name} was not opened. Only .xml files open here.`); return; }
    if (await confirmDiscard()) await openFile(found.file, found.handle);
  })();
});
window.addEventListener("beforeunload", (e) => { if (isDirty()) e.preventDefault(); });

void openSample("zbz-hersch-synthetic.xml");
