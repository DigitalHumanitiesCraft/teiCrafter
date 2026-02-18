# Modul-Referenz

Technische Dokumentation aller JavaScript-Module mit Public API, Abhängigkeiten und bekannten Issues. Aktualisiert bei API-Änderungen.

Stand: 2026-02-18 (Session 11)

---

## Abhängigkeitsdiagramm

```
app.js ──────────────────────────── constants.js, dom.js
   │
   ├──▶ services/transform.js ───── services/llm.js ─── services/storage.js
   ├──▶ services/llm.js (direkt)
   ├──▶ services/validator.js ────── services/schema.js
   ├──▶ services/schema.js (direkt)
   ├──▶ services/export.js
   │
   │  (SOLL, aber noch nicht verdrahtet:)
   ├──▶ model.js ────────────────── constants.js
   ├──▶ editor.js ───────────────── tokenizer.js, dom.js
   ├──▶ preview.js ──────────────── constants.js, dom.js
   └──▶ source.js ───────────────── dom.js

services/llm.js ─────────────────── constants.js, services/storage.js
```

---

## Core-Module

### app.js — Application Shell

**Pfad:** `docs/js/app.js` (~884 Zeilen)

**Importiert:** `constants.js`, `dom.js`, `transform.js`, `llm.js`, `validator.js`, `schema.js`, `export.js`
**Nicht importiert (noch offen):** model.js, editor.js, preview.js, source.js, storage.js

**Interner State:**
- `AppState` — Objekt mit `currentStep`, `inputContent`, `inputFormat`, `fileName`, `demoId`, `sourceType`, `mappingRules`, `context`, `outputXml`, `confidenceMap`, `transformStats`, `originalPlaintext`
- `AppState.set(partial)` — Merge-Update
- `AppState.reset()` — Alle Felder zurücksetzen
- `transformController` — Module-scoped AbortController für Cancel-Support

**Stepper-Funktionen:**
- `renderStep(step)` — Async Router zu 5 Render-Funktionen
- `renderImportStep(container)` — Dropzone, Demos, Dateiverarbeitung
- `renderMappingStep(container)` — Quellentyp, Mapping-Textarea, Kontext
- `renderTransformStep(container)` — 3-Panel mit Tabs, LLM-Transform via transform.js
- `renderValidateStep(container)` — Async, nutzt validator.js + schema.js (lazy-loaded)
- `renderExportStep(container)` — Nutzt export.js (prepareExport, getExportStats, downloadXml, copyToClipboard)

**LLM-Funktionen:**
- `openSettingsDialog()` — Provider, Modell, API-Key, Verbindungstest
- `updateModelBadge()` — Header-Badge aktualisieren
- `performTransform()` — Demo-Modus oder LLM-Aufruf via transform.js

**Bekannte Issues:**
- Event-Listener werden bei jedem `renderStep()` neu angehängt (keine Cleanup-Funktion)
- Kein Error-Boundary — Renderer-Fehler brechen gesamte UI
- HTML als String-Concatenation — fragil, keine Templating-Engine
- `extractPlaintext()` und `isWellFormedXml()` verbleiben inline (erstere für Compare-Panel, letztere für Import-Validierung)

---

### model.js — Reaktives Dokumentenmodell

**Pfad:** `docs/js/model.js` (~240 Zeilen)
**Export:** `class DocumentModel extends EventTarget`

**4 Zustandsschichten:**

| Schicht | Typ | Getter | Setter |
|---------|-----|--------|--------|
| Dokument | `string` | `get xml` | `setXml(xml, {label?, undoable?})`, `keystroke(xml)` |
| Konfidenz | `Map<id, level>` | `get confidenceMap`, `getConfidence(id)` | `setConfidence(id, level)`, `setConfidenceMap(map)` |
| Validierung | `Array<Message>` | `get validationMessages` | `setValidationMessages(msgs)` |
| Review | `Map<id, status>` | `get reviewStatus`, `getReviewStatus(id)`, `get reviewStats` | `setReviewStatus(id, status)` |

**Events:**

| Event | Detail | Auslöser |
|-------|--------|----------|
| `documentChanged` | `{ xml }` | `setXml()`, `keystroke()` |
| `confidenceChanged` | `{ elementId, level }` oder `{ bulk: true }` | `setConfidence()`, `setConfidenceMap()` |
| `validationComplete` | `{ messages }` | `setValidationMessages()` |
| `reviewAction` | `{ elementId, status, prevStatus }` | `setReviewStatus()` |
| `undoRedo` | `{ action, label }` | `undo()`, `redo()` |

**Undo/Redo:**
- `canUndo`, `canRedo` — Boolean-Getter
- `undo()`, `redo()` — Snapshot-basiert, MAX_UNDO=100
- `keystroke()` — Gruppiert aufeinanderfolgende Eingaben (500ms Debounce)
- Snapshots enthalten: XML + Confidence + Review (nicht Validation)

**Weitere Public API:**
- `reset()` — Alle Schichten zurücksetzen (XML, Confidence, Review, Undo-Stack)
- `get fileName` / `set fileName` — Dateiname des geladenen Dokuments
- `get sourceType` / `set sourceType` — Quellentyp (generic, correspondence, print, recipe)

**Tests:** ✅ 21 Tests in `model.test.js`

**Bekannte Issues:**
- Validation-Messages nicht in Undo-Snapshots → Desync bei Undo/Redo
- Kein Input-Validation für Element-IDs oder Status-Werte
- Orphaned Confidence/Review-Einträge für nicht-existierende Elemente möglich

---

### tokenizer.js — XML State-Machine Tokenizer

**Pfad:** `docs/js/tokenizer.js` (~200 Zeilen)
**Exports:** `tokenize(xml) → Token[]`, `TOKEN` Enum

**9 Token-Typen:** `ELEMENT`, `ATTR_NAME`, `ATTR_VALUE`, `DELIMITER`, `COMMENT`, `PI`, `NAMESPACE`, `ENTITY`, `TEXT`

**Token-Struktur:** `{ type, value, start, end }`

**Eigenschaften:**
- Reine Funktion, keine Seiteneffekte
- O(n) linear, kein Backtracking
- Kontiguität-Invariante: `token[i].end === token[i+1].start`
- Graceful Degradation bei Malformed XML (kein throw)

**Tests:** ✅ 17 Tests in `tokenizer.test.js` (inkl. Performance-Benchmark <50ms bei 500 Zeilen)

**Bekannte Issues:**
- Numerische Entity-Referenzen (`&#123;`, `&#xAB;`) nicht erkannt
- CDATA mit eingebettetem `]]>` wird vorzeitig terminiert
- Entity-Längenheuristik: max 12 Zeichen

---

## View-Module

### editor.js — Overlay-Editor

**Pfad:** `docs/js/editor.js` (~240 Zeilen)
**Export:** `createOverlayEditor(container, options) → EditorInstance`

**Options:** `{ value?, readOnly?, onChange?, showGutter? }`

**EditorInstance API:**

| Methode | Beschreibung |
|---------|-------------|
| `getValue()` | Aktuellen XML-String zurückgeben |
| `setValue(xml)` | XML setzen und Highlighting aktualisieren |
| `setLineConfidence(map)` | Gutter-Marker nach Konfidenz-Map einfärben |
| `getLineCount()` | Zeilenanzahl |
| `destroy()` | Cleanup (Event-Listener entfernen) |

**Architektur:** Textarea (transparent, Caret sichtbar) über Pre (Syntax-Highlighting). Scroll-Sync via `scroll`-Event. Input-Handling via `requestAnimationFrame`-Debounce.

**Bekannte Issues:**
- `computeLineConfidence()` ist Stub — gibt immer leere Map zurück (Gutter-Marker sind dekorativ)
- Kein inkrementelles Tokenizing — gesamtes Dokument bei jedem Keystroke
- Tab-Handling: Einfügt 2 Spaces, kein Smart-Indent
- Kein Virtual Scrolling für große Dokumente
- Memory-Leak: Tab-Keydown-Listener wird in `destroy()` nicht entfernt

---

### preview.js — Interaktive Vorschau + Review

**Pfad:** `docs/js/preview.js` (~507 Zeilen)
**Export:** `createPreview(container, options) → PreviewInstance`

**Options:** `{ xml?, confidenceMap?, reviewStatusMap?, onReview?, onFocus? }`

**PreviewInstance API:**

| Methode | Beschreibung |
|---------|-------------|
| `updateXml(xml)` | XML neu rendern (Full-DOM-Rebuild) |
| `updateConfidence(map)` | Konfidenz-Klassen in-place aktualisieren |
| `updateReviewStatus(map)` | Review-Status-Klassen in-place aktualisieren |
| `startBatchReview()` | Batch-Modus starten (Keyboard: N/P/A/R/E/Esc) |
| `stopBatchReview()` | Batch-Modus beenden |
| `focusAnnotation(id)` | Annotation fokussieren und hinscollen |
| `getStats()` | `{ total, reviewed, remaining, sicher, pruefenswert, problematisch }` |
| `annotations` | Readonly Array aller erkannten Annotationen |
| `destroy()` | Cleanup |

**Erkannte Annotation-Tags:** `persName`, `placeName`, `orgName`, `date`, `name`, `bibl`, `term`, `measure`, `foreign`

**Review-Aktionen:**
- Accept (A) → Status `akzeptiert`, Konfidenz → `sicher`
- Edit (E) → Status `editiert`, Konfidenz → `manuell`
- Reject (R) → Status `verworfen`, Konfidenz unverändert

**Bekannte Issues:**
- Auto-ID-Generierung (`persName-1`) ist nicht-deterministisch bei Re-Render → Review-Map-Keys werden stale
- Hover-Bar positioniert sich nicht um bei Viewport-Kante
- Full-DOM-Rebuild bei `updateXml()` — kein Diffing

---

### source.js — Source-Panel

**Pfad:** `docs/js/source.js` (~68 Zeilen)
**Export:** `createSourcePanel(container, options) → SourceInstance`

**Options:** `{ content, fileName?, showDigitalisat? }`

**SourceInstance API:**

| Methode | Beschreibung |
|---------|-------------|
| `setContent(text)` | Textinhalt aktualisieren |
| `destroy()` | Cleanup |

**Bekannte Issues:**
- Digitalisat-Tab ist Platzhalter ("nicht verfügbar")
- Keine Zeilennummern, kein Syntax-Highlighting
- Kein Scroll-Sync mit Editor

---

## Service-Module

### llm.js — Multi-Provider LLM-Service

**Pfad:** `docs/js/services/llm.js` (~260 Zeilen)

**Exports:**

| Funktion | Beschreibung |
|----------|-------------|
| `setApiKey(provider, key)` | Key validieren und im module-scoped Map speichern |
| `hasApiKey(provider?)` | Prüfen ob Key vorhanden (Ollama: immer true) |
| `setProvider(provider)` / `getProvider()` | Aktiven Provider setzen/lesen (persistiert in storage) |
| `setModel(model)` / `getModel()` | Aktives Modell setzen/lesen |
| `getProviderConfigs()` | Sanitisierte Configs → `{ [providerId]: { name, defaultModel, hasKey, authType } }` (keine Keys exponiert) |
| `complete(prompt, {signal?})` | LLM-Aufruf an aktiven Provider |
| `testConnection()` | Verbindungstest mit Minimal-Prompt |

**Provider:** Gemini (`gemini-2.0-flash`), OpenAI (`gpt-4o`), Anthropic (`claude-sonnet-4-5-20250929`), Ollama (`llama3.1`)

**Sicherheit:** Keys in module-scoped Map (nie localStorage/DOM/window), Input-Validierung (256 Chars, printable ASCII), `credentials: 'omit'`, Error-Messages truncated (200 Chars)

---

### transform.js — Prompt-Assembly + Response-Parsing

**Pfad:** `docs/js/services/transform.js` (~223 Zeilen)

**Exports:**

| Funktion | Beschreibung |
|----------|-------------|
| `assemblePrompt(params)` | 3-Schichten-Prompt bauen (Basis + Kontext + Mapping) |
| `getPromptLayers(params)` | Schichten separat zurückgeben (für UI-Preview) |
| `transform(params, {signal?})` | Vollpipeline: Prompt → LLM → XML-Parse → Konfidenz |
| `extractXmlFromResponse(response)` | XML aus LLM-Antwort extrahieren (3 Fallback-Strategien) |
| `extractConfidenceMap(doc)` | Konfidenz-Attribute aus geparster XML-DOM lesen. Iteriert über 9 Annotation-Tags (`persName`, `placeName`, `orgName`, `date`, `name`, `bibl`, `term`, `measure`, `foreign`). Erzeugt Auto-IDs wenn `xml:id` fehlt. Mappt: high→sicher, medium→prüfenswert, low→problematisch, fehlend→prüfenswert |
| `compareText(original, transformed)` | Texterhaltung prüfen |

**Transform-Result:** `{ xml, confidenceMap, stats: { total, sicher, pruefenswert, problematisch } }`

**Konfidenz-Mapping:** high→sicher, medium→prüfenswert, low→problematisch, fehlend→prüfenswert

---

### validator.js — Multi-Level-Validierung

**Pfad:** `docs/js/services/validator.js` (~303 Zeilen)

**Exports:**

| Funktion | Beschreibung |
|----------|-------------|
| `validate(params)` | Alle verfügbaren Level ausführen |
| `checkWellFormedness(xml)` | Level 2: DOMParser-Check → `{ doc, errors }` |
| `checkPlaintext(doc, original)` | Level 1: Texterhaltung mit Word-Similarity |
| `checkSchema(doc, xml)` | Level 3: Element/Attribut-Validierung gegen Schema |
| `checkUnreviewed(reviewStatusMap)` | Level 5: Warnung bei offenen Annotationen |

**Validation-Levels:** 1 Plaintext ✅, 2 Well-Formedness ✅, 3 Schema ✅, 4 XPath 📋 Phase 3, 5 Expert-Review ✅

**Tests:** ✅ 13 Tests in `validator.test.js`

---

### schema.js — Schema-Profil-Abfragen

**Pfad:** `docs/js/services/schema.js` (~94 Zeilen)

**Exports:**

| Funktion | Beschreibung |
|----------|-------------|
| `loadSchema(url?)` | JSON-Profil laden (Default: `../schemas/dtabf.json`) |
| `isLoaded()` | Schema im Speicher? |
| `getSchemaName()` | Profilname |
| `isKnownElement(tag)` | Element im Schema? |
| `isChildAllowed(parent, child)` | Eltern-Kind-Beziehung erlaubt? |
| `isAttributeKnown(tag, attr)` | Attribut für Element bekannt? |
| `getAllowedChildren(tag)` | Erlaubte Kind-Elemente |
| `getElementDef(tag)` | Vollständige Element-Definition |

**Verhalten wenn Schema nicht geladen:** Permissiv (alle Abfragen → true)

---

### export.js — Export-Service

**Pfad:** `docs/js/services/export.js` (~161 Zeilen)

**Exports:**

| Funktion | Beschreibung |
|----------|-------------|
| `prepareExport(xml, options?)` | Attribut-Bereinigung, optional Body-Only |
| `getExportStats(xml)` | Zeilen, Entity-Counts (9 Tag-Typen) |
| `downloadXml(content, fileName)` | Browser-Download via Blob |
| `copyToClipboard(content)` | Clipboard mit Fallback für ältere Browser |
| `getExportFileName(originalName)` | Sauberer Dateiname mit `-tei.xml` Suffix |

**Export-Options:** `{ format: 'full'|'body', keepConfidence: boolean, keepResp: boolean }`

**Bereinigungslogik:** @confidence entfernt (default), @resp="#machine" entfernt oder → "#teiCrafter"

---

### storage.js — localStorage-Wrapper

**Pfad:** `docs/js/services/storage.js` (~69 Zeilen)

**Exports:** `getSetting(key, default?)`, `setSetting(key, value)`, `removeSetting(key)`, `getAllSettings()`

**Namespace:** `teiCrafter_` Prefix. Aktuell genutzt für: `provider`, `model`.

**Sicherheit:** Keine API-Keys. Nur nicht-sensitive Settings.

---

## Utility-Module

### constants.js — Enums, Konfiguration, Icons

**Pfad:** `docs/js/utils/constants.js` (~119 Zeilen)

**Exports:** `CONFIDENCE`, `REVIEW_STATUS`, `ENTITY_TYPES`, `LLM_PROVIDERS`, `MAX_UNDO`, `KEYSTROKE_DEBOUNCE`, `MAX_FILE_SIZE`, `TOAST_DURATION`, `TOAST_DURATION_ERROR`, `SOURCE_LABELS`, `DEMO_CONFIGS`, `ICONS`, `getDefaultMapping(sourceType)`

### dom.js — DOM-Utilities

**Pfad:** `docs/js/utils/dom.js` (~172 Zeilen)

**Exports:** `$(selector, root?)`, `$$(selector, root?)`, `escHtml(str)`, `highlightXml(xml)`, `showToast(msg, type?)`, `showDialog(options)`, `setAriaLive(msg)`

**Sicherheit:** `escHtml()` escaped & < > " ' — verwendet vor jedem `innerHTML`-Assignment

---

**Verknüpfte Dokumente:**
- [STATUS.md](STATUS.md) — Implementierungs-Ist-Stand
- [ARCHITECTURE.md](ARCHITECTURE.md) — Systemdesign und Datenflüsse
