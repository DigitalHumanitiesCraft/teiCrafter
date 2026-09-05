/**
 * teiCrafter Editor -- annotation progress projection.
 *
 * The page map and the project-file badges use one deterministic definition of
 * "annotated": a reading-page element carries a scholarly inline role, one of
 * the annotation pointer/provenance attributes, or is a note. StandOff notes
 * are assigned to the page of their target through the existing note index.
 */

import { isTeiElement, walk } from "./tei-document.js";
import { folioSourceSlice } from "./edition.js";
import { REVIEW_TOKEN } from "./review-progress.js";
import { resolvedSpanGroups } from "./span-projection.js";

const ENTITY_LOCALS = new Set([
  "name", "persName", "placeName", "orgName", "geogName", "roleName",
]);
const CRITICAL_LOCALS = new Set([
  "add", "del", "unclear", "gap", "sic", "corr", "orig", "reg",
  "supplied", "surplus", "choice",
]);
const MARKUP_LOCALS = new Set([
  "date", "time", "term", "foreign", "hi", "seg", "ref", "bibl",
  "title", "measure", "num", "metamark", "mentioned", "quote", "q",
  "abbr", "expan",
]);
const ANNOTATION_ATTRS = new Set(["ana", "ref", "corresp", "target", "resp", "cert"]);

function annotationKind(node) {
  if (!isTeiElement(node)) return null;
  if (node.localName === "note") return "notes";
  if (ENTITY_LOCALS.has(node.localName)) return "entities";
  if (CRITICAL_LOCALS.has(node.localName)) return "criticism";
  if (MARKUP_LOCALS.has(node.localName)) return "markup";
  const hasAnnotationAttr = (node.attrs || []).some((attr) => {
    if (attr.namespaceURI != null) return false;
    if (!ANNOTATION_ATTRS.has(attr.localName)) return false;
    if (attr.localName !== "ana") return true;
    return String(attr.value || "").split(/\s+/).some((token) => token && token !== REVIEW_TOKEN);
  });
  if (hasAnnotationAttr) return "markup";
  return null;
}

function pageForOffset(ranges, offset) {
  let low = 0;
  let high = ranges.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const range = ranges[mid];
    if (offset < range.start) high = mid - 1;
    else if (offset >= range.end) low = mid + 1;
    else return mid;
  }
  return -1;
}

/**
 * Summarize annotation-bearing pages without changing the edition state.
 * `noteIndex` is the existing target-id map from standoff.noteIndex().
 */
export function annotationPageSummary(state, noteIndex = new Map()) {
  const folios = state && Array.isArray(state.folios) ? state.folios : [];
  const ranges = folios.map((_, index) => folioSourceSlice(state, index));
  const pages = folios.map((folio, index) => ({
    index,
    label: folio.n != null ? String(folio.n) : String(index + 1),
    count: 0,
    kinds: new Set(),
    ai: false,
  }));

  if (state && state.doc) {
    walk(state.doc.root, (node) => {
      if (node.type !== "element" || node.outerStart == null) return;
      const kind = annotationKind(node);
      if (!kind) return;
      const pageIndex = pageForOffset(ranges, node.outerStart);
      if (pageIndex < 0) return;
      const page = pages[pageIndex];
      page.count += 1;
      page.kinds.add(kind);
      if ((node.attrs || []).some(
        (attr) => attr.namespaceURI == null && attr.localName === "resp",
      )) page.ai = true;
    });

    const spanGroups = state.doc.raw.includes("spanGrp") ? resolvedSpanGroups(state.doc) : [];
    for (const group of spanGroups) {
      const covered = new Set();
      let ai = false;
      for (const range of group.ranges) {
        if (range.resp) ai = true;
        ranges.forEach((pageRange, pageIndex) => {
          if (range.start < pageRange.end && range.end > pageRange.start) covered.add(pageIndex);
        });
      }
      for (const pageIndex of covered) {
        const page = pages[pageIndex];
        page.count += 1;
        page.kinds.add(group.type === "entity" ? "entities" : "markup");
        if (ai) page.ai = true;
      }
    }
  }

  // A standOff note lives outside the page range. Assign it through the target
  // key used by the reading cells, counting each target once per page.
  if (noteIndex && noteIndex.size) {
    for (const page of pages) {
      const targets = new Set();
      for (const line of folios[page.index].lines || []) {
        for (const cell of line.cells || []) {
          if (noteIndex.has(cell.id)) targets.add(cell.id);
          else if (cell.facs && noteIndex.has(cell.facs)) targets.add(cell.facs);
        }
      }
      if (targets.size) {
        page.count += targets.size;
        page.kinds.add("notes");
      }
    }
  }

  const annotated = pages.filter((page) => page.count > 0);
  return {
    totalPages: pages.length,
    annotatedPages: annotated.length,
    totalAnnotations: pages.reduce((sum, page) => sum + page.count, 0),
    pages,
  };
}
