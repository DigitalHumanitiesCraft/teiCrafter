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
updated: 2026-06-13
language: en
version: 0.16
topics: ["[[Promptotyping]]", "[[Method]]", "[[Project Status]]"]
related: [project, journal, integration]
---

# teiCrafter as a Promptotyping Case

teiCrafter presented as a worked [Promptotyping](https://lisa.gerda-henkel-stiftung.de/digitale_geschichte_pollin)
artifact. This document is the repo-side case description and status spine. The
vault-side provenance (the operator's Obsidian space) is referenced here, not written
here; it is the operator's to complete.

## 1. What the case is

teiCrafter is the third Promptotyping case in the talk and paper, alongside the
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
    per the convention), with the live implementation status in [architecture.md](architecture.md)
    and the proofs in [testing.md](testing.md);
  - the [journal](journal.md) as the decision record (chronological, most recent first, the
    narrative of how the tool and its decisions came about);
  - the Git history as the build trace (per-milestone commits, each citing a re-runnable proof).

The point of the case: the artifact and its reasoning are inspectable side by side, so the
method (prompt-driven prototyping documented as it happens) is reproducible, not just the
result.

## 2. Provenance pointers (repo)

Everything below is on disk in this repository.

- The knowledge document map: [INDEX.md](INDEX.md). It carries the document map (which
  document answers what, read first when, depends on) and the glossary of core concepts.
- The decision log: [journal.md](journal.md). Chronological, most recent first; commits live
  in Git history, the journal explains why.
- The build trace, repo side: the repo-side provenance traces are the knowledge base, the
  [journal](journal.md) as decision record, and the Git history as build trace
  (per-milestone commits citing re-runnable proofs), with the live implementation status in
  [architecture.md](architecture.md) and the proofs in [testing.md](testing.md). Milestone
  planning and the implementation backlog are research steering and live outside this
  repository.
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

## 3. Project status

The live build status is [architecture.md](architecture.md) (Implementation Status) and the
proofs are [testing.md](testing.md).

## 4. How to present it

- Live demo: the worked examples, [worked-examples.md](worked-examples.md) (o_szd.1079 and
  ZBZ doc 1000, each end-to-end in the editor). They show the loop concretely: open a real
  edition, correct a line, annotate an entity with an authority identifier, save byte-faithfully.
- Method story: the knowledge base ([INDEX.md](INDEX.md) as the entry) plus the
  [journal](journal.md) as the decision record. The case is that the artifact and its reasoning
  are inspectable together.
- Vault-side provenance: the vault-side provenance of the Promptotyping case is drafted in the
  operator's Obsidian space (`Projects/Research Tools/teiCrafter/2026-06-09 - teiCrafter als
  Promptotyping-Fall (Provenienz).md`, marked claude-code-worker); it closes with the operator's
  approval.

The talking points are assembled in the operator's vault (talk work outside the repo); this
file is the repo-side case description and status spine.
