/**
 * Proof: standOff mutations are confined to the TEI-level register, expand an
 * empty-element register atomically, and preserve a document's TEI prefix.
 *
 * Run: node test/proofs/standoff_scope_check.mjs
 */

import { parseEdition } from "../../docs/js/editor/edition.js";
import { parseDocument } from "../../docs/js/editor/tei-document.js";
import {
  addEntity,
  addNote,
  deleteEntity,
  linkMention,
  noteDetailIndex,
  noteIndex,
  readEntities,
  retypeEntity,
  setAuthority,
  updateEntity,
} from "../../docs/js/editor/standoff.js";
import { check, finish, section } from "./_assert.mjs";

const RAW = `<?xml version="1.0"?>
<tei:TEI xmlns:tei="http://www.tei-c.org/ns/1.0">
  <tei:teiHeader>
    <tei:fileDesc>
      <tei:titleStmt><tei:title>Scope fixture</tei:title></tei:titleStmt>
      <tei:sourceDesc>
        <tei:listPerson><tei:person xml:id="header-person"><tei:persName>Header Person</tei:persName></tei:person></tei:listPerson>
        <tei:standOff><tei:listOrg><tei:org xml:id="header-org"><tei:orgName>Header Org</tei:orgName></tei:org></tei:listOrg></tei:standOff>
        <tei:note target="#w1">Header note</tei:note>
      </tei:sourceDesc>
    </tei:fileDesc>
  </tei:teiHeader>
  <tei:standOff/>
  <tei:text><tei:body><tei:p><tei:w xml:id="w1">Ada</tei:w></tei:p></tei:body></tei:text>
</tei:TEI>`;

section("top-level standOff scope and prefix fidelity");

const original = parseDocument(RAW);
const empty = readEntities(original);
check("header entities and nested standOff entities are not register entries",
  empty.persons.length === 0 && empty.orgs.length === 0);
check("updating a header entity is a SAME-doc no-op", updateEntity(original, "header-person", { name: "Changed" }) === original);
check("deleting a nested-header entity is a SAME-doc no-op", deleteEntity(original, "header-org") === original);

let doc = addEntity(original, "person", { id: "person-ada", name: "Ada" });
check("self-closing top-level standOff expands before its child is inserted",
  /<tei:standOff>\s*<tei:listPerson>[\s\S]*<\/tei:listPerson>\s*<\/tei:standOff>/.test(doc.raw));
check("the original self-closing standOff is gone and the nested header standOff is untouched",
  !doc.raw.includes("  <tei:standOff/>\n  <tei:text>")
    && doc.raw.includes('<tei:standOff><tei:listOrg><tei:org xml:id="header-org">'));
check("new register scaffolding preserves the TEI prefix",
  doc.raw.includes('<tei:person xml:id="person-ada"><tei:persName>Ada</tei:persName></tei:person>'));

doc = setAuthority(doc, "person-ada", "GND", "123456789");
check("new authority markup preserves the TEI prefix",
  doc.raw.includes('<tei:idno type="GND">123456789</tei:idno>'));

const state = parseEdition(doc.raw);
const cell = state.cellById.get("w1");
doc = linkMention(doc, cell.node, "person-ada");
check("new mention markup preserves the TEI prefix",
  doc.raw.includes('<tei:w xml:id="w1"><tei:name ref="#person-ada">Ada</tei:name></tei:w>'));

doc = addNote(doc, "w1", "First note");
doc = addNote(doc, "w1", "Second note", { resp: "#ai" });
check("new notes are prefixed and inserted into the top-level standOff",
  doc.raw.includes('<tei:note target="#w1">First note</tei:note>')
    && doc.raw.includes('<tei:note target="#w1" resp="#ai">Second note</tei:note>'));
check("noteIndex preserves multiple target notes as a source-ordered array",
  JSON.stringify(noteIndex(doc).get("w1")) === JSON.stringify(["First note", "Second note"]));
check("header notes are excluded and detail arrays retain both standOff notes",
  noteDetailIndex(doc).get("w1").length === 2
    && noteDetailIndex(doc).get("w1")[1].resp === "#ai");

doc = retypeEntity(doc, "person-ada", "org");
check("retyping keeps prefixed entity and label qualified names",
  doc.raw.includes('<tei:org xml:id="person-ada"><tei:orgName>Ada</tei:orgName><tei:idno'));
check("the retyped entity remains the only mutable register entity",
  readEntities(doc).orgs.length === 1 && readEntities(doc).persons.length === 0);
check("the final XML re-parses without a stray standOff child", parseDocument(doc.raw).serialize() === doc.raw);

finish("PASS: standOff scope, empty-element expansion, note multiplicity, and TEI prefix fidelity are enforced.");
