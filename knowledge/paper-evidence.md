---
title: Editopia Paper Evidence Sheet
project:
  name: teiCrafter
  repository: https://github.com/DigitalHumanitiesCraft/teiCrafter
method:
  name: Promptotyping
  url: https://lisa.gerda-henkel-stiftung.de/digitale_geschichte_pollin
template:
  name: Vorlage Evidence
  version: 0.1
status: active
created: 2026-06-09
updated: 2026-06-09
language: en
version: 0.13
topics: ["[[Editopia]]", "[[Evaluation]]", "[[Verification]]"]
related: [integration, goals, testing, worked-example-szd, worked-example-zbz]
---

# Editopia Paper Evidence Sheet

Every number the Editopia paper (Pollin / Kreyenbuehl, "Agentenbasierte
Editionsworkflows und epistemische Infrastrukturen") may cite, with its source of
record and, where one exists, a re-runnable verification command. No number goes into
the paper text without an entry here. Entries were verified against the three repos on
2026-06-09 (workflow run, three independent readers; spot checks re-run locally).

Repos: `teiCrafter` (this repo), `zbz` = `GitHub/DHCraft/zbz-ocr-tei`,
`szd` = `GitHub/szd-htr`.

## 1. ZBZ / Hersch pipeline

| Claim | Value | Source of record | Verification | Caveat |
|---|---|---|---|---|
| Corpus funnel | 325 masterfile texts, 289 marked digitized, 286 delivered PDFs, 285 final TEI | zbz `knowledge/projekt.md` (Korpus); decision O22 | `python -m scripts.eval.corpus_audit` (re-run 2026-06-09, drift 0/5) | 3 digitized texts never delivered (1745, 1750, 1970); doc 10 has no final TEI |
| Schema validity | 285/285 valid against `zbz_hersch.rng` (121 with non-blocking warnings) | zbz `knowledge/projekt.md` M4; decisions E68, E74 | `python -m scripts.tei.tei_validator --all` (re-run 2026-06-09: 285 valid, 0 invalid) | The 36 embedded Schematron rules are documented but deliberately not executed (E74) |
| Fidelity-CER | mean 2.71 %, median 1.40 %, micro 2.13 %, BCa 95 % CI on the mean [1.77 %, 3.82 %], n=25, seed 42 | zbz `knowledge/quality.md` (Headline values, correction of 2026-06-08); methodology E70, E73, E82, E85 | cer_statistics_full run of 2026-06-08; regression contract `tests/test_cer_extraction.py` | n=25 reference TEIs of 285 docs; references are themselves selective, so CER is an upper bound. Earlier values (median 1.83 / mean 4.26) are superseded |
| Pipeline gain over raw OCR | -9.45 percentage points CER, p=0.013, n=25 | zbz `knowledge/quality.md` | same run as above | paired comparison on the GT sample only |
| Blank pages | 79 blank pages in 15 documents | zbz decisions E63 (detection), E65 (marker) | recount over `output/tei_final/*_manifest.json` (2026-06-09: 79/15 confirmed) | manifests are regenerable, classification is detector-based |
| Language distribution (delivered) | fr 203 (71 %), de 72 (25 %), en 7, it 2, fr/de 1, none 1 (n=286) | zbz `knowledge/projekt.md` (Sprachen) | `python -m scripts.eval.corpus_audit` | catalog level (n=325) differs: fr 215 / de 98 / en 8 |
| Workflow-status model | three streams (ocr / layout / tei) x three states (unverifiziert, in_arbeit, verifiziert); 285/285 handed over unverifiziert | zbz `knowledge/workflow.md`; decisions E66, E67, E77 | manifests at `output/tei_final/{doc}_manifest.json`; projection `scripts/edition/tei_status_marker.py` | E77 (2026-06-07) collapsed four states to three; older texts naming four are stale |
| NER removal | E71 (2026-05-27): NER and entity linking removed; only ~2.6 % of ~30,500 tagged mentions carried a real GND id | zbz `knowledge/decisions.md` E71 | not re-runnable (code and data deleted with E71); cite as the decision's finding | values are approximate, fixed by the decision record only |

### Page counts (four definitions, never mix)

| Definition | Value | Meaning |
|---|---|---|
| Bibliographic | 7,186 | masterfile text level, all 325 catalog texts incl. non-digitized |
| Physical | 4,152 | pages of the 286 delivered PDFs (pypdfium2) |
| OCR-processed | 4,122 | pipeline state, volatile under re-OCR, do not cite |
| TEI `<pb>` | 4,115 | page breaks across the 285 final TEI |

Recommendation: the paper cites the physical count ("4,152 pages across 286 delivered
PDFs") as corpus size, and 4,115 only when describing the TEI output itself, naming the
definition in both cases. The submitted abstract says "286 PDF-Dokumente (4152 Seiten)",
which matches the physical definition.

## 2. SZD pipeline

| Claim | Value | Source of record | Verification | Caveat |
|---|---|---|---|---|
| Corpus | backup 2,107 directory entries, 18,719 images, ~23.6 GB; TEI-canonical dedup 2,069 objects (127 / 169 / 621 / 1,152) | szd `knowledge/data-overview.md` | `python pipeline/transcribe.py --all --dry-run`; regression `pipeline/test_canonical_collection.py` | 34 lebensdokumente objects are cross-listed under korrespondenzen, so 2,107 double-counts them |
| Exports | 2,069 Page-JSON v0.2 + 2,069 METS; 25 layout JSON (stratified ~1 % pilot) | teiCrafter `knowledge/integration.md` section 5 | recount over `szd/results/*/*_page.json` (2026-06-09: 2,069 confirmed) | most objects have text only, no regions |
| Converter parity | Python port byte-identical to the reference prototype: 5/5 on the handful (1 skipped, upstream dedup), open points resolved over a 151-object spread | teiCrafter `knowledge/converter-reference.md` sections 9 and 10 | `node test/tools/port_parity.mjs` (re-run 2026-06-09: 5/5) | older "6/6" mentions are stale (corrected in d5c6231) |
| Full-corpus sweep | 2,069/2,069 converted and byte-identical through the engine, 0 parse errors, 39 empty/all-blank objects (valid) | teiCrafter `knowledge/goals.md` M1.5, M4.4 | `node test/tools/szd_loadability_sweep.mjs` (re-run 2026-06-09, exit 0) | needs the szd sibling checkout; regenerates `output/szd-tei/` each run |
| Verification tiers | 4 tiers plus default: gt_verified, approved, agent_verified, needs_review, unreviewed | szd `knowledge/verification-concept.md` section 8.2 | documented model; per-object fields in `results/*/*_{model}.json` | agent_verified is a middle tier, not a substitute for human review |
| needs_review share | live 16.4 % (340/2,069) on 2026-06-09 | szd `knowledge/evaluation-results.md` (v1.5 calibration) | recount over `results/*/*_page.json` quality.needs_review | the documented 27 % (355/1,319) is stale (smaller corpus); recompute at submission time |
| Accuracy by script | print 99.6 to 99.9 %, Fraktur 99.7 to 99.8 %, Kurrent spread 90 % (hasty) to 99.7 % (clean), 33 letter confusions across 8 Kurrent objects | szd `knowledge/evaluation-results.md` sections 3, 4.2 | fixed by the session 18 to 20 review record (58 objects, 14 human-approved + 44 agent-verified) | estimated accuracy from visual review, NOT char-exact CER against ground truth; n=58 of 2,069 |
| Hallucination finding | at illegible Kurrent the VLM invents real words instead of emitting `[?]`; 0 uncertainty markers over 6,711 Kurrent chars (o_szd.72); named examples in o_szd.2217 | szd `knowledge/evaluation-results.md` 4.1 to 4.3; `verification-concept.md` session 8 | fixed by the documented error analysis with named objects | qualitative pattern from the 58-object sample, not a corpus rate |

## 3. teiCrafter

| Claim | Value | Source of record | Verification | Caveat |
|---|---|---|---|---|
| Byte-identical round-trip | 295/295 (285 Hersch + 5 SZD + 5 synthetic) | `knowledge/testing.md` (Engine Proofs) | `node test/tools/roundtrip_sweep.mjs` (re-run 2026-06-10: PASSED 295/295; the 2026-06-09 run reported 294/294 before the fifth SZD file entered the sweep) | reads the sibling source repos directly |
| Hersch loadability | 285/285 usable editor view (folios, cells, reading text) | `knowledge/testing.md` | `node test/tools/hersch_loadability.mjs` (re-run 2026-06-09: PASS) | layer-2 projection check, not semantic correctness |
| Feature regressions | szd_demo_check 32/32, note_create_check 15/15, ai_proposal_check 17/17, criticism_check 47/47, whitespace_edit_check 14/14 | `knowledge/testing.md` (Feature Proofs) | `node test/tools/<name>.mjs` (all re-run 2026-06-09) | each feature ships its own byte-clean regression test (M4.3) |
| SZD worked example | o_szd.1079 end-to-end, 38 checks, 12 surgical edits | `knowledge/worked-example-szd.md` (M7.2 SZD half) | `node test/tools/szd_worked_example.mjs` (re-run 2026-06-09: PASS) | one object; corpus claims are carried by the 2,069 sweep |
| ZBZ worked example | doc 1000 end-to-end, 38 checks, 11 surgical edits, graphic urls on all 4 surfaces | `knowledge/worked-example-zbz.md` (M7.2 ZBZ half) | `node test/tools/zbz_worked_example.mjs` (first run 2026-06-09: PASS) | engine proof; browser paths await operator sight-check; the object is local-only (rights stance as zbz-100), materialized via `make_zbz1000_demo.mjs`, the proof SKIPs without it |
| Curated example set (M7.4) | 2 objects generated and verified: zbz-1000 (8 curation steps, 11 engine splices, diff +17/-5 lines) and o_szd.1079 (9 steps, 12 splices, +18/-5); 2 proposed objects pending operator sign-off | `knowledge/curated-set.md` | `node test/tools/make_curated_set.mjs` (first run 2026-06-09: PASS; diff line counts cross-checked against `git diff --no-index --stat`) | pairs live under gitignored `output/curated-set/` (Hersch rights stance); ZBZ after-file not yet fully schema-valid pending the standOff/name extension |

## 4. Corrections this sheet supersedes

1. CER median 1.83 % / mean 4.26 % (used in earlier planning notes and in
   `integration.md` section 4) is superseded by the 2026-06-08 corrected run:
   median 1.40 %, mean 2.71 %.
2. SZD needs_review "~27 %" is stale; live value 16.4 % (340/2,069), recompute at
   submission.
3. ZBZ workflow states: three (E77), not four.
4. Any "6/6" port-parity figure is stale; the current proof is 5/5 with one
   upstream-deduped skip.
