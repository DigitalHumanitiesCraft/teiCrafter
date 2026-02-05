---
type: moc
created: 2026-02-05
updated: 2026-02-05
tags: [teicrafter, navigation, moc]
status: active
---

# teiCrafter Knowledge Base

Zentrales Wissenssystem für das teiCrafter-Projekt. Jedes Dokument hat eine definierte Zuständigkeit, eine Zielgruppe und explizite Abhängigkeiten.

## Dokumente

| Dokument | Beantwortet | Zielgruppe | Abhängigkeiten |
|---|---|---|---|
| [teiCrafter](teiCrafter.md) | Was ist das Projekt, warum existiert es, wo steht es? | Alle | Keine |
| [DESIGN](DESIGN.md) | Was sieht und bedient der Nutzer? | UI/Frontend, Design | Keine |
| [ARCHITECTURE](ARCHITECTURE.md) | Wie ist das System gebaut? | Entwicklung | DESIGN |
| [WORKFLOW](WORKFLOW.md) | Wie funktionieren Annotation, Review und Validierung? | Entwicklung, Konzeption | DESIGN, ARCHITECTURE |
| [teiModeller](teiModeller.md) | Wie unterstützt das System Modellierungsentscheidungen? | Konzeption, Entwicklung (Phase 3) | WORKFLOW |
| [DECISIONS](DECISIONS.md) | Was ist offen, was wurde entschieden? | Alle | Alle |
| [STORIES](STORIES.md) | Was muss implementiert und getestet werden? | Entwicklung, Testing | DESIGN, ARCHITECTURE, WORKFLOW |
| [DISTILLATION](DISTILLATION.md) | Wie entstehen die TEI-Wissensmodule? | Entwicklung (Phase 3) | teiModeller |
| [Research Landscape](research-landscape.md) | Wie positioniert sich teiCrafter in der Forschung 2025–2026? | Alle, Publikationen | teiCrafter |

## Abhängigkeitsrichtung

```
teiCrafter.md (Vision, Positionierung)
    │
DESIGN.md (visuelle Vorgaben)
    │
    ├──▶ ARCHITECTURE.md (technisches Fundament)
    │        │
    │        └──▶ WORKFLOW.md (Annotation, Review, Validierung)
    │                 │
    │                 └──▶ teiModeller.md (Modellierungsberatung, Phase 3)
    │                          │
    │                          └──▶ DISTILLATION.md (TEI-Guidelines-Pipeline)
    │
    └────────────────────┘
          nutzt Farben, Komponenten, Tastatur aus DESIGN.md

STORIES.md (User Stories, konsumiert DESIGN + ARCHITECTURE + WORKFLOW)
DECISIONS.md (querschnittlich, konsumiert alle Dokumente)
```

Änderungen fließen abwärts. DESIGN.md kann Farben ändern, ohne die Architektur zu berühren. ARCHITECTURE.md kann die Editor-Engine wechseln, ohne das Farbsystem zu verändern. WORKFLOW.md konsumiert beides, verändert aber weder Design noch Architektur.

## Kernbegriffe

| Begriff | Definition | Dokument |
|---|---|---|
| Epistemische Asymmetrie | LLMs erzeugen plausible Annotationen, können deren Korrektheit aber nicht zuverlässig beurteilen. Der Mensch ist strukturell notwendig. | teiCrafter, WORKFLOW |
| Dual-Channel-Encoding | Annotationstyp (Unterstreichungsfarbe) und Konfidenz (Hintergrund-Tint) als zwei orthogonale visuelle Kanäle | DESIGN |
| Kategoriale Konfidenz | Sicher / prüfenswert / problematisch / manuell statt numerischer Prozentwerte | DESIGN, WORKFLOW |
| Reaktives Dokumentenmodell | Ein TEI-XML-Baum als Single Source of Truth, alle Ansichten als Projektionen | ARCHITECTURE |
| Zustandsschichten | Dokument + Konfidenz + Validierung + Review-Status als vier gekoppelte Schichten pro Version | ARCHITECTURE |
| Observer-Muster | Ansichten registrieren sich als Beobachter des Modells, keine direkte Kommunikation zwischen Views | ARCHITECTURE |
| Dreischichten-Prompt | Basis (generisch) + Kontext (quellenspezifisch) + Mapping (projektspezifisch) | WORKFLOW |
| Transform | LLM-gestützte Annotation des TEI-Body mit Named Entities und Konfidenz-Zuordnung | WORKFLOW |
| Review | Menschliche Prüfung jeder LLM-Annotation (Accept / Edit / Reject) | WORKFLOW |
| Batch-Review | Tastaturgesteuerte sequentielle Prüfung aller offenen Annotationen | WORKFLOW |
| Diff-Ansicht | Vergleich zwischen Vor- und Nach-Transform, bevor das Ergebnis übernommen wird | WORKFLOW |
| Fünf Validierungsebenen | Plaintext-Vergleich, Schema, XPath, LLM-as-a-Judge, Expert-in-the-Loop | WORKFLOW |
| Schema-Führung (ODD) | Kontextsensitive Autovervollständigung und Validierung basierend auf dem ODD-Profil | ARCHITECTURE |
| Zwei-Stufen-ODD | Stufe 1 = hardcodiertes JSON-Profil, Stufe 2 = generisches clientseitiges ODD-Parsing | ARCHITECTURE |
| teiModeller | LLM-gestützte Modellierungsberatung auf Basis destillierter TEI-Module | teiModeller |
| Destillations-Pipeline | Dreistufiger Prozess (Scraping → Destillation → Validierung) zur Erzeugung von TEI-Wissensmodulen | DISTILLATION |
| User Story | Testbare Anforderung im Gegeben-Wenn-Dann-Format mit manuellem Prüfschritt | STORIES |
| Workflow-Stepper | Import → Mapping → Transform → Validate → Export (5 Schritte) | DESIGN |
| Positive Polarität | Heller Hintergrund, dunkle Schrift (Designentscheidung für lange Arbeitssitzungen) | DESIGN |

## UI-Komponenten

| Komponente | Beschreibung | Spezifiziert in |
|---|---|---|
| Header + Stepper | TEI-Navy, 5-Schritte-Workflow, LLM-Badge | DESIGN |
| Source-Panel | Plaintext + Digitalisat (links, 25%) | DESIGN |
| XML-Editor | Gutter, Syntax-Highlighting, Konfidenz-Marker, Schema-Führung (Mitte, 45%) | DESIGN (visuell), ARCHITECTURE (technisch) |
| Vorschau + Review | Gerenderter TEI-Body, Inline-Review-Aktionen, Entity-Legende (rechts, 30%) | DESIGN (visuell), WORKFLOW (Workflow) |
| Validierungs-Tab | Klickbare Fehlerliste, Live-Aktualisierung | DESIGN |
| Attribut-Tab | Formularfelder pro Element, Schema-gesteuerte Dropdowns | DESIGN (visuell), ARCHITECTURE (Schema) |
| Diff-Ansicht | Zusammenfassungsbalken, annotierter Text, Übernahme-Aktionen | WORKFLOW |
| Review-Fortschrittsbalken | "7 / 12 geprüft", Filter nach Typ und Konfidenz | WORKFLOW |
| Toast-Benachrichtigungen | Statusfarbe links, Slide-in, 4s/8s | DESIGN |
| Dialoge | 520px, Navy-Backdrop, Transform-Konfiguration | DESIGN (visuell), WORKFLOW (Inhalt) |

## Beziehungen zwischen Konzepten

```
Epistemische Asymmetrie
        │
        │   begründet
        │
        ├──▶ Kategoriale Konfidenz (statt numerisch)
        │        │
        │        ├──▶ Dual-Channel-Encoding (Typ ⊥ Konfidenz)
        │        │        │
        │        │        └──▶ Visuelle Testmatrix (empirische Prüfung)
        │        │
        │        └──▶ Konfidenz-Mapping (LLM-Output → Kategorien)
        │
        ├──▶ Review-Workflow (Mensch prüft jede Annotation)
        │        │
        │        ├──▶ Inline-Review (Accept / Edit / Reject)
        │        │
        │        ├──▶ Batch-Review (Tastatur, Fortschritt, Filter)
        │        │
        │        └──▶ Diff-Ansicht (Zusammenfassung vor Detail)
        │
        ├──▶ Fünf Validierungsebenen (regelbasiert + LLM + Mensch)
        │
        └──▶ Prompt-Transparenz (einsehbar vor Absenden)

Dreischichten-Prompt
        │
        ├──▶ Basisschicht (generische TEI-Regeln)
        │
        ├──▶ Kontextschicht (Quelle, Sprache, Projekt)
        │
        └──▶ Mapping-Schicht (projektspezifische Annotationsregeln)
                 │
                 └──▶ teiModeller (erzeugt Mapping-Regeln, Phase 3)

Reaktives Dokumentenmodell
        │
        ├──▶ Zustandsschichten (Dokument + Konfidenz + Validierung + Review)
        │
        ├──▶ Observer-Muster (keine direkte View-Kommunikation)
        │
        ├──▶ Undo/Redo auf Modellebene (nicht UI-Ebene)
        │
        └──▶ Schema-Führung (ODD → Autovervollständigung + Validierung)
                 │
                 └──▶ Zwei-Stufen-ODD (hardcodiert → generisch)
```

## Herkunft

Diese Knowledge Base ist durch Promptotyping entstanden. Das ursprüngliche Design System v3.3 (ein einzelnes Dokument) wurde in spezialisierte Dokumente mit getrennten Zuständigkeiten aufgeteilt, um Inkonsistenzen zu konsolidieren und fehlende Spezifikationen (Prompt-Architektur, Validierungsebenen, teiModeller, Mapping-Konzept) zu ergänzen.
