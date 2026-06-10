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
updated: 2026-06-08
language: en
version: 0.9
topics: ["[[Requirements Engineering]]", "[[TEI XML]]", "[[Decision Records]]"]
related: [project, data, user-stories, architecture, testing]
---

# teiCrafter Specification

What the system does and why. The core mechanism (a generic lossless reader), the editor capabilities, the LLM on-ramp, the validation levels, and the decisions and open questions. Component behaviour is in [architecture](architecture.md); scenarios are in [user-stories](user-stories.md).

## Core Mechanism: a Generic Lossless Reader

The central requirement, from which the rest follows: **read arbitrary TEI and make it editable without losing a byte that the human did not change.** The raw TEI string is canonical; edits are offset splices on it; serialization is the raw string. No project-specific profile is needed to open a file; the editable granularity (word vs line) is read from the document itself (word-level where it carries `<w>` tokens, line-level otherwise). This is verified on every real file in the corpus (byte-identical round-trip), see [testing](testing.md).

Why the byte comparison is the right criterion, and not a triviality: copying a file is trivially byte-identical, but an editor is not a copier. Almost every XML tool opens a file by parsing it into a tree and saves by re-serializing that tree, and the rewritten text is almost never the original, because the tree never recorded attribute order, entity notation (`&#xE4;` vs `ä`), in-tag whitespace or line endings; per the XML data model these are equivalent, for an edition they are not. Two real defects of this class were found in teiCrafter's own audit (an `&nbsp;` corrupted by decode/re-encode, LF inserted into a CRLF file) and are exactly what the byte comparison catches. The no-edit case ("open, save, compare") therefore proves that the whole pipeline (parse into the model, display, write back) is the identity function; the with-edit case ("byte-faithful") proves that a file diff after saving shows precisely the human intervention and nothing else, which is what makes editorial changes reviewable and attestable. The byte comparison is necessary, not sufficient: it says nothing about whether an edit is schema-valid (RelaxNG/Schematron, see Validation Levels) or scholarly correct (the human layer).

This replaces the earlier "two equal paths" framing. teiCrafter is one editor; the LLM is an on-ramp that feeds it.

## Editor Capabilities

### Open and navigate any TEI
Open a TEI edition from the local file system (File System Access API, with a file-input fallback), or load the served synthetic demo. Split into folios by `<pb>` and navigate folio by folio. The reading text renders cell by cell (word or line).

### Edit losslessly in place
Click a cell to correct its text inline. The edit is a single offset splice; only that text run changes, all markup and all other text are byte-preserved. The model re-parses so offsets stay correct.

### Manage standOff entities
Maintain an in-browser `<standOff>` index for the five entity types (person, place, org, work, event): add, rename, and delete entries, and link in-text mentions to them via `<name ref="#id">`. Each entry can carry authority identifiers (GND, GeoNames, Wikidata) as `<idno type="...">value</idno>` children, so one entity can hold several registers at once.

### Resolve authority ids by live lookup
Type a name and pick a GND, GeoNames, or Wikidata match from a live lookup service ([authority-lookup.js](../docs/js/services/authority-lookup.js)). The selected identifier is written as an `<idno>` on the entity, the same mechanism as hand-entered ids. Automatic, unreviewed `<idno>` writing from a proposal layer is future work (see below).

### Create editorial notes
Create editorial notes on the text. Notes use the editorial colour family, never the violet AI family (see [design](design.md)).

### Convert pipeline Page-JSON to TEI
A standalone converter ([export_tei.py](../pipeline/export_tei.py)) turns pipeline Page-JSON (SZD, where no transcription TEI exists) into minimal TEI that the editor can open. Its input and output contract is frozen in [converter-reference](converter-reference.md), and it is what emits authority `<idno>` children for creators that the in-editor authority handling matches.

### Facsimile with zone linking
A real OpenSeadragon deep-zoom viewer (5.0.1, loaded from CDN) shows the folio's page image with `<zone>` rectangles overlaid. Hovering a line highlights its zone and vice versa: the link is the line's real `@facs` zone id when present (Hersch), or positional otherwise (synthetic). The viewer uses a plain-image tileSource today with an IIIF-ready hook; a true IIIF tiles/manifest source is future work.

### Hybrid validation
Live, in the browser: well-formedness plus structural integrity against the load-time baseline (no word ids lost, element counts unchanged), which is the lossless evidence. On demand, offline: TEI All RelaxNG plus project Schematron via the harness.

### Save
Save in place when a File System handle exists (Chromium), else download. Nothing is written until the human saves or downloads.

## LLM On-Ramp

Currently switched off behind the feature flag `FEATURES.llmOnRamp` (`docs/js/utils/constants.js`, operator decision 2026-06-10): the deterministic editor path is proven, the on-ramp is not yet, so its entries (toolbar button, welcome card, landing card, `#generate` deep link) are hidden. The modal, prompt and provider client remain in the codebase.

"New from text (LLM)" accepts plaintext, a source type (which selects default mapping rules), a provider and model, and an API key (held in memory only). It builds a minimal annotate prompt, calls the provider, extracts the XML, and opens the draft in the same editor, flagged as machine-generated and unreviewed (violet banner). The human then verifies and corrects it deterministically. The model assists; the human decides.

Six providers (Gemini, OpenAI, Anthropic, DeepSeek, Qwen, Ollama). Keys never persisted; `fetch` uses `credentials: 'omit'`.

## Validation Levels

Graduated levels rather than binary valid/invalid:

| Level | Type | Where | Purpose |
|-------|------|-------|---------|
| L1 | Text/word fidelity | harness; browser integrity check | No transcription content lost (must always pass) |
| L2 | Schema validity | harness (RelaxNG + Schematron) | Structural correctness; reported as new-errors-vs-input diff, non-gating |
| L3 | Structural invariants | harness; browser counts | Element counts, namespace, pointer integrity preserved |

The **MVP gate** is well-formed AND L1 pass AND L3 counts preserved. L2 is always reported but does not gate: on a round-trip it counts only new errors against the input, so a document's pre-existing TEI All deviations are not held against it. Levels 4 (LLM-as-a-judge) and 5 (expert-in-the-loop) remain conceptual; the human verifying LLM-on-ramp output in the editor is the operative form of L5.

## Key Decisions

- **Editor first.** teiCrafter is a generic lossless TEI editor; the LLM is an optional on-ramp into it. The prior five-step Generator stepper was removed (2026-05-30); its code is in git history.
- **Offset-splice core, not the DOM.** `DOMParser`/`XMLSerializer` drift; a custom offset-true tokenizer keeps round-trip byte-identical.
- **The editing unit is read from the document.** TEI encodes its own structure, so the editor takes the unit from the encoding: word-level if `<w>` present, else line-level; one rule, no per-project branching. (Formerly labelled "emergent granularity"; the label was dropped 2026-06-10 because nothing emerges, a one-line rule reads the unit off the markup.)
- **Hybrid validation.** Browser-light live, harness-heavy offline (Node + Python/lxml).
- **LLM output is marked.** Generated TEI is violet and unreviewed; keys in memory only.
- **LLM on-ramp hidden for now** (2026-06-10, operator). All "New from text (LLM)" entries are behind `FEATURES.llmOnRamp` (off); the code stays in place and the flag restores them. The landing-page card is static HTML and changes with the flag.
- **Licence boundary.** Real third-party TEI never committed; synthetic twins only.
- **Authority ids as `<idno>`, not `@ref`** (2026-06-08). Authority identifiers (GND / GeoNames / Wikidata) attach to an entity as `<idno type="...">value</idno>` children: this allows several registers per entity, matches what the SZD converter already emits for creators, and keeps `@ref` reserved for the in-text mention pointer (`<name ref="#id">`). Hand-entry is the foundation; a live lookup and an offline Gemini proposal layer build on the same mechanism.
- **Dual view, always** (2026-06-10, M2.14, operator order). The editor is two panes at all times: the left pane is the text work surface (reading text or XML source, switched by view tabs in its head), the right pane is a context panel switched by tabs from an open registry (facsimile and entity index built in; project profiles can contribute panels via `project.panels`). There is no single-pane mode and no facsimile hide toggle; a document without page images falls back to the Index panel and the Facsimile tab is disabled with the reason as tooltip. The XML source is explicitly usable next to the facsimile.
- **Project as a declarative manifest** (2026-06-10, F3 ratified; WB-AP3). A project is configured by a `teicrafter.project.json` next to its TEI files, the machine-readable derivation of its editorial guidelines. Format v1 carries `name`, `schema`, `imageResolver` (IIIF image template), `markup` (allowed wrap elements with labels and fixed attributes; replaces the built-in wrap list project-wide), `indices` (index definitions including project-specific types such as the Wenzelsbibel peoples index) and `views` (authoring views). The parser is entry-agnostic (fetch today, the M2.9 directory handle later), validates strictly (element/attribute names checked, attribute values XML-escaped, unknown resolver types and format versions rejected with precise messages) and normalizes into the same runtime shape the built-in PID profiles produce, so every consumer works identically for both sources. A manifest wins over PID detection; PID detection stays the fallback for bare files. A missing manifest is the normal public deployment, a malformed one is reported in the status line and never blocks the load. `indices` and `views` are declared contracts in v1; their consumers land with the index work and the dual-reading view (F4). Wenzelsbibel is the first profile; what the manifest does not know it leaves open rather than inventing (no schema URL yet, the peoples index without a listType). **A project is not an edition type** (operator correction 2026-06-10): one project holds several types (Stefan Zweig Digital: letters, life documents, typescripts), and the allowed element inventory binds to the TYPE. The manifest therefore carries `documentTypes` (each with key, label and optional per-type `markup`) and a `files` map assigning a type to a file by name; project-level `markup` is the default for unassigned files, and `name`, `imageResolver` and `indices` stay project-level. The document alone is always enough to open; the manifest adds the project's and its types' rules while the reader stays generic. Which editing units and views non-folio types (dictionary entries, corpus sentences) need is open, see Future.
- **Project folders via a directory handle; plaintext enters deterministically** (2026-06-10, M2.9 built). "Open project folder" grants a File System Access directory handle once; the folder's `.xml` and `.txt` files appear in a Project panel, "New project" writes a minimal manifest. A `.txt` opens as minimal line-level TEI produced by a rule (`plaintext-import.js`: paragraphs on blank lines, `<lb/>` per line, text XML-escaped and otherwise verbatim); the same input always yields the same output, so the draft is transport, not interpretation, and is deliberately NOT marked violet (the AI family stays reserved for machine-plausible content a human must judge). The first save creates the `.xml` next to its source in the project folder.
- **Inline textual criticism wraps, gap replaces** (2026-06-08, M3.6). `<unclear>`/`<del>`/`<add>` wrap a reading-text node's core; `<gap/>` is content-less per TEI, so it replaces the core rather than wrapping it. The wrapped core is the raw, already-escaped slice spliced as-is (no decode/re-encode, so entity spellings never churn), edge whitespace stays outside the tags, and a no-op returns the same document. The cell model tags a cell from its immediate wrapper only (so the visible state matches what the ops can act on), and "clear" is offered only when the cell is that wrapper's sole content, so removing markup can never silently strip a wrapper shared with sibling content. This is editorial, human markup: it uses the editorial colour family and never the violet AI family (see [design](design.md)).

## Future (specified, not built)

- A true IIIF tiles/manifest (or METS image) source for the facsimile viewer in the generic, project-less case; for projects this is built since WB-AP2: the manifest/profile image resolver hands OpenSeadragon a IIIF info.json tile source, and `<zone>` overlay linking is built throughout.
- StandOff critical-apparatus authoring layer: select a sub-cell word/line range, choose a note type, and write a free-form `standOff` apparatus entry with its anchor. The `<standOff>` entity index, editorial note creation, and inline textual-critical markup (`<unclear>`/`<del>`/`<add>`/`<gap>`, M3.6) are already built (see Editor Capabilities); only the apparatus/note-body authoring layer (sub-cell selection, free-form apparatus entries) is the future part.
- Automatic authority-id reconciliation: an offline Gemini proposal layer that writes unreviewed `<idno>` suggestions shown violet, building on the live lookup and hand-entry that are already built (see Editor Capabilities). Only the automatic, unreviewed `<idno>` writing is the future part.
- The project manifest's remaining consumers: the declared `indices` driving the entity index (including project-specific types such as peoples), the declared `views` as real authoring views (F4 dual reading first), and per-edition schema/Schematron validation from the `schema` field. The manifest format, its image-resolver and type-bound markup consumers, and "Open project folder" (M2.9) are built (see Key Decisions). Beyond folio-shaped editions: editing units and views for other edition types (dictionary entries, corpus sentences), as manifest-declared views over the same lossless core.
- Streaming/segmented load for very large editions (Wenzelsbibel ~78 MB); the current model re-parses the whole string per edit, fine for folio-sized and synthetic files.
- Replacing the hand-built XML source editor with CodeMirror, should it hit limits (the editable source view itself, including side-by-side with the facsimile, is built: M2.12 + M2.14).

## Open Questions

- StandOff anchor mechanism (own `<anchor>` vs `range()` pointers), to verify against the concrete edition.
- Whether to add `<w>` tokenisation to line-level editions (Hersch) to enable word-level editing, or stay line-level.
- Facsimile image source resolution (IIIF vs METS) per pipeline.

## Related

- [project](project.md) for positioning, [data](data.md) for formats and corpus, [user-stories](user-stories.md) for acceptance criteria, [architecture](architecture.md) for implementation, [testing](testing.md) for the harness
