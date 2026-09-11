import { encodeXmlBytes, decodeXmlBytes } from "./file-encoding.js";
import { restoreProjectDocuments, projectPathKey } from "./project-documents.js";

const MANIFEST = "teicrafter-bundle.json";
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true });
const MAX_SIZE = 0x7fffffff;
const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = crcTable[(value ^ byte) & 255] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}
const sameBytes = (a, b) => a.length === b.length && a.every((byte, index) => byte === b[index]);

/** One ZIP, using only the portable, uncompressed ZIP32 format. */
function encodeZip(entries) {
  if (entries.length >= 65535) throw new Error("The project contains too many package files.");
  const records = entries.map(({ name, bytes }) => ({ name: textEncoder.encode(name), bytes, crc: crc32(bytes) }));
  let size = 22;
  for (const entry of records) {
    if (entry.name.length > 65535) throw new Error("A project filename is too long.");
    size += 76 + entry.name.length * 2 + entry.bytes.length;
  }
  if (size > MAX_SIZE) throw new Error("The project exceeds the supported package size.");
  const bytes = new Uint8Array(size), view = new DataView(bytes.buffer);
  const short = (offset, value) => view.setUint16(offset, value, true);
  const long = (offset, value) => view.setUint32(offset, value, true);
  let offset = 0;
  const offsets = [];
  for (const entry of records) {
    offsets.push(offset);
    long(offset, 0x04034b50); short(offset + 4, 20); short(offset + 6, 0x800);
    short(offset + 12, 33); long(offset + 14, entry.crc);
    long(offset + 18, entry.bytes.length); long(offset + 22, entry.bytes.length); short(offset + 26, entry.name.length);
    bytes.set(entry.name, offset + 30); bytes.set(entry.bytes, offset + 30 + entry.name.length);
    offset += 30 + entry.name.length + entry.bytes.length;
  }
  const directory = offset;
  for (const [index, entry] of records.entries()) {
    long(offset, 0x02014b50); short(offset + 4, 20); short(offset + 6, 20); short(offset + 8, 0x800);
    short(offset + 14, 33); long(offset + 16, entry.crc);
    long(offset + 20, entry.bytes.length); long(offset + 24, entry.bytes.length); short(offset + 28, entry.name.length);
    long(offset + 42, offsets[index]); bytes.set(entry.name, offset + 46);
    offset += 46 + entry.name.length;
  }
  long(offset, 0x06054b50); short(offset + 8, records.length); short(offset + 10, records.length);
  long(offset + 12, offset - directory); long(offset + 16, directory);
  return bytes;
}

/** Authorization remains outside the archive codec and covers every exact XML string. */
export async function createProjectBundle(input, ctx) {
  const snapshot = restoreProjectDocuments(input);
  if (!snapshot) throw new Error("There are no project documents to export.");
  const authorizations = [];
  function check() {
    if (ctx.signal?.aborted) throw new Error("Project export was cancelled.");
    if (!ctx.isCurrent() || authorizations.some(({ entry, token }) => !ctx.authorizationCurrent(entry, token))) {
      throw new Error("Project export blocked: documents, visible input or schema settings changed. Validate the current project again.");
    }
  }
  check();
  for (const entry of snapshot.documents) {
    const token = await ctx.authorize(entry);
    if (!token) throw new Error(`Project export blocked: ${entry.name} did not pass schema validation.`);
    authorizations.push({ entry, token });
    check();
  }
  const files = new Map();
  const add = (name, bytes) => {
    const key = projectPathKey(name);
    const previous = files.get(key);
    if (previous && (previous.name !== name || !sameBytes(previous.bytes, bytes))) throw new Error(`Conflicting package filename: ${name}`);
    if (!previous) files.set(key, { name, bytes });
  };
  const documents = [];
  for (const entry of snapshot.documents) {
    add(entry.name, encodeXmlBytes(entry.raw, entry.fileEncoding));
    const { raw: _raw, images: _images, ...metadata } = entry;
    const images = [];
    for (const image of entry.images) {
      const imageBytes = new Uint8Array(await image.blob.arrayBuffer());
      const head = new TextDecoder().decode(imageBytes.subarray(0, 256));
      if (/\.(?:xml|svg|xhtml)$/i.test(image.name) || /(?:\+xml|\/(?:xml|xhtml))\b/i.test(image.type)
        || /^\s*</.test(head) || (imageBytes[0] === 0xff && imageBytes[1] === 0xfe)
        || (imageBytes[0] === 0xfe && imageBytes[1] === 0xff)) {
        throw new Error("An image attachment cannot enter the package as unvalidated XML. Working copy retains these image bytes.");
      }
      const directory = entry.name.includes("/") ? entry.name.slice(0, entry.name.lastIndexOf("/") + 1) : "";
      const path = directory + image.name;
      add(path, imageBytes);
      check();
      images.push({ name: image.name, path, type: image.type });
    }
    documents.push({ ...metadata, images });
  }
  add(MANIFEST, textEncoder.encode(JSON.stringify({ format: "teicrafter-project-bundle", version: 1,
    projectDocuments: { version: snapshot.version, activeId: snapshot.activeId, documents } })));
  const bytes = encodeZip([...files.values()]);
  check();
  return { bytes, name: "teicrafter-project.zip", type: "application/zip" };
}

function decodeZip(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.length < 22 || bytes.length > MAX_SIZE) throw new Error("Unsupported project package size.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const short = (offset) => view.getUint16(offset, true), long = (offset) => view.getUint32(offset, true);
  const end = bytes.length - 22;
  if (long(end) !== 0x06054b50 || short(end + 4) || short(end + 6) || short(end + 20)
    || short(end + 8) !== short(end + 10)) throw new Error("Only teiCrafter's single-volume project ZIP format is supported.");
  const count = short(end + 10), start = long(end + 16);
  if (!count || count === 65535 || start + long(end + 12) !== end) throw new Error("Invalid project package directory.");
  const files = new Map(), keys = new Set();
  let offset = start, localOffset = 0;
  for (let index = 0; index < count; index++) {
    if (offset + 46 > end || long(offset) !== 0x02014b50 || short(offset + 6) !== 20
      || short(offset + 8) !== 0x800 || short(offset + 10) || short(offset + 30) || short(offset + 32)
      || short(offset + 34) || short(offset + 36) || long(offset + 38)) throw new Error("Unsupported or corrupt project ZIP entry.");
    const size = long(offset + 24), length = short(offset + 28), local = long(offset + 42), crc = long(offset + 16);
    if (size !== long(offset + 20) || offset + 46 + length > end || local !== localOffset
      || local + 30 > start || long(local) !== 0x04034b50 || short(local + 4) !== 20
      || short(local + 6) !== 0x800 || short(local + 8) || short(local + 28)
      || short(local + 26) !== length || long(local + 14) !== crc
      || long(local + 18) !== size || long(local + 22) !== size
      || local + 30 + length + size > start) throw new Error("The project ZIP entry sizes or offsets are invalid.");
    const nameBytes = bytes.subarray(offset + 46, offset + 46 + length);
    if (!sameBytes(nameBytes, bytes.subarray(local + 30, local + 30 + length))) throw new Error("The project ZIP filenames disagree.");
    const name = textDecoder.decode(nameBytes), key = projectPathKey(name);
    if (keys.has(key)) throw new Error("The project ZIP contains duplicate filenames.");
    keys.add(key);
    const data = bytes.subarray(local + 30 + length, local + 30 + length + size);
    if (crc32(data) !== crc) throw new Error(`The project ZIP checksum failed for ${name}.`);
    files.set(name, data);
    offset += 46 + length; localOffset = local + 30 + length + size;
  }
  if (offset !== end || localOffset !== start) throw new Error("The project ZIP contains unlisted data.");
  return files;
}

/** Decoding restores editing state; no validation authorization is imported. */
export function decodeProjectBundle(bytes) {
  const files = decodeZip(bytes), manifestBytes = files.get(MANIFEST);
  if (!manifestBytes) throw new Error("This ZIP is not a teiCrafter project package.");
  const metadata = JSON.parse(textDecoder.decode(manifestBytes));
  if (metadata.format !== "teicrafter-project-bundle" || metadata.version !== 1 || !Array.isArray(metadata.projectDocuments?.documents)) {
    throw new Error("Unsupported teiCrafter project package manifest.");
  }
  const used = new Set([MANIFEST]);
  for (const entry of metadata.projectDocuments.documents) {
    if (used.has(entry.name) || !files.has(entry.name)) throw new Error("The project package has missing or duplicate XML files.");
    used.add(entry.name);
    const decoded = decodeXmlBytes(files.get(entry.name));
    if (entry.fileEncoding?.encoding !== decoded.encoding || entry.fileEncoding?.bom !== decoded.bom) {
      throw new Error("The project's declared encoding disagrees with its XML bytes.");
    }
    entry.raw = decoded.text;
    entry.images = (entry.images || []).map((image) => {
      if (!files.has(image.path) || /\.xml$/i.test(image.path) || image.path === MANIFEST) throw new Error("The project package has an invalid image reference.");
      used.add(image.path);
      return { name: image.name, type: image.type, blob: new Blob([files.get(image.path)], { type: image.type || "" }) };
    });
  }
  if (used.size !== files.size) throw new Error("The project package contains unlisted files.");
  return restoreProjectDocuments(metadata.projectDocuments);
}
