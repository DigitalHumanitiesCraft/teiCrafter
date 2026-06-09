---
title: teiCrafter Development Journal
project:
  name: teiCrafter
  repository: https://github.com/DigitalHumanitiesCraft/teiCrafter
method:
  name: Promptotyping
  url: https://lisa.gerda-henkel-stiftung.de/digitale_geschichte_pollin
template:
  name: Vorlage Journal
  version: 0.1
  url: https://dhcraft.org/Promptotyping/promptotyping-document/journal
status: active
created: 2026-02-05
updated: 2026-06-09
language: en
version: 0.8
related: [project, specification, architecture, testing]
---

# teiCrafter Development Journal

Chronological log, most recent first. A condensed narrative of how the tool and its decisions came about; commits live in Git history.

## 2026-06-09: ZBZ worked example (M7.2 ZBZ half, M2.4), Editopia evidence sheet, sharpened success criterion

The Editopia frame was sharpened by the operator: "the experiment succeeded" was premature, since the ZBZ project partners are not yet convinced of the result's value. The experiment now counts as successful when the workflow's added value for the Hersch project is demonstrable: from the unverified pipeline TEI of a real object, curation in teiCrafter produces a demonstrably better TEI (facsimile-linked, authority-linked entities, explicit editorial confidence and verification status) while preserving the pipeline output byte-exactly. Recorded in goals.md (Frame) and as the before/after table in worked-example-zbz.md section 6. A second operator decision: both demo objects run in teiCrafter (the EditionCrafter-v0 note in the zbz repo's oekosystem-synthese.md is to be corrected there, M5.5 stays an order to the zbz lane).

The ZBZ half of M7.2 landed. A research workflow (three parallel readers over zbz-ocr-tei, teiCrafter and the evidence base) compared the four candidates with committed images; doc 1000 won over 1330 (7 pb on 6 surfaces, double pages per scan), 2310 (image/surface index offset) and 1540 (strong runner-up, 8 pages) for its clean 1:1 pb/surface/image alignment, dense entities and graded OCR defects. The object is the unchanged pipeline `1000_final.xml` plus one `<graphic url>` per surface (the M2.4 scheme, `https://chpollin.github.io/zbz-ocr-tei/images/1000/1000_p00N.png`), injected by the deterministic generator `test/tools/make_zbz1000_demo.mjs`. The proof `test/tools/zbz_worked_example.mjs` (38/38, 11 surgical edits) drives the full arc: lossless load with graphic urls on all 4 surfaces, the OCR fix "inadaption" to "inadaptation" proven a two-byte insertion by full reconstruction, the standOff triad with resolved authorities (Hersch GND 118815679 via lobid; Geneve Wikidata Q71 plus GeoNames 7285902 via Wikidata P1566; Illich and "Une societe sans ecole" deliberately authority-free for the live lookup), a Geneve mention link, `<unclear>` on the column-split footnote fragment, `<gap/>` for the stray "Heft" token, idempotent save. Browser paths await the operator sight-check.

A rights decision worth recording: the prepared object was briefly committed, then pulled back before any push. This repo's documented stance keeps Hersch material out of version control (zbz-100 precedent), and although doc 1000 is one of the four documents the zbz repo itself publishes, public is not redistributable; the object is now gitignored and materialized on demand by the generator, the proof gating local file, else sibling build, else SKIP. If ZBZ confirms redistributability of the four demo documents, committing is a one-line gitignore change.

`knowledge/paper-evidence.md` (M5.2 resolved) fixes every number the paper may cite with source of record, re-runnable command and caveat, and supersedes four stale figures found by the verification pass: Fidelity-CER is median 1.40% / mean 2.71% (corrected run 2026-06-08; the 1.83/4.26 pair circulating in earlier notes and in integration.md was stale), SZD needs_review is live 16.4% (340/2069, not the documented 27% from the smaller corpus), ZBZ workflow states are three (E77), port parity is 5/5 with one upstream-deduped skip. integration.md was corrected accordingly. Full regression stayed green before and after (roundtrip 294/294, both worked examples 38/38).

The teiCrafter half of the success criterion turned from "feature checks pass" into a presentable, reproducible artifact. `knowledge/worked-example-szd.md` walks the real CC-BY object `o_szd.1079` (an 1901 Stefan Zweig letter to Max Fleischer) end to end: open and verify the GAMS facsimile, navigate the five folios, correct an HTR slip by editorial judgement ("Gerichte" to "Gedichte"), add the person / place / work triad with the authority identifiers that are genuinely known (Zweig GND 118637495, Wien GeoNames 2761369 / Wikidata Q1741) and leave the rest to the live lookup, link a mention, mark `<unclear>` and `<gap>`, and save byte-faithfully. A new proof `test/tools/szd_worked_example.mjs` drives that whole arc through the real engine on the actual fixture and asserts every step is a surgical byte-faithful splice; the "Gerichte" fix is proven to change exactly one byte and nothing else by full reconstruction, not a tautological prefix check. 38/38, exit 0. The fixture is committed because it carries its own CC-BY licence and attribution in its `publicationStmt`, which makes the worked example fully reproducible; the rights-encumbered fixtures in the same folder stay gitignored (recorded in data.md).

`knowledge/promptotyping-case.md` presents teiCrafter as the third Promptotyping case (the tool plus its three on-disk provenance traces: the knowledge base, this journal, the Git history), folds in the repo-side project-status spine (M5.4) and a drafted talking-points section for the slides (M7.3). This closes the repo side of M7.1, M5.4, and M7.3; the vault-side provenance and the live deck stay outside the repo, and the ZBZ half of M7.2 stays with the parallel ZBZ spur.

Built and adversarially reviewed by a dynamic workflow (three build agents, three skeptic verifiers, ten findings, zero blockers). The fixes that mattered: two tautological prefix/suffix checks in the proof were replaced with a full-reconstruction assertion that actually catches a stray change; the evidence split in both docs was made precise against ground truth (the M2.2 render and the m72 Playwright run for open / save / line-correction / place-annotation are browser-verified 2026-06-08; Mark-text, in-browser mention linking, and the live fetch are headless-proven and await a sight-check). The dead `data/demo` corpus (leftover of the removed five-step generator) was deleted. The knowledge versions were unified at 0.7 across the set, except converter-reference.md (0.6.1), left to the actively-editing SZD lane to reconcile. Full feature-proof regression stayed green (szd_worked_example 38/38, criticism 47/47, szd_demo, note 15/15, ai_proposal 17/17, ai_suggest 8/8, whitespace 14/14, authority 15/15, generic_roundtrip 34/34, editor_roundtrip 13/13, edit_fidelity 21/21).

## 2026-06-08: Textual-critical markup (M3.6) with an adversarial review pass

The last open editor-direct annotation milestone. Inline textual criticism now lives in a DOM-free `criticism.js`: `markCritical` wraps a reading-text node's core in `<unclear>`/`<del>`/`<add>` or, for a gap, replaces it with a self-closing `<gap/>`; `unwrapCritical` reverses a wrap; `removeGap` deletes a gap. The wrap splices the raw, already-escaped slice as-is (no decode/re-encode), keeps edge whitespace outside the tags, and a no-op returns the same document. The UI is a "Mark text" mode with an inline chooser; the three click-capture modes (mark, note, link) are now mutually exclusive and reset on load.

Two design decisions worth recording. First, gap REPLACES rather than wraps, because a TEI `<gap>` is content-less by definition (the text is omitted/illegible); the cell model surfaces the gap as its own read-only cell so the line stays visible and the marker stays removable. Second, the shared `splitEdge` moved from edition.js into the core tei-document.js so the textual-critical wrappers and the cell editor preserve edge whitespace by the exact same code, not two copies; `CRITICAL_LOCALS` and a `nearestAncestor` helper (folding three near-identical ancestor walks into one) landed there too.

The feature was hardened by a dynamic adversarial workflow: seven dimensions (engine, cell-model, UI, design, tests, refactor, docs), every finding independently verified by a skeptic, 22 confirmed of 26. The load-bearing fix: `unwrapCritical` now refuses to strip a wrapper shared with sibling content (clearing one cell of `<del>Hallo <hi>X</hi> Welt</del>` must not drop the deletion over the others), and the cell tag is keyed on the immediate parent so the visible state matches what the ops can act on (`crit`/`critSole`). Also fixed: a gap in a non-reading subtree no longer leaks into the reading view; the chooser dismisses on Escape and never orphans a second open chooser; the gap marker contrast was raised to WCAG AA (token-only, non-violet). The proof grew from 29 to 47 checks (`criticism_check.mjs`), adding the cases the review exposed (CRLF, mixed-content refusal, the nesting contract, word-level gap, the no-op guard paths) and replacing a tautological round-trip assertion with a real token-coverage check. Full regression stayed green (roundtrip 294/294, generic 34/34, hersch 285/285). Commit 119a1a2.

This completes the editorial annotation layer end to end (entities + authority ids + mentions + notes + AI proposal + live lookup + textual criticism), all lossless and headless-proven; the browser-only paths await an operator sight-check.

## 2026-06-08: Annotation layer completed (notes, AI proposal, live lookup), whitespace caveat closed

A build session that closed the open editor-direct milestones, each proven headless and committed per milestone, plus an adversarial multi-dimension review of the whole batch.

The whitespace caveat (PLAN.md section 10) is closed editor-side. A line edit used to overwrite the whole text node and collapse its trailing indentation; now only the trimmed core is edited and the original edge whitespace (lead/trail) is re-attached on commit (`splitEdge`/`editCellCore` in edition.js). The decision was editor-side over converter-side because it keeps byte fidelity for every corpus (ZBZ, Wenzelsbibel, SZD), not just SZD. Proof: `whitespace_edit_check.mjs` 14/14, with the old collapsing path kept as a control (commit 8fd281c).

Three annotation features landed. M3.5 editorial notes: notes were already read and rendered (the has-note marker) but could not be created; `addNote`/`addNoteForNode`/`ensureXmlId` (standoff.js) create a lossless `<note target="#id">` inside `<standOff>`, resolving the target via the nearest ancestor xml:id, else the line `@facs`, else a freshly injected xml:id; UI is an "Add note" mode (note_create_check.mjs 15/15, commit d3fc922). M3.7 AI proposal: the in-browser LLM proposes entities, inserted as unverified `resp="#ai"` (a schema-valid, lossless responsibility marker), rendered violet; the human confirms (`confirmEntity` drops the marker) or rejects (`deleteEntity`). The reply parser lives in a DOM-free `ai-suggest.js` so it is provable headless (ai_proposal_check.mjs 17/17, ai_suggest_parse_check.mjs; commit f647e7e). M3.3 live lookup: `services/authority-lookup.js` builds query URLs and parses Wikidata, GND (lobid) and GeoNames responses into uniform hits; Wikidata and GND are keyless and CORS-friendly, GeoNames needs a username and refuses fast otherwise; the index panel gets a "find" button and a results popover (authority_lookup_check.mjs 15/15, commit 8ce938a). The actual LLM call and network fetches are browser-verified; everything deterministic is proven headless.

The decision to mark AI content as `resp="#ai"` rather than a custom attribute keeps the markup TEI-valid and records provenance (who produced it is not who verifies it), matching the Editopia thesis and the design principle that the AI assists and the human decides.

A background adversarial review (five dimensions, each finding independently verified) of the diff confirmed four real UI-layer defects the headless tests could not reach, all fixed in commit 3f608e6: a stale-lookup-result race (a result writing into a detached popover after a newer lookup or an index re-render; guarded with `pop.isConnected`, not `parentElement`, since a re-render detaches the whole subtree while the local parent link survives), a missing `.ed-idx-lookuplabel` CSS class, and a dead `editWordText` import with a stale comment.

Meanwhile the SZD lane committed the deterministic converter chain onto the same branch (M1.2 contract freeze, M1.3 `pipeline/export_tei.py`, M1.5 full-corpus run, M4.4). Verified read-only from here: `port_parity.mjs` is 6/6 byte-identical between the Python converter and the reference prototype over the handful, so that work is real and correct. This made the SZD order obsolete before it was written.

## 2026-06-08: Coordination dissolved, plan moved to PLAN.md, SZD demo proven in browser

A second 2026-06-08 session, focused on cleanup and on proving the SZD demo on real data.

Removed all multi-Claude-Code coordination (CC1/CC2/CC3, orchestration, reporting protocol, owner tags, the Lane and Forschungsleitstelle framing) from the knowledge docs across teiCrafter, szd-htr and zbz-ocr-tei, plus the Obsidian vault and memory; deleted the two pure-coordination files (`cc1-session-report.md` and the coordination memory). A full repo sweep confirms zero residual coordination tokens. The three projects stay as real, independent repositories with a real data-flow relationship; the product LLM features (on-ramp, Gemini proposals, the agent_verified review tier) were kept.

The plan moved from `knowledge/project-plan.md` to the repo root as `PLAN.md` (single-developer plan: status corrected to as-built, scope split teiCrafter plus SZD here and ZBZ separate, an implementation backlog); all references updated. The sibling-repo and Obsidian coordination edits are left in their working trees for the author (teiCrafter only is edited directly from here on).

M2.2 (image display) and the SZD half of M7.2 (worked example) are proven in a real browser (headless Chrome via Playwright, system Chrome channel) on the showcase letter o_szd.1079: the GAMS facsimile renders in OpenSeadragon (IMG.1/IMG.2 HTTP 200) with zone overlays; open-then-save is byte-identical to source; a line correction (Wohlgeboren to Hochwohlgeboren) changes exactly that region; an annotation (place Komotau plus `<idno type="GeoNames">`) inserts exactly the standOff block; re-opening the saved file is stable. Byte-diffs are reproducible via `c:\tmp\pwtest\m72.js`; screenshots in `c:\tmp`.

One caveat found: a line edit collapses the edited line's trailing indentation whitespace (the text node is rewritten). No data loss, the file round-trips, but that line's formatting changes; it is an open decision in PLAN.md section 10 (fix the editor to keep trailing whitespace, or have the SZD converter write tighter body lines).

Working model set with the project lead: work autonomously per milestone; edit only teiCrafter directly (szd-htr and zbz get written orders); drive the browser for visual checks; local commits per milestone, no push without an explicit word. teiCrafter was committed in milestone commits; nothing was pushed.

## 2026-06-08: Authority-id core, work entity, converter contract drafted

A focused build session on two deliverables. The annotation cluster is now closed and the SZD converter contract exists on disk.

Authority identifiers (M3.3) reach an entity as `<idno type="GND|GeoNames|Wikidata">value</idno>` children, the decision being `<idno>` over `@ref`: it allows several registers per entity, matches what the SZD converter already emits for creators, and keeps `@ref` reserved for the mention pointer. `setAuthority` (add / replace / remove, each one idempotent offset splice) and an `authorities` field on every read entity went into `standoff.js`; a per-row register-select + value field + removable chips into `index-panel.js`; the `onSetAuthority` hook into `editor-app.js`; tokens-only styles into `editor.css`. The work entity (M3.2) was pulled forward because the demo triad is person/place/work: type `work` = `listBibl`/`bibl`/`title` with `wrk_` ids, read scoped to `standOff`/`listBibl` so a `<bibl>` in the `teiHeader` is never misread.

The converter reference (M1.2) is drafted as `knowledge/converter-reference.md`: the full deterministic Page-JSON v0.2 to TEI mapping (acceptance, skeleton, body text-to-`pb`+`lb`, teiHeader, facsimile with `graphic` url and pixel zones, the bbox formula, standOff seeding, markers, id scheme), every rule citing the prototype line. Status is draft; it freezes once the five open points in section 9 are resolved against real data. The bbox-unit question from 2026-06-07 is resolved as percent: real values are in 0-100 (o_szd.100 r1 `[3.9,2.9,4.8,0.3]`, o_szd.1079 r1 `[17.5,37.9,34.9,5.2]`), matching the schema; the earlier "maybe cm" doubt had conflated `physical_description.dimensions` (the physical sheet) with the bbox unit.

Proofs: the SZD demo proof grew from 17 to 32 checks (`node test/tools/szd_demo_check.mjs`, add/replace/remove authority, coexisting registers, seeded-GND read, work add/read, header-bibl exclusion); the two fixed sweeps stay green (294/294, 285/285); `node --check` clean on the three edited modules. Knowledge docs synced: `goals.md` (M3.2/M3.3 done, M1.2 draft, critical path), `architecture.md` and `specification.md` (as-built entity model, the idno decision), `INDEX.md` (converter-reference row). Next: the browser-visual M2.2 test (CORS), the M2.4 image-URL scheme, freezing the contract against the SZD reality, then accepting the SZD demo TEI (M1.4/M7.2).

## 2026-06-07: Plan synthesis, three built milestones

A planning session. teiCrafter is framed as the third Promptotyping case in the Editopia talk (the tool case), alongside the SZD and ZBZ/Hersch input pipelines. The full, self-contained plan and resume point is `PLAN.md` (next steps, acceptance); the milestone register is `goals.md`.

Decisions: the end product is the whole project (all three implementations plus the slide text plus the full paper text plus all knowledge documents). Normdata reaches an entity by three layered paths on one `@ref`/`<idno>` mechanism: hand entry (the foundation, buildable now), an offline Gemini 3.1 Flash Lite batch proposal (M3.7), and an in-browser live lookup. Gemini is used only for annotation proposals, never for the Page-JSON to TEI conversion, which stays deterministic. Demo objects: o_szd.1079 (SZD) and one of docs 1000/1330/1540/2310 (ZBZ, the only ones with committed images). EditionCrafter v0, not teiCrafter, is the Editopia Hersch demonstrator.

Built this session (additive, lossless; new proof `node test/tools/szd_demo_check.mjs`, the three fixed proofs stay green): M2.2 image engine side (`readSurfaces` reads `<graphic url>`, `renderFacsimile` falls back to `surface.graphic`), M3.1 place entity (`standoff.js`/`index-panel.js`), M3.4 mention linking (type-independent). Open: the browser-visual test that the GAMS image renders in OpenSeadragon (CORS), and M3.3 normdata `@ref` (now unblocked).

On-disk audit corrected the plan: `pipeline.mjs` is not deleted but a non-runnable torso (it imports the deleted `docs/js/pipeline/`); the SZD converter prototype lived in `c:\tmp` (fragile, unversioned) and was versioned into `test/tools/szd-pagejson-to-tei.mjs`; the zone bbox unit is open (the prototype assumes percent, an on-disk reading suggests absolute, and the byte round-trip proof does not adjudicate geometry), to be confirmed against the SZD data.

Verification approach for the goals: the Promptotyping cascade (automatic, contextual, visual, professional), with user-story walkthroughs on real data in the browser as the centerpiece; written up in `testing.md` ("Verifying the Project Goals"). Knowledge docs updated this session: `project-plan.md` (rewritten with audit corrections; later moved to `PLAN.md`), `goals.md` (H1 to H7, framing, M3.x statuses), `testing.md` (acceptance cascade), `integration.md` (H5 to H7).

Next: draft `converter-reference.md` (M1.2) and build the M3.3 hand-entry core; confirm the SZD reality including the bbox unit, then build `pipeline/export_tei.py`; deliver the ZBZ image-URL scheme, a demo-object recommendation, the render check, and the oekosystem-synthese correction.

## 2026-06-04: Adversarial audit and four confirmed-defect fixes

Ran an adversarial audit of the whole tool (code quality across seven dimensions plus spec-completeness, every finding independently re-verified, several empirically against the running engine and the live editor). It raised 23 findings; 15 survived verification, 8 were refuted, notably all four "key-leak" claims (the Gemini `?key=` URL is TLS-encrypted on a `fetch`, not a navigation; the CR/LF header-injection is already blocked by `setApiKey`'s validator). The lossless and security core held under pressure. Four confirmed defects were fixed this session:

- **Entity escaping was not round-trip-stable.** `escapeText`/`escapeAttr` re-escaped an `&` that already began a valid reference, so editing (even a no-op) a cell or attribute containing `&nbsp;`/`&#233;`/`&quot;`/`&apos;` corrupted it (`&nbsp;` becoming the literal `&amp;nbsp;`). The 294/294 sweep never caught this because it tests identity round-trip only and no fixture carries such entities. Fixed in `tei-document.js`: a bare-`&` regex (`RE_BARE_AMP`) leaves existing references intact, and `editTextNode`/`editAttrValue` now detect a true no-op by comparing the decoded forms. New proof `test/tools/edit_fidelity.mjs` (13/13) covers no-op fidelity, neighbour-entity preservation on a real edit, and the attribute path.
- **`addEntity` crashed on header-less TEI.** Adding an index entity to a TEI without a `teiHeader` threw an uncaught `TypeError` (the index "Add" button had no try/catch, unlike its siblings). `ensureStandOff` now falls back to anchoring before `<text>`, else inside the document element; `ensureList`/`addEntity` return the document unchanged when nothing can be anchored; and the `onAdd`/`onUpdate`/`onDelete` handlers in `editor-app.js` are wrapped like `linkMention`. Same proof file covers it.
- **The AI-violet marking never rendered, and rounded corners were lost.** `--color-ai`/`--color-ai-tint` and `--radius-sm` were referenced throughout `editor.css` and `index.html` but defined nowhere, so the binding "AI output is always violet" invariant silently failed and every control rendered square. (The 2026-05-30 entry's claim that the `--color-ai` family had been "added" was aspirational: the tokens were referenced, not defined.) Added all three to the `:root` block in `style.css` (`--color-ai: #6D4AB6`, `--color-ai-tint: #F1ECFA`, `--radius-sm: 4px`). Verified live in Chrome: the LLM button and generated banner now compute to `rgb(109, 74, 182)` and the button radius to `4px`.

A follow-up pass in the same session fixed three more confirmed findings: relinking an already-linked mention now retargets the existing `@ref` instead of nesting a second `<name>` (`standoff.js`); the live integrity panel now compares real `@xml:id` values instead of synthetic positional cell ids (new `edition.js` `xmlIdSet` + `editor-app.js`), so a lossless line-emptying edit in an id-less edition (Hersch) no longer raises a false "id lost" alarm; and the invalid Anthropic default model id `claude-sonnet-4-5-20250514` was corrected to `claude-sonnet-4-5-20250929` (`llm.js`).

No regression: sweep 294/294, generic 34/34, editor 13/13, selftest 14/14, harness all PASS, plus the new edit_fidelity 21/21 (entity fidelity, header-less standOff, relink-without-nesting, and xml:id-baseline stability).

Still open (lower-severity, scoped out): zone overlays assume coordinate space equals served-image pixels (latent until a non-ZBZ image source exists); the LLM key is mirrored into `gen.key` and the DOM field; the file-input fallback open path lacks error handling; a zone hover can clear an entity's zone highlight; German comments/class names remain in `style.css`.

## 2026-06-04: First in-browser click-through; two fixes from it

Drove the editor in a real browser (the one check the headless harness cannot perform) against the synthetic Wenzelsbibel: load, surgical word edit, folio navigation, live validation, and the full index lifecycle (add person, link an in-text mention, delete). All confirmed against the serialized output, not just visually: the word edit is a localized splice, the link produces `<w><name ref="#id">...</name></w>`, delete removes the entity cleanly. Two defects surfaced and were fixed:

- **AI-banner shown unconditionally.** The violet "generated by an LLM / unreviewed" banner (`#ed-genbanner`) appeared even with no document and on the deterministic demo. The JS (`markGenerated`) was correct (`hidden` toggled), but the author rule `.ed-genbanner { display: flex }` overrides the user-agent `[hidden] { display: none }` regardless of specificity. Fixed by adding `.ed-genbanner[hidden] { display: none; }` in `editor.css`. The banner now shows only on the LLM on-ramp (`markGenerated(true)`), as `design.md` intends.
- **StandOff inserts forced LF into CRLF files.** `standoff.js` hardcoded `\n` in `ensureStandOff`/`ensureList`/`addEntity`, leaving LF scaffolding inside an otherwise CRLF document. Added a `docNewline(doc)` helper that adopts the document's dominant newline. Not a round-trip violation (only inserted bytes were affected) but now whitespace-consistent.

No round-trip regression: the headless proofs stayed green (sweep 294/294, generic 34/34, editor 13/13, selftest 14/14, harness all PASS).

## 2026-06-02: Editor-only pivot and the facsimile/index layer

Completed the editor-only pivot and added the modules the 2026-05-30 entry had listed as future work. The facsimile pane became a real OpenSeadragon 5.0.1 deep-zoom viewer (plain-image tileSource, IIIF-ready hook) with `<zone>` overlays bidirectionally linked to the reading text (`facsimile.js`). A lossless `<standOff>` model (`standoff.js`) and an index-management UI (`index-panel.js`) added person/org/event entities and in-text mention linking via `<name ref>`, all inside the offset-splice model. A "Load ZBZ example" entry wires the real (rights-encumbered, local-only) Jeanne Hersch edition to exercise the image path. Verified at node/static level; live OpenSeadragon rendering stayed pending until the 2026-06-04 click-through.

## 2026-05-30: Editor-first consolidation and the generic reader

The decisive session. Three things happened: the editor was built, generalised, and the legacy generator was retired.

- **Built the deterministic editor** per the `Idee.md` vision (no LLM in the annotation process): a DOM-free edition core, a three-pane shell (reading text / facsimile / validation), inline cell editing via lossless offset splices, and a facsimile placeholder with zone linking. Proved it headlessly against the offline harness.
- **Generalised it to a generic TEI reader.** Profiling the Nachlass pipelines showed the editor could not stay word-only: the Jeanne Hersch edition (zbz-ocr-tei) is line-level (`<p>` + `<lb facs>`, real zone coordinates, no `<w>`), and SZD (szd-htr) produces only catalog TEI plus Page-JSON. The chosen solution was not per-project profiles but **one generic, offset-true reader** (`tei-document.js`): a small XML tokenizer building a byte-offset tree, schema-free recognizers by local-name, and lossless splice edits. `edition.js` was refactored to project any TEI into folios/lines/cells; the granularity (word vs line) emerges from the document. Proven: 294/294 real files round-trip byte-identically (285 Hersch, 4 SZD, 5 synthetic).
- **Unified the LLM path into the editor.** Per the author's decision ("direkt in den Editor, Stepper weg"), the generation step became an on-ramp: "New from text (LLM)" drafts an initial TEI and opens it in the same editor, marked violet and unreviewed. Added the `--color-ai` token family. The landing page became two cards (editor, LLM on-ramp); the five-step stepper was removed.
- **Retired the legacy Generator.** Deleted the orphaned generator tree (`app.js` and `model/editor.js/tokenizer/preview/source`, `services/{transform,schema,validator,export}`, `utils/dom`, `pipeline/*`, `docs/tests/*`), the generator demo data and the `dtabf.json` profile (~3000 lines; recoverable from git). Retained `llm.js`, `storage.js` and a trimmed `constants.js`, used by the editor. At this point `docs/js` was six live files; the 2026-06-02 facsimile/index work below added three more, so the current count is nine.
- **Corrected an earlier mis-claim:** `transform.js` was not broken (it assembles its prompt inline; it did not import a missing `prompt.js`). It was deleted as legacy, not as faulty.
- **Refactored the knowledge base** from the "two equal paths" framing to editor-first, generic-reader reality, condensing each document to verified facts (version 0.4).

## 2026-05-27: Knowledge base refactor

- Reactivated the knowledge base from the dormant April state; replaced the four consolidated documents (OVERVIEW, ARCHITECTURE, DEVELOPMENT, REFERENCE) with the function-separated Promptotyping set (INDEX, project, data, specification, user-stories, architecture, design, journal).
- Pulled design and UI lessons from sibling projects: expert-in-the-loop and categorical confidence from coOCR, single-source design tokens from the zbz Hersch system, facsimile-synopsis patterns from the SuGW frontend. (Note: this set still described two equal paths and a CodeMirror/DocumentModel architecture; the 2026-05-30 session corrected both to the as-built editor-first reality.)

## 2026-02-18: Demo data, reference, strategy (Sessions 10 to 16)

- Walking-skeleton-first strategy adopted after a market analysis found no tool combining TEI annotation, LLM assistance and human review.
- Real demo sources added (CoReMA recipe, DEPCHA ledger); LLM providers extended to six with a model catalogue. (The demo data and the stepper they fed were removed in the 2026-05-30 consolidation.)

## 2026-02-05: Foundation (Sessions 1 to 9)

- Project start: `docs/` for the GitHub Pages prototype, `knowledge/` for the knowledge base.
- Built the first UI prototype: a three-column layout and a five-step workflow (Import, Mapping, Transform, Validate, Export) plus a review concept, an XML tokenizer, a reactive document model with snapshot undo, a multi-provider LLM service, three-layer prompt assembly, multi-level validation, export. This prototype was the exploration that the 2026-05-30 editor-first build replaced.

## Origin: FORGE 2023

The LLM-to-TEI idea originates in the FORGE 2023 prototype, conversion of unstructured text to TEI-XML via GPT on the Schuchardt correspondence (Pollin, Steiner & Zach 2023, https://doi.org/10.5281/zenodo.8425163).

## Related

- [specification](specification.md) for the decisions referenced here
- [architecture](architecture.md) for the current implementation
- [testing](testing.md) for the proofs
