# teiCrafter Handoff and Working State

Action-layer summary so work can resume without re-deriving anything. Snapshot:
2026-06-10 (evening, continued), end of the editor-surface session (welcome
screen dissolved, pane layout flexibility, line-number gutter, text zoom,
XML-source find/replace, selection fix). Replaces the previous 2026-06-10
project-layer snapshot. Conceptual detail lives in `knowledge/` (start at
`INDEX.md`); per-milestone evaluation reports live in `reports/`.

## Frame: what this lane is working on

The Editopia contribution (Pollin / Kreyenbuehl, "Agentenbasierte Editionsworkflows
und epistemische Infrastrukturen", conference 02. to 04.09.2026, Wuppertal).
Cross-project master plan, zbz-lane order, concept chapter draft, full-text
Rohfassung and the M7.1 provenance page live in the Obsidian vault; session plan
documents in `~/.claude/plans/editopia-*.md`; the repo-side milestone register is
`knowledge/goals.md` (H1 to H7); the full plan and backlog is `PLAN.md` (German).
Success criterion for the Editopia experiment (operator, 2026-06-09): demonstrable
added value for the Hersch project, confirmed by the ZBZ. The Wenzelsbibel
(PLUS Salzburg, autumn 2026) is the primary own use case beyond Editopia.

## State at handoff (engine-proven, local only)

Branch `session/2026-06-07-place-graphic`, clean working tree, no stash,
**73 commits over `main`**, **51 ahead of `origin`** (pushing requires the
operator's word). Git anchor: HEAD `9c4ec20`.

Since the last handoff snapshot (`6afc983`), five commits on two threads: a
loadable DEPCHA account-ledger project (`8d00dc2`), the landing revision plus a
large-document loading overlay and a synthetic ZBZ fallback (`8beb302`,
`37d6714`), and this conversation's editor-surface work (`b43a6b4`, plus a doc
tweak `9c4ec20`).

This conversation (editor surface, `b43a6b4` + `9c4ec20`):

- **Welcome screen dissolved.** The editor opens directly on its empty two-pane
  layout; the text pane carries a lean load prompt and the recent files, the
  document toolbar group and view controls stay hidden until a load. The public
  landing page is unaffected.
- **Reading-text gutter.** The edition's line label (`@n`) sits in a fixed,
  right-aligned mono channel with a continuous rule, non-selectable, like a code
  editor's gutter; the numbering stays the source's (an unnumbered line shows an
  empty cell, repeats and restarts stand), not a running count.
- **XML source.** A translucent selection token (`--color-selection`) so the
  coloured overlay text shows through a selection (the opaque highlight had
  hidden it); find / replace and go-to-line (Ctrl/Cmd+F); no reformat button
  (it would break byte fidelity).
- **Layout flexibility.** Editor-wide text zoom (global); a draggable splitter
  (min 320px per pane, double-click reset, keyboard); context-pane collapse
  (header button or Ctrl/Cmd+backslash); a vertical stack below 900px. Split
  position, collapsed state and the active context tab persist per document,
  the zoom globally, through `storage.js` (localStorage); no second store.
- **Bundled, not authored by this lane:** `docs/js/editor/facsimile.js` carries
  a zones-toggle change (zone overlays hidden by default, revealed on hover or a
  "Zones" button) that pre-existed in the working tree; it was committed with
  the rest on the operator's "commit everything".
- Knowledge docs updated (architecture, design, specification, journal, INDEX);
  repo version 0.9 to 0.10.
- Proofs green at handoff: highlight 18/18, editor roundtrip 13/13, generic
  roundtrip 34/34, edit-fidelity 21/21, project-manifest 45/45; both edited JS
  modules pass a syntax check.

## Decisions this conversation (dated, with reasons; journal carries the long form)

1. **No welcome screen** (2026-06-10): landing in the empty editor is the more
   direct truth than an intermediate page; the tool's pitch and example projects
   live on the landing page, not here.
2. **The gutter shows the edition's own `@n`**, not an editor-invented count:
   unnumbered lines stay empty, repeats and restarts stand.
3. **Markup quick-actions were NOT duplicated** as a source-view bar: applying
   markup already lives in the reading view's selection-to-annotate flow.
4. **No pretty-print / reformat action**: re-indenting would break the
   byte-faithful core.
5. **Responsive case is a vertical stack, not pane-level tabs** (the one
   deviation from the PLAN.md wording, surfaced to the operator): a third tab
   level over the view and panel tabs would confuse on a desktop-oriented tool.
6. **Layout persistence reuses `storage.js`** keyed per document; zoom is a
   global preference. No parallel store (the layout work order said coordinate,
   not duplicate).

## Open threads (none lost, all registered)

- **Operator browser sight-check of this session's surfaces:** the empty editor
  with recents; gutter alignment under zoom; the XML-source selection now
  visible; find / replace / go-to-line; the splitter (drag, double-click reset,
  keyboard); collapse (button and Ctrl/Cmd+backslash); the vertical stack below
  900px; and that split / collapsed / active-tab survive a reload (the PLAN.md
  acceptance criterion). One thing to watch: OpenSeadragon re-sizing when the
  context pane returns from collapsed (auto-resize should cover it; verify).
- **Push approval** for the local commits (now 51 ahead of `origin`).
- Carried over and still open: the M2.9 project-layer acceptance case in a
  browser; Wenzelsbibel packages (F4 dual reading is the next implementable
  item, then WB-AP4 standOff apparatus, ED.1 to ED.7, WB-AP5 PAGE-XML import);
  manifest consumers (declared `indices`, `views`, `schema`); sibling-lane
  orders (szd-htr converter empty-page guard; zbz four-point order); the
  TEI-Guidelines feature decision; M7.4 object sign-off; Editopia chapter draft,
  Rohfassung, provenance page, Kreyenbuehl package.
- Pre-existing: the ZBZ example is local-only (rights) and fails with a status
  message on public Pages.

## The one next step

The operator verifies this session's editor surfaces in his browser (the
checklist above, especially that the per-document layout survives a reload);
then either his feedback round or the next Wenzelsbibel package (F4 dual
reading is the plan's next implementable item).

## Shared and held files

- This repo: every change is this lane's own except
  `docs/js/editor/facsimile.js` (the zones-toggle change pre-existed in the
  working tree, authored outside this conversation; bundled into `b43a6b4` on
  the operator's "commit everything"). Clean at handoff, nothing uncommitted,
  no stash.
- Memory (`~/.claude/projects/...teiCrafter/memory/`): untouched this
  conversation.
- Obsidian vault and sibling repos (szd-htr, zbz-ocr-tei): untouched.
- Local-only artifacts unchanged: `docs/data/editor/wb-codex/` (real codex),
  `docs/data/editor/zbz-100/`, `docs/data/editor/zbz-1000/`,
  `docs/data/editor/depcha-wheaton/` (rights-encumbered, regenerable),
  `output/curated-set/`.
