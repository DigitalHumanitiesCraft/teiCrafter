import {
  XML_NAMESPACE,
  TEI_NAMESPACE,
  elementsByLocal,
  getAttrObjInNamespace,
  isTeiElement,
  parseDocument,
  readSurfaces,
  resolveQName,
  teiElementsByLocal,
} from "../../docs/js/editor/tei-document.js";
import { countTags, parseEdition } from "../../docs/js/editor/edition.js";
import { addEntity, readEntities, updateEntity } from "../../docs/js/editor/standoff.js";
import { fromInlineGND, inlineGndCapabilityReport, toInlineGND } from "../../docs/js/editor/inline-gnd.js";

let checks = 0;
function check(label, condition) {
  if (!condition) throw new Error(`FAIL: ${label}`);
  checks += 1;
  console.log(`  ok   ${label}`);
}

console.log("expanded names and namespace shadowing");
const DEFAULT = `<?xml version="1.0"?>
<TEI xmlns="${TEI_NAMESPACE}" xmlns:x="urn:foreign">
  <teiHeader><fileDesc><titleStmt><title>T</title></titleStmt></fileDesc></teiHeader>
  <standOff><listPerson>
    <person x:id="trap" xml:id="real"><persName>TEI label</persName><x:persName>foreign label</x:persName></person>
    <x:person xml:id="foreign"><x:persName>foreign entity</x:persName></x:person>
  </listPerson></standOff>
  <facsimile><surface xml:id="s1"><graphic url="one.jpg"/><x:zone xml:id="foreign-zone"/></surface><x:surface xml:id="foreign-surface"/></facsimile>
  <text><body><p xml:id="p1"><name x:ref="#wrong" ref="#real">John</name><x:name ref="#real">Foreign</x:name><pb n="1"/><x:pb n="99"/></p>
    <foreign xmlns="urn:foreign"><w xml:id="shadow-word">shadow</w><pb/></foreign>
  </body></text>
</TEI>`;
const defaultDoc = parseDocument(DEFAULT);
const root = defaultDoc.root.children.find((node) => node.type === "element");
check("default TEI namespace resolves on the document element", root.namespaceURI === TEI_NAMESPACE && root.expandedName === `{${TEI_NAMESPACE}}TEI`);
check("default element QNames resolve through the in-scope binding", resolveQName(root, "body").namespaceURI === TEI_NAMESPACE);
check("prefixed QNames resolve to their declared foreign URI", resolveQName(root, "x:body").expandedName === "{urn:foreign}body");
check("unqualified attribute QNames do not inherit the default namespace", resolveQName(root, "ref", { attribute: true }).namespaceURI === null);
const real = teiElementsByLocal(defaultDoc.root, "person")[0];
check("xml:id resolves by the XML URI even when a foreign id precedes it", getAttrObjInNamespace(real, XML_NAMESPACE, "id")?.value === "real");
check("byte-identical no-op serialization survives namespace resolution", defaultDoc.serialize() === DEFAULT);
check("generic local-name navigation still exposes both namespaces", elementsByLocal(defaultDoc.root, "person").length === 2);
check("TEI navigation excludes the same local name in a foreign namespace", teiElementsByLocal(defaultDoc.root, "person").length === 1);
const shadowWord = elementsByLocal(defaultDoc.root, "w")[0];
check("a default-namespace shadow is not recognized as TEI", shadowWord.namespaceURI === "urn:foreign" && !isTeiElement(shadowWord));

console.log("namespace-aware TEI projections and mutations");
const entities = readEntities(defaultDoc);
check("the register reads only the TEI person and the XML id", entities.persons.length === 1 && entities.persons[0].id === "real");
check("a foreign same-named entity cannot be updated", updateEntity(defaultDoc, "foreign", { name: "changed" }) === defaultDoc);
const updated = updateEntity(defaultDoc, "real", { name: "changed" });
check("the TEI entity label is updated", updated.raw.includes("<persName>changed</persName>"));
check("a foreign same-named label stays byte-identical", updated.raw.includes("<x:persName>foreign label</x:persName>"));
const surfaces = readSurfaces(defaultDoc);
check("facsimile projection excludes foreign surfaces and zones", surfaces.surfaces.length === 1 && surfaces.surfaces[0].zones.length === 0);
const edition = parseEdition(DEFAULT);
check("foreign page breaks do not segment the edition", edition.folios.length === 2 && edition.folios[1].n === "1");
check("only the unqualified TEI @ref becomes a mention", edition.cells.some((cell) => cell.text === "John" && cell.mention === "real"));
check("foreign same-named wrappers do not become mentions", edition.cells.some((cell) => cell.text === "Foreign" && cell.mention == null));
const counts = countTags(DEFAULT);
check("TEI counts ignore foreign and shadowed equal local names", counts.pb === 1 && counts.w === 0 && counts.surface === 1);

console.log("arbitrary TEI prefixes and prefix-faithful insertion");
for (const prefix of ["tei", "t"]) {
  const source = `<${prefix}:TEI xmlns:${prefix}="${TEI_NAMESPACE}"><${prefix}:teiHeader><${prefix}:fileDesc><${prefix}:titleStmt><${prefix}:title>T</${prefix}:title></${prefix}:titleStmt></${prefix}:fileDesc></${prefix}:teiHeader><${prefix}:text><${prefix}:body><${prefix}:p>x</${prefix}:p></${prefix}:body></${prefix}:text></${prefix}:TEI>`;
  const doc = parseDocument(source);
  check(`${prefix}: root resolves to the TEI URI`, isTeiElement(doc.root.children[0], "TEI"));
  check(`${prefix}: no-op serialization is byte-identical`, doc.serialize() === source);
  const added = addEntity(doc, "person", { id: `${prefix}-person`, name: "Ada" });
  check(`${prefix}: standOff insertion preserves the active prefix`, added.raw.includes(`<${prefix}:standOff>`) && added.raw.includes(`<${prefix}:person xml:id="${prefix}-person">`));
}

console.log("alternative-prefix inline-GND fixed point");
const ALT = `<t:TEI xmlns:t="${TEI_NAMESPACE}">
  <t:teiHeader><t:fileDesc><t:titleStmt><t:title>T</t:title></t:titleStmt></t:fileDesc></t:teiHeader>
  <t:standOff><t:listPerson><t:person xml:id="p1"><t:persName>Ada</t:persName><t:idno type="GND">118646214</t:idno></t:person></t:listPerson></t:standOff>
  <t:text><t:body><t:p><t:name ref="#p1">Ada</t:name></t:p></t:body></t:text>
</t:TEI>`;
const altDoc = parseDocument(ALT);
check("alternative-prefix register passes capability analysis", inlineGndCapabilityReport(altDoc).ok);
const inline = toInlineGND(altDoc);
check("inline projection retains the alternative TEI prefix", inline.raw.includes('<t:persName ref="GND:118646214">Ada</t:persName>'));
check("reopen and re-export is byte-identical", toInlineGND(fromInlineGND(inline)).raw === inline.raw);

console.log(`\nPASS: ${checks} namespace resolution, shadowing, mutation, and prefix-fidelity checks passed.`);
