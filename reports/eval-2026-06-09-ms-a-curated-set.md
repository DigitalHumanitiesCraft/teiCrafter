# Milestone evaluation: MS-A, curated example set (M7.4)

Date: 2026-06-09. Milestone: the paper's empirical partial result (Teilprojekt 4
of the master plan). Evaluator: this lane, self-evaluation against the
milestone's own acceptance criteria; every claim below is backed by a
re-runnable command.

## 1. What the milestone promised

From HANDOFF.md ("The one next step"): build the curated example set
script-generated through the engine, persist before/after/diff per object under
a gitignored output directory, write the set table for the paper, and hand the
objects to the operator for browser approval, starting with the two proven
objects (ZBZ 1000, SZD o_szd.1079).

## 2. What was delivered

| Deliverable | Location | Proof |
|-------------|----------|-------|
| Registry-driven set generator | `test/tools/make_curated_set.mjs` | `node test/tools/make_curated_set.mjs`, exit 0 |
| Generated pairs (before/after/diff/summary) | `output/curated-set/{zbz-1000, o_szd.1079}/` (gitignored) | same run: 12 per-object checks, all ok |
| Set overview table | `output/curated-set/SET.md` (regenerated each run) | same run |
| Set method and table for the paper | `knowledge/curated-set.md` (committed) | document on disk |
| Figures registered for citation | `knowledge/paper-evidence.md` section 3, new row | document on disk |
| Milestone register updated | `knowledge/goals.md` M7.4 | document on disk |

## 3. Verification results

- Generator first run 2026-06-09: PASS, 2 objects generated and verified, 2
  registry entries pending operator sign-off, 0 failures.
- Per object: before.xml round-trips byte-identically through the engine;
  after.xml is idempotent and keeps its folio model (4 folios zbz-1000, 5
  folios o_szd.1079); a `<standOff>` exists; the pair differs.
- Diff cross-check: the script's own unified diff reports +17/-5 lines for
  zbz-1000 and +18/-5 for o_szd.1079; `git diff --no-index --stat` on the same
  pairs reports 17 insertions / 5 deletions and 18 insertions / 5 deletions.
  Exact agreement.
- Regression after the change: `roundtrip_sweep` 294/294,
  `zbz_worked_example` PASS (11 surgical edits), `szd_worked_example` PASS
  (12 surgical edits). No engine code was touched; the generator only consumes
  the engine.

## 4. Deviations and judgement calls

1. The recipes duplicate the curation arcs of the worked-example tests instead
   of importing them, because those tests execute at module top level and are
   not importable. Accepted: the worked examples remain the proof of splice
   surgery, the generator is the persistence layer, and a drift between them
   would surface as a failing generator check.
2. Two step-count figures exist by design: curation steps (human-visible
   actions, 8 and 9) and engine splices (byte-level edits, 11 and 12, counted
   by the worked-example proofs). Both are registered in paper-evidence.md to
   prevent the two being mixed in the paper.
3. The proposed extension objects (zbz-1540, SZD prompt-group objects) are
   registry entries with `enabled: false`, listed in every run's output. This
   keeps the operator decision visible instead of burying it in a document.

## 5. Open after this milestone

- Operator: object sign-off for the extension; browser approval of the two
  generated pairs; the ZBZ rights answer (decides committability of ZBZ pairs).
- zbz lane: the standOff/name schema extension (full validity of the ZBZ
  after-file waits on it; generation does not).

## 6. Verdict

Milestone met for its in-scope half: the set exists, is deterministic,
verified, and documented; the extension half is operator-gated as planned.
