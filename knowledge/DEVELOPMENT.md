# teiCrafter -- Development Log and Planning

Last updated: 2026-03-03

This document consolidates architectural decisions, user stories, Phase 3 concepts, and the development journal for the teiCrafter project. It merges content from DECISIONS.md, STORIES.md, JOURNAL.md, teiModeller.md, and DISTILLATION.md into a single English-language reference.

---

## 1. Decided Questions

Architectural and design decisions that have been resolved.

| Question | Decision | Rationale | Date |
|---|---|---|---|
| Right panel: tab structure | Preview + Review integrated, Validation, Attributes | Review is not a standalone activity but a layer on top of the preview | 2026-02-05 |
| Editor engine | Overlay (prototype), CodeMirror 6 (production). No Monaco, no ContentEditable | Monaco too large (~2 MB), ContentEditable too fragile. Overlay suffices for prototype, CM6 for production | 2026-02-05 |
| Prompt architecture | Three-layer model (Base, Context, Mapping) | Separation enables stable base rules with flexible project-specific configuration | 2026-02-05 |
| Validation levels | Five levels (Plaintext, Schema, XPath, LLM-as-a-Judge, Expert-in-the-Loop) | Graduated quality assessment instead of binary valid/invalid | 2026-02-05 |
| Confidence categories | Four categories (certain, review-worthy, problematic, manual) | "Manual" is necessary for human-created annotations without LLM confidence | 2026-02-05 |
| Document name TRANSFORM.md | Renamed to WORKFLOW.md | "Transform" is too unspecific | 2026-02-05 |
| Overlay spike (500 lines) | Spike passed, no scroll drift | Implemented in Stage 1, confirmed in Session 8 | 2026-02-18 |
| Visual test matrix | 24 combinations tested, 2 problem cases identified | `date`+review-worthy and `placeName`+certain require attention. Solution: underline style as additional channel | 2026-02-18 |
| Service integration strategy | Direct wiring in app.js, retain AppState | Incremental approach: services first, DocumentModel refactoring as a separate step (Stage 14). Inline dummies deleted. | 2026-02-18 |
| LLM provider selection | 6 providers: Gemini, OpenAI, Anthropic, DeepSeek, Qwen, Ollama | Broad coverage: 3 US cloud + 2 CN cloud + 1 local. DeepSeek/Qwen use OpenAI-compatible format. MODEL_CATALOG with prices/reasoning flag. | 2026-02-18 |
| Event management in app.js | Event delegation instead of individual listeners | One click listener on `.app-main` with `data-action` attributes. Eliminates listener leaks during step changes. Drag-and-drop via `stepCleanup` pattern. Tab clicks also delegated. | 2026-02-18 |
| ANNOTATION_TAGS centralization | Central list in constants.js | Tag list was duplicated 5 times (transform, validator, export, preview, editor). Now 1 source, 3 consumers (validator/editor have no hardcoded list). | 2026-02-18 |
| Development strategy Phase 2 to 3 | Walking-skeleton-first (validate walking skeleton, then targeted architecture improvement) | Market analysis (LANDSCAPE.md) confirms: no comparable tool exists. SW literature (Cockburn, Freeman/Pryce, Hunt/Thomas) unambiguous: validate skeleton under real conditions before polishing architecture. Review workflow is the differentiator. | 2026-02-18 |
| Integrate Preview before Editor | preview.js takes priority over editor.js for view integration | DH scholars want visual feedback, not raw angle brackets. The preview is the working instrument for everyone; the editor is a tool for advanced users. | 2026-02-18 |
| Few-shot examples as prompt lever | 2--3 annotated examples per source type in the mapping layer | Research is clear: few-shot is more effective than verbose rules. Highest leverage for better LLM results with minimal effort. | 2026-02-18 |
| Demo data: real sources instead of placeholders | CoReMA recipe (medieval, CC BY 4.0) + DEPCHA ledger (1718, CC BY 4.0) + SZD letter (pending) | Real DH projects from the University of Graz: CoReMA tests historical language/recipe domain, DEPCHA tests Bookkeeping Ontology with bk: attributes, SZD tests correspondence. All three projects known to the user. | 2026-02-18 |
| Bookkeeping as new sourceType | `bookkeeping` with SOURCE_LABELS, DEFAULT_MAPPINGS, detectType() | Ledgers are an independent source type with specific entities (monetary amounts, accounts, commodities). Bookkeeping Ontology (bk:) requires @ana attributes not found in generic rules. | 2026-02-18 |

---

## 2. Open Questions

### High Priority (blocks end-to-end workflow)

| Question | Priority | Context |
|---|---|---|
| DocumentModel vs. AppState | High | app.js uses a simple AppState object instead of the reactive DocumentModel (model.js). This means: no undo/redo, no observer pattern, no event-based view synchronization. Options: (a) replace AppState with DocumentModel (clean but large refactoring), (b) use DocumentModel as supplement for XML-specific state (incremental). Session 14 assessment: DocumentModel refactoring can wait. First prove that the walking skeleton (LLM transform + review) works with AppState. If the skeleton reveals that undo/redo or observer sync are actually missing, then refactor. |

### Medium Priority (significantly affects UX)

| Question | Priority | Context |
|---|---|---|
| Diff presentation | Medium | Which format for the diff view after transform? Options: annotated text (currently specified, shows content changes), XML diff (shows markup changes), side-by-side (shows before/after). Criterion: prototyping with real documents. |
| Source panel: permanent vs. collapsible | Medium | Should the source panel permanently occupy 25% or function as a collapsible sidebar? Criterion: user feedback on prototype. |
| Cursor coupling: bidirectional vs. unidirectional | Medium | Should cursor coupling between editor and preview work in both directions? Current state: no coupling implemented (no cross-panel sync). Criterion: user feedback. |

### Low Priority (after prototype)

| Question | Priority | Context |
|---|---|---|
| ODD parsing: generic | Low | Stage 1 (hardcoded JSON profile) implemented. Stage 2 (generic ODD parsing) is Phase 3. |
| Registry integration | Low | How are person registries, place registries, etc. integrated? |
| Undo strategy for large documents | Low | Is snapshot-based undo sufficient for >1000 lines? Fallback option: diff-based undo. |
| Multi-pass transform | Low | All annotation types in one LLM pass or separate passes? |
| Nested annotations | Low | How does accept/reject behave for `<persName>` inside `<bibl>`? |
| Few-shot examples | Low | Automatic extraction from existing annotations or manual configuration? |
| teiModeller: knowledge module granularity | Low | Pilot run with `namesdates` module planned. Final granularity pending pilot results. |
| Authority data integration | Low | LLM suggestions for GND/VIAF/Geonames already during transform or downstream reconciliation? |

---

## 3. User Stories

User stories for the teiCrafter prototype (Phase 2) and selected stories for Phase 3. Each story follows the standard "As a ... I want ... so that ..." format and includes a manually executable test scenario.

### Test Environment

The local dev server runs in VS Code, reachable via `localhost`. Tests are manually executable in the browser without an automated testing framework. Each story has a given/when/then pattern and a concrete verification step that can be checked visually or via browser DevTools.

For stories involving LLM calls (from 3.1 onward), a valid API key for at least one provider is required.

### Status Legend

| Status | Meaning |
|---|---|
| Integrated | Module implemented AND integrated in app.js |
| Module ready | Module implemented but NOT integrated in app.js |
| Open | Not yet started |
| Phase 3 | Not part of the prototype |

---

### Step 0 -- Editor Foundation

Validates the technical foundation before content features are built. Corresponds to implementation stages 1--5.

#### Story 0.1 -- XML Displayed with Syntax Highlighting [Module ready]

As an editor, I want to see TEI-XML in the central panel with color-differentiated tags, attributes, and text content, so that I can visually grasp the document structure.

**Given** a loaded TEI-XML file with at least 100 lines, **when** the document is displayed in the editor, **then** tags, attributes, attribute values, and text nodes are rendered in distinct colors.

**Test step:** Visual comparison with the same document in oXygen or VS Code. The color categories (not the exact colors) must match.

#### Story 0.2 -- Scrolling Without Drift (Overlay Spike) [Module ready]

As an editor, I want to scroll through a TEI document of 500 lines without the highlighting and text drifting apart, so that I can work reliably even in longer documents.

**Given** a TEI document with 500+ lines in the editor, **when** I scroll to the end, return to the middle, and scroll back to the beginning, **then** the overlay layer remains pixel-aligned with the text at every position.

**Test step:** Visual inspection at three positions (beginning, middle, end). If drift occurs, switch to CodeMirror 6.

**Note:** This story is the fundamental architectural test. Its result determines whether stories 0.1 and 0.3 are implemented with overlay or CodeMirror 6.

#### Story 0.3 -- Line Numbers in Gutter [Module ready]

As an editor, I want to see line numbers so that I can associate validation errors and review comments with a specific location.

**Given** a loaded TEI document, **when** I scroll or insert new lines, **then** the line numbers match the actual line content.

**Test step:** Insert a blank line in the middle. Line numbers for all subsequent lines must increase by one.

#### Story 0.4 -- Undo/Redo at Document Level [Module ready]

As an editor, I want to undo and redo changes to the document so that I can revert to the previous state after erroneous edits or unwanted transform results.

**Given** a loaded TEI document in which several edits have been performed (e.g., text inserted, annotation accepted, transform executed), **when** I press Ctrl+Z, **then** the last editing unit is undone and all views (editor, preview, validation) update consistently.

**Test steps:**
- Execute a transform (Story 3.1), press Ctrl+Z. The entire transform result is undone, not just a single annotation.
- Accept an annotation (Story 4.1), press Ctrl+Z. The annotation returns to the "open" state.
- Press Ctrl+Y after an undo. The undone change is restored.

**Note:** This story validates the snapshot-based undo system. It is a prerequisite for a safe review workflow because erroneous accept/reject decisions must be correctable.

---

### Step 1 -- Import

Corresponds to the workflow stepper step "Import".

#### Story 1.1 -- Import Plaintext [Integrated]

As an editor, I want to load a plaintext file via drag-and-drop or file picker so that I can begin annotation.

**Given** a `.txt` file with multiple paragraphs, **when** I drag it into the browser window or select it via the file dialog, **then** the text appears in the source panel (left) and a minimal TEI shell (`<TEI>`, `<teiHeader>`, `<body>` with `<p>` elements) appears in the editor (center).

**Test step:** Inspect the generated XML source in DevTools. Each paragraph of the original text must be in its own `<p>` element. The text content must be character-accurate.

#### Story 1.2 -- Import Existing TEI [Integrated]

As an editor, I want to load an existing TEI-XML file so that I can continue annotating it.

**Given** a valid TEI-XML file, **when** I load it, **then** it appears unchanged in the editor.

**Test step:** Character-accurate comparison of editor content with the original. Whitespace and indentation must not change.

#### Story 1.3 -- Invalid XML Is Rejected [Integrated]

As an editor, I want to see a comprehensible error message for malformed XML so that I can fix the problem.

**Given** an XML file with an unclosed tag, **when** I load it, **then** a toast appears with an error message identifying the type of error, and the file is not loaded into the editor.

**Test step:** Create a file with `<p>Text without closing tag`. The error message must indicate the missing closing tag. The editor remains empty or shows the previous state.

---

### Step 2 -- Mapping

Corresponds to the workflow stepper step "Mapping".

#### Story 2.1 -- Select Annotation Types [Integrated]

As an editor, I want to specify which annotation types the LLM should annotate before the transform so that I can control annotation precisely.

**Given** a loaded TEI document, **when** I open the transform dialog, **then** I see the available annotation types (persons, places, dates, organizations, etc.) as checkboxes and can select or deselect individual types.

**Test step:** Select only "Persons" and "Places". After the transform (Story 3.1), the result contains exclusively `<persName>` and `<placeName>`, no other entity tags. Verifiable via text search in the editor.

#### Story 2.2 -- Inspect Prompt Before Sending [Module ready]

As an editor, I want to see the assembled prompt before it is sent to the LLM so that I maintain transparency over the annotation process.

**Given** configured annotation types in the transform dialog, **when** I click "Show prompt", **then** the complete prompt is displayed, visibly structured into base, context, and mapping layers.

**Test step:** The selected annotation types from Story 2.1 are reflected in the mapping layer. Deselected types do not appear in the prompt.

---

### Step 3 -- Transform

Corresponds to the workflow stepper step "Transform".

#### Story 3.1 -- LLM Annotates the Text [Integrated]

As an editor, I want to send the TEI body to an LLM and receive an annotated TEI document in return so that I can review the annotation proposal.

**Given** a loaded TEI document, a configured API key, and selected annotation types, **when** I trigger the transform, **then** annotated XML appears in the editor after the LLM response, in which recognized entities are tagged with the corresponding TEI elements.

**Test step:** Use a control text (short letter with known person and place names, e.g., "Lieber Heinrich, ich schreibe Dir aus Wien"). The names must be annotated as `<persName>` and `<placeName>` respectively. The XML must be well-formed (verifiable via browser console with DOMParser).

**Test document:** A short letter with 5--10 unambiguous named entities from one of the synergy projects.

#### Story 3.2 -- Diff View Before Acceptance [Module ready]

As an editor, I want to see a summary of changes after the transform so that I can assess whether the result is plausible before accepting it.

**Given** a completed transform, **when** the diff view appears, **then** it shows a summary bar (e.g., "12 persons, 5 places, 3 dates added") and below it the annotated text with color highlighting of new annotations.

**Test step:** Count the numbers in the summary bar and compare with the actual number of new tags in the XML. The numbers must match. "Accept" updates the editor; "Discard" restores the state before the transform.

#### Story 3.3 -- Confidence Is Visually Encoded [Module ready]

As an editor, I want to see at a glance which annotations the LLM considers certain, review-worthy, or problematic so that I can allocate my review time effectively.

**Given** an annotated document after the transform, **when** I view the preview, **then** annotations have different background colors depending on their confidence category (certain, review-worthy, problematic).

**Test step:** Identify at least one annotation per confidence category and visually verify that the three categories are distinguishable. This test also validates the visual test matrix.

---

### Step 4 -- Review

Corresponds to the review workflow.

#### Story 4.1 -- Review Individual Annotation (Inline Review) [Module ready]

As an editor, I want to click on an annotation in the preview and accept, edit, or reject it so that I can evaluate each LLM annotation individually.

**Given** an annotated document in the preview (right panel), **when** I click on an annotated name, **then** a menu appears with the actions Accept, Edit, and Reject.

**Test steps:**
- Accept: The visual status changes (confidence color becomes "manual"). In the XML, the tag is preserved.
- Reject: The tag is removed; the text content is preserved. In the editor, the tag is gone.
- Edit: A form opens (attribute tab) where one can change the tag type or attributes. After saving, the change is visible in the editor.

#### Story 4.2 -- Batch Review via Keyboard [Module ready]

As an editor, I want to sequentially review all open annotations via keyboard so that I can review efficiently.

**Given** a document with at least 10 unreviewed annotations, **when** I start the batch review mode, **then** the first unreviewed annotation is focused and highlighted in the preview.

**Test step:** `N` jumps to the next annotation, `A` accepts, `R` rejects, `E` opens editing. After each action, the focus automatically jumps to the next unreviewed annotation. Navigate through 5 annotations and verify that the progress bar (Story 4.3) counts correctly.

#### Story 4.3 -- Review Progress Visible [Module ready]

As an editor, I want to see at any time how many annotations have been reviewed and how many remain open so that I can gauge my progress.

**Given** a document with annotations, **when** I accept or reject annotations, **then** a progress bar updates (e.g., "7 / 12 reviewed").

**Test step:** Accept three annotations and reject one. The counter increases by four (every decision counts as reviewed, regardless of outcome).

---

### Step 5 -- Validation

Corresponds to the workflow stepper step "Validate".

#### Story 5.1 -- Plaintext Comparison [Integrated]

As an editor, I want to ensure that the pure text content was not altered by the annotation so that no transcription content is lost.

**Given** an annotated document after the transform, **when** I trigger validation, **then** the application compares the extracted plaintext (all tags removed) with the original text and shows "Plaintext identical" or highlights discrepancies.

**Test step:** Perform a transform and check the result. With a correctly functioning LLM, "Plaintext identical" should appear. As a counter-test, manually insert a word into the annotated XML and trigger validation again. The discrepancy must be displayed.

#### Story 5.2 -- Schema Validation (Stage 1) [Integrated]

As an editor, I want to see whether my TEI document conforms to the selected schema so that I can detect structural errors.

**Given** an annotated document in the editor, **when** I open the validation tab, **then** it shows a list of schema errors with line numbers and error descriptions.

**Test step:** Insert an invalid attribute (e.g., `<persName foo="bar">`). The validation tab shows an error. Click the error; the editor jumps to the corresponding line.

---

### Step 6 -- Export

Corresponds to the workflow stepper step "Export".

#### Story 6.1 -- Export TEI-XML [Integrated]

As an editor, I want to download the finished document as a TEI-XML file so that I can process it in downstream systems (ediarum, oXygen, GAMS).

**Given** an annotated and (optionally) validated document, **when** I click "Export", **then** a `.xml` file is downloaded.

**Test step:** Open the exported file in oXygen or VS Code. It must be well-formed and correspond to the editor state in content.

#### Story 6.2 -- Warning for Unreviewed Annotations [Module ready]

As an editor, I want to be warned when I export a document with unreviewed annotations so that I do not accidentally treat unreviewed LLM proposals as finished.

**Given** a document with at least one unreviewed annotation, **when** I trigger export, **then** a dialog appears ("5 annotations still unreviewed. Export anyway?") with the options "Export" and "Back to Review".

**Test step:** Trigger export without having reviewed all annotations. The dialog appears. "Back to Review" closes the dialog without exporting. "Export" produces the file.

---

### Cross-Cutting -- LLM Configuration

#### Story Q.1 -- Enter API Key [Integrated]

As an editor, I want to enter my API key for an LLM provider so that the application can generate annotations.

**Given** the open application, **when** I enter my API key in the configuration field, **then** it is stored for the current session and used for LLM calls.

**Test step:** After entering the key, trigger a transform (Story 3.1). It must work. After a page reload, the key is gone. Verify via DevTools (Application -> Local Storage, Cookies) that the key is not persistently stored anywhere.

#### Story Q.2 -- Select LLM Provider [Integrated]

As an editor, I want to choose among different LLM providers so that I am not locked into a single vendor.

**Given** the configuration interface, **when** I select a provider from a list (e.g., Anthropic, OpenAI), **then** LLM calls are directed to that provider.

**Test step:** For the prototype, one functioning provider suffices. The story is fulfilled when the UI element for provider selection exists and at least one provider triggers a successful transform.

---

### Phase 3 -- teiModeller

These stories are not part of the prototype. They document planned functionality for the consolidation phase.

#### Story M.1 -- Ask a Modeling Question [Phase 3]

As an editor, I want to ask a question such as "How do I annotate currency amounts?" and receive a reasoned proposal with TEI elements and attributes so that I can make informed modeling decisions.

**Given** the teiModeller is open and relevant TEI knowledge modules are activated, **when** I enter a modeling question, **then** I receive a proposal with the recommended element, relevant attributes, and an example snippet.

**Test step:** Ask the question and compare the proposal with the corresponding passage in the TEI Guidelines.

#### Story M.2 -- Adopt Proposal as Mapping Rule [Phase 3]

As an editor, I want to save an accepted modeling proposal as a mapping rule so that it is automatically used in future transforms.

**Given** an accepted modeling proposal, **when** I click "Adopt as mapping rule", **then** the rule appears in the mapping layer of the prompt.

**Test step:** Open the prompt preview (Story 2.2) and check whether the new rule appears in the mapping layer.

---

### Cross-Cutting -- End-to-End Story (Session 14)

#### Story E2E.1 -- Complete LLM End-to-End Test [Open]

As an editor, I want to run the complete workflow (Import -> Transform with real LLM -> Review with confidence -> Validate -> Export) on a real document so that it is proven that the core value of teiCrafter works.

**Given** the HSA demo letter (hsa-letter-benndorf.txt), a configured API key for at least one provider, and pre-filled mapping rules for correspondence, **when** I play through the complete workflow:
1. Import the demo letter
2. Check mapping rules, adjust if needed
3. Trigger transform (real LLM call)
4. See annotated result with confidence colors in the preview
5. Review at least 5 annotations (Accept/Reject/Edit)
6. Check validation (plaintext comparison, schema, well-formedness)
7. Export as TEI-XML

**then** a valid TEI-XML file is produced containing the annotated entities, the plaintext comparison passes, and no console errors occur.

**Test steps:**
- LLM response is correctly parsed (XML extraction from Markdown block)
- `@confidence` attributes are correctly mapped to confidence categories
- Plaintext comparison shows >=95% similarity
- Exported file is well-formed and opens in oXygen/VS Code
- Browser console shows no errors

**Note:** This is the central validation story for the walking-skeleton-first strategy. It binds stories 1.1, 2.1, 3.1, 3.3, 4.1, 5.1, 5.2, 6.1 together. Its result determines which architectural improvements are actually necessary.

---

### Summary Table

| Step | Stories | Integrated | Module Ready | Open |
|---|---|:---:|:---:|:---:|
| 0 -- Editor Foundation | 0.1, 0.2, 0.3, 0.4 | 0 | 4 | 0 |
| 1 -- Import | 1.1, 1.2, 1.3 | 3 | 0 | 0 |
| 2 -- Mapping | 2.1, 2.2 | 1 | 1 | 0 |
| 3 -- Transform | 3.1, 3.2, 3.3 | 1 | 2 | 0 |
| 4 -- Review | 4.1, 4.2, 4.3 | 0 | 3 | 0 |
| 5 -- Validation | 5.1, 5.2 | 2 | 0 | 0 |
| 6 -- Export | 6.1, 6.2 | 1 | 1 | 0 |
| Q -- LLM Configuration | Q.1, Q.2 | 2 | 0 | 0 |
| E2E -- End-to-End | E2E.1 | 0 | 0 | 1 |
| **Prototype Total** | **22** | **10** | **11** | **1** |
| M -- teiModeller (Phase 3) | M.1, M.2 | -- | -- | 2 (Phase 3) |

**Summary:** All 21 prototype stories have implemented modules. 10 are fully integrated (UI + service): Import 1.1--1.3, Mapping 2.1, Transform 3.1, Validation 5.1--5.2, Export 6.1, LLM Configuration Q.1--Q.2. 11 have functioning modules that are not yet fully wired into the UI (Editor Foundation 0.1--0.4 because editor.js is not imported, Review 4.1--4.3 because preview.js is not imported, Transform 3.2--3.3 because diff view and confidence visualization require preview.js, Export 6.2 because the export warning dialog is missing).

### Implementation Roadmap

**Completed Phase 2 sequence (Stages 1--10):**

```
 1. Visual test matrix (color combinations)
 2. Editor spike (overlay, 500 lines)
 3. XML tokenizer (pure function, 17 tests)
 4. Reactive document model + undo (21 tests)
 5. Editor (overlay with gutter)
 6. Source panel + preview (inline + batch review)
 7. LLM service (4 providers)
 8. Transform + prompt assembly
 9. Validation (3 of 5 levels, 13 tests)
10. Export (attribute cleanup, download, clipboard)
```

**Completed service integration (Stages 11--13):**

```
11. app.js -> transform.js + llm.js wiring (Step 3) + Settings dialog
12. app.js -> validator.js + schema.js wiring (Step 4)
13. app.js -> export.js wiring (Step 5) + Export options
```

**Current roadmap (walking-skeleton-first, Session 14):**

```
Phase A -- Validate walking skeleton:
  A0. [done] Demo data with real sources (CoReMA recipe, DEPCHA ledger)
  A1. [ ] Test real LLM transform (demo recipe + API key)
  A2. [ ] Add few-shot examples to prompt assembly
  A3. [ ] Document and fix breakpoints

Phase B -- Make review workflow tangible:
  B1. [ ] Integrate preview.js into app.js (inline review + confidence)
  B2. [ ] Activate batch review (keyboard navigation N/P/A/R/E)
  B3. [ ] Confidence visualization (dual-channel instead of regex)

Phase C -- Targeted architecture (only what the skeleton demands):
  C1. [ ] Introduce DocumentModel (only if undo/redo proves necessary)
  C2. [ ] Integrate editor.js (only if regex-based XML rendering is insufficient)
  C3. [ ] Write tests targeted at breakpoints
```

---

## 4. Phase 3 Concepts

### 4a. teiModeller

#### Problem Statement

TEI annotation presupposes modeling decisions that are often more difficult than the annotation itself. Which element represents a given textual phenomenon? Which attributes are meaningful? How does the modeling relate to project-specific requirements and the chosen ODD?

Existing TEI editors (oXygen, ediarum) assume that these decisions have already been made. The TEI Guidelines are extensive (~1800 pages), organized by module, and difficult to navigate for newcomers. The teiModeller closes this gap by making the Guidelines LLM-accessible and providing context-sensitive modeling advice.

The teiModeller is planned for Phase 3 (consolidation). It specifies the concept and knowledge architecture, not the implementation.

#### Knowledge Foundation

**Principle: distilled modules instead of RAG.** No RAG system. Instead, a collection of distilled TEI knowledge modules -- compressed, LLM-optimized representations of the TEI Guidelines organized by TEI module. The advantage over RAG lies in controlled information density: each module contains exactly the information an LLM needs to make informed modeling proposals without irrelevant details.

The modules are produced via a three-stage pipeline (scraping -> distillation -> validation), specified in the TEI Guidelines Distillation Pipeline section below.

**Module structure.** Each module contains:
- Available elements with their attributes and usage contexts
- Typical modeling patterns (e.g., how persons are annotated in correspondence vs. in bibliographies)
- Common errors and misconceptions
- Relationships with other modules

**Activation on demand.** Modules are selectively activated, not loaded wholesale. Examples:
- For correspondence: `namesdates`, `header`, `core`, `correspDesc`
- For recipes: `measurement` and domain-specific modules
- For bibliographies: `header`, `core`, `bibl`

Activation can be manual (by the user) or automatic (based on the detected source type and the chosen ODD profile).

#### 4-Step Interaction Pattern

The teiModeller is invoked via the mapping panel or context-sensitively from within the editor.

**Step 1.** The user describes a textual phenomenon or marks a text passage in the editor. Example: "How do I annotate currency amounts in a ledger?"

**Step 2.** The teiModeller proposes suitable TEI structures based on the active knowledge modules and the project context. The proposal contains the recommended element, the relevant attributes, and an example.

**Step 3.** The user selects, modifies, or discards the proposal.

**Step 4.** Accepted proposals are adopted as mapping rules into the mapping layer. They are then available for all future transforms.

#### Distinction from Transform

| Aspect | teiModeller | Transform |
|---|---|---|
| Question | "How should this be annotated?" | "Annotate this text" |
| Input | Textual phenomenon or user question | Entire TEI body |
| Output | Mapping rule(s) | Annotated TEI-XML |
| Timing | Before the transform (mapping step) | Transform step |
| LLM knowledge | Distilled TEI modules | Base layer + context + mapping |

#### Open Questions (teiModeller)

- Granularity of TEI knowledge modules: how fine should they be divided? Per TEI module, per element group, or per use case? Partially answered: one module per TEI module with separation into reference and modeling knowledge.
- Quality assurance of modules: how are the distilled modules checked for correctness? Answered via Stage 3 (validation) in the distillation pipeline.
- Interaction format: chat-based (question-answer) or form-based (structured input)?
- Integration into the workflow stepper: separate step or part of the mapping step?

---

### 4b. TEI Guidelines Distillation Pipeline

#### Goal

The TEI P5 Guidelines comprise 588 elements in 23 modules (Version 4.10.2, as of September 2025). They are the authoritative reference for TEI modeling decisions but, due to their scope and structure, are neither directly usable by LLMs nor efficiently navigable by users during the annotation process.

The pipeline produces one distilled knowledge module per TEI module, separating two knowledge types:

**Reference knowledge** encompasses the available elements with attributes, class membership, permitted content, and usage context. It answers the question "What exists and how is it defined?"

**Modeling knowledge** encompasses typical annotation patterns, decision alternatives, common errors, and the discursive rationales from the Guidelines. It answers the question "When do I use what and why?"

The separation is necessary because both knowledge types serve different functions in the teiModeller. Reference knowledge is needed for schema guidance and autocompletion; modeling knowledge is needed for the advisory function.

#### Source Structure (23 TEI Modules)

The TEI Guidelines are publicly available at `https://tei-c.org/release/doc/tei-p5-doc/en/html/`. The source consists of two levels.

**Chapter overviews.** Each of the 23 modules corresponds to a chapter of the Guidelines containing discursive explanations, modeling examples, and rationales for design decisions. URLs follow a fixed scheme with two-letter codes.

| Module | Chapter | URL Code | Priority |
|---|---|---|---|
| tei | 1 The TEI Infrastructure | ST.html | Basis |
| header | 2 The TEI Header | HD.html | Basis |
| core | 3 Elements Available in All TEI Documents | CO.html | Basis |
| textstructure | 4 Default Text Structure | DS.html | Basis |
| gaiji | 5 Characters, Glyphs, and Writing Modes | WD.html | Low |
| verse | 6 Verse | VE.html | Low |
| drama | 7 Performance Texts | DR.html | Low |
| spoken | 8 Transcriptions of Speech | TS.html | Low |
| cmc | 9 Computer-mediated Communication | CMC.html | Low |
| dictionaries | 10 Dictionaries | DI.html | Low |
| msdescription | 11 Manuscript Description | MS.html | Medium |
| transcr | 12 Representation of Primary Sources | PH.html | Medium |
| textcrit | 13 Critical Apparatus | TC.html | Low |
| namesdates | 14 Names, Dates, People, and Places | ND.html | High |
| figures | 15 Tables, Formulae, Graphics, and Notated Music | FT.html | Low |
| corpus | 16 Language Corpora | CC.html | Low |
| linking | 17 Linking, Segmentation, and Alignment | SA.html | Medium |
| analysis | 18 Simple Analytic Mechanisms | AI.html | Low |
| iso-fs | 19 Feature Structures | FS.html | Low |
| nets | 20 Graphs, Networks, and Trees | GD.html | Low |
| certainty | 22 Certainty, Precision, and Responsibility | CE.html | Medium |
| tagdocs | 23 Documentation Elements | TD.html | Low |

The priority column is oriented toward the synergy projects. "Basis" means the module should be included in every TEI schema. "High" marks modules with direct relevance for ongoing projects.

**Element references.** Each element has its own reference page at `https://tei-c.org/release/doc/tei-p5-doc/en/html/ref-ELEMENTNAME.html`. These pages follow a consistent schema containing the formal definition, attributes, module and class membership, permitted content, examples, and remarks.

**Class references.** Attribute classes and model classes are listed under `REF-CLASSES-ATTS.html` and `REF-CLASSES-MODEL.html`. They define which attributes and content models apply across groups and are relevant for distillation because they explain why an element inherits certain attributes.

#### 3-Stage Pipeline

**Stage 1 -- Scraping.**
- Input: TEI Guidelines website (HTML)
- Output: Raw text as Markdown files, one per module plus one per element reference

The scraper downloads chapter pages and element reference pages, extracting structured content. HTML tables are converted to Markdown tables, code examples are preserved as code blocks, and cross-references between modules are noted as links.

Technical notes: The Guidelines pages use a consistent HTML layout with navigable sections. The scraper must remove navigation bars, footers, and sidebars, extracting only the main content. Element reference pages have a tabular layout with predictable fields (Module, Attributes, Contained by, May contain, Note, Example) that can be converted to a structured intermediate format (JSON or YAML) before becoming Markdown.

Versioning: The scraper stores the TEI version (currently 4.10.2) as metadata. On a new release, the pipeline is re-executed and differences are traceable.

**Stage 2 -- Distillation.**
- Input: Markdown raw files from Stage 1
- Output: Distilled knowledge modules, one per TEI module

An LLM processes each module file according to a fixed distillation prompt. The prompt is the central quality instrument of the pipeline. It must enforce the separation between reference knowledge and modeling knowledge while ensuring no substantively relevant information is lost.

Distillation prompt structure (draft): For the reference knowledge section, the LLM generates a compact description per element covering: element name, module, key attributes (with brief explanation), typical content, and class membership. For the modeling knowledge section, the LLM extracts and condenses: typical usage patterns, decision alternatives, common errors and misconceptions, and relationships to other modules.

Explicit instruction: The discursive sections of the Guidelines (rationales, historical explanations, modeling discussions) are particularly valuable for modeling knowledge. They must not be treated as "irrelevant details."

Output format per module:

```
# TEI Module: [Module Name]
TEI Version: [Version]
Chapter: [Chapter number and title]

## Reference Knowledge

### [Element Name]
- Attributes: [List with brief description]
- Content: [Permitted content]
- Classes: [Class membership]
- Brief characterization: [1-2 sentences]

[... additional elements ...]

## Modeling Knowledge

### Typical Annotation Patterns
[Patterns with examples]

### Decision Alternatives
[Element A vs. Element B: when to use which?]

### Common Errors
[Errors with explanation]

### Cross-Module Relationships
[Interaction with other modules]
```

**Stage 3 -- Validation.**
- Input: Distilled modules from Stage 2
- Output: Validation report per module, corrected modules if needed

The validation checks three dimensions:

*Completeness:* A second LLM pass compares each distilled module with the raw source and checks whether elements, attributes, or modeling hints are missing. The validation prompt explicitly asks for omissions.

*Correctness:* The validation pass checks whether descriptions in the distilled module match the original definitions. Special attention is given to attribute definitions (data types, permitted values) and content models, because compression is most likely to introduce errors here.

*Spot-check manual review:* For modules with "Basis" and "High" priority, at least one domain expert reviews the distilled modules against the Guidelines. In the pilot run, this concerns the modules `core`, `header`, `namesdates`, and `textstructure`.

#### Pilot Plan

The first run distills not all 23 modules but begins with a single module to validate the pipeline and the distillation prompt.

**Pilot module:** `namesdates` (Chapter 14, ND.html)

Reasons for the choice: The module is substantively relevant for several synergy projects (Stefan Zweig Digital, Schliemann ledgers). It contains both clearly defined elements (`persName`, `placeName`, `orgName`) and elements with complex modeling decisions (`person`, `place`, `event`, `relation`). It has a manageable size (~70 elements) -- large enough to test the pipeline but small enough for manual review. The chapter also contains extensive discursive sections on modeling alternatives, providing a good test for modeling knowledge extraction.

**Success criteria for the pilot:**
- The distilled module must contain all elements of the module (completeness)
- Attribute descriptions must be correct, verifiable against element reference pages (correctness)
- Modeling knowledge must at least correctly represent the alternatives discussed in the Guidelines for `persName` vs. `person` and `placeName` vs. `place` (usability)
- The teiModeller must be able to provide an informed answer to a question like "How do I annotate person names in a letter corpus?" using the distilled module (connectivity)

#### Maintenance

The TEI Guidelines are updated regularly (several releases per year). The pipeline must be re-executable for new releases.

**Version strategy:** Each distilled module carries the TEI version as metadata. On re-execution, a diff between old and new raw source is generated. Only modules whose source chapter has changed are re-distilled. This reduces LLM cost and manual review effort.

#### Repository Structure (Draft)

```
distillation/
  raw/                          # Stage 1: Scraping result
    chapters/
      ST.md                     # Chapter 1: TEI Infrastructure
      HD.md                     # Chapter 2: Header
      ND.md                     # Chapter 14: Names, Dates
      ...
    elements/
      persName.md
      placeName.md
      ...
    meta.json                   # TEI version, scraping date
  modules/                      # Stage 2: Distilled modules
    namesdates.md
    core.md
    header.md
    ...
  validation/                   # Stage 3: Validation reports
    namesdates_validation.md
    ...
  prompts/                      # Prompt templates
    scraping_prompt.md
    distillation_prompt.md
    validation_prompt.md
  pipeline.md                   # Execution guide
```

#### Open Questions (Distillation Pipeline)

- **Element reference granularity:** Should element reference pages be scraped individually and then associated with the chapter text, or does the chapter text alone suffice? The chapter contains discursive explanations, but the reference pages contain the complete formal definitions. The pilot run must determine whether the chapter text is sufficient for distillation or whether reference pages are needed as supplementary input.
- **Prompt stability across modules:** The distillation prompt is developed on the pilot module `namesdates`. It is possible that it requires adaptation for other modules (e.g., `transcr` or `msdescription`) due to different structure or modeling complexity. The question is whether a single prompt works for all modules or whether module-specific adjustments become necessary.
- **Domain-specific extensions:** The TEI Guidelines cover generic modules. For project-specific schemas such as the Bookkeeping Ontology (`bk:`) or the DTA base format, there are no TEI chapters. These extensions would need to be distilled from other sources (project documentation, ODD files). This is a separate pipeline extension, documented here but not specified.
- **LLM selection for distillation:** The choice of LLM for Stages 2 and 3 affects module quality. Distillation requires a model with a large context window because chapters are extensive. Validation can use a different model to avoid systematic bias from a single model.

---

## 5. Development Journal

Chronological log of all development sessions, most recent first.

### Session 16 -- 2026-02-18: Demo Data with Real Sources (Phase A0)

- **Trigger:** Walking-skeleton strategy requires real data instead of placeholders. User proposed three projects: Stefan Zweig Digital (correspondence), DEPCHA (ledger), third example open.
- Created 6 demo files: CoReMA medieval recipe (~50 words, Early New High German) as plaintext + mapping rules + gold-standard TEI; DEPCHA 1718 ledger excerpt with two accounts containing persons, monetary amounts (fl/kr), dates as plaintext + bookkeeping ontology mapping + reference TEI with @ana attributes.
- Added new `bookkeeping` sourceType: `SOURCE_LABELS` extended (4->5 types), `DEFAULT_MAPPINGS` extended, `DEMO_CONFIGS` updated (placeholder demos replaced by real data), `detectType()` extended in app.js.
- Created CLAUDE.md with project-specific instructions.
- Updated knowledge documents: STATUS.md, DECISIONS.md, MODULES.md, STORIES.md, JOURNAL.md.
- **Files changed:** 6 new demo files, constants.js, app.js, CLAUDE.md, 5 knowledge documents.

### Session 15 -- 2026-02-18: Technical Reference (REFERENCE.md)

- **Trigger:** User requested a precise, compact, neutral knowledge document capturing everything known -- beyond the existing SYNTHESIS.md.
- Three parallel agents read all 15 knowledge documents (~6500 lines), all 14 JS modules + HTML (4159 lines JS), CSS (2643 lines), 60 tests, schema (27 elements), demo configuration.
- Created REFERENCE.md: 17 sections covering system overview, file structure, module architecture with integration matrix, complete data flow, all data structures (AppState, DocumentModel, Token, Annotation, ValidationMessage), LLM integration (6 providers, request/response formats, three-layer prompt, confidence mapping), validation (5 levels, algorithms), review workflow, CSS design system (98 custom properties, dual-channel, responsive), architecture patterns, 20+ known issues categorized, test coverage, hardcoded values, research foundation, strategy, metrics.
- Corrected unit test count: 60 (not 51): tokenizer 19, model 23, validator 18.
- **Files changed:** REFERENCE.md (new), INDEX.md.

### Session 14 -- 2026-02-18: Market Analysis, Strategy Decision, Knowledge Synthesis

- **Trigger:** After completing the refactoring (Session 13), the question arose: what are the next steps?
- Two parallel research agents analyzed: tool landscape (10+ TEI annotation tools compared), LLM annotation state of the art, review workflows, state management patterns.
- Central finding: no existing tool combines TEI annotation + LLM support + human review. teiCrafter is first mover.
- Strategy decision: walking-skeleton-first. Validate the end-to-end workflow with a real LLM transform before polishing architecture. SW literature (Cockburn, Freeman/Pryce, Hunt/Thomas) unambiguous. Review workflow is the differentiator.
- Created LANDSCAPE.md (~250 lines): tool landscape, comparison matrix, LLM failure modes, best practices. Created SYNTHESIS.md (~200 lines): compact project overview for onboarding.
- Updated 7 documents: VISION.md, DECISIONS.md, STATUS.md, WORKFLOW.md, STORIES.md, INDEX.md, JOURNAL.md.
- **Files changed:** LANDSCAPE.md (new), SYNTHESIS.md (new), 7 updated knowledge documents.

### Session 13 -- 2026-02-18: Code Quality Refactoring (4 Phases)

- **Trigger:** Comprehensive code analysis of all 14 JS modules, HTML, and CSS (2600+ lines). Overall quality 8.7/10, but app.js had structural debt.
- Phase 1 (Quick wins): Centralized `ANNOTATION_TAGS` in constants.js; CSS bugfixes (`.btn-primary`, `--font-serif`, duplicate `.compare-text`, `prefers-reduced-motion`); path-traversal fix in export.js.
- Phase 2 (Event management): Event delegation with one click listener on `.app-main` using `data-action` attributes; `stepCleanup` pattern for drag-and-drop listeners.
- Phase 3 (app.js structure): Split `openSettingsDialog()` into 3 functions; DRY `AppState.reset()` with `INITIAL_STATE` + `structuredClone()`; double-click guard on transform button.
- Phase 4 (Service refinement): editor.js tab keydown listener cleanup in `destroy()`; validator.js level comments corrected.
- **Files changed:** app.js, constants.js, style.css, export.js, transform.js, preview.js, editor.js, validator.js.

### Session 12 -- 2026-02-18: LLM Provider Update (6 Providers, MODEL_CATALOG)

- **Trigger:** User requested current models, more providers (DeepSeek, Qwen), price transparency, and reasoning indicators.
- Extended `LLM_PROVIDERS` from 4 to 6 providers. Inserted `MODEL_CATALOG` with 17 models including metadata (name, input/output price in USD/1M tokens, context window, reasoning flag).
- Updated existing providers (Gemini 2.0-flash->2.5-flash, GPT-4o->4.1-mini, Claude->4.5-20250514, Ollama llama3.1->3.3). Added DeepSeek and Qwen providers (OpenAI-compatible format).
- Redesigned settings dialog: model free-text field replaced with `<select>` showing model names, prices, and reasoning indicators.
- **Files changed:** constants.js, llm.js, app.js, style.css, STATUS.md, MODULES.md, JOURNAL.md.

### Session 11 -- 2026-02-18: Service Integration (Stages 11--13)

- **Trigger:** Next step after knowledge vault refactoring. The critical gap was missing wiring of service modules in app.js.
- Stage 11 (Transform + LLM): 7 new imports in app.js; AppState extended with `confidenceMap`, `transformStats`, `originalPlaintext`; `performTransform()` replaced with real LLM path via `transform()` with AbortController + Cancel button; LLM settings dialog with provider selection, model, API key, connection test.
- Stage 12 (Validation): `renderValidateStep()` made async using `validate()` from validator.js; schema lazy-loaded; validation messages grouped by level.
- Stage 13 (Export): `renderExportStep()` uses `getExportStats()`, `prepareExport()`, `downloadXml()`, `copyToClipboard()` from export.js; export options UI with checkboxes; 7 inline functions deleted.
- **Files changed:** app.js, style.css (~80 lines added), STATUS.md, MODULES.md, DECISIONS.md, STORIES.md, JOURNAL.md.

### Session 10 -- 2026-02-18: Verification and 12-Point Correction

- **Trigger:** Critical self-review of Session 9 results with 5 parallel verification agents.
- Found 12 problems: 3 high (MODULES.md had incorrect editor.js options, missing model.js APIs, wrong test count 54->51), 5 medium (STORIES.md marked 0.1--0.3 as integrated though editor.js not in app.js; STATUS.md counted tokenizer as integrated via editor.js), 4 low (documentation wording issues).
- All 12 corrected. Updated counts: 4 integrated (not 7), 17 module-ready (not 14), 2/14 modules in app.js (not 3), 51 tests (not 54).
- **Files changed:** MODULES.md, STORIES.md, STATUS.md, ARCHITECTURE.md, WORKFLOW.md, INDEX.md.

### Session 9 -- 2026-02-18: Knowledge Vault Refactoring

- **Trigger:** Comprehensive code analysis of all 14 JS modules revealed significant discrepancy between documentation and implementation. Core finding: all service modules are production-ready, but app.js imports none of them.
- 7 parallel agents analyzed all code, knowledge documents, CSS, HTML, tests, and demo data.
- Created STATUS.md (module status matrix, workflow steps with actual vs. target) and MODULES.md (technical API reference for all 14 modules).
- Renamed teiCrafter.md to VISION.md. Removed YAML frontmatter and Obsidian wiki-links from all files.
- Architectural insight: the critical gap is not missing implementation but missing wiring. All building blocks exist.
- **Files changed:** STATUS.md (new), MODULES.md (new), DECISIONS.md, STORIES.md, ARCHITECTURE.md, DESIGN.md, WORKFLOW.md, INDEX.md, VISION.md.

### Session 8 -- 2026-02-05: Phase 2 Implementation (Stages 0--9)

- **Scope:** Complete implementation of all prototype modules in 10 stages across a single session.
- Stage 0 (Project infrastructure): Refactored monolithic prototype into ES6 module system. Created constants.js and dom.js utilities. Security improvements (XSS prevention, file size validation).
- Stage 0.5 (Visual test matrix): Created visual-matrix.html testing 24 annotation-type/confidence combinations with dual-channel encoding. 4 problem cases identified.
- Stage 1 (Overlay spike, Story 0.2): Created tokenizer.js (state-machine XML tokenizer, 9 token types, 17 unit tests) and editor.js (overlay editor with textarea + pre, scroll-sync, rAF debouncing).
- Stage 2 (Editor foundation, Stories 0.1, 0.3, 0.4): Created model.js (DocumentModel with 4 state layers, snapshot-based undo/redo, 15 unit tests) and extended editor.js with gutter.
- Stage 3 (Import, Stories 1.1--1.3): Created source.js (source panel with plaintext/digitalisat tabs) and storage.js (LocalStorage wrapper).
- Stage 4 (LLM config, Stories Q.1--Q.2): Created llm.js with 4 provider adapters (Gemini, OpenAI, Anthropic, Ollama). API keys stored only in module-scoped Map.
- Stages 5--6 (Mapping/Transform, Stories 2.1--3.3): Created transform.js with three-layer prompt assembly, response parsing, confidence extraction.
- Stage 7 (Review, Stories 4.1--4.3): Created preview.js with inline review (hover action bar: Accept/Edit/Reject) and batch keyboard review (N/P/A/R/E/Escape).
- Stage 8 (Validation, Stories 5.1--5.2): Created validator.js (multi-level validation), schema.js (JSON schema profile), dtabf.json (30+ elements), 12 unit tests.
- Stage 9 (Export, Stories 6.1--6.2): Created export.js with attribute cleanup, blob download, clipboard copy.
- **Files changed:** 14 JS modules, HTML, CSS, 3 test files, 1 schema file.

### Session 7 -- 2026-02-05: User Stories and Distillation Pipeline

- **Trigger:** Evaluate user stories and integrate the TEI Guidelines distillation pipeline as a new specification document.
- Evaluated all 20 user stories against the knowledge base. All consistent with specification documents. Identified gap: missing story for undo/redo. Added Story 0.4 (scope increased from 20 to 21 stories).
- Created DISTILLATION.md specifying the three-stage pipeline (scraping -> distillation -> validation) for producing TEI knowledge modules.
- Created STORIES.md with 21 prototype stories + 2 Phase 3 stories.
- **Files changed:** STORIES.md (new), DISTILLATION.md (new), INDEX.md, teiModeller.md, DECISIONS.md.

### Session 6 -- 2026-02-05: Knowledge Base Consolidation

- **Trigger:** Two parallel knowledge directories (`knowledge/` and `new-knowledge/`) with partially overlapping, partially contradictory content.
- Systematic comparison of all documents. New versions superior in every dimension: less redundancy, prompt architecture specified, validation levels complete, decisions consolidated.
- Merged new-knowledge/ into knowledge/. Deleted TRANSFORM.md (replaced by WORKFLOW.md), legacy directory, and new-knowledge/ directory.
- Key additions: three-layer prompt architecture, five validation levels, four confidence categories, DECISIONS.md with prioritized open questions, teiModeller.md as standalone concept document.
- **Files changed:** INDEX.md, DESIGN.md, ARCHITECTURE.md, teiCrafter.md (overwritten with new-knowledge versions); WORKFLOW.md, DECISIONS.md, teiModeller.md (new); TRANSFORM.md, _legacy/, new-knowledge/ (deleted).

### Session 5 -- 2026-02-05: Complete 5-Step Workflow (v4)

- **Trigger:** Implement the full workflow from import to export with demo data.
- Created demo data directory structure: `data/demo/` with plaintext/, mappings/, expected-output/ subdirectories. Three demo types: HSA letter (correspondence), DTA print (historical print), medieval recipe.
- Implemented all 5 workflow steps: Import (dropzone + demo cards), Mapping (source preview + config), Transform (3-column layout with source/editor/preview), Validate (plaintext comparison + well-formedness), Export (statistics + download + clipboard).
- Rewrote app.js (~290 lines) with AppState, DEMO_CONFIGS, dynamic rendering per step.
- **Files changed:** app.js (rewritten), index.html, style.css, 9 demo data files.

### Session 4 -- 2026-02-05: TEI-Derived Design System (v3)

- **Trigger:** Design system document with TEI-derived color palette.
- Changed layout from 2 columns to 3 columns (40/30/30). New color palette: Navy (#1E3A5F) for header/element names, Gold (#CC8A1E) for accents/active stepper/review-worthy. Fonts changed to Inter + JetBrains Mono. Dual-channel confidence encoding.
- Generalized preview panel to automatically detect source type.
- Created DESIGN.md as the authoritative design specification.
- **Files changed:** DESIGN.md (new), style.css (~1070 lines), index.html, app.js.

### Session 3 -- 2026-02-05: UI Redesign After Screenshot Analysis

- **Trigger:** Analysis of a more mature teiCrafter design screenshot.
- Changed from 3-column to 2-column layout, 6 workflow steps to 5 steps (Import -> Mapping -> Transform -> Validate -> Export). Added gutter markings, correspondence metadata header, granular validation messages, contextual footer.
- **Files changed:** index.html, style.css, app.js.

### Session 2 -- 2026-02-05: UI Prototype Implementation

- Created complete clickable UI prototype: three-column layout with 6-phase workflow, confidence system (certain/review-worthy/problematic), simulated transformation with progress ring, review panel with Accept/Edit/Reject, XML export, responsive design.
- Example content: HSA Benndorf->Schuchardt 1879 letter.
- **Files changed:** docs/index.html, docs/css/style.css, docs/js/app.js (all new).

### Session 1 -- 2026-02-05: Project Start

- **Trigger:** Initialize UI prototype for teiCrafter, published via GitHub Pages from `/docs`.
- Established `docs/` for GitHub Pages UI prototype and `knowledge/` for project knowledge base.
- **Files changed:** Directory structure created.
