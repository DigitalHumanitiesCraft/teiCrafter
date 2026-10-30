/**
 * Baseline CodeMirror 6 configuration shared by every XML surface. A view adds
 * its own extensions (folding policy, decorations, panels) on top.
 */
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import { createXmlState } from "./offsets";
import {
  EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter,
  drawSelection, dropCursor, rectangularSelection, crosshairCursor,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { bracketMatching, foldGutter, foldKeymap, indentOnInput, syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { xml } from "@codemirror/lang-xml";
import { hangingIndent } from "./hanging-indent";

// CodeMirror's base theme sits outside the cascade layers and colours the drawn
// selection with a selector of this specificity, so the token colour needs the
// same selector. The native selection stays transparent, or it would paint over
// the drawn layer and the syntax colours.
const selectionTheme = EditorView.theme({
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionLayer .cm-selectionBackground": {
    backgroundColor: "var(--color-selection)",
  },
  ".cm-line ::selection, .cm-line::selection": { backgroundColor: "transparent", color: "inherit" },
});

/** Line wrapping with hanging indent, reconfigurable per view; off unless a view asks for it. */
export const lineWrapping = new Compartment();
const wrapExtension = (on: boolean): Extension => (on ? [EditorView.lineWrapping, hangingIndent] : []);

export function setLineWrapping(view: EditorView, on: boolean): void {
  view.dispatch({ effects: lineWrapping.reconfigure(wrapExtension(on)) });
}

export function baseExtensions({ wrap = false }: { wrap?: boolean } = {}): Extension[] {
  return [
    lineNumbers(),
    highlightActiveLine(),
    highlightActiveLineGutter(),
    history(),
    drawSelection(),
    dropCursor(),
    rectangularSelection(),
    crosshairCursor(),
    indentOnInput(),
    bracketMatching(),
    foldGutter(),
    highlightSelectionMatches(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    // Automatic closing tags would insert characters the user did not type (F.5).
    xml({ autoCloseTags: false }),
    selectionTheme,
    lineWrapping.of(wrapExtension(wrap)),
    EditorState.tabSize.of(2),
    keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, ...foldKeymap, indentWithTab]),
  ];
}

export function createXmlEditor(parent: HTMLElement, doc: string, extensions: Extension[] = [], options: { wrap?: boolean } = {}): EditorView {
  return new EditorView({ state: createXmlState(doc, [...baseExtensions(options), ...extensions]), parent });
}
