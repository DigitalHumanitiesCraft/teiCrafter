# teiCrafter: input and persistence refactoring

Date: 2026-09-05. This report follows the first implementation increment and supersedes its toolchain status. The target is still 0.2.0; package.json remains 0.1.0 until release acceptance.

## Implemented

- `output-controller.js` owns validated Save, Download and inline-GND export. Every path resolves visible input, captures output identity and checks it across asynchronous operations. Native Save is serialized. A delayed operation cannot mark another document or a newer revision saved, persist another session's images, or remove its recovery record.
- `recovery-coordinator.js` owns ordered checkpoint writes and explicit-ID removal. Captures are cloned before queueing, including nested configuration. Failed writes are reported and do not poison subsequent operations. The IndexedDB adapter still waits for transaction completion.
- `staged-input.js` replaces separate inline, source and metadata state checks with one surface contract. It preserves failed input, rejects stale Apply and prevents navigation/history/unrelated mutations from displacing unfinished edits. Disposed inline controls cannot clear a later editor.
- `inline-editor.js` owns text and dual-reading controls. `reading-view.js` owns cell rendering, keyboard traversal and dispatch to existing annotation/selection actions. The main editor shell fell from 3,362 to about 2,850 lines in this increment; the benefit is explicit responsibility and testable boundaries, rather than fewer total lines.
- Internal imports use one URL per module. Browser download URL management is shared. JavaScript checking now directly includes these controllers and the XML/metadata surfaces with their dependencies.
- The offline type proof runs only the repository's pinned compiler. It no longer uses a global TypeScript executable or an unpinned network fallback. Missing tooling remains a hard failure in the required verification gate.

The canonical raw XML and offset-splice architecture remains the mutation model. This is an incremental refactoring, not a framework migration.

## Verification

The exact portable Node 24.13.0 distribution and npm 11.6.2 are available on this host. The Node archive was checked against the official SHA-256 manifest. TypeScript, Biome and Rolldown Windows packages were restored from the lockfile's exact URLs and verified against its SHA-512 integrity values. Dependency pins and the lockfile were not relaxed.

| Gate | Evidence |
| --- | --- |
| Required verification | Passed with the pinned runtime: 88 Node proofs passed, 3 declared skips, no failures; harness negative self-test and synthetic tiers passed; TypeScript, Biome and Vite passed. |
| Persistence fault injection | Node proofs cover quota failure and retry, immutable queue captures, external file changes, repeated Save, failed writers, partial image persistence, revision changes and session switches during writing. Browser tests cover a real aborted IndexedDB transaction followed by successful recovery, failed inline input with Undo, metadata/XML Apply and input during a pending native write. |
| Built Chromium suite | Passed: 33 tests passed and 2 skipped (Firefox-only scenario and missing local UFBAS source), with one worker and the pinned build. The earlier project Save timeout did not recur in this complete run. |
| Built Firefox suite | Not green: 28 passed, 1 skipped (local UFBAS source absent), 6 failed. A corrected control-character injection and a targeted rerun resolved the failed-input test; the overlapping-layer scenario also passed on rerun. Four output/persistence timing cases still fail; details below. |
| Optional full corpus | Not certified. The local SZD Page-JSON source directory is absent; the required verification gate explicitly excludes this optional sweep. |

The large dynamically loaded libxml bundle still triggers Vite's chunk-size advisory. No threshold was raised to hide it. Source-only Chromium checks are diagnostic evidence and do not replace built-artifact browser tests.

## Firefox timing finding

The initial full run failed three XML-download scenarios, invalid-input fault injection, pending native writing and nested-project Save. Firefox's Playwright text insertion strips U+0001 before it reaches the control; the fault-injection test now assigns that invalid value and dispatches input explicitly, then invokes the real Enter/Apply path. That scenario passes on targeted reruns in Firefox and Chromium without changing product input validation.

The targeted Firefox rerun passed 2 of 6 cases. Four remain failing: cancellation of collected ranges followed by Download, the explicit Firefox Download/Save fallback, input during a pending native write, and nested-project Save. These hit existing download or validation timing limits. Static resources in the inspected trace completed in milliseconds. An isolated Firefox source-module probe on a minimal TEI returned a valid repository TEI All result after **86,514 ms**. This supports a validation-latency finding on this host; it does not establish the cause inside the runtime or a universal Firefox failure. No output schema requirement or test timeout was relaxed to obtain a pass.

The cross-browser release gate remains open. Investigate cold validator startup and schema compilation separately from validation, including main-thread responsiveness, before calling the output path dependable in Firefox. Passing pure persistence proofs and Chromium tests do not close this browser finding. [Machine-readable verification summary](verification-2026-09-05.json) retains the run boundaries.

## Documentation increment

The [documentation audit](documentation-audit-2026-09-05.md) inventories all maintained Markdown, reconciles current behavior with code, provides reproducible local link/metadata checks and preserves upstream and historical material. The [report index](README.md) is the entry point for current status versus planned scope. Documentation schema version 0.22 and application package version 0.1.0 remain separate.

## Running the pinned checks on this Windows host

The portable runtime is installed outside the temporary download cache. Select it for the current shell:

```powershell
$taskNode = Join-Path $env:LOCALAPPDATA 'teiCrafter/toolchains/node-v24.13.0-win-x64'
$env:PATH = "$taskNode;$env:PATH"
& "$taskNode/node.exe" "$taskNode/node_modules/npm/bin/npm-cli.js" run verify
& "$taskNode/node.exe" "$taskNode/node_modules/npm/bin/npm-cli.js" run test:e2e -- --workers=1
```

Other hosts should install the pinned versions from package.json and use the normal npm scripts. The portable installation does not change the system-wide Node selection.

## Remaining 0.2.0 work

This refactoring does not complete the entire product plan. After resolving the Firefox verification finding, the next bounded feature package is the entry/outline workspace: search and navigation, safe creation/duplication in existing TEI, identifiers/references and previewed batch changes. Portable Schematron execution, fuller apparatus/witness handling, auxiliary-form recovery, large-document performance budgets and the editorial pilot also remain open. See the [implementation plan](implementation-plan-0.2.0.md) and [workflow scope](workflows-and-adaptive-ui-0.2.0.md).

These results were captured before the [session-close checkpoint](session-close-2026-09-05.md), which records the verification boundary and re-entry task. No release or deployment has been created. The final schema-dependency help text now describes nested resources correctly; its schema proof, Biome and build checks passed after the copy change.
