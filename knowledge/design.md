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
updated: 2026-05-30
language: en
version: 0.4
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

Colour, typography and spacing are defined once as CSS custom properties in `docs/css/style.css`, never as raw hex in components. The live prefix is **`--color-*`, `--space-*`, `--font-*`, `--radius-*`** (an earlier draft of this document said `--tc-*`; the code is authoritative and uses `--color-*`). Token families:

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
Reading text (cells)  |  Facsimile (zones)  |  Validation + structure
```

- Click a cell to edit it inline; the input matches the reading typography.
- Hovering a line highlights its facsimile zone and vice versa (real `@facs` link, or positional).
- The validation pane shows live well-formedness, lossless-integrity, structure counts, and a note that full RelaxNG/Schematron is the offline harness.

The landing page (`index.html`) is two cards: open and edit existing TEI (gold), and New from text (LLM) (violet). The editor header carries a mode badge and a link back.

## Determinism vs AI, Visually

The editor itself uses no violet: deterministic, human-driven work is shown in the neutral and gold families. The moment a document comes from the LLM on-ramp, a violet banner marks it as generated and unreviewed, and the on-ramp's own controls use the violet accent. This keeps the boundary between what the human did and what a model proposed visible at all times.

## UI Conventions

- **Label consistency is a rule, not a freedom.** The same field or term carries the same label everywhere; inconsistency is a bug.
- **Information-seeking pattern:** overview first, then zoom and filter, then details on demand.
- **No raw hex in components:** tokens only.

## Components Present vs Future

| Component | Status |
|-----------|--------|
| Reading-text pane with inline cell edit | Built |
| Facsimile pane (placeholder + real zones, bidirectional link) | Built |
| Validation/structure pane (browser-light) | Built |
| LLM on-ramp modal (violet) | Built |
| Facsimile with real images, deep zoom (OpenSeadragon) | Future |
| StandOff apparatus surface; index panel; authoring-view forms | Future |
| CodeMirror source view | Future |

## Related

- [project](project.md) for the positioning the design serves
- [specification](specification.md) for the capabilities the UI exposes
- [user-stories](user-stories.md) for the scenarios behind the components
- [architecture](architecture.md) for how the panes are implemented
