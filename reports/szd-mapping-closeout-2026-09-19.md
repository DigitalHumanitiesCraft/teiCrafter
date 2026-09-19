# Local SZD mapping closeout, 2026-09-19

The local mapping increment is technically complete within the checks below. It connects frozen source pages and recorded rule/Jev choices to editable role decisions and a page-level TEI draft in the existing editor. Scholarly review of the source, decisions and reference annotations remains open. No release or publication was performed.

## Implemented boundary

The development route is `/szd-mapping.html`. It displays the content pages of `o_szd.1717` and `o_szd.1701`, using the frozen `typesafe-lab/results/szd-blind-2026-09-19` experiment. The interface contains three source pages and eight editable roles per page. It loads cached proposals without reference answers or correctness labels. This increment made no model API calls.

The transcription is immutable. Editors assign exact text spans, adopt recorded proposals, mark absence or uncertainty and confirm individual decisions. Working copies bind to the source hash, page and experiment. Confirmation records a property of the working copy without authenticating a reviewer. The TEI representation preserves source text and overlapping role spans through anchors, with decision provenance and a local facsimile reference.

The handoff opens a distinct unsaved SZD mapping draft in the existing editor. Its normal schema gate still controls TEI Save and Download. The preview itself is not an output authorization. Later editor mutations do not synchronize back to the mapping decisions. The draft contains a source page, not a reconstruction of the complete correspondence object.

## Corrections during closeout

- Extracted source-selection and working-copy contracts into `szd-mapping-state.js`. Textarea CRLF normalization no longer changes the source offsets used for annotations.
- Rejected contradictory absent/uncertain values and restored decisions from another source or experiment.
- Protected newer browser records against stale-tab writes. Failed writes retain in-memory work across page switches and warn on navigation.
- Preserved changes against asynchronous restore races.
- Replaced the misleading current-user confirmation attribution and added a distinct editor mapping-draft identity and recovery checkpoint.
- Included both mapping suites in `npm run verify` and the pure mapping modules in the curated typecheck.
- Reconciled the earlier optional complete-object SZD tests with the strict evaluator. Explicit source directories are validated and hashed; only exact documented missing-source skips are allowed. Browser outputs now go to the test output directory and cannot mutate the source inventory.

## Executed verification

Environment: Windows, Node `24.13.0`, npm `11.6.2`, installed repository dependencies. Base repository revision: `b2d293e`. The accompanying [evidence manifest](szd-mapping-closeout-2026-09-19.json) binds the checked source files and log by SHA-256.

| Check | Observed result |
| --- | --- |
| `npm run test:szd-mapping` | 14 passed, no skips or failures. Includes all three local source pages with both rules and Jev, exact source preservation and validation against bundled TEI All. |
| `npm run verify` | Exit 0, `VERIFY PASSED`. Mapping tests passed; required proof suite: 107 passed, one explicit optional skip, no failures. |
| Independent fidelity harness | Negative self-test passed; all four synthetic source tiers passed. |
| Curated typecheck and Biome | Passed through the standard verification gate. |
| Production build | Passed. Existing classic OpenSeadragon script and large-chunk warnings remain; these were warnings, not failed checks. |
| Browser interaction on the local source server | Exact range change, manual assignment, confirmation, Undo, rejected wrong-source JSON, accepted matching JSON and Undo after restore all observed. |
| Editor handoff | Correct text and facsimile observed; the editor displays `SZD mapping draft (unsaved)` and retains `Reviewed 0/1`. |
| Independent agent review | No remaining concrete regression identified in the changed source-selection, restoration, persistence, export and handoff paths. |
| Strict evaluator follow-up | `evaluation_inputs_check.mjs`, `evaluation_results_check.mjs`, browser-spec syntax and Biome passed after the optional-source contract correction. The full verification log predates this final evaluator-only correction. |
| Documentation links | 207 local Markdown file targets checked in the affected repository documentation, none missing. Added Vault links and section targets checked separately. |
| Frozen experiment | The laboratory's `evaluation.blind_szd verify` completed with exit 0 after the UI work. |

The optional skipped proof was `szd_research_refactor_check.mjs`: its separate complete-object export directory was not supplied for this run. It is unrelated to the three-page mapping fixture, which was present and tested. Full-corpus sweeps and the complete production browser matrix were not rerun. The browser observations use the Codex in-app browser on `127.0.0.1:5188`; they are not a cross-browser acceptance claim.

The complete gate log remains local at `node_modules/.tmp/szd-mapping-verify.log`. The evidence manifest records its hash. Research data, scans, API credentials and transient test files remain outside version control.

## Knowledge and remaining review

Current contracts live in [architecture](../knowledge/architecture.md#local-szd-source-mapping), [specification](../knowledge/specification.md#local-szd-mapping-contract), [design](../knowledge/design.md#local-szd-mapping-interaction) and [testing](../knowledge/testing.md#local-szd-mapping-checks). The [fixture README](../docs/data/editor/szd-mapping-local/README.md) records regeneration and provenance. The external laboratory overview and existing Vault methodology/project documents link this implemented path without copying the experiment results into the Vault.

The frozen evaluation remains unchanged. Its reference annotations were created by separate agents from the same model family; human reference approval is still absent. Technical checks do not establish correct role interpretation, correct OCR, complete correspondence encoding or reduced human editing effort. Those judgments remain part of source-based review with the user.
