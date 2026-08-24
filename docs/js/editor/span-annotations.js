/** TEI stand-off spans for ranges that cannot be represented by one XML wrapper. */

import {
  addAttr,
  escapeAttr,
  getUnqualifiedAttr,
  getAttrObjInNamespace,
  getXmlId,
  isReadingText,
  isTeiElement,
  parseDocument,
  qualifyTeiMarkup,
  spliceDocument,
  teiElementsByLocal,
  walk,
} from "./tei-document.js";
import { ensureStandOff, topLevelStandOff } from "./standoff.js";

function existingIds(doc) {
  const ids = new Set();
  walk(doc.root, (node) => {
    const id = node.type === "element" ? getXmlId(node) : null;
    if (id) ids.add(id);
  });
  return ids;
}

function nextId(ids, base) {
  let candidate = base;
  let index = 2;
  while (ids.has(candidate)) candidate = `${base}-${index++}`;
  ids.add(candidate);
  return candidate;
}

function safeIdBase(value) {
  const base = String(value || "").trim();
  return /^[A-Za-z_][A-Za-z0-9._-]*$/.test(base) ? base : "teicrafter-span";
}

function textAtBoundary(doc, offset) {
  let inside = null;
  let ending = null;
  walk(doc.root, (node) => {
    if (!isReadingText(node)) return;
    if (node.start <= offset && offset < node.end) inside ||= node;
    else if (node.end === offset) ending ||= node;
  });
  return inside || ending;
}

function normalizeRanges(doc, ranges) {
  if (!Array.isArray(ranges) || !ranges.length) return null;
  const normalized = ranges.map((range) => ({
    start: Number(range?.start),
    end: Number(range?.end),
  })).sort((a, b) => a.start - b.start || a.end - b.end);
  for (let index = 0; index < normalized.length; index++) {
    const range = normalized[index];
    if (!Number.isInteger(range.start) || !Number.isInteger(range.end)
      || range.start < 0 || range.start >= range.end || range.end > doc.raw.length
      || !textAtBoundary(doc, range.start) || !textAtBoundary(doc, range.end)) return null;
    if (index > 0 && normalized[index - 1].end > range.start) return null;
  }
  return normalized;
}

function qname(context, localName) {
  return context?.prefix ? `${context.prefix}:${localName}` : localName;
}

/**
 * Add one spanGrp whose span children cover one continuous or several disjoint
 * ranges. The selected text stays byte-identical; only zero-width anchors and
 * the stand-off record are inserted.
 */
export function addSpanAnnotation(doc, ranges, opts = {}) {
  const normalized = normalizeRanges(doc, ranges);
  if (!normalized) return doc;
  const ids = existingIds(doc);
  const groupId = nextId(ids, safeIdBase(opts.id));
  const endpoints = [];
  const records = normalized.map((range, index) => {
    const from = nextId(ids, `${groupId}-${index + 1}-from`);
    const to = nextId(ids, `${groupId}-${index + 1}-to`);
    endpoints.push({ offset: range.start, role: "from", id: from, node: textAtBoundary(doc, range.start) });
    endpoints.push({ offset: range.end, role: "to", id: to, node: textAtBoundary(doc, range.end) });
    return { from, to };
  });

  const byOffset = new Map();
  for (const endpoint of endpoints) {
    if (!byOffset.has(endpoint.offset)) byOffset.set(endpoint.offset, []);
    byOffset.get(endpoint.offset).push(endpoint);
  }
  let raw = doc.raw;
  for (const [offset, atOffset] of [...byOffset].sort((a, b) => b[0] - a[0])) {
    atOffset.sort((a, b) => (a.role === "to" ? -1 : 1) - (b.role === "to" ? -1 : 1));
    const fragments = atOffset.map((endpoint) => qualifyTeiMarkup(
      `<anchor xml:id="${escapeAttr(endpoint.id)}"/>`,
      endpoint.node.parent,
    ));
    if (fragments.some((fragment) => fragment == null)) return doc;
    const fragment = fragments.join("");
    raw = raw.slice(0, offset) + fragment + raw.slice(offset);
  }

  const anchored = parseDocument(raw);
  const existingStandOff = topLevelStandOff(anchored);
  const ensured = ensureStandOff(anchored);
  let next = ensured.doc;
  let standOff = topLevelStandOff(next);
  if (ensured.created && standOff) {
    const containerId = nextId(existingIds(next), "teicrafter-standoff");
    next = addAttr(next, standOff, "xml:id", containerId);
    standOff = topLevelStandOff(next);
    next = addAttr(next, standOff, "type", "teicrafter-generated");
    standOff = topLevelStandOff(next);
  }
  if (!standOff || standOff.contentEnd == null) return doc;
  const groupName = qname(standOff, "spanGrp");
  const spanName = qname(standOff, "span");
  const type = String(opts.type || "annotation").trim();
  const ana = String(opts.ana || "").trim();
  const resp = String(opts.resp || "").trim();
  const restoreSelfClosingParent = existingStandOff?.selfClosing
    || (existingStandOff && teiElementsByLocal(existingStandOff, "spanGrp").some((group) =>
      getUnqualifiedAttr(group, "subtype") === "teicrafter-generated-selfclosing-parent"));
  const subtype = restoreSelfClosingParent
    ? "teicrafter-generated-selfclosing-parent"
    : "teicrafter-generated";
  const shared = (ana ? ` ana="${escapeAttr(ana)}"` : "")
    + (resp ? ` resp="${escapeAttr(resp)}"` : "");
  const newline = next.raw.includes("\r\n") ? "\r\n" : "\n";
  const spans = records.map((record) => `${newline}      <${spanName} from="#${escapeAttr(record.from)}" to="#${escapeAttr(record.to)}"${shared}/>`).join("");
  const snippet = `${newline}    <${groupName} xml:id="${escapeAttr(groupId)}" type="${escapeAttr(type)}" subtype="${subtype}">${spans}${newline}    </${groupName}>`;
  next = spliceDocument(next, standOff.contentEnd, standOff.contentEnd, snippet);
  return next;
}

/** Read teiCrafter-created and compatible span groups without resolving anchors. */
export function readSpanAnnotations(doc) {
  return teiElementsByLocal(doc.root, "spanGrp").map((group) => ({
    id: getXmlId(group),
    type: getUnqualifiedAttr(group, "type"),
    spans: teiElementsByLocal(group, "span").map((span) => ({
      from: getUnqualifiedAttr(span, "from"),
      to: getUnqualifiedAttr(span, "to"),
      ana: getUnqualifiedAttr(span, "ana"),
      resp: getUnqualifiedAttr(span, "resp"),
    })),
  }));
}

function groupById(doc, groupId) {
  const matches = teiElementsByLocal(doc.root, "spanGrp")
    .filter((group) => getXmlId(group) === groupId);
  return matches.length === 1 ? matches[0] : null;
}

function localPointer(value) {
  const match = String(value || "").match(/^#([A-Za-z_][A-Za-z0-9._-]*)$/);
  return match ? match[1] : null;
}

function isWithin(node, ancestor) {
  for (let current = node; current; current = current.parent) {
    if (current === ancestor) return true;
  }
  return false;
}

function hasExternalPointer(doc, id, excluded) {
  let found = false;
  walk(doc.root, (node) => {
    if (found || node.type !== "element" || isWithin(node, excluded)) return;
    for (const attr of node.attrs || []) {
      if (String(attr.value || "").split(/\s+/).includes(`#${id}`)) {
        found = true;
        return;
      }
    }
  });
  return found;
}

/** Relink every segment in one entity span group as a single editorial action. */
export function relinkSpanAnnotation(doc, groupId, entityId) {
  if (!/^[A-Za-z_][A-Za-z0-9._-]*$/.test(String(entityId || ""))) return doc;
  const group = groupById(doc, groupId);
  if (!group) return doc;
  const spans = teiElementsByLocal(group, "span");
  if (!spans.length) return doc;
  const attrs = spans.map((span) => getAttrObjInNamespace(span, null, "ana"));
  if (attrs.some((attr) => !attr)) return doc;
  const value = `#${entityId}`;
  if (attrs.every((attr) => attr.value === value)) return doc;
  let next = doc;
  for (const attr of attrs.sort((a, b) => b.valueStart - a.valueStart)) {
    next = spliceDocument(next, attr.valueStart, attr.valueEnd, escapeAttr(value, attr.quote));
  }
  return next;
}

/** Remove one span group and any boundary anchors that no other span references. */
export function removeSpanAnnotation(doc, groupId) {
  const group = groupById(doc, groupId);
  if (!group || group.outerEnd == null) return doc;
  if (hasExternalPointer(doc, groupId, group)) return doc;
  const groupSpans = teiElementsByLocal(group, "span");
  const groupAnchorIds = new Set();
  for (const span of groupSpans) {
    for (const name of ["from", "to"]) {
      const id = localPointer(getUnqualifiedAttr(span, name));
      if (id) groupAnchorIds.add(id);
    }
  }
  const anchors = new Map();
  walk(doc.root, (node) => {
    if (!isTeiElement(node, "anchor")) return;
    const id = getXmlId(node);
    if (id && !anchors.has(id)) anchors.set(id, node);
  });
  const generatedSubtype = getUnqualifiedAttr(group, "subtype") || "";
  const newline = doc.raw.includes("\r\n") ? "\r\n" : "\n";
  const insertedPrefix = `${newline}    `;
  const groupStart = generatedSubtype.startsWith("teicrafter-generated")
    && doc.raw.slice(group.outerStart - insertedPrefix.length, group.outerStart) === insertedPrefix
    ? group.outerStart - insertedPrefix.length
    : group.outerStart;
  const removable = [{ ...group, outerStart: groupStart }];
  for (const id of groupAnchorIds) {
    const anchor = anchors.get(id);
    if (anchor?.outerEnd != null && !hasExternalPointer(doc, id, group)) removable.push(anchor);
  }
  let next = doc;
  for (const element of removable.sort((a, b) => b.outerStart - a.outerStart)) {
    next = spliceDocument(next, element.outerStart, element.outerEnd, "");
  }
  const reparsed = parseDocument(next.raw);
  const standOff = topLevelStandOff(reparsed);
  if (standOff?.contentStart != null && standOff.contentEnd != null
    && !reparsed.raw.slice(standOff.contentStart, standOff.contentEnd).trim()) {
    if (generatedSubtype === "teicrafter-generated-selfclosing-parent") {
      const opening = reparsed.raw.slice(standOff.outerStart, standOff.contentStart);
      const selfClosing = opening.replace(/>$/, "/>");
      next = spliceDocument(reparsed, standOff.outerStart, standOff.outerEnd, selfClosing);
    } else {
      const containerId = getXmlId(standOff);
      const attrs = standOff.attrs || [];
      const generatedContainer = getUnqualifiedAttr(standOff, "type") === "teicrafter-generated"
        && /^teicrafter-standoff(?:-\d+)?$/.test(containerId || "")
        && attrs.every((attr) => attr.name === "xml:id" || attr.localName === "type")
        && !hasExternalPointer(reparsed, containerId, standOff);
      if (generatedContainer) {
        const containerPrefix = `${newline}  `;
        const before = reparsed.raw.slice(
          standOff.outerStart - containerPrefix.length,
          standOff.outerStart,
        );
        const start = before === containerPrefix
          ? standOff.outerStart - containerPrefix.length
          : standOff.outerStart;
        next = spliceDocument(reparsed, start, standOff.outerEnd, "");
      }
    }
  }
  return next;
}
