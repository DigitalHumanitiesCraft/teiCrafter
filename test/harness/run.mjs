/**
 * teiCrafter eval-harness orchestrator.
 *
 * For each configured fixture: produce a candidate via a transform, validate it
 * with validate.py, and collect the JSON report into test/reports/. This is the
 * reusable feedback loop: today the transform is the identity round-trip (proves
 * the plumbing); later it becomes the real Editor-path load -> segment -> save,
 * and the same harness measures every change.
 *
 * Usage:  node test/harness/run.mjs [--rng test/schemas/tei_all.rng]
 */
import { mkdirSync, copyFileSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runValidate } from "./_validate_runner.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const TEST = resolve(HERE, "..");
const REPO = resolve(TEST, "..");
const REPORTS = join(TEST, "reports");

const argv = process.argv.slice(2);
const rngArg = argFlag("--rng");

// Fixture registry. Synthetic tiers (committed) exercise the harness across data
// scales; real ONB fixtures (gitignored) are added here once extracted.
const SYN = join(TEST, "fixtures-synthetic");
const TIERS = join(SYN, "tiers");
const FIXTURES = [
  { id: "wb-synthetic-folio", input: join(SYN, "wb-synthetic-folio.xml"),
    manifest: join(SYN, "manifest.json"), sch: join(SYN, "Bilderfassung-synthetic.sch") },
  { id: "tier1-1folio",  input: join(TIERS, "tier1-1folio.xml"),
    manifest: join(TIERS, "tier1-1folio.manifest.json"),  sch: join(TIERS, "Bilderfassung.sch") },
  { id: "tier2-5folio",  input: join(TIERS, "tier2-5folio.xml"),
    manifest: join(TIERS, "tier2-5folio.manifest.json"),  sch: join(TIERS, "Bilderfassung.sch") },
  { id: "tier3-20folio", input: join(TIERS, "tier3-20folio.xml"),
    manifest: join(TIERS, "tier3-20folio.manifest.json"), sch: join(TIERS, "Bilderfassung.sch") },
];

/**
 * The round-trip transform. MILESTONE 1 = identity (Option C: null transform):
 * a candidate that should be byte/structure identical to the input, proving the
 * load+save plumbing is lossless before any real enrichment is wired.
 * Swap this for a driver that imports the shared Editor-path module once it exists.
 */
function roundTrip(inputPath, candidatePath) {
  copyFileSync(inputPath, candidatePath);
}

function validate(fx, candidatePath, outPath) {
  const args = ["--input", fx.input, "--candidate", candidatePath,
    "--manifest", fx.manifest, "--json-out", outPath, "--quiet"];
  if (fx.sch) args.push("--sch", fx.sch);
  const rng = rngArg || join(TEST, "schemas", "tei_all.rng");
  if (existsSync(rng)) args.push("--rng", rng);
  const code = runValidate(args);
  return { code, report: existsSync(outPath) ? JSON.parse(readFileSync(outPath, "utf-8")) : null };
}

let failures = 0;
const summary = [];
for (const fx of FIXTURES) {
  const dir = join(REPORTS, fx.id);
  mkdirSync(dir, { recursive: true });
  const candidatePath = join(dir, "candidate.xml");
  const reportPath = join(dir, "report.json");
  roundTrip(fx.input, candidatePath);
  const { report } = validate(fx, candidatePath, reportPath);
  const verdict = report?.verdict ?? "error";
  if (verdict !== "pass") failures++;
  summary.push({ fixture: fx.id, verdict, score: report?.score,
    L1: report?.levels?.L1?.pass, L3: report?.levels?.L3?.countsPreserved,
    L2sch: report?.levels?.L2?.sch?.valid });
  writeFileSync(join(dir, "report.md"), renderMd(report), "utf-8");
}

console.log("\nteiCrafter eval harness");
console.log("=".repeat(60));
for (const s of summary) {
  console.log(`  ${s.verdict === "pass" ? "PASS" : "FAIL"}  ${s.fixture}` +
    `  score=${s.score}  L1=${s.L1}  L3=${s.L3}  L2.sch=${s.L2sch}`);
}
console.log(`\nReports: ${REPORTS}`);
process.exit(failures ? 2 : 0);

function renderMd(r) {
  if (!r) return "# Report\n\n(no report produced)\n";
  const L = r.levels || {};
  return `# Eval report: ${r.fixtureId ?? "?"}

- Verdict: **${r.verdict}** (score ${r.score})
- Gates: ${JSON.stringify(r.gates)}

## L1 text fidelity: ${L.L1?.pass ? "PASS" : "FAIL"}
- words input/candidate: ${L.L1?.wCountInput} / ${L.L1?.wCountCandidate}
${L.L1?.firstDivergence ? "- first divergence: " + JSON.stringify(L.L1.firstDivergence) : ""}

## L3 invariants: ${L.L3?.countsPreserved ? "counts preserved" : "COUNTS CHANGED"}
- namespaceOk: ${L.L3?.namespaceOk}, danglingPointers: ${(L.L3?.danglingPointers || []).length}

## L2 schema
- RelaxNG: ${L.L2?.rng ? JSON.stringify(L.L2.rng.valid) : "skipped"}
- Schematron: ${L.L2?.sch ? JSON.stringify(L.L2.sch.valid) : "skipped"}

## Top issues
${(r.topIssues || []).map(i => "- " + JSON.stringify(i)).join("\n") || "- none"}
`;
}

function argFlag(name) {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : null;
}
