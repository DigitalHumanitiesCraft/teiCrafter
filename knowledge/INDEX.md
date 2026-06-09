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
updated: 2026-06-09
language: en
version: 0.9
related: [project, data, specification, user-stories, architecture, design, journal, testing, integration, goals, converter-reference, worked-example-szd, worked-example-zbz, promptotyping-case, paper-evidence, curated-set]
---

# teiCrafter Knowledge Base

Central knowledge repository for teiCrafter. Each document carries one defined function; redundancy is avoided and expressed through cross-references. teiCrafter is a **browser-based, lossless editor for arbitrary TEI-XML**: open an existing edition, correct it folio by folio at its natural granularity, save it back byte-faithfully. An optional LLM on-ramp drafts an initial TEI from plaintext into the same editor. Client-only, no backend, no build step.

This knowledge base follows the [Promptotyping Documents convention](https://dhcraft.org/Promptotyping/), function-separated as in the ancestor tool coOCR HTR.

## Document Map

| Document | Answers | Read first when | Depends on |
|----------|---------|-----------------|------------|
| [project](project.md) | What is teiCrafter, why does it exist, how is it positioned? | Scope or identity unclear | - |
| [data](data.md) | What does it consume and produce; what TEI proves the engine? | Formats or test corpus in question | project |
| [specification](specification.md) | What should the system do and why? (generic reader, editor, LLM on-ramp, validation, decisions) | A requirement or decision is at stake | project, data |
| [user-stories](user-stories.md) | Who uses it, in which scenarios, and what is built? | A usage scenario or status is unclear | specification |
| [architecture](architecture.md) | How is it built? (three-layer engine, services, status) | Wrong assumptions about components or data flow | specification |
| [design](design.md) | How does it look and behave? (tokens, three-pane layout, AI marking) | UI or design-system work | specification |
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
| Emergent granularity | The editable unit (word vs line) emerges from the document: word-level if `<w>` present (Wenzelsbibel), else line-level (Hersch); no branching | architecture, project |
| Cells / folios / lines | The model `edition.js` projects: folios split by `<pb>`, lines by `<lb>`/`<l>`, cells are editable reading-text nodes | architecture |
| LLM on-ramp | The optional entry: a model drafts an initial TEI from plaintext that opens in the same editor, marked machine-generated and unreviewed | specification, design |
| Epistemic asymmetry | Models produce plausible TEI but cannot judge their own correctness; the human verifies in the deterministic editor | project, design |
| Hybrid validation | Browser-light live (well-formed + structural integrity) plus harness-heavy offline (RelaxNG + Schematron) | specification, testing |
| MVP gate | Well-formed AND L1 word fidelity AND L3 counts preserved; L2 reported as new-errors-vs-input, non-gating | testing |
| Byte-identical round-trip | The proven property: every real TEI file serializes back unchanged (294/294) | testing |
| Editorial annotation layer | standOff entities + authority `<idno>` + mention linking + notes + AI proposal (`resp="#ai"`) + live lookup + inline textual criticism (`unclear`/`del`/`add`/`gap`), all lossless | architecture, specification |
| File System Access API | Lets the editor read and write editions locally without a backend | architecture |

## Lineage

teiCrafter shares architecture principles, UI patterns and the design system with [coOCR HTR](https://github.com/DigitalHumanitiesCraft/co-ocr-htr) (upstream, client-only ES6, expert-centered). It is conceptual preparation for EditionCrafter but developed as an independent browser tool. The LLM on-ramp originates in the FORGE 2023 prototype (Pollin, Steiner & Zach 2023).

## History Note

Through version 0.3 this knowledge base described two equal paths (an LLM Generator with a five-step stepper, and an Editor) and a CodeMirror/DocumentModel architecture. The 2026-05-30 consolidation made the editor the single product, generalised it to the lossless reader, demoted the LLM to an on-ramp, and removed the legacy generator code. The 0.4-to-0.6 set documents the as-built reality, the 0.6 set adding the full editorial annotation layer (notes, AI proposal, live authority lookup, inline textual criticism); the 0.7 set adds the SZD worked example and the Promptotyping case ([worked-example-szd](worked-example-szd.md), [promptotyping-case](promptotyping-case.md)) and unifies the repo-wide version at 0.7; the 0.8 set adds the ZBZ worked example and the Editopia evidence sheet ([worked-example-zbz](worked-example-zbz.md), [paper-evidence](paper-evidence.md)), closing both halves of the M7.2 demo gate at engine level, and records the sharpened paper success criterion (demonstrable added value for the Hersch project; converter-reference keeps its own version, owned by the SZD lane); the 0.9 set adds the curated example set ([curated-set](curated-set.md), M7.4 done for the two proven objects); see [journal](journal.md).
