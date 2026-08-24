import { el } from "../../docs/js/editor/dom.js";
import { check, finish, section } from "./_assert.mjs";

section("DOM boolean attribute semantics");

const priorDocument = globalThis.document;
globalThis.document = {
  createElement(tagName) {
    return {
      tagName,
      attributes: new Map(),
      dataset: {},
      children: [],
      setAttribute(name, value) { this.attributes.set(name, String(value)); },
      addEventListener() {},
      appendChild(child) { this.children.push(child); },
    };
  },
  createTextNode(text) { return { text }; },
};

try {
  const enabled = el("button", { disabled: false, hidden: false, "aria-pressed": false });
  check("false HTML boolean attributes are omitted",
    !enabled.attributes.has("disabled") && !enabled.attributes.has("hidden"));
  check("false ARIA states remain explicit string attributes",
    enabled.attributes.get("aria-pressed") === "false");

  const disabled = el("button", { disabled: true, hidden: true });
  check("true HTML boolean attributes are present with an empty value",
    disabled.attributes.get("disabled") === "" && disabled.attributes.get("hidden") === "");

  const legacy = el("button", { disabled: "" });
  check("existing explicit empty boolean attributes remain supported",
    legacy.attributes.get("disabled") === "");
} finally {
  globalThis.document = priorDocument;
}

finish("dom_boolean_check passed");
