/**
 * Proof: the inline-GND export profile (toInlineGND) produces the ZBZ Hersch
 * interchange shape from a register-model document, losslessly in the reading text.
 *
 * This is the structural half of the inline-GND milestone (the schema half, real
 * validation against zbz_hersch.rng, is inline_gnd_schema_check.mjs). It runs on a
 * self-contained synthetic register-model fixture (no rights, no sibling checkout)
 * that exercises every branch:
 *   - person WITH a GND        -> <persName ref="GND:..">
 *   - person WITHOUT a GND     -> <persName> (no @ref; @ref is optional in the schema)
 *   - org WITH a GND           -> <orgName ref="GND:..">
 *   - work WITH a GND          -> <bibl ref="GND:..">
 *   - place mention            -> unwrapped to plain text (no placeName in the format)
 *   - mention to a MISSING id  -> unwrapped to plain text
 *   - a <name> with no '#'-ref -> untouched (the respStmt <name>AI</name>)
 *   - the <standOff> register   -> removed
 *
 * Acceptance contract asserted here: every emitted @ref matches GND:[0-9A-Za-z\-]+,
 * no standOff and no '#'-mention remain, the reading text is byte-identical, the
 * output re-parses, and a second pass is a no-op (idempotent).
 *
 * Run: node test/proofs/inline_gnd_check.mjs   (exit 0 = pass, 1 = fail)
 */

import { parseDocument } from "../../docs/js/editor/tei-document.js";
import { parseEdition } from "../../docs/js/editor/edition.js";
import { toInlineGND, inlineGndFilename } from "../../docs/js/editor/inline-gnd.js";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

let failures = 0;
function check(label, cond) {
  console.log(`  ${cond ? "ok  " : "FAIL"} ${label}`);
  if (!cond) failures++;
}

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

// A register-model document: standOff entities (some with a GND idno, some without)
// and in-text <name ref="#id"> mentions, plus a respStmt <name> that must survive.
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

console.log("inline-GND export profile (toInlineGND)");

const before = parseDocument(REG);
const beforeReading = readingText(before.raw);
const out = toInlineGND(before);
const raw = out.raw;

// --- the structural contract ---
check("output re-parses (well-formed edition)", (() => {
  try { parseEdition(raw); return true; } catch { return false; }
})());
check("no <standOff> remains", !raw.includes("<standOff"));
check("no '#'-mention remains (<name ref=\"#...\">)", !/<name\s+ref="#/.test(raw));

// every emitted @ref on a typed element is a well-formed GND pointer
const refs = [...raw.matchAll(/<(?:persName|orgName|bibl)\s+ref="([^"]*)"/g)].map((m) => m[1]);
check("the three GND-bearing mentions were emitted with a @ref (person, org, work)", refs.length === 3);
check("every emitted @ref matches GND:[0-9A-Za-z-]+", refs.every((r) => /^GND:[0-9A-Za-z-]+$/.test(r)));

// --- per-branch shape ---
check("person WITH GND -> <persName ref=\"GND:118538055\">Conrad Gessner</persName>",
  raw.includes('<persName ref="GND:118538055">Conrad Gessner</persName>'));
check("person WITHOUT GND -> <persName> with no @ref",
  raw.includes("<persName>an unidentified hand</persName>"));
check("org WITH GND -> <orgName ref=\"GND:2026353-7\">",
  raw.includes('<orgName ref="GND:2026353-7">Zentralbibliothek</orgName>'));
check("work WITH GND -> <bibl ref=\"GND:4126228-1\">",
  raw.includes('<bibl ref="GND:4126228-1">Historia animalium</bibl>'));
check("place mention unwrapped to plain text (no placeName, no <name>)",
  raw.includes("wrote in Zurich,") && !raw.includes("placeName") && !raw.includes('"#plc_zurich"'));
check("missing-entity mention unwrapped to plain text",
  raw.includes("one note from somewhere.") && !raw.includes("missing_id"));
check("respStmt <name>AI</name> is untouched (no '#'-ref, not a mention)",
  raw.includes("<name>AI</name>"));

// --- losslessness and idempotence ---
check("reading text is byte-identical (body text unchanged)", readingText(raw) === beforeReading);
check("idempotent: a second pass returns the SAME doc", toInlineGND(out) === out);

// --- the export filename helper (the download names the pipeline's _final.xml) ---
check("inlineGndFilename appends _final.xml to a working name",
  inlineGndFilename("zbz-hersch-100.xml") === "zbz-hersch-100_final.xml");
check("inlineGndFilename is idempotent on an already-final name",
  inlineGndFilename("x_final.xml") === "x_final.xml");
check("inlineGndFilename falls back when the name is missing",
  inlineGndFilename(null) === "edition_final.xml");

// --- secondary smoke: the committed synthetic register fixture (person + place) ---
const synthPath = join(REPO, "docs", "data", "editor", "zbz-hersch-synthetic.xml");
if (existsSync(synthPath)) {
  const sdoc = parseDocument(readFileSync(synthPath, "utf8"));
  const sBefore = readingText(sdoc.raw);
  const sOut = toInlineGND(sdoc).raw;
  check("synthetic fixture: no standOff, no '#'-mention after export",
    !sOut.includes("<standOff") && !/<name\s+ref="#/.test(sOut));
  check("synthetic fixture: person mention became <persName>",
    sOut.includes("<persName>Marguerite Vautier</persName>"));
  check("synthetic fixture: place mention unwrapped to plain text",
    sOut.includes("wrote from Geneva that"));
  check("synthetic fixture: reading text byte-identical", readingText(sOut) === sBefore);
} else {
  console.log("  --  synthetic fixture absent, skipping secondary smoke");
}

console.log("");
if (failures) {
  console.log(`FAIL: ${failures} check(s) failed.`);
  process.exit(1);
} else {
  console.log("PASS: toInlineGND produces the inline-GND ZBZ shape, reading text byte-preserved.");
  process.exit(0);
}
