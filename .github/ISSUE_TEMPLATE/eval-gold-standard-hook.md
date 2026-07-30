---
name: "Evaluation hook: gold-standard hook"
about: Attach reference encodings with a required checking depth per item class
title: "[antrag-eval] Gold-standard hook for <item class>"
labels: antrag-eval
---

## What this issue is for

A reference here is an encoded passage an editor holds as correct. This hook asks for the attachment point that lets a reference encoding be bound to a passage together with the checking depth that item class requires, fixed in advance rather than chosen per case:

- the reference encoding per passage, with its source (published edition, the project's encoding guideline, an authority record for a reconciled mention)
- the item class it belongs to (entity mention, structural markup, textual-critical construct, editorial note, authority link, and so on)
- the required checking depth for that class, declared before the checking starts

Criterion-independent: the hook stores reference and required depth, it computes no agreement figure.

## Artefacts this touches

- `test/proofs/`, `test/fixtures-synthetic/` — the headless proofs and the fixtures they read
- `docs/data/editor/` — the committed project fixtures a reference would attach to
- `docs/js/editor/project-manifest.js` — the manifest that already declares the allowed markup per document type
- `knowledge/testing.md` — the acceptance method and the harness levels
- `knowledge/data.md` — the TEI the engine is proven against

## Open before implementation

- Whether the reference lives with the fixtures, with the project manifest, or in its own file
- How a reference is compared when several TEI encodings of the same passage are equally correct under the project's guideline
