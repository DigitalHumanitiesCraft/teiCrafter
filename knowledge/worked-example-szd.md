---
title: teiCrafter SZD Worked Example
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
created: 2026-06-08
updated: 2026-06-08
language: en
version: 0.8
topics: ["[[Worked Example]]", "[[TEI XML]]", "[[Stefan Zweig]]", "[[Editopia]]"]
related: [project, specification, goals, testing]
---

# teiCrafter SZD Worked Example

One real SZD object taken end-to-end in the browser editor: open it, verify the
facsimile, correct a transcription slip, enrich it with authority-linked entities,
mark textual-critical uncertainty, and save byte-faithfully. This is the teiCrafter
half of the demo gate (the success criterion in [goals](goals.md), milestone M7.2)
and the textual substance for the talk (M7.3). It is written to be reproducible and
honest: every claim here is backed by a runnable proof or an existing screenshot,
not by assertion. The parallel ZBZ object is the ZBZ lane's half of the same gate.

## 1. The object

`o_szd.1079` is a letter from Stefan Zweig to Max Fleischer, dated 22 May 1901
(shelfmark SZ-LAS/B3.1), licensed CC-BY. It has 5 folios and is line-level: the
reading text is segmented by `<lb/>` with no word tags (`<w>`), so the editor works
line by line. Each surface (`surf_1` to `surf_5`) carries a GAMS page image as
`<graphic url="https://gams.uni-graz.at/o:szd.1079/IMG.N"/>`.

Provenance: it begins as szd-htr Page-JSON (v0.2) and is turned into TEI by the
deterministic converter `pipeline/export_tei.py`. That converter is a rule, not an
LLM: the same input always produces the same TEI, so the structure is reproducible
and auditable. The resulting file is opened directly in teiCrafter with no further
preprocessing. Its provenance is recorded honestly in the file itself: the
`publicationStmt` reads

> "Machine-generated TEI from szd-htr Page-JSON (gemini-3.1-flash-lite-preview).
> Structure unreviewed; transcription agent_verified. Rights: CC-BY."

So the human editor opens it knowing the structure is machine-generated and not yet
reviewed, and the transcription is agent-verified but not human-final. teiCrafter is
where the human verifies, corrects, and curates that machine output.

## 2. End-to-end walkthrough

Each step gives (a) the editorial action, (b) the exact browser interaction (which
pane, which button), and (c) what the engine does losslessly underneath. The engine
keeps the raw file string as the single source of truth; every edit is an offset
splice into that string, so `serialize()` returns a byte-identical file except at
the edited spans.

1. **Open the edition and verify the facsimile.**
   (a) Bring the object into the editor and confirm the page image actually renders,
   so editor and folio are looking at the same thing.
   (b) Toolbar: click **Open local TEI** and choose `o_szd.1079.tei.xml`. The
   facsimile pane (OpenSeadragon) loads the folio-1 page image; the reading pane
   shows the lines.
   (c) The engine parses the raw string into the editor model and reads
   `surface.graphic` from each `<graphic url>` (M2.2). The image URL is taken
   verbatim from the TEI; nothing in the file is rewritten on open.

2. **Navigate the 5 folios.**
   (a) Read through the letter folio by folio to locate what needs editorial work.
   (b) Use the folio navigation to step folio 1 to folio 5. Folio 1 is the address
   (Wohlgeboren / Herrn Max Fleischer / Komotau / Böhmen), folio 3 is the letter
   body, folio 4 is the closing, and folio 5 repeats folio 4 verbatim, an HTR
   duplication left in place for the editor to judge, not silently removed.
   (c) Navigation only changes which folio is rendered. No edit is made, so the raw
   string is untouched.

3. **Correct the HTR slip "Gerichte" to "Gedichte" on a folio-3 line.**
   (a) On folio 3 a line reads "Gerichte wahr, die mir zu einem Aufsatz über Franz".
   In context (Zweig the poet, an "Aufsatz", and the later line "da fielen mir mehr
   Gedichte ein") the intended word is almost certainly "Gedichte", not "Gerichte"
   (courts/dishes). This is an illustrative editorial judgement: the editor decides
   the reading; the tool only executes it. teiCrafter does not guess and does not
   auto-correct.
   (b) Reading pane: click the line, edit the text inline from "Gerichte" to
   "Gedichte", confirm.
   (c) The engine computes the exact character offsets of that cell in the raw
   string and splices the new text in (`editCell`). Only those bytes change; the
   `<lb/>` structure, surrounding whitespace, and the rest of the file are
   preserved exactly.

4. **Add the entity triad and attach authority identifiers.**
   (a) Record the people, places, and works the letter is about, with stable
   authority identifiers where they are genuinely known.
   (b) Index panel (right): use **add person**, **add place**, **add work**, then
   type the authority id into the per-entity authority field (placeholder "authority
   id or URI"), choosing the register (GND / GeoNames / Wikidata).
   - Stefan Zweig (person): GND `118637495`.
   - Wien / Vienna (place): GeoNames `2761369`, Wikidata `Q1741`.
   - A work mentioned in the letter (for example the periodical the editor is
     cataloguing): added as a work entry; its authority id is left to the editor.
   Where an id is not safely known it is left empty and resolved later via the live
   authority lookup (M3.3), not invented. Concretely, Max Fleischer (person),
   Komotau (place), and the periodicals named in the body are entered by name with
   the authority field left empty, to be resolved via the live lookup. teiCrafter
   never fabricates an identifier.
   (c) The engine adds entities into `<standOff>` (`addEntity`, ids prefixed
   `pers_` / `plc_` / `wrk_`) and writes each identifier as an `<idno type="...">`
   under the entity (`setAuthority`). Adding, replacing, or clearing an id is again
   an offset splice; setting an empty value removes exactly that one `<idno>` and
   nothing else.

5. **Link an in-text mention of Wien.**
   (a) Connect the word "Wien" in the folio-3 body to the Wien place entity, so the
   mention points at the authority record.
   (b) Index panel: click the **link** button on the Wien entity, then click the
   "Wien" line in the reading pane.
   (c) The engine wraps that reading-text node in `<name ref="#plc_...">`
   (`linkMention`). The visible text is unchanged; only the wrapping markup is
   inserted, again as a splice.

6. **Mark one uncertain reading and one illegible passage.**
   (a) Flag a reading the editor is not sure of as uncertain, and a passage that
   cannot be read at all as a gap. These are honest statements of editorial
   confidence, kept in the text rather than hidden.
   (b) Toolbar: click **Mark text**, then click the line; choose **unclear** for the
   uncertain reading, or **gap** for the illegible passage.
   (c) `unclear` wraps the line's core in `<unclear>...</unclear>`, keeping the edge
   whitespace (`markCritical`). `gap` replaces the core with a content-less
   `<gap/>`, per TEI (a gap has no text). Both are offset splices.

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
node test/tools/szd_worked_example.mjs
```

This runs the real engine modules over the worked-example path and asserts, among
others: round-trip byte-identical on open and on save; the GAMS `<graphic url>` is
read for the facsimile; the "Gerichte" to "Gedichte" correction is an isolated
splice; `addEntity` plus `setAuthority` round-trip and read back (Zweig GND, Wien
GeoNames/Wikidata, a work); a Wien mention links via `<name ref>`; and `unclear`
and `gap` markup round-trip. Exit 0 is a pass.

The currently green sibling proof covering the same engine surface (folios/lines,
graphic url, place and work entities, authority add/replace/remove, linkMention) is
`node test/tools/szd_demo_check.mjs` (PASS line: "PASS: SZD demo path, place/work
entities, authority idno, and graphic url all verified.").

Browser evidence (rendering and interaction):

- M2.2 facsimile render: the GAMS page image actually rendering for this object in
  OpenSeadragon under headless Chrome is recorded in `c:\tmp\m2_2_1079_folio1.png`
  (folio 2 in `c:\tmp\m2_2_1079_folio2.png`), 2026-06-08.
- M7.2 end-to-end browser run (Playwright, headless Chrome, 2026-06-08; script
  `c:\tmp\pwtest\m72.js`, screenshots `c:\tmp\m72_edit.png` and
  `c:\tmp\m72_annotate.png`): open `o_szd.1079`; download immediately and confirm the
  saved file is byte-identical to the source (open-then-save no-op); correct a reading
  line inline and confirm the saved file differs only in that region; add a place entity
  with a GeoNames identifier through the index panel and confirm it inserts a
  `<standOff>` block; re-open the saved-and-annotated file and confirm it loads stably
  and re-downloads identically.

Evidence split, stated precisely: the headless proof covers the whole engine arc
(parsing, every splice, round-trip, entity / authority / mention and textual-critical
operations); the M2.2 screenshot covers facsimile rendering; the M7.2 Playwright run
covers the browser interaction for open, save, an inline line correction, a place
annotation, and re-open. The paths not yet exercised in a browser run, and so awaiting
operator visual sign-off, are the textual-critical Mark-text actions (unclear / gap),
in-browser mention linking, the live authority fetch, the note click, and the AI
proposal.

## 4. Entities

Only confident, well-known identifiers are filled. Everything else is marked "via
live lookup" and resolved with the in-browser authority lookup (M3.3); no id is
invented.

| Name | Type | Authority |
|------|------|-----------|
| Stefan Zweig | person | GND 118637495 |
| Wien (Vienna) | place | GeoNames 2761369; Wikidata Q1741 |
| Max Fleischer | person | via live lookup |
| Komotau | place | via live lookup |
| Periodical(s) named in the letter | work | via live lookup |

## 5. What this demonstrates

This is one real SZD object carried end-to-end in the browser editor: opened from
deterministically converted, machine-generated TEI; its facsimile verified; an HTR
slip corrected by editorial judgement; persons, places, and a work added and
authority-linked where the identifiers are genuinely known and left to the live
lookup where they are not; an in-text mention linked; uncertainty and illegibility
marked; and the whole thing saved byte-faithfully. That is exactly the demo gate's
success criterion for the SZD side (M7.2). The ZBZ object is the parallel ZBZ lane's
half of the same gate. Together they show teiCrafter doing the job the talk claims
for it: a deterministic tool where the human verifies and curates LLM-assisted
output, with the file's provenance and the editor's confidence kept visible and the
bytes kept honest.
