# teiCrafter -- Claude Code Instructions

## Language and Style
- No emojis. Never in outputs, files, or commit messages.
- No em dashes or en dashes as punctuation; use commas, colons, or parentheses.
- All code, UI text, and documentation in English.
- Knowledge documents follow the Promptotyping Documents convention: standard Markdown with YAML frontmatter (title, project, method, template, status, created, updated; plus topics, language, version, related). This replaces the former "no frontmatter" rule.

## Project
- A browser-based, lossless editor for arbitrary TEI-XML. Open an existing edition, correct it folio by folio at its natural granularity (word-level if `<w>` is present, else line-level), save it back byte-faithfully. The core is a generic, offset-true reader (raw string canonical, edits are offset splices, `serialize()` byte-identical).
- An optional LLM on-ramp ("New from text (LLM)") drafts an initial TEI from plaintext into the same editor, marked machine-generated and unreviewed (violet). The model assists; the human decides.
- Real cases: Wenzelsbibel (word-level), Jeanne Hersch / zbz-ocr-tei (line-level), Stefan Zweig / szd-htr (catalog TEI + Page-JSON, needs conversion first).
- Client-only, deployed via GitHub Pages from `/docs`. ES6 modules, no bundler, no build step.
- An independent tool, not a module of EditionCrafter.
- The earlier five-step LLM Generator app was removed in the 2026-05-30 consolidation (recoverable from git history). Do not reintroduce a stepper; both entries land in the one editor.

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
| testing.md | the test approach, engine proofs, or harness is in question |
| journal.md | how a decision came about |

## Design as Value Source
Before generating or changing UI, read `knowledge/design.md`. Its principles are binding: the AI assists and the human decides (expert-in-the-loop); categorical confidence, not numeric; AI-generated content is always marked in the violet token family (`--color-ai`); design tokens are the single source of truth (live prefix is `--color-*`/`--space-*`/`--font-*`/`--radius-*`, no raw hex in components); label consistency is a rule, not a freedom.

## Knowledge Maintenance
At the end of a session with code changes, update the affected knowledge documents:
1. `architecture.md` for component, data-flow, or implementation-status changes.
2. `journal.md` for a session entry and any new decisions.
3. `specification.md` for new decisions, resolved open questions, or requirement changes.
4. `design.md` only if the visual or interaction layer changed.

Keep `version:` consistent repo-wide. Distill: one function per document, cross-link via `related:` rather than repeat.
