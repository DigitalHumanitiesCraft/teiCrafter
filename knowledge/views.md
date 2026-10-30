---
title: Views of the source-first editor
project:
  name: teiCrafter
  repository: https://github.com/DigitalHumanitiesCraft/teiCrafter
method:
  name: Promptotyping
  url: https://lisa.gerda-henkel-stiftung.de/digitale_geschichte_pollin
template:
  name: Vorlage Design
  version: 0.1
  url: https://dhcraft.org/Promptotyping/promptotyping-document/design
status: complete
created: 2026-10-30
updated: 2026-10-30
language: en
topics: ["[[TEI XML]]", "[[Human-Computer Interaction]]", "[[Scholar-Centered Design]]"]
related: [specification, architecture, design, plan, testing, journal]
---

# Views of the source-first editor

This document owns the view model of the source-first editor under `src/`: which surfaces present one TEI document, which comparison chose them, on what evidence, and which parts of the compared prototypes carry into the product. The requirements stay in the [specification](specification.md#source-work), the module map in [architecture](architecture.md#source-first-core-under-src), the visual rules in [design](design.md) and the order of the remaining work in the [plan](plan.md#rebuild-phase).

## View model

One document has one canonical raw string and one CodeMirror `EditorState`. Every view of the document is a presentation of that state, so cursor, folds, selection and undo history survive a change of view, and no view holds a copy of the text that would have to be spliced back.

```text
raw string (canonical, CRLF and BOM preserved)
  -> EditorState (lineSeparator of the file, history, folds, proposals)
       |- source level   full XML with highlighting, folding, element path, problem gutter
       |- text level     the same state with markup hidden by decorations,
       |                 serif reading typography, entity colours, block layout
       '- focus          folding everything outside one outline unit, not a second editor
```

- The source level is the primary surface. It is prototype A's editor: the whole document in one view with structural folding, the element path, the format comparison and the proposal widget.
- The text level hides markup on the same state. It extends the reading level of `src/editor/markup-levels.ts` with the reading typography of prototype C and the entity resolution in `src/core/element-facts.ts`. An edit typed at the text level is an ordinary transaction, so Undo, saved state and proposals behave as at the source level.
- Focus on a part of the document is an outline (`src/core/outline.ts`) beside the editor and a fold of everything outside the chosen unit, as specification S.9 requires. Prototype B's slice editor is not carried over, because a second state for a slice loses the history of the first.

## Comparison and criteria

Three viewer prototypes were built on the shared `src/` modules and evaluated in Chromium on 2026-10-30, against the Hersch and SZD samples, the depcha Wheaton account book (787 KB) and the real Wenzelsbibel codex (82 MB), by scripted browser runs with screenshots. The prototypes were:

- A, source editor with structural folding: the whole document in one CodeMirror view.
- B, focused source editing: an outline beside an editor that held only the chosen unit's slice of the raw string and spliced edits back.
- C, hybrid text view: the document rendered from the offset tree as serif text with every element as an inline mark, and an inline CodeMirror editor for one element's exact source.

The criteria, in order of weight, were the source fidelity requirements of the [specification](specification.md#source-fidelity) (byte fidelity including BOM and CRLF, F.5 typing fidelity, F.7 one undo history per session, F.8 external-change check), performance on real large documents, the reading quality of the text, keyboard operation, and the cost of carrying the interaction into the product.

| Criterion | A, source editor | B, focused slices | C, hybrid text view |
| --- | --- | --- | --- |
| Byte fidelity, BOM and CRLF | No-op and local-edit round trips identical | No-op identical | No-op identical |
| Undo (F.7) | One history, including Accept of a proposal; the history keys act only on the editor, so redo with Ctrl+Y does nothing while focus is on a toolbar button | History lost at every change of unit; ten undos after a unit switch leave the edit in place | No undo after Apply; history exists only inside the open inline editor |
| Load and typing | Wheaton loads in 259 ms; the codex loads in 6.8 s; keystroke to frame 12 to 19 ms | An open-time byte-fidelity self-test makes Wheaton take 8.5 s and the codex not finish | Wheaton loads in 573 ms and each Apply re-renders the whole document in 653 ms; the codex loads in 31 s |
| Default folds | Fail on the codex, because `foldStructure` gives the parser a 2000 ms budget that the codex exceeds | Not applicable | Header and apparatus collapse to a summary row |
| Slices and caret | Not applicable | Slices start without their first-line indentation; text typed at the start of a unit lands before its `pb` | Click-to-caret is exact, entity references count as one character |
| Reading | Code view; the reading level hides single-line tags | Code view of one unit | Reads best: serif flow, page layout from block elements, entity backgrounds |
| Word-level TEI | Readable as source | Readable as source | The Wenzelsbibel words run together without spaces and the marks form walls |
| Keyboard | Ordinary editor keys, element path as buttons | Outline tree keys, Alt+Up, Alt+Left, Alt+Right | One tab stop into the document, arrow keys between marks, Enter opens the source, Escape returns |
| Navigation to errors | Problem gutter and status line | A "Go to line" link refocuses on the unit holding an error outside the focus | Apply is refused with the element-relative line |
| Save path | Own save path without the F.8 external-change check | `src/io/open-save.ts` with the check | `src/io/open-save.ts` with the check |
| Proposal | Widget below the target line; scrolling it shifts the editor horizontally | None | None |

All three shared three findings:

- Automatic closing tags of the XML language package broke F.5 in each prototype. Typing `<del>` inserted `<del></del>`, and the SZD correction task of marking a deletion and a person name produced a document that was not well-formed or, in C, an Apply that was refused. `src/editor/xml-editor.ts` now switches the feature off.
- None had a dark colour scheme.
- None could create a document from plain text, so use case one of the specification was not exercised.

## Decision and reasons

The operator decided on 2026-10-30 for A as the source view plus a hidden-markup text level on the same `EditorState`, and for removing the prototypes once their knowledge is in this base. The reasons:

- A is the only prototype that meets F.7 and keeps one history across proposals, formatting and view changes, because everything is one state. B and C fail F.7 because each holds its edits in a second, short-lived editor state, and repairing that would mean rebuilding them on one state, which is A.
- A scales to the real codex in load and typing. B's open-time self-test and C's full re-render do not, and C's cost is inherent to rendering the whole tree as DOM.
- C's reading quality is the strongest finding of the comparison, and a text level that hides markup by decoration on A's state carries it over without C's undo loss and re-render cost.
- B's navigation value lies in the outline and in reaching errors outside the visible part, which work as well with folding on one state.

## What carries over

Moved into `src/` with tests in `test/core/outline.test.mjs`:

- `src/core/well-formed.ts` returns the parser's error description as `reason`, extracted by `wellFormedReason` from the Chromium and Firefox framings that A, B and C each duplicated.
- `src/core/outline.ts` holds B's `buildOutline`, `childUnits` and `elementLabel`, and `unitAt` in place of B's `deepestAt`.
- `src/core/element-facts.ts` holds C's `ENTITY_BY_KIND`, `entityOf`, `summaryOf` and an `idIndex` in place of C's `collectIds`, where the first element with an identifier wins rather than the last.

Recorded for the build of the editor shell in the [plan](plan.md#rebuild-phase), with their prototype source:

- From A (`prototypes/a-code/a-code.ts`): the problem gutter (`setProblem`, `problemLine`, `problemMarker`, `problemExtensions`), the proposal state and widget (`setPending`, `addAccepted`, `proposals`, `ProposalWidget`), `applyCanonical` as the minimal change from a core result, `openFormatDialog` and `confirmDiscard` with their dialogs in `prototypes/a-code/index.html`.
- From B (`prototypes/b-focus/b-focus.ts`): the outline tree rendering and keys (`visibleUnits`, `treeItem`, `renderTree`, `moveTreeFocus`, `activate`), and the "Go to line" link of `analyse` with `goToLine`.
- From C (`prototypes/c-hybrid/c-hybrid.ts`): `caretOffset` for mapping a click in decoded text to a raw offset, the keyboard model of one tab stop with arrow keys between marks (`items`, `focusItem`, `focusMarkAt` and the `keydown` handler on the document), and the reading typography in `prototypes/c-hybrid/c-hybrid.css`.

The prototypes are removed from the working tree. Their source, check scripts, screenshots and READMEs remain in Git at revision `9ae6534`, the last commit containing `prototypes/`, for example `git show 9ae6534:prototypes/a-code/a-code.ts`. The scripted evaluation runs and their screenshots were session-local and are not in the repository; the figures above are their recorded results.
