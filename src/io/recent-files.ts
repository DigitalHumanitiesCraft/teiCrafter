/**
 * Recently opened files as persisted FileSystemFileHandle records in
 * IndexedDB, so the empty state can reopen a daily file without the picker.
 * Chromium-only by nature; elsewhere `recentFilesSupported` is false and the
 * list does not appear. Records are keyed by name, so reopening a file
 * refreshes its timestamp instead of duplicating it. Handles survive sessions;
 * permission is requested again on reopen, which needs a user gesture.
 */
import { decodeXmlFile, type OpenedXml } from "./open-save";

export interface RecentFile {
  name: string;
  when: number;
  handle: FileSystemFileHandle;
}

// Permission queries on handles are not in TypeScript's DOM library.
interface PermissionHandle {
  queryPermission?(descriptor: { mode: "read" | "readwrite" }): Promise<PermissionState>;
  requestPermission?(descriptor: { mode: "read" | "readwrite" }): Promise<PermissionState>;
}

const DB_NAME = "teicrafter";
const STORE = "recent-files";
const MAX = 5;

export const recentFilesSupported = typeof window !== "undefined" && "showOpenFilePicker" in window && "indexedDB" in window;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: "name" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function run<T>(db: IDBDatabase, mode: IDBTransactionMode, body: (store: IDBObjectStore) => IDBRequest<T> | undefined): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const request = body(transaction.objectStore(STORE));
    transaction.oncomplete = () => resolve(request ? request.result : undefined);
    transaction.onerror = () => reject(transaction.error);
  });
}

/** All records, most recent first. Recents are a convenience, so any failure yields an empty list. */
export async function listRecents(): Promise<RecentFile[]> {
  if (!recentFilesSupported) return [];
  try {
    const db = await openDb();
    const all = (await run<RecentFile[]>(db, "readonly", (store) => store.getAll())) ?? [];
    db.close();
    return all.sort((a, b) => b.when - a.when);
  } catch {
    return [];
  }
}

/** Remember or refresh a handle and trim the store to the newest MAX records. */
export async function rememberRecent(handle: FileSystemFileHandle, name: string): Promise<void> {
  if (!recentFilesSupported || !handle) return;
  try {
    const db = await openDb();
    await run(db, "readwrite", (store) => store.put({ name, when: Date.now(), handle }));
    const all = (await run<RecentFile[]>(db, "readonly", (store) => store.getAll())) ?? [];
    const stale = all.sort((a, b) => b.when - a.when).slice(MAX);
    if (stale.length) await run(db, "readwrite", (store) => {
      for (const record of stale) store.delete(record.name);
      return undefined;
    });
    db.close();
  } catch {
    // A failed bookkeeping write must never block opening the file itself.
  }
}

export async function forgetRecent(name: string): Promise<void> {
  if (!recentFilesSupported) return;
  try {
    const db = await openDb();
    await run(db, "readwrite", (store) => store.delete(name));
    db.close();
  } catch {
    // See rememberRecent.
  }
}

/**
 * Reopen a recent file with read-write permission so it can be saved in place.
 * A denied permission throws without touching the list; a dead handle (moved
 * or deleted file) is forgotten before the error propagates.
 */
export async function reopenRecent(record: RecentFile): Promise<OpenedXml> {
  const handle = record.handle as FileSystemFileHandle & PermissionHandle;
  let permission = (await handle.queryPermission?.({ mode: "readwrite" })) ?? "granted";
  if (permission !== "granted") permission = (await handle.requestPermission?.({ mode: "readwrite" })) ?? "denied";
  if (permission !== "granted") throw new Error(`Permission to reopen ${record.name} was not granted.`);
  let file: File;
  try {
    file = await handle.getFile();
  } catch (error) {
    await forgetRecent(record.name);
    throw new Error(`Could not reopen ${record.name} (${(error as Error).message}); it was removed from the recent list.`, { cause: error });
  }
  return decodeXmlFile(file, record.handle);
}
