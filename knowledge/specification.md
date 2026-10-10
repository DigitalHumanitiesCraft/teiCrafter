---
title: teiCrafter Specification
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
status: draft
created: 2026-02-05
updated: 2026-10-10
language: en
topics: ["[[Requirements Engineering]]", "[[TEI XML]]", "[[Decision Records]]"]
related: [project, data, architecture, design, testing, journal, converter-reference]
---

# teiCrafter Specification

This specification covers the source-first core under `src/`. The normative behaviour of the base application under `docs/` is the [specification at revision 6d720a6](https://github.com/DigitalHumanitiesCraft/teiCrafter/blob/6d720a632e5ad307e98d7eae536b3d7e8a981bbd/knowledge/specification.md).

teiCrafter is a browser-based TEI XML editor whose primary surface is the XML source in a code editor. It serves three tasks, creating a TEI document from plain text, editing an existing TEI XML file and reading one. In all three the raw XML string is the canonical state and Save returns the original bytes outside deliberate edits, because a scholarly source must leave the editor unchanged except where someone edited it on purpose. Well-formedness is checked continuously, schema validation runs on demand, and proposals from a Large Language Model (LLM) form an optional layer on which the human decides.

## Source fidelity

- F.1 The complete XML source string is the canonical document state. Parse trees, editor state and rendered views derive from it and are rebuilt after every change.
- F.2 Opening a supported file and saving it without an edit returns the identical byte sequence, including an optional byte order mark and the original line endings. A deliberate edit changes only the source ranges it addresses.
- F.3 Positions in the code editor translate exactly to offsets in the raw string, including documents with CRLF line endings. The editor component counts a CRLF as one position, so every edit, fold, diagnostic and proposal passes through this translation before it addresses bytes.
- F.4 The file boundary decodes and re-encodes UTF-8 with an optional byte order mark. A file in another encoding, or with an XML declaration that contradicts its bytes, is rejected before editing with a message that names the encoding found.
- F.5 Typing in the source inserts exactly the typed characters. Where the editor inserts text as character data on the user's behalf, as in the plain text starter or a literal replacement, it escapes markup-significant characters and rejects characters that XML 1.0 forbids. Existing entity and character references keep their spelling unless an edit covers them.
- F.6 Elements count as TEI by the namespace URI `http://www.tei-c.org/ns/1.0`, whatever prefix the document binds to it. Foreign elements with the same local name keep their prefix in every view and fall outside the TEI default folds.
- F.7 Each opened document has its own session with revision, saved-state marker and undo history. Undo and redo restore the exact earlier source string, and returning to the saved revision clears the unsaved state. Results of asynchronous work that belong to another session or an earlier revision are discarded.
- F.8 Save through a native file handle first compares the file on disk with the version last read or written. When the file changed outside the editor, Save writes nothing and offers reload or saving under another name.

## Creation from plain text

- C.1 Opening a `.txt` or `.md` file through the file picker or by drop creates a TEI document deterministically, so the same input always yields the same output.
- C.2 Blank lines separate paragraphs. Each further line inside a paragraph begins with `lb`, a token `|N|` with ASCII digits becomes `pb` with `n="N"`, and all other text is carried verbatim. CR and CRLF in the input count as line breaks.
- C.3 The starter carries a minimal TEI header whose title derives from the file name, and it opens as an unsaved document in the same editor as any TEI file. The first Save writes a new `.xml` file and leaves the plain text source untouched.
- C.4 Deterministic creation carries no LLM provenance. LLM proposals may refine the starter afterwards under the L requirements.

## Source work

- S.1 The whole document is present in one source view. Every part of the source is reachable by scrolling, search or unfolding.
- S.2 Any element with content can be folded from the end of its start tag to the start of its end tag. Folding changes the view only.
- S.3 On opening, the elements `teiHeader`, `facsimile`, `standOff`, `listPerson`, `listPlace`, `revisionDesc` and `sourceDoc` are folded. A folded element shows a one-line placeholder that summarises its content, such as its first child elements or the beginning of its text.
- S.4 Folding and unfolding at the cursor work by keyboard. Repeated folding at the same place moves outward to the parent element, and one command restores the default folds.
- S.5 The element path at the cursor shows the ancestor chain from the root to the innermost element. Choosing a step selects that element.
- S.6 Two markup view levels present the same source. Source shows full syntax highlighting, and reading reduces markup to unobtrusive marks so that the text reads continuously. Switching levels keeps source, cursor, folds and undo history.
- S.7 Find and replace covers the whole source including folded ranges, with literal and regular-expression matching. A hit inside a folded element unfolds it, and replacing all hits forms one undo step.
- S.8 Formatting applies to the element at the cursor and opens a before and after comparison first. Confirming applies it as one undo step. Formatting changes whitespace only, uses the document's line ending, and leaves any element with mixed content and its descendants untouched, because whitespace inside mixed content belongs to the text.
- S.9 An optional outline beside the editor lists the document's elements as a tree. Choosing an entry moves the cursor to that element, and a focus command folds everything outside it until focus ends and the previous folds return.
- S.10 Reading changes nothing. Folding, view levels, the element path, the outline and search without replacement leave source, revision, saved state and undo history unchanged.

## Validation

- V.1 Well-formedness is checked after every pause in editing. The status shows either a well-formed document or the first error with its message, the error line is marked in the source, and the cursor can jump to it.
- V.2 Schema validation runs on demand. The vendored TEI P5 TEI All RelaxNG applies by default, and the user may load a RelaxNG or XSD schema from a local file for the session. The status names the schema in effect.
- V.3 Each schema diagnostic appears with its message in a list and as a mark at its source line. Choosing a diagnostic moves the cursor there.
- V.4 A result belongs to the source revision and the schema it was computed for. After an edit or a schema change the previous result is shown as outdated until the next run.
- V.5 A schema that cannot be loaded, resolved or compiled yields the state unavailable with its reason, which the interface keeps distinct from invalid.
- V.6 Schema compilation and validation run outside the main browser thread, because TEI All compilation is slow enough to block typing. A running validation can be cancelled, and a later request remains possible.

### Open decision on Save

Whether schema errors block Save is undecided. The options are:

1. Save and Download require a current valid result for the exact output bytes, so that invalid or unvalidated XML never leaves the editor (fail-closed).
2. Save stays available in every validation state, the status keeps the state visible, and the first Save of a document with an invalid, outdated or missing result asks for one confirmation per session.

## LLM proposals

- L.1 LLM proposals are optional, controlled by a build default and a per-user setting. With them off the editor is fully deterministic and every requirement outside this group holds unchanged.
- L.2 A proposal is a splice of source range, replacement and rationale, computed for one source revision. A response whose range lies outside the document or whose revision is outdated is discarded with a visible message.
- L.3 A pending proposal shows its target range, replacement and rationale in the violet provenance family together with Accept and Reject. The source stays unchanged until Accept.
- L.4 Accept applies the replacement as one undo step, and Reject discards the proposal. An edit that touches the target range withdraws a pending proposal, because the proposal no longer describes the text it was computed from. Edits elsewhere move it along.
- L.5 Accepted text keeps an origin marker in the violet family for the rest of the session, moved along with later edits. The marker belongs to the editing session and adds no markup to the source.
- L.6 Built-in providers coexist with a configurable OpenAI-compatible endpoint, which may be local. Application code may register validated adapters for nonstandard protocols. Endpoints use HTTP or HTTPS without embedded credentials.
- L.7 The API key is held in memory only and never reaches storage, the URL or the source. Requests omit browser ambient credentials such as cookies.

## Browser and interface

- B.1 The browser runtime needs no backend. LLM requests go from the browser to the configured endpoint.
- B.2 Native open and in-place Save through the File System Access API appear only after a capability check, which Chromium passes.
- B.3 File input and download work in Chromium and Firefox and produce the exact bytes required by F.2. Save without a writable native handle falls back to download.
- B.4 Every command is operable by keyboard with visible focus and accessible names. Changes of well-formedness, validation and save state are announced to assistive technology, and no state relies on colour alone.
- B.5 The interface carries no decorative counters and no standing explanatory prose. Information sits in the controls and status elements themselves.

## Acceptance scenarios

| Scenario | Observable outcome |
| --- | --- |
| No-op round trip | A TEI file with byte order mark and CRLF line endings is opened and saved, and the saved bytes equal the original |
| Local edit | One edit in a CRLF document changes exactly the edited range, and Undo restores the original string |
| Unsupported encoding | A UTF-16 file or a conflicting declaration is refused before the editor opens, with the encoding named |
| External change | The file is modified on disk during editing, and Save writes nothing and offers reload or another name |
| Plain text to TEI | A text with paragraphs and `\|N\|` markers yields `p`, `lb` and `pb` deterministically, and the first Save creates a new `.xml` file |
| Default folds | A document opens with the listed elements folded to summarising placeholders, and the body text is visible |
| Mixed content formatting | Formatting an element with mixed content leaves it byte-identical, and an element-only element changes whitespace only after the comparison is confirmed |
| Well-formedness error | Deleting an end tag marks the error line within one editing pause, and repairing it clears the mark |
| Schema validation | TEI All and a user-supplied RelaxNG or XSD each report diagnostics at their lines, and an edit marks the result outdated |
| Proposal decision | A pending proposal appears in violet, Reject leaves the source unchanged, Accept splices it as one undo step with an origin marker |
| LLM off | With proposals disabled every other scenario passes and no provider request occurs |
| Firefox path | A file opened through file input in Firefox downloads with the exact bytes |
| Keyboard only | Opening, folding, validating, accepting a proposal and saving succeed without a pointer |

## Key decisions

### Legacy application as derivable base, 2026-10-10

Project-specific versions of teiCrafter are needed before the source-first editor carries an application, and the first of them, wenzelsbibel-teiCrafter, builds on the legacy application. The application under `docs/` therefore stays the derivable base from which such versions are forked, and the retirement of its projection and workspace clusters is suspended until the new editor can take over that role. This specification covers the source-first core under `src/`. The base keeps the normative behaviour recorded in the [specification at revision 6d720a6](https://github.com/DigitalHumanitiesCraft/teiCrafter/blob/6d720a632e5ad307e98d7eae536b3d7e8a981bbd/knowledge/specification.md), and changes to the base stay limited to generic mechanisms a derivation needs and to bug fixes.

### Source-first editor, 2026-10-04

The reading projection as home surface and the per-project workspaces exceeded the product the operator wants, a browser editor for creating TEI from plain text, editing existing TEI XML and reading it, with well-formedness and schema validation always visible and LLM proposals as an optional, marked layer. The XML source becomes the primary surface on a code-editor component. The exact-source core stays, and the projection and workspace clusters are retired once the new editor covers open, edit and save. Whether schema validation gates Save or only reports remains open.

### Origin stays separate from acceptance, 2026-09-05

Accepting a proposal records a human decision, while the accepted text still came from an LLM. The editor therefore keeps the origin of accepted text visible apart from the act of acceptance.

### Open provider boundary, 2026-08-24

Editorial projects need local and nonstandard LLM services. A configurable endpoint and a code-level adapter seam support those services, while keys stay in memory.

### Cross-browser fallback, 2026-08-24

Native file handles are a browser capability that Firefox lacks. File input and direct download form the portable path across Chromium and Firefox.

### Exact source mutation, 2026-02-05

Browser XML serializers can change scholarly source beyond an intended edit. teiCrafter therefore treats the raw XML string plus offsets as canonical state.

## Related

[Project](project.md) defines the editorial purpose and [Data](data.md) the encoded forms. [Architecture](architecture.md) maps these requirements to modules, [Design](design.md) governs their visual form, and [Testing](testing.md) defines how they are verified. The [Journal](journal.md) records how the decisions came about. The SZD Page-JSON to TEI conversion is a separate deliverable governed by the [Converter reference](converter-reference.md).
