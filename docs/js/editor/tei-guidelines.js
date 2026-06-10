/**
 * teiCrafter Editor -- TEI P5 Guidelines reader (p5subset_en.json).
 *
 * The TEI Consortium publishes a machine-readable compilation of the P5
 * Guidelines (odd2json output). This module reads that compilation and answers
 * the questions an authoring UI asks: which elements a module offers, which
 * attributes an element carries (with their datatypes and closed value lists),
 * and the plain-text gloss and description for an element. The vendored copy
 * lives at docs/data/tei/p5subset_en.json (see the NOTICE there for version,
 * license and update procedure).
 *
 * Entry-agnostic by design: callers hand in the parsed JSON or its text, the
 * same contract project-manifest.js uses. Pure module: no DOM, no fetch,
 * mutates nothing. The guidelines load lazily, so a manifest's element and
 * module names cannot be validated against them at manifest parse time;
 * elementsForScope therefore skips unknown names silently rather than throwing.
 *
 * This is an authoring aid, NOT a validator. It deliberately exports no
 * validate function and does no content-model checking: it tells the editor
 * what markup exists and what it means, not whether a given document conforms.
 *
 * Attribute resolution is recursive. An element spec names attribute classes in
 * classes.atts; each attribute class may name further attribute classes in its
 * own classes.atts (att.global pulls in att.global.facs, att.global.linking and
 * the rest). A one-level merge misses inherited attributes such as @facs, so the
 * resolver walks the whole reachable class graph with a visited set.
 *
 * Shape of the 4.11.0 compilation this reader expects:
 *   {
 *     "title": "The TEI Guidelines", "edition": "", "date": "...",
 *     "modules":  [ { "ident": "core", "desc": [...], ... }, ... ],   // 22 entries
 *     "elements": [ { "ident": "persName", "module": "namesdates",
 *                     "desc": [...], "gloss": [...],
 *                     "classes": { "atts": ["att.global", ...] },
 *                     "attributes": [ <attDef>, ... ],               // element-own
 *                     "content": { ... } }, ... ],                   // 588 entries
 *     "classes": {
 *       "models":     [ ... ],
 *       "attributes": [ { "ident": "att.global", "attributes": [ <attDef>, ... ],
 *                         "classes": { "atts": ["att.global.facs", ...] } }, ... ]
 *     },
 *     ...
 *   }
 * An <attDef> carries ident (prefixed, e.g. "xml:id"), usage, desc, gloss,
 * datatype ({ dataRef: { key | name } }) and valList ({ type, valItem: [...] }).
 *
 * The compilation carries NO version string of its own (its "edition" field is
 * empty and "4.11.0" appears nowhere in the file). guidelinesVersion therefore
 * reports the version the caller pinned when parsing, defaulting to the vendored
 * 4.11.0; it is metadata about the vendored copy, not a value read from it.
 */

export const VENDORED_GUIDELINES_PATH = "data/tei/p5subset_en.json";
export const VENDORED_GUIDELINES_VERSION = "4.11.0";

function fail(msg) {
  throw new Error(`TEI guidelines: ${msg}`);
}

/**
 * Strip embedded XML tags, decode the basic entities and collapse whitespace,
 * turning a guidelines desc or gloss (markup like <gi>TEI</gi> or
 * <ident type="class">model.resource</ident>) into a single plain-text line.
 */
function plainText(value) {
  let s = Array.isArray(value) ? value.join(" ") : value == null ? "" : String(value);
  s = s.replace(/<[^>]*>/g, " ");
  s = s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
  return s.replace(/\s+/g, " ").trim();
}

/** The dataRef key for an attDef datatype: prefer "key", fall back to "name", else null. */
function datatypeOf(attDef) {
  const dt = attDef && attDef.datatype;
  const ref = dt && dt.dataRef;
  if (!ref || typeof ref !== "object") return null;
  if (typeof ref.key === "string" && ref.key) return ref.key;
  if (typeof ref.name === "string" && ref.name) return ref.name;
  return null;
}

/** Normalize an attDef valList to { type, items: [{ ident, desc }] }, or null. */
function valListOf(attDef) {
  const vl = attDef && attDef.valList;
  const items = vl && Array.isArray(vl.valItem) ? vl.valItem : null;
  if (!items || !items.length) return null;
  return {
    type: typeof vl.type === "string" && vl.type ? vl.type : null,
    items: items.map((v) => ({ ident: v.ident, desc: plainText(v.desc) })),
  };
}

/** One attDef projected to the public attribute shape. */
function attribute(attDef) {
  return {
    ident: attDef.ident,
    usage: typeof attDef.usage === "string" ? attDef.usage : null,
    datatype: datatypeOf(attDef),
    valList: valListOf(attDef),
    desc: plainText(attDef.desc),
  };
}

/**
 * Parse and validate a guidelines compilation (parsed object or JSON text).
 * Returns an opaque handle the other exports read, or throws with a precise
 * message. `version` records the version of the vendored copy (the compilation
 * itself carries none); it is not read from the JSON.
 */
export function parseGuidelines(input, version = VENDORED_GUIDELINES_VERSION) {
  let j = input;
  if (typeof input === "string") {
    try { j = JSON.parse(input); } catch (err) { fail(`not valid JSON (${err.message})`); }
  }
  if (!j || typeof j !== "object" || Array.isArray(j)) fail("not a JSON object");
  if (!Array.isArray(j.elements)) fail('"elements" is missing or not an array');
  if (!j.classes || typeof j.classes !== "object") fail('"classes" is missing or not an object');
  if (!Array.isArray(j.classes.attributes)) fail('"classes.attributes" is missing or not an array');
  if (!Array.isArray(j.modules)) fail('"modules" is missing or not an array');

  const elements = new Map();
  for (const e of j.elements) {
    if (e && typeof e.ident === "string") elements.set(e.ident, e);
  }
  const attClasses = new Map();
  for (const c of j.classes.attributes) {
    if (c && typeof c.ident === "string") attClasses.set(c.ident, c);
  }
  const modules = j.modules
    .map((m) => (m && typeof m.ident === "string" ? m.ident : null))
    .filter((x) => x !== null);

  return {
    version: typeof version === "string" && version ? version : VENDORED_GUIDELINES_VERSION,
    elements,
    attClasses,
    modules,
  };
}

/** The version of the vendored copy this handle was parsed with. */
export function guidelinesVersion(g) {
  return g.version;
}

/** Sorted list of module names (22 in the 4.11.0 compilation, including "tei"). */
export function moduleList(g) {
  return [...g.modules].sort();
}

/** The element idents declared by a module, in declaration order; [] if unknown. */
export function elementsByModule(g, module) {
  const out = [];
  for (const [ident, spec] of g.elements) {
    if (spec.module === module) out.push(ident);
  }
  return out;
}

/**
 * The recursively resolved attribute list for an element spec. The worklist
 * walks classes.atts of the element and of every reached attribute class, with
 * a visited set over class idents and a dedup set over attribute idents.
 * Element-own attDefs are taken before class-inherited ones, so on a clash the
 * element's own definition wins.
 */
function resolveAttributes(g, spec) {
  const out = [];
  const seenAtt = new Set();
  const seenClass = new Set();

  const take = (attDef) => {
    if (!attDef || typeof attDef.ident !== "string" || seenAtt.has(attDef.ident)) return;
    seenAtt.add(attDef.ident);
    out.push(attribute(attDef));
  };

  for (const a of spec.attributes || []) take(a);

  const work = [...((spec.classes && spec.classes.atts) || [])];
  while (work.length) {
    const cid = work.shift();
    if (seenClass.has(cid)) continue;
    seenClass.add(cid);
    const cls = g.attClasses.get(cid);
    if (!cls) continue;
    for (const a of cls.attributes || []) take(a);
    for (const c of (cls.classes && cls.classes.atts) || []) work.push(c);
  }
  return out;
}

/**
 * The full reader view of one element, or null if the ident is unknown:
 *   { ident, module, gloss, desc, attributes, content }
 * gloss and desc are plain text (tags stripped, entities decoded, whitespace
 * collapsed); attributes is the recursively resolved, deduplicated list;
 * content is the raw content-model object, passed through untouched.
 */
export function elementByName(g, ident) {
  const spec = g.elements.get(ident);
  if (!spec) return null;
  return {
    ident: spec.ident,
    module: spec.module || null,
    gloss: plainText(spec.gloss),
    desc: plainText(spec.desc),
    attributes: resolveAttributes(g, spec),
    content: spec.content,
  };
}

/**
 * The union of all elements of the named modules plus the explicitly named
 * elements, deduplicated. Unknown module names and unknown element idents are
 * skipped silently: a manifest declares its scope before the guidelines load,
 * so it cannot be validated against them here.
 */
export function elementsForScope(g, { modules = [], elements = [] } = {}) {
  const out = [];
  const seen = new Set();
  const add = (ident) => {
    if (g.elements.has(ident) && !seen.has(ident)) { seen.add(ident); out.push(ident); }
  };
  for (const m of modules) for (const ident of elementsByModule(g, m)) add(ident);
  for (const ident of elements) add(ident);
  return out;
}
