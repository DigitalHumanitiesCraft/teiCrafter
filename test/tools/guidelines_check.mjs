/**
 * Proof: the TEI P5 Guidelines reader (tei-guidelines.js) parses the vendored
 * compilation (docs/data/tei/p5subset_en.json, pinned 4.11.0) and answers the
 * authoring questions correctly and offline:
 *   - the module list matches the pinned module count;
 *   - persName resolves to its full attribute set RECURSIVELY: @xml:id from
 *     att.global, @facs from the nested att.global.facs class (the recursion
 *     proof), plus @ref @key @type, 51 attributes in total at 4.11.0;
 *   - attributes are deduplicated (xml:id appears exactly once);
 *   - module and scope filters work, scope unions modules and elements and
 *     deduplicates, unknown names are skipped silently;
 *   - gloss and desc are returned as plain text (embedded markup stripped);
 *   - malformed input is rejected, unknown idents return null;
 *   - the module is an authoring aid, not a validator (no validate export);
 *   - guidelinesVersion reports the pinned version.
 *
 * Pinned to the vendored version. On a guidelines update, update these counts
 * and the NOTICE in the same commit (see docs/data/tei/NOTICE.md).
 *
 * Run: node test/tools/guidelines_check.mjs   (exit 0 = all pass)
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as G from "../../docs/js/editor/tei-guidelines.js";
import {
  parseGuidelines, elementByName, elementsByModule, elementsForScope,
  moduleList, guidelinesVersion,
} from "../../docs/js/editor/tei-guidelines.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

// Pinned to the vendored 4.11.0 compilation. Update with the data and NOTICE.
const PINNED_VERSION = "4.11.0";
const PINNED_MODULE_COUNT = 22;
const PINNED_PERSNAME_ATTS = 51;

let passed = 0, failed = 0;
function check(cond, label) {
  if (cond) { passed++; console.log("  ok    " + label); }
  else { failed++; console.log("  FAIL  " + label); }
}

console.log("\nTEI P5 Guidelines reader proof (plan 2.2)");
console.log("=".repeat(60));

const text = readFileSync(join(ROOT, "docs", "data", "tei", "p5subset_en.json"), "utf8");
const g = parseGuidelines(text);

// --- 1. Module list ----------------------------------------------------------

const mods = moduleList(g);
check(mods.length === PINNED_MODULE_COUNT,
  `module list has ${PINNED_MODULE_COUNT} modules (got ${mods.length})`);
check(mods.includes("namesdates") && mods.includes("tei") && mods.includes("core"),
  "module list includes namesdates, core and the element-free tei module");
check(mods.join(",") === [...mods].sort().join(","), "module list is sorted");

// --- 2. persName: recursive attribute resolution -----------------------------

const persName = elementByName(g, "persName");
check(persName !== null && persName.module === "namesdates",
  "persName resolves, module is namesdates");
const attIdents = persName.attributes.map((a) => a.ident);
check(attIdents.includes("xml:id"), "persName carries @xml:id (from att.global)");
check(attIdents.includes("facs"),
  "persName carries @facs (from the nested att.global.facs class: the recursion proof)");
check(["ref", "key", "type"].every((a) => attIdents.includes(a)),
  "persName carries @ref, @key and @type");
check(persName.attributes.length === PINNED_PERSNAME_ATTS,
  `persName resolves to ${PINNED_PERSNAME_ATTS} attributes (got ${persName.attributes.length})`);

// each entry has the documented shape
const xmlid = persName.attributes.find((a) => a.ident === "xml:id");
check(xmlid && xmlid.usage === "opt" && xmlid.datatype === "ID" && xmlid.valList === null,
  "@xml:id projects to { usage 'opt', datatype 'ID' (dataRef name), valList null }");
const facs = persName.attributes.find((a) => a.ident === "facs");
check(facs && facs.datatype === "teidata.pointer",
  "@facs datatype is teidata.pointer (dataRef key preferred)");

// --- 3. Deduplication --------------------------------------------------------

check(attIdents.filter((a) => a === "xml:id").length === 1,
  "@xml:id appears exactly once (dedup over the class graph)");
const dupCount = attIdents.length - new Set(attIdents).size;
check(dupCount === 0, "no attribute ident is duplicated in the resolved list");

// --- 4. Module and scope filters ---------------------------------------------

const namesdates = elementsByModule(g, "namesdates");
check(namesdates.includes("persName") && namesdates.includes("placeName"),
  "elementsByModule(namesdates) lists persName and placeName");
check(namesdates.every((id) => elementByName(g, id).module === "namesdates"),
  "every element from elementsByModule(namesdates) reports module namesdates");
check(elementsByModule(g, "no-such-module").length === 0,
  "an unknown module yields an empty element list");

const scope = elementsForScope(g, { modules: ["namesdates"], elements: ["persName", "hi", "ghostElement"] });
check(scope.includes("hi"), "scope adds an explicitly named element from another module (@hi)");
check(scope.filter((id) => id === "persName").length === 1,
  "scope deduplicates an element that is both in a named module and named explicitly (persName)");
check(!scope.includes("ghostElement"), "scope skips an unknown element ident silently");
check(scope.length === new Set(scope).size, "the scope union has no duplicates");
const scopeUnknownModule = elementsForScope(g, { modules: ["no-such-module"], elements: ["hi"] });
check(scopeUnknownModule.length === 1 && scopeUnknownModule[0] === "hi",
  "scope skips an unknown module name silently, keeps the named element");
check(elementsForScope(g, {}).length === 0, "an empty scope yields no elements");

// --- 5. gloss / desc tag stripping -------------------------------------------

const tei = elementByName(g, "TEI");
check(tei.desc.length > 0 && !tei.desc.includes("<") && !tei.desc.includes(">"),
  "TEI desc (contains <gi> and <ident> markup) is returned as plain text, no angle brackets");
check(/model\.resource/.test(tei.desc) && /TEI/.test(tei.desc),
  "TEI desc keeps the inner text content of the stripped tags");
check(persName.gloss === "personal name", "persName gloss strips to the plain phrase");
check(!persName.desc.includes("<") && persName.desc.startsWith("contains a proper noun"),
  "persName desc is plain text and reads correctly");

// --- 6. Malformed input, unknown ident ---------------------------------------

let threw = false;
try { parseGuidelines({}); } catch (_e) { threw = true; }
check(threw, "parseGuidelines({}) throws (missing elements/classes/modules)");
threw = false;
try { parseGuidelines("{not json"); } catch (e) { threw = /not valid JSON/.test(e.message); }
check(threw, "parseGuidelines rejects invalid JSON with a precise message");
check(elementByName(g, "noSuchElement") === null, "elementByName returns null for an unknown ident");

// --- 7. No validate export ---------------------------------------------------

check(!("validate" in G), "the module exports no symbol named validate (authoring aid, not a validator)");

// --- 8. guidelinesVersion ----------------------------------------------------

check(guidelinesVersion(g) === PINNED_VERSION,
  `guidelinesVersion returns the pinned version "${PINNED_VERSION}"`);

// --- summary -----------------------------------------------------------------

console.log("=".repeat(60));
if (failed === 0) {
  console.log(`PASSED (${passed}/${passed})`);
  console.log("The guidelines reader resolves attributes recursively and reads offline.");
  process.exit(0);
} else {
  console.log(`FAILED (${passed}/${passed + failed}, ${failed} failing)`);
  process.exit(1);
}
