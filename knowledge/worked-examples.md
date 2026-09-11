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
updated: 2026-09-11
language: en
topics: ["[[Worked Example]]", "[[TEI XML]]", "[[Source Profiles]]", "[[Digital Scholarly Editing]]"]
related: [project, specification, testing, integration]
---

# teiCrafter Worked Examples

## How to read the examples

Each example identifies its source shape, the editing projection, the output contract, and the evidence boundary. A real-object observation establishes only the path that actually used the object. A synthetic twin establishes reproducible structure and browser interaction. Formal schema validity refers to the schema set that ran. Scholarly acceptance remains a project-editor decision.

## Everyday editorial recipes

These recipes use invented sample content unless a named local source is explicitly supplied. They exercise workflows without presenting invented text as a historical transcription.

| Goal | Steps | Boundary to check |
| --- | --- | --- |
| Turn a transcription into a letter | Load... > New document; choose the letter starter, paste the transcription, enter available metadata, create, correct and request TEI Download | No inferred sender, date or place; the starter is deterministic and not AI-marked |
| Edit an existing charter | Open its TEI; inspect Source, navigate its real sections/pages, edit simple metadata or use complete header XML, inspect registers, validate output | Preserve unrecognized diplomatic structures; dedicated charter forms are still planned |
| Manage a lexicon collection | Choose the dictionary or encyclopedia starter, or open its existing TEI; use Entries to search, create, duplicate and preview bounded batch changes | The encodings remain distinct; mixed fields use XML, and batch/deletion-reference scope is the active file |
| Read an unfamiliar TEI | Open it and enable read-only mode; navigate, inspect metadata/source and select explicit witness readings where encoded | Editing controls cannot mutate the document; missing witness attribution does not imply agreement with the base text |
| Edit a legal source's metadata and indices | Inspect every header field, apply supported scalar edits, use XML for structured fields, edit existing entities and follow occurrences | An entity index is not a complete project-wide legal vocabulary or cross-document reference manager |
| Preserve interrupted work | Leave an inline, XML, metadata or specialized form edit unfinished; reload and restore its checkpoint, or export/reopen Working copy | Invalid staged XML survives as staged input; attached project documents retain their source and settings |
| Deliver an attached project | Choose Project package after editing attached documents and resolving visible input | Every XML file must pass its own schemas before one ZIP is requested; native Save remains scoped to the active file |

Actual menu labels and fixture assertions are exercised by the browser suite. [Dated reports](../reports/README.md) state which runs passed and which material was available.

## Entry collection workflow

The original synthetic fixtures [dictionary entries](../test/fixtures-synthetic/entries-30-dictionary.xml) and [encyclopedia articles](../test/fixtures-synthetic/entries-30-articles.xml) contain varying completeness, internal and cross-entry references, mixed content and foreign example markup. Their descriptions are software-test material and make no historical claims. The collection size follows the acceptance scenario in [specification](specification.md#deterministic-creation).

1. Open either file and inspect Entries. Search by headword, text or XML ID; use Incomplete entries only to locate absent definitions. Display sorting leaves the source order unchanged.
2. Select an entry and edit an unambiguous heading or definition. Structured fields remain disabled in the scalar form and accessible through Edit entry XML. Apply a no-op to verify that the original source is retained.
3. Duplicate an entry with an internal detail ID and a cross-entry reference. The copy receives unused IDs, its internal pointer follows its copied detail, and the reference to the other entry retains that target. Preview deletion of a referenced original to inspect the blocking source attributes.
4. Select entries and open Batch edit selected. Choose local language or number, enter a value and inspect each before/after row. Changing the value invalidates the preview. Apply creates one Undo step for the complete selected batch.
5. Leave creation or batch values unfinished and preserve a Working copy. Restore the values and scope, request a fresh batch preview, then continue. A malformed identity or duplicate attribute is refused while the unfinished correction remains recoverable.
6. Request TEI Download to validate the resulting XML. After deleting the last entry, reopening the empty file leaves Entries available through explicit panel selection; creating its first new entry requires choosing the encoding.

These paths establish source and interaction behavior for the declared entry structures. Batch scope and deletion-reference protection stop at the active XML file. A project that keeps entries in several files needs a separate cross-file reference review.

## Witness description and reading workflow

Open a critical edition with local witness definitions and `app` alternatives. In Witnesses, select the reading witness and inspect the alternatives and their own `@wit` values. The reading surface changes only for explicit, unambiguous attestations. Missing attribution, multiple matches, omissions and fragment markers remain distinguishable, and text outside the apparatus remains base text.

Use New witness to supply an identifier and description. Edit a scalar description directly or use exact witness XML for a structured or bibliographic record. Referenced identifiers and descendants cannot be removed or renamed through those operations. Edit witness attribution selects local witnesses or groups for one reading while preserving its content and other attributes. Read-only mode keeps reading selection and inspection available; unfinished source edits retain their ownership when the context pane refreshes.

The focused witness fixtures exercise these declared local semantics. External witness resolution and arbitrary apparatus-location schemes require separate project contracts. [Testing](testing.md) and the dated reports distinguish those focused checks from the full browser suite and scholarly acceptance.

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
5. Review the current navigation unit using the dialog, supplying reviewer and rationale. The TEI gains a targeted `revisionDesc/change` with a source-scope fingerprint. Editing that scope makes the record historical; Undo returns the prior exact source.
6. Request Download or Save fallback. The editor applies repository TEI All because the source has no project schema set, validates the exact target bytes, and permits output only for the current revision.
7. Compare the downloaded bytes with the intended source and mutation.
8. Run the automated accessibility audit in the populated document state.

### Evidence

Historical runs observed the real workflow through Playwright in Chromium and Firefox. This is prior evidence, not a claim that every subsequent run includes the local source. Both engines exercise Source Profile disclosure, navigation, complete metadata, review and Undo, the TEI All output gate, exact download, and Axe. The serious and critical audit is clear in the exercised state, including the paragraph contrast correction prompted by the earlier real-object run.

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

This evidence applies to the local engine and profile path. It establishes that the complete real object can pass through the offset model and facsimile resolver. Separate opt-in Chromium and Firefox workflows exercise the real source through `WB_CODEX` and `WB_IMAGES`; the source files remain local, and dated reports record which cases ran.

### Browser path through the structural twin

The local example registry first attempts the real source and falls back to a committed synthetic codex when it is unavailable. The twin preserves the structures needed for reading, dual readings, facsimile alignment, zones, and stand-off apparatus. Chromium and Firefox therefore exercise a reproducible browser path without carrying third-party source text.

The twin supplies structural interaction evidence. Performance and vocabulary conclusions about the real codex require a local run.

### Specialized annotation workflow

Open the codex and use Wenzelsbibel > Transcription to change a selected word's normalized reading without changing its diplomatic representation. Commentary edits the existing multilingual `listApp/app` records; a new comment creates boundary anchors around the selected words. Bible verses creates independent mappings whose reference edition and Latin quotation are supplied by the editor.

Open Bildannotationen.xml and attach the codex under Linked project documents. Select an existing image record, edit its description or attribution, select an ICONCLASS concept, and inspect its image zone or text range. Project checks resolves those pointers against the attached source. A codex word can also lead back to an attached image whose statistical range contains it.

New shared registers creates a separate TEI document for persons, places and peoples. Open companions for editing to move between files; the project retains each edited source, encoding and schema settings. A restored checkpoint or reopened Working copy recreates the attached collection. Refresh an attachment explicitly after an external file change.

Choose Project package to validate each XML document and request one ZIP containing the collection and eligible loaded images. An invalid member, cancellation or a changed captured state blocks the whole package. Working copy remains the preservation route for unfinished data, and native Save still affects one active file. [The Wenzelsbibel contract](wenzelsbibel.md) supplies the detailed encodings and walkthrough.

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
2. The review dialog collects reviewer and rationale; the action ensures a stable identifier on the entry and writes a targeted, fingerprinted review change in the header.
3. The editor selects the first phrase, chooses `add another segment`, moves to another page or entry, and selects the remaining phrase.
4. Entity linking inserts boundary anchors and one `spanGrp` with ordered spans. The selected text stays unchanged.
5. Every segment projects as the same mention. Relink updates the complete group.
6. Download validates the resulting complete TEI through every configured schema.

This example keeps three scholarly facts separate. Navigation describes source structure. Review records a human verification act. The span group represents one semantic entity mention with discontinuous textual realization.
