import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { teiFromPlaintext } from "../../src/core/plaintext-to-tei.js";
import { decodeEntities, parseDocument, walk } from "../../src/core/tei-document.js";

const SAMPLE = readFileSync(new URL("../../public/samples/brief-benndorf-1879.txt", import.meta.url), "utf8");

/** Every non-empty element must have its end tag; the lenient parser would otherwise hide a gap. */
function unclosedElements(raw) {
  const open = [];
  walk(parseDocument(raw).root, (node) => {
    if (node.type === "element" && !node.selfClosing && node.etagEnd == null) open.push(node.qname);
  });
  return open;
}

function bodyText(raw) {
  const doc = parseDocument(raw);
  let body = null;
  walk(doc.root, (node) => { if (node.localName === "body") body = node; });
  assert.ok(body, "the draft has a body");
  let text = "";
  walk(body, (node) => { if (node.type === "text") text += decodeEntities(raw.slice(node.start, node.end)); });
  return text;
}

test("the sample letter drafts to closed, well-nested TEI", () => {
  const raw = teiFromPlaintext(SAMPLE, "brief-benndorf-1879");
  assert.deepEqual(unclosedElements(raw), []);
  const paras = raw.match(/<p>/g) ?? [];
  const closes = raw.match(/<\/p>/g) ?? [];
  assert.ok(paras.length > 1);
  assert.equal(paras.length, closes.length);
});

test("the sample text is carried verbatim apart from markers and line layout", () => {
  const raw = teiFromPlaintext(SAMPLE, "brief-benndorf-1879");
  const expected = SAMPLE.replace(/\|\d+\|/g, "").replace(/\s+/g, "");
  assert.equal(bodyText(raw).replace(/\s+/g, ""), expected);
});

test("the draft is deterministic", () => {
  assert.equal(teiFromPlaintext(SAMPLE, "t"), teiFromPlaintext(SAMPLE, "t"));
});

test("a |N| marker becomes a page break and borders lose one space", () => {
  const raw = teiFromPlaintext("first line\nend of page |2| next page\n\nnew paragraph", "t");
  assert.ok(raw.includes('      <pb n="1"/>\n'));
  assert.ok(raw.includes('<p>first line\n          <lb/>end of page<pb n="2"/><lb/>next page</p>'));
  assert.ok(raw.includes("<p>new paragraph</p>"));
});

test("text that only resembles a marker stays verbatim and escaped", () => {
  const raw = teiFromPlaintext("a |x| b & <c>", "t");
  assert.ok(raw.includes("<p>a |x| b &amp; &lt;c&gt;</p>"));
});

test("page images bind to page breaks by position", () => {
  const raw = teiFromPlaintext("one |2| two", "t", { images: [{ name: "a.jpg" }, { name: "b.jpg" }, { name: "c.jpg" }] });
  assert.ok(raw.includes('<pb n="1" facs="#surface_1"/>'));
  assert.ok(raw.includes('<pb n="2" facs="#surface_2"/>'));
  assert.ok(raw.includes('<surface xml:id="surface_2"><graphic url="b.jpg"/></surface>'));
  assert.ok(!raw.includes("c.jpg"));
});
