/**
 * Proof (W3): the index panel renders its sections from the document's declared
 * manifest indices, not a hardcoded list. Asserts unconditionally on a synthetic
 * in-file manifest + index fixture, with no real-data dependency:
 *   - given declared indices, the consumer (sectionsForIndices) produces exactly
 *     those sections, in declaration order, using the manifest's own labels;
 *   - a non-mappable index (one with no editable entity type in the editor, e.g.
 *     a Wenzelsbibel "peoples"/Voelker index) stays VISIBLE as a read-only
 *     section: the panel renders it with the add control disabled and an
 *     explanation, never dropped;
 *   - with no declared indices the panel falls back to its built-in DEFAULT_SECTIONS;
 *   - the manifest parser and the consumer agree end to end: a synthetic manifest
 *     parsed by parseManifest feeds sectionsForIndices and yields those sections.
 *
 * The panel is pure DOM, so this script installs a minimal DOM stub (just the
 * surface index-panel.js and authority-form.js touch) before importing them,
 * then queries the produced element tree. No browser, no jsdom.
 *
 * Run: node test/tools/index_consumer_check.mjs   (exit 0 = all pass)
 */

// --- minimal DOM stub (installed before the modules under test import) --------

class StubNode {
  constructor(tag) {
    this.tagName = (tag || "").toUpperCase();
    this.nodeType = tag ? 1 : 3;       // 1 element, 3 text
    this.children = [];                // element + text children, in order
    this.attributes = new Map();
    this.dataset = {};
    this._class = "";
    this._text = "";
    this.parentNode = null;
    this.hidden = false;
    this.value = "";
  }
  set className(v) { this._class = v || ""; }
  get className() { return this._class; }
  get classList() {
    const self = this;
    const set = () => new Set(self._class.split(/\s+/).filter(Boolean));
    return {
      add: (c) => { const s = set(); s.add(c); self._class = [...s].join(" "); },
      remove: (c) => { const s = set(); s.delete(c); self._class = [...s].join(" "); },
      contains: (c) => set().has(c),
      toggle: (c, on) => { const s = set(); (on ?? !s.has(c)) ? s.add(c) : s.delete(c); self._class = [...s].join(" "); },
    };
  }
  set textContent(v) {
    this._text = v == null ? "" : String(v);
    this.children = [];                // textContent setter clears children (DOM semantics)
  }
  get textContent() {
    if (this.nodeType === 3) return this._text;
    return this._text + this.children.map((c) => c.textContent).join("");
  }
  set innerHTML(_v) { /* unused by the render path under test */ }
  setAttribute(k, v) { this.attributes.set(k, String(v)); if (k === "disabled") this.disabled = true; }
  getAttribute(k) { return this.attributes.has(k) ? this.attributes.get(k) : null; }
  hasAttribute(k) { return this.attributes.has(k); }
  addEventListener() {}
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  removeChild(child) { this.children = this.children.filter((c) => c !== child); child.parentNode = null; return child; }
  replaceWith(node) {
    if (!this.parentNode) return;
    const i = this.parentNode.children.indexOf(this);
    if (i >= 0) { this.parentNode.children[i] = node; node.parentNode = this.parentNode; }
  }
  get firstChild() { return this.children[0] || null; }
  _walk(acc) { for (const c of this.children) { if (c.nodeType === 1) { acc.push(c); c._walk(acc); } } return acc; }
  _matches(sel) {
    // Supports ".class" and ".a.b" compound class selectors (all this path uses).
    if (!sel.startsWith(".")) return false;
    const want = sel.slice(1).split(".").filter(Boolean);
    const have = new Set(this._class.split(/\s+/).filter(Boolean));
    return want.every((c) => have.has(c));
  }
  querySelector(sel) { return this._walk([]).find((n) => n._matches(sel)) || null; }
  querySelectorAll(sel) { return this._walk([]).filter((n) => n._matches(sel)); }
}

const documentStub = {
  createElement: (tag) => new StubNode(tag),
  createTextNode: (t) => { const n = new StubNode(null); n._text = t == null ? "" : String(t); return n; },
  getElementById: () => null,
};

globalThis.document = documentStub;

// --- modules under test (imported AFTER the stub is installed) ----------------

const { createIndexPanel, DEFAULT_SECTIONS } = await import("../../docs/js/editor/index-panel.js");
const { sectionsForIndices } = await import("../../docs/js/editor/entity-index.js");
const { parseManifest } = await import("../../docs/js/editor/project-manifest.js");

// --- harness -----------------------------------------------------------------

let passed = 0, failed = 0;
function check(cond, label) {
  if (cond) { passed++; console.log("  ok    " + label); }
  else { failed++; console.log("  FAIL  " + label); }
}

console.log("\nIndex consumer proof (W3)");
console.log("=".repeat(60));

// A fresh host + panel per render; the host is just a parent the panel fills.
function renderPanel(entities, sections) {
  const host = new StubNode("div");
  const panel = createIndexPanel(host, {});
  panel.render(entities, sections);
  return host;
}
const sectionTypes = (host) => host.querySelectorAll(".ed-idx-section").map((s) => s.dataset.type);

// --- 1. The deriver: declared indices -> exactly those sections ----------------

const declared = [
  { key: "persons", label: "People", listType: "listPerson", registers: ["GND"] },
  { key: "places", label: "Places", listType: "listPlace", registers: [] },
  { key: "peoples", label: "Peoples (Voelker)", listType: null, registers: [] },
];
const derived = sectionsForIndices(declared);

check(Array.isArray(derived) && derived.length === 3,
  "deriver: one section per declared index, in order");
check(derived.map((s) => s.key).join(",") === "persons,places,peoples",
  "deriver: section keys follow the declared indices");
check(derived[0].label === "People" && derived[1].label === "Places",
  "deriver: a mappable index uses the manifest's own label as the heading");
check(derived[0].type === "person" && derived[1].type === "place",
  "deriver: a mappable index keeps the editor's canonical editable type");
check(!derived[0].readOnly && !derived[1].readOnly,
  "deriver: a mappable index is editable (not read-only)");

// --- 2. The non-mappable index: read-only descriptor, not dropped --------------

const peoples = derived[2];
check(peoples.readOnly === true,
  "deriver: a non-mappable index (peoples) is marked read-only");
check(peoples.label === "Peoples (Voelker)",
  "deriver: the read-only index keeps its manifest label (kept, not dropped)");
check(typeof peoples.readOnlyNote === "string" && peoples.readOnlyNote.includes("read-only"),
  "deriver: the read-only index carries an explanation");

// --- 3. The panel renders declared sections, read-only add disabled ------------

const host = renderPanel({ persons: [], places: [], peoples: [] }, derived);
check(sectionTypes(host).join(",") === "person,place,peoples",
  "panel: renders exactly the declared sections (by dataset.type), peoples included");

const peoplesSec = host.querySelectorAll(".ed-idx-section").find((s) => s.dataset.type === "peoples");
check(!!peoplesSec && peoplesSec.dataset.readonly === "1",
  "panel: the peoples section is flagged read-only on the section node");
const peoplesAddBtn = peoplesSec.querySelector(".ed-idx-add");
check(!!peoplesAddBtn && peoplesAddBtn.disabled === true && peoplesAddBtn.hasAttribute("disabled"),
  "panel: the read-only section's add control is disabled");
check(!!peoplesSec.querySelector(".ed-idx-readonly-note"),
  "panel: the read-only section shows its explanation note");
check(!peoplesSec.querySelector(".ed-idx-add-input"),
  "panel: the read-only section offers no add input (nothing to type into)");

const personSec = host.querySelectorAll(".ed-idx-section").find((s) => s.dataset.type === "person");
const personAddBtn = personSec.querySelector(".ed-idx-add");
check(!!personAddBtn && personAddBtn.disabled !== true && !personAddBtn.hasAttribute("disabled"),
  "panel: a mappable section's add control stays enabled");
check(!!personSec.querySelector(".ed-idx-add-input"),
  "panel: a mappable section offers an add input");

// --- 3b. A read-only section's rows stay visible but carry no edit actions ------

const withRows = renderPanel(
  { peoples: [{ id: "ppl-1", type: "peoples", name: "Israelites", authorities: [] }] },
  sectionsForIndices([{ key: "peoples", label: "Peoples", listType: null, registers: [] }]),
);
const roSec = withRows.querySelector(".ed-idx-section");
check(roSec.querySelectorAll(".ed-idx-row").length === 1,
  "panel: a read-only section still shows its entity rows (not dropped)");
check(!roSec.querySelector(".ed-idx-delete") && !roSec.querySelector(".ed-idx-edit"),
  "panel: a read-only row offers no rename/delete (cannot edit in place)");
check(!!roSec.querySelector(".ed-idx-rowbody"),
  "panel: a read-only row keeps its body (jump-to-mention stays useful)");

// --- 4. No declared indices -> the built-in default sections -------------------

check(sectionsForIndices(null) === null && sectionsForIndices([]) === null,
  "deriver: no/empty declared indices returns null (fall back to default)");

for (const [arg, note] of [[undefined, "undefined"], [null, "null"], [[], "empty array"]]) {
  const h = renderPanel({}, sectionsForIndices(arg));
  check(sectionTypes(h).join(",") === DEFAULT_SECTIONS.map((s) => s.type).join(","),
    `panel: with ${note} declared indices the built-in default sections appear`);
}
// And the panel falls back even if the section argument is omitted entirely.
const hOmitted = renderPanel({});
check(sectionTypes(hOmitted).join(",") === DEFAULT_SECTIONS.map((s) => s.type).join(","),
  "panel: render() with no sections argument uses the built-in default");

// --- 5. End to end: parseManifest output feeds the consumer --------------------

const manifest = parseManifest({
  teicrafter: 1,
  name: "Synthetic W3",
  indices: [
    { key: "persons", label: "Persons", listType: "listPerson", registers: ["GND"] },
    { key: "peoples", label: "Peoples (Voelker)", registers: ["GND"] },
  ],
});
const e2e = sectionsForIndices(manifest.indices);
check(e2e.length === 2 && e2e[0].type === "person" && e2e[0].readOnly !== true,
  "end to end: parsed manifest -> persons section is editable");
check(e2e[1].readOnly === true && e2e[1].label === "Peoples (Voelker)",
  "end to end: parsed manifest -> peoples section is read-only and kept");

const noIdx = parseManifest({ teicrafter: 1, name: "No indices" });
check(sectionsForIndices(noIdx.indices) === null,
  "end to end: a manifest declaring no indices yields the default fallback");

// --- summary ------------------------------------------------------------------

console.log("=".repeat(60));
console.log(`${failed ? "FAILED" : "PASSED"}: ${passed}/${passed + failed} checks.`);
process.exit(failed ? 1 : 0);
