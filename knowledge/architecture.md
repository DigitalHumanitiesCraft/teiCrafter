---
title: teiCrafter Architecture
project:
  name: teiCrafter
  repository: https://github.com/DigitalHumanitiesCraft/teiCrafter
method:
  name: Promptotyping
  url: https://lisa.gerda-henkel-stiftung.de/digitale_geschichte_pollin
template:
  name: Vorlage Architecture
  version: 0.1
  url: https://dhcraft.org/Promptotyping/promptotyping-document/architecture
status: active
created: 2026-02-05
updated: 2026-05-27
language: en
version: 0.3
topics: ["[[Software Architecture]]", "[[Web Components]]"]
related: [specification, data, design]
---

# teiCrafter Architecture

How teiCrafter is built. Client-only, no backend, native ES6 modules without a bundler, deployed via GitHub Pages from `/docs`. All processing (LLM annotation, schema validation, document management) runs in the browser; external LLM APIs are called directly over HTTPS. This document covers the runtime architecture, the data model and editor engine, and the current implementation status; the visual layer is in [design](design.md).

## Four-Layer Architecture

| Layer | Components |
|-------|-----------|
| UI | Header plus stepper, source panel, XML editor, preview plus review |
| Application | DocumentModel, schema engine, transform service, export service |
| Service | LLM API, ODD parser, validator, event system |
| Persistence | LocalStorage (settings), in-memory only for API keys |

### Technology Decisions

No framework (reduces complexity, improves longevity). Native ES6 modules (no bundler). EventTarget for state (native API, DevTools integration, no custom event bus). CSS custom properties for theming. Fetch API for REST. No backend (data sovereignty, zero hosting cost, Ollama as a local option). The one candidate external dependency is CodeMirror 6 for the production editor; it is justified because the editor is the most critical component and a custom implementation of autocompletion, gutter and large-document performance would exceed the cost of adopting the library.

LLM providers: Gemini, OpenAI, Anthropic, DeepSeek, Qwen, Ollama. API keys live in a module-scoped Map in `llm.js`, never written to storage or any backend, volatile on tab close.

## File Structure

```
docs/
  index.html              Entry point, three-column layout
  css/style.css           Token system, fonts, components
  js/
    app.js                Initialisation, workflow stepper, current state holder
    model.js              Reactive document model, undo/redo
    tokenizer.js          XML tokenizer (pure function, state machine)
    editor.js             XML editor (overlay technique)
    preview.js            Interactive preview plus review
    source.js             Source panel
    services/             llm, transform, schema, validator, export, storage
    utils/                constants, dom
  schemas/dtabf.json      Schema profile (interactive annotation)
  data/demo/              Plaintext inputs, mapping templates, expected output
  tests/                  Browser test runner, unit tests, visual matrix
```

## Reactive Document Model

All views are projections of one shared model; no view talks to another, each registers as an observer. The model holds four state layers that together form a document version:

| Layer | Content |
|-------|---------|
| Document | The TEI-XML tree (canonical) |
| Confidence | Category per annotated element (confident, review-worthy, problematic, manual) |
| Validation | Messages with document positions, recalculated on every change, never blocking |
| Review status | Per element: open, accepted, edited, rejected |

Implemented as a class extending EventTarget; every change fires a typed event (`documentChanged`, `selectionChanged`, `confidenceChanged`, `validationComplete`, `reviewAction`, `transformComplete`, `undoRedo`). Undo operates on the model, not the UI, because one action (for example Accept) changes the tree, the confidence layer and the review status together; each action snapshots the whole model. A transform is one undo unit; keystrokes group into word units; stack limit 100.

## Editor Engine

The editor must do syntax highlighting, gutter confidence markers, cursor coupling with the preview, schema autocompletion, inline validation, line numbers, undo/redo, and perform at 500-plus lines. Three options were weighed: overlay (zero dependency, but scroll-drift and cursor-mapping risk), CodeMirror 6 (proven, gutter and autocompletion built in, but a dependency), ContentEditable (natural cursor, but browser inconsistencies). Decision: overlay for the prototype, CodeMirror 6 for production, ContentEditable rejected. The overlay spike (Session 8) passed with no scroll drift at 500 lines.

A custom XML tokenizer is required independently of that choice: a pure function, character-by-character state machine producing token types (element, attrName, attrValue, delimiter, comment, pi, namespace, entity, text) as `{type, value, start, end}`, reusable in editor, preview and tests. Confidence is mapped in a later layer that compares token positions against the model; per line the dominant category (problematic over review-worthy over confident over manual) drives the gutter marker.

## Editor Path (specified, not yet built)

The Editor-path components are specified in [specification](specification.md) but not yet implemented: local read and write via the File System Access API, a folio-segmenting load strategy for large editions, an in-memory `xml:id`/`corresp` index across files, a facsimile pane (OpenSeadragon) whose page images are loaded from a IIIF manifest or METS image references, form-based authoring views, and StandOff range editing. The production editor engine (CodeMirror 6) is the substrate for this path.

## Implementation Status

The Generator-path prototype has all modules implemented; the gap is wiring, not implementation. Integrated end to end: Import, Mapping selection, the real Transform path (app.js to transform.js to llm.js with prompt assembly and response parsing), Validation levels 1 and 2, Export with options, LLM configuration. Module-ready but not wired into app.js: the editor (editor.js) and the interactive preview and review (preview.js), and with them gutter confidence, inline review and the diff view.

Known critical gaps: the view modules are not integrated (the live preview is regex-based HTML, no review in the UI); the Generator workflow has never been run against a real LLM (demo data is in place); few-shot examples are not yet in prompt assembly (the highest single quality lever). Important: app.js uses its own state holder rather than the reactive DocumentModel, so there is no undo/redo or observer sync in the UI yet; `computeLineConfidence()` is a stub. XPath validation and LLM-as-a-judge are Phase 3. The Editor path is specification only.

Tests: a browser-based runner, no Node dependency. Unit tests cover tokenizer, model and validator; the service and view modules (llm, transform, schema, export, app, editor, preview) are not yet unit-tested.

## Related

- [specification](specification.md) for what the components must do
- [data](data.md) for the formats the editor and generator consume
- [design](design.md) for the visual and interaction layer
