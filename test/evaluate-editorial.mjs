import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { evaluateBrowserReport } from "./evaluation-results.mjs";
import { evaluationInputPaths, inputDigest, permittedProofSkips, treeFileDigest, sha256 } from "./evaluation-inputs.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const real = args.includes("--real"), editorialOnly = args.includes("--editorial-only");
const repeatOption = args.find((arg) => /^--repeat=\d+$/.test(arg));
const repeat = repeatOption ? Number(repeatOption.slice(9)) : 1;
if (args.some((arg) => !["--real", "--editorial-only", repeatOption].includes(arg)) || repeat < 1 || repeat > 10) {
  throw new Error("Usage: npm run evaluate:editorial -- [--real] [--editorial-only] [--repeat=1..10]");
}
const output = join(root, "node_modules", ".tmp", "evaluation", new Date().toISOString().replace(/[:.]/g, "-"));
mkdirSync(output, { recursive: true });
const report = { version: 1, startedAt: new Date().toISOString(), scope: editorialOnly ? "editorial workflows" : "full repository",
  real, repeat, retries: 0, workers: 1, status: "running", steps: [], inputs: {} };
const save = () => writeFileSync(join(output, "evaluation.json"), `${JSON.stringify(report, null, 2)}\n`);
let inputPaths = {};

async function command(executable, argv, label, { quiet = false, trim = true, env = process.env } = {}) {
  const started = Date.now();
  let stdout = "", stderr = "";
  const code = await new Promise((resolveCode, reject) => {
    const child = spawn(executable, argv, { cwd: root, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    child.stdout.on("data", (chunk) => { stdout += chunk; if (!quiet) process.stdout.write(chunk); });
    child.stderr.on("data", (chunk) => { stderr += chunk; if (!quiet) process.stderr.write(chunk); });
    child.on("error", reject);
    child.on("close", resolveCode);
  });
  writeFileSync(join(output, `${label}.log`), stdout + stderr);
  report.steps.push({ label, exitCode: code, durationMs: Date.now() - started });
  save();
  if (code !== 0) throw new Error(`${label} failed with exit code ${code}. See its local log.`);
  return trim ? stdout.trim() : stdout;
}

async function treeDigest(label) {
  const listing = await command("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], label, { quiet: true, trim: false });
  return treeFileDigest(root, listing);
}

try {
  if (!process.env.npm_execpath) throw new Error("Run through npm run evaluate:editorial to verify the pinned npm toolchain.");
  inputPaths = evaluationInputPaths(root, process.env, real);
  for (const [key, path] of Object.entries(inputPaths)) report.inputs[key] = inputDigest(path);
  if (inputPaths.WB_PAGE_ROOT && !report.inputs.WB_PAGE_ROOT.xmlFiles) throw new Error("WB_PAGE_ROOT contains no XML files.");
  report.git = {
    head: await command("git", ["rev-parse", "HEAD"], "git-head", { quiet: true }),
    branch: await command("git", ["branch", "--show-current"], "git-branch", { quiet: true }),
    dirty: await command("git", ["status", "--porcelain"], "git-status", { quiet: true }),
    treeSha256: await treeDigest("tree-before"),
  };
  report.toolchain = {
    node: process.version,
    npm: await command(process.execPath, [process.env.npm_execpath, "--version"], "npm-version", { quiet: true }),
    python: await command(process.env.TCR_PYTHON || "python", ["-c", "import sys,lxml.etree as e;print(sys.version);print('lxml',e.LXML_VERSION,'libxml',e.LIBXML_VERSION)"], "python-version", { quiet: true }),
    lockfileSha256: sha256(readFileSync(join(root, "package-lock.json"))),
  };
  const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  if (report.toolchain.node !== `v${manifest.engines.node}` || report.toolchain.npm !== manifest.engines.npm) {
    throw new Error(`The evaluation requires Node ${manifest.engines.node} and npm ${manifest.engines.npm}.`);
  }
  const { chromium, firefox } = await import("@playwright/test");
  for (const type of [chromium, firefox]) {
    const browser = await type.launch({ headless: true });
    report.toolchain[type.name()] = browser.version();
    await browser.close();
  }
  console.log(`Evaluation evidence: ${output}`);
  await command(process.execPath, [process.env.npm_execpath, "run", "verify"], "verify", {
    env: { ...process.env, OUT_JSON: join(output, "hersch-loadability.json") },
  });
  const proofSkips = [...readFileSync(join(output, "verify.log"), "utf8").matchAll(/^SKIP\s+(\S+\.mjs)$/gm)].map((match) => match[1]);
  const optionalProofs = permittedProofSkips(root, process.env);
  if (proofSkips.some((name) => !optionalProofs.has(name))) throw new Error(`Unexpected skipped proof: ${proofSkips.join(", ")}`);
  report.optionalProofSkips = proofSkips;
  const playwrightArgs = ["node_modules/@playwright/test/cli.js", "test", "--workers=1", "--retries=0", "--forbid-only", `--repeat-each=${repeat}`, "--reporter=line,json,html"];
  if (editorialOnly) playwrightArgs.push("entries.spec.js", "witnesses.spec.js", "wenzelsbibel-", "project-transition-safety.spec.js", "schema-worker.spec.js");
  let browserError;
  try {
    await command(process.execPath, playwrightArgs, "browsers", { env: { ...process.env,
      PLAYWRIGHT_JSON_OUTPUT_FILE: join(output, "playwright.json"), PLAYWRIGHT_HTML_OUTPUT_DIR: join(output, "html"), PLAYWRIGHT_HTML_OPEN: "never" } });
  } catch (error) { browserError = error; }
  const browserReport = JSON.parse(readFileSync(join(output, "playwright.json"), "utf8"));
  report.browsers = evaluateBrowserReport(browserReport, {
    codex: !!process.env.WB_CODEX, images: !!process.env.WB_IMAGES, urfehde: !!process.env.UFBAS_TEI,
    expectedProjects: ["chromium", "firefox"], expectedRepeat: repeat,
  });
  if (browserError) throw browserError;
  if (!report.browsers.ok) throw new Error(report.browsers.problems.join("\n"));
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = error.message;
  process.exitCode = 1;
} finally {
  const integrityProblems = [];
  report.inputsAfter = {};
  for (const [key, before] of Object.entries(report.inputs)) {
    try {
      const after = inputDigest(inputPaths[key]);
      report.inputsAfter[key] = after;
      if (JSON.stringify(after) !== JSON.stringify(before)) integrityProblems.push(`Source material changed during evaluation: ${key}`);
    } catch (error) { report.inputsAfter[key] = { error: error.message }; integrityProblems.push(`Source material could not be rechecked: ${key}`); }
  }
  if (report.git?.treeSha256) {
    try {
      report.git.treeAfterSha256 = await treeDigest("tree-after");
      if (report.git.treeAfterSha256 !== report.git.treeSha256) integrityProblems.push("Repository files changed during evaluation; evaluate the final tree again.");
    } catch (error) { integrityProblems.push(`Repository files could not be rechecked: ${error.message}`); }
  }
  if (integrityProblems.length) {
    report.status = "failed"; process.exitCode = 1;
    report.error = [report.error, ...integrityProblems].filter(Boolean).join("\n");
  }
  report.finishedAt = new Date().toISOString();
  save();
  console.log(`Editorial evaluation ${report.status}: ${join(output, "evaluation.json")}`);
  if (report.error) console.error(report.error);
}
