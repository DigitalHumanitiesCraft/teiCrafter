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
updated: 2026-06-04
language: en
version: 0.4
topics: ["[[Scholar-Centered Design]]", "[[User Stories]]"]
related: [specification, architecture, design]
---

# teiCrafter User Stories

Acceptance scenarios in "As a ... I want ... so that ..." form. Status reflects the editor-first consolidation (2026-05-30): **Built** (implemented and verified, headlessly or by serving), **Browser-check** (built, needs a human click-through), **Future** (specified, not built). LLM stories need a valid API key.

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

- **I.1** As an editor I want to create, rename and delete person/org/event entries in an in-browser index so that the edition's `<standOff>` stays authoritative and editable. *Built* (lossless `<standOff>` model in `standoff.js`, index UI in `index-panel.js`, all inside the offset-splice engine).
- **I.2** As an editor I want to link an in-text mention to an index entry so that the word carries `<name ref="#id">`. *Built* (verified live: linking produces `<w><name ref="#id">...</name></w>`).

## Future (specified, not built)

- **FU.1** Select a word/line range and attach an editorial-apparatus or commentary note; the tool writes the anchor and the note body. *Future* (the existing `standOff` `<note>` bodies are currently read-only).
- **FU.2** Enter or edit external authority ids on an index entry from the UI. *Future*.
- **FU.3** Form-based authoring views per project module (e.g. diplomatic transcription, Bible-verse).
- **FU.4** Convert pipeline Page-JSON (SZD) to minimal editable TEI before opening.
- **FU.5** Open and edit very large editions (tens of MB) with a segmented load.

## Related

- [specification](specification.md) for the requirements these realise
- [architecture](architecture.md) for how they are implemented
- [design](design.md) for the components they exercise
