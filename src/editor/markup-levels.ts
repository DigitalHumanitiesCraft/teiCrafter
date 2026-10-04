/**
 * Two ways to show markup while the source stays the edited object:
 * "source" with normal highlighting, and "reading" with single-line tags hidden
 * behind a zero-width marker, the remaining markup in a quiet secondary colour
 * and the content of names tinted by entity type.
 *
 * The reading level cannot show or edit attributes, keeps tags that span
 * several lines visible (decorations computed per viewport may not replace line
 * breaks), and drops a typed edit or deletion that would touch a hidden tag
 * instead of letting it change markup nobody sees. Program changes such as
 * accepting a proposal or formatting still pass.
 */
import { Compartment, EditorState, type Extension, type Range } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate, WidgetType } from "@codemirror/view";
import { HighlightStyle, foldState, syntaxHighlighting, syntaxTree } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { contentOf, localOf, nameOf } from "./element-path";

export type MarkupLevel = "source" | "reading";

export const markupHighlight = HighlightStyle.define([
  { tag: [t.tagName, t.angleBracket], class: "cm-xml-tag" },
  { tag: [t.attributeName, t.definitionOperator], class: "cm-xml-attr" },
  { tag: t.attributeValue, class: "cm-xml-value" },
  { tag: [t.blockComment, t.processingInstruction, t.documentMeta], class: "cm-xml-meta" },
  { tag: t.character, class: "cm-xml-entity" },
  { tag: t.content, class: "cm-xml-text" },
]);

// Markup the reading level leaves visible, such as tags spanning several lines, stays legible but recedes behind the text.
const MARKUP = [".cm-xml-tag", ".cm-xml-attr", ".cm-xml-value", ".cm-xml-entity", ".cm-xml-meta"];

const theme = EditorView.baseTheme({
  ".cm-xml-tag": { color: "var(--color-blue)" },
  ".cm-xml-attr": { color: "var(--color-text-secondary)" },
  ".cm-xml-value": { color: "var(--color-link)" },
  ".cm-xml-entity": { color: "var(--color-link)" },
  ".cm-xml-meta": { color: "var(--color-text-secondary)", fontStyle: "italic" },
  ".cm-xml-text": { color: "var(--color-text)" },
  ...Object.fromEntries(MARKUP.map((m) => [`&.cm-markup-reading ${m}`, { color: "var(--color-text-secondary)" }])),
  ".cm-tag-marker": {
    display: "inline-block",
    inlineSize: "0",
    blockSize: "1em",
    verticalAlign: "text-bottom",
    borderInlineStart: "1px dotted var(--color-text-muted)",
    marginInlineEnd: "-1px",
  },
  ".cm-entity-persName": { background: "var(--color-persName-bg)" },
  ".cm-entity-placeName": { background: "var(--color-placeName-bg)" },
  ".cm-entity-orgName": { background: "var(--color-orgName-bg)" },
});

const TAGS = new Set(["OpenTag", "CloseTag", "SelfClosingTag"]);
const ENTITIES = new Set(["persName", "placeName", "orgName"]);
const isHidden = (state: EditorState, from: number, to: number) => state.doc.lineAt(from).to >= to;

class TagMarker extends WidgetType {
  eq() { return true; }
  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-tag-marker";
    span.setAttribute("aria-hidden", "true");
    return span;
  }
}
const marker = Decoration.replace({ widget: new TagMarker() });

function readingDecorations(view: EditorView): { hidden: DecorationSet; entities: DecorationSet } {
  const { state } = view;
  const hidden: { from: number; to: number }[] = [];
  const entities: Range<Decoration>[] = [];
  for (const { from, to } of view.visibleRanges) {
    syntaxTree(state).iterate({ from, to, enter: (n) => {
      if (TAGS.has(n.name)) {
        const last = hidden.at(-1);
        if (last && n.from < last.to) return false;
        // Adjacent tags share one marker, so the cursor passes them in one step.
        if (isHidden(state, n.from, n.to)) {
          if (last && last.to === n.from) last.to = n.to;
          else hidden.push({ from: n.from, to: n.to });
        }
        return false;
      }
      if (n.name === "Element") {
        const name = localOf(nameOf(state, n.node));
        const r = ENTITIES.has(name) ? contentOf(n.node) : null;
        if (r) entities.push(Decoration.mark({ class: `cm-entity-${name}` }).range(r.from, r.to));
      }
    } });
  }
  return { hidden: Decoration.set(hidden.map((r) => marker.range(r.from, r.to))), entities: Decoration.set(entities, true) };
}

const reading = ViewPlugin.fromClass(class {
  hidden: DecorationSet;
  entities: DecorationSet;
  constructor(view: EditorView) { ({ hidden: this.hidden, entities: this.entities } = readingDecorations(view)); }
  update(u: ViewUpdate) {
    if (u.docChanged || u.viewportChanged || syntaxTree(u.startState) !== syntaxTree(u.state)
      || u.startState.field(foldState, false) !== u.state.field(foldState, false)) {
      ({ hidden: this.hidden, entities: this.entities } = readingDecorations(u.view));
    }
  }
}, {
  provide: (plugin) => [
    EditorView.decorations.of((view) => view.plugin(plugin)?.entities ?? Decoration.none),
    EditorView.decorations.of((view) => view.plugin(plugin)?.hidden ?? Decoration.none),
    EditorView.atomicRanges.of((view) => view.plugin(plugin)?.hidden ?? Decoration.none),
  ],
});

// Typing or deleting inside a tag the reader cannot see would change markup invisibly, so such a user edit is
// dropped as a whole and the selection stays where it was.
const protectHiddenTags = EditorState.transactionFilter.of((tr) => {
  if (!tr.docChanged || !(tr.isUserEvent("input") || tr.isUserEvent("delete") || tr.isUserEvent("move"))) return tr;
  const state = tr.startState;
  let touches = false;
  tr.changes.iterChangedRanges((fromA, toA) => {
    if (touches) return;
    syntaxTree(state).iterate({ from: fromA, to: toA, enter: (n) => {
      if (touches) return false;
      if (!TAGS.has(n.name)) return;
      touches = fromA < n.to && toA > n.from && isHidden(state, n.from, n.to);
      return false;
    } });
  });
  return touches ? [] : tr;
});

function levelExtension(level: MarkupLevel): Extension {
  if (level === "source") return [];
  return [EditorView.editorAttributes.of({ class: "cm-markup-reading" }), reading, protectHiddenTags];
}

export const markupLevel = new Compartment();

/** Highlighting, theme and the level compartment; include once per editor. */
export function markupLevels(level: MarkupLevel = "source"): Extension {
  return [syntaxHighlighting(markupHighlight), theme, markupLevel.of(levelExtension(level))];
}

export function setMarkupLevel(view: EditorView, level: MarkupLevel): void {
  view.dispatch({ effects: markupLevel.reconfigure(levelExtension(level)) });
}
