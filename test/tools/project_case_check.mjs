/**
 * Proof: the operator's project test case, headless (everything except the
 * browser's directory picker, which the operator drives himself):
 *   a project holds one TEI file and two plaintext files; the plaintexts are
 *   drafted into line-level TEI deterministically (transport, no model); each
 *   file opens in the editor model; the element inventory binds to the file's
 *   DOCUMENT TYPE within the project (a project is not an edition type); edits
 *   stay byte-faithful.
 *
 * Run: node test/tools/project_case_check.mjs   (exit 0 = all pass)
 */

import { teiFromPlaintext } from "../../docs/js/editor/plaintext-import.js";
import { parseManifest, markupForFile, typeForFile } from "../../docs/js/editor/project-manifest.js";
import { parseEdition, editCellCore, serialize } from "../../docs/js/editor/edition.js";
import { tokenize } from "../../docs/js/editor/tei-document.js";

let passed = 0, failed = 0;
function check(cond, label) {
  if (cond) { passed++; console.log("  ok    " + label); }
  else { failed++; console.log("  FAIL  " + label); }
}
const reparses = (raw) => tokenize(raw).map((t) => raw.slice(t.start, t.end)).join("") === raw;

console.log("\nProject test case proof (project folder, mixed types)");
console.log("=".repeat(60));

// --- 1. Deterministic plaintext intake -----------------------------------------

const TXT = "Lieber Freund,\nich danke Ihnen herzlich.\n\nMit besten Grüssen\nStefan";
const tei1 = teiFromPlaintext(TXT, "brief-001");
const tei2 = teiFromPlaintext(TXT, "brief-001");
check(tei1 === tei2, "same plaintext input always yields the same TEI (deterministic)");
check(tei1.includes("<title>brief-001</title>"), "the title carries the file name");
check(!/resp="#ai"/.test(tei1) && !tei1.includes("generated"), "the draft is NOT AI-marked (transport, no machine interpretation)");

const stateTxt = parseEdition(tei1);
check(stateTxt.profile === "line", "the draft opens line-level");
check(stateTxt.folios.length === 1, "one folio (one <pb/>)");
check(stateTxt.cells.length === 4, "four non-empty plaintext lines become four cells");
check(stateTxt.cells.map((c) => c.text.trim())[0] === "Lieber Freund,", "line text carried verbatim");
check(reparses(tei1), "the draft tokenizes byte-covering");
check(serialize(parseEdition(tei1)) === tei1, "the draft round-trips byte-identically");

// Escaping: markup characters in plaintext are content, not markup.
const evil = teiFromPlaintext('a < b & c > d "quote"', "esc");
check(evil.includes("a &lt; b &amp; c &gt; d \"quote\""), "plaintext <, &, > are escaped; quotes stay verbatim in text");
check(reparses(evil) && parseEdition(evil).cells.length === 1, "escaped draft parses to one cell");

// CRLF input: line breaks are structure, not content.
const crlf = teiFromPlaintext("eins\r\nzwei\r\ndrei", "crlf");
check(parseEdition(crlf).cells.length === 3 && !crlf.includes("\r"), "CRLF input yields three cells and no CR in the output");

// Empty file: still a valid, openable document.
const empty = teiFromPlaintext("", "leer");
check(reparses(empty) && parseEdition(empty).cells.length === 0, "an empty plaintext yields a valid, empty document");

// --- 2. The project: one TEI + two plaintexts, types bind the inventory --------

const manifest = parseManifest({
  teicrafter: 1,
  name: "Mein Testprojekt",
  markup: [{ element: "hi" }, { element: "foreign" }],
  documentTypes: [
    { key: "letter", label: "Letter", markup: [{ element: "salute" }, { element: "signed" }, { element: "persName" }] },
    { key: "lifeDocument", label: "Life document" },
  ],
  files: {
    "edition.xml": "lifeDocument",
    "brief-001.xml": "letter",
    "brief-002.xml": "letter",
  },
});

check(manifest.documentTypes.length === 2, "the project declares two document types");
check(typeForFile(manifest, "brief-001.xml").label === "Letter", "a drafted plaintext's target .xml resolves to its type");
check(markupForFile(manifest, "brief-001.xml").map(([l]) => l).join(",") === "salute,signed,persName",
  "a letter gets the letter inventory (markup binds to the TYPE)");
check(markupForFile(manifest, "edition.xml").map(([l]) => l).join(",") === "hi,foreign",
  "a type without its own markup falls back to the project default");
check(markupForFile(manifest, "neu.xml").map(([l]) => l).join(",") === "hi,foreign",
  "an unassigned file gets the project default");

// --- 3. All three documents open and edit byte-faithfully ----------------------

const TEI_FILE = `<?xml version="1.0" encoding="UTF-8"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0"><teiHeader><fileDesc><titleStmt><title>Lebensdokument</title></titleStmt></fileDesc></teiHeader>
<text><body><pb n="1"/><p><lb/>Erste Zeile bleibt.
<lb/>Zweite Zeile wird korrigiert.</p></body></text></TEI>
`;
const docs = [
  { name: "edition.xml", raw: TEI_FILE },
  { name: "brief-001.xml", raw: teiFromPlaintext(TXT, "brief-001") },
  { name: "brief-002.xml", raw: teiFromPlaintext("Zweiter Brief.\nNur zwei Zeilen.", "brief-002") },
];

for (const d of docs) {
  const state = parseEdition(d.raw);
  check(state.cells.length > 0 && serialize(state) === d.raw, `${d.name}: opens and round-trips byte-identically`);
}

// One surgical edit in the second draft: the diff is exactly the edit.
const st = parseEdition(docs[2].raw);
const target = st.cells.find((c) => c.text.includes("zwei Zeilen"));
const st2 = editCellCore(st, target.id, "Genau zwei Zeilen.");
check(st2.raw !== docs[2].raw && st2.raw.includes("Genau zwei Zeilen."), "the corrected line carries the new text");
const before = docs[2].raw.replace("Nur zwei Zeilen.", "");
const after = st2.raw.replace("Genau zwei Zeilen.", "");
check(before === after, "outside the edited line every byte is unchanged (the diff is exactly the edit)");
check(reparses(st2.raw), "the edited draft still tokenizes byte-covering");

// --- summary -------------------------------------------------------------------

console.log("=".repeat(60));
console.log(`${failed ? "FAILED" : "PASSED"}: ${passed}/${passed + failed} checks.`);
process.exit(failed ? 1 : 0);
