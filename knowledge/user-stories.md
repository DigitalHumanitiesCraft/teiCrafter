---
title: teiCrafter User Stories
project:
  name: teiCrafter
  repository: https://github.com/DigitalHumanitiesCraft/teiCrafter
method:
  name: Promptotyping
  url: https://lisa.gerda-henkel-stiftung.de/digitale_geschichte_pollin
template:
  name: Vorlage User Stories
  version: 0.1
  url: https://dhcraft.org/Promptotyping/promptotyping-document/user-stories
status: active
created: 2026-02-05
updated: 2026-06-08
language: en
version: 0.6
topics: ["[[Scholar-Centered Design]]", "[[User Stories]]"]
related: [specification, architecture, design]
---

# teiCrafter User Stories

Acceptance scenarios in "As a ... I want ... so that ..." form. Status reflects the editor-first consolidation (2026-05-30): **Built** (implemented and verified, headlessly or by serving), **Browser-check** (built, needs a human click-through), **Partially built** (one part shipped, one part still specified), **Future** (specified, not built). LLM stories need a valid API key.

## Editing Any TEI

- **E.1** As an editor I want to open a TEI edition from my local disk so that I can work without a server. *Built* (File System Access API, file-input fallback, served synthetic demo).
- **E.2** As an editor I want the edition split into folios I can page through so that I navigate a long document. *Built* (`<pb>` segmentation, prev/next).
- **E.3** As an editor I want the reading text rendered cell by cell, word-level when the TEI has `<w>` and line-level otherwise, so that I edit at the document's natural granularity. *Built* (profile emerges; proven on Wenzelsbibel word-level and Hersch line-level).
- **E.4** As an editor I want to click a word or line and correct it in place so that fixing OCR or transcription errors is direct; nothing else in the file changes. *Built* (lossless offset splice; surgical-edit proof).
- **E.5** As an editor I want my save to change nothing I did not edit so that the edition stays byte-faithful. *Built* (byte-identical round-trip on 294/294 real files).
- **E.6** As an editor I want to save in place or download so that I keep my work. *Browser-check* (File System write-in-place is Chromium-only; download is universal).

## Facsimile

- **F.1** As an editor I want to see the folio's zones and have text and zone highlight each other so that I relate text to image regions. *Built* (real `@facs` link in Hersch, positional fallback; `<zone>` overlays drawn on the viewer, bidirectionally linked to the reading text).
- **F.2** As an editor I want real page images with deep zoom and pan so that I read the manuscript itself. *Built* (a real OpenSeadragon 5.0.1 deep-zoom viewer, plain-image tileSource with an IIIF-ready hook; verified live in the browser).

## Validation

- **V.1** As an editor I want a live well-formedness and structural-integrity check so that I see immediately if an edit broke something or lost content. *Built* (browser-light panel vs load-time baseline).
- **V.2** As an editor I want full schema validation (TEI All RelaxNG + Schematron) on demand so that I catch structural errors. *Built, offline* (the Node + Python/lxml harness; not yet wired as an in-browser button).

## LLM On-Ramp

- **L.1** As an editor I want to paste plaintext and have a model draft an initial TEI that opens in the editor so that I have a starting point to refine. *Built* (the "New from text (LLM)" modal).
- **L.2** As an editor I want generated content clearly marked as machine-made and unreviewed so that I never mistake a draft for finished work. *Built* (violet marking, unreviewed banner).
- **L.3** As an editor I want my API key kept in memory only and never persisted so that my credentials are safe. *Built* (module-scoped Map in llm.js, `credentials: 'omit'`).
- **L.4** As an editor I want to choose among providers so that I am not vendor-locked. *Built* (six providers).

## Index and StandOff

- **I.1** As an editor I want to create, rename and delete entries for all five entity types (person, place, org, event, work) in an in-browser index so that the edition's `<standOff>` stays authoritative and editable. *Built* (lossless `<standOff>` model in `standoff.js`, index UI in `index-panel.js`, all inside the offset-splice engine).
- **I.2** As an editor I want to link an in-text mention to an index entry so that the word carries `<name ref="#id">`. *Built* (verified live: linking produces `<w><name ref="#id">...</name></w>`).
- **I.3** As an editor I want to select a word or line range and attach an editorial-apparatus or commentary note so that the tool writes the anchor and the note body. *Built* (M3.5; lossless `<note target="#id">` in `<standOff>`, anchor via ancestor `xml:id`, else line `@facs`, else injected `xml:id`, in `standoff.js`; "Add note" UI mode; proof `node test/tools/note_create_check.mjs` (15/15)).
- **I.4** As an editor I want to enter or edit external authority ids on an index entry from the UI, with a live lookup against Wikidata, GND and GeoNames, so that I do not have to copy ids by hand. *Built* (M3.3; hand-entry stored as `<idno type="GND|GeoNames|Wikidata">` children via `setAuthority` in `standoff.js`, authority field per row in `index-panel.js`; live lookup URL-builder and parser in `services/authority-lookup.js` with an index-panel "find" button and result popover; proof `node test/tools/authority_lookup_check.mjs` (15/15), fetch browser-verified).
- **I.5** As an editor I want a model to propose entities that arrive unreviewed and gated so that I can confirm or reject each one before it counts. *Built* (M3.7; an LLM proposes entities inserted unreviewed as `resp="#ai"` (TEI-valid, lossless) and rendered violet, the human confirms via `confirmEntity` which removes the marker or rejects via `deleteEntity`, in `docs/js/editor/ai-suggest.js`; proofs `node test/tools/ai_proposal_check.mjs` (17/17, mark, gate, confirm/reject byte-identical) and `node test/tools/ai_suggest_parse_check.mjs` (8/8)).

## Future (specified, not built)

- **FU.3** Form-based authoring views per project module (e.g. diplomatic transcription, Bible-verse).
- **FU.4** Convert pipeline Page-JSON (SZD) to minimal editable TEI before opening. *Partially built* (the SZD converter exists and round-trips byte-identically, `pipeline/export_tei.py`, frozen contract in `converter-reference.md`; only the in-editor pre-open integration, converting on the fly when opening a Page-JSON object, remains).
- **FU.5** Open and edit very large editions (tens of MB) with a segmented load.

## Related

- [specification](specification.md) for the requirements these realise
- [architecture](architecture.md) for how they are implemented
- [design](design.md) for the components they exercise
