import assert from "node:assert/strict";

import {
  hasGeneratedDraftProvenance,
  persistGeneratedProvenance,
} from "../../docs/js/editor/generated-provenance.js";
import {
  firstTeiByLocal,
  getAttrInNamespace,
  parseDocument,
  teiElementsByLocal,
  XML_NAMESPACE,
} from "../../docs/js/editor/tei-document.js";

const base = `<?xml version="1.0" encoding="UTF-8"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <teiHeader><fileDesc><titleStmt><title>Draft</title></titleStmt><publicationStmt><p>Test</p></publicationStmt><sourceDesc><p>Input</p></sourceDesc></fileDesc></teiHeader>
  <text><body><p>Hello.</p></body></text>
</TEI>`;

let checks = 0;
function check(condition, message) {
  assert.ok(condition, message);
  checks += 1;
}

const marked = persistGeneratedProvenance(base);
const doc = parseDocument(marked);
const root = firstTeiByLocal(doc.root, "TEI");
check(root, "TEI root remains parseable");
check(getAttrInNamespace(root, null, "resp") === "#ai", "document root carries the AI responsibility");
const respStmts = teiElementsByLocal(doc.root, "respStmt");
check(respStmts.length === 1, "one responsibility declaration is added");
check(getAttrInNamespace(respStmts[0], XML_NAMESPACE, "id") === "ai", "responsibility declaration is addressable");
check(marked.includes("Machine-generated draft, unreviewed"), "declaration describes the draft status");
check(hasGeneratedDraftProvenance(doc), "persisted document-scope provenance is recognized after reopen");
check(persistGeneratedProvenance(marked) === marked, "provenance insertion is idempotent");

const withExisting = base.replace("<TEI ", '<TEI resp="#editor" ');
const extended = persistGeneratedProvenance(withExisting, "#model-a");
const extendedDoc = parseDocument(extended);
check(
  getAttrInNamespace(firstTeiByLocal(extendedDoc.root, "TEI"), null, "resp") === "#editor #model-a",
  "existing responsibility tokens are preserved",
);
check(
  teiElementsByLocal(extendedDoc.root, "respStmt").some(
    (node) => getAttrInNamespace(node, XML_NAMESPACE, "id") === "model-a",
  ),
  "a configured responsibility is declared",
);

check(persistGeneratedProvenance("<notTei/>") === "<notTei/>", "non-TEI input is unchanged");
check(!hasGeneratedDraftProvenance(parseDocument(base)), "an ordinary TEI is not treated as generated");

console.log(`generated_provenance_check: ${checks}/${checks}`);
