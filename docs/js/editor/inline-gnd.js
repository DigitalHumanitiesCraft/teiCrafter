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
 * Places are not annotated (the reference encoding carries no placeName), and there
 * is no <standOff>.
 *
 * toInlineGND(doc) rewrites a register-model document into that shape:
 *   - a person/org/work mention becomes the typed inline element, @ref="GND:<value>"
 *     when the entity carries a GND, otherwise the typed element with no @ref;
 *   - a place/event mention, a mention to a missing entity, and a <name> with a
 *     non-'#' ref unwrap to plain reading text;
 *   - the <standOff> register is removed.
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
 * text is again preserved byte-for-byte. Places are not recovered (the format does not
 * annotate them), so the interchange file is a fixed point of the round-trip:
 * toInlineGND(fromInlineGND(file)) === file, byte-for-byte.
 */

import {
  walk,
  getAttr,
  firstByLocal,
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

// The value after "GND:". The schema attribute pattern is GND:[0-9A-Za-z\-]+, so a
// stored idno value must match this to be emitted as a @ref; otherwise the element
// is written typed but without an authority pointer rather than an invalid one.
const GND_VALUE = /^[0-9A-Za-z-]+$/;

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

/** The first <name> mention carrying a '#'-ref, in document order, or null. */
function firstHashMention(doc) {
  let hit = null;
  walk(doc.root, (n) => {
    if (hit) return false;
    if (n.type === "element" && n.localName === "name") {
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
  const elName = info ? INLINE_ELEMENT[info.kind] : null;
  if (!elName) {
    // place/event, missing entity, or untyped: drop the wrapper, keep the text.
    return spliceDocument(doc, el.outerStart, el.outerEnd, inner);
  }
  const gnd = info.gnd && GND_VALUE.test(info.gnd) ? info.gnd : null;
  const attr = gnd ? ' ref="GND:' + escapeAttr(gnd) + '"' : "";
  const repl = "<" + elName + attr + ">" + inner + "</" + elName + ">";
  return spliceDocument(doc, el.outerStart, el.outerEnd, repl);
}

/** Remove every <standOff> block, with the indentation line it sits on. */
function dropStandOff(doc) {
  for (;;) {
    const so = firstByLocal(doc.root, "standOff");
    if (!so || so.outerStart == null || so.outerEnd == null) return doc;
    let start = so.outerStart;
    while (start > 0 && (doc.raw[start - 1] === " " || doc.raw[start - 1] === "\t")) start--;
    if (start > 0 && doc.raw[start - 1] === "\n") {
      start--;
      if (start > 0 && doc.raw[start - 1] === "\r") start--;
    }
    doc = spliceDocument(doc, start, so.outerEnd, "");
  }
}

/**
 * Transform a register-model document into the inline-GND ZBZ interchange shape.
 * Reading text is preserved byte-for-byte; only markup changes. Returns a NEW doc
 * (or the SAME doc when there is nothing to rewrite and no standOff to remove).
 */
export function toInlineGND(doc) {
  const byId = entityIndex(doc);
  for (;;) {
    const m = firstHashMention(doc);
    if (!m) break;
    doc = rewriteMention(doc, m, byId);
  }
  return dropStandOff(doc);
}

// ---- import (the inverse: inline-GND -> register model) --------------------

// Inline element -> register type key, and the type key -> generated-id prefix
// (mirrors standoff.js ID_PREFIX, which is module-private there).
const INLINE_KIND = Object.freeze({ persName: "person", orgName: "org", bibl: "work" });
const KIND_PREFIX = Object.freeze({ person: "pers", org: "org", work: "wrk" });

// A @ref carrying an authority pointer in the interchange shape: GND:<value>.
const GND_REF = /^GND:([0-9A-Za-z-]+)$/;

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
  const root = readingRoot(doc);
  let hit = null;
  walk(root, (n) => {
    if (hit) return false;
    if (n.type === "element" && INLINE_KIND[n.localName] && isReadingContext(n)) {
      hit = n;
      return false;
    }
  });
  return hit;
}

/**
 * Read an inline-GND interchange document back into the register model. Returns a
 * NEW doc, or the SAME doc when there is no inline mention to lift (so a register-
 * model document, whose mentions are already <name>, is a no-op and the import is
 * idempotent). Reading text is byte-preserved; only markup changes.
 */
export function fromInlineGND(doc) {
  if (!firstInlineMention(doc)) return doc;

  // 1. Plan the register: one entity per distinct (kind, GND|text), id pre-minted
  //    and uniquified against existing ids so the later addEntity keeps it verbatim.
  const taken = collectIds(doc);
  const plan = new Map(); // key -> { id, kind, gnd, name }
  walk(readingRoot(doc), (n) => {
    if (n.type !== "element" || !INLINE_KIND[n.localName] || !isReadingContext(n)) return;
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
    doc = spliceDocument(doc, m.outerStart, m.outerEnd,
      '<name ref="#' + escapeAttr(id) + '">' + inner + "</name>");
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
