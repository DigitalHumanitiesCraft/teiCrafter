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

Cream and warm-off-white surfaces evoke manuscript material and ease long sessions; pure white is avoided for reading and facsimile surfaces. Serif carries the reading text, sans-serif the UI and numbers, monospace technical identifiers and paths.

The accent palette is the TEI brand itself (operator order 2026-06-10): TEI blue `#0059A8` for the header and the blue family, TEI yellow `#F7A824` as the primary accent (`--color-gold`), near-black text. The wordmark is `<teiCrafter>`, an element tag with the angle brackets and "Crafter" in TEI yellow, echoing the TEI logo's yellow brackets. Two legibility rules came with the brand yellow: the primary button is black on yellow (the contrast pair of the TEI logo itself, not white on yellow), and the bright brand yellow is a fill/border colour only; small text accents on white use the darker derived `--color-gold-hover`.

## Token System

Colour, typography and spacing are defined once as CSS custom properties in `docs/css/style.css`, never as raw hex in components. The editor-specific stylesheet `docs/css/editor.css` consumes these tokens and adds no raw hex of its own. The live prefix is **`--color-*`, `--space-*`, `--font-*`, `--radius-*`** (an earlier draft of this document said `--tc-*`; the code is authoritative and uses `--color-*`). Token families:

| Family | Tokens (examples) | Purpose |
|--------|-------------------|---------|
| Surfaces | `--color-surface`, `--color-panel`, `--color-secondary` | Page, panels, warm paper for text and facsimile |
| Header / accent | `--color-header` (TEI blue), `--color-gold` (TEI yellow), `--color-gold-hover` | Header, primary action, active state |
| Text | `--color-text`, `--color-text-secondary`, `--color-text-muted`, `--color-text-inverse` | Reading and UI text |
| Confidence | `--color-confident`, `--color-review`, `--color-problem` (+ `-tint`) | Categorical validation states, never numeric |
| AI-generated | `--color-ai`, `--color-ai-tint` (violet) | Marks LLM on-ramp output and nothing else, so machine output is always separable |
| Annotation | `--color-persName`, `--color-placeName`, `--color-orgName`, ... | Per entity type in rendered text, muted |
| Zone | `--color-blue`, `--color-gold-light` | Facsimile zone outline and link highlight |

Status is triple-coded (colour plus icon plus position), never colour alone, so it survives colour-blindness and print.

## Layout

The dual view (M2.14, operator order 2026-06-10): two panes, always.

```
Text surface (tabs: Reading text | XML source)  |  Context panel (tabs: Facsimile | Index | ...)
```

The left pane is always the text work surface; view tabs in its head switch between the diplomatic reading text and the editable XML source. The right pane is always a context view; panel tabs in its head switch between the facsimile and the entity index, and the registry behind them is open for project-specific panels (`project.panels`). There is no single-pane mode: the XML source works next to the page image (explicit operator requirement), and a document without page images opens on the Index panel with the Facsimile tab disabled and the reason in its tooltip (a permanently empty viewer is noise; a disabled tab that says why is information).

- **The text surface behaves like an editor, not a form (M2.10, "wie Oxygen").** A plain click only sets the cursor. Clicking an annotated element opens its annotation editor: what it is linked to, the entity's authority ids editable in place (add, remove, live GND/GeoNames/Wikidata lookup), its occurrence count with highlight-all, confirm for AI proposals, relink, remove link, open in the full index. Double-click edits the text directly. Right-click opens a context menu with everything else (annotate the selection, edit, note, mark). There is no click-summoned button menu on plain text.
- **Selecting words annotates them (M2.8), evidence first (M2.10).** The primary annotation gesture is the scholarly one: select the exact words ("KARL JASPERS" inside a prose line). The popover leads with suggestions that have evidence (an index entry with exactly this name; this exact text already annotated elsewhere), then existing entities grouped by provenance (annotated on this page / in this document / in the index but not yet linked, filterable when long). Creating a new index entity is a collapsed section, because not every selection is an entity ("manière" is not). A further section applies plain TEI markup without an index entry: persName (optionally structured into forename/surname), placeName, orgName, date, term, foreign, hi, title, or any element by name; the engine guard refuses any wrap that would lose reading text. After an entity annotation the annotation editor reopens on the fresh mention, so authority ids (GND, Wikidata, GeoNames) are attachable without leaving the text: the index logic lives where the annotating happens (M2.11, operator decision 2026-06-10).
- **The XML is always reachable (editable source view).** The "XML source" view tab swaps the left pane to the canonical raw string in a real source editor (M2.12): syntax highlighting in the deterministic token families (violet stays AI-only), line numbers, an explicit "Check XML" that reports well-formedness inline and jumps the caret to the error position, and Apply gated on well-formedness with the integrity chip reporting drift against the load baseline. The raw string is canonical anyway, so source editing is a first-class path, not a debug view. The legend strip hides with the reading text, and the editor surface is height-constrained so long documents scroll inside the pane, never the page.
- The facsimile panel is a real OpenSeadragon deep-zoom viewer; hovering a line highlights its `<zone>` overlay and vice versa (real `@facs` link, or positional).
- Page turning lives in the left pane head (previous / `page i/n` / next), where one expects it, plus ArrowLeft/ArrowRight; not in the global toolbar.
- **The index is a context panel, not a modal (M2.11 overlay, right pane since M2.14).** The Index panel tab shows all `<standOff>` entities (persons, places, organisations, works, events), filterable, with mention-count badges, add/rename/delete, and the full authority forms; clicking an entry jumps to its first in-text mention while the index stays visible. Day-to-day authority work does not need it, because it lives in the annotation popovers. The AI entity-suggest action was removed from the UI entirely (operator decision 2026-06-10, "vorerst rausnehmen"); the `ai-suggest.js` module remains for a later, text-anchored re-entry.
- **Help is tooltip-only.** No explainer banner, no ambient hint lines; every control explains itself in its `title`. The one banner that remains is the generated-and-unreviewed provenance warning (violet), which is state, not help.
- The live checks (well-formedness, lossless integrity, structure counts) run automatically and surface as a status chip in the left pane head, next to where the work happens (moved out of the footer on operator feedback, round 7), triple-coded ok/warning/error, with the detail rows in a click popover anchored under the chip. The chip's tooltip defines its terms (well-formed: the XML parses; lossless: saving now reproduces the opened file byte for byte apart from the user's own edits). Full RelaxNG/Schematron stays in the offline harness. Validation is ambient state, not a destination pane.

**Loading and the welcome state (reworked on operator feedback, 2026-06-10 evening; supersedes the in-pane start screen and the examples select from the same morning).** Before a document is loaded the editor shows a full-width welcome surface and no editor chrome at all: no pane heads, no pager, no legend, no facsimile strip, and no document toolbar group (a start state must not carry dead controls; the earlier screen had a gold disabled Download as the page's strongest element). The welcome surface carries the visual identity from the first screen on (warm reading surface, serif headline) and offers every way in: a one-sentence value proposition ("Edit any TEI edition, losslessly."), the gold primary "Open TEI..." button, drag-and-drop of an .xml file anywhere on the page (full-page drop indicator; a dropped file yields a FileSystemFileHandle where the browser supports it, so save-in-place works for dropped files too), a Recent-files list (persisted File System Access handles via `recent-files.js`, reopening re-requests permission inside the click), and the three example cards with one uniform metadata schema (description line, then granularity and image source in mono; internal file names like o_szd.1079 live in the tooltip, not on the card). The violet "New from text (LLM)" card exists in the markup but is hidden while `FEATURES.llmOnRamp` is off (2026-06-10).

Toolbar discipline follows from the same round, sharpened by round 7 (operator: "das Laden ein Dropdown") and round 8 (M2.14): loading is ONE entry, a "Load..." button menu carrying "Open TEI..." plus the three examples behind a separator (a real menu, not a select-as-action); the violet LLM entry next to it is hidden while the on-ramp flag is off; the document group (Save, Download) is hidden, not disabled, until a document is loaded. View and panel switching does NOT live in the toolbar: it lives as tabs in the pane heads, where the content is (the former Facsimile/Index/XML toolbar buttons are gone). Save is the gold primary action (save-in-place is the lossless core gesture); Download is a neutral copy action; a disabled button never carries the primary accent. Labels are unified to one term per command ("Open TEI..." everywhere). Any in-app document replacement (open, example, drop, recent) asks before discarding unsaved changes. The former toolbar mode toggles ("Add note", "Mark text") stay removed (M2.10).

**Identity surfaces (round 7).** An About page (`about.html`) states what the tool is, defines lossless in one paragraph, names the maker and links the official imprint; it is linked from every header (right side) and footer. The footer is an identity strip, not a status bar: DHCraft logo plus "Digital Humanities Craft" (linking dhcraft.org), About, Imprint, and a GitHub icon at the right; the status line appears only while it has something to report (an action's outcome: loaded, saved, failed) and is hidden when empty.

The landing page (`index.html`) is one centered card, open and edit existing TEI (gold); the violet New from text (LLM) card returns with the on-ramp flag. The editor header's logo leads back to it; the separate Home button and the "EDITOR" mode badge were removed in the welcome round (the logo is the home link, and a badge naming the only mode carries no information). The header shows the document name only while a document is loaded.

## Determinism vs AI, Visually

Violet appears exclusively on AI-origin content: the generated-and-unreviewed banner, the on-ramp's own controls, AI-proposed (unverified) index entries, and mentions of such entities in the reading text. Deterministic, human-driven work is shown in the neutral and gold families; no other token may sit in the violet hue range (which is why the organisation family moved to olive). AI mentions additionally carry a dashed outline, so machine origin never hangs on hue alone. This keeps the boundary between what the human did and what a model proposed visible at all times.

## UI Conventions

- **Label consistency is a rule, not a freedom.** The same field or term carries the same label everywhere; inconsistency is a bug.
- **Information-seeking pattern:** overview first, then zoom and filter, then details on demand.
- **No raw hex in components:** tokens only.
- **Keyboard focus is always visible.** Every interactive control has a `:focus-visible` outline (gold; violet on AI-origin controls), the keyboard counterpart of the triple-coding stance: state never hangs on hover alone.
- **Disabled controls are quiet.** A disabled button never carries the primary accent, and chrome that cannot be used yet is hidden rather than shown disabled.

## Annotation Visibility Layer (M2.5)

Everything annotated is visible in the reading text; provenance and validation state are shown, not hidden. The binding rules of the layer (how M2.5 came about, including the adversarial review that hardened it, is in the [journal](journal.md), 2026-06-09/10):

- Linked mentions render in the entity-type colour family with a tooltip naming the entity; the colour kind comes from the entity TYPE that `readEntities` reports, not from the id prefix, so hand-authored ids without a `pers_`/`plc_` prefix still colour correctly.
- A mention of an AI-proposed, unverified entity renders in the violet AI family with a dashed outline as a second, non-colour channel (and says so in its tooltip), keeping machine output separable in the reading text itself.
- Notes carry a triple-coded marker (colour, icon, position). The temporary "show this entity's mentions" highlight has its own class (`.ed-w.mention-hit`, outline, gold family), so clearing it never strips the permanent visibility classes and it cannot be confused with the note underline.
- The legend strip is rebuilt per render from the codes actually PRESENT in the document (no violet chip in a purely human edition; a "missing entity" chip only when a dangling ref exists; hidden when nothing shows) and shares the reading-text CSS rules via `:is()` selectors, so a chip always shows exactly the code it names.
- Tooltips, legend and choosers use one human label per critical kind ("deleted", "added"), never the raw TEI localName.
- Token pairs `--color-workName(-bg)` (bibl hue: a work is a bibliographic entity) and `--color-eventName(-bg)` (date hue: an event is a datable occurrence) are independent tokens, so either family can diverge later.
- In-place UI (choosers, popovers) cancels by restoring the clicked element, not by re-rendering, so reading-pane scroll and facsimile zoom survive a look-and-cancel.

The M2.6 inline cell action chooser that accompanied this layer was superseded the same day by the M2.10 editor paradigm (context menu and gestures, see Layout above); the index-initiated link flow was retired with M2.11 (selection-initiated linking covers it).

## Components Present vs Future

| Component | Status |
|-----------|--------|
| Reading-text pane with inline cell edit | Built |
| Dual view (M2.14): left text surface with Reading/XML view tabs, right context panel with tabs from an open registry (facsimile, index; `project.panels` extensible); Index fallback when a document has no images | Built (2026-06-10) |
| Facsimile panel: real images, deep zoom (OpenSeadragon 5.0.1), `<zone>` overlays bidirectionally linked to the reading text | Built |
| Live checks as a status chip in the left pane head with detail popover (footer until round 7, right-pane tab before that); tooltip defines well-formed and lossless | Built (2026-06-10) |
| About page (`about.html`): tool, lossless definition, examples, method, maker, imprint link; identity footer (DHCraft logo, About, Imprint, GitHub icon) on all pages | Built (2026-06-10) |
| Selection annotation: select words in a line, annotate as a new or existing entity, lossless sub-range wrap (M2.8) | Built (2026-06-10) |
| Welcome state: full-width start surface (value proposition, gold open button, drag-and-drop with drop indicator, recent files via persisted handles, three example cards + violet LLM card); editor chrome hidden until load; Examples button menu in the toolbar | Built (2026-06-10, supersedes the in-pane start screen and examples select of the same morning) |
| Editor paradigm: cursor click, click-to-edit on annotated elements, double-click direct edit, right-click context menu (M2.10) | Built (2026-06-10) |
| Evidence-first annotate popover with provenance groups, filter, and plain-TEI markup wraps incl. structured persName | Built (2026-06-10) |
| Editable XML source view: syntax highlighting, line numbers, Check XML with error jump, gated Apply (M2.12) | Built (2026-06-10) |
| LLM on-ramp modal (violet) | Built; hidden behind `FEATURES.llmOnRamp` (off since 2026-06-10) |
| Entity index (M2.11, a right-pane context panel since M2.14): filterable `<standOff>` index with mention counts; row click jumps to the first mention while the index stays visible | Built (2026-06-10) |
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
