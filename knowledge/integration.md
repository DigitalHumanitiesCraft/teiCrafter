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
status: active
created: 2026-06-07
updated: 2026-08-24
language: en
version: 0.21
topics: ["[[TEI XML]]", "[[Data Flow]]", "[[HTR Pipelines]]"]
related: [project, data, specification, architecture, design, testing]
---

# teiCrafter Integration Contracts

## Integration principle

teiCrafter accepts TEI as the primary exchange object. A project can add a manifest, schemas, image resolution, mapping guidance, and an interchange projection. The editor still opens the document when project configuration is absent. Source structure remains the first source of interface evidence, while the project layer states editorial policy that cannot be inferred safely.

```text
upstream source or TEI
  -> optional deterministic conversion
  -> TEI plus optional project contract
  -> Source Profile and editorial work
  -> exact target projection
  -> ordered schema-set authorization
  -> project repository or download
```

## Project package contract

A project package may contain these durable roles.

| Role | Contract |
| --- | --- |
| TEI documents | Each document must remain independently openable and provide its own structural evidence |
| `teicrafter.project.json` | Declares project name, file-to-type bindings, schema set, UI policy, markup, indices, views, images, reconciliation, interchange, and LLM settings |
| Schema resources | Form an ordered set whose every entry must authorize the exact output |
| LLM mapping Markdown | Supplies editorial mapping guidance as data beside the manifest |
| Local images | Resolve through document pointers or project policy after the user grants access |
| External images | Resolve through IIIF Image or Presentation contracts where configured |

The canonical schema declaration is `schema.schemas`. Entries retain manifest order and contain `type`, `path`, and optional `name`. Project loaders and served examples normalize this declaration into the same runtime set. Legacy declarations remain an ingest compatibility path and should not be authored for new projects.

Project-level `uiProfile` can request an available primary navigation channel and disable capabilities that are inappropriate for the workflow. A matching document type overrides the primary channel and contributes further disabled capabilities. The manifest does not declare a monolithic edition genre. The same project can contain letters, dictionaries, corpora, source documents, or other TEI shapes.

## Source Profile handoff

Upstream systems should encode real document structure in TEI. Pages use page milestones or facsimile surfaces. Dictionary entries use `entry`. Speech turns use source elements such as `u` or `sp`. Tables, records, source documents, apparatus, correspondence metadata, and logical sections retain their TEI structures. teiCrafter inventories those features and exposes all supported capabilities.

A project should use `uiProfile` only when editorial policy must choose among real channels or suppress a misleading affordance. An unavailable request is reported and falls back. The manifest must not fabricate a navigation unit that has no source anchor.

The effective schema set strengthens this handoff after the initial structural projection. Closed reachable RelaxNG resources can provide positive and negative vocabulary evidence, including resolved includes. XSD contributes approximate positive evidence across resolved includes and imports. Multiple vocabulary schemas combine conjunctively. Schematron contributes validation constraints without vocabulary claims. Missing or partial resources leave capabilities unknown and keep the document open. A session upload or reset recomputes the Source Profile from the newly effective set.

## Output and schema handoff

Save and Download validate the exact target representation. A project interchange projection therefore runs before schema authorization. The resulting validation snapshot belongs to the current session, revision, byte string, and schema set. A later edit or project change requires another authorization.

Every configured schema runs. A project that declares both RelaxNG and Schematron receives one aggregate decision whose success requires both results. An unavailable dependency blocks output with the same authority as an invalid document.

Served schemas may resolve relative URL dependencies. A user-opened project folder supports top-level resources and bare same-folder RelaxNG or XSD dependencies. Nested dependency trees and XML catalogs are outside the current folder contract. Raw Schematron must stay within the documented XPath 1.0 subset or arrive as compiled XSLT that produces SVRL.

TEI All supplies a safe repository default only when the project has no schema. A project-specific schema set replaces that default. A session upload replaces the project set temporarily and should be treated as an explicit operator decision.

## Complete header handoff

Projects may use the full TEI header. Common fields receive direct familiar controls, and every other TEI header field appears through the generic inventory. Text-only values and ordinary attributes are candidates for direct editing. Mixed, structured, self-closing, and namespace-sensitive structures remain exact XML.

An integration must not rely on a fixed teiHeader subset. Project-specific declarations, authority data, responsibility statements, revision history, profile descriptions, and encoding descriptions remain preserved. Structural header authoring stays in XML until a project-specific form has a proven lossless inverse.

Whole-document model provenance uses a TEI-root `@resp` pointer plus a matching `respStmt`. A project LLM configuration may replace the default `#ai` pointer. That responsibility must remain local and resolvable after a save and reopen.

## Review handoff

Review state serializes as `teiHeader/revisionDesc/change` with a local target on the reviewed primary navigation unit. Downstream repositories can therefore read the reviewer, timestamp, status, rationale, and target without teiCrafter-specific UI state.

Projects should preserve these review changes alongside their existing revision history. A TEI corpus member receives review evidence in its own header. Annotation presence has no review semantics and should not be used as a substitute.

The editor can read the historical `@ana="#teicrafter-reviewed"` marker for compatibility. New project contracts should use Review Records. A project requiring controlled reviewer identities or rationale vocabularies needs a workflow layer around the current default-details UI.

## Span handoff

Cross-structure and discontinuous selections serialize in a TEI-level `standOff` as grouped local spans. Each segment points from one generated boundary anchor to another and may reference an entity through `ana` or record provenance through `resp`. Selected text remains unchanged.

Downstream consumers should treat the `spanGrp` as the semantic annotation and its child spans as ordered segments. Relinking an entity changes all segments in the group. A consumer that flattens the group to independent mentions loses discontinuity semantics.

Target formats must declare whether they can represent these spans. The inline-GND interchange cannot represent cross-structure, discontinuous, or overlapping annotations and therefore blocks the projection. A lossy flattening is never automatic.

The current span transaction is document-local. Cross-file pointers need a project document graph, stable document identities, and an atomic update policy across files. Wenzelsbibel image annotations make this requirement concrete through `corresp` pointers and range expressions.

## UFBAS contract

The UFBAS Urfehde object enters as a complete TEI book without a required project manifest. Document evidence yields page and source structures, while repository TEI All supplies the default output schema. The generic header inventory exposes the real header without a corpus-specific form.

The operational workflow uses portable file input and download, so it works in Chromium and Firefox. Review changes and schema authorization apply to the exact current source. Automated browser evidence covers the real local object and includes Axe in both engines. The object remains local because its redistribution status is separate from the editor's code licence.

## Wenzelsbibel contract

The Wenzelsbibel codex encodes word-level diplomatic text, `@orig` and `@norm`, page and line milestones, facsimile surfaces, image graphics, zones, and TEI-level stand-off apparatus. Project identifiers and source structure select the Wenzelsbibel profile for a bare file. IIIF resolution maps surface graphics to image services, and point geometry can supply zone bounds when rectangular coordinates are absent.

The separate image-annotation document uses cross-file `corresp` links, including range expressions. teiCrafter preserves those values in XML but has no multi-document graph transaction for interactive authoring. Integrating that document requires target-document loading, pointer validation across document identities, and coordinated schema authorization for every changed file.

The real codex supplies local engine and Source Profile evidence. The committed browser example uses a structural twin so that Chromium and Firefox can exercise representative interaction without redistributing the source. Claims about real browser performance must state that the local codex was present.

## Jeanne Hersch and zbz-ocr-tei contract

The Hersch exchange format stores person, organisation, and work references inline through GND-oriented attributes. teiCrafter's working projection uses the generic register model. `fromInlineGND` lifts existing mentions on load, and `toInlineGND` produces the target representation for Save or Download.

A project manifest can declare `interchange: "inline-gnd"`. A bare Hersch file can select the same boundary through the exact `TEI@type="naegeli"` signature. An unchanged source remains a fixed point. New editor annotations appear in the target format after projection and schema authorization.

Local facsimile graphics can be granted separately from the TEI. They remain external resources and are never copied implicitly by Save. Firefox retains the XML and download workflow even when directory access is unavailable.

## Stefan Zweig Digital and szd-htr contract

The SZD upstream lane combines catalogue TEI with Page-JSON from handwriting recognition. Page-JSON does not enter the editor directly. A deterministic converter produces minimal editable TEI while retaining its frozen byte-level contract in [converter-reference](converter-reference.md).

The generated TEI then enters the same Source Profile, metadata, review, span, and schema paths as any other document. A project manifest can bind files to document types and provide type-specific markup, navigation policy, schemas, images, and model mapping. The converter remains a separate integration boundary so source extraction changes cannot silently rewrite editor semantics.

## LLM provider handoff

The manifest supplies editorial instructions, mapping text, responsibility, and provider-neutral source context. Provider transport remains application code. Built-in services and the custom OpenAI-compatible endpoint cover standard JSON protocols. `registerProviderAdapter` lets trusted bundled code add a nonstandard protocol through request construction and response extraction functions.

This division keeps repository data auditable and prevents a project package from executing remote code. Keys remain memory-only, and requests omit ambient browser credentials. Generated TEI and proposals still pass structural gates, provenance insertion, human review, and output schema authorization.

## Browser file handoff

The portable contract is local file input plus schema-gated Blob download. Chromium and Firefox both implement that route. Native file and directory handles are optional capabilities that improve save-in-place, project-folder, image, and dependency workflows.

An integration must provide a usable result when those handles are absent. Save falls back to Download, project-folder actions stay hidden or disabled with an explanation, and editing remains available. Native capability detection must occur at the action boundary rather than through browser-name assumptions.

## Integration checklist

- The TEI opens independently and retains its namespace and prefix policy.
- Real source structures support the intended navigation channels.
- Manifest `uiProfile` policy selects only source-backed channels.
- The ordered schema set and every dependency are available in the chosen browser workflow.
- Header fields remain visible through direct or XML-only projection.
- Review records are acceptable to the project's revision policy.
- Stand-off span groups are supported by the downstream format, or the project blocks them explicitly.
- Target-only interchange projection runs before schema authorization.
- LLM responsibility pointers resolve to real `respStmt` declarations.
- Chromium and Firefox retain a complete file input and download path.
- Rights-local evidence is identified as local and has a redistributable structural twin where reproducibility requires one.
