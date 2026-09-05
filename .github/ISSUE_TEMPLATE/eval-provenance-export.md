---
name: "Evaluation hook: provenance export"
about: Export the production, decision and verification layers per encoding
title: "[antrag-eval] Provenance export for <scope>"
labels: antrag-eval
---

## What this issue is for

The document carries responsibility in TEI's own terms: `@resp="#ai"` on a proposed construct and the `respStmt` in the header. Confirmation retains that origin and records acceptance separately. This hook asks for one export that carries all three layers per encoding:

- **production** â€” how the encoding was produced (a deterministic editor operation, the deterministic plaintext ingest, or a model proposal), including model and prompt identity where a model produced it
- **decision** â€” which step put the encoding into the document (the engine splice that applied it, a confirm, a reject with its inverse unwrap)
- **verification** â€” what checked it and how (well-formedness and schema checks, the round-trip proof, human confirmation), keeping machine and human checks distinguishable

Criterion-independent: the export describes the layers, it derives no quality measure from them.

Saved TEI already preserves accepted origin. The proposed export would add a fuller production, decision and verification history, including information not represented by the current responsibility and acceptance tokens. This export is a requested evaluation feature, not an existing capability.

## Artefacts this touches

- `docs/js/editor/standoff.js` â€” `AI_RESP` and `ensureRespStmt`, the header responsibility statement
- `docs/js/editor/proposal-review.js` â€” confirmation and rejection; `proposal-provenance.js` defines retained origin and acceptance
- `docs/js/editor/tei-document.js` â€” `spliceDocument` and the raw string that stays canonical
- `docs/js/editor/validation-view.js` â€” the checks reported against the open document
- `knowledge/architecture.md`, `knowledge/data.md` â€” the reading contract and the formats the editor consumes

## Open before implementation

- Whether the export is a sidecar graph or a flat per-construct record
- Which terms come from PROV-O and EARL before anything new is minted
- Which additional fields belong in the sidecar and how project schemas consume the existing TEI provenance trace
