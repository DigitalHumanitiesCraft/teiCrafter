# teiCrafter -- Claude Code Instructions

## Language and Style
- **No emojis** -- never use emojis in outputs, files, or commit messages
- All code, UI text, and documentation in English
- Knowledge documents in pure standard Markdown (no Obsidian, no YAML frontmatter)

## Project
- Browser-based TEI-XML annotation tool for Digital Humanities
- Deployed via GitHub Pages from `/docs`
- ES6 modules without bundler, no build step
- Knowledge base in `/knowledge/` (4 consolidated documents)

## Knowledge Base Structure
| Document | Content |
|----------|---------|
| OVERVIEW.md | Vision, market analysis, research landscape, strategic positioning |
| ARCHITECTURE.md | System design, visual specification, workflow specification |
| REFERENCE.md | Module API reference, implementation status, known issues |
| DEVELOPMENT.md | Decision log, user stories, development journal, Phase 3 concepts |

## Pipeline Mode
- Node.js CLI at `pipeline.mjs`, modules under `docs/js/pipeline/`
- Modules are pure ES6 (no Node.js-specific APIs except in `pipeline.mjs`)
- Input: szd-htr Page-JSON v0.2 (`--page-json`) or METS (`--mets`, planned)
- Output: Minimal-TEI-XML (rich header, simple body, no entities)
- Tests: `node tests/pipeline.test.mjs` (50 tests)
- Plan: `Plan.md` (Phase P with checkboxes)

## Synchronization Rules
At the end of every session with code changes:
1. REFERENCE.md -- Always first. Update module matrix and implementation status
2. DEVELOPMENT.md -- For new decisions, resolved open questions, or session log entry
3. OVERVIEW.md -- Only if strategic positioning or roadmap changes
4. ARCHITECTURE.md -- Only if architecture, design, or workflow specification changes
