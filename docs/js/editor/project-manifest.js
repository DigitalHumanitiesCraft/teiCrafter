/**
 * teiCrafter Editor -- declarative project manifest (teicrafter.project.json).
 *
 * A project manifest sits next to a project's TEI files and is the
 * machine-readable derivation of its editorial guidelines: name, schema,
 * image resolver, allowed markup, index definitions, authoring views.
 * parseManifest() validates the JSON and normalizes it into the same runtime
 * project shape the built-in PID profiles produce (project-profiles.js), so
 * every consumer (facsimile tile source, markup wrap list, status line) works
 * identically for both sources. PID detection stays the fallback for bare
 * files opened without a manifest.
 *
 * Entry-agnostic by design: callers hand in the JSON text, whether it came
 * from a fetch (example registry) or a directory handle (M2.9 "Open project
 * folder"). Pure module: no DOM, no fetch, mutates nothing.
 *
 * Format v1 (all keys except "teicrafter" and "name" optional):
 *   {
 *     "teicrafter": 1,
 *     "name": "...",
 *     "schema": "https://...rng",
 *     "imageResolver": { "type": "iiif-image-template", "template": "...{stem}..." },
 *     "markup":  [ { "element": "hi", "label": "...", "attributes": { "rend": "inkRed" } } ],
 *     "indices": [ { "key": "peoples", "label": "...", "listType": "...", "registers": ["GND"] } ],
 *     "views":   [ { "key": "diplomatic", "label": "..." } ]
 *   }
 */

export const MANIFEST_FILENAME = "teicrafter.project.json";
export const MANIFEST_VERSION = 1;

// XML name (NCName approximation): enough to reject injection, not a full spec.
const RE_XML_NAME = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

function fail(msg) {
  throw new Error(`project manifest: ${msg}`);
}

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** One markup entry -> [label, build] in the MARKUP_WRAPS shape (annotation-ui). */
function markupWrap(entry, i) {
  if (!entry || typeof entry !== "object") fail(`markup[${i}] is not an object`);
  const el = entry.element;
  if (typeof el !== "string" || !RE_XML_NAME.test(el)) fail(`markup[${i}].element is not a valid XML element name`);
  const attrs = entry.attributes || {};
  if (typeof attrs !== "object" || Array.isArray(attrs)) fail(`markup[${i}].attributes is not an object`);
  let attrStr = "";
  for (const [name, value] of Object.entries(attrs)) {
    if (!RE_XML_NAME.test(name)) fail(`markup[${i}] attribute "${name}" is not a valid XML attribute name`);
    attrStr += ` ${name}="${escapeAttr(value)}"`;
  }
  const label = typeof entry.label === "string" && entry.label.trim() ? entry.label.trim() : el;
  const open = `<${el}${attrStr}>`;
  const close = `</${el}>`;
  return [label, (inner) => `${open}${inner}${close}`];
}

function indexDef(entry, i) {
  if (!entry || typeof entry !== "object") fail(`indices[${i}] is not an object`);
  if (typeof entry.key !== "string" || !entry.key.trim()) fail(`indices[${i}].key is missing`);
  if (entry.registers !== undefined && !Array.isArray(entry.registers)) fail(`indices[${i}].registers is not an array`);
  return {
    key: entry.key.trim(),
    label: typeof entry.label === "string" && entry.label.trim() ? entry.label.trim() : entry.key.trim(),
    listType: typeof entry.listType === "string" ? entry.listType : null,
    registers: Array.isArray(entry.registers) ? entry.registers.map(String) : [],
  };
}

function viewDef(entry, i) {
  if (typeof entry === "string") return { key: entry, label: entry };
  if (!entry || typeof entry !== "object") fail(`views[${i}] is not an object or string`);
  if (typeof entry.key !== "string" || !entry.key.trim()) fail(`views[${i}].key is missing`);
  return {
    key: entry.key.trim(),
    label: typeof entry.label === "string" && entry.label.trim() ? entry.label.trim() : entry.key.trim(),
  };
}

/**
 * Parse and validate a manifest (JSON text or already-parsed object).
 * Returns the runtime project object, or throws with a precise message.
 */
export function parseManifest(input) {
  let m = input;
  if (typeof input === "string") {
    try { m = JSON.parse(input); } catch (err) { fail(`not valid JSON (${err.message})`); }
  }
  if (!m || typeof m !== "object" || Array.isArray(m)) fail("not a JSON object");
  if (m.teicrafter !== MANIFEST_VERSION) fail(`"teicrafter" must be ${MANIFEST_VERSION} (got ${JSON.stringify(m.teicrafter)})`);
  if (typeof m.name !== "string" || !m.name.trim()) fail('"name" is missing');

  let iiifImageTemplate = null;
  if (m.imageResolver !== undefined) {
    const r = m.imageResolver;
    if (!r || typeof r !== "object") fail('"imageResolver" is not an object');
    if (r.type !== "iiif-image-template") fail(`unknown imageResolver type ${JSON.stringify(r.type)}`);
    if (typeof r.template !== "string" || !r.template.includes("{stem}")) fail('imageResolver.template must contain "{stem}"');
    iiifImageTemplate = r.template;
  }

  if (m.markup !== undefined && !Array.isArray(m.markup)) fail('"markup" is not an array');
  if (m.indices !== undefined && !Array.isArray(m.indices)) fail('"indices" is not an array');
  if (m.views !== undefined && !Array.isArray(m.views)) fail('"views" is not an array');

  return {
    source: "manifest",
    name: m.name.trim(),
    schema: typeof m.schema === "string" && m.schema.trim() ? m.schema.trim() : null,
    iiifImageTemplate,
    markup: Array.isArray(m.markup) && m.markup.length ? m.markup.map(markupWrap) : null,
    indices: Array.isArray(m.indices) ? m.indices.map(indexDef) : [],
    views: Array.isArray(m.views) ? m.views.map(viewDef) : [],
  };
}
