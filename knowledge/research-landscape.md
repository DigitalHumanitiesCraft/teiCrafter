# LLM-assisted TEI annotation: a 2025–2026 research landscape for teiCrafter

**The intersection of large language models and TEI-XML encoding has emerged as a distinct research area in 2025, but remains dominated by a small number of groups, lacks standardized evaluation protocols, and has not yet produced a tool that combines ODD-guided schema validation with LLM-assisted annotation in a browser-based environment.** This survey covers three thematic axes—LLM-assisted TEI annotation, validation of LLM-generated outputs, and TEI/ODD modeling workflows—drawing on **peer-reviewed publications, preprints, conference presentations, and tool releases from 2025–2026 only**. The findings confirm that teiCrafter occupies a genuinely novel niche: while individual components (LLM-to-TEI generation, schema validation, human-in-the-loop review) each have growing literature support, no existing system integrates all three with a layered prompt architecture. The landscape offers both strong positioning opportunities and clear technical precedents to build upon.

---

## Axis 1: LLM-assisted TEI/XML annotation is growing fast but concentrated in few hands

### The foundational survey

The single most important reference for teiCrafter's related work section is **Pollin, Fischer, Sahle, Scholger, and Vogeler (2025), "When it was 2024 – Generative AI in the Field of Digital Scholarly Editions,"** published in *Zeitschrift für digitale Geisteswissenschaften* (ZfDG), Heft 10 (DOI: 10.17175/2025_008). This peer-reviewed article identifies **eight key application areas** for LLMs in digital scholarly editing—from transcription and OCR/HTR post-processing to markup generation, NER, normalization, and summarization—based on the DHd 2024 workshop "Call for Experiments" organized by the IDE. It references teiCrafter explicitly and calls for standardized workflow orchestration and evaluation protocols. Any grant proposal or paper building on teiCrafter should cite this as the primary state-of-the-art survey.

### Peer-reviewed and conference publications

Beyond the Pollin et al. survey, **2025 saw at least five peer-reviewed or conference-presented studies directly testing LLM-to-TEI encoding**:

- **De Cristofaro and Zilio (AIUCD 2025, Verona)** compared ChatGPT-4 and Claude 3.5 Sonnet for automated XML-TEI encoding of archival correspondence in the PubCiNET project. Claude produced more valid files initially; ChatGPT required more iterative correction. Both models efficiently extracted metadata but differed in recognizing in-text information. (URL: aiucd2025.dlls.univr.it/assets/pdf/papers/94.pdf)

- **Strutz, Scholger, and Vogeler (TEI 2025, Kraków)** presented "Beyond Rule-Based Processing: LLM-Assisted TEI Encoding of Editorial Interventions in Historical Correspondence"—a long paper directly from the Graz teiCrafter team extending the approach to editorial interventions.

- **Beshero-Bondar, Bills, and Fisher (TEI 2025)** from Penn State Erie asked "Can we make an AI respect TEI XML?" using a small-scale explainable AI model, offering a complementary approach to teiCrafter's LLM-based method.

- **De Cristofaro, Leboffe, and Zilio (TEI 2025)** extended LLM-based TEI encoding to Spanish Golden Age theatre, demonstrating cross-genre applicability.

- **Janès, Bénière, Clérice, and Sagot (TEI 2025, INRIA)** developed a TEI-based layout annotation system for deeper automatic document encoding, bridging document layout analysis and TEI.

The **TEI 2025 conference** ("New Territories," Kraków, September 2025) was the richest single venue, with at least six presentations touching on LLM-assisted or automated TEI encoding.

### NER on historical texts with LLMs

Named entity recognition in historical texts—a core annotation task for TEI digital editions—has a solid 2025 evidence base:

- **Tudor, Megyesi, and Östling (LaTeCH-CLfL at NAACL 2025)** tested zero-shot LLM prompting for NER in historical texts using the HIPE-2022 dataset, finding reasonable performance but not matching supervised models (URL: aclanthology.org/2025.latechclfl-1.19.pdf).

- **Zhang et al. (arXiv:2508.18090, August 2025)** explored zero-shot and few-shot LLM prompting for historical NER, similarly finding that LLMs achieve strong but not state-of-the-art results.

- A multimodal LLM study **(arXiv:2504.00414, April 2025)** demonstrated that models like Gemini 2.0 Flash can perform OCR, OCR post-correction, and NER on historical documents in an integrated end-to-end pipeline, achieving **0.84% CER** with post-correction—relevant to the early stages of the transcription-to-TEI pipeline.

- **Lin et al. (2025, *International Journal of Geographical Information Science*)** fine-tuned Qwen 2.5-7B with LoRA for nested NER in Chinese historical gazetteers, and a study in ***npj Heritage Science*** (Nature, 2025) fine-tuned four LLMs for NER on the Twenty-Four Histories.

### Structured XML output generation

The technical challenge of getting LLMs to produce well-formed, schema-conformant XML is addressed by several 2025 publications outside the DH community:

- **Wang, Shen, and Mishra et al. (EMNLP 2025 Industry Track), "SLOT: Structuring the Output of Large Language Models,"** introduces the SLOTBENCH benchmark for converting textual LLM responses into structured formats including XML (URL: aclanthology.org/2025.emnlp-industry.32.pdf).

- **Geng et al. (arXiv:2501.10868, January 2025)** benchmarked constrained decoding frameworks (Guidance, Llama.cpp, Outlines) for structured output generation, providing technical foundations for schema-conformant XML output.

- **StructEval (arXiv:2505.20139, May 2025)** evaluates LLMs on generating JSON, XML, LaTeX, and HTML, offering evaluation methodology applicable to TEI-XML.

### German-language DH context

**DHd 2025** (Bielefeld, March 2025) included several relevant presentations: Oberbichler, Pollin, Rastinger et al. on "More than Chatbots: Multimodal Large Language Models in geisteswissenschaftlichen Workflows"; Will, Kamlah et al. on "eScriptorium meets LLMs" (integrating LLMs with HTR platforms); and Näger and Eickhoff on LLM prompt engineering for archives. The opening keynote by **Mark Dingemanse** addressed "What makes LLMs so irresistible?" advocating critical AI literacy.

### Tools and frameworks

Active tools in this space include **teiCrafter itself** (as a Custom GPT and documented approach at digedtnt.github.io/teiCrafter), **teiModeler** for text modeling guidance, and the **DH Assistant** (Moehrke, 2025). The University of Sheffield's **"Shifting the Paradigm: Machine-Assisted Digital Scholarly Editing"** PhD project (ongoing 2025) is exploring ML/AI-assisted scholarly editing more broadly. **DeRose's Balisage 2024 paper** ("Can LLMs help with XML?", DOI: 10.4242/BalisageVol29.DeRose01) remains the most-cited foundational reference in 2025 TEI+AI literature, establishing baseline capabilities and limitations.

### Gaps teiCrafter can address in Axis 1

No systematic benchmark for LLM-generated TEI-XML quality exists. No peer-reviewed tool paper has been published for teiCrafter. Most work uses proprietary LLMs (GPT-4, Claude); **open-source/local LLM evaluation for TEI encoding is largely absent**. No study has applied fine-tuning specifically for TEI-XML output. The topic lives primarily in DH venues—no ACL/NLP venue paper directly addresses LLM-to-TEI conversion. Browser-based LLM-assisted TEI annotation environments remain **essentially unoccupied** beyond teiCrafter.

---

## Axis 2: Validation literature is rich but ignores scholarly annotation entirely

### LLM-as-a-Judge has matured rapidly

The LLM-as-a-Judge paradigm—using one LLM to evaluate another's output—has **extensive 2025 literature support**, with two comprehensive surveys providing architectural guidance:

- **Gu et al. (arXiv:2411.15594, updated through October 2025)** survey how to build reliable LLM-as-a-Judge systems, covering consistency improvement, bias mitigation, and adaptation to diverse evaluation scenarios.

- **Li, Jiang, Huang et al. (2025)** at llm-as-a-judge.github.io offer a complementary framework covering what, how, and where to deploy judge models, with analysis of limitations.

Two **ICLR 2025 papers** establish key benchmarks: **JudgeBench** (OpenReview: G0dksFayVq) reveals that even GPT-4o performs only slightly better than random on hard evaluation cases, while **JudgeLM** demonstrates that fine-tuned 7B–33B parameter models can achieve >90% agreement with teacher judges using swap augmentation and reference support.

A critical finding for teiCrafter comes from **IUI 2025 (ACM)**: in domain-specific tasks (dietetics, mental health), subject-matter experts agreed with LLM judges only **64–68%** of the time—strong evidence that for specialized annotation like TEI-XML encoding, human expert review remains essential. **Li et al. (arXiv:2502.01534)** expose "preference leakage"—contamination when the same or related LLMs generate and evaluate content—supporting teiCrafter's design of using different models for generation versus evaluation.

### Epistemic uncertainty and confidence calibration

The question of whether LLMs can reliably signal their own uncertainty is directly relevant to teiCrafter's confidence-based routing to human review:

- **Lee, Hwang, Kim, Park, and Jung (NAACL 2025, pp. 8962–8984)** introduced the EMBER benchmark showing all tested LLM-judges exhibit **negative bias toward epistemic markers**—penalizing outputs that honestly express uncertainty. This is a critical design consideration: if teiCrafter's judge penalizes uncertain annotations, it creates perverse incentives.

- A **NeurIPS 2025 submission** (OpenReview: 9Jq7wNrpUI) on "Uncovering Confident Failures" introduces epistemic uncertainty as semantic disagreement across model ensembles, showing that combining aleatoric and epistemic uncertainty improves correctness prediction—directly relevant to the "plausible-looking but incorrect TEI markup" problem.

- **"The Illusion of Certainty" (arXiv:2511.04418, November 2025)** demonstrates that uncertainty quantification methods break down when both types of uncertainty coexist, meaning confidence scores must be interpreted carefully in TEI annotation where genuine ambiguity is common.

- The **MUSE framework (EMNLP 2025, pp. 30481–30492)** uses Jensen-Shannon Divergence to identify well-calibrated LLM subsets, and **Ghasemabadi and Niu (arXiv:2512.20578)** propose "Gnosis," a lightweight ~5M parameter self-awareness mechanism that outperforms billion-parameter reward models for correctness prediction.

For practical confidence calibration, **Hovsepian, Liu, and Murugesan (GenAIECommerce 2024/2025, Amazon Science)** develop logit-based calibration pipelines where calibration error-based sampling reduces error by **46%** and cost-aware cascading ensemble policies route uncertain cases efficiently. **Mavi et al. (arXiv:2511.07364, November 2025)** show that stepwise self-evaluation outperforms holistic scoring by up to **15% relative AUROC increase** in multi-step tasks—directly applicable since TEI annotation involves sequential multi-step decisions.

### Human-in-the-loop validation workflows

Several 2025 studies validate the architectural pattern teiCrafter employs—LLM pre-generation with human verification:

- A **multicenter clinical study (SSRN, 2025)** found that LLM-assisted hybrid prescreen-and-verify workflows reduced audit time from **median 51 seconds to 11 seconds** while maintaining accuracy—directly paralleling teiCrafter's approach.

- **AIANO (arXiv:2602.04579, 2025)** is the closest architectural parallel to teiCrafter: a browser-based annotation tool integrating LLM assistance with human oversight for information retrieval tasks, where **93.3%** of users found AI assistance useful.

- **CHAIRA (arXiv:2409.14223, presented 2025)** demonstrates that two-stage few-shot chain-of-thought prompting in co-annotation settings nearly matches human-human agreement.

- A **CEUR-WS study (Vol. 4006, 2025)** comparing human and LLM evaluators found that human reviewers deliver more discerning evaluations while LLMs are permissive and miss subtle flaws—confirming the necessity of human review in teiCrafter's pipeline.

### Constrained decoding and structured output validation

The technical infrastructure for ensuring LLMs produce schema-conformant output has advanced significantly:

- **Park, Zhou, and D'Antoni (ICML 2025)** achieve **17.71× faster** offline preprocessing for grammar-constrained decoding, potentially enabling real-time TEI-XML grammar enforcement.

- **Schmidt and Cimiano (Frontiers in AI, Vol. 7, January 2025, DOI: 10.3389/frai.2024.1406857)** validate grammar-constrained decoding for structured information extraction from scholarly text.

- However, **Schall and de Melo (RANLP 2025, Varna)** reveal a crucial finding: constrained decoding can **degrade task performance**, with fundamental divergence between base and instruction-tuned models under structural constraints. This supports teiCrafter's approach of post-generation validation rather than constrained decoding alone.

- **Li et al. (ICLR 2025), "IterGen,"** introduce iterative structured generation with backtracking and KV-cache reuse, enabling correction of structured output errors without restarting—a technique that could apply to TEI-XML correction loops.

Open-source tools supporting this space include **DeepEval** (deepeval.com, ~500K monthly downloads), **Langfuse** (langfuse.com, with JSON Schema enforcement since November 2025), **Guardrails AI** (with re-ask patterns on validation failure), and **Outlines** (dottxt, supporting regex/JSON Schema/CFG-based constrained decoding).

### Gaps teiCrafter can address in Axis 2

**No 2025 work addresses LLM-generated TEI-XML validation specifically.** JSON dominates the structured output validation literature; XML is underrepresented. Schema-guided validation for complex nested markup (XSD/RelaxNG) of LLM outputs is essentially unstudied. Confidence calibration for multi-label structured annotation tasks (versus classification) is underdeveloped. No publication examines how layered prompt architecture design affects annotation quality. The intersection of LLM evaluation methodology and digital humanities annotation workflows remains a **significant gap**.

---

## Axis 3: TEI modeling infrastructure is evolving, but no tool merges ODD with LLM assistance

### TEI Guidelines and Consortium developments in 2025

The TEI Consortium released three significant versions in 2025. **TEI P5 v4.9.0** (January 24, 2025) introduced the new `constraintDecl` element for specifying Schematron query language binding in ODDs—directly affecting schema generation pipelines. **TEI P5 v4.10.0** ("The Olinguito Release," August 15, 2025; release technicians: Bermúdez Sabel, Bleeker, O'Connor) revised the Dedication/Preface for the first time since the 2007 P5 launch and added new dictionary encoding examples from TEI Lex-0. Two subsequent patch releases (v4.10.1 and v4.10.2, August–September 2025) fixed Schematron constraint and content model bugs, illustrating the criticality of content model correctness in ODD processing.

The **TEI Stylesheets Task Force** (chaired by Syd Bauman, with Martin Holmes, Helena Bermúdez Sabel, and David Maus) is actively developing a new **XSLT 3-only ODD processor** that will separate ODD processing from Guidelines representation, support ODD chaining and PureODD, and produce a new testing suite. This is **directly critical** for teiCrafter's schema generation pipeline. Additionally, a **TEI Lite 2.0 Working Group** is developing a new version of the TEI Lite customization, which will likely become a key starter ODD for many projects.

### New tools reshape the TEI editing landscape

The most significant new tool announcement is **JinnTap** (Meier, Windauer, Wicentowski; e-editiones), a browser-based WYSIWYM editor for TEI-XML demonstrated at TEI 2025 and coming as part of TEI Publisher 10. JinnTap preserves XML structure directly using custom HTML elements and is available as an npm package (@jinntec/jinn-tap). It is **teiCrafter's closest competitor/comparator** as a browser-based TEI editor, though it lacks LLM integration and ODD-guided annotation features.

**ODD-API** (Stadler, Ferger, Kepper, Viglianti; Paderborn University) is a REST interface for programmatic querying of ODD schema definitions, supporting both TEI and MEI. Available at github.com/Edirom/odd-api and odd-api.edirom.de, this tool is **extremely relevant** to teiCrafter as a potential upstream data source for schema-aware features. **Scholarly XML** (Viglianti, University of Maryland), a VS Code extension with RELAX NG and Schematron validation plus schema-aware suggestions, won the 2024 Rahtz Prize and is adding Schematron validation features in 2025. **LEAF-Writer** (Brown, Cummings, Frizzera, Ilovan, Jakacki) won the **2025 Rahtz Prize** as a collaborative TEI editing environment and is another direct web-based comparator.

Additional tools include **TEI Publisher 10 / Jinks** (e-editiones, active development through October 2025 at github.com/eeditiones/jinks), **NormaTEI** (CNR Italy, presented at TEI 2025) for encoding uniformity control, and **Roma** at roma.tei-c.org, which remains the canonical ODD customization tool without a major 2025 update.

### TEI 2025 conference contributions on modeling and ODD

The TEI 2025 conference yielded several ODD-specific contributions:

- **Bauman, Bermúdez Sabel, and Holmes** presented "Differentiating ODDs"—addressing mechanics of how ODDs differ and can be compared.
- **Engler, Mörth, Procházka, Rausch-Supola, and Schopper (Austrian Academy of Sciences)** demonstrated ODD chaining for Arabic dialect dictionaries—an advanced customization technique teiCrafter should support.
- **Turska (e-editiones)** presented "Haute couture for the masses," likely discussing accessible ODD customization.
- **Bermúdez Sabel and Turska** ran workshops on the TEI Processing Model and Jinks/TEI Publisher 10.
- **Boot (Huygens Institute)** proposed "An XML-based edition publication model."
- **Kollatz (Academy of Sciences Mainz)** presented "LEGOstyle: Building modular, flexible Editions with TEI."
- **Quenouille (Leipzig Academy)** discussed encoding complexity in the Forschungsportal BACH project.

### German-language DH context

**DHd 2025** (Bielefeld) included **Ries, Andrews, Rosendahl, Sahle, Viehhauser, Vogeler, and Hegel** on "Critical AI in der Digitalen Editorik"—a panel directly examining AI in digital scholarly editing. Thomas, Hofmann-Polster, and Häfner presented large-scale TEI-XML encoding of 2,400 letters from Goethe's correspondence. Dogunke discussed modular research infrastructure for digital editions at ThULB. Neuber, Henny-Krahmer, and Scholger reflected on RIDE and digital edition reviewing standards. **DHd 2026** ("Nicht nur Text, nicht nur Daten," Vienna) has published its CfP and represents the next major German-language DH venue.

### Gaps teiCrafter can address in Axis 3

**No 2025–2026 tool combines ODD-based schema-guided editing with LLM assistance**—this is teiCrafter's clearest differentiator. No publication addresses AI-assisted ODD customization (using LLMs to help *design* schemas rather than merely *apply* them). Roma has no announced successor. While ODD-API provides programmatic schema access, no system uses such access to dynamically guide LLM annotation. The new Stylesheets Task Force ODD processor is still in development, creating an opportunity for teiCrafter to adopt it early.

---

## Cross-cutting gaps and strategic positioning for teiCrafter

Five major gaps emerge across all three axes that teiCrafter is uniquely positioned to address.

First, **no integrated system exists** that combines LLM-assisted TEI generation, ODD-guided schema validation, LLM-as-Judge quality checking, and human-in-the-loop review in a single browser-based environment. The individual components each have 2025 literature support, but their integration is novel.

Second, **no benchmark or evaluation protocol** for LLM-generated TEI-XML quality has been published. The field relies on ad hoc assessments. A standardized benchmark measuring schema conformance, semantic accuracy, and editorial fidelity would be a significant contribution.

Third, **confidence calibration for structured annotation** (as opposed to classification or QA) is underdeveloped. teiCrafter's element-level confidence scoring and threshold-based routing to human review addresses a gap the uncertainty quantification literature has identified but not solved for annotation contexts.

Fourth, **the asymmetry between LLM generation quality and self-assessment quality** has been studied generically (the "confident failures" problem) but never in the context of TEI-XML annotation, where plausible-looking but semantically incorrect markup is the primary risk.

Fifth, **open-source and local LLM evaluation** for TEI encoding is nearly absent—most studies use GPT-4 or Claude. Testing open models would address reproducibility and cost concerns important to the DH community.

The literature confirms teiCrafter's core design decisions: using separate models for generation and evaluation (supported by preference leakage findings), employing post-generation schema validation rather than constrained decoding alone (supported by evidence of performance degradation under constraints), implementing stepwise rather than holistic quality assessment (supported by multi-step evaluation research), and maintaining human review as the final arbiter (supported by the 64–68% expert-LLM agreement findings). The project should position itself not just as a tool but as a **methodological contribution** bridging the NLP evaluation literature and digital humanities editorial practice.

---

## Summary of key references by type

**Peer-reviewed journal articles (2025):** Pollin et al. in ZfDG; Lin et al. in *IJGIS*; automatic NER in *npj Heritage Science*; Schmidt & Cimiano in *Frontiers in AI*

**Conference papers, peer-reviewed (2025):** De Cristofaro & Zilio at AIUCD; Tudor et al. at LaTeCH-CLfL/NAACL; Wang et al. SLOT at EMNLP Industry; JudgeBench and JudgeLM at ICLR; Lee et al. EMBER at NAACL; Park et al. at ICML; Schall & de Melo at RANLP; Li et al. IterGen at ICLR; IUI 2025 LLM-as-Judge limitations study

**Conference presentations (2025):** Strutz/Scholger/Vogeler, Beshero-Bondar et al., De Cristofaro/Leboffe/Zilio, Janès et al., Stadler et al. ODD-API, Bauman et al. Differentiating ODDs at TEI 2025; Ries et al. Critical AI, multiple DHd 2025 presentations

**Preprints (2025):** Zhang et al. arXiv:2508.18090; multimodal LLMs arXiv:2504.00414; Geng et al. arXiv:2501.10868; StructEval arXiv:2505.20139; Gu et al. survey arXiv:2411.15594; Li et al. preference leakage arXiv:2502.01534; epistemic uncertainty arXiv:2506.07448, arXiv:2511.03166, arXiv:2511.04418; Mavi et al. arXiv:2511.07364; Ghasemabadi & Niu arXiv:2512.20578; AIANO arXiv:2602.04579; MUSE at EMNLP 2025

**Tool announcements and releases (2025):** JinnTap (e-editiones); ODD-API (Paderborn); TEI Publisher 10/Jinks; TEI P5 v4.9.0–v4.10.2; Scholarly XML updates; DeepEval; Langfuse; Guardrails AI; Outlines

**Foundational 2024 reference widely cited in 2025:** DeRose, "Can LLMs help with XML?" at Balisage 2024 (DOI: 10.4242/BalisageVol29.DeRose01)