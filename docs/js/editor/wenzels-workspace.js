import { el, clear } from "./dom.js";
import { parseDocument, getXmlId, getAttr, teiElementsByLocal, readSurfaces } from "./tei-document.js";
import { readImageAnnotations, updateImageAnnotation, createImageAnnotation, indexWenzelsCodex, validateImageAnnotationPointers } from "./wenzels-image-model.js";
import { readWenzelsWords, updateWenzelsWord, readWenzelsComments, createWenzelsComment, updateWenzelsComment, removeWenzelsComment, readBibleVerseMappings, addBibleVerseMapping, updateBibleVerseMapping, removeBibleVerseMapping } from "./wenzels-text-model.js";
import { createWenzelsRegistersDocument, readWenzelsRegisters, createWenzelsRegisterEntry, updateWenzelsRegisterEntry, removeWenzelsRegisterEntry, readWenzelsRegisterLinks, addWenzelsRegisterLink, updateWenzelsRegisterLink, removeWenzelsRegisterLink } from "./wenzels-register-model.js";
import { mountWenzelsForm } from "./wenzels-form.js";
import { decodeXmlBytes } from "./file-encoding.js";
import { mountIconclassLookup } from "./iconclass-lookup.js";
import { mountPageXmlImport } from "./page-xml-onramp.js";
import { validateWithSchemas } from "./schema-validation.js";
import { WENZELS_EDITORIAL_SCHEMA_URL } from "./wenzels-profile.js";
import { checkWenzelsRegisters, referencesRegisterId, singleBranchChoices, keepSingleChoiceBranch, choiceLabel } from "./wenzels-project-checks.js";
import { createFacsimile, plainImageTileSource } from "./facsimile.js";
import { projectTileSource } from "./project-profiles.js";

const SECTIONS = [
  ["diplomatic", "Transcription"], ["commentary", "Commentary"],
  ["bible-verse", "Bible verses"], ["image-annotation", "Image annotations"],
  ["registers", "Registers"], ["checks", "Project checks"], ["import", "Import PAGE XML"],
];
const pointers = (value) => String(value || "").trim().split(/\s+/).filter(Boolean);
const field = (key, label, extra = {}) => ({ key, label, ...extra });

/** A project workspace edits the active session and reads explicitly attached companions. */
export function createWenzelsWorkspace(ctx) {
  const { app, stagedInput, setStatus, persist, applyDocument, loadDocument } = ctx;
  let host = null;
  let section = "diplomatic";
  let selected = "";
  let sessionId = null;
  let wordOffset = 0;
  let referenceOffset = 0;
  let importForm = null;
  let imageViewer = null;
  const attachments = new Map();
  let cache = new WeakMap();
  const memo = (doc, key, build) => {
    if (!doc) return null;
    if (!cache.has(doc)) cache.set(doc, new Map());
    const values = cache.get(doc);
    if (!values.has(key)) values.set(key, build(doc));
    return values.get(key);
  };
  const activeDoc = () => app.state?.doc;
  const words = (doc) => memo(doc, "words", readWenzelsWords) || [];
  const imageInventory = (doc) => memo(doc, "images", readImageAnnotations);
  const hasImages = (doc) => !!imageInventory(doc)?.items.length;
  const codex = () => words(activeDoc()).length ? { doc: activeDoc(), name: app.docName } : attachments.get("codex");
  const registers = () => {
    const doc = activeDoc();
    return getAttr(teiElementsByLocal(doc.root, "TEI")[0], "type") === "wenzelsbibel-registers"
      || (/register/i.test(app.docName) && !words(doc).length && !hasImages(doc))
      ? { doc, name: app.docName } : attachments.get("registers");
  };
  const formContext = {
    stagedInput, readOnly: () => app.readOnly, folio: () => app.folio,
    status: setStatus, persist, refresh: () => render(host),
  };
  function mutate(doc, label) {
    applyDocument(doc, label);
    render(host);
    void persist();
  }
  function navigate(nextSection, id = "") {
    if (!stagedInput.allowChange("changing the Wenzelsbibel form")) return;
    stagedInput.clear(); section = nextSection; selected = id; render(host);
  }
  function note(text) { host.append(el("p", { class: "ed-wb-note", text })); }
  function action(text, fn, extra = {}) {
    return el("button", { type: "button", class: "ed-btn", text, onclick: fn, ...extra });
  }
  function selectRecord(records, label, labelFor) {
    const control = el("select", { "aria-label": label });
    control.append(el("option", { value: "", text: `New ${label.toLowerCase()}` }));
    for (const record of records) control.append(el("option", { value: String(record.id || record.key), text: labelFor(record) }));
    control.value = selected;
    control.addEventListener("change", () => {
      if (!stagedInput.allowChange("changing records")) { control.value = selected; return; }
      stagedInput.clear(); selected = control.value; render(host);
    });
    host.append(el("label", { class: "ed-wb-field" }, [el("span", { text: label }), control]));
    return records.find((record) => String(record.id || record.key) === selected) || null;
  }
  function form(title, specs, values, apply, remove = null) {
    return mountWenzelsForm(host, {
      title, fields: specs, values, identity: { section, selected }, ctx: formContext,
      onApply: apply, onDelete: remove,
    });
  }
  function rememberActive() {
    const current = { doc: activeDoc(), name: app.docName, encoding: app.fileEncoding };
    const role = hasImages(current.doc) ? "images" : words(current.doc).length ? "codex" : "registers";
    attachments.set(role, current);
  }
  async function openCompanion(entry, targetSection = null, id = "") {
    if (!stagedInput.allowChange("opening a linked document")) return;
    rememberActive();
    await loadDocument(entry.doc.raw, entry.name, app.project, false, entry.encoding);
    if (targetSection && activeDoc()?.raw === entry.doc.raw) navigate(targetSection, id);
  }
  async function attach(role, file) {
    if (!file || !stagedInput.allowChange("attaching a reference document")) return;
    const owner = app.sessionId;
    setStatus(`Reading ${file.name} as a reference document...`);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    try {
      const decoded = decodeXmlBytes(new Uint8Array(await file.arrayBuffer()));
      const doc = parseDocument(decoded.text);
      if (owner !== app.sessionId) return;
      if (role === "codex" && !words(doc).length) throw new Error("The attached codex has no TEI words.");
      if (role === "images" && !hasImages(doc)) throw new Error("The attached document has no image-annotation items.");
      attachments.set(role, { doc, name: file.name, encoding: decoded });
      referenceOffset = 0;
      if (app.panel === "wenzels") render(host);
      setStatus(`${file.name} attached for reference lookup. Its source remains unchanged.`);
    } catch (error) { setStatus(`Reference document could not be attached: ${error.message}`); }
  }
  function attachmentControls() {
    const details = el("details", { class: "ed-wb-resources" });
    details.append(el("summary", { text: "Linked project documents" }));
    details.append(el("p", { text: "Attach local companions for cross-file lookup. Edit and save each file in the main editor. Reattach reference files after a reload." }));
    for (const [role, label] of [["codex", "Codex"], ["images", "Image annotations"], ["registers", "Registers"]]) {
      const input = el("input", { type: "file", accept: ".xml", "aria-label": `Attach ${label}` });
      input.addEventListener("change", () => { void attach(role, input.files[0]); });
      details.append(el("label", { class: "ed-wb-field" }, [el("span", { text: `Attach ${label}` }), input]));
      const entry = attachments.get(role);
      if (entry) details.append(el("div", { class: "ed-wb-resource" }, [
        el("span", { text: entry.name }), action("Open for editing", () => openCompanion(entry)),
      ]));
    }
    details.append(action("New shared registers", async () => {
      if (!stagedInput.allowChange("creating shared registers")) return;
      rememberActive();
      const doc = createWenzelsRegistersDocument();
      await loadDocument(doc.raw, "registers.xml", app.project, true);
    }, { disabled: app.readOnly }));
    host.append(details);
  }

  function referencePicker(formResult, startKey = "from", endKey = "to") {
    const reference = codex();
    if (!reference) { note("Attach the codex to choose and verify text endpoints."); return; }
    const all = words(reference.doc);
    const fromValue = formResult.controls.get(startKey)?.value.replace(/^#/, "");
    const initialIndex = all.findIndex((word) => word.id === fromValue);
    if (initialIndex >= 0) referenceOffset = initialIndex;
    const box = el("details", { class: "ed-wb-reference" });
    box.append(el("summary", { text: `Select a word range in ${reference.name}` }));
    const search = el("input", { type: "search", placeholder: "Word or XML ID", "aria-label": "Find reference word" });
    const target = el("select", { "aria-label": "Range endpoint to set" }, [el("option", { value: startKey, text: "Start word" }), el("option", { value: endKey, text: "End word" })]);
    const page = el("div", { class: "ed-wb-word-picker" });
    const position = el("span", { role: "status" });
    const draw = () => {
      clear(page);
      referenceOffset = Math.max(0, Math.min(referenceOffset, Math.max(0, all.length - 1)));
      for (const word of all.slice(referenceOffset, referenceOffset + 60)) {
        page.append(action(word.dipl || word.text || word.id, () => {
          const input = formResult.controls.get(target.value);
          if (!input || input.disabled) return;
          input.value = word.id;
          input.dispatchEvent(new Event("input", { bubbles: true }));
          if (target.value === startKey) target.value = endKey;
        }, { title: word.id, disabled: app.readOnly }));
      }
      position.textContent = `${referenceOffset + 1}–${Math.min(all.length, referenceOffset + 60)} of ${all.length} words`;
    };
    search.addEventListener("input", () => {
      const value = search.value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
      if (!value) return;
      const index = all.findIndex((word) => `${word.id} ${word.dipl} ${word.norm} ${word.text}`.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().includes(value));
      if (index >= 0) { referenceOffset = index; draw(); }
    });
    box.append(search, target, page, el("div", { class: "ed-wb-actions" }, [
      action("Previous words", () => { referenceOffset -= 60; draw(); }), position,
      action("Next words", () => { referenceOffset += 60; draw(); }),
    ]));
    draw(); host.append(box);
  }

  function renderTranscription() {
    const doc = activeDoc();
    const current = app.state.folios[app.folio];
    const ids = new Set((current?.lines || []).flatMap((line) => line.cells).map((cell) => cell.w?.id || getXmlId(cell.w?.el)));
    const all = words(doc);
    let pageWords = all.filter((word) => ids.has(word.id));
    if (!pageWords.length) {
      const range = current?.navigationUnit;
      pageWords = range ? all.filter((word) => word.start >= range.start && word.start < range.end) : all;
    }
    if (!pageWords.length) { note("Open the codex to edit its diplomatic and normalized readings."); return; }
    note("Select a word to edit both readings. The facsimile and the reading text remain available in their usual views.");
    const table = el("table", { class: "ed-wb-readings" });
    table.append(el("thead", {}, [el("tr", {}, [el("th", { scope: "col", text: "Diplomatic" }), el("th", { scope: "col", text: "Normalized" })])]));
    const body = el("tbody");
    for (const word of pageWords.slice(wordOffset, wordOffset + 40)) body.append(el("tr", {}, [
      el("td", {}, [action(word.dipl || word.text || "(empty)", () => navigate(section, word.id), { title: word.id })]),
      el("td", { text: word.norm || "" }),
    ]));
    table.append(body); host.append(el("div", { class: "ed-wb-readings-scroll" }, [table]));
    host.append(el("div", { class: "ed-wb-actions" }, [
      action("Previous words", () => { if (stagedInput.allowChange("changing words")) { wordOffset = Math.max(0, wordOffset - 40); render(host); } }),
      el("span", { text: `${wordOffset + 1}–${Math.min(pageWords.length, wordOffset + 40)} of ${pageWords.length}` }),
      action("Next words", () => { if (stagedInput.allowChange("changing words")) { wordOffset = Math.min(Math.max(0, pageWords.length - 40), wordOffset + 40); render(host); } }),
    ]));
    const word = pageWords.find((item) => item.id === selected) || pageWords[0];
    selected = word.id;
    const mixed = word.node.children?.some((node) => node.type === "element");
    form(`Word ${word.id}`, [
      field("dipl", "Diplomatic reading", { readOnly: mixed, help: mixed ? "This word contains markup. Edit its diplomatic content in XML source; normalization remains editable." : "Updates word text and @orig together." }),
      field("norm", "Normalized reading", { help: "The stored @norm reading; original inline markup is preserved." }),
    ], word, (values) => {
      const patch = {};
      if (values.norm !== word.norm) patch.norm = values.norm;
      if (!mixed && values.dipl !== word.dipl) { patch.text = values.dipl; patch.dipl = values.dipl; }
      mutate(updateWenzelsWord(doc, word.id, patch), "Edit Wenzelsbibel readings");
    });
    const images = attachments.get("images");
    if (images) {
      const index = memo(doc, "codex-index", indexWenzelsCodex);
      const related = imageInventory(images.doc).items.filter((item) => {
        const range = /^#range\(\s*([^,]+),\s*([^\)]+)\)$/.exec(item.range || "");
        if (!range) return false;
        const from = range[1].trim().replace(/^#/, ""), to = range[2].trim().replace(/^#/, "");
        if (index.duplicates.has(from) || index.duplicates.has(to)) return false;
        const first = index.byId.get(from), last = index.byId.get(to);
        return first && last && first.outerStart <= word.start && last.outerEnd >= word.end;
      });
      if (related.length) {
        const box = el("div", { class: "ed-wb-reference" }, [el("h3", { text: "Images referring to this word" })]);
        for (const item of related) box.append(action(item.title || item.id, () => openCompanion(images, "image-annotation", item.id)));
        host.append(box);
      }
    }
  }

  function renderCommentary() {
    const doc = activeDoc();
    if (!words(doc).length) { note("Open the codex to annotate text passages with apparatus comments."); return; }
    const records = memo(doc, "comments", readWenzelsComments);
    const record = selectRecord(records, "Apparatus comment", (item) => `${item.type || "untyped"}: ${item.notes.map((n) => n.text).join(" / ").slice(0, 90)}`);
    const values = record ? { type: record.type, from: record.from || "", to: record.to || "" }
      : { type: "comment_edition", from: "", to: "" };
    const noteFields = [];
    for (const [index, item] of (record?.notes || []).entries()) {
      values[`text-${index}`] = item.text; values[`lang-${index}`] = item.lang || ""; values[`resp-${index}`] = item.resp || "";
      const mixed = item.node.children?.some((node) => node.type === "element");
      noteFields.push(field(`text-${index}`, `Note ${index + 1}`, { multiline: true, readOnly: mixed,
        ...(mixed ? { help: "This note contains inline markup. Edit its text in XML source." } : {}) }),
        field(`lang-${index}`, `Language of note ${index + 1}`), field(`resp-${index}`, `Responsibility for note ${index + 1}`));
    }
    values.newLang = "de";
    noteFields.push(field("newText", record ? "Additional note" : "Comment text", { multiline: true, required: !record }),
      field("newLang", "Language of new note", { options: [["de", "German"], ["en", "English"], ["la", "Latin"]] }),
      field("newResp", "Responsibility for new note", { placeholder: "#editor" }));
    const f = form(record ? "Edit apparatus comment" : "New apparatus comment", [
      field("type", "Comment type", { options: [["comment_edition", "Editorial comment"], ["comment_understanding", "Interpretative comment"]] }),
      field("from", record ? "Start anchor" : "First word ID", { required: !record }),
      field("to", record ? "End anchor" : "Last word ID", { required: !record }),
      ...noteFields,
    ], values, (v) => {
      const notes = (record?.notes || []).map((item, index) => ({ index, text: v[`text-${index}`], lang: v[`lang-${index}`], resp: v[`resp-${index}`] }));
      if (v.newText.trim()) notes.push({ index: notes.length, text: v.newText, lang: v.newLang, resp: v.newResp });
      const patch = { notes };
      for (const key of ["type", "from", "to"]) if (v[key] !== values[key]) patch[key] = v[key];
      const next = record ? updateWenzelsComment(doc, record, patch)
        : createWenzelsComment(doc, { from: v.from, to: v.to }, { type: v.type, notes });
      const updated = readWenzelsComments(next);
      selected = record ? updated[records.indexOf(record)]?.id || updated[records.indexOf(record)]?.key || ""
        : updated.find((item) => !records.some((previous) => previous.id === item.id))?.id || "";
      mutate(next, "Edit Wenzelsbibel apparatus");
    }, record ? () => { selected = ""; mutate(removeWenzelsComment(doc, record), "Remove apparatus comment"); } : null);
    if (!record) referencePicker(f);
    note("New comments use listApp/app with boundary anchors. Existing apparatus types and responsibility statements retain their encoded meaning.");
  }

  function renderVerses() {
    const doc = activeDoc();
    if (!words(doc).length) { note("Open the codex to map passages to Vulgate references."); return; }
    const records = memo(doc, "verses", readBibleVerseMappings);
    const record = selectRecord(records, "Verse mapping", (item) => item.reference || item.id || item.key);
    const f = form(record ? "Edit verse mapping" : "New verse mapping", [
      field("reference", "Book, chapter and verse", { required: true, placeholder: "Gen 1:1", help: "Use the reference system of the cited Vulgate edition. Psalm numbering must follow that edition." }),
      field("from", "First word ID", { required: true }), field("to", "Last word ID", { required: true }),
      field("cRef", "Canonical Vulgate reference", { placeholder: "Gen 1:1" }),
      field("quote", "Latin text", { multiline: true, help: "Enter the text from the reference edition. This field is never generated automatically." }),
      field("note", "Comment and reference edition", { multiline: true }), field("resp", "Editor responsibility", { placeholder: "#editor" }),
    ], record || {}, (v) => {
      const next = record ? updateBibleVerseMapping(doc, record, v) : addBibleVerseMapping(doc, { from: v.from, to: v.to }, v);
      const updated = readBibleVerseMappings(next);
      selected = record ? updated[records.indexOf(record)]?.id || updated[records.indexOf(record)]?.key || ""
        : updated.find((item) => !records.some((previous) => previous.id === item.id))?.id || "";
      mutate(next, "Edit Bible verse mapping");
    }, record ? () => { selected = ""; mutate(removeBibleVerseMapping(doc, record), "Remove verse mapping"); } : null);
    referencePicker(f);
    note("Mappings are independent stand-off spans. A passage may have several references, and a reference may cover several passages.");
  }

  function renderImages() {
    const doc = activeDoc();
    const inventory = imageInventory(doc);
    if (!inventory.items.length && !teiElementsByLocal(doc.root, "list").some((node) => getAttr(node, "type") === "image-annotations")) { note("Open Bildannotationen.xml to edit miniature records. Attach the codex under Linked project documents for range and zone lookup."); return; }
    const record = selectRecord(inventory.items, "Image annotation", (item) => `${item.id}: ${item.title || "Untitled"}`);
    const linkedCodex = codex();
    if (record && linkedCodex) {
      const zoneId = record.zone.replace(/^#/, "");
      const surface = memo(linkedCodex.doc, "surfaces", readSurfaces).surfaces.find((item) => item.zones.some((zone) => zone.id === zoneId));
      if (surface?.graphic) {
        const box = el("details", { class: "ed-wb-reference" }, [el("summary", { text: "Show miniature facsimile" })]);
        const viewerHost = el("div", { class: "ed-wb-facsimile", role: "region", "aria-label": "Miniature facsimile" });
        box.append(viewerHost);
        box.addEventListener("toggle", () => {
          if (!box.open || imageViewer) return;
          imageViewer = createFacsimile(viewerHost, { tileSourceFor: (url) => projectTileSource(app.project, url) || plainImageTileSource(url) });
          imageViewer.showPage({ imageUrl: surface.graphic, surface, focusZoneId: zoneId });
        });
        host.append(box);
      }
    }
    const values = { ...(record || {}),
      artists: (record?.artists || []).join(" "), persons: (record?.persons || []).join(" "), places: (record?.places || []).join(" "),
    };
    const iconFields = [];
    for (const [index, item] of (record?.iconclass || []).entries()) {
      for (const key of ["corresp", "de", "en", "resp"]) values[`icon-${index}-${key}`] = item[key] || "";
      iconFields.push(field(`icon-${index}-corresp`, `ICONCLASS ${index + 1} URI`),
        field(`icon-${index}-de`, `ICONCLASS ${index + 1} German label`, { multiline: true, readOnly: item.editable?.de === false }),
        field(`icon-${index}-en`, `ICONCLASS ${index + 1} English label`, { multiline: true, readOnly: item.editable?.en === false }),
        field(`icon-${index}-resp`, `ICONCLASS ${index + 1} responsibility`));
    }
    iconFields.push(field("new-icon-corresp", "New ICONCLASS URI"), field("new-icon-de", "New ICONCLASS German label", { multiline: true }),
      field("new-icon-en", "New ICONCLASS English label", { multiline: true }), field("new-icon-resp", "New ICONCLASS responsibility"));
    const specs = [
      field("zone", "Image zone ID", { required: !record }), field("title", "Image title", { required: !record }),
      field("shortDescription", "Short description", { multiline: true }), field("description", "Full description", { multiline: true, rows: 5 }),
      field("artists", "Artist references", { options: inventory.artists.map((item) => [`#${item.id}`, `${item.id}: ${item.name}`]), multiple: true,
        help: "Select one or more artists from the document header. Existing unknown identifiers remain visible for correction." }),
      field("persons", "Related persons", { help: "References to shared register entries, separated by spaces." }),
      field("places", "Related places"), field("height", "Height", { type: "number" }), field("heightUnit", "Height unit", { placeholder: "line" }),
      field("folio", "Folio", { placeholder: "1ra" }), field("folioLines", "Lines on folio", { placeholder: "4-17" }),
      field("objectType", "Image type"), field("objectRend", "Image type identifier"),
      field("textRelation", "Relation to the text", { multiline: true }), field("range", "Codex range", { placeholder: "#range(first_word_id, last_word_id)" }),
      field("rangeDescription", "Range description", { multiline: true }),
      ...iconFields,
      ...[["titleResp", "Title responsibility"], ["shortDescriptionResp", "Short description responsibility"],
        ["descriptionResp", "Full description responsibility"], ["textRelationResp", "Text relation responsibility"],
        ["rangeResp", "Range responsibility"], ["artistsResp", "Attribution responsibility"]].map(([key, label]) => field(key, label)),
    ].map((spec) => ({ ...spec, readOnly: spec.readOnly || record?.editable?.[spec.key] === false,
      ...(record?.editable?.[spec.key] === false ? { help: "This field contains structured XML. Use XML source to preserve its markup." } : {}),
    }));
    const f = form(record ? "Edit image annotation" : "New image annotation", specs, values, (v) => {
      const patch = {};
      for (const spec of specs) {
        if (spec.readOnly || spec.key.startsWith("icon-") || spec.key.startsWith("new-icon-") || String(values[spec.key] ?? "") === v[spec.key]) continue;
        patch[spec.key] = ["artists", "persons", "places"].includes(spec.key) ? pointers(v[spec.key])
          : v[spec.key];
      }
      const icons = (record?.iconclass || []).map((item, index) => Object.fromEntries(["corresp", "de", "en", "resp"].map((key) => [key, v[`icon-${index}-${key}`]])));
      if (v["new-icon-corresp"].trim()) icons.push(Object.fromEntries(["corresp", "de", "en", "resp"].map((key) => [key, v[`new-icon-${key}`]])));
      if (iconFields.some((spec) => String(values[spec.key] ?? "") !== v[spec.key])) patch.iconclass = icons;
      const result = record ? updateImageAnnotation(doc, record.id, patch) : createImageAnnotation(doc, patch);
      if (!record) selected = result.id;
      mutate(record ? result : result.doc, "Edit Wenzelsbibel image annotation");
    });
    mountIconclassLookup(host, { readOnly: () => app.readOnly, current: () => f.form.isConnected && app.panel === "wenzels" && activeDoc() === doc,
      onPick: (item) => {
        for (const [key, value] of Object.entries(item)) f.controls.get(`new-icon-${key}`).value = value;
        f.controls.get("new-icon-corresp").dispatchEvent(new Event("input", { bubbles: true }));
      },
    });
    const ref = codex();
    if (ref && record) {
      const index = memo(ref.doc, "codex-index", indexWenzelsCodex);
      const issues = validateImageAnnotationPointers(record, index);
      for (const issue of issues) note(typeof issue === "string" ? issue : issue.message);
    }
    const rangeFields = el("div", { class: "ed-wb-range" });
    const first = el("input", { type: "text", "aria-label": "First image-related word" });
    const last = el("input", { type: "text", "aria-label": "Last image-related word" });
    const endpoints = /^#range\(\s*([^,]+),\s*([^\)]+)\)$/.exec(record?.range || "");
    if (endpoints) { first.value = endpoints[1].trim(); last.value = endpoints[2].trim(); }
    rangeFields.append(el("label", { class: "ed-wb-field" }, [el("span", { text: "First image-related word" }), first]),
      el("label", { class: "ed-wb-field" }, [el("span", { text: "Last image-related word" }), last]), action("Set text range", () => {
        const range = f.controls.get("range");
        if (range.disabled) return;
        range.value = `#range(${first.value.replace(/^#/, "")}, ${last.value.replace(/^#/, "")})`;
        range.dispatchEvent(new Event("input", { bubbles: true }));
      }, { disabled: app.readOnly }));
    host.append(rangeFields);
    referencePicker({ controls: new Map([["from", first], ["to", last]]) });
  }

  function renderRegisters() {
    const entry = registers();
    const doc = activeDoc();
    if (entry?.doc === doc) {
      const records = memo(doc, "registers", readWenzelsRegisters);
      const record = selectRecord(records, "Register entry", (item) => `${item.kind}: ${item.name} (${item.id})`);
      const authorityTypes = [...new Set(["GND", "Wikidata", "GeoNames", ...(record?.authorities || []).map((item) => item.type)])];
      const values = { ...(record || { kind: "person" }) };
      for (const type of authorityTypes) values[`authority-${type}`] = (record?.authorities || []).find((item) => item.type === type)?.value || "";
      form(record ? "Edit shared register entry" : "New shared register entry", [
        field("kind", "Register", { options: [["person", "Persons"], ["place", "Places"], ["people", "Peoples"]], readOnly: !!record }),
        field("id", "XML ID", { required: true, readOnly: !!record }), field("name", "Name", { required: true }),
        ...authorityTypes.map((type) => field(`authority-${type}`, `${type} identifier`)),
      ], values, (v) => {
        const authorities = authorityTypes.filter((type) => v[`authority-${type}`] !== values[`authority-${type}`]).map((type) =>
          v[`authority-${type}`].trim() ? { type, value: v[`authority-${type}`] } : { type, remove: true });
        const next = record ? updateWenzelsRegisterEntry(doc, record, { name: v.name, authorities })
          : createWenzelsRegisterEntry(doc, { ...v, authorities });
        selected = v.id; mutate(next, "Edit shared Wenzelsbibel register");
      }, record ? () => {
        for (const role of ["codex", "images"]) {
          const linked = attachments.get(role);
          if (linked && referencesRegisterId(linked.doc, record.id, app.docName)) throw new Error(`${linked.name} still references this register entry.`);
        }
        selected = ""; mutate(removeWenzelsRegisterEntry(doc, record), "Remove shared register entry");
      } : null);
      note("Persons and places use their TEI lists. Peoples use listOrg with org type=people. The shared file serves both text and image annotations.");
      return;
    }
    if (!words(doc).length) { note("Create or open registers.xml under Linked project documents to maintain the shared indices."); return; }
    const records = memo(doc, "register-links", readWenzelsRegisterLinks);
    const record = selectRecord(records, "Register link", (item) => `${item.target || item.ana || "Link"} (${item.from}–${item.to})`);
    const entities = entry ? memo(entry.doc, "registers", readWenzelsRegisters) : [];
    const f = form("Link a text passage to a shared register", [
      field("target", "Register entry", { required: true, ...(entities.length ? { options: entities.map((item) => [`${entry.name}#${item.id}`, `${item.kind}: ${item.name}`]) } : { placeholder: "registers.xml#Gott" }) }),
      field("from", "First word ID", { required: true }), field("to", "Last word ID", { required: true }),
    ], record || {}, (v) => {
      if (entry && !entities.some((item) => `${entry.name}#${item.id}` === v.target)) throw new Error("The selected register entry does not exist.");
      const next = record ? updateWenzelsRegisterLink(doc, record, { ...v, registersDoc: entry?.doc })
        : addWenzelsRegisterLink(doc, { from: v.from, to: v.to }, { target: v.target, registersDoc: entry?.doc });
      const updated = readWenzelsRegisterLinks(next);
      selected = record ? updated[records.indexOf(record)]?.id || updated[records.indexOf(record)]?.key || ""
        : updated.find((item) => !records.some((previous) => previous.id === item.id))?.id || "";
      mutate(next, "Link shared register entry");
    }, record ? () => { selected = ""; mutate(removeWenzelsRegisterLink(doc, record), "Remove shared register link"); } : null);
    referencePicker(f);
    if (!entry) note("Attach registers.xml to choose existing entries and verify the reference before applying it.");
  }

  function renderChecks() {
    const doc = activeDoc();
    note("Project checks inspect relationships and editorial completeness. The output schema gate separately validates the exact TEI bytes before Save or Download.");
    const reviewResults = el("div");
    host.append(action("Check editorial completeness", async (event) => {
      const owner = app.sessionId;
      event.currentTarget.disabled = true;
      reviewResults.textContent = "Checking the Wenzelsbibel review profile...";
      try {
        const response = await fetch(WENZELS_EDITORIAL_SCHEMA_URL);
        if (!response.ok) throw new Error("The local Wenzelsbibel schema could not be loaded.");
        const schema = (await response.text()).replace('defaultPhase="editing"', 'defaultPhase="review"');
        const results = await validateWithSchemas(doc.raw, [{ type: "schematron", name: "Wenzelsbibel editorial review", text: schema }]);
        if (owner !== app.sessionId || activeDoc() !== doc || !reviewResults.isConnected) return;
        reviewResults.replaceChildren();
        for (const result of results) {
          reviewResults.append(el("p", { class: "ed-wb-note", text: `${result.name}: ${result.status}. ${result.diagnostics.length} editorial findings.` }));
          const issues = el("ul", { class: "ed-wb-issues" });
          for (const issue of result.diagnostics.slice(0, 100)) issues.append(el("li", { text: `${issue.location || ""} ${issue.message}` }));
          reviewResults.append(issues);
        }
      } catch (error) { if (reviewResults.isConnected) reviewResults.textContent = error.message; }
      finally { if (event.target.isConnected) event.target.disabled = false; }
    }), reviewResults);
    const ref = codex();
    const images = hasImages(doc) ? { doc, name: app.docName } : attachments.get("images");
    const list = el("ul", { class: "ed-wb-issues" });
    if (images && ref) {
      const index = memo(ref.doc, "codex-index", indexWenzelsCodex);
      let issueCount = 0;
      for (const item of imageInventory(images.doc).items) {
        for (const issue of validateImageAnnotationPointers(item, index)) {
          issueCount++;
          if (issueCount <= 100) list.append(el("li", { text: `${item.id}: ${typeof issue === "string" ? issue : issue.message}` }));
        }
      }
      note(`${imageInventory(images.doc).items.length} image records checked against ${ref.name}; ${issueCount} pointer issues.`);
      if (issueCount > 100) note("The first 100 issues are displayed. Correct records and run the checks again to inspect the remaining issues.");
    } else note("Attach both the codex and image annotations to check cross-file image references.");
    if (ref) {
      const comments = memo(ref.doc, "comments", readWenzelsComments);
      let broken = 0;
      for (const comment of comments) if (comment.issues?.length) {
        broken++; if (broken <= 50) list.append(el("li", { text: `Apparatus ${comment.id || comment.key}: unresolved boundary ${comment.from || "(missing)"} / ${comment.to || "(missing)"}.` }));
      }
      note(`${comments.length} apparatus entries; ${broken} entries have unresolved anchor boundaries.`);
    }
    const registerDoc = registers();
    if (registerDoc) {
      const issues = checkWenzelsRegisters({ registers: registerDoc.doc, codex: ref?.doc, images: images?.doc, name: registerDoc.name });
      note(`Shared registers: ${issues.length} reference issues in the attached documents.`);
      for (const issue of issues.slice(0, 100)) list.append(el("li", { text: issue }));
    } else note("Attach the shared registers to resolve person, place and people references.");
    for (const choice of singleBranchChoices(doc)) {
      const box = el("div", { class: "ed-wb-note" }, [el("p", { text: `Choice with only one alternative: ${choiceLabel(choice)}. TEI requires alternative readings in a choice.` })]);
      box.append(action("Keep sole reading", () => {
        try { mutate(keepSingleChoiceBranch(doc, choice), "Keep sole choice reading"); }
        catch (error) { setStatus(error.message); }
      }, { disabled: app.readOnly || choice.attrs.length > 0 }));
      host.append(box);
    }
    host.append(list);
  }

  function render(element) {
    if (!element || !activeDoc()) return;
    host = element;
    if (stagedInput.hasChanges()) return;
    stagedInput.clear();
    importForm?.dispose(); importForm = null;
    imageViewer?.destroy(); imageViewer = null;
    if (sessionId !== app.sessionId) {
      sessionId = app.sessionId; selected = ""; wordOffset = 0;
      cache = new WeakMap();
      section = hasImages(activeDoc()) ? "image-annotation" : registers()?.doc === activeDoc() ? "registers" : "diplomatic";
    }
    clear(host); host.classList.add("ed-wb-workspace");
    host.append(el("h2", { text: "Wenzelsbibel" }));
    const choose = el("select", { "aria-label": "Wenzelsbibel workspace" });
    for (const [key, label] of SECTIONS) choose.append(el("option", { value: key, text: label }));
    choose.value = section;
    choose.addEventListener("change", () => {
      if (!stagedInput.allowChange("changing the Wenzelsbibel workspace")) { choose.value = section; return; }
      navigate(choose.value);
    });
    host.append(choose); attachmentControls();
    const imported = app.source?.importSummary;
    if (imported?.format === "page-xml") {
      const summary = el("details", { class: "ed-wb-note" }, [el("summary", { text: `PAGE import: ${imported.pages} pages (${imported.order})` })]);
      const warnings = Array.isArray(imported.warnings) ? imported.warnings : [];
      summary.append(el("p", { text: warnings.length ? `${warnings.length} import notices. Keep the original PAGE files as source evidence.` : "No import warnings. Review the separate TEI draft before scholarly use." }));
      for (const warning of warnings.slice(0, 100)) summary.append(el("p", { text: warning }));
      if (warnings.length > 100) summary.append(el("p", { text: "The first 100 notices are shown; the full list remains in the working copy." }));
      host.append(summary);
    }
    try {
      ({ diplomatic: renderTranscription, commentary: renderCommentary, "bible-verse": renderVerses,
        "image-annotation": renderImages, registers: renderRegisters, checks: renderChecks,
        import: () => {
          const owner = app.sessionId;
          importForm = mountPageXmlImport(host, { status: setStatus, readOnly: () => app.readOnly,
            onImport: async ({ raw, name, pages, warnings, order }) => {
              if (owner !== app.sessionId) throw new Error("The active document changed. Open the import again.");
              rememberActive();
              const loaded = await loadDocument(raw, name, app.project, true);
              if (loaded && activeDoc()?.raw === raw) {
                app.source = { ...app.source, importSummary: { format: "page-xml", pages: pages.length, warnings, order } };
                render(host);
                await persist();
                setStatus(`Created a separate TEI draft from ${pages.length} PAGE files. ${warnings.length} import notices are available in the PAGE import summary.`);
              }
              return loaded;
            },
          });
        },
      })[section]();
    } catch (error) { note(`This form could not be opened: ${error.message}`); }
  }
  function restore(value, element) {
    stagedInput.clear(); sessionId = app.sessionId;
    section = SECTIONS.some(([key]) => key === value.section) ? value.section : "diplomatic";
    selected = typeof value.selected === "string" ? value.selected : "";
    render(element); stagedInput.restore(value);
  }
  return { render, restore };
}
