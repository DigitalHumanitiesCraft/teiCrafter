import { parseDocument, firstTeiByLocal, editTextAndAttrs, getXmlId } from "../../docs/js/editor/tei-document.js";
import { inventoryDocument } from "../../docs/js/editor/document-inventory.js";
import { iconclassNotation } from "../../docs/js/editor/iconclass-lookup.js";
import { isWenzelsProject, withWenzelsDefaults, WENZELS_EDITORIAL_SCHEMA_URL } from "../../docs/js/editor/wenzels-profile.js";
import { checkWenzelsRegisters, referencesRegisterId, singleBranchChoices, keepSingleChoiceBranch, choiceLabel } from "../../docs/js/editor/wenzels-project-checks.js";
import { createWenzelsRegistersDocument, createWenzelsRegisterEntry } from "../../docs/js/editor/wenzels-register-model.js";
import { readWenzelsWords, updateWenzelsWord } from "../../docs/js/editor/wenzels-text-model.js";
import { check, finish, section } from "./_assert.mjs";

function rejects(action) { try { action(); return false; } catch { return true; } }
function documentWith(content) {
  return parseDocument(`<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p>${content}</p></body></text></TEI>`);
}

section("Exact sole-branch choice repair");
const choiceRaw = '<?xml version="1.0"?>\r\n<tei:TEI xmlns:tei="http://www.tei-c.org/ns/1.0"><tei:text><tei:body><tei:p>Before <tei:choice>\r\n<!--keep--><?audit unchanged?><tei:sic xml:id="sic1" resp="#editor">A &amp; <tei:hi>ſ</tei:hi></tei:sic>\r\n</tei:choice> after</tei:p></tei:body></tei:text></tei:TEI>';
const choiceDoc = parseDocument(choiceRaw);
const choice = singleBranchChoices(choiceDoc)[0];
const repaired = keepSingleChoiceBranch(choiceDoc, choice);
check("repair removes only the outer attrless choice tags", repaired.raw === choiceRaw.replace("<tei:choice>", "").replace("</tei:choice>", ""));
check("the original child wrapper, attributes, entities, comments and PIs remain exact", repaired.raw.includes('<tei:sic xml:id="sic1" resp="#editor">A &amp; <tei:hi>ſ</tei:hi></tei:sic>')
  && repaired.raw.includes("<!--keep--><?audit unchanged?>"));
check("choice labels prefer a real child XML identity", choiceLabel(choice) === "sic1");
check("stale choice nodes cannot modify a different document", rejects(() => keepSingleChoiceBranch(parseDocument(choiceRaw), choice)));
for (const [label, content] of [
  ["identified outer wrapper", '<choice xml:id="c1"><sic>one</sic></choice>'],
  ["semantic outer wrapper", '<choice resp="#editor"><sic>one</sic></choice>'],
  ["namespace declaration on wrapper", '<choice xmlns:t="http://www.tei-c.org/ns/1.0"><t:sic>one</t:sic></choice>'],
  ["two alternatives", '<choice><sic>one</sic><corr>two</corr></choice>'],
  ["foreign child", '<choice><f:sic xmlns:f="urn:foreign">one</f:sic></choice>'],
  ["unknown child", '<choice><hi>one</hi></choice>'],
  ["additional source text", '<choice>before<sic>one</sic></choice>'],
  ["additional CDATA source text", '<choice><![CDATA[before]]><sic>one</sic></choice>'],
]) {
  const doc = documentWith(content);
  check(`unsafe repair is refused: ${label}`, rejects(() => keepSingleChoiceBranch(doc, firstTeiByLocal(doc.root, "choice"))));
}
const foreignChoice = documentWith('<f:choice xmlns:f="urn:foreign"><sic>one</sic></f:choice>');
check("foreign namespace lookalikes are absent from the repair inventory", singleBranchChoices(foreignChoice).length === 0);

section("Typed shared register references");
let registers = createWenzelsRegistersDocument();
for (const item of [
  { id: "Gott", kind: "person", name: "Gott" }, { id: "Adam", kind: "person", name: "Adam" },
  { id: "Paradiesgarten", kind: "place", name: "Paradiesgarten" }, { id: "Völker", kind: "people", name: "Völker" },
]) registers = createWenzelsRegisterEntry(registers, item);
function imageDocument(personPointer, placePointer = "registers.xml#Paradiesgarten") {
  return parseDocument(`<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><list type="image-annotations"><item xml:id="image"><title>Test</title><listPerson type="related"><person corresp="${personPointer}"/></listPerson><listPlace type="related"><place corresp="${placePointer}"/></listPlace></item></list></body></text></TEI>`);
}
check("valid person and place references resolve across the loaded register file", checkWenzelsRegisters({ registers, images: imageDocument("registers.xml#Gott") }).length === 0);
check("legacy local fragment references resolve against the attached shared register", checkWenzelsRegisters({ registers, images: imageDocument("#Gott", "#Paradiesgarten") }).length === 0);
check("every pointer in a TEI corresp token list is checked separately", checkWenzelsRegisters({ registers, images: imageDocument("#Gott #Adam") }).length === 0);
check("people cannot be silently used as persons", checkWenzelsRegisters({ registers, images: imageDocument("registers.xml#Völker") }).some((issue) => issue.includes("expected person")));
check("persons cannot be silently used as places", checkWenzelsRegisters({ registers, images: imageDocument("#Gott", "#Adam") }).some((issue) => issue.includes("expected place")));
check("an unattached register file is reported", checkWenzelsRegisters({ registers, images: imageDocument("other.xml#Gott") }).some((issue) => issue.includes("unattached")));
check("a missing register entry is reported", checkWenzelsRegisters({ registers, images: imageDocument("registers.xml#Missing") }).length > 0);
check("a related person without a pointer is reported", checkWenzelsRegisters({ registers, images: imageDocument("") }).length > 0);
const descriptivePlace = parseDocument(imageDocument("#Gott").raw.replace('<place corresp="registers.xml#Paradiesgarten"/>', '<place><desc>A landscape without an identified place.</desc></place>'));
check("a descriptive place without an asserted corresp is an intentional non-reference", checkWenzelsRegisters({ registers, images: descriptivePlace }).length === 0);
const missingTextTarget = parseDocument('<TEI xmlns="http://www.tei-c.org/ns/1.0"><standOff><spanGrp type="register-links"><span xml:id="missing" from="#w1" to="#w1" ana=""/></spanGrp></standOff><text><body><p><w xml:id="w1">Text</w></p></body></text></TEI>');
check("a text link with an empty target is reported", checkWenzelsRegisters({ registers, codex: missingTextTarget }).length > 0);
check("a bare name is not mistaken for an XML fragment pointer", checkWenzelsRegisters({ registers, images: imageDocument("Gott") }).length > 0);
const collision = parseDocument(registers.raw.replace("<persName>Gott</persName>", '<persName xml:id="Gott">Gott</persName>'));
check("a pointer to a globally duplicated ID is ambiguous even if only one is a register entry", checkWenzelsRegisters({ registers: collision, images: imageDocument("#Gott") }).length > 0);
const noIdentity = parseDocument(registers.raw.replace('xml:id="Gott"', ""));
check("an entry without an XML ID is reported independently of mentions", checkWenzelsRegisters({ registers: noIdentity }).length > 0);
check("deletion protection recognizes tokenized external and fragment references", referencesRegisterId(imageDocument("registers.xml#Gott #Adam"), "Gott", "registers.xml")
  && referencesRegisterId(imageDocument("registers.xml#Gott #Adam"), "Adam", "registers.xml"));
check("deletion protection does not confuse a longer identifier or another filename", !referencesRegisterId(imageDocument("registers.xml#Gottheit"), "Gott", "registers.xml")
  && !referencesRegisterId(imageDocument("other.xml#Gott"), "Gott", "registers.xml"));

section("ICONCLASS input normalization");
for (const [input, expected] of [
  [" 11C21 ", "11C21"], ["11H(ANTONY ABBOT)", "11H(ANTONY ABBOT)"],
  ["https://iconclass.org/11C21", "11C21"], ["https://www.iconclass.org/11C21.jsonld", "11C21"],
  ["https://iconclass.org/11H%28ANTONY%20ABBOT%29.json", "11H(ANTONY ABBOT)"],
]) check(`notation normalizes consistently: ${input}`, iconclassNotation(input) === expected);
for (const input of ["", "11C21\n11C22", "https://example.org/11C21", "https://iconclass.org/", "https://iconclass.org/.json", "https://iconclass.org/11C21%2Fbad", "https://iconclass.org/11C21%0Abad", "https://iconclass.org/11C21%3Fbad", "https://iconclass.org/%E0%A4%A"]) {
  check(`invalid notation or URL is refused: ${JSON.stringify(input)}`, rejects(() => iconclassNotation(input)));
}

section("Explicit Wenzelsbibel profile and schema ownership");
const ordinary = { id: "another-project", views: [{ key: "image-annotation" }] };
check("an image-annotation view alone does not identify Wenzelsbibel", !isWenzelsProject(ordinary) && withWenzelsDefaults(ordinary) === ordinary);
check("an unrelated project remains unchanged", withWenzelsDefaults({ id: "another" }).schema === undefined);
check("an explicit workspace declaration identifies Wenzelsbibel", !!isWenzelsProject({ workspace: "wenzelsbibel" }));
const identified = { id: "wenzelsbibel", name: "WB" };
const defaults = withWenzelsDefaults(identified);
check("default schema installation preserves the original project object", defaults !== identified && !identified.schema);
check("the default schema order is vocabulary then editorial checks", defaults.schema.schemas.length === 2
  && defaults.schema.schemas[0].type === "relaxng" && defaults.schema.schemas[1].type === "schematron"
  && defaults.schema.schemas[1].path === WENZELS_EDITORIAL_SCHEMA_URL);
check("default installation is idempotent", withWenzelsDefaults(defaults) === defaults);
const explicitSchema = { workspace: "wenzelsbibel", schema: { schemas: [{ type: "relaxng", path: "project.rng" }] }, localSchemas: { "project.rng": "Source" } };
check("explicit project schemas and local resources retain identity", withWenzelsDefaults(explicitSchema) === explicitSchema);

section("Document inventory cache and ordered distinct values");
const inventoryRaw = `<?xml-model href="schema.rng" schematypens="http://relaxng.org/ns/structure/1.0"?><TEI xmlns="http://www.tei-c.org/ns/1.0" xmlns:f="urn:foreign" type="original"><text><body><p><w xml:id="one" norm="β" facs="#z one.jpg">One</w><w norm="a"/><w norm="β"/><w norm=""/><w norm="&#97;"/><f:w norm="foreign"/><w f:norm="qualified"/><w norm="constructor"/><w norm="__proto__"/><w norm="toString"/></p></body></text></TEI>`;
const inventoryDoc = parseDocument(inventoryRaw);
const firstInventory = inventoryDocument(inventoryDoc);
check("the same immutable document reuses its inventory", inventoryDocument(inventoryDoc) === firstInventory);
check("ordered distinct values match first source occurrence after entity decoding", JSON.stringify(firstInventory.values("w", "norm")) === JSON.stringify(["β", "a", "", "constructor", "__proto__", "toString"]));
check("namespace lookalikes do not contribute values or counts", firstInventory.count("w") === 9 && !firstInventory.values("w", "norm").includes("foreign") && !firstInventory.values("w", "norm").includes("qualified"));
check("schema and facsimile inventories retain their contract", firstInventory.schemaRefs[0].href === "schema.rng"
  && firstInventory.facsimileRefs.internal === 1 && firstInventory.facsimileRefs.external === 1);
const firstWord = firstTeiByLocal(inventoryDoc.root, "w");
const changedDoc = editTextAndAttrs(inventoryDoc, firstWord, { set: { norm: "new" } });
const changedInventory = inventoryDocument(changedDoc);
check("new source revisions receive isolated caches", changedInventory !== firstInventory && changedInventory.values("w", "norm")[0] === "new"
  && firstInventory.values("w", "norm")[0] === "β" && inventoryDocument(inventoryDoc) === firstInventory);
const independent = inventoryDocument(parseDocument(inventoryRaw));
check("separate parsed documents never share mutable inventory containers", independent !== firstInventory
  && independent.attributeValues !== firstInventory.attributeValues && independent.values("w", "norm") !== firstInventory.values("w", "norm"));
check("inventory inspection preserves source bytes", inventoryDoc.raw === inventoryRaw);

section("Normalization with distinct original and transcription readings");
const readingDoc = documentWith('<w xml:id="word" orig="Original &amp; value" norm="Normalized">Source &#383;pell<span xmlns="urn:foreign">foreign</span>ing</w>');
const normalized = updateWenzelsWord(readingDoc, "word", { norm: "Changed &amp; value" });
check("normalization alone changes exactly its original attribute value", normalized.raw === readingDoc.raw.replace('norm="Normalized"', 'norm="Changed &amp;amp; value"'));
check("the diplomatic attribute and source text retain their independent values", readWenzelsWords(normalized)[0].dipl === "Original & value"
  && readWenzelsWords(normalized)[0].text === "Source ſpellforeigning" && getXmlId(firstTeiByLocal(normalized.root, "w")) === "word");
check("reopening a normalization edit preserves exact lexical bytes", parseDocument(normalized.raw).raw === normalized.raw);
check("the unchanged normalized reading is an identity-preserving no-op", updateWenzelsWord(normalized, "word", { norm: "Changed &amp; value" }) === normalized);

finish("wenzels_project_controls_check passed");
