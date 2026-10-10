/** Wenzelsbibel workspace: detection, default schemas, panel and flags for the workspace registry. */
import { DEFAULT_SCHEMA } from "../../editor/schema-validation.js";
import { createWenzelsWorkspace } from "./wenzels-workspace.js";

export const WENZELS_EDITORIAL_SCHEMA_URL = new URL("../../../schemas/wenzelsbibel-editorial.sch", import.meta.url).href;
const DRAFT_TEI_TYPE = "wenzelsbibel-transcription";

export const wenzelsbibel = Object.freeze({
  id: "wenzelsbibel",
  // Built-in detection profile for files opened without a manifest.
  profile: Object.freeze({
    id: "wenzelsbibel",
    teiTypes: ["wenzelsbibel-registers", DRAFT_TEI_TYPE],
    name: "Wenzelsbibel (Codex 2759)",
    pidPattern: /^o:wen\./,
    // {stem} is the graphic filename without its extension. OpenSeadragon
    // accepts the info.json URL string directly as a IIIF tile source.
    iiifImageTemplate: "https://iiif.onb.ac.at/images/REPO/8977428/{stem}.jp2/info.json",
  }),
  // Applied when a project declares no schema: a granted folder cannot reference application schemas.
  defaultSchemas: Object.freeze([
    Object.freeze({ type: "relaxng", path: DEFAULT_SCHEMA.url, name: DEFAULT_SCHEMA.name }),
    Object.freeze({ type: "schematron", path: WENZELS_EDITORIAL_SCHEMA_URL, name: "Wenzelsbibel editing profile" }),
  ]),
  panel: Object.freeze({
    id: "wenzels", label: "Wenzelsbibel",
    title: "Transcription, apparatus, Bible verses, image annotations and shared registers",
  }),
  stagedMode: "wenzels",
  draftTeiType: DRAFT_TEI_TYPE,
  flags: Object.freeze({ modelFeatures: false }),
  createPanel: (ctx) => createWenzelsWorkspace({ ...ctx, editorialSchemaUrl: WENZELS_EDITORIAL_SCHEMA_URL, draftTeiType: DRAFT_TEI_TYPE }),
});
