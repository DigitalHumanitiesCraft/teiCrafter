// Loads a dependency-free TypeScript module from src/validate in Node. Node
// releases without built-in type stripping get the types removed here instead.
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";

export async function importTs(relativePath) {
  const url = new URL(`../../${relativePath}`, import.meta.url);
  if (process.features.typescript) return import(url.href);
  const code = stripTypeScriptTypes(await readFile(url, "utf8"));
  return import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
}
