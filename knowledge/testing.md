---
title: teiCrafter Testing and Evaluation Harness
project:
  name: teiCrafter
  repository: https://github.com/DigitalHumanitiesCraft/teiCrafter
method:
  name: Promptotyping
  url: https://lisa.gerda-henkel-stiftung.de/digitale_geschichte_pollin
template:
  name: Vorlage Testing
  version: 0.1
  url: https://dhcraft.org/Promptotyping/promptotyping-document/testing
status: active
created: 2026-05-30
updated: 2026-06-07
language: en
version: 0.4
topics: ["[[Software Testing]]", "[[Evaluation]]", "[[TEI XML]]"]
related: [architecture, specification, data]
---

# teiCrafter Testing and Evaluation Harness

Testing-first. The measuring stick is built before the features it judges. Two layers: headless proofs of the editor engine (Node, the same DOM-free modules the browser runs), and a validation harness for TEI fidelity (Node + Python/lxml). Both are deterministic and run outside the browser. The one thing they cannot check is the browser click-through of the UI.

## Engine Proofs (the central claim)

The promise is "read arbitrary TEI and save it byte-losslessly". These prove it directly against real data:

| Proof | What it asserts | Result |
|-------|-----------------|--------|
| `test/tools/roundtrip_sweep.mjs` | Every real TEI file tokenizes contiguously and `serialize()` is byte-identical to the input | 294/294 byte-identical (285 Hersch, 4 SZD, 5 synthetic) |
| `test/tools/generic_roundtrip.mjs` | One engine reads Hersch (line-level), Wenzelsbibel (word-level) and SZD (catalog); recognizers find pb/lb/zones; a cell edit is a surgical splice; the editor model shape is correct | all checks pass |
| `test/tools/editor_roundtrip.mjs` | The editor edition-core API: identity round-trip is byte-identical; a word edit is surgical; the harness localizes exactly that change | 13/13 |
| `test/tools/edit_fidelity.mjs` | Edits stay byte-faithful over character/entity references (a no-op edit of a cell or attribute holding `&nbsp;`/`&#233;`/`&quot;`/`&apos;` is byte-identical, a real edit preserves a neighbouring entity); `addEntity` degrades gracefully on header-less or element-free TEI; relinking a mention retargets `@ref` without nesting `<name>`; the integrity baseline tracks real `@xml:id`, stable across a lossless line-emptying edit | 21/21 |

The sweep reads directly from the source repos (nothing copied or committed) plus the committed synthetic fixtures; override the source dirs with `HERSCH_DIR` / `SZD_DIR`.

## Validation Harness: the Three Levels

| Level | What it checks | Engine |
|-------|----------------|--------|
| L1 text/word fidelity | Every `<w>` text node preserved in order; first divergence, lost and added words reported | Python tokenizer over the parsed tree (difflib) |
| L2 schema validity | TEI All RelaxNG plus the project Schematron | lxml `RelaxNG` (`tei_all.rng`) and `lxml.isoschematron` |
| L3 structural invariants | Counts of surface/zone/standOff/note/w/lb/l/pb, namespace integrity, pointer (`@facs`, `@corresp`) integrity | Python over the parsed tree |

## MVP Gate

Well-formed AND L1 pass AND L3 counts preserved. L2 is always reported but does not gate: on a round-trip it counts only NEW errors against the input error count, so a document carrying its own pre-existing TEI All deviations is not penalised. A clean identity round-trip shows zero new RelaxNG errors even when the input itself is not TEI All clean.

## Synthetic Fixtures

Committed under `test/fixtures-synthetic/`. The 3 baseline RelaxNG errors on the smallest twin are the intentional divergence of a minimal synthetic `<TEI>` from full TEI All; larger tiers validate clean. In every case the identity round-trip introduces 0 new errors.

| Fixture | Words | Verdict | Score | L1 | L3 counts | Schematron | RNG errors |
|---------|-------|---------|-------|----|-----------|------------|------------|
| wb-synthetic-folio | 12 | pass | 100 | pass | preserved | valid | 0 |
| tier1-1folio | 24 | pass | 100 | pass | preserved | valid | 0 |
| tier2-5folio | 120 | pass | 100 | pass | preserved | valid | 0 |
| tier3-20folio | 480 | pass | 100 | pass | preserved | valid | 0 |

## Generality on Real TEI

The harness gates on text and structure fidelity and surfaces, without failing, each file's own pre-existing TEI All deviations. Real Hersch and SZD files round-trip with 0 new errors; line-level files (no `<w>`) meet L1 trivially; dangling `@facs` to external facsimile files are reported as non-gating diagnostics.

## Verifying the Project Goals (Acceptance)

The verification methods are complementary, not alternatives: each answers a different question and catches a different failure. Together they are the Promptotyping verification cascade (automatic, contextual, visual, professional). Real data is the rule at every level; synthetic material exists only for the Wenzelsbibel licence boundary.

| Question | Method | Level | Proof |
|----------|--------|-------|-------|
| Was everything processed? | Coverage sweep: counts over the whole corpus | automatic | 285/285 Hersch load, 294/294 round-trip, every SZD demo file converts |
| Is the output valid TEI? | Well-formedness + schema (TEI All RNG + Schematron; ZBZ also `zbz_hersch.rng`) | automatic | L2, green/red |
| Is nothing lost, and is the only change the intended one? | Round-trip byte-identity + L1 text + L3 counts + diff-is-exactly-intent | contextual | byte-identical (`roundtrip_sweep.mjs`, `edit_fidelity.mjs`) |
| Does the intended use actually work for a human? | Walk each demo-critical user story as a concrete path in the browser on a real object | visual | observed; the part headless tests cannot cover (the user-stories.md "Browser-check" status) |
| Is it correct as an edition? | Domain-expert review of the content | professional | expert sign-off (both corpora are currently unreviewed) |

The visual level is the centerpiece for "did we reach the goal in our sense". The success criterion (open, correct line by line, annotate person/place/work with authority ids, save byte-faithfully) is the chain of user stories E.1, E.2, E.3, E.4, E.5, F.1, F.2, I.1, I.2 plus the ones being built (FU.1 note, FU.2 authority ids from the UI, FU.4 SZD Page-JSON to TEI, and the AI-proposal step M3.7). Each demo-critical feature is verified twice: a headless proof added to the engine harness above, and a browser path walked on the real demo object (o_szd.1079 for SZD; one of docs 1000 / 1330 / 1540 / 2310 for ZBZ).

Documentation is itself part of acceptance: the per-fixture JSON reports and the knowledge vaults let a reviewer trace every claim, which is the paper's reproducibility requirement. The acceptance table (goal to proof to green/red) is kept in [project-plan.md](project-plan.md) section 17.

## Components

- `test/harness/validate.py`: the validator (L1, L2 via lxml, L3), JSON report.
- `test/harness/run.mjs`: orchestrator over every fixture.
- `test/harness/selftest.mjs`: negative test (identity passes, corruption fails), 14/14.
- `test/tools/roundtrip_sweep.mjs`, `generic_roundtrip.mjs`, `editor_roundtrip.mjs`, `edit_fidelity.mjs`: the engine proofs above.
- `test/tools/gen_synthetic_codex.py`, `extract_folio.py`: synthetic generation and folio slicing.
- `test/schemas/tei_all.rng`: TEI All RelaxNG (~11.6 MB, gitignored).
- `test/reports/<id>/report.json`: per-fixture report (wellFormed, L1, L2 with newErrorsVsInput, L3 with deltas, verdict, score).

## Licence Boundary

Real third-party files (Hersch, SZD, any ONB codex slice) live only under the gitignored `test/fixtures/` and never enter version control. All committed Wenzelsbibel material is synthetic. See [data](data.md).

## How to Run

```
node test/tools/roundtrip_sweep.mjs      # 294/294 byte-identical (reads source repos)
node test/tools/generic_roundtrip.mjs    # one engine over Hersch / WB / SZD
node test/tools/editor_roundtrip.mjs     # editor core vs harness, 13/13
node test/tools/edit_fidelity.mjs        # entity-faithful edits + standOff guard, 13/13
node test/harness/selftest.mjs           # negative gate, must be 14/14
node test/harness/run.mjs                # all synthetic fixtures, must PASS
```

## Related

- [architecture](architecture.md) for the engine the proofs measure
- [specification](specification.md) for the validation requirements
- [data](data.md) for the corpus
