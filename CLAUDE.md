# teiCrafter -- Claude Code Instructions

## Language and Style
- No emojis. Never in outputs, files, or commit messages.
- No em dashes or en dashes as punctuation; use commas, colons, or parentheses.
- All code, UI text, and documentation in English.
- Commit messages in English as well; this repository overrides the global default of German commit messages.
- Code comments: compact, descriptive, plain English, only where the code cannot speak for itself. State the constraint or intent, not implementation history; no dates, decision references, or restoration instructions (that context belongs in knowledge/journal.md).
- UI and public-facing text (landing, About, README, tooltips, status lines): descriptive and factual, written for researchers. Full sentences that state what the tool does and what a property concretely means; no slogans, no marketing claims, no metaphors, no undefined shorthand ("by construction", "proof harness"). A property that cannot be explained where it is claimed, or linked to its explanation, is left out. Do not present a current configuration as identity (e.g. "no LLM" while LLM features are planned).
- Knowledge documents follow the Promptotyping Documents convention: standard Markdown with YAML frontmatter (title, project, method, template, status, created, updated; plus topics, language, version, related). This replaces the former "no frontmatter" rule.
- Knowledge documents describe patterns, decisions, constraints and mechanisms, not incidental surface details the artifact shows on sight (a count of cards, an enumeration of visible sections): those go stale on trivial change and carry no decision. Concreteness stays where it is the document's function (proof counts in testing.md, formats in data.md, the module map in architecture.md, the registers).

## Project
- A browser-based, lossless editor for arbitrary TEI-XML. Open an existing edition, correct it folio by folio at its natural granularity (word-level if `<w>` is present, else line-level), save it back byte-faithfully. The core is a generic, offset-true reader (raw string canonical, edits are offset splices, `serialize()` byte-identical).
- Projects are folders with a declarative `teicrafter.project.json`. One project holds several document types, and the allowed markup binds to the type (`documentTypes` + the `files` map; project-level `markup` is the default, PID detection the fallback for bare files). "Open project folder" uses a once-granted File System Access directory handle (decision: not OPFS), Chromium-only; its `.xml`/`.txt`/`.md` files appear in the Project panel. Plaintext (`.txt`/`.md`) opens as a deterministic line-level draft (transport, never AI-marked; a `|N|` token becomes a page break), from the project panel or directly via picker/drop; in a project the first save creates the `.xml` next to the source, an unsaved draft survives a reload via a recovery offer. Separate from the LLM on-ramp.
- An optional LLM on-ramp ("New from text (LLM)") drafts an initial TEI from plaintext into the same editor, marked machine-generated and unreviewed (violet). The model assists; the human decides. Currently hidden behind `FEATURES.llmOnRamp` (off since 2026-06-10); the code stays in place.
- Real cases: Wenzelsbibel (word-level), Jeanne Hersch / zbz-ocr-tei (line-level), Stefan Zweig / szd-htr (catalog TEI + Page-JSON, needs conversion first).
- Client-only, deployed via GitHub Pages from `/docs`. ES6 modules, no bundler, no build step. The built-in examples (landing cards, Load... entries, `#example` deep link) show only on local development hosts (`FEATURES.examples`); the public deployment hides them.
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
2. `journal.md` for a session entry and any new decisions. Journal style: an entry records the trigger, the decision and the reason, in a few sentences; no proof numbers or test counts (testing.md and goals.md carry them), no implementation detail (architecture.md carries it), no file-by-file lists. Lessons worth keeping are part of the reason.
3. `specification.md` for new decisions, resolved open questions, or requirement changes.
4. `design.md` only if the visual or interaction layer changed.

Keep `version:` consistent repo-wide. Distill: one function per document, cross-link via `related:` rather than repeat.
