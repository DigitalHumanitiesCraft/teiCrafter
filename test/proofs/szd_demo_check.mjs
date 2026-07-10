/**
 * Proof for the SZD demo path and the place/graphic/authority/work features.
 *
 * Builds a representative line-level SZD-style TEI (pb+lb body, a <facsimile>
 * with <graphic url> and <zone>s, and a <standOff> seeded with a person carrying
 * a GND <idno> and a place) and asserts, against the real engine:
 *   1. round-trip byte-identical (losslessness invariant holds)
 *   2. line-level editor model (folios / lines / cells)
 *   3. surface.graphic is read from <graphic url> (M2.2)
 *   4. readEntities surfaces the seeded place + the person's GND idno (M3.1/M3.3)
 *   5. addEntity('place') + linkMention round-trip and are readable (M3.1/M3.4)
 *   6. setAuthority add/replace/remove an <idno> losslessly and readably (M3.3)
 *   7. addEntity('work') + authority idno round-trip and are readable (M3.2/M3.3)
 *
 * Run: node test/proofs/szd_demo_check.mjs   (exit 0 = pass, 1 = fail)
 */

import { parseEdition, serialize } from "../../docs/js/editor/edition.js";
import { parseDocument, readSurfaces } from "../../docs/js/editor/tei-document.js";
import { readEntities, addEntity, linkMention, setAuthority } from "../../docs/js/editor/standoff.js";

const TEI = `<?xml version="1.0" encoding="UTF-8"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <teiHeader>
    <fileDesc><titleStmt><title>Demo</title></titleStmt></fileDesc>
  </teiHeader>
  <standOff>
    <listPerson>
      <person xml:id="pers_zweig"><persName>Stefan Zweig</persName><idno type="GND">118637495</idno></person>
    </listPerson>
    <listPlace>
      <place xml:id="plc_ny"><placeName>New York</placeName></place>
    </listPlace>
  </standOff>
  <facsimile>
    <surface xml:id="surf_1" ulx="0" uly="0" lrx="4912" lry="7360">
      <graphic url="https://gams.uni-graz.at/o:szd.100/IMG.1"/>
      <zone xml:id="z1" ulx="100" uly="120" lrx="900" lry="200"/>
    </surface>
  </facsimile>
  <text><body>
    <div>
      <pb n="1" facs="#surf_1"/>
      <p><lb facs="#z1"/>THIS AGREEMENT</p>
      <p><lb/>is made this twelfth day of September, 1938.</p>
    </div>
  </body></text>
</TEI>
`;

let failures = 0;
function check(label, cond) {
  console.log(`  ${cond ? "ok  " : "FAIL"} ${label}`);
  if (!cond) failures++;
}

// 1. round-trip
const state = parseEdition(TEI);
check("round-trip byte-identical", serialize(state) === TEI);

// 2. line-level model
check("one folio", state.folios.length === 1);
check("two lines", state.lines.length === 2);
check("line profile (no <w>)", state.profile === "line");
check("first cell text", state.cells[0] && state.cells[0].text === "THIS AGREEMENT");

// 3. graphic url read (M2.2)
const { surfaces } = readSurfaces(parseDocument(TEI));
check("surface.graphic url read", surfaces[0] && surfaces[0].graphic === "https://gams.uni-graz.at/o:szd.100/IMG.1");
check("zone read in pixels", surfaces[0] && surfaces[0].zones[0] && surfaces[0].zones[0].lrx === 900 && surfaces[0].zones[0].lry === 200);
check("folio.surface linked via @facs", state.folios[0].surface && state.folios[0].surface.graphic != null);

// 4. seeded place + seeded person's authority idno are read (M3.1/M3.3)
const ents = readEntities(parseDocument(TEI));
check("readEntities returns places[]", Array.isArray(ents.places));
check("seeded place found", ents.places.length === 1 && ents.places[0].name === "New York");
check("seeded place id", ents.places[0] && ents.places[0].id === "plc_ny");
const zweig = ents.persons.find((p) => p.id === "pers_zweig");
check("seeded person GND idno read", !!zweig && Array.isArray(zweig.authorities) &&
  zweig.authorities.some((a) => a.type === "GND" && a.value === "118637495"));

// 5. add a new place + link a mention, both lossless-and-readable (M3.1/M3.4)
const doc0 = parseDocument(TEI);
const doc1 = addEntity(doc0, "place", { name: "London" });
const ents1 = readEntities(doc1);
check("addEntity place grows list", ents1.places.length === 2);
const added = ents1.places.find((p) => p.name === "London");
check("added place has plc_ prefix id", !!added && added.id.startsWith("plc"));
// re-parse through edition to confirm the mutated raw still builds a model
const reState = parseEdition(doc1.raw);
check("mutated doc still builds model", reState.folios.length === 1);
// link the first reading-text node to the added place
const firstText = reState.cells[0].node;
const doc2 = linkMention(reState.doc, firstText, added.id);
check("linkMention changed the doc", doc2 !== reState.doc);
check("mention <name ref> present", doc2.raw.includes('ref="#' + added.id + '"'));
check("linked doc still well-formed model", parseEdition(doc2.raw).folios.length === 1);

// 6. authority idno: add, replace, remove on the added place (M3.3)
const authAdded = setAuthority(doc1, added.id, "GeoNames", "2643743");
check("setAuthority changed the doc", authAdded !== doc1);
check("idno present in raw", authAdded.raw.includes('<idno type="GeoNames">2643743</idno>'));
const addedAuth = readEntities(authAdded).places.find((p) => p.id === added.id);
check("authority read back on entity", !!addedAuth &&
  addedAuth.authorities.some((a) => a.type === "GeoNames" && a.value === "2643743"));
check("authority add still well-formed model", parseEdition(authAdded.raw).folios.length === 1);
// replace the same authority's value: still exactly one GeoNames idno, new value
const authReplaced = setAuthority(authAdded, added.id, "GeoNames", "2988507");
const replacedAuth = readEntities(authReplaced).places.find((p) => p.id === added.id);
check("authority replace keeps one idno", !!replacedAuth &&
  replacedAuth.authorities.filter((a) => a.type === "GeoNames").length === 1 &&
  replacedAuth.authorities.some((a) => a.type === "GeoNames" && a.value === "2988507"));
// a second, different authority coexists with the first
const authSecond = setAuthority(authReplaced, added.id, "Wikidata", "Q84");
const twoAuth = readEntities(authSecond).places.find((p) => p.id === added.id);
check("second authority coexists", !!twoAuth && twoAuth.authorities.length === 2);
// remove the GeoNames authority by setting an empty value
const authRemoved = setAuthority(authSecond, added.id, "GeoNames", "");
const oneAuth = readEntities(authRemoved).places.find((p) => p.id === added.id);
check("authority remove drops only that idno", !!oneAuth && oneAuth.authorities.length === 1 &&
  oneAuth.authorities[0].type === "Wikidata");
check("authority remove still well-formed model", parseEdition(authRemoved.raw).folios.length === 1);

// 7. work entity: add + authority idno, round-trip and readable (M3.2/M3.3)
const docWork = addEntity(parseDocument(TEI), "work", { name: "Schachnovelle" });
const works = readEntities(docWork).works;
check("addEntity work creates listBibl entry", Array.isArray(works) && works.length === 1);
const work = works[0];
check("work has wrk_ prefix id", !!work && work.id.startsWith("wrk"));
check("work name read from <title>", !!work && work.name === "Schachnovelle");
const docWorkAuth = setAuthority(docWork, work.id, "GND", "4453349-3");
const workAuth = readEntities(docWorkAuth).works[0];
check("work authority read back", !!workAuth &&
  workAuth.authorities.some((a) => a.type === "GND" && a.value === "4453349-3"));
check("work doc still well-formed model", parseEdition(docWorkAuth.raw).folios.length === 1);
// a bibl inside the teiHeader must NOT be read as a work (scoped to standOff/listBibl)
const HEADER_BIBL = TEI.replace(
  "<fileDesc><titleStmt><title>Demo</title></titleStmt></fileDesc>",
  "<fileDesc><titleStmt><title>Demo</title></titleStmt><sourceDesc><listBibl><bibl><title>A cited source</title></bibl></listBibl></sourceDesc></fileDesc>"
);
check("header bibl is not read as a work", readEntities(parseDocument(HEADER_BIBL)).works.length === 0);

console.log("");
if (failures) {
  console.log(`FAIL: ${failures} check(s) failed.`);
  process.exit(1);
} else {
  console.log("PASS: SZD demo path, place/work entities, authority idno, and graphic url all verified.");
  process.exit(0);
}
