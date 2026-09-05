---
title: teiCrafter Architecture
project:
  name: teiCrafter
  repository: https://github.com/DigitalHumanitiesCraft/teiCrafter
method:
  name: Promptotyping
  url: https://lisa.gerda-henkel-stiftung.de/digitale_geschichte_pollin
template:
  name: Vorlage Architecture
  version: 0.1
  url: https://dhcraft.org/Promptotyping/promptotyping-document/architecture
status: active
created: 2026-02-05
updated: 2026-08-24
language: en
topics: ["[[Software Architecture]]", "[[TEI XML]]"]
related: [specification, data, design, testing]
---

# teiCrafter Architecture

## Architectural form

teiCrafter is a static browser application. ES modules load directly from `docs/`, and the service boundary consists of optional remote image, authority, and LLM requests. Editing, project interpretation, validation, output authorization, and serialization remain local to the browser.

The architecture separates canonical source from every convenience view. `tei-document.js` parses XML into a namespace-aware offset tree while retaining the original string. Higher layers derive inventories, profiles, navigation units, reading cells, metadata fields, review state, and span layers. Mutations return a new parsed document created from exact source splices.

```text
XML source string
  -> namespace-aware offset tree
  -> document inventory
  -> Source Profile and Navigation Model
  -> reading, source, metadata, review, and context projections
  -> exact mutation
  -> reparsed XML source string
```

## Canonical state and session boundary

`tei-document.js` owns parsing, namespace identity, raw ranges, attribute ranges, and splice primitives. It never normalizes the whole document. TEI queries require the TEI namespace URI, so a foreign element named `teiHeader`, `change`, or `span` remains unrelated data.

The editor session adds identity and time to that immutable document value. Session state records the loaded document, a monotonically changing revision, dirty savepoint, patch history, file encoding and target, project context, and cancellable asynchronous work. A successful operation commits through one mutation boundary and invalidates revision-bound projections such as schema authorization.

`editor-app.js` coordinates the session, view controllers, output projections, and file actions. It also restores whole-document generated state after load by calling `hasGeneratedDraftProvenance(doc, responsibility)`. That predicate requires a root `@resp` token and a matching header `respStmt`, which prevents a transient UI flag from becoming the source of provenance truth.

## Source discovery and navigation

Source interpretation is a pipeline of small pure modules.

| Module | Responsibility |
| --- | --- |
| `document-inventory.js` | Inventory TEI structures, attributes, values, reading text, facsimile pointers, and `xml-model` references |
| `source-profile-rules.js` | Convert observed structures into named capability evidence |
| `schema-profile.js` | Inspect ODD, RelaxNG, and XSD for conservative authoring evidence |
| `navigation-model.js` | Materialize source-backed navigation channels with exact raw ranges and labels |
| `source-profile.js` | Compose document evidence, optional schema evidence, and manifest `uiProfile` policy |
| `unit-labels.js` | Project source-specific singular, plural, and position labels into shared UI controls |
| `edition.js` | Build reading cells, layers, facsimile alignment, and the compatibility edition shape from the resolved profile |

`source-profile.js` starts with observed capabilities. It can then constrain a capability when a closed Schema Profile proves that the structure is disallowed. Project policy may disable a capability or request an available primary navigation channel. The resolver records ambiguity and unsatisfied policy as issues. The final fallback is the whole document, which always has a real source range.

Navigation channels can coexist. The primary channel determines pager, review scope, source-unit XML, and progress language. Other channels remain available as context. `edition.js` preserves its historical `folios` collection as an API compatibility surface, but those items now represent primary navigation units and should be described through `unit-labels.js`.

Reading granularity is local. Text under `w` or `pc` projects as token cells. Other readable text projects as exact text runs. Cell construction therefore follows the local XML structure instead of a document-wide word or line flag.

### Active Schema Profile flow

`validation-view.js` owns the effective schema set because the same repository, project, or session selection governs output authorization. The controller passes that ordered set to `schema-profile.js` after the initial document projection. The inspector reuses the validation resource graph for RelaxNG includes and XSD includes or imports, then combines vocabulary profiles conjunctively. Schematron sources are recorded as constraints without contributing vocabulary allowances.

Schema inspection is asynchronous and has no authority to block opening. A missing dependency or parse failure produces unknown profile evidence and a visible issue. It cannot produce a negative allowance. A session schema upload or reset invalidates the old evidence and starts a fresh inspection. The resulting Source Profile replaces derived editor state through a projection-only session transaction, which preserves source bytes, revision, history, and dirty state. Output validation retains an independent fail-closed decision over the exact target bytes.

## Project policy and schema resources

`project-manifest.js` parses `teicrafter.project.json`, validates known fields, binds files to document types, and resolves effective per-file policy. `uiProfileForFile` merges project and type policy. The manifest parser emits the canonical ordered `schema.schemas` shape.

`schema-set.js` normalizes canonical and legacy schema declarations into ordered entries. It retains repeated types and reports malformed declarations as issues. `project-schema-files.js` loads top-level project resources plus the supported bare same-folder RelaxNG and XSD dependencies from a granted directory handle. Served projects resolve dependencies through URLs. A session upload represents a complete override and has only the selected resource unless the runtime can fetch its references.

The project layer also supplies markup, TEI authoring scope, indices, reconciliation, image resolution, declared views, interchange, and type-aware LLM settings. Built-in project profiles provide the same runtime shape for bare files recognized by an exact source signature. A parsed manifest takes precedence over source-signature fallback.

## Reading and mutation projections

Each editing surface has a pure projection and a lossless inverse.

| Projection | Mutation boundary |
| --- | --- |
| Reading text | Cell-core text replacement, token attribute update, wrap, unwrap, replace, or structure primitive |
| Entity and scholarly layers | Inline exact wrapper or TEI stand-off record |
| Complete header | Simple field splices or exact header XML substitution |
| Unit XML | Exact unit-span substitution into the complete document |
| Review state | Target identifier plus header revision record |
| Inline-GND interchange | Target-only serialization projection that leaves editor state unchanged |

All mutation modules return the input document when an operation is invalid, ambiguous, or semantically unchanged. The app commits only a changed, reparsed document. Undo and Redo apply inverse patches to canonical source, so derived profiles and views are rebuilt from the resulting document.

## Complete header architecture

`metadata-view.js` identifies the legitimate TEI header and inventories every descendant TEI element and ordinary attribute in source order. Common-field definitions provide labels and groups. They no longer limit coverage.

Each inventory item carries an exact projection category. Text-only and empty paired elements expose their content span. Ordinary attributes expose their value span and lexical surroundings. Mixed or structured elements, self-closing elements, the header itself, and namespace declarations route to exact XML. Applying a form computes every changed value, XML-escapes it, and performs descending splices so earlier offsets remain valid. A form with no semantic change returns the original document.

## Review architecture

`review-record.js` reads and writes standard TEI review changes. A review transaction performs these steps as one lossless operation.

1. Resolve the current primary navigation unit to an unambiguous TEI element.
2. Reuse its unique `xml:id` or insert a prefix-faithful unique identifier.
3. Select the relevant document or corpus-member header.
4. Reuse a compatible `revisionDesc` container or create one.
5. Add, update, split, or remove the target on a review `change` while preserving unrelated history.

The transaction refuses duplicate identifiers, incompatible revision structures, and structured rationale edits that lack a safe inverse. `review-progress.js` projects these records onto primary navigation units and also reads the legacy marker. Annotation progress is calculated separately.

## Stand-off span architecture

`span-annotations.js` accepts exact text ranges. It rejects empty, non-text, or internally overlapping input. The module generates stable group and boundary identifiers, inserts prefix-faithful `anchor` milestones at descending offsets, ensures a TEI-level `standOff`, and adds one `spanGrp` whose ordered `span` children reference the boundaries.

`span-projection.js` resolves local pointers back to exact source ranges. `edition.js` merges resolved entity spans into the same cell-layer model used for inline mentions. Group identifiers travel with every projected segment, which lets the annotation UI relink or remove the complete discontinuous object. Cleanup deletes only anchors without another reference.

The interactive selection controller accumulates additional entity segments across primary units. Existing inline overlap or structural crossing selects the stand-off route. The inline-GND output projection inspects these spans and blocks shapes that its target vocabulary cannot represent.

## Output authorization

The output path is a transaction across projection, validation, and file I/O.

```text
current session and revision
  -> derive exact target bytes
  -> derive effective ordered schema set
  -> execute every schema
  -> bind aggregate result to session, revision, document, bytes, and schema-set key
  -> recheck binding
  -> write native file or trigger download
```

`schema-validation.js` owns schema source normalization and execution. RelaxNG and XSD run through local libxml2-WASM. Raw Schematron is compiled through the documented browser XPath subset. Precompiled Schematron runs through `XSLTProcessor` and must return valid SVRL. Every runtime limit becomes an unavailable result instead of an implicit pass.

`validation-view.js` owns the revision-bound authorization snapshot and explanatory UI. It compares the exact document object and projected source in addition to scalar revision identifiers. `editor-app.js` asks the view to validate, awaits completion, and checks authorization again before file output. External file-version conflicts use the same fail-closed principle.

Repository TEI All enters only when no project schema or session override exists. Multi-schema aggregation succeeds when the result set is nonempty and every entry is valid. Ordering is retained for diagnostics and reproducibility.

## Browser and file capability boundary

The portable path uses an `<input type="file">` for ingest and a Blob download for output. Firefox exercises this route directly. Save without a writable native handle delegates to the same schema-gated download operation.

Native File System Access appears behind feature detection. A Chromium browser that provides file and directory handles can save in place, scan a project folder, and resolve local images or schema dependencies. These capabilities enhance persistence and project integration without changing the canonical document or output gate.

Browserslist expresses the deployment baseline as `baseline widely available`. Playwright runs the application in Chromium and Firefox. Accessibility checks execute in the browser against rendered state, including the real UFBAS workflow.

## LLM service boundary

`services/llm.js` maintains immutable built-in providers, a configurable OpenAI-compatible provider, and a registry for trusted code-level adapters. A registered adapter declares endpoint, model policy, authentication mode, request construction, and response extraction. Registration validates the identifier and endpoint before adding the provider to the shared catalogue.

The request layer keeps API keys in module memory and sends `credentials: "omit"`. Project manifests select prompts, mappings, and responsibility pointers. They cannot supply functions. Generated documents and proposals return through structural gates and ordinary lossless mutations, so remote model output never becomes a parallel document state.

## Failure model

The architecture prefers an explicit unavailable or unchanged result when a lossless inverse cannot be proven. Important fail-closed boundaries include malformed XML, foreign namespace decoys, ambiguous source structures, stale asynchronous results, duplicate review targets, unresolved span pointers, unsupported schema dependencies, unsupported Schematron features, invalid SVRL, external file changes, and target formats that cannot represent current annotations.

Every refusal belongs at the layer that has enough information to explain it. The UI then exposes that reason without mutating canonical state.
