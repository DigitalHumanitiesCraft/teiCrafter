---
title: teiCrafter Projektplan und Gesamtsynthese
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
updated: 2026-06-07
language: de
version: 0.4
topics: ["[[Projektplan]]", "[[TEI XML]]", "[[Digitale Editionen]]", "[[Promptotyping]]", "[[Koordination]]"]
related: [integration, goals, project, data, architecture, specification, testing]
---

# teiCrafter Projektplan und Gesamtsynthese

Vollständige, selbsttragende Synthese des Vorhabens (Stand 2026-06-07), bewusst auf Deutsch verfasst
(explizite Vorgabe des Projektleiters; weicht von der CLAUDE.md-Regel "documentation in English" und
den englischen Schwesterdokumenten ab). Dieses Dokument bündelt alle erarbeiteten Informationen,
damit die Arbeit auch nach einer Kontext-Verdichtung fortgesetzt werden kann. Es verweist auf die
Detail-Dokumente, statt sie zu duplizieren: [integration.md](integration.md) (Koordination, von CC2),
[goals.md](goals.md) (englisches Milestone-Register), und die Ökosystem-Synthese im zbz-Repo
(`zbz-ocr-tei/knowledge/oekosystem-synthese.md`, von CC3).

Belegregel: Aussagen mit `[proof]`/`datei:zeile` sind maschinell nachprüfbar; Absichts-Aussagen sind
vom Projektleiter bestätigt (Datum genannt); Zahlen Dritter sind zeitpunktbezogen und vor Nutzung
gegen den Code zu prüfen.

## 1. Zweck und Positionierung

teiCrafter ist ein **nachnutzbares, browserbasiertes Static-Site-Research-Tool**: ein generischer,
verlustfreier Editor für beliebiges TEI-XML, zügig mit Promptotyping gebaut und über mehrere Projekte
hinweg im Einsatz (SZD, ZBZ/Hersch, Wenzelsbibel). Er nimmt TEI aus Eingabe-Pipelines auf, lässt einen
Menschen es Folio für Folio korrigieren und semantisch annotieren, und speichert es byte-treu zurück.
("Im Einsatz" heißt: deployt und als TEI-Editor genutzt; die Entitäten-Annotationsschicht für die
Editopia-Demo ist der aktuelle Ausbau, siehe §6 für den belegten Stand.)

Übergeordneter Anlass ist der **Editopia-Vortrag** (Christopher Pollin; Editopia 02.-04.09.2026,
Wuppertal; Vortrag 2026-09-02). Die belegte These des eingereichten Abstracts: agentenbasierte
Editions-Workflows setzen eine **epistemische Infrastruktur** voraus, also Mechanismen, Arbeitsschritte
und Werkzeuge, um die Ergebnisse LLM-gestützter Verarbeitungsschritte zu verifizieren, zu kuratieren
und zu dokumentieren (Vault: "LLM-gestützte OCR und TEI-Auszeichnung für die Zentralbibliothek
Zürich.md", Z.123-124). Der eingereichte Abstract ist ZBZ/Hersch-fokussiert; **die Abstract-Datei
selbst liegt nicht im Vault** (dort ausdrücklich vermerkt), nur ihre These ist dokumentiert.

teiCrafters Rolle in dieser These: teiCrafter **ist** ein konkretes Stück dieser epistemischen
Infrastruktur, nämlich das deterministische, verlustfreie Werkzeug, in dem ein Mensch maschinell
erzeugte TEI prüft, korrigiert und kuratiert, mit klarer Markierung des Maschinellen. teiCrafter
"erweitert" das Paper damit um einen eigenen Promptotyping-Fall (ein agentisch gebautes
Editionswerkzeug), neben den zwei Pipeline-Fällen SZD und Hersch/ZBZ. (Bestätigt 2026-06-07.)

Primärer eigener Anwendungsfall über Editopia hinaus ist die **Wenzelsbibel-Edition** (PLUS Salzburg,
FWF, Wort-Ebene, ab Herbst 2026).

## 2. Werkzeug-Abgrenzung (verbindlich)

- **teiCrafter = TEI bearbeiten.** Generischer, verlustfreier TEI-Editor. Bearbeitet und annotiert
  beliebiges TEI, projektunabhängig. ZBZ und SZD sind zwei Eingabe-Pipelines, die TEI hineinliefern.
- **EditionCrafter = ganze digitale Editionen.** Eigene, unabhängige Schwesterlinie. Generalisierung
  der statischen Pipeline-Viewer von ZBZ und SZD zu vollständigen Editionen. **Der Editopia-Hersch-
  Demonstrator ist EditionCrafter v0, nicht teiCrafter** (Vault ACTIVE-WORK.md / EditionCrafter.md;
  vom Projektleiter bestätigt). Achtung: `zbz-ocr-tei/knowledge/oekosystem-synthese.md` behauptet das
  Gegenteil (teiCrafter sei die Hersch-Demo); das ist falsch und von CC3 zu korrigieren (siehe §11).
- **Statische Viewer (ZBZ/SZD).** Die projekteigenen statischen Weboberflächen der Pipelines
  (öffentlich read-only Proto-Edition plus lokal Editorial-Workspace; "Three Functions" im JOHD-Paper).
  Gehören zu den jeweiligen Pipelines, nicht zu teiCrafter.

Trennlinie in einem Satz: teiCrafter erzeugt und bearbeitet TEI; EditionCrafter erzeugt die Edition
(Anzeige, Apparat, Publikation). (Bestätigt 2026-06-07.)

## 3. Die drei Projekte, Rollen, Koordination

| Projekt | Pfad | Rolle | Claude |
|---|---|---|---|
| teiCrafter | `GitHub/ResearchTools/teiCrafter` | verlustfreier TEI-Editor, Konvergenz für TEI-Bearbeitung | CC1 (ich) |
| zbz-ocr-tei | `GitHub/DHCraft/zbz-ocr-tei` | Jeanne-Hersch-Pipeline (PDF zu line-level TEI) | CC3 |
| szd-htr | `GitHub/szd-htr` | Stefan-Zweig-Pipeline (Bilder zu Page-JSON; TEI-Konverter ausstehend) | CC2 |

Koordinationsdokumente (kein Duplikat-Inhalt): `teiCrafter/knowledge/integration.md` (kanonisch, CC2),
`HANDOFF-claudes.md` in beiden Repo-Wurzeln, `goals.md` (CC1), `oekosystem-synthese.md` (CC3),
`szd-htr/knowledge/teicrafter-integration.md` (SZD-Konverter-Kontrakt, CC2).

Gemeinsame Haltung: maschinell erzeugte Inhalte gelten als unverifiziert, bis ein Mensch sie prüft
(teiCrafter markiert sie violett über `--color-ai`; zbz/szd über Workflow-/Review-Status).

## 4. Die zwei Eingabe-Pipelines

### ZBZ / Jeanne Hersch (CC3)
- Auftrag der Zentralbibliothek Zürich; zbz ist eine **Pipeline, keine Edition mit eigenem Viewer**
  (Hersch-Viewer und Korrektur-Skills bewusst aus dem Scope, 2026-05-27).
- 286 PDF, 285 finale TEI (`output/tei_final/{id}_final.xml`, Doc 10 unvollständig), ~4.120 Seiten,
  71% FR / 25% DE, 1931-1998. Format: DTA-Basisformat, `type="naegeli"`, RelaxNG `zbz_hersch.rng`,
  enthält `<facsimile>`/`<zone>` mit absoluten Pixelkoordinaten, line-level (`<lb>`), keine `<w>`.
- **`{id}_final.xml` ist teiCrafters natives Format** und öffnet direkt, Textbearbeitung ohne
  Konvertierung.
- **Keine Entitäten in der TEI.** Named-Entity-Auszeichnung wurde am 2026-05-27 (E71) entfernt;
  `<persName>`/`<orgName>`/`<placeName>` werden nicht mehr getaggt (zbz pipeline.md:241-245). Folge:
  Beim ZBZ-Worked-Example wird die semantische Annotation **frisch in teiCrafter erzeugt**, sie ist
  nicht schon vorhanden. Das ist für das Schaustück günstig (zeigt teiCrafter beim Annotieren). Eine
  Vorsortierung nach Entitäten-Dichte ist nicht möglich; rangiert wird nach Textgehalt (real genannte
  Personen/Orte im Hersch-Text).
- **Bild-Sachzwang.** Faksimile-Bilder sind nur für **vier** Dokumente committet (1000, 1330, 1540,
  2310); der Rest ist lokal (~4 GB), kein IIIF, keine gehosteten URLs. Pfad-Schema
  `docs/images/<id>/<id>_p00N.png`; reales TEI-Beispiel `<graphic url="../images/20/20_p001.png"/>`
  (zbz workflow.md:259-266, README.md:103-105). Daher muss ein ZBZ-Demo-Objekt **mit Bild** aus diesen
  vier kommen.
- Belegte Zahlen (zeitpunktbezogen, gegen Code prüfen): 285/285 schema-valide (E68); Fidelity-CER
  Median 1,83% / Mean 4,26% (n=25, BCa-Bootstrap); Volltext-CER (Mean 20,75%) nur Diagnose;
  Pipeline-Vorteil -7,90 pp (p=0,07, nicht signifikant; frühere -14,83 pp zurückgezogen,
  Trimming-Artefakt). Workflow-Status **3-stufig** (`unverifiziert | in_arbeit | verifiziert`,
  `page_manifest.py:57`), alle 285 unverifiziert.
- Offen zbz-seitig: CER-Baseline am Hersch-Korpus, ZBZ-Projektbericht, Editopia. Abschluss-Meeting mit
  ZBZ am 2026-06-08.

### SZD / Stefan Zweig (CC2)
- Teilprojekt von Stefan Zweig Digital; VLM-HTR aus Faksimiles (Literaturarchiv Salzburg), Bilder via
  GAMS. CC-BY 4.0.
- 2.107 Objekte, 18.719 Scans, ~23,6 GB, 4 Sammlungen (lebensdokumente 127 / werke 169 /
  aufsatzablage 625 / korrespondenzen 1.186), DE ~96%, 9 Dokument-Gruppen A-I.
- Produziert **Page-JSON v0.2** (`results/<collection>/{id}_page.json`), PAGE-XML 2019, METS/MODS.
  **Noch keine Transkriptions-TEI** (Katalog-TEI ist nur Metadaten). Nur ~25 von ~2.103 Objekten haben
  Layout-Regionen; der Rest ist Text-only (`<lb>` + Bild, Zonen nur wo vorhanden).
- **Bilder vorhanden als GAMS-URLs** (`https://gams.uni-graz.at/...`), direkt im Page-JSON-Feld
  `metadata.images` (szd README.md:45, CLAUDE.md:309/341, "GAMS-URLs als `<img src>`"). Damit ist SZD
  für den Bild-Teil der Demo sogar besser geeignet als ZBZ (statische URL, kein lokaler Store nötig).
- **Echte benannte Entitäten vorhanden** (Personen wie Stefan Zweig, Lotte Zweig, Max Fleischer,
  Erwin Rieger; Orte; Werke wie Schachnovelle, Clarissa). o_szd.1079 ist ein "Brief an Max Fleischer"
  (1901). Gut fürs Schaustück.
- **0 echte Ground Truth** (`gt_verified`) -> alle SZD-CER/Qualitätszahlen sind Schätzungen;
  VLM-`confidence` immer "high" (wertlos); ~2.055/2.107 verarbeitet.

## 5. teiCrafter Ziel-Contract (was der Editor liest und bewahrt)

Generisch nach local-name, kein Projekt-Profil ([data.md](data.md), [architecture.md](architecture.md),
`docs/js/editor/`):
- `<pb>` (opt. `@facs`, `@n`) trennt Folios; `<lb>`/`<l>` trennt Zeilen.
- Lesetext-Knoten werden editierbare Zellen: Wort-Ebene nur bei `<w xml:id>`, sonst Zeilen-Ebene.
- `<facsimile>`/`<surface>`/`<zone ulx/uly/lrx/lry>` treiben den OpenSeadragon-Viewer; `@facs` verknüpft
  Zeile und Zone bidirektional.
- `<standOff>`/`<note target>` tragen Entitäten/Apparat.
- Roher String ist kanonisch, Bearbeitung ist Offset-Splice, `serialize()` byte-identisch; nicht
  Interpretiertes bleibt verbatim.
- Laden: **Open** (File System Access API / Datei-Input) für jedes lokale XML; plus zwei fest
  verdrahtete Demo-Fetches. Eine geöffnete Datei bekommt `app.imageBase = null`.
- **Faksimile-Lücke:** Der Viewer zeigt ein Bild nur mit imageUrl UND surface; imageUrl kommt heute nur
  aus dem fest verdrahteten Demo-Pfad, der Editor liest die Bild-URL nicht aus dem TEI (kein
  `<graphic>`-Support). Fix: `<graphic url>` in jede `<surface>` schreiben (Pipeline-seitig: SZD =
  GAMS-URL, ZBZ = `docs/images/<id>/<id>_p00N.png`) und `facsimile.js` `surface.graphic` als imageUrl
  lesen lassen (verlustfrei, generalisiert).

## 6. Bewiesener Stand (proofs)

- ZBZ verlustfreier Round-Trip: `node test/tools/roundtrip_sweep.mjs` -> 294/294 byte-identisch
  (285 Hersch + 4 SZD + 5 synthetisch). [proof]
- ZBZ Editor-Ladbarkeit: `node test/tools/hersch_loadability.mjs` -> **285/285 nutzbare
  Editor-Ansicht**, 0 Parse-Fehler; gesamt 4.115 Folios, 49.324 Zellen, 23.421 Zonen, 266 Notes,
  0 standOff. Report: `test/reports/hersch-loadability.json`. [proof]
- SZD Basis-Konverter-Proof: `test/tools/szd-pagejson-to-tei.mjs` (am 2026-06-07 aus `c:\tmp` ins Repo
  versioniert) erzeugt aus `o_szd.100_page.json` eine TEI, die gegen die echte Engine
  ([edition.js](docs/js/editor/edition.js)) byte-identisch round-trippt und line-level lädt (3 Folios,
  38 Zellen, 2 Personen mit GND). [proof] Achtung: der Proof belegt Ladbarkeit und Byte-Treue, NICHT die
  Zonen-Geometrie (die bbox-Einheit ist offen, siehe §7 und §11).
- SZD-TEI-Datenmodell finalisiert (Workflow über 4 Sammlungen), siehe §7.
- Editor-Features gebaut (additiv, verlustfrei, 2026-06-07): place-Entität (M3.1), Mention-Linking
  (M3.4), `<graphic>`-Lesen Engine-Seite (M2.2): `node test/tools/szd_demo_check.mjs` (17/17), alle drei
  festen Proofs bleiben grün. [proof] Offen: Browser-Visualtest des GAMS-Bilds (CORS) und Normdaten-`@ref`
  (M3.3, blockiert durch die Lookup-Entscheidung).

Was noch NICHT bewiesen ist (ehrlicher Rest): die Entitäten-Annotationsschicht (Ort/Werk/Normdaten-UI)
ist noch nicht gebaut; der SZD-Batch-Konverter existiert nur als Einzel-Prototyp; `<graphic>`-Support
fehlt; der Gemini-Annotations-Vorschlagsschritt ist konzipiert, nicht implementiert.

Hinweis: `pipeline.mjs` (Vor-Pivot) existiert noch in der teiCrafter-Wurzel, ist aber ein nicht
lauffähiger Torso: er importiert das im Pivot gelöschte `docs/js/pipeline/` (bestätigt nicht vorhanden)
und bricht mit ERR_MODULE_NOT_FOUND ab. Seine ~2033 gitignored `output/*.tei.xml` stammen aus der
gelöschten Engine (LLM-`<div>/<head>/<p>`-Blöcke, NICHT line-level) und sind mit heutigem Code nicht
reproduzierbar. "2030 TEIs fertig" ist kein gültiger Stand. (Korrigiert 2026-06-07: zuvor stand hier
falsch "pipeline.mjs ist gelöscht".)

## 7. SZD-TEI-Datenmodell (Konverter-Kontrakt, Zusammenfassung)

Vollständige Spezifikation gehört in `knowledge/converter-reference.md` (CC1, noch zu schreiben,
entblockt CC2). Der Konverter ist **deterministisch** (Page-JSON -> TEI nach Regel, kein LLM): das ist
die verlustfreie, reproduzierbare, kostenlose Stufe und trägt das Fidelity-Argument. Kern:
- **teiHeader** aus `source` + `descriptive_metadata`: Titel, author/editor (persName + GND-`@ref`),
  respStmt (HTR-Modell + menschlicher Reviewer), publicationStmt (Lizenz CC-BY + Maschinen-Hinweis),
  msDesc/msIdentifier (repository+GND, country, settlement, shelfmark, PID), physDesc (support, extent,
  dimensions, handDesc je Hand), history/origin (origPlace, origDate), profileDesc (langUsage pro
  Objekt, textClass; correspDesc nur für Korrespondenzen, soweit per Signatur matchbar), revisionDesc.
- **standOff**: listPerson/listOrg/listPlace, aus Metadaten geseedet (persName/orgName/placeName +
  idno/`@ref` GND). Hinweis: `place` ist in teiCrafters `standoff.js` noch nicht klick-/mutierbar (nur
  statisch geseedet), bis der Typ ergänzt ist (siehe H3).
- **facsimile**: eine `<surface>` je Seite (`<graphic>` GAMS-URL + Maße), `<zone>` je Region
  (bbox -> px). **bbox-Einheit OFFEN:** der Prototyp nimmt Prozent an (`(x/100)*image_width`), eine
  On-Disk-Lesung (cc1-session-report.md Punkt 4) deutet absolute Einheit `[x,y,w,h]` an; der
  Round-Trip-Proof entscheidet die Geometrie NICHT. CC2 bestätigt die Einheit im Realitätsbericht, dann
  legt converter-reference.md sie eindeutig fest. Zonen nur region-, nicht zeilengenau (Regionen tragen
  keinen Zeilentext).
- **body** line-level (`<pb>` + `<lb>`), je Dokumenttyp: typescript (Default), manuscript/diary
  (Achtung: nur Doppel-Tilde `~~x~~` = `<del>`, einzelne `~` ist Autoren-Gedankenstrich), letter
  (correspDesc im Header, opener/address/closer/signed, `[Stempel:]`->note/stamp), form (Pipe-Tabellen
  -> table/row/cell), newspaper_clipping (Spalten linearisiert, fw-Kopfzeilen).
- **Editoriale Marker** (real vorhanden): `[?]`->`<unclear>`, `[...]`/`[...N...]`->`<gap>`,
  `~~x~~`->`<del>`, `{x}`->`<add>`, `[Stempel:]`->`<note type="stamp">`. `[Marginalie:]` theoretisch.
- **Leerseiten**: `<pb type="blank"/>` für blank/color_chart, Text dort verwerfen, aber color_chart mit
  eindeutigem Text nicht blind verwerfen.
- **Erste Konvertier-Handvoll** (deckt die Body-Typen ab UND enthält das Schaustück; exakte IDs gegen
  das Repo prüfen): o_szd.100 (Typoskript), o_szd.72 (Tagebuch, Tilde-Fall), **o_szd.1079 (Brief,
  Schaustück: Umschlag+Zonen+correspDesc+GAMS-Bild)**, o_szd.2213/2215 (Zeitungsausschnitt),
  o_szd.1056/161 (Formular, Pipe-Tabellen). Die szd-eigenen kanonischen Testobjekte sind o_szd.72, 78,
  160, 161, 287, 2215, 1079 (szd verification-concept.md).

## 8. Semantische Annotation (der Mehrwert von teiCrafter)

Definition: dem Text maschinenlesbare Bedeutung hinzufügen, in drei Schritten (abgrenzen,
klassifizieren, mit Normdaten verknüpfen). Zwei Familien:
- **Familie 1 Entitäten-Anreicherung:** Personen, Orte, Organisationen, Werke (+ GND/GeoNames/Wikidata),
  Datum (Normalisierung). Das ist die Lücke, die beide Pipelines auslassen: ZBZ hat NER 2026-05-27
  entfernt (E71), SZD seedet nur Metadaten-Entitäten in den Header, nicht die Erwähnungen im Text.
- **Familie 2 editorische Annotation:** Notizen/Fußnoten/Kommentare; textkritische Marker
  (unclear/gap/del/add).

teiCrafter heute: nur `person`/`org`/`event`, nur Name (kein `place`, kein `werk/title`, kein
Normdaten-`@ref`, keine Notiz-Erstell-UI, nur read-only Anzeige vorhandener Notes). Diese Lücken sind H3.

**KI-assistierte Annotation (neue Architektur, demonstriert die Editopia-These).** Ein **Offline-
Pipeline-Schritt mit Gemini 3.1 Flash Lite** liest die fertige TEI, schlägt Entitäten (Person/Ort/Werk)
samt Normdaten-Kandidaten (GND/GeoNames/Wikidata) vor und schreibt sie als **unverifizierte** Einträge
in den `<standOff>` (maschinell, ungeprüft). teiCrafter zeigt sie violett (`--color-ai`); der Mensch
bestätigt, korrigiert oder verwirft sie und setzt das Mention-Linking. Begründung:
- Trennung der Stufen: deterministische Konvertierung (verlustfrei) bleibt getrennt vom probabilistischen
  Vorschlag (assistiv). Ein LLM für die Konvertierung selbst wäre falsch (Kosten, Nichtreproduzierbarkeit,
  Halluzination, bricht das Fidelity-Argument).
- Architektur-Konformität: teiCrafter bleibt rein im Browser, kein API-Schlüssel im Static-Site-Code;
  Gemini läuft als billiger Schritt davor in der Pipeline ("erste Iteration der Pipeline").
- Inhaltliche Deckung: Das ist genau die These des Abstracts (epistemische Infrastruktur: Werkzeuge zum
  Verifizieren/Kuratieren/Dokumentieren von LLM-Ergebnissen) und das Designprinzip "KI assistiert,
  Mensch entscheidet". Der minimale Demo-Gate funktioniert auch ohne diesen Schritt (manuelle
  Annotation); der Schritt macht die Demo aber zur direkten Vorführung der Kernaussage.

**Normdaten-Modus (Entscheidung Projektleiter, 2026-06-07): alle drei Wege, gestaffelt auf einem
Mechanismus.** Jede Entität trägt `@ref`/`<idno>` mit der Autoritäts-ID; drei Wege füllen dasselbe Feld:
(1) **Fundament, Handeingabe** (M3.3-Kern): Feld existiert, Experte tippt/fügt die ID ein; jetzt baubar,
alle anderen Wege schreiben hier hinein. (2) **Interaktive Assistenz, Live-Lookup**: Name eintippen,
client-seitig GND/GeoNames/Wikidata abfragen, Treffer wählen, Feld wird gefüllt. (3) **Batch-Assistenz,
offline Gemini** (M3.7): vor dem Öffnen Vorschläge unverifiziert (violett) in den standOff; Mensch
bestätigt. Konstante: der Mensch prüft und entscheidet immer. Bau-Reihenfolge: (1) jetzt, dann (3)
(stärkster Beleg der These), dann (2) (meiste Frontend-Arbeit wegen CORS und Rate-Limits).

## 9. Ziele und Milestones

Legende: **★** demo-/vortragskritisch, **+** vollständige Ambition (parallel, nicht blockierend).
Status: erledigt / läuft / offen / später.

**H1 - Beide Pipelines in teiCrafter bringen**
- ★ M1.1 ZBZ direkt ladbar. erledigt (hersch_loadability.mjs, 285/285). CC1
- ★ M1.2 SZD `converter-reference.md` (volles Page-JSON->TEI-Mapping, deterministisch). läuft. CC1 (Blocker CC2)
- ★ M1.3 SZD Batch-Konverter `pipeline/export_tei.py`. offen. CC2
- ★ M1.4 SZD Demo-Handvoll konvertieren + engine-verifiziert (o_szd.1079 plus Typ-Abdeckung). offen. CC1
- + M1.5 SZD alle ~2.103 konvertieren + Ladbarkeits-Sweep. offen. CC1/CC2

**H2 - Sehen, navigieren, korrigieren**
- ★ M2.1 Editor-Modell pro Datei. erledigt. CC1
- ★ M2.2 Bildanzeige bei geöffneten Dateien (`<graphic>`-Support; SZD via GAMS-URL, ZBZ via lokalem Pfad). Engine-Seite erledigt (szd_demo_check.mjs); Browser-Visualtest (CORS) offen. CC1
- ★ M2.3 Live-Browser-Durchlauf ZBZ (große Docs, Leerfolios, Zonen, Rendering). offen. CC3
- ★ M2.4 ZBZ-Bild-URL-Schema für `<graphic>` (Bilder nur für 1000/1330/1540/2310 vorhanden). offen. CC3

**H3 - Semantisch annotieren**
- ★ M3.1 Ort-Entität (`place`/`placeName`) in `standoff.js` + `index-panel.js`. erledigt (szd_demo_check.mjs). CC1
- ★ M3.3 Normdaten-`@ref` (GND/GeoNames/Wikidata) auf alle Typen + UI. Entscheidung 2026-06-07: alle drei Wege (Hand, Live-Lookup, Gemini-Batch) auf einem `@ref`-Mechanismus; Kern (Handeingabe) jetzt baubar, nicht mehr blockiert. offen. CC1
- ★ M3.4 Mention-Linking auf neue Typen. erledigt (linkMention typ-unabhängig, szd_demo_check.mjs). CC1
- ★ M3.7 KI-Annotations-Vorschlag: Offline-Gemini-3.1-Flash-Lite-Schritt schreibt unverifizierte
  Entitäten + Normdaten-Kandidaten in `<standOff>`; teiCrafter zeigt sie violett zur menschlichen
  Prüfung. offen. CC1/CC2 (minimaler Gate geht auch manuell)
- + M3.2 Werk-Entität (`title`/`bibl`). offen. CC1
- + M3.5 Notizen/Fußnoten-Erstell-UI. offen. CC1
- + M3.6 Textkritik (`unclear`/`gap`/`del`/`add`). später. CC1

**H4 - Verlustfreiheit als Invariante**
- ★ M4.1 Engine-Round-Trip-Sweep. erledigt (roundtrip_sweep.mjs). CC1
- ★ M4.2 Editor-Ladbarkeits-Sweep. erledigt. CC1
- ★ M4.3 Jedes Feature byte-clean (Regressionstest). laufend. CC1
- ★ M4.4 SZD-konvertierte TEI byte-clean durch `tei-document.js`/`standoff.js`. offen. CC1

**H5 - Koordination, Verifikation, Dokumentation**
- ★ M5.1 Kanonisches integration.md + HANDOFF + dieser Plan. erledigt/laufend. CC1/CC2
- + M5.2 integration.md mit Proof-Evidenz anreichern + "Blocker not on disk" korrigieren. offen. CC1
- + M5.5 Bericht-Korrektheit (3-vs-4-Status; oekosystem-synthese korrigieren: EditionCrafter, nicht
  teiCrafter, ist die Hersch-Demo). offen. CC2/CC3
- + M5.6 Doku-Sync (data.md/architecture.md auf SZD-Konverter + neuen Test). offen. CC1

**H6 - Wissensvaults pflegen** (Promptotyping-Methode, Reproduzierbarkeit fürs Paper)
- + M6.1 teiCrafter-`knowledge/` aktuell halten. laufend. CC1
- + M6.2 szd-htr-`knowledge/` aktuell halten. laufend. CC2
- + M6.3 zbz-ocr-tei-`knowledge/` aktuell halten. laufend. CC3

**H7 - Editopia-Beitrag und Demo-Material** (teiCrafter als Promptotyping-Fall)
- ★ M7.1 teiCrafter als vorzeigbarer Promptotyping-Fall (Werkzeug + Provenienz im Vault/Repo). offen. CC1
- ★ M7.2 Zwei annotierte Worked Examples (je ein ZBZ- und ein SZD-Objekt, end-to-end im Editor). offen. CC1
- + M7.3 Beitrag zu Foliensatz/Volltext, soweit teiCrafter betroffen. offen. CC1
- Hinweis: ZBZ-Projektbericht, ZBZ-Abnahme und die EditionCrafter-Hersch-Demo sind benachbarte
  Ergebnisse, die NICHT teiCrafter gehören (zbz-Projekt bzw. EditionCrafter), aber denselben
  Editopia-Rahmen teilen.

## 10. Erfolgskriterium, Demo-Objekte, kritischer Pfad

Erfolgskriterium (vom Projektleiter gewählt, 2026-06-07): **je ein reales ZBZ- und SZD-Objekt
end-to-end im Browser** (öffnen, zeilenweise korrigieren, Person/Ort/Werk mit Normdaten annotieren,
byte-treu speichern). Das ist M7.2 und zugleich der vorzeigbare Kern fürs Editopia-Material.

Demo-Objekte (Entscheidung 2026-06-07: Handvoll echter Objekte, jetzt konvertieren; Auswahl deckt
Typen ab UND liefert ein gehaltvolles Schaustück):
- **SZD-Schaustück:** o_szd.1079 (Brief an Max Fleischer 1901: echte Personen, Ort, Datum, Umschlag,
  correspDesc, GAMS-Bild). Begleitende Handvoll zur Typabdeckung: o_szd.100/72/2213/1056 (§7).
- **ZBZ-Objekt:** aus {1000, 1330, 1540, 2310} (nur diese haben committete Bilder), das textlich
  gehaltvollste; konkrete Wahl durch Lesen dieser vier zu bestimmen.

Kritischer Pfad: SZD-Kette **M1.2 (CC1) -> M1.3 (CC2) -> M1.4 (CC1)**; daher steht M1.2
(converter-reference.md) oben. Unabhängig parallel: M3.1/M3.3/M3.4 (Annotation, CC1, sofort startbar),
M3.7 (Gemini-Vorschlag, sobald TEI vorliegt), M2.4 (CC3) -> M2.2 (CC1, Bild). Zeit ist ausdrücklich
irrelevant; geordnet wird nur nach Abhängigkeit.

## 11. Offene Punkte, Blocker, Widersprüche

- **Blocker:** converter-reference.md fehlt (CC1) -> CC2 wartet. `<graphic>`-Support fehlt (CC1) ->
  Bild bei geöffneten Dateien. CC3 schuldet das ZBZ-Bild-URL-Schema (`docs/images/<id>/<id>_p00N.png`,
  Bilder nur für vier Docs) für die `<graphic>`-Injektion; CC3s G1.3 (ZBZ-Dateien IN teiCrafter testen)
  steht aus.
- **Geklärt seit 2026-06-07:** Editopia-Abstract-These ist bekannt (epistemische Infrastruktur), die
  Abstract-Datei selbst liegt nicht im Vault. ZBZ hat keine Entitäten mehr (E71). ZBZ-Bilder nur für
  vier Docs. SZD-Bilder als GAMS-URLs vorhanden. Konvertierung betrifft nur SZD.
- **Noch zu klären (nur vom Projektleiter):** (a) "Lanes" = Eingabe-Pipelines (vorläufig angenommen);
  (b) Architektur-Freigabe des Gemini-Annotations-Vorschlagsschritts (offline-Pipeline vs. manuell vs.
  Browser-eigener Schlüssel); (c) konkrete SZD-Handvoll bestätigen.
- **Korrektheits-Audit:** oekosystem-synthese.md (CC3) behauptet falsch, teiCrafter sei die Hersch-Demo
  (richtig: EditionCrafter v0). zbz pipeline.md/methodik.md nennen teils 4 statt 3 Status; README-E-Zähler
  veraltet; `curated_tei/` als Gold deklariert, aber leer. szd: schwankende Objektzahlen (maßgeblich
  2.107), projizierte Modell-/Session-Daten. teiCrafter: Token-Präfix-Drift in Doku (`--tc-*` veraltet,
  Code nutzt `--color-*`), AI-Violett war vor dem 2026-06-04-Audit still ausgefallen.

## 12. Verifikationsprotokoll

Das Dokument ist fertig, wenn jede Aussage entweder maschinell belegt (Befehl/`datei:zeile`) oder vom
Projektleiter bestätigt ist. Mechanismen: Quellen-Tag je Aussage; wiederholbare Proofs für den
faktischen Kern (siehe §6); Abdeckungs-Checkliste aus den Quellen; adversariale Audit-Passage (Dokument
gegen Quellen auf Auslassungen/Widersprüche/unbelegte Behauptungen); Widerspruchs-Scan gegen die
jeweilige Single Source of Truth. Bei Konflikt gilt der Domänen-SSoT.

## 13. Quellen und SSoT

| Domäne | Single Source of Truth |
|---|---|
| 3-Claude-Koordination, Kontrakte, Gates | `teiCrafter/knowledge/integration.md` (CC2) |
| teiCrafter Ziele/Milestones (Register) | `teiCrafter/knowledge/goals.md` (CC1), von diesem Plan erweitert |
| teiCrafter Spec/Architektur/Tests/Design | `teiCrafter/knowledge/{specification,architecture,testing,design,data}.md` |
| zbz Pipeline/Workflow/Qualität/Entscheidungen | `zbz-ocr-tei/knowledge/{pipeline,workflow,quality,decisions,methodik,projekt}.md` |
| zbz Viewer/Frontend-Gaps, Ökosystem | `zbz-ocr-tei/knowledge/{viewer,frontend-gaps,oekosystem-synthese}.md` |
| szd Pipeline/Daten/Verifikation, Konverter-Kontrakt | `szd-htr/knowledge/{data-overview,verification-concept,htr-interchange-format,teicrafter-integration}.md` |
| Operativer Gesamtstand, Paper-Architektur | Obsidian-Vault `ACTIVE-WORK.md`; JOHD-Paper "The Static Proto-Edition as Editorial Workspace" |
| Editopia-Abstract (These dokumentiert, Datei extern) | Vault `Projects/zbz-ocr-tei/LLM-gestützte OCR und TEI-Auszeichnung ...md` |

## 14. Vault-Kontext (zur Einordnung)

- Editopia 02.-04.09.2026 Wuppertal; Vortrag 2026-09-02. Eingereichter Abstract ZBZ/Hersch-fokussiert,
  These epistemische Infrastruktur; Demo-Form laut Vault: Live-Vorführung (Hersch-Korpus durch
  EditionCrafter v0, OCR-Evaluierung vorher/nachher) plus auszuarbeitender Volltext zum Abstract.
  teiCrafter ist die Erweiterung um den Werkzeug-Fall.
- Es existiert ein eigenes JOHD-Paper (Pollin/Zangerl/Hintersteiner), SZD-fokussiert, These "Three
  Functions" eines statischen Codebase (Lese-Interface, Kurations-Workspace, Pipeline-Verifikation),
  verankert in Vogelers konzentrischer Edition und Proto-Edition. Vom Editopia-Beitrag abgegrenzt.
- teiCrafters primärer eigener Anwendungsfall ist die Wenzelsbibel-Edition (Wort-Ebene, FWF, Herbst
  2026); der Bau-Backlog dafür wird im Wenzelsbibel-Projektdokument geführt.
- Methodischer Rahmen Promptotyping: Repo als Agent-Interface, Verifikationskaskade
  (automatisch -> kontextuell -> visuell -> fachlich), Critical Expert in the Loop (wer erzeugt != wer
  prüft), epistemische Asymmetrie (LLMs erzeugen Plausibles, können es nicht selbst beurteilen).

## 15. Nächste Schritte

1. M1.2: `knowledge/converter-reference.md` schreiben (deterministisch, entblockt CC2). Quelle: §7 plus
   `test/tools/szd-pagejson-to-tei.mjs` plus das finalisierte Datenmodell.
2. M1.4: die SZD-Handvoll (§7/§10) konvertieren und engine-verifizieren; o_szd.1079 als Schaustück.
3. M3.1/M3.3/M3.4: Ort-Entität + Normdaten-`@ref` + Mention-Linking in `standoff.js`/`index-panel.js`.
4. M3.7: Gemini-3.1-Flash-Lite-Annotations-Vorschlagsschritt (offline) -> unverifizierte standOff-Entitäten.
5. M2.2: `<graphic>`-Support in `facsimile.js`/`edition.js` (SZD GAMS-URL sofort, ZBZ sobald Schema steht).
6. ZBZ-Demo-Objekt aus {1000,1330,1540,2310} durch Lesen bestimmen.
7. Offene Klärungen (§11): "Lanes" bestätigen; Gemini-Architektur freigeben; SZD-Handvoll bestätigen.

## 16. Koordination und Aufträge (project-plan.md als Koordinations-Hub)

Rollen und Endprodukt (bestätigt 2026-06-07): **Das Endprodukt ist das Gesamtprojekt**, also alle
Implementierungen (teiCrafter, szd, zbz), die Folientexte und der Volltext des Editopia-Beitrags, sowie
alle Knowledge-Dokumente in allen drei Repos. **CC1 (ich) orchestriert alle Claude-Codes, sich selbst
eingeschlossen**, um dieses Ziel zu erreichen: schärft Ideen und Plan, schreibt die Aufträge für CC2 und
CC3, führt ihre Berichte zusammen, pflegt die Knowledge-Dokumente, und führt die teiCrafter-
Implementierung sowie die teiCrafter-betreffenden Vortragsartefakte (Folientext, Volltext-Anteil) in
eigenen Ausführungs-Schritten aus. ("Nur orchestrieren" wäre zu eng: CC1 orchestriert und führt den
eigenen Teil aus.) Kanal: CC1 erreicht CC2/CC3 über den Projektleiter (Prompts hin, Berichte zurück).
Berichte laufen bei CC1 zusammen und aktualisieren §6/§9/§10/§11.

### Auftrag CC2 (szd-htr), erste Vorbereitung
Vorbereitung, die nicht auf converter-reference.md wartet und sie zugleich absichert. Deterministischer
Konverter (Page-JSON -> TEI nach Regel), kein LLM.
1. Realitätsabgleich Page-JSON v0.2 für die Handvoll (o_szd.100, 72, 1079, 2215/2213, 161/1056):
   echte JSON-Struktur und jedes vorhandene Feld auflisten.
2. Bilder: metadata.images je Objekt bestätigen, 1-2 echte GAMS-URLs, image_width/height (ja/nein).
3. Layout: Regionen/Zonen je Objekt (ja/nein + N) oder text-only.
4. Editoriale Marker: welche von [?], [...]/[...N...], ~~x~~, {x}, [Stempel:] real vorkommen (je Beispiel).
5. Prototyp-Lauf: test/tools/szd-pagejson-to-tei.mjs je Objekt, Erfolg oder exakte Fehlermeldung.
6. Konverter-Skelett pipeline/export_tei.py anlegen (CLI: ID rein, TEI raus), noch keine Vollausführung.
Berichtspflicht an CC1: Tabelle je Objekt (ID, Typ/Gruppe, Regionen, images-URL, width/height, Sprache,
Marker); Liste der Page-JSON-Felder, die §7 NICHT abbildet, und der §7-Felder, die real FEHLEN;
Prototyp-Ergebnis je Objekt; ein Satz, was CC1 in converter-reference.md eindeutig festlegen muss.

### Auftrag CC3 (zbz-ocr-tei), erste Vorbereitung
1. Bild-URL-Schema liefern (M2.4): für 1000/1330/1540/2310 je Seite die exakte <graphic url>-Form und
   die Erreichbarkeit im deployten Static-Site-Demo (Origin-Pfad docs/images/<id>/<id>_p00N.png,
   gehostete URL, oder IIIF-Pendant).
2. Demo-Objekt empfehlen: textlich gehaltvollstes der vier (ZBZ-TEI hat seit E71 keine Entitäten-Tags;
   nach Textinhalt rangieren), je Kandidat 3-5 echte Erwähnungen mit Folio/Zeile.
3. Render-Check der vier Docs in teiCrafter (lädt, Bild, Zonen-Highlight, hi/foreign/note/choice/unclear/figure).
4. Korrektur oekosystem-synthese.md: EditionCrafter v0 (nicht teiCrafter) ist die Editopia-Hersch-Demo;
   Workflow-Status 3 statt 4 vereinheitlichen.
Berichtspflicht an CC1: Bild-URL-Schema als kopierbare Regel (Muster + Beispiel je Doc) plus
Erreichbarkeit; empfohlenes Demo-Objekt mit Erwähnungs-Liste; Render-Check-Tabelle; Bestätigung der
oekosystem-synthese-Korrektur (Diff-Stichpunkte).

### Umsetzungs-Aufträge (Runde 2, Implementierung)

Stand 2026-06-07: M2.2 (Engine), M3.1, M3.4 gebaut (szd_demo_check.mjs grün). Die ausführlichen,
kopierfertigen Prompts wurden über den Projektleiter relayed; hier die Aufgaben je Claude in Kurzform.

- **CC1 (ich):** (1) M1.2 converter-reference.md (Entwurf jetzt aus Prototyp, final gegen CC2-Bericht);
  (2) M2.2 Browser-Visualtest (GAMS-Bild, CORS); (3) M3.3 Normdaten-`@ref` nach der Lookup-Entscheidung;
  (4) M3.7 Gemini-Vorschlag (offline) nach derselben Entscheidung; (5) M7.2 zwei Worked Examples;
  (6) byte-clean halten, Knowledge-Docs nachziehen.
- **CC2:** (1) Realitätsbericht der Handvoll; (2) bbox-Einheit klären (Prozent vs. absolut, mit Beleg);
  (3) Prototyp-Lauf je Objekt; (4) nach converter-reference.md: `pipeline/export_tei.py` bauen + Handvoll
  erzeugen.
- **CC3:** (1) M2.4 Bild-URL-Schema für 1000/1330/1540/2310 + Erreichbarkeit im Deploy; (2) Demo-Objekt
  empfehlen (Textgehalt); (3) M2.3 Render-Check der vier Docs; (4) M5.5 oekosystem-synthese korrigieren.

Entscheidung des Projektleiters (2026-06-07), H3 entblockt: **alle drei Normdaten-Wege**, gestaffelt auf
einem `@ref`-Mechanismus (Handeingabe als Fundament jetzt baubar, dann Gemini-Batch M3.7, dann
Live-Lookup). M3.3 ist damit nicht mehr blockiert; CC1 kann den Kern sofort bauen.

## 17. Abnahme und Evaluation (einfach, je Ziel genau ein Beweis)

Die Methoden sind komplementär, kein Entweder-oder: jede beantwortet eine andere Frage und fängt einen
anderen Fehler ab. Zusammen sind sie die Promptotyping-Verifikationskaskade (automatisch, kontextuell,
visuell, fachlich). Echte Daten sind auf jeder Ebene die Regel (synthetisch nur Wenzelsbibel, Lizenz).
Jedes vortragskritische Ziel hat genau einen Beweis: einen Befehl (Test) oder eine beobachtbare
Frontend-Prüfung. Eine Tabelle Ziel -> Beweis -> grün/rot hält den Stand. Ausführliche Fassung:
[testing.md](testing.md), Abschnitt "Verifying the Project Goals".

**Ebene 1, maschinell (wiederholbar):**
- Verlustfreiheit: `node test/tools/roundtrip_sweep.mjs` (alle Demo-Dateien byte-identisch).
- Ladbarkeit: `node test/tools/hersch_loadability.mjs` (öffnet als Editor-Modell).
- "Diff ist genau die Absicht": Datei öffnen, eine Entität (place + GND-`@ref`) per Engine setzen,
  speichern, neu einlesen; einzige Byte-Differenz ist genau dieser standOff/Markup-Eintrag. Das ist die
  exakte Operationalisierung von "byte-identisch außer dem, was der Mensch bewusst ändert".
- SZD-Konvertier-Test: jede Handvoll-Datei konvertiert + round-trippt + lädt (Folios/Zellen > 0).
- Schema: well-formed + TEI All RNG + Schematron (ZBZ zusätzlich `zbz_hersch.rng`).
- Abdeckung: Zähl-Sweep über das ganze Korpus (alles verarbeitet: 285/285 ZBZ laden, 294/294 round-trip).

**Ebene 2, Frontend-Analyse (Checkliste je Demo-Objekt, das Erfolgskriterium als sechs Ja/Nein-Checks):**
1. Öffnen (Folios/Zeilen sichtbar). 2. Bild (Faksimile sichtbar, Zone highlightet richtige Zeile).
3. Korrigieren (Zeile editieren, bleibt). 4. Annotieren (Person/Ort/Werk + Normdaten-ID).
5. KI-Vorschlag (M3.7: violett, nach Bestätigung normal). 6. Speichern (öffnet identisch wieder, nur
bewusste Änderungen).

Die sechs Checks sind die gemeinte Nutzung als User-Story-Pfad: das Erfolgskriterium IST die Kette der
User Stories E.1-E.5, F.1, F.2, I.1, I.2 plus die im Bau (FU.1 Notiz, FU.2 Normdaten-IDs aus der UI,
FU.4 SZD-Konvertierung, KI-Vorschlag M3.7), je real auf o_szd.1079 und einem ZBZ-Doc abgegangen.

**Ebene 3, fachlich:** ein Domänenexperte bestätigt den Inhalt (Transkription/Annotation korrekt als
Edition). Beide Korpora sind aktuell unreviewed; das ist fachliche Kuration, nicht Werkzeug-Abnahme.

Zwölf visuelle Checks (zwei Objekte) plus die maschinellen Test-Befehle sind die Werkzeug-Abnahme. Jedes
demo-kritische Feature wird zweimal belegt: headless-Proof im Harness UND Browser-Pfad auf dem echten
Objekt. Zuständig: CC3 die ZBZ-Frontend-Checks, CC1 die Editor-/Engine-Checks und die SZD-Seite.
