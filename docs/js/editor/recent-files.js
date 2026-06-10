/**
 * Recent files: persisted FileSystemFileHandle records in IndexedDB, so the
 * welcome screen can reopen the editions the user works on daily without the
 * picker. Chromium-only by nature (File System Access API); everywhere else
 * `supported` is false and the welcome screen simply shows no Recent section.
 *
 * Records are { name, when, handle }, keyed by name (reopening the same file
 * updates its timestamp instead of duplicating the row). Handles stay valid
 * across sessions; permission is re-requested on click (a user gesture).
 */

const DB_NAME = "teicrafter";
const STORE = "recent-files";
const MAX = 5;

export const supported =
  typeof window !== "undefined" && "showOpenFilePicker" in window && "indexedDB" in window;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: "name" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const out = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(out && "result" in out ? out.result : undefined);
    t.onerror = () => reject(t.error);
  });
}

/** All records, most recent first. Returns [] when anything fails. */
export async function listRecents() {
  if (!supported) return [];
  try {
    const db = await openDb();
    const all = await tx(db, "readonly", (store) => store.getAll());
    db.close();
    return (all || []).sort((a, b) => b.when - a.when);
  } catch {
    return [];
  }
}

/** Remember (or refresh) a handle; trims the store to the MAX newest. */
export async function rememberRecent(handle, name) {
  if (!supported || !handle) return;
  try {
    const db = await openDb();
    await tx(db, "readwrite", (store) => store.put({ name, when: Date.now(), handle }));
    const all = await tx(db, "readonly", (store) => store.getAll());
    const stale = (all || []).sort((a, b) => b.when - a.when).slice(MAX);
    if (stale.length) {
      await tx(db, "readwrite", (store) => { for (const r of stale) store.delete(r.name); });
    }
    db.close();
  } catch {
    /* recents are a convenience, never an error path */
  }
}

export async function forgetRecent(name) {
  if (!supported) return;
  try {
    const db = await openDb();
    await tx(db, "readwrite", (store) => store.delete(name));
    db.close();
  } catch {
    /* see above */
  }
}
