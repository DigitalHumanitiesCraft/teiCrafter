---
title: teiCrafter ZBZ Worked Example
project:
  name: teiCrafter
  repository: https://github.com/DigitalHumanitiesCraft/teiCrafter
method:
  name: Promptotyping
  url: https://lisa.gerda-henkel-stiftung.de/digitale_geschichte_pollin
template:
  name: Vorlage Worked Example
  version: 0.1
  url: https://dhcraft.org/Promptotyping/promptotyping-document/worked-example
status: active
created: 2026-06-09
updated: 2026-06-12
language: en
version: 0.14
topics: ["[[Worked Example]]", "[[TEI XML]]", "[[Jeanne Hersch]]", "[[Editopia]]"]
related: [project, specification, goals, testing, paper-evidence, worked-example-szd]
---

# teiCrafter ZBZ Worked Example

One real ZBZ object taken end-to-end in the browser editor: open it, verify the
facsimile, correct an OCR slip, enrich it with authority-linked entities, mark
textual-critical uncertainty, and save byte-faithfully. This is the ZBZ half of the
demo gate (the success criterion in [goals](goals.md), milestone M7.2); the SZD half
is [worked-example-szd](worked-example-szd.md). It is written to be reproducible and
honest: every claim here is backed by a runnable proof, not by assertion. Beyond the
gate, this example is the paper's added-value demonstration: it shows what the
curated TEI has that the pipeline TEI does not (section 6).

## 1. The object

ZBZ doc 1000 is "TRANSFORMER L'ÉCOLE OU LA SUPPRIMER ?", a special issue of the
weekly *éducateur et bulletin corporatif* (organ of the Société Pédagogique de la
Suisse Romande), volume 109 (1973), issue 39, reporting on the 20th Semaine
pédagogique internationale at the Château de Villars-les-Moines, 16 to 21 July 1973.
The catalog author is Jeanne Hersch; folios 3 and 4 carry the summary of her exposé
"L'école, lieu de rencontre de mémoire et d'invention" and Étienne Verne's exposé on
Ivan Illich's deschooling argument. It has 4 folios and is line-level: the reading
text is segmented by `<lb/>` with no word tags (`<w>`), so the editor works line by
line. The alignment is exactly 1:1: 4 `<pb>`, 4 `<surface>` (`facs_1` to `facs_4`),
4 page images.

Provenance: the file is the unchanged output of the zbz-ocr-tei unified TEI pipeline
(`docs/data/pages/1000/1000_final.xml`: rule-based scaffold, Gemini refinement,
deterministic assembly), with one preparation step applied in this repo: each
`<surface>` received a `<graphic url>` pointing at the published page image
(`https://chpollin.github.io/zbz-ocr-tei/images/1000/1000_p001.png` to `_p004.png`),
per the M2.4 image-URL scheme. The injection is itself a deterministic string rule,
`test/tools/make_zbz1000_demo.mjs`: the same pipeline file always produces the same
prepared file. The pipeline file itself carries no `<graphic>` elements; emitting
them upstream is an open order to the zbz lane. The file's
`<revisionDesc>` records its own status honestly: all three streams (ocr, layout,
tei) are `unverifiziert` at handover. The human editor opens it knowing exactly
that: machine-generated, schema-valid, unverified. teiCrafter is where the human
verifies, corrects, and curates that machine output.

The prepared file lives at `docs/data/editor/zbz-1000/zbz-hersch-1000.xml` and is
deliberately local-only: this repo treats Hersch material as not redistributable
(the same rights stance as `docs/data/editor/zbz-100/`, see `.gitignore`), so the
object is materialized on demand with `node test/tools/make_zbz1000_demo.mjs` from
the zbz-ocr-tei sibling checkout. Should ZBZ confirm that the four published demo
documents are redistributable, committing the file is a one-line gitignore change.

## 2. End-to-end walkthrough

Each step gives (a) the editorial action, (b) the exact browser interaction (which
pane, which button), and (c) what the engine does losslessly underneath. The engine
keeps the raw file string as the single source of truth; every edit is an offset
splice into that string, so `serialize()` returns a byte-identical file except at
the edited spans.

1. **Open the edition and verify the facsimile.**
   (a) Bring the object into the editor and confirm the page image actually renders,
   so editor and folio are looking at the same thing.
   (b) Toolbar: click **Open local TEI** and choose `zbz-hersch-1000.xml`. The
   facsimile pane (OpenSeadragon) loads the folio image from the published zbz
   GitHub Pages; the reading pane shows the lines.
   (c) The engine parses the raw string into the editor model and reads
   `surface.graphic` from each `<graphic url>` (M2.2, the generic path: no
   hardcoded image base is involved). The image URL is taken verbatim from the TEI;
   nothing in the file is rewritten on open.

2. **Navigate the 4 folios.**
   (a) Read through the issue folio by folio to locate what needs editorial work.
   (b) Use the folio navigation to step folio 1 to folio 4. Folio 1 is the
   e-periodica metadata sheet, folio 2 the magazine cover (with the château
   photograph), folio 3 the two-column congress report including the start of the
   Hersch exposé (and a photograph of Jeanne Hersch), folio 4 the continuation with
   the summaries of Hersch and of Verne on Illich.
   (c) Navigation only changes which folio is rendered. No edit is made, so the raw
   string is untouched.

3. **Correct the OCR slip "inadaption" to "inadaptation" on a folio-3 line.**
   (a) On folio 3 a line reads "dans les cas d'inadaption scolaire". The French word
   is "inadaptation" (the same page twice uses "inadaptés"); "inadaption" is an OCR
   slip. This is an illustrative editorial judgement against the facsimile: the
   editor decides the reading; the tool only executes it. teiCrafter does not guess
   and does not auto-correct.
   (b) Reading pane: click the line, edit the text inline from "inadaption" to
   "inadaptation", confirm.
   (c) The engine computes the exact character offsets of that cell in the raw
   string and splices the new text in (`editCell`). The change is a pure two-byte
   insertion ("at"); the `<lb/>` structure, surrounding whitespace, and the rest of
   the file are preserved exactly.

4. **Add the entity triad and attach authority identifiers.**
   (a) Record the people, places, and works the issue is about, with stable
   authority identifiers where they are genuinely known.
   (b) Index panel (right): use **add person**, **add place**, **add work**, then
   type the authority id into the per-entity authority field, choosing the register
   (GND / GeoNames / Wikidata).
   - Jeanne Hersch (person): GND `118815679` (resolved against lobid.org,
     2026-06-09).
   - Genève (place): Wikidata `Q71`, GeoNames `7285902` (resolved via Wikidata
     P1566, 2026-06-09).
   - Ivan Illich (person) and the work "Une société sans école" (Illich's book as
     discussed by Verne) are entered by name with the authority field left empty,
     to be resolved via the live lookup (M3.3). teiCrafter never fabricates an
     identifier.
   (c) The engine adds entities into `<standOff>` (`addEntity`, ids prefixed
   `pers_` / `plc_` / `wrk_`) and writes each identifier as an `<idno type="...">`
   under the entity (`setAuthority`). The pipeline TEI has no `<standOff>`; the
   scaffold is created on first use, again as an offset splice.

5. **Link an in-text mention of Genève.**
   (a) Connect the line naming "l'Université de Genève" (the affiliation line of
   the Hersch exposé) to the Genève place entity, so the mention points at the
   authority record.
   (b) Index panel: click the **link** button on the Genève entity, then click the
   line in the reading pane.
   (c) The engine wraps that reading-text node in `<name ref="#plc_...">`
   (`linkMention`). The visible text is unchanged; only the wrapping markup is
   inserted, again as a splice.

6. **Mark one uncertain reading and one stray token.**
   (a) Flag the footnote fragment "Perte de temps. Exemple : M. Oury" as uncertain
   (it is a column-split fragment whose placement and completeness are doubtful),
   and replace the stray OCR token "Heft" on folio 1 (it corresponds to no readable
   text at that spot) with an explicit gap rather than deleting it silently. These
   are honest statements of editorial confidence, kept in the text rather than
   hidden.
   (b) Toolbar: click **Mark text**, then click the line; choose **unclear** for
   the footnote fragment, **gap** for the stray token.
   (c) `unclear` wraps the line's core in `<unclear>...</unclear>`, keeping the
   edge whitespace (`markCritical`). `gap` replaces the core with a content-less
   `<gap/>`, per TEI. Both are offset splices; the metadata line "Heft: 39" directly
   above the stray token is untouched.

7. **Save byte-faithfully.**
   (a) Write the corrected, enriched file back.
   (b) Toolbar: click **Download** (or save in place when the File System Access
   handle exists).
   (c) The engine calls `serialize()`, which returns the canonical raw string. By
   construction the output is byte-identical to the input everywhere except the
   spans the editor actually changed.

## 3. The guarantee, with proof

Every edit above (correct text, add entity, set authority, link mention, mark
unclear, mark gap, save) is a surgical byte-faithful splice into the raw file
string. teiCrafter never reserializes the whole document and never normalises
whitespace, attribute order, or self-closing tags. Untouched bytes stay untouched.

Headless proof (engine):

```
node test/tools/zbz_worked_example.mjs
```

This runs the real engine modules over the bundled object and asserts, among
others: round-trip byte-identical on open and on save; the GitHub-Pages
`<graphic url>` is read for every one of the 4 surfaces; the "inadaption" to
"inadaptation" correction is a pure two-byte insertion proven by full
reconstruction; `addEntity` plus `setAuthority` round-trip and read back (Hersch
GND, Genève Wikidata/GeoNames, a work); a Genève mention links via `<name ref>`;
and `unclear` and `gap` markup round-trip. 38 checks, 11 surgical edits, exit 0 is
a pass (first green run 2026-06-09). The proof gates like the SZD one: it prefers
the materialized local file, else builds the object in memory from the zbz sibling
checkout, else SKIPs with exit 0. The PASS line reads: "PASS:
ZBZ doc 1000 went open -> correct -> annotate (person/place/work + authority +
mention) -> textual criticism -> save, every step a surgical byte-faithful splice."

Evidence split, stated precisely: the headless proof covers the whole engine arc
(parsing, every splice, round-trip, entity / authority / mention and
textual-critical operations). No browser run exists yet for this object: the
facsimile render from the zbz GitHub Pages, the inline correction, the index-panel
annotation, the Mark-text actions, and the live authority fetch all await the
operator's browser sight-check (the same split the SZD half had before its
Playwright run).

## 4. Entities

Only confident, resolved identifiers are filled. Everything else is marked "via
live lookup" and resolved with the in-browser authority lookup (M3.3); no id is
invented.

| Name | Type | Authority |
|------|------|-----------|
| Jeanne Hersch | person | GND 118815679 |
| Genève (Geneva) | place | Wikidata Q71; GeoNames 7285902 |
| Ivan Illich | person | via live lookup |
| Une société sans école (Illich) | work | via live lookup |

## 5. What this demonstrates

This is one real ZBZ object carried end-to-end in the browser editor: opened as
unchanged, schema-valid, unverified pipeline output (plus the prepared facsimile
links); its facsimile verified against the published page images; an OCR slip
corrected by editorial judgement; persons, a place, and a work added and
authority-linked where the identifiers are genuinely resolved and left to the live
lookup where they are not; an in-text mention linked; uncertainty and a stray token
marked explicitly; and the whole thing saved byte-faithfully. That is the demo
gate's success criterion for the ZBZ side (M7.2). Together with the SZD half it
shows teiCrafter doing the job the paper claims for it: a deterministic tool where
the human verifies and curates LLM-assisted output, with the file's provenance and
the editor's confidence kept visible and the bytes kept honest.

## 6. The added value, before and after

The paper's success criterion is that the workflow produces a demonstrably better
TEI for the Hersch project. This object makes the comparison concrete:

| Property | Pipeline TEI (`1000_final.xml`) | Curated TEI (after this walkthrough) |
|---|---|---|
| Facsimile | surfaces and zones, but no `<graphic>`: no image renders | one `<graphic url>` per surface; text and page image render side by side |
| Transcription | known OCR slips (for example "inadaption") | corrected against the facsimile, each fix an isolated splice |
| Entities | none (NER removed from the pipeline, decision E71: ~2.6 % real GND coverage) | `<standOff>` with persons, place, work; resolved GND / Wikidata / GeoNames identifiers; in-text mention linked |
| Editorial confidence | implicit (errors stand uncommented) | explicit `<unclear>` and `<gap/>` markup |
| Verification status | all three streams `unverifiziert` | the curation pass is the documented verification step the status model calls for |
| Pipeline output | given | preserved byte-exactly outside the edited spans; `<revisionDesc>` provenance untouched |

Everything in the left column stays intact in the right column. The added value is
additive and auditable: each improvement is an offset splice that can be diffed,
and the engine proof asserts exactly that.
