# Milestone evaluation: MS-B, epistemic infrastructure chapter draft (TP5)

Date: 2026-06-09. Milestone: the paper's section 4 (Begriffskapitel), the
largest piece of original writing in the contribution (TP5 of the Editopia
master plan). The deliverable lives in the Obsidian vault per the standing
working arrangement (paper text in the vault, tool work in the repo); this
report and the journal entry are the repo-side record.

## 1. What the milestone promised

From the master plan (TP5): work out the concept chapter from the vault note
`Applied Generative AI/Epistemic Infrastructure.md`, sharpening five points
recorded in the v2 plan. Result form: the chapter draft for the full text plus
an update proposal for the vault concept note. Operator approval of the content
is explicitly not part of the milestone (it is the operator's gate).

## 2. What was delivered

`Projects/zbz-ocr-tei/2026-06-09 - Editopia Begriffskapitel epistemische
Infrastruktur (Entwurf).md` (vault, frontmatter `author: claude-code-worker`,
`human-reviewed: false`), containing the chapter draft (nine paragraphs), a
three-point update proposal for the concept note (deliberately NOT applied to
the original note, which is operator-owned and status complete), the open
points before submission, and the to-verify reference list.

The five sharpening points, each addressed in the draft:

1. Bridge to the abstract wording (Mechanismen, Arbeitsschritte, Werkzeuge zum
   Verifizieren, Kuratieren, Dokumentieren) and Sahle 2016 (constitutive steps
   redistributed, checkability restored at the intermediate artifacts).
2. Two component additions from the material (the artifact states its own
   verification status; determinism of the surrounding tools as a tested
   property), led as an extension of the verification milestones.
3. De-circularisation (the definition is method-neutral; Promptotyping is the
   genesis, not the definition).
4. Explicit demarcation against Simons/Zichert/Wuethrich 2025 (LLMs as
   epistemic infrastructures vs the process-oriented sense used here).
5. Co-construction recorded and used as the bridge to the process section
   (self-application).

## 3. Verification

- Mechanical style scan of the draft text: no colons, no em/en dashes, no
  "Genau das", no ", sondern" (PowerShell scan over the Entwurfstext section,
  0 hits).
- Adversarial review by an independent agent against the style rules,
  paper-evidence.md and the concept note: 22 findings (style pattern density,
  five factual precision issues, four argument defects, seven German language
  issues). All worked in. The materially important ones: "294 real files" was
  factually wrong (5 of 294 are synthetic fixtures; now stated precisely with
  the 285 Hersch decomposition); the SZD status model was flattened to two
  poles (now five tiers including the agentic middle tier); the Edwards/Borgman
  attribution was stronger than the sources support (now "schliesst an ...
  an"); the converter parity claim was scoped to the compared set; a missing
  bridging premise (artifact-level checkability substitutes for process-level
  transparency, with its validity condition) was added.
- Numbers in the chapter (285 handed over unverifiziert, three revisionDesc
  states, 294/294 round-trip, converter parity) each have a row in
  paper-evidence.md.

## 4. Deviations and judgement calls

1. The vault concept note `Epistemic Infrastructure.md` was NOT edited, although
   TP5 names "eine aktualisierte Vault-Notiz" as part of the result. The note
   is operator-authored and status complete; the draft instead carries a
   three-point update proposal for the operator to apply or approve. This is
   the conservative reading of the vault ownership rules.
2. The component names in the chapter are generic (Verifikationsinterfaces,
   strukturierte Wissens- und Prozessdokumente) with the Promptotyping names
   given as origin, resolving the reviewer's finding that method-named
   components contradict the method-neutrality claim.
3. The two additions are led as an extension (Erweiterung) of the verification
   milestones, not as new components; flagged for operator confirmation in the
   draft's open points.

## 5. Open after this milestone

- Operator approval of the chapter; decision extension vs own components;
  application of the concept-note update proposal.
- References to verify before submission (Simons/Zichert/Wuethrich full
  citation, Sharkey et al., Sahle page numbers, Edwards terminology check).

## 6. Verdict

Milestone met as scoped: the chapter draft exists, is style-clean by scan and
adversarial review, every number is evidence-backed, and the operator gates
are explicit. One stale figure was also fixed outside the milestone proper
(the one-pager pitch still cited the superseded CER median 1.83; corrected to
1.40 per the evidence sheet).
