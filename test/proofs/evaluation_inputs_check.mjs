import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { evaluationInputPaths, inputDigest, permittedProofSkips, treeFileDigest } from "../evaluation-inputs.mjs";

const work = mkdtempSync(join(tmpdir(), "teicrafter-evaluation-"));
try {
  const source = join(work, "source"); mkdirSync(source);
  writeFileSync(join(source, "UPPER.XML"), "<TEI/>");
  writeFileSync(join(source, "dependency.rng"), "<grammar/>");
  writeFileSync(join(source, "image.png"), new Uint8Array([137, 80, 78, 71]));
  const before = inputDigest(source);
  assert.equal(before.files, 3); assert.equal(before.xmlFiles, 1);
  writeFileSync(join(source, "dependency.rng"), "<changed/>");
  assert.notEqual(inputDigest(source).sha256, before.sha256, "schema dependencies must be covered alongside XML");
  const missing = join(work, "later.xml");
  assert.deepEqual(inputDigest(missing), { missing: true });
  writeFileSync(missing, "<TEI/>");
  assert.notDeepEqual(inputDigest(missing), { missing: true });

  const root = join(work, "GitHub", "ResearchTools", "teiCrafter"); mkdirSync(root, { recursive: true });
  assert.throws(() => evaluationInputPaths(root, {}, true), /requires WB_CODEX/);
  const env = { WB_CODEX: missing, WB_IMAGES: missing, WB_PAGE_ROOT: source };
  const explicit = evaluationInputPaths(root, env, true);
  assert.equal(explicit.WB_CODEX, missing);
  assert.equal(explicit.WB_PAGE_ROOT, source);
  assert.throws(() => evaluationInputPaths(root, { ...env, WB_CODEX: source }, true), /must name a file/);
  assert.throws(() => evaluationInputPaths(root, { ...env, WB_PAGE_ROOT: missing }, true), /must name a directory/);
  assert.throws(() => evaluationInputPaths(root, { ...env, HERSCH_DIR: join(work, "absent") }, true), /missing material/);
  const optional = evaluationInputPaths(root, {});
  assert.equal(optional.optionalCodex, join(work, "GitHub", "Wenzelsbibel", "data", "codex-2759.xml"));
  assert.equal(optional.optionalHerschCorpus, join(work, "GitHub", "DHCraft", "zbz-ocr-tei", "output", "tei_final"));
  assert.equal(permittedProofSkips(root).size, 5);
  mkdirSync(optional.optionalHerschCorpus, { recursive: true });
  mkdirSync(dirname(optional.optionalHerschPreview1000), { recursive: true });
  writeFileSync(optional.optionalHerschPreview1000, "<TEI/>");
  assert.equal(permittedProofSkips(root).has("hersch_loadability.mjs"), false);
  assert.equal(permittedProofSkips(root).has("hersch_profile_workflow_check.mjs"), false);
  assert.equal(permittedProofSkips(root).has("inline_gnd_real_hersch_check.mjs"), false);
  assert.equal(permittedProofSkips(root, { ZBZ1000_SRC: missing }).has("zbz_worked_example.mjs"), false);

  writeFileSync(join(root, " leading.xml"), "first");
  writeFileSync(join(root, "trailing.xml"), "second");
  const listing = " leading.xml\0trailing.xml\0";
  const firstTree = treeFileDigest(root, listing);
  assert.equal(treeFileDigest(root, "trailing.xml\0 leading.xml\0 leading.xml\0"), firstTree);
  writeFileSync(join(root, " leading.xml"), "changed");
  assert.notEqual(treeFileDigest(root, listing), firstTree, "leading filename whitespace must not escape the code hash");
  assert.notEqual(treeFileDigest(root, " leading.xml\0trailing.xml\0deleted.xml\0"), treeFileDigest(root, listing));
} finally {
  assert.equal(dirname(resolve(work)), resolve(tmpdir()));
  rmSync(work, { recursive: true, force: true });
}
console.log("Evaluation input hashes cover explicit and optional sources, binary and schema dependencies, missing inputs, and exact Git filenames.");
