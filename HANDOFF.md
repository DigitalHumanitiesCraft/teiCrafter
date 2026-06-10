# teiCrafter Handoff and Working State

Action-layer summary so work can resume without re-deriving anything. Snapshot:
2026-06-10, end of the UI feedback rounds 6 to 8 (M2.5 through M2.14 and
WB-AP1/AP2 all landed since the previous snapshot). Conceptual detail lives in
`knowledge/` (version 0.9, start at `INDEX.md`); per-milestone evaluation
reports live in `reports/`. This file replaces the 2026-06-09 snapshot; the
tool description, code map, and constraints still hold and are not repeated
where unchanged (see `knowledge/architecture.md`).

## Frame: what this lane is working on

The Editopia contribution (Pollin / Kreyenbuehl, "Agentenbasierte Editionsworkflows
und epistemische Infrastrukturen", conference 02. to 04.09.2026, Wuppertal). The
research project has eight subprojects; the cross-project master plan, the zbz-lane
order (now four points), the concept chapter draft, the nine-section full-text
Rohfassung and the M7.1 provenance page live in the Obsidian vault
(`Projects/zbz-ocr-tei/2026-06-09 - *` and `Projects/Research Tools/teiCrafter/`);
session plan documents live in `~/.claude/plans/editopia-*.md`; the complete
implementation plan for ALL remaining work (packages AP-A to AP-L with steps,
files, proofs, gates and the session sequence) is
`~/.claude/plans/editopia-implementierungsplan-2026-06-09.md`. The repo-side
milestone register is `knowledge/goals.md` (H1 to H7).

Success criterion (operator, 2026-06-09): the experiment counts as successful when
the workflow's added value for the Hersch project is demonstrable, that is, from
unverified pipeline TEI a demonstrably better TEI emerges through curation in
teiCrafter (facsimile-linked, authority-linked entities, explicit editorial
confidence, explicit verification status, byte-exact preservation), confirmed by
the ZBZ.

## State at handoff (all engine-proven, partially pushed)

Branch `session/2026-06-07-place-graphic`, clean working tree, **60 commits over
`main`**; 22 of them are already on `origin/session/2026-06-07-place-graphic`,
the remaining 38 are local only (pushing them requires the operator's word).
Since the 2026-06-09 snapshot:

- **The UI rebuild through eight operator feedback rounds is landed and proven:**
  M2.5 annotation visibility + M2.6 chooser (superseded), M2.7 shell rework,
  M2.8 selection annotation, M2.10 editor paradigm ("wie Oxygen"), M2.11 index
  into the annotation environment, M2.12 real XML source editor, M2.13 module
  split, and M2.14 dual view (commit ddd66ae: left pane Reading/XML view tabs,
  right pane an open panel registry with Facsimile and Index; XML works next to
  the facsimile; `index-overlay.js` became `entity-index.js`). Welcome state,
  one "Load..." entry, About page, TEI brand colors and `<teiCrafter>` wordmark,
  identity footer, validation chip at the text (rounds 6/7).
- **WB-AP1/AP2:** the real 78 MB Wenzelsbibel codex loads (validation cached by
  doc identity, `@points`-only zones get derived bboxes) with the ÖNB IIIF
  resolver via `project-profiles.js`; proof `wb_codex_check.mjs` 16/16.
- **SZD fixture fix:** the duplicated page-5 text in `o_szd.1079.tei.xml` was a
  fixture-generation artifact (page 5 is empty in szd-htr groundtruth.json);
  removed. Order for the szd-htr lane: guard the converter against copying the
  previous page when a transcription is empty.
- **Landing rebuilt as a front door** (hero, three example cards deep-linking
  `editor.html#example=KEY`, feature strip) and **the WB example now loads the
  real Codex 2759** from gitignored `docs/data/editor/wb-codex/` (copy of
  `GitHub/Wenzelsbibel/data/codex-2759.xml`), falling back to the synthetic
  twin where absent (public deployment). Known pre-existing: the ZBZ example
  is local-only (rights) and fails with a status message on Pages.
- **LLM on-ramp hidden** behind `FEATURES.llmOnRamp` (off; operator order,
  code stays in place), **journal rewritten to decision style** (trigger,
  decision, reason; no proof counts), **comment-style rule** in CLAUDE.md, and
  the **approved refactor round**: style.css purged to tokens + base + shared
  site chrome (2,692 to ~230 lines; the dead generator styling is gone, the
  About page can scroll again), one `.site-head`/`.site-foot` family for all
  three pages, example loaders folded into the registry. Smoke test now 44
  checks incl. landing and About.
- **Earlier round (2026-06-09, unchanged):** M7.4 curated set done for the two
  proven objects (extension awaits operator object sign-off); TP5 chapter draft,
  TP7 Rohfassung, M7.1 provenance page in the vault, approvals pending.
- Full regression green 2026-06-10: roundtrip 295/295 (285 Hersch + 5 SZD + 5
  synthetic), szd_demo_check PASS, ai_suggest_parse 8/8; UI smoke test (dual
  view) 36/36 with screenshots.

## Decisions this session (dated, with reasons)

1. The experiment is NOT yet "gelungen"; success is the demonstrable added value
   confirmed by the ZBZ (operator, 2026-06-09).
2. ZBZ demo object is doc 1000; Hersch material stays local-only (gitignored,
   deterministic generators) until the rights answer; briefly committed material
   was removed from history before any push.
3. Paper style rules (operator): no rhetorical colons, no dashes, no slop
   patterns, no metaphors; numbers only with an evidence-sheet row.
4. Curated-set step counting: curation steps vs engine splices are two registered
   figures, never to be mixed (paper-evidence.md section 3).
5. The two concept additions (artifact carries its own verification status;
   determinism of the surrounding tools) are led as an EXTENSION of the
   verification milestones in the chapter draft, operator confirmation pending.
6. Solo-mode constraint (operator, 2026-06-09 night): no dynamic multi-agent
   workflows from now on; this lane works as a single model.
7. Browser checks are now agent-driven (operator, 2026-06-09 night): this lane
   drives the Claude-in-Chrome tool itself. Method proven on o_szd.1079: repo
   served on :8123, the native file picker bridged by a JS stub whose fake
   handle also captures the save stream, so byte-identity is asserted in the
   browser (no-op save === original, 5,247 chars). The operator's formal
   sight-off remains a separate gate.
8. UI restructuring decided (operator, 2026-06-09 night): annotations must be
   visible in the reading text and every operation reachable at the cell;
   registered as M2.5 (annotation visibility layer) and M2.6 (inline action
   chooser), concept in design.md. Trigger findings: `.ed-w.mention` unwired,
   entity-type tokens unused, modes hidden behind toggles.

## Open threads (none lost, all registered)

- Operator gates: browser sight-check of the UI rounds 6 to 8 (welcome state,
  load menu, About, dual view, panel switching, XML next to facsimile) at his
  window size, including the facsimile-toggle report from round 7 that did not
  reproduce headless; push approval for the 38 unpushed commits; object sign-off
  and per-object browser approval for M7.4; approval of chapter draft,
  Rohfassung, provenance page; Kreyenbuehl package; EditionCrafter role in the
  talk.
- Operator decision pending: the TEI Guidelines reference feature (proposed
  Stage 1 link-out vs Stage 2 `p5subset.json` reference panel; both CORS-open,
  journal 2026-06-10 evening). The M2.14 panel registry is the natural host.
- szd-htr lane order: converter guard against duplicating the previous page
  when a page's transcription is empty (the o_szd.1079 fixture artifact).
- zbz lane (written order in the vault, four points): schema extension
  standOff/name (E68 precedent), graphic emission, oekosystem correction,
  warnings-figure reconciliation.
- Wenzelsbibel work packages WB-AP3 ff. (manifest v1, dual reading, standOff
  apparatus, ED stories + gate W1) per the ratified definition decisions.
- Consolidated paper open points: end of the Rohfassung note.

## The one next step

The operator reviews the rebuilt UI in his browser (rounds 6 to 8) and decides
on the TEI Guidelines feature; implementation continues per his next feedback
round or with the Wenzelsbibel packages (WB-AP3 ff.).

## Shared and held files

- This repo: everything here is this lane's own; status clean at handoff.
- Obsidian vault (shared): created tonight `2026-06-09 - Editopia Begriffskapitel
  epistemische Infrastruktur (Entwurf).md`, `2026-06-09 - Editopia Volltext
  Rohfassung.md` (both Projects/zbz-ocr-tei) and `2026-06-09 - teiCrafter als
  Promptotyping-Fall (Provenienz).md` (Projects/Research Tools/teiCrafter);
  updated Gesamtplan (TP4 to TP7 status), zbz-lane order (point 4), ACTIVE-WORK
  (zbz and teiCrafter entries), Erledigt-Log. All marked claude-code-worker.
- Sibling repos zbz-ocr-tei and szd-htr: read-only this session (orders only).
- Local-only artifacts: `output/curated-set/` (regenerable),
  `docs/data/editor/zbz-1000/` (regenerable, rights-encumbered), `c:\tmp\*`
  analysis artifacts.
