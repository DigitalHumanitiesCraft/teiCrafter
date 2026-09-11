import { encodeXmlBytes } from "./file-encoding.js";
import { parseManifest } from "./project-manifest.js";

export const PROJECT_DOCUMENTS_VERSION = 1;
const clone = (value) => value == null ? null : structuredClone(value);
const jsonCopy = (value) => value == null ? null : JSON.parse(JSON.stringify(value));

/** Portable relative paths must be unambiguous on case-insensitive filesystems. */
export function projectPathKey(name) {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: Archive paths cannot contain control characters.
  if (typeof name !== "string" || !name || /[\\\x00-\x1f\x7f:?#%]/.test(name)
    || name.split("/").some((part) => !part || part === "." || part === ".." || /[. ]$/.test(part)
      || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) {
    throw new Error("Project files require safe, unambiguous relative paths.");
  }
  return name.normalize("NFC").toLowerCase();
}

export function projectForSnapshot(entry) {
  const project = entry.projectManifest ? parseManifest(entry.projectManifest) : jsonCopy(entry.project);
  if (project) {
    if (entry.localSchemas) project.localSchemas = clone(entry.localSchemas);
    if (entry.schemaBaseUrl) project.schemaBaseUrl = entry.schemaBaseUrl;
  }
  return project;
}

export function snapshotProjectDocument(app, schemaSettings = null, previous = null) {
  return {
    id: previous?.id || crypto.randomUUID(), role: previous?.role || null,
    name: app.docName || "edition.xml", raw: app.state.doc.raw,
    fileEncoding: { encoding: "UTF-8", bom: !!app.fileEncoding?.bom },
    dirty: !!app.dirty, source: jsonCopy(app.source),
    project: jsonCopy(app.project), projectManifest: app.project?.manifestSource || null,
    localSchemas: clone(app.project?.localSchemas), schemaBaseUrl: app.project?.schemaBaseUrl || null,
    schemaSettings: clone(schemaSettings), readingWitness: app.readingWitness || null,
    images: [...(app.pageImages || [])].map(([name, item]) => ({ name, blob: item.blob, type: item.type })),
  };
}

/** Capture without mutating the live collection or retaining mutable metadata. */
export function captureProjectDocuments(app, schemaSettings = null) {
  if (!app.state?.doc) return null;
  const previous = app.projectDocuments;
  const documents = (previous?.documents || []).map((entry) => ({ ...entry }));
  const index = documents.findIndex((entry) => entry.id === previous?.activeId);
  const active = snapshotProjectDocument(app, schemaSettings, documents[index]);
  if (index < 0) documents.push(active); else documents[index] = active;
  return restoreProjectDocuments({ version: PROJECT_DOCUMENTS_VERSION, activeId: active.id, documents });
}

/** Recovery never restores native handles, object URLs, or output authorizations. */
export function restoreProjectDocuments(snapshot) {
  if (snapshot == null) return null;
  if (snapshot.version !== PROJECT_DOCUMENTS_VERSION || !Array.isArray(snapshot.documents) || !snapshot.documents.length) {
    throw new Error("Unsupported project document snapshot.");
  }
  const ids = new Set(), names = new Set(), roles = new Set();
  const documents = snapshot.documents.map((entry) => {
    if (!entry || typeof entry.id !== "string" || !entry.id || ids.has(entry.id) || typeof entry.raw !== "string") {
      throw new Error("The project contains missing or duplicate document identities.");
    }
    ids.add(entry.id);
    const key = projectPathKey(entry.name);
    if (!/\.xml$/i.test(entry.name) || names.has(key)) throw new Error("The project contains duplicate or unsupported XML filenames.");
    names.add(key);
    const role = entry.role || null;
    if (role && (!["codex", "images", "registers"].includes(role) || roles.has(role))) {
      throw new Error("The project contains an ambiguous companion role.");
    }
    if (role) roles.add(role);
    if (entry.fileEncoding && (entry.fileEncoding.encoding !== "UTF-8" || typeof entry.fileEncoding.bom !== "boolean")) {
      throw new Error("The project contains unsupported XML encoding metadata.");
    }
    // Validate the declaration without allocating another full UTF-8 codex on each checkpoint.
    const declaration = entry.raw.match(/^\s*<\?xml\s+[^?]*\?>/i);
    if (declaration) encodeXmlBytes(declaration[0]);
    if (entry.images != null && !Array.isArray(entry.images)) throw new Error("Invalid project image collection.");
    const imageNames = new Set();
    const images = (entry.images || []).map((image) => {
      const imageKey = projectPathKey(image.name);
      if (image.name.includes("/") || imageNames.has(imageKey)) throw new Error("Project image filenames must be unique bare names.");
      imageNames.add(imageKey);
      if (!(image.blob instanceof Blob)) throw new Error("A project image has no recoverable bytes.");
      return { name: image.name, type: image.type || "", blob: image.blob };
    });
    const result = {
      id: entry.id, role, name: entry.name, raw: entry.raw,
      fileEncoding: { encoding: "UTF-8", bom: !!entry.fileEncoding?.bom }, dirty: !!entry.dirty,
      source: jsonCopy(entry.source), project: jsonCopy(entry.project), projectManifest: entry.projectManifest || null,
      localSchemas: clone(entry.localSchemas), schemaBaseUrl: entry.schemaBaseUrl || null,
      schemaSettings: clone(entry.schemaSettings), readingWitness: entry.readingWitness || null, images,
    };
    projectForSnapshot(result);
    return result;
  });
  if (!ids.has(snapshot.activeId)) throw new Error("The project's active document is missing.");
  return { version: PROJECT_DOCUMENTS_VERSION, activeId: snapshot.activeId, documents };
}

export function projectHasUnsavedDocuments(app) {
  return !!app.dirty || !!app.projectDocuments?.documents.some((entry) => entry.id !== app.projectDocuments.activeId && entry.dirty);
}

export function checkpointFromProjectDocuments(snapshot) {
  const projectDocuments = restoreProjectDocuments(snapshot);
  const active = projectDocuments.documents.find((entry) => entry.id === projectDocuments.activeId);
  return {
    ...active, id: crypto.randomUUID(), docName: active.name, savedAt: new Date().toISOString(),
    projectDocuments, staged: null,
  };
}
