# teiCrafter Handoff and Working State

Action-layer snapshot so work can resume without re-deriving anything. This is the one
file that carries session state; conceptual detail lives in `knowledge/` (start at
`INDEX.md`), and the decisions behind it in `knowledge/journal.md`.

## State

Branch `main`, pushed to `origin/main` (operator-authorized 2026-06-13), `origin/main` at
the tip, 0 ahead / 0 behind. The finishing arc and its documentation pass are on the remote;
GitHub Pages redeploys from `/docs`. The recent commits are this lane's Phase 0 floor, Phase 1
frontend gate, landing, Editopia removal, Phase 2 / W3, Phase 3 / W2, the browser-light W7 / W5
slice, the four refactors, and the knowledge/README documentation pass, on top of the prior
editor commits:

- `59ba247`: refresh the Anthropic model catalog (default claude-haiku-4-5, retired IDs
  dropped) and add SECURITY.md, with llm_catalog_check.
- `b9e21fd`: IIIF Presentation manifest resolver (v2/v3 parser), facsimile coordScale, METS
  rejected, with facsimile_resolver_check; the live manifest pre-resolution is deferred.
- `bb20878`: browser-acceptance checks VC-AUTHOR-1..4 (split, merge, insert lb, delete-empty).
- `d35a062`: author-mode structural acts in the reading context menu (split/merge/insert/delete
  through commitStandoff, each re-finding its target by raw outerStart, no node held across the
  re-parse).
- `3c5b78f`: namespace-faithful insertLb (the document's own lb form, no hardcoded `<lb/>`) and a
  DOM-free entity-aware absolute-caret helper, with structural_check (milestone fidelity) and
  author_caret_check.
- `0504c49`: browser-acceptance checks VC-F-1..4 (index, onboarding, draft badge).
- `2b2ac45`: empty-project onboarding and a neutral draft badge in the document strip
  (the standalone draft banner retired; the dead dismiss listener removed so the editor
  boots).
- `9a3d969`: the index panel renders its sections from the document's declared manifest
  indices (read-only non-mappable indices kept visible), with `index_consumer_check.mjs`.
- `a3d13fe`: remove the Editopia name from the repository (knowledge documents,
  evaluation reports, one test comment); history retains the prior wording.
- `193f1f8`: landing page, compact lede, drop the editing-unit badges, true the
  facsimile and validation feature text.
- `f18fdfb`: the popover-race fix committed with an interaction-layer proof
  (`interaction_check.mjs`, the dismissal decision lifted into a pure predicate) and
  `test/acceptance/BROWSER-CHECKS.md`, the named manual floor for the DOM and event
  layer the engine proofs cannot reach.
- `c615518`: relocate the structural-primitives proof into auto-discovery as
  `test/tools/structural_check.mjs` (was `tests/structural.test.mjs`, import depth
  corrected); delete the dead `tests/pipeline.test.mjs`; add a no-build typing seam at
  the engine naht (`jsconfig.json` scoped to `tei-document.js`, JSDoc comments on its
  public exports with no executable change, `types_check.mjs`); ignore `*.stackdump`.
- `cdef4c7` and the three before it: the prior editor work (index overview,
  overlapping and nested annotations, line and paragraph multiline edit).

The remaining working-tree changes are other lanes' uncommitted work, left untouched:
the validation/landing lane (`docs/css/editor.css`, `docs/js/editor/standoff.js`,
`docs/js/editor/validation-view.js`, and the matching live-validation honesty edits in
`knowledge/architecture.md`, `design.md`, `specification.md`) and a test fix in
`test/tools/plaintext_import_check.mjs`. The untracked
`test/tools/model_observations_probe.mjs` is held pending an operator decision.

## Proof state (run 2026-06-13)

`node test/tools/run_all.mjs` discovers 35 proofs, all 35 pass. This lane added
`structural_check.mjs` (the structural-primitives proof, now in the gate, with insertLb
milestone-fidelity assertions), `interaction_check.mjs` (the popover-dismissal invariant as a
pure predicate, 7/7), `types_check.mjs` (the engine typing seam), `index_consumer_check.mjs`
(the manifest-driven index sections), `author_caret_check.mjs` (the entity-aware
caret-to-raw-offset mapping), `facsimile_resolver_check.mjs` (the IIIF Presentation parser and
coordScale, 30 checks), and `llm_catalog_check.mjs` (the model catalog is self-consistent).

`types_check.mjs` now PASSES clean (1/1): refactor `ae9597c` closed the engine's typecheck
under checkJs, including a JSDoc bug where an `@n` tag written inside a property description
had been silently dropping the surface typedef. It runs `tsc --noEmit` (a global `tsc`, else
`npx -y -p typescript tsc`) over `jsconfig.json` and stays a SEAM, not a hard gate: a missing
toolchain (no global tsc, npx offline) or any residual structural-inference diagnostic is
recorded and SKIPped (a SKIP-with-reason counts as a pass), so the offline gate never hard-FAILs.

## Open threads

- Phase 2 / W3 is done and committed (the manifest-driven index panel, empty-project
  onboarding, the draft badge). Remaining in Phase 2 is W4: the validation honesty pass
  (the validation/landing lane is already in it, see handoffs) and on-demand in-browser
  Schematron, gated on an operator decision about vendoring the ISO Schematron XSLT
  (third-party code into the repo) versus a documented subset.
- Phase 3 / W2 author-mode is done and committed (context-menu split/merge/insert-lb/delete-empty
  through commitStandoff, namespace-faithful insertLb, the caret helper). Its browser behavior
  (context menu, caretPositionFromPoint, live split/merge) is operator-gated: VC-AUTHOR-1..4.
- Phase 4 / W7 partial: the IIIF Presentation parser, coordScale and METS rejection are done and
  committed. DEFERRED: the live async manifest pre-resolution on project load (editor-app.js, more
  than a small change), per-page coordScale on showPage, and the corresp range() pointer read
  (standoff.js, lane-owned, blocked).
- W5 catalog refresh and SECURITY.md done; the AI in-text proposals (standoff.js proposeEntitiesInText)
  are blocked on standoff.js (lane-owned).
- Remaining open work, each with a gate: W8 streaming (needs the local WB codex and an operator call
  on whether per-edit latency is felt; the continuous-view size guard is codex-independent), W4
  Schematron (operator decision: vendor the ISO XSLT vs a documented subset), the W4 validation tooltip
  honesty (validation-view.js, lane-owned), and the W3/W2/W7 knowledge-doc updates
  (architecture.md/specification.md, lane-owned).
- The product gate is accumulating unrun browser checks across four integrator rounds (W3 x2, W2, W7):
  VC-1..12, VC-F-1..4, VC-AUTHOR-1..4, VC-RACE-*, VC-2 (facsimile). An operator Chromium pass and the
  validation lane committing its in-flight diff are the two steps that unblock most of the rest.
- Frontend follow-up: the popover-dismiss predicate is now a shared module
  (`interaction-rules.js`, refactor `fe540fa`), imported by both the handler and
  `interaction_check.mjs` so they cannot drift, and `testing.md` now carries a
  Frontend-verification floor section referencing `BROWSER-CHECKS.md`. Still owed: fold the
  interaction-surface map into `architecture.md` (lane-owned, see the documentation debt below).
- The hsa-7711 letter walkthrough end-to-end in the browser is the operator's product gate;
  the procedure is now written as `test/acceptance/BROWSER-CHECKS.md` (VC-HSA), pending the
  operator's dated pass.
- WB-AP4 (Wenzelsbibel) is the next item on the Wenzelsbibel track.

## Handoffs to the validation/landing lane

That lane owns `docs/css/editor.css`, `docs/js/editor/standoff.js`,
`docs/js/editor/validation-view.js` and has uncommitted work in them plus the
live-validation neutral-info-row edits in `knowledge/architecture.md`, `design.md`,
`specification.md`. Three W3 items wait on it (W3 is functionally complete without them):

- editor.css, the read-only index section styling (append after `.ed-idx-add-input:focus`),
  tokens only, no violet:
  ```
  .ed-idx-btn:disabled, .ed-idx-add:disabled { opacity: .5; cursor: not-allowed; }
  .ed-idx-btn:disabled:hover, .ed-idx-add:disabled:hover { border-color: var(--color-border); color: var(--color-text-secondary); }
  .ed-idx-addrow-readonly { align-items: baseline; }
  .ed-idx-readonly-note { font-size: var(--font-size-xs); color: var(--color-text-muted); }
  .ed-idx-section-readonly .ed-idx-heading-label { color: var(--color-text-secondary); }
  ```
- editor.css, the now-dead `.ed-draftbanner` and `.ed-draftbanner-dismiss` rules can be
  deleted: the standalone banner element and its listener are gone.
- The knowledge write for `architecture.md`, `design.md` and `specification.md` is done (see
  Documentation debt, resolved 2026-06-13): the manifest-driven index sections and the rest of
  the arc are recorded, and each document's single uncommitted validation-honesty line was
  preserved and folded in. The W4 validation tooltip honesty (live = well-formed plus lossless;
  deeper TEI RelaxNG and Schematron run offline in the harness today) belongs in the same
  lane's validation-view.js, the remaining code-side item alongside the editor.css rules above.

## Documentation debt (resolved 2026-06-13)

An adversarial doc-coverage audit (five parallel auditors) confirmed the engine and editor code
is committed and pushed. The debt it found in `architecture.md`, `design.md` and `specification.md`
(now-false "not yet wired" statements, missing built features, items mis-framed as "future") is
RESOLVED as of 2026-06-13: the three documents were updated in place to record the author-mode
structure edits, the IIIF Presentation resolver and coordScale, the typing seam, `interaction-rules.js`,
`cellRawOffset`, the manifest-driven index sections, empty-project onboarding, the neutral draft badge
and the dissolved Document panel, and the `llm.js pickModel` fallback. Each lane document carried one
uncommitted validation-honesty line; that line is preserved and folded into the same commit. The
repo-wide `version:` was bumped to 0.16 (`converter-reference.md` keeps its own scheme by design).

## Documentation hygiene (decided 2026-06-13)

A second read-only audit (quantities, cross-document redundancy, non-functional wording) drove a
hygiene pass, applied across the freely-editable documents (`testing.md`, `INDEX.md`,
`integration.md`, `project.md`, `converter-reference.md`, `worked-examples.md`, `curated-set.md`,
`README.md`) and locked into CLAUDE.md:

- **Test and proof counts are out of the knowledge base.** testing.md's proof table shows a
  qualitative result, not N/N; the copies in the glossary, the integration and converter
  references are gone; the run output is the source. Frozen synthetic-fixture word counts stay.
- **Single-ownership for duplicated prose**: the lineage paragraph, the engine reading contract
  and the licence boundary now point to their owner instead of restating it.

Applied to the lane-held documents too (2026-06-13): specification.md dropped the round-trip
count from E.5 and the proof counts from I.3/I.4/I.5 and single-sources the L1/L2/L3 plus
MVP-gate table to testing.md; the undefined-shorthand terms the style rule forbids by name are
gone from architecture.md ("by construction", "first-class") and design.md ("precision
instrument", "scans rather than shouts"); and OpenSeadragon's version is single-sourced to
architecture.md, the pixel/size constants stated qualitatively elsewhere.

## Working model

teiCrafter itself is edited directly. Sibling-repo work (the SZD `<standOff>`/`<name>` schema
extension, ZBZ `<graphic>` emission and the rights answer) goes as orders to `szd-htr` and
`zbz-ocr-tei`, never edited here. Commits are local; no push without word. Research steering
(milestone register, backlog, paper material) lives in the operator's private vault, not in
this repository.

## Shared and held files

- Local-only artifacts, unchanged and gitignored: `docs/data/editor/wb-codex/`,
  `docs/data/editor/zbz-100/`, `docs/data/editor/zbz-1000/`,
  `docs/data/editor/depcha-wheaton/`, `docs/data/editor/hsa-7711/target-reference.xml`,
  `output/curated-set/`.
- Memory, Obsidian vault and sibling repos (szd-htr, zbz-ocr-tei): untouched.
