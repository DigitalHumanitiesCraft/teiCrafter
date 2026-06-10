---
title: teiCrafter Development Journal
project:
  name: teiCrafter
  repository: https://github.com/DigitalHumanitiesCraft/teiCrafter
method:
  name: Promptotyping
  url: https://lisa.gerda-henkel-stiftung.de/digitale_geschichte_pollin
template:
  name: Vorlage Journal
  version: 0.1
  url: https://dhcraft.org/Promptotyping/promptotyping-document/journal
status: active
created: 2026-02-05
updated: 2026-06-10
language: en
version: 0.9
related: [project, specification, architecture, testing]
---

# teiCrafter Development Journal

Chronological log, most recent first: how each decision came about. An entry records the trigger, the decision and the reason, in a few sentences; bullets only when one session produced several independent decisions. What an entry does not carry: proof numbers and test counts (they live in [testing](testing.md) and [goals](goals.md) and would only go stale here), implementation detail ([architecture](architecture.md)), commits (Git history). Lessons worth keeping are part of the reason.

## 2026-06-10 (day, continued): A project is not an edition type; project folders and plaintext intake (M2.9)

The operator corrected the genre framing recorded earlier the same day: a project is not an edition type, since one project holds several genres (Stefan Zweig Digital: life documents, letters, more), and the allowed TEI elements bind to the type. The manifest accordingly gained `documentTypes` and a `files` map; the wrap list now resolves per open document, with project-level markup as the default. He also set the acceptance case for making the application really testable: create an own project, put one TEI and two plaintext files in it, edit all three. That case drove the build: "Open project folder" (M2.9, the once-granted directory handle ratified in F3), a Project panel in the right-pane registry, "New project" writing a minimal manifest, and a deterministic plaintext intake (paragraphs on blank lines, a line break element per line, text verbatim). The plaintext draft is deliberately not AI-marked: the violet family means machine-plausible content awaiting judgement, and a rule that transports text verbatim makes no claim a human would need to judge; the same stance as the SZD converter. The case is proven headless; the browser run of exactly this case is the operator's gate.

## 2026-06-10 (day, continued): Two concept descriptions corrected at the root (byte fidelity, editing unit)

The operator challenged two core descriptions and was right both times; the session also resolved the boundary question he had raised against the About page. First, byte fidelity: described as "byte-identical", the property reads as trivial ("copying is always byte-identical"). The point the texts failed to carry is that an editor is not a copier: almost every XML tool re-serializes a parsed tree and silently normalises attribute order, entity notation and line endings, while teiCrafter splices into the original string; the comparison proves the whole pipeline is the identity function, and with edits, that a file diff shows precisely the human intervention. That rationale, with a concrete example and the two real defects the comparison caught in our own audit, now stands wherever the property is claimed (specification as the source, About and README as public descriptions). Second, "emergent granularity" was renamed repo-wide to the literal description "the editing unit is read from the document": emergence means non-derivability from a simple rule, and this is a one-line deterministic rule, so the term was a borrowed metaphor adding prestige rather than meaning, exactly the category the description rule bans. The explanation now derives from TEI logic (TEI encodes its own structure, the editor reads the unit from the encoding) instead of project anecdotes. Third, the About/project boundary texts dropped the negative identity claims ("does not replace oXygen or ediarum", "editions that already exist as TEI"): both presented current configuration or current status as identity, contradicting the operator's own rule and the Wenzelsbibel mandate. The honest position now stated: not an XML development environment (design boundary), built to carry the editorial working role in project workflows (to be proven via gates W1/W2 before it is claimed publicly), coexistence on the same files guaranteed by byte-faithful saving. The operator also endorsed the project-as-edition-type framing (correspondence, manuscript codex, dictionary, language corpus), now recorded with the manifest decision; units and views for non-folio types are registered as future work.

## 2026-06-10 (day, continued): The project becomes a declarative manifest (WB-AP3)

After a status analysis and a housekeeping round (both operator-confirmed), the operator picked WB-AP3 as the next package. The ratified F3 decision became built code: a project is a `teicrafter.project.json` next to its TEI files, parsed by an entry-agnostic module into the same runtime shape the built-in PID profiles produce, so the facsimile resolver, the markup wrap list and the status line cannot diverge between the two sources. The manifest wins, PID detection stays the fallback, and a manifest can never block a load (absent is the normal public deployment, malformed is reported and detection takes over). The Wenzelsbibel manifest is the first profile, derived from the editorial guidelines in the vault; where the guidelines leave something open the manifest leaves it open too (no schema URL, the peoples index without a listType), because a configuration that invents facts fails the same way an unverified model output does. It is committed inside the gitignored codex directory by ignoring the directory's contents rather than the directory itself, since the manifest carries no licensed content. The declared `indices` and `views` are forward contracts for the index work and F4, accepted deliberately because the format is the deliverable of this package.

The housekeeping round before it corrected stale plan markers (M5.2/M5.6 had long been done), fixed HANDOFF's push-state claim against the real remote, and deleted the dead pre-pivot `pipeline.mjs`: a file whose only documented property is that it misleads is better kept in git history than in the working tree.

## 2026-06-10 (day, continued): The About page restructured around what a researcher must know

Follow-up to the description rule: the operator asked what actually belongs on the About page. The answer, now implemented: besides what was already there (tool, saving, editing unit, machine content, examples, method, maker), a research tool's About must state what the tool is for and not for (correction surface, not a modelling environment, not recognition, not publication), what can be annotated, what leaves the browser (the edition never; facsimile repositories, authority registers and CDNs are contacted, the optional LLM provider only when enabled), the browser requirements (save-in-place is Chromium-only, download elsewhere), and status with citation and licence. The page is now twelve short sections in the same descriptive register.

## 2026-06-10 (day, continued): Public text rewritten as description, not claims

Operator on the new landing strip: "wir brauchen gar keine Marketing Claims, sondern es sollte ein wissenschaftliches Researcher Tool sein"; named offenders "Lossless by construction", "verified by live checks", "offline proof harness", and "no LLM in the loop" (which presents a current configuration as identity while LLM features are planned). The rule, now in CLAUDE.md: public-facing text is description for researchers; every property is a full sentence explaining what it concretely means, and a claim that cannot be explained in place is left out. Applied across landing, welcome state, About and README: slogan headers became questions answered in the paragraph ("What saving does"), shorthand became the behaviour it names ("Saving writes your edits into the original file text and changes nothing else"), the LLM absence claim was dropped, and the About sections were renamed and rephrased the same way.

## 2026-06-10 (day): Landing as a real front door, the real codex as the WB example

Two operator orders from a screenshot round. First, the landing page was mostly empty surface (one small card in white space); it is now three layers: a serif hero with the one gold action, the three example-edition cards deep-linking straight into the editor (`#example=KEY`, same labels as the welcome cards), and a quiet feature strip naming the core properties. Second, the Wenzelsbibel example must use the original data, not the synthetic stand-in. Solved inside the licence boundary with the established zbz-1000 pattern: the real Codex 2759 is materialized under a gitignored docs path, the example registry tries it first and falls back to the synthetic twin, and the status line says which one loaded; the public deployment never serves ONB data. A false alarm worth recording: a smoke-test screenshot appeared to show the previous document's facsimile next to the codex text; the diagnosis (a focused two-case test with request logging) showed the editor was correct and the test's wait condition was weak, it had fired while the 82 MB codex was still loading. The wait now keys on the loaded document's name, and the fallback path has its own proof (a server that 404s the codex path must yield the twin). Known limitation, pre-existing: the ZBZ example is local-only (rights), so its entry fails with a status message on the public deployment.

## 2026-06-10 (night, continued): The approved refactor round

The operator approved the refactor assessment ("was koennen wir jetzt noch alles konkret erledigen?"). style.css had carried the dead five-step-generator styling since the 2026-05-30 consolidation; it is now design tokens, base and shared site chrome only. The purge surfaced a real defect: a global `body { overflow: hidden }` (an editor need) had made the About page unscrollable; page-specific needs now live with the page. The triple header/footer duplication across landing, About and editor became one `.site-head`/`.site-foot` family in style.css, ending the divergence it had already produced (the About footer linked "GitHub" as text where every other page shows the icon). The three example loaders folded into the example registry as config entries, since they differed only in URL, file name and an optional image base. Unused storage exports and one dead class went with it. The smoke test grew to cover the ZBZ image-base path, the landing page and the About scroll; the engine is untouched.

## 2026-06-10 (night, continued): Journal style, LLM on-ramp hidden, comment rule

Three operator decisions in one round:

- **The journal carries decisions, not quantities.** Entries were rewritten to trigger, decision and reason; proof counts and implementation detail moved out (they live in testing, goals and architecture). This style note in the document head is the contract.
- **The LLM on-ramp is hidden for now** ("das koennten wir mal ausblenden, vorerst"). Reason: the deterministic editor path is proven, the on-ramp is not, and a research preview should not lead with an unproven entry. A feature flag gates every entry point; nothing was deleted, so the flag restores it (the static landing card by hand). A CSS lesson recurred for the third time: an author display rule beats the user-agent `[hidden]` rule, so hiding needs an explicit `[hidden] { display: none }`.
- **Code comments have a style rule** (now in CLAUDE.md), after the operator interrupted an overlong comment block: compact, descriptive, plain English, only where the code cannot speak for itself; no dates, decision references or restoration instructions in comments, that context belongs here.

## 2026-06-10 (night, continued): The dual view (operator feedback round 8, M2.14)

The operator rejected the single-pane XML mode ("not nicely integrated": it collapsed to one centered column and forced the facsimile away) and set the layout concept: two panes, always. Left is the text work surface (reading text or XML source, switched by tabs in the pane head), right is always a context view, switchable and customizable per project. Built as an open panel registry (facsimile and entity index built in; project profiles can contribute panels), which also answered the customizability requirement. Two consequences: the entity index left its modal, because text and index visible together is the point of a dual view; and view switching left the toolbar, because switching belongs where the content is. The operator's duplicate-text find in the SZD example turned out to be a fixture-generation artifact (the source page is empty; the editor showed the file faithfully): fixed in the fixture, and a converter guard was ordered for the szd-htr lane.

## 2026-06-10 (night): Identity surfaces, one load entry, checks at the text (feedback round 7)

Operator round 7, four decisions: loading is ONE entry (a "Load..." menu carrying the file picker and the examples; two parallel entries were developer plumbing); the tool gets an About page and an identity footer, and the status line speaks only when an action has an outcome to report (a permanent "Ready" carried no information); the validation chip moves from the footer to the reading-pane head and its tooltip defines its own terms, triggered by the operator asking what "lossless" means (the UI must answer that where it claims it); the XML source view's page-growing layout was a min-height flex-chain defect, fixed so the editor scrolls inside its pane. The operator's facsimile-toggle report did not reproduce headless; only a visible divider artifact was reproducible and fixed, his recheck stays open.

## 2026-06-10 (evening, continued): TEI brand colors and the element-tag wordmark

Operator order: exactly the TEI brand colors (blue, yellow, black) and the wordmark `<teiCrafter>` instead of `[ tei Crafter ]`. Applied as a token change only, so the UI follows without component edits, which is what the token system is for. Two legibility consequences recorded in design.md: the primary button is black on yellow (the TEI logo's own contrast pair; white on that yellow fails), and small text accents use the darker gold because the brand yellow is a fill colour, not a small-text colour. Same evening, a feature candidate from an operator question: the TEI Guidelines as context-sensitive reference in the editor; feasibility confirmed (the published pages and the machine-readable `p5subset.json` are CORS-open, so a client-only panel needs no backend); proposed, not yet decided.

## 2026-06-10 (evening): Welcome state and loading discipline (operator feedback round 6)

The operator asked for a critical review of the start screen ("Ist das wirklich perfekt?"). The review found the start state to be the weakest surface: dead editor chrome around no content, a gold disabled button as the page's strongest element, one command under two labels, the examples listed twice with diverging texts, no visible keyboard focus, and none of the tool's visual identity on first contact. Decisions: a full-width welcome surface and no editor chrome before a document exists (a start state must not carry dead controls); one label per command; every way in offered once (open button, drag and drop, recent files, example cards); document actions hidden, not disabled, until a document is loaded; Save is the gold primary because save-in-place is the lossless core gesture; replacing a document with unsaved changes always asks. A technical lesson: a dropped file's handle must be taken synchronously inside the drop event or it is lost, which is what keeps save-in-place working for dropped files.

## 2026-06-10 (continued): The real Wenzelsbibel codex loads with IIIF facsimile (WB-AP1, WB-AP2)

First package after the ratified definition decisions, driven by three findings only the real 78 MB codex exposes: re-validating the whole document on every page turn is invisible at demo size and costs seconds at codex size (validation is now cached by document identity); the codex's zones carry only `@points` polygons, which the overlay placer skipped (bounding boxes are now derived, a read-only projection, engine untouched); and the page images are IIIF behind a bare filename (a project profile maps it to the IIIF endpoint, the precursor of the decided project-manifest mechanism). The source view refuses very large documents with an explanatory notice instead of freezing the tab. The measured seconds-per-edit cost of the one-file model is recorded as an argument for file-per-book in the pending data-model decision.

## 2026-06-10 (closing): The five definition questions answered and ratified

To define what the editor line builds toward, five definition questions (primary user, target workflow, project concept, dual reading, acceptance criteria) were worked out against the vault contract documents, the real codex XML and external precedents (ediarum.BASE, LEAF-Writer, TEI ODD), and ratified by the operator the next morning (PLAN.md section 11). The structurally largest: a project becomes first-class via a declarative `teicrafter.project.json` manifest in the project folder, and internal storage resolves as "Open project folder" over a directory handle, not OPFS. A side finding: the user stories ED.1 to ED.7 referenced in the vault exist nowhere and must be written before acceptance gate W1.

## 2026-06-10 (late night, second package): Refactor sweep, real source editor, home navigation (M2.12, M2.13)

Operator asked "gibt es etwas zu refactoren?" and approved all proposed packages; a fifth feedback round arrived mid-work (home navigation; highlighting, line numbers and a check button for the XML view). Decisions: dead mode code from the removed toolbar toggles deleted; one shared authority form instead of two copies; deleting an entity with live mentions becomes two-step (armed with the count first), so dangling refs stay representable but never happen silently; the XML view became a real source editor (tolerant highlighter under a transparent textarea, explicit well-formedness check with error jump, Apply stays gated); the editor links home. The grown controller was split into an integrator plus feature modules behind a single ctx object (M2.13), pure movement. One harness lesson: a careless two-line replace-all rewrote a function into a self-call; caught by re-reading the result before running anything.

## 2026-06-10 (late night): The index pane dissolves into the annotation environment (M2.11)

Fourth operator round. Two orders: the explainer banner and all ambient hint lines go, help is tooltip-only ("Hilfe nur ueber sinnvolle Tooltips"). One architectural question: the permanent index pane becomes a second bookkeeping surface next to real documents, can the logic move into the environment where annotating happens? Decisions taken in a question round and built: authority work (idno chips, add form, live lookup) moves to the mention itself, and after annotating, the annotation editor opens in place, so identifying follows annotating without leaving the line; the full index becomes an on-demand overlay; "Suggest entities (AI)" leaves the UI ("vorerst rausnehmen"), the engine gate stays, and a future re-entry should anchor proposals in the text, not in a list; index-initiated linking is retired because selection-initiated linking covers it.

## 2026-06-10 (night): The click-chooser dies, the editor paradigm lands (M2.10)

Third operator round, the sharpest: "dieser Modus, wo ich wo drauf klicke und dann dieses Edit und Note reinkommt, das macht ueberhaupt keinen Sinn", reference point Oxygen. Decisions: a plain click sets the cursor and nothing else; clicking an annotated element edits that annotation; double-click edits text directly; everything else lives in a right-click context menu. The annotate popover became evidence-first (suggestions with visible provenance reasons before flat lists; entity creation no longer pushed at every selection, "maniere" is not an entity) and offers plain TEI markup including structured persName, because not every annotation is an index entity. The engine gained generic sub-range wrapping with a byte-identity guard on the reading text, so no markup operation can lose text. The XML source view became editable: the raw string is canonical, so source editing is a first-class path, gated on well-formedness.

## 2026-06-10 (evening): Selection annotation (M2.8) and validation resolved into the footer (M2.7 completed)

Second operator round: clicking a prose line and being offered actions is not how a scholar annotates; the gesture is selecting the exact words ("KARL JASPERS") and annotating the selection. Built as a lossless sub-range wrap with a display-to-raw offset mapping and a decode-equality guard before any splice. The "Validation and structure" tab dissolved: the live checks surface as an ambient status chip with a detail popover, because validation is state, not a destination. Registered on operator announcement: internal storage (M2.9) and capturing the source projects' edition guidelines (M5.7), triggered by his question whether annotation practice here matches the original projects' rules (it has no documented basis beyond TEI P5 yet).

## 2026-06-10 (later): Editor shell reworked on operator feedback (loading, paging, modes)

First operator review of the live tool: the loading entries read as developer plumbing, page turning was not where one expects it, the mode toggles were not understandable, and documents without facsimile showed a permanently empty viewer. Decisions: the mode toggles go (the inline chooser covers their functions at the cell); page turning moves into the reading-pane header with arrow-key support; the AI suggest action moves into the index with a clear label; an empty editor starts with an instruction screen; the facsimile pane collapses when a document has no page images, because a permanently empty viewer is noise.

## 2026-06-10 (continued): Adversarial-review follow-up package on M2.5/M2.6

A multi-lens review of the milestone diff; confirmed findings fixed as one package. The one real semantic defect: relinking a critically-wrapped mention nested `<name>` inside `<name>`, because the engine op inspected only the immediate parent while the projection walks through wrappers; both now use the same bounded ancestor walk. The rest were UI-truthfulness fixes worth their rules: pure cancel restores in place so scroll and zoom survive a look-and-cancel; a no-op link says so and never sets the dirty flag; tooltips use the human labels, never the raw localName; the organisation colour moved out of the violet range to restore "violet exclusively for AI-origin", and AI mentions carry a dashed outline so machine origin never hangs on hue alone.

## 2026-06-10: UI restructuring built (M2.5 + M2.6), both objects re-verified in the browser

The restructuring decided on 2026-06-09 was implemented: the annotation visibility layer (mentions, notes and critical marks visible in the reading text, entity-type colours, a legend built from the codes actually present) and the inline cell action chooser. Three as-built refinements with reasons recorded in design.md: colour kind comes from the entity type, not the id prefix; the temporary selection highlight got its own class so clearing it cannot strip the permanent layer; mentions of unconfirmed AI entities render violet. Both demo objects were re-verified agent-driven in the browser, including in-browser byte-identity of a no-op save. The open lookup finding from 2026-06-09 closed as a transient network outage, not a code defect; lesson kept: diagnose before fixing. Session frame: the operator granted a dated exception to the solo rule for an adversarial review workflow only.

## 2026-06-09 (night): Agent-driven live browser run, UI restructuring decided (M2.5/M2.6)

Two working-model changes by the operator: this lane works solo from now on (no dynamic multi-agent workflows), and the agent drives browser checks itself (previously operator-only), proven with a file-picker stub that also captures the save stream so byte-identity can be asserted in the browser. The run surfaced the finding that drove the next milestones: annotations were invisible in the reading text (the renderer never assigned the existing mention class; the entity-type tokens were unused) and the editing flow hid behind modal toolbar toggles. Operator decision: text and annotations belong in a UI where everything annotated is visible and everything is editable in place; registered as M2.5 (visibility layer) and M2.6 (inline chooser).

## 2026-06-09 (continued): Curated example set generated (M7.4), full-text Rohfassung, concept chapter

The paper's empirical partial result moved onto disk: a registry-driven generator applies the proven curation arcs through the real engine and persists before/after pairs with diffs, under the standing rights stance (Hersch pairs stay local-only; the generator skips an absent rights-encumbered source instead of failing). The same night the full-text Rohfassung and the concept chapter draft were written into the vault through drafter/adversarial-verifier/reviser rounds; the verification round caught one genuine factual error (synthetic fixtures counted as "real files") and routed two upstream findings to the zbz lane order instead of silently fixing them, which is itself the mechanism the chapter describes. Operator approvals pending.

## 2026-06-09: ZBZ worked example (M7.2 ZBZ half), evidence sheet, sharpened success criterion

The operator sharpened the frame: "the experiment succeeded" was premature, since the ZBZ partners are not yet convinced. The experiment counts as successful when the workflow's added value is demonstrable: from unverified pipeline TEI, curation in teiCrafter produces a demonstrably better TEI while preserving the pipeline output byte-exactly, confirmed by the ZBZ. Second decision: both demo objects run in teiCrafter (supersedes the earlier EditionCrafter-v0 plan for the Hersch demo). Doc 1000 won the demo-object comparison for its clean page/surface/image alignment. A rights decision worth recording: the prepared object was briefly committed and pulled back before any push; public is not redistributable, so the object is gitignored and materialized on demand. `paper-evidence.md` was created as the single source for every externally citable number after the verification pass found four stale figures circulating in earlier notes; no number goes into the paper without an entry there. The SZD worked example became a presentable, reproducible artifact (its fixture is committed because it carries its own CC-BY licence; the rights-encumbered fixtures stay gitignored). An adversarial review replaced two tautological proof checks with full-reconstruction assertions, the lesson being that a prefix check proves nothing about the rest of the file.

## 2026-06-08: Textual-critical markup (M3.6) with an adversarial review pass

Inline textual criticism (`unclear`/`del`/`add`/`gap`) landed DOM-free and lossless. Two design decisions worth recording: a gap REPLACES the text rather than wrapping it, because TEI `<gap>` is content-less by definition, and the cell model surfaces it as its own read-only cell so the line stays visible and the marker removable; and the edge-whitespace splitter moved into the core so the critical wrappers and the cell editor preserve whitespace by the same code, not two copies. The adversarial pass produced the load-bearing fix: clearing markup refuses to strip a wrapper shared with sibling content, and a cell is tagged from its immediate wrapper only, so the visible state always matches what the operations can act on. This is editorial, human markup: editorial colour families, never violet.

## 2026-06-08: Annotation layer completed (notes, AI proposal, live lookup), whitespace caveat closed

The whitespace caveat closed editor-side rather than converter-side, because the editor fix keeps byte fidelity for every corpus, not just SZD: a line edit now touches only the trimmed core and re-attaches the original edge whitespace. Notes, AI entity proposal and live authority lookup completed the annotation cluster. The decision worth recording: AI-proposed entities are marked `resp="#ai"` rather than a custom attribute, because that keeps the markup TEI-valid and records provenance (who produced it is not who verified it), matching the Editopia thesis. An adversarial review confirmed UI-layer defects the headless tests could not reach, chiefly a stale-lookup race writing into a detached popover; the guard tests connectivity to the document, not the local parent link, which survives a re-render. The SZD lane's deterministic converter chain was verified read-only from here, making the planned SZD order obsolete before it was written.

## 2026-06-08: Coordination dissolved, plan moved to PLAN.md, SZD demo proven in browser

All multi-Claude-Code coordination structure was removed from the three repos, the vault and memory; the three projects remain real, independent repositories with a data-flow relationship. The plan moved to the repo root as `PLAN.md`, status corrected to as-built. The SZD demo was proven in a real browser for the first time (facsimile renders, save byte-identical, a line correction changes exactly its region). One caveat found and registered as an open decision: a line edit collapsed the line's trailing indentation. The working model was set with the project lead: autonomous per milestone, only teiCrafter edited directly (sibling repos get written orders), agent-driven browser checks, local commits, no push without an explicit word.

## 2026-06-08: Authority-id core, work entity, converter contract drafted

The decision: authority identifiers attach as `<idno type="...">` children rather than packing them into `@ref`, because an entity can carry several registers, the SZD converter already emits idno for creators, and `@ref` stays reserved for the in-text mention pointer. The work entity was pulled forward because the demo triad is person/place/work. The deterministic converter contract was drafted as `converter-reference.md`, every rule citing the prototype. The open bbox-unit question resolved as percent; the earlier doubt had conflated the physical sheet dimensions with the bbox unit, a lesson in checking which field one is actually reading.

## 2026-06-07: Plan synthesis, three built milestones

A planning session framing teiCrafter as the third Promptotyping case in the Editopia talk. Decisions: the end product is the whole project (implementations, slides, paper, knowledge documents); normdata reaches an entity by three layered paths on one mechanism (hand entry as the foundation, an offline batch proposal, a live lookup); the LLM is used only for annotation proposals, never for the Page-JSON-to-TEI conversion, which stays deterministic; demo objects fixed (o_szd.1079 and one ZBZ document with committed images). The EditionCrafter-as-Hersch-demonstrator decision was superseded on 2026-06-09. An on-disk audit corrected the plan against reality, versioning the fragile converter prototype out of a temp directory into the repo.

## 2026-06-04: Adversarial audit and confirmed-defect fixes

An adversarial audit of the whole tool; the lossless and security core held (all key-leak claims refuted), and the confirmed defects each carry a lesson. Entity escaping was not round-trip-stable: editing a cell containing `&nbsp;` corrupted it, and the identity-only sweep could never catch it because no fixture carried such entities; the fix distinguishes a bare ampersand from an existing reference, and a dedicated edit-fidelity proof now covers the gap. Adding an entity to header-less TEI crashed, fixed with anchoring fallbacks. The AI-violet tokens were referenced everywhere but defined nowhere, so the binding "AI is always violet" invariant silently failed; the earlier journal claim that the tokens had been "added" was aspirational, a reminder to verify claims against the running artifact. A follow-up fixed relink-nesting and replaced synthetic positional ids with real `@xml:id` values in the integrity baseline, ending false alarms on id-less editions.

## 2026-06-04: First in-browser click-through; two fixes from it

The first drive in a real browser, the one check the headless harness cannot perform, confirmed the editing arc against the serialized output. Two defects: the violet generated-banner showed unconditionally, because an author `display: flex` rule beats the user-agent `[hidden]` rule regardless of specificity (the trap's first documented occurrence); and standOff inserts hardcoded LF into CRLF files, fixed by adopting the document's dominant newline.

## 2026-06-02: Editor-only pivot and the facsimile/index layer

Completed the editor-only pivot: the facsimile pane became a real OpenSeadragon deep-zoom viewer with `<zone>` overlays bidirectionally linked to the reading text, and a lossless `<standOff>` model with an index UI added entities and mention linking, all inside the offset-splice model. The real (rights-encumbered, local-only) Hersch edition exercises the image path.

## 2026-05-30: Editor-first consolidation and the generic reader

The decisive session. The deterministic editor was built per the `Idee.md` vision (no LLM in the annotation process). Profiling the Nachlass pipelines showed it could not stay word-only: Hersch is line-level, SZD has no transcription TEI at all. The chosen solution was not per-project profiles but one generic, offset-true reader: a byte-offset tokenizer, schema-free recognizers by local name, lossless splice edits; granularity emerges from the document. The LLM path was unified into the editor per the author's decision ("direkt in den Editor, Stepper weg"): generation became an on-ramp into the same editor, marked violet and unreviewed, and the five-step generator was deleted (recoverable from git). A mis-claim was corrected: the deleted transform module was legacy, not faulty. The knowledge base was refactored from "two equal paths" to the editor-first reality.

## 2026-05-27: Knowledge base refactor

Reactivated the knowledge base from the dormant April state; replaced the four consolidated documents with the function-separated Promptotyping set. Design and UI lessons pulled from sibling projects: expert-in-the-loop and categorical confidence from coOCR, single-source design tokens from the zbz Hersch system, facsimile-synopsis patterns from the SuGW frontend. This set still described two equal paths; the 2026-05-30 session corrected that.

## 2026-02-18: Demo data, reference, strategy (Sessions 10 to 16)

Walking-skeleton-first strategy adopted after a market analysis found no tool combining TEI annotation, LLM assistance and human review. Real demo sources and a six-provider catalogue were added; both fed the stepper that the 2026-05-30 consolidation removed.

## 2026-02-05: Foundation (Sessions 1 to 9)

Project start: `docs/` for the GitHub Pages prototype, `knowledge/` for the knowledge base. The first prototype was a five-step workflow (Import, Mapping, Transform, Validate, Export) with a reactive document model; it was the exploration that the 2026-05-30 editor-first build replaced.

## Origin: FORGE 2023

The LLM-to-TEI idea originates in the FORGE 2023 prototype, conversion of unstructured text to TEI-XML via GPT on the Schuchardt correspondence (Pollin, Steiner & Zach 2023, https://doi.org/10.5281/zenodo.8425163).

## Related

- [specification](specification.md) for the decisions referenced here
- [architecture](architecture.md) for the current implementation
- [testing](testing.md) for the proofs
