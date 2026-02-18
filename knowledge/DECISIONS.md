# Offene Entscheidungen und Implementierungsplan

Konsolidierte Übersicht aller offenen und entschiedenen Punkte im teiCrafter-Projekt. Jede Entscheidung verweist auf das Dokument, das den fachlichen Kontext liefert.

Stand: 2026-02-18 (Session 13)

---

## Entschieden

| Entscheidung | Ergebnis | Begründung | Datum |
|---|---|---|---|
| Rechtes Panel: Tab-Struktur | Vorschau + Review integriert, Validierung, Attribute | Review ist keine eigenständige Tätigkeit, sondern eine Schicht über der Vorschau | 2026-02-05 |
| Editor-Optionen | Overlay (Prototyp), CodeMirror 6 (Produkt). Kein Monaco, kein ContentEditable | Monaco zu groß (~2MB), ContentEditable zu fragil. Overlay genügt für Prototyp, CM6 für Produkt | 2026-02-05 |
| Prompt-Architektur | Dreischichten-Modell (Basis, Kontext, Mapping) | Trennung ermöglicht stabile Basisregeln bei flexibler Projekt-Konfiguration | 2026-02-05 |
| Validierungsebenen | Fünf Ebenen (Plaintext, Schema, XPath, LLM-as-a-Judge, Expert-in-the-Loop) | Gestufte Qualitätsprüfung statt binär valide/invalide | 2026-02-05 |
| Konfidenz-Kategorien | Vier Kategorien (sicher, prüfenswert, problematisch, manuell) | Manuell notwendig für menschlich erzeugte Annotationen ohne LLM-Konfidenz | 2026-02-05 |
| Dokumentname TRANSFORM.md | Umbenannt zu WORKFLOW.md | "Transform" ist zu unspezifisch | 2026-02-05 |
| Overlay-Spike (500-Zeilen) | Spike bestanden, kein Scroll-Drift | Implementiert in Stufe 1, bestätigt in Session 8 (JOURNAL.md) | 2026-02-18 |
| Visuelle Testmatrix | 24 Kombinationen getestet, 2 Problemfälle identifiziert | `date`+prüfenswert und `placeName`+sicher erfordern Aufmerksamkeit. Lösung: Unterstreichungsstil als Zusatzkanal | 2026-02-18 |
| Service-Integration-Strategie | Direkte Verdrahtung in app.js, AppState beibehalten | Inkrementeller Ansatz: Services zuerst, DocumentModel-Umbau als separater Schritt (Stufe 14). Inline-Dummys gelöscht. | 2026-02-18 |
| LLM-Provider-Auswahl | 6 Provider: Gemini, OpenAI, Anthropic, DeepSeek, Qwen, Ollama | Breite Abdeckung: 3 US-Cloud + 2 CN-Cloud + 1 Lokal. DeepSeek/Qwen nutzen OpenAI-kompatibles Format. MODEL_CATALOG mit Preisen/Reasoning-Flag. | 2026-02-18 |
| Event-Management in app.js | Event-Delegation statt individuelle Listener | Ein Click-Listener auf `.app-main` mit `data-action`-Attributen. Eliminiert Listener-Leaks bei Step-Wechseln. Drag-and-Drop via `stepCleanup`-Pattern. Tab-Clicks ebenfalls delegiert. | 2026-02-18 |
| ANNOTATION_TAGS-Zentralisierung | Zentrale Liste in constants.js | Tag-Liste war 5× dupliziert (transform, validator, export, preview, editor). Jetzt 1 Quelle, 3 Konsumenten (validator/editor haben keine hardcodierte Liste). | 2026-02-18 |

---

## Offen: Priorität Hoch (blockiert durchgängigen Workflow)

### DocumentModel vs. AppState

**Kontext:** [ARCHITECTURE.md](ARCHITECTURE.md) §2, [MODULES.md](MODULES.md)

**Problem:** app.js nutzt ein einfaches `AppState`-Objekt statt des reaktiven `DocumentModel` (model.js). Das bedeutet: kein Undo/Redo, kein Observer-Pattern, keine Event-basierte View-Synchronisation.

**Optionen:**
- AppState durch DocumentModel ersetzen (sauber, aber großer Umbau)
- DocumentModel als Ergänzung zu AppState für XML-spezifischen State (inkrementell)

**Kriterium:** Welcher Ansatz ermöglicht schnellsten Weg zum durchgängigen Workflow?

---

## Offen: Priorität Mittel (beeinflussen die UX wesentlich)

### Diff-Darstellung

**Kontext:** [WORKFLOW.md](WORKFLOW.md) §5

**Frage:** Welches Format für die Diff-Ansicht nach dem Transform?

**Optionen:**
- Annotierter Text (aktuell spezifiziert) – zeigt die inhaltliche Veränderung
- XML-Diff – zeigt die Markup-Veränderung
- Side-by-Side – zeigt Vorher/Nachher nebeneinander

**Kriterium:** Prototyping mit realen Dokumenten

---

### Source-Panel: Permanent vs. einklappbar

**Kontext:** [DESIGN.md](DESIGN.md) §4

**Frage:** Soll das Source-Panel permanent 25% belegen oder als einklappbare Sidebar funktionieren?

**Kriterium:** Nutzerfeedback im Prototyp

---

### Cursor-Kopplung: Bidirektional vs. unidirektional

**Kontext:** [ARCHITECTURE.md](ARCHITECTURE.md) §10

**Frage:** Soll die Cursor-Kopplung zwischen Editor und Vorschau in beide Richtungen funktionieren?

**Ist-Stand:** Keine Kopplung implementiert (kein Cross-Panel-Sync)

**Kriterium:** Nutzerfeedback

---

## Offen: Priorität Niedrig (nach dem Prototyp)

### ODD-Parsing: Generisch

**Kontext:** [ARCHITECTURE.md](ARCHITECTURE.md) §6

**Status:** Stufe 1 (hardcodiertes JSON-Profil) implementiert. Stufe 2 (generisches ODD-Parsing) ist Phase 3.

---

### Register-Integration

**Kontext:** [ARCHITECTURE.md](ARCHITECTURE.md)

**Frage:** Wie werden Personenregister, Ortsregister etc. integriert?

---

### Undo-Strategie für große Dokumente

**Kontext:** [ARCHITECTURE.md](ARCHITECTURE.md) §3

**Frage:** Reicht Snapshot-basiertes Undo für >1000 Zeilen?

**Ausweichoption:** Diff-basiertes Undo

---

### Multi-Pass-Transform

**Kontext:** [WORKFLOW.md](WORKFLOW.md)

**Frage:** Alle Annotationstypen in einem LLM-Durchlauf oder separate Durchläufe?

---

### Verschachtelte Annotationen

**Kontext:** [WORKFLOW.md](WORKFLOW.md)

**Frage:** Wie reagiert Accept/Reject bei `<persName>` innerhalb `<bibl>`?

---

### Few-Shot-Beispiele

**Kontext:** [WORKFLOW.md](WORKFLOW.md) §3

**Frage:** Automatische Extraktion aus bestehenden Annotationen oder manuelle Konfiguration?

---

### teiModeller: Wissensmodul-Granularität

**Kontext:** [teiModeller.md](teiModeller.md), [DISTILLATION.md](DISTILLATION.md) §1

**Status:** Pilotdurchlauf mit `namesdates`-Modul geplant. Endgültige Granularität steht nach dem Pilot aus.

---

### Normdaten-Integration

**Kontext:** [VISION.md](VISION.md)

**Frage:** LLM-Vorschläge für GND/VIAF/Geonames bereits im Transform oder nachgelagerte Reconciliation?

---

## Abgeschlossene Implementierungsreihenfolge (Phase 2)

```
 1. ✅ Visuelle Testmatrix (Farbkombinationen)
 2. ✅ Editor-Spike (Overlay, 500 Zeilen)
 3. ✅ XML-Tokenizer (reine Funktion, 17 Tests)
 4. ✅ Reaktives Dokumentenmodell + Undo (21 Tests)
 5. ✅ Editor (Overlay mit Gutter)
 6. ✅ Source-Panel + Vorschau (Inline + Batch Review)
 7. ✅ LLM-Service (4 Provider)
 8. ✅ Transform + Prompt-Assembly
 9. ✅ Validierung (3 von 5 Levels, 13 Tests)
10. ✅ Export (Attribut-Bereinigung, Download, Clipboard)
```

**Nächste Reihenfolge (Service-Integration):**

```
11. ✅ app.js → transform.js + llm.js verdrahten (Schritt 3) + Settings-Dialog
12. ✅ app.js → validator.js + schema.js verdrahten (Schritt 4)
13. ✅ app.js → export.js verdrahten (Schritt 5) + Export-Optionen
14. ⬜ DocumentModel als zentrale State-Quelle einführen
15. ⬜ View-Module (editor.js, preview.js, source.js) einbinden
16. ⬜ Test-Coverage erweitern (Service-Tests, View-Tests)
```

---

**Referenzierte Dokumente:**
- [STATUS.md](STATUS.md) — Implementierungs-Ist-Stand
- [MODULES.md](MODULES.md) — Technische Modul-Referenz
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [WORKFLOW.md](WORKFLOW.md)
- [DESIGN.md](DESIGN.md)
- [teiModeller.md](teiModeller.md)
- [VISION.md](VISION.md)
- [DISTILLATION.md](DISTILLATION.md)
- [STORIES.md](STORIES.md)
