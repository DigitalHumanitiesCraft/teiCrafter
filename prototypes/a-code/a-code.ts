/// <reference types="vite/client" />
import { Compartment, EditorSelection, EditorState, Prec, StateEffect, StateField, type Text } from "@codemirror/state";
import { Decoration, EditorView, GutterMarker, WidgetType, gutter, keymap } from "@codemirror/view";
import {
  HighlightStyle, codeFolding, ensureSyntaxTree, foldEffect, foldService, foldedRanges, syntaxHighlighting,
  syntaxTree, unfoldAll, unfoldEffect,
} from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import type { SyntaxNode } from "@lezer/common";
import { createXmlEditor } from "../../src/editor/xml-editor";
import { checkWellFormed } from "../../src/core/well-formed";
import { parseDocument, spliceDocument } from "../../src/core/tei-document.js";
import { decodeXmlBytes, encodeXmlBytes } from "../../src/core/file-encoding.js";
// Imported rather than linked: the tokens lie outside the prototype root, and Vite resolves imports, not HTML links.
import "../../src/ui/tokens.css";
import "./a-code.css";

const DEFAULT_FOLDED = new Set(["teiHeader", "facsimile", "standOff", "listPerson", "listPlace", "revisionDesc", "sourceDoc"]);
const BLOCK = new Set([
  "TEI", "teiHeader", "fileDesc", "titleStmt", "publicationStmt", "sourceDesc", "profileDesc", "revisionDesc",
  "text", "front", "body", "back", "div", "p", "lg", "l", "ab", "head", "list", "item", "listPerson", "person",
  "listPlace", "place", "standOff", "facsimile", "surface", "zone", "note", "bibl", "msDesc", "change",
]);
const INDENT = "  ";
const SAMPLE_DIR = "../samples/";

interface TeiNode {
  type: string;
  localName?: string;
  qname?: string;
  prefix?: string | null;
  attrs?: { localName: string; prefix: string | null; value: string }[];
  children?: TeiNode[];
  parent: TeiNode | null;
  outerStart?: number;
  outerEnd?: number | null;
  stagStart?: number;
  stagEnd?: number;
  contentStart?: number | null;
  contentEnd?: number | null;
  etagStart?: number | null;
  etagEnd?: number | null;
  selfClosing?: boolean;
  start?: number;
  end?: number;
}
interface TeiDoc { raw: string; root: TeiNode }
interface Proposal { from: number; to: number; replacement: string; rationale: string }
type Range = { from: number; to: number };

const parse = (raw: string) => parseDocument(raw) as unknown as TeiDoc;
const splice = (raw: string, r: Range, insert: string) =>
  (spliceDocument(parseDocument(raw), r.from, r.to, insert) as unknown as TeiDoc).raw;

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
  dim: byId<HTMLButtonElement>("dim-markup"),
  propose: byId<HTMLButtonElement>("propose"),
  sample: byId<HTMLSelectElement>("sample"),
  fileInput: byId<HTMLInputElement>("file-input"),
  formatDialog: byId<HTMLDialogElement>("format-dialog"),
  discardDialog: byId<HTMLDialogElement>("discard-dialog"),
};

// Lezer tree helpers. Element names compare by local name so prefixed TEI still matches.
const localOf = (qname: string) => qname.slice(qname.indexOf(":") + 1);
function nameOf(state: EditorState, el: SyntaxNode): string {
  const tag = el.getChild("OpenTag") ?? el.getChild("SelfClosingTag");
  const name = tag?.getChild("TagName");
  return name ? state.sliceDoc(name.from, name.to) : "";
}
function contentOf(el: SyntaxNode): Range | null {
  const open = el.getChild("OpenTag");
  const close = el.getChild("CloseTag");
  return open && close && close.from > open.to ? { from: open.to, to: close.from } : null;
}
function elementsAt(state: EditorState, pos: number): SyntaxNode[] {
  const out: SyntaxNode[] = [];
  for (let n: SyntaxNode | null = syntaxTree(state).resolveInner(pos, 1); n; n = n.parent) {
    if (n.name === "Element") out.push(n);
  }
  return out;
}
function textIn(state: EditorState, r: Range, firstOnly = false): string {
  let text = "";
  syntaxTree(state).iterate({ from: r.from, to: r.to, enter: (n) => {
    if (firstOnly && text.trim()) return false;
    if (n.name === "Text") text += ` ${state.sliceDoc(Math.max(n.from, r.from), Math.min(n.to, r.to))}`;
  } });
  return text.replace(/\s+/g, " ").trim();
}

// Element-level folding: a fold always spans from the end of the start tag to the start of the end tag.
const elementFolds = foldService.of((state, lineStart, lineEnd) => {
  let found: Range | null = null;
  syntaxTree(state).iterate({ from: lineStart, to: lineEnd, enter: (n) => {
    if (found) return false;
    if (n.name === "Element" && n.from >= lineStart) {
      const r = contentOf(n.node);
      if (r && r.to > lineEnd) found = r;
    }
  } });
  return found;
});

function summarize(state: EditorState, range: Range): { name: string; summary: string } {
  let el: SyntaxNode | null = syntaxTree(state).resolveInner(range.from, -1);
  while (el && el.name !== "Element") el = el.parent;
  if (!el) return { name: "", summary: "" };
  const name = nameOf(state, el);
  const clip = (s: string) => (s.length > 72 ? `${s.slice(0, 71)}…` : s);
  if (localOf(name) === "teiHeader") {
    const title = findElement(state, el, ["titleStmt", "title"]);
    const r = title && contentOf(title);
    if (r) return { name, summary: clip(textIn(state, r)) };
  }
  const text = textIn(state, range, true);
  if (text) return { name, summary: clip(text) };
  let count = 0;
  for (let c = el.getChild("OpenTag")?.nextSibling ?? null; c; c = c.nextSibling) if (c.name === "Element") count++;
  return { name, summary: count === 1 ? "1 child element" : `${count} child elements` };
}
function findElement(state: EditorState, from: SyntaxNode, path: string[]): SyntaxNode | null {
  let found: SyntaxNode | null = null;
  let depth = 0;
  // Depth-first search for the first element matching each path step in turn.
  const visit = (node: SyntaxNode): boolean => {
    for (let c = node.firstChild; c; c = c.nextSibling) {
      if (c.name !== "Element") continue;
      if (localOf(nameOf(state, c)) === path[depth]) {
        if (depth === path.length - 1) { found = c; return true; }
        depth++;
        if (visit(c)) return true;
        depth--;
      } else if (visit(c)) return true;
    }
    return false;
  };
  visit(from);
  return found;
}

function foldStructure(view: EditorView): boolean {
  const { state } = view;
  const tree = ensureSyntaxTree(state, state.doc.length, 2000) ?? syntaxTree(state);
  const effects: StateEffect<Range>[] = [];
  tree.iterate({ enter: (n) => {
    if (n.name !== "Element" || !DEFAULT_FOLDED.has(localOf(nameOf(state, n.node)))) return;
    const r = contentOf(n.node);
    if (r) effects.push(foldEffect.of(r));
  } });
  if (effects.length) view.dispatch({ effects });
  return true;
}
function isFolded(state: EditorState, r: Range): boolean {
  let hit = false;
  foldedRanges(state).between(r.from, r.to, (from, to) => { if (from === r.from && to === r.to) hit = true; });
  return hit;
}
// Repeated use walks outward: an element already folded hands over to its parent.
function foldAtCursor(view: EditorView): boolean {
  const { state } = view;
  const head = state.selection.main.head;
  for (const el of elementsAt(state, head)) {
    const r = contentOf(el);
    if (!r || isFolded(state, r)) continue;
    const inside = head > r.from && head < r.to;
    view.dispatch({ effects: foldEffect.of(r), selection: inside ? { anchor: r.from } : undefined });
    return true;
  }
  return false;
}
function unfoldAtCursor(view: EditorView): boolean {
  const head = view.state.selection.main.head;
  const effects: StateEffect<Range>[] = [];
  foldedRanges(view.state).between(head, head, (from, to) => { effects.push(unfoldEffect.of({ from, to })); });
  if (effects.length) view.dispatch({ effects });
  return effects.length > 0;
}

const highlight = HighlightStyle.define([
  { tag: [t.tagName, t.angleBracket], class: "x-tag" },
  { tag: [t.attributeName, t.definitionOperator], class: "x-attr" },
  { tag: t.attributeValue, class: "x-value" },
  { tag: [t.blockComment, t.processingInstruction, t.documentMeta], class: "x-meta" },
  { tag: t.character, class: "x-entity" },
  { tag: t.content, class: "x-text" },
]);
const dimCompartment = new Compartment();
const dimAttr = (on: boolean) => EditorView.editorAttributes.of({ class: on ? "dim-markup" : "" });

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

// Demonstration proposal. Pending proposals and accepted ranges are mapped through edits; an edit touching the
// pending target withdraws it, because the proposal no longer describes the text it was computed from.
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

function findProposal(raw: string): Proposal | null {
  const { root } = parse(raw);
  const persons = new Map<string, string>();
  const elements = (node: TeiNode, out: TeiNode[] = []) => {
    for (const c of node.children ?? []) if (c.type === "element") { out.push(c); elements(c, out); }
    return out;
  };
  const all = elements(root);
  const within = (n: TeiNode, name: string) => { for (let p = n.parent; p; p = p.parent) if (p.localName === name) return true; return false; };
  for (const person of all) {
    if (person.localName !== "person" || !within(person, "listPerson")) continue;
    const id = person.attrs?.find((a) => a.localName === "id" && a.prefix === "xml")?.value;
    const pn = person.children?.find((c) => c.localName === "persName");
    const text = pn?.contentStart != null && pn.contentEnd != null ? raw.slice(pn.contentStart, pn.contentEnd).trim() : "";
    if (id && text && !text.includes("<")) persons.set(id, text);
  }
  const body = all.find((e) => e.localName === "body" && within(e, "text"));
  if (!body || persons.size === 0) return null;
  const NAMING = new Set(["name", "persName", "rs", "ref"]);
  const letter = /\p{L}/u;
  // Body content in document order: the first usable occurrence wins.
  const visit = (node: TeiNode): Proposal | null => {
    for (const c of node.children ?? []) {
      if (c.type === "element") {
        const ref = c.attrs?.find((a) => a.localName === "ref" && a.prefix === null)?.value ?? "";
        const id = ref.startsWith("#") ? ref.slice(1) : "";
        if (c.localName === "name" && c.prefix === null && persons.has(id) && c.etagEnd != null && c.contentStart != null && c.contentEnd != null) {
          return {
            from: c.outerStart ?? 0,
            to: c.etagEnd,
            replacement: `<persName${raw.slice((c.stagStart ?? 0) + 1 + "name".length, c.stagEnd)}${raw.slice(c.contentStart, c.contentEnd)}</persName>`,
            rationale: `ref="#${id}" points to a person in listPerson, so the generic name element is proposed as persName.`,
          };
        }
        if (!NAMING.has(c.localName ?? "")) { const hit = visit(c); if (hit) return hit; }
      } else if (c.type === "text" && c.start != null && c.end != null) {
        const text = raw.slice(c.start, c.end);
        let best: { at: number; id: string; name: string } | null = null;
        for (const [id, name] of persons) {
          const at = text.indexOf(name);
          if (at < 0 || letter.test(text[at - 1] ?? "") || letter.test(text[at + name.length] ?? "")) continue;
          if (!best || at < best.at) best = { at, id, name };
        }
        if (best) {
          return {
            from: c.start + best.at,
            to: c.start + best.at + best.name.length,
            replacement: `<persName ref="#${best.id}">${best.name}</persName>`,
            rationale: `"${best.name}" is the persName of ${best.id} in listPerson and is not yet encoded here.`,
          };
        }
      }
    }
    return null;
  };
  return visit(body);
}

// The editor splits lines on the file's own separator, so sliceDoc() is the canonical raw, while an editor
// position counts each CRLF as one character. These two functions translate between raw offsets and positions.
const rawOf = (state: EditorState) => state.sliceDoc();
const toRaw = (state: EditorState, pos: number) => pos + (state.doc.lineAt(pos).number - 1) * (state.lineBreak.length - 1);
function toPos(state: EditorState, raw: string, offset: number): number {
  const sep = state.lineBreak;
  if (sep.length === 1) return offset;
  let n = 0;
  for (let i = raw.indexOf(sep); i >= 0 && i < offset; i = raw.indexOf(sep, i + sep.length)) n++;
  return offset - n * (sep.length - 1);
}

function applyCanonical(view: EditorView, r: Range, insert: string, cursor: number) {
  const { state } = view;
  const before = rawOf(state);
  const next = splice(before, r, insert);
  // The canonical result comes from spliceDocument; the editor receives the equivalent minimal change so that
  // folds outside the range and the undo history survive.
  const changed = next.slice(r.from, next.length - (before.length - r.to));
  const from = toPos(state, before, r.from);
  view.dispatch({
    changes: { from, to: toPos(state, before, r.to), insert: changed },
    selection: { anchor: toPos(state, next, cursor) },
    scrollIntoView: true,
  });
}
function acceptProposal(view: EditorView) {
  const p = view.state.field(proposals).pending;
  if (!p) return;
  const from = toRaw(view.state, p.from);
  applyCanonical(view, { from, to: toRaw(view.state, p.to) }, p.replacement, from);
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

// Formatter. A block element is restructured only when its content is element-only: no non-whitespace text and
// no inline siblings that touch or share a line, since that whitespace is content (word separation in <l>).
const XML_SPACE = /^[ \t\r\n]*$/;
const span = (n: TeiNode): Range => ({ from: n.outerStart ?? n.start ?? 0, to: n.outerEnd ?? n.end ?? 0 });
const isInline = (n: TeiNode) => n.type === "element" && !BLOCK.has(n.localName ?? "");
function isStructural(el: TeiNode, raw: string): boolean {
  const kids = el.children ?? [];
  if (el.selfClosing || el.etagStart == null || !kids.some((k) => k.type === "element")) return false;
  let prev: TeiNode | null = null;
  let gap = "";
  for (const k of kids) {
    if (k.type === "text") {
      const text = raw.slice(k.start, k.end);
      if (!XML_SPACE.test(text)) return false;
      gap += text;
      continue;
    }
    if (prev && isInline(prev) && isInline(k) && !gap.includes("\n")) return false;
    prev = k;
    gap = "";
  }
  return true;
}
function formatNode(el: TeiNode, raw: string, indent: string, nl: string): string {
  const { from, to } = span(el);
  if (!isStructural(el, raw)) return raw.slice(from, to);
  let out = raw.slice(el.stagStart, el.stagEnd);
  for (const k of el.children ?? []) {
    if (k.type === "text") continue;
    const r = span(k);
    const child = k.type === "element" && BLOCK.has(k.localName ?? "") ? formatNode(k, raw, indent + INDENT, nl) : raw.slice(r.from, r.to);
    out += nl + indent + INDENT + child;
  }
  return out + nl + indent + raw.slice(el.etagStart ?? to, el.etagEnd ?? to);
}
function formatTarget(raw: string, pos: number): { el: TeiNode; range: Range; after: string } | null {
  const { root } = parse(raw);
  let target: TeiNode | null = null;
  for (let node: TeiNode | undefined = root; node;) {
    node = node.children?.find((c) => c.type === "element" && span(c).from <= pos && pos < span(c).to);
    if (node && BLOCK.has(node.localName ?? "")) target = node;
  }
  target ??= root.children?.find((c) => c.type === "element") ?? null;
  if (!target || target.outerEnd == null) return null;
  const range = span(target);
  let depth = 0;
  for (let p = target.parent; p && p.type === "element"; p = p.parent) depth++;
  const indent = INDENT.repeat(depth);
  const nl = raw.includes("\r\n") ? "\r\n" : "\n";
  const body = formatNode(target, raw, indent, nl);
  // An element that starts its line also gets its own indentation corrected, so the range grows to the line start.
  const lineStart = raw.lastIndexOf("\n", range.from - 1) + 1;
  return /^[ \t]*$/.test(raw.slice(lineStart, range.from))
    ? { el: target, range: { from: lineStart, to: range.to }, after: indent + body }
    : { el: target, range, after: body };
}
// Formatting changes whitespace only, so the cursor keeps its place by counting non-whitespace characters.
function mapCursor(before: string, after: string, range: Range, pos: number): number {
  if (pos <= range.from) return pos;
  if (pos >= range.to) return pos + after.length - (range.to - range.from);
  const target = before.slice(range.from, pos).replace(/\s/g, "").length;
  let seen = 0;
  let i = 0;
  while (i < after.length && seen < target) { if (!/\s/.test(after[i])) seen++; i++; }
  return range.from + i;
}
function openFormatDialog(view: EditorView) {
  const raw = rawOf(view.state);
  const pos = toRaw(view.state, view.state.selection.main.head);
  const job = formatTarget(raw, pos);
  if (!job) return;
  const before = raw.slice(job.range.from, job.range.to);
  if (before === job.after) { flash(`${job.el.qname} is already formatted.`); return; }
  byId("format-title").textContent = `Format ${job.el.qname}`;
  byId("format-before").textContent = before;
  byId("format-after").textContent = job.after;
  const returnTo = document.activeElement as HTMLElement | null;
  ui.formatDialog.returnValue = "";
  ui.formatDialog.addEventListener("close", () => {
    if (ui.formatDialog.returnValue === "apply" && rawOf(view.state) === raw) {
      applyCanonical(view, job.range, job.after, mapCursor(raw, job.after, job.range, pos));
      view.focus();
      flash(`${job.el.qname} formatted.`);
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
let dim = false;
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
  ui.propose.hidden = findProposal(raw) === null;
}

let pathKey = "";
function updateStatus(v: EditorView) {
  const head = v.state.selection.main.head;
  const line = v.state.doc.lineAt(head);
  ui.cursor.textContent = `${line.number}:${head - line.from + 1}`;
  ui.dirty.hidden = !isDirty();
  const chain = elementsAt(v.state, head).reverse();
  const key = chain.map((n) => n.from).join(",");
  if (key === pathKey) return;
  pathKey = key;
  ui.path.replaceChildren(...chain.map((el, i) => {
    const li = document.createElement("li");
    const button = Object.assign(document.createElement("button"), { type: "button", textContent: nameOf(v.state, el) });
    if (i === chain.length - 1) button.setAttribute("aria-current", "location");
    button.addEventListener("click", () => {
      v.dispatch({ selection: EditorSelection.range(el.from, el.to), effects: EditorView.scrollIntoView(el.from, { y: "start" }) });
      v.focus();
    });
    li.append(button);
    return li;
  }));
}

function mount(text: string, name: string, hasBom: boolean, fileHandle: FileSystemFileHandle | null, sample: boolean) {
  view?.destroy();
  fileName = name;
  bom = hasBom;
  handle = fileHandle;
  pathKey = "-";
  view = createXmlEditor(ui.editor, text, [
    // Splitting only on the file's own separator keeps line endings byte-faithful and makes Enter insert the
    // same separator; a lone LF inside a CRLF file stays a character of its line.
    EditorState.lineSeparator.of(text.includes("\r\n") ? "\r\n" : "\n"),
    EditorView.contentAttributes.of({ "aria-label": "XML source" }),
    syntaxHighlighting(highlight),
    dimCompartment.of(dimAttr(dim)),
    elementFolds,
    codeFolding({
      preparePlaceholder: summarize,
      placeholderDOM: (_v, onclick, prepared: { name: string; summary: string }) => {
        const el = document.createElement("span");
        el.className = "cm-foldPlaceholder fold-summary";
        el.setAttribute("role", "button");
        el.setAttribute("aria-label", `Unfold ${prepared.name}`);
        el.append(Object.assign(document.createElement("span"), { className: "fold-text", textContent: prepared.summary }));
        el.addEventListener("click", onclick);
        return el;
      },
    }),
    problemExtensions,
    proposals,
    Prec.high(keymap.of([
      { key: "Ctrl-Shift-[", run: foldAtCursor },
      { key: "Ctrl-Shift-]", run: unfoldAtCursor },
    ])),
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

function setDim(on: boolean) {
  dim = on;
  ui.dim.setAttribute("aria-pressed", String(on));
  view?.dispatch({ effects: dimCompartment.reconfigure(dimAttr(on)) });
}

byId("fold-structure").addEventListener("click", () => { if (view) { foldStructure(view); view.focus(); } });
byId("unfold-all").addEventListener("click", () => { if (view) { unfoldAll(view); view.focus(); } });
ui.dim.addEventListener("click", () => setDim(!dim));
byId("format-element").addEventListener("click", () => { if (view) openFormatDialog(view); });
ui.propose.addEventListener("click", () => {
  if (!view) return;
  const raw = rawOf(view.state);
  const found = findProposal(raw);
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
  else if (e.altKey && e.shiftKey && e.code === "KeyD") { e.preventDefault(); setDim(!dim); }
  else if (e.altKey && e.shiftKey && e.code === "KeyF" && view && !ui.formatDialog.open) { e.preventDefault(); openFormatDialog(view); }
});
window.addEventListener("beforeunload", (e) => { if (isDirty()) e.preventDefault(); });

void openSample("zbz-hersch-synthetic.xml");
