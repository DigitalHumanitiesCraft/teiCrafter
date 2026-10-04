/**
 * Baseline CodeMirror 6 configuration shared by every XML surface. A view adds
 * its own extensions (folding policy, decorations, panels) on top.
 */
import { EditorState, type Extension } from "@codemirror/state";
import {
  EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter,
  drawSelection, dropCursor, rectangularSelection, crosshairCursor,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { bracketMatching, foldGutter, foldKeymap, indentOnInput, syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { xml } from "@codemirror/lang-xml";

export function baseExtensions(): Extension[] {
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
    xml(),
    EditorState.tabSize.of(2),
    keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, ...foldKeymap, indentWithTab]),
  ];
}

export function createXmlEditor(parent: HTMLElement, doc: string, extensions: Extension[] = []): EditorView {
  const state = EditorState.create({ doc, extensions: [...baseExtensions(), ...extensions] });
  return new EditorView({ state, parent });
}
