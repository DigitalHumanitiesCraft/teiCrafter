import { clear, el } from "./dom.js";
import { contentText, attr } from "./wenzels-xml.js";
import { createWitness, deleteWitness, updateWitness, updateWitnessXml, updateReadingWitnesses, witnessInventory, witnessReadingPolicy } from "./witness-model.js";

export function createWitnessWorkspace(ctx) {
  const { app, stagedInput, setStatus, persist, applyDocument, selectWitness } = ctx;
  let host = null, selected = "", creating = false, sessionId = null, apparatusKey = "", xmlMode = false;
  let pendingRestore = false;
  let attribution = false, readingKey = "";
  const notice = (text) => host.append(el("p", { class: "ed-wb-note", text }));
  const button = (text, action, disabled = false) => el("button", {
    type: "button", class: "ed-btn", text, disabled, onclick: action,
  });
  function change(action, operation) {
    if (!stagedInput.allowChange(action)) return false;
    stagedInput.clear(); operation(); return true;
  }
  function mutate(doc, label) {
    if (app.readOnly) throw new Error("Read-only mode prevents witness changes.");
    applyDocument(doc, label); render(host); void persist();
  }
  function select(label, options, value, onChange) {
    const control = el("select", { "aria-label": label });
    for (const [key, text, disabled = false] of options) control.append(el("option", { value: key, text, disabled }));
    control.value = value;
    control.addEventListener("change", () => { if (onChange(control.value) === false) control.value = value; });
    host.append(el("label", { class: "ed-wb-field" }, [el("span", { text: label }), control]));
    return control;
  }
  function form(doc, inventory, record) {
    const source = record && xmlMode ? { xml: doc.raw.slice(record.node.outerStart, record.node.outerEnd) }
      : record ? { id: record.id, description: record.description } : {
      id: "", description: "", listKey: inventory.lists[0]?.key || "",
    };
    const formNode = el("form", { class: "ed-wb-form", "aria-label": creating ? "New witness" : "Witness description" });
    const inputs = new Map();
    const specifications = xmlMode && record ? [["xml", "Witness XML"]] : [["id", "Witness identifier"], ["description", "Witness description"]];
    if (creating && inventory.lists.length > 1) specifications.push(["listKey", "Destination witness list"]);
    for (const [name, label] of specifications) {
      const input = ["description", "xml"].includes(name) ? el("textarea", { rows: name === "xml" ? "10" : "4", spellcheck: name !== "xml" }) : name === "listKey" ? el("select") : el("input", { type: "text" });
      if (name === "listKey") for (const list of inventory.lists) input.append(el("option", { value: list.key, text: list.label }));
      input.name = name; input.value = source[name]; input.required = name === "id" || name === "xml" || creating;
      input.disabled = !!app.readOnly || name !== "xml" && record?.kind !== "witness" && !!record || name === "description" && record?.editable === false;
      input.setAttribute("aria-label", label);
      inputs.set(name, input);
      formNode.append(el("label", { class: "ed-wb-field" }, [el("span", { text: label }), input]));
    }
    if (record && !record.editable && !xmlMode) formNode.append(el("p", { class: "ed-wb-note", text: "This description contains structured XML. Use Edit witness XML to edit it in its complete document context." }));
    const read = () => ({ ...source, ...Object.fromEntries([...inputs].map(([name, input]) => [name, input.value])) });
    let disposed = false;
    const changed = () => !disposed && Object.keys(source).some((name) => read()[name] !== source[name]);
    const message = el("p", { role: "status", class: "ed-wb-feedback" });
    const apply = () => {
      if (disposed || app.readOnly || !formNode.reportValidity()) return false;
      return stagedInput.commit(() => {
        try {
          const values = read();
          if (!changed() && !creating) { render(host); return true; }
          const next = creating ? createWitness(doc, values) : xmlMode ? updateWitnessXml(doc, record, values.xml, (raw) => {
            const parsed = new DOMParser().parseFromString(raw, "application/xml");
            const error = parsed.getElementsByTagName("parsererror")[0];
            return { ok: !error, message: error?.textContent || "" };
          }) : updateWitness(doc, record, values);
          selected = values.id || record?.key || ""; creating = false;
          mutate(next, "Edit witnesses"); return true;
        } catch (error) { message.textContent = error.message; setStatus(error.message); return false; }
      });
    };
    const cancel = () => { stagedInput.clear(); creating = false; render(host); void persist(); };
    const actions = el("div", { class: "ed-wb-actions" });
    actions.append(el("button", { type: "submit", class: "ed-btn", text: "Apply witness", disabled: !!app.readOnly }), button("Cancel", cancel));
    if (record?.kind === "witness") actions.append(button("Remove witness", () => {
      if (!stagedInput.allowChange("removing a witness")) return;
      stagedInput.commit(() => {
        try { const next = deleteWitness(doc, record); selected = ""; mutate(next, "Remove witness"); return true; }
        catch (error) { message.textContent = error.message; setStatus(error.message); return false; }
      });
    }, !!app.readOnly));
    if (record) actions.append(button(xmlMode ? "Description fields" : "Edit witness XML", () => change("changing witness editors", () => { xmlMode = !xmlMode; render(host); })));
    formNode.append(actions, message);
    formNode.addEventListener("submit", (event) => { event.preventDefault(); apply(); });
    formNode.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !event.isComposing) { event.preventDefault(); cancel(); }
    });
    formNode.addEventListener("input", () => { void persist(); });
    formNode.addEventListener("change", () => { void persist(); });
    host.append(formNode);
    stagedInput.mount({
      hasChanges: changed, apply, value: () => ({ selected, creating, fields: read() }),
      restore: (value) => { for (const [name, input] of inputs) if (typeof value.fields?.[name] === "string") input.value = value.fields[name]; },
      dispose: () => { disposed = true; },
    }, { mode: "witness", folio: app.folio });
  }
  function attributionForm(doc, inventory, item) {
    const candidates = item.readings.map((node) => ({ key: `offset:${node.outerStart}`, node }));
    if (!candidates.some((candidate) => candidate.key === readingKey)) readingKey = candidates[0]?.key || "";
    if (!readingKey) { notice("This apparatus entry has no lemma or reading to attribute."); return; }
    select("Reading to attribute", candidates.map((candidate, index) => [candidate.key,
      `${index + 1}. ${candidate.node.localName}: ${contentText(doc, candidate.node).trim().slice(0, 100) || "[empty reading]"}`]), readingKey,
    (value) => change("changing the attributed reading", () => { readingKey = value; render(host); }));
    const reading = candidates.find((candidate) => candidate.key === readingKey);
    const initial = attr(reading.node, "wit"), previous = initial.trim().split(/\s+/).filter(Boolean);
    const options = new Map(inventory.witnesses.filter((witness) => witness.unique).map((witness) => [`#${witness.id}`, `${witness.id}: ${witness.description.trim().slice(0, 90)}`]));
    for (const list of inventory.lists) if (list.id && inventory.ids.get(list.id) === list.node) options.set(`#${list.id}`, `${list.id}: witness group`);
    for (const target of previous) if (!options.has(target)) options.set(target, `${target} (existing unresolved or external pointer)`);
    const control = el("select", { multiple: true, size: Math.max(2, Math.min(8, options.size)), "aria-label": "Reading witnesses", disabled: !!app.readOnly });
    for (const [value, text] of options) control.append(el("option", { value, text, selected: previous.includes(value) }));
    const formNode = el("form", { class: "ed-wb-form", "aria-label": "Reading witness attribution" });
    formNode.append(el("label", { class: "ed-wb-field" }, [el("span", { text: "Reading witnesses" }), control]));
    formNode.append(el("p", { class: "ed-wb-note", text: "Select all witnesses or defined witness groups that attest this reading. Removing every selection removes @wit. Other reading attributes and content remain unchanged." }));
    const value = () => {
      const picked = [...control.selectedOptions].map((option) => option.value);
      return new Set(previous).size === picked.length && previous.every((target) => picked.includes(target)) ? initial : picked.join(" ");
    };
    let disposed = false;
    const message = el("p", { role: "status", class: "ed-wb-feedback" });
    const apply = () => {
      if (disposed || app.readOnly) return false;
      return stagedInput.commit(() => {
        try { mutate(updateReadingWitnesses(doc, item, reading, value()), "Attribute apparatus reading"); return true; }
        catch (error) { message.textContent = error.message; setStatus(error.message); return false; }
      });
    };
    formNode.append(el("button", { type: "submit", class: "ed-btn", text: "Apply attribution", disabled: !!app.readOnly }),
      button("Cancel attribution", () => { stagedInput.clear(); attribution = false; render(host); void persist(); }), message);
    formNode.addEventListener("submit", (event) => { event.preventDefault(); apply(); });
    formNode.addEventListener("change", () => { void persist(); });
    formNode.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !event.isComposing) { event.preventDefault(); stagedInput.clear(); attribution = false; render(host); void persist(); }
    });
    host.append(formNode);
    stagedInput.mount({
      hasChanges: () => !disposed && value() !== initial, apply,
      value: () => ({ selected, creating: false, fields: { appKey: item.key, readingKey, wit: value() } }),
      restore: (saved) => { const picked = String(saved.fields?.wit || "").split(/\s+/); for (const option of control.options) option.selected = picked.includes(option.value); },
      dispose: () => { disposed = true; },
    }, { mode: "witness", folio: app.folio });
  }
  function render(target) {
    if (!target || !app.state) return;
    host = target;
    if (stagedInput.hasChanges()) return;
    host.classList.add("ed-wb-workspace");
    if (sessionId !== app.sessionId) {
      sessionId = app.sessionId;
      if (!pendingRestore) { selected = ""; creating = false; apparatusKey = ""; xmlMode = false; attribution = false; readingKey = ""; }
    }
    pendingRestore = false;
    clear(host);
    const doc = app.state.doc, inventory = witnessInventory(doc);
    host.append(el("h2", { text: "Witnesses and readings" }));
    notice("Select explicit witness attestations for the reading view. This selection does not change XML. Unrecorded text outside apparatus entries remains the edition's base text.");
    const witnessOptions = [["", "Base text (lemma or first reading)"], ...inventory.witnesses.map((record) => [record.id || record.key,
      `${record.id || "Missing identifier"}: ${record.description.trim().slice(0, 90) || "Unnamed witness"}${record.unique ? "" : " (ambiguous identity)"}`, !record.unique])];
    if (app.readingWitness && !inventory.witnesses.some((record) => record.id === app.readingWitness && record.unique)) {
      witnessOptions.push([app.readingWitness, `${app.readingWitness} (missing or ambiguous definition)`, true]);
    }
    select("Reading witness", witnessOptions, app.readingWitness || "", (id) => change("changing the reading witness", () => {
      globalThis.getSelection?.()?.removeAllRanges(); selectWitness(id); render(host);
    }));
    if (inventory.unresolved.length) notice(`Unresolved or external witness pointers: ${inventory.unresolved.join(", ")}. External definitions are not fetched.`);
    if (inventory.apparatus.length) {
      if (!inventory.apparatus.some((item) => item.key === apparatusKey)) apparatusKey = inventory.apparatus[0].key;
      select("Apparatus entry", inventory.apparatus.map((item, index) => [item.key, `${index + 1}. ${item.id || "Unnamed entry"}${item.inline ? "" : " (linked apparatus)"}`]), apparatusKey,
        (id) => change("changing apparatus entries", () => { apparatusKey = id; render(host); }));
      const item = inventory.apparatus.find((entry) => entry.key === apparatusKey);
      const result = witnessReadingPolicy(doc, app.readingWitness || "").selections.get(item.node);
      host.append(el("p", { role: "status", class: "ed-witness-result", text: result.message }));
      if (!item.inline) notice("This entry is linked to the base text. Its attributed reading is inspected here; it is not substituted into the base text.");
      const list = el("ul");
      for (const reading of item.readings) list.append(el("li", { text: `${reading === result.branch ? "Selected: " : ""}${reading.localName} ${attr(reading, "wit") || "(no witness attribution)"}: ${contentText(doc, reading).trim() || "[empty reading]"}` }));
      host.append(list);
      if (!app.sourceMode) host.append(button("Edit witness attribution", () => change("editing witness attribution", () => { attribution = true; render(host); }), !!app.readOnly));
    }
    if (app.sourceMode) {
      notice("Return to Reading text to edit witness descriptions. The current XML or metadata editor retains unfinished input."); return;
    }
    if (attribution && inventory.apparatus.length) {
      attributionForm(doc, inventory, inventory.apparatus.find((entry) => entry.key === apparatusKey)); return;
    }
    host.append(button("New witness", () => change("creating a witness", () => { creating = true; selected = ""; xmlMode = false; render(host); }), !!app.readOnly));
    if (!creating && inventory.witnesses.length) {
      selected = (inventory.witnesses.find((item) => item.key === selected || item.id === selected) || inventory.witnesses[0]).key;
      select("Witness record", inventory.witnesses.map((item) => [item.key, `${item.id || "Missing identifier"}: ${item.description.trim().slice(0, 90)}`]), selected,
        (id) => change("changing witness records", () => { selected = id; render(host); }));
    }
    const record = creating ? null : inventory.witnesses.find((item) => item.key === selected || item.id === selected);
    if (creating || record) form(doc, inventory, record);
    else notice("No witness definitions are encoded. New witness creates a list in the TEI header's source description.");
  }
  return {
    render,
    prepareRestore: (value) => {
      selected = value?.selected || ""; creating = !!value?.creating; xmlMode = typeof value?.fields?.xml === "string";
      attribution = typeof value?.fields?.wit === "string";
      if (attribution) { apparatusKey = value.fields.appKey || ""; readingKey = value.fields.readingKey || ""; }
      pendingRestore = true;
    },
    dispose: () => { host = null; },
  };
}
