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
status: active
created: 2026-05-30
updated: 2026-08-24
language: en
version: 0.22
topics: ["[[Software Testing]]", "[[Evaluation]]", "[[TEI XML]]"]
related: [architecture, specification, data]
---

# teiCrafter Testing and Evaluation Harness

## Evidence policy

teiCrafter separates deterministic proof, formal validation, observed browser behaviour, accessibility evaluation, real-object evidence, and scholarly acceptance. A passing unit proof establishes only its pure contract. A browser run establishes the rendered interaction path. Schema validation establishes conformance to the schemas that actually ran. Automated accessibility checks establish the absence of the configured serious and critical findings in the exercised state. Editorial adequacy still requires a domain expert.

Test output is the source of record for run totals and transient status. This document records claims, methods, inputs, and known limits without duplicating those figures.

## Acceptance cascade

| Evidence layer | Purpose | Failure meaning |
| --- | --- | --- |
| Pure Node proofs | Pin offset, projection, mutation, manifest, schema, review, span, and adapter contracts | A deterministic invariant changed or regressed |
| Python and lxml harness | Compare text fidelity, structural invariants, and schema diagnostics across synthetic tiers | The editor changed scholarly content or structure outside the permitted delta |
| Static quality gate | Check JavaScript types, formatting, build output, and vendored deployment assets | The source or deployable artifact violates the repository contract |
| Playwright browser path | Exercise DOM, focus, events, timing, downloads, and browser capability fallbacks | The integrated user path is unavailable or behaves differently from the pure layer |
| Axe browser audit | Detect serious and critical accessibility findings in rendered states | The exercised state fails the automated accessibility floor |
| Real-object run | Expose scale, structure, vocabulary, and rendering combinations absent from small fixtures | The synthetic corpus did not represent the operational material |
| Expert review | Judge editorial meaning, provenance, and project suitability | Technical correctness has not established scholarly acceptance |

## Fidelity levels

The offline harness evaluates three stable properties.

**Text fidelity** compares the complete reading-text sequence before and after an edit. A no-op requires exact equality. An intentional edit permits only the declared text delta.

**Schema evidence** validates input and output with lxml-backed RelaxNG or Schematron where configured and reports new diagnostics. This comparative level does not authorize browser output.

**Structural integrity** compares namespace identity, pointer integrity, and protected element or attribute structure. The edit contract defines the permitted delta for each operation.

The offline MVP acceptance requires well-formed XML, text fidelity, and structural integrity. Browser Save and Download use the separate fail-closed output gate described below.

## Claim and evidence map

| Claim | Deterministic evidence | Browser or real-object evidence | Limit |
| --- | --- | --- | --- |
| Exact no-op and local splice fidelity | Generic round-trip, whitespace, namespace, mutation, file-encoding, and harness cases | Exact downloaded bytes are compared in Chromium and Firefox | Browser text decoding remains limited to supported XML encodings |
| Compositional Source Profiles | Source Profile, fixture, schema-wiring, and terminology proofs cover inventory, navigation, local cells, active schema reprojection, and labels | Type-diverse fixtures open through the Source panel in both browsers | Very large documents still use whole-string structural projections when a schema restriction changes navigation |
| Conservative Schema Profile | Schema Profile proofs cover ODD, reachable and included RelaxNG, broad or partial RelaxNG, XSD declarations, conjunctive sets, unavailable resources, and validation-only Schematron | Source-panel policy is exercised through manifest overrides | XSD evidence remains positive and approximate; raw Schematron supplies no authoring profile |
| Canonical manifest schema set | Manifest, schema-set, and project-schema-file proofs preserve order, repeated kinds, and type overrides | Project and session sources are named in the validation popover | Folder dependencies are limited to bare same-folder files |
| Complete header inventory | `metadata_view_check.mjs` covers common and unknown elements, all ordinary attributes, XML-only shapes, foreign decoys, escaping, and no-op fidelity | UFBAS opens its real header, edits a safe field, and retains the exact XML route in both browsers | Creation and restructuring remain XML operations |
| TEI Review Records | `review_progress_check.mjs` covers creation, update, clear, corpus scope, prefixes, shared targets, legacy markers, and fail-closed structures | UFBAS review, reopen, and Undo are exercised in both browsers | Default review details have no complete editing form |
| Cross-structure and discontinuous spans | `span_annotations_check.mjs` and selection-combination checks cover anchors, groups, projection, relink, cleanup, and invalid overlap | A multi-segment entity is collected and downloaded as schema-valid TEI in both browsers | Interactive collection is entity-focused and remains within one document |
| Multi-schema output authorization | `schema_validation_check.mjs` and validation-view checks cover ordered execution, invalid or unavailable aggregation, revision binding, exact projected bytes, and stale results | RelaxNG, XSD, raw Schematron, compiled Schematron, and blocked output paths run in both browsers | Browser Schematron implements the documented subset |
| Firefox fallback | File capability and output-path proofs isolate native and fallback decisions | Firefox loads through file input, downloads exact bytes, and uses the same schema-gated download for Save | Native directory and file handles remain browser capabilities |
| Open LLM adapters | `llm_adapter_check.mjs` and custom-provider checks cover registration, request mapping, response extraction, endpoint validation, and built-in protection | Provider selection shares the ordinary generation interface | Adapter discovery is trusted application code, with no executable manifest path |
| Persistent generated provenance | `generated_provenance_check.mjs` covers root responsibility, matching `respStmt`, preservation of existing tokens, and reload recognition | Generated drafts use the same load and banner path | A malformed or dangling pointer is intentionally insufficient |
| UFBAS operational workflow | Pure modules cover the mutations used by the scenario | The local real whole-book TEI exercises navigation, Source Profile disclosure, complete metadata, review, Undo, TEI All output, exact download, and Axe in Chromium and Firefox | The source is local and cannot be redistributed through the repository |
| Wenzelsbibel engine workflow | `wb_codex_check.mjs` and dual-reading proofs exercise the local real codex plus synthetic guards | The committed browser workflow uses a structural twin in Chromium and Firefox | Real browser automation and cross-file image-annotation editing require local project data |

## Source Profile fixtures

Committed fixtures cover paginated dictionary, paginated drama, spoken corpus, correspondence, critical edition, facsimile-only TEI, `sourceDoc`, and a document with several simultaneous capabilities. Each fixture asserts detected structures, available navigation, primary navigation, local reading-cell behaviour, and terminology. The unscoped Playwright matrix executes the same profile disclosure in Chromium and Firefox.

The fixture set tests composition rather than genre classification. Adding pages to a dictionary must retain entry navigation. Adding apparatus to a paginated edition must retain both capabilities. A manifest can choose among channels that have real anchors and receives an explicit issue for an unavailable choice.

## Schema runtime evidence

Schema tests distinguish resource discovery from validator execution.

### RelaxNG and XSD

Synthetic main schemas exercise RelaxNG `include` and `externalRef`, plus XSD `include`, `import`, and `redefine`. Tests cover served dependencies, same-folder project resources, missing dependencies, and nested paths that the project-folder loader cannot resolve. Missing resources yield unavailable and block output.

### Raw Schematron

Raw ISO Schematron fixtures exercise namespaces, default phases, scalar variables, assertions, reports, diagnostics, and common child or attribute contexts under XPath 1.0. Separate fixtures exercise stale results, invalid documents, unsupported includes or abstract patterns, XPath 2.0 expressions, and advanced match patterns. Unsupported semantics yield unavailable and block output.

### Compiled Schematron

Compiled XSLT fixtures exercise browser transformation and SVRL parsing. A stylesheet that returns non-SVRL XML is unavailable. A browser without `XSLTProcessor` receives the same blocking result.

### Revision and projection binding

Authorization tests validate a source string, then change the revision, document object, schema-set key, or target projection and assert that the prior result cannot authorize output. Inline-GND output validates the projected target bytes while leaving the working document unchanged.

Source Profile reprojection has a separate interaction invariant. Schema evidence that does not change navigation updates the derived profile without replacing the reading DOM. The cross-browser range-collector scenarios run while the default schema profile resolves asynchronously and therefore detect a late rerender that would erase the browser selection.

## Browser matrix

Chromium covers the portable file flow and capability-gated native File System Access where the environment exposes it. Firefox covers the portable flow with native picker absence asserted. Shared scenarios execute navigation, metadata, review, discontinuous spans, schema diagnostics, stale output rejection, downloads, keyboard focus, and accessible state in both engines.

The application declares `baseline widely available` through Browserslist. Playwright projects are the executable browser floor. Capability detection remains part of each scenario, so a missing native API is a tested fallback condition rather than a skipped product path.

The CI run is the clean-checkout portability check. Synthetic browser assets are explicitly tracked outside the rights-local fixture boundary, and harness self-tests load their implementation by repository path so that Windows package resolution cannot conceal a Linux failure.

## Real UFBAS evidence

The UFBAS scenario is enabled through `UFBAS_TEI`. It loads the supplied whole-book source through the browser file input and uses the real document throughout the workflow. The scenario verifies that Source Profile and navigation remain responsive, the complete header inventory is available, review survives the TEI mutation path, Undo restores state, TEI All authorizes the exact target, and the downloaded bytes match expectation.

Axe runs within that real state in Chromium and Firefox. The observed workflow completes without serious or critical findings in both engines. This includes the body and paragraph contrast correction that the real object exposed. The statement applies to the exercised UFBAS state and does not replace manual WCAG review.

## Real Wenzelsbibel evidence

`WB_CODEX` points the local engine proof at Codex 2759. The proof parses the complete source, confirms the word and project profiles, serializes a no-op identically, resolves IIIF image targets, and derives usable zone bounds from point geometry. Dual-reading proofs pin atomic diplomatic, `@orig`, and `@norm` edits.

The Wenzelsbibel browser example deliberately falls back to a committed structural twin when the rights-local real source is unavailable. Cross-browser interaction therefore establishes the UI path for representative structure. It does not establish real-object browser performance or interactive editing of the separate image-annotation document.

## Running the gates

The pinned Node and npm versions in `package.json` are part of reproducibility.

```powershell
npm ci
npm run verify
npm run test:e2e
```

Run the rights-local UFBAS scenario in both browser projects by supplying its path.

```powershell
$env:UFBAS_TEI = 'C:\path\to\TEI_SOURCE.xml'
npx playwright test --project=chromium --project=firefox --grep UFBAS
```

Run the real Wenzelsbibel engine evidence through its local path.

```powershell
$env:WB_CODEX = 'C:\path\to\codex-2759.xml'
node test/proofs/wb_codex_check.mjs
```

An absent rights-local object produces a declared skip for that object-specific proof. Synthetic regression evidence still runs. A complete evidence claim must state whether the real object was present.

## Acceptance boundary

Automated evidence establishes byte behaviour, schema behaviour, browser interaction, and the configured accessibility floor. It does not certify the scholarly correctness of an entity link, review rationale, normalization, project schema, or model proposal. Project editors retain that acceptance responsibility and can inspect the exact TEI evidence produced by every operation.
