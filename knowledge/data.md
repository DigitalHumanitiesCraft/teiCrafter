---
title: teiCrafter Data and Test Material
project:
  name: teiCrafter
  repository: https://github.com/DigitalHumanitiesCraft/teiCrafter
method:
  name: Promptotyping
  url: https://lisa.gerda-henkel-stiftung.de/digitale_geschichte_pollin
template:
  name: Vorlage Datengrundlage
  version: 0.1
  url: https://dhcraft.org/Promptotyping/promptotyping-document/data
status: active
created: 2026-05-27
updated: 2026-05-27
language: en
version: 0.3
topics: ["[[TEI XML]]", "[[Data Modelling]]", "[[PAGE-XML]]"]
knowledge-sources:
  standards:
    - label: TEI P5 Guidelines
      uri: https://tei-c.org/guidelines/p5/
    - label: TEI All RelaxNG
      uri: https://tei-c.org/release/xml/tei/custom/schema/relaxng/tei_all.rng
related: [project, specification, design]
---

# teiCrafter Data and Test Material

What teiCrafter consumes and produces, and which TEI serves as test material. teiCrafter is format-driven, not corpus-bound: it edits arbitrary TEI. The concrete driver is the Wenzelsbibel; everything else is test and reference material.

## What the Tool Consumes and Produces

The tool produces one thing: valid, schema-conformant, semantically annotated TEI-XML, exportable into downstream environments (ediarum, oXygen, GAMS). What it consumes depends on the path.

| Input | Path | Notes |
|-------|------|-------|
| Plaintext | Generator (primary) | The original FORGE 2023 case: unstructured text into annotated TEI |
| PAGE-XML | Generator | Layout-annotated transcription from coOCR HTR or other HTR systems |
| Page-JSON v0.2 | Pipeline mode | Interchange format from SZD-HTR; OCR text plus layout plus Dublin Core/MODS metadata per object |
| Existing TEI edition | Editor | Schema-aware editing of an already structured edition; the Editor-path case |

Pipeline mode (the Node CLI `pipeline.mjs`) takes Page-JSON v0.2 (or METS, planned) and emits minimal TEI-XML with a rich header and a simple body without entity annotation, as a qualified starting point for further editorial work.

## What This Document Does Not Cover

It does not specify the TEI mapping rules or the project-module element lists (see specification and the project-specific editorial guidelines). It does not document the LLM provider formats (see architecture).

## Test Corpus

Good TEI is available across sibling repositories and is used as read-engine, validation and generator test material. Staged by closeness to the Wenzelsbibel domain (Middle High German, manuscript, word-level):

| Source | Scope | Use |
|--------|-------|-----|
| Wenzelsbibel `codex-2759.xml` | 78 MB | Editor path, the real target; a folio excerpt as fixture |
| `mhdbdb-tei-only` | ~690 TEI files | Middle High German, closest language domain; Editor read engine and autocompletion |
| `notker-edition` | medieval German edition | Domain-near editor material |
| `zbz-ocr-tei` final TEI | 285 validated files | Clean reference TEI; Generator output and schema validation |
| `szd-htr` / `SZD` plus the three SZD mapping templates already in `data/demo/mappings/` | correspondence and manuscript | Generator path |
| `diged-neolat` | small | Variety (neo-Latin) |

Fixtures principle: a small curated set lives in `data/`, not the full corpora. One Wenzelsbibel folio with zones, a few `mhdbdb` and `notker` pieces, a few `zbz` final-TEI documents. The Editor path must handle a 78 MB edition, but the committed fixtures stay a representative slice.

## Wenzelsbibel Material Profile

The first Editor-path use case. Two files, edited locally via the File System Access API. Full structural analysis and editor requirements are in the vault: [[TEI-Struktur Wenzelsbibel]].

- `codex-2759.xml` (78 MB): `teiHeader`, `standOff` with 1,009 apparatus entries, `facsimile` with 480 surfaces and 34,363 zones, `text` with 158,524 `<w>`, 31,673 `<lb>`, 6,505 `<l>`. Word-level full text from Transkribus.
- `Bildannotationen.xml` (1.5 MB): miniatures with artist attributions, ICONCLASS references, and text linkage via `corresp="#range(...)"` into the codex.
- `Bilderfassung.sch`: the project-specific Schematron schema referenced in the XML, validated alongside TEI All RelaxNG.

These figures are structural facts of the source material, not processing state.

## Negative Definition

teiCrafter does not host or persist data on a server (client-only, File System Access API for local files). It does not perform character recognition (that is the upstream coOCR HTR / SZD-HTR stage). It does not normalise or reconcile authority data against external APIs as a built-in pipeline; entity reconciliation is a downstream or optional concern.

## Related

- [project](project.md) for where the data flow sits in the pipeline
- [specification](specification.md) for the validation levels applied to the produced TEI
- [design](design.md) for how material is presented in the editor
