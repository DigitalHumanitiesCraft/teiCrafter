---
title: teiCrafter Testing and Evaluation Harness
project:
  name: teiCrafter
  repository: https://github.com/DigitalHumanitiesCraft/teiCrafter
method:
  name: Promptotyping
  url: https://lisa.gerda-henkel-stiftung.de/digitale_geschichte_pollin
template:
  name: Vorlage Testing
  version: 0.1
  url: https://dhcraft.org/Promptotyping/promptotyping-document/testing
status: complete
created: 2026-05-30
updated: 2026-09-11
language: en
topics: ["[[Software Testing]]", "[[Evaluation]]", "[[TEI XML]]"]
related: [architecture, specification, data]
---

# teiCrafter Testing and Evaluation Harness

## Evidence and acceptance

Technical claims require evidence at the layer where the behaviour occurs. Pure model proofs establish source transformations; schema execution establishes formal validity; browser scenarios establish interaction and delivery. Scholarly correctness and user acceptance require editorial judgment beyond those checks.

[The completion report](../reports/editorial-completion-2026-09-11.md) records the executed product evaluation, source availability, toolchain, results and remaining acceptance scope. [Reports](../reports/README.md) own run counts and timings. This document defines the repeatable method and the limits of each evidence class.

| Evidence | What it establishes | Limit |
| --- | --- | --- |
| Node contract proofs | Exact parsing, projection, mutation, state ownership and refusal behaviour against controlled inputs | Browser execution and scholarly interpretation need separate evidence |
| Independent Python/lxml harness | Reference/candidate text fidelity, structural invariants and formal schema evidence | Its comparative schema mode does not authorize browser output |
| Static checks and production build | Curated type coverage, coding checks and required deployment assets | A build alone does not establish a working interaction |
| Chromium and Firefox scenarios | Rendered workflows, downloads, recovery, asynchronous guards and capability fallbacks | Claims apply to exercised states and supplied fixtures |
| Axe checks | The configured automated accessibility floor in inspected views | Manual keyboard, assistive-technology and WCAG review remain necessary |
| Expert review | Correct editorial mappings, annotations and interpretation for a source project | Must identify the reviewed material and scope |

## Fidelity and adversarial checks

The independent harness separates text fidelity (L1), formal schema evidence (L2) and structural invariants (L3). A reference that is already invalid under the comparison schema can be assessed by comparing diagnostics around the intended change. Browser output remains subject to its mandatory current schema gate. The harness's negative self-test deliberately corrupts fixtures so a validator that misses loss cannot silently pass.

Exact-source checks compare complete expected strings or encoded downloads, preserving everything outside the declared edit. Round trips include no-op load/export, mutation, Undo and reopen. Prefixes, foreign namespace decoys, entity spelling, mixed content, duplicate IDs and attributes, unsupported encodings and stale selections expose unsafe assumptions.

| Contract | Deterministic evidence | Browser evidence |
| --- | --- | --- |
| Reading and canonical mutation | Parsing, literal text, dual readings, exact patches and source-preserving interchange | Inline/source edits, Undo and exact target download |
| Source-derived interface | Inventory and review-cache isolation, first-occurrence value order, compositional capabilities and conservative schema profiles | Type-diverse navigation and asynchronous reprojection without selection loss |
| Header, review and annotation | Scalar/XML boundaries, fingerprint scopes, namespace-aware review history, span grouping and pointer cleanup | Metadata, reviewer input, Markup/Notes navigation and discontinuous selections |
| Entries and witnesses | Encoding-specific scalar edits, ID-safe duplication, descendant-reference protection, batch currentness and explicit attestation | Creation, protected deletion, batch preview, witness reading, staged recovery and read-only guards |
| Persistent project collection | Exact XML/BOM and schema preservation, path/identity checks, ZIP integrity and controller authorization | Companion changes, failed or delayed storage, reload, Working copy and package reopen |
| Schema and file output | Ordered schema decisions, dependency graphs, projection binding, cancellation and external-version checks | Valid downloads, invalid/unavailable refusal, late completion and native/fallback delivery |
| Intake and external services | Deterministic PAGE/text conversion, provider mapping and provenance | Import diagnostics, generated drafts and guarded asynchronous suggestions |

The executable contracts live in [proofs](../test/proofs/) and [browser scenarios](../test/e2e/). [Architecture](architecture.md) identifies the implementation boundaries; [data](data.md) specifies the expected serialized forms.

## State-transition regressions

Restoration tests inspect actual IndexedDB `sessions` writes. Every first checkpoint after Working-copy import must use the intended identity and contain images, source metadata, schemas and unfinished input together. Recovery failure must retain the visible document and keep later storage usable. Duplicate recovery entries, a partial initial checkpoint or an imported dirty baseline lost by Undo are failures.

[Project transition scenarios](../test/e2e/project-transition-safety.spec.js) delay recovery while text or attachments change. The attempted switch must refuse the stale transition and preserve the changed collection. Other cases replace a document while custom-schema file reading is pending, ensuring the old choice cannot affect the new session. Newly created registers and imported drafts receive their own schema settings; outgoing companions retain theirs.

[Project package scenarios](../test/e2e/wenzelsbibel-project.spec.js) test the complete collection. A bad companion, cancellation or changed captured state must prevent a download. Successful reopen compares every XML payload and retained per-file metadata. Native Save is tested against its document-local contract; no test implies a filesystem transaction across separate files.

## Schema runtime evidence

Resource discovery and engine execution are separate assertions. RelaxNG `include` and `externalRef`, and XSD `include`, `import` and `redefine`, exercise served and granted-folder paths, nested dependencies, cycles, encoded filenames and missing resources. Resolved synthetic grammars run through the actual engine. Missing dependencies must produce an unavailable result and block output.

Raw Schematron covers the supported XPath 1.0 features alongside explicit refusal of unsupported semantics. Compiled stylesheets must produce SVRL; arbitrary XML output and absent `XSLTProcessor` are unavailable conditions. [Data](data.md#schema-set-and-validation-result) owns the feature boundary.

Authorization cases change the source revision, document object, target projection or schema key after validation and require refusal of the prior result. Inline-GND validates its exact target projection while preserving the working document. Reset and restore abort obsolete work. Manual validation must start again after cancellation or runtime failure.

[Worker proofs](../test/proofs/schema_worker_check.mjs) exercise request correlation, dependency transport, cancellation, late messages and restart. [Cache proofs](../test/proofs/schema_result_cache_check.mjs) alter XML, main grammar and included grammar independently, mutate caller-owned inputs during asynchronous work and exceed the bounded successful-result cache. No invalid result may become reusable authorization.

[The browser worker probe](../test/e2e/schema-worker.spec.js) measures heartbeats during real schema compilation, emits preparation and validation phases, compares the authorized download and rejects an invalid subsequent revision. Cold validation has an explicit fixture-specific budget; ordinary interaction and reused-result checks retain their own bounds. Timings belong to the measured source, browser and environment. The full original source is validated without vocabulary pruning or schema reduction.

## Browser and deployment scope

The normal [Playwright configuration](../playwright.config.js) builds and serves the production artifact in Chromium and Firefox. The application declares `baseline widely available` through Browserslist. Native file APIs are detected capabilities; their absence exercises the portable fallback and does not justify skipping the editing workflow.

A run against directly served `docs/` establishes that source-delivery path only. The [source-browser diagnostic configuration](../reports/source-browser-check.config.mjs) complements the production gate. GitHub Pages deployment and CI build artifacts follow the distinct [integration contract](integration.md#browser-files-and-deployment).

Public-example scenarios exercise actual missing-source responses and HTML with HTTP 200, ensuring a soft error cannot become an edition. Facsimile checks resolve the actual image URL, decode pixels and await a newly created overlay. An HTTP response or viewer container alone is insufficient evidence of image rendering.

## Real material and reproducibility

Committed fixtures cover compositional source structures such as paginated dictionaries, drama, speech, correspondence, apparatus, facsimile-only TEI, source documents and simultaneous navigation channels. Structural twins provide repeatable interactions without redistributing protected source material. [Data](data.md#source-material-and-rights) records source and licence boundaries.

| Input | Evidence enabled when supplied |
| --- | --- |
| `WB_CODEX` | Complete codex engine fidelity, word and normalization behaviour, source profile, image/zone resolution and opt-in browser editing/output |
| `WB_IMAGES` | Original image-annotation model and browser round trips |
| `WB_PAGE_ROOT` | Real PAGE/METS import mapping and source-integrity checks |
| `UFBAS_TEI` | Complete Urfehde navigation, header, review, output and Axe workflow in both browsers |
| Optional Hersch/SZD sources | Their explicitly declared corpus and interchange proofs |

Real browser cases modify temporary working copies and compare the expected complete output. The codex case validates an explicitly repaired copy, then packages that identical codex with the original image-annotation file and compares decoded payloads. Original sources must remain unchanged. A real-object claim requires that object's presence in the recorded run; synthetic success cannot establish it.

The strict evaluator records available inputs, file or directory hashes, repository content, Git revision, toolchain and browser versions before execution. It rechecks captured source and repository hashes at completion, including failed runs. Changed or unreadable captured inputs fail evaluation. Linux CI provides the clean-checkout check with committed synthetic assets and no local originals.

## Running the gates

Use the pinned Node/npm versions in [package.json](../package.json), Python with the harness dependency and installed Playwright browsers. [The test README](../test/README.md) supplies installation and focused commands.

```powershell
npm run evaluate:editorial
```

This is the strict local and CI completion gate. It runs required Node proofs, the independent harness and negative self-test, curated JavaScript typechecking, Biome, the production build and the complete browser matrix. It uses one browser worker, zero retries and forbids focused-only tests. A retry that later passes cannot hide the first failure.

Only exact source-dependent omissions and the Chromium instance of the Firefox-specific scenario are allowed. Their names and source-presence conditions are encoded in [evaluation-inputs.mjs](../test/evaluation-inputs.mjs) and [evaluation-results.mjs](../test/evaluation-results.mjs). Unexpected skips, missing executions, interruptions, flaky outcomes or infrastructure failures fail the evaluator. Optional full-corpus sweeps remain outside the default gate and run through `npm run verify:full-corpus`.

For the real Wenzelsbibel evaluation, provide all required originals explicitly.

```powershell
$env:WB_CODEX = 'C:/path/to/codex-2759.xml'
$env:WB_IMAGES = 'C:/path/to/Bildannotationen.xml'
$env:WB_PAGE_ROOT = 'C:/path/to/PAGE-export'
npm run evaluate:editorial -- --real
```

Missing required real inputs fail immediately. Set `UFBAS_TEI` separately to include the Urfehde case. `--editorial-only` narrows browser selection while retaining offline gates; its report must state that narrower scope. `--repeat=2` repeats each selected case rather than retrying failures.

`evaluation.json`, `playwright.json`, logs and browser reports reside under ignored `node_modules/.tmp/evaluation/`; traces also use `test-results/`. The [checks workflow](../.github/workflows/checks.yml) uploads only these selected report directories, explicitly includes hidden paths and retains synthetic CI evidence for seven days. Local real-source traces remain outside publication artifacts.

The pinned repository compiler is the only typecheck entry. Missing required tools fail verification. Type coverage follows [jsconfig.json](../jsconfig.json); a successful curated check does not claim that every application controller is a checked root.

## Editorial acceptance boundary

Automated evidence establishes the exercised byte, schema, state and interaction contracts. Entity identification, normalization, witness interpretation, review rationale, project-schema adequacy and model proposals require scholarly assessment. A release or project-specific user acceptance must identify that additional evidence and cannot be inferred from a technical run.
