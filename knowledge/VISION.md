# teiCrafter – Vision und Positionierung

## Summary

teiCrafter ist eine browserbasierte, LLM-gestützte TEI-Arbeitsumgebung für digitale Editionen. Das Werkzeug verbindet drei Funktionskerne in einer integrierten Oberfläche. Erstens die modulare Transformation von Plaintext zu semantisch annotiertem TEI-XML. Zweitens einen [teiModeller](teiModeller.md), der den Modellierungsprozess selbst LLM-gestützt begleitet. Drittens ein Validierungs- und Review-System, das regelbasierte Prüfungen mit LLM-as-a-Judge kombiniert.

Die erkenntnistheoretische Grundlage bildet das Konzept der **epistemischen Asymmetrie**, übernommen von coOCR HTR. LLMs erzeugen plausible Annotationen, können aber nicht zuverlässig einschätzen, ob diese korrekt sind. Bei TEI-Annotation ist das Problem verschärft, weil Annotationsentscheidungen oft interpretativ sind, Schema-Konformität nicht inhaltliche Korrektheit garantiert und Normdaten-Zuordnungen Kontextwissen erfordern. teiCrafter positioniert menschliche Expertise deshalb nicht als optionale Qualitätskontrolle, sondern integriert sie als strukturell notwendigen Bestandteil.

---

## Strategische Positionierung

### Pipeline-Integration

```
Bild → coOCR HTR → teiCrafter → ediarum/GAMS/Publikation
       (Transkription)  (Annotation &    (Tiefenerschließung &
                         Modellierung)    Publikation)
```

teiCrafter adressiert die Lücke zwischen automatisierter Texterkennung und manueller Tiefenerschließung. Das Werkzeug erzeugt valides, schema-konformes TEI-XML, das als qualifizierter Ausgangspunkt für weitere editorische Arbeit in Umgebungen wie ediarum dient.

### Abgrenzung zu coOCR HTR

| Aspekt | coOCR HTR | teiCrafter |
|---|---|---|
| Input | Bild (IIIF, Upload) | Text (Plaintext, PAGE-XML, einfaches TEI) |
| Output | Strukturierter Text, PAGE-XML, Basis-TEI | Semantisch annotiertes TEI-XML |
| Fokus | Zeichenerkennung, Layouterhalt | Semantische Annotation, Modellierung, Validierung |
| Validierung | Transkriptionsqualität | Schema-Konformität, Annotationskonsistenz, LLM-Review |
| LLM-Rolle | Transkriptionsunterstützung | Annotation, Modellierungsberatung, Qualitätsprüfung |

### Abgrenzung zu bestehenden TEI-Editoren

teiCrafter ist kein Ersatz für oXygen oder ediarum, sondern eine vorgelagerte Arbeitsumgebung. oXygen und ediarum setzen voraus, dass Modellierungsentscheidungen bereits getroffen wurden. teiCrafter unterstützt genau diesen Entscheidungsprozess und liefert als Ergebnis annotiertes TEI-XML, das in bestehende Editionsumgebungen importiert werden kann.

---

## Erfolgskriterien

| Kriterium | Bedeutung | Operationalisierung |
|---|---|---|
| Selbsterklärend | Ohne externe Anleitung nutzbar | Workflow-Stepper, kontextuelle Hinweise, Progressive Disclosure |
| Vollständiger Workflow | Import → Annotation → Validierung → Export | Plaintext/PAGE-XML rein, valides TEI-XML raus |
| Anschlussfähigkeit | Output in nachgelagerten Prozessen nutzbar | Export kompatibel mit ediarum, oXygen, GAMS |

---

## Entwicklungsphasen

### Phase 1: UI-Design ✅

Entwicklung des User Interface und des visuellen Designs. Klickbarer Prototyp, der Interaktionsmuster und Layout validiert. Spezifiziert in [DESIGN.md](DESIGN.md).

### Phase 2: Prototyp ⚠️ (UI-Shell komplett, Service-Integration offen)

Funktionsfähiger Durchstich des vollständigen Workflows.

- ✅ LLM-Provider-Anbindung (4 Provider: Gemini, OpenAI, Anthropic, Ollama)
- ✅ Dreischichten-Prompt-Assemblierung (Basis + Kontext + Mapping)
- ✅ Plaintext-Vergleich als fundamentale Validierung
- ✅ Export als TEI-XML mit Attribut-Bereinigung
- ❌ Service-Integration in app.js (Module existieren, sind aber nicht verdrahtet)

**Aktueller Detailstatus:** Siehe [STATUS.md](STATUS.md)

Spezifiziert in [ARCHITECTURE.md](ARCHITECTURE.md) und [WORKFLOW.md](WORKFLOW.md).

### Phase 3: Konsolidierung 📋

Qualitative Verbesserungen, nicht primär neue Features.

- Schema-Validierung clientseitig (ODD-Parsing Stufe 2)
- [teiModeller](teiModeller.md)-Integration
- LLM-as-a-Judge für Review
- XPath-basierte Validierung
- CodeMirror 6 Migration (falls nötig)
- UI-Polish und Fehlerbehandlung

---

## Architekturprinzipien

| Prinzip | Umsetzung |
|---|---|
| Expertenintegration | Fachexpertin im Zentrum, nicht am Ende. Sie wählt Mapping, validiert Annotationen, entscheidet bei Ambiguität |
| Modellvielfalt | Verschiedene LLM-Provider (OpenAI, Anthropic, Google, Ollama). Kein Modell wird als überlegen vorausgesetzt |
| Strukturerhalt | TEI-Struktur bleibt erhalten, keine verlustbehaftete Transformation |
| Lokale Kontrolle | Client-only, API-Keys nur im Arbeitsspeicher, keine Server-Persistenz |
| Transparenz | Sichtbarkeit des Modells, der Mapping-Regeln, der Konfidenzgründe |

---

## Import-Formate

- Plaintext (primär)
- PAGE-XML (aus coOCR HTR oder anderen HTR-Systemen)
- Basis-TEI (zur Nachbearbeitung und Anreicherung)
- DOCX (via JSZip, Text-Extraktion)

---

## Synergieprojekte

### Direkte Anwendung

| Projekt | TEI-Schema | Anwendungsfall |
|---|---|---|
| Schliemann Rechnungsbücher | Bookkeeping Ontology (`bk:`) | Transaktionen, Beträge, Personen |
| zbz-ocr-tei | DTA-Basisformat | Historische Drucke, Strukturannotation |
| DoCTA | SiCPAS, BeNASch | Mittelalterliche Kochrezepte, Zutaten, Maße |
| Stefan Zweig Digital | correspDesc, TEI-Manuskript | Korrespondenzen, Lebensdokumente |

### Methodische Verbindungen

| Projekt | Verbindung |
|---|---|
| coOCR HTR | Upstream-Tool, geteilte Architekturprinzipien, geteilte UI-Patterns |
| DIA-XAI | Testfeld für EQUALIS-Framework, Expert-in-the-Loop-Evaluation |
| Promptotyping | Entwicklungsmethodik |

---

## Offene Fragen

- TEI-Guidelines-Destillation: Granularität und Umfang der Wissensmodule für [teiModeller](teiModeller.md)
- Normdaten-Integration: LLM-Vorschläge vs. nachgelagerte Reconciliation gegen APIs
- Batch-Processing für größere Korpora (nachrangig für Prototyp)

---

## Verwandte Tools

- coOCR HTR: http://dhcraft.org/co-ocr-htr
- ediarum (BBAW): https://www.ediarum.org
- TEI Publisher: https://teipublisher.com
- oXygen XML Editor: https://www.oxygenxml.com

## Repository

https://github.com/DigitalHumanitiesCraft/teiCrafter

---

**Wissensbasis:**
- [STATUS.md](STATUS.md) — Implementierungs-Ist-Stand
- [DESIGN.md](DESIGN.md) — Visuelle Spezifikation
- [ARCHITECTURE.md](ARCHITECTURE.md) — Technische Architektur
- [WORKFLOW.md](WORKFLOW.md) — Annotation, Review, Validierung
- [MODULES.md](MODULES.md) — Technische Modul-Referenz
- [teiModeller.md](teiModeller.md) — Modellierungsberatung (Phase 3)
- [DECISIONS.md](DECISIONS.md) — Offene Entscheidungen und Implementierungsplan
