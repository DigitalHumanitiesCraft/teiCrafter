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
status: active
created: 2026-02-05
updated: 2026-09-05
language: en
topics: ["[[Digital Scholarly Editing]]", "[[TEI XML]]", "[[Scholar-Centered Design]]"]
related: [data, specification, architecture, design, journal, integration]
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
| A set of lexicon entries | Separate dictionary-entry and encyclopedia-article starters; navigation in existing entries | Safe insertion, duplication and previewed batch changes in an existing edition |
| Reading without editing | Explicit read-only mode with navigation and source inspection | Broader apparatus and witness reading controls |
| Facsimile correction and review | Text/image alignment, annotations, proposals and fingerprinted review records | Cross-document transactions and a real editorial pilot |

The interface adapts to actual TEI structure, schema evidence, project policy and the selected task. A starter supplies initial XML; it does not make every document of that genre compatible with a specialized form. The [implementation plan](../reports/implementation-plan-0.2.0.md) owns the remaining release scope.

## Scholarly control

The human editor authorizes every substantive change. Model output enters as visibly unverified material with TEI `@resp` provenance. A generated document remains identifiable after reload when the TEI root points to the configured responsibility and the header contains the matching `respStmt`. Confirm and reject actions resolve proposed constructs through the same lossless mutation path used for manual editing. Confirmation retains the origin pointer and adds durable acceptance evidence; accepted content stays distinguishable in the violet family after reopening.

Editorial review is represented as TEI evidence. A `revisionDesc/change` record targets a stable identifier on the reviewed primary navigation unit and records reviewer, time, status, rationale and a source-scope fingerprint. Changes to that content make the earlier review historical until a new review is recorded. Annotation coverage and review answer different questions and remain separate in the interface and document model.

Selections that cross XML structures or consist of separated segments use TEI stand-off spans. The editor inserts exact boundary anchors and stores the semantic relation in one `spanGrp`. Inline projection remains available where the target format can express the selection. Formats such as inline-GND refuse cross-structure, overlapping, or discontinuous output because that interchange shape cannot carry those relations.

## Output trust boundary

Save and Download are authorization points. The editor validates the exact projected output against an ordered schema set. The authorization belongs to one document session, revision, schema set, and byte string. A changed document or configuration invalidates it. Every configured schema must return a valid result. Invalid, unavailable, missing, or stale results block output and explain the reason in the interface.

A project manifest supplies the project schema set. A session upload replaces that set for the current session. TEI P5 TEI All is the repository default when the project supplies no schema. RelaxNG and XSD run locally through the browser validator. Raw and compiled Schematron use bounded browser runtimes whose unsupported constructs produce an unavailable result and therefore block output.

A separately labelled Working copy exports unfinished session state without schema authorization. Local recovery checkpoints also preserve staged edits. A requested XML download retains recovery because the browser cannot establish that the user saved the file; only a complete native Save of the same current revision can clear its checkpoint.

The offline Python fidelity harness has a different purpose. It compares text fidelity, structural invariants, and schema diagnostics before and after edits. Its comparative schema level remains evidence rather than an output authorization. The browser gate governs actual Save and Download operations.

## Browser and deployment model

teiCrafter is a static application with no mandatory server. It targets the Browserslist `baseline widely available` set. The browser suite covers the fallback path in Chromium and Firefox; the [current report](../reports/refactoring-status-2026-09-05.md) records execution failures and performance limits. File input and direct download provide the portable path. Native File System Access remains capability-gated and enables in-place project and file workflows where the browser provides it.

External LLM services are optional. Built-in providers and a configurable OpenAI-compatible endpoint share one catalogue. Application code can register adapters for other JSON protocols. API keys remain in memory, requests omit ambient credentials, and manifests cannot inject executable provider logic.

## Representative material

| Material | Structural contribution | Evidential role |
| --- | --- | --- |
| UFBAS Urfehde book | Whole-book pagination, mixed header, page source, annotations, and download fallback | Historical real browser evidence; rerunning requires the local source and is reported separately from synthetic coverage |
| Wenzelsbibel Codex 2759 | Word tokens, diplomatic and normalized readings, surfaces, zones, IIIF images, TEI-level apparatus, and cross-file image annotations | Rights-local engine and Source Profile evidence; a synthetic twin supplies committed cross-browser interaction evidence |
| Jeanne Hersch corpus | Line-oriented text, inline GND interchange, facsimile zones, and project-specific reconciliation | Real project-boundary and round-trip evidence |
| Stefan Zweig Digital material | Catalogue TEI plus upstream Page-JSON | Converter and project-manifest integration evidence |
| Type-diverse synthetic TEI | Dictionary, drama, spoken corpus, correspondence, critical edition, facsimile, source document, and mixed structures | Reproducible Source Profile and navigation coverage |

## Boundaries

teiCrafter preserves arbitrary TEI through exact source views and targeted splices. Form projections intentionally cover only operations with a lossless mapping back to the source. Complete reformatting, wholesale DOM serialization, silent schema repair, and automatic scholarly acceptance fall outside the product contract.

The browser inspects the effective repository, project, or session schema set after opening a document and after a session override changes. Multiple vocabulary schemas contribute conjunctive evidence. Schematron remains constraint evidence for validation. An unavailable or partially resolved vocabulary schema leaves the affected capabilities unknown, so profile inspection cannot block opening or suppress a structurally observed capability without sound negative evidence. This descriptive path remains separate from the fail-closed output gate.

The stand-off span engine operates within one TEI document. Wenzelsbibel's separate image-annotation document uses cross-file pointers and range expressions, which require a project-level multi-document editing model. The present editor preserves such pointers in raw XML and treats interactive cross-document authoring as future integration work.

## Project origin and comparisons

The project began as a FORGE 2023 prototype and is developed independently by Digital Humanities Craft. Citation information is maintained in the [README](../README.md#citation).

LEAF-Writer is a candidate for a comparative editing study. Exact-source mutation, source discovery and output validation are dimensions to measure. A direct empirical round-trip comparison with a running instance remains outside the evidence base; the repository makes no claim of exhaustive market coverage.
