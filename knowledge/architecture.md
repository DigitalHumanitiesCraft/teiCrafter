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
updated: 2026-06-04
language: en
version: 0.4
topics: ["[[Software Architecture]]", "[[TEI XML]]"]
related: [specification, data, design, testing]
---

# teiCrafter Architecture

How teiCrafter is built. Client-only, no backend, native ES6 modules without a bundler or build step, deployed via GitHub Pages from `/docs`. All processing (parsing, editing, validation) runs in the browser; the optional LLM call goes directly to the provider over HTTPS. The visual layer is in [design](design.md); the offline evaluation harness is in [testing](testing.md).

## Two Entry Points, One Editor

```
index.html   (landing: two cards)
  |
  +-- editor.html ........ open existing TEI, edit, save        (deterministic)
  +-- editor.html#generate New from text (LLM) -> same editor   (LLM on-ramp)
```

Both entries land in the same editor. There is no multi-step stepper; the prior LLM Generator workflow (a five-step Import/Mapping/Transform/Validate/Export app) was removed in the 2026-05-30 consolidation (recoverable from git history).

## The Editor Engine: Three Layers

The engine is three pure-then-UI layers. The lower two are DOM-free, so the exact code the browser runs is the code the Node harness measures.

| Layer | File | Responsibility |
|-------|------|----------------|
| 1. Generic document core | `js/editor/tei-document.js` | A small XML tokenizer builds an offset-true tree: every element, attribute value and text node carries byte offsets into the raw string. Schema-free recognizers by local-name (`pb`, `lb`, `l`, `w`, `surface`, `zone`, `note`, `@facs`, entities). Lossless edit ops (`editTextNode`, `editAttrValue`, `spliceDocument`). `serialize()` returns the raw string, so round-trip is byte-identical by construction. |
| 2. Edition model | `js/editor/edition.js` | Projects any parsed TEI into the shape the UI consumes: folios (split by `<pb>`), lines (by `<lb>`/`<l>`), and editable cells (reading-text nodes). The profile (`word` if `<w>` present, else `line`) emerges from the document. `editWordText`/`editCell` apply a lossless splice and re-parse. Preserves a back-compatible API used by the headless proofs. |
| 3. UI controller | `js/editor/editor-app.js` | Three-pane shell wiring: open (File System Access API with a file-input fallback, plus the served synthetic demo), folio navigation, inline cell editing, the OpenSeadragon facsimile with zone linking, the browser-light validation panel, the tabbed index panel, save and download, and the LLM on-ramp modal. |

### Supporting modules (around the engine)

| File | Responsibility |
|------|----------------|
| `js/editor/facsimile.js` | Real OpenSeadragon deep-zoom viewer (5.0.1 from CDN) over the page image, with `<zone>` rectangles overlaid and bidirectionally linked to the reading text. Plain-image tileSource with an IIIF-ready hook. Project-dependency-free (uses the global `OpenSeadragon`). |
| `js/editor/standoff.js` | DOM-free, lossless `<standOff>` model over `tei-document.js`: read/add/update/delete `person`/`org`/`event` entities, and link in-text mentions by wrapping them in `<name ref="#id">`. Every mutation is an offset splice; a no-op returns the same doc, so the round-trip stays byte-identical. Inserted scaffolding adopts the document's own newline (CRLF/LF). |
| `js/editor/index-panel.js` | Index-management UI (persons/orgs/events) with entity <-> mention <-> zone highlighting. Imports nothing project-internal; drives `standoff.js` through `editor-app.js`. |

### Why an offset-splice core, not the DOM

`DOMParser` + `XMLSerializer` drift: they normalise whitespace, reorder attributes, rewrite entities and self-closing tags. For a tool whose promise is "save changes nothing you did not edit", that is disqualifying. The custom tokenizer keeps the raw string canonical and edits it by absolute offsets, so any markup the tree-builder does not even interpret is still preserved verbatim. This is verified on every real file (see [testing](testing.md)).

## Services

| File | Role |
|------|------|
| `js/services/llm.js` | Multi-provider LLM client (Gemini, OpenAI, Anthropic, DeepSeek, Qwen, Ollama). API keys live only in a module-scoped Map, never written to storage or any backend, volatile on tab close. `fetch` uses `credentials: 'omit'`. |
| `js/services/storage.js` | LocalStorage for non-secret settings (provider, model choice). |
| `js/utils/constants.js` | Provider ids, source-type labels, and default mapping rules for the LLM on-ramp. |

The LLM on-ramp builds a minimal annotate prompt in `editor-app.js`, calls `llm.js` `complete()`, extracts the XML from the response, and loads it into the editor flagged as generated (violet banner, unreviewed).

## File Structure

```
docs/
  index.html              Landing: two entry cards (editor, LLM on-ramp)
  editor.html             The editor: three-pane shell + LLM modal; loads OpenSeadragon 5.0.1 from CDN
  css/
    style.css             Design tokens (--color-*, --space-*, --font-*, --radius-*) + base
    editor.css            Editor-specific styles (token-only)
  js/
    editor/
      tei-document.js     Layer 1: generic offset-true core (DOM-free)
      edition.js          Layer 2: folios/lines/cells model (DOM-free)
      editor-app.js       Layer 3: UI controller + LLM on-ramp
      facsimile.js        OpenSeadragon viewer: page image + zone overlays, IIIF-ready
      standoff.js         Lossless <standOff> model (person/org/event) + mention linking
      index-panel.js      Index-management UI; entity/mention/zone highlighting
    services/
      llm.js              Multi-provider LLM client (keys in memory only)
      storage.js          Settings persistence
    utils/
      constants.js        Providers, source labels, default mappings
  data/editor/
    wenzelsbibel-synthetic-codex.xml   Served synthetic word-level demo edition
    zbz-100/              Real Jeanne Hersch example (TEI + page PNGs); gitignored, local-only (rights)
```

## State

The editor holds a single `app` state object: the current edition model, the current folio index, an optional File System file handle (for save-in-place), the document name, a dirty flag, a load-time baseline (word ids and tag counts, for the integrity check), and a generated flag. Edits return a new immutable model from `edition.js` and replace `app.state`; offsets stay correct because the model is re-parsed from the spliced raw string.

## Validation (hybrid)

- **Browser-light (live, in `editor-app.js`):** well-formedness via `DOMParser` (read-only check, not used for serialization), plus structural integrity against the load-time baseline (no lost word ids, element counts unchanged). This is the lossless-round-trip evidence shown live.
- **Harness-heavy (offline, `test/`):** TEI All RelaxNG and Schematron via Python/lxml, run on demand. See [testing](testing.md).

## Implementation Status

Built and verified: the three-layer editor engine, open/navigate/edit/save, the real OpenSeadragon facsimile with `@facs` zone linking, `<standOff>` index management (person/org/event) with in-text mention linking via `<name ref>`, browser-light validation, the LLM on-ramp, and the offline harness. The byte-identical round-trip and surgical-edit behaviour are proven headlessly on real data; the browser click-through (load demo, word edit, navigation, live validation, add/link/delete an index entity) was exercised and confirmed in-app on 2026-06-04.

Not yet built (see [specification](specification.md) "Future"): a true IIIF tiles/manifest source (the viewer currently uses a plain-image tileSource), a StandOff critical-apparatus editor, project modules, a CodeMirror source view, and a streaming/segmented load for very large (tens of MB) editions. Live OpenSeadragon rendering over a real page image is verifiable only via the rights-encumbered local ZBZ example, so it remains the one path the committed demo cannot show.

## Related

- [specification](specification.md) for what the components must do
- [data](data.md) for the formats the editor consumes and the real test corpus
- [design](design.md) for the visual and interaction layer
- [testing](testing.md) for the proofs and the offline harness
