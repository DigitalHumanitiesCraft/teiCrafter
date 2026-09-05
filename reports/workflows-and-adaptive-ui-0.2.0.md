# teiCrafter 0.2.0: workflows, examples and adaptive interface

Status: product scope refining the implementation plan. Some creation and safety contracts are implemented; see the [latest implementation status](./refactoring-status-2026-09-05.md) for the boundary.
Date: 2026-09-05.
Related: [implementation plan](./implementation-plan-0.2.0.md), [assessment](./project-assessment-2026-09-05.md).

## User direction

The intended audience is editors and other people who want to create, inspect or improve TEI XML. User-specified reference tasks are:

- Convert an already transcribed letter into TEI quickly.
- Edit an existing charter encoded in TEI.
- Create or edit a collection of thirty lexicon entries.
- Open TEI simply to read it.
- Edit metadata and indices of a historical legal source.

A consistently good interface, adapted to the document and task, is a product requirement. The user proposed fictional examples and web research as alternatives to requiring a private project corpus. No specific real corpus is currently required to begin implementation.

## Audience and interaction level

Design the default workflow for a subject-competent editor who understands the source but may not know TEI syntax. Offer progressive access to:

1. Familiar editorial actions and clearly labeled fields.
2. Encoding explanations, source mappings, alternatives and project rules.
3. Complete XML and detailed diagnostics for experienced users.

These are layers in one application. Do not create separate beginner/expert applications or conceal existing XML that a form cannot represent. Expertise does not eliminate the need for efficient navigation, reliable saving or clear diagnostics.

## Example strategy

Use three complementary sources of evidence:

### A. Authored synthetic scenarios

Create original fictional source texts and independently reviewed expected encodings. Their purpose is predictable acceptance testing and understandable public demos. A fixture should specify source text, project/schema version, intended reading, permitted edits, expected resulting XML and expected user-visible behavior.

Each normal case gets deliberately difficult variants: incomplete metadata, uncertain dates, foreign namespaces, literal entity syntax, nested inline markup, alternative readings, existing schema errors, unavailable images, duplicate output names and interrupted work.

Synthetic does not mean model-generated XML is automatically a gold standard. Expected values must be checked independently of the implementation and any generation model.

### B. Public technical references and external TEI

Use authoritative documentation to inform structures and curated third-party XML to challenge assumptions. Candidate references inspected for this proposal include:

- [TEI correspondence examples](https://www.tei-c.org/Vault/P5/4.12.0/doc/tei-p5-doc/en/html/examples-correspDesc.html).
- [TEI Dictionaries](https://tei-c.org/release/doc/tei-p5-doc/en/html/DI.html).
- [DTA Base Format usage documentation](https://deutschestextarchiv.github.io/dtabf/howto.html) and its [official repository](https://github.com/deutschestextarchiv/dtabf).

These links identify references, not an already acquired or licensed fixture collection. Inspect actual source files and applicable licenses before vendoring them. Public visibility alone does not establish redistribution rights. Store source URL, release/revision, license, retrieval date and checksum for adopted fixtures. Core CI must not depend on live web search or mutable remote documents.

The inspected current TEI reference is 4.12.0, while the application vendors 4.11.0. Pin examples to the schema they are checked against; evaluate any version upgrade explicitly rather than silently adopting the latest documentation as the application's contract.

### C. Editorial pilot

After the technical scenarios work, have editors complete them and then try suitable actual editions. Real user observation tests discoverability and workflow fit; XML validation cannot establish either. Rights-local materials may remain optional local acceptance fixtures.

## Initial scenario collection

| ID | Scenario | Proposed original material | Essential acceptance outcome |
| --- | --- | --- | --- |
| LETTER | Transcript to TEI | Short fictional letter, optional second page, sender/recipient and uncertain date | Paste text, choose a starter profile, enter known metadata, annotate and obtain a valid/recoverable document without hand-writing tags |
| CHARTER | Existing documentary edition | Fictional charter with abbreviation, expansion, uncertain text, witnesses and optional scan | Correct a passage and inspect alternatives without losing text, metadata or unfamiliar existing markup |
| LEXICON | Thirty entries | Original historical terminology collection with cross-references and varying completeness | Search, create, duplicate and edit entries; preserve stable IDs and cross-references; identify unfinished entries |
| READER | Read unfamiliar TEI | Several encoding shapes, including front/back, notes and alternatives | Read, search and navigate without document mutations or overwhelming authoring controls |
| LEGAL | Metadata and indices | Fictional multi-section legal source with persons, places, institutions and legal concepts | Update metadata/register values, follow mentions and correct a link without accidental global replacement |

For LEXICON, include both a lexicographic encoding using `entry`-style structures and an article-oriented encoding using sections/headings. The word "lexicon" alone must not force an existing project into the dictionaries module. The exact mapping belongs to its schema/profile.

Provide a simple, difficult and scaled variant where useful. The thirty-entry workflow is explicit; larger entry collections are performance variants rather than a new functional promise.

## Adaptive interface model

Compose the interface from four separate inputs:

- **Observed structure:** actual XML elements, namespaces, text regions, pointers, facsimiles, apparatus and navigation channels.
- **Project policy:** schema, authoring vocabulary, field mappings, labels, templates and allowed transformations.
- **Current task:** reading, text/structure editing, metadata, indices or review.
- **User preferences:** chosen view, reading policy, pane layout and level of technical detail.

Document genre can suggest a starting profile. It must not override actual structure or a project's declared mapping. Conflicting evidence produces an explanation and a safe generic view. Users can change the view without silently changing the XML. Detection should be deterministic and inspectable; model classification is not needed to choose core UI capabilities.

This extends existing inventory, source profile, navigation model and project manifest modules. It does not require separate applications for every genre.

### Stable frame

- Keep document identity, working-copy state and output actions in stable locations.
- Provide consistent navigation/search and predictable access to reading, XML and metadata.
- Keep one main work surface and an optional context pane for facsimile, entity details, encoding help or validation.
- A contextual list can replace the main surface when the task is managing entries or an index; selecting an item opens its detail view. Do not force every task into a page-by-page transcription layout.
- Preserve keyboard focus, selection and pane choices during ordinary edits.
- Explain what a mode change affects. Opening an alternative view does not constitute an edit.

### Task and profile behavior

| Task/profile | Main surface | Context tools | Typical actions |
| --- | --- | --- | --- |
| Correspondence creation | Transcript/reading text | Sender, recipient, date, places, optional facsimile | Mark salutation, signature, person/place; explain resulting encoding |
| Charter/documentary editing | Source-oriented text with optional facsimile | Abbreviations, additions/deletions, uncertainty, witnesses and source description where mapped | Correct text, inspect expansion, annotate uncertainty, verify a passage |
| Lexicon editing | Filterable entry list and entry detail | Headword, article/definition, references and project-defined fields | New, duplicate safely, next incomplete, follow cross-reference, preview batch edits |
| Reading | Spacious reading text | Outline, notes, optional image, explicitly selected reading | Search, navigate, compare alternatives; editing tools appear on deliberate entry into editing |
| Legal-source metadata/index work | Structured metadata or register list | Mention locations, identifiers, authority candidates and source context | Edit description, rename/relink entry, inspect duplicates, navigate to a mention |

Not every charter uses the same diplomatic segmentation and not every legal source has the same conceptual index. Named fields are available only when a template or project mapping gives them an exact meaning and XML target. Unmapped information remains visible through source access.

## Creation and editing contracts

### Existing XML

Inspect structure and project settings; choose an initial compatible view. Never convert the document to a starter template merely to fit a form. Explain projection coverage and retain access to all original content.

### New from a transcript

Use a compact intake within the existing editor flow: transcript, optional starter profile and the essential known facts. Create a deterministic minimum TEI draft. An optional model can propose semantic structures, with review and provenance, but the user can finish the basic workflow without it.

Do not infer authorship, recipient, date or historical facts as established metadata. Leave unknown facts explicitly unresolved. Schema-required descriptions must transparently represent a draft or absent information rather than fabricated bibliographic claims.

Starter profiles need tested templates, field mappings, constraints and help text. A starter selection changes authoring defaults; it does not lock the document into a rigid genre-specific app.

### Repeated entries and index operations

Treat entry identity independently from file identity: thirty entries may inhabit one file or several. Separate display sorting from source-order changes. Duplicating an entry regenerates identifiers and handles internal references deliberately. Batch changes require a preview, scope and undo/recovery behavior.

Register edits distinguish an entity label, authority identifier and linked mentions. Merging potential duplicates is a user decision with an impact preview. A generic "replace all" must not stand in for entity relinking.

### Read-only use

Reading/search/navigation must not create XML IDs, provenance, review records or other source mutations. Working-view preferences may persist separately. "Read only" names document behavior, not merely hidden buttons.

## Additional workflows and scope

Include closely related tasks in the shared acceptance scenarios: compare a correction with a facsimile; resolve a validation error; inspect a note or alternative reading; identify and repair an unresolved reference; resume yesterday's work; review a unit; and deliver a working copy or validated result.

Consider poems, diaries, drama, interviews and critical editions as future domain-profile extensions. The generic reader must disclose limitations on those documents, but 0.2.0 does not promise bespoke expert authoring interfaces for every TEI module. Likewise, simultaneous multi-user collaboration, OCR/HTR, publication hosting and a complete visual ODD authoring environment are separate product scopes.

## Integration with the implementation plan

- **WP0:** establish the five scenarios and independent expected outcomes; prepare source/license registry for adopted external fixtures.
- **WP2:** verify recovery for transcript drafts, multi-entry editing and register forms; enforce the document read-only contract.
- **WP3:** support scenario-specific reading policies and source-backed selection, including the two lexicon encoding shapes.
- **WP4:** test reviewer identity and changed-since-review through these tasks.
- **WP5:** pin each profile's schema version and validate field/template mappings against it.
- **WP6:** explicitly deliver creation templates, composable field/detail views, the thirty-entry workflow, metadata/index workflows and deliberate read/edit modes. These expand the earlier authoring package and must be included in its estimate.
- **WP7:** benchmark entry lists and document navigation, not only raw XML parsing.
- **WP8:** pilot these exact end-to-end tasks with both less TEI-experienced and expert editors. Assess task completion, unintended edits, help required, recovery and confidence in the displayed reading.

The proposed release remains 0.2.0. This clarification makes its scope more concrete and adds UI implementation work; it does not establish a calendar estimate. Source-derived navigation and deterministic starters are implemented; full task-specific workspaces and their editorial acceptance remain distinct plan items, as recorded in the latest status report.
