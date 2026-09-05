# teiCrafter: critical project assessment

Historical assessment baseline, before the implementation increments. Findings below are preserved against that inspected revision. See the [latest implementation and verification](refactoring-status-2026-09-05.md) for resolved contracts and remaining work.

Assessment date: 2026-09-05. Repository revision: `0a45ed3`.

## Judgment

teiCrafter has a valuable architectural foundation and substantial implemented functionality. Its canonical-source model, local execution, project interpretation, stand-off annotations, and human review of model proposals are worth preserving. It is currently a research workbench with identifiable correctness and persistence gaps, rather than a dependable general-purpose environment for everyday TEI editing.

The next development milestone should be **trusted everyday editing**: preserve the editor's exact input, display TEI readings correctly, retain unfinished work, and distinguish historical review from verification of the current text. Increasing the number of annotation types or model providers should follow that milestone.

An unchanged XML string round-tripping successfully proves source retention. It does not establish that the reading view represents the source correctly, that an edit preserves the user's intended text, or that the output can actually be saved through the UI. These require separate acceptance contracts.

## Scope and evidence

The assessment reviewed the repository structure, README and knowledge base, editor orchestration, XML model and projections, source and metadata editing, validation and schema resources, persistence and project folders, review/proposal handling, facsimile storage, authority/model boundaries, converter, test approach and CI. Vendored libraries and all possible project customizations were not independently audited line by line.

The local source application was served on localhost and inspected in the Codex in-app browser. A bundled SZD example was edited only in browser memory. Literal entity entry, inline spacing, alternative readings, missing CDATA and persistent review status were reproduced through the UI. No external edition was overwritten and no model request was submitted.

Additional pure-module and stub reproductions are in [audit-2026-09-05.mjs](./audit-2026-09-05.mjs); their output is in [audit-2026-09-05-results.json](./audit-2026-09-05-results.json). Run `node reports/audit-2026-09-05.mjs`. This script reports observed behavior; a zero exit code is not a product acceptance verdict. Stubbed file operations never touch real target files.

Evidence levels used below:

- **UI + reproduction:** observed in the actual browser and reproduced against the model.
- **Reproduction:** executed pure-module or stub example.
- **Code finding:** supported by the inspected implementation, without a complete native-browser scenario.
- **Recommendation:** a proposed product or engineering improvement, not an assertion of a reproduced defect.

## What should be retained

1. **Canonical source with exact splices.** Avoiding whole-document XML serialization prevents unrelated lexical churn. Semantic no-op checks and patch history are good choices for scholarly editing and Git review.
2. **Shared deterministic engine.** Pure modules run in both browser and Node. This is a strong foundation for regression tests and future automated workflows.
3. **Session and revision awareness.** `EditorSession`, session safety, cached projections and schema authorization tied to exact output materially reduce stale asynchronous writes.
4. **Source-derived capabilities.** Inventory, navigation and conservative schema evidence go beyond a page-only editor. Corpus members, dictionary entries and speech turns are already considered.
5. **Project configuration.** Document types, markup, indices, image resolution and schema sets belong in declarative project data.
6. **Scholarly annotation foundations.** Authority lookup, entity indices, overlapping/discontinuous stand-off spans, metadata inventory and facsimile alignment have meaningful implementations.
7. **Local operation and optional AI.** The deterministic workflow does not depend on a model or application backend. Keys are held in memory and network behavior is documented.
8. **Verification infrastructure.** There are many substantive mutation and edge-case tests, browser tests, synthetic fixtures, a negative validation harness, and CI. The problem is coverage of some important contracts, not absence of testing.

## Prioritized findings

### F01. Literal text input is interpreted as XML entity notation

**Priority: P1. Evidence: UI + reproduction.**

In the reading editor, entering `Literal &amp; und &#65;` results in `Literal & und A`. Entering `&unknown;` introduces an undeclared entity reference into the source instead of encoding the literal string. A well-formedness/schema check may then block saving, but cannot repair the user's intent.

The shared `escapeText` and `escapeAttr` deliberately preserve strings that resemble entity references. That is appropriate only for already-encoded XML fragments, not decoded text from an input field. The deterministic plaintext importer already has the correct literal-escaping behavior, so intake and later editing disagree.

Evidence: `docs/js/editor/tei-document.js:143`, `:150`, `:159`, `:590`; `edition.js:689`; `editor-app.js:1635`. The existing `edit_fidelity.mjs` protects an unresolved `&nbsp;` token, which illustrates the ambiguity between literal text and source notation.

**Recommendation:** separate APIs for literal character data, attribute values and trusted source fragments. Keep no-op lexical preservation. For real text edits, escape every literal ampersand. If preservation of entity spelling inside an edited text run is required, retain a mapping between decoded characters and source ranges rather than treating typed entity-shaped strings as markup.

**Acceptance:** text typed into a text field has exactly the same character value after apply, save and reopen. Include literal entity syntax, ampersands, supplementary Unicode, combining marks, quotes, and existing numeric references. Test XML attribute normalization of tabs/newlines as a separate contract.

### F02. Reading projection changes spacing and conflates alternative readings

**Priority: P1. Evidence: UI + reproduction.**

`<p>un<hi>klar</hi>!</p>` displays as `un klar !`. The renderer adds a space before almost every cell; its special `joinLeft` handling only addresses certain anchor-separated siblings.

`<choice><orig>olde</orig><reg>old</reg></choice>` displays both `olde old`. `<app><lem>alpha</lem><rdg>beta</rdg></app>` similarly displays both readings in sequence. The diplomatic/normalized switch implemented around project-specific `w/@orig` and `w/@norm` is not a general TEI reading policy.

Evidence: `docs/js/editor/editor-app.js:1349`, `:1377`; `edition.js:172`, `:346`.

**Recommendation:** introduce an explicit reading projection with source-backed separators and selectable reading policies. Represent alternatives as alternatives, with clear controls for original/regularized, abbreviation/expansion and lemma/witness readings. Preserve all source branches. A neutral structural display can expose unsupported alternatives without presenting them as consecutive prose.

**Acceptance:** inline markup cannot introduce spaces into a word; punctuation and `join`/line-break conventions are respected. Every displayed reading has a deterministic mapping back to exact source ranges. Tests compare expected reading text, not only cell counts or unchanged XML.

TEI's definition of [choice](https://tei-c.org/release/doc/tei-p5-doc/en/html/ref-choice.html) makes the alternative relationship explicit; the proposed UI policy follows from that relationship.

### F03. Legitimate content can be absent from the reading view

**Priority: P1 for the generic-editor claim. Evidence: UI + reproduction for CDATA; reproduction for front/back.**

CDATA text produces no reading cells. For a document with `text/front`, `text/body` and `text/back`, the tested projection contains only BODY. XML source remains intact, but preservation must not be confused with visibility or editability.

Evidence: CDATA is retained as a non-text leaf in `tei-document.js:356`; `readingRoot` prefers `body` in `:954`; `edition.js:172` projects from that root.

**Recommendation:** support character data independently of its lexical representation and include front/back in navigation or expose a clear coverage warning and exact-source route. Publish a capability matrix separating open/preserve, display, edit and export support. Restrict the phrase "arbitrary TEI" accordingly, including the explicit UTF-8-only file boundary.

**Acceptance:** no nonempty readable region disappears without an explanation. Add fixtures for front/back, CDATA, nested corpora, foreign markup, gaiji, notes and complex apparatus.

### F04. Validation gates can prevent preserving unfinished work

**Priority: P1. Evidence: code finding and existing validation tests.**

Both Save and Download require all configured schemas to return valid. The fallback is repository TEI All. A pre-existing schema error, missing dependency or unsupported Schematron construct can therefore block both ordinary output paths after useful edits.

This is an intentional documented policy, but it is poorly suited to iterative correction of imperfect research data. Uploading a different schema is a configuration workaround, not a satisfactory working-copy workflow.

Evidence: `editor-app.js:2383`, `:2410`, `:2487`; `validation-view.js:281`; `schema-validation.js` and `knowledge/specification.md`.

**Recommendation:** distinguish persistent work from validated delivery. A named working copy/checkpoint should always be recoverable, with its invalid or unvalidated status clearly attached. Keep strict validation for a separately named validated export or project handoff. Preserve the original target unless the user chooses to replace it.

**Acceptance:** open an invalid but well-formed edition, make one correction, preserve the work, close, reopen and continue. A missing schema must not make the current work unsavable. Validated exports must still fail closed.

### F05. Recovery covers only a narrow draft state, and staged edits have a separate loss path

**Priority: P1. Evidence: code finding.**

Recovery is restricted to `source.kind === 'draft'` without a file handle. Changes to existing XML are not journaled. Storage is one localStorage slot, capped at four million characters, and the caller ignores `saveDraft()` failure. Attached images are only in memory.

Separately, source/metadata forms have staged state. In-app document replacement checks it, but the window `beforeunload` handler checks only `app.dirty`. Save and Download serialize committed state without first resolving staged edits. A clean document can therefore have visible unsaved form changes without the same close/save protection.

Evidence: `document-facts.js:134`, `:148`; `draft-recovery.js:26`; `editor-app.js:817`, `:2410`, `:2487`, `:3117`.

**Recommendation:** journal every editing session in IndexedDB, including staged source/form text and referenced image blobs. Use stable session/document identifiers and disclose persistence failure. Introduce one `hasUnsavedWork` contract covering canonical and staged changes. Saving must explicitly apply, preserve or reject staged edits. Keep recovery until durable output is established; initiating a browser download alone cannot prove the user retained it.

**Acceptance:** recover changes to an existing file, two concurrent drafts, metadata/source staging and image drafts after reload. Test quota failure, download cancellation, crash simulation and unsupported native file APIs.

### F06. First-save target and image collisions can overwrite existing data

**Priority: P1. Evidence: stub reproduction plus code path.**

Opening `letter.txt` in a project derives `letter.xml`. First save obtains that name using `getFileHandle(..., {create:true})`, which also returns an already-existing file. No explicit collision decision or initial snapshot is established. `saveTargetChanged()` then returns false when no snapshot exists.

The page-image persistence loop likewise obtains existing filenames and writes new blobs without a content/collision check. XML is marked saved before image persistence finishes; image failures are reported, but the recovery state has already been cleared for a saved draft.

Evidence: `project-folder.js:162`, `:307`; `editor-app.js:595`, `:2404`, `:2459`; `page-images.js:80`. The audit script demonstrates adoption of an existing handle without a snapshot and image replacement against stubs. It deliberately does not overwrite actual files.

**Recommendation:** use collision-safe names or an explicit overwrite choice, establish content fingerprints, and preserve recoverable state across partial XML/image saves. A ZIP project export is a useful portable option for XML plus images and manifest.

**Acceptance:** a folder containing both `letter.txt` and valuable `letter.xml` must retain the latter on ordinary first save unless replacement was explicitly chosen. Apply the same rule to image names and simulate failure after each write stage.

### F07. Review status does not mean that the current content was reviewed

**Priority: P1. Evidence: UI + reproduction.**

Mark a page reviewed and then change its text: the UI still reports `Reviewed 1/5`. The projection checks whether a review record targets the anchor; it does not bind verification to the content subsequently edited.

Defaults also use `urn:teicrafter:local-reviewer` and a generic completion rationale, without an ordinary reviewer-details workflow.

Evidence: `review-progress.js:30`; `review-record.js:18`; `editor-app.js:3035`.

**Recommendation:** preserve historical review records, but mark affected units "changed since review" or reopen their current review state. Record reviewer identity, scope and rationale explicitly. A content fingerprint or mutation-to-unit invalidation can support this without deleting historical evidence.

**Acceptance:** review, edit, save and reopen must distinguish reviewed revision from current revision. Undo back to the reviewed content should restore the appropriate status. Unrelated unit changes should not invalidate the whole edition.

### F08. Confirming AI proposals discards provenance rather than separating it from review

**Priority: P2. Evidence: reproduction.**

`confirmConstruct()` removes the complete responsibility attribute for `resp="#ai"`. A multi-valued `resp="#ai #editor"` is not recognized by the same default equality check. Model origin and pending review are represented by one marker, although they are different facts.

Evidence: `proposal-review.js:37`; related layer rendering and proposal modules. Whole-document generated provenance has a separate implementation, so this finding concerns individual confirmed constructs rather than all generated-document metadata.

**Recommendation:** retain durable origin and record acceptance/rejection separately. Process responsibility pointers as token lists, preserving unrelated pointers. Capture the provider/model and reproducible prompt or configuration identifier at generation time where the project requires auditability. Avoid claiming calibrated correctness from acceptance.

**Acceptance:** after confirmation and reopen, users can distinguish an accepted machine proposal from a human-origin annotation, including who accepted it. Mixed responsibility lists remain intact.

### F09. Native XSLT is a near-term dependency risk; compiled XSLT is not a universal XPath 2+ fallback

**Priority: P1 migration planning; P2 implementation outside affected projects. Evidence: code plus official browser documentation.**

Compiled Schematron uses native `XSLTProcessor`. The raw Schematron interpreter supports a bounded XPath 1.0 subset. Diagnostics recommend compiled XSLT for advanced cases, but a stylesheet requiring XSLT/XPath 2 or 3 will not thereby become executable in the native XSLT 1.0 processor.

Chrome documents planned removal of native XSLT in Chrome 158 on **2026-11-17**, with transitional exceptions. This makes the dependency time-sensitive, not merely a hypothetical portability concern. See [Chrome's migration notice](https://developer.chrome.com/docs/web-platform/deprecating-xslt?hl=en).

Evidence: `schema-validation.js:263`, `:273`, `:493`, `:648`.

**Recommendation:** put validators behind an explicit engine/version capability boundary. Evaluate a maintained bundled processor against the project's actual Schematron feature requirements; do not assume an XSLT 1 polyfill solves XPath 2+ constraints. Precompilation can remain a build step, with reproducible schema artifacts. Keep the application usable when a validator is unavailable via F04/F05.

**Acceptance:** run representative RNG, XSD and Schematron fixtures with native `XSLTProcessor` absent. Unsupported language versions must receive accurate guidance. Independently compare results with a trusted reference validation pipeline.

### F10. Project/schema support is not yet a complete TEI authoring environment

**Priority: P2. Evidence: code finding and recommendation.**

Project folder enumeration skips directories. Local schema loading supports bare filenames in one folder; nested include paths are rejected. Uploaded session schemas consist of one selected file. XML-model processing instructions are inventoried but are not inputs to the active schema selection shown in `validation-view.js`.

Completion offers document/project vocabulary and attribute hints. It does not evaluate the actual parent content model and insertion position. A name being present in a schema or document is not evidence that it is legal at the caret.

Evidence: `project-folder.js:193`; `project-schema-files.js`; `document-inventory.js:23`; `validation-view.js:74`; `editor-app.js:1469`; `source-view.js:144`.

**Recommendation:** support a relative project tree and a bounded resolver inside the granted root, schema bundles and catalog policy. Offer explicit adoption of document-declared schemas. Make ODD/project definitions the shared origin of validation, authoring vocabulary and project guidance. Add context-aware completion, document outline, ID/pointer navigation, project-wide search and previewable structured replacements.

TEI customizations and their generated artifacts are described in the [TEI customization guidelines](https://tei-c.org/release/doc/tei-p5-doc/en/html/USE.html). The recommendation is to operationalize that workflow, not to make every project use TEI All.

### F11. Editing performance has no sufficiently demonstrated operating envelope

**Priority: P2. Evidence: code and a small synthetic measurement.**

Each text edit reparses the complete string and rebuilds derived state; UI commit adds profile work, validation and rendering. Continuous view renders all navigation units. Schema execution also runs on the main browser thread. `minimalPatch` scans common prefixes and suffixes, and distant edits can produce a large contiguous history patch.

A one-run Node 22 measurement on this machine produced approximately 81 ms parse / 59 ms edit for 10,000 cells in 308 KB, and 142 ms / 112 ms for 20,000 cells in 618 KB. These are synthetic, non-statistical engine measurements, exclude browser rendering and validation, and are not maximum supported sizes. They show why UI performance should be measured explicitly.

**Recommendation:** define target hardware and document classes first. Measure open, edit, navigation, memory, recovery and validation at representative sizes. Move parsing/indexing/validation off the UI thread where practical and virtualize continuous rendering. Batch transactions before considering a new canonical text structure. Keep the lossless contract during optimization.

**Acceptance:** publish a tested operating envelope with p95 interaction times, peak memory and a reproducible dataset. Include a genuinely large edition and long annotation history.

### F12. Input and accessibility contracts lag behind the model abstraction

**Priority: P2. Evidence: code finding, UI observation.**

Cells expose local `editingKind`, but the text input still selects single-line versus multiline using the document-wide `profile`. A mixed token/prose document can therefore send long prose into a single-line field. Reading cells are pointer-operated spans without an evident keyboard edit action; the UI test gate does not establish complete keyboard editing. Enter handlers do not check IME composition.

The basic two-pane layout and tabs work well visually. However, XML validation, AI, markup progress, review, navigation and zoom compete in the same area. The continuous-view button is a small symbol, and the prominent empty-state creation action is LLM generation while deterministic creation is in Load. "Source" as a context tab competes with "XML source" as an editing tab.

**Recommendation:** use local cell capabilities throughout the UI. Provide keyboard navigation and editing, composition-safe input, reliable focus restoration, and a shortcut reference. Promote deterministic open/create actions; retain AI as contextual assistance. Rename the context tab to reflect its actual source-structure explanation. Test real tasks at 200% zoom and with keyboard/screen-reader use.

### F13. Architecture should be consolidated around transactions, not rewritten around a framework

**Priority: P2. Evidence: code finding.**

Pure modules are a strength, but `editor-app.js` is over 3,100 lines and `annotation-ui.js` is another large interaction coordinator. Shared mutable `app` state and callback bundles make it easy for a new surface to omit persistence, staging, review invalidation or capability checks.

Type checking uses a selected file list and `strict:false`. Imported dependencies can also be checked, but this is not an explicit whole-application strict boundary. Some large controllers are outside the listed roots. Legacy `word`/`folio` terminology and dated query suffix imports complicate the current source-profile abstraction.

**Recommendation:** extract session/persistence coordination, reading-view control and editor commands. A command should describe its source ranges, user-visible label, affected review units and staged-state policy, then pass through one transaction service. Expand checked roots and strengthen types at those boundaries. No framework migration is necessary to obtain these benefits.

### F14. Test evidence is substantial but overstates some contracts

**Priority: P2. Evidence: executed tests and code finding.**

The all-proofs runner completed with **77 passed, 5 skipped, 1 failed**. The failure was `szd_loadability_sweep.mjs`, which needs a missing local `szd-htr/results` corpus; the standard verify script explicitly excludes that optional sweep. This is not evidence that the ordinary required suite has a product regression. Types were among the skipped checks during that run.

The harness negative self-test and all four synthetic harness tiers passed. However, `test/harness/run.mjs:45` still creates its candidate with `copyFileSync`; those tier results validate the harness and fixtures, not a browser edit-save workflow. Other dedicated engine proofs do exercise real edit functions and should be credited separately.

The full pinned `npm run verify` and packaged Chromium/Firefox suite were not established by this assessment. The machine initially had Node 22.14/npm 10.9 rather than the required Node 24.13/npm 11.6.2. Dependency installation was slow and native tools were unavailable/busy during attempted build/type checks. The installation attempt was stopped; partially installed, ignored `node_modules` remains and should be completed with `npm ci` under the pinned toolchain before development. The direct-source browser reproductions do not certify the built deployment artifact.

**Recommendation:** add adversarial semantic and workflow tests for F01-F08. Compare source fidelity, displayed reading, intended edit and exported/reopened XML independently. Add a real engine transform to the tier harness or relabel its identity-only role. Keep optional corpus gates visibly separate. Browser tests should cover failed save, staged state, collisions, IME and complete keyboard operation.

### F15. Documentation and product positioning need a tighter supported contract

**Priority: P2. Evidence: documentation/code comparison.**

"Arbitrary TEI", "byte offsets" and broad losslessness wording conflate distinct guarantees. Internal offsets are JavaScript UTF-16 code-unit positions; byte preservation is established only after the explicit encoding boundary. The interface is broader than the older folio-oriented README description, yet important TEI content is not fully projected. Some source-view tooltips still say schema validation runs offline even though browser validation exists.

The CI workflow uploads a Pages artifact but contains no deployment job. This does not prove deployment is broken, since repository settings or an external mechanism may deploy it; the release/deployment contract is simply not fully visible here.

**Recommendation:** publish a concise support matrix, align public claims with tested guarantees, keep one authoritative architectural map, and document how a tested revision becomes the public artifact. Make a useful synthetic example available on the public site. Avoid unverified market-wide novelty claims in the README; explain the specific demonstrated contribution instead.

## Recommended delivery sequence

Effort bands below are planning categories, not estimates: S is a localized change, M spans modules and UI tests, L requires a new subsystem or extensive acceptance work.

| Order | Deliverable | Findings | Effort | Exit criterion |
| --- | --- | --- | --- | --- |
| 1 | Literal-input correctness | F01 | M | Typed character value survives edit/save/reopen |
| 2 | Collision-safe output | F06 | M | Existing XML/images survive first-save name collisions |
| 3 | Recoverable work and staged-state safety | F04-F05 | L | Invalid, staged and image-bearing work survives reload |
| 4 | Faithful reading projection | F02-F03 | L | Inline spacing, alternatives, CDATA and front/back have explicit correct behavior |
| 5 | Current review and durable provenance | F07-F08 | M-L | Content changes invalidate current verification without erasing history |
| 6 | Validator migration | F09 | M-L | Required schemas run with native XSLT disabled |
| 7 | Everyday TEI authoring | F10, F12 | L | Context help, diagnostics-to-source, navigation and keyboard tasks work end to end |
| 8 | Performance and boundary consolidation | F11, F13 | M-L | Defined large-document envelope and coherent transaction API |
| Continuous | Evidence and documentation | F14-F15 | M | Every advertised contract maps to an appropriate acceptance test |

The validator migration should be investigated alongside the first safety fixes because it has a dated external dependency. Performance measurements should start early, while intrusive optimization should follow correctness contracts.

## Product acceptance before a production claim

Recruit editors working with at least correspondence, a critical edition and a tokenized facsimile edition. Give them representative tasks: open unfamiliar TEI, locate a passage, correct text, encode an alternative reading, link an authority record, follow a validation issue to its source, review a unit, preserve unfinished work and reopen the result in another XML tool.

Measure completion without developer intervention, incorrect edits, recoverability, time to resolve validation errors and agreement between source and displayed readings. Include an initially invalid document, a missing schema, a filename collision and a browser reload. Automated accessibility checks supplement, but cannot replace, keyboard and assistive-technology task testing.

The strongest near-term product promise is a transparent, locally operating scholarly editing workbench that preserves source and makes supported editorial decisions explicit. The current architecture can support that promise if correctness, recoverability and evidence are made the next release criteria.
