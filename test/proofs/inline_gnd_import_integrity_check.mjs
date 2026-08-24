/**
 * Proof: inline-GND import fails before adoption when a source mention carries
 * attributes or content that the register round-trip cannot preserve.
 *
 * Run: node test/proofs/inline_gnd_import_integrity_check.mjs
 */

import { workingDocument } from "../../docs/js/editor/interchange.js";
import {
  InlineGndImportCapabilityError,
  fromInlineGND,
  inlineGndImportCapabilityReport,
  toInlineGND,
} from "../../docs/js/editor/inline-gnd.js";
import { parseDocument } from "../../docs/js/editor/tei-document.js";
import { check, finish, section } from "./_assert.mjs";

const PROJECT = { interchange: "inline-gnd" };

section("safe inline-GND import remains a fixed point");

const SAFE = `<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <teiHeader><fileDesc><titleStmt><title>Safe import</title></titleStmt></fileDesc></teiHeader>
  <text><body><p><persName ref="GND:123" source="manual">Ada</persName> and <orgName>Academy</orgName>.</p></body></text>
</TEI>`;
const safe = parseDocument(SAFE);
const safeReport = inlineGndImportCapabilityReport(safe);
check("plain supported mentions pass import capability analysis",
  safeReport.ok && safeReport.profile === "inline-gnd-import" && safeReport.counts.mentions === 2);
const safeWorking = fromInlineGND(safe);
check("a safe import enters the register model", safeWorking !== safe && safeWorking.raw.includes("<standOff>"));
check("a safe import and export is byte-identical", toInlineGND(safeWorking).raw === SAFE);

section("unsupported inline data is blocked before open-time adoption");

const UNSAFE = `<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <text><body><p><persName ref="GND:123" xml:id="mention-1" key="legacy">Ada</persName> <orgName ref="https://example.org/org/1">Academy</orgName> <bibl ref="GND:456"><title>Structured title</title></bibl></p></body></text>
</TEI>`;
const unsafe = parseDocument(UNSAFE);
const report = inlineGndImportCapabilityReport(unsafe);
const codes = new Set(report.issues.map((issue) => issue.code));
check("the import report rejects unsupported attributes, refs and content",
  !report.ok
    && codes.has("unsupported-inline-attributes")
    && codes.has("unsupported-inline-ref")
    && codes.has("unsupported-inline-content"));
check("xml:id and key are named in the attribute loss report",
  report.issues.some((issue) => issue.code === "unsupported-inline-attributes"
    && issue.attributes.includes("xml:id") && issue.attributes.includes("key")));

let directFailure = null;
try { fromInlineGND(unsafe); } catch (error) { directFailure = error; }
check("direct import throws a typed capability error before returning a working document",
  directFailure instanceof InlineGndImportCapabilityError
    && directFailure.report.profile === "inline-gnd-import");
check("failed direct import leaves the canonical source bytes untouched", unsafe.raw === UNSAFE);

let boundaryFailure = null;
try { workingDocument(unsafe, PROJECT); } catch (error) { boundaryFailure = error; }
check("the automatic project-open boundary propagates the same fail-closed error",
  boundaryFailure instanceof InlineGndImportCapabilityError);
check("failed project-open conversion cannot introduce a register or drop source data",
  unsafe.raw === UNSAFE && !unsafe.raw.includes("<standOff>"));

const FOREIGN = '<TEI xmlns="http://www.tei-c.org/ns/1.0" xmlns:x="urn:foreign"><text><body><p><x:persName xml:id="foreign" key="kept">Foreign</x:persName></p></body></text></TEI>';
const foreign = parseDocument(FOREIGN);
const foreignReport = inlineGndImportCapabilityReport(foreign);
check("foreign equal-local-name content stays outside the inline-GND import profile",
  foreignReport.ok && foreignReport.counts.mentions === 0 && fromInlineGND(foreign) === foreign);

const NONCANONICAL = '<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p><persName source="manual" ref=\'GND:123\'>Ada</persName></p></body></text></TEI>';
const noncanonical = parseDocument(NONCANONICAL);
check("supported attributes with non-roundtripping order or quotes also fail closed",
  inlineGndImportCapabilityReport(noncanonical).issues.some(
    (issue) => issue.code === "unsupported-inline-syntax",
  ));
let syntaxFailure = null;
try { fromInlineGND(noncanonical); } catch (error) { syntaxFailure = error; }
check("syntax-only byte churn is blocked before import",
  syntaxFailure instanceof InlineGndImportCapabilityError && noncanonical.raw === NONCANONICAL);

finish("PASS: unsupported inline-GND mention data fails closed before the working document is adopted.");
