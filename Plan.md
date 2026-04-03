# teiCrafter -- Plan

## Phase P: Pipeline-Modus (szd-htr METS zu Minimal-TEI)

### Ziel

Automatisierte Ueberfuehrung eines METS-Containers aus der szd-htr-Pipeline in ein valides Minimal-TEI-XML. Der teiHeader wird deterministisch aus MODS-Metadaten abgeleitet, der text/body deterministisch aus PAGE XML Regionen. LLM-Einsatz ausschliesslich fuer div-Strukturierung bei komplexen Dokumenten.

### Abhaengigkeit

Der Pipeline-Modus setzt voraus, dass `export_mets.py` in szd-htr implementiert ist (Plan Phase 5b). Das METS-File ist der einzige Input. Solange kein METS vorliegt, kann gegen Page-JSON v0.2 entwickelt und getestet werden (enthaelt alle benoetigten Daten, nur in anderem Container).

### Datenfluss

```
METS (szd-htr)
  |
  +---> METS-Parser
  |       |
  |       +---> dmdSec/MODS ---> MODS-zu-teiHeader (deterministisch)
  |       |
  |       +---> fileSec/structMap ---> PAGE XML Loader
  |                                       |
  |                                       +---> Region-Typ-Mapping (deterministisch)
  |                                       |       paragraph --> <p>
  |                                       |       heading   --> <head>
  |                                       |       table     --> <table>
  |                                       |       marginalia --> <note type="marginalia">
  |                                       |       list      --> <list>/<item>
  |                                       |       header/footer --> <fw>
  |                                       |
  |                                       +---> ReadingOrder --> Elementreihenfolge
  |
  +---> div-Strukturierung
  |       |
  |       +---> Heuristik: neuer <head> = neuer <div>
  |       +---> LLM-Fallback (Gemini 3.1 Flash Lite): nur bei Konvoluten/Werken
  |
  +---> TEI-Assemblierung
  |       teiHeader + <text><body>...</body></text>
  |
  +---> Validierung
  |       well-formedness + Schema (DTABf-Subset) + Plaintext-Erhaltung
  |
  +---> {object_id}.tei.xml
```

### Laufzeitumgebung

Node.js-CLI-Script, nicht Teil der Browser-App. Begruendung: METS/PAGE XML sind lokale Dateien; Batch-Verarbeitung braucht Dateisystem-Zugriff. Die Mapping-Logik (MODS-zu-teiHeader, Region-zu-TEI) wird als reine ES6-Module geschrieben, die sowohl im CLI als auch (spaeter) im Browser importierbar sind.

---

### P.1 METS-Parser

Liest die METS-Datei und extrahiert drei Informationsebenen.

- [ ] **P.1.1** METS-XML-Loader: Einlesen und well-formedness-Pruefung (xmldom fuer Node.js)
- [ ] **P.1.2** dmdSec-Extraktion: MODS-Block aus `mets:dmdSec/mets:mdWrap[@MDTYPE="MODS"]/mets:xmlData` extrahieren
- [ ] **P.1.3** fileSec-Extraktion: `mets:fileGrp` parsen, PAGE XML-Referenzen (`FLocat@xlink:href`) und Bild-Referenzen sammeln
- [ ] **P.1.4** structMap-Extraktion: physische structMap (`TYPE="PHYSICAL"`) parsen, Seitenreihenfolge und Zuordnung PAGE XML zu Bild ableiten
- [ ] **P.1.5** Provenienz-Extraktion: Pipeline-Metadaten aus METS `amdSec` (Modell, Zeitstempel, Pipeline-Version) fuer `teiHeader/revisionDesc`

**Neues Modul:** `docs/js/pipeline/mets-parser.js`

---

### P.2 MODS-zu-teiHeader-Mapping (deterministisch)

Vollstaendig regelbasiert, kein LLM. Jedes MODS-Element wird auf ein teiHeader-Element abgebildet.

- [x] **P.2.1** Mapping-Tabelle implementieren (siehe unten)
- [x] **P.2.2** titleStmt generieren: `mods:titleInfo/mods:title` --> `fileDesc/titleStmt/title`; `mods:name[@type="personal"]` --> `titleStmt/author` oder `titleStmt/editor` je nach `mods:role/mods:roleTerm`
- [x] **P.2.3** publicationStmt generieren: Statischer Block mit Projekt-Referenz
- [x] **P.2.4** sourceDesc generieren: `msDesc` mit `msIdentifier` (aus `mods:location`), `physDesc` (aus `mods:physicalDescription`), `history/origin` (aus `mods:originInfo`)
- [x] **P.2.5** profileDesc generieren: `langUsage/language` (aus `mods:language`), `textClass/classCode` (Sachgebiete)
- [x] **P.2.6** encodingDesc generieren: `projectDesc` mit Pipeline-Referenz
- [x] **P.2.7** revisionDesc generieren: `change`-Eintrag mit Pipeline-Provenienz (Modell, Datum, Pipeline-Version)

**Neues Modul:** `docs/js/pipeline/mods-to-header.js`

**MODS-zu-teiHeader Feldtabelle:**

| MODS-Element | teiHeader-Element | Bemerkung |
|---|---|---|
| `titleInfo/title` | `fileDesc/titleStmt/title` | Direkt |
| `name/namePart` + `role/roleTerm` | `titleStmt/author` oder `titleStmt/editor` | Rollenabhaengig |
| `name/nameIdentifier[@type="gnd"]` | `author/@ref` oder `editor/@ref` | GND-URI |
| `originInfo/dateCreated` | `sourceDesc/msDesc/history/origin/origDate/@when` | ISO-Datum |
| `originInfo/place/placeTerm` | `history/origin/origPlace` | Entstehungsort |
| `language/languageTerm` | `profileDesc/langUsage/language/@ident` | ISO 639-1 |
| `genre` | `profileDesc/textClass/classCode` | Dokumenttyp |
| `physicalDescription/extent` | `msDesc/physDesc/objectDesc/supportDesc/extent` | Umfang |
| `note[@type="writing_instrument"]` | `physDesc/handDesc/handNote` | Schreibinstrument |
| `note[@type="writing_material"]` | `physDesc/objectDesc/supportDesc/support` | Beschreibstoff |
| `note[@type="script"]` | `physDesc/handDesc/handNote/@scribeRef` | Schreiberhand |
| `location/physicalLocation` | `msDesc/msIdentifier/repository` | Institution |
| `location/shelfLocator` | `msDesc/msIdentifier/idno[@type="shelfmark"]` | Signatur |
| `identifier[@type="pid"]` | `msDesc/msIdentifier/idno[@type="PID"]` | Persistent Identifier |
| `note[@type="provenance"]` | `msDesc/history/provenance` | Provenienz |
| `accessCondition` | `publicationStmt/availability/licence` | Lizenz |

Falls Korrespondenz (erkennbar an `mods:genre` = "letter"):

| MODS-Element | teiHeader-Element |
|---|---|
| `name[@usage="sender"]` | `correspDesc/correspAction[@type="sent"]/persName` |
| `name[@usage="recipient"]` | `correspDesc/correspAction[@type="received"]/persName` |

---

### P.3 PAGE XML-zu-body-Mapping (deterministisch)

Liest alle PAGE XML-Dateien in Seitenreihenfolge (aus structMap), extrahiert Regionen und bildet sie auf TEI-Elemente ab.

- [x] **P.3.1** Page-JSON-Loader: Seiten und optionale Regionen lesen (Page-JSON-Fallback statt PAGE XML)
- [x] **P.3.2** ReadingOrder-Auswertung: Regionen nach `reading_order` sortiert verarbeiten
- [x] **P.3.3** Region-Typ-Mapping implementieren (siehe unten)
- [x] **P.3.4** Textextraktion: Seitentext auf Regionen verteilt (proportional nach `lines`-Feld)
- [x] **P.3.5** `<pb/>`-Generierung: Vor jeder neuen Seite ein `<pb n="N" facs="BILD_URI"/>` einfuegen
- [x] **P.3.6** Leerseiten-Handling: blank/color_chart Seiten --> kein Output (nur `<pb/>`)
- [x] **P.3.7** `<fw>`-Handling: `header`/`footer` Regionstypen auf `<fw type="header|footer">` mappen

**Neues Modul:** `docs/js/pipeline/page-to-body.js`

**Region-Typ-zu-TEI Mapping:**

| PAGE XML Region `@type` | TEI-Element | Bemerkung |
|---|---|---|
| `paragraph` | `<p>` | Standard |
| `heading` | `<head>` | Ueberschriften |
| `table` | `<table><row><cell>` | Vorerst einfaches `<table>` mit Freitext |
| `marginalia` | `<note type="marginalia" place="margin">` | Randnotizen |
| `list` | `<list><item>` | Listenpunkte, Aufteilung anhand Zeilenumbrueche |
| `header` | `<fw type="header" place="top">` | Kolumnentitel |
| `footer` | `<fw type="footer" place="bottom">` | Fusszeile |

---

### P.4 div-Strukturierung (Heuristik + LLM-Fallback)

Die Abschnittsstruktur (`<div>`) ist das einzige Element, das nicht rein deterministisch zugeordnet werden kann.

- [x] **P.4.1** Heuristik implementieren: Jede `<head>` eroeffnet einen neuen `<div>`. Briefe: Single-div (Umschlag/Briefkopf sind keine Kapitelgrenzen). Ohne `<head>` wird der gesamte body in einen einzigen `<div>` gehuellt.
- [ ] **P.4.2** Komplexitaets-Erkennung: Dokument gilt als "komplex" bei Gruppe G (Konvolut), mehr als 3 Heads, oder nicht-monotoner Heading-Reihenfolge.
- [ ] **P.4.3** LLM-Fallback (Gemini 3.1 Flash Lite): Prompt mit Heading-Liste + Seitennummern, Frage: "Welche Headings gehoeren zusammen?". Output: JSON-Array von div-Grenzen. Nur bei komplexen Dokumenten.
- [x] **P.4.4** div-Assemblierung: Flache Element-Liste in verschachtelte `<div>`-Strukturen umformen. `@type`-Attribut abgeleitet aus document_type ("letter", "chapter", undefined).

**Neues Modul:** `docs/js/pipeline/div-structurer.js`

**Heuristik-Regeln:**

1. Jeder `<head>` beginnt einen neuen `<div>`
2. Elemente vor dem ersten `<head>` kommen in einen einleitenden `<div>`
3. Elemente nach dem letzten `<head>` gehoeren zum letzten `<div>`
4. Einzelner `<head>` im gesamten Dokument: Ein `<div>` fuer das gesamte Dokument
5. Kein `<head>` vorhanden: Ein `<div>` ohne `<head>`

---

### P.5 TEI-Assemblierung

Fuegt teiHeader (P.2) und body (P.3 + P.4) zu einem vollstaendigen TEI-Dokument zusammen.

- [x] **P.5.1** TEI-Skeleton: `<?xml version="1.0" encoding="UTF-8"?>` + `<TEI xmlns="http://www.tei-c.org/ns/1.0">` + teiHeader + `<text><body>...</body></text>` + `</TEI>`
- [x] **P.5.2** Indentation: 2-Space-Indentation fuer Lesbarkeit
- [x] **P.5.3** Encoding-Deklaration: Immer UTF-8
- [x] **P.5.4** Namespace-Sauberkeit: Nur TEI-Namespace im Output

**Neues Modul:** `docs/js/pipeline/tei-assembler.js`

---

### P.6 Validierung

- [x] **P.6.1** Well-formedness: Tag-Stack-Matching (Node.js-kompatibel ohne DOM-Abhaengigkeit)
- [x] **P.6.2** Plaintext-Erhaltung: Wort-Jaccard Original vs. Output (Schwelle 95%)
- [ ] **P.6.3** Schema-Konformitaet: DTABf-Profil-Validierung (Element/Attribut/Parent-Child-Pruefung)
- [x] **P.6.4** Header-Vollstaendigkeit: Pruefung auf TEI, teiHeader, fileDesc, titleStmt, title, sourceDesc, msDesc, msIdentifier, text, body, div
- [x] **P.6.5** Validierungsbericht: formatReport() mit Fehlerliste (Level, Source, Meldung)

**Neues Modul:** `docs/js/pipeline/pipeline-validator.js`

---

### P.7 CLI-Script

Node.js-Einstiegspunkt, der alle Module orchestriert.

- [ ] **P.7.1** CLI-Interface fuer METS: `node pipeline.mjs <mets-file>` (blockiert durch P.1)
- [x] **P.7.2** Page-JSON-Fallback: `node pipeline.mjs --page-json <file> [--output <dir>] [--validate-only] [--verbose]`
- [x] **P.7.3** Batch-Modus: `node pipeline.mjs --batch <dir> [--recursive]` verarbeitet alle `*_page.json`
- [ ] **P.7.4** LLM-Konfiguration: API-Key via Umgebungsvariable (`GOOGLE_API_KEY`), Provider/Model via CLI-Flags
- [x] **P.7.5** Exit-Codes: 0 = Erfolg, 1 = Validierungsfehler, 2 = Parsing-Fehler
- [x] **P.7.6** Logging: Zusammenfassung pro Objekt (Seitenanzahl, Regionen, Validierungsstatus)

**Neues Script:** `pipeline.mjs` (Projekt-Root)
**Runtime:** Node.js 18+ (nativ ES-Modul-Support, `fetch` in global, kein Bundler)

---

### P.8 DTABf-Schema-Erweiterung

Das bestehende `dtabf.json` deckt nur die interaktive Annotation ab. Fuer den Pipeline-Modus werden Header-Elemente benoetigt.

- [x] **P.8.1** `msDesc`-Hierarchie ergaenzt: `msIdentifier` (`repository`, `country`, `settlement`, `idno`), `physDesc` (`objectDesc`, `supportDesc`, `support`, `extent`, `handDesc`, `handNote`), `history` (`origin`, `origDate`, `origPlace`, `provenance`), `additional`/`adminInfo`
- [x] **P.8.2** Strukturelemente ergaenzt: `fw` (Attribute: `type`, `place`), `table`/`row`/`cell`, `list`/`item`, `note` (Attribute: `type`, `place`)
- [x] **P.8.3** Header-Elemente ergaenzt: `encodingDesc`, `projectDesc`, `revisionDesc`, `change`, `langUsage`, `language`, `textClass`, `classCode`, `availability`, `licence`, `publisher`, `author`, `editor`
- [x] **P.8.4** Bestehende Elemente erweitert: `publicationStmt` mit `publisher`/`availability`, `profileDesc` mit `langUsage`/`textClass`, `teiHeader` mit `encodingDesc`/`revisionDesc`

**Erweiterung von:** `docs/schemas/dtabf.json`

---

### P.9 Testdaten und Verifikation

- [ ] **P.9.1** Test-METS erstellen: 1 Objekt aus szd-htr manuell als METS/MODS exportieren
- [ ] **P.9.2** Referenz-TEI erstellen: Manuell erstelltes erwartetes TEI-XML fuer das Testobjekt
- [ ] **P.9.3** Unit-Tests: MODS-zu-teiHeader (Feldvollstaendigkeit), Region-zu-TEI (Typmapping), div-Heuristik (3 Faelle)
- [x] **P.9.4** Integrations-Test: 3 Page-JSON-Dateien (o_szd.100 Lebensdokument mit Regionen, o_szd.1079 Korrespondenz mit Regionen, o_szd.2305 Aufsatzablage ohne Regionen) -- alle PASS
- [ ] **P.9.5** Regressions-Test: Bestehende Browser-Tests (`docs/tests/`) duerfen nicht brechen

---

### Reihenfolge der Implementierung

```
P.8  DTABf-Schema-Erweiterung (Voraussetzung fuer Validierung)
P.9.1 Test-METS und Referenz-TEI (Voraussetzung fuer Entwicklung)
  |
P.1  METS-Parser
P.2  MODS-zu-teiHeader          (parallel zu P.3)
P.3  PAGE XML-zu-body           (parallel zu P.2)
  |
P.4  div-Strukturierung
P.5  TEI-Assemblierung
P.6  Validierung
  |
P.7  CLI-Script (orchestriert alles)
P.9  Tests
```

---

### Dateiuebersicht

| Datei | Typ | Beschreibung |
|---|---|---|
| `docs/js/pipeline/mets-parser.js` | Neu | METS-XML parsen, MODS/PAGE XML/structMap extrahieren |
| `docs/js/pipeline/mods-to-header.js` | Neu | MODS-Felder deterministisch auf teiHeader abbilden |
| `docs/js/pipeline/page-to-body.js` | Neu | PAGE XML Regionen auf TEI-body-Elemente abbilden |
| `docs/js/pipeline/div-structurer.js` | Neu | Heuristik + LLM-Fallback fuer div-Grenzen |
| `docs/js/pipeline/tei-assembler.js` | Neu | Header + Body zu vollstaendigem TEI zusammenfuegen |
| `docs/js/pipeline/pipeline-validator.js` | Neu | Orchestriert Validierung fuer Pipeline-Output |
| `pipeline.mjs` | Neu | Node.js-CLI-Einstiegspunkt |
| `docs/schemas/dtabf.json` | Erweitert | msDesc-Hierarchie, fw, table, list, Header-Elemente |

---

### Entscheidungslog

| Entscheidung | Begruendung |
|---|---|
| CLI-Script statt Browser-UI fuer Pipeline | METS/PAGE XML sind lokale Dateien, Batch-Verarbeitung braucht Dateisystemzugriff. Browser-Import kann spaeter als zweiter Pfad ergaenzt werden. |
| Node.js statt Python | Module als ES6 geschrieben -- gleiche Codebasis wie der Browser-Modus. Kein zweites Oekosystem. |
| Kein LLM fuer teiHeader | MODS-zu-TEI ist eine deterministische Abbildung. LLM wuerde nur Fehler einfuehren. |
| Kein LLM fuer body-Grundstruktur | Region-Typen aus Layout-Analyse sind ausreichend praezise. LLM nur fuer logische Gliederung (div). |
| Gemini 3.1 Flash Lite als LLM-Fallback | Gleicher Provider wie szd-htr. Guenstig. Aufgabe (Heading-Clustering) ist einfach. |
| Page-JSON v0.2 als Entwicklungs-Fallback | METS-Export in szd-htr noch nicht implementiert. Page-JSON enthaelt alle Informationen, nur in anderem Format. |
| Module unter `docs/js/pipeline/` | Konsistent mit bestehender Projektstruktur (`docs/js/services/`). Erlaubt spaeteren Browser-Import. |
| msDesc statt flaches sourceDesc | Strukturierte Quellenangabe ist Standard fuer Archivmaterial. DTABf unterstuetzt msDesc. |
