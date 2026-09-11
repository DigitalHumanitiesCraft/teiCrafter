import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { importPageXml, pageOrderFromMets } from "../../docs/js/editor/page-xml-import.js";
import { parseDocument, teiElementsByLocal, getXmlId, textNodes, textOf } from "../../docs/js/editor/tei-document.js";
import { parseEdition } from "../../docs/js/editor/edition.js";
import { validateWithSchemas } from "../../docs/js/editor/schema-validation.js";

const NS = "http://schema.primaresearch.org/PAGE/gts/pagecontent/2013-07-15";
const sample = (word = "Beta") => `<?xml version="1.0"?><PcGts xmlns="${NS}"><Metadata><Creator>Synthetic HTR engine</Creator><TranskribusMetadata docId="1" pageId="2" pageNr="1" status="IN_PROGRESS"><Property key="folio" value="1r"/></TranskribusMetadata></Metadata><Page imageFilename="page.jpg" imageWidth="200" imageHeight="300"><ReadingOrder><OrderedGroup id="order"><RegionRefIndexed index="1" regionRef="region_a"/><RegionRefIndexed index="0" regionRef="region_b"/></OrderedGroup></ReadingOrder><TextRegion id="region_a"><Coords points="0,0 100,0 100,100 0,100"/><TextLine id="line_a" custom="readingOrder {index:0;} folk {offset:0; length:4;name:Test;}"><Coords points="1,2 99,2 99,20 1,20"/><Baseline points="1,18 99,18"/><TextEquiv><Unicode>  A &amp; B ſeín  </Unicode></TextEquiv></TextLine></TextRegion><TextRegion id="region_b"><Coords points="0,100 100,100 100,200 0,200"/><TextLine id="line_b"><Coords points="1,101 99,101 99,120 1,120"/><Word id="word_a"><Coords points="1,101 49,101 49,120 1,120"/><TextEquiv><Unicode>Alpha</Unicode></TextEquiv></Word><Word id="word_b"><Coords points="50,101 99,101 99,120 50,120"/><TextEquiv><Unicode>${word}</Unicode></TextEquiv></Word><TextEquiv><Unicode>Alpha Beta</Unicode></TextEquiv></TextLine></TextRegion><ImageRegion id="picture"><Coords points="100,0 199,0 199,100 100,100"/></ImageRegion></Page></PcGts>`;
const first = { name: "page_2.xml", raw: sample() };
const second = { name: "page_10.xml", raw: sample("Gamma") };
const result = importPageXml([second, first], { title: "Synthetic PAGE import" });
assert.deepEqual(result.pages.map((page) => page.name), ["page_2.xml", "page_10.xml"]);
assert.equal(importPageXml([first, second], { title: "Synthetic PAGE import" }).raw, result.raw);
assert.equal(result.name, "Synthetic PAGE import.xml");
assert.equal(result.order, "natural filename order");
assert.ok(importPageXml([first], { teiType: "wenzelsbibel-transcription" }).raw.includes('type="wenzelsbibel-transcription"'));
assert.throws(() => importPageXml([first], { teiType: 'invalid" type' }), /project type/u);
assert.equal(result.pages[0].lines, 2);
assert.equal(result.pages[0].words, 2);
assert.equal(result.pages[1].words, 0);
assert.ok(result.warnings.some((warning) => warning.includes("readings disagree")));
assert.ok(result.raw.includes("  A &amp; B ſeín  "));
assert.ok(result.raw.indexOf('>Alpha</w>') < result.raw.indexOf("  A &amp; B ſeín  "));
assert.ok(result.raw.includes('type="page-xml-custom"'));
assert.ok(result.raw.includes('type="page-xml-baseline"'));
assert.ok(result.raw.includes('type="source-status">docId=1; pageId=2; pageNr=1; status=IN_PROGRESS'));
assert.ok(!result.raw.includes(" norm="));
assert.ok(!result.raw.includes(" orig="));
const imported = parseDocument(result.raw);
const ids = [];
for (const local of ["surface", "zone", "lb", "w", "bibl", "pb", "respStmt"]) {
  ids.push(...teiElementsByLocal(imported.root, local).map(getXmlId).filter(Boolean));
}
assert.equal(new Set(ids).size, ids.length);
assert.equal(teiElementsByLocal(imported.root, "surface").length, 2);
assert.equal(parseEdition(result.raw).folios.length, 2);
assert.equal(parseEdition(result.raw).doc.serialize(), result.raw);
const allText = textNodes(teiElementsByLocal(imported.root, "body")[0]).map((node) => textOf(imported, node)).join("");
assert.equal(allText, "Alpha Beta  A & B ſeín  Alpha Beta  A & B ſeín  ");

const mets = `<m:mets xmlns:m="http://www.loc.gov/METS/" xmlns:x="http://www.w3.org/1999/xlink"><m:fileSec><m:fileGrp><m:file ID="a"><m:FLocat x:href="page/page_2.xml"/></m:file><m:file ID="b"><m:FLocat x:href="page/page_10.xml"/></m:file></m:fileGrp></m:fileSec><m:structMap TYPE="PHYSICAL"><m:div><m:div ORDER="2"><m:fptr FILEID="a"/></m:div><m:div ORDER="1"><m:fptr><m:area FILEID="b"/></m:fptr></m:div></m:div></m:structMap></m:mets>`;
assert.deepEqual(pageOrderFromMets(mets), ["page/page_10.xml", "page/page_2.xml"]);
assert.deepEqual(importPageXml([first, second], { mets }).pages.map((page) => page.name), [second.name, first.name]);
assert.deepEqual(importPageXml([second, first], { order: "selection" }).pages.map((page) => page.name), [second.name, first.name]);
assert.throws(() => importPageXml([first, first]), /distinct/u);
assert.throws(() => importPageXml([{ ...first, raw: first.raw.replace('id="line_b"', 'id="line_a"') }]), /Duplicate PAGE ID/u);
assert.throws(() => importPageXml([{ ...first, raw: first.raw.replace('regionRef="region_b"', 'regionRef="missing"') }]), /missing region/u);
assert.throws(() => importPageXml([{ ...first, raw: first.raw.replace('imageWidth="200"', 'imageWidth="0"') }]), /dimensions/u);
assert.throws(() => importPageXml([{ ...first, raw: first.raw.replace('</Page>', '</Wrong>') }]), /end tags/u);
assert.throws(() => importPageXml([{ ...first, raw: first.raw.replace(NS, "urn:foreign") }]), /not PAGE/u);
assert.throws(() => importPageXml([{ ...first, raw: first.raw.replace('A &amp; B', 'A &custom; B') }]), /entit/iu);
assert.throws(() => importPageXml([{ name: "unknown.xml", raw: sample() }], { mets }), /unambiguously/u);
const cdata = importPageXml([{ ...first, raw: first.raw.replace('  A &amp; B ſeín  ', '<![CDATA[  A & B ſeín  ]]>') }]);
assert.ok(cdata.raw.includes("  A &amp; B ſeín  "));
const prefixed = first.raw.replace(`xmlns="${NS}"`, `xmlns:p="${NS}"`).replace(/<(\/?)([A-Za-z][A-Za-z0-9]*)(?=[\s/>])/gu, '<$1p:$2');
assert.equal(importPageXml([{ ...first, raw: prefixed }]).pages[0].lines, 2);
const nestedRegion = first.raw.replace('regionRef="region_b"', 'regionRef="table"')
  .replace('<TextRegion id="region_b">', '<TableRegion id="table"><TextRegion id="region_b">')
  .replace('</TextRegion><ImageRegion', '</TextRegion></TableRegion><ImageRegion');
const nestedResult = importPageXml([{ ...first, raw: nestedRegion }]);
assert.ok(nestedResult.raw.indexOf('>Alpha</w>') < nestedResult.raw.indexOf("  A &amp; B ſeín  "));

const rng = readFileSync(new URL("../../docs/schemas/tei-p5-4.11.0/tei_all.rng", import.meta.url), "utf8");
const validation = await validateWithSchemas(result.raw, [{ name: "TEI All", type: "relaxng", text: rng }]);
assert.ok(validation.every((item) => item.status === "valid"), JSON.stringify(validation));
const degenerate = importPageXml([{ ...first, raw: first.raw.replace('points="0,0 100,0 100,100 0,100"', 'points="0,0"') }]);
assert.ok(degenerate.warnings.some((warning) => warning.includes("fewer than three polygon points")));
assert.ok(degenerate.raw.includes('type="page-xml-coordinates"'));
assert.ok(degenerate.raw.includes('>0,0</note>'));
const degenerateValidation = await validateWithSchemas(degenerate.raw, [{ name: "TEI All", type: "relaxng", text: rng }]);
assert.ok(degenerateValidation.every((item) => item.status === "valid"), JSON.stringify(degenerateValidation));

const realRoot = process.env.WB_PAGE_ROOT;
const realPath = `${realRoot}/page/0001_00000145.xml`;
if (realRoot) {
  assert.ok(existsSync(realPath), "WB_PAGE_ROOT must contain the Exodus_4 PAGE/METS fixture.");
  const real = importPageXml([{ name: "0001_00000145.xml", raw: readFileSync(realPath, "utf8") }], { mets: readFileSync(`${realRoot}/mets.xml`, "utf8") });
  assert.ok(real.pages[0].lines > 50);
  assert.equal(real.pages[0].label, "68v");
  const realValidation = await validateWithSchemas(real.raw, [{ name: "TEI All", type: "relaxng", text: rng }]);
  assert.ok(realValidation.every((item) => item.status === "valid"), JSON.stringify(realValidation));
  console.log("Real local PAGE/METS source: in-memory import, page/line mapping and TEI All validation passed.");
} else console.log("Optional real PAGE/METS import not run; set WB_PAGE_ROOT to the Exodus_4 fixture folder.");
console.log("PAGE import fidelity, reading order, METS, namespace, collision and schema checks passed.");
