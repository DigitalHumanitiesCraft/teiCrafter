# teiCrafter -- Project Overview and Strategic Positioning

Last updated: 2026-03-03

---

## 1. What is teiCrafter?

teiCrafter is a browser-based, LLM-assisted TEI-XML annotation environment for digital scholarly editions. It combines three functional cores in a single integrated interface: modular transformation of plaintext into semantically annotated TEI-XML, a teiModeller component that provides LLM-guided support for the modeling process itself, and a validation and review system that combines rule-based checks with LLM-as-a-Judge evaluation.

The tool runs entirely in the browser as a static web page -- no server, no user account, no installation. It is deployed via GitHub Pages and built with ES6 modules without a bundler or build step.

### Pipeline Position

```
Image -> coOCR HTR -> teiCrafter -> ediarum / GAMS / Publication
         (Transcription)  (Annotation &      (Deep indexing &
                           Modeling)          Publication)
```

teiCrafter addresses the gap between automated text recognition and manual deep indexing. It produces valid, schema-conformant TEI-XML that serves as a qualified starting point for further editorial work in environments such as ediarum.

### Epistemic Asymmetry

The epistemological foundation is the concept of epistemic asymmetry, adopted from coOCR HTR. LLMs generate plausible annotations but cannot reliably assess whether those annotations are correct. In TEI annotation, this problem is compounded because annotation decisions are often interpretive, schema conformance does not guarantee semantic correctness, and authority file assignments require contextual knowledge. teiCrafter therefore positions human expertise not as optional quality control but as a structurally necessary component of the workflow.

### Distinction from coOCR HTR

| Aspect | coOCR HTR | teiCrafter |
|---|---|---|
| Input | Image (IIIF, upload) | Text (plaintext, PAGE-XML, basic TEI, DOCX) |
| Output | Structured text, PAGE-XML, basic TEI | Semantically annotated TEI-XML |
| Focus | Character recognition, layout preservation | Semantic annotation, modeling, validation |
| Validation | Transcription quality | Schema conformance, annotation consistency, LLM review |
| LLM role | Transcription assistance | Annotation, modeling guidance, quality checking |

### Distinction from Existing TEI Editors

teiCrafter is not a replacement for oXygen or ediarum. It is a pre-editorial environment. oXygen and ediarum presuppose that modeling decisions have already been made. teiCrafter supports precisely that decision process and delivers annotated TEI-XML that can be imported into established editorial environments.

---

## 2. Why teiCrafter Exists

### Market Gap

An analysis of more than ten DH tools confirms a central finding: **no existing production-ready tool combines a TEI annotation interface with LLM-assisted markup generation.** teiCrafter is the first mover in this niche.

Existing tools either provide full TEI editing but require significant infrastructure and licensing (oXygen, ediarum), focus on publishing rather than annotation (TEI Publisher), use non-TEI annotation models (CATMA), or treat TEI export as a byproduct of transcription (Transkribus, eScriptorium). None integrates LLM-assisted annotation with human review in a zero-infrastructure browser environment.

### The Four Strategic Differentiators

| # | Differentiator | Rationale |
|---|---|---|
| 1 | **Zero Infrastructure** | Eliminates the number-one adoption barrier in the DH tool landscape. No server, no account, no installation required. |
| 2 | **LLM as First-Pass Annotator with Obligatory Human Review** | Addresses both the tedium problem and scientific accountability simultaneously. |
| 3 | **Schema-Profile-Guided LLM Output** | A JSON schema profile prevents hallucinated markup -- a genuine innovation in this space. |
| 4 | **Bring Your Own API Key (BYOK)** | No vendor lock-in, no recurring API cost borne by the tool itself. Six providers supported: Gemini, OpenAI, Anthropic, DeepSeek, Qwen, Ollama. |

### DH Community Consensus

The most promising and methodologically acceptable approach identified in the literature is LLMs as first-pass annotators with obligatory human review. This preserves scholarly authority while reducing repetitive labor. The epistemic asymmetry principle is not a teiCrafter-specific concept but is broadly discussed in the DH community.

---

## 3. Tool Landscape

### Tier 1: Full TEI Editing Environments

**Oxygen XML Web Author** (oxygenxml.com) -- The most complete browser-based XML editor. Schema-aware editing with auto-completion, Author Mode (WYSIWYG via CSS), tracked changes, comments, and CMS backends (eXist-db, MarkLogic, GitHub). Weaknesses: commercial with high per-user license costs, requires a server component, overwhelming for non-technical scholars, and is a generic XML editor with a TEI framework layer rather than a purpose-built TEI tool.

**ediarum** (BBAW) -- Purpose-built for critical and scholarly editions. Extensive TEI customization (apparatus, registers, letters, diaries), integrated publishing pipeline to eXist-db, and ediarum.WEB for limited browser functionality. Weaknesses: primarily a desktop tool (Oxygen Author Framework), requires an Oxygen license, tightly coupled to BBAW infrastructure, steep learning curve.

**TEI Publisher** (e-editiones) -- Community-driven open-source platform on eXist-db. Publishing pipeline (ingest, ODD/Processing Model transform, publish) with Web Components architecture. Annotation editor available from v8+ (2023-2024). Weaknesses: requires an eXist-db server, annotation editing is secondary to the publishing focus, high learning curve for ODD customization.

### Tier 2: Annotation Platforms (Not TEI-Native)

**CATMA** (University of Hamburg) -- Purpose-built for literary and humanities annotation. Flexible tagsets, collaborative, integrated analysis and visualization, Git-backed version control. Free and web-based. Weaknesses: not a TEI tool -- uses its own standoff annotation model. TEI export is secondary with no one-to-one mapping to inline TEI. Limited structural markup support. UI partially outdated.

**LEAF-Writer** (CWRC, Canada) -- Browser-based editor with standoff annotation on TEI documents, named entity tagging, WYSIWYG editing. Winner of the 2025 Rahtz Prize as a collaborative TEI editing environment. Weaknesses: smaller community, tied to CWRC infrastructure, limited adoption outside Canadian DH projects.

### Tier 3: Transcription-Focused Tools (TEI Export as Byproduct)

**Transkribus** (READ-COOP) -- Market leader in HTR with 600,000+ processed documents. Layout analysis, baseline recognition, custom model training, browser version (Transkribus Lite) since 2022-2023. Exports to TEI, PAGE XML, ALTO. Weaknesses: a transcription tool, not an annotation tool. TEI export provides only basic structuring. Freemium model with credit limits. TEI output requires significant post-processing.

**eScriptorium** (PSL/EPHE Paris) -- Fully open-source HTR on the Kraken engine. Strong multi-script support (Arabic, Hebrew, Latin), IIIF support. Weaknesses: requires server infrastructure (Django + Celery + Redis + GPU). TEI export only at line/zone level. No semantic annotation.

**FromThePage** (commercial) -- Collaborative crowdsourced transcription for archives and libraries. IIIF, subject indexing, TEI-XML export. Weaknesses: basic TEI support, transcription rather than annotation focus, commercial SaaS.

### Additional Tools

- **JinnTap** (Meier, Windauer, Wicentowski; e-editiones) -- A browser-based WYSIWYM editor for TEI-XML, demonstrated at TEI 2025 and forthcoming as part of TEI Publisher 10. Preserves XML structure using custom HTML elements. Available as an npm package (@jinntec/jinn-tap). The closest competitor/comparator to teiCrafter as a browser-based TEI editor, though it lacks LLM integration and ODD-guided annotation.
- **ODD-API** (Stadler, Ferger, Kepper, Viglianti; Paderborn University) -- REST interface for programmatic querying of ODD schema definitions, supporting TEI and MEI. Extremely relevant as a potential upstream data source for schema-aware features.
- **Scholarly XML** (Viglianti, University of Maryland) -- VS Code extension with RELAX NG and Schematron validation plus schema-aware suggestions. Winner of the 2024 Rahtz Prize.
- **EVT** (Edition Visualization Technology) -- TEI viewer (not editor), suitable for diplomatic and critical editions.
- **TextGrid** -- German research infrastructure with TextGridLab, partially outdated.
- **Versioning Machine** -- Parallel text display for TEI editions.
- **Codex** (formerly Textual Communities) -- Browser-based collaborative TEI transcription.
- **Roma** (roma.tei-c.org) -- Canonical ODD customization tool, without a major 2025 update.

### Comparison Matrix

| Capability | Oxygen Web | ediarum | TEI Publisher | CATMA | Transkribus | teiCrafter |
|---|---|---|---|---|---|---|
| Browser-based, no server | No | Partial | No (eXist-db) | Yes (hosted) | Yes (hosted) | **Yes (static)** |
| TEI-native inline editing | Yes | Yes | Yes | No (standoff) | No | **Yes** |
| LLM-assisted annotation | No | No | No | No | No (HTR only) | **Yes (core)** |
| Schema-guided LLM output | No | -- | -- | -- | -- | **Yes** |
| Human review of AI suggestions | Tracked changes | -- | -- | -- | HTR confidence | **Yes (core)** |
| No account/license required | No (license) | No (license) | No | No (account) | No (account) | **Yes** |
| Offline-capable after loading | No | No | No | No | No | **Possible** |
| Multi-provider LLM support | -- | -- | -- | -- | -- | **Yes (6 providers)** |
| Open source | No | Partial | Yes | Yes | No | **Yes** |

### Known LLM + TEI-XML Failure Modes and Mitigations

| Failure Mode | Description | Mitigation in teiCrafter |
|---|---|---|
| Malformed XML | Unclosed tags, overlapping hierarchies | Well-formedness check via DOMParser |
| Text alteration | "Correction" of historical spellings, silent character deletion | Plaintext comparison (validator.js) |
| Hallucinated attributes | Invented attribute names or values | Schema validation, attribute sanitization on export |
| Over-annotation | Annotating everything possible (recall over precision) | Prompt rule "precision over recall," confidence scoring |
| Under-annotation | Missing entities in abbreviations or historical spellings | Multi-pass strategy, "suggest more" button (planned) |
| Namespace confusion | TEI P5 mixed with other XML vocabularies | ANNOTATION_TAGS whitelist |
| Structure vs. semantics | LLM modifies div/p instead of performing NER only | selectedTypes filter in transform.js |
| Inconsistency | Same entity annotated differently across the document | Consistency check (planned, Phase 3) |

---

## 4. Research Landscape (2025-2026)

The intersection of large language models and TEI-XML encoding has emerged as a distinct research area in 2025, but remains dominated by a small number of groups, lacks standardized evaluation protocols, and has not yet produced a tool that combines ODD-guided schema validation with LLM-assisted annotation in a browser-based environment. This survey covers three thematic axes -- LLM-assisted TEI annotation, validation of LLM-generated outputs, and TEI/ODD modeling infrastructure -- drawing on peer-reviewed publications, preprints, conference presentations, and tool releases from 2025-2026 only. The findings confirm that teiCrafter occupies a genuinely novel niche: while individual components (LLM-to-TEI generation, schema validation, human-in-the-loop review) each have growing literature support, no existing system integrates all three with a layered prompt architecture. The landscape offers both strong positioning opportunities and clear technical precedents to build upon.

### Axis 1: LLM-Assisted TEI/XML Annotation

#### The Foundational Survey

The single most important reference for teiCrafter's related work section is **Pollin, Fischer, Sahle, Scholger, and Vogeler (2025), "When it was 2024 -- Generative AI in the Field of Digital Scholarly Editions,"** published in *Zeitschrift fur digitale Geisteswissenschaften* (ZfDG), Heft 10 (DOI: 10.17175/2025_008). This peer-reviewed article identifies eight key application areas for LLMs in digital scholarly editing -- from transcription and OCR/HTR post-processing to markup generation, NER, normalization, and summarization -- based on the DHd 2024 workshop "Call for Experiments" organized by the IDE. It references teiCrafter explicitly and calls for standardized workflow orchestration and evaluation protocols. Any grant proposal or paper building on teiCrafter should cite this as the primary state-of-the-art survey.

#### Peer-Reviewed and Conference Publications (2025)

Beyond the Pollin et al. survey, 2025 saw at least five peer-reviewed or conference-presented studies directly testing LLM-to-TEI encoding:

- **De Cristofaro and Zilio (AIUCD 2025, Verona)** compared ChatGPT-4 and Claude 3.5 Sonnet for automated XML-TEI encoding of archival correspondence in the PubCiNET project. Claude produced more valid files initially; ChatGPT required more iterative correction. Both models efficiently extracted metadata but differed in recognizing in-text information. (URL: aiucd2025.dlls.univr.it/assets/pdf/papers/94.pdf)

- **Strutz, Scholger, and Vogeler (TEI 2025, Krakow)** presented "Beyond Rule-Based Processing: LLM-Assisted TEI Encoding of Editorial Interventions in Historical Correspondence" -- a long paper directly from the Graz teiCrafter team extending the approach to editorial interventions.

- **Beshero-Bondar, Bills, and Fisher (TEI 2025)** from Penn State Erie asked "Can we make an AI respect TEI XML?" using a small-scale explainable AI model, offering a complementary approach to teiCrafter's LLM-based method.

- **De Cristofaro, Leboffe, and Zilio (TEI 2025)** extended LLM-based TEI encoding to Spanish Golden Age theatre, demonstrating cross-genre applicability.

- **Janes, Beniere, Cleric, and Sagot (TEI 2025, INRIA)** developed a TEI-based layout annotation system for deeper automatic document encoding, bridging document layout analysis and TEI.

The TEI 2025 conference ("New Territories," Krakow, September 2025) was the richest single venue, with at least six presentations touching on LLM-assisted or automated TEI encoding.

#### NER on Historical Texts with LLMs

Named entity recognition in historical texts -- a core annotation task for TEI digital editions -- has a solid 2025 evidence base:

- **Tudor, Megyesi, and Ostling (LaTeCH-CLfL at NAACL 2025)** tested zero-shot LLM prompting for NER in historical texts using the HIPE-2022 dataset, finding reasonable performance but not matching supervised models (URL: aclanthology.org/2025.latechclfl-1.19.pdf).

- **Zhang et al. (arXiv:2508.18090, August 2025)** explored zero-shot and few-shot LLM prompting for historical NER, similarly finding that LLMs achieve strong but not state-of-the-art results.

- A multimodal LLM study **(arXiv:2504.00414, April 2025)** demonstrated that models like Gemini 2.0 Flash can perform OCR, OCR post-correction, and NER on historical documents in an integrated end-to-end pipeline, achieving 0.84% CER with post-correction -- relevant to the early stages of the transcription-to-TEI pipeline.

- **Lin et al. (2025, *International Journal of Geographical Information Science*)** fine-tuned Qwen 2.5-7B with LoRA for nested NER in Chinese historical gazetteers, and a study in *npj Heritage Science* (Nature, 2025) fine-tuned four LLMs for NER on the Twenty-Four Histories.

#### Structured XML Output Generation

The technical challenge of getting LLMs to produce well-formed, schema-conformant XML is addressed by several 2025 publications outside the DH community:

- **Wang, Shen, and Mishra et al. (EMNLP 2025 Industry Track), "SLOT: Structuring the Output of Large Language Models,"** introduces the SLOTBENCH benchmark for converting textual LLM responses into structured formats including XML (URL: aclanthology.org/2025.emnlp-industry.32.pdf).

- **Geng et al. (arXiv:2501.10868, January 2025)** benchmarked constrained decoding frameworks (Guidance, Llama.cpp, Outlines) for structured output generation, providing technical foundations for schema-conformant XML output.

- **StructEval (arXiv:2505.20139, May 2025)** evaluates LLMs on generating JSON, XML, LaTeX, and HTML, offering evaluation methodology applicable to TEI-XML.

#### German-Language DH Context

DHd 2025 (Bielefeld, March 2025) included several relevant presentations: Oberbichler, Pollin, Rastinger et al. on "More than Chatbots: Multimodal Large Language Models in geisteswissenschaftlichen Workflows"; Will, Kamlah et al. on "eScriptorium meets LLMs" (integrating LLMs with HTR platforms); and Nager and Eickhoff on LLM prompt engineering for archives. The opening keynote by Mark Dingemanse addressed "What makes LLMs so irresistible?" advocating critical AI literacy.

#### Gaps in Axis 1

No systematic benchmark for LLM-generated TEI-XML quality exists. No peer-reviewed tool paper has been published for teiCrafter. Most work uses proprietary LLMs (GPT-4, Claude); open-source and local LLM evaluation for TEI encoding is largely absent. No study has applied fine-tuning specifically for TEI-XML output. The topic lives primarily in DH venues -- no ACL/NLP venue paper directly addresses LLM-to-TEI conversion. Browser-based LLM-assisted TEI annotation environments remain essentially unoccupied beyond teiCrafter.

### Axis 2: Validation of LLM-Generated Outputs

#### LLM-as-a-Judge

The LLM-as-a-Judge paradigm -- using one LLM to evaluate another's output -- has extensive 2025 literature support, with two comprehensive surveys providing architectural guidance:

- **Gu et al. (arXiv:2411.15594, updated through October 2025)** survey how to build reliable LLM-as-a-Judge systems, covering consistency improvement, bias mitigation, and adaptation to diverse evaluation scenarios.

- **Li, Jiang, Huang et al. (2025)** at llm-as-a-judge.github.io offer a complementary framework covering what, how, and where to deploy judge models, with analysis of limitations.

Two ICLR 2025 papers establish key benchmarks: **JudgeBench** (OpenReview: G0dksFayVq) reveals that even GPT-4o performs only slightly better than random on hard evaluation cases, while **JudgeLM** demonstrates that fine-tuned 7B-33B parameter models can achieve greater than 90% agreement with teacher judges using swap augmentation and reference support.

A critical finding for teiCrafter comes from **IUI 2025 (ACM)**: in domain-specific tasks (dietetics, mental health), subject-matter experts agreed with LLM judges only 64-68% of the time -- strong evidence that for specialized annotation like TEI-XML encoding, human expert review remains essential. **Li et al. (arXiv:2502.01534)** expose "preference leakage" -- contamination when the same or related LLMs generate and evaluate content -- supporting teiCrafter's design of using different models for generation versus evaluation.

#### Epistemic Uncertainty and Confidence Calibration

The question of whether LLMs can reliably signal their own uncertainty is directly relevant to teiCrafter's confidence-based routing to human review:

- **Lee, Hwang, Kim, Park, and Jung (NAACL 2025, pp. 8962-8984)** introduced the EMBER benchmark showing all tested LLM-judges exhibit negative bias toward epistemic markers -- penalizing outputs that honestly express uncertainty. This is a critical design consideration: if teiCrafter's judge penalizes uncertain annotations, it creates perverse incentives.

- A **NeurIPS 2025 submission** (OpenReview: 9Jq7wNrpUI) on "Uncovering Confident Failures" introduces epistemic uncertainty as semantic disagreement across model ensembles, showing that combining aleatoric and epistemic uncertainty improves correctness prediction -- directly relevant to the "plausible-looking but incorrect TEI markup" problem.

- **"The Illusion of Certainty" (arXiv:2511.04418, November 2025)** demonstrates that uncertainty quantification methods break down when both types of uncertainty coexist, meaning confidence scores must be interpreted carefully in TEI annotation where genuine ambiguity is common.

- The **MUSE framework (EMNLP 2025, pp. 30481-30492)** uses Jensen-Shannon Divergence to identify well-calibrated LLM subsets, and **Ghasemabadi and Niu (arXiv:2512.20578)** propose "Gnosis," a lightweight approximately 5M parameter self-awareness mechanism that outperforms billion-parameter reward models for correctness prediction.

For practical confidence calibration, **Hovsepian, Liu, and Murugesan (GenAIECommerce 2024/2025, Amazon Science)** develop logit-based calibration pipelines where calibration error-based sampling reduces error by 46% and cost-aware cascading ensemble policies route uncertain cases efficiently. **Mavi et al. (arXiv:2511.07364, November 2025)** show that stepwise self-evaluation outperforms holistic scoring by up to 15% relative AUROC increase in multi-step tasks -- directly applicable since TEI annotation involves sequential multi-step decisions.

#### Human-in-the-Loop Validation Workflows

Several 2025 studies validate the architectural pattern teiCrafter employs -- LLM pre-generation with human verification:

- A **multicenter clinical study (SSRN, 2025)** found that LLM-assisted hybrid prescreen-and-verify workflows reduced audit time from median 51 seconds to 11 seconds while maintaining accuracy -- directly paralleling teiCrafter's approach.

- **AIANO (arXiv:2602.04579, 2025)** is the closest architectural parallel to teiCrafter: a browser-based annotation tool integrating LLM assistance with human oversight for information retrieval tasks, where 93.3% of users found AI assistance useful.

- **CHAIRA (arXiv:2409.14223, presented 2025)** demonstrates that two-stage few-shot chain-of-thought prompting in co-annotation settings nearly matches human-human agreement.

- A **CEUR-WS study (Vol. 4006, 2025)** comparing human and LLM evaluators found that human reviewers deliver more discerning evaluations while LLMs are permissive and miss subtle flaws -- confirming the necessity of human review in teiCrafter's pipeline.

#### Constrained Decoding and Structured Output Validation

The technical infrastructure for ensuring LLMs produce schema-conformant output has advanced significantly:

- **Park, Zhou, and D'Antoni (ICML 2025)** achieve 17.71x faster offline preprocessing for grammar-constrained decoding, potentially enabling real-time TEI-XML grammar enforcement.

- **Schmidt and Cimiano (Frontiers in AI, Vol. 7, January 2025, DOI: 10.3389/frai.2024.1406857)** validate grammar-constrained decoding for structured information extraction from scholarly text.

- However, **Schall and de Melo (RANLP 2025, Varna)** reveal a crucial finding: constrained decoding can degrade task performance, with fundamental divergence between base and instruction-tuned models under structural constraints. This supports teiCrafter's approach of post-generation validation rather than constrained decoding alone.

- **Li et al. (ICLR 2025), "IterGen,"** introduce iterative structured generation with backtracking and KV-cache reuse, enabling correction of structured output errors without restarting -- a technique that could apply to TEI-XML correction loops.

Open-source tools supporting this space include DeepEval (deepeval.com, approximately 500K monthly downloads), Langfuse (langfuse.com, with JSON Schema enforcement since November 2025), Guardrails AI (with re-ask patterns on validation failure), and Outlines (dottxt, supporting regex/JSON Schema/CFG-based constrained decoding).

#### Gaps in Axis 2

No 2025 work addresses LLM-generated TEI-XML validation specifically. JSON dominates the structured output validation literature; XML is underrepresented. Schema-guided validation for complex nested markup (XSD/RelaxNG) of LLM outputs is essentially unstudied. Confidence calibration for multi-label structured annotation tasks (versus classification) is underdeveloped. No publication examines how layered prompt architecture design affects annotation quality. The intersection of LLM evaluation methodology and digital humanities annotation workflows remains a significant gap.

### Axis 3: TEI Modeling Infrastructure

#### TEI Guidelines and Consortium Developments in 2025

The TEI Consortium released three significant versions in 2025. **TEI P5 v4.9.0** (January 24, 2025) introduced the new `constraintDecl` element for specifying Schematron query language binding in ODDs -- directly affecting schema generation pipelines. **TEI P5 v4.10.0** ("The Olinguito Release," August 15, 2025; release technicians: Bermudez Sabel, Bleeker, O'Connor) revised the Dedication/Preface for the first time since the 2007 P5 launch and added new dictionary encoding examples from TEI Lex-0. Two subsequent patch releases (v4.10.1 and v4.10.2, August-September 2025) fixed Schematron constraint and content model bugs, illustrating the criticality of content model correctness in ODD processing.

The **TEI Stylesheets Task Force** (chaired by Syd Bauman, with Martin Holmes, Helena Bermudez Sabel, and David Maus) is actively developing a new XSLT 3-only ODD processor that will separate ODD processing from Guidelines representation, support ODD chaining and PureODD, and produce a new testing suite. This is directly critical for teiCrafter's schema generation pipeline. Additionally, a **TEI Lite 2.0 Working Group** is developing a new version of the TEI Lite customization, which will likely become a key starter ODD for many projects.

#### New Tools Reshaping the TEI Editing Landscape (2025)

The most significant new tool announcement is **JinnTap** (Meier, Windauer, Wicentowski; e-editiones), a browser-based WYSIWYM editor for TEI-XML demonstrated at TEI 2025 and coming as part of TEI Publisher 10. JinnTap preserves XML structure directly using custom HTML elements and is available as an npm package (@jinntec/jinn-tap). It is teiCrafter's closest competitor/comparator as a browser-based TEI editor, though it lacks LLM integration and ODD-guided annotation features.

**ODD-API** (Stadler, Ferger, Kepper, Viglianti; Paderborn University) is a REST interface for programmatic querying of ODD schema definitions, supporting both TEI and MEI. Available at github.com/Edirom/odd-api and odd-api.edirom.de, this tool is extremely relevant to teiCrafter as a potential upstream data source for schema-aware features. **Scholarly XML** (Viglianti, University of Maryland), a VS Code extension with RELAX NG and Schematron validation plus schema-aware suggestions, won the 2024 Rahtz Prize and is adding Schematron validation features in 2025. **LEAF-Writer** (Brown, Cummings, Frizzera, Ilovan, Jakacki) won the 2025 Rahtz Prize as a collaborative TEI editing environment.

Additional tools include TEI Publisher 10 / Jinks (e-editiones, active development through October 2025 at github.com/eeditiones/jinks), NormaTEI (CNR Italy, presented at TEI 2025) for encoding uniformity control, and Roma at roma.tei-c.org, which remains the canonical ODD customization tool without a major 2025 update.

#### TEI 2025 Conference Contributions on Modeling and ODD

- **Bauman, Bermudez Sabel, and Holmes** presented "Differentiating ODDs" -- addressing mechanics of how ODDs differ and can be compared.
- **Engler, Morth, Prochazka, Rausch-Supola, and Schopper (Austrian Academy of Sciences)** demonstrated ODD chaining for Arabic dialect dictionaries -- an advanced customization technique teiCrafter should support.
- **Turska (e-editiones)** presented "Haute couture for the masses," discussing accessible ODD customization.
- **Bermudez Sabel and Turska** ran workshops on the TEI Processing Model and Jinks/TEI Publisher 10.
- **Boot (Huygens Institute)** proposed "An XML-based edition publication model."
- **Kollatz (Academy of Sciences Mainz)** presented "LEGOstyle: Building modular, flexible Editions with TEI."
- **Quenouille (Leipzig Academy)** discussed encoding complexity in the Forschungsportal BACH project.

#### German-Language DH Context

DHd 2025 (Bielefeld) included **Ries, Andrews, Rosendahl, Sahle, Viehhauser, Vogeler, and Hegel** on "Critical AI in der Digitalen Editorik" -- a panel directly examining AI in digital scholarly editing. Thomas, Hofmann-Polster, and Hafner presented large-scale TEI-XML encoding of 2,400 letters from Goethe's correspondence. Dogunke discussed modular research infrastructure for digital editions at ThULB. Neuber, Henny-Krahmer, and Scholger reflected on RIDE and digital edition reviewing standards. DHd 2026 ("Nicht nur Text, nicht nur Daten," Vienna) has published its call for papers and represents the next major German-language DH venue.

#### Gaps in Axis 3

No 2025-2026 tool combines ODD-based schema-guided editing with LLM assistance -- this is teiCrafter's clearest differentiator. No publication addresses AI-assisted ODD customization (using LLMs to help design schemas rather than merely apply them). Roma has no announced successor. While ODD-API provides programmatic schema access, no system uses such access to dynamically guide LLM annotation. The new Stylesheets Task Force ODD processor is still in development, creating an opportunity for teiCrafter to adopt it early.

### Cross-Cutting Gaps and Strategic Positioning

Five major gaps emerge across all three axes that teiCrafter is uniquely positioned to address.

First, **no integrated system exists** that combines LLM-assisted TEI generation, ODD-guided schema validation, LLM-as-Judge quality checking, and human-in-the-loop review in a single browser-based environment. The individual components each have 2025 literature support, but their integration is novel.

Second, **no benchmark or evaluation protocol** for LLM-generated TEI-XML quality has been published. The field relies on ad hoc assessments. A standardized benchmark measuring schema conformance, semantic accuracy, and editorial fidelity would be a significant contribution.

Third, **confidence calibration for structured annotation** (as opposed to classification or QA) is underdeveloped. teiCrafter's element-level confidence scoring and threshold-based routing to human review addresses a gap the uncertainty quantification literature has identified but not solved for annotation contexts.

Fourth, **the asymmetry between LLM generation quality and self-assessment quality** has been studied generically (the "confident failures" problem) but never in the context of TEI-XML annotation, where plausible-looking but semantically incorrect markup is the primary risk.

Fifth, **open-source and local LLM evaluation** for TEI encoding is nearly absent -- most studies use GPT-4 or Claude. Testing open models would address reproducibility and cost concerns important to the DH community.

The literature confirms teiCrafter's core design decisions: using separate models for generation and evaluation (supported by preference leakage findings), employing post-generation schema validation rather than constrained decoding alone (supported by evidence of performance degradation under constraints), implementing stepwise rather than holistic quality assessment (supported by multi-step evaluation research), and maintaining human review as the final arbiter (supported by the 64-68% expert-LLM agreement findings). The project should position itself not just as a tool but as a methodological contribution bridging the NLP evaluation literature and digital humanities editorial practice.

### Summary of Key References by Type

**Peer-reviewed journal articles (2025):** Pollin et al. in ZfDG; Lin et al. in *IJGIS*; automatic NER in *npj Heritage Science*; Schmidt & Cimiano in *Frontiers in AI*

**Conference papers, peer-reviewed (2025):** De Cristofaro & Zilio at AIUCD; Tudor et al. at LaTeCH-CLfL/NAACL; Wang et al. SLOT at EMNLP Industry; JudgeBench and JudgeLM at ICLR; Lee et al. EMBER at NAACL; Park et al. at ICML; Schall & de Melo at RANLP; Li et al. IterGen at ICLR; IUI 2025 LLM-as-Judge limitations study

**Conference presentations (2025):** Strutz/Scholger/Vogeler, Beshero-Bondar et al., De Cristofaro/Leboffe/Zilio, Janes et al., Stadler et al. ODD-API, Bauman et al. Differentiating ODDs at TEI 2025; Ries et al. Critical AI, multiple DHd 2025 presentations

**Preprints (2025):** Zhang et al. arXiv:2508.18090; multimodal LLMs arXiv:2504.00414; Geng et al. arXiv:2501.10868; StructEval arXiv:2505.20139; Gu et al. survey arXiv:2411.15594; Li et al. preference leakage arXiv:2502.01534; epistemic uncertainty arXiv:2506.07448, arXiv:2511.03166, arXiv:2511.04418; Mavi et al. arXiv:2511.07364; Ghasemabadi & Niu arXiv:2512.20578; AIANO arXiv:2602.04579; MUSE at EMNLP 2025

**Tool announcements and releases (2025):** JinnTap (e-editiones); ODD-API (Paderborn); TEI Publisher 10/Jinks; TEI P5 v4.9.0-v4.10.2; Scholarly XML updates; DeepEval; Langfuse; Guardrails AI; Outlines

**Foundational 2024 reference widely cited in 2025:** DeRose, "Can LLMs help with XML?" at Balisage 2024 (DOI: 10.4242/BalisageVol29.DeRose01)

---

## 5. Architecture Principles

| Principle | Implementation |
|---|---|
| Expert integration | The domain expert is at the center, not at the end. She selects the mapping, validates annotations, and decides in cases of ambiguity. |
| Model diversity | Multiple LLM providers (OpenAI, Anthropic, Google, DeepSeek, Qwen, Ollama). No single model is presumed superior. |
| Structural preservation | TEI structure is preserved throughout; no lossy transformations occur. |
| Local control | Client-only architecture. API keys are held in memory only, never persisted to DOM, storage, or server. |
| Transparency | The model used, the mapping rules applied, and the confidence rationale are all visible to the user. |

### Key Implementation Patterns

| Pattern | Location | Detail |
|---|---|---|
| Event delegation | app.js | Single click listener on `.app-main`, `data-action` attributes |
| Step cleanup | app.js | Cleanup function for step-specific listeners |
| Initial state with structured clone | app.js | DRY reset for application state |
| Three-layer prompt assembly | transform.js | Base prompt + context prompt + mapping rules |
| Confidence mapping | transform.js | high -> confident, medium -> review-worthy, low -> problematic |
| Dual-channel encoding | preview.js, CSS | Underline color (annotation type) + background tint (confidence level) |
| Snapshot undo | model.js | Max 100 snapshots, 500ms keystroke grouping |
| API key isolation | llm.js | Module-scoped Map, never exposed via DOM, storage, or window |

### Import Formats

- Plaintext (primary)
- PAGE-XML (from coOCR HTR or other HTR systems)
- Basic TEI (for post-processing and enrichment)
- DOCX (via JSZip, text extraction)

---

## 6. Development Phases and Roadmap

### Phase 1: UI Design -- Complete

Development of the user interface and visual design. Clickable prototype that validated interaction patterns and layout.

### Phase 2: Prototype -- UI Shell Complete, Service Integration Open

Functional end-to-end walkthrough of the complete workflow.

**Completed:**
- LLM provider integration (6 providers: Gemini, OpenAI, Anthropic, DeepSeek, Qwen, Ollama)
- Three-layer prompt assembly (base + context + mapping)
- Plaintext comparison as fundamental validation
- Export as TEI-XML with attribute sanitization
- Service integration in app.js (transform, validator, schema, export wired up)

**Open:**
- View integration: editor.js, preview.js, source.js not yet wired into app.js
- DocumentModel not yet used as state source (AppState used instead of model.js)

### Phase 3: Consolidation -- Planned

Qualitative improvements, not primarily new features.

- Client-side schema validation (ODD parsing stage 2)
- teiModeller integration
- LLM-as-a-Judge for review
- XPath-based validation
- CodeMirror 6 migration (if needed)
- UI polish and error handling

### Detailed Roadmap: Phases A, B, C

**Phase A -- Validate the End-to-End Walkthrough (1-2 sessions):**

| Step | Description | Status |
|---|---|---|
| A0 | Demo data with real sources (CoReMA recipe, DEPCHA ledger entry) | Complete |
| A1 | Test real LLM transform (demo recipe + API key) | Pending |
| A2 | Integrate few-shot examples into prompt assembly | Pending |
| A3 | Document and fix breakpoints | Pending |

**Phase B -- Make the Review Workflow Experienceable (1-2 sessions):**

| Step | Description | Status |
|---|---|---|
| B1 | Wire preview.js into app.js (inline review + confidence) | Pending |
| B2 | Activate batch review (N/P/A/R/E navigation) | Pending |
| B3 | Confidence visualization (dual-channel instead of regex) | Pending |

**Phase C -- Targeted Architecture (only what the walkthrough requires):**

| Step | Description | Status |
|---|---|---|
| C1 | DocumentModel -- only if undo/redo proves necessary | Pending |
| C2 | editor.js -- only if regex XML rendering proves insufficient | Pending |
| C3 | Targeted tests for identified breakpoints | Pending |

### Strategic Decision: Walkthrough First

Rather than polishing the architecture (DocumentModel, view modules, tests), the strategy is to first prove that the core workflow functions. Architecture improvements follow only where the walkthrough reveals their necessity.

### What Is Explicitly Deferred

| Idea | Reason for deferral |
|---|---|
| DocumentModel rebuild | Prove the workflow works first |
| Test coverage to 80% | Tests for code that may still change |
| teiModeller (Phase 3) | Core workflow must stand first |
| CodeMirror 6 | Overlay editor suffices for prototype |
| Authority files and registers | Phase 3 |
| Dark mode | Nice-to-have |
| Collaboration | Enormous complexity, out of prototype scope |

---

## 7. Success Criteria

| Criterion | Meaning | Operationalization |
|---|---|---|
| Self-explanatory | Usable without external instructions | Workflow stepper, contextual hints, progressive disclosure |
| Complete workflow | Import through annotation through validation through export | Plaintext/PAGE-XML in, valid TEI-XML out |
| Downstream compatibility | Output usable in subsequent processes | Export compatible with ediarum, oXygen, GAMS |

### Target Scenario

An editor loads a demo document, configures an API key, clicks "Transform," sees the annotated result with confidence colors, reviews five annotations via batch review, validates, and exports valid TEI-XML. The entire process runs in the browser without server interaction.

---

## 8. Synergy Projects

### Direct Application

| Project | TEI Schema | Use Case |
|---|---|---|
| Schliemann Ledgers | Bookkeeping Ontology (`bk:`) | Transactions, amounts, persons |
| zbz-ocr-tei | DTA Base Format | Historical prints, structural annotation |
| DoCTA | SiCPAS, BeNASch | Medieval recipes, ingredients, measurements |
| Stefan Zweig Digital | correspDesc, TEI manuscript | Correspondences, life documents |

### Methodological Connections

| Project | Connection |
|---|---|
| coOCR HTR | Upstream tool, shared architecture principles, shared UI patterns |
| DIA-XAI | Test bed for the EQUALIS framework, expert-in-the-loop evaluation |
| Promptotyping | Development methodology |

---

## 9. Key Metrics

| Metric | Value |
|---|---|
| JavaScript modules | 14 (all implemented) |
| Modules integrated in app.js | 7 services + utilities |
| Modules not yet integrated | 3 view modules + model.js |
| Unit tests | 60 (tokenizer: 19, model: 23, validator: 18) |
| Test coverage | Approximately 21% |
| CSS | Approximately 2,645 lines |
| app.js | Approximately 1,031 lines |
| LLM providers | 6 (Gemini, OpenAI, Anthropic, DeepSeek, Qwen, Ollama) |
| Models in catalog | 17 |
| Source types | 5 (correspondence, print, recipe, bookkeeping, generic) |
| Demo datasets | 3 (recipe + ledger entry with real data, letter as placeholder) |
| User stories | 22 (10 complete, 11 in progress, 1 open) |
| Development sessions | 16 |
| Knowledge documents | 15 + KNOWLEDGE.md in repository root |

---

## References

**DH and TEI-specific:**

- Cockburn, A. (2004). *Crystal Clear.* -- Walking Skeleton
- Freeman, S. & Pryce, N. (2009). *Growing Object-Oriented Software, Guided by Tests.* -- Evolutionary Design
- Hunt, A. & Thomas, D. (1999). *The Pragmatic Programmer.* -- Tracer Bullets
- Kay, M. et al. (2016). "When (ish) is My Bus?" *CHI.* -- Uncertainty Visualization
- Klie, J.-C. et al. (2018). "The INCEpTION Platform." *COLING.* -- Human-in-the-Loop Annotation
- Montani, I. & Honnibal, M. (2018). Prodigy Annotation Tool. -- Accept/Reject/Edit, Active Learning
- TEI Consortium. *TEI P5 Guidelines.* -- TEI-XML Standard
- DeRose (2024). "Can LLMs help with XML?" Balisage 2024. DOI: 10.4242/BalisageVol29.DeRose01
- Pollin, Fischer, Sahle, Scholger, and Vogeler (2025). "When it was 2024 -- Generative AI in the Field of Digital Scholarly Editions." *ZfDG*, Heft 10. DOI: 10.17175/2025_008

**Related tools:**

- coOCR HTR: http://dhcraft.org/co-ocr-htr
- ediarum (BBAW): https://www.ediarum.org
- TEI Publisher: https://teipublisher.com
- oXygen XML Editor: https://www.oxygenxml.com
- ODD-API: https://odd-api.edirom.de
- teiCrafter repository: https://github.com/DigitalHumanitiesCraft/teiCrafter
