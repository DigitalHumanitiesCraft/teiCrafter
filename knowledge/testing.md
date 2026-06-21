---
title: teiCrafter Testing and Evaluation Harness
project:
  name: teiCrafter
  repository: https://github.com/DigitalHumanitiesCraft/teiCrafter
method:
  name: Promptotyping
  url: https://lisa.gerda-henkel-stiftung.de/digitale_geschichte_pollin
template:
  name: Vorlage Testing
  version: 0.1
  url: https://dhcraft.org/Promptotyping/promptotyping-document/testing
status: active
created: 2026-05-30
updated: 2026-06-21
language: en
version: 0.16
topics: ["[[Software Testing]]", "[[Evaluation]]", "[[TEI XML]]"]
related: [architecture, specification, data]
---

# teiCrafter Testing and Evaluation Harness

Testing-first. The measuring stick is built before the features it judges. Two layers: headless proofs of the editor engine (Node, the same DOM-free modules the browser runs), and a validation harness for TEI fidelity (Node + Python/lxml). Both are deterministic and run outside the browser. The one thing they cannot check is the browser click-through of the UI.

The regression gate is one command: `node test/tools/run_all.mjs` discovers every `*_check.mjs` and `*roundtrip*` proof plus the sweeps (generators excluded), runs them sequentially with per-script PASS/FAIL and duration, and exits non-zero on any failure. A new proof file is picked up automatically. The Python/lxml fixture validator (`test/harness/run.mjs`) stays separate (different dependency set).

## Engine Proofs (the central claim)

The promise is "read arbitrary TEI and save it byte-losslessly". These prove it directly against real data:

| Proof | What it asserts | Result |
|-------|-----------------|--------|
| `test/tools/roundtrip_sweep.mjs` | Every real TEI file tokenizes contiguously and `serialize()` is byte-identical to the input | all byte-identical |
| `test/tools/generic_roundtrip.mjs` | One engine reads Hersch (line-level), Wenzelsbibel (word-level) and SZD (catalog); recognizers find pb/lb/zones; a cell edit is a surgical splice; the editor model shape is correct | all checks pass |
| `test/tools/editor_roundtrip.mjs` | The editor edition-core API: identity round-trip is byte-identical; a word edit is surgical; the harness localizes exactly that change | PASS |
| `test/tools/edit_fidelity.mjs` | Edits stay byte-faithful over character/entity references (a no-op edit of a cell or attribute holding `&nbsp;`/`&#233;`/`&quot;`/`&apos;` is byte-identical, a real edit preserves a neighbouring entity); `addEntity` degrades gracefully on header-less or element-free TEI; relinking a mention retargets `@ref` without nesting `<name>`; the integrity baseline tracks real `@xml:id`, stable across a lossless line-emptying edit | PASS |
| `test/tools/reading_contract_check.mjs` | Two stated reading-contract properties: `serialize()` is byte-identical even on not-well-formed input (lossless unconditionally) while the projection's ancestor walk may diverge on mis-nested markup (the live DOMParser check is the separate safety net); and the editing profile is one global property, a single `<w>` anywhere sets the whole document to word and a `<w>`-free folio within it stays whole-line cells | PASS |

The sweep reads directly from the source repos (nothing copied or committed) plus the committed synthetic fixtures; override the source dirs with `HERSCH_DIR` / `SZD_DIR`.

## Feature Proofs (per milestone)

Each demo-critical feature added since the core engine proofs carries its own headless proof, named by milestone. Where the live part is a network call (authority lookup, AI suggestion), the proof covers the deterministic part (URL building, response parsing, the marking/gating engine) and the fetch itself is browser-verified.

| Proof | What it asserts | Result |
|-------|-----------------|--------|
| `test/tools/szd_demo_check.mjs` | The SZD demo path on a built line-level TEI: round-trip byte-identical, line-level editor model, `surface.graphic` read from `<graphic url>` (M2.2), `readEntities` surfaces a place and a person's GND idno, `addEntity`/`linkMention`/`setAuthority` for place and work round-trip and read back losslessly | PASS |
| `test/tools/authority_lookup_check.mjs` | The authority lookup service (`docs/js/services/authority-lookup.js`) builds correct query URLs for Wikidata, GND, GeoNames and parses each register's real response shape into uniform `[{ id, label, description }]` (M3.3); and `recordUrl` resolves an attached id to its public register record (GND d-nb.info, Wikidata wiki, GeoNames), trims the value, passes an existing http(s) URI through unchanged, and returns null for an unknown register or empty value | PASS |
| `test/tools/note_create_check.mjs` | Editorial notes (M3.5) are created losslessly and target a stable `@target`, resolved in order: nearest ancestor `xml:id`, line `@facs` zone id, or a freshly injected `xml:id`; `standoff.noteIndex` (the reader the editor uses) finds them | PASS |
| `test/tools/note_index_check.mjs` | `standoff.noteIndex` reads notes by tree walk, not regex: single- AND double-quoted `@target` (the former regex reader missed single quotes), multi-id targets, child markup in the body (tags fall away, text stays), entity decoding, notes without `@target` skipped | PASS |
| `test/tools/commit_invariants_check.mjs` | `standoff.applyMutation` (the DOM-free core of the editor's single mutation path) holds for every mutating op: a real change reports `changed` true, re-parses byte-identically and rebuilds the note index without throwing; an idempotent repeat reports `changed` false with the SAME doc carried through; a multi-step sequence stays consistent | PASS |
| `test/tools/attr_edit_check.mjs` | Generic attribute editing on a cell's innermost wrapping element (engine `addAttr`/`editAttrValue`/`removeAttr`): every edit is an exact offset splice, no-op-safe, the inserted value XML-escaped, reversible, and targeted by exact qname so `xml:id` and `id` stay distinct | PASS |
| `test/tools/slugify_check.mjs` | `slugify` (the seed for every generated `xml:id`: entity ids from a name, split-sibling line ids) yields an NCName-safe fragment or `""`: no run of two or more separators (`.`/`-`/`_`) survives, a single internal separator is kept, empty/whitespace/null/undefined give `""`, a leading digit gets an underscore prefix, diacritics fold to base letters, and `slugify` is idempotent | PASS |
| `test/tools/guidelines_check.mjs` | The TEI Guidelines reader (`tei-guidelines.js`) answers the authoring questions offline against the vendored compilation: pinned module count, persName resolves RECURSIVELY to its pinned attribute count incl. `@facs` from the nested class (the recursion proof), dedup, module/scope filters with silent skips, tag stripping, malformed input rejected, no `validate` export, pinned version reported | PASS |
| `test/tools/ai_proposal_check.mjs` | AI-proposed entities (M3.7) carry a lossless `resp="#ai"` marker, read as unverified, and the human gate works: confirm drops the marker, reject removes the entity, every step round-trips byte-identically | PASS |
| `test/tools/ai_suggest_parse_check.mjs` | The LLM reply parser (`docs/js/editor/ai-suggest.js`) tolerates a code fence and prose, normalises free-form type labels to the teiCrafter types, drops malformed/unknown items, de-duplicates, and never throws (the generalized parser still reads legacy entity-only items) | PASS |
| `test/tools/llm_gate_check.mjs` | The single LLM capability gate `llmEnabled()`: a boolean that follows the build flag when no preference is set, the runtime preference switches AI off even when the build allows it, only an explicit `false` disables (a corrupt value falls back to the build flag). localStorage stubbed so both paths run headlessly | PASS |
| `test/tools/llm_prompt_check.mjs` | The pure generation-prompt assembler (`llm-prompt.js`): composes [system prompt] [task] [mapping] [source text] in order, omits empty (and whitespace-only) parts, carries the source verbatim; `extractXml` pulls the payload from a fenced or bare reply, null when none | PASS |
| `test/tools/llm_config_check.mjs` | The manifest `llm` block: type-aware resolution (`llmForFile`: a `documentTypes[]` override wins per field over the project default), `mappingFiles` lists referenced files de-duplicated, absent normalizes to null, and malformed blocks are rejected with precise (type-pathed) messages | PASS |
| `test/tools/provenance_check.mjs` | The unified AI-provenance layer: the cell projection exposes each layer's `@resp`, `markCritical`/`addNote` carry an optional resp marker byte-faithfully (reversible; human ops unmarked), and `ensureRespStmt` makes `#ai` a non-dangling pointer (idempotent, degrades without a titleStmt) | PASS |
| `test/tools/proposal_apply_check.mjs` | The general proposal pipeline (`ai-suggest` parse + `proposal-apply`): a mixed-kind reply parses, each proposal is located by its surface text and applied as a lossless, resp-marked construct, the reading text is preserved and the round-trip is byte-identical, unlocatable spans are reported, and every applied construct projects as AI | PASS |
| `test/tools/proposal_review_check.mjs` | Per-construct confirm/reject (`proposal-review.js`), the human gate generalised beyond the entity: confirm drops `@resp` keeping the construct and the reading text; reject unwraps a wrapper to restore the exact bytes (the inverse of apply for the entity and criticism wraps), removes a standOff `<note>` with no reading-text shift, and removes a `<gap/>`; the AI guard refuses human markup (no `#ai`) unless an explicit `resp: null` overrides; null-element and no-op safety | PASS |
| `test/tools/inline_gnd_check.mjs` | The inline-GND export (`inline-gnd.js toInlineGND`) on a synthetic register fixture exercising every branch: a person/org/work mention becomes its typed element with `@ref="GND:<value>"` when the entity has a GND idno and the typed element with no `@ref` otherwise; a place mention, a mention to a missing entity, and a `<name>` with no `#`-ref unwrap to plain text; the `<standOff>` is removed and a respStmt `<name>` is untouched; every emitted `@ref` matches `GND:[0-9A-Za-z-]+`, the reading text is byte-identical, the output re-parses, and a second pass is a SAME-doc no-op | PASS |
| `test/tools/inline_gnd_schema_check.mjs` | The project goal measured directly: a REAL unannotated pipeline file (`<id>_final.xml`, already RNG-valid) is annotated in the register model through the proven engine (`addEntity`/`setAuthority`/`linkMention`), exported with `toInlineGND`, and the export is well-formed, RNG-valid against the real `data/schema/zbz_hersch.rng` (lxml harness, zero errors), reading text byte-identical, the three GND pointers present inline. Sibling- and lxml-gated, SKIPs cleanly when the rights-restricted objects, the schema or lxml are absent | PASS (or SKIP) |
| `test/tools/whitespace_edit_check.mjs` | A line-level cell edit preserves the text node's edge whitespace (indentation, newlines), so correcting one line never collapses the surrounding formatting; a raw-node edit path is kept as a failing control | PASS |
| `test/tools/mention_projection_check.mjs` | The M2.5 mention projection (`cell.mention`) is a pure read layer: after `addEntity` + `linkMention` the linked cell exposes the entity id, neighbours and gap cells stay `null`, offsets still address the exact reading text, a dangling `ref` still projects, a header `<name>` never leaks into reading cells, and every round-trip stays byte-identical. Also proves projection/mutation agreement (relinking a critically-wrapped mention retargets the enclosing `<name>`, never nests; same-entity relink is a SAME-doc no-op) and the M2.8 selection annotation: `rawRangeForDisplay` maps display offsets to exact raw bytes (including across entity references), `linkMentionRange` is a pure insertion around the selected bytes (full reconstruction), the line splits and the selected words project the mention, and a sub-range inside an existing `<name>` is refused. M2.10 ops: link -> `unwrapMention` restores the exact pre-link bytes (no-op outside a `<name>`), and `wrapRange` applies arbitrary TEI markup (structured persName) while refusing any build that loses reading text | PASS |
| `test/tools/source_highlight_check.mjs` | The source-view highlighter (M2.12, `highlightXml`) is a pure, lossless presentation layer: stripping the token spans and decoding the three HTML escapes reproduces the input byte-for-byte, for well-formed XML, mid-edit fragments (unterminated comment/tag/quote) and the real o_szd.1079; the token classes actually appear and no source angle bracket survives unescaped | PASS |
| `test/tools/wb_codex_check.mjs` | The Wenzelsbibel load path (WB-AP1) and the project-profile IIIF resolver (WB-AP2) on the REAL codex (read from the local licence-restricted data folder, override `WB_CODEX`; SKIPs cleanly when absent so the repo regression never depends on uncommittable data): the full codex parses word-level into 480 folios (timed, threshold 15 s), the no-op save is byte-identical, the profile is detected from the `o:wen.*` PID, every surface `<graphic url>` resolves to the ÖNB IIIF `info.json` URL, and ALL Transkribus `@points`-only zones get a derived bounding box that lies inside its surface. Plus codex-free unit cases for PID reading and resolver edge cases (absolute URLs and path-ish urls left alone) | PASS |
| `test/tools/project_manifest_check.mjs` | The declarative project manifest (`docs/js/editor/project-manifest.js`): `parseManifest` parses, validates and normalizes a `teicrafter.project.json` into the runtime project shape, `documentTypes`/`files` bind a file to its type and resolve its markup inventory (`typeForFile`/`markupForFile`), the TEI scope (`teiModules`/`teiElements`) parses with positional error messages and resolves per file (`teiScopeForFile`), `resolveMarkup` derives wraps ONLY from `teiElements` with explicit-markup precedence and proves the degradation contract (null guidelines yields exactly the explicit list), the IIIF image resolver reaches parity with the built-in PID profile, the produced markup wraps splice losslessly through `wrapRange`, malformed manifests are rejected with precise messages, the `reconciliation` opt-in parses with defaults and rejections, and a wrap's `attrField` injects its escaped attribute only for a non-empty value (byte-equality without one) | PASS |
| `test/tools/plaintext_import_check.mjs` | The deterministic plaintext intake's page-break rule: `\|N\|` becomes `<pb n="N"/>` (standalone, mid-line, multiple per line, one bordering space dropped), non-markers stay verbatim, escaping holds around markers, marker-free input is byte-identical to the historical shape, every produced TEI round-trips byte-identically, and the real `hsa-7711` letter parses to two folios | PASS |
| `test/tools/draft_recovery_check.mjs` | The unsaved-draft recovery slot (`draft-recovery.js`, stubbed storage): save/load round-trips the raw byte-identically (multibyte, CRLF), an empty or corrupt slot yields null (corrupt self-clears), the size guard refuses over 4M chars, clear empties, and a throwing storage yields false instead of throwing | PASS |
| `test/tools/project_case_check.mjs` | The operator's acceptance case headless: one project folder (one TEI, two plaintexts). A `.txt` opens as deterministic line-level TEI via `plaintext-import.js` (paragraphs on blank lines, `<lb/>` per line, text XML-escaped and otherwise verbatim, CRLF treated as a line break not content), the same input always yields the same output, type-bound markup wraps splice losslessly, and the edited draft round-trips byte-faithfully (the diff is exactly the edit) | PASS |
| `test/tools/depcha_demo_check.mjs` | The DEPCHA Wheaton demo project (an "Open project folder" use case): the committed manifest parses, types both volumes as `account` and binds the bookkeeping markup inventory (the `bk:` money and date descriptors); when the gitignored TEI is present (materialize via `make_depcha_demo.mjs`) both volumes serialize byte-identical, carry `<measure>` and read line-level into folios. SKIPs the content checks cleanly when the local-only data is absent | PASS |
| `test/tools/criticism_check.mjs` | Textual-critical markup (M3.6, done, commit 119a1a2): `<unclear>`/`<del>`/`<add>` wrap a node's core with edge whitespace kept outside, `<gap/>` replaces the core, `unwrapCritical` refuses to strip a shared wrapper, every mutation covers every byte and reverses byte-exact | PASS |
| `test/tools/dual_reading_check.mjs` | Dual reading (F4): the atomic `editTextAndAttrs`/`editCellReadings` edit is byte-faithful by full reconstruction, `@orig` is kept in sync with the diplomatic core and never invented where absent, `@norm` adds on a non-empty value and removes on `""`, the op refuses element children (a critically-wrapped word) so it cannot half-apply, and the normalized projection reads correctly; a real-codex guard runs when the local codex is present and skips silently otherwise. Synthetic fixture `test/fixtures-synthetic/wb-dual-reading.xml` | PASS |
| `test/tools/overlap_layers_check.mjs` | Overlapping/nested annotations (`cell.layers`): the read-only projection lists every inline annotation element wrapping a cell, innermost-first, up to the reading-unit boundary; structural blocks, milestones and `<w>` are skipped; kinds (mention/critical/markup), `@ref` hash-stripping, order and the empty case are correct; the existing `mention`/`crit` fields stay unchanged and the round-trip is byte-identical | PASS |
| `test/tools/szd_worked_example.mjs` | M7.2 worked example: the real CC-BY `o_szd.1079` taken open -> correct (an HTR "Gerichte" -> "Gedichte" fix, proven a single-byte surgical splice by full reconstruction) -> annotate (person/place/work + GND/GeoNames/Wikidata authorities + a Wien mention, scaffolding a `<standOff>` where none existed) -> textual criticism (`<unclear>` wrap, `<gap/>` replace on folio 3) -> save, every step a byte-faithful splice and the final raw idempotent; gates to SKIP if the CC-BY fixture is absent | PASS |
| `test/tools/zbz_worked_example.mjs` | M7.2 worked example, ZBZ half: the real ZBZ doc 1000 taken open -> correct (the OCR "inadaption" -> "inadaptation" fix, proven a two-byte surgical insertion by full reconstruction) -> annotate (Hersch GND 118815679 / Geneve Wikidata Q71 + GeoNames 7285902 / a work, scaffolding a `<standOff>` where none existed) -> mention link -> textual criticism (`<unclear>` wrap, `<gap/>` replace) -> save, every step a byte-faithful splice, all 4 surfaces carrying a GitHub-Pages `<graphic url>`; gates: local file, else built in memory from the zbz sibling via `make_zbz1000_demo.mjs`, else SKIP | PASS |
| `test/tools/make_curated_set.mjs` | M7.4 curated example set: registry-driven generator that applies the proven worked-example curation arcs through the real engine and persists before/after/diff/summary per object under gitignored `output/curated-set/` plus the `SET.md` overview; verifies per object that the before round-trips byte-identically, the after is idempotent and keeps its folio model, and a `<standOff>` exists; registry entries pending operator sign-off are listed, not generated; SKIPs an absent rights-encumbered source | PASS |
| `test/tools/structural_check.mjs` | The Author-mode structural primitives (`docs/js/editor/structural.js`): `splitElement` at a caret yields two elements with ids preserved or regenerated, `mergeElements` joins adjacent elements, `insertLb` inserts a line-break milestone that reproduces an existing `<lb>`'s spacing and self-closing convention rather than a hardcoded form, `deleteElement` removes an empty element and refuses a non-empty one; every op is a byte-faithful offset splice | PASS |
| `test/tools/author_caret_check.mjs` | The pure half of the Structure context-menu actions: `cellRawOffset` (`edition.js`) maps a caret offset in a cell's displayed text to an absolute raw offset in `doc.raw`, correct across entity references and in-cell markup, and the returned offset is a real raw boundary that `splitElement`/`insertLb` act on for the intended byte change; a negative, non-integer or out-of-range offset yields null. The DOM half (caret point to a node/offset pair) is browser-only | PASS |
| `test/tools/index_consumer_check.mjs` | The index panel renders its sections from the document's declared manifest indices, not a hardcoded list (`sectionsForIndices`): declared indices produce exactly those sections in declaration order with the manifest's own labels, a non-mappable index (no editable entity type in the editor, e.g. a Wenzelsbibel peoples index) stays VISIBLE as a read-only section with its add control disabled rather than dropped, no declared indices falls back to the built-in defaults, and `parseManifest` feeds the consumer end to end. A minimal DOM stub, no browser | PASS |
| `test/tools/facsimile_resolver_check.mjs` | The facsimile resolver chain (W7): `parseManifest` accepts the `iiif-presentation` image-resolver type and carries its manifest URL, keeps `iiif-image-template`, rejects `mets` with a precise deferral message and rejects genuinely unknown types; `parseIiifPresentationManifest` returns the page image url and canvas size for synthetic Presentation API v2 AND v3 manifests; `coordScale` scales a zone rect by a declared canvas-vs-image factor and is exactly 1 for equal or unknown sizes (the no-op the template path relies on). Synthetic fixtures, no fetch | PASS |
| `test/tools/llm_catalog_check.mjs` | The Anthropic model catalog in `services/llm.js` is current and self-consistent: the default is a member of the list, the retired dated id is gone, no dated snapshot suffix survives, `getProviderConfigs()` exposes the same default and list, and `pickModel` sends the stored model only when the provider still lists it, so a retired, unknown or null stored id falls back to the provider default and never reaches the API | PASS |
| `test/tools/hersch_loadability.mjs` | Editor-projection sweep (Layer 2, `parseEdition`) over the full Hersch corpus: every real file yields a usable editor view (folios, editable cells, real reading text), not merely a byte round-trip; writes a JSON anomaly report | sweep, anomalies reported |
| `test/tools/szd_loadability_sweep.mjs` | M1.5: converts the whole szd-htr corpus via `pipeline/export_tei.py --all`, then verifies every converted TEI loads line-level and round-trips byte-identically; empty (`pages: []`) and all-blank objects legitimately yield `cells === 0` and still round-trip | sweep, all clean |
| `test/tools/port_parity.mjs` | M1.3: `pipeline/export_tei.py` produces byte-identical output to the reference prototype `szd-pagejson-to-tei.mjs` over the SZD demo handful; a missing input (e.g. the upstream-deduped o_szd.161/korrespondenzen) is skipped, not failed | PASS |
| `test/tools/szd-pagejson-to-tei.mjs` | Reference prototype (spec-by-example): one real SZD Page-JSON to teiCrafter-target TEI, verified against the engine before exit; the executable porting target for `pipeline/export_tei.py` | self-verifying prototype |

## Frontend-verification floor

The engine proofs are byte-true but structurally blind to the DOM, event and timing layer: a real selection-popover bug was found by hand after the gate was green. The floor that answers that gap has three tiers, the first two automated here.

| Proof | What it asserts | Result |
|-------|-----------------|--------|
| `test/tools/interaction_check.mjs` | The selection-popover dismissal logic as a PURE predicate (`shouldDismissPopover`, imported from `docs/js/editor/interaction-rules.js`, the same module the deferred mouseup handler uses, so the proof and the handler cannot drift): a late stale collapsed mouseup never dismisses a freshly reopened popover (the identity guard), an unchanged-identity collapsed click does dismiss, a drag range never tears down on the same gesture. Timing-dependent re-entry that cannot be reduced to a pure predicate is named, not dropped, as `# manual:` lines pointing at `test/acceptance/BROWSER-CHECKS.md` | PASS |
| `test/tools/types_check.mjs` | A typing seam over the engine parser module (`tei-document.js`): runs `tsc --noEmit` under `jsconfig.json` (checkJs) to read the module's JSDoc types. The parser now typechecks clean, so the seam PASSES; a missing toolchain or residual structural-inference diagnostics are recorded and SKIPped (a SKIP-with-reason counts as a pass), never failing the gate | PASS |

The third tier is the named manual browser checks themselves: `test/acceptance/BROWSER-CHECKS.md` lists every browser-only path (the timing-dependent re-entry surfaces and the visual acceptance scenarios) as a check that is run and dated, never silently skipped. The standing structural reason the floor is needed: the un-exported integrator (`editor-app.js`) wires the whole UI, so any feature that touches it re-runs the affected manual checks.

## Evaluating LLM output (designed; built after the UI walk)

The LLM-assistance layer is evaluated in tiers, only the deterministic one in the gate today (operator decision: exercise the UI before building the offline harness). The design, so the whole picture is on record:

- **Deterministic gate proofs (built, in `run_all`):** prompt assembly, the manifest `llm` parse and resolution, the mapping ingest, the generalized proposal parser, the provenance round-trip, the proposal apply (lossless, byte-faithful), and the capability gate. These are the parts that are deterministic and reproducible.
- **Model-output scoring (offline, deferred):** run a model on gold inputs and score the output with the validator below: L1 text fidelity (did the model preserve every character), L2 schema validity, L3 structural counts, plus annotation precision/recall against a gold annotation set. Gold targets are the committed CC-BY `o_szd.1079` (an edition) plus type-diverse samples (a dictionary, a corpus), so the eval is not edition-only either. Model non-determinism is handled by running N samples and reporting distributions; only the deterministic scoring and the gold are reproducible, not the model outputs.
- **Model-as-judge (optional, deferred):** a judge model rates editorial appropriateness against the project mapping; reported, adversarial, never gating.
- **Visual / professional (the operative gate):** the browser walk per document type (propose on a page, confirm/reject, save, verify the confirmed constructs are correct TEI and the rejected ones leave no trace) and domain-expert sign-off.

## Validation Harness: the Three Levels

| Level | What it checks | Engine |
|-------|----------------|--------|
| L1 text/word fidelity | Every `<w>` text node preserved in order; first divergence, lost and added words reported | Python tokenizer over the parsed tree (difflib) |
| L2 schema validity | TEI All RelaxNG plus the project Schematron | lxml `RelaxNG` (`tei_all.rng`) and `lxml.isoschematron` |
| L3 structural invariants | Counts of surface/zone/standOff/note/w/lb/l/pb, namespace integrity, pointer (`@facs`, `@corresp`, `@target`) integrity | Python over the parsed tree |

## MVP Gate

Well-formed AND L1 pass AND L3 counts preserved. L2 is always reported but does not gate: on a round-trip it counts only NEW errors against the input error count, so a document carrying its own pre-existing TEI All deviations is not penalised. A clean identity round-trip shows zero new RelaxNG errors even when the input itself is not TEI All clean.

## Synthetic Fixtures

Committed under `test/fixtures-synthetic/`. Every tier validates clean against TEI All (0 RNG errors), and in every case the identity round-trip introduces 0 new errors.

| Fixture | Words | Verdict | Score | L1 | L3 counts | Schematron | RNG errors |
|---------|-------|---------|-------|----|-----------|------------|------------|
| wb-synthetic-folio | 12 | pass | 100 | pass | preserved | valid | 0 |
| tier1-1folio | 24 | pass | 100 | pass | preserved | valid | 0 |
| tier2-5folio | 120 | pass | 100 | pass | preserved | valid | 0 |
| tier3-20folio | 480 | pass | 100 | pass | preserved | valid | 0 |

## Generality on Real TEI

The harness gates on text and structure fidelity and surfaces, without failing, each file's own pre-existing TEI All deviations. Real Hersch and SZD files round-trip with 0 new errors; line-level files (no `<w>`) meet L1 trivially; dangling `@facs` to external facsimile files are reported as non-gating diagnostics.

## Verifying the Project Goals (Acceptance)

The verification methods are complementary, not alternatives: each answers a different question and catches a different failure. Together they are the Promptotyping verification cascade (automatic, contextual, visual, professional). Real data is the rule at every level; synthetic material exists only for the Wenzelsbibel licence boundary.

| Question | Method | Level | Proof |
|----------|--------|-------|-------|
| Was everything processed? | Coverage sweep over the whole corpus | automatic | the whole corpus loads and round-trips, every SZD demo file converts (counts in the run output) |
| Is the output valid TEI? | Well-formedness + schema (TEI All RNG + Schematron; ZBZ also `zbz_hersch.rng`) | automatic | L2, green/red |
| Is nothing lost, and is the only change the intended one? | Round-trip byte-identity + L1 text + L3 counts + diff-is-exactly-intent | contextual | byte-identical (`roundtrip_sweep.mjs`, `edit_fidelity.mjs`) |
| Does the intended use actually work for a human? | Walk each demo-critical acceptance scenario as a concrete path in the browser on a real object | visual | observed; the part headless tests cannot cover (the Browser-check scenarios in [specification](specification.md)) |
| Is it correct as an edition? | Domain-expert review of the content | professional | expert sign-off (both corpora are currently unreviewed) |

The visual level is the centerpiece for "did we reach the goal in our sense". The success criterion (open, correct line by line, annotate person/place/work with authority ids, save byte-faithfully) is the chain of acceptance scenarios E.1 to E.5, F.1, F.2 and I.1 to I.4 (all built), plus FU.4 (the in-editor pre-open Page-JSON conversion) and a future text-anchored re-entry of the AI-proposal step (M3.7, UI removed in M2.11). Each demo-critical feature is verified twice: a headless proof added to the engine harness above, and a browser path walked on the real demo object (o_szd.1079 for SZD; one of docs 1000 / 1330 / 1540 / 2310 for ZBZ).

The visual level is run as six yes/no frontend checks per demo object, the success criterion made concrete:

1. Open: folios (or lines) are visible.
2. Image: the facsimile is visible and a zone highlights the right line.
3. Correct: an edited line stays edited.
4. Annotate: a person, place or work carries its authority id.
5. AI suggestion (M3.7): the proposal shows violet, then normal after confirmation.
6. Save: the file reopens identical except for the deliberate changes.

Twelve visual checks (the six on each of the two demo objects) plus the machine test commands listed under How to Run are the tool acceptance. Every demo-critical feature is proven twice: a headless proof in the harness AND a browser path on the real object.

Documentation is itself part of acceptance: the per-fixture JSON reports and the knowledge vaults let a reviewer trace every claim, which is the paper's reproducibility requirement. This document is the home of the acceptance method (the goal-to-proof-to-green/red cascade above); the machine commands are under How to Run, and the implementation status of each milestone is in [architecture.md](architecture.md).

## Components

- `test/harness/validate.py`: the validator (L1, L2 via lxml, L3), JSON report.
- `test/harness/run.mjs`: orchestrator over every fixture.
- `test/harness/selftest.mjs`: negative test (identity passes, corruption fails).
- `test/tools/roundtrip_sweep.mjs`, `generic_roundtrip.mjs`, `editor_roundtrip.mjs`, `edit_fidelity.mjs`, `reading_contract_check.mjs`: the engine proofs above.
- `test/tools/run_all.mjs`: the aggregate regression gate (glob-discovered proofs, sequential, exit 1 on any failure).
- `test/tools/szd_demo_check.mjs`, `authority_lookup_check.mjs`, `note_create_check.mjs`, `note_index_check.mjs`, `commit_invariants_check.mjs`, `guidelines_check.mjs`, `attr_edit_check.mjs`, `ai_proposal_check.mjs`, `ai_suggest_parse_check.mjs`, `whitespace_edit_check.mjs`, `criticism_check.mjs`, `project_manifest_check.mjs`, `project_case_check.mjs`, `depcha_demo_check.mjs`, `dual_reading_check.mjs`, `structural_check.mjs`, `author_caret_check.mjs`, `index_consumer_check.mjs`, `facsimile_resolver_check.mjs`, `llm_catalog_check.mjs`, `slugify_check.mjs`, `szd_worked_example.mjs`, `zbz_worked_example.mjs`: the per-milestone feature proofs above.
- `test/tools/interaction_check.mjs`, `types_check.mjs`: the frontend-verification floor (the pure popover-dismiss predicate and the engine typing seam), paired with the named manual checks in `test/acceptance/BROWSER-CHECKS.md`.
- `test/tools/make_zbz1000_demo.mjs`: materializes the local-only ZBZ worked-example object (doc 1000 plus deterministic `<graphic url>` injection, M2.4 scheme) from the zbz sibling checkout.
- `test/tools/make_depcha_demo.mjs`: materializes the local-only DEPCHA Wheaton demo project (two day-book volumes) by fetching the unchanged TEI from the public DEPCHA repository.
- `test/tools/make_curated_set.mjs`: M7.4 curated example set generator (before/after/diff/summary per object under `output/curated-set/`).
- `test/tools/hersch_loadability.mjs`, `szd_loadability_sweep.mjs`, `port_parity.mjs`, `szd-pagejson-to-tei.mjs`: corpus loadability sweeps and the SZD converter parity/prototype.
- `test/tools/gen_synthetic_codex.py`, `extract_folio.py`: synthetic generation and folio slicing.
- `test/schemas/tei_all.rng`: TEI All RelaxNG (gitignored).
- `test/reports/<id>/report.json`: per-fixture report (wellFormed, L1, L2 with newErrorsVsInput, L3 with deltas, verdict, score).

## Licence Boundary

Real third-party files live only under the gitignored `test/fixtures/` and never enter version control; the rights status of each fixture is in [data](data.md).

## How to Run

```
node test/tools/run_all.mjs # THE regression gate: every proof below in one run (--list, name filter)
node test/tools/roundtrip_sweep.mjs # byte-identical (reads source repos)
node test/tools/generic_roundtrip.mjs # one engine over Hersch / WB / SZD
node test/tools/editor_roundtrip.mjs # editor core vs harness
node test/tools/edit_fidelity.mjs # entity-faithful edits + standOff guard
node test/tools/reading_contract_check.mjs # lossless on malformed input + single global editing profile
node test/tools/slugify_check.mjs # generated-id fragment contract (NCName-safe, idempotent)
node test/tools/szd_demo_check.mjs # SZD demo path: graphic url, place/work, authority idno
node test/tools/authority_lookup_check.mjs # M3.3 lookup URLs + response parsing (Wikidata/GND/GeoNames)
node test/tools/note_create_check.mjs # M3.5 editorial notes, stable @target
node test/tools/ai_proposal_check.mjs # M3.7 AI proposals: resp="#ai" marker, confirm/reject gate
node test/tools/ai_suggest_parse_check.mjs # M3.7 LLM reply parser, robust + deterministic
node test/tools/whitespace_edit_check.mjs # line edit preserves edge whitespace (indentation)
node test/tools/mention_projection_check.mjs # M2.5 projection + M2.8/M2.10 annotation ops (range wrap, unwrap, markup)
node test/tools/source_highlight_check.mjs # M2.12 XML source highlighter is lossless presentation
node test/tools/wb_codex_check.mjs # WB-AP1/AP2: real codex load + IIIF resolver + points bboxes (SKIP without local codex)
node test/tools/project_manifest_check.mjs # manifest parse/validate/normalize, documentTypes/files binding, teiModules/teiElements scope, reconciliation, attrField, resolver parity, lossless wraps
node test/tools/project_case_check.mjs # M2.9 acceptance case: deterministic plaintext intake, type-bound markup, byte-faithful edits
node test/tools/plaintext_import_check.mjs # |N| page-break markers resolve at ingest, marker-free input unchanged
node test/tools/draft_recovery_check.mjs # unsaved-draft recovery slot: round-trip, guards, failure modes
node test/tools/criticism_check.mjs # M3.6 textual-critical markup
node test/tools/dual_reading_check.mjs # F4 dual reading: atomic orig/norm edit byte-faithful, refusal, projection (real-codex guard SKIPs when absent)
node test/tools/szd_worked_example.mjs # M7.2 worked example: real o_szd.1079 open->correct->annotate->criticism->save (SKIP if fixture absent)
node test/tools/make_zbz1000_demo.mjs # materialize the local-only ZBZ worked-example object (doc 1000 + graphic urls) from the zbz sibling
node test/tools/zbz_worked_example.mjs # M7.2 ZBZ half: real doc 1000 open->correct->annotate->criticism->save (SKIP without object/sibling)
node test/tools/make_depcha_demo.mjs # materialize the local-only DEPCHA Wheaton demo project (two day-book volumes) from the public DEPCHA repo
node test/tools/depcha_demo_check.mjs # DEPCHA demo project: manifest binding + byte-identical line-level round-trip (SKIP content without local data)
node test/tools/make_curated_set.mjs # M7.4 curated set: before/after/diff/summary per object into output/curated-set/
node test/tools/hersch_loadability.mjs # editor-projection sweep over full Hersch (HERSCH_DIR)
node test/tools/szd_loadability_sweep.mjs # M1.5 convert whole szd-htr corpus, load + round-trip (SZD_DIR)
node test/tools/port_parity.mjs # M1.3 export_tei.py == reference prototype + 1 skipped (SZD_DIR)
node test/tools/szd-pagejson-to-tei.mjs <in_page.json> <out.xml> # reference prototype, one file
node test/harness/selftest.mjs # negative gate, must be
node test/harness/run.mjs # all synthetic fixtures, must PASS
```

## Related

- [architecture](architecture.md) for the engine the proofs measure
- [specification](specification.md) for the validation requirements
- [data](data.md) for the corpus
