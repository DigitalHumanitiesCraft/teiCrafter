# Editorische Arbeitsbereiche und stabile Evaluation, 2026-09-11

Dieser Bericht ergänzt den [ersten Wenzelsbibel-Durchlauf](wenzelsbibel-workflow-2026-09-11.md). Er dokumentiert die anschließende Umsetzung der offenen Zeugen-, Eintrags-, Stapel- und Projektdatei-Funktionen. Der gemeinsame abschließende Prüflauf steht in diesem Zwischenstand noch aus. Die nachstehenden Beobachtungen sind gezielte Prüfungen des direkt ausgelieferten Quellstands.

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

Die Integrationsprüfung ergänzte dateieigene Schemaeinstellungen bereits vor dem ersten Wiederherstellungspunkt. Änderungen und neue Anhänge während eines wartenden Dokumentwechsels verhindern den Wechsel und bleiben erhalten. Eine manuell abgebrochene Validierung kann erneut gestartet werden. Die zugehörigen Browserfälle verzögern echte Speichervorgänge und prüfen anschließend Arbeitskopie, Projektdateien und exakten XML-Download.

## Nachweise

Die gezielten Browserprüfungen umfassen Zeugenverwaltung, drei verknüpfte Dateien, beide Eintragskodierungen mit jeweils 30 Datensätzen, Vulgata-Referenzen sowie ergänzende Fehlerfälle. Sie vergleichen vollständige erwartete XML-Ausgaben, Wiederherstellung, Undo und die erhaltenen Verweise. Automatisierte Zugänglichkeitsprüfungen betreffen die tatsächlich geöffneten Ansichten. Der abschließende Bericht wird die gemeinsame gebaute Anwendung, die vollständigen Fallzahlen und den realen Codex-Durchlauf gesondert ausweisen.

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
