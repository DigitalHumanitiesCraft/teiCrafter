import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseDocument, walk } from "../../src/core/tei-document.js";
import { applyFormat, formatElement, mapFormattedOffset } from "../../src/core/format.js";

const sample = (name) => readFileSync(new URL(`../../public/samples/${name}`, import.meta.url), "utf8");
const SAMPLES = ["zbz-hersch-synthetic.xml", "o_szd.1079.tei.xml", "wenzelsbibel-synthetic-codex.xml"];

// Raw slices of every element that carries non-whitespace text directly.
function mixedSlices(raw) {
  const out = [];
  walk(parseDocument(raw).root, (n) => {
    if (n.type !== "element") return;
    const hasText = (n.children ?? []).some((k) => k.type === "text" && !/^[ \t\r\n]*$/.test(raw.slice(k.start, k.end)));
    if (!hasText) return;
    out.push(raw.slice(n.outerStart, n.outerEnd));
    return false;
  });
  return out;
}
const formatWhole = (raw) => {
  const doc = parseDocument(raw);
  const result = formatElement(doc, 0);
  return { result, next: applyFormat(doc, result).raw };
};

test("mixed content is byte-identical after formatting the whole document", () => {
  for (const name of SAMPLES) {
    const raw = sample(name);
    const { next } = formatWhole(raw);
    assert.equal(next.replace(/\s/g, ""), raw.replace(/\s/g, ""), `${name}: only whitespace may change`);
    for (const slice of mixedSlices(raw)) assert.ok(next.includes(slice), `${name}: mixed element changed: ${slice.slice(0, 60)}`);
  }
});

test("formatting is idempotent", () => {
  for (const name of SAMPLES) {
    const { next } = formatWhole(sample(name));
    const again = formatElement(parseDocument(next), 0);
    assert.equal(again.after, again.before, `${name}: second format changes the text`);
  }
});

test("whitespace-only text between blocks is normalised", () => {
  const raw = "<TEI><text><body>   <div>\n\n\n<p>x</p>   <p>y</p></div></body></text></TEI>\n";
  const { next } = formatWhole(raw);
  assert.equal(next, "<TEI>\n  <text>\n    <body>\n      <div>\n        <p>x</p>\n        <p>y</p>\n      </div>\n    </body>\n  </text>\n</TEI>\n");
});

test("an element is formatted at its depth, with its own line indentation corrected", () => {
  const raw = "<TEI>\n  <text>\n       <div><p>a</p><p>b</p></div>\n  </text>\n</TEI>";
  const doc = parseDocument(raw);
  const result = formatElement(doc, raw.indexOf("<div>") + 1);
  assert.equal(result.element.localName, "div");
  assert.equal(result.before, "       <div><p>a</p><p>b</p></div>");
  assert.equal(result.after, "    <div>\n      <p>a</p>\n      <p>b</p>\n    </div>");
});

test("CRLF line endings are preserved", () => {
  const raw = sample("zbz-hersch-synthetic.xml");
  assert.ok(raw.includes("\r\n"), "fixture is expected to use CRLF");
  const { result, next } = formatWhole(raw);
  assert.notEqual(result.after, result.before, "fixture is expected to need formatting");
  assert.ok(!/[^\r]\n/.test(next), "a lone LF was introduced");
});

test("Wenzelsbibel <l> word spacing is kept", () => {
  const raw = sample("wenzelsbibel-synthetic-codex.xml");
  const lines = [...raw.matchAll(/<l\b[^>]*>.*?<\/l>/g)].map((m) => m[0]);
  assert.ok(lines.length > 0 && lines.some((l) => l.includes("</w> <w")), "fixture is expected to separate words by spaces");
  const { next } = formatWhole(raw);
  for (const l of lines) assert.ok(next.includes(l), `<l> changed: ${l.slice(0, 60)}`);
});

test("inline siblings sharing a line keep their element unformatted", () => {
  const raw = "<lg><l><w>a</w> <w>b</w></l></lg>";
  const result = formatElement(parseDocument(raw), raw.indexOf("<w>"));
  assert.equal(result.element.localName, "l");
  assert.equal(result.after, result.before);
});

test("offsets map to the same non-whitespace character after formatting", () => {
  const raw = "<TEI><text><body><div><p>xy</p></div></body></text></TEI>";
  const doc = parseDocument(raw);
  const result = formatElement(doc, 0);
  const next = applyFormat(doc, result).raw;
  const at = raw.indexOf("y");
  assert.equal(next[mapFormattedOffset(result, at)], "y");
  assert.equal(mapFormattedOffset(result, raw.length), next.length);
});

test("a document without elements yields null", () => {
  assert.equal(formatElement(parseDocument("just text"), 0), null);
});
