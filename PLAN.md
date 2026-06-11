---
title: Gesamtplan und Umsetzung des Editopia-Vorhabens (teiCrafter, SZD, ZBZ)
project:
  name: teiCrafter
  repository: https://github.com/DigitalHumanitiesCraft/teiCrafter
method:
  name: Promptotyping
  url: https://lisa.gerda-henkel-stiftung.de/digitale_geschichte_pollin
template:
  name: Vorlage Projektplan
  version: 0.1
status: active
created: 2026-06-07
updated: 2026-06-10
language: de
version: 0.7
topics: ["[[Projektplan]]", "[[TEI XML]]", "[[Digitale Editionen]]", "[[Promptotyping]]"]
related: [goals, integration, converter-reference, project, data, architecture, specification, testing]
---

# Gesamtplan und Umsetzung des Editopia-Vorhabens (teiCrafter, SZD/Stefan Zweig, ZBZ/Hersch)

Dies ist NICHT nur der teiCrafter-Plan: er umfasst die drei Projekte teiCrafter, SZD und ZBZ und das
Vortrags-/Paper-Ziel. teiCrafter ist eines der drei Projekte, nicht das Ganze. Dieses Dokument ist
zugleich der **Umsetzungsplan**: es hält den belegten Stand fest und ordnet die offene Arbeit.

Vollständige, selbsttragende Synthese des Vorhabens (Stand 2026-06-10), bewusst auf Deutsch verfasst
(bewusste Entscheidung; weicht von der CLAUDE.md-Regel "documentation in English" und den englischen
Schwesterdokumenten ab). Es verweist auf die Detail-Dokumente, statt sie zu duplizieren:
[goals.md](knowledge/goals.md) (englisches Milestone-Register), [converter-reference.md](knowledge/converter-reference.md)
(SZD-Konverter-Kontrakt) und die Ökosystem-Synthese im zbz-Repo (`zbz-ocr-tei/knowledge/oekosystem-synthese.md`).

Belegregel: Aussagen mit `[proof]`/`datei:zeile` sind maschinell nachprüfbar; Absichts-Aussagen sind
als Entscheidung festgehalten (Datum genannt); Zahlen Dritter sind zeitpunktbezogen und vor Nutzung
gegen den Code zu prüfen.

## 0. Umsetzungs-Scope (wer macht was)

- **In diesem Plan umgesetzt:** teiCrafter (Engine, Editor, Annotation, Bildanzeige, Worked Examples)
  und die **SZD-Pipeline** (Konverter-Kontrakt finalisieren, Batch-Konverter, Konvertierung der
  Objekte, Demo-Beispiel).
- **Separat bearbeitet (Autor):** die **ZBZ-Pipeline**. teiCrafter lädt und rendert ZBZ-TEI bereits;
  die ZBZ-pipeline-seitigen Aufgaben (Bild-URL-Schema-Lieferung, ZBZ-Projektbericht,
  oekosystem-synthese-Korrektur, Live-ZBZ-Durchlauf) liegen außerhalb dieses Umsetzungs-Scopes und
  sind unten mit **separat** markiert. Das ZBZ-Worked-Example (M7.2) hängt an dieser Spur.

## 1. Zweck und Positionierung

teiCrafter ist ein **nachnutzbares, browserbasiertes Static-Site-Research-Tool**: ein generischer,
verlustfreier Editor für beliebiges TEI-XML, zügig mit Promptotyping gebaut und über mehrere Projekte
hinweg im Einsatz (SZD, ZBZ/Hersch, Wenzelsbibel). Er nimmt TEI aus Eingabe-Pipelines auf, lässt einen
Menschen es Folio für Folio korrigieren und semantisch annotieren, und speichert es byte-treu zurück.
("Im Einsatz" heißt: deployt und als TEI-Editor genutzt; die Entitäten-Annotationsschicht für die
Editopia-Demo ist der aktuelle Ausbau, siehe §4 für den belegten Stand.)

Übergeordneter Anlass ist der **Editopia-Vortrag** (Christopher Pollin; Editopia 02.-04.09.2026,
Wuppertal; Vortrag 2026-09-02). Die belegte These des eingereichten Abstracts: agentenbasierte
Editions-Workflows setzen eine **epistemische Infrastruktur** voraus, also Mechanismen, Arbeitsschritte
und Werkzeuge, um die Ergebnisse LLM-gestützter Verarbeitungsschritte zu verifizieren, zu kuratieren
und zu dokumentieren. Der eingereichte Abstract ist ZBZ/Hersch-fokussiert; die Abstract-Datei selbst
liegt nicht im Vault (dort ausdrücklich vermerkt), nur ihre These ist dokumentiert.

teiCrafters Rolle in dieser These: teiCrafter **ist** ein konkretes Stück dieser epistemischen
Infrastruktur, nämlich das deterministische, verlustfreie Werkzeug, in dem ein Mensch maschinell
erzeugte TEI prüft, korrigiert und kuratiert, mit klarer Markierung des Maschinellen. teiCrafter
erweitert das Paper damit um einen eigenen Promptotyping-Fall (ein agentisch gebautes
Editionswerkzeug), neben den zwei Pipeline-Fällen SZD und Hersch/ZBZ.

Primärer eigener Anwendungsfall über Editopia hinaus ist die **Wenzelsbibel-Edition** (PLUS Salzburg,
FWF, Wort-Ebene, ab Herbst 2026).

## 2. Werkzeug-Abgrenzung (verbindlich)

- **teiCrafter = TEI bearbeiten.** Generischer, verlustfreier TEI-Editor. Bearbeitet und annotiert
  beliebiges TEI, projektunabhängig. ZBZ und SZD sind zwei Eingabe-Pipelines, die TEI hineinliefern.
- **EditionCrafter = ganze digitale Editionen.** Eigene, unabhängige Schwesterlinie. Generalisierung
  der statischen Pipeline-Viewer von ZBZ und SZD zu vollständigen Editionen. **Der Editopia-Hersch-
  Demonstrator ist EditionCrafter v0, nicht teiCrafter** (Vault ACTIVE-WORK.md / EditionCrafter.md,
  bestätigt). Achtung: `zbz-ocr-tei/knowledge/oekosystem-synthese.md` behauptet das Gegenteil
  (teiCrafter sei die Hersch-Demo); das ist falsch und zu korrigieren (separat, siehe §10).
- **Statische Viewer (ZBZ/SZD).** Die projekteigenen statischen Weboberflächen der Pipelines
  (öffentlich read-only Proto-Edition plus lokal Editorial-Workspace; "Three Functions" im JOHD-Paper).
  Gehören zu den jeweiligen Pipelines, nicht zu teiCrafter.

Trennlinie in einem Satz: teiCrafter erzeugt und bearbeitet TEI; EditionCrafter erzeugt die Edition
(Anzeige, Apparat, Publikation).

## 3. Die drei Projekte

| Projekt | Pfad | Rolle | Im Scope |
|---|---|---|---|
| teiCrafter | `GitHub/ResearchTools/teiCrafter` | verlustfreier TEI-Editor, Konvergenz für TEI-Bearbeitung | ja |
| szd-htr | `GitHub/szd-htr` | Stefan-Zweig-Pipeline (Bilder zu Page-JSON; TEI-Konverter ausstehend) | ja |
| zbz-ocr-tei | `GitHub/DHCraft/zbz-ocr-tei` | Jeanne-Hersch-Pipeline (PDF zu line-level TEI) | separat (Autor) |

Gemeinsame Haltung: maschinell erzeugte Inhalte gelten als unverifiziert, bis ein Mensch sie prüft
(teiCrafter markiert sie violett über `--color-ai`; zbz/szd über Workflow-/Review-Status).

## 4. Stand: erledigt und offen

### Erledigt (mit Proof)

- **Verlustfreie Engine.** Round-Trip-Sweep byte-identisch: `node test/tools/roundtrip_sweep.mjs` ->
  **295/295** (285 Hersch + 5 SZD + 5 synthetisch; Lauf 2026-06-10). [proof] (M1.1, M2.1, M4.1)
- **ZBZ direkt ladbar.** Editor-Ladbarkeit: `node test/tools/hersch_loadability.mjs` ->
  **285/285** nutzbare Editor-Ansicht, 0 Parse-Fehler; gesamt 4.115 Folios, 49.324 Zellen,
  23.421 Zonen, 266 Notes. [proof] (M1.1, M4.2)
- **Bildanzeige Engine-Seite.** Der Editor liest `<graphic url>` aus `<surface>` und nutzt
  `surface.graphic` als imageUrl-Fallback (tei-document.js, editor-app.js). (M2.2; Browser-Visualtest
  bestanden, siehe unten.)
- **Annotationsschicht gebaut.** Ort (M3.1), Werk (M3.2), Normdaten-Handeingabe als
  `<idno type="GND|GeoNames|Wikidata">` mit add/replace/remove (M3.3-Kern), typ-unabhängiges
  Mention-Linking (M3.4). Ein gemeinsamer Proof deckt alles ab: `node test/tools/szd_demo_check.mjs`
  -> **32/32**. [proof] Die drei festen Sweeps bleiben grün.
- **SZD-Konverter-Kontrakt eingefroren (M1.2 erledigt).** [converter-reference.md](knowledge/converter-reference.md)
  (status `active`, v0.5): vollständiges deterministisches Page-JSON-v0.2-zu-TEI-Mapping; die fünf
  §9-Punkte am echten Datensatz aufgelöst (bbox bestätigt Prozent, nur `~~x~~`/`[?]`-Marker real,
  `pages[].notes` in v1 verworfen per reversibler Entscheidung, kein weiteres standOff-Seeding,
  images 1:1 zu pages; Zusatzbefunde: doppelte ID o_szd.161, leere/blanke Objekte mit `cells===0`). [proof]
- **SZD-Batch-Konverter gebaut (M1.3 erledigt).** `pipeline/export_tei.py`: byte-treuer Python-Port des
  Referenz-Prototyps (pfad-getrieben plus `--id`-Modus, der bei mehrdeutiger ID hart abbricht).
  Byte-identisch zum Prototyp auf der Handvoll (`node test/tools/port_parity.mjs` 6/6) und über einen
  151-Objekt-Spread des ~2.103-Korpus (151/151). [proof]
- **Voller Korpus konvertiert und geprüft (M1.4 + M1.5 erledigt).** `pipeline/export_tei.py --all`
  konvertiert alle 2.103 Objekte; `node test/tools/szd_loadability_sweep.mjs`: 2.103/2.103 konvertiert,
  2.103/2.103 byte-identischer Round-Trip, 0 Parse-Fehler, 40 leere/blanke Objekte (cells===0, valide). [proof] (deckt auch M4.4)
- **SZD-Demo-Objekt real konvertiert.** o_szd.1079 aus dem echten `o_szd.1079_page.json` via
  `test/tools/szd-pagejson-to-tei.mjs`: 5 Folios, line-level, **byte-identischer Round-Trip**,
  GAMS-`<graphic>`-URLs, Zonen Prozent->Pixel, kein standOff (1079 hat keinen creator, wie der
  Kontrakt vorhersagt). [proof] (M1.4 für 1079)
- **M2.2 Browser-Visualtest bestanden (2026-06-08).** o_szd.1079 im Editor geladen (headless Chrome
  via Playwright): GAMS-Faksimile rendert in OpenSeadragon (IMG.1/IMG.2 HTTP 200), 2 Zonen-Overlays
  auf Folio 1, line-level-Zellen, Folio-Navigation. Beleg: `c:\tmp\m2_2_1079_folio1.png`.
- **M7.2 SZD-Worked-Example im Browser bewiesen (2026-06-08).** o_szd.1079 end-to-end: Öffnen plus
  Speichern byte-identisch zur Quelle; Zeilenkorrektur (Wohlgeboren -> Hochwohlgeboren) ändert genau
  diese Stelle; Annotation (Ort Komotau + `<idno type="GeoNames">`) fügt genau den standOff-Block ein;
  erneutes Öffnen stabil. Reproduzierbar via `c:\tmp\pwtest\m72.js`; Beleg `c:\tmp\m72_annotate.png`.

- **Whitespace-Vorbehalt geschlossen (2026-06-08).** Zeilen-Edit erhält die Rand-Whitespace
  (Einrückung/Newlines) verbatim: nur der getrimmte Kern wird bearbeitet, lead/trail werden beim Commit
  wieder angelegt (`editCellCore`/`splitEdge` in edition.js). `node test/tools/whitespace_edit_check.mjs`
  -> **14/14** (mit dem alten kollabierenden Pfad als Kontrolle). [proof] commit 8fd281c.
- **M3.5 Notiz-Erstellung gebaut (2026-06-08).** Verlustfreies `<note target="#id">` in `<standOff>`,
  Anker via Ancestor-xml:id, sonst Zeilen-`@facs`, sonst injizierte xml:id (`addNote`/`addNoteForNode`/
  `ensureXmlId` in standoff.js); UI: "Add note"-Modus. `node test/tools/note_create_check.mjs` ->
  **15/15**. [proof] commit d3fc922.
- **M3.7 KI-Annotations-Vorschlag gebaut (2026-06-08).** LLM schlägt Entitäten vor, als unverifiziert
  `resp="#ai"` (TEI-valide, verlustfrei) eingefügt, violett gerendert; Mensch bestätigt (`confirmEntity`
  entfernt den Marker) oder verwirft (`deleteEntity`). `node test/tools/ai_proposal_check.mjs` -> **17/17**,
  Parser robust (`ai_suggest_parse_check.mjs`). Der LLM-Aufruf ist browser-verifiziert. [proof] commit f647e7e.
- **M3.3 Live-Lookup gebaut (2026-06-08).** Normdaten-Suche Wikidata/GND/GeoNames (URL-Builder + Parser
  in `services/authority-lookup.js`), Index-Panel "find"-Button + Ergebnis-Popover. Wikidata und GND
  schlüssellos und CORS-fähig; GeoNames braucht Username. `node test/tools/authority_lookup_check.mjs` ->
  **15/15**. Der fetch ist browser-verifiziert. [proof] commit 8ce938a.
- **M3.6 Textkritik gebaut (2026-06-08).** Inline, verlustfrei in `docs/js/editor/criticism.js`:
  `markCritical` wraps `<unclear>`/`<del>`/`<add>` (Rand-Whitespace bleibt ausserhalb der Tags) bzw.
  ersetzt den Kern durch `<gap/>`; `unwrapCritical` macht ein Wrap rückgängig, verweigert aber das
  Entfernen eines geteilten Wrappers; `removeGap` löscht eine Lücke. Geteiltes `splitEdge`/
  `CRITICAL_LOCALS`/`nearestAncestor` im Core; Gap-Zelle + `crit`/`critSole` in edition.js; "Mark text"-
  Modus + Inline-Chooser. `node test/tools/criticism_check.mjs` -> **47/47**, gehärtet gegen ein
  22-Befund-Adversarial-Review. [proof] commit 119a1a2. Auto-Mapping der Pipeline-Marker
  (`[?]`/`~~x~~` -> Tags) bleibt separate spätere Aufgabe.

### Offen (Umsetzungs-Scope teiCrafter + SZD)

- **M7.1/M7.3** Demo-Material (M7.2-SZD erledigt: o_szd.1079 end-to-end im Browser 2026-06-08).
- **Browser-Verifikation (Operator)** der drei neuen UI-Pfade auf einem echten Objekt: Notiz-Klick,
  KI-Vorschlag (Provider-Key nötig), Live-Lookup (Netz). Engine/Parser sind headless belegt.

### Separat (Autor, ZBZ-Pipeline)

- **M2.3** Live-ZBZ-Browser-Durchlauf, **M2.4** ZBZ-Bild-URL-Schema (geliefert, zu verifizieren),
  oekosystem-synthese-Korrektur, ZBZ-Projektbericht. Das **ZBZ-Worked-Example** (M7.2-Hälfte) hängt an
  dieser Spur; die teiCrafter-Seite (Rendering, `<graphic>`-Support) ist erledigt.

Ehrlicher Rest: die drei neuen Annotations-Features (M3.5/M3.7/M3.3) sind engine- und parser-seitig
headless belegt; ihre eigentlichen Browser-Pfade (Klick-UI, LLM-Aufruf, Live-fetch) stehen zur
Operator-Sichtprüfung aus. Die deterministische SZD-Strecke (M1.2 bis M1.5, M4.4) ist vollständig belegt
(Paritätstest `port_parity.mjs` 6/6 byte-identisch).

Hinweis: `pipeline.mjs` (Vor-Pivot) wurde 2026-06-10 aus der Wurzel gelöscht (aus der Git-History
zurückholbar). Er war ein nicht lauffähiger Torso: er importierte das im Pivot gelöschte
`docs/js/pipeline/` und brach mit ERR_MODULE_NOT_FOUND ab. Seine ~2033 gitignored `output/*.tei.xml`
stammen aus der gelöschten Engine (LLM-`<div>/<head>/<p>`-Blöcke, NICHT line-level) und sind mit
heutigem Code nicht reproduzierbar. "2030 TEIs fertig" ist kein gültiger Stand.

## 5. teiCrafter Ziel-Contract (was der Editor liest und bewahrt)

Generisch nach local-name, kein Projekt-Profil ([data.md](knowledge/data.md),
[architecture.md](knowledge/architecture.md), `docs/js/editor/`):
- `<pb>` (opt. `@facs`, `@n`) trennt Folios; `<lb>`/`<l>` trennt Zeilen.
- Lesetext-Knoten werden editierbare Zellen: Wort-Ebene nur bei `<w xml:id>`, sonst Zeilen-Ebene.
- `<facsimile>`/`<surface>`/`<zone ulx/uly/lrx/lry>` treiben den OpenSeadragon-Viewer; `@facs` verknüpft
  Zeile und Zone bidirektional.
- `<standOff>`/`<note target>` tragen Entitäten/Apparat.
- Roher String ist kanonisch, Bearbeitung ist Offset-Splice, `serialize()` byte-identisch; nicht
  Interpretiertes bleibt verbatim.
- Laden: **Open** (File System Access API / Datei-Input) für jedes lokale XML; plus zwei fest
  verdrahtete Demo-Fetches. Eine geöffnete Datei bekommt `app.imageBase = null`.
- **Bildanzeige (M2.2, Engine erledigt):** Der Viewer zeigt ein Bild mit imageUrl UND surface; der
  Editor liest `surface.graphic` aus `<graphic url>` und nutzt es als Fallback. Pipeline-seitig wird
  `<graphic url>` in jede `<surface>` geschrieben (SZD = GAMS-URL, ZBZ = `docs/images/<id>/<id>_p00N.png`).

## 6. SZD-TEI-Datenmodell (Konverter-Kontrakt, Zusammenfassung)

Vollständige Spezifikation in [converter-reference.md](knowledge/converter-reference.md). Der Konverter
ist **deterministisch** (Page-JSON -> TEI nach Regel, kein LLM): das ist die verlustfreie,
reproduzierbare, kostenlose Stufe und trägt das Fidelity-Argument. Kern:
- **teiHeader** aus `source` + `descriptive_metadata`: Titel, author/editor (persName + GND-`<idno>`),
  respStmt, publicationStmt (Lizenz + Maschinen-Hinweis), msDesc/msIdentifier, physDesc, history/origin,
  profileDesc (langUsage, correspDesc nur für Korrespondenzen), revisionDesc.
- **standOff**: listPerson/listOrg/listPlace, aus Metadaten geseedet (Name +
  `<idno type="GND">` verbatim). Kein creator -> kein standOff (gilt für o_szd.1079).
- **facsimile**: eine `<surface>` je Seite (`<graphic>` GAMS-URL + Maße), `<zone>` je Region
  (bbox -> Pixel). **bbox-Einheit:** der Kontrakt legt Prozent (0-100) fest, am realen Page-JSON
  bestätigt (o_szd.100 r1 `[3.9,2.9,4.8,0.3]`, o_szd.1079 r1 `[17.5,37.9,34.9,5.2]`); am realen Datensatz
  über die Handvoll zu verifizieren (kein Wert > 100), dann ist der Kontrakt eingefroren. Zonen nur
  region-, nicht zeilengenau.
- **body** line-level (`<pb>` + `<lb>`), je Dokumenttyp: typescript (Default), manuscript/diary
  (nur Doppel-Tilde `~~x~~` = `<del>`, einzelne `~` ist Gedankenstrich), letter (correspDesc,
  opener/closer/signed, `[Stempel:]`->note/stamp), form (Pipe-Tabellen -> table/row/cell),
  newspaper_clipping (Spalten linearisiert).
- **Editoriale Marker** (v1 wörtlich erhalten): `[?]`, `[...]`/`[...N...]`, `~~x~~`, `{x}`, `[Stempel:]`.
  Die Ziel-Tags `<unclear>/<gap>/<del>/<add>/<note>` sind als Editor-Funktion gebaut (M3.6, criticism.js);
  das automatische Mapping dieser Pipeline-Kürzel auf die Tags bleibt eine separate spätere Aufgabe.
- **Leerseiten**: `<pb type="blank"/>` für blank/color_chart, Text dort verwerfen.
- **Erste Konvertier-Handvoll** (deckt die Body-Typen ab UND enthält das Schaustück): o_szd.100
  (Typoskript), o_szd.72 (Tagebuch, Tilde-Fall), **o_szd.1079 (Brief, Schaustück, bereits konvertiert)**,
  o_szd.2215 (Zeitungsausschnitt), o_szd.161 (Formular, Pipe-Tabellen).

## 7. Semantische Annotation (der Mehrwert von teiCrafter)

Definition: dem Text maschinenlesbare Bedeutung hinzufügen, in drei Schritten (abgrenzen,
klassifizieren, mit Normdaten verknüpfen). Zwei Familien:
- **Familie 1 Entitäten-Anreicherung:** Personen, Orte, Organisationen, Werke (+ GND/GeoNames/Wikidata),
  Datum. Das ist die Lücke, die beide Pipelines auslassen: ZBZ hat NER entfernt (E71), SZD seedet nur
  Metadaten-Entitäten in den Header, nicht die Erwähnungen im Text.
- **Familie 2 editorische Annotation:** Notizen/Fußnoten/Kommentare; textkritische Marker.

teiCrafter heute (erledigt): Person/Org/Event/**Ort**/**Werk** mit Name UND
**Normdaten-`<idno>`** (Handeingabe, add/replace/remove), typ-unabhängiges Mention-Linking,
Notiz-Erstell-UI (M3.5), Textkritik (M3.6, `unclear`/`del`/`add`/`gap`), Live-Lookup (M3.3) und
KI-Vorschlag (M3.7). Die gesamte editorische Annotationsschicht steht verlustfrei und headless belegt.

**KI-assistierte Annotation (M3.7, demonstriert die Editopia-These).** Ein **Offline-Pipeline-Schritt
mit Gemini 3.1 Flash Lite** liest die fertige TEI, schlägt Entitäten samt Normdaten-Kandidaten vor und
schreibt sie als **unverifizierte** Einträge in den `<standOff>`. teiCrafter zeigt sie violett
(`--color-ai`); der Mensch bestätigt, korrigiert oder verwirft. Begründung: deterministische Konvertierung
(verlustfrei) bleibt getrennt vom probabilistischen Vorschlag (assistiv); ein LLM für die Konvertierung
selbst wäre falsch (Kosten, Nichtreproduzierbarkeit, Halluzination, bricht das Fidelity-Argument);
teiCrafter bleibt rein im Browser (kein API-Schlüssel im Static-Site-Code, Gemini läuft davor in der
Pipeline). Das ist genau die These des Abstracts und das Designprinzip "KI assistiert, Mensch entscheidet".

**Normdaten-Modus (Entscheidung 2026-06-07): alle drei Wege, gestaffelt auf einem Mechanismus.** Jede
Entität trägt `<idno>` mit der Autoritäts-ID; drei Wege füllen dasselbe Feld: (1) **Handeingabe**
(M3.3-Kern, erledigt). (2) **Live-Lookup** (Name eintippen, client-seitig GND/GeoNames/Wikidata
abfragen, Treffer wählen). (3) **Offline Gemini** (M3.7, Vorschläge violett vor dem Öffnen). Konstante:
der Mensch prüft und entscheidet immer. Bau-Reihenfolge: (1) erledigt, dann (3) (stärkster Beleg der
These), dann (2) (meiste Frontend-Arbeit wegen CORS und Rate-Limits).

## 8. Ziele und Milestones

Legende: **★** demo-/vortragskritisch, **+** vollständige Ambition (parallel, nicht blockierend).
Status: **erledigt** / läuft / offen / später / **separat** (Autor, ZBZ-Spur).

**H1 - Beide Pipelines in teiCrafter bringen**
- ★ M1.1 ZBZ direkt ladbar. **erledigt** (hersch_loadability.mjs, 285/285).
- ★ M1.2 SZD `converter-reference.md` (volles Page-JSON->TEI-Mapping, deterministisch). **erledigt
  (eingefroren, status active v0.5, 2026-06-08)**; alle fünf §9-Punkte am realen Page-JSON aufgelöst.
- ★ M1.3 SZD Batch-Konverter `pipeline/export_tei.py`. **erledigt** (byte-treuer Python-Port;
  `node test/tools/port_parity.mjs` 6/6, plus 151/151 über Korpus-Stichprobe).
- ★ M1.4 SZD Demo-Handvoll konvertieren + engine-verifiziert. **erledigt** (1079 + 100/72/2215/161
  byte-identisch via port_parity und Prototyp-Engine-Check).
- + M1.5 SZD alle ~2.103 konvertieren + Ladbarkeits-Sweep. **erledigt** (`node test/tools/szd_loadability_sweep.mjs`: 2.103/2.103 byte-identisch, 40 leer/blank valide).

**H2 - Sehen, navigieren, korrigieren**
- ★ M2.1 Editor-Modell pro Datei. **erledigt**.
- ★ M2.2 Bildanzeige bei geöffneten Dateien (`<graphic>`-Support). **erledigt** (Engine plus
  Browser-Visualtest 2026-06-08: GAMS-Bild rendert in OpenSeadragon, Zonen, byte-clean; szd_demo_check.mjs).
- ★ M2.3 Live-Browser-Durchlauf ZBZ. **separat** (Autor); der demo-relevante Teil (ein ZBZ-Objekt)
  geht in M7.2 mit.
- ★ M2.4 ZBZ-Bild-URL-Schema für `<graphic>` (Bilder nur für 1000/1330/1540/2310). **separat**
  (geliefert, zu verifizieren).

**H3 - Semantisch annotieren**
- ★ M3.1 Ort-Entität (`place`/`placeName`). **erledigt** (szd_demo_check.mjs).
- ★ M3.2 Werk-Entität (`title`/`bibl`, `listBibl`, `wrk_`-IDs, auf standOff/listBibl beschränkt).
  **erledigt** (szd_demo_check.mjs).
- ★ M3.3 Normdaten-`<idno>` (GND/GeoNames/Wikidata) auf allen Typen + UI. **erledigt**: Handeingabe
  (setAuthority, szd_demo_check.mjs) plus Live-Lookup (authority-lookup.js, authority_lookup_check.mjs
  15/15; fetch browser-verifiziert), commit 8ce938a.
- ★ M3.4 Mention-Linking auf neue Typen. **erledigt** (linkMention typ-unabhängig).
- ★ M3.7 KI-Annotations-Vorschlag (violett zur Prüfung). **erledigt** (resp="#ai" + confirm/reject,
  ai_proposal_check.mjs 17/17; nutzt In-Browser-llm.js, LLM-Aufruf browser-verifiziert), commit f647e7e.
- + M3.5 Notizen/Fußnoten-Erstell-UI. **erledigt** (addNote/addNoteForNode, note_create_check.mjs 15/15),
  commit d3fc922.
- + M3.6 Textkritik (`unclear`/`gap`/`del`/`add`). **erledigt** (criticism.js, inline + verlustfrei,
  criticism_check.mjs 47/47), commit 119a1a2.

**H4 - Verlustfreiheit als Invariante**
- ★ M4.1 Engine-Round-Trip-Sweep. **erledigt** (roundtrip_sweep.mjs, 295/295, Lauf 2026-06-10).
- ★ M4.2 Editor-Ladbarkeits-Sweep. **erledigt** (hersch_loadability.mjs, 285/285).
- ★ M4.3 Jedes Feature byte-clean (Regressionstest). laufend (szd_demo_check.mjs, 32/32).
- ★ M4.4 SZD-konvertierte TEI byte-clean durch `tei-document.js`/`standoff.js`. **erledigt** (szd_loadability_sweep.mjs 2.103/2.103 Round-Trip; standoff.js via szd_demo_check.mjs).

**H5 - Verifikation, Dokumentation**
- ★ M5.1 Kanonisches integration.md + dieser Plan. **erledigt**.
- + M5.2 integration.md mit Proof-Evidenz anreichern + "Blocker not on disk" korrigieren. **erledigt
  (2026-06-09)**: Proof-Evidenz zentral in paper-evidence.md, integration.md verweist dorthin; die
  "Blocker not on disk"-Behauptung ist entfernt (goals.md führt den Abschluss).
- + M5.5 oekosystem-synthese korrigieren (EditionCrafter, nicht teiCrafter, ist die Hersch-Demo).
  **separat** (Autor, ZBZ-Spur).
- + M5.6 Doku-Sync (data.md/architecture.md auf SZD-Konverter + neuen Test). **erledigt (verifiziert
  2026-06-10)**: beide Dokumente tragen `pipeline/export_tei.py`, den eingefrorenen Kontrakt und die
  Sweep-Proofs.

**H6 - Wissensvaults pflegen** (Promptotyping-Methode, Reproduzierbarkeit fürs Paper)
- + M6.1 teiCrafter-`knowledge/` aktuell halten. laufend.
- + M6.2 szd-htr-`knowledge/` aktuell halten. laufend.
- + M6.3 zbz-ocr-tei-`knowledge/` aktuell halten. separat (Autor).

**H7 - Editopia-Beitrag und Demo-Material** (teiCrafter als Promptotyping-Fall)
- ★ M7.1 teiCrafter als vorzeigbarer Promptotyping-Fall (Werkzeug + Provenienz im Vault/Repo). offen.
- ★ M7.2 Zwei annotierte Worked Examples (je ein ZBZ- und ein SZD-Objekt, end-to-end im Editor).
  **SZD-Hälfte erledigt** (o_szd.1079 im Browser bewiesen, Byte-Diff, 2026-06-08); die ZBZ-Hälfte
  hängt an der separaten ZBZ-Spur.
- + M7.3 Beitrag zu Foliensatz/Volltext, soweit teiCrafter betroffen. offen.

## 9. Erfolgskriterium, Demo-Objekte, kritischer Pfad

Erfolgskriterium (festgelegt 2026-06-07): **je ein reales ZBZ- und SZD-Objekt end-to-end im Browser**
(öffnen, zeilenweise korrigieren, Person/Ort/Werk mit Normdaten annotieren, byte-treu speichern). Das
ist M7.2 und zugleich der vorzeigbare Kern fürs Editopia-Material.

Demo-Objekte:
- **SZD-Schaustück:** o_szd.1079 (Brief an Max Fleischer 1901: echte Personen, Ort, Datum, Umschlag,
  correspDesc, GAMS-Bild). Begleitende Handvoll zur Typabdeckung: o_szd.100/72/2215/161 (§6).
- **ZBZ-Objekt:** aus {1000, 1330, 1540, 2310} (nur diese haben committete Bilder), das textlich
  gehaltvollste; Auswahl in der separaten ZBZ-Spur.

Kritischer Pfad (SZD-Kette): **M1.2 -> M1.3 -> M1.4 -> M1.5** ist vollständig erledigt (Kontrakt
eingefroren, Batch-Konverter byte-treu, voller Korpus 2.103/2.103 byte-identisch geladen). Nächstes:
demo-seitig **M7.2** (SZD-Hälfte bewiesen, ZBZ-Hälfte in der separaten Spur) und optional **M3.7**
(Offline-Gemini). Zeit ist ausdrücklich irrelevant; geordnet wird nur nach Abhängigkeit.

## 10. Offene Punkte, am realen Page-JSON zu bestätigen

- **converter-reference.md §9 (vor dem Einfrieren):** bbox-Konformität über die Handvoll (kein Wert
  > 100); real vorkommende Marker; verworfene Felder (`reading_order`/`lines`/`label`/`source`/`notes`);
  weiteres standOff-Seeding (repository -> listOrg, sender/recipient -> listPerson); images 1:1 zu pages.
- **Whitespace bei Zeilen-Edit (geschlossen 2026-06-08, editor-seitig):** der Editor erhält die Rand-
  Whitespace der bearbeiteten Zeile jetzt verbatim (nur der getrimmte Kern wird editiert,
  `editCellCore`/`splitEdge`). Entscheidung: editor-seitig statt konverter-seitig, weil es die Byte-Treue
  für alle Korpora hält (ZBZ, Wenzelsbibel, SZD). Beleg whitespace_edit_check.mjs 14/14, commit 8fd281c.
- **Korrektheits-Audit (teils separat):** oekosystem-synthese.md behauptet falsch, teiCrafter sei die
  Hersch-Demo (richtig: EditionCrafter v0); zbz-Statuszahlen (3 vs 4); szd schwankende Objektzahlen
  (maßgeblich 2.107). teiCrafter-seitig erledigt: Token-Präfix-Drift (`--color-*`), AI-Violett-Ausfall.

## 11. Umsetzungs-Backlog (nächste Schritte, geordnet)

teiCrafter + SZD:
1. **SZD-Realitätsabgleich + Kontrakt einfrieren: erledigt 2026-06-08** (§9 am echten Page-JSON
   aufgelöst, converter-reference.md status active v0.5).
2. **Whitespace-Vorbehalt: geschlossen 2026-06-08** (editor-seitig, editCellCore; whitespace_edit_check.mjs 14/14).
3. **M1.3 Batch-Konverter: erledigt 2026-06-08** (`pipeline/export_tei.py`, byte-treuer Port;
   port_parity.mjs 6/6, 151/151 Korpus-Stichprobe).
4. **M1.4 + M1.5: erledigt 2026-06-08** (`export_tei.py --all` 2.103/2.103; `szd_loadability_sweep.mjs`
   2.103/2.103 byte-identisch, 40 leer/blank valide; deckt auch M4.4).
5. **M7.2** SZD-Hälfte erledigt (o_szd.1079, 2026-06-08); ZBZ-Hälfte liegt in der ZBZ-Spur.
6. **M3.5 Notiz-UI, M3.7 KI-Vorschlag, M3.3 Live-Lookup: erledigt 2026-06-08** (commits d3fc922,
   f647e7e, 8ce938a; je headless belegt; Browser-Pfade zur Operator-Sichtprüfung offen).
7. **M5.2 / M5.6: erledigt** (M5.2 am 2026-06-09 via paper-evidence.md; M5.6 verifiziert 2026-06-10).
   **M6.x:** laufend (Wissensvaults werden je Session nachgezogen).

Separat (Autor, ZBZ): ZBZ-Bild-URL-Schema verifizieren, Live-ZBZ-Durchlauf, ZBZ-Worked-Example,
oekosystem-synthese-Korrektur, ZBZ-Projektbericht.

### Nächste Schritte (Stand 2026-06-10 nachts, nach den UI-Runden M2.7-M2.13)

**Beschlüsse 2026-06-10 (Operator, Definitionsfragen):** alle fünf Empfehlungen aus
`Wenzelsbibel/knowledge/definitionsfragen-teicrafter-wenzelsbibel.md` ratifiziert.
F1: Editopia-Anteil eingefroren auf laden, blättern, ein Wort korrigieren, No-Op-Save, Faksimile;
Vertiefung läuft auf der Herbst-Schiene fürs PLUS-Team. F2: Kern jetzt Edit-Bestand;
PAGE-XML->TEI-Import als **WB-AP5** registriert, Datenmodell (eine Datei vs. Datei je Buch)
MIT Projektleitung. F3: Projekt first-class als deklaratives Manifest `teicrafter.project.json`;
M2.9 entschieden als "Open project folder" über Verzeichnis-Handle (File System Access), NICHT OPFS.
F4: Ansicht-Umschalter diplomatisch|normalisiert plus Zwei-Feld-Doppelklick-Edit mit attributgenauem
Splice. F5: zweistufiges Abnahme-Gate W1 (Operator-Proxy, echtes Folio end-to-end) / W2
(PLUS-Bearbeiterin ohne Einweisung); Vorbedingung ED.1-ED.7 schreiben.

Gates zuerst (Operator):
1. **Browser-Sichtprüfung** der fünf Feedback-Runden vom 10.06. an beiden Objektstrecken
   (o_szd.1079, ZBZ Doc 1000): Editor-Paradigma, Annotations-Editor mit Normdaten am Text,
   Index-Overlay, XML-Quellansicht mit Highlighting/Check, Home-Navigation. Danach Push-Freigabe
   (lokale Commits auf session/2026-06-07-place-graphic) und Merge-Entscheidung.

Wenzelsbibel (Auftrag `Wenzelsbibel/knowledge/auftrag-teicrafter-wenzelsbibel.md`, Daten lokal,
NICHT committen; Machbarkeit am 10.06. headless bewiesen: codex-2759.xml 78 MB parst in 1,3 s,
Round-Trip byte-identisch, 480 Folios, Wort-Profil):
2. **WB-AP1 Lade-Pfad im Browser: engine-seitig erledigt 2026-06-10** (Validierungs-Cache je
   Doc-Identität statt DOMParser pro Render; Source-View-Guard über 8 MB; Ladezeit im Status;
   wb_codex_check.mjs 16/16: 82 MB parsen 1,8 s, No-Op-Save byte-identisch, Wort-Edit 2,0 s
   Voll-Re-Parse). Offen: Operator öffnet codex-2759.xml via "Open TEI..." im Browser.
3. **WB-AP2 IIIF-Resolver: engine-seitig erledigt 2026-06-10** (project-profiles.js: Profil via
   PID `o:wen.*`, Dateiname -> ÖNB-info.json als OSD-Tile-Source, live verifiziert; Zonen-Bboxen
   aus `@points` in readSurfaces, 34.363/34.363 innerhalb der Surface; keine Prozent-Umrechnung
   nötig, Koordinatenraum == IIIF-Maße). Gate "Projekt lädt, Faksimile steht": Operator-Sichtprüfung.
4. **WB-AP3 Projekt-Modul: engine-seitig erledigt 2026-06-10** (= M5.7-Anschluss): Manifest-Format v1
   in `project-manifest.js` (eintrittsagnostisch, strikt validiert, normalisiert auf die Profil-Form),
   WB-Manifest als erstes Profil committet (Ableitung der Editionsrichtlinien, offene Punkte bleiben
   offen statt erfunden); Manifest vor PID-Fallback, `markup` ersetzt die eingebaute Wrap-Liste
   projektweise; `indices`/`views` deklariert, Konsumenten folgen mit Index-Arbeit und F4.
   `node test/tools/project_manifest_check.mjs` -> **62/62** (Stand 2026-06-11, seither um
   Typ-Bindung und TEI-Scope gewachsen). [proof] Offen: Operator-Sichtprüfung
   (WB-Beispiel lädt mit "project: ... (manifest)" in der Statuszeile); M2.9 als nächster Anschluss.
5. **WB-neu Doppellesung (F4): Engine und UI erledigt 2026-06-11** (Commits ae0b6f5 Engine,
   1ef4bfe UI; orchestriert in zwei Opus-Paketen auf disjunkten Dateimengen). Engine: atomarer
   Mehrteil-Edit `editTextAndAttrs` (`tei-document.js`) plus `editCellReadings` (`edition.js`)
   editieren diplomatischen Kern und `@norm` in EINEM Re-Parse, Verweigerung statt Teilanwendung;
   Zell-Projektion `w`/`hasDualReadings`. UI: Umschalter diplomatisch|normalisiert in der Lesepane
   (nur bei Doppellesung und außerhalb der Quellansicht, je Dokument persistiert), normalisierte
   Ansicht als Anzeige-Projektion, Zwei-Feld-Doppelklick-Edit, Selektions-Annotation auf die
   diplomatische Ansicht beschränkt. `node test/tools/dual_reading_check.mjs` -> **28/28** (atomarer
   Edit byte-treu per Voll-Rekonstruktion, `@orig`-Sync, `@norm` add/remove, Verweigerung bei
   Element-Kindern, Projektion, Real-Codex-Guard SKIPpt ohne lokalen Codex). [proof] Der
   Umschalter bindet an die Dokument-Kodierung (hasDualReadings), nicht an das Manifest;
   die deklarierten `views` bleiben ohne Konsument. Offen: Operator-Sichtprüfung im Browser
   (Umschalter am echten Codex,
   Zwei-Feld-Edit, Annotations-Hinweis in der normalisierten Ansicht).
6. **WB-AP4 StandOff-Apparat**: `app from/to` auf die Inline-`<anchor>`-Paare auflösen und im
   Lesetext markieren (Mechanik analog Textkritik-Schicht).
7. **ED.1-ED.7 User Stories** schreiben (hängender Verweis im Project Overview; vier Arbeitsachsen),
   dann **Gate W1** durchführen.
8. **WB-AP5 PAGE-XML->TEI-Import** der Roh-HTR-Bücher (Muster SZD-Konverter); startet erst nach
   der Datenmodell-Entscheidung mit der Projektleitung.

Editor-Pfad, unabhängig von der Wenzelsbibel:
9. **M2.9 Open project folder: engine-seitig erledigt 2026-06-10.** Verzeichnis-Handle (File
   System Access), Projekt-Panel mit Dateiliste, "New project" schreibt ein Minimal-Manifest;
   Korrektur am selben Tag (Operator): ein Projekt ist KEIN Editionstyp, das Manifest trägt
   `documentTypes` + `files`, das Element-Inventar bindet an den Typ. Plaintext-Dateien öffnen
   als deterministischer line-level-Entwurf (Transport, nicht Interpretation, bewusst nicht
   violett); erster Save erzeugt die .xml im Ordner. Proofs project_manifest_check.mjs 62/62,
   project_case_check.mjs 24/24 (der Operator-Test-Case headless: eigenes Projekt, ein TEI,
   zwei Plaintexts). [proof] Offen: der Browser-Durchlauf genau dieses Test-Cases (Operator-Gate).
10. **M5.7 Editionsrichtlinien der Quellprojekte** (SZD/GAMS, ZBZ Hersch) in die Wissensbasis.

(Commit, Deploy und Veröffentlichung sind bewusst nicht Teil dieses Plans.)

## 12. Abnahme und Evaluation (einfach, je Ziel genau ein Beweis)

Die Methoden sind komplementär: jede beantwortet eine andere Frage und fängt einen anderen Fehler ab.
Zusammen sind sie die Promptotyping-Verifikationskaskade (automatisch, kontextuell, visuell, fachlich).
Echte Daten sind auf jeder Ebene die Regel (synthetisch nur Wenzelsbibel, Lizenz). Ausführliche Fassung:
[testing.md](knowledge/testing.md), Abschnitt "Verifying the Project Goals".

**Ebene 1, maschinell (wiederholbar):**
- Verlustfreiheit: `node test/tools/roundtrip_sweep.mjs` (alle Demo-Dateien byte-identisch).
- Ladbarkeit: `node test/tools/hersch_loadability.mjs` (öffnet als Editor-Modell).
- Feature-Proof: `node test/tools/szd_demo_check.mjs` (Bild-URL, Zonen, place/work, Normdaten-`<idno>`,
  Mention-Linking, line-level, byte-identisch).
- "Diff ist genau die Absicht": Datei öffnen, eine Entität (place + GND-`<idno>`) setzen, speichern, neu
  einlesen; einzige Byte-Differenz ist genau dieser standOff/Markup-Eintrag.
- SZD-Konvertier-Test: jede Handvoll-Datei konvertiert + round-trippt + lädt (Folios/Zellen > 0).
- Schema: well-formed + TEI All RNG + Schematron (ZBZ zusätzlich `zbz_hersch.rng`).

**Ebene 2, Frontend-Analyse (Checkliste je Demo-Objekt, das Erfolgskriterium als sechs Ja/Nein-Checks):**
1. Öffnen (Folios/Zeilen sichtbar). 2. Bild (Faksimile sichtbar, Zone highlightet richtige Zeile).
3. Korrigieren (Zeile editieren, bleibt). 4. Annotieren (Person/Ort/Werk + Normdaten-ID).
5. KI-Vorschlag (M3.7: violett, nach Bestätigung normal). 6. Speichern (öffnet identisch wieder, nur
bewusste Änderungen).

**Ebene 3, fachlich:** ein Domänenexperte bestätigt den Inhalt (Transkription/Annotation korrekt als
Edition). Beide Korpora sind aktuell unreviewed; das ist fachliche Kuration, nicht Werkzeug-Abnahme.

Zwölf visuelle Checks (zwei Objekte) plus die maschinellen Test-Befehle sind die Werkzeug-Abnahme. Jedes
demo-kritische Feature wird zweimal belegt: headless-Proof im Harness UND Browser-Pfad auf dem echten
Objekt.

## 13. Verifikationsprotokoll

Das Dokument ist fertig, wenn jede Aussage entweder maschinell belegt (Befehl/`datei:zeile`) oder als
Entscheidung festgehalten ist. Mechanismen: Quellen-Tag je Aussage; wiederholbare Proofs für den
faktischen Kern (siehe §4); adversariale Audit-Passage (Dokument gegen Quellen auf
Auslassungen/Widersprüche/unbelegte Behauptungen); Widerspruchs-Scan gegen die jeweilige Single Source
of Truth. Bei Konflikt gilt der Domänen-SSoT.

## 14. Quellen und SSoT

| Domäne | Single Source of Truth |
|---|---|
| Kontrakte, Gates | `teiCrafter/knowledge/integration.md` |
| teiCrafter Ziele/Milestones (Register) | `teiCrafter/knowledge/goals.md`, von diesem Plan erweitert |
| SZD-Konverter-Kontrakt | `teiCrafter/knowledge/converter-reference.md` |
| teiCrafter Spec/Architektur/Tests/Design | `teiCrafter/knowledge/{specification,architecture,testing,design,data}.md` |
| zbz Pipeline/Workflow/Qualität/Entscheidungen | `zbz-ocr-tei/knowledge/{pipeline,workflow,quality,decisions,methodik,projekt}.md` |
| szd Pipeline/Daten/Verifikation, Konverter-Kontrakt | `szd-htr/knowledge/{data-overview,verification-concept,htr-interchange-format,teicrafter-integration}.md` |
| Operativer Gesamtstand, Paper-Architektur | Obsidian-Vault `ACTIVE-WORK.md`; JOHD-Paper "The Static Proto-Edition as Editorial Workspace" |

## 15. Vault-Kontext (zur Einordnung)

- Editopia 02.-04.09.2026 Wuppertal; Vortrag 2026-09-02. Eingereichter Abstract ZBZ/Hersch-fokussiert,
  These epistemische Infrastruktur; Demo-Form laut Vault: Live-Vorführung (Hersch-Korpus durch
  EditionCrafter v0) plus auszuarbeitender Volltext. teiCrafter ist die Erweiterung um den Werkzeug-Fall.
- Es existiert ein eigenes JOHD-Paper (Pollin/Zangerl/Hintersteiner), SZD-fokussiert, These "Three
  Functions" eines statischen Codebase. Vom Editopia-Beitrag abgegrenzt.
- teiCrafters primärer eigener Anwendungsfall ist die Wenzelsbibel-Edition (Wort-Ebene, FWF, Herbst
  2026); der Bau-Backlog dafür wird im Wenzelsbibel-Projektdokument geführt.
- Methodischer Rahmen Promptotyping: Repo als Agent-Interface, Verifikationskaskade
  (automatisch -> kontextuell -> visuell -> fachlich), Critical Expert in the Loop (wer erzeugt != wer
  prüft), epistemische Asymmetrie (LLMs erzeugen Plausibles, können es nicht selbst beurteilen).
