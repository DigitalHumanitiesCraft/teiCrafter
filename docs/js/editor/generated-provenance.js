/** Persist whole-document LLM provenance in the TEI itself. */

import {
  addAttr,
  editAttrValue,
  firstTeiByLocal,
  getAttrObjInNamespace,
  getAttrInNamespace,
  parseDocument,
  teiElementsByLocal,
  XML_NAMESPACE,
} from "./tei-document.js";
import { AI_RESP, ensureRespStmt } from "./standoff.js";

function normalizePointer(value) {
  const id = String(value == null ? "" : value).replace(/^#/, "").trim();
  return id ? `#${id}` : AI_RESP;
}

/**
 * Mark a generated draft at document scope and declare its responsibility.
 * Existing @resp tokens and all unrelated source bytes are preserved.
 */
export function persistGeneratedProvenance(raw, responsibility = AI_RESP) {
  const pointer = normalizePointer(responsibility);
  let doc = parseDocument(String(raw));
  let root = firstTeiByLocal(doc.root, "TEI");
  if (!root) return String(raw);

  const respAttr = getAttrObjInNamespace(root, null, "resp");
  if (respAttr) {
    const tokens = respAttr.value.split(/\s+/).filter(Boolean);
    if (!tokens.includes(pointer)) doc = editAttrValue(doc, respAttr, [...tokens, pointer].join(" "));
  } else {
    doc = addAttr(doc, root, "resp", pointer);
  }

  doc = ensureRespStmt(doc, pointer);
  return doc.serialize();
}

/** True when document-scope provenance points to a declared responsibility. */
export function hasGeneratedDraftProvenance(doc, responsibility = AI_RESP) {
  const pointer = normalizePointer(responsibility);
  const root = firstTeiByLocal(doc?.root, "TEI");
  const tokens = (getAttrInNamespace(root, null, "resp") || "").split(/\s+/).filter(Boolean);
  if (!tokens.includes(pointer)) return false;
  const id = pointer.slice(1);
  return teiElementsByLocal(doc.root, "respStmt").some(
    (node) => getAttrInNamespace(node, XML_NAMESPACE, "id") === id,
  );
}
