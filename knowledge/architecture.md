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
version: 0.11
topics: ["[[Software Architecture]]", "[[TEI XML]]"]
related: [specification, data, design, testing]
---

# teiCrafter Architecture

How teiCrafter is built. Client-only, no backend, native ES6 modules without a bundler or build step, deployed via GitHub Pages from `/docs`. All processing (parsing, editing, validation) runs in the browser; the optional LLM call goes directly to the provider over HTTPS. The visual layer is in [design](design.md); the offline evaluation harness is in [testing](testing.md).

## Two Entry Points, One Editor

```
index.html   (landing: hero + three example cards + feature strip)
  |
  +-- editor.html ............. open existing TEI, edit, save   (deterministic)
  +-- editor.html#example=KEY . loads that example directly     (landing cards)
  +-- editor.html#generate .... New from text (LLM) -> same editor  (LLM on-ramp,
                                hidden behind FEATURES.llmOnRamp since 2026-06-10)
```

Both entries land in the same editor. There is no multi-step stepper; the prior LLM Generator workflow (a five-step Import/Mapping/Transform/Validate/Export app) was removed in the 2026-05-30 consolidation (recoverable from git history).

## The Editor Engine: Three Layers

The engine is three pure-then-UI layers. The lower two are DOM-free, so the exact code the browser runs is the code the Node harness measures. File paths in the engine and services tables below are relative to `docs/`.

| Layer | File | Responsibility |
|-------|------|----------------|
| 1. Generic document core | `js/editor/tei-document.js` | A small XML tokenizer builds an offset-true tree: every element, attribute value and text node carries byte offsets into the raw string. Schema-free recognizers by local-name (`pb`, `lb`, `l`, `w`, `surface`, `zone`, `note`, `@facs`, `CRITICAL_LOCALS` for textual criticism) plus shared helpers (`splitEdge`, `nearestAncestor`, `isReadingContext`). Lossless edit ops (`editTextNode`, `editAttrValue`, `addAttr`, `removeAttr`, `spliceDocument`); `addAttr` inserts directly after the element name, guards the name as a QName and checks presence by exact qname (so `xml:id` and `id` stay distinct), and like every op returns the SAME document on a no-op. Escaping preserves existing character/entity references, so editing a node holding `&nbsp;`/`&#nn;`/`&quot;` never corrupts it. `serialize()` returns the raw string, so round-trip is byte-identical by construction. |
| 2. Edition model | `js/editor/edition.js` | Projects any parsed TEI into the shape the UI consumes: folios (split by `<pb>`), lines (by `<lb>`/`<l>`), and editable cells (reading-text nodes). The profile (`word` if `<w>` present, else `line`) is read from the document. `editWordText`/`editCell` apply a lossless splice and re-parse. Surfaces a `<gap/>` as its own read-only cell and tags every text cell with its immediate textual-critical wrapper (`crit`), whether the cell is that wrapper's sole content (`critSole`, the gate for a safe "clear"), and its linked entity id (`mention`, M2.5: the nearest `<name ref>` ancestor below the line/paragraph level; a pure read projection, no offset or serialization change). `rawRangeForDisplay` maps a display range (decoded text the renderer shows) back to raw offsets across entity references, the bridge from a mouse selection to a lossless sub-range splice (M2.8). `attrTargetForCell` resolves the element a cell's attribute editor targets (the text node's innermost wrapping element; the reading containers p/head/note/body and gap cells yield none). Preserves a back-compatible API used by the headless proofs. |
| 3. UI controller / shell | `js/editor/editor-app.js` | The integrator since the M2.13 module split: owns the shared `app` state and shell wiring (one "Load..." menu for the local file picker and the examples, the empty-state load prompt with drag-and-drop and recent files, and a discard guard before any in-app document replacement; page turning in the left pane head plus arrow keys), and the M2.14 dual-view shell: the left pane is the text work surface with view tabs (reading text or XML source), the right pane hosts a switchable context panel from an open registry (`PANELS`: facsimile and entity index built in; a project profile can contribute more via `project.panels`, each `{ id, label, title, available()?, render()?\|mount(hostEl)? }`; an unavailable panel's tab is disabled with a reason tooltip, and the active panel falls back to the first available one, e.g. Index when a document has no page images). Renders the reading text under the M2.10 editor paradigm (plain click = cursor, click on a mention opens the annotation editor, double-click edits, right-click context menu) with the M2.5 visibility layer (per-entity-type mention colours with tooltips, violet plus dashed outline for AI-proposed targets, triple-coded note marker, per-document legend strip), hosts the OpenSeadragon facsimile with zone linking, the live checks as a chip in the left pane head with a detail popover, inline cell editing (text input, note input, critical chooser), and save/download. The feature surfaces live in their own modules (`annotation-ui.js`, `entity-index.js`, `project-folder.js`, `validation-view.js`, `source-view.js`, `gen-modal.js`) and receive their dependencies via a ctx object whose shape `ctx.js` `requireCtx` checks at construction time. Every standOff mutation runs through ONE path: `commitStandoff(fn, { label, failPrefix, noopLabel }) -> bool`, the thin wrapper around the DOM-free `standoff.applyMutation` that adopts the new state, sets the dirty flag and the status line, and re-renders exactly once on a real change. It also owns the lazy TEI Guidelines loading (`ensureGuidelines`: same-origin fetch of the vendored compilation, shared in-flight promise, resolves to null on any failure; an idle prefetch fires when a loaded document's project declares a TEI scope, never at boot) and derives `app.markup` via `resolveMarkup` at load and again when the vocabulary arrives. |

### Supporting modules (around the engine)

| File | Responsibility |
|------|----------------|
| `js/editor/facsimile.js` | Real OpenSeadragon deep-zoom viewer (5.0.1 from CDN) over the page image, with `<zone>` rectangles overlaid and bidirectionally linked to the reading text. Plain-image tileSource with an IIIF-ready hook. Imports no engine or state modules; its only project import is the shared DOM helpers. |
| `js/editor/standoff.js` | DOM-free, lossless `<standOff>` model over `tei-document.js`: read/add/update/delete `person`/`place`/`org`/`work`/`event` entities, attach authority ids as `<idno type="GND\|GeoNames\|Wikidata">value</idno>` children (add/replace/remove via `setAuthority`), and link in-text mentions by wrapping them in `<name ref="#id">` -- whole node (`linkMention`, which retargets the enclosing `<name>` found by the same bounded walk the projection uses) or a sub-range of a node (`linkMentionRange`, M2.8, which refuses inside an existing `<name>`). Also creates editorial notes (`addNote`/`addNoteForNode`, anchored to a stable `@target` xml:id) and marks AI-proposed entities with `resp="#ai"` (`confirmEntity` drops the marker on human confirmation; reject is delete). Works are read scoped to `standOff`/`listBibl` so a `<bibl>` in the `teiHeader` is not misread as a work. Every mutation is an offset splice; a no-op returns the same doc, so the round-trip stays byte-identical. Inserted scaffolding adopts the document's own newline (CRLF/LF) and anchors after the `teiHeader`, else before `<text>`, else inside the document element, so a header-less TEI still gets a valid `<standOff>` instead of crashing. Also home of two cross-cutting readers the integrator uses: `noteIndex(doc)` (the editorial-note index as a tree walk over the parsed doc, quote-agnostic and markup-safe; it replaced the last regex XML parse) and `applyMutation(doc, fn)` (the DOM-free core of the commit path: SAME-doc no-op check, re-parse into a fresh edition state, fresh note index; the browser integrator and the Node proofs run this exact function). |
| `js/editor/criticism.js` | DOM-free, lossless inline textual-critical markup (M3.6): `markCritical` wraps a reading-text node's core in `<unclear>`/`<del>`/`<add>` (edge whitespace kept outside the tags) or replaces it with a self-closing `<gap/>` (omitted/illegible text, content-less per TEI); `unwrapCritical` reverses a wrap but refuses to strip a wrapper shared with sibling content; `removeGap` deletes a gap marker. The wrapped core is the raw, already-escaped slice spliced as-is (no decode/re-encode), and a no-op returns the same doc. |
| `js/editor/ai-suggest.js` | DOM-free helper for the AI entity-proposal path (M3.7): `buildSuggestPrompt` and a tolerant `parseSuggestions` (lenient JSON extraction, type normalization, dedup, never throws). The proposals are added as `resp="#ai"` entities for a human to confirm or reject. Since M2.11 the suggest UI is removed from the editor (operator decision 2026-06-10); the module is retained for a text-anchored re-entry. |
| `js/editor/index-panel.js` | Index-management UI (persons/places/orgs/works/events) with the shared authority form per entity, a live authority-lookup affordance, an AI-proposed (violet) row state with a confirm action, mention-count badges, and a two-step delete when an entity still has mentions (its refs would dangle). Since the M2.14 dual view it renders inside the right-pane Index panel; row click jumps to the entity's first in-text mention while the index stays visible, and day-to-day authority editing happens in the annotation popover in `editor-app.js` through the same `standoff.js` paths. |
| `js/editor/authority-form.js` | The single source for the authority-id UI (existing `<idno>` chips with remove, add form, live register lookup), used by BOTH the index overlay rows and the annotation editor at the mention. Pure DOM; mutations and lookups are reported through hooks (`onSet`, `onLookup`), the register list is imported from `standoff.js` AUTHORITIES. |
| `js/editor/source-view.js` | Editable XML source view: syntax-highlighted overlay (a `<pre>` with token spans under a transparent textarea in scroll lockstep), line-number gutter, explicit "Check XML" with caret jump to the reported error line/column, Apply gated on well-formedness. `highlightXml` is a tolerant pure tokenizer (an unterminated tag mid-edit colours as far as it goes); proof `node test/tools/source_highlight_check.mjs` (stripping the spans reproduces the input byte-for-byte, incl. the real SZD object). The syntax palette uses the deterministic token families only (violet stays AI-only). Above ~1.5 MB it falls back to an unhighlighted surface. |
| `js/editor/project-profiles.js` | Built-in project profiles (WB-AP2; precursor of the `teicrafter.project.json` manifest decided 2026-06-10): a profile is detected from the document's `publicationStmt` PID and contributes an image resolver. The Wenzelsbibel profile (`o:wen.*`) maps a surface's bare `<graphic url>` filename to the ÖNB IIIF Image API `info.json` URL, so OpenSeadragon deep-zooms real tiles instead of one enormous jpg. Pure module (no DOM); proof `node test/tools/wb_codex_check.mjs`. |
| `js/editor/dom.js` | Tiny shared DOM helpers (`el`, `clear`), one source instead of per-module copies. |
| `js/editor/annotation-ui.js` | Everything that opens at the text under the M2.10 paradigm: the right-click context menu, the evidence-first annotate popover on a selection (M2.8, incl. the provenance-grouped entity choice and the full-TEI markup wraps), the annotation editor on a clicked mention with in-place authority editing (M2.11), the word-profile entity picker, and the attribute editor popover on a cell's innermost wrapping element (existing attributes editable and removable, an add row whose name/value suggestions and plain-text descriptions come from the loaded TEI vocabulary as hints, never enforcement; fully functional as a free-text editor without it). Receives its dependencies via ctx (`commitStandoff`, `entityMetaMap`/`entityUsage`, `runLookup`, `revealEntity`, `ensureGuidelines`/`guidelinesNow`, the inline cell editors); wires its own global selection/contextmenu listeners. |
| `js/editor/entity-index.js` | The entity index controller (M2.11 overlay, a right-pane context panel since M2.14): index-panel hosting with the standOff mutation hooks (one-liners through `commitStandoff`), the M3.3 live authority lookup popover, mention-count merging, the filter, jump-to-first-mention (the panel stays open) and reveal-entry (switches the right pane to the index). |
| `js/editor/project-folder.js` | The project-folder flow (M2.9), extracted from the integrator: the right-pane Project panel (file list with type labels and the TEI vocabulary line), open/adopt a File System Access directory, "New project" (writes a minimal manifest), the plaintext-draft entry, and `finalizeSaveTarget` (a draft's first save creates the `.xml` in the folder). |
| `js/editor/validation-view.js` | The live validation surface (browser-light half of the hybrid): well-formedness via DOMParser, xml:id integrity and tag-count drift against the load-time baseline, rendered as the footer chip with a detail popover; results cached by doc identity so page turns in a large edition do not re-validate. |
| `js/editor/tei-guidelines.js` | DOM-free, fetch-free reader of the vendored TEI P5 Guidelines compilation (`docs/data/tei/p5subset_en.json`, see its NOTICE.md): `parseGuidelines`, `elementByName` (gloss/desc as plain text, attributes resolved RECURSIVELY through the attribute-class graph with first-wins dedup; one level would miss inherited attributes such as `@facs`), `elementsByModule`, `moduleList`, `elementsForScope` (union, unknown names skipped), `guidelinesVersion`. Deliberately exports no validator: it is an authoring aid that says what markup exists and what it means, never whether a document conforms. The compilation carries no version string of its own, so the pinned version is metadata of the vendored copy. |
| `js/editor/ctx.js` | `requireCtx(who, ctx, fnKeys, objKeys)`: the feature factories' construction-time contract check, so a missing ctx key fails at boot with the factory and key named instead of as an undefined call when the feature is first used. |
| `js/editor/gen-modal.js` | The LLM on-ramp modal ("New from text"): provider/model/type selectors, in-memory key handling via llm.js, the minimal annotate prompt, response XML extraction, and its own modal wiring. Wired only when `FEATURES.llmOnRamp` is on (off since 2026-06-10). |
| `js/editor/recent-files.js` | Persisted recent files for the editor's empty state: FileSystemFileHandle records in IndexedDB (`listRecents`/`rememberRecent`/`forgetRecent`, max 5, keyed by name so reopening refreshes instead of duplicating). Chromium-only by nature; `supported` is false elsewhere and the Recent section simply does not render. Reopening re-requests permission inside the click (a user gesture); a dead handle removes its own row. |

### Why an offset-splice core, not the DOM

`DOMParser` + `XMLSerializer` drift: they normalise whitespace, reorder attributes, rewrite entities and self-closing tags. For a tool whose promise is "save changes nothing you did not edit", that is disqualifying. The custom tokenizer keeps the raw string canonical and edits it by absolute offsets, so any markup the tree-builder does not even interpret is still preserved verbatim. This is verified on every real file (see [testing](testing.md)).

## Services

| File | Role |
|------|------|
| `js/services/llm.js` | Multi-provider LLM client (Gemini, OpenAI, Anthropic, DeepSeek, Qwen, Ollama). API keys live only in a module-scoped Map, never written to storage or any backend, volatile on tab close. `fetch` uses `credentials: 'omit'`. |
| `js/services/authority-lookup.js` | DOM-free live authority search (M3.3): builds the query URL and parses the response for GND (lobid.org), Wikidata (`wbsearchentities`), and GeoNames (search JSON, requires a username). Feeds a picked identifier into `standoff.js` `setAuthority`. |
| `js/services/storage.js` | LocalStorage for non-secret settings (provider, model choice). |
| `js/utils/constants.js` | Feature flags (`FEATURES.llmOnRamp`), provider ids, source-type labels, and default mapping rules for the LLM on-ramp. |

The LLM on-ramp builds a minimal annotate prompt in `editor-app.js`, calls `llm.js` `complete()`, extracts the XML from the response, and loads it into the editor flagged as generated (violet banner, unreviewed).

## File Structure

```
docs/
  index.html              Landing: entry card into the editor (LLM card hidden, flag off)
  editor.html             The editor: dual-view shell (left text surface, right context panels) + LLM modal; loads OpenSeadragon 5.0.1 from CDN
  css/
    style.css             Design tokens (--color-*, --space-*, --font-*, --radius-*) + base + shared site chrome (header bar, identity footer)
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
      index-panel.js      Index-management UI in the right-pane Index panel; authority forms; mention counts
      annotation-ui.js    Context menu, annotate popover, annotation editor at the mention (M2.13 split)
      entity-index.js     Entity index panel + live authority lookup (M2.13 split; right-pane panel since M2.14)
      gen-modal.js        LLM on-ramp modal ("New from text") (M2.13 split)
      authority-form.js   Shared authority-id form (idno chips + add + lookup), used by panel and annotation editor
      source-view.js      Editable XML source view: highlight overlay, line numbers, Check XML, gated Apply, find/replace + go-to-line
      project-profiles.js Built-in project profiles: PID detection + IIIF image resolver (WB); the fallback when no manifest is present
      project-manifest.js Declarative project manifest (teicrafter.project.json): entry-agnostic parse/validate, normalizes to the same runtime project shape; documentTypes + files bind the markup inventory to a file's edition type; teiModules/teiElements declare the TEI scope (teiScopeForFile), resolveMarkup derives the effective wrap list
      project-folder.js   Project-folder flow (M2.9): Project panel, open/adopt directory, New project, plaintext-draft entry, first-save plumbing
      validation-view.js  Live validation chip + detail popover (browser-light half of the hybrid), cached by doc identity
      tei-guidelines.js   DOM-free reader of the vendored P5 compilation: recursive attribute resolution, module/element scoping; an authoring aid, not a validator
      ctx.js              requireCtx: construction-time ctx contract check for the feature factories
      plaintext-import.js Deterministic plaintext intake: paragraphs on blank lines, <lb/> per line, text verbatim (XML-escaped); transport, not interpretation, so never AI-marked
      recent-files.js     Recent files: persisted File System Access handles in IndexedDB
      dom.js              Shared DOM helpers (el, clear)
    services/
      llm.js              Multi-provider LLM client (keys in memory only)
      authority-lookup.js Live GND/Wikidata/GeoNames search (URL build + response parse)
      storage.js          Settings persistence (LLM provider/model; editor text zoom; per-document pane layout)
    utils/
      constants.js        Providers, source labels, default mappings
  data/tei/
    p5subset_en.json      Vendored TEI P5 Guidelines compilation (byte-verbatim, version pinned; .gitattributes -text guards the line endings)
    NOTICE.md             Source, pinned version, SHA-256, dual license CC-BY 3.0 + BSD-2-Clause, update procedure
  data/editor/
    wenzelsbibel-synthetic-codex.xml   Served synthetic word-level demo edition (public fallback)
    zbz-hersch-synthetic.xml           Served synthetic line-level demo (public fallback for the ZBZ example; invented placeholder prose)
    wb-codex/                          Real Codex 2759 (gitignored, local-only; tried first) + committed teicrafter.project.json (the WB project manifest, no licensed content)
    zbz-100/              Real Jeanne Hersch example (TEI + page PNGs); gitignored, local-only (rights)
    zbz-1000/             ZBZ worked-example object (doc 1000 + graphic urls, M7.2); gitignored, local-only (rights); regenerate via test/tools/make_zbz1000_demo.mjs
pipeline/
  export_tei.py           SZD Page-JSON v0.2 -> teiCrafter-target TEI; deterministic (rule, never an LLM); contract frozen in knowledge/converter-reference.md
```

## State

The editor holds a single `app` state object: the current edition model, the current folio index, an optional File System file handle (for save-in-place), the document name, a dirty flag, a load-time baseline (word ids and tag counts, for the integrity check), a generated flag, the active project (manifest-parsed, else PID-detected, else null), the open project folder (directory handle, file list, parsed manifest; M2.9), the current document's type-resolved markup wrap list, a pending save target (a plaintext draft's `.xml` is created in the project folder on first save), the two view choices of the M2.14 dual view (`sourceMode` for the left pane, `panel` for the right), and a collapsed-context-pane flag. Edits return a new immutable model from `edition.js` and replace `app.state`; offsets stay correct because the model is re-parsed from the spliced raw string. The pane layout (split position, collapsed state, active context tab) persists per document, and the text zoom globally, through `storage.js` (localStorage); no second store.

Loading is async at the shell so a large document can show progress. `load()` runs the synchronous parse directly for normal files, but above a size threshold (`BIG_DOC_CHARS`, the Wenzelsbibel codex is tens of MB) it shows a loading overlay and yields two animation frames first, so the spinner actually paints before the parse blocks the thread; every load entry awaits it. An example that fetches rights-restricted data falls back to a committed synthetic twin: the example-registry entry carries an optional `fallback` (url, file, done), and on a 404 the loader switches to it (without the original's manifest or image base), so the public deployment serves the synthetic stand-in while the real object loads locally.

## Validation (hybrid)

- **Browser-light (live, in `validation-view.js`):** well-formedness via `DOMParser` (read-only check, not used for serialization), plus structural integrity against the load-time baseline (no lost word ids, element counts unchanged). This is the lossless-round-trip evidence shown live.
- **Harness-heavy (offline, `test/`):** TEI All RelaxNG and Schematron via Python/lxml, run on demand. See [testing](testing.md).

## Implementation Status

Built and verified: the three-layer editor engine, open/navigate/edit/save, the real OpenSeadragon facsimile with `@facs` zone linking, `<standOff>` index management (person/place/org/work/event) with in-text mention linking via `<name ref>`, editorial note creation in `standoff.js` (`addNote`/`addNoteForNode`, anchored to a stable `@target` xml:id), the AI entity-proposal path with a human verify gate (`resp="#ai"`), live authority lookup (GND/Wikidata/GeoNames), inline textual-critical markup (`<unclear>`/`<del>`/`<add>`/`<gap>`), the generic attribute editor on a cell's innermost wrapping element (engine `addAttr`/`editAttrValue`/`removeAttr` through `commitStandoff`; TEI-vocabulary hints when loaded, free text always), browser-light validation, the LLM on-ramp, and the offline harness. Outside the browser editor, the deterministic SZD converter `pipeline/export_tei.py` (a rule, never an LLM) turns szd-htr Page-JSON v0.2 into teiCrafter-target TEI whose output the engine round-trips byte-identically; its frozen contract is [converter-reference](converter-reference.md). The byte-identical round-trip and surgical-edit behaviour are proven headlessly on real data (the annotation and textual-critical layers each carry a dedicated proof under `test/tools/`); the editor click-through (load demo, word edit, navigation, live validation, add/link/delete an index entity) was confirmed in-app on 2026-06-04, and the newer browser-only paths (facsimile image load, AI proposal with a provider key, live lookup, the Mark-text chooser) await an operator sight-check.

The project layer (WB-AP3 + M2.9): a project is configured by a declarative manifest, `teicrafter.project.json` next to the TEI files, parsed and validated by `project-manifest.js` into the same runtime shape the built-in PID profiles produce (`app.project`). A project is not an edition type: the manifest's `documentTypes` carry per-type markup inventories and `files` assigns a type per file, so the wrap list in the annotate popover binds to the open document's type (`resolveMarkup`, resolved into `app.markup` at load and recomputed when the TEI vocabulary arrives); project-level `markup` is the default. A manifest may additionally declare its TEI scope (`teiModules`/`teiElements`, union, allow-lists only, same per-type precedence via `teiScopeForFile`): explicit `markup` entries always come first, additional wraps derive ONLY from `teiElements` (labelled "gloss (element)"), and `teiModules` scope the attribute editor's vocabulary and the Project panel line ("TEI P5 4.11.0: modules ... (n elements in scope)"), never the wrap menu. Without the vendored data everything degrades to the explicit lists. Other consumers built: the IIIF image resolver (a `<graphic url>` filename becomes an info.json tile source for OpenSeadragon); `indices` and `views` are parsed and held for the index and view work. Two entries deliver a manifest: the example registry fetches one next to an example's TEI, and "Open project folder" (M2.9) grants a File System Access directory handle whose `.xml`/`.txt` files appear in the right-pane Project panel ("New project" writes a minimal manifest first). A `.txt` opens as a deterministic line-level draft via `plaintext-import.js`; its first save creates the `.xml` in the folder. PID detection stays the fallback for bare files. The Wenzelsbibel manifest is the first profile, derived from the project's editorial guidelines.

The editor surface (settled 2026-06-10): the editor opens on its empty two-pane layout, with no separate welcome screen; the reading pane carries a lean load prompt and the recent files when any. The reading-text line labels (`@n`) render in an IDE-style gutter that keeps the edition's own numbering (an empty cell for an unnumbered line, no fabricated count). The XML source view adds find/replace and go-to-line (Ctrl/Cmd+F) and a translucent selection tint (`--color-selection`) so the coloured overlay text shows through a selection. Editor-wide text zoom is a global preference; the panes carry a draggable splitter (min 320px each, double-click reset, keyboard-resizable), a collapse toggle for the context pane (a header button or Ctrl/Cmd+\, after which the `@facs` sync simply has no visible target), and a vertical stack below 900px. Split position, collapsed state and the active context tab persist per document, the text zoom globally, both through `storage.js`. Markup application stays the reading view's selection flow (not duplicated as a raw-tag bar), and there is no reformat/pretty-print action (it would break byte fidelity).

Not yet built (see [specification](specification.md) "Future"): a generic IIIF source without a project (the viewer falls back to a plain-image tileSource; with a manifest/profile the IIIF path is built), a full `<standOff>` critical-apparatus / note-body authoring layer (the inline markers above are built; the apparatus editor is the future part), the manifest's index/view consumers, a CodeMirror source view, and a streaming/segmented load for very large (tens of MB) editions. Live OpenSeadragon rendering over a real page image is verifiable only via the rights-encumbered local ZBZ example, so it remains the one path the committed demo cannot show.

## Related

- [specification](specification.md) for what the components must do
- [data](data.md) for the formats the editor consumes and the real test corpus
- [design](design.md) for the visual and interaction layer
- [testing](testing.md) for the proofs and the offline harness
