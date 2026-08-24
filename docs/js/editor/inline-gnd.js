/**
 * teiCrafter Editor -- inline-GND interchange profile (DOM-free, lossless reading text).
 *
 * The editor's working model keeps entities in a <standOff> register and links
 * each in-text mention as <name ref="#id">...</name>, with the authority id on the
 * entity as <idno type="GND">value</idno> (see standoff.js). The ZBZ Hersch
 * interchange format (zbz_hersch.rng) instead carries the authority INLINE at the
 * mention site and has no register:
 *   <persName ref="GND:..">Name</persName>
 *   <orgName  ref="GND:..">Org</orgName>
 *   <bibl     ref="GND:..">Work</bibl>
 * Places and events are outside the reference encoding, and there is no <standOff>.
 *
 * toInlineGND(doc) rewrites a register-model document into that shape:
 *   - a person/org/work mention becomes the typed inline element, @ref="GND:<value>"
 *     when the entity carries a GND, otherwise the typed element with no @ref;
 *   - a capability pass blocks export before mutation when standOff data cannot be
 *     represented, including places, events, notes, missing pointers, and extensions;
 *   - the fully represented <standOff> register is removed.
 * Every step is an offset splice over the raw string, so the reading text round-trips
 * byte-for-byte; only the markup shape changes. A <name> without a '#'-ref (e.g. the
 * <name> inside a respStmt) is left untouched.
 *
 * This is an export profile, not a second editing model: the editor keeps editing in
 * the register model (index, confirm/reject, authority lookup all read the register);
 * the inline-GND document is the artifact handed to the ZBZ pipeline.
 *
 * fromInlineGND(doc) is the inverse: it reads an inline-GND document back into the
 * register model so a handed-back object can be edited further. Each inline
 * <persName>/<orgName>/<bibl> in the reading text becomes a <standOff> entity
 * (deduplicated by GND, else by text), carrying <idno type="GND"> when a
 * ref="GND:.." was present, and the mention is rewrapped as <name ref="#id">. Reading
 * text is again preserved byte-for-byte. A capability pass rejects unsupported
 * mention attributes or content before the first splice. The interchange file is
 * a fixed point: toInlineGND(fromInlineGND(file)) === file, byte-for-byte.
 */

import {
  walk,
  getUnqualifiedAttr as getAttr,
  getXmlId,
  teiElementsByLocal as elementsByLocal,
  isTeiElement,
  XML_NAMESPACE,
  textNodes,
  textOf,
  spliceDocument,
  escapeAttr,
  readingRoot,
  isReadingContext,
} from "./tei-document.js";
import {
  readEntities,
  addEntity,
  setAuthority,
  slugify,
  uniquify,
  collectIds,
} from "./standoff.js";

// Entity type -> the inline element that carries it in the ZBZ format. Types absent
// here (place, event) are outside the GND annotation scope and unwrap to text.
const INLINE_ELEMENT = Object.freeze({
  person: "persName",
  org: "orgName",
  work: "bibl",
});

/** Entity types the inline-GND interchange can represent. */
export const INLINE_GND_ENTITY_TYPES = Object.freeze(Object.keys(INLINE_ELEMENT));

// The value after "GND:". The schema attribute pattern is GND:[0-9A-Za-z\-]+, so a
// stored idno value must match this to be emitted as a @ref; otherwise the element
// is written typed but without an authority pointer rather than an invalid one.
const GND_VALUE = /^[0-9A-Za-z-]+$/;

// These attributes describe the individual matcher decision, so they belong on
// the mention while the inline element is lifted into the register model. Keep
// their raw spelling to make a no-edit interchange round-trip byte-identical.
const MENTION_PROVENANCE = new Set(["source", "cert", "resp"]);
const SUPPORTED_MENTION_ATTRS = new Set(["ref", ...MENTION_PROVENANCE]);

/** Raw mention-provenance attributes, in their source order. */
function mentionProvenanceAttrs(doc, el) {
  return (el.attrs || [])
    .filter((a) => a.namespaceURI == null && MENTION_PROVENANCE.has(a.localName))
    .map((a) => " " + doc.raw.slice(a.start, a.end))
    .join("");
}

/**
 * Map every standOff entity id to { kind, gnd }. kind is the type key (person, org,
 * work, place, event); gnd is the first GND idno value, or null.
 */
function entityIndex(doc) {
  const ents = readEntities(doc);
  const byId = new Map();
  const add = (kind, list) => {
    for (const e of list) {
      const g = (e.authorities.find((a) => a.type === "GND") || {}).value || null;
      byId.set(e.id, { kind, gnd: g });
    }
  };
  add("person", ents.persons);
  add("org", ents.orgs);
  add("work", ents.works);
  add("place", ents.places);
  add("event", ents.events);
  return byId;
}

/** The parsed TEI document element, or the first document element as fallback. */
function documentElement(doc) {
  const elements = (doc.root.children || []).filter((child) => child.type === "element");
  return elements.find((child) => isTeiElement(child, "TEI")) || null;
}

/** Direct element children matching a local name. */
function directChildren(el, localName) {
  if (!el) return [];
  return (el.children || []).filter(
    (child) => isTeiElement(child, localName),
  );
}

/** The one TEI-level standOff the editor register owns. */
function topLevelStandOff(doc) {
  return directChildren(documentElement(doc), "standOff")[0] || null;
}

/** Preserve an element's namespace prefix while changing its local name. */
function qualifiedLike(el, localName) {
  return el?.prefix ? `${el.prefix}:${localName}` : localName;
}

/** True for indentation-only text nodes. */
function ignorableText(doc, node) {
  return node.type === "text" && !doc.raw.slice(node.start, node.end).trim();
}

/** Add one structured capability issue. */
function addIssue(issues, code, message, context = {}) {
  issues.push({ code, message, ...context });
}

/** Direct element children other than the accepted local names. */
function unexpectedChildren(doc, parent, accepted, issues, context = {}) {
  for (const child of parent.children || []) {
    if (ignorableText(doc, child)) continue;
    if (isTeiElement(child) && accepted.has(child.localName)) continue;
    const code = isTeiElement(child, "note")
      ? "unsupported-note"
      : "unsupported-standoff-content";
    addIssue(
      issues,
      code,
      `The inline-GND target cannot represent <${child.qname || child.type}> inside <${parent.qname}>.`,
      context,
    );
  }
}

/** All reading-text hash mentions, plus non-reading hash pointers as issues. */
function mentionIndex(doc, issues) {
  const byId = new Map();
  walk(doc.root, (node) => {
    if (!isTeiElement(node, "name")) return;
    const ref = getAttr(node, "ref");
    if (!ref || ref.charAt(0) !== "#") return;
    const id = ref.slice(1);
    if (!isReadingContext(node)) {
      addIssue(issues, "non-reading-mention", `The pointer ${ref} is outside the reading text and cannot be projected inline.`, { entityId: id });
      return;
    }
    const unsupportedAttrs = (node.attrs || []).filter(
      (attr) => attr.namespaceURI != null || !SUPPORTED_MENTION_ATTRS.has(attr.localName),
    );
    if (unsupportedAttrs.length) {
      addIssue(
        issues,
        "unsupported-mention-attributes",
        `Mention ${ref} carries attributes the inline-GND target cannot preserve.`,
        { entityId: id, attributes: unsupportedAttrs.map((attr) => attr.name) },
      );
    }
    const values = byId.get(id) || [];
    values.push(node);
    byId.set(id, values);
  });
  return byId;
}

const REGISTER_LISTS = Object.freeze({
  listPerson: { kind: "person", entity: "person", name: "persName" },
  listOrg: { kind: "org", entity: "org", name: "orgName" },
  listBibl: { kind: "work", entity: "bibl", name: "title" },
  listPlace: { kind: "place", entity: "place", name: "placeName" },
  listEvent: { kind: "event", entity: "event", name: "label" },
});

/** Inspect one register entity for bytes that the target would discard. */
function inspectEntity(doc, el, desc, mentions, issues, seenIds) {
  const id = getXmlId(el);
  if (!id) {
    addIssue(issues, "entity-without-id", `<${el.qname}> has no xml:id and cannot be linked inline.`, { entityType: desc.kind });
    return;
  }
  if (seenIds.has(id)) {
    addIssue(issues, "duplicate-entity-id", `The register contains duplicate xml:id ${id}.`, { entityId: id, entityType: desc.kind });
  }
  seenIds.add(id);

  const linked = mentions.get(id) || [];
  if (!INLINE_ELEMENT[desc.kind]) {
    addIssue(
      issues,
      "unsupported-entity-type",
      `The inline-GND target cannot represent ${desc.kind} entity ${id}.`,
      { entityId: id, entityType: desc.kind, mentionCount: linked.length },
    );
    return;
  }
  if (!linked.length) {
    addIssue(issues, "unrepresented-entity", `Entity ${id} has no reading-text mention and would be lost.`, { entityId: id, entityType: desc.kind });
  }

  const unsupportedAttrs = (el.attrs || []).filter(
    (attr) => !(attr.namespaceURI === XML_NAMESPACE && attr.localName === "id"),
  );
  if (unsupportedAttrs.length) {
    addIssue(
      issues,
      "unsupported-entity-attributes",
      `Entity ${id} carries attributes the inline-GND target cannot preserve.`,
      { entityId: id, entityType: desc.kind, attributes: unsupportedAttrs.map((attr) => attr.name) },
    );
  }

  unexpectedChildren(doc, el, new Set([desc.name, "idno"]), issues, { entityId: id, entityType: desc.kind });
  const names = directChildren(el, desc.name);
  if (names.length !== 1) {
    addIssue(issues, "unsupported-entity-name", `Entity ${id} must have exactly one plain <${desc.name}> label.`, { entityId: id, entityType: desc.kind });
  } else {
    const name = names[0];
    if ((name.attrs || []).length || (name.children || []).some((child) => child.type !== "text")) {
      addIssue(issues, "unsupported-entity-name", `Entity ${id} has structured label data the inline-GND target cannot preserve.`, { entityId: id, entityType: desc.kind });
    }
    const label = textNodes(name).map((node) => textOf(doc, node)).join("").trim();
    const represented = linked.some(
      (mention) => textNodes(mention).map((node) => textOf(doc, node)).join("").trim() === label,
    );
    if (linked.length && !represented) {
      addIssue(issues, "unrepresented-entity-label", `Entity label for ${id} differs from every inline mention and would be lost.`, { entityId: id, entityType: desc.kind });
    }
  }

  const idnos = directChildren(el, "idno");
  if (idnos.length > 1) {
    addIssue(issues, "unsupported-authority", `Entity ${id} carries multiple authority values.`, { entityId: id, entityType: desc.kind });
  }
  for (const idno of idnos) {
    const type = getAttr(idno, "type") || "";
    const value = textNodes(idno).map((node) => textOf(doc, node)).join("").trim();
    const extraAttrs = (idno.attrs || []).filter(
      (attr) => attr.namespaceURI != null || attr.localName !== "type",
    );
    const structured = (idno.children || []).some((child) => child.type !== "text");
    if (type !== "GND" || !GND_VALUE.test(value) || extraAttrs.length || structured) {
      addIssue(
        issues,
        "unsupported-authority",
        `Authority data on entity ${id} cannot be represented as an inline GND pointer.`,
        { entityId: id, entityType: desc.kind, authority: type || null },
      );
    }
  }
}

/**
 * Report whether a register document can be projected to inline-GND without loss.
 * Consumers may show the issues before export; toInlineGND enforces the same report.
 */
export function inlineGndCapabilityReport(doc) {
  const issues = [];
  const mentions = mentionIndex(doc, issues);
  const standOff = topLevelStandOff(doc);
  const allStandOff = elementsByLocal(doc.root, "standOff");
  if (allStandOff.some((element) => element !== standOff)) {
    addIssue(issues, "additional-standoff", "The document contains a standOff outside the TEI-level interchange register.");
  }

  const registered = new Map();
  if (standOff) {
    if ((standOff.attrs || []).length) {
      addIssue(issues, "unsupported-standoff-attributes", "The inline-GND target cannot preserve attributes on standOff.");
    }
    unexpectedChildren(doc, standOff, new Set(Object.keys(REGISTER_LISTS)), issues);
    const seenIds = new Set();
    for (const [listName, desc] of Object.entries(REGISTER_LISTS)) {
      for (const list of directChildren(standOff, listName)) {
        if ((list.attrs || []).length) {
          addIssue(issues, "unsupported-standoff-content", `<${list.qname}> attributes would be lost.`, { entityType: desc.kind });
        }
        unexpectedChildren(doc, list, new Set([desc.entity]), issues, { entityType: desc.kind });
        for (const entity of directChildren(list, desc.entity)) {
          const id = getXmlId(entity);
          if (id) registered.set(id, desc.kind);
          inspectEntity(doc, entity, desc, mentions, issues, seenIds);
        }
      }
    }
  }

  for (const [id, values] of mentions) {
    if (!registered.has(id)) {
      addIssue(issues, "missing-entity", `Mention #${id} has no entity in the TEI-level standOff register.`, { entityId: id, mentionCount: values.length });
    } else if (!INLINE_ELEMENT[registered.get(id)]) {
      // The entity issue describes the loss; keep this pointer-level cause explicit.
      addIssue(issues, "unsupported-mention-type", `Mention #${id} points to a non-exportable ${registered.get(id)} entity.`, { entityId: id, entityType: registered.get(id), mentionCount: values.length });
    }
  }

  return Object.freeze({
    ok: issues.length === 0,
    profile: "inline-gnd",
    supportedEntityTypes: INLINE_GND_ENTITY_TYPES,
    counts: Object.freeze({ entities: registered.size, mentions: [...mentions.values()].reduce((sum, values) => sum + values.length, 0) }),
    issues: Object.freeze(issues),
  });
}

/** Error raised when inline-GND projection would discard editorial data. */
export class InlineGndCapabilityError extends Error {
  constructor(report) {
    super(`Inline-GND export blocked: ${report.issues.map((issue) => issue.message).join(" ")}`);
    this.name = "InlineGndCapabilityError";
    this.report = report;
  }
}

/** The first <name> mention carrying a '#'-ref, in document order, or null. */
function firstHashMention(doc) {
  let hit = null;
  walk(doc.root, (n) => {
    if (hit) return false;
    if (isTeiElement(n, "name") && isReadingContext(n)) {
      const ref = getAttr(n, "ref");
      if (ref && ref.charAt(0) === "#") {
        hit = n;
        return false;
      }
    }
  });
  return hit;
}

/**
 * Rewrite one <name> mention: to a typed inline element when its entity is a
 * person/org/work, otherwise unwrap to its reading text. Returns a NEW doc.
 */
function rewriteMention(doc, el, byId) {
  const inner = doc.raw.slice(el.contentStart, el.contentEnd);
  const id = (getAttr(el, "ref") || "").replace(/^#/, "");
  const info = byId.get(id);
  const localName = INLINE_ELEMENT[info.kind];
  const elName = qualifiedLike(el, localName);
  const gnd = info.gnd && GND_VALUE.test(info.gnd) ? info.gnd : null;
  const attr = gnd ? ' ref="GND:' + escapeAttr(gnd) + '"' : "";
  const provenance = mentionProvenanceAttrs(doc, el);
  const repl = "<" + elName + attr + provenance + ">" + inner + "</" + elName + ">";
  return spliceDocument(doc, el.outerStart, el.outerEnd, repl);
}

/** Remove the TEI-level <standOff> block, with the indentation line it sits on. */
function dropStandOff(doc) {
  const so = topLevelStandOff(doc);
  if (!so || so.outerStart == null || so.outerEnd == null) return doc;
  let start = so.outerStart;
  while (start > 0 && (doc.raw[start - 1] === " " || doc.raw[start - 1] === "\t")) start--;
  if (start > 0 && doc.raw[start - 1] === "\n") {
    start--;
    if (start > 0 && doc.raw[start - 1] === "\r") start--;
  }
  return spliceDocument(doc, start, so.outerEnd, "");
}

/**
 * Transform a register-model document into the inline-GND ZBZ interchange shape.
 * Reading text is preserved byte-for-byte; only markup changes. Returns a NEW doc
 * (or the SAME doc when there is nothing to rewrite and no standOff to remove).
 */
export function toInlineGND(doc) {
  const report = inlineGndCapabilityReport(doc);
  if (!report.ok) throw new InlineGndCapabilityError(report);
  const byId = entityIndex(doc);
  for (;;) {
    const m = firstHashMention(doc);
    if (!m) break;
    doc = rewriteMention(doc, m, byId);
  }
  return dropStandOff(doc);
}

/**
 * The interchange filename for a working document: its base name carrying the
 * "_final.xml" suffix the ZBZ pipeline uses for a finished object. Idempotent
 * when the name already ends in "_final":
 *   "zbz-hersch-100.xml" -> "zbz-hersch-100_final.xml"
 *   "x_final.xml"        -> "x_final.xml"
 */
export function inlineGndFilename(docName) {
  const base = (docName || "edition").replace(/\.xml$/i, "");
  return (/_final$/.test(base) ? base : base + "_final") + ".xml";
}

// ---- import (the inverse: inline-GND -> register model) --------------------

// Inline element -> register type key, and the type key -> generated-id prefix
// (mirrors standoff.js ID_PREFIX, which is module-private there).
const INLINE_KIND = Object.freeze({ persName: "person", orgName: "org", bibl: "work" });
const KIND_PREFIX = Object.freeze({ person: "pers", org: "org", work: "wrk" });

// A @ref carrying an authority pointer in the interchange shape: GND:<value>.
const GND_REF = /^GND:([0-9A-Za-z-]+)$/;

/** Inline mentions in reading order. */
function inlineMentions(doc) {
  const mentions = [];
  walk(readingRoot(doc), (node) => {
    if (isTeiElement(node) && INLINE_KIND[node.localName] && isReadingContext(node)) {
      mentions.push(node);
    }
  });
  return mentions;
}

/**
 * Report whether inline mentions can enter the register model and return without
 * losing source attributes, namespace bindings, or structured content.
 */
export function inlineGndImportCapabilityReport(doc) {
  const issues = [];
  const mentions = inlineMentions(doc);
  for (const mention of mentions) {
    const unsupportedAttrs = (mention.attrs || []).filter(
      (attr) => attr.namespaceURI != null || !SUPPORTED_MENTION_ATTRS.has(attr.localName),
    );
    if (unsupportedAttrs.length) {
      addIssue(
        issues,
        "unsupported-inline-attributes",
        `<${mention.qname}> carries attributes the register round-trip cannot preserve.`,
        { element: mention.qname, attributes: unsupportedAttrs.map((attr) => attr.name) },
      );
    }

    const ref = getAttr(mention, "ref");
    const gndMatch = ref == null ? null : GND_REF.exec(ref);
    if (ref != null && !gndMatch) {
      addIssue(
        issues,
        "unsupported-inline-ref",
        `<${mention.qname}> carries a non-GND @ref that the register model cannot preserve.`,
        { element: mention.qname, ref },
      );
    }

    if (!unsupportedAttrs.length && (ref == null || gndMatch)) {
      const refAttr = gndMatch ? ` ref="GND:${gndMatch[1]}"` : "";
      const expectedStart = `<${mention.qname}${refAttr}${mentionProvenanceAttrs(doc, mention)}>`;
      const actualStart = doc.raw.slice(mention.stagStart, mention.stagEnd);
      const expectedEnd = `</${mention.qname}>`;
      const actualEnd = mention.etagStart == null || mention.outerEnd == null
        ? ""
        : doc.raw.slice(mention.etagStart, mention.outerEnd);
      if (actualStart !== expectedStart || actualEnd !== expectedEnd) {
        addIssue(
          issues,
          "unsupported-inline-syntax",
          `<${mention.qname}> uses attribute or tag syntax the register round-trip would rewrite.`,
          { element: mention.qname },
        );
      }
    }

    if (mention.contentStart == null || mention.contentEnd == null
      || (mention.children || []).some((child) => child.type !== "text")) {
      addIssue(
        issues,
        "unsupported-inline-content",
        `<${mention.qname}> carries content the register round-trip cannot preserve byte-for-byte.`,
        { element: mention.qname },
      );
    }
  }

  return Object.freeze({
    ok: issues.length === 0,
    profile: "inline-gnd-import",
    counts: Object.freeze({ mentions: mentions.length }),
    issues: Object.freeze(issues),
  });
}

/** Error raised before an unsafe inline-GND document enters the working model. */
export class InlineGndImportCapabilityError extends Error {
  constructor(report) {
    super(`Inline-GND import blocked: ${report.issues.map((issue) => issue.message).join(" ")}`);
    this.name = "InlineGndImportCapabilityError";
    this.report = report;
  }
}

/** kind, GND (or null) and reading text of one inline mention element. */
function mentionInfo(doc, el) {
  const m = GND_REF.exec(getAttr(el, "ref") || "");
  return {
    kind: INLINE_KIND[el.localName],
    gnd: m ? m[1] : null,
    name: textNodes(el).map((t) => textOf(doc, t)).join("").trim(),
  };
}

// One register entity per distinct authority, else per distinct text within a kind.
function mentionKey(info) {
  return info.gnd ? info.kind + "#GND:" + info.gnd : info.kind + "#t:" + info.name;
}

/** The first inline person/org/work mention in the reading text, or null. */
function firstInlineMention(doc) {
  return inlineMentions(doc)[0] || null;
}

/**
 * Read an inline-GND interchange document back into the register model. Returns a
 * NEW doc, or the SAME doc when there is no inline mention to lift (so a register-
 * model document, whose mentions are already <name>, is a no-op and the import is
 * idempotent). Unsafe mention data throws before any splice. Reading text is
 * byte-preserved; only markup changes.
 */
export function fromInlineGND(doc) {
  const report = inlineGndImportCapabilityReport(doc);
  if (!report.counts.mentions) return doc;
  if (!report.ok) throw new InlineGndImportCapabilityError(report);

  // 1. Plan the register: one entity per distinct (kind, GND|text), id pre-minted
  //    and uniquified against existing ids so the later addEntity keeps it verbatim.
  const taken = collectIds(doc);
  const plan = new Map(); // key -> { id, kind, gnd, name }
  walk(readingRoot(doc), (n) => {
    if (!isTeiElement(n) || !INLINE_KIND[n.localName] || !isReadingContext(n)) return;
    const info = mentionInfo(doc, n);
    const key = mentionKey(info);
    if (plan.has(key)) return;
    const id = uniquify(KIND_PREFIX[info.kind] + "_" + (slugify(info.name) || "1"), taken);
    taken.add(id);
    plan.set(key, { id, kind: info.kind, gnd: info.gnd, name: info.name });
  });

  // 2. Rewrite each inline mention to <name ref="#id">, inner reading text verbatim.
  for (;;) {
    const m = firstInlineMention(doc);
    if (!m) break;
    const id = plan.get(mentionKey(mentionInfo(doc, m))).id;
    const inner = doc.raw.slice(m.contentStart, m.contentEnd);
    const provenance = mentionProvenanceAttrs(doc, m);
    doc = spliceDocument(doc, m.outerStart, m.outerEnd,
      "<" + qualifiedLike(m, "name") + ' ref="#' + escapeAttr(id) + '"' + provenance + ">" + inner + "</" + qualifiedLike(m, "name") + ">");
  }

  // 3. Build the standOff register from the plan, in person/org/work order.
  const order = ["person", "org", "work"];
  const entries = [...plan.values()].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  for (const e of entries) {
    doc = addEntity(doc, e.kind, { id: e.id, name: e.name });
    if (e.gnd) doc = setAuthority(doc, e.id, "GND", e.gnd);
  }
  return doc;
}
