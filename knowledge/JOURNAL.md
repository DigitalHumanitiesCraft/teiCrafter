# teiCrafter Development Journal

Chronologisches Arbeitsprotokoll des teiCrafter-Projekts.

---

## 2026-02-18

### Session 9: Knowledge Vault Refactoring

**Auslöser:** Umfassende Code-Analyse aller 14 JS-Module ergab erhebliche Diskrepanz zwischen Dokumentation und Implementierung. Kernbefund: Alle Service-Module sind production-ready, aber app.js importiert keinen einzigen Service. Die Knowledge Base beschrieb einen durchgängigen Workflow, der so noch nicht existiert.

**Durchgeführt:**

1. **Vollständige Repository-Analyse** – 7 parallele Agents analysierten app.js (684 Zeilen, alle 5 Steps), model.js + tokenizer.js (Tests, Edge Cases), editor.js + preview.js + source.js (Views, Stubs), alle 6 Services + 2 Utilities, knowledge/ (11 Dokumente), CSS + HTML, Tests + Demo-Daten.

2. **Neue Dokumente erstellt:**
   - **STATUS.md** – Neue Wahrheitsquelle für den Ist-Stand. Modul-Status-Matrix (14 Module: implementiert/integriert/getestet), Workflow-Schritte mit Ist vs. Soll, priorisierte nächste Schritte.
   - **MODULES.md** – Technische API-Referenz aller 14 Module mit Public API, Events, Abhängigkeiten, bekannten Issues.

3. **Umbenannt:** teiCrafter.md → VISION.md (klarerer Zweck)

4. **Aktualisierte Dokumente:**
   - **DECISIONS.md** – Editor-Spike und Visual-Matrix von "Offen:Hoch" nach "Entschieden" verschoben. Neue Entscheidung "Service-Integration" als höchste Priorität. Implementierungsreihenfolge mit Stufen 11–16 erweitert.
   - **STORIES.md** – Alle 21 Story-Marker gegen Code-Realität geprüft. Neue Statuslegende: ✅ (integriert), 🔧 (Modul da, nicht verdrahtet), ⬜ (offen). Ergebnis: 7 ✅, 14 🔧, 0 ⬜. Zusammenfassungstabelle mit Modul/Integration-Trennung.
   - **ARCHITECTURE.md** – Status-Tags pro Abschnitt (`[Implementiert]`, `[Teilweise]`, `[Geplant]`). Spike-Ergebnis als bestanden markiert. Datenflüsse als Soll-Zustand gekennzeichnet. Verweise auf STATUS.md und MODULES.md.
   - **DESIGN.md** – Implementierungsstatus-Hinweis ergänzt (CSS 2484 Zeilen, offene Punkte: Dark Mode, reduced-motion, contrast).
   - **WORKFLOW.md** – Implementierungsstatus-Hinweis ergänzt (Services existieren aber nicht verdrahtet).
   - **INDEX.md** – Komplett überarbeitet: neue Dokumente aufgenommen, Kategorie-Spalte (Konzept/Ist-Stand/Forschung/Prozess), Claude-Synchronisationsregeln, neuer Kernbegriff "Service-Integration".

5. **YAML-Frontmatter entfernt** aus allen Dateien (INDEX, teiModeller, DISTILLATION, DESIGN, WORKFLOW, ARCHITECTURE, STORIES, DECISIONS). Vault ist jetzt reines Standard-Markdown.

6. **Obsidian-Wiki-Links** (`[[...]]`) durch Standard-Markdown-Links ersetzt (war bereits in VISION.md der letzte Ort).

**Architektonische Erkenntnis:** Die kritische Lücke ist nicht fehlende Implementierung, sondern fehlende **Verdrahtung**. Alle Bausteine existieren. Die nächste Aufgabe ist klar: app.js muss die Services importieren und die View-Module einbinden. Siehe STATUS.md §Nächste Schritte.

**Vault-Struktur nach Refactoring:** 13 Dokumente (11 bestehend + 2 neu), ~4000 Zeilen, rein Standard-Markdown, keine Obsidian-Features.

### Session 10: Verifikation und 12-Punkt-Korrektur

**Auslöser:** Kritische Selbstprüfung der Session-9-Ergebnisse mit 5 parallelen Verifikations-Agents.

**Gefundene Probleme (12):**

- **3 HOCH:** MODULES.md hatte falsche editor.js-Options (`initialValue`→`value`, `lineNumbers`→`showGutter`), fehlende model.js-APIs (`reset()`, `fileName`, `sourceType`), und falsche Test-Zählung (54→51).
- **5 MITTEL:** STORIES.md markierte 0.1–0.3 als ✅ obwohl editor.js nicht in app.js integriert ist (→🔧). STATUS.md zählte tokenizer als "integriert via editor.js" obwohl editor.js selbst nicht integriert ist. ARCHITECTURE.md fehlten Status-Tags in §2.2–2.4. MODULES.md `extractConfidenceMap()` war unvollständig. editor.js Tab-Listener-Leak fehlte in Known Issues.
- **4 NIEDRIG:** WORKFLOW.md preview.js-Formulierung irreführend. MODULES.md `getProviderConfigs()` Return-Typ fehlte. INDEX.md Sync-Regeln unklar. ARCHITECTURE.md §2 Soll/Ist nicht getrennt.

**Alle 12 korrigiert.** Aktualisierte Zahlen: 4 ✅ integriert (statt 7), 17 🔧 Modul da (statt 14), 2/14 Module in app.js integriert (statt 3), 51 Tests (statt 54).

### Session 14: Strategiebericht und Knowledge-Update

**Auslöser:** Nach Abschluss des Refactorings (Session 13) stellte sich die Frage: Was sind die nächsten Schritte? Statt direkt mit Stufe 14 (DocumentModel) weiterzumachen, wurde eine strategische Analyse durchgeführt.

**Durchgeführt:**

1. **Marktanalyse** – Zwei parallele Recherche-Agenten analysierten:
   - Tool-Landschaft: 10+ TEI-Annotationswerkzeuge verglichen (Oxygen, ediarum, TEI Publisher, CATMA, Transkribus, eScriptorium, FromThePage, LEAF-Writer, EVT, TextGrid)
   - LLM-Annotation: State of the Art, Failure Modes, Prompt-Best-Practices
   - Review-Workflows: Accept/Reject/Edit-Patterns, Konfidenz-Anzeige, Batch vs. Inline
   - State Management: EventTarget, Snapshot-Undo, Walking Skeleton Pattern

2. **Zentraler Befund:** Kein bestehendes Tool kombiniert TEI-Annotation + LLM-Unterstützung + Human Review. teiCrafter ist First Mover.

3. **Strategieentscheidung: Durchstich-first** – Statt Architektur polieren (DocumentModel, View-Module, Tests) zuerst den Walking Skeleton mit echtem LLM-Transform validieren. Begründung: SW-Literatur (Cockburn, Freeman/Pryce, Hunt/Thomas) eindeutig; Review-Workflow ist der Differentiator; wir wissen nicht, ob der Transform brauchbare Ergebnisse liefert.

4. **Neues Wissensdokument: LANDSCAPE.md** – Tool-Landschaft, Vergleichsmatrix, LLM-Failure-Modes, Best Practices für Review-Workflows, Prompt Engineering, State Management, strategische Differenziatoren, bekannte Lücken. ~250 Zeilen, 9 Abschnitte.

5. **SYNTHESIS.md** (NEU) – Kompaktes Gesamtbild des gesamten Projekts. Destilliert aus allen 13 Wissensdokumenten. ~200 Zeilen. Ziel: 5-Minuten-Onboarding für Menschen und Agenten.

6. **Aktualisierte Dokumente (7):**
   - **VISION.md** – Alleinstellungsmerkmal (4 Differenziatoren), Provider-Zahl korrigiert, Service-Integration-Status aktualisiert
   - **DECISIONS.md** – 3 neue Entscheidungen (Durchstich-first, Preview vor Editor, Few-Shot-Beispiele), DocumentModel-Bewertung aktualisiert, neue Implementierungsreihenfolge (Phase A/B/C)
   - **STATUS.md** – Prioritäten umgeordnet: Durchstich (Phase A/B) vor View-Integration, Erfolgskriterium definiert
   - **WORKFLOW.md** – §4.4 LLM-Failure-Modes (8 Modi mit Mitigation-Status), §4.5 Prompt-Best-Practices (6 Punkte)
   - **STORIES.md** – Neue Story E2E.1 (Vollständiger LLM-Durchstich), Zusammenfassung 21→22 Stories
   - **INDEX.md** – LANDSCAPE.md aufgenommen, 3 neue Kernbegriffe (Walking Skeleton, Few-Shot, First Mover)
   - **JOURNAL.md** – Dieser Eintrag

**Nächste Schritte (priorisiert):**
- Phase A: Echten LLM-Transform testen + Few-Shot-Beispiele + Bruchstellen fixen
- Phase B: preview.js einbinden (Inline-Review + Batch-Review + Konfidenz)
- Phase C: Gezielte Architektur nur wo nötig

### Session 13: Code-Qualität-Refactoring (4 Phasen)

**Auslöser:** Umfassende Code-Analyse aller 14 JS-Module, HTML und CSS (2600+ Zeilen). Gesamtqualität 8.7/10, aber app.js hatte strukturelle Schulden die Weiterentwicklung behindern.

**Durchgeführt:**

1. **Phase 1: Quick Wins**
   - `ANNOTATION_TAGS` in constants.js zentralisiert → import in transform.js, export.js, preview.js (war 3× dupliziert)
   - CSS-Bugfixes: `.btn-primary` Definition ergänzt (8× verwendet, nie definiert), `--font-serif` Custom Property ergänzt, duplizierte `.compare-text` gemergt, `prefers-reduced-motion` Media Query ergänzt, `@import` durch Kommentar ersetzt (dupliziert mit HTML `<link>`)
   - Path-Traversal-Fix in `export.js getExportFileName()` – Pfadkomponenten und unsichere Zeichen werden entfernt
   - Ungenutzter Import `getPromptLayers` aus app.js entfernt

2. **Phase 2: Event-Management**
   - Event-Delegation: Ein `click`-Listener auf `.app-main` statt 20+ individuelle Listener
   - Buttons nutzen `data-action`-Attribute → `handleAction()` als zentraler Switch (~13 Actions)
   - Tab-Clicks ebenfalls delegiert (`.tab[data-tab]`)
   - `stepCleanup`-Pattern: Drag-and-Drop-Listener werden beim Step-Wechsel aufgeräumt
   - Eliminiert Event-Listener-Akkumulation bei Step-Navigation

3. **Phase 3: app.js Struktur**
   - `openSettingsDialog()` aufgeteilt: `buildSettingsHtml()`, `attachSettingsListeners()`, `openSettingsDialog()` (133→3 Funktionen)
   - `AppState.reset()` DRY: `INITIAL_STATE` + `structuredClone()` statt manueller Property-Kopie
   - Transform-Button Doppelklick-Schutz via `transformInProgress`-Guard

4. **Phase 4: Service-Feinschliff**
   - editor.js: Tab-`keydown`-Listener wird jetzt in `destroy()` aufgeräumt (Memory-Leak-Fix)
   - validator.js: Level-Kommentare korrigiert (Ausführungsreihenfolge statt willkürliche Nummerierung)

**Betroffene Dateien:** app.js, constants.js, style.css, export.js, transform.js, preview.js, editor.js, validator.js

**Nächste Schritte:** Stufe 14 (DocumentModel statt AppState) → Stufe 15 (View-Module einbinden) → Stufe 16 (Test-Coverage).

### Session 12: LLM-Provider-Update (6 Provider, MODEL_CATALOG)

**Auslöser:** User wünscht aktuelle Modelle, mehr Provider (DeepSeek, Qwen), Preistransparenz und Reasoning-Kennzeichnung.

**Durchgeführt:**

1. **constants.js** – `LLM_PROVIDERS` um DEEPSEEK und QWEN erweitert (4→6 Provider)

2. **llm.js** – Umfassend überarbeitet:
   - `MODEL_CATALOG` eingefügt: 17 Modelle mit Metadaten (Name, Input/Output-Preis in USD/1M Tokens, Kontextfenster, Reasoning-Flag)
   - Bestehende Provider aktualisiert: Gemini 2.0-flash→2.5-flash, GPT-4o→4.1-mini, Claude→4.5-20250514, Ollama llama3.1→3.3
   - 2 neue Provider: DeepSeek (api.deepseek.com, bearer auth, OpenAI-kompatibel) und Qwen/DashScope (dashscope.aliyuncs.com, bearer auth, OpenAI-kompatibel)
   - Jeder Provider hat `models`-Array für Dropdown-Befüllung
   - Neue Exports: `getModelCatalog()`, `getModelsForProvider(provider)`
   - `getProviderConfigs()` gibt jetzt auch `models`-Array zurück

3. **app.js** – Settings-Dialog überarbeitet:
   - Modell: Freitextfeld → `<select>` mit Modellnamen, Preisen und Reasoning-Kennzeichnung
   - Ollama: Zusätzliches Custom-Eingabefeld für eigene Modell-IDs
   - Provider-Info-Zeile unter dem Provider-Dropdown
   - Neue Hilfsfunktionen: `buildModelOptions()`, `getProviderInfo()`
   - Neuer Import: `getModelCatalog`, `getModelsForProvider` aus llm.js

4. **style.css** – `.provider-info` CSS-Klasse ergänzt

5. **Knowledge-Docs** aktualisiert: STATUS.md, MODULES.md, JOURNAL.md

**Modell-Übersicht:**

| Provider | Default | Modelle | Preisrange (In/Out) |
|----------|---------|---------|---------------------|
| Gemini | 2.5 Flash | 3 (2.5-flash, 2.5-pro, 2.0-flash) | $0.10–$10.00 |
| OpenAI | 4.1 Mini | 5 (4.1, 4.1-mini, 4.1-nano, o4-mini, o3) | $0.10–$8.00 |
| Anthropic | Sonnet 4.5 | 2 (sonnet-4.5, haiku-3.5) | $0.80–$15.00 |
| DeepSeek | V3 Chat | 2 (chat, reasoner) | $0.27–$2.19 |
| Qwen | Plus | 3 (max, plus, turbo) | $0.10–$6.40 |
| Ollama | llama3.3 | 5 Empfehlungen (llama3.3, qwen2.5, mistral, gemma2, phi4) | Kostenlos |

**Nächste Schritte:** Stufe 14 (DocumentModel statt AppState) → Stufe 15 (View-Module einbinden) → Stufe 16 (Test-Coverage).

### Session 11: Service-Integration (Stufen 11–13)

**Auslöser:** Nächster Schritt nach Knowledge-Vault-Refactoring. Die kritische Lücke war die fehlende Verdrahtung der Service-Module in app.js.

**Durchgeführt:**

1. **Stufe 11: Transform + LLM (Schritt 3)**
   - 7 neue Imports in app.js (transform, llm, validator, schema, export)
   - AppState um `confidenceMap`, `transformStats`, `originalPlaintext` erweitert
   - `performTransform()` ersetzt: Demo-Modus beibehalten, echter LLM-Pfad via `transform()` mit AbortController + Cancel-Button
   - `generateBasicTei()` gelöscht (Dummy)
   - LLM-Settings-Dialog: Provider-Auswahl, Modell, API-Key, Verbindungstest
   - `#btn-settings`-Handler verdrahtet + Model-Badge im Header
   - Transform-Stats-Anzeige im Editor-Footer (farbcodiert nach Konfidenz)

2. **Stufe 12: Validierung (Schritt 4)**
   - `renderValidateStep()` → async, nutzt `validate()` aus validator.js
   - Schema lazy-loaded via `loadSchema()` beim ersten Aufruf
   - Validation-Messages gruppiert nach Level (error/warning/info)
   - `calculateSimilarity()` gelöscht (validator.js macht Word-Similarity)
   - `isWellFormedXml()` beibehalten (für Import-Validierung in processFile)
   - `renderStep()` → async (wegen await in Schritt 4)

3. **Stufe 13: Export (Schritt 5)**
   - `renderExportStep()` nutzt `getExportStats()`, `prepareExport()`, `downloadXml()`, `copyToClipboard()` aus export.js
   - Export-Optionen-UI: Checkboxen für keepConfidence, keepResp
   - Entity-Statistiken zeigen alle 9 Tag-Typen (statt nur 3)
   - `getExportContent()`, `downloadTei()`, `copyToClipboard()` (Inline), `countEntities()` gelöscht

4. **CSS-Ergänzungen** (~80 Zeilen): Settings-Dialog, Transform-Stats, Export-Options, Transform-Loading-Spinner

5. **Knowledge-Docs aktualisiert:**
   - STATUS.md: Schritte 3–5 ❌→✅, Module 2/14→7/14 integriert, Stufen 11–13 als Meilensteine
   - MODULES.md: app.js Imports, AppState-Felder, neue Funktionen
   - DECISIONS.md: Service-Integration als entschieden, Implementierungssequenz aktualisiert
   - STORIES.md: 6 Stories von 🔧→✅ (3.1, 5.1, 5.2, 6.1, Q.1, Q.2), Zusammenfassung 4→10 ✅
   - JOURNAL.md: Dieser Eintrag

**Gelöschte Inline-Funktionen (7):** `generateBasicTei()`, `getExportContent()`, `downloadTei()`, `copyToClipboard()` (Inline-Version), `countEntities()`, `calculateSimilarity()`. Beibehalten: `extractPlaintext()` (Compare-Panel), `isWellFormedXml()` (Import-Validierung).

**Nächste Schritte:** Stufe 14 (DocumentModel statt AppState) → Stufe 15 (View-Module einbinden) → Stufe 16 (Test-Coverage).

---

## 2026-02-05

### Session 1: Projektstart UI-Prototyp

**Ziel:** UI-Prototyp für teiCrafter entwickeln, publiziert via GitHub Pages (`/docs`).

**Entscheidungen:**
- `docs/` für GitHub Pages UI-Prototyp
- `knowledge/` wird Obsidian Vault für Projektwissen
- `knowledge/journal/` für kompakte Arbeitsprotokolle

**Status:** Strukturen angelegt, bereit für UI-Entwicklung.

---

### Session 2: UI-Prototyp Implementierung

**Ergebnis:** Vollständiger klickbarer UI-Prototyp erstellt.

**Dateien:**
- `docs/index.html` – Drei-Spalten-Layout mit 6-Phasen-Workflow
- `docs/css/style.css` – Design-System mit CSS Custom Properties
- `docs/js/app.js` – Interaktionslogik (Stepper, Panels, Simulation)

**UI-Konzept:**
- **Drei-Spalten-Layout:** Source (Plaintext) | Output (TEI-XML) | Context (phasenabhängig)
- **6-Phasen-Workflow:** Import → Kontext → Mapping → Transform → Review → Export
- **Konfidenz-System:** Sicher (grün) | Prüfenswert (gelb) | Problematisch (rot)
- **Epistemische Asymmetrie:** Expert im Zentrum, nicht am Ende

**Features:**
- Klickbarer Workflow-Stepper
- Beispiel-Brief (HSA Benndorf→Schuchardt 1879)
- Simulierte Transformation mit Progress-Ring
- Review-Panel mit Accept/Edit/Reject-Aktionen
- XML-Export-Funktion
- Responsive Design (Desktop/Tablet/Mobile)

---

### Session 3: UI-Redesign nach Screenshot-Analyse

**Ausgangspunkt:** Screenshot eines ausgereifteren teiCrafter-Designs analysiert.

**Erkenntnisse:**
1. **Layout:** Zwei Spalten statt drei – Editor bekommt mehr Raum
2. **Workflow:** 5 Schritte statt 6 – Import → Mapping → Transform → Validate → Export
3. **Editor:** Gutter-Markierungen zeigen Probleme inline an (orange/rot)
4. **Preview:** Korrespondenz-Metadaten-Header + Entity-Legende
5. **Validierung:** Granulare Meldungen mit Zeilenreferenzen
6. **Footer:** Kontextinformation (Schema, Mapping, Datei)

**Änderungen v1 → v2:**

| Aspekt | v1 | v2 |
|--------|----|----|
| Layout | 3 Spalten | 2 Spalten (Editor + Sidebar) |
| Workflow | 6 Schritte | 5 Schritte |
| Stepper | Kreise mit Nummern | `[ Transform ]` Klammer-Notation |
| Editor | Textarea | Gutter mit Zeilennummern + Markern |
| Sidebar | Phasen-abhängig | Tabs (Vorschau, Validierung, Review) |
| Preview | Einfach | Metadaten-Header + Entity-Highlighting |
| Footer | Minimal | Schema · Zeilen · Mapping |

---

### Session 4: TEI-abgeleitetes Design-System (v3)

**Ausgangspunkt:** Design-System-Dokument mit TEI-abgeleiteter Farbpalette.

**Hauptänderungen v2 → v3:**

| Aspekt | v2 | v3 |
|--------|----|----|
| Layout | 2 Spalten | 3 Spalten (40/30/30) |
| Header-Farbe | `#0f172a` (Slate) | `#1E3A5F` (TEI-Navy) |
| Akzentfarbe | `#dd6b20` (Orange) | `#CC8A1E` (TEI-Gold) |
| Fonts | System-Fonts | Inter + JetBrains Mono |
| Konfidenz | Einfarbig | Dual-Channel (Rand + Tint) |
| persName | `#a855f7` (Lila) | `#3B7DD8` (Blau) |
| orgName | `#059669` (Grün) | `#7B68AE` (Violett) |

**Neue Farbpalette (TEI-abgeleitet):**
- **Navy:** `#1E3A5F` – Header, Element-Namen
- **Gold:** `#CC8A1E` – Akzente, aktiver Stepper, Prüfenswert
- **Konfidenz-Tints:** Aufgehellte Versionen für Hintergründe

**Generalisierung:**
- Vorschau-Panel erkennt Quellentyp automatisch
- Metadaten-Header nur bei Korrespondenz sichtbar
- Erweiterbar für andere Quellentypen (Rezepte, Drucke, etc.)

**Erstellt:**
- `knowledge/DESIGN.md` – Verbindliches Design-Dokument
- Aktualisierte `docs/css/style.css` (~1070 Zeilen)
- Aktualisierte `docs/index.html` (3-Spalten-Layout)
- Aktualisierte `docs/js/app.js` (generische Vorschau)

---

### Session 5: Vollständiger 5-Step-Workflow (v4)

**Ziel:** Kompletten Workflow von Import bis Export implementieren mit Demo-Daten.

**Entscheidung:** UI + Mock-Daten (keine LLM-Integration in diesem Schritt)

**Neue Ordnerstruktur:**
```
data/demo/
├── plaintext/
│   ├── hsa-letter-benndorf.txt    # Brief (Korrespondenz)
│   ├── dta-print-sample.txt       # Historischer Druck
│   └── recipe-medieval.txt        # Mittelalterliches Rezept
├── mappings/
│   ├── correspondence-hsa.md      # HSA-Korrespondenz
│   ├── print-dta.md               # DTA-Basisformat
│   └── recipe-docta.md            # Rezept-Mapping
└── expected-output/
    ├── hsa-letter-benndorf-tei.xml
    ├── dta-print-sample-tei.xml
    └── recipe-medieval-tei.xml
```

**Implementierte Steps:**

1. **Import (Step 1)** – Zentriertes Layout
   - Dropzone für Datei-Upload (TXT, XML)
   - Demo-Cards für 3 Quellentypen (Brief, Druck, Rezept)
   - Automatische Quellentyp-Erkennung

2. **Mapping (Step 2)** – 2-Spalten-Layout (25%/75%)
   - Quelltext-Vorschau (links)
   - Mapping-Konfiguration (rechts)
   - Quellentyp-Auswahl
   - Bearbeitbare Mapping-Regeln (Textarea)
   - Kontext-Felder (Sprache, Epoche, Projekt)

3. **Transform (Step 3)** – 3-Spalten-Layout (25%/45%/30%)
   - Source-Panel mit Plaintext/Digitalisat-Tabs
   - TEI-XML-Editor mit "Transformieren"-Button
   - Vorschau-Panel mit Entity-Tab
   - Mock-Transformation lädt vorbereitetes TEI-XML

4. **Validate (Step 4)** – 3-Spalten-Layout (25%/45%/30%)
   - Plaintext-Vergleich (Original vs. Extrahiert)
   - Ähnlichkeitsberechnung (Word-based)
   - XML-Wohlgeformtheitsprüfung
   - Validierungsliste (Plaintext, XML-Syntax, Schema)

5. **Export (Step 5)** – Zentriertes Layout
   - Erfolgsmeldung mit Statistiken
   - Export-Format-Auswahl (Vollständig / Nur Body)
   - Download-Button
   - Clipboard-Kopie
   - "Neues Dokument"-Button

**Technische Änderungen:**
- `docs/js/app.js` komplett neu geschrieben (~290 Zeilen)
- `docs/index.html` vereinfacht auf dynamischen Container
- `docs/css/style.css` erweitert um step-spezifische Layouts
- Stepper-Klasse von `.step` zu `.stepper-step` geändert

**JavaScript-Architektur:**
- `AppState` – Zentrales State-Management
- `DEMO_CONFIGS` – Konfiguration für 3 Demo-Typen
- `renderStep(n)` – Dynamisches Rendering pro Step
- `goToStep(n)` – Navigation zwischen Steps
- Hilfsfunktionen: `escHtml`, `highlightXml`, `transformTeiToHtml`, `extractPlaintext`, `calculateSimilarity`, `isWellFormedXml`, `countEntities`

**Bug-Fixes:**
- Mehrzeilige Strings in `getDefaultMapping()` korrigiert (`\n` statt echte Zeilenumbrüche)
- Demo-Pfade von `data/demo/...` zu `../data/demo/...` geändert (relativ zu `docs/`)

**Status:** Vollständiger Workflow funktioniert mit allen 3 Demo-Typen.

---

### Session 6: Knowledge-Base-Konsolidierung

**Ziel:** Wissensbasis konsolidieren. Veraltete und redundante Strukturen eliminieren, neue Design-Entscheidungen aus `new-knowledge/` als verbindlich übernehmen.

**Ausgangslage:** Zwei parallele Wissensordner (`knowledge/` und `new-knowledge/`) mit teilweise überlappenden, teilweise widersprüchlichen Inhalten. Systematischer Vergleich aller Dokumente.

**Ergebnis des Vergleichs:**

| Aspekt | `knowledge/` (alt) | `new-knowledge/` (neu) | Bewertung |
|---|---|---|---|
| Redundanz | Hoch (teiCrafter.md ~325 Zeilen, dupliziert Architektur, Mapping, UI) | Keine (teiCrafter.md ~150 Zeilen, verweist auf Spezialdokumente) | Neu besser |
| Prompt-Architektur | Nur in teiCrafter.md erwähnt | Spezifiziert in WORKFLOW.md §2 (Dreischichten-Modell) | Neu besser |
| Validierungsebenen | Nur als Tabelle in teiCrafter.md | Vollständig spezifiziert in WORKFLOW.md §8 (5 Ebenen) | Neu besser |
| Offene Fragen | Verstreut über INDEX, ARCHITECTURE, TRANSFORM | Konsolidiert in DECISIONS.md mit Status-Tracking | Neu besser |
| Scope TRANSFORM.md | "Transform und Review" – eng gefasst | Umbenannt zu WORKFLOW.md: "Annotation, Review, Validierung" | Neu besser |
| Neue Dokumente | — | DECISIONS.md, teiModeller.md | Neu besser |

**Durchgeführte Änderungen:**

| Aktion | Details |
|---|---|
| Überschrieben | INDEX.md, DESIGN.md, ARCHITECTURE.md, teiCrafter.md – mit new-knowledge-Versionen |
| Neu hinzugefügt | WORKFLOW.md (ersetzt TRANSFORM.md), DECISIONS.md, teiModeller.md |
| Gelöscht | TRANSFORM.md (ersetzt durch WORKFLOW.md) |
| Gelöscht | `_legacy/design-v3.md` (gesamter `_legacy/`-Ordner) |
| Gelöscht | `new-knowledge/` (komplett, nach Migration) |
| Beibehalten | JOURNAL.md (Arbeitstagebuch, kein normatives Dokument) |

**Neue Dokumentenstruktur:**

```
knowledge/
├── INDEX.md          ← Navigation (MOC)
├── JOURNAL.md        ← Entwicklungsprotokoll (dieses Dokument)
├── teiCrafter.md     ← Projektübersicht und Vision
├── DESIGN.md         ← Visuelle Spezifikation
├── ARCHITECTURE.md   ← Technische Architektur
├── WORKFLOW.md       ← Annotation, Review, Validierung
├── teiModeller.md    ← Modellierungsberatung (Phase 3)
└── DECISIONS.md      ← Offene Entscheidungen und Implementierungsplan
```

**Wichtigste inhaltliche Neuerungen gegenüber dem alten Stand:**
- **Dreischichten-Prompt-Architektur** erstmals sauber spezifiziert (Basis + Kontext + Mapping)
- **Fünf Validierungsebenen** erstmals vollständig dokumentiert (Plaintext, Schema, XPath, LLM-as-a-Judge, Expert-in-the-Loop)
- **Vier Konfidenz-Kategorien** statt drei (+ "Manuell" für menschlich erzeugte Annotationen)
- **DECISIONS.md** mit 6 entschiedenen Punkten, 11 offenen Fragen (priorisiert), und Implementierungsreihenfolge (11 Schritte)
- **teiModeller.md** als eigenständiges Konzeptdokument für Phase 3

**Status:** Knowledge Base konsolidiert. Ein Ordner, keine Redundanz, klare Zuständigkeiten.

---

### Session 7: User Stories und Destillations-Pipeline

**Ziel:** User Stories evaluieren und in die Wissensbasis aufnehmen. TEI-Guidelines-Destillations-Pipeline als neues Spezifikationsdokument integrieren.

**Teil 1: STORIES.md – Evaluation und Integration**

Systematische Evaluation aller 20 User Stories gegen die Wissensbasis (DESIGN.md, ARCHITECTURE.md, WORKFLOW.md, DECISIONS.md, teiModeller.md).

**Ergebnis der Evaluation:**
- Alle 20 Stories sind konsistent mit den Spezifikationsdokumenten
- Referenzen auf die richtigen Abschnitte vorhanden
- Testbare Gegeben-Wenn-Dann-Muster mit konkreten Prüfschritten
- Implementierungsreihenfolge (9 Stufen) stimmt mit DECISIONS.md überein

**Identifizierte Lücke:** Fehlende Story für Undo/Redo. ARCHITECTURE.md §3 spezifiziert ein Snapshot-basiertes Undo-System, das für den Review-Workflow zentral ist (Transform als eine Undo-Einheit, Accept/Reject als einzelne Undo-Einheiten).

**Ergänzung:** Story 0.4 – Undo/Redo auf Dokumentebene hinzugefügt. Testet Ctrl+Z/Ctrl+Y über alle Zustandsschichten (Dokument + Konfidenz + Review-Status). Prototyp-Scope damit von 20 auf 21 Stories erweitert, Stufe 2 von 2 auf 3 Stories.

**Teil 2: DISTILLATION.md – Integration**

Neues Spezifikationsdokument für die TEI-Guidelines-Destillations-Pipeline. Beschreibt den dreistufigen Prozess (Scraping → Destillation → Validierung), der TEI-Wissensmodule für den teiModeller erzeugt.

**Kerninhalt:**
- Trennung in Referenzwissen ("Was gibt es?") und Modellierungswissen ("Wann verwende ich was?")
- Dreistufige Pipeline: Scraping der TEI-Website, LLM-Destillation, Validierung
- Pilotmodul: `namesdates` (Kapitel 14) – relevant für Synergieprojekte, überschaubare Größe
- Repository-Struktur für `distillation/`-Ordner
- Wartungsstrategie bei TEI-Releases (Diff-basierte Aktualisierung)

**Durchgeführte Änderungen:**

| Aktion | Details |
|---|---|
| Neu erstellt | `knowledge/STORIES.md` – 21 Prototyp-Stories + 2 Phase-3-Stories |
| Neu erstellt | `knowledge/DISTILLATION.md` – TEI-Guidelines-Destillations-Pipeline |
| Aktualisiert | `knowledge/INDEX.md` – Beide Dokumente in Dokumentenliste, Abhängigkeitsdiagramm und Kernbegriffe aufgenommen |
| Aktualisiert | `knowledge/teiModeller.md` – Verweis auf DISTILLATION.md in §2.1 und Abhängigkeiten |
| Aktualisiert | `knowledge/DECISIONS.md` – Offene Frage "Wissensmodul-Granularität" als teilweise beantwortet markiert, Referenzen ergänzt |

**Neue Dokumentenstruktur:**

```
knowledge/
├── INDEX.md              ← Navigation (MOC)
├── JOURNAL.md            ← Entwicklungsprotokoll (dieses Dokument)
├── teiCrafter.md         ← Projektübersicht und Vision
├── DESIGN.md             ← Visuelle Spezifikation
├── ARCHITECTURE.md       ← Technische Architektur
├── WORKFLOW.md           ← Annotation, Review, Validierung
├── teiModeller.md        ← Modellierungsberatung (Phase 3)
├── DISTILLATION.md       ← TEI-Guidelines-Destillation (Phase 3) [NEU]
├── STORIES.md            ← User Stories und Testplanung [NEU]
└── DECISIONS.md          ← Offene Entscheidungen und Implementierungsplan
```

**Status:** Wissensbasis erweitert. 10 Dokumente, alle querverlinkt, keine Redundanz.

---

### Session 8: Phase 2 – Implementierung

#### Stufe 0: Projektinfrastruktur (ES6 Module)

**Ziel:** Monolithischen Prototyp in ES6-Modulsystem aufbrechen, bestehende Funktionalität erhalten.

**Durchgeführte Änderungen:**

| Aktion | Datei | Details |
|---|---|---|
| Neu | `docs/js/utils/constants.js` | Enums (CONFIDENCE, REVIEW_STATUS, ENTITY_TYPES, LLM_PROVIDERS), DEMO_CONFIGS, ICONS, SOURCE_LABELS, Limits, getDefaultMapping() |
| Neu | `docs/js/utils/dom.js` | $(), $$(), escHtml() mit vollständigem XSS-Schutz (&"' zusätzlich), highlightXml(), showToast(), showDialog(), setAriaLive() |
| Neu geschrieben | `docs/js/app.js` | ES6 Module Shell mit imports, gleiche Funktionalität wie v4 |
| Geändert | `docs/index.html` | `<script type="module">`, Model-Badge dynamisch (`#model-name`), Settings-Button mit `id="btn-settings"` |
| Erweitert | `docs/css/style.css` | Toast-Benachrichtigungen (.toast-container, .toast, Slide-in-Animation), Dialog (.dialog-backdrop, .dialog), .sr-only |
| Gelöscht | `docs/js/templates.js` | Inhalt war unbenutzt, relevante Teile in app.js migriert |
| Gelöscht | `docs/js/utils.js` | Inhalt nach dom.js und constants.js migriert |
| Neu | `docs/tests/test-runner.html` | In-Browser-Testframework mit describe/it/assert/assertEqual, Smoke-Tests für Module |
| Neu | `docs/js/services/` | Leeres Verzeichnis für spätere Service-Module |
| Neu | `docs/schemas/` | Leeres Verzeichnis für Schema-Profile |

**Sicherheitsverbesserungen:**
- `escHtml()` escaped jetzt auch `"` und `'` (XSS-Prävention)
- Datei-Import validiert Größe (max 10 MB) und Dateiendung
- XML-Import prüft Wohlgeformtheit vor dem Laden
- DOCX-Extraktion validiert ZIP-Struktur (word/document.xml)
- `alert()` durch `showToast()` ersetzt (nicht-blockierend)

**Architektur:**
```
docs/js/
├── app.js              ← Application Shell (ES6 Module, ~680 Zeilen)
├── utils/
│   ├── constants.js    ← Enums, Configs, Icons (~170 Zeilen)
│   └── dom.js          ← DOM-Utilities, Toast, Dialog (~150 Zeilen)
├── services/           ← (leer, für Stufe 4+)
docs/tests/
└── test-runner.html    ← In-Browser-Tests
docs/schemas/           ← (leer, für Stufe 8)
```

**Status:** ES6-Modulsystem funktioniert. Prototyp-Funktionalität vollständig erhalten.

---

#### Stufe 0.5: Visuelle Testmatrix

**Ziel:** Alle 24 Annotationstyp-Konfidenz-Kombinationen visuell validieren.

**Erstellt:**
- `docs/tests/visual-matrix.html` – 6 Entity-Typen × 4 Konfidenz-Kategorien
- Dual-Channel-Encoding: Unterstreichungsfarbe (Annotationstyp) + Hintergrund-Tint (Konfidenz)
- Zusätzlicher visueller Kanal: Linienstil (solid/dashed/dotted/double)
- Realistischer Kontexttest mit Briefabsatz
- Automatisierte Kontrastprüfung (Euclidean Color Distance)
- 4 bekannte Problemfälle identifiziert und visuell dokumentiert

**Außerdem:** `knowledge/INDEX.md` aktualisiert – `research-landscape.md` in Dokumentenliste aufgenommen.

**Status:** Testmatrix erstellt, bereit für visuelle Inspektion.

---

#### Stufe 1: Overlay-Spike (Story 0.2)

**Ziel:** Beweis, dass die Overlay-Technik (Textarea + Pre) mit State-Machine-Tokenizer funktioniert.

**Erstellt:**

| Datei | Details |
|---|---|
| `docs/js/tokenizer.js` | State-Machine XML-Tokenizer (reine Funktion). 9 Token-Typen: element, attrName, attrValue, delimiter, comment, pi, namespace, entity, text. Invariante: lückenlose, überlappungsfreie Abdeckung des Inputs. Graceful bei malformed XML. |
| `docs/js/editor.js` | Overlay-Editor: `createOverlayEditor(container, options)`. Textarea (color: transparent, caret-color: sichtbar) über Pre (syntax-highlighted, pointer-events: none). Scroll-Sync, rAF-Debouncing, Tab-Insertion. |
| `docs/tests/tokenizer.test.js` | 17 Unit-Tests: leerer String, einfache Elemente, Attribute, Kommentare, PIs, Entities, Namespace-Prefixe, xmlns, Coverage-Invariante, malformed XML, Performance (<50ms für 500 Zeilen). |
| `docs/css/style.css` | `.editor-overlay`, `.editor-textarea`, `.editor-pre` mit identischer Typografie. Syntax-Klassen: `.xml-element`, `.xml-attr`, `.xml-value`, `.xml-delimiter`, `.xml-comment`, `.xml-pi`, `.xml-namespace`, `.xml-entity`. |

**Tokenizer-Architektur:**
- State Machine mit Zuständen: TEXT → TAG_OPEN → TAG_NAME → ATTR_SPACE → ATTR_NAME → ATTR_EQ → ATTR_VALUE
- Sonderzustände: COMMENT, PI, CDATA, ENTITY, CLOSE_TAG
- Namespace-Erkennung: `tei:TEI` → NAMESPACE(`tei:`) + ELEMENT(`TEI`), `xmlns` → NAMESPACE
- Keine Exceptions bei ungültigem Input

**Overlay-Architektur:**
- Container (position: relative) mit Textarea (z-index: 2, transparent) und Pre (z-index: 1, pointer-events: none)
- Identische CSS: font-family, font-size, line-height, padding, white-space, tab-size
- Scroll-Sync: `textarea.onscroll → pre.scrollTop/Left = textarea.scrollTop/Left`
- Debouncing: `requestAnimationFrame` für Re-Highlighting bei Input

**Status:** Tokenizer und Overlay-Editor implementiert, Unit-Tests erstellt.

---

#### Stufe 2: Editor-Fundament (Stories 0.1, 0.3, 0.4)

**Ziel:** Reaktives Dokumentenmodell mit 4 Zustandsschichten, Undo/Redo, Gutter.

**Erstellt / Geändert:**

| Datei | Details |
|---|---|
| `docs/js/model.js` | `DocumentModel extends EventTarget`. 4 Zustandsschichten. Snapshot-basiertes Undo/Redo (max 100). Keystroke-Gruppierung (500ms). |
| `docs/tests/model.test.js` | 15 Unit-Tests: XML, Undo/Redo, Keystroke, Confidence, Review, Validation, Reset. |
| `docs/js/editor.js` | Erweitert: Gutter (Zeilennummern, Konfidenz-Marker), scroll-synced. |
| `docs/css/style.css` | Gutter-CSS: `.editor-gutter`, `.gutter-line`, `.gutter-marker-*`. Flexbox-Layout. |

**Status:** Model, Gutter-Editor und Tests implementiert.

---

#### Stufe 3: Import (Stories 1.1, 1.2, 1.3)

**Ziel:** Source-Panel-Modul und Storage-Service extrahieren.

| Datei | Details |
|---|---|
| `docs/js/source.js` | `createSourcePanel()` – Quelltext-Anzeige mit Plaintext/Digitalisat-Tabs. Wiederverwendbar in Transform- und Validate-Steps. |
| `docs/js/services/storage.js` | LocalStorage-Wrapper mit `teiCrafter_`-Prefix. getSetting/setSetting/removeSetting. API-Keys werden NIE gespeichert. |

**Status:** Source-Panel und Storage-Service implementiert. Import-Logik war bereits in app.js (Stufe 0).

---

#### Stufe 4: LLM-Konfiguration (Stories Q.1, Q.2)

**Ziel:** Multi-Provider LLM-Service mit sicherer API-Key-Verwaltung.

| Datei | Details |
|---|---|
| `docs/js/services/llm.js` | 4 Provider-Adapter (Gemini, OpenAI, Anthropic, Ollama). API-Keys in module-scoped Map (nicht window/DOM/Storage). setApiKey() validiert (max 256 Zeichen, druckbares ASCII). complete() mit credentials:'omit'. testConnection(). |

**Provider-Adapter:**

| Provider | Auth | Besonderheit |
|---|---|---|
| Gemini | URL-Param `?key=` | Modell in URL |
| OpenAI | `Authorization: Bearer` | Standard Chat-API |
| Anthropic | `x-api-key` + `anthropic-dangerous-direct-browser-access` | Browser-CORS |
| Ollama | Keine | localhost:11434 |

**Sicherheit:**
- Keys nur in module-scoped `Map` (nicht exportiert)
- `setApiKey()` validiert Input
- Alle `fetch()` mit `credentials: 'omit'`
- Provider und Modell in LocalStorage, Keys NIE

**Status:** LLM-Service implementiert.

---

#### Stufe 5: Mapping / Stufe 6: Transform (Stories 2.1, 2.2, 3.1, 3.2, 3.3)

**Ziel:** Dreischichten-Prompt-Assemblierung, Response-Parsing, Konfidenz-Extraktion.

| Datei | Details |
|---|---|
| `docs/js/services/transform.js` | `assemblePrompt()` (Basis + Kontext + Mapping), `getPromptLayers()` (UI-Preview), `transform()` (LLM-Call + Parse), `extractXmlFromResponse()`, `extractConfidenceMap()`, `compareText()`. |

**Dreischichten-Prompt:**
1. **Basis:** Wohlgeformtheit, Texterhalt, @confidence/@resp, Präzision vor Recall
2. **Kontext:** Quellentyp, Sprache, Epoche, Projekt
3. **Mapping:** Projektspezifische Annotationsregeln (filterbar nach gewählten Typen)

**Konfidenz-Mapping:** high→sicher, medium→prüfenswert, low→problematisch, fehlend→prüfenswert (konservativ).

**Status:** Transform-Service implementiert.

---

#### Stufe 7: Review (Stories 4.1, 4.2, 4.3)

**Ziel:** Inline- und Batch-Review-Workflow für Annotationen.

| Datei | Details |
|---|---|
| `docs/js/preview.js` | `createPreview()` – Interaktive Vorschau mit TEI-XML→HTML-Konvertierung. Inline-Review (Hover-Aktionsleiste: Accept/Edit/Reject) und Batch-Keyboard-Review (N/P/A/R/E/Escape). Fortschrittsbalken, Annotation-Focus mit Scroll-to-View. |
| `docs/css/style.css` | Preview-Container, Konfidenz-Tint-Overlays (conf-sicher/pruefenswert/problematisch/manuell), Review-Status-Encoding (Akzeptiert=dezent, Verworfen=durchgestrichen+transparent, Editiert=dashed outline), Annotation-Focus (Gold-Outline), Hover-Bar, Batch-Review-Bar mit Fortschritt und Keyboard-Hints. |

**Inline-Review (Story 4.1):**
- Hover auf prüfenswert/problematisch → Kompakte Aktionsleiste (Accept/Edit/Reject)
- Accept → Konfidenz→sicher, Status→akzeptiert
- Edit → Konfidenz→manuell, Status→editiert
- Reject → Status→verworfen (visuell durchgestrichen)
- Bereits akzeptierte Annotationen zeigen keine Hover-Bar

**Batch-Review (Story 4.2):**
- N: Nächste offene Annotation (springt zu, scrollt, Gold-Focus)
- P: Vorige offene Annotation
- A/R/E: Accept/Reject/Edit + automatisch zur Nächsten
- Escape: Batch-Mode beenden
- Fokussierte Annotation wird per `scrollIntoView` zentriert

**Fortschrittsbalken (Story 4.3):**
- Navy-Bar am oberen Rand der Vorschau
- "Review: X / Y geprüft" mit Proportional-Balken (Gold)
- Aktuelle Annotation: Tag-Name + Text-Vorschau
- Keyboard-Hints als kbd-Elemente
- "Alle Annotationen geprüft!" bei Abschluss

**Dual-Channel-Encoding in Review:**
- Typ-Kanal: Unterstreichungsfarbe (entity.persName/placeName/...)
- Konfidenz-Kanal: Hintergrund-Tint + Unterstreichungsstil (solid=sicher, dashed=prüfenswert, dotted=problematisch, double=manuell)

**Status:** Preview-Modul und Review-CSS implementiert.

---

#### Stufe 8: Validierung (Stories 5.1, 5.2)

**Ziel:** Plaintext-Vergleich, Wohlgeformtheit, Schema-Validierung gegen JSON-Profil.

| Datei | Details |
|---|---|
| `docs/js/services/validator.js` | `validate()` – Multi-Level-Validierung: Level 1 Plaintext-Vergleich (Wort-Ähnlichkeit), Level 2 Wohlgeformtheit (DOMParser), Level 3 Schema-Validierung (Element-Nesting, Attribute), Level 5 Ungeprüfte Annotationen. |
| `docs/js/services/schema.js` | `loadSchema()` – JSON-Schema-Profil laden und abfragen. `isKnownElement()`, `isChildAllowed()`, `isAttributeKnown()`, `getAllowedChildren()`. Permissiv bei unbekannten Elementen. |
| `docs/schemas/dtabf.json` | Hardcodiertes Schema-Profil: 30+ Elemente aus den 3 Demo-Datensätzen (HSA Brief, DTA Druck, Rezept). allowedChildren, allowedParents, Attribut-Typen (enum, string, uri, date, number, language). |
| `docs/tests/validator.test.js` | 12 Unit-Tests in 4 Suites: Well-formedness, Plaintext-Vergleich, Unreviewed-Check, Integration. |

**Validierungsebenen:**

| Ebene | Implementiert | Blockiert Export |
|---|---|---|
| 1: Plaintext-Vergleich | Ja | Ja (bei <95% Ähnlichkeit) |
| 2: Wohlgeformtheit | Ja | Ja |
| 3: Schema-Validierung | Ja (JSON-Profil) | Nein (nur Warnung) |
| 4: XPath-Regeln | Nein (Phase 3) | — |
| 5: Expert-in-the-Loop | Ja (= Review) | Warnung |

**Schema-Profil `dtabf.json`:**
- 30+ Elemente: TEI, teiHeader, fileDesc, titleStmt, publicationStmt, sourceDesc, profileDesc, correspDesc, correspAction, text, body, div, p, head, pb, lb, opener, closer, dateline, salute, signed, persName, placeName, orgName, date, name, bibl, term, measure, material, foreign
- Pro Element: allowedChildren, allowedParents, Attribut-Definitionen

**Status:** Validator, Schema-Service, Schema-Profil und Tests implementiert.

---

#### Stufe 9: Export (Stories 6.1, 6.2)

**Ziel:** TEI-XML exportieren mit Attribut-Bereinigung und Ungeprüft-Warnung.

| Datei | Details |
|---|---|
| `docs/js/services/export.js` | `prepareExport()` – Attribut-Bereinigung (@confidence, @resp). `getExportStats()` – Zeilen/Entitäten-Zählung. `downloadXml()` – Blob-Download. `copyToClipboard()` – Zwischenablage (mit Fallback). `getExportFileName()` – Dateiname-Generierung. |

**Attribut-Bereinigung:**

| Attribut | Standard-Export | Option "Beibehalten" |
|---|---|---|
| `@confidence` | Entfernt | Beibehalten (high/medium/low) |
| `@resp="#machine"` | Entfernt | Umgewandelt in `@resp="#teiCrafter"` |
| Review-Status | Nicht exportiert | — |

**Export-Formate:**
- Vollständiges TEI-XML (mit teiHeader)
- Nur `<body>` (für Import in bestehende Editionen)

**Sicherheit:**
- Download über `Blob` + `URL.createObjectURL()` (kein Server-Roundtrip)
- Clipboard mit `navigator.clipboard.writeText()` + `execCommand('copy')` Fallback
- XML-Serialisierung über `XMLSerializer` (garantiert wohlgeformte Ausgabe)

**Status:** Export-Service implementiert. Alle 10 Stufen abgeschlossen.
