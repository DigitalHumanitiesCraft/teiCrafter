# teiCrafter

A browser editor for creating, reading and editing TEI XML with exact source preservation.

[Open the published editor](https://digitalhumanitiescraft.github.io/teiCrafter/) | [Start with the workflows](knowledge/worked-examples.md) | [Project knowledge](knowledge/INDEX.md)

**Research preview.** The working implementation targets **0.2.0**; package metadata remains **0.1.0**. The published site may differ from this repository revision. The [current implementation and verification report](reports/refactoring-status-2026-09-05.md) records completed work and remaining acceptance. The [session checkpoint](reports/session-close-2026-09-05.md) provides the next task and re-entry commands. The [0.2.0 plan](reports/implementation-plan-0.2.0.md) describes the broader target.

## What editors can do

| Task | Current route |
| --- | --- |
| Turn a transcription into TEI | Load... > New document...; choose a transcription, letter, charter, legal-source, dictionary-entry or encyclopedia-article starter and supply the known facts. |
| Edit an existing TEI document | Open or drop a UTF-8 XML file. Use Reading text, XML source and Metadata; the source remains canonical. |
| Create thirty lexicon entries | Use the dictionary or encyclopedia starter. Each blank-line-separated block becomes one unit; its first line is the headword or heading. Entry management and batch editing in existing documents remain planned. |
| Read and inspect TEI | Choose Read only. Navigation, source inspection and copying remain available while source mutations are blocked. |
| Work on historical-source metadata and indices | Inspect the complete header, edit safe fields, open structured content as exact XML, and manage supported register entities and their references. |
| Compare text with a facsimile | Open encoded image references or attach a local image folder where the browser provides that capability. |
| Preserve unfinished work | Download a Working copy containing XML, unfinished fields, schema/project settings and attached images, or restore a local browser checkpoint. |

The interface derives its navigation and editing capabilities from actual TEI structure. Entries, pages, speech turns and sections can coexist. A project manifest can refine that choice and supply schemas, vocabulary, indices, images and interchange settings. Genre-specific starters provide an initial encoding; existing documents are not converted into templates to fit a form.

## Quick start

1. Open a TEI file, or choose Load... > New document... for a deterministic draft. Supply historical facts explicitly; the starters do not infer them.
2. Inspect the source-derived navigation and the Source context panel. Double-click a supported text run, or focus it and press F2, to edit. Use XML source for operations without a safe form mapping.
3. Use Metadata for the complete header and Index for supported registers. Select reading text to annotate it. Apply, cancel or reset unfinished fields before changing their context.
4. Save or Download validates the exact project output against every configured schema. Invalid, unavailable or stale validation blocks that TEI output.
5. Use Working copy whenever unfinished input, unavailable schemas or attached images need preservation. A requested download does not establish a durable savepoint or remove recovery.

Open project folder and in-place Save use the browser's optional File System Access capability. The portable file-input and download workflow is exercised in Chromium and Firefox. Local recovery is independent of native file handles. Reopening a working copy recreates image URLs and requires renewed permission for project files.

## Preservation and support boundaries

The raw XML string is canonical. The editor applies exact offset splices instead of serializing the whole document tree. With the supported UTF-8 file boundary, including an optional BOM, an unchanged ordinary TEI file round-trips identically; intentional edits preserve unrelated source bytes. Explicit project interchange formats can apply a target projection before output validation.

Source preservation, readable projection and guided editing are separate capabilities. Exact XML remains available for structures without a safe interactive inverse. The current reader selects one branch of a choice or apparatus; a complete apparatus/witness workspace is still planned. UTF-16 and conflicting encoding declarations are refused rather than silently converted.

Review records retain their history and identify the reviewed source scope. A later change can make that review stale. Schema validation, human review and annotation coverage answer different questions; none establishes scholarly correctness by itself.

## Optional model assistance and data handling

New from text (LLM) can propose a TEI draft; Propose (AI) can suggest annotations in the current navigation unit. These features share a user-controlled AI toggle. Deterministic editing and starters require no model or key.

Model output is violet and initially unverified. Confirmation records acceptance while retaining responsibility pointers and visible machine origin; rejection removes the proposed construct through the normal mutation path. API keys remain in page memory. Provider calls, authority lookup, remote images and schema fetching have distinct external data flows documented in [SECURITY.md](SECURITY.md).

teiCrafter has no application backend or account system. The browser retains recovery data locally until explicit discard or a complete native save. Working-copy files may contain the complete source and image material, so treat them as project data.

## Development and verification

Use **Node 24.13.0**, **npm 11.6.2**, and Python with **lxml 5.4.0**, matching the repository's verification setup.

```bash
npm ci
npm run dev
```

Vite prints the local URL. For direct source inspection, run `python -m http.server 8000 --directory docs` and open `http://localhost:8000/editor.html`. Browser file capabilities require a secure context such as localhost; opening editor.html through file:// is insufficient. Built-in examples appear on local development hosts.

```bash
npm run verify
npx playwright install chromium firefox
npm run test:e2e
```

The required gate runs Node proofs, the Python harness, JavaScript checking, Biome, Vite and the deployment-asset contract. Playwright tests the built artifact in Chromium and Firefox with the configured Axe checks. Optional real-corpus sweeps use `npm run verify:full-corpus` and require their source material. See [test commands](test/README.md), [evidence policy](knowledge/testing.md) and [manual acceptance](test/acceptance/BROWSER-CHECKS.md).

## Documentation and project history

Start at [knowledge/INDEX.md](knowledge/INDEX.md). Each knowledge document owns one question: product, formats, requirements, architecture, design, testing, integration or examples. [reports/README.md](reports/README.md) separates current plans and implementation evidence from historical snapshots. Run-specific outcomes belong in dated reports.

The original prototype was developed in 2023 and presented at FORGE using Hugo Schuchardt correspondence. Digital Humanities Craft maintains the current open-source tool for editorial projects using the Promptotyping method. Project manifests support configuration; the knowledge base supports deeper adaptations through ordinary development or a coding agent. See [project identity and history](knowledge/project.md).

## Contributing

Feedback and concrete editorial workflows are welcome through GitHub issues. Include a minimal shareable example and expected behavior. Discuss larger changes before submitting a pull request, and follow the [Code of Conduct](CODE_OF_CONDUCT.md). Report vulnerabilities through the contact in [SECURITY.md](SECURITY.md).

## Citation

If you use teiCrafter in academic work, please cite:

> Pollin, C., Fischer, F., Sahle, P., Scholger, M., & Vogeler, G. (2025). When it was 2024 -- Generative AI in the Field of Digital Scholarly Editions. *Zeitschrift fuer digitale Geisteswissenschaften*, 10. DOI: [10.17175/2025_008](https://doi.org/10.17175/2025_008)

The original prototype and idea:

> Pollin, C., Steiner, C., & Zach, C. (2023). New Ways of Creating Research Data: Conversion of Unstructured Text to TEI XML Using GPT on the Correspondence of Hugo Schuchardt with a Web Prototype for Prompt Engineering. FORGE 2023, Tuebingen. DOI: [10.5281/zenodo.8425163](https://doi.org/10.5281/zenodo.8425163)

## Licence

Code is [MIT licensed](LICENSE). Vendored libraries, TEI schemas, guidelines and reference material retain their own notices. [knowledge/data.md](knowledge/data.md) records the source and rights boundaries; rights-local editions are not automatically redistributable.

This research preview requires editorial verification before scholarly use. Technical tests do not certify the correctness, completeness or fitness of model-generated or manually edited scholarly content.
