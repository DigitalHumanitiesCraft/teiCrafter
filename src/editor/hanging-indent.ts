/**
 * Hanging indent for wrapped lines: a continuation line starts two columns
 * under the start of its own line's content, so nested markup keeps its shape
 * when a long line wraps. Padding and negative text indent cancel on the first
 * visual line, which therefore keeps its place.
 */
import { RangeSetBuilder } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";

const byColumns = new Map<number, Decoration>();

function indentDecoration(columns: number): Decoration {
  let decoration = byColumns.get(columns);
  if (!decoration) {
    const hang = columns + 2;
    decoration = Decoration.line({ attributes: { style: `padding-left: calc(${hang}ch + 6px); text-indent: -${hang}ch` } });
    byColumns.set(columns, decoration);
  }
  return decoration;
}

function leadingColumns(text: string, tabSize: number): number {
  let columns = 0;
  for (const char of text) {
    if (char === " ") columns += 1;
    else if (char === "\t") columns += tabSize;
    else break;
  }
  return columns;
}

function hangingDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const { doc, tabSize } = view.state;
  for (const { from, to } of view.visibleRanges) {
    for (let pos = from; pos <= to;) {
      const line = doc.lineAt(pos);
      builder.add(line.from, line.from, indentDecoration(leadingColumns(line.text, tabSize)));
      pos = line.to + 1;
    }
  }
  return builder.finish();
}

export const hangingIndent = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = hangingDecorations(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) this.decorations = hangingDecorations(update.view);
    }
  },
  { decorations: (plugin) => plugin.decorations },
);
