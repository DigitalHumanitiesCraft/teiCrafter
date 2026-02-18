# teiCrafter -- Gesamtes Projektwissen

Konsolidiertes Wissensdokument, destilliert aus 16 Einzeldokumenten im `knowledge/`-Ordner. Dieses Dokument dient als eigenstaendige Referenz fuer das gesamte Projekt -- fuer Menschen, Agenten und Publikationen.

Stand: 2026-02-18 (Session 16)

---

## 1. Was ist teiCrafter?

Ein browserseitiges Werkzeug, das Geisteswissenschaftler:innen hilft, Plaintext mit LLM-Unterstuetzung in valides TEI-XML zu annotieren. Kein Server, kein Account, kein Install -- eine statische Webseite, die im Browser laeuft und via GitHub Pages aus `/docs` deployed wird.

### Pipeline-Position

```
Bild -> coOCR HTR -> teiCrafter -> ediarum/GAMS/Publikation
       (Transkription)  (Annotation)    (Tiefenerschliessung)
```

### Epistemische Grundlage

LLMs erzeugen plausible Annotationen, koennen deren Korrektheit aber nicht zuverlaessig beurteilen. Der Mensch ist strukturell notwendig -- nicht als optionale Qualitaetskontrolle, sondern als integraler Bestandteil. Dieses Konzept der **epistemischen Asymmetrie** (uebernommen von coOCR HTR) durchzieht alle Designentscheidungen.

### Strategische Differenziatoren

| # | Was | Warum es zaehlt |
|---|---|---|
| 1 | Zero Infrastructure | Eliminiert die #1-Adoptionsbarriere in DH. Kein Server, kein Account, kein Install. |
| 2 | LLM als First-Pass-Annotator + obligatorischer Human Review | Tedium reduziert, wissenschaftliche Autoritaet bewahrt |
| 3 | Schema-Profil-gefuehrter LLM-Output | JSON-Schema-Profil verhindert halluziniertes Markup |
| 4 | Bring Your Own API Key (6 Provider) | Kein Vendor Lock-in |

### Marktposition (Stand 2026-02)

Eine Analyse von 10+ DH-Werkzeugen (Oxygen, ediarum, TEI Publisher, CATMA, Transkribus, eScriptorium, LEAF-Writer, JinnTap, FromThePage, EVT, TextGrid) bestaetigt: **Kein bestehendes Tool kombiniert TEI-Annotation + LLM-Unterstuetzung + Human Review in einem Browser-only-Tool.** teiCrafter ist First Mover in dieser Nische. Naechster Vergleichspunkt: JinnTap (e-editiones, TEI 2025) -- WYSIWYM-Editor, aber ohne LLM-Integration.

Detaillierte Vergleichsmatrix: `knowledge/LANDSCAPE.md`
Forschungslandschaft 2025--2026: `knowledge/research-landscape.md`

---

## 2. Architektur

### Systemuebersicht

```
+-----------------------------------------------------------------+
|                         BROWSER                                 |
+-----------------------------------------------------------------+
|  UI-SCHICHT                                                     |
|  Header+Stepper | Source-Panel | XML-Editor | Vorschau+Review   |
+-----------------------------------------------------------------+
|  ANWENDUNGSSCHICHT                                              |
|  DocumentModel | Schema-Engine | Transform-Service | Export     |
+-----------------------------------------------------------------+
|  SERVICE-SCHICHT                                                |
|  LLM API (6 Provider) | ODD-Parser | Validator | Event-System  |
+-----------------------------------------------------------------+
|  PERSISTENZ                                                     |
|  LocalStorage (Settings) | IndexedDB (geplant)                 |
+-----------------------------------------------------------------+
                              | HTTPS
+-----------------------------------------------------------------+
|  EXTERNE APIs: Gemini | OpenAI | Anthropic | DeepSeek | Qwen | Ollama |
+-----------------------------------------------------------------+
```

### Dateistruktur

```
docs/
+-- index.html              Entry Point, 5-Step-Stepper
+-- css/style.css           ~2645 Zeilen, TEI-Farbsystem, 98 Custom Properties
+-- js/
|   +-- app.js              ~1031 Zeilen, Application Shell, Event-Delegation
|   +-- model.js            248 Zeilen, DocumentModel (EventTarget), 4 Layers, Undo/Redo
|   +-- tokenizer.js        200 Zeilen, State-Machine XML-Tokenizer, 9 Token-Typen
|   +-- editor.js           243 Zeilen, Overlay-Editor (Textarea + Pre + Gutter)
|   +-- preview.js          502 Zeilen, Interaktive Vorschau, Inline/Batch-Review
|   +-- source.js           68 Zeilen, Source-Panel (Plaintext/Digitalisat-Tabs)
|   +-- services/
|   |   +-- llm.js          344 Zeilen, 6 Provider, MODEL_CATALOG, API-Key-Isolation
|   |   +-- transform.js    224 Zeilen, 3-Layer-Prompt, Response-Parsing, Konfidenz
|   |   +-- validator.js    304 Zeilen, 4 Validierungsebenen (von 5)
|   |   +-- schema.js       94 Zeilen, JSON-Schema-Profil, Lazy Loading
|   |   +-- export.js       166 Zeilen, Attribut-Bereinigung, Download, Clipboard
|   |   +-- storage.js      69 Zeilen, localStorage-Wrapper
|   +-- utils/
|       +-- constants.js    ~140 Zeilen, Enums, Configs, Icons, ANNOTATION_TAGS
|       +-- dom.js          172 Zeilen, $, $$, escHtml, showToast, showDialog
+-- schemas/dtabf.json      30+ TEI-Elemente, DTABf-Subset
+-- tests/                  51 Unit-Tests (tokenizer: 17, model: 21, validator: 13)
+-- data/demo/              2 echte Demos (CoReMA-Rezept, DEPCHA-Rentrechnung)
```

### Technologie-Entscheidungen

| Entscheidung | Begruendung |
|---|---|
| Kein Framework | Reduziert Komplexitaet, verbessert Langlebigkeit |
| ES6 Modules | Nativer Browser-Support, kein Bundler |
| EventTarget fuer State | Native API, DevTools-Integration, kein eigener Event-Bus |
| CSS Custom Properties | Theming ohne Praeprozessor |
| Fetch API | Nativ, ausreichend fuer REST |
| Kein Backend | Datensouveraenitaet, keine Hosting-Kosten, Ollama als lokale Option |

### Schluessel-Patterns

| Pattern | Wo | Detail |
|---|---|---|
| Event-Delegation | app.js | Ein Click-Listener auf `.app-main`, `data-action`-Attribute |
| stepCleanup | app.js | Cleanup-Funktion fuer step-spezifische Listener |
| INITIAL_STATE + structuredClone | app.js | DRY Reset fuer AppState |
| Dreischichten-Prompt | transform.js | Basis + Kontext + Mapping |
| Konfidenz-Mapping | transform.js | high->sicher, medium->pruefenswert, low->problematisch |
| Dual-Channel-Encoding | preview.js, CSS | Unterstreichungsfarbe (Typ) + Hintergrund-Tint (Konfidenz) |
| Snapshot-Undo | model.js | Max 100 Snapshots, 500ms Keystroke-Gruppierung |
| API-Key-Isolation | llm.js | Module-scoped Map, nie in DOM/Storage/window |
| Graceful Degradation | tokenizer.js | Kein throw, unterminated constructs consumed bis EOF |
| Permissive Schema | schema.js | Ohne geladenes Schema: alles gueltig |

---

## 3. Workflow (5 Schritte)

```
Import -> Mapping -> Transform -> Validate -> Export
```

### Schritt 1: Import

- Dropzone, Datei-Auswahl, Demo-Karten, Format-Badges
- Dateiformate: .txt, .md, .xml, .docx (DOCX via JSZip-CDN)
- 2 Demo-Datensaetze mit echten Daten: CoReMA-Rezept, DEPCHA-Rentrechnung
- Validierung: Dateigroesse (10 MB), Dateityp, XML-Wohlgeformtheit
- Quellentyp-Erkennung via Keyword-Matching (detectType)

### Schritt 2: Mapping

- Quellentyp-Auswahl (5 Typen: correspondence, bookkeeping, print, recipe, generic)
- Editierbare Mapping-Regeln als Markdown-Liste
- Kontext-Felder: Sprache, Epoche, Projektname
- Default-Mappings pro Quellentyp vorausgefuellt

### Schritt 3: Transform

Der Kern des Werkzeugs. LLM-gestuetzte Annotation ueber eine **Dreischichten-Prompt-Architektur**:

**Basisschicht (generisch):** Wohlgeformtes TEI-XML erzeugen, Text nicht veraendern, @confidence und @resp setzen, Praezision vor Recall.

**Kontextschicht (quellenspezifisch):** Quellentyp, Datierung, Sprache, Schreiber, Projektkontext.

**Mapping-Schicht (projektspezifisch):** Vom User editierte Markdown-Regeln, die definieren welche TEI-Elemente wie verwendet werden sollen.

Technisch: `assemblePrompt()` in transform.js assembliert den Prompt, `llm.complete()` sendet ihn, `extractXmlFromResponse()` parst die Antwort (3 Fallback-Strategien: XML-Codeblock, generischer Codeblock, rohes XML), `extractConfidenceMap()` extrahiert die Konfidenz-Zuordnung.

Demo-Modus: Statt LLM-Aufruf wird die `expectedOutput`-Datei geladen.
Cancel-Support: AbortController, Cancel-Button waehrend Transform.

### Schritt 4: Validate

Fuenf Validierungsebenen:

| Ebene | Status | Blockiert Export | Beschreibung |
|---|---|---|---|
| 1: Wohlgeformtheit | Implementiert | Ja | DOMParser + parsererror-Check |
| 2: Plaintext-Vergleich | Implementiert | Nein (Warnung) | Wort-Similaritaet, Schwelle 95% |
| 3: Schema-Validierung | Implementiert | Nein (Warnung) | Element/Attribut/Parent-Child gegen dtabf.json |
| 4: XPath-Regeln | Phase 3 | -- | Projektspezifische Constraints |
| 5: Expert-Review | Implementiert | Nein (Warnung) | Zaehlung ungepruefter Annotationen |

### Schritt 5: Export

- Attribut-Bereinigung: @confidence und @resp werden per Default entfernt
- Optionen: keepConfidence, keepResp (Checkboxen)
- Download als TEI-XML, Clipboard-Kopie mit Fallback
- Entity-Statistiken via `getExportStats()` (9 Tag-Typen)

---

## 4. Review-Workflow

Der Review ist kein eigener Modus, sondern eine Schicht ueber der normalen Arbeitsoberflaeche.

### Inline-Review (preview.js)

Annotationen mit Konfidenz "pruefenswert" oder "problematisch" zeigen beim Hover eine Aktionsleiste:
- **Accept (A):** Konfidenz -> sicher, Status -> akzeptiert
- **Edit (E):** Konfidenz -> manuell, Status -> editiert
- **Reject (R):** Tag entfernt, Text erhalten, Status -> verworfen

### Batch-Review (preview.js)

Tastaturgesteuert fuer hohe Annotationszahlen:
- N/P: Naechste/vorige ungepruefte Annotation
- A/R/E: Accept/Reject/Edit + automatisch Weiter
- Esc: Batch-Modus beenden
- Fortschrittsanzeige: "7/12 reviewed" mit proportionalem Balken

### Konfidenz-System

| LLM-Output | Anwendungskategorie | Visuell |
|---|---|---|
| high | sicher | Gruener Tint (#E8F5F0) + solid Unterstreichung |
| medium | pruefenswert | Gold-Tint (#FEF5E7) + dashed Unterstreichung |
| low | problematisch | Roter Tint (#FDECEB) + dotted Unterstreichung |
| (fehlend) | pruefenswert (konservativ) | Gold-Tint + dashed |
| (manuell) | manuell | Kein Tint + double Unterstreichung |

**Dual-Channel-Encoding:** Annotationstyp wird ueber Unterstreichungsfarbe kodiert (blau=persName, teal=placeName, violett=orgName, amber=date, rose=bibl, grau=term). Konfidenz wird ueber Hintergrund-Tint kodiert. Beide Kanaele sind orthogonal.

---

## 5. LLM-Integration

### Provider

| Provider | Default-Modell | Auth-Typ | Endpoint |
|---|---|---|---|
| Gemini | gemini-2.5-flash | URL-Param | generativelanguage.googleapis.com |
| OpenAI | gpt-4.1-mini | Bearer Token | api.openai.com |
| Anthropic | claude-sonnet-4-5 | x-api-key | api.anthropic.com |
| DeepSeek | deepseek-chat | Bearer Token | api.deepseek.com |
| Qwen | qwen-plus | Bearer Token | dashscope.aliyuncs.com |
| Ollama | llama3.3 | Keine | localhost:11434 |

MODEL_CATALOG: 15+ Modelle mit Input/Output-Preisen pro 1M Tokens, Kontextlaenge, Reasoning-Flag.

### Sicherheitsmodell

- API-Keys: Module-scoped `Map` in llm.js. Nie exportiert, nie in DOM, localStorage, window, cookies, IndexedDB.
- Key-Validierung: Max 256 Zeichen, printable ASCII.
- Fetch: `credentials: 'omit'`.
- Storage: Nur Provider-Name und Modell-Name in localStorage (Prefix: `teiCrafter_`).

### Bekannte LLM-Failure-Modes bei TEI-XML

| Failure Mode | Mitigation in teiCrafter | Status |
|---|---|---|
| Malformed XML | DOMParser-Check | Implementiert |
| Text-Alteration | Plaintext-Vergleich (95% Schwelle) | Implementiert |
| Halluzinierte Attribute | Schema-Validierung + Export-Bereinigung | Implementiert |
| Ueber-Annotation | Prompt: "Praezision vor Recall" | Implementiert |
| Unter-Annotation | Multi-Pass | Phase 3 |
| Namespace-Verwechslung | ANNOTATION_TAGS-Whitelist | Implementiert |
| Struktur vs. Semantik | selectedTypes-Filter | Implementiert |
| Inkonsistenz ueber Dokument | Konsistenz-Check | Phase 3 |

### Prompt-Best-Practices (2025--2026 Forschung)

1. **Few-Shot-Beispiele** (2--3 pro Quellentyp) > verbose Regeln. Hoechster Einzelhebel.
2. Niedrige Temperature (0.1--0.3). Aktuell 0.2.
3. @confidence-Attribute anfordern -- LLMs sind bei NER-Certainty brauchbar kalibriert.
4. Output-Format strikt: "Nur XML, keine Erklaerungen."
5. Dokument-Chunking bei langen Texten (Phase 3).
6. Separate Passes fuer strukturelles vs. semantisches Markup (Phase 3).

---

## 6. Visuelles System

### Designhaltung

Zielgruppe: Forschende in den Digital Humanities. Leitprinzipien: Lesbarkeit, Orientierung, Handlungsfaehigkeit, Praezision. Aesthetik: TEI-Consortium-Identitaet (Navyblau, Bernstein-Gold, Schwarz), akademisch-editorisch.

### Farbsystem

**Strukturfarben:**
- Arbeitsflaeche: #FAFAF7 | Panel: #FFFFFF | Kopfzeile: #1E3A5F (Navy) | Rahmen: #D0D4DC

**Akzentfarben:**
- Gold (primaer): #CC8A1E | Blau (sekundaer): #2B5EA7

**Konfidenz:** Sicher=#2D8A70 (gruen), Pruefenswert=#CC8A1E (gold), Problematisch=#C0392B (rot)

**Annotationstyp-Unterstreichungen:**
persName=#3B7DD8, placeName=#2A9D8F, orgName=#7B68AE, date=#B8860B, bibl=#C47A8A, term=#6B7280

### Layout

5-Step-Stepper. Drei-Spalten-Layout in Schritt 3 (Transform):
- Source-Panel (25%): Plaintext/Digitalisat-Tabs
- XML-Editor (45%): Gutter + Code + Konfidenz-Marker
- Vorschau+Review (30%): Farbkodierte Annotationen, Aktionsleisten

Responsive: 3 Breakpoints (Desktop >1200px, Tablet 768--1200px, Mobile <768px).

### Typografie

UI: Inter | Code/XML: JetBrains Mono | Vorschau: Georgia. 8px-Grid.

---

## 7. Reaktives Dokumentenmodell

### DocumentModel (model.js)

Implementiert, aber noch nicht als State-Quelle in app.js genutzt (app.js nutzt einfaches AppState-Objekt).

**Vier Zustandsschichten:**
1. **Dokument:** TEI-XML-Baum (kanonische Repraesentation)
2. **Konfidenz:** Kategorie pro annotiertem Element (sicher/pruefenswert/problematisch/manuell)
3. **Validierung:** Liste von Nachrichten mit Dokumentpositionen
4. **Review-Status:** Pro Element: offen/akzeptiert/editiert/verworfen

**Events:** documentChanged, confidenceChanged, validationComplete, reviewAction, undoRedo

**Undo/Redo:** Snapshot-basiert, Max 100, 500ms Keystroke-Gruppierung, Transform = 1 Undo-Einheit.

### AppState (app.js) -- aktuell genutzt

```
currentStep, inputContent, inputFormat, fileName, demoId, sourceType,
mappingRules, context{language, epoch, project}, outputXml,
confidenceMap, transformStats, originalPlaintext
```

---

## 8. XML-Tokenizer

State-Machine-Tokenizer in tokenizer.js. Reine Funktion: String rein, Token-Array raus. Kein DOM-Zugriff.

**9 Token-Typen:** ELEMENT, ATTR_NAME, ATTR_VALUE, DELIMITER, COMMENT, PI, NAMESPACE, ENTITY, TEXT

**Invarianten:** Lueckenlose Abdeckung des Inputs. Kein throw -- graceful degradation bei Malformed XML.

---

## 9. Schema-Fuehrung (ODD-basiert)

**Stufe 1 (implementiert):** Hardcodiertes JSON-Profil (dtabf.json) mit 30+ TEI-Elementen. Jedes Element definiert: allowedChildren, allowedParents, attributes, optional selfClosing. Permissiv wenn kein Schema geladen.

**Stufe 2 (Phase 3):** Clientseitiges ODD-Parsing. ODD-Dateien -> JSON-Lookup. Herausforderung: Vererbungshierarchien, @mode-Interpretation.

---

## 10. Implementierungs-Status

### Phasen

| Phase | Beschreibung | Status |
|---|---|---|
| Phase 1 | UI-Design, Promptotyping | Abgeschlossen |
| Phase 2 | Prototyp (10 Stufen) | UI-Shell komplett, Service-Integration abgeschlossen |
| Phase 3 | teiModeller, Destillation, Konsolidierung | Geplant |

### Modul-Status

| Modul | Typ | In app.js integriert | Tests |
|---|---|---|---|
| app.js | Shell | -- | Nein |
| model.js | State | Nein | 21 |
| tokenizer.js | Parser | Nein (editor.js nicht integriert) | 17 |
| editor.js | View | Nein | Nein |
| preview.js | View | Nein | Nein |
| source.js | View | Nein | Nein |
| llm.js | Service | Ja | Nein |
| transform.js | Service | Ja | Nein |
| validator.js | Service | Ja | 13 |
| schema.js | Service | Ja | Nein |
| export.js | Service | Ja | Nein |
| storage.js | Service | Indirekt (via llm.js) | Nein |
| constants.js | Utility | Ja | Nein |
| dom.js | Utility | Ja | Nein |

**Zusammenfassung:** 14/14 Module implementiert. 7/14 direkt in app.js integriert. 51 Unit-Tests, ~21% Coverage.

### Was funktioniert

- Alle 14 Module implementiert, 7 direkt in app.js integriert
- Import: Dropzone, .txt/.md/.xml/.docx, 2 Demo-Karten mit echten Daten
- Mapping: Quellentyp-Auswahl (5 Typen), editierbare Regeln, Kontext-Felder
- Transform: Echter LLM-Aufruf via transform.js -> llm.js, Demo-Modus, Cancel-Support
- Validate: Plaintext-Vergleich, Wohlgeformtheit, Schema-Validierung
- Export: Attribut-Bereinigung, Download, Clipboard
- Settings: 6 Provider, Modell-Dropdown mit Preisen, Verbindungstest
- Event-Delegation (kein Listener-Leak), ANNOTATION_TAGS zentralisiert

### Was fehlt

- View-Module (editor.js, preview.js, source.js) nicht in app.js verdrahtet
- DocumentModel nicht als State-Quelle (kein Undo/Redo im UI)
- Vorschau ist Regex-basiertes Inline-HTML statt preview.js
- Review-Workflow nur in preview.js implementiert, nicht erreichbar
- Noch nie mit echtem LLM-Transform end-to-end getestet (Phase A)

---

## 11. Strategie: Durchstich-first

### Entscheidung

Statt Architektur polieren (DocumentModel, View-Module, Tests) zuerst beweisen, dass der Kern funktioniert. Begruendung: SW-Literatur (Cockburn 2004, Freeman/Pryce 2009, Hunt/Thomas 1999) und Marktanalyse.

### Fahrplan

```
Phase A -- Durchstich validieren (1--2 Sessions):
  A0. Demo-Daten mit echten Quellen (CoReMA, DEPCHA)           -- erledigt
  A1. Echten LLM-Transform testen (Demo-Rezept + API-Key)
  A2. Few-Shot-Beispiele in Prompt-Assembly einbauen
  A3. Bruchstellen dokumentieren und fixen

Phase B -- Review-Workflow erlebbar machen (1--2 Sessions):
  B1. preview.js in app.js einbinden (Inline-Review + Konfidenz)
  B2. Batch-Review aktivieren (Tastaturnavigation N/P/A/R/E)
  B3. Konfidenz-Visualisierung (Dual-Channel statt Regex)

Phase C -- Gezielte Architektur (nur was der Durchstich erfordert):
  C1. DocumentModel einfuehren (nur wenn Undo/Redo sich als noetig erweist)
  C2. editor.js einbinden (nur wenn Regex-XML-Darstellung nicht reicht)
  C3. Tests gezielt fuer Bruchstellen schreiben
```

### Erfolgskriterium

> Editorin laedt Demo-Rezept -> konfiguriert API-Key -> klickt "Transformieren" -> sieht annotiertes Ergebnis mit Konfidenz-Farben -> geht 5 Annotationen per Batch-Review durch -> validiert -> exportiert valides TEI-XML.

### Bewusst aufgeschoben

DocumentModel-Umbau, Test-Coverage 80%, teiModeller (Phase 3), CodeMirror 6, Normdaten/Register, Dark Mode, Kollaboration, i18n.

---

## 12. Entscheidungen

### Entschieden

| Entscheidung | Ergebnis |
|---|---|
| Editor-Engine | Overlay (Prototyp), CodeMirror 6 (Produkt) |
| Prompt-Architektur | Dreischichten-Modell (Basis, Kontext, Mapping) |
| Validierungsebenen | Fuenf Ebenen (Plaintext, Schema, XPath, LLM-Judge, Expert) |
| Konfidenz-Kategorien | sicher, pruefenswert, problematisch, manuell |
| LLM-Provider | 6: Gemini, OpenAI, Anthropic, DeepSeek, Qwen, Ollama |
| Event-Management | Event-Delegation statt individuelle Listener |
| Entwicklungsstrategie | Durchstich-first, dann gezielte Architekturverbesserung |
| Preview vor Editor | DH-Scholars wollen visuelles Feedback, nicht Spitzklammern |
| Demo-Daten | Echte Quellen: CoReMA-Rezept (CC BY 4.0), DEPCHA-Rentrechnung (CC BY 4.0) |
| Bookkeeping als sourceType | Eigener Quellentyp mit bk:-Attributen |

### Offen (Prioritaet Hoch)

- **DocumentModel vs. AppState:** DocumentModel-Umbau kann warten. Erst beweisen, dass der Durchstich mit AppState funktioniert.

### Offen (Prioritaet Mittel)

- Diff-Darstellung: Annotierter Text vs. XML-Diff vs. Side-by-Side
- Source-Panel: Permanent vs. einklappbar
- Cursor-Kopplung: Bidirektional vs. unidirektional

### Offen (Prioritaet Niedrig)

- ODD-Parsing generisch (Phase 3)
- Register-Integration (Personen, Orte)
- Undo-Strategie fuer grosse Dokumente
- Multi-Pass-Transform
- Verschachtelte Annotationen
- Few-Shot-Beispiele: automatisch vs. manuell
- teiModeller-Granularitaet
- Normdaten-Integration (GND/VIAF/Geonames)

Vollstaendige Liste: `knowledge/DECISIONS.md`

---

## 13. teiModeller (Phase 3)

Der teiModeller unterstuetzt den Prozess der Modellierungsentscheidung: "Wie soll dieses Textphaenomen in TEI abgebildet werden?" Er erzeugt als Ergebnis Mapping-Regeln fuer die Mapping-Schicht der Prompt-Architektur.

### Wissensgrundlage: Destillierte Module statt RAG

Kein RAG-System. Stattdessen eine Sammlung destillierter TEI-Wissensmodule -- komprimierte, LLM-optimierte Darstellungen der TEI Guidelines (588 Elemente, 23 Module, Version 4.10.2). Pro TEI-Modul ein destilliertes Wissensmodul mit zwei Wissenstypen:
- **Referenzwissen:** Elemente, Attribute, Klassen, Inhaltsmodelle
- **Modellierungswissen:** Annotationsmuster, Entscheidungsalternativen, haeufige Fehler

### Destillations-Pipeline

Dreistufig: Scraping (TEI-Website -> Markdown) -> Destillation (LLM-komprimiert) -> Validierung (Vollstaendigkeit, Korrektheit, Stichprobe). Pilotmodul: `namesdates` (Kapitel 14).

### Abgrenzung zum Transform

| Aspekt | teiModeller | Transform |
|---|---|---|
| Frage | "Wie soll annotiert werden?" | "Annotiere diesen Text" |
| Input | Textphaenomen oder Nutzerfrage | Gesamter TEI-Body |
| Output | Mapping-Regel(n) | Annotiertes TEI-XML |

Spezifikation: `knowledge/teiModeller.md`, `knowledge/DISTILLATION.md`

---

## 14. Demo-System

### Demo-Datensaetze

| ID | Name | Quellentyp | Quelle |
|---|---|---|---|
| recipe | Mittelalterliches Rezept | recipe | CoReMA, Wo1 Bl. 211r--211v (CC BY 4.0) |
| bookkeeping | Rechnungsbuch | bookkeeping | DEPCHA, Rentrechnung 1718 (CC BY 4.0) |

Beide Demos enthalten: Plaintext, Mapping-Regeln (mit Few-Shot-Beispielen), Expected-Output (manuell erstelltes Referenz-TEI).

### Demo-Modus

In `performTransform()`: Wenn `demoId` gesetzt, wird statt LLM-Aufruf die `expectedOutput`-Datei geladen. Fuer Live-Tests: `AppState.demoId = null` in Browser-Konsole setzen.

---

## 15. Forschungslandschaft (2025--2026)

### Zentrale Befunde

1. **LLM-gestuetzte TEI-Annotation waechst schnell, ist aber konzentriert.** Die Pollin-et-al.-Survey (ZfDG 2025) ist die wichtigste Referenz. TEI 2025 (Krakau) hatte mindestens 6 Praesentationen zum Thema.

2. **Kein integriertes System existiert**, das LLM-gestuetzte TEI-Generierung, ODD-gefuehrte Schema-Validierung, LLM-as-Judge und Human-in-the-Loop Review kombiniert.

3. **LLM-as-a-Judge hat sich schnell entwickelt**, aber Domain-Experten stimmen nur zu 64--68% mit LLM-Judges ueberein (IUI 2025). Human Review bleibt essenziell.

4. **Confidence Calibration** ist ein offenes Problem: Alle getesteten LLMs zeigen negativen Bias gegen epistemische Marker (EMBER, Lee et al. NAACL 2025).

5. **Constrained Decoding kann Performance verschlechtern** (Schall & de Melo, RANLP 2025). Post-generation Validation (wie in teiCrafter) ist der robustere Ansatz.

### teiCrafter-Positionierung

teiCrafter ist nicht nur ein Tool, sondern eine **methodische Kontribution**: Bruecke zwischen NLP-Evaluierungsliteratur und Digital-Humanities-Editionspraxis.

Zentrale Designentscheidungen werden durch Forschung gestuetzt:
- Separate Modelle fuer Generierung und Evaluierung (Preference Leakage)
- Post-generation Validation statt Constrained Decoding
- Stepwise statt holistische Qualitaetsbewertung
- Human Review als finaler Schiedsrichter

Vollstaendige Analyse: `knowledge/research-landscape.md`

---

## 16. Synergieprojekte

| Projekt | Relevanz |
|---|---|
| Schliemann Rechnungsbuecher | Bookkeeping-Ontologie, Transaktionen |
| zbz-ocr-tei | DTA-Basisformat, historische Drucke |
| DoCTA | SiCPAS/BeNASch, mittelalterliche Rezepte |
| Stefan Zweig Digital | Korrespondenzen |
| coOCR HTR | Upstream-Tool, geteilte Architektur |
| DIA-XAI | EQUALIS-Framework, Expert-in-the-Loop |

---

## 17. Wissensbasis-Karte

```
KNOWLEDGE.md (dieses Dokument -- Gesamtbild, Projekt-Root)
    |
    +-- knowledge/
    |   +-- SYNTHESIS.md        Kompaktes Gesamtbild (5 Minuten)
    |   +-- REFERENCE.md        Technische Tiefe fuer Agenten/Entwickler
    |   +-- VISION.md           Was und warum
    |   +-- LANDSCAPE.md        Markt und Positionierung
    |   +-- research-landscape.md  Forschungslandschaft 2025--2026
    |   +-- DESIGN.md           Visuelles System
    |   +-- ARCHITECTURE.md     Technisches Fundament
    |   +-- WORKFLOW.md         Annotation, Review, Validierung
    |   +-- teiModeller.md      Modellierungsberatung (Phase 3)
    |   +-- DISTILLATION.md     TEI-Guidelines-Pipeline (Phase 3)
    |   +-- STATUS.md           Was ist gebaut? (Ist-Stand)
    |   +-- MODULES.md          API-Referenz (Ist-Stand)
    |   +-- STORIES.md          Was muss getestet werden?
    |   +-- DECISIONS.md        Was wurde entschieden?
    |   +-- INDEX.md            Navigationsverzeichnis
    |   +-- JOURNAL.md          Was wurde wann gemacht?
```

16 Einzeldokumente, ~7000 Zeilen, reines Standard-Markdown. Kein Build-Step, keine Obsidian-Features.

---

## 18. Metriken

| Metrik | Wert |
|---|---|
| JS-Module | 14 (alle implementiert) |
| Davon in app.js integriert | 7 Services + Utilities |
| Davon nicht integriert | 3 View-Module + model.js |
| Unit-Tests | 51 (tokenizer: 17, model: 21, validator: 13) |
| Test-Coverage | ~21% |
| CSS | ~2645 Zeilen, 98 Custom Properties |
| app.js | ~1031 Zeilen |
| LLM-Provider | 6 |
| Modelle im Katalog | 15+ |
| Demo-Datensaetze | 2 (Rezept, Rechnungsbuch) |
| Knowledge-Dokumente | 16 |
| Sessions | 16 |

---

## 19. Abgeschlossene Meilensteine

| Stufe | Beschreibung |
|---|---|
| 0 | ES6 Module-Infrastruktur |
| 0.5 | Visuelle Testmatrix (24 Kombinationen) |
| 1 | Overlay-Spike (kein Scroll-Drift) |
| 2 | Editor-Fundament (Tokenizer + Model + Tests) |
| 3 | Import (Source-Panel) |
| 4 | LLM-Konfiguration (6 Provider) |
| 5+6 | Mapping + Transform (Prompt + Parsing) |
| 7 | Review (Inline + Batch) |
| 8 | Validierung (Schema + Validator) |
| 9 | Export (Bereinigung + Download) |
| 11--13 | Service-Integration (Transform, Validator, Export in app.js verdrahtet) |
| A0 | Demo-Daten mit echten Quellen (CoReMA, DEPCHA), Bookkeeping-sourceType |

---

*Dieses Dokument ist eine Synthese aus 16 Wissensdokumenten in `knowledge/`. Fuer Detailfragen zu einzelnen Themen siehe die jeweiligen Einzeldokumente.*
