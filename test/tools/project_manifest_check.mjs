/**
 * Proof: the declarative project manifest (WB-AP3, teicrafter.project.json) is
 * parsed, validated and normalized into the same runtime project shape the
 * built-in PID profiles produce:
 *   - the shipped Wenzelsbibel manifest (the first profile) parses and carries
 *     name, image resolver, markup, indices (incl. peoples/Voelker) and views;
 *   - its image resolver yields byte-identical tile sources to the built-in
 *     PID profile (manifest and fallback agree);
 *   - manifest markup entries become wrap builders that splice losslessly
 *     through standoff.wrapRange (attribute values XML-escaped);
 *   - malformed manifests are rejected with precise messages, never half-read.
 *
 * Run: node test/tools/project_manifest_check.mjs   (exit 0 = all pass)
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  parseManifest, markupForFile, typeForFile, teiScopeForFile, resolveMarkup,
  MANIFEST_FILENAME, MANIFEST_VERSION,
} from "../../docs/js/editor/project-manifest.js";
import { parseGuidelines } from "../../docs/js/editor/tei-guidelines.js";
import { detectProject, projectTileSource } from "../../docs/js/editor/project-profiles.js";
import { parseEdition } from "../../docs/js/editor/edition.js";
import { tokenize } from "../../docs/js/editor/tei-document.js";
import * as standoff from "../../docs/js/editor/standoff.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

let passed = 0, failed = 0;
function check(cond, label) {
  if (cond) { passed++; console.log("  ok    " + label); }
  else { failed++; console.log("  FAIL  " + label); }
}
function rejects(input, reLabel, label) {
  try { parseManifest(input); check(false, label + " (no error thrown)"); }
  catch (err) { check(reLabel.test(err.message), `${label} ("${err.message}")`); }
}
const reparses = (raw) => tokenize(raw).map((t) => raw.slice(t.start, t.end)).join("") === raw;

console.log("\nProject manifest proof (WB-AP3)");
console.log("=".repeat(60));

// --- 1. The shipped Wenzelsbibel manifest (the first profile) -----------------

const wbText = readFileSync(join(ROOT, "docs", "data", "editor", "wb-codex", MANIFEST_FILENAME), "utf8");
const wb = parseManifest(wbText);

check(wb.source === "manifest" && wb.name === "Wenzelsbibel (Codex 2759)",
  "WB manifest: parses, source 'manifest', project name carried");
check(wb.iiifImageTemplate && wb.iiifImageTemplate.includes("iiif.onb.ac.at") && wb.iiifImageTemplate.includes("{stem}"),
  "WB manifest: OENB IIIF image template present");
check(Array.isArray(wb.markup) && wb.markup.length === 12,
  "WB manifest: 12 markup wraps (the guidelines' inline inventory)");
check(wb.markup.every(([label, build]) => typeof label === "string" && typeof build === "function"),
  "WB manifest: markup normalized to the [label, build] wrap shape");
check(wb.indices.map((i) => i.key).join(",") === "persons,places,peoples",
  "WB manifest: indices persons, places, peoples (Voelker) declared");
check(wb.indices[2].listType === null,
  "WB manifest: peoples index leaves listType open (schema undecided, not invented)");
check(wb.views.map((v) => v.key).join(",") === "diplomatic,bible-verse,image-annotation",
  "WB manifest: the three authoring views declared");
check(wb.schema === null, "WB manifest: no schema URL claimed (none exists yet)");

// --- 1b. Every example loads as a project: the other two shipped manifests -----

for (const [dir, file, projName] of [
  ["szd", "o_szd.1079.tei.xml", "Stefan Zweig Digital"],
  ["zbz-100", "zbz-hersch-100.xml", "Jeanne Hersch (Zentralbibliothek Zürich)"],
]) {
  const p = parseManifest(readFileSync(join(ROOT, "docs", "data", "editor", dir, MANIFEST_FILENAME), "utf8"));
  const t = typeForFile(p, file);
  check(p.name === projName && t && t.key === "letter",
    `${dir} example manifest: parses, names the project, types ${file} as a letter`);
  check(markupForFile(p, file) === null,
    `${dir} example manifest: no markup claimed (built-in wraps apply; no invented guidelines)`);
}

// --- 2. Image resolver: manifest and built-in PID profile agree ---------------

const HEADER =
  "<teiHeader><fileDesc><titleStmt><title>t</title></titleStmt>" +
  '<publicationStmt><idno type="PID">o:wen.codex-2759</idno></publicationStmt></fileDesc></teiHeader>';
const WRAPTEI = (body) => '<TEI xmlns="http://www.tei-c.org/ns/1.0">' + HEADER + "<text><body>" + body + "</body></text></TEI>";

const state0 = parseEdition(WRAPTEI('<p><w xml:id="w1">Hallo</w> <w xml:id="w2">Welt</w></p>'));
const detected = detectProject(state0.doc);
check(detected !== null, "PID fallback: o:wen.* still detects the built-in profile");
const viaManifest = projectTileSource(wb, "00000010.jpg");
check(viaManifest === "https://iiif.onb.ac.at/images/REPO/8977428/00000010.jp2/info.json",
  "manifest resolver: bare filename becomes the info.json tile source");
check(viaManifest === projectTileSource(detected, "00000010.jpg"),
  "manifest and built-in profile resolve byte-identically");
check(projectTileSource(wb, "https://example.org/x.jpg") === null,
  "absolute URLs are not rewritten (resolve themselves)");
check(projectTileSource(wb, "page.svg") === null, "non-raster filenames are not rewritten");

// --- 3. Markup wraps splice losslessly through wrapRange ----------------------

const synth = parseManifest({
  teicrafter: 1,
  name: "Synthetic",
  markup: [
    { element: "hi" },
    { element: "supplied", label: "supplied (editor)", attributes: { reason: 'add"itional<P>' } },
  ],
});
const [hiLabel, hiBuild] = synth.markup[0];
check(hiLabel === "hi", "markup label defaults to the element name");
check(hiBuild("x") === "<hi>x</hi>", "plain wrap builds the bare element");
const [, suppliedBuild] = synth.markup[1];
check(suppliedBuild("x") === '<supplied reason="add&quot;itional&lt;P&gt;">x</supplied>',
  "attribute values are XML-escaped in the opening tag");

let state = parseEdition(WRAPTEI('<p><w xml:id="w1">Hallo</w> <w xml:id="w2">Welt</w></p>'));
let cell = state.cellById.get("w1");
let doc = standoff.wrapRange(state.doc, cell.node, 0, cell.node.end - cell.node.start, hiBuild);
check(doc !== state.doc && doc.raw.includes('<w xml:id="w1"><hi>Hallo</hi></w>'),
  "wrapRange + manifest wrap: the cell core is wrapped in place");
check(doc.raw.includes('<w xml:id="w2">Welt</w>'), "sibling word is byte-identical");
check(reparses(doc.raw), "the wrapped document still tokenizes byte-covering");

// --- 4. Document types: the element inventory binds to the type, not the project

const szd = parseManifest({
  teicrafter: 1,
  name: "Stefan Zweig Digital (test)",
  markup: [{ element: "hi" }],
  documentTypes: [
    { key: "letter", label: "Letter", markup: [{ element: "salute" }, { element: "signed" }] },
    { key: "lifeDocument", label: "Life document" },
  ],
  files: { "brief-001.xml": "letter", "dok-001.xml": "lifeDocument" },
});
check(szd.documentTypes.length === 2 && szd.documentTypes[1].markup === null,
  "documentTypes parsed; a type may leave markup to the project default");
check(typeForFile(szd, "brief-001.xml") && typeForFile(szd, "brief-001.xml").label === "Letter",
  "typeForFile resolves the files map");
check(typeForFile(szd, "unknown.xml") === null, "a file without assignment has no type");
check(markupForFile(szd, "brief-001.xml").length === 2 && markupForFile(szd, "brief-001.xml")[0][0] === "salute",
  "a letter gets the letter inventory");
check(markupForFile(szd, "dok-001.xml")[0][0] === "hi",
  "a type without markup falls back to the project default");
check(markupForFile(szd, "unknown.xml")[0][0] === "hi", "an unassigned file gets the project default");
check(markupForFile(null, "x.xml") === null, "no project yields null (built-in wraps apply)");
check(wb.documentTypes.length === 0 && Object.keys(wb.files).length === 0,
  "a manifest without types (WB: one-type codex) parses with empty types/files");

// --- 4b. Malformed manifests are rejected, never half-read ---------------------

rejects({ teicrafter: 1, name: "x", documentTypes: [{ label: "no key" }] }, /documentTypes\[0\]\.key is missing/,
  "a document type without a key is rejected");
rejects({ teicrafter: 1, name: "x", files: { "a.xml": "ghost" } }, /unknown document type "ghost"/,
  "a files entry naming an unknown type is rejected");
rejects({ teicrafter: 1, name: "x", files: "a.xml" }, /"files" is not an object/,
  "a non-object files map is rejected");

// --- 4c. Malformed manifests are rejected, never half-read ---------------------

rejects("{not json", /not valid JSON/, "invalid JSON is rejected");
rejects([], /not a JSON object/, "a JSON array is rejected");
rejects({ teicrafter: 2, name: "x" }, /"teicrafter" must be 1/, `unknown format version is rejected (v${MANIFEST_VERSION} only)`);
rejects({ teicrafter: 1 }, /"name" is missing/, "a manifest without a name is rejected");
rejects({ teicrafter: 1, name: "x", imageResolver: { type: "magic" } }, /unknown imageResolver type/,
  "an unknown imageResolver type is rejected");
rejects({ teicrafter: 1, name: "x", imageResolver: { type: "iiif-image-template", template: "no-stem" } },
  /must contain "\{stem\}"/, "a template without {stem} is rejected");
rejects({ teicrafter: 1, name: "x", markup: [{ element: "foo bar" }] }, /not a valid XML element name/,
  "an injected element name is rejected");
rejects({ teicrafter: 1, name: "x", markup: [{ element: "hi", attributes: { "a b": "v" } }] },
  /not a valid XML attribute name/, "an injected attribute name is rejected");
rejects({ teicrafter: 1, name: "x", indices: [{ label: "no key" }] }, /indices\[0\]\.key is missing/,
  "an index definition without a key is rejected");
rejects({ teicrafter: 1, name: "x", views: [42] }, /views\[0\]/, "a non-string, non-object view is rejected");

check(parseManifest({ teicrafter: 1, name: "x", views: ["diplomatic"] }).views[0].label === "diplomatic",
  "string shorthand views normalize to {key, label}");

// --- 5. TEI vocabulary scope (teiModules / teiElements) ------------------------

const scoped = parseManifest({
  teicrafter: 1,
  name: "Scoped",
  markup: [{ element: "supplied", label: "supplied (editor)" }],
  teiModules: ["namesdates"],
  teiElements: ["supplied", "persName", "ghostElement"],
  documentTypes: [
    { key: "letter", teiElements: ["foreign"] },
    { key: "plain" },
  ],
  files: { "brief.xml": "letter", "doc.xml": "plain" },
});
check(scoped.teiScope.modules.join(",") === "namesdates"
  && scoped.teiScope.elements.join(",") === "supplied,persName,ghostElement",
  "project-level teiModules/teiElements parse into the scope");
check(teiScopeForFile(scoped, "brief.xml").elements.join(",") === "foreign",
  "a type with its own scope wins for its files (same precedence as markup)");
check(teiScopeForFile(scoped, "doc.xml").elements.includes("persName"),
  "a type without a scope falls back to the project scope");
check(teiScopeForFile(scoped, "unknown.xml").modules.join(",") === "namesdates",
  "an unassigned file gets the project scope");
check(teiScopeForFile(null, "x.xml").modules.length === 0 && teiScopeForFile(wb, "x.xml").elements.length === 0,
  "no project and pre-scope manifests yield the empty scope (old manifests unchanged)");

rejects({ teicrafter: 1, name: "x", teiModules: "core" }, /"teiModules" is not an array/,
  "a non-array teiModules is rejected");
rejects({ teicrafter: 1, name: "x", teiElements: ["foo bar"] }, /teiElements\[0\] is not a valid XML element name/,
  "an injected teiElements name is rejected");
rejects({ teicrafter: 1, name: "x", documentTypes: [{ key: "t", teiModules: [42] }] },
  /documentTypes\[0\]\.teiModules\[0\]/, "a type-level scope error names its position");

// --- 6. resolveMarkup: explicit wraps + teiElements-derived wraps --------------

const g = parseGuidelines(readFileSync(join(ROOT, "docs", "data", "tei", "p5subset_en.json"), "utf8"));

// Degradation contract: without guidelines the explicit list is the whole answer.
check(resolveMarkup(scoped, "doc.xml", null) === markupForFile(scoped, "doc.xml"),
  "null guidelines: resolveMarkup returns exactly the explicit markup (degradation)");
check(resolveMarkup(null, "x.xml", null) === null,
  "null guidelines, no project: null (built-in wraps apply)");

const resolved = resolveMarkup(scoped, "doc.xml", g);
check(resolved[0][0] === "supplied (editor)",
  "explicit markup entries come first and keep their labels");
check(resolved.filter((w) => w[2] === "supplied").length === 1,
  "a teiElements entry already covered by explicit markup is not derived twice");
const derivedPers = resolved.find((w) => w[2] === "persName");
check(!!derivedPers && derivedPers[0] === "personal name (persName)",
  'derived wraps are labelled "gloss (element)"');
check(derivedPers && derivedPers[1]("x") === "<persName>x</persName>",
  "a derived wrap builds the bare element around the selection");
check(!resolved.some((w) => w[2] === "ghostElement"),
  "an element unknown to the guidelines is skipped silently");
check(!resolved.some((w) => w[2] === "placeName"),
  "teiModules never feed the wrap menu (namesdates is scoped, placeName not derived)");

const modulesOnly = parseManifest({ teicrafter: 1, name: "m", teiModules: ["namesdates"] });
check(resolveMarkup(modulesOnly, "x.xml", g) === null,
  "a modules-only scope derives no wraps: built-in wraps stay in force");

// --- summary ------------------------------------------------------------------

console.log("=".repeat(60));
console.log(`${failed ? "FAILED" : "PASSED"}: ${passed}/${passed + failed} checks.`);
process.exit(failed ? 1 : 0);
