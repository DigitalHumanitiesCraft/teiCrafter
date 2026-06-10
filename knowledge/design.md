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

A two-pane editor workspace since M2.11 (text and image; everything else is on demand):

```
Reading text (cells)  |  Facsimile (OpenSeadragon)
```

- **The text surface behaves like an editor, not a form (M2.10, "wie Oxygen").** A plain click only sets the cursor. Clicking an annotated element opens its annotation editor: what it is linked to, the entity's authority ids editable in place (add, remove, live GND/GeoNames/Wikidata lookup), its occurrence count with highlight-all, confirm for AI proposals, relink, remove link, open in the full index. Double-click edits the text directly. Right-click opens a context menu with everything else (annotate the selection, edit, note, mark). There is no click-summoned button menu on plain text.
- **Selecting words annotates them (M2.8), evidence first (M2.10).** The primary annotation gesture is the scholarly one: select the exact words ("KARL JASPERS" inside a prose line). The popover leads with suggestions that have evidence (an index entry with exactly this name; this exact text already annotated elsewhere), then existing entities grouped by provenance (annotated on this page / in this document / in the index but not yet linked, filterable when long). Creating a new index entity is a collapsed section, because not every selection is an entity ("manière" is not). A further section applies plain TEI markup without an index entry: persName (optionally structured into forename/surname), placeName, orgName, date, term, foreign, hi, title, or any element by name; the engine guard refuses any wrap that would lose reading text. After an entity annotation the annotation editor reopens on the fresh mention, so authority ids (GND, Wikidata, GeoNames) are attachable without leaving the text: the index logic lives where the annotating happens (M2.11, operator decision 2026-06-10).
- **The XML is always reachable (editable source view).** The toolbar "XML" toggle swaps the reading pane for the canonical raw string in a monospace editor; Apply is gated on well-formedness and re-parses the document, and the integrity chip reports any drift against the load baseline. The raw string is canonical anyway, so source editing is a first-class path, not a debug view.
- The facsimile pane is a real OpenSeadragon deep-zoom viewer; hovering a line highlights its `<zone>` overlay and vice versa (real `@facs` link, or positional). When a document carries no page images at all, the pane auto-collapses to a two-pane layout (a permanently empty viewer is noise); a toolbar toggle shows or hides it for documents that have images.
- Page turning lives in the reading-pane header (previous / `page i/n` / next), where one expects it, plus ArrowLeft/ArrowRight; not in the global toolbar.
- **The index is an on-demand overlay, not a pane (M2.11).** A permanent entity list does not scale past a handful of entries, so the toolbar "Index" button opens a filterable overlay over the text: all `<standOff>` entities (persons, places, organisations, works, events) with mention-count badges, add/rename/delete, and the full authority forms; clicking an entry jumps to its first in-text mention. Day-to-day authority work does not need it, because it lives in the annotation popovers. The AI entity-suggest action was removed from the UI entirely (operator decision 2026-06-10, "vorerst rausnehmen"); the `ai-suggest.js` module remains for a later, text-anchored re-entry.
- **Help is tooltip-only.** No explainer banner, no ambient hint lines; every control explains itself in its `title`. The one banner that remains is the generated-and-unreviewed provenance warning (violet), which is state, not help.
- The live checks (well-formedness, lossless integrity, structure counts) run automatically and surface as a status chip in the footer (triple-coded ok/warning/error) with the detail rows in a click popover; full RelaxNG/Schematron stays in the offline harness. Validation is ambient state, not a destination pane.

Loading (decided by the operator, 2026-06-10): one "Open TEI..." button plus an examples dropdown with the three demo sources (Wenzelsbibel synthetic, ZBZ Jeanne Hersch with real scans, Stefan Zweig Digital o_szd.1079 with GAMS facsimile), and the violet "New from text (LLM)" entry. Before a document is loaded, the reading pane shows a start screen with the same three examples as cards plus the open button. The former toolbar mode toggles ("Add note", "Mark text") were removed: every cell operation is reachable through the right-click context menu and the direct gestures (M2.10), so pre-toggled modes are no longer part of the surface.

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

Both stay token-only and keep label consistency; the chooser must preserve the index-initiated link flow (an active link target still completes on the next text click, without the chooser). (Superseded the same day: M2.10 replaced the click-chooser with the editor paradigm, and M2.11 retired the index-initiated link flow together with the index pane; selection-initiated linking covers it.)

As built (2026-06-10), three implementation decisions refine the concept: (1) the mention colour kind comes from the entity TYPE that `readEntities` reports, not from the id prefix, so hand-authored ids without a `pers_`/`plc_` prefix still colour correctly; (2) the temporary "show this entity's mentions" highlight moved to its own class (`.ed-w.mention-hit`, gold family) so clearing it never strips the permanent visibility classes; (3) a mention pointing at an AI-proposed, unverified entity renders in the violet AI family (and says so in its tooltip), keeping machine output separable in the reading text itself. Two token pairs were added for the remaining entity types: `--color-workName(-bg)` shares the bibl hue (a work is a bibliographic entity), `--color-eventName(-bg)` shares the date hue (an event is a datable occurrence); they are independent tokens so either family can diverge later. Double-click as quick edit works through the chooser: non-edit buttons ignore the second click of a double-click (`e.detail > 1`), the chooser box handles `dblclick`, and "edit" is focused so plain Enter also triggers it.

A six-lens adversarial review of the built state (2026-06-10) hardened the layer the same day: the legend is rebuilt per render from the codes actually present in the document (no violet chip in a purely human edition, a "missing entity" chip only when a dangling ref exists) and shares the reading-text CSS rules via `:is()` selectors, so a chip always shows exactly the code it names; the organisation family moved from a violet-adjacent hue to olive, restoring "violet exclusively for AI-origin"; AI mentions gained a dashed outline as a second, non-colour channel; the selection highlight became an outline so it can never be confused with the note underline; cancelling a chooser restores the clicked word in place instead of re-rendering (reading-pane scroll and facsimile zoom survive a look-and-cancel); and tooltips, legend and chooser buttons now use one human label per critical kind ("deleted", "added"), never the raw TEI localName. At the engine level, `linkMention` now finds the enclosing `<name>` with the same bounded ancestor walk the projection uses, so relinking a critically-wrapped mention retargets instead of nesting conflicting refs.

## Components Present vs Future

| Component | Status |
|-----------|--------|
| Reading-text pane with inline cell edit | Built |
| Facsimile pane: real images, deep zoom (OpenSeadragon 5.0.1), `<zone>` overlays bidirectionally linked to the reading text; auto-collapsed without images, toggleable | Built |
| Live checks as a footer status chip with detail popover (formerly a right-pane tab) | Built (2026-06-10) |
| Selection annotation: select words in a line, annotate as a new or existing entity, lossless sub-range wrap (M2.8) | Built (2026-06-10) |
| Loading surface: Open TEI, examples dropdown (Wenzelsbibel / ZBZ / SZD), start screen with example cards | Built (2026-06-10) |
| Editor paradigm: cursor click, click-to-edit on annotated elements, double-click direct edit, right-click context menu (M2.10) | Built (2026-06-10) |
| Evidence-first annotate popover with provenance groups, filter, and plain-TEI markup wraps incl. structured persName | Built (2026-06-10) |
| Editable XML source view, well-formedness-gated Apply | Built (2026-06-10) |
| LLM on-ramp modal (violet) | Built |
| Index overlay (M2.11): on-demand, filterable `<standOff>` index with mention counts; row click jumps to the first mention | Built (2026-06-10) |
| Annotation editor with in-place authority editing (idno add/remove + live lookup at the mention itself, M2.11) | Built (2026-06-10) |
| Authority lookup (M3.3): hand-entry plus live external lookup of authority records | Built |
| AI entity suggestion (M3.7) | Removed from the UI (operator decision 2026-06-10); `ai-suggest.js` retained for a text-anchored re-entry |
| Note creation (M3.5): adding `<note>` annotations to the document | Built |
| Textual-critical markup (M3.6): a Mark-text mode wraps a line in `<unclear>`/`<del>`/`<add>` or marks a `<gap>`, in the editorial colour families (dotted gold / struck red / underlined blue / muted gap), never violet | Built |
| Annotation visibility layer: mentions/notes/crit visible in the reading text, entity-type colours, legend (M2.5) | Built (2026-06-10) |
| Inline cell action chooser replacing hidden mode toggles (M2.6) | Superseded by the M2.10 editor paradigm (context menu + gestures) |
| Authoring-view forms for teiHeader and apparatus `<note>` bodies | Future |
| standOff critical-apparatus / note-body authoring layer | Future |
| teiCrafter-internal storage for edited TEIs (operator announcement 2026-06-10; design open) | Future (M2.9) |

## Related

- [project](project.md) for the positioning the design serves
- [specification](specification.md) for the capabilities the UI exposes
- [user-stories](user-stories.md) for the scenarios behind the components
- [architecture](architecture.md) for how the panes are implemented
