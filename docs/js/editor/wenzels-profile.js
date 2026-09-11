import { DEFAULT_SCHEMA } from "./schema-validation.js";

export const WENZELS_EDITORIAL_SCHEMA_URL = new URL("../../schemas/wenzelsbibel-editorial.sch", import.meta.url).href;

export function isWenzelsProject(project) {
  return project?.id === "wenzelsbibel" || project?.workspace === "wenzelsbibel";
}

/** Local application resources provide a default; an explicit project schema wins. */
export function withWenzelsDefaults(project) {
  if (!isWenzelsProject(project) || project.schema) return project;
  return { ...project, workspace: "wenzelsbibel", localSchemas: null,
    schema: { schemas: [
      { type: "relaxng", path: DEFAULT_SCHEMA.url, name: DEFAULT_SCHEMA.name },
      { type: "schematron", path: WENZELS_EDITORIAL_SCHEMA_URL, name: "Wenzelsbibel editing profile" },
    ] },
  };
}
