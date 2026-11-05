/**
 * Proof: opening an empty file, another XML vocabulary or a teiCorpus without
 * a TEI member yields a plain explanation instead of a JavaScript error.
 *   - teiRootProblem names an empty file, several roots and a foreign root;
 *   - TEI and teiCorpus roots, namespaced or legacy unnamespaced, pass;
 *   - detectProject returns null rather than throwing when no TEI element exists.
 *
 * Run: node test/proofs/tei_root_check.mjs   (exit 0 = all pass)
 */

import { parseEdition } from "../../docs/js/editor/edition.js";
import { detectProject } from "../../docs/js/editor/project-profiles.js";
import { teiRootProblem } from "../../docs/js/editor/tei-document.js";
import { check, finish, section } from "./_assert.mjs";

const TEI_NS = "http://www.tei-c.org/ns/1.0";
const doc = (raw) => parseEdition(raw).doc;

section("teiRootProblem");
check("empty file is named as empty", /no XML element/.test(teiRootProblem(doc("")) || ""));
check("whitespace-only file is named as empty", /no XML element/.test(teiRootProblem(doc("  \n")) || ""));
check("foreign root is named with its element", /<catalog>/.test(teiRootProblem(doc("<catalog><book/></catalog>")) || ""));
check("prefixed foreign root keeps its prefix", /<x:list>/.test(teiRootProblem(doc('<x:list xmlns:x="urn:x"/>')) || ""));
check("a TEI-like root in another namespace is refused", teiRootProblem(doc('<TEI xmlns="urn:not-tei"/>')) !== null);
check("TEI root passes", teiRootProblem(doc(`<TEI xmlns="${TEI_NS}"><teiHeader/></TEI>`)) === null);
check("legacy unnamespaced TEI root passes", teiRootProblem(doc("<TEI><teiHeader/></TEI>")) === null);
check("teiCorpus root passes", teiRootProblem(doc(`<teiCorpus xmlns="${TEI_NS}"><teiHeader/></teiCorpus>`)) === null);

section("detectProject without a TEI element");
for (const [label, raw] of [
  ["empty file", ""],
  ["foreign root", "<catalog><book/></catalog>"],
  ["teiCorpus without TEI member", `<teiCorpus xmlns="${TEI_NS}"><teiHeader/></teiCorpus>`],
]) {
  let result;
  let threw = null;
  try { result = detectProject(doc(raw)); } catch (err) { threw = err; }
  check(`${label}: no exception`, threw === null);
  check(`${label}: no profile`, result === null);
}

finish("tei_root_check: all checks passed.");
