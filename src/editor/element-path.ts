/**
 * Element addressing over the Lezer XML tree: names, content ranges and the
 * ancestor chain at a position, as used by the breadcrumb and by folding.
 */
import { EditorSelection, type EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import type { SyntaxNode } from "@lezer/common";

export interface Range { from: number; to: number }
export interface PathElement extends Range { name: string }

/** Local part of a qualified name, so prefixed TEI matches unprefixed names. */
export const localOf = (qname: string): string => qname.slice(qname.indexOf(":") + 1);

/** The element's qualified name as written, or "" for a tag the parser could not name. */
export function nameOf(state: EditorState, el: SyntaxNode): string {
  const tag = el.getChild("OpenTag") ?? el.getChild("SelfClosingTag");
  const name = tag?.getChild("TagName");
  return name ? state.sliceDoc(name.from, name.to) : "";
}

/** The range between start tag and end tag, or null for empty or unclosed elements. */
export function contentOf(el: SyntaxNode): Range | null {
  const open = el.getChild("OpenTag");
  const close = el.getChild("CloseTag");
  return open && close && close.from > open.to ? { from: open.to, to: close.from } : null;
}

/** Element nodes containing pos, innermost first. */
export function elementsAt(state: EditorState, pos: number): SyntaxNode[] {
  const out: SyntaxNode[] = [];
  for (let n: SyntaxNode | null = syntaxTree(state).resolveInner(pos, 1); n; n = n.parent) {
    if (n.name === "Element") out.push(n);
  }
  return out;
}

/** The ancestor chain at pos, outermost first, in editor positions. */
export function elementPath(state: EditorState, pos: number): PathElement[] {
  return elementsAt(state, pos).reverse().map((el) => ({ name: nameOf(state, el), from: el.from, to: el.to }));
}

/** Select a whole element and scroll its start into view. */
export function selectElement(view: EditorView, range: Range): void {
  view.dispatch({
    selection: EditorSelection.range(range.from, range.to),
    effects: EditorView.scrollIntoView(range.from, { y: "start" }),
  });
}
