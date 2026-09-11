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
status: complete
created: 2026-05-27
updated: 2026-09-11
language: en
version: "0.23"
topics: ["[[TEI XML]]", "[[Knowledge Base]]", "[[Promptotyping]]"]
related: [project, data, specification, architecture, design, journal, handoff, testing, integration, converter-reference, worked-examples, wenzelsbibel]
---

# teiCrafter Knowledge Base

teiCrafter is a client-side, byte-faithful TEI editor. Its current model derives an editing surface from each document, enriches that evidence with conservative schema information, and lets a project manifest state explicit policy. Save and TEI Download require every configured schema to pass for the exact projected bytes. Working copy preserves unfinished work and attached documents. Project package validates each XML document before producing one delivery archive.

## Documentation maintenance

This index owns the shared documentation schema version in its top-level `version` field. Other knowledge documents inherit it and omit that field. Change this version only when the shared document contract changes, such as required metadata or document functions. Content edits do not require a schema version change or edits to unrelated documents.

Frontmatter status describes document maturity. Consolidated reference documents use `complete`; the ongoing journal and handoff inbox use `active`. Neither value claims software release acceptance or scholarly ratification.

Each document's `updated` date records its latest substantive change. Removing an inherited version field alone preserves that date. Git identifies the complete content revision. Nested `template.version` identifies the source template and changes only when adopting a different template version. The frozen SZD contract in [converter-reference.md](converter-reference.md) retains its independently owned top-level version.

The required process documents are the decision [journal](journal.md) and the continuously present [handoff inbox](handoff.md). The inbox contains received deltas awaiting integration; its empty state is `Keine offenen Handoff-Punkte.`. A journal entry records a processed delta's source, destination and outcome. Accepted release requirements belong in the [release scope](../reports/implementation-plan-0.2.0.md).

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
| [Wenzelsbibel](wenzelsbibel.md) | Which editorial models, project forms and cross-file conventions support the Wenzelsbibel workflow? |
| [Converter reference](converter-reference.md) | Which frozen contract governs the SZD Page-JSON conversion lane? |
| [Journal](journal.md) | Which triggers, decisions, and reasons led to the current state? |
| [Handoff](handoff.md) | Which received deltas still require verification and integration? |

## Reading routes

Start with the [user overview](../README.md) for workflows and setup, [test guide](../test/README.md) for executable checks, and [report index](../reports/README.md) for dated evidence and release planning. Requirements in a plan are not claims that the feature is complete. A passing run certifies its recorded revision, fixtures and environment only.

For session re-entry, read [CLAUDE.md](../CLAUDE.md), this index, the handoff inbox and the latest journal decision. Follow their links to the owning contract and the [editorial completion report](../reports/editorial-completion-2026-09-11.md). Check Git for the actual branch, revision and uncommitted changes before continuing.

Repository knowledge uses standard Markdown. Established public filenames remain stable, including `wenzelsbibel.md` for the specialized editorial contract and `worked-examples.md` for editorial recipes. `reports/` owns dated observations and the release scope catalogue. Browser source lives in `docs/`; `dist/` is generated build output. Rights-local editions remain external to the repository.

Current facts belong to their owning knowledge document. Reports retain historical observations; link a follow-up instead of rewriting an old failure as a pass. Keep upstream documentation, licences and the frozen converter contract intact unless their actual source or contract changes.

## Core vocabulary

**Document inventory** records TEI elements, attributes, values, reading text, facsimile pointers, and schema processing instructions without treating foreign namespace lookalikes as TEI.

**Source Profile** composes structural evidence from the document, optional conservative Schema Profile evidence, and project policy. It expresses capabilities such as pages, entries, speech turns, records, apparatus, facsimiles, and header metadata. A profile can expose several capabilities at once.

**Navigation Model** materializes source-backed channels and chooses a primary channel. A dictionary can therefore navigate by entries while retaining page and section context. Token cells and text-run cells may coexist inside one navigation unit.

**Schema Profile** extracts conservative authoring evidence from ODD, RelaxNG, or XSD. It never substitutes for validation. Broad or incomplete schemas contribute positive hints and cannot safely forbid document capabilities.

**Project manifest** is the declarative policy layer in `teicrafter.project.json`. It can bind files to document types, provide an ordered schema set, select a primary navigation channel, disable inappropriate capabilities, and declare project-specific authoring, image, interchange, and LLM settings.

**Output schema gate** validates the exact bytes intended for Save or Download. It binds the result to the document session, revision, schema set, and output projection. Any invalid, unavailable, missing, or stale result blocks output. TEI All is the repository default when the project supplies no schema.

**Header inventory** exposes every element and ordinary attribute below the document's TEI header. Simple text and attribute values are directly editable. Mixed, structured, self-closing, and namespace-sensitive content remains visible through exact XML editing.

**Review Record** is a TEI `revisionDesc/change` that identifies the reviewed navigation unit through a stable target and records reviewer, time, status, rationale, and a source-scope fingerprint. Current review requires matching content evidence; historical records and annotation coverage remain separate.

**Stand-off span group** represents a continuous cross-structure selection or a discontinuous selection as one TEI `spanGrp` containing one or more `span` elements. Exact boundary anchors preserve the source text and support round-trip projection.

**Staged input** is a visible inline, XML, metadata, entry, witness or Wenzelsbibel form edit that has not yet entered canonical XML. Apply may fail without losing the entered value; navigation and unrelated mutations must preserve it.

**Recovery checkpoint** stores the active session, staged input and attached project documents locally. A **Working copy** exports that unfinished state as portable JSON without schema authorization. A **Project package** is a ZIP delivery artifact whose XML files have each passed their effective schema set. Downloading either artifact retains recovery.

**Entry workspace** manages source-backed dictionary entries or encyclopedia articles within the active document. Batch changes require an explicit target selection and a current preview.

**Witness reading** chooses an explicitly attributed apparatus branch for a selected local witness. Missing or ambiguous attestation is disclosed. Text outside the apparatus remains base text.

**Accepted AI provenance** retains the origin pointer while recording human acceptance separately. Acceptance is not a schema result or a fingerprinted review of the surrounding navigation unit.

**Open provider adapter** is an application-code extension point for nonstandard LLM protocols. A custom OpenAI-compatible endpoint is configurable in the interface. Project manifests remain declarative and cannot inject executable adapters.

## Evidence boundary

The [editorial completion report](../reports/editorial-completion-2026-09-11.md) owns the full local run with real Wenzelsbibel sources, the independent Linux CI result, exact revisions, input hashes, toolchain, omissions and measured validation latency. The local run exercises both Chromium and Firefox. CI uses redistributable fixtures and explicitly records missing rights-local inputs.

Historical real UFBAS runs remain prior evidence; the final local editorial run did not have that source. Passing code and schema checks establish the recorded technical behavior. Scholarly adequacy, a complete review of the edition and user acceptance remain separate. [Testing](testing.md) defines how these claims are evaluated and reproduced.
