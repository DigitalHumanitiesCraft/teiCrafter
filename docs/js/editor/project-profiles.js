/**
 * teiCrafter Editor -- built-in project profiles.
 *
 * Precursor of the declarative project manifest (teicrafter.project.json,
 * decision 2026-06-10): a profile is detected from the loaded document itself
 * (its publicationStmt PID) and currently contributes one thing, an image
 * resolver that turns a surface's <graphic url> into an OpenSeadragon tile
 * source. The Wenzelsbibel codex references its page images by bare filename
 * (e.g. "00000010.jpg") while the ÖNB serves them through the IIIF Image API
 * as .jp2; the resolver maps filename -> info.json URL so OSD deep-zooms real
 * tiles instead of fetching one enormous plain jpg. When the manifest lands
 * (WB-AP3 / M2.9 "Open project folder"), a manifest entry populates the same
 * shape; PID detection stays the fallback for bare files opened without a
 * project folder.
 *
 * Pure module: imports only tei-document.js, touches no DOM, mutates nothing.
 */

import { firstByLocal, elementsByLocal, getAttr, decodeEntities } from "./tei-document.js";

const PROFILES = [
  {
    id: "wenzelsbibel",
    name: "Wenzelsbibel (Codex 2759)",
    pidPattern: /^o:wen\./,
    // {stem} is the graphic filename without its extension. OpenSeadragon
    // accepts the info.json URL string directly as a IIIF tile source.
    iiifImageTemplate: "https://iiif.onb.ac.at/images/REPO/8977428/{stem}.jp2/info.json",
  },
];

/** The document's PID: <publicationStmt>/<idno type="PID">, or null. */
export function readPid(doc) {
  const header = firstByLocal(doc.root, "teiHeader");
  if (!header) return null;
  for (const idno of elementsByLocal(header, "idno")) {
    if (getAttr(idno, "type") !== "PID") continue;
    if (idno.contentStart == null) continue;
    const pid = decodeEntities(doc.raw.slice(idno.contentStart, idno.contentEnd)).trim();
    if (pid) return pid;
  }
  return null;
}

/** Detect the built-in profile for a loaded document, or null. */
export function detectProject(doc) {
  const pid = readPid(doc);
  if (!pid) return null;
  return PROFILES.find((p) => p.pidPattern.test(pid)) || null;
}

/**
 * Resolve a <graphic url> to a tile source under a project profile, or null
 * when the profile does not apply (the caller falls back to the plain image).
 * Only bare image filenames are rewritten; absolute URLs resolve themselves.
 */
export function projectTileSource(project, imageUrl) {
  if (!project || !project.iiifImageTemplate || !imageUrl) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(imageUrl)) return null; // absolute URL (http:, https:, data:)
  const m = /^([^/\\]+)\.(jpe?g|png|tiff?)$/i.exec(imageUrl.trim());
  if (!m) return null;
  return project.iiifImageTemplate.replace("{stem}", m[1]);
}

// ---- IIIF Presentation manifest (page image + canvas size per canvas) -------

/**
 * The filename stem of an image URL: last path segment without query, hash or
 * extension. A IIIF Image API URL ends in a generic quality file
 * (.../{identifier}/{region}/{size}/{rotation}/default.jpg), so when the last
 * segment is that generic name the identifier segment is taken instead, since
 * that is what a <graphic url> filename would carry.
 */
function urlStem(url) {
  if (typeof url !== "string") return "";
  const path = url.split(/[?#]/)[0];
  const segments = path.split(/[/\\]/).filter(Boolean);
  let base = segments[segments.length - 1] || "";
  base = base.replace(/\.[^.]+$/, "");
  // IIIF Image API quality token: fall back to the {identifier} segment.
  if (/^(default|native|color|gray|bitonal)$/i.test(base) && segments.length >= 5) {
    base = segments[segments.length - 5].replace(/\.[^.]+$/, "");
  }
  return base;
}

/**
 * The single content URL of an IIIF resource body. v2 uses a plain "@id"; v3
 * uses "id". A IIIF Image API service may also expose a base "@id"/"id", but
 * the body's own id is the direct image URL, so it is preferred.
 */
function bodyImageUrl(body) {
  if (!body || typeof body !== "object") return null;
  const direct = body.id || body["@id"];
  return typeof direct === "string" && direct ? direct : null;
}

/** One canvas -> { id, label, stem, imageUrl, canvasWidth, canvasHeight } or null. */
function canvasEntry(canvas, body) {
  if (!canvas || typeof canvas !== "object") return null;
  const imageUrl = bodyImageUrl(body);
  if (!imageUrl) return null;
  const id = canvas.id || canvas["@id"] || null;
  let label = canvas.label;
  if (label && typeof label === "object") {
    // v3 language map { "en": ["..."] } or { "none": ["..."] }: take the first value.
    const first = Object.values(label)[0];
    label = Array.isArray(first) ? first[0] : first;
  }
  if (typeof label !== "string") label = null;
  const w = Number(canvas.width);
  const h = Number(canvas.height);
  return {
    id,
    label,
    stem: urlStem(imageUrl) || (id ? urlStem(id) : ""),
    imageUrl,
    canvasWidth: Number.isFinite(w) && w > 0 ? w : null,
    canvasHeight: Number.isFinite(h) && h > 0 ? h : null,
  };
}

/**
 * Parse a IIIF Presentation manifest (already-parsed JSON object) into a map
 * keyed by canvas id, label and image stem (each pointing at the same entry,
 * so a <graphic url> filename, a canvas id, or a label all resolve), plus an
 * ordered "canvases" array. Pure: no fetch, no DOM. Handles v2
 * (sequences[].canvases[].images[].resource) and v3 (items[].items[].items[].body)
 * minimally; canvases without a resolvable image are skipped, not fatal.
 *
 * Returns { version, canvases: [entry...], byKey: Map }. version is 2, 3 or null.
 */
export function parseIiifPresentationManifest(manifestJson) {
  const out = { version: null, canvases: [], byKey: new Map() };
  if (!manifestJson || typeof manifestJson !== "object") return out;

  const rawCanvases = [];
  if (Array.isArray(manifestJson.sequences)) {
    // v2: top-level "sequences", each with "canvases", each canvas with "images".
    out.version = 2;
    for (const seq of manifestJson.sequences) {
      for (const c of (seq && Array.isArray(seq.canvases) ? seq.canvases : [])) {
        const img = Array.isArray(c.images) ? c.images[0] : null;
        const body = img ? img.resource : null;
        rawCanvases.push([c, body]);
      }
    }
  } else if (Array.isArray(manifestJson.items)) {
    // v3: top-level "items" (canvases), each with an AnnotationPage "items",
    // each with Annotations "items", each carrying a "body" (the image).
    out.version = 3;
    for (const c of manifestJson.items) {
      const page = c && Array.isArray(c.items) ? c.items[0] : null;
      const anno = page && Array.isArray(page.items) ? page.items[0] : null;
      const body = anno ? anno.body : null;
      rawCanvases.push([c, body]);
    }
  }

  for (const [canvas, body] of rawCanvases) {
    const entry = canvasEntry(canvas, body);
    if (!entry) continue;
    out.canvases.push(entry);
    for (const key of [entry.id, entry.label, entry.stem]) {
      if (key && !out.byKey.has(key)) out.byKey.set(key, entry);
    }
  }
  return out;
}

/**
 * Scale factor between the stored zone coordinate space (the declared canvas
 * size) and the loaded image's pixel size. Zones are authored against the
 * canvas; if the served image is a different pixel size, a zone rect must be
 * multiplied by this factor before it maps to image pixels. Returns 1 when the
 * sizes are equal or either is unknown, so the existing template/plain paths
 * (which never declare a canvas size) are unaffected.
 *
 * The width and height ratios should agree for an aspect-preserving image; the
 * width ratio is used (a single uniform scale), the height passed only so a
 * caller can detect a mismatch if it wishes.
 */
export function coordScale(imagePixelWidth, canvasWidth) {
  const img = Number(imagePixelWidth);
  const canvas = Number(canvasWidth);
  if (!Number.isFinite(img) || !Number.isFinite(canvas) || img <= 0 || canvas <= 0) return 1;
  if (img === canvas) return 1;
  return img / canvas;
}

/**
 * Live wrapper: fetch a IIIF Presentation manifest URL and parse it. Thin by
 * design (the parse is pure and tested offline). Browser-only (uses fetch);
 * returns the parseIiifPresentationManifest shape, or throws on a network or
 * JSON error.
 */
export async function resolveIiifPresentation(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`IIIF manifest fetch failed (${res.status}) for ${url}`);
  const json = await res.json();
  return parseIiifPresentationManifest(json);
}
