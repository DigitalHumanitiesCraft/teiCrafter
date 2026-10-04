/**
 * Opening and saving XML files in the browser. File System Access handles are
 * used where the browser exposes them (Chromium); everywhere else a file input
 * opens and a download saves, so the portable path never depends on handles.
 * Bytes cross this boundary only through file-encoding.js, which enforces the
 * UTF-8 contract and restores a BOM the file had when it was opened.
 */
import { decodeXmlBytes, encodeXmlBytes } from "../core/file-encoding.js";

// The File System Access API is not in TypeScript's DOM library; these are the parts used here.
interface PickerType {
  description: string;
  accept: Record<string, string[]>;
}
interface PickerWindow {
  showOpenFilePicker?(options: { types: PickerType[]; excludeAcceptAllOption?: boolean; multiple?: boolean }): Promise<FileSystemFileHandle[]>;
  showSaveFilePicker?(options: { suggestedName?: string; types: PickerType[] }): Promise<FileSystemFileHandle>;
}
interface HandleItem {
  getAsFileSystemHandle?(): Promise<FileSystemHandle | null>;
}

export interface FileVersion {
  size: number;
  lastModified: number;
}

export interface OpenedXml extends FileVersion {
  text: string;
  bom: boolean;
  name: string;
  handle: FileSystemFileHandle | null;
}

export interface OpenedText {
  text: string;
  name: string;
}

/** What a save needs to know about the document's file. Version fields are those recorded at open or last save. */
export interface SaveTarget {
  name: string;
  bom: boolean;
  handle?: FileSystemFileHandle | null;
  size?: number;
  lastModified?: number;
}

export type SaveResult =
  | ({ method: "handle" | "picker"; handle: FileSystemFileHandle } & FileVersion)
  | { method: "download" };

/** Raised when the file behind a handle changed after it was opened; nothing was written. */
export class ExternalChangeError extends Error {
  override name = "ExternalChangeError";
}

const XML_TYPES: PickerType[] = [{
  description: "XML files",
  accept: { "application/xml": [".xml"], "text/xml": [".xml"] },
}];
const TEXT_TYPES: PickerType[] = [{
  description: "Text files",
  accept: { "text/plain": [".txt"], "text/markdown": [".md"] },
}];
const XML_ACCEPT = ".xml,application/xml,text/xml";
const TEXT_ACCEPT = ".txt,.md,text/plain,text/markdown";
const XML_NAME = /\.xml$/i;
const TEXT_NAME = /\.(txt|md)$/i;

const pickerWindow = (): PickerWindow => (typeof window === "undefined" ? {} : (window as unknown as PickerWindow));

/** Feature flags for the shell; handle-based controls appear only when these are true. */
export function fileCapabilities(): { openPicker: boolean; savePicker: boolean; dropHandles: boolean } {
  const w = pickerWindow();
  return {
    openPicker: typeof w.showOpenFilePicker === "function",
    savePicker: typeof w.showSaveFilePicker === "function",
    dropHandles: typeof DataTransferItem !== "undefined" && "getAsFileSystemHandle" in DataTransferItem.prototype,
  };
}

export function fileVersion(file: File): FileVersion {
  return { size: Number(file.size), lastModified: Number(file.lastModified) };
}

const isAbort = (error: unknown) => error instanceof DOMException && error.name === "AbortError";

/** Decode an XML file; encoding rejections propagate with their message from file-encoding.js. */
export async function decodeXmlFile(file: File, handle: FileSystemFileHandle | null = null): Promise<OpenedXml> {
  const { text, bom } = decodeXmlBytes(await file.arrayBuffer());
  return { text, bom, name: file.name, handle, ...fileVersion(file) };
}

/** Plaintext is decoded as strict UTF-8 so a wrongly encoded file is refused rather than silently altered. */
export async function decodeTextFile(file: File): Promise<OpenedText> {
  try {
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer()), name: file.name };
  } catch (error) {
    throw new TypeError(`${file.name} is not valid UTF-8 text.`, { cause: error });
  }
}

function pickWithInput(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.hidden = true;
    const done = (file: File | null) => {
      input.remove();
      resolve(file);
    };
    input.addEventListener("change", () => done(input.files?.[0] ?? null), { once: true });
    input.addEventListener("cancel", () => done(null), { once: true });
    document.body.append(input);
    input.click();
  });
}

/**
 * Let the user pick one file. Resolves null when the user cancels. A picker
 * that fails before yielding a file falls back to the file input.
 */
async function pickFile(types: PickerType[], accept: string): Promise<{ file: File; handle: FileSystemFileHandle | null } | null> {
  const w = pickerWindow();
  if (w.showOpenFilePicker) {
    let handle: FileSystemFileHandle | undefined;
    try {
      [handle] = await w.showOpenFilePicker({ types, excludeAcceptAllOption: false, multiple: false });
    } catch (error) {
      if (isAbort(error)) return null;
    }
    if (handle) return { file: await handle.getFile(), handle };
  }
  const file = await pickWithInput(accept);
  return file ? { file, handle: null } : null;
}

/** Pick and decode an XML file. Null on cancel; throws the encoding rejection message. */
export async function openXmlFile(): Promise<OpenedXml | null> {
  const picked = await pickFile(XML_TYPES, XML_ACCEPT);
  return picked ? decodeXmlFile(picked.file, picked.handle) : null;
}

/** Pick and decode a .txt or .md file. Null on cancel. */
export async function openTextFile(): Promise<OpenedText | null> {
  const picked = await pickFile(TEXT_TYPES, TEXT_ACCEPT);
  return picked ? decodeTextFile(picked.file) : null;
}

/** True when a drag event carries files; the shell uses it to show its drop overlay and preventDefault. */
export function dragCarriesFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes("Files");
}

/**
 * The first dropped file and, where available, its handle. Call this
 * synchronously inside the drop handler: a DataTransferItem is live only
 * during the event, so the handle request starts before the first await.
 */
export async function fileFromDrop(event: DragEvent): Promise<{ file: File; handle: FileSystemFileHandle | null; kind: "xml" | "text" | "other" } | null> {
  const transfer = event.dataTransfer;
  const file = transfer?.files?.[0];
  if (!file) return null;
  const item = transfer.items?.[0] as (DataTransferItem & HandleItem) | undefined;
  const pending = item?.getAsFileSystemHandle ? item.getAsFileSystemHandle().catch(() => null) : Promise.resolve(null);
  const found = await pending;
  const handle = found?.kind === "file" ? (found as FileSystemFileHandle) : null;
  const kind = XML_NAME.test(file.name) ? "xml" : TEXT_NAME.test(file.name) ? "text" : "other";
  return { file, handle, kind };
}

/** Request a browser download. This cannot establish a durable savepoint. */
export function downloadFile(data: Uint8Array | string, name: string, type: string): void {
  const url = URL.createObjectURL(new Blob([data as BlobPart], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

async function writeHandle(handle: FileSystemFileHandle, bytes: Uint8Array): Promise<FileVersion> {
  const writer = await handle.createWritable();
  try {
    await writer.write(bytes as BufferSource);
    await writer.close();
  } catch (error) {
    await writer.abort().catch(() => {});
    throw error;
  }
  return fileVersion(await handle.getFile());
}

/**
 * Save the raw XML. With a writable handle the file is written in place after
 * an external-change check against the recorded version; without one a save
 * picker is offered where available, else the browser downloads the file.
 * Resolves null when the user cancels the save picker. The returned handle
 * and version become the new target for the next save.
 */
export async function saveXml(target: SaveTarget, raw: string): Promise<SaveResult | null> {
  const bytes = encodeXmlBytes(raw, { bom: target.bom });
  const handle = target.handle;
  if (handle && typeof handle.createWritable === "function") {
    let current: FileVersion;
    try {
      current = fileVersion(await handle.getFile());
    } catch (error) {
      throw new ExternalChangeError(
        `Save blocked: ${target.name} could not be checked for external changes (${(error as Error).message}). Download a copy or reopen the file.`,
        { cause: error },
      );
    }
    if (target.size === undefined || target.lastModified === undefined
      || current.size !== target.size || current.lastModified !== target.lastModified) {
      throw new ExternalChangeError(
        `Save blocked: ${target.name} changed outside teiCrafter since it was opened. Download a copy or reopen the file before saving in place.`,
      );
    }
    return { method: "handle", handle, ...(await writeHandle(handle, bytes)) };
  }
  const w = pickerWindow();
  if (w.showSaveFilePicker) {
    let picked: FileSystemFileHandle;
    try {
      picked = await w.showSaveFilePicker({ suggestedName: target.name, types: XML_TYPES });
    } catch (error) {
      if (isAbort(error)) return null;
      throw error;
    }
    return { method: "picker", handle: picked, ...(await writeHandle(picked, bytes)) };
  }
  downloadFile(bytes, target.name, "application/xml;charset=UTF-8");
  return { method: "download" };
}
