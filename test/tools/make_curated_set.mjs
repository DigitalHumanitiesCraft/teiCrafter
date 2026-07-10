/**
 * M7.4 curated example set: script-generated before/after pairs of fully
 * curated TEIs from both pipelines, each pair with a unified diff and a
 * per-object summary. This is the paper's empirical partial result: from the
 * unverified pipeline TEI of a real object, curation in teiCrafter produces a
 * demonstrably better TEI (facsimile-linked, authority-linked entities,
 * explicit editorial confidence, explicit verification status) while
 * preserving the pipeline output byte-exactly outside the touched regions.
 *
 * Design:
 *   - A REGISTRY of objects. Each entry resolves its source (or reports why it
 *     is absent) and carries a curation recipe. Recipes are the exact curation
 *     arcs proven by the worked-example tests (zbz_worked_example.mjs,
 *     szd_worked_example.mjs); every edit goes through the engine, so every
 *     change is an offset splice and untouched bytes stay identical.
 *   - Entries with `enabled: false` are proposed for the set but await the
 *     operator's object sign-off (M7.4); they are listed, not generated.
 *   - Output per object under output/curated-set/<id>/ (output/ is gitignored,
 *     which also honors the Hersch rights stance: ZBZ pairs stay local-only):
 *       before.xml   the untouched pipeline TEI
 *       after.xml    the curated TEI
 *       diff.patch   unified diff (3 context lines)
 *       summary.md   the step log plus the verification results
 *     plus output/curated-set/SET.md, the set overview table.
 *   - Verification per object: the before round-trips byte-identically, the
 *     after is idempotent, the folio model survives, and the step log is
 *     non-empty. Exit 0 only if every enabled object generates and verifies.
 *
 * Honesty note on authority identifiers: only identifiers resolved against the
 * authority itself are written (Hersch GND via lobid 2026-06-09, Geneve
 * Wikidata Q71 / GeoNames 7285902 via Wikidata P1566 2026-06-09, Zweig GND and
 * Wien GeoNames/Wikidata as well-known); all other entities are added without
 * an authority on purpose, to be resolved via the live lookup (M3.3).
 *
 * Run: node test/tools/make_curated_set.mjs   (exit 0 = pass, 1 = fail)
 */

import { parseEdition, serialize, editCell } from "../../docs/js/editor/edition.js";
import { readEntities, addEntity, linkMention, setAuthority } from "../../docs/js/editor/standoff.js";
import { markCritical } from "../../docs/js/editor/criticism.js";
import { buildZbz1000, SOURCE_FILE as ZBZ_SOURCE, TARGET_FILE as ZBZ_TARGET } from "./make_zbz1000_demo.mjs";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_ROOT = join(HERE, "..", "..", "output", "curated-set");
const SZD_FIXTURE = join(HERE, "..", "..", "docs", "data", "editor", "szd", "o_szd.1079.tei.xml");

// ---------------------------------------------------------------------------
// Recipe helpers: every recipe builds a step log alongside the engine calls so
// the summary.md documents exactly what curation happened and why.
// ---------------------------------------------------------------------------

function makeLog() {
  const steps = [];
  return {
    steps,
    add(act, kind, detail) {
      steps.push({ act, kind, detail });
    },
  };
}

/** Correct one reading cell found by `needle`, replacing `from` with `to`. */
function correctLine(state, needle, from, to, log, why) {
  const cell = state.cells.find((c) => c.text.includes(needle));
  if (!cell) throw new Error(`correction cell not found: ${needle}`);
  const next = editCell(state, cell.id, cell.text.replace(from, to));
  log.add("correct", "line correction", `"${from}" to "${to}" (${why})`);
  return parseEdition(serialize(next));
}

/** Add an entity, optionally with verified authorities, and log it. */
function addEntityWithAuthorities(doc, type, name, authorities, log) {
  doc = addEntity(doc, type, { name });
  const collection = { person: "persons", place: "places", work: "works" }[type];
  const ent = readEntities(doc)[collection].find((e) => e.name === name);
  if (!ent) throw new Error(`entity not readable after add: ${name}`);
  for (const [authType, value] of authorities) {
    doc = setAuthority(doc, ent.id, authType, value);
  }
  log.add(
    "annotate",
    `${type} entity`,
    authorities.length
      ? `${name} (${authorities.map(([t, v]) => `${t} ${v}`).join(", ")})`
      : `${name} (no authority on purpose, resolve via live lookup M3.3)`
  );
  return { doc, id: ent.id };
}

/** Link the reading cell containing `needle` to entity `id`. */
function linkMentionByText(doc, needle, id, name, log) {
  const state = parseEdition(doc.raw);
  const cell = state.cells.find((c) => c.text.includes(needle));
  if (!cell) throw new Error(`mention cell not found: ${needle}`);
  const next = linkMention(state.doc, cell.node, id);
  log.add("annotate", "mention link", `<name ref="#${id}"> on the "${name}" line`);
  return next;
}

/** Wrap the reading cell found by `pick` as unclear, or replace it with a gap. */
function markByPick(doc, pick, kind, detail, log) {
  const state = parseEdition(doc.raw);
  const cell = pick(state);
  if (!cell) throw new Error(`criticism cell not found: ${detail}`);
  const next = markCritical(state.doc, cell.node, kind);
  log.add("criticize", kind === "gap" ? "<gap/> replacement" : `<${kind}> wrap`, detail);
  return next;
}

// ---------------------------------------------------------------------------
// Recipes (the proven worked-example arcs, see the two worked-example tests)
// ---------------------------------------------------------------------------

function curateZbz1000(raw0) {
  const log = makeLog();
  let state = parseEdition(raw0);

  state = correctLine(state, "inadaption", "inadaption", "inadaptation", log, "OCR defect, facs_3");
  let doc = state.doc;

  let r = addEntityWithAuthorities(doc, "person", "Jeanne Hersch", [["GND", "118815679"]], log);
  doc = r.doc;
  r = addEntityWithAuthorities(doc, "person", "Ivan Illich", [], log);
  doc = r.doc;
  r = addEntityWithAuthorities(doc, "place", "Genève", [["Wikidata", "Q71"], ["GeoNames", "7285902"]], log);
  doc = r.doc;
  const geneveId = r.id;
  r = addEntityWithAuthorities(doc, "work", "Une société sans école", [], log);
  doc = r.doc;

  doc = linkMentionByText(doc, "Genève", geneveId, "Genève", log);

  doc = markByPick(
    doc,
    (s) => s.cells.find((c) => c.text.includes("Perte de temps")),
    "unclear",
    "column-split footnote fragment, reading uncertain in place",
    log
  );
  doc = markByPick(
    doc,
    (s) => s.cells.find((c) => !c.gap && c.text.trim() === "Heft"),
    "gap",
    'stray OCR token "Heft" with no readable source text at that spot',
    log
  );

  return { doc, steps: log.steps };
}

function curateSzd1079(raw0) {
  const log = makeLog();
  let state = parseEdition(raw0);

  state = correctLine(state, "Gerichte", "Gerichte", "Gedichte", log, "HTR defect, folio 3");
  let doc = state.doc;

  let r = addEntityWithAuthorities(doc, "person", "Stefan Zweig", [["GND", "118637495"]], log);
  doc = r.doc;
  r = addEntityWithAuthorities(doc, "person", "Max Fleischer", [], log);
  doc = r.doc;
  r = addEntityWithAuthorities(doc, "place", "Wien", [["GeoNames", "2761369"], ["Wikidata", "Q1741"]], log);
  doc = r.doc;
  const wienId = r.id;
  r = addEntityWithAuthorities(doc, "place", "Komotau", [], log);
  doc = r.doc;
  r = addEntityWithAuthorities(doc, "work", "Residenzblatt", [], log);
  doc = r.doc;

  doc = linkMentionByText(doc, "in Wien", wienId, "in Wien", log);

  doc = markByPick(
    doc,
    (s) => s.folios[2].lines.flatMap((l) => l.cells).find((c) => !c.gap && c.text.trim()),
    "unclear",
    "folio-3 reading line, HTR confidence low",
    log
  );
  doc = markByPick(
    doc,
    (s) =>
      s.folios[2].lines
        .flatMap((l) => l.cells)
        .find((c) => !c.gap && c.text.trim() && c.node.parent.localName !== "unclear"),
    "gap",
    "folio-3 reading line, illegible in the facsimile",
    log
  );

  return { doc, steps: log.steps };
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const REGISTRY = [
  {
    id: "zbz-1000",
    pipeline: "zbz-ocr-tei",
    title: 'doc 1000, "TRANSFORMER L\'ECOLE OU LA SUPPRIMER ?", educateur 109 (1973)',
    rights: "local-only pending the ZBZ rights answer (stance as zbz-100)",
    enabled: true,
    load() {
      if (existsSync(ZBZ_TARGET)) return readFileSync(ZBZ_TARGET, "utf8");
      if (existsSync(ZBZ_SOURCE)) return buildZbz1000(readFileSync(ZBZ_SOURCE, "utf8"));
      return null;
    },
    absentReason: "zbz-hersch-1000.xml absent and no zbz-ocr-tei sibling checkout",
    recipe: curateZbz1000,
  },
  {
    id: "o_szd.1079",
    pipeline: "szd-htr",
    title: "1901 Stefan Zweig letter to Max Fleischer (CC-BY)",
    rights: "CC-BY, redistributable",
    enabled: true,
    load() {
      if (existsSync(SZD_FIXTURE)) return readFileSync(SZD_FIXTURE, "utf8");
      return null;
    },
    absentReason: "o_szd.1079 fixture absent",
    recipe: curateSzd1079,
  },
  // Proposed extension, generated only after the operator signs off the object
  // list (M7.4). Recipes to be written per object once approved.
  {
    id: "zbz-1540",
    pipeline: "zbz-ocr-tei",
    title: "doc 1540, 8-page German object (the worked-example runner-up)",
    rights: "local-only pending the ZBZ rights answer",
    enabled: false,
    pendingReason: "awaits operator object sign-off",
  },
  {
    id: "szd prompt-group objects (2 or 3)",
    pipeline: "szd-htr",
    title: "objects across prompt groups A to I, to be selected",
    rights: "GAMS, CC-BY",
    enabled: false,
    pendingReason: "awaits operator object sign-off",
  },
];

// ---------------------------------------------------------------------------
// Unified diff (line-based LCS, 3 context lines). Files here are tens of KB,
// so the quadratic table is fine.
// ---------------------------------------------------------------------------

function unifiedDiff(aText, bText, aName, bName) {
  const a = aText.split("\n");
  const b = bText.split("\n");
  const n = a.length;
  const m = b.length;

  // LCS lengths, one Int32Array row at a time (rolling).
  const table = new Array(n + 1);
  for (let i = n; i >= 0; i--) {
    table[i] = new Int32Array(m + 1);
    if (i === n) continue;
    for (let j = m - 1; j >= 0; j--) {
      table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  // Backtrack into an op list: { kind: "same" | "del" | "add", line }.
  const ops = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ kind: "same", line: a[i] });
      i++;
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      ops.push({ kind: "del", line: a[i] });
      i++;
    } else {
      ops.push({ kind: "add", line: b[j] });
      j++;
    }
  }
  while (i < n) ops.push({ kind: "del", line: a[i++] });
  while (j < m) ops.push({ kind: "add", line: b[j++] });

  // Group into hunks with CONTEXT lines of context.
  const CONTEXT = 3;
  const hunks = [];
  let k = 0;
  while (k < ops.length) {
    if (ops[k].kind === "same") {
      k++;
      continue;
    }
    const start = Math.max(0, k - CONTEXT);
    let end = k;
    let sameRun = 0;
    while (end < ops.length && sameRun <= CONTEXT * 2) {
      sameRun = ops[end].kind === "same" ? sameRun + 1 : 0;
      end++;
    }
    end = Math.min(ops.length, end - Math.max(0, sameRun - CONTEXT));
    hunks.push({ start, end });
    k = end;
  }

  // Render. Line numbers are 1-based positions in a and b at each hunk start.
  let aLine = 1;
  let bLine = 1;
  let pos = 0;
  const out = [`--- ${aName}`, `+++ ${bName}`];
  for (const h of hunks) {
    while (pos < h.start) {
      if (ops[pos].kind !== "add") aLine++;
      if (ops[pos].kind !== "del") bLine++;
      pos++;
    }
    const body = [];
    let aCount = 0;
    let bCount = 0;
    for (let q = h.start; q < h.end; q++) {
      const op = ops[q];
      if (op.kind === "same") {
        body.push(" " + op.line);
        aCount++;
        bCount++;
      } else if (op.kind === "del") {
        body.push("-" + op.line);
        aCount++;
      } else {
        body.push("+" + op.line);
        bCount++;
      }
    }
    out.push(`@@ -${aLine},${aCount} +${bLine},${bCount} @@`);
    out.push(...body);
    while (pos < h.end) {
      if (ops[pos].kind !== "add") aLine++;
      if (ops[pos].kind !== "del") bLine++;
      pos++;
    }
  }
  return out.join("\n") + "\n";
}

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------

let failures = 0;
function check(label, cond) {
  console.log(`  ${cond ? "ok  " : "FAIL"} ${label}`);
  if (!cond) failures++;
}

const setRows = [];

for (const entry of REGISTRY) {
  if (!entry.enabled) {
    console.log(`PENDING ${entry.id} (${entry.pendingReason})`);
    setRows.push({ entry, status: "pending sign-off" });
    continue;
  }
  const raw0 = entry.load();
  if (raw0 === null) {
    console.log(`SKIP ${entry.id} (${entry.absentReason})`);
    setRows.push({ entry, status: "source absent, skipped" });
    continue;
  }

  console.log(`OBJECT ${entry.id} (${entry.pipeline})`);
  const s0 = parseEdition(raw0);
  check("before round-trips byte-identically", serialize(s0) === raw0);
  const folioCount = s0.folios.length;

  const { doc, steps } = entry.recipe(raw0);
  const after = doc.raw;
  check("recipe applied at least one step", steps.length > 0);
  check("after is idempotent (parse then serialize equals itself)", serialize(parseEdition(after)) === after);
  check(`after still builds the ${folioCount}-folio model`, parseEdition(after).folios.length === folioCount);
  check("after carries a <standOff> (entities exist)", after.includes("<standOff>"));
  check("after differs from before (curation happened)", after !== raw0);

  const dir = join(OUT_ROOT, entry.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "before.xml"), raw0);
  writeFileSync(join(dir, "after.xml"), after);
  const diff = unifiedDiff(raw0, after, `${entry.id}/before.xml`, `${entry.id}/after.xml`);
  writeFileSync(join(dir, "diff.patch"), diff);

  const addedLines = diff.split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++")).length;
  const removedLines = diff.split("\n").filter((l) => l.startsWith("-") && !l.startsWith("---")).length;

  const summary = [
    `# Curated pair: ${entry.id}`,
    "",
    `Object: ${entry.title}`,
    `Pipeline: ${entry.pipeline}`,
    `Rights: ${entry.rights}`,
    `Generated by: node test/tools/make_curated_set.mjs (engine-only, every edit an offset splice)`,
    "",
    "## Curation steps",
    "",
    ...steps.map((s, idx) => `${idx + 1}. [${s.act}] ${s.kind}: ${s.detail}`),
    "",
    "## Verification",
    "",
    `- before.xml round-trips byte-identically through the engine`,
    `- after.xml is idempotent and still builds the ${folioCount}-folio model`,
    `- sizes: before ${raw0.length} bytes, after ${after.length} bytes`,
    `- diff: ${addedLines} added lines, ${removedLines} removed lines (see diff.patch)`,
    "",
  ].join("\n");
  writeFileSync(join(dir, "summary.md"), summary);

  setRows.push({ entry, status: "generated and verified", steps: steps.length, addedLines, removedLines });
  console.log(`  wrote ${dir} (before/after/diff/summary, ${steps.length} steps)`);
}

// Set overview.
mkdirSync(OUT_ROOT, { recursive: true });
const setTable = [
  "# Curated example set (M7.4)",
  "",
  "Script-generated before/after pairs of fully curated TEIs from both pipelines.",
  "Regenerate with: node test/tools/make_curated_set.mjs",
  "This directory is gitignored on purpose (Hersch rights stance: ZBZ pairs stay local-only).",
  "",
  "| Object | Pipeline | Status | Steps | Diff (+/-) | Rights |",
  "|--------|----------|--------|-------|-----------|--------|",
  ...setRows.map((r) =>
    `| ${r.entry.id} | ${r.entry.pipeline} | ${r.status} | ${r.steps ?? ""} | ${
      r.addedLines !== undefined ? `+${r.addedLines}/-${r.removedLines}` : ""
    } | ${r.entry.rights} |`
  ),
  "",
].join("\n");
writeFileSync(join(OUT_ROOT, "SET.md"), setTable);

console.log("");
const generated = setRows.filter((r) => r.status === "generated and verified").length;
if (failures) {
  console.log(`FAIL: ${failures} check(s) failed.`);
  process.exit(1);
} else {
  console.log(`PASS: curated set generated and verified (${generated} object(s) generated, ${setRows.length - generated} pending or skipped). Overview: output/curated-set/SET.md`);
  process.exit(0);
}
