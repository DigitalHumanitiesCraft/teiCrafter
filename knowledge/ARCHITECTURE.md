---
type: knowledge
created: 2026-02-05
updated: 2026-02-05
tags: [teicrafter, architecture, state, editor, odd]
status: active
---

# Technische Architektur

Systemdesign für teiCrafter. Client-only, kein Backend.

**Abhängigkeit:** [DESIGN.md](DESIGN.md) (visuelle Vorgaben), [WORKFLOW.md](WORKFLOW.md) (LLM-Integration und Review-Workflow)

---

## 1. Systemübersicht

```
┌──────────────────────────────────────────────────────────────┐
│                         BROWSER                               │
├──────────────────────────────────────────────────────────────┤
│  UI-SCHICHT                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │  Header  │  │  Source   │  │  Editor  │  │ Vorschau │     │
│  │ +Stepper │  │  Panel   │  │  (XML)   │  │ +Review  │     │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │
├──────────────────────────────────────────────────────────────┤
│  ANWENDUNGSSCHICHT                                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │ Document │  │ Schema   │  │Transform │  │  Export  │     │
│  │  Model   │  │  Engine  │  │  Service │  │  Service │     │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │
├──────────────────────────────────────────────────────────────┤
│  SERVICE-SCHICHT                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │  LLM API │  │ ODD      │  │ Validator│  │  Event   │     │
│  │          │  │ Parser   │  │          │  │  System  │     │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │
├──────────────────────────────────────────────────────────────┤
│  PERSISTENZ                                                   │
│  ┌──────────────────┐  ┌──────────────────────────────┐      │
│  │  LocalStorage    │  │       IndexedDB               │      │
│  │  (Settings,      │  │  (Dokumente, Sessions,        │      │
│  │   API Keys)      │  │   Undo-History)               │      │
│  └──────────────────┘  └──────────────────────────────┘      │
├──────────────────────────────────────────────────────────────┤
                              │ HTTPS
                              ▼
┌──────────────────────────────────────────────────────────────┐
│  EXTERNE APIs                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │  Gemini  │  │  OpenAI  │  │ Anthropic│  │  Ollama  │     │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. Reaktives Dokumentenmodell

### 2.1 Single Source of Truth

Alle Ansichten (XML-Editor, Vorschau, Validierung, Review, Attribut-Tab) sind Projektionen eines gemeinsamen Dokumentenmodells. Es gibt keine direkte Kommunikation zwischen den Ansichten. Jede Ansicht registriert sich als Beobachter (Observer) des Modells. Das verhindert Zyklen und garantiert Konsistenz.

### 2.2 Zustandsschichten

Das Dokumentenmodell hält vier Zustandsschichten, die gemeinsam eine Dokumentversion bilden.

| Schicht | Inhalt | Erzeugt durch | Verändert durch |
|---|---|---|---|
| **Dokument** | TEI-XML-Baum (kanonische Repräsentation) | Import, Transform | Editor, Review-Aktionen |
| **Konfidenz** | Konfidenz-Kategorie pro annotiertem Element (sicher, prüfenswert, problematisch, manuell) | Transform (LLM), manuelle Annotation | Review (Accept → sicher, Reject → entfernt, Edit → manuell) |
| **Validierung** | Liste von Nachrichten mit Dokumentpositionen | Schema-Prüfung (automatisch) | Neuberechnung bei Dokumentänderung |
| **Review-Status** | Pro prüfenswert/problematischem Element: offen/akzeptiert/editiert/verworfen | Transform (alles "offen") | Review-Aktionen |

### 2.3 Zustandspropagation

```
Benutzeraktion (Editor oder Vorschau)
        │
        ▼
  Dokumentmodell (neue Version)
        │
        ├──▶ XML-Editor: Syntax-Highlighting aktualisieren
        ├──▶ Vorschau: Text und Annotationen neu rendern
        ├──▶ Validierung: Schema-Prüfung auslösen
        └──▶ Review: Status aktualisieren
```

Die Validierungsschicht wird bei jeder Dokumentänderung neu berechnet, unterbricht aber niemals das Editieren. Invalide Zustände sind während des Editierens normal und werden toleriert. Fehler werden visuell markiert, blockieren aber keine Aktionen.

### 2.4 Implementierungsmuster

Das Dokumentenmodell wird als Klasse implementiert, die EventTarget erweitert (natives Browser-API, keine Bibliothek). Jede Zustandsänderung feuert ein typisiertes Event.

| Event | Payload | Auslöser |
|---|---|---|
| `documentChanged` | `{ version }` | Jede Änderung am XML-Baum |
| `selectionChanged` | `{ element, line }` | Klick im Editor oder Vorschau |
| `confidenceChanged` | `{ elementId, category }` | Review-Aktion |
| `validationComplete` | `{ messages[] }` | Schema-Prüfung abgeschlossen |
| `reviewAction` | `{ elementId, action }` | Accept/Edit/Reject |
| `transformComplete` | `{ annotationCount, reviewCount }` | LLM-Annotation abgeschlossen |
| `undoRedo` | `{ direction, version }` | Undo oder Redo |

---

## 3. Undo/Redo

### 3.1 Prinzip

Das Undo-System operiert auf dem Dokumentenmodell, nicht auf der UI-Ebene. Das ist notwendig, weil eine einzelne Aktion (etwa Accept im Review) gleichzeitig den XML-Baum (Annotation wird permanent), die Konfidenz-Schicht (Status wechselt zu "sicher") und den Review-Status (wechselt zu "akzeptiert") verändert. Undo muss alle drei Schichten gemeinsam zurücksetzen.

### 3.2 Implementierung

Jede Benutzeraktion, die den Dokumentzustand verändert, erzeugt einen Snapshot des gesamten Modells (Dokument + Konfidenz + Review-Status) auf dem Undo-Stack. Ein Undo-Schritt stellt den vorherigen Snapshot wieder her.

### 3.3 Gruppierung

| Aktionstyp | Gruppierung |
|---|---|
| Einzelne Tastendrücke im Editor | Zusammengefasst zu Wort-Einheiten (Pause >500ms oder Whitespace trennt) |
| Accept/Edit/Reject einzelner Annotation | Einzelne Undo-Einheit |
| Transform (LLM-Annotation des gesamten Dokuments) | Eine einzige Undo-Einheit, damit der Nutzer die gesamte Transformation mit einem Schritt rückgängig machen kann |

### 3.4 Speicherlimit

Der Undo-Stack hält maximal 100 Einträge. Bei Überschreitung wird der älteste Eintrag verworfen. Für große Dokumente (>1000 Zeilen) kann die Snapshot-Größe relevant werden. In diesem Fall kann ein Diff-basiertes Undo-System evaluiert werden. Für den Prototyp reicht die Snapshot-Variante.

---

## 4. Editor-Entscheidung

### 4.1 Anforderungen

| Anforderung | Priorität | Komplexität |
|---|---|---|
| Syntax-Highlighting für XML | Hoch | Niedrig |
| Konfidenz-Marker im Gutter (3px farbiger Rand pro Zeile) | Hoch | Mittel |
| Cursor-Kopplung mit Vorschau (Klick → Scroll) | Hoch | Mittel |
| Schema-Autovervollständigung (kontextsensitiv) | Mittel | Hoch |
| Inline-Validierung (Unterstreichung invalider Elemente) | Mittel | Mittel |
| Zeilennummern | Hoch | Niedrig |
| Undo/Redo (an Dokumentmodell gekoppelt) | Hoch | Mittel |
| Performance bei Dokumenten >500 Zeilen | Hoch | Variiert |

### 4.2 Optionen

**Option A: Overlay-Technik.** Transparentes Textarea über farbigem Pre-Element. Eigener XML-Tokenizer.

| Vorteil | Risiko |
|---|---|
| Keine Abhängigkeiten | Scroll-Drift bei langen Dokumenten |
| Volle Kontrolle über Rendering | Cursor-Position-Mapping zwischen Textarea und Pre aufwändig |
| Konsistent mit Vanilla-JS-Philosophie | Autovervollständigung-Positionierung komplex |
| | Performance bei >500 Zeilen unklar |

**Option B: CodeMirror 6.** Modularer Editor mit eigenem Extension-System.

| Vorteil | Risiko |
|---|---|
| Bewährt für Code-Editoren | Abhängigkeit (~150KB) |
| Eigene Tokenizer integrierbar | Lernkurve für Extension-API |
| Gutter, Autovervollständigung, Inline-Deko eingebaut | Weniger Kontrolle über Rendering-Details |
| Performance für große Dokumente optimiert | Möglicherweise Konflikte mit eigenem State-System |

**Option C: ContentEditable.** Direkte DOM-Manipulation in einem editierbaren Div.

| Vorteil | Risiko |
|---|---|
| Natürliches Cursor-Verhalten | Browser-Inkonsistenzen (Zeilenumbrüche, Formatierung) |
| Direkter Zugriff auf DOM-Elemente | Unkontrolliertes HTML bei Paste |
| Einfache Cursor-Position-Ermittlung | Eigene Selektion-Logik notwendig |
| | Schwer debuggbar |

### 4.3 Empfehlung

**Für den Prototyp (Wochen).** Option A (Overlay) mit Einschränkung auf Dokumente <200 Zeilen und ohne Schema-Autovervollständigung. Das genügt, um den Transform-Workflow und das Review-UX zu testen. Der eigene XML-Tokenizer wird unabhängig davon gebraucht, weil er auch die Vorschau und die Konfidenz-Marker antreibt.

**Für das Produkt (Monate).** Option B (CodeMirror 6) mit eigenem XML-Tokenizer als Language Support. Die Schema-Autovervollständigung wird als CodeMirror-Extension implementiert. Der Gutter mit Konfidenz-Markern nutzt CodeMirrors Gutter-API. Die Cursor-Kopplung zur Vorschau ist über CodeMirrors View-Update-System lösbar.

**Nicht empfohlen.** Option C (ContentEditable) wegen der Browser-Inkonsistenzen und der Schwierigkeit, einen konsistenten Zustand zwischen DOM und Dokumentenmodell zu halten.

### 4.4 Spike-Kriterium

Bevor die endgültige Entscheidung fällt, sollte ein Spike die Overlay-Technik mit einem TEI-Dokument von 500 Zeilen testen. Wenn Scroll-Drift oder Cursor-Mapping-Probleme auftreten, wechselt die Empfehlung zu CodeMirror 6.

---

## 5. XML-Tokenizer

Unabhängig von der Editor-Entscheidung wird ein eigener XML-Tokenizer benötigt, der Token-Typen für das Syntax-Highlighting und für die Konfidenz-Integration liefert.

### 5.1 Token-Typen

| Typ | Beispiele | Beschreibung |
|---|---|---|
| `element` | `TEI`, `persName`, `p` | Element-Name innerhalb eines Tags |
| `attrName` | `ref`, `when`, `type` | Attribut-Name |
| `attrValue` | `"#schiller"`, `"1794-08-23"` | Attribut-Wert (inkl. Anführungszeichen) |
| `delimiter` | `<`, `>`, `/>`, `=`, `</` | XML-Strukturzeichen |
| `comment` | `<!-- ... -->` | Kommentare |
| `pi` | `<?xml ... ?>` | Processing Instructions |
| `namespace` | `xmlns`, `tei:` | Namespace-Deklarationen und -Präfixe |
| `entity` | `&amp;`, `&lt;` | Entity-Referenzen |
| `text` | Zeichendaten | Textinhalt zwischen Tags |

### 5.2 Implementierungsprinzip

Der Tokenizer arbeitet zeichenweise und zustandsbasiert (State Machine). Er ist als reine Funktion implementiert, die einen String entgegennimmt und ein Array von `{ type, value, start, end }` zurückgibt. Kein DOM-Zugriff, keine Seiteneffekte. Das erlaubt die Wiederverwendung in Editor, Vorschau und Tests.

### 5.3 Konfidenz-Zuordnung

Der Tokenizer selbst kennt keine Konfidenz. Die Zuordnung geschieht in einer nachgelagerten Schicht, die Token-Positionen gegen die Konfidenz-Annotationen im Dokumentenmodell abgleicht. Pro Zeile wird die "dominante" Konfidenz-Kategorie ermittelt (problematisch > prüfenswert > sicher > manuell > keine), die den Gutter-Marker bestimmt.

---

## 6. Schema-Führung (ODD-basiert)

### 6.1 Prinzip

Das ODD-Format (*One Document Does it all*) definiert das gültige TEI-Subset eines Projekts. Die Schema-Führung nutzt dieses ODD, um kontextsensitiv anzuzeigen, was an jeder Stelle im Dokument erlaubt ist.

### 6.2 Zwei-Stufen-Strategie

**Stufe 1 (Prototyp).** Hardcodierte Schema-Führung für ein konkretes ODD-Profil (z.B. DTABf oder ein Korrespondenz-Subset). Das Profil wird als JSON-Lookup implementiert.

```json
{
  "teiHeader": {
    "allowedChildren": ["fileDesc", "encodingDesc", "profileDesc", "revisionDesc"],
    "attributes": {}
  },
  "persName": {
    "allowedParents": ["p", "ab", "seg", "name", "author"],
    "attributes": {
      "ref": { "type": "text", "description": "Referenz auf Personenregister" },
      "key": { "type": "text" },
      "type": { "type": "closed", "values": ["person", "mythological", "biblical"] }
    }
  }
}
```

Das erlaubt es, die UX der Autovervollständigung und der Inline-Validierung frühzeitig zu testen, ohne das ODD-Parsing-Problem gelöst zu haben.

**Stufe 2 (Produkt).** Clientseitiges ODD-Parsing. ODD-Dateien sind selbst TEI-XML und definieren über `<elementSpec>`, `<classSpec>` und `<constraintSpec>`, welche Elemente, Attribute und Werte erlaubt sind. Das Parsing erzeugt das gleiche JSON-Lookup-Format wie Stufe 1. Die Herausforderung liegt in der Auflösung von Vererbungshierarchien (`<memberOf>`, `<classes>`) und der korrekten Interpretation von `@mode` (add/delete/change/replace).

### 6.3 Manifestationen

| Ort | Verhalten |
|---|---|
| Editor | Autovervollständigung bei `<` und bei Attributnamen. Tooltips mit Elementdokumentation. |
| Attribut-Tab | Formularfelder aus Schema generiert. Pflichtattribute markiert. Geschlossene Wertelisten als Dropdowns. |
| Vorschau | (Zukunft) Beim Selektieren von Text zeigt die Schema-Führung nur erlaubte Elemente an. |
| Validierung | Live, unterbricht nie das Editieren. Invalide Zustände werden toleriert. |

---

## 7. LLM-Integration

### 7.1 Provider

| Provider | Endpunkt | Authentifizierung | Vision |
|---|---|---|---|
| Gemini | generativelanguage.googleapis.com | URL-Parameter | Ja |
| OpenAI | api.openai.com | Bearer Token | Ja |
| Anthropic | api.anthropic.com | x-api-key Header | Ja |
| Ollama | localhost:11434 | Keine (lokal) | Modellabhängig |

### 7.2 API-Key-Handling

Identisch zum [[coOCR HTR]]-Sicherheitsmodell. Keys im Browser-Memory, kein localStorage, kein Backend. Flüchtig (Tab schließen = weg). DevTools-sichtbar. Ollama als komplett lokale Alternative.

### 7.3 Transform-Service

Der LLM-Service für teiCrafter führt Named Entity Recognition und TEI-Annotation auf bestehendem Text durch. Die Details des Prompts, der Konfiguration und der Ergebnisverarbeitung sind in [WORKFLOW.md](WORKFLOW.md) spezifiziert.

Der Service liefert zwei Outputs. Erstens, den annotierten TEI-XML-Baum. Zweitens, eine Konfidenz-Zuordnung pro eingefügter Annotation (sicher, prüfenswert, problematisch). Beide werden als neue Version ins Dokumentenmodell geschrieben und bilden eine einzelne Undo-Einheit.

---

## 8. Dateistruktur

```
docs/
├── index.html              # Entry Point, Drei-Spalten-Layout
├── css/
│   └── style.css           # TEI-Farbsystem, Fonts, alle Komponenten
├── js/
│   ├── app.js              # Initialisierung, Workflow-Stepper
│   ├── model.js            # Reaktives Dokumentenmodell, Undo/Redo
│   ├── tokenizer.js        # XML-Tokenizer (reine Funktion)
│   ├── editor.js           # XML-Editor (Overlay oder CodeMirror-Wrapper)
│   ├── preview.js          # Interaktive Vorschau + Review
│   ├── source.js           # Source-Panel (Plaintext, Digitalisat)
│   ├── services/
│   │   ├── llm.js          # Multi-Provider LLM-Service
│   │   ├── transform.js    # Transform-Logik (Prompt, Parsing, Konfidenz)
│   │   ├── schema.js       # ODD-basierte Schema-Führung
│   │   ├── validator.js    # Schema-Validierung
│   │   ├── export.js       # Export-Service (TEI-XML, TXT)
│   │   └── storage.js      # LocalStorage/IndexedDB-Wrapper
│   └── utils/
│       ├── constants.js    # Konfigurationswerte
│       └── dom.js          # DOM-Utilities
├── schemas/
│   └── dtabf.json          # Hardcodiertes Schema-Profil (Stufe 1)
├── samples/
│   └── ...                 # Beispiel-TEI-Dokumente
└── tests/
    ├── tokenizer.test.js
    ├── model.test.js
    ├── transform.test.js
    └── validator.test.js
```

---

## 9. Technologie-Entscheidungen

| Entscheidung | Begründung |
|---|---|
| Kein Framework | Reduziert Komplexität, verbessert Langlebigkeit |
| ES6 Modules | Nativer Browser-Support, kein Bundler |
| EventTarget für State | Native API, DevTools-Integration, kein eigener Event-Bus |
| CSS Custom Properties | Theming ohne Präprozessor |
| Fetch API | Nativ, ausreichend für REST |
| Kein Backend | Datensouveränität, keine Hosting-Kosten, Ollama als lokale Option |

### Ausnahme-Kandidat: CodeMirror 6

Falls die Editor-Entscheidung (Abschnitt 4) zu CodeMirror 6 führt, wäre das die einzige externe Abhängigkeit (~150KB). Diese Ausnahme ist gerechtfertigt, weil der Editor die kritischste Komponente ist und die Eigenentwicklung der Autovervollständigung, des Gutters und der Performance-Optimierung den Aufwand einer Bibliothek übersteigt.

---

## 10. Datenflüsse

### Import → Transform → Review → Export

```
TEI-XML Import
      │
      ▼
  Dokumentmodell (Version 0: Quelltext)
      │
      ▼
  [Transform: LLM-Annotation]
      │
      ▼
  Dokumentmodell (Version 1: annotiert, mit Konfidenz)
      │
      ▼
  [Review: Accept/Edit/Reject pro Annotation]
      │
      ▼
  Dokumentmodell (Version N: geprüft)
      │
      ▼
  Export (TEI-XML, ohne Konfidenz-Metadaten)
```

### Synchronisationsfluss

```
Benutzer klickt Annotation in Vorschau
       │
   preview.onClick(elementId)
       │
   model.setSelection(elementId)
       │
   Event: 'selectionChanged'
       │
   ┌───┴───────────┬────────────────┐
   ▼               ▼                ▼
 Editor          Vorschau        Attribut-Tab
 .scrollToLine() .highlight()    .showAttributes()
 .setCursor()    (Quelle)
```

---

**Abhängigkeiten:**
- [DESIGN.md](DESIGN.md) für visuelle Vorgaben
- [WORKFLOW.md](WORKFLOW.md) für LLM-Integration und Review-Workflow
