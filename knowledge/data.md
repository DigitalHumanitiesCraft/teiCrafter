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
updated: 2026-08-24
language: en
version: 0.21
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
| TEI XML file | Decode supported XML encodings, retain exact source, and derive a Source Profile | Encode the schema-authorized projected source for Save or Download |
| Project folder | Read TEI, plaintext, manifest, mapping, and resolvable schema resources through a granted directory handle | Write to the granted file when supported; otherwise use a schema-gated download |
| Plaintext or Markdown | Convert deterministically to minimal TEI using blank lines as paragraphs and `\|N\|` as a page milestone | Save or download the resulting TEI |
| Model-generated TEI | Accept only a self-contained, well-formed TEI P5 document with the minimum header and text body | Persist document-level responsibility and require human review plus schema authorization |
| Model proposals | Map bounded JSON proposals to exact source operations and mark each construct with `@resp` | Confirm removes proposal provenance; reject removes the proposed construct |

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

RelaxNG `include` and `externalRef`, plus XSD `include`, `import`, and `redefine`, can resolve through served URLs. A granted project folder can provide bare dependency filenames from the same folder. Nested or missing project dependencies remain unavailable. A standalone session upload has no implicit dependency bundle. No XML catalog fallback is provided.

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

## Review Record

A verified unit is represented in the relevant document or corpus-member header.

```xml
<revisionDesc>
  <change type="review"
          subtype="verified"
          target="#unit-id"
          who="urn:teicrafter:local-reviewer"
          when="2026-08-24T12:00:00Z">Editorially reviewed in teiCrafter.</change>
</revisionDesc>
```

The target points to a stable `xml:id` on the primary navigation unit. The editor creates a unique identifier when the unit lacks one. Existing revision content and unmanaged attributes remain intact. Ambiguous `revisionDesc` structures, duplicate identifiers, structured rationales, or a missing header cause the review mutation to fail closed. Legacy `@ana="#teicrafter-reviewed"` markers remain readable and can be cleared without removing unrelated tokens.

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

Provider configuration distinguishes data from executable behaviour. Built-in providers and the custom OpenAI-compatible endpoint use declarative endpoint, model, and authentication settings. A registered adapter supplies application-code functions for request construction and response extraction. Endpoint validation rejects embedded credentials. Keys remain memory-only.

## Evidence material

| Material | Rights and storage | Evidence supplied |
| --- | --- | --- |
| UFBAS Urfehde TEI | Real object supplied locally | Whole-book Source Profile, navigation, complete header, review, exact download, TEI All gate, and accessibility in Chromium and Firefox |
| Wenzelsbibel Codex 2759 and image annotations | Real rights-local project material | Word tokens, dual readings, surfaces, zones, IIIF references, TEI-level apparatus, and the need for cross-document range support |
| Jeanne Hersch TEI | Real rights-local project material plus committed synthetic twin | Inline-GND interchange, register projection, facsimile zones, and project-specific workflows |
| Stefan Zweig Digital source material | Upstream project data plus generated TEI fixtures | Page-JSON conversion and catalogue-document integration |
| Type-diverse synthetic fixtures | Committed and redistributable | Reproducible Source Profile, navigation, span, schema, and browser coverage |

Real third-party TEI is never committed when its licence does not permit redistribution. A structural twin captures only the encoding properties needed for reproducible tests. [Testing](testing.md) states which claims use real material and which use a twin.
