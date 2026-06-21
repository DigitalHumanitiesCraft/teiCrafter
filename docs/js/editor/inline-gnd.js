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
 */

import {
  walk,
  getAttr,
  firstByLocal,
  textNodes,
  textOf,
  spliceDocument,
  escapeAttr,
} from "./tei-document.js";
import { readEntities } from "./standoff.js";

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
