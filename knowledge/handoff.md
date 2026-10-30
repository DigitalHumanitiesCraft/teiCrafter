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
updated: 2026-10-30
language: en
topics: ["[[Promptotyping]]", "[[Knowledge Base]]"]
related: [INDEX, journal]
---

# Handoff

This process inbox holds received deltas awaiting integration. Verify each source and current destination, integrate durable content into its owning document, record the source, destination and outcome in [journal.md](journal.md), then remove the processed item. Open items carry `Received`, `Source`, `Target` and `Context`.

## Open handoff items

### Derivation trial: teiCrafter SZD

- Received: 2026-10-30
- Source: the local repository `szd-teiCrafter` (commits `a930871` to `584bf35`, remote `DigitalHumanitiesCraft/szd-teiCrafter` not yet created), its `knowledge/specification.md` (ADR-001 to ADR-005) and `knowledge/plan.md` (milestone M7).
- Target: the derivation contract in [architecture.md](architecture.md) beside the workspace registry, and [plan.md](plan.md) where it decides between the legacy `docs/` base and the `src/` stack.
- Context: A second derivation was built on a freely licensed Stefan Zweig Digital letter as a small, build-free editor rather than a clone of this repository, because the audit of 2026-10-30 found the base still coupled to Wenzelsbibel, ZBZ and SZD code (CSS link in `docs/editor.html`, `docs/js/projects/index.js`, a generic e2e spec importing from `projects/wenzelsbibel/`). Its cut is one source configuration (`js/source.js`) holding the IIIF manifest rule, the element suggestions and the annotation markup, while generic modules handle editor, TEI facts, IIIF resolution, viewer, validation and GND search. The cut held through three operator iterations. It is evidence for a derivation contract in which a derivation adds a configuration and touches no base file, which the current registry does not yet reach. The operator stated Git as the backend for partners, editor and research data in one repository, saving in place through the File System Access API, exchange by commit and push. The section "Deriving a project version" in [integration.md](integration.md#deriving-a-project-version) currently describes only the fork form.
- Evidence: `szd-teiCrafter/test/browser-check.mjs`, all checks passing on 2026-10-30.
- Operator answer (2026-10-30): „Wir wollen ja das teiCrafter-Repo quasi immer optimieren und verbessern. Wenn wir ein paar Fälle haben, können wir die qualitativ beobachten, analysieren, diskutieren, ableiten, generalisieren und dadurch das insgesamt verbessern.“
- Next action: Create knowledge/derivation.md as the single place of the derivation contract and the case register: the two observed forms (fork with upstream merge as Wenzelsbibel, standalone repository with one source configuration as SZD), the invariants every derivation inherits, the known integration traps, and the checks each derivation runs; the Wenzelsbibel invariants and SZD ADR-002/004 then point to it.
