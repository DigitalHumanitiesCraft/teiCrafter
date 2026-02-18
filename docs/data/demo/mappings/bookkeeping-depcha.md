# Mapping: Historisches Rechnungsbuch (DEPCHA/Bookkeeping-Ontology)

## Strukturelemente
* <div type="account" ana="bk:account"> Konto/Rubrik (z.B. Empfang Gelt, Zoll)
* <head> Kontobezeichnung
* <p> Einzelbuchung / Eintrag

## Semantische Annotation (Bookkeeping-Ontology)
* <persName> Person (Schuldner, Gläubiger, Amtsträger)
* <placeName> Ort
* <measure ana="bk:money" unit="fl" quantity="N"> Geldbetrag in Gulden
* <measure ana="bk:money" unit="kr" quantity="N"> Geldbetrag in Kreuzern
* <date when="YYYY-MM-DD"> Datum (soweit rekonstruierbar)
* <name type="commodity" ana="bk:commodity"> Ware oder Dienstleistung
* <name type="role"> Amtsbezeichnung / Funktion

## Beispiel
Eingabe: "Von dem Haupt Zollner Liechtenstein Thomas Walser Von 1. Octobris 1718 48 fl 25 kr"
Ausgabe: <p>Von dem <name type="role" confidence="high" resp="#machine">Haupt Zollner</name> <placeName confidence="high" resp="#machine">Liechtenstein</placeName> <persName confidence="high" resp="#machine">Thomas Walser</persName> Von <date when="1718-10-01" confidence="medium" resp="#machine">1. Octobris 1718</date> <measure ana="bk:money" unit="fl" quantity="48" confidence="high" resp="#machine">48 fl</measure> <measure ana="bk:money" unit="kr" quantity="25" confidence="high" resp="#machine">25 kr</measure></p>

## Hinweise
- fl = Gulden, kr = Kreuzer, d = Denari (1 fl = 60 kr = 240 d)
- @ana-Attribute verweisen auf die Bookkeeping-Ontology (bk:)
- Historische Personennamen und Ortsnamen exakt beibehalten
- Datumsrekonstruktion: "Georgi 1718" = 1718-04-23 (Georgstag), "Marty" = März
