---
title: teiCrafter Development Journal
project:
  name: teiCrafter
  repository: https://github.com/DigitalHumanitiesCraft/teiCrafter
method:
  name: Promptotyping
  url: https://lisa.gerda-henkel-stiftung.de/digitale_geschichte_pollin
template:
  name: Vorlage Journal
  version: 0.1
  url: https://dhcraft.org/Promptotyping/promptotyping-document/journal
status: active
created: 2026-02-05
updated: 2026-05-27
language: en
version: 0.3
related: [project, specification, architecture]
---

# teiCrafter Development Journal

Chronological log of development sessions, most recent first. A condensed narrative of how the tool and its decisions came about; individual commits live in the Git history.

## 2026-05-27: Knowledge base refactor (this document set)

- Reactivated the knowledge base from the dormant April state. Replaced the four consolidated documents (OVERVIEW, ARCHITECTURE, DEVELOPMENT, REFERENCE) with a function-separated set following the Promptotyping Documents convention: INDEX, project, data, specification, user-stories, architecture, design, journal, each with frontmatter.
- Returned the structure toward the ancestor coOCR HTR (function separation plus INDEX plus glossary), which the four-bucket split had regressed from.
- Baked in project decisions sharpened with the author: English knowledge docs, Editor path as near-term focus (Wenzelsbibel-driven), knowledge before code, teiCrafter as an independent tool (not a module of EditionCrafter).
- Pulled design and UI lessons from sibling projects into `design.md`: expert-in-the-loop philosophy and categorical confidence from coOCR, single-source design tokens from the zbz Hersch system, editor-grade UI patterns (facsimile synopsis with zone overlay, tip system, label-consistency rule, print mode) from the SuGW edition frontend. Identified TEI test material across repositories in `data.md` (Wenzelsbibel codex, mhdbdb, notker, zbz final TEI).
- Retired the SZD-HTR and METS pipeline-mode content as legacy, out of scope for the current project. Added facsimile image import via IIIF manifest or METS image references as an Editor-path capability, and elaborated the Editor-path specification and user stories (local editing, indices with manual authority IDs, StandOff range-select, form-based authoring views, read-only image annotation).

## 2026-02-18: Demo data, reference, strategy (Sessions 10 to 16)

- Walking-skeleton-first strategy adopted after a market analysis found no tool combining TEI annotation, LLM assistance and human review; the review workflow is the differentiator.
- Replaced placeholder demos with real sources (CoReMA medieval recipe, DEPCHA 1718 ledger); added a `bookkeeping` source type with `bk:` attribute mapping.
- LLM providers extended from four to six (added DeepSeek and Qwen) with a model catalogue carrying prices, context windows and reasoning flags.
- Code-quality refactoring: event delegation, `ANNOTATION_TAGS` centralised, CSS bugfixes, path-traversal fix.
- Consolidated the technical reference and corrected status counts through self-review (integrated 10, module-ready 11, one open end-to-end story).

## 2026-02-05: Foundation (Sessions 1 to 9)

- Project start: `docs/` for the GitHub Pages prototype, `knowledge/` for the knowledge base.
- Built the UI prototype through several redesigns: settled on a three-column layout and a five-step workflow (Import, Mapping, Transform, Validate, Export) plus a review workflow, with a TEI-derived design system and dual-channel confidence encoding.
- Phase 2 implementation across ten stages: ES6 module system, visual test matrix, overlay editor spike (no scroll drift at 500 lines), XML tokenizer, reactive document model with snapshot undo, source panel, multi-provider LLM service, three-layer prompt assembly, multi-level validation, export. Unit tests for tokenizer, model and validator.
- Decided: three-layer prompt architecture, five validation levels, four confidence categories, overlay for prototype and CodeMirror 6 for production. Consolidated two parallel knowledge directories into one; specified the teiModeller and the TEI Guidelines distillation pipeline as Phase 3 concepts.

## Origin: FORGE 2023

The Generator path originates in the FORGE 2023 prototype, conversion of unstructured text to TEI-XML via GPT on the Schuchardt correspondence (Pollin, Steiner & Zach 2023, https://doi.org/10.5281/zenodo.8425163).

## Related

- [specification](specification.md) for the decisions referenced here
- [architecture](architecture.md) for the current implementation status
