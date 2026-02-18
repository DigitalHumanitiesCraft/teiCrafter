# teiCrafter – Technische Referenz

Vollständige technische Dokumentation des Projekts. Destilliert aus 15 Wissensdokumenten, 14 JS-Modulen, 2643 Zeilen CSS, 27 Schema-Elementen und 60 Unit-Tests. Ziel: Ein Agent oder Entwickler kann mit diesem Dokument ohne Quellcode-Zugriff arbeiten.

Stand: 2026-02-18 (Session 16)

Abgrenzung zu SYNTHESIS.md: SYNTHESIS.md ist das 5-Minuten-Onboarding (Was, Warum, Wohin). REFERENCE.md ist die technische Tiefe (Wie, Womit, Welche Grenzen).

---

## 1. Systemübersicht

### 1.1 Was ist teiCrafter?

Browserbasiertes Werkzeug zur LLM-gestützten TEI-XML-Annotation von Plaintext. Kein Server, kein Account, kein Build-Step. Statische Webseite, deployed via GitHub Pages aus `/docs`.

### 1.2 Pipeline-Position

```
Bild → coOCR HTR → teiCrafter → ediarum/GAMS/Publikation
       (Transkription)  (Annotation)    (Tiefenerschließung)
```

### 1.3 Epistemische Grundlage

LLMs erzeugen plausible Annotationen, können deren Korrektheit nicht zuverlässig beurteilen. Der Mensch ist strukturell notwendig. Designkonsequenz: Keine Annotation wird automatisch akzeptiert. Jede durchläuft Human Review (Accept/Edit/Reject).

### 1.4 Strategische Differenziatoren

1. **Zero Infrastructure** — Eliminiert die #1-Adoptionsbarriere in DH
2. **LLM + obligatorischer Human Review** — Tedium reduziert, wissenschaftliche Autorität bewahrt
3. **Schema-Profil-geführter Output** — JSON-Schema verhindert halluziniertes Markup
4. **Bring Your Own API Key (6 Provider)** — Kein Vendor Lock-in

### 1.5 Marktposition (Stand 2026-02)

Analyse von 10+ DH-Werkzeugen (Oxygen, ediarum, TEI Publisher, CATMA, Transkribus, eScriptorium, LEAF-Writer, JinnTap, FromThePage, EVT, TextGrid) bestätigt: Kein Tool kombiniert TEI-Annotation + LLM + Human Review + Browser-only. teiCrafter ist First Mover in dieser Nische. Nächster Vergleichspunkt: JinnTap (e-editiones, TEI 2025) — WYSIWYM-Editor, aber ohne LLM-Integration.

---

## 2. Dateistruktur

```
docs/
├── index.html              82 Zeilen, Entry Point, 5-Step-Stepper
├── css/style.css           2643 Zeilen, 98 Custom Properties, TEI-Farbsystem
├── js/
│   ├── app.js              956 Zeilen, Application Shell, Workflow-Orchestrierung
│   ├── model.js            248 Zeilen, DocumentModel (EventTarget), 4 Layers, Undo/Redo
│   ├── tokenizer.js        200 Zeilen, State-Machine XML-Tokenizer, 9 Token-Typen
│   ├── editor.js           243 Zeilen, Overlay-Editor (Textarea + Pre + Gutter)
│   ├── preview.js          502 Zeilen, Interaktive Vorschau, Inline/Batch-Review
│   ├── source.js            68 Zeilen, Source-Panel (Plaintext/Digitalisat-Tabs)
│   ├── services/
│   │   ├── llm.js          344 Zeilen, 6 Provider, MODEL_CATALOG, API-Key-Isolation
│   │   ├── transform.js    224 Zeilen, 3-Layer-Prompt, Response-Parsing, Konfidenz
│   │   ├── validator.js    304 Zeilen, 4 Validierungsebenen
│   │   ├── schema.js        94 Zeilen, JSON-Schema-Profil, Lazy Loading
│   │   ├── export.js       166 Zeilen, Attribut-Bereinigung, Download, Clipboard
│   │   └── storage.js       69 Zeilen, localStorage-Wrapper (nur Provider/Model)
│   └── utils/
│       ├── constants.js    ~180 Zeilen, Enums, Configs, Icons, ANNOTATION_TAGS, DEMO_CONFIGS
│       └── dom.js          172 Zeilen, $, $$, escHtml, showToast, showDialog
├── schemas/dtabf.json      27 TEI-Elemente, DTABf-Subset
├── tests/                  60 Unit-Tests (tokenizer: 19, model: 23, validator: 18)
└── data/demo/              2 echte Demos (Rezept, Rentrechnung) + 1 Platzhalter (Brief)
    ├── plaintext/          recipe-medieval.txt, rentrechnung-1718.txt
    ├── mappings/           recipe-docta.md, bookkeeping-depcha.md
    └── expected-output/    recipe-medieval-tei.xml, rentrechnung-1718-tei.xml
```

Gesamt: 4159 Zeilen JavaScript, 2643 Zeilen CSS, 82 Zeilen HTML.

---

## 3. Modularchitektur

### 3.1 Integrationsmatrix

| Modul | Typ | In app.js integriert | Tests | Abhängigkeiten |
|-------|-----|---------------------|-------|----------------|
| app.js | Shell | — | Nein | Alle außer source.js |
| model.js | State | Importiert, nicht genutzt | 23 | Keine |
| tokenizer.js | Parser | Via editor.js | 19 | Keine |
| editor.js | View | Importiert, nicht genutzt | Nein | tokenizer.js |
| preview.js | View | Importiert, nicht genutzt | Nein | Keine |
| source.js | View | Importiert, nicht genutzt | Nein | Keine |
| llm.js | Service | Ja | Nein | storage.js |
| transform.js | Service | Ja | Nein | llm.js |
| validator.js | Service | Ja | 18 | schema.js |
| schema.js | Service | Ja | Nein | Keine |
| export.js | Service | Ja | Nein | constants.js |
| storage.js | Service | Indirekt (via llm.js) | Nein | Keine |
| constants.js | Utility | Ja | Nein | Keine |
| dom.js | Utility | Ja | Nein | Keine |

Kernproblem: 3 View-Module + model.js sind implementiert aber nicht verdrahtet. app.js rendert alle Steps via Inline-HTML und Regex-basierter XML-Darstellung.

### 3.2 Datenfluss

```
User → Import (app.js)
         │
         ├── processFile(file) → AppState.inputContent
         │     Format-Erkennung: .txt/.md/.xml/.docx
         │     DOCX: JSZip → word/document.xml → DOMParser → Textextraktion
         │     Quellentyp: Heuristik (Substring-Matching)
         │
         ▼
       Mapping (app.js)
         │
         ├── Quellentyp-Auswahl → DEFAULT_MAPPINGS[type]
         ├── Editierbare Regeln (Textarea)
         ├── Kontext: { language, epoch, project }
         │
         ▼
       Transform (transform.js → llm.js)
         │
         ├── assemblePrompt(basis + kontext + mapping + inputContent)
         ├── llm.complete(prompt, {signal}) → LLM-Response
         ├── extractXmlFromResponse(response) → XML-String
         ├── DOMParser-Validierung
         ├── extractConfidenceMap(xml) → Map<elementId, confidence>
         ├── Statistik: {total, sicher, pruefenswert, problematisch}
         │
         ▼
       Validate (validator.js + schema.js)
         │
         ├── Level 1: Wohlgeformtheit (DOMParser)
         ├── Level 2: Plaintext-Vergleich (Wort-Similarität, Schwelle 95%)
         ├── Level 3: Schema-Validierung (Element/Attribut/Parent-Child)
         ├── Level 4: XPath-Regeln (Phase 3)
         ├── Level 5: Expert-Review (Zählung ungeprüfter Annotationen)
         │
         ▼
       Export (export.js)
         │
         ├── prepareExport(xml, {format, keepConfidence, keepResp})
         │     Entfernt: @confidence, @resp="#machine"
         │     Optional: @resp → "#teiCrafter"
         │     Format: full (ganzes TEI) oder body-only
         ├── downloadXml(content, fileName) → Blob + <a>-Click
         └── copyToClipboard(content) → navigator.clipboard (+ Fallback)
```

---

## 4. Zentrale Datenstrukturen

### 4.1 AppState (app.js)

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

### 4.2 DocumentModel (model.js) — nicht als State-Quelle genutzt

```javascript
class DocumentModel extends EventTarget {
  // 4 Zustandsschichten:
  #xmlString: string
  #confidenceMap: Map<elementId, 'sicher'|'pruefenswert'|'problematisch'|'manuell'>
  #validationMessages: ValidationMessage[]
  #reviewStatus: Map<elementId, 'offen'|'akzeptiert'|'editiert'|'verworfen'>

  // Undo/Redo:
  #undoStack: Snapshot[]      // Max 100
  #redoStack: Snapshot[]
  #keystrokeTimer              // 500ms Debounce
  #lastKeystrokeSnapshot

  // Events:
  // 'documentChanged'    → { xml }
  // 'confidenceChanged'  → { elementId, level } | { bulk: true }
  // 'validationComplete' → { messages }
  // 'reviewAction'       → { elementId, status, prevStatus } | { bulk: true }
  // 'undoRedo'           → { action: 'undo'|'redo', label }
}
```

### 4.3 Token (tokenizer.js)

```javascript
{ type: TOKEN.*, value: string, start: number, end: number }
// TOKEN: ELEMENT, ATTR_NAME, ATTR_VALUE, DELIMITER, COMMENT, PI, NAMESPACE, ENTITY, TEXT
```

Invariante: Alle Tokens bilden lückenlose Abdeckung des Inputs. Kein throw — graceful degradation bei Malformed XML.

### 4.4 Annotation (preview.js)

```javascript
{
  id: string,              // xml:id oder generiert ({tagName}-{counter})
  tagName: string,         // persName, placeName, orgName, date, ...
  text: string,            // Textinhalt des Elements
  confidence: string,      // sicher, pruefenswert, problematisch, manuell
  reviewStatus: string     // offen, akzeptiert, editiert, verworfen
}
```

### 4.5 ValidationMessage (validator.js)

```javascript
{
  level: 'error' | 'warning' | 'info',
  source: 'wellformed' | 'plaintext' | 'schema' | 'xpath' | 'expert',
  message: string,
  line?: number,           // 1-basiert
  elementId?: string
}
```

### 4.6 ANNOTATION_TAGS (constants.js)

```javascript
['persName', 'placeName', 'orgName', 'date', 'name', 'bibl', 'term', 'measure', 'foreign']
```

Zentralisiert, importiert von transform.js, validator.js, export.js, preview.js.

---

## 5. LLM-Integration

### 5.1 Provider-Konfiguration (llm.js)

| Provider | Default-Modell | Auth-Typ | Endpoint |
|----------|---------------|----------|----------|
| Gemini | gemini-2.5-flash | URL-Param (`?key=`) | generativelanguage.googleapis.com |
| OpenAI | gpt-4.1-mini | Bearer Token | api.openai.com/v1/chat/completions |
| Anthropic | claude-sonnet-4-5-20250514 | x-api-key + anthropic-version | api.anthropic.com/v1/messages |
| DeepSeek | deepseek-chat | Bearer Token | api.deepseek.com/chat/completions |
| Qwen | qwen-plus | Bearer Token | dashscope.aliyuncs.com |
| Ollama | llama3.3 | Keine | localhost:11434/api/chat |

MODEL_CATALOG: 15+ Modelle mit Input/Output-Preisen pro 1M Tokens, Kontextlänge, Reasoning-Flag.

### 5.2 Sicherheitsmodell

- API-Keys: Module-scoped `Map` in llm.js. Nie exportiert, nie in DOM, localStorage, window, cookies, IndexedDB.
- Key-Validierung: Max 256 Zeichen, printable ASCII (`/^[\x20-\x7E]*$/`).
- Fetch: `credentials: 'omit'`.
- Storage: Nur Provider-Name und Modell-Name in localStorage (Prefix: `teiCrafter_`).

### 5.3 Request-Formate (pro Provider)

- **Gemini:** `{ contents: [{ parts: [{ text }] }] }`
- **OpenAI/DeepSeek/Qwen:** `{ model, messages: [{role: 'user', content}], temperature: 0.2 }`
- **Anthropic:** `{ model, max_tokens: 8192, messages: [{role: 'user', content}] }` + `anthropic-dangerous-direct-browser-access: true`
- **Ollama:** `{ model, messages: [{role: 'user', content}], stream: false }`

### 5.4 Response-Extraktion

- **Gemini:** `data.candidates[0].content.parts[0].text`
- **OpenAI/DeepSeek/Qwen:** `data.choices[0].message.content`
- **Anthropic:** `data.content[0].text`
- **Ollama:** `data.message.content`

### 5.5 Dreischichten-Prompt (transform.js)

**Layer 1 — Basis (generische TEI-Regeln):**
- Wohlgeformtes XML erzeugen
- Text nicht verändern — exakt erhalten
- `@confidence="high"|"medium"|"low"` hinzufügen
- `@resp="#machine"` hinzufügen
- Präzision vor Recall
- Bestehende Annotationen erhalten
- Nur XML in Markdown-Codeblock, keine Erklärungen

**Layer 2 — Kontext:**
- Quellentyp (correspondence, print, recipe, generic)
- Sprache (de, la, mhd)
- Epoche (19c, 18c, medieval)
- Projektname (optional)

**Layer 3 — Mapping:**
- Vom User editierte Markdown-Regeln
- Format: `* <tag> Beschreibung`
- Optional gefiltert nach selectedTypes

### 5.6 Response-Parsing

3 Fallback-Strategien:
1. ` ```xml\n...\n``` ` (Markdown mit xml-Tag)
2. ` ```\n...\n``` ` (generischer Markdown-Codeblock)
3. Raw `<...>` (unquotiertes XML)

### 5.7 Konfidenz-Mapping

| LLM-Output | Anwendungskategorie | Farbe |
|------------|-------------------|-------|
| high | sicher | Grün (#2D8A70) |
| medium | pruefenswert | Gold (#CC8A1E) |
| low | problematisch | Rot (#C0392B) |
| fehlend | pruefenswert (konservativ) | Gold |

---

## 6. Validierung

### 6.1 Fünf Ebenen

| Ebene | Implementiert | Blockiert Export | Beschreibung |
|-------|-------------|-----------------|--------------|
| 1: Wohlgeformtheit | Ja | Ja | DOMParser + parsererror-Check |
| 2: Plaintext-Vergleich | Ja | Nein (Warnung) | Wort-Similarität, Schwelle 95% |
| 3: Schema-Validierung | Ja | Nein (Warnung) | Element, Attribut, Parent-Child gegen dtabf.json |
| 4: XPath-Regeln | Nein (Phase 3) | — | — |
| 5: Expert-Review | Ja | Nein (Warnung) | Zählung ungeprüfter Annotationen |

### 6.2 Plaintext-Vergleich-Algorithmus

```
extracted = body.textContent.replace(/\s+/g, ' ').trim()
original  = originalPlaintext.replace(/\s+/g, ' ').trim()
Wort-Similarität = |Schnittmenge| / max(|SetA|, |SetB|) × 100
≥ 95%: Warnung. < 95%: Fehler. = 100%: Info.
```

### 6.3 Schema-Profil (dtabf.json)

27 TEI-Elemente: TEI, teiHeader, fileDesc, titleStmt, title, publicationStmt, sourceDesc, profileDesc, correspDesc, correspAction, text, body, div, p, head, opener, closer, dateline, salute, signed, pb, lb, persName, placeName, orgName, date, name, bibl, term, measure, material, foreign.

Jedes Element definiert: `allowedChildren`, `allowedParents`, `attributes`, optional `selfClosing`.

Attribut-Typen: uri, date, enum, string, number, language.

Permissives Verhalten: Wenn kein Schema geladen, gelten alle Elemente/Attribute als gültig.

---

## 7. Review-Workflow

### 7.1 Inline-Review (preview.js)

- Hover auf Annotation → Compact Action Bar (Accept ✓, Edit ✎, Reject ✕)
- Accept: Konfidenz → sicher, Status → akzeptiert
- Edit: Konfidenz → manuell, Status → editiert
- Reject: Tag entfernt, Text erhalten, Status → verworfen
- 150ms Hover-Delay

### 7.2 Batch-Review (preview.js)

Tastaturgesteuert:
- **N** = Nächste ungeprüfte
- **P** = Vorherige ungeprüfte
- **A** = Akzeptieren + Weiter
- **R** = Verwerfen + Weiter
- **E** = Editieren + Weiter
- **Esc** = Batch-Modus beenden

Fortschrittsanzeige: "7/12 reviewed" mit proportionalem Gold-Balken.

### 7.3 Status: Nicht in app.js erreichbar

Beide Review-Modi sind vollständig in preview.js implementiert, aber preview.js ist nicht in app.js integriert. Die aktuelle Vorschau in app.js ist Regex-basiertes Inline-HTML ohne Review-Funktionalität.

---

## 8. Visuelles System (CSS)

### 8.1 Design-Tokens (98 Custom Properties)

**Farben:**
- Oberfläche: `--color-surface: #FAFAF7`, `--color-panel: #FFFFFF`
- Header: `--color-header: #1E3A5F` (Navy)
- Akzent: `--color-gold: #CC8A1E`, `--color-blue: #2B5EA7`
- Konfidenz: `--color-confident: #2D8A70`, `--color-review: #CC8A1E`, `--color-problem: #C0392B`

**Typografie:**
- UI: Inter. Code: JetBrains Mono. Vorschau: Georgia.
- Größen: xs (0.75rem), sm (0.8125rem), base (0.875rem), lg (1.125rem)

**Spacing:** 8px-Raster (4, 8, 12, 16, 24, 32px)

**Z-Index:** 0 (Basis), 10 (Toolbar), 50 (Review-Hover), 100 (Dropdown), 200 (Modal/Dialog), 300 (Toast), 400 (Dialog)

### 8.2 TEI-Annotationsfarben (Dual-Channel-Encoding)

**Kanal 1 — Typ (Unterstreichungsfarbe):**

| Tag | Farbe | Hex |
|-----|-------|-----|
| persName | Blau | #3B7DD8 |
| placeName | Teal | #2A9D8F |
| orgName | Violett | #7B68AE |
| date | Amber | #B8860B |
| bibl | Rose | #C47A8A |
| term | Grau | #6B7280 |

**Kanal 2 — Konfidenz (Hintergrund-Tint + Linienstil):**

| Konfidenz | Tint | Linienstil |
|-----------|------|-----------|
| sicher | Grün (#E8F5F0) | solid |
| pruefenswert | Gold (#FEF5E7) | dashed |
| problematisch | Rot (#FDECEB) | dotted |
| manuell | — | double |

**Review-Status (Opacity + Dekoration):**
- akzeptiert: opacity 0.85
- verworfen: opacity 0.4 + line-through
- editiert: dashed outline

### 8.3 Responsive Breakpoints

- Tablet (≤1200px): 2 Spalten, Source ausgeblendet
- Mobile (≤768px): 1 Spalte, Stepper ausgeblendet
- `prefers-reduced-motion`: Alle Animationen auf 0.01ms

### 8.4 Layout (5-Step-Stepper)

- Step 1 (Import): Zentriert, Dropzone + 3 Demo-Karten
- Step 2 (Mapping): 2 Spalten (Source schmal + Mapping breit)
- Step 3 (Transform): 3 Spalten (Source 25% + Editor 45% + Preview 30%)
- Step 4 (Validate): 2 Spalten (Compare + Checks)
- Step 5 (Export): Zentriert, Export-Karte

---

## 9. Architekturmuster

### 9.1 Event-Delegation (app.js)

Ein Click-Listener auf `.app-main`, Routing via `data-action`-Attribute:
```html
<button data-action="start-transform">Transformieren</button>
```
`handleAction(action)` als Switch über ~13 Actions. Kein Listener-Leak bei Step-Wechsel.

### 9.2 stepCleanup (app.js)

```javascript
let stepCleanup = null;
function renderStep(step) {
    stepCleanup?.();
    stepCleanup = null;
    // ... render
}
```
Für step-spezifische Listener (Drag-and-Drop in Step 1).

### 9.3 Snapshot-Undo (model.js)

Max 100 Snapshots. Keystroke-Gruppierung via 500ms-Timer. Transform = 1 Undo-Unit. Review-Action = 1 Undo-Unit. Snapshot enthält: xml, confidenceMap, reviewStatus (nicht validationMessages).

### 9.4 API-Key-Isolation (llm.js)

Module-scoped `const apiKeys = new Map()`. Nie exportiert, nie in DOM/Storage/window. Validierung: Max 256 Zeichen, printable ASCII. Fetch mit `credentials: 'omit'`.

### 9.5 Graceful Degradation (tokenizer.js)

Unterminated Comments/PIs: Consume bis EOF. Bare Ampersand: als TEXT. Malformed Entities: als TEXT wenn kein `;` in 12 Zeichen. Kein throw.

### 9.6 Permissive Schema (schema.js)

Wenn kein Schema geladen: `isKnownElement()`, `isChildAllowed()`, `isAttributeKnown()` geben alle `true` zurück. Always-allowed Attribute: xml:id, xml:lang, xmlns, n.

---

## 10. Bekannte Probleme

### 10.1 Architektur-Lücken

| Problem | Auswirkung | Priorität |
|---------|-----------|-----------|
| View-Module nicht integriert | Vorschau ist Regex-HTML, kein Review | Hoch (Phase B) |
| DocumentModel nicht als State-Quelle | Kein Undo/Redo im UI, keine Observer-Sync | Mittel (Phase C) |
| Nie mit echtem LLM getestet | Kernworkflow unvalidiert, Demo-Daten vorhanden (Phase A0) | Hoch (Phase A1) |
| Few-Shot-Beispiele fehlen | Höchster Einzelhebel für Qualität | Hoch (Phase A) |

### 10.2 Code-Defekte

| Modul | Problem | Schwere |
|-------|---------|---------|
| editor.js | `computeLineConfidence()` ist Stub (leere Map) | Mittel |
| editor.js | Tab-Keydown-Listener nicht in `destroy()` entfernt | Niedrig (Memory Leak) |
| preview.js | ID-Counter resettet bei `updateXml()`, potenzielle Kollision | Niedrig |
| transform.js | ID-Counter resettet pro Aufruf, potenzielle Kollision | Niedrig |
| validator.js | `checkPlaintext()` hat keinen Null-Guard für `doc` | Niedrig |
| app.js | `detectType()` nutzt naive Substring-Heuristik | Niedrig |
| app.js | DOCX-Textextraktion verliert Formatierung | Niedrig |
| llm.js | Kein Request-Timeout (nur Browser-Default 30–60s) | Niedrig |

### 10.3 CSS-Defekte

| Problem | Stelle |
|---------|--------|
| Duplizierte `.gutter-line` | Zeilen ~500 und ~2112 |
| Duplizierte `.source-preview` | Zeilen ~1527 und ~2054 |
| date (Amber) + pruefenswert (Gold Tint): geringer Kontrast | Dual-Channel-Kombination |
| placeName (Teal) + sicher (Grün Tint): geringer Kontrast | Dual-Channel-Kombination |

### 10.4 Fehlende Features (nach Phase)

**Phase A (Durchstich):**
- Echten LLM-Transform end-to-end testen
- Few-Shot-Beispiele in Prompt-Assembly
- Bruchstellen dokumentieren und fixen

**Phase B (Review):**
- preview.js in app.js integrieren
- Batch-Review aktivieren
- Konfidenz-Visualisierung (Dual-Channel statt Regex)

**Phase C (Architektur):**
- DocumentModel als State-Quelle (nur wenn nötig)
- editor.js integrieren (nur wenn Regex nicht reicht)
- Gezielte Tests für Bruchstellen

**Phase 3 (Konsolidierung):**
- ODD-Parsing generalisiert (nicht nur dtabf.json)
- teiModeller (Modellierungsberatung)
- XPath-Validierung (Ebene 4)
- LLM-as-a-Judge (Ebene 4)
- Normdaten-Integration (GND, VIAF, Wikidata)
- Konsistenz-Checks (gleiche Entität unterschiedlich annotiert)
- Document Chunking für lange Texte
- Separate Passes (Struktur vs. Semantik)

---

## 11. Tests

### 11.1 Testframework

Browser-basiert, `docs/tests/test-runner.html`. Kein Node.js. Pattern:
```javascript
const { describe, it, assert, assertEqual } = window.__test;
```

### 11.2 Testabdeckung

| Modul | Tests | Gruppen | Abgedeckt |
|-------|-------|---------|-----------|
| tokenizer.js | 19 | 5 | Alle 9 Token-Typen, Malformed XML, Performance (<50ms/500 Zeilen) |
| model.js | 23 | 7 | 4 Layers, Undo/Redo, Keystroke-Gruppierung, Events, Reset |
| validator.js | 18 | 4 | Wohlgeformtheit, Plaintext-Vergleich, Expert-Review, Kaskadierung |
| **Gesamt** | **60** | **16** | ~21% der Codebase |

### 11.3 Nicht getestet

llm.js, transform.js, schema.js, export.js, app.js, editor.js, preview.js, source.js, dom.js, constants.js.

Schema-Validierung (Level 3) importiert aber nicht getestet. CDATA, DOCTYPE, Unicode in Tokenizer nicht getestet.

---

## 12. Konfiguration und Hardcoded Values

| Wert | Stelle | Beschreibung |
|------|--------|-------------|
| MAX_UNDO: 100 | constants.js | Undo-Stack-Größe |
| KEYSTROKE_DEBOUNCE: 500ms | constants.js | Keystroke-Gruppierung |
| MAX_FILE_SIZE: 10MB | constants.js | Upload-Limit |
| TOAST_DURATION: 4000ms | constants.js | Toast-Sichtbarkeit |
| TOAST_DURATION_ERROR: 8000ms | constants.js | Fehler-Toast |
| Tab-Breite: 2 Spaces | editor.js | Tab-Key-Verhalten |
| Entity-Max-Länge: 12 Zeichen | tokenizer.js | Entity-Erkennung |
| Similaritäts-Schwelle: 95% | validator.js | Plaintext-Vergleich |
| Anthropic max_tokens: 8192 | llm.js | Maximale Output-Länge |
| Temperature: 0.2 | transform.js via llm.js | Für OpenAI/DeepSeek/Qwen |
| Hover-Delay: 150ms | preview.js | Review-Hover-Bar |
| Confidence-Priorität | editor.js | problematisch > pruefenswert > sicher > manuell |

---

## 13. Demo-System

3 konfigurierte Demos in `constants.js`:

| ID | Name | Quellentyp | Status | Quelle |
|----|------|-----------|--------|--------|
| recipe | Mittelalterliches Rezept | recipe | Echte Daten | CoReMA, Wo1 Bl. 211r-211v (CC BY 4.0) |
| bookkeeping | Rentrechnung 1718 | bookkeeping | Echte Daten | DEPCHA, Rechnungsbuch (CC BY 4.0) |
| hsa-letter | Hugo Schuchardt Brief | correspondence | Platzhalter | Dateien fehlen noch |

Demo-Modus in `performTransform()`: Statt LLM-Aufruf wird `expectedOutput`-Datei geladen. CSS fuer Demo-Karten vorhanden.

Demo-Dateien in `data/demo/` (Phase A0, Session 16):
- `plaintext/recipe-medieval.txt` -- Fruehneuhochdeutsches Rezept (~50 Woerter)
- `plaintext/rentrechnung-1718.txt` -- Rechnungsbuch-Ausschnitt (~80 Woerter)
- `mappings/recipe-docta.md` -- DoCTA-konforme Rezept-Annotationsregeln mit Few-Shot-Beispiel
- `mappings/bookkeeping-depcha.md` -- Bookkeeping-Ontology-Mapping mit bk:-Attributen
- `expected-output/recipe-medieval-tei.xml` -- Gold-Standard TEI fuer Rezept
- `expected-output/rentrechnung-1718-tei.xml` -- Gold-Standard TEI fuer Rentrechnung

---

## 14. Forschungsgrundlage

### 14.1 LLM-Failure-Modes bei TEI-XML

| Failure Mode | Mitigation in teiCrafter | Status |
|-------------|------------------------|--------|
| Malformed XML | DOMParser-Check | Implementiert |
| Text-Alteration | Plaintext-Vergleich (95%) | Implementiert |
| Halluzinierte Attribute | Schema-Validierung + Export-Bereinigung | Implementiert |
| Über-Annotation | Prompt: "Präzision vor Recall" | Implementiert |
| Unter-Annotation | Separate Passes | Phase 3 |
| Namespace-Verwechslung | ANNOTATION_TAGS-Whitelist | Implementiert |
| Struktur vs. Semantik | selectedTypes-Filter | Implementiert |
| Inkonsistenz über Dokument | Konsistenz-Check | Phase 3 |

### 14.2 Prompt-Best-Practices (2025–2026 Forschung)

1. Few-Shot-Beispiele (2–3/Quellentyp) > verbose Regeln — fehlend
2. Niedrige Temperature (0.1–0.3) — 0.2 implementiert
3. @confidence anfordern — implementiert
4. Striktes Output-Format — implementiert
5. Document Chunking — Phase 3
6. Separate Passes — Phase 3

### 14.3 Review-Evidenz

- 3 Konfidenz-Levels optimal (Kay et al. 2016) — implementiert
- Dual-Channel für Barrierefreiheit — implementiert
- Hybrid Inline + Batch = Gold-Standard — implementiert (in preview.js)
- LLM-as-Judge nur 64–68% Übereinstimmung mit Domain-Experten (IUI 2025) — bestätigt Human-Review-Notwendigkeit
- Alle getesteten LLMs zeigen negativen Bias gegen epistemische Marker (Lee et al. NAACL 2025 EMBER)

### 14.4 Literatur

- Pollin, Fischer, Sahle, Scholger, Vogeler (2025): *Zeitschrift für digitale Geisteswissenschaften*
- De Cristofaro & Zilio (AIUCD 2025): ChatGPT-4 vs Claude 3.5 für TEI
- Tudor et al. (LaTeCH-CLfL/NAACL 2025): Zero-Shot NER auf HIPE-2022
- Gu et al. (arXiv:2411.15594): Survey zu LLM Judges
- Lee et al. (NAACL 2025): EMBER Benchmark
- Cockburn (2004), Freeman & Pryce (2009), Hunt & Thomas (1999): Walking Skeleton

---

## 15. Strategie und Fahrplan

### 15.1 Aktuelle Phase: Walking Skeleton mit disconnected Components

- 14/14 Module implementiert, 7/14 in app.js integriert
- Services funktional, Views nicht verdrahtet
- Kernworkflow nie end-to-end getestet

### 15.2 Naechste Schritte

```
Phase A — Durchstich validieren (1–2 Sessions):
  A0. Demo-Daten mit echten Quellen ---- ERLEDIGT (Session 16)
  A1. Echten LLM-Transform testen (Demo-Rezept + API-Key)
  A2. Few-Shot-Beispiele in Prompt-Assembly
  A3. Bruchstellen dokumentieren und fixen

Phase B — Review-Workflow erlebbar (1–2 Sessions):
  B1. preview.js in app.js einbinden
  B2. Batch-Review aktivieren (N/P/A/R/E)
  B3. Konfidenz-Visualisierung (Dual-Channel)

Phase C — Gezielte Architektur:
  C1. DocumentModel (nur wenn Undo/Redo nötig)
  C2. editor.js (nur wenn Regex nicht reicht)
  C3. Tests für Bruchstellen
```

### 15.3 Erfolgskriterium

> Editorin lädt HSA-Demo-Brief → konfiguriert API-Key → klickt "Transformieren" → sieht annotiertes Ergebnis mit Konfidenz-Farben → geht 5 Annotationen per Batch-Review durch → validiert → exportiert valides TEI-XML.

### 15.4 Bewusst aufgeschoben

DocumentModel-Umbau, Test-Coverage 80%, teiModeller, CodeMirror 6, Normdaten, Dark Mode, Kollaboration, i18n.

---

## 16. Wissensbasis

15 Dokumente, ~6500 Zeilen Markdown.

| Dokument | Beantwortet |
|----------|------------|
| SYNTHESIS.md | Kompaktes Gesamtbild (5 Minuten) |
| REFERENCE.md | Technische Tiefe (dieses Dokument) |
| VISION.md | Was und warum |
| LANDSCAPE.md | Markt, Positionierung, Forschung |
| DESIGN.md | Visuelles System |
| ARCHITECTURE.md | Technisches Fundament |
| WORKFLOW.md | Annotation, Review, Validierung |
| teiModeller.md | Modellierungsberatung (Phase 3) |
| DISTILLATION.md | TEI-Guidelines-Pipeline (Phase 3) |
| research-landscape.md | Forschungslage 2025–2026 |
| STATUS.md | Implementierungs-Ist-Stand |
| MODULES.md | API-Referenz |
| STORIES.md | User Stories + Testkriterien |
| DECISIONS.md | Entscheidungen + offene Punkte |
| JOURNAL.md | Chronik (16 Sessions) |
| KNOWLEDGE.md (Root) | Komplett-Synthese aller Dokumente |

---

## 17. Metriken

| Metrik | Wert |
|--------|------|
| JavaScript | ~4200 Zeilen, 14 Module |
| CSS | 2643 Zeilen, 98 Custom Properties |
| HTML | 82 Zeilen |
| Schema-Elemente | 27 (DTABf-Subset) |
| ANNOTATION_TAGS | 9 |
| LLM-Provider | 6 |
| Modelle im Katalog | 17 |
| Quellentypen | 5 (correspondence, print, recipe, bookkeeping, generic) |
| Demo-Datensaetze | 3 (2 mit echten Daten, 1 Platzhalter) |
| Unit-Tests | 60 (19 + 23 + 18) |
| Test-Coverage | ~21% |
| Integrierte Module | 7/14 |
| User Stories | 22 (10 fertig, 11 in Arbeit, 1 offen) |
| Knowledge-Dokumente | 15 + KNOWLEDGE.md im Root |
| Sessions | 16 |
