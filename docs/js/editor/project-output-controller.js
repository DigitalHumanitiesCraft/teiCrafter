import { createProjectBundle, decodeProjectBundle } from "./project-bundle.js";
import { checkpointFromProjectDocuments, projectForSnapshot, restoreProjectDocuments } from "./project-documents.js";
import { schemaSources, schemaSetKey, schemaGate, validateWithSchemas } from "./schema-validation.js";
import { parseDocument } from "./tei-document.js";
import { targetDocument, usesInlineGND } from "./interchange.js";
import { withWenzelsDefaults } from "./wenzels-profile.js";

/** Every XML file receives its own schema decision before the single download. */
export function createProjectOutputController(ctx, { validate = validateWithSchemas } = {}) {
  let operation = null;
  const sourcesFor = (entry) => {
    const project = withWenzelsDefaults(projectForSnapshot(entry));
    return schemaSources(project?.schema, entry.schemaSettings?.customSchema, project?.schemaBaseUrl, project?.localSchemas);
  };

  async function download() {
    if (operation || !ctx.resolveStaged("Project export")) return false;
    const controller = new AbortController();
    operation = controller; ctx.busy(true);
    let captured = null;
    let requested = false;
    try {
      captured = ctx.capture();
      if (!captured?.snapshot) throw new Error("There are no project documents to export.");
      const snapshot = restoreProjectDocuments(captured.snapshot);
      for (const entry of snapshot.documents) {
        const project = withWenzelsDefaults(projectForSnapshot(entry));
        if (usesInlineGND(project)) entry.raw = targetDocument(parseDocument(entry.raw), project).raw;
      }
      const current = () => operation === controller && !controller.signal.aborted && captured.isCurrent();
      const result = await createProjectBundle(snapshot, {
        signal: controller.signal, isCurrent: current,
        authorize: async (entry) => {
          if (!current()) return null;
          const sources = sourcesFor(entry), key = schemaSetKey(sources);
          ctx.status(`Validating ${entry.name} for Project export...`);
          const results = await validate(entry.raw, sources, { signal: controller.signal,
            onProgress: (progress) => {
              if (current()) ctx.status(`Validating ${entry.name} for Project export: ${typeof progress === "string" ? progress : "schema check"}`);
            } });
          if (!current()) return null;
          const gate = schemaGate(results);
          if (!gate.ok) {
            const failure = [...gate.invalid, ...gate.unavailable][0];
            const detail = failure?.diagnostics?.[0]?.message || failure?.status || "No schema returned a valid decision.";
            throw new Error(`${entry.name}: ${detail}`);
          }
          return { raw: entry.raw, schemaKey: key };
        },
        authorizationCurrent: (entry, token) => current() && entry.raw === token.raw && schemaSetKey(sourcesFor(entry)) === token.schemaKey,
      });
      if (!current()) throw new Error("The project changed after validation. Export its current revision again.");
      ctx.download(result.bytes, result.name, result.type);
      requested = true;
      const recovered = await ctx.persist();
      if (current() && recovered) ctx.status(`Project package download requested: ${snapshot.documents.length} validated XML files in ${result.name}. Local recovery is retained.`);
      return true;
    } catch (error) {
      if (requested) {
        ctx.status(`Project package download was requested. Local recovery failed: ${error.message}`);
        return true;
      }
      ctx.status(controller.signal.aborted
        ? "Project export cancelled. No package was downloaded."
        : `Project export blocked: ${error.message}`);
      return false;
    } finally {
      if (operation === controller) { operation = null; ctx.busy(false); }
    }
  }

  return {
    download,
    cancel() { operation?.abort(); },
    async open(file) {
      if (!file) return false;
      if (operation) { ctx.status("Cancel the running project export before opening another package."); return false; }
      try {
        const snapshot = decodeProjectBundle(await file.arrayBuffer());
        return (await ctx.restore(checkpointFromProjectDocuments(snapshot))) !== false;
      } catch (error) {
        ctx.status(`Project package was not opened: ${error.message}`);
        return false;
      }
    },
  };
}
