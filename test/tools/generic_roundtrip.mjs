/**
 * Headless proof for the GENERIC TEI document core (docs/js/editor/tei-document.js).
 *
 * Claim under test: one engine reads ARBITRARY TEI losslessly and edits it by
 * offset splice, with no project-specific profile. We verify on:
 *   - real Jeanne Hersch edition TEI (zbz-ocr-tei, line-level, no <w>, real zones)
 *   - real SZD metadata TEI (catalog model, no text/pb/facsimile)
 *   - the Wenzelsbibel synthetic (word-level <w xml:id>)
 *   - synthetic edge cases (comments, CDATA, PI, entities, attr containing '>')
 *
 * Real third-party files live under test/fixtures/ (gitignored). If they are
 * absent the real-data checks are skipped (reported), not failed.
 *
 * Run: node test/tools/generic_roundtrip.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseDocument, tokenize,
  textNodes, textOf, elementsByLocal, getAttr, facsPointer,
  readSurfaces, readingRoot, isReadingText, countLocals,
  editTextNode, escapeText,
} from "../../docs/js/editor/tei-document.js";
import { parseEdition, editWordText, serialize } from "../../docs/js/editor/edition.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const TEST = resolve(HERE, "..");
const real = (f) => join(TEST, "fixtures", "real", f);
const synth = (f) => join(TEST, "fixtures-synthetic", f);
const docs = (f) => resolve(TEST, "..", "docs", f);

const checks = [];
const expect = (name, ok) => checks.push({ name, ok: !!ok });
const skips = [];

// ---- 1. tokenizer is contiguous + lossless on every available source -------

function identityOK(raw) {
  // every token slice concatenates back to the input
  const toks = tokenize(raw);
  let concat = "";
  for (const t of toks) concat += raw.slice(t.start, t.end);
  const tokensCover = concat === raw;
  // and the parsed document serializes byte-identically
  const serialOK = parseDocument(raw).serialize() === raw;
  return tokensCover && serialOK;
}

const sources = [
  { id: "wb-synthetic-folio", path: synth("wb-synthetic-folio.xml") },
  { id: "wb-synthetic-codex", path: docs("data/editor/wenzelsbibel-synthetic-codex.xml") },
  { id: "hersch-100", path: real("hersch-100_final.xml") },
  { id: "hersch-110 (large)", path: real("hersch-110_final.xml") },
  { id: "szd_werke (metadata)", path: real("szd_werke_tei.xml") },
];

const loaded = {};
for (const s of sources) {
  if (!existsSync(s.path)) { skips.push(s.id); continue; }
  const raw = readFileSync(s.path, "utf-8");
  loaded[s.id] = raw;
  expect(`identity round-trip is byte-identical: ${s.id} (${raw.length} bytes)`, identityOK(raw));
}

// ---- 2. edge cases the tokenizer must survive ------------------------------

const edge = [
  `<?xml version='1.0' encoding='utf-8'?>`,
  `<!-- a comment with <not a tag> & ampersand -->`,
  `<?pi target data?>`,
  `<r a="value with > gt and ' apos" b='has " quote'>`,
  `<![CDATA[ raw <w>not</w> & stuff ]]>`,
  `text &amp; more &#233; &#x2014;`,
  `<self closing="x"/></r>`,
].join("\n");
expect("edge cases: tokens cover input exactly", tokenize(edge).reduce((acc, t) => acc + edge.slice(t.start, t.end), "") === edge);
expect("edge cases: serialize is byte-identical", parseDocument(edge).serialize() === edge);
{
  const d = parseDocument(`<r a="value with > gt and ' apos" b='has &quot; quote'/>`);
  const r = elementsByLocal(d.root, "r")[0];
  expect("edge cases: attr with '>' inside quotes parses (a)", getAttr(r, "a") === "value with > gt and ' apos");
  expect("edge cases: single-quoted attr parses (b)", getAttr(r, "b") === 'has " quote');
}

// ---- 3. generic recognizers on REAL Hersch TEI (line-level, no <w>) ---------

if (loaded["hersch-100"]) {
  const raw = loaded["hersch-100"];
  const doc = parseDocument(raw);

  const pbs = elementsByLocal(doc.root, "pb");
  expect("hersch: at least one <pb> (folio marker)", pbs.length >= 1);
  expect("hersch: first <pb> @facs resolves to a surface id", facsPointer(pbs[0]) === "facs_1");

  const { surfaces } = readSurfaces(doc);
  expect("hersch: >=1 surface with numeric extent", surfaces.length >= 1 && surfaces[0].lrx > 0);
  expect("hersch: surface has zones with pixel coords", surfaces[0].zones.length >= 1 && surfaces[0].zones[0].lrx > surfaces[0].zones[0].ulx);

  const lbs = elementsByLocal(doc.root, "lb");
  expect("hersch: line milestones <lb> present", lbs.length >= 1);
  const zoneIds = new Set();
  for (const s of surfaces) { if (s.id) zoneIds.add(s.id); for (const z of s.zones) if (z.id) zoneIds.add(z.id); }
  const lbWithFacs = lbs.find((lb) => facsPointer(lb));
  expect("hersch: <lb> @facs resolves to a real <zone>", !!lbWithFacs && zoneIds.has(facsPointer(lbWithFacs)));
  expect("hersch: has NO <w> tokens (line-level edition)", elementsByLocal(doc.root, "w").length === 0);

  // editable reading text = text nodes that are not in teiHeader/facsimile/standOff
  const reading = textNodes(readingRoot(doc)).filter(isReadingText).filter((t) => textOf(doc, t).trim());
  expect("hersch: generic engine finds reading-text lines", reading.length >= 3);
  const target = reading.find((t) => textOf(doc, t).includes("Exister, au sens de Jaspers"));
  expect("hersch: located the 'Exister...' line as one editable text node", !!target);

  // surgical line edit (an OCR fix), via the SAME editTextNode used by the UI
  if (target) {
    const before = textOf(doc, target);
    const after = before.replace("Exister", "EXISTER");
    const edited = editTextNode(doc, target, after);
    const expectedRaw = raw.slice(0, target.start) + escapeText(after) + raw.slice(target.end);
    expect("hersch: line edit is surgical (only that text run changed)", edited.serialize() === expectedRaw);
    expect("hersch: element counts unchanged after edit",
      JSON.stringify(countLocals(edited, ["pb", "lb", "p", "surface", "zone", "note", "w"])) ===
      JSON.stringify(countLocals(doc, ["pb", "lb", "p", "surface", "zone", "note", "w"])));
    const reReading = textNodes(readingRoot(edited)).filter(isReadingText).map((t) => textOf(edited, t));
    expect("hersch: edited line now reads the corrected text", reReading.some((t) => t.includes("EXISTER, au sens")));
  }
}

// ---- 4. same engine on the Wenzelsbibel synthetic (word-level <w>) ----------

if (loaded["wb-synthetic-folio"]) {
  const raw = loaded["wb-synthetic-folio"];
  const doc = parseDocument(raw);
  const ws = elementsByLocal(doc.root, "w");
  expect("wb: word tokens <w> present (word-level edition)", ws.length === 12);
  // the text node inside w_1_3 ("anegenge") is just another editable text node
  const w13 = ws.find((w) => getAttr(w, "id") === "w_1_3");
  const tn = w13 && w13.children.find((c) => c.type === "text");
  expect("wb: w_1_3 text node = 'anegenge'", tn && textOf(doc, tn) === "anegenge");
  if (tn) {
    const edited = editTextNode(doc, tn, "aneginne");
    const expectedRaw = raw.slice(0, tn.start) + "aneginne" + raw.slice(tn.end);
    expect("wb: word edit is surgical (same generic mechanism)", edited.serialize() === expectedRaw);
  }
}

// ---- 5. same engine on SZD metadata TEI (no text/pb/facsimile) --------------

if (loaded["szd_werke (metadata)"]) {
  const doc = parseDocument(loaded["szd_werke (metadata)"]);
  expect("szd: parses with no <pb>/<facsimile> (catalog model, still lossless)",
    elementsByLocal(doc.root, "pb").length === 0 && elementsByLocal(doc.root, "facsimile").length === 0);
  expect("szd: generic recognizer still finds bibl records", elementsByLocal(doc.root, "biblFull").length > 0);
}

// ---- 6. editor model shape (the structure editor-app.js actually renders) ---

if (loaded["hersch-100"]) {
  const st = parseEdition(loaded["hersch-100"]);
  expect("model(hersch): profile detected as 'line'", st.profile === "line");
  expect("model(hersch): folios split by <pb>", st.folios.length >= 1);
  const f0 = st.folios[0];
  expect("model(hersch): folio has non-empty lines with cells", f0.lines.length >= 1 && f0.lines.every((l) => l.cells.length >= 1));
  expect("model(hersch): lines carry a real @facs zone id", f0.lines.some((l) => /^facs_/.test(l.facs || "")));
  // edit a line through the editor's public API (by cell id), confirm lossless splice
  const line = f0.lines.find((l) => l.cells.some((c) => c.text.includes("Exister")));
  if (line) {
    const cell = line.cells.find((c) => c.text.includes("Exister"));
    const edited = editWordText(st, cell.id, cell.text.replace("Exister", "EXISTER"));
    const expectedRaw = st.raw.slice(0, cell.start) + escapeText(cell.text.replace("Exister", "EXISTER")) + st.raw.slice(cell.end);
    expect("model(hersch): editing a line cell is a surgical splice", serialize(edited) === expectedRaw);
  }
}
if (loaded["wb-synthetic-codex"]) {
  const st = parseEdition(loaded["wb-synthetic-codex"]);
  expect("model(wb): profile detected as 'word'", st.profile === "word");
  expect("model(wb): 20 folios", st.folios.length === 20);
  expect("model(wb): first folio renders word cells", st.folios[0].lines.reduce((a, l) => a + l.cells.length, 0) >= 6);
}

// ---- report ----------------------------------------------------------------

console.log("\nGeneric TEI document-core round-trip proof");
console.log("=".repeat(64));
let failed = 0;
for (const c of checks) { console.log(`  ${c.ok ? "ok  " : "FAIL"}  ${c.name}`); if (!c.ok) failed++; }
if (skips.length) console.log(`  skipped (file absent): ${skips.join(", ")}`);
console.log("=".repeat(64));
console.log(failed ? `FAILED (${failed}/${checks.length})` : `PASSED (${checks.length}/${checks.length})`);
console.log("One engine: lossless on Hersch (line-level), WB (word-level), and SZD (catalog); edits are surgical splices.");
process.exit(failed ? 1 : 0);
