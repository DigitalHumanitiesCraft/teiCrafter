import { clear, el } from "./dom.js";
import {
  applyEntryBatch, createEntry, deleteEntry, duplicateEntry, entryLinks, entryReferences,
  filterEntries, previewEntryBatch, readEntries, resolveEntry, updateEntry,
} from "./entry-model.js";

const PAGE_SIZE = 25;
const button = (text, onclick, props = {}) => el("button", { type: "button", class: "ed-btn", text, onclick, ...props });
const note = (text) => el("p", { class: "ed-wb-note", text });

/** One active document, one revision-owned form and one transaction per applied preview. */
export function createEntryWorkspace(ctx) {
  const { app, stagedInput, setStatus, persist, applyDocument } = ctx;
  let host = null;
  let session = null;
  let section = "detail";
  let selected = "";
  let kind = "dictionary";
  let query = "";
  let incomplete = false;
  let filterKind = "";
  let sort = "source";
  let offset = 0;
  let targets = new Set();
  let disposeForm = () => {};
  const doc = () => app.state?.doc;
  const fail = (error) => setStatus(error.message || String(error));

  function mutate(next, label, nextSelected = selected) {
    if (app.readOnly) throw new Error("Read-only mode prevents entry changes.");
    const changed = next !== doc();
    selected = nextSelected;
    if (changed) applyDocument(next, label);
    render(host);
    void persist();
    if (!changed) setStatus("No entry values changed. The source remains byte-identical.");
  }
  function navigate(nextSection, key = selected) {
    if (!stagedInput.allowChange("changing the entry workspace")) return false;
    stagedInput.clear();
    section = nextSection; selected = key;
    if (nextSection === "detail" && key) {
      try { ctx.selectEntry?.(key); } catch (error) { fail(error); }
    }
    render(host);
    host?.querySelector("form")?.scrollIntoView({ block: "start" });
    return true;
  }
  function formField(form, name, label, value, { multiline = false, options = null, readOnly = false, help = "", required = false } = {}) {
    const control = options ? el("select", { name, "aria-label": label })
      : el(multiline ? "textarea" : "input", { name, "aria-label": label, ...(multiline ? { rows: 5 } : { type: "text" }) });
    if (options) for (const [key, text] of options) control.append(el("option", { value: key, text }));
    control.value = value || "";
    control.disabled = app.readOnly || readOnly;
    control.required = required;
    const wrapper = el("label", { class: "ed-wb-field" }, [el("span", { text: label }), control]);
    if (help) {
      const id = `entry-help-${name}`;
      control.setAttribute("aria-describedby", id);
      wrapper.append(el("small", { id, text: help }));
    }
    form.append(wrapper);
    return control;
  }
  function mountForm(form, controls, apply, invalidated = () => {}) {
    const baseline = Object.fromEntries(Object.entries(controls).map(([key, control]) => [key, control.value]));
    let disposed = false;
    const values = () => Object.fromEntries(Object.entries(controls).map(([key, control]) => [key, control.value]));
    const changed = () => !disposed && Object.entries(values()).some(([key, value]) => value !== baseline[key]);
    const applyCurrent = () => {
      if (disposed || app.readOnly || !form.reportValidity()) return false;
      return stagedInput.commit(() => {
        try { return apply(values()) !== false; }
        catch (error) { fail(error); return false; }
      });
    };
    form.addEventListener("submit", (event) => { event.preventDefault(); applyCurrent(); });
    const onInput = () => { invalidated(); void persist(); };
    form.addEventListener("input", onInput);
    form.addEventListener("change", onInput);
    form.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault(); stagedInput.clear(); render(host); void persist();
    });
    disposeForm = () => { disposed = true; };
    stagedInput.mount({
      hasChanges: changed,
      value: () => ({ section, selected, kind, targets: [...targets], fields: values() }),
      apply: applyCurrent,
      restore(value) {
        if (!value || value.section !== section || value.selected !== selected) return;
        for (const [key, control] of Object.entries(controls)) if (typeof value.fields?.[key] === "string") control.value = value.fields[key];
        invalidated();
      },
      dispose: disposeForm,
    }, { mode: "entries", folio: app.folio });
    return applyCurrent;
  }
  function cancelButton() {
    return button("Cancel", () => { stagedInput.clear(); render(host); void persist(); });
  }

  function renderList() {
    const list = el("section", { "aria-label": "Entry list" });
    const search = el("input", { type: "search", "aria-label": "Search entries", placeholder: "Headword, text or ID" });
    search.value = query;
    const changeFilter = (control, value, action) => {
      if (!stagedInput.allowChange("filtering entries")) { control.value = value; return; }
      action(); offset = 0; render(host);
      const replacement = host.querySelector(`[aria-label="${control.getAttribute("aria-label")}"]`);
      replacement?.focus();
    };
    search.addEventListener("input", () => changeFilter(search, query, () => { query = search.value; }));
    list.append(el("label", { class: "ed-wb-field" }, [el("span", { text: "Search entries" }), search]));
    const incompleteControl = el("input", { type: "checkbox", "aria-label": "Incomplete entries only", checked: incomplete });
    incompleteControl.addEventListener("change", () => {
      if (!stagedInput.allowChange("filtering entries")) { incompleteControl.checked = incomplete; return; }
      incomplete = incompleteControl.checked; offset = 0; render(host);
    });
    list.append(el("label", {}, [incompleteControl, " Incomplete entries only"]));
    const kindControl = el("select", { "aria-label": "Entry encoding" });
    for (const [value, text] of [["", "All entry encodings"], ["dictionary", "Dictionary entries"], ["articles", "Encyclopedia articles"]]) kindControl.append(el("option", { value, text }));
    kindControl.value = filterKind;
    kindControl.addEventListener("change", () => changeFilter(kindControl, filterKind, () => { filterKind = kindControl.value; }));
    list.append(kindControl);
    const sortControl = el("select", { "aria-label": "Entry display order" });
    for (const [value, text] of [["source", "Source order"], ["headword", "Headword order"]]) sortControl.append(el("option", { value, text }));
    sortControl.value = sort;
    sortControl.addEventListener("change", () => changeFilter(sortControl, sort, () => { sort = sortControl.value; }));
    list.append(sortControl);
    const items = filterEntries(doc(), { query, incomplete, kind: filterKind, sort });
    offset = Math.min(offset, Math.max(0, Math.floor((items.length - 1) / PAGE_SIZE) * PAGE_SIZE));
    list.append(note(`${items.length} of ${readEntries(doc()).length} entries match. ${targets.size} selected for batch editing. Display sorting leaves source order unchanged.`));
    const table = el("table", { class: "ed-wb-table", "aria-label": "Entries" });
    table.append(el("thead", {}, [el("tr", {}, ["Select", "Headword or heading", "XML ID", "Completeness"].map((text) => el("th", { scope: "col", text })))]));
    const body = el("tbody");
    for (const item of items.slice(offset, offset + PAGE_SIZE)) {
      const selection = el("input", { type: "checkbox", "aria-label": `Select ${item.key}`, checked: targets.has(item.key) });
      selection.addEventListener("change", () => {
        if (!stagedInput.allowChange("changing the batch selection")) { selection.checked = targets.has(item.key); return; }
        if (selection.checked) targets.add(item.key); else targets.delete(item.key);
        render(host);
      });
      body.append(el("tr", {}, [
        el("td", {}, [selection]),
        el("td", {}, [button(item.headword || "Untitled entry", () => navigate("detail", item.key), { "aria-label": `Open entry ${item.key}`, "aria-pressed": selected === item.key })]),
        el("td", { text: item.id || "No XML ID" }),
        el("td", { text: item.issues.length ? item.issues.join("; ") : "Headword and text present" }),
      ]));
    }
    table.append(body); list.append(el("div", { class: "ed-entry-table-scroll", tabindex: "0", role: "region", "aria-label": "Scrollable entry rows" }, [table]));
    if (!items.length) list.append(note("No entries match these filters."));
    const actions = el("div", { class: "ed-wb-actions" }, [
      button("Previous entries", () => { if (stagedInput.allowChange("changing the entry page")) { offset -= PAGE_SIZE; render(host); } }, { disabled: offset === 0 }),
      button("Next entries", () => { if (stagedInput.allowChange("changing the entry page")) { offset += PAGE_SIZE; render(host); } }, { disabled: offset + PAGE_SIZE >= items.length }),
      button("Select all matching", () => { if (stagedInput.allowChange("changing the batch selection")) { targets = new Set(items.map((item) => item.key)); render(host); } }),
      button("Clear selection", () => { if (stagedInput.allowChange("changing the batch selection")) { targets.clear(); render(host); } }),
      button("Batch edit selected", () => navigate("batch"), { disabled: !targets.size || app.readOnly }),
      button("New entry", () => navigate("create"), { disabled: app.readOnly }),
      button("Next incomplete", () => {
        const unfinished = readEntries(doc()).filter((item) => item.incomplete);
        const index = unfinished.findIndex((item) => item.key === selected);
        if (unfinished.length) navigate("detail", unfinished[(index + 1) % unfinished.length].key);
      }, { disabled: !readEntries(doc()).some((item) => item.incomplete) }),
    ]);
    list.append(actions); host.append(list);
  }

  function renderDetail() {
    const item = resolveEntry(doc(), selected);
    kind = item.kind;
    const form = el("form", { class: "ed-wb-form", "aria-label": "Entry details" });
    form.append(el("h3", { text: `${item.kind === "dictionary" ? "Dictionary entry" : "Encyclopedia article"}: ${item.id || "no XML ID"}` }));
    if (item.issues.length) form.append(note(item.issues.join(". ") + ". Completeness describes these fields and is separate from schema validation."));
    const controls = {
      headword: formField(form, "headword", item.kind === "dictionary" ? "Headword" : "Article heading", item.headword, { readOnly: !item.editable.headword, help: item.editable.headword ? "The existing XML identifier stays unchanged." : "Structured or ambiguous heading. Use XML to edit this content." }),
      text: formField(form, "text", item.kind === "dictionary" ? "Definition" : "Article text", item.text, { multiline: true, readOnly: !item.editable.text, help: item.editable.text ? "Changes affect this text field only." : "Multiple or structured text targets. Use XML to retain their markup." }),
      language: formField(form, "language", "Entry language", item.language, { help: "Local xml:lang. Empty removes a local language override; inherited language may still apply." }),
      number: formField(form, "number", "Entry number", item.number, { help: "Local n attribute, independent of source order and XML ID." }),
    };
    form.append(el("div", { class: "ed-wb-actions" }, [el("button", { type: "submit", class: "ed-btn", text: "Apply entry", disabled: app.readOnly }), cancelButton()]));
    mountForm(form, controls, (values) => { mutate(updateEntry(doc(), item, values, { readOnly: app.readOnly }), "Edit entry"); });
    host.append(form);
    const actions = el("div", { class: "ed-wb-actions" });
    actions.append(button("Duplicate entry", () => {
      if (!stagedInput.allowChange("duplicating this entry")) return;
      try {
        const result = duplicateEntry(doc(), item, { readOnly: app.readOnly });
        mutate(result.doc, "Duplicate entry", result.id);
      } catch (error) { fail(error); }
    }, { disabled: app.readOnly }));
    const deletion = el("section", { "aria-label": "Deletion preview" });
    actions.append(button("Preview deletion", () => {
      if (!stagedInput.allowChange("previewing deletion")) return;
      clear(deletion);
      try {
        const source = doc();
        const refs = entryReferences(source, item);
        deletion.append(note(refs.length ? `Deletion blocked: ${refs.length} reference attribute(s) point into this entry.` : `Delete ${item.id || item.headword} and its complete XML subtree. One Undo restores the entry.`));
        for (const ref of refs) deletion.append(note(`${ref.id || ref.node.qname} @${ref.attribute}: ${ref.value}`));
        if (!refs.length) deletion.append(button("Confirm entry deletion", () => {
          if (!stagedInput.allowChange("deleting this entry")) return;
          try {
            if (source !== doc()) throw new Error("The deletion preview is stale. Preview the current entry again.");
            const next = deleteEntry(doc(), item, { readOnly: app.readOnly });
            targets.delete(item.key);
            mutate(next, "Delete entry", readEntries(next)[0]?.key || "");
          } catch (error) { fail(error); }
        }, { disabled: app.readOnly }));
      } catch (error) { fail(error); }
    }, { disabled: app.readOnly }));
    if (ctx.setSourceMode) actions.append(button("Edit entry XML", () => {
      if (stagedInput.allowChange("opening XML")) {
        try { ctx.selectEntry?.(item.key); ctx.setSourceMode("page"); } catch (error) { fail(error); }
      }
    }));
    host.append(actions, deletion);
    const links = entryLinks(doc(), item);
    if (links.length) {
      const region = el("section", { "aria-label": "Entry references" }, [el("h3", { text: "References" })]);
      for (const link of links) region.append(link.key
        ? button(`Follow #${link.id}`, () => navigate("detail", link.key))
        : note(`@${link.attribute}: #${link.id}${link.issue ? ` (${link.issue})` : " (target outside the entry collection)"}`));
      host.append(region);
    }
  }

  function renderCreate() {
    const anchor = selected ? resolveEntry(doc(), selected) : null;
    if (anchor) kind = anchor.kind;
    const form = el("form", { class: "ed-wb-form", "aria-label": "New entry" });
    form.append(el("h3", { text: "Create entry" }), note(anchor ? `Insert a ${kind === "dictionary" ? "dictionary entry" : "encyclopedia article"} after ${anchor.id || anchor.headword}.` : "Create the first entry in the document body."));
    const controls = {
      id: formField(form, "id", "New XML ID", "", { help: "Leave empty to allocate an unused ID." }),
      headword: formField(form, "headword", "New headword or heading", "", { required: true }),
      text: formField(form, "text", "New definition or article text", "", { multiline: true }),
      language: formField(form, "language", "New entry language", ""),
    };
    if (!anchor) controls.kind = formField(form, "kind", "New entry encoding", "", { required: true, options: [["", "Choose an encoding"], ["dictionary", "Dictionary entry (entry/form/sense)"], ["articles", "Encyclopedia article (div/head/p)"]] });
    form.append(el("div", { class: "ed-wb-actions" }, [el("button", { type: "submit", class: "ed-btn", text: "Create entry", disabled: app.readOnly }), cancelButton()]));
    mountForm(form, controls, (values) => {
      const { kind: explicitKind, ...fields } = values;
      if (!anchor) kind = explicitKind;
      const created = createEntry(doc(), fields, { after: anchor, kind, readOnly: app.readOnly });
      section = "detail";
      mutate(created.doc, "Create entry", created.id);
    });
    host.append(form);
  }

  function renderBatch() {
    const form = el("form", { class: "ed-wb-form", "aria-label": "Entry batch edit" });
    form.append(el("h3", { text: "Batch edit selected entries" }), note(`${targets.size} explicitly selected entries in this XML file. Review each before and after value. Applying the preview creates one Undo step.`));
    const controls = {
      field: formField(form, "field", "Batch field", "", { required: true, options: [["", "Choose a batch field"], ["language", "Entry language (xml:lang)"], ["number", "Entry number (n)"]] }),
      value: formField(form, "value", "Batch value", "", { help: "Empty removes a local attribute override. All other fields, nested markup and source order stay unchanged." }),
    };
    let preview = null;
    const previewHost = el("section", { "aria-label": "Batch preview", "aria-live": "polite" });
    const applyButton = el("button", { type: "submit", class: "ed-btn", text: "Apply batch preview", disabled: true });
    const invalidate = () => { preview = null; clear(previewHost); previewHost.append(note("Preview required for the current field and value.")); applyButton.disabled = true; };
    const prepare = () => {
      try {
        preview = previewEntryBatch(doc(), [...targets], { field: controls.field.value, value: controls.value.value });
        clear(previewHost);
        previewHost.append(note(`${preview.changed} of ${preview.selected} selected entries will change.`));
        const table = el("table", { class: "ed-wb-table", "aria-label": "Batch before and after" });
        table.append(el("thead", {}, [el("tr", {}, ["Entry", "Before", "After", "Change"].map((text) => el("th", { scope: "col", text })))]));
        table.append(el("tbody", {}, preview.changes.map((change) => el("tr", {}, [change.key, change.before || "No local value", change.after || "No local value", change.changed ? "Change" : "Unchanged"].map((text) => el("td", { text }))))));
        previewHost.append(el("div", { class: "ed-entry-table-scroll", tabindex: "0", role: "region", "aria-label": "Scrollable batch changes" }, [table]));
        applyButton.disabled = app.readOnly || !preview.changed;
      } catch (error) { invalidate(); fail(error); }
    };
    form.append(el("div", { class: "ed-wb-actions" }, [button("Preview batch", prepare, { disabled: app.readOnly }), applyButton, cancelButton()]));
    form.append(previewHost);
    mountForm(form, controls, () => {
      if (!preview || preview.field !== controls.field.value || preview.value !== controls.value.value) throw new Error("Preview the current batch values before applying.");
      const next = applyEntryBatch(doc(), preview, { readOnly: app.readOnly });
      section = "detail";
      mutate(next, `Batch edit ${preview.changed} entries`);
    }, invalidate);
    host.append(form);
    invalidate();
  }

  function render(element) {
    if (!element || !doc()) return;
    host = element;
    if (app.sourceMode) {
      disposeForm(); clear(host); host.classList.add("ed-entry-workspace", "ed-wb-workspace");
      host.append(el("h2", { text: "Entries" }), note("Use the editor on the left for XML source and metadata. Return to Reading text to use the entry forms."));
      return;
    }
    if (stagedInput.hasChanges()) return;
    stagedInput.clear(); disposeForm();
    if (session !== app.sessionId) {
      session = app.sessionId; section = "detail"; selected = ""; targets.clear(); query = ""; incomplete = false; filterKind = ""; offset = 0;
    }
    const entries = readEntries(doc());
    if (!selected && entries.length) selected = entries[0].key;
    clear(host); host.classList.add("ed-entry-workspace", "ed-wb-workspace");
    host.append(el("h2", { text: "Entries" }), note("Entry operations affect this open XML file. Deletion checks references to the entry and all its descendant IDs within this file. Linked files require their own review."));
    renderList();
    if (section !== "detail") host.append(button("Back to entry details", () => navigate("detail")));
    try {
      if (section === "batch") renderBatch();
      else if (section === "create") renderCreate();
      else if (entries.length) renderDetail();
      else host.append(note("This collection has no entries. Use New entry to continue its selected encoding."));
    } catch (error) { host.append(note(error.message)); }
  }
  function prepareRestore(value) {
    session = app.sessionId;
    section = ["detail", "create", "batch"].includes(value?.section) ? value.section : "detail";
    selected = typeof value?.selected === "string" ? value.selected : "";
    kind = value?.kind === "articles" ? "articles" : "dictionary";
    targets = new Set(Array.isArray(value?.targets) ? value.targets.filter((value) => typeof value === "string") : []);
  }
  function dispose() { disposeForm(); }
  return { render, prepareRestore, dispose };
}
