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

export function mountSourceView(host, opts = {}) {
  const wellFormed = typeof opts.wellFormed === "function" ? opts.wellFormed : () => ({ ok: true, message: "" });
  const onApply = typeof opts.onApply === "function" ? opts.onApply : () => true;
  const onCancel = typeof opts.onCancel === "function" ? opts.onCancel : () => {};

  const root = el("div", { class: "ed-src-root" });

  // ---- bar: check result + actions ----------------------------------------
  const result = el("span", { class: "ed-src-result", text: "" });
  const checkBtn = el("button", {
    class: "ed-btn", text: "Check XML",
    title: "Check well-formedness without applying (full RelaxNG/Schematron runs in the offline harness)",
  });
  const applyBtn = el("button", {
    class: "ed-btn ed-btn-primary", text: "Apply",
    title: "Re-parse the edited XML as the document (gated on well-formedness)",
  });
  const cancelBtn = el("button", {
    class: "ed-btn", text: "Cancel",
    title: "Back to the reading view, discarding source edits",
  });
  const bar = el("div", { class: "ed-src-bar" }, [result, checkBtn, applyBtn, cancelBtn]);

  // ---- editing surface: gutter + highlight overlay + textarea --------------
  const gutter = el("div", { class: "ed-src-gutter", "aria-hidden": "true" });
  const code = el("code", {});
  const pre = el("pre", { class: "ed-src-hl", "aria-hidden": "true" }, [code]);
  const ta = el("textarea", {
    class: "ed-src-ta", spellcheck: "false", wrap: "off",
    autocapitalize: "off", autocomplete: "off",
  });
  ta.value = opts.value || "";
  const stack = el("div", { class: "ed-src-stack" }, [pre, ta]);
  const wrap = el("div", { class: "ed-src-wrap" }, [gutter, stack]);

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
      for (let i = 1; i <= n; i++) nums += i + "\n";
      gutter.textContent = nums;
    }
  };
  const syncScroll = () => {
    pre.scrollTop = ta.scrollTop;
    pre.scrollLeft = ta.scrollLeft;
    gutter.scrollTop = ta.scrollTop;
  };

  let raf = 0;
  ta.addEventListener("input", () => {
    result.textContent = "";
    result.className = "ed-src-result";
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; refresh(); syncScroll(); });
  });
  ta.addEventListener("scroll", syncScroll);

  // ---- caret helpers --------------------------------------------------------
  const caretTo = (offset) => {
    const pos = Math.max(0, Math.min(offset, ta.value.length));
    ta.focus();
    ta.setSelectionRange(pos, pos);
    const before = ta.value.slice(0, pos).split("\n").length;
    const total = ta.value.split("\n").length || 1;
    ta.scrollTop = Math.max(0, (before / total) * ta.scrollHeight - ta.clientHeight / 2);
    syncScroll();
  };
  const caretToLineCol = (line, column) => {
    const lines = ta.value.split("\n");
    let off = 0;
    for (let i = 0; i < Math.min(line - 1, lines.length); i++) off += lines[i].length + 1;
    caretTo(off + Math.max(0, (column || 1) - 1));
  };

  // ---- actions --------------------------------------------------------------
  const runCheck = () => {
    const wf = wellFormed(ta.value);
    if (wf.ok) {
      result.className = "ed-src-result ok";
      result.textContent = "well-formed";
    } else {
      result.className = "ed-src-result err";
      result.textContent = wf.message;
      const pos = errorPosition(wf.message);
      if (pos) caretToLineCol(pos.line, pos.column);
    }
  };
  checkBtn.addEventListener("click", runCheck);
  applyBtn.addEventListener("click", () => {
    const wf = wellFormed(ta.value);
    if (!wf.ok) {
      result.className = "ed-src-result err";
      result.textContent = wf.message;
      const pos = errorPosition(wf.message);
      if (pos) caretToLineCol(pos.line, pos.column);
      return;
    }
    onApply(ta.value);
  });
  cancelBtn.addEventListener("click", onCancel);

  root.appendChild(bar);
  root.appendChild(wrap);
  host.appendChild(root);

  refresh();
  caretTo(opts.caret || 0);

  return { focus: () => ta.focus() };
}
