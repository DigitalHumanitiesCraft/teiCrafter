import assert from "node:assert/strict";

import {
  applySourceCompletion,
  sourceCompletionContext,
  sourceCompletionItems,
} from "../../docs/js/editor/source-view.js";

const vocabulary = {
  elements: [
    { name: "persName", description: "A proper name referring to a person." },
    { name: "placeName", description: "A proper name referring to a place." },
  ],
  attributes: {
    persName: [
      { name: "ref", description: "Reference", values: [] },
      { name: "type", description: "Type", values: [{ value: "fictional" }, { value: "real" }] },
    ],
  },
};

let context = sourceCompletionContext("<per", 4);
assert.deepEqual(context, {
  kind: "element", prefix: "per", element: null, replaceStart: 1, replaceEnd: 4,
});
let items = sourceCompletionItems(context, vocabulary);
assert.deepEqual(items.map((item) => item.name), ["persName"]);
let applied = applySourceCompletion("<per", context, items[0]);
assert.deepEqual(applied, { text: "<persName", caret: 9 });

context = sourceCompletionContext("<persName r", 11);
assert.equal(context.kind, "attribute");
assert.equal(context.element, "persName");
items = sourceCompletionItems(context, vocabulary);
assert.deepEqual(items.map((item) => item.name), ["ref"]);
applied = applySourceCompletion("<persName r", context, items[0]);
assert.deepEqual(applied, { text: '<persName ref=""', caret: 15 });

context = sourceCompletionContext('<persName type="f', 17);
assert.equal(context.kind, "value");
items = sourceCompletionItems(context, vocabulary);
assert.deepEqual(items.map((item) => item.value), ["fictional"]);
applied = applySourceCompletion('<persName type="f', context, items[0]);
assert.deepEqual(applied, { text: '<persName type="fictional', caret: 25 });

assert.equal(sourceCompletionContext("plain text", 10), null);
assert.equal(sourceCompletionContext("<!-- com", 8), null);

console.log("source completion: element, attribute and closed-value contexts PASS");
