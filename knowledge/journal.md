---
title: teiCrafter Decision Journal
project:
  name: teiCrafter
  repository: https://github.com/DigitalHumanitiesCraft/teiCrafter
method:
  name: Promptotyping
  url: https://lisa.gerda-henkel-stiftung.de/digitale_geschichte_pollin
template:
  name: Vorlage Journal
  version: 0.1
  url: https://dhcraft.org/Promptotyping/promptotyping-document/journal
status: active
created: 2026-02-05
updated: 2026-09-11
language: en
topics: ["[[Decision Log]]", "[[Promptotyping]]"]
related: [project, specification, architecture, data, design, testing, integration, worked-examples, wenzelsbibel, handoff]
---

# teiCrafter Decision Journal

The entries record the triggers, decisions and reasons that explain teiCrafter's development, in reverse chronological order. Integrated, Corrected and Rejected identify substantive transitions; Compacted identifies maintenance of their provenance.

## 2026-09-11 | Compacted | Decision provenance

The user requested a complete knowledge refresh after the editorial implementation. Repeated session accounts had obscured decisions behind intermediate status and copied contracts. This journal was compacted from the clean [e6e58d0 baseline](https://github.com/DigitalHumanitiesCraft/teiCrafter/blob/e6e58d05cb6d527c96e6b95c3e59855d495b374a/knowledge/journal.md), retaining causal decisions and their corrections while routing maintained behavior to its owners. The [documentation report](../reports/documentation-report-2026-09-11.md) records the disposition and verification. Git preserves the full earlier wording.

## 2026-09-11 | Corrected | The Process Inbox has an independent purpose

The review against the Promptotyping convention exposed a gap in the July handoff decision. Dated reports preserve observations, whereas received changes need a live place to await source checking and integration. The adopted [Process Inbox](handoff.md) gives those inputs an explicit source, target and context; processed inputs leave a journal record and are removed. This corrects the earlier treatment of journal and reports as sufficient for every handoff function. The [index](INDEX.md) and [repository instructions](../CLAUDE.md) own the resulting routing and maturity contract.

## 2026-09-11 | Integrated | Bounded entry and witness workspaces

The user requested completion of entry management, witness editing and batch operations. The chosen workspaces reuse the source-preserving session and expose fields with a defined inverse into XML. Duplication requires collision-free identifiers and remapped internal references; deletion and batches must resolve exact targets before applying. Witness reading follows explicit attribution and discloses missing or ambiguous evidence. A convenient form cannot establish a scholarly relationship absent from the source. [Specification](specification.md) and [design](design.md) carry the maintained editing and preview contracts; the [editorial completion report](../reports/editorial-completion-2026-09-11.md) records the integrated evaluation.

## 2026-09-11 | Integrated | Persistent project collections and complete delivery

The Wenzelsbibel workflow showed that switching among a codex, image annotations and registers was insufficient when reopening could lose companion state. Linked documents became a recoverable collection with file-specific settings and resources. A project package requires every XML file to pass its effective schema set; any failed or stale result prevents complete delivery. Native writes retain their file-scoped boundary. The decision separates preservation of unfinished research work from authorization of a shared output artifact. [Data](data.md) defines the formats and [integration](integration.md) their external-file boundary.

## 2026-09-11 | Corrected | Restoration preserves identity before checkpointing

Integration checks found drafts inheriting another file's schema, delayed switches overlooking intervening edits, and Working copy restoration creating duplicate or incomplete checkpoints. File identity and its settings must precede automatic persistence; restoration must finish before a checkpoint represents the recovered document. Delayed loads and switches must still belong to the captured session and project state. A successful write can misrepresent work when its identity and contents come from different moments. [Architecture](architecture.md) owns this ordering contract.

## 2026-09-11 | Corrected | References require encoded evidence

Independent review exposed free Bible references represented as undeclared canonical references, image ranges ending on non-word elements, and structural checks overlooking descendant identifiers, encoded URI fragments or duplicate attributes. The corrected contract refuses ambiguous operations and preserves source findings for explicit editorial resolution. A free reference remains distinct from a declared canonical-reference system. Well-formed TEI alone cannot establish referential correctness within an edition. [Wenzelsbibel](wenzelsbibel.md) and [specification](specification.md) own the accepted reference rules.

## 2026-09-11 | Integrated | Validation remains exact on large sources

Real codex work exposed expensive repeated inventory scans and cold schema compilation. Source-derived caches and a dedicated validation worker were adopted without reducing the configured schema set. Reuse of a successful output decision is limited to identical XML and the complete identical schema dependency graph, captured before asynchronous work begins; cancellation terminates active validation. This preserves full first-validation authority while avoiding redundant work on unchanged inputs. [Architecture](architecture.md) explains cache identity and cancellation; [dated evidence](../reports/editorial-completion-2026-09-11.md) records observed performance.

## 2026-09-11 | Integrated | Reproducible evaluation records its exact subject

The request for stable evaluation required results traceable to an identifiable code and data state. The method captures source fingerprints, toolchain and browser versions, exclusions and timings, and treats interrupted runs or changing inputs as failures. Independent expected XML and external schema checks complement browser and storage behavior. Cold Firefox schema work justified adjusting affected test waits to measured work while preserving assertions; retries cannot conceal an initial failure. [Testing](testing.md) owns the method and the [completion report](../reports/editorial-completion-2026-09-11.md) states its acceptance boundary.

## 2026-09-11 | Integrated | Wenzelsbibel specialization follows an explicit editorial model

The user requested branch consolidation and a Wenzelsbibel annotation workflow, authorizing the modeling of missing register, verse and image contracts. The Notes pilot was integrated into main and the workspace was built on the shared XML session. Collective-agent records and independent verse mappings express the selected model; the authored image profile separates permissive editing from completeness review. Missing source rules, including the original image schema, remain identified as missing. [Wenzelsbibel](wenzelsbibel.md) owns the model and source basis; the [workflow report](../reports/wenzelsbibel-workflow-2026-09-11.md) records the initial evaluation.

## 2026-09-11 | Corrected | Examples establish what they loaded

A production check found a missing codex asset returning HTML with successful HTTP status and replacing the XML session. Example admission now checks the content boundary, and the synthetic fallback declares its own workspace without inheriting the codex image resolver. The same review found that copying local research data into build output could cross the redistribution boundary. Public artifacts therefore require explicit versioned resource selection. [Data](data.md) and [testing](testing.md) own the resource and missing-asset contracts.

## 2026-09-11 | Corrected | A visible unfinished edit has one owner

The synthetic example exposed competing input owners when a project panel appeared beside XML or metadata editing. The shared ownership contract was extended so those source views retain the staged edit and project forms resume in the appropriate reading context. This continues the September input refactor, which unified unfinished reading, XML and metadata changes. A contextual surface must never clear another visible draft merely because it rerenders. [Architecture](architecture.md) and [design](design.md) define ownership and restoration.

## 2026-09-05 | Integrated | Editorial integrity includes unfinished work

Assessment of the letter, charter, lexicon and reading workflows showed that exact XML splices alone did not make everyday editing safe. Literal input, collision-aware output and independent recovery became integrity requirements. Read-only mode was placed at the mutation boundary; deterministic starters retained distinct dictionary and article forms while existing documents determined their own capabilities. The decision protects source and unfinished intervention without forcing documents into a convenient template. [Specification](specification.md) owns the requirements; the [assessment](../reports/project-assessment-2026-09-05.md) records their trigger.

## 2026-09-05 | Corrected | Acceptance preserves origin and review preserves history

The assessment exposed confirmation erasing machine origin and reviewed pages appearing current after editing. Acceptance therefore retains provenance and records human acceptance separately; review binds to the actual source scope while keeping earlier history. This corrects the June convention of removing the AI responsibility marker on confirmation. Annotation coverage, model origin and current review require independent evidence. [Data](data.md) defines their representations and [specification](specification.md) defines the transitions.

## 2026-09-05 | Corrected | Maintained knowledge and dated evidence have distinct owners

The June consolidation removed duplicated planning and status material after copies diverged; the July refactor continued that separation into function-specific knowledge and dated reports. The September refresh retained upstream notices and the independent converter contract, and made implementation, release scope and historical observations separately navigable. Copied version fields also caused unrelated maintenance, so the shared documentation schema version gained one owner in the [index](INDEX.md). Git and substantive update dates identify content history; [reports](../reports/README.md) preserve run-specific evidence.

## 2026-08-24 | Integrated | Source interpretation composes local evidence

UFBAS and heterogeneous TEI exposed global folio, word or line modes hiding legitimate structures and mixed editing units. Source Profiles therefore compose namespace-aware document evidence with conservative schema evidence and project policy. Navigation retains supported source-backed channels; granularity belongs to the local cell. This corrected the earlier global word-token rule and local-name-only interpretation. Foreign elements with TEI-like names remain distinct. [Architecture](architecture.md) owns the interpretation model and [data](data.md) the supported encodings.

## 2026-08-24 | Integrated | Schema evidence and output authorization have different authority

Authoring needed live schema information without incomplete vocabulary analysis blocking reading. Effective schemas therefore contribute conservative hints; unresolved evidence remains unknown. Output separately requires every schema in the effective ordered set to validate the exact projected bytes, with TEI All supplying the default only when a project provides no schema. Asynchronous evidence that leaves navigation unchanged must preserve active selection. [Specification](specification.md) states this authority boundary and [architecture](architecture.md) explains its composition.

## 2026-08-24 | Integrated | Document sessions bound asynchronous work

Whole-book work exposed model results outliving their revision, context changes before successful loading, and implicit encoding or external-write assumptions. Documents gained session identity, revision, undo history and savepoints, with asynchronous jobs tied to their subject. Load, proposals and output recheck that subject before changing state. Unsupported encodings are refused because fidelity depends on a defined byte boundary. Later persistence refactoring applied the same rule to delayed writes and detached editing surfaces. [Architecture](architecture.md) and [specification](specification.md) own these contracts.

## 2026-08-24 | Integrated | Progressive access preserves arbitrary source

The UFBAS book made whole-document source rendering impractical and exposed a preserved header without an editing surface. The selected navigation unit became the source-editing scope while the complete document remained the validation and commit boundary. Metadata combined safe common fields with exact header access; mixed content retained its XML path. Progress and later note filtering reused source projections, and expensive folder work remained explicit. This makes frequent work direct while preserving arbitrary TEI access. [Design](design.md) owns the disclosure pattern.

## 2026-08-24 | Corrected | Browser evidence must survive a clean checkout

Early browser use exposed selection, visibility and stale-surface defects beyond engine fidelity checks. Acceptance therefore combined deterministic proofs, independent XML checks and browser interaction with accessibility inspection. A clean Linux checkout then revealed missing synthetic resources, platform-specific harness assumptions and controls overlapping under different font metrics. Tracked inputs and rendered geometry became verification subjects. Real editions remain necessary because they expose combinations absent from small fixtures. [Testing](testing.md) owns the method and [design](design.md) responsive behavior.

## 2026-08-22 | Corrected | Generated TEI must pass structural admission

The Hersch pilot produced local-model proposals that were placeable but editorially unreliable, and generation responses omitting essential TEI structure. Generation received a minimum complete skeleton and admission checks that refuse malformed, unsafe or incomplete responses before session replacement. Review was also completed for stand-off notes, with cleanup of unused session-created responsibility metadata after rejection. These decisions preserve the deterministic document when model output is poor. [Integration](integration.md) and [specification](specification.md) own generation and proposal admission.

## 2026-08-22 | Corrected | Local model identifiers follow the local runtime

The pilot found an installed Ollama model that repository aliases could not select. Exact nonempty local identifiers were therefore accepted from the user while cloud providers retained catalog validation. The local runtime is authoritative for installed names. This sits within the later provider-adapter boundary, through which trusted application code supports protocols and project manifests remain declarative. [Integration](integration.md) owns provider configuration and the boundary for data sent to services.

## 2026-08-22 | Integrated | Hersch interchange preserves the project format

The June inline-GND work separated register-based editing from Hersch delivery. Corpus and schema evidence selected typed inline elements and authority syntax, including the format's loss of place annotations. Export began as an opt-in handover; re-import wiring waited for an ordinary Save decision. The real pilot resolved this by lifting the recognized Hersch format for editing and projecting it back on output. Repeated import/export must reach an exact fixed point. External image folders provide session-local access without copying on Save. [Integration](integration.md) owns the exchange contract.

## 2026-07-27 | Corrected | Comparative claims require evidence of the difference

LEAF-Writer's workshop record contradicted the earlier broad claim that no tool combined TEI annotation, assistance and human review. Comparison was narrowed to source fidelity, schema admission and browser persistence, with architectural inferences distinguished from measurements of a running instance. The correction keeps the research claim proportionate to its evidence. [Project](project.md) owns the related-work comparison.

## 2026-06-20 | Integrated | Proposal review follows the construct being judged

Per-entity confirmation left proposed markup, critical marks and notes without a consistent human decision path. Review was generalized to AI-marked constructs at their contextual surfaces, protecting human markup by default. Rejection follows the construct's meaning, preserving wrapped text while removing a proposed note or gap marker. A gap cannot itself recover replaced text; an introduced note-target identifier can remain. The original confirmation rule was later corrected to preserve provenance. [Specification](specification.md) and [design](design.md) own current review behavior.

## 2026-06-16 | Integrated | Assistance is additive and project-aware

After temporarily hiding the unproven generation entry, the user explicitly restored it and requested general assistance. One user-controlled gate was chosen so the deterministic editor remains complete with AI disabled. Instructions bind to project document types and proposals reuse source-preserving mutations with persistent TEI responsibility. Confidence remains categorical and origin has color and non-color cues. Deterministic pipeline checks and model-quality assessment provide distinct evidence, with scholarly acceptance retained by the editor. [Integration](integration.md), [data](data.md) and [testing](testing.md) own these contracts.

## 2026-06-13 | Corrected | Editing and annotation use distinct gestures

A real letter exposed the conflict between single-click editing and selecting fixed text for annotation. The line-editor experiment was withdrawn in favor of double-click editing and selection-based annotation, with wrapping fields for long prose. Selection must remain visible when an annotation form gains focus. Overlaps require a complete layer inspector because an innermost-only projection hides structure. These decisions align an action with the source object it can safely change. [Design](design.md) owns gestures and feedback.

## 2026-06-13 | Integrated | The index supports reconciliation in context

Dense forms obscured the index's overview function and authority identifiers were difficult to verify. The index became a filterable reconciliation surface with direct record links, while detailed editing stays at the mention or selected record. Unknown index types remain visible with an explicit editing boundary. Repeatable typed authority identifiers belong to entities; mention pointers retain entity identity, including after retyping. Automatic lookup requires project opt-in because it sends edition text outside the browser. [Data](data.md) and [design](design.md) own this contract.

## 2026-06-12 | Integrated | Plaintext intake transports encoded structure

A real-letter workflow established deterministic text and image intake as an editor entry point. Explicit page markers determine breaks; images follow that order and cannot infer text boundaries. Semantic annotation remains an editorial action, preventing a pseudo-syntax from becoming an unreviewed alternative to XML. Deterministic drafts receive neutral source status. A draft lost on refresh also established recoverable unfinished work and explicit discard. [Data](data.md) specifies intake conventions and [worked examples](worked-examples.md) their editorial use.

## 2026-06-12 | Integrated | Guided markup uses bounded vocabulary evidence

The request for TEI Guidelines support, followed by difficulty reaching a date's attributes, established contextual vocabulary and attribute editing. Versioned Guidelines data supplies reference evidence and project elements supply a curated working set; broad module inventories are unsuitable as unfiltered action menus. Missing reference data degrades to explicit configuration, while local date hints remain advisory because uncertainty may be intentional. Formal output validation retains separate authority. [Design](design.md) and [architecture](architecture.md) own guidance and vocabulary resolution.

## 2026-06-12 | Corrected | Visual semantics are shared and inspectable

UI reviews found inconsistent colors, hidden controls still rendering and provenance depending on undefined styles. Shared tokens established consistent meanings for interaction, actions and AI origin, with non-color evidence for provenance. The TEI palette required accessible text variants alongside bright fill colors; semantic visibility was enforced centrally against conflicting component styling. These decisions extend the expert-in-the-loop and categorical-confidence principles adopted from related tools. [Design](design.md) is the maintained value source.

## 2026-06-11 | Integrated | Dual reading edits remain atomic

The Wenzelsbibel encodes diplomatic text alongside original and normalized attributes. Related word changes therefore commit atomically, preserving the distinction between absent normalization and an empty value, and mirroring diplomatic text only where the source encodes that relationship. Normalized reading remains a projection. Offset-dependent annotation stays with the diplomatic view; element-anchored editing can operate in either view. [Wenzelsbibel](wenzelsbibel.md) owns the encoding and [specification](specification.md) atomic editing.

## 2026-06-10 | Integrated | Projects declare policy for several document types

The user corrected the assumption that a project was an edition type. A project can contain different document types, so a declarative manifest binds policy per file and type, with defaults and source detection as fallbacks. Open project folder uses an explicitly granted directory handle rather than origin-private storage because editors need ordinary files in existing workflows. Missing editorial rules remain unspecified instead of being inferred. [Data](data.md) defines the manifest and [integration](integration.md) project authority.

## 2026-06-10 | Integrated | Reading and source share a contextual workspace

The user rejected source mode displacing the facsimile and intermediate screens interrupting direct editing. Reading or XML became the left work surface with project-dependent context alongside it. A separate welcome surface was withdrawn; the empty editor retains direct loading. Short texts can remain continuous, generated navigation aids stay distinct from source labels, and controls remain near their subject. Complete control groups wrap under constrained width. [Design](design.md) owns the layout and disclosure pattern.

## 2026-06-10 | Rejected | Automatic reformatting and prerequisite configuration

Source-editor refinement raised two possible conveniences. Pretty-printing was refused because it rewrites unrelated lexical choices; mandatory configuration before file opening was rejected because source-derived entry is a product requirement. Exact XML remains a first-class path with explicit checks, and guided forms appear when their evidence exists. [Specification](specification.md) owns preservation and open-document requirements.

## 2026-06-10 | Rejected | Consolidating landing and editor

The landing appeared redundant after direct editor entry and a separate About description. The user approved consolidation, then reversed the decision after seeing it. The public landing was retained because its presentation served a real purpose; shared example configuration limited the cost of overlapping entry points. This explains the separate public and working surfaces in [design](design.md).

## 2026-06-10 | Corrected | Public descriptions explain observable behavior

The user rejected promotional shorthand and challenged both unexplained byte identity and the term emergent granularity. Public text therefore explains the editorial consequence of preservation and states that the editing unit is read from the document. It identifies browser and data-transfer boundaries where relevant and avoids treating temporary feature flags as product identity. Examples are framed as projects because their sources and purposes differ. [Project](project.md) and the [user overview](../README.md) own that description.

## 2026-06-10 | Integrated | Shared mutations preserve source meaning

Review found duplicated mutations and XML-like regular expressions disagreeing with the reader about nested mentions, notes and no-op changes. Mutations were consolidated behind a shared source-based boundary using parsed structure and freshly resolved targets. Structural operations follow the source's milestone form and refuse ambiguous partial changes. Inspection and editing must refer to the same construct; unchanged input preserves source and history. [Architecture](architecture.md) owns the boundary and [testing](testing.md) its acceptance conditions.

## 2026-06-10 | Integrated | Facsimile interpretation is project evidence

The codex exposed polygon-only zones and bare filenames requiring an IIIF resolver. Geometry and resource resolution became projections of encoded or declared project evidence. Image intake later showed that a generic resolver must preserve the opportunity for a project resolver to interpret a filename. Coordinate-scale and manifest support require explicit parsing contracts; recognizing a format does not establish its implementation. [Integration](integration.md) and [data](data.md) own the supported image contracts.

## 2026-06-09 | Integrated | Real-source evidence respects redistribution rights

Preparing Hersch examples exposed the assumption that publicly accessible data could be redistributed. Rights-bound material remained local and reproducibly materialized; committed examples use rights-cleared sources or explicit synthetic twins. DEPCHA later followed the same rule. Local availability and a fallback must be reported separately, and example visibility cannot establish a licence. The September build restriction applies this decision to production artifacts. [Data](data.md) owns provenance and [worked examples](worked-examples.md) the evidence each source supports.

## 2026-06-09 | Corrected | Working code does not establish scholarly acceptance

The user challenged a claim of experiment success before research partners had accepted its value. The criterion became demonstrably improved TEI with deliberate curation distinguishable from preserved pipeline output, followed by responsible editorial assessment. Both demonstration objects were exercised through teiCrafter, replacing the earlier Hersch demonstration through EditionCrafter. Synthetic reconstruction, real-source behavior and user judgment remain distinct evidence. [Project](project.md), [worked examples](worked-examples.md) and [testing](testing.md) own those claim boundaries.

## 2026-06-08 | Integrated | Critical markup follows TEI semantics

Textual criticism required decisions beyond ordinary wrapping. A gap replaces text because the TEI construct is contentless, and the reading view must expose the marker and its editing boundary. Removal of a wrapper shared by sibling content is refused so a cell action cannot silently remove another passage's annotation. Whitespace preservation belongs in the common edit contract. [Specification](specification.md) owns these requirements and [design](design.md) their visible consequences.

## 2026-06-08 | Integrated | Conversion and assistance have separate authority

SZD supplies Page-JSON and catalog metadata rather than ready transcription TEI. Its conversion contract was grounded in the source prototype and kept deterministic; model assistance is reserved for proposals an editor can judge. A coordinate-unit doubt was resolved against the correct field, and duplicated fixture text was routed to its converter rather than hidden in the editor. The related repositories remain independent with explicit data-flow contracts. [Converter reference](converter-reference.md) preserves the frozen mapping and [integration](integration.md) the project boundary.

## 2026-06-04 | Corrected | Editing fidelity needs more than an identity round trip

Audit and browser use found entity-escaping, whitespace and newline defects beyond unchanged-file comparisons. Verification expanded to deliberate edits with independent complete expected output, including entity notation and preserved edge text. Integrity checks use encoded identifiers, and tolerant lossless parsing remains distinct from structurally valid projection. Assertions about styling or safety also require checking the artifact rather than repeating intended behavior. [Testing](testing.md) owns the fidelity method.

## 2026-05-30 | Corrected | The editor became the canonical working path

Hersch and SZD showed that a word-only editor and generation stepper could not represent the intended workflow. The chosen core retains raw XML and performs deliberate offset splices, letting file diffs expose intervention without unrelated serializer normalization. Generation became an optional marked draft entering the same editor, and the stepper was retired. Interpretation later gained namespace and local-granularity contracts. [Architecture](architecture.md) owns the model and [project](project.md) its editorial purpose.

## 2026-02-05 | Integrated | Prototype exploration and method

The [FORGE 2023 prototype](https://doi.org/10.5281/zenodo.8425163) explored LLM conversion of correspondence into TEI. The renewed project began with an import-to-export stepper and adopted a walking-skeleton-first approach so real sources could expose constraints. Function-separated knowledge and expert-in-the-loop principles later supported the editor-first correction. The early market analysis was narrowed when related work contradicted its broad novelty claim. [Project](project.md) owns the lineage and methodological framing.
