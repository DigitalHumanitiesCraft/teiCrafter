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
updated: 2026-05-27
language: en
version: 0.3
topics: ["[[Digital Scholarly Editing]]", "[[TEI XML]]", "[[Scholar-Centered Design]]"]
related: [data, specification, architecture, design, journal]
---

# teiCrafter Project Overview

teiCrafter is a browser-based TEI working environment for digital scholarly editions, with two equal paths. The Generator path transforms plaintext or layout-annotated transcriptions into semantically annotated TEI-XML, LLM-assisted. The Editor path edits existing TEI editions schema-aware, with index management, StandOff apparatus and project-specific authoring views; LLM support is optional and switchable. The knowledge base is an Obsidian-style vault of distilled TEI knowledge, schema customisations and editorial conventions. The application runs entirely in the browser, client-only, no backend.

## Why It Exists

The epistemological ground is epistemic asymmetry, inherited from coOCR HTR: LLMs produce plausible annotations but cannot reliably judge whether they are correct. For TEI annotation the problem is sharper, because annotation decisions are often interpretive, schema conformance does not guarantee semantic correctness, and authority-data assignment needs context knowledge. teiCrafter therefore positions human expertise not as optional quality control but as a structurally necessary component. A market scan (Session 14) found no existing tool that combines TEI annotation, LLM assistance and human review; teiCrafter is first mover in that intersection.

It fills the gap between automated text recognition and manual deep encoding: the tool produces valid, schema-conformant TEI-XML as a qualified starting point for further editorial work.

## What It Does Not Do

It is not a replacement for oXygen or ediarum, but a pre-stage. Those environments assume modelling decisions are already made; teiCrafter supports that decision process and emits TEI-XML that imports into them. It does not perform character recognition (that is upstream, coOCR HTR). It does not host or persist data on a server. It is developed as an independent browser tool, not as a module of any harness.

## Positioning

```
Image -> coOCR HTR -> teiCrafter -> ediarum / GAMS / publication
         (transcription)        (annotation &  (deep encoding &
                                 modelling)     publication)
```

teiCrafter shares architecture principles, UI patterns and the design system with [coOCR HTR](https://github.com/DigitalHumanitiesCraft/co-ocr-htr) (upstream tool, client-only ES6, expert-centered). It is conceptual preparation for EditionCrafter and shares vocabulary and method ground with it, but the two are developed separately: teiCrafter is a tool for TEI creation and editing, EditionCrafter is an edition undertaking reaching from image or text to a finished edition. The Generator path originates in the FORGE 2023 prototype (Pollin, Steiner & Zach 2023, conversion of unstructured text to TEI-XML via GPT).

## Current Focus

The Editor path is the near-term build focus, driven by its first real use case, the Wenzelsbibel (Codex 2759, project start autumn 2026, no LLM in the annotation process). See [data](data.md) for the material profile and the vault documents [[Project Overview Wenzelsbibel]] and [[TEI-Struktur Wenzelsbibel]]. The Generator path stays feature-complete and is consolidated incrementally.

## Success Criteria

Adapted from coOCR HTR.

| Criterion | Meaning | Operationalisation |
|-----------|---------|--------------------|
| Self-explanatory | Usable without external instruction | Workflow stepper, contextual hints, progressive disclosure |
| Complete workflow | Import to annotation to validation to export | Plaintext or PAGE-XML in, valid TEI-XML out |
| Connectivity | Output usable downstream | Export compatible with ediarum, oXygen, GAMS |

## Synergy Projects

teiCrafter is format-driven and open to arbitrary TEI. Concrete application contexts: the Wenzelsbibel (Editor path, Middle High German Bible codex), Schliemann ledgers (Generator, Bookkeeping Ontology), zbz-ocr-tei (Generator, historical prints). Methodically connected to [[coOCR HTR]] (upstream, shared principles), [[DIA-XAI]] (expert-in-the-loop evaluation) and [[Promptotyping MOC|Promptotyping]] (development method).

## Related

- [data](data.md), [specification](specification.md), [architecture](architecture.md), [design](design.md), [journal](journal.md)
- Vault: [[teiCrafter]], [[Project Overview Wenzelsbibel]], [[coOCR HTR]], [[Project Overview EditionCrafter]]
