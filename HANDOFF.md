# teiCrafter Handoff and Working State

Action-layer summary so work can resume without re-deriving anything. Snapshot:
2026-06-09, end of the Editopia execution round (milestones MS-A to MS-D of that
round). Conceptual detail lives in `knowledge/` (version 0.9, start at
`INDEX.md`); per-milestone evaluation reports live in `reports/`. This file
replaces the earlier 2026-06-09 snapshot; the tool description, code map, and
constraints still hold and are not repeated where unchanged (see
`knowledge/architecture.md`).

## Frame: what this lane is working on

The Editopia contribution (Pollin / Kreyenbuehl, "Agentenbasierte Editionsworkflows
und epistemische Infrastrukturen", conference 02. to 04.09.2026, Wuppertal). The
research project has eight subprojects; the cross-project master plan, the zbz-lane
order (now four points), the concept chapter draft, the nine-section full-text
Rohfassung and the M7.1 provenance page live in the Obsidian vault
(`Projects/zbz-ocr-tei/2026-06-09 - *` and `Projects/Research Tools/teiCrafter/`);
session plan documents live in `~/.claude/plans/editopia-*.md`. The repo-side
milestone register is `knowledge/goals.md` (H1 to H7).

Success criterion (operator, 2026-06-09): the experiment counts as successful when
the workflow's added value for the Hersch project is demonstrable, that is, from
unverified pipeline TEI a demonstrably better TEI emerges through curation in
teiCrafter (facsimile-linked, authority-linked entities, explicit editorial
confidence, explicit verification status, byte-exact preservation), confirmed by
the ZBZ.

## State at handoff (all engine-proven, nothing pushed)

Branch `session/2026-06-07-place-graphic`, clean working tree, **10 commits ahead
of origin** (in order): 10eae74 ZBZ worked-example engine proof + local-only object,
8ec4a11 paper evidence sheet, a3488cd ZBZ worked-example document, f744a77 knowledge
sync 0.8, 83651e6 milestones M7.4/M7.5, 934c3d4 handoff, c2a2827 M7.4 curated set
(generator + curated-set.md + knowledge 0.9), 2c20fdc TP5 chapter record, 90d4512
TP7 Rohfassung record, plus the MS-D sync commit carrying this handoff.

- **M7.4 done for the two proven objects:** `node test/tools/make_curated_set.mjs`
  (exit 0) persists before/after/diff/summary per object under gitignored
  `output/curated-set/` (zbz-1000: 8 steps, 11 splices, +17/-5; o_szd.1079: 9
  steps, 12 splices, +18/-5; diff counts cross-checked against
  `git diff --no-index --stat`). Extension (zbz-1540, SZD prompt-group objects)
  awaits operator object sign-off; per-object browser approval is the operator's.
- **TP5 chapter draft** in the vault (all five sharpening points, adversarially
  reviewed, 22 findings worked in), with a three-point update proposal for the
  concept note; operator approval pending.
- **TP7 nine-section Rohfassung** in the vault, produced by a 24-agent workflow
  (drafter, adversarial verifier, reviser per section; 49 findings worked in;
  every number mapped to `knowledge/paper-evidence.md`); consolidated open points
  at the end of the note; co-author approval pending. NOTE: the operator has since
  restricted this lane to solo work (no dynamic workflows), 2026-06-09 night.
- **M7.1 vault provenance page** drafted, approval pending. **M7.5** runs as
  standing practice (journal per session, milestone commits with proof,
  per-milestone evaluation reports in `reports/`).
- Knowledge set at 0.9; README extended (full knowledge table, worked-example and
  curated-set proofs, SZD case editable via the converter); promptotyping-case.md
  de-staled (2,069 post-dedup, ZBZ half engine-proven, vault side drafted).
- Full regression green 2026-06-09: roundtrip 294/294, both worked examples 38/38,
  curated set PASS.

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

- Operator gates: browser sight-check of ZBZ doc 1000 and the five unexercised
  paths (Mark-text, mention link, live lookup, note click, AI proposal); push
  approval for the 10 local commits; object sign-off and per-object browser
  approval for M7.4; approval of chapter draft, Rohfassung, provenance page;
  CfP deadline and full-text format; Kreyenbuehl package (rights of the four demo
  documents, institutional-context placeholder, pipeline stage-count confirmation,
  workflow comparison data); EditionCrafter role in the talk.
- zbz lane (written order in the vault, four points): schema extension
  standOff/name (E68 precedent), graphic emission, oekosystem correction,
  warnings-figure reconciliation (29/14 vs verified 121).
- Consolidated paper open points: end of the Rohfassung note (references to
  verify, ZBZ deliveries, operator decisions, pre-submission updates).

## The one next step

Implement **M2.5 + M2.6** (the UI restructuring, operator priority 2026-06-09
night; concept in design.md, milestones in goals.md): the `cell.mention`
projection in `edition.js`, the renderer visibility layer with entity-type
colours and legend, and the inline cell action chooser. Then re-run the full
regression (the edition.js change touches the engine model) and re-verify both
real objects in the browser with the proven picker-stub method (SZD already
half-verified this run; the ZBZ leg and the unexercised paths are still open).
Open finding to re-test along the way: the live authority lookup returned
"Failed to fetch" (Wikidata, query Komotau) despite working 2026-06-08; the
diagnosis was interrupted. After that: reference verification and the
genre-distribution evidence rows (see consolidated open points in the vault
Rohfassung note).

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
