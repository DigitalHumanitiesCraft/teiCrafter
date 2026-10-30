/**
 * Facts about one element read from the offset tree: the entity class a
 * reading view colours it with, and a one-line summary of what it holds.
 */
import { type TeiDocument, type TeiNode, firstByLocal, getAttr, getXmlId, textNodes, textOf, walk } from "./tei-document.js";

export const ENTITY_NAMES: ReadonlySet<string> = new Set(["persName", "placeName", "orgName"]);

/** name and rs carry no entity class of their own; their @type or the element their @ref points at supplies it. */
export const ENTITY_BY_KIND: Readonly<Record<string, string>> = {
  person: "persName", place: "placeName", org: "orgName", organisation: "orgName", organization: "orgName",
};

/** Elements by xml:id, first occurrence wins. */
export function idIndex(root: TeiNode): Map<string, TeiNode> {
  const ids = new Map<string, TeiNode>();
  walk(root, (n: TeiNode) => {
    if (n.type !== "element") return;
    const id = getXmlId(n);
    if (id && !ids.has(id)) ids.set(id, n);
  });
  return ids;
}

/** persName, placeName or orgName for an entity element, else null. */
export function entityOf(el: TeiNode, ids: ReadonlyMap<string, TeiNode>): string | null {
  const name = el.localName ?? "";
  if (ENTITY_NAMES.has(name)) return name;
  if (name !== "name" && name !== "rs") return null;
  const kind = ENTITY_BY_KIND[getAttr(el, "type") ?? ""];
  if (kind) return kind;
  const ref = /^#(\S+)/.exec(getAttr(el, "ref") ?? "")?.[1];
  const referenced = ref ? ids.get(ref) : undefined;
  return referenced ? (ENTITY_BY_KIND[referenced.localName ?? ""] ?? null) : null;
}

/** The header's title, else the element's text, else the names of up to four inner elements. */
export function summaryOf(doc: TeiDocument, el: TeiNode): string {
  const clip = (s: string) => (s.length > 160 ? `${s.slice(0, 159)}…` : s);
  const textIn = (n: TeiNode) => textNodes(n).map((t) => textOf(doc, t)).join(" ").replace(/\s+/g, " ").trim();
  if (el.localName === "teiHeader") {
    const stmt = firstByLocal(el, "titleStmt");
    const title = stmt && firstByLocal(stmt, "title");
    if (title) return clip(textIn(title));
  }
  const text = textIn(el);
  if (text) return clip(text);
  const names = new Set<string>();
  walk(el, (n: TeiNode) => { if (n !== el && n.type === "element" && names.size < 4) names.add(n.qname ?? ""); });
  return [...names].join(", ") || "empty";
}
