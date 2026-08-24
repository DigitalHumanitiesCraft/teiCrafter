/** Normalize legacy and schema-set project declarations without hiding errors. */

import { getAttr, parseDocument, walk } from "./tei-document.js";

const RNG_NAMESPACE = "http://relaxng.org/ns/structure/1.0";
const XSD_NAMESPACE = "http://www.w3.org/2001/XMLSchema";

const TYPE_BY_EXTENSION = Object.freeze({
  ".rng": "relaxng",
  ".xsd": "xsd",
  ".sch": "schematron",
  ".xsl": "schematron",
  ".xslt": "schematron",
});

const VALID_TYPES = new Set(["relaxng", "xsd", "schematron"]);

function extension(path) {
  const clean = String(path || "").split(/[?#]/, 1)[0];
  const match = /(?:^|\/)(?:[^/]+)(\.[^.\/]+)$/.exec(clean.replace(/\\/g, "/"));
  return match ? match[1].toLowerCase() : "";
}

function inferredType(path, fallback = null) {
  return TYPE_BY_EXTENSION[extension(path)] || fallback;
}

function list(value) {
  if (value == null || value === "") return [];
  if (Array.isArray(value)) return value;
  if (value instanceof Set) return [...value];
  return [value];
}

function addEntry(entries, issues, value, fallbackType, where) {
  if (typeof value === "string") {
    const path = value.trim();
    if (!path) {
      issues.push(`${where} must be a non-empty schema path.`);
      return;
    }
    const type = fallbackType || inferredType(path);
    if (!type) {
      issues.push(`${where} cannot infer a schema type from "${path}".`);
      return;
    }
    entries.push({ type, path, name: null });
    return;
  }
  if (!value || typeof value !== "object" || Array.isArray(value) || value instanceof Set) {
    issues.push(`${where} must be a schema path or { type, path } object.`);
    return;
  }
  const path = typeof value.path === "string" ? value.path.trim() : "";
  const typeValue = typeof value.type === "string" ? value.type.trim().toLowerCase() : "";
  const type = typeValue || fallbackType || inferredType(path);
  if (!path) {
    issues.push(`${where}.path must be a non-empty schema path.`);
    return;
  }
  if (!VALID_TYPES.has(type)) {
    issues.push(`${where}.type must be relaxng, xsd, or schematron.`);
    return;
  }
  entries.push({
    type,
    path,
    name: typeof value.name === "string" && value.name.trim() ? value.name.trim() : null,
  });
}

/**
 * Accepted runtime shapes are deliberately broader than the current manifest parser:
 * a legacy RNG string; { relaxng, xsd, schematron } whose values are paths, arrays,
 * or Sets; a direct array/Set of { type, path }; or { schemas: [...] }.
 *
 * The preferred parser seam is { schemas: [{ type, path, name? }, ...] }.
 */
export function normalizeSchemaSet(schema) {
  if (schema == null || schema === "") return { declared: false, entries: [], issues: [] };
  const entries = [];
  const issues = [];

  if (typeof schema === "string") {
    addEntry(entries, issues, schema, "relaxng", "schema");
  } else if (Array.isArray(schema) || schema instanceof Set) {
    list(schema).forEach((entry, index) => addEntry(entries, issues, entry, null, `schema[${index}]`));
  } else if (typeof schema === "object") {
    if (Object.prototype.hasOwnProperty.call(schema, "schemas")) {
      const values = schema.schemas;
      if (!Array.isArray(values) && !(values instanceof Set)) {
        issues.push("schema.schemas must be an array or Set.");
      } else {
        list(values).forEach((entry, index) => addEntry(entries, issues, entry, null, `schema.schemas[${index}]`));
      }
    } else {
      for (const type of ["relaxng", "xsd", "schematron"]) {
        list(schema[type]).forEach((entry, index) => {
          const suffix = list(schema[type]).length > 1 ? `[${index}]` : "";
          addEntry(entries, issues, entry, type, `schema.${type}${suffix}`);
        });
      }
      if (!entries.length && !issues.length) {
        issues.push("schema must declare relaxng, xsd, schematron, or schemas.");
      }
    }
  } else {
    issues.push("schema must be a path, object, array, or Set.");
  }

  const seen = new Set();
  const unique = entries.filter((entry) => {
    const key = `${entry.type}\u0000${entry.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (!unique.length && !issues.length) issues.push("The configured schema set is empty.");
  return { declared: true, entries: unique, issues };
}

/** Schema references that libxml2 must receive before compiling a validator. */
export function schemaDependencyRefs(text, type) {
  const refs = [];
  const doc = parseDocument(String(text || ""));
  walk(doc.root, (node) => {
    if (node.type !== "element") return;
    if (type === "relaxng"
      && node.namespaceURI === RNG_NAMESPACE
      && (node.localName === "include" || node.localName === "externalRef")) {
      const href = String(getAttr(node, "href") || "").trim();
      refs.push({ kind: node.localName, href, missing: !href });
    }
    if (type === "xsd"
      && node.namespaceURI === XSD_NAMESPACE
      && ["include", "import", "redefine"].includes(node.localName)) {
      const href = String(getAttr(node, "schemaLocation") || "").trim();
      refs.push({ kind: node.localName, href, missing: !href });
    }
  });
  return refs;
}

export function schemaPathExtension(path) {
  return extension(path);
}

export function schemaTypeForPath(path) {
  return inferredType(path);
}
