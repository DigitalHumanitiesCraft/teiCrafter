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
updated: 2026-06-10
language: en
version: 0.9
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

The engine is three pure-then-UI layers. The lower two are DOM-free, so the exact code the browser runs is the code the Node harness measures. File paths in the engine and services tables below are relative to `docs/`.

| Layer | File | Responsibility |
|-------|------|----------------|
| 1. Generic document core | `js/editor/tei-document.js` | A small XML tokenizer builds an offset-true tree: every element, attribute value and text node carries byte offsets into the raw string. Schema-free recognizers by local-name (`pb`, `lb`, `l`, `w`, `surface`, `zone`, `note`, `@facs`, entities, `CRITICAL_LOCALS` for textual criticism) plus shared helpers (`splitEdge`, `nearestAncestor`, `isReadingContext`). Lossless edit ops (`editTextNode`, `editAttrValue`, `spliceDocument`); escaping preserves existing character/entity references and a no-op edit (the user's text decodes to what is already there) returns the same document, so editing a node holding `&nbsp;`/`&#nn;`/`&quot;` never corrupts it. `serialize()` returns the raw string, so round-trip is byte-identical by construction. |
| 2. Edition model | `js/editor/edition.js` | Projects any parsed TEI into the shape the UI consumes: folios (split by `<pb>`), lines (by `<lb>`/`<l>`), and editable cells (reading-text nodes). The profile (`word` if `<w>` present, else `line`) emerges from the document. `editWordText`/`editCell` apply a lossless splice and re-parse. Surfaces a `<gap/>` as its own read-only cell and tags every text cell with its immediate textual-critical wrapper (`crit`), whether the cell is that wrapper's sole content (`critSole`, the gate for a safe "clear"), and its linked entity id (`mention`, M2.5: the nearest `<name ref>` ancestor below the line/paragraph level; a pure read projection, no offset or serialization change). `rawRangeForDisplay` maps a display range (decoded text the renderer shows) back to raw offsets across entity references, the bridge from a mouse selection to a lossless sub-range splice (M2.8). Preserves a back-compatible API used by the headless proofs. |
| 3. UI controller / shell | `js/editor/editor-app.js` | The integrator since the M2.13 module split: owns the shared `app` state and shell wiring (loading via "Open TEI...", an Examples button menu, the full-width welcome surface with drag-and-drop and recent files, and a discard guard before any in-app document replacement; page turning in the reading-pane header plus arrow keys), renders the reading text under the M2.10 editor paradigm (plain click = cursor, click on a mention opens the annotation editor, double-click edits, right-click context menu) with the M2.5 visibility layer (per-entity-type mention colours with tooltips, violet plus dashed outline for AI-proposed targets, triple-coded note marker, per-document legend strip), hosts the OpenSeadragon facsimile with zone linking (auto-collapsed without page images), the live checks as a footer status chip with a detail popover, inline cell editing (text input, note input, critical chooser), and save/download. The feature surfaces live in their own modules (`annotation-ui.js`, `index-overlay.js`, `source-view.js`, `gen-modal.js`) and receive their dependencies via a ctx object; all inline mutations run through one shared `applyDocFn` path and one `refreshAfterStandoffEdit()`. |

### Supporting modules (around the engine)

| File | Responsibility |
|------|----------------|
| `js/editor/facsimile.js` | Real OpenSeadragon deep-zoom viewer (5.0.1 from CDN) over the page image, with `<zone>` rectangles overlaid and bidirectionally linked to the reading text. Plain-image tileSource with an IIIF-ready hook. Project-dependency-free (uses the global `OpenSeadragon`). |
| `js/editor/standoff.js` | DOM-free, lossless `<standOff>` model over `tei-document.js`: read/add/update/delete `person`/`place`/`org`/`work`/`event` entities, attach authority ids as `<idno type="GND\|GeoNames\|Wikidata">value</idno>` children (add/replace/remove via `setAuthority`), and link in-text mentions by wrapping them in `<name ref="#id">` -- whole node (`linkMention`, which retargets the enclosing `<name>` found by the same bounded walk the projection uses) or a sub-range of a node (`linkMentionRange`, M2.8, which refuses inside an existing `<name>`). Also creates editorial notes (`addNote`/`addNoteForNode`, anchored to a stable `@target` xml:id) and marks AI-proposed entities with `resp="#ai"` (`confirmEntity` drops the marker on human confirmation; reject is delete). Works are read scoped to `standOff`/`listBibl` so a `<bibl>` in the `teiHeader` is not misread as a work. Every mutation is an offset splice; a no-op returns the same doc, so the round-trip stays byte-identical. Inserted scaffolding adopts the document's own newline (CRLF/LF) and anchors after the `teiHeader`, else before `<text>`, else inside the document element, so a header-less TEI still gets a valid `<standOff>` instead of crashing. |
| `js/editor/criticism.js` | DOM-free, lossless inline textual-critical markup (M3.6): `markCritical` wraps a reading-text node's core in `<unclear>`/`<del>`/`<add>` (edge whitespace kept outside the tags) or replaces it with a self-closing `<gap/>` (omitted/illegible text, content-less per TEI); `unwrapCritical` reverses a wrap but refuses to strip a wrapper shared with sibling content; `removeGap` deletes a gap marker. The wrapped core is the raw, already-escaped slice spliced as-is (no decode/re-encode), and a no-op returns the same doc. |
| `js/editor/ai-suggest.js` | DOM-free helper for the AI entity-proposal path (M3.7): `buildSuggestPrompt` and a tolerant `parseSuggestions` (lenient JSON extraction, type normalization, dedup, never throws). The proposals are added as `resp="#ai"` entities for a human to confirm or reject. Since M2.11 the suggest UI is removed from the editor (operator decision 2026-06-10); the module is retained for a text-anchored re-entry. |
| `js/editor/index-panel.js` | Index-management UI (persons/places/orgs/works/events) with the shared authority form per entity, a live authority-lookup affordance, an AI-proposed (violet) row state with a confirm action, mention-count badges, and a two-step delete when an entity still has mentions (its refs would dangle). Since M2.11 it renders inside the on-demand Index overlay (no permanent pane); row click jumps to the entity's first in-text mention, and day-to-day authority editing happens in the annotation popover in `editor-app.js` through the same `standoff.js` paths. |
| `js/editor/authority-form.js` | The single source for the authority-id UI (existing `<idno>` chips with remove, add form, live register lookup), used by BOTH the index overlay rows and the annotation editor at the mention. Pure DOM; mutations and lookups are reported through hooks (`onSet`, `onLookup`), the register list is imported from `standoff.js` AUTHORITIES. |
| `js/editor/source-view.js` | Editable XML source view: syntax-highlighted overlay (a `<pre>` with token spans under a transparent textarea in scroll lockstep), line-number gutter, explicit "Check XML" with caret jump to the reported error line/column, Apply gated on well-formedness. `highlightXml` is a tolerant pure tokenizer (an unterminated tag mid-edit colours as far as it goes); proof `node test/tools/source_highlight_check.mjs` (stripping the spans reproduces the input byte-for-byte, incl. the real SZD object). The syntax palette uses the deterministic token families only (violet stays AI-only). Above ~1.5 MB it falls back to an unhighlighted surface. |
| `js/editor/project-profiles.js` | Built-in project profiles (WB-AP2; precursor of the `teicrafter.project.json` manifest decided 2026-06-10): a profile is detected from the document's `publicationStmt` PID and contributes an image resolver. The Wenzelsbibel profile (`o:wen.*`) maps a surface's bare `<graphic url>` filename to the ÖNB IIIF Image API `info.json` URL, so OpenSeadragon deep-zooms real tiles instead of one enormous jpg. Pure module (no DOM); proof `node test/tools/wb_codex_check.mjs`. |
| `js/editor/dom.js` | Tiny shared DOM helpers (`el`, `clear`), one source instead of per-module copies. |
| `js/editor/annotation-ui.js` | Everything that opens at the text under the M2.10 paradigm: the right-click context menu, the evidence-first annotate popover on a selection (M2.8, incl. the provenance-grouped entity choice and the full-TEI markup wraps), the annotation editor on a clicked mention with in-place authority editing (M2.11), and the word-profile entity picker. Receives its dependencies via ctx (`applyDocFn`, `refresh`, `entityMetaMap`/`entityUsage`, `runLookup`, `revealEntity`, the inline cell editors); wires its own global selection/contextmenu listeners. |
| `js/editor/index-overlay.js` | The on-demand index overlay (M2.11): index-panel hosting with the standOff mutation hooks, the M3.3 live authority lookup popover, mention-count merging, open/close/filter wiring, jump-to-first-mention and reveal-entry. |
| `js/editor/gen-modal.js` | The LLM on-ramp modal ("New from text"): provider/model/type selectors, in-memory key handling via llm.js, the minimal annotate prompt, response XML extraction, and its own modal wiring. |
| `js/editor/recent-files.js` | Persisted recent files for the welcome screen: FileSystemFileHandle records in IndexedDB (`listRecents`/`rememberRecent`/`forgetRecent`, max 5, keyed by name so reopening refreshes instead of duplicating). Chromium-only by nature; `supported` is false elsewhere and the Recent section simply does not render. Reopening re-requests permission inside the click (a user gesture); a dead handle removes its own row. |

### Why an offset-splice core, not the DOM

`DOMParser` + `XMLSerializer` drift: they normalise whitespace, reorder attributes, rewrite entities and self-closing tags. For a tool whose promise is "save changes nothing you did not edit", that is disqualifying. The custom tokenizer keeps the raw string canonical and edits it by absolute offsets, so any markup the tree-builder does not even interpret is still preserved verbatim. This is verified on every real file (see [testing](testing.md)).

## Services

| File | Role |
|------|------|
| `js/services/llm.js` | Multi-provider LLM client (Gemini, OpenAI, Anthropic, DeepSeek, Qwen, Ollama). API keys live only in a module-scoped Map, never written to storage or any backend, volatile on tab close. `fetch` uses `credentials: 'omit'`. |
| `js/services/authority-lookup.js` | DOM-free live authority search (M3.3): builds the query URL and parses the response for GND (lobid.org), Wikidata (`wbsearchentities`), and GeoNames (search JSON, requires a username). Feeds a picked identifier into `standoff.js` `setAuthority`. |
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
      standoff.js         Lossless <standOff> model: entities + authority idno + mentions + notes + resp="#ai"
      criticism.js        Lossless inline textual-critical markup (unclear/del/add/gap)
      ai-suggest.js       AI entity-proposal prompt + tolerant parser (UI removed in M2.11; module retained)
      index-panel.js      Index-management UI in the on-demand overlay; authority forms; mention counts
      annotation-ui.js    Context menu, annotate popover, annotation editor at the mention (M2.13 split)
      index-overlay.js    On-demand entity index overlay + live authority lookup (M2.13 split)
      gen-modal.js        LLM on-ramp modal ("New from text") (M2.13 split)
      authority-form.js   Shared authority-id form (idno chips + add + lookup), used by panel and annotation editor
      source-view.js      Editable XML source view: highlight overlay, line numbers, Check XML, gated Apply
      project-profiles.js Built-in project profiles: PID detection + IIIF image resolver (WB)
      recent-files.js     Recent files: persisted File System Access handles in IndexedDB
      dom.js              Shared DOM helpers (el, clear)
    services/
      llm.js              Multi-provider LLM client (keys in memory only)
      authority-lookup.js Live GND/Wikidata/GeoNames search (URL build + response parse)
      storage.js          Settings persistence
    utils/
      constants.js        Providers, source labels, default mappings
  data/editor/
    wenzelsbibel-synthetic-codex.xml   Served synthetic word-level demo edition
    zbz-100/              Real Jeanne Hersch example (TEI + page PNGs); gitignored, local-only (rights)
    zbz-1000/             ZBZ worked-example object (doc 1000 + graphic urls, M7.2); gitignored, local-only (rights); regenerate via test/tools/make_zbz1000_demo.mjs
pipeline/
  export_tei.py           SZD Page-JSON v0.2 -> teiCrafter-target TEI; deterministic (rule, never an LLM); contract frozen in knowledge/converter-reference.md
```

## State

The editor holds a single `app` state object: the current edition model, the current folio index, an optional File System file handle (for save-in-place), the document name, a dirty flag, a load-time baseline (word ids and tag counts, for the integrity check), and a generated flag. Edits return a new immutable model from `edition.js` and replace `app.state`; offsets stay correct because the model is re-parsed from the spliced raw string.

## Validation (hybrid)

- **Browser-light (live, in `editor-app.js`):** well-formedness via `DOMParser` (read-only check, not used for serialization), plus structural integrity against the load-time baseline (no lost word ids, element counts unchanged). This is the lossless-round-trip evidence shown live.
- **Harness-heavy (offline, `test/`):** TEI All RelaxNG and Schematron via Python/lxml, run on demand. See [testing](testing.md).

## Implementation Status

Built and verified: the three-layer editor engine, open/navigate/edit/save, the real OpenSeadragon facsimile with `@facs` zone linking, `<standOff>` index management (person/place/org/work/event) with in-text mention linking via `<name ref>`, editorial note creation in `standoff.js` (`addNote`/`addNoteForNode`, anchored to a stable `@target` xml:id), the AI entity-proposal path with a human verify gate (`resp="#ai"`), live authority lookup (GND/Wikidata/GeoNames), inline textual-critical markup (`<unclear>`/`<del>`/`<add>`/`<gap>`), browser-light validation, the LLM on-ramp, and the offline harness. Outside the browser editor, the deterministic SZD converter `pipeline/export_tei.py` (a rule, never an LLM) turns szd-htr Page-JSON v0.2 into teiCrafter-target TEI whose output the engine round-trips byte-identically; its frozen contract is [converter-reference](converter-reference.md). The byte-identical round-trip and surgical-edit behaviour are proven headlessly on real data (the annotation and textual-critical layers each carry a dedicated proof under `test/tools/`); the editor click-through (load demo, word edit, navigation, live validation, add/link/delete an index entity) was confirmed in-app on 2026-06-04, and the newer browser-only paths (facsimile image load, AI proposal with a provider key, live lookup, the Mark-text chooser) await an operator sight-check.

Not yet built (see [specification](specification.md) "Future"): a true IIIF tiles/manifest source (the viewer currently uses a plain-image tileSource), a full `<standOff>` critical-apparatus / note-body authoring layer (the inline markers above are built; the apparatus editor is the future part), project modules, a CodeMirror source view, and a streaming/segmented load for very large (tens of MB) editions. Live OpenSeadragon rendering over a real page image is verifiable only via the rights-encumbered local ZBZ example, so it remains the one path the committed demo cannot show.

## Related

- [specification](specification.md) for what the components must do
- [data](data.md) for the formats the editor consumes and the real test corpus
- [design](design.md) for the visual and interaction layer
- [testing](testing.md) for the proofs and the offline harness
