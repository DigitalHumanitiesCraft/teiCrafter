---
title: teiCrafter Goals and Milestones
project:
  name: teiCrafter
  repository: https://github.com/DigitalHumanitiesCraft/teiCrafter
method:
  name: Promptotyping
  url: https://lisa.gerda-henkel-stiftung.de/digitale_geschichte_pollin
template:
  name: Vorlage Goals
  version: 0.1
status: active
created: 2026-06-07
updated: 2026-06-07
language: en
version: 0.4
topics: ["[[Project Goals]]", "[[Milestones]]", "[[Coordination]]"]
related: [integration, project, specification, testing]
---

# teiCrafter Goals and Milestones

The goal register for the three-project effort (teiCrafter, zbz-ocr-tei, szd-htr). It
records the main goals (H1 to H7), their milestones (sub-goals), status, and owner. This
is the on-disk gate plan called for in [integration.md](integration.md) section 10.3.
Coordination, data flow, and the per-Claude task prompts live in
[integration.md](integration.md); this document is the objectives only.

## Frame (defined 2026-06-07 with the project lead)

- **Purpose:** the Editopia talk and paper. Its submitted thesis: agent-based editorial
  workflows need an epistemic infrastructure, that is, mechanisms, steps, and tools to verify,
  curate, and document the results of LLM-assisted steps. teiCrafter is a concrete piece of that
  infrastructure (a deterministic tool where a human verifies and curates machine output) and the
  third Promptotyping case alongside the SZD and ZBZ pipelines.
- **End product (the whole project):** all implementations (teiCrafter, szd, zbz), the slide texts
  and the full paper text, and all knowledge documents in the three repos. CC1 orchestrates all
  Claude Codes, itself included; the channel to CC2 and CC3 runs through the project lead.
- **Success criterion (the demo gate):** one real ZBZ object and one real SZD object
  taken end-to-end in the browser: open, correct line by line, annotate persons, places,
  and works with authority identifiers (GND / GeoNames / Wikidata), save byte-faithfully.
- **Scope:** the full goal is everything (entity enrichment plus editorial annotation).
  Demo-critical is entity enrichment, notes, and image display; the rest proceeds in
  parallel and does not gate the demo.
- **Way of working:** three parallel workstreams, ordered only by dependencies. CC1 is
  teiCrafter engine/editor/annotation; CC2 is the szd-htr converter; CC3 is the
  zbz-ocr-tei frontend.

Legend: **(*)** demo-critical (needed for the success criterion); **(+)** full ambition
(parallel, does not gate the demo). Status: done / in progress / open. Every "done" line
cites a re-runnable proof.

## H1 - Bring both pipelines into teiCrafter

- (*) **M1.1** ZBZ `{id}_final.xml` loads directly. **done** -- `node test/tools/hersch_loadability.mjs` (285/285 usable editor view). CC1
- (*) **M1.2** SZD converter reference (`knowledge/converter-reference.md`, full Page-JSON v0.2 to TEI mapping). **in progress** -- prototype byte-verified for o_szd.100; SZD data model finalized; to be written up. CC1 (blocks CC2)
- (*) **M1.3** SZD batch converter `pipeline/export_tei.py`. **open** -- CC2
- (*) **M1.4** SZD: produce and engine-verify the demo example TEI. **open** -- CC1
- (+) **M1.5** SZD: convert all ~2103 objects + loadability sweep. **open** -- CC1/CC2

## H2 - See, navigate, correct

- (*) **M2.1** Editor model per file (folios / lines / cells). **done** -- `node test/tools/hersch_loadability.mjs`. CC1
- (*) **M2.2** Image display for opened files (`<graphic>` support). **done (engine side); browser-visual test open** -- `readSurfaces` reads `<graphic url>` (`tei-document.js`), `renderFacsimile` falls back to `surface.graphic` (`editor-app.js`); proof `node test/tools/szd_demo_check.mjs`. Open: confirm the GAMS image actually renders in OpenSeadragon (CORS) in a browser. CC1
- (*) **M2.3** Live browser pass over ZBZ (large docs, empty folios, zone linking, rendering of hi/foreign/note/choice/unclear/figure). **open** -- CC3
- (*) **M2.4** ZBZ image-URL scheme delivered for `<graphic>` injection (images committed only for docs 1000 / 1330 / 1540 / 2310, so a ZBZ demo object with image must be one of these four). **open** -- CC3

## H3 - Semantic annotation

- (*) **M3.1** Place entity type (`place` / `placeName`) in `standoff.js` + `index-panel.js`. **done** -- place added to `TYPE_MAP`/`ENTITY_TO_TYPE`/`ID_PREFIX` + `readEntities` (`standoff.js`) and a Places section (`index-panel.js`); proof `node test/tools/szd_demo_check.mjs` (add/read/link place, byte-clean). CC1
- (*) **M3.3** Authority `@ref` (GND / GeoNames / Wikidata) on all entity types + editor UI. **open** -- CC1. Decision 2026-06-07: all three population paths on one `@ref` mechanism (hand-entry foundation, then Gemini batch M3.7, then live lookup); hand-entry core buildable now, no longer blocked.
- (*) **M3.4** Mention linking extended to the new entity types. **done** -- `linkMention` is type-independent (wraps `<name ref="#id">` for any entity id); verified for place in `node test/tools/szd_demo_check.mjs`. CC1
- (*) **M3.7** AI annotation proposal: an offline Gemini 3.1 Flash Lite step writes unreviewed entity and authority-id (GND / GeoNames / Wikidata) suggestions into `<standOff>`; teiCrafter shows them violet for human review. **open** -- CC1/CC2 (the minimal gate also works by manual annotation). Note: ZBZ TEI has no entities (NER removed E71 on 2026-05-27), so ZBZ annotation is created fresh in teiCrafter.
- (+) **M3.2** Work entity (`title` / `bibl`). **open** -- CC1
- (+) **M3.5** Note / footnote / comment creation UI (today read-only). **open** -- CC1
- (+) **M3.6** Editorial markup (`unclear` / `gap` / `del` / `add` from pipeline markers). **open** -- CC1

## H4 - Losslessness as a standing invariant

- (*) **M4.1** Engine round-trip sweep byte-identical. **done** -- `node test/tools/roundtrip_sweep.mjs`. CC1
- (*) **M4.2** Editor loadability sweep. **done** -- `node test/tools/hersch_loadability.mjs`. CC1
- (*) **M4.3** Every new feature stays byte-clean (per-feature regression test). **ongoing** -- CC1
- (*) **M4.4** SZD-converted TEI byte-clean through `tei-document.js` / `standoff.js`. **open** -- CC1

## H5 - Coordination, verification, documentation

- (*) **M5.1** Canonical `integration.md` + `HANDOFF-claudes.md` in both repos. **done** -- on disk (CC2)
- (*) **M5.4** Project-status presentation (part of the paper demo). **open** -- CC1
- (+) **M5.2** Enrich `integration.md` with proof evidence + correct the "blocker not on disk" status. **open** -- CC1
- (+) **M5.5** Report correctness: the 3-vs-4 status value count; missing quantitative validation numbers; correct `oekosystem-synthese.md` (EditionCrafter v0, not teiCrafter, is the Editopia Hersch demo). **open** -- CC2/CC3
- (+) **M5.6** Doc sync (`data.md` / `architecture.md` for the SZD converter and the new editor test). **open** -- CC1

## H6 - Maintain the knowledge vaults (Promptotyping method, paper reproducibility)

- (+) **M6.1** Keep teiCrafter `knowledge/` current. **ongoing** -- CC1
- (+) **M6.2** Keep szd-htr `knowledge/` current. **ongoing** -- CC2
- (+) **M6.3** Keep zbz-ocr-tei `knowledge/` current. **ongoing** -- CC3

## H7 - Editopia contribution and demo material (teiCrafter as a Promptotyping case)

- (*) **M7.1** teiCrafter as a presentable Promptotyping case (the tool plus its provenance in vault and repo). **open** -- CC1
- (*) **M7.2** Two annotated worked examples (one ZBZ and one SZD object, end-to-end in the editor). This is the success criterion. **open** -- CC1
- (+) **M7.3** Contribution to the slide set and the full text where teiCrafter is concerned. **open** -- CC1

## Critical path to the demo

The longest dependency chain is the SZD side: **M1.2 (CC1) -> M1.3 (CC2) -> M1.4 (CC1)**.
M1.2 is therefore the top priority. Independent and parallel to it: M3.1 / M3.3 / M3.4
(annotation, CC1, can start now) and M2.3 / M2.4 (CC3) -> M2.2 (CC1, image). Nothing else
blocks across the three streams.

## Verification

Lines marked "done" are backed by the re-runnable commands cited above (exit code 0/1,
not assertion). The frame items (purpose, success criterion, priority, scope) were
confirmed with the project lead on 2026-06-07. Each statement here is therefore either
machine-checked or lead-confirmed; nothing rests on unverified claim.

The acceptance method (how we judge, simply, that each goal is reached): two layers, one proof per
demo-critical goal, either a re-runnable command or an observable frontend check. The full checklist
lives in [project-plan.md](project-plan.md) section 17.
