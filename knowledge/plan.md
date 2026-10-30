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
status: active
created: 2026-10-10
updated: 2026-10-30
language: en
related: [architecture, specification, testing, wenzelsbibel, derivation, journal, handoff, INDEX]
---

# Plan

This plan orders the work that remains planned for teiCrafter. The legacy application under `docs/` is the derivable base for project-specific versions, and the source-first editor under `src/` is rebuilt beside it. The decision that keeps the legacy application as base is recorded in the [specification](specification.md#legacy-application-as-derivable-base-2026-10-10).

## Completed

The refactoring that makes the base derivable is complete. The Wenzelsbibel code, styles and examples live in `docs/js/projects/wenzelsbibel/` behind one entry file, and a workspace registry, the only route by which workspace code reaches the generic editor under `docs/js/editor/`, answers the generic editor's questions about installed projects. [Architecture](architecture.md#project-workspaces) holds the resulting module map and workspace fields, the [journal](journal.md) records the decisions taken on the way, and [derivation](derivation.md) states how a derived version builds on the base.

The generic code and tests still carry project-specific parts. [Derivation](derivation.md#base-coupling-a-derivation-meets) holds the one list of that coupling, and removing an entry is base work under the rule of the [specification](specification.md#legacy-application-as-derivable-base-2026-10-10).

## Open decisions in the base

| Decision | Needed before | Recommendation |
| --- | --- | --- |
| Whether the bottom inspector (forms from a field table) and the register autocomplete built for the wenzelsbibel-teiCrafter fork become generic base components | No blocking dependency | Generic base components, project field tables and labels stay in the fork |
| Phase selection for a Schematron entry in the schema set, replacing the rewrite of `defaultPhase` in the workspace's review action | No blocking dependency | Add as a generic schema-set option |
| Whether `knowledge/wenzelsbibel.md` stays in the base now that the Wenzelsbibel code lives in its project folder and the fork carries its own knowledge base | No blocking dependency | Operator decision; the document describes the base's Wenzelsbibel workspace as long as that workspace is installed here |
| Where the confirmer identity of accepted model proposals is set; today only the review dialog sets the reviewer identity that confirmation records, and a project-level or toolbar setting would make it reachable before the first confirmation | No blocking dependency | Operator decision |
| How a free-text reviewer identity is handled, since an identity containing whitespace is split into several `resp` tokens on confirmation | No blocking dependency | Operator decision; the dialog asks for a URI or TEI pointer, so a check at input is one option |
| Whether confirmations are dated, which needs a serialisation decision between an `xml:id` on the construct plus a `revisionDesc/change` and undated acceptance as today | Any claim that the file dates a confirmation | Operator decision |
| Whether line wrapping is on by default in the source-first editor under `src/`; the shared configuration offers wrapping with a hanging indent and leaves it off, prototype A exposes it as a toggle and prototype C's inline editors switch it on | The app shell on `src/` | Operator decision; [design](design.md#visual-identity-and-tokens) records the current default |
| How local recovery stores a large document; a checkpoint holds the active XML twice, at top level and in the project collection, and Chromium serialises a string with characters beyond Latin-1 at two bytes per character, so the Wenzelsbibel codex exceeds Chromium's IndexedDB value limit and recent Chromium refuses the write | Any claim that the real codex is recoverable after a browser crash | Store each document's XML once per checkpoint as a UTF-8 `Blob`, which leaves the structured-clone value small, and restore it with `Blob.text()`; the [journal](journal.md) holds the analysis |

## Rebuild phase

The source-first rebuild under `src/` continues until the new editor carries an application shell for the three use cases. It writes nothing into `docs/`. The switch of the GitHub Pages source, the retirement of `docs/`, the legacy tests and the cluster-specific knowledge documents wait until the new editor can also serve as derivable base. [Design](design.md), [testing](testing.md) and [project](project.md) describe the legacy editor until then.

1. Compare prototypes A, B and C under `prototypes/` in the browser and record which interaction carries into the product.
2. Build the app shell on `src/` with the three use cases, targeting [architecture](architecture.md), [specification](specification.md), [design](design.md) and `src/app/`.
3. Decide whether schema errors block Save (the open decision in the [specification](specification.md#open-decision-on-save)).

Corrections in `src/` that building the prototypes showed to be needed:

- Switch off the automatic closing of tags (`autoCloseTags` of the XML language package, enabled by default) in `xml-editor.ts`, because it breaks F.5 of the [specification](specification.md#source-fidelity).
- Add a token-based highlight style to `src/editor/`, because the default highlight style misses contrast on the secondary surface.
- Let `createXmlState` take the line separator as an argument, because a slice without its own line break cannot reveal the document's separator ([architecture](architecture.md#source-first-core-under-src)).

Observations to weigh in the comparison of step 1: B loses undo at every focus change, which violates F.7, and its slices start without their first-line indentation, while hiding the surrounding document inside one whole-document editor would keep undo. C reads well at the reading level and its click-to-caret source editing is precise, but word-level TEI becomes a wall of marks, attributes reflow lines, and every Apply re-renders the whole document. Candidates for `src/` are a well-formedness reason extractor (duplicated in A and C), the outline builder from B, the `name` and `rs` entity resolver from C and an offset-tree element summary.
