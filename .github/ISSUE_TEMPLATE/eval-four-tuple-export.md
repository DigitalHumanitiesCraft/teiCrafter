---
name: "Evaluation hook: four-tuple protocol export"
about: Export confirm/reject episodes as the four-tuple the verification proposal evaluates on
title: "[antrag-eval] Four-tuple protocol export for <scope>"
labels: antrag-eval
---

## What this issue is for

The proposal layer already produces typed episodes: a construct enters the document marked `resp="#ai"`, and the human gate either confirms it (origin remains and acceptance is recorded separately) or rejects it (the construct is unwrapped and the reading text restored). This hook asks for an export that turns those episodes into the four-tuple the evaluation reads:

1. initial expert judgment (what the editor held about the passage before seeing the proposal, where the surface can capture it)
2. AI suggestion (the proposed construct with its production provenance)
3. final decision (the encoding the document carries after the episode, and whether it was reached by confirm, reject, or confirm after a manual change)
4. reference answer, where one exists for the passage

Criterion-independent: the export carries the tuple, no score, no rate, no ranking derived from it.

This requested protocol export would sit beside the document. It must not introduce additional edition mutations merely to collect evaluation data; the existing TEI responsibility, acceptance and review records remain intentional editorial changes.

## Artefacts this touches

- `docs/js/editor/proposal-apply.js` â€” the proposed construct as it enters, carrying `@resp`
- `docs/js/editor/proposal-review.js` â€” `confirmConstruct` and `rejectConstruct`, the human gate that types the episode
- `docs/js/editor/ai-suggest.js` â€” the parsed proposal before it becomes an edit
- `docs/js/services/llm.js` â€” model and prompt identity of the producing call
- `knowledge/specification.md` â€” the LLM on-ramp and its acceptance scenarios

## Open before implementation

- Whether an initial expert judgment can be captured without turning the editing surface into an experiment
- Where a tuple with no reference answer is marked as such rather than left empty
- How a confirm that follows a manual correction of the proposed construct stays separable from a plain confirm
