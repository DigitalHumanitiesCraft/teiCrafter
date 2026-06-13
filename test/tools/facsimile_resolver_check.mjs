/**
 * Proof: the facsimile resolver chain (W7) accepts a IIIF Presentation manifest
 * resolver, parses both Presentation API v2 and v3 manifests into page image +
 * canvas size, and scales zone coordinates by a declared canvas-vs-image factor:
 *   - parseManifest accepts imageResolver type "iiif-presentation" and carries
 *     its "manifest" URL, keeps "iiif-image-template", rejects "mets" with the
 *     precise deferral message, and still rejects genuinely unknown types;
 *   - parseIiifPresentationManifest returns the right imageUrl and canvas size
 *     for a synthetic v2 manifest AND a synthetic v3 manifest, keyed by stem,
 *     id and label, with an ordered canvases array;
 *   - coordScale scales a zone rect correctly for a differently sized image and
 *     is exactly 1 for equal sizes or unknown sizes (the no-op the existing
 *     template/plain paths rely on).
 *
 * Synthetic fixtures only: no fetch, fully offline, unconditional (no SKIP).
 *
 * Run: node test/tools/facsimile_resolver_check.mjs   (exit 0 = all pass)
 */

import {
  parseManifest,
} from "../../docs/js/editor/project-manifest.js";
import {
  parseIiifPresentationManifest, coordScale,
} from "../../docs/js/editor/project-profiles.js";

let passed = 0, failed = 0;
function check(cond, label) {
  if (cond) { passed++; console.log("  ok    " + label); }
  else { failed++; console.log("  FAIL  " + label); }
}
function rejects(input, reLabel, label) {
  try { parseManifest(input); check(false, label + " (no error thrown)"); }
  catch (err) { check(reLabel.test(err.message), `${label} ("${err.message}")`); }
}

console.log("\nFacsimile resolver proof (W7)");
console.log("=".repeat(60));

// --- 1. Manifest resolver: presentation accepted, template kept, mets deferred -

const pres = parseManifest({
  teicrafter: 1,
  name: "Presentation project",
  imageResolver: { type: "iiif-presentation", manifest: "https://example.org/iiif/manifest.json" },
});
check(pres.iiifPresentationManifest === "https://example.org/iiif/manifest.json",
  "iiif-presentation: the manifest URL is carried on the project");
check(pres.iiifImageTemplate === null,
  "iiif-presentation: no image template is set (the two resolver kinds are exclusive)");

const tmpl = parseManifest({
  teicrafter: 1,
  name: "Template project",
  imageResolver: { type: "iiif-image-template", template: "https://x/{stem}.jp2/info.json" },
});
check(tmpl.iiifImageTemplate === "https://x/{stem}.jp2/info.json" && tmpl.iiifPresentationManifest === null,
  "iiif-image-template still parses unchanged, with no presentation manifest");

rejects({ teicrafter: 1, name: "x", imageResolver: { type: "mets", href: "m.xml" } },
  /imageResolver type "mets" is not supported yet/,
  'a "mets" resolver is rejected with the precise deferral message');
rejects({ teicrafter: 1, name: "x", imageResolver: { type: "magic" } },
  /unknown imageResolver type/,
  "a genuinely unknown resolver type is still rejected");
rejects({ teicrafter: 1, name: "x", imageResolver: { type: "iiif-presentation", manifest: "  " } },
  /imageResolver\.manifest must be a non-empty URL string/,
  "an iiif-presentation resolver without a manifest URL is rejected");
rejects({ teicrafter: 1, name: "x", imageResolver: { type: "iiif-presentation" } },
  /imageResolver\.manifest must be a non-empty URL string/,
  "an iiif-presentation resolver with a missing manifest URL is rejected");

// --- 2. parseIiifPresentationManifest: v2 ------------------------------------

const v2 = {
  "@context": "http://iiif.io/api/presentation/2/context.json",
  "@id": "https://example.org/iiif/manifest.json",
  "@type": "sc:Manifest",
  sequences: [{
    "@type": "sc:Sequence",
    canvases: [
      {
        "@id": "https://example.org/canvas/p1",
        "@type": "sc:Canvas",
        label: "Folio 1r",
        width: 4000,
        height: 6000,
        images: [{
          "@type": "oa:Annotation",
          resource: {
            "@id": "https://images.example.org/iiif/00000010.jp2/full/full/0/default.jpg",
            "@type": "dctypes:Image",
            width: 4000,
            height: 6000,
          },
        }],
      },
      {
        "@id": "https://example.org/canvas/p2",
        "@type": "sc:Canvas",
        label: "Folio 1v",
        width: 4000,
        height: 6000,
        images: [{ resource: { "@id": "https://images.example.org/iiif/00000011.jp2/full/full/0/default.jpg" } }],
      },
    ],
  }],
};

const m2 = parseIiifPresentationManifest(v2);
check(m2.version === 2, "v2: detected as Presentation API v2 (top-level sequences)");
check(m2.canvases.length === 2, "v2: both canvases parsed into the ordered array");
const e2 = m2.canvases[0];
check(e2.imageUrl === "https://images.example.org/iiif/00000010.jp2/full/full/0/default.jpg",
  "v2: the first canvas image URL is read from images[].resource['@id']");
check(e2.canvasWidth === 4000 && e2.canvasHeight === 6000,
  "v2: the declared canvas width and height are carried");
check(e2.label === "Folio 1r", "v2: the canvas label is carried");
check(e2.stem === "00000010",
  `v2: the image stem is the IIIF identifier, not the generic "default" quality token (got "${e2.stem}")`);
check(m2.byKey.get("https://example.org/canvas/p1") === e2,
  "v2: the entry is reachable by canvas id");
check(m2.byKey.get("Folio 1r") === e2,
  "v2: the entry is reachable by label");
check(m2.byKey.get(e2.stem) === e2,
  "v2: the entry is reachable by image stem");

// --- 3. parseIiifPresentationManifest: v3 ------------------------------------

const v3 = {
  "@context": "http://iiif.io/api/presentation/3/context.json",
  id: "https://example.org/iiif/v3/manifest.json",
  type: "Manifest",
  items: [
    {
      id: "https://example.org/v3/canvas/p1",
      type: "Canvas",
      label: { en: ["Page one"] },
      width: 2000,
      height: 3000,
      items: [{
        type: "AnnotationPage",
        items: [{
          type: "Annotation",
          motivation: "painting",
          body: {
            id: "https://images.example.org/v3/img-001.jpg",
            type: "Image",
            format: "image/jpeg",
            width: 2000,
            height: 3000,
          },
        }],
      }],
    },
  ],
};

const m3 = parseIiifPresentationManifest(v3);
check(m3.version === 3, "v3: detected as Presentation API v3 (top-level items)");
check(m3.canvases.length === 1, "v3: the canvas parsed into the ordered array");
const e3 = m3.canvases[0];
check(e3.imageUrl === "https://images.example.org/v3/img-001.jpg",
  "v3: the image URL is read from items[].items[].items[].body.id");
check(e3.canvasWidth === 2000 && e3.canvasHeight === 3000,
  "v3: the declared canvas width and height are carried");
check(e3.label === "Page one",
  "v3: the language-map label is reduced to its first string value");
check(m3.byKey.get("https://example.org/v3/canvas/p1") === e3 && m3.byKey.get(e3.stem) === e3,
  "v3: the entry is reachable by canvas id and by image stem");

// A malformed / empty input degrades to an empty result, never throws.
check(parseIiifPresentationManifest(null).canvases.length === 0
  && parseIiifPresentationManifest({}).version === null,
  "an empty or non-manifest object yields an empty result with version null");

// --- 4. coordScale: scale a zone rect, no-op for equal/unknown sizes ----------

check(coordScale(4000, 4000) === 1, "coordScale: equal image and canvas size is 1 (no-op)");
check(coordScale(2000, 4000) === 0.5, "coordScale: a half-size image scales zones by 0.5");
check(coordScale(8000, 4000) === 2, "coordScale: a double-size image scales zones by 2");
check(coordScale(2000, undefined) === 1 && coordScale(undefined, 4000) === 1,
  "coordScale: an unknown image or canvas size is 1 (no-op, template/plain paths unaffected)");
check(coordScale(0, 4000) === 1 && coordScale(2000, 0) === 1,
  "coordScale: a zero or invalid size is 1 (no division by zero)");

// Applying the factor to a zone rect (the arithmetic facsimile.js performs).
const scale = coordScale(2000, 4000); // 0.5
const zone = { ulx: 100, uly: 200, lrx: 300, lry: 600 };
const sx = (zone.ulx) * scale;
const sy = (zone.uly) * scale;
const sw = (zone.lrx - zone.ulx) * scale;
const sh = (zone.lry - zone.uly) * scale;
check(sx === 50 && sy === 100 && sw === 100 && sh === 200,
  "coordScale applied to a zone rect: x/y/w/h are all multiplied by the factor");

const one = coordScale(4000, 4000); // 1
check((zone.ulx) * one === 100 && (zone.lry - zone.uly) * one === 400,
  "coordScale 1: the zone rect is unchanged (the existing template/plain behavior)");

// --- summary ------------------------------------------------------------------

console.log("=".repeat(60));
console.log(`${failed ? "FAILED" : "PASSED"}: ${passed}/${passed + failed} checks.`);
process.exit(failed ? 1 : 0);
