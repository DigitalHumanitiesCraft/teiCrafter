import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const proofsDirectory = join(repositoryRoot, "test", "proofs");
const optionalFullCorpusProofs = new Set([
  "port_parity.mjs",
  "szd_loadability_sweep.mjs",
]);

function fail(message) {
  console.error(`\nVERIFY FAILED: ${message}`);
  process.exit(1);
}

function run(command, args, label) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: "inherit",
  });
  if (result.error) fail(`${label}: ${result.error.message}`);
  if (result.status !== 0) fail(`${label} exited with ${result.status}`);
}

function checkToolchain() {
  const expectedNode = "v24.13.0";
  if (process.version !== expectedNode) {
    fail(`Node ${expectedNode} is required, found ${process.version}`);
  }
  const npmEntry = process.env.npm_execpath;
  if (!npmEntry || !existsSync(npmEntry)) {
    fail("npm is required; run this gate through `npm run verify`");
  }
  const result = spawnSync(process.execPath, [npmEntry, "--version"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  if (result.error || result.status !== 0) fail("npm is required");
  const npmVersion = result.stdout.trim();
  if (npmVersion !== "11.6.2") {
    fail(`npm 11.6.2 is required, found ${npmVersion}`);
  }
}

function runRequiredProofs() {
  console.log("\n=== Required Node proof suite ===");
  const proofs = readdirSync(proofsDirectory)
    .filter((name) => name.endsWith(".mjs") && !name.startsWith("_"))
    .filter((name) => !optionalFullCorpusProofs.has(name))
    .sort();
  const failures = [];
  let passed = 0;
  let skipped = 0;
  for (const name of proofs) {
    const result = spawnSync(process.execPath, [join(proofsDirectory, name)], {
      cwd: repositoryRoot,
      encoding: "utf8",
    });
    const output = `${result.stdout || ""}${result.stderr || ""}`;
    if (result.error || result.status !== 0) {
      failures.push({ name, result, output });
      console.log(`FAIL  ${name}`);
    } else if (/^SKIP\b/m.test(output)) {
      skipped += 1;
      console.log(`SKIP  ${name}`);
    } else {
      passed += 1;
      console.log(`PASS  ${name}`);
    }
  }
  for (const failure of failures) {
    console.error(`\n--- ${failure.name} ---\n${failure.output.trim()}`);
  }
  console.log(`${passed} passed, ${skipped} skipped, ${failures.length} failed`);
  if (failures.length) fail("required Node proof suite failed");
  console.log(
    "Optional local corpus proofs are excluded. Run `npm run verify:full-corpus` explicitly.",
  );
}

function checkBuildOutput() {
  const required = [
    "index.html",
    "editor.html",
    "about.html",
    "data/editor/wenzelsbibel-synthetic-codex.xml",
    "schemas/tei-p5-4.11.0/tei_all.rng",
    "vendor/openseadragon/openseadragon.min.js",
  ];
  for (const relativePath of required) {
    const path = join(repositoryRoot, "dist", relativePath);
    if (!existsSync(path)) fail(`build output is missing ${relativePath}`);
  }
  const editor = readFileSync(join(repositoryRoot, "dist", "editor.html"), "utf8");
  if (!editor.includes("Content-Security-Policy")) {
    fail("the built editor lost its Content-Security-Policy");
  }
}

checkToolchain();
runRequiredProofs();
run(process.execPath, ["test/harness/selftest.mjs"], "Harness negative self-test");
run(process.execPath, ["test/harness/run.mjs"], "Harness synthetic tiers");
run(
  process.execPath,
  ["node_modules/typescript/bin/tsc", "--noEmit", "-p", "jsconfig.json"],
  "JavaScript typecheck",
);
run(
  process.execPath,
  [
    "node_modules/@biomejs/biome/bin/biome",
    "check",
    "--files-ignore-unknown=true",
    "docs/js",
    "test/e2e",
    "test/verify.mjs",
    "vite.config.js",
    "playwright.config.js",
  ],
  "Biome check",
);
run(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "build"],
  "Vite multi-page build",
);
checkBuildOutput();
console.log("\nVERIFY PASSED");
