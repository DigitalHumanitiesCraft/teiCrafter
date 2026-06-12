---
title: teiCrafter Knowledge Base Index
project:
  name: teiCrafter
  repository: https://github.com/DigitalHumanitiesCraft/teiCrafter
method:
  name: Promptotyping
  url: https://lisa.gerda-henkel-stiftung.de/digitale_geschichte_pollin
template:
  name: Vorlage Index
  version: 0.1
  url: https://dhcraft.org/Promptotyping/promptotyping-document/index
status: active
created: 2026-05-27
updated: 2026-06-12
language: en
version: 0.14
related: [project, data, specification, user-stories, architecture, design, journal, testing, integration, goals, converter-reference, worked-example-szd, worked-example-zbz, promptotyping-case, paper-evidence, curated-set]
---

# teiCrafter Knowledge Base

Central knowledge repository for teiCrafter. Each document carries one defined function; redundancy is avoided and expressed through cross-references. teiCrafter is a **browser-based, lossless editor for arbitrary TEI-XML**: open an existing edition, correct it folio by folio at its natural granularity, save it back byte-faithfully. Plaintext also enters the editor: a `.txt` or `.md`, opened directly (picker, drop) or from a project folder, becomes a line-level TEI draft by a fixed, deterministic rule (paragraphs on blank lines, `<lb/>` per line, a `|N|` token as a page break; never AI-marked). Separately, an optional LLM on-ramp drafts an initial TEI from plaintext into the same editor (currently switched off behind a feature flag). Client-only, no backend, no build step; the built-in examples show only on local development hosts.

This knowledge base follows the [Promptotyping Documents convention](https://dhcraft.org/Promptotyping/), function-separated as in the ancestor tool coOCR HTR.

## Document Map

| Document | Answers | Read first when | Depends on |
|----------|---------|-----------------|------------|
| [project](project.md) | What is teiCrafter, why does it exist, how is it positioned? | Scope or identity unclear | - |
| [data](data.md) | What does it consume and produce; what TEI proves the engine? | Formats or test corpus in question | project |
| [specification](specification.md) | What should the system do and why? (generic reader, editor, LLM on-ramp, validation, decisions) | A requirement or decision is at stake | project, data |
| [user-stories](user-stories.md) | Who uses it, in which scenarios, and what is built? | A usage scenario or status is unclear | specification |
| [architecture](architecture.md) | How is it built? (three-layer engine, services, status) | Wrong assumptions about components or data flow | specification |
| [design](design.md) | How does it look and behave? (tokens, dual-view layout, AI marking) | UI or design-system work | specification |
| [testing](testing.md) | How is it proven and validated? (engine proofs, harness levels) | Coverage or eval method in question | architecture |
| [journal](journal.md) | How did we get here? (decision log) | Decision logic unclear | - |
| [integration](integration.md) | How do the ZBZ and SZD pipelines feed the editor? (cross-project data flow, roles, open items) | Working across the three sibling projects (ZBZ, SZD, teiCrafter) | data, architecture |
| [goals](goals.md) | What are the main goals and milestones, with status? (the on-disk gate plan) | Checking objectives, milestones, or the demo critical path | integration |
| [converter-reference](converter-reference.md) | The deterministic Page-JSON v0.2 to TEI mapping (body, header, facsimile, bbox formula, standOff seeding, markers) | Building or verifying the SZD converter | data, architecture, specification, goals |
| [worked-example-szd](worked-example-szd.md) | The real SZD object taken end-to-end in the editor (M7.2): the object, the seven-step walkthrough, the proof, the entity table | The SZD worked example or the live demo path is in question | goals, testing, specification |
| [worked-example-zbz](worked-example-zbz.md) | The real ZBZ object (doc 1000) taken end-to-end in the editor (M7.2 ZBZ half): the object, the seven-step walkthrough, the proof, the entity table, the added-value before/after | The ZBZ worked example, the Hersch demo path, or the paper's added-value claim is in question | goals, testing, paper-evidence, worked-example-szd |
| [paper-evidence](paper-evidence.md) | Every number the Editopia paper may cite, with source of record, re-runnable verification and caveat | A number is about to go into the paper, slides, or any external text | integration, goals, testing |
| [promptotyping-case](promptotyping-case.md) | teiCrafter as a Promptotyping case (M7.1), the repo-side project-status spine (M5.4), and the talking-points draft (M7.3) | Presenting the tool, its provenance, or its status | goals, journal, integration |
| [curated-set](curated-set.md) | The M7.4 curated example set: how the before/after pairs are produced, the set table, rights and schema-validity status | The paper's empirical partial result or the set's reproduction is in question | goals, paper-evidence, worked-example-zbz, worked-example-szd |

Action layer lives in the repo root: `CLAUDE.md` configures the coding agent and binds `design.md` as the aesthetic value source; `HANDOFF.md` is the current working-state summary; `PLAN.md` is the full plan and implementation backlog (German): purpose, tool boundaries, goals H1-H7 with status, SZD data model, proofs, open items.

## Core Concepts

| Concept | Definition | Document |
|---------|------------|----------|
| Generic lossless reader | The core: the raw TEI string is canonical, edits are offset splices, `serialize()` is byte-identical; reads arbitrary TEI without a per-project profile | architecture, specification |
| Editing unit from the document | TEI encodes its own structure, so the editable unit is read from the encoding: word-level if `<w>` present, else line-level; no configuration, no branching (formerly "emergent granularity", renamed 2026-06-10) | architecture, project |
| Cells / folios / lines | The model `edition.js` projects: folios split by `<pb>`, lines by `<lb>`/`<l>`, cells are editable reading-text nodes | architecture |
| LLM on-ramp | The optional entry: a model drafts an initial TEI from plaintext that opens in the same editor, marked machine-generated and unreviewed. Hidden since 2026-06-10 behind `FEATURES.llmOnRamp`; code in place | specification, design |
| Epistemic asymmetry | Models produce plausible TEI but cannot judge their own correctness; the human verifies in the deterministic editor | project, design |
| Hybrid validation | Browser-light live (well-formed + structural integrity) plus harness-heavy offline (RelaxNG + Schematron) | specification, testing |
| MVP gate | Well-formed AND L1 word fidelity AND L3 counts preserved; L2 reported as new-errors-vs-input, non-gating | testing |
| Byte-identical round-trip | The proven property: every TEI file in the sweep serializes back unchanged (295/295) | testing |
| Lossless / byte-identical / byte-faithful | One concept, three precisions. **Lossless** is the product promise: saving changes nothing the human did not edit. **Byte-identical** is the no-edit case: the saved file equals the opened file in every byte. **Byte-faithful** is the with-edits case: outside the deliberately edited spans every byte is unchanged (whitespace, attribute order, comments, entity spellings included); the only difference between input and output is exactly the edit. ("Byte-exact" in older passages means byte-faithful.) | testing, specification |
| Editorial annotation layer | standOff entities + authority `<idno>` + mention linking + notes + AI proposal (`resp="#ai"`) + live lookup + inline textual criticism (`unclear`/`del`/`add`/`gap`), all lossless | architecture, specification |
| Dual reading | A Wenzelsbibel `<w>` encodes the diplomatic reading as its text (mirrored in `@orig`) and the normalized reading in `@norm`; the reading pane projects a normalized display view, and a two-field double-click edits the diplomatic core and `@norm` atomically in one re-parse | architecture, specification |
| Project manifest | A declarative `teicrafter.project.json` next to a project's TEI files (name, schema, image resolver, allowed markup, indices, views), the machine-readable derivation of its editorial guidelines; a manifest wins, PID detection is the fallback. A project is not an edition type: it carries `documentTypes` and a `files` map, so the markup inventory binds to the open document's type | specification, architecture |
| TEI vocabulary scope | A manifest's `teiModules`/`teiElements` declare its TEI vocabulary against a vendored, version-pinned copy of the P5 Guidelines compilation (an authoring aid, never a validator): named elements feed the wrap menu, modules scope the attribute editor; everything degrades to the explicit lists without the data | specification, architecture |
| Single mutation path | Every standOff mutation commits through `commitStandoff` over the DOM-free `applyMutation` core: SAME-doc no-op contract, fresh note index, exactly one re-render on a real change | architecture, testing |
| File System Access API | Lets the editor read and write editions locally without a backend | architecture |

## Lineage

teiCrafter shares architecture principles, UI patterns and the design system with [coOCR HTR](https://github.com/DigitalHumanitiesCraft/co-ocr-htr) (upstream, client-only ES6, expert-centered). It is conceptual preparation for EditionCrafter but developed as an independent browser tool. The LLM on-ramp originates in the FORGE 2023 prototype (Pollin, Steiner & Zach 2023).

## History Note

Through version 0.3 this knowledge base described two equal paths (an LLM Generator with a five-step stepper, and an Editor). The 2026-05-30 consolidation made the editor the single product, generalised it to the lossless reader, demoted the LLM to an on-ramp, and removed the legacy generator code. Versions 0.4 to 0.9 then track the as-built growth: the editorial annotation layer (0.6), the SZD worked example and the Promptotyping case (0.7), the ZBZ worked example and the Editopia evidence sheet (0.8), the curated example set (0.9). Version 0.10 settles the editor surface: the welcome screen dissolved into the empty two-pane editor, an IDE-style line-number gutter, editor-wide text zoom, a draggable splitter and context-pane collapse with per-document layout persistence, and XML-source find/replace with go-to-line. Version 0.11 consolidates the mutation path (one `commitStandoff` over a DOM-free core), extracts the project-folder and validation surfaces from the integrator, vendors the TEI P5 Guidelines compilation behind a DOM-free reader (manifest-scoped, lazily loaded, degradation proven) and adds the generic attribute editor. Version 0.12 adds the Wenzelsbibel dual reading (F4): an atomic engine op that edits a word's diplomatic content and its `@orig`/`@norm` attributes together in one re-parse, a normalized display projection, a Diplomatic/Normalized switcher, and a two-field double-click edit. Version 0.13 makes the plaintext on-ramp first-class from a real-letter feedback session (direct `.txt`/`.md` open, `|N|` page markers, draft recovery across reloads), moves the document identity into a document strip and a Document context panel, gates the built-in examples to local hosts, brings authority reconciliation into the annotation popover (manifest opt-in for auto), and rebuilds the selection popover as one flat filterable list with declared attribute fields. The full narrative is the [journal](journal.md); converter-reference keeps its own version, owned by the SZD lane.
