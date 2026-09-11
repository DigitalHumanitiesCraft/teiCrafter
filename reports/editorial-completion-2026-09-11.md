# Editorische Arbeitsbereiche und stabile Evaluation, 2026-09-11

Die angeforderten Zeugen-, Eintrags-, Stapel- und Projektdatei-Funktionen sind implementiert, auf `main` integriert und veröffentlicht. Der vollständige lokale Prüflauf mit echten Wenzelsbibel-Daten und der unabhängige Linux-CI-Lauf bestehen auf Commit `8498916800267cb9298c688a9dbacf3c74cf0b7f`. Dieser Bericht ergänzt den [ersten Wenzelsbibel-Durchlauf](wenzelsbibel-workflow-2026-09-11.md). Die technische Evidenz umfasst die nachstehend beschriebenen Abläufe; fachliche Prüfung und Nutzerabnahme stehen gesondert aus.

## Umgesetzter Umfang

| Arbeitsbereich | Beobachtbares Verhalten |
| --- | --- |
| Zeugen | Zeugen anlegen, bearbeiten und geschützt löschen; strukturierte Beschreibungen als exaktes XML; `lem`/`rdg` Zeugen zuweisen; explizite Lesarten auswählen; Mehrdeutigkeit, fehlende Lesart, Auslassung und Fragmentgrenzen anzeigen |
| Einträge | Wörterbuch- und Artikelsammlungen durchsuchen, anlegen, bearbeiten, duplizieren und geschützt löschen; interne IDs und Verweise beim Duplizieren nachführen |
| Stapeländerungen | Auswahl und konkrete Vorschau für Sprache oder Nummerierung in der aktiven XML-Datei; veraltete Vorschau verweigern; Änderung mit einem Undo zurücknehmen |
| Projektdateien | Codex, Bildannotationen und Register samt Einstellungen und Bildern gemeinsam wiederherstellen; vor dem Dokumentwechsel speichern; bei Speicherfehler im bisherigen Dokument bleiben |
| Projektausgabe | Jede XML-Datei nach ihrem eigenen Schema prüfen, erst danach ein gemeinsames ZIP herunterladen; vollständig sperren, sobald eine Prüfung fehlschlägt, veraltet oder abgebrochen wird |
| Große Dateien | Erfolgreiche Schemaentscheidung nur für identisches XML und den vollständigen identischen Schema-Abhängigkeitsgraphen wiederverwenden; laufende Validierung abbrechen können |

Die unabhängige Modellprüfung korrigierte freie Bibelstellen mit unbegründetem `cRef`, statistische Bildbereiche mit Nicht-Wort-Endpunkten und Löschschutz, der untergeordnete IDs oder kodierte URI-Fragmente übersehen hatte. Eine weitere Gegenprobe korrigierte den Umgang mit doppelten XML-Attributen. Die Schema-Zwischenspeicherung kopiert ihre Eingaben vor dem ersten asynchronen Schritt; ein gezielter Mutationstest belegt diesen Vertrag.

Die Integrationsprüfung ergänzte dateieigene Schemaeinstellungen bereits vor dem ersten Wiederherstellungspunkt. Änderungen und neue Anhänge während eines wartenden Dokumentwechsels verhindern den Wechsel und bleiben erhalten. Ein verspätet geladenes Schema kann keine andere Datei überschreiben. Eine manuell abgebrochene Validierung kann erneut gestartet werden. Die zugehörigen Browserfälle verzögern echte Speichervorgänge und prüfen anschließend Arbeitskopie, Projektdateien und exakten XML-Download.

Beim Öffnen einer Arbeitskopie wird ihre Wiederherstellungs-ID bereits vor dem Laden gesetzt. Der erste automatische Speicherpunkt wartet auf die vollständige Wiederherstellung von Herkunft, Bildern und unfertigen Eingaben. Ein Browser-Gegenfall kontrolliert jeden tatsächlich gestarteten IndexedDB-Schreibvorgang einschließlich seines vollständigen Inhalts. Damit sind die im vorherigen Gesamtlauf gefundenen doppelten Datensätze und das vorausgehende unvollständige Zwischenstadium behoben.

## Nachweise

| Prüfung auf dem endgültigen Code | Ergebnis |
| --- | --- |
| Obligatorische lokale Modellprüfungen | 107 bestanden, 0 Fehler, 0 ausgelassen |
| Kontrollfälle des unabhängigen Prüfsystems | 14 von 14 bestanden; absichtlicher Textverlust wird erkannt |
| Python/lxml-Vergleich, synthetische Prüfstufen, Typprüfung, Biome, Produktionsbuild | Bestanden |
| Lokale Browsermatrix mit echten Wenzelsbibel-Dateien | 189 bestanden, 0 Fehler, 3 begründet ausgelassen; 192 Fälle insgesamt |
| Modellprüfungen in frischer Linux-Installation | 102 bestanden, 0 Fehler, 5 erlaubte Auslassungen ohne lokale Hersch-Quellen |
| Browsermatrix in frischer Linux-Installation | 185 bestanden, 0 Fehler, 7 begründet ausgelassen; [CI-Lauf erfolgreich](https://github.com/DigitalHumanitiesCraft/teiCrafter/actions/runs/34622930885) |

Lokal wurde der vollständige Befehl `npm run evaluate:editorial -- --real` ausgeführt, ohne Einschränkung auf einzelne Arbeitsbereiche und ohne automatische Wiederholungsversuche. Die drei ausgelassenen Browserfälle sind die beiden Urfehde-Durchläufe ohne bereitgestelltes `UFBAS_TEI` und die Chromium-Instanz des ausdrücklich Firefox-spezifischen Tests. Beide echten Wenzelsbibel-Szenarien liefen in beiden Browsern.

CI führte denselben vollständigen Prüfaufruf ohne `--real` aus. Zu den drei genannten Browserauslassungen kommen dort die vier realen Wenzelsbibel-Fälle ohne lokale Originaldateien. Alle 192 registrierten Browserfälle haben genau ein Ergebnis mit Wiederholungsindex 0; es gibt keine nachträglich erfolgreichen Wiederholungen. Das heruntergeladene Artefakt `browser-verification-1` wurde unabhängig geprüft: `evaluation.json` und `playwright.json` sind enthalten und gehören zum exakten Commit. CI verwendete Python 3.12.14, lxml 5.4.0 und libxml 2.13.8 bei identischen Node-, npm- und Browserversionen. Auch dort blieben Code und erfasste Eingaben unverändert.

Der lokale Lauf dauerte von 16:36:17 bis 17:04:25 UTC. Sein maschinenlesbarer Nachweis liegt in `node_modules/.tmp/evaluation/2026-09-11T16-36-17-345Z/evaluation.json`; dort liegen auch der vollständige Playwright-Bericht und die Einzelprotokolle. Code und sämtliche erfassten Quelldaten blieben während des Laufs unverändert. Der lokale Verzeichnis-Hash beträgt vor und nach der Prüfung `78faa640d76a2c543909c1144813408ae46513b329308de6aac10f9b55de338d`.

Werkzeuge des lokalen Laufs: Node 24.13.0, npm 11.6.2, Playwright 1.62.1, Chromium 151.0.7922.34, Firefox 153.0, Python 3.11.9 und lxml 5.4.0 mit libxml 2.11.9. Die Browserprüfungen verwenden den Produktionsbuild. Ergänzende gezielte Prüfungen liefen zuvor gegen den direkt ausgelieferten Quellstand.

Die Szenarien umfassen Zeugenverwaltung, drei verknüpfte Dateien, beide Eintragskodierungen mit jeweils 30 Datensätzen, Vulgata-Referenzen sowie Speicher-, Abbruch- und Referenzfehler. Sie vergleichen vollständige erwartete XML-Ausgaben, Wiederherstellung, Undo und erhaltene Verweise. Automatisierte Zugänglichkeitsprüfungen betreffen die tatsächlich geöffneten Ansichten.

## Echter Codex und Bilddatei

Der Codex umfasst 82.430.623 Bytes, die Bilddatei 1.551.773 Bytes. Der reale Codexfall ändert eine Normalisierung, vergleicht den übrigen Text vollständig mit dem Original und nimmt die Änderung zurück. Anschließend wird die einzige alleinstehende `choice`/`sic`-Konstruktion ausdrücklich mit **Keep sole reading** in der Arbeitskopie repariert. Diese Kopie wird vollständig validiert und gemeinsam mit der unveränderten Bilddatei exportiert. Beide aus dem ZIP gelesenen XML-Inhalte werden über SHA-256 mit den erwarteten vollständigen Inhalten verglichen.

| Gemessener Schritt | Chromium | Firefox |
| --- | ---: | ---: |
| Codex laden | 6,835 s | 8,167 s |
| Erste Vollvalidierung und XML-Download | 57,014 s | 204,242 s |
| Anschließendes Projektpaket aus identisch validiertem Codex und Bilddatei | 5,070 s | 4,594 s |

Diese Werte gehören zum protokollierten lokalen Lauf und sind keine garantierten Laufzeitbudgets. Frühere gezielte Läufe lagen bei etwa 44–45 Sekunden in Chromium und 200–205 Sekunden in Firefox für die erste Codexvalidierung. Die erneute Ausgabe nutzt ausschließlich die erfolgreiche Entscheidung über identische XML- und Schemadaten.

Die unveränderten Originale wurden mit folgenden Prüfsummen vor und nach dem Lauf erfasst:

| Quelle | SHA-256 |
| --- | --- |
| `codex-2759.xml` | `8d826ff76f3ea5bf27090ecab0f53e05e77e886d65d8073784faa7062ca0a6c9` |
| `Bildannotationen.xml` | `147e5ca2909f6ff33ad78c5bc6dad742a1d26f35b7644e50356047e34ee00965` |
| PAGE-Quellverzeichnis, 12 XML-Dateien | `e06e48835d35792186a9294d0c646e8e1e8956f9caf89f5d0d6ee923db7a9e16` |

## Prüfhistorie und Veröffentlichung

Ein vorbereitender Lauf wurde für weitere Integrationskorrekturen abgebrochen. Der folgende Lauf auf `413badd` scheiterte an einer veralteten statischen Assertion zur Schema-Erkennung; sie wurde auf den gemeinsamen Ladepfad nachgeführt. Der vollständige Lauf auf `83e9522` ergab 185 bestandene Browserfälle, zwei Fehler derselben Wiederherstellungsursache und drei erwartete Auslassungen. Diese Ergebnisse bleiben als fehlgeschlagene Läufe erhalten. Auf `8498916` bestehen sowohl die gezielten Wiederherstellungsfälle als auch die vollständige erneute Evaluation.

Alle Änderungen liegen auf `main` und `origin/main`. Der Abgleich mit dem Remote ergab keine offenen Pull Requests und keine unintegrierten Remote-Branches. Die verbliebenen Referenzen `fix/audit-confirmed-defects`, `session/2026-06-07-place-graphic` und `codex/frontend-knowledge-pilot` zeigen auf bereits in `main` enthaltene Stände.

[GitHub Pages hat den geprüften Code veröffentlicht](https://github.com/DigitalHumanitiesCraft/teiCrafter/actions/runs/34622929012). Sieben zentrale veröffentlichte Module wurden inhaltlich mit dem lokalen Code verglichen, einschließlich Editor, Wiederherstellung, Validierung, Wenzelsbibel-Arbeitsbereich, Projektpaket, Einträgen und Zeugen. Die Veröffentlichung verwendet weiterhin `main:/docs`; CI baut und prüft zusätzlich `dist`. Der [öffentliche Editor](https://dhcraft.org/teiCrafter/editor.html) enthält diesen Funktionsumfang. Die anschließende Abschlussänderung betrifft ausschließlich die Dokumentation; es wurde kein Release-Tag angelegt.

## Wiederholbare Prüfung

```powershell
npm run evaluate:editorial
```

Der Befehl führt die obligatorischen Modelltests, den unabhängigen Python/lxml-Vergleich, Typprüfung, Biome, den Produktionsbuild und die Browsermatrix in Chromium und Firefox aus. Ein Worker und null Wiederholungsversuche verhindern, dass ein nachträglich erfolgreicher Versuch einen zunächst fehlerhaften Ablauf verdeckt. Unerwartete ausgelassene Fälle, Abbrüche, Infrastrukturfehler oder während der Prüfung veränderte Eingaben lassen den Lauf scheitern.

Für echte Wenzelsbibel-Daten müssen `WB_CODEX`, `WB_IMAGES` und `WB_PAGE_ROOT` auf die lokalen Originale zeigen:

```powershell
npm run evaluate:editorial -- --real
```

Fehlende Originale werden in diesem Modus als Fehler behandelt. `--editorial-only` grenzt die Browserauswahl ausdrücklich ein; `--repeat=2` führt die gewählten Browserfälle zweimal aus. Die JSON-Berichte protokollieren Code- und Quellenprüfsummen, Werkzeug- und Browserversionen, Ergebnisse, Auslassungen und Laufzeiten. Lokale Berichte und Spuren liegen in ignorierten Verzeichnissen; die Originaldateien werden nicht verändert oder veröffentlicht.

## Geltungsgrenzen

Native Save-Vorgänge betreffen weiterhin jeweils eine Datei. Das Projektpaket ist ein gemeinsamer geprüfter Download. Stapeländerungen betreffen die aktive XML-Datei. Fremdänderungen auf der Festplatte erfordern erneutes Laden der betreffenden Datei.

Die erste Vollvalidierung eines großen geänderten Codex bleibt aufwendig. Die Zwischenspeicherung gilt ausschließlich für unveränderte Inhalte und Schemata. Sie ersetzt keine Prüfung eines neuen Bearbeitungsstands.

Die Modelle bilden explizite editorische Aussagen ab. Eine vollständige Zeugenrekonstruktion aus negativem Apparat, eine externe Vulgata-Konkordanz, die sachliche Richtigkeit von Normalisierungen und Bildzuordnungen sowie die Nutzerabnahme sind nicht durch technische Tests belegt. Das eigene Bildschema bleibt als teiCrafter-Profil ausgewiesen; das ursprüngliche Bilderfassung.sch liegt weiterhin nicht vor.
