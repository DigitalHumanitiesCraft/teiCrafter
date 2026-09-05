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
status: active
created: 2026-05-27
updated: 2026-09-05
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

## Canonical document state

The canonical state is the complete XML source string. The parser records exact raw offsets and a namespace-aware tree without serializing the document through a browser DOM. Every structured view is a projection over that string. A successful edit replaces the smallest representable range and reparses the result. A semantic no-op returns the original string.

TEI identity is determined by the namespace URI `http://www.tei-c.org/ns/1.0`. The document may use a default namespace or any prefix. Elements in another namespace remain preserved source data and do not enter TEI inventories, review records, metadata projections, or annotation operations merely because they share a local name.

## Inputs and outputs

| Form | Ingest rule | Output rule |
| --- | --- | --- |
| TEI XML file | Decode UTF-8 with an optional BOM; reject unsupported or conflicting encodings, retain exact source, and derive a Source Profile | Encode the schema-authorized projected source for Save or Download |
| Project folder | Read TEI, plaintext, manifest, mapping, and resolvable schema resources through a granted directory handle | Write to the granted file when supported; otherwise use a schema-gated download |
| Plaintext or Markdown | Convert deterministically to minimal TEI using blank lines as paragraphs and `\|N\|` as a page milestone | Save or download the resulting TEI |
| Model-generated TEI | Accept only a self-contained, well-formed TEI P5 document with the minimum header and text body | Persist document-level responsibility and require schema authorization for TEI output; human review remains separate evidence |
| Model proposals | Map bounded JSON proposals to exact source operations and mark each construct with `@resp` | Confirm retains origin and records acceptance separately; reject reverses the proposed construct |

Plaintext conventions transport structure that is present in the source text. Semantic pseudo-syntax is excluded because a typo would silently create a scholarly assertion outside the editor's review and validation surfaces.

## Document inventory and Source Profile data

The document inventory records observed TEI element names, attributes, values, reading-text nodes, `xml-model` references, facsimile pointers, and structural relationships. Source Profile rules convert that inventory into evidence-backed capabilities. The Navigation Model then materializes exact raw ranges for available channels such as corpus members, entries, speech turns, table rows, descriptive records, source documents, sections, surfaces, pages, and the whole document.

A Source Profile contains the following durable categories.

| Category | Meaning |
| --- | --- |
| Capabilities | Structures or editorial functions supported by evidence in the document, schema, or project policy |
| Primary navigation | The source-backed channel used by the pager and review scope |
| Available navigation | Other channels retained as document context |
| Reading projection | Local token or text-run cells and optional diplomatic or normalized readings |
| Metadata and context panels | Header, correspondence, facsimile, apparatus, source document, table, or project panels |
| Authoring scope | Vocabulary supplied by manifest policy, conservative schema evidence, or observed document structure |
| Issues | Ambiguity, unsatisfied overrides, or incomplete evidence that the interface must disclose |

Schema evidence is conservative. ODD can declare modules, included or excluded elements, and classes. RelaxNG provides negative allowances only when reachable definitions form a closed profile. `include`, `externalRef`, unresolved references, broad names, and TEI All make that evidence incomplete. XSD declarations provide positive approximate hints because imports and content models can distribute semantics across resources. Schematron contributes validation rules and supplies no structural authoring profile.

## Project manifest

`teicrafter.project.json` is a declarative project contract. Schema order is significant and repeated schema kinds are permitted.

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

The canonical schema shape is an ordered `schema.schemas` array. Each entry contains `type`, `path`, and an optional human-readable `name`. Supported manifest types are `relaxng`, `xsd`, and `schematron`. Legacy singular schema forms normalize into the same runtime set for compatibility.

Project-level `uiProfile` provides defaults. A matching document type overrides `primaryNavigation` per field and contributes additional disabled capabilities. An unavailable requested channel produces an explicit issue and the resolver selects a source-backed fallback.

Other manifest data includes markup actions, TEI modules and elements, indices, reconciliation policy, image resolution, declared views, interchange format, and LLM prompt, mapping, and responsibility. A manifest contains data and cannot register executable LLM adapters.

## Schema set and validation result

The effective schema set comes from one source.

1. A session upload replaces the project choice for the current session.
2. An ordered project schema set applies when configured.
3. The vendored TEI P5 TEI All RelaxNG applies when no project schema exists.

Each execution result records schema identity, type, source, validity, diagnostics, and availability. Output authorization additionally binds the aggregate result to the document session, document revision, exact projected bytes, and effective schema-set key. A nonempty result set authorizes output only when every result is valid.

RelaxNG `include` and `externalRef`, plus XSD `include`, `import`, and `redefine`, can resolve through served URLs. A granted project folder resolves nested relative dependencies inside its root with bounded traversal and cycle detection. Missing resources and paths outside the root remain unavailable. A standalone session upload has no implicit dependency bundle. No XML catalog fallback is provided.

Raw Schematron supports the ISO namespace, XPath 1.0 query bindings, namespaces, default phases, scalar lets, assertions, reports, diagnostics, and common child or attribute rule contexts. Includes, abstract patterns, advanced match patterns, node-set lets, and XPath 2.0 or later require precompiled XSLT. Compiled Schematron must produce a valid SVRL `schematron-output` document through the browser's XSLT processor. An unsupported construct or runtime blocks output as unavailable.

## Complete header projection

The header inventory traverses every TEI element and ordinary attribute below the document's legitimate `teiHeader` in source order. Common title, publication, source, profile, and revision fields receive familiar labels and grouping. Unrecognized fields remain present through generated labels and exact XML paths.

Direct editing is limited to projections with a byte-safe inverse.

| Header shape | Projection |
| --- | --- |
| Text-only or empty paired element | Editable text value |
| Ordinary attribute | Editable attribute value with original quoting and surrounding whitespace retained |
| Mixed or structured element content | XML-only |
| Self-closing element | XML-only |
| Header container | XML-only |
| Namespace declaration | XML-only |

Changed values are XML-escaped and applied as descending exact splices. Unchanged values produce no splice, which preserves entity spelling and all untouched bytes. Creation, deletion, and restructuring use the complete header XML surface.

## Local recovery and portable working copies

IndexedDB database `teicrafter.recovery`, store `sessions`, holds version 1 checkpoints keyed by independent session UUIDs. Records contain canonical `raw`, document name/source, file encoding, original manifest text, local schema resources, schema settings, capture time, staged input and image blobs. Staged modes are `page`, `metadata`, `metadata-form` and `inline`; each records its navigation unit and either source text, field ID/value pairs, or a cell ID with core/normalized input.

Portable files use `.teicrafter.json` and `{ format: "teicrafter-working-copy", version: 1, record: ... }`. Images use `{ name, type, base64 }` instead of Blob values. The bundle is editing state, not validated TEI. Native handles, object URLs and the provider's memory-only API key fields are not serialized. Import assigns a fresh session identity and recreates image URLs. Legacy single-draft localStorage content is removed only after its IndexedDB migration commits.

## Review Record

A review is represented in the relevant document or corpus-member header. The following historical form has no fingerprint and therefore does not establish current review by itself.

```xml
<revisionDesc>
  <change type="review"
          subtype="verified"
          target="#unit-id"
          who="urn:teicrafter:local-reviewer"
          when="2026-08-24T12:00:00Z">Editorially reviewed in teiCrafter.</change>
</revisionDesc>
```

The target points to a stable `xml:id` on the primary navigation unit. New records add a `corresp` token consisting of `urn:teicrafter:review-scope:v1:sha256:` followed by the 64 lowercase hexadecimal digest characters. The digest covers the exact UTF-8 source range: a page runs from its pb to the next pb in its text owner, and a container covers its outer XML. Contained revisionDesc ranges are excluded. Changes outside this scope do not invalidate its review; whitespace changes inside it do. The latest record must be verified and its fingerprint must match for current review.

The editor creates a unique identifier when the unit lacks one. Reopening appends a `subtype="reopened"` record; historical, shared and unmanaged revision content remains intact. Ambiguous revision structures, duplicate identifiers or a missing header cause review storage to fail closed. Legacy `@ana="#teicrafter-reviewed"` markers can be removed without removing unrelated tokens, but never count as current evidence.

## Cross-structure and discontinuous annotations

Stand-off annotations preserve selected text and insert zero-width boundary anchors at exact raw offsets.

```xml
<standOff>
  <spanGrp xml:id="mention-1" type="entity">
    <span from="#mention-1-1-from" to="#mention-1-1-to" ana="#person-1"/>
    <span from="#mention-1-2-from" to="#mention-1-2-to" ana="#person-1"/>
  </spanGrp>
</standOff>
```

A continuous selection across XML boundaries uses one `span`. A discontinuous selection uses several ordered, non-overlapping spans in one group. Each span may carry `ana` and `resp`. Projection resolves every anchor pair back into exact reading ranges, so all segments participate in highlighting, relinking, and removal. Removing a group also removes boundary anchors that have no remaining reference.

The current interactive collector creates entity annotations within one TEI document. The underlying representation can carry other annotation types. Cross-document pointers such as the Wenzelsbibel image-annotation `corresp` and `#range(...)` expressions are preserved as XML and require a separate project-level document graph for interactive editing.

## Machine provenance and provider configuration

Generated whole-document TEI carries the configured responsibility on the TEI root and declares that responsibility in a matching `respStmt`.

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
</TEI>
```

Reload detection requires both the root pointer and the declared responsibility. Per-construct proposals also use `@resp`. Project policy may replace `#ai` with another local responsibility pointer.

Acceptance retains the complete `resp` token list and adds `urn:teicrafter:proposal:accepted:` plus the URI-encoded responsibility token to `ana`. For example, accepting responsibility `#ai` adds `urn:teicrafter:proposal:accepted:%23ai`. Existing analysis tokens remain. Pending status and origin are independent: the matching acceptance marker resolves that responsibility's proposal, while its origin remains available after reload. An accepted gap retains these attributes when its reversible choice is collapsed.

Provider configuration distinguishes data from executable behaviour. Built-in providers and the custom OpenAI-compatible endpoint use declarative endpoint, model, and authentication settings. A registered adapter supplies application-code functions for request construction and response extraction. Endpoint validation rejects embedded credentials. Keys remain memory-only.

## Evidence material

| Material | Rights and storage | Evidence supplied |
| --- | --- | --- |
| UFBAS Urfehde TEI | Real object supplied locally | Historical whole-book browser evidence; current reproduction requires the local source, with availability recorded in the run report |
| Wenzelsbibel Codex 2759 and image annotations | Real rights-local project material | Word tokens, dual readings, surfaces, zones, IIIF references, TEI-level apparatus, and the need for cross-document range support |
| Jeanne Hersch TEI | Real rights-local project material plus committed synthetic twin | Inline-GND interchange, register projection, facsimile zones, and project-specific workflows |
| Stefan Zweig Digital source material | Upstream project data plus generated TEI fixtures | Page-JSON conversion and catalogue-document integration |
| Type-diverse synthetic fixtures | Committed and redistributable | Reproducible Source Profile, navigation, span, schema, and browser coverage |

## Licence boundary

The committed [hsa-7711 transcription](../docs/data/editor/hsa-7711/README.md) and [SZD conversion](../docs/data/editor/szd/NOTICE.md) have their own source and licence declarations. TEI [schema](../docs/schemas/tei-p5-4.11.0/NOTICE.md) and [guidelines](../docs/data/tei/NOTICE.md) notices govern vendored reference material.

Real third-party TEI is never committed when its licence does not permit redistribution. A structural twin captures only the encoding properties needed for reproducible tests. [Testing](testing.md) states which claims use real material and which use a twin.
