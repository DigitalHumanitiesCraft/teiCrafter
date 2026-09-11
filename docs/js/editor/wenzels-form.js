import { el } from "./dom.js";

/** Forms share the editor's revision ownership and recovery contract. */
export function mountWenzelsForm(host, { title, fields, values, identity, ctx, onApply, onDelete }) {
  const form = el("form", { class: "ed-wb-form", "aria-label": title });
  form.append(el("h3", { text: title }));
  const controls = new Map();
  const initial = {};
  for (const spec of fields) {
    const value = String(values[spec.key] ?? "");
    initial[spec.key] = value;
    const label = el("label", { class: "ed-wb-field" });
    label.append(el("span", { text: spec.label }));
    let input;
    if (spec.options) {
      input = el("select");
      if (spec.multiple) { input.multiple = true; input.size = Math.min(6, spec.options.length); }
      for (const option of spec.options) {
        const [key, text] = Array.isArray(option) ? option : [option, option];
        input.append(el("option", { value: key, text }));
      }
      const selected = spec.multiple ? value.split(/\s+/).filter(Boolean) : [value];
      for (const item of selected) if (![...input.options].some((option) => option.value === item)) input.append(el("option", { value: item, text: item || "Choose" }));
      for (const option of input.options) option.selected = selected.includes(option.value);
    } else if (spec.multiline) {
      input = el("textarea", { rows: spec.rows || 3 });
      input.value = value;
    } else input = el("input", { type: spec.type || "text", value });
    if (spec.required) input.required = true;
    if (spec.placeholder) input.placeholder = spec.placeholder;
    if (spec.list) input.setAttribute("list", spec.list);
    input.disabled = ctx.readOnly() || spec.readOnly === true;
    input.name = spec.key;
    input.setAttribute("aria-label", spec.label);
    if (spec.multiple) input.dataset.initialSelection = value;
    controls.set(spec.key, input);
    label.append(input);
    if (spec.help) {
      const id = `wb-help-${spec.key}`;
      input.setAttribute("aria-describedby", id);
      label.append(el("small", { id, text: spec.help }));
    }
    form.append(label);
  }
  const controlValue = (input) => {
    if (!input.multiple) return input.value;
    const picked = [...input.selectedOptions].map((option) => option.value);
    const before = input.dataset.initialSelection.split(/\s+/).filter(Boolean);
    if (before.length === picked.length && before.every((item) => picked.includes(item))) return input.dataset.initialSelection;
    return [...before.filter((item) => picked.includes(item)), ...picked.filter((item) => !before.includes(item))].join(" ");
  };
  const read = () => Object.fromEntries([...controls].map(([key, input]) => [key, controlValue(input)]));
  const changed = () => Object.keys(initial).some((key) => controlValue(controls.get(key)) !== initial[key]);
  let disposed = false;
  const message = el("p", { class: "ed-wb-feedback", role: "status" });
  const apply = () => {
    if (disposed || ctx.readOnly() || !form.reportValidity()) return false;
    return ctx.stagedInput.commit(() => {
      try {
        if (!changed()) { ctx.refresh(); return true; }
        onApply(read());
        return true;
      } catch (error) {
        message.textContent = error.message;
        ctx.status(error.message);
        return false;
      }
    });
  };
  const actions = el("div", { class: "ed-wb-actions" });
  actions.append(el("button", { type: "submit", class: "ed-btn", text: "Apply", disabled: ctx.readOnly() }));
  actions.append(el("button", {
    type: "button", class: "ed-btn", text: "Cancel",
    onclick: () => { ctx.stagedInput.clear(); ctx.refresh(); void ctx.persist(); },
  }));
  if (onDelete) actions.append(el("button", {
    type: "button", class: "ed-btn", text: "Remove annotation", disabled: ctx.readOnly(),
    onclick: () => {
      if (!ctx.stagedInput.allowChange("removing this annotation")) return;
      try { onDelete(); } catch (error) { message.textContent = error.message; }
    },
  }));
  form.append(actions, message);
  form.addEventListener("submit", (event) => { event.preventDefault(); apply(); });
  form.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !event.isComposing) {
      event.preventDefault(); ctx.stagedInput.clear(); ctx.refresh(); void ctx.persist();
    }
  });
  form.addEventListener("input", () => { void ctx.persist(); });
  form.addEventListener("change", () => { void ctx.persist(); });
  host.append(form);
  ctx.stagedInput.mount({
    hasChanges: () => !disposed && changed(), apply,
    value: () => ({ ...identity, fields: read() }),
    restore: (value) => {
      for (const [key, input] of controls) if (typeof value.fields?.[key] === "string") {
        if (input.multiple) for (const option of input.options) option.selected = value.fields[key].split(/\s+/).includes(option.value);
        else input.value = value.fields[key];
      }
    },
    dispose: () => { disposed = true; },
  }, { mode: "wenzels", folio: ctx.folio() });
  return { form, controls, message };
}
