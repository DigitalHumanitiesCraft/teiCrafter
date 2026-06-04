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
updated: 2026-05-30
language: en
version: 0.4
topics: ["[[Requirements Engineering]]", "[[TEI XML]]", "[[Decision Records]]"]
related: [project, data, user-stories, architecture]
---

# teiCrafter Specification

What the system does and why. The core mechanism (a generic lossless reader), the editor capabilities, the LLM on-ramp, the validation levels, and the decisions and open questions. Component behaviour is in [architecture](architecture.md); scenarios are in [user-stories](user-stories.md).

## Core Mechanism: a Generic Lossless Reader

The central requirement, from which the rest follows: **read arbitrary TEI and make it editable without losing a byte that the human did not change.** The raw TEI string is canonical; edits are offset splices on it; serialization is the raw string. No project-specific profile is configured; the editable granularity (word vs line) emerges from whether the document carries `<w>` tokens. This is verified on every real file in the corpus (byte-identical round-trip), see [testing](testing.md).

This replaces the earlier "two equal paths" framing. teiCrafter is one editor; the LLM is an on-ramp that feeds it.

## Editor Capabilities

### Open and navigate any TEI
Open a TEI edition from the local file system (File System Access API, with a file-input fallback), or load the served synthetic demo. Split into folios by `<pb>` and navigate folio by folio. The reading text renders cell by cell (word or line).

### Edit losslessly in place
Click a cell to correct its text inline. The edit is a single offset splice; only that text run changes, all markup and all other text are byte-preserved. The model re-parses so offsets stay correct.

### Facsimile with zone linking
A real OpenSeadragon deep-zoom viewer (5.0.1, loaded from CDN) shows the folio's page image with `<zone>` rectangles overlaid. Hovering a line highlights its zone and vice versa: the link is the line's real `@facs` zone id when present (Hersch), or positional otherwise (synthetic). The viewer uses a plain-image tileSource today with an IIIF-ready hook; a true IIIF tiles/manifest source is future work.

### Hybrid validation
Live, in the browser: well-formedness plus structural integrity against the load-time baseline (no word ids lost, element counts unchanged), which is the lossless evidence. On demand, offline: TEI All RelaxNG plus project Schematron via the harness.

### Save
Save in place when a File System handle exists (Chromium), else download. Nothing is written until the human saves or downloads.

## LLM On-Ramp

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
- **Granularity emerges.** Word-level if `<w>` present, else line-level; no per-project branching.
- **Hybrid validation.** Browser-light live, harness-heavy offline (Node + Python/lxml).
- **LLM output is marked.** Generated TEI is violet and unreviewed; keys in memory only.
- **Licence boundary.** Real third-party TEI never committed; synthetic twins only.

## Future (specified, not built)

- A true IIIF tiles/manifest (or METS image) source for the facsimile viewer; the OpenSeadragon deep-zoom viewer itself and `<zone>` overlay linking are already built, currently over a plain-image tileSource.
- StandOff critical-apparatus editor: select a word/line range, choose a note type, write the anchor and the `standOff` entry. In-browser `<standOff>` index management for person/org/event entities (add, rename, delete) with in-text mention linking via `<name ref="#id">` is already built; the apparatus/note authoring layer is the future part.
- Manual authority ids (GND, GeoNames, ICONCLASS) on index entities, with no automatic reconciliation; place and project index types beyond the built person/org/event set.
- Project modules: a Markdown document configuring autocompletion, authoring views, indices and Schematron per edition.
- Page-JSON to minimal-TEI conversion for pipelines (SZD) that lack a transcription TEI.
- Streaming/segmented load for very large editions (Wenzelsbibel ~78 MB); the current model re-parses the whole string per edit, fine for folio-sized and synthetic files.
- A CodeMirror source view for raw-XML editing alongside the rendered view.

## Open Questions

- StandOff anchor mechanism (own `<anchor>` vs `range()` pointers), to verify against the concrete edition.
- Whether to add `<w>` tokenisation to line-level editions (Hersch) to enable word-level editing, or stay line-level.
- Facsimile image source resolution (IIIF vs METS) per pipeline.

## Related

- [project](project.md) for positioning, [data](data.md) for formats and corpus, [user-stories](user-stories.md) for acceptance criteria, [architecture](architecture.md) for implementation, [testing](testing.md) for the harness
