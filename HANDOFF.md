# teiCrafter Handoff and Working State

Action-layer summary so work can resume without re-deriving anything. Snapshot:
2026-06-12, end of a documentation and language session (PLAN.md translated to
English, knowledge/ refactored, English commit rule set). The product state, the
open gates and the one next step are unchanged from the HSA-letter feedback session
that precedes it (recorded below). Conceptual detail lives in `knowledge/` (start at
`INDEX.md`); per-milestone evaluation reports live in `reports/`.

## This session (documentation and language)

Local commit `eda7c90` on `main`, NOT pushed (one ahead of origin):
- **PLAN.md is now English.** Full translation, structure 1:1; the former
  "deliberately German" header rationale is dropped. With knowledge/ already
  English, the repo documentation is now English throughout. CLAUDE.md gained one
  line mandating English commit messages for this repo (local override of the
  global German default); `eda7c90` is the first commit under it.
- **knowledge/ refactoring (same truth, better structure).** integration.md
  section 3 de-staled: the pre-M2.13 module list, the duplicated layer signatures
  and the raw hex values became references into architecture.md and design.md (64
  lines leaner). Two verified proof drifts fixed in goals.md (project_manifest_check
  62 to 81, converter-reference v0.5 to v0.6.1, both checked against the running
  proof and the frontmatter). attr_edit_check.mjs added as a proof row in testing.md
  (46/46). The missing topics field added to INDEX.md and journal.md. version stays
  0.14 repo-wide (maintenance, no new knowledge, so no bump).
- **Deliberately left for the operator:** the multiply-stated LLM-flag status and
  the threefold lossless definition (redundancy, not staleness; the Promptotyping
  docs are intentionally self-supporting per function), and converter-reference.md's
  line-anchored code references (SZD lane, own version).

**Parallel lane in the working tree, do NOT commit:** `docs/css/editor.css`,
`docs/css/style.css` and `docs/editor.html` carry another lane's CSS refactoring (a
global `[hidden] { display: none !important }` guard replacing per-component
overrides, a shared form-control surface, dropped redundant classes and dated
comments). Left uncommitted and untouched here; that lane owns those three files.

## Frame: what this lane is working on

The Editopia contribution (Pollin / Kreyenbuehl, "Agentenbasierte Editionsworkflows
und epistemische Infrastrukturen", conference 02. to 04.09.2026, Wuppertal).
Cross-project master plan, zbz-lane order, concept chapter draft, full-text
Rohfassung and the M7.1 provenance page live in the Obsidian vault; the repo-side
milestone register is `knowledge/goals.md` (H1 to H7); the full plan and backlog
is `PLAN.md` (German, slimmed to registers in v0.8). Success criterion for the
Editopia experiment (operator, 2026-06-09): demonstrable added value for the
Hersch project, confirmed by the ZBZ. The Wenzelsbibel (PLUS Salzburg, autumn
2026) is the primary own use case beyond Editopia.

## State after the HSA session (the product baseline this session did not change)

Branch `main`, then a clean working tree in sync with `origin/main`
(pushed 2026-06-12 with the operator's approval, `ae9303e..df19321`); this session
added the local `eda7c90` on top, so `main` is now one ahead of origin.
The session's commits, in order: the session branch had already been merged
before this session started; then `3147529` (engine: `|N|` page markers + the
hsa-7711 demo project), `bad70d3` (draft-recovery core + proof), `317293d`
(the bundled editor surfaces of four packages), `e2861d5` (document-facts
extraction), `efb8cbb` (PLAN v0.8), the v0.13 documentation commit, and
`df19321` (the operator-approved README rewrite).

What landed today (operator feedback session at a real letter, Hugo Schuchardt
Archiv 7711; orchestrator / Opus-package working model, each package accepted
against the raw diff and the proof gate):

- **Examples are local-development surfaces.** Landing cards, "Try an example",
  the Load... menu entries and the `#example` deep link show only on local hosts
  (`FEATURES.examples`); the public Pages deployment hides them. UI gating only.
- **Plaintext is a first-class entry.** `.txt`/`.md` open directly (picker with
  one combined filter, input fallback, drop) as the deterministic line-level
  draft; `|N|` tokens resolve to `<pb n="N"/>` at ingest (the conventions table
  and the transport-only boundary rule are in `knowledge/data.md`). A neutral
  banner and the status line state the provenance.
- **Document identity moved to the document.** The name left the site header for
  a document strip under the toolbar plus a Document context panel (file, source,
  project, type, unit, counts, save target); image-less documents open on it.
- **Draft recovery.** An unsaved draft persists into a localStorage slot and the
  empty editor offers Restore/Discard after a reload; nothing clears the slot
  silently (acceptance hardening: only the draft's own save or explicit discard).
- **Reconciliation at the annotation.** The authority candidate picker is shared
  (`authority-picker.js`) and reachable in the annotation popover; the manifest
  field `reconciliation` (registers, `auto`) opts a project into auto-querying,
  default off, applying always by human click.
- **Popover redesign.** The selection popover is one flat filterable list
  (Entities, Markup, Criticism, Note); a manifest wrap may declare an `attrField`
  so `<date>` plus `@when` commit as one step; scholarly inline wraps render with
  a dotted underline and an attribute tooltip.
- **Refactor.** The document surfaces were extracted into `document-facts.js`
  (factory, ctx contract, behavior-preserving).

Proofs green: `node test/tools/run_all.mjs` discovers 27 proof scripts, 25 pass;
the 2 failures (`hersch_loadability`, `port_parity`) are pre-existing and
environmental (sibling checkouts absent on this machine).

## Decisions this session

All dated and reasoned in `knowledge/journal.md` (2026-06-12 entry) and
`knowledge/specification.md` (Key Decisions): examples local-only; plaintext
direct with the transport-only convention boundary; no pre-load configuration
dialog (rejected); document identity at the document; no silent draft loss;
reconciliation auto only by project opt-in; `attrField`; the TypeScript question
recorded as JSDoc-plus-`tsc --noEmit` recommendation (Open Questions, not
commissioned).

## Open threads (none lost, all registered)

- **Package F, specified and queued** (specification.md, Future): the declared
  manifest `indices` as the index panel's consumer ("Add index..." writes the
  declaration, empty panel without declarations, per-index registers feeding
  reconciliation); empty-project onboarding (always switch to the Project panel,
  "New plaintext...", drop-adoption into the open folder); the draft banner
  merging into the strip as a Draft badge; the strip click returning the left
  pane to the reading view (diagnosis: a persisted XML-source view next to the
  Document panel read as "the panel shows XML"); a clearer collapse control
  (the ⇥ toggle sits unrecognized in the zoom group).
- **The next gate before any new surface work (operator agreement): the letter
  walkthrough end-to-end in the browser.** Open the hsa-7711 project folder,
  draft, annotate Wien as place with Wikidata Q1741 via the popover find,
  wrap "14/2 79" as Date with `when="1879-02-14"` through the attrField input,
  save into the folder, reopen, verify the diff is exactly the intention. This
  doubles as the third worked example (worked-example-hsa.md, registered idea).
- **Live Playwright capture at F acceptance:** the browser-check agent was
  sandbox-blocked on `C:\tmp`; rerun with artifacts under an allowed directory
  (e.g. `GitHub/tc-browsercheck`). Static analysis already answered today's
  panel questions.
- Carried over from the F4 handoff, unchanged: the operator sight-check of the
  dual-reading surfaces on the real codex; the M2.9 project-layer acceptance
  case in a browser; Wenzelsbibel next packages with **WB-AP4 standOff
  apparatus** next (then ED.1 to ED.7, WB-AP5 PAGE-XML import after the data
  model decision); manifest `views`/`schema` consumers; sibling-lane orders
  (szd-htr empty-page guard; zbz four-point order); M7.4 object sign-off;
  Editopia chapter draft, Rohfassung, provenance page, Kreyenbuehl package.
- Pre-existing: the ZBZ example is local-only (rights); with the example
  surfaces now hidden publicly, the public-Pages fallback question is moot.
- **Registered ideas from the coOCR-HTR comparison** (Opus analysis 2026-06-12,
  against the live repo, ranked by value/effort; none commissioned): (1) a
  keyboard jump to the next critical/uncertain spot in the reading text (small;
  builds on the existing keyboard base; coOCR's data-line click-to-line is the
  pattern, its own keyboard story is weaker than ours); (2) activate the
  existing categorical confidence tokens (--color-confident/review/problem) at
  mentions once a confidence producer exists (on-ramp or auto-reconciliation;
  coOCR's category-to-status mapping is the blueprint); (3) a service worker
  for an offline-capable app shell (medium; cache-first shell, network-only
  lookups, coOCR proves it no-build-step); (4) a read-only plaintext/Markdown
  export of the current folio (small; a projection, never a save path);
  (5) i18n DE/EN as externalized strings (medium; collides with the CLAUDE.md
  English rule, only if a German-speaking user test shows friction). Plus: a
  SECURITY.md counterpart becomes relevant when the LLM on-ramp goes live.
  Discarded as out-of-domain: batch queues, per-page review flags, multi-page
  ZIP/PAGE-XML export.

## The one next step

The operator walks the HSA letter end-to-end in the browser (the gate above);
then Package F.

## Shared and held files

- This repo: every change is this lane's own. Clean at handoff once the
  documentation commit lands, nothing else uncommitted, no stash.
- Memory (`~/.claude/projects/...teiCrafter/memory/`): untouched this session.
- Obsidian vault and sibling repos (szd-htr, zbz-ocr-tei): untouched.
- Local-only artifacts unchanged: `docs/data/editor/wb-codex/` (real codex),
  `docs/data/editor/zbz-100/`, `docs/data/editor/zbz-1000/`,
  `docs/data/editor/depcha-wheaton/` (rights-encumbered, regenerable),
  `docs/data/editor/hsa-7711/target-reference.xml` (edition apparatus),
  `output/curated-set/`.
