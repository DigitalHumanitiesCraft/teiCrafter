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
updated: 2026-05-27
language: en
version: 0.3
topics: ["[[Information Visualisation]]", "[[Scholar-Centered Design]]", "[[Human-Computer Interaction]]"]
related: [project, specification, user-stories, architecture]
---

# teiCrafter Design System

Design philosophy, visual identity, token system and core UI components. Conceptually formulated; concrete classes, token values and pixel measures live in the code under `docs/css/` and `docs/js/`. The design is inherited and adapted from coOCR HTR, with token discipline taken from the zbz Hersch design system and editor-grade UI patterns from the SuGW edition frontend.

## Design Philosophy

The user is the expert operating a precision instrument. The AI assists; the human decides. This is not a slogan but the organising constraint: epistemic asymmetry means the tool must make machine output inspectable and never present plausibility as certainty. Every design element serves the expert-in-the-loop relationship.

The aesthetic is a scholarly research tool, not a consumer product. The leading principle is maximum information output: provenance, validation state and annotation structure are shown, not hidden to make the surface look clean. Density and clear hierarchy are both required, not played against each other.

## What This Document Does Not Cover

It does not fix exact hex values, spacing scales or class names; those are the single source of truth in the CSS token file. It does not specify the LLM prompt design (see specification) or the data formats (see data). It describes the Editor path and the Generator path together but, per the current focus, treats the Editor path workspace as primary.

## Visual Identity

Warm, paper-near editorial theme. Cream and warm-off-white surfaces evoke manuscript material and stay easy on the eyes for long editing sessions; pure white is avoided for text and facsimile surfaces. Serif typography carries long reading text (source text, regests), sans-serif carries UI and numbers, monospace marks technical identifiers and paths so they read as machine-legible. Avoids both sterile tech minimalism and decorative historicism.

## Token System

Colour, typography and spacing are defined once as CSS custom properties in a single token file (`--tc-*` namespace), never as raw hex in components. This follows the Hersch design-token model from zbz, where a named semantic palette is the single source of truth and component CSS only references tokens. Token families:

| Family | Purpose |
|--------|---------|
| Surfaces | Page background, panel surfaces, warm paper surface for text and facsimile, inverse |
| Text | Primary (dark warm brown), secondary, muted, inverse |
| Accent (interactive) | Primary action / link / active state; semantic, not decorative: an accent-coloured element is navigable or categorised |
| Confidence | Categorical, not numeric: confident (muted green), review (warm amber), problematic (terracotta) |
| AI-generated | A distinct violet family marking all LLM output (badges, reasoning blocks, section borders); used for nothing else, so machine output is always separable from deterministic results and user input |
| Annotation | Per entity type in the rendered text: person, place, organisation, dates; muted so they do not compete with reading |
| Region / zone | Facsimile bounding-box outlines and hover state for the Editor path zone overlay |

Status is triple-coded (colour plus icon plus position), never colour alone, so confidence survives colour-blindness and print.

## Layout

A three-pane workspace, the teiCrafter analogue of coOCR's triple synchronisation (there: viewer, transcription, validation):

```
Source editor  |  Preview / Facsimile  |  Validation + Review
```

- **Generator path:** Source editor, rendered preview, validation/review. A mapping panel configures the transformation rules.
- **Editor path (primary focus):** the middle pane carries the facsimile with zone overlay; authoring-view forms and the index panel open as task-specific surfaces over the source editor. The three panes stay synchronised: selecting text scrolls the facsimile zone and vice versa.

Filter and status bars stay persistent while content scrolls. Breadcrumb navigation returns to higher views.

## Core Components

| Component | Role | Lineage |
|-----------|------|---------|
| Source editor | CodeMirror 6 (or Monaco): XML syntax highlighting, code folding, schema-driven autocompletion restricted to module-defined elements, inline validation markers | teiCrafter |
| Preview | Rendered annotated text, annotation types and confidence categories colour-coded | coOCR |
| Validation panel | Aggregated schema errors, XPath-rule violations and plaintext deviations; each error clickable, jumps to the source location | coOCR |
| Review panel | LLM-as-a-judge comments (violet-marked) with accept / reject / correct actions, filterable by confidence and annotation type; never stands alone, always beside rule-based checks | coOCR |
| Facsimile pane | OpenSeadragon deep-zoom with zone overlay, pan, rotate, multi-page navigation, bidirectional text-facsimile navigation; images loaded from a IIIF manifest or METS image references | SuGW facsimile synopsis |
| Authoring-view form | Form-based surface per recurring annotation type (diplomatic transcription, image annotation, Bible-verse), configured by the project module | teiCrafter / Wenzelsbibel |
| Index panel | Person / place / project-specific indices as a separate data layer with cross-document lookup | teiCrafter |

## UI Conventions

- **Label consistency is a rule, not a freedom.** The same field or term carries the same label everywhere, including tooltips and help text; inconsistency is a bug. Whoever changes a label at one place checks all others. (SuGW.)
- **Tip system** with separated classes: a provenance tip on a value (dotted underline) naming source and operation, a glossary tip beside a technical term, a help tip for function explanation, and a lightweight hover hint on action buttons and column headers. (SuGW.)
- **Information-seeking pattern**: overview first, then zoom and filter, then details on demand, repeated consistently so a pattern learned on one surface transfers to others.
- **Internationalisation** DE/EN with runtime switching, as in coOCR and HerData; the Wenzelsbibel context is German, the tool is bilingual.
- **Print mode**: every detail surface has a sensible print state; navigation and panels hide, annotations render as fine underlines without colour fills, a citation line becomes visible.

## Confidence and Provenance Visualisation

Categorical confidence (confident / review / problematic) drives the colour of annotations and validation rows. AI-generated content always carries the violet marking. Provenance is shown, not hidden: where an annotation or value came from (rule-based, LLM, user) is inspectable. This is the visual expression of the epistemic-asymmetry stance from `project.md` and `specification.md`.

## Related

- [project](project.md) for the positioning the design serves
- [specification](specification.md) for the validation levels and project-module mechanism the UI exposes
- [user-stories](user-stories.md) for the scenarios that motivate the components
- [architecture](architecture.md) for how the panes and synchronisation are implemented
