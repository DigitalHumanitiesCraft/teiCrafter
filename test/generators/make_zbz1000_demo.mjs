/**
 * Materialize the ZBZ worked-example object (doc 1000) as a local-only demo file.
 *
 * Reads the unchanged pipeline TEI from the zbz-ocr-tei sibling checkout
 * (docs/data/pages/1000/1000_final.xml) and ensures that every surface carries
 * one relative <graphic url>. Current pipeline files already satisfy that
 * contract; older files receive the missing element. Writes the result to
 * docs/data/editor/zbz-1000/zbz-hersch-1000.xml.
 *
 * The output is deliberately NOT committed: like docs/data/editor/zbz-100/ it is
 * Hersch material this repo treats as not redistributable (see .gitignore). The
 * injection is a pure string rule, so the same input always produces the same file.
 *
 * Env override: ZBZ1000_SRC points at an alternative 1000_final.xml.
 *
 * Run: node test/generators/make_zbz1000_demo.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));                  // test/generators
const REPO = resolve(HERE, "..", "..");                                // teiCrafter
const GH = resolve(REPO, "..", "..");                                  // .../GitHub
export const SOURCE_FILE =
  process.env.ZBZ1000_SRC ||
  join(GH, "DHCraft", "zbz-ocr-tei", "docs", "data", "pages", "1000", "1000_final.xml");
export const TARGET_FILE = join(REPO, "docs", "data", "editor", "zbz-1000", "zbz-hersch-1000.xml");

/** Ensure one relative <graphic url> per surface (facs_1..facs_4). */
export function buildZbz1000(raw) {
  const nl = raw.includes("\r\n") ? "\r\n" : "\n";
  let out = raw;
  for (let i = 1; i <= 4; i++) {
    const surfaceRe = new RegExp(`(<surface xml:id="facs_${i}"[^>]*>)([\\s\\S]*?)(</surface>)`);
    const match = surfaceRe.exec(out);
    if (!match) throw new Error(`surface facs_${i} not found in source`);
    if (/<graphic\b/.test(match[2])) continue;
    const filename = `1000_p${String(i).padStart(3, "0")}.png`;
    out = out.replace(surfaceRe, `$1${nl}      <graphic url="${filename}" />$2$3`);
  }
  return out;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  if (!existsSync(SOURCE_FILE)) {
    console.error(`source not found: ${SOURCE_FILE} (set ZBZ1000_SRC or check out zbz-ocr-tei as sibling)`);
    process.exit(1);
  }
  const out = buildZbz1000(readFileSync(SOURCE_FILE, "utf8"));
  mkdirSync(dirname(TARGET_FILE), { recursive: true });
  writeFileSync(TARGET_FILE, out);
  console.log(`wrote ${TARGET_FILE} (${out.length} chars, graphic urls present)`);
}
