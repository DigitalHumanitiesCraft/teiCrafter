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
updated: 2026-08-24
language: en
version: 0.21
topics: ["[[TEI XML]]", "[[Knowledge Base]]", "[[Promptotyping]]"]
related: [project, data, specification, architecture, design, journal, testing, integration, converter-reference, worked-examples]
---

# teiCrafter Knowledge Base

teiCrafter is a client-side, byte-faithful TEI editor. Its current model derives an editing surface from each document, enriches that evidence with conservative schema information, and lets a project manifest state explicit policy. Output leaves the editor only after the exact projected bytes pass every configured schema for the current document revision.

## Documents

| Document | Owning question |
| --- | --- |
| [Project](project.md) | What problem does teiCrafter solve, for whom, and within which boundaries? |
| [Data](data.md) | Which input, output, manifest, provenance, review, and stand-off forms does the tool preserve or create? |
| [Specification](specification.md) | Which behaviours and constraints are normative? |
| [Architecture](architecture.md) | How do inventory, profiles, navigation, mutations, validation, and browser boundaries compose? |
| [Design](design.md) | How does the interface expose document structure, risk, provenance, and review? |
| [Testing](testing.md) | Which evidence supports each technical and editorial claim? |
| [Integration](integration.md) | Which contracts connect teiCrafter to project repositories, schemas, images, and model services? |
| [Worked examples](worked-examples.md) | How do representative editorial workflows exercise those contracts? |
| [Converter reference](converter-reference.md) | Which frozen contract governs the SZD Page-JSON conversion lane? |
| [Journal](journal.md) | Which triggers, decisions, and reasons led to the current state? |

## Core vocabulary

**Document inventory** records TEI elements, attributes, values, reading text, facsimile pointers, and schema processing instructions without treating foreign namespace lookalikes as TEI.

**Source Profile** composes structural evidence from the document, optional conservative Schema Profile evidence, and project policy. It expresses capabilities such as pages, entries, speech turns, records, apparatus, facsimiles, and header metadata. A profile can expose several capabilities at once.

**Navigation Model** materializes source-backed channels and chooses a primary channel. A dictionary can therefore navigate by entries while retaining page and section context. Token cells and text-run cells may coexist inside one navigation unit.

**Schema Profile** extracts conservative authoring evidence from ODD, RelaxNG, or XSD. It never substitutes for validation. Broad or incomplete schemas contribute positive hints and cannot safely forbid document capabilities.

**Project manifest** is the declarative policy layer in `teicrafter.project.json`. It can bind files to document types, provide an ordered schema set, select a primary navigation channel, disable inappropriate capabilities, and declare project-specific authoring, image, interchange, and LLM settings.

**Output schema gate** validates the exact bytes intended for Save or Download. It binds the result to the document session, revision, schema set, and output projection. Any invalid, unavailable, missing, or stale result blocks output. TEI All is the repository default when the project supplies no schema.

**Header inventory** exposes every element and ordinary attribute below the document's TEI header. Simple text and attribute values are directly editable. Mixed, structured, self-closing, and namespace-sensitive content remains visible through exact XML editing.

**Review Record** is a TEI `revisionDesc/change` that identifies the reviewed navigation unit through a stable target and records reviewer, time, status, and rationale. Review state remains independent from annotation coverage.

**Stand-off span group** represents a continuous cross-structure selection or a discontinuous selection as one TEI `spanGrp` containing one or more `span` elements. Exact boundary anchors preserve the source text and support round-trip projection.

**Open provider adapter** is an application-code extension point for nonstandard LLM protocols. A custom OpenAI-compatible endpoint is configurable in the interface. Project manifests remain declarative and cannot inject executable adapters.

## Evidence boundary

Committed synthetic fixtures exercise type-diverse Source Profiles and browser interaction in Chromium and Firefox. The real UFBAS whole-book workflow covers navigation, metadata, review, schema-gated output, fallback download, and automated accessibility checks in both browsers. The rights-local Wenzelsbibel codex exercises the large word-level, dual-reading, facsimile, zone, and no-op engine path. Its committed browser example uses a synthetic structural twin, so real cross-document Wenzelsbibel interaction remains an integration seam.
