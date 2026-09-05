---
title: teiCrafter Worked Examples
project:
  name: teiCrafter
  repository: https://github.com/DigitalHumanitiesCraft/teiCrafter
method:
  name: Promptotyping
  url: https://lisa.gerda-henkel-stiftung.de/digitale_geschichte_pollin
template:
  name: Vorlage Worked Example
  version: 0.1
  url: https://dhcraft.org/Promptotyping/promptotyping-document/worked-example
status: active
created: 2026-06-08
updated: 2026-08-24
language: en
topics: ["[[Worked Example]]", "[[TEI XML]]", "[[Source Profiles]]", "[[Digital Scholarly Editing]]"]
related: [project, specification, testing, integration]
---

# teiCrafter Worked Examples

## How to read the examples

Each example identifies its source shape, the editing projection, the output contract, and the evidence boundary. A real-object observation establishes only the path that actually used the object. A synthetic twin establishes reproducible structure and browser interaction. Formal schema validity refers to the schema set that ran. Scholarly acceptance remains a project-editor decision.

## Compositional Source Profile examples

The committed Source Profile fixtures show why a single edition type or global editing unit is insufficient.

| Source shape | Primary navigation | Retained capabilities |
| --- | --- | --- |
| Paginated dictionary | Entries | Pages, surfaces, logical flow, facsimile, and header metadata |
| Paginated drama | Speech turns | Pages, dramatic context, sections, surfaces, facsimile, and header metadata |
| Spoken TEI corpus | Corpus members | Speech turns, token analysis, logical flow, and member headers |
| Correspondence | Sections | Correspondence metadata, logical flow, and complete header metadata |
| Critical edition | Sections | Apparatus, witnesses, logical flow, and complete header metadata |
| Facsimile-only TEI | Surfaces | Graphics and header metadata |
| `sourceDoc` transcription | Source documents | Surfaces, zones, lines, facsimile, and header metadata |
| Mixed-capability TEI | Entries with an ambiguity issue | Pages, speech turns, tokens, correspondence, apparatus, tables, surfaces, logical flow, and header metadata |

All channels come from actual TEI anchors. The mixed source deliberately triggers ambiguity because several high-priority channels coexist. The resolver records that condition and selects a deterministic fallback. A project can choose another available channel through `uiProfile`.

Reading granularity remains local. A paragraph that contains ordinary text, `w`, and `pc` projects ordinary text as exact text runs and the encoded tokens as token cells. Editing one form does not require rewriting the other.

## UFBAS whole-book workflow

### Source and purpose

The UFBAS Urfehde source is a real locally supplied TEI book. It combines whole-book page navigation, semantic markup, a substantial TEI header, exact page XML, and a portable file workflow. It exposed interaction and contrast defects that small fixtures had not rendered.

### Editorial path

1. Open the real TEI through the browser file input.
2. Inspect the Source panel and verify that page navigation comes from real page milestones.
3. Move through the book in Reading text and open the exact current-page XML without staging the complete source in the editor.
4. Open Metadata and inspect the complete header inventory. Common fields receive direct labels, while structured fields remain XML-only and retain the complete header route.
5. Mark the current navigation unit reviewed. The TEI gains a targeted `revisionDesc/change`. Undo returns the prior exact source.
6. Request Download or Save fallback. The editor applies repository TEI All because the source has no project schema set, validates the exact target bytes, and permits output only for the current revision.
7. Compare the downloaded bytes with the intended source and mutation.
8. Run the automated accessibility audit in the populated document state.

### Evidence

The real workflow has been observed through Playwright in Chromium and Firefox. Both engines exercise Source Profile disclosure, navigation, complete metadata, review and Undo, the TEI All output gate, exact download, and Axe. The serious and critical audit is clear in the exercised state, including the paragraph contrast correction prompted by the earlier real-object run.

The source remains outside the repository. Reproduction requires `UFBAS_TEI` to identify the local file. A missing path skips the real-object scenario and does not convert synthetic coverage into a real-object claim.

## Wenzelsbibel Codex 2759

### Source model

The Wenzelsbibel codex supplies a demanding TEI edition shape.

- Word elements carry diplomatic content and may carry `@orig` and `@norm`.
- Page and line milestones align text with facsimile structures.
- Surfaces reference IIIF image resources.
- Zones use rectangular coordinates or point geometry.
- TEI-level stand-off apparatus points to inline anchors.
- A separate image-annotation document links into the codex through cross-file `corresp` values and range expressions.

### Engine path on the real codex

The rights-local proof parses the complete codex, identifies the word and project profiles, preserves a no-op exactly, resolves IIIF image targets, and derives usable zone bounds from point geometry. Dual-reading edits update diplomatic text, an existing `@orig`, and `@norm` atomically. An empty normalized value removes `@norm`, while a missing `@orig` remains missing.

This evidence applies to the local engine and profile path. It establishes that the complete real object can pass through the offset model and facsimile resolver. It does not establish a committed browser run because the codex cannot be redistributed.

### Browser path through the structural twin

The local example registry first attempts the real source and falls back to a committed synthetic codex when it is unavailable. The twin preserves the structures needed for reading, dual readings, facsimile alignment, zones, and stand-off apparatus. Chromium and Firefox therefore exercise a reproducible browser path without carrying third-party source text.

The twin supplies structural interaction evidence. Performance and vocabulary conclusions about the real codex require a local run.

### Cross-document seam

The current stand-off span engine creates grouped ranges inside one TEI document. It can express a continuous range across XML structures or several discontinuous ranges by inserting local anchors. The separate Wenzelsbibel image-annotation file requires a wider transaction.

A complete cross-file workflow must load both documents, resolve document identities, validate local and range pointers across the pair, update each affected source atomically, and authorize every changed output through its schema set. teiCrafter presently preserves these pointers in raw XML and does not offer interactive cross-document authoring.

## Jeanne Hersch inline-GND workflow

### Source and working models

The Hersch corpus uses an inline GND exchange format for people, organisations, and works. teiCrafter's entity tools use a generic stand-off register. The project boundary converts between those representations while the editor is open.

On load, `fromInlineGND` lifts existing inline authority references into the working register. Reading-text mentions and index entries then use the ordinary annotation, reconciliation, and review surfaces. Save or Download applies `toInlineGND` to the target bytes without replacing the working document.

### Fixed-point path

An unchanged inline source remains byte-identical through open and target projection. A new annotation enters the register model, projects into the Hersch exchange shape, and then passes through the effective schema gate. The exact `TEI@type="naegeli"` signature selects this boundary for a bare real file. A manifest can declare the same contract through `interchange: "inline-gnd"`.

### Representation limit

Inline GND cannot encode a mention that crosses XML structures, overlaps an existing annotation, or consists of separated segments. The selection UI identifies that target limit and blocks the annotation or output before data loss can occur. Projects needing those relations should retain teiCrafter's stand-off span representation and use a target vocabulary that can carry it.

## Stefan Zweig Digital conversion workflow

### Source boundary

The SZD lane combines catalogue TEI with Page-JSON from handwriting recognition. Page-JSON requires a deterministic conversion before it becomes editable TEI. The converter's frozen behaviour is documented in [converter-reference](converter-reference.md).

### Editorial path

1. Convert Page-JSON into minimal TEI using the repository converter.
2. Open the result with its project manifest when project-specific type, markup, image, schema, or LLM policy is needed.
3. Let Source Profile derive navigation and local cell behaviour from the converted TEI.
4. Correct text and metadata through exact projections.
5. Add entity links, review evidence, or stand-off spans where the project vocabulary permits them.
6. Validate the exact target through the project schema set before output.

The converter and editor have separate responsibilities. The converter translates upstream layout and recognition data into TEI. teiCrafter preserves and edits that TEI. A source-pipeline change therefore cannot silently redefine editor serialization.

## Multi-schema project example

A project can make structure and editorial rules jointly authoritative.

```json
{
  "teicrafter": 1,
  "name": "Critical edition",
  "schema": {
    "schemas": [
      { "type": "relaxng", "path": "edition.rng", "name": "TEI structure" },
      { "type": "schematron", "path": "editorial.sch", "name": "Editorial policy" }
    ]
  },
  "uiProfile": {
    "primaryNavigation": "sections"
  }
}
```

Save derives the target bytes, executes RelaxNG, then executes Schematron, and binds the aggregate decision to the current revision. A missing Schematron dependency or an unsupported rule construct returns unavailable and blocks output. Uploading a session schema replaces this complete set and is disclosed in the validation panel.

Raw Schematron can use namespaces, default phases, scalar lets, assertions, reports, diagnostics, and common XPath 1.0 contexts. A project with includes, abstract patterns, advanced matches, node-set variables, or later XPath should compile the schema to XSLT and ensure that the browser transformation produces SVRL.

## Complete-header example

Consider a header containing a familiar `title`, a project-specific `correspDesc`, nested responsibility data, revision changes, and attributes on otherwise unknown elements. Metadata inventories every TEI field.

- The simple title text is editable directly.
- Ordinary attribute values are editable with their quote style and surrounding whitespace retained.
- The nested correspondence and responsibility structures are marked XML-only.
- `Edit XML` opens the complete exact header.
- Opening and applying an unchanged form returns the original source bytes.

This projection exposes the entire header without pretending that every scholarly structure is a scalar form value.

## Review and discontinuous entity example

An editor reviews one entry in a paginated dictionary and then links a person whose name appears in separated phrases.

1. Entry navigation is primary, while pages remain available as context.
2. The review action ensures a stable identifier on the entry and writes a targeted review change in the header.
3. The editor selects the first phrase, chooses `add another segment`, moves to another page or entry, and selects the remaining phrase.
4. Entity linking inserts boundary anchors and one `spanGrp` with ordered spans. The selected text stays unchanged.
5. Every segment projects as the same mention. Relink updates the complete group.
6. Download validates the resulting complete TEI through every configured schema.

This example keeps three scholarly facts separate. Navigation describes source structure. Review records a human verification act. The span group represents one semantic entity mention with discontinuous textual realization.
