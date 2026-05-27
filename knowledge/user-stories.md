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
updated: 2026-05-27
language: en
version: 0.3
topics: ["[[Scholar-Centered Design]]", "[[User Stories]]"]
related: [specification, architecture, design]
---

# teiCrafter User Stories

Acceptance scenarios for the Generator-path prototype (Phase 2) and selected Phase 3 stories, in "As a ... I want ... so that ..." form. Each is manually verifiable in the browser without an automated framework; LLM stories need a valid API key. The Editor-path stories (Wenzelsbibel) are specified separately in the editorial guidelines and grow with that build.

Status: **Integrated** (module implemented and wired into app.js), **Module ready** (implemented, not yet wired), **Open**, **Phase 3**.

## Step 0: Editor Foundation

- **0.1** As an editor I want TEI-XML shown with syntax highlighting so that I grasp document structure. *Module ready.*
- **0.2** As an editor I want to scroll a 500-line document without highlight drift so that I can work in long documents. *Module ready (overlay spike, the foundational architecture test).*
- **0.3** As an editor I want gutter line numbers so that I can locate validation errors and review comments. *Module ready.*
- **0.4** As an editor I want document-level undo/redo so that I can revert erroneous edits or transforms (a transform reverts as one unit). *Module ready (snapshot-based).*

## Step 1: Import

- **1.1** As an editor I want to load plaintext via drag-and-drop or picker so that I can begin annotation; each paragraph becomes a `<p>`, text character-accurate. *Integrated.*
- **1.2** As an editor I want to load existing TEI so that I can continue annotating it, unchanged (whitespace preserved). *Integrated.*
- **1.3** As an editor I want a comprehensible error for malformed XML so that I can fix it; the file is not loaded. *Integrated.*

## Step 2: Mapping

- **2.1** As an editor I want to choose which annotation types the LLM applies so that I control annotation precisely. *Integrated.*
- **2.2** As an editor I want to inspect the assembled prompt (base, context, mapping layers) before sending so that the process stays transparent. *Module ready.*

## Step 3: Transform

- **3.1** As an editor I want to send the TEI body to an LLM and receive annotated TEI so that I can review the proposal; output must be well-formed. *Integrated.*
- **3.2** As an editor I want a diff summary after transform (counts plus highlighted new annotations) so that I can judge plausibility before accepting. *Module ready.*
- **3.3** As an editor I want confidence visually encoded so that I allocate review time effectively. *Module ready.*

## Step 4: Review

- **4.1** As an editor I want to click an annotation and accept, edit or reject it so that I evaluate each individually (reject keeps the text, removes the tag). *Module ready.*
- **4.2** As an editor I want keyboard batch review (N/A/R/E) so that I review efficiently. *Module ready.*
- **4.3** As an editor I want a progress indicator (reviewed vs open) so that I gauge progress. *Module ready.*

## Step 5: Validation

- **5.1** As an editor I want plaintext comparison so that no transcription content is lost during annotation. *Integrated.*
- **5.2** As an editor I want schema validation with line numbers and clickable errors so that I detect structural errors. *Integrated.*

## Step 6: Export

- **6.1** As an editor I want to download finished TEI-XML so that I can process it downstream (ediarum, oXygen, GAMS). *Integrated.*
- **6.2** As an editor I want a warning when exporting unreviewed annotations so that I do not treat proposals as finished. *Module ready.*

## Cross-Cutting: LLM Configuration

- **Q.1** As an editor I want to enter an API key (session only, never persisted) so that the app can generate annotations. *Integrated.*
- **Q.2** As an editor I want to choose among providers so that I am not vendor-locked. *Integrated.*

## End-to-End

- **E2E.1** As an editor I want to run the complete workflow (import, transform with a real LLM, review with confidence, validate, export) on a real document so that the core value is proven. *Open. The central validation story for the walking-skeleton-first strategy; binds 1.1, 2.1, 3.1, 3.3, 4.1, 5.1, 5.2, 6.1.*

## Phase 3: teiModeller

- **M.1** As an editor I want to ask a modelling question ("how do I annotate currency amounts?") and get a reasoned proposal with element, attributes and example. *Phase 3.*
- **M.2** As an editor I want to adopt an accepted proposal as a mapping rule so that future transforms use it. *Phase 3.*

## Status Summary

Of 21 prototype stories, 10 are fully integrated (Import 1.1 to 1.3, Mapping 2.1, Transform 3.1, Validation 5.1 to 5.2, Export 6.1, LLM config Q.1 to Q.2) and 11 are module-ready but not wired (Editor Foundation 0.1 to 0.4, Review 4.1 to 4.3, Transform 3.2 to 3.3, Export 6.2), because the view modules (editor.js, preview.js) are not yet imported into app.js. The one open prototype story is the end-to-end test. The critical gap is wiring, not missing implementation; see [architecture](architecture.md).

## Related

- [specification](specification.md) for the requirements these stories realise
- [architecture](architecture.md) for integration status
- [design](design.md) for the components the stories exercise
