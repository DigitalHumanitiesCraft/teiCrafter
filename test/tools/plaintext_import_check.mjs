/**
 * Proof: deterministic plaintext intake recognises page-break markers.
 *
 * A token |N| (N = ASCII digits) becomes <pb n="N"/>. A page break implies a
 * line break, so the segment after a marker starts a new <lb/> line; one space
 * directly bordering the marker is dropped. Anything else stays verbatim text.
 * Marker-free input must stay byte-identical to the historical shape, and every
 * produced document must round-trip through the engine byte-for-byte.
 *
 * Run: node test/tools/plaintext_import_check.mjs   (exit 0 = all pass)
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { teiFromPlaintext } from "../../docs/js/editor/plaintext-import.js";
import { parseEdition, serialize } from "../../docs/js/editor/edition.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..");

let passed = 0, failed = 0;
function check(cond, label) {
  if (cond) { passed++; console.log("  ok    " + label); }
  else { failed++; console.log("  FAIL  " + label); }
}

console.log("\nPlaintext page-break marker proof");
console.log("=".repeat(60));

// --- 1. marker-free input is byte-identical to the historical shape ----------

const plain = "first line\nsecond line\n\nnext para";
const expectedPlain =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<TEI xmlns="http://www.tei-c.org/ns/1.0">\n' +
  "  <teiHeader>\n" +
  "    <fileDesc>\n" +
  "      <titleStmt>\n" +
  "        <title>Doc</title>\n" +
  "      </titleStmt>\n" +
  "      <publicationStmt>\n" +
  "        <p>Unpublished draft. Drafted deterministically from plaintext by teiCrafter; the text is carried verbatim, no machine interpretation is involved.</p>\n" +
  "      </publicationStmt>\n" +
  "      <sourceDesc>\n" +
  "        <p>Plaintext file: Doc</p>\n" +
  "      </sourceDesc>\n" +
  "    </fileDesc>\n" +
  "  </teiHeader>\n" +
  "  <text>\n" +
  "    <body>\n" +
  '      <pb n="1"/>\n' +
  "        <p><lb/>first line\n          <lb/>second line</p>\n" +
  "        <p><lb/>next para</p>\n" +
  "    </body>\n" +
  "  </text>\n" +
  "</TEI>\n";
check(teiFromPlaintext(plain, "Doc") === expectedPlain, "marker-free output is byte-identical to the hand-computed shape");

// --- 2. mid-line marker splits into <lb/> .. <pb> .. <lb/> inside one <p> -----

const mid = teiFromPlaintext("schildern |2| ist bekannt", "M");
check(mid.includes("<p><lb/>schildern<pb n=\"2\"/><lb/>ist bekannt</p>"),
  "mid-line marker: schildern, <pb n=\"2\"/>, then <lb/>ist bekannt in the same <p>");

// --- 3. standalone marker line emits only the <pb> ---------------------------

const alone = teiFromPlaintext("alpha\n|3|\nbeta", "S");
check(alone.includes('<p><lb/>alpha\n          <pb n="3"/>\n          <lb/>beta</p>'),
  "standalone marker line: bare <pb n=\"3\"/> with neighbouring <lb/> lines");

// --- 4. multiple markers in one line -----------------------------------------

const multi = teiFromPlaintext("a |4| b |5| c", "X");
check(multi.includes('<p><lb/>a<pb n="4"/><lb/>b<pb n="5"/><lb/>c</p>'),
  "two markers in one line each become a <pb>, splitting into three <lb/> segments");

// --- 5. non-markers stay literal (and escaped) -------------------------------

const lit = teiFromPlaintext("|x| |2 2| || end", "L");
check((lit.match(/<pb /g) || []).length === 1,
  "|x|, |2, 2|, || produce no extra <pb> (only the template's <pb n=\"1\"/>)");
check(lit.includes("|x| |2 2| || end"), "non-marker pipes carried verbatim as text");

// --- 6. XML escaping still applies around markers ----------------------------

const esc = teiFromPlaintext("a & b < c |6| d > e & f", "E");
check(esc.includes('<lb/>a &amp; b &lt; c<pb n="6"/><lb/>d &gt; e &amp; f'),
  "& < > escaped in both segments around the marker");

// --- 7. every produced document round-trips through the engine ----------------

for (const tei of [expectedPlain, mid, alone, multi, lit, esc]) {
  check(serialize(parseEdition(tei)) === tei, "serialize(parseEdition(tei)) === tei");
}

// --- 8. real-case fixture: one |2| mid-line, two folios -----------------------

const fixturePath = resolve(REPO_ROOT, "docs/data/editor/hsa-7711/brief-benndorf-1879.txt");
const fixtureText = readFileSync(fixturePath, "utf-8");
const fixtureTei = teiFromPlaintext(fixtureText, "brief-benndorf-1879");
const pbCount = (fixtureTei.match(/<pb n="2"\/>/g) || []).length;
check(pbCount === 1, "fixture produces exactly one <pb n=\"2\"/>");
check(serialize(parseEdition(fixtureTei)) === fixtureTei, "fixture document round-trips byte-identically");
const state = parseEdition(fixtureTei);
check(state.folios.length === 2, "fixture parses to 2 folios (split on <pb n=\"1\"/> and <pb n=\"2\"/>)");

// --- summary -----------------------------------------------------------------

console.log("=".repeat(60));
if (failed === 0) {
  console.log(`PASSED (${passed}/${passed})`);
  console.log("Page-break markers map to <pb>; marker-free output is unchanged.");
  process.exit(0);
} else {
  console.log(`FAILED (${passed}/${passed + failed}, ${failed} failing)`);
  process.exit(1);
}
