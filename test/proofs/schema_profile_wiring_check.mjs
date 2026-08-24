import { readFileSync } from "node:fs";
import { check, finish, section } from "./_assert.mjs";

section("Active schema profile wiring");

const app = readFileSync("docs/js/editor/editor-app.js", "utf8");
const validation = readFileSync("docs/js/editor/validation-view.js", "utf8");
check("the editor inspects the validation view's authoritative active schema set",
  app.includes("inspectSchemaSources(sources)")
    && app.includes("validationView.activeSchemaSources()"));
check("schema inspection updates derived state through a revision-neutral transaction",
  app.includes("editorSession.reproject(nextState)")
    && app.includes("activeSchemaProfile = { key, evidence }"));
check("session schema upload and reset both notify the profile controller",
  validation.includes("ctx.onSchemaSourcesChanged(activeSources())")
    && app.includes("onSchemaSourcesChanged: handleSchemaSourcesChanged"));
check("profile inspection is separated from the fail-closed output gate",
  app.includes("void refreshSchemaProfile()")
    && validation.includes("requireValidForOutput"));

finish("schema_profile_wiring_check passed");
