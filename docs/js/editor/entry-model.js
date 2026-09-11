/** Source-bound dictionary and encyclopedia entry operations. */
import {
  XML_NAMESPACE, assertXmlCharacters, escapeAttr, escapeText, getAttrObjInNamespace,
  getUnqualifiedAttr, getXmlId, isTeiElement, parseDocument, qualifyTeiMarkup, textOf, walk,
} from "./tei-document.js";

const children = (node, name) => (node?.children || []).filter((child) => isTeiElement(child, name));
const attribute = (node, name) => getAttrObjInNamespace(node, name === "xml:lang" ? XML_NAMESPACE : null, name === "xml:lang" ? "lang" : name);
const xmlIds = (node) => (node.attrs || []).filter((attr) => attr.namespaceURI === XML_NAMESPACE && attr.localName === "id");
const content = (doc, node) => {
  let value = "";
  if (node) walk(node, (child) => { if (child.type === "text" || child.type === "cdata") value += textOf(doc, child); });
  return value;
};
const plain = (node) => !node || (node.children || []).every((child) => child.type === "text" || child.type === "cdata");
const kindOf = (node) => isTeiElement(node, "entry") ? "dictionary"
  : isTeiElement(node, "div") && ["entry", "article"].includes(getUnqualifiedAttr(node, "type")) ? "articles" : "";
const cache = new WeakMap();
const identifierCache = new WeakMap();
const previews = new WeakMap();
const POINTER_ATTRIBUTES = new Set(["target", "corresp", "sameAs", "copyOf", "next", "prev", "synch", "ana", "facs", "who", "resp", "ref", "active", "passive", "mutual", "from", "to", "spanTo", "exclude", "select", "domains", "start", "end", "wit", "source", "decls", "change", "hand"]);
function decodedFragment(token) {
  try { return decodeURIComponent(token.slice(token.indexOf("#") + 1)); }
  catch { throw new Error("A URI fragment has malformed percent encoding. Correct its XML before duplicating."); }
}

function writable(options) {
  if (options?.readOnly) throw new Error("Read-only mode prevents entry changes.");
}
function closed(node) {
  if (!node || !Number.isInteger(node.outerEnd) || (!node.selfClosing && !Number.isInteger(node.contentEnd))) {
    throw new Error("This entry has an unclosed XML structure. Correct its XML before changing entries.");
  }
}
function validId(value) {
  if (!/^[\p{L}\p{Nl}_][\p{L}\p{Nl}\p{N}\p{M}._\-\u00B7]*$/u.test(value)) throw new Error("Enter a valid XML identifier without spaces or colons.");
  return value;
}
function allocate(ids, base) {
  validId(base);
  let value = base;
  let index = 2;
  while (ids.has(value)) value = `${base}-${index++}`;
  ids.add(value);
  return value;
}
function identifierIndex(doc) {
  if (identifierCache.has(doc)) return identifierCache.get(doc);
  const ids = new Map();
  walk(doc.root, (node) => {
    if (node.type !== "element") return;
    const attributes = xmlIds(node);
    for (const attribute of attributes) {
      const id = attribute.value;
      if (id) ids.set(id, ids.has(id) || attributes.length > 1 ? null : node);
    }
  });
  identifierCache.set(doc, ids);
  return ids;
}
function inventory(doc) {
  if (cache.has(doc)) return cache.get(doc);
  const nodes = [];
  walk(doc.root, (node) => {
    if (node.type !== "element") return;
    if (!kindOf(node)) return;
    let parent = node.parent;
    while (parent && !kindOf(parent)) parent = parent.parent;
    if (!parent) nodes.push(node);
  });
  const ids = nodes.length ? identifierIndex(doc) : new Map();
  const items = nodes.map((node) => {
    const kind = kindOf(node);
    const forms = children(node, "form");
    const lemmas = forms.filter((form) => getUnqualifiedAttr(form, "type") === "lemma");
    const candidates = lemmas.length ? lemmas : forms.filter((form) => !getUnqualifiedAttr(form, "type"));
    const senses = children(node, "sense");
    const headings = kind === "dictionary" ? candidates.flatMap((form) => children(form, "orth")) : children(node, "head");
    const definitions = kind === "dictionary" ? senses.flatMap((sense) => children(sense, "def")) : children(node, "p");
    const headingAmbiguous = headings.length > 1 || (kind === "dictionary" && candidates.length > 1);
    const textAmbiguous = definitions.length > 1 || (kind === "dictionary" && senses.length > 1);
    const headword = headings.map((item) => content(doc, item)).join(" / ");
    const text = definitions.map((item) => content(doc, item)).join("\n\n");
    const id = getXmlId(node) || "";
    const issues = [];
    if (!id) issues.push("Missing XML identifier");
    else if (ids.get(id) !== node || xmlIds(node).length > 1) issues.push("Ambiguous XML identifier");
    if (!headword.trim()) issues.push("Missing headword or heading");
    if (!text.trim()) issues.push("Missing definition or article text");
    return {
      id, key: id || `entry@${node.outerStart}`, node, kind, headword, text,
      language: attribute(node, "xml:lang")?.value || "", number: attribute(node, "n")?.value || "",
      issues, incomplete: issues.length > 0,
      editable: { headword: !headingAmbiguous && plain(headings[0]), text: !textAmbiguous && plain(definitions[0]) },
      heading: headings[0] || null, definition: definitions[0] || null,
      form: candidates[0] || null, sense: senses[0] || null,
      headingAmbiguous, textAmbiguous,
    };
  });
  const result = { ids, items };
  cache.set(doc, result);
  return result;
}

export function readEntries(doc) { return inventory(doc).items; }
export function hasEntryWorkspace(doc) { return !!doc && readEntries(doc).length > 0; }
export function canStartEntryCollection(doc) {
  if (!doc || readEntries(doc).length) return false;
  const bodies = [];
  walk(doc.root, (node) => { if (isTeiElement(node, "body")) { bodies.push(node); return false; } });
  return bodies.length === 1 && Number.isInteger(bodies[0].outerEnd)
    && (bodies[0].children || []).every((node) => node.type === "comment" || (node.type === "text" && !content(doc, node).trim()));
}
export function resolveEntry(doc, target) {
  const { items, ids } = inventory(doc);
  const matches = typeof target === "object" && target?.node
    ? items.filter((item) => item.node === target.node)
    : items.filter((item) => item.key === String(target || "").replace(/^#/, ""));
  if (matches.length !== 1 || xmlIds(matches[0]?.node || {}).length > 1 || (matches[0].id && ids.get(matches[0].id) !== matches[0].node)) {
    throw new Error("The entry target is missing, ambiguous or belongs to an older document revision.");
  }
  closed(matches[0].node);
  return matches[0];
}

export function filterEntries(doc, { query = "", incomplete = false, kind = "", sort = "source" } = {}) {
  const normalize = (value) => String(value).normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("en").replace(/ß/g, "ss");
  const needle = normalize(query.trim());
  const items = readEntries(doc).filter((item) => (!incomplete || item.incomplete) && (!kind || item.kind === kind)
    && (!needle || normalize(`${item.id} ${item.headword} ${item.text}`).includes(needle)));
  return sort === "headword" ? items.slice().sort((a, b) => a.headword.localeCompare(b.headword, "en") || a.node.outerStart - b.node.outerStart) : items;
}

function applyEdits(doc, edits) {
  const combined = new Map();
  for (const edit of edits) {
    const key = `${edit.start}:${edit.end}`;
    if (edit.start === edit.end && combined.has(key)) combined.get(key).text += edit.text;
    else if (combined.has(key)) throw new Error("The requested entry fields overlap.");
    else combined.set(key, { ...edit });
  }
  const ordered = [...combined.values()].filter((edit) => doc.raw.slice(edit.start, edit.end) !== edit.text).sort((a, b) => b.start - a.start || b.end - a.end);
  if (!ordered.length) return doc;
  const parts = [];
  let boundary = doc.raw.length;
  for (const edit of ordered) {
    if (!Number.isInteger(edit.start) || !Number.isInteger(edit.end) || edit.start < 0 || edit.end < edit.start || edit.end > boundary) {
      throw new Error("The requested entry edits overlap or use stale source positions.");
    }
    parts.push(doc.raw.slice(edit.end, boundary), edit.text);
    boundary = edit.start;
  }
  parts.push(doc.raw.slice(0, boundary));
  const raw = parts.reverse().join("");
  return raw === doc.raw ? doc : parseDocument(raw);
}
function setAttribute(doc, node, name, value, edits) {
  const existing = attribute(node, name);
  if (existing?.value === value || (!existing && !value)) return;
  if (existing && node.attrs.filter((attr) => attr.expandedName === existing.expandedName).length > 1) throw new Error("This attribute target is ambiguous. Correct duplicate attributes in XML before editing the field.");
  if (!value) {
    if (existing) edits.push({ start: existing.start - (/\s/.test(doc.raw[existing.start - 1]) ? 1 : 0), end: existing.end, text: "" });
  } else if (existing) {
    if (existing.value !== value) edits.push({ start: existing.valueStart, end: existing.valueEnd, text: escapeAttr(value, existing.quote) });
  } else edits.push({ start: node.stagStart + 1 + node.qname.length, end: node.stagStart + 1 + node.qname.length, text: ` ${name}="${escapeAttr(value)}"` });
}
function append(node, fragment, edits, first = false) {
  closed(node);
  const text = qualifyTeiMarkup(fragment, node);
  if (text == null) throw new Error("The entry insertion context is not TEI.");
  if (node.selfClosing) {
    const previous = edits.find((edit) => edit.start === node.outerEnd - 2 && edit.end === node.outerEnd);
    if (previous) previous.text = first ? `>${text}${previous.text.slice(1)}` : `${previous.text.slice(0, -node.qname.length - 3)}${text}</${node.qname}>`;
    else edits.push({ start: node.outerEnd - 2, end: node.outerEnd, text: `>${text}</${node.qname}>` });
  }
  else {
    const position = first ? node.contentStart : node.contentEnd;
    edits.push({ start: position, end: position, text });
  }
}
function patchText(doc, node, value, edits) {
  closed(node);
  if (content(doc, node) === value) return;
  if (!plain(node)) throw new Error("This field contains structured XML. Use XML to preserve its embedded markup.");
  if (node.selfClosing) edits.push({ start: node.outerEnd - 2, end: node.outerEnd, text: `>${escapeText(value)}</${node.qname}>` });
  else edits.push({ start: node.contentStart, end: node.contentEnd, text: escapeText(value) });
}
function checkFields(fields, allowed) {
  for (const key of Object.keys(fields)) {
    if (!allowed.includes(key)) throw new Error(`Unknown entry field: ${key}.`);
    if (typeof fields[key] !== "string") throw new Error(`The entry field ${key} must be text.`);
    assertXmlCharacters(fields[key]);
  }
  if (fields.language && !/^[a-zA-Z]{1,8}(?:-[a-zA-Z0-9]{1,8})*$/.test(fields.language)) throw new Error("Use a language tag such as de, en or la, or leave the language empty.");
}

export function updateEntry(doc, target, fields, options = {}) {
  writable(options);
  checkFields(fields, ["headword", "text", "language", "number"]);
  const item = resolveEntry(doc, target);
  const edits = [];
  for (const field of ["headword", "text"]) {
    if (!Object.hasOwn(fields, field) || fields[field] === item[field]) continue;
    if (!item.editable[field]) throw new Error("This field has ambiguous targets or structured XML. Edit its XML to preserve the existing structure.");
    const heading = field === "headword";
    const node = heading ? item.heading : item.definition;
    if (node) patchText(doc, node, fields[field], edits);
    else if (item.kind === "articles") append(item.node, `<${heading ? "head" : "p"}>${escapeText(fields[field])}</${heading ? "head" : "p"}>`, edits, heading);
    else {
      const container = heading ? item.form : item.sense;
      const tag = heading ? "orth" : "def";
      const fragment = `<${tag}>${escapeText(fields[field])}</${tag}>`;
      if (container) append(container, fragment, edits);
      else append(item.node, heading ? `<form type="lemma">${fragment}</form>` : `<sense>${fragment}</sense>`, edits, heading);
    }
  }
  if (Object.hasOwn(fields, "language")) setAttribute(doc, item.node, "xml:lang", fields.language, edits);
  if (Object.hasOwn(fields, "number")) setAttribute(doc, item.node, "n", fields.number, edits);
  return applyEdits(doc, edits);
}

/** A sibling fixes the collection and encoding; an empty body needs an explicit kind. */
export function createEntry(doc, fields, { kind = "", after = "", readOnly = false } = {}) {
  writable({ readOnly });
  checkFields(fields, ["id", "headword", "text", "language", "number"]);
  if (!fields.headword?.trim()) throw new Error("Enter a headword or article heading.");
  const sibling = after ? resolveEntry(doc, after) : null;
  if (sibling && kind && sibling.kind !== kind) throw new Error("The new entry kind must match the selected collection.");
  kind ||= sibling?.kind || "";
  if (!["dictionary", "articles"].includes(kind)) throw new Error("Choose dictionary entries or encyclopedia articles explicitly.");
  let parent = sibling?.node.parent;
  if (!parent) {
    const bodies = [];
    walk(doc.root, (node) => { if (isTeiElement(node, "body")) { bodies.push(node); return false; } });
    if (bodies.length !== 1 || !canStartEntryCollection(doc)) throw new Error("Select a current entry or an empty document body to identify its collection before inserting.");
    parent = bodies[0];
  }
  if (!isTeiElement(parent)) throw new Error("The entry parent is not a TEI insertion context.");
  closed(parent);
  const ids = new Set(identifierIndex(doc).keys());
  if (fields.id && ids.has(fields.id)) throw new Error("The requested XML identifier already exists.");
  const id = allocate(ids, fields.id || "entry");
  const attrs = ` xml:id="${escapeAttr(id)}"${fields.language ? ` xml:lang="${escapeAttr(fields.language)}"` : ""}${fields.number ? ` n="${escapeAttr(fields.number)}"` : ""}`;
  const headword = escapeText(fields.headword);
  const body = escapeText(fields.text || "");
  const articleType = sibling ? getUnqualifiedAttr(sibling.node, "type") : "entry";
  const fragment = kind === "dictionary"
    ? `<entry${attrs}><form type="lemma"><orth>${headword}</orth></form>${body ? `<sense><def>${body}</def></sense>` : ""}</entry>`
    : `<div type="${escapeAttr(articleType || "entry")}"${attrs}><head>${headword}</head><p>${body}</p></div>`;
  const edits = [];
  if (sibling) edits.push({ start: sibling.node.outerEnd, end: sibling.node.outerEnd, text: qualifyTeiMarkup(fragment, parent) });
  else append(parent, fragment, edits);
  return { doc: applyEdits(doc, edits), id };
}

export function duplicateEntry(doc, target, options = {}) {
  writable(options);
  const item = resolveEntry(doc, target);
  const { ids } = inventory(doc);
  const reserved = new Set(ids.keys());
  const mapping = new Map();
  const elements = [];
  walk(item.node, (node) => {
    if (node.type !== "element") return;
    closed(node); elements.push(node);
    if (new Set(node.attrs.map((attr) => attr.expandedName)).size !== node.attrs.length) throw new Error("This entry contains ambiguous duplicate attributes. Correct its XML before duplicating.");
    const id = getXmlId(node);
    if (id) {
      if (ids.get(id) !== node) throw new Error(`The descendant identifier ${id} is ambiguous. Correct its XML before duplicating.`);
      mapping.set(id, allocate(reserved, `${validId(id)}-copy`));
    }
  });
  const id = item.id ? mapping.get(item.id) : allocate(reserved, "entry-copy");
  const edits = [];
  for (const node of elements) for (const attr of node.attrs || []) {
    let value = attr.value;
    if (attr.namespaceURI === XML_NAMESPACE && attr.localName === "id") value = mapping.get(attr.value);
    else if (attr.namespaceURI !== "http://www.w3.org/2000/xmlns/") {
      const knownPointer = (isTeiElement(node) && attr.namespaceURI == null && POINTER_ATTRIBUTES.has(attr.localName))
        || (attr.namespaceURI === "http://www.w3.org/1999/xlink" && attr.localName === "href");
      value = attr.value.replace(/\S+/g, (token) => {
        if (!token.startsWith("#")) return token;
        const decoded = decodedFragment(token);
        if (mapping.has(decoded)) {
          if (!knownPointer) throw new Error("An unmapped attribute names a copied identifier. Resolve its reference semantics in XML before duplicating.");
          let context = node;
          while (context?.type === "element") {
            if (getAttrObjInNamespace(context, XML_NAMESPACE, "base")?.value) throw new Error("An XML base changes the meaning of this pointer. Resolve its target in XML before duplicating.");
            context = context.parent;
          }
          return `#${mapping.get(decoded)}`;
        }
        const fragment = /^([\p{L}\p{Nl}_][\p{L}\p{Nl}\p{N}\p{M}._\-\u00B7]*)/u.exec(decoded)?.[1];
        const compound = decoded.startsWith("range(") ? decoded.slice(6).split(/[,\s()]+/) : [];
        if (mapping.has(fragment) || compound.some((part) => mapping.has(part))) throw new Error("An internal pointer uses compound syntax. Resolve its XML before duplicating this entry.");
        return token;
      });
    }
    if (value !== attr.value) edits.push({ start: attr.valueStart, end: attr.valueEnd, text: escapeAttr(value, attr.quote) });
  }
  if (!item.id) edits.push({ start: item.node.stagStart + 1 + item.node.qname.length, end: item.node.stagStart + 1 + item.node.qname.length, text: ` xml:id="${id}"` });
  let fragment = doc.raw.slice(item.node.outerStart, item.node.outerEnd);
  for (const edit of edits.sort((a, b) => b.start - a.start)) fragment = fragment.slice(0, edit.start - item.node.outerStart) + edit.text + fragment.slice(edit.end - item.node.outerStart);
  return { doc: applyEdits(doc, [{ start: item.node.outerEnd, end: item.node.outerEnd, text: fragment }]), id, mapping };
}

export function entryReferences(doc, target) {
  const item = resolveEntry(doc, target);
  const ids = new Set();
  walk(item.node, (node) => {
    if (node.type === "element") for (const attribute of xmlIds(node)) if (attribute.value) ids.add(attribute.value);
  });
  const refs = [];
  walk(doc.root, (node) => {
    if (node === item.node) return false;
    if (node.type !== "element") return;
    for (const attr of node.attrs || []) {
      if (attr.namespaceURI === XML_NAMESPACE && attr.localName === "id") continue;
      const fragments = attr.value.split(/\s+/).filter((token) => token.includes("#")).map((token) => {
        try { return decodedFragment(token); } catch { return token.slice(token.indexOf("#") + 1); }
      });
      const matches = fragments.map((fragment) => /^([\p{L}\p{Nl}_][\p{L}\p{Nl}\p{N}\p{M}._\-\u00B7]*)/u.exec(fragment)?.[1]);
      const referenced = matches.filter((id) => ids.has(id));
      if (attr.value.startsWith("#range(")) {
        let range = attr.value;
        try { range = decodeURIComponent(range); } catch { /* Preserve unresolved source spelling. */ }
        for (const id of range.slice(7, -1).split(/[,\s]+/)) if (ids.has(id)) referenced.push(id);
      }
      if (referenced.length) refs.push({ node, id: getXmlId(node) || "", attribute: attr.name, value: attr.value, targets: referenced });
    }
  });
  return refs;
}

export function entryLinks(doc, target) {
  const item = resolveEntry(doc, target);
  const { ids, items } = inventory(doc);
  const links = [];
  walk(item.node, (node) => {
    if (node.type !== "element") return;
    for (const attr of node.attrs || []) {
      if (attr.namespaceURI === XML_NAMESPACE && attr.localName === "id") continue;
      for (const token of attr.value.split(/\s+/)) {
        if (!token.startsWith("#")) continue;
        let id;
        try { id = decodedFragment(token); } catch { links.push({ id: token.slice(1), attribute: attr.name, key: "", issue: "Malformed URI fragment" }); continue; }
        if (!/^[\p{L}\p{Nl}_][\p{L}\p{Nl}\p{N}\p{M}._\-\u00B7]*$/u.test(id)) continue;
        let node = ids.get(id);
        while (node && !items.some((entry) => entry.node === node)) node = node.parent;
        const entry = items.find((record) => record.node === node);
        links.push({ id, attribute: attr.name, key: entry?.key || "", issue: !ids.has(id) ? "Missing target" : ids.get(id) == null ? "Ambiguous target" : "" });
      }
    }
  });
  return links;
}

export function deleteEntry(doc, target, options = {}) {
  writable(options);
  const item = resolveEntry(doc, target);
  const refs = entryReferences(doc, item);
  if (refs.length) throw new Error(`Deletion is blocked by ${refs.length} reference attribute(s) elsewhere in this document, including ${refs[0].value}.`);
  return applyEdits(doc, [{ start: item.node.outerStart, end: item.node.outerEnd, text: "" }]);
}

export function previewEntryBatch(doc, targets, { field, value }) {
  if (!["language", "number"].includes(field)) throw new Error("Batch editing supports only entry language and entry number.");
  checkFields({ [field]: value }, ["language", "number"]);
  if (!Array.isArray(targets) || !targets.length) throw new Error("Select at least one entry for this batch.");
  const records = targets.map((target) => resolveEntry(doc, target));
  if (new Set(records.map((record) => record.node)).size !== records.length) throw new Error("A batch target occurs more than once.");
  const changes = records.map((record) => Object.freeze({ key: record.key, headword: record.headword, before: record[field], after: value, changed: record[field] !== value }));
  const preview = Object.freeze({ field, value, changes: Object.freeze(changes), selected: records.length, changed: changes.filter((change) => change.changed).length });
  previews.set(preview, { doc, raw: doc.raw, records });
  return preview;
}

export function applyEntryBatch(doc, preview, options = {}) {
  writable(options);
  const owner = previews.get(preview);
  if (!owner || owner.doc !== doc || owner.raw !== doc.raw) throw new Error("The batch preview is stale. Preview the current document again before applying.");
  const edits = [];
  for (const target of owner.records) {
    const record = resolveEntry(doc, target);
    setAttribute(doc, record.node, preview.field === "language" ? "xml:lang" : "n", preview.value, edits);
  }
  return applyEdits(doc, edits);
}
