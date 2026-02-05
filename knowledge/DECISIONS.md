---
type: knowledge
created: 2026-02-05
updated: 2026-02-05
tags: [teicrafter, decisions, implementation, planning]
status: active
---

# Offene Entscheidungen und Implementierungsplan

Konsolidierte Übersicht aller offenen Entscheidungen im teiCrafter-Projekt. Jede Entscheidung verweist auf das Dokument, das den fachlichen Kontext liefert. Entschiedene Punkte werden mit Datum und Begründung dokumentiert.

---

## Entschieden

| Entscheidung | Ergebnis | Begründung | Datum |
|---|---|---|---|
| Rechtes Panel: Tab-Struktur | Vorschau + Review integriert, Validierung, Attribute | Review ist keine eigenständige Tätigkeit, sondern eine Schicht über der Vorschau. Attribut-Tab ist funktional notwendig für Edit-Aktion. | 2026-02-05 |
| Editor-Optionen | Overlay (Prototyp), CodeMirror 6 (Produkt). Kein Monaco, kein ContentEditable. | Monaco zu groß (~2MB), ContentEditable zu fragil. Overlay genügt für Prototyp, CM6 für Produkt. | 2026-02-05 |
| Prompt-Architektur | Dreischichten-Modell (Basis, Kontext, Mapping) als führend | Trennung ermöglicht stabile Basisregeln bei flexibler Projekt-Konfiguration | 2026-02-05 |
| Validierungsebenen | Fünf Ebenen (Plaintext, Schema, XPath, LLM-as-a-Judge, Expert-in-the-Loop) | Gestufte Qualitätsprüfung statt binär valide/invalide | 2026-02-05 |
| Konfidenz-Kategorien | Vier Kategorien (sicher, prüfenswert, problematisch, manuell) | Manuell notwendig für menschlich erzeugte Annotationen ohne LLM-Konfidenz | 2026-02-05 |
| Dokumentname TRANSFORM.md | Umbenannt zu WORKFLOW.md | "Transform" ist zu unspezifisch. WORKFLOW.md deckt den gesamten Arbeitsprozess ab. | 2026-02-05 |

---

## Offen: Priorität Hoch (blockieren den Prototyp)

### Editor-Engine: Overlay-Spike

**Kontext:** [ARCHITECTURE.md](ARCHITECTURE.md) §4

**Frage:** Funktioniert die Overlay-Technik bei TEI-Dokumenten mit 500 Zeilen ohne Scroll-Drift und Cursor-Mapping-Probleme?

**Optionen:**
- Spike bestätigt Overlay → Prototyp mit Overlay
- Spike zeigt Probleme → Wechsel zu CodeMirror 6 auch für den Prototyp

**Kriterium:** Implementierungs-Spike mit einem realen TEI-Dokument

**Nächster Schritt:** Spike durchführen

---

### Farbkombinationen: Visuelle Testmatrix

**Kontext:** [WORKFLOW.md](WORKFLOW.md) §9, [DESIGN.md](DESIGN.md) §2.5

**Frage:** Sind alle 24 Annotationstyp-Konfidenz-Kombinationen visuell unterscheidbar?

**Bekannte Problemfälle:**
- `<date>` (Bernstein) auf "prüfenswert" (Bernstein-Tint)
- `<placeName>` (Teal) auf "sicher" (Teal-Tint)

**Ausweichoption:** Konfidenz über Unterstreichungsstil (solid/dashed/dotted) statt Hintergrund-Tint

**Kriterium:** HTML-Testmatrix mit allen Kombinationen, empirische Prüfung

**Nächster Schritt:** Testmatrix-HTML erzeugen und visuell bewerten

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

**Argument für permanent:** Der Digitalisat-Tab (Vergleich mit dem Original) rechtfertigt permanente Sichtbarkeit stärker als der Plaintext-Tab.

**Argument für einklappbar:** Mehr Platz für Editor und Vorschau, besonders bei kleineren Bildschirmen.

**Kriterium:** Nutzerfeedback im Prototyp

---

### Cursor-Kopplung: Bidirektional vs. unidirektional

**Kontext:** [ARCHITECTURE.md](ARCHITECTURE.md) §10

**Frage:** Soll die Cursor-Kopplung zwischen Editor und Vorschau in beide Richtungen funktionieren oder nur Vorschau → Editor?

**Kriterium:** Nutzerfeedback

---

## Offen: Priorität Niedrig (nach dem Prototyp)

### ODD-Parsing: Generisch

**Kontext:** [ARCHITECTURE.md](ARCHITECTURE.md) §6

**Frage:** Wann wird das clientseitige ODD-Parsing (Stufe 2) implementiert?

**Status:** Stufe 1 (hardcodiertes JSON-Profil) reicht für den Prototyp. Stufe 2 ist ein Phase-3-Feature.

---

### Register-Integration

**Kontext:** [ARCHITECTURE.md](ARCHITECTURE.md)

**Frage:** Wie werden Personenregister, Ortsregister etc. in den Attribut-Tab integriert?

**Optionen:** Tab im rechten Panel, Dropdown im Attribut-Tab, Modal

**Kriterium:** Nutzerfeedback

---

### Undo-Strategie

**Kontext:** [ARCHITECTURE.md](ARCHITECTURE.md) §3

**Frage:** Reicht die Snapshot-basierte Undo-Strategie für große Dokumente (>1000 Zeilen)?

**Ausweichoption:** Diff-basiertes Undo-System

**Kriterium:** Dokumentgröße im Praxistest

---

### Multi-Pass-Transform

**Kontext:** [WORKFLOW.md](WORKFLOW.md)

**Frage:** Soll das LLM alle Annotationstypen in einem Durchlauf annotieren oder separate Durchläufe pro Typ machen?

**Trade-off:** Ein Durchlauf ist billiger und schneller, separate Durchläufe können präziser sein.

**Kriterium:** Qualitätsvergleich mit realen Dokumenten

---

### Verschachtelte Annotationen

**Kontext:** [WORKFLOW.md](WORKFLOW.md)

**Frage:** Wie reagiert Accept/Reject, wenn ein `<persName>` innerhalb eines `<bibl>` liegt?

**Kriterium:** Edge-Case-Analyse im Prototyp

---

### Few-Shot-Beispiele

**Kontext:** [WORKFLOW.md](WORKFLOW.md) §3

**Frage:** Sollen Few-Shot-Beispiele automatisch aus bestehenden Annotationen extrahiert oder manuell konfiguriert werden?

**Kriterium:** Qualitätstest mit verschiedenen Dokumenttypen

---

### teiModeller: Wissensmodul-Granularität

**Kontext:** [teiModeller.md](teiModeller.md) §5, [DISTILLATION.md](DISTILLATION.md) §1

**Frage:** Wie fein sollen die destillierten TEI-Wissensmodule aufgeteilt werden?

**Optionen:** Pro TEI-Modul, pro Elementgruppe, pro Anwendungsfall

**Teilweise beantwortet:** [DISTILLATION.md](DISTILLATION.md) spezifiziert ein Modul pro TEI-Modul mit Trennung in Referenzwissen und Modellierungswissen. Pilotdurchlauf mit `namesdates` geplant. Endgültige Bestätigung der Granularität steht nach dem Pilotdurchlauf aus.

**Kriterium:** Pilotdurchlauf mit `namesdates`-Modul (siehe [DISTILLATION.md](DISTILLATION.md) §4)

---

### Normdaten-Integration

**Kontext:** [teiCrafter.md](teiCrafter.md)

**Frage:** Sollen Normdaten-Zuordnungen (GND, VIAF, Geonames) bereits im Transform vorgeschlagen werden oder nachgelagert über eine Reconciliation-Schnittstelle?

**Kriterium:** Machbarkeit und Qualität der LLM-basierten Zuordnung

---

## Implementierungsreihenfolge (Prototyp)

Abgeleitet aus den Abhängigkeiten und Prioritäten.

```
1. Visuelle Testmatrix (Farbkombinationen)
   │
2. Editor-Spike (Overlay, 500 Zeilen)
   │
3. XML-Tokenizer (reine Funktion, testbar)
   │
4. Reaktives Dokumentenmodell + Undo
   │
5. Editor (Overlay oder CM6, je nach Spike)
   │
6. Source-Panel + Vorschau
   │
7. LLM-Service (ein Provider)
   │
8. Transform + Diff-Ansicht
   │
9. Review-Workflow (Inline + Batch)
   │
10. Schema-Validierung (Stufe 1, hardcodiert)
    │
11. Export
```

---

**Referenzierte Dokumente:**
- [DESIGN.md](DESIGN.md)
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [WORKFLOW.md](WORKFLOW.md)
- [teiModeller.md](teiModeller.md)
- [teiCrafter.md](teiCrafter.md)
- [DISTILLATION.md](DISTILLATION.md)
- [STORIES.md](STORIES.md)
