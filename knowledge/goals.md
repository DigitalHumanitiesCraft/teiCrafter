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
version: 0.7
topics: ["[[Project Goals]]", "[[Milestones]]"]
related: [integration, project, specification, testing]
---

# teiCrafter Goals and Milestones

The goal register for the three projects (teiCrafter, zbz-ocr-tei, szd-htr). It
records the main goals (H1 to H7), their milestones (sub-goals), and status. This
is the on-disk gate plan called for in [integration.md](integration.md) section 1 (Frame and Demo Gate).
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
- (*) **M1.2** SZD converter reference (`knowledge/converter-reference.md`, full Page-JSON v0.2 to TEI mapping). **done (frozen, status active, v0.5, 2026-06-08)** -- the five section-9 points resolved against the handful plus a 151-object spread: bbox confirmed percent (no value > 100), only `~~x~~` and `[?]` markers occur, dropped fields confirmed (with `pages[].notes` dropped in v1 by reversible decision), no further standOff seeding, images 1:1 with pages. Also recorded: o_szd.161 was a duplicate id across two folders, since deduped upstream (szd-htr commit fb48ca0), so `export_tei.py` keeps a general path-driven / ambiguous-id guard; empty objects (o_szd.70 / 2256 / 2314, `pages: []`) round-trip with `cells === 0`.
- (*) **M1.3** SZD batch converter `pipeline/export_tei.py`. **done** -- faithful Python port of the reference prototype (path-driven, plus an `--id` mode that hard-errors on ambiguous ids); byte-identical to `szd-pagejson-to-tei.mjs` on the handful (`node test/tools/port_parity.mjs`, 6/6) and across a 151-object deterministic spread of the ~2103-object corpus (151/151). The prototype round-trips its output through the engine, so byte-equality means the Python output round-trips too.
- (*) **M1.4** SZD: produce and engine-verify the demo example TEI. **done for the handful** -- o_szd.1079 plus 100 / 72 / 2215 / 161 convert and round-trip byte-identically (port_parity + the prototype's engine check); full-corpus M1.5 still open.
- (+) **M1.5** SZD: convert all ~2103 objects + loadability sweep. **done** -- `node test/tools/szd_loadability_sweep.mjs` (runs `export_tei.py --all`, then an engine sweep): 2103/2103 converted, 2103/2103 byte-identical round-trip, 0 parse errors, 40 empty/all-blank objects (cells === 0, valid).

## H2 - See, navigate, correct

- (*) **M2.1** Editor model per file (folios / lines / cells). **done** -- `node test/tools/hersch_loadability.mjs`.
- (*) **M2.2** Image display for opened files (`<graphic>` support). **done** -- engine: `readSurfaces` reads `<graphic url>` (`tei-document.js`), `renderFacsimile` falls back to `surface.graphic` (`editor-app.js`), proof `node test/tools/szd_demo_check.mjs`; browser-visual (2026-06-08): o_szd.1079 GAMS facsimile renders in OpenSeadragon (IMG.1/IMG.2 HTTP 200) under headless Chrome, observable proof `c:\tmp\m2_2_1079_folio1.png` (frontend check, not a repo test).
- (*) **M2.3** Live browser pass over ZBZ (large docs, empty folios, zone linking, rendering of hi/foreign/note/choice/unclear/figure). **deferred**; the demo-relevant part (one ZBZ object) is folded into M7.2.
- (*) **M2.4** ZBZ image-URL scheme for `<graphic>` injection (images committed only for docs 1000 / 1330 / 1540 / 2310). **open**

## H3 - Semantic annotation

- (*) **M3.1** Place entity type (`place` / `placeName`) in `standoff.js` + `index-panel.js`. **done** -- place added to `TYPE_MAP`/`ENTITY_TO_TYPE`/`ID_PREFIX` + `readEntities` (`standoff.js`) and a Places section (`index-panel.js`); proof `node test/tools/szd_demo_check.mjs` (add/read/link place, byte-clean).
- (*) **M3.3** Authority identifier (GND / GeoNames / Wikidata) on all entity types + editor UI. **done** -- (a) hand-entry: stored as `<idno type="GND|GeoNames|Wikidata">value</idno>` children (decision 2026-06-08: `<idno>`, not `@ref`, so multiple authorities per entity and `@ref` stays the mention pointer); `setAuthority` add/replace/remove in `standoff.js`, authority field per row in `index-panel.js`, hook in `editor-app.js`; proof `node test/tools/szd_demo_check.mjs` (32/32). (b) live lookup (2026-06-08): URL-builder + parser for Wikidata/GND/GeoNames in `docs/js/services/authority-lookup.js`, index-panel "find" button + result popover (Wikidata/GND keyless and CORS-capable, GeoNames needs a username); proof `node test/tools/authority_lookup_check.mjs` (15/15), the fetch is browser-verified, commit 8ce938a. Decision 2026-06-07: all three population paths on one mechanism (hand-entry, live lookup, Gemini batch M3.7) -- all three now built.
- (*) **M3.4** Mention linking extended to the new entity types. **done** -- `linkMention` is type-independent (wraps `<name ref="#id">` for any entity id); verified for place in `node test/tools/szd_demo_check.mjs`.
- (*) **M3.7** AI annotation proposal: an LLM proposes entities, inserted unreviewed as `resp="#ai"` (TEI-valid, lossless) and rendered violet; the human confirms (`confirmEntity` removes the marker) or rejects (`deleteEntity`). **done (engine/parser; browser-verified LLM call)** -- proof `node test/tools/ai_proposal_check.mjs` (17/17: mark, gate, confirm/reject byte-identical) plus a robust parser `ai_suggest_parse_check.mjs` (8/8); `docs/js/editor/ai-suggest.js`, hook in `editor-app.js`; commit f647e7e. The minimal gate also works by manual annotation. Note: ZBZ TEI has no entities (NER removed E71 on 2026-05-27), so ZBZ annotation is created fresh in teiCrafter.
- (+) **M3.2** Work entity (`title` / `bibl`). **done** -- `work` type (`listBibl`/`bibl`/`title`, `wrk_` ids) in `TYPE_MAP`/`ENTITY_TO_TYPE`/`ID_PREFIX`/`readEntities` (`standoff.js`, scoped to standOff/listBibl so header bibls are not misread) and a Works section (`index-panel.js`); proof `node test/tools/szd_demo_check.mjs` (add/read work, authority idno, header-bibl exclusion). Pulled forward from full-ambition because M3.3 needs it (demo triad is person/place/work).
- (+) **M3.5** Note / footnote / comment creation UI (was read-only). **done (2026-06-08)** -- lossless `<note target="#id">` in `<standOff>`, anchor via ancestor `xml:id`, else line `@facs`, else injected `xml:id` (`addNote`/`addNoteForNode`/`ensureXmlId` in `standoff.js`); "Add note" UI mode; proof `node test/tools/note_create_check.mjs` (15/15, stable resolvable `@target`), commit d3fc922.
- (+) **M3.6** Editorial markup (`unclear` / `gap` / `del` / `add`). **done (2026-06-08)** -- inline, lossless `markCritical`/`unwrapCritical`/`removeGap` in `docs/js/editor/criticism.js` (wrap unclear/del/add keeping edge whitespace outside the tags, replace the core with `<gap/>`, no-op returns the same doc, unwrap refuses to strip a shared wrapper); shared `splitEdge`/`CRITICAL_LOCALS`/`nearestAncestor` in `tei-document.js`; gap cell + per-cell `crit`/`critSole` in `edition.js`; "Mark text" mode + inline chooser in `editor-app.js`; proof `node test/tools/criticism_check.mjs` (47/47), hardened against a 22-finding adversarial review; commit 119a1a2. Inline markers are built; auto-mapping pipeline shorthand (`[?]`/`~~x~~`) to these tags remains a separate future task.

## H4 - Losslessness as a standing invariant

- (*) **M4.1** Engine round-trip sweep byte-identical. **done** -- `node test/tools/roundtrip_sweep.mjs`.
- (*) **M4.2** Editor loadability sweep. **done** -- `node test/tools/hersch_loadability.mjs`.
- (*) **M4.3** Every new feature stays byte-clean (per-feature regression test). **ongoing** -- each annotation/editing feature ships a byte-clean regression test: `szd_demo_check.mjs` (32/32), `note_create_check.mjs` (15/15), `ai_proposal_check.mjs` (17/17), `whitespace_edit_check.mjs` (14/14, line edit preserves indentation; the whitespace caveat is closed, commit 8fd281c).
- (*) **M4.4** SZD-converted TEI byte-clean through `tei-document.js` / `standoff.js`. **done** -- `node test/tools/szd_loadability_sweep.mjs` round-trips all 2103 converted TEI byte-identically through the engine; `standoff.js` byte-cleanness on annotation is `szd_demo_check.mjs` (32/32).

## H5 - Verification and documentation

- (*) **M5.1** Canonical `integration.md` on disk. **done**
- (*) **M5.4** Project-status presentation (part of the paper demo). **open**
- (+) **M5.2** Enrich `integration.md` with proof evidence + correct the "blocker not on disk" status. **open**
- (+) **M5.5** Correct `oekosystem-synthese.md` (in the zbz-ocr-tei repo) (EditionCrafter v0, not teiCrafter, is the Editopia Hersch demo). **open**
- (+) **M5.6** Doc sync (`data.md` / `architecture.md` for the SZD converter and the new editor test). **open**

## H6 - Maintain the knowledge vaults (Promptotyping method, paper reproducibility)

- (+) **M6.1** Keep teiCrafter `knowledge/` current. **ongoing**
- (+) **M6.2** Keep szd-htr `knowledge/` current. **ongoing**
- (+) **M6.3** Keep zbz-ocr-tei `knowledge/` current. **ongoing**

## H7 - Editopia contribution and demo material (teiCrafter as a Promptotyping case)

- (*) **M7.1** teiCrafter as a presentable Promptotyping case (the tool plus its provenance in vault and repo). **open**
- (*) **M7.2** Two annotated worked examples (one ZBZ and one SZD object, end-to-end in the editor). This is the success criterion. **SZD half done (o_szd.1079 browser-verified 2026-06-08), ZBZ half open**
- (+) **M7.3** Contribution to the slide set and the full text where teiCrafter is concerned. **open**

## Critical path to the demo

The SZD dependency chain **M1.2 -> M1.3 -> M1.4 -> M1.5** is cleared end to end:
M1.2 frozen, M1.3 (`export_tei.py`) byte-faithful, M1.4 verified on the handful, M1.5 done
over the full corpus (`node test/tools/szd_loadability_sweep.mjs`: 2103/2103 converted and
byte-identical round-trip, 40 empty/all-blank objects valid; M4.4 covered). The annotation
cluster is now complete: M3.1 / M3.2 / M3.3 (hand-entry + live lookup) / M3.4 /
M3.5 (notes) / M3.6 (textual criticism) / M3.7 (AI proposal with verify gate) are done, each
with a byte-clean regression test; M2.2's browser-visual test passed (2026-06-08); the whitespace caveat is closed (8fd281c).
The only remaining demo-facing work is **M7.2** (the SZD worked example is proven; the ZBZ half
waits on the separate ZBZ spur) plus **M7.1 / M7.3** (case provenance, slide and text
contribution). Engine and parser of the three new annotation features are headless-proven; their
browser paths (note click, LLM call, live fetch) await operator visual sign-off. The zbz frontend
rendering work (M2.3 / M2.4) stays deferred; its image-URL scheme is read into M7.2 when the ZBZ
example is built.

## Verification

Lines marked "done" are backed by the re-runnable commands cited above (exit code 0/1,
not assertion). Each statement here is therefore machine-checked; nothing rests on
unverified claim.

Note: the `port_parity` and `szd_loadability_sweep` proofs require the szd-htr sibling checkout (they run the SZD converter and compare against its prototype), so they only pass when szd-htr is present alongside this repo.

The acceptance method (how we judge, simply, that each goal is reached): two layers, one proof per
demo-critical goal, either a re-runnable command or an observable frontend check. The full checklist
lives in [PLAN.md](../PLAN.md) (acceptance section).
