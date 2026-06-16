/**
 * teiCrafter Editor -- StandOff / entity index model (DOM-free, lossless).
 *
 * A schema-light layer over the generic core: it reads and edits TEI standOff
 * entities (person, place, org, event, work) and the in-text mentions that link to
 * them. It imports only from ./tei-document.js and ./edition.js so it runs in
 * the browser (editor-app.js) and in Node (headless proofs) with identical logic.
 *
 * The raw string stays canonical. Every mutation is an offset splice via
 * spliceDocument, which returns a NEW re-parsed doc; a no-op returns the SAME doc,
 * so a load -> serialize round-trip is byte-identical by construction.
 *
 * Shared entity shape (the seeded example and this module agree on it exactly):
 *   <standOff>
 *     <listPerson><person xml:id="..."><persName>Name</persName></person></listPerson>
 *     <listPlace><place xml:id="..."><placeName>Name</placeName></place></listPlace>
 *     <listOrg><org xml:id="..."><orgName>Name</orgName></org></listOrg>
 *     <listEvent><event xml:id="..."><label>Label</label></event></listEvent>
 *     <listBibl><bibl xml:id="..."><title>Title</title></bibl></listBibl>
 *   </standOff>
 * Authority identifiers (GND / GeoNames / Wikidata) attach to any entity as
 * <idno type="GND">value</idno> children; @ref stays reserved for the mention
 * pointer. An in-text mention links by wrapping it in <name ref="#id">...</name>.
 */

import {
  walk,
  getAttr,
  getAttrObj,
  elementsByLocal,
  firstByLocal,
  textNodes,
  textOf,
  spliceDocument,
  editAttrValue,
  removeAttr,
  escapeText,
  escapeAttr,
  ancestorWithXmlId,
} from "./tei-document.js";
import { parseEdition } from "./edition.js";

// Responsibility pointer marking an AI-proposed, human-unverified entity. The
// editor renders these violet (per design.md) until a human confirms (drops the
// marker) or rejects (deletes the entity). It is a TEI @resp value, so it stays
// schema-valid and round-trips losslessly.
export const AI_RESP = "#ai";

// Map an entity type to its list element, entity element, and name element.
const TYPE_MAP = Object.freeze({
  person: { list: "listPerson", entity: "person", name: "persName" },
  place: { list: "listPlace", entity: "place", name: "placeName" },
  org: { list: "listOrg", entity: "org", name: "orgName" },
  event: { list: "listEvent", entity: "event", name: "label" },
  work: { list: "listBibl", entity: "bibl", name: "title" },
});

// Reverse lookup: entity local-name -> type key.
const ENTITY_TO_TYPE = Object.freeze({
  person: "person",
  place: "place",
  org: "org",
  event: "event",
  bibl: "work",
});

const ID_PREFIX = Object.freeze({ person: "pers", place: "plc", org: "org", event: "evt", work: "wrk" });

// The authority registers an entity's <idno type="..."> may name, in UI order.
export const AUTHORITIES = Object.freeze(["GND", "GeoNames", "Wikidata"]);

// ---- id helpers ------------------------------------------------------------

/**
 * Turn an arbitrary string into an NCName-safe id fragment.
 * NCName: starts with a letter or underscore, then letters, digits, '-', '_', '.'.
 * Returns a lowercased ASCII slug; empty input yields "".
 */
export function slugify(s) {
  let out = String(s == null ? "" : s)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining marks
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "_") // collapse non-NCName runs to underscore
    .replace(/[._-]{2,}/g, "_") // collapse mixed/repeated separator runs (e.g. "victorg._5") to one underscore
    .replace(/^[._-]+/, "") // a leading '.', '-' is not a valid NCName start
    .replace(/[._-]+$/, "");
  // An NCName may not start with a digit; prefix an underscore if it would.
  if (out && /^[0-9]/.test(out)) out = "_" + out;
  return out;
}

/** Collect every xml:id present in the document. */
export function collectIds(doc) {
  const ids = new Set();
  walk(doc.root, (n) => {
    if (n.type === "element") {
      const id = getAttr(n, "id");
      if (id) ids.add(id);
    }
  });
  return ids;
}

/** Make an id unique against an existing set by appending _2, _3, ... if needed. */
export function uniquify(base, taken) {
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(base + "_" + i)) i++;
  return base + "_" + i;
}

// ---- read ------------------------------------------------------------------

/** Decoded text of the first descendant element with the given local-name. */
function firstChildText(doc, el, localName) {
  const hit = firstByLocal(el, localName);
  if (!hit) return null;
  return textNodes(hit).map((t) => textOf(doc, t)).join("").trim() || null;
}

/** All decoded text directly inside an element (descendant text nodes joined). */
function allText(doc, el) {
  return textNodes(el).map((t) => textOf(doc, t)).join("").trim();
}

/**
 * The authority identifiers carried by an entity as <idno type="...">value</idno>
 * children. Returns [{ type, value }] in document order; type "" when @type absent.
 */
function readAuthorities(doc, el) {
  return elementsByLocal(el, "idno").map((idno) => ({
    type: getAttr(idno, "type") || "",
    value: allText(doc, idno),
  }));
}

function readOne(doc, el, type) {
  const desc = TYPE_MAP[type];
  const id = getAttr(el, "id");
  const name = firstChildText(doc, el, desc.name) || allText(doc, el) || "";
  const ai = getAttr(el, "resp") === AI_RESP;
  return { id, type, name, node: el, ai, authorities: readAuthorities(doc, el) };
}

/**
 * Works live as <bibl> inside <listBibl> inside <standOff>. <bibl> is also a common
 * bibliographic element in the teiHeader (sourceDesc), so works are read scoped to
 * standOff/listBibl rather than document-wide, to avoid pulling in header citations.
 */
function readWorks(doc) {
  const standOff = firstByLocal(doc.root, "standOff");
  if (!standOff) return [];
  const out = [];
  for (const list of elementsByLocal(standOff, "listBibl")) {
    for (const el of elementsByLocal(list, "bibl")) out.push(readOne(doc, el, "work"));
  }
  return out;
}

/**
 * Read every standOff entity in the document.
 * Scans <person>/<place>/<org>/<event> anywhere (standOff preferred but not required);
 * <bibl> works are scoped to standOff/listBibl (see readWorks). Each entity is
 * E = { id, type, name, node, authorities }; name from persName/placeName/orgName/
 * label/title else first text; authorities from <idno type="..."> children.
 */
export function readEntities(doc) {
  const persons = elementsByLocal(doc.root, "person").map((el) => readOne(doc, el, "person"));
  const places = elementsByLocal(doc.root, "place").map((el) => readOne(doc, el, "place"));
  const orgs = elementsByLocal(doc.root, "org").map((el) => readOne(doc, el, "org"));
  const events = elementsByLocal(doc.root, "event").map((el) => readOne(doc, el, "event"));
  const works = readWorks(doc);
  return { persons, places, orgs, events, works };
}

// ---- standOff scaffolding --------------------------------------------------

/**
 * The document's dominant newline, so scaffolding we insert matches the file's
 * line endings instead of forcing LF into an otherwise CRLF document.
 */
function docNewline(doc) {
  return doc && doc.raw && doc.raw.indexOf("\r\n") !== -1 ? "\r\n" : "\n";
}

/**
 * Ensure a <standOff> exists. If absent, insert "<standOff>\n  </standOff>" at the
 * best available anchor, in order of preference: after the teiHeader end tag, else
 * just before <text> (standOff precedes the body, as TEI expects), else as the
 * first child of the document element. Only if the input has no element at all do
 * we leave it untouched. Returns { doc, created }: a NEW doc when inserted, the
 * SAME doc when already present (or unanchorable).
 */
export function ensureStandOff(doc) {
  const existing = firstByLocal(doc.root, "standOff");
  if (existing) return { doc, created: false };
  const nl = docNewline(doc);
  const block = nl + "  <standOff>" + nl + "  </standOff>";

  // Preferred anchor: right after the teiHeader end tag.
  const header = firstByLocal(doc.root, "teiHeader");
  if (header && header.etagEnd != null) {
    return { doc: spliceDocument(doc, header.etagEnd, header.etagEnd, block), created: true };
  }
  // Fallback 1: immediately before <text>, so standOff precedes the body.
  const text = firstByLocal(doc.root, "text");
  if (text && text.outerStart != null) {
    return { doc: spliceDocument(doc, text.outerStart, text.outerStart, block + nl), created: true };
  }
  // Fallback 2: as the first child of the document element (e.g. <TEI>).
  const docEl = doc.root.children.find((c) => c.type === "element");
  if (docEl && docEl.contentStart != null) {
    return { doc: spliceDocument(doc, docEl.contentStart, docEl.contentStart, block), created: true };
  }
  // No element to anchor to (empty or element-free input): cannot scaffold.
  return { doc, created: false };
}

/**
 * Ensure the list element for a type exists just inside <standOff>.
 * Returns { doc, list } where list is the (re-parsed) list element.
 * Always returns a list element; inserts one if missing.
 */
function ensureList(doc, type) {
  const desc = TYPE_MAP[type];
  // Make sure standOff is present first.
  const ensured = ensureStandOff(doc);
  doc = ensured.doc;
  const standOff = firstByLocal(doc.root, "standOff");
  // No anchor was available (element-free input): signal "no list" to the caller.
  if (!standOff) return { doc, list: null };

  // Look for an existing list of this kind inside the standOff.
  let list = firstByLocal(standOff, desc.list);
  if (list) return { doc, list };

  // Insert an empty list just inside <standOff>, after its start tag.
  const at = standOff.contentStart != null ? standOff.contentStart : standOff.stagEnd;
  const nl = docNewline(doc);
  const snippet = nl + "    <" + desc.list + ">" + nl + "    </" + desc.list + ">";
  doc = spliceDocument(doc, at, at, snippet);
  list = firstByLocal(firstByLocal(doc.root, "standOff"), desc.list);
  return { doc, list };
}

// ---- mutate entities -------------------------------------------------------

/**
 * Add an entity of the given type using the shared shape. The id is slugified and
 * uniquified (NCName-safe); the name is escaped. When ai is true the entity is
 * marked resp="#ai" (AI-proposed, unverified). Returns a NEW doc.
 */
export function addEntity(doc, type, { id, name, ai = false } = {}) {
  const desc = TYPE_MAP[type];
  if (!desc) throw new Error("Unknown entity type: " + type);

  const ensured = ensureList(doc, type);
  doc = ensured.doc;
  const list = ensured.list;
  // The input had no element to anchor a standOff to; return it unchanged rather
  // than throwing, so a caller wired to a UI button degrades gracefully.
  if (!list) return doc;

  // Build an NCName-safe, unique id.
  const taken = collectIds(doc);
  let base = slugify(id);
  if (!base) base = slugify(name);
  if (!base) base = ID_PREFIX[type];
  // Ensure it starts with the type prefix when no explicit id was supplied,
  // so generated ids read like pers_/org_/evt_ as in the shared shape.
  if (!id && !base.startsWith(ID_PREFIX[type])) base = ID_PREFIX[type] + "_" + base;
  // A bare prefix with nothing else still needs a discriminator.
  if (base === ID_PREFIX[type]) base = ID_PREFIX[type] + "_1";
  const finalId = uniquify(base, taken);

  const safeName = escapeText(name == null ? "" : name);
  const nl = docNewline(doc);
  const respAttr = ai ? ' resp="' + AI_RESP + '"' : "";
  const el =
    nl + "      <" + desc.entity + ' xml:id="' + escapeAttr(finalId) + '"' + respAttr + ">" +
    "<" + desc.name + ">" + safeName + "</" + desc.name + ">" +
    "</" + desc.entity + ">";

  // Append just before the list's end tag (after the last child / content).
  const at = list.contentEnd != null ? list.contentEnd : list.stagEnd;
  return spliceDocument(doc, at, at, el);
}

/** Find the entity element (person/org/event) carrying xml:id === id, or null. */
function findEntityElement(doc, id) {
  let found = null;
  walk(doc.root, (n) => {
    if (found) return false;
    if (
      n.type === "element" &&
      ENTITY_TO_TYPE[n.localName] &&
      getAttr(n, "id") === id
    ) {
      found = n;
      return false;
    }
  });
  return found;
}

/**
 * Replace the persName/orgName/label text of the entity with xml:id === id.
 * If the name element exists, splice its content; otherwise insert one just inside
 * the entity. Returns a NEW doc (or the SAME doc if nothing matches or no change).
 */
export function updateEntity(doc, id, { name } = {}) {
  const el = findEntityElement(doc, id);
  if (!el) return doc;
  const type = ENTITY_TO_TYPE[el.localName];
  const desc = TYPE_MAP[type];
  const safeName = escapeText(name == null ? "" : name);

  const nameEl = firstByLocal(el, desc.name);
  if (nameEl) {
    // Replace the inner content of the name element [contentStart, contentEnd].
    const start = nameEl.contentStart != null ? nameEl.contentStart : nameEl.stagEnd;
    const end = nameEl.contentEnd != null ? nameEl.contentEnd : start;
    if (doc.raw.slice(start, end) === safeName) return doc; // no-op
    return spliceDocument(doc, start, end, safeName);
  }
  // No name element yet: insert one just inside the entity.
  const at = el.contentStart != null ? el.contentStart : el.stagEnd;
  const snippet = "<" + desc.name + ">" + safeName + "</" + desc.name + ">";
  return spliceDocument(doc, at, at, snippet);
}

/**
 * Remove the whole entity element (person/org/event) with xml:id === id.
 * Returns a NEW doc, or the SAME doc if no such entity exists.
 */
export function deleteEntity(doc, id) {
  const el = findEntityElement(doc, id);
  if (!el || el.outerEnd == null) return doc;
  return spliceDocument(doc, el.outerStart, el.outerEnd, "");
}

/**
 * Change an entity's type (person <-> place <-> org <-> event <-> work), keeping
 * its xml:id, authority idno children, AI marker and any other content, and
 * moving it into the target list (created if absent). The mentions point at the
 * unchanged xml:id, so they stay linked; only the entity tag and its name tag are
 * renamed. Returns a NEW doc, or the SAME doc on a no-op or missing anchor.
 */
export function retypeEntity(doc, id, newType) {
  const el = findEntityElement(doc, id);
  if (!el || el.outerEnd == null) return doc;
  const oldType = ENTITY_TO_TYPE[el.localName];
  const newDesc = TYPE_MAP[newType];
  if (!oldType || !newDesc || oldType === newType) return doc;
  const oldDesc = TYPE_MAP[oldType];

  // Transform only this element's own bytes: rename the entity tag and its name
  // child tag; everything else (xml:id, resp, idno, attributes) is kept verbatim.
  const qesc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const eq = qesc(el.qname);
  let frag = doc.raw.slice(el.outerStart, el.outerEnd)
    .replace(new RegExp("^<" + eq + "(?=[\\s/>])"), "<" + newDesc.entity)
    .replace(new RegExp("</" + eq + "(\\s*)>$"), "</" + newDesc.entity + "$1>");
  if (oldDesc.name !== newDesc.name) {
    const nameEl = firstByLocal(el, oldDesc.name);
    if (nameEl) {
      const nq = qesc(nameEl.qname);
      frag = frag
        .replace(new RegExp("<" + nq + "(?=[\\s/>])", "g"), "<" + newDesc.name)
        .replace(new RegExp("</" + nq + "(\\s*)>", "g"), "</" + newDesc.name + "$1>");
    }
  }

  // Remove the old element, then insert the transformed one into the target list.
  let next = spliceDocument(doc, el.outerStart, el.outerEnd, "");
  const ensured = ensureList(next, newType);
  next = ensured.doc;
  if (!ensured.list) return doc; // no standOff anchor: abandon rather than lose the entity
  const at = ensured.list.contentEnd != null ? ensured.list.contentEnd : ensured.list.stagEnd;
  return spliceDocument(next, at, at, docNewline(next) + "      " + frag);
}

/**
 * Confirm an AI-proposed entity: drop its resp="#ai" marker so it reads as a
 * human-verified entity. Reject is just deleteEntity. Returns a NEW doc, or the
 * SAME doc when the entity is absent or carries no AI marker (no-op).
 */
export function confirmEntity(doc, id) {
  const el = findEntityElement(doc, id);
  if (!el || getAttr(el, "resp") !== AI_RESP) return doc;
  return removeAttr(doc, el, "resp");
}

// ---- authority identifiers (idno) ------------------------------------------

/**
 * Upsert an authority identifier on the entity with xml:id === id, stored as an
 * <idno type="authority">value</idno> child (authority being e.g. GND / GeoNames /
 * Wikidata). The semantics are idempotent:
 *   - an empty/whitespace value removes the matching <idno> (no-op if none exists);
 *   - an existing <idno type="authority"> has its text replaced (no-op if unchanged);
 *   - otherwise a new <idno> is appended after the last idno, else after the name
 *     element, else at the entity's content end.
 * Every path is a single offset splice, so the round-trip stays byte-identical.
 * Returns a NEW doc, or the SAME doc on a no-op / when the entity is not found.
 */
export function setAuthority(doc, id, authority, value) {
  const el = findEntityElement(doc, id);
  if (!el) return doc;
  const authType = String(authority == null ? "" : authority).trim();
  if (!authType) return doc;
  const val = value == null ? "" : String(value).trim();

  const idnos = elementsByLocal(el, "idno");
  const existing = idnos.find((n) => (getAttr(n, "type") || "") === authType);

  if (existing) {
    if (!val) {
      if (existing.outerEnd == null) return doc;
      return spliceDocument(doc, existing.outerStart, existing.outerEnd, "");
    }
    const start = existing.contentStart != null ? existing.contentStart : existing.stagEnd;
    const end = existing.contentEnd != null ? existing.contentEnd : start;
    const safe = escapeText(val);
    if (doc.raw.slice(start, end) === safe) return doc; // no-op
    return spliceDocument(doc, start, end, safe);
  }

  if (!val) return doc; // nothing to remove, nothing to add

  const snippet = '<idno type="' + escapeAttr(authType) + '">' + escapeText(val) + "</idno>";
  const nameEl = firstByLocal(el, TYPE_MAP[ENTITY_TO_TYPE[el.localName]].name);
  let at;
  if (idnos.length && idnos[idnos.length - 1].outerEnd != null) {
    at = idnos[idnos.length - 1].outerEnd;
  } else if (nameEl && nameEl.outerEnd != null) {
    at = nameEl.outerEnd;
  } else if (el.contentEnd != null) {
    at = el.contentEnd;
  } else {
    return doc; // self-closing entity: no place to add a child losslessly
  }
  return spliceDocument(doc, at, at, snippet);
}

// ---- mentions --------------------------------------------------------------

/**
 * Wrap a reading-text node's content in <name ref="#entityId">...</name> via a
 * splice over [node.start, node.end]. Lossless. If the node is already the sole
 * content of a <name> that already carries this ref, this is a no-op (SAME doc).
 * Returns a NEW doc otherwise.
 */
export function linkMention(doc, textNode, entityId) {
  if (!textNode || textNode.type !== "text") return doc;
  const want = "#" + entityId;
  // Find the enclosing <name> with the SAME bounded ancestor walk the M2.5
  // projection (edition.js mentionRef) uses: through intermediate wrappers
  // (e.g. <unclear>, <hi>), stopping at the reading-unit level. Projection and
  // mutation must agree on "already linked", or relinking a critically-wrapped
  // mention would nest <name> inside <name> with conflicting refs.
  let nameEl = null;
  for (let p = textNode.parent; p && p.type === "element"; p = p.parent) {
    if (p.localName === "name") { nameEl = p; break; }
    if (p.localName === "p" || p.localName === "head" || p.localName === "note" || p.localName === "body") break;
  }
  // The mention text is already inside a <name>: retarget its @ref rather than
  // wrapping a second <name> (which would nest invalidly). A no-op if it already
  // points at this entity.
  if (nameEl) {
    const refAttr = getAttrObj(nameEl, "ref");
    if (refAttr) return refAttr.value === want ? doc : editAttrValue(doc, refAttr, want);
    // A <name> without @ref: insert one right after the element name.
    const at = nameEl.stagStart + 1 + nameEl.qname.length;
    return spliceDocument(doc, at, at, ' ref="' + escapeAttr(want) + '"');
  }
  const inner = doc.raw.slice(textNode.start, textNode.end);
  const wrapped = '<name ref="' + escapeAttr(want) + '">' + inner + "</name>";
  return spliceDocument(doc, textNode.start, textNode.end, wrapped);
}

/**
 * Wrap a SUB-RANGE of a text node's content in <name ref="#entityId">...</name>.
 * relFrom/relTo are raw offsets RELATIVE to the text node's [start, end] (the
 * caller maps display offsets through the entity decoding). Lossless splice.
 * Returns the SAME doc when the range is invalid, whitespace-only, or the node
 * already sits inside a <name> (a sub-range of a linked mention must be
 * retargeted at the existing <name>, never nested).
 */
export function linkMentionRange(doc, textNode, relFrom, relTo, entityId) {
  if (!textNode || textNode.type !== "text") return doc;
  // Same bounded ancestor walk as linkMention/mentionRef: inside a <name>,
  // refuse (SAME doc) instead of producing nested conflicting refs.
  for (let p = textNode.parent; p && p.type === "element"; p = p.parent) {
    if (p.localName === "name") return doc;
    if (p.localName === "p" || p.localName === "head" || p.localName === "note" || p.localName === "body") break;
  }
  const len = textNode.end - textNode.start;
  if (!Number.isInteger(relFrom) || !Number.isInteger(relTo)) return doc;
  if (relFrom < 0 || relTo > len || relFrom >= relTo) return doc;
  const from = textNode.start + relFrom;
  const to = textNode.start + relTo;
  const inner = doc.raw.slice(from, to);
  if (!inner.trim()) return doc;
  const wrapped = '<name ref="' + escapeAttr("#" + entityId) + '">' + inner + "</name>";
  return spliceDocument(doc, from, to, wrapped);
}

/**
 * Wrap a sub-range of a text node in arbitrary TEI markup. `build(inner)`
 * returns the replacement XML for the selected raw slice; the only invariant
 * enforced is that NO reading text is lost: the replacement stripped of tags
 * must equal the original slice byte-for-byte. This is the engine side of the
 * "full TEI flexibility" annotation path (persName with forename/surname,
 * date, term, foreign, hi, any element). Returns the SAME doc on an invalid
 * range, a whitespace-only slice, or a text-losing build.
 */
export function wrapRange(doc, textNode, relFrom, relTo, build) {
  if (!textNode || textNode.type !== "text" || typeof build !== "function") return doc;
  const len = textNode.end - textNode.start;
  if (!Number.isInteger(relFrom) || !Number.isInteger(relTo)) return doc;
  if (relFrom < 0 || relTo > len || relFrom >= relTo) return doc;
  const from = textNode.start + relFrom;
  const to = textNode.start + relTo;
  const inner = doc.raw.slice(from, to);
  if (!inner.trim()) return doc;
  const replacement = build(inner);
  if (typeof replacement !== "string") return doc;
  if (replacement.replace(/<[^>]*>/g, "") !== inner) return doc; // text must survive
  return spliceDocument(doc, from, to, replacement);
}

/**
 * Remove the <name> wrapper around a text node (the inverse of linkMention),
 * found with the same bounded ancestor walk. The content survives verbatim;
 * link -> unwrap is byte-identical to never having linked. SAME doc when the
 * node sits in no <name>.
 */
export function unwrapMention(doc, textNode) {
  if (!textNode || textNode.type !== "text") return doc;
  let nameEl = null;
  for (let p = textNode.parent; p && p.type === "element"; p = p.parent) {
    if (p.localName === "name") { nameEl = p; break; }
    if (p.localName === "p" || p.localName === "head" || p.localName === "note" || p.localName === "body") break;
  }
  if (!nameEl) return doc;
  if (nameEl.outerStart == null || nameEl.outerEnd == null) return doc;
  if (nameEl.contentStart == null || nameEl.contentEnd == null) return doc;
  const inner = doc.raw.slice(nameEl.contentStart, nameEl.contentEnd);
  return spliceDocument(doc, nameEl.outerStart, nameEl.outerEnd, inner);
}

/**
 * Every element carrying @ref === '#'+entityId. Returns [{ node }] in doc order.
 */
export function findMentions(doc, entityId) {
  const want = "#" + entityId;
  const out = [];
  walk(doc.root, (n) => {
    if (n.type === "element") {
      const ref = getAttrObj(n, "ref");
      if (ref && ref.value === want) out.push({ node: n });
    }
  });
  return out;
}

// ---- editorial notes (M3.5) ------------------------------------------------

/**
 * Ensure an element carries an xml:id, injecting a unique one (slugged from base)
 * just after the element name in its start tag when absent. Returns { doc, id }:
 * a NEW doc when injected, the SAME doc when the id already existed.
 */
export function ensureXmlId(doc, el, base) {
  const cur = getAttr(el, "id");
  if (cur) return { doc, id: cur };
  const id = uniquify(slugify(base) || "ln_1", collectIds(doc));
  const at = el.stagStart + 1 + el.qname.length;
  const next = spliceDocument(doc, at, at, ' xml:id="' + escapeAttr(id) + '"');
  return { doc: next, id };
}

/**
 * Append an editorial <note target="#id">text</note> inside <standOff> (scaffolded
 * if absent). The target must be an existing xml:id (resolve it with addNoteForNode
 * when you only have a reading-text node). Empty text is a no-op (SAME doc).
 * Returns a NEW doc otherwise.
 */
export function addNote(doc, targetId, text) {
  const body = String(text == null ? "" : text).trim();
  if (!body) return doc;
  const ensured = ensureStandOff(doc);
  doc = ensured.doc;
  const standOff = firstByLocal(doc.root, "standOff");
  if (!standOff) return doc; // element-free input: nothing to anchor to
  const nl = docNewline(doc);
  const ref = targetId ? ' target="#' + escapeAttr(targetId) + '"' : "";
  const snippet = nl + "    <note" + ref + ">" + escapeText(body) + "</note>";
  const at = standOff.contentEnd != null ? standOff.contentEnd : standOff.stagEnd;
  return spliceDocument(doc, at, at, snippet);
}

/**
 * Attach a note to a reading-text node, resolving a stable @target in order of
 * preference: the nearest ancestor xml:id, else the line's @facs zone id, else a
 * freshly injected xml:id on the node's enclosing element. Returns a NEW doc (or
 * the SAME doc when text is empty / there is nothing to anchor to).
 */
export function addNoteForNode(doc, textNode, fallbackFacs, text) {
  const body = String(text == null ? "" : text).trim();
  if (!body || !textNode || textNode.type !== "text") return doc;
  let targetId = null;
  const anc = ancestorWithXmlId(textNode);
  if (anc) {
    targetId = getAttr(anc, "id");
  } else if (fallbackFacs) {
    targetId = fallbackFacs;
  } else if (textNode.parent && textNode.parent.type === "element") {
    const r = ensureXmlId(doc, textNode.parent, "ln");
    doc = r.doc;
    targetId = r.id;
  }
  return addNote(doc, targetId, body);
}

/**
 * Index editorial notes by the ids they target: Map<id, text>. Walks the parsed
 * tree (every <note> carrying @target, wherever it sits), splits the target on
 * whitespace, strips the leading '#', and reads the body as the note's decoded
 * text nodes (child markup contributes its text, tags fall away). Notes without
 * @target are skipped.
 */
export function noteIndex(doc) {
  const map = new Map();
  for (const note of elementsByLocal(doc.root, "note")) {
    const target = getAttr(note, "target");
    if (!target) continue;
    const text = textNodes(note).map((t) => textOf(doc, t)).join("").trim();
    for (const t of target.split(/\s+/)) {
      const id = t.replace(/^#/, "");
      if (id) map.set(id, text);
    }
  }
  return map;
}

/**
 * The DOM-free core of the editor's commit path. Applies a doc -> doc mutation
 * and re-projects: a SAME-doc result (the no-op contract) reports changed false
 * and carries the doc through; a NEW doc is re-parsed into a fresh edition
 * state and note index. The browser integrator and the Node proofs run this
 * exact function.
 */
export function applyMutation(doc, fn) {
  const next = fn(doc);
  if (next === doc) return { changed: false, doc, edition: null, notes: null };
  const edition = parseEdition(next.raw);
  return { changed: true, doc: edition.doc, edition, notes: noteIndex(edition.doc) };
}
