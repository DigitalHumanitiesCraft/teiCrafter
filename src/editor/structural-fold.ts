/**
 * Element-level folding. A fold always spans from the end of a start tag to
 * the start of its end tag, so a folded element still shows both tags, and the
 * placeholder summarises what is hidden.
 */
import { type EditorState, type Extension, Facet, Prec, type StateEffect } from "@codemirror/state";
import { type EditorView, type KeyBinding, keymap } from "@codemirror/view";
import { codeFolding, ensureSyntaxTree, foldEffect, foldService, foldedRanges, syntaxTree, unfoldAll, unfoldEffect } from "@codemirror/language";
import type { SyntaxNode } from "@lezer/common";
import { type Range, contentOf, elementsAt, localOf, nameOf } from "./element-path";

export { unfoldAll };

/** Apparatus a reader of the text usually does not need on first sight. */
export const DEFAULT_FOLDED: ReadonlySet<string> = new Set([
  "teiHeader", "facsimile", "standOff", "listPerson", "listPlace", "revisionDesc", "sourceDoc",
]);

const foldedElements = Facet.define<ReadonlySet<string>, ReadonlySet<string>>({
  combine: (values) => values.at(-1) ?? DEFAULT_FOLDED,
});

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

function textIn(state: EditorState, r: Range, firstOnly = false): string {
  let text = "";
  syntaxTree(state).iterate({ from: r.from, to: r.to, enter: (n) => {
    if (firstOnly && text.trim()) return false;
    if (n.name === "Text") text += ` ${state.sliceDoc(Math.max(n.from, r.from), Math.min(n.to, r.to))}`;
  } });
  return text.replace(/\s+/g, " ").trim();
}

/** Depth-first search for the first element matching each path step in turn. */
function findElement(state: EditorState, from: SyntaxNode, path: string[]): SyntaxNode | null {
  let found: SyntaxNode | null = null;
  let depth = 0;
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

/** The titleStmt title for teiHeader, else the first text, else the number of child elements. */
export function summarize(state: EditorState, range: Range): { name: string; summary: string } {
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

/** Fold every element named in the configured set. */
export function foldStructure(view: EditorView): boolean {
  const { state } = view;
  const names = state.facet(foldedElements);
  const tree = ensureSyntaxTree(state, state.doc.length, 2000) ?? syntaxTree(state);
  const effects: StateEffect<Range>[] = [];
  tree.iterate({ enter: (n) => {
    if (n.name !== "Element" || !names.has(localOf(nameOf(state, n.node)))) return;
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

/** Fold the innermost unfolded element at the cursor; repeated use walks outward. */
export function foldAtCursor(view: EditorView): boolean {
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

/** Unfold every fold touching the cursor. */
export function unfoldAtCursor(view: EditorView): boolean {
  const head = view.state.selection.main.head;
  const effects: StateEffect<Range>[] = [];
  foldedRanges(view.state).between(head, head, (from, to) => { effects.push(unfoldEffect.of({ from, to })); });
  if (effects.length) view.dispatch({ effects });
  return effects.length > 0;
}

/**
 * Bracket keys need AltGr on German and other layouts, so Ctrl+Shift+[ is not
 * reliably typeable there; the arrow pair works on every layout.
 */
export const structuralFoldKeymap: readonly KeyBinding[] = [
  { key: "Ctrl-Shift-[", run: foldAtCursor },
  { key: "Ctrl-Shift-]", run: unfoldAtCursor },
  { key: "Ctrl-Shift-ArrowUp", run: foldAtCursor },
  { key: "Ctrl-Shift-ArrowDown", run: unfoldAtCursor },
];

/** Element folds with summary placeholders and the fold keymap; folded names the elements foldStructure folds. */
export function structuralFolding(folded: ReadonlySet<string> = DEFAULT_FOLDED): Extension {
  return [
    foldedElements.of(folded),
    elementFolds,
    codeFolding({
      preparePlaceholder: summarize,
      placeholderDOM: (_view, onclick, prepared: { name: string; summary: string }) => {
        const el = document.createElement("span");
        el.className = "cm-foldPlaceholder cm-fold-summary";
        el.setAttribute("role", "button");
        el.setAttribute("aria-label", `Unfold ${prepared.name}`);
        el.append(Object.assign(document.createElement("span"), { className: "cm-fold-text", textContent: prepared.summary }));
        el.addEventListener("click", onclick);
        return el;
      },
    }),
    // Above the default foldKeymap, whose Ctrl-Shift-[ folds by line rather than by element.
    Prec.high(keymap.of(structuralFoldKeymap)),
  ];
}
