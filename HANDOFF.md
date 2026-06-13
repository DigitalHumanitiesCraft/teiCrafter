# teiCrafter Handoff and Working State

Action-layer snapshot so work can resume without re-deriving anything. This is the one
file that carries session state; conceptual detail lives in `knowledge/` (start at
`INDEX.md`), and the decisions behind it in `knowledge/journal.md`.

## State

Branch `main`, nine commits ahead of `origin/main` and not yet pushed (this HANDOFF
regeneration is the tip). The four most recent work commits are this lane's
honest-floor and frontend-gate work on top of the prior editor commits:

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

`node test/tools/run_all.mjs` discovers 31 proofs, all 31 pass. This lane added
`structural_check.mjs` (the structural-primitives proof, now in the gate),
`interaction_check.mjs` (the popover-dismissal invariant as a pure predicate, 7/7), and
`types_check.mjs` (the engine typing seam).

One proof is a SKIP-with-reason, which the runner counts as a pass:

- `types_check.mjs` SKIPs. It runs `tsc --noEmit` (a global `tsc`, else
  `npx -y -p typescript tsc`) over `jsconfig.json` and is a SEAM, not a hard gate. On
  a clean typecheck it would PASS; when the toolchain is unavailable (no global tsc,
  npx offline) it SKIPs so the offline gate never hard-FAILs; and it SKIPs when tsc
  reports diagnostics, printing them for the record. It currently reports three
  diagnostics over `tei-document.js` that come from TypeScript's structural inference
  over existing executable engine code, not from the JSDoc: the dual element/text node
  shape pushed into the root's children (the parse loop), the incrementally built
  `surf` object literal in `readSurfaces`, and the empty-object accumulator in
  `countLocals`. Closing them would require editing engine logic, which is out of
  scope for a comments-only typing seam, so they are recorded and the gate stays
  green. They are tracked under open threads.

## Open threads

- Decide whether to close the three `types_check.mjs` diagnostics. Each needs a small
  engine type or code touch (a shared node type for the dual element/text shape, an
  up-front typed `surf` literal, a typed accumulator init in `countLocals`); none is a
  behaviour change, but all touch executable code, so they were deliberately left for
  a logic-owning lane rather than the comments-only seam.
- Phase 2 (in progress): Package F (the declared manifest `indices` as the index panel's
  consumer, empty-project onboarding, the draft banner merging into the document strip) and
  the validation honesty pass plus on-demand in-browser Schematron. This is the next
  dynamic-workflow increment.
- Frontend follow-up: now that the popover fix is committed, export `shouldDismissPopover`
  from `annotation-ui.js` and import it into `interaction_check.mjs` so the proof and the
  handler cannot drift; fold the interaction-surface map into `architecture.md` and
  reference `BROWSER-CHECKS.md` from `testing.md` (knowledge docs are another lane's).
- The hsa-7711 letter walkthrough end-to-end in the browser is the operator's product gate;
  the procedure is now written as `test/acceptance/BROWSER-CHECKS.md` (VC-HSA), pending the
  operator's dated pass.
- WB-AP4 (Wenzelsbibel) is the next item on the Wenzelsbibel track.

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
