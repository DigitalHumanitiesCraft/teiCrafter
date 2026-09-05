/** Source-backed reading cells, keyboard navigation and annotation dispatch. */
import { el } from "./dom.js";
import { attrTargetForCell } from "./edition.js";
import { CRITICAL_KINDS } from "./criticism.js";
import { readingCellVisible, readingSeparator } from "./reading-policy.js";
import { hasResponsibility, isPendingProposal } from "./proposal-provenance.js";

const STRUCTURE_WRAPS = new Set(["w", "l", "lb"]);
const SEM_WRAP_EXCLUDE = new Set(["unclear", "del", "add", "gap"]);

/**
 * The inline semantic element wrapping a cell's text (date, ref, salute, signed,
 * persName, ...), or null. Reuses attrTargetForCell (which already excludes the
 * reading containers p/head/note/body), then drops the bare text-structure
 * wrappers and the critical locals: what remains is a scholarly inline wrap whose
 * presence should be visible in the reading view. A linked mention is left to the
 * mention layer (it already shows). Returns the element node or null.
 */
function semanticWrapFor(cell) {
  if (!cell || cell.gap || cell.mention) return null;
  const elNode = attrTargetForCell(cell);
  if (!elNode) return null;
  if (STRUCTURE_WRAPS.has(elNode.localName) || SEM_WRAP_EXCLUDE.has(elNode.localName)) return null;
  return elNode;
}

/** Tooltip naming a semantic wrap and its attributes, e.g. "date when=1879-02-14". */
function semanticWrapTitle(elNode) {
  const attrs = (elNode.attrs || []).map((a) => `${a.name}=${a.value}`).join(" ");
  return attrs ? `${elNode.localName} ${attrs}` : elNode.localName;
}

export function createReadingView(ctx) {
  const { app, annot, overlay, cellHasAiLayer, beginCritic, beginTextInput, beginReadingsInput,
    setSourceMode, highlightLine, clearLinks } = ctx;

  /** Render one folio's lines into host. folioIndex tags each row and cell so the
   *  line<->facsimile link resolves the right page in the continuous view. */
  function renderFolioInto(host, folio, folioIndex, mentions) {
    // The gutter shows the document's own line label (@n). When this folio numbers
    // no line (e.g. a plaintext draft emits bare <lb/>), fall back to a display-only
    // 1-based position so the gutter still aids navigation; it is rendered faint and
    // never written to the document. A folio that numbers any line keeps the @n and
    // leaves unnumbered lines blank, so a real label never mixes with a synthetic one.
    const hasDocN = folio.lines.some((l) => l.n != null);
    folio.lines.forEach((line, lineIndex) => {
      const row = el("div", { class: "ed-line", dataset: { folio: String(folioIndex), line: String(lineIndex) } });
      // The line label sits in the gutter; the cells go into a body cell that wraps
      // independently of the fixed-width number channel.
      const docN = line.n != null;
      const label = docN ? line.n : (hasDocN ? "" : String(lineIndex + 1));
      row.appendChild(el("span", { class: "ed-line-n" + (!docN && !hasDocN ? " pos" : ""), text: label }));
      const body = el("span", { class: "ed-line-body" });
      const visibleCells = line.cells.filter((cell) => readingCellVisible(cell, app.readingVariant));
      visibleCells.forEach((cell, k) => {
        if (k > 0) body.appendChild(document.createTextNode(readingSeparator(app.state.doc, visibleCells[k - 1], cell, app.readingVariant)));
        const noteKey = app.noteByWord.has(cell.id) ? cell.id : cell.facs;
        const noteTexts = noteKey ? (app.noteByWord.get(noteKey) || []) : [];
        const noteDetails = noteKey ? (app.noteDetails.get(noteKey) || []) : [];
        const note = noteTexts.join("; ");
        const aiNoteDetail = noteDetails.find((detail) => isPendingProposal(detail.el, app.aiResp)) || null;
        // A gap is a read-only marker (no text); other critical kinds add a class so
        // the wrapped reading text shows its editorial status (dotted / struck / added).
        const critClass = cell.crit ? " crit-" + cell.crit : "";
        // M2.5 visibility layer: a linked mention renders in its entity-type colour;
        // a mention of an AI-proposed (unconfirmed) entity renders in the violet AI
        // family, so machine output stays separable (design.md). A mention whose
        // target id is missing keeps the generic fallback style.
        const meta = !cell.gap && cell.mention ? mentions.get(cell.mention) || null : null;
        const mentionClass = !cell.gap && cell.mention
          ? " mention" + (meta ? ` mention-${meta.kind}${meta.ai ? " mention-ai" : ""}` : "")
          : "";
        // Unified provenance: a cell reads as the AI family when its linked entity is
        // AI-proposed OR any wrapping layer carries the responsibility id, so a proposed
        // markup/criticism/note construct (not only an entity mention) shows violet.
        const aiNote = !!aiNoteDetail;
        const aiProv = (meta && meta.ai) || cellHasAiLayer(cell) || aiNote;
        const aiOrigin = meta?.aiOrigin || cell.layers?.some((layer) => hasResponsibility(layer.el, app.aiResp))
          || noteDetails.some((detail) => hasResponsibility(detail.el, app.aiResp));
        const provClass = aiProv ? " ed-w-ai" : aiOrigin ? " ed-w-ai-origin" : "";
        // F4: the normalized variant shows @norm where a word carries one, the
        // text as written otherwise; gap cells keep their marker. The diplomatic
        // variant always shows the text as written.
        const display = cell.gap
          ? "[...]"
          : (app.readingVariant === "norm" && cell.w && cell.w.norm != null ? cell.w.norm : cell.text);
        // Semantic-wrap visibility (M2.5 family): text inside a scholarly inline
        // element (date, ref, salute, ...) that is neither a mention nor critical
        // gets a subtle dotted underline and a tooltip naming the element and its
        // attributes, so the markup is visible without changing text metrics.
        const semWrap = semanticWrapFor(cell);
        // Stacked annotations (e.g. a persName inside a seg): cell.layers carries the
        // full nesting. When two or more layers overlap one text, show the stacked
        // underline and route a click to the inspector instead of a single editor;
        // the single dotted semantic-wrap underline is suppressed to avoid clutter.
        const stacked = cell.layers && cell.layers.length >= 2;
        const semClass = semWrap && !stacked ? " ed-w-sem" : "";
        const semTitlePart = semWrap ? semanticWrapTitle(semWrap) : null;
        const baseTitle = critTitle(cell, note, meta, !!semWrap);
        const span = el("span", {
          class: "ed-w" + (note ? " has-note" : "") + critClass + mentionClass + provClass + semClass + (stacked ? " ed-w-stacked" : ""),
          dataset: { id: cell.id, folio: String(folioIndex), line: String(lineIndex), start: String(cell.start) },
          text: display,
          title: (aiOrigin && !aiProv ? "AI-origin, accepted by an editor. " : "")
            + (semTitlePart ? `${semTitlePart}; ${baseTitle}` : baseTitle),
          tabindex: k === 0 ? "0" : "-1",
        });
        span.addEventListener("keydown", (event) => {
          if (!event.isComposing && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
            event.preventDefault();
            event.stopPropagation();
            const siblings = [...body.querySelectorAll(".ed-w")];
            const index = siblings.indexOf(span);
            const next = event.key === "Home" ? 0 : event.key === "End" ? siblings.length - 1
              : Math.max(0, Math.min(siblings.length - 1, index + (event.key === "ArrowLeft" ? -1 : 1)));
            span.tabIndex = -1;
            siblings[next].tabIndex = 0;
            siblings[next].focus();
            return;
          }
          if (event.isComposing || !["Enter", "F2"].includes(event.key)) return;
          event.preventDefault();
          if (cell.gap || cell.node.type === "cdata") { setSourceMode("page"); return; }
          if (cell.w && cell.node.parent === cell.w.el) beginReadingsInput(span, cell);
          else beginTextInput(span, cell);
        });
        span.addEventListener("contextmenu", (event) => {
          if (cell.node.type !== "cdata") return;
          event.preventDefault();
          event.stopPropagation();
          setSourceMode("page");
        });
        // Editor paradigm (M2.10): a plain click only sets the cursor. Clicking an
        // ANNOTATED element opens its editor: an entity mention its annotation
        // editor, a scholarly inline wrap (date, ref, ...) its attribute editor, so
        // the @when normalization sits one click from the marked text. A gap opens
        // its remove chooser. Double-click edits the text directly (word- and
        // line-level alike); selecting text annotates it; right-click opens the menu.
        // Text editing and annotation are thus distinct modes reached by distinct
        // gestures: a click never traps the line in an edit field.
        span.addEventListener("click", (e) => {
          if (app.readOnly) {
            if (cell.mention) overlay.revealEntity(cell.mention);
            return;
          }
          if (cell.node.type === "cdata") { setSourceMode("page"); return; }
          if (e.detail > 1) return; // second click of a double-click
          const sel = window.getSelection();
          if (sel && !sel.isCollapsed) return; // the selection owns this click
          if (cell.gap && !cellHasAiLayer(cell)) { beginCritic(span, cell); return; }
          if (aiNote) { annot.openProposedNoteReview(span, aiNoteDetail); return; }
          // Overlapping annotations: a click on stacked layers opens the inspector,
          // which lists every layer and routes per layer, rather than guessing one.
          const standOffMention = cell.layers?.some((layer) => layer.kind === "mention" && layer.standOff);
          if (stacked || standOffMention || cellHasAiLayer(cell)) { annot.openLayersInspector(span, cell); return; }
          if (cell.mention) { annot.openAnnotationEditor(span, cell); return; }
          if (semWrap) { annot.openAttrEditor(span, cell); return; }
        });
        span.addEventListener("dblclick", (e) => {
          e.stopPropagation();
          if (cell.node.type === "cdata") { setSourceMode("page"); return; }
          if (cell.gap) return;
          const c = app.state.cellById.get(cell.id);
          if (!c) return;
          // F4: a word whose text sits directly inside its <w> takes the two-field
          // diplomatic/normalized editor (the engine's atomic op accepts it). A <w>
          // wrapping further markup (e.g. <unclear>) is refused there, so it keeps
          // the single-field text edit.
          if (c.w && c.node.parent === c.w.el) beginReadingsInput(span, c);
          else beginTextInput(span, c);
        });
        span.addEventListener("mouseenter", () => highlightLine(folioIndex, lineIndex));
        span.addEventListener("mouseleave", () => clearLinks());
        body.appendChild(span);
      });
      row.appendChild(body);
      host.appendChild(row);
    });
  }

  function critTitle(cell, note, meta, semWrap) {
    if (cell.gap) return "gap: omitted or illegible text; click to remove";
    const parts = [];
    if (cell.mention) {
      // "unverified" is the one term for the unconfirmed-AI state everywhere
      // (index panel, standOff contract); label consistency is a rule.
      parts.push(meta
        ? `Linked to ${meta.name || "(unnamed)"} (${cell.mention})${meta.ai ? "; AI-proposed, unverified" : ""}`
        : `Linked to a missing entity (${cell.mention})`);
    }
    if (cell.crit) {
      // The tooltip uses the same human label as the legend and the chooser
      // buttons (CRITICAL_KINDS), never the raw TEI localName ("del"/"add").
      const critLabel = (CRITICAL_KINDS[cell.crit] || {}).label || cell.crit;
      parts.push(cell.critSole ? critLabel : `${critLabel} (shared markup)`);
    }
    if (note) parts.push(`note: ${note}`);
    // A proposed markup/criticism construct (a wrapping layer marked with the
    // responsibility id) reads as unverified AI, the same label as an AI mention.
    const layerAi = cellHasAiLayer(cell);
    if (layerAi && !(meta && meta.ai)) parts.push("AI-proposed, unverified");
    // F4: a dual-reading cell names the other reading, so the variant not on
    // screen is still visible in the tooltip.
    if (cell.w && cell.w.norm != null) {
      parts.push(app.readingVariant === "norm"
        ? `as written: ${cell.text.trim()}`
        : `normalized: ${cell.w.norm}`);
    }
    const stacked = cell.layers && cell.layers.length >= 2;
    const aiCell = cellHasAiLayer(cell);
    parts.push(stacked ? `click to inspect the ${cell.layers.length} annotations here; double-click to edit`
      : aiCell ? "click to review the AI proposal (confirm or reject); double-click to edit"
      : cell.mention ? "click to edit the annotation"
      : semWrap ? "click to edit attributes; select text to annotate; double-click to edit; right-click for actions"
      : "select text to annotate; double-click to edit; right-click for actions");
    return parts.join("; ");
  }

  return { renderFolioInto };
}
