---
type: knowledge
created: 2026-02-05
updated: 2026-02-05
tags: [teicrafter, teimodeller, distillation, pipeline, tei-guidelines]
status: planned
---

# TEI-Guidelines-Destillation

Dieses Dokument spezifiziert die Pipeline, die aus den TEI P5 Guidelines destillierte Wissensmodule für den [teiModeller](teiModeller.md) erzeugt. Die Pipeline ist ein vorgelagerter Produktionsprozess, der unabhängig von der teiCrafter-Laufzeitanwendung steht und bei neuen TEI-Releases erneut ausgeführt werden kann.

**Abhängigkeiten:**
- [teiModeller.md](teiModeller.md) für die Anforderungen an die Wissensmodule
- [WORKFLOW.md](WORKFLOW.md) für die Mapping-Schicht, in die der teiModeller seine Ergebnisse liefert

---

## 1. Ziel

Die TEI P5 Guidelines umfassen 588 Elemente in 23 Modulen (Version 4.10.2, Stand September 2025). Sie sind die maßgebliche Referenz für TEI-Modellierungsentscheidungen, aber aufgrund ihres Umfangs und ihrer Struktur weder für LLMs direkt nutzbar noch für Nutzerinnen im Annotationsprozess effizient navigierbar.

Die Pipeline erzeugt pro TEI-Modul ein destilliertes Wissensmodul, das zwei Wissenstypen trennt.

**Referenzwissen** umfasst die verfügbaren Elemente mit Attributen, Zugehörigkeit zu Klassen, erlaubtem Inhalt und Verwendungskontext. Dieses Wissen beantwortet die Frage "Was gibt es und wie ist es definiert?"

**Modellierungswissen** umfasst typische Annotationsmuster, Entscheidungsalternativen, häufige Fehler und die diskursiven Begründungen aus den Guidelines. Dieses Wissen beantwortet die Frage "Wann verwende ich was und warum?"

Die Trennung ist notwendig, weil beide Wissenstypen unterschiedliche Funktionen im teiModeller erfüllen. Referenzwissen wird für die Schema-Führung und Autovervollständigung benötigt, Modellierungswissen für die Beratungsfunktion.

---

## 2. Quellstruktur

Die TEI Guidelines sind öffentlich unter `https://tei-c.org/release/doc/tei-p5-doc/en/html/` verfügbar. Die Quelle besteht aus zwei Ebenen.

### 2.1 Kapitel (Modulübersichten)

Jedes der 23 Module entspricht einem Kapitel der Guidelines. Die Kapitel enthalten diskursive Erläuterungen, Modellierungsbeispiele und Begründungen für Designentscheidungen. Die URLs folgen einem festen Schema mit zweistelligen Kürzeln (z.B. `ND.html` für Names, Dates, People, and Places).

| Modul | Kapitel | URL-Kürzel | Priorität |
|---|---|---|---|
| tei | 1 The TEI Infrastructure | ST.html | Basis |
| header | 2 The TEI Header | HD.html | Basis |
| core | 3 Elements Available in All TEI Documents | CO.html | Basis |
| textstructure | 4 Default Text Structure | DS.html | Basis |
| gaiji | 5 Characters, Glyphs, and Writing Modes | WD.html | Niedrig |
| verse | 6 Verse | VE.html | Niedrig |
| drama | 7 Performance Texts | DR.html | Niedrig |
| spoken | 8 Transcriptions of Speech | TS.html | Niedrig |
| cmc | 9 Computer-mediated Communication | CMC.html | Niedrig |
| dictionaries | 10 Dictionaries | DI.html | Niedrig |
| msdescription | 11 Manuscript Description | MS.html | Mittel |
| transcr | 12 Representation of Primary Sources | PH.html | Mittel |
| textcrit | 13 Critical Apparatus | TC.html | Niedrig |
| namesdates | 14 Names, Dates, People, and Places | ND.html | Hoch |
| figures | 15 Tables, Formulæ, Graphics, and Notated Music | FT.html | Niedrig |
| corpus | 16 Language Corpora | CC.html | Niedrig |
| linking | 17 Linking, Segmentation, and Alignment | SA.html | Mittel |
| analysis | 18 Simple Analytic Mechanisms | AI.html | Niedrig |
| iso-fs | 19 Feature Structures | FS.html | Niedrig |
| nets | 20 Graphs, Networks, and Trees | GD.html | Niedrig |
| certainty | 22 Certainty, Precision, and Responsibility | CE.html | Mittel |
| tagdocs | 23 Documentation Elements | TD.html | Niedrig |

Die Prioritätsspalte orientiert sich an den Synergieprojekten aus [teiCrafter.md](teiCrafter.md). "Basis" bedeutet, dass das Modul in jedem TEI-Schema enthalten sein sollte. "Hoch" markiert Module mit direkter Relevanz für laufende Projekte.

### 2.2 Elementreferenzen

Jedes Element hat eine eigene Referenzseite unter `https://tei-c.org/release/doc/tei-p5-doc/en/html/ref-ELEMENTNAME.html`. Diese Seiten folgen einem konsistenten Schema und enthalten die formale Definition, Attribute, Zugehörigkeit zu Modulen und Klassen, erlaubten Inhalt, Beispiele und Bemerkungen.

### 2.3 Klassenreferenzen

Attributklassen und Modellklassen sind unter `REF-CLASSES-ATTS.html` und `REF-CLASSES-MODEL.html` verzeichnet. Sie definieren, welche Attribute und Inhaltsmodelle gruppenübergreifend gelten. Für die Destillation sind sie relevant, weil sie erklären, warum ein Element bestimmte Attribute erbt.

---

## 3. Pipeline-Stufen

### Stufe 1 – Scraping

**Input:** TEI-Guidelines-Website (HTML)
**Output:** Rohtext als Markdown-Dateien, eine pro Modul plus eine pro Elementreferenz

Der Scraper lädt die Kapitelseiten und Elementreferenzseiten herunter und extrahiert den strukturierten Inhalt. HTML-Tabellen werden in Markdown-Tabellen überführt, Codebeispiele bleiben als Codeblöcke erhalten, Querverweise zwischen Modulen werden als Verweise notiert.

Technische Hinweise zum Scraper.

Die Guidelines-Seiten verwenden ein konsistentes HTML-Layout mit navigierbaren Abschnitten. Der Scraper muss Navigationsleisten, Footer und Seitenleisten entfernen und nur den Hauptinhalt extrahieren. Die Elementreferenzseiten haben ein tabellarisches Layout mit vorhersagbaren Feldern (Module, Attributes, Contained by, May contain, Note, Example). Dieses Layout kann in ein strukturiertes Zwischenformat (JSON oder YAML) überführt werden, bevor es zu Markdown wird.

**Versionierung.** Der Scraper speichert die TEI-Version (aktuell 4.10.2) als Metadatum. Bei einem neuen Release wird die Pipeline erneut ausgeführt und die Differenzen sind nachvollziehbar.

### Stufe 2 – Destillation

**Input:** Markdown-Rohdateien aus Stufe 1
**Output:** Destillierte Wissensmodule, eines pro TEI-Modul

Ein LLM verarbeitet jede Modul-Datei nach einem festen Destillations-Prompt. Der Prompt ist das zentrale Qualitätsinstrument der Pipeline. Er muss die Trennung zwischen Referenzwissen und Modellierungswissen durchsetzen und gleichzeitig sicherstellen, dass keine inhaltlich relevanten Informationen verloren gehen.

**Destillations-Prompt-Struktur (Entwurf)**

Der Prompt für die Destillation enthält folgende Anweisungen.

Für den Referenzwissen-Teil soll das LLM pro Element eine kompakte Beschreibung erzeugen, die den Elementnamen, das Modul, die wichtigsten Attribute (mit kurzer Erklärung), den typischen Inhalt und die Zugehörigkeit zu Klassen umfasst. Elemente, die selten verwendet werden oder hochspezialisiert sind, erhalten eine kürzere Beschreibung. Die Klassenzugehörigkeit ist wichtig, weil sie erklärt, welche Attribute ein Element erbt und in welchen Kontexten es stehen darf.

Für den Modellierungswissen-Teil soll das LLM folgendes extrahieren und verdichten. Typische Verwendungsmuster, also wann und wofür wird dieses Element in der Praxis eingesetzt. Entscheidungsalternativen, also welche anderen Elemente für ähnliche Zwecke in Frage kommen und worin der Unterschied besteht. Häufige Fehler und Missverständnisse, die in den Guidelines explizit oder implizit benannt werden. Beziehungen zu anderen Modulen, also welche Elemente aus anderen Modulen typischerweise zusammen mit Elementen dieses Moduls verwendet werden.

Explizite Anweisung an das LLM. Die diskursiven Abschnitte der Guidelines (Begründungen, historische Erläuterungen, Modellierungsdiskussionen) sind für das Modellierungswissen besonders wertvoll. Sie dürfen nicht als "irrelevante Details" behandelt werden.

**Ausgabeformat pro Modul**

```
# TEI-Modul: [Modulname]
TEI-Version: [Version]
Kapitel: [Kapitelnummer und -titel]

## Referenzwissen

### [Elementname]
- Attribute: [Liste mit Kurzbeschreibung]
- Inhalt: [Erlaubter Inhalt]
- Klassen: [Klassenzugehörigkeit]
- Kurzcharakteristik: [1–2 Sätze]

[... weitere Elemente ...]

## Modellierungswissen

### Typische Annotationsmuster
[Muster mit Beispielen]

### Entscheidungsalternativen
[Element A vs. Element B: Wann welches?]

### Häufige Fehler
[Fehler mit Erklärung]

### Modulübergreifende Beziehungen
[Zusammenspiel mit anderen Modulen]
```

### Stufe 3 – Validierung

**Input:** Destillierte Module aus Stufe 2
**Output:** Validierungsbericht pro Modul, korrigierte Module bei Bedarf

Die Validierung prüft drei Dimensionen.

**Vollständigkeit.** Ein zweiter LLM-Durchlauf vergleicht jedes destillierte Modul mit der Rohquelle und prüft, ob Elemente, Attribute oder Modellierungshinweise fehlen. Der Validierungs-Prompt fragt explizit nach Auslassungen.

**Korrektheit.** Der Validierungsdurchlauf prüft, ob die Beschreibungen im destillierten Modul den Originaldefinitionen entsprechen. Besonderes Augenmerk liegt auf Attribut-Definitionen (Datentypen, erlaubte Werte) und Inhaltsmodellen, weil hier Kompression am ehesten zu Fehlern führt.

**Stichprobenhafte manuelle Prüfung.** Für die Module mit Priorität "Basis" und "Hoch" wird mindestens ein Fachexperte die destillierten Module gegen die Guidelines prüfen. Dies betrifft im Pilotdurchlauf die Module `core`, `header`, `namesdates` und `textstructure`.

---

## 4. Pilotdurchlauf

Der erste Durchlauf destilliert nicht alle 23 Module, sondern beginnt mit einem einzelnen Modul, um die Pipeline und den Destillations-Prompt zu validieren.

**Pilotmodul:** `namesdates` (Kapitel 14, ND.html)

Gründe für die Wahl.

Das Modul ist inhaltlich relevant für mehrere Synergieprojekte (Stefan Zweig Digital, Schliemann Rechnungsbücher). Es enthält sowohl klar definierte Elemente (`persName`, `placeName`, `orgName`) als auch Elemente mit komplexen Modellierungsentscheidungen (`person`, `place`, `event`, `relation`). Es hat eine überschaubare Größe (ca. 70 Elemente), die groß genug ist, um die Pipeline zu testen, aber klein genug, um die Ergebnisse manuell zu prüfen. Außerdem enthält das Kapitel umfangreiche diskursive Abschnitte über Modellierungsalternativen, die einen guten Test für die Extraktion von Modellierungswissen darstellen.

**Erfolgskriterien für den Pilotdurchlauf**

Das destillierte Modul muss alle Elemente des Moduls enthalten (Vollständigkeit). Die Attribut-Beschreibungen müssen korrekt sein, prüfbar gegen die Elementreferenzseiten (Korrektheit). Das Modellierungswissen muss mindestens die in den Guidelines diskutierten Alternativen für `persName` vs. `person` und `placeName` vs. `place` korrekt wiedergeben (Nutzbarkeit). Der teiModeller muss mit dem destillierten Modul in der Lage sein, eine Frage wie "Wie annotiere ich Personennamen in einem Briefkorpus?" fundiert zu beantworten (Anschlussfähigkeit).

---

## 5. Wartung und Aktualisierung

Die TEI Guidelines werden regelmäßig aktualisiert (mehrere Releases pro Jahr). Die Pipeline muss bei neuen Releases erneut ausführbar sein.

**Versionsstrategie.** Jedes destillierte Modul trägt die TEI-Version als Metadatum. Beim erneuten Durchlauf wird ein Diff zwischen alter und neuer Rohquelle erzeugt. Nur Module, deren Quellkapitel sich geändert hat, werden neu destilliert. Dies reduziert den LLM-Aufwand und die manuelle Prüfarbeit.

**Repository-Struktur (Entwurf)**

```
distillation/
├── raw/                          # Stufe 1: Scraping-Ergebnis
│   ├── chapters/
│   │   ├── ST.md                 # Kapitel 1: TEI Infrastructure
│   │   ├── HD.md                 # Kapitel 2: Header
│   │   ├── ND.md                 # Kapitel 14: Names, Dates
│   │   └── ...
│   ├── elements/
│   │   ├── persName.md
│   │   ├── placeName.md
│   │   └── ...
│   └── meta.json                 # TEI-Version, Scraping-Datum
├── modules/                      # Stufe 2: Destillierte Module
│   ├── namesdates.md
│   ├── core.md
│   ├── header.md
│   └── ...
├── validation/                   # Stufe 3: Validierungsberichte
│   ├── namesdates_validation.md
│   └── ...
├── prompts/                      # Prompt-Vorlagen
│   ├── scraping_prompt.md
│   ├── distillation_prompt.md
│   └── validation_prompt.md
└── pipeline.md                   # Ausführungsanleitung
```

---

## 6. Offene Fragen

**Granularität der Elementreferenzen.** Sollen die Elementreferenzseiten einzeln gescrapt und dann dem Kapiteltext zugeordnet werden, oder reicht der Kapiteltext allein? Das Kapitel enthält die diskursiven Erläuterungen, aber die Referenzseiten enthalten die vollständigen formalen Definitionen. Der Pilotdurchlauf muss zeigen, ob der Kapiteltext für die Destillation ausreicht oder ob die Referenzseiten ergänzend nötig sind.

**Prompt-Stabilität über Module hinweg.** Der Destillations-Prompt wird am Pilotmodul `namesdates` entwickelt. Es ist möglich, dass er für andere Module (z.B. `transcr` oder `msdescription`) angepasst werden muss, weil diese eine andere Struktur oder andere Modellierungskomplexität haben. Die Frage ist, ob ein einziger Prompt für alle Module funktioniert oder ob modulspezifische Anpassungen nötig werden.

**Domänenspezifische Erweiterungen.** Die TEI-Guidelines decken die generischen Module ab. Für projektspezifische Schemata wie die Bookkeeping Ontology (`bk:`) oder das DTA-Basisformat gibt es keine TEI-Kapitel. Diese Erweiterungen müssten aus anderen Quellen (Projektdokumentation, ODD-Dateien) destilliert werden. Das ist eine separate Pipeline-Erweiterung, die hier dokumentiert, aber nicht spezifiziert wird.

**LLM-Auswahl für die Destillation.** Die Wahl des LLM für Stufe 2 und 3 beeinflusst die Qualität der Module. Für die Destillation wird ein Modell mit großem Kontextfenster benötigt, weil die Kapitel umfangreich sind. Die Validierung kann mit einem anderen Modell durchgeführt werden, um systematische Bias eines einzelnen Modells zu vermeiden.

---

## 7. Beziehung zu anderen Dokumenten

DISTILLATION.md beschreibt, wie die Wissensgrundlage entsteht. [teiModeller.md](teiModeller.md) beschreibt, wie sie verwendet wird. Die Schnittstelle zwischen beiden ist das Ausgabeformat der destillierten Module (§3, Stufe 2). Änderungen am Ausgabeformat müssen in beiden Dokumenten reflektiert werden.

Die Destillations-Pipeline ist ein Entwicklungswerkzeug, kein Laufzeit-Feature. Sie läuft nicht im Browser und nicht als Teil der teiCrafter-Anwendung, sondern als eigenständiger Prozess, der von agentischen Coding-Systemen oder manuell ausgeführt werden kann.

---

**Referenzierte Dokumente:**
- [teiModeller.md](teiModeller.md)
- [WORKFLOW.md](WORKFLOW.md)
- [teiCrafter.md](teiCrafter.md)
- [DECISIONS.md](DECISIONS.md)
