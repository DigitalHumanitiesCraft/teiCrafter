import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

export const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

export function inputDigest(path) {
  if (!existsSync(path)) return { missing: true };
  if (statSync(path).isFile()) {
    const bytes = readFileSync(path);
    return { bytes: bytes.length, sha256: sha256(bytes) };
  }
  const entries = [], ancestors = new Set();
  function walk(folder) {
    const actual = realpathSync(folder);
    if (ancestors.has(actual)) throw new Error("A source directory contains a symbolic-link cycle.");
    ancestors.add(actual);
    for (const name of readdirSync(folder).sort()) {
      const child = join(folder, name);
      if (statSync(child).isDirectory()) walk(child);
      else entries.push([relative(path, child).replaceAll("\\", "/"), inputDigest(child)]);
    }
    ancestors.delete(actual);
  }
  walk(path);
  return { files: entries.length, xmlFiles: entries.filter(([name]) => /\.xml$/i.test(name)).length,
    sha256: sha256(JSON.stringify(entries)) };
}

export function evaluationInputPaths(root, env, real = false) {
  const paths = {};
  for (const key of ["WB_CODEX", "WB_IMAGES", "WB_PAGE_ROOT", "UFBAS_TEI", "HERSCH_DIR", "SZD_DIR", "ZBZ1000_SRC"]) {
    if (real && ["WB_CODEX", "WB_IMAGES", "WB_PAGE_ROOT"].includes(key) && !env[key]) {
      throw new Error(`--real requires ${key}; missing real material must never pass by skipping.`);
    }
    if (!env[key]) continue;
    const path = resolve(env[key]);
    if (!existsSync(path)) throw new Error(`${key} points to missing material.`);
    const isDirectory = ["WB_PAGE_ROOT", "HERSCH_DIR", "SZD_DIR"].includes(key);
    if (isDirectory !== statSync(path).isDirectory()) throw new Error(`${key} must name a ${isDirectory ? "directory" : "file"}.`);
    paths[key] = path;
  }
  const siblings = resolve(root, "..", "..");
  paths.localEditorMaterial = join(root, "docs", "data", "editor");
  if (!env.WB_CODEX) paths.optionalCodex = join(siblings, "Wenzelsbibel", "data", "codex-2759.xml");
  const hersch = join(siblings, "DHCraft", "zbz-ocr-tei");
  for (const id of ["100", "1000", "101"]) paths[`optionalHerschPage${id}`] = join(hersch, "docs", "data", "pages", id, `${id}_final.xml`);
  for (const id of ["1000", "1540"]) paths[`optionalHerschPreview${id}`] = join(hersch, "output", "entity_preview", `${id}_final.xml`);
  paths.optionalHerschProfileFinal = join(hersch, "output", "tei_final", "1540_final.xml");
  paths.optionalHerschSchemas = join(hersch, "data", "schema");
  if (!env.HERSCH_DIR) paths.optionalHerschCorpus = join(hersch, "output", "tei_final");
  if (!env.SZD_DIR) paths.optionalSzdCorpus = join(siblings, "szd-htr", "data");
  return paths;
}

export function permittedProofSkips(root, env = {}) {
  const hersch = resolve(root, "..", "..", "DHCraft", "zbz-ocr-tei");
  const preview = (id) => join(hersch, "output", "entity_preview", `${id}_final.xml`);
  const page = (id) => join(hersch, "docs", "data", "pages", id, `${id}_final.xml`);
  const allowed = new Set();
  if (!existsSync(env.HERSCH_DIR || join(hersch, "output", "tei_final"))) allowed.add("hersch_loadability.mjs");
  if (![preview("1000"), join(hersch, "output", "tei_final", "1540_final.xml")].some(existsSync)) allowed.add("hersch_profile_workflow_check.mjs");
  if (![preview("1000"), preview("1540")].some(existsSync)) allowed.add("inline_gnd_real_hersch_check.mjs");
  if (!["100", "1000", "101"].some((id) => existsSync(page(id))) || !existsSync(join(hersch, "data", "schema", "zbz_hersch.rng"))) allowed.add("inline_gnd_schema_check.mjs");
  if (!existsSync(env.ZBZ1000_SRC || page("1000")) && !existsSync(join(root, "docs", "data", "editor", "zbz-1000", "zbz-hersch-1000.xml"))) allowed.add("zbz_worked_example.mjs");
  return allowed;
}

export function treeFileDigest(root, listing) {
  const entries = [...new Set(listing.split("\0").filter(Boolean))].sort()
    .map((path) => [path, existsSync(join(root, path)) ? sha256(readFileSync(join(root, path))) : "deleted"]);
  return sha256(JSON.stringify(entries));
}
