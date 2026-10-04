import type { SchemaSource } from "./schema-runtime";

/** Turns a user-picked schema file into a text source; the kind follows the extension. */
export async function schemaFromFile(file: File): Promise<SchemaSource> {
  const match = /\.(rng|xsd)$/i.exec(file.name);
  if (!match) throw new Error("Choose a RelaxNG (.rng) or XML Schema (.xsd) file.");
  const kind = match[1].toLowerCase() === "xsd" ? "xsd" : "rng";
  return { kind, text: await file.text(), label: file.name };
}
