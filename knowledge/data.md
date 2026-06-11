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
updated: 2026-06-10
language: en
version: 0.11
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
| Plaintext | Project folder | A `.txt` in an open project folder opens as minimal line-level TEI by a fixed rule (paragraphs on blank lines, `<lb/>` per line, text XML-escaped and otherwise verbatim): transport, not interpretation, so the same input always yields the same output and the draft is never AI-marked. The first save creates the `.xml` next to its source in the folder |
| Plaintext | LLM on-ramp | "New from text (LLM)": a model drafts an initial TEI that opens in the editor, marked machine-generated (violet) and unreviewed. Hidden behind `FEATURES.llmOnRamp` (off since 2026-06-10) |

Output is the same TEI, edited byte-losslessly (only edited text runs change), saved in place via the File System Access API or downloaded. The LLM on-ramp output is a fresh TEI draft, marked as machine-generated and unreviewed until the human verifies it.

The editor additionally ships one reference dataset: a vendored, version-pinned copy of the TEI P5 Guidelines compilation (`docs/data/tei/p5subset_en.json`; source, SHA-256, dual license and update procedure in the NOTICE.md next to it). It backs markup and attribute suggestions and is data the tool consults, never content it writes into an edition.

## How the Engine Reads TEI

The editor does not require a particular TEI profile. It recognises, generically by local-name:

- folio breaks `<pb>` (with `@facs` to a surface) split the document into folios;
- line markers `<lb>`/`<l>` split a folio into lines;
- reading-text nodes become editable cells; if `<w xml:id>` word tokens are present the cells are words, otherwise whole lines;
- `<facsimile>`/`<surface>`/`<zone>` with `ulx/uly/lrx/lry` drive the OpenSeadragon facsimile viewer as `<zone>` overlays; a line's `@facs` links it bidirectionally to its zone;
- `<standOff>`/`<note target>` mark words or lines that carry apparatus.

Anything it does not interpret is preserved verbatim on save.

## Facsimile Images

The facsimile pane is a real OpenSeadragon 5.0.1 deep-zoom viewer (loaded from CDN), showing the folio's page image with the edition's real `<zone>` rectangles as overlays bidirectionally linked to the reading text by `@facs`. Image sources can be imported from a IIIF manifest or a METS file's image references; see [specification](specification.md). If OpenSeadragon is unavailable the viewer degrades to an empty state rather than failing.

## Real Test Corpus

Three real pipelines drive the tool and prove the engine. The harness round-trips all of them byte-identically (see [testing](testing.md)).

| Source | Files | Shape | Editor granularity | Status |
|--------|-------|-------|--------------------|--------|
| Jeanne Hersch (zbz-ocr-tei) | 285 `*_final.xml`, ~53 KB avg (up to ~915 KB) | `<p>` + `<lb facs="#zone" n>`, full `<facsimile>` with pixel coords, `<hi>`, `<figure>`; no `<w>` | line | reads and edits directly |
| Stefan Zweig (szd-htr) | 4 catalog TEI (~6 MB) + ~2000 Page-JSON | catalog `<biblFull>`/`<msDesc>` (no text layer); transcription lives in Page-JSON | (line, after conversion) | converted by `pipeline/export_tei.py`, then reads and edits directly |
| Wenzelsbibel (Codex 2759) | real codex (~78 MB, local-only) + synthetic twin (20-folio) + tiers | word-level `<w xml:id>`, `<facsimile>`/`<zone>`, `<standOff>` | word | reads and edits directly; the editor example loads the real codex where present, the twin otherwise |

Key finding from profiling the pipelines: SZD ships no transcription TEI of its own (only catalog metadata plus Page-JSON), so it goes through a Page-JSON to minimal-TEI step first. That step is the deterministic converter `pipeline/export_tei.py` (a rule, never an LLM, since the transcription already sits in `pages[].text`); its frozen contract is [converter-reference.md](converter-reference.md). After conversion the result is line-level TEI the editor reads and edits directly. Hersch produces clean, facsimile-linked, line-level TEI that the editor handles directly. The Wenzelsbibel is the word-level reference.

## Account Ledger Demo (DEPCHA Wheaton)

A fourth real shape, not a pipeline: the Laban Morey Wheaton Day Book from DEPCHA (Digital Edition Publishing Cooperative for Historical Accounts), an account ledger encoded with the DEPCHA bookkeeping ontology. Each entry is a `<row ana="bk:entry">` of `<cell>`s carrying `<measure ana="bk:money">` amounts, `<name ana="bk:to|bk:from" type="person">` parties and `<date ana="bk:when">`; there is no `<w>`, so the editor reads it line-level (volumes 1 and 2 split into 23 and 26 folios by `<pb>`, serialize byte-identically). It lives as a `docs/data/editor/depcha-wheaton/` project folder (manifest plus `wheaton.1.xml`, `wheaton.2.xml`) opened through "Open project folder", deliberately NOT wired into the example registry. Its purpose is to exercise the project layer: a manifest binding an `account` document type and the bookkeeping markup inventory (the `bk:` descriptors above) to a markup vocabulary unlike the letters and the codex.

## Wenzelsbibel Material Profile

The reference manuscript case. The real codex `codex-2759.xml` (~78 MB) carries (structural facts of the source, not processing state): `standOff` with ~1,009 apparatus entries; `facsimile` with ~480 surfaces and ~34,363 zones; `text` with ~158,524 `<w>`, ~31,673 `<lb>`, ~6,505 `<l>`; word-level full text. A companion `Bildannotationen.xml` carries miniatures with artist attributions and ICONCLASS, linked by `corresp="#range(...)"`. `Bilderfassung.sch` is the project Schematron.

## Licence Boundary

The real Wenzelsbibel codex is third-party material (Austrian National Library) with an unresolved redistribution licence. All committed Wenzelsbibel material is a **synthetic structural twin** under `test/fixtures-synthetic/` and `docs/data/editor/` (no ONB data). Locally the real codex is materialized under the gitignored `docs/data/editor/wb-codex/` (copied from `GitHub/Wenzelsbibel/data/codex-2759.xml`); the editor's Wenzelsbibel example tries it first and falls back to the twin, so the public deployment never serves ONB data. The ZBZ Hersch example follows the same pattern: the rights-restricted line-level original stays local-only and gitignored, and a committed synthetic structural twin (`docs/data/editor/zbz-hersch-synthetic.xml`, invented placeholder prose in the real line-level form, byte-identical round-trip) is the public fallback, so the ZBZ example card loads on the deployment too. Real third-party files used for proofs (Hersch, SZD catalog, any ONB slice) live only under gitignored paths and never enter version control.

The one deliberate exception is `test/fixtures/real/o_szd.1079.tei.xml`, the SZD worked-example object: it is licensed **CC-BY** (its own `publicationStmt` carries the rights and attribution), so it is committed on purpose to make the M7.2 worked example and its proof (`test/tools/szd_worked_example.mjs`) fully reproducible. The rights-encumbered fixtures in the same folder (the Hersch files, the SZD catalog TEI `szd_werke_tei.xml`) stay gitignored. The ZBZ worked-example object (`docs/data/editor/zbz-1000/zbz-hersch-1000.xml`, doc 1000 plus per-surface `<graphic url>`) follows the Hersch rights stance: local-only and gitignored, materialized deterministically via `node test/tools/make_zbz1000_demo.mjs` from the zbz sibling checkout, so its proof (`test/tools/zbz_worked_example.mjs`) stays reproducible without redistributing the content.

The DEPCHA Wheaton day book is third-party data with no redistribution licence (the DEPCHA repository declares none), so it follows the same stance: local-only and gitignored under `docs/data/editor/depcha-wheaton/`, with only `teicrafter.project.json` committed. It is materialized by fetching the unchanged TEI from the public DEPCHA repository (`MEDEAEditions/DEPCHA`) via `node test/tools/make_depcha_demo.mjs`, so the demo stays reproducible without redistributing the content.

## Negative Definition

teiCrafter does not host or persist data on a server (client-only; File System Access API for local files). It does not perform character recognition (upstream HTR). Authority reconciliation is bounded, not absent: the editor offers an optional client-side lookup against Wikidata, GND, and GeoNames (`docs/js/services/authority-lookup.js`) so a human can search and pick a single id, which is then stored as the bare value in `<idno type="...">`, exactly as manual entry would be. There is no server proxy and no bulk or automatic reconciliation of the corpus; one entity, one human-chosen id at a time.

## Related

- [project](project.md) for where the data flow sits
- [specification](specification.md) for the validation levels and capabilities
- [testing](testing.md) for the round-trip proofs on this corpus
