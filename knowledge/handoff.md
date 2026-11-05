---
title: Handoff
project:
  name: teiCrafter
  repository: https://github.com/DigitalHumanitiesCraft/teiCrafter
method:
  name: Promptotyping
  url: https://lisa.gerda-henkel-stiftung.de/digitale_geschichte_pollin
template:
  name: Vorlage Handoff
  version: 0.1
  url: https://dhcraft.org/Promptotyping/promptotyping-document/handoff
status: active
created: 2026-09-11
updated: 2026-10-31
language: en
topics: ["[[Promptotyping]]", "[[Knowledge Base]]"]
related: [INDEX, journal]
---

# Handoff

This process inbox holds received deltas awaiting integration. Verify each source and current destination, integrate durable content into its owning document, record the source, destination and outcome in [journal.md](journal.md), then remove the processed item. Open items carry `Received`, `Source`, `Target` and `Context`.

## Open handoff items

### Review of agent proposals in the SZD derivation diverges from the proposal layer

- Received: 2026-10-31
- Source: szd-teiCrafter, ADR-015 and ADR-016 in `knowledge/specification.md`, `js/proposals.js`, `js/review.js` (commit e9e761d)
- Target: `knowledge/data.md` (acceptance encoding, around the paragraph on `urn:teicrafter:proposal:accepted`), `knowledge/derivation.md` (case register, open question on the save gate and provenance departures)
- Context: The SZD derivation lets LLM agents work beside the editor and loads their annotations as a proposal file, reviewed one by one. Accepting writes `resp="#resp-agent-annotation #resp-editor-review"` pointing to two `respStmt` in `titleStmt`, following the provenance contract of zbz-ocr-tei (E131 there), and writes no `@ana` acceptance token and no reviewer URN. Proposals stay outside the text until decided, so a saved file never holds an undecided one. The base appends `urn:teicrafter:local-reviewer` and `urn:teicrafter:proposal:accepted:%23ai`. Decide whether the base aligns, keeps its form, or records the difference as a derivation case. The proposal file format (`teicrafter-proposals/0.2`, described in `knowledge/data.md` of szd-teiCrafter) is a candidate for a shared format.

### Further generic findings of the SZD derivation

- Received: 2026-10-31
- Source: szd-teiCrafter, `knowledge/journal.md` entries of 2026-10-31
- Target: `knowledge/specification.md` of the base, as candidates for generic modules
- Context: Selections may span empty line-break elements, so a name broken across lines becomes one element (`lineBreakPattern` in `js/actions.js`). The date parser reads German, English, French and Roman forms and completes incomplete dates from a document date as inferred (`js/dates.js`). Unlinked marks count as open work. Each of these was found by LLM agents annotating through the editor, a way of testing an editor that may serve the base as well.
