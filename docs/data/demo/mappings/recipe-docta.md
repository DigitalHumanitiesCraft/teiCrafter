# Mapping: Mittelalterliches Rezept (CoReMA/DoCTA-Konvention)

## Strukturelemente
* <div type="recipe"> Gesamtes Rezept
* <head> Rezepttitel
* <p> Anweisungstext (Fließtext)

## Semantische Annotation
* <name type="ingredient"> Zutat (Lebensmittel, Gewürz, Flüssigkeit)
* <name type="tool"> Werkzeug oder Gefäß
* <name type="instruction"> Handlungsverb / Verarbeitungsschritt (optional)
* <measure> Mengenangabe mit @unit und @quantity wenn möglich

## Beispiel
Eingabe: "Nem ain pfunt zucker vnd ain wein"
Ausgabe: <p><name type="instruction" confidence="medium" resp="#machine">Nem</name> ain <measure unit="pfunt" quantity="1" confidence="high" resp="#machine">pfunt</measure> <name type="ingredient" confidence="high" resp="#machine">zucker</name> vnd ain <name type="ingredient" confidence="high" resp="#machine">wein</name></p>

## Hinweise
- Frühneuhochdeutsche Schreibvarianten beibehalten (wilpret = Wildpret, geschir = Geschirr)
- Precision over Recall: Nur annotieren was sicher erkennbar ist
- Nicht annotieren: rein grammatische Elemente (und, das, so, ain)
