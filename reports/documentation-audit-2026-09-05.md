# Documentation consolidation and audit

Date: 2026-09-05. Scope: repository-owned Markdown and project knowledge, including hidden issue templates. Generated outputs, dependencies and build artifacts are excluded. This is a documentation increment alongside the [input and persistence refactoring](refactoring-status-2026-09-05.md).

## Result

The README now starts from editorial tasks and a reproducible setup. The knowledge index routes readers to current contracts; the report index separates release scope, current verification and historical observations. The application remains a development increment toward 0.2.0, with package metadata at 0.1.0. No tag, release or deployment was created.

The audit corrected these substantive contradictions:

- Proposal confirmation retains responsibility and records acceptance separately. Current user guidance, data contracts, browser expectations and evaluation issue templates agree on that behavior.
- Recovery covers existing documents and drafts, including staged inline/XML/metadata values and loaded image bytes. Portable Working copy is distinct from validated TEI output and native file permissions.
- Nested project schema dependencies resolve relative to each containing file within the granted root. Standalone session schema uploads still lack an implicit dependency bundle.
- UTF-8 and optional BOM preservation is explicit; unsupported encodings are rejected. Metadata projections and reading controls do not imply complete support for every TEI structure.
- Letter, charter, legal-source, dictionary and article starters are distinguished from complete genre-specific editing workspaces. Dictionary entries and encyclopedia articles keep different TEI structures.
- Current review requires matching source evidence. Historical review, annotation coverage, schema validation and accepted model origin remain separate.
- Commands match package scripts and real paths. The local extraction example supplies its required `--name`; the harness example identifies the vendored schema explicitly.
- Historical UFBAS runs, earlier tooling failures and obsolete browser labels remain dated observations, not current acceptance claims. Brittle source line references in manual checks now name functions and modules.

## File disposition

All files below were included in the audit. Preserving a file is deliberate where its contract, attribution or historical role does not call for a rewrite.

| File | Disposition |
| --- | --- |
| [README](../README.md) | Rebuilt around workflows, setup, support limits and navigation. |
| [Project instructions](../CLAUDE.md) | Updated behavior and knowledge ownership; retained development and release authority rules. |
| [Security](../SECURITY.md) | Current storage, network and provenance descriptions checked against implementation. |
| [Code of Conduct](../CODE_OF_CONDUCT.md) | Preserved community policy and attribution. |
| [Knowledge index](../knowledge/INDEX.md) | Added reading routes, maintenance boundaries and shared vocabulary; schema version remains 0.22. |
| [Project](../knowledge/project.md) | Clarified audience, current workflow routes and remaining depth. |
| [Data](../knowledge/data.md) | Reconciled encoding, schemas, checkpoints, acceptance and source notices. |
| [Specification](../knowledge/specification.md) | Aligned staged input, persistence, read-only, provenance and output contracts. |
| [Architecture](../knowledge/architecture.md) | Updated controller ownership and asynchronous boundaries. |
| [Design](../knowledge/design.md) | Aligned pending controls, recovery, provenance and evidence wording. |
| [Testing](../knowledge/testing.md) | Updated coverage map, pinned checks, diagnostic/release distinction and local-fixture limits. |
| [Integration](../knowledge/integration.md) | Updated nested resources, review evidence and portable file handoff. |
| [Worked examples](../knowledge/worked-examples.md) | Added everyday task recipes and explicit implementation boundaries. |
| [Journal](../knowledge/journal.md) | Added decisions and corrected its maintenance guidance; preserved historical entries. |
| [Converter reference](../knowledge/converter-reference.md) | Preserved the independently versioned, frozen 0.6.1 conversion contract. |
| [Test guide](../test/README.md) | Rewrote executable setup, optional corpus boundaries and path guidance. |
| [Browser checks](../test/acceptance/BROWSER-CHECKS.md) | Corrected provenance/recovery expectations, added current scenarios and labelled historical results. |
| [Bug template](../.github/ISSUE_TEMPLATE/bug-report.md) | Added revision, schema/view and unfinished-input context. |
| [Feature template](../.github/ISSUE_TEMPLATE/feature-request.md) | Added task/material distinctions and a concrete expected result. |
| [Provenance export proposal](../.github/ISSUE_TEMPLATE/eval-provenance-export.md) | Corrected origin retention; separated existing TEI evidence from proposed richer export. |
| [Protocol export proposal](../.github/ISSUE_TEMPLATE/eval-four-tuple-export.md) | Corrected acceptance semantics and the proposed sidecar boundary. |
| [Gold-standard proposal](../.github/ISSUE_TEMPLATE/eval-gold-standard-hook.md) | Retained the unimplemented evaluation proposal; normalized punctuation only. |
| [HSA sample](../docs/data/editor/hsa-7711/README.md) | Clarified collision-safe first Save; preserved source and rights declarations. |
| [HSA mapping](../docs/data/editor/hsa-7711/mapping.md) | Preserved the project-specific mapping, including uncertain-date and no-invention rules. |
| [SZD notice](../docs/data/editor/szd/NOTICE.md) | Corrected the claim that this was the only committed real object; retained attribution and licence. |
| [TEI guidelines notice](../docs/data/tei/NOTICE.md) | Preserved pin, checksum, attribution and update procedure. |
| [TEI schema notice](../docs/schemas/tei-p5-4.11.0/NOTICE.md) | Preserved pin, checksum and licence. |
| [libxml notice](../docs/vendor/libxml2-wasm/NOTICE.md) | Identified both RelaxNG and XSD usage; preserved package provenance. |
| [libxml upstream README](../docs/vendor/libxml2-wasm/UPSTREAM-README.md) | Preserved verbatim; its two source-repository-only links are recorded below. |
| [OpenSeadragon notice](../docs/vendor/openseadragon/NOTICE.md) | Preserved package pin and licence. |
| [Report index](README.md) | Added current and historical entry points. |
| [Assessment](project-assessment-2026-09-05.md) | Labelled the pre-implementation baseline; retained original findings. |
| [Implementation plan](implementation-plan-0.2.0.md) | Linked current progress without rewriting requirements as completion claims. |
| [Workflow scope](workflows-and-adaptive-ui-0.2.0.md) | Updated status links and distinguished delivered starters from planned workspaces. |
| [First increment](implementation-status-2026-09-05.md) | Retained historical results with an explicit follow-up link. |
| [Refactoring status](refactoring-status-2026-09-05.md) | Records this increment's code and verification boundary. |
| [Session close](session-close-2026-09-05.md) | Records the checkpoint boundary, open acceptance and the next task with re-entry commands. |
| [July handoff](handoff-2026-07-10.md) | Added a historical banner; retained original paths, observations and action state. |
| [July inspection](eval-2026-07-08-demo-sightcheck.md) | Added a historical banner; retained original observations. |
| [This audit](documentation-audit-2026-09-05.md) | Inventory, rationale and reproducible documentation checks. |

## Verification and limits

Run `python reports/check-documentation-2026-09-05.py` from any directory. The script inventories repository Markdown with `rg`, checks UTF-8, local inline links and Markdown heading anchors, required knowledge metadata fields, `related` targets and the documentation version policy. [Machine-readable results](documentation-audit-2026-09-05.json) record the exact inventory and findings.

The upstream libxml README references `CONTRIBUTING.md` and `docs/performance.md` from its source repository. Those files are not part of this vendored package. The checker records these two explicit exceptions separately; it does not rewrite the upstream README or silently exempt other missing links.

This check is not a full CommonMark/YAML parser, external-link crawler or factual verifier. Code contracts, commands and product claims were reviewed separately against the current source and package scripts. External references were retained, not recertified against the live web. Existing licence text was preserved; no new rights clearance is claimed. Application gate results and open browser issues belong in the refactoring report.
