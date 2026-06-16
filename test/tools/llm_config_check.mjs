/**
 * Proof: the project manifest's optional "llm" block (docs/js/editor/project-manifest.js).
 * A project (or a document type) declares model-assistance config: a systemPrompt,
 * a mapping filename (a Markdown doc ingested by the loader), a responsibility id.
 * It is type-aware (a type override wins per field over the project default), which
 * is how a project holding several kinds of TEI -- an edition, a dictionary, a
 * corpus -- gives each its own voice. llmForFile resolves the effective config;
 * mappingFiles lists the files the loader must ingest. Malformed blocks are rejected.
 *
 * Run: node test/tools/llm_config_check.mjs   (exit 0 = all pass)
 */

import { parseManifest, llmForFile, mappingFiles } from "../../docs/js/editor/project-manifest.js";

let passed = 0, failed = 0;
function check(cond, label) {
  if (cond) { passed++; console.log("  ok    " + label); }
  else { failed++; console.log("  FAIL  " + label); }
}
function rejects(obj, fragment, label) {
  try { parseManifest(obj); failed++; console.log("  FAIL  " + label + " (did not throw)"); }
  catch (e) {
    if (String(e.message).includes(fragment)) { passed++; console.log("  ok    " + label); }
    else { failed++; console.log(`  FAIL  ${label} (message "${e.message}" lacks "${fragment}")`); }
  }
}

console.log("\nManifest llm block proof (type-aware system prompt + mapping)");
console.log("=".repeat(64));

// A project with a project-level llm default and a type that overrides it.
const proj = parseManifest({
  teicrafter: 1,
  name: "Mixed corpus",
  llm: { systemPrompt: "Project voice.", mapping: "mapping.md", responsibility: "#bot" },
  documentTypes: [
    { key: "letter", label: "Letter" },
    { key: "dict", label: "Dictionary", llm: { systemPrompt: "Dictionary voice.", mapping: "dict-mapping.md" } },
  ],
  files: { "a.xml": "letter", "b.xml": "dict" },
});

check(proj.llm && proj.llm.systemPrompt === "Project voice." && proj.llm.responsibility === "#bot",
  "the project-level llm block parses");

// A file of a type with no llm override gets the project default.
const a = llmForFile(proj, "a.xml");
check(a && a.systemPrompt === "Project voice." && a.mapping === "mapping.md" && a.responsibility === "#bot",
  "a file whose type declares no llm gets the project default");

// A file of a type with an override: per-field merge (type wins, project fills gaps).
const b = llmForFile(proj, "b.xml");
check(b && b.systemPrompt === "Dictionary voice." && b.mapping === "dict-mapping.md",
  "a type's llm override wins for systemPrompt and mapping");
check(b && b.responsibility === "#bot", "fields the type omits fall back to the project default");

// An unknown/unassigned file gets the project default.
const u = llmForFile(proj, "unknown.xml");
check(u && u.systemPrompt === "Project voice.", "an unassigned file gets the project-level default");

// mappingFiles lists both referenced files, de-duplicated and order-stable.
const files = mappingFiles(proj);
check(files.length === 2 && files.includes("mapping.md") && files.includes("dict-mapping.md"),
  "mappingFiles lists every referenced mapping file");

// De-duplication when project and a type reference the same file.
const shared = parseManifest({
  teicrafter: 1, name: "Shared",
  llm: { mapping: "shared.md" },
  documentTypes: [{ key: "t", llm: { mapping: "shared.md" } }],
  files: { "x.xml": "t" },
});
check(mappingFiles(shared).length === 1 && mappingFiles(shared)[0] === "shared.md",
  "a mapping file referenced twice is listed once");

// Absent llm: null config, no mapping files.
const bare = parseManifest({ teicrafter: 1, name: "Bare" });
check(bare.llm === null, "no llm block normalizes to null");
check(llmForFile(bare, "x.xml") === null, "llmForFile is null without any llm block");
check(mappingFiles(bare).length === 0, "mappingFiles is empty without any llm block");
check(llmForFile(null, "x.xml") === null, "llmForFile tolerates a null project");

// --- malformed llm blocks are rejected with precise messages -----------------
rejects({ teicrafter: 1, name: "X", llm: "nope" }, '"llm" is not an object', "a non-object llm is rejected");
rejects({ teicrafter: 1, name: "X", llm: { systemPrompt: 5 } }, "llm.systemPrompt is not a string", "a non-string systemPrompt is rejected");
rejects({ teicrafter: 1, name: "X", llm: { mapping: "   " } }, "llm.mapping is not a filename string", "an empty mapping filename is rejected");
rejects({ teicrafter: 1, name: "X", documentTypes: [{ key: "t", llm: { responsibility: 1 } }] },
  "documentTypes[0].llm.responsibility is not a string", "a malformed type-level llm is rejected with the type path");

console.log("=".repeat(64));
if (failed === 0) {
  console.log(`PASSED (${passed}/${passed})`);
  console.log("The llm block is type-aware, resolves per file, and rejects malformed input.");
  process.exit(0);
} else {
  console.log(`FAILED (${passed}/${passed + failed}, ${failed} failing)`);
  process.exit(1);
}
