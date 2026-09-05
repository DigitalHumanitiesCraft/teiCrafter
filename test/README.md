# Tests and validation

Run commands from the repository root. The acceptance method and evidence limits belong to [knowledge/testing.md](../knowledge/testing.md); browser gestures and operator observations belong to [acceptance/BROWSER-CHECKS.md](acceptance/BROWSER-CHECKS.md).

## Required checks

Use the Node/npm versions in [package.json](../package.json) and Python with lxml 5.4.0. Install dependencies and the pinned browsers:

```bash
npm ci
npx playwright install chromium firefox
npm run verify
npm run test:e2e
```

`verify` runs required Node proofs, the Python/lxml harness and its negative self-test, the curated JavaScript typecheck, Biome, the Vite build and the deployment-asset contract. It requires the exact Node/npm versions and working native compiler/build packages. The offline type proof never downloads a compiler or substitutes a global one.

`test:e2e` builds and serves the production artifact, then runs Chromium and Firefox with CSP, keyboard, recovery, schema, output and Axe scenarios. A failed interaction is a regression to investigate; a declared missing real-object fixture is a different evidence boundary. On constrained hosts, `npm run test:e2e -- --workers=1` runs the same cases sequentially.

## Focused and optional runs

```bash
node test/run_all.mjs staged_input_check
node test/run_all.mjs persistence_coordinator_check
node test/harness/selftest.mjs
node test/harness/run.mjs
npm run verify:full-corpus
```

`node test/run_all.mjs` without a filter also includes optional corpus proofs. The SZD sweep needs the sibling Page-JSON corpus; an absent source directory can fail that broad local run. `npm run verify` explicitly excludes the SZD full sweep and port-parity gate. Do not describe a skipped or unavailable corpus as tested.

The real UFBAS browser case requires `UFBAS_TEI`; the Wenzelsbibel engine proof accepts `WB_CODEX`. Shell-specific examples are in [knowledge/testing.md](../knowledge/testing.md#running-the-gates).

## Fidelity harness

The offline harness compares a candidate with a reference. Its levels are text fidelity (L1), structural invariants (L3), and formal schema evidence (L2). Schema diagnostics may be compared before and after an intentional edit when a reference is not valid under the comparison schema. This comparative harness is separate from the browser's mandatory output schema gate.

```bash
python test/harness/validate.py --input reference.xml --candidate candidate.xml --manifest manifest.json --rng docs/schemas/tei-p5-4.11.0/tei_all.rng
```

The negative self-test deliberately corrupts fixtures so that an ineffective validator cannot silently pass. The synthetic run reports each level separately.

## Layout

| Path | Responsibility |
| --- | --- |
| [proofs/](proofs/) | Node contracts for XML, reading, mutation, input ownership, persistence, schemas and integration. |
| [e2e/](e2e/) | Built-browser workflows; app, safety and persistence scenarios. |
| [fixtures-synthetic/](fixtures-synthetic/) | Committed original synthetic TEI, schema and source-profile fixtures. |
| `fixtures/` | Ignored rights-local source material. |
| [harness/](harness/) | Node orchestration and Python/lxml validation. |
| [generators/](generators/) | Reproducible synthetic data and local corpus extraction. |
| `reports/` | Ignored generated harness output. |
| [../reports/](../reports/) | Maintained dated project assessments and implementation evidence. |

## Local Wenzelsbibel extraction

The real codex and extracted slices remain outside tracked fixtures. With a permitted local copy:

```bash
python test/generators/extract_folio.py --codex /path/to/codex-2759.xml --surfaces 1 5 40 --name codex-selected-surfaces --out test/fixtures/wb/
```

Point the harness at the extracted references and explicitly pass the vendored `--rng` path shown above; the legacy extractor manifest may name a local schema path. Its rights guard rejects tracked ONB-derived input. Use committed synthetic twins for reproducible public tests.
