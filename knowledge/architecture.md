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
status: complete
created: 2026-02-05
updated: 2026-09-11
language: en
topics: ["[[Software Architecture]]", "[[TEI XML]]"]
related: [specification, data, design, testing]
---

# teiCrafter Architecture

## Application and canonical state

teiCrafter is a static browser application with ES modules in `docs/` and a Vite build in `dist/`. Document interpretation, editing, validation and serialization run locally. Optional image, authority and model services enter through explicit integration boundaries. [Integration](integration.md) owns deployment and external-service contracts; [data](data.md) owns serialized formats.

The complete XML source is canonical. `tei-document.js` retains that string and parses a namespace-aware tree with exact element, attribute and text offsets. TEI queries require the TEI namespace URI. Mutations splice source ranges and reparse the result without normalizing unrelated XML.

```text
canonical XML string
  -> namespace-aware offset tree
  -> document inventory
  -> Source Profile and Navigation Model
  -> reading, metadata, annotation and project views
  -> exact mutation
  -> new canonical XML string
```

`EditorSession` owns document identity, revision, history and dirty savepoint. A changed document enters through its mutation boundary; Undo and Redo restore canonical source through inverse patches. Byte-identical reprojection preserves revision, history and dirty state. Read-only mode rejects mutations and history changes while retaining navigation and inspection.

`editor-app.js` composes the session and controllers. `reading-view.js` renders source-backed cells and handles reading navigation; `inline-editor.js` supplies text and dual-reading controls; `annotation-ui.js` collects selections and dispatches annotations. Internal imports use one module URL per file so shared state has one instance.

## Staged input and restoration

`staged-input.js` gives one unfinished-input surface ownership through `hasChanges`, `value`, `apply` and `restore`. Ownership binds the session and canonical source captured on mount. A stale Apply is refused and retains recoverable input. Navigation, history and unrelated mutations cannot silently displace changed controls. XML, metadata, inline input and the specialized workspaces use this same boundary; context forms pause while the source or metadata pane owns it.

`session-recovery.js` commits independently keyed checkpoints in one IndexedDB transaction. Its promise resolves only after transaction completion. `recovery-coordinator.js` clones captured values before queueing, orders writes and explicit-ID deletion, and remains usable after storage failure. `document-facts.js` supplies recovery presentation and restoration; `working-copy.js` supplies portable encoding. The [recovery formats](data.md#local-recovery-and-portable-working-copies) retain unfinished state independently of schema validity.

Restoration establishes the intended recovery identity and document-specific schemas at the load boundary. It restores the dirty baseline and defers automatic persistence until source metadata, images and staged controls are installed. The first checkpoint therefore contains the complete restored state under one identity. Later Undo preserves the restored dirty baseline. Object URLs are recreated; native file permissions must be acquired again.

`project-documents.js` retains the active file and previously opened companions with separate names, sources, encodings, schemas, dirty states, reading preferences and images. It checks active identity, safe filenames and role uniqueness. Switching a companion first captures the outgoing session and persists recovery. The shell checks collection identity and relevant session, source, schema and image state across every asynchronous boundary before replacing the document. Edits or attachments made while storage is pending cancel that replacement. Storage failure leaves the current document available.

The target document's schema settings are installed before its first checkpoint. A newly created document receives its own effective defaults. The outgoing document retains its override in the collection. Saving the active file does not remove recovery needed by dirty companions.

## Source discovery and navigation

Source interpretation is a pipeline of pure projections.

| Module | Responsibility |
| --- | --- |
| `document-inventory.js` | Inventory TEI structures, attributes, distinct values, readable text, facsimile pointers and `xml-model` references |
| `source-profile-rules.js` | Derive capability evidence from observed structures |
| `schema-profile.js` | Inspect ODD, RelaxNG and XSD for conservative vocabulary evidence |
| `navigation-model.js` | Materialize source-backed units with exact ranges and labels |
| `source-profile.js` | Compose document evidence, schema evidence and manifest policy |
| `unit-labels.js` | Supply source-specific navigation and progress terminology |
| `edition.js` | Project reading cells, layers and facsimile alignment from the resolved profile |

Inventories are cached by immutable document identity. Sets retain first-occurrence order when exposing distinct values. `editionFromDocument` reuses an already parsed mutation. Review indexing likewise caches membership, unique IDs, TEI roots and records per document; progress computes one review state per unit without repeated whole-document traversal.

Observed capabilities determine the initial profile. Closed reachable schema evidence can constrain vocabulary, and project `uiProfile` can disable capabilities or request an available primary channel. Ambiguity and unavailable requests remain visible issues. The whole-document range provides the final fallback. Several navigation channels can coexist; the primary channel determines pager, review scope and unit XML. The historical `folios` API contains those primary units, whose labels come from `unit-labels.js`.

Reading granularity follows each local structure. Encoded `w` and `pc` elements yield token cells; other readable source yields exact text runs. `reading-policy.js` selects diplomatic, normalized or apparatus branches while preserving every alternative. Base apparatus reading prefers a lemma and then a reading. A selected witness supplies an explicit attribution policy. Prose respects source adjacency, token spacing respects punctuation and joins, and hidden alternatives contribute no whitespace. CDATA and selections without a safe interactive inverse remain editable through XML.

### Active schema evidence

`validation-view.js` owns the effective schema selection used for both authoring evidence and output. Schema inspection reuses the resolved dependency graph. Closed RelaxNG profiles support positive and negative vocabulary evidence; XSD contributes approximate positive evidence. ODD declarations can supply modules, elements and classes. Multiple vocabulary schemas combine conjunctively. Schematron contributes constraints without vocabulary allowances.

Inspection runs asynchronously and cannot prevent opening a source. Missing dependencies remove negative allowances and disclose partial or unknown evidence. Schema replacement or reset invalidates that evidence and recomputes the derived profile through a projection-only session transaction. Unchanged navigation retains the reading DOM and browser selection. This inspection has no authority to approve output.

## Project policy and mutation workspaces

`project-manifest.js` validates the declarative project contract and binds files to document types. `schema-set.js` normalizes ordered schema declarations, including legacy ingest forms. `project-path.js` confines relative paths to the granted folder; `project-schema-files.js` resolves nested dependencies relative to their containing schema and terminates cycles. A manifest overrides built-in source-signature fallbacks. The project layer supplies markup, navigation policy, indices, images, interchange and model mapping; [integration](integration.md#project-folder-and-schema-handoff) defines the external handoff.

Mutation modules preserve semantic no-ops and refuse operations without a lossless inverse. Literal input escapes ampersands and rejects XML-illegal characters. Unknown entity spellings cannot acquire a guessed expansion during editing.

| Surface | Projection and mutation boundary |
| --- | --- |
| Reading and inline annotation | Exact cell text, token attributes, wrappers and structural primitives |
| Complete header | `metadata-view.js` inventories every legitimate TEI header descendant and ordinary attribute; scalar changes use descending splices, structured content uses XML |
| Unit XML | Exact unit-span substitution in the complete document |
| Entries | `entry-model.js` supplies unambiguous scalar mappings, creation, ID-safe duplication, protected deletion and revision-bound batch plans |
| Witnesses | `witness-model.js` inventories definitions, groups and direct attestation, supplies explicit reading states and guards referenced identifiers |
| Wenzelsbibel | `wenzels-text-model.js`, `wenzels-image-model.js` and `wenzels-register-model.js` edit source-preserving project records |

`entry-workspace.js` adds list filtering, detail forms, creation, reference navigation and batch preview. Display sorting preserves XML order. Duplication rewrites supported internal pointers within the copied source; deletion checks descendant references within the active document. A confirmed batch becomes one canonical change and one history step. Restored fields and targets require a newly computed preview. [Data](data.md#entry-and-witness-encodings) specifies the supported encodings and pointer limits.

`witness-workspace.js` uses the shared staged contract for descriptions, exact witness XML and reading assignments. Reading projection discloses missing, ambiguous, omitted and fragment-boundary states. It does not infer inherited attestation from grouping or reconstruct unencoded witness text.

`wenzels-workspace.js` composes the project panels over the ordinary session and retained companion collection. `wenzels-form.js` supplies staged ownership. `wenzels-project-checks.js` checks linked records and offers a narrowly guarded, explicit sole-reading repair. `wenzels-profile.js` supplies project defaults; `iconclass-lookup.js` guards user-triggered requests against stale completion. `page-xml-import.js` and `page-xml-onramp.js` produce a separate draft through the same guarded load boundary. [Wenzelsbibel](wenzelsbibel.md) owns these editorial rules.

`starter-profiles.js` and `image-onramp.js` create deterministic TEI for explicitly selected source templates. They do not rebuild existing XML. Starter drafts enter the normal session, recovery and output paths; template availability does not establish a complete specialized workspace.

## Annotation and review projections

`span-annotations.js` turns exact, non-overlapping text segments into prefix-faithful boundary anchors and a TEI-level span group. `span-projection.js` resolves those pointers into reading ranges. Group identity travels with every segment so relinking and removal affect the complete discontinuous annotation. Cleanup removes only unreferenced anchors. An interchange projection can refuse shapes its target vocabulary cannot represent.

`annotation-progress.js` derives the Markup navigator from existing layer and note indexes. Filtering changes local UI state only. Result navigation uses the normal staged-input guard; deferred scrolling or focus checks the captured session, revision and view context.

`review-record.js` resolves a unique navigation target, supplies an identifier when needed and appends a review change in the relevant document or corpus-member header. `review-evidence.js` fingerprints the exact review scope; `review-progress.js` distinguishes current, changed, historical and reopened state. Duplicate targets and incompatible revision structures prevent writing. A matching verified record establishes current review only for its encoded scope. Annotation presence and linked register content outside that scope do not establish review.

`proposal-provenance.js` keeps model origin separate from per-responsibility acceptance. Whole-document origin is reconstructed from a root responsibility pointer and its header declaration after loading. The [serialized evidence](data.md#machine-provenance) remains the source of truth for these projections.

## Schema execution and currentness

`schema-validation.js` normalizes effective sources and resolves dependencies. RelaxNG and XSD execute through local libxml2-WASM in a module worker. The client correlates requests, the worker serializes execution, and cancellation terminates active work. Worker failure cannot authorize output. Raw Schematron and compiled SVRL have the explicit [runtime limits](data.md#schema-set-and-validation-result) described in the data contract.

`xml-schema-runtime.js` snapshots primitive inputs and copies the resource map before its first asynchronous step. Compiled validators are keyed by the complete schema graph. A bounded successful-result cache additionally binds exact XML content. Invalid results are not reusable successes; changes to the main grammar or any included resource invalidate reuse. Progress distinguishes preparation, parsing, validation and reuse.

`validation-view.js` binds results to session, revision, document object, projected source and ordered schema key. A custom-schema chooser captures a selection generation and session before reading its file. Replacement, reset and restore invalidate previous choices and abort active validation. Late completion can update only its owning controller and current snapshot. Manual validation clears a prior result so cancellation or runtime failure can be retried.

## Output and file operations

The output transaction resolves staged input, derives the exact target projection, validates every effective schema and rechecks the captured authorization before delivery. The schema set must be nonempty and every result valid. An unavailable dependency or stale result blocks output.

`output-controller.js` serializes native Save and binds filename, encoding, file version, images and recovery identity to the captured session. It checks currentness across asynchronous file operations and aborts a failed writable stream when supported. An older completed write cannot mark a newer revision saved or remove another session's checkpoint. `file-target.js` allocates unused derived names; image persistence compares actual bytes before reusing files. A download request does not establish disk persistence.

`project-output-controller.js` captures the whole collection, derives each file's target projection and schemas, and obtains separate authorization for every XML member. `project-bundle.js` creates one ZIP only after all decisions remain current. Cancellation, new staging, changed collection metadata or any invalid member prevents package delivery. Decoding checks the archive and restores editing state without importing output authorization.

IndexedDB recovery commits one checkpoint atomically. Native XML and image writes have no cross-file transaction. The validated package supplies a single portable delivery artifact. Capability-gated native handles enhance the [portable file contract](integration.md#browser-files-and-deployment) without changing those guarantees.

## Remote service boundary

`services/llm.js` keeps built-in providers and a registry of trusted code-level adapters. Project data selects prompts, mappings and responsibility; it cannot supply executable functions. Keys remain in memory and requests omit ambient credentials. Generated documents and proposals enter structural gates and ordinary canonical mutations. [Integration](integration.md#model-and-authority-services) defines what leaves the browser and how external results enter the editor.
