# teiCrafter Development Journal

Chronologisches Arbeitsprotokoll des teiCrafter-Projekts.

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
