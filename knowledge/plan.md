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
updated: 2026-11-05
language: en
related: [architecture, specification, testing, wenzelsbibel, derivation, views, journal, handoff, INDEX]
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

## Open defects in the base

These defects of the published editor under `docs/` are known and not yet corrected. Each is a bug fix or an accessibility repair, which the [specification](specification.md#legacy-application-as-derivable-base-2026-10-10) admits in the base.

- Double-clicking a word in the reading text selects the whole text run (`inline-editor.js`), so typing the correction replaces the line.
- Reloading or navigating back to `editor.html#example=...` loads the example again instead of offering the recovery checkpoint, which only the plain `editor.html` shows.
- The first schema-gated Download or Save shows its wait only in the status line; the button stays active and repeated clicks request several downloads.
- The XML source checks well-formedness only on Check XML or Apply, shows the browser's raw parser text, and a non-well-formed file opens with an ordinary load message; the output block then names the schema instead of well-formedness.
- Provider errors show raw response bodies, and a failed Propose (AI) always refers to the key dialog, also when a key is set.
- A model-generated draft carries its provenance at document level only, while the banner says that AI output is marked violet.
- Focus falls back to the page body after the Load menu, the New document dialog and inline editing; the LLM dialog does not keep focus inside; the context menu and the selection popover open by pointer only; the Load menu carries menu roles without arrow-key support.
- Inline edit fields and the attribute editor input have no accessible name, index row actions at rest reach only about 1.8:1 through their opacity, and the editor scrolls sideways at 320 px width.
- The Firefox browser scenarios that restore staged input after a reload fail intermittently when Playwright runs several workers and pass when run serially.

## Rebuild phase

The source-first rebuild under `src/` continues until the new editor carries an application shell for the three use cases. It writes nothing into `docs/`. The switch of the GitHub Pages source, the retirement of `docs/`, the legacy tests and the cluster-specific knowledge documents wait until the new editor can also serve as derivable base. [Design](design.md), [testing](testing.md) and [project](project.md) describe the legacy editor until then.

The comparison of prototypes A, B and C is complete. The editor is A's source view plus a hidden-markup text level on the same `EditorState`, and [views](views.md) owns the evidence, the reasons and the list of what carries over. Automatic closing tags are switched off in `src/editor/xml-editor.ts`.

1. Build the app shell on `src/` with the three use cases, targeting [architecture](architecture.md), [specification](specification.md), [design](design.md), [views](views.md) and `src/app/`. The shell takes over from prototype A, at revision `9ae6534`, the problem gutter (`problemLine`, `problemExtensions`), the proposal state and widget (`proposals`, `ProposalWidget`), `applyCanonical`, and the format and discard dialogs (`openFormatDialog`, `confirmDiscard`), and saves through `src/io/open-save.ts` so that F.8 holds. The proposal widget must not shift the editor horizontally when it scrolls. A browser check of the shell takes over the assertions of `prototypes/a-code/check.mjs` on the selection colour and line wrapping ([testing](testing.md#source-first-core-checks)).
2. Build the text level on the same state: extend `src/editor/markup-levels.ts` with the reading typography of `prototypes/c-hybrid/c-hybrid.css`, entity colours from `entityOf` in `src/core/element-facts.ts`, block layout and token spacing that keeps word-level TEI readable, and C's keyboard model (`items`, `focusItem`, `focusMarkAt`) where marks stay focusable. `caretOffset` from `prototypes/c-hybrid/c-hybrid.ts` maps a click in decoded text to a raw offset.
3. Build focus by folding: an outline beside the editor from `buildOutline` in `src/core/outline.ts` with B's tree rendering and keys (`renderTree`, `treeItem`, `moveTreeFocus`, `activate` in `prototypes/b-focus/b-focus.ts`), a focus command that folds everything outside the chosen unit (specification S.9), and B's "Go to line" link for a well-formedness error outside the visible part.
4. Make the default folds work on large documents: `foldStructure` in `src/editor/structural-fold.ts` gives the parser a 2000 ms budget that the Wenzelsbibel codex exceeds, so the folds have to follow the incremental parse.
5. Add a dark colour scheme for the editor surfaces through the design tokens.
6. Decide whether schema errors block Save (the open decision in the [specification](specification.md#open-decision-on-save)).

A correction in `src/` that building the prototypes showed to be needed: add a token-based highlight style to `src/editor/`, because the default highlight style misses contrast on the secondary surface. Prototype paths in this list refer to revision `9ae6534`, the last commit containing `prototypes/`.
