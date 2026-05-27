---
title: teiCrafter Specification
project:
  name: teiCrafter
  repository: https://github.com/DigitalHumanitiesCraft/teiCrafter
method:
  name: Promptotyping
  url: https://lisa.gerda-henkel-stiftung.de/digitale_geschichte_pollin
template:
  name: Vorlage Specification
  version: 0.1
  url: https://dhcraft.org/Promptotyping/promptotyping-document/specification
status: active
created: 2026-02-05
updated: 2026-05-27
language: en
version: 0.3
topics: ["[[Requirements Engineering]]", "[[TEI XML]]", "[[Decision Records]]"]
related: [project, data, user-stories, architecture]
---

# teiCrafter Specification

What the system does and why. Two paths, three function cores, five validation levels, the project-module mechanism, the workflow, and the decisions and open questions that shape them. Concrete component behaviour is in [architecture](architecture.md); usage scenarios are in [user-stories](user-stories.md).

## Two Paths

**Generator path (LLM-centred).** Modular transformation of plaintext, PAGE-XML or basic TEI into semantically annotated TEI-XML. Three-layer prompt assembly, plaintext comparison as fundamental validation, multi-provider. The original teiCrafter line from the FORGE 2023 work. Prototype feature-complete, consolidated incrementally.

**Editor path (local-centred), current focus.** Browser editing of existing editions. Schema awareness with a configurable TEI schema plus project-specific Schematron. Project-specific authoring views as form-based surfaces for recurring annotation types. Index management as a separate data layer with cross-document lookup. StandOff range editor with word selection. Facsimile pane with zone overlay. Local operation via the File System Access API, so even large editions (tens of MB; Wenzelsbibel 78 MB) stay workable without a server. LLM optional. First use case: the Wenzelsbibel.

## Function Cores

### 1. Transformation (plaintext to TEI)

The prompt is assembled at runtime from three layers:

- **Base layer (generic):** well-formedness, strict text fidelity, uncertainty handling, output format.
- **Context layer (source-specific):** dating, source type, languages, scribe, collection, project context.
- **Mapping layer (project-specific):** a Markdown list of mapping rules the user edits in a text field; templates per source type are shipped. Few-shot examples (two to three annotated examples per source type) are the highest-leverage quality lever.

### 2. teiModeller

Supports the modelling decision itself: "how is this textual phenomenon represented in TEI?" Output is mapping rules that feed the mapping layer. Knowledge base is not RAG but a collection of distilled, LLM-optimised TEI knowledge modules, activated on demand (for correspondence: `namesdates`, `header`, `core`, `correspDesc`). Produced by a three-stage distillation pipeline (scraping, distillation, validation) over the TEI P5 Guidelines; pilot module `namesdates`. Planned for the consolidation phase, not yet built.

### 3. Validation and Review

Five graduated levels rather than binary valid/invalid:

| Level | Type | Automatable | Purpose |
|-------|------|-------------|---------|
| 1 | Plaintext comparison | Yes | Text fidelity (must always pass) |
| 2 | Schema validation | Yes | Structural correctness (client-side, RelaxNG/ODD) |
| 3 | XPath rules | Yes | Project-specific constraints |
| 4 | LLM-as-a-judge | Semi | Semantic plausibility, never standing alone |
| 5 | Expert-in-the-loop | No | Scholarly correctness |

Plaintext comparison removes all tags and compares against the input; any deviation flags the transformation. Levels 1, 2 and the review workflow are integrated; levels 3 and 4 are planned.

### Categorical Confidence

Four categories instead of numeric scores: confident, review-worthy, problematic, and manual (for human-created annotations without an LLM score). Triple-coded in the UI (colour plus icon plus position), see [design](design.md).

## Project Modules

teiCrafter is open to arbitrary TEI; adaptation to a concrete edition runs through a project module, a Markdown document carrying the project's editorial guidelines. The module configures: source-editor autocompletion (only module-defined elements), available authoring views and their fields, the indices as a data layer, the toolbar buttons, and the project-specific Schematron. The Wenzelsbibel module (Bible edition, word-level granularity, image annotations, artist attributions, Bible-verse reference, person/place/people indices) is the reference case and template for further modules; see [[Editorial Guidelines Wenzelsbibel]].

## Workflow

Six stepper stages: Import, Mapping, Transform, Review, Validate, Export. Import accepts plaintext, existing TEI, and (pipeline mode) Page-JSON v0.2; malformed XML is rejected with a comprehensible message. Export produces TEI-XML with confidence metadata stripped, and warns on unreviewed annotations. The detailed acceptance criteria per stage are in [user-stories](user-stories.md).

## Key Decisions

- Editor engine: overlay technique for the prototype, CodeMirror 6 for production (Monaco too large, ContentEditable too fragile). Overlay spike passed with no scroll drift at 500 lines.
- Prompt architecture: three layers (base, context, mapping).
- Six LLM providers (Gemini, OpenAI, Anthropic, DeepSeek, Qwen, Ollama); keys held in memory only.
- Development strategy: walking-skeleton-first, validate the end-to-end workflow with a real LLM transform before polishing architecture; the review workflow is the differentiator.
- Pipeline mode: Node.js CLI, Page-JSON before METS, deterministic mapping only (no LLM for header or body), letters wrapped as a single div.

## Open Questions

- DocumentModel vs AppState: the UI currently uses a simple AppState, not the reactive DocumentModel; refactor only if the skeleton proves undo/redo or observer sync are actually missing.
- Diff presentation after transform (annotated text vs XML diff vs side-by-side); source panel permanent vs collapsible; cursor coupling bidirectional vs unidirectional. All decided by prototyping with real documents.
- teiModeller knowledge-module granularity (pilot pending); authority-data integration during transform vs downstream reconciliation; nested-annotation accept/reject behaviour.

## Related

- [project](project.md) for positioning, [data](data.md) for formats and material, [user-stories](user-stories.md) for acceptance criteria, [architecture](architecture.md) for implementation
