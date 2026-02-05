---
type: knowledge
created: 2026-02-05
updated: 2026-02-05
tags: [teicrafter, teimodeller, modelling, tei-guidelines, phase-3]
status: planned
---

# teiModeller

Der teiModeller unterstützt den Prozess der Modellierungsentscheidung. Er beantwortet die Frage "Wie soll dieses Textphänomen in TEI abgebildet werden?" und erzeugt als Ergebnis Mapping-Regeln, die in die Mapping-Schicht der [Dreischichten-Prompt-Architektur](WORKFLOW.md) übernommen werden können.

Der teiModeller ist für Phase 3 (Konsolidierung) vorgesehen. Dieses Dokument spezifiziert das Konzept und die Wissensarchitektur, nicht die Implementierung.

**Abhängigkeit:** [WORKFLOW.md](WORKFLOW.md) für die Mapping-Schicht, in die der teiModeller seine Ergebnisse liefert.

---

## 1. Problem

TEI-Annotation setzt Modellierungsentscheidungen voraus, die oft schwieriger sind als die Annotation selbst. Welches Element bildet ein bestimmtes Textphänomen ab? Welche Attribute sind sinnvoll? Wie verhält sich die Modellierung zu projektspezifischen Anforderungen und zum gewählten ODD?

Bestehende TEI-Editoren (oXygen, ediarum) setzen voraus, dass diese Entscheidungen bereits getroffen wurden. Die TEI-Guidelines sind umfangreich (~1800 Seiten), modular organisiert und für Einsteiger schwer navigierbar. Der teiModeller schließt diese Lücke, indem er die Guidelines LLM-zugänglich macht und kontextsensitive Modellierungsberatung bietet.

---

## 2. Wissensgrundlage

### 2.1 Prinzip: Destillierte Module statt RAG

Kein RAG-System. Stattdessen eine Sammlung destillierter TEI-Wissensmodule. Diese Module sind komprimierte, LLM-optimierte Darstellungen der TEI Guidelines, organisiert nach TEI-Modulen. Der Vorteil gegenüber RAG liegt in der kontrollierten Informationsdichte: jedes Modul enthält genau die Informationen, die ein LLM braucht, um fundierte Modellierungsvorschläge zu machen, ohne irrelevante Details.

Die Erzeugung der Module erfolgt über eine dreistufige Pipeline (Scraping → Destillation → Validierung), spezifiziert in [DISTILLATION.md](DISTILLATION.md).

### 2.2 Modulstruktur

Jedes Modul enthält:
- Die verfügbaren Elemente mit ihren Attributen und Verwendungskontexten
- Typische Modellierungsmuster (z.B. wie Personen in Korrespondenzen vs. in Bibliografien annotiert werden)
- Häufige Fehler und Missverständnisse
- Zusammenhänge mit anderen Modulen

### 2.3 Zuschaltung nach Bedarf

Module werden gezielt aktiviert, nicht pauschal geladen. Beispiele:
- Für Korrespondenzen: `namesdates`, `header`, `core`, `correspDesc`
- Für Kochrezepte: `measurement` und domänenspezifische Module
- Für Bibliografien: `header`, `core`, `bibl`

Die Zuschaltung kann manuell durch die Nutzerin oder automatisch basierend auf dem erkannten Quellentyp und dem gewählten ODD-Profil erfolgen.

---

## 3. Interaktionsmuster

Der teiModeller wird über das Mapping-Panel oder kontextsensitiv aus dem Editor heraus aufgerufen.

**Schritt 1.** Die Benutzerin beschreibt ein Textphänomen oder markiert eine Textstelle im Editor. Beispiel: "Wie annotiere ich Währungsangaben in einem Rechnungsbuch?"

**Schritt 2.** Der teiModeller schlägt passende TEI-Strukturen vor, basierend auf den aktiven Wissensmodulen und dem Projektkontext. Der Vorschlag enthält das empfohlene Element, die relevanten Attribute und ein Beispiel.

**Schritt 3.** Die Benutzerin wählt, modifiziert oder verwirft den Vorschlag.

**Schritt 4.** Akzeptierte Vorschläge werden als Mapping-Regel in die Mapping-Schicht übernommen. Damit stehen sie für alle zukünftigen Transforms zur Verfügung.

---

## 4. Abgrenzung zum Transform

| Aspekt | teiModeller | Transform |
|---|---|---|
| Frage | "Wie soll annotiert werden?" | "Annotiere diesen Text" |
| Input | Textphänomen oder Nutzerfrage | Gesamter TEI-Body |
| Output | Mapping-Regel(n) | Annotiertes TEI-XML |
| Zeitpunkt | Vor dem Transform (Mapping-Schritt) | Transform-Schritt |
| LLM-Wissen | Destillierte TEI-Module | Basisschicht + Kontext + Mapping |

---

## 5. Offene Fragen

- Granularität der TEI-Wissensmodule: Wie fein sollen sie aufgeteilt werden? Pro TEI-Modul, pro Elementgruppe, oder pro Anwendungsfall? Teilweise beantwortet in [DISTILLATION.md](DISTILLATION.md) §1: ein Modul pro TEI-Modul mit Trennung in Referenz- und Modellierungswissen.
- Qualitätssicherung der Module: Wie werden die destillierten Module auf Korrektheit geprüft? Beantwortet in [DISTILLATION.md](DISTILLATION.md) §3 (Stufe 3: Validierung).
- Interaktionsformat: Chatbasiert (Frage-Antwort) oder formularbasiert (strukturierte Eingabe)?
- Integration in den Workflow-Stepper: Eigener Schritt oder Teil des Mapping-Schritts?

---

**Abhängigkeiten:**
- [WORKFLOW.md](WORKFLOW.md) für die Mapping-Schicht
- [ARCHITECTURE.md](ARCHITECTURE.md) für die LLM-Integration
- [DISTILLATION.md](DISTILLATION.md) für die Erzeugung der TEI-Wissensmodule
