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
 * The final section is the EDITION-LAYER WIRING block (formerly its own proof): it
 * pins the data path the "Export inline-GND" button drives, going through the
 * edition layer (parseEdition / serialize / state.doc) rather than the tei-document
 * layer, and adds the two invariants a UI download depends on: the transformed bytes
 * ARE the canonical current document (serialize(state) === state.doc.raw), and the
 * export reflects an in-editor edit.
 *
 * Acceptance contract asserted here: every emitted @ref matches GND:[0-9A-Za-z\-]+,
 * no standOff and no '#'-mention remain, the reading text is byte-identical, the
 * output re-parses, and a second pass is a no-op (idempotent).
 *
 * Run: node test/proofs/inline_gnd_check.mjs   (exit 0 = pass, 1 = fail)
 */

import { parseDocument } from "../../docs/js/editor/tei-document.js";
import { parseEdition, serialize, editCellCore } from "../../docs/js/editor/edition.js";
import { toInlineGND, inlineGndFilename } from "../../docs/js/editor/inline-gnd.js";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { check, section, finish, readingText } from "./_assert.mjs";

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

section("inline-GND export profile (toInlineGND)");

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

// =============================================================================
// EDITION-LAYER WIRING  -- the "Export inline-GND" button path (editor download)
// =============================================================================
// This goes through the EDITION layer (parseEdition / serialize / state.doc), the
// data path the editor actually uses, and pins the invariants a UI download needs:
// the bytes transformed ARE the canonical current document, and the export reflects
// an in-editor edit. A register-model document: one person mention WITH a GND, one
// place mention (unwraps on export), and a plain editable line with no markup.
const REG_WIRING = `<?xml version="1.0" encoding="utf-8"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <teiHeader>
    <fileDesc><titleStmt><title>wiring fixture</title></titleStmt></fileDesc>
  </teiHeader>
  <standOff>
    <listPerson>
      <person xml:id="pers_h"><persName>Jeanne Hersch</persName><idno type="GND">118703854</idno></person>
    </listPerson>
    <listPlace>
      <place xml:id="plc_g"><placeName>Geneva</placeName></place>
    </listPlace>
  </standOff>
  <text>
    <body>
      <p><name ref="#pers_h">Jeanne Hersch</name> wrote from <name ref="#plc_g">Geneva</name>.</p>
      <p>A plain line to edit.</p>
    </body>
  </text>
</TEI>`;

section("inline-GND export wiring (editor download path)");

const state = parseEdition(REG_WIRING);

// 1. The button transforms the canonical current document, not a copy that could
//    drift: serialize(state) is exactly the doc toInlineGND receives.
check("the export reads the canonical document (serialize(state) === state.doc.raw)",
  serialize(state) === state.doc.raw);

// 2. The export path output is the engine result serialized.
const wiringBefore = readingText(state.doc.raw);
const exported = toInlineGND(state.doc).raw;

check("export output re-parses as an edition", (() => {
  try { parseEdition(exported); return true; } catch { return false; }
})());
check("export drops the <standOff> register", !exported.includes("<standOff"));
check("export leaves no '#'-mention (<name ref=\"#...\">)", !/<name\s+ref="#/.test(exported));
check("person WITH GND inlined as <persName ref=\"GND:118703854\">",
  exported.includes('<persName ref="GND:118703854">Jeanne Hersch</persName>'));
check("place mention unwrapped to plain text (no placeName, no register ref)",
  exported.includes("wrote from Geneva.") && !exported.includes("placeName") && !exported.includes('"#plc_g"'));
const wiringRefs = [...exported.matchAll(/<(?:persName|orgName|bibl)\s+ref="([^"]*)"/g)].map((m) => m[1]);
check("every emitted @ref matches GND:[0-9A-Za-z-]+", wiringRefs.length === 1 && /^GND:[0-9A-Za-z-]+$/.test(wiringRefs[0]));
check("reading text byte-identical through the export", readingText(exported) === wiringBefore);

// 3. Idempotence at the doc level: a second pass returns the SAME doc object.
const once = toInlineGND(state.doc);
check("idempotent: a second export pass is a SAME-doc no-op", toInlineGND(once) === once);

// 4. The export reflects an in-editor edit: edit a reading cell, re-export, and
//    the change is in the output (the path serializes the CURRENT state).
const plainCell = state.cells.find((c) => /plain line to edit/.test(c.text));
check("fixture exposes the editable plain line as a cell", !!plainCell);
const edited = editCellCore(state, plainCell.id, "An edited line to export.");
const exportedAfterEdit = toInlineGND(edited.doc).raw;
check("export after an edit carries the new reading text",
  exportedAfterEdit.includes("An edited line to export.") && !exportedAfterEdit.includes("A plain line to edit."));
check("export after an edit still drops the register and inlines the GND mention",
  !exportedAfterEdit.includes("<standOff") && exportedAfterEdit.includes('<persName ref="GND:118703854">'));

// 5. The download filename: {base}_final.xml, idempotent on an already-final name.
check("inlineGndFilename names the download {base}_final.xml",
  inlineGndFilename("zbz-hersch-100.xml") === "zbz-hersch-100_final.xml");
check("inlineGndFilename is idempotent on an already-final name",
  inlineGndFilename("zbz-hersch-100_final.xml") === "zbz-hersch-100_final.xml");
check("inlineGndFilename falls back when the document name is missing",
  inlineGndFilename(null) === "edition_final.xml");

finish("PASS: toInlineGND produces the inline-GND ZBZ shape, reading text byte-preserved, and the editor download path serializes the engine result over the canonical document.");
