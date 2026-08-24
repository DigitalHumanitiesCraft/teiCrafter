/** Namespace-strict structural inventory used for source-profile inference. */

import {
  getUnqualifiedAttr,
  isReadingText,
  isTeiElement,
  textOf,
  walk,
} from "./tei-document.js";

function addCount(target, key) {
  target[key] = (target[key] || 0) + 1;
}

function pointerKind(value) {
  const tokens = String(value || "").split(/\s+/).filter(Boolean);
  return {
    internal: tokens.filter((token) => token.startsWith("#")).length,
    external: tokens.filter((token) => !token.startsWith("#")).length,
  };
}

function xmlModelReference(raw) {
  const attrs = {};
  for (const match of raw.matchAll(/([A-Za-z_][\w.-]*)\s*=\s*(["'])(.*?)\2/g)) {
    attrs[match[1]] = match[3];
  }
  return attrs.href ? {
    href: attrs.href,
    type: attrs.schematypens || attrs.type || null,
  } : null;
}

/** Inspect what the current TEI actually contains without changing its bytes. */
export function inventoryDocument(doc) {
  const elements = {};
  const attributes = {};
  const attributeValues = {};
  const schemaRefs = [];
  const facsimileRefs = { internal: 0, external: 0 };
  let readingTextNodes = 0;
  let readingCharacters = 0;

  walk(doc.root, (node) => {
    if (node.type === "pi") {
      const raw = doc.raw.slice(node.start, node.end);
      if (/^<\?xml-model\b/.test(raw)) {
        const ref = xmlModelReference(raw);
        if (ref) schemaRefs.push({ source: "xml-model", ...ref });
      }
      return;
    }
    if (node.type === "text" && isReadingText(node)) {
      const text = textOf(doc, node);
      if (text.trim()) {
        readingTextNodes += 1;
        readingCharacters += text.length;
      }
      return;
    }
    if (!isTeiElement(node)) return;
    addCount(elements, node.localName);
    for (const attr of node.attrs || []) {
      if (attr.namespaceURI != null) continue;
      addCount(attributes, attr.localName);
      const key = `${node.localName}@${attr.localName}`;
      if (!attributeValues[key]) attributeValues[key] = [];
      if (!attributeValues[key].includes(attr.value)) attributeValues[key].push(attr.value);
      if (attr.localName === "facs") {
        const kinds = pointerKind(attr.value);
        facsimileRefs.internal += kinds.internal;
        facsimileRefs.external += kinds.external;
      }
    }
  });

  const root = (doc.root.children || []).find((node) =>
    isTeiElement(node, "teiCorpus") || isTeiElement(node, "TEI")) || null;
  return {
    version: 1,
    root: root ? root.localName : null,
    elements,
    attributes,
    attributeValues,
    reading: { textNodes: readingTextNodes, characters: readingCharacters },
    facsimileRefs,
    schemaRefs,
    has(localName) { return (elements[localName] || 0) > 0; },
    count(localName) { return elements[localName] || 0; },
    values(element, attribute) { return attributeValues[`${element}@${attribute}`] || []; },
    rootType: root ? getUnqualifiedAttr(root, "type") : null,
  };
}
