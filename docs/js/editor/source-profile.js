/** Resolve a composed UI profile from declared constraints and actual TEI structure. */

import { inventoryDocument } from "./document-inventory.js";
import { materializeNavigation } from "./navigation-model.js";
import { uiProfileForFile } from "./project-manifest.js";
import { structuralCapabilities } from "./source-profile-rules.js";

function capabilityMap(capabilities) {
  return new Map(capabilities.map((capability) => [capability.id, capability]));
}

function preferredChannel(channels, capabilities, inventory) {
  const enabled = capabilityMap(capabilities);
  const available = (id) => channels.find((channel) => channel.id === id)
    && enabled.get(channels.find((channel) => channel.id === id).capability)?.enabled;
  for (const id of ["corpus-members", "entries", "speech-turns"]) {
    if (available(id)) return channels.find((channel) => channel.id === id);
  }
  if (!available("pages") && available("table-rows")) {
    return channels.find((channel) => channel.id === "table-rows");
  }
  if (available("records")) return channels.find((channel) => channel.id === "records");
  if (inventory.reading.characters === 0 && available("source-documents")) {
    return channels.find((channel) => channel.id === "source-documents");
  }
  for (const id of ["pages", "sections"]) {
    if (available(id)) return channels.find((channel) => channel.id === id);
  }
  if (inventory.reading.characters === 0 && available("surfaces")) {
    return channels.find((channel) => channel.id === "surfaces");
  }
  return channels.find((channel) => channel.id === "document");
}

function schemaAllowance(capability, schemaEvidence) {
  if (!schemaEvidence || !schemaEvidence.capabilities) return capability;
  const allowed = schemaEvidence.capabilities[capability.id];
  if (typeof allowed !== "boolean") return capability;
  return {
    ...capability,
    allowed,
    enabled: capability.present && allowed,
    source: allowed ? capability.source : "schema",
    evidence: allowed
      ? capability.evidence
      : [...capability.evidence, "excluded by the active vocabulary schema set"],
  };
}

function facsimileMode(inventory) {
  if (inventory.has("sourceDoc")) return "source-doc";
  if (inventory.has("surface") && inventory.has("pb")) return "milestone-surface";
  if (inventory.has("surface")) return "surface";
  if (inventory.facsimileRefs.external > 0) return "source-doc";
  return "none";
}

function metadataPanels(inventory) {
  const definitions = [
    ["header", "TEI header", "header-metadata", inventory.has("teiHeader")],
    ["manuscript", "Manuscript", "header-metadata", inventory.has("msDesc")],
    ["correspondence", "Correspondence", "correspondence-metadata", inventory.has("correspDesc")],
    ["encoding", "Encoding", "header-metadata", inventory.has("encodingDesc")],
    ["classification", "Classification", "header-metadata", inventory.has("textClass")],
    ["revision", "Revision history", "header-metadata", inventory.has("revisionDesc")],
    ["corpus", "Corpus and participants", "corpus-members", inventory.has("particDesc") || inventory.has("textDesc")],
    ["witnesses", "Witnesses", "apparatus", inventory.has("listWit") || inventory.has("variantEncoding")],
    ["performance", "Performance", "dramatic-context", inventory.has("castList") || inventory.has("performance")],
  ];
  return definitions.map(([id, label, capability, available]) => ({
    id, label, capability, available, reason: available ? null : "Structure not present in this TEI",
  }));
}

function readingProjections(inventory) {
  const normalized = ["choice", "reg", "corr", "expan"].some((name) => inventory.has(name))
    || inventory.values("w", "norm").length > 0;
  const token = inventory.has("w");
  return {
    default: "diplomatic",
    projections: [
      { id: "diplomatic", label: "Diplomatic", capability: "logical-flow", available: inventory.reading.characters > 0, reason: inventory.reading.characters > 0 ? null : "No reading text" },
      { id: "normalized", label: "Normalized", capability: "logical-flow", available: normalized, reason: normalized ? null : "No encoded normalized alternatives" },
      { id: "tokens", label: "Tokens", capability: "token-analysis", available: token, reason: token ? null : "No TEI w elements" },
    ],
  };
}

/**
 * Resolve the source profile. Manifest override merging is deliberately field-wise;
 * an unsatisfied primary-navigation override is reported and falls back safely.
 */
export function resolveSourceProfile(input) {
  const inventory = input.inventory || inventoryDocument(input.doc);
  const schemaEvidence = input.schemaEvidence || null;
  let capabilities = structuralCapabilities(inventory)
    .map((capability) => schemaAllowance(capability, schemaEvidence));
  const channels = materializeNavigation(input.doc);
  const issues = (schemaEvidence?.issues || [])
    .filter((issue) => issue.severity !== "info")
    .map((issue) => ({
    ...issue,
    resolution: issue.resolution || "Structural evidence remains available while schema inspection is incomplete.",
    }));
  let primary = preferredChannel(channels, capabilities, inventory);

  const override = uiProfileForFile(input.project, input.fileName);
  if (override && Array.isArray(override.disableCapabilities)) {
    const disabled = new Set(override.disableCapabilities);
    capabilities = capabilities.map((capability) => disabled.has(capability.id)
      ? { ...capability, enabled: false, source: "manifest", evidence: [...capability.evidence, "disabled by manifest"] }
      : capability);
    const primaryCapability = capabilityMap(capabilities).get(primary.capability);
    if (!primaryCapability?.enabled) primary = preferredChannel(channels, capabilities, inventory);
  }
  if (override && override.primaryNavigation) {
    const requested = channels.find((channel) => channel.id === override.primaryNavigation);
    const capability = requested && capabilityMap(capabilities).get(requested.capability);
    if (requested && capability?.enabled && requested.units.length) {
      primary = { ...requested, source: "manifest", evidence: [...requested.evidence, "selected by manifest"] };
    } else {
      issues.push({
        code: "override-unsatisfied",
        severity: "warning",
        message: `The manifest requested navigation "${override.primaryNavigation}", but the current TEI has no usable matching units.`,
        resolution: `Using ${primary.label}.`,
      });
    }
  }

  if (inventory.has("entry") && (inventory.has("u") || inventory.has("sp"))) {
    issues.push({
      code: "ambiguous-primary-navigation",
      severity: "info",
      message: "Dictionary-entry and speech-turn structures are both present.",
      candidates: ["entries", "speech-turns"],
      resolution: `Using ${primary.label}; a manifest can select another existing channel.`,
    });
  }
  if (inventory.reading.characters === 0 && inventory.has("surface")) {
    issues.push({
      code: "facsimile-only",
      severity: "info",
      message: "The TEI contains facsimile surfaces but no projected reading text.",
      resolution: "Using facsimile-surface navigation.",
    });
  }

  const mode = facsimileMode(inventory);
  const internalRefs = inventory.facsimileRefs.internal;
  const alignment = mode === "milestone-surface" && internalRefs > 0
    ? "exact"
    : mode === "surface" ? "positional" : "none";
  const authoringScope = input.project?.teiScope || null;
  return {
    version: 1,
    evidence: {
      guidelinesVersion: input.guidelines?.version || null,
      schema: schemaEvidence ? {
        kind: schemaEvidence.kind || "unknown",
        completeness: schemaEvidence.completeness || "unknown",
        sources: schemaEvidence.sources || [],
        constraints: schemaEvidence.constraints || [],
      } : null,
      signals: capabilities.filter((capability) => capability.present).map((capability) => ({
        id: capability.id,
        source: capability.source,
        strength: "strong",
        detail: capability.evidence.join("; "),
      })),
    },
    capabilities,
    navigation: { primary, channels },
    reading: readingProjections(inventory),
    metadataPanels: metadataPanels(inventory),
    contextPanels: [
      { id: "facsimile", label: "Facsimile", capability: "facsimile-resource", available: mode !== "none", reason: mode === "none" ? "No facsimile resource" : null },
      { id: "index", label: "Index", capability: "logical-flow", available: true, reason: null },
      { id: "apparatus", label: "Apparatus", capability: "apparatus", available: inventory.has("app") || inventory.has("listApp"), reason: inventory.has("app") || inventory.has("listApp") ? null : "No apparatus structure" },
    ],
    annotations: {
      groups: capabilities.filter((capability) => capability.enabled).map((capability) => capability.id),
      closed: Boolean(input.project?.markupClosed),
      arbitraryMarkup: !input.project?.markupClosed,
    },
    facsimile: { mode, alignment, unresolved: [] },
    review: { anchorChannel: primary.id, storage: null },
    authoring: {
      modules: authoringScope?.modules || [],
      elements: authoringScope?.elements || [],
      source: authoringScope ? "manifest" : schemaEvidence ? "schema" : "fallback",
      completeness: authoringScope ? "exact" : schemaEvidence?.completeness || "unknown",
    },
    issues,
  };
}
