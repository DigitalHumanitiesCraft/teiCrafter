# Milestone evaluation: MS-C, full text draft (TP7)

Date: 2026-06-09. Milestone: the Rohfassung of all nine sections of the
full text. The deliverable lives in the Obsidian vault per the
standing working arrangement (`Projects/zbz-ocr-tei/2026-06-09 -
Volltext Rohfassung.md`, marked claude-code-worker); this report and the
journal entry are the repo-side record.

## 1. What the milestone promised

From the master plan (TP7): a Rohfassung of the nine sections following the
established outline, integrating the MS-A set table (section 6), the MS-B
concept chapter (section 4) and the process documentation (section 8), under
the style rules, with every number covered by paper-evidence.md. Co-author
approval is the operator's gate, not part of the milestone.

## 2. How it was produced

A dynamic multi-agent workflow (24 agent runs) drafted the eight missing
sections in parallel (section 4 comes from MS-B). Each section went through
three stages: a drafter with read access to its specific sources (the zbz and
szd knowledge bases, the teiCrafter knowledge base, the plan documents, the
evidence sheet), an adversarial verifier checking style rules, every number
against paper-evidence.md, the running-experiment frame and German quality,
and a reviser applying the verified findings. The verifiers returned 49
findings in total (per section: Einleitung 6, Korpus 2, Pipeline 8,
Verifikation 5, Kuratierung 10, Uebertragbarkeit 7, Diskussion 8, Fazit 3),
all worked in before assembly. Assembly into the vault note, heading
harmonisation and the consolidation of open points were done by the main lane.

## 3. Verification

- Every section returned a numbersUsed protocol mapping each figure to its
  paper-evidence.md row; the protocols are preserved in the workflow output
  (transcript directory of run wf_b373177a-bcd) and were spot-checked during
  assembly.
- The frame rule held everywhere: no section claims the experiment succeeded;
  the curation evidence is reported as a Zwischenergebnis with the ZBZ
  acceptance outstanding.
- Unverifiable facts became explicit [PLACEHOLDER] marks instead of prose
  (institutional context of the Nachlass, genre distribution pending evidence
  rows, the pipeline stage-count divergence between zbz sources).
- Two upstream findings surfaced and were routed: the warnings figures in zbz
  pipeline.md (29) and projekt.md (14) contradict the verified 121; written
  into the zbz lane order (point 4). Strutz/Scholger 2026 had no evidenced
  content in any read source and was omitted rather than invented.

## 4. Deviations and judgement calls

1. Section 4 is embedded in the Rohfassung by Obsidian transclusion from the
   chapter note rather than copied, keeping a single source of truth until the
   operator approves the chapter.
2. Cross-references in section 8 to other sections were left generic because
   the final section titles are a co-author decision; recorded in the
   consolidated open points.
3. The drafters deliberately left model and engine version strings out of the
   text because they have no evidence rows; recorded as an operator decision.

## 5. Open after this milestone

Consolidated at the end of the Rohfassung note, grouped: references to verify
(7), ZBZ-side deliveries (4), operator decisions (7), pre-submission updates
(5), one zbz-lane report. Figures and slides (the rest of TP7) are not part of
this milestone.

## 6. Verdict

Milestone met as scoped: all nine sections exist as connected German prose
under the style rules, every number evidence-backed, the experiment framed as
running, open points consolidated and owned. Approval gates are with the
operator and co-authors.
