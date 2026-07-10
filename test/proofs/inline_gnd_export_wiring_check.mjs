/**
 * Proof: the editor's inline-GND EXPORT PATH serializes exactly the engine result
 * over the canonical current document.
 *
 * This pins the wiring the "Export inline-GND" button drives (editor-app.js
 * `downloadInlineGND`): it transforms `app.state.doc` with `toInlineGND` and
 * downloads `toInlineGND(app.state.doc).raw` under `inlineGndFilename(docName)`.
 * Where `inline_gnd_check.mjs` proves the transform at the tei-document layer,
 * this proof goes through the EDITION layer (`parseEdition` / `serialize` /
 * `state.doc`), the data path the editor actually uses, and adds the two
 * invariants a UI download depends on:
 *   1. the bytes the button transforms ARE the canonical current document
 *      (`serialize(state) === state.doc.raw`), so the export is never a stale
 *      snapshot, and it reflects an in-editor edit;
 *   2. the download filename derives correctly (`inlineGndFilename`).
 *
 * No DOM: the button handler is a three-liner over pure functions, so its
 * contract is fully expressible headless. The browser sight-check of the button
 * itself is VC-15 (the operator spur), not part of this green criterion.
 *
 * Run: node test/proofs/inline_gnd_export_wiring_check.mjs   (exit 0 = pass, 1 = fail)
 */

import { parseEdition, serialize, editCellCore } from "../../docs/js/editor/edition.js";
import { toInlineGND, inlineGndFilename } from "../../docs/js/editor/inline-gnd.js";

let failures = 0;
function check(label, cond) {
  console.log(`  ${cond ? "ok  " : "FAIL"} ${label}`);
  if (!cond) failures++;
}

// A register-model document: one person mention WITH a GND, one place mention
// (unwraps on export), and a plain editable line with no markup.
const REG = `<?xml version="1.0" encoding="utf-8"?>
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

const bodyText = (raw) => {
  const m = /<body>[\s\S]*<\/body>/.exec(raw);
  return (m ? m[0] : raw).replace(/<[^>]*>/g, "");
};

console.log("inline-GND export wiring (editor download path)");

const state = parseEdition(REG);

// 1. The button transforms the canonical current document, not a copy that could
//    drift: serialize(state) is exactly the doc toInlineGND receives.
check("the export reads the canonical document (serialize(state) === state.doc.raw)",
  serialize(state) === state.doc.raw);

// 2. The export path output is the engine result serialized.
const beforeReading = bodyText(state.doc.raw);
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
const refs = [...exported.matchAll(/<(?:persName|orgName|bibl)\s+ref="([^"]*)"/g)].map((m) => m[1]);
check("every emitted @ref matches GND:[0-9A-Za-z-]+", refs.length === 1 && /^GND:[0-9A-Za-z-]+$/.test(refs[0]));
check("reading text byte-identical through the export", bodyText(exported) === beforeReading);

// 3. Idempotence at the doc level: a second pass returns the SAME doc object, so
//    its bytes are unchanged (a re-export of an already-inline doc is a no-op).
const once = toInlineGND(state.doc);
check("idempotent: a second export pass is a SAME-doc no-op", toInlineGND(once) === once);

// 4. The export reflects an in-editor edit: edit a reading cell, re-export, and
//    the change is in the output (the path serializes the CURRENT state). This is
//    the wiring guarantee a UI download depends on.
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

console.log("");
if (failures) {
  console.log(`FAIL: ${failures} check(s) failed.`);
  process.exit(1);
} else {
  console.log("PASS: the export path serializes the engine result over the canonical document.");
  process.exit(0);
}
