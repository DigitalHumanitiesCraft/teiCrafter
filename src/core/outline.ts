/**
 * Document outline from the offset tree: the units an editor navigates by,
 * each a range of the canonical raw string with a label taken from the source.
 * Inside text structure only divisions and pages are units, so a body of lines
 * or paragraphs stays one unit; header children are listed two levels deep.
 * A page runs from its page break to the next sibling page break or the end of
 * the enclosing element.
 */
import { type TeiDocument, type TeiNode, getAttr, getXmlId, isTeiElement, textNodes, textOf } from "./tei-document.js";

export interface OutlineUnit {
  /** Stable within one outline: the path of child indices from the root. */
  id: string;
  /** Qualified element name, `pb` for a page, `#document` for the root. */
  name: string;
  label: string;
  start: number;
  end: number;
  parent: OutlineUnit | null;
  children: OutlineUnit[];
}

const STRUCTURE = new Set(["TEI", "teiCorpus", "text", "front", "body", "back", "group", "div", "div1", "div2", "div3", "div4", "div5", "div6", "div7"]);
// The JSDoc of isTeiElement infers its default null as the only parameter type.
const isTei = isTeiElement as (node: TeiNode, localName?: string | null) => boolean;
const clip = (s: string) => (s.length > 60 ? `${s.slice(0, 59)}…` : s);
const elementsOf = (el: TeiNode) => (el.children ?? []).filter((c) => c.type === "element");

/** A division's heading text, else its @type and @n, else the xml:id of a TEI root. */
export function elementLabel(doc: TeiDocument, el: TeiNode): string {
  const local = el.localName ?? "";
  if (local.startsWith("div")) {
    const head = elementsOf(el).find((c) => isTei(c, "head"));
    const text = head ? textNodes(head).map((t) => textOf(doc, t)).join("").replace(/\s+/g, " ").trim() : "";
    if (text) return clip(text);
  }
  const parts = [getAttr(el, "type"), getAttr(el, "n")].filter((v) => v);
  if (parts.length) return clip(parts.join(" "));
  return local === "TEI" ? (getXmlId(el) ?? "") : "";
}

function childUnits(doc: TeiDocument, el: TeiNode, parent: OutlineUnit, mode: "all" | "structure" | "header", depth: number): OutlineUnit[] {
  const kids = elementsOf(el);
  const pages = mode === "structure" ? kids.filter((c) => isTei(c, "pb")) : [];
  const limit = el.contentEnd ?? parent.end;
  const out: OutlineUnit[] = [];
  for (const c of kids) {
    const local = c.localName ?? "";
    const start = c.outerStart ?? 0;
    const id = `${parent.id}.${out.length}`;
    if (pages.includes(c)) {
      const next = pages[pages.indexOf(c) + 1];
      const n = getAttr(c, "n") ?? getXmlId(c);
      out.push({ id, name: "pb", label: n ? `page ${n}` : "page", start, end: next?.outerStart ?? limit, parent, children: [] });
      continue;
    }
    const structural = isTei(c) && STRUCTURE.has(local);
    if (mode === "structure" && !structural) continue;
    const unit: OutlineUnit = { id, name: c.qname ?? local, label: elementLabel(doc, c), start, end: c.outerEnd ?? limit, parent, children: [] };
    out.push(unit);
    if (isTei(c, "teiHeader")) unit.children = childUnits(doc, c, unit, "header", 1);
    else if (mode === "header") unit.children = depth < 2 ? childUnits(doc, c, unit, "header", depth + 1) : [];
    else if (local === "TEI" || local === "teiCorpus") unit.children = childUnits(doc, c, unit, "all", 0);
    else if (structural) unit.children = childUnits(doc, c, unit, "structure", 0);
  }
  return out;
}

export function buildOutline(doc: TeiDocument): OutlineUnit {
  const root: OutlineUnit = { id: "u", name: "#document", label: "Document", start: 0, end: doc.raw.length, parent: null, children: [] };
  const top = elementsOf(doc.root)[0];
  if (top) root.children = childUnits(doc, top, root, "all", 0);
  return root;
}

/** The innermost unit whose range contains a raw offset. */
export function unitAt(root: OutlineUnit, offset: number): OutlineUnit {
  let u = root;
  for (;;) {
    const inner = u.children.find((c) => c.start <= offset && offset < c.end);
    if (!inner) return u;
    u = inner;
  }
}
