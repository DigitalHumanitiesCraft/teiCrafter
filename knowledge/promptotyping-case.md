---
title: teiCrafter as a Promptotyping Case
project:
  name: teiCrafter
  repository: https://github.com/DigitalHumanitiesCraft/teiCrafter
method:
  name: Promptotyping
  url: https://lisa.gerda-henkel-stiftung.de/digitale_geschichte_pollin
template:
  name: Vorlage Promptotyping Case
  version: 0.1
status: active
created: 2026-06-08
updated: 2026-06-09
language: en
version: 0.11
topics: ["[[Promptotyping]]", "[[Method]]", "[[Project Status]]", "[[Editopia]]"]
related: [project, goals, journal, integration]
---

# teiCrafter as a Promptotyping Case

teiCrafter presented as a worked [Promptotyping](https://lisa.gerda-henkel-stiftung.de/digitale_geschichte_pollin)
artifact (milestone M7.1, repo side), folding in the repo-side substance of the
project-status presentation (M5.4). This document is the repo-side case description and
status spine. The vault-side provenance (the operator's Obsidian space) is referenced
here, not written here; it is the operator's to complete.

## 1. What the case is

teiCrafter is the third Promptotyping case in the Editopia talk and paper, alongside the
SZD and ZBZ input pipelines: the tool case, where a human verifies and curates machine
output in a deterministic editor. The Promptotyping argument is not made only by the
running tool; it is made by the tool together with its provenance, which is fully on disk:

- The tool itself: a browser-based, lossless editor for arbitrary TEI-XML (open an existing
  edition, correct it folio by folio at its natural granularity, save it back
  byte-faithfully), with an optional LLM on-ramp that drafts an initial TEI for verification.
  Client-only, no backend, no build step.
- The provenance, three traces that make the build legible as a method:
  - the `knowledge/` base, a set of function-separated Promptotyping documents (one defined
    function per document, redundancy expressed through cross-references, YAML frontmatter
    per the convention);
  - the [journal](journal.md) as the decision record (chronological, most recent first, the
    narrative of how the tool and its decisions came about);
  - the Git history as the build trace (per-milestone commits, each cited from `goals.md`).

The point of the case: the artifact and its reasoning are inspectable side by side, so the
method (prompt-driven prototyping documented as it happens) is reproducible, not just the
result.

## 2. Provenance pointers (repo)

Everything below is on disk in this repository.

- The knowledge document map: [INDEX.md](INDEX.md). It carries the document map (which
  document answers what, read first when, depends on) and the glossary of core concepts.
- The decision log: [journal.md](journal.md). Chronological, most recent first; commits live
  in Git history, the journal explains why.
- The on-disk gate plan: [goals.md](goals.md). The objectives register (H1 to H7), each
  milestone with status, every "done" line citing a re-runnable proof. The full plan and
  implementation backlog is `PLAN.md` at the repo root.
- The converter contract: [converter-reference.md](converter-reference.md). The deterministic
  Page-JSON v0.2 to TEI mapping, frozen and verified against the engine.

Key load-bearing decisions (each recorded in the journal; not invented here):

- Offset-splice core, not the DOM. The raw TEI string is canonical, edits are offset
  splices, `serialize()` returns that string verbatim, so untouched content cannot change.
  The 2026-05-30 consolidation generalised the editor to one generic, offset-true reader
  (`tei-document.js`) rather than per-project profiles; the editing unit (word vs line) is
  read from the document. Proven by the byte-identical round-trip sweep.
- Expert-in-the-loop, AI output always marked. The model assists, the human decides. AI-drafted
  content is marked machine-generated and unreviewed (violet, the `--color-ai` token family);
  AI-proposed entities are inserted as `resp="#ai"` (a TEI-valid, lossless responsibility
  marker) and the human confirms or rejects (journal 2026-06-08).
- The SZD converter is deterministic, never an LLM. The Page-JSON to TEI conversion is a rule
  (`pipeline/export_tei.py`), byte-faithful to the reference prototype; the LLM is used only
  for annotation proposals, never for the conversion (journal 2026-06-07, 2026-06-08).

## 3. Project status (M5.4 substance)

Current state, suitable as the spine of a status slide.

Built and headless-proven. The editor engine and the full editorial annotation layer are
built and proven headless (re-runnable node checks, exit code 0):

- generic lossless reader with byte-identical round-trip (the standing invariant);
- standOff entities (person / place / org / work / event) with authority identifiers
  (`<idno type="GND|GeoNames|Wikidata">`), add / replace / remove, each an idempotent splice;
- mention linking (`<name ref="#id">`, type-independent);
- editorial notes (lossless `<note target="#id">`);
- AI proposal (LLM proposes entities as unreviewed `resp="#ai"`, human confirms or rejects);
- live authority lookup (Wikidata / GND keyless and CORS-capable, GeoNames needs a username);
- inline textual criticism (`unclear` / `del` / `add` wrap the core keeping edge whitespace,
  `gap` replaces the core with a content-less `<gap/>`).

Success criterion, SZD half. The SZD half of the success criterion (M7.2) is done and now has
a worked example, [worked-example-szd.md](worked-example-szd.md): o_szd.1079 taken end-to-end
in the editor. Browser-verified 2026-06-08 (Playwright, script `c:\tmp\pwtest\m72.js`, evidence
`c:\tmp\m72_annotate.png`): the GAMS facsimile renders in OpenSeadragon (M2.2), open-then-save is
byte-identical, an inline line correction is localised to its region, a place entity annotation
inserts a `<standOff>` block, and the re-opened file is stable. The remaining steps of the worked
example (textual-critical Mark-text, in-browser mention linking, the live authority fetch) are
headless-proven (`node test/tools/szd_worked_example.mjs`, the full open to save arc as surgical
splices) and await operator visual sign-off. The SZD converter chain (M1.2 to M1.5) is cleared end
to end: the contract is frozen, `export_tei.py` is byte-faithful, and all 2,069 objects of the
TEI-canonical, upstream-deduplicated corpus convert and round-trip byte-identically (the earlier
2103 figure predates the dedup).

Success criterion, ZBZ half. Done at engine level since 2026-06-09: ZBZ `{id}_final.xml` loads
directly into the editor (285/285 usable views), and the ZBZ worked example on doc 1000 is
engine-proven (`node test/tools/zbz_worked_example.mjs`, 38/38; [worked-example-zbz.md](worked-example-zbz.md)).
The image-URL scheme (M2.4) is done for the demo object via the deterministic generator
`make_zbz1000_demo.mjs`; the object stays local-only under the documented Hersch rights stance,
and the browser sight-check is the operator's. Data flow across the three projects is
in [integration.md](integration.md).

Not done (stated plainly, so the status is honest):

- no apparatus authoring layer (the inline textual-critical markers exist; an editorial
  apparatus / variant-witness authoring surface does not);
- no IIIF tiles (the facsimile viewer is OpenSeadragon over plain images, IIIF-ready hook but
  not IIIF-served);
- no CodeMirror source view (no raw-XML editing surface; editing is through the rendered cells);
- no streaming for very large editions (the whole document is held in memory).

Browser sign-off status: the SZD facsimile render, the open / save round-trip, an inline line
correction, and a place annotation are browser-verified (2026-06-08, see the SZD half above); the
still-open browser-only paths (the textual-critical Mark-text actions, in-browser mention linking,
the note click, the live LLM call, the live authority fetch) are deterministic-proven headless and
await an operator visual sign-off.

## 4. How to present it

- Live demo: the SZD worked example, [worked-example-szd.md](worked-example-szd.md)
  (o_szd.1079, end-to-end in the editor). It shows the loop concretely: open a real edition,
  correct a line, annotate an entity with an authority identifier, save byte-faithfully.
- Method story: the knowledge base ([INDEX.md](INDEX.md) as the entry) plus the
  [journal](journal.md) as the decision record. The case is that the artifact and its reasoning
  are inspectable together.
- Talk work, partly outside the repo: the slide-deck and full-text assembly (M7.3) is talk
  work and lives partly outside this repository.
- Vault side, drafted and awaiting operator approval: the vault-side provenance of the
  Promptotyping case (M7.1) is drafted in the operator's Obsidian space
  (`Projects/Research Tools/teiCrafter/2026-06-09 - teiCrafter als Promptotyping-Fall
  (Provenienz).md`, marked claude-code-worker); it closes with the operator's approval.

## 5. Talking points (repo-side M7.3 draft)

A drafted, presentable spine for the teiCrafter portion of the slides and full text. The deck and
prose assembly itself is talk work outside this repository; this is the on-disk substance.

Thesis (one sentence): teiCrafter is a deterministic, browser-only editor that lets a scholar take
machine-generated TEI and verify, correct, and authority-enrich it folio by folio without ever
losing a byte, so the human stays the decider and the model stays an assistant.

Demo beats (the live SZD walkthrough, from [worked-example-szd.md](worked-example-szd.md) section
2): (1) open a real converted SZD letter and see its GAMS facsimile render; (2) navigate the five
folios; (3) correct an HTR slip inline by editorial judgement, not auto-correction; (4) add the
person / place / work triad with GND / GeoNames / Wikidata identifiers; (5) link an in-text
mention; (6) mark uncertainty (unclear) and illegibility (gap); (7) save and show the output is
byte-identical except where the editor touched it.

What we claim, and what we do not (the honesty slide): claimed and proven, byte-faithful lossless
editing on real data and the full annotation layer; claimed and browser-shown, the SZD object
end-to-end (open, correct, annotate, save, re-open); not built, an apparatus authoring layer, IIIF
tiles, a CodeMirror source view, and streaming for very large editions; the ZBZ worked example is
in the parallel lane.

Method pitch (one sentence): the build is legible as a Promptotyping case because the artifact and
its reasoning sit side by side on disk, the knowledge base as the documented method and the journal
as the decision record.
