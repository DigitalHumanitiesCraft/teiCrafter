/** Portable, unvalidated editing state, including pending XML and image bytes. */
import { restoreProjectDocuments } from "./project-documents.js";

async function encodeImages(items) {
  const images = [];
  for (const item of items || []) {
    if (!(item.blob instanceof Blob)) continue;
    const bytes = new Uint8Array(await item.blob.arrayBuffer());
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 8192) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
    }
    images.push({ name: item.name, type: item.type, base64: btoa(binary) });
  }
  return images;
}

export async function encodeWorkingCopy(record) {
  const snapshot = structuredClone(record);
  const project = restoreProjectDocuments(snapshot.projectDocuments);
  if (project) {
    for (const entry of project.documents) {
      if (entry.id === project.activeId) { delete entry.raw; delete entry.images; }
      else entry.images = await encodeImages(entry.images);
    }
  }
  return JSON.stringify({ format: "teicrafter-working-copy", version: 2,
    record: { ...snapshot, projectDocuments: project, images: await encodeImages(snapshot.images) } });
}

export function decodeWorkingCopy(text) {
  const data = JSON.parse(text);
  if (data.format !== "teicrafter-working-copy" || ![1, 2].includes(data.version) || typeof data.record?.raw !== "string") {
    throw new Error("This is not a supported teiCrafter working copy.");
  }
  const record = data.record;
  if (record.staged && (!['page', 'metadata', 'metadata-form', 'inline', 'wenzels', 'witness', 'entries'].includes(record.staged.mode)
    || !Number.isInteger(record.staged.folio)
    || (record.staged.mode === 'witness' ? typeof record.staged.value?.selected !== 'string'
      || typeof record.staged.value?.creating !== 'boolean' || !plainFields(record.staged.value?.fields)
      : record.staged.mode === 'entries' ? !['detail', 'create', 'batch'].includes(record.staged.value?.section)
      || typeof record.staged.value?.selected !== 'string' || !['dictionary', 'articles'].includes(record.staged.value?.kind)
      || !plainFields(record.staged.value?.fields) || !Array.isArray(record.staged.value?.targets)
      || record.staged.value.targets.some((id) => typeof id !== 'string')
      : record.staged.mode === 'wenzels' ? typeof record.staged.value?.section !== 'string'
      || !record.staged.value?.fields || typeof record.staged.value.fields !== 'object' || Array.isArray(record.staged.value.fields)
      : record.staged.mode === 'metadata-form' ? !Array.isArray(record.staged.value)
      : record.staged.mode === 'inline' ? typeof record.staged.value?.core !== 'string' || typeof record.staged.cellId !== 'string'
        : typeof record.staged.value !== 'string'))) {
    throw new Error("The staged input in this working copy is invalid.");
  }
  record.images = decodeImages(record.images);
  if (record.projectDocuments) {
    if (!Array.isArray(record.projectDocuments.documents)) throw new Error("Invalid project document collection.");
    for (const entry of record.projectDocuments.documents) {
      if (data.version === 2 && entry.id === record.projectDocuments.activeId && entry.raw == null) {
        entry.raw = record.raw; entry.images = record.images;
      } else entry.images = decodeImages(entry.images);
    }
    record.projectDocuments = restoreProjectDocuments(record.projectDocuments);
    const active = record.projectDocuments.documents.find((entry) => entry.id === record.projectDocuments.activeId);
    if (active.raw !== record.raw || active.name !== record.docName) throw new Error("The working copy's active document is inconsistent.");
  }
  record.id = crypto.randomUUID();
  return record;
}

const plainFields = (value) => !!value && typeof value === "object" && !Array.isArray(value);

function decodeImages(items) {
  const names = new Set();
  if (items != null && !Array.isArray(items)) throw new Error("The working copy's image collection is invalid.");
  return (items || []).map((item) => {
    const key = typeof item.name === "string" ? item.name.normalize("NFC").toLowerCase() : "";
    // biome-ignore lint/suspicious/noControlCharactersInRegex: Reject NUL and path separators in imported image filenames.
    if (!key || /[\\/\x00]/.test(item.name) || ['.', '..'].includes(item.name) || names.has(key)) {
      throw new Error("The working copy contains an ambiguous image filename.");
    }
    names.add(key);
    const bytes = Uint8Array.from(atob(item.base64), (char) => char.charCodeAt(0));
    return { name: item.name, type: item.type, blob: new Blob([bytes], { type: item.type || "" }) };
  });
}
