# teiCrafter Knowledge Base

Zentrales Wissenssystem für das teiCrafter-Projekt. Jedes Dokument hat eine definierte Zuständigkeit, eine Zielgruppe und explizite Abhängigkeiten. Reines Standard-Markdown, keine Obsidian-Features.

Stand: 2026-02-18 (Session 16)

---

## Dokumente

| Dokument | Beantwortet | Kategorie | Zielgruppe |
|---|---|---|---|
| [SYNTHESIS](SYNTHESIS.md) | **Kompaktes Gesamtbild** – alles in einem Dokument | Synthese | Alle, Onboarding |
| [REFERENCE](REFERENCE.md) | **Technische Referenz** – Code, APIs, Datenflüsse, Known Issues | Ist-Stand | Entwicklung, Agents |
| [VISION](VISION.md) | Was ist das Projekt, warum existiert es? | Konzept | Alle |
| [STATUS](STATUS.md) | Was funktioniert, was ist Stub, was fehlt? | Ist-Stand | Alle |
| [MODULES](MODULES.md) | Welche Module gibt es, welche API haben sie? | Ist-Stand | Entwicklung |
| [DESIGN](DESIGN.md) | Was sieht und bedient der Nutzer? | Konzept | UI/Frontend |
| [ARCHITECTURE](ARCHITECTURE.md) | Wie ist das System gebaut? | Konzept | Entwicklung |
| [WORKFLOW](WORKFLOW.md) | Wie funktionieren Annotation, Review, Validierung? | Konzept | Entwicklung, Konzeption |
| [teiModeller](teiModeller.md) | Wie unterstützt das System Modellierungsentscheidungen? | Konzept | Phase 3 |
| [DECISIONS](DECISIONS.md) | Was ist offen, was wurde entschieden? | Prozess | Alle |
| [STORIES](STORIES.md) | Was muss implementiert und getestet werden? | Prozess | Entwicklung, Testing |
| [DISTILLATION](DISTILLATION.md) | Wie entstehen die TEI-Wissensmodule? | Konzept | Phase 3 |
| [LANDSCAPE](LANDSCAPE.md) | Tool-Landschaft, Marktanalyse, strategische Positionierung | Forschung | Alle, Strategie |
| [Research Landscape](research-landscape.md) | Wie positioniert sich teiCrafter 2025–2026? | Forschung | Alle, Publikationen |
| [JOURNAL](JOURNAL.md) | Was wurde wann gemacht? | Prozess | Entwicklung |
| [KNOWLEDGE](../KNOWLEDGE.md) | **Komplett-Synthese** aller Dokumente (Projekt-Root) | Synthese | Alle, Agents |

**Kategorien:**
- **Konzept** = Was gebaut werden soll (normativ)
- **Ist-Stand** = Was tatsächlich gebaut ist (deskriptiv)
- **Forschung** = Wissenschaftliche Positionierung
- **Prozess** = Tracking, Planung, Chronik

---

## Abhängigkeitsrichtung

```
VISION.md (Warum, Positionierung)
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

STATUS.md + MODULES.md (beschreiben den Ist-Stand aller obigen Konzepte)
STORIES.md (konsumiert DESIGN + ARCHITECTURE + WORKFLOW, trackt via STATUS)
DECISIONS.md (querschnittlich, konsumiert alle Dokumente)
JOURNAL.md (chronologisch, referenziert beliebige Dokumente)
SYNTHESIS.md (kompaktes Gesamtbild, destilliert aus allen Dokumenten)
REFERENCE.md (technische Tiefe, destilliert aus Code + Dokumenten)
LANDSCAPE.md (Tool-Landschaft, informiert VISION und DECISIONS)
research-landscape.md (eigenständig, informiert VISION)

../KNOWLEDGE.md (Projekt-Root, Komplett-Synthese aller 15 Dokumente)
```

Änderungen fließen abwärts. DESIGN.md kann Farben ändern, ohne die Architektur zu berühren. ARCHITECTURE.md kann die Editor-Engine wechseln, ohne das Farbsystem zu verändern. STATUS.md und MODULES.md werden bei jeder Session mit Code-Änderungen aktualisiert.

---

## Kernbegriffe

| Begriff | Definition | Dokument |
|---|---|---|
| Epistemische Asymmetrie | LLMs erzeugen plausible Annotationen, können deren Korrektheit aber nicht zuverlässig beurteilen. Der Mensch ist strukturell notwendig. | VISION, WORKFLOW |
| Dual-Channel-Encoding | Annotationstyp (Unterstreichungsfarbe) und Konfidenz (Hintergrund-Tint) als zwei orthogonale visuelle Kanäle | DESIGN |
| Kategoriale Konfidenz | Sicher / prüfenswert / problematisch / manuell statt numerischer Prozentwerte | DESIGN, WORKFLOW |
| Reaktives Dokumentenmodell | Ein TEI-XML-Baum als Single Source of Truth, alle Ansichten als Projektionen | ARCHITECTURE |
| Zustandsschichten | Dokument + Konfidenz + Validierung + Review-Status als vier gekoppelte Schichten | ARCHITECTURE |
| Observer-Muster | Ansichten registrieren sich als Beobachter des Modells, keine direkte Kommunikation zwischen Views | ARCHITECTURE |
| Dreischichten-Prompt | Basis (generisch) + Kontext (quellenspezifisch) + Mapping (projektspezifisch) | WORKFLOW |
| Transform | LLM-gestützte Annotation des TEI-Body mit Named Entities und Konfidenz-Zuordnung | WORKFLOW |
| Review | Menschliche Prüfung jeder LLM-Annotation (Accept / Edit / Reject) | WORKFLOW |
| Batch-Review | Tastaturgesteuerte sequentielle Prüfung aller offenen Annotationen | WORKFLOW |
| Fünf Validierungsebenen | Plaintext-Vergleich, Schema, XPath, LLM-as-a-Judge, Expert-in-the-Loop | WORKFLOW |
| Schema-Führung (ODD) | Kontextsensitive Validierung basierend auf dem ODD-Profil | ARCHITECTURE |
| Service-Integration | Verdrahtung der Service-Module mit der UI-Shell (app.js) – ✅ abgeschlossen (Session 11) | STATUS |
| Walking Skeleton / Durchstich | Dünnster möglicher End-to-End-Durchstich um die Tragfähigkeit der Architektur zu validieren | LANDSCAPE, DECISIONS |
| Few-Shot-Beispiele | 2–3 annotierte Beispiele pro Quellentyp im Prompt – höchster Einzelhebel für LLM-Qualität | WORKFLOW, LANDSCAPE |
| First Mover | Kein vergleichbares Tool kombiniert TEI-Annotation + LLM + Human Review (Stand 2026-02) | LANDSCAPE, VISION |
| teiModeller | LLM-gestützte Modellierungsberatung auf Basis destillierter TEI-Module | teiModeller |
| Destillations-Pipeline | Dreistufiger Prozess (Scraping → Destillation → Validierung) zur Erzeugung von TEI-Wissensmodulen | DISTILLATION |

---

## Beziehungen zwischen Konzepten

```
Epistemische Asymmetrie
        │
        │   begründet
        │
        ├──▶ Kategoriale Konfidenz (statt numerisch)
        │        │
        │        ├──▶ Dual-Channel-Encoding (Typ ⊥ Konfidenz)
        │        │
        │        └──▶ Konfidenz-Mapping (LLM-Output → Kategorien)
        │
        ├──▶ Review-Workflow (Mensch prüft jede Annotation)
        │        │
        │        ├──▶ Inline-Review (Accept / Edit / Reject)
        │        │
        │        └──▶ Batch-Review (Tastatur, Fortschritt)
        │
        ├──▶ Fünf Validierungsebenen (regelbasiert + LLM + Mensch)
        │
        └──▶ Prompt-Transparenz (einsehbar vor Absenden)

Dreischichten-Prompt
        │
        ├──▶ Basisschicht (generische TEI-Regeln)
        ├──▶ Kontextschicht (Quelle, Sprache, Projekt)
        └──▶ Mapping-Schicht (projektspezifische Annotationsregeln)
                 │
                 └──▶ teiModeller (erzeugt Mapping-Regeln, Phase 3)

Reaktives Dokumentenmodell
        │
        ├──▶ Zustandsschichten (Dokument + Konfidenz + Validierung + Review)
        ├──▶ Observer-Muster (keine direkte View-Kommunikation)
        ├──▶ Undo/Redo auf Modellebene (nicht UI-Ebene)
        └──▶ Schema-Führung (ODD → Validierung)
```

---

## Claude-Synchronisationsregeln

Am Ende jeder Session mit Code-Änderungen:

1. **STATUS.md** — **Immer zuerst.** Modul-Matrix, Test-Zählung und Workflow-Status aktualisieren. STATUS.md ist die Single Source of Truth für den Ist-Stand.
2. **DECISIONS.md** — Bei neuen Entscheidungen oder erledigten offenen Punkten
3. **STORIES.md** — Bei Statusänderungen (⬜ → 🔧 → ✅). Zahlen müssen mit STATUS.md konsistent sein.
4. **JOURNAL.md** — Session-Eintrag mit Datum und Zusammenfassung
5. **MODULES.md** — Nur bei API-Änderungen (neue Exports, geänderte Signaturen, neue Known Issues)
