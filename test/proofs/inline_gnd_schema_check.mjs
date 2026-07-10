/**
 * Proof: the inline-GND export validates against the REAL ZBZ Hersch schema.
 *
 * This is the schema half of the inline-GND milestone, the one check that measures
 * the project goal directly ("editopia-faehiges TEI, valide gegen zbz_hersch.rng").
 * It reproduces the exact editor workflow on a real object and proves the result is
 * still schema-valid:
 *   1. open a real, unannotated pipeline file (docs/data/pages/<id>/<id>_final.xml
 *      from the zbz-ocr-tei sibling checkout) -- already RNG-valid as it ships;
 *   2. annotate it in the register model through the proven engine
 *      (addEntity + setAuthority(GND) + linkMention), the working format;
 *   3. export with toInlineGND (the decided interchange format);
 *   4. validate the export against data/schema/zbz_hersch.rng via the lxml harness
 *      (test/harness/validate.py) and assert it is absolutely RNG-valid.
 *
 * Green criterion: the export is well-formed, RNG-valid against zbz_hersch.rng with
 * zero errors, the reading text is byte-identical to the input, and the three GND
 * pointers are present inline.
 *
 * Rights / dependency gate: the Hersch objects and the schema live only in the
 * sibling checkout, and validation needs python + lxml. Any of these absent -> SKIP
 * (exit 0), the same stance as zbz_worked_example.mjs.
 *
 * Run: node test/proofs/inline_gnd_schema_check.mjs   (exit 0 = pass/skip, 1 = fail)
 */

import { parseEdition } from "../../docs/js/editor/edition.js";
import { addEntity, setAuthority, linkMention } from "../../docs/js/editor/standoff.js";
import { toInlineGND } from "../../docs/js/editor/inline-gnd.js";
import { readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { check, finish, readingText } from "./_assert.mjs";

function skip(msg) { console.log("SKIP: " + msg); process.exit(0); }

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const GH = resolve(REPO, "..", "..");
const ZBZ = join(GH, "DHCraft", "zbz-ocr-tei");
const RNG = join(ZBZ, "data", "schema", "zbz_hersch.rng");
const VALIDATE = join(REPO, "test", "harness", "validate.py");

// --- dependency / rights gate ----------------------------------------------
const FINAL = ["100", "1000", "101"]
  .map((id) => join(ZBZ, "docs", "data", "pages", id, `${id}_final.xml`))
  .find((p) => existsSync(p));
if (!FINAL) skip("no zbz-ocr-tei sibling _final.xml (rights-encumbered objects not in this checkout)");
if (!existsSync(RNG)) skip("zbz_hersch.rng absent in the sibling checkout");

const py = ["python", "python3", "py"].find((bin) => {
  const r = spawnSync(bin, ["-c", "import lxml"], { encoding: "utf-8" });
  return r.status === 0;
});
if (!py) skip("python with lxml not available (pip install lxml)");

console.log("inline-GND export vs the real zbz_hersch.rng  (carrier: " + FINAL.replace(/\\/g, "/").split("/").slice(-2).join("/") + ")");

// --- 1. open the real, unannotated, already-valid pipeline file -------------
const raw0 = readFileSync(FINAL, "utf8");
const state0 = parseEdition(raw0);
const targets = state0.cells.filter((c) => !c.gap && c.text && c.text.trim().length > 3).slice(0, 3);
check("found three reading cells to annotate", targets.length === 3);

// --- 2. annotate in the register model (the proven engine) ------------------
// Plausible GND-pattern values; the schema cares about the @ref shape, this proof
// about validity, so any GND:[0-9A-Za-z-]+ value exercises it faithfully.
const plan = [
  { id: "pers_t0", type: "person", gnd: "118538055" },
  { id: "org_t1", type: "org", gnd: "2026353-7" },
  { id: "wrk_t2", type: "work", gnd: "4126228-1" },
].map((p, i) => ({ ...p, cellId: targets[i].id, name: targets[i].text.trim() }));

let doc = state0.doc;
for (const p of plan) {
  doc = addEntity(doc, p.type, { id: p.id, name: p.name });
  doc = setAuthority(doc, p.id, "GND", p.gnd);
}
for (const p of plan) {
  const st = parseEdition(doc.raw);
  const cell = st.cells.find((c) => c.id === p.cellId);
  if (cell && cell.node) doc = linkMention(st.doc, cell.node, p.id);
}
check("register model carries a standOff after annotation", doc.raw.includes("<standOff"));
check("three mentions linked in the body", (doc.raw.match(/<name\s+ref="#(?:pers_t0|org_t1|wrk_t2)"/g) || []).length === 3);

// --- 3. export to inline-GND ------------------------------------------------
const gPrime = toInlineGND(doc).raw;
check("export carries no standOff", !gPrime.includes("<standOff"));
check("export carries no '#'-mention", !/<name\s+ref="#/.test(gPrime));
check("export carries the three inline GND pointers",
  gPrime.includes('ref="GND:118538055"') &&
  gPrime.includes('ref="GND:2026353-7"') &&
  gPrime.includes('ref="GND:4126228-1"'));

check("reading text byte-identical to the input", readingText(gPrime) === readingText(raw0));

// --- 4. validate the export against the real schema -------------------------
const candPath = join(tmpdir(), "tcr_inline_gnd_candidate.xml");
writeFileSync(candPath, gPrime, "utf8");
let report = null;
try {
  const r = spawnSync(py, [VALIDATE, "--input", FINAL, "--candidate", candPath, "--rng", RNG], { encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 });
  try { report = JSON.parse(r.stdout); } catch { console.log(r.stdout || ""); console.log(r.stderr || ""); }
} finally {
  try { unlinkSync(candPath); } catch { /* ignore */ }
}
check("validation harness returned a report", !!report);
if (report) {
  const l2 = report.levels && report.levels.L2 ? report.levels.L2 : {};
  const rng = l2.rng || {};
  check("export is well-formed", l2.wellFormed === true);
  check("export is RNG-valid against zbz_hersch.rng (zero errors)", rng.valid === true);
  if (rng.valid !== true) {
    for (const e of (rng.errors || []).slice(0, 8)) console.log("    L" + e.line + "  " + e.message);
  }
}

finish("PASS: a real pipeline file annotated in the register model and exported with toInlineGND is RNG-valid against zbz_hersch.rng.");
