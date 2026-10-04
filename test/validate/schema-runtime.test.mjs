import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { importTs } from "./load-ts.mjs";

const { TEI_ALL, WELL_FORMEDNESS_LABEL, createSchemaRuntime } = await importTs("src/validate/schema-runtime.ts");

const publicRoot = new URL("../../public/", import.meta.url);
const fetches = [];
const runtime = createSchemaRuntime({
  loadLibxml: () => import(new URL("vendor/libxml2-wasm/lib/index.mjs", publicRoot).href),
  fetchText: (url) => {
    fetches.push(url);
    return readFile(new URL(url, publicRoot), "utf8");
  },
});
const sample = await readFile(new URL("samples/o_szd.1079.tei.xml", publicRoot), "utf8");

function lineOf(text, needle) {
  assert.ok(text.includes(needle));
  return text.slice(0, text.indexOf(needle)).split("\n").length;
}

const tinyXsd = `<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:element name="root"><xs:complexType><xs:sequence>
    <xs:element name="item" type="xs:string" maxOccurs="unbounded"/>
  </xs:sequence></xs:complexType></xs:element>
</xs:schema>`;

test("the SZD sample is valid against TEI All", async () => {
  const started = performance.now();
  const diagnostics = await runtime.validate(sample, [TEI_ALL]);
  console.log(`TEI All, first validation including compile: ${Math.round(performance.now() - started)} ms`);
  assert.deepEqual(diagnostics, []);
});

test("a second validation reuses the compiled TEI All", async () => {
  assert.deepEqual(await runtime.validate(sample, [TEI_ALL]), []);
  assert.equal(fetches.length, 1);
});

test("an unknown element yields one error on its line", async () => {
  const broken = sample.replace("<langUsage>", "<notTei/><langUsage>");
  const diagnostics = await runtime.validate(broken, [TEI_ALL]);
  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].line, lineOf(broken, "<notTei/>"));
  assert.match(diagnostics[0].message, /notTei/);
  assert.equal(diagnostics[0].severity, "error");
  assert.equal(diagnostics[0].schema, TEI_ALL.label);
});

test("a declared non-UTF-8 encoding does not re-decode the string", async () => {
  const xsd = {
    kind: "xsd",
    label: "enum.xsd",
    text: `<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"><xs:element name="root"><xs:simpleType>
      <xs:restriction base="xs:string"><xs:enumeration value="Böhmen"/></xs:restriction>
    </xs:simpleType></xs:element></xs:schema>`,
  };
  const declared = '<?xml version="1.0" encoding="ISO-8859-1"?><root>Böhmen</root>';
  assert.deepEqual(await runtime.validate(declared, [xsd]), []);
});

test("a document that is not well-formed reports parser errors once with positions", async () => {
  const broken = sample.replace("</titleStmt>", "</titleStmtX>");
  const diagnostics = await runtime.validate(broken, [TEI_ALL, { kind: "xsd", text: tinyXsd, label: "tiny.xsd" }]);
  assert.ok(diagnostics.length >= 1);
  assert.ok(diagnostics.every((item) => item.schema === WELL_FORMEDNESS_LABEL));
  assert.equal(diagnostics[0].line, lineOf(broken, "</titleStmtX>"));
});

test("XSD validation from text reports with positions", async () => {
  const xsd = { kind: "xsd", text: tinyXsd, label: "tiny.xsd" };
  assert.deepEqual(await runtime.validate("<root><item/></root>", [xsd]), []);
  const diagnostics = await runtime.validate("<root>\n<item/>\n<other/>\n</root>", [xsd]);
  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].line, 3);
  assert.equal(diagnostics[0].schema, "tiny.xsd");
});

test("unusable schemas yield one line-0 error each, in schema order", async () => {
  const diagnostics = await runtime.validate(sample, [
    { kind: "sch", text: "<schema/>", label: "rules.sch" },
    { kind: "rng", text: "<notAGrammar/>", label: "broken.rng" },
    TEI_ALL,
  ]);
  assert.deepEqual(diagnostics.map((item) => [item.schema, item.line]), [["rules.sch", 0], ["broken.rng", 0]]);
  assert.match(diagnostics[0].message, /Schematron is not supported/);
});

test("no schemas means no diagnostics", async () => {
  assert.deepEqual(await runtime.validate(sample, []), []);
});
