import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseDocument } from "../../src/core/tei-document.js";
import { applyProposal } from "../../src/core/proposal.js";
import { FIXTURE_ORIGIN, findProposal } from "../../src/core/proposal-fixture.js";

const sample = (name) => readFileSync(new URL(`../../public/samples/${name}`, import.meta.url), "utf8");

test("the fixture proposes persName for a generic name pointing into listPerson", () => {
  const doc = parseDocument(sample("zbz-hersch-synthetic.xml"));
  const p = findProposal(doc);
  assert.equal(p.replacement, '<persName ref="#pers_vautier">Marguerite Vautier</persName>');
  assert.equal(p.origin, FIXTURE_ORIGIN);
  const next = applyProposal(doc, p).raw;
  assert.equal(next, doc.raw.slice(0, p.from) + p.replacement + doc.raw.slice(p.to));
  assert.ok(!next.includes('<name ref="#pers_vautier">'));
});

test("the fixture proposes nothing without a listPerson candidate", () => {
  assert.equal(findProposal(parseDocument(sample("wenzelsbibel-synthetic-codex.xml"))), null);
});

test("a proposal outside the document is rejected", () => {
  const doc = parseDocument("<a/>");
  assert.throws(() => applyProposal(doc, { from: 2, to: 9, replacement: "", rationale: "", origin: "test" }), RangeError);
});
