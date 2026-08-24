import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inventoryDocument } from "../../docs/js/editor/document-inventory.js";
import { parseEdition, serialize } from "../../docs/js/editor/edition.js";
import { resolveSourceProfile } from "../../docs/js/editor/source-profile.js";
import { parseDocument } from "../../docs/js/editor/tei-document.js";
import { validateWithSchemas } from "../../docs/js/editor/schema-validation.js";
import { check, finish, section } from "./_assert.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const fixtureDirectory = join(root, "test", "fixtures-synthetic", "source-profiles");
const schema = readFileSync(
  join(root, "docs", "schemas", "tei-p5-4.11.0", "tei_all.rng"),
  "utf8",
);
const schemaSource = [{ name: "tei_all.rng", type: "relaxng", text: schema }];

const cases = [
  {
    file: "dictionary-paginated.xml",
    root: "TEI",
    primary: "entries",
    primaryUnits: 2,
    capabilities: ["pages", "entries", "facsimile-resource", "logical-flow", "header-metadata"],
    channels: ["pages", "entries", "surfaces", "document"],
    counts: { pb: 2, entry: 2, surface: 2 },
    facsimile: { mode: "milestone-surface", alignment: "exact" },
  },
  {
    file: "drama-paginated.xml",
    root: "TEI",
    primary: "speech-turns",
    primaryUnits: 3,
    capabilities: [
      "pages",
      "speech-turns",
      "dramatic-context",
      "facsimile-resource",
      "logical-flow",
      "header-metadata",
    ],
    channels: ["pages", "speech-turns", "sections", "surfaces", "document"],
    counts: { pb: 2, sp: 2, div: 1, surface: 2 },
    facsimile: { mode: "milestone-surface", alignment: "exact" },
  },
  {
    file: "spoken-corpus.xml",
    root: "teiCorpus",
    primary: "corpus-members",
    primaryUnits: 2,
    capabilities: [
      "corpus-members",
      "speech-turns",
      "token-analysis",
      "logical-flow",
      "header-metadata",
    ],
    channels: ["corpus-members", "speech-turns", "document"],
    counts: { TEI: 2, u: 2, s: 2, w: 6 },
    facsimile: { mode: "none", alignment: "none" },
  },
  {
    file: "correspondence.xml",
    root: "TEI",
    primary: "sections",
    primaryUnits: 1,
    capabilities: ["correspondence-metadata", "logical-flow", "header-metadata"],
    channels: ["sections", "document"],
    counts: { correspDesc: 1, correspAction: 2, div: 1 },
    facsimile: { mode: "none", alignment: "none" },
  },
  {
    file: "critical-edition.xml",
    root: "TEI",
    primary: "sections",
    primaryUnits: 1,
    capabilities: ["apparatus", "logical-flow", "header-metadata"],
    channels: ["sections", "document"],
    counts: { listWit: 1, witness: 2, listApp: 1, app: 1, lem: 1, rdg: 1, anchor: 2 },
    values: [
      { element: "app", attribute: "from", expected: "#lemma-start" },
      { element: "app", attribute: "to", expected: "#lemma-end" },
    ],
    facsimile: { mode: "none", alignment: "none" },
  },
  {
    file: "facsimile-only.xml",
    root: "TEI",
    primary: "surfaces",
    primaryUnits: 2,
    capabilities: ["facsimile-resource", "header-metadata"],
    channels: ["surfaces", "document"],
    counts: { surface: 2, graphic: 2 },
    facsimile: { mode: "surface", alignment: "positional" },
  },
  {
    file: "source-document.xml",
    root: "TEI",
    primary: "source-documents",
    primaryUnits: 1,
    capabilities: ["facsimile-resource", "source-document", "header-metadata"],
    channels: ["source-documents", "surfaces", "document"],
    counts: { sourceDoc: 1, surface: 2, zone: 2, line: 2 },
    facsimile: { mode: "source-doc", alignment: "none" },
  },
  {
    file: "mixed-capabilities.xml",
    root: "TEI",
    primary: "entries",
    primaryUnits: 1,
    capabilities: [
      "pages",
      "entries",
      "speech-turns",
      "token-analysis",
      "correspondence-metadata",
      "apparatus",
      "facsimile-resource",
      "tabular",
      "logical-flow",
      "header-metadata",
    ],
    channels: [
      "pages",
      "entries",
      "speech-turns",
      "table-rows",
      "sections",
      "surfaces",
      "document",
    ],
    counts: { pb: 1, entry: 1, sp: 1, w: 2, correspDesc: 1, app: 1, table: 1, surface: 1 },
    facsimile: { mode: "milestone-surface", alignment: "exact" },
    issue: "ambiguous-primary-navigation",
  },
];

function sameMembers(actual, expected) {
  return JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort());
}

section("Synthetic TEI source-profile fixtures");

for (const fixture of cases) {
  const path = join(fixtureDirectory, fixture.file);
  const raw = readFileSync(path, "utf8");
  const doc = parseDocument(raw);
  const inventory = inventoryDocument(doc);
  const profile = resolveSourceProfile({ doc, inventory });
  const state = parseEdition(raw);

  check(`${fixture.file}: generic parser preserves the canonical bytes`, doc.raw === raw);
  check(`${fixture.file}: edition round-trip is byte-identical`, serialize(state) === raw);
  check(`${fixture.file}: TEI root resolves by namespace and local name`, inventory.root === fixture.root);

  const enabled = profile.capabilities.filter((capability) => capability.enabled)
    .map((capability) => capability.id);
  check(`${fixture.file}: enabled capabilities match the fixture contract`,
    sameMembers(enabled, fixture.capabilities));
  check(`${fixture.file}: navigation channels match the encoded structures`,
    sameMembers(profile.navigation.channels.map((channel) => channel.id), fixture.channels));
  check(`${fixture.file}: primary navigation is ${fixture.primary}`,
    profile.navigation.primary.id === fixture.primary);
  check(`${fixture.file}: primary navigation exposes ${fixture.primaryUnits} unit(s)`,
    profile.navigation.primary.units.length === fixture.primaryUnits);
  check(`${fixture.file}: facsimile mode and alignment match the source model`,
    profile.facsimile.mode === fixture.facsimile.mode
      && profile.facsimile.alignment === fixture.facsimile.alignment);

  for (const [localName, count] of Object.entries(fixture.counts)) {
    check(`${fixture.file}: contains ${count} TEI ${localName} element(s)`,
      inventory.count(localName) === count);
  }
  for (const value of fixture.values || []) {
    check(`${fixture.file}: ${value.element}@${value.attribute} preserves ${value.expected}`,
      inventory.values(value.element, value.attribute).includes(value.expected));
  }
  if (fixture.issue) {
    check(`${fixture.file}: reports ${fixture.issue}`,
      profile.issues.some((issue) => issue.code === fixture.issue));
  }

  const validation = await validateWithSchemas(raw, schemaSource);
  if (validation[0].status !== "valid") {
    console.log(`    ${validation[0].diagnostics.map((item) => item.message).join(" | ")}`);
  }
  check(`${fixture.file}: validates against TEI P5 4.11.0 TEI All`,
    validation.length === 1 && validation[0].status === "valid");
}

finish("source_profile_fixtures_check passed");
