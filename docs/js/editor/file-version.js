/** Minimal optimistic-concurrency metadata for File System Access handles. */

export function fileVersion(file) {
  return { size: Number(file.size), lastModified: Number(file.lastModified) };
}

export function fileVersionChanged(opened, current) {
  if (!opened || !current) return false;
  return Number(opened.size) !== Number(current.size)
    || Number(opened.lastModified) !== Number(current.lastModified);
}
