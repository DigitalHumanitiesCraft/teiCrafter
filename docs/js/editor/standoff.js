/**
 * teiCrafter Editor -- StandOff / entity index model (DOM-free, lossless).
 *
 * A schema-light layer over the generic core: it reads and edits TEI standOff
 * entities (person, place, org, event) and the in-text mentions that link to them.
 * It imports only from ./tei-document.js so it runs in the browser (editor-app.js)
 * and in Node (headless proofs) with identical logic.
 *
 * The raw string stays canonical. Every mutation is an offset splice via
 * spliceDocument, which returns a NEW re-parsed doc; a no-op returns the SAME doc,
 * so a load -> serialize round-trip is byte-identical by construction.
 *
 * Shared entity shape (the seeded example and this module agree on it exactly):
 *   <standOff>
 *     <listPerson><person xml:id="..."><persName>Name</persName></person></listPerson>
 *     <listOrg><org xml:id="..."><orgName>Name</orgName></org></listOrg>
 *     <listEvent><event xml:id="..."><label>Label</label></event></listEvent>
 *   </standOff>
 * An in-text mention links by wrapping the mention in <name ref="#id">...</name>.
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
  escapeText,
  escapeAttr,
} from "./tei-document.js";

// Map an entity type to its list element, entity element, and name element.
const TYPE_MAP = Object.freeze({
  person: { list: "listPerson", entity: "person", name: "persName" },
  place: { list: "listPlace", entity: "place", name: "placeName" },
  org: { list: "listOrg", entity: "org", name: "orgName" },
  event: { list: "listEvent", entity: "event", name: "label" },
});

// Reverse lookup: entity local-name -> type descriptor (plus the type key).
const ENTITY_TO_TYPE = Object.freeze({
  person: "person",
  place: "place",
  org: "org",
  event: "event",
});

const ID_PREFIX = Object.freeze({ person: "pers", place: "plc", org: "org", event: "evt" });

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
    .replace(/_+/g, "_")
    .replace(/^[._-]+/, "") // a leading '.', '-' is not a valid NCName start
    .replace(/[._-]+$/, "");
  // An NCName may not start with a digit; prefix an underscore if it would.
  if (out && /^[0-9]/.test(out)) out = "_" + out;
  return out;
}

/** Collect every xml:id present in the document. */
function collectIds(doc) {
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
function uniquify(base, taken) {
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

function readOne(doc, el, type) {
  const desc = TYPE_MAP[type];
  const id = getAttr(el, "id");
  const name = firstChildText(doc, el, desc.name) || allText(doc, el) || "";
  return { id, type, name, node: el };
}

/**
 * Read every standOff entity in the document.
 * Scans <person>/<org>/<event> anywhere (standOff preferred but not required).
 * E = { id, type, name, node }; name from persName/orgName/label else first text.
 */
export function readEntities(doc) {
  const persons = elementsByLocal(doc.root, "person").map((el) => readOne(doc, el, "person"));
  const places = elementsByLocal(doc.root, "place").map((el) => readOne(doc, el, "place"));
  const orgs = elementsByLocal(doc.root, "org").map((el) => readOne(doc, el, "org"));
  const events = elementsByLocal(doc.root, "event").map((el) => readOne(doc, el, "event"));
  return { persons, places, orgs, events };
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
 * uniquified (NCName-safe); the name is escaped. Returns a NEW doc.
 */
export function addEntity(doc, type, { id, name } = {}) {
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
  const el =
    nl + "      <" + desc.entity + ' xml:id="' + escapeAttr(finalId) + '">' +
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
  const parent = textNode.parent;
  // The mention text is already inside a <name>: retarget its @ref rather than
  // wrapping a second <name> (which would nest invalidly). A no-op if it already
  // points at this entity.
  if (parent && parent.type === "element" && parent.localName === "name") {
    const refAttr = getAttrObj(parent, "ref");
    if (refAttr) return refAttr.value === want ? doc : editAttrValue(doc, refAttr, want);
    // A <name> without @ref: insert one right after the element name.
    const at = parent.stagStart + 1 + parent.qname.length;
    return spliceDocument(doc, at, at, ' ref="' + escapeAttr(want) + '"');
  }
  const inner = doc.raw.slice(textNode.start, textNode.end);
  const wrapped = '<name ref="' + escapeAttr(want) + '">' + inner + "</name>";
  return spliceDocument(doc, textNode.start, textNode.end, wrapped);
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
