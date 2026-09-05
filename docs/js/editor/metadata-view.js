/** Generic, byte-faithful teiHeader inventory with common-field labels. */

import {
  XMLNS_NAMESPACE,
  decodeEntities,
  escapeAttr,
  escapeText,
  assertEditableEntities,
  getAttr,
  parseDocument,
  textNodes,
} from "./tei-document.js";
import { el } from "./dom.js";

const FIELD_DEFS = Object.freeze([
  { key: "title", label: "Title", group: "File description", path: ["fileDesc", "titleStmt", "title"] },
  { key: "author", label: "Author", group: "File description", path: ["fileDesc", "titleStmt", "author"] },
  { key: "editor", label: "Editor", group: "File description", path: ["fileDesc", "titleStmt", "editor"] },
  { key: "sponsor", label: "Sponsor", group: "File description", path: ["fileDesc", "titleStmt", "sponsor"] },
  { key: "funder", label: "Funder", group: "File description", path: ["fileDesc", "titleStmt", "funder"] },
  { key: "edition", label: "Edition", group: "Edition", path: ["fileDesc", "editionStmt", "edition"] },
  { key: "editionDate", label: "Edition date", group: "Edition", path: ["fileDesc", "editionStmt", "edition", "date"] },
  { key: "publisher", label: "Publisher", group: "Publication", path: ["fileDesc", "publicationStmt", "publisher"] },
  { key: "pubPlace", label: "Publication place", group: "Publication", path: ["fileDesc", "publicationStmt", "pubPlace"] },
  { key: "publicationDate", label: "Publication date", group: "Publication", path: ["fileDesc", "publicationStmt", "date"] },
  { key: "publicationId", label: "Identifier", group: "Publication", path: ["fileDesc", "publicationStmt", "idno"] },
  { key: "licence", label: "Licence", group: "Publication", path: ["fileDesc", "publicationStmt", "availability", "licence"] },
  { key: "repository", label: "Repository", group: "Source", path: ["fileDesc", "sourceDesc", "msDesc", "msIdentifier", "repository"] },
  { key: "collection", label: "Collection", group: "Source", path: ["fileDesc", "sourceDesc", "msDesc", "msIdentifier", "collection"] },
  { key: "shelfmark", label: "Shelfmark", group: "Source", path: ["fileDesc", "sourceDesc", "msDesc", "msIdentifier", "idno"] },
  { key: "manuscript", label: "Manuscript name", group: "Source", path: ["fileDesc", "sourceDesc", "msDesc", "msIdentifier", "msName"] },
  { key: "project", label: "Project description", group: "Profile and encoding", path: ["encodingDesc", "projectDesc", "p"] },
  { key: "language", label: "Language", group: "Profile and encoding", path: ["profileDesc", "langUsage", "language"] },
  { key: "change", label: "Revision", group: "Revision history", path: ["revisionDesc", "change"] },
]);

const TOP_LEVEL_GROUPS = Object.freeze({
  fileDesc: "File description",
  encodingDesc: "Encoding description",
  profileDesc: "Profile description",
  xenoData: "External metadata",
  revisionDesc: "Revision history",
});

function childElements(node) {
  return (node && node.children || []).filter((child) => child.type === "element");
}

function siblingIndex(node) {
  if (!node.parent) return 1;
  const siblings = childElements(node.parent).filter((item) => (
    item.localName === node.localName && item.namespaceURI === node.namespaceURI
  ));
  return Math.max(1, siblings.indexOf(node) + 1);
}

function displayPath(nodes) {
  return nodes.map((node) => `${node.qname || node.localName}[${siblingIndex(node)}]`).join("/");
}

function qualifier(node) {
  for (const name of ["type", "ident", "when", "id"]) {
    const value = getAttr(node, name);
    if (value) return value;
  }
  return "";
}

function allText(doc, node) {
  return textNodes(node)
    .map((text) => decodeEntities(doc.raw.slice(text.start, text.end)))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function editableText(doc, node) {
  if (node.selfClosing || node.contentStart == null || node.contentEnd == null) return null;
  const children = node.children || [];
  if (children.length === 0) {
    return { start: node.contentStart, end: node.contentEnd, lead: "", value: "", trail: "" };
  }
  if (children.length !== 1 || children[0].type !== "text") return null;
  const text = children[0];
  const raw = doc.raw.slice(text.start, text.end);
  let lead = (raw.match(/^\s*/) || [""])[0];
  let trail = (raw.match(/\s*$/) || [""])[0];
  if (lead.length === raw.length) {
    lead = "";
    trail = raw;
  }
  const core = raw.slice(lead.length, raw.length - trail.length);
  return {
    start: text.start,
    end: text.end,
    lead,
    value: decodeEntities(core),
    trail,
  };
}

function commonDefinition(pathNodes, header) {
  if (!pathNodes.length || pathNodes.some((node) => node.namespaceURI !== header.namespaceURI)) return null;
  const path = pathNodes.map((node) => node.localName);
  return FIELD_DEFS.find((definition) => (
    definition.path.length === path.length
    && definition.path.every((name, index) => name === path[index])
  )) || null;
}

function genericGroup(pathNodes) {
  const top = pathNodes[0];
  if (!top) return "Header";
  return TOP_LEVEL_GROUPS[top.localName] || top.qname || top.localName || "Other metadata";
}

function elementLabel(node, definition) {
  const base = definition ? definition.label : node.qname || node.localName || "Element";
  const suffix = qualifier(node);
  return suffix ? `${base} (${suffix})` : base;
}

function elementField(doc, header, node, pathNodes) {
  const definition = commonDefinition(pathNodes, header);
  const editable = editableText(doc, node);
  return {
    id: `element:${node.outerStart}:text`,
    key: definition ? definition.key : null,
    kind: "text",
    group: definition ? definition.group : genericGroup(pathNodes),
    label: elementLabel(node, definition),
    path: displayPath([header, ...pathNodes]),
    qname: node.qname || node.localName,
    value: editable ? editable.value : allText(doc, node),
    editable: !!editable,
    xmlOnlyReason: editable ? "" : node.selfClosing
      ? "Empty-element syntax is edited in XML."
      : "This element has mixed or structured XML content.",
    start: editable ? editable.start : null,
    end: editable ? editable.end : null,
    lead: editable ? editable.lead : "",
    trail: editable ? editable.trail : "",
  };
}

function attributeFields(header, node, pathNodes, parentField) {
  return (node.attrs || []).map((attr) => {
    const namespaceDeclaration = attr.namespaceURI === XMLNS_NAMESPACE;
    return {
      id: `attribute:${attr.start}`,
      key: null,
      kind: "attribute",
      group: parentField.group,
      label: `${parentField.label} @${attr.name}`,
      path: `${displayPath([header, ...pathNodes])}/@${attr.name}`,
      qname: attr.name,
      value: attr.value,
      editable: !namespaceDeclaration,
      xmlOnlyReason: namespaceDeclaration ? "Namespace declarations are edited in XML." : "",
      start: namespaceDeclaration ? null : attr.valueStart,
      end: namespaceDeclaration ? null : attr.valueEnd,
      quote: attr.quote || '"',
      lead: "",
      trail: "",
    };
  });
}

/** Inventory every element and attribute below teiHeader in source order. */
export function readMetadataFields(doc) {
  const root = doc && childElements(doc.root)[0];
  const header = root && childElements(root).find((node) => (
    node.localName === "teiHeader" && node.namespaceURI === root.namespaceURI
  ));
  if (!header) return [];
  const fields = [];

  function visit(node, pathNodes) {
    const field = elementField(doc, header, node, pathNodes);
    fields.push(field, ...attributeFields(header, node, pathNodes, field));
    for (const child of childElements(node)) visit(child, [...pathNodes, child]);
  }

  const headerField = {
    id: `element:${header.outerStart}:text`,
    key: null,
    kind: "text",
    group: "Header",
    label: header.qname || "teiHeader",
    path: displayPath([header]),
    qname: header.qname || header.localName,
    value: allText(doc, header),
    editable: false,
    xmlOnlyReason: "The teiHeader container is edited in XML.",
    start: null,
    end: null,
    lead: "",
    trail: "",
  };
  fields.push(headerField, ...attributeFields(header, header, [], headerField));
  for (const child of childElements(header)) visit(child, [child]);
  return fields;
}

/** Apply changed simple text and attribute values as descending exact splices. */
export function applyMetadataEdits(doc, fields, values) {
  const splices = [];
  const byId = values instanceof Map ? values : new Map(Object.entries(values || {}));
  for (const field of fields || []) {
    if (!field.editable || !byId.has(field.id)) continue;
    const value = String(byId.get(field.id));
    if (value === field.value) continue;
    assertEditableEntities(doc.raw.slice(field.start, field.end));
    const encoded = field.kind === "attribute"
      ? escapeAttr(value, field.quote)
      : field.lead + escapeText(value) + field.trail;
    splices.push({ start: field.start, end: field.end, replacement: encoded });
  }
  if (!splices.length) return doc;
  splices.sort((left, right) => right.start - left.start);
  let raw = doc.raw;
  for (const splice of splices) {
    raw = raw.slice(0, splice.start) + splice.replacement + raw.slice(splice.end);
  }
  return parseDocument(raw);
}

/** Mount the complete metadata inventory. The integrator owns edition state. */
export function mountMetadataView(host, opts = {}) {
  const fields = readMetadataFields(opts.doc);
  const editable = fields.filter((field) => field.editable);
  const xmlOnly = fields.length - editable.length;
  const root = el("div", { class: "ed-meta-root" });
  const scope = el("span", {
    class: "ed-src-scope",
    text: opts.readOnly ? "teiHeader inventory · read only" : `teiHeader inventory · ${editable.length} editable · ${xmlOnly} XML-only`,
    title: "Every teiHeader element and attribute is inventoried. Simple text and attribute values are editable; structured XML remains byte-safe in Edit XML.",
  });
  const result = el("span", { class: "ed-src-result", "aria-live": "polite" });
  const xmlBtn = el("button", {
    class: "ed-btn",
    type: "button",
    text: opts.readOnly ? "View XML" : "Edit XML",
    title: "Open the complete exact teiHeader XML, including structured and project-specific metadata",
  });
  const applyBtn = el("button", {
    class: "ed-btn ed-btn-primary",
    type: "button",
    text: "Apply",
    disabled: "",
    title: "Apply the changed fields to the complete document",
  });
  const resetBtn = el("button", {
    class: "ed-btn",
    type: "button",
    text: "Reset",
    disabled: "",
    title: "Restore the field values currently stored in the document",
  });
  root.appendChild(el("div", { class: "ed-src-bar" }, [scope, result, xmlBtn, applyBtn, resetBtn]));
  applyBtn.hidden = resetBtn.hidden = !!opts.readOnly;

  const form = el("form", { class: "ed-meta-form" });
  const controls = new Map();
  const values = () => new Map([...controls].map(([id, control]) => [id, control.value]));
  const changed = () => editable.some((field) => controls.get(field.id).value !== field.value);
  const sync = () => {
    const dirty = changed();
    applyBtn.disabled = !dirty;
    resetBtn.disabled = !dirty;
    xmlBtn.disabled = dirty;
    xmlBtn.title = dirty
      ? "Apply or reset the staged field changes before opening the complete XML"
      : "Open the complete exact teiHeader XML, including structured and project-specific metadata";
    result.textContent = dirty ? "staged changes" : "";
    result.className = "ed-src-result";
  };

  if (!fields.length) {
    form.appendChild(el("p", {
      class: "ed-meta-empty",
      text: "No teiHeader fields were found. The complete header remains editable as XML.",
    }));
  } else {
    const groups = new Map();
    for (const field of fields) {
      if (!groups.has(field.group)) groups.set(field.group, []);
      groups.get(field.group).push(field);
    }
    for (const [group, groupFields] of groups) {
      const section = el("section", { class: "ed-meta-section" });
      section.appendChild(el("h2", { text: group }));
      for (const field of groupFields) {
        const row = el(field.editable ? "label" : "div", {
          class: "ed-meta-field",
          title: field.path,
          "data-kind": field.kind,
        });
        row.appendChild(el("span", { class: "ed-meta-label", text: field.label }));
        if (field.editable) {
          const long = field.kind === "text" && (field.value.length > 100 || field.value.includes("\n"));
          const control = long
            ? el("textarea", { rows: "2", spellcheck: "false" })
            : el("input", { type: "text", autocomplete: "off", spellcheck: "false" });
          control.value = field.value;
          control.readOnly = !!opts.readOnly;
          control.setAttribute("aria-label", `${field.label} (${field.path})`);
          control.addEventListener("input", sync);
          controls.set(field.id, control);
          row.appendChild(control);
        } else {
          row.classList.add("xml-only");
          const preview = field.value.length > 240 ? `${field.value.slice(0, 237)}...` : field.value;
          row.appendChild(el("span", {
            class: "ed-meta-readonly",
            text: preview || field.xmlOnlyReason || "(empty)",
            title: `${field.xmlOnlyReason} Use Edit XML for this exact field.`,
          }));
        }
        section.appendChild(row);
      }
      form.appendChild(section);
    }
  }

  const apply = () => {
    if (opts.readOnly) return false;
    if (!changed()) return true;
    try {
      const next = applyMetadataEdits(opts.doc, fields, values());
      if (typeof opts.onApply === "function" && opts.onApply(next) === false) return false;
      result.className = "ed-src-result ok";
      result.textContent = "applied";
      return true;
    } catch (error) {
      result.className = "ed-src-result err";
      result.textContent = error.message;
      return false;
    }
  };
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    apply();
  });
  applyBtn.addEventListener("click", () => form.requestSubmit());
  resetBtn.addEventListener("click", () => {
    for (const field of editable) controls.get(field.id).value = field.value;
    sync();
  });
  xmlBtn.addEventListener("click", () => {
    if (!changed() && typeof opts.onEditXml === "function") opts.onEditXml();
  });

  root.appendChild(form);
  host.appendChild(root);
  sync();
  return {
    hasChanges: changed,
    values,
    value: () => [...values()],
    apply,
    restore: (entries) => {
      for (const [id, value] of entries) if (controls.has(id)) controls.get(id).value = value;
      sync();
    },
    focus: () => {
      const first = controls.values().next().value;
      if (first) first.focus();
      else xmlBtn.focus();
    },
  };
}
