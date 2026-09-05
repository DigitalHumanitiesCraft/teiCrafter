/** Offline proof using only the repository's installed, pinned compiler. */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const entry = resolve(root, "node_modules/typescript/bin/tsc");
const skip = (message) => { console.log(`SKIP: ${message}`); process.exit(0); };
if (!existsSync(entry)) skip("Pinned TypeScript is not installed. Run npm ci; npm run verify requires it.");
const expected = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")).devDependencies.typescript;
const actual = JSON.parse(readFileSync(resolve(root, "node_modules/typescript/package.json"), "utf8")).version;
if (actual !== expected) {
  console.error(`FAIL: TypeScript ${expected} required; found ${actual}. Run npm ci.`);
  process.exit(1);
}
const result = spawnSync(process.execPath, [entry, "--noEmit", "-p", resolve(root, "jsconfig.json")], {
  cwd: root, encoding: "utf8", timeout: 120_000,
});
const output = `${result.stdout || ""}${result.stderr || ""}`;
// A missing native compiler skips only this offline proof. The release gate
// runs this same compiler independently and fails on any nonzero exit.
if (/Unable to resolve.*@typescript\/typescript-/s.test(output)) {
  skip("Pinned TypeScript native platform package is missing; npm run verify remains blocked.");
}
if (result.error || result.status !== 0) {
  console.error(output || result.error?.message || `Compiler exited with ${result.status}`);
  process.exit(1);
}
console.log(`PASS: TypeScript ${actual}, checkJs over jsconfig.json (no global compiler or network fallback).`);
