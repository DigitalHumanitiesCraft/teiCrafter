# teiCrafter -- Technical Reference

Last updated: 2026-04-03

Consolidated technical reference for the teiCrafter prototype. Merges per-module API documentation, implementation status, data structures, LLM provider details, and known problems into a single developer-oriented document.

---

## 1. Module Overview

### 1.1 Dependency Diagram

```
app.js ──────────────────────────── constants.js, dom.js
   │
   ├──▶ services/transform.js ───── services/llm.js ─── services/storage.js
   ├──▶ services/llm.js (direct)
   ├──▶ services/validator.js ────── services/schema.js
   ├──▶ services/schema.js (direct)
   ├──▶ services/export.js
   │
   │  (PLANNED, not yet wired:)
   ├──▶ model.js ────────────────── constants.js
   ├──▶ editor.js ───────────────── tokenizer.js, dom.js
   ├──▶ preview.js ──────────────── constants.js, dom.js
   └──▶ source.js ───────────────── dom.js

services/llm.js ─────────────────── constants.js, services/storage.js
```

### 1.2 Integration Matrix

| Module | Type | Lines | Implemented | Integrated in app.js | Unit Tests | Known Issues Summary |
|--------|------|------:|:-----------:|:--------------------:|:----------:|----------------------|
| app.js | Shell | 956 | Done | -- | Missing | No error boundary; HTML string concatenation |
| model.js | State | 247 | Done | Missing | 23 tests | Validation not in undo snapshots |
| tokenizer.js | Parser | 199 | Done | Missing (editor.js not wired) | 19 tests | No numeric entities; CDATA edge case |
| editor.js | View | 242 | Done | Missing | Missing | `computeLineConfidence()` is stub |
| preview.js | View | 501 | Done | Missing | Missing | Non-deterministic ID generation |
| source.js | View | 67 | Done | Missing | Missing | Digitalisat tab is placeholder |
| llm.js | Service | 343 | Done | Done | Missing | No request timeout |
| transform.js | Service | 223 | Done | Done | Missing | ID counter resets per call |
| validator.js | Service | 303 | Done | Done | 18 tests | XPath validation deferred to Phase 3 |
| schema.js | Service | 93 | Done | Done | Missing | Permissive when no schema loaded |
| export.js | Service | 165 | Done | Done | Missing | No pretty-print; no encoding declaration |
| storage.js | Service | 68 | Done | Partial (via llm.js) | Missing | Only provider/model settings |
| constants.js | Utility | 117 | Done | Done | Missing | -- |
| dom.js | Utility | 171 | Done | Done | Missing | -- |

**Summary:** 14/14 modules implemented. 7/14 directly integrated in app.js (constants, dom, llm, transform, validator, schema, export). 1/14 indirectly integrated (storage via llm). 3/14 have unit tests (60 tests total). Approximate test coverage: 21%.

### 1.3 Pipeline Module Matrix (Phase P)

Pipeline modules for automated conversion of szd-htr Page-JSON v0.2 to Minimal-TEI. Node.js CLI, reusable ES6 modules under `docs/js/pipeline/`.

| Module | Type | Lines | Implemented | Tests | Notes |
|--------|------|------:|:-----------:|:-----:|-------|
| pipeline/utils.js | Utility | 70 | Done | Missing | XML escaping, element builder, language codes |
| pipeline/mods-to-header.js | Transform | 180 | Done | Missing | Page-JSON metadata to teiHeader (deterministic) |
| pipeline/page-to-body.js | Transform | 130 | Done | Missing | Pages + regions to flat TEI element list |
| pipeline/div-structurer.js | Transform | 100 | Done | Missing | Heading heuristic; letters as single div |
| pipeline/tei-assembler.js | Orchestrator | 30 | Done | Missing | Combines header + body to complete TEI-XML |
| pipeline/pipeline-validator.js | Validator | 150 | Done | Missing | Tag matching, structure check, plaintext preservation |
| pipeline.mjs (root) | CLI | 190 | Done | 3 integration tests | --page-json, --batch, --validate-only, --force |

**Pipeline test results (2026-04-03):** 3/3 Page-JSON files processed successfully (o_szd.100 Lebensdokument with regions, o_szd.1079 Korrespondenz with regions, o_szd.2305 Aufsatzablage without regions). Plaintext preservation: 99--100%. Schema extension: dtabf.json extended with 30+ elements for msDesc, fw, table, list, header elements.

---

## 2. Per-Module API Reference

### 2.1 app.js -- Application Shell

**Path:** `docs/js/app.js` (956 lines)

**Imports:** `constants.js`, `dom.js`, `transform.js`, `llm.js`, `validator.js`, `schema.js`, `export.js`
**Not imported (open):** model.js, editor.js, preview.js, source.js, storage.js

**Internal State:**

| Symbol | Description |
|--------|-------------|
| `INITIAL_STATE` | Frozen object with default values for all workflow fields |
| `AppState` | Mutable object spread from `INITIAL_STATE`; provides `set(partial)` and `reset()` (via `structuredClone`) |
| `transformController` | Module-scoped `AbortController` for cancel support |
| `transformInProgress` | Boolean guard against double-click during transform |
| `stepCleanup` | Cleanup function for step-specific listeners (e.g., drag-and-drop) |

**Event Delegation:**

A single `click` listener on `.app-main` routes actions via `data-action` attributes. Actions include: `go-step-N`, `select-file`, `load-demo`, `save-mapping`, `transform`, `cancel-transform`, `download-export`, `copy-export`, `new-document`. Tab clicks are delegated via `.tab[data-tab]`.

| Function | Description |
|----------|-------------|
| `handleAction(action, e)` | Central switch for approximately 13 actions |
| `buildSettingsHtml(configs, curProvider, curModel)` | Pure HTML string for the LLM settings dialog |
| `attachSettingsListeners(dialog, backdrop, configs)` | Event binding for the settings dialog |
| `openSettingsDialog()` | Orchestration: creates backdrop + dialog, invokes the above |
| `updateModelBadge()` | Updates the header badge with current model info |
| `buildModelOptions(providerId, selectedModel)` | Renders model option elements with metadata |
| `getProviderInfo(providerId)` | Returns provider info text (local vs. cloud) |

**Known Issues:**
- No error boundary -- renderer errors break the entire UI
- HTML via string concatenation -- fragile, no templating engine
- `extractPlaintext()` and `isWellFormedXml()` remain inline (for compare panel and import validation respectively)

---

### 2.2 model.js -- Reactive Document Model

**Path:** `docs/js/model.js` (247 lines)
**Export:** `class DocumentModel extends EventTarget`

**Four state layers:**

| Layer | Type | Getter | Setter |
|-------|------|--------|--------|
| Document | `string` | `get xml` | `setXml(xml, {label?, undoable?})`, `keystroke(xml)` |
| Confidence | `Map<id, level>` | `get confidenceMap`, `getConfidence(id)` | `setConfidence(id, level)`, `setConfidenceMap(map)` |
| Validation | `Array<Message>` | `get validationMessages` | `setValidationMessages(msgs)` |
| Review | `Map<id, status>` | `get reviewStatus`, `getReviewStatus(id)`, `get reviewStats` | `setReviewStatus(id, status)` |

**Events:**

| Event | Detail | Trigger |
|-------|--------|---------|
| `documentChanged` | `{ xml }` | `setXml()`, `keystroke()` |
| `confidenceChanged` | `{ elementId, level }` or `{ bulk: true }` | `setConfidence()`, `setConfidenceMap()` |
| `validationComplete` | `{ messages }` | `setValidationMessages()` |
| `reviewAction` | `{ elementId, status, prevStatus }` | `setReviewStatus()` |
| `undoRedo` | `{ action, label }` | `undo()`, `redo()` |

**Undo/Redo:**
- `canUndo`, `canRedo` -- boolean getters
- `undo()`, `redo()` -- snapshot-based, MAX_UNDO = 100
- `keystroke()` -- groups consecutive inputs (500 ms debounce)
- Snapshots contain: XML + Confidence + Review (not Validation)

**Additional Public API:**

| Member | Description |
|--------|-------------|
| `reset()` | Reset all layers (XML, Confidence, Review, Undo stack) |
| `get fileName` / `set fileName` | File name of the loaded document |
| `get sourceType` / `set sourceType` | Source type (`generic`, `correspondence`, `print`, `recipe`, `bookkeeping`) |

**Tests:** 23 tests in `model.test.js`

**Known Issues:**
- Validation messages are not included in undo snapshots, causing desync after undo/redo
- No input validation for element IDs or status values
- Orphaned confidence/review entries possible for non-existent elements

---

### 2.3 tokenizer.js -- XML State-Machine Tokenizer

**Path:** `docs/js/tokenizer.js` (199 lines)
**Exports:** `tokenize(xml)` returns `Token[]`; `TOKEN` enum

**Nine token types:** `ELEMENT`, `ATTR_NAME`, `ATTR_VALUE`, `DELIMITER`, `COMMENT`, `PI`, `NAMESPACE`, `ENTITY`, `TEXT`

**Token structure:** `{ type, value, start, end }`

**Properties:**
- Pure function, no side effects
- O(n) linear scan, no backtracking
- Contiguity invariant: `token[i].end === token[i+1].start`
- Graceful degradation on malformed XML (never throws)

**Tests:** 19 tests in `tokenizer.test.js` (including performance benchmark: less than 50 ms for 500 lines)

**Known Issues:**
- Numeric entity references (`&#123;`, `&#xAB;`) not recognized
- CDATA sections with embedded `]]>` terminate prematurely
- Entity length heuristic: maximum 12 characters

---

### 2.4 editor.js -- Overlay Editor

**Path:** `docs/js/editor.js` (242 lines)
**Export:** `createOverlayEditor(container, options)` returns `EditorInstance`

**Options:** `{ value?, readOnly?, onChange?, showGutter? }`

**EditorInstance API:**

| Method | Description |
|--------|-------------|
| `getValue()` | Return the current XML string |
| `setValue(xml)` | Set XML and refresh syntax highlighting |
| `setLineConfidence(map)` | Color gutter markers by confidence map |
| `getLineCount()` | Return line count |
| `destroy()` | Cleanup (remove event listeners) |

**Architecture:** Transparent textarea (caret visible) overlaid on a `<pre>` element (syntax highlighting). Scroll synchronization via the `scroll` event. Input handling via `requestAnimationFrame` debounce.

**Known Issues:**
- `computeLineConfidence()` is a stub -- always returns an empty Map (gutter markers are decorative)
- No incremental tokenizing -- entire document retokenized on every keystroke
- Tab handling: inserts 2 spaces, no smart indent
- No virtual scrolling for large documents
- Memory leak: Tab keydown listener is not removed in `destroy()`

---

### 2.5 preview.js -- Interactive Preview and Review

**Path:** `docs/js/preview.js` (501 lines)
**Export:** `createPreview(container, options)` returns `PreviewInstance`

**Options:** `{ xml?, confidenceMap?, reviewStatusMap?, onReview?, onFocus? }`

**PreviewInstance API:**

| Method | Description |
|--------|-------------|
| `updateXml(xml)` | Re-render XML (full DOM rebuild) |
| `updateConfidence(map)` | Update confidence classes in-place |
| `updateReviewStatus(map)` | Update review status classes in-place |
| `startBatchReview()` | Start batch mode (keyboard: N/P/A/R/E/Esc) |
| `stopBatchReview()` | End batch mode |
| `focusAnnotation(id)` | Focus and scroll to an annotation |
| `getStats()` | Returns `{ total, reviewed, remaining, sicher, pruefenswert, problematisch }` |
| `annotations` | Read-only array of all recognized annotations |
| `destroy()` | Cleanup |

**Recognized annotation tags:** `persName`, `placeName`, `orgName`, `date`, `name`, `bibl`, `term`, `measure`, `foreign`

**Review Actions:**
- Accept (A): status becomes `akzeptiert`, confidence becomes `sicher`
- Edit (E): status becomes `editiert`, confidence becomes `manuell`
- Reject (R): status becomes `verworfen`, confidence unchanged

**Known Issues:**
- Auto-ID generation (`persName-1`) is non-deterministic on re-render, causing review map keys to become stale
- Hover bar does not reposition at viewport edges
- Full DOM rebuild on `updateXml()` -- no diffing

---

### 2.6 source.js -- Source Panel

**Path:** `docs/js/source.js` (67 lines)
**Export:** `createSourcePanel(container, options)` returns `SourceInstance`

**Options:** `{ content, fileName?, showDigitalisat? }`

**SourceInstance API:**

| Method | Description |
|--------|-------------|
| `setContent(text)` | Update text content |
| `destroy()` | Cleanup |

**Known Issues:**
- Digitalisat tab is a placeholder ("not available")
- No line numbers, no syntax highlighting
- No scroll synchronization with editor

---

### 2.7 llm.js -- Multi-Provider LLM Service

**Path:** `docs/js/services/llm.js` (343 lines)

**Exports:**

| Function | Description |
|----------|-------------|
| `setApiKey(provider, key)` | Validate key and store in module-scoped Map |
| `hasApiKey(provider?)` | Check whether a key exists (Ollama: always true) |
| `setProvider(provider)` / `getProvider()` | Set/get active provider (persisted in storage) |
| `setModel(model)` / `getModel()` | Set/get active model |
| `getProviderConfigs()` | Sanitized configs: `{ [providerId]: { name, defaultModel, models, hasKey, authType } }` |
| `getModelCatalog()` | `MODEL_CATALOG` with metadata (name, input/output price, context, reasoning) |
| `getModelsForProvider(provider)` | Available model IDs for a provider |
| `complete(prompt, {signal?})` | LLM call to the active provider |
| `testConnection()` | Connection test with a minimal prompt |

**Providers (6):** Gemini (`gemini-2.5-flash`), OpenAI (`gpt-4.1-mini`), Anthropic (`claude-sonnet-4-5-20250514`), DeepSeek (`deepseek-chat`), Qwen (`qwen-plus`), Ollama (`llama3.3`)

**Security:** Keys stored in a module-scoped `Map` (never exported, never in localStorage / DOM / window). Input validation: max 256 characters, printable ASCII (`/^[\x20-\x7E]*$/`). Fetch uses `credentials: 'omit'`. Error messages truncated to 200 characters.

**Known Issues:**
- No explicit request timeout (relies on browser default of 30-60 seconds)

---

### 2.8 transform.js -- Prompt Assembly and Response Parsing

**Path:** `docs/js/services/transform.js` (223 lines)

**Exports:**

| Function | Description |
|----------|-------------|
| `assemblePrompt(params)` | Build three-layer prompt (base + context + mapping) |
| `getPromptLayers(params)` | Return layers separately (for UI preview) |
| `transform(params, {signal?})` | Full pipeline: prompt, LLM call, XML parse, confidence extraction |
| `extractXmlFromResponse(response)` | Extract XML from LLM response (3 fallback strategies) |
| `extractConfidenceMap(doc)` | Read confidence attributes from parsed XML DOM. Iterates over 9 annotation tags. Generates auto-IDs when `xml:id` is absent. Maps: high to sicher, medium to pruefenswert, low to problematisch, missing to pruefenswert |
| `compareText(original, transformed)` | Check text preservation |

**Transform Result:** `{ xml, confidenceMap, stats: { total, sicher, pruefenswert, problematisch } }`

**Known Issues:**
- ID counter resets per invocation, causing potential collisions across calls

---

### 2.9 validator.js -- Multi-Level Validation

**Path:** `docs/js/services/validator.js` (303 lines)

**Exports:**

| Function | Description |
|----------|-------------|
| `validate(params)` | Execute all available validation levels |
| `checkWellFormedness(xml)` | Level 2: DOMParser check returning `{ doc, errors }` |
| `checkPlaintext(doc, original)` | Level 1: Text preservation via word similarity |
| `checkSchema(doc, xml)` | Level 3: Element/attribute validation against loaded schema |
| `checkUnreviewed(reviewStatusMap)` | Level 5: Warning for unreviewed annotations |

**Tests:** 18 tests in `validator.test.js`

**Known Issues:**
- Level 4 (XPath) deferred to Phase 3
- `checkPlaintext()` has no null guard for `doc`

---

### 2.10 schema.js -- Schema Profile Queries

**Path:** `docs/js/services/schema.js` (93 lines)

**Exports:**

| Function | Description |
|----------|-------------|
| `loadSchema(url?)` | Load JSON profile (default: `../schemas/dtabf.json`) |
| `isLoaded()` | Is a schema currently loaded? |
| `getSchemaName()` | Profile name |
| `isKnownElement(tag)` | Is the element in the schema? |
| `isChildAllowed(parent, child)` | Is the parent-child relationship permitted? |
| `isAttributeKnown(tag, attr)` | Is the attribute known for the element? |
| `getAllowedChildren(tag)` | Allowed child elements |
| `getElementDef(tag)` | Full element definition |

**Behavior when no schema is loaded:** Permissive -- all queries return `true`. Always-allowed attributes: `xml:id`, `xml:lang`, `xmlns`, `n`.

---

### 2.11 export.js -- Export Service

**Path:** `docs/js/services/export.js` (165 lines)

**Exports:**

| Function | Description |
|----------|-------------|
| `prepareExport(xml, options?)` | Attribute cleanup, optional body-only extraction |
| `getExportStats(xml)` | Line count and entity counts (9 tag types) |
| `downloadXml(content, fileName)` | Browser download via Blob |
| `copyToClipboard(content)` | Clipboard with fallback for older browsers |
| `getExportFileName(originalName)` | Clean filename with `-tei.xml` suffix |

**Export Options:** `{ format: 'full' | 'body', keepConfidence: boolean, keepResp: boolean }`

**Cleanup Logic:** `@confidence` removed by default. `@resp="#machine"` removed or replaced with `"#teiCrafter"`.

**Known Issues:**
- No pretty-print
- No XML encoding declaration

---

### 2.12 storage.js -- localStorage Wrapper

**Path:** `docs/js/services/storage.js` (68 lines)

**Exports:** `getSetting(key, default?)`, `setSetting(key, value)`, `removeSetting(key)`, `getAllSettings()`

**Namespace:** `teiCrafter_` prefix. Currently used for: `provider`, `model`.

**Security:** No API keys stored. Only non-sensitive settings.

---

### 2.13 constants.js -- Enums, Configuration, Icons

**Path:** `docs/js/utils/constants.js` (117 lines)

**Exports:**

| Export | Description |
|--------|-------------|
| `CONFIDENCE` | Frozen enum: `SICHER`, `PRUEFENSWERT`, `PROBLEMATISCH`, `MANUELL` |
| `REVIEW_STATUS` | Frozen enum: `OFFEN`, `AKZEPTIERT`, `EDITIERT`, `VERWORFEN` |
| `ENTITY_TYPES` | Frozen enum: `PERS_NAME`, `PLACE_NAME`, `ORG_NAME`, `DATE`, `BIBL`, `TERM` |
| `LLM_PROVIDERS` | Frozen enum: `GEMINI`, `OPENAI`, `ANTHROPIC`, `DEEPSEEK`, `QWEN`, `OLLAMA` |
| `ANNOTATION_TAGS` | Frozen array of 9 tag names (used by transform, export, preview) |
| `MAX_UNDO` | 100 |
| `KEYSTROKE_DEBOUNCE` | 500 (ms) |
| `MAX_FILE_SIZE` | 10 MB (10 * 1024 * 1024) |
| `TOAST_DURATION` | 4000 (ms) |
| `TOAST_DURATION_ERROR` | 8000 (ms) |
| `SOURCE_LABELS` | 5 source types: correspondence, bookkeeping, print, recipe, generic |
| `DEMO_CONFIGS` | 2 demo configurations: bookkeeping, recipe |
| `ICONS` | SVG icon strings: letter, book, recipe, upload, success, settings |
| `getDefaultMapping(sourceType)` | Returns default mapping rules for a given source type |

---

### 2.14 dom.js -- DOM Utilities

**Path:** `docs/js/utils/dom.js` (171 lines)

**Exports:**

| Function | Description |
|----------|-------------|
| `$(selector, root?)` | `querySelector` shorthand |
| `$$(selector, root?)` | `querySelectorAll` shorthand |
| `escHtml(str)` | Escapes `& < > " '` -- used before every `innerHTML` assignment |
| `highlightXml(xml)` | XML syntax highlighting for display |
| `showToast(msg, type?)` | Toast notification |
| `showDialog(options)` | Modal dialog |
| `setAriaLive(msg)` | Accessibility: live region announcement |

---

## 3. Data Structures

### 3.1 AppState (app.js)

```javascript
{
  currentStep: 1–5,
  inputContent: string | null,
  inputFormat: 'plaintext' | 'markdown' | 'xml' | 'docx',
  fileName: string | null,
  demoId: string | null,
  sourceType: 'correspondence' | 'print' | 'recipe' | 'bookkeeping' | 'generic',
  mappingRules: string | null,
  context: { language: string, epoch: string, project: string },
  outputXml: string | null,
  confidenceMap: Map<string, string>,
  transformStats: { total, sicher, pruefenswert, problematisch } | null,
  originalPlaintext: string | null
}
```

Reset via `structuredClone(INITIAL_STATE)`.

### 3.2 DocumentModel Layers (model.js)

```javascript
class DocumentModel extends EventTarget {
  #xmlString: string
  #confidenceMap: Map<elementId, 'sicher' | 'pruefenswert' | 'problematisch' | 'manuell'>
  #validationMessages: ValidationMessage[]
  #reviewStatus: Map<elementId, 'offen' | 'akzeptiert' | 'editiert' | 'verworfen'>

  #undoStack: Snapshot[]      // max 100
  #redoStack: Snapshot[]
  #keystrokeTimer              // 500 ms debounce
  #lastKeystrokeSnapshot
}
```

Note: `DocumentModel` is fully implemented but not used as the state source. `AppState` serves that role in the current prototype.

### 3.3 Token Types (tokenizer.js)

```javascript
{ type: TOKEN.*, value: string, start: number, end: number }
```

Nine types: `ELEMENT`, `ATTR_NAME`, `ATTR_VALUE`, `DELIMITER`, `COMMENT`, `PI`, `NAMESPACE`, `ENTITY`, `TEXT`.

Invariant: all tokens form a contiguous, gap-free coverage of the input string. No exceptions are thrown; malformed XML degrades gracefully.

### 3.4 Annotation (preview.js)

```javascript
{
  id: string,              // xml:id or generated ({tagName}-{counter})
  tagName: string,         // persName, placeName, orgName, date, ...
  text: string,            // Text content of the element
  confidence: string,      // sicher, pruefenswert, problematisch, manuell
  reviewStatus: string     // offen, akzeptiert, editiert, verworfen
}
```

### 3.5 ValidationMessage (validator.js)

```javascript
{
  level: 'error' | 'warning' | 'info',
  source: 'wellformed' | 'plaintext' | 'schema' | 'xpath' | 'expert',
  message: string,
  line?: number,           // 1-based
  elementId?: string
}
```

### 3.6 ANNOTATION_TAGS (constants.js)

```javascript
['persName', 'placeName', 'orgName', 'date', 'name', 'bibl', 'term', 'measure', 'foreign']
```

Centralized constant imported by transform.js, validator.js, export.js, and preview.js.

### 3.7 MODEL_CATALOG (llm.js)

```javascript
{
  'model-id': {
    name: string,        // Human-readable name
    input: number,       // USD per 1M input tokens
    output: number,      // USD per 1M output tokens
    context: number,     // Context window in tokens
    reasoning: boolean   // Whether the model supports reasoning mode
  }
}
```

Contains 17 models across 6 providers. See Section 4 for the complete listing.

---

## 4. LLM Provider Details

### 4.1 Provider Configuration

| Provider | Default Model | Auth Type | Endpoint |
|----------|--------------|-----------|----------|
| Gemini | `gemini-2.5-flash` | URL parameter (`?key=`) | `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` |
| OpenAI | `gpt-4.1-mini` | Bearer token | `https://api.openai.com/v1/chat/completions` |
| Anthropic | `claude-sonnet-4-5-20250514` | `x-api-key` + `anthropic-version` | `https://api.anthropic.com/v1/messages` |
| DeepSeek | `deepseek-chat` | Bearer token | `https://api.deepseek.com/chat/completions` |
| Qwen | `qwen-plus` | Bearer token | `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions` |
| Ollama | `llama3.3` | None | `http://localhost:11434/api/chat` |

DeepSeek and Qwen use the OpenAI-compatible chat completions format.

### 4.2 Request Formats

**Gemini:**
```json
{ "contents": [{ "parts": [{ "text": "<prompt>" }] }] }
```

**OpenAI / DeepSeek / Qwen:**
```json
{ "model": "<model>", "messages": [{"role": "user", "content": "<prompt>"}], "temperature": 0.2 }
```

**Anthropic:**
```json
{ "model": "<model>", "max_tokens": 8192, "messages": [{"role": "user", "content": "<prompt>"}] }
```
Additional headers: `anthropic-version: 2023-06-01`, `anthropic-dangerous-direct-browser-access: true`.

**Ollama:**
```json
{ "model": "<model>", "messages": [{"role": "user", "content": "<prompt>"}], "stream": false }
```

### 4.3 Response Extraction

| Provider | Path to response text |
|----------|-----------------------|
| Gemini | `data.candidates[0].content.parts[0].text` |
| OpenAI / DeepSeek / Qwen | `data.choices[0].message.content` |
| Anthropic | `data.content[0].text` |
| Ollama | `data.message.content` |

### 4.4 Model Catalog

**Gemini Models:**

| Model ID | Display Name | Input (USD/1M) | Output (USD/1M) | Context | Reasoning |
|----------|-------------|---------------:|----------------:|--------:|:---------:|
| `gemini-2.5-flash` | Gemini 2.5 Flash | 0.15 | 0.60 | 1,048,576 | No |
| `gemini-2.5-pro` | Gemini 2.5 Pro | 1.25 | 10.00 | 1,048,576 | Yes |
| `gemini-2.0-flash` | Gemini 2.0 Flash | 0.10 | 0.40 | 1,048,576 | No |

**OpenAI Models:**

| Model ID | Display Name | Input (USD/1M) | Output (USD/1M) | Context | Reasoning |
|----------|-------------|---------------:|----------------:|--------:|:---------:|
| `gpt-4.1` | GPT-4.1 | 2.00 | 8.00 | 1,047,576 | No |
| `gpt-4.1-mini` | GPT-4.1 Mini | 0.40 | 1.60 | 1,047,576 | No |
| `gpt-4.1-nano` | GPT-4.1 Nano | 0.10 | 0.40 | 1,047,576 | No |
| `o4-mini` | o4 Mini | 1.10 | 4.40 | 200,000 | Yes |
| `o3` | o3 | 2.00 | 8.00 | 200,000 | Yes |

**Anthropic Models:**

| Model ID | Display Name | Input (USD/1M) | Output (USD/1M) | Context | Reasoning |
|----------|-------------|---------------:|----------------:|--------:|:---------:|
| `claude-sonnet-4-5-20250514` | Claude Sonnet 4.5 | 3.00 | 15.00 | 200,000 | Yes |
| `claude-haiku-3-5-20241022` | Claude Haiku 3.5 | 0.80 | 4.00 | 200,000 | No |

**DeepSeek Models:**

| Model ID | Display Name | Input (USD/1M) | Output (USD/1M) | Context | Reasoning |
|----------|-------------|---------------:|----------------:|--------:|:---------:|
| `deepseek-chat` | DeepSeek V3 | 0.27 | 1.10 | 131,072 | No |
| `deepseek-reasoner` | DeepSeek R1 | 0.55 | 2.19 | 131,072 | Yes |

**Qwen Models (DashScope):**

| Model ID | Display Name | Input (USD/1M) | Output (USD/1M) | Context | Reasoning |
|----------|-------------|---------------:|----------------:|--------:|:---------:|
| `qwen-max` | Qwen Max | 1.60 | 6.40 | 131,072 | No |
| `qwen-plus` | Qwen Plus | 0.40 | 1.20 | 131,072 | No |
| `qwen-turbo` | Qwen Turbo | 0.10 | 0.30 | 131,072 | No |

**Ollama Models (local, no pricing):**

| Model ID |
|----------|
| `llama3.3` |
| `qwen2.5` |
| `mistral` |
| `gemma2` |
| `phi4` |

### 4.5 Three-Layer Prompt System (transform.js)

**Layer 1 -- Base (generic TEI rules):**
- Produce well-formed XML
- Preserve text exactly -- no alterations
- Add `@confidence="high"|"medium"|"low"` to annotations
- Add `@resp="#machine"` to annotations
- Prioritize precision over recall
- Preserve existing annotations
- Return only XML in a Markdown code block, no explanations

**Layer 2 -- Context:**
- Source type (correspondence, print, recipe, bookkeeping, generic)
- Language (de, la, mhd)
- Epoch (19c, 18c, medieval)
- Project name (optional)

**Layer 3 -- Mapping:**
- User-edited Markdown rules
- Format: `* <tag> Description`
- Optionally filtered by `selectedTypes`

### 4.6 Response Parsing

Three fallback strategies for extracting XML from LLM output:

1. ` ```xml\n...\n``` ` -- Markdown code block with xml language tag
2. ` ```\n...\n``` ` -- Generic Markdown code block
3. Raw `<...>` -- Unquoted XML content

### 4.7 Confidence Mapping

| LLM Output Attribute | Application Category | Color |
|---------------------|---------------------|-------|
| `high` | sicher | Green (#2D8A70) |
| `medium` | pruefenswert | Gold (#CC8A1E) |
| `low` | problematisch | Red (#C0392B) |
| missing | pruefenswert (conservative default) | Gold |

---

## 5. Validation System

### 5.1 Five Validation Levels

| Level | Name | Implemented | Blocks Export | Description |
|------:|------|:-----------:|:------------:|-------------|
| 1 | Plaintext Comparison | Done | No (warning) | Word similarity check, threshold 95% |
| 2 | Well-Formedness | Done | Yes | `DOMParser` + `parsererror` check |
| 3 | Schema Validation | Done | No (warning) | Element, attribute, and parent-child validation against `dtabf.json` |
| 4 | XPath Rules | Missing (Phase 3) | -- | -- |
| 5 | Expert Review | Done | No (warning) | Count of unreviewed annotations |

### 5.2 Plaintext Comparison Algorithm

```
extracted = body.textContent.replace(/\s+/g, ' ').trim()
original  = originalPlaintext.replace(/\s+/g, ' ').trim()

Word Similarity = |Intersection| / max(|SetA|, |SetB|) * 100

>= 95%:  Warning (minor text alteration)
<  95%:  Error (significant text alteration)
== 100%: Info (text perfectly preserved)
```

### 5.3 Schema Profile Details (dtabf.json)

**27 TEI elements:** TEI, teiHeader, fileDesc, titleStmt, title, publicationStmt, sourceDesc, profileDesc, correspDesc, correspAction, text, body, div, p, head, opener, closer, dateline, salute, signed, pb, lb, persName, placeName, orgName, date, name, bibl, term, measure, material, foreign.

Each element defines: `allowedChildren`, `allowedParents`, `attributes`, and optionally `selfClosing`.

**Attribute types:** uri, date, enum, string, number, language.

**Permissive behavior:** When no schema is loaded, all elements and attributes are considered valid. Always-allowed attributes regardless of schema: `xml:id`, `xml:lang`, `xmlns`, `n`.

---

## 6. Implementation Status

### 6.1 Phase Overview

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | UI design, prompt prototyping | Done |
| Phase 2 | Prototype (10 stages) | Partial -- UI shell complete, view integration open |
| Phase 3 | teiModeller, distillation, consolidation | Planned |

### 6.2 Workflow Step: Import

| Aspect | Status | Details |
|--------|--------|---------|
| UI | Done | Dropzone, file chooser, demo cards, format badges |
| File formats | Done | .txt, .md, .xml, .docx (DOCX via JSZip CDN) |
| Demo data | Done | 2 demos with real data: CoReMA recipe, DEPCHA ledger (SZD letter pending) |
| Validation | Done | File size (10 MB), file type, XML well-formedness |
| Service integration | Done | No service required |
| Known gaps | -- | Source type detection uses simple keyword matching |

### 6.3 Workflow Step: Mapping

| Aspect | Status | Details |
|--------|--------|---------|
| UI | Done | Source type selector, mapping textarea, context fields |
| Default mappings | Done | 5 source types with pre-filled rules |
| Service integration | Partial | schema.js not wired (no mapping rule validation) |
| Known gaps | -- | No syntax check, no autocompletion, no preset management |

### 6.4 Workflow Step: Transform

| Aspect | Status | Details |
|--------|--------|---------|
| UI | Done | 3-panel layout, source tabs, editor, preview tabs |
| LLM call | Done | app.js to transform.js to llm.js; real prompt assembly + response parsing |
| Demo mode | Done | Demo files fetched directly (no LLM needed) |
| Settings dialog | Done | 6 providers, model dropdown with pricing/reasoning badge, API key, connection test |
| Confidence mapping | Done | `extractConfidenceMap()` populating `AppState.confidenceMap` + `transformStats` |
| Cancel support | Done | `AbortController`, cancel button during transform |
| Preview | Partial | Regex-based TEI-to-HTML conversion in app.js (not preview.js) |
| Entity extraction | Partial | Regex-based in app.js, fragile with nested structures |
| Known gaps | -- | No streaming, no progress bar (spinner only) |

### 6.5 Workflow Step: Validate

| Aspect | Status | Details |
|--------|--------|---------|
| UI | Done | Plaintext comparison, XML view, validation list with error count |
| Plaintext comparison | Done | Via `validator.js` `checkPlaintext()` (word similarity) |
| XML well-formedness | Done | Via `validator.js` `checkWellFormedness()` |
| Schema validation | Done | Via `validator.js` `checkSchema()` + `schema.js` (lazy-loaded) |
| Unreviewed annotations | Done | Via `validator.js` `checkUnreviewed()` |
| XPath validation | Missing | Phase 3 |
| LLM-as-Judge | Missing | Phase 3 |
| Known gaps | -- | `extractPlaintext()` remains inline in app.js for compare panel |

### 6.6 Workflow Step: Export

| Aspect | Status | Details |
|--------|--------|---------|
| UI | Done | Stats (via `getExportStats`), format selector, download, clipboard |
| Download | Done | Via `export.js` `prepareExport()` then `downloadXml()` |
| Clipboard | Done | Via `export.js` `copyToClipboard()` with fallback |
| Attribute cleanup | Done | `@confidence` and `@resp` removed by default |
| Export options | Done | Checkboxes: keepConfidence, keepResp |
| Entity statistics | Done | Via `export.js` `getExportStats()` (9 tag types) |
| Known gaps | -- | No pretty-print, no encoding declaration |

### 6.7 Cross-Cutting Concerns

| Concern | Status | Details |
|---------|--------|---------|
| Scroll sync editor-to-preview | Missing | Only editor-internal (textarea to pre to gutter) |
| Cursor coupling | Missing | No cross-panel synchronization |
| DocumentModel usage | Missing | app.js uses its own `AppState`, not `DocumentModel` |
| Undo/Redo in UI | Missing | model.js has undo/redo, but no Ctrl+Z handler in app.js |
| Persistence | Missing | No localStorage for document state (only LLM provider) |
| Error handling | Partial | try-catch with toast, but no error boundary |
| Accessibility | Partial | ARIA labels in HTML, focus-visible CSS, but no screen reader testing |
| Responsive design | Done | 3 breakpoints (desktop, tablet, mobile) |

---

## 7. Known Problems

### 7.1 Critical

| Problem | Module | Impact |
|---------|--------|--------|
| View modules not integrated | app.js | Preview is regex-based HTML; no review functionality in the UI |
| Never tested with a real LLM | app.js, transform.js | Core workflow unvalidated; demo data available (Phase A0) |
| Few-shot examples missing | transform.js | Highest single lever for annotation quality |

### 7.2 Important

| Problem | Module | Impact |
|---------|--------|--------|
| DocumentModel not used as state source | app.js, model.js | No undo/redo in UI, no observer synchronization |
| `computeLineConfidence()` is a stub | editor.js | Always returns empty Map; gutter markers are decorative |
| Non-deterministic ID generation on re-render | preview.js | Review map keys become stale after `updateXml()` |
| ID counter resets per transform call | transform.js | Potential ID collisions across successive calls |
| Validation messages not in undo snapshots | model.js | Desync of validation state after undo/redo |
| No input validation for element IDs | model.js | Orphaned confidence/review entries possible |
| No explicit request timeout | llm.js | Relies on browser default (30-60 seconds) |

### 7.3 Minor -- Code Defects

| Problem | Module |
|---------|--------|
| Tab keydown listener not removed in `destroy()` | editor.js |
| `checkPlaintext()` has no null guard for `doc` | validator.js |
| `detectType()` uses naive substring heuristic | app.js |
| DOCX text extraction loses formatting | app.js |
| Hover bar does not reposition at viewport edges | preview.js |

### 7.4 Minor -- CSS Defects

| Problem | Location |
|---------|----------|
| Duplicated `.gutter-line` rule | style.css lines ~500 and ~2112 |
| Duplicated `.source-preview` rule | style.css lines ~1527 and ~2054 |
| date (amber) + pruefenswert (gold tint): low contrast | Dual-channel color combination |
| placeName (teal) + sicher (green tint): low contrast | Dual-channel color combination |

### 7.5 Architecture Gaps

| Gap | Description | Priority |
|-----|-------------|----------|
| No error boundary | Renderer errors break the entire UI | Phase B |
| HTML string concatenation | Fragile, no templating engine | Phase C |
| No incremental tokenizing | Entire document retokenized on every keystroke | Phase C |
| No virtual scrolling | Large documents may be slow in editor | Phase 3 |
| Numeric entity references not recognized | `&#123;`, `&#xAB;` in tokenizer | Phase 3 |
| CDATA with embedded `]]>` | Premature termination in tokenizer | Phase 3 |
| Digitalisat tab is placeholder | source.js | Phase 3 |

---

## 8. Hardcoded Values

| Value | Location | Description |
|-------|----------|-------------|
| `MAX_UNDO`: 100 | constants.js | Undo stack size |
| `KEYSTROKE_DEBOUNCE`: 500 ms | constants.js | Keystroke grouping interval |
| `MAX_FILE_SIZE`: 10 MB | constants.js | Upload size limit |
| `TOAST_DURATION`: 4000 ms | constants.js | Toast notification visibility |
| `TOAST_DURATION_ERROR`: 8000 ms | constants.js | Error toast visibility |
| Tab width: 2 spaces | editor.js | Tab key behavior |
| Entity max length: 12 characters | tokenizer.js | Entity recognition heuristic |
| Similarity threshold: 95% | validator.js | Plaintext comparison pass/fail boundary |
| Anthropic `max_tokens`: 8192 | llm.js | Maximum output length for Anthropic |
| Temperature: 0.2 | llm.js (via provider configs) | For OpenAI, DeepSeek, Qwen |
| Hover delay: 150 ms | preview.js | Review hover bar appearance delay |
| Confidence priority order | editor.js | problematisch > pruefenswert > sicher > manuell |
| API key max length: 256 chars | llm.js | Key validation limit |
| Error message truncation: 200 chars | llm.js | Maximum length of error text from API responses |
| `anthropic-version`: `2023-06-01` | llm.js | Anthropic API version header |

---

## 9. Test Coverage

### 9.1 Test Infrastructure

Browser-based test runner at `docs/tests/test-runner.html`. No Node.js dependency. Pattern:

```javascript
const { describe, it, assert, assertEqual } = window.__test;
```

### 9.2 Test Distribution

| Module | Test File | Tests | Groups | Coverage Notes |
|--------|-----------|------:|-------:|----------------|
| tokenizer.js | `tokenizer.test.js` | 19 | 5 | All 9 token types, malformed XML, performance (less than 50 ms for 500 lines) |
| model.js | `model.test.js` | 23 | 7 | All 4 layers, undo/redo, keystroke grouping, events, reset |
| validator.js | `validator.test.js` | 18 | 4 | Well-formedness, plaintext comparison, expert review, cascading |
| **Total** | | **60** | **16** | Approximately 21% of codebase |

### 9.3 Not Tested

The following modules have no unit tests: llm.js, transform.js, schema.js, export.js, app.js, editor.js, preview.js, source.js, dom.js, constants.js.

Schema validation (Level 3) is imported but not directly tested. CDATA, DOCTYPE, and Unicode handling in the tokenizer are not tested.

---

## 10. Completed Milestones

| Stage | Description | Commit | Date |
|------:|-------------|--------|------|
| 0 | ES6 module infrastructure | -- | 2026-02 |
| 0.5 | Visual test matrix (24 combinations) | -- | 2026-02 |
| 1 | Overlay spike (no scroll drift) | -- | 2026-02 |
| 2 | Editor foundation (tokenizer + model + tests) | -- | 2026-02 |
| 3 | Import (source panel) | -- | 2026-02 |
| 4 | LLM configuration (4 providers) | `d7fea19` | 2026-02 |
| 5+6 | Mapping + Transform (prompt + parsing) | `dba1b31` | 2026-02 |
| 7 | Review (inline + batch) | `a126988` | 2026-02 |
| 8 | Validation (schema + validator) | `3f77725` | 2026-02 |
| 9 | Export (cleanup + download) | `7742521` | 2026-02 |
| 11 | Service integration: Transform + LLM + settings dialog | -- | 2026-02 |
| 12 | Service integration: Validator + Schema | -- | 2026-02 |
| 13 | Service integration: Export + options UI | -- | 2026-02 |
| -- | LLM provider update: 6 providers, MODEL_CATALOG, model dropdown | -- | 2026-02 |
| -- | Refactoring: event delegation, ANNOTATION_TAGS DRY, CSS bugfixes, security fix | -- | 2026-02 |
| A1 | Phase A1: Demo data with real sources (CoReMA, DEPCHA), bookkeeping sourceType | -- | 2026-02 |
