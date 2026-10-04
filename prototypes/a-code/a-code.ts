/// <reference types="vite/client" />
import { StateEffect, StateField, type Text } from "@codemirror/state";
import { Decoration, EditorView, GutterMarker, WidgetType, gutter } from "@codemirror/view";
import { createXmlEditor } from "../../src/editor/xml-editor";
import { rawOf, toPos, toRaw } from "../../src/editor/offsets";
import { foldStructure, structuralFolding, unfoldAll } from "../../src/editor/structural-fold";
import { elementPath, selectElement } from "../../src/editor/element-path";
import { markupLevels } from "../../src/editor/markup-levels";
import { checkWellFormed } from "../../src/core/well-formed";
import { parseDocument } from "../../src/core/tei-document.js";
import { decodeXmlBytes, encodeXmlBytes } from "../../src/core/file-encoding.js";
import { applyFormat, formatElement, mapFormattedOffset } from "../../src/core/format.js";
import { type Proposal, applyProposal } from "../../src/core/proposal.js";
import { findProposal } from "../../src/core/proposal-fixture.js";
// Imported rather than linked: the tokens lie outside the prototype root, and Vite resolves imports, not HTML links.
import "../../src/ui/tokens.css";
import "./a-code.css";

const SAMPLE_DIR = "/samples/";
type Range = { from: number; to: number };

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}
const ui = {
  fileName: byId<HTMLHeadingElement>("file-name"),
  path: byId<HTMLOListElement>("path"),
  editor: byId<HTMLDivElement>("editor"),
  cursor: byId<HTMLSpanElement>("cursor"),
  encoding: byId<HTMLSpanElement>("encoding"),
  wellformed: byId<HTMLSpanElement>("wellformed"),
  dirty: byId<HTMLSpanElement>("dirty"),
  message: byId<HTMLOutputElement>("message"),
  propose: byId<HTMLButtonElement>("propose"),
  sample: byId<HTMLSelectElement>("sample"),
  fileInput: byId<HTMLInputElement>("file-input"),
  formatDialog: byId<HTMLDialogElement>("format-dialog"),
  discardDialog: byId<HTMLDialogElement>("discard-dialog"),
};
// Well-formedness marking; the line number comes from the browser parser and may lag one debounce behind edits.
const setProblem = StateEffect.define<number | null>();
const problemLine = StateField.define<number | null>({
  create: () => null,
  update(value, tr) {
    for (const e of tr.effects) if (e.is(setProblem)) return e.value;
    return value;
  },
});
const problemMarker = new (class extends GutterMarker {
  toDOM() {
    const span = document.createElement("span");
    span.className = "problem-marker";
    span.textContent = "!";
    span.setAttribute("aria-hidden", "true");
    return span;
  }
})();
const problemExtensions = [
  problemLine,
  gutter({
    class: "cm-problemGutter",
    lineMarker: (view, line) => {
      const n = view.state.field(problemLine);
      return n !== null && n <= view.state.doc.lines && view.state.doc.line(n).from === line.from ? problemMarker : null;
    },
    lineMarkerChange: (u) => u.transactions.some((tr) => tr.effects.some((e) => e.is(setProblem))),
    initialSpacer: () => problemMarker,
  }),
  EditorView.decorations.compute([problemLine], (state) => {
    const n = state.field(problemLine);
    if (n === null || n > state.doc.lines) return Decoration.none;
    return Decoration.set([Decoration.line({ class: "cm-problemLine" }).range(state.doc.line(n).from)]);
  }),
];

// Demonstration proposal, held in editor positions. Pending proposals and accepted ranges are mapped through
// edits; an edit touching the pending target withdraws it, because the proposal no longer describes the text it
// was computed from.
interface ProposalState { pending: Proposal | null; accepted: Range[] }
const setPending = StateEffect.define<Proposal | null>();
const addAccepted = StateEffect.define<Range>();
const proposals = StateField.define<ProposalState>({
  create: () => ({ pending: null, accepted: [] }),
  update(value, tr) {
    let { pending, accepted } = value;
    if (tr.docChanged) {
      if (pending && tr.changes.touchesRange(pending.from, pending.to)) pending = null;
      else if (pending) pending = { ...pending, from: tr.changes.mapPos(pending.from, 1), to: tr.changes.mapPos(pending.to, -1) };
      accepted = accepted.map((r) => ({ from: tr.changes.mapPos(r.from, 1), to: tr.changes.mapPos(r.to, -1) })).filter((r) => r.to > r.from);
    }
    for (const e of tr.effects) {
      if (e.is(setPending)) pending = e.value;
      if (e.is(addAccepted)) accepted = [...accepted, e.value];
    }
    return pending === value.pending && accepted === value.accepted ? value : { pending, accepted };
  },
  // Computed from state rather than a view function, because block widgets must reach the facet directly.
  provide: (field) => EditorView.decorations.compute([field], (state) => {
    const value = state.field(field);
    const ranges = value.accepted.map((r) => Decoration.mark({ class: "cm-proposal-accepted" }).range(r.from, r.to));
    const p = value.pending;
    if (p) {
      ranges.push(Decoration.mark({ class: "cm-proposal-target" }).range(p.from, p.to));
      const lineEnd = state.doc.lineAt(p.to).to;
      ranges.push(Decoration.widget({ widget: new ProposalWidget(p), block: true, side: 1 }).range(lineEnd));
    }
    return Decoration.set(ranges, true);
  }),
});

class ProposalWidget extends WidgetType {
  constructor(readonly p: Proposal) { super(); }
  eq(other: ProposalWidget) { return other.p.from === this.p.from && other.p.replacement === this.p.replacement; }
  toDOM(view: EditorView) {
    const box = document.createElement("div");
    box.className = "proposal";
    box.setAttribute("role", "group");
    box.setAttribute("aria-label", "Proposed (demo)");
    const label = Object.assign(document.createElement("strong"), { textContent: "Proposed (demo)" });
    const code = Object.assign(document.createElement("code"), { textContent: this.p.replacement });
    const why = Object.assign(document.createElement("span"), { className: "proposal-why", textContent: this.p.rationale });
    const accept = Object.assign(document.createElement("button"), { type: "button", className: "accept", textContent: "Accept" });
    const reject = Object.assign(document.createElement("button"), { type: "button", className: "reject", textContent: "Reject" });
    accept.addEventListener("click", () => acceptProposal(view));
    reject.addEventListener("click", () => rejectProposal(view));
    box.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { e.preventDefault(); view.focus(); }
    });
    const actions = Object.assign(document.createElement("span"), { className: "proposal-actions" });
    actions.append(accept, reject);
    box.append(label, code, why, actions);
    return box;
  }
}

// The canonical result comes from the core; the editor receives the equivalent minimal change so that folds
// outside the range and the undo history survive.
function applyCanonical(view: EditorView, before: string, next: string, r: Range, cursor: number) {
  const { state } = view;
  const changed = next.slice(r.from, next.length - (before.length - r.to));
  view.dispatch({
    changes: { from: toPos(state, before, r.from), to: toPos(state, before, r.to), insert: changed },
    selection: { anchor: toPos(state, next, cursor) },
    scrollIntoView: true,
  });
}
function acceptProposal(view: EditorView) {
  const p = view.state.field(proposals).pending;
  if (!p) return;
  const raw = rawOf(view.state);
  const r = { from: toRaw(view.state, p.from), to: toRaw(view.state, p.to) };
  applyCanonical(view, raw, applyProposal(parseDocument(raw), { ...p, ...r }).raw, r, r.from);
  view.dispatch({ effects: addAccepted.of({ from: p.from, to: p.from + view.state.toText(p.replacement).length }) });
  view.focus();
  flash("Proposal accepted.");
}
function rejectProposal(view: EditorView) {
  const p = view.state.field(proposals).pending;
  view.dispatch({ effects: setPending.of(null), selection: p ? { anchor: p.from } : undefined });
  view.focus();
  flash("Proposal rejected.");
}

function openFormatDialog(view: EditorView) {
  const raw = rawOf(view.state);
  const pos = toRaw(view.state, view.state.selection.main.head);
  const job = formatElement(parseDocument(raw), pos);
  if (!job) return;
  const name = job.element.qname;
  if (job.before === job.after) { flash(`${name} is already formatted.`); return; }
  byId("format-title").textContent = `Format ${name}`;
  byId("format-before").textContent = job.before;
  byId("format-after").textContent = job.after;
  const returnTo = document.activeElement as HTMLElement | null;
  ui.formatDialog.returnValue = "";
  ui.formatDialog.addEventListener("close", () => {
    if (ui.formatDialog.returnValue === "apply" && rawOf(view.state) === raw) {
      applyCanonical(view, raw, applyFormat(parseDocument(raw), job).raw, job.range, mapFormattedOffset(job, pos));
      view.focus();
      flash(`${name} formatted.`);
    } else returnTo?.focus();
  }, { once: true });
  ui.formatDialog.showModal();
}
// Session state of the open file.
let view: EditorView | null = null;
let fileName = "";
let bom = false;
let handle: FileSystemFileHandle | null = null;
let savedDoc: Text | null = null;
let currentSample = "";
let analyseTimer = 0;
let flashTimer = 0;

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
const isDirty = () => !!view && !!savedDoc && !view.state.doc.eq(savedDoc);


function analyse(v: EditorView) {
  const raw = rawOf(v.state);
  const result = checkWellFormed(raw);
  const reason = result.message
    ? (/error on line \d+ at column \d+:\s*(.*?)\s*(?:Below is a rendering|$)/.exec(result.message)?.[1]
      ?? /XML Parsing Error:\s*(.*?)\s*Location/.exec(result.message)?.[1] ?? result.message)
    : "";
  ui.wellformed.textContent = result.ok ? "well-formed" : `not well-formed${result.line ? ` (line ${result.line})` : ""}. ${reason}`;
  ui.wellformed.classList.toggle("is-problem", !result.ok);
  v.dispatch({ effects: setProblem.of(result.ok ? null : result.line) });
  ui.propose.hidden = findProposal(parseDocument(raw)) === null;
}

let pathKey = "";
function updateStatus(v: EditorView) {
  const head = v.state.selection.main.head;
  const line = v.state.doc.lineAt(head);
  ui.cursor.textContent = `${line.number}:${head - line.from + 1}`;
  ui.dirty.hidden = !isDirty();
  const chain = elementPath(v.state, head);
  const key = chain.map((n) => n.from).join(",");
  if (key === pathKey) return;
  pathKey = key;
  ui.path.replaceChildren(...chain.map((el, i) => {
    const li = document.createElement("li");
    const button = Object.assign(document.createElement("button"), { type: "button", textContent: el.name });
    if (i === chain.length - 1) button.setAttribute("aria-current", "location");
    button.addEventListener("click", () => {
      selectElement(v, el);
      v.focus();
    });
    li.append(button);
    return li;
  }));
}

function mount(text: string, name: string, hasBom: boolean, fileHandle: FileSystemFileHandle | null, sample: boolean) {
  view?.destroy();
  // A pending analysis of the previous file would otherwise report on it after the new one is shown.
  clearTimeout(analyseTimer);
  fileName = name;
  bom = hasBom;
  handle = fileHandle;
  pathKey = "-";
  view = createXmlEditor(ui.editor, text, [
    EditorView.contentAttributes.of({ "aria-label": "XML source" }),
    markupLevels(),
    structuralFolding(),
    problemExtensions,
    proposals,
    EditorView.domEventHandlers({
      dragover: (e) => { if (e.dataTransfer?.types.includes("Files")) { e.preventDefault(); return true; } return false; },
      drop: (e) => {
        const file = e.dataTransfer?.files[0];
        if (!file) return false;
        e.preventDefault();
        void guarded(() => openFile(file, null));
        return true;
      },
    }),
    EditorView.updateListener.of((u) => {
      if (u.docChanged) {
        clearTimeout(analyseTimer);
        analyseTimer = window.setTimeout(() => analyse(u.view), 400);
      }
      if (u.docChanged || u.selectionSet || u.viewportChanged) updateStatus(u.view);
    }),
  ]);
  savedDoc = view.state.doc;
  ui.fileName.textContent = name;
  document.title = `${name} (teiCrafter)`;
  ui.encoding.textContent = hasBom ? "UTF-8 with BOM" : "UTF-8";
  currentSample = sample ? name : "";
  ui.sample.value = currentSample;
  foldStructure(view);
  analyse(view);
  updateStatus(view);
}

function load(bytes: ArrayBuffer, name: string, fileHandle: FileSystemFileHandle | null, sample = false) {
  let decoded: { text: string; bom: boolean };
  try {
    decoded = decodeXmlBytes(bytes);
  } catch (error) {
    showProblem(`${name} was not opened. ${(error as Error).message}`);
    return;
  }
  mount(decoded.text, name, decoded.bom, fileHandle, sample);
  flash(`${name} opened.`);
}
async function openFile(file: File, fileHandle: FileSystemFileHandle | null) {
  load(await file.arrayBuffer(), file.name, fileHandle);
}
async function openSample(name: string) {
  const response = await fetch(SAMPLE_DIR + encodeURIComponent(name));
  if (!response.ok) { showProblem(`${name} could not be loaded (HTTP ${response.status}).`); return; }
  load(await response.arrayBuffer(), name, null, true);
}

function confirmDiscard(): Promise<boolean> {
  if (!isDirty()) return Promise.resolve(true);
  byId("discard-text").textContent = `${fileName} has changes that are not saved.`;
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
async function guarded(action: () => Promise<void>) {
  if (await confirmDiscard()) await action();
}

interface PickerOptions { suggestedName?: string; types?: { description: string; accept: Record<string, string[]> }[] }
type PickerWindow = {
  showOpenFilePicker?: (o: PickerOptions) => Promise<FileSystemFileHandle[]>;
  showSaveFilePicker?: (o: PickerOptions) => Promise<FileSystemFileHandle>;
};
const pickers = window as unknown as PickerWindow;
const XML_TYPES = [{ description: "XML", accept: { "application/xml": [".xml"] } }];
const isAbort = (e: unknown) => e instanceof DOMException && e.name === "AbortError";

async function openCommand() {
  if (!pickers.showOpenFilePicker) { ui.fileInput.click(); return; }
  try {
    const [fileHandle] = await pickers.showOpenFilePicker({ types: XML_TYPES });
    await openFile(await fileHandle.getFile(), fileHandle);
  } catch (e) {
    if (!isAbort(e)) showProblem(`The file could not be opened. ${(e as Error).message}`);
  }
}
async function save() {
  if (!view) return;
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    bytes = encodeXmlBytes(rawOf(view.state), { bom }) as Uint8Array<ArrayBuffer>;
  } catch (e) {
    showProblem(`Not saved. ${(e as Error).message}`);
    return;
  }
  const doc = view.state.doc;
  try {
    if (!handle && pickers.showSaveFilePicker) handle = await pickers.showSaveFilePicker({ suggestedName: fileName, types: XML_TYPES });
    if (handle) {
      const writable = await handle.createWritable();
      await writable.write(bytes);
      await writable.close();
      fileName = handle.name;
      ui.fileName.textContent = fileName;
      flash(`${fileName} saved.`);
    } else {
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/xml" }));
      const a = Object.assign(document.createElement("a"), { href: url, download: fileName });
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      flash(`Download of ${fileName} requested.`);
    }
    savedDoc = doc;
    updateStatus(view);
  } catch (e) {
    if (!isAbort(e)) showProblem(`${fileName} was not saved. ${(e as Error).message}`);
  }
}

byId("fold-structure").addEventListener("click", () => { if (view) { foldStructure(view); view.focus(); } });
byId("unfold-all").addEventListener("click", () => { if (view) { unfoldAll(view); view.focus(); } });
byId("format-element").addEventListener("click", () => { if (view) openFormatDialog(view); });
ui.propose.addEventListener("click", () => {
  if (!view) return;
  const raw = rawOf(view.state);
  const found = findProposal(parseDocument(raw));
  if (!found) return;
  const p = { ...found, from: toPos(view.state, raw, found.from), to: toPos(view.state, raw, found.to) };
  view.dispatch({ effects: [setPending.of(p), EditorView.scrollIntoView(p.from, { y: "center" })] });
  requestAnimationFrame(() => view?.dom.querySelector<HTMLButtonElement>(".proposal .accept")?.focus());
});
byId("open").addEventListener("click", () => void guarded(openCommand));
ui.fileInput.addEventListener("change", () => {
  const file = ui.fileInput.files?.[0];
  ui.fileInput.value = "";
  if (file) void openFile(file, null);
});
ui.sample.addEventListener("change", async () => {
  const name = ui.sample.value;
  if (await confirmDiscard()) await openSample(name);
  else ui.sample.value = currentSample;
});
byId("save").addEventListener("click", () => void save());
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "s") { e.preventDefault(); void save(); }
  else if (e.altKey && e.shiftKey && e.code === "KeyF" && view && !ui.formatDialog.open) { e.preventDefault(); openFormatDialog(view); }
});
window.addEventListener("beforeunload", (e) => { if (isDirty()) e.preventDefault(); });

void openSample("zbz-hersch-synthetic.xml");
