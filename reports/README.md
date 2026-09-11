# Project reports

Use [knowledge/INDEX.md](../knowledge/INDEX.md) for current product and technical contracts. This directory holds plans, dated observations and working-state reports. A plan describes intended scope; a report certifies only the checks and environment it records.

## Current entry points

| Document | Role |
| --- | --- |
| [Editorial completion and evaluation](editorial-completion-2026-09-11.md) | Follow-up implementation of witnesses, entries, batch changes and persistent project packages; current evaluation boundary. |
| [Knowledge consolidation](documentation-report-2026-09-11.md) | Complete knowledge-folder reconciliation, decision-journal compaction, process inbox and reproducible documentation checks. |
| [Wenzelsbibel workflow](wenzelsbibel-workflow-2026-09-11.md) | Initial specialization, branch integration and real-source findings before the editorial-completion follow-up. |
| [Session close and re-entry](session-close-2026-09-05.md) | Earlier development checkpoint; the editorial completion report supplies current implementation and verification evidence. |
| [Input and persistence refactoring](refactoring-status-2026-09-05.md) | Earlier implementation and browser observations, including the validator latency that prompted the worker investigation. |
| [Documentation audit](documentation-audit-2026-09-05.md) | Markdown inventory, resolved contradictions, preservation decisions and local link checks. |
| [0.2.0 implementation plan](implementation-plan-0.2.0.md) | Release requirements and acceptance catalogue; implementation status is recorded in the editorial completion report. |
| [Workflows and adaptive interface](workflows-and-adaptive-ui-0.2.0.md) | User tasks, examples, genre distinctions and intended interface depth. |

## Earlier evidence

| Document | Boundary |
| --- | --- |
| [First implementation increment, 2026-09-05](implementation-status-2026-09-05.md) | Initial safety and starter changes. Its toolchain failures and source-browser counts describe that earlier increment; the refactoring report supersedes their current status. |
| [Assessment baseline, 2026-09-05](project-assessment-2026-09-05.md) | Findings against the inspected baseline, before implementation. Findings are preserved as evidence, not a list of currently reproducible defects. |
| [Handoff, 2026-07-10](handoff-2026-07-10.md) | Historical branch, tooling and action state. Its paths and next steps are not current instructions. |
| [Demo inspection, 2026-07-08](eval-2026-07-08-demo-sightcheck.md) | Historical source-browser observations and rights-local material. |

Supporting scripts, JSON and images retain the date of their observation. `source-browser-check.config.mjs` is a diagnostic source-server configuration; the root Playwright configuration tests the built artifact. New verification outcomes should identify the command, runtime, fixture availability, pass/fail/skip status and limitations. Do not replace earlier failures with later passes.
