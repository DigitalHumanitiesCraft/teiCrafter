/**
 * Proof: a line-level cell edit preserves the text node's edge whitespace
 * (indentation/newlines), so correcting one line never collapses the surrounding
 * formatting. This guards the whitespace caveat in the lossless edit contract.
 *
 * The fix lives in editCellCore (edition.js): the UI edits only the trimmed core
 * and re-attaches the original lead/trail on commit. editWordText (the raw node
 * replace) is the OLD path and is kept here as a control: it DID collapse the
 * trailing indentation, which is exactly the bug being closed.
 *
 * Run: node test/tools/whitespace_edit_check.mjs   (exit 0 = all pass)
 */

import {
  parseEdition,
  editCell,
  editWordText,
  editCellCore,
  splitEdge,
  serialize,
} from "../../docs/js/editor/edition.js";

let passed = 0, failed = 0;
function check(cond, label) {
  if (cond) { passed++; console.log("  ok    " + label); }
  else { failed++; console.log("  FAIL  " + label); }
}

console.log("\nWhitespace-preserving line edit proof");
console.log("=".repeat(60));

// A line-level edition with real indentation: the text after each <lb/> carries
// a trailing newline + indent up to the next <lb/> or </p>. The last <p> also
// exercises leading whitespace on both edges of a single text node.
const RAW =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<TEI xmlns="http://www.tei-c.org/ns/1.0">\n' +
  "<teiHeader><fileDesc><titleStmt><title>t</title></titleStmt></fileDesc></teiHeader>\n" +
  "<text><body>\n" +
  '<pb n="1"/>\n' +
  "<p>\n" +
  '  <lb n="1"/>Wohlgeboren\n' +
  '  <lb n="2"/>Herr Doktor\n' +
  "</p>\n" +
  "<p>  spaced core  </p>\n" +
  "</body></text>\n" +
  "</TEI>";

const state = parseEdition(RAW);

// --- 1. splitEdge isolates the trimmed core from the edge whitespace ---------

const line1 = state.cells.find((c) => c.text.trim() === "Wohlgeboren");
check(!!line1, "the first line is an editable cell");
const [lead1, core1, trail1] = splitEdge(line1.text);
check(core1 === "Wohlgeboren", "splitEdge core is the trimmed line text");
check(lead1 === "" && trail1 === "\n  ", "splitEdge keeps the trailing newline + indent ('\\n  ')");

// --- 2. editCellCore changes ONLY the core, edge whitespace stays verbatim ---

const fixed = editCellCore(state, line1.id, "Hochwohlgeboren");
const expected = RAW.replace("Wohlgeboren", "Hochwohlgeboren");
check(serialize(fixed) === expected, "line edit changes exactly the core; indentation before <lb n=\"2\"/> survives");
check(/Hochwohlgeboren\n  <lb n="2"\/>/.test(serialize(fixed)), "the newline + indent still separates the two lines");

// --- 3. control: the OLD raw-node path collapses the trailing indentation -----

const collapsed = editWordText(state, line1.id, "Hochwohlgeboren");
check(serialize(collapsed) !== expected, "(control) raw editWordText does NOT preserve the edge whitespace");
check(/Hochwohlgeboren<lb n="2"\/>/.test(serialize(collapsed)), "(control) the old path pulls <lb n=\"2\"/> onto the line (the bug)");

// --- 4. both edges preserved on a node with leading AND trailing whitespace ---

const spaced = state.cells.find((c) => c.text.trim() === "spaced core");
const [lead2, , trail2] = splitEdge(spaced.text);
check(lead2 === "  " && trail2 === "  ", "leading and trailing spaces are both captured");
const spacedFixed = editCellCore(state, spaced.id, "edited");
check(serialize(spacedFixed) === RAW.replace("spaced core", "edited"), "both edges re-attached around the new core ('  edited  ')");

// --- 5. no-op and byte-stability ---------------------------------------------

check(serialize(editCellCore(state, line1.id, core1)) === RAW, "re-committing the same core is a byte-identical no-op");
check(parseEdition(serialize(fixed)).raw === serialize(fixed), "the edited document re-parses byte-identically");
check(serialize(state) === RAW, "the original state is left untouched (immutability)");

// --- 6. word-level cells are unaffected (no edge whitespace) ------------------

const WRAW =
  '<TEI xmlns="http://www.tei-c.org/ns/1.0">' +
  "<teiHeader><fileDesc><titleStmt><title>t</title></titleStmt></fileDesc></teiHeader>" +
  '<text><body><p><w xml:id="w1">Hallo</w> <w xml:id="w2">Welt</w></p></body></text></TEI>';
const wstate = parseEdition(WRAW);
const [wlead, wcore, wtrail] = splitEdge(wstate.cellById.get("w1").text);
check(wlead === "" && wtrail === "" && wcore === "Hallo", "a <w> cell has no edge whitespace (core === text)");
check(
  serialize(editCellCore(wstate, "w1", "Hallox")) === serialize(editCell(wstate, "w1", "Hallox")),
  "editCellCore on a word equals plain editCell (behavior unchanged)"
);

// --- summary -----------------------------------------------------------------

console.log("=".repeat(60));
if (failed === 0) {
  console.log(`PASSED (${passed}/${passed})`);
  console.log("Line edits preserve indentation; the whitespace caveat is closed.");
  process.exit(0);
} else {
  console.log(`FAILED (${passed}/${passed + failed}, ${failed} failing)`);
  process.exit(1);
}
