import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const dependency = spawnSync("python", ["-c", "import lxml"], { encoding: "utf8" });
if (dependency.status !== 0) {
  console.log("SKIP: python lxml is unavailable; use uv run for the harness");
  process.exit(0);
}

const multiset = spawnSync(
  "python",
  [
    "-c",
    "import runpy; "
      + "module=runpy.run_path('test/harness/validate.py', run_name='teicrafter_validate'); "
      + "x={'message':'same'}; y={'message':'other'}; "
      + "assert module['_multiset_difference']([x,x,y],[x,y]) == [x]",
  ],
  { encoding: "utf8" },
);
assert.equal(multiset.status, 0, multiset.stderr);

const work = mkdtempSync(join(tmpdir(), "teicrafter-harness-"));
const input = join(work, "input.xml");
const candidate = join(work, "candidate.xml");
const reportPath = join(work, "report.json");
const base = '<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p><lb/>Alpha\n<lb/>Beta</p></body></text></TEI>';
writeFileSync(input, base, "utf8");

function validate(xml, extra = []) {
  writeFileSync(candidate, xml, "utf8");
  const result = spawnSync(
    "python",
    ["test/harness/validate.py", "--input", input, "--candidate", candidate, "--json-out", reportPath, "--quiet", ...extra],
    { encoding: "utf8" },
  );
  const report = JSON.parse(readFileSync(reportPath, "utf8"));
  assert.equal(readdirSync(work).some((name) => name.endsWith(".tmp")), false);
  return { result, report };
}

let checked = validate(base.replace("Alpha", "Alphx"));
assert.equal(checked.result.status, 2);
assert.equal(checked.report.levels.L1.pass, false);
assert.equal(checked.report.levels.L1.wCountInput, 0);
assert.ok(checked.report.levels.L1.firstTextDivergence);

checked = validate(base.replaceAll(' xmlns="http://www.tei-c.org/ns/1.0"', ""));
assert.equal(checked.result.status, 2);
assert.equal(checked.report.levels.L3.namespaceOk, false);
assert.equal(checked.report.levels.L3.expandedNamesPreserved, false);

checked = validate(base.replace("<p>", '<p ref="#missing">'));
assert.equal(checked.result.status, 2);
assert.deepEqual(checked.report.levels.L3.danglingPointers[0], { element: "p", attr: "ref", ref: "missing" });

checked = validate(base, ["--rng", join(work, "missing.rng")]);
assert.equal(checked.result.status, 2);
assert.equal(checked.report.verdict, "fail");
assert.equal(checked.report.levels.L2.available, false);
assert.equal(checked.report.gates.schemaAvailable, "fail");
assert.ok(checked.report.score < 100);

const missing = spawnSync(
  "python",
  ["test/harness/validate.py", "--input", input, "--candidate", join(work, "absent.xml"), "--quiet"],
  { encoding: "utf8" },
);
assert.equal(missing.status, 4);
assert.match(missing.stderr, /candidate is not a file/);

console.log("PASS: general L1, namespace/QName, pointer, schema-availability, and missing-input gates hold.");
