/**
 * REFERENCE PROTOTYPE (spec-by-example) -- Page-JSON v0.2 -> teiCrafter-target TEI.
 *
 * Purpose: produce ONE real SZD TEI that teiCrafter can load line-level, so the
 * frontend gap analysis (CC3) has a concrete file and CC2 has an executable target
 * to port into szd-htr (e.g. pipeline/export_tei.py). NOT part of the teiCrafter app.
 *
 * teiCrafter engine contract honoured (see docs/js/editor/edition.js):
 *   - <pb> per page                    -> folio split
 *   - <lb/> per visual line            -> line split; pages[].text is canonical
 *   - <facsimile>/<surface>/<zone ulx/uly/lrx/lry> from region bboxes (percent->px)
 *   - <standOff>/<listPerson> seeded from descriptive_metadata.creator (name + GND)
 *
 * It verifies its own output against the real engine before exiting (proof, not claim).
 *
 * Usage: node szd-pagejson-to-tei.mjs <in_page.json> <out.xml> [path-to-edition.js]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const [, , inPath, outPath, editionPathArg] = process.argv;
if (!inPath || !outPath) {
  console.error("usage: node szd-pagejson-to-tei.mjs <in_page.json> <out.xml> [edition.js]");
  process.exit(2);
}
const EDITION_JS =
  editionPathArg ||
  "C:/Users/Chrisi/Documents/GitHub/ResearchTools/teiCrafter/docs/js/editor/edition.js";

const pj = JSON.parse(readFileSync(inPath, "utf8"));
const src = pj.source || {};
const dm = src.descriptive_metadata || {};
const prov = pj.provenance || {};

const escText = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s) => escText(s).replace(/"/g, "&quot;");

function slug(s) {
  return (
    String(s ?? "")
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "x"
  );
}

// --- persons (standOff) from descriptive_metadata.creator -------------------
const persons = (dm.creator || []).map((c) => ({
  id: "pers_" + slug(c.name),
  name: c.name,
  gnd: c.gnd || null,
}));

const personXml = persons
  .map(
    (p) =>
      `      <person xml:id="${escAttr(p.id)}">\n` +
      `        <persName>${escText(p.name)}</persName>\n` +
      (p.gnd ? `        <idno type="GND">${escText(p.gnd)}</idno>\n` : "") +
      `      </person>`
  )
  .join("\n");

// --- facsimile: one surface per page (graphic + zones from region bboxes) ----
function zonesFor(page) {
  const w = page.image_width,
    h = page.image_height;
  if (!w || !h || !Array.isArray(page.regions)) return [];
  return page.regions.map((r) => {
    const [x, y, bw, bh] = r.bbox;
    const ulx = Math.round((x / 100) * w);
    const uly = Math.round((y / 100) * h);
    const lrx = Math.round(((x + bw) / 100) * w);
    const lry = Math.round(((y + bh) / 100) * h);
    return `      <zone xml:id="z_${page.page}_${escAttr(r.id)}" ulx="${ulx}" uly="${uly}" lrx="${lrx}" lry="${lry}"${
      r.type ? ` type="${escAttr(r.type)}"` : ""
    }/>`;
  });
}

const surfaces = pj.pages
  .map((page, i) => {
    const sid = `surf_${page.page}`;
    const img = (src.images || [])[i] || page.image || "";
    const zs = zonesFor(page);
    if (!zs.length && !img) return null;
    const w = page.image_width,
      h = page.image_height;
    const dims = w && h ? ` ulx="0" uly="0" lrx="${w}" lry="${h}"` : "";
    return (
      `    <surface xml:id="${sid}"${dims}>\n` +
      (img ? `      <graphic url="${escAttr(img)}"/>\n` : "") +
      (zs.length ? zs.join("\n") + "\n" : "") +
      `    </surface>`
    );
  })
  .filter(Boolean);

const hasSurface = (page) => surfaces.some((s) => s.includes(`xml:id="surf_${page.page}"`));

// --- body: pb per page; page text -> <p> by blank line, <lb/> per line -------
function bodyForPage(page) {
  const sid = `surf_${page.page}`;
  const pb = `      <pb n="${escAttr(page.page)}"${hasSurface(page) ? ` facs="#${sid}"` : ""}/>`;
  const text = (page.text || "").replace(/\r\n/g, "\n");
  if (!text.trim()) return pb; // blank / color_chart: a folio with no text
  const paras = text.split(/\n{2,}/).map((para) => {
    const inner = para.split(/\n/).map((ln) => `<lb/>${escText(ln)}`).join("\n        ");
    return `      <p>\n        ${inner}\n      </p>`;
  });
  return pb + "\n" + paras.join("\n");
}

const body = pj.pages.map(bodyForPage).join("\n");

// --- header from descriptive metadata ---------------------------------------
const title = src.title || src.id || "Untitled";
const respList = persons
  .map(
    (p) =>
      `        <respStmt><resp>contributor</resp><persName>${escText(p.name)}</persName></respStmt>`
  )
  .join("\n");
const rights = dm.rights || "";
const repo = (dm.holding && dm.holding.repository) || src.repository || "";
const shelf = src.shelfmark || "";
const lang = src.language || "und";
const reviewStatus = pj.review && pj.review.status ? pj.review.status : "unreviewed";

const header = `  <teiHeader>
    <fileDesc>
      <titleStmt>
        <title>${escText(title)}</title>
${respList ? respList + "\n" : ""}      </titleStmt>
      <publicationStmt>
        <p>Machine-generated TEI from szd-htr Page-JSON (${escText(
          prov.model || "unknown model"
        )}). Structure unreviewed; transcription ${escText(reviewStatus)}.${
  rights ? " Rights: " + escText(rights) + "." : ""
}</p>
      </publicationStmt>
      <sourceDesc>
        <msDesc>
          <msIdentifier>${repo ? `\n            <repository>${escText(repo)}</repository>` : ""}${
  shelf ? `\n            <idno type="shelfmark">${escText(shelf)}</idno>` : ""
}
            <idno type="objectId">${escText(src.id || "")}</idno>
          </msIdentifier>
        </msDesc>
      </sourceDesc>
    </fileDesc>
    <profileDesc>
      <langUsage><language ident="${escAttr(lang)}"/></langUsage>
    </profileDesc>
  </teiHeader>`;

const facsimile = surfaces.length ? `  <facsimile>\n${surfaces.join("\n")}\n  </facsimile>\n` : "";
const standOff = persons.length
  ? `  <standOff>\n    <listPerson>\n${personXml}\n    </listPerson>\n  </standOff>\n`
  : "";

const tei = `<?xml version="1.0" encoding="UTF-8"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
${header}
${standOff}${facsimile}  <text>
    <body>
      <div type="document" n="${escAttr(src.id || "")}">
${body}
      </div>
    </body>
  </text>
</TEI>
`;

writeFileSync(outPath, tei, "utf8");

// --- PROOF: parse with the real teiCrafter engine and round-trip -------------
const ed = await import(pathToFileURL(EDITION_JS).href);
const model = ed.parseEdition(tei);
const round = ed.serialize(model);
const byteIdentical = round === tei;

const summary = {
  out: outPath,
  persons: persons.length,
  surfaces: surfaces.length,
  pages: pj.pages.length,
  folios: model.folios.length,
  profile: model.profile,
  cells: model.cells.length,
  byteIdenticalRoundTrip: byteIdentical,
};
console.error(JSON.stringify(summary, null, 2));

const ok =
  model.folios.length === pj.pages.length &&
  model.profile === "line" &&
  model.cells.length > 0 &&
  byteIdentical;
if (!ok) {
  console.error("PROOF FAILED: output does not satisfy the teiCrafter contract.");
  process.exit(1);
}
console.error("PROOF OK: loads line-level, folios == pages, byte-identical round-trip.");
