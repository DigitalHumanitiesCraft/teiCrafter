/**
 * Proof: inline-GND export reports and blocks every standOff construct that its
 * target schema cannot represent, while safe prefixed TEI remains a fixed point.
 *
 * Run: node test/proofs/inline_gnd_capability_check.mjs
 */

import { targetCapabilityReport, targetDocument } from "../../docs/js/editor/interchange.js";
import {
  InlineGndCapabilityError,
  fromInlineGND,
  inlineGndCapabilityReport,
  toInlineGND,
} from "../../docs/js/editor/inline-gnd.js";
import { parseDocument } from "../../docs/js/editor/tei-document.js";
import { check, finish, section } from "./_assert.mjs";

const UNSAFE = `<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <standOff>
    <listPerson><person xml:id="p1"><persName>Ada</persName></person></listPerson>
    <listPlace><place xml:id="pl1"><placeName>Graz</placeName></place></listPlace>
    <listEvent><event xml:id="e1"><label>Meeting</label></event></listEvent>
    <note target="#w1">Editorial note</note>
    <relation active="#p1" passive="#pl1"/>
  </standOff>
  <text><body><p xml:id="w1"><name ref="#p1">Ada</name> in <name ref="#pl1">Graz</name> at <name ref="#e1">Meeting</name> with <name ref="#missing">Someone</name>.</p></body></text>
</TEI>`;

section("inline-GND loss report and enforced boundary");

const unsafe = parseDocument(UNSAFE);
const report = inlineGndCapabilityReport(unsafe);
const codes = new Set(report.issues.map((issue) => issue.code));
check("the capability report is explicit and rejects the projection", !report.ok && report.profile === "inline-gnd");
check("places and events are both reported as unsupported entity types",
  report.issues.some((issue) => issue.code === "unsupported-entity-type" && issue.entityType === "place")
    && report.issues.some((issue) => issue.code === "unsupported-entity-type" && issue.entityType === "event"));
check("notes and arbitrary standOff content are reported",
  codes.has("unsupported-note") && codes.has("unsupported-standoff-content")
    && report.issues.some((issue) => /<relation>/.test(issue.message)));
check("a dangling mention is reported", codes.has("missing-entity"));

let failure = null;
try { toInlineGND(unsafe); } catch (error) { failure = error; }
check("export throws a typed error carrying the same report shape",
  failure instanceof InlineGndCapabilityError
    && failure.report.ok === false
    && failure.report.issues.some((issue) => issue.code === "missing-entity"));
check("failed export leaves the canonical source bytes untouched", unsafe.raw === UNSAFE);

const project = { interchange: "inline-gnd" };
check("the project boundary exposes the capability report before export",
  targetCapabilityReport(unsafe, project).ok === false);
let targetFailed = false;
try { targetDocument(unsafe, project); } catch (error) { targetFailed = error instanceof InlineGndCapabilityError; }
check("the project save boundary enforces the report", targetFailed);

section("prefixed TEI fixed point");

const PREFIXED = `<tei:TEI xmlns:tei="http://www.tei-c.org/ns/1.0">
  <tei:teiHeader><tei:fileDesc><tei:titleStmt><tei:title>Prefix</tei:title></tei:titleStmt></tei:fileDesc></tei:teiHeader>
  <tei:standOff><tei:listPerson><tei:person xml:id="p1"><tei:persName>Ada</tei:persName><tei:idno type="GND">123456789</tei:idno></tei:person></tei:listPerson></tei:standOff>
  <tei:text><tei:body><tei:p><tei:name ref="#p1" source="manual">Ada</tei:name></tei:p></tei:body></tei:text>
</tei:TEI>`;
const prefixed = parseDocument(PREFIXED);
check("the prefixed safe register passes capability analysis", inlineGndCapabilityReport(prefixed).ok);
const inline = toInlineGND(prefixed);
check("projection keeps the TEI prefix on the inline carrier",
  inline.raw.includes('<tei:persName ref="GND:123456789" source="manual">Ada</tei:persName>'));
check("projection removes only the top-level register", !inline.raw.includes("<tei:standOff"));
const reopened = fromInlineGND(inline);
check("reopening creates prefix-faithful register and mention markup",
  reopened.raw.includes("<tei:standOff>")
    && reopened.raw.includes("<tei:listPerson>")
    && reopened.raw.includes('<tei:name ref="#pers_ada" source="manual">Ada</tei:name>'));
check("the prefixed interchange remains byte-identical after reopen and re-export",
  toInlineGND(reopened).raw === inline.raw);

finish("PASS: inline-GND loss is reported and blocked; safe prefixed TEI remains a fixed point.");
