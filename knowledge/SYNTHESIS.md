# teiCrafter – Synthese

Kompaktes Gesamtbild des Projekts. Destilliert aus 15 Wissensdokumenten, 16 Sessions, und einer Marktanalyse. Ziel: Jeder Mensch oder Agent kann mit diesem Dokument in 5 Minuten den vollen Kontext erfassen.

Stand: 2026-02-18 (Session 16)

---

## Was ist teiCrafter?

Ein browserseitiges Werkzeug, das Geisteswissenschaftler:innen hilft, Plaintext mit LLM-Unterstützung in valides TEI-XML zu annotieren. Kein Server, kein Account, kein Install – eine statische Webseite, die im Browser läuft.

**Pipeline-Position:**

```
Bild → coOCR HTR → teiCrafter → ediarum/GAMS/Publikation
       (Transkription)  (Annotation)    (Tiefenerschließung)
```

**Epistemische Grundlage:** LLMs erzeugen plausible Annotationen, können deren Korrektheit aber nicht zuverlässig beurteilen. Der Mensch ist strukturell notwendig – nicht als optionale Qualitätskontrolle, sondern als integraler Bestandteil.

---

## Warum existiert es?

**Kein vergleichbares Tool existiert.** Eine Analyse von 10+ DH-Werkzeugen (Oxygen, ediarum, TEI Publisher, CATMA, Transkribus, eScriptorium, etc.) zeigt: Keines kombiniert TEI-Annotation + LLM-Unterstützung + Human Review in einem Browser-only-Tool. Siehe [LANDSCAPE.md](LANDSCAPE.md).

**Vier Differenziatoren:**

| # | Was | Warum es zählt |
|---|---|---|
| 1 | Zero Infrastructure | #1 Adoptionsbarriere in DH eliminiert |
| 2 | LLM als First-Pass-Annotator + obligatorischer Human Review | Tedium reduziert, wissenschaftliche Autorität bewahrt |
| 3 | Schema-Profil-geführter LLM-Output | Verhindert halluziniertes Markup |
| 4 | Bring Your Own API Key (6 Provider) | Kein Vendor Lock-in |

---

## Was existiert? (Ist-Stand)

### Architektur

```
docs/
├── index.html           # Entry Point
├── css/style.css        # ~2645 Zeilen, TEI-Farbsystem
├── js/
│   ├── app.js           # ~1031 Zeilen, 5-Step-Stepper, Event-Delegation
│   ├── model.js         # DocumentModel (EventTarget), 4 Layers, Undo/Redo
│   ├── tokenizer.js     # State-Machine XML-Tokenizer (9 Token-Typen)
│   ├── editor.js        # Overlay-Editor (Textarea + Pre + Gutter)
│   ├── preview.js       # Interaktive Vorschau mit Inline/Batch-Review
│   ├── source.js        # Source-Panel (Plaintext/Digitalisat-Tabs)
│   ├── services/
│   │   ├── llm.js       # 6 Provider, MODEL_CATALOG, API-Key nur in Memory
│   │   ├── transform.js # 3-Layer-Prompt, Response-Parsing, Konfidenz
│   │   ├── validator.js # 4 von 5 Validierungsebenen
│   │   ├── schema.js    # JSON-Schema-Profil (lazy-loaded)
│   │   ├── export.js    # Attribut-Bereinigung, Download, Clipboard
│   │   └── storage.js   # localStorage (nur Provider/Model, nie API-Keys)
│   └── utils/
│       ├── constants.js # ANNOTATION_TAGS, Enums, Configs, Icons
│       └── dom.js       # $, $$, escHtml, showToast, showDialog
├── schemas/dtabf.json   # 30+ TEI-Elemente
├── tests/               # 60 Unit-Tests (tokenizer, model, validator)
└── data/demo/           # 2 echte Demos (Rezept, Rentrechnung) + 1 Platzhalter
```

### Workflow (5 Schritte)

```
Import → Mapping → Transform → Validate → Export
  ✅       ✅        ✅          ✅         ✅     (Services verdrahtet)
  ✅       ✅        ⚠️          ⚠️         ✅     (Views: Inline-Regex statt Module)
```

**Was funktioniert:**
- Alle 14 Module implementiert, 7 direkt in app.js integriert
- Import: Dropzone, .txt/.md/.xml/.docx, 3 Demo-Karten (2 mit echten Daten)
- Mapping: Quellentyp-Auswahl (5 Typen inkl. bookkeeping), editierbare Regeln, Kontext-Felder
- Transform: Echter LLM-Aufruf via transform.js → llm.js, Demo-Modus, Cancel-Support
- Validate: Plaintext-Vergleich, Wohlgeformtheit, Schema-Validierung
- Export: Attribut-Bereinigung (@confidence, @resp), Download, Clipboard
- Settings: 6 Provider, Modell-Dropdown mit Preisen, Verbindungstest
- Event-Delegation (kein Listener-Leak), ANNOTATION_TAGS zentralisiert

**Was fehlt:**
- View-Module (editor.js, preview.js, source.js) nicht in app.js → Vorschau ist Regex-basiertes Inline-HTML
- DocumentModel nicht als State-Quelle → kein Undo/Redo im UI, keine Observer-Sync
- Noch nie mit echtem LLM-Transform end-to-end getestet (Phase A1 vorbereitet: Demo-Daten vorhanden)
- Review-Workflow (Accept/Reject/Edit) nur in preview.js implementiert, nicht in app.js erreichbar

### Schlüssel-Patterns

| Pattern | Wo | Detail |
|---|---|---|
| Event-Delegation | app.js | Ein Click-Listener auf `.app-main`, `data-action`-Attribute |
| stepCleanup | app.js | Cleanup-Funktion für step-spezifische Listener |
| INITIAL_STATE + structuredClone | app.js | DRY Reset für AppState |
| Dreischichten-Prompt | transform.js | Basis + Kontext + Mapping |
| Konfidenz-Mapping | transform.js | high→sicher, medium→prüfenswert, low→problematisch |
| Dual-Channel-Encoding | preview.js, CSS | Unterstreichungsfarbe (Typ) + Hintergrund-Tint (Konfidenz) |
| Snapshot-Undo | model.js | Max 100 Snapshots, 500ms Keystroke-Gruppierung |
| API-Key-Isolation | llm.js | Module-scoped Map, nie in DOM/Storage/window |

---

## Was haben wir gelernt? (Forschungslage)

### LLM + TEI: Bekannte Failure Modes

| Problem | Lösung in teiCrafter |
|---|---|
| Malformed XML | DOMParser-Check ✅ |
| Text-Alteration | Plaintext-Vergleich ✅ |
| Halluzinierte Attribute | Schema-Validierung + Export-Bereinigung ✅ |
| Über-Annotation | „Präzision vor Recall" im Prompt ✅ |
| Namespace-Verwechslung | ANNOTATION_TAGS Whitelist ✅ |
| Inkonsistenz über Dokument | 📋 Phase 3 |

### Prompt Engineering Best Practices

1. **Few-Shot-Beispiele** (2–3 pro Quellentyp) > verbose Regeln. **Höchster Einzelhebel.**
2. Niedrige Temperature (0.1–0.3). Aktuell 0.2 – korrekt.
3. `@confidence`-Attribute anfordern – LLMs sind bei NER-Certainty brauchbar kalibriert.
4. Output-Format strikt: „Nur XML, keine Erklärungen." Bereits implementiert.

### Review-Workflow: Was die Forschung sagt

- **3 Konfidenz-Levels** sind optimal (mehr = kognitive Überladung)
- **Dual-Channel** für Barrierefreiheit – teiCrafter macht das richtig
- **Hybrid-Review** (Inline + Batch) ist der Gold-Standard – teiCrafter hat beides in preview.js
- **Pre-Accept** bei hoher Konfidenz reduziert Review-Fatigue drastisch

### Architektur: Walking Skeleton Pattern

Die SW-Literatur (Cockburn 2004, Freeman/Pryce 2009, Hunt/Thomas 1999) ist eindeutig: **Erst den dünnsten End-to-End-Durchstich validieren, dann iterativ verbessern.** teiCrafter ist ein gut ausgeführtes Walking Skeleton – das noch nie mit echtem LLM-Transform gelaufen ist.

---

## Wohin geht es? (Strategie)

### Entscheidung: Durchstich-first

Statt Architektur polieren (DocumentModel, View-Module, Tests) zuerst beweisen, dass der Kern funktioniert.

### Fahrplan

```
Phase A – Durchstich validieren (1–2 Sessions):
  A0. Demo-Daten mit echten Quellen (CoReMA-Rezept, DEPCHA-Rentrechnung) ---- ERLEDIGT
  A1. Echten LLM-Transform testen (Demo-Rezept + API-Key)
  A2. Few-Shot-Beispiele in Prompt-Assembly einbauen
  A3. Bruchstellen dokumentieren und fixen

Phase B – Review-Workflow erlebbar machen (1–2 Sessions):
  B1. preview.js in app.js einbinden (Inline-Review + Konfidenz)
  B2. Batch-Review aktivieren (N/P/A/R/E)
  B3. Konfidenz-Visualisierung (Dual-Channel statt Regex)

Phase C – Gezielte Architektur (nur was der Durchstich erfordert):
  C1. DocumentModel – nur wenn Undo/Redo sich als nötig erweist
  C2. editor.js – nur wenn Regex-XML-Darstellung nicht reicht
  C3. Tests gezielt für Bruchstellen
```

### Erfolgskriterium

> Editorin lädt HSA-Demo-Brief → konfiguriert API-Key → klickt „Transformieren" → sieht annotiertes Ergebnis mit Konfidenz-Farben → geht 5 Annotationen per Batch-Review durch → validiert → exportiert valides TEI-XML.

### Was wir bewusst NICHT tun

| Idee | Warum nicht jetzt |
|---|---|
| DocumentModel-Umbau | Erst beweisen, dass Workflow funktioniert |
| Test-Coverage auf 80% | Tests für Code der sich noch ändern könnte |
| teiModeller (Phase 3) | Kernworkflow muss erst stehen |
| CodeMirror 6 | Overlay reicht für Prototyp |
| Normdaten/Register | Phase 3 |
| Dark Mode | Nice-to-have |
| Kollaboration | Enorme Komplexität, kein Prototyp-Scope |

---

## Synergieprojekte

| Projekt | Relevanz |
|---|---|
| Schliemann Rechnungsbücher | Bookkeeping-Ontologie, Transaktionen |
| zbz-ocr-tei | DTA-Basisformat, historische Drucke |
| DoCTA | SiCPAS/BeNASch, mittelalterliche Rezepte |
| Stefan Zweig Digital | Korrespondenzen |
| coOCR HTR | Upstream-Tool, geteilte Architektur |
| DIA-XAI | EQUALIS-Framework, Expert-in-the-Loop |

---

## Wissensbasis-Karte

```
SYNTHESIS.md (dieses Dokument – Gesamtbild)
    │
    ├── VISION.md          Was und warum
    ├── LANDSCAPE.md       Markt und Positionierung
    ├── DESIGN.md          Visuelles
    ├── ARCHITECTURE.md    Technisches Fundament
    ├── WORKFLOW.md        Annotation, Review, Validierung
    ├── teiModeller.md     Modellierung (Phase 3)
    ├── DISTILLATION.md    TEI-Guidelines-Pipeline (Phase 3)
    │
    ├── STATUS.md          Was ist gebaut? (Ist-Stand)
    ├── MODULES.md         API-Referenz (Ist-Stand)
    ├── STORIES.md         Was muss getestet werden?
    ├── DECISIONS.md       Was wurde entschieden?
    └── JOURNAL.md         Was wurde wann gemacht?

KNOWLEDGE.md (Projekt-Root)   Komplett-Synthese aller Dokumente
```

15 Knowledge-Dokumente + KNOWLEDGE.md im Root, ~7000 Zeilen, rein Standard-Markdown. Kein Build-Step, keine Obsidian-Features.

---

## Zahlen auf einen Blick

| Metrik | Wert |
|---|---|
| JS-Module | 14 (alle implementiert) |
| Davon in app.js integriert | 7 Services + Utilities |
| Davon nicht integriert | 3 View-Module + model.js |
| Unit-Tests | 60 (tokenizer: 19, model: 23, validator: 18) |
| Test-Coverage | ~21% |
| CSS | ~2645 Zeilen |
| app.js | ~1031 Zeilen |
| LLM-Provider | 6 (Gemini, OpenAI, Anthropic, DeepSeek, Qwen, Ollama) |
| Modelle im Katalog | 17 |
| Quellentypen | 5 (correspondence, print, recipe, bookkeeping, generic) |
| Demo-Datensaetze | 3 (Rezept + Rentrechnung mit echten Daten, Brief als Platzhalter) |
| User Stories | 22 (10 fertig, 11 in Arbeit, 1 offen) |
| Sessions | 16 |
| Knowledge-Dokumente | 15 + KNOWLEDGE.md im Root |
