/** Materialize source-independent navigation channels from real TEI anchors. */

import {
  getUnqualifiedAttr,
  getXmlId,
  isReadingText,
  isTeiElement,
  readingRoot,
  textOf,
  walk,
} from "./tei-document.js";

function pointerTokens(element) {
  return String(getUnqualifiedAttr(element, "facs") || "").split(/\s+/).filter(Boolean);
}

function shortText(doc, node) {
  const parts = [];
  walk(node, (candidate) => {
    if (candidate.type === "text" && isReadingText(candidate)) parts.push(textOf(doc, candidate));
  });
  return parts.join(" ").replace(/\s+/g, " ").trim().slice(0, 80);
}

function childLabel(doc, element, names) {
  for (const child of element.children || []) {
    if (!isTeiElement(child) || !names.includes(child.localName)) continue;
    const value = shortText(doc, child);
    if (value) return value;
  }
  return null;
}

function elementLabel(doc, element, index, singular, labelChildren = ["head"]) {
  return getUnqualifiedAttr(element, "n")
    || childLabel(doc, element, labelChildren)
    || getXmlId(element)
    || `${singular} ${index + 1}`;
}

function outermost(elements) {
  const selected = new Set(elements);
  return elements.filter((element) => {
    let parent = element.parent;
    while (parent && parent.type === "element") {
      if (selected.has(parent)) return false;
      parent = parent.parent;
    }
    return true;
  });
}

function channel(id, label, capability, boundary, names, units, evidence) {
  return {
    id,
    label,
    capability,
    boundary,
    selector: { namespace: "tei", names, outermost: boundary === "element" },
    units,
    source: "structure",
    evidence,
  };
}

function navigationUnit(data, anchor) {
  const unit = {
    ...data,
    anchorRef: anchor ? {
      localName: anchor.localName,
      xmlId: getXmlId(anchor),
      start: anchor.outerStart,
      end: anchor.outerEnd,
    } : null,
  };
  Object.defineProperty(unit, "anchor", { value: anchor || null, enumerable: false });
  return unit;
}

function milestonePages(doc, index) {
  const root = readingRoot(doc);
  const pages = (index.get("pb") || []).filter((page) => page.outerStart >= (root.outerStart ?? root.start ?? 0)
    && page.outerEnd <= (root.outerEnd ?? root.end ?? doc.raw.length));
  if (!pages.length) return null;
  const units = [];
  const rootStart = root.contentStart ?? root.start ?? 0;
  const rootEnd = root.contentEnd ?? root.end ?? doc.raw.length;
  const firstStart = pages[0].outerStart ?? pages[0].start;
  if (doc.raw.slice(rootStart, firstStart).replace(/<[^>]+>/g, "").trim()) {
    units.push(navigationUnit({
      id: "pages-before-1",
      label: "Before page 1",
      index: 0,
      start: rootStart,
      end: firstStart,
      facsimileRefs: [],
    }, null));
  }
  pages.forEach((page, pageIndex) => {
    const start = page.outerStart ?? page.start;
    const next = pages[pageIndex + 1];
    const end = next ? (next.outerStart ?? next.start) : rootEnd;
    units.push(navigationUnit({
      id: getXmlId(page) || `page-${pageIndex + 1}`,
      label: getUnqualifiedAttr(page, "n") || `Page ${pageIndex + 1}`,
      index: units.length,
      start,
      end,
      facsimileRefs: pointerTokens(page),
    }, page));
  });
  return channel("pages", "Pages", "pages", "milestone", ["pb"], units,
    [`${pages.length} TEI pb milestone(s)`]);
}

function elementChannel(doc, config, index) {
  const root = config.documentScope ? doc.root : readingRoot(doc);
  const rootStart = root.outerStart ?? root.start ?? 0;
  const rootEnd = root.outerEnd ?? root.end ?? doc.raw.length;
  const elements = outermost(config.names.flatMap((name) => index.get(name) || [])
    .filter((element) => element.outerStart >= rootStart && element.outerEnd <= rootEnd)
    .sort((a, b) => a.outerStart - b.outerStart));
  if (elements.length < (config.minCount || 1)) return null;
  const contentStart = root.contentStart ?? root.start ?? 0;
  const contentEnd = root.contentEnd ?? root.end ?? doc.raw.length;
  const units = [];
  const firstStart = elements[0].outerStart;
  if (!config.documentScope && doc.raw.slice(contentStart, firstStart).replace(/<[^>]+>/g, "").trim()) {
    units.push(navigationUnit({
      id: `${config.id}-before-1`,
      label: `Before ${config.singular.toLowerCase()} 1`,
      index: 0,
      start: contentStart,
      end: firstStart,
      facsimileRefs: [],
    }, null));
  }
  elements.forEach((element, elementIndex) => {
    const next = elements[elementIndex + 1];
    units.push(navigationUnit({
      id: getXmlId(element) || `${config.id}-${elementIndex + 1}`,
      label: elementLabel(doc, element, elementIndex, config.singular, config.labelChildren),
      index: units.length,
      start: element.outerStart,
      end: next ? next.outerStart : contentEnd,
      contentStart: element.outerStart,
      contentEnd: element.outerEnd,
      facsimileRefs: pointerTokens(element),
    }, element));
  });
  return channel(config.id, config.label, config.capability, "element", config.names, units,
    [`${elements.length} outermost ${config.names.join("/")} element(s)`]);
}

function documentChannel(doc, index) {
  const anchor = (index.get("TEI") || [])[0] || (index.get("teiCorpus") || [])[0] || null;
  const root = readingRoot(doc);
  return channel("document", "Document", "logical-flow", "document", anchor ? [anchor.localName] : [], [navigationUnit({
    id: getXmlId(anchor) || "document-1",
    label: "Document",
    index: 0,
    start: root.outerStart ?? root.start ?? 0,
    end: root.outerEnd ?? root.end ?? doc.raw.length,
    facsimileRefs: anchor ? pointerTokens(anchor) : [],
  }, anchor)], ["whole-document fallback"]);
}

/** Build every navigation channel supported by structures in the current TEI. */
export function materializeNavigation(doc) {
  const configs = [
    { id: "corpus-members", label: "Corpus members", singular: "Corpus member", capability: "corpus-members", names: ["TEI"], labelChildren: ["teiHeader", "head"], documentScope: true, minCount: 2 },
    { id: "entries", label: "Entries", singular: "Entry", capability: "entries", names: ["superEntry", "entry", "entryFree"], labelChildren: ["form", "orth", "head"] },
    { id: "speech-turns", label: "Speech turns", singular: "Turn", capability: "speech-turns", names: ["u", "sp", "annotationBlock"], labelChildren: ["speaker", "head"] },
    { id: "table-rows", label: "Table rows", singular: "Row", capability: "tabular", names: ["row"], labelChildren: ["cell"] },
    { id: "records", label: "Records", singular: "Record", capability: "descriptive-records", names: ["biblFull", "msDesc"], labelChildren: ["titleStmt", "head"], documentScope: true, minCount: 2 },
    { id: "source-documents", label: "Source documents", singular: "Source document", capability: "source-document", names: ["sourceDoc"], labelChildren: ["desc", "head"], documentScope: true },
    { id: "sections", label: "Sections", singular: "Section", capability: "logical-flow", names: ["div"], labelChildren: ["head"] },
    { id: "surfaces", label: "Facsimile surfaces", singular: "Surface", capability: "facsimile-resource", names: ["surface"], labelChildren: ["desc", "head"], documentScope: true },
  ];
  const names = new Set(["pb", "TEI", "teiCorpus", ...configs.flatMap((config) => config.names)]);
  const index = new Map([...names].map((name) => [name, []]));
  walk(doc.root, (node) => {
    if (isTeiElement(node) && names.has(node.localName)) index.get(node.localName).push(node);
  });
  const channels = [milestonePages(doc, index), ...configs.map((config) => elementChannel(doc, config, index)), documentChannel(doc, index)]
    .filter(Boolean);
  return channels;
}
