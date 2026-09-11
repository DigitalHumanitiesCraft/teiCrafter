---
title: teiCrafter Design System
project:
  name: teiCrafter
  repository: https://github.com/DigitalHumanitiesCraft/teiCrafter
method:
  name: Promptotyping
  url: https://lisa.gerda-henkel-stiftung.de/digitale_geschichte_pollin
template:
  name: Vorlage Design
  version: 0.1
  url: https://dhcraft.org/Promptotyping/promptotyping-document/design
status: complete
created: 2026-05-27
updated: 2026-09-11
language: en
topics: ["[[Information Visualisation]]", "[[Scholar-Centered Design]]", "[[Human-Computer Interaction]]"]
related: [project, specification, architecture, data, testing, wenzelsbibel]
---

# teiCrafter Design System

## Design position

teiCrafter makes source-backed editorial actions and their scope visible. The interface adapts to observed TEI structures; project policy can refine that interpretation. A form offers direct editing where it can preserve the source and provides an exact XML route for structured or ambiguous content. Refusals identify the affected operation and leave the editor's input available.

The human editor decides scholarly content. Deterministic transformations use ordinary interface colours. Model-origin content retains its provenance after acceptance, while a distinct pending treatment identifies proposals awaiting a decision. Review records describe an explicit editorial act. Annotation coverage, schema validity and review status remain separately labelled states.

[Specification](specification.md) defines the required behaviour, [Data](data.md) defines its encoded representations, and [Testing](testing.md) defines the evidence needed to assess the interface.

## Visual identity and tokens

The wordmark `<teiCrafter>` combines the TEI blue and yellow brand family. TEI yellow marks primary actions with dark text for contrast. TEI blue marks source and annotation interactions. Violet is reserved for model-origin content.

Components consume the shared CSS custom properties. Component styles introduce no raw colour values.

| Family | Tokens | Meaning |
| --- | --- | --- |
| Surface | `--color-surface`, `--color-surface-sunken`, `--color-panel`, `--color-secondary` | Document, pane, band and control backgrounds |
| Brand and action | `--color-header`, `--color-gold`, `--color-gold-hover`, `--color-link` | Site identity, primary actions, focus and links |
| Text | `--color-text`, `--color-text-body`, `--color-text-secondary`, `--color-text-muted`, `--color-text-inverse` | Reading text and information hierarchy |
| State | `--color-confident`, `--color-review`, `--color-problem` with tint partners | Categorical success, review, warning and failure |
| Model provenance | `--color-ai`, `--color-ai-tint` | Generated or proposed content, with pending and accepted treatments |
| Annotation | Entity-specific foreground and background tokens | Semantic layers |
| Geometry | `--space-*`, `--radius-*`, `--shadow-*` | Spacing, grouping, focus and elevation |
| Type | `--font-ui`, `--font-mono`, `--font-serif` | Controls, XML or identifiers, and public narrative text |

Status uses categories and words. Numeric confidence requires a calibrated producer; the application currently supplies none. Colour has a second channel through text, borders, underlines or patterns.

## Editor frame

The left pane holds Reading text, XML source and Metadata. The right pane holds context panels, including Facsimile, Index, Source and supported editorial workspaces. A keyboard-operable splitter resizes or collapses the context pane; a narrow layout stacks the panes.

Document identity below the toolbar identifies the source, project interpretation and save target. The empty editor provides a direct load prompt, recent handles where supported and independent recovery offers. View tabs stay in their pane headers. Pane-header controls wrap according to the available pane width so that resized panes retain accessible targets.

The toolbar distinguishes actions by their actual effect.

| Action | Meaning presented to the editor |
| --- | --- |
| Save | Validate and write the active document through its writable handle, or use the download fallback |
| Download | Request a schema-authorized copy of the current XML |
| Working copy | Preserve unfinished XML, staged fields and the attached project collection without a schema gate |
| Project package | Validate each XML document and request one ZIP containing the project collection |
| Restore | Reopen a preserved session and its companions |
| Discard | Explicitly remove the selected preserved work |
| Read only / Edit document | Disable or restore source-changing actions while retaining inspection |

Save is the primary gold action. Copy and preservation actions use neutral styling. Download feedback reports a requested download and retained recovery. A browser download supplies no evidence that the user has stored the file durably.

Reading, XML, Metadata and workspace forms share Apply and Cancel semantics. Unfinished values and caret position survive background refresh. Navigation, history or another mutation cannot silently replace the active input owner. A blocked action directs the editor back to that surface; a failed Apply keeps the entered values. XML source and Metadata retain ownership while open, so a context form presents a return hint instead of mounting another editor.

Switching attached documents checkpoints the current collection first. A storage error or intervening edit leaves the current document active and explains the failed switch. Each file retains its own source and schema settings. Native Save remains an active-file operation. The [project collection contract](specification.md#project-and-schema-declarations) governs package output and recovery.

New document provides an explicit starter, transcription, optional source facts and images. Nearby help describes the resulting encoding. Correspondence facts appear with that starter; dictionary and encyclopedia choices remain distinct. Existing XML opens through the ordinary loader. Project-folder groups are keyboard-operable and use full relative paths as accessible file names.

## Source Profile disclosure

The Source panel explains the detected structures, primary navigation channel, additional channels, authoring scope and resolution issues. Its language identifies the TEI evidence behind the projection. A manifest can request another channel when matching source units exist.

Pager and review labels follow the primary channel. Page, entry, speech turn, record, row, section, surface, corpus member and source document terms require their corresponding source anchors. Generic unit labels remain available where the evidence does not justify a more specific name.

An unsatisfied manifest request or ambiguous interpretation remains visible beside the selected fallback. The editor can then inspect the source or revise project policy without losing access to the document.

## Reading surface

A plain click positions the cursor. Double-click opens exact text or dual-reading editing. Existing annotation layers open their inspector; right-click and text selection expose scholarly actions. Selection stays visibly painted while a popover holds focus. Keyboard arrows traverse cells, and F2 or Enter opens a supported editor. Composition input cannot commit prematurely.

Local cells determine the edit controls. Encoded tokens expose their text and reading attributes; other readable content uses exact text runs. Mixed documents retain both forms. The reading preserves source adjacency and selects the appropriate encoded choice branch. The [reading representations](data.md) define the source contract.

Base apparatus text displays the lemma, falling back to the first reading when no lemma is encoded. Witness selection uses explicit attestations and discloses missing or ambiguous attribution, omissions and fragment boundaries. Text outside encoded apparatus remains base text. All alternatives remain available in XML and the Witnesses pane.

Entity types use muted categorical colours. Nested and overlapping layers receive stacked underlines and an inspector listing each layer. Missing targets and model provenance appear in text as well as visual treatment.

### Cross-structure and discontinuous selection

**Add another segment** retains the current range and returns focus to the reading surface. The editor can collect another range in the same or a different navigation unit. The popover shows separated passages before an entity is selected or created.

Overlapping collected ranges are refused. A range crossing XML structure or existing markup uses the stand-off route. Each visible segment opens the shared annotation; relinking and removal address that group. The [span contract](specification.md#cross-structure-and-discontinuous-spans) defines preservation and boundary cleanup.

For inline-GND output, the interface explains which crossing, overlapping or discontinuous selection cannot be represented and blocks the affected annotation action.

## Metadata and exact XML

Metadata presents the complete TEI header inventory. Familiar fields keep their labels and grouping; project-specific fields remain discoverable by generated label and exact path.

An editable field means that a lossless inverse is available. Structured, mixed, self-closing or namespace-sensitive content displays **XML-only** with an exact XML route. Inspecting an unchanged field preserves its source spelling. Dedicated witness actions follow their bounded contract even when their records occur inside the header.

XML source exposes the current navigation range where a safe boundary exists, otherwise the complete document. Check and Apply evaluate the complete substituted XML. Find, replace, line navigation, indentation assistance, context completion and keyboard Apply support source work. Automatic reformatting would rewrite unrelated source and is outside this surface's interaction contract.

## Review and progress

The Markup navigator offers All and Notes filters with an explicit pressed state. Notes limits the unit list to detected notes while the main total continues to describe all annotations. A result opens its source unit and focuses an available marker. Empty results are explained, and document replacement resets the filter.

Markup coverage describes the presence of semantic markup. Review describes an editor's recorded examination of the current primary unit. Marking or reopening review retains history. Source changes produce **changed since review**; historical evidence remains inspectable. [Review Records](specification.md#review-records) govern the relationship between the visible status and the encoded evidence.

The review dialog requests reviewer identity and rationale, identifies its default as an unnamed local editor, shows a prior record when present and explains the covered source range. An external register entry or another unit requires its own review. A structurally unsafe record mutation leaves the source unchanged with a specific explanation.

## Output schema gate

The validation details identify the effective repository, project or session schema set. Results retain configured order and show schema names, categorical validity, diagnostics and applicable runtime limits. Unsupported rules or unresolved dependencies appear as **unavailable**, with a concrete recovery route such as supplying the dependency or compiled XSLT.

Save and Download may initiate validation. Progress distinguishes schema preparation, XML parsing, validation and reuse of an identical successful result. The main interface remains usable during worker execution. Changed state invalidates output authorization; an earlier success cannot be shown as permission for different bytes.

**Cancel validation** ends pending work without authorizing output. The editor can request validation again. Project package has its own cancellation control and reports success only after every XML file is authorized. Errors identify the affected document or schema. The [output gate requirements](specification.md#fail-closed-multi-schema-output-gate) define these decisions; [Architecture](architecture.md) describes worker and cache ownership.

## Entry and witness interaction

The Entries pane combines a searchable collection with source-bound details. Sorting changes display order, and completeness identifies missing identity, heading or text. Selecting an entry or following a local reference opens its source unit. Bounded table regions support keyboard scrolling. An empty body requires an explicit encoding choice before its first entry is created.

Direct fields identify their target and expose structured or ambiguous values through XML. Duplication retains the original and selects the copy. **Preview deletion** names the whole subtree and displays blocking references; confirmation is available only for a safe current preview. These actions operate on the active XML file.

Batch editing starts with checkboxes or **Select all matching**, then **Batch edit selected**. The editor chooses local language or number and inspects concrete before/after values. A field change invalidates the preview. Apply creates one Undo step. Recovery retains unfinished targets and values while requiring another preview. The [entry requirements](specification.md#entry-management) define duplication, reference protection and batch scope.

The Witnesses pane separates **Reading witness** from source edits. It exposes every apparatus alternative and direct attribution. **New witness** creates a description in the selected list; structured descriptions use **Edit witness XML**. Reading-attribution controls change the selected reading's witness pointers. Missing definitions, ambiguous readings and existing external pointers remain visible. Arbitrary list restructuring and external-reference conventions use exact XML.

Witness forms share staged recovery and read-only behaviour. The [witness contract](specification.md#witness-reading-and-descriptions) defines supported evidence and preservation. Selecting a witness expresses a reading preference and provides no scholarly acceptance of that witness's reconstruction.

## Wenzelsbibel interaction

The Wenzelsbibel workspace places specialized forms beside the shared reading, XML and metadata surfaces. Bounded word tables keep transcription controls accessible. Apparatus forms retain existing type, language and responsibility values. The [Wenzelsbibel contract](wenzelsbibel.md) owns the field mapping and operating routes.

Companions are explicitly attached under **Linked project documents**. A word-range picker preserves the active form. Following an image reference from a codex word opens that image record through the normal document-switch boundary. The miniature viewer focuses an available codex zone and explains missing image access.

ICONCLASS lookup follows an explicit search or notation request. A selected result fills fields for review before Apply; manual values remain usable if the service fails. Project checks distinguish relationship failures, structural issues and editorial completeness. Their findings retain separate labels from output-schema authorization.

## Model assistance

Generated-document banners, proposal layers and model actions use violet. Dashed outlines and **AI-proposed, unverified** identify pending proposals without relying on colour. Accepted model-origin content uses solid violet treatment and explicit origin text. Confirmation retains responsibility evidence; rejection addresses pending proposals.

Reload restores model-origin state from matching source declarations. Provider controls distinguish endpoint and model settings from memory-only API keys. Disabling assistance removes model surfaces while preserving deterministic work. [Specification](specification.md#llm-assistance-and-provenance) defines provenance and provider constraints.

## Browser capability disclosure

File input and Download provide the portable Chromium and Firefox workflow. A native writable handle enables in-place Save; otherwise Save uses validated Download. Folder and handle controls appear only where the capability exists. Missing capabilities and unavailable images are explained at the affected action while source editing remains accessible.

## Accessibility contract

- Tabs use tablist relationships and roving keyboard focus.
- The splitter exposes its separator role, value, orientation and keyboard controls.
- Reading and panel regions have visible focus and accessible names.
- Asynchronous status, loading, validation and failures use appropriate live regions.
- Popovers and dialogs return focus to their originating control or reading location.
- Actions remain reachable without hover; hover emphasis also appears on keyboard focus.
- Provenance, validation, review and annotations use text or pattern alongside colour.
- Body copy uses the darker body-text token; contrast and automated accessibility checks apply to the actual rendered views.
- Decorative motion respects `prefers-reduced-motion`.

## Label discipline

One command keeps one label across its control, tooltip, dialog and status. Source-derived terms remain consistent across pager, review and context panels. **AI-proposed, unverified**, **Output schema gate** and **XML-only** identify distinct provenance, authorization and editing states.
