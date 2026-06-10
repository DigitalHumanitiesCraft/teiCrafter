# teiCrafter

**A browser-based, lossless editor for arbitrary TEI-XML**

**[Try the live demo](https://digitalhumanitiescraft.github.io/teiCrafter/)** -- no installation required, runs entirely in the browser.

> **Research Preview** -- This is an active research prototype developed using [Promptotyping](https://github.com/DigitalHumanitiesCraft) methodology. It demonstrates lossless, expert-in-the-loop TEI editing with an optional LLM on-ramp, and is under active development. Not intended for production use.

[![License: CC BY 4.0](https://img.shields.io/badge/License-CC_BY_4.0-lightgrey.svg)](https://creativecommons.org/licenses/by/4.0/)
[![GitHub Pages](https://img.shields.io/badge/demo-GitHub_Pages-blue)](https://digitalhumanitiescraft.github.io/teiCrafter/)

---

## Overview

teiCrafter is a client-only, browser-based editor for arbitrary [TEI-XML](https://tei-c.org/). You open an existing edition, correct it folio by folio, and save it back with every byte outside your deliberate edits unchanged. Most XML tools parse a file into a tree and re-serialize it on save, silently normalising attribute order, entity notation and whitespace; teiCrafter never rebuilds the file. The opened string itself remains the document, an edit replaces exactly the edited passage inside it, and saving an untouched document reproduces the input byte for byte. The practical consequence: a file diff after saving shows precisely the human intervention and nothing else.

TEI encodes its own structure, so the editor reads the editing unit from the document instead of asking for configuration: word-level where the TEI tokenizes words (`<w>`), line-level where it marks only line breaks (`<lb>`). Any TEI opens without setup; an optional project manifest (`teicrafter.project.json` next to the edition) adds project-specific settings such as an image resolver, indices, views, and the allowed markup. A project is not a single edition type: one project can hold several document types (for Stefan Zweig Digital: letters, life documents, typescripts), so the manifest declares the allowed markup per document type and the markup offered in the editor follows the open document's type. You can also open a whole project folder: granting a folder once through the browser's File System Access directory handle (Chromium browsers) lists its files in the Project panel. A plaintext (`.txt`) file in such a folder opens as minimal line-level TEI produced by a fixed rule (paragraphs on blank lines, a line-break element per line, the text carried verbatim and XML-escaped); this is transport, not interpretation, and is deliberately not marked as machine-generated. There is no build step.

The landing page leads into the editor:

- **Open and edit existing TEI** -- the deterministic path. Open a local edition, correct word or line text, manage an index, link facsimile zones, and save losslessly. No LLM is involved.
- **New from text (LLM)** -- an optional on-ramp. Paste plaintext and a model drafts an initial TEI that opens straight in the same editor for verification and correction. AI-generated content is marked in the violet token family and counts as unreviewed. The model assists; the human decides. *Currently switched off* behind the feature flag `FEATURES.llmOnRamp`; the code remains in place.

The tool occupies a specific position in the digital scholarly editing pipeline:

```
Image --> coOCR HTR --> teiCrafter --> ediarum / GAMS / Publication
          (Transcription)  (Editing &        (Deep encoding &
                            Annotation)        Publication)
```

teiCrafter is an independent tool, not a module of another system. For the full specification, start at [knowledge/INDEX.md](knowledge/INDEX.md).

### Epistemic Foundation

The design rests on the principle of **epistemic asymmetry**: LLMs generate plausible annotations but cannot reliably assess their own correctness. The deterministic editing core makes no probabilistic claims at all; it preserves bytes. Where the LLM on-ramp is used, its output is always marked as machine-generated and unreviewed, so human expertise is a structurally necessary component rather than an optional quality check.

---

## The Editor

The editor is a dual-view workbench: two panes, always.

1. **Left pane: the text surface.** View tabs switch between the diplomatic **Reading text** (folio by folio; editable units are words when `<w>` is present, lines otherwise; edits are offset splices into the canonical string) and the editable **XML source** (syntax-highlighted, line numbers, Check XML, Apply gated on well-formedness). Live integrity checks sit in the pane head as a chip with a detail popover.
2. **Right pane: the context panel.** Panel tabs switch between the **Facsimile** (a real [OpenSeadragon](https://openseadragon.github.io/) 5.0.1 deep-zoom viewer over the page image, with `<zone>` overlays bidirectionally linked to the reading text; IIIF-ready tileSource hook), the **Index** (an editable `<standOff>` of persons, places, organisations, works, and events with authority identifiers and mention counts), and, when a project folder is open, the **Project** panel (the folder's TEI and plaintext files; click a file to switch the open document). The panel registry is open for project-specific panels.

Annotation happens at the text: select words to annotate them, click a mention to edit its annotation and authority ids in place, right-click for the context menu. All operations stay inside the lossless offset-splice model.

---

## Key Features

| Feature | Description |
|---------|-------------|
| **Lossless editing core** | Raw TEI string is canonical; edits are absolute-offset splices; `serialize()` is byte-identical for untouched content. DOM-free. |
| **Editing unit from the document** | Word-level when `<w>` is present, line/cell-level otherwise; read from the encoding, no configuration needed to open a file. |
| **Project manifests** | An optional `teicrafter.project.json` next to the edition configures name, IIIF image resolver, indices and views, and the allowed markup declared per document type (one project can hold several genres). |
| **Project folders** | A folder granted once through a File System Access directory handle; the Project panel lists its TEI and plaintext files; a plaintext file opens as a deterministic line-level draft, and the first save creates the `.xml` next to the source. |
| **Real OpenSeadragon facsimile** | Deep-zoom page image with `<zone>` overlays bidirectionally linked to the reading text; IIIF-ready tileSource hook. |
| **In-browser index management** | Editable `<standOff>` of persons, places, organisations, works, and events with mention linking via `<name ref>`. |
| **Live validation and structure** | Integrity checks and a structural outline alongside the reading text. |
| **LLM on-ramp** | Optional "New from text" drafts an initial TEI into the same editor, marked violet and unreviewed. Currently switched off (feature flag). |
| **Runs in the browser** | No server and no build step; static files deployed from `/docs`. Editions are read from and saved to local files. |
| **API keys (on-ramp only)** | Keys are held in memory for the session and never persisted. |

---

## Quick Start

1. Open [teiCrafter on GitHub Pages](https://digitalhumanitiescraft.github.io/teiCrafter/).
2. Open a local edition, or load one of the three example projects (from the landing page cards, the welcome cards, or the Load menu); each loads with its project manifest, so the status line names the project and the document's type.
3. To work on a whole project, use **Load... > Open project folder...** (Chromium browsers): the folder's TEI and plaintext files appear in the Project panel, and clicking a file opens it.
4. Navigate folio by folio. Click a word (word-level editions) or a line (line-level editions) to correct its text.
5. Use the facsimile pane to inspect the page image; zone overlays highlight in sync with the reading text.
6. Switch the right pane to **Index** to add or link persons, places, organisations, works, and events.
7. Save the edition back losslessly.

The LLM on-ramp ("New from text (LLM)") is currently switched off in the preview. When enabled, it accepts plaintext and an API key, and the drafted TEI opens in the same editor, marked violet and unreviewed for you to verify.

---

## Architecture

teiCrafter is a client-only application built from native ES6 modules, with no build step, no framework, and no NPM runtime dependencies.

```
teiCrafter/
├── docs/
│   ├── index.html              Landing page (hero, example cards, feature strip)
│   ├── editor.html             Editor: dual-view shell; loads OpenSeadragon 5.0.1 from CDN
│   ├── about.html              What the tool is, what saving does, status and licence
│   ├── css/
│   │   ├── style.css           Design tokens (--color-*/--space-*/--font-*/--radius-*) + base + site chrome
│   │   └── editor.css          Editor styles (token-only)
│   └── js/
│       ├── editor/             The three engine layers (tei-document, edition, editor-app)
│       │                       plus the feature modules: facsimile, standoff, criticism,
│       │                       annotation-ui, entity-index, index-panel, source-view,
│       │                       project-profiles, project-manifest, plaintext-import,
│       │                       authority-form, recent-files, gen-modal, ai-suggest, dom
│       ├── services/           llm, authority-lookup, storage
│       └── utils/              constants
├── pipeline/                   Deterministic SZD Page-JSON to TEI converter (Python)
└── test/                       Headless harness and engine proofs
```

The authoritative module map with per-file responsibilities and the import closure is [knowledge/architecture.md](knowledge/architecture.md).

### Technology Decisions

| Decision | Rationale |
|----------|-----------|
| No framework | Reduces complexity, maximizes longevity, avoids dependency churn |
| ES6 modules (native) | No bundler needed, direct browser execution |
| Raw string as canonical | Edits are offset splices into the opened string; serialize returns that string, so untouched content cannot change |
| DOM-free editing core | Round-trip fidelity does not depend on a serializer's whitespace choices |
| CSS custom properties | Design tokens are the single source of truth; no raw hex in components |
| Fetch API only | No HTTP library dependencies |
| Module-scoped API keys | Never on window, DOM, localStorage, or cookies |

For the complete technical specification, see the [knowledge base](knowledge/).

---

## LLM Integration (on-ramp only)

The optional "New from text" path supports multiple providers through a unified client. API keys are held exclusively in module-scoped memory for the duration of the session; they are never persisted to disk, DOM, or browser storage. The deterministic editor path uses no LLM and needs no key. The on-ramp is currently switched off behind the feature flag `FEATURES.llmOnRamp` (in `docs/js/utils/constants.js`); the modal, prompt, and provider client remain in the codebase.

AI-generated drafts open in the editor marked in the violet token family (`--color-ai`) and are counted as unreviewed until a human confirms them.

---

## Round-trip Fidelity

The editing core is proven headlessly by exit code:

| Proof | Asserts | Result |
|-------|---------|--------|
| `test/tools/roundtrip_sweep.mjs` | every real TEI serializes back byte-identically | 295/295 |
| `test/tools/generic_roundtrip.mjs` | one engine reads Hersch/WB/SZD; surgical cell edit; model shape | all pass |
| `test/tools/editor_roundtrip.mjs` | editor core identity + surgical word edit | 13/13 |
| `test/tools/szd_worked_example.mjs` | real SZD object end-to-end (open, correct, annotate, criticize, save), every step a surgical splice | 38/38 |
| `test/tools/zbz_worked_example.mjs` | real ZBZ object end-to-end, mirror of the SZD proof (SKIPs without the local-only object) | 38/38 |
| `test/tools/make_curated_set.mjs` | curated before/after pairs with diff, generated through the engine and verified per object | PASS |
| `test/harness/selftest.mjs` | negative gate (identity passes, corruption fails) | 14/14 |
| `test/harness/run.mjs` | synthetic fixtures, MVP gate | all PASS |

The sweep reads source repositories directly; no third-party TEI is committed. Run a proof with, for example, `node test/tools/roundtrip_sweep.mjs`.

---

## Real Cases

| Case | Source | Shape | Granularity | Editable now? |
|------|--------|-------|-------------|---------------|
| Wenzelsbibel | Codex 2759 (real codex local-only, licence-restricted; synthetic twin in the public preview) | `<w xml:id>`, `<facsimile>`/`<zone>`, `<standOff>` | word | yes, directly |
| Jeanne Hersch | zbz-ocr-tei | `<p>` + `<lb facs>`, real zones, no `<w>` | line | yes, directly |
| Stefan Zweig | szd-htr | catalog TEI + Page-JSON (no transcription TEI) | line | yes, via the deterministic converter (`pipeline/export_tei.py`, byte-faithful to its reference prototype) |

Real third-party TEI is never committed; only synthetic twins ship with the repository.

---

## Research Context

The intersection of LLMs and TEI-XML encoding emerged as a distinct research area in 2025. A survey by Pollin, Fischer, Sahle, Scholger, and Vogeler (2025) in *Zeitschrift fur digitale Geisteswissenschaften* identifies key application areas for LLMs in digital scholarly editing and references teiCrafter explicitly.

Key themes from the 2025-2026 research landscape:

- No integrated, browser-based system combines lossless TEI editing with an LLM on-ramp and human-in-the-loop review.
- No benchmark for LLM-generated TEI-XML quality has been published.
- Confidence calibration for structured annotation (as opposed to classification) remains underdeveloped.
- Expert-LLM agreement on domain-specific tasks is limited, confirming the necessity of human review.

For positioning and the market scan, see [knowledge/project.md](knowledge/project.md).

---

## Synergy Projects

| Project | Connection |
|---------|-----------|
| [coOCR HTR](http://dhcraft.org/co-ocr-htr) | Upstream tool: transcription feeds into teiCrafter editing |
| Schliemann Account Books | Bookkeeping ontology, transaction annotation |
| zbz-ocr-tei | DTA base format, historical print, Jeanne Hersch line-level case |
| DoCTA (CoReMA) | Medieval recipe annotation |
| DIA-XAI | EQUALIS framework, expert-in-the-loop evaluation |

---

## Knowledge Base

The project maintains a knowledge base in [`knowledge/`](knowledge/) following the Promptotyping Documents convention (function-separated, with YAML frontmatter). Start at [INDEX.md](knowledge/INDEX.md).

| Document | Function |
|----------|----------|
| [INDEX.md](knowledge/INDEX.md) | Navigation, document map, glossary |
| [project.md](knowledge/project.md) | Identity, positioning, success criteria |
| [data.md](knowledge/data.md) | Formats, TEI test corpus, real-case material |
| [specification.md](knowledge/specification.md) | Requirements, function cores, decisions |
| [user-stories.md](knowledge/user-stories.md) | Acceptance scenarios |
| [architecture.md](knowledge/architecture.md) | Components, data flow, editor engine, status |
| [design.md](knowledge/design.md) | Design system, tokens, UI components |
| [testing.md](knowledge/testing.md) | Test approach, engine proofs, harness |
| [journal.md](knowledge/journal.md) | Development log |
| [integration.md](knowledge/integration.md) | Cross-project data flow (ZBZ and SZD pipelines into the editor) |
| [goals.md](knowledge/goals.md) | Goals and milestones register (H1 to H7) with proof per "done" line |
| [converter-reference.md](knowledge/converter-reference.md) | Deterministic SZD Page-JSON v0.2 to TEI mapping |
| [worked-example-szd.md](knowledge/worked-example-szd.md) | Real SZD object end-to-end in the editor |
| [worked-example-zbz.md](knowledge/worked-example-zbz.md) | Real ZBZ object end-to-end, with the added-value before/after |
| [curated-set.md](knowledge/curated-set.md) | Curated example set: before/after pairs, method, rights status |
| [paper-evidence.md](knowledge/paper-evidence.md) | Every externally citable number with source and verification command |
| [promptotyping-case.md](knowledge/promptotyping-case.md) | teiCrafter as a Promptotyping case, status spine, talking points |

Milestone evaluation reports live in [`reports/`](reports/).

---

## Local Development

No build step is required. Serve the `docs/` directory with any static file server:

```bash
# Python
python -m http.server 8000 --directory docs

# Node.js (npx)
npx serve docs

# PHP
php -S localhost:8000 -t docs
```

Then open:

- Landing: `http://localhost:8000/`
- Editor: `http://localhost:8000/editor.html`

A modern browser with ES6 module support is required.

### Running the Proofs

The headless engine proofs run under Node:

```bash
node test/tools/roundtrip_sweep.mjs
node test/tools/generic_roundtrip.mjs
node test/tools/editor_roundtrip.mjs
node test/harness/selftest.mjs
node test/harness/run.mjs
```

---

## Contributing

This is a research prototype under active development. Contributions, feedback, and collaboration inquiries are welcome. Please open an issue to discuss changes before submitting a pull request.

---

## Citation

If you use teiCrafter in academic work, please cite:

> Pollin, C., Fischer, F., Sahle, P., Scholger, M., & Vogeler, G. (2025). When it was 2024 -- Generative AI in the Field of Digital Scholarly Editions. *Zeitschrift fur digitale Geisteswissenschaften*, 10. DOI: [10.17175/2025_008](https://doi.org/10.17175/2025_008)

---

## License

This work is licensed under a [Creative Commons Attribution 4.0 International License](https://creativecommons.org/licenses/by/4.0/).

You are free to share and adapt this material for any purpose, provided you give appropriate credit.

---

## Disclaimer

**Research Preview** -- teiCrafter was developed using Promptotyping methodology as part of the [Digital Humanities Craft](https://github.com/DigitalHumanitiesCraft) initiative. The deterministic editor never rebuilds the file, so every byte outside deliberate edits is preserved; the optional LLM on-ramp produces drafts that require expert review before use in scholarly publications. The authors make no warranty regarding the correctness, completeness, or fitness for purpose of any generated output.

API keys entered for the LLM on-ramp are held only in browser memory for the duration of the session and are never transmitted to any server other than the selected LLM provider.
