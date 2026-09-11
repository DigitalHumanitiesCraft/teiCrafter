# Knowledge consolidation, 2026-09-11

The repository knowledge has been reconciled with the implemented editorial workspaces and the [completed evaluation](editorial-completion-2026-09-11.md). This documentation pass started from clean `main` at `e6e58d05cb6d527c96e6b95c3e59855d495b374a`. The tested application revision remains `8498916800267cb9298c688a9dbacf3c74cf0b7f`; this pass changes documentation only.

## Document ownership

| Document | Consolidated function and correction |
| --- | --- |
| [Index](../knowledge/INDEX.md) | Reading routes, terminology, document maturity and the shared schema contract. Re-entry includes the permanent handoff inbox. |
| [Project](../knowledge/project.md) | Product purpose, editorial routes and practical limits. Detailed encodings and validation mechanisms route to their owners. |
| [Data](../knowledge/data.md) | Canonical bytes, manifest/schema formats, complete recovery, portable collections, package members and TEI evidence. |
| [Specification](../knowledge/specification.md) | Normative requirements and acceptance scenarios. Existing requirement identifiers remain stable; specialized witness authoring is distinguished from generic header editing. |
| [Architecture](../knowledge/architecture.md) | Runtime ownership, staged-input restoration, discovery, mutations and validation currentness. |
| [Design](../knowledge/design.md) | Visible interaction, input ownership, provenance, reading, form and output behavior. |
| [Testing](../knowledge/testing.md) | Claim-to-evidence mapping, strict evaluation, omission rules, real-source reproduction and acceptance limits. |
| [Integration](../knowledge/integration.md) | Project folders, schemas, linked editions, source pipelines, services and deployment boundaries. |
| [Wenzelsbibel](../knowledge/wenzelsbibel.md) | Specialized editorial mappings, project checks and authoring workflow. Local profile decisions remain subject to scholarly ratification. |
| [Worked examples](../knowledge/worked-examples.md) | Reproducible editorial recipes and the observed real-codex path, including working-copy repair and exact delivery. |
| [Converter reference](../knowledge/converter-reference.md) | Frozen SZD mapping with corrected current navigation and identifier-allocation explanation. The local Python port is identified explicitly. |
| [Journal](../knowledge/journal.md) | Compact decision provenance, including why recovery, validation and the document collection required their current boundaries. Earlier full wording remains in Git. |
| [Handoff](../knowledge/handoff.md) | Received deltas awaiting integration. The inbox is present and empty after the documentation work is integrated. |

The action layer, public README, test guide and report index route to the same owners. The test guide identifies `npm run evaluate:editorial` as the complete completion gate. Release requirements retain their separate catalogue.

## Preservation decisions

The shared knowledge schema is `0.23` because its document contract now includes the mandatory process inbox and explicit maturity semantics. The frozen converter retains its independent `0.6.1` contract. Application metadata remains `0.1.0`; no release or release tag is created.

The journal retains the reasons for accepted, corrected and rejected decisions. Repeated implementation inventories and transient test totals are removed from the journal. Git at the starting revision preserves the full earlier text. Existing public knowledge filenames and normative requirement identifiers remain stable. Dated failures, earlier real-source observations, source notices and rights declarations retain their historical meaning.

`complete` in reference-document frontmatter describes consolidated knowledge. `active` describes the ongoing journal and handoff inbox. These values do not certify scholarly adequacy or user acceptance. The original image Schematron remains unavailable, the local peoples and Bible models require scholarly ratification, and first-time full-codex validation remains costly.

## Documentation checks

The existing [Markdown checker](check-documentation-2026-09-05.py) is reused with the current schema expectation and a separate output path. Its historical September 5 JSON is preserved. Run the following PowerShell command from the repository root with Python and `rg` available:

```powershell
@'
from pathlib import Path
source_path = Path('reports/check-documentation-2026-09-05.py').resolve()
source = source_path.read_text(encoding='utf-8')
source = source.replace('"0.22"', '"0.23"')
source = source.replace('"date": "2026-09-05"', '"date": "2026-09-11"')
target = Path('node_modules/.tmp/documentation-audit-2026-09-11.json')
target.parent.mkdir(parents=True, exist_ok=True)
source = source.replace('reports/documentation-audit-2026-09-05.json', target.as_posix())
exec(compile(source, str(source_path), 'exec'), {'__file__': str(source_path)})
'@ | python -
git diff --check
```

The checker covers UTF-8, local inline Markdown targets, Markdown heading anchors, required knowledge metadata, related-document targets and the top-level version policy. The vendored libxml README retains its two documented references to files available only in its upstream source repository. The checker does not fetch external links or fully parse CommonMark or YAML. Claims and requirement continuity are checked separately against source code and the prior document revision.

The [recorded documentation audit](documentation-audit-2026-09-11.json) reports no errors. `git diff --check` also passes. Independent document review corrected the ordering of the PAGE-import recipe, retained the public licence anchor, and checked that the frozen converter points to its actual local implementations. The journal's decision coverage was compared with the starting revision.

The runtime, schema, fixture and evaluator files remain identical to the tested application revision. The [editorial completion report](editorial-completion-2026-09-11.md) owns all application test results; documentation checks do not constitute another browser run. Private project knowledge and ACTIVE-WORK receive the corresponding source-linked completion and acceptance boundaries from the Vault session.
