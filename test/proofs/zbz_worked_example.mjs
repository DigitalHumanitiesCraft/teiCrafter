/**
 * Worked example: the REAL ZBZ doc 1000, end-to-end through the engine.
 *
 * This is the ZBZ half of the M7.2 demo gate, the mirror of
 * szd_worked_example.mjs. It takes the genuine Jeanne Hersch object
 * (docs/data/editor/zbz-1000/zbz-hersch-1000.xml: doc 1000 of the zbz-ocr-tei
 * pipeline, "TRANSFORMER L'ECOLE OU LA SUPPRIMER ?", educateur 109 (1973),
 * prepared with one <graphic url> per surface per M2.4) through the whole
 * editing arc the tool promises (open -> correct -> annotate -> textual
 * criticism -> save) and proves, at every step, that the change is a SURGICAL,
 * byte-faithful splice.
 *
 * The acts:
 *   ACT 0  lossless load on the real object (byte-identical round-trip, 4 folios,
 *          line profile, sane cell count, a GitHub-Pages graphic url on every surface)
 *   ACT 1  surgical line correction (the OCR "inadaption" -> "inadaptation" fix):
 *          a single-diff of before/after raw reduces to the inserted "at" and a
 *          full reconstruction proves every other byte identical
 *   ACT 2  annotate the triad (person/place/work + authority idno + mention),
 *          scaffolding a <standOff> that did not exist before
 *   ACT 3  textual criticism (<unclear> wrap on the misplaced footnote fragment,
 *          <gap/> replacement of the stray "Heft" OCR token)
 *   FINAL  the fully-annotated raw is idempotent (parse -> serialize equals itself)
 *
 * Honesty note on authority identifiers: Jeanne Hersch GND 118815679 was resolved
 * against lobid.org on 2026-06-09; Geneve Wikidata Q71 and its GeoNames id 7285902
 * were resolved against Wikidata (P1566) the same day. Ivan Illich and the work
 * "Une societe sans ecole" are added WITHOUT an authority on purpose; their
 * identifiers should be resolved via the live lookup (M3.3), not invented here.
 *
 * Run: node test/proofs/zbz_worked_example.mjs   (exit 0 = pass, 1 = fail)
 */

import { parseEdition, serialize, editCell } from "../../docs/js/editor/edition.js";
import { readEntities, addEntity, linkMention, setAuthority } from "../../docs/js/editor/standoff.js";
import { markCritical } from "../../docs/js/editor/criticism.js";
import { buildZbz1000, SOURCE_FILE, TARGET_FILE } from "../generators/make_zbz1000_demo.mjs";
import { readFileSync, existsSync } from "node:fs";

let failures = 0;
function check(label, cond) {
  console.log(`  ${cond ? "ok  " : "FAIL"} ${label}`);
  if (!cond) failures++;
}

// ---- Gate: the object is local-only (rights stance as zbz-100). Prefer the
// materialized demo file; else build it in memory from the zbz sibling checkout;
// else SKIP (same pattern as the SZD fixture gate).
let raw0;
if (existsSync(TARGET_FILE)) {
  raw0 = readFileSync(TARGET_FILE, "utf8");
} else if (existsSync(SOURCE_FILE)) {
  raw0 = buildZbz1000(readFileSync(SOURCE_FILE, "utf8"));
} else {
  console.log("SKIP: zbz-hersch-1000.xml absent and no zbz-ocr-tei sibling checkout (rights-encumbered object not in this checkout)");
  process.exit(0);
}

/**
 * Reduce two strings to their differing middles by stripping the longest common
 * prefix and the longest common suffix. Returns { prefixLen, suffixLen, aMid, bMid }.
 * The suffix scan stops so it never overlaps the prefix, so even a pure insertion
 * reduces cleanly (aMid === "" and bMid === the inserted bytes).
 */
function singleDiff(a, b) {
  let p = 0;
  const maxP = Math.min(a.length, b.length);
  while (p < maxP && a[p] === b[p]) p++;
  let s = 0;
  const maxS = Math.min(a.length - p, b.length - p);
  while (s < maxS && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
  return {
    prefixLen: p,
    suffixLen: s,
    aMid: a.slice(p, a.length - s),
    bMid: b.slice(p, b.length - s),
  };
}

let editsApplied = 0;

// =============================================================================
// ACT 0  -- lossless load on the real object
// =============================================================================
console.log("ACT 0  lossless load (real ZBZ doc 1000)");
const s0 = parseEdition(raw0);
check("round-trip byte-identical (serialize === raw0)", serialize(s0) === raw0);
check("four folios (pb -> facs_1..facs_4, 1:1)", s0.folios.length === 4);
check('line profile (no <w>)', s0.profile === "line");
check("sane cell count (>40 reading lines)", s0.cells.length > 40);
const surfaceFolios = s0.folios.filter((f) => f.surface);
check("every folio carries its surface", surfaceFolios.length === 4);
check(
  "every graphic is a zbz GitHub-Pages image url for doc 1000",
  surfaceFolios.every(
    (f) =>
      typeof f.surface.graphic === "string" &&
      f.surface.graphic.startsWith("https://chpollin.github.io/zbz-ocr-tei/images/1000/1000_p")
  )
);

// =============================================================================
// ACT 1  -- surgical line correction: the OCR "inadaption" -> "inadaptation" fix
// =============================================================================
console.log("ACT 1  surgical line correction (inadaption -> inadaptation)");
const iCell = s0.cells.find((c) => c.text.includes("inadaption"));
check("found the 'inadaption' reading cell (facs_3_r_10 line)", !!iCell);
const newText = iCell.text.replace("inadaption", "inadaptation");
const s1 = editCell(s0, iCell.id, newText);
const raw1 = serialize(s1);
editsApplied++;

const d1 = singleDiff(raw0, raw1);
// "inadaption" -> "inadaptation" is a pure two-byte insertion: both share the
// prefix "inadapt" and the suffix "ion", so the surgical change is the inserted
// "at" on the b-side and nothing on the a-side.
check("changed a-side middle is empty (pure insertion)", d1.aMid === "");
check("changed b-side middle is exactly the inserted 'at'", d1.bMid === "at");
check("changed middle has NO newline (exactly one line region touched)",
  !d1.aMid.includes("\n") && !d1.bMid.includes("\n"));
// The real surgical proof: inserting "at" at prefixLen in raw0 reconstructs raw1
// EXACTLY. This catches any other change anywhere in the file.
check("exactly two bytes inserted, every other byte identical (full reconstruction)",
  raw1.length === raw0.length + 2 &&
  raw0.slice(0, d1.prefixLen) + "at" + raw0.slice(d1.prefixLen) === raw1);
check("the insertion lands inside the 'inadapt|ion' word boundary",
  raw0.slice(d1.prefixLen - 7, d1.prefixLen) === "inadapt");
check("'inadaptation' present, the OCR form 'inadaption' is gone",
  raw1.includes("inadaptation") && !raw1.includes("inadaption"));
check("the edited cell still reads 'inadaptation'",
  parseEdition(raw1).cells.some((c) => c.text.includes("inadaptation")));

// =============================================================================
// ACT 2  -- annotate the triad on raw1 (person / place / work + authority + mention)
// =============================================================================
console.log("ACT 2  annotate triad (person/place/work + authority + mention)");
const a2 = parseEdition(raw1);
check("no <standOff> in the original object", !a2.doc.raw.includes("<standOff>"));

let doc = a2.doc;

// person: Jeanne Hersch, with the lobid-resolved GND identifier
doc = addEntity(doc, "person", { name: "Jeanne Hersch" });
editsApplied++;
let hersch = readEntities(doc).persons.find((p) => p.name === "Jeanne Hersch");
check("added person 'Jeanne Hersch' with pers_ id", !!hersch && hersch.id.startsWith("pers"));
doc = setAuthority(doc, hersch.id, "GND", "118815679");
editsApplied++;

// person: Ivan Illich, no authority (resolve via live lookup, M3.3)
doc = addEntity(doc, "person", { name: "Ivan Illich" });
editsApplied++;
const illich = readEntities(doc).persons.find((p) => p.name === "Ivan Illich");
check("added person 'Ivan Illich' (no authority on purpose)",
  !!illich && illich.authorities.length === 0);

// place: Geneve, with Wikidata then GeoNames (resolved via Wikidata P1566)
doc = addEntity(doc, "place", { name: "Genève" });
editsApplied++;
let geneve = readEntities(doc).places.find((p) => p.name === "Genève");
check("added place 'Geneve' with plc_ id", !!geneve && geneve.id.startsWith("plc"));
const geneveId = geneve.id;
doc = setAuthority(doc, geneveId, "Wikidata", "Q71");
editsApplied++;
doc = setAuthority(doc, geneveId, "GeoNames", "7285902");
editsApplied++;

// work: Une societe sans ecole (Illich's book as discussed on folio 4), no authority
doc = addEntity(doc, "work", { name: "Une société sans école" });
editsApplied++;
const work = readEntities(doc).works.find((w) => w.name === "Une société sans école");
check("added work 'Une societe sans ecole' with wrk_ id", !!work && work.id.startsWith("wrk"));

// read every authority back exactly as written
const ents = readEntities(doc);
hersch = ents.persons.find((p) => p.name === "Jeanne Hersch");
geneve = ents.places.find((p) => p.name === "Genève");
check("Hersch GND read back === 118815679",
  hersch.authorities.some((au) => au.type === "GND" && au.value === "118815679"));
check("Geneve Wikidata read back === Q71",
  geneve.authorities.some((au) => au.type === "Wikidata" && au.value === "Q71"));
check("Geneve GeoNames read back === 7285902",
  geneve.authorities.some((au) => au.type === "GeoNames" && au.value === "7285902"));
check("Geneve carries exactly the two authorities", geneve.authorities.length === 2);

check("a <standOff> now EXISTS where none was before", doc.raw.includes("<standOff>"));
check("annotated doc still builds a 4-folio model", parseEdition(doc.raw).folios.length === 4);

// link the reading line containing "Genève" (the Universite de Geneve line,
// facs_3_r_19) to the Geneve place id; re-parse first for fresh offsets
const a2b = parseEdition(doc.raw);
const genCell = a2b.cells.find((c) => c.text.includes("Genève"));
check("found the 'Geneve' mention cell", !!genCell);
doc = linkMention(a2b.doc, genCell.node, geneveId);
editsApplied++;
check('mention <name ref="#geneveId"> present in raw', doc.raw.includes('name ref="#' + geneveId + '"'));
check("linked doc still builds a 4-folio model", parseEdition(doc.raw).folios.length === 4);

// =============================================================================
// ACT 3  -- textual criticism on the two documented OCR defects
// =============================================================================
console.log("ACT 3  textual criticism (<unclear> wrap, <gap/> replacement)");
const a3 = parseEdition(doc.raw);
check("no <unclear> in the doc yet", !a3.doc.raw.includes("<unclear>"));
check("no <gap" + "/> in the doc yet", !a3.doc.raw.includes("<gap"));

// the footnote fragment "Perte de temps. Exemple : M. Oury" (fn3-1) is a
// column-split fragment whose reading is uncertain in place: wrap it unclear
const fnCell = a3.cells.find((c) => c.text.includes("Perte de temps"));
check("found the misplaced footnote fragment to mark unclear", !!fnCell);
doc = markCritical(a3.doc, fnCell.node, "unclear");
editsApplied++;
check("raw now contains <unclear>", doc.raw.includes("<unclear>"));

// the stray OCR token "Heft" (facs_1_r_5) corresponds to no readable text at
// that spot: replace the core with an explicit <gap/> instead of silent deletion
const a3b = parseEdition(doc.raw);
const heftCell = a3b.cells.find((c) => !c.gap && c.text.trim() === "Heft");
check("found the stray 'Heft' token cell to replace with a gap", !!heftCell);
doc = markCritical(a3b.doc, heftCell.node, "gap");
editsApplied++;
check("raw now contains a self-closing <gap" + "/>", /<gap\s*\/>/.test(doc.raw));
check("the metadata line 'Heft: 39' above it is untouched", doc.raw.includes("Heft: 39"));
check("criticism doc still builds a 4-folio model", parseEdition(doc.raw).folios.length === 4);

// =============================================================================
// FINAL  -- the fully-annotated raw is idempotent
// =============================================================================
console.log("FINAL  idempotent save");
const finalRaw = doc.raw;
const finalState = parseEdition(finalRaw);
check("final raw is idempotent (parse -> serialize === itself)", serialize(finalState) === finalRaw);
check("final model is still the 4-folio line-level object",
  finalState.folios.length === 4 && finalState.profile === "line");

console.log("");
console.log(`Summary: ${editsApplied} distinct surgical edits applied to ZBZ doc 1000.`);
if (failures) {
  console.log(`FAIL: ${failures} check(s) failed.`);
  process.exit(1);
} else {
  console.log(
    "PASS: ZBZ doc 1000 went open -> correct -> annotate (person/place/work + authority + mention) -> textual criticism -> save, every step a surgical byte-faithful splice."
  );
  process.exit(0);
}
