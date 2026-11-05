/**
 * Proof: browser parse errors become "Line N, column M: reason" in one form for
 * Chromium and Firefox. The inputs are parsererror texts recorded from both
 * engines (Playwright 1.62.1) for a tag mismatch, a duplicate attribute, an
 * empty document and an undefined entity.
 *
 * Run: node test/proofs/xml_errors_check.mjs   (exit 0 = all pass)
 */

import { describeParserError } from "../../docs/js/editor/xml-errors.js";
import { check, finish, section } from "./_assert.mjs";

const cases = [
  ["Chromium tag mismatch", "This page contains the following errors:error on line 2 at column 10: Opening and ending tag mismatch: p line 2 and px\nBelow is a rendering of the page up to the first error.", 2, 10, "Opening and ending tag mismatch: p line 2 and px"],
  ["Chromium duplicate attribute", "This page contains the following errors:error on line 1 at column 20: Attribute a redefined\nBelow is a rendering of the page up to the first error.", 1, 20, "Attribute a redefined"],
  ["Chromium empty document", "This page contains the following errors:error on line 1 at column 1: Document is empty\nBelow is a rendering of the page up to the first error.", 1, 1, "Document is empty"],
  ["Firefox tag mismatch", "XML Parsing Error: mismatched tag. Expected: </p>.\nLocation: about:blank\nLine Number 2, Column 7:<p>a</px>\n------^", 2, 7, "mismatched tag. Expected: </p>"],
  ["Firefox undefined entity", "XML Parsing Error: undefined entity\nLocation: about:blank\nLine Number 1, Column 6:<TEI>&undefined;</TEI>\n-----^", 1, 6, "undefined entity"],
  ["Firefox empty document", "XML Parsing Error: no root element found\nLocation: about:blank\nLine Number 1, Column 1:\n^", 1, 1, "no root element found"],
];

section("Parser error texts");
for (const [label, text, line, column, reason] of cases) {
  const described = describeParserError(text);
  check(`${label}: position`, described.line === line && described.column === column);
  check(`${label}: reason`, described.reason === reason);
  check(`${label}: message`, described.message === `Line ${line}, column ${column}: ${reason}`);
  check(`${label}: no engine boilerplate`, !/This page contains|Below is a rendering|Location:/.test(described.message));
}

section("Unknown formats");
const unknown = describeParserError("Some other parser said no.");
check("an unknown text is kept without a position", unknown.line === null && unknown.message === "Some other parser said no");
check("an empty text still yields a reason", describeParserError("").message.length > 0);

finish("xml_errors_check: all checks passed.");
