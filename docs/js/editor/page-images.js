/**
 * teiCrafter Editor -- page-image store and resolution.
 *
 * The editor references page images by a surface's <graphic url>. This module
 * owns the bridge from that reference to a displayable URL and to durable bytes:
 *
 *   - an absolute http/data/blob URL passes through untouched;
 *   - a bare filename resolves against an in-memory store (app.pageImages),
 *     populated either by the text+image on-ramp (uploaded File objects) or by
 *     reading the files back from the open project folder.
 *
 * Images live in memory as object URLs until a Save into a project folder writes
 * them next to the TEI; reopening that folder resolves the filenames again, so a
 * saved edition shows its page images. Extracted from editor-app.js so the image
 * concern (which the facsimile roadmap will grow) stays in one cohesive place.
 *
 * Contract:
 *   createPageImages(ctx) -> { revoke, resolve, resolveFromFolder,
 *                              referencedNames, countUnpersisted, persist, fromUploads }
 *   ctx: { app, rerenderPanel() }   // app: shared editor state; rerenderPanel: re-render the active right panel
 *
 * Each store record is { url, blob, type, persisted }: url displays it, blob is
 * the bytes to write, persisted is true once the bytes are on disk (read back
 * from the folder, or written by a Save), so a later Save never rewrites them.
 */

// Graphic urls that need no store resolution (already loadable as-is).
const RE_ABSOLUTE_URL = /^(?:https?:|data:|blob:)/i;

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
      if (s.graphic && !RE_ABSOLUTE_URL.test(s.graphic)) names.add(s.graphic);
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
      try {
        const h = await dir.getFileHandle(name, { create: true });
        const w = await h.createWritable();
        await w.write(rec.blob);
        await w.close();
        rec.persisted = true;
        written++;
      } catch { failed++; }
    }
    return { written, failed };
  }

  /**
   * Resolve each surface's bare <graphic url> filename against the open project
   * folder: read the file, make an object URL, cache it (persisted, the bytes are
   * already on disk). Re-renders the facsimile when anything was found. Best
   * effort: a missing or unreadable file is skipped.
   */
  async function resolveFromFolder() {
    const dir = app.projectFolder && app.projectFolder.dir;
    if (!dir || !app.state) return;
    const wanted = new Set();
    for (const s of app.state.surfaces || []) {
      if (s.graphic && !RE_ABSOLUTE_URL.test(s.graphic) && !app.pageImages.has(s.graphic)) wanted.add(s.graphic);
    }
    let found = 0;
    for (const name of wanted) {
      try {
        const handle = await dir.getFileHandle(name);
        const file = await handle.getFile();
        app.pageImages.set(name, { url: URL.createObjectURL(file), blob: file, type: file.type || "", persisted: true });
        found++;
      } catch { /* not in the folder, or unreadable: leave it unresolved */ }
    }
    if (found && app.panel === "facs") rerenderPanel();
  }

  /** Build a store map from uploaded File objects (on-ramp), keyed by filename. */
  function fromUploads(images) {
    const map = new Map();
    for (const im of images) {
      map.set(im.name, { url: URL.createObjectURL(im.file), blob: im.file, type: im.type || "", persisted: false });
    }
    return map;
  }

  return { revoke, resolve, resolveFromFolder, referencedNames, countUnpersisted, persist, fromUploads };
}
