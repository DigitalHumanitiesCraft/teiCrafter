/**
 * Offline check for the Wenzelsbibel load path (WB-AP1) and the project-profile
 * IIIF resolver (WB-AP2).
 *
 * The real codex (codex-2759.xml, ~78 MB) is licence-restricted ÖNB data and
 * lives OUTSIDE this repository; this check reads it from the local data
 * folder (override with WB_CODEX=<path>) and SKIPS cleanly when the file is
 * absent, so the repo regression never depends on uncommittable data.
 *
 * Proves, on the real codex:
 *   - parseEdition handles the full file (timed), word profile, 480 folios
 *   - the no-op save is byte-identical (serialize(parse(raw)) === raw)
 *   - the Wenzelsbibel project profile is detected from the PID (o:wen.*)
 *   - the resolver maps a surface's <graphic url> to the ÖNB IIIF info.json
 *   - zones without ulx/lrx get a bounding box derived from @points, inside
 *     the surface extent, so the facsimile overlay can place all of them
 * Plus profile/resolver unit cases that run with or without the codex.
 *
 * Run: node test/proofs/wb_codex_check.mjs
 */

import { existsSync, readFileSync } from "node:fs";
import { parseEdition, serialize } from "../../docs/js/editor/edition.js";
import { parseDocument } from "../../docs/js/editor/tei-document.js";
import { detectProject, projectTileSource, readPid } from "../../docs/js/editor/project-profiles.js";

const CODEX = process.env.WB_CODEX
  || "C:/Users/Chrisi/Documents/GitHub/Wenzelsbibel/data/codex-2759.xml";

let failures = 0;
let n = 0;
function check(name, ok, detail = "") {
  n++;
  if (ok) { console.log(`ok ${n} - ${name}`); return; }
  failures++;
  console.log(`NOT OK ${n} - ${name}${detail ? `: ${detail}` : ""}`);
}

// ---- unit cases (no codex needed) ------------------------------------------

const MINI = `<?xml version="1.0"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0"><teiHeader><fileDesc><publicationStmt>
<idno type="Transkribus">860483</idno>
<idno type="PID">o:wen.codex-2759</idno>
</publicationStmt></fileDesc></teiHeader><text><body><p>x</p></body></text></TEI>`;

const miniDoc = parseDocument(MINI);
check("PID read skips non-PID idno", readPid(miniDoc) === "o:wen.codex-2759");
const project = detectProject(miniDoc);
check("Wenzelsbibel profile detected from o:wen.* PID", !!project && project.id === "wenzelsbibel");
check("resolver maps bare filename to ÖNB IIIF info.json",
  projectTileSource(project, "00000010.jpg")
    === "https://iiif.onb.ac.at/images/REPO/8977428/00000010.jp2/info.json");
check("resolver leaves absolute URLs alone",
  projectTileSource(project, "https://example.org/p1.jpg") === null);
check("resolver refuses path-ish urls", projectTileSource(project, "img/00000010.jpg") === null);
check("no profile without a matching PID",
  detectProject(parseDocument(MINI.replace("o:wen.codex-2759", "o:szd.1079"))) === null);

// ---- real codex (skips when absent) -----------------------------------------

if (!existsSync(CODEX)) {
  console.log(`# SKIP real-codex checks: ${CODEX} not present on this machine`);
} else {
  const raw = readFileSync(CODEX, "utf8");
  const t0 = performance.now();
  const state = parseEdition(raw);
  const parseMs = Math.round(performance.now() - t0);
  console.log(`# parsed ${(raw.length / 1e6).toFixed(1)} MB in ${parseMs} ms`);

  check("codex parses in the word profile", state.profile === "word");
  check("codex yields 480 folios", state.folios.length === 480, `got ${state.folios.length}`);
  check("no-op save is byte-identical", serialize(state) === raw);
  check("parse stays under 15s", parseMs < 15000, `${parseMs} ms`);

  const proj = detectProject(state.doc);
  check("codex detects the Wenzelsbibel profile", !!proj && proj.id === "wenzelsbibel");

  const withGraphic = state.folios.filter((f) => f.surface && f.surface.graphic);
  check("every folio surface carries a <graphic url>", withGraphic.length === state.folios.length,
    `${withGraphic.length}/${state.folios.length}`);
  const sample = withGraphic[0].surface;
  const tile = projectTileSource(proj, sample.graphic);
  check("first surface graphic resolves to an info.json URL",
    !!tile && /^https:\/\/iiif\.onb\.ac\.at\/images\/REPO\/8977428\/\d+\.jp2\/info\.json$/.test(tile),
    String(tile));

  // Zones: Transkribus points polygons must yield bounding boxes inside the surface.
  let zones = 0, boxed = 0, inside = 0;
  for (const f of state.folios) {
    const s = f.surface;
    if (!s) continue;
    for (const z of s.zones) {
      zones++;
      if (z.ulx != null && z.uly != null && z.lrx > z.ulx && z.lry > z.uly) {
        boxed++;
        if (z.ulx >= (s.ulx ?? 0) && z.uly >= (s.uly ?? 0)
          && (s.lrx == null || z.lrx <= s.lrx) && (s.lry == null || z.lry <= s.lry)) inside++;
      }
    }
  }
  console.log(`# zones ${zones}, with bbox ${boxed}, inside surface ${inside}`);
  check("zones exist", zones > 30000, `got ${zones}`);
  check("every zone has a usable bounding box", boxed === zones, `${boxed}/${zones}`);
  check("every bbox lies inside its surface", inside === boxed, `${inside}/${boxed}`);
}

console.log(failures ? `# FAILED ${failures}/${n}` : `# all ${n} checks passed`);
process.exit(failures ? 1 : 0);
