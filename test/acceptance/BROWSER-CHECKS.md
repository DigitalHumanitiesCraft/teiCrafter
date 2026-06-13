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
