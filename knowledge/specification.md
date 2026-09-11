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
status: complete
created: 2026-02-05
updated: 2026-09-11
language: en
topics: ["[[Requirements Engineering]]", "[[TEI XML]]", "[[Decision Records]]"]
related: [project, data, architecture, design, testing, wenzelsbibel]
---

# teiCrafter Specification

## Normative outcome

teiCrafter shall let an editor work on heterogeneous TEI through source-backed projections while preserving the complete XML document. Every TEI Save or Download shall be authorized against the exact output bytes for the current document revision. The explicitly unvalidated Working copy preserves session state through a separate JSON export. The interface shall explain its structural interpretation, scholarly provenance, review state, and any reason output is blocked.

Normative requirements define the behaviour an implementation must satisfy. [Architecture](architecture.md) identifies the implementation, [Testing](testing.md) defines the verification method, and the [editorial completion report](../reports/editorial-completion-2026-09-11.md) records observed results. Scholarly validation and user acceptance require the responsible editors' assessment of identifiable source data and editorial outcomes.

## Document and session integrity

- **D.1 Canonical source.** The complete XML source string is the canonical document state. Parsed nodes and browser DOM elements are temporary projections.
- **D.2 Byte fidelity.** A supported UTF-8 file load followed by a no-op shall return the identical byte sequence, including an optional BOM. An intentional edit shall alter only the exact source ranges required by that operation.
- **D.3 Namespace identity.** TEI operations shall identify elements through the TEI namespace URI and preserve the document's existing prefix policy. Foreign elements with equal local names shall remain outside TEI projections and mutations.
- **D.4 Session identity.** Each loaded document shall have a distinct session identity, revision, dirty savepoint, bounded undo history, and cancellable asynchronous work. Results from another session or revision shall have no authority over the current document.
- **D.5 Encoding and save conflicts.** The file boundary shall decode and re-encode UTF-8 with an optional BOM, and reject unsupported encodings or conflicting declarations. In-place save shall detect an external file-version conflict and fail closed.
- **D.6 Source scopes.** Page or unit XML, complete header XML, and complete-document XML shall commit through substitution into the canonical string. Well-formedness and validation shall evaluate the resulting complete document.
- **D.7 Staged input.** Reading, XML, metadata and specialized workspace input shall share ownership of the session and source from which it was opened. Navigation, history, re-rendering and unrelated mutations shall not silently discard unfinished values. Apply shall reject stale ownership, reparse the full result before replacing canonical state, and retain input after failure. Context workspaces shall not replace the staged-input owner while XML or Metadata is active.
- **D.8 Literal input.** Text and attribute editors shall treat input as literal Unicode, escape entity-looking text, reject XML-illegal characters, and preserve unchanged lexical spellings. An unresolved named entity shall require exact XML editing if its value would change.
- **D.9 Recovery.** Independent document sessions shall retain canonical XML, unfinished input, schema/project configuration, attached project documents and image blobs in versioned checkpoints. Storage errors shall be visible. A portable Working copy shall preserve unfinished work without a schema gate and without claiming validated output. Reopening shall restore each attached document's source, encoding and settings. Native handles and output authorizations shall require new acquisition. The first restored checkpoint shall use the intended recovery identity and include the complete restored state.
- **D.10 Read only.** Read-only mode shall reject source-changing transactions and undo/redo while permitting navigation, inspection, search and copying. The interface shall refuse entry into that mode with unresolved visible edits.
- **D.11 Safe targets.** A derived file shall choose an unused filename. Existing image content shall be reused only after exact comparison, and shall never be silently replaced. Recovery may be cleared after a complete native save or explicit discard; initiating a download is insufficient evidence.
- **D.12 Asynchronous persistence.** Save and every TEI export shall resolve unfinished visible input and recheck authorization after asynchronous work. New input during a native write shall prevent a clean savepoint. Completion shall affect only the captured session and recovery identity. Checkpoints shall capture nested values before queueing; a storage failure shall remain visible and shall not disable subsequent attempts.

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
- **P.3 Resolution.** Served resources shall resolve relative to the manifest. An opened project folder shall resolve nested schema dependencies relative to each containing file, reject paths outside the granted root, and terminate dependency cycles.
- **P.4 Session override.** A session schema upload shall replace the complete project schema set for the active document session. Linked files retain independent overrides; a new file or draft starts with its own configured defaults. Restoration applies its recorded settings before creating a checkpoint. The interface shall identify the effective source.
- **P.5 Default schema.** The vendored TEI P5 TEI All RelaxNG shall apply only when the project provides no schema set and no session override exists.
- **P.6 Declarative boundary.** Manifests may configure data and policy. They shall not inject executable code, provider adapters, or arbitrary validation programs.
- **P.7 Persistent document collection.** Switching among explicitly attached project documents shall checkpoint their current source and per-file settings before activation. A storage error or intervening change shall preserve the current file and prevent the pending switch. Ambiguous document identities, filenames and assigned companion roles shall be rejected. Read-only mode shall remain effective across the switch.
- **P.8 Validated package.** Project package shall authorize every XML document against its own effective ordered schema set and produce one ZIP only after all decisions pass. A failed, cancelled or stale operation shall produce no partial package. XML-like image attachments shall not bypass this gate.
- **P.9 Native save scope.** In-place Save shall affect the active document. Unsaved companions shall retain project recovery. A package download shall not be presented as an atomic write across external files or as proof that the archive was saved to disk.

## Complete TEI header

- **H.1 Complete inventory.** Metadata shall expose every TEI element and ordinary attribute below the legitimate document `teiHeader` in source order.
- **H.2 Common affordances.** Common title, publication, source, profile, and revision values shall retain familiar labels and grouping.
- **H.3 Generic projection.** Project-specific and unknown header fields shall remain visible through generated labels, exact XML paths, and the complete header XML surface.
- **H.4 Safe direct editing.** A text-only or empty paired element and an ordinary attribute may be edited directly when the change has an exact byte-safe inverse.
- **H.5 XML-only content.** Mixed content, structured content, self-closing elements, the header container, and namespace declarations shall be marked XML-only.
- **H.6 Minimal mutation.** Unchanged metadata values shall produce no mutation. Changed text and attributes shall be escaped and applied through descending exact splices while preserving quote style and surrounding whitespace.
- **H.7 Structural changes.** The generic Metadata form shall route creation, deletion and restructuring to the complete exact XML surface. A specialized workspace may provide a bounded source-preserving operation, as defined for witness descriptions in T.3.

## Review Records

- **R.1 Scholarly record.** Marking a unit reviewed shall append a TEI `revisionDesc/change` with `type="review"`, a review status in `subtype`, a local target, reviewer in `who`, an ISO date or timestamp in `when`, a text rationale, and a versioned source fingerprint in `corresp`.
- **R.2 Stable target.** The review target shall identify the current primary navigation unit. The editor may add a unique `xml:id` to that unit when necessary.
- **R.3 Corpus scope.** A reviewed unit inside a TEI corpus member shall place its record in that member's header.
- **R.4 Preservation.** Existing revision history, unmanaged attributes, shared targets, and unrelated review records shall remain intact.
- **R.5 Closed failure.** Missing headers, duplicate identifiers, ambiguous `revisionDesc` content, and structured rationales that cannot be changed losslessly shall block the review mutation with an explanation.
- **R.6 State separation.** Annotation coverage and review status shall remain independent. Review certifies a human act and shall not be inferred from the presence of markup.
- **R.7 Legacy reading.** The editor may read the legacy `@ana="#teicrafter-reviewed"` marker. Clearing review shall remove the recognized marker while preserving unrelated tokens.
- **R.8 Current evidence.** Only a matching fingerprint on the latest verified record shall establish current review. Modified source shall become changed since review. Fingerprint-free records and legacy markers shall not establish current review. Reopening shall append history instead of deleting it.
- **R.9 Review details.** Confirmation shall expose reviewer, rationale, prior record and covered source scope. Linked register content outside that range shall not be implicitly certified.

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
- **V.7 RelaxNG and XSD dependencies.** Includes, external references, imports, and redefinitions shall run only when every dependency can be fetched or resolved inside the granted project folder. Missing or unresolvable resources shall yield unavailable.
- **V.8 Raw Schematron subset.** Browser execution shall accept the documented XPath 1.0 subset. Includes, abstract patterns, advanced match patterns, node-set lets, and XPath 2.0 or later shall yield unavailable unless the project supplies compiled XSLT.
- **V.9 Compiled Schematron.** Compiled XSLT shall require browser `XSLTProcessor` support and a valid SVRL `schematron-output` result. Missing runtime support or invalid SVRL shall block output.
- **V.10 Comparative harness.** Offline fidelity evaluation may report schema differences without gating. That comparative level shall remain distinct from browser output authorization.
- **V.11 Exact-result reuse.** A successful vocabulary-schema decision may be reused only for identical XML and the identical complete schema dependency graph. Inputs shall be captured before asynchronous work. Reuse shall still produce authorization for the current output operation and shall not waive any other configured schema.
- **V.12 Responsive execution.** RelaxNG and XSD compilation and validation shall run outside the main browser thread. Worker failure shall produce an unavailable result, and progress shall distinguish preparation, XML parsing, validation and successful-result reuse.
- **V.13 Cancellation.** An explicit cancellation shall terminate pending worker work and prevent that operation from authorizing output. A subsequent validation request shall remain possible.

## LLM assistance and provenance

- **L.1 Optional assistance.** The deterministic editor shall remain complete when LLM assistance is disabled.
- **L.2 Generated document gate.** A generated response shall be well-formed, self-contained TEI P5, reject `DOCTYPE`, contain the required header and text body, and pass through ordinary document loading.
- **L.3 Persistent provenance.** Generated TEI shall carry the configured responsibility on the TEI root and declare a matching `respStmt`. Reload shall restore the generated state only when both pieces agree.
- **L.4 Proposal provenance.** Every inserted model proposal shall carry `@resp` and remain visibly unverified until a human confirms or rejects it.
- **L.4a Acceptance and origin.** Confirmation shall add per-responsibility acceptance evidence without removing origin or other responsibility pointers. Accepted content shall remain visibly identifiable as model-origin; rejection shall address pending proposals.
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
- **B.7 Note navigation.** The Markup navigator shall filter source-backed primary units by detected notes, expose an accessible filter state and explain empty results. Filtering and navigation shall preserve canonical XML, document revision, dirty state, and history. A successful document replacement shall reset the filter; staged-source navigation restrictions shall continue to apply.

## Deterministic creation

An explicit starter choice may create new transcription, correspondence, charter, legal-source, dictionary-entry or encyclopedia-article TEI. Templates shall not infer historical facts, force an existing document into a genre, or apply AI provenance to deterministic transport. Dictionary entries shall use entry/form/sense; encyclopedia articles shall use div/head/p. The entry workspace shall support the supplied thirty-entry scenario and ordinary recovery, navigation and output validation. A starter alone does not establish compatibility with arbitrary project-specific fields.

## Entry management

- **E.1 Source contract.** The workspace shall distinguish dictionary `entry` elements from article divisions with `type='entry'` or `type='article'`. It shall respect explicit manifest suppression and require an encoding choice when creating the first entry in an empty document body.
- **E.2 Inspection.** Search, display sorting and completeness filters shall preserve XML, dirty state and history. Completeness shall describe missing entry identity, heading or text without claiming schema validity or editorial approval.
- **E.3 Exact fields.** Scalar edits shall require unambiguous XML targets. Mixed content and multiple field candidates shall remain accessible through XML. Semantic no-ops shall preserve lexical source spelling.
- **E.4 Identity and references.** Duplication shall allocate unused IDs for the entire copied subtree and rewrite supported internal pointers, including percent-encoded URI fragments. Ambiguous IDs or attributes and unresolved reference semantics shall prevent unsafe duplication. Deletion shall protect references to all descendant IDs within the active XML document.
- **E.5 Bounded batch.** A batch shall target an explicitly selected set of entries in the active document and only local language or number attributes. Its concrete before/after preview shall be bound to the source revision and current field values. Applying it shall create one Undo step; a stale or missing preview shall prevent application.
- **E.6 Recovery and read only.** Unfinished detail, creation and batch fields shall remain recoverable. Recovery shall restore batch targets and values while requiring a fresh preview. Read-only mode shall prevent mutations and preserve inspection and search.

## Witness reading and descriptions

- **T.1 Source identity.** Witness selection shall resolve unique local definitions and explicit reading `@wit` pointers, including defined witness groups. Grouping through `rdgGrp` shall not imply inherited `@wit`.
- **T.2 Reading evidence.** A selected witness shall expose an explicitly attested apparatus branch. Missing or ambiguous attribution shall remain visible without assuming agreement with the lemma. Empty readings and encoded fragment boundaries shall remain distinguishable. Text outside encoded apparatus shall remain base text.
- **T.3 Description editing.** Witness creation and simple description edits shall preserve unrelated source. Structured witness and referenced bibliographic descriptions shall use exact XML checked in full-document context, including definitions outside the header. Referenced IDs and descendants shall be protected against deletion or renaming.
- **T.4 Attribution editing.** Editing a reading's `@wit` shall retain its text and other attributes. New pointers shall require unique local definitions with resolvable local scope; unsupported external references shall remain available in exact XML.
- **T.5 View and session integrity.** Choosing a reading witness shall not mutate source or history. Witness forms and exact XML shall obey the shared staged-input, recovery, read-only and output contracts.

## Wenzelsbibel authoring contract

- **W.1 Specialized workspace.** An explicit Wenzelsbibel project identity or workspace declaration shall expose project forms through the shared session and preservation contracts.
- **W.2 Source fidelity.** Editing a normalized reading shall change only that reading. A deliberate diplomatic correction may update text and `@orig` together; mixed content without a safe form inverse shall remain accessible through exact XML.
- **W.3 Apparatus.** Existing comment types, languages, responsibility and boundary anchors shall retain their encoded values. New comments shall use explicit boundary anchors around the selected word range.
- **W.4 Project relations.** Image zones, statistical word ranges and shared-register references shall be checked against explicitly attached companions. Register deletion shall protect every descendant ID referenced by those companions, including encoded URI fragments. Transaction and output scope shall follow P.7–P.9.
- **W.5 Scholarly modelling.** Peoples shall use identified collective-agent records. Bible mappings shall retain the supplied edition's numbering and optional editor-supplied Latin text. Free reference labels shall acquire no implicit canonical scheme; new or changed `cRef` shall require an explicit, unambiguous header declaration. The [Wenzelsbibel contract](wenzelsbibel.md) defines field semantics and serialization.
- **W.6 Validation.** Bundled TEI All and the authored editing profile shall govern output when the project provides no schemas. A separate review phase shall check editorial completeness. The local profile shall retain its own authorship and identity because the original `Bilderfassung.sch` is unavailable. Formal checks shall remain separate from scholarly acceptance.
- **W.7 PAGE transport.** PAGE XML import shall create a separate draft, retain source text and usable geometry, respect declared order, and report unsupported or degenerate geometry. Import shall preserve image filenames and supply no inferred normalization, Latin text or codex fusion.

## Acceptance scenarios

The scenarios define assessable outcomes. A recorded technical pass applies to its specified code, inputs and environment. The responsible editor evaluates whether the resulting readings, annotations and workflows satisfy the edition's scholarly purpose; user acceptance remains a separate recorded decision.

| Scenario | Acceptance condition |
| --- | --- |
| No-op round trip | Open and serialize a representative TEI without changing any source byte |
| Mixed source | Derive several simultaneous capabilities, select a source-backed primary channel, and retain local token and text-run editing |
| Manifest override | Apply a valid project or document-type navigation policy and explain an unsatisfied override before falling back |
| Complete header | Inventory every TEI header field, edit simple values exactly, and keep structured content XML-only |
| Review | Append targeted evidence, detect source changes, restore current status on exact Undo, and reopen without erasing history |
| Cross-structure mention | Collect separated ranges, write one stand-off group, project every segment, and remove the group without text loss |
| Schema set | Execute every ordered schema and block when any result is invalid or unavailable |
| Validation lifecycle | Reuse a result only for identical XML and schema dependencies, invalidate changed state, cancel pending work without output, and allow a fresh request |
| Firefox fallback | Load through file input and obtain exact source bytes through Download and Save fallback after schema authorization |
| Supplied UFBAS whole book | Exercise real navigation, header, review, schema-gated output and accessibility when the rights-local object is available |
| Wenzelsbibel workspace | Exercise transcription, commentary, verses, images, shared registers, staged recovery and exact output with synthetic material; separately run supplied real codex and image files |
| Entry collection | Exercise both encodings, exact edits, ID-safe duplication, protected deletion, explicit batch preview, one-step Undo and recovery |
| Witness reading | Select explicit attestations, disclose absent/ambiguous/empty readings, edit descriptions and attribution, and preserve all source alternatives |
| Attached project | Restore edited companions and settings, authorize every XML file for one ZIP, and reject invalid, cancelled or stale package output |

## Key decisions

- **Project specialization, 2026-09-11.** The Wenzelsbibel workflow is a project workspace over the existing canonical document, session and schema gate. Its shared registers and verse model are editorial design decisions authorized for implementation; project editors retain scholarly acceptance.
- **Editing and completeness, 2026-09-11.** The authored Schematron distinguishes saveable unfinished work from editorial completeness. Existing source anomalies remain visible and need deliberate correction.
- **Responsive validation, 2026-09-11.** Expensive vocabulary-schema compilation runs in a worker and retains a compiled cache. A responsive interface does not weaken the requirement that the exact output bytes pass every configured schema.

- **Preservation before validated delivery, 2026-09-05.** A schema failure must not prevent preserving unfinished work. Independent local checkpoints and an explicitly unvalidated portable Working copy complement schema-gated TEI output.
- **Review and origin are separate evidence, 2026-09-05.** Review binds to source content and retains history. Proposal acceptance records a human decision while preserving machine and human responsibility pointers.
- **Explicit creation and reading tasks, 2026-09-05.** Deterministic starters and a transaction-enforced read-only mode support editors with different TEI experience without rebuilding their existing XML.

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
- Wenzelsbibel companions support persistent cross-file lookup, recovery and validated package delivery. Native saves remain document-local; atomic writes across external files and concurrent-editor coordination are outside this contract.
- Review fingerprints cover source ranges, excluding revision history. Separate metadata/register review and cross-document responsibility scopes remain open.
- Entry batches and deletion-reference checks cover the active XML file. Project-wide batch edits, cross-file relinking and additional project-specific fields require their own explicit contracts.
- Witness reading exposes encoded local attestations. External witness lookup, reconstruction outside encoded apparatus and arbitrary apparatus-location methods remain outside this contract.
- Raw Schematron uses a bounded XPath 1.0 interpreter. Rules outside that subset require compiled XSLT executable by the browser. An external validation result remains separate evidence and cannot authorize browser output.
- Provider adapters are registered by trusted application code. Declarative plugin discovery and remotely supplied executable adapters are outside the current security boundary.
- Rights-local objects supplement public synthetic fixtures when supplied for a recorded run. Real-object performance and facsimile claims shall identify the actual local source and accessible image service; see [Testing](testing.md) and the [editorial completion report](../reports/editorial-completion-2026-09-11.md).
- Large documents use whole-string parsing and reparsing. Segmented persistence would require a different canonical-state contract.

## Related

[Project](project.md) defines the editorial purpose. [Data](data.md) specifies serialized forms, [Architecture](architecture.md) explains their implementation, and [Design](design.md) governs interaction. [Testing](testing.md) links requirements to evidence.
