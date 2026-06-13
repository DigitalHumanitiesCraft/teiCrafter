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
