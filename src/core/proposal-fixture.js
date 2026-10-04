/**
 * Deterministic demonstration producer of proposals. It stands in for a model
 * so the proposal interaction can be shown without one: a person listed in
 * listPerson whose name occurs in the body unencoded, or encoded as a generic
 * <name> pointing to that person, is proposed as persName.
 */
import { walk } from "./tei-document.js";

/** @typedef {import("./tei-document.js").TeiDocument} TeiDocument */
/** @typedef {import("./tei-document.js").TeiNode} TeiNode */
/** @typedef {import("./proposal.js").Proposal} Proposal */

export const FIXTURE_ORIGIN = "demo fixture";

/**
 * The first proposal in document order, or null.
 * @param {TeiDocument} doc
 * @returns {Proposal | null}
 */
export function findProposal(doc) {
  const { raw, root } = doc;
  /** @type {TeiNode[]} */
  const all = [];
  walk(root, (n) => { if (n.type === "element") all.push(n); });
  /** @param {TeiNode} n @param {string} name */
  const within = (n, name) => { for (let p = n.parent; p; p = p.parent) if (p.localName === name) return true; return false; };
  /** @type {Map<string, string>} */
  const persons = new Map();
  for (const person of all) {
    if (person.localName !== "person" || !within(person, "listPerson")) continue;
    const id = person.attrs?.find((a) => a.localName === "id" && a.prefix === "xml")?.value;
    const pn = person.children?.find((c) => c.localName === "persName");
    const text = pn?.contentStart != null && pn.contentEnd != null ? raw.slice(pn.contentStart, pn.contentEnd).trim() : "";
    if (id && text && !text.includes("<")) persons.set(id, text);
  }
  const body = all.find((e) => e.localName === "body" && within(e, "text"));
  if (!body || persons.size === 0) return null;
  const NAMING = new Set(["name", "persName", "rs", "ref"]);
  const letter = /\p{L}/u;
  /** @param {TeiNode} node @returns {Proposal | null} */
  const visit = (node) => {
    for (const c of node.children ?? []) {
      if (c.type === "element") {
        const ref = c.attrs?.find((a) => a.localName === "ref" && a.prefix === null)?.value ?? "";
        const id = ref.startsWith("#") ? ref.slice(1) : "";
        if (c.localName === "name" && c.prefix === null && persons.has(id) && c.etagEnd != null && c.contentStart != null && c.contentEnd != null) {
          return {
            from: c.outerStart ?? 0,
            to: c.etagEnd,
            replacement: `<persName${raw.slice((c.stagStart ?? 0) + 1 + "name".length, c.stagEnd)}${raw.slice(c.contentStart, c.contentEnd)}</persName>`,
            rationale: `ref="#${id}" points to a person in listPerson, so the generic name element is proposed as persName.`,
            origin: FIXTURE_ORIGIN,
          };
        }
        if (!NAMING.has(c.localName ?? "")) { const hit = visit(c); if (hit) return hit; }
      } else if (c.type === "text" && c.start != null && c.end != null) {
        const text = raw.slice(c.start, c.end);
        /** @type {{ at: number, id: string, name: string } | null} */
        let best = null;
        for (const [id, name] of persons) {
          const at = text.indexOf(name);
          if (at < 0 || letter.test(text[at - 1] ?? "") || letter.test(text[at + name.length] ?? "")) continue;
          if (!best || at < best.at) best = { at, id, name };
        }
        if (best) {
          return {
            from: c.start + best.at,
            to: c.start + best.at + best.name.length,
            replacement: `<persName ref="#${best.id}">${best.name}</persName>`,
            rationale: `"${best.name}" is the persName of ${best.id} in listPerson and is not yet encoded here.`,
            origin: FIXTURE_ORIGIN,
          };
        }
      }
    }
    return null;
  };
  return visit(body);
}
