import assert from "node:assert/strict";
import { parseDocument } from "../../docs/js/editor/tei-document.js";
import { readWenzelsRegisters, removeWenzelsRegisterEntry } from "../../docs/js/editor/wenzels-register-model.js";
import { referencesRegisterId, referencesRegisterSubtree } from "../../docs/js/editor/wenzels-project-checks.js";

const entry = '<org xml:id="people-1" type="people"><orgName xml:id="people-name">Synthetic people</orgName><note><foreign:detail xmlns:foreign="urn:test" xml:id="deep-identity">Retained source</foreign:detail></note></org>';
const spare = '<org xml:id="spare" type="people"><orgName>Unreferenced people</orgName></org>';
const raw = `<TEI xmlns="http://www.tei-c.org/ns/1.0"><standOff><listOrg type="peoples">${entry}${spare}</listOrg></standOff><text><body><p/></body></text></TEI>`;
const registers = parseDocument(raw);
const selected = readWenzelsRegisters(registers)[0];
const companion = (target) => parseDocument(`<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p><ref target="${target}">Synthetic reference</ref></p></body></text></TEI>`);

for (const target of ["#people-1", "registers.xml#people-1", "#people%2Dname", "registers.xml#people%2Dname", "other.xml#unrelated registers.xml#deep%2Didentity", "#deep-identity"]) {
  const linked = companion(target);
  assert.equal(referencesRegisterSubtree(linked, selected.node, "registers.xml"), true, target);
  assert.equal(linked.raw, companion(target).raw);
  assert.equal(registers.raw, raw);
}
for (const target of ["other.xml#people-name", "registers.xml#people-name-extra", "registers.xml#absent", "people-name", "registers.xml#people%ZZname", "#spare"]) {
  assert.equal(referencesRegisterSubtree(companion(target), selected.node, "registers.xml"), false, target);
}
assert.equal(referencesRegisterId(companion("registers.xml#people%2Dname"), "people-name", "registers.xml"), true);
assert.equal(referencesRegisterId(companion("other.xml#people%2Dname"), "people-name", "registers.xml"), false);
const withoutParentId = parseDocument(raw.replace(' xml:id="people-1"', ""));
assert.equal(referencesRegisterSubtree(companion("registers.xml#people-name"), readWenzelsRegisters(withoutParentId)[0].node, "registers.xml"), true);
const linked = companion("registers.xml#people%2Dname");
const removable = readWenzelsRegisters(registers)[1];
assert.equal(referencesRegisterSubtree(linked, removable.node, "registers.xml"), false);
assert.equal(removeWenzelsRegisterEntry(registers, removable).raw, raw.replace(spare, ""));
assert.equal(registers.raw, raw);
console.log("wenzels_register_deletion_check passed: complete subtree identities, encoded fragments, exact file scope and source preservation");
