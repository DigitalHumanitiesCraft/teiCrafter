# teiCrafter Handoff and Working State

Action-layer snapshot so work can resume without re-deriving anything. This is the one
file that carries session state; conceptual detail lives in `knowledge/` (start at
`INDEX.md`), and the decisions behind it in `knowledge/journal.md`.

## State

Branch `main` at commit `c56c0ee`, in sync with `origin/main`, plus an uncommitted
knowledge-base consolidation in the working tree (commit pending). The product itself was
not changed in the consolidation; only documentation was. The three newest product commits
are absorbed into the knowledge documents:

- `c56c0ee`: author-mode structural primitives in the engine (`structural.js`,
  split/merge/insertLb/delete, not yet UI-wired), the line model's `el`/`kind` fields, and
  the plaintext `<lb/>`-as-separator convention (the break BETWEEN lines, the first
  paragraph line bare).
- `4a6056d`: the relevance-led annotate popover, the XML error-line marker, index polish,
  and the Document panel removed (the toolbar document strip is the one identity surface).
- `1f076b0`: the text+image on-ramp ("New from text and images"), the paged/continuous
  reading toggle, splitter-collapse, and entity retype.

The consolidation: user stories merged into `specification.md` (Acceptance Scenarios), the
two worked examples into `worked-examples.md`, the Promptotyping case slimmed to a case
description and provenance pointers, `PLAN.md` deleted, and the new Ist-Status rule applied
(knowledge docs describe the current state only; history lives in the journal and git).

## Proof state (run 2026-06-12)

`node test/tools/run_all.mjs` discovers 27 proofs, 26 pass. The one failure,
`plaintext_import_check.mjs`, is stale, not a product regression: it still asserts the
pre-`c56c0ee` leading-`<lb/>` shape, while the product now writes `<lb/>` as the separator
between lines with the first paragraph line bare. The product is correct; the proof needs
updating to the new convention.

## Open threads

- Update `plaintext_import_check.mjs` to the between-lines convention (first paragraph line
  bare, `<lb/>` separating the lines of a paragraph).
- `tests/structural.test.mjs` (the structural-primitives proof) and `tests/pipeline.test.mjs`
  sit outside the `test/tools/` discovery that `run_all.mjs` walks; bring structural into the
  harness and remove the dead `tests/pipeline.test.mjs` (it imports a deleted
  `docs/js/pipeline/utils.js` and crashes on import).
- Package F: the declared manifest `indices` as the index panel's consumer, empty-project
  onboarding, and the draft banner merging into the document strip
  (`knowledge/specification.md`, Future).
- WB-AP4 (Wenzelsbibel) is the next item on the Wenzelsbibel track.
- The hsa-7711 letter walkthrough end-to-end in the browser (open, draft, annotate, wrap a
  date through the attribute field, save, reopen, verify the diff is exactly the intention)
  is the operator's product gate.

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
