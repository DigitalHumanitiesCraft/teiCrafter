---
type: knowledge
created: 2026-02-05
updated: 2026-02-05
tags: [teicrafter, design, ui, color, typography]
status: active
---

# Design Specification

Visuelle Spezifikation für teiCrafter. Definiert Farben, Typografie, Layout, Komponenten und Interaktionsmuster. Architektonische Entscheidungen (Datenmodell, State Management, Editor-Engine) sind in [ARCHITECTURE.md](ARCHITECTURE.md) dokumentiert. Der Annotations- und Review-Workflow ist in [WORKFLOW.md](WORKFLOW.md) spezifiziert.

---

## 1. Designhaltung

### Zielgruppe

Forschende in den Digital Humanities, die TEI-XML-Dokumente annotieren und korrigieren. Sie sind Expert\*innen für ihre Quellen (Briefe, Editionen, Bibliografien), aber nicht notwendigerweise für TEI-Encoding. Das Interface muss Domänenwissen respektieren und technische Komplexität verbergen, wo sie nicht handlungsrelevant ist.

### Leitprinzipien

| Prinzip | Bedeutung | Was es *nicht* bedeutet |
|---|---|---|
| Lesbarkeit | Positive Polarität, optimiert für lange Sitzungen | Nicht blass oder kontrastarm |
| Orientierung | Klare Hierarchie durch Farbe, Typografie, Position | Nicht überladen mit Indikatoren |
| Handlungsfähigkeit | Visuelle Trennung von Information und Aktion | Nicht alles ist klickbar |
| Präzision | Geometrische Strenge, flache Oberflächen, 8px-Grid | Nicht neon, nicht glasmorphistisch, nicht dekorativ |

### Visuelle Identität

Die Ästhetik leitet sich aus der TEI-Consortium-Identität ab (Navyblau, Bernstein-Gold, Schwarz) und kombiniert sie mit einer akademisch-editorischen Anmutung. Warme Töne, nicht kalt-technisch. Clean, nicht steril. Das Ergebnis soll an ein präzises Arbeitsinstrument erinnern, nicht an ein Dashboard oder eine Marketing-Seite.

---

## 2. Farbsystem

### 2.1 Strukturfarben

| Rolle | Hex | CSS Variable | Verwendung |
|---|---|---|---|
| Arbeitsfläche | `#FAFAF7` | `--color-surface` | Seitenhintergrund |
| Panel | `#FFFFFF` | `--color-panel` | Editor, Source-Panel |
| Sekundärfläche | `#F2F4F8` | `--color-secondary` | Vorschau-Panel, Footer, aktive Zeile |
| Kopfzeile | `#1E3A5F` | `--color-header` | Header-Hintergrund (TEI-Navy) |
| Rahmenlinien | `#D0D4DC` | `--color-border` | Panel-Ränder, Trennlinien |
| Gutter | `#F8F9FB` | `--color-gutter` | Zeilennummern-Hintergrund |

### 2.2 Akzentfarben

| Rolle | Hex | CSS Variable | Verwendung |
|---|---|---|---|
| Gold (primär) | `#CC8A1E` | `--color-gold` | Aktive Stepper-Schritte, Focus-Ring, Logo-Akzent |
| Gold (hell) | `#F5DEB3` | `--color-gold-light` | Hover-Hintergründe |
| Gold (hover) | `#B57A18` | `--color-gold-hover` | Button-Hover |
| Blau (sekundär) | `#2B5EA7` | `--color-blue` | Links, sekundäre Aktionen |
| Blau (hell) | `#E3EDF7` | `--color-blue-light` | Ausgewählte Elemente |

### 2.3 Textfarben

| Rolle | Hex | CSS Variable |
|---|---|---|
| Primär | `#1A1A1A` | `--color-text` |
| Sekundär | `#5A6270` | `--color-text-secondary` |
| Gedämpft | `#8899AA` | `--color-text-muted` |
| Invers (auf Navy) | `#FFFFFF` | `--color-text-inverse` |

### 2.4 Konfidenz-Kategorien (Dual-Channel-Encoding)

Konfidenz wird über Hintergrund-Tint kodiert. Annotationstyp wird über Unterstreichung kodiert. Die beiden Kanäle sind orthogonal, d.h. sie kodieren unabhängige Informationen und können frei kombiniert werden.

| Kategorie | Rand-Farbe | Tint-Farbe | CSS Variablen | Semantik |
|---|---|---|---|---|
| Sicher | `#2D8A70` | `#E8F5F0` | `--color-confident`, `--color-confident-tint` | Bestätigt oder hohe LLM-Konfidenz |
| Prüfenswert | `#CC8A1E` | `#FEF5E7` | `--color-review`, `--color-review-tint` | Menschliche Prüfung erforderlich |
| Problematisch | `#C0392B` | `#FDECEB` | `--color-problem`, `--color-problem-tint` | Validierungsfehler oder niedrige Konfidenz |
| Manuell | `#5A6270` | transparent | `--color-manual` | Vom Menschen erzeugt, keine LLM-Konfidenz-Bewertung |

Die vierte Kategorie "Manuell" existiert, weil menschlich erzeugte Annotationen keine LLM-Konfidenz haben. "Sicher" wäre semantisch falsch, weil es im System "das LLM war sich sicher" bedeutet, nicht "das ist korrekt". Manuelle Annotationen tragen nur die Annotationstyp-Farbe (Unterstreichung), keinen Konfidenz-Hintergrund.

### 2.5 Annotationstyp-Farben

Unterstreichungen (2px solid), unabhängig von Konfidenz-Hintergrund.

| TEI-Element | Hex | Hintergrund | CSS Variable |
|---|---|---|---|
| `<persName>` | `#3B7DD8` | `#EBF2FC` | `--color-persName` |
| `<placeName>` | `#2A9D8F` | `#E6F5F3` | `--color-placeName` |
| `<orgName>` | `#7B68AE` | `#F0EDF6` | `--color-orgName` |
| `<date>` | `#B8860B` | `#FDF6E3` | `--color-date` |
| `<bibl>` | `#C47A8A` | `#FAF0F2` | `--color-bibl` |
| `<term>` | `#6B7280` | `#F3F4F6` | `--color-term` |

**Bekanntes Spannungsfeld.** Einige Typ-Konfidenz-Kombinationen erzeugen geringen Kontrast zwischen den Kanälen, insbesondere `<date>` (Bernstein) auf "prüfenswert" (Bernstein-Tint) und `<placeName>` (Teal) auf "sicher" (Teal-Tint). Dieses Problem muss im Prototyping empirisch getestet werden. Falls die Unterscheidbarkeit nicht ausreicht, wäre eine Kodierung der Konfidenz über Unterstreichungsstil (solid/dashed/dotted) statt über Hintergrund-Tint eine Alternative. Siehe [WORKFLOW.md](WORKFLOW.md) für die visuelle Testmatrix.

### 2.6 Syntax-Highlighting

Heller Modus, konsistent mit der Gesamtentscheidung für positive Polarität.

| Token-Typ | Hex | CSS Variable | Beispiele |
|---|---|---|---|
| Element-Name | `#1E3A5F` | `--syntax-element` | `TEI`, `persName`, `p` |
| Attribut-Name | `#2A9D8F` | `--syntax-attr` | `ref`, `when`, `type` |
| Attribut-Wert | `#B8860B` | `--syntax-value` | `"#schiller"`, `"1794-08-23"` |
| Delimiters | `#5A6270` | `--syntax-delimiter` | `<` `>` `/` `=` `?>` |
| Kommentare | `#9AA5B4` | `--syntax-comment` | `<!-- ... -->` |
| Processing Instructions | `#7B68AE` | `--syntax-pi` | `<?xml ... ?>` |
| Namespace | `#C47A8A` | `--syntax-namespace` | `xmlns`, `tei:` |
| Entity-Referenz | `#2B5EA7` | `--syntax-entity` | `&amp;`, `&lt;` |
| Textinhalt | `#1A1A1A` | `--syntax-text` | Zeichendaten |

---

## 3. Typografie

### Font-Stack

| Rolle | Font | Fallback | Verwendung |
|---|---|---|---|
| UI-Text | Inter | system-ui, -apple-system, sans-serif | Interface-Elemente, Labels, Buttons |
| Code/XML | JetBrains Mono | Consolas, Monaco, monospace | Editor, Transkription, Zeilennummern |
| Logo | JetBrains Mono | monospace | `[ tei Crafter ]` |

### Schriftgrößen

Alle Größen im 8px-Grid.

| Element | Größe | Gewicht | Zeilenhöhe | Verwendung |
|---|---|---|---|---|
| Logo | 18px | 600 | 24px | Header |
| Panel-Titel | 14px | 600 | 20px | Panel-Überschriften |
| Fließtext | 14px | 400 | 22px | UI-Text, Beschreibungen |
| Code | 13px | 400 | 20px | XML-Editor, Plaintext |
| Badges/Labels | 12px | 500 | 16px | Konfidenz-Badges, Entity-Labels |
| Footer | 12px | 400 | 16px | Statusleiste |

---

## 4. Layout

### Drei-Spalten-Struktur

```
┌──────────────────────────────────────────────────────────────────────────┐
│  HEADER (48px)    [ teiCrafter ]   Workflow-Stepper          LLM-Badge  │
├───────────────┬───────────────────────────┬──────────────────────────────┤
│  SOURCE       │  XML-EDITOR               │  VORSCHAU + REVIEW           │
│  ~25%         │  ~45%                     │  ~30%                        │
│               │                           │                              │
│  Tabs:        │  Gutter + Code            │  Tabs:                       │
│  [Plaintext]  │  Konfidenz-Marker         │  [Vorschau + Review]         │
│  [Digitalisat]│  Schema-Führung           │  [Validierung]               │
│               │                           │  [Attribute]                 │
├───────────────┴───────────────────────────┴──────────────────────────────┤
│  FOOTER (28px)   Dateiname · Schema · Zeilen · Mapping · Validierung     │
└──────────────────────────────────────────────────────────────────────────┘
```

### Panel-Proportionen und Responsive-Verhalten

| Viewport | Layout | Bemerkung |
|---|---|---|
| >1200px | 25% / 45% / 30% | Drei Spalten, resizeable |
| 768–1200px | Zwei Spalten, Source-Panel einklappbar | Editor + Vorschau priorisiert |
| <768px | Eine Spalte, Tab-Navigation | Eingeschränkte Funktionalität |

### Z-Index-Schichten

| Schicht | Wert | Inhalt |
|---|---|---|
| Base | 0 | Panels, Inhalt |
| Toolbar | 10 | Editor-Werkzeugleiste |
| Dropdown | 100 | Autovervollständigung, Menüs |
| Modal | 200 | Dialoge |
| Toast | 300 | Benachrichtigungen |

### Spacing

8px-Grid. Alle Abstände sind Vielfache von 4px.

| Token | Wert | Verwendung |
|---|---|---|
| `--space-1` | 4px | Enge Abstände, Icon-Gaps |
| `--space-2` | 8px | Standard-Padding |
| `--space-3` | 12px | Panel-Innenabstand |
| `--space-4` | 16px | Abschnittswechsel |
| `--space-6` | 24px | Große Abstände |

---

## 5. Komponenten

### 5.1 Header

| Eigenschaft | Wert |
|---|---|
| Höhe | 48px |
| Hintergrund | `--color-header` (#1E3A5F) |
| Logo | `[ tei Crafter ]` in JetBrains Mono, "Crafter" in Gold |
| Stepper | 5 Schritte, aktiver in `[ Klammern ]` + Gold |
| LLM-Badge | Monospace, grüner Punkt = bereit, grauer Punkt = nicht konfiguriert |

### 5.2 Workflow-Stepper

```
○─────○─────●─────○─────○
Import  Mapping  Transform  Validate  Export
```

| Zustand | Visuell |
|---|---|
| Abgeschlossen | ✓ + Gold-Verbindungslinie |
| Aktiv | `[ Label ]` in Gold |
| Ausstehend | Gedämpfte Farbe (`--color-text-muted`) |

Inhaltlich definiert der Stepper die Schritte, nicht die Datenflüsse. Für den Transform-Schritt siehe [WORKFLOW.md](WORKFLOW.md).

### 5.3 Source-Panel (links, 25%)

**Zwei Tabs.**

**Plaintext.** Extrahierter Klartext aus dem TEI-Body, Monospace-Darstellung, read-only. Dient zum schnellen Vergleich mit dem annotierten XML.

**Digitalisat.** Bild des Originaldokuments, falls beim Import mitgegeben. Zoom/Pan für den Vergleich mit der Transkription.

### 5.4 XML-Editor (Mitte, 45%)

Der XML-Editor ist der Hauptarbeitsbereich. Die technische Implementierung (Editor-Engine, Tokenizer, Rendering) ist in [ARCHITECTURE.md](ARCHITECTURE.md) beschrieben. Hier nur die visuellen Anforderungen.

**Gutter.** 48px breit, Hintergrund `--color-gutter`. Zeilennummern rechtsbündig in `--color-text-muted`. Konfidenz-Marker als 3px linker Rand pro Zeile, Farbe aus der dominanten Konfidenz-Kategorie der Annotationen in dieser Zeile. Zeilen ohne Annotationen haben keinen Marker.

**Aktive Zeile.** Hintergrund `--color-secondary` (#F2F4F8), subtil.

**Schema-Autovervollständigung.** Dropdown mit `--color-panel`-Hintergrund, `--color-border`-Rand, max 8 Einträge sichtbar, scrollbar. Verschwindet bei Escape oder Klick außerhalb.

**Inline-Validierung.** Invalide Elemente erhalten eine Unterstreichung in `--color-problem`. Nicht blockierend, invalide Zustände werden während des Editierens toleriert.

### 5.5 Rechtes Panel (30%)

**Drei Tabs.**

**Vorschau + Review (integriert).** Der TEI-Body als lesbarer Text. Inline-Elemente als farbkodierte Spans (Unterstreichung = Typ, Hintergrund = Konfidenz). Klickbare Annotationen (öffnen Attribut-Tab, scrollen Editor zur Zeile). Prüfenswerte und problematische Elemente zeigen beim Hover eine Aktionsleiste: ✓ Accept, ✎ Edit, ✕ Reject. Metadaten-Header dynamisch aus `teiHeader`. Entity-Legende dynamisch (nur verwendete Typen). Für den Review-Workflow siehe [WORKFLOW.md](WORKFLOW.md).

**Validierung.** Validierungsliste mit klickbaren Zeilenreferenzen. Badges für Success/Warning/Error. Live-Aktualisierung.

**Attribute.** Beim Anklicken eines Elements (Editor oder Vorschau) dessen Attribute als Formularfelder. Elementname als farbkodierter Badge. Geschlossene Wertelisten als Dropdowns (aus ODD). Freitext-Attribute als Eingabefelder mit Validierung. Referenz-Felder (`@ref`, `@key`) mit Suchfunktion (wenn Register verfügbar).

### 5.6 Footer (Statusleiste)

| Eigenschaft | Wert |
|---|---|
| Höhe | 28px |
| Hintergrund | `--color-secondary` |
| Inhalt | Dateiname · Schema · Zeilenanzahl · Mapping-Typ · Validierungsstatus |

### 5.7 Toast-Benachrichtigungen

Position unten rechts, 16px vom Rand. 3px linker Rand in Statusfarbe. Slide-in von rechts (300ms ease-out). Standard 4s, wichtige Meldungen 8s.

### 5.8 Dialoge

520px breit (max 90vw). Hintergrund `--color-panel`. Rand 1px `--color-border`. Border-radius 8px. Backdrop `rgba(30, 58, 95, 0.6)` mit 4px Blur (Navy-Ton statt Schwarz, konsistent mit Header).

---

## 6. Interaktion

### Synchronisation

Alle Panels projizieren denselben Dokumentzustand (siehe [ARCHITECTURE.md](ARCHITECTURE.md) für das technische Modell). Visuell bedeutet das: eine Selektion in einem Panel aktualisiert die anderen.

| Aktion | Editor | Vorschau | Source |
|---|---|---|---|
| Klick auf Annotation in Vorschau | Scrollt zur Zeile, Cursor positioniert | Annotation ausgewählt | Scrollt zur entsprechenden Textstelle |
| Cursor auf Element im Editor | Aktive Zeile markiert | Annotation hervorgehoben | — |
| Klick auf Validierungsfehler | Scrollt zur Zeile | Fehlerhafte Stelle hervorgehoben | — |

### Tastaturnavigation

| Taste | Aktion | Kontext |
|---|---|---|
| Tab | Zwischen Panels wechseln | Global |
| ↑/↓ | Zeilen navigieren | Editor |
| Enter/Space | Aktion ausführen | Buttons, Stepper |
| Escape | Dropdown/Dialog schließen | Editor, Dialoge |
| Ctrl+Z / Ctrl+Y | Undo/Redo (auf Dokumentebene) | Global |
| Ctrl+Space | Schema-Autovervollständigung | Editor |
| N / P | Nächste/vorige prüfenswerte Annotation | Review-Modus |
| A | Accept (aktive Annotation) | Review-Modus |
| E | Edit (aktive Annotation) | Review-Modus |
| R | Reject (aktive Annotation) | Review-Modus |

### Focus-Styles

```css
:focus-visible {
    outline: 2px solid var(--color-gold);
    outline-offset: 2px;
}
```

---

## 7. Accessibility

### Farbkontraste (WCAG 2.1 AA)

| Kombination | Kontrast | Status |
|---|---|---|
| Text (#1A1A1A) auf Arbeitsfläche (#FAFAF7) | 15.8:1 | ✓ |
| Gold (#CC8A1E) auf Navy (#1E3A5F) | 4.8:1 | ✓ |
| Fehler (#C0392B) auf Tint (#FDECEB) | 5.2:1 | ✓ |
| Sekundärtext (#5A6270) auf Panel (#FFFFFF) | 5.9:1 | ✓ |
| Gedämpft (#8899AA) auf Panel (#FFFFFF) | 3.5:1 | ✗ (nur dekorativ) |

### Mehrkanalige Kodierung

Jede Statusanzeige nutzt mindestens zwei redundante Kanäle.

| Information | Kanal 1 | Kanal 2 | Kanal 3 |
|---|---|---|---|
| Konfidenz | Hintergrund-Tint | Gutter-Marker | Review-Aktionsleiste (nur bei prüfenswert/problematisch) |
| Annotationstyp | Unterstreichungsfarbe | Entity-Legende | Attribut-Tab (Badge mit Elementname) |
| Validierungsfehler | Inline-Unterstreichung | Validierungs-Tab (Liste) | Gutter-Marker |

### Screen-Reader

Alle interaktiven Elemente haben ARIA-Labels. Statusänderungen (Validierung, Review) werden über `aria-live` Regionen angekündigt. Focus-Reihenfolge folgt dem visuellen Layout (Source → Editor → Vorschau).

---

## 8. Animation

| Typ | Dauer | Easing |
|---|---|---|
| Hover-States | 150ms | ease-out |
| Panel-Übergänge | 150ms | ease-out |
| Dialog öffnen/schließen | 200ms | ease-out |
| Toast-Einblendung | 300ms | ease-out |

Keine Animation über 300ms. Textbearbeitung, Validierungsergebnisse und Fehlermeldungen erscheinen sofort, ohne Animation.

---

**Abhängigkeiten:**
- [ARCHITECTURE.md](ARCHITECTURE.md) für technische Implementierung
- [WORKFLOW.md](WORKFLOW.md) für den Annotations- und Review-Workflow
