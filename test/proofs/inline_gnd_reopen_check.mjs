/**
 * Proof: the inline-GND re-open/import path (fromInlineGND) reads an inline-GND
 * interchange document back into the register model, and the interchange file is a
 * fixed point of the round-trip.
 *
 * This is the inverse of inline_gnd_check.mjs (toInlineGND). It runs on the same
 * self-contained synthetic register-model fixture (no rights, no sibling checkout):
 * the fixture is exported to inline-GND, re-imported, and the result is checked.
 *
 * Acceptance contract asserted here:
 *   - re-import lifts every inline <persName>/<orgName>/<bibl> back into <standOff>,
 *     deduplicated, with its <idno type="GND"> when a ref="GND:.." was present;
 *   - each mention is rewrapped as <name ref="#id"> pointing at the recovered entity;
 *   - places are NOT recovered (the format does not annotate them): a documented
 *     one-way loss;
 *   - the reading text is byte-identical through export and re-import;
 *   - the interchange file is a FIXED POINT: toInlineGND(fromInlineGND(file)) === file;
 *   - re-import is idempotent: a register-model document has no inline mention to
 *     lift, so fromInlineGND returns the SAME doc.
 *
 * Run: node test/proofs/inline_gnd_reopen_check.mjs   (exit 0 = pass, 1 = fail)
 */

import { parseDocument } from "../../docs/js/editor/tei-document.js";
import { parseEdition } from "../../docs/js/editor/edition.js";
import { readEntities } from "../../docs/js/editor/standoff.js";
import { toInlineGND, fromInlineGND } from "../../docs/js/editor/inline-gnd.js";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

let failures = 0;
function check(label, cond) {
  console.log(`  ${cond ? "ok  " : "FAIL"} ${label}`);
  if (!cond) failures++;
}

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

// The same register-model fixture as inline_gnd_check.mjs: standOff entities (some
// with a GND, some without), a place (lost on export), and a respStmt <name>.
const REG = `<?xml version="1.0" encoding="utf-8"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <teiHeader>
    <fileDesc>
      <titleStmt>
        <title>inline-GND fixture</title>
        <respStmt xml:id="ai"><resp>Machine-generated</resp><name>AI</name></respStmt>
      </titleStmt>
    </fileDesc>
  </teiHeader>
  <standOff>
    <listPerson>
      <person xml:id="pers_gessner"><persName>Conrad Gessner</persName><idno type="GND">118538055</idno></person>
      <person xml:id="pers_anon"><persName>an unidentified hand</persName></person>
    </listPerson>
    <listPlace>
      <place xml:id="plc_zurich"><placeName>Zurich</placeName></place>
    </listPlace>
    <listOrg>
      <org xml:id="org_zb"><orgName>Zentralbibliothek</orgName><idno type="GND">2026353-7</idno></org>
    </listOrg>
    <listBibl>
      <bibl xml:id="wrk_hist"><title>Historia animalium</title><idno type="GND">4126228-1</idno></bibl>
    </listBibl>
  </standOff>
  <text>
    <body>
      <p><name ref="#pers_gessner">Conrad Gessner</name> wrote in <name ref="#plc_zurich">Zurich</name>, held at the <name ref="#org_zb">Zentralbibliothek</name>.</p>
      <p>His <name ref="#wrk_hist">Historia animalium</name> survives, annotated by <name ref="#pers_anon">an unidentified hand</name>; one note from <name ref="#missing_id">somewhere</name>.</p>
    </body>
  </text>
</TEI>`;

const readingText = (raw) => {
  const m = /<body>[\s\S]*<\/body>/.exec(raw);
  return (m ? m[0] : raw).replace(/<[^>]*>/g, "");
};

console.log("inline-GND re-open / import path (fromInlineGND)");

const reg = parseDocument(REG);
const regReading = readingText(reg.raw);
const exported = toInlineGND(reg); // the interchange artifact
const reopened = fromInlineGND(exported); // back into the register model
const raw = reopened.raw;

// --- re-import produced a well-formed register ---
check("re-opened document re-parses (well-formed edition)", (() => {
  try { parseEdition(raw); return true; } catch { return false; }
})());
check("a <standOff> register exists again", raw.includes("<standOff"));
check("no inline ref=\"GND:..\" pointer remains (authority moved to <idno>)",
  !/ref="GND:/.test(raw));

// --- entities recovered into the register ---
const ents = readEntities(reopened);
check("two persons recovered (GND-bearing + no-GND)", ents.persons.length === 2);
check("one org recovered", ents.orgs.length === 1);
check("one work recovered", ents.works.length === 1);
check("place NOT recovered (one-way loss: the format has no placeName)", ents.places.length === 0);

const gndOf = (e) => (e.authorities.find((a) => a.type === "GND") || {}).value || null;
const person = (name) => ents.persons.find((p) => p.name === name);
check("Conrad Gessner recovered with GND 118538055", gndOf(person("Conrad Gessner") || {}) === "118538055");
check("the no-GND person recovered without an authority",
  (person("an unidentified hand") || {}).authorities?.length === 0);
check("Zentralbibliothek (org) recovered with GND 2026353-7", gndOf(ents.orgs[0]) === "2026353-7");
check("Historia animalium (work) recovered with GND 4126228-1", gndOf(ents.works[0]) === "4126228-1");

// --- each recovered entity is linked by an in-text <name ref="#id"> mention ---
const linked = (e) => raw.includes('<name ref="#' + e.id + '">');
check("every recovered entity is linked by a <name ref=\"#id\"> mention",
  [...ents.persons, ...ents.orgs, ...ents.works].every(linked));
check("the place text survives as plain reading text (not re-wrapped)",
  raw.includes("wrote in Zurich,"));

// --- losslessness, the fixed point, and idempotence ---
check("reading text byte-identical through export and re-import",
  readingText(raw) === regReading && readingText(exported.raw) === regReading);

const refixed = toInlineGND(reopened).raw;
const isFixedPoint = refixed === exported.raw;
check("interchange file is a FIXED POINT: toInlineGND(fromInlineGND(file)) === file", isFixedPoint);
if (!isFixedPoint) {
  let i = 0;
  while (i < refixed.length && i < exported.raw.length && refixed[i] === exported.raw[i]) i++;
  console.log(`       first diff at index ${i} (len re-exported ${refixed.length} vs export ${exported.raw.length})`);
  console.log(`       export   : ...${JSON.stringify(exported.raw.slice(Math.max(0, i - 20), i + 20))}`);
  console.log(`       re-export: ...${JSON.stringify(refixed.slice(Math.max(0, i - 20), i + 20))}`);
}
check("re-import is idempotent: fromInlineGND on a register doc returns the SAME doc",
  fromInlineGND(reopened) === reopened);

// --- secondary smoke: the committed synthetic fixture (person + place) ---
const synthPath = join(REPO, "docs", "data", "editor", "zbz-hersch-synthetic.xml");
if (existsSync(synthPath)) {
  const sdoc = parseDocument(readFileSync(synthPath, "utf8"));
  const sReading = readingText(sdoc.raw);
  const sExport = toInlineGND(sdoc);
  const sReopen = fromInlineGND(sExport);
  check("synthetic fixture: re-opened register has persons recovered",
    readEntities(sReopen).persons.length >= 1);
  check("synthetic fixture: place not recovered (one-way loss)",
    readEntities(sReopen).places.length === 0);
  check("synthetic fixture: reading text byte-identical through the round-trip",
    readingText(sReopen.raw) === sReading);
  check("synthetic fixture: fixed point toInlineGND(fromInlineGND(file)) === file",
    toInlineGND(sReopen).raw === sExport.raw);
} else {
  console.log("  --  synthetic fixture absent, skipping secondary smoke");
}

console.log("");
if (failures) {
  console.log(`FAIL: ${failures} check(s) failed.`);
  process.exit(1);
} else {
  console.log("PASS: fromInlineGND lifts inline-GND back into the register; the interchange file is a fixed point.");
  process.exit(0);
}
