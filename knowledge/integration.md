---
title: Three-Project Master Reference (teiCrafter, zbz-ocr-tei, szd-htr)
project:
  name: teiCrafter
  repository: https://github.com/DigitalHumanitiesCraft/teiCrafter
method:
  name: Promptotyping
  url: https://lisa.gerda-henkel-stiftung.de/digitale_geschichte_pollin
template:
  name: Vorlage Integration
  version: 0.1
status: active
created: 2026-06-07
updated: 2026-06-07
language: en
version: 0.4
topics: ["[[TEI XML]]", "[[Data Flow]]", "[[HTR Pipelines]]"]
related: [project, data, specification, user-stories, architecture, design, testing, goals]
---

# Three-Project Master Reference

Single, verified reference across the three projects. It holds
the complete picture: the editor internals, both HTR pipelines, the data formats and
metadata mappings, the TEI models, verification, the converter contract, and the open
work. Claims are tagged where verified against code; corrections are in section 11. The
live gate plan with status is [goals.md](goals.md).

## 1. Frame and Demo Gate

- **Purpose:** conference / paper demo.
- **Success criterion:** one real ZBZ object and one real SZD object taken end-to-end in
  the browser: open, correct line by line, annotate persons / places / works with
  authority IDs (GND / GeoNames / Wikidata), save byte-faithfully.
- **Demo-critical:** entity enrichment, notes, image display. Everything else runs in
  parallel and does not gate the demo.

## 2. The Three Projects and Roles

| Project | Path | Role |
|---------|------|------|
| **teiCrafter** | `GitHub/ResearchTools/teiCrafter` | Browser-based lossless TEI editor; convergence point |
| **zbz-ocr-tei** | `GitHub/DHCraft/zbz-ocr-tei` | Jeanne Hersch: PDF to line-level TEI |
| **szd-htr** | `GitHub/szd-htr` | Stefan Zweig: images to Page-JSON to METS/PAGE-XML |

Live status in [goals.md](goals.md) (goals H1 to H7).

## 3. teiCrafter: Editor Internals (verified)

Client-only, ES6 modules, no build step, deployed from `/docs` via GitHub Pages. Three-
layer engine plus services.

**Layer 1 - `docs/js/editor/tei-document.js` (offset-true core).**
- `tokenize(raw)` builds a contiguous token list; concatenating every `[start:end)` slice
  reproduces the input exactly. `parseDocument(raw)` is a stack-based tree where each
  element/attribute/text node carries byte offsets `start`/`end`.
- Reads generically by local-name (`localOf(name)` strips the namespace prefix). Schema-
  free recognizer sets: `MILESTONE_LOCALS = {lb, pb, cb, gb, milestone}`,
  `ENTITY_LOCALS = {persName, placeName, orgName, geogName, date, name, rs}`,
  `NON_READING_LOCALS = {teiHeader, facsimile, standOff, fsdecl, sourceDoc}`.
- Escaping never re-escapes existing entities (`&nbsp;`, `&#233;`, `&quot;`, `&apos;`
  pass through). Edits (`editTextNode`, `editAttrValue`) detect no-ops by comparing
  decoded forms and return the same doc on identity.

**Layer 2 - `docs/js/editor/edition.js` (editor model).**
- `parseEdition(raw)` projects the tree into `{ folios[], lines[], cells[], cellById,
  profile }`. Folios split on `<pb>`, lines on `<lb>`/`<l>`, cells are reading-text nodes.
- **Emergent granularity:** `profile = elementsByLocal(root, "w").length > 0 ? "word" :
  "line"`. Word-level for Wenzelsbibel, line-level for Hersch and (future) SZD. No branching.
- API: `editWordText`, `serialize`, `countTags`, `structuralSummary`, `xmlIdSet`,
  `escapeXmlText`, `unescapeXmlText`.

**Layer 3 - `docs/js/editor/editor-app.js` (UI controller).** Open (File System Access
API + file-input fallback), demo loads, folio navigation, inline cell editing, validation
panel, index panel, LLM modal. `app.imageBase` is set only by `loadZbz()`; all other
entries leave it null.

**Supporting modules.** `facsimile.js` (OpenSeadragon 5.0.1 from CDN, zone overlays,
bidirectional zone/line highlight). `standoff.js` (DOM-free lossless `<standOff>`:
`addEntity`, `updateEntity`, `deleteEntity`, `linkMention`; every mutation is an offset
splice; adopts the document's newline style). `index-panel.js` (entity index UI).
`services/llm.js` (multi-provider: Gemini, OpenAI, Anthropic, DeepSeek, Qwen, Ollama; API
keys in a module-scoped Map only, never persisted; `fetch` uses `credentials: 'omit'`;
keys validated max 256 chars printable ASCII). `services/storage.js` (localStorage for
non-secret settings). `utils/constants.js` (provider configs, source mappings).

**Reading contract (how it consumes any TEI).** `<pb>` (opt. `@facs`, `@n`) splits
folios; `<lb>`/`<l>` splits lines; reading-text nodes become cells (word-level only with
`<w xml:id>`); `<facsimile>`/`<surface>`/`<zone>` with `ulx/uly/lrx/lry` drive the viewer,
`@facs` links a line to its zone; `<standOff>`/`<note target>` carry entities/apparatus.
Uninterpreted markup is preserved verbatim. Raw string canonical, edits are offset
splices, `serialize()` is byte-identical.

**Facsimile image (the gap, verified).** The viewer renders only with BOTH an `imageUrl`
AND a `surface`. `imageUrl` comes only from `imageUrlForFolio()`, which is non-null only
for the hardcoded ZBZ demo path (`data/editor/zbz-100/pNNN.png`). The editor does NOT
read an image URL from the TEI: no `<graphic>` parsing in `edition.js`/`facsimile.js`.
Opened files therefore show text but a blank image. Fix is M2.2.

**Design system (`docs/css/style.css`).** Tokens are the single source of truth
(`--color-*`, `--space-*`, `--font-*`, `--radius-*`; no raw hex in components). AI marking:
`--color-ai: #6D4AB6` (violet), `--color-ai-tint: #F1ECFA`. Confidence is categorical:
`--color-confident` green, `--color-review` gold, `--color-problem` red. Three-pane layout:
reading text, facsimile, right pane (validation/structure tab and entity index tab).

**LLM on-ramp.** Modal captures text + provider/model/key; `complete(prompt)` calls the
provider; XML is extracted; `load(...)` then `markGenerated(true)` shows the violet
"Generated by an LLM / Unreviewed" banner. Opening a real file clears the flag. The
human verifies in the deterministic editor (expert-in-the-loop; epistemic asymmetry: the
model produces plausible TEI but cannot judge its own correctness).

**Validation and proofs.** Browser-light: well-formedness + structural integrity vs the
loaded baseline (xml:id set, tag counts). Offline harness: L1 text/word fidelity (gating),
L2 RelaxNG (tei_all) + Schematron (reported, non-gating), L3 element-count / namespace /
pointer integrity (gating). MVP gate = well-formed AND L1 AND L3. Engine proofs (Node,
re-runnable): `test/tools/roundtrip_sweep.mjs` (294/294 byte-identical: 285 Hersch, 4 SZD,
5 synthetic), `test/tools/hersch_loadability.mjs` (285/285 usable editor view), plus
generic/editor/edit-fidelity/selftest harnesses.

**Corpus.** Hersch line-level (reads directly), Wenzelsbibel synthetic word-level (reads
directly), SZD catalog + Page-JSON (needs the converter). The committed Wenzelsbibel is a
synthetic structural twin; the real ONB codex is absent (unresolved licence). Real third-
party proof files live only under gitignored `test/fixtures/`.

## 4. ZBZ Pipeline (zbz-ocr-tei), verified

**Source.** 286 PDFs from ZBZ (`data/source/pdf/{id}.pdf`); 40 Transkribus reference TEIs
(ground truth, 25 used for CER); Masterfile.xlsx catalog; editorial guidelines (DTA-
Basisformat + ZBZ deviations). Page images: `docs/images/{id}/{id}_p{NNN}.png`, 300 dpi,
1-indexed; 4 demo docs committed, the rest (~4 GB) local and gitignored.

**Workflow (6 stages).** (1) extract PNG + Gemini document classification
(`data/doc_metadata.json`). (2) OCR Mistral Document AI 2512 on Azure to per-page Markdown;
optional Gemini/Claude Haiku correction. (3) layout Docling 2.75 RT-DETR V2 (local GPU or
docling-serve) + optional Gemini QA, BBox JSON in percent. (4) parallel PAGE-XML + METS
export (coOCR-compatible, not TEI input). (5) unified TEI in 3 steps: rule-based scaffold,
Gemini refinement (cached), deterministic assembly + heuristic lb-injection (~60 chars at
word boundaries), then RelaxNG validation. (6) final assembly: `revisionDesc` + workflow-
status projection + blank-page markers to `output/tei_final/{id}_final.xml` (the single
source of truth), plus manifest, CER eval, and the `docs/data/` viewer mirror. Run:
`python -m scripts.tei.tei_unified --doc {id}` (`--reassemble` for the curation round-trip).

**TEI model (exact).** `teiHeader`: titleStmt (title, author Jeanne Hersch),
publicationStmt (publisher ZBZ/DHCraft, `idno type="docID"`), sourceDesc (biblStruct or
bibl), profileDesc/langUsage (ISO 639-3 fra/deu/eng/ita), revisionDesc (pipeline change +
three workflow-status summaries). `facsimile`: one `<surface xml:id="facs_N" ulx uly lrx
lry>` per page (absolute pixels), `<zone xml:id="facs_N_r_M" ulx uly lrx lry>` per region.
`body`: `<div n>` nesting (up to 3), `<pb facs="#facs_N" n>` per page (blank pages get
`<pb type="blank"/>`), `<lb facs="#facs_N_r_M" n="N00N">` per line, `<head>`,
`<p facs="#zone">`, `<hi rendition="#b|#i|#u|#g|#k|#sup|#sub">`, `<foreign xml:lang>`,
`<note place="foot|left|right">`, `<choice><sic>/<corr>`, `<unclear cert="high|low">`,
`<figure xml:id><graphic url>`, `<bibl>` in `<listBibl>`. No entity tags (removed, E71).

**Schema.** `data/schema/zbz_hersch.rng` (RelaxNG, TEI P5 4.10.2). Root `<TEI type="naegeli">`.
`<graphic>` requires `@url`. revisionDesc `@status` allowed (E68 fix gave 285/285 valid).
Entities removed (E71). MMSID projection removed (E76; header is ZBZ's domain).

**Streams and status.** Three streams ocr / layout / tei, each with status
`unverifiziert` (gray) -> `in_arbeit` (yellow) -> `verifiziert` (green); red reserved for
reject. Status + history per stream in `{id}_manifest.json`, projected into revisionDesc.

**Viewer.** `docs/index.html` (corpus table), `docs/viewer.html` (per-doc inspector with
OpenSeadragon facsimile, layout editor, transcription/TEI/XML text editor, manifest
editor). One Save button persists all unsaved streams; File System Access API (Chromium)
or download fallback; dual-write to canonical `output/` and viewer mirror `docs/data/`.

**Quality.** Fidelity-CER median 1.83%, mean 4.26% (n=25 GT, E70 methodology: case-
sensitive full-text Levenshtein, fidelity isolates real OCR/layout errors from scope
inserts). 285/285 schema-valid. 79 blank pages in 15 docs.

## 5. SZD Pipeline (szd-htr), verified

**Source.** ~2107 objects across 4 collections (18,719 images). Images from a local
backup (`SZD_BACKUP_ROOT`) and GAMS URLs (`https://gams.uni-graz.at/o:szd.NNNN/IMG.N`).

| Collection | Backup dir | Objects | TEI source | Note |
|---|---|---|---|---|
| lebensdokumente | lebensdokumente | 127 | 143 biblFull | TEI has extra non-digitized |
| werke | facsimiles | 169 | 352 biblFull | werkverzeichnis > scans |
| aufsatzablage | aufsatz | 621-625 | 624 biblFull | ~1:1 |
| korrespondenzen | korrespondenzen | 1186 | 723 correspDesc | backup has later digitizations |

**9 prompt groups (A-I):** A Handschrift, B Typoskript, C Formular, D Kurztext,
E Tabellarisch, F Korrekturfahne, G Konvolut, H Zeitungsausschnitt, I Korrespondenz.
Languages: German 95.6%, English 2.6%, French 1.5%, rest <1%.

**Catalog TEI** (`data/szd_*_tei.xml`): `biblFull` metadata only, no text layer (0 `<pb>`,
0 `<lb>`). Elements: msIdentifier (PID, signature, repository@ref GND, country,
settlement), titleStmt (author/editor persName @ref GND), origDate, origPlace, material
(WritingInstrument/WritingMaterial), measure (leaf/format), handDesc, bindingDesc,
docEdition, history/provenance + acquisition, keywords/term, correspDesc.

**Workflow.** (1) `transcribe.py`: Gemini 3.1 Flash Lite VLM, temperature 0.1, 4-layer
prompt (system + group A-I + auto object-context from TEI + optional per-object override);
all images in one batch, auto-chunk above 20 images, backoff on 429, JSON sanitization;
output `{id}_{model}.json` with pages[] (transcription, notes, type), confidence, metadata.
(2) `quality_signals.py` v1.5: 7 signals + page.type (content/blank/color_chart);
needs_review ~27%. (3) `layout_analysis.py`: ensemble Docling (blocks) + Surya (lines) +
Gemini 3 Flash (merge+verify), output `{id}_layout.json` with regions (bbox in percent).
(4) exports: `export_page_json.py` (Page-JSON v0.2), `export_pagexml.py` (PAGE XML 2019,
deterministic), `export_mets.py` (METS/MODS, ~2074 objects).

**On-disk inventory (results/, verified):** `_page.json` 2103 (127/169/621/1186),
`_mets.xml` 2103, `_<model>.json` 2103, but only **25** `_layout.json` total. Most objects
are Page-JSON state 1 (text only, no regions); layout is a stratified pilot (~1%).

**Page-JSON v0.2** (`schemas/page-json-v0.2.json`, spec
`knowledge/htr-interchange-format.md`). Required: `page_json`, `source` (id, title,
language; opt date, document_type enum, collection, repository, shelfmark, images[],
descriptive_metadata, additional), `provenance` (model, created_at; opt provider,
pipeline, prompt_layers, parameters, layout_model), `pages[]` (page, type, text; opt
notes, image, image_width, image_height, regions[]). `regions[]`: id (`^r\d+$`), type
(paragraph/heading/list/table/marginalia), bbox [x%,y%,w%,h%], reading_order; opt text,
lines, label. Optional top-level: confidence, quality, evaluation. document_type enum:
manuscript, typescript, letter, postcard, notebook, diary, form, certificate,
newspaper_clipping, proof_sheet, register, calendar, ledger, mixed_materials.

**Metadata mapping** (`tei_context.py` `parse_tei_full_metadata`): TEI to
descriptive_metadata covers title, signature, date, language, objecttyp, extent, creators
(name+role+GND), holding (repository+GND+country+settlement), provenance, origin_place,
writing_instrument/material, hands, dimensions, binding, inscriptions, subject. Gap:
correspondence (sender/recipient/direction from correspDesc) is defined but NOT populated.

**Verification tiers (4 + unreviewed).** 0 `gt_verified` (char-exact, 3-model consensus +
expert), 1 `approved` (expert in viewer), 2 `agent_verified` (Claude Vision sub-agent),
3 `needs_review=true` (quality signal), and unreviewed (default). GT: 18-object 3-model
consensus draft (Flash Lite + Flash + Pro, Claude judge), 30-object full GT planned. CER
known only for ~58 pilot objects; full calibration pending GT.

**No transcription TEI exists.** No pipeline step emits `<pb>`/`<lb>` TEI. Producing it is
M1.3. PAGE-XML and METS are archival, not editor input.

## 6. Data Flow

```
ZBZ:  PDF -> Mistral OCR -> Docling layout -> Unified TEI -> {id}_final.xml ──┐
                                                                               ├─> teiCrafter (Open)
SZD:  images -> Gemini VLM -> [layout] -> Page-JSON v0.2 -> export_tei ───────┘
                                          \-> PAGE-XML / METS (archival, not editor)
```

ZBZ to editor works today for text (the bundled `zbz-hersch-100.xml` is doc 100's
`_final.xml` plus a `<standOff>` demo block and inline `<name ref>` links). SZD needs the
converter. There is no automated pipeline-to-teiCrafter link; the bundled ZBZ demo was
prepared by hand.

## 7. teiCrafter Target Contract for Converters

Both pipelines must hit the section 3 reading contract. Concretely:
- `<pb facs="#facs_N" n>` per page; `<lb>` (or `<l>`) per line; line-level for both ZBZ
  and SZD (no `<w>` tokens).
- `<facsimile>`/`<surface ulx uly lrx lry>`/`<zone>` for overlays; `@facs` line-to-zone.
- For images to show, put a `<graphic url>` in each `<surface>` AND have the editor read
  it (M2.2). The ZBZ schema already permits `<graphic url>`; the SZD converter should emit
  it from `source.images[]` / GAMS URLs from the start.

## 8. SZD Converter Contract (M1.3)

Build `szd-htr/pipeline/export_tei.py`: Page-JSON v0.2 to teiCrafter-native TEI, following
the existing `export_*.py` conventions (argparse `<obj> -c <collection>` / `--all` /
`--force`; `config.py` COLLECTIONS/RESULTS_BASE/MODEL; skip-if-exists; output to
`results/<collection>/`). Depends on the converter reference M1.2 for exact element
choices (in progress; prototype byte-verified for o_szd.100).

| Page-JSON | TEI |
|---|---|
| source.title / language / shelfmark | teiHeader (titleStmt, langUsage, msIdentifier/idno) |
| descriptive_metadata.* | msDesc physical description, creators with GND |
| provenance.model / created_at | revisionDesc/change (machine-generated, unverified) |
| pages[].page + source.images[i] | `<pb facs="#facs_N" n>` + `<surface><graphic url=IMG>` |
| pages[].text line (newline-split) | `<lb n>` + text run, one per line |
| pages[].type blank/color_chart | empty page body |
| pages[].regions[].bbox (%) | `<zone ulx uly lrx lry>` (px via image_width/height), `@facs` |

Most objects lack regions, so the converter must work fully without zones; add `<zone>`
only where present. Emit `<graphic url>` now so images are ready once M2.2 lands. Preserve
provenance and the unverified status.

## 9. Gate Status Summary (live version in goals.md)

- **H1 pipelines into teiCrafter:** M1.1 ZBZ loads (done). M1.2 SZD converter reference
  (in progress). M1.3 export_tei.py (open). M1.4 SZD demo example (open).
  M1.5 convert all (open).
- **H2 see/navigate/correct:** M2.1 editor model (done). M2.2 `<graphic>` image support
  (open). M2.3 live ZBZ browser pass (open). M2.4 ZBZ image-URL scheme (open).
- **H3 annotation:** M3.1 place entity, M3.3 authority @ref (GND/GeoNames/Wikidata), M3.4
  mention linking (all open, demo-critical); M3.2 work entity, M3.5 note UI, M3.6
  editorial markup (open, full ambition).
- **H4 losslessness:** M4.1 roundtrip sweep, M4.2 loadability sweep (done). M4.3 per-feature
  regression (ongoing). M4.4 SZD-TEI byte-clean (open).
- **Critical path to demo:** M1.2 -> M1.3 -> M1.4. M1.2 top priority.

## 10. Open Items and Dependencies

1. **M1.2 converter reference** in progress -> unblocks M1.3. Prototype byte-
   verified for o_szd.100.
2. **M2.2 `<graphic>` support** -> images for opened ZBZ and SZD files. Schema-compatible.
3. **M2.3/M2.4** ZBZ live gap pass + image-URL scheme -> feed M2.2.
4. **M3.1/M3.3/M3.4** entity types + authority @ref + linking -> demo annotation.
5. **Correspondence metadata** (sender/recipient) not yet populated in Page-JSON (input gap).
6. **SZD layout batch** ~1% done; most objects have no zones yet.

## 11. Corrections (verified)

- **`<graphic>` in ZBZ TEI:** the claim "no `<graphic url>` anywhere" was imprecise. Precise:
  no `<graphic>` inside `<facsimile>`/`<surface>`; but 26 docs carry `<graphic url>` inside
  `<figure>` blocks in the body (~101 total). The `zbz_hersch.rng` schema permits
  `<graphic url>`, so the M2.2 fix (graphic in surface) is schema-compatible.
- **`@facs` cross-linking:** in pipeline `_final.xml`, body `<p>`/`<hi>` do not carry
  `@facs` to zones; only `<pb>` and `<lb>` do. The teiCrafter bundled demo additionally
  adds inline `<name ref="#id">` links that the raw pipeline output does not have.
- **Gate plan on disk:** the gate plan exists as [goals.md](goals.md). M1.2 converter
  reference is in progress, not absent.
- **Status values:** SZD uses a 4-tier verification model (gt_verified, approved,
  agent_verified, needs_review) plus unreviewed, not 3.

## 12. Source Evidence

- teiCrafter: knowledge/{project,data,specification,user-stories,architecture,design,
  testing,journal,goals}.md; docs/js/editor/{tei-document,edition,editor-app,facsimile,
  standoff,index-panel}.js; docs/js/services/{llm,storage}.js; docs/css/style.css;
  test/tools/{roundtrip_sweep,hersch_loadability}.mjs.
- zbz-ocr-tei: knowledge/{project,pipeline,workflow,quality,viewer,methodik,decisions,
  journal}.md; scripts/{ocr,layout,tei,edition}/; data/schema/zbz_hersch.rng;
  docs/data/pages/<id>/<id>_final.xml; docs/images/<id>/.
- szd-htr: knowledge/{data-overview,verification-concept,htr-interchange-format,
  page-xml-mets-architecture,layout-analysis,teicrafter-integration}.md;
  schemas/page-json-v0.2.json; pipeline/{config,transcribe,tei_context,export_page_json,
  export_pagexml,export_mets,quality_signals}.py; results/<collection>/*.
