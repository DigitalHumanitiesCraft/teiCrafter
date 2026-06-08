---
title: SZD Page-JSON v0.2 to TEI Converter Reference
project:
  name: teiCrafter
  repository: https://github.com/DigitalHumanitiesCraft/teiCrafter
method:
  name: Promptotyping
  url: https://lisa.gerda-henkel-stiftung.de/digitale_geschichte_pollin
template:
  name: Vorlage Reference
  version: 0.1
status: active
created: 2026-06-08
updated: 2026-06-08
language: en
version: 0.6.1
topics: ["[[Converter]]", "[[SZD]]", "[[Page-JSON]]", "[[TEI]]"]
related: [data, architecture, specification, goals, integration]
---

# SZD Page-JSON v0.2 to TEI Converter Reference

The deterministic contract for converting szd-htr Page-JSON v0.2 to teiCrafter-target
TEI, implemented by `pipeline/export_tei.py` and verified against the teiCrafter
engine. The conversion is fully **deterministic** (a rule, never an LLM); the
transcription is already done (it sits in `pages[].text`), so there is nothing for a
model to generate here.

This contract is **frozen** (status `active`, M1.2 done). The mappings, the id scheme,
and the geometry are fixed from the v0.2 schema, the reference prototype, and the demo
handful. The open points named in section 9 were resolved against real data on
2026-06-08 (the handful plus a 151-object deterministic spread across the ~2103-object
corpus; `test/tools/port_parity.mjs` and `pipeline/export_tei.py`).

## 0. Sources of truth for this document

- The Page-JSON v0.2 schema: `szd-htr/schemas/page-json-v0.2.json`.
- The reference prototype (spec-by-example, self-verifying):
  [test/tools/szd-pagejson-to-tei.mjs](../test/tools/szd-pagejson-to-tei.mjs). Every
  rule below cites the prototype line that implements it.
- Two real objects read on 2026-06-08: `o_szd.100` (typescript, en, 3 images,
  creator present) and `o_szd.1079` (letter, de, 5 images, no creator). The demo
  target is **o_szd.1079**.
- The teiCrafter engine contract: [docs/js/editor/edition.js](../docs/js/editor/edition.js),
  [docs/js/editor/tei-document.js](../docs/js/editor/tei-document.js),
  [docs/js/editor/standoff.js](../docs/js/editor/standoff.js).

## 1. Acceptance (engine checks on every converted TEI)

A converted file is accepted if and only if both hold, checked against the
real engine (not by claim):

1. **Byte-identical round-trip.** `serialize(parseEdition(tei)) === tei`. The string
   is canonical; nothing the editor does may change a byte on a no-op load/save.
2. **Loads line-level.** `parseEdition(tei)` yields `profile === "line"` and
   `folios.length === pages.length`. `cells.length > 0` holds for every object with
   transcribed text, but an object with no pages (`pages: []`, e.g. o_szd.70 / 2256 /
   2314) legitimately yields `cells.length === 0` and still round-trips
   byte-identically. The prototype asserts `cells > 0` because every handful member has
   text; a full-corpus run must treat empty objects (`pages: []`) as valid output, not
   as failures (about 3 percent of a 151-object sample).

The prototype asserts exactly these before it exits
([szd-pagejson-to-tei.mjs:198-207](../test/tools/szd-pagejson-to-tei.mjs#L198)); the
fixed sweep enforces (1) repo-wide (`node test/tools/roundtrip_sweep.mjs`). A
delivered TEI that fails either check is returned with a precise correction
(file / field / expected value), not a vague rejection.

## 2. Document skeleton

The output is one `<TEI>` with this child order (TEI requires standOff and facsimile
before text):

```
<?xml version="1.0" encoding="UTF-8"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <teiHeader> ... </teiHeader>
  <standOff> ... </standOff>      (only if at least one entity is seeded)
  <facsimile> ... </facsimile>    (only if at least one surface has an image or zones)
  <text>
    <body>
      <div type="document" n="{source.id}">
        ... one block per page ...
      </div>
    </body>
  </text>
</TEI>
```

Namespace is the default TEI namespace, no prefix. Encoding is UTF-8. The file ends
with a single trailing newline (the prototype's template does;
[szd-pagejson-to-tei.mjs:165-176](../test/tools/szd-pagejson-to-tei.mjs#L165)).

## 3. Body: text to pb + lb (the core mapping)

This is the line-level rule the whole demo rests on.

- **One `<pb>` per page**, in `pages[]` order. `@n = pages[].page`; `@facs = "#surf_{page}"`
  only when that page has a surface (section 5). The prototype:
  [bodyForPage szd-pagejson-to-tei.mjs:105-115](../test/tools/szd-pagejson-to-tei.mjs#L105).
- **`pages[].text` is canonical.** Normalize CRLF to LF (`\r\n` -> `\n`) once, then:
  - Split into paragraphs on a blank line (`/\n{2,}/`) -> one `<p>` each.
  - Within a paragraph, split on single `\n` -> each line is `<lb/>` immediately
    followed by the line's text.
- **A page with empty/whitespace `text`** (`type: "blank"` or `"color_chart"`, or a
  content page that came back empty) emits the bare `<pb>` and no `<p>`: a folio with
  no editable line. This is correct and must round-trip.
- **Escaping:** text content escapes `&`, `<`, `>`; attribute values additionally
  escape `"`. Use exactly these and nothing else, or the round-trip breaks. Helpers:
  [escText / escAttr szd-pagejson-to-tei.mjs:35-37](../test/tools/szd-pagejson-to-tei.mjs#L35).

Worked shape (o_szd.100 page 1, abridged):

```
<pb n="1" facs="#surf_1"/>
<p>
  <lb/>THIS AGREEMENT
</p>
<p>
  <lb/>is made this twelfth day of September, 1938 between Stefan Zweig of 49 Hallam
  <lb/>Street, London, W. 1., England, of the first part and Longmans, Green &amp; Co. Inc.,
  ...
</p>
```

The editor splits folios on `<pb>` and lines on `<lb>`
([edition.js](../docs/js/editor/edition.js)); this is why the unit must be `<lb>`, not
`<l>` (both are recognized, but the prototype and engine proofs standardize on `<lb>`).

## 4. teiHeader

Mapped from `source` and `source.descriptive_metadata` (`dm`). Every field is
optional in the data; omit the element when the source value is absent (never emit an
empty shell). Prototype: [header szd-pagejson-to-tei.mjs:119-158](../test/tools/szd-pagejson-to-tei.mjs#L119).

| TEI target | Source field | Notes |
|---|---|---|
| `fileDesc/titleStmt/title` | `source.title` else `source.id` else `"Untitled"` | always present |
| `titleStmt/respStmt` (one per creator) | `dm.creator[].name` | `<resp>contributor</resp><persName>name</persName>` |
| `publicationStmt/p` | provenance note | machine-generated statement, see below |
| `sourceDesc/msDesc/msIdentifier/repository` | `dm.holding.repository` else `source.repository` | omit if absent |
| `msIdentifier/idno[@type=shelfmark]` | `source.shelfmark` | omit if empty string (o_szd.1079 has `""`) |
| `msIdentifier/idno[@type=objectId]` | `source.id` | always present |
| `profileDesc/langUsage/language/@ident` | `source.language` else `"und"` | ISO code |

The `publicationStmt/p` records provenance and review state and is the
machine-generated marker at the document level:

```
Machine-generated TEI from szd-htr Page-JSON ({provenance.model}).
Structure unreviewed; transcription {review.status or "unreviewed"}.
Rights: {dm.rights}.        (the Rights clause only if dm.rights is present)
```

`provenance.model` is e.g. `gemini-3.1-flash-lite-preview`; `review.status` is
`approved` / `agent_verified` when present, else the literal `unreviewed`.

## 5. facsimile: surfaces, graphic URL, zones

One `<surface>` per page that has an image or at least one zone; pages with neither
contribute no surface (and their `<pb>` carries no `@facs`). Prototype:
[surfaces szd-pagejson-to-tei.mjs:84-102](../test/tools/szd-pagejson-to-tei.mjs#L84).

- **Surface id:** `surf_{page}` (e.g. `surf_1`). Body `<pb facs="#surf_1">` points to it.
- **Surface extent:** `ulx="0" uly="0" lrx="{image_width}" lry="{image_height}"` when
  both dimensions are present; otherwise omit the four attributes.
- **Graphic URL (the image teiCrafter shows):**
  `<graphic url="{source.images[i]}"/>` where `i` is the 0-based page index in
  `pages[]`. Real values are absolute GAMS URLs, e.g.
  `https://gams.uni-graz.at/o:szd.1079/IMG.1`. Fall back to `pages[].image` (a bare
  filename like `IMG_1.jpg`) only if `source.images[i]` is missing; a bare filename
  will not resolve in the browser, so prefer the GAMS URL.
  teiCrafter reads this back in [readSurfaces tei-document.js:387-393](../docs/js/editor/tei-document.js#L387)
  and renders it via the `surface.graphic` fallback in
  [renderFacsimile editor-app.js:389](../docs/js/editor/editor-app.js#L389).
- **Zones from regions.** Each `pages[].regions[]` entry becomes one `<zone>`:
  - id: `z_{page}_{region.id}` (e.g. `z_1_r1`).
  - `@type = region.type` when present (`paragraph` / `heading` / `list` / `table` /
    `marginalia`).
  - coordinates: `ulx/uly/lrx/lry` in **image pixels** (section 6).
  - Regions carry no per-line text, so zones are region-level, not line-level; a zone
    is not linked to a specific `<lb>` by the converter. (The body's first `<lb>` may
    carry `@facs` to a zone for the demo, but the converter does not attempt
    line-to-zone alignment; it has no data for it.)
  - Region fields `reading_order`, `lines`, `label`, and the non-schema `source`
    field are not represented in the zone; they carry no editor meaning. (Noted in
    section 9 as a deliberate drop.)

## 6. bbox unit and the pixel formula (resolved: percent)

`regions[].bbox` is `[x, y, width, height]` in **percent of the page (0-100)**. This
is the schema definition (`page-json-v0.2.json`: "bbox als [x%, y%, breite%, hoehe%]
relativ zur Seite (0-100)", `minimum: 0, maximum: 100`) and it is confirmed by real
data: o_szd.1079 r1 = `[17.5, 37.9, 34.9, 5.2]`, o_szd.100 r1 = `[3.9, 2.9, 4.8, 0.3]`
(every value in range). The "33x22 cm" seen in o_szd.100 is
`physical_description.dimensions` (the physical sheet), **not** the bbox unit; the two
must not be conflated.

The conversion to the image-pixel `<zone>` teiCrafter expects
([facsimile.js](../docs/js/editor/facsimile.js) uses `ulx/uly/lrx/lry` directly as
image pixels):

```
ulx = round((x / 100)            * image_width)
uly = round((y / 100)            * image_height)
lrx = round(((x + width)  / 100) * image_width)
lry = round(((y + height) / 100) * image_height)
```

This bbox-to-pixel coordinate contract is consumed by
[facsimile.js](../docs/js/editor/facsimile.js), which reads `ulx/uly/lrx/lry` straight
off the `<zone>` as image pixels with no further scaling, so the converter must already
emit pixels (not percent).

Prototype: [zonesFor szd-pagejson-to-tei.mjs:68-82](../test/tools/szd-pagejson-to-tei.mjs#L68).
Zones are skipped entirely when `image_width`/`image_height` are absent (the schema
makes them required only when regions are present, so in practice they are there
whenever regions are).

**Check:** confirm across the handful that no bbox value exceeds 100. If any object's
values are absolute (e.g. raw pixels), that object violates the schema and the layout
generator, not this contract, must be fixed; flag it rather than switching units.

## 7. standOff seeding from metadata

Seed the index with what the metadata reliably gives, so the human starts annotation
from a non-empty register; everything else is hand-added in teiCrafter (M3.3).

- **Persons from `dm.creator[]`.** One `<person>` per creator:

  ```
  <person xml:id="pers_{slug(name)}">
    <persName>{name}</persName>
    <idno type="GND">{creator.gnd}</idno>   (only if gnd present)
  </person>
  ```

  inside `<standOff><listPerson>`. Prototype:
  [persons szd-pagejson-to-tei.mjs:50-65](../test/tools/szd-pagejson-to-tei.mjs#L50).
  `creator.gnd` is a full GND URI (`http://d-nb.info/gnd/118637479`); write it
  **verbatim** into `<idno type="GND">`. This is exactly the authority shape
  teiCrafter reads and edits ([readEntities / setAuthority standoff.js]): the
  converter and the editor agree on `<idno type="GND|GeoNames|Wikidata">value</idno>`.
- **No creator means no persons and no standOff.** o_szd.1079 has only
  `dm.rights`, so its converted file has no `<standOff>`; all of its persons
  (Stefan Zweig, Max Fleischer) are added by hand in the editor. The converter must
  not invent entities.
- **Out of scope for the converter (hand-added in teiCrafter):** places, works,
  organisations, events, and any non-GND authority id. `dm.origin_place`,
  `dm.holding.repository`(+`_gnd`), and `correspondence.sender/recipient`(+gnd) are
  candidates for future seeding but are **not** seeded in v1 to keep the rule small;
  see section 9.

### id scheme (shared with the editor)

| element | id pattern | example |
|---|---|---|
| person | `pers_{slug(name)}` | `pers_stefan_zweig` |
| surface | `surf_{page}` | `surf_1` |
| zone | `z_{page}_{region.id}` | `z_1_r1` |

`slug()` is NFKD, strip combining marks, lowercase, non-`[a-z0-9]` to `_`, trim `_`
([szd-pagejson-to-tei.mjs:39-48](../test/tools/szd-pagejson-to-tei.mjs#L39)). It must
agree with the editor's `slugify` for hand-added entities to stay NCName-safe and
collision-free ([slugify standoff.js:61-73](../docs/js/editor/standoff.js#L61)).
Hand-added entities in teiCrafter use the prefixes `plc_` (place), `org_`, `evt_`
(event), `wrk_` (work), so converter ids and editor ids never collide.

## 8. Editorial markers (v1: preserve verbatim)

The transcription contains markers such as `[?]` (uncertain), `[...]` / `[...N...]`
(gap), `~~x~~` (deletion), `{x}` (addition/expansion), `[Stempel:]` (stamp). In **v1
the converter does not transform them**: they are escaped and kept as literal text
inside the `<lb>` line, which is deterministic and lossless. They remain
human-readable and round-trip byte-identically.

Mapping markers to TEI editorial elements (`<unclear>`, `<gap>`, `<del>`, `<add>`,
`<note>`) is teiCrafter goal M3.6 (full ambition, not demo-critical) and is added in a
later revision of this contract **only after** real data confirms which markers
actually occur and with what exact syntax. Encoding markers we have not observed would
be guesswork; v1 stays literal on purpose.

## 9. Resolved against real data (2026-06-08, M1.2 freeze)

Checked over the handful (o_szd.100, 72, 161, 2215, 1079) and a 151-object deterministic
spread across the full ~2103-object corpus. The five open points are settled:

1. **bbox: confirmed percent.** No bbox value exceeds 100 anywhere in the sample (handful
   max 82.5, o_szd.2215). The percent-to-pixel formula (section 6) stands; no object uses
   absolute units.
2. **Markers present: only two of the five.** `~~x~~` (deletion, e.g. o_szd.72
   `~~kleine~~`) and `[?]` (uncertain, observed in korrespondenzen/o_szd.161, since deduped
   upstream, see below) occur; `[...]`/`[...N...]`,
   `{x}`, and `[Stempel:]` were not observed in the handful. v1 keeps all markers verbatim
   (section 8); the later M3.6 mapping should encode only the observed `~~x~~` and `[?]`
   until more syntaxes appear.
3. **Dropped fields: confirmed, with `pages[].notes` recorded as a deferred decision.**
   Regions carry `reading_order`, `lines`, `label`, and sometimes a non-schema `source`
   field; none has line-level editor meaning and all stay dropped. `pages[].notes` is the
   exception: it is present on every page of every handful object and is content-bearing
   (machine-generated page descriptions, e.g. "Adressseite des Briefumschlags. Poststempel
   'WIEN 1/1 22.5.01'"). **Decision (reversible): v1 drops it.** It is unreviewed model
   commentary, not transcription; the human adds reviewed notes in teiCrafter (M3.5).
   Carrying it as a machine-marked `<note>` on the `<pb>` is the first candidate for a v2
   revision; the prototype and this port would change together.
4. **Further standOff seeding: left for hand annotation (confirmed).** `correspondence`
   is absent across the whole handful (including the letter o_szd.1079), so sender/recipient
   seeding is moot for v1. `dm.holding.repository`(+`_gnd`) is reliably present
   ("Literaturarchiv Salzburg") and could seed `<listOrg>`, but v1 keeps the rule small and
   leaves it to hand annotation; the demo object o_szd.1079 has no repository anyway.
5. **Multi-image vs multi-page: confirmed 1:1.** Every handful object has
   `source.images.length === pages.length`; indexing `source.images[i]` by page position
   is safe.

Two further findings recorded at freeze:

- **Duplicate object id across folders (since deduped upstream).** `o_szd.161` used to
  exist in both `lebensdokumente` (creator Friderike Zweig, no markers) and `korrespondenzen`
  (no creator, `[?]` marker) with different content; szd-htr has since deduped it (commit
  fb48ca0), so only the `lebensdokumente` copy remains on disk. An id alone is still not a
  guaranteed unique key, so `export_tei.py` stays path-driven like the prototype, and its
  `--id` convenience mode hard-errors on any ambiguous id rather than silently picking one (a
  general guard, no longer triggered by o_szd.161 specifically). The contract's earlier label
  of o_szd.161 as "Formular, Pipe-Tabellen" is wrong: both files were printed cards
  (Eintrittskarte / Theaterkarte) with no pipe tables. `test/tools/port_parity.mjs` now skips
  the absent korrespondenzen copy and proves parity over every present member.
- **Empty objects.** o_szd.70 / 2256 / 2314 have `pages: []`. They convert to
  byte-identical-round-trip TEI with `folios === pages` and `cells === 0`; they are
  valid output, not failures (see the acceptance note in section 1). (o_szd.176, earlier
  listed here as all-blank, is not: its converted body holds two text lines, so it
  yields `cells === 2`. The corpus-wide count of 40 `cells === 0` objects never included
  it and stands.)

## 10. Reference implementation and how to run it

```
node test/tools/szd-pagejson-to-tei.mjs <in_page.json> <out.xml>
```

It writes `<out.xml>` and self-verifies (round-trip + line-level) before exiting 0;
on any contract violation it prints the failing summary and exits 1.
`pipeline/export_tei.py` is a faithful port of this prototype's rules (Python instead
of Node, same output), driven by object id, producing the handful with o_szd.1079
first (goals.md M1.3).

teiCrafter's own per-feature proof for the engine side of this contract (graphic url,
zones in pixels, place/work entities, authority idno, line-level model, byte-identical
round-trip) is `node test/tools/szd_demo_check.mjs` (32/32).

Port parity (this port produces byte-identical output to the reference prototype over the
handful, so the Python output round-trips through the engine exactly as the prototype's
does) is `node test/tools/port_parity.mjs` (6/6 byte-identical).
