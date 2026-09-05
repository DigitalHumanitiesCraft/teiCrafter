/** Resolve schema references and dependencies inside a granted project folder. */

import {
  normalizeSchemaSet,
  schemaDependencyRefs,
  schemaPathExtension,
} from "./schema-set.js";
import { projectPath } from "./project-path.js";

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
    if (/^(?:\/|[a-z][a-z0-9+.-]*:)/i.test(href)) return null;
    return projectPath(parent.replace(/[^/]+$/, "").split("/").map(encodeURIComponent).join("/") + href);
  } catch { return null; }
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
 * `read(path)` resolves a project-relative path to XML text or null when absent.
 * Every requested path receives either text or a stable unavailable diagnosis.
 */
export async function loadProjectSchemaFiles(schema, read) {
  const loaded = Object.create(null);
  const queue = [...projectSchemaRequests(schema)];
  const queued = new Set(queue.map((request) => {
    try { return `${request.type}\u0000${projectPath(request.path)}`; }
    catch { return `${request.type}\u0000${request.path}`; }
  }));
  for (let index = 0; index < queue.length; index++) {
    const request = queue[index];
    let safePath;
    try { safePath = projectPath(request.path, !!request.dependency); }
    catch (error) {
      loaded[request.path] = {
        unavailable: `Project-folder schema "${request.path}" is unavailable: ${error.message}`,
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
      const text = await read(safePath);
      if (typeof text !== "string") {
        loaded[request.path] = {
          unavailable: `Project-folder schema "${request.path}" is unavailable: the file is missing from the project folder.`,
        };
        continue;
      }
      loaded[request.path] = { text, path: safePath };
      if (request.type !== "relaxng" && request.type !== "xsd") continue;
      for (const dependency of schemaDependencyRefs(text, request.type)) {
        if (dependency.missing) continue;
        const path = dependencyPath(safePath, dependency.href);
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
