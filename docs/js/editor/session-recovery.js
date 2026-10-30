/** Versioned local checkpoints. Completion means an IndexedDB transaction committed. */
import { loadDraft, clearDraft } from "./draft-recovery.js";
import { captureProjectDocuments } from "./project-documents.js";

const DATABASE = "teicrafter.recovery";
const STORE = "sessions";
export const RECOVERY_VERSION = 2;
// Version 1 stored every XML text as a string; version 2 stores each text once as a UTF-8 Blob.
const READABLE_VERSIONS = new Set([1, 2]);
const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

/**
 * A UTF-8 Blob keeps the structured-clone value small, which a browser's per-value limit
 * requires for a large codex. A text with an unpaired surrogate has no UTF-8 form, and a
 * Blob would replace it with U+FFFD, so that text stays a string.
 * @param {string} text
 */
function storedText(text) {
  return /** @type {any} */ (text).isWellFormed() ? new Blob([text], { type: "application/xml" }) : text;
}

/** The BOM is kept because a leading U+FEFF belongs to the text, not to the storage. */
async function readText(value) {
  if (typeof value === "string") return value;
  if (value instanceof Blob) return decoder.decode(await value.arrayBuffer());
  throw new Error("The recovery checkpoint contains no readable XML.");
}

/** The active project document shares the checkpoint's text instead of storing it again. */
export function storeCheckpoint(record) {
  const project = record.projectDocuments;
  return {
    ...record, version: RECOVERY_VERSION, raw: storedText(record.raw),
    projectDocuments: project && {
      ...project,
      documents: project.documents.map((entry) => ({
        ...entry, raw: entry.id === project.activeId && entry.raw === record.raw ? null : storedText(entry.raw),
      })),
    },
  };
}

/** Return a stored checkpoint of either version with every XML text as a string. */
export async function readCheckpoint(record) {
  const raw = await readText(record.raw);
  const project = record.projectDocuments;
  const documents = project && await Promise.all(project.documents.map(async (entry) => ({
    ...entry, raw: entry.raw == null && entry.id === project.activeId ? raw : await readText(entry.raw),
  })));
  return { ...record, raw, projectDocuments: project && { ...project, documents } };
}

/** Copy a captured checkpoint for queueing; XML strings are immutable and are shared, not copied. */
export function detachCheckpoint(record) {
  const project = record.projectDocuments;
  const copy = structuredClone({
    ...record, raw: null,
    projectDocuments: project && { ...project, documents: project.documents.map((entry) => ({ ...entry, raw: null })) },
  });
  copy.raw = record.raw;
  copy.projectDocuments?.documents.forEach((entry, index) => { entry.raw = project.documents[index].raw; });
  return copy;
}

export function createRecoveryStore(factory = globalThis.indexedDB) {
  /** @type {Promise<IDBDatabase>|null} */
  let connection = null;
  const open = () => {
    if (!factory) return Promise.reject(new Error("Local recovery storage is unavailable in this browser."));
    if (!connection) connection = new Promise((resolve, reject) => {
      const request = factory.open(DATABASE, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("Close older teiCrafter tabs to enable local recovery."));
    }).catch((error) => { connection = null; throw error; });
    return connection;
  };
  /** @returns {Promise<any>} */
  const transaction = async (mode, action) => {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = action(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = () => reject(tx.error || new Error("Recovery write was interrupted."));
      tx.onerror = () => reject(tx.error || request.error);
    });
  };
  return {
    async put(record) {
      if (!record?.id || typeof record.raw !== "string") throw new TypeError("Invalid recovery checkpoint.");
      const stored = storeCheckpoint(record);
      await transaction("readwrite", (store) => store.put(stored));
    },
    async list() {
      const records = await transaction("readonly", (store) => store.getAll());
      return records.filter((record) => READABLE_VERSIONS.has(record.version))
        .sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
    },
    async remove(id) { await transaction("readwrite", (store) => store.delete(id)); },
  };
}

export async function migrateLegacyDraft(store, storage) {
  const legacy = loadDraft(storage);
  if (!legacy) return;
  await store.put({ ...legacy, id: "legacy-draft", source: { kind: "draft", txtName: legacy.sourceName }, images: [] });
  clearDraft(storage);
}

/** Object URLs and native handles are deliberately recreated or reacquired on restore. */
export function captureCheckpoint(app, staged = null, schemaSettings = null) {
  return {
    id: app.recoveryId,
    raw: app.state.doc.raw,
    docName: app.docName,
    source: app.source,
    fileEncoding: app.fileEncoding,
    dirty: !!app.dirty,
    readingWitness: app.readingWitness || null,
    project: app.project ? JSON.parse(JSON.stringify(app.project)) : null,
    projectManifest: app.project?.manifestSource || null,
    localSchemas: app.project?.localSchemas || null,
    schemaBaseUrl: app.project?.schemaBaseUrl || null,
    schemaSettings,
    projectDocuments: app.projectDocuments ? captureProjectDocuments(app, schemaSettings) : null,
    savedAt: new Date().toISOString(),
    staged,
    images: [...(app.pageImages || [])].map(([name, item]) => ({ name, blob: item.blob, type: item.type })),
  };
}
