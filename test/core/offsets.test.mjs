import { test } from "node:test";
import assert from "node:assert/strict";
import { EditorState } from "@codemirror/state";
import { lineSeparatorOf, rawToPos } from "../../src/core/line-offsets.js";

const stateOf = (raw) => EditorState.create({ doc: raw, extensions: EditorState.lineSeparator.of(lineSeparatorOf(raw)) });

test("separator detection", () => {
  assert.equal(lineSeparatorOf("a\r\nb\nc"), "\r\n");
  assert.equal(lineSeparatorOf("a\nb"), "\n");
  assert.equal(lineSeparatorOf("a"), "\n");
});

test("the editor text joined on the detected separator is the raw text", () => {
  for (const raw of ["a\r\nb\r\n", "a\nb\n", "a\r\nb\nc\r\n", "\r\n\r\n", ""]) assert.equal(stateOf(raw).sliceDoc(), raw);
});

test("raw offsets map to the editor position of the same character", () => {
  for (const raw of ["<a>\r\n  <b/>\r\n</a>\r\n", "<a>\n<b/>\n</a>", "x\r\ny\nz\r\n"]) {
    const state = stateOf(raw);
    const sep = state.lineBreak;
    for (let offset = 0; offset <= raw.length; offset++) {
      if (raw[offset - 1] === "\r" && raw[offset] === "\n" && sep === "\r\n") continue;
      const pos = rawToPos(raw, sep, offset);
      assert.equal(state.sliceDoc(0, pos), raw.slice(0, offset), `offset ${offset} in ${JSON.stringify(raw)}`);
    }
  }
});

test("an offset inside a CRLF maps to the end of its line", () => {
  const raw = "a\r\nb";
  const state = stateOf(raw);
  assert.equal(rawToPos(raw, "\r\n", 2), state.doc.line(1).to);
});
