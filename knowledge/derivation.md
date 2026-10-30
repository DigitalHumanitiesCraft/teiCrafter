---
title: "Integration: derived project versions"
project:
  name: teiCrafter
  repository: https://github.com/DigitalHumanitiesCraft/teiCrafter
method:
  name: Promptotyping
  url: https://lisa.gerda-henkel-stiftung.de/digitale_geschichte_pollin
template:
  name: Vorlage Integration
  version: 0.1
  url: https://dhcraft.org/Promptotyping/promptotyping-document/integration
status: complete
created: 2026-10-30
updated: 2026-10-30
language: en
topics: ["[[TEI XML]]", "[[Promptotyping]]"]
related: [integration, architecture, specification, plan, wenzelsbibel, journal, handoff]
---

# Derived project versions

A derivation is an editor for one edition that is built from teiCrafter and kept in its own repository. This document holds the derivation contract, the coupling the base still carries, the traps observed so far and a register of the observed cases. The register records observations. The contract states only what the registered cases support, because the operator's approach of 2026-10-30 is to observe a few cases, discuss them and generalise from them to improve the base, not to fix a derivation rule in advance.

## Overview

```text
teiCrafter base
  docs/  legacy application, the derivable base
  src/   source-first core, rebuilt beside it
     |                                   |
     | git merge upstream/main           | vendored runtime, TEI All schema
     | (whole repository)                | and recorded lessons, no shared files
     v                                   v
wenzelsbibel-teiCrafter              szd-teiCrafter
fork with upstream merge             standalone editor, one source configuration
     |                                   |
     +---- findings as items in this repository's knowledge/handoff.md ----> base
```

## Forms of derivation

Two forms are observed. Each is described by its case in the [register](#case-register).

### Fork with upstream merge

The derivation is a Git fork of this repository that keeps teiCrafter as its `upstream` remote and takes base changes with `git fetch upstream` and `git merge upstream/main`. The generic editor under `docs/js/editor/`, the manifest contract, the schema runtime and the design tokens stay as merged, so every base improvement arrives through an ordinary merge. A change the derivation needs in a generic module goes to the base first and returns by merge. A fork changes three zones.

| Zone | Content | Merge behaviour |
| --- | --- | --- |
| Shell pages | `docs/index.html` and `docs/editor.html` | Conflicts are resolved for the derivation, then base changes such as new script or stylesheet links are carried over |
| Project folder | `docs/js/projects/<id>/` with the entry file `index.js` that exports the workspace object, its registration in `docs/js/projects/index.js`, a stylesheet linked from `editor.html` and project Schematron under `docs/schemas/` whose URL the entry file computes | Conflicts stay local to the project folder and the registration list |
| Files only the derivation writes | Its own knowledge base, editorial rules, fixtures and further components | No conflicts, because the base never writes them |

[Architecture](architecture.md#project-workspaces) holds the module map and the workspace fields the registry reads.

### Standalone editor with one source configuration

The derivation is a separate repository with its own small set of modules, written after the base's design and its recorded lessons rather than copied from `docs/js/editor/`. All edition-specific knowledge sits in one source configuration file, and the generic modules of the derivation know no edition. Nothing is merged from the base. What the derivation takes over are vendored libraries, the pinned TEI All schema and rules such as byte fidelity, and findings travel in both directions as handoff items.

## Invariants both cases hold

These hold in both registered cases and are the contract a derivation is currently held to.

- The raw XML string is canonical, and saving keeps every byte outside deliberate edits, including the line endings of the opened file ([specification](specification.md#source-fidelity)).
- Text leaves a CodeMirror editor through `state.sliceDoc()` and never through `doc.toString()`, wherever a derivation edits through CodeMirror ([architecture](architecture.md#source-first-core-under-src)).
- The editor runs in the browser without a backend, without a runtime CDN and without an API key in the client. Network calls go to the image service of the opened document and, on the user's request, to authority or model services.
- Schema validation runs locally with libxml2-wasm against the pinned TEI P5 4.11.0 TEI All RelaxNG of the base.
- Edition specifics stay out of the generic modules. In the fork they live in the project folder behind the workspace registry, in the standalone editor in the source configuration.
- Research data whose licence does not permit redistribution stays out of the repository.
- A generic finding goes to the base as a handoff item, and a generic mechanism is built in the base.

The save gate, the build regime and the interface language are not invariants, because the two cases differ on them (see the [register](#case-register) and the [open questions](#open-questions-for-generalisation)).

## Base coupling a derivation meets

The registry routes workspace code to the generic editor, but the generic code of the base still carries project-specific parts. This is the one list of that coupling.

| Location | Project | Kind | Effect on a derivation |
| --- | --- | --- | --- |
| `docs/editor.html` links `js/projects/wenzelsbibel/wenzels-workspace.css` | Wenzelsbibel | Shell page | A fork for another edition edits a shell page to drop or replace the link, which a later base change to that page turns into a conflict |
| `docs/js/projects/index.js` imports the Wenzelsbibel entry file | Wenzelsbibel | Registration list | The designed registration point. A fork edits it, so a derivation cannot avoid touching one base file |
| `docs/js/editor/editor-app.js`, `ZBZ_URL`, `ZBZ_IMAGE_BASE`, `ZBZ_SYNTH_URL`, `SZD_URL` and `BUILTIN_EXAMPLES` | ZBZ Jeanne Hersch, Stefan Zweig Digital | Built-in examples in the generic editor | Shown only on local development hosts, but outside the workspace `examples` field that registered workspaces use |
| `docs/js/editor/editor-app.js`, the `#szd-import=` deep link, and `docs/js/editor/document-facts.js`, the `szd-mapping` draft kind | Stefan Zweig Digital | Local mapping draft handoff into the generic editor | The SZD mapping view (`docs/szd-mapping.html`, `docs/js/szd-mapping*.js`) reaches the generic editor through code that names it |
| `docs/js/editor/project-profiles.js`, the built-in `zbz-hersch` profile | ZBZ Jeanne Hersch | Detection | Detected before registered workspace profiles |
| `docs/js/editor/inline-gnd.js` | ZBZ Jeanne Hersch | Interchange shape `inline-gnd` | Selected by the manifest's `interchange` field, written for the ZBZ pipeline |
| `test/e2e/project-transition-safety.spec.js` imports `createWenzelsRegistersDocument` and drives the Wenzelsbibel workspace control | Wenzelsbibel | Generic browser test | The generic browser tests do not run without the Wenzelsbibel project folder |

Comments in `tei-document.js`, `page-images.js`, `entity-index.js`, `edition.js`, `facsimile.js` and `project-manifest.js` name projects as examples. They carry no behaviour and are not coupling. The contract the standalone case points to, a derivation that adds a configuration and touches no base file, is not reached by the current registry, because the shell link and the registration list still require edits to base files.

## Integration traps

- A project stylesheet added at runtime is refused. The build inlines a small stylesheet as a `data:` URL, which the editor's `style-src` policy blocks, so `editor.html` links it.
- A fork that replaces the inherited `knowledge/` folder with its own receives a modify/delete conflict whenever a merge touches a base knowledge file, and keeps the deletion.
- CodeMirror counts a CRLF as one position and `doc.toString()` joins lines with LF, so offsets and saved text pass through the line-separator translation ([architecture](architecture.md#source-first-core-under-src)).
- Git text normalisation of research data rewrites a partner's CRLF file on commit although nobody edited it. The standalone case exempts its data from line-ending conversion.
- CodeMirror's base styles sit outside the cascade layers, so editor colours belong in an `EditorView.theme` on the design tokens ([design](design.md#visual-identity-and-tokens)).
- A debounced check that fires after a save can overwrite the save confirmation, so saving runs the pending check first ([testing](testing.md#state-transition-regressions)).
- The fork publishes `docs/` directly, while the base tests and deploys the Vite build in `dist/`, so the tested form and the published form of the fork differ by bundling.
- A surname-only GND query ranks the intended person low, so a project person register comes first where one exists ([integration](integration.md)).

## Checks each derivation runs

Both cases check that a saved file differs from the opened one only by the deliberate edits. The fork runs the inherited base gate `node test/verify.mjs` and its own `npm run check:fork`, whose steps its `package.json` defines. The standalone case runs its browser check `test/browser-check.mjs`, which compares the saved file with the original and includes a CRLF round trip. Each case's testing document owns the full list.

## Case register

The start page's gallery Editions built on teiCrafter renders `docs/data/derivations.json`, one entry per case below plus the base, each pointing with `caseAnchor` to its heading in this document. The [derivations proof](../test/proofs/derivations_check.mjs) fails when an anchor, a licence notice or a public URL there no longer matches, so a new or renamed case is entered in both places.

### Wenzelsbibel, fork

- Repository: [wenzelsbibel-teiCrafter](https://github.com/DigitalHumanitiesCraft/wenzelsbibel-teiCrafter), derived on 2026-10-10 with `upstream` pointing at this repository.
- Taken over: the whole repository, including the generic editor, the workspace registry, the manifest contract, the schema runtime, the design tokens, `src/`, the pipeline and the build and test configuration. Base knowledge is read in the base and not copied.
- Own zones: its knowledge base in place of the base's, the editorial layer with the project Schematron, the vocabulary and fixtures, the content of `docs/js/projects/wenzelsbibel/`, a wireframe, the flow-view spike `prototypes/d-flow/`, and its own check script, Playwright configuration and workflow.
- Departures from the base: German interface labels; model proposals permanently off through the workspace flag `modelFeatures: false`; register links set inline on the words, proposed to the edition team as `rs[@type][@ref]`, instead of stand-off spans ([Wenzelsbibel](wenzelsbibel.md)); publication of `docs/` from `main:/docs` without the base's build. The schema-gated save is kept, and the fork names it among the base invariants it inherits.
- Why: the edition team decides data model and acceptance, and its handbook outranks the base's conventions for what an encoding means. Building every generic mechanism in the base keeps the fork mergeable, so the fork lists the mechanisms it needs from the base instead of building them itself.
- Observations: the fork depends on base progress for its new shell, because each generic mechanism it needs is base work. Its architecture first stated that no project trace remained in the generic editor and has since pointed to the [coupling list](#base-coupling-a-derivation-meets) instead. Its plan to vendor a CodeMirror bundle built from `src/` into `docs/` conflicts with the base plan's rule that the rebuild writes nothing into `docs/`.
- Source of truth: its `knowledge/architecture.md` (derivation model and zones) and `knowledge/integration.md` (exchange with the base).

### teiCrafter SZD, standalone editor

- Repository: `szd-teiCrafter`, local, without a remote at the time of registration, started on 2026-10-30 on a freely licensed Stefan Zweig Digital letter.
- Taken over: libxml2-wasm 0.7.1 and the TEI P5 4.11.0 `tei_all.rng`, byte-identical to the base's copy; CodeMirror 6, bundled once with esbuild into a vendored module; OpenSeadragon; the byte-fidelity rule and the lessons on `sliceDoc`, editor theming and the pending check before save. No module of `docs/js/editor/` or `src/` is copied. Its modules for editor, TEI facts, IIIF resolution, viewer, validation, split, person register and GND search are its own, and `js/source.js` holds the IIIF manifest rule, the element suggestions, the HTR marker actions and the person index with its reference forms (ADR-002, ADR-003).
- Departures from the base: saving is always possible and the document state is to be shown instead of the fail-closed save gate (ADR-008); the state display is planned in its milestone S2, while the unsaved-work mark and the check results already show. Auto-closing tags are on, which contradicts the base requirement that typing inserts exactly the typed characters ([specification](specification.md#source-fidelity), F.5), and the derivation keeps this as an open decision. There is no build step (ADR-001). Validation runs on the main thread rather than in a worker. The interface is German. Editor and research data live in one Git repository that serves as the backend for the team (ADR-004). The working state is to live in `revisionDesc/@status` (ADR-011) and persons point to the Stefan Zweig Digital person index with the GND as fallback (ADR-007).
- Why: project partners should run and host the editor without a toolchain; interrupted work belongs in the repository, where Git keeps it, and visibility rather than a gate keeps unfinished and finished files apart (operator, 2026-10-30); one source configuration per edition is meant to let another edition derive its editor by replacing one file (ADR-002, ADR-009).
- Observations: the edition specifics, including the person index added later, stayed confined to the source configuration through the operator's review rounds of 2026-10-30. The case shows that a useful edition editor can be built from a small set of modules without the base's projection and workspace clusters.
- Source of truth: its `knowledge/specification.md`, ADR-001 to ADR-011, and its `knowledge/plan.md`, milestone S6 and the open decisions.

## Open questions for generalisation

Two cases support no rule on the following points. Each remains open until further cases or an operator decision settle it.

- Module library or forkable application. The fork derives from the whole application, the standalone case from a small module set it wants to move into the base. Whether the base should offer generic modules that a derivation imports, remain an application that derivations fork, or offer both, is open.
- Build-free or Vite. Both derivations are served without a build step, while the base builds with Vite and tests the bundle. Whether derivations stay build-free with vendored bundles or move to the Vite stack is open, and the standalone case keeps both paths open (its ADR-003).
- Save gate. The base's legacy application and the fork save only valid output, the standalone case always saves and shows the state, and the [specification](specification.md#open-decision-on-save) keeps the question open for the source-first editor. Whether the gate is a base invariant or a derivation choice is open.
- Typing fidelity. Whether auto-closing tags are acceptable in a derivation, given the base requirement F.5.
- Vendored bundles from `src/` in `docs/`. Whether the base's rule that the rebuild writes nothing into `docs/` admits a vendored bundle a derivation needs.
- A derivation that touches no base file. What the registry and the shell would have to offer so that a fork adds only a configuration, which the [coupling list](#base-coupling-a-derivation-meets) shows is not yet reached.

## Sources of truth

| Aspect | Base | Wenzelsbibel fork | SZD standalone |
| --- | --- | --- | --- |
| Derivation contract and case register | this document | `knowledge/architecture.md`, derivation model | `knowledge/plan.md`, milestone S6 |
| Workspace fields and module map | [architecture](architecture.md#project-workspaces) | `knowledge/architecture.md`, components | `knowledge/specification.md`, ADR-002 |
| Invariants of source fidelity | [specification](specification.md#source-fidelity) and the base's [specification at revision 6d720a6](https://github.com/DigitalHumanitiesCraft/teiCrafter/blob/6d720a632e5ad307e98d7eae536b3d7e8a981bbd/knowledge/specification.md) | `CLAUDE.md`, truth hierarchy | `knowledge/specification.md`, NFR-03 and ADR-004 |
| Departures | the case register above | `knowledge/integration.md` and `knowledge/editorial-guidelines.md` | `knowledge/specification.md`, ADR-001, ADR-007, ADR-008, ADR-011 |
