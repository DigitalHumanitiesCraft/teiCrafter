# teiCrafter 0.2.0 implementation plan

Scope and acceptance plan. Implemented progress and current verification are recorded in the [refactoring report](refactoring-status-2026-09-05.md); the work-package descriptions below are requirements, not a claim that every item remains untouched or is complete.

Status: implementation in progress, not a release announcement. See the [current implementation status](./implementation-status-2026-09-05.md).
Created: 2026-09-05.
Starting application version: 0.1.0 (`package.json`).
Assessment baseline: `0a45ed3`, [project assessment](./project-assessment-2026-09-05.md).
Product refinement: [user workflows, example strategy and adaptive UI](./workflows-and-adaptive-ui-0.2.0.md).

## Release outcome

teiCrafter 0.2.0 should provide dependable everyday editing within an explicit, tested TEI support matrix. Users can enter literal text, inspect supported readings, preserve unfinished work, resume after interruption, and distinguish current review from historical review and machine provenance.

All fifteen assessment findings are assigned below. Completing this plan does not claim unrestricted TEI semantics, every Schematron dialect, or suitability for every production project. Those boundaries must be documented and tested.

The next application release is proposed as **0.2.0**, with integration previews `0.2.0-alpha.N`, an editorial pilot `0.2.0-beta.N`, and release candidates `0.2.0-rc.N`. These are proposed identifiers; this plan does not change package versions, create tags or publish releases. The knowledge index owns an independent documentation schema version, not the application's version.

Version 1.0.0 should follow successful sustained editorial use, a stable project/storage format and a documented support and migration policy. Completion of development alone is insufficient evidence for that claim.

## Product decisions to implement

These decisions are explicit changes to current behavior. Update the owning specification and design documents with the implementing changes; this planning document does not silently override the current normative specification.

1. **Working state and validated delivery are separate.** Preserve work even when its schema is invalid or unavailable. A validated export still requires all applicable validators to approve its exact output. Malformed staged XML remains recoverable without being accepted into structural editing.
2. **Visible staged changes participate in save and close behavior.** Save must resolve or explicitly preserve them; it must never silently save an older committed revision while implying the visible edits are included.
3. **Reading presentation has an explicit policy.** Default to a documented source-oriented reading; alternatives remain accessible and labeled. Unknown semantics receive transparent source access instead of an invented reading.
4. **Origin and review are independent.** Acceptance does not erase machine origin. Editing a reviewed unit changes its current review status while preserving historical review records.
5. **Existing XML and images require collision decisions.** First-save creation must not silently replace a file with the same name.
6. **Supported formats are explicit.** Preserve the UTF-8 file boundary for this release; advertise preservation, display, editing and export support separately. No silent conversion of legacy source formats.
7. **Preserve the canonical-source architecture.** Refactor boundaries and projections incrementally. A framework migration or wholesale document-model rewrite is not part of this plan.

## Work packages

Each package should be implemented as reviewable changes with tests of observable behavior. Do not wait for the entire roadmap to run the relevant checks. Shared boundaries must be established before their consumers migrate.

### WP0. Establish baseline and acceptance contracts

Findings: F14, F15; prerequisite for all packages.

- Restore the pinned Node/npm environment and complete `npm ci`.
- Run the required verify gate and Chromium/Firefox tests. Classify missing optional corpora separately from regressions.
- Turn the audit reproductions into focused regression cases with independently defined expected behavior. The reporting script itself is not a green acceptance suite.
- Create an acceptance matrix across XML lexical fidelity, literal character value, reading text, review/provenance and durable output.
- Select synthetic fixtures for correspondence, apparatus, tokenized facsimiles, corpora, mixed token/prose, front/back, CDATA, namespaces, Unicode and invalid input.
- Establish the five user reference workflows: transcript-to-letter, existing charter, thirty lexicon entries, read-only TEI and historical legal-source metadata/indices. Combine original synthetic fixtures with curated, versioned external references whose reuse rights are documented.
- Add fault fixtures for missing schemas, storage quota, native file API absence, same-name output and partial image writes.
- Capture initial performance measurements and identify actual Schematron requirements. Select the validator migration candidate before committing to its implementation.

Deliverables: reproducible baseline, regression inventory, supported-scope draft, validator decision record, measurement protocol.

Gate G0: clean-checkout required checks have an explained result; every critical audit case has an explicit expected outcome. Baseline defects may remain identified failures until their owning package is complete.

### WP1. Correct literal input and protect existing targets

Findings: F01, F06. Depends on WP0.

Main modules: `tei-document.js`, `edition.js`, `metadata-view.js`, `project-folder.js`, `page-images.js`, output orchestration in `editor-app.js`.

- Separate literal text/attribute escaping from source-fragment operations. Audit all callers rather than changing the shared helper blindly.
- Preserve lexical no-ops and define behavior for declared or unresolved entity references. Keep decoded-to-source mapping explicit where retained entity notation matters.
- Verify XML character legality and attribute whitespace normalization. Reject unrepresentable input with a recoverable explanation.
- Add target existence and content checks for derived XML names and uploaded images.
- Offer a free filename by default, with a concrete replacement decision where requested.
- Establish a snapshot for adopted writable targets; a missing snapshot must not imply that an existing target is safe to overwrite.

Gate G1: literal `&amp;`, `&#65;`, Unicode and attribute values retain their intended character values after edit/save/reopen. `letter.txt` plus an existing `letter.xml`, and duplicate image names, cannot cause silent replacement. No-op fidelity remains intact.

### WP2. Unify edit transactions, staged changes and recovery

Findings: F04, F05, F06, part of F13. Depends on WP1 and WP0.

Main modules: `editor-session.js`, `editor-app.js`, `document-facts.js`, `draft-recovery.js`, source/metadata controllers and `page-images.js`.

- Introduce a session transaction boundary carrying command label, intended edits, affected source ranges/units, history and persistence consequences.
- Make committed and staged changes visible through one unsaved-work contract. Handle view switch, file switch, Save, Download, reload and window close consistently.
- Add versioned IndexedDB storage for multiple sessions, canonical XML, staged drafts, source/target identity and attached blobs.
- Migrate the existing draft recovery slot without deleting its only copy until the replacement record is durable.
- Distinguish recovery storage, an explicit working-copy file and validated export. Do not bypass the validation contract by labeling an unvalidated artifact validated.
- Keep XML/image output failure recoverable. Track partial saves; do not mark the project fully durable before its required assets are secured.
- Add a portable bundle export for XML, manifest and attached images; preserve source paths and reject ambiguous collisions.
- Report storage failure and allow users to clear recovery data explicitly. Avoid treating a triggered download as proof of durable retention.

Gate G2: changes to existing XML, invalid documents, two drafts, staged source/metadata and image-bearing work recover after interruption. Validation unavailability cannot trap work in memory. Undo/redo and stale-result rejection remain correct.

### WP3. Implement a faithful reading projection

Findings: F02, F03, part of F12. Depends on WP1 and the transaction interface from WP2.

Main modules: `tei-document.js`, `edition.js`, `navigation-model.js`, source-profile modules and the extracted reading controller.

- Model source-backed separators instead of adding spaces between arbitrary text cells. Define token spacing and milestone handling explicitly, including relevant `join` and line-break policies.
- Represent CDATA as readable character content while preserving its lexical boundaries on no-op and supporting a safe inverse for edits.
- Include front/back and corpus-member text in navigation and coverage reporting.
- Add selection policies for `choice` pairs and lemma/witness apparatus. Preserve all alternatives in XML and expose the non-selected branches through the inspector/source view.
- Reconcile reading offsets with annotation selection, stand-off boundaries, source navigation and facsimile links.
- Use local `editingKind` consistently for mixed token/prose documents.
- Surface unsupported or ambiguous regions with a precise explanation and source route.

Gate G3: `un<hi>klar</hi>!` reads as `unklar!`; punctuation is correct; alternatives never masquerade as consecutive prose; CDATA/front/back are accounted for. Reading selections map back to exact intended source ranges without changing unselected text.

### WP4. Make review and provenance durable and meaningful

Findings: F07, F08. Depends on WP2 and WP3.

Main modules: `review-record.js`, `review-progress.js`, `proposal-review.js`, proposal application/projection and annotation UI.

- Distinguish unreviewed, currently reviewed and changed-since-review states.
- Bind current verification to a defined content scope using fingerprints or equivalent revision-aware evidence. Preserve prior review history.
- Define how text, annotation, metadata and navigation changes affect each review scope. Unrelated unit changes must not reopen the whole document.
- Expose reviewer identity, time, scope and rationale; avoid presenting a generic placeholder as an identified person.
- Separate machine origin from acceptance/rejection. Design the persisted TEI representation against actual project schemas before adding fields.
- Handle responsibility pointers as token lists and preserve unrelated values.
- Interpret legacy markers conservatively. Never invent historical identity or machine provenance that old documents no longer record.

Gate G4: review/edit/undo/save/reopen yields the correct current status and retains historical evidence. Confirmed machine proposals remain identifiable after reopen. Multi-valued responsibility attributes survive unchanged except for the deliberate operation.

### WP5. Replace fragile validation dependencies and support real project schemas

Findings: F09, schema/resource portion of F10. Investigation starts in WP0; implementation depends on WP2's output boundary.

Main modules: `schema-validation.js`, `schema-set.js`, `project-schema-files.js`, `validation-view.js`, project folder/resource services.

- Introduce validator capability records: schema language/version, supported features, engine version, execution limits and diagnostics.
- Implement the selected maintained browser-compatible validation route without requiring native `XSLTProcessor`.
- Freeze the supported Schematron subset or language versions against real fixtures. Accurate unsupported-feature behavior is mandatory; do not imply that compilation changes language requirements.
- Compare supported validation results against an independent reference pipeline.
- Resolve nested resources inside the granted project root with explicit relative paths, cycle handling and outside-root restrictions. Define remote resource policy and credentials behavior.
- Support schema bundles and explicit adoption of `xml-model` declarations. Record the origin of the effective schema set.
- Tie authorization to exact output, schema resources and session/revision. Keep stale-result tests after engine changes.
- Run expensive validation in a worker where supported by the selected engine, with cancellation and visible progress.

Gate G5: representative RNG/XSD/Schematron projects work when native XSLT is absent. Missing/unsupported dependencies get accurate diagnostics, working copies remain preservable, and validated output remains strictly gated.

### WP6. Complete daily authoring and keyboard workflows

Findings: remaining F10, F12. Depends on WP3 and WP5.

Main modules: source/metadata views, schema profile/completion services, project navigation, validation UI, annotation UI and editor shell.

- Add a project tree, document outline, ID lookup and pointer navigation with unresolved/ambiguous target reporting.
- Connect diagnostics to the exact source position and navigation unit.
- Add document/project search and previewable structured replacements. Batch edits need one reviewable transaction and defined multi-file failure behavior.
- Derive authoring guidance from project definitions/ODD-generated artifacts. Support context-aware completion for declared supported schema constructs; identify unknown evidence instead of suggesting false validity.
- Provide keyboard access to text editing, annotations, menus and source locations, with reliable focus restoration and composition-safe Enter behavior.
- Clarify the source-structure panel label, reading policy, working-copy/export state and continuous-view action.
- Promote deterministic open/create workflows. Keep optional AI actions contextual.
- Deliver tested starter profiles and composable task views for the five reference workflows. Include transcript intake, entry creation/duplication with stable reference handling, metadata/index detail views and a document read-only mode. Compose views from actual structure, project mapping, current task and user choice. Do not automatically rewrite existing XML to fit a genre template.

Gate G6: an editor can locate a passage, correct it, annotate it, follow a validation error and preserve the result using only the keyboard. Mixed token/prose input uses the correct controls. Structured replacement previews identify all intended changes before application.

### WP7. Establish the supported performance envelope and finish boundary consolidation

Findings: F11, remaining F13. Measurement starts in WP0; intrusive optimizations follow WP3-WP6.

- Maintain a benchmark ladder, initially approximately 1 MB, 10 MB and 50 MB with different markup densities. These are test sizes, not promised support limits.
- Record reference hardware, browser, cold/warm load, p95 edit/navigation latency, long tasks, validation duration, recovery overhead and peak memory.
- Set and document release budgets from the baseline and the intended editorial workloads. Freeze budgets before evaluating improvements.
- Virtualize continuous reading and large lists; batch source transactions and move parsing/indexing off the interaction thread where measurements justify it.
- Avoid multiplying full-document work and long-lived caches across module instances. Preserve exact-source semantics during optimization.
- Extract reading and persistence coordinators from `editor-app.js`; give commands and service boundaries explicit types. Expand typecheck roots to the complete application and strengthen strictness incrementally.

Gate G7: the advertised document classes meet the frozen budgets without losing recovery, selection mapping or history correctness. Oversized/unsupported workloads get a usable explanation. All application entry points participate in the declared checking policy.

### WP8. Validate the product and prepare the release

Findings: F14, F15 and integration of all packages. Depends on G1-G7.

- Run the complete pinned verification and browser suites on the built deployment artifact.
- Extend the tier harness to exercise actual editor transformations; retain identity tests under an accurately named role.
- Test Chromium and Firefox file/download paths, recovery failures, no-native-XSLT behavior, keyboard tasks, 200% zoom and relevant assistive technology.
- Run an editorial pilot using correspondence, critical apparatus and a tokenized facsimile edition. Use rights-cleared committed data or explicitly local fixtures.
- Include imperfect input and interruptions, not just successful creation/export.
- Update specification, architecture, design, testing, data/storage, security and README contracts. Document legacy recovery/provenance migrations and known limitations.
- Make a synthetic public example available and document the path from a verified revision to deployment.
- Update application version metadata and prepare release notes only at the release step. Creating a plan does not authorize publishing a release.

Gate G8: no known unresolved issue in data loss, unintended content change, misleading supported reading, false current-review status or silent target replacement. All required checks pass; pilot blocking issues are resolved; support and migration contracts are published with the candidate.

## Dependencies and preview milestones

| Milestone | Prerequisites | Meaning |
| --- | --- | --- |
| Baseline ready | G0 | Execution can start against explicit behavior contracts |
| `0.2.0-alpha.1` | G1, G2 | Input, target safety and recovery are integrated; remaining reading limitations are explicit |
| `0.2.0-alpha.2` | G3, G4, G5 | Reading, review and validator changes work together |
| `0.2.0-beta.1` | G6, G7 | Complete planned workbench scope is ready for editorial pilot |
| `0.2.0-rc.1` | G8 evidence assembled | Release candidate undergoing final verification |
| `0.2.0` | Candidate verified; release decision | The tested scope and migration contract are delivered |

The dependency sequence is WP0 → WP1 → WP2 → WP3 → WP4, with validator investigation starting in WP0 and WP5 feeding WP6. WP7 measurement begins early; final performance acceptance and WP8 follow feature integration. This describes work dependencies, not authorization to create parallel agents or separate tasks.

## Traceability

| Finding | Owning packages |
| --- | --- |
| F01 Literal text | WP1 |
| F02 Spacing and alternatives | WP3 |
| F03 Missing reading content | WP3 |
| F04 Unpreservable invalid work | WP2 |
| F05 Recovery and staged state | WP2 |
| F06 Target/image collisions | WP1, WP2 |
| F07 Stale review | WP4 |
| F08 Lost/mixed provenance | WP4 |
| F09 XSLT dependency | WP0, WP5 |
| F10 Project/schema authoring | WP5, WP6 |
| F11 Performance | WP0, WP7 |
| F12 Interaction/accessibility | WP3, WP6 |
| F13 Architecture/types | WP2, WP7 |
| F14 Test evidence | WP0, WP8, each package's tests |
| F15 Public contract/deployment | WP0, WP8 |

## Execution discipline and estimation

For each implementing change: state the user-visible contract, add the relevant regression case, implement the smallest coherent change, run appropriate checks, and update owning knowledge documents. Failed operations must leave the canonical document and recovery state explainable. Keep original fixtures and expected outputs independent from implementation helpers where possible.

Do not assign a calendar promise before WP0 establishes the baseline and validator choice. WP1 can then be estimated separately; WP2, WP3 and WP5 are the principal cross-cutting uncertainties. Human pilot participation is an external dependency and must remain visible in release status.

The implementation status report records completed behavior, current verification and remaining work. Application version metadata changes only at the release step.
