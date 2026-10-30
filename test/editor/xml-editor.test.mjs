import { test } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { autoCloseTags } from "@codemirror/lang-xml";

// The editor modules import each other without an extension, as the bundler resolves them.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (/^\.\.?\//.test(specifier) && !/\.[cm]?[jt]s$/.test(specifier) && context.parentURL?.endsWith(".ts")) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});
const { baseExtensions } = await import("../../src/editor/xml-editor.ts");

const handlersOf = (extensions) => EditorState.create({ extensions }).facet(EditorView.inputHandler);

test("the shared XML configuration inserts no closing tags on its own (F.5)", () => {
  const [autoClose] = handlersOf(autoCloseTags);
  assert.equal(typeof autoClose, "function", "control: the language package's handler is observable");
  assert.ok(!handlersOf(baseExtensions()).includes(autoClose));
  assert.ok(!handlersOf(baseExtensions({ wrap: true })).includes(autoClose));
});
