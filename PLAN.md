---
title: Overall Plan and Implementation of the Editopia Project (teiCrafter, SZD, ZBZ)
project:
  name: teiCrafter
  repository: https://github.com/DigitalHumanitiesCraft/teiCrafter
method:
  name: Promptotyping
  url: https://lisa.gerda-henkel-stiftung.de/digitale_geschichte_pollin
template:
  name: Vorlage Project Plan
  version: 0.1
status: active
created: 2026-06-07
updated: 2026-06-12
language: en
version: 0.8
topics: ["[[Project Plan]]", "[[TEI XML]]", "[[Digital Editions]]", "[[Promptotyping]]"]
related: [goals, integration, converter-reference, project, data, architecture, specification, testing]
---

# Overall Plan and Implementation of the Editopia Project (teiCrafter, SZD/Stefan Zweig, ZBZ/Hersch)

This is NOT only the teiCrafter plan: it covers the three projects teiCrafter, SZD and ZBZ and the
talk/paper goal. teiCrafter is one of the three projects, not the whole. This document is at the same
time the **implementation plan**: it records the proven state and orders the open work.

This document is the complete, self-supporting synthesis of the project (state 2026-06-10). It refers
to the detail documents instead of duplicating them:
[goals.md](knowledge/goals.md) (English milestone register), [converter-reference.md](knowledge/converter-reference.md)
(SZD converter contract) and the ecosystem synthesis in the zbz repo (`zbz-ocr-tei/knowledge/oekosystem-synthese.md`).

Evidence rule: statements with `[proof]`/`file:line` are machine-verifiable; intent statements are
recorded as a decision (date named); third-party figures are point-in-time and to be checked against
the code before use.

## 0. Implementation Scope (who does what)

- **Implemented in this plan:** teiCrafter (engine, editor, annotation, image display, worked examples)
  and the **SZD pipeline** (finalize converter contract, batch converter, conversion of the
  objects, demo example).
- **Handled separately (author):** the **ZBZ pipeline**. teiCrafter already loads and renders ZBZ TEI;
  the ZBZ pipeline-side tasks (delivery of the image URL schema, ZBZ project report,
  oekosystem-synthese correction, live ZBZ run) lie outside this implementation scope and
  are marked **separate** below. The ZBZ worked example (M7.2) hangs on this track.

## 1. Purpose and Positioning

teiCrafter is a **reusable, browser-based static-site research tool**: a generic,
lossless editor for arbitrary TEI-XML, built quickly with Promptotyping and in use across several
projects (SZD, ZBZ/Hersch, Wenzelsbibel). It takes in TEI from input pipelines, lets a
human correct it folio by folio and annotate it semantically, and saves it back byte-faithfully.
("In use" means: deployed and used as a TEI editor; the entity annotation layer for the
Editopia demo is the current expansion, see §4 for the proven state.)

The overarching occasion is the **Editopia talk** (Christopher Pollin; Editopia 02.-04.09.2026,
Wuppertal; talk 2026-09-02). The proven thesis of the submitted abstract: agent-based
editorial workflows presuppose an **epistemic infrastructure**, that is mechanisms, work steps
and tools, to verify, curate and document the results of LLM-assisted processing steps. The submitted
abstract is ZBZ/Hersch-focused; the abstract file itself
is not in the vault (explicitly noted there), only its thesis is documented.

teiCrafter's role in this thesis: teiCrafter **is** a concrete piece of this epistemic
infrastructure, namely the deterministic, lossless tool in which a human checks, corrects and curates
machine-generated TEI, with clear marking of the machine-generated. teiCrafter
thereby extends the paper with its own Promptotyping case (an agentically built
editorial tool), alongside the two pipeline cases SZD and Hersch/ZBZ.

The primary in-house use case beyond Editopia is the **Wenzelsbibel edition** (PLUS Salzburg,
FWF, word-level, from autumn 2026).

## 2. Tool Boundary (binding)

- **teiCrafter = edit TEI.** Generic, lossless TEI editor. Edits and annotates
  arbitrary TEI, project-independent. ZBZ and SZD are two input pipelines that deliver TEI in.
- **EditionCrafter = whole digital editions.** Its own, independent sister line. Generalization
  of the static pipeline viewers of ZBZ and SZD into complete editions. **The Editopia Hersch
  demonstrator is EditionCrafter v0, not teiCrafter** (vault ACTIVE-WORK.md / EditionCrafter.md,
  confirmed). Note: `zbz-ocr-tei/knowledge/oekosystem-synthese.md` claims the opposite
  (teiCrafter is the Hersch demo); that is false and to be corrected (separate, see §10).
- **Static viewers (ZBZ/SZD).** The project-specific static web interfaces of the pipelines
  (public read-only proto-edition plus local editorial workspace; "Three Functions" in the JOHD paper).
  They belong to the respective pipelines, not to teiCrafter.

Dividing line in one sentence: teiCrafter creates and edits TEI; EditionCrafter creates the edition
(display, apparatus, publication).

## 3. The Three Projects

| Project | Path | Role | In scope |
|---|---|---|---|
| teiCrafter | `GitHub/ResearchTools/teiCrafter` | lossless TEI editor, convergence for TEI editing | yes |
| szd-htr | `GitHub/szd-htr` | Stefan Zweig pipeline (images to Page-JSON; TEI converter pending) | yes |
| zbz-ocr-tei | `GitHub/DHCraft/zbz-ocr-tei` | Jeanne Hersch pipeline (PDF to line-level TEI) | separate (author) |

Shared stance: machine-generated content is considered unverified until a human checks it
(teiCrafter marks it violet via `--color-ai`; zbz/szd via workflow/review status).

## 4. State: Done and Open

### Done (with proof)

The fully proven tracks are carried by the milestone register [goals.md](knowledge/goals.md);
the citable figures together with re-run commands are in [paper-evidence.md](knowledge/paper-evidence.md).
Short register (details and commands there; the detailed individual entries of this section
up to state 2026-06-10 are preserved in the git history of this file, version 0.7):

- **Lossless engine:** round-trip sweep 295/295. (M1.1, M2.1, M4.1)
- **ZBZ directly loadable:** 285/285, 0 parse errors. (M1.1, M4.2)
- **SZD chain complete (M1.2 to M1.5, M4.4):** contract frozen (converter-reference.md, active),
  batch converter byte-faithful (port_parity 6/6), full corpus 2,103/2,103 byte-identical.
- **Image display (M2.2):** engine plus browser visual test (Playwright, GAMS facsimile in OpenSeadragon).
- **M7.2 SZD worked example:** o_szd.1079 end-to-end proven in the browser (byte diff exactly the intent).
- **Editorial annotation layer complete (M3.1 to M3.7):** entities (place/work), authority `<idno>`
  (manual entry and live lookup), mention linking, notes, textual criticism (`unclear`/`del`/`add`/`gap`),
  AI suggestion (`resp="#ai"`, violet, confirm/reject); each proven headless, LLM call and fetch
  browser-verified.
- **Whitespace reservation closed:** line edit preserves edge whitespace verbatim (editCellCore, 8fd281c).

### Open (implementation scope teiCrafter + SZD)

- **M7.1/M7.3** demo material (M7.2 SZD done: o_szd.1079 end-to-end in the browser 2026-06-08).
- **Browser verification (operator)** of the three new UI paths on a real object: note click,
  AI suggestion (provider key needed), live lookup (network). Engine/parser are proven headless.

### Separate (author, ZBZ pipeline)

- **M2.3** live ZBZ browser run, **M2.4** ZBZ image URL schema (delivered, to be verified),
  oekosystem-synthese correction, ZBZ project report. The **ZBZ worked example** (M7.2 half) hangs on
  this track; the teiCrafter side (rendering, `<graphic>` support) is done.

Honest remainder: the three new annotation features (M3.5/M3.7/M3.3) are proven engine- and parser-side
headless; their actual browser paths (click UI, LLM call, live fetch) are awaiting
operator visual inspection. The deterministic SZD track (M1.2 to M1.5, M4.4) is fully proven
(parity test `port_parity.mjs` 6/6 byte-identical).

Note: `pipeline.mjs` (pre-pivot) was deleted from the root on 2026-06-10 (recoverable from the git
history). It was a non-runnable torso: it imported the `docs/js/pipeline/` deleted in the pivot
and broke with ERR_MODULE_NOT_FOUND. Its ~2033 gitignored `output/*.tei.xml`
stem from the deleted engine (LLM `<div>/<head>/<p>` blocks, NOT line-level) and are not
reproducible with today's code. "2030 TEIs done" is not a valid state.

## 5. teiCrafter Target Contract (what the editor reads and preserves)

Generic by local-name, no project profile ([data.md](knowledge/data.md),
[architecture.md](knowledge/architecture.md), `docs/js/editor/`):
- `<pb>` (opt. `@facs`, `@n`) separates folios; `<lb>`/`<l>` separates lines.
- Reading text nodes become editable cells: word-level only with `<w xml:id>`, otherwise line-level.
- `<facsimile>`/`<surface>`/`<zone ulx/uly/lrx/lry>` drive the OpenSeadragon viewer; `@facs` links
  line and zone bidirectionally.
- `<standOff>`/`<note target>` carry entities/apparatus.
- Raw string is canonical, editing is offset splice, `serialize()` byte-identical; what is not
  interpreted stays verbatim.
- Loading: **Open** (File System Access API / file input) for any local XML; plus two hard-
  wired demo fetches. An opened file gets `app.imageBase = null`.
- **Image display (M2.2, engine done):** the viewer shows an image with imageUrl AND surface; the
  editor reads `surface.graphic` from `<graphic url>` and uses it as a fallback. Pipeline-side,
  `<graphic url>` is written into every `<surface>` (SZD = GAMS URL, ZBZ = `docs/images/<id>/<id>_p00N.png`).

## 6. SZD TEI Data Model (converter contract, summary)

Full specification in [converter-reference.md](knowledge/converter-reference.md). The converter
is **deterministic** (Page-JSON -> TEI by rule, no LLM): this is the lossless,
reproducible, free stage and carries the fidelity argument. Core:
- **teiHeader** from `source` + `descriptive_metadata`: title, author/editor (persName + GND `<idno>`),
  respStmt, publicationStmt (license + machine note), msDesc/msIdentifier, physDesc, history/origin,
  profileDesc (langUsage, correspDesc only for correspondences), revisionDesc.
- **standOff**: listPerson/listOrg/listPlace, seeded from metadata (name +
  `<idno type="GND">` verbatim). No creator -> no standOff (applies to o_szd.1079).
- **facsimile**: one `<surface>` per page (`<graphic>` GAMS URL + dimensions), `<zone>` per region
  (bbox -> pixel). **bbox unit:** the contract fixes percent (0-100), confirmed
  on the real Page-JSON (o_szd.100 r1 `[3.9,2.9,4.8,0.3]`, o_szd.1079 r1 `[17.5,37.9,34.9,5.2]`); to be
  verified on the real dataset across the handful (no value > 100), then the contract is frozen. Zones only
  region-, not line-precise.
- **body** line-level (`<pb>` + `<lb>`), per document type: typescript (default), manuscript/diary
  (only double tilde `~~x~~` = `<del>`, single `~` is an em dash), letter (correspDesc,
  opener/closer/signed, `[Stempel:]`->note/stamp), form (pipe tables -> table/row/cell),
  newspaper_clipping (columns linearized).
- **Editorial markers** (v1 preserved literally): `[?]`, `[...]`/`[...N...]`, `~~x~~`, `{x}`, `[Stempel:]`.
  The target tags `<unclear>/<gap>/<del>/<add>/<note>` are built as an editor function (M3.6, criticism.js);
  the automatic mapping of these pipeline shorthands onto the tags remains a separate later task.
- **Blank pages**: `<pb type="blank"/>` for blank/color_chart, discard the text there.
- **First conversion handful** (covers the body types AND contains the showcase object): o_szd.100
  (typescript), o_szd.72 (diary, tilde case), **o_szd.1079 (letter, showcase object, already converted)**,
  o_szd.2215 (newspaper clipping), o_szd.161 (form, pipe tables).

## 7. Semantic Annotation (the added value of teiCrafter)

Definition: adding machine-readable meaning to the text, in three steps (delimit,
classify, link with authority data). Two families:
- **Family 1 entity enrichment:** persons, places, organizations, works (+ GND/GeoNames/Wikidata),
  date. This is the gap that both pipelines leave out: ZBZ removed NER (E71), SZD seeds only
  metadata entities into the header, not the mentions in the text.
- **Family 2 editorial annotation:** notes/footnotes/comments; textual-criticism markers.

teiCrafter today (done): person/org/event/**place**/**work** with name AND
**authority `<idno>`** (manual entry, add/replace/remove), type-independent mention linking,
note-creation UI (M3.5), textual criticism (M3.6, `unclear`/`del`/`add`/`gap`), live lookup (M3.3) and
AI suggestion (M3.7). The entire editorial annotation layer stands lossless and proven headless.

**AI-assisted annotation (M3.7, demonstrates the Editopia thesis).** An **offline pipeline step
with Gemini 3.1 Flash Lite** reads the finished TEI, suggests entities together with authority candidates and
writes them as **unverified** entries into the `<standOff>`. teiCrafter shows them violet
(`--color-ai`); the human confirms, corrects or discards. Rationale: deterministic conversion
(lossless) stays separate from the probabilistic suggestion (assistive); an LLM for the conversion
itself would be wrong (cost, non-reproducibility, hallucination, breaks the fidelity argument);
teiCrafter stays purely in the browser (no API key in the static-site code, Gemini runs before it in the
pipeline). This is exactly the thesis of the abstract and the design principle "AI assists, human decides".

**Authority mode (decision 2026-06-07): all three ways, staggered on one mechanism.** Each
entity carries `<idno>` with the authority id; three ways fill the same field: (1) **manual entry**
(M3.3 core, done). (2) **Live lookup** (type the name, query GND/GeoNames/Wikidata
client-side, pick a hit). (3) **Offline Gemini** (M3.7, suggestions violet before opening). Constant:
the human always checks and decides. Build order: (1) done, then (3) (strongest proof of the
thesis), then (2) (most frontend work due to CORS and rate limits).

## 8. Goals and Milestones

Legend: **★** demo-/talk-critical, **+** full ambition (parallel, not blocking).
Status: **done** / in progress / open / later / **separate** (author, ZBZ track).

**H1 - Bring both pipelines into teiCrafter**
- ★ M1.1 ZBZ directly loadable. **done** (hersch_loadability.mjs, 285/285).
- ★ M1.2 SZD `converter-reference.md` (full Page-JSON->TEI mapping, deterministic). **done
  (frozen, status active v0.5, 2026-06-08)**; all five §9 points resolved on the real Page-JSON.
- ★ M1.3 SZD batch converter `pipeline/export_tei.py`. **done** (byte-faithful Python port;
  `node test/tools/port_parity.mjs` 6/6, plus 151/151 across corpus sample).
- ★ M1.4 SZD convert demo handful + engine-verified. **done** (1079 + 100/72/2215/161
  byte-identical via port_parity and prototype engine check).
- + M1.5 SZD convert all ~2,103 + loadability sweep. **done** (`node test/tools/szd_loadability_sweep.mjs`: 2,103/2,103 byte-identical, 40 empty/blank valid).

**H2 - See, navigate, correct**
- ★ M2.1 Editor model per file. **done**.
- ★ M2.2 Image display for opened files (`<graphic>` support). **done** (engine plus
  browser visual test 2026-06-08: GAMS image renders in OpenSeadragon, zones, byte-clean; szd_demo_check.mjs).
- ★ M2.3 Live browser run ZBZ. **separate** (author); the demo-relevant part (one ZBZ object)
  goes along in M7.2.
- ★ M2.4 ZBZ image URL schema for `<graphic>` (images only for 1000/1330/1540/2310). **separate**
  (delivered, to be verified).

**H3 - Annotate semantically**
- ★ M3.1 Place entity (`place`/`placeName`). **done** (szd_demo_check.mjs).
- ★ M3.2 Work entity (`title`/`bibl`, `listBibl`, `wrk_` ids, restricted to standOff/listBibl).
  **done** (szd_demo_check.mjs).
- ★ M3.3 Authority `<idno>` (GND/GeoNames/Wikidata) on all types + UI. **done**: manual entry
  (setAuthority, szd_demo_check.mjs) plus live lookup (authority-lookup.js, authority_lookup_check.mjs
  15/15; fetch browser-verified), commit 8ce938a.
- ★ M3.4 Mention linking on new types. **done** (linkMention type-independent).
- ★ M3.7 AI annotation suggestion (violet for review). **done** (resp="#ai" + confirm/reject,
  ai_proposal_check.mjs 17/17; uses in-browser llm.js, LLM call browser-verified), commit f647e7e.
- + M3.5 Note/footnote creation UI. **done** (addNote/addNoteForNode, note_create_check.mjs 15/15),
  commit d3fc922.
- + M3.6 Textual criticism (`unclear`/`gap`/`del`/`add`). **done** (criticism.js, inline + lossless,
  criticism_check.mjs 47/47), commit 119a1a2.

**H4 - Losslessness as an invariant**
- ★ M4.1 Engine round-trip sweep. **done** (roundtrip_sweep.mjs, 295/295, run 2026-06-10).
- ★ M4.2 Editor loadability sweep. **done** (hersch_loadability.mjs, 285/285).
- ★ M4.3 Every feature byte-clean (regression test). in progress (szd_demo_check.mjs, 32/32).
- ★ M4.4 SZD-converted TEI byte-clean through `tei-document.js`/`standoff.js`. **done** (szd_loadability_sweep.mjs 2,103/2,103 round-trip; standoff.js via szd_demo_check.mjs).

**H5 - Verification, documentation**
- ★ M5.1 Canonical integration.md + this plan. **done**.
- + M5.2 Enrich integration.md with proof evidence + correct "Blocker not on disk". **done
  (2026-06-09)**: proof evidence centralized in paper-evidence.md, integration.md refers there; the
  "Blocker not on disk" claim is removed (goals.md carries the completion).
- + M5.5 Correct oekosystem-synthese (EditionCrafter, not teiCrafter, is the Hersch demo).
  **separate** (author, ZBZ track).
- + M5.6 Documentation sync (data.md/architecture.md on SZD converter + new test). **done (verified
  2026-06-10)**: both documents carry `pipeline/export_tei.py`, the frozen contract and the
  sweep proofs.

**H6 - Maintain knowledge vaults** (Promptotyping method, reproducibility for the paper)
- + M6.1 Keep teiCrafter `knowledge/` up to date. in progress.
- + M6.2 Keep szd-htr `knowledge/` up to date. in progress.
- + M6.3 Keep zbz-ocr-tei `knowledge/` up to date. separate (author).

**H7 - Editopia contribution and demo material** (teiCrafter as a Promptotyping case)
- ★ M7.1 teiCrafter as a presentable Promptotyping case (tool + provenance in the vault/repo). open.
- ★ M7.2 Two annotated worked examples (one ZBZ and one SZD object each, end-to-end in the editor).
  **SZD half done** (o_szd.1079 proven in the browser, byte diff, 2026-06-08); the ZBZ half
  hangs on the separate ZBZ track.
- + M7.3 Contribution to slide deck/full text, insofar as teiCrafter is concerned. open.

## 9. Success Criterion, Demo Objects, Critical Path

Success criterion (set 2026-06-07): **one real ZBZ and one real SZD object end-to-end in the browser**
(open, correct line by line, annotate person/place/work with authority data, save byte-faithfully). That
is M7.2 and at the same time the presentable core for the Editopia material.

Demo objects:
- **SZD showcase object:** o_szd.1079 (letter to Max Fleischer 1901: real persons, place, date, envelope,
  correspDesc, GAMS image). Accompanying handful for type coverage: o_szd.100/72/2215/161 (§6).
- **ZBZ object:** from {1000, 1330, 1540, 2310} (only these have committed images), the textually
  richest; selection in the separate ZBZ track.

Critical path (SZD chain): **M1.2 -> M1.3 -> M1.4 -> M1.5** is fully done (contract
frozen, batch converter byte-faithful, full corpus 2,103/2,103 byte-identical loaded). Next:
on the demo side **M7.2** (SZD half proven, ZBZ half in the separate track) and optionally **M3.7**
(offline Gemini). Time is explicitly irrelevant; ordering is only by dependency.

## 10. Open Points, to Be Confirmed on the Real Page-JSON

- **converter-reference.md §9 (before freezing):** bbox conformity across the handful (no value
  > 100); markers that really occur; rejected fields (`reading_order`/`lines`/`label`/`source`/`notes`);
  further standOff seeding (repository -> listOrg, sender/recipient -> listPerson); images 1:1 to pages.
- **Whitespace on line edit (closed 2026-06-08, editor-side):** the editor now preserves the edge
  whitespace of the edited line verbatim (only the trimmed core is edited,
  `editCellCore`/`splitEdge`). Decision: editor-side instead of converter-side, because it keeps byte fidelity
  for all corpora (ZBZ, Wenzelsbibel, SZD). Proof whitespace_edit_check.mjs 14/14, commit 8fd281c.
- **Correctness audit (partly separate):** oekosystem-synthese.md falsely claims teiCrafter is the
  Hersch demo (correct: EditionCrafter v0); zbz status figures (3 vs 4); szd fluctuating object counts
  (authoritative 2,107). teiCrafter-side done: token prefix drift (`--color-*`), AI violet failure.

## 11. Implementation Backlog (next steps, ordered)

teiCrafter + SZD: the earlier points 1 to 7 of this backlog (SZD reconciliation and contract freezing,
whitespace, batch converter, full corpus, M7.2 SZD, note/AI suggestion/live lookup, M5.2/M5.6) are
done and registered in [goals.md](knowledge/goals.md) and [paper-evidence.md](knowledge/paper-evidence.md);
the individual proofs with commits and proof figures are carried by the git history of this file
(version 0.7). **M6.x** is in progress (knowledge vaults are caught up per session).

**Editor track, state 2026-06-12:** a feedback session on the new HSA letter demo project
(`docs/data/editor/hsa-7711`) produced six accepted packages (plaintext direct import `.txt`/`.md`,
`|N|` page marker, examples visible only locally, document line plus document panel,
reconciliation at the annotation site with manifest opt-in, draft safeguarding against reload loss,
flat filterable annotation popover with manifest `attrField`) and defined **package F**
(index declaration as manifest consumer, empty-project onboarding, banner integration into the
document line, document-panel finding). Details, decisions and open gates: `HANDOFF.md`
and `knowledge/journal.md`.

Separate (author, ZBZ): verify ZBZ image URL schema, live ZBZ run, ZBZ worked example,
oekosystem-synthese correction, ZBZ project report.

### Next steps (state 2026-06-10 at night, after the UI rounds M2.7-M2.13)

**Decisions 2026-06-10 (operator, definition questions):** all five recommendations from
`Wenzelsbibel/knowledge/definitionsfragen-teicrafter-wenzelsbibel.md` ratified.
F1: Editopia share frozen to load, page, correct one word, no-op save, facsimile;
deepening runs on the autumn track for the PLUS team. F2: core now edit holdings;
PAGE-XML->TEI import registered as **WB-AP5**, data model (one file vs. file per book)
WITH project leadership. F3: project first-class as a declarative manifest `teicrafter.project.json`;
M2.9 decided as "Open project folder" via directory handle (File System Access), NOT OPFS.
F4: view switcher diplomatic|normalized plus two-field double-click edit with attribute-precise
splice. F5: two-stage acceptance gate W1 (operator proxy, real folio end-to-end) / W2
(PLUS editor without briefing); precondition write ED.1-ED.7.

Gates first (operator):
1. **Browser visual inspection** of the five feedback rounds from 06-10 on both object tracks
   (o_szd.1079, ZBZ Doc 1000): editor paradigm, annotation editor with authority data at the text,
   index overlay, XML source view with highlighting/check, home navigation. Then push approval
   (local commits on session/2026-06-07-place-graphic) and merge decision.

Wenzelsbibel (order `Wenzelsbibel/knowledge/auftrag-teicrafter-wenzelsbibel.md`, data local,
do NOT commit; feasibility proven headless on 06-10: codex-2759.xml 78 MB parses in 1.3 s,
round-trip byte-identical, 480 folios, word profile):
2. **WB-AP1 load path in the browser: engine-side done 2026-06-10** (validation cache per
   doc identity instead of DOMParser per render; source-view guard above 8 MB; load time in the status;
   wb_codex_check.mjs 16/16: 82 MB parse 1.8 s, no-op save byte-identical, word edit 2.0 s
   full re-parse). Open: operator opens codex-2759.xml via "Open TEI..." in the browser.
3. **WB-AP2 IIIF resolver: engine-side done 2026-06-10** (project-profiles.js: profile via
   PID `o:wen.*`, file name -> ÖNB info.json as OSD tile source, verified live; zone bboxes
   from `@points` in readSurfaces, 34,363/34,363 within the surface; no percent conversion
   needed, coordinate space == IIIF dimensions). Gate "project loads, facsimile stands": operator visual inspection.
4. **WB-AP3 project module: engine-side done 2026-06-10** (= M5.7 connection): manifest format v1
   in `project-manifest.js` (entry-agnostic, strictly validated, normalized to the profile form),
   WB manifest committed as the first profile (derivation of the editorial guidelines, open points stay
   open instead of invented); manifest before PID fallback, `markup` replaces the built-in wrap list
   project-wide; `indices`/`views` declared, consumers follow with index work and F4.
   `node test/tools/project_manifest_check.mjs` -> **62/62** (state 2026-06-11, since then grown by
   type binding and TEI scope). [proof] Open: operator visual inspection
   (WB example loads with "project: ... (manifest)" in the status line); M2.9 as the next connection.
5. **WB-new dual reading (F4): engine and UI done 2026-06-11** (commits ae0b6f5 engine,
   1ef4bfe UI; orchestrated in two Opus packages on disjoint file sets). Engine: atomic
   multi-part edit `editTextAndAttrs` (`tei-document.js`) plus `editCellReadings` (`edition.js`)
   edit diplomatic core and `@norm` in ONE re-parse, refusal instead of partial application;
   cell projection `w`/`hasDualReadings`. UI: switcher diplomatic|normalized in the reading pane
   (only with dual reading and outside the source view, persisted per document), normalized
   view as a display projection, two-field double-click edit, selection annotation restricted to the
   diplomatic view. `node test/tools/dual_reading_check.mjs` -> **28/28** (atomic
   edit byte-faithful by full reconstruction, `@orig` sync, `@norm` add/remove, refusal on
   element children, projection, real-codex guard SKIPs without local codex). [proof] The
   switcher binds to the document encoding (hasDualReadings), not to the manifest;
   the declared `views` remain without a consumer. Open: operator visual inspection in the browser
   (switcher at the real codex,
   two-field edit, annotation hint in the normalized view).
6. **WB-AP4 standOff apparatus**: resolve `app from/to` onto the inline `<anchor>` pairs and mark them in
   the reading text (mechanism analogous to the textual-criticism layer).
7. **Write ED.1-ED.7 user stories** (dangling reference in the Project Overview; four work axes),
   then carry out **gate W1**.
8. **WB-AP5 PAGE-XML->TEI import** of the raw HTR books (pattern SZD converter); starts only after
   the data-model decision with the project leadership.

Editor path, independent of the Wenzelsbibel:
9. **M2.9 Open project folder: engine-side done 2026-06-10.** Directory handle (File
   System Access), project panel with file list, "New project" writes a minimal manifest;
   correction the same day (operator): a project is NOT an edition type, the manifest carries
   `documentTypes` + `files`, the element inventory binds to the type. Plaintext files open
   as a deterministic line-level draft (transport, not interpretation, deliberately not
   violet); the first save creates the .xml in the folder. Proofs project_manifest_check.mjs 62/62,
   project_case_check.mjs 24/24 (the operator test case headless: own project, one TEI,
   two plaintexts). [proof] Open: the browser run of exactly this test case (operator gate).
10. **M5.7 Editorial guidelines of the source projects** (SZD/GAMS, ZBZ Hersch) into the knowledge base.

(Commit, deploy and publication are deliberately not part of this plan.)

## 12. Acceptance and Evaluation (simple, exactly one proof per goal)

The methods are complementary: each answers a different question and catches a different error.
Together they are the Promptotyping verification cascade (automatic, contextual, visual, expert).
Real data is the rule at every level (synthetic only Wenzelsbibel, license). Detailed version:
[testing.md](knowledge/testing.md), section "Verifying the Project Goals".

**Level 1, machine (repeatable):**
- Losslessness: `node test/tools/roundtrip_sweep.mjs` (all demo files byte-identical).
- Loadability: `node test/tools/hersch_loadability.mjs` (opens as editor model).
- Feature proof: `node test/tools/szd_demo_check.mjs` (image URL, zones, place/work, authority `<idno>`,
  mention linking, line-level, byte-identical).
- "Diff is exactly the intent": open file, set one entity (place + GND `<idno>`), save, re-
  read; the only byte difference is exactly this standOff/markup entry.
- SZD conversion test: each handful file converts + round-trips + loads (folios/cells > 0).
- Schema: well-formed + TEI All RNG + Schematron (ZBZ additionally `zbz_hersch.rng`).

**Level 2, frontend analysis (checklist per demo object, the success criterion as six yes/no checks):**
1. Open (folios/lines visible). 2. Image (facsimile visible, zone highlights the right line).
3. Correct (edit line, stays). 4. Annotate (person/place/work + authority id).
5. AI suggestion (M3.7: violet, normal after confirmation). 6. Save (opens identical again, only
deliberate changes).

**Level 3, expert:** a domain expert confirms the content (transcription/annotation correct as
an edition). Both corpora are currently unreviewed; that is expert curation, not tool acceptance.

Twelve visual checks (two objects) plus the machine test commands are the tool acceptance. Every
demo-critical feature is proven twice: headless proof in the harness AND browser path on the real
object.

## 13. Verification Protocol

The document is finished when every statement is either machine-proven (command/`file:line`) or recorded as
a decision. Mechanisms: source tag per statement; repeatable proofs for the
factual core (see §4); adversarial audit pass (document against sources for
omissions/contradictions/unsupported claims); contradiction scan against the respective single source
of truth. In case of conflict, the domain SSoT applies.

## 14. Sources and SSoT

| Domain | Single source of truth |
|---|---|
| Contracts, gates | `teiCrafter/knowledge/integration.md` |
| teiCrafter goals/milestones (register) | `teiCrafter/knowledge/goals.md`, extended by this plan |
| SZD converter contract | `teiCrafter/knowledge/converter-reference.md` |
| teiCrafter spec/architecture/tests/design | `teiCrafter/knowledge/{specification,architecture,testing,design,data}.md` |
| zbz pipeline/workflow/quality/decisions | `zbz-ocr-tei/knowledge/{pipeline,workflow,quality,decisions,methodik,projekt}.md` |
| szd pipeline/data/verification, converter contract | `szd-htr/knowledge/{data-overview,verification-concept,htr-interchange-format,teicrafter-integration}.md` |
| Operational overall state, paper architecture | Obsidian vault `ACTIVE-WORK.md`; JOHD paper "The Static Proto-Edition as Editorial Workspace" |

## 15. Vault Context (for orientation)

- Editopia 02.-04.09.2026 Wuppertal; talk 2026-09-02. Submitted abstract ZBZ/Hersch-focused,
  thesis epistemic infrastructure; demo form per the vault: live demonstration (Hersch corpus through
  EditionCrafter v0) plus a full text to be elaborated. teiCrafter is the extension by the tool case.
- There is a separate JOHD paper (Pollin/Zangerl/Hintersteiner), SZD-focused, thesis "Three
  Functions" of a static codebase. Demarcated from the Editopia contribution.
- teiCrafter's primary in-house use case is the Wenzelsbibel edition (word-level, FWF, autumn
  2026); the build backlog for it is kept in the Wenzelsbibel project document.
- Methodological framework Promptotyping: repo as agent interface, verification cascade
  (automatic -> contextual -> visual -> expert), Critical Expert in the Loop (who creates != who
  checks), epistemic asymmetry (LLMs generate the plausible, cannot judge it themselves).
