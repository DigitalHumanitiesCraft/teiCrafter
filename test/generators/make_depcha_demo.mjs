/**
 * Materialize the DEPCHA Wheaton day-book project as a local-only demo folder.
 *
 * Fetches the unchanged TEI from the public DEPCHA repository (Modeling
 * semantically Enriched Digital Editions of Accounts, MEDEAEditions/DEPCHA) and
 * writes it byte-for-byte into docs/data/editor/depcha-wheaton/, next to the
 * committed teicrafter.project.json. The result is a folder you open through
 * the editor's "Open project folder" picker; it is NOT wired into the example
 * registry.
 *
 * Provenance: Laban Morey Wheaton Day Book (1828-1859), encoded with the DEPCHA
 * bookkeeping ontology (bk: descriptors); publisher Zentrum fuer
 * Informationsmodellierung, Universitaet Graz. The DEPCHA repository carries no
 * redistribution licence, so the TEI is treated like the Wenzelsbibel and ZBZ
 * Hersch data: local-only and gitignored, with only the manifest committed.
 * Re-fetch with this script rather than committing the content.
 *
 * Run: node test/generators/make_depcha_demo.mjs
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));                  // test/generators
const REPO = resolve(HERE, "..", "..");                               // teiCrafter
export const TARGET_DIR = join(REPO, "docs", "data", "editor", "depcha-wheaton");
const RAW_BASE = "https://raw.githubusercontent.com/MEDEAEditions/DEPCHA/master/Collections/Wheaton/TEI/";
export const FILES = ["wheaton.1.xml", "wheaton.2.xml"];

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  mkdirSync(TARGET_DIR, { recursive: true });
  for (const name of FILES) {
    const res = await fetch(RAW_BASE + name);
    if (!res.ok) { console.error(`fetch ${name} failed: ${res.status}`); process.exit(1); }
    const text = await res.text();
    writeFileSync(join(TARGET_DIR, name), text);
    console.log(`wrote ${name} (${text.length} chars)`);
  }
  console.log(`done: open ${TARGET_DIR} via "Open project folder".`);
}
