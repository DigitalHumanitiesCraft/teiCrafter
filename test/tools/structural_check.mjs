// Headless proof for the Author-mode structural primitives (structural.js).
// Run: node test/tools/structural_check.mjs
import assert from "node:assert";
import { parseDocument, walk, getAttr } from "../../docs/js/editor/tei-document.js";
import { splitElement, mergeElements, insertLb, deleteElement } from "../../docs/js/editor/structural.js";

const find = (doc, local) => {
  const hits = [];
  walk(doc.root, (n) => { if (n.type === "element" && n.localName === local) hits.push(n); });
  return hits;
};
const content = (doc, el) => doc.raw.slice(el.contentStart, el.contentEnd);

let n = 0;
const ok = (msg) => { n++; console.log("  ok -", msg); };

// 1. split an <l xml:id> at the caret -> two <l>, ids preserved/regenerated.
{
  const raw = `<TEI><text><body>\n        <l xml:id="l1">foo bar</l>\n      </body></text></TEI>`;
  const doc = parseDocument(raw);
  const l = find(doc, "l")[0];
  const d2 = splitElement(doc, l, l.contentStart + 3); // caret after "foo"
  const ls = find(d2, "l");
  assert.equal(ls.length, 2, "two <l> after split");
  assert.equal(content(d2, ls[0]), "foo");
  assert.equal(content(d2, ls[1]), " bar");
  assert.equal(getAttr(ls[0], "id"), "l1", "first keeps its id");
  assert.equal(getAttr(ls[1], "id"), "l1_2", "second gets a fresh unique id");
  ok("split <l> at caret: two same-name siblings, ids preserved + regenerated");

  // merge them back -> byte-identical to the original (the inserted bytes removed).
  const d3 = mergeElements(d2, ls[0], ls[1]);
  assert.equal(d3.raw, raw, "merge(split) reproduces the original byte-for-byte");
  ok("merge(split) round-trips byte-identical");
}

// 2. split an <l> WITHOUT xml:id -> the new sibling has no id (none invented).
{
  const raw = `<body><l>alpha beta</l></body>`;
  const doc = parseDocument(raw);
  const l = find(doc, "l")[0];
  const d2 = splitElement(doc, l, l.contentStart + 5); // after "alpha"
  const ls = find(d2, "l");
  assert.equal(ls.length, 2);
  assert.equal(getAttr(ls[1], "id"), null, "no id invented for a sibling whose source had none");
  ok("split a no-id <l>: no id is invented");
}

// 3. split is a no-op when the caret is outside the element content.
{
  const raw = `<body><l>x</l></body>`;
  const doc = parseDocument(raw);
  const l = find(doc, "l")[0];
  assert.equal(splitElement(doc, l, l.outerStart), doc, "caret before content -> SAME doc");
  ok("split outside content is a no-op (SAME doc)");
}

// 4. insert <lb/> at a caret offset inside a <p>.
{
  const raw = `<body><p>one two</p></body>`;
  const doc = parseDocument(raw);
  const p = find(doc, "p")[0];
  const at = p.contentStart + 3; // after "one"
  const d2 = insertLb(doc, at);
  assert.equal(d2.raw, `<body><p>one<lb/> two</p></body>`, "<lb/> inserted at the caret");
  assert.equal(find(d2, "lb").length, 1);
  ok("insertLb places <lb/> at the raw caret");
}

// 4a. insertLb into a default-namespace TEI doc yields <lb/> (unprefixed).
{
  const raw = `<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p>one two</p></body></text></TEI>`;
  const doc = parseDocument(raw);
  const p = find(doc, "p")[0];
  const at = p.contentStart + 3; // after "one"
  const d2 = insertLb(doc, at);
  assert.equal(d2.raw, raw.replace("one two", "one<lb/> two"), "default-namespace doc gets <lb/>");
  assert.equal(find(d2, "lb")[0].prefix, null, "inserted lb is unprefixed");
  // re-parses byte-identically except for the inserted milestone.
  assert.equal(d2.raw.replace("<lb/>", ""), raw, "only the milestone bytes were added");
  ok("insertLb in a default-namespace doc yields <lb/>");
}

// 4b. insertLb into a tei:-prefixed doc yields <tei:lb/> (prefix derived from the host).
{
  const raw = `<tei:TEI xmlns:tei="http://www.tei-c.org/ns/1.0"><tei:text><tei:body><tei:p>one two</tei:p></tei:body></tei:text></tei:TEI>`;
  const doc = parseDocument(raw);
  const p = find(doc, "p")[0];
  const at = p.contentStart + 3; // after "one"
  const d2 = insertLb(doc, at);
  assert.equal(d2.raw, raw.replace("one two", "one<tei:lb/> two"), "tei:-prefixed doc gets <tei:lb/>");
  const lb = find(d2, "lb")[0];
  assert.equal(lb.prefix, "tei", "inserted lb carries the tei: prefix");
  assert.equal(lb.qname, "tei:lb", "inserted lb qname is tei:lb");
  assert.equal(d2.raw.replace("<tei:lb/>", ""), raw, "only the milestone bytes were added");
  ok("insertLb in a tei:-prefixed doc yields <tei:lb/>");
}

// 4c. an existing lb form is reused verbatim, even when its prefix differs from
//     the enclosing element (the document's own convention wins over derivation).
{
  const raw = `<x:body xmlns:x="ns"><x:p>a<tei:lb/>b<x:p>c d</x:p></x:p></x:body>`;
  const doc = parseDocument(raw);
  // insert inside the x:-prefixed second <p>; the existing milestone is <tei:lb/>.
  const ps = find(doc, "p");
  const inner = ps[ps.length - 1];
  const at = inner.contentStart + 1; // after "c"
  const d2 = insertLb(doc, at);
  assert.equal(d2.raw, raw.replace("c d", "c<tei:lb/> d"), "existing <tei:lb/> form reused verbatim");
  assert.equal(find(d2, "lb").length, 2, "now two lb milestones, both <tei:lb/>");
  ok("insertLb reuses an existing lb form verbatim (over enclosing-element derivation)");
}

// 4d. an existing lb's exact spacing/slash convention is reproduced (<lb />).
{
  const raw = `<body><p>one two</p><p>x<lb /></p></body>`;
  const doc = parseDocument(raw);
  const p = find(doc, "p")[0];
  const at = p.contentStart + 3; // after "one"
  const d2 = insertLb(doc, at);
  assert.equal(d2.raw, `<body><p>one<lb /> two</p><p>x<lb /></p></body>`, "spacing convention of the existing lb reused");
  ok("insertLb reproduces an existing lb's spacing/slash convention");
}

// 5. deleteElement removes an empty milestone, refuses a non-empty element.
{
  const raw = `<body><p>a<lb/>b</p></body>`;
  const doc = parseDocument(raw);
  const lb = find(doc, "lb")[0];
  const d2 = deleteElement(doc, lb);
  assert.equal(d2.raw, `<body><p>ab</p></body>`, "empty <lb/> deleted losslessly");
  const p = find(doc, "p")[0];
  assert.equal(deleteElement(doc, p), doc, "non-empty <p> refused without force (SAME doc)");
  ok("deleteElement removes empty, refuses non-empty");
}

console.log(`\nstructural.js: ${n} checks passed`);
