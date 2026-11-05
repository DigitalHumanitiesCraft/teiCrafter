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

## Operator decisions from the workshop audit

Each question can be answered with yes or no. The recommendation is the yes; the reasons and the evidence follow it.

| Question | Yes (recommended) | No | Evidence |
| --- | --- | --- | --- |
| Pause the source-first rebuild and develop the legacy application as the product until the derivation questions are settled? | `docs/` stays the published editor and the derivable base; `src/` stays a tested core library without a shell. Costs: two code bases remain, and the legacy editor keeps its size. Risks: `src/` ages without users. | Continue the rebuild steps below. Costs: an application shell, the text level, the outline, large-document folds and a dark scheme, and then every legacy surface the new editor must take over or drop deliberately (registers, metadata forms, project folder, working copy, project package, entries, witnesses, the Wenzelsbibel workspace). Risks: the fork and the public site wait on it. | No interface exists in `src/` ([architecture](architecture.md#source-first-core-under-src)); the published site serves `docs/` ([integration](integration.md#browser-files-and-deployment)); the fork depends on the base's shell and the standalone case built a small editor without either ([derivation](derivation.md#case-register)); the audit corrections in `docs/` took hours, not a rebuild |
| Keep Save and Download bound to a valid schema result (fail-closed) in the legacy editor? | Invalid XML never leaves the editor through Save; Working copy keeps unfinished work. | Save always and show the state, with one confirmation, as the SZD derivation does. | Specification [open decision on Save](specification.md#open-decision-on-save); the audit found the gate working and explained; the SZD case's ADR-008 ([derivation](derivation.md#teicrafter-szd-standalone-editor)) |
| Present teiCrafter in the workshop as an editor to try and as a model for one's own tool, rather than as a fork template? | The site text names the editor and the three routes the README describes. | Keep "template to fork" and write a step-by-step fork guide first. | Only one public derivation exists and its interface is not built; the README section "Derive an editor for your edition"; the site text lives outside this repository |
| Make szd-teiCrafter public? | The workshop gets a working, freely licensed derivation to look at, and the gallery can link it. | It stays private and the gallery describes it without a link. | Its letters are freely licensed and its code follows the MIT default; `docs/data/derivations.json` has no URL for it |
| Accept a Node and npm version range in `npm run verify`, keeping the exact pin only for `npm run evaluate:editorial` and CI? | Contributors and forks can run the gate with any Node 24 release. | Every gate keeps the exact pin. | `test/verify.mjs` refuses any version but 24.13.0 and 11.6.2; every gate step passed under Node 24.20.0 in the audit run |
| Keep the model features on by default on the public site? | Without a key nothing is sent, and the dialog says that a key is needed. | The public build hides them until a user switches them on. | `FEATURES.llmOnRamp` and the per-user setting in `docs/js/utils/constants.js`; the audit found no request without a key |
| Change the generated-draft banner to say that the whole document is model-generated, instead of marking each element violet? | The banner is accurate for the document-level provenance the file records. | Record and mark provenance per element. | `generated-provenance.js` writes `resp="#ai"` on the root only; the banner says that AI output is marked violet |
| Keep resolving staged metadata input on output while unparseable XML source blocks it? | The output transaction applies staged input that applies cleanly, as [architecture](architecture.md#output-and-file-operations) states. | Every staged input needs an explicit Apply before output. | The audit saw a staged title enter the download and a broken XML edit block it |
| Leave the legacy editor light until the rebuild decision, rather than opting it into the dark scheme now? | No second token review for surfaces that may be replaced. | Check every editor surface in the dark scheme and opt the editor in. | Only the start page opts in ([design](design.md#public-start-page)); the contrast proof covers dark muted text only |

## Open defects in the base

These defects of the published editor under `docs/` are known and not yet corrected. Each is a bug fix or an accessibility repair, which the [specification](specification.md#legacy-application-as-derivable-base-2026-10-10) admits in the base.

- Annotating a selection needs a pointer: keyboard selection inside a reading line selects nothing, so the annotate popover cannot open from the keyboard.
- An authority id is stored as typed; a value that is not a GND number is accepted as a GND id.
- Metadata labels show raw element names such as `title` or `p` beside the named fields, and the annotate popover clips its rows.
- At 800 by 600 pixels the facsimile pane stacks under the reading pane and leaves about three lines of text.
- The Firefox browser scenarios that restore staged input after a reload fail intermittently, under several workers and also in serial runs. After a failed reload the empty editor lists no checkpoint, so the record written before the reload is missing then; whether the write is still queued at unload or later removed is not established. The failures appeared at revision `ad9eccf` already and more often after the second audit round in repeated serial runs.

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
