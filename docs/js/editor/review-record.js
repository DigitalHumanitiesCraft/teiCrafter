/** Pure, lossless TEI review records stored in teiHeader/revisionDesc. */

import {
  addAttr,
  editTextAndAttrs,
  escapeAttr,
  escapeText,
  getUnqualifiedAttr,
  getXmlId,
  isTeiElement,
  spliceDocument,
  textOf,
  walk,
} from "./tei-document.js";

export const REVIEW_TYPE = "review";
export const REVIEW_STATUS_VERIFIED = "verified";
export const DEFAULT_REVIEWER = "urn:teicrafter:local-reviewer";
export const DEFAULT_REVIEW_RATIONALE = "Editorial verification completed in teiCrafter.";

const XML_ID = /^[\p{L}_][\p{L}\p{N}\p{M}._-]*$/u;

function own(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function directTeiChildren(element, localName = null) {
  return (element?.children || []).filter((child) => (
    isTeiElement(child) && (localName == null || child.localName === localName)
  ));
}

function documentElementForAnchor(anchor) {
  let current = anchor;
  while (current?.type === "element") {
    if (isTeiElement(current) && ["TEI", "teiCorpus"].includes(current.localName)) return current;
    current = current.parent;
  }
  return null;
}

function documentElements(doc) {
  const elements = [];
  walk(doc?.root, (node) => {
    if (isTeiElement(node) && ["TEI", "teiCorpus"].includes(node.localName)) elements.push(node);
  });
  return elements;
}

function headerElement(anchor) {
  return directTeiChildren(documentElementForAnchor(anchor), "teiHeader")[0] || null;
}

function revisionElements(doc) {
  return documentElements(doc).flatMap((root) => (
    directTeiChildren(root, "teiHeader").flatMap((header) => directTeiChildren(header, "revisionDesc"))
  ));
}

function qnameFor(localName, context) {
  return context?.prefix ? `${context.prefix}:${localName}` : localName;
}

function newlineOf(doc) {
  return doc.raw.includes("\r\n") ? "\r\n" : "\n";
}

function lineIndent(raw, offset) {
  const lineStart = raw.lastIndexOf("\n", Math.max(0, offset - 1)) + 1;
  const prefix = raw.slice(lineStart, offset);
  return /^[\t ]*$/.test(prefix) ? prefix : "";
}

function trailingWhitespace(doc, element) {
  if (element.contentStart == null || element.contentEnd == null) return "";
  return (/\s*$/.exec(doc.raw.slice(element.contentStart, element.contentEnd)) || [""])[0];
}

function childIndent(doc, element) {
  const existing = (element.children || []).find((child) => child.type === "element");
  const inferred = existing ? lineIndent(doc.raw, existing.outerStart) : "";
  return inferred || `${lineIndent(doc.raw, element.outerStart)}  `;
}

function isMultilineContainer(doc, element) {
  if (element.contentStart == null || element.contentEnd == null) return false;
  return /\r?\n/.test(doc.raw.slice(element.contentStart, element.contentEnd));
}

function appendChild(doc, element, fragment) {
  if (!element || element.outerStart == null || element.outerEnd == null) return doc;
  if (element.selfClosing) {
    const source = doc.raw.slice(element.outerStart, element.outerEnd);
    const close = /\/\s*>$/.exec(source);
    if (!close) return doc;
    const formatted = lineIndent(doc.raw, element.outerStart) !== "";
    const nl = newlineOf(doc);
    const indent = childIndent(doc, element);
    const inner = formatted
      ? `${nl}${indent}${fragment}${nl}${lineIndent(doc.raw, element.outerStart)}`
      : fragment;
    const replacement = `${source.slice(0, close.index)}>${inner}</${element.qname}>`;
    return spliceDocument(doc, element.outerStart, element.outerEnd, replacement);
  }
  if (element.contentStart == null || element.contentEnd == null) return doc;
  const tail = trailingWhitespace(doc, element);
  const at = element.contentEnd - tail.length;
  const multiline = isMultilineContainer(doc, element) || /\r?\n/.test(tail);
  const insertion = multiline
    ? `${newlineOf(doc)}${childIndent(doc, element)}${fragment}`
    : fragment;
  return spliceDocument(doc, at, at, insertion);
}

function normalizedTokens(value) {
  return String(value == null ? "" : value).trim().split(/\s+/).filter(Boolean);
}

function rationaleText(doc, element) {
  const parts = [];
  walk(element, (node) => {
    if (node.type === "text") parts.push(textOf(doc, node));
  });
  return parts.join("").replace(/\s+/g, " ").trim();
}

function recordFromElement(doc, element) {
  const targets = normalizedTokens(getUnqualifiedAttr(element, "target"));
  return {
    element,
    type: getUnqualifiedAttr(element, "type") || "",
    status: getUnqualifiedAttr(element, "subtype") || "",
    targets,
    targetIds: targets.filter((token) => token.startsWith("#") && token.length > 1)
      .map((token) => token.slice(1)),
    who: getUnqualifiedAttr(element, "who"),
    whoTokens: normalizedTokens(getUnqualifiedAttr(element, "who")),
    when: getUnqualifiedAttr(element, "when"),
    rationale: rationaleText(doc, element),
  };
}

/** Read every TEI review record under the document's revisionDesc. */
export function readReviewRecords(doc, { status = null } = {}) {
  const records = [];
  for (const revision of revisionElements(doc)) {
    walk(revision, (node) => {
      if (!isTeiElement(node, "change")) return;
      const record = recordFromElement(doc, node);
      if (record.type === REVIEW_TYPE && (status == null || record.status === status)) {
        records.push(record);
      }
    });
  }
  return records;
}

/** Find an element by a unique xml:id. Ambiguous ids resolve to null. */
export function findElementByXmlId(doc, id) {
  if (!id) return null;
  const matches = [];
  walk(doc?.root, (node) => {
    if (node.type === "element" && getXmlId(node) === id) matches.push(node);
  });
  return matches.length === 1 ? matches[0] : null;
}

function attached(doc, element) {
  let found = false;
  walk(doc?.root, (node) => {
    if (node === element) found = true;
  });
  return found;
}

function ordinalForAnchor(doc, anchor) {
  let ordinal = 0;
  let found = false;
  walk(doc.root, (node) => {
    if (found || !isTeiElement(node, anchor.localName)) return;
    ordinal += 1;
    if (node === anchor) found = true;
  });
  return Math.max(1, ordinal);
}

function slug(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .toLowerCase();
}

function generatedAnchorId(doc, anchor, hint) {
  const discriminator = slug(hint || getUnqualifiedAttr(anchor, "n"))
    || String(ordinalForAnchor(doc, anchor));
  const base = `teicrafter-review-${slug(anchor.localName) || "unit"}-${discriminator}`;
  let candidate = base;
  let suffix = 2;
  while (findElementByXmlId(doc, candidate)) candidate = `${base}-${suffix++}`;
  return candidate;
}

function anchorCheck(doc, anchor) {
  if (!doc || !isTeiElement(anchor) || !attached(doc, anchor)) {
    return { ok: false, reason: "The review unit is not a TEI element in the current document." };
  }
  const id = getXmlId(anchor);
  if (!id) return { ok: true, id: null };
  if (!XML_ID.test(id)) {
    return { ok: false, reason: `The review unit has an invalid xml:id (${id}).` };
  }
  if (!findElementByXmlId(doc, id)) {
    return { ok: false, reason: `The review unit xml:id is not unique (${id}).` };
  }
  return { ok: true, id };
}

/** Ensure a stable, unique xml:id on one TEI review unit. */
export function ensureReviewAnchor(doc, anchor, { hint = null } = {}) {
  const check = anchorCheck(doc, anchor);
  if (!check.ok) return { doc, anchor, id: null, changed: false, ok: false, reason: check.reason };
  if (check.id) return { doc, anchor, id: check.id, changed: false, ok: true, reason: null };
  const id = generatedAnchorId(doc, anchor, hint);
  const next = addAttr(doc, anchor, "xml:id", id);
  const nextAnchor = next === doc ? null : findElementByXmlId(next, id);
  if (!nextAnchor) {
    return { doc, anchor, id: null, changed: false, ok: false, reason: "A stable xml:id could not be added to the review unit." };
  }
  return { doc: next, anchor: nextAnchor, id, changed: true, ok: true, reason: null };
}

function storagePlan(doc, anchor) {
  const header = headerElement(anchor);
  if (!header || header.selfClosing || header.contentEnd == null) {
    return { ok: false, reason: "A non-empty TEI header is required for review records." };
  }
  const revisions = directTeiChildren(header, "revisionDesc");
  if (revisions.length > 1) {
    return { ok: false, reason: "The TEI header has more than one revisionDesc." };
  }
  if (!revisions.length) return { ok: true, kind: "new-revision", container: header };

  const revision = revisions[0];
  const children = directTeiChildren(revision);
  if (!children.length || children.every((child) => child.localName === "change")) {
    return { ok: true, kind: "append", container: revision };
  }
  if (children.every((child) => child.localName === "listChange")) {
    return { ok: true, kind: "append", container: children[children.length - 1] };
  }
  if (children.every((child) => child.localName === "list")) {
    return {
      ok: false,
      reason: "This revisionDesc uses the TEI list form, which cannot be mixed with change records.",
    };
  }
  return { ok: false, reason: "The revisionDesc content model is ambiguous; review storage was left unchanged." };
}

/** Report whether this document and anchor can store a standard review record. */
export function canStoreReviewRecord(doc, anchor) {
  const anchorResult = anchorCheck(doc, anchor);
  if (!anchorResult.ok) return anchorResult;
  const plan = storagePlan(doc, anchor);
  return plan.ok ? { ok: true, reason: null } : plan;
}

function validatedDetails(options, existing = null) {
  const status = String(options.status || existing?.status || REVIEW_STATUS_VERIFIED).trim();
  const who = own(options, "who")
    ? normalizedTokens(options.who).join(" ")
    : existing?.who || DEFAULT_REVIEWER;
  const when = own(options, "when")
    ? String(options.when || "").trim()
    : existing?.when || new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const rationale = own(options, "rationale")
    ? String(options.rationale || "").trim()
    : existing?.rationale || DEFAULT_REVIEW_RATIONALE;
  if (!status || /\s/.test(status)) return { ok: false, reason: "Review status must be one XML token." };
  if (!who) return { ok: false, reason: "A review record requires a reviewer pointer in who." };
  if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(when)) {
    return { ok: false, reason: "A review record requires an ISO date or timestamp in when." };
  }
  return { ok: true, status, who, when, rationale };
}

function recordMarkup(context, id, details) {
  const name = qnameFor("change", context);
  return `<${name} type="${REVIEW_TYPE}" subtype="${escapeAttr(details.status)}" target="#${escapeAttr(id)}" who="${escapeAttr(details.who)}" when="${escapeAttr(details.when)}">${escapeText(details.rationale)}</${name}>`;
}

function appendRecord(doc, plan, id, details) {
  if (plan.kind === "new-revision") {
    const header = plan.container;
    const revisionName = qnameFor("revisionDesc", header);
    const changeName = qnameFor("change", header);
    const change = `<${changeName} type="${REVIEW_TYPE}" subtype="${escapeAttr(details.status)}" target="#${escapeAttr(id)}" who="${escapeAttr(details.who)}" when="${escapeAttr(details.when)}">${escapeText(details.rationale)}</${changeName}>`;
    if (isMultilineContainer(doc, header) || /\r?\n/.test(trailingWhitespace(doc, header))) {
      const revisionIndent = childIndent(doc, header);
      const nl = newlineOf(doc);
      return appendChild(doc, header, `<${revisionName}>${nl}${revisionIndent}  ${change}${nl}${revisionIndent}</${revisionName}>`);
    }
    return appendChild(doc, header, `<${revisionName}>${change}</${revisionName}>`);
  }
  return appendChild(doc, plan.container, recordMarkup(plan.container, id, details));
}

function recordsForId(doc, id, status) {
  return readReviewRecords(doc, { status }).filter((record) => record.targetIds.includes(id));
}

function targetsOtherThan(record, id) {
  return record.targets.filter((target) => target !== `#${id}`);
}

function updatedRecord(doc, record, id, details) {
  if (targetsOtherThan(record, id).length) return null;
  const set = {
    type: REVIEW_TYPE,
    subtype: details.status,
    target: `#${id}`,
    who: details.who,
    when: details.when,
  };
  if (record.rationale === details.rationale) {
    return editTextAndAttrs(doc, record.element, { set });
  }
  const children = record.element.children || [];
  if (!(children.length === 1 && children[0].type === "text")) return null;
  return editTextAndAttrs(doc, record.element, { text: details.rationale, set });
}

function sameDetails(record, details) {
  return record.status === details.status
    && record.who === details.who
    && record.when === details.when
    && record.rationale === details.rationale;
}

function result(original, doc, id, status, reason = null) {
  const record = id ? recordsForId(doc, id, status).at(-1) || null : null;
  return { doc, record, anchorId: id, changed: doc !== original, ok: !reason, reason };
}

/**
 * Set one TEI unit's review record. Existing complete records are idempotent;
 * explicit detail changes preserve unrelated attributes on the change element.
 */
export function setReviewRecord(doc, anchor, options = {}) {
  const original = doc;
  const plan = storagePlan(doc, anchor);
  if (!plan.ok) return result(original, original, null, options.status || REVIEW_STATUS_VERIFIED, plan.reason);
  const anchored = ensureReviewAnchor(doc, anchor, { hint: options.hint });
  if (!anchored.ok) return result(original, original, null, options.status || REVIEW_STATUS_VERIFIED, anchored.reason);
  doc = anchored.doc;
  const id = anchored.id;
  const status = String(options.status || REVIEW_STATUS_VERIFIED).trim();
  const existing = recordsForId(doc, id, status).at(-1) || null;
  const details = validatedDetails(options, existing);
  if (!details.ok) return result(original, original, null, status, details.reason);

  if (existing) {
    if (sameDetails(existing, details)) return result(original, doc, id, details.status);
    const updated = updatedRecord(doc, existing, id, details);
    if (updated) return result(original, updated, id, details.status);
    const remaining = targetsOtherThan(existing, id);
    if (remaining.length) {
      const separated = editTextAndAttrs(doc, existing.element, { set: { target: remaining.join(" ") } });
      if (separated === doc) {
        return result(original, original, null, status, "The shared review record could not be separated safely.");
      }
      const separatedAnchor = findElementByXmlId(separated, id);
      const nextPlan = storagePlan(separated, separatedAnchor);
      if (!nextPlan.ok) return result(original, original, null, status, nextPlan.reason);
      return result(original, appendRecord(separated, nextPlan, id, details), id, details.status);
    }
    return result(original, original, null, status, "The existing review rationale contains structured markup and was left unchanged.");
  }

  const nextPlan = storagePlan(doc, anchored.anchor);
  if (!nextPlan.ok) return result(original, original, null, status, nextPlan.reason);
  return result(original, appendRecord(doc, nextPlan, id, details), id, details.status);
}

function whitespaceOnly(doc, node) {
  return node.type === "text" && /^\s*$/.test(doc.raw.slice(node.start, node.end));
}

function removableScope(doc, record) {
  let current = record.element;
  let parent = current.parent;
  while (isTeiElement(parent) && ["listChange", "revisionDesc"].includes(parent.localName)) {
    const structural = directTeiChildren(parent).filter((child) => (
      parent.localName === "listChange"
        ? ["change", "listChange"].includes(child.localName)
        : ["change", "listChange", "list"].includes(child.localName)
    ));
    const siblings = structural.filter((child) => child !== current);
    if (siblings.length) return current;
    const otherContent = (parent.children || []).filter((node) => node !== current);
    const clean = !(parent.attrs || []).length && otherContent.every((node) => whitespaceOnly(doc, node));
    if (!clean) return null;
    current = parent;
    parent = current.parent;
  }
  return current;
}

function removeElement(doc, element) {
  let start = element.outerStart;
  if (start == null || element.outerEnd == null) return doc;
  const lineStart = doc.raw.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
  if (/^[\t ]*$/.test(doc.raw.slice(lineStart, start)) && lineStart > 0) {
    start = lineStart - 1;
    if (start > 0 && doc.raw[start - 1] === "\r") start -= 1;
  }
  return spliceDocument(doc, start, element.outerEnd, "");
}

/** Clear all review records with this status for one anchored TEI unit. */
export function clearReviewRecords(doc, anchor, { status = REVIEW_STATUS_VERIFIED } = {}) {
  const original = doc;
  const checked = anchorCheck(doc, anchor);
  if (!checked.ok) return result(original, original, null, status, checked.reason);
  const id = checked.id;
  if (!id) return result(original, original, null, status);

  const initial = recordsForId(doc, id, status);
  for (const record of initial) {
    if (!targetsOtherThan(record, id).length && !removableScope(doc, record)) {
      return result(original, original, id, status, "Removing this record would discard or invalidate other revision data.");
    }
  }

  while (true) {
    const record = recordsForId(doc, id, status).at(-1);
    if (!record) break;
    const remaining = targetsOtherThan(record, id);
    if (remaining.length) {
      const next = editTextAndAttrs(doc, record.element, { set: { target: remaining.join(" ") } });
      if (next === doc) return result(original, original, id, status, "The shared review target could not be cleared safely.");
      doc = next;
      continue;
    }
    const scope = removableScope(doc, record);
    if (!scope) return result(original, original, id, status, "The review record could not be cleared without data loss.");
    doc = removeElement(doc, scope);
  }
  return result(original, doc, id, status);
}

/** Latest verified record for one uniquely identified TEI unit. */
export function reviewRecordForAnchor(doc, anchor, status = REVIEW_STATUS_VERIFIED) {
  const checked = anchorCheck(doc, anchor);
  if (!checked.ok || !checked.id) return null;
  return recordsForId(doc, checked.id, status).at(-1) || null;
}
