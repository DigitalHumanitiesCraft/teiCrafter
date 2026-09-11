---
title: teiCrafter Data and Test Material
project:
  name: teiCrafter
  repository: https://github.com/DigitalHumanitiesCraft/teiCrafter
method:
  name: Promptotyping
  url: https://lisa.gerda-henkel-stiftung.de/digitale_geschichte_pollin
template:
  name: Vorlage Datengrundlage
  version: 0.1
  url: https://dhcraft.org/Promptotyping/promptotyping-document/data
status: complete
created: 2026-05-27
updated: 2026-09-11
language: en
topics: ["[[TEI XML]]", "[[Data Modelling]]"]
knowledge-sources:
  standards:
    - label: TEI P5 Guidelines
      uri: https://tei-c.org/guidelines/p5/
    - label: TEI All RelaxNG
      uri: https://tei-c.org/release/xml/tei/custom/schema/relaxng/tei_all.rng
    - label: IIIF Presentation API
      uri: https://iiif.io/api/presentation/3.0/
related: [project, specification, architecture, testing]
---

# teiCrafter Data and Test Material

## Canonical XML contract

The complete XML source string is canonical. Untouched UTF-8 source retains whitespace, prefixes, quoting, entity spelling and byte-order-mark state. A semantic no-op returns the original source. Unsupported or conflicting encodings are rejected before editing.

TEI identity is the namespace URI `http://www.tei-c.org/ns/1.0`; a default namespace and an arbitrary bound prefix are equivalent for interpretation. Foreign elements with matching local names remain preserved source data and do not enter TEI operations. [Architecture](architecture.md) describes the offset parser, projections and mutation boundary.

## Inputs and outputs

| Form | Data contract |
| --- | --- |
| TEI XML | UTF-8 with optional BOM; Save and Download encode the exact schema-authorized target projection |
| Plaintext or Markdown | Deterministic draft with blank lines as paragraphs and `\|N\|` as a page milestone; selected starter templates supply their declared encoding |
| Project folder | TEI or text sources beside a declarative manifest, mapping text, schema resources and optional images |
| PAGE XML and optional METS | Deterministic separate TEI draft with explicit page ordering and retained import diagnostics; details in [Wenzelsbibel](wenzelsbibel.md) |
| Working copy | Portable JSON for canonical and unfinished editing state, including companions and images, without an output-validation requirement |
| Project package | One validated ZIP containing the XML collection, eligible images and restoration metadata |
| Model-generated TEI | Self-contained, well-formed TEI P5 with required header and text body, document responsibility and separate human-review evidence |
| Model proposals | Bounded JSON proposals mapped to exact source operations, with persistent origin and independently recorded acceptance |

Plaintext conventions transport explicit structure. They do not interpret ad hoc pseudo-syntax as scholarly assertions. Deterministic imports and model-generated drafts retain distinct provenance.

## Project manifest

`teicrafter.project.json` declares project policy. Its canonical schema declaration is an ordered `schema.schemas` array; repeated schema types are permitted.

```json
{
  "teicrafter": 1,
  "name": "Editorial project",
  "schema": {
    "schemas": [
      { "type": "relaxng", "path": "project.rng", "name": "Structure" },
      { "type": "schematron", "path": "editorial.sch", "name": "Editorial rules" }
    ]
  },
  "uiProfile": {
    "primaryNavigation": "entries",
    "disableCapabilities": ["pages"]
  },
  "documentTypes": [
    {
      "key": "correspondence",
      "label": "Correspondence",
      "uiProfile": { "primaryNavigation": "sections" }
    }
  ],
  "files": { "letter.xml": "correspondence" }
}
```

Each schema entry has `type`, `path` and optional `name`. Manifest types are `relaxng`, `xsd` and `schematron`. Legacy singular declarations normalize to this runtime form on ingest.

Project `uiProfile` supplies defaults. A matching document type overrides the primary-navigation field and adds disabled capabilities. Requested channels require source anchors; unsatisfied policy produces an issue and a source-backed fallback. The derived inventory, Source Profile and Navigation Model are revision-specific projections described in [architecture](architecture.md#source-discovery-and-navigation).

Other fields declare markup, TEI authoring scope, indices, reconciliation, image resolution, views, interchange, model mapping and responsibility. `workspace: "wenzelsbibel"` selects the specialized interface. The manifest contains data and cannot register executable provider adapters. [Integration](integration.md#project-folder-and-schema-handoff) defines project loading and dependency resolution.

## Schema set and validation result

Effective schemas follow this precedence for each document.

1. A document's uploaded schema override replaces its project set until reset.
2. Its configured ordered project set applies when no override is active.
3. Vendored TEI P5 TEI All RelaxNG applies when no project schema is configured.

Recovery and the project collection preserve each document's own schema settings. Opening another companion or creating a new document does not transfer the outgoing override. A schema result records identity, type, validity, availability and diagnostics. Output authorization additionally binds the result to the session, revision, document object, exact projected source and ordered schema key. Every result in a nonempty set must be valid.

RelaxNG `include` and `externalRef`, and XSD `include`, `import` and `redefine`, resolve through served URLs or within a granted project folder. Nested folder resources remain inside the granted root. Unavailable resources block output. A standalone upload has no implicit local dependency bundle, and XML catalogs are outside the supported contract.

Raw ISO Schematron supports XPath 1.0 bindings, namespaces, default phases, scalar lets, assertions, reports, diagnostics and common child or attribute contexts. Includes, abstract patterns, advanced match patterns, node-set lets and later XPath versions require precompiled XSLT. Compiled Schematron must yield a valid SVRL `schematron-output` through the browser's XSLT processor. Unsupported constructs or runtimes produce unavailable results.

## Header fields

The header inventory covers every TEI descendant and ordinary attribute under the legitimate `teiHeader`, in source order. Common fields receive familiar labels; other fields retain generated paths and exact XML access.

| Shape | Editable representation |
| --- | --- |
| Text-only or empty paired element | Scalar content value |
| Ordinary attribute | Scalar value preserving original quoting and surrounding whitespace |
| Mixed or structured content | Exact XML |
| Self-closing element or header container | Exact XML |
| Namespace declaration | Exact XML |

Unchanged field values preserve their lexical form. In the generic metadata interface, structural creation, deletion and rearrangement use the complete header XML surface. Specialized witness operations can also change their supported header structures. A project-specific header declaration remains visible even when no dedicated form exists.

## Local recovery and portable working copies

IndexedDB database `teicrafter.recovery`, store `sessions`, holds version 1 checkpoints keyed by independent session UUIDs. A checkpoint contains canonical `raw`, filename, source metadata, UTF-8/BOM state, dirty baseline, manifest text, schema resources and settings, capture time, staged input, image blobs and optional project documents. The [restoration boundary](architecture.md#staged-input-and-restoration) installs the full record before its first automatic checkpoint.

| Staged mode | Retained unfinished state |
| --- | --- |
| `page`, `metadata` | Source text and applicable navigation context |
| `metadata-form` | Field IDs and values |
| `inline` | Cell identity, core text and normalized input |
| `wenzels` | Section, selected record and form fields |
| `witness` | Selected record, creation state and description, XML or attribution fields |
| `entries` | Section, selected entry, encoding kind, fields and explicit batch targets |

A restored entry batch requires a new preview. Saved fields never carry continuing mutation authorization.

Portable files use `.teicrafter.json` and `{ format: "teicrafter-working-copy", version: 2, record: ... }`. Import also accepts version 1. Images use `{ name, type, base64 }` in place of Blob values. Native handles, object URLs and memory-only provider keys are excluded. Import creates a fresh recovery identity and recreates image URLs. Restoring an existing recovery entry retains that entry's identity. Legacy single-draft localStorage data is removed only after its IndexedDB migration commits.

`projectDocuments` has `{ version: 1, activeId, documents }`. Each member retains a stable internal `id`, safe relative XML filename, source, encoding, dirty state, project/schema settings, reading-witness preference and loaded images. Assigned Wenzelsbibel roles `codex`, `images` and `registers` are unique; additional documents can remain unassigned. The collection retains previously edited documents when another role becomes active.

The portable representation stores active raw XML and images once on the surrounding record, then reconstructs that active member on import. Inconsistent active identities, conflicting source values and ambiguous filenames are rejected. Captured companions are retained copies; later filesystem edits do not update them automatically.

## Validated project package

`teicrafter-project.zip` contains separately encoded XML files, eligible loaded images and `teicrafter-bundle.json`. The manifest has `{ format: "teicrafter-project-bundle", version: 1, projectDocuments }`; XML content and image bytes reside at the referenced archive paths. Metadata retains the active document identity and per-document encoding, project settings, schemas, dirty state and reading preference.

The codec accepts its own uncompressed, UTF-8, single-volume ZIP32 layout. The complete archive may contain at most 2,147,483,647 bytes and 65,534 file entries, including the manifest and images. These limits apply to both encoding and decoding. It checks path safety, case-insensitive normalized filename conflicts, checksums, lengths, offsets and complete archive coverage. Unsupported compressed or foreign ZIP layouts are rejected. XML-like image attachments cannot bypass schema validation through the image channel; Working copy can retain such unfinished attachments.

Creation requires a current authorization for every XML member's exact target projection and effective schemas. Cancellation, invalid or unavailable validation, new staged input or a changed collection prevents delivery. Opening a package restores editing data and grants no continuing output authorization. Native Save retains its separate document-local contract in [integration](integration.md#browser-files-and-deployment).

## Entry and witness encodings

Dictionary forms map the lemma through `entry/form[@type='lemma']/orth`, accepting an untyped form when no lemma form exists. A single `sense/def` supplies the definition. Articles use `div[@type='entry' or @type='article']/head` and a single direct `p`. Multiple candidates or mixed content require XML editing. Local `xml:lang` and `n` remain separate scalar fields. Missing fields can be created in unambiguous containers; an empty body requires an explicit dictionary/article choice.

Duplication assigns unused IDs throughout the copied subtree and rewrites supported internal URI-fragment pointers, including encoded fragments. Unchanged attributes and external targets retain their bytes. Duplicate IDs or attributes, compound internal pointers, unknown reference semantics and external XML base context prevent assumptions about safe rewriting. Deletion checks references to every descendant ID within the active document. Batch plans bind an explicit target list, `xml:lang` or `n`, and before/after values to the current document. Cross-file relinking is outside those operations.

Witness definitions use `listWit/witness`; referenced `bibl`, `biblStruct` and `msDesc` descriptions remain inspectable as exact XML. Alternatives use `app/lem`, `app/rdg` and nested `rdgGrp`. Attestation comes from each reading's own `@wit` pointers to unique local witnesses or groups. Grouping does not supply inherited `@wit`.

Reading projection preserves every alternative and identifies absent or ambiguous attribution, explicit omissions and fragment-boundary markers. The selected witness is a retained view preference and does not change XML. Unsupported apparatus-location or external-definition semantics remain visible editorial limits.

## Review Record

A review resides in the relevant document or corpus-member header. This historical record lacks a scope fingerprint and therefore cannot establish current review on its own.

```xml
<revisionDesc>
  <change type="review"
          subtype="verified"
          target="#unit-id"
          who="urn:teicrafter:local-reviewer"
          when="2026-08-24T12:00:00Z">Editorially reviewed in teiCrafter.</change>
</revisionDesc>
```

`target` points to a unique `xml:id` on the primary navigation unit. New records add a `corresp` token beginning `urn:teicrafter:review-scope:v1:sha256:` followed by the 64 lowercase hexadecimal digest characters. The digest covers exact UTF-8 source. A page extends from its `pb` to the next `pb` in its text owner; a container covers its outer XML. Contained `revisionDesc` ranges are excluded. Whitespace changes inside that scope invalidate the fingerprint; changes outside it do not.

Current review requires the latest applicable record to be verified with a matching fingerprint. Reopening appends `subtype="reopened"`; existing revision history remains preserved. Duplicate identifiers, missing headers or incompatible revision structures block review storage. Legacy `@ana="#teicrafter-reviewed"` is historical evidence and can be removed without removing unrelated tokens.

## Cross-structure and discontinuous annotations

Generic stand-off annotations retain selected text and insert boundary anchors at exact raw positions.

```xml
<standOff>
  <spanGrp xml:id="mention-1" type="entity">
    <span from="#mention-1-1-from" to="#mention-1-1-to" ana="#person-1"/>
    <span from="#mention-1-2-from" to="#mention-1-2-to" ana="#person-1"/>
  </spanGrp>
</standOff>
```

A continuous cross-structure selection uses one span. A discontinuous selection uses ordered, non-overlapping spans in one group. Each may carry `ana` and `resp`. Group identity connects highlighting, relinking and removal across segments. Cleanup removes boundary anchors only when no remaining reference needs them.

The generic collector operates within one TEI document. [Wenzelsbibel](wenzelsbibel.md) owns apparatus comments, Bible-verse spans, shared-register links and image `corresp` or `#range(...)` forms against attached companions. Their domain-specific interpretation is separate from the generic span encoding.

## Machine provenance

Whole-document generated TEI carries a configured responsibility pointer on the root and declares it in a matching `respStmt`.

```xml
<TEI xmlns="http://www.tei-c.org/ns/1.0" resp="#ai">
  <teiHeader>
    <fileDesc>
      <titleStmt>
        <title>Generated draft</title>
        <respStmt xml:id="ai"><resp>Generated draft</resp><name>AI</name></respStmt>
      </titleStmt>
      <publicationStmt><p>Unpublished draft.</p></publicationStmt>
      <sourceDesc><p>Generated from supplied source text.</p></sourceDesc>
    </fileDesc>
  </teiHeader>
  <text><body><p>Draft text.</p></body></text>
</TEI>
```

Reload detection requires both pointer and declaration. Per-construct proposals also use `@resp`; project policy can replace the default local pointer.

Acceptance preserves the complete `resp` token list and adds `urn:teicrafter:proposal:accepted:` plus the URI-encoded responsibility token to `ana`. Accepting `#ai` therefore adds `urn:teicrafter:proposal:accepted:%23ai` while retaining existing analysis tokens. Origin and pending status remain independent. An accepted gap retains this evidence when its reversible choice is collapsed. Provider transport and key handling belong to [integration](integration.md#model-and-authority-services).

<a id="licence-boundary"></a>

## Source material and rights

| Material | Storage and relevant properties |
| --- | --- |
| UFBAS Urfehde | Local real whole-book TEI for navigation, header, review and accessibility workflows |
| Wenzelsbibel Codex 2759, image annotations and PAGE sources | Local real project material for word readings, surfaces, zones, apparatus and cross-document references |
| Jeanne Hersch | Local real TEI and a committed structural twin for inline-GND interchange and facsimile workflows |
| Stefan Zweig Digital | Upstream catalogue and Page-JSON material with generated TEI fixtures |
| Type-diverse synthetic fixtures | Redistributable source structures for repeatable projection, mutation, schema and browser checks |

Availability and run outcomes belong to [dated reports](../reports/README.md). [Testing](testing.md#real-material-and-reproducibility) distinguishes synthetic coverage from opt-in real-source evidence.

The committed [hsa-7711 transcription](../docs/data/editor/hsa-7711/README.md) and [SZD conversion](../docs/data/editor/szd/NOTICE.md) carry separate source and licence declarations. Notices for vendored [TEI schemas](../docs/schemas/tei-p5-4.11.0/NOTICE.md) and [guidelines](../docs/data/tei/NOTICE.md) govern reference material. Third-party originals whose rights do not permit redistribution remain outside the public repository. Structural twins retain only encoding properties needed for reproducible checks.
