# Sight-check: the two demo object streams and the Wenzelsbibel codex load path

Date: 2026-07-08. This is the delegated stand-in for the operator sight-check
that stood open on the demo gate (M7.2): both worked-example objects taken
end-to-end in the running browser editor, plus the Wenzelsbibel codex load path.
The operator delegated the running of this check on 2026-07-08; formal acceptance
stays with the operator. This report is the decision aid, with the finding per
check and the concrete on-screen evidence. It follows the earlier
agent-driven evaluation method.

## 1. Method

The editor is the client-only browser tool served over HTTP (the File System
Access and module paths do not work from `file://`). Served with
`python -m http.server 8791 --directory docs` on a free port (8765 was in use by
another server), driven in Chrome through the Claude-in-Chrome tools in a
dedicated tab.

The three objects were opened through the real UI example deep links
(`editor.html#example=KEY`), which run the same load path as the Load menu and
are gated to local development hosts (`FEATURES.examples`). `szd` and `wb` are
registered examples. ZBZ doc 1000 is not a registered example (only doc 100 is),
so a local-only registry entry `zk` was added for the duration of the check,
pointing at the gitignored `docs/data/editor/zbz-1000/zbz-hersch-1000.xml` and
reusing the ZBZ Hersch project manifest; the edit was reverted after the run and
the working tree is clean. This is the same spirit as the picker-stub harness the
2026-06-10 evaluation used.

One tooling constraint shaped the evidence capture. The OpenSeadragon facsimile
canvas intermittently wedges the browser screenshot command (`Page.captureScreenshot`
times out) while the deep-zoom viewer is animating; the DOM stayed fully responsive
throughout (`get_page_text`, `read_page`, console and network reads all worked, no
page errors). Facsimile views were captured on their first paint after load; the
reading, index and source views captured without trouble. No action that would
raise a browser dialog (`alert`/`confirm`) was taken; in particular no inline edit
was committed (each was cancelled with Escape, leaving the document non-dirty) and
no Download was triggered.

## 2. SZD o_szd.1079

Loaded via `#example=szd`. Document strip: `o_szd.1079.tei.xml`, Project Stefan
Zweig Digital, Type Letter, Editing unit lines, 5 pages. Status line "Loaded the
Stefan Zweig Digital example (facsimile via GAMS)". Integrity chip
"well-formed, lossless" green.

- Facsimile with GAMS image: PASS. Folio 1 renders in OpenSeadragon (the address
  envelope, Wohlgeboren / Herrn Max Fleischer / Komotau / Boehmen). The object
  carries zone elements, so the Zones overlay applies.
- Diplomatic reading view and folio navigation: PASS. The reading pane shows the
  line-level text; stepping to folio 3 renders the letter body, with line 20
  reading "Gerichte wahr, die mir zu einem Aufsatz ueber Franz", the documented
  HTR slip (Gerichte for Gedichte) the worked example corrects.
- Inline diplomatic editor: PASS. A click on the line opens the inline edit field
  with the line text; Escape cancels cleanly with no dirty state.
- In-text annotation chooser: PASS. Selecting a word ("Donath") opens the flat
  filterable action list: ENTITIES (new person/place/organisation/work/event),
  MARKUP (persName, placeName, orgName, date, term, foreign, hi, title, any
  element name plus wrap), CRITICISM (unclear, deleted, added, gap), NOTE.
- Index panel: PASS. Sections Persons, Places, Organisations, Works, Events, with
  the All / Missing id / No mention filters. The standOff is empty, as expected
  for the object before the editor adds entities.
- XML source editor: PASS. Syntax-highlighted TEI with line numbers, the `<lb/>`
  and `<pb n facs="#surf_N"/>` structure visible, and Find / Check XML / Apply /
  Cancel controls.

## 3. ZBZ doc 1000

Loaded via the local-only `zk` entry. Document strip: `zbz-hersch-1000.xml`,
Project Jeanne Hersch (Zentralbibliothek Zuerich), Editing unit lines, 4 pages.
Status line "Loaded ZBZ Hersch doc 1000". Integrity chip "well-formed, lossless"
green. The "Export inline-GND" toolbar button appears, confirming the interchange
opt-in manifest resolved.

- Facsimile with the zbz GitHub Pages image: PASS. Folio 1 renders the e-periodica
  metadata sheet (Zeitschrift, Herausgeber, Band 109 (1973), Heft 39, the usage
  terms, ETH-Bibliothek Zuerich E-Periodica).
- Zone overlay: PASS. Toggling Zones draws the blue zone boxes aligned to the
  metadata table, the stray "Heft" token, and the usage-terms blocks. The object
  carries the per-surface zones the reading text anchors to.
- Diplomatic reading view and folio navigation: PASS. Folio 1 shows the N001
  metadata lines including the documented stray "Heft" token; stepping to folio 3
  renders the French congress report ("QUE REPROCHE-T-ON A L'ECOLE-CASERNE ?"),
  the accented text rendering correctly.
- In-text annotation chooser: PASS. Selecting text opens the same action chooser
  as the SZD object.
- Index panel: PASS. Same section structure; empty standOff, as expected for the
  unchanged pipeline output.
- XML source editor: PASS. The zone-anchored structure is visible
  (`<lb facs="#facs_N_..." n="N00x"/>`, `<pb facs="#facs_3" n="3"/>`,
  `<div type="text">`, `<p facs="#facs_3_r_1">`), matching the prepared facsimile
  links and the object's zones.

## 4. Wenzelsbibel codex load path

Loaded via `#example=wb` (the real codex, present locally, `codex-2759.xml`, about
82 MB). Document strip: Project Wenzelsbibel (Codex 2759), Editing unit words, 480
pages. Status line "Loaded the real Wenzelsbibel codex (facsimile via IIIF)".
Integrity chip green.

- Project load and word-level reading: PASS. The codex parses and opens; the
  reading pane shows the word-level diplomatic text (PROLOGUS ...) with the
  Diplomatic / Normalized view toggle and the textual-criticism legend (unclear,
  deleted, added). The manifest resolves (IIIF image template, word indices, views).
- Facsimile via OeNB IIIF deep zoom: PASS, with an observation. The illuminated
  folio 1r renders in the deep-zoom viewer (the miniature plus the two columns of
  Gothic script), and after a page turn folio 1v renders the full two-column page.
  Observation: on the initial load and after each page turn the facsimile pane is
  blank until the first viewport interaction (the OSD home or zoom control), after
  which the IIIF image paints. The console carries OpenSeadragon warnings "WebGL
  cannot be used to draw this TiledImage because it has tainted data", so the tiled
  cross-origin IIIF source is not composited by the WebGL drawer and paints via the
  canvas fallback only once the viewport is nudged. The single-image facsimiles
  (SZD via GAMS, ZBZ via GitHub Pages) painted immediately without this step. This
  is a cosmetic first-paint lag on the tiled IIIF source, not a functional defect;
  the image, deep zoom and zone overlay all work once painted.
- Paging (blaettern) and zone overlay: PASS. Stepping folio 1r to folio 1v updates
  both the reading text and (after the viewport nudge) the facsimile; the Zones
  overlay draws the word-level zone boxes across both columns. The known cost, a
  roughly two-second full re-parse per word edit on the full codex, is the expected
  price and is not a finding.

## 5. Issue found

One observation worth the operator's eye, none blocking:

1. The OeNB IIIF facsimile does not paint until the first viewport interaction on
   initial load and after each page turn, with a WebGL "tainted data" console
   warning; it then renders via the canvas fallback. The tiled cross-origin IIIF
   source is affected where the single-image GAMS and GitHub-Pages facsimiles are
   not. Likely fixable by setting the OSD `crossOriginPolicy` on the tile source
   (or forcing the canvas drawer for tainted tiles) so the first paint needs no
   nudge. This is a rendering-mode cosmetic, not a losslessness or data issue.

## 6. No-op save and losslessness

The browser no-op Download was deliberately not exercised, to avoid a file-download
side effect. The in-UI evidence for losslessness is the live "well-formed, lossless"
integrity chip, green on all three objects in every view, which asserts that the
engine `serialize()` equals the canonical raw string. The standing byte-identical
evidence is the headless per-object proof (`szd_worked_example`, `zbz_worked_example`,
both green in the regression gate), which proves open and save byte-identical over
the real engine modules.

## 7. Verdict

All three streams pass the sight-check. Both demo objects open end-to-end in the
running editor with facsimile, diplomatic reading, folio navigation, the in-text
annotation chooser, the index panel and the XML source editor all working, and the
live lossless chip green. The Wenzelsbibel codex loads, its OeNB IIIF facsimile
renders in deep zoom with word-level zone overlays, and paging works. The only
observation is the cosmetic first-paint lag on the tiled IIIF facsimile (blank until
a viewport nudge, with a WebGL tainted-data warning), which does not affect
losslessness or the data and is a candidate for a small OSD crossOrigin fix. On this
basis the demo sight-check is recommended for acceptance, with the IIIF first-paint
observation logged as a minor follow-up.
