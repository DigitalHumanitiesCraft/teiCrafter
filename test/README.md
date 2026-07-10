# teiCrafter Test and Validation Harness

Testing-first eval harness for the Wenzelsbibel (WB) Editor-path round-trip. It builds the
measuring stick (fixtures + graded validators + a machine-readable report) before the editor
features, so every later change can be measured. The test approach and the
proof inventory live in `knowledge/testing.md`.

## What "validate" means here

The harness runs OUTSIDE the browser (Node orchestration + Python/lxml for real schema
validation), so it can be invoked headlessly and its JSON report becomes the feedback signal.

| Level | Check | Engine |
|------|-------|--------|
| L1 | Text/word fidelity: every `<w>` text preserved in order (no word loss) | Python + lxml |
| L3 | Structural invariants: counts (surface/zone/standOff/note/w/lb/l/pb), namespace, pointer integrity | Python + lxml |
| L2 | Real schema validity: TEI All RelaxNG + project Schematron | Python + lxml (RelaxNG, isoschematron) |

MVP gate (current milestone): well-formed AND L1 pass (no `<w>` loss) AND L3 counts preserved.
L2 is always reported (full L1/L2/L3 breakdown) but does not gate yet. For a round-trip, L2 is
scored as a DIFF (new errors introduced) because the raw codex may not be tei_all-valid as-is.

## Layout

```
test/
  fixtures-synthetic/   COMMITTED. Synthetic WB structural twin (no ONB data).
  fixtures/             GITIGNORED. Real ONB-derived folio slices live here, locally only.
  schemas/              tei_all.rng (gitignored, fetch on demand); project .sch.
  harness/
    validate.py         The validator (L1/L2/L3, gate, JSON report). The core.
    run.mjs             Node orchestrator: candidate -> validate -> collect reports.
    selftest.mjs        Proves the harness: identity => pass, corrupted => fail.
  tools/
    extract_folio.py    Deterministic streaming extractor (run on the real codex).
  reports/              GITIGNORED. Harness output (JSON + human-readable).
```

## Run

```
# Prove the harness works (DoD negative test): identity passes, corruption fails.
node test/harness/selftest.mjs

# Validate one candidate against a reference fixture.
python test/harness/validate.py --input <reference.xml> --candidate <candidate.xml> \
       --manifest <manifest.json> [--sch <schema.sch>] [--rng test/schemas/tei_all.rng]

# Orchestrated run over configured fixtures (writes test/reports/...).
node test/harness/run.mjs
```

## Using the REAL Wenzelsbibel codex (when provided)

The real `codex-2759.xml` (~78 MB, ONB) is NOT in this repo and must never be committed.
When you have it locally:

```
python test/generators/extract_folio.py --codex /path/to/codex-2759.xml \
       --surfaces 1 5 40 --out test/fixtures/wb/
```

This slices folio-sized fixtures (each its own reference) into the gitignored `test/fixtures/`.
Then point `run.mjs` / `validate.py` at those files. A guard refuses to run if any ONB-derived
file is git-tracked.
