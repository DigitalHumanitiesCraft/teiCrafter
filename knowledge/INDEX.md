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
updated: 2026-05-27
language: en
version: 0.3
related: [project, data, specification, user-stories, architecture, design, journal]
---

# teiCrafter Knowledge Base

Central knowledge repository for teiCrafter. Each document carries one defined function; redundancy between documents is avoided and expressed through cross-references. teiCrafter is a browser-based TEI working environment with two paths: a Generator path (LLM-assisted transformation of plaintext to annotated TEI) and an Editor path (schema-aware editing of existing TEI editions). The current build focus is the Editor path, driven by its first real use case, the Wenzelsbibel (Codex 2759, project start autumn 2026).

This knowledge base follows the [Promptotyping Documents convention](https://dhcraft.org/Promptotyping/). It deliberately mirrors the function-separated structure of the ancestor tool coOCR HTR rather than the generic OVERVIEW/ARCHITECTURE/REFERENCE/DEVELOPMENT split it replaces.

## Document Map

| Document | Answers | Read first when | Depends on |
|----------|---------|-----------------|------------|
| [project](project.md) | What is teiCrafter, why does it exist, how is it positioned? | Output is conceptually wrong, scope unclear | - |
| [data](data.md) | What does the tool consume and produce, what TEI is the test material? | Formats confused, examples cited wrong | project |
| [specification](specification.md) | What should the system do and why? (two paths, function cores, validation, project modules, decisions) | A requirement or decision was ignored or revised | project, data |
| [user-stories](user-stories.md) | Who uses it, in which concrete scenarios? | A usage scenario was misunderstood | specification |
| [architecture](architecture.md) | How is it built? (components, data flow, editor engine, pipeline mode, module status) | Wrong assumptions about components or data flow | specification |
| [design](design.md) | How does it look and behave aesthetically? | UI inconsistency, design-system break | specification |
| [journal](journal.md) | How did we get here? (decision log, development journal) | Decision logic unclear, repeated dead ends | - |

Action layer lives in the repo root, not here: `CLAUDE.md` configures the coding agent and binds `design.md` as the aesthetic value source.

## Core Concepts

| Concept | Definition | Document |
|---------|------------|----------|
| Epistemic asymmetry | LLMs produce plausible annotations but cannot reliably judge their correctness; human expertise is structurally necessary, not optional QA | project, specification |
| Generator path | LLM-assisted modular transformation of plaintext / PAGE-XML / basic TEI into semantically annotated TEI-XML | specification |
| Editor path | Schema-aware browser editing of existing TEI editions: index management, StandOff apparatus, project-specific authoring views; LLM optional | specification |
| Project module | A Markdown document with a project's editorial guidelines that configures autocompletion, authoring views, indices, toolbar buttons and Schematron | specification |
| teiModeller | Supports the modelling decision itself ("how is this textual phenomenon represented in TEI?") and emits mapping rules | specification |
| Categorical confidence | Three states (confident / review / problematic) instead of numeric scores; inherited from coOCR HTR | design, specification |
| Plaintext comparison | Fundamental validation: output text nodes must match the input plaintext, else the transformation is flagged | specification |
| Page-JSON v0.2 | Interchange format between SZD-HTR and teiCrafter; OCR text plus layout plus Dublin Core/MODS metadata per object | data |
| File System Access API | Lets the Editor path read and write large editions locally without a server backend | architecture |
| Folio-segmenting load | Loading strategy that keeps editions beyond 10 MB (Wenzelsbibel: 78 MB) workable in the browser | architecture |

## Lineage

teiCrafter shares architecture principles, UI patterns and the design system with [coOCR HTR](https://github.com/DigitalHumanitiesCraft/co-ocr-htr) (upstream tool, client-only ES6, expert-centered design). It is conceptual preparation for EditionCrafter but is developed as an independent browser tool, not as a module of any harness. The Generator path originates in the FORGE 2023 prototype (Pollin, Steiner & Zach 2023).
