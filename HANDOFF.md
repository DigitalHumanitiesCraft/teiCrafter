# teiCrafter Handoff and Working State

Action-layer summary so work can resume without re-deriving anything. Snapshot:
2026-06-10 (evening), end of the project-layer session (WB-AP3 manifest, M2.9
project folders, plaintext intake, public-text corrections). This file replaces
the previous 2026-06-10 snapshot. Conceptual detail lives in `knowledge/`
(start at `INDEX.md`); per-milestone evaluation reports live in `reports/`.

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

## State at handoff (all engine-proven, partially pushed)

Branch `session/2026-06-07-place-graphic`, clean working tree, no stash,
**67 commits over `main`**; 22 of them are on the remote session branch, the
remaining **45 are local only** (pushing requires the operator's word).

This session (7 commits, f3a59c4 .. 163dd2e):

- **Housekeeping:** stale plan markers closed (M5.2/M5.6 were long done),
  HANDOFF push-state corrected against the real remote, dead pre-pivot
  `pipeline.mjs` deleted (recoverable from git history).
- **WB-AP3, project manifest v1:** `docs/js/editor/project-manifest.js` parses
  and validates `teicrafter.project.json` (entry-agnostic, strict, normalized
  to the runtime profile shape); manifest wins, PID detection stays the
  fallback. The Wenzelsbibel manifest is the first profile, derived from the
  editorial guidelines; committed inside the gitignored codex dir via
  contents-ignore plus negation.
- **Public-text corrections at the root:** byte fidelity is now EXPLAINED where
  claimed (an editor is not a copier; tree re-serialization normalises, the
  splice does not; the diff is exactly the human intervention), with an example,
  in specification.md, About and README. "Emergent granularity" renamed
  repo-wide to "the editing unit is read from the document". The About/project
  boundary texts dropped false negative identity claims (oXygen/ediarum,
  TEI-only input). "by construction" removed from public surfaces.
- **M2.9 project folders + corrected project model:** a project is NOT an
  edition type (operator): the manifest carries `documentTypes` + a `files`
  map, the markup wrap list binds to the open document's type. "Open project
  folder" (once-granted directory handle), Project panel in the right-pane
  registry, "New project" writes a minimal manifest. Plaintext `.txt` opens as
  a deterministic line-level TEI draft (`plaintext-import.js`; transport not
  interpretation, deliberately NOT AI-marked); first save creates the `.xml`
  in the folder.
- **"Example projects":** the example cards renamed (not all examples are
  editions); SZD and ZBZ examples received minimal manifests (name + letter
  type, no invented markup), so every example loads as a project and the
  status line names project and type.
- **Knowledge distillation rule** (now in CLAUDE.md): knowledge documents carry
  patterns, decisions, constraints, mechanisms, never surface counts the
  artifact shows on sight. design.md and user-stories.md swept; a real
  staleness in integration.md (pre-M2.14 three-pane description) corrected.
- **Landing consolidation attempted and REVERSED:** the operator chose
  consolidation (editor becomes index.html), then reversed on sight (the
  landing looks better). Both pages stay; the reversal is a recorded journal
  decision. Do not re-propose.
- Proofs green at handoff: `project_manifest_check.mjs` 45/45,
  `project_case_check.mjs` 24/24 (the operator's acceptance case headless:
  one project, one TEI, two plaintexts), roundtrip sweep 295/295, full
  regression unchanged.

## Decisions this session (dated, with reasons; journal carries the long form)

1. A project is not an edition type; one project holds several document types
   and the element inventory binds to the type (operator, 2026-06-10; SZD is
   the counterexample that settled it).
2. Plaintext intake is deterministic transport and never AI-marked (the violet
   family stays reserved for machine-plausible content a human must judge).
3. The operator's acceptance case for the project layer: create an own project,
   one TEI + two plaintexts, open and edit all three. Headless proven; the
   browser run is the operator's gate.
4. Knowledge documents describe patterns, not surface counts (rule in CLAUDE.md).
5. Coined terms must survive "explain it literally": "emergent granularity"
   dropped; properties are only claimed where their mechanism is explained.
6. The landing page stays; functional redundancy alone does not settle a
   page-structure question, appearance of the public surface is part of the
   decision basis.
7. Solo mode lifted (operator): sub-agents allowed again, explicit model
   override per agent (opus/sonnet), main model stays orchestrator, disjoint
   file sets, diffs verified before commit.

## Open threads (none lost, all registered)

- **Operator gates:** browser sight-check of the UI rounds 6 to 8 AND of this
  session's surfaces (URL checklist was given in-session: landing "Example
  projects", About texts, the three example deep links with manifest status
  lines, the WB markup list in the annotate popover); the M2.9 acceptance case
  in a Chromium browser (New project, one TEI + two .txt, edit all three, save
  creates the .xml); push approval for the 45 local commits; TEI-Guidelines
  feature decision (link-out vs p5subset.json panel); M7.4 object sign-off;
  approval of chapter draft, Rohfassung, provenance page; Kreyenbuehl package.
- **Wenzelsbibel packages** per the ratified definition decisions: WB
  dual reading (F4: diplomatic|normalised view switcher + two-field edit with
  an attribute-precise splice), WB-AP4 standOff apparatus, ED.1-ED.7 user
  stories + gate W1, WB-AP5 PAGE-XML import (after the data-model decision
  with the project lead).
- **Manifest consumers still open:** declared `indices` driving the entity
  index (incl. peoples/Voelker), `views` as real authoring views, schema field
  for per-edition validation.
- **Sibling-lane orders unchanged:** szd-htr converter guard (empty page must
  not copy the previous page); zbz lane four-point order (schema extension,
  graphic emission, oekosystem correction, warnings reconciliation); ZBZ
  worked-example half depends on that track.
- Pre-existing: the ZBZ example is local-only (rights) and fails with a status
  message on public Pages.

## The one next step

The operator verifies this session's surfaces in his browser (the in-session
URL checklist) and runs the M2.9 acceptance case; then either his feedback
round or the next Wenzelsbibel package (F4 dual reading is the plan's next
implementable item).

## Shared and held files

- This repo: everything is this lane's own; clean at handoff, nothing
  uncommitted, no stash. No foreign changes touched.
- Memory (`~/.claude/projects/...teiCrafter/memory/`): working-model.md updated
  (solo mode lifted 2026-06-10), no-metaphors memory extended (literalness test
  for coined terms).
- Obsidian vault and sibling repos (szd-htr, zbz-ocr-tei): untouched this
  session.
- Local-only artifacts unchanged: `docs/data/editor/wb-codex/` (real codex),
  `docs/data/editor/zbz-100/`, `docs/data/editor/zbz-1000/` (rights-encumbered,
  regenerable), `output/curated-set/`.
