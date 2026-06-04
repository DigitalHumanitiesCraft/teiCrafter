# teiCrafter Handoff and Working State

Action-layer summary so work can resume without re-deriving anything. Snapshot: 2026-06-04 (post in-browser click-through). Conceptual detail lives in `knowledge/` (version 0.4).

## What teiCrafter is

A browser-based, lossless editor for arbitrary TEI-XML. Open an existing edition, correct it folio by folio at its natural granularity, save it back byte-faithfully. An optional LLM on-ramp drafts an initial TEI from plaintext into the same editor. Client-only, no backend, no build step, deployed from `/docs`.

The core is a generic, offset-true reader: the raw TEI string is canonical, edits are offset splices, `serialize()` is byte-identical by construction. Granularity emerges from the document (word-level if `<w>` present, else line-level). No per-project profile.

The facsimile pane is a real OpenSeadragon deep-zoom viewer over the page image with `<zone>` overlays linked to the reading text; a `<standOff>` index of persons, organisations and events is editable in-browser and links to in-text mentions via `@ref`. Both stay inside the lossless offset-splice model.

## Live code (the whole graph)

```
docs/index.html              Landing: two cards (editor, LLM on-ramp)
docs/editor.html             Editor: three-pane shell (reading | OpenSeadragon facsimile | tabbed validation/index) + LLM modal; loads OpenSeadragon 5.0.1 from CDN
docs/css/style.css           Design tokens (--color-*/--space-*/--font-*/--radius-*) + base
docs/css/editor.css          Editor styles (token-only)
docs/js/editor/
  tei-document.js            Layer 1: generic offset-true core (DOM-free)
  edition.js                 Layer 2: folios/lines/cells model (DOM-free)
  editor-app.js              Layer 3: UI controller + LLM on-ramp
  facsimile.js               OpenSeadragon viewer: real page image + zone overlays, IIIF-ready tileSource hook
  standoff.js                Lossless <standOff> model: list{Person,Org,Event}, add/edit/delete, link mentions via @ref (offset splices)
  index-panel.js             Index-management UI (persons/orgs/events), entity<->mention<->zone highlighting
docs/js/services/
  llm.js                     Multi-provider LLM client (keys in memory only)
  storage.js                 Settings (LocalStorage)
docs/js/utils/constants.js   Providers, source labels, default mappings
docs/data/editor/wenzelsbibel-synthetic-codex.xml   Served synthetic demo edition
docs/data/editor/zbz-100/    Real Jeanne Hersch example (TEI + 7 page PNGs) -- GITIGNORED, local-only (rights); reached via the "Load ZBZ example" button
```

That is all of `docs/js` (9 files). Import closure: editor-app -> edition, facsimile, standoff, index-panel, llm, constants; edition -> tei-document; standoff -> tei-document; facsimile and index-panel are project-dependency-free (facsimile uses the global OpenSeadragon); llm -> constants, storage.

## Removed in this consolidation (in git history)

The legacy five-step LLM Generator and its tree: `app.js`, `model.js`, `editor.js`, `tokenizer.js`, `preview.js`, `source.js`, `services/{transform,schema,validator,export}.js`, `utils/dom.js`, `pipeline/*` (6), `docs/tests/*`, the generator demo data under `docs/data/demo/`, and `docs/schemas/dtabf.json`. ~3000 lines. `transform.js` was deleted as legacy, not as faulty (it was not broken; it assembled its prompt inline).

## Proven (headless, by exit code)

| Proof | Asserts | Result |
|-------|---------|--------|
| `test/tools/roundtrip_sweep.mjs` | every real TEI serializes back byte-identically | 294/294 (285 Hersch, 4 SZD, 5 synthetic) |
| `test/tools/generic_roundtrip.mjs` | one engine reads Hersch/WB/SZD; surgical cell edit; model shape | all pass |
| `test/tools/editor_roundtrip.mjs` | editor core identity + surgical word edit, harness localizes it | 13/13 |
| `test/harness/selftest.mjs` | negative gate (identity passes, corruption fails) | 14/14 |
| `test/harness/run.mjs` | synthetic fixtures, MVP gate | all PASS, score 100 |

Run them: `node test/tools/roundtrip_sweep.mjs` etc. The sweep reads source repos directly (override with `HERSCH_DIR`/`SZD_DIR`); nothing third-party is committed.

## How to run the frontend

```
python -m http.server 8000 --directory docs
#   Landing:  http://localhost:8000/
#   Editor:   http://localhost:8000/editor.html
#   LLM on-ramp deep link:  http://localhost:8000/editor.html#generate
```

## The one open verification

Browser click-through of the editor (the harness cannot do this). Done on 2026-06-04 against the synthetic Wenzelsbibel, confirmed against the serialized output: word-level editing (surgical splice), folio navigation, live validation, and the index lifecycle (add person -> link a mention as `<w><name ref="#id">...</name></w>` -> delete cleanly). Two defects found and fixed (see journal 2026-06-04): the always-on AI banner (CSS `[hidden]` override) and LF-into-CRLF standOff inserts.

Still unverified in-app:
1. Live OpenSeadragon rendering over a real page image. Reachable only via "Load ZBZ example" (the rights-encumbered, local-only Hersch edition): real OSD image, zone overlays aligned to text, select a person to highlight its mentions + zone.
2. "Open local TEI" file-picker flow and "Save" in place (File System Access API).
3. "New from text (LLM)" with a key -> draft opens violet/unreviewed (the banner now shows correctly only on this path).

## Real cases and their shape

| Case | Pipeline | Shape | Granularity | Editable now? |
|------|----------|-------|-------------|---------------|
| Jeanne Hersch | zbz-ocr-tei (285 files) | `<p>` + `<lb facs>`, real zones, no `<w>` | line | yes, directly |
| Wenzelsbibel | synthetic twin | `<w xml:id>`, `<facsimile>`/`<zone>`, `<standOff>` | word | yes, directly |
| Stefan Zweig | szd-htr | catalog TEI + Page-JSON (no transcription TEI) | (line) | needs Page-JSON to TEI first |

## Next steps (ordered)

1. Browser click-through above (user), including the new "Load ZBZ example" flow (real OSD page image, zone overlays aligned to text, Index tab persons/orgs/events, select a person to highlight its mentions + zone, link a line to an entity, save).
2. Built since this snapshot: real facsimile images via OpenSeadragon (plain-image tileSource, IIIF-ready hook), `<standOff>` index management (persons/orgs/events) with mention linking, the "Load ZBZ example" button. Verified at node/static level (roundtrip 294/294, standoff well-formedness + no-op identity over 19 adversarial checks, static integration: ids/imports/overlay math); live browser rendering of OSD still pending.
3. Page-JSON to minimal-TEI converter so SZD becomes editable.
4. Optional: a synthetic Hersch-style line-level demo button so the facsimile feature has a committable (non-rights-encumbered) demo; Hersch/SZD as committed-synthetic harness fixtures.
5. Still future (specified, not built): a true IIIF tiles/manifest source, a StandOff critical-apparatus editor, project modules, CodeMirror source view with schema-aware autocomplete, segmented load for ~78 MB editions, an in-browser "full validate" button that calls the harness.

## Constraints (do not drift)

- No emojis; no em/en dashes as punctuation; all code, UI and docs in English.
- Real third-party TEI (Hersch, SZD, ONB codex) never committed; synthetic twins only; gitignored `test/fixtures/` and `docs/data/editor/zbz-100/` (the real Hersch demo is local-only).
- API keys in memory only, never persisted.
- Editing stays deterministic and lossless; LLM output is always marked violet and unreviewed.
- `knowledge/design.md` is binding before UI changes; tokens only, no raw hex.

## Key file map

```
CLAUDE.md         agent config; binds design.md
HANDOFF.md        this file
knowledge/        Promptotyping docs v0.4 (INDEX, project, data, specification,
                  user-stories, architecture, design, testing, journal)
docs/             the app (see Live code above)
test/             harness + engine proofs; fixtures-synthetic/ committed,
                  fixtures/ and schemas/tei_all.rng gitignored
.claude/workflows/ wb-roundtrip-eval.js (feedback loop)
```
