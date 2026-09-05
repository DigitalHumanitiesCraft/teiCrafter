/**
 * teiCrafter Editor -- editable XML source view (text mode).
 *
 * The Oxygen text-mode counterpart to the reading view: the canonical raw
 * string in an editable surface with syntax highlighting, line numbers and an
 * explicit well-formedness check. The highlighting is an overlay: a <pre>
 * carries the coloured tokens, a perfectly aligned transparent textarea on
 * top carries the caret and the edits, both kept in scroll lockstep. The
 * document itself is never touched here; Apply/Cancel report back through
 * hooks and the integrator owns parsing and state.
 *
 * Contract:
 *   mountSourceView(host, opts) with opts = {
 *     value,                 // the raw string to edit
 *     caret = 0,             // initial caret offset (scrolled into view)
 *     lineStart = 1,         // first displayed line's number in the document
 *     scopeLabel = "",       // visible source scope, e.g. the current page
 *     wellFormed(text),      // -> { ok, message } (DOMParser-based, integrator's)
 *     onApply(text),         // commit; return false to keep the view open
 *     onCancel(),            // discard
 *   }
 *
 * Styling: token-only classes (.ed-src-*, .xs-*) in editor.css. Violet stays
 * reserved for AI-origin content; the syntax palette uses the deterministic
 * families only.
 */

import { el } from "./dom.js";

// Above this size the overlay re-tokenisation would lag typing; the view
// falls back to an unhighlighted (but still numbered) surface.
const HIGHLIGHT_LIMIT = 1_500_000;

const escapeHtml = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** One tag (possibly unterminated): punctuation, name, attributes, close. */
function highlightTag(t) {
  const m = t.match(/^(<\/?)([A-Za-z_][\w:.-]*)?([\s\S]*?)(\/?>?)$/);
  if (!m) return escapeHtml(t);
  let out = `<span class="xs-punc">${escapeHtml(m[1])}</span>`;
  if (m[2]) out += `<span class="xs-tag">${escapeHtml(m[2])}</span>`;
  const rest = m[3];
  const attrRe = /([A-Za-z_][\w:.-]*)(\s*=\s*)("[^"]*"?|'[^']*'?)/g;
  let last = 0;
  let am;
  while ((am = attrRe.exec(rest)) !== null) {
    out += escapeHtml(rest.slice(last, am.index));
    out += `<span class="xs-attr">${escapeHtml(am[1])}</span>`
      + `<span class="xs-punc">${escapeHtml(am[2])}</span>`
      + `<span class="xs-val">${escapeHtml(am[3])}</span>`;
    last = am.index + am[0].length;
  }
  out += escapeHtml(rest.slice(last));
  out += `<span class="xs-punc">${escapeHtml(m[4])}</span>`;
  return out;
}

/**
 * Tokenise an XML string into highlighted HTML. Tolerant by design: an
 * unterminated comment/tag (mid-edit) is coloured as far as it goes instead
 * of breaking the overlay.
 */
export function highlightXml(src) {
  if (src.length > HIGHLIGHT_LIMIT) return escapeHtml(src);
  const re = /<!--[\s\S]*?(?:-->|$)|<!\[CDATA\[[\s\S]*?(?:\]\]>|$)|<\?[\s\S]*?(?:\?>|$)|<![^>]*>?|<\/?[^<>]*>?|&[A-Za-z#][\w]{0,9};/g;
  let out = "";
  let last = 0;
  let m;
  while ((m = re.exec(src)) !== null) {
    if (m.index > last) out += escapeHtml(src.slice(last, m.index));
    const t = m[0];
    if (t.startsWith("<!--")) out += `<span class="xs-comment">${escapeHtml(t)}</span>`;
    else if (t.startsWith("<![CDATA[") || t.startsWith("<?") || t.startsWith("<!"))
      out += `<span class="xs-pi">${escapeHtml(t)}</span>`;
    else if (t.startsWith("<")) out += highlightTag(t);
    else out += `<span class="xs-ent">${escapeHtml(t)}</span>`;
    last = m.index + t.length;
  }
  out += escapeHtml(src.slice(last));
  return out;
}

/** Extract "line N at column M" from a DOMParser parsererror message, or null. */
function errorPosition(message) {
  const m = /line (\d+)(?: at column (\d+))?/.exec(message || "");
  return m ? { line: Number(m[1]), column: m[2] ? Number(m[2]) : 1 } : null;
}

/** Determine whether the caret is completing an element, attribute or value. */
export function sourceCompletionContext(text, caret) {
  const at = Math.max(0, Math.min(Number(caret) || 0, text.length));
  const before = text.slice(0, at);
  const lt = before.lastIndexOf("<");
  if (lt < 0 || before.lastIndexOf(">") > lt) return null;
  const fragment = before.slice(lt + 1);
  if (/^[!?]/.test(fragment)) return null;

  const element = fragment.match(/^(\/?)([A-Za-z_][\w:.-]*)?$/);
  if (element) {
    const prefix = element[2] || "";
    return { kind: "element", prefix, element: null, replaceStart: at - prefix.length, replaceEnd: at };
  }

  const open = fragment.match(/^\/?([A-Za-z_][\w:.-]*)/);
  if (!open || /^\//.test(fragment)) return null;
  const elementName = open[1];
  const value = fragment.match(/(?:^|\s)([A-Za-z_][\w:.-]*)\s*=\s*(["'])([^"']*)$/);
  if (value) {
    const prefix = value[3];
    return {
      kind: "value", prefix, element: elementName, attribute: value[1],
      replaceStart: at - prefix.length, replaceEnd: at,
    };
  }

  // An unmatched quote means the caret is in an unrecognised value shape.
  let quote = null;
  for (const char of fragment) {
    if (quote) { if (char === quote) quote = null; }
    else if (char === '"' || char === "'") quote = char;
  }
  if (quote) return null;
  const attribute = fragment.match(/\s([A-Za-z_][\w:.-]*)?$/);
  if (!attribute || /=\s*$/.test(fragment)) return null;
  const prefix = attribute[1] || "";
  return {
    kind: "attribute", prefix, element: elementName,
    replaceStart: at - prefix.length, replaceEnd: at,
  };
}

function normalizedItems(items, valueKey = "name") {
  return (items || []).map((item) => typeof item === "string"
    ? { [valueKey]: item, description: "" }
    : item).filter((item) => item && item[valueKey]);
}

/** Filter the supplied document/project vocabulary for the current context. */
export function sourceCompletionItems(context, vocabulary = {}) {
  if (!context) return [];
  let items = [];
  let valueKey = "name";
  if (context.kind === "element") {
    items = normalizedItems(vocabulary.elements);
  } else {
    const local = (context.element || "").replace(/^.*:/, "");
    const attrs = vocabulary.attributes || {};
    const source = attrs[context.element] || attrs[local] || attrs["*"] || [];
    if (context.kind === "attribute") items = normalizedItems(source);
    else {
      const attr = normalizedItems(source).find((item) => item.name === context.attribute);
      items = normalizedItems(attr && attr.values, "value");
      valueKey = "value";
    }
  }
  const prefix = String(context.prefix || "").toLowerCase();
  return items
    .filter((item) => {
      const value = String(item[valueKey]).toLowerCase();
      return value.startsWith(prefix) && (!prefix || value !== prefix);
    })
    .sort((a, b) => String(a[valueKey]).localeCompare(String(b[valueKey])))
    .slice(0, 12);
}

/** Apply one completion and return the new source plus its caret position. */
export function applySourceCompletion(text, context, item) {
  if (!context || !item) return { text, caret: context ? context.replaceEnd : 0 };
  let insertion;
  let caretOffset;
  if (context.kind === "attribute") {
    insertion = `${item.name}=""`;
    caretOffset = item.name.length + 2;
  } else {
    insertion = context.kind === "value" ? item.value : item.name;
    caretOffset = insertion.length;
  }
  return {
    text: text.slice(0, context.replaceStart) + insertion + text.slice(context.replaceEnd),
    caret: context.replaceStart + caretOffset,
  };
}

export function mountSourceView(host, opts = {}) {
  const wellFormed = typeof opts.wellFormed === "function" ? opts.wellFormed : () => ({ ok: true, message: "" });
  const onApply = typeof opts.onApply === "function" ? opts.onApply : () => true;
  const onCancel = typeof opts.onCancel === "function" ? opts.onCancel : () => {};

  const root = el("div", { class: "ed-src-root" });
  const initialValue = opts.value || "";
  let originalValue = initialValue;
  const lineStart = Number.isInteger(opts.lineStart) && opts.lineStart > 0 ? opts.lineStart : 1;

  // ---- bar: check result + actions ----------------------------------------
  const scope = el("span", {
    class: "ed-src-scope",
    text: opts.scopeLabel || "Document XML",
    title: opts.scopeTitle || "The XML currently staged in this editor",
  });
  const result = el("span", { class: "ed-src-result", text: "" });
  const validation = el("span", {
    class: "ed-src-validation",
    text: opts.validationLabel || "Well-formedness · schema offline",
    title: opts.validationTitle || "The browser checks XML well-formedness. RelaxNG and Schematron run in the offline validation harness.",
  });
  const checkBtn = el("button", {
    class: "ed-btn", text: "Check XML",
    title: "Check the complete document with this staged XML in place (full RelaxNG/Schematron runs in the offline harness)",
  });
  const applyBtn = el("button", {
    class: "ed-btn ed-btn-primary", text: "Apply",
    title: "Apply this staged XML to the complete document (Ctrl/Cmd+Enter; gated on well-formedness)",
  });
  const cancelBtn = el("button", {
    class: "ed-btn", text: "Cancel",
    title: "Back to the reading view, discarding source edits",
  });
  const findBtn = el("button", {
    class: "ed-btn", text: "Find",
    title: "Find, replace and go to line (Ctrl/Cmd+F; Escape closes)",
  });
  const bar = el("div", { class: "ed-src-bar" }, [scope, validation, result, findBtn, checkBtn, applyBtn, cancelBtn]);

  // ---- find / replace / go-to-line bar (toggled, hidden by default) --------
  // Matching is literal and case-insensitive; edits stage in the textarea and
  // commit to the document only on Apply, like every other source edit.
  const findInput = el("input", { class: "ed-find-q", type: "text", placeholder: "Find", spellcheck: "false", "aria-label": "Find" });
  const replaceInput = el("input", { class: "ed-find-r", type: "text", placeholder: "Replace", spellcheck: "false", "aria-label": "Replace with" });
  const findCount = el("span", { class: "ed-src-find-count" });
  const prevBtn = el("button", { class: "ed-btn", text: "‹", title: "Previous match (Shift+Enter)" });
  const nextBtn = el("button", { class: "ed-btn", text: "›", title: "Next match (Enter)" });
  const replaceBtn = el("button", { class: "ed-btn", text: "Replace", title: "Replace the current match" });
  const replaceAllBtn = el("button", { class: "ed-btn", text: "All", title: "Replace every match" });
  const lnInput = el("input", { class: "ed-find-ln", type: "text", inputmode: "numeric", placeholder: "Ln", title: "Go to line number (Enter)", "aria-label": "Go to line" });
  const findBar = el("div", { class: "ed-src-find" }, [
    findInput, prevBtn, nextBtn, findCount,
    el("span", { class: "ed-src-find-sep" }),
    replaceInput, replaceBtn, replaceAllBtn,
    el("span", { class: "ed-src-find-sep" }),
    lnInput,
  ]);
  findBar.hidden = true;

  // ---- editing surface: gutter + highlight overlay + textarea --------------
  const gutter = el("div", { class: "ed-src-gutter", "aria-hidden": "true" });
  const code = el("code", {});
  const pre = el("pre", { class: "ed-src-hl", "aria-hidden": "true" }, [code]);
  const ta = el("textarea", {
    class: "ed-src-ta", spellcheck: "false", wrap: "off",
    autocapitalize: "off", autocomplete: "off",
    "aria-label": opts.scopeLabel || "XML source editor",
  });
  ta.value = initialValue;
  ta.readOnly = !!opts.readOnly;
  applyBtn.hidden = replaceInput.hidden = replaceBtn.hidden = replaceAllBtn.hidden = !!opts.readOnly;
  if (opts.readOnly) {
    cancelBtn.textContent = "Back to reading";
    scope.textContent += " · read only";
  }
  // Textareas expose normalised LF line endings even when the assigned XML uses
  // CRLF. Compare against the browser's staged representation so opening a page
  // never counts as an edit; the integrator restores the document's newline form.
  originalValue = ta.value;
  // Error-line band: a faint full-width highlight behind the text, shown on a
  // failed well-formedness check at the reported line. Behind the overlay so the
  // text stays crisp; cleared on the next edit.
  const errBand = el("div", { class: "ed-src-errband", "aria-hidden": "true" });
  errBand.hidden = true;
  const stack = el("div", { class: "ed-src-stack" }, [errBand, pre, ta]);
  const wrap = el("div", { class: "ed-src-wrap" }, [gutter, stack]);

  // Keyboard completion is a compact bar rather than a floating caret popup:
  // it stays aligned in the split pane and remains usable at every zoom level.
  const completionBar = el("div", {
    class: "ed-src-completions", id: "ed-src-completions", role: "listbox",
    "aria-label": "XML completions",
  });
  completionBar.hidden = true;
  ta.setAttribute("aria-controls", "ed-src-completions");
  ta.setAttribute("aria-expanded", "false");
  let completionContext = null;
  let completions = [];
  let completionIndex = 0;
  const closeCompletions = () => {
    completionBar.hidden = true;
    ta.setAttribute("aria-expanded", "false");
    completionContext = null;
    completions = [];
    completionIndex = 0;
  };
  const paintCompletionSelection = () => {
    [...completionBar.querySelectorAll("button")].forEach((button, index) => {
      button.classList.toggle("active", index === completionIndex);
      button.setAttribute("aria-selected", String(index === completionIndex));
    });
  };
  const acceptCompletion = (index = completionIndex) => {
    if (opts.readOnly) return false;
    const item = completions[index];
    if (!completionContext || !item) return false;
    const applied = applySourceCompletion(ta.value, completionContext, item);
    ta.value = applied.text;
    ta.setSelectionRange(applied.caret, applied.caret);
    closeCompletions();
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  };
  const updateCompletions = (forced = false) => {
    if (opts.readOnly) return;
    completionContext = sourceCompletionContext(ta.value, ta.selectionStart);
    completions = sourceCompletionItems(completionContext, opts.vocabulary || {});
    const show = completions.length > 0
      && (forced || completionContext.kind !== "element" || completionContext.prefix.length > 0);
    if (!show) { closeCompletions(); return; }
    completionIndex = 0;
    completionBar.replaceChildren(el("span", {
      class: "ed-src-completion-label",
      text: completionContext.kind === "element" ? "Elements"
        : completionContext.kind === "attribute" ? `Attributes of <${completionContext.element}>`
          : `Values of @${completionContext.attribute}`,
    }));
    completions.forEach((item, index) => {
      const value = item.name || item.value;
      const button = el("button", {
        class: "ed-src-completion", type: "button", role: "option", text: value,
        title: item.description || `Insert ${value}`,
      });
      button.addEventListener("mousedown", (event) => event.preventDefault());
      button.addEventListener("click", () => acceptCompletion(index));
      completionBar.appendChild(button);
    });
    completionBar.hidden = false;
    ta.setAttribute("aria-expanded", "true");
    paintCompletionSelection();
  };

  let lineCount = -1;
  const refresh = () => {
    const v = ta.value;
    // The trailing newline keeps the last line's metrics identical to the
    // textarea so the overlay never drifts by one line at the bottom.
    code.innerHTML = highlightXml(v) + "\n";
    const n = v.split("\n").length;
    if (n !== lineCount) {
      lineCount = n;
      let nums = "";
      for (let i = 0; i < n; i++) nums += (lineStart + i) + "\n";
      gutter.textContent = nums;
    }
  };
  const syncScroll = () => {
    pre.scrollTop = ta.scrollTop;
    pre.scrollLeft = ta.scrollLeft;
    gutter.scrollTop = ta.scrollTop;
    positionErrBand();
  };

  // ---- error-line band ------------------------------------------------------
  let errLine = null;
  const lineMetrics = () => {
    const cs = getComputedStyle(ta);
    let lh = parseFloat(cs.lineHeight);
    if (!Number.isFinite(lh)) lh = (parseFloat(cs.fontSize) || 0) * 1.5;
    return { lh, padTop: parseFloat(cs.paddingTop) || 0 };
  };
  function positionErrBand() {
    if (errLine == null) return;
    const { lh, padTop } = lineMetrics();
    errBand.style.height = lh + "px";
    errBand.style.top = (padTop + (errLine - 1) * lh - ta.scrollTop) + "px";
  }
  const markErrorLine = (line) => { errLine = line; errBand.hidden = false; positionErrBand(); };
  const clearErrorLine = () => { errLine = null; errBand.hidden = true; };

  let raf = 0;
  ta.addEventListener("input", () => {
    result.textContent = "";
    result.className = "ed-src-result";
    clearErrorLine();
    updateCompletions(false);
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; refresh(); syncScroll(); });
  });
  ta.addEventListener("scroll", syncScroll);
  ta.addEventListener("click", () => updateCompletions(false));

  // Small text-editor affordances that do not rewrite existing XML: Tab inserts
  // two spaces, Enter carries the current line's indentation, and Ctrl/Cmd+Enter
  // applies through the same full-document well-formedness gate as the button.
  const insertAtSelection = (text, caretDelta = text.length) => {
    if (opts.readOnly) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    ta.value = ta.value.slice(0, start) + text + ta.value.slice(end);
    ta.setSelectionRange(start + caretDelta, start + caretDelta);
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  };
  ta.addEventListener("keydown", (e) => {
    if (opts.readOnly || e.isComposing) return;
    if ((e.ctrlKey || e.metaKey) && e.key === " ") {
      e.preventDefault();
      updateCompletions(true);
      return;
    }
    if (!completionBar.hidden && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      const delta = e.key === "ArrowDown" ? 1 : -1;
      completionIndex = (completionIndex + delta + completions.length) % completions.length;
      paintCompletionSelection();
      return;
    }
    if (!completionBar.hidden && e.key === "Escape") {
      e.preventDefault();
      closeCompletions();
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      if (!completionBar.hidden && acceptCompletion()) return;
      insertAtSelection("  ");
      return;
    }
    if (e.key === "Enter" && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      const lineStart = ta.value.lastIndexOf("\n", ta.selectionStart - 1) + 1;
      const indent = /^\s*/.exec(ta.value.slice(lineStart, ta.selectionStart))[0];
      insertAtSelection("\n" + indent);
    }
  });

  // ---- caret helpers --------------------------------------------------------
  const selectRange = (start, end) => {
    const len = ta.value.length;
    const a = Math.max(0, Math.min(start, len));
    const b = Math.max(a, Math.min(end, len));
    ta.focus();
    ta.setSelectionRange(a, b);
    const before = ta.value.slice(0, a).split("\n").length;
    const total = ta.value.split("\n").length || 1;
    ta.scrollTop = Math.max(0, (before / total) * ta.scrollHeight - ta.clientHeight / 2);
    syncScroll();
  };
  const caretTo = (offset) => selectRange(offset, offset);
  const caretToLineCol = (line, column) => {
    const lines = ta.value.split("\n");
    const localLine = line - lineStart + 1;
    if (localLine < 1 || localLine > lines.length) return false;
    let off = 0;
    for (let i = 0; i < localLine - 1; i++) off += lines[i].length + 1;
    caretTo(off + Math.max(0, (column || 1) - 1));
    return true;
  };

  // ---- find / replace / go-to-line -----------------------------------------
  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let matches = [];
  let matchIdx = -1;
  const computeMatches = (q) => {
    matches = [];
    if (q) {
      const hay = ta.value.toLowerCase();
      const needle = q.toLowerCase();
      let i = 0;
      while ((i = hay.indexOf(needle, i)) !== -1) { matches.push(i); i += needle.length || 1; }
    }
    if (matchIdx >= matches.length) matchIdx = matches.length - 1;
  };
  const showCount = (msg) => {
    findCount.textContent = msg != null ? msg
      : matches.length ? `${matchIdx + 1}/${matches.length}`
      : (findInput.value ? "0/0" : "");
  };
  const clearResult = () => { result.textContent = ""; result.className = "ed-src-result"; };
  const gotoMatch = (delta) => {
    computeMatches(findInput.value);
    if (!matches.length) { showCount(); return; }
    matchIdx = ((matchIdx + delta) % matches.length + matches.length) % matches.length;
    const s = matches[matchIdx];
    selectRange(s, s + findInput.value.length);
    showCount();
  };
  const replaceCurrent = () => {
    if (opts.readOnly) return;
    if (!findInput.value) return;
    computeMatches(findInput.value);
    if (matchIdx < 0 || matchIdx >= matches.length) { gotoMatch(1); return; }
    const s = matches[matchIdx];
    ta.value = ta.value.slice(0, s) + replaceInput.value + ta.value.slice(s + findInput.value.length);
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    clearResult();
    refresh(); syncScroll();
    computeMatches(findInput.value);
    if (matches.length) { matchIdx = Math.min(matchIdx, matches.length - 1); gotoMatch(0); }
    else { matchIdx = -1; showCount(); }
  };
  const replaceAll = () => {
    if (opts.readOnly) return;
    const q = findInput.value;
    if (!q) return;
    let count = 0;
    ta.value = ta.value.replace(new RegExp(escRe(q), "gi"), () => { count++; return replaceInput.value; });
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    clearResult();
    refresh(); syncScroll();
    matchIdx = -1; matches = [];
    showCount(`${count} replaced`);
  };
  const gotoLine = () => {
    const n = parseInt(lnInput.value, 10);
    if (!Number.isFinite(n) || n <= 0) return;
    if (!caretToLineCol(n, 1)) {
      result.className = "ed-src-result";
      result.textContent = `Line ${n} is outside this page.`;
    }
  };
  const setFindOpen = (open) => {
    findBar.hidden = !open;
    if (open) { findInput.focus(); findInput.select(); computeMatches(findInput.value); showCount(); }
    else { showCount(""); ta.focus(); }
  };

  findBtn.addEventListener("click", () => setFindOpen(findBar.hidden));
  findInput.addEventListener("input", () => { computeMatches(findInput.value); showCount(); });
  findInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); gotoMatch(e.shiftKey ? -1 : 1); }
    else if (e.key === "Escape") { e.preventDefault(); setFindOpen(false); }
  });
  prevBtn.addEventListener("click", () => gotoMatch(-1));
  nextBtn.addEventListener("click", () => gotoMatch(1));
  replaceBtn.addEventListener("click", replaceCurrent);
  replaceAllBtn.addEventListener("click", replaceAll);
  lnInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); gotoLine(); } });
  root.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === "f" || e.key === "F")) { e.preventDefault(); setFindOpen(true); }
    else if (e.key === "Escape" && !findBar.hidden) { e.preventDefault(); setFindOpen(false); }
  });

  // ---- actions --------------------------------------------------------------
  const runCheck = () => {
    const wf = wellFormed(ta.value);
    if (wf.ok) {
      result.className = "ed-src-result ok";
      result.textContent = "well-formed";
      clearErrorLine();
    } else {
      result.className = "ed-src-result err";
      result.textContent = wf.message;
      const pos = errorPosition(wf.message);
      if (pos && caretToLineCol(pos.line, pos.column)) markErrorLine(pos.line - lineStart + 1);
    }
  };
  checkBtn.addEventListener("click", runCheck);
  const applyChanges = () => {
    if (opts.readOnly) return false;
    const wf = wellFormed(ta.value);
    if (!wf.ok) {
      result.className = "ed-src-result err";
      result.textContent = wf.message;
      const pos = errorPosition(wf.message);
      if (pos && caretToLineCol(pos.line, pos.column)) markErrorLine(pos.line - lineStart + 1);
      return false;
    }
    return onApply(ta.value) !== false;
  };
  applyBtn.addEventListener("click", applyChanges);
  ta.addEventListener("keydown", (e) => {
    if (!e.isComposing && (e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      applyChanges();
    }
  });
  cancelBtn.addEventListener("click", onCancel);

  root.appendChild(bar);
  root.appendChild(findBar);
  root.appendChild(completionBar);
  root.appendChild(wrap);
  host.appendChild(root);

  refresh();
  caretTo(opts.caret || 0);
  // A browser may restore the previous textarea's horizontal position after
  // focus, especially when switching between metadata and a minified page.
  // Every newly mounted exact source span starts at its left boundary.
  ta.scrollLeft = 0;
  syncScroll();
  requestAnimationFrame(() => {
    ta.scrollLeft = 0;
    syncScroll();
  });

  return {
    focus: () => ta.focus(),
    hasChanges: () => ta.value !== originalValue,
    value: () => ta.value,
    apply: applyChanges,
    restore: (value) => { ta.value = value; refresh(); },
  };
}
