/** Reading text input controls. Mutation, recovery and rendering are injected. */
import { el } from "./dom.js";
import { editCellCore, editCellReadings, splitEdge } from "./edition.js";

export function createInlineEditor(ctx) {
  const { app, stagedInput, replaceSessionState, setStatus, render, persistRecovery } = ctx;

  /** Plain correction input sized to the source cell's editing kind. */
  function beginTextInput(span, cell) {
    if (app.readOnly) return;
    if (!stagedInput.allowChange("opening another text editor")) return;
    // Edit only the trimmed core; the node's edge whitespace (indentation/newlines)
    // is re-attached on commit, so a line edit never collapses the surrounding
    // formatting. Word-level <w> nodes have no edge whitespace (core === cell.text).
    const [, core] = splitEdge(cell.text);

    // A word-level <w> cell is short and edits inline in a single-line input. A
    // line-level cell can be a whole paragraph, so it edits in a wrapping textarea
    // that grows to its content; a single-line input would clip the text off-screen.
    const multiline = cell.editingKind !== "token";
    let inp;
    if (multiline) {
      inp = el("textarea", { class: "ed-w-input ed-line-input", rows: "1" });
      inp.value = core;
      const autosize = () => { inp.style.height = "auto"; inp.style.height = `${inp.scrollHeight}px`; };
      inp.addEventListener("input", autosize);
      span.replaceWith(inp);
      inp.focus();
      inp.select();
      autosize();
    } else {
      inp = el("input", { class: "ed-w-input", type: "text", value: core });
      inp.style.width = `${Math.min(60, Math.max(2, core.length + 1))}ch`;
      inp.style.maxWidth = "100%";
      span.replaceWith(inp);
      inp.focus();
      inp.select();
    }

    let done = false;
    const commit = () => done || stagedInput.commit(() => {
      done = true;
      const nextCore = inp.value;
      if (nextCore !== core) {
        try {
          const nextState = editCellCore(app.state, cell.id, nextCore);
          replaceSessionState(nextState, "Edit text");
        } catch (err) {
          done = false;
          setStatus(`Edit failed: ${err.message}`);
          return false;
        }
      }
      render(); // re-render the folio with refreshed offsets
      return true;
    });
    const cancel = () => {
      if (done) return;
      done = true;
      stagedInput.clear();
      render();
      void persistRecovery();
    };
    inp.addEventListener("keydown", (e) => {
      if (e.isComposing) return;
      // Enter commits; in the multiline textarea Shift+Enter inserts a real newline.
      if (e.key === "Enter" && !(multiline && e.shiftKey)) { e.preventDefault(); commit(); }
      else if (e.key === "Escape") { e.preventDefault(); cancel(); }
    });
    inp.addEventListener("blur", commit);
    stagedInput.mount({
      hasChanges: () => !done && inp.value !== core,
      apply: commit,
      value: () => ({ core: inp.value }),
      restore: (value) => { inp.value = value.core; },
      dispose: () => { done = true; },
    }, { mode: "inline", folio: app.folio, cellId: cell.id });
    inp.addEventListener("input", () => persistRecovery());
  }

  /**
   * F4 two-field edit on a dual-reading word: the diplomatic core (text content,
   * @orig kept in sync by the engine) and the normalized reading (@norm). Used in
   * place of beginTextInput when the cell's text sits directly inside its <w>
   * (the dblclick handler gates this; the engine refuses a <w> that wraps further
   * markup). An empty Normalized field removes @norm, which claims no normalization.
   */
  function beginReadingsInput(span, cell) {
    if (app.readOnly) return;
    if (!stagedInput.allowChange("opening another text editor")) return;
    const [, core] = splitEdge(cell.text);
    const norm = cell.w.norm != null ? cell.w.norm : "";

    const form = el("span", { class: "ed-readings-form" });
    const field = (label, value) => {
      const wrap = el("label", { class: "ed-readings-field" });
      wrap.appendChild(el("span", { class: "ed-readings-label", text: label }));
      const inp = el("input", { class: "ed-w-input", type: "text", value });
      inp.style.width = `${Math.min(40, Math.max(2, value.length + 1))}ch`;
      inp.style.maxWidth = "100%";
      wrap.appendChild(inp);
      form.appendChild(wrap);
      return inp;
    };
    const diplInp = field("Diplomatic", core);
    const normInp = field("Normalized", norm);

    span.replaceWith(form);
    // Focus the field matching the current variant, so the variant on screen is
    // the one the cursor lands in.
    const focusInp = app.readingVariant === "norm" ? normInp : diplInp;
    focusInp.focus();
    focusInp.select();

    let done = false;
    const commit = () => done || stagedInput.commit(() => {
      done = true;
      const diplVal = diplInp.value;
      const normVal = normInp.value;
      if (diplVal !== core || normVal !== norm) {
        try {
          const next = editCellReadings(app.state, cell.id, { core: diplVal, norm: normVal });
          if (next !== app.state) {
            replaceSessionState(next, "Edit readings");
          }
          else {
            done = false;
            setStatus("Edit not applied: this word wraps further markup.");
            return false;
          }
        } catch (err) {
          done = false;
          setStatus(`Edit failed: ${err.message}`);
          return false;
        }
      }
      render();
      return true;
    });
    const cancel = () => {
      if (done) return;
      done = true;
      stagedInput.clear();
      render();
      void persistRecovery();
    };
    const onKey = (e) => {
      if (e.isComposing) return;
      if (e.key === "Enter") { e.preventDefault(); commit(); }
      else if (e.key === "Escape") { e.preventDefault(); cancel(); }
    };
    diplInp.addEventListener("keydown", onKey);
    normInp.addEventListener("keydown", onKey);
    // Commit only when focus leaves the whole form; moving between the two fields
    // (relatedTarget still inside the form) must not commit.
    form.addEventListener("focusout", (e) => {
      if (!form.contains(e.relatedTarget)) commit();
    });
    stagedInput.mount({
      hasChanges: () => !done && (diplInp.value !== core || normInp.value !== norm),
      apply: commit,
      value: () => ({ core: diplInp.value, norm: normInp.value }),
      restore: (value) => { diplInp.value = value.core; normInp.value = value.norm || ""; },
      dispose: () => { done = true; },
    }, { mode: "inline", folio: app.folio, cellId: cell.id });
    form.addEventListener("input", () => persistRecovery());
  }

  return { beginTextInput, beginReadingsInput };
}
