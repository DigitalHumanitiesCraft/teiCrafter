# User Stories und Testplanung

User Stories für den teiCrafter-Prototyp (Phase 2) und ausgewählte Stories für Phase 3. Jede Story folgt dem Schema "Als [Rolle] möchte ich [Aktion], damit [Nutzen]" und enthält einen manuell durchführbaren Testfall.

Stand: 2026-02-18 (Session 11)

**Abhängigkeiten:** [DESIGN.md](DESIGN.md), [ARCHITECTURE.md](ARCHITECTURE.md), [WORKFLOW.md](WORKFLOW.md), [teiModeller.md](teiModeller.md), [DECISIONS.md](DECISIONS.md)

---

## Testumgebung

Der lokale Dev-Server läuft in VS Code, erreichbar über `localhost`. Tests sind manuell im Browser durchführbar, ohne automatisiertes Testing-Framework. Jede Story hat ein Gegeben-Wenn-Dann-Muster und einen konkreten Prüfschritt, der visuell oder per Browser-DevTools verifiziert werden kann.

Für Stories mit LLM-Aufrufen (ab 3.1) wird ein gültiger API-Key für mindestens einen Provider benötigt.

---

## Statuslegende

| Status | Bedeutung |
|---|---|
| ✅ | Modul implementiert UND in app.js integriert |
| 🔧 | Modul implementiert, aber NICHT in app.js integriert |
| ⬜ | Noch nicht begonnen |
| ⏳ | Phase 3 (nicht Teil des Prototyps) |

---

## Schritt 0 – Editor-Fundament

Validiert das technische Fundament, bevor inhaltliche Features aufgebaut werden. Entspricht den Implementierungsschritten 1–5 in [DECISIONS.md](DECISIONS.md).

---

### Story 0.1 – XML wird mit Syntax-Highlighting dargestellt 🔧

**Referenz:** [DESIGN.md](DESIGN.md) §4 (XML-Editor), [ARCHITECTURE.md](ARCHITECTURE.md) §4

**Als** Editorin **möchte ich** TEI-XML im mittleren Panel mit farblich unterschiedenen Tags, Attributen und Textinhalten sehen, **damit** ich die Dokumentstruktur visuell erfassen kann.

**Gegeben** eine geladene TEI-XML-Datei mit mindestens 100 Zeilen,
**wenn** das Dokument im Editor angezeigt wird,
**dann** sind Tags, Attribute, Attributwerte und Textknoten in unterschiedlichen Farben dargestellt.

**Prüfschritt:** Visueller Vergleich mit demselben Dokument in oXygen oder VS Code. Die Farbkategorien (nicht die exakten Farben) müssen übereinstimmen.

---

### Story 0.2 – Scrollen ohne Drift (Overlay-Spike) 🔧

**Referenz:** [ARCHITECTURE.md](ARCHITECTURE.md) §4, [DECISIONS.md](DECISIONS.md) (Editor-Engine: Overlay-Spike)

**Als** Editorin **möchte ich** in einem TEI-Dokument mit 500 Zeilen scrollen können, ohne dass Highlighting und Text auseinanderlaufen, **damit** ich auch in längeren Dokumenten zuverlässig arbeiten kann.

**Gegeben** ein TEI-Dokument mit 500+ Zeilen im Editor,
**wenn** ich zum Ende scrolle, zur Mitte zurückkehre und wieder zum Anfang scrolle,
**dann** bleibt die Overlay-Schicht an jeder Stelle pixelgenau über dem Text.

**Prüfschritt:** Visuelle Inspektion an mindestens drei Positionen (Anfang, Mitte, Ende). Falls Drift auftritt, wird auf CodeMirror 6 gewechselt (siehe [DECISIONS.md](DECISIONS.md)).

**Anmerkung:** Diese Story ist der architektonische Grundsatztest. Ihr Ergebnis bestimmt, ob die Stories 0.1 und 0.3 mit Overlay oder CodeMirror 6 umgesetzt werden.

---

### Story 0.3 – Zeilennummern im Gutter 🔧

**Referenz:** [DESIGN.md](DESIGN.md) §4

**Als** Editorin **möchte ich** Zeilennummern sehen, **damit** ich Validierungsfehler und Review-Kommentare einer konkreten Stelle zuordnen kann.

**Gegeben** ein geladenes TEI-Dokument,
**wenn** ich scrolle oder neue Zeilen einfüge,
**dann** stimmen die Zeilennummern mit dem tatsächlichen Zeileninhalt überein.

**Prüfschritt:** Man fügt eine Leerzeile in der Mitte ein. Die Zeilennummern aller folgenden Zeilen müssen sich um eins erhöhen.

---

### Story 0.4 – Undo/Redo auf Dokumentebene 🔧

**Referenz:** [ARCHITECTURE.md](ARCHITECTURE.md) §3

**Als** Editorin **möchte ich** Änderungen am Dokument rückgängig machen und wiederherstellen können, **damit** ich bei fehlerhaften Bearbeitungen oder unerwünschten Transform-Ergebnissen zum vorherigen Zustand zurückkehren kann.

**Gegeben** ein geladenes TEI-Dokument, in dem mehrere Bearbeitungen durchgeführt wurden (z.B. Text eingefügt, Annotation akzeptiert, Transform ausgeführt),
**wenn** ich Ctrl+Z drücke,
**dann** wird die letzte Bearbeitungseinheit rückgängig gemacht und alle Ansichten (Editor, Vorschau, Validierung) aktualisieren sich konsistent.

**Prüfschritte:**
- Man führt einen Transform durch (Story 3.1), drückt Ctrl+Z. Das gesamte Transform-Ergebnis wird rückgängig gemacht – nicht nur eine einzelne Annotation.
- Man akzeptiert eine Annotation (Story 4.1), drückt Ctrl+Z. Die Annotation kehrt in den Zustand "offen" zurück.
- Man drückt Ctrl+Y nach einem Undo. Die rückgängig gemachte Änderung wird wiederhergestellt.

**Anmerkung:** Diese Story validiert das Snapshot-basierte Undo-System aus [ARCHITECTURE.md](ARCHITECTURE.md) §3. Sie ist Voraussetzung für einen sicheren Review-Workflow, weil fehlerhafte Accept/Reject-Entscheidungen korrigierbar sein müssen.

---

## Schritt 1 – Import

Entspricht dem Workflow-Stepper-Schritt "Import". Referenz: [DESIGN.md](DESIGN.md) §4 (Source-Panel), [WORKFLOW.md](WORKFLOW.md).

---

### Story 1.1 – Plaintext importieren ✅

**Als** Editorin **möchte ich** eine Plaintext-Datei per Drag-and-Drop oder Dateiauswahl laden, **damit** ich mit der Annotation beginnen kann.

**Gegeben** eine `.txt`-Datei mit mehreren Absätzen,
**wenn** ich sie in das Browserfenster ziehe oder über den Dateidialog auswähle,
**dann** erscheint der Text im Source-Panel (links) und eine minimale TEI-Hülle (`<TEI>`, `<teiHeader>`, `<body>` mit `<p>`-Elementen) im Editor (Mitte).

**Prüfschritt:** Man inspiziert den generierten XML-Quelltext in den DevTools. Jeder Absatz des Originaltexts muss in einem eigenen `<p>`-Element stehen. Der Textinhalt muss zeichengenau dem Original entsprechen.

---

### Story 1.2 – Basis-TEI importieren ✅

**Als** Editorin **möchte ich** eine existierende TEI-XML-Datei laden, **damit** ich sie weiter annotieren kann.

**Gegeben** eine valide TEI-XML-Datei,
**wenn** ich sie lade,
**dann** erscheint sie unverändert im Editor.

**Prüfschritt:** Zeichengenauer Vergleich des Editor-Inhalts mit dem Original. Whitespace und Einrückung dürfen sich nicht verändern.

---

### Story 1.3 – Ungültiges XML wird abgewiesen ✅

**Als** Editorin **möchte ich** bei fehlerhaftem XML eine verständliche Fehlermeldung sehen, **damit** ich das Problem beheben kann.

**Gegeben** eine XML-Datei mit einem nicht geschlossenen Tag,
**wenn** ich sie lade,
**dann** erscheint ein Toast mit einer Fehlermeldung, die die Art des Fehlers benennt, und die Datei wird nicht in den Editor übernommen.

**Prüfschritt:** Man erstellt eine Datei mit `<p>Text ohne schließendes Tag`. Die Fehlermeldung muss auf das fehlende schließende Tag hinweisen. Der Editor bleibt leer oder zeigt den vorherigen Zustand.

---

## Schritt 2 – Mapping

Entspricht dem Workflow-Stepper-Schritt "Mapping". Referenz: [WORKFLOW.md](WORKFLOW.md) §3 (Dreischichten-Prompt).

---

### Story 2.1 – Annotationstypen auswählen ✅

**Als** Editorin **möchte ich** vor dem Transform festlegen, welche Annotationstypen das LLM annotieren soll, **damit** ich die Annotation gezielt steuern kann.

**Gegeben** ein geladenes TEI-Dokument,
**wenn** ich den Transform-Dialog öffne,
**dann** sehe ich die verfügbaren Annotationstypen (Personen, Orte, Daten, Organisationen usw.) als Checkboxen und kann einzelne an- oder abwählen.

**Prüfschritt:** Man wählt nur "Personen" und "Orte". Nach dem Transform (Story 3.1) enthält das Ergebnis ausschließlich `<persName>` und `<placeName>`, keine anderen Entity-Tags. Prüfbar per Textsuche im Editor.

---

### Story 2.2 – Prompt vor dem Absenden einsehen 🔧

**Referenz:** [WORKFLOW.md](WORKFLOW.md) §3, Architekturprinzip "Transparenz" in [VISION.md](VISION.md)

**Als** Editorin **möchte ich** den assemblierten Prompt sehen, bevor er an das LLM gesendet wird, **damit** ich die Transparenz über den Annotationsprozess behalte.

**Gegeben** konfigurierte Annotationstypen im Transform-Dialog,
**wenn** ich auf "Prompt anzeigen" klicke,
**dann** wird der vollständige Prompt angezeigt, sichtbar gegliedert in Basis-, Kontext- und Mapping-Schicht.

**Prüfschritt:** Die gewählten Annotationstypen aus Story 2.1 sind in der Mapping-Schicht reflektiert. Abgewählte Typen erscheinen nicht im Prompt.

---

## Schritt 3 – Transform

Entspricht dem Workflow-Stepper-Schritt "Transform". Referenz: [WORKFLOW.md](WORKFLOW.md) §4–5, [ARCHITECTURE.md](ARCHITECTURE.md) (LLM-Service).

---

### Story 3.1 – LLM annotiert den Text ✅

**Als** Editorin **möchte ich** den TEI-Body an ein LLM senden und ein annotiertes TEI-Dokument zurückbekommen, **damit** ich den Annotationsvorschlag prüfen kann.

**Gegeben** ein geladenes TEI-Dokument, ein konfigurierter API-Key und gewählte Annotationstypen,
**wenn** ich den Transform auslöse,
**dann** erscheint nach der LLM-Antwort annotiertes XML im Editor, in dem erkannte Entitäten mit den entsprechenden TEI-Tags versehen sind.

**Prüfschritt:** Man verwendet einen Kontrolltext (kurzer Brief mit bekannten Personen- und Ortsnamen, z.B. "Lieber Heinrich, ich schreibe Dir aus Wien"). Die Namen müssen als `<persName>` bzw. `<placeName>` annotiert sein. Das XML muss wohlgeformt sein (prüfbar per Browser-Konsole mit DOMParser).

**Testdokument:** Ein kurzer Brief mit 5–10 eindeutigen Named Entities aus einem der Synergieprojekte.

---

### Story 3.2 – Diff-Ansicht vor der Übernahme 🔧

**Referenz:** [WORKFLOW.md](WORKFLOW.md) §5 (Diff-Ansicht), [DECISIONS.md](DECISIONS.md) (Diff-Darstellung)

**Als** Editorin **möchte ich** nach dem Transform eine Zusammenfassung der Änderungen sehen, **damit** ich vor der Übernahme einschätzen kann, ob das Ergebnis plausibel ist.

**Gegeben** ein abgeschlossener Transform,
**wenn** die Diff-Ansicht erscheint,
**dann** zeigt sie einen Zusammenfassungsbalken (z.B. "12 Personen, 5 Orte, 3 Daten hinzugefügt") und darunter den annotierten Text mit farblicher Hervorhebung der neuen Annotationen.

**Prüfschritt:** Man zählt die im Zusammenfassungsbalken genannten Zahlen und vergleicht sie mit der tatsächlichen Anzahl neuer Tags im XML. Die Zahlen müssen übereinstimmen. "Übernehmen" aktualisiert den Editor, "Verwerfen" stellt den Zustand vor dem Transform wieder her.

---

### Story 3.3 – Konfidenz wird visuell kodiert 🔧

**Referenz:** [DESIGN.md](DESIGN.md) §2.5 (Dual-Channel-Encoding), [WORKFLOW.md](WORKFLOW.md) §9, [DECISIONS.md](DECISIONS.md) (Farbkombinationen)

**Als** Editorin **möchte ich** auf einen Blick sehen, welche Annotationen das LLM als sicher, prüfenswert oder problematisch einschätzt, **damit** ich meine Prüfzeit gezielt einsetzen kann.

**Gegeben** ein annotiertes Dokument nach dem Transform,
**wenn** ich die Vorschau betrachte,
**dann** haben Annotationen unterschiedliche Hintergrundfarben je nach Konfidenz-Kategorie (sicher, prüfenswert, problematisch).

**Prüfschritt:** Man identifiziert mindestens eine Annotation pro Konfidenz-Kategorie und prüft visuell, ob die drei Kategorien unterscheidbar sind. Dieser Test ist gleichzeitig die Validierung der visuellen Testmatrix aus [DECISIONS.md](DECISIONS.md).

---

## Schritt 4 – Review

Entspricht dem Review-Workflow. Referenz: [WORKFLOW.md](WORKFLOW.md) §6–8.

---

### Story 4.1 – Einzelne Annotation prüfen (Inline-Review) 🔧

**Als** Editorin **möchte ich** eine Annotation in der Vorschau anklicken und sie akzeptieren, bearbeiten oder ablehnen, **damit** ich jede LLM-Annotation einzeln bewerten kann.

**Gegeben** ein annotiertes Dokument in der Vorschau (rechtes Panel),
**wenn** ich auf einen annotierten Namen klicke,
**dann** erscheint ein Menü mit den Aktionen Accept, Edit und Reject.

**Prüfschritte:**
- Accept: Der visuelle Status ändert sich (Konfidenzfarbe wird zu "manuell"). Im XML bleibt das Tag erhalten.
- Reject: Das Tag wird entfernt, der Textinhalt bleibt erhalten. Im Editor ist das Tag verschwunden.
- Edit: Ein Formular öffnet sich (Attribut-Tab), in dem man Tag-Typ oder Attribute ändern kann. Nach dem Speichern ist die Änderung im Editor sichtbar.

---

### Story 4.2 – Batch-Review per Tastatur 🔧

**Referenz:** [WORKFLOW.md](WORKFLOW.md) §7 (Batch-Review)

**Als** Editorin **möchte ich** alle offenen Annotationen sequentiell per Tastatur durchgehen, **damit** ich effizient prüfen kann.

**Gegeben** ein Dokument mit mindestens 10 ungeprüften Annotationen,
**wenn** ich den Batch-Review-Modus starte,
**dann** wird die erste ungeprüfte Annotation fokussiert und in der Vorschau hervorgehoben.

**Prüfschritt:** `N` springt zur nächsten Annotation, `A` akzeptiert, `R` lehnt ab, `E` öffnet die Bearbeitung. Nach jeder Aktion springt der Fokus automatisch zur nächsten ungeprüften Annotation. Man durchläuft 5 Annotationen und prüft, ob der Fortschrittsbalken (Story 4.3) korrekt mitzählt.

---

### Story 4.3 – Review-Fortschritt sichtbar 🔧

**Referenz:** [WORKFLOW.md](WORKFLOW.md) §8

**Als** Editorin **möchte ich** jederzeit sehen, wie viele Annotationen geprüft sind und wie viele noch offen sind, **damit** ich meinen Fortschritt einschätzen kann.

**Gegeben** ein Dokument mit Annotationen,
**wenn** ich Annotationen akzeptiere oder ablehne,
**dann** aktualisiert sich ein Fortschrittsbalken (z.B. "7 / 12 geprüft").

**Prüfschritt:** Man akzeptiert drei Annotationen und lehnt eine ab. Der Zähler erhöht sich um vier (jede Entscheidung zählt als geprüft, unabhängig vom Ergebnis).

---

## Schritt 5 – Validierung

Entspricht dem Workflow-Stepper-Schritt "Validate". Referenz: [WORKFLOW.md](WORKFLOW.md) §10 (Fünf Validierungsebenen).

---

### Story 5.1 – Plaintext-Vergleich ✅

**Referenz:** [WORKFLOW.md](WORKFLOW.md) §10 (Ebene 1: Plaintext-Vergleich)

**Als** Editorin **möchte ich** sicherstellen, dass der reine Textinhalt durch die Annotation nicht verändert wurde, **damit** keine Transkriptionsinhalte verloren gehen.

**Gegeben** ein annotiertes Dokument nach dem Transform,
**wenn** ich die Validierung auslöse,
**dann** vergleicht die Anwendung den extrahierten Plaintext (alle Tags entfernt) mit dem Originaltext und zeigt "Plaintext identisch" oder markiert Abweichungen.

**Prüfschritt:** Man führt einen Transform durch und prüft das Ergebnis. Bei einem korrekt funktionierenden LLM sollte "Plaintext identisch" erscheinen. Zum Gegentest fügt man manuell ein Wort in das annotierte XML ein und löst die Validierung erneut aus. Die Abweichung muss angezeigt werden.

---

### Story 5.2 – Schema-Validierung (Stufe 1) ✅

**Referenz:** [WORKFLOW.md](WORKFLOW.md) §10 (Ebene 2: Schema), [ARCHITECTURE.md](ARCHITECTURE.md) §6 (Zwei-Stufen-ODD)

**Als** Editorin **möchte ich** sehen, ob mein TEI-Dokument dem gewählten Schema entspricht, **damit** ich strukturelle Fehler erkennen kann.

**Gegeben** ein annotiertes Dokument im Editor,
**wenn** ich den Validierungs-Tab öffne,
**dann** zeigt er eine Liste der Schema-Fehler mit Zeilennummer und Fehlerbeschreibung.

**Prüfschritt:** Man fügt ein ungültiges Attribut ein (z.B. `<persName foo="bar">`). Der Validierungs-Tab zeigt einen Fehler. Man klickt auf den Fehler, der Editor springt zur entsprechenden Zeile.

---

## Schritt 6 – Export

Entspricht dem Workflow-Stepper-Schritt "Export".

---

### Story 6.1 – TEI-XML exportieren ✅

**Als** Editorin **möchte ich** das fertige Dokument als TEI-XML-Datei herunterladen, **damit** ich es in nachgelagerten Systemen (ediarum, oXygen, GAMS) weiterverarbeiten kann.

**Gegeben** ein annotiertes und (optional) validiertes Dokument,
**wenn** ich auf "Export" klicke,
**dann** wird eine `.xml`-Datei heruntergeladen.

**Prüfschritt:** Man öffnet die exportierte Datei in oXygen oder VS Code. Sie muss wohlgeformt sein und inhaltlich dem Editor-Zustand entsprechen.

---

### Story 6.2 – Warnung bei ungeprüften Annotationen 🔧

**Als** Editorin **möchte ich** gewarnt werden, wenn ich ein Dokument mit ungeprüften Annotationen exportiere, **damit** ich keine ungeprüften LLM-Vorschläge versehentlich als fertig behandle.

**Gegeben** ein Dokument mit mindestens einer ungeprüften Annotation,
**wenn** ich den Export auslöse,
**dann** erscheint ein Dialog ("5 Annotationen noch ungeprüft. Trotzdem exportieren?") mit den Optionen "Exportieren" und "Zurück zum Review".

**Prüfschritt:** Man löst den Export aus, ohne alle Annotationen geprüft zu haben. Der Dialog erscheint. "Zurück zum Review" schließt den Dialog, ohne zu exportieren. "Exportieren" erzeugt die Datei.

---

## Querschnitt – LLM-Konfiguration

---

### Story Q.1 – API-Key eingeben ✅

**Referenz:** Architekturprinzip "Lokale Kontrolle" in [VISION.md](VISION.md)

**Als** Editorin **möchte ich** meinen API-Key für einen LLM-Provider eingeben, **damit** die Anwendung Annotationen generieren kann.

**Gegeben** die geöffnete Anwendung,
**wenn** ich meinen API-Key in das Konfigurationsfeld eingebe,
**dann** wird er für die aktuelle Sitzung gespeichert und für LLM-Aufrufe verwendet.

**Prüfschritt:** Nach Eingabe des Keys löst man einen Transform aus (Story 3.1). Er muss funktionieren. Nach einem Seiten-Reload ist der Key weg. Man prüft über die DevTools (Application → Local Storage, Cookies), dass der Key nirgends persistent gespeichert ist.

---

### Story Q.2 – LLM-Provider wählen ✅

**Referenz:** Architekturprinzip "Modellvielfalt" in [VISION.md](VISION.md)

**Als** Editorin **möchte ich** zwischen verschiedenen LLM-Providern wählen können, **damit** ich nicht an einen Anbieter gebunden bin.

**Gegeben** die Konfigurationsoberfläche,
**wenn** ich einen Provider aus einer Liste wähle (z.B. Anthropic, OpenAI),
**dann** werden die LLM-Aufrufe an diesen Provider gerichtet.

**Prüfschritt:** Für den Prototyp reicht ein funktionierender Provider. Die Story ist erfüllt, wenn das UI-Element für die Provider-Auswahl vorhanden ist und mindestens ein Provider einen erfolgreichen Transform auslöst.

---

## Phase 3 – teiModeller

Diese Stories sind nicht Teil des Prototyps. Sie dokumentieren die geplante Funktionalität für die Konsolidierungsphase.

---

### Story M.1 – Modellierungsfrage stellen ⏳

**Referenz:** [teiModeller.md](teiModeller.md) §3

**Als** Editorin **möchte ich** eine Frage wie "Wie annotiere ich Währungsangaben?" stellen und einen begründeten Vorschlag mit TEI-Elementen und Attributen erhalten, **damit** ich fundierte Modellierungsentscheidungen treffen kann.

**Gegeben** der teiModeller ist geöffnet und relevante TEI-Wissensmodule sind aktiviert,
**wenn** ich eine Modellierungsfrage eingebe,
**dann** erhalte ich einen Vorschlag mit empfohlenem Element, relevanten Attributen und einem Beispiel-Snippet.

**Prüfschritt:** Man stellt die Frage und vergleicht den Vorschlag mit der entsprechenden Stelle in den TEI-Guidelines.

---

### Story M.2 – Vorschlag als Mapping-Regel übernehmen ⏳

**Referenz:** [teiModeller.md](teiModeller.md) §3 (Schritt 4), [WORKFLOW.md](WORKFLOW.md) §3

**Als** Editorin **möchte ich** einen akzeptierten Modellierungsvorschlag als Mapping-Regel speichern, **damit** er bei zukünftigen Transforms automatisch verwendet wird.

**Gegeben** ein akzeptierter Modellierungsvorschlag,
**wenn** ich "Als Mapping-Regel übernehmen" klicke,
**dann** erscheint die Regel in der Mapping-Schicht des Prompts.

**Prüfschritt:** Man öffnet die Prompt-Vorschau (Story 2.2) und prüft, ob die neue Regel in der Mapping-Schicht erscheint.

---

## Zusammenfassung

### Prototyp-Scope

| Schritt | Stories | ✅ Integriert | 🔧 Modul da | ⬜ Offen |
|---|---|:---:|:---:|:---:|
| 0 – Editor-Fundament | 0.1, 0.2, 0.3, 0.4 | 0 | 4 | 0 |
| 1 – Import | 1.1, 1.2, 1.3 | 3 | 0 | 0 |
| 2 – Mapping | 2.1, 2.2 | 1 | 1 | 0 |
| 3 – Transform | 3.1, 3.2, 3.3 | 1 | 2 | 0 |
| 4 – Review | 4.1, 4.2, 4.3 | 0 | 3 | 0 |
| 5 – Validierung | 5.1, 5.2 | 2 | 0 | 0 |
| 6 – Export | 6.1, 6.2 | 1 | 1 | 0 |
| Q – LLM-Konfiguration | Q.1, Q.2 | 2 | 0 | 0 |
| **Gesamt Prototyp** | **21** | **10** | **11** | **0** |
| M – teiModeller (Phase 3) | M.1, M.2 | — | — | ⏳ 2 |

**Zusammenfassung:** Alle 21 Prototyp-Stories haben implementierte Module. 10 sind voll integriert (UI + Service): Import 1.1–1.3, Mapping 2.1, Transform 3.1, Validierung 5.1–5.2, Export 6.1, LLM-Konfiguration Q.1–Q.2. 11 haben funktionierende Module, die aber noch nicht durchgängig in der UI verdrahtet sind (Editor-Fundament 0.1–0.4 weil editor.js nicht importiert, Review 4.1–4.3 weil preview.js nicht importiert, Transform 3.2–3.3 weil Diff-Ansicht und Konfidenz-Visualisierung preview.js benötigen, Export 6.2 weil Export-Warnung-Dialog fehlt). Siehe [STATUS.md](STATUS.md) für Details.

### Empfohlene Implementierungsreihenfolge

Abgeleitet aus den Abhängigkeiten. Stories innerhalb einer Stufe können parallel umgesetzt werden.

```
Stufe 1:  0.2 (Overlay-Spike – Architekturentscheidung)
Stufe 2:  0.1, 0.3, 0.4 (Editor-Grundfunktionen inkl. Undo)
Stufe 3:  1.1, 1.2, 1.3 (Import)
Stufe 4:  Q.1, Q.2 (LLM-Konfiguration)
Stufe 5:  2.1, 2.2 (Mapping)
Stufe 6:  3.1, 3.2, 3.3 (Transform)
Stufe 7:  4.1, 4.2, 4.3 (Review)
Stufe 8:  5.1, 5.2 (Validierung)
Stufe 9:  6.1, 6.2 (Export)
```

### Testdokumente

Für die manuelle Testdurchführung werden folgende Dokumente benötigt.

| Dokument | Zweck | Herkunft |
|---|---|---|
| Kontrollbrief (kurz) | 5–10 Named Entities, Transform-Validierung | Manuell erstellt oder aus Stefan Zweig Digital |
| TEI-Dokument (500+ Zeilen) | Overlay-Spike, Scroll-Verhalten | Aus einem Synergieprojekt |
| Ungültiges XML | Fehlerbehandlung beim Import | Manuell erstellt |
| Bereits annotiertes TEI | Import bestehender Annotationen | Aus einem Synergieprojekt |

---

**Referenzierte Dokumente:**
- [STATUS.md](STATUS.md) — Implementierungs-Ist-Stand
- [MODULES.md](MODULES.md) — Technische Modul-Referenz
- [DESIGN.md](DESIGN.md)
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [WORKFLOW.md](WORKFLOW.md)
- [teiModeller.md](teiModeller.md)
- [DECISIONS.md](DECISIONS.md)
- [VISION.md](VISION.md)
