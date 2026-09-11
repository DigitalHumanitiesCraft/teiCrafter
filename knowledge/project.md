---
title: teiCrafter Project Overview
project:
  name: teiCrafter
  repository: https://github.com/DigitalHumanitiesCraft/teiCrafter
method:
  name: Promptotyping
  url: https://lisa.gerda-henkel-stiftung.de/digitale_geschichte_pollin
template:
  name: Vorlage Projekt-Wissensdokument
  version: 0.1
  url: https://dhcraft.org/Promptotyping/promptotyping-document/project
status: complete
created: 2026-02-05
updated: 2026-09-11
language: en
topics: ["[[Digital Scholarly Editing]]", "[[TEI XML]]", "[[Scholar-Centered Design]]"]
related: [data, specification, architecture, design, journal, integration, testing, worked-examples, wenzelsbibel]
---

# teiCrafter Project Overview

## Identity

teiCrafter is a client-side editor for existing TEI documents and deterministic or model-assisted TEI drafts. It gives editors a readable work surface while retaining the source document as the canonical state. Exact offset splices preserve source bytes outside an intentional edit, including whitespace, prefixes, attribute order, comments, processing instructions, and entity spellings.

The tool serves editors who must correct, annotate, review, and return heterogeneous TEI without first translating every project into one internal edition type. Its central contribution is a compositional Source Profile. The profile derives capabilities and navigation from the loaded TEI, can receive conservative Schema Profile evidence, and accepts explicit project policy from a manifest.

## Product promise

An editor can open a TEI document without prior configuration. The interface identifies source-backed navigation channels and selects a safe primary channel. A paginated dictionary can expose entries, pages, and sections together. A spoken corpus can navigate by corpus member or speech turn. A critical edition can expose apparatus and logical structure. Token cells and text-run cells can coexist within the same document.

Common editorial work remains direct. The editor supports reading-text correction, inline and stand-off annotation, entity registers, authority identifiers, facsimile alignment, dual readings, source XML, complete header inspection, review records, Undo and Redo, and schema-gated output. Project manifests add editorial vocabulary, schemas, image resolution, document-type policy, interchange formats, and model instructions.

## Editorial workflows

| Task | Current route | Remaining depth |
| --- | --- | --- |
| Transcribed letter to TEI | Deterministic letter starter, metadata, reading text and exact XML | Project-specific correspondence forms |
| Existing charter or legal source | Source-derived navigation, full header inventory, entity registers, exact XML | Dedicated diplomatic and legal-source forms |
| A set of lexicon entries | Separate starters, filterable entry details, creation, safe duplication, reference-protected deletion and previewed document-local batches | Project-specific fields and operations across several entry files |
| Reading without editing | Explicit read-only mode, witness selection, disclosed attestations, source inspection and exact witness XML | External witness resolution and reconstruction of unencoded witness text |
| Wenzelsbibel transcription and annotation | Specialized transcription, commentary, Bible mapping, image annotation, registers, project checks and PAGE import within the common editor | Scholarly ratification of the local editorial profile and review of the resulting edition |
| Facsimile correction and review | Text/image alignment, annotations, proposals and fingerprinted review records | Cross-document transactions and a real editorial pilot |

The interface adapts to actual TEI structure, schema evidence, project policy and the selected task. A starter supplies initial XML; it does not make every document of that genre compatible with a specialized form. The [implementation plan](../reports/implementation-plan-0.2.0.md) owns the release scope and acceptance criteria.

## Scholarly control

The human editor authorizes substantive changes. Optional model output enters as visibly unverified material with durable provenance. Confirmation retains its origin and records human acceptance separately. Editorial review records who reviewed a source-backed unit and the content to which that review applied; later edits can make it historical. Annotation coverage, model acceptance and editorial review remain distinct facts. Their encodings are owned by [data.md](data.md), and their visible treatment by [design.md](design.md).

Cross-structure or discontinuous selections can use stand-off spans within one document. An interchange format must be able to carry those relations before output is permitted. The [integration contract](integration.md) defines the project boundaries.

## Output trust boundary

Save and TEI Download validate the exact projected output against every effective schema. An invalid, unavailable, missing or stale result blocks output. TEI All supplies the default when the project provides no schema. Currentness and schema-runtime limits are defined in [specification.md](specification.md) and implemented as described in [architecture.md](architecture.md).

Working copy preserves unfinished input and attached project documents independently of schema validity. Project package validates each XML member before producing one ZIP. Native Save writes the active file. Requesting a download preserves recovery because the browser cannot establish that the user saved the artifact. [Data](data.md) owns the portable formats; [testing](testing.md) distinguishes output authorization from independent fidelity evidence.

## Browser and deployment model

teiCrafter is a static application with no mandatory server. It targets the Browserslist `baseline widely available` set. The browser suite covers the fallback path in Chromium and Firefox; the [current report](../reports/editorial-completion-2026-09-11.md) records execution evidence and performance limits. File input and direct download provide the portable path. Native File System Access remains capability-gated and enables in-place project and file workflows where the browser provides it.

GitHub Pages automatically publishes the versioned `docs/` source from main. The checks workflow independently builds, verifies and packages `dist/`. Built-in examples are available on local development hosts; the public editor opens the researcher's local files through Load. Both forms of delivery use the same local XML and schema-worker model.

External LLM services are optional. Built-in providers and a configurable OpenAI-compatible endpoint share one catalogue. Application code can register adapters for other JSON protocols. API keys remain in memory, requests omit ambient credentials, and manifests cannot inject executable provider logic.

## Representative material

| Material | Structural contribution | Evidential role |
| --- | --- | --- |
| UFBAS Urfehde book | Whole-book pagination, mixed header, page source, annotations, and download fallback | Historical real browser evidence; rerunning requires the local source and is reported separately from synthetic coverage |
| Wenzelsbibel Codex 2759 | Word tokens, diplomatic and normalized readings, surfaces, zones, IIIF images, TEI-level apparatus, and cross-file image annotations | Local real-object editing and exact-output evidence in both browsers; synthetic fixtures supply the reproducible workspace and recovery suite |
| Jeanne Hersch corpus | Line-oriented text, inline GND interchange, facsimile zones, and project-specific reconciliation | Real project-boundary and round-trip evidence |
| Stefan Zweig Digital material | Catalogue TEI plus upstream Page-JSON | Converter and project-manifest integration evidence |
| Type-diverse synthetic TEI | Dictionary, drama, spoken corpus, correspondence, critical edition, facsimile, source document, and mixed structures | Reproducible Source Profile and navigation coverage |

## Boundaries

teiCrafter preserves arbitrary TEI through exact source views and targeted splices. Form projections intentionally cover only operations with a lossless mapping back to the source. Complete reformatting, wholesale DOM serialization, silent schema repair, and automatic scholarly acceptance fall outside the product contract.

Schema inspection contributes conservative evidence to authoring. It leaves unknown capabilities available for source inspection and cannot silently suppress observed TEI structures. Output validation independently requires a successful result for the complete effective schema set.

The [Wenzelsbibel specialization](wenzelsbibel.md) edits the codex, separate image annotations and shared registers within one persistent document collection. It provides a local editorial model for peoples, Bible references and image-record checks. The original `Bilderfassung.sch` was unavailable; the supplied profile still requires scholarly ratification. PAGE import produces a separate draft for review. Concurrent editing and an atomic transaction across several external files remain outside the product contract.

Entry management likewise changes the active XML document. Its deletion protection covers references to the selected subtree within that file, and its batch fields are limited to local language and number attributes. Witness reading requires explicit attestation; absent or ambiguous attribution never establishes agreement with the base text. Unsupported compound pointer semantics and structured field inverses remain visible through exact XML.

The [editorial completion report](../reports/editorial-completion-2026-09-11.md) establishes the tested technical scope and real-codex performance. The initial full validation of a large codex remains costly, even though identical successful results can be reused. The application remains a research preview until editorial and user acceptance and an explicit release decision.

## Project origin and comparisons

The project began as a FORGE 2023 prototype and is developed independently by Digital Humanities Craft. Citation information is maintained in the [README](../README.md#citation).

LEAF-Writer is a candidate for a comparative editing study. Exact-source mutation, source discovery and output validation are dimensions to measure. A direct empirical round-trip comparison with a running instance remains outside the evidence base; the repository makes no claim of exhaustive market coverage.
