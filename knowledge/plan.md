---
title: Plan
project:
  name: teiCrafter
  repository: https://github.com/DigitalHumanitiesCraft/teiCrafter
method:
  name: Promptotyping
  url: https://lisa.gerda-henkel-stiftung.de/digitale_geschichte_pollin
template:
  name: Vorlage Plan
  version: 0.3
  url: https://dhcraft.org/Promptotyping/promptotyping-document/plan
  alias: https://dhcraft.org/Promptotyping/#promptotyping-document-plan
status: complete
created: 2026-10-10
updated: 2026-10-10
language: en
related: [architecture, specification, testing, wenzelsbibel, journal, handoff, INDEX]
---

# Plan

This plan orders the work that remains planned for teiCrafter. The legacy application under `docs/` is the derivable base for project-specific versions, and the source-first editor under `src/` is rebuilt beside it. The decision that keeps the legacy application as base is recorded in the [specification](specification.md#legacy-application-as-derivable-base-2026-10-10).

## Completed

The refactoring that makes the base derivable is complete. The generic editor under `docs/js/editor/` names no project, the Wenzelsbibel code, styles and examples live in `docs/js/projects/wenzelsbibel/` behind one entry file, and a workspace registry answers the generic editor's questions about installed projects. [Architecture](architecture.md#project-workspaces) holds the resulting module map and workspace fields, the [journal](journal.md) records the decisions taken on the way, and [integration](integration.md#deriving-a-project-version) states how a derived version builds on the base.

## Open decisions in the base

| Decision | Needed before | Recommendation |
| --- | --- | --- |
| Whether the bottom inspector (forms from a field table) and the register autocomplete built for the wenzelsbibel-teiCrafter fork become generic base components | No blocking dependency | Generic base components, project field tables and labels stay in the fork |
| Phase selection for a Schematron entry in the schema set, replacing the rewrite of `defaultPhase` in the workspace's review action | No blocking dependency | Add as a generic schema-set option |

## Rebuild phase

The source-first rebuild under `src/` continues until the new editor carries an application shell for the three use cases. It writes nothing into `docs/`. The switch of the GitHub Pages source, the retirement of `docs/`, the legacy tests and the cluster-specific knowledge documents wait until the new editor can also serve as derivable base. [Design](design.md), [testing](testing.md) and [project](project.md) describe the legacy editor until then.

1. Compare prototypes A, B and C under `prototypes/` in the browser and record which interaction carries into the product.
2. Build the app shell on `src/` with the three use cases, targeting [architecture](architecture.md), [specification](specification.md), [design](design.md) and `src/app/`.
3. Decide whether schema errors block Save (the open decision in the [specification](specification.md#open-decision-on-save)).

Findings from building the prototypes, to be weighed in the comparison:

- The automatic closing of tags while typing (`autoCloseTags` of the XML language package) contradicts F.5 in A and B and should be switched off in `xml-editor.ts`.
- The default highlight style misses contrast on the secondary surface; a token-based highlight style belongs in `src/editor/`.
- `createXmlState` needs an explicit line-separator argument for slices without their own line break (B and C work around it).
- B loses undo at every focus change, which violates F.7, and slices start without their first-line indentation. Hiding the surrounding document inside one whole-document editor would keep undo.
- C reads well at the reading level and its click-to-caret source editing is precise, but word-level TEI becomes a wall of marks, attributes reflow lines, and every Apply re-renders the whole document.
- Candidates for `src/`: a well-formedness reason extractor (duplicated in A and C), the outline builder from B, the `name` and `rs` entity resolver from C, an offset-tree element summary.
