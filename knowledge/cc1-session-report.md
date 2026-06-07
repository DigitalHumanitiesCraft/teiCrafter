---
title: CC1 Session-Bericht (teiCrafter Code-Recherche)
project:
  name: teiCrafter
  repository: https://github.com/DigitalHumanitiesCraft/teiCrafter
method:
  name: Promptotyping
  url: https://lisa.gerda-henkel-stiftung.de/digitale_geschichte_pollin
template:
  name: Vorlage Session-Bericht
  version: 0.1
status: active
created: 2026-06-07
updated: 2026-06-07
language: de
version: 0.4
topics: ["[[Koordination]]", "[[teiCrafter]]", "[[Code-Recherche]]"]
related: [project-plan, goals, integration, architecture, design]
---

# CC1 Session-Bericht

Kompakter Bericht für den orchestrierenden Claude Code. Wer ich bin, was ich verifiziert
habe, wie, und was daraus für den Plan folgt. Alle Aussagen sind gegen die Platte geprüft
(`datei:zeile` oder ausgeführter Befehl), nicht aus Doku übernommen.

## Wer ich bin

CC1 im Repo teiCrafter (`GitHub/ResearchTools/teiCrafter`). Rolle: Koordinator plus
teiCrafter-Code-Milestones (M2.2 Bild, M3.x Annotation). Der Projektleiter orchestriert,
schärft Ideen und pflegt die Knowledge-Dokumente; converter-reference.md schreibt er selbst.
Implementierung szd liegt bei CC2, zbz bei CC3. Diese Session hatte zwei Phasen: zuerst
reine Recherche (Funde unten), dann ein Ausführungs-Schritt, der M2.2/M3.1/M3.4 gebaut und
verlustfrei verifiziert hat (siehe "Was diese Session gebaut hat").

## Was diese Session gebaut hat (2026-06-07)

Vier additive, verlustfreie Edits; alle drei festen Proofs bleiben grün
(`roundtrip_sweep.mjs` 294/294, `hersch_loadability.mjs` 285/285) plus ein neuer Proof
`node test/tools/szd_demo_check.mjs` (17/17 Checks).

- **M3.1 Ort-Entität** -- `place` in `TYPE_MAP`/`ENTITY_TO_TYPE`/`ID_PREFIX` + `readEntities`
  ([standoff.js:37-48](../docs/js/editor/standoff.js#L37)) und eine Places-Sektion
  ([index-panel.js:50-55](../docs/js/editor/index-panel.js#L50)). UI fließt generisch durch,
  keine editor-app-Änderung nötig.
- **M3.4 Mention-Linking** -- `linkMention` war schon typ-unabhängig; mit M3.1 erfüllt.
- **M2.2 Bild (Engine-Seite)** -- `readSurfaces` liest `<graphic url>`
  ([tei-document.js:383-393](../docs/js/editor/tei-document.js#L383)), `renderFacsimile` nutzt
  `surface.graphic` als Fallback ([editor-app.js:387](../docs/js/editor/editor-app.js#L387)).
  Offen: Browser-Visualtest (rendert das GAMS-Bild, CORS).
- **M3.3** ist offen, aber seit der Entscheidung des Orchestrators (2026-06-07, goals.md
  M3.3) NICHT mehr blockiert: ein `@ref`-Mechanismus, Handeingabe als Fundament zuerst (sofort
  baubar), danach Gemini-Batch (M3.7), danach Live-Lookup.

## Wie ich gearbeitet habe

On-Disk-Verifikation: Glob/Grep über alle drei Repos, gezielte Reads der Editor-Module,
ein echtes Page-JSON und ein echtes ZBZ-`_final.xml` gelesen, `node pipeline.mjs` real
ausgeführt. Methode: jede Plan-Aussage gegen die Quelle prüfen statt ihr zu vertrauen.

## Was ich gefunden habe (belegt)

1. **pipeline.mjs ist ein lauffähigkeitsloser Torso.** [pipeline.mjs](../pipeline.mjs)
   importiert `docs/js/pipeline/tei-assembler.js` und `pipeline-validator.js`; dieses
   Verzeichnis existiert nicht (im Pivot gelöscht). Realer Lauf bricht mit
   `ERR_MODULE_NOT_FOUND` ab. Die 2033 `output/*.tei.xml` (gitignored) stammen von der
   gelöschten Engine und sind mit heutigem Code nicht reproduzierbar. Die Plan-Aussage
   "pipeline.mjs gelöscht" ist sinngemäß richtig, wörtlich ungenau.

2. **`tmp/szd-pagejson-to-tei.mjs` existiert nicht** (in keinem der drei Repos). Plan §6
   und §15.1 sowie der CC2-Auftrag (Aufgabe 5) verweisen darauf ins Leere.

3. **"KEIN LLM" ist korrekt und sogar einfacher.** Die Transkription ist bereits fertig:
   sie steht als `pages[].text` (Plaintext, `\n` = Zeile) im Page-JSON, erzeugt von Gemini
   in der szd-Pipeline. Der teiCrafter-Schritt Page-JSON → TEI braucht keinen LLM: `text`
   an `\n` splitten und in line-level `<pb>` + `<lb>` wickeln ist rein deterministisch.

4. **bbox ist kein Prozent.** Plan §7 sagt "bbox% → px". Real ist `bbox = [x, y, w, h]` in
   absoluter Einheit (vermutlich cm; Seite 33x22 cm, `image_width/height` real vorhanden,
   z.B. 4912x7360). converter-reference.md muss Einheit und Pixel-Umrechnung eindeutig
   festlegen. Zonen tragen keinen Text (region-, nicht zeilengenau).

5. **M2.2 ist NICHT durch CC3 blockiert (für die SZD-Demo).** [facsimile.js](../docs/js/editor/facsimile.js)
   ist schon generisch (`showPage({imageUrl, surface})`, Zonen in Bild-Pixeln). Die Lücke:
   [readSurfaces tei-document.js:380-403](../docs/js/editor/tei-document.js#L380) liest kein
   `<graphic>`, und [imageUrlForFolio editor-app.js:377-379](../docs/js/editor/editor-app.js#L377)
   liefert nur für die fest verdrahtete ZBZ-Demo eine URL, sonst null. Fix (klein, additiv,
   verlustfrei): `surf.graphic = getAttr(<graphic>, "url")` lesen und in
   [renderFacsimile:387](../docs/js/editor/editor-app.js#L387) als Fallback nutzen. SZD trägt
   die Bild-URLs selbst (`source.images[]`, GAMS), zeigt also ohne CC3-Zuarbeit. CC3s
   URL-Schema (M2.4) wird nur für ZBZ-`<graphic>` gebraucht.

6. **Annotation-Lücken belegt.** [TYPE_MAP standoff.js:37-41](../docs/js/editor/standoff.js#L37)
   und [SECTIONS index-panel.js:50-54](../docs/js/editor/index-panel.js#L50) kennen nur
   person/org/event, kein place/work. [addEntity:202-235](../docs/js/editor/standoff.js#L202)
   schreibt kein `@ref`/`<idno>`: Entitäten können keine Normdaten tragen.
   [linkMention:298](../docs/js/editor/standoff.js#L298) arbeitet typ-unabhängig über die id.
   Kein Normdaten-Lookup im Code (nur fetch: LLM-API + zwei Demo-Loads). Der Recognizer kennt
   `placeName`/`geogName` schon ([tei-document.js:364](../docs/js/editor/tei-document.js#L364)),
   nur das standOff-Modell nicht.

## Status der Code-Milestones nach dieser Recherche

| Milestone | Spezifiziert | Blockiert durch | Allein baubar |
|---|---|---|---|
| M2.2 Bild (`<graphic>` lesen + Fallback) | ja | nichts (SZD trägt URLs) | ja, bauen + testen |
| M3.1 Ort-Entität (place in TYPE_MAP/SECTIONS/readEntities) | ja | nichts, rein additiv | ja |
| M3.4 Mention-Linking neue Typen | ja | nur M3.1 | ja |
| M3.3 Normdaten-`@ref` (Modell + UI) | ja | Lookup-Entscheidung des Projektleiters | Modell/UI ja, Richtung nein |

## Folgen für den Plan und die Aufträge

- project-plan §6 (pipeline.mjs-Status), §7 (bbox-Einheit) und §15.1 (tmp-Pfad) korrigieren.
- CC2-Auftrag: Aufgabe 5 (Prototyp-Lauf) streichen, da kein lauffähiger Konverter existiert.
  Satz "DETERMINISTISCHER Konverter, KEIN LLM" beibehalten, er stimmt.
- converter-reference.md muss eindeutig festlegen: (a) Body = `text` an `\n` → `<lb>`;
  (b) graphic-URL = `source.images[index]`; (c) bbox-Einheit + Pixel-Umrechnung +
  Zonen als `ulx/uly/lrx/lry` in Bild-Pixeln (so erwartet facsimile.js).

## Wiedereinstiegspunkt (Stand 2026-06-07)

Entscheidung M3.3 ist getroffen (siehe goals.md): ein `@ref`-Mechanismus, Handeingabe-Kern
zuerst, sofort baubar. Nächster CC1-Schritt am Wiedereinstieg, eine der drei Optionen:
1. M3.3 Handeingabe-Kern bauen (`@ref` auf person/place/org/event in `addEntity`/`updateEntity`
   + Index-Panel-Feld + `readEntities`), verlustfrei, headless testbar.
2. Marker-Realitätsabgleich an o_szd.72/1079/2213/1056 für converter-reference.md.
3. place/graphic in den festen Regressions-Sweep (M4.3) aufnehmen.

Alle drei Proofs sind beim Beenden grün: `roundtrip_sweep.mjs` 294/294,
`hersch_loadability.mjs` 285/285, `szd_demo_check.mjs` 17/17.

## Korrektur (CC1 Orchestrator, 2026-06-07)

- Punkt 2 ist irreführend: `szd-pagejson-to-tei.mjs` existiert, lag aber in `c:\tmp` (außerhalb der
  Repos), daher von der Repo-Suche nicht gefunden. Am 2026-06-07 nach `test/tools/szd-pagejson-to-tei.mjs`
  versioniert.
- Punkt 1 (pipeline.mjs-Torso) und die Annotation-Lücken (Punkt 6) sind bestätigt und in project-plan
  §6/§7/§11 eingearbeitet.
- Punkt 4 (bbox-Einheit) bleibt offen: Prototyp nimmt Prozent an, diese Lesung deutet absolute Einheit
  an, der Round-Trip-Proof entscheidet die Geometrie nicht; CC2 bestätigt sie im Realitätsbericht.
