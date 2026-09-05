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
status: active
created: 2026-05-27
updated: 2026-08-24
language: en
topics: ["[[Information Visualisation]]", "[[Scholar-Centered Design]]", "[[Human-Computer Interaction]]"]
related: [project, specification, architecture]
---

# teiCrafter Design System

## Design position

teiCrafter presents source-backed editorial actions and keeps structural risk visible. The interface adapts to the loaded TEI without pretending to know its scholarly genre from a filename. Project policy can refine that interpretation. Every destructive or output-sensitive action names its scope and explains a refusal.

The human editor remains the decision maker. Deterministic transformations use ordinary interface colours. Machine-origin content carries persistent TEI provenance and a distinct violet treatment until a human resolves it. Review state is explicit scholarly evidence and has its own control, separate from annotation coverage.

## Visual identity and tokens

The wordmark `<teiCrafter>` combines the TEI blue and yellow brand family. TEI yellow is the primary action colour, with dark text for contrast. TEI blue marks source and annotation interactions. Violet is reserved for model-origin content.

All components consume CSS custom properties from the shared token system. Component styles introduce no raw colour values.

| Family | Tokens | Meaning |
| --- | --- | --- |
| Surface | `--color-surface`, `--color-surface-sunken`, `--color-panel`, `--color-secondary` | Document, pane, band, and control backgrounds |
| Brand and action | `--color-header`, `--color-gold`, `--color-gold-hover`, `--color-link` | Site identity, primary actions, focus, and accessible links |
| Text | `--color-text`, `--color-text-body`, `--color-text-secondary`, `--color-text-muted`, `--color-text-inverse` | Reading text and information hierarchy |
| State | `--color-confident`, `--color-review`, `--color-problem` with tint partners | Categorical success, review, warning, and failure |
| Model provenance | `--color-ai`, `--color-ai-tint` | Generated or proposed content awaiting human review |
| Annotation | Entity-specific foreground and background tokens | Human and confirmed semantic layers |
| Geometry | `--space-*`, `--radius-*`, `--shadow-*` | Rhythm, grouping, focus, and elevation |
| Type | `--font-ui`, `--font-mono`, `--font-serif` | Controls, XML or identifiers, and public narrative text |

Status uses categories and words. Numeric confidence is absent because the application has no calibrated confidence producer. Colour always has a second channel through labels, icons, borders, underlines, or patterns.

## Editor frame

The populated editor has two panes. The left pane holds Reading text, XML source, and Metadata. The right pane is a registry of context panels such as Facsimile, Index, Source, and project-specific additions. A keyboard-operable splitter resizes or collapses the context pane, and a narrow layout stacks both panes vertically.

Document identity sits below the toolbar and reports the loaded name, provenance, project, type, source model, and save target. The site header retains site identity. The empty editor uses the same frame with a direct load prompt, recent file handles where available, and draft recovery when present.

The toolbar groups file actions. Save is the primary gold action because it commits the current scholarly state to the chosen target. Download creates a copy and uses neutral styling. View and context switching remain in their pane headers. A document replacement asks before discarding unsaved work.

Pane-header controls wrap as a complete secondary row when the current pane cannot hold the view tabs and document controls side by side. This rule follows the resizable pane width rather than assuming that the browser viewport predicts the available editor width, and it keeps every tab free from pointer overlap across supported font metrics.

## Source Profile disclosure

The Source context panel explains how the interface interpreted the loaded TEI. It shows detected structures, the primary navigation channel, other available channels, authoring scope, and resolution issues. The wording states that the model derives from TEI structures and that a manifest can select another channel only when matching units exist.

The pager uses the primary channel's labels and source identifiers. Generic terms such as document or unit appear where a more specific term would claim unsupported knowledge. Page language is reserved for real page navigation. Entry, speech turn, record, row, section, surface, corpus member, and source document labels follow their actual anchors.

A manifest override that cannot be satisfied stays visible as an issue. The editor continues with a safe source-backed channel. Ambiguity is disclosed in the same place, which lets an editor judge whether the chosen projection fits the source.

## Reading surface

A plain click positions the cursor. Double-click opens exact text or dual-reading editing. A click on an existing annotation opens its layer or mention editor. Right-click and text selection expose scholarly actions. The selection remains visibly painted while a popover holds focus.

Local cell structure controls the available edit. Tokens expose token text and encoded reading attributes. Other nodes expose exact text runs. The interface does not apply a document-wide word or line label when both forms coexist.

Annotation visibility comes from actual projected layers. Entity types use muted categorical colours. Nested or overlapping layers receive a stacked underline and an inspector that lists every layer. Missing pointers and model provenance use explicit text in tooltips and status messages.

### Cross-structure and discontinuous selection

The selection popover offers `add another segment`. Activating it keeps the current range, returns focus to the reading surface, and asks for another range in the same or another primary navigation unit. Collected text is presented as separated segments before the editor chooses an entity or creates one.

The collector refuses overlapping collected ranges. A selection that crosses structure or overlaps an existing mention routes to the stand-off representation. Every projected segment remains clickable and identifies the shared annotation. Relink changes the complete group. Remove deletes the group while retaining its text.

When the selected output contract is inline-GND, the popover explains that cross-structure, discontinuous, and overlapping annotations cannot be represented and blocks the action. This message appears before an editor can mistake an unavailable serialization for a successful annotation.

## Metadata and exact XML

Metadata opens a complete inventory of the current TEI header. Common fields retain their familiar group headings and labels. Every other TEI header element and attribute remains visible through a generated label and path.

An editable input means that teiCrafter has a lossless inverse for the value. Text-only paired elements and ordinary attributes receive direct controls. Mixed or structured elements, self-closing elements, containers, and namespace declarations show an XML-only state. `Edit XML` opens the complete exact header without reducing it to the form projection.

The form does not create an impression of completeness through omission. Unknown project fields appear alongside common fields. An unchanged form produces no source mutation, so entity spelling and lexical details survive a simple inspection.

XML source stages the current primary navigation range where a safe boundary exists. The complete document appears when no narrower channel can be represented. Check and Apply always evaluate the complete substituted document. Find, replace, line navigation, indentation assistance, context completion, and keyboard Apply support source work. Reformatting remains absent because it would rewrite unrelated bytes.

## Review and progress

Markup coverage reports where semantic markup exists. Review reports which primary navigation units carry a TEI Review Record. Both controls remain visually and semantically separate.

The review control marks or reopens the current primary unit. A successful action writes or removes a targeted `revisionDesc/change` and updates the summary. If the header or revision history cannot accept a lossless record, the control leaves the document unchanged and reports the exact reason.

Review defaults are visible through the persisted XML. The current compact control does not expose a full reviewer-details form. Projects that require named editorial roles should provide the responsibility pointer through their workflow until that form exists.

## Output schema gate

The validation popover contains a section named `Output schema gate`. It identifies whether the effective schema came from the repository default, project manifest, or session override. Results appear in configured order with schema names, categorical validity, diagnostics, and factual runtime notes.

Save and Download can start validation. While it runs, the output action announces progress. Invalid, unavailable, empty, or stale results use the problem family and state that output is blocked. A changed revision invalidates the success state immediately. The interface never presents an earlier green result as authority for later bytes.

RelaxNG and XSD dependency limits and raw Schematron subset limits appear beside the affected set. A missing include or unsupported Schematron construct is described as unavailable. The user receives a concrete next action, such as supplying a resolvable dependency or compiled XSLT.

## Model assistance

Violet appears only for model-origin content. A generated-document banner, proposal layers, proposed notes, and model actions use the same family. Dashed outlines and the canonical label `AI-proposed, unverified` make provenance perceptible without colour.

Whole-document provenance is read from TEI after reload. A matching root `@resp` and header `respStmt` restore the generated banner. A transient generation flag alone has no lasting authority. Confirm removes proposal responsibility from a construct. Reject removes the proposal. Unused responsibility metadata created for the proposal session can then be cleaned up.

Provider choice supports built-in services, a configurable OpenAI-compatible endpoint, and adapters registered by trusted application code. Endpoint and model fields explain which values are stored. API-key fields state their memory-only lifetime. Disabling LLM assistance removes model surfaces while leaving deterministic editing intact.

## Browser capability disclosure

Open and Download form the portable workflow in Chromium and Firefox. Save uses an existing writable native handle when available. Without one, Save follows the schema-gated download path. Project-folder, recent-handle, and local-image actions appear only when the browser exposes the required capability.

Capability absence is explained at the action point. XML, metadata, reading text, review, and download remain available in Firefox. This prevents a Chromium-only enhancement from becoming an implied product requirement.

## Accessibility contract

- Tabs use proper tablist relationships and roving keyboard focus.
- The splitter exposes separator role, value, orientation, and keyboard control.
- Reading and panel regions have visible focus and accessible names.
- Status, loading, validation, and failure messages use live regions where state changes asynchronously.
- Popovers and dialogs return focus to the originating control or reading location.
- Every action is reachable without hover, and hover-only emphasis also appears on keyboard focus.
- Model provenance, validation, review, and annotation state use text or pattern in addition to colour.
- Body and paragraph copy use the darker body token that meets the serious and critical automated accessibility gate on the real UFBAS workflow in Chromium and Firefox.
- Motion respects `prefers-reduced-motion` where animation is decorative.

## Label discipline

One command keeps one label across toolbar, tooltip, dialog, and status text. Terms derived from a Source Profile remain consistent across pager, review, source scope, and context panels. `AI-proposed, unverified` names unresolved model output. `Output schema gate` names the authorization boundary. `XML-only` names metadata that requires exact source editing.
