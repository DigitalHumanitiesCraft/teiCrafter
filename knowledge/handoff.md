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
updated: 2026-10-04
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
- Context: Compare prototypes A, B and C under `prototypes/` in the browser and record which interaction carries into the product. Build the app shell on `src/` with the three use cases. Decide whether schema errors block Save (open decision in the specification). Then switch the GitHub Pages source from `main:/docs` to the build artifact, retire `docs/`, the legacy tests and the cluster-specific knowledge documents, and update [design.md](design.md), [testing.md](testing.md) and [project.md](project.md), which still describe the legacy editor.
