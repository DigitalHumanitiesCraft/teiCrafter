# Local SZD mapping fixture

This directory holds a generated dataset and facsimiles for the development-only `/szd-mapping.html` view. The source is the external `typesafe-lab/results/szd-blind-2026-09-19` frozen experiment. Its recorded rule and Jev predictions cover the content pages of `o_szd.1717` and `o_szd.1701`. The declared blank page is excluded. The experiment's reference annotations have no human approval and are not exported to this interface.

Run the builder from the teiCrafter repository with the path to the existing frozen result directory:

```powershell
node test/tools/make_szd_mapping_fixture.mjs C:/Users/Chrisi/Documents/PROJECTS/typesafe-lab/results/szd-blind-2026-09-19
```

The builder verifies the frozen plan and scan hashes, source identity, recorded choices and selected text spans. It converts source codepoint offsets into JavaScript UTF-16 offsets. Output consists of `dataset.json` and one JPG per displayed page. These payloads remain gitignored; this README is tracked. The builder reads only the specified frozen records and makes no API calls. It does not modify the experiment.

The dataset contains immutable transcriptions and recorded proposals without reference answers, correctness labels, credentials or local source paths. User decisions are stored separately in the browser or downloaded as source-bound JSON. The [architecture](../../../../knowledge/architecture.md#local-szd-source-mapping) describes the TEI draft and editor handoff. Local availability of scans does not establish permission to redistribute them.
