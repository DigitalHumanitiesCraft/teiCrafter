---
title: Curated Example Set (M7.4)
project:
  name: teiCrafter
  repository: https://github.com/DigitalHumanitiesCraft/teiCrafter
method:
  name: Promptotyping
  url: https://lisa.gerda-henkel-stiftung.de/digitale_geschichte_pollin
template:
  name: Vorlage Specification
  version: 0.1
status: active
created: 2026-06-09
updated: 2026-06-09
language: en
version: 0.10
topics: ["[[Editopia]]", "[[Curation]]", "[[Evaluation]]"]
related: [goals, paper-evidence, worked-example-zbz, worked-example-szd, testing]
---

# Curated Example Set (M7.4)

The paper's empirical partial result (operator decision 2026-06-09): persisted
before/after pairs of fully curated TEIs from both pipelines, each pair with a
unified diff and a per-object step log. The set is the on-disk demonstration of
the success criterion in [goals.md](goals.md) (Frame): from the unverified
pipeline TEI of a real object, curation in teiCrafter produces a demonstrably
better TEI while preserving the pipeline output byte-exactly outside the
touched regions.

## 1. How the set is produced

One deterministic command regenerates the whole set:

```
node test/tools/make_curated_set.mjs
```

The script holds a registry of objects. Each enabled entry resolves its source
(the unchanged pipeline TEI), applies its curation recipe through the real
engine (`edition.js`, `standoff.js`, `criticism.js`; every edit an offset
splice), verifies the pair, and persists four artifacts under
`output/curated-set/<id>/`:

| Artifact | Content |
|----------|---------|
| `before.xml` | the untouched pipeline TEI |
| `after.xml` | the curated TEI |
| `diff.patch` | unified diff, 3 context lines (line counts cross-checked against `git diff --no-index --stat`) |
| `summary.md` | the step log plus the verification results |

plus `output/curated-set/SET.md`, the set overview table. Per-object
verification: the before round-trips byte-identically, the after is idempotent
and still builds the same folio model, a `<standOff>` exists, and the step log
is non-empty. Exit 0 only if every enabled object generates and verifies.

The recipes are the exact curation arcs proven by the worked-example tests
(`zbz_worked_example.mjs`, `szd_worked_example.mjs`); the worked examples prove
each splice surgical, the set generator persists the resulting pairs. Authority
identifiers follow the standing honesty rule: only identifiers resolved against
the authority itself are written; all other entities are added without an
authority on purpose, to be resolved via the live lookup (M3.3).

## 2. The set

| Object | Pipeline | Status (2026-06-09) | Curation steps | Engine splices | Diff lines | Rights |
|--------|----------|---------------------|----------------|----------------|-----------|--------|
| zbz-1000 | zbz-ocr-tei | generated and verified | 8 | 11 | +17/-5 | local-only pending the ZBZ rights answer |
| o_szd.1079 | szd-htr | generated and verified | 9 | 12 | +18/-5 | CC-BY, redistributable |
| zbz-1540 | zbz-ocr-tei | proposed, awaits operator sign-off | | | | local-only pending the ZBZ rights answer |
| 2 or 3 SZD prompt-group objects | szd-htr | proposed, awaits operator sign-off | | | | GAMS, CC-BY |

"Curation steps" counts the human-visible actions in the step log (an entity
add bundles its authority assignments); "engine splices" counts the distinct
byte-level edits as reported by the corresponding worked-example proof. Both
figures are registered in [paper-evidence.md](paper-evidence.md) section 3.

What each generated pair contains, per the recipes:

1. One reading correction of a documented recognition defect (ZBZ: the OCR form
   "inadaption" to "inadaptation"; SZD: the HTR form "Gerichte" to "Gedichte").
2. The entity triad (person / place / work) in a `<standOff>` that did not
   exist before, with resolved authority identifiers where genuinely known
   (Hersch GND 118815679; Geneve Wikidata Q71, GeoNames 7285902; Zweig GND
   118637495; Wien GeoNames 2761369, Wikidata Q1741) and deliberately
   authority-free entries otherwise.
3. One mention link (`<name ref="#id">`) tying a reading line to its entity.
4. Explicit editorial confidence on two defects: an `<unclear>` wrap and a
   `<gap/>` replacement, instead of silent text or silent deletion.

## 3. Rights and persistence

`output/` is gitignored, so the generated pairs never enter version control.
This honors the documented Hersch rights stance (zbz-100 precedent: public on
the zbz Pages is not redistributable): ZBZ pairs stay local-only until ZBZ
confirms redistributability of the demo documents. The set remains fully
reproducible because the generator is deterministic and committed; the ZBZ
source materializes via `make_zbz1000_demo.mjs` from the zbz sibling checkout,
and the generator SKIPs (does not fail) when a rights-encumbered source is
absent.

## 4. Schema validity of the curated additions

Against the ZBZ schema `zbz_hersch.rng` (finding 2026-06-09, see
[goals.md](goals.md) M7.4): `graphic`, the line correction, `unclear` and `gap`
validate; `<standOff>` and `<name ref>` do not and need the schema extension
ordered to the zbz lane (E68 precedent). The set's generation does not wait on
that extension; full ZBZ schema validity of the after-files does.

## 5. Open

- Operator sign-off of the proposed object list (zbz-1540 plus the SZD
  prompt-group objects), then recipes for the approved objects.
- Operator browser approval per generated object (the set is engine-proven,
  the browser pass is the operator's).
- The ZBZ rights answer, which decides whether ZBZ pairs may be committed or
  shipped with the paper's data publication.
