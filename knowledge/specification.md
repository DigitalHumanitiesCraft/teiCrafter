---
title: teiCrafter Specification
project:
  name: teiCrafter
  repository: https://github.com/DigitalHumanitiesCraft/teiCrafter
method:
  name: Promptotyping
  url: https://lisa.gerda-henkel-stiftung.de/digitale_geschichte_pollin
template:
  name: Vorlage Specification
  version: 0.1
  url: https://dhcraft.org/Promptotyping/promptotyping-document/specification
status: active
created: 2026-02-05
updated: 2026-08-24
language: en
version: 0.21
topics: ["[[Requirements Engineering]]", "[[TEI XML]]", "[[Decision Records]]"]
related: [project, data, architecture, testing]
---

# teiCrafter Specification

## Normative outcome

teiCrafter shall let an editor work on heterogeneous TEI through source-backed projections while preserving the complete XML document. Every Save or Download shall be authorized against the exact output bytes for the current document revision. The interface shall explain its structural interpretation, scholarly provenance, review state, and any reason output is blocked.

## Document and session integrity

- **D.1 Canonical source.** The complete XML source string is the canonical document state. Parsed nodes and browser DOM elements are temporary projections.
- **D.2 Byte fidelity.** A load followed by a no-op shall return the identical byte sequence. An intentional edit shall alter only the exact source ranges required by that operation.
- **D.3 Namespace identity.** TEI operations shall identify elements through the TEI namespace URI and preserve the document's existing prefix policy. Foreign elements with equal local names shall remain outside TEI projections and mutations.
- **D.4 Session identity.** Each loaded document shall have a distinct session identity, revision, dirty savepoint, bounded undo history, and cancellable asynchronous work. Results from another session or revision shall have no authority over the current document.
- **D.5 Encoding and save conflicts.** The file boundary shall decode and re-encode only supported XML encodings. In-place save shall detect an external file-version conflict and fail closed.
- **D.6 Source scopes.** Page or unit XML, complete header XML, and complete-document XML shall commit through substitution into the canonical string. Well-formedness and validation shall evaluate the resulting complete document.
- **D.7 Staged source.** Navigation shall refuse to discard staged XML edits. Apply shall reparse the full result before replacing canonical state.

## Compositional Source Profiles

- **S.1 Inventory.** Loading shall inventory every observed TEI structure needed for navigation, reading text, facsimiles, metadata, apparatus, and authoring scope.
- **S.2 Capability composition.** A document may expose several capabilities at once. Page presence shall not suppress entries, speech turns, records, tables, source documents, apparatus, or logical sections.
- **S.3 Navigation channels.** The Navigation Model shall materialize source-backed units with exact raw boundaries. It shall choose one primary channel and retain other available channels as context.
- **S.4 Local cell type.** Token editing shall apply where the source encodes `w` or `pc`. Other readable text shall use text-run editing. Both cell types may occur within one navigation unit.
- **S.5 Safe fallback.** Ambiguous evidence or an unsatisfied requested navigation channel shall produce a visible issue and a source-backed fallback. The resolver shall never invent absent structural units.
- **S.6 Schema Profile.** The effective repository, project, or session schema set shall contribute conservative authoring evidence after document opening and every session schema change. Multiple vocabulary schemas shall combine conjunctively. Only closed and reachable evidence may provide a negative capability allowance. Unavailable or partially resolved vocabulary evidence shall leave the affected allowance unknown. Schematron shall remain validation-only.
- **S.7 Manifest policy.** A project manifest may select an available primary navigation channel and disable known capabilities. Project policy supplies defaults; a file's document type overrides the applicable fields.
- **S.8 Source language.** Pager, review, progress, and context labels shall use the primary channel's terminology. Generic labels shall remain available when no domain-specific name is justified.
- **S.9 TEI All neutrality.** The broad repository TEI All schema shall never classify a source type or forbid a capability.

## Project and schema declarations

- **P.1 Canonical schema set.** A manifest schema shall normalize to the ordered shape `{ schemas: [{ type, path, name? }, ...] }`. Order and repeated schema types shall be preserved.
- **P.2 Schema types.** Manifest entries may declare RelaxNG, XSD, or Schematron resources. A project may combine RelaxNG and XSD when its editorial contract requires both.
- **P.3 Resolution.** Served resources shall resolve relative to the manifest. An opened project folder may resolve a top-level schema and its bare same-folder dependencies.
- **P.4 Session override.** A session schema upload shall replace the complete project schema set for that session. The interface shall identify the effective source.
- **P.5 Default schema.** The vendored TEI P5 TEI All RelaxNG shall apply only when the project provides no schema set and no session override exists.
- **P.6 Declarative boundary.** Manifests may configure data and policy. They shall not inject executable code, provider adapters, or arbitrary validation programs.

## Complete TEI header

- **H.1 Complete inventory.** Metadata shall expose every TEI element and ordinary attribute below the legitimate document `teiHeader` in source order.
- **H.2 Common affordances.** Common title, publication, source, profile, and revision values shall retain familiar labels and grouping.
- **H.3 Generic projection.** Project-specific and unknown header fields shall remain visible through generated labels, exact XML paths, and the complete header XML surface.
- **H.4 Safe direct editing.** A text-only or empty paired element and an ordinary attribute may be edited directly when the change has an exact byte-safe inverse.
- **H.5 XML-only content.** Mixed content, structured content, self-closing elements, the header container, and namespace declarations shall be marked XML-only.
- **H.6 Minimal mutation.** Unchanged metadata values shall produce no mutation. Changed text and attributes shall be escaped and applied through descending exact splices while preserving quote style and surrounding whitespace.
- **H.7 Structural changes.** Creation, deletion, and restructuring of header content shall use the complete exact XML surface.

## Review Records

- **R.1 Scholarly record.** Marking a unit reviewed shall create or update a TEI `revisionDesc/change` with `type="review"`, a review status in `subtype`, a local target, reviewer in `who`, an ISO date or timestamp in `when`, and a text rationale.
- **R.2 Stable target.** The review target shall identify the current primary navigation unit. The editor may add a unique `xml:id` to that unit when necessary.
- **R.3 Corpus scope.** A reviewed unit inside a TEI corpus member shall place its record in that member's header.
- **R.4 Preservation.** Existing revision history, unmanaged attributes, shared targets, and unrelated review records shall remain intact.
- **R.5 Closed failure.** Missing headers, duplicate identifiers, ambiguous `revisionDesc` content, and structured rationales that cannot be changed losslessly shall block the review mutation with an explanation.
- **R.6 State separation.** Annotation coverage and review status shall remain independent. Review certifies a human act and shall not be inferred from the presence of markup.
- **R.7 Legacy reading.** The editor may read the legacy `@ana="#teicrafter-reviewed"` marker. Clearing review shall remove the recognized marker while preserving unrelated tokens.

## Cross-structure and discontinuous spans

- **A.1 Stand-off representation.** A selection that cannot be represented safely as one inline wrapper shall use TEI-level `standOff/spanGrp/span` with exact boundary anchors.
- **A.2 Continuous crossing.** A continuous range across XML structure or navigation boundaries shall use one `span`.
- **A.3 Discontinuous selection.** Several separated ranges shall form one annotation group with ordered `span` children.
- **A.4 Source preservation.** Selected text shall remain byte-identical. Inserted anchors shall be zero-width TEI milestones that follow the document's prefix policy.
- **A.5 Projection.** Every segment shall project into reading-text layers and mention discovery. Relinking and removal shall operate on the complete group.
- **A.6 Anchor cleanup.** Removing a group shall remove only boundary anchors that have no remaining reference.
- **A.7 Overlap safety.** Overlapping ranges inside one collected annotation shall be refused. The editor shall use the stand-off route when an inline selection overlaps existing markup.
- **A.8 Target-format limit.** An interchange projection that cannot express cross-structure, discontinuous, or overlapping ranges shall block that output with a precise reason.

## Fail-closed multi-schema output gate

- **V.1 Exact target bytes.** Validation for Save or Download shall run on the exact bytes intended for the target, including any project interchange projection.
- **V.2 Current authorization.** A successful result shall correspond to the current session, revision, document object, projected byte string, and effective schema set.
- **V.3 Aggregate rule.** The result set shall be nonempty and every configured schema shall return valid. An invalid or unavailable result shall block output.
- **V.4 Automatic execution.** Save and Download shall run the gate when no current authorization exists. The operation shall recheck authorization after asynchronous validation and immediately before output.
- **V.5 Changed state.** A document edit, project change, schema override, or output-projection change shall invalidate the previous authorization.
- **V.6 Explanation.** The validation surface shall identify repository, project, or session schema source; list every schema result; show diagnostics and runtime limits; and state why output is blocked.
- **V.7 RelaxNG and XSD dependencies.** Includes, external references, imports, and redefinitions shall run only when every dependency can be fetched or resolved as a bare same-folder project file. Missing or nested unresolved resources shall yield unavailable.
- **V.8 Raw Schematron subset.** Browser execution shall accept the documented XPath 1.0 subset. Includes, abstract patterns, advanced match patterns, node-set lets, and XPath 2.0 or later shall yield unavailable unless the project supplies compiled XSLT.
- **V.9 Compiled Schematron.** Compiled XSLT shall require browser `XSLTProcessor` support and a valid SVRL `schematron-output` result. Missing runtime support or invalid SVRL shall block output.
- **V.10 Comparative harness.** Offline fidelity evaluation may report schema differences without gating. That comparative level shall remain distinct from browser output authorization.

## LLM assistance and provenance

- **L.1 Optional assistance.** The deterministic editor shall remain complete when LLM assistance is disabled.
- **L.2 Generated document gate.** A generated response shall be well-formed, self-contained TEI P5, reject `DOCTYPE`, contain the required header and text body, and pass through ordinary document loading.
- **L.3 Persistent provenance.** Generated TEI shall carry the configured responsibility on the TEI root and declare a matching `respStmt`. Reload shall restore the generated state only when both pieces agree.
- **L.4 Proposal provenance.** Every inserted model proposal shall carry `@resp` and remain visibly unverified until a human confirms or rejects it.
- **L.5 Credentials.** API keys shall remain in memory. Requests shall omit browser ambient credentials.
- **L.6 Provider choice.** Built-in providers shall coexist with a configurable OpenAI-compatible endpoint. Application code may register validated adapters for nonstandard JSON request and response protocols.
- **L.7 Adapter safety.** Built-in provider identifiers shall be immutable. Adapter endpoints shall use HTTP or HTTPS and contain no embedded credentials. A manifest shall have no executable adapter capability.

## Browser, files, and accessibility

- **B.1 Browser baseline.** The application shall target the Browserslist `baseline widely available` set.
- **B.2 Portable file path.** File input and schema-gated direct download shall work in Chromium and Firefox.
- **B.3 Native capability.** File and directory handles shall appear only when the browser exposes the File System Access capability. Their absence shall preserve the fallback workflow.
- **B.4 Save fallback.** A Save request without a writable native handle shall use the schema-gated download path and retain exact bytes.
- **B.5 Accessible state.** Keyboard access, focus, labels, status announcements, contrast, and validation errors shall remain perceivable in both browser engines.
- **B.6 Facsimile degradation.** A missing image resolver or unsupported directory picker shall leave XML and reading-text editing available and explain the reduced capability.

## Acceptance scenarios

| Scenario | Acceptance condition |
| --- | --- |
| No-op round trip | Open and serialize a representative TEI without changing any source byte |
| Mixed source | Derive several simultaneous capabilities, select a source-backed primary channel, and retain local token and text-run editing |
| Manifest override | Apply a valid project or document-type navigation policy and explain an unsatisfied override before falling back |
| Complete header | Inventory every TEI header field, edit simple values exactly, and keep structured content XML-only |
| Review | Write a targeted review change without altering unrelated revision history, then reopen and clear it safely |
| Cross-structure mention | Collect separated ranges, write one stand-off group, project every segment, and remove the group without text loss |
| Schema set | Execute every ordered schema and block when any result is invalid or unavailable |
| Stale validation | Change the document after a valid result and require a new gate before output |
| Firefox fallback | Load through file input and obtain exact source bytes through Download and Save fallback after schema authorization |
| UFBAS whole book | Exercise real navigation, header, review, schema-gated output, and accessibility in Chromium and Firefox |
| Wenzelsbibel codex | Exercise real word, dual-reading, facsimile, zone, and no-op engine behaviour; use the synthetic twin for committed browser interaction |

## Key decisions

- **Exact source mutation, 2026-02-05.** Browser XML serializers can change scholarly source beyond an intended edit. teiCrafter therefore treats raw XML plus offsets as canonical state.
- **Compositional Source Profiles, 2026-08-24.** Global word or line modes and folio-first navigation misrepresented dictionaries, drama, corpora, tables, correspondence, critical editions, and documents that combine several structures. Inventory, conservative schema evidence, and manifest policy now compose the interface.
- **Complete header inventory, 2026-08-24.** A fixed list of common fields concealed legitimate project metadata. Every header field is now inventoried, while direct form editing remains limited to byte-safe projections.
- **TEI Review Records, 2026-08-24.** Visual progress alone could not preserve who reviewed which unit and why. Review therefore lives in targeted `revisionDesc/change` records and remains independent from markup coverage.
- **Stand-off span groups, 2026-08-24.** Inline wrappers cannot represent selections that cross structures, overlap markup, or contain gaps. Exact anchors plus grouped spans preserve the relation without rewriting selected text.
- **Fail-closed schema output, 2026-08-24.** Validation used as advice could allow invalid or unvalidated bytes to leave the editor. Save and Download now require current authorization from every configured schema.
- **Open provider boundary, 2026-08-24.** Editorial projects need local and nonstandard model services. A validated code-level adapter seam supports those protocols while keeping manifests declarative and keys memory-only.
- **Cross-browser fallback, 2026-08-24.** Native file handles are browser capabilities. File input and direct download form the portable contract across Chromium and Firefox.

## Explicit seams

- The span engine supports generic annotation types, while the interactive multi-segment collector currently exposes entity linking. Additional scholarly types need UI contracts for their required attributes and review semantics.
- Stand-off spans resolve within one TEI document. Cross-file Wenzelsbibel `corresp` and `#range(...)` editing needs a project document graph and target-document transaction model.
- Review records use safe default reviewer, timestamp, status, and rationale values. A complete interface for editing those details remains open.
- Raw Schematron uses a bounded XPath 1.0 interpreter. Projects that rely on the complete ISO pipeline must provide compiled XSLT or validate outside the browser before teiCrafter can authorize output.
- Provider adapters are registered by trusted application code. Declarative plugin discovery and remotely supplied executable adapters are outside the current security boundary.
- The real Wenzelsbibel codex is rights-local. Reproducible browser automation uses a synthetic structural twin, so real cross-browser facsimile acceptance requires a locally supplied object.
- Very large documents still use whole-string parsing and reparsing. Segmented persistence would require a new canonical-state model and is outside this increment.

## Related

[Project](project.md) owns positioning and boundaries. [Data](data.md) owns the serialized forms. [Architecture](architecture.md) owns the module composition and data flow. [Testing](testing.md) owns the evidence method.
