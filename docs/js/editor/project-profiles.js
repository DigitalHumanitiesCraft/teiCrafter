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
