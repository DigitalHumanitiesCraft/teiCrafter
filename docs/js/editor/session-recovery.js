/** Versioned local checkpoints. Completion means an IndexedDB transaction committed. */
import { loadDraft, clearDraft } from "./draft-recovery.js";

const DATABASE = "teicrafter.recovery";
const STORE = "sessions";
export const RECOVERY_VERSION = 1;

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
      await transaction("readwrite", (store) => store.put({ ...record, version: RECOVERY_VERSION }));
    },
    async list() {
      const records = await transaction("readonly", (store) => store.getAll());
      return records.filter((record) => record.version === RECOVERY_VERSION)
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
    projectManifest: app.project?.manifestSource || null,
    localSchemas: app.project?.localSchemas || null,
    schemaBaseUrl: app.project?.schemaBaseUrl || null,
    schemaSettings,
    savedAt: new Date().toISOString(),
    staged,
    images: [...(app.pageImages || [])].map(([name, item]) => ({ name, blob: item.blob, type: item.type })),
  };
}
