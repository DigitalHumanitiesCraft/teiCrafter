/** Local file creation and content comparison, independent of editor state. */
export async function existingFile(dir, name) {
  try { return await dir.getFileHandle(name); }
  catch (error) {
    if (error?.name === "NotFoundError") return null;
    throw error;
  }
}

export async function createUnusedFile(dir, desired) {
  if (!desired || /[\\/]/.test(desired) || desired === "." || desired === "..") {
    throw new Error("Choose a filename in the selected folder.");
  }
  const dot = desired.lastIndexOf(".");
  const stem = dot > 0 ? desired.slice(0, dot) : desired;
  const extension = dot > 0 ? desired.slice(dot) : "";
  for (let index = 0; index < 1000; index++) {
    const name = index ? `${stem} (${index})${extension}` : desired;
    if (await existingFile(dir, name)) continue;
    const handle = await dir.getFileHandle(name, { create: true });
    const file = await handle.getFile();
    if (file.size !== 0) throw new Error(`${name} was created by another writer. Save again to choose a new name.`);
    return { name, handle, file };
  }
  throw new Error("No free filename was found. Choose a different document name.");
}

export async function sameFileBytes(left, right) {
  if (left.size !== right.size) return false;
  const [a, b] = await Promise.all([left.arrayBuffer(), right.arrayBuffer()]);
  const x = new Uint8Array(a), y = new Uint8Array(b);
  return x.length === y.length && x.every((value, index) => value === y[index]);
}
