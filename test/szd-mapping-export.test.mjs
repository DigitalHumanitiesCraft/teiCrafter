import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { buildTei, validateDecisions, MAPPING_ROLES } from "../docs/js/szd-mapping-export.js";
import { validateWithSchemas } from "../docs/js/editor/schema-validation.js";

const page = { id: "o:szd.1/1", objectId: "o:szd.1", pageNumber: 1, sourceHash: "sha256:abc", text: ' Wien & <Ort>\r\nLieber 😀 Stefan\n ' };
const span = (start, end) => ({ status: "present", start, end, value: page.text.slice(start, end), origin: "manual", reviewed: true });
const decode = (xml) => xml.replace(/&#13;/g, "\r").replace(/&quot;/g, '"').replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&amp;/g, "&");

test("preserves complete source text and overlapping role spans", () => {
  const xml = buildTei(page, { "structure.dateline": span(1, 13), "metadata.place": span(1, 5) });
  const body = xml.match(/<ab xml:space="preserve">([\s\S]*?)<\/ab>/)[1];
  assert.equal(decode(body.replace(/<anchor[^>]*\/>/g, "")), page.text);
  assert.equal((body.match(/xml:id="offset-1"/g) || []).length, 1);
  assert.match(xml, /spanGrp type="structure.dateline"/);
  assert.match(xml, /from="#offset-1" to="#offset-5"/);
  assert.match(xml, /&amp; &lt;Ort&gt;/);
  assert.match(xml, /source-hash">sha256:abc/);
});

test("absent and unresolved decisions retain evidence without invented spans", () => {
  const xml = buildTei(page, {
    "metadata.sender": { status: "absent", origin: "manual", reviewed: true },
    "metadata.date": { status: "unresolved", origin: "rules", reviewed: false },
    doc_type: "letter",
  });
  assert.doesNotMatch(xml, /<spanGrp|<anchor|<opener|<closer/);
  assert.match(xml, /&quot;status&quot;:&quot;absent&quot;/);
  assert.match(xml, /Unreviewed local draft/);
});

test("rejects empty, out-of-range, mismatched, and split-surrogate spans", () => {
  const emoji = page.text.indexOf("😀");
  for (const decision of [span(1, 1), span(-1, 4), span(0, 999), span(emoji, emoji + 1), { ...span(1, 5), value: "wrong" }]) {
    assert.ok(validateDecisions(page, { "metadata.place": decision }).length);
    assert.throws(() => buildTei(page, { "metadata.place": decision }));
  }
  assert.deepEqual(validateDecisions(page, { "metadata.place": span(emoji, emoji + 2) }), []);
});

test("rejects illegal XML text and missing provenance", () => {
  assert.ok(validateDecisions({ ...page, text: "x\u0000" }, {}).length);
  assert.ok(validateDecisions(page, { "metadata.place": { ...span(1, 5), origin: undefined } }).length);
});

test("absent and unresolved decisions reject contradictory span evidence", () => {
  for (const status of ["absent", "unresolved"]) {
    const decision = { status, origin: "manual", reviewed: false };
    for (const evidence of [{ start: 0 }, { end: 1 }, { value: "Wien" }, { value: false }]) {
      const decisions = { "metadata.place": { ...decision, ...evidence } };
      assert.ok(validateDecisions(page, decisions).length);
      assert.throws(() => buildTei(page, decisions));
    }
    assert.deepEqual(validateDecisions(page, { "metadata.place": decision }), []);
    assert.deepEqual(validateDecisions(page, {
      "metadata.place": { ...decision, start: null, end: null, value: "" },
    }), []);
  }
});

test("document classification accepts only nonempty XML-compatible strings", () => {
  for (const doc_type of [null, false, {}, [], "", "  ", "letter\u0000"]) {
    assert.ok(validateDecisions(page, { doc_type }).length);
    assert.throws(() => buildTei(page, { doc_type }));
  }
  assert.deepEqual(validateDecisions(page, { doc_type: "letter" }), []);
});

test("drafts with overlapping and empty mappings validate against bundled TEI All", async () => {
  const schema = { name: "TEI All", type: "relaxng", text: readFileSync(new URL("../docs/schemas/tei-p5-4.11.0/tei_all.rng", import.meta.url), "utf8") };
  for (const decisions of [{ "structure.dateline": span(1, 13), "metadata.place": span(1, 5) }, {}]) {
    const results = await validateWithSchemas(buildTei(page, decisions), [schema]);
    assert.equal(results[0].status, "valid", JSON.stringify(results[0].diagnostics));
  }
});

test("local facsimile paths are explicit and reject external or traversing references", () => {
  const image = "data/editor/szd-mapping-local/o_szd.1717-p1.jpg";
  const xml = buildTei({ ...page, image }, {});
  assert.ok(xml.includes(`<graphic url="${image}"/>`));
  assert.match(xml, /<pb n="1" facs="#page-surface"\/>/);
  for (const unsafe of ["https://example.org/scan.jpg", "../scan.jpg", "data/editor/szd-mapping-local/../scan.jpg", "data/editor/szd-mapping-local/%2e%2e.jpg", "data/editor/szd-mapping-local/a.jpg?x=1"]) {
    assert.ok(validateDecisions({ ...page, image: unsafe }, {}).length);
  }
});

const fixtureUrl = new URL("../docs/data/editor/szd-mapping-local/dataset.json", import.meta.url);
test("all available local source pages retain their text and validate with their scans", { skip: !existsSync(fixtureUrl) }, async () => {
  const dataset = JSON.parse(readFileSync(fixtureUrl, "utf8"));
  assert.ok(dataset.pages.length);
  const schema = { name: "TEI All", type: "relaxng", text: readFileSync(new URL("../docs/schemas/tei-p5-4.11.0/tei_all.rng", import.meta.url), "utf8") };
  for (const source of dataset.pages) {
    const sourcePage = { ...source, image: `data/editor/szd-mapping-local/${source.image}` };
    assert.ok(existsSync(new URL(`../docs/${sourcePage.image}`, import.meta.url)));
    for (const origin of ["rules", "jev"]) {
      const decisions = Object.fromEntries(source.fields.filter((field) => MAPPING_ROLES.includes(field.id))
        .map((field) => [field.id, { ...field[origin], reviewed: false }]));
      const xml = buildTei(sourcePage, decisions);
      assert.equal(decode(xml.match(/<ab xml:space="preserve">([\s\S]*?)<\/ab>/)[1].replace(/<anchor[^>]*\/>/g, "")), source.text);
      const results = await validateWithSchemas(xml, [schema]);
      assert.equal(results[0].status, "valid", `${source.id} ${origin}: ${JSON.stringify(results[0].diagnostics)}`);
    }
  }
});
