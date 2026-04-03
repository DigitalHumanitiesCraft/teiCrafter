# teiCrafter -- Architecture, Design, and Workflow Specification

Last updated: 2026-04-03

This document consolidates the system architecture, visual design system, and annotation workflow specification for teiCrafter, a browser-based TEI-XML annotation tool for Digital Humanities research. It merges content previously maintained in three separate German-language documents (ARCHITECTURE.md, DESIGN.md, WORKFLOW.md) into a single English-language reference.

---

## 1. System Overview

teiCrafter is a client-only application deployed via GitHub Pages. There is no backend server. All processing -- including LLM-based annotation, schema validation, and document management -- runs entirely in the browser. External LLM APIs are called directly from the client via HTTPS.

### 1.1 Four-Layer Architecture

```
+--------------------------------------------------------------+
|                          BROWSER                             |
+--------------------------------------------------------------+
|  UI LAYER                                                    |
|  +----------+  +----------+  +----------+  +----------+      |
|  |  Header  |  |  Source   |  |  Editor  |  | Preview  |      |
|  | +Stepper |  |  Panel   |  |  (XML)   |  | +Review  |      |
|  +----------+  +----------+  +----------+  +----------+      |
+--------------------------------------------------------------+
|  APPLICATION LAYER                                           |
|  +----------+  +----------+  +----------+  +----------+      |
|  | Document |  | Schema   |  |Transform |  |  Export  |      |
|  |  Model   |  |  Engine  |  |  Service |  |  Service |      |
|  +----------+  +----------+  +----------+  +----------+      |
+--------------------------------------------------------------+
|  SERVICE LAYER                                               |
|  +----------+  +----------+  +----------+  +----------+      |
|  |  LLM API |  | ODD      |  | Validator|  |  Event   |      |
|  |          |  | Parser   |  |          |  |  System  |      |
|  +----------+  +----------+  +----------+  +----------+      |
+--------------------------------------------------------------+
|  PERSISTENCE LAYER                                           |
|  +------------------+  +----------------------------+        |
|  |  LocalStorage    |  |       IndexedDB            |        |
|  |  (Settings,      |  |  (Documents, Sessions,     |        |
|  |   API Keys)      |  |   Undo History)            |        |
|  +------------------+  +----------------------------+        |
+--------------------------------------------------------------+
                              | HTTPS
                              v
+--------------------------------------------------------------+
|  EXTERNAL APIs                                               |
|  +----------+  +----------+  +----------+  +----------+      |
|  |  Gemini  |  |  OpenAI  |  | Anthropic|  |  Ollama  |      |
|  +----------+  +----------+  +----------+  +----------+      |
+--------------------------------------------------------------+
```

### 1.2 Technology Decisions

| Decision | Rationale |
|---|---|
| No framework | Reduces complexity, improves longevity |
| ES6 modules (native) | Native browser support, no bundler required |
| EventTarget for state | Native API, DevTools integration, no custom event bus |
| CSS custom properties | Theming without a preprocessor |
| Fetch API | Native, sufficient for REST calls |
| No backend | Data sovereignty, zero hosting costs, Ollama as a local option |

**Exception candidate: CodeMirror 6.** If the editor engine decision (Section 5) migrates to CodeMirror 6, it would be the sole external dependency (~150 KB). This exception is justified because the editor is the most critical component, and a custom implementation of autocompletion, gutter rendering, and performance optimization would exceed the cost of adopting the library.

### 1.3 LLM Providers

| Provider | Endpoint | Authentication | Vision |
|---|---|---|---|
| Gemini | generativelanguage.googleapis.com | URL parameter | Yes |
| OpenAI | api.openai.com | Bearer token | Yes |
| Anthropic | api.anthropic.com | x-api-key header | Yes |
| Ollama | localhost:11434 | None (local) | Model-dependent |

API keys are held in browser memory (module-scoped Map in llm.js). They are never written to localStorage or sent to any backend. Keys are volatile: closing the tab discards them. They are visible in DevTools. Ollama provides a fully local alternative requiring no API key.

---

## 2. File Structure

```
docs/
|-- index.html                  (  82 lines)  Entry point, three-column layout
|-- css/
|   +-- style.css               (2642 lines)  TEI color system, fonts, all components
|-- js/
|   |-- app.js                  ( 956 lines)  Initialization, workflow stepper
|   |-- model.js                ( 247 lines)  Reactive document model, undo/redo
|   |-- tokenizer.js            ( 199 lines)  XML tokenizer (pure function)
|   |-- editor.js               ( 242 lines)  XML editor (overlay technique)
|   |-- preview.js              ( 501 lines)  Interactive preview + review
|   |-- source.js               (  67 lines)  Source panel (plaintext, facsimile)
|   |-- services/
|   |   |-- llm.js              ( 343 lines)  Multi-provider LLM service
|   |   |-- transform.js        ( 223 lines)  Transform logic (prompt, parsing, confidence)
|   |   |-- schema.js           (  93 lines)  ODD-based schema guidance
|   |   |-- validator.js        ( 303 lines)  Schema validation
|   |   |-- export.js           ( 165 lines)  Export service (TEI-XML, TXT)
|   |   +-- storage.js          (  68 lines)  LocalStorage/IndexedDB wrapper
|   +-- utils/
|       |-- constants.js        ( 117 lines)  Configuration values
|       +-- dom.js              ( 171 lines)  DOM utilities
|   +-- pipeline/
|       |-- utils.js            (  70 lines)  XML escaping, element builder
|       |-- mods-to-header.js   ( 180 lines)  Page-JSON metadata -> teiHeader
|       |-- page-to-body.js     ( 130 lines)  Pages + regions -> TEI elements
|       |-- div-structurer.js   ( 100 lines)  Heading heuristic for div sections
|       |-- tei-assembler.js    (  30 lines)  Full TEI assembly orchestrator
|       +-- pipeline-validator.js( 150 lines)  Tag matching, plaintext check
|-- schemas/
|   +-- dtabf.json              ( 330 lines)  Schema profile (interactive + pipeline)
|-- data/
|   +-- demo/
|       |-- expected-output/    Reference TEI-XML outputs
|       |-- mappings/           Mapping templates per source type
|       +-- plaintext/          Sample plaintext inputs
+-- tests/
    |-- test-runner.html        ( 150 lines)  Test harness
    |-- model.test.js           ( 203 lines)  DocumentModel unit tests
    |-- tokenizer.test.js       ( 183 lines)  Tokenizer unit tests
    |-- validator.test.js       ( 116 lines)  Validator unit tests
    +-- visual-matrix.html      ( 459 lines)  Visual confidence/entity test matrix
pipeline.mjs                    ( 190 lines)  Node.js CLI for batch Page-JSON -> TEI
Plan.md                         Pipeline mode plan (Phase P)
```

### 2.1 Pipeline Mode Architecture

The pipeline mode runs as a Node.js CLI (`pipeline.mjs`) outside the browser. It reuses the ES6 modules under `docs/js/pipeline/` which are designed to work in both Node.js and browser contexts.

```
szd-htr Page-JSON v0.2
        |
        v
+-- mods-to-header.js -----> teiHeader (deterministic)
|       MODS fields -> titleStmt, sourceDesc/msDesc,
|       profileDesc, encodingDesc, revisionDesc
|
+-- page-to-body.js -------> flat element list
|       regions -> head/p/table/note/fw
|       no regions -> paragraphs by double-newline
|
+-- div-structurer.js -----> nested div structure
|       letters: single div
|       others: split at each <head>
|
+-- tei-assembler.js ------> complete TEI-XML
|
+-- pipeline-validator.js -> validation report
        tag matching + structure check + plaintext preservation
```

---

## 3. Data Flow

### 3.1 Import-Transform-Review-Export

```
TEI-XML Import
      |
      v
  DocumentModel (Version 0: source text)
      |
      v
  [Transform: LLM annotation]
      |
      v
  DocumentModel (Version 1: annotated, with confidence)
      |
      v
  [Review: Accept / Edit / Reject per annotation]
      |
      v
  DocumentModel (Version N: reviewed)
      |
      v
  Export (TEI-XML, without confidence metadata)
```

### 3.2 Synchronization Flow

All panels are projections of the same document state. A selection in one panel updates the others. There is no direct communication between views; every view registers as an observer of the model.

```
User clicks annotation in Preview
       |
   preview.onClick(elementId)
       |
   model.setSelection(elementId)
       |
   Event: 'selectionChanged'
       |
   +---+---------------+----------------+
   v               v                v
 Editor          Preview        Attribute Tab
 .scrollToLine() .highlight()   .showAttributes()
 .setCursor()    (source)
```

| Action | Editor | Preview | Source |
|---|---|---|---|
| Click annotation in Preview | Scrolls to line, positions cursor | Annotation selected | Scrolls to corresponding text position |
| Cursor on element in Editor | Active line highlighted | Annotation highlighted | -- |
| Click validation error | Scrolls to line | Error location highlighted | -- |

---

## 4. Reactive Document Model

### 4.1 Single Source of Truth

All views (XML editor, preview, validation, review, attribute tab) are projections of a shared document model. There is no direct communication between views. Each view registers as an observer of the model. This prevents cycles and guarantees consistency.

### 4.2 Four State Layers

The document model maintains four state layers that together constitute a document version.

| Layer | Content | Produced by | Modified by |
|---|---|---|---|
| **Document** | TEI-XML tree (canonical representation) | Import, Transform | Editor, Review actions |
| **Confidence** | Confidence category per annotated element (confident, review-worthy, problematic, manual) | Transform (LLM), manual annotation | Review (Accept -> confident, Reject -> removed, Edit -> manual) |
| **Validation** | List of messages with document positions | Schema validation (automatic) | Recalculated on every document change |
| **Review status** | Per review-worthy/problematic element: open / accepted / edited / rejected | Transform (all "open") | Review actions |

### 4.3 State Propagation

```
User action (Editor or Preview)
        |
        v
  DocumentModel (new version)
        |
        +-->  XML Editor: update syntax highlighting
        +-->  Preview: re-render text and annotations
        +-->  Validation: trigger schema check
        +-->  Review: update status
```

The validation layer is recalculated on every document change but never interrupts editing. Invalid states are normal during editing and are tolerated. Errors are visually marked but do not block any actions.

### 4.4 Observer Pattern via EventTarget

The document model is implemented as a class extending EventTarget (native browser API, no library). Every state change fires a typed event.

| Event | Payload | Trigger |
|---|---|---|
| `documentChanged` | `{ version }` | Any change to the XML tree |
| `selectionChanged` | `{ element, line }` | Click in editor or preview |
| `confidenceChanged` | `{ elementId, category }` | Review action |
| `validationComplete` | `{ messages[] }` | Schema check completed |
| `reviewAction` | `{ elementId, action }` | Accept / Edit / Reject |
| `transformComplete` | `{ annotationCount, reviewCount }` | LLM annotation completed |
| `undoRedo` | `{ direction, version }` | Undo or Redo |

### 4.5 Undo/Redo Specification

**Principle.** The undo system operates on the document model, not on the UI layer. This is necessary because a single action (e.g., Accept in review) simultaneously modifies the XML tree (annotation becomes permanent), the confidence layer (status changes to "confident"), and the review status (changes to "accepted"). Undo must restore all three layers together.

**Implementation.** Every user action that modifies the document state produces a snapshot of the entire model (document + confidence + review status) on the undo stack. An undo step restores the previous snapshot.

**Grouping.**

| Action type | Grouping |
|---|---|
| Individual keystrokes in the editor | Grouped into word units (pause >500 ms or whitespace separates) |
| Accept / Edit / Reject of a single annotation | Single undo unit |
| Transform (LLM annotation of the entire document) | Single undo unit, so the user can revert the entire transformation in one step |

**Storage limit.** The undo stack holds a maximum of 100 entries. When exceeded, the oldest entry is discarded. For large documents (>1000 lines) snapshot size may become relevant; a diff-based undo system can be evaluated in that case. For the prototype, the snapshot approach is sufficient.

---

## 5. Editor Engine

### 5.1 Requirements

| Requirement | Priority | Complexity |
|---|---|---|
| Syntax highlighting for XML | High | Low |
| Confidence markers in the gutter (3 px colored bar per line) | High | Medium |
| Cursor coupling with preview (click -> scroll) | High | Medium |
| Schema autocompletion (context-sensitive) | Medium | High |
| Inline validation (underlining invalid elements) | Medium | Medium |
| Line numbers | High | Low |
| Undo/redo (coupled to document model) | High | Medium |
| Performance for documents >500 lines | High | Varies |

### 5.2 Decision Analysis

**Option A: Overlay technique.** Transparent textarea over a colored pre element. Custom XML tokenizer.

| Advantage | Risk |
|---|---|
| Zero dependencies | Scroll drift on long documents |
| Full control over rendering | Cursor position mapping between textarea and pre is complex |
| Consistent with vanilla JS philosophy | Autocompletion positioning is complex |
| | Performance at >500 lines unclear |

**Option B: CodeMirror 6.** Modular editor with its own extension system.

| Advantage | Risk |
|---|---|
| Proven for code editors | Dependency (~150 KB) |
| Custom tokenizers can be integrated | Learning curve for extension API |
| Gutter, autocompletion, inline decoration built in | Less control over rendering details |
| Performance optimized for large documents | Potential conflicts with custom state system |

**Option C: ContentEditable.** Direct DOM manipulation in an editable div.

| Advantage | Risk |
|---|---|
| Natural cursor behavior | Browser inconsistencies (line breaks, formatting) |
| Direct access to DOM elements | Uncontrolled HTML on paste |
| Simple cursor position detection | Custom selection logic necessary |
| | Difficult to debug |

### 5.3 Recommendation

**For the prototype (weeks).** Option A (overlay) with a limitation to documents <200 lines and without schema autocompletion. This suffices to test the transform workflow and review UX. The custom XML tokenizer is needed independently, as it also drives the preview and confidence markers.

**For production (months).** Option B (CodeMirror 6) with the custom XML tokenizer as a language support package. Schema autocompletion is implemented as a CodeMirror extension. The gutter with confidence markers uses CodeMirror's gutter API. Cursor coupling with the preview is achievable via CodeMirror's view update system.

**Not recommended.** Option C (ContentEditable) due to browser inconsistencies and the difficulty of maintaining a consistent state between DOM and document model.

### 5.4 Spike Result

The overlay spike was conducted in Stage 1 (Session 8). Result: no scroll drift at 500-line documents. The overlay technique is used for the prototype. CodeMirror 6 remains the upgrade path for the production version.

### 5.5 XML Tokenizer

Independent of the editor engine decision, a custom XML tokenizer is required. It produces token types for syntax highlighting and confidence integration.

**Token types.**

| Type | Examples | Description |
|---|---|---|
| `element` | `TEI`, `persName`, `p` | Element name within a tag |
| `attrName` | `ref`, `when`, `type` | Attribute name |
| `attrValue` | `"#schiller"`, `"1794-08-23"` | Attribute value (including quotes) |
| `delimiter` | `<`, `>`, `/>`, `=`, `</` | XML structural characters |
| `comment` | `<!-- ... -->` | Comments |
| `pi` | `<?xml ... ?>` | Processing instructions |
| `namespace` | `xmlns`, `tei:` | Namespace declarations and prefixes |
| `entity` | `&amp;`, `&lt;` | Entity references |
| `text` | Character data | Text content between tags |

**Implementation principle.** The tokenizer processes input character by character using a state machine. It is implemented as a pure function that accepts a string and returns an array of `{ type, value, start, end }` objects. No DOM access, no side effects. This enables reuse in editor, preview, and tests.

**Confidence mapping.** The tokenizer itself has no knowledge of confidence. The mapping occurs in a subsequent layer that compares token positions against the confidence annotations in the document model. Per line, the "dominant" confidence category is determined (problematic > review-worthy > confident > manual > none), which controls the gutter marker.

---

## 6. Schema Guidance

### 6.1 Principle

The ODD format (*One Document Does it all*) defines the valid TEI subset for a project. Schema guidance uses the ODD to display context-sensitively what is permitted at each position in the document.

### 6.2 Two-Stage Strategy

**Stage 1 (prototype).** Hardcoded schema guidance for a specific ODD profile (e.g., DTABf or a correspondence subset). The profile is implemented as a JSON lookup:

```json
{
  "teiHeader": {
    "allowedChildren": ["fileDesc", "encodingDesc", "profileDesc", "revisionDesc"],
    "attributes": {}
  },
  "persName": {
    "allowedParents": ["p", "ab", "seg", "name", "author"],
    "attributes": {
      "ref": { "type": "text", "description": "Reference to person register" },
      "key": { "type": "text" },
      "type": { "type": "closed", "values": ["person", "mythological", "biblical"] }
    }
  }
}
```

This allows early testing of the autocompletion and inline validation UX without having solved the ODD parsing problem.

**Stage 2 (production).** Client-side ODD parsing. ODD files are themselves TEI-XML and define, via `<elementSpec>`, `<classSpec>`, and `<constraintSpec>`, which elements, attributes, and values are permitted. The parsing produces the same JSON lookup format as Stage 1. The challenge lies in resolving inheritance hierarchies (`<memberOf>`, `<classes>`) and correctly interpreting `@mode` (add / delete / change / replace).

### 6.3 Manifestations

| Location | Behavior |
|---|---|
| Editor | Autocompletion on `<` and on attribute names. Tooltips with element documentation. |
| Attribute tab | Form fields generated from schema. Required attributes marked. Closed value lists as dropdowns. |
| Preview | (Future) When selecting text, schema guidance shows only permitted elements. |
| Validation | Live, never interrupts editing. Invalid states are tolerated. |

---

## 7. Annotation Workflow (5 Steps)

The five-step workflow is represented by the stepper in the header: Import, Mapping, Transform, Validate, Export. Each step is described below.

### 7.1 Import

**Purpose.** Load a source document into the document model.

**Supported formats.** TEI-XML is the primary format. Plaintext can be imported and wrapped in a minimal TEI structure. The system includes demo data (sample plaintext files and expected TEI-XML outputs) for testing and onboarding.

**Validation on import.** The imported document undergoes a well-formedness check via the browser's DOMParser. If the document is not well-formed XML, the user receives an error with details.

**Demo data.** The `docs/data/demo/` directory contains sample sources (plaintext), mapping templates (Markdown), and expected outputs (TEI-XML) for different source types including medieval recipes and historical bookkeeping records.

### 7.2 Mapping

**Purpose.** Define the annotation rules that guide the LLM during transformation.

**Source types.** Mapping templates are provided for common source types (correspondence, prints, bookkeeping records). Users select a template and customize it for their specific project requirements.

**Mapping rules.** A simple Markdown list that users configure in a text field. Each rule specifies a TEI element, its intended semantic scope, and optionally expected attributes:

```markdown
Mapping rules:
* <div> Entire letter
* <pb> Marks page breaks e.g. "|{n}|", multiple appearance possible
* <dateline> Date/time reference of the letter
* <date> in <dateline>
* <opener> Opening of the letter
* <closer> Closing of the letter
* <salute> Salutations within the letter
* <lb> Line breaks
* <signed> Signature section
* <postscript> Represents a postscript
* <bibl> Contains bibliographical references
* <p> Paragraphs
* <persName> Person
* <placeName> Place
* <orgName> Organisation
* <date> Dates; when={YYYY-MM-DD}
* <term> Languages
* <foreign> Words in the context of discussing linguistic phenomena
```

**Context fields.** The mapping step also captures structured metadata about the source: source type (correspondence, print, manuscript, account book), dating, language(s), author, archive/collection, and project context (e.g., "Schiller/Goethe correspondence, 1794"). This context helps the LLM make informed annotation decisions.

### 7.3 Transform

**Purpose.** Send the source text together with mapping rules and context to an LLM, which returns annotated TEI-XML with confidence annotations.

#### 7.3.1 Three-Layer Prompt Architecture

The prompt sent to the LLM is assembled at runtime from three layers. This separation keeps generic rules stable while source-specific and project-specific information can be adjusted flexibly.

**Base layer (generic).** Contains instructions that apply to every TEI transformation, regardless of source type or project. Managed by teiCrafter, not by the user.

Contents of the base layer:
- Produce well-formed TEI-XML
- Do not alter text content, only the markup structure
- Set `@confidence` as an attribute with value "high", "medium", or "low"
- Set `@resp="#machine"` to mark machine-generated annotations
- When uncertain, do not annotate (precision over recall)
- Preserve all existing annotations
- Return exclusively the annotated TEI-XML, no explanations

**Context layer (source-specific).** Contains structured metadata about the specific source that helps the LLM make informed annotation decisions. Filled in per document or per project by the user. Typical context information includes source type, dating, language(s), author, archive, and project context. Without a context layer, the LLM produces generic annotations. With it, the LLM can make better decisions -- for instance, recognizing that "Weimar" in a Schiller letter is likely a place reference.

**Mapping layer (project-specific).** Contains the project-specific annotation rules as a Markdown list (see Section 7.2). This layer is the core of user configuration because it formalizes the editorial decisions of the project.

#### 7.3.2 Prompt Transparency and Custom Prompts

The complete prompt sent to the LLM is viewable before submission (collapsible section in the transform dialog). This is necessary for methodological traceability and for advanced users who want to iteratively improve the prompt.

Advanced users can fully override the default prompt. In this case, the three-layer architecture is replaced by a free-form prompt.

#### 7.3.3 Transform Configuration

| Setting | Type | Default | Description |
|---|---|---|---|
| Model | Dropdown | Last used | Gemini, OpenAI, Anthropic, Ollama |
| Annotation types | Checkboxes | All from ODD profile | Which elements the LLM should annotate |
| Document context | Textarea (optional) | Empty | Context layer: additional context for the LLM |
| Example annotations | Toggle (optional) | Off | If enabled, first N already-annotated lines serve as few-shot examples |
| Custom prompt | Textarea (optional) | Default prompt | For advanced users |

#### 7.3.4 Progress and Cancellation

| Phase | UI Feedback |
|---|---|
| Prompt being sent | Spinner in stepper step "Transform", editor grayed out (50% opacity) |
| Response being received | Spinner remains, status text "Processing response..." |
| Parsing and validation | Status text "Checking result..." |
| Completed | Stepper step turns gold, diff view opens |

The transform can be cancelled at any time (abort button or Escape). On cancellation, the document model is not modified.

#### 7.3.5 LLM Integration and Response Parsing

The transform service delivers two outputs: (1) the annotated TEI-XML tree, and (2) a confidence mapping per inserted annotation (confident, review-worthy, problematic). Both are written as a new version to the document model and constitute a single undo unit.

**Known LLM failure modes for TEI-XML.**

| Failure Mode | Description | Mitigation |
|---|---|---|
| Malformed XML | Unclosed tags, overlapping hierarchies | Well-formedness check via DOMParser |
| Text alteration | "Correction" of historical spellings, silent character deletion | Plaintext comparison |
| Hallucinated attributes | Fabricated attribute names/values (e.g., `@role` on `<persName>`) | Schema validation, export cleanup |
| Over-annotation | Everything possible is annotated (recall > precision) | Prompt rule "precision over recall", confidence system |
| Under-annotation | Entities in abbreviations/historical spellings missed | Multi-pass (future), "suggest more" |
| Namespace confusion | TEI P5 mixed with other XML vocabularies | ANNOTATION_TAGS whitelist |
| Structure vs. semantics | LLM modifies `<div>`/`<p>` instead of performing NER only | selectedTypes filter |
| Inconsistency | Same entity annotated differently across the document | Consistency check (future) |

**Error handling.**

| Error | Display | Action |
|---|---|---|
| No API key | Toast + hint to settings | Dialog remains open |
| Network error | Toast with retry button | Automatic retry after 2 s, max 3 attempts |
| Invalid LLM response (no valid XML) | Toast + error details | Option to view the raw response |
| LLM response alters text content | Warning in diff | Transform is not automatically applied; user decides |

**Prompt best practices (derived from research).**

1. Few-shot examples are more effective than verbose rules. 2-3 annotated examples per source type in the mapping layer. (Highest single lever for better results.)
2. Low temperature (0.1-0.3) for markup generation. Currently 0.2 for OpenAI.
3. Request self-assessment via `@confidence` attributes. LLMs are reasonably well-calibrated for NER certainty.
4. Strictly constrain output format -- "Only annotated XML, no explanations."
5. Document chunking for long texts -- sending paragraph by paragraph reduces text alteration. (Not yet implemented.)
6. Separate passes for structural vs. semantic markup. (Not yet implemented.)

### 7.4 Validate

**Purpose.** Assess the quality of the annotated document across five validation levels.

#### Level 1: Well-Formedness (automatic)

The browser's DOMParser checks that the XML is well-formed. This is the most fundamental check and a prerequisite for all subsequent processing.

#### Level 2: Plaintext Comparison (automatic)

Automatic comparison of text nodes in the output against the input plaintext. The LLM may add markup but must not alter text content. If a discrepancy is detected, the entire transformation is flagged as erroneous. This is the most critical quality check and must always pass.

#### Level 3: Schema Validation (automatic)

Client-side validation against TEI schemas (RelaxNG, ODD). Checks structural correctness: Are the elements used permitted? Are the attributes correct? Are the nesting relationships valid? Supported schemas: TEI-All, DTA base format, project-specific ODDs.

#### Level 4: Review Count (automatic, configurable)

XPath-based project-specific constraints that go beyond schema validation. Examples: "Every `<persName>` must have a `@ref` attribute", "Every `<date>` must have a `@when` attribute in ISO format." These rules are configured per project and supplement schema validation with content-level requirements.

#### Level 5: XPath Rules / LLM-as-a-Judge / Expert-in-the-Loop

This level combines three approaches:

- **XPath rules** (automatic): Project-specific constraints configurable per project.
- **LLM-as-a-Judge** (semi-automatic, future): Supplements rule-based checking with semantic evaluation. Checks content plausibility ("Is 'August' here really a month name or a person name?"), entity classification, annotation density, and consistency. The LLM judgment never stands alone but always in combination with rule-based checks and human assessment.
- **Expert-in-the-Loop** (manual): The human domain expert checks content correctness that no automatic check can provide. This is the review workflow (Section 8).

#### Interaction of Validation Levels

| Level | When | Blocks export? |
|---|---|---|
| Well-formedness | Immediately after transform | Yes (transform flagged as erroneous) |
| Plaintext comparison | Immediately after transform | Yes (transform flagged as erroneous) |
| Schema validation | Continuously, on every change | No (warning, not a blocker) |
| XPath rules | Continuously, on every change | Configurable (warning or blocker) |
| LLM-as-a-Judge | On request (future) | No (recommendation, not a blocker) |
| Expert-in-the-Loop | Manual, before export | Warning on unreviewed annotations |

### 7.5 Export

**Purpose.** Produce a clean TEI-XML document for downstream use.

#### Attribute Cleanup

On export, transform-specific attributes are removed.

| Attribute | In working document | In export |
|---|---|---|
| `@confidence` | "high", "medium", "low" | Removed (default) or preserved (option) |
| `@resp="#machine"` | Marks LLM annotation | Removed (default) or converted to `@resp="#[projectname]"` |
| Review status | In document model | Not exported (transient) |

#### Unreviewed Annotations

If unreviewed (open) annotations exist at export time, a warning is displayed. The user can choose: export with open annotations (they are treated as accepted) or return to review.

#### Output Formats

TEI-XML download and clipboard copy.

---

## 8. Review Workflow

### 8.1 Epistemological Foundation

The transform step is the moment of greatest epistemic asymmetry. The LLM produces annotations that look plausible but are not reliably correct. The research literature on LLM judge bias (position bias, self-enhancement, verbosity bias) applies in full.

Three design principles follow from this:

**No automatic output.** The transform result is not silently written into the document but presented to the human for review. The entire transformation constitutes a single undo unit.

**Confidence as a call to action.** The confidence categories (confident, review-worthy, problematic) are not descriptions of model certainty but calls to action for the human. "Review-worthy" means "you must look at this", not "the model is 70% sure."

**Summary before detail.** After a transform, the human first sees an overview (what changed, how much needs review) before entering line-by-line review.

### 8.2 Diff View (Post-Transform)

After a successful transform, the document is not immediately overwritten. Instead, a diff view opens showing the difference between pre- and post-transform states. The user has three options: accept all, reject all, or enter line-by-line review.

```
+--------------------------------------------------------------+
|  TRANSFORM RESULT                    [Accept All] [Reject All]|
+--------------------------------------------------------------+
|                                                              |
|  47 annotations created                                      |
|  |||||||||| 32 confident  |||| 12 review-worthy  | 3 problem |
|                                                              |
|  [...] Schiller wrote on 23 August to Goethe that he had    |
|  read the manuscript and found the account of the            |
|  Italian Journey remarkable. [...]                           |
|                                                              |
|  -------- Annotation types --------                          |
|  * persName (8)  * placeName (4)  * date (6)  * orgName (2)  |
|                                                              |
|                            [Start Review -->]                |
+--------------------------------------------------------------+
```

The summary bar at the top shows the distribution of confidence categories at a glance: green (confident), gold (review-worthy), red (problematic), proportional to count.

**Post-diff actions.**

| Action | Effect |
|---|---|
| **Accept all** | Transform result is written as a new document version. All "confident" annotations are considered accepted. "Review-worthy" and "problematic" remain open. Review mode is activated. |
| **Reject all** | Transform result is discarded entirely. Document remains unchanged. |
| **Start review** | Identical to "Accept all" but jumps immediately to the first review-worthy annotation. |

### 8.3 Inline Review

The review is not a separate "mode" but a layer over the normal work surface. After a transform (or at any time when review-worthy annotations exist), review functions are available. The user can switch freely between normal editing and review.

Annotations with confidence "review-worthy" or "problematic" show a compact action bar on hover:

```
                    +--------------+
  ... wrote on      | 23 August    |  to Goethe ...
                    +--+-----------+
                       | [v] Accept  [/] Edit  [x] Reject
                       +------------------------------------
```

| Action | Keyboard | Effect |
|---|---|---|
| **Accept** | A | Annotation becomes permanent. Confidence -> "confident". Review status -> "accepted". |
| **Edit** | E | Attribute tab opens with the element's attributes. After editing, the annotation is marked "edited" (confidence -> "manual"). |
| **Reject** | R | Annotation is removed from the document. Text content is preserved. Review status -> "rejected". |

All three actions are individual undo units.

In the XML editor, review-worthy lines are recognizable via the gutter marker (gold for review-worthy, red for problematic). Clicking a line's gutter marker jumps to the corresponding annotation in the preview and opens the attribute tab.

### 8.4 Batch Review (Keyboard Navigation)

For documents with many annotations (dozens or hundreds), mouse-based review is too slow. Batch review enables sequential keyboard-driven review of all review-worthy annotations.

**Activation.** N key (next review-worthy annotation) or via the summary bar ("Start review").

**Navigation.**

| Key | Action |
|---|---|
| N | Next review-worthy / problematic annotation |
| P | Previous review-worthy / problematic annotation |
| A | Accept (active annotation) |
| R | Reject (active annotation) |
| E | Edit (opens attribute tab) |
| Escape | Leave batch review |

**Progress indicator.** During batch review, a compact bar at the top of the preview shows progress:

```
+--------------------------------------------+
|  Review: 7 / 12 checked   |||||||.....     |
|  [Filter: All v]                           |
+--------------------------------------------+
```

**Filtering.** The review can be filtered by confidence category (review-worthy only, problematic only, all) or by annotation type (`<persName>` only, `<date>` only, etc.).

### 8.5 Review Status Model

| Status | Meaning | Visual |
|---|---|---|
| Open | Not yet reviewed | Confidence tint visible, hover action bar available |
| Accepted | Annotation confirmed | Confidence -> confident (green tint), no action bar |
| Edited | Annotation modified and confirmed | Confidence -> manual (no tint), no action bar |
| Rejected | Annotation removed | Element deleted, text content preserved |

The review status is not exported in the TEI-XML. It is a transient working instrument.

### 8.6 Pre-Accept at High Confidence

When a transform result is accepted (via "Accept all" or "Start review"), all annotations marked "confident" (high LLM confidence) are automatically pre-accepted. Only "review-worthy" and "problematic" annotations remain open for manual review. This reduces the review burden while preserving human oversight for uncertain cases.

---

## 9. Confidence System

### 9.1 Three Levels Plus Manual

| Category | German label | English label | Semantics |
|---|---|---|---|
| Confident | sicher | confident | Confirmed or high LLM confidence |
| Review-worthy | pruefenswert | review-worthy | Human review required |
| Problematic | problematisch | problematic | Validation error or low confidence |
| Manual | manuell | manual | Created by human, no LLM confidence assessment |

The fourth category "manual" exists because human-created annotations have no LLM confidence. "Confident" would be semantically incorrect because in the system it means "the LLM was confident", not "this is correct." Manual annotations carry only the annotation type color (underline), no confidence background.

### 9.2 Mapping from LLM Output

The LLM delivers `@confidence` with values "high", "medium", "low". These are mapped to categorical confidence:

| LLM value | Category | Rationale |
|---|---|---|
| high | Confident | High model confidence, but still not blindly accepted |
| medium | Review-worthy | The most common case, requires human judgment |
| low | Problematic | Model signals uncertainty, likely needs correction |
| (missing) | Review-worthy | If the LLM does not set a confidence attribute, "review-worthy" is assumed conservatively |

**Why not display LLM values directly?** Research on LLM calibration shows that "high confidence" in one LLM does not mean the same as in another, and that even within a model, calibration is inconsistent across tasks. The categorical representation abstracts from this inconsistency and focuses on the action consequence: must be reviewed or not.

### 9.3 Dual-Channel Visual Encoding

Confidence is encoded via background tint. Annotation type is encoded via underline. The two channels are orthogonal -- they encode independent information and can be freely combined.

| Category | Border color | Tint color | CSS Variables |
|---|---|---|---|
| Confident | `#2D8A70` | `#E8F5F0` | `--color-confident`, `--color-confident-tint` |
| Review-worthy | `#CC8A1E` | `#FEF5E7` | `--color-review`, `--color-review-tint` |
| Problematic | `#C0392B` | `#FDECEB` | `--color-problem`, `--color-problem-tint` |
| Manual | `#5A6270` | transparent | `--color-manual` |

**Known tension.** Some type-confidence combinations produce low contrast between the two channels, particularly `<date>` (amber) on "review-worthy" (amber tint) and `<placeName>` (teal) on "confident" (teal tint). This problem must be tested empirically during prototyping. If distinguishability is insufficient, encoding confidence via underline style (solid / dashed / dotted) instead of background tint is the fallback option.

---

## 10. Visual Design System

### 10.1 Design Philosophy

**Target audience.** Researchers in the Digital Humanities who annotate and correct TEI-XML documents. They are experts in their sources (letters, editions, bibliographies) but not necessarily in TEI encoding. The interface must respect domain knowledge and conceal technical complexity where it is not relevant to action.

**Guiding principles.**

| Principle | Meaning | What it does *not* mean |
|---|---|---|
| Readability | Positive polarity, optimized for long sessions | Not pale or low-contrast |
| Orientation | Clear hierarchy through color, typography, position | Not overloaded with indicators |
| Agency | Visual separation of information and action | Not everything is clickable |
| Precision | Geometric rigor, flat surfaces, 8 px grid | Not neon, not glassmorphic, not decorative |

**Visual identity.** The aesthetic derives from the TEI Consortium identity (navy blue, amber gold, black) and combines it with an academic-editorial sensibility. Warm tones, not cold-technical. Clean, not sterile. The result should evoke a precise working instrument, not a dashboard or marketing page.

### 10.2 Complete Color Palette

#### Structural Colors

| Role | Hex | CSS Variable | Usage |
|---|---|---|---|
| Work surface | `#FAFAF7` | `--color-surface` | Page background |
| Panel | `#FFFFFF` | `--color-panel` | Editor, source panel |
| Secondary surface | `#F2F4F8` | `--color-secondary` | Preview panel, footer, active line |
| Header | `#1E3A5F` | `--color-header` | Header background (TEI navy) |
| Borders | `#D0D4DC` | `--color-border` | Panel borders, dividers |
| Border (light) | `#E8EAED` | `--color-border-light` | Subtle dividers |
| Gutter | `#F8F9FB` | `--color-gutter` | Line number background |

#### Accent Colors

| Role | Hex | CSS Variable | Usage |
|---|---|---|---|
| Gold (primary) | `#CC8A1E` | `--color-gold` | Active stepper steps, focus ring, logo accent |
| Gold (light) | `#F5DEB3` | `--color-gold-light` | Hover backgrounds |
| Gold (hover) | `#B57A18` | `--color-gold-hover` | Button hover |
| Blue (secondary) | `#2B5EA7` | `--color-blue` | Links, secondary actions |
| Blue (light) | `#E3EDF7` | `--color-blue-light` | Selected elements |

#### Text Colors

| Role | Hex | CSS Variable |
|---|---|---|
| Primary | `#1A1A1A` | `--color-text` |
| Secondary | `#5A6270` | `--color-text-secondary` |
| Muted | `#8899AA` | `--color-text-muted` |
| Inverse (on navy) | `#FFFFFF` | `--color-text-inverse` |

#### Annotation Type Colors

Underlines (2 px solid), independent of confidence background.

| TEI Element | Hex | Background | CSS Variable |
|---|---|---|---|
| `<persName>` | `#3B7DD8` | `#EBF2FC` | `--color-persName` |
| `<placeName>` | `#2A9D8F` | `#E6F5F3` | `--color-placeName` |
| `<orgName>` | `#7B68AE` | `#F0EDF6` | `--color-orgName` |
| `<date>` | `#B8860B` | `#FDF6E3` | `--color-date` |
| `<bibl>` | `#C47A8A` | `#FAF0F2` | `--color-bibl` |
| `<term>` | `#6B7280` | `#F3F4F6` | `--color-term` |

#### Syntax Highlighting Colors

Light mode, consistent with the overall decision for positive polarity.

| Token type | Hex | CSS Variable | Examples |
|---|---|---|---|
| Element name | `#1E3A5F` | `--syntax-element` | `TEI`, `persName`, `p` |
| Attribute name | `#2A9D8F` | `--syntax-attr` | `ref`, `when`, `type` |
| Attribute value | `#B8860B` | `--syntax-value` | `"#schiller"`, `"1794-08-23"` |
| Delimiters | `#5A6270` | `--syntax-delimiter` | `<` `>` `/` `=` `?>` |
| Comments | `#9AA5B4` | `--syntax-comment` | `<!-- ... -->` |
| Processing instructions | `#7B68AE` | `--syntax-pi` | `<?xml ... ?>` |
| Namespace | `#C47A8A` | `--syntax-namespace` | `xmlns`, `tei:` |
| Entity reference | `#2B5EA7` | `--syntax-entity` | `&amp;`, `&lt;` |
| Text content | `#1A1A1A` | `--syntax-text` | Character data |

### 10.3 Typography

**Font stack.**

| Role | Font | Fallback | Usage |
|---|---|---|---|
| UI text | Inter | system-ui, -apple-system, sans-serif | Interface elements, labels, buttons |
| Code/XML | JetBrains Mono | Consolas, Monaco, monospace | Editor, transcription, line numbers |
| Serif (preview) | Georgia | Times New Roman, serif | Preview text rendering |
| Logo | JetBrains Mono | monospace | `[ tei Crafter ]` |

**Font sizes.** All sizes on the 8 px grid.

| Element | Size | Weight | Line height | Usage |
|---|---|---|---|---|
| Logo | 18 px | 600 | 24 px | Header |
| Panel title | 14 px | 600 | 20 px | Panel headings |
| Body text | 14 px | 400 | 22 px | UI text, descriptions |
| Code | 13 px | 400 | 20 px | XML editor, plaintext |
| Badges/Labels | 12 px | 500 | 16 px | Confidence badges, entity labels |
| Footer | 12 px | 400 | 16 px | Status bar |

**CSS typography variables.**

| Variable | Value |
|---|---|
| `--font-ui` | `'Inter', system-ui, -apple-system, sans-serif` |
| `--font-mono` | `'JetBrains Mono', Consolas, Monaco, monospace` |
| `--font-serif` | `'Georgia', 'Times New Roman', serif` |
| `--font-size-xs` | `0.75rem` |
| `--font-size-sm` | `0.8125rem` |
| `--font-size-base` | `0.875rem` |
| `--font-size-lg` | `1.125rem` |
| `--line-height-tight` | `1.4` |
| `--line-height-base` | `1.6` |
| `--line-height-code` | `1.55` |

### 10.4 Layout

#### Three-Column Structure

```
+------------------------------------------------------------------------+
|  HEADER (48px)    [ tei Crafter ]   Workflow Stepper          LLM Badge |
+---------------+---------------------------+----------------------------+
|  SOURCE       |  XML EDITOR               |  PREVIEW + REVIEW          |
|  ~25%         |  ~45%                     |  ~30%                      |
|               |                           |                            |
|  Tabs:        |  Gutter + Code            |  Tabs:                     |
|  [Plaintext]  |  Confidence markers       |  [Preview + Review]        |
|  [Facsimile]  |  Schema guidance          |  [Validation]              |
|               |                           |  [Attributes]              |
+---------------+---------------------------+----------------------------+
|  FOOTER (28px)   Filename - Schema - Lines - Mapping - Validation      |
+------------------------------------------------------------------------+
```

#### Panel Proportions and Responsive Behavior

| Viewport | Layout | Notes |
|---|---|---|
| >1200 px | 25% / 45% / 30% | Three columns, resizable |
| 768-1200 px | Two columns, source panel collapsible | Editor + preview prioritized |
| <768 px | Single column, tab navigation | Limited functionality |

#### Z-Index Layers

| Layer | Value | Content |
|---|---|---|
| Base | 0 | Panels, content |
| Toolbar | 10 | Editor toolbar |
| Dropdown | 100 | Autocompletion, menus |
| Modal | 200 | Dialogs |
| Toast | 300 | Notifications |

#### Spacing

8 px grid. All spacings are multiples of 4 px.

| Token | Value | Usage |
|---|---|---|
| `--space-1` | 4 px | Tight spacing, icon gaps |
| `--space-2` | 8 px | Standard padding |
| `--space-3` | 12 px | Panel inner padding |
| `--space-4` | 16 px | Section breaks |
| `--space-6` | 24 px | Large spacing |

#### Layout Variables

| Variable | Value |
|---|---|
| `--header-height` | `48px` |
| `--footer-height` | `28px` |
| `--gutter-width` | `48px` |

### 10.5 Component Specifications

#### Header

| Property | Value |
|---|---|
| Height | 48 px |
| Background | `--color-header` (`#1E3A5F`) |
| Logo | `[ tei Crafter ]` in JetBrains Mono, "Crafter" in gold |
| Stepper | 5 steps, active step in `[ brackets ]` + gold |
| LLM badge | Monospace, green dot = ready, gray dot = not configured |

#### Workflow Stepper

```
o-----o-----*-----o-----o
Import  Mapping  Transform  Validate  Export
```

| State | Visual |
|---|---|
| Completed | Checkmark + gold connection line |
| Active | `[ Label ]` in gold |
| Pending | Muted color (`--color-text-muted`) |

#### Source Panel (left, 25%)

Two tabs:

- **Plaintext.** Extracted plain text from the TEI body, monospace rendering, read-only. Serves for quick comparison with the annotated XML.
- **Facsimile.** Image of the original document, if provided at import. Zoom/pan for comparison with the transcription.

#### XML Editor (center, 45%)

- **Gutter.** 48 px wide, background `--color-gutter`. Line numbers right-aligned in `--color-text-muted`. Confidence markers as 3 px left border per line, color from the dominant confidence category of annotations in that line. Lines without annotations have no marker.
- **Active line.** Background `--color-secondary` (`#F2F4F8`), subtle.
- **Schema autocompletion.** Dropdown with `--color-panel` background, `--color-border` border, max 8 visible entries, scrollable. Disappears on Escape or click outside.
- **Inline validation.** Invalid elements receive an underline in `--color-problem`. Non-blocking; invalid states are tolerated during editing.

#### Right Panel (30%)

Three tabs:

- **Preview + Review (integrated).** The TEI body as readable text. Inline elements as color-coded spans (underline = type, background = confidence). Clickable annotations (open attribute tab, scroll editor to line). Review-worthy and problematic elements show an action bar on hover: Accept, Edit, Reject. Metadata header dynamically from `teiHeader`. Entity legend dynamic (only used types).
- **Validation.** Validation list with clickable line references. Badges for success/warning/error. Live updates.
- **Attributes.** On clicking an element (editor or preview): its attributes as form fields. Element name as color-coded badge. Closed value lists as dropdowns (from ODD). Free-text attributes as input fields with validation. Reference fields (`@ref`, `@key`) with search function (when registers are available).

#### Footer (Status Bar)

| Property | Value |
|---|---|
| Height | 28 px |
| Background | `--color-secondary` |
| Content | Filename - Schema - Line count - Mapping type - Validation status |

#### Toast Notifications

Position bottom right, 16 px from edge. 3 px left border in status color. Slide-in from right (300 ms ease-out). Default 4 s, important messages 8 s.

#### Dialogs

520 px wide (max 90 vw). Background `--color-panel`. Border 1 px `--color-border`. Border radius 8 px. Backdrop `rgba(30, 58, 95, 0.6)` with 4 px blur (navy tone instead of black, consistent with header).

#### Animation Timings

| Type | Duration | Easing |
|---|---|---|
| Hover states | 150 ms | ease-out |
| Panel transitions | 150 ms | ease-out |
| Dialog open/close | 200 ms | ease-out |
| Toast slide-in | 300 ms | ease-out |

No animation exceeds 300 ms. Text editing, validation results, and error messages appear immediately without animation.

### 10.6 WCAG Accessibility

#### Color Contrasts (WCAG 2.1 AA)

| Combination | Contrast | Status |
|---|---|---|
| Text (`#1A1A1A`) on work surface (`#FAFAF7`) | 15.8:1 | Pass |
| Gold (`#CC8A1E`) on navy (`#1E3A5F`) | 4.8:1 | Pass |
| Error (`#C0392B`) on tint (`#FDECEB`) | 5.2:1 | Pass |
| Secondary text (`#5A6270`) on panel (`#FFFFFF`) | 5.9:1 | Pass |
| Muted (`#8899AA`) on panel (`#FFFFFF`) | 3.5:1 | Fail (decorative only) |

#### Multi-Channel Encoding

Every status display uses at least two redundant channels.

| Information | Channel 1 | Channel 2 | Channel 3 |
|---|---|---|---|
| Confidence | Background tint | Gutter marker | Review action bar (review-worthy/problematic only) |
| Annotation type | Underline color | Entity legend | Attribute tab (badge with element name) |
| Validation error | Inline underline | Validation tab (list) | Gutter marker |

#### Screen Reader Support

All interactive elements have ARIA labels. Status changes (validation, review) are announced via `aria-live` regions. Focus order follows the visual layout (Source -> Editor -> Preview).

#### Keyboard Navigation

| Key | Action | Context |
|---|---|---|
| Tab | Switch between panels | Global |
| Up/Down | Navigate lines | Editor |
| Enter/Space | Execute action | Buttons, stepper |
| Escape | Close dropdown/dialog | Editor, dialogs |
| Ctrl+Z / Ctrl+Y | Undo/Redo (document level) | Global |
| Ctrl+Space | Schema autocompletion | Editor |
| N / P | Next/previous review-worthy annotation | Review mode |
| A | Accept (active annotation) | Review mode |
| E | Edit (active annotation) | Review mode |
| R | Reject (active annotation) | Review mode |

#### Focus Styles

```css
:focus-visible {
    outline: 2px solid var(--color-gold);
    outline-offset: 2px;
}
```

---

## 11. Key Architecture Patterns

### Event Delegation

UI event handling uses event delegation rather than per-element listeners. Event listeners are attached to container elements and use `event.target` traversal to identify the source. This reduces memory usage, simplifies dynamic content handling, and avoids listener lifecycle management.

### Snapshot-Based Undo

The undo system captures full model snapshots (document + confidence + review status) rather than operation-based diffs. This simplifies implementation and guarantees that multi-layer state changes (e.g., Accept modifies XML, confidence, and review status simultaneously) can be atomically reversed. Maximum 100 entries with oldest-first eviction. Keystroke grouping uses a 500 ms pause threshold.

### API Key Isolation

API keys exist only in browser memory (module-scoped Map). They are never persisted to localStorage, IndexedDB, or any server. Closing the tab destroys them. This is a deliberate design decision prioritizing security over convenience. Ollama provides a zero-key local alternative.

### Module-Scoped State

Each ES6 module maintains its own internal state via module-scoped variables (not global state, not a centralized store). Cross-module communication occurs exclusively through the EventTarget-based document model. This prevents tight coupling and makes modules independently testable.

### Lazy Loading

Service modules (LLM, transform, validation, export) are loaded on demand when first needed, not at application startup. This reduces initial load time and avoids unnecessary resource allocation for workflows that may not use all services.

---

**Related documents:**
- [MODULES.md](MODULES.md) -- Public APIs for all modules
- [STATUS.md](STATUS.md) -- Current implementation status
- [DECISIONS.md](DECISIONS.md) -- Decision log
- [STORIES.md](STORIES.md) -- User stories and their status
