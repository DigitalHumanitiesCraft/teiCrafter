# Browser Visual-Acceptance Checks

## Why this file exists

teiCrafter's automated proofs (the `test/tools/*_check.mjs` scripts and the
`test/harness` validators) run outside the browser. They prove the engine
contract: a parse covers every byte, an edit is an offset splice, `serialize()`
returns the raw bytes unchanged, and standoff and criticism markup round-trips
losslessly. None of them can see the DOM, the event stream, or the timing of
deferred handlers. The selection-popover lifecycle, the facsimile-to-text
coupling, the violet AI marker, the index panel, and every keyboard and
pointer gesture live entirely in that DOM/event/timing layer.

`test/tools/interaction_check.mjs` lifts the one piece of that layer that
reduces to pure logic (the popover dismissal identity guard) into a headless
predicate. Everything else is checked here, by hand, against a running editor.
This file is the named, reproducible floor for the layer the engine proofs
cannot reach. Run it whenever a change touches the editor UI, the event
handlers, the facsimile viewer, or the standoff and annotation surfaces.

## Serve recipe (no build step)

The tool is client-only ES6 modules with no bundler. Serve the `docs/`
directory over HTTP (the File System Access and module-loading paths do not work
from a `file://` URL) and open the editor.

```
cd docs
python -m http.server 8000
```

Then open `http://localhost:8000/editor.html` in the browser.

On a local development host the built-in examples are visible (the
`FEATURES.examples` flag is on for localhost), so the example deep links used
below resolve. The public GitHub Pages deployment hides them; on the public
deployment, open your own document instead.

### Chromium-only caveat

"Open project folder" and the directory-handle recents use the File System
Access API, which only Chromium-based browsers (Chrome, Edge) implement. Run
these checks in Chromium. Firefox and Safari can load a single picked or
dropped file but cannot open a project folder or reopen a recent by handle, so
the project-panel and recovery checks (VC-10, VC-11) do not apply there.

### Example references used below

| Reference | Deep link / source | Shape |
|-----------|--------------------|-------|
| ZBZ Hersch line-level | `editor.html#example=zbz` (or open `docs/data/editor/zbz-100/zbz-hersch-100.xml`) | line-level TEI |
| Wenzelsbibel word-level | `editor.html#example=wb` (or `docs/data/editor/wb-codex/...`) | word-level TEI with facsimile |
| hsa-7711 letter | open the folder `docs/data/editor/hsa-7711/` as a project, then its `.txt` | plaintext to TEI |

## Checks

Each check states the Gesture (what the operator does), the Expected result, and
the Failure signature (what a regression looks like, so a failing run is
unambiguous).

### VC-1 Open a TEI document and it renders

- Gesture: open the ZBZ Hersch line-level example (`editor.html#example=zbz`, or
  pick `zbz-hersch-100.xml`).
- Expected: the reading pane (`#ed-reading`) shows the transcribed lines folio
  by folio; the folio navigation and the validation chip appear.
- Failure signature: an empty reading pane, a console parse error, or a blank
  page after the document is chosen.

### VC-2 Facsimile linking, both directions

- Gesture: open a document that carries page images and zone coordinates (the
  Wenzelsbibel example). Hover or select a text line, then hover a zone on the
  image.
- Expected: a linked page image appears in the facsimile panel; selecting or
  hovering a text line highlights the corresponding image region, and hovering a
  zone on the image highlights the corresponding text line.
- Failure signature: no image loads, the highlight stays on one side only, or
  the highlighted region belongs to a different line than the one under the
  cursor (a stale-surface coupling, see VC-RACE-FACS).

### VC-3 Correct a word or line and it persists

- Gesture: double-click a word (word-level document) or a line (line-level
  document), edit the text, commit by pressing Enter or clicking away.
- Expected: the correction shows in the reading view and stays after the edit
  field closes; the document is marked dirty (unsaved).
- Failure signature: the edit reverts on blur, the old text returns after the
  next render, or the wrong cell is edited.

### VC-4 Annotate an entity and attach an authority id

- Gesture: select an entity mention in the diplomatic reading view, choose an
  entity type, then attach an authority id from a register (GND, GeoNames, or
  Wikidata).
- Expected: the mention is wrapped as `<name ref="#id">` linking to a standoff
  entity that carries the authority `<idno>`; the mention displays as `name@ref`
  (the entity name followed by its reference).
- Failure signature: the `@ref` does not appear, the mention is not wrapped, or
  the authority id is dropped from the standoff entry.

### VC-5 Violet AI marker clears on confirmation

- Gesture: with an AI-generated or unverified mention present (machine-drafted
  or unreviewed), confirm it.
- Expected: the unverified mention shows in the violet token family
  (`--color-ai`); confirming it clears the violet marker while the mention
  itself (the wrap and its `@ref`) stays in place.
- Failure signature: confirming removes the mention instead of only its marker,
  the violet colour persists after confirmation, or a confirmed mention reverts
  to violet on the next render.

### VC-6 Save and reopen is byte-identical

- Gesture: save the document, then reopen the saved file. Compare against the
  original at two distinct objects (for example two different folios, or a folio
  and a standoff entry).
- Expected: the reopened document is byte-identical to the saved bytes;
  serialization made no incidental change to whitespace, attribute order, or
  entity escaping.
- Failure signature: a diff at any byte that was not deliberately edited; in
  particular changed indentation, normalized attribute quoting, or
  re-escaped entities.

### VC-7 Remove an annotation (unwrap)

- Gesture: open an existing annotated mention and remove its link (the remove or
  unwrap action in the annotation popover or context menu).
- Expected: the `<name>` wrapper is unwrapped, the plain mention text remains,
  and a wrapper shared with sibling content is refused rather than stripping
  neighbouring text.
- Failure signature: neighbouring text is lost, the entity stays linked after
  unwrap, or the text is re-escaped on unwrap.

### VC-8 Overlapping and nested annotations inspector

- Gesture: place two annotations that overlap or nest on the same span, then
  click the span.
- Expected: the layers inspector opens and lists every annotation layer on that
  span (stacked underline in the reading view, each layer addressable in the
  inspector).
- Failure signature: the inspector shows only one layer, clicking opens the
  wrong editor, or the stacked underline does not reflect the layer count.

### VC-9 Index panel overview

- Gesture: open the index panel.
- Expected: the panel lists the document's entities as an overview with
  verify-link chips and a needs-work filter; selecting an entry navigates to or
  highlights its occurrences.
- Failure signature: the panel is empty for a document that has entities, the
  needs-work filter does not narrow the list, or a chip links to the wrong
  entity.

### VC-10 Empty-project onboarding

- Gesture: open the editor with no document loaded (or open an empty project
  folder).
- Expected: an onboarding state explains how to open a document, a project
  folder, or start from text; no error is shown for the empty state.
- Failure signature: a blank or broken pane, a console error on empty state, or
  onboarding text that references an action that is not present.

### VC-11 Draft badge and recovery

- Gesture: open a plaintext source (`.txt` or `.md`) as a line-level draft (the
  hsa-7711 `.txt`, from the project panel or by drop). Reload the page before
  the first save.
- Expected: the draft shows a draft badge (machine transport, never AI-marked);
  after the reload, a recovery offer restores the unsaved draft.
- Failure signature: no draft badge, the draft opens marked as AI content
  (violet), or the reload loses the unsaved draft with no recovery offer.

### VC-12 Validation tooltip honesty

- Gesture: open the validation chip (`#ed-val-chip`) on a document with and
  without validation findings.
- Expected: the tooltip and popover state exactly what is and is not checked; a
  clean document does not claim a guarantee the tool did not verify, and findings
  name their basis.
- Failure signature: the tooltip claims validity the tool did not establish,
  reports findings with no basis, or shows stale findings after an edit.

### VC-13 Confirm or reject an AI proposal per construct

- Gesture: with an AI proposal present on a non-entity construct (a markup wrap such
  as `<date>`, an `<unclear>`/`<del>`/`<add>`, an inline AI entity name-wrap, or a
  `<gap/>`), click the violet construct. It opens the layers inspector. Use the
  per-layer "confirm" or "reject".
- Expected: the inspector lists the construct's layer(s); a layer carrying the project
  `@resp` shows a "confirm" and a "reject". Confirm drops the violet `@resp` marker and
  keeps the markup (it reads as ordinary, human-accepted markup afterwards); reject
  removes the construct (a reading-text wrapper restores the exact surrounded text, a
  `<gap/>` marker is removed). A human-authored, unmarked construct shows no
  confirm/reject. A save-reopen is byte-faithful to the intended change (VC-6). The
  engine behind this is proven headless (`proposal_review_check`).
- Failure signature: confirm removes the construct instead of only its marker, reject
  loses or changes neighbouring reading text, confirm/reject appears on human markup,
  the violet persists after confirm, the inspector does not open on a single AI
  construct, or a save-reopen diffs outside the intended span.
- Not yet covered (engine ready, UI surface pending): confirming or rejecting a
  proposed standOff `<note>`, which is not a reading-cell layer and so does not appear
  in the inspector; its review surface is the open remainder.

### VC-15 Export the inline-GND interchange copy

- Gesture: open a document under a project that declares the inline-GND interchange
  (the ZBZ Hersch example, `editor.html#example=zbz`, whose
  `teicrafter.project.json` carries `"interchange": "inline-gnd"`). Annotate at
  least one person/org/work mention with a GND id. An "Export inline-GND" button
  appears in the toolbar beside Save and Download. Click it.
- Expected: the button is shown ONLY for an inline-GND project (it is absent for the
  Wenzelsbibel example and any document without the opt-in). Clicking it downloads
  `{name}_final.xml`: each register mention is inlined as `<persName ref="GND:..">`,
  `<orgName ref="GND:..">` or `<bibl ref="GND:..">`, places are plain text, and there
  is no `<standOff>`. The reading text is byte-identical to the in-editor document,
  and the in-editor document is left unchanged (the register model stays the editing
  model). Re-opening the exported `{name}_final.xml` in the editor renders the same
  reading text (the round-trip fixed point proven headless by
  `inline_gnd_reopen_check`). The engine behind the export is proven headless
  (`inline_gnd_check`, `inline_gnd_schema_check`).
- Failure signature: the button appears for a non-opt-in document, the export changes
  the in-editor document, a `<standOff>` survives in the exported file, a `<name
  ref="#..">` mention survives un-inlined, a place is annotated, the reading text
  diffs from the source, or the exported file fails to re-open.

### VC-F-1 Index panel reflects the document's declared indices

- Gesture: open the folder `docs/data/editor/wb-codex/` as a project (its
  `teicrafter.project.json` declares the `indices`: `persons`, `places`, and
  `peoples`), then open its document. Open the index panel.
- Expected: the panel's sections are exactly the indices the manifest declares
  for this document, in the declared order, with the declared labels (here
  Persons, Places, and Peoples (Völker)); the sections are derived from the
  manifest, not from a fixed built-in list. A project that declares a different
  set yields a different set of sections.
- Failure signature: the panel shows the fixed built-in sections regardless of
  the manifest (for example a Works or Events section the manifest does not
  declare), omits a declared index, drops a declared label, or orders the
  sections other than as declared.

### VC-F-2 Non-mappable index is read-only

- Gesture: with the Wenzelsbibel project open (VC-F-1), look at the `peoples`
  index in the panel. This index declares no `listType`, so the editor cannot
  map it onto an editable standOff list in place.
- Expected: the `peoples` section appears in the panel rather than being hidden;
  it is marked read-only; its add action is disabled (not absent in a way that
  looks like a bug), and a short explanation states that this index cannot be
  edited in place because the document declares no mappable list type for it.
- Failure signature: the non-mappable index is hidden from the panel, its add
  action is enabled and produces a broken or dangling entry, the read-only state
  carries no explanation, or the disabled add action throws on click.

### VC-F-3 Empty-project onboarding

- Gesture: adopt an empty project folder (a folder with no `.xml`, `.txt`, or
  `.md` document), or open the editor with no document loaded.
- Expected: the editor shows a factual onboarding state that explains how to
  open a single TEI document, how to open a project folder, and how to start
  from a plaintext source; no error is shown for the empty state and no pane is
  blank or broken.
- Failure signature: a blank or broken reading pane, a console error on the
  empty state, onboarding text that names an action the UI does not offer, or no
  onboarding text at all for an empty project.

### VC-F-4 Draft badge in the document strip

- Gesture: open a plaintext source (`.txt` or `.md`) as a line-level draft (the
  hsa-7711 `.txt`, from the project panel or by drop). Look at the document strip
  (`#ed-docstrip`) under the toolbar.
- Expected: the draft is marked by a neutral draft badge in the document strip
  itself; the badge uses neutral tokens, never the violet AI family
  (`--color-ai`), and never implies machine-generated or AI content (a plaintext
  draft is deterministic transport, not AI). The former standalone draft banner
  is gone; the draft state is carried only by the strip badge.
- Failure signature: the draft badge is violet or otherwise reads as AI content,
  the badge is missing from the document strip, or the standalone draft banner
  still appears alongside or instead of the strip badge.

## Author-mode structural gestures

These exercise the author-mode primitives (`docs/js/editor/structural.js`) as the
operator drives them. The gesture model is context-menu-only: right-click on the
reading surface opens the menu, and the structural acts are menu items there.
There is no Enter or Backspace structural editing yet, so do not expect a
keystroke path. The menu is neutral chrome, never the violet AI family
(`--color-ai`). Each act is one offset splice over the parser's recorded offsets,
so the byte-faithful core holds: only the bytes the act inserts or removes change,
and a save-reopen is byte-faithful to the intended change (the VC-6 contract).
Drive these on a line-level document (the ZBZ Hersch example,
`editor.html#example=zbz`, whose lines are `<l>` elements with `xml:id`s).

### VC-AUTHOR-1 Split a line at the caret

- Gesture: place the caret inside a line at a point between two words, right-click
  there, and choose Split (split the line at the caret).
- Expected: the one line becomes two sibling elements of the same kind (an `<l>`
  splits into two `<l>` siblings); the text before the caret stays in the first
  element, which keeps its original id; the text after the caret moves into a new
  following sibling that carries a fresh, unique id. The new sibling lines up with
  the original's indentation. A save-reopen is byte-faithful to the intended change
  (two lines where there was one, every other byte unchanged).
- Failure signature: the line is not split, the split produces an element of a
  different kind, the first element loses its id or the new sibling reuses the same
  id (a duplicate `xml:id`), text is dropped or reordered across the boundary, or a
  save-reopen diffs at a byte the split did not touch. A split with the caret
  outside the line's content must be a no-op, not a malformed document.

### VC-AUTHOR-2 Merge with previous

- Gesture: right-click a line that has a previous sibling of the same kind, and
  choose Merge with previous.
- Expected: the line joins the previous sibling of the same element; the previous
  element keeps its id and this line's id is dropped; the two contents join inside
  the previous element with their reading order preserved (the previous content
  first, then this line's content). The inter-element whitespace between the two is
  removed so the contents are contiguous. A save-reopen is byte-faithful to the
  intended change.
- Failure signature: the merge keeps both ids (a duplicate or orphaned id), drops
  the previous element's id instead of this one's, reorders or loses content across
  the join, leaves a stray empty element behind, or merges across two elements of
  different kinds. A merge offered on a line with no same-kind previous sibling
  must be a no-op (or the item disabled), not a malformed document.

### VC-AUTHOR-3 Insert a line break

- Gesture: place the caret at a point inside a line, right-click there, and choose
  Insert line break.
- Expected: the document's own line-break milestone form is inserted at the caret.
  A document whose elements carry the `tei:` prefix gets `<tei:lb/>`; a
  default-namespace document gets `<lb/>`. No other bytes change: only the
  milestone string is inserted at the caret offset, and a save-reopen is
  byte-faithful to the intended change.
- Failure signature: the wrong milestone form is inserted (a bare `<lb/>` into a
  `tei:`-prefixed document, or a `<tei:lb/>` into a default-namespace document), a
  different element is inserted, bytes other than the inserted milestone change, or
  a save-reopen diffs outside the inserted span.

### VC-AUTHOR-4 Delete only an empty element

- Gesture: right-click an empty line (one with no non-whitespace reading text) and
  read the Delete item; then right-click a line that still carries text and read
  the Delete item.
- Expected: on the empty line the Delete item is enabled, and choosing it removes
  the whole element losslessly (its entire outer span, leaving no stray tag or
  dangling whitespace island); a save-reopen is byte-faithful to the intended
  change. On the non-empty line the Delete item is disabled (the refuse-non-empty
  contract in `deleteElement`), so reading content can never be silently dropped
  through Delete.
- Failure signature: Delete is enabled on a non-empty line and removes content,
  Delete on an empty line leaves a fragment (a half tag, an orphaned whitespace
  run, or a broken parse), the disabled Delete throws on click, or a delete diffs
  a save-reopen at a byte outside the removed element.

### VC-HSA hsa-7711 letter end-to-end

- Gesture: open the folder `docs/data/editor/hsa-7711/` as a project, open its
  `.txt` letter as a line-level draft, annotate at least one entity, save (the
  first save creates the `.xml` next to the source), then reopen the saved
  `.xml`.
- Expected: the letter renders as a line-level draft; the annotation persists
  through save; the reopened `.xml` is byte-identical to the saved bytes.
- Failure signature: the draft does not open, the first save does not create the
  `.xml` beside the source, the annotation is lost on reopen, or the reopened
  file differs from the saved bytes.

## Race and re-entry checks

These exercise the deferred handlers named in the interaction surface map and in
the manual gaps printed by `test/tools/interaction_check.mjs`. They are listed
separately because they depend on event ordering and timer or await scheduling
that the headless predicate cannot reproduce. The confirmed-race set handed to
the synthesis step was empty; these are the named gestures to watch so that any
future regression in the deferred paths is caught by hand rather than going
unobserved.

### VC-RACE-MANUAL Deferred-handler floor

- Gesture: perform VC-RACE-POPOVER, VC-RACE-RECON, VC-RACE-LOOKUP, and
  VC-RACE-FACS below in one sitting.
- Expected: every one passes its own expectation.
- Failure signature: any one of the four shows its failure signature.

### VC-RACE-POPOVER Late mouseup does not kill a freshly opened popover

- Gesture: click an annotated word so its popover opens, with the click landing
  as a collapsed (caret) selection. Repeat quickly several times.
- Expected: the popover that the click opens stays open; the deferred mouseup
  does not tear it down. This is the live counterpart of the
  `shouldDismissPopover` identity guard proven headlessly in
  `interaction_check.mjs`.
- Failure signature: the popover flickers open then closes on the same click, or
  opens only on every second click. (Source: the deferred mouseup at
  annotation-ui.js:1030-1056 racing the span-click handler at
  editor-app.js:956-966.)

### VC-RACE-RECON Auto-reconcile after popover teardown

- Gesture: open the authority editor on a mention, then close or reopen the
  popover within roughly 400 milliseconds of opening it.
- Expected: the deferred auto-reconcile lookup either runs against the still
  connected anchor or is skipped; it never renders results into a torn-down or
  replaced popover.
- Failure signature: a lookup-results popover appears detached, attaches to the
  wrong anchor, or throws because its anchor is gone. (Source:
  `maybeAutoReconcile` setTimeout(400) at annotation-ui.js:365-377.)

### VC-RACE-LOOKUP Authority lookup resolving after reopen

- Gesture: trigger an authority lookup, then reopen or replace the popover before
  the network request resolves.
- Expected: when the await resolves, the results render only if the results
  popover is still connected (the `pop.isConnected` guard); a candidate pick
  reaches `commitAndReopen` against the current cell, not a stale one.
- Failure signature: results render into a stale popover, or picking a candidate
  commits against the wrong cell. (Source: the awaited fetch in
  `runAuthorityLookup`, authority-picker.js:42-67 and annotation-ui.js:337-351.)

### VC-RACE-FACS Zone overlays against a stale surface

- Gesture: turn pages quickly while the facsimile image for a page is still
  loading, then hover or click a zone.
- Expected: the zone overlays added when the image finishes loading belong to the
  page now shown; hovering a zone highlights the correct line on the current
  surface.
- Failure signature: zone overlays from a previous page persist, or a zone hover
  highlights a line that belongs to a different folio. (Source: the OSD
  `addZoneOverlays` open handler at facsimile.js:174-184 closing over the surface
  captured at `showPage` time.)

## Run log

Record each operator pass: date, browser, and which checks passed or failed.

| Run | Result |
|-----|--------|
| Run 2026-06-13 | pending operator pass |
