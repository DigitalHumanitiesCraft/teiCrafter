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
updated: 2026-05-30
language: en
version: 0.4
related: [project, data, specification, user-stories, architecture, design, journal, testing]
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

Action layer lives in the repo root: `CLAUDE.md` configures the coding agent and binds `design.md` as the aesthetic value source; `HANDOFF.md` is the current working-state summary.

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
| File System Access API | Lets the editor read and write editions locally without a backend | architecture |

## Lineage

teiCrafter shares architecture principles, UI patterns and the design system with [coOCR HTR](https://github.com/DigitalHumanitiesCraft/co-ocr-htr) (upstream, client-only ES6, expert-centered). It is conceptual preparation for EditionCrafter but developed as an independent browser tool. The LLM on-ramp originates in the FORGE 2023 prototype (Pollin, Steiner & Zach 2023).

## History Note

Through version 0.3 this knowledge base described two equal paths (an LLM Generator with a five-step stepper, and an Editor) and a CodeMirror/DocumentModel architecture. The 2026-05-30 consolidation made the editor the single product, generalised it to the lossless reader, demoted the LLM to an on-ramp, and removed the legacy generator code. Version 0.4 documents the as-built reality; see [journal](journal.md).
