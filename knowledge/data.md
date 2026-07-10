---
title: teiCrafter Data and Test Material
project:
  name: teiCrafter
  repository: https://github.com/DigitalHumanitiesCraft/teiCrafter
method:
  name: Promptotyping
  url: https://lisa.gerda-henkel-stiftung.de/digitale_geschichte_pollin
template:
  name: Vorlage Datengrundlage
  version: 0.1
  url: https://dhcraft.org/Promptotyping/promptotyping-document/data
status: active
created: 2026-05-27
updated: 2026-07-10
language: en
version: 0.17
topics: ["[[TEI XML]]", "[[Data Modelling]]"]
knowledge-sources:
  standards:
    - label: TEI P5 Guidelines
      uri: https://tei-c.org/guidelines/p5/
    - label: TEI All RelaxNG
      uri: https://tei-c.org/release/xml/tei/custom/schema/relaxng/tei_all.rng
    - label: IIIF Presentation API
      uri: https://iiif.io/api/presentation/3.0/
    - label: METS
      uri: https://www.loc.gov/standards/mets/
related: [project, specification, architecture, testing]
---

# teiCrafter Data and Test Material

What teiCrafter consumes and produces, and which TEI proves the engine. teiCrafter is format-driven, not corpus-bound: it edits arbitrary TEI.

## What the Tool Consumes and Produces

| Input | Entry | Notes |
|-------|-------|-------|
| Existing TEI edition | Editor | Any TEI; opened from local disk, edited losslessly, saved back |
| Plaintext (`.txt`/`.md`) | Editor (picker, drop) or project folder | Opens as minimal line-level TEI by the fixed conventions below: transport, not interpretation, so the same input always yields the same output and the draft is never AI-marked. In a project folder the first save creates the `.xml` next to its source; opened directly, the draft has no save target and downloads its `.xml` |
| Plaintext | LLM on-ramp | "New from text (LLM)": a model drafts an initial TEI that opens in the editor, marked machine-generated (violet) and unreviewed. Behind `FEATURES.llmOnRamp` |

### Plaintext conventions (deterministic ingest rules)

| Convention | Resolves to |
|------------|-------------|
| Blank line | paragraph boundary (`<p>`) |
| Line break between lines of a paragraph | `<lb/>` marking the break BETWEEN lines; the first line of a paragraph stays bare (the `<p>` already opens it) |
| `\|N\|` (N = digits), standalone or mid-line | `<pb n="N"/>`; a page break implies a line break, one conventional bordering space dropped |
| Anything else | carried verbatim (XML-escaped) |

A `<lb/>` marks the break between lines inside a paragraph and the first line of a paragraph stays bare. The editor also reads drafts where every line carries a leading `<lb/>` (including the first), so both line shapes load.

The boundary rule ([specification](specification.md)): a convention resolves at ingest only where it encodes structure the text itself carries. Semantics (entities, dates, normalizations) is never pseudo-syntax in the source file; it belongs in the editor, where verification, lookup and validation live. New conventions are added only when real material carries them.

Output is the same TEI, edited byte-losslessly (only edited text runs change), saved in place via the File System Access API or downloaded. The LLM on-ramp output is a fresh TEI draft, marked as machine-generated and unreviewed until the human verifies it.

The editor additionally ships one reference dataset: a vendored, version-pinned copy of the TEI P5 Guidelines compilation (`docs/data/tei/p5subset_en.json`; source, SHA-256, dual license and update procedure in the NOTICE.md next to it). It backs markup and attribute suggestions and is data the tool consults, never content it writes into an edition.

A project may additionally carry an **LLM mapping document**: a Markdown file (named by the manifest's `llm.mapping`, sitting next to the manifest, type-aware so a project's several document types can each declare their own) whose prose maps the project's text phenomena to TEI. It is ingested next to the manifest, fed to the model as the project's guidance, and is project configuration the tool reads, never edition content; absent, the on-ramp falls back to the built-in per-source-type mapping. The system prompt that accompanies it lives inline in the manifest's `llm` block. This is distinct from the plaintext ingest above (a deterministic, model-free transport).

## How the Engine Reads TEI

The editor requires no particular TEI profile: it recognises the structural markup (`<pb>`, `<lb>`/`<l>`, `<w xml:id>`, `<facsimile>`/`<surface>`/`<zone>`, `<standOff>`, `<note target>`) generically by local-name and preserves everything it does not interpret verbatim on save. The single home of how the engine reads TEI is the Engine Reading Contract in [architecture](architecture.md); this document carries only the format-level facts of what the tool consumes and produces.

## Facsimile Images

The facsimile pane is a real OpenSeadragon 5.0.1 deep-zoom viewer (loaded from CDN), showing the folio's page image with the edition's real `<zone>` rectangles as overlays bidirectionally linked to the reading text by `@facs`. Image sources can be imported from a IIIF manifest or a METS file's image references; see [specification](specification.md). If OpenSeadragon is unavailable the viewer degrades to an empty state rather than failing.

The text+image on-ramp ("New from text and images") attaches page scans by page order, weaving a `<facsimile>` whose surfaces carry a `<graphic url>` to a relative filename and binding each `<pb>` to its surface by `@facs`. On a project-folder save the uploaded images are written as files next to the TEI under those relative filenames; no image binary is ever embedded in the XML. Reopening the folder resolves the filenames back to the displayed images.

## Real Test Corpus

Three real pipelines drive the tool and prove the engine. The harness round-trips all of them byte-identically (see [testing](testing.md)).

| Source | Files | Shape | Editor granularity | Status |
|--------|-------|-------|--------------------|--------|
| Jeanne Hersch (zbz-ocr-tei) | 285 `*_final.xml`, ~53 KB avg (up to ~915 KB) | `<p>` + `<lb facs="#zone" n>`, full `<facsimile>` with pixel coords, `<hi>`, `<figure>`; no `<w>` | line | reads and edits directly |
| Stefan Zweig (szd-htr) | 4 catalog TEI (~6 MB) + ~2000 Page-JSON | catalog `<biblFull>`/`<msDesc>` (no text layer); transcription lives in Page-JSON | (line, after conversion) | converted by `pipeline/export_tei.py`, then reads and edits directly |
| Wenzelsbibel (Codex 2759) | real codex (~78 MB, local-only) + synthetic twin (20-folio) + tiers | word-level `<w xml:id>`, `<facsimile>`/`<zone>`, `<standOff>` | word | reads and edits directly; the editor example loads the real codex where present, the twin otherwise |

Key finding from profiling the pipelines: SZD ships no transcription TEI of its own (only catalog metadata plus Page-JSON), so it goes through a Page-JSON to minimal-TEI step first. That step is the deterministic converter `pipeline/export_tei.py` (a rule, never an LLM, since the transcription already sits in `pages[].text`); its frozen contract is [converter-reference.md](converter-reference.md). After conversion the result is line-level TEI the editor reads and edits directly. The Hersch pipeline `*_final.xml` is clean, facsimile-linked, line-level TEI the editor handles directly. The bundled example-card fixture `docs/data/editor/zbz-100/zbz-hersch-100.xml` is by contrast a hand-prepared demo object, not a representative pipeline file: it carries a seeded illustrative `<standOff>` (placeholder entities for the entity index, two of them with no textual mention) plus facsimile-pointer and `pb/@n` inconsistencies (four `@facs` pointers to undeclared zones, and page numbers mixing the printed folio with the scan ordinal), so it is a UI demo seed, not a clean reference; the committed public twin `zbz-hersch-synthetic.xml` is clean. The Wenzelsbibel is the word-level reference.

## Account Ledger Demo (DEPCHA Wheaton)

A fourth real shape, not a pipeline: the Laban Morey Wheaton Day Book from DEPCHA (Digital Edition Publishing Cooperative for Historical Accounts), an account ledger encoded with the DEPCHA bookkeeping ontology. Each entry is a `<row ana="bk:entry">` of `<cell>`s carrying `<measure ana="bk:money">` amounts, `<name ana="bk:to|bk:from" type="person">` parties and `<date ana="bk:when">`; there is no `<w>`, so the editor reads it line-level (volumes 1 and 2 split into 23 and 26 folios by `<pb>`, serialize byte-identically). It lives as a `docs/data/editor/depcha-wheaton/` project folder (manifest plus `wheaton.1.xml`, `wheaton.2.xml`) opened through "Open project folder", deliberately NOT wired into the example registry. Its purpose is to exercise the project layer: a manifest binding an `account` document type and the bookkeeping markup inventory (the `bk:` descriptors above) to a markup vocabulary unlike the letters and the codex.

## Sample Letter (HSA 7711)

The plaintext-to-TEI walkthrough material: Benndorf to Hugo Schuchardt, Vienna 1879-02-14 (Hugo Schuchardt Archiv, letter 7711, ed. Szemethy 2022). `docs/data/editor/hsa-7711/` is a committed project folder holding the letter text as plaintext (with the `|2|` page marker; the web presentation's footnote numerals removed), a manifest binding a `letter` document type (persName, placeName, date with `attrField` `@when`, ref with `attrField` `@target`, editorial foot note, salute, signed), and a README with the full citation. The letter text (author died 1907) is in the public domain and committed; the edition's editorial apparatus is the edition's content and stays local-only (`target-reference.xml`, gitignored), serving as the annotation target of the walkthrough.

## Wenzelsbibel Material Profile

The reference manuscript case. The real codex `codex-2759.xml` (~78 MB) carries (structural facts of the source, not processing state): `standOff` with ~1,009 apparatus entries; `facsimile` with ~480 surfaces and ~34,363 zones; `text` with ~158,524 `<w>`, ~31,673 `<lb>`, ~6,505 `<l>`; word-level full text where each `<w xml:id>` encodes a dual reading (the text content and `@orig` carry the diplomatic reading, `@norm` the normalized one). A companion `Bildannotationen.xml` carries miniatures with artist attributions and ICONCLASS, linked by `corresp="#range(...)"`. `Bilderfassung.sch` is the project Schematron.

## Licence Boundary

The real Wenzelsbibel codex is third-party material (Austrian National Library) with an unresolved redistribution licence. All committed Wenzelsbibel material is a **synthetic structural twin** under `test/fixtures-synthetic/` and `docs/data/editor/` (no ONB data). Locally the real codex is materialized under the gitignored `docs/data/editor/wb-codex/` (copied from `GitHub/Wenzelsbibel/data/codex-2759.xml`); the editor's Wenzelsbibel example tries it first and falls back to the twin, so the public deployment never serves ONB data. The ZBZ Hersch example follows the same pattern: the rights-restricted line-level original stays local-only and gitignored, and a committed synthetic structural twin (`docs/data/editor/zbz-hersch-synthetic.xml`, invented placeholder prose in the real line-level form, byte-identical round-trip) is the public fallback, so the ZBZ example card loads on the deployment too. Real third-party files used for proofs (Hersch, SZD catalog, any ONB slice) live only under gitignored paths and never enter version control.

The one deliberate exception is `test/fixtures/real/o_szd.1079.tei.xml`, the SZD worked-example object: it is licensed **CC-BY** (its own `publicationStmt` carries the rights and attribution), so it is committed on purpose to make the M7.2 worked example and its proof (`test/proofs/szd_worked_example.mjs`) fully reproducible. The rights-encumbered fixtures in the same folder (the Hersch files, the SZD catalog TEI `szd_werke_tei.xml`) stay gitignored. The ZBZ worked-example object (`docs/data/editor/zbz-1000/zbz-hersch-1000.xml`, doc 1000 plus per-surface `<graphic url>`) follows the Hersch rights stance: local-only and gitignored, materialized deterministically via `node test/generators/make_zbz1000_demo.mjs` from the zbz sibling checkout, so its proof (`test/proofs/zbz_worked_example.mjs`) stays reproducible without redistributing the content.

The DEPCHA Wheaton day book is third-party data with no redistribution licence (the DEPCHA repository declares none), so it follows the same stance: local-only and gitignored under `docs/data/editor/depcha-wheaton/`, with only `teicrafter.project.json` committed. It is materialized by fetching the unchanged TEI from the public DEPCHA repository (`MEDEAEditions/DEPCHA`) via `node test/generators/make_depcha_demo.mjs`, so the demo stays reproducible without redistributing the content.

## Negative Definition

teiCrafter does not host or persist data on a server (client-only; File System Access API for local files). It does not perform character recognition (upstream HTR). Authority reconciliation is bounded, not absent: the editor offers an optional client-side lookup against Wikidata, GND, and GeoNames (`docs/js/services/authority-lookup.js`) so a human can search and pick a single id, which is then stored as the bare value in `<idno type="...">`, exactly as manual entry would be. There is no server proxy and no bulk or automatic reconciliation of the corpus; one entity, one human-chosen id at a time.

## Related

- [project](project.md) for where the data flow sits
- [specification](specification.md) for the validation levels and capabilities
- [testing](testing.md) for the round-trip proofs on this corpus
