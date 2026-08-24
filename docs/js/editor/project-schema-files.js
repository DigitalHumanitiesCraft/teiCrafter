/** Resolve manifest schema references against one flat project folder. */

import {
  normalizeSchemaSet,
  schemaDependencyRefs,
  schemaPathExtension,
} from "./schema-set.js";

const DEFINITIONS = Object.freeze({
  relaxng: { type: "relaxng", extensions: [".rng"] },
  xsd: { type: "xsd", extensions: [".xsd"] },
  schematron: { type: "schematron", extensions: [".sch", ".xsl", ".xslt"] },
});

function isFlat(name) {
  const normalized = String(name || "").replace(/\\/g, "/");
  return normalized === normalized.split("/").pop()
    && normalized !== "."
    && normalized !== ".."
    && !/[?#]/.test(normalized);
}

function dependencyPath(parent, href) {
  try {
    const resolved = new URL(href, `https://teicrafter.invalid/project/${parent.replace(/\\/g, "/")}`);
    if (resolved.origin !== "https://teicrafter.invalid") return null;
    return decodeURIComponent(resolved.pathname.replace(/^\/project\//, ""));
  } catch {
    return String(href || "").replace(/\\/g, "/");
  }
}

export function projectSchemaRequests(schema) {
  const normalized = normalizeSchemaSet(schema);
  return normalized.entries.map((entry) => {
    const definition = DEFINITIONS[entry.type];
    return {
      key: entry.type,
      path: entry.path,
      type: entry.type,
      flat: isFlat(entry.path),
      supported: !!definition && definition.extensions.includes(schemaPathExtension(entry.path)),
      dependency: false,
    };
  });
}

/**
 * `read(name)` resolves a bare filename to its XML text or null when absent.
 * Every requested path receives either text or a stable unavailable diagnosis.
 */
export async function loadProjectSchemaFiles(schema, read) {
  const loaded = {};
  const queue = [...projectSchemaRequests(schema)];
  const queued = new Set(queue.map((request) => `${request.type}\u0000${request.path}`));
  for (let index = 0; index < queue.length; index++) {
    const request = queue[index];
    if (!request.flat) {
      loaded[request.path] = {
        unavailable: `Project-folder schema "${request.path}" is unavailable: use a bare filename from the same folder; nested paths are not supported.`,
      };
      continue;
    }
    if (!request.supported) {
      loaded[request.path] = {
        unavailable: `Project-folder schema "${request.path}" has an unsupported extension for ${request.key}.`,
      };
      continue;
    }
    try {
      const text = await read(request.path);
      if (typeof text !== "string") {
        loaded[request.path] = {
          unavailable: `Project-folder schema "${request.path}" is unavailable: the file is missing from the project folder.`,
        };
        continue;
      }
      loaded[request.path] = { text };
      if (request.type !== "relaxng" && request.type !== "xsd") continue;
      for (const dependency of schemaDependencyRefs(text, request.type)) {
        if (dependency.missing) continue;
        const path = dependencyPath(request.path, dependency.href);
        if (path === null) continue;
        const key = `${request.type}\u0000${path}`;
        if (queued.has(key)) continue;
        queued.add(key);
        queue.push({
          key: request.key,
          path,
          type: request.type,
          flat: isFlat(path),
          supported: true,
          dependency: true,
        });
      }
    } catch (error) {
      loaded[request.path] = {
        unavailable: `Project-folder schema "${request.path}" could not be read: ${error.message}`,
      };
    }
  }
  return loaded;
}
