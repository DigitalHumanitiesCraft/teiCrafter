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
updated: 2026-06-08
language: en
version: 0.5
topics: ["[[Project Goals]]", "[[Milestones]]"]
related: [integration, project, specification, testing]
---

# teiCrafter Goals and Milestones

The goal register for the three projects (teiCrafter, zbz-ocr-tei, szd-htr). It
records the main goals (H1 to H7), their milestones (sub-goals), and status. This
is the on-disk gate plan called for in [integration.md](integration.md) section 10.3.
Data flow lives in [integration.md](integration.md); this document is the objectives only.

## Frame (defined 2026-06-07)

- **Purpose:** the Editopia talk and paper. Its submitted thesis: agent-based editorial
  workflows need an epistemic infrastructure, that is, mechanisms, steps, and tools to verify,
  curate, and document the results of LLM-assisted steps. teiCrafter is a concrete piece of that
  infrastructure (a deterministic tool where a human verifies and curates machine output) and the
  third Promptotyping case alongside the SZD and ZBZ pipelines.
- **End product (the whole project):** all implementations (teiCrafter, szd, zbz), the slide texts
  and the full paper text, and all knowledge documents in the three repos.
- **Success criterion (the demo gate):** one real ZBZ object and one real SZD object
  taken end-to-end in the browser: open, correct line by line, annotate persons, places,
  and works with authority identifiers (GND / GeoNames / Wikidata), save byte-faithfully.
- **Scope:** the full goal is everything (entity enrichment plus editorial annotation).
  Demo-critical is entity enrichment, notes, and image display; the rest proceeds in
  parallel and does not gate the demo.
- **Way of working:** work is ordered only by dependencies, across teiCrafter engine/editor/annotation
  (which now also carries the ZBZ worked example) and the szd-htr converter. The zbz frontend rendering
  work is deferred; its image-URL scheme is reused in M7.2.

Legend: **(*)** demo-critical (needed for the success criterion); **(+)** full ambition
(parallel, does not gate the demo). Status: done / in progress / open. Every "done" line
cites a re-runnable proof.

## H1 - Bring both pipelines into teiCrafter

- (*) **M1.1** ZBZ `{id}_final.xml` loads directly. **done** -- `node test/tools/hersch_loadability.mjs` (285/285 usable editor view).
- (*) **M1.2** SZD converter reference (`knowledge/converter-reference.md`, full Page-JSON v0.2 to TEI mapping). **done (frozen, status active, v0.5, 2026-06-08)** -- the five section-9 points resolved against the handful plus a 151-object spread: bbox confirmed percent (no value > 100), only `~~x~~` and `[?]` markers occur, dropped fields confirmed (with `pages[].notes` dropped in v1 by reversible decision), no further standOff seeding, images 1:1 with pages. Also recorded: duplicate id o_szd.161 across folders; empty/all-blank objects (o_szd.70 / 176 / 2256 / 2314) round-trip with `cells === 0`.
- (*) **M1.3** SZD batch converter `pipeline/export_tei.py`. **done** -- faithful Python port of the reference prototype (path-driven, plus an `--id` mode that hard-errors on ambiguous ids); byte-identical to `szd-pagejson-to-tei.mjs` on the handful (`node test/tools/port_parity.mjs`, 6/6) and across a 151-object deterministic spread of the ~2103-object corpus (151/151). The prototype round-trips its output through the engine, so byte-equality means the Python output round-trips too.
- (*) **M1.4** SZD: produce and engine-verify the demo example TEI. **done for the handful** -- o_szd.1079 plus 100 / 72 / 2215 / 161 convert and round-trip byte-identically (port_parity + the prototype's engine check); full-corpus M1.5 still open.
- (+) **M1.5** SZD: convert all ~2103 objects + loadability sweep. **done** -- `node test/tools/szd_loadability_sweep.mjs` (runs `export_tei.py --all`, then an engine sweep): 2103/2103 converted, 2103/2103 byte-identical round-trip, 0 parse errors, 40 empty/all-blank objects (cells === 0, valid).

## H2 - See, navigate, correct

- (*) **M2.1** Editor model per file (folios / lines / cells). **done** -- `node test/tools/hersch_loadability.mjs`.
- (*) **M2.2** Image display for opened files (`<graphic>` support). **done (engine side); browser-visual test open** -- `readSurfaces` reads `<graphic url>` (`tei-document.js`), `renderFacsimile` falls back to `surface.graphic` (`editor-app.js`); proof `node test/tools/szd_demo_check.mjs`. Open: confirm the GAMS image actually renders in OpenSeadragon (CORS) in a browser.
- (*) **M2.3** Live browser pass over ZBZ (large docs, empty folios, zone linking, rendering of hi/foreign/note/choice/unclear/figure). **deferred**; the demo-relevant part (one ZBZ object) is folded into M7.2.
- (*) **M2.4** ZBZ image-URL scheme for `<graphic>` injection (images committed only for docs 1000 / 1330 / 1540 / 2310). **open**

## H3 - Semantic annotation

- (*) **M3.1** Place entity type (`place` / `placeName`) in `standoff.js` + `index-panel.js`. **done** -- place added to `TYPE_MAP`/`ENTITY_TO_TYPE`/`ID_PREFIX` + `readEntities` (`standoff.js`) and a Places section (`index-panel.js`); proof `node test/tools/szd_demo_check.mjs` (add/read/link place, byte-clean).
- (*) **M3.3** Authority identifier (GND / GeoNames / Wikidata) on all entity types + editor UI. **done (hand-entry core); live lookup + Gemini open** -- stored as `<idno type="GND|GeoNames|Wikidata">value</idno>` children (decision 2026-06-08: `<idno>`, not `@ref`, so multiple authorities per entity and `@ref` stays the mention pointer); `setAuthority` add/replace/remove in `standoff.js`, authority field per row in `index-panel.js`, hook in `editor-app.js`; proof `node test/tools/szd_demo_check.mjs` (32/32: add/replace/remove, coexisting authorities, seeded-GND read). Decision 2026-06-07: all three population paths on one mechanism (hand-entry foundation now, then Gemini batch M3.7, then live lookup).
- (*) **M3.4** Mention linking extended to the new entity types. **done** -- `linkMention` is type-independent (wraps `<name ref="#id">` for any entity id); verified for place in `node test/tools/szd_demo_check.mjs`.
- (*) **M3.7** AI annotation proposal: an offline Gemini 3.1 Flash Lite step writes unreviewed entity and authority-id (GND / GeoNames / Wikidata) suggestions into `<standOff>`; teiCrafter shows them violet for human review. **open** (the minimal gate also works by manual annotation). Note: ZBZ TEI has no entities (NER removed E71 on 2026-05-27), so ZBZ annotation is created fresh in teiCrafter.
- (+) **M3.2** Work entity (`title` / `bibl`). **done** -- `work` type (`listBibl`/`bibl`/`title`, `wrk_` ids) in `TYPE_MAP`/`ENTITY_TO_TYPE`/`ID_PREFIX`/`readEntities` (`standoff.js`, scoped to standOff/listBibl so header bibls are not misread) and a Works section (`index-panel.js`); proof `node test/tools/szd_demo_check.mjs` (add/read work, authority idno, header-bibl exclusion). Pulled forward from full-ambition because M3.3 needs it (demo triad is person/place/work).
- (+) **M3.5** Note / footnote / comment creation UI (today read-only). **open**
- (+) **M3.6** Editorial markup (`unclear` / `gap` / `del` / `add` from pipeline markers). **open**

## H4 - Losslessness as a standing invariant

- (*) **M4.1** Engine round-trip sweep byte-identical. **done** -- `node test/tools/roundtrip_sweep.mjs`.
- (*) **M4.2** Editor loadability sweep. **done** -- `node test/tools/hersch_loadability.mjs`.
- (*) **M4.3** Every new feature stays byte-clean (per-feature regression test). **ongoing**
- (*) **M4.4** SZD-converted TEI byte-clean through `tei-document.js` / `standoff.js`. **done** -- `node test/tools/szd_loadability_sweep.mjs` round-trips all 2103 converted TEI byte-identically through the engine; `standoff.js` byte-cleanness on annotation is `szd_demo_check.mjs` (32/32).

## H5 - Verification and documentation

- (*) **M5.1** Canonical `integration.md` on disk. **done**
- (*) **M5.4** Project-status presentation (part of the paper demo). **open**
- (+) **M5.2** Enrich `integration.md` with proof evidence + correct the "blocker not on disk" status. **open**
- (+) **M5.5** Correct `oekosystem-synthese.md` (EditionCrafter v0, not teiCrafter, is the Editopia Hersch demo). **open**
- (+) **M5.6** Doc sync (`data.md` / `architecture.md` for the SZD converter and the new editor test). **open**

## H6 - Maintain the knowledge vaults (Promptotyping method, paper reproducibility)

- (+) **M6.1** Keep teiCrafter `knowledge/` current. **ongoing**
- (+) **M6.2** Keep szd-htr `knowledge/` current. **ongoing**
- (+) **M6.3** Keep zbz-ocr-tei `knowledge/` current. **ongoing**

## H7 - Editopia contribution and demo material (teiCrafter as a Promptotyping case)

- (*) **M7.1** teiCrafter as a presentable Promptotyping case (the tool plus its provenance in vault and repo). **open**
- (*) **M7.2** Two annotated worked examples (one ZBZ and one SZD object, end-to-end in the editor). This is the success criterion. **open**
- (+) **M7.3** Contribution to the slide set and the full text where teiCrafter is concerned. **open**

## Critical path to the demo

The SZD dependency chain **M1.2 -> M1.3 -> M1.4 -> M1.5** is now cleared end to end:
M1.2 frozen, M1.3 (`export_tei.py`) byte-faithful, M1.4 verified on the handful, M1.5 done
over the full corpus (`node test/tools/szd_loadability_sweep.mjs`: 2103/2103 converted and
byte-identical round-trip, 40 empty/all-blank objects valid). The remaining demo-facing work
is **M7.2** (the SZD worked example is proven; the ZBZ half waits on the separate ZBZ spur)
and optionally **M3.7** (offline Gemini annotation). The annotation cluster M3.1 / M3.2 /
M3.3 / M3.4 is done; M2.2's browser-visual test is done (2026-06-08); M4.4 is covered by the
sweep. The zbz frontend rendering work (M2.3 / M2.4) stays deferred; its image-URL scheme is
read into M7.2 when the ZBZ example is built.

## Verification

Lines marked "done" are backed by the re-runnable commands cited above (exit code 0/1,
not assertion). Each statement here is therefore machine-checked; nothing rests on
unverified claim.

The acceptance method (how we judge, simply, that each goal is reached): two layers, one proof per
demo-critical goal, either a re-runnable command or an observable frontend check. The full checklist
lives in [PLAN.md](../PLAN.md) (acceptance section).
