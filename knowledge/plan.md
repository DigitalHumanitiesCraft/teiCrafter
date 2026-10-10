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
updated: 2026-10-10
language: en
related: [architecture, specification, testing, wenzelsbibel, journal, handoff, INDEX]
---

# Plan

This plan orders the refactoring that makes the legacy editor under `docs/` a base from which project-specific tools are derived by Git fork, with the Wenzelsbibel specialisation moved out of the generic editor into a project folder. It runs parallel to the source-first rebuild under `src/`; the decision that the legacy app is the derivable base is recorded in [journal](journal.md).

## Target picture

- The generic editor under `docs/js/editor/` names no project. A workspace registry replaces every hard-wired reference to the Wenzelsbibel workspace.
- The Wenzelsbibel code, its project-specific styles and its Schematron live in `docs/js/projects/wenzelsbibel/` behind one entry file that exports the workspace object.
- The Wenzelsbibel manifest declares its schema set.
- The Wenzelsbibel browser suites and proofs pass with only import path changes; `node test/verify.mjs` and `npm run check:biome` are green.

## Steps

The steps run in order; each ends with the checks named in the acceptance section.

| Step | Content | Depends on |
| --- | --- | --- |
| a | Generic XML record helpers | none |
| b | Project folder with entry file | a |
| c | Workspace registry | b |
| d | Schema set in the manifest | c |
| e | Acceptance run | d |

### Step a: generic XML record helpers

`docs/js/editor/wenzels-xml.js` holds generic helpers (ID index, new IDs, attribute and text patches, child append, record removal, note reading and patching) that the witness code already uses. It becomes a generic module under a neutral name (proposed `xml-records.js`; the name is open).

Files touched: `wenzels-xml.js` (renamed), and its importers `witness-model.js`, `witness-workspace.js`, `wenzels-text-model.js`, `wenzels-register-model.js`, `wenzels-project-checks.js`. No test imports the module directly.

### Step b: project folder

Move into `docs/js/projects/wenzelsbibel/`, keeping file names so that only paths change:

| From | Note |
| --- | --- |
| `docs/js/editor/wenzels-workspace.js`, `wenzels-text-model.js`, `wenzels-image-model.js`, `wenzels-register-model.js`, `wenzels-form.js`, `wenzels-project-checks.js` | Relative imports of generic modules change to `../../editor/` |
| `docs/js/editor/wenzels-profile.js` | Becomes the entry file exporting the workspace object: detection, default schema set, panel, working-copy mode, flags (model features off) |
| `docs/css/wenzels-workspace.css` | Split first: the `ed-wb-field`, `ed-wb-form`, `ed-wb-actions`, `ed-wb-note`, `ed-wb-feedback`, `ed-wb-table` and `ed-wb-workspace` classes are also used by `entry-workspace.js`, `witness-workspace.js`, `iconclass-lookup.js` and `page-xml-onramp.js` and stay in a generic stylesheet; only the project rules move |
| `docs/schemas/wenzelsbibel-editorial.sch` | Its URL is computed in the entry file |
| `docs/data/editor/wb-codex/teicrafter.project.json` | See the open decision below |

The built-in detection profile in `docs/js/editor/project-profiles.js` (id `wenzelsbibel`, TEI types `wenzelsbibel-registers` and `wenzelsbibel-transcription`, PID pattern `^o:wen\.`, the ONB IIIF template) moves into the entry file. `iconclass-lookup.js`, `page-xml-import.js` and `page-xml-onramp.js` stay generic.

### Step c: workspace registry

A registry module in the generic editor (proposed `docs/js/editor/workspace-registry.js`) holds registered workspace objects; one registration point (proposed `docs/js/projects/index.js`) imports the installed project entry files. The registry replaces the hard-wired places:

| File | Current reference |
| --- | --- |
| `docs/js/editor/editor-app.js` | Imports of `createWenzelsWorkspace`, `isWenzelsProject`, `withWenzelsDefaults`; defaults on open; default panel; panel list entry; staged restore of mode `wenzels`; workspace creation; model features switched off |
| `docs/js/editor/project-manifest.js` | `workspace` must equal `"wenzelsbibel"`; becomes a check against registered names |
| `docs/js/editor/working-copy.js` | Staged mode list and the `wenzels` value check; modes come from the registry |
| `docs/js/editor/project-output-controller.js` | Import and calls of `withWenzelsDefaults` |
| `docs/js/editor/page-xml-onramp.js` | TEI type `wenzelsbibel-transcription` of the draft; becomes a parameter supplied by the workspace |
| `docs/js/editor/project-profiles.js` | Built-in detection; `detectProject` consults registered workspaces |
| `docs/editor.html` | Stylesheet link `css/wenzels-workspace.css`; the workspace supplies its stylesheet or the link points to the moved file |

### Step d: schema set in the manifest

The manifest parser already reads the `schema` field (`schemaDef` in `project-manifest.js`). The Wenzelsbibel manifest declares TEI All RelaxNG and the editorial Schematron; the code default `withWenzelsDefaults` in `wenzels-profile.js` is removed.

A user-granted project folder resolves schema paths only inside that folder (`project-path.js`), so a manifest cannot point to a schema shipped with the application. A Wenzelsbibel file opened without a manifest, or from a folder without schema files, then still needs the workspace's default schema set from step b, applied by the registry when a project declares no schema. Whether this preserves the current behaviour exactly, and how a served example manifest references the moved Schematron through `schemaBaseUrl`, must be checked in this step.

### Step e: acceptance

The six browser suites `test/e2e/wenzelsbibel-import.spec.js`, `wenzelsbibel-project.spec.js`, `wenzelsbibel-references.spec.js`, `wenzelsbibel-register-protection.spec.js`, `wenzelsbibel-schema.spec.js`, `wenzelsbibel-workspace.spec.js` and the Wenzelsbibel proofs pass with only import path changes. `node test/verify.mjs` is green and `npm run check:biome` is clean.

The Wenzelsbibel proofs in `test/proofs/` are `wenzels_image_model_check.mjs`, `wenzels_note_projection_check.mjs`, `wenzels_project_controls_check.mjs`, `wenzels_register_deletion_check.mjs` and `wenzels_text_model_check.mjs`. Further files refer to the specialisation and are part of the acceptance: `test/e2e/project-transition-safety.spec.js` imports the register model; `test/proofs/project_manifest_check.mjs` reads the Wenzelsbibel manifest; `wb_codex_check.mjs`, `project_documents_check.mjs`, `project_output_controller_check.mjs` and `page_xml_import_check.mjs` rely on detection, the workspace name or the draft TEI type. `wenzels_project_controls_check.mjs` asserts the behaviour of `withWenzelsDefaults`; when step d removes that function, those assertions move to the workspace default schema set, which is more than an import path change and has to be named in the journal entry.

## Not touched

Witness management, the entry workspace, the SZD mapping view, `src/` and `prototypes/`. Their only change is the import path of the renamed XML helpers in the two witness modules.

## Relation to the source-first rebuild

The rebuild under `src/` continues as a parallel line until it carries an application shell; the open rebuild steps in [handoff](handoff.md) stay valid except for retiring `docs/`, which the decision of 2026-10-10 suspends. This refactor writes nothing into `src/`.

## Status tracker

| Step | Status | Notes |
| --- | --- | --- |
| a | pending | |
| b | pending | |
| c | pending | |
| d | pending | |
| e | pending | |

Legend: completed, in progress, pending.

## Open decisions and dependencies

| Decision | Needed before | Recommendation |
| --- | --- | --- |
| Location of the Wenzelsbibel manifest: project folder, or remain at `docs/data/editor/wb-codex/` where the local example loader (`editor-app.js`) and `project_manifest_check.mjs` read it next to the local codex | Step b | Keep it in `docs/data/editor/wb-codex/`, since it is project data describing a folder, not code |
| Name of the generic XML helper module | Step a | `xml-records.js` |
| Whether the bottom inspector (forms from a field table) and the register autocomplete built for the wenzelsbibel-teiCrafter fork become generic base components | After step e; does not block the refactor | Generic base components, project field tables and labels stay in the fork |
| Phase selection for a Schematron entry in the schema set, replacing the rewrite of `defaultPhase` in the workspace's review action | After step e | Add as a generic schema-set option |

The fork wenzelsbibel-teiCrafter merges this refactor after step e; its own plan depends on it.
