/**
 * Proof: interface text uses ordinary punctuation or separate fields, never the
 * middle dot (U+00B7) as a separator. Scans the published pages, scripts and
 * stylesheets under docs/ and the source-first modules under src/; vendored
 * libraries and research data are outside the interface and are not scanned.
 *
 * Run: node test/proofs/ui_separator_check.mjs   (exit 0 = all pass)
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { check, finish, section } from "./_assert.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SKIP = new Set(["vendor", "data", "schemas"]);
const EXTENSIONS = new Set([".html", ".js", ".ts", ".css"]);

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (!SKIP.has(name)) yield* files(path);
    } else if (EXTENSIONS.has(extname(name))) {
      yield path;
    }
  }
}

section("No middle dot in interface sources");
const hits = [];
for (const base of ["docs", "src"]) {
  for (const path of files(join(ROOT, base))) {
    readFileSync(path, "utf8").split("\n").forEach((line, index) => {
      if (line.includes("·")) hits.push(`${relative(ROOT, path)}:${index + 1}`);
    });
  }
}
check(`no U+00B7 found${hits.length ? `: ${hits.join(", ")}` : ""}`, hits.length === 0);

finish("ui_separator_check: all checks passed.");
