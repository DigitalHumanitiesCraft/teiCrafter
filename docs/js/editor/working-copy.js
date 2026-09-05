/** Portable, unvalidated editing state, including pending XML and image bytes. */
export async function encodeWorkingCopy(record) {
  const images = [];
  for (const item of record.images || []) {
    if (!(item.blob instanceof Blob)) continue;
    const bytes = new Uint8Array(await item.blob.arrayBuffer());
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 8192) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
    }
    images.push({ name: item.name, type: item.type, base64: btoa(binary) });
  }
  return JSON.stringify({ format: "teicrafter-working-copy", version: 1, record: { ...record, images } });
}

export function decodeWorkingCopy(text) {
  const data = JSON.parse(text);
  if (data.format !== "teicrafter-working-copy" || data.version !== 1 || typeof data.record?.raw !== "string") {
    throw new Error("This is not a supported teiCrafter working copy.");
  }
  const record = data.record;
  if (record.staged && (!['page', 'metadata', 'metadata-form', 'inline'].includes(record.staged.mode)
    || !Number.isInteger(record.staged.folio)
    || (record.staged.mode === 'metadata-form' ? !Array.isArray(record.staged.value)
      : record.staged.mode === 'inline' ? typeof record.staged.value?.core !== 'string' || typeof record.staged.cellId !== 'string'
        : typeof record.staged.value !== 'string'))) {
    throw new Error("The staged input in this working copy is invalid.");
  }
  const names = new Set();
  record.images = (record.images || []).map((item) => {
    // biome-ignore lint/suspicious/noControlCharactersInRegex: Reject NUL and path separators in imported image filenames.
    if (!item.name || /[\\/\x00]/.test(item.name) || ['.', '..'].includes(item.name) || names.has(item.name)) {
      throw new Error("The working copy contains an ambiguous image filename.");
    }
    names.add(item.name);
    const bytes = Uint8Array.from(atob(item.base64), (char) => char.charCodeAt(0));
    return { name: item.name, type: item.type, blob: new Blob([bytes], { type: item.type || "" }) };
  });
  record.id = crypto.randomUUID();
  return record;
}
