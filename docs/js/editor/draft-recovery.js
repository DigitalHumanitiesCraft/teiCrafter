/**
 * Unsaved-draft recovery across reloads.
 *
 * A plaintext-derived draft (loadPlaintextDraft, the project-folder text path)
 * exists only in memory until the first Save: a reload would lose it, including
 * any annotations made on it. This module persists exactly ONE such draft to
 * localStorage so the empty editor can offer to restore it after a reload.
 *
 * Scope and contract:
 *   - One slot only, under a single namespaced key. A new draft overwrites it.
 *   - The stored record is { raw, docName, sourceName, savedAt }; timestamps
 *     come from the caller (this module never reads the clock).
 *   - A restored project draft has NO directory handle anymore (handles do not
 *     survive a reload), so it restores as a handle-less draft and Save falls
 *     back to a download. The plaintext source file still exists on disk.
 *   - Storage access is injectable (defaults to window.localStorage) so the
 *     proof can run headless with a stub.
 *   - All storage failures (quota, privacy mode) are caught and reported as a
 *     false/null return, never thrown.
 */

export const DRAFT_KEY = "teicrafter.draftRecovery.v1";

// Drafts above this size are not persisted: they would risk the localStorage
// quota, and a document that large has a real file behind it anyway.
export const MAX_DRAFT_CHARS = 4_000_000;

function defaultStorage() {
  return typeof window !== "undefined" ? window.localStorage : null;
}

/**
 * Persist one draft slot. Returns true on success, false when the draft is too
 * large or storage is unavailable/refuses the write. Never throws.
 */
export function saveDraft({ raw, docName, sourceName, savedAt }, storage = defaultStorage()) {
  if (!storage) return false;
  if (typeof raw !== "string" || raw.length > MAX_DRAFT_CHARS) return false;
  const record = { raw, docName: docName || null, sourceName: sourceName || null, savedAt: savedAt || null };
  try {
    storage.setItem(DRAFT_KEY, JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}

/**
 * Return the parsed draft record, or null when none is stored. Corrupt JSON is
 * treated as no draft: the slot is cleared and null is returned.
 */
export function loadDraft(storage = defaultStorage()) {
  if (!storage) return null;
  let text;
  try {
    text = storage.getItem(DRAFT_KEY);
  } catch {
    return null;
  }
  if (text == null) return null;
  try {
    const record = JSON.parse(text);
    if (!record || typeof record.raw !== "string") { clearDraft(storage); return null; }
    return record;
  } catch {
    clearDraft(storage);
    return null;
  }
}

/** Remove the draft slot. Never throws. */
export function clearDraft(storage = defaultStorage()) {
  if (!storage) return;
  try {
    storage.removeItem(DRAFT_KEY);
  } catch {
    // a storage that refuses removal leaves the slot; nothing more we can do
  }
}
