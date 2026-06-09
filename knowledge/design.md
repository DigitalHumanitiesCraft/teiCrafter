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
updated: 2026-06-09
language: en
version: 0.9
topics: ["[[Information Visualisation]]", "[[Scholar-Centered Design]]", "[[Human-Computer Interaction]]"]
related: [project, specification, user-stories, architecture]
---

# teiCrafter Design System

Design philosophy, visual identity, tokens and components. Conceptually formulated here; the exact token values, class names and pixel measures are the single source of truth in `docs/css/`. Inherited and adapted from coOCR HTR, with token discipline from the zbz Hersch design system.

## Design Philosophy

The user is the expert operating a precision instrument. Editing is deterministic and human-driven; the tool changes nothing the human did not type. Where a model contributes (the LLM on-ramp), its output is made inspectable and marked as machine-generated, never presented as certainty. This is the expert-in-the-loop, epistemic-asymmetry stance.

The aesthetic is a scholarly research tool, not a consumer product: warm, paper-near surfaces; density with clear hierarchy; provenance and validation state shown, not hidden.

## What This Document Does Not Cover

It does not fix exact hex values, spacing scales or class names (those live in the CSS). It does not specify the LLM prompt (see specification) or the data formats (see data).

## Visual Identity

Cream and warm-off-white surfaces evoke manuscript material and ease long sessions; pure white is avoided for reading and facsimile surfaces. Serif carries the reading text, sans-serif the UI and numbers, monospace technical identifiers and paths. A navy header, gold as the primary accent.

## Token System

Colour, typography and spacing are defined once as CSS custom properties in `docs/css/style.css`, never as raw hex in components. The editor-specific stylesheet `docs/css/editor.css` consumes these tokens and adds no raw hex of its own. The live prefix is **`--color-*`, `--space-*`, `--font-*`, `--radius-*`** (an earlier draft of this document said `--tc-*`; the code is authoritative and uses `--color-*`). Token families:

| Family | Tokens (examples) | Purpose |
|--------|-------------------|---------|
| Surfaces | `--color-surface`, `--color-panel`, `--color-secondary` | Page, panels, warm paper for text and facsimile |
| Header / accent | `--color-header` (navy), `--color-gold`, `--color-gold-hover` | Header, primary action, active state |
| Text | `--color-text`, `--color-text-secondary`, `--color-text-muted`, `--color-text-inverse` | Reading and UI text |
| Confidence | `--color-confident`, `--color-review`, `--color-problem` (+ `-tint`) | Categorical validation states, never numeric |
| AI-generated | `--color-ai`, `--color-ai-tint` (violet) | Marks LLM on-ramp output and nothing else, so machine output is always separable |
| Annotation | `--color-persName`, `--color-placeName`, `--color-orgName`, ... | Per entity type in rendered text, muted |
| Zone | `--color-blue`, `--color-gold-light` | Facsimile zone outline and link highlight |

Status is triple-coded (colour plus icon plus position), never colour alone, so it survives colour-blindness and print.

## Layout

A three-pane editor workspace:

```
Reading text (cells)  |  Facsimile (OpenSeadragon)  |  Validation and structure / Index
```

- Click a cell to edit it inline; the input matches the reading typography.
- The facsimile pane is a real OpenSeadragon deep-zoom viewer; hovering a line highlights its `<zone>` overlay and vice versa (real `@facs` link, or positional).
- The right pane carries two tabs: "Validation and structure" (live well-formedness, lossless-integrity, structure counts, and a note that full RelaxNG/Schematron is the offline harness) and "Index" (the editable `<standOff>` index of persons, places, organisations, works and events).

The landing page (`index.html`) is two cards: open and edit existing TEI (gold), and New from text (LLM) (violet). The editor header carries a mode badge and a link back.

## Determinism vs AI, Visually

The editor itself uses no violet: deterministic, human-driven work is shown in the neutral and gold families. The moment a document comes from the LLM on-ramp, a violet banner marks it as generated and unreviewed, and the on-ramp's own controls use the violet accent. This keeps the boundary between what the human did and what a model proposed visible at all times.

## UI Conventions

- **Label consistency is a rule, not a freedom.** The same field or term carries the same label everywhere; inconsistency is a bug.
- **Information-seeking pattern:** overview first, then zoom and filter, then details on demand.
- **No raw hex in components:** tokens only.

## Planned Restructuring: Annotation Visibility and Unified Cell Actions (operator decision 2026-06-09)

An agent-driven live review on the real SZD object found the central gap between this document's philosophy ("provenance and validation state shown, not hidden") and the built reading pane: annotations are invisible. Linked mentions carry no class (`.ed-w.mention` exists in `editor.css` but is never assigned by the renderer), the entity-type annotation tokens are unused in the editor, notes show only a thin underline, and the editing flow hides behind three pre-toggled toolbar modes. Two workstreams are decided (goals.md M2.5 and M2.6):

1. **Annotation visibility layer (M2.5).** Linked mentions render with the entity-type colour family and a tooltip naming the entity; notes get a triple-coded marker (colour, icon, position); the existing critical-markup styles stay; a legend strip in the reading-pane header names every visual code (overview first). Requires a read-only `cell.mention` projection in the engine model.
2. **Inline cell action chooser (M2.6).** Clicking a cell opens an in-place chooser (Edit / Note / unclear / del / add / gap / Link via entity picker / cancel) following the proven `.ed-crit-pick` pattern, so every operation is reachable at the text without pre-toggling a mode; the toolbar toggles remain as shortcuts, double-click is quick edit.

Both stay token-only and keep label consistency; the chooser must preserve the index-initiated link flow (an active link target still completes on the next text click, without the chooser).

## Components Present vs Future

| Component | Status |
|-----------|--------|
| Reading-text pane with inline cell edit | Built |
| Facsimile pane: real images, deep zoom (OpenSeadragon 5.0.1), `<zone>` overlays bidirectionally linked to the reading text | Built |
| Validation/structure pane (browser-light) | Built |
| LLM on-ramp modal (violet) | Built |
| Index panel: editable `<standOff>` index of persons, places, organisations, works and events (add, rename, delete) with in-text `<name ref>` linking | Built |
| Authority lookup (M3.3): hand-entry plus live external lookup of authority records for index entries | Built |
| Note creation (M3.5): adding `<note>` annotations to the document | Built |
| Textual-critical markup (M3.6): a Mark-text mode wraps a line in `<unclear>`/`<del>`/`<add>` or marks a `<gap>`, in the editorial colour families (dotted gold / struck red / underlined blue / muted gap), never violet | Built |
| Annotation visibility layer: mentions/notes/crit visible in the reading text, entity-type colours, legend (M2.5) | Planned (decided 2026-06-09) |
| Inline cell action chooser replacing hidden mode toggles (M2.6) | Planned (decided 2026-06-09) |
| Authoring-view forms for teiHeader and apparatus `<note>` bodies | Future |
| standOff critical-apparatus / note-body authoring layer | Future |

## Related

- [project](project.md) for the positioning the design serves
- [specification](specification.md) for the capabilities the UI exposes
- [user-stories](user-stories.md) for the scenarios behind the components
- [architecture](architecture.md) for how the panes are implemented
