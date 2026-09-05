# Browser Visual-Acceptance Checks

## Why this file exists

teiCrafter's automated proofs (the `test/proofs/*_check.mjs` scripts and the
`test/harness` validators) run outside the browser. They prove the engine
contract: a parse covers every byte, an edit is an offset splice, `serialize()`
returns the raw bytes unchanged, and standoff and criticism markup round-trips
losslessly. None of them can see the DOM, the event stream, or the timing of
deferred handlers. The selection-popover lifecycle, the facsimile-to-text
coupling, the violet AI marker, the index panel, and every keyboard and
pointer gesture live entirely in that DOM/event/timing layer.

`test/proofs/interaction_check.mjs` lifts the popover dismissal identity guard
into a headless predicate. `test/e2e/app.spec.js`, `safety.spec.js` and
`persistence.spec.js` automate browser paths in Chromium and Firefox, including
Axe audits in the configured document states. This file retains the complete gesture catalogue,
including permission prompts, live external services and timing cases that
still require a human operator. Run the automated and applicable manual checks
whenever a change touches the editor UI, event handlers, facsimile viewer, or
standoff and annotation surfaces.

## Serve and verification recipes

The runtime is client-only ES modules. The pinned development path uses Vite;
directly serving `docs/` remains useful for source inspection. Neither path
works from a `file://` URL.

```
npm ci
npm run dev
```

The Vite terminal prints the local URL. The direct-source alternative is:

```
cd docs
python -m http.server 8000
```

Then open `http://localhost:8000/editor.html` in the browser.

The reproducible automated gates are:

```
npm run verify
npm run test:e2e
UFBAS_TEI=/absolute/path/TEI_SOURCE.xml npm run test:e2e
```

On a local development host the built-in examples are visible (the
`FEATURES.examples` flag is on for localhost), so the example deep links used
below resolve. The public GitHub Pages deployment hides them; on the public
deployment, open your own document instead.

### Native file capabilities

Run directory-picker and native file-handle permission checks in a browser that
provides File System Access, such as the configured Chromium target. Detect the
capability at the action boundary. Portable file input, download, Working copy,
read-only mode and IndexedDB recovery also apply to Firefox; VC-10 and VC-11 are
not restricted to native project folders. Mocked handle tests exercise application
logic, while actual permission dialogs still require an operator gesture.

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

### VC-5 Acceptance retains visible AI origin

- Gesture: confirm a pending AI proposal, then save and reopen it.
- Expected: the pending presentation changes to accepted origin in the violet
  family. The complete `@resp` list remains, and a separate acceptance token
  resolves the proposal. The markup and unrelated attributes remain intact.
- Failure signature: origin disappears, acceptance is lost after reopening, the
  construct is still pending, or confirming removes its content.

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

### VC-11 Drafts, existing documents and staged-input recovery

- Gesture: open plaintext as a draft and an existing TEI as a separate session.
  In each, leave an inline, XML or metadata field unfinished and reload. Include
  invalid staged XML and a document with uploaded images. Restore the selected
  checkpoint; also export and reopen a Working copy.
- Expected: the draft badge is neutral. Separate recovery offers retain canonical
  XML and unfinished input without applying invalid content. Loaded image bytes
  and settings survive. Restoring a Working copy creates an independent session.
- Failure signature: only drafts recover, another session is overwritten, staged
  text is silently applied or lost, image bytes vanish, or native permission is
  assumed to survive the portable bundle.

### VC-12 Validation tooltip honesty

- Gesture: open the validation chip (`#ed-val-chip`) on a document with and
  without validation findings.
- Expected: the tooltip and popover state exactly what is and is not checked; a
  clean document does not claim a guarantee the tool did not verify, and findings
  name their basis.
- Failure signature: the tooltip claims validity the tool did not establish,
  reports findings with no basis, or shows stale findings after an edit.

### VC-13 Confirm or reject an AI proposal per construct

- Gesture: open the layers inspector on a proposed markup wrapper, entity,
  textual-critical construct or gap; confirm one and reject another. Repeat for
  a stand-off note through its note marker.
- Expected: pending layers expose confirm/reject. Confirmation retains all
  responsibility tokens and adds the matching acceptance token, preserving
  other analysis values. A reversible gap resolves its proposal branch through
  the gap engine. Rejection restores the original reading branch or unwraps the
  proposal without changing neighbouring text. Human-authored layers have no
  proposal controls. Accepted origin remains visible after save/reopen.
  A session-created responsibility declaration is removed only when no remaining
  construct refers to it. Rejecting all proposals returns an otherwise unchanged
  document to its baseline.
- Failure signature: origin or unrelated responsibility/analysis tokens are lost,
  rejection changes surrounding text, human layers receive proposal controls,
  accepted layers remain pending, note controls are missing, or referenced
  responsibility declarations disappear. See `proposal_review_check` and
  `accepted_provenance_check` for the engine boundaries.

### VC-14 LLM layer off and on, Propose (AI) end-to-end

- Gesture: with the LLM on-ramp enabled, open the Load menu and toggle AI off; confirm
  no AI surface remains (no "New from text (LLM)" entry, no "Propose (AI)" action, no
  provider or key UI). Toggle AI back on. Open the hsa-7711 letter (open the folder
  `docs/data/editor/hsa-7711/` as a project and its `.txt` letter, or the registered
  example on a local host), set a provider key once via the on-ramp, run "Propose (AI)"
  on a page, then save and reopen the file.
- Expected: with AI off the editor is a fully deterministic editor with no AI surface;
  with AI on "Propose (AI)" inserts each proposal inline as a violet `resp="#ai"`
  construct, confirmable or rejectable per construct (VC-13). A save and reopen is
  byte-faithful to the intended change (VC-6): confirmed constructs retain accepted
  origin and rejected constructs restore their original reading content. The engine behind the flow is proven
  headless (`proposal_apply_check`, `proposal_review_check`, `llm_gate_check`).
- Failure signature: an AI surface remains after AI is toggled off; "Propose (AI)"
  throws, returns nothing on a page that carries proposable text, or inserts a construct
  that is not marked violet; a confirmed construct loses its `@resp` or acceptance token; or a save and
  reopen diffs outside the intended spans.

### VC-15 Hersch inline-GND open, save, download and export

- Gesture: open `output/entity_preview/1000_final.xml` from the sibling Hersch
  checkout as a single file, without first opening a project folder. Confirm that
  its existing inline annotations appear as editable register-backed mentions.
  Save it in place without making an edit, then compare the saved bytes with the
  opened bytes. Next open `output/tei_final/1540_final.xml`, add a person, org or
  work mention with a GND id, and Save. Also exercise Download and the separate
  "Export inline-GND" action. Finally, open a non-Hersch TEI whose root type is
  not `naegeli`.
- Expected: both Hersch files select the detected ZBZ Jeanne Hersch profile solely
  from the exact `TEI@type="naegeli"` signature. The existing inline mentions in
  1000 are lifted into the editable register model, while the unannotated 1540 is
  not transformed on load. Ordinary Save writes the inline-GND project format back
  to the same file handle. An unchanged 1000 is byte-identical after Save; the new
  1540 annotation is a typed inline element and no `<standOff>` remains in the saved
  artifact. Download uses the current filename and clearly identifies the inline-GND
  save format. "Export inline-GND" remains an explicit handover copy named
  `{name}_final.xml`. The non-Hersch TEI does not select this profile, even if it
  contains inline-looking markup. The deterministic boundary is proven by
  `hersch_profile_workflow_check` and the interchange engine proofs.
- Failure signature: a Hersch file needs a manifest to select its profile; a broad
  filename rule selects the non-Hersch document; 1000 opens without editable
  register entities; the unchanged Save alters 1000; ordinary Save or Download
  writes the register model; the 1540 annotation is absent after Save; or the
  explicit export changes the in-editor document.

### VC-16 Attach a local facsimile folder

- Gesture: open a Hersch TEI from `output/tei_final` that references images by bare
  filename. Choose "Attach facsimile folder" and select its corresponding
  `docs/images/{id}` directory. Turn pages and inspect the Facsimile panel. Repeat
  the action in a browser without the File System Access directory picker.
- Expected: the picker is a separate document action. Matching bare filenames
  resolve from the selected directory for the current browser session and the
  facsimiles render. The files remain local: the editor creates display URLs and
  does not copy the selected images into the TEI folder, an ordinary XML download,
  or a public location. Recovery and Working copy can preserve loaded image bytes. Missing filenames are counted in the status message. A browser without
  the capability reports that a Chromium-based browser with the File System Access
  API is required, while XML editing and download remain available. The storage
  contract is proven by `facsimile_folder_check`.
- Failure signature: the action is absent despite bare graphic filenames; selecting
  the matching directory leaves every image unresolved; Save copies attached image
  files; path-like or remote graphic URLs are treated as local filenames; cancellation
  throws; or an unsupported browser fails silently.

### VC-17 Reject structurally invalid LLM drafts

- Gesture: open "New from text (LLM)" and submit a short plaintext sample. Exercise
  responses that are malformed XML, contain a `DOCTYPE`, use a non-TEI root or wrong
  namespace, omit part of the minimum `fileDesc`, or omit `text/body`. Then exercise
  one response that satisfies the minimum structure.
- Expected: every invalid response produces a precise error in the modal and leaves
  the currently open document unchanged. A well-formed, self-contained TEI P5 response
  with `titleStmt/title`, `publicationStmt`, `sourceDesc`, and `text/body` opens as a
  violet, unreviewed draft. The prompt supplies this exact skeleton and instructs the
  model to carry source text only in the body (`llm_prompt_check`).
- Failure signature: an invalid response replaces the current document, a `DOCTYPE`
  is accepted, a valid minimum document is rejected, or the source text appears in
  the generated header because the prompt placed it there.

### VC-18 Whole-book page XML and metadata XML

- Gesture: open the real UFBAS whole-book TEI, navigate to page 4, open "XML source",
  search within the page, stage an edit, attempt a page change, then Check, Apply and
  Download. Open "Metadata", inspect the structured fields, open the complete
  `teiHeader` through "Edit XML", and attempt to change views while an edit is staged.
- Expected: the document loads as 226 pages; page source stages only page 4 and opens
  at the left edge of its exact raw span; element names are blue, and attributes plus
  values are yellow-orange. Find locates the page text, Check validates the candidate
  complete document, and staged edits block page or view changes until Apply or Cancel.
  Download differs from the opened file only by the deliberate edit. Metadata exposes
  common existing fields directly, routes mixed/project-specific markup to the exact
  raw `teiHeader`, retains document line numbers there, hides the unrelated page pager,
  and applies through the same complete-document boundary.
- Failure signature: source mode highlights the whole book, opens horizontally midway
  through a long line, drops bytes outside the edited span, allows a staged change to
  disappear on navigation, omits header metadata, or presents Metadata as a partial
  form that cannot represent the original `teiHeader`.

### VC-19 Annotation coverage, structured metadata and TEI completion

- Gesture: open a document with page annotations and a mixed header. Use the
  Annotated map to navigate, stage a Metadata field, try to change views, then
  Reset. Open complete header XML, request TEI completion, then Cancel.
- Expected: the map counts source-backed annotations and selects the requested
  unit. Metadata exposes the full inventory and marks unsafe form mappings
  XML-only. Staged fields block displacement. Completion changes only its typed
  prefix; Cancel restores the form. Validation labels distinguish a source Check
  from authorization of the exact output and report unavailable schemas honestly.
- Failure signature: header elements inflate coverage, fields are flattened,
  unfinished data disappears, the wrong unit opens, completion changes unrelated
  bytes, or the UI claims a schema result that did not run.

### VC-20 Read-only mode and review evidence

- Gesture: enable Read only and try F2, annotation, review, metadata Apply and
  source Apply. Return to editing, record review with reviewer and rationale,
  then change text within and outside the reviewed scope.
- Expected: read-only navigation and inspection work without mutation. Earlier
  Undo history survives. Review is current only when its scope fingerprint
  matches; an in-scope edit retains the earlier review as history.
- Failure signature: any editing path bypasses read-only mode, history is reset,
  changed content remains currently reviewed, or older review records vanish.

### VC-21 Starters and interrupted persistence

- Gesture: create a letter with supplied facts only, then create thirty dictionary
  entries and thirty encyclopedia articles in separate drafts. Navigate the units.
  During a pending native Save, stage another edit. Exercise a storage failure
  followed by a successful checkpoint.
- Expected: the two entry starters retain their distinct TEI shapes and stable
  IDs; no historical date is inferred. A newer edit remains unsaved and recoverable;
  a failed storage write is reported and does not prevent subsequent checkpoints.
- Failure signature: entries are flattened or merged, facts are invented, a delayed
  Save marks newer input clean, or the checkpoint queue remains unusable after failure.

The deterministic browser portions of VC-20 and VC-21 are in `safety.spec.js`
and `persistence.spec.js`. Native picker permissions and realistic quota exhaustion
still require an operator check; an injected aborted transaction is narrower evidence.

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
the manual gaps printed by `test/proofs/interaction_check.mjs`. They are listed
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
  `annotation-ui.js` mouseup dismissal racing the cell click handler in
  `reading-view.js`.)

### VC-RACE-RECON Auto-reconcile after popover teardown

- Gesture: open the authority editor on a mention, then close or reopen the
  popover within roughly 400 milliseconds of opening it.
- Expected: the deferred auto-reconcile lookup either runs against the still
  connected anchor or is skipped; it never renders results into a torn-down or
  replaced popover.
- Failure signature: a lookup-results popover appears detached, attaches to the
  wrong anchor, or throws because its anchor is gone. (Source:
  `maybeAutoReconcile` in `annotation-ui.js`.)

### VC-RACE-LOOKUP Authority lookup resolving after reopen

- Gesture: trigger an authority lookup, then reopen or replace the popover before
  the network request resolves.
- Expected: when the await resolves, the results render only if the results
  popover is still connected (the `pop.isConnected` guard); a candidate pick
  reaches `commitAndReopen` against the current cell, not a stale one.
- Failure signature: results render into a stale popover, or picking a candidate
  commits against the wrong cell. (Source: the awaited fetch in
  `runAuthorityLookup` in `authority-picker.js` and its `annotation-ui.js` callback.)

### VC-RACE-FACS Zone overlays against a stale surface

- Gesture: turn pages quickly while the facsimile image for a page is still
  loading, then hover or click a zone.
- Expected: the zone overlays added when the image finishes loading belong to the
  page now shown; hovering a zone highlights the correct line on the current
  surface.
- Failure signature: zone overlays from a previous page persist, or a zone hover
  highlights a line that belongs to a different folio. (Source: the OSD
  `addZoneOverlays` open handler in `facsimile.js` closing over the surface
  captured at `showPage` time.)

## Historical run log

The observations below retain the behavior and expectations of their recorded
versions, including superseded proposal-provenance and schema UI behavior.
They do not certify the current working tree. Add new run outcomes in a dated
report and link them from [reports/README.md](../../reports/README.md). The current
manual catalogue above describes expected behavior, not a completed operator pass.

| Run | Result |
|-----|--------|
| Run 2026-06-13 | pending operator pass |
| VC-15 inline-GND export (2026-06-21, Chrome) | lane partial pass: positive gate verified (the "Export inline-GND" button shows for the zbz interchange opt-in document, click fires with no console error, the in-editor document stays valid); negative gate (button absent for Wenzelsbibel) and exported-file re-open still pending |
| Hersch pilot, documents 1000 and 1540 (2026-08-22, in-app Chromium) | profile, reading model, folio navigation, facsimile rendering, zones, index projection, correction, annotation, and inline-GND download passed on the real local objects; native single-file Save and the directory picker remain outside browser automation and require an operator gesture |
| Live GND reconciliation (2026-08-22, in-app Chromium) | the annotation lookup returned the Jeanne Hersch record and exposed it for human selection; this verifies the live register call and candidate surface, not the scholarly correctness of every possible match |
| VC-13 proposal review (2026-08-22, in-app Chromium, local Mistral) | inline and standOff-note proposals rendered violet; the note marker opened confirm/reject, rejection removed the note, and resolving the final proposal removed `@resp="#ai"`, the session-created `respStmt`, and the dirty marker when the source returned to its baseline |
| VC-17 structural gate (2026-08-22, in-app Chromium) | structurally non-compliant replies from the real local Mistral were rejected with the current document retained; a controlled local response carrying the required TEI namespace, minimum `fileDesc`, and `text/body` was accepted, opened as generated content, and reported well-formed |
| VC-18 UFBAS whole-book XML and metadata (2026-08-24, in-app Chromium) | the real 2.17 MB `TEI_SOURCE.xml` loaded as 226 pages; page 4 source, syntax colours, find, complete-document Check, staged-edit guards, Apply, and Download passed. The downloaded file returned to the original exactly after removing the one inserted test comment. The dedicated Metadata tab exposed all 46 `teiHeader` lines, hid the pager, opened at horizontal position zero, and retained an applied header comment after the complete-document reparse. Native Save was outside the automated file-picker permission path; the universal Download path was observed. |
| VC-19 UFBAS annotation coverage, structured metadata and completion (2026-08-24, in-app Chromium) | the real file reported 226/226 annotation-bearing pages and 16,846 detected annotations; direct navigation opened page 4. Metadata projected 13 fields (11 editable, 2 XML-only), preserved the original title through the staged-change guard and Reset, exposed mixed project description as XML-only, and returned from raw XML Cancel to the form. The raw header labelled schema validation offline; `<per` offered and inserted `persName`. All temporary edits were cancelled or reset. |
| VC-20 refactor acceptance (2026-08-24, Chromium/Playwright) | 71 required proofs, harness self-test 14/14, four synthetic tiers at score 100, typecheck, Biome and Vite passed. Two committed Chromium scenarios passed with 0 serious/critical Axe findings. With `UFBAS_TEI` set to the downloaded 2.17 MB source, the optional real-book scenario loaded 226 pages, kept the pager on one line, exposed metadata and different page XML spans, persisted and undid review, validated against repository TEI All, and passed Axe with 0 serious/critical findings. The first run found and the second run verified fixes for legend and synthetic-line-number contrast plus reading-pane keyboard focus. Scholarly correctness and user acceptance remain open human judgments. |
