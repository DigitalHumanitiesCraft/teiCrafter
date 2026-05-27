# teiCrafter -- Claude Code Instructions

## Language and Style
- No emojis. Never in outputs, files, or commit messages.
- No em dashes or en dashes as punctuation; use commas, colons, or parentheses.
- All code, UI text, and documentation in English.
- Knowledge documents follow the Promptotyping Documents convention: standard Markdown with YAML frontmatter (title, project, method, template, status, created, updated; plus topics, language, version, related). This replaces the former "no frontmatter" rule.

## Project
- Browser-based TEI working environment with two paths: a Generator path (LLM-assisted transformation of plaintext to annotated TEI) and an Editor path (schema-aware editing of existing TEI editions, index management, StandOff apparatus, project-specific authoring views; LLM optional).
- Current focus: the Editor path, driven by its first use case, the Wenzelsbibel (Codex 2759).
- Client-only, deployed via GitHub Pages from `/docs`. ES6 modules, no bundler, no build step.
- An independent tool, not a module of EditionCrafter.

## Knowledge Base (`knowledge/`)
Function-separated per the Promptotyping convention. Read `INDEX.md` first; it carries the document map and the glossary.

| Document | Read first when |
|----------|-----------------|
| project.md | positioning or identity is unclear |
| data.md | formats or test material are in question |
| specification.md | a requirement or decision is at stake |
| user-stories.md | a usage scenario is unclear |
| architecture.md | components, data flow, or implementation status |
| design.md | UI, visual, or interaction work (the aesthetic value source) |
| journal.md | how a decision came about |

## Design as Value Source
Before generating or changing UI, read `knowledge/design.md`. Its principles are binding: the AI assists and the human decides (expert-in-the-loop); categorical confidence, not numeric; AI-generated content is always marked in the violet token family; design tokens (`--tc-*`) are the single source of truth, no raw hex in components; label consistency is a rule, not a freedom.

## Pipeline Mode
- Node.js CLI at `pipeline.mjs`, modules under `docs/js/pipeline/` (pure ES6, Node and browser).
- Input: SZD-HTR Page-JSON v0.2 (`--page-json`) or METS (`--mets`, planned). Output: minimal TEI-XML (rich header, simple body, no entities). Deterministic only, no LLM.
- Tests: `node tests/pipeline.test.mjs`. Plan: `Plan.md` (Phase P).

## Knowledge Maintenance
At the end of a session with code changes, update the affected knowledge documents:
1. `architecture.md` for component, data-flow, or implementation-status changes.
2. `journal.md` for a session entry and any new decisions.
3. `specification.md` for new decisions, resolved open questions, or requirement changes.
4. `design.md` only if the visual or interaction layer changed.

Keep `version:` consistent repo-wide. Distill: one function per document, cross-link via `related:` rather than repeat.
