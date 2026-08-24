import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const work = mkdtempSync(join(tmpdir(), "teicrafter-szd-preflight-"));
const input = join(work, "valid.json");
const output = join(work, "nested", "result.xml");
const base = {
  source: {
    id: "o_szd.test",
    title: "Ä Test",
    images: ["one.jpg", "two.jpg"],
    descriptive_metadata: {
      creator: [
        { name: "Erwin Rieger", gnd: "1" },
        { name: "Erwin Rieger", gnd: "1" },
      ],
    },
  },
  pages: [
    { page: 1, text: "Alpha", image_width: 100, image_height: 200, regions: [] },
    { page: 1, text: "Beta", image_width: 100, image_height: 200, regions: [] },
  ],
};
writeFileSync(input, JSON.stringify(base), "utf8");
let result = spawnSync("python", ["pipeline/export_tei.py", input, output], { encoding: "utf8" });
assert.equal(result.status, 0, result.stderr);
const xml = readFileSync(output, "utf8");
assert.match(xml, /xml:id="surf_1"/);
assert.match(xml, /xml:id="surf_1_2"/);
assert.equal((xml.match(/xml:id="pers_erwin_rieger"/g) || []).length, 1);
assert.equal(Buffer.from(xml).subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])), false);

result = spawnSync("python", ["test/harness/corpus_wellformed.py", join(work, "nested")], { encoding: "utf8" });
assert.equal(result.status, 0, result.stdout + result.stderr);

const sentinel = Buffer.from("existing target", "utf8");
writeFileSync(output, sentinel);
const invalid = structuredClone(base);
invalid.pages[0].text = "Alpha\u0008Beta";
writeFileSync(input, JSON.stringify(invalid), "utf8");
result = spawnSync("python", ["pipeline/export_tei.py", input, output], { encoding: "utf8" });
assert.equal(result.status, 4);
assert.match(result.stderr, /XML 1\.0-forbidden U\+0008/);
assert.deepEqual(readFileSync(output), sentinel);
assert.equal(readdirSync(join(work, "nested")).some((name) => name.endsWith(".tmp")), false);

writeFileSync(input, "null", "utf8");
result = spawnSync("python", ["pipeline/export_tei.py", input, output], { encoding: "utf8" });
assert.equal(result.status, 4);
assert.match(result.stderr, /root must be an object/);

const emptyRoot = join(work, "empty-root");
mkdirSync(emptyRoot);
result = spawnSync(
  "python",
  ["pipeline/export_tei.py", "--all", "--root", emptyRoot, "--out", join(work, "all")],
  { encoding: "utf8" },
);
assert.equal(result.status, 4);
assert.match(result.stderr, /no o_szd\.\*_page\.json inputs/);

console.log("PASS: Page-JSON preflight, stable IDs, formal parsing, empty-input failure, and atomic output hold.");
