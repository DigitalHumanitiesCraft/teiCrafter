import {
  assertEditableEntities, escapeAttr, escapeText, getUnqualifiedAttr, getXmlId,
  isTeiElement, parseDocument, qualifyTeiMarkup, teiElementsByLocal, textNodes, textOf,
  editTextAndAttrs, walk,
} from "./tei-document.js";

const XML_NS = "http://www.w3.org/XML/1998/namespace";
const attr = getUnqualifiedAttr;
const step = (name, attributes = {}) => ({ name, attributes });
const note = (type, subtype = null) => step("note", { type, subtype });
const FIELDS = {
  zone: { path: [], attribute: "corresp" },
  title: { path: [step("title")] },
  titleResp: { path: [step("title")], attribute: "resp" },
  shortDescription: { path: [note("description", "short")] },
  shortDescriptionResp: { path: [note("description", "short")], attribute: "resp" },
  shortDescriptionAnchored: { path: [note("description", "short")], attribute: "anchored" },
  description: { path: [note("description")] },
  descriptionResp: { path: [note("description")], attribute: "resp" },
  descriptionAnchored: { path: [note("description")], attribute: "anchored" },
  textRelation: { path: [note("text-relation", "content")] },
  textRelationResp: { path: [note("text-relation", "content")], attribute: "resp" },
  textRelationAnchored: { path: [note("text-relation", "content")], attribute: "anchored" },
  range: { path: [note("text-relation", "statistic")], attribute: "corresp" },
  rangeResp: { path: [note("text-relation", "statistic")], attribute: "resp" },
  rangeAnchored: { path: [note("text-relation", "statistic")], attribute: "anchored" },
  rangeDescription: { path: [note("text-relation", "statistic")] },
  height: { path: [step("dimensions"), step("height")] },
  heightUnit: { path: [step("dimensions"), step("height")], attribute: "unit" },
  folio: { path: [step("ref", { type: "folio" })], attribute: "target" },
  folioLines: { path: [step("ref", { type: "folio" })], attribute: "n" },
  objectType: { path: [step("objectType")] },
  objectRend: { path: [step("objectType")], attribute: "rend" },
  artistsResp: { path: [step("listPerson", { type: "artists" })], attribute: "resp" },
};
const LISTS = {
  artists: { parent: step("listPerson", { type: "artists" }), child: step("person") },
  persons: { parent: step("listPerson", { type: "related" }), child: step("person") },
  places: { parent: step("listPlace", { type: "related" }), child: step("place") },
  iconclass: { parent: step("listRef"), child: step("ref", { type: "iconclass-label" }) },
};

const cleanText = (value) => String(value ?? "").replace(/\s+/gu, " ").trim();
const childElements = (node) => (node?.children || []).filter((child) => child.type === "element");
function matches(node, selector) {
  return isTeiElement(node, selector.name)
    && Object.entries(selector.attributes).every(([key, value]) => attr(node, key) === value);
}
function children(node, selector) { return childElements(node).filter((child) => matches(child, selector)); }
function findPath(node, path) {
  let current = node;
  for (const selector of path) {
    const found = children(current, selector);
    if (found.length > 1) return { node: null, ambiguous: true };
    current = found[0];
    if (!current) return { node: null, ambiguous: false };
  }
  return { node: current, ambiguous: false };
}
function reading(doc, node) {
  return node ? cleanText(textNodes(node).map((text) => textOf(doc, text)).join("")) : "";
}
function simple(node) {
  return !node || (node.children || []).every((child) => child.type === "text");
}
function annotationLists(doc) {
  return teiElementsByLocal(doc.root, "list").filter((node) => attr(node, "type") === "image-annotations");
}
function itemElements(doc) {
  return annotationLists(doc).flatMap((list) => children(list, step("item")));
}
function itemElement(doc, id) {
  const nodes = itemElements(doc).filter((node) => getXmlId(node) === id);
  if (nodes.length !== 1) throw new Error(`Image annotation ${id || "(without ID)"} is missing or ambiguous.`);
  return nodes[0];
}

/** Read the existing form fields without changing formatting, namespaces or source markup. */
export function readImageAnnotation(doc, id) {
  return readItem(doc, itemElement(doc, id));
}

function readItem(doc, node) {
  const id = getXmlId(node);
  const item = { id, editable: {}, issues: [] };
  for (const [key, field] of Object.entries(FIELDS)) {
    const found = findPath(node, field.path);
    item[key] = field.attribute ? attr(found.node, field.attribute) || "" : reading(doc, found.node);
    item.editable[key] = !found.ambiguous && (!!field.attribute || simple(found.node));
    if (found.ambiguous) item.issues.push({ field: key, code: "ambiguous-field", message: `${key} occurs more than once; edit its XML.` });
  }
  for (const [key, list] of Object.entries(LISTS)) {
    const found = findPath(node, [list.parent]);
    const records = children(found.node, list.child);
    item.editable[key] = !found.ambiguous;
    item[key] = key === "iconclass" ? records.map((record) => {
      const values = { corresp: attr(record, "corresp") || "", resp: attr(record, "resp") || "", de: "", en: "", editable: {} };
      for (const lang of ["de", "en"]) {
        const descriptions = childElements(record).filter((child) => isTeiElement(child, "desc")
          && child.attrs.some((a) => a.namespaceURI === XML_NS && a.localName === "lang" && a.value === lang));
        values[lang] = reading(doc, descriptions[0]);
        values.editable[lang] = descriptions.length < 2 && simple(descriptions[0]);
      }
      return values;
    }) : records.map((record) => attr(record, "corresp") || "");
    if (found.ambiguous) item.issues.push({ field: key, code: "ambiguous-field", message: `${key} occurs more than once; edit its XML.` });
  }
  return item;
}

/** Enumerate image items and the artist vocabulary supplied by their own header. */
export function readImageAnnotations(doc) {
  const headers = teiElementsByLocal(doc.root, "teiHeader");
  const artists = headers.flatMap((header) => teiElementsByLocal(header, "editionStmt"))
    .flatMap((edition) => teiElementsByLocal(edition, "persName"))
    .filter((person) => getXmlId(person))
    .map((person) => ({ id: getXmlId(person), name: reading(doc, person) }));
  const elements = itemElements(doc);
  const ids = elements.map(getXmlId);
  const duplicateIds = [...new Set(ids.filter((id, index) => id && ids.indexOf(id) !== index))];
  return {
    items: elements.filter((node) => getXmlId(node) && !duplicateIds.includes(getXmlId(node))).map((node) => readItem(doc, node)),
    artists,
    issues: [
      ...duplicateIds.map((id) => ({ code: "duplicate-id", message: `Image annotation ID ${id} occurs more than once.` })),
      ...(ids.includes(null) ? [{ code: "missing-id", message: "An image annotation has no xml:id and requires XML editing." }] : []),
    ],
  };
}

function splice(doc, start, end, replacement) {
  return parseDocument(doc.raw.slice(0, start) + replacement + doc.raw.slice(end));
}
function append(doc, parent, markup) {
  const qualified = qualifyTeiMarkup(markup, parent);
  if (qualified === null) throw new Error("The image annotation insertion context is not TEI.");
  if (parent.selfClosing) {
    const open = doc.raw.slice(parent.outerStart, parent.outerEnd).replace(/\/\s*>$/u, ">");
    return splice(doc, parent.outerStart, parent.outerEnd, `${open}${qualified}</${parent.qname}>`);
  }
  return splice(doc, parent.contentEnd, parent.contentEnd, qualified);
}
function selectorMarkup(selector) {
  const attributes = Object.entries(selector.attributes).filter(([, value]) => value !== null)
    .map(([key, value]) => ` ${key}="${escapeAttr(value)}"`).join("");
  return `<${selector.name}${attributes}></${selector.name}>`;
}
function ensurePath(doc, id, path) {
  for (let index = 0; index < path.length; index++) {
    const item = itemElement(doc, id);
    const found = findPath(item, path.slice(0, index + 1));
    if (found.ambiguous) throw new Error("The image annotation has ambiguous fields; edit its XML.");
    if (!found.node) {
      const parent = findPath(item, path.slice(0, index)).node;
      doc = append(doc, parent, selectorMarkup(path[index]));
    }
  }
  return doc;
}
function setText(doc, node, value) {
  const text = String(value ?? "");
  if (reading(doc, node) === cleanText(text)) return doc;
  if (!simple(node)) throw new Error("This field contains structured XML; use the XML editor to preserve its markup.");
  if (node.selfClosing) return append(doc, node, escapeText(text));
  assertEditableEntities(doc.raw.slice(node.contentStart, node.contentEnd));
  return splice(doc, node.contentStart, node.contentEnd, escapeText(text));
}
function setAttribute(doc, node, name, value) {
  const text = String(value ?? "");
  return editTextAndAttrs(doc, node, { set: { [name]: text || null } });
}
function listRecords(doc, id, definition) {
  const found = findPath(itemElement(doc, id), [definition.parent]);
  if (found.ambiguous) throw new Error("The image annotation has ambiguous lists; edit its XML.");
  return { parent: found.node, records: children(found.node, definition.child) };
}
function removable(doc, record, iconclass) {
  const allowedAttrs = new Set(iconclass ? ["type", "corresp", "resp"] : ["corresp", "instant", "full", "resp"]);
  if ((record.attrs || []).some((a) => a.namespaceURI || !allowedAttrs.has(a.name))) return false;
  return (record.children || []).every((child) => child.type === "text"
    ? !cleanText(textOf(doc, child))
    : iconclass && isTeiElement(child, "desc") && simple(child)
      && child.attrs.every((a) => a.namespaceURI === XML_NS && a.localName === "lang" && ["de", "en"].includes(a.value)));
}
function languageDesc(record, lang) {
  const nodes = children(record, step("desc")).filter((node) => node.attrs.some((a) =>
    a.namespaceURI === XML_NS && a.localName === "lang" && a.value === lang));
  if (nodes.length > 1) throw new Error(`The ICONCLASS ${lang} description occurs more than once; edit its XML.`);
  return nodes[0];
}
function comparableIconclass(value, fallback = {}) {
  return {
    corresp: String(value?.corresp ?? fallback.corresp ?? ""),
    resp: String(value?.resp ?? fallback.resp ?? ""),
    de: cleanText(value?.de ?? fallback.de),
    en: cleanText(value?.en ?? fallback.en),
  };
}
function setList(doc, id, key, values) {
  if (!Array.isArray(values)) throw new Error(`${key} must be a list.`);
  const definition = LISTS[key];
  const current = readImageAnnotation(doc, id)[key];
  const normalize = (value, index) => key === "iconclass" ? comparableIconclass(value, current[index]) : String(value ?? "");
  if (JSON.stringify(current.map((value) => key === "iconclass" ? comparableIconclass(value) : String(value ?? ""))) === JSON.stringify(values.map(normalize))) return doc;
  if (values.length) doc = ensurePath(doc, id, [definition.parent]);
  let state = listRecords(doc, id, definition);
  for (let index = state.records.length - 1; index >= values.length; index--) {
    const record = state.records[index];
    if (!removable(doc, record, key === "iconclass")) throw new Error(`Removing this ${key} entry would discard structured XML. Use the XML editor.`);
    doc = splice(doc, record.outerStart, record.outerEnd, "");
  }
  for (let index = 0; index < values.length; index++) {
    state = listRecords(doc, id, definition);
    if (!state.records[index]) {
      doc = append(doc, state.parent, selectorMarkup(definition.child));
      state = listRecords(doc, id, definition);
    }
    let record = state.records[index];
    const value = key === "iconclass" ? comparableIconclass(values[index], current[index]) : values[index];
    doc = setAttribute(doc, record, "corresp", key === "iconclass" ? value.corresp : value);
    if (key === "iconclass") {
      record = listRecords(doc, id, definition).records[index];
      doc = setAttribute(doc, record, "resp", value.resp);
      for (const lang of ["de", "en"]) {
        record = listRecords(doc, id, definition).records[index];
        let description = languageDesc(record, lang);
        if (!description && !value[lang]) continue;
        if (!description) {
          doc = append(doc, record, `<desc xml:lang="${lang}"></desc>`);
          description = languageDesc(listRecords(doc, id, definition).records[index], lang);
        }
        doc = setText(doc, description, value[lang]);
      }
    }
  }
  return doc;
}

/** Apply only supplied fields; a refused field leaves the caller's document unchanged. */
export function updateImageAnnotation(doc, id, patch) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) throw new Error("Image annotation changes must be an object.");
  for (const [key, value] of Object.entries(patch)) {
    if (Object.hasOwn(LISTS, key)) { doc = setList(doc, id, key, value); continue; }
    if (!Object.hasOwn(FIELDS, key)) throw new Error(`Unknown image annotation field: ${key}`);
    const field = FIELDS[key];
    const item = readImageAnnotation(doc, id);
    const next = String(value ?? "");
    if ((field.attribute ? item[key] : cleanText(item[key])) === (field.attribute ? next : cleanText(next))) continue;
    if (!item.editable[key]) throw new Error(`${key} contains structured or ambiguous XML; use the XML editor.`);
    doc = ensurePath(doc, id, field.path);
    const node = findPath(itemElement(doc, id), field.path).node;
    doc = field.attribute ? setAttribute(doc, node, field.attribute, next) : setText(doc, node, next);
  }
  return doc;
}

/** Create an independently identified item in an existing image-annotation list. */
export function createImageAnnotation(doc, fields = {}, { listSubtype = "miniatures" } = {}) {
  const lists = annotationLists(doc).filter((node) => attr(node, "subtype") === listSubtype);
  if (lists.length !== 1) throw new Error(`Exactly one ${listSubtype} image-annotation list is required.`);
  const ids = new Set();
  walk(doc.root, (node) => { const id = getXmlId(node); if (id) ids.add(id); });
  let serial = 1;
  while (ids.has(`image_annotation_${serial}`)) serial++;
  const id = `image_annotation_${serial}`;
  const next = append(doc, lists[0], `<item xml:id="${id}"></item>`);
  return { doc: updateImageAnnotation(next, id, fields), id };
}

/** Build one reusable index over the companion codex without changing its bytes. */
export function indexWenzelsCodex(doc) {
  const byId = new Map();
  const duplicates = new Set();
  walk(doc.root, (node) => {
    if (!isTeiElement(node)) return;
    const id = getXmlId(node);
    if (!id) return;
    if (byId.has(id)) duplicates.add(id);
    else byId.set(id, node);
  });
  return { byId, duplicates };
}

/** Return source-bound diagnostics; unresolved historical pointers remain untouched. */
export function validateImageAnnotationPointers(item, index) {
  const issues = [];
  const issue = (field, code, message) => issues.push({ field, code, message });
  if (!index) return [{ field: "zone", code: "missing-codex", message: "Attach the companion codex to verify image and text pointers." }];
  const resolve = (id, field) => {
    if (index.duplicates.has(id)) { issue(field, "ambiguous-target", `Target ${id} occurs more than once in the codex.`); return null; }
    const node = index.byId.get(id);
    if (!node) issue(field, "missing-target", `Target ${id} is absent from the companion codex.`);
    return node;
  };
  const zone = /^#([^\s#(),]+)$/u.exec(String(item.zone || "").trim());
  if (!zone) issue("zone", "invalid-zone-pointer", "Select a codex image zone using #xml-id.");
  else {
    const node = resolve(zone[1], "zone");
    if (node && (!isTeiElement(node, "zone") || attr(node, "type") !== "ImageRegion")) {
      issue("zone", "not-image-zone", "The image pointer must identify an ImageRegion zone in the codex.");
    }
  }
  if (item.range) {
    const range = /^#range\(\s*([^\s,()#]+)\s*,\s*([^\s,()#]+)\s*\)$/u.exec(item.range.trim());
    if (!range) issue("range", "invalid-range", "Use #range(start-id, end-id) with two existing codex identifiers.");
    else {
      const start = resolve(range[1], "range");
      const end = resolve(range[2], "range");
      if (start && !isTeiElement(start, "w") || end && !isTeiElement(end, "w")) {
        issue("range", "not-word-target", "Statistical text range endpoints must identify TEI words in the codex.");
      }
      if (start && end && start.outerStart > end.outerStart) issue("range", "reversed-range", "The range end precedes its start in the codex.");
    }
  }
  return issues;
}
