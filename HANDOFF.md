# teiCrafter Handoff and Working State

Action-layer summary so work can resume without re-deriving anything. Snapshot:
2026-06-09, end of the Editopia planning-and-execution session. Conceptual detail
lives in `knowledge/` (version 0.8, start at `INDEX.md`). This file replaces the
2026-06-04 snapshot; the tool description, code map, and constraints from that
snapshot still hold and are not repeated where unchanged (see `knowledge/architecture.md`).

## Frame: what this lane is working on

The Editopia contribution (Pollin / Kreyenbuehl, "Agentenbasierte Editionsworkflows
und epistemische Infrastrukturen", conference 02. to 04.09.2026, Wuppertal). The
research project has eight subprojects; the cross-project master plan and the
zbz-lane order live in the Obsidian vault (`Projects/zbz-ocr-tei/2026-06-09 -
Editopia Gesamtplan.md` and `... - Auftrag zbz-Lane Editopia.md`); session plan
documents live in `~/.claude/plans/editopia-*.md`. The repo-side milestone register
is `knowledge/goals.md` (H1 to H7, now including M7.4 and M7.5).

Success criterion (operator, 2026-06-09): the experiment counts as successful when
the workflow's added value for the Hersch project is demonstrable, that is, from
unverified pipeline TEI a demonstrably better TEI emerges through curation in
teiCrafter (facsimile-linked, authority-linked entities, explicit editorial
confidence, explicit verification status, byte-exact preservation).

## State at handoff (all engine-proven, nothing pushed)

Branch `session/2026-06-07-place-graphic`, clean working tree, **6 commits ahead of
origin** (in order): 10eae74 ZBZ worked-example engine proof + local-only object
(M2.4 + M7.2 ZBZ half), 8ec4a11 paper evidence sheet (`knowledge/paper-evidence.md`),
a3488cd ZBZ worked-example document (`knowledge/worked-example-zbz.md`), f744a77
knowledge sync (version 0.8), 83651e6 milestones M7.4/M7.5, plus this handoff commit.

- Both halves of the M7.2 demo gate are engine-proven: SZD `o_szd.1079`
  (browser-verified 2026-06-08) and ZBZ doc 1000 (`node
  test/tools/zbz_worked_example.mjs`, 38/38, 11 surgical edits, first green
  2026-06-09).
- The ZBZ object is LOCAL-ONLY (rights stance as zbz-100, gitignored):
  `docs/data/editor/zbz-1000/zbz-hersch-1000.xml`, materialized deterministically by
  `node test/tools/make_zbz1000_demo.mjs` from the zbz sibling checkout. The proof
  gates local file, else sibling build, else SKIP.
- `knowledge/paper-evidence.md` fixes every paper number with source and re-runnable
  command; it superseded four stale figures (CER median 1.40 / mean 2.71, not
  1.83/4.26; SZD needs_review live 16.4 %; three ZBZ workflow states per E77; port
  parity 5/5).
- Schema finding (2026-06-09, artifacts `c:\tmp\zbz1000_curated.xml`,
  `c:\tmp\validate_steps.py`, `c:\tmp\make_curated_1000.mjs`): against
  `zbz_hersch.rng` the curated additions validate for graphic / correction /
  unclear / gap; `<standOff>` and `<name ref>` do NOT and need a schema extension
  (order to the zbz lane is written, vault).
- Full regression green 2026-06-09: roundtrip 294/294, hersch_loadability 285/285,
  both worked examples, criticism 47/47, szd_demo_check.

## Decisions this session (dated, with reasons)

1. The experiment is NOT yet "gelungen"; success is the demonstrable added value
   (operator, reframing the paper narrative from claim to criterion).
2. Both Editopia demo objects run in teiCrafter; the 2026-06-07 note that
   EditionCrafter v0 carries the Hersch demo is superseded (ACTIVE-WORK updated,
   zbz-lane corrects oekosystem-synthese.md, M5.5). EditionCrafter's role in the
   talk (outlook or absent) is an open operator decision.
3. ZBZ demo object is doc 1000 (only candidate with clean 1:1 pb/surface/image
   alignment; 1330 has 7 pb on 6 surfaces, 2310 an image/surface offset, 1540 is
   the 8-page German runner-up).
4. Doc 1000 was briefly committed, then removed from history before any push:
   public on the zbz Pages is not redistributable, the repo's documented Hersch
   rights stance wins; reproducibility via the deterministic generator instead.
5. Paper style rules (operator): no rhetorical colons, no dashes, no slop patterns,
   no metaphors; saved as durable memory and in the plans.
6. The making of the contribution is itself documented as a Promptotyping case
   (M7.5); every session ends with a journal entry, every operator decision is
   dated.

## Open threads (none lost, all registered)

- Operator: CfP deadline and full-text format (drives the whole schedule; current
  assumption: submission by 09.08.); browser sight-check of the ZBZ worked example
  plus the five unexercised browser paths (Mark-text, mention link, live lookup,
  note click, AI proposal); push approval for the 6 local commits; object sign-off
  for M7.4; Kreyenbuehl package (redistributability of the four demo docs,
  workflow comparison data, outline meeting).
- zbz lane: written order in the vault (schema extension standOff/name per E68
  precedent, graphic emission check, oekosystem correction).
- This lane next: M7.4 curated example set (script-generated before/after pairs
  with diff; proposed ZBZ 1000 + 1540, SZD 1079 plus two or three prompt-group
  objects; ZBZ pairs local-only pending rights); then the full text (nine sections,
  the epistemic-infrastructure chapter is the largest original writing, sharpening
  points recorded in `~/.claude/plans/editopia-projektplan-v2-2026-06-09.md`).

## The one next step

Implement **M7.4**: build the curated example set script-generated through the
engine (pattern: `c:\tmp\make_curated_1000.mjs`, generalized and moved into
`test/tools/`), persist before/after/diff per object under a gitignored output
directory, write the set table for the paper, and hand the objects to the operator
for browser approval. Start with the two proven objects (ZBZ 1000, SZD 1079), then
extend to the proposed set once the operator signs off the object list.

## Shared and held files

- This repo: everything here is this lane's own; no foreign changes in the working
  tree at handoff (status clean).
- Obsidian vault (shared with the operator and other instances): created
  `Projects/zbz-ocr-tei/2026-06-09 - Editopia Gesamtplan.md` and `... - Auftrag
  zbz-Lane Editopia.md` (both `author: claude-code-worker`, `human-reviewed: false`);
  updated ACTIVE-WORK (zbz and teiCrafter entries) and Erledigt-Log. Three flags for
  the operator: the zbz ACTIVE-WORK entry still lists the CER baseline as open
  although zbz `knowledge/quality.md` carries the corrected headline since 06.08;
  that entry now has six arrow lines (convention says four to five); the teiCrafter
  entry's morning claim "gepusht" predates the six local evening commits.
- Sibling repos zbz-ocr-tei and szd-htr: untouched (working model: orders only).
