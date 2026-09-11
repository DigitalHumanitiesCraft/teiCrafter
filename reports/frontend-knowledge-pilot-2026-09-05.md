# Frontend knowledge pilot, 2026-09-05

## Purpose and scope

This pilot applies the researched frontend architecture guidance to one small feature in teiCrafter. The existing Markup navigator gains an All/Notes filter over source-backed primary navigation units. The feature must preserve canonical XML, dirty state, and history while retaining the ordinary staged-source navigation guard.

The baseline is commit `0a45ed38bc944ad298097fd84d3bf9a319eb93fa`. The Vault context was committed as `f9761fe`. Work takes place on `codex/frontend-knowledge-pilot` in an isolated worktree. The original checkout and its pre-existing reports are outside the change. Further changes appeared in that checkout during the pilot, so integrating this branch requires an explicit comparison with that concurrent work. No release or remote publication is part of the pilot.

## Procedure and attribution limits

The coordinator chose a bounded feature from two candidates proposed by a GPT-5.6 agent. A second GPT-5.6 agent read the repository contracts and the Vault notes *Softwarearchitektur für Forschungstools* and *Observer Pattern und State Management in DH-Interfaces*, then implemented the feature and regression scenario. The coordinator ran checks and requested stronger evidence. The first agent reviewed implementation and test coverage independently.

Both agents already participated in the preceding research. The implementer also received an explicit acceptance contract and additional pre-review guidance about staged source and document replacement. The repository itself already documents canonical state and projection boundaries. There is no untreated comparison, randomized allocation, or independent timing baseline. This case cannot isolate the marginal effect of the Vault notes or establish faster delivery.

## Observed use of the knowledge

| Guidance | Implementer explanation before editing | Corresponding implementation choice |
| --- | --- | --- |
| One owner per state | The filter is transient UI state | The app owns one filter value and resets it on successful replacement |
| Derive views rather than duplicate facts | Existing annotation kinds already identify note-bearing units | Filtering consumes `annotationPageSummary`; no second note index is stored |
| A reading projection needs a no-mutation contract | Filtering must not enter the document mutation boundary | Browser checks compare exact downloaded XML and history controls around interaction |
| Reuse the responsible boundary | Navigation must preserve staged-source protections | The existing `gotoFolio` path reports success before focus or scrolling proceeds |

The agent's explanation is self-report. The matching code choices are observable, but the case does not show that the agent would have chosen differently without the notes.

## Review and course corrections

The first source-served Chromium run completed the functional assertions but failed Axe on the empty-state text contrast. The implementation changed the existing text token and retained the accessibility assertion. The initial failed log is preserved locally.

The coordinator then requested a full downloaded-byte comparison, continuous-view navigation, and preservation of populated Undo/Redo controls. These strengthen the observable contract beyond a comparison of a single staged XML unit.

Independent implementation review identified the following issues.

| Finding | Required correction |
| --- | --- |
| A queued animation-frame callback could act on a replacement document | Bind the callback to the successful navigation's session, revision, and unit |
| Inline-note focus and source-Apply invalidation lacked evidence | Exercise an inline note inserted through exact XML, navigation, and Undo |
| Successful paged navigation lacked evidence | Exercise it separately from continuous mode |
| Staged-buffer preservation was not asserted after refusal | Compare the staged text and history controls after rejected navigation |
| The focus outline remained after focus moved away | Limit the focus indicator to actual focus and exercise keyboard departure |
| Visual inspection showed the existing popover anchor could clip the new controls outside the viewport | Keep the popover and filter controls inside the viewport and assert their bounds |

These findings show why an independent review remained useful even when the implementer could explain the architecture guidance correctly.

One expanded test timed out while selecting a result. The coordinator initially suspected interception of the test runner's animation-frame scheduling. The complete action log and screenshot instead showed an off-screen control. The diagnosis was corrected before changing acceptance behavior. This reinforces the need to inspect the failure evidence rather than infer a cause from the last edited mechanism.

## Execution environment and evidence

The default machine runtime was Node 22.14.0 with npm 10.9.2. The repository requires Node 24.13.0 and npm 11.6.2. The exact-runtime acquisition attempt was unsuccessful; the official Node ZIP download timed out after 120 seconds with an incomplete file. Checks that could execute used the bundled Node 24.19.0, without changing the repository's version requirement.

The worktree uses the original checkout's installed dependencies through a local `node_modules` junction. No dependency or lockfile was changed. This is an environment reuse measure and does not establish clean-install reproducibility.

| Evidence | Result and limit |
| --- | --- |
| Required `npm run verify` | Failed at the explicit Node version guard |
| Required pure-proof selection | 77 passed, four reported skips; executed with Node 24.19.0 |
| Skipped proofs | Three Hersch object checks lacked local corpus material; the types check could not find a usable TypeScript command. Some synthetic assertions inside the Hersch workflow still ran |
| TypeScript | npm command lacked a `tsc` shim; direct invocation failed with `EBUSY` launching the native compiler |
| Biome | Native executable failed to launch with `EBUSY` |
| Vite production build | Failed loading the installed native rolldown binding |
| Firefox browser scenario | Could not launch because Firefox revision 1538 was not installed |
| Chromium source-browser scenario | Final corrected scenario passed in 11.5 seconds, including Axe, exact downloaded bytes, staged-buffer and history preservation, inline notes, paged/continuous navigation, stale callback rejection, and menu bounds at 1280×720 and 480×720 |
| Existing Chromium editor workflow | Passed against directly served source |

The report-local Playwright configuration serves `docs/` with Python while keeping the repository browser tests. This establishes source-browser behavior. It does not substitute for the production build, pinned-runtime gate, or Firefox acceptance. Private application revision state is not exposed through a production test hook; revision protection is supported by code-path review and the existing pure session proofs.

Local execution receipts are under `reports/frontend-knowledge-pilot/`. The scripts `run-proofs.mjs` and `source-browser.config.mjs` describe the supplementary checks. The standard production gates remain those in [testing](../knowledge/testing.md).

## Outcome

All findings in the bounded implementation review were addressed. The final source-browser scenario and scoped syntax/diff checks passed. The first contrast failure and the later clipping timeout remain visible in the local execution history; neither assertion was disabled to obtain a passing result.

The practical result is a bounded implementation with an explicit state contract and tests tied to that contract. The case supports using the knowledge notes as design and review context. The amount of assistance and the remaining environment failures prevent a claim of improved delivery speed or complete release readiness.

The knowledge documents describe the resulting behavior in their owning sections. Their shared metadata is aligned at the existing documentation revision 0.22 as required by the repository instructions; the journal keeps its separate revision. The application package version is unchanged.
