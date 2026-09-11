# Wenzelsbibel workflow, 2026-09-11

This report records the project-wide branch inspection, Wenzelsbibel specialization and verification against locally available edition material. It supersedes the current-state interpretation of the September 5 checkpoint; those historical observations remain intact. The application version remains 0.1.0 pending release acceptance.

## Implemented scope

The Wenzelsbibel workspace uses the existing canonical XML, exact mutations, session history, staged input, recovery and output schema gate. It supports diplomatic and normalized word readings; existing multilingual apparatus comments and new anchored comments; independent Bible-verse mappings; image descriptions, artist assignments, ICONCLASS concepts, folio and dimension fields, image zones and text ranges; shared person, place and people registers; and cross-file reference checks. PAGE XML with optional METS ordering creates a separate TEI draft. The detailed contract is [knowledge/wenzelsbibel.md](../knowledge/wenzelsbibel.md).

All existing apparatus types remain visible, including legacy spellings and untyped entries. Notes navigation and word markers now resolve apparatus anchor ranges. Mixed content without a safe scalar inverse remains editable through exact XML. Explicitly attached companions support lookup and navigation between documents; saving each file remains a separate operation. Companions must be reattached after a reload.

Peoples are modelled as collective agents using `listOrg/org`, with `type="people"`. Verse mappings use word-targeted stand-off spans and a canonical reference, optional editor-supplied Latin quotation and reference-edition note. The Latin text and the reference edition's numbering are never inferred automatically. The user authorized these modelling choices for implementation; they still require scholarly acceptance by the edition team.

The missing original Bilderfassung.sch was not supplied. The new `wenzelsbibel-editorial.sch` identifies itself as a teiCrafter-authored profile. Its editing phase permits unfinished records under TEI All; its separate review phase checks editorial completeness. Cross-file referential integrity is checked against attached documents. A declared project schema set takes precedence over these defaults.

## Branch integration

The starting local main was fast-forwarded to the current remote main. Inspection found three additional remote branches:

| Branch | Inspection result |
| --- | --- |
| `fix/audit-confirmed-defects` | Already contained in main |
| `session/2026-06-07-place-graphic` | Already contained in main |
| `codex/frontend-knowledge-pilot` | Notes-navigation change integrated with merge commit `af24493`; newer editor safety and recovery guards retained |

There were no open pull requests at inspection. Historical branch refs were retained. Ancestry and the pushed main are verified at the final integration boundary.

## Real-source findings

The original codex, image annotations and Transkribus exports were read locally. They were not committed, copied into public test fixtures or edited on disk. Browser traces containing real material remain under the ignored local test output directory.

| Observation | Consequence |
| --- | --- |
| The codex is 82,430,623 bytes with 158,616 word elements and 37,020 punctuation elements | Whole-document performance and exact preservation were tested against the actual edition |
| The codex has 1,009 apparatus entries; 125 have missing, ambiguous or reversed boundaries under the complete resolver | The workspace exposes the source problems without silently redirecting comments |
| Image annotations contain 638 image records, and their image-zone targets resolve into the codex | Cross-file lookup has a real target set |
| Of 570 statistical text-relation notes, 315 lack `@corresp`. Of the 255 with `@corresp`, 67 contain empty ranges and three further ranges have unresolved codex endpoints | Incomplete relations require editorial correction; the review phase reports 382 missing or empty ranges |
| The artist reference `#STW` has no matching header siglum | No automatic replacement with a superficially similar siglum is made |
| TEI All accepts the original image document; the authored review phase reports 1,624 completeness findings | Formal structure and editorial completeness are different results |
| TEI All rejects one attribute-free choice containing only a sic child in the codex | A guided, explicit action removes only the enclosing choice in the working copy; the encoded reading and original file remain intact |
| All 943 PAGE files convert; they contain 59,829 text lines, with two degenerate coordinate records | Degenerate coordinates are retained as source notes instead of invented polygons; import does not merge the source edition |

These are structural findings, not a philological assessment of the edition. The project editors must decide the actual readings, reference targets, attributions and completions.

The first miniature's codex surface and the [public ÖNB IIIF metadata](https://iiif.onb.ac.at/images/REPO/8977428/00000010.jp2/info.json) both use 9243 by 13067 pixels. The metadata request returned HTTP 200 with CORS support, and the image zone falls inside that coordinate space. This verifies the resolver and unit scale for that object; the browser viewer itself is exercised with synthetic pixels and a real zone overlay contract. No original image was copied into the repository.

## Performance and publication fixes

Distinct attribute-value collection previously used repeated linear searches. Ordered sets and immutable-document caching reduced the measured inventory pass from 9,202 ms to 701 ms while preserving the same distinct values. A second browser profile identified repeated whole-document review traversals for each page. A document index and one review-state calculation per page removed that bottleneck. The first measured Chromium opening after both fixes took 6,496 ms, compared with the earlier 90-second timeout.

Vocabulary-schema compilation is expensive on this host: isolated cold TEI All preparation took approximately 7.6 seconds in Chromium and 36 seconds in Firefox. RelaxNG and XSD now run in a same-origin module worker with a persistent compiled-schema cache. Development probes observed main-window heartbeats throughout compilation; following cached negative checks took tens of milliseconds. The exact output gate still requires every schema to pass and rejects worker failure or stale results.

The completed real Firefox workflow loaded the codex in 8,122 ms and validated and downloaded the explicitly corrected copy in 204,713 ms. Normalization, exact Working copy, Undo and the deliberate single-choice repair passed. The downloaded XML matched the original except for that removed wrapper, and the source on disk remained byte-identical. The earlier 120-second export test expired; the subsequent measured completion justifies a 360-second budget for this opt-in large-object case. This remains a material performance limitation of the full-source Firefox output path, despite responsive editing. Chromium also completed the real workflow.

The production asset copier now includes only Git-indexed regular runtime data, schemas and vendor files. This closes the observed route by which ignored local edition data could enter `dist`. A regression proof checks the publication boundary independently of the local corpus.

## Verification

The required `npm run verify` gate passed on Node 24.13.0, npm 11.6.2 and an isolated Python environment with lxml 5.4.0: 99 required Node proofs passed, none skipped or failed. The negative harness self-test passed, all four synthetic fidelity tiers passed, and the curated TypeScript check, Biome and production build passed. Build warnings remain for the intentionally external OpenSeadragon script and the bundled validator size. Runtime-asset verification found exactly the 107 indexed data/schema/vendor files, with no missing or additional collection files.

The local Markdown link and knowledge-metadata check found no errors; unchanged upstream README references to files not vendored with their library remain separately listed. Optional real model proofs use explicit environment variables rather than personal filesystem paths.

`npm audit --json` reported no known advisories for the installed npm dependency graph. This observation does not audit the separately vendored runtime libraries.

The integrated production browser run executed 122 cases in Chromium and Firefox with both local Wenzelsbibel sources supplied: 114 passed, five failed through three test assumptions, and three were declared skips. The test corrections use the rendered PAGE-order combobox role, explicitly accept and assert the expected unsaved-document dialog during companion switching, and give the Notes-navigation scenario an overall timeout compatible with its existing inner download wait and the measured Firefox compilation time. The nested plaintext Save test received the same evidence-based timeout correction before this run. Source, output, Undo and validation assertions were retained. The targeted follow-up passed all six corresponding cases against the identical production artifact (`editor-CkwAU0HZ.js`). Together these runs verify all 119 executable cases. The three declared skips are the two optional UFBAS corpus cases without a supplied source and the Firefox-specific case under Chromium. This is combined main-run and follow-up evidence, rather than a claim that the original run was entirely green. The final Biome check passed for all 104 selected files after the test corrections.

Both real-object browser cases passed in both engines in the integrated run. The final Chromium codex opened in 6,481 ms and validated/downloaded in 44,576 ms. Firefox opened it in 7,547 ms and validated/downloaded in 206,226 ms. Firefox phase observations place schema preparation at 1,003 ms, XML parsing at 36,422 ms, native XML validation at 38,803 ms and aggregate success at 205,195 ms after the output request. The remaining interval includes validation and the following editorial checks; it is not attributed to a parser defect. The worker responsiveness and cached rejection scenarios passed in both browsers. The exercised synthetic transcription/image states had no serious or critical Axe findings.

## Acceptance boundary

No release tag or deployment is implied by integration into main. Scholarly review and user acceptance remain open. Broader generic authoring work in the [0.2.0 plan](implementation-plan-0.2.0.md), including complete witness handling and entry-management batch operations, is outside this Wenzelsbibel specialization. Whole-document parsing remains the canonical model. Companion persistence, atomic multi-file saves and concurrent editing require separate contracts.
