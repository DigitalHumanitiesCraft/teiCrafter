# Session close and re-entry

Date: 2026-09-05. The user requested a controlled session close, an Obsidian Active Work update, and commit/push of the completed increment. The Git commit containing this report identifies the development checkpoint. Application metadata remains 0.1.0 and the target remains 0.2.0. Release acceptance is still open.

## Saved scope

The checkpoint includes literal-input preservation, collision-aware file targets, independent recovery and Working copy, source-aware reading, fingerprinted review, retained accepted AI origin, read-only mode, nested project resources and deterministic document starters. Input, output, recovery and reading controllers now have explicit ownership boundaries. [Implementation and refactoring evidence](refactoring-status-2026-09-05.md) states their limits.

The [documentation audit](documentation-audit-2026-09-05.md) and [knowledge index](../knowledge/INDEX.md) provide the maintained project context. Historical observations retain their dates. Upstream notices and the frozen converter contract retain their source identity. The Obsidian project hub and Active Work entry point back to the repository for technical evidence.

## Verification boundary

The pinned required verification passed with 88 Node proofs passed and three rights-local Hersch skips. Type checking, Biome, the Python harness, Vite and the deployment-asset contract passed. Chromium completed with 33 passes and two declared skips. The corrected invalid-input injection passed in both browser engines. The final informational schema-dependency correction passed its schema proof, Biome and build checks.

Firefox remains an open release finding. Its full run passed 28 cases, skipped the unavailable real UFBAS source and failed six cases. The targeted rerun resolved two cases and retained four output/persistence timing failures. An isolated source-module probe returned a valid TEI All result after 86,514 ms on this host. The observation identifies a latency problem without assigning a cause inside the validator runtime. [Verification data](verification-2026-09-05.json) records commands and boundaries.

The optional SZD corpus sweep and the missing rights-local Hersch/UFBAS scenarios are not certified by the passing synthetic checks. Native permission dialogs, abrupt process termination and editorial user acceptance also remain outside this session's completed evidence.

## Next bounded task

1. Reproduce Firefox output latency with the pinned runtime. Measure resource loading, libxml module initialization, schema compilation, validation and browser responsiveness separately, with cold and warm runs.
2. Resolve the cause while retaining exact-output schema authorization. Re-run the failing Download/Save fallback, range-cancellation download, pending native-write and nested-project Save scenarios, then the complete built browser suite. Do not raise timeouts as a substitute for resolving the measured latency.
3. Continue the entry/outline workspace from the [0.2.0 plan](implementation-plan-0.2.0.md) once output is dependable. The broader performance envelope, portable Schematron execution, apparatus/witness controls and editorial pilot remain separate acceptance work.

## Re-entry commands

Use the pinned Node/npm versions from package.json. The portable Windows installation and its shell setup are documented in the [refactoring report](refactoring-status-2026-09-05.md#running-the-pinned-checks-on-this-windows-host).

```bash
git fetch origin
git status --short --branch
npm run verify
npm run test:e2e -- --project=firefox --workers=1
python reports/check-documentation-2026-09-05.py
```

Commit and remote synchronization are Git facts. Confirm that the containing checkpoint is reachable from origin/main before starting another increment. This close does not create a tag or release, and it does not certify a deployed site.
