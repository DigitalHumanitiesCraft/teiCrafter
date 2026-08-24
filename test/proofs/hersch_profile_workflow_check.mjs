/**
 * Proof: a bare Hersch document selects the inline-GND load/save boundary.
 *
 * Run: node test/proofs/hersch_profile_workflow_check.mjs
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEdition } from "../../docs/js/editor/edition.js";
import { targetDocument, usesInlineGND, workingDocument } from "../../docs/js/editor/interchange.js";
import { detectProject } from "../../docs/js/editor/project-profiles.js";
import { parseDocument } from "../../docs/js/editor/tei-document.js";
import { addEntity, linkMention, readEntities, setAuthority } from "../../docs/js/editor/standoff.js";
import { entityTypeOptions } from "../../docs/js/editor/annotation-ui.js";
import { DEFAULT_SECTIONS } from "../../docs/js/editor/index-panel.js";
import { sectionsForEntityTypes } from "../../docs/js/editor/entity-index.js";
import { parseManifest } from "../../docs/js/editor/project-manifest.js";
import { check, finish, section } from "./_assert.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const ZBZ = resolve(REPO, "..", "..", "DHCraft", "zbz-ocr-tei");
const EDITOR_APP = readFileSync(join(REPO, "docs", "js", "editor", "editor-app.js"), "utf8");

const UNANNOTATED_HERSCH = `<?xml version="1.0" encoding="UTF-8"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0" type="naegeli"><text><body><p>New Person</p></body></text></TEI>`;
const NON_HERSCH = `<?xml version="1.0" encoding="UTF-8"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0" type="letter"><text><body><p><persName ref="GND:118815679">Jeanne Hersch</persName></p></body></text></TEI>`;

section("tight built-in profile signature");
const herschDoc = parseDocument(UNANNOTATED_HERSCH);
const herschProject = detectProject(herschDoc);
check("TEI type naegeli selects the Hersch profile", herschProject?.id === "zbz-hersch");
check("the Hersch profile selects inline-GND persistence", usesInlineGND(herschProject));
check("the Hersch profile declares its inline-GND-exportable entity types",
  herschProject.exportableEntityTypes.join(",") === "person,org,work");
check("the detected profile annotation UI offers only exportable entity types",
  entityTypeOptions(herschProject).map(([type]) => type).join(",") === "person,org,work");

const manifestProject = parseManifest({ teicrafter: 1, name: "Manifest Hersch", interchange: "inline-gnd" });
check("a manifest-loaded inline-GND project gets the same entity capability",
  manifestProject.exportableEntityTypes.join(",") === "person,org,work"
    && entityTypeOptions(manifestProject).map(([type]) => type).join(",") === "person,org,work");
const manifestSections = sectionsForEntityTypes(DEFAULT_SECTIONS, manifestProject.exportableEntityTypes);
check("the manifest-loaded index disables adding place and event but keeps them visible for cleanup",
  manifestSections.filter((section) => ["place", "event"].includes(section.type)).every((section) => section.addDisabled)
    && manifestSections.filter((section) => ["person", "org", "work"].includes(section.type)).every((section) => !section.addDisabled));
check("an unannotated Hersch final stays unchanged on load", workingDocument(herschDoc, herschProject) === herschDoc);

const nonHersch = parseDocument(NON_HERSCH);
check("another TEI type does not select the Hersch profile", detectProject(nonHersch) === null);
check("inline-looking markup alone does not trigger import", workingDocument(nonHersch, null) === nonHersch);
check("a non-Hersch target stays byte-identical", targetDocument(nonHersch, null).raw === NON_HERSCH);

section("editor controller wiring");
check("load routes the detected document through the working boundary",
  EDITOR_APP.includes("workingDocument(openedState.doc, resolvedProject)"));
check("ordinary save and download route through the project target boundary",
  EDITOR_APP.match(/targetDocument\(app\.state\.doc, app\.project\)/g)?.length >= 2);
check("the Download click cannot be mistaken for prepared XML",
  EDITOR_APP.includes('addEventListener("click", () => download())'));

section("new annotation saves in the Hersch target shape");
let edited = addEntity(herschDoc, "person", { name: "New Person" });
const person = readEntities(edited).persons[0];
edited = setAuthority(edited, person.id, "GND", "123456789");
const cell = parseEdition(edited.raw).cells.find((candidate) => candidate.text.trim() === "New Person");
edited = linkMention(edited, cell.node, person.id);
const target = targetDocument(edited, herschProject).raw;
check("the save target carries an inline person authority", target.includes('<persName ref="GND:123456789">New Person</persName>'));
check("the save target carries no standOff register", !/<standOff\b/.test(target));
check("reopening the saved target restores an editable register", readEntities(workingDocument(parseDocument(target), herschProject)).persons.length === 1);

section("real Hersch carriers");
const realSources = [
  { id: "1000 entity preview", path: join(ZBZ, "output", "entity_preview", "1000_final.xml"), imported: true },
  { id: "1540 final TEI", path: join(ZBZ, "output", "tei_final", "1540_final.xml"), imported: false },
];
const present = realSources.filter((source) => existsSync(source.path));
if (!present.length) {
  console.log("SKIP: real Hersch checkout is absent; synthetic profile contracts passed");
  process.exit(0);
}
for (const source of realSources) check(`${source.id} is present`, existsSync(source.path));
for (const source of realSources.filter((candidate) => existsSync(candidate.path))) {
  const raw = readFileSync(source.path, "utf8");
  const doc = parseDocument(raw);
  const project = detectProject(doc);
  check(`${source.id} is detected without a manifest`, project?.id === "zbz-hersch");
  const working = workingDocument(doc, project);
  check(`${source.id} import follows the presence of inline mentions`, (working !== doc) === source.imported);
  check(`${source.id} save projection is byte-identical without edits`, targetDocument(working, project).raw === raw);
}

finish("PASS: Hersch profile load and save boundary is deterministic.");
