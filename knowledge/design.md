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
updated: 2026-06-10
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
- The facsimile pane is a real OpenSeadragon deep-zoom viewer; hovering a line highlights its `<zone>` overlay and vice versa (real `@facs` link, or positional). When a document carries no page images at all, the pane auto-collapses to a two-pane layout (a permanently empty viewer is noise); a toolbar toggle shows or hides it for documents that have images.
- Page turning lives in the reading-pane header (previous / `page i/n` / next), where one expects it, plus ArrowLeft/ArrowRight; not in the global toolbar.
- The right pane carries two tabs: "Validation and structure" (live well-formedness, lossless-integrity, structure counts, and a note that full RelaxNG/Schematron is the offline harness) and "Index" (the editable `<standOff>` index of persons, places, organisations, works and events). The AI entity-suggest action sits at the top of the Index tab, where the entities live, labelled and explained, in the violet family.

Loading (decided by the operator, 2026-06-10): one "Open TEI..." button plus an examples dropdown with the three demo sources (Wenzelsbibel synthetic, ZBZ Jeanne Hersch with real scans, Stefan Zweig Digital o_szd.1079 with GAMS facsimile), and the violet "New from text (LLM)" entry. Before a document is loaded, the reading pane shows a start screen with the same three examples as cards plus the open button. The former toolbar mode toggles ("Add note", "Mark text") were removed: every cell operation is reachable through the inline action chooser (M2.6), so pre-toggled modes are no longer part of the surface.

The landing page (`index.html`) is two cards: open and edit existing TEI (gold), and New from text (LLM) (violet). The editor header carries a mode badge and a link back.

## Determinism vs AI, Visually

Violet appears exclusively on AI-origin content: the generated-and-unreviewed banner, the on-ramp's own controls, AI-proposed (unverified) index entries, and mentions of such entities in the reading text. Deterministic, human-driven work is shown in the neutral and gold families; no other token may sit in the violet hue range (which is why the organisation family moved to olive). AI mentions additionally carry a dashed outline, so machine origin never hangs on hue alone. This keeps the boundary between what the human did and what a model proposed visible at all times.

## UI Conventions

- **Label consistency is a rule, not a freedom.** The same field or term carries the same label everywhere; inconsistency is a bug.
- **Information-seeking pattern:** overview first, then zoom and filter, then details on demand.
- **No raw hex in components:** tokens only.

## Restructuring: Annotation Visibility and Unified Cell Actions (decided 2026-06-09, built 2026-06-10)

An agent-driven live review on the real SZD object found the central gap between this document's philosophy ("provenance and validation state shown, not hidden") and the built reading pane: annotations were invisible. Linked mentions carried no class (`.ed-w.mention` existed in `editor.css` but was never assigned by the renderer), the entity-type annotation tokens were unused in the editor, notes showed only a thin underline, and the editing flow hid behind three pre-toggled toolbar modes. Two workstreams were decided (goals.md M2.5 and M2.6) and are now built:

1. **Annotation visibility layer (M2.5).** Linked mentions render with the entity-type colour family and a tooltip naming the entity; notes get a triple-coded marker (colour, icon, position); the existing critical-markup styles stay; a legend strip in the reading-pane header names every visual code (overview first). Requires a read-only `cell.mention` projection in the engine model.
2. **Inline cell action chooser (M2.6).** Clicking a cell opens an in-place chooser (Edit / Note / unclear / del / add / gap / Link via entity picker / cancel) following the proven `.ed-crit-pick` pattern, so every operation is reachable at the text without pre-toggling a mode; the toolbar toggles remain as shortcuts, double-click is quick edit.

Both stay token-only and keep label consistency; the chooser must preserve the index-initiated link flow (an active link target still completes on the next text click, without the chooser).

As built (2026-06-10), three implementation decisions refine the concept: (1) the mention colour kind comes from the entity TYPE that `readEntities` reports, not from the id prefix, so hand-authored ids without a `pers_`/`plc_` prefix still colour correctly; (2) the temporary "show this entity's mentions" highlight moved to its own class (`.ed-w.mention-hit`, gold family) so clearing it never strips the permanent visibility classes; (3) a mention pointing at an AI-proposed, unverified entity renders in the violet AI family (and says so in its tooltip), keeping machine output separable in the reading text itself. Two token pairs were added for the remaining entity types: `--color-workName(-bg)` shares the bibl hue (a work is a bibliographic entity), `--color-eventName(-bg)` shares the date hue (an event is a datable occurrence); they are independent tokens so either family can diverge later. Double-click as quick edit works through the chooser: non-edit buttons ignore the second click of a double-click (`e.detail > 1`), the chooser box handles `dblclick`, and "edit" is focused so plain Enter also triggers it.

A six-lens adversarial review of the built state (2026-06-10) hardened the layer the same day: the legend is rebuilt per render from the codes actually present in the document (no violet chip in a purely human edition, a "missing entity" chip only when a dangling ref exists) and shares the reading-text CSS rules via `:is()` selectors, so a chip always shows exactly the code it names; the organisation family moved from a violet-adjacent hue to olive, restoring "violet exclusively for AI-origin"; AI mentions gained a dashed outline as a second, non-colour channel; the selection highlight became an outline so it can never be confused with the note underline; cancelling a chooser restores the clicked word in place instead of re-rendering (reading-pane scroll and facsimile zoom survive a look-and-cancel); and tooltips, legend and chooser buttons now use one human label per critical kind ("deleted", "added"), never the raw TEI localName. At the engine level, `linkMention` now finds the enclosing `<name>` with the same bounded ancestor walk the projection uses, so relinking a critically-wrapped mention retargets instead of nesting conflicting refs.

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
| Annotation visibility layer: mentions/notes/crit visible in the reading text, entity-type colours, legend (M2.5) | Built (2026-06-10) |
| Inline cell action chooser replacing hidden mode toggles (M2.6) | Built (2026-06-10) |
| Authoring-view forms for teiHeader and apparatus `<note>` bodies | Future |
| standOff critical-apparatus / note-body authoring layer | Future |

## Related

- [project](project.md) for the positioning the design serves
- [specification](specification.md) for the capabilities the UI exposes
- [user-stories](user-stories.md) for the scenarios behind the components
- [architecture](architecture.md) for how the panes are implemented
