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
 * A project is not an edition type: one project (e.g. Stefan Zweig Digital)
 * holds several types (letters, life documents, typescripts), and the allowed
 * element inventory binds to the TYPE. Project-level "markup" is the default;
 * "documentTypes" carry per-type inventories and "files" assigns a type to a
 * file by name.
 *
 * Format v1 (all keys except "teicrafter" and "name" optional):
 *   {
 *     "teicrafter": 1,
 *     "name": "...",
 *     "schema": "https://...rng",
 *     "imageResolver": { "type": "iiif-image-template", "template": "...{stem}..." },
 *     "markup":  [ { "element": "hi", "label": "...", "attributes": { "rend": "inkRed" } } ],
 *     "teiModules":  [ "core", "namesdates" ],
 *     "teiElements": [ "persName", "supplied" ],
 *     "documentTypes": [ { "key": "letter", "label": "Letter", "markup": [ ... ],
 *                          "teiModules": [ ... ], "teiElements": [ ... ] } ],
 *     "files":   { "brief-001.xml": "letter" },
 *     "indices": [ { "key": "peoples", "label": "...", "listType": "...", "registers": ["GND"] } ],
 *     "views":   [ { "key": "diplomatic", "label": "..." } ]
 *   }
 *
 * teiModules / teiElements declare the project's TEI vocabulary scope against
 * the vendored P5 Guidelines (their union; allow-lists only). Role split:
 * wraps in the annotate popover derive ONLY from teiElements (a deliberately
 * small, curated list); teiModules scope the attribute editor's vocabulary
 * and the project panel display, never the wrap menu. The names cannot be
 * validated against the Guidelines here (those load lazily); unknown names
 * are skipped at resolution time.
 */

import { elementByName } from "./tei-guidelines.js";

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

/**
 * One markup entry -> [label, build, element] in the MARKUP_WRAPS shape
 * (annotation-ui reads the first two; the element name lets resolveMarkup
 * deduplicate derived wraps against explicit ones).
 */
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
  return [label, (inner) => `${open}${inner}${close}`, el];
}

/** Validate the optional teiModules / teiElements pair into a scope object. */
function teiScopeDef(obj, where) {
  const scope = { modules: [], elements: [] };
  if (obj.teiModules !== undefined) {
    if (!Array.isArray(obj.teiModules)) fail(`${where}"teiModules" is not an array`);
    scope.modules = obj.teiModules.map((v, i) => {
      if (typeof v !== "string" || !RE_XML_NAME.test(v)) fail(`${where}teiModules[${i}] is not a valid TEI module name`);
      return v;
    });
  }
  if (obj.teiElements !== undefined) {
    if (!Array.isArray(obj.teiElements)) fail(`${where}"teiElements" is not an array`);
    scope.elements = obj.teiElements.map((v, i) => {
      if (typeof v !== "string" || !RE_XML_NAME.test(v)) fail(`${where}teiElements[${i}] is not a valid XML element name`);
      return v;
    });
  }
  return scope;
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
  if (m.documentTypes !== undefined && !Array.isArray(m.documentTypes)) fail('"documentTypes" is not an array');
  if (m.indices !== undefined && !Array.isArray(m.indices)) fail('"indices" is not an array');
  if (m.views !== undefined && !Array.isArray(m.views)) fail('"views" is not an array');

  const documentTypes = Array.isArray(m.documentTypes)
    ? m.documentTypes.map((t, i) => {
        if (!t || typeof t !== "object") fail(`documentTypes[${i}] is not an object`);
        if (typeof t.key !== "string" || !t.key.trim()) fail(`documentTypes[${i}].key is missing`);
        if (t.markup !== undefined && !Array.isArray(t.markup)) fail(`documentTypes[${i}].markup is not an array`);
        return {
          key: t.key.trim(),
          label: typeof t.label === "string" && t.label.trim() ? t.label.trim() : t.key.trim(),
          markup: Array.isArray(t.markup) && t.markup.length ? t.markup.map(markupWrap) : null,
          teiScope: teiScopeDef(t, `documentTypes[${i}].`),
        };
      })
    : [];

  let files = {};
  if (m.files !== undefined) {
    if (!m.files || typeof m.files !== "object" || Array.isArray(m.files)) fail('"files" is not an object');
    for (const [fileName, typeKey] of Object.entries(m.files)) {
      if (typeof typeKey !== "string") fail(`files["${fileName}"] is not a type key string`);
      if (!documentTypes.some((t) => t.key === typeKey)) fail(`files["${fileName}"] names unknown document type "${typeKey}"`);
      files[fileName] = typeKey;
    }
  }

  return {
    source: "manifest",
    name: m.name.trim(),
    schema: typeof m.schema === "string" && m.schema.trim() ? m.schema.trim() : null,
    iiifImageTemplate,
    markup: Array.isArray(m.markup) && m.markup.length ? m.markup.map(markupWrap) : null,
    teiScope: teiScopeDef(m, ""),
    documentTypes,
    files,
    indices: Array.isArray(m.indices) ? m.indices.map(indexDef) : [],
    views: Array.isArray(m.views) ? m.views.map(viewDef) : [],
  };
}

/** The document type assigned to a file name, or null (no manifest, no assignment). */
export function typeForFile(project, fileName) {
  if (!project || !project.files || !fileName) return null;
  const key = project.files[fileName];
  if (!key) return null;
  return (project.documentTypes || []).find((t) => t.key === key) || null;
}

/**
 * The markup wrap list that applies to a file: its document type's inventory
 * if assigned, else the project-level default, else null (built-in wraps).
 */
export function markupForFile(project, fileName) {
  if (!project) return null;
  const type = typeForFile(project, fileName);
  if (type && type.markup) return type.markup;
  return project.markup || null;
}

/**
 * The TEI vocabulary scope that applies to a file: its document type's scope
 * when the type declares one (same precedence as markupForFile), else the
 * project-level scope. Always returns { modules, elements }; both empty
 * without a manifest or for pre-scope manifests.
 */
export function teiScopeForFile(project, fileName) {
  const empty = { modules: [], elements: [] };
  if (!project) return empty;
  const type = typeForFile(project, fileName);
  if (type && type.teiScope && (type.teiScope.modules.length || type.teiScope.elements.length)) {
    return type.teiScope;
  }
  return project.teiScope || empty;
}

/**
 * The effective wrap list for a file: explicit markup entries first and with
 * precedence, then wraps derived from the file's scope. Derived wraps come
 * ONLY from teiElements (teiModules never feed the wrap menu: a module-wide
 * list does not fit a flat popover; modules scope the attribute editor).
 * Degradation contract: with guidelines null (not loaded, fetch failed) the
 * result is exactly markupForFile, so the explicit list, or null for the
 * built-in wraps. Derived entries are labelled "gloss (element)", skip idents
 * unknown to the guidelines, and deduplicate against explicit wraps.
 */
export function resolveMarkup(project, fileName, guidelines) {
  const explicit = markupForFile(project, fileName);
  if (!guidelines) return explicit;
  const scope = teiScopeForFile(project, fileName);
  if (!scope.elements.length) return explicit;
  const seen = new Set((explicit || []).map((w) => w[2]).filter(Boolean));
  const derived = [];
  for (const ident of scope.elements) {
    if (seen.has(ident)) continue;
    const spec = elementByName(guidelines, ident);
    if (!spec) continue;
    seen.add(ident);
    derived.push([
      spec.gloss ? `${spec.gloss} (${ident})` : ident,
      (inner) => `<${ident}>${inner}</${ident}>`,
      ident,
    ]);
  }
  if (!derived.length) return explicit;
  return [...(explicit || []), ...derived];
}
