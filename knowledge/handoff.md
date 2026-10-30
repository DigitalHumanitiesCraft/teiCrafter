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
- Context: A second derivation was built on a freely licensed Stefan Zweig Digital letter as a small, build-free editor rather than a clone of this repository, because the audit of 2026-10-30 found the base still coupled to Wenzelsbibel, ZBZ and SZD code (CSS link in `docs/editor.html`, `docs/js/projects/index.js`, a generic e2e spec importing from `projects/wenzelsbibel/`). Its cut is one source configuration (`js/source.js`) holding the IIIF manifest rule, the element suggestions and the annotation markup, while generic modules handle editor, TEI facts, IIIF resolution, viewer, validation and GND search. The cut held through three operator iterations. It is evidence for a derivation contract in which a derivation adds a configuration and touches no base file, which the current registry does not yet reach. The operator stated Git as the backend for partners, editor and research data in one repository, saving in place through the File System Access API, exchange by commit and push.
- Evidence: `szd-teiCrafter/test/browser-check.mjs`, all checks passing on 2026-10-30.
- Operator point: decide whether derivations stay build-free with vendored bundles or derive from the Vite stack under `src/`. The SZD editor keeps both open, since moving its CodeMirror configuration to npm imports changes import paths only.

### Technical findings from the SZD derivation

- Received: 2026-10-30
- Source: `szd-teiCrafter/knowledge/journal.md` (entries of 2026-10-30) and `szd-teiCrafter/js/editor.js`, `js/iiif.js`, `js/gnd.js`, `.gitattributes`.
- Target: [architecture.md](architecture.md), [testing.md](testing.md), and the CodeMirror integration wherever the base builds it.
- Context: Five findings that apply to the base. CodeMirror 6 injects its base styles unlayered, so they override application CSS in cascade layers, so editor colours belong in an `EditorView.theme` that consumes the design tokens. `doc.toString()` always joins lines with LF, while `state.sliceDoc()` honours `EditorState.lineSeparator`. With the separator taken from the opened file, a CRLF file is saved byte-identical, which the base's byte-fidelity rule needs. A save confirmation can be overwritten by a debounced check that fires after it, so saving runs the pending check first. GAMS serves a IIIF Presentation 2 manifest per object at `https://gams.uni-graz.at/{pid}/sdef:IIIF/getManifest` with Image API level 2 services and permissive CORS, a stronger facsimile route for SZD than the plain `IMG.n` URLs. lobid-gnd ranks a surname-only query poorly for historical persons, so a person search should combine the selection with context such as the letter date, and persons without a GND record need a project register.
- Evidence: CRLF round trip and save confirmation in `szd-teiCrafter/test/browser-check.mjs`.
