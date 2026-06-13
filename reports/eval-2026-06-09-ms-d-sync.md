# Milestone evaluation: MS-D, knowledge sync, README, process documentation

Date: 2026-06-09 (night). Milestone: close the execution round MS-A to MS-C by
synchronising every affected .md file in the repo and the vault, updating the
README, and keeping the process documentation (M7.5) complete.

## 1. What was synchronised

Repo (this commit and the three milestone commits before it):

- `README.md`: knowledge table completed (all 17 knowledge documents), proof
  table extended (worked examples, curated set), the Stefan Zweig case marked
  editable via the deterministic converter, pointer to `reports/`.
- `knowledge/promptotyping-case.md`: three stale spots fixed (2,069 post-dedup
  corpus instead of 2103; the ZBZ half of the success criterion engine-proven
  instead of "blocked"; the vault-side provenance drafted instead of "the
  operator's to write").
- `knowledge/goals.md` (M7.1, M7.3, M7.4 statuses), `journal.md` (three-part
  entry for the round), `curated-set.md` (new), `paper-evidence.md` (curated-set
  row), `testing.md`, `INDEX.md`; knowledge set version 0.9 repo-wide
  (converter-reference stays 0.6.1, SZD-lane-owned).
- `HANDOFF.md`: full rewrite (10 commits ahead, decisions 1 to 6 including the
  solo-mode constraint, open threads, the one next step).
- `reports/`: four milestone evaluation reports (MS-A to MS-D).

Vault (all marked claude-code-worker, human-reviewed false):

- New: chapter draft (TP5), nine-section Rohfassung (TP7), provenance page
  (M7.1).
- Updated: the Gesamtplan (TP4 to TP7 status paragraphs), zbz-lane order
  (new point 4, warnings-figure reconciliation), ACTIVE-WORK (teiCrafter night
  addendum and reworked arrow lines; zbz arrow updated to the
  Rohfassung), Erledigt-Log (one line for the round).

## 2. Verification

- Regression after all repo edits: `node test/tools/roundtrip_sweep.mjs`
  294/294 and both worked examples PASS (run during MS-A; no engine code was
  touched after that).
- Stale-figure policy held: the two figures corrected in promptotyping-case.md
  match paper-evidence.md (corpus 2,069; ZBZ worked example engine-proven);
  the upstream zbz warnings divergence was routed as a lane order, not edited
  cross-repo (working model: sibling repos get orders only).
- Vault conventions held: no volatile quantities added to overview notes;
  ACTIVE-WORK arrow-line count kept at four per entry section edited;
  completed work logged in Erledigt-Log, not in narrative text.

## 3. Open after this milestone

The operator gates listed in HANDOFF.md (sight-checks, approvals, push, rights,
CfP deadline) and the solo-executable next step recorded there (reference
verification, evidence rows for genre distribution).

## 4. Verdict

Round closed: every affected .md file in the repo and the vault reflects the
state at the end of 2026-06-09; nothing produced this round exists only in
session context.
