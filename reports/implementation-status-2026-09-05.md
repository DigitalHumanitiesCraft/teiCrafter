# teiCrafter 0.2.0 implementation status

Date: 2026-09-05. Status: integrated development increment, not a release candidate.
Application version: **0.1.0 remains in package.json**. Target release: **0.2.0**.
Checkout at inspection: `main`, HEAD `6f52bef`. The implementation and new verification material remain uncommitted in the working tree.
Related: [implementation plan](implementation-plan-0.2.0.md), [workflow scope](workflows-and-adaptive-ui-0.2.0.md), [assessment baseline](project-assessment-2026-09-05.md).

Follow-up: [input and persistence refactoring](refactoring-status-2026-09-05.md) records the later changes and restored pinned verification chain. The gate results below describe the earlier implementation increment and are retained as its historical evidence.

## Implemented behavior

- Literal text/attribute edits escape entity-looking input correctly, reject XML-illegal characters, retain semantic no-ops and refuse guessed expansion of unknown entities.
- Derived XML chooses an unused filename. Image persistence compares bytes before reuse and refuses replacement of different content. Failed writable streams are aborted when supported; unfinished work retains recovery.
- IndexedDB checkpoints keep independent document sessions, unfinished inline/XML/metadata input, project/schema settings and image blobs. Working copy exports/imports this state as versioned JSON independently of the validated TEI output gate. Downloads no longer imply a complete native save.
- Reading preserves prose adjacency, handles encoded token punctuation/joins, selects diplomatic or normalized choice branches, and includes CDATA/front/back. Apparatus currently selects lemma or first reading. Unsafe interactive edits route to XML.
- Review appends history and binds current status to a versioned SHA-256 source-scope fingerprint. Edited content becomes changed since review; exact Undo can restore the reviewed state. Reviewer and rationale have an explicit dialog. Historical records without fingerprints do not certify current content.
- Proposal acceptance preserves responsibility and existing analysis tokens. Accepted origin remains visible in reading and index views. Project-specific responsibility pointers and co-responsibility are retained.
- Read only blocks central replacements and undo/redo, plus inline, XML, metadata, annotation, index, review and pending AI mutation routes. Returning to editing retains history. Unfinished visible input is not implicitly applied by entering this mode.
- Project folders show nested files in collapsible groups and resolve nested RelaxNG/XSD dependencies from the containing schema. Traversal stays inside the granted root; URI-encoded filenames and cyclic dependencies are covered.
- New document provides deterministic starters for transcription, correspondence, charter, legal source, dictionary entries and encyclopedia articles. Letter facts are supplied explicitly; uncertain dates are retained as written. Dictionary and article structures remain distinct. Thirty dictionary entries can be created and navigated in one document.
- Keyboard cell editing, composition guards, source replacement recovery, accessible index-search labeling, deterministic focus colors and responsive creation-dialog layout were improved.

## Verification on this host

| Check | Result and boundary |
| --- | --- |
| `node test/run_all.mjs` | 85 passed, 5 skipped, 1 failed. The failure is the optional SZD corpus sweep: the required sibling Page-JSON source directory is absent. Type checking is among the skips because its native executable is missing. |
| Source-served Chromium Playwright suite | 28 passed, 2 skipped. Skips are the Firefox-specific test in this Chromium-only diagnostic run and the rights-local UFBAS object. These are source tests, not a built-artifact cross-browser release gate. |
| New starter templates | Every template passes the vendored TEI P5 4.11.0 TEI All RelaxNG validator. The suite checks deterministic output, literal text, supplied correspondence facts, distinct entry encodings and thirty dictionary units. |
| Nested schema execution | Actual RelaxNG validation passes a nested resource set with spaces and literal percent characters in filenames, and rejects nonmatching XML. Path proofs also cover root escape and dependency cycles. |
| Review/provenance | Source-scope changes, other-page independence, Undo, append-only history, accepted gaps, preserved analysis and custom/multiple responsibility pointers pass. Generated review and accepted-proposal XML are checked against TEI All. |
| Visual/accessibility diagnostic | Creation dialog inspected at 1440, 768 and 390 pixels; desktop reading inspected separately. The final diagnostic has no serious or critical Axe findings on these views. This is not a full assistive-technology or all-view audit. See [inspection results](editor-ui-inspection-2026-09-05.json). |
| Final local checks | Changed JavaScript modules pass Node syntax checking; git diff whitespace checks pass. Focused starter and index browser checks pass after the final accessibility/layout changes. These checks do not substitute for type checking or the production build. |
| `npm run verify` | Blocked: exact Node 24.13.0 is required; system Node is 22.14.0. |
| `npm run typecheck` | Blocked: `@typescript/typescript-win32-x64` is unavailable after dependency installation. |
| `npm run check:biome` | Blocked: `@biomejs/cli-win32-x64/biome.exe` is unavailable. |
| Vite production build using bundled Node 24.19.0 | Blocked by the unavailable/broken Rolldown platform binding. Bundled Node is also not the pinned release runtime. |

The dependency install completed but did not produce a usable set of native tools. The attempt to acquire the exact Node distribution was interrupted by incomplete network transfer. Toolchain pins and the lockfile were not relaxed to turn these failures into passing checks. No release, tag or deployment was created.

## Remaining work and next execution order

1. Restore the exact pinned Node/npm and native platform dependencies, then run type checking, Biome and the production build. Correct any findings before claiming a preview gate. Run the built artifact in Chromium and Firefox.
2. Finish preservation fault injection: quota/transaction failures, interrupted writes, simultaneous state changes, large checkpoints and unfinished auxiliary/intake forms. The native API cannot atomically commit XML and every image together.
3. Preserve and disclose document-type bindings when collision avoidance changes a manifest-mapped derived filename. Session schema bundles, explicit xml-model adoption and more general nested image references also remain open.
4. Replace the native `XSLTProcessor` compiled-Schematron dependency with an independently checked portable runtime. No replacement is integrated. Worker cancellation, capability reporting and reference-validator agreement remain required.
5. Complete the reading support matrix, unsupported-semantics disclosure, apparatus/witness controls and exact source-linked diagnostics/navigation.
6. Build the complete entry/metadata/register workspaces: searchable outline, safe entry creation/duplication in existing documents, identifier/reference handling, previewed batch changes and project search. The new thirty-entry starter is not a completed entry-management workspace.
7. Measure and freeze performance budgets, then implement justified virtualization, worker boundaries and remaining session/persistence extraction. Expand checked application coverage.
8. Run the specified editorial pilot and final acceptance, update release notes/version metadata, and prepare a release decision. These external/editorial acceptance steps cannot be replaced by synthetic tests.

## Review material

- [Desktop creation dialog](editor-starter-desktop-2026-09-05.png)
- [Narrow creation dialog](editor-starter-narrow-2026-09-05.png)
- [Desktop read-only view](editor-reading-desktop-2026-09-05.png)
- [UI inspection script](inspect-editor-ui-2026-09-05.mjs)

No alpha/beta milestone is declared complete while its required checks and remaining behavior are unresolved. The next substantive feature package is the entry/outline workspace alongside validator portability; the pinned build boundary must be restored before release acceptance.
