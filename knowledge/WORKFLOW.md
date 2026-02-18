# Annotation, Review und Validierung

Dieses Dokument spezifiziert den zentralen Arbeitsprozess in teiCrafter. Es umfasst die Prompt-Architektur, den LLM-gestützten Transform, den menschlichen Review-Workflow und die fünf Validierungsebenen.

**Implementierungsstatus:** Die Service-Module (transform.js, validator.js, export.js) sind in app.js verdrahtet (Stufen 11–13). Der Transform nutzt den echten LLM-Aufruf, die Validierung nutzt validator.js + schema.js, der Export nutzt export.js mit Attribut-Bereinigung. Noch offen: Die View-Module (preview.js, editor.js, source.js) sind nicht in app.js eingebunden – die Vorschau nutzt Inline-HTML statt preview.js, der Editor nutzt contenteditable statt editor.js. Siehe [STATUS.md](STATUS.md).

**Abhängigkeiten:**
- [ARCHITECTURE.md](ARCHITECTURE.md) für Dokumentenmodell, Undo-System, LLM-Service
- [DESIGN.md](DESIGN.md) für Konfidenz-Farben, Annotationstyp-Farben, Komponenten

---

## 1. Epistemische Grundlage

Der Transform-Schritt ist der Moment der größten epistemischen Asymmetrie. Das LLM produziert Annotationen, die plausibel aussehen, aber nicht zuverlässig korrekt sind. Die Forschungsliteratur zu LLM-Judge-Bias (Position Bias, Self-Enhancement, Verbosity Bias) gilt hier in vollem Umfang.

Daraus folgen drei Designprinzipien für diesen Schritt.

**Kein automatischer Output.** Das Transform-Ergebnis wird nicht stillschweigend in das Dokument geschrieben, sondern dem Menschen zur Prüfung vorgelegt. Die gesamte Transformation bildet eine einzige Undo-Einheit.

**Konfidenz als Handlungsaufforderung.** Die Konfidenz-Kategorien (sicher, prüfenswert, problematisch) sind nicht Beschreibungen der Modellsicherheit, sondern Handlungsaufforderungen an den Menschen. "Prüfenswert" bedeutet "Du musst hier hinschauen", nicht "Das Modell ist sich zu 70% sicher".

**Zusammenfassung vor Detail.** Nach dem Transform sieht der Mensch zuerst eine Übersicht (was hat sich geändert, wie viel muss geprüft werden), bevor er in den zeilenweisen Review geht.

---

## 2. Dreischichten-Prompt-Architektur

Der an das LLM gesendete Prompt wird zur Laufzeit aus drei Schichten assembliert. Diese Trennung ermöglicht es, generische Regeln stabil zu halten, während quellenspezifische und projektspezifische Informationen flexibel angepasst werden.

### 2.1 Basisschicht (generisch)

Die Basisschicht enthält Anweisungen, die für jede TEI-Transformation gelten, unabhängig vom Quellentyp oder Projekt. Sie wird von teiCrafter verwaltet, nicht von der Nutzerin.

Inhalte der Basisschicht:
- Erzeuge wohlgeformtes TEI-XML
- Verändere keinen Textinhalt, nur die Markup-Struktur
- Setze `@confidence` als Attribut mit Wert "high", "medium" oder "low"
- Setze `@resp="#machine"` um maschinelle Annotationen zu kennzeichnen
- Wenn unsicher, annotiere nicht (Präzision vor Recall)
- Behalte alle bestehenden Annotationen bei
- Gib ausschließlich das annotierte TEI-XML zurück, keine Erklärungen

### 2.2 Kontextschicht (quellenspezifisch)

Die Kontextschicht enthält strukturierte Metadaten zur konkreten Quelle, die dem LLM helfen, informierte Annotationsentscheidungen zu treffen. Sie wird pro Dokument oder pro Projekt von der Nutzerin ausgefüllt.

Typische Kontextinformationen:
- Quellentyp (Korrespondenz, Druck, Handschrift, Rechnungsbuch)
- Datierung und Entstehungszeitraum
- Sprache(n) des Dokuments
- Schreiber/Verfasser
- Sammlung oder Archiv
- Projektkontext ("Briefwechsel Schiller/Goethe, 1794")

Ohne Kontextschicht produziert das LLM generische Annotationen. Mit Kontextschicht kann es informiertere Entscheidungen treffen, etwa ob "Weimar" in einem Schiller-Brief wahrscheinlich eine Ortsreferenz ist.

### 2.3 Mapping-Schicht (projektspezifisch)

Die Mapping-Schicht enthält die projektspezifischen Annotationsregeln als Markdown-Liste. Sie definiert, welche TEI-Elemente das LLM verwenden soll und was sie bedeuten. Die Mapping-Schicht ist das Herzstück der Nutzerkonfiguration, weil sie die editorischen Entscheidungen des Projekts formalisiert.

**Format.** Einfache Markdown-Liste, die Benutzerinnen in einem Textfeld konfigurieren.

```markdown
Mapping rules:
* <div> Entire letter
* <pb> Marks page breaks e.g. "|{n}|", multiple appearance possible
* <dateline> Date/time reference of the letter
* <date> in <dateline>
* <opener> Opening of the letter
* <closer> Closing of the letter
* <salute> Salutations within the letter
* <lb> Line breaks
* <signed> Signature section
* <postscript> Represents a postscript
* <bibl> Contains bibliographical references
* <p> Paragraphs
* <persName> Person
* <placeName> Place
* <orgName> Organisation
* <date> Dates; when={YYYY-MM-DD}
* <term> Languages
* <foreign> Words in the context of discussing linguistic phenomena
```

Vorlagen für verschiedene Projekttypen (Korrespondenzen, Drucke, Rechnungsbücher) werden mitgeliefert. Benutzerinnen passen diese für ihre spezifischen Anforderungen an.

### 2.4 Prompt-Transparenz

Der vollständige Prompt, der an das LLM gesendet wird, ist vor dem Absenden einsehbar (aufklappbare Sektion im Transform-Dialog). Das ist kein Feature für alle Nutzer, aber notwendig für die methodische Nachvollziehbarkeit und für fortgeschrittene Nutzer, die den Prompt iterativ verbessern wollen.

### 2.5 Custom Prompt

Fortgeschrittene Nutzer können den Default-Prompt vollständig überschreiben. In diesem Fall werden die drei Schichten durch einen frei formulierten Prompt ersetzt.

---

## 3. Vor dem Transform

### 3.1 Konfiguration

Der Transform-Dialog wird über den Workflow-Stepper oder einen Button im Editor ausgelöst.

| Einstellung | Typ | Default | Beschreibung |
|---|---|---|---|
| Modell | Dropdown | Letztes verwendetes | Gemini, OpenAI, Anthropic, Ollama |
| Annotationstypen | Checkboxes | Alle aus ODD-Profil | Welche Elemente soll das LLM annotieren |
| Dokumentkontext | Textarea (optional) | Leer | Kontextschicht: Zusätzlicher Kontext für das LLM |
| Beispielannotationen | Toggle (optional) | Aus | Wenn aktiviert, werden die ersten N bereits annotierten Zeilen als Few-Shot-Beispiel mitgegeben |
| Custom Prompt | Textarea (optional) | Default-Prompt | Für fortgeschrittene Nutzer |

---

## 4. Während des Transforms

### 4.1 Fortschrittsanzeige

| Phase | UI-Feedback |
|---|---|
| Prompt wird gesendet | Spinner im Stepper-Schritt "Transform", Editor ausgegraut (50% Opazität) |
| Antwort wird empfangen | Spinner bleibt, Statustext "Verarbeite Antwort..." |
| Parsing und Validierung | Statustext "Prüfe Ergebnis..." |
| Abgeschlossen | Stepper-Schritt wird Gold, Diff-Ansicht öffnet sich |

### 4.2 Abbruch

Der Transform kann jederzeit abgebrochen werden (Abort-Button oder Escape). Bei Abbruch wird das Dokumentenmodell nicht verändert.

### 4.3 Fehlerbehandlung

| Fehler | Anzeige | Aktion |
|---|---|---|
| Kein API-Key | Toast + Hinweis auf Einstellungen | Dialog bleibt offen |
| Netzwerkfehler | Toast mit Retry-Button | Automatischer Retry nach 2s, max 3 Versuche |
| Ungültige LLM-Antwort (kein valides XML) | Toast + Fehlerdetails | Option, die Rohantwort einzusehen |
| LLM-Antwort verändert Textinhalt | Warnung im Diff | Transform wird nicht automatisch angewandt, Nutzer entscheidet |

---

## 5. Nach dem Transform: Diff-Ansicht

### 5.1 Prinzip

Nach einem erfolgreichen Transform wird nicht sofort das Dokument überschrieben. Stattdessen öffnet sich eine Diff-Ansicht, die den Unterschied zwischen dem Zustand vor und nach dem Transform zeigt. Der Nutzer hat drei Optionen: Alles übernehmen, alles verwerfen, oder in den zeilenweisen Review gehen.

### 5.2 Diff-Darstellung

Die Diff-Ansicht ersetzt temporär den Editor-Bereich. Sie zeigt den annotierten Text (nicht das rohe XML), weil die meisten Nutzer die inhaltliche Veränderung prüfen wollen, nicht die Markup-Struktur.

```
┌──────────────────────────────────────────────────────────────┐
│  TRANSFORM-ERGEBNIS                     [Übernehmen] [Verwerfen]  │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  47 Annotationen erzeugt                                      │
│  ■■■■■■■■■■ 32 sicher  ■■■■ 12 prüfenswert  ■ 3 problematisch│
│                                                               │
│  [...] Schiller schrieb am 23. August an Goethe, er habe      │
│  das Manuskript gelesen und finde die Darstellung der         │
│  Italienischen Reise bemerkenswert. [...]                     │
│                                                               │
│  ──────── Annotationstypen ────────                           │
│  ● persName (8)  ● placeName (4)  ● date (6)  ● orgName (2)  │
│                                                               │
│                            [Review starten →]                 │
└──────────────────────────────────────────────────────────────┘
```

Neu annotierte Elemente sind farblich hervorgehoben (Unterstreichung + Konfidenz-Tint). Nicht veränderte Textpassagen bleiben in Standardfarbe.

### 5.3 Zusammenfassungsbalken

Der Balken oben zeigt auf einen Blick die Verteilung der Konfidenz-Kategorien. Grün (sicher), Gold (prüfenswert), Rot (problematisch). Proportional zur Anzahl. Das gibt dem Nutzer sofort eine Einschätzung, wie viel manuelle Arbeit bevorsteht.

### 5.4 Aktionen

| Aktion | Effekt |
|---|---|
| **Übernehmen** | Das Transform-Ergebnis wird als neue Dokumentversion ins Modell geschrieben. Alle Annotationen mit Status "sicher" gelten als akzeptiert. "Prüfenswert" und "problematisch" bleiben offen. Der Review-Modus wird aktiviert. |
| **Verwerfen** | Das Transform-Ergebnis wird komplett verworfen. Das Dokument bleibt unverändert. |
| **Review starten** | Identisch mit "Übernehmen", aber springt sofort zur ersten prüfenswerten Annotation. |

---

## 6. Review-Workflow

### 6.1 Integrierter Review (kein separater Modus)

Der Review ist kein eigener "Modus", sondern eine Schicht über der normalen Arbeitsoberfläche. Nach dem Transform (oder jederzeit, wenn prüfenswerte Annotationen existieren) sind die Review-Funktionen verfügbar. Der Nutzer kann jederzeit zwischen normalem Editieren und Review wechseln.

### 6.2 Review in der Vorschau

Annotationen mit Konfidenz "prüfenswert" oder "problematisch" zeigen beim Hover eine kompakte Aktionsleiste.

```
                    ┌──────────────┐
  ... schrieb am    │ 23. August   │  an Goethe ...
                    └──┬───────────┘
                       │ ✓ Accept  ✎ Edit  ✕ Reject
                       └────────────────────────────
```

| Aktion | Tastatur | Effekt |
|---|---|---|
| **Accept** | A | Annotation wird permanent. Konfidenz → "sicher". Review-Status → "akzeptiert". |
| **Edit** | E | Attribut-Tab öffnet sich mit den Attributen des Elements. Nach Bearbeitung gilt die Annotation als "editiert" (Konfidenz → "manuell"). |
| **Reject** | R | Annotation wird aus dem Dokument entfernt. Der Textinhalt bleibt erhalten. Review-Status → "verworfen". |

Alle drei Aktionen sind einzelne Undo-Einheiten.

### 6.3 Review im Editor

Im XML-Editor sind prüfenswerte Zeilen durch den Gutter-Marker (Gold für prüfenswert, Rot für problematisch) erkennbar. Ein Klick auf den Gutter-Marker einer Zeile springt zur entsprechenden Annotation in der Vorschau und öffnet den Attribut-Tab.

### 6.4 Batch-Review (Tastaturnavigation)

Für Dokumente mit vielen Annotationen (dutzende oder hunderte) ist ein mausbasierter Review zu langsam. Der Batch-Review ermöglicht es, alle prüfenswerten Annotationen sequentiell per Tastatur durchzugehen.

**Aktivierung.** N-Taste (nächste prüfenswerte Annotation) oder über den Zusammenfassungsbalken ("Review starten").

**Navigation.**

| Taste | Aktion |
|---|---|
| N | Nächste prüfenswerte/problematische Annotation |
| P | Vorige prüfenswerte/problematische Annotation |
| A | Accept (aktive Annotation) |
| R | Reject (aktive Annotation) |
| E | Edit (öffnet Attribut-Tab) |
| Escape | Batch-Review verlassen |

**Fortschrittsanzeige.** Während des Batch-Reviews zeigt ein kompakter Balken am oberen Rand der Vorschau den Fortschritt.

```
┌────────────────────────────────────────────┐
│  Review: 7 / 12 geprüft    ■■■■■■■░░░░░   │
│  [Filter: Alle ▾]                          │
└────────────────────────────────────────────┘
```

**Filter.** Der Review kann nach Konfidenz-Kategorie (nur prüfenswert, nur problematisch, alle) oder nach Annotationstyp (nur `<persName>`, nur `<date>` etc.) gefiltert werden.

### 6.5 Review-Status im Dokumentenmodell

| Status | Bedeutung | Visuell |
|---|---|---|
| Offen | Noch nicht geprüft | Konfidenz-Tint sichtbar, Hover-Aktionsleiste verfügbar |
| Akzeptiert | Annotation bestätigt | Konfidenz → sicher (grüner Tint), keine Aktionsleiste |
| Editiert | Annotation verändert und bestätigt | Konfidenz → manuell (kein Tint), keine Aktionsleiste |
| Verworfen | Annotation entfernt | Element gelöscht, Textinhalt erhalten |

Der Review-Status wird nicht in das TEI-XML exportiert. Er ist ein transientes Arbeitsinstrument. Im Export erscheinen nur die finalen Annotationen (ohne `@confidence`, ohne `@resp="#machine"`, es sei denn der Nutzer wünscht es).

---

## 7. Konfidenz-Mapping

### 7.1 LLM-Output → Konfidenz-Kategorie

Das LLM liefert `@confidence` mit den Werten "high", "medium", "low". Diese werden auf die kategoriale Konfidenz gemappt.

| LLM-Wert | Kategorie | Begründung |
|---|---|---|
| high | Sicher | Hohe Modellkonfidenz, trotzdem nicht blind übernommen |
| medium | Prüfenswert | Der häufigste Fall, erfordert menschliche Beurteilung |
| low | Problematisch | Modell signalisiert Unsicherheit, wahrscheinlich korrekturbedürftig |
| (fehlt) | Prüfenswert | Wenn das LLM kein Konfidenz-Attribut setzt, wird konservativ "prüfenswert" angenommen |

### 7.2 Warum nicht die LLM-Werte direkt anzeigen?

Die Forschung zu LLM-Kalibrierung zeigt, dass "high confidence" bei einem LLM nicht dasselbe bedeutet wie "high confidence" bei einem anderen LLM, und dass selbst innerhalb eines Modells die Kalibrierung über verschiedene Aufgaben hinweg inkonsistent ist. Die kategoriale Darstellung abstrahiert von dieser Inkonsistenz und fokussiert auf die Handlungskonsequenz: muss geprüft werden oder nicht.

---

## 8. Fünf Validierungsebenen

Die Validierung in teiCrafter ist nicht binär (valide/invalide), sondern ein gestuftes System aus fünf Ebenen, die unterschiedliche Aspekte der Qualität prüfen.

### 8.1 Ebene 1: Plaintext-Vergleich (automatisch)

Automatischer Abgleich der Textknoten im Output mit dem Input-Plaintext. Das LLM darf Markup hinzufügen, aber keinen Textinhalt verändern. Bei Abweichung wird die gesamte Transformation als fehlerhaft markiert. Dies ist die fundamentalste Qualitätsprüfung und muss immer bestehen.

### 8.2 Ebene 2: Schema-Validierung (automatisch)

Clientseitige Validierung gegen TEI-Schemata (RelaxNG, ODD). Prüft strukturelle Korrektheit: Sind die verwendeten Elemente erlaubt? Sind die Attribute korrekt? Sind die Verschachtelungen gültig? Unterstützte Schemata: TEI-All, DTA-Basisformat, projektspezifische ODDs.

### 8.3 Ebene 3: XPath-Regeln (automatisch)

Projektspezifische Constraints, die über die Schema-Validierung hinausgehen. Beispiele: "Jeder `<persName>` muss ein `@ref`-Attribut haben", "Jedes `<date>` muss ein `@when`-Attribut im ISO-Format haben". Diese Regeln werden pro Projekt konfiguriert und ergänzen die Schema-Validierung um inhaltliche Anforderungen.

### 8.4 Ebene 4: LLM-as-a-Judge (semi-automatisch, Phase 3)

Ergänzt die regelbasierte Prüfung um semantische Bewertung. Prüft inhaltliche Plausibilität ("Ist 'August' hier wirklich ein Monatsname oder ein Personenname?"), Entitätsklassifikation, Annotationsdichte und Konsistenz. Das LLM-Urteil steht nie isoliert, sondern immer in Kombination mit regelbasierten Prüfungen und menschlicher Beurteilung. Details zur LLM-as-a-Judge-Integration werden in Phase 3 spezifiziert.

### 8.5 Ebene 5: Expert-in-the-Loop (manuell)

Die menschliche Fachperson prüft inhaltliche Korrektheit, die keine automatische Prüfung leisten kann. Das ist der Review-Workflow (Abschnitt 6). Die Fachperson bringt Domänenwissen ein, das weder im Schema noch in XPath-Regeln noch im LLM abgebildet ist.

### 8.6 Zusammenspiel der Ebenen

| Ebene | Wann | Blockiert Export? |
|---|---|---|
| Plaintext-Vergleich | Sofort nach Transform | Ja (Transform wird als fehlerhaft markiert) |
| Schema-Validierung | Kontinuierlich, bei jeder Änderung | Nein (Warnung, kein Blocker) |
| XPath-Regeln | Kontinuierlich, bei jeder Änderung | Konfigurierbar (Warnung oder Blocker) |
| LLM-as-a-Judge | Auf Anfrage (Phase 3) | Nein (Empfehlung, kein Blocker) |
| Expert-in-the-Loop | Manuell, vor Export | Warnung bei ungeprüften Annotationen |

---

## 9. Visuelle Testmatrix

Vor der Implementierung sollte eine HTML-Seite erzeugt werden, die alle Annotationstyp-Konfidenz-Kombinationen als Swatches nebeneinander zeigt. Der Test prüft zwei Fragen.

**Unterscheidbarkeit.** Kann der Nutzer bei jeder Kombination den Annotationstyp (Unterstreichungsfarbe) vom Konfidenz-Status (Hintergrund-Tint) unterscheiden?

**Problemfälle.** Insbesondere `<date>` (Bernstein) auf "prüfenswert" (Bernstein-Tint) und `<placeName>` (Teal) auf "sicher" (Teal-Tint) sind Kandidaten für visuelles Zusammenfallen.

**Testmatrix-Struktur.**

|  | Sicher (grüner Tint) | Prüfenswert (Gold-Tint) | Problematisch (roter Tint) | Manuell (kein Tint) |
|---|---|---|---|---|
| `<persName>` (blau) | ● | ● | ● | ● |
| `<placeName>` (teal) | ●⚠ | ● | ● | ● |
| `<orgName>` (violett) | ● | ● | ● | ● |
| `<date>` (bernstein) | ● | ●⚠ | ● | ● |
| `<bibl>` (rosa) | ● | ● | ● | ● |
| `<term>` (grau) | ● | ● | ● | ● |

⚠ markiert die erwarteten Problemfälle. Falls die Testmatrix bestätigt, dass diese Kombinationen schlecht unterscheidbar sind, ist die Alternativkodierung über Unterstreichungsstil (solid = sicher, dashed = prüfenswert, dotted = problematisch) die Ausweichoption.

---

## 10. Export-Verhalten nach Review

### 10.1 Annotationsbereinigung

Beim Export werden die Transform-spezifischen Attribute entfernt.

| Attribut | Im Arbeitsdokument | Im Export |
|---|---|---|
| `@confidence` | "high", "medium", "low" | Entfernt (Standard) oder beibehalten (Option) |
| `@resp="#machine"` | Kennzeichnet LLM-Annotation | Entfernt (Standard) oder in `@resp="#[projectname]"` umgewandelt |
| Review-Status | Im Dokumentenmodell | Nicht exportiert (transient) |

### 10.2 Ungeprüfte Annotationen

Wenn beim Export noch offene (ungeprüfte) Annotationen existieren, erscheint eine Warnung. Der Nutzer kann entscheiden: Export mit offenen Annotationen (sie werden wie akzeptierte behandelt) oder zurück zum Review.

---

**Abhängigkeiten:**
- [ARCHITECTURE.md](ARCHITECTURE.md) für Dokumentenmodell, Undo, LLM-Service
- [DESIGN.md](DESIGN.md) für Farben, Komponenten, Tastaturnavigation
