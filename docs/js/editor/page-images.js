/**
 * teiCrafter Editor -- page-image store and resolution.
 *
 * The editor references page images by a surface's <graphic url>. This module
 * owns the bridge from that reference to a displayable URL and to durable bytes:
 *
 *   - an absolute http/data/blob URL passes through untouched;
 *   - a bare filename resolves against an in-memory store (app.pageImages),
 *     populated either by the text+image on-ramp (uploaded File objects) or by
 *     reading the files back from the open project folder or a separately
 *     attached local facsimile folder.
 *
 * Uploaded images live in memory as object URLs until a Save into a project
 * folder writes them next to the TEI. Images attached from a separate folder
 * stay read-only and are never copied by Save. Extracted from editor-app.js so
 * the image concern stays in one cohesive place.
 *
 * Contract:
 *   createPageImages(ctx) -> { revoke, resolve, resolveFromFolder, attachFolder,
 *                              supportsFolderAttachment, referencedNames,
 *                              countUnpersisted, persist, fromUploads }
 *   ctx: { app, rerenderPanel() }   // app: shared editor state; rerenderPanel: re-render the active right panel
 *
 * Each store record is { url, blob, type, persisted, external? }: url displays
 * it, blob is the bytes available to write, and persisted prevents a later Save
 * from rewriting files already on disk. external marks a separately attached
 * local source.
 */

import { existingFile, sameFileBytes } from "./file-target.js";

// Graphic urls that need no store resolution (already loadable as-is).
const RE_ABSOLUTE_URL = /^(?:https?:|data:|blob:)/i;
const isBareFilename = (value) => !!value
  && !RE_ABSOLUTE_URL.test(value)
  && !/[\\/]/.test(value);

export function createPageImages(ctx) {
  const { app, rerenderPanel } = ctx;

  /** Revoke every object URL and drop the map (no leaks across document switches). */
  function revoke() {
    for (const rec of app.pageImages.values()) {
      if (rec && rec.url) URL.revokeObjectURL(rec.url);
    }
    app.pageImages = new Map();
  }

  /**
   * A surface's <graphic url> as a displayable URL. An absolute URL passes
   * through; a filename in the in-memory store resolves to its object URL;
   * otherwise the raw filename is returned UNCHANGED, so the facsimile's own
   * tileSourceFor can still resolve it (a project profile rewriting it to a IIIF
   * tile source, e.g. the Wenzelsbibel, or a plain-image source). Null only when
   * the surface carries no graphic at all.
   */
  function resolve(surface) {
    if (!surface || !surface.graphic) return null;
    const g = surface.graphic;
    if (RE_ABSOLUTE_URL.test(g)) return g;
    const rec = app.pageImages.get(g);
    return rec ? rec.url : g;
  }

  /** Surface <graphic url> filenames the current document references (bare names). */
  function referencedNames() {
    const names = new Set();
    for (const s of (app.state && app.state.surfaces) || []) {
      if (isBareFilename(s.graphic)) names.add(s.graphic);
    }
    return names;
  }

  /** Referenced images held in memory but not yet on disk (a plain download loses these). */
  function countUnpersisted() {
    const referenced = referencedNames();
    let n = 0;
    for (const [name, rec] of app.pageImages) {
      if (rec && rec.blob && !rec.persisted && referenced.has(name)) n++;
    }
    return n;
  }

  /** Write referenced, not-yet-saved image blobs into the folder next to the TEI. */
  async function persist(dir) {
    if (!dir) return { written: 0, failed: 0 };
    const referenced = referencedNames();
    let written = 0, failed = 0;
    for (const [name, rec] of app.pageImages) {
      if (!rec || !rec.blob || rec.persisted || !referenced.has(name)) continue;
      let writable = null;
      try {
        const existing = await existingFile(dir, name);
        if (existing) {
          if (!await sameFileBytes(await existing.getFile(), rec.blob)) {
            throw new Error(`An image named ${name} already exists with different content.`);
          }
          rec.persisted = true;
          continue;
        }
        const h = await dir.getFileHandle(name, { create: true });
        if ((await h.getFile()).size !== 0) throw new Error(`${name} changed before it could be written.`);
        writable = await h.createWritable();
        await writable.write(rec.blob);
        await writable.close();
        writable = null;
        rec.persisted = true;
        written++;
      } catch {
        if (writable?.abort) { try { await writable.abort(); } catch { /* The original failure remains recoverable. */ } }
        failed++;
      }
    }
    return { written, failed };
  }

  /**
   * Resolve each surface's bare <graphic url> filename against the open project
   * folder: read the file, make an object URL, cache it (persisted, the bytes are
   * already on disk). Re-renders the facsimile when anything was found. Best
   * effort: a missing or unreadable file is skipped.
   */
  async function resolveFromDirectory(dir, replace = false, external = false) {
    const images = app.pageImages;
    const wanted = [...referencedNames()].filter((name) => replace || !app.pageImages.has(name));
    let found = 0;
    let changed = 0;
    const missing = [];
    for (const name of wanted) {
      const previous = app.pageImages.get(name);
      try {
        const handle = await dir.getFileHandle(name);
        const file = await handle.getFile();
        if (app.pageImages !== images) return { found, missing, requested: wanted.length };
        if (previous?.url) URL.revokeObjectURL(previous.url);
        app.pageImages.set(name, {
          url: URL.createObjectURL(file),
          blob: file,
          type: file.type || "",
          persisted: true,
          external,
        });
        found++;
        changed++;
      } catch {
        if (replace && previous?.external) {
          if (previous.url) URL.revokeObjectURL(previous.url);
          app.pageImages.delete(name);
          changed++;
        }
        missing.push(name);
      }
    }
    if (changed && app.panel === "facs") rerenderPanel();
    return { found, missing, requested: wanted.length };
  }

  /** Resolve bare graphic filenames beside a document opened from a project. */
  async function resolveFromFolder() {
    const dir = app.documentDirectory || (app.projectFolder && app.projectFolder.dir);
    if (!dir || !app.state) return { found: 0, missing: [], requested: 0 };
    return resolveFromDirectory(dir);
  }

  /** Whether this browser can grant read access to a separately chosen folder. */
  function supportsFolderAttachment() {
    const picker = typeof window === "undefined"
      ? null
      : /** @type {any} */ (window).showDirectoryPicker;
    return typeof picker === "function";
  }

  /**
   * Attach a read-only facsimile directory for this browser session. The files
   * become object URLs only; they are marked persisted so Save never copies them.
   */
  async function attachFolder() {
    if (!supportsFolderAttachment()) {
      return { supported: false, cancelled: false, found: 0, missing: [], requested: 0 };
    }
    let dir;
    try {
      const picker = /** @type {any} */ (window).showDirectoryPicker;
      dir = await picker({ mode: "read" });
    } catch (err) {
      if (err?.name === "AbortError") {
        return { supported: true, cancelled: true, found: 0, missing: [], requested: 0 };
      }
      throw err;
    }
    const result = await resolveFromDirectory(dir, true, true);
    return { supported: true, cancelled: false, folderName: dir.name || "selected folder", ...result };
  }

  /** Build a store map from uploaded File objects (on-ramp), keyed by filename. */
  function fromUploads(images) {
    const map = new Map();
    for (const im of images) {
      map.set(im.name, { url: URL.createObjectURL(im.file), blob: im.file, type: im.type || "", persisted: false });
    }
    return map;
  }

  return {
    revoke,
    resolve,
    resolveFromFolder,
    attachFolder,
    supportsFolderAttachment,
    referencedNames,
    countUnpersisted,
    persist,
    fromUploads,
  };
}
