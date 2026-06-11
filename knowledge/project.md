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
updated: 2026-06-02
language: en
version: 0.12
topics: ["[[Digital Scholarly Editing]]", "[[TEI XML]]", "[[Scholar-Centered Design]]"]
related: [data, specification, architecture, design, journal, goals, integration]
---

# teiCrafter Project Overview

teiCrafter is a browser-based, lossless editor for arbitrary TEI-XML. You open an existing TEI edition from your local disk, read it folio by folio, correct it directly in the rendered text, and save it back, byte-for-byte unchanged except where you edited. An optional LLM on-ramp drafts an initial TEI from plaintext and drops it into the same editor for verification. One workbench, two ways in. The application runs entirely in the browser, client-only, no backend, no build step. The only outbound calls are the optional LLM on-ramp and the live authority lookup, both user-initiated; nothing leaves the browser unless the user triggers it.

## What It Is

The core is a **generic, offset-true TEI reader**. The raw TEI string is canonical; every edit is an offset splice on that string, so untouched markup is preserved exactly. This is proven, not aspirational: every TEI file tested round-trips byte-identically (Jeanne Hersch editions, Stefan Zweig objects, the synthetic Wenzelsbibel tiers; the current count of record is in [testing](testing.md)). The editor reads any TEI and lets the human correct it; it does not impose a project-specific schema or shape on the input.

The editing unit is read from the document, not configured: TEI encodes its own structure, so a document that tokenizes words (`<w xml:id>`) is edited word by word, and one that marks only line breaks (`<lb/>` inside `<p>`) is edited line by line. Same engine, same lossless splice. On top of this document-driven default, a project manifest (`teicrafter.project.json` next to the edition's files) adds what a concrete editorial undertaking needs: its name, an image resolver, the markup its guidelines allow, its indices and views. A project is not an edition type: one project holds several types (Stefan Zweig Digital: letters, life documents, typescripts), so the manifest declares document types and the allowed element inventory binds to the type, while name, image resolver and indices live at the project level. The manifest carries the rules; the reader stays generic.

## Why It Exists

It fills the gap between automated text recognition and deep editorial encoding: a place to correct and refine pipeline-produced TEI comfortably in a browser, without an XML editor on every collaborator's machine and without a server. Editing is deterministic and human-driven; nothing the human did not type is changed.

The LLM on-ramp keeps the original FORGE 2023 idea (plaintext to TEI via a model) but subordinates it to the editor: a model can produce a plausible first draft, but it cannot judge its own correctness. This is the epistemic-asymmetry stance inherited from coOCR HTR. So LLM output is marked as machine-generated (violet) and unreviewed, and the human verifies it in the same deterministic editor. The model assists; the human decides.

## What It Does Not Do

It is not an XML development environment: no schema design, no XSLT/XQuery toolchain, no free restructuring of arbitrary XML; that remains oXygen's ground. For the editorial working role (open, correct, annotate, maintain indices, validate, save) teiCrafter is built to carry project workflows that today run in oXygen/ediarum, in the browser and without installation; the Wenzelsbibel mandate states this explicitly, and gates W1/W2 exist to prove it before it is claimed. Because saving is byte-faithful, the same files move between teiCrafter and oXygen/ediarum without one disturbing the other's work. It does not perform character recognition (that is upstream, coOCR HTR and other HTR pipelines). It does not host or persist data on a server, and it does not publish editions (EditionCrafter's line). It is an independent browser tool, not a module of any harness.

## Positioning

```
Image -> HTR pipeline -> teiCrafter -> ediarum / GAMS / publication
         (transcription)  (correct, refine,  (deep encoding &
                           draft via LLM)      publication)
```

teiCrafter shares architecture principles, UI patterns and the design system with [coOCR HTR](https://github.com/DigitalHumanitiesCraft/co-ocr-htr) (upstream tool, client-only ES6, expert-centered). It is conceptual preparation for EditionCrafter but developed separately. The LLM on-ramp originates in the FORGE 2023 prototype (Pollin, Steiner & Zach 2023).

## Real Cases

teiCrafter is format-driven and open to any TEI. Three concrete pipelines drive it and serve as the proving ground (see [data](data.md)):

| Case | Pipeline | TEI shape | Editor granularity |
|------|----------|-----------|--------------------|
| Wenzelsbibel (Codex 2759) | manuscript edition | word-level `<w xml:id>`, `<facsimile>`/`<zone>`, `<standOff>` | word |
| Jeanne Hersch | zbz-ocr-tei | line-level `<p>` + `<lb facs>`, real zone coordinates | line |
| Stefan Zweig | szd-htr | catalog TEI + Page-JSON (needs page-json to TEI before editing) | (line, after conversion) |

The Wenzelsbibel is the reference manuscript case. Because the real codex is third-party material (Austrian National Library) with an unresolved redistribution licence, all committed Wenzelsbibel material is synthetic; real third-party files stay out of version control.

## Success Criteria

| Criterion | Meaning | Operationalisation |
|-----------|---------|--------------------|
| Lossless | Save changes nothing the human did not edit | Byte-identical round-trip on every real file (proven in the harness) |
| Universal | Reads arbitrary TEI without per-project code | One engine handles word-level and line-level editions; the unit is read from the document |
| Self-explanatory | Usable without external instruction | Open a file, click a word or line, correct it, save |
| Connective | Output usable downstream | Edited TEI imports into ediarum, oXygen, GAMS unchanged in structure |

## Related

- [data](data.md), [specification](specification.md), [architecture](architecture.md), [design](design.md), [journal](journal.md), [goals](goals.md), [integration](integration.md)
- Vault: [[teiCrafter]], [[Project Overview Wenzelsbibel]], [[coOCR HTR]], [[Project Overview EditionCrafter]]
