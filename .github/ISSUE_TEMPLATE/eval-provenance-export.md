---
name: "Evaluation hook: provenance export"
about: Export the production, decision and verification layers per encoding
title: "[antrag-eval] Provenance export for <scope>"
labels: antrag-eval
---

## What this issue is for

The document carries responsibility in TEI's own terms: `@resp="#ai"` on an unverified construct, the `respStmt` in the header, and the dropped marker once a human confirms. This hook asks for one export that carries all three layers per encoding:

- **production** — how the encoding was produced (a deterministic editor operation, the deterministic plaintext ingest, or a model proposal), including model and prompt identity where a model produced it
- **decision** — which step put the encoding into the document (the engine splice that applied it, a confirm, a reject with its inverse unwrap)
- **verification** — what checked it and how (well-formedness and schema checks, the round-trip proof, human confirmation), keeping machine and human checks distinguishable

Criterion-independent: the export describes the layers, it derives no quality measure from them.

A confirm drops the `@resp` marker by design, so the saved document alone stops carrying the fact that a construct was once AI-proposed. The export is where that history has to survive.

## Artefacts this touches

- `docs/js/editor/standoff.js` — `AI_RESP` and `ensureRespStmt`, the header responsibility statement
- `docs/js/editor/proposal-review.js` — the confirm that drops the marker
- `docs/js/editor/tei-document.js` — `spliceDocument` and the raw string that stays canonical
- `docs/js/editor/validation-view.js` — the checks reported against the open document
- `knowledge/architecture.md`, `knowledge/data.md` — the reading contract and the formats the editor consumes

## Open before implementation

- Whether the export is a sidecar graph or a flat per-construct record
- Which terms come from PROV-O and EARL before anything new is minted
- Whether a confirmed construct should keep a durable trace inside the TEI or only in the sidecar
