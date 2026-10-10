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
updated: 2026-10-10
language: en
topics: ["[[Promptotyping]]", "[[Knowledge Base]]"]
related: [INDEX, journal]
---

# Handoff

This process inbox holds received deltas awaiting integration. Verify each source and current destination, integrate durable content into its owning document, record the source, destination and outcome in [journal.md](journal.md), then remove the processed item. Open items carry `Received`, `Source`, `Target` and `Context`.

## Open handoff items

### Finish the source-first rebuild

- Received: 2026-10-04
- Source: session of 2026-10-04 (operator request to refocus and refactor)
- Target: [architecture.md](architecture.md), [specification.md](specification.md), [design.md](design.md), `src/app/`
- Findings from building the prototypes, to be weighed in the comparison:
  - The automatic closing of tags while typing (`autoCloseTags` of the XML language package) contradicts F.5 in A and B and should be switched off in `xml-editor.ts`.
  - The default highlight style misses contrast on the secondary surface; a token-based highlight style belongs in `src/editor/`.
  - `createXmlState` needs an explicit line-separator argument for slices without their own line break (B and C work around it).
  - B loses undo at every focus change, which violates F.7, and slices start without their first-line indentation. Hiding the surrounding document inside one whole-document editor would keep undo.
  - C reads well at the reading level and its click-to-caret source editing is precise, but word-level TEI becomes a wall of marks, attributes reflow lines, and every Apply re-renders the whole document.
  - Candidates for `src/`: a well-formedness reason extractor (duplicated in A and C), the outline builder from B, the `name` and `rs` entity resolver from C, an offset-tree element summary.
- Context: Compare prototypes A, B and C under `prototypes/` in the browser and record which interaction carries into the product. Build the app shell on `src/` with the three use cases. Decide whether schema errors block Save (open decision in the specification). The switch of the GitHub Pages source and the retirement of `docs/`, the legacy tests and the cluster-specific knowledge documents are deferred since 2026-10-10, because the legacy application is the derivable base for project-specific versions until the new editor carries an application (journal entry of 2026-10-10, steps in [plan.md](plan.md)). [design.md](design.md), [testing.md](testing.md) and [project.md](project.md) still describe the legacy editor.
