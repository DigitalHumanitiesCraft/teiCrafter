# teiCrafter

**A browser-based, lossless editor for arbitrary TEI-XML**

**[Open the editor](https://digitalhumanitiescraft.github.io/teiCrafter/)** -- no installation, runs entirely in the browser, your files stay on your device.

> **Research Preview** -- an active research prototype developed with the [Promptotyping](https://github.com/DigitalHumanitiesCraft) method. It demonstrates lossless, expert-in-the-loop TEI editing with an optional LLM on-ramp, and is under active development. Not intended for production use yet.

[![License: MIT](https://img.shields.io/badge/License-MIT-lightgrey.svg)](LICENSE)
[![GitHub Pages](https://img.shields.io/badge/editor-GitHub_Pages-blue)](https://digitalhumanitiescraft.github.io/teiCrafter/)

---

## Why this tool

We first worked on teiCrafter in autumn and winter 2023. We wanted a TEI-XML editor that supports LLM-assisted TEI creation while keeping the editor itself at the center, not the language model. A rough prototype existed and more or less worked; we presented it at FORGE 2023 on the Hugo Schuchardt correspondence.[^forge] We also understood back then that turning it into a real research tool would cost substantial time and resources, and that the tool might not be needed in the end.

Almost three years later, we are simply building the editor. Mainly because frontier models make it far easier: the development method is Promptotyping, agentic coding against a maintained knowledge base. We are aware that this way of producing code consumes considerable resources. The tool is open source and free to use, and it is maintained, because we need it ourselves for internal Digital Humanities Craft projects and develop it further through our funded projects. It is built with resource-intensive frontier technology (Claude Fable 5 and Opus in Claude Code) and handed on as a free tool to editors.

teiCrafter is a static browser tool and runs locally. For LLM support you bring your own model, whether a locally hosted LLM or a commercial provider; the deterministic editing path needs no model at all. The repository is on GitHub, the editor runs on GitHub Pages.

**Open development.** Whoever uses the tool can give feedback and request features through GitHub issues; we are glad to build them in. And teiCrafter is designed as a customizable TEI editor, on two levels. First in the UI itself, through configuration: a declarative project manifest (`teicrafter.project.json`) describes a project's document types, allowed markup, indices and image resolution. Second by forking the repository and letting Claude Code (or another coding agent) implement your own adaptations: the knowledge the agent needs about the tool is already in the project's [knowledge base](knowledge/), which is written to serve as the agent's interface. This decouples adaptability from the original developer team.

What the tool aims to do:

* Be a TEI-XML editor, for creating and editing TEI.
* Integrate LLM-assisted work into the UI itself (always marked as machine-generated; the model assists, the human decides).
* Be operable by an AI agent as well as a human; the knowledge base is written as that agent interface.
* Be adaptable to your own projects, in the UI through the project manifest or by fork plus coding agent.
* Test whether such a tool can run productively as a static browser application.
* Remain free: developed with frontier models, given away as an open tool for editors.

[^forge]: Pollin, Christopher, Christian Steiner and Constantin Zach. 2023. "New Ways of Creating Research Data: Conversion of Unstructured Text to TEI XML Using GPT on the Correspondence of Hugo Schuchardt with a Web Prototype for Prompt Engineering." FORGE 2023, Tuebingen, October 10. https://doi.org/10.5281/zenodo.8425163.

---

## Overview

teiCrafter is a client-only, browser-based editor for arbitrary [TEI-XML](https://tei-c.org/). You open an existing edition, correct it folio by folio, and save it back with every byte outside your deliberate edits unchanged. Most XML tools parse a file into a tree and re-serialize it on save, silently normalising attribute order, entity notation and whitespace; teiCrafter never rebuilds the file. The opened string itself remains the document, an edit replaces exactly the edited passage inside it, and saving an untouched document reproduces the input byte for byte. The practical consequence: a file diff after saving shows precisely the human intervention and nothing else.

TEI encodes its own structure, so the editor reads the editing unit from the document instead of asking for configuration: word-level where the TEI tokenizes words (`<w>`), line-level where it marks only line breaks (`<lb>`). Any TEI opens without setup; an optional project manifest (`teicrafter.project.json` next to the edition) adds project-specific settings such as an image resolver, indices, authority reconciliation, and the allowed markup. A project is not a single edition type: one project can hold several document types (for Stefan Zweig Digital: letters, life documents, typescripts), so the manifest declares the allowed markup per document type and the markup offered in the editor follows the open document's type. You can also open a whole project folder: granting a folder once through the browser's File System Access directory handle (Chromium browsers) lists its files in the Project panel.

Plaintext is a first-class entry: a `.txt` or `.md`, opened directly (file picker, drag and drop) or from a project folder, becomes a minimal line-level TEI draft produced by a fixed rule (paragraphs on blank lines, a line-break element separating the lines of a paragraph, a `|N|` token as a page break, the text carried verbatim and XML-escaped). This is transport, not interpretation, so the draft is deliberately not marked as machine-generated. The same deterministic draft can take page images: "New from text and images" attaches images by page order, holds them in memory, and writes them next to the TEI on a project-folder save (a plain download warns that the images stay behind). An unsaved draft survives a reload through a recovery offer. There is no build step.

Two paths lead into the same editor:

- **Open and edit existing TEI** -- the deterministic path. Open a local edition, correct word or line text, manage an index, link facsimile zones, and save losslessly. No LLM is involved.
- **New from text (LLM)** -- an optional on-ramp. Paste plaintext and a model drafts an initial TEI that opens straight in the same editor for verification and correction. AI-generated content is marked in the violet token family and counts as unreviewed. The model assists; the human decides. Enabled by the feature flag `FEATURES.llmOnRamp` (a build default) plus a per-user toggle in the Load menu; turning it off leaves a fully deterministic editor with no AI surfaces.

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

The editor is a dual-view workbench: two panes, always. A document strip in the toolbar carries the document facts (name, project, document type, editing unit, page count); it is non-interactive and there is no separate Document panel.

1. **Left pane: the text surface.** View tabs switch between the diplomatic **Reading text** (editable units are words when `<w>` is present, lines otherwise; edits are offset splices into the canonical string) and the editable **XML source** (syntax-highlighted, line numbers, Check XML, Apply gated on well-formedness). The reading text shows page by page or as a continuous view, one renderer behind both; in the continuous view the facsimile follows the hovered line's page. Live integrity checks sit in the pane head as a chip with a detail popover that defines its terms.
2. **Right pane: the context panel.** Panel tabs switch between the **Facsimile** (a real [OpenSeadragon](https://openseadragon.github.io/) deep-zoom viewer over the page image, with `<zone>` overlays bidirectionally linked to the reading text; IIIF-ready tileSource hook), the **Index** (an editable `<standOff>` of persons, places, organisations, works, and events with authority identifiers and mention counts), and, when a project folder is open, the **Project** panel (the folder's TEI and plaintext files; click a file to switch the open document). The panel registry is open for project-specific panels.

Annotation happens at the text: select words and pick from one flat, filterable action list (entities, markup, textual criticism, notes), click a mention to edit its annotation and authority ids in place (with a live candidate lookup against Wikidata, GND and GeoNames), right-click for the context menu (which also carries the line-level structure edits: split, merge, insert a line break, delete an empty element). A markup entry declared in the manifest can carry one attribute field, so for example a date and its normalized `@when` commit as one step. All operations stay inside the lossless offset-splice model.

---

## Key Features

| Feature | Description |
|---------|-------------|
| **Lossless editing core** | Raw TEI string is canonical; edits are absolute-offset splices; `serialize()` is byte-identical for untouched content. DOM-free. |
| **Editing unit from the document** | Word-level when `<w>` is present, line/cell-level otherwise; read from the encoding, no configuration needed to open a file. |
| **Author-mode structure edits** | From the reading context menu: split or merge a line, insert a line break, or delete an empty element; each is a lossless offset splice through the single mutation path, and an inserted line-break milestone takes the document's own form. |
| **Project manifests** | An optional `teicrafter.project.json` configures name, IIIF image resolver, indices, authority reconciliation, and the allowed markup declared per document type, including per-wrap attribute fields. |
| **Project folders** | A folder granted once through a File System Access directory handle; the Project panel lists its TEI and plaintext files; a plaintext file opens as a deterministic draft, and the first save creates the `.xml` next to the source. |
| **Plaintext entry** | `.txt`/`.md` open directly as a deterministic line-level draft; documented ingest conventions (blank line, a line-break element separating a paragraph's lines, `\|N\|` page marker); page images can attach by page order ("New from text and images"); never AI-marked. |
| **Draft recovery** | An unsaved draft persists locally and is offered for restore after a reload; nothing is discarded silently. |
| **Real OpenSeadragon facsimile** | Deep-zoom page image with `<zone>` overlays bidirectionally linked to the reading text; IIIF-ready tileSource hook. |
| **In-browser index management** | An overview of the `<standOff>` (persons, places, organisations, works, events) with mention linking via `<name ref>`; the panel's sections follow the project's declared indices, and a declared index with no editable entity type stays visible as read-only. |
| **Authority reconciliation** | Live candidate lookup (Wikidata, GND, GeoNames) at the point of annotation; automatic querying only by per-project opt-in; applying a candidate is always a human click. |
| **Live validation and structure** | Integrity checks (well-formed, lossless) with their definitions readable in the editor, alongside the reading text. |
| **LLM on-ramp** | Optional "New from text" drafts an initial TEI into the same editor, marked violet and unreviewed. Enabled (feature flag `FEATURES.llmOnRamp`) plus a per-user toggle. |
| **Runs in the browser** | No server and no build step; static files deployed from `/docs`. Editions are read from and saved to local files. |
| **API keys (on-ramp only)** | Keys are held in memory for the session and never persisted. |

---

## Quick Start

1. Open [teiCrafter on GitHub Pages](https://digitalhumanitiescraft.github.io/teiCrafter/) and open a local TEI file (or drop it anywhere on the editor page). The bundled example projects appear when the editor runs on a local development host.
2. To work on a whole project, use **Load... > Open project folder...** (Chromium browsers): the folder's TEI and plaintext files appear in the Project panel, and clicking a file opens it.
3. Navigate folio by folio. Click a word (word-level editions) or a line (line-level editions) to correct its text.
4. Use the facsimile pane to inspect the page image; zone overlays highlight in sync with the reading text.
5. Select text to annotate it; switch the right pane to **Index** to manage persons, places, organisations, works, and events.
6. Save the edition back losslessly.

The LLM on-ramp ("New from text (LLM)") is enabled. It accepts plaintext and an API key, and the drafted TEI opens in the same editor, marked violet and unreviewed for you to verify; a per-user toggle in the Load menu turns all AI surfaces off for a fully deterministic editor.

---

## Architecture

teiCrafter is a client-only application built from native ES6 modules, with no build step, no framework, and no NPM runtime dependencies. The engine is a three-layer, offset-true core: the raw TEI string is canonical, every edit is an offset splice into that string, and `serialize()` returns that string, so untouched content cannot change and round-trip fidelity does not depend on a serializer's whitespace choices. The authoritative module map with per-file responsibilities, the data flow and the technology decisions are in [knowledge/architecture.md](knowledge/architecture.md).

---

## LLM Integration (on-ramp only)

The optional "New from text" path supports multiple providers through a unified client; you bring your own model, whether a locally hosted LLM (e.g. via Ollama) or a commercial provider. API keys are held exclusively in module-scoped memory for the duration of the session; they are never persisted to disk, DOM, or browser storage. The deterministic editor path uses no LLM and needs no key. The on-ramp is enabled by the feature flag `FEATURES.llmOnRamp` (in `docs/js/utils/constants.js`) together with a per-user runtime toggle in the Load menu; turning it off leaves a fully deterministic standalone editor with no AI surfaces.

AI-generated drafts open in the editor marked in the violet token family (`--color-ai`) and are counted as unreviewed until a human confirms them.

---

## Round-trip Fidelity

The editing core is proven headlessly by exit code: `node test/run_all.mjs` is the one-command regression gate over every proof, and the full proof catalog is [knowledge/testing.md](knowledge/testing.md). The sweep reads source repositories directly; no rights-encumbered third-party TEI is committed.

---

## Real Cases

Three pipelines drive the tool and prove the engine: the Wenzelsbibel codex (word-level, `<w xml:id>` with facsimile and standOff), Jeanne Hersch from zbz-ocr-tei (line-level, `<p>` and `<lb facs>` with real zones), and Stefan Zweig from szd-htr (catalog TEI plus Page-JSON, editable via the deterministic converter `pipeline/export_tei.py`); the HSA sample letter is the plaintext-to-TEI walkthrough. The cases, their TEI shapes and their rights status are in [knowledge/data.md](knowledge/data.md). Real rights-encumbered third-party TEI is never committed; only synthetic twins and public-domain material ship with the repository.

---

## Research Context

The intersection of LLMs and TEI-XML encoding emerged as a distinct research area in 2025. A survey by Pollin, Fischer, Sahle, Scholger, and Vogeler (2025) in *Zeitschrift fuer digitale Geisteswissenschaften* identifies key application areas for LLMs in digital scholarly editing and references teiCrafter explicitly.

Key themes from the 2025-2026 research landscape:

- No integrated, browser-based system combines lossless TEI editing with an LLM on-ramp and human-in-the-loop review.
- No benchmark for LLM-generated TEI-XML quality has been published.
- Confidence calibration for structured annotation (as opposed to classification) remains underdeveloped.
- Expert-LLM agreement on domain-specific tasks is limited, confirming the necessity of human review.

For positioning and the market scan, see [knowledge/project.md](knowledge/project.md).

---

## Knowledge Base

The project maintains a knowledge base in [`knowledge/`](knowledge/) following the Promptotyping Documents convention (function-separated, with YAML frontmatter). Start at [INDEX.md](knowledge/INDEX.md); it carries the document map, one entry per document, and the glossary. This knowledge base is also the interface for coding agents: fork the repository, point an agent at `knowledge/`, and it has the patterns, decisions and constraints it needs to implement your adaptations.

Evaluation reports live in [`reports/`](reports/).

---

## Local Development

No build step is required. Serve the `docs/` directory with any static file server:

```bash
# Python
python -m http.server 8000 --directory docs

# Node.js (npx)
npx serve docs
```

Then open:

- Landing: `http://localhost:8000/`
- Editor: `http://localhost:8000/editor.html`

A modern browser with ES6 module support is required. Serve over `http://localhost` (not `file://`): the File System Access API (project folders, save-in-place) needs a secure context. The bundled example projects (landing cards and Load... entries) appear only on local development hosts; the public deployment hides them.

### Running the Proofs

```bash
node test/run_all.mjs        # the regression gate: every proof in one run
node test/harness/run.mjs          # the Python/lxml fixture validator (separate dependency set)
```

---

## Contributing

This is a research prototype under active and open development. Feedback, feature requests and collaboration inquiries are welcome through GitHub issues; we are glad to build in what editors actually need. For larger adaptations, the fork-plus-coding-agent path described above is a supported way of working: the knowledge base carries what an agent needs to know. Please open an issue to discuss changes before submitting a pull request.

---

## Citation

If you use teiCrafter in academic work, please cite:

> Pollin, C., Fischer, F., Sahle, P., Scholger, M., & Vogeler, G. (2025). When it was 2024 -- Generative AI in the Field of Digital Scholarly Editions. *Zeitschrift fuer digitale Geisteswissenschaften*, 10. DOI: [10.17175/2025_008](https://doi.org/10.17175/2025_008)

The original prototype and idea:

> Pollin, C., Steiner, C., & Zach, C. (2023). New Ways of Creating Research Data: Conversion of Unstructured Text to TEI XML Using GPT on the Correspondence of Hugo Schuchardt with a Web Prototype for Prompt Engineering. FORGE 2023, Tuebingen. DOI: [10.5281/zenodo.8425163](https://doi.org/10.5281/zenodo.8425163)

---

## Licence

- Code: MIT (see [LICENSE](LICENSE)).
- Documentation and knowledge documents (`knowledge/`, `docs/` prose): CC BY 4.0.
- Third-party research data that a user loads or edits is excluded from these licences and the rights remain with their holders.

---

## Disclaimer

**Research Preview** -- teiCrafter was developed using the Promptotyping method as part of the [Digital Humanities Craft](https://github.com/DigitalHumanitiesCraft) initiative. The deterministic editor never rebuilds the file, so every byte outside deliberate edits is preserved; the optional LLM on-ramp produces drafts that require expert review before use in scholarly publications. The authors make no warranty regarding the correctness, completeness, or fitness for purpose of any generated output.

API keys entered for the LLM on-ramp are held only in browser memory for the duration of the session and are never transmitted to any server other than the selected LLM provider. The full data-handling and vulnerability-reporting statement is in [SECURITY.md](SECURITY.md).
