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

What the system does and why. Two paths, the function cores of each, five validation levels, the project-module mechanism, and the decisions and open questions that shape them. The near-term focus is the Editor path; its capabilities are specified in their own section. Concrete component behaviour is in [architecture](architecture.md); usage scenarios are in [user-stories](user-stories.md).

## Two Paths

**Generator path (LLM-centred).** Modular transformation of plaintext, PAGE-XML or basic TEI into semantically annotated TEI-XML. Three-layer prompt assembly, plaintext comparison as fundamental validation, multi-provider. The original teiCrafter line from the FORGE 2023 work. Prototype feature-complete, consolidated incrementally.

**Editor path (local-centred), current focus.** Browser editing of existing TEI editions. Schema awareness with a configurable TEI schema plus project-specific Schematron. Project-specific authoring views, index management, StandOff apparatus editing, and a facsimile pane. Local operation via the File System Access API, so even large editions (tens of MB; Wenzelsbibel 78 MB) stay workable without a server. LLM optional and switchable off. First use case: the Wenzelsbibel.

## Generator Path: Function Cores

### Transformation (plaintext to TEI)

The prompt is assembled at runtime from three layers:

- **Base layer (generic):** well-formedness, strict text fidelity, uncertainty handling, output format.
- **Context layer (source-specific):** dating, source type, languages, scribe, collection, project context.
- **Mapping layer (project-specific):** a Markdown list of mapping rules the user edits in a text field; templates per source type are shipped. Few-shot examples (two to three annotated examples per source type) are the highest-leverage quality lever.

### teiModeller

Supports the modelling decision itself: "how is this textual phenomenon represented in TEI?" Output is mapping rules that feed the mapping layer. Knowledge base is not RAG but a collection of distilled, LLM-optimised TEI knowledge modules, activated on demand (for correspondence: `namesdates`, `header`, `core`, `correspDesc`). Produced by a three-stage distillation pipeline (scraping, distillation, validation) over the TEI P5 Guidelines; pilot module `namesdates`. Planned for the consolidation phase, not yet built.

## Editor Path: Capabilities

The Editor path edits an existing, structured TEI edition in the browser, with the source editor as the substrate and task-specific surfaces on top. No LLM is required (the Wenzelsbibel mandate excludes LLM from the annotation process). Five capability areas.

### Open and navigate a local edition

Open a TEI edition from the local file system (File System Access API), read and write in place. A folio-segmenting load strategy keeps editions beyond 10 MB workable. An in-memory index of `xml:id` and `corresp` values spans multiple files for cross-document lookup. The source view offers syntax highlighting and schema-driven autocompletion restricted to the project module's elements.

### Facsimile and image import

A facsimile pane displays page images with deep zoom, pan and rotate (OpenSeadragon), navigable bidirectionally with the text. Images are loaded as an import from a **IIIF manifest** or from a **METS file's image references**; the tool resolves the image sources and pairs them with the edition's `facsimile`/`zone` structure. This is the image-display capability, distinct from any batch conversion.

### Index management

Persons, places, and project-specific indices (for the Wenzelsbibel: peoples) are a separate, editable data layer. The editor creates and edits index entries, links an annotation to an entry by picking from the index, and resolves entries across documents. Authority-data identifiers (GND, GeoNames, ICONCLASS) are entered manually per entry; there is no automatic reconciliation against external APIs and no LLM suggestion in this path.

### StandOff apparatus and commentary

The core editing operation. The editor selects a word range in the reading text, chooses a note type (editorial apparatus or comprehension commentary), and the tool creates the anchor or range and writes the corresponding `standOff` entry. This matches the word-level (`<w>`) granularity of editions like the Wenzelsbibel. Existing apparatus entries are editable in place.

### Authoring views

Recurring annotation types are edited through form-based surfaces that read and write the underlying TEI, so routine annotation does not happen in raw XML. Each project module defines its views; for the Wenzelsbibel: diplomatic transcription and Bible-verse. The image-annotation layer (miniatures, artist attribution, ICONCLASS, `corresp` ranges into the text) is rendered read-only and navigable for now; editing those attributions is out of scope.

## Validation and Review

Five graduated levels rather than binary valid/invalid, applied across both paths:

| Level | Type | Automatable | Purpose |
|-------|------|-------------|---------|
| 1 | Plaintext comparison | Yes | Text fidelity (must always pass) |
| 2 | Schema validation | Yes | Structural correctness (client-side, RelaxNG/ODD plus project Schematron) |
| 3 | XPath rules | Yes | Project-specific constraints |
| 4 | LLM-as-a-judge | Semi | Semantic plausibility, never standing alone |
| 5 | Expert-in-the-loop | No | Scholarly correctness |

In the Editor path, schema validation runs against `tei_all.rng` plus the project-specific Schematron and gives live feedback while editing. Levels 1, 2 and the review workflow are integrated in the Generator prototype; levels 3 and 4 are planned.

### Categorical Confidence

Four categories instead of numeric scores: confident, review-worthy, problematic, and manual (for human-created annotations without an LLM score). Triple-coded in the UI (colour plus icon plus position), see [design](design.md).

## Project Modules

teiCrafter is open to arbitrary TEI; adaptation to a concrete edition runs through a project module, a Markdown document carrying the project's editorial guidelines. The module configures: source-editor autocompletion (only module-defined elements), the available authoring views and their fields, the indices as a data layer, the toolbar buttons, and the project-specific Schematron. The Wenzelsbibel module (Bible edition, word-level granularity, image annotations, artist attributions, Bible-verse reference, person/place/people indices) is the reference case and template for further modules; see [[Editorial Guidelines Wenzelsbibel]].

## Workflow

The Generator path runs a six-stage stepper: Import, Mapping, Transform, Review, Validate, Export. Import accepts plaintext, existing TEI, and PAGE-XML; malformed XML is rejected with a comprehensible message. Export produces TEI-XML with confidence metadata stripped, and warns on unreviewed annotations. The Editor path is not a linear stepper but a continuous editing surface (open, annotate or apparatus, validate, save). Detailed acceptance criteria are in [user-stories](user-stories.md).

## Key Decisions

- Editor engine: overlay technique for the prototype, CodeMirror 6 for production (Monaco too large, ContentEditable too fragile). Overlay spike passed with no scroll drift at 500 lines.
- Prompt architecture: three layers (base, context, mapping).
- Six LLM providers (Gemini, OpenAI, Anthropic, DeepSeek, Qwen, Ollama); keys held in memory only.
- Development strategy: walking-skeleton-first, validate the end-to-end workflow with a real LLM transform before polishing architecture; the review workflow is the differentiator.
- Image import for the facsimile pane comes from IIIF or METS image references; no LLM and no server.
- No automatic authority-data reconciliation in the Editor path; identifiers are entered manually.

## Open Questions

- DocumentModel vs AppState: the Generator UI currently uses a simple AppState, not the reactive DocumentModel; refactor only if the skeleton proves undo/redo or observer sync are actually missing.
- Diff presentation after transform (annotated text vs XML diff vs side-by-side); source panel permanent vs collapsible; cursor coupling bidirectional vs unidirectional. All decided by prototyping with real documents.
- Editor path: anchor mechanism for StandOff ranges (own `<anchor>` elements vs `range()` pointers), to be verified against the concrete edition.
- teiModeller knowledge-module granularity (pilot pending); nested-annotation accept/reject behaviour.

## Related

- [project](project.md) for positioning, [data](data.md) for formats and material, [user-stories](user-stories.md) for acceptance criteria, [architecture](architecture.md) for implementation
