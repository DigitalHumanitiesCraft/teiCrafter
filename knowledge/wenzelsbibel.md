---
title: Wenzelsbibel Editorial Workspace
project:
  name: teiCrafter
  repository: https://github.com/DigitalHumanitiesCraft/teiCrafter
method:
  name: Promptotyping
  url: https://lisa.gerda-henkel-stiftung.de/digitale_geschichte_pollin
template:
  name: Vorlage Specification
  version: 0.1
  url: https://dhcraft.org/Promptotyping/promptotyping-document/specification
status: active
created: 2026-09-11
updated: 2026-09-11
language: en
topics: ["[[TEI XML]]", "[[Digital Editions]]", "[[Data Modelling]]"]
knowledge-sources:
  standards:
    - label: TEI P5 Guidelines
      uri: https://www.tei-c.org/release/doc/tei-p5-doc/en/html/index.html
    - label: ICONCLASS API
      uri: https://iconclass.org/help/api
    - label: PAGE XML example and reading order
      uri: https://www.primaresearch.org/schema/PAGE/gts/pagecontent/2017-07-15/Simple%20PAGE%20XML%20Example.pdf
    - label: METS structural maps
      uri: https://www.loc.gov/standards/mets/METSOverview.html
related: [project, specification, architecture, design, data, testing]
---

# Wenzelsbibel Editorial Workspace

## Scope and status

The Wenzelsbibel workspace specializes teiCrafter for transcription readings, commentary, Bible references, miniature descriptions, and shared registers. It uses the same complete XML source, editing transactions, undo history, recovery, facsimile viewer, and schema gate as the generic editor. A project manifest selects it with `workspace: "wenzelsbibel"`; the built-in Wenzelsbibel project profile supplies the corresponding configuration.

In the local development or build preview, the start page's Wenzelsbibel example opens this workspace with a synthetic codex when the local original is absent. The sample has no original page images. Examples remain hidden on the public deployment. For edition work in either environment, use **Load** to open the local codex and attach the corresponding image annotations and registers through **Linked project documents**.

This document defines the implemented editorial model and its operating rules. The register and verse conventions, together with the local editorial Schematron, are teiCrafter-authored project decisions. Their implementation does not constitute scholarly acceptance of a particular annotation, artist attribution, normalization, or verse alignment. The edition team remains responsible for that review. Run-specific verification belongs in the repository's test reports.

The implementation reads the existing codex and image-annotation topology without converting the edition to a new serialization. Unrelated attributes, namespaces, apparatus categories, multilingual notes, and unknown markup remain source data. A form changes only its represented fields. A semantic no-op preserves the original XML string. Ambiguous or mixed-content fields require the XML editor when a simple text form cannot preserve their structure.

## Documents and ownership

| Document | Editable content | References used by the workspace |
| --- | --- | --- |
| Codex TEI, for example `codex-2759.xml` | Word readings, apparatus, verse mappings, register links, existing facsimile structures | Shared registers and image annotations |
| Separate image TEI, conventionally `Bildannotationen.xml` | Items in `list[@type='image-annotations']` | Image zones and word ranges in the codex; shared person and place entries |
| `registers.xml` | Persons, places, peoples, and authority identifiers | Attached codex and image files for reference checks |
| Imported PAGE transcription | A new, independent TEI draft containing selected source pages | Source image filenames and preserved PAGE provenance |

Exactly one document is editable at a time. **Linked project documents** attaches local XML files to a persistent project collection. **Open for editing** checkpoints the current file before activating its companion. Each file retains its own XML, UTF-8 BOM, dirty state, project and schema settings, selected witness and attached images. Failed recovery storage blocks the switch; unfinished input must be applied or cancelled first.

Every Apply operation belongs to the active document. Native **Save** still writes that file. **Project package** validates each XML file against its own schema set and downloads one ZIP containing all files, loaded binary images and a project manifest. One invalid, unavailable, stale or cancelled decision prevents the entire package. **Load → Open project package...** restores this collection and requires fresh validation for subsequent output. The package is a single download; it does not atomically replace several filesystem files. A filename is part of a relative register reference; renaming `registers.xml` requires updating references that contain that filename.

The Wenzelsbibel forms are available in **Reading text**. While **XML source** or **Metadata** is open, that left-hand editor owns unfinished input and the project panel shows a navigation hint. Return to **Reading text** to resume project forms. Changing views requires applying or cancelling the current input; **Working copy** can preserve it unfinished.

Companions are snapshots rather than live filesystem subscriptions. If another application changes a file, attach its current version again. A reference check can establish consistency only for the attached documents. Deletion protection includes identifiers in the removed entry's complete subtree, but cannot discover references in files that have not been attached. Reassigning a companion role retains the former file without that role; colliding filenames are refused.

## Transcription and commentary

**Transcription** presents diplomatic and normalized readings for the current navigation unit. Each row identifies an existing TEI word. For a simple word, changing **Diplomatic reading** changes both its text and `w/@orig`; **Normalized reading** changes `w/@norm`. Words containing inline markup retain that markup, and their diplomatic text is edited through XML source. The normalization field remains available. Existing `choice`, abbreviation, correction, and other inline structures participate in the shared reading projection.

Normalization is an editorial assertion entered by the user. The workspace supplies no lexical normalization rules and does not generate normalized readings during PAGE import. XML identifiers and facsimile links remain unchanged when a word reading changes.

**Commentary** creates entries in a top-level `standOff/listApp`. A new entry inserts two unique boundary `anchor` elements around the selected source passage and records them in `app/@from` and `app/@to`. This follows TEI's double-end-point apparatus mechanism. The project offers `comment_edition` for editorial comments and `comment_understanding` for interpretative comments. Existing apparatus types remain available with their encoded values. Each note retains its own text, `xml:lang`, and `resp`. [TEI `app`](https://www.tei-c.org/release/doc/tei-p5-doc/en/html/ref-app.html)

To add a comment, select **New apparatus comment**, enter the first and last word IDs or use **Select a word range**, choose the comment type, and enter at least one note. Apply creates the anchors and apparatus entry in one transaction. Existing comments display their anchor IDs for boundary correction. Removing an entry removes its apparatus record; its source anchors remain available to other annotations.

## Shared persons, places, and peoples

The three registers are held in the top-level `standOff` of `registers.xml`:

| Register | Container and entry | Preferred name | Authority links |
| --- | --- | --- | --- |
| Persons | `listPerson/person[@xml:id]` | `persName` | `idno[@type]` |
| Places | `listPlace/place[@xml:id]` | `placeName` | `idno[@type]` |
| Peoples | `listOrg[@type='peoples']/org[@type='people'][@xml:id]` | `orgName` | `idno[@type]` |

The peoples register identifies named collective entities represented in the edition. TEI permits `org` for a tribe or other identifiable grouping of people. The values `peoples` and `people` distinguish this project's register and its entries; they are local classification terms. Assigning a passage to an entry records the editor's identification and does not establish a historical group's membership or homogeneity. [TEI `org`](https://www.tei-c.org/release/doc/tei-p5-doc/en/html/ref-org.html)

Use **Linked project documents → New shared registers** to create the file, or open an existing file for editing. In **Registers**, choose a kind, supply a stable XML ID and name, and add known authority identifiers. The form includes GND, Wikidata, and GeoNames fields and retains existing authority types. An identifier is stored as supplied; entering it does not perform authority reconciliation or certify its identity. An existing entry's kind and XML ID remain fixed in the form.

To annotate a text passage, open the codex, attach the register file, and choose **Registers**. Select the entry and the first and last words. Apply creates a span in `standOff/spanGrp[@type='register-links']`, with `@from` and `@to` pointing to codex word IDs and `@ana` holding a relative target such as `registers.xml#entry-id`. The span covers both endpoint words. The entry selector uses all three register kinds. Repeated and overlapping mentions remain independent spans.

Image records use their existing `listPerson[@type='related']/person/@corresp` and `listPlace[@type='related']/place/@corresp` fields for shared person and place references. Artist attribution uses the image document's header vocabulary separately. The image form currently exposes related persons and places; it has no dedicated people-reference field.

## Bible verse alignment

Verse mappings are independent entries in `standOff/spanGrp[@type='bible-verses']`. TEI `spanGrp` groups analytical spans, while this project's `bible-verses` type identifies the interpretation carried by the group. Mappings can overlap and can relate several source passages to the same reference. [TEI `spanGrp`](https://www.tei-c.org/release/doc/tei-p5-doc/en/html/ref-spanGrp.html)

| Field | Encoding |
| --- | --- |
| First and last transcription words | `span/@from` and `span/@to`, inclusive word references |
| Displayed book, chapter, and verse | `span/@n` and text of `ref[@type='vulgate']` |
| Declared canonical reference string | Optional `ref[@type='vulgate']/@cRef`; new or changed values require an explicit, unambiguous header `refsDecl/cRefPattern` contract |
| Supplied Latin passage | `note[@type='vulgate']/quote[@xml:lang='la']` |
| Reference edition and editorial comment | A separate `note` |
| Responsibility | `span/@resp` |

In **Bible verses**, create a mapping, select the word range, and enter a reference according to the Vulgate edition being cited. Record that edition in **Comment and reference edition**. Psalm and other edition-dependent numbering must follow the cited source. The interface accepts the supplied reference string and does not silently translate between numbering systems. Latin text is optional and must be supplied from the reference edition; the application neither retrieves nor invents it. The current form does not provide a controlled Bible-book vocabulary or an external verse concordance.

A free reference remains in `span/@n` and the reference text. It does not automatically acquire `@cRef`: TEI associates that attribute with a header-declared canonical reference scheme. Existing `cRef` values survive unrelated edits unchanged. A supplied declaration remains an editorial contract; the editor does not certify the cited edition or evaluate arbitrary XPath replacement rules. [TEI canonical references](https://www.tei-c.org/release/doc/tei-p5-doc/en/html/ref-att.cReferencing.html)

## Image annotation contract

Image annotations remain in their separate TEI file. An annotation is an identified `item` inside `list[@type='image-annotations']`, conventionally with subtype `miniatures`. Its `@corresp` points to an `ImageRegion` zone in the attached codex. These project-specific local fragments are interpreted against that companion, even though they are stored in the image file. Their cross-file meaning therefore requires both documents and this project contract.

Paths in the following table are relative to the annotation `item`.

| Form field | Source field | Notes |
| --- | --- | --- |
| Image zone ID | `@corresp` | `#zone-id`; resolved against the attached codex |
| Image title | `title` | Responsibility in `title/@resp` |
| Short description | `note[@type='description'][@subtype='short']` | Separate `@resp`; existing `@anchored` retained |
| Full description | `note[@type='description'][not(@subtype)]` | Separate `@resp`; existing `@anchored` retained |
| Artist references | `listPerson[@type='artists']/person/@corresp` | Repeated entries; attribution responsibility on the list |
| Related persons | `listPerson[@type='related']/person/@corresp` | Repeated shared-register references |
| Related places | `listPlace[@type='related']/place/@corresp` | Repeated shared-register references |
| Height and height unit | `dimensions/height` and its `@unit` | Existing units are retained; `line` is a form hint |
| Folio and lines on folio | `ref[@type='folio']/@target` and `@n` | Existing project notation is retained |
| Image type and type identifier | `objectType` and its `@rend` | Project-supplied classification |
| Relation to the text | `note[@type='text-relation'][@subtype='content']` | Separate `@resp`; existing `@anchored` retained |
| Codex range | `note[@type='text-relation'][@subtype='statistic']/@corresp` | `#range(first-word-id, last-word-id)` |
| Range description | Text of the statistical text-relation note | Separate `@resp`; existing `@anchored` retained |
| ICONCLASS entries | `listRef/ref[@type='iconclass-label']` | Repeated entries, each with `@corresp`, `@resp`, and German/English `desc` children |

Open the image file and attach its codex under **Linked project documents**. In **Image annotations**, select an existing item or choose **New image annotation**. Enter the zone, descriptions, attribution, measurements, text relation, and references, then Apply. New items are appended to the existing unambiguous miniature list. The form exposes responsibility for title, descriptions, attribution, content relation, and statistical range. Existing note `@anchored` values are preserved; direct editing of those values remains an XML-source operation.

Artist choices come from identified names in the image document's header. Multiple artists can be selected. Existing unknown references remain visible so that an editor can correct them against the header. Related person and place references are entered as whitespace-separated pointers. Structured list entries with additional content cannot be silently discarded by reducing a form list.

For the statistical range, use **First image-related word** and **Last image-related word**, or the attached-codex word picker, then press **Set text range** and Apply. The project checks that endpoints resolve uniquely to TEI words and occur in source order. In the codex's **Transcription** section, **Images referring to this word** lists attached image records whose resolved range includes the selected word. Opening one makes the image document editable at that record.

**Show miniature facsimile** uses the attached codex's surface and zone to focus the shared viewer on the image region. It requires a resolvable graphic URL or a project image resolver. An available zone reference alone does not guarantee that the image service or local image file can be loaded.

Each ICONCLASS entry carries its own URI, German label, English label, and responsibility. **Look up ICONCLASS** runs only after an explicit search or notation request. Selecting a result fills the new-entry fields; Apply writes the annotation. Manual entry remains available if the service fails. The external API supports search and retrieval; the stored labels are annotation data and are not refreshed automatically on reopening the file. [ICONCLASS API documentation](https://iconclass.org/help/api)

## PAGE XML import

**Import PAGE XML** creates a separate TEI draft from selected Transkribus PAGE files. Select the PAGE XML files, optionally select their METS file, enter a title, and choose the order when METS is absent. Press **Create TEI draft**, inspect the reported warnings, and save the new draft under its own filename. This operation does not merge books into the existing codex or replace its transcription. The Wenzelsbibel import marks the new TEI document with `type="wenzelsbibel-transcription"` so that reopening it retains the project workspace.

PAGE represents image geometry, region reading order, and text at several levels. The importer respects explicit region `ReadingOrder`, nested region placement, and available line order. It uses exact line `TextEquiv/Unicode` text; when all word readings reproduce that line with single-space separators, it can retain word-level tokens. Disagreement preserves the exact line reading and produces a warning. Without line Unicode, complete word Unicode is joined with explicit single-space separation and a warning. Alternative readings and unmapped metadata remain available in the original PAGE files. [PRImA PAGE example](https://www.primaresearch.org/schema/PAGE/gts/pagecontent/2017-07-15/Simple%20PAGE%20XML%20Example.pdf)

With METS, the importer uses the selected document's structural-map file references to order the selected PAGE files. It prefers a physical or manuscript structural map and otherwise accepts a sole structural map; unresolved or ambiguous selections fail. Without METS, the user chooses natural filename order or the order of the selected files. The chosen ordering rule is recorded in the TEI header. The import reads only supplied local files. [Library of Congress METS overview](https://www.loc.gov/standards/mets/METSOverview.html)

| PAGE data | TEI result |
| --- | --- |
| Image size and filename | `facsimile/surface` extents and `graphic/@url`, width, height |
| Region, line, and available word geometry | Identified `zone` elements with source type and valid polygons |
| Page sequence | `pb/@facs` pointing to each surface |
| Region text and line boundaries | `ab/@facs` and `lb/@facs`; `w/@facs` where word text agrees |
| Source identifiers | Stable filename-prefixed XML IDs; original geometry IDs retained in `@n` |
| PAGE custom annotations and baselines | Target-linked source notes in `standOff` |
| Degenerate coordinates | Target-linked coordinate notes with a warning; no invented polygon |
| Creator and Transkribus status, when present | Source bibliography notes in the header |

The importer preserves `imageFilename` exactly. A Transkribus prefix such as `0001_00000145.jpg` may not match a configured digitization-service identifier. The warning calls for matching local images or an explicit resolver; the importer does not remove the prefix automatically. Its provenance statement attributes deterministic transfer to teiCrafter and identifies the transcription as requiring editorial review, including any HTR content and prior source edits. It creates neither diplomatic/normalized variants nor interpretative annotations from PAGE custom labels.

## Validation and editorial review

The default Wenzelsbibel schema set combines the application's pinned TEI All schema with [the local Wenzelsbibel editorial profile](../docs/schemas/wenzelsbibel-editorial.sch). An explicit schema declared by the project takes precedence. The source edition refers to `Bilderfassung.sch`, whose original file was unavailable. The local `wenzelsbibel-editorial.sch` is a separately named, teiCrafter-authored draft derived from supported fields and observed data. It makes no claim to reproduce the missing rules.

| Layer | Purpose | Effect |
| --- | --- | --- |
| XML and TEI All validation | Check XML structure and the selected TEI content model | Required for schema-authorized Save and Download |
| Editorial `editing` phase | Require the Wenzelsbibel TEI root while allowing incomplete annotation records | Default project phase, paired with TEI All |
| Editorial `review` phase | Check image-record completeness and local reference conventions | Explicit **Check editorial completeness** action in **Project checks** |
| Companion checks | Resolve codex image zones/ranges, apparatus boundaries, and shared-register references | Findings apply to currently attached document snapshots |
| Scholarly review | Assess readings, entities, verse alignment, descriptions, and attribution | Remains an editorial responsibility |

The review phase checks nonempty title, short and full description, folio target, positive height, artist attribution resolving to header responsibility names, bilingual ICONCLASS labels with targets, and nonempty syntactically correct statistical ranges. It does not require a statistical range or an ICONCLASS entry where no such record exists. The profile does not judge the accuracy of their content. Cross-document resolution is performed by the companion checks because the Schematron does not load the codex.

**Project checks** also identifies unresolved apparatus endpoints and register references. **Keep sole reading** is an explicit repair for an attribute-free `choice` containing a single supported branch: it removes that redundant choice wrapper while retaining the existing reading. The action invents no missing alternative. Other structures require inspection in XML source.

Save and Download validate the exact proposed XML revision. RelaxNG and XSD compilation and validation run in a dedicated browser worker. A bounded in-memory cache reuses a successful decision only for the identical XML and complete schema dependency graph, identified by SHA-256. A changed source or schema requires validation. **Cancel validation** in the validation details and the project export's cancellation control terminate pending worker work and cannot authorize a download. Status distinguishes schema preparation, XML parsing, validation and exact-result reuse. The explicit editorial review action is separate from the editing-phase save gate.

## Applying, preserving, and reopening work

Form changes remain staged until **Apply** succeeds. **Cancel** restores the represented source values. Changing records, sections, navigation units, or documents requires applying or cancelling unfinished input first. Applied changes enter the active document's undo history. A read-only session disables mutation controls.

Recovery includes all attached project documents, their settings and images, and supported unfinished input in the active file. **Working copy** version 2 preserves this state even when TEI output cannot pass its schema; version 1 remains readable. Neither recovery nor a working copy carries an output authorization or filesystem permission. XML/SVG image attachments remain recoverable in Working copy; Project package refuses them because the image channel cannot provide their own XML schema decision.

For a complete editorial pass, export and reopen the project package; inspect transcription, comments, verse alignment, images and registers; and rerun project checks plus editorial completeness review. Use Working copy to preserve any unfinished or invalid state. Successful schema validation establishes formal validity for the selected rules and source revision; scholarly verification and user acceptance remain separate statements.

## Implementation boundaries

The workspace and form modules coordinate the existing editor. `wenzels-text-model.js`, `wenzels-image-model.js`, and `wenzels-register-model.js` operate on source ranges. `wenzels-project-checks.js` resolves relationships and supports explicit repairs. `page-xml-import.js` provides a reusable deterministic importer, while `page-xml-onramp.js` supplies its local file interface. The generic editor continues to own document sessions, raw XML, output authorization, and recovery.

The current model leaves edition-dependent judgments visible: authority identification, artist-vocabulary reconciliation, normalization policy, interpretation of existing apparatus types, reference-edition numbering, and whether a miniature has a statistical text relation. It supplies no automatic codex fusion, external Latin-text corpus, or live multi-document collaboration. These boundaries preserve explicit editorial control over assertions that cannot be inferred reliably from the available source files.
