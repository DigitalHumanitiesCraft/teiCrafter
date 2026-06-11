# teiCrafter Handoff and Working State

Action-layer summary so work can resume without re-deriving anything. Snapshot:
2026-06-11, end of the F4 dual-reading session (engine + UI landed, then this
documentation sync). Replaces the previous 2026-06-10 editor-surface snapshot.
Conceptual detail lives in `knowledge/` (start at `INDEX.md`); per-milestone
evaluation reports live in `reports/`.

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

Branch `session/2026-06-07-place-graphic`, clean working tree expected once this
documentation commit lands, no stash, **93 commits over `main`**, **3 ahead of
`origin`** (origin was up to date with `dfc8a81` this morning; pushing still
requires the operator's word).

What landed today (F4 dual reading), in the orchestrator / Opus-package working
model (the main lane cut the work into two fully specified packages on disjoint
file sets, delegated each to an Opus sub-agent, and accepted each against the
running proofs and the raw git diff):

- **Engine (`ae0b6f5`).** `tei-document.js` gained `editTextAndAttrs(doc, el,
  { text, set })`, the atomic multi-part edit (text content plus attribute
  set/replace/remove of one element, all splices against the raw string, applied
  descending, ONE re-parse; exact-qname resolution; per-part semantic no-op
  guards; any invalid or unrepresentable part refuses the WHOLE op, returning the
  SAME doc). `edition.js` projects per text cell `w: { el, orig, norm }` and a
  `hasDualReadings` flag; `editCellReadings(state, cellId, { core, norm })` edits
  the diplomatic core (edge whitespace preserved, `@orig` kept in sync where it
  exists, never invented) and `@norm` (undefined untouched, non-empty sets, `""`
  removes), atomically. New synthetic fixture
  `test/fixtures-synthetic/wb-dual-reading.xml`, new proof
  `test/tools/dual_reading_check.mjs` (28/28).
- **UI (`1ef4bfe`).** A segmented control "Diplomatic" / "Normalized" in the
  reading-pane header, shown only on a dual-reading document outside source mode
  (hidden, not disabled, otherwise), the choice persisted per document through
  the existing layout store. The normalized view is a display projection (a word
  shows `@norm` where present, the written text otherwise; the tooltip names the
  other reading). A double-click on a word whose text sits directly in its `<w>`
  opens a two-field Diplomatic/Normalized inline edit committing atomically
  through `editCellReadings`; a word wrapped in critical markup keeps the
  single-field text edit (the atomic op refuses element children).
  Selection-to-annotate is gated off in the normalized view with the status hint
  "Select in the diplomatic view to annotate." and the context menu drops its
  selection-derived entry there; word-anchored actions stay.
- **This documentation sync (this commit).** Knowledge docs updated
  (architecture, specification, design, testing, goals, journal, INDEX, data),
  repo version 0.11 to 0.12 across all knowledge docs (converter-reference keeps
  its own 0.6.1); PLAN.md item 5 marked done.

Proofs green: the regression gate (`node test/tools/run_all.mjs`) discovers 25
proof scripts, all green; `dual_reading_check.mjs` 28/28 (its real-codex guard
runs when the local codex is present and skips silently otherwise).

## Decisions this conversation (dated, with reasons; journal carries the long form)

1. **The dual edit is atomic in one re-parse** (2026-06-11): refusal over partial
   application, so a half-applied word edit cannot exist.
2. **`@orig` mirrors the canonical diplomatic content where the source encodes it,
   never invented where absent** (2026-06-11): the content is the canonical
   reading, a silent divergence would be a hidden inconsistency, and an absent
   `@orig` is information about the source.
3. **An empty Normalized field removes `@norm`** (2026-06-11): an `@norm=""` would
   claim a normalization, absence claims nothing.
4. **The normalized view is a display projection, not a second document state**
   (2026-06-11): selection annotation stays in the diplomatic view because the
   displayed text does not map to raw offsets, while the double-click edit works
   in both views because it anchors on the element, not on offsets.
5. **Working model this session** (2026-06-11): the orchestrator cut the work into
   two fully specified packages on disjoint file sets, delegated each to an Opus
   sub-agent, and accepted each against the running proofs and the raw git diff;
   acceptance added one hardening (an undefined diplomatic core leaves content and
   `@orig` untouched) and the proof case locking it. Lesson: the package boundary
   that worked was the engine-proof seam, and the acceptance review is the
   orchestrator's own substantive work, not a formality.

## Open threads (none lost, all registered)

- **Operator browser sight-check**, now extended by the dual-reading surfaces:
  the Diplomatic/Normalized switcher on the real codex, the two-field edit, and
  the normalized-view annotation hint. Carried over from the prior handoff: the
  empty editor with recents; gutter alignment under zoom; the XML-source
  selection visibility; find / replace / go-to-line; the splitter (drag,
  double-click reset, keyboard); collapse (button and Ctrl/Cmd+backslash); the
  vertical stack below 900px; and that split / collapsed / active-tab survive a
  reload (the PLAN.md acceptance criterion). One thing to watch: OpenSeadragon
  re-sizing when the context pane returns from collapsed.
- **The M2.9 project-layer acceptance case in a browser** (one own project, one
  TEI, two plaintexts, edit all three).
- **Push approval** for the local commits (now 3 ahead of `origin`).
- Carried over and still open: Wenzelsbibel next packages, with **WB-AP4
  standOff apparatus** the next implementable item now that F4 is built (then
  ED.1 to ED.7, WB-AP5 PAGE-XML import); manifest consumers (declared `indices`,
  `views`, `schema`: the F4 switcher binds to the document's encoding, so the
  declared views still await a consumer); sibling-lane orders (szd-htr converter empty-page
  guard; zbz four-point order); the TEI-Guidelines feature decision; M7.4 object
  sign-off; Editopia chapter draft, Rohfassung, provenance page, Kreyenbuehl
  package.
- Pre-existing: the ZBZ example is local-only (rights) and fails with a status
  message on public Pages.

## The one next step

The operator verifies this session's dual-reading surfaces in his browser (the
switcher on the real codex, the two-field edit, the normalized-view annotation
hint, alongside the carried-over editor-surface checklist); then the next
Wenzelsbibel package, WB-AP4 standOff apparatus.

## Shared and held files

- This repo: every change is this lane's own. Clean at handoff once the
  documentation commit lands, nothing else uncommitted, no stash.
- Memory (`~/.claude/projects/...teiCrafter/memory/`): untouched this
  conversation.
- Obsidian vault and sibling repos (szd-htr, zbz-ocr-tei): untouched.
- Local-only artifacts unchanged: `docs/data/editor/wb-codex/` (real codex),
  `docs/data/editor/zbz-100/`, `docs/data/editor/zbz-1000/`,
  `docs/data/editor/depcha-wheaton/` (rights-encumbered, regenerable),
  `output/curated-set/`.
