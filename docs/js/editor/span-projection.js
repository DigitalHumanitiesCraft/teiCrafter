/** Resolve TEI stand-off spans to offset-true reading ranges. */

import {
  getUnqualifiedAttr,
  getXmlId,
  isTeiElement,
  teiElementsByLocal,
  walk,
} from "./tei-document.js";

function pointerId(value) {
  const match = String(value || "").match(/^#([A-Za-z_][A-Za-z0-9._-]*)$/);
  return match ? match[1] : null;
}

/** Resolve each span's anchor pointers without interpreting its annotation type. */
export function resolvedSpanGroups(doc) {
  const anchors = new Map();
  walk(doc.root, (node) => {
    if (!isTeiElement(node, "anchor")) return;
    const id = getXmlId(node);
    if (id && !anchors.has(id)) anchors.set(id, node);
  });

  const groups = [];
  for (const group of teiElementsByLocal(doc.root, "spanGrp")) {
    const ranges = [];
    for (const span of teiElementsByLocal(group, "span")) {
      const fromId = pointerId(getUnqualifiedAttr(span, "from"));
      const toId = pointerId(getUnqualifiedAttr(span, "to"));
      const from = fromId ? anchors.get(fromId) : null;
      const to = toId ? anchors.get(toId) : null;
      const start = from?.outerEnd;
      const end = to?.outerStart;
      if (!Number.isInteger(start) || !Number.isInteger(end) || start >= end) continue;
      ranges.push({
        span,
        from,
        to,
        start,
        end,
        ana: getUnqualifiedAttr(span, "ana"),
        resp: getUnqualifiedAttr(span, "resp"),
      });
    }
    groups.push({
      id: getXmlId(group),
      type: getUnqualifiedAttr(group, "type"),
      el: group,
      ranges,
    });
  }
  return groups;
}

/** Internal entity id carried by a single-pointer stand-off span. */
export function spanEntityId(spanRange) {
  return pointerId(spanRange?.ana);
}
