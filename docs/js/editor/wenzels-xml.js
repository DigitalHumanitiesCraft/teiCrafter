/** Shared lossless XML operations for the Wenzelsbibel workspaces. */
import {
  escapeAttr, escapeText, getAttrObjInNamespace, getXmlId, isTeiElement,
  parseDocument, qualifyTeiMarkup, textNodes, textOf, walk,
} from "./tei-document.js";

export const XML_NS = "http://www.w3.org/XML/1998/namespace";
export const children = (node, name) => (node?.children || []).filter((child) => isTeiElement(child, name));
export const topLevelStandOff = (doc) => children(children(doc.root, "TEI")[0], "standOff")[0] || null;
export const contentText = (doc, node) => textNodes(node).map((text) => textOf(doc, text)).join("");
export const attr = (node, name) => getAttrObjInNamespace(node, null, name)?.value || "";
export const xmlAttr = (node, name) => getAttrObjInNamespace(node, XML_NS, name)?.value || "";
export const has = (object, key) => Object.hasOwn(object, key);

export function requireId(value) {
  const id = String(value || "").replace(/^#/, "");
  if (!/^[\p{L}\p{Nl}_][\p{L}\p{Nl}\p{N}\p{M}._\-\u00B7]*$/u.test(id)) {
    throw new Error("Enter a valid XML identifier without spaces or colons.");
  }
  return id;
}

export function idIndex(doc) {
  const index = new Map();
  walk(doc.root, (node) => {
    const id = node.type === "element" && getXmlId(node);
    if (!id) return;
    if (index.has(id)) index.set(id, null);
    else index.set(id, node);
  });
  return index;
}

export function newId(doc, requested, base) {
  const ids = idIndex(doc);
  if (requested) {
    const id = requireId(requested);
    if (ids.has(id)) throw new Error(`The identifier ${id} already exists.`);
    return id;
  }
  let id = base;
  let number = 2;
  while (ids.has(id)) id = `${base}-${number++}`;
  return id;
}

export function assertCurrent(doc, node) {
  let root = node;
  while (root?.parent) root = root.parent;
  if (root !== doc.root) throw new Error("The document changed. Open the annotation again before editing.");
}

export function resolveRecord(doc, records, recordOrId) {
  if (typeof recordOrId === "object" && recordOrId?.node) {
    assertCurrent(doc, recordOrId.node);
    const record = records.find((item) => item.node === recordOrId.node);
    if (record) return record;
  } else {
    const id = String(recordOrId || "").replace(/^#/, "");
    const matches = records.filter((item) => item.id === id || item.key === id);
    if (matches.length === 1 && (!matches[0].id || idIndex(doc).get(matches[0].id) === matches[0].node)) return matches[0];
  }
  throw new Error("The annotation does not have an unambiguous current identity.");
}

export function patchAttribute(doc, node, name, value, edits) {
  const xml = name.startsWith("xml:");
  const existing = getAttrObjInNamespace(node, xml ? XML_NS : null, xml ? name.slice(4) : name);
  if (value == null) {
    if (existing) {
      const start = /\s/.test(doc.raw[existing.start - 1] || "") ? existing.start - 1 : existing.start;
      edits.push({ start, end: existing.end, text: "" });
    }
  } else if (existing) {
    if (existing.value !== String(value)) edits.push({ start: existing.valueStart, end: existing.valueEnd, text: escapeAttr(value, existing.quote) });
  } else {
    edits.push({ start: node.stagStart + 1 + node.qname.length, end: node.stagStart + 1 + node.qname.length, text: ` ${name}="${escapeAttr(value)}"` });
  }
}

export function patchText(doc, node, value, edits) {
  if (contentText(doc, node) === String(value)) return;
  if ((node.children || []).some((child) => child.type !== "text" && child.type !== "cdata")) {
    throw new Error("This field contains structured XML. Edit its XML to preserve the embedded markup.");
  }
  if (node.selfClosing) {
    edits.push({ start: node.outerEnd - 2, end: node.outerEnd, text: `>${escapeText(value)}</${node.qname}>` });
  } else {
    edits.push({ start: node.contentStart, end: node.contentEnd, text: escapeText(value) });
  }
}

export function appendChild(doc, parent, fragment, edits) {
  const qualified = qualifyTeiMarkup(fragment, parent);
  if (qualified == null) throw new Error("The insertion context is not a TEI element.");
  if (parent.selfClosing) {
    edits.push({ start: parent.outerEnd - 2, end: parent.outerEnd, text: `>${qualified}</${parent.qname}>` });
  } else edits.push({ start: parent.contentEnd, end: parent.contentEnd, text: qualified });
}

export function applyEdits(doc, edits) {
  if (!edits.length) return doc;
  const insertions = new Map();
  const combined = [];
  for (const edit of edits) {
    if (edit.start !== edit.end) { combined.push(edit); continue; }
    if (insertions.has(edit.start)) insertions.get(edit.start).text += edit.text;
    else {
      const insertion = { ...edit };
      insertions.set(edit.start, insertion);
      combined.push(insertion);
    }
  }
  const ordered = combined.filter((edit) => doc.raw.slice(edit.start, edit.end) !== edit.text)
    .sort((a, b) => b.start - a.start || b.end - a.end);
  if (!ordered.length) return doc;
  let raw = doc.raw;
  let boundary = raw.length;
  for (const edit of ordered) {
    if (!Number.isInteger(edit.start) || !Number.isInteger(edit.end)
      || edit.start < 0 || edit.end < edit.start || edit.end > boundary) {
      throw new Error("The requested edits overlap or have stale source positions.");
    }
    raw = raw.slice(0, edit.start) + edit.text + raw.slice(edit.end);
    boundary = edit.start;
  }
  return raw === doc.raw ? doc : parseDocument(raw);
}

export function assertUnreferenced(doc, node) {
  const id = getXmlId(node);
  if (!id) return;
  let referenced = false;
  walk(doc.root, (candidate) => {
    if (candidate.type !== "element") return;
    let parent = candidate;
    while (parent && parent !== node) parent = parent.parent;
    if (parent === node) return;
    if ((candidate.attrs || []).some((value) => value.value.split(/\s+/).includes(`#${id}`))) referenced = true;
  });
  if (referenced) throw new Error(`The identifier ${id} is referenced elsewhere in this document.`);
}

export function removeRecord(doc, record) {
  assertUnreferenced(doc, record.node);
  let target = record.node;
  const requiredChildren = {
    listApp: new Set(["app", "listApp"]), listPerson: new Set(["person", "personGrp", "listPerson"]),
    listPlace: new Set(["place", "listPlace"]), listOrg: new Set(["org", "listOrg"]),
  };
  const parent = target.parent;
  const required = isTeiElement(parent) && requiredChildren[parent.localName];
  if (required && !(parent.children || []).some((child) => child !== target && isTeiElement(child) && required.has(child.localName))) {
    const hasMetadata = (parent.children || []).some((child) => child !== target
      && (child.type !== "text" || doc.raw.slice(child.start, child.end).trim()));
    const hasExtraAttributes = (parent.attrs || []).some((value) => value.namespaceURI != null || value.localName !== "type");
    if (hasMetadata || hasExtraAttributes) throw new Error("The last entry belongs to a list with additional metadata. Edit its XML to preserve that metadata.");
    assertUnreferenced(doc, parent);
    target = parent;
  }
  const container = target.parent;
  if (isTeiElement(container, "standOff") && !(container.children || []).some((child) => child !== target && child.type === "element")) {
    if ((container.attrs || []).length || (container.children || []).some((child) => child !== target
      && (child.type !== "text" || doc.raw.slice(child.start, child.end).trim()))) {
      throw new Error("The stand-off container has additional metadata. Edit its XML before removing its last list.");
    }
    target = container;
  }
  return applyEdits(doc, [{ start: target.outerStart, end: target.outerEnd, text: "" }]);
}

export function noteXml(note) {
  const language = note.lang ? ` xml:lang="${escapeAttr(note.lang)}"` : "";
  const responsibility = note.resp ? ` resp="${escapeAttr(note.resp)}"` : "";
  return `<note${language}${responsibility}>${escapeText(note.text || "")}</note>`;
}

export function readNotes(doc, parent) {
  return children(parent, "note").map((node, index) => ({
    index, node, text: contentText(doc, node), lang: xmlAttr(node, "lang"), resp: attr(node, "resp"),
    textEditable: !(node.children || []).some((child) => child.type !== "text" && child.type !== "cdata"),
  }));
}

/** Unspecified notes and attributes are retained; deletion requires remove: true. */
export function patchNotes(doc, parent, notes, edits) {
  if (!Array.isArray(notes)) throw new Error("Notes must be an array.");
  const existing = children(parent, "note");
  notes.forEach((note, index) => {
    const target = note.node || existing[note.index ?? index];
    if (target) {
      assertCurrent(doc, target);
      if (!existing.includes(target)) throw new Error("The note belongs to a different annotation.");
      if (note.remove) {
        assertUnreferenced(doc, target);
        edits.push({ start: target.outerStart, end: target.outerEnd, text: "" });
      } else {
        if (has(note, "text")) patchText(doc, target, note.text, edits);
        if (has(note, "lang")) patchAttribute(doc, target, "xml:lang", note.lang || null, edits);
        if (has(note, "resp")) patchAttribute(doc, target, "resp", note.resp || null, edits);
      }
    } else if (!note.remove) appendChild(doc, parent, noteXml(note), edits);
  });
}
