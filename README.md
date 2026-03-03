# teiCrafter

**LLM-assisted TEI-XML annotation for Digital Humanities**

**[Try the live demo](https://digitalhumanitiescraft.github.io/teiCrafter/)** -- no installation required, runs entirely in the browser.

> **Research Preview** -- This is an active research prototype developed using [Promptotyping](https://github.com/DigitalHumanitiesCraft) methodology. It demonstrates the feasibility of LLM-assisted scholarly annotation and is under active development. Not intended for production use.

[![License: CC BY 4.0](https://img.shields.io/badge/License-CC_BY_4.0-lightgrey.svg)](https://creativecommons.org/licenses/by/4.0/)
[![GitHub Pages](https://img.shields.io/badge/demo-GitHub_Pages-blue)](https://digitalhumanitiescraft.github.io/teiCrafter/)

---

## Overview

teiCrafter is a browser-based annotation environment that transforms plaintext into semantically annotated [TEI-XML](https://tei-c.org/) using Large Language Models. It addresses a persistent gap in the Digital Humanities tool landscape: **no existing system combines TEI annotation, LLM-assisted markup generation, and human expert review in a single, infrastructure-free interface.**

The tool occupies a specific position in the digital scholarly editing pipeline:

```
Image --> coOCR HTR --> teiCrafter --> ediarum / GAMS / Publication
          (Transcription)  (Annotation &      (Deep encoding &
                            Modeling)           Publication)
```

teiCrafter bridges the gap between automated text recognition and manual deep encoding. It produces valid, schema-conformant TEI-XML that serves as a qualified starting point for further editorial work in environments such as ediarum or oXygen.

### Epistemic Foundation

The design rests on the principle of **epistemic asymmetry** (adapted from coOCR HTR): LLMs generate plausible annotations but cannot reliably assess their own correctness. For TEI annotation, this problem is compounded because annotation decisions are often interpretive, schema conformance does not guarantee semantic accuracy, and authority file assignments require contextual knowledge. Human expertise is therefore integrated as a structurally necessary component, not an optional quality check.

---

## Key Features

| Feature | Description |
|---------|-------------|
| **Five-step guided workflow** | Import, Mapping, Transform, Validate, Export -- with stepper navigation |
| **Six LLM providers** | Google Gemini, OpenAI, Anthropic, DeepSeek, Qwen, Ollama (local) |
| **Three-layer prompt architecture** | Base rules + source context + user-defined mapping rules |
| **Schema-guided output** | DTABf JSON schema profile constrains LLM-generated markup |
| **Four-level validation** | Well-formedness, plaintext preservation, schema conformance, review completeness |
| **Confidence visualization** | Three-tier system (high / check-worthy / problematic) with dual-channel encoding |
| **Multi-format import** | Plaintext, Markdown, XML, DOCX (via JSZip) |
| **Export with cleanup** | Removes machine-generated attributes, preserves editorial decisions |
| **Zero infrastructure** | No server, no account, no installation -- runs entirely in the browser |
| **Bring Your Own API Key** | No vendor lock-in; 17 models across 6 providers |

---

## Quick Start

1. Open [teiCrafter on GitHub Pages](https://digitalhumanitiescraft.github.io/teiCrafter/)
2. **Import** a plaintext file or select a demo dataset (medieval recipe or 1718 bookkeeping account)
3. **Configure mapping** -- select a source type and adjust annotation rules
4. **Set up LLM** -- click the settings icon, choose a provider, enter your API key, and test the connection
5. **Transform** -- the LLM annotates your text according to the mapping rules
6. **Validate** -- review well-formedness, plaintext preservation, and schema conformance
7. **Export** -- download the annotated TEI-XML or copy to clipboard

For demo datasets, no API key is required -- expected output is loaded directly.

---

## Architecture

teiCrafter is built as a client-only single-page application using vanilla ES6 modules with no build step, no framework, and zero NPM dependencies.

```
docs/
├── index.html              Entry point (GitHub Pages)
├── css/style.css           Visual design system (~2,645 lines)
├── js/
│   ├── app.js              Application shell, 5-step stepper
│   ├── model.js            Reactive document model (4 state layers)
│   ├── tokenizer.js        XML state-machine tokenizer
│   ├── editor.js           Overlay XML editor
│   ├── preview.js          Interactive preview with review workflow
│   ├── source.js           Source panel (plaintext / facsimile)
│   ├── services/
│   │   ├── llm.js          Multi-provider LLM service (6 providers)
│   │   ├── transform.js    Three-layer prompt assembly
│   │   ├── validator.js    Four-level validation engine
│   │   ├── schema.js       ODD-based schema guidance
│   │   ├── export.js       Export with attribute cleanup
│   │   └── storage.js      localStorage wrapper
│   └── utils/
│       ├── constants.js    Enums, configurations, tag definitions
│       └── dom.js          DOM utilities
├── schemas/dtabf.json      DTABf schema profile (30+ elements)
├── data/demo/              Demo datasets with expected outputs
└── tests/                  Unit tests (60 tests)
```

### Technology Decisions

| Decision | Rationale |
|----------|-----------|
| No framework | Reduces complexity, maximizes longevity, avoids dependency churn |
| ES6 modules (native) | No bundler needed, direct browser execution |
| EventTarget for state | Native API, DevTools integration, no library required |
| Event delegation | Single click listener, zero memory leaks |
| CSS custom properties | 98 design tokens, theming without preprocessor |
| Fetch API only | No HTTP library dependencies |
| Module-scoped API keys | Never on window, DOM, localStorage, or cookies |

For the complete technical specification, see the [knowledge base](knowledge/).

---

## LLM Integration

teiCrafter supports six LLM providers with a unified interface:

| Provider | Default Model | Local |
|----------|--------------|:-----:|
| Google Gemini | gemini-2.5-flash | |
| OpenAI | gpt-4.1-mini | |
| Anthropic | claude-sonnet-4-5 | |
| DeepSeek | deepseek-chat | |
| Qwen (Alibaba) | qwen-plus | |
| Ollama | llama3.3 | yes |

API keys are stored exclusively in module-scoped memory during the session. They are never persisted to disk, DOM, or browser storage.

### Three-Layer Prompt Architecture

1. **Base layer** -- Generic TEI-XML annotation rules: text preservation, precision over recall, confidence attributes, output format constraints
2. **Context layer** -- Source type (correspondence, bookkeeping, recipe, etc.), language, epoch, project name
3. **Mapping layer** -- User-defined annotation rules specifying which TEI elements to apply and when

---

## Validation

teiCrafter implements four of five planned validation levels:

| Level | Check | Status |
|-------|-------|--------|
| 1 | XML well-formedness (DOMParser) | Implemented |
| 2 | Plaintext preservation (word similarity, 95% threshold) | Implemented |
| 3 | Schema conformance (element/attribute/parent-child against DTABf profile) | Implemented |
| 4 | Review completeness (unreviewed annotation count) | Implemented |
| 5 | XPath-based custom rules | Planned (Phase 3) |

---

## Development Status

**Phase 2 (Prototype): Core workflow complete, view integration pending.**

- All 14 JavaScript modules implemented
- 7 service/utility modules integrated into the application shell
- 3 view modules (editor, preview, source) implemented but not yet wired
- 60 unit tests across tokenizer, document model, and validator
- 2 demo datasets with real historical sources (CoReMA medieval recipe, DEPCHA 1718 account)

### Roadmap

**Phase A -- Validate the walking skeleton (next)**
- Test end-to-end LLM transform with real API keys
- Add few-shot examples to prompt assembly (highest single lever for quality)
- Document and fix breakpoints

**Phase B -- Make the review workflow tangible**
- Integrate preview.js for inline review with confidence visualization
- Activate batch review (keyboard navigation)

**Phase C -- Targeted architecture improvements**
- Wire DocumentModel if undo/redo proves necessary
- Integrate editor.js if regex-based rendering proves insufficient
- Write targeted tests for identified breakpoints

**Phase 3 -- Consolidation (future)**
- teiModeller: LLM-assisted TEI modeling advisor
- TEI Guidelines distillation pipeline
- LLM-as-a-Judge for automated review
- Client-side ODD parsing (Stage 2)
- XPath-based validation

---

## Research Context

The intersection of LLMs and TEI-XML encoding emerged as a distinct research area in 2025. A comprehensive survey by Pollin, Fischer, Sahle, Scholger, and Vogeler (2025) in *Zeitschrift fur digitale Geisteswissenschaften* identifies eight key application areas for LLMs in digital scholarly editing and references teiCrafter explicitly.

Key findings from the 2025-2026 research landscape:

- **No integrated system exists** that combines LLM-assisted TEI generation, ODD-guided schema validation, and human-in-the-loop review in a browser-based environment
- **No benchmark** for LLM-generated TEI-XML quality has been published
- **Confidence calibration** for structured annotation (vs. classification) remains underdeveloped
- **Post-generation validation** outperforms constrained decoding alone (Schall and de Melo, RANLP 2025)
- **Expert-LLM agreement** on domain-specific tasks reaches only 64-68% (IUI 2025), confirming the necessity of human review

For the full research survey with citations, see [knowledge/OVERVIEW.md](knowledge/OVERVIEW.md).

---

## Synergy Projects

| Project | Connection |
|---------|-----------|
| [coOCR HTR](http://dhcraft.org/co-ocr-htr) | Upstream tool -- transcription feeds into teiCrafter annotation |
| Schliemann Account Books | Bookkeeping ontology, transaction annotation |
| zbz-ocr-tei | DTA base format, historical print annotation |
| DoCTA (CoReMA) | Medieval recipe annotation (SiCPAS, BeNASch schemas) |
| Stefan Zweig Digital | Correspondence, manuscript annotation |
| DIA-XAI | EQUALIS framework, expert-in-the-loop evaluation |

---

## Knowledge Base

The project maintains a consolidated knowledge base in [`knowledge/`](knowledge/) comprising four documents:

| Document | Content |
|----------|---------|
| [OVERVIEW.md](knowledge/OVERVIEW.md) | Vision, market analysis, research landscape, strategic positioning |
| [ARCHITECTURE.md](knowledge/ARCHITECTURE.md) | System design, visual specification, workflow specification |
| [REFERENCE.md](knowledge/REFERENCE.md) | Module API reference, implementation status, known issues |
| [DEVELOPMENT.md](knowledge/DEVELOPMENT.md) | Decision log, user stories, development journal, Phase 3 concepts |

---

## Local Development

No build step is required. Serve the `docs/` directory with any static file server:

```bash
# Python
python -m http.server 8000 -d docs

# Node.js (npx)
npx serve docs

# PHP
php -S localhost:8000 -t docs
```

Open `http://localhost:8000` in a modern browser (ES6 module support required).

### Running Tests

Open `docs/tests/test-runner.html` in a browser. The test suite covers:
- XML tokenizer (19 tests)
- Document model (23 tests)
- Validator (18 tests)

---

## Contributing

This is a research prototype under active development. Contributions, feedback, and collaboration inquiries are welcome. Please open an issue to discuss changes before submitting a pull request.

---

## Citation

If you use teiCrafter in academic work, please cite:

> Pollin, C., Fischer, F., Sahle, P., Scholger, M., & Vogeler, G. (2025). When it was 2024 -- Generative AI in the Field of Digital Scholarly Editions. *Zeitschrift fur digitale Geisteswissenschaften*, 10. DOI: [10.17175/2025_008](https://doi.org/10.17175/2025_008)

---

## License

This work is licensed under a [Creative Commons Attribution 4.0 International License](https://creativecommons.org/licenses/by/4.0/).

You are free to share and adapt this material for any purpose, provided you give appropriate credit.

---

## Disclaimer

**Research Preview** -- teiCrafter was developed using Promptotyping methodology as part of the [Digital Humanities Craft](https://github.com/DigitalHumanitiesCraft) initiative. It is a research prototype intended to demonstrate the feasibility of LLM-assisted TEI-XML annotation. The tool has not been evaluated in production settings. LLM-generated annotations require expert review before use in scholarly publications. The authors make no warranty regarding the correctness, completeness, or fitness for purpose of the generated output.

API keys entered into the application are stored only in browser memory for the duration of the session and are never transmitted to any server other than the selected LLM provider.
