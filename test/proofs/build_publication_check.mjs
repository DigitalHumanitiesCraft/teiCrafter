import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";
import { copyRuntimeCollections } from "../../vite.config.js";

const root = mkdtempSync(join(tmpdir(), "teicrafter-publication-"));
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: "pipe" });
function write(path, content) {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}

try {
  git("init", "--quiet");
  write(".gitignore", "docs/data/editor/local/\n");
  const publicAssets = [
    "docs/data/editor/synthetic.xml",
    "docs/data/editor/local/teicrafter.project.json",
    "docs/schemas/project.rng",
    "docs/vendor/library.js",
  ];
  for (const path of publicAssets) {
    write(path, `Public fixture: ${path}`);
    git("add", "--force", "--", path);
  }
  write("docs/data/editor/local/codex.xml", "Rights-local edition");
  write("docs/data/editor/local/image.jpg", "Rights-local image");
  write("docs/data/editor/untracked.xml", "Untracked source");
  write("docs/vendor/local-cache.bin", "Untracked runtime cache");
  copyRuntimeCollections(root).closeBundle();
  for (const path of publicAssets) {
    const output = join(root, "dist", path.slice("docs/".length));
    assert.equal(readFileSync(output, "utf8"), `Public fixture: ${path}`);
  }
  for (const path of [
    "data/editor/local/codex.xml", "data/editor/local/image.jpg",
    "data/editor/untracked.xml", "vendor/local-cache.bin",
  ]) assert.equal(existsSync(join(root, "dist", path)), false, `${path} must remain local`);

  // A tracked link must not publish an untracked target through the allowlist.
  const linkedPath = "docs/data/editor/linked.xml";
  let symlinksAvailable = true;
  try { symlinkSync(join(root, "docs/data/editor/local/codex.xml"), join(root, linkedPath)); }
  catch (error) {
    if (!["EPERM", "EACCES", "ENOTSUP"].includes(error.code)) throw error;
    symlinksAvailable = false;
  }
  if (symlinksAvailable) {
    git("add", "--force", "--", linkedPath);
    assert.throws(() => copyRuntimeCollections(root).closeBundle(), /regular versioned file/);
  }
  console.log("PASS: builds copy versioned runtime assets and exclude local source material.");
} finally {
  assert.ok(root.startsWith(join(tmpdir(), "teicrafter-publication-")));
  rmSync(root, { recursive: true, force: true });
}
