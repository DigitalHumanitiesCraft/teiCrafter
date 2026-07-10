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
updated: 2026-06-16
language: en
version: 0.16
topics: ["[[TEI XML]]", "[[Knowledge Base]]", "[[Promptotyping]]"]
related: [project, data, specification, architecture, design, journal, testing, integration, converter-reference, worked-examples, curated-set, promptotyping-case]
---

# teiCrafter Knowledge Base

Central knowledge repository for teiCrafter. Each document carries one defined function; redundancy is avoided and expressed through cross-references. teiCrafter is a **browser-based, lossless editor for arbitrary TEI-XML**: open an existing edition, correct it folio by folio at its natural granularity, save it back byte-faithfully. Plaintext also enters the editor: a `.txt` or `.md`, opened directly (picker, drop) or from a project folder, becomes a line-level TEI draft by a fixed, deterministic rule (paragraphs on blank lines, a `<lb/>` between the lines of a paragraph with the first line bare, a `|N|` token as a page break; never AI-marked). Separately, an optional LLM on-ramp drafts an initial TEI from plaintext into the same editor, an optional model-assisted entry the human then verifies deterministically. Client-only, no backend, no build step; the built-in examples show only on local development hosts.

This knowledge base follows the [Promptotyping Documents convention](https://dhcraft.org/Promptotyping/), function-separated as in the ancestor tool coOCR HTR.

## Document Map

| Document | Answers | Read first when | Depends on |
|----------|---------|-----------------|------------|
| [project](project.md) | What is teiCrafter, why does it exist, how is it positioned? | Scope or identity unclear | - |
| [data](data.md) | What does it consume and produce; the plaintext ingest conventions; what TEI proves the engine? | Formats or test corpus in question | project |
| [specification](specification.md) | What should the system do and why? (generic reader, editor, LLM on-ramp, validation, decisions, acceptance scenarios) | A requirement, a decision, or an acceptance scenario is at stake | project, data |
| [architecture](architecture.md) | How is it built? (three-layer engine, the engine reading contract, services, implementation status) | Wrong assumptions about components, the reading contract, or data flow | specification |
| [design](design.md) | How does it look and behave? (tokens, dual-view layout, AI marking) | UI or design-system work | specification |
| [testing](testing.md) | How is it proven and validated? (the acceptance method, engine proofs, harness levels) | Coverage or acceptance method in question | architecture |
| [journal](journal.md) | How did we get here? (decision log) | Decision logic unclear | - |
| [integration](integration.md) | How do the ZBZ and SZD pipelines feed the editor, and where is the tool boundary? (cross-project data flow, roles, open items) | Working across the three sibling projects (ZBZ, SZD, teiCrafter) | data, architecture |
| [converter-reference](converter-reference.md) | The deterministic Page-JSON v0.2 to TEI mapping (body, header, facsimile, bbox formula, standOff seeding, markers) | Building or verifying the SZD converter | data, architecture, specification |
| [worked-examples](worked-examples.md) | The real SZD and ZBZ objects taken end-to-end in the editor: the objects, the walkthrough, the proof, the entity tables, the added-value before/after | A worked example or a live demo path is in question | testing, specification |
| [curated-set](curated-set.md) | The curated example set: how the before/after pairs are produced, the set table, rights and schema-validity status | The empirical partial result or the set's reproduction is in question | worked-examples |
| [promptotyping-case](promptotyping-case.md) | teiCrafter as a Promptotyping case: the case description and provenance pointers | Presenting the tool or its provenance | journal, integration |

Action layer: `CLAUDE.md` (repo root) configures the coding agent and binds `design.md` as the aesthetic value source. Session re-entry is the newest [journal](journal.md) entry for durable state; a volatile working-state snapshot (branch and tip, uncommitted work, the immediate next step, open threads) is written as a dated report under `reports/`, an action-layer note that carries no Promptotyping frontmatter and is not a knowledge document. Research steering (the milestone register, the backlog, the paper material) lives in the operator's private vault, not in this repository.

## Core Concepts

| Concept | Definition | Document |
|---------|------------|----------|
| Generic lossless reader | The core: the raw TEI string is canonical, edits are offset splices, `serialize()` is byte-identical; reads arbitrary TEI without a per-project profile | architecture, specification |
| Editing unit from the document | TEI encodes its own structure, so the editable unit is read from the encoding: word-level if `<w>` present, else line-level; no configuration, no branching (formerly "emergent granularity", renamed 2026-06-10) | architecture, project |
| Cells / folios / lines | The model `edition.js` projects: folios split by `<pb>`, lines by `<lb>`/`<l>`, cells are editable reading-text nodes | architecture |
| LLM on-ramp | The optional entry: a model drafts an initial TEI from plaintext that opens in the same editor, marked machine-generated and unreviewed. Behind `FEATURES.llmOnRamp` (on since 2026-06-16); the model assists, the human verifies | specification, design |
| Epistemic asymmetry | Models produce plausible TEI but cannot judge their own correctness; the human verifies in the deterministic editor | project, design |
| Hybrid validation | Browser-light live (well-formed + structural integrity) plus harness-heavy offline (RelaxNG + Schematron) | specification, testing |
| MVP gate | Well-formed AND L1 word fidelity AND L3 counts preserved; L2 reported as new-errors-vs-input, non-gating | testing |
| Byte-identical round-trip | The proven property: every TEI file in the sweep serializes back unchanged | testing |
| Lossless / byte-identical / byte-faithful | One concept, three precisions. **Lossless** is the product promise: saving changes nothing the human did not edit. **Byte-identical** is the no-edit case: the saved file equals the opened file in every byte. **Byte-faithful** is the with-edits case: outside the deliberately edited spans every byte is unchanged (whitespace, attribute order, comments, entity spellings included); the only difference between input and output is exactly the edit. ("Byte-exact" in older passages means byte-faithful.) | testing, specification |
| Editorial annotation layer | standOff entities + authority `<idno>` + mention linking + notes + AI proposal (`resp="#ai"`) + live lookup + inline textual criticism (`unclear`/`del`/`add`/`gap`), all lossless | architecture, specification |
| Dual reading | A Wenzelsbibel `<w>` encodes the diplomatic reading as its text (mirrored in `@orig`) and the normalized reading in `@norm`; the reading pane projects a normalized display view, and a two-field double-click edits the diplomatic core and `@norm` atomically in one re-parse | architecture, specification |
| Project manifest | A declarative `teicrafter.project.json` next to a project's TEI files (name, schema, image resolver, allowed markup, indices, views), the machine-readable derivation of its editorial guidelines; a manifest wins, PID detection is the fallback. A project is not an edition type: it carries `documentTypes` and a `files` map, so the markup inventory binds to the open document's type | specification, architecture |
| TEI vocabulary scope | A manifest's `teiModules`/`teiElements` declare its TEI vocabulary against a vendored, version-pinned copy of the P5 Guidelines compilation (an authoring aid, never a validator): named elements feed the wrap menu, modules scope the attribute editor; everything degrades to the explicit lists without the data | specification, architecture |
| Single mutation path | Every standOff mutation commits through `commitStandoff` over the DOM-free `applyMutation` core: SAME-doc no-op contract, fresh note index, exactly one re-render on a real change | architecture, testing |
| File System Access API | Lets the editor read and write editions locally without a backend | architecture |

## Lineage

Lineage and positioning are in [project.md](project.md): the shared design system with coOCR HTR, the relation to EditionCrafter, and the FORGE 2023 origin of the LLM on-ramp.

The version history is the [journal](journal.md); converter-reference keeps its own version, owned by the SZD lane.
