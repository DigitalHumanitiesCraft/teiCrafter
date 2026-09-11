---
title: teiCrafter Integration Contracts
project:
  name: teiCrafter
  repository: https://github.com/DigitalHumanitiesCraft/teiCrafter
method:
  name: Promptotyping
  url: https://lisa.gerda-henkel-stiftung.de/digitale_geschichte_pollin
template:
  name: Vorlage Integration
  version: 0.1
  url: https://dhcraft.org/Promptotyping/promptotyping-document/integration
status: complete
created: 2026-06-07
updated: 2026-09-11
language: en
topics: ["[[TEI XML]]", "[[Data Flow]]", "[[HTR Pipelines]]"]
related: [project, data, specification, architecture, design, testing]
---

# teiCrafter Integration Contracts

## Exchange boundary

TEI is the primary exchange object. A project may add a manifest, schemas, image resolution, model mapping and a target-format projection. A bare document remains openable without project configuration. Source structure supplies interface evidence; project policy supplies editorial choices that cannot be inferred safely.

```text
upstream source
  -> optional deterministic conversion
  -> TEI with optional project configuration
  -> editorial work on canonical source
  -> exact target projection
  -> authorization by every effective schema
  -> native file or portable download
```

[Data](data.md) defines the encodings; [architecture](architecture.md) locates their implementation. [Testing](testing.md) defines evidence required for interoperability claims. Results for particular sources and environments belong in [dated reports](../reports/README.md).

## Project folder and schema handoff

A granted project folder can supply independently openable TEI, plaintext, `teicrafter.project.json`, schema resources, model-mapping Markdown and local images. The manifest binds filenames to document types and supplies project defaults. [The manifest contract](data.md#project-manifest) defines the canonical fields and ordered schema set. Mapping text is declarative source context and cannot execute code.

Upstream producers encode real navigation anchors. Page milestones and surfaces support page or facsimile navigation; entries, article divisions, speech turns, records, corpus members and source documents retain their TEI structures. Several channels can coexist. `uiProfile` can choose among available channels or suppress an inappropriate capability. An unsupported requested channel produces an issue and a source-backed fallback.

Schema resources have two roles. Conservative inspection supplies authoring evidence, while complete execution decides whether an exact output is authorized. Missing resources leave inspection evidence unknown and block schema-gated output. Every configured schema must succeed. A target-format conversion runs before validation, so the target repository receives the representation that was actually checked.

Served schemas resolve relative URL dependencies. Granted folders resolve nested relative RelaxNG and XSD resources within their root, with cycle and traversal limits. A standalone schema upload does not grant access to neighbouring files. XML catalogs and portable implicit dependency discovery remain outside the contract. Raw and compiled Schematron must satisfy the [supported runtime forms](data.md#schema-set-and-validation-result).

An uploaded override belongs to its document and replaces that document's project set until reset. Project collections and recovery retain those choices separately. New companion documents receive their own defaults. Opening a package restores schema settings; it grants no continuing validation authorization.

## Downstream editorial evidence

Projects can use the complete TEI header. The generic metadata interface exposes scalar fields and exact XML for structured content; specialized witness operations also create and edit supported header structures. Existing project-specific declarations remain preserved. Responsibility pointers used for generated material must resolve to local declarations after save and reopen.

| Evidence | Downstream interpretation |
| --- | --- |
| [Review Record](data.md#review-record) | A header revision change targets a unique source unit; current review requires its verified scope fingerprint to match |
| [Stand-off annotation](data.md#cross-structure-and-discontinuous-annotations) | A span group is one semantic annotation with ordered segments; flattening it loses discontinuity semantics |
| [Machine provenance](data.md#machine-provenance) | Origin survives acceptance through separate responsibility and acceptance tokens |
| [Entry and witness encoding](data.md#entry-and-witness-encodings) | Scalar forms edit supported mappings; apparatus attribution follows explicitly encoded pointers |

A review certifies only its encoded source scope. Annotation presence, historical markers and external register changes have separate semantics. Projects that require centrally controlled reviewer identities or rationale vocabularies must supply that editorial policy.

Entry duplication rewrites supported pointers inside the copied subtree. Deletion and batch checks operate within the active XML file. Cross-file references therefore require a separate editorial check. List sorting preserves source order, and a batch does not imply project-wide ID relinking or text replacement.

Witness reading selection changes a projection and preserves the exchange XML. Missing or ambiguous attribution remains explicit. External definitions and unsupported apparatus-location methods require source-level interpretation; the editor does not claim a complete reconstruction of witness text.

A target vocabulary must be able to represent current annotations. The inline-GND projection blocks cross-structure, discontinuous and overlapping spans that it cannot encode. No automatic flattening supplies a substitute target.

## Wenzelsbibel

The codex supplies word-level diplomatic text, `@orig` and `@norm`, page and line milestones, surfaces, graphics, zones and stand-off apparatus. Project identity or an explicit manifest workspace selects the specialization. IIIF resolution maps graphics to image services; source point geometry can provide zone bounds where rectangle attributes are absent.

The image-annotation document references the codex through cross-file `corresp` and range expressions. Shared persons, places and peoples reside in a separate register document. The workspace resolves links against explicitly attached, retained companion snapshots and edits the active file. Each companion keeps its own source, encoding, images, schemas and dirty state through switching, recovery and Working copy.

Those snapshots do not watch the filesystem. Later external changes require explicit loading and reconciliation. A validated project package delivers the retained XML collection as one artifact. Native Save remains document-local and does not provide an atomic write to every original file.

PAGE XML with optional METS produces a separate draft with recorded ordering and diagnostics. The [Wenzelsbibel contract](wenzelsbibel.md) owns its mapping, apparatus, verse, register and image forms and the authored editorial schema. A declared project schema set overrides bundled defaults. Schema validity does not establish the scholarly correctness of those choices or substitute for a missing source-project schema.

Local originals and redistributable structural twins have separate evidence roles, described in [testing](testing.md#real-material-and-reproducibility). An interaction claim based on the complete original codex must identify a run that actually supplied it.

## Other source projects

### UFBAS

The Urfehde object opens as a complete TEI book without a required manifest. Source evidence provides navigation and header access; repository TEI All supplies the default output schema. The portable file-and-download workflow supports review and output in Chromium and Firefox. The original remains local, and current whole-book or accessibility evidence requires a run with `UFBAS_TEI` supplied.

### Jeanne Hersch and zbz-ocr-tei

Hersch stores person, organisation and work references inline through GND-oriented attributes. `fromInlineGND` lifts them into the working register projection; `toInlineGND` derives the target for schema-gated output. A manifest declares `interchange: "inline-gnd"`, or a bare source is recognized by the exact `TEI@type="naegeli"` signature. An unchanged source remains a fixed point.

Local facsimile graphics can be granted separately. They remain external resources and are not implicitly copied by Save. Firefox retains the portable XML workflow when directory handles are unavailable.

### Stefan Zweig Digital and szd-htr

The upstream combination of catalogue TEI and handwriting-recognition Page-JSON requires deterministic conversion before editor intake. [Converter reference](converter-reference.md) owns the frozen byte-level contract. The converter remains a separate boundary so extraction changes cannot silently redefine editor semantics.

Converted TEI uses the same source profiles, metadata, review, annotation and output gate as other documents. A manifest can add type-specific markup, schemas, images and model mapping. [Worked examples](worked-examples.md) connects these exchanges to concrete objects.

## Model and authority services

Project data supplies editorial prompts, mapping text, responsibility and provider-neutral context. Transport is trusted application code. Built-in providers and a custom OpenAI-compatible endpoint cover standard JSON protocols; `registerProviderAdapter` permits trusted bundled code to implement request construction and response extraction for another protocol. A manifest cannot load executable adapters.

Endpoint validation rejects embedded credentials. Keys remain in memory, and model requests omit ambient browser credentials. Explicit model actions transmit their supplied source context; generated TEI and proposals then enter structural checks, provenance and human review before schema-gated output. Model availability is optional for deterministic editing.

Image and authority requests use their declared external services. Wenzelsbibel ICONCLASS lookup sends user-entered terms or selected notations to the official service. It does not send the edition text. Service responses remain suggestions or resolved resources until the user applies a supported source mutation.

## Browser files and deployment

Local file input and schema-gated Blob download form the portable contract in Chromium and Firefox. Native File System Access can add save-in-place, project-folder access, image folders and local schema dependencies where supported. Detection occurs at the action boundary. When no writable handle is available, Save uses the download path and directory-dependent actions explain their unavailable capability.

Native Save checks file identity and external modification before writing, then rechecks the captured source and authorization across asynchronous operations. XML and required image writes are separate browser file operations. Storage failures and superseded writes retain recovery; a requested download does not prove persistence on disk.

Working copy provides unfinished-state transport. Project package provides a validated collection ZIP. Both restore without native handles, and later outputs require current authorization. External facsimile-folder resources remain outside implicit native Save attachments. [Data](data.md#validated-project-package) defines archive validation and supported import layouts; [architecture](architecture.md#output-and-file-operations) defines currentness and cancellation.

GitHub Pages is configured to publish `main:/docs` as directly served modules. CI builds and verifies `dist/` and uploads that deployable artifact separately. Those deployment paths require their own runtime evidence. Public built-in examples are disabled through `FEATURES.examples`; local development hosts expose them. The public editor accepts user-supplied files. A missing local example or an HTML fallback response cannot be accepted as an XML edition.
