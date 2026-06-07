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
updated: 2026-06-07
language: en
version: 0.4
related: [project, specification, architecture, testing]
---

# teiCrafter Development Journal

Chronological log, most recent first. A condensed narrative of how the tool and its decisions came about; commits live in Git history.

## 2026-06-07: Editopia coordination, plan synthesis, three built milestones

An orchestration and planning session. teiCrafter is framed as the third Promptotyping case in the Editopia talk (the tool case), alongside the SZD and ZBZ/Hersch input pipelines; CC1 (this repo) orchestrates CC2 (szd-htr) and CC3 (zbz-ocr-tei) through the project lead as the channel. The full, self-contained plan and resume point is `knowledge/project-plan.md` (section 15 next steps, section 16 assignments, section 17 acceptance); the milestone register is `goals.md`.

Decisions (with the project lead): the end product is the whole project (all three implementations plus the slide text plus the full paper text plus all knowledge documents). Normdata reaches an entity by three layered paths on one `@ref`/`<idno>` mechanism: hand entry (the foundation, buildable now), an offline Gemini 3.1 Flash Lite batch proposal (M3.7), and an in-browser live lookup. Gemini is used only for annotation proposals, never for the Page-JSON to TEI conversion, which stays deterministic. Demo objects: o_szd.1079 (SZD) and one of docs 1000/1330/1540/2310 (ZBZ, the only ones with committed images). EditionCrafter v0, not teiCrafter, is the Editopia Hersch demonstrator.

Built this session (additive, lossless; new proof `node test/tools/szd_demo_check.mjs`, the three fixed proofs stay green): M2.2 image engine side (`readSurfaces` reads `<graphic url>`, `renderFacsimile` falls back to `surface.graphic`), M3.1 place entity (`standoff.js`/`index-panel.js`), M3.4 mention linking (type-independent). Open: the browser-visual test that the GAMS image renders in OpenSeadragon (CORS), and M3.3 normdata `@ref` (now unblocked).

On-disk audit corrected the plan: `pipeline.mjs` is not deleted but a non-runnable torso (it imports the deleted `docs/js/pipeline/`); the SZD converter prototype lived in `c:\tmp` (fragile, unversioned) and was versioned into `test/tools/szd-pagejson-to-tei.mjs`; the zone bbox unit is open (the prototype assumes percent, an on-disk reading suggests absolute, and the byte round-trip proof does not adjudicate geometry), so CC2 confirms it in its reality report.

Verification approach for the goals: the Promptotyping cascade (automatic, contextual, visual, professional), with user-story walkthroughs on real data in the browser as the centerpiece; written up in `testing.md` ("Verifying the Project Goals"). Knowledge docs updated this session: `project-plan.md` (rewritten plus sections 16/17 and the audit corrections), `goals.md` (H1 to H7, framing, M3.x statuses), `testing.md` (acceptance cascade), `integration.md` (H5 to H7), `cc1-session-report.md` (reconciled).

Next: CC1 drafts `converter-reference.md` (M1.2) and builds the M3.3 hand-entry core; CC2 returns the SZD reality report including the bbox unit, then builds `pipeline/export_tei.py`; CC3 delivers the ZBZ image-URL scheme, a demo-object recommendation, the render check, and the oekosystem-synthese correction.

## 2026-06-04: Multi-agent audit and four confirmed-defect fixes

Ran an adversarial multi-agent audit of the whole tool (code quality across seven dimensions plus spec-completeness, every finding independently re-verified, several empirically against the running engine and the live editor). It raised 23 findings; 15 survived verification, 8 were refuted, notably all four "key-leak" claims (the Gemini `?key=` URL is TLS-encrypted on a `fetch`, not a navigation; the CR/LF header-injection is already blocked by `setApiKey`'s validator). The lossless and security core held under pressure. Four confirmed defects were fixed this session:

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
