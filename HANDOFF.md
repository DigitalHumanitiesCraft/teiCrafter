# teiCrafter Handoff and Working State

Action-layer snapshot so work can resume without re-deriving anything. This is the one
file that carries session state; conceptual detail lives in `knowledge/` (start at
`INDEX.md`), and the decisions behind it in `knowledge/journal.md`.

## State

Branch `main`, synced to `origin/main`, working tree clean. Tip `0e97282`. GitHub Pages
redeploys from `/docs`.

Newest (2026-06-21, milestone round): the **inline-GND export profile** for ZBZ Hersch is
built (`5960d51`). The general standOff model stays the editing model; inline GND is a one-way
export (`toInlineGND` in `docs/js/editor/inline-gnd.js`) that rewrites each `<name ref="#id">`
mention to its typed element (`persName`/`orgName`/`bibl` with `@ref="GND:<value>"`, or the
typed element bare when the entity has no GND), unwraps a place/event/missing/anchorless mention
to plain text, and drops the register, so `{id}_final.xml` validates against `zbz_hersch.rng`.
Reading text round-trips byte-for-byte. Two shapes were fixed against the reference corpus, not
guessed: all three types take `@ref="GND:..."` (the gold uses `@ref` on `bibl` 53x vs `@corresp`
2x, and the schema permits a `GND:` value on `bibl`'s loose `anyURI` `@ref`), and places are
unannotated. Same commit consolidated the bounded mention-walk, copied in three `standoff.js`
functions, into one `enclosingName` helper (behaviour-preserving). The inverse re-open path is
now built too (`fromInlineGND`, `0e97282`): a handed-back inline-GND file reads back into the
register model (entities deduplicated by GND else text, mentions rewrapped as `<name ref>`,
places not recovered), so the interchange file is a fixed point, `toInlineGND(fromInlineGND(file))`
equals the file (proof `inline_gnd_reopen_check`). The export affordance in the editor UI remains
the open next step (a download entry; needs an operator browser trace before live).

Earlier on 2026-06-21, the two confirm/reject commits from 2026-06-20 (the per-construct engine
+ proof `302836e`, then the UI wiring into the overlap inspector `4c56fa2`) were secured to
`origin/main` under the decoupled-securing policy: pushes to main run autonomously, tags and
releases stay operator-gated. The 2026-06-16 commits, oldest first:

- A status pass: live checks report editor-caused id/count changes as neutral info (not
  warnings); a `slugify` id-rule proof; two engine properties pinned by
  `reading_contract_check` (lossless on malformed input; one global editing profile); a
  dangling doc cross-reference fixed.
- The LLM on-ramp re-enabled (`FEATURES.llmOnRamp` on; the landing hero CTA; docs reversed).
- The LLM-assistance layer, built engine-first across four pieces (all committed):
  - **One capability gate + standalone mode** (`llmEnabled()` = build flag AND a persisted
    per-user toggle in the Load menu; AI off is a fully deterministic editor).
  - **Project-level, type-aware model voice** (a manifest `llm` block: system prompt + a
    Markdown `mapping` file ingested next to the manifest; `llmForFile`/`mappingFiles`; the
    pure `llm-prompt.js` assembler shared with the on-ramp).
  - **One `@resp` provenance marker** projected per layer and rendered in one violet family
    across every construct type, with a real `<respStmt>`; `app.aiResp` honours a custom
    responsibility id.
  - **A general in-context proposal flow** (`ai-suggest` generalized to entity/markup/
    criticism/note; `proposal-apply.js` locates each by surface text and inserts it as a
    lossless, resp-marked construct via the generic ops; a "Propose (AI)" trigger).
- A demo: the committed `hsa-7711` letter project now carries an `llm` block + `mapping.md`,
  so the project voice and proposals are testable out of the box. Small cleanups: one shared
  AI-provenance predicate, `proposal-apply` uses the engine's `escapeAttr`, `gen-modal`
  guards its ctx with `requireCtx`.

The working tree is clean.

## Proof state

`node test/tools/run_all.mjs`: **all proofs pass.** New 2026-06-21: `inline_gnd_check` (the
inline-GND export's structural contract on a synthetic register fixture) and
`inline_gnd_schema_check` (a real pipeline file annotated through the engine and exported is
RNG-valid against the real `zbz_hersch.rng` via the lxml harness, zero errors; sibling- and
lxml-gated, SKIPs when absent), and `inline_gnd_reopen_check` (the inverse `fromInlineGND` and
the round-trip fixed point, `toInlineGND(fromInlineGND(file))` equals the file). Earlier this arc: `slugify_check`,
`reading_contract_check`, `llm_gate_check`, `llm_prompt_check`, `llm_config_check`,
`provenance_check`, `proposal_apply_check` (and `ai_suggest_parse_check` updated for the
generalized parser). The whole LLM-assistance engine (gate, prompt assembly, manifest
parse/resolution, mapping ingest, provenance round-trip, proposal apply) is headless-proven;
the browser surfaces are operator-verified. Added 2026-06-20, `proposal_review_check` proves the per-construct confirm/reject engine (`proposal-review.js`): confirm drops `@resp`; reject unwraps a wrapper to restore the exact text, removes a note, or removes a gap; and it refuses human markup by default.

## Open threads

- **The operator L5 browser walk** of the LLM layer is the next step (the operator chose to
  exercise the UI before building the offline eval harness). On the local no-cache server
  (`http://127.0.0.1:8753/editor.html`): (1) toggle AI off/on; (2) open the `hsa-7711` project
  and run "New from text (LLM)" in the project voice; (3) "Propose (AI)" on a page -> violet
  proposals -> save -> reopen byte-faithful. Steps 2-3 need a provider key set once via the
  on-ramp (kept in memory).
- **Per-construct confirm/reject for non-entity proposals**: built (engine + UI). The engine
  is headless-proven (`proposal-review.js`, `proposal_review_check`): `confirmConstruct` drops
  the `@resp` marker; `rejectConstruct` unwraps a reading-text wrapper (restoring the exact
  text), removes a standOff note, or removes a `<gap/>`, refusing human markup by default. The
  UI is wired: an AI-marked cell opens the overlap inspector and each AI layer carries
  confirm/reject through `commitStandoff` (`annotation-ui.js` `openLayersInspector`, plus the
  `editor-app.js` click routing). OPEN: the operator browser sight-check (VC-13 in
  `test/acceptance/BROWSER-CHECKS.md`, pass pending), and the one remaining review surface (F2),
  a proposed standOff `<note>` is not a reading-cell layer and needs its own affordance at the
  note marker. F2 is scoped (2026-06-21): an additive AI-note index in `standoff.js` (the set of
  target ids whose note carries `@resp`, plus a locator resolving that note element) feeding a
  cell-context-menu confirm/reject and a violet note marker; the engine is already proven by
  `proposal_review_check`. Implementation pending, no code written yet.
- **The inline-GND export affordance in the editor UI** is the next build step: a download
  entry beside the existing Save/Download (`editor-app.js download()`) that runs
  `toInlineGND(app.state.doc)`, serializes and downloads `{id}_final.xml`, shown for a
  zbz-profile document. The engine is proven; only the wiring remains. It is a public surface,
  so it needs an operator browser trace (new VC-15 in `test/acceptance/BROWSER-CHECKS.md`) and
  that the exported file re-opens.
- **The inline-GND re-open engine is built** (`fromInlineGND`, `0e97282`): a handed-back
  inline-GND `_final.xml` reads back into the register model, proven a round-trip fixed point
  (`inline_gnd_reopen_check`). The remaining step is the load-time wiring (apply `fromInlineGND`
  when a zbz-profile inline file is opened), grouped with the export affordance as the same
  public surface awaiting the operator browser trace.
- **The offline evaluation harness** (Phase 4) is designed in full in `testing.md`
  ("Evaluating LLM output") but built after the UI walk: L1/L2/L3 scoring of model output
  against the committed CC-BY gold object plus type-diverse samples, an optional model-as-judge,
  with model non-determinism reported as distributions.
- The dormant-vs-maintained question for the LLM layer is answered (kept, on). Pre-existing
  open items unrelated to this session remain in `knowledge/specification.md` (Future / Open
  Questions): the live IIIF manifest pre-resolution, the standOff apparatus authoring layer,
  the manifest `views` consumer, streaming load for very large editions, and the structural
  reading projection for non-folio types (dictionaries, corpora) that the LLM layer is
  vocabulary-general about but does not itself make structurally editable.

## Working model

teiCrafter itself is edited directly. Sibling-repo work (the SZD `<standOff>`/`<name>` schema
extension, ZBZ `<graphic>` emission and the rights answer) goes as orders to `szd-htr` and
`zbz-ocr-tei`, never edited here. Securing is decoupled from approval (since 2026-06-21):
commits to the lane's own paths push to main autonomously, tags and releases stay
operator-gated. Research steering (milestone register, backlog, paper material) lives in the
operator's private vault, not in this repository.

## Shared and held files

- Local-only artifacts, unchanged and gitignored: `docs/data/editor/wb-codex/`,
  `docs/data/editor/zbz-100/`, `docs/data/editor/zbz-1000/`,
  `docs/data/editor/depcha-wheaton/`, `docs/data/editor/hsa-7711/target-reference.xml`,
  `output/curated-set/`.
- Memory, Obsidian vault and sibling repos (szd-htr, zbz-ocr-tei): untouched.
