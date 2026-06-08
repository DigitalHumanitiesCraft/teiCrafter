/**
 * Editor-loadability sweep over the full Hersch (zbz-ocr-tei) corpus.
 *
 * roundtrip_sweep.mjs proves the ENGINE (Layer 1) round-trips byte-identically.
 * This proves the EDITOR PROJECTION (Layer 2, edition.js parseEdition): every real
 * file must yield a USABLE editor view (folios > 0, editable cells > 0, real reading
 * text), not merely survive a byte round-trip. It answers the project question
 * "can we see and edit ALL TEI in the editor?" and lists the anomalies to inspect.
 *
 * Override the corpus dir with HERSCH_DIR (default: ../DHCraft/zbz-ocr-tei/output/tei_final).
 * Writes a machine-readable JSON report for downstream inspection.
 *
 * Run: node test/tools/hersch_loadability.mjs
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEdition, structuralSummary } from "../../docs/js/editor/edition.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const TEST = resolve(HERE, "..");
const GH = resolve(TEST, "..", "..", ".."); // .../GitHub
const HERSCH_DIR =
  process.env.HERSCH_DIR || join(GH, "DHCraft", "zbz-ocr-tei", "output", "tei_final");
const OUT_JSON = process.env.OUT_JSON || join(TEST, "reports", "hersch-loadability.json");

if (!existsSync(HERSCH_DIR)) {
  console.error(`HERSCH_DIR not found: ${HERSCH_DIR}`);
  process.exit(2);
}

const files = readdirSync(HERSCH_DIR)
  .filter((f) => f.toLowerCase().endsWith("_final.xml"))
  .sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0));

const cellsInFolio = (fl) =>
  (fl.lines || []).reduce((k, l) => k + (l.cells ? l.cells.length : 0), 0);

const rows = [];
for (const f of files) {
  const raw = readFileSync(join(HERSCH_DIR, f), "utf-8");
  const rec = { file: f, bytes: raw.length };
  try {
    const m = parseEdition(raw);
    const s = structuralSummary(m);
    const c = s.counts || {};
    const textLen = m.cells.reduce((n, cell) => n + (cell.text ? cell.text.length : 0), 0);
    const emptyFolios = m.folios.filter((fl) => cellsInFolio(fl) === 0).length;
    Object.assign(rec, {
      ok: true,
      profile: m.profile,
      folios: m.folios.length,
      cells: m.cells.length,
      textLen,
      emptyFolios,
      pb: c.pb || 0,
      lb: c.lb || 0,
      l: c.l || 0,
      surface: c.surface || 0,
      zone: c.zone || 0,
      note: c.note || 0,
      standOff: c.standOff || 0,
    });
  } catch (e) {
    Object.assign(rec, { ok: false, error: String((e && e.message) || e) });
  }
  rows.push(rec);
}

// ---- aggregate -------------------------------------------------------------
const ok = rows.filter((r) => r.ok);
const parseFail = rows.filter((r) => !r.ok);
const zeroFolio = ok.filter((r) => r.folios === 0);
const zeroCells = ok.filter((r) => r.cells === 0);
const zeroText = ok.filter((r) => r.textLen === 0);
const noZones = ok.filter((r) => r.zone === 0);
const someEmptyFolios = ok.filter((r) => r.emptyFolios > 0 && r.cells > 0);
const wordProfile = ok.filter((r) => r.profile === "word");
const usable = ok.filter((r) => r.folios > 0 && r.cells > 0 && r.textLen > 0);

const nums = (a, k) => a.map((r) => r[k] || 0);
const sum = (a, k) => nums(a, k).reduce((n, v) => n + v, 0);
const stat = (a, k) => {
  const v = nums(a, k).sort((x, y) => x - y);
  if (!v.length) return { min: 0, max: 0, avg: 0, median: 0 };
  return {
    min: v[0],
    max: v[v.length - 1],
    avg: +(v.reduce((n, x) => n + x, 0) / v.length).toFixed(1),
    median: v[Math.floor(v.length / 2)],
  };
};

const agg = {
  dir: HERSCH_DIR,
  files: rows.length,
  usableEditorView: usable.length,
  parseFailed: parseFail.length,
  zeroFolio: zeroFolio.length,
  zeroCells: zeroCells.length,
  zeroText: zeroText.length,
  noZones: noZones.length,
  filesWithSomeEmptyFolios: someEmptyFolios.length,
  wordProfile: wordProfile.length,
  lineProfile: ok.length - wordProfile.length,
  dist: { folios: stat(ok, "folios"), cells: stat(ok, "cells"), zones: stat(ok, "zone") },
  totals: {
    folios: sum(ok, "folios"),
    cells: sum(ok, "cells"),
    zones: sum(ok, "zone"),
    notes: sum(ok, "note"),
    standOff: sum(ok, "standOff"),
  },
};

writeFileSync(
  OUT_JSON,
  JSON.stringify({ agg, anomalies: { parseFail, zeroFolio, zeroCells, zeroText, noZones }, rows }, null, 2),
  "utf-8"
);

console.log(JSON.stringify(agg, null, 2));
const names = (a) => a.map((r) => r.file).join(", ");
if (parseFail.length) console.log("\nPARSE FAILED: " + names(parseFail));
if (zeroFolio.length) console.log("\nZERO FOLIOS: " + names(zeroFolio));
if (zeroCells.length) console.log("\nZERO CELLS: " + names(zeroCells));
if (zeroText.length) console.log("\nZERO TEXT (loads but nothing to edit): " + names(zeroText));
console.log(`\nReport: ${OUT_JSON}`);

const allUsable = usable.length === rows.length;
console.log(
  allUsable
    ? `\nPASS: all ${rows.length} Hersch files yield a usable editor view.`
    : `\nATTENTION: ${rows.length - usable.length}/${rows.length} file(s) need inspection (see anomalies above).`
);
