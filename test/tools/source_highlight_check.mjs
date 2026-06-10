/**
 * Offline check for the XML source-view highlighter (docs/js/editor/source-view.js).
 *
 * Invariant: highlighting is a pure presentation layer. Stripping the <span>
 * wrappers and decoding the three HTML escapes must reproduce the input
 * byte-for-byte, for well-formed XML and for mid-edit fragments (unterminated
 * comments/tags), so the overlay can never show different text than the
 * textarea holds. Also asserts the expected token classes appear.
 *
 * Run: node test/tools/source_highlight_check.mjs
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { highlightXml } from "../../docs/js/editor/source-view.js";

const here = dirname(fileURLToPath(import.meta.url));

let failures = 0;
let n = 0;
function check(name, ok, detail = "") {
  n++;
  if (ok) { console.log(`ok ${n} - ${name}`); return; }
  failures++;
  console.log(`NOT OK ${n} - ${name}${detail ? `: ${detail}` : ""}`);
}

/** Inverse of the presentation layer: drop spans, decode the three escapes. */
function strip(html) {
  return html
    .replace(/<span class="xs-[a-z]+">/g, "")
    .replace(/<\/span>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

const samples = [
  ["declaration + element + attrs", `<?xml version="1.0" encoding="UTF-8"?>\n<TEI xmlns="http://www.tei-c.org/ns/1.0" xml:id="t1">x</TEI>`],
  ["comment and entity refs", `<p>vor &amp; nach &lt;tag&gt; &#xE4; <!-- ein Kommentar --></p>`],
  ["single-quoted attr + self-closing", `<lb n='3' facs="#z1"/>`],
  ["CDATA", `<x><![CDATA[ <kein> & tag ]]></x>`],
  ["DOCTYPE", `<!DOCTYPE TEI SYSTEM "tei.dtd">\n<TEI/>`],
  ["unterminated tag (mid-edit)", `<p>text <persName ref="#p1`],
  ["unterminated comment (mid-edit)", `<p>a</p><!-- offen`],
  ["unterminated quote in attr", `<p rend="open>x</p>`],
  ["bare ampersand and angle in text", `a & b < c > d`],
  ["empty string", ``],
];

for (const [name, src] of samples) {
  const got = strip(highlightXml(src));
  check(`lossless render: ${name}`, got === src,
    got === src ? "" : `expected ${JSON.stringify(src)}, got ${JSON.stringify(got)}`);
}

// Real fixture: the bundled SZD demo object renders losslessly too.
const szd = readFileSync(join(here, "..", "..", "docs", "data", "editor", "szd", "o_szd.1079.tei.xml"), "utf8");
check("lossless render: o_szd.1079 (real object)", strip(highlightXml(szd)) === szd);

// Token classes: the highlighter actually colours, not just escapes.
const html = highlightXml(`<p n="1">a &amp; b<!--c--></p>`);
for (const cls of ["xs-punc", "xs-tag", "xs-attr", "xs-val", "xs-ent", "xs-comment"]) {
  check(`token class present: ${cls}`, html.includes(`class="${cls}"`));
}

// No raw "<" from the source may survive outside our own span markup.
const stripped = highlightXml(szd).replace(/<\/?span[^>]*>/g, "");
check("all source angle brackets escaped", !/[<>]/.test(stripped.replace(/&lt;|&gt;/g, "")));

console.log("=".repeat(60));
if (failures) { console.log(`FAILED (${n - failures}/${n})`); process.exit(1); }
console.log(`PASSED (${n}/${n})`);
console.log("The source-view highlighter is a pure, lossless presentation layer.");
