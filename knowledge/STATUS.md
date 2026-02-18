# Implementierungs-Status

Stand: 2026-02-18 (Session 14)

Single Source of Truth für den aktuellen Zustand des teiCrafter-Prototyps. Beantwortet: Was funktioniert? Was ist Stub? Was fehlt?

**Aktualisiert von:** Claude, bei jeder Session mit Code-Änderungen

---

## Phasen-Übersicht

| Phase | Beschreibung | Status |
|-------|-------------|--------|
| Phase 1 | UI-Design, Promptotyping | ✅ Abgeschlossen |
| Phase 2 | Prototyp (10 Stufen) | ⚠️ UI-Shell komplett, Service-Integration offen |
| Phase 3 | teiModeller, Destillation, Konsolidierung | 📋 Geplant |

**Kernbefund Phase 2:** Alle 14 JavaScript-Module sind implementiert. Die Service-Integration (Stufen 11–13) ist abgeschlossen: `app.js` importiert und nutzt transform.js + llm.js (Schritt 3), validator.js + schema.js (Schritt 4) und export.js (Schritt 5). Offen: View-Module (editor.js, preview.js, source.js) und DocumentModel sind noch nicht in app.js verdrahtet.

---

## Workflow-Schritte: Ist vs. Soll

### Schritt 1 – Import

| Aspekt | Status | Details |
|--------|--------|---------|
| UI | ✅ | Dropzone, Datei-Auswahl, Demo-Karten, Format-Badges |
| Dateiformate | ✅ | .txt, .md, .xml, .docx (DOCX via JSZip-CDN) |
| Demo-Daten | ✅ | 3 Demos: HSA-Brief, DTA-Druck, Rezept |
| Validierung | ✅ | Dateigröße (10 MB), Dateityp, XML-Wohlgeformtheit |
| Service-Integration | ✅ | Kein Service nötig |
| Bekannte Lücken | — | Quellentyp-Erkennung nutzt einfaches Keyword-Matching |

### Schritt 2 – Mapping

| Aspekt | Status | Details |
|--------|--------|---------|
| UI | ✅ | Quellentyp-Auswahl, Mapping-Textarea, Kontext-Felder |
| Default-Mappings | ✅ | 4 Quellentypen mit vorausgefüllten Regeln |
| Service-Integration | ⚠️ | schema.js nicht eingebunden (keine Validierung der Mapping-Regeln) |
| Bekannte Lücken | — | Kein Syntax-Check, keine Autovervollständigung, kein Preset-Management |

### Schritt 3 – Transform ✅

| Aspekt | Status | Details |
|--------|--------|---------|
| UI | ✅ | 3-Panel-Layout, Source-Tabs, Editor, Vorschau-Tabs |
| LLM-Aufruf | ✅ | app.js → transform.js → llm.js, echte Prompt-Assembly + Response-Parsing |
| Demo-Modus | ✅ | Demo-Dateien werden weiterhin direkt gefetcht (kein LLM nötig) |
| Settings-Dialog | ✅ | 6 Provider, Modell-Dropdown mit Preisen/Reasoning-Badge, API-Key, Verbindungstest |
| Konfidenz-Mapping | ✅ | extractConfidenceMap() → AppState.confidenceMap + transformStats |
| Cancel-Support | ✅ | AbortController, Cancel-Button während Transform |
| Vorschau | ⚠️ | Regex-basierte TEI→HTML-Konvertierung in app.js (nicht preview.js) |
| Entity-Extraktion | ⚠️ | Regex-basiert in app.js, fragil bei verschachtelten Strukturen |
| Bekannte Lücken | — | Kein Streaming, kein Fortschrittsbalken (nur Spinner) |

### Schritt 4 – Validate ✅

| Aspekt | Status | Details |
|--------|--------|---------|
| UI | ✅ | Plaintext-Vergleich, XML-Ansicht, Validierungsliste mit Fehlerzählung |
| Plaintext-Vergleich | ✅ | Via validator.js `checkPlaintext()` (Word-Similarity) |
| XML-Wohlgeformtheit | ✅ | Via validator.js `checkWellFormedness()` |
| Schema-Validierung | ✅ | Via validator.js `checkSchema()` + schema.js (lazy-loaded) |
| Ungeprüfte Annotationen | ✅ | Via validator.js `checkUnreviewed()` |
| XPath-Validierung | 📋 | Phase 3 |
| LLM-as-Judge | 📋 | Phase 3 |
| Bekannte Lücken | — | `extractPlaintext()` verbleibt inline in app.js für Compare-Panel |

### Schritt 5 – Export ✅

| Aspekt | Status | Details |
|--------|--------|---------|
| UI | ✅ | Stats (via getExportStats), Format-Auswahl, Download, Clipboard |
| Download | ✅ | Via export.js `prepareExport()` → `downloadXml()` |
| Clipboard | ✅ | Via export.js `copyToClipboard()` mit Fallback |
| Attribut-Bereinigung | ✅ | @confidence und @resp werden per Default entfernt |
| Export-Optionen | ✅ | Checkboxen: keepConfidence, keepResp |
| Entity-Statistiken | ✅ | Via export.js `getExportStats()` (9 Tag-Typen) |
| Bekannte Lücken | — | Kein Pretty-Print, keine Encoding-Deklaration |

---

## Modul-Status-Matrix

| Modul | Typ | Implementiert | In app.js integriert | Tests | Bekannte Issues |
|-------|-----|:---:|:---:|:---:|-----------------|
| app.js | Core | ✅ | — | ❌ | Event-Delegation (kein Listener-Leak mehr), kein Error-Boundary |
| model.js | Core | ✅ | ❌ | ✅ 21 | Validation nicht in Undo-Snapshots |
| tokenizer.js | Core | ✅ | ❌ (editor.js selbst nicht integriert) | ✅ 17 | Keine numerischen Entities, CDATA-Edge-Case |
| editor.js | View | ✅ | ❌ | ❌ | `computeLineConfidence()` ist Stub (returns empty Map) |
| preview.js | View | ✅ | ❌ | ❌ | ID-Generierung nicht-deterministisch bei Re-Render |
| source.js | View | ✅ | ❌ | ❌ | Digitalisat-Tab ist Platzhalter |
| llm.js | Service | ✅ | ✅ | ❌ | 6 Provider (Gemini, OpenAI, Anthropic, DeepSeek, Qwen, Ollama), MODEL_CATALOG mit Preisen |
| transform.js | Service | ✅ | ✅ | ❌ | 3-Schichten-Prompt, Fallback-Extraktion |
| validator.js | Service | ✅ | ✅ | ✅ 13 | Level 4 (XPath) ist Phase 3 |
| schema.js | Service | ✅ | ✅ | ❌ | Permissiv wenn Schema nicht geladen, lazy-loaded |
| export.js | Service | ✅ | ✅ | ❌ | Attribut-Bereinigung, Cross-Browser-Clipboard, Path-Traversal-Fix |
| storage.js | Service | ✅ | ⚠️ (indirekt via llm.js) | ❌ | Nur Provider/Model-Settings |
| constants.js | Utility | ✅ | ✅ | ❌ | ANNOTATION_TAGS zentralisiert |
| dom.js | Utility | ✅ | ✅ | ❌ | — |

**Zusammenfassung:** 14/14 Module implementiert. 7/14 direkt in app.js integriert (constants, dom, llm, transform, validator, schema, export). 1/14 indirekt integriert (storage via llm). 3/14 mit Unit-Tests (51 Tests gesamt). Test-Coverage: ~21%.

---

## Cross-Cutting Concerns

| Concern | Status | Details |
|---------|--------|---------|
| Scroll-Sync Editor↔Preview | ❌ | Nur Editor-intern (textarea↔pre↔gutter) |
| Cursor-Kopplung | ❌ | Kein Cross-Panel-Sync implementiert |
| DocumentModel-Nutzung | ❌ | app.js nutzt eigenen `AppState`, nicht `DocumentModel` |
| Undo/Redo im UI | ❌ | model.js hat Undo/Redo, aber kein Ctrl+Z-Handler in app.js |
| Persistenz | ❌ | Kein localStorage für Dokument-Zustand (nur LLM-Provider) |
| Error-Handling | ⚠️ | try-catch mit Toast, aber kein Error-Boundary |
| Accessibility | ⚠️ | ARIA-Labels im HTML, focus-visible CSS, aber kein Screen-Reader-Test |
| Responsive Design | ✅ | 3 Breakpoints (Desktop, Tablet, Mobile) |

---

## Nächste Schritte (priorisiert)

### ~~Priorität 1: Service-Integration~~ ✅ Erledigt (Session 11)

Stufen 11–13 abgeschlossen: transform.js + llm.js (Schritt 3), validator.js + schema.js (Schritt 4), export.js (Schritt 5) sind in app.js verdrahtet. Settings-Dialog, Cancel-Support, Export-Optionen implementiert. Inline-Dummys (`generateBasicTei`, `calculateSimilarity`, `countEntities`, `getExportContent`, `downloadTei`) gelöscht.

### Priorität 1 (NEU, Session 14): Durchstich validieren (Walking Skeleton)

Strategieentscheidung: Erst beweisen, dass der Kern funktioniert, bevor Architektur polieren. Begründung: [LANDSCAPE.md](LANDSCAPE.md), [DECISIONS.md](DECISIONS.md).

**Phase A – Durchstich validieren (1–2 Sessions):**
1. Echten LLM-Transform testen (Demo-Brief + API-Key, Bruchstellen dokumentieren)
2. Few-Shot-Beispiele zu Prompt-Assembly hinzufügen (höchster Hebel für LLM-Qualität)
3. Bruchstellen fixen (Response-Parsing, Plaintext-Veränderung, halluzinierte Attribute)

**Phase B – Review-Workflow erlebbar machen (1–2 Sessions):**
4. preview.js in app.js einbinden (Inline-Review: Accept/Reject/Edit, Konfidenz-Visualisierung)
5. Batch-Review aktivieren (Tastaturnavigation N/P/A/R/E, Fortschrittsbalken)

**Phase C – Gezielte Architektur (nur was der Durchstich erfordert):**
6. DocumentModel einführen – nur wenn Undo/Redo sich als nötig erweist
7. editor.js einbinden – nur wenn Regex-XML-Darstellung nicht reicht
8. Tests gezielt für Bruchstellen schreiben

**Erfolgskriterium:** Editorin lädt HSA-Demo-Brief → konfiguriert API-Key → klickt „Transformieren" → sieht annotiertes Ergebnis mit Konfidenz-Farben → geht 5 Annotationen per Batch-Review durch → validiert → exportiert valides TEI-XML.

### ~~Priorität 2 (vorher Priorität 1): View-Integration (verschoben)~~

DocumentModel (Stufe 14) und editor.js/source.js (Stufe 15) wurden nach Strategieentscheidung in Phase C zurückgestuft. Werden nur umgesetzt wenn der Durchstich Bedarf ergibt.

### Priorität 3: Test-Coverage (Stufe 16)

6. **Service-Tests** – llm.js (Mock-Fetch), transform.js, schema.js, export.js
7. **View-Tests** – editor.js, preview.js (DOM-basiert)
8. **Integration-Tests** – End-to-End: Import → Transform → Validate → Export

---

## Abgeschlossene Meilensteine

| Stufe | Beschreibung | Commit | Datum |
|-------|-------------|--------|-------|
| 0 | ES6 Module-Infrastruktur | — | 2026-02 |
| 0.5 | Visuelle Testmatrix (24 Kombinationen) | — | 2026-02 |
| 1 | Overlay-Spike (kein Scroll-Drift) | — | 2026-02 |
| 2 | Editor-Fundament (Tokenizer + Model + Tests) | — | 2026-02 |
| 3 | Import (Source-Panel) | — | 2026-02 |
| 4 | LLM-Konfiguration (4 Provider) | d7fea19 | 2026-02 |
| 5+6 | Mapping + Transform (Prompt + Parsing) | dba1b31 | 2026-02 |
| 7 | Review (Inline + Batch) | a126988 | 2026-02 |
| 8 | Validierung (Schema + Validator) | 3f77725 | 2026-02 |
| 9 | Export (Bereinigung + Download) | 7742521 | 2026-02 |
| 11 | Service-Integration: Transform + LLM + Settings-Dialog | — | 2026-02 |
| 12 | Service-Integration: Validator + Schema | — | 2026-02 |
| 13 | Service-Integration: Export + Optionen-UI | — | 2026-02 |
| — | LLM-Provider-Update: 6 Provider, MODEL_CATALOG, Modell-Dropdown | — | 2026-02 |
| — | Refactoring: Event-Delegation, ANNOTATION_TAGS DRY, CSS-Bugfixes, Security-Fix | — | 2026-02 |

---

**Verknüpfte Dokumente:**
- [MODULES.md](MODULES.md) — Technische API-Referenz pro Modul
- [ARCHITECTURE.md](ARCHITECTURE.md) — Systemdesign und Datenflüsse
- [STORIES.md](STORIES.md) — User Stories mit Implementierungsstatus
- [DECISIONS.md](DECISIONS.md) — Offene und entschiedene Architekturentscheidungen
