/** Wenzelsbibel workspace: detection, default schemas, panel, flags and examples for the workspace registry. */
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
  // Built-in examples, shown only on local development hosts. URLs are relative to editor.html.
  examples: Object.freeze({
    wb: Object.freeze({
      label: "Wenzelsbibel", url: "data/editor/wb-codex/codex-2759.xml", file: "codex-2759.xml",
      manifest: "data/editor/wb-codex/teicrafter.project.json",
      done: "Loaded the real Wenzelsbibel codex (facsimile via IIIF).",
      fallback: Object.freeze({
        label: "synthetic Wenzelsbibel", url: "data/editor/wenzelsbibel-synthetic-codex.xml", file: "wenzelsbibel-synthetic-codex.xml",
        project: { workspace: "wenzelsbibel", name: "Wenzelsbibel (synthetic example)" },
        done: "Loaded the synthetic Wenzelsbibel twin (the real codex is not present here).",
      }),
    }),
  }),
  createPanel: (ctx) => createWenzelsWorkspace({ ...ctx, editorialSchemaUrl: WENZELS_EDITORIAL_SCHEMA_URL, draftTeiType: DRAFT_TEI_TYPE }),
});
