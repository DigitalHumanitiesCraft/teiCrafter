/// <reference types="vite/client" />
/**
 * Schema validation for the editor. RelaxNG and XSD run through libxml2-wasm
 * in a module worker; the runtime and TEI All are served from public/.
 */
import { createSchemaClient, type Validator } from "./schema-client";

export type { Validator } from "./schema-client";
export type { Diagnostic, SchemaSource } from "./schema-runtime";
export { TEI_ALL } from "./schema-runtime";

export function createValidator(): Validator {
  const publicBase = new URL(import.meta.env.BASE_URL, document.baseURI).href;
  return createSchemaClient(
    () => new Worker(new URL("./schema-worker.ts", import.meta.url), { type: "module" }),
    publicBase,
  );
}
