/** Source-backed commentary, Bible references and word readings for Wenzelsbibel. */
import {
  escapeAttr, escapeText, getUnqualifiedAttr, getXmlId, isReadingContext, isReadingText, isTeiElement,
  qualifyTeiMarkup, teiElementsByLocal, textNodes, textOf, walk,
} from "./tei-document.js";
import { readingCellVisible } from "./reading-policy.js";
import {
  appendChild, applyEdits, attr, children, contentText, has, idIndex, newId, noteXml,
  patchAttribute, patchNotes, patchText, readNotes, removeRecord, requireId, resolveRecord, topLevelStandOff,
} from "./wenzels-xml.js";

const COMMENT_TYPES = new Set(["comment_edition", "comment_understanding"]);
const indexes = new WeakMap();

function indexFor(doc) {
  if (!indexes.has(doc)) indexes.set(doc, idIndex(doc));
  return indexes.get(doc);
}

export function readWenzelsWords(doc) {
  return teiElementsByLocal(doc.root, "w").filter(isReadingContext).map((node) => {
    const text = contentText(doc, node);
    const projected = (variant) => textNodes(node).filter((textNode) => readingCellVisible({ node: textNode }, variant))
      .map((textNode) => textOf(doc, textNode)).join("");
    const original = getUnqualifiedAttr(node, "orig");
    return { id: getXmlId(node), node, text, dipl: original ?? projected("dipl"),
      norm: getUnqualifiedAttr(node, "norm") ?? original ?? projected("norm"), start: node.outerStart, end: node.outerEnd };
  });
}

export function updateWenzelsWord(doc, id, patch) {
  const node = indexFor(doc).get(requireId(id));
  if (!isTeiElement(node, "w") || !isReadingContext(node)) throw new Error("Select an unambiguous transcription word.");
  const edits = [];
  if (has(patch, "text")) patchText(doc, node, patch.text, edits);
  if (has(patch, "dipl")) patchAttribute(doc, node, "orig", patch.dipl, edits);
  if (has(patch, "norm")) patchAttribute(doc, node, "norm", patch.norm, edits);
  return applyEdits(doc, edits);
}

export function wenzelsWordRange(doc, selection) {
  const from = requireId(selection?.from);
  const to = requireId(selection?.to || from);
  const index = indexFor(doc);
  const first = index.get(from);
  const last = index.get(to);
  if (!isTeiElement(first, "w") || !isTeiElement(last, "w")
    || !isReadingContext(first) || !isReadingContext(last) || first.outerStart > last.outerStart) {
    throw new Error("Select existing words in source order with unique XML identifiers.");
  }
  return { from: `#${from}`, to: `#${to}`, start: first.outerStart, end: last.outerEnd };
}

function boundaryContext(doc, offset) {
  let context = null;
  walk(doc.root, (node) => {
    if (isTeiElement(node) && isReadingContext(node)) {
      if (node.outerStart === offset || node.outerEnd === offset) context ||= node.parent;
    }
    if (node.type !== "text" || !isReadingText(node) || offset < node.start || offset > node.end) return;
    const prefix = doc.raw.slice(node.start, offset);
    if (prefix.lastIndexOf("&") > prefix.lastIndexOf(";")) return;
    const before = doc.raw.charCodeAt(offset - 1);
    const after = doc.raw.charCodeAt(offset);
    if (before >= 0xD800 && before <= 0xDBFF && after >= 0xDC00 && after <= 0xDFFF) return;
    context = node.parent;
  });
  return isTeiElement(context) ? context : null;
}

function exactRange(doc, selection) {
  const range = selection?.from ? wenzelsWordRange(doc, selection) : {
    start: Number(selection?.start), end: Number(selection?.end),
  };
  if (!Number.isInteger(range.start) || !Number.isInteger(range.end) || range.start >= range.end) {
    throw new Error("Select a nonempty source range.");
  }
  const firstContext = boundaryContext(doc, range.start);
  const lastContext = boundaryContext(doc, range.end);
  if (!firstContext || !lastContext) throw new Error("The selection must end at exact transcription boundaries.");
  return { ...range, firstContext, lastContext };
}

function resolvedRange(doc, from, to) {
  if (!/^#[^#\s]+$/.test(from || "") || !/^#[^#\s]+$/.test(to || "")) return { start: null, end: null };
  const index = indexFor(doc);
  const first = index.get(String(from || "").replace(/^#/, ""));
  const last = index.get(String(to || "").replace(/^#/, ""));
  if (!isTeiElement(first) || !isTeiElement(last) || !isReadingContext(first) || !isReadingContext(last)) return { start: null, end: null };
  const start = isTeiElement(first, "anchor") ? first.outerEnd : first.outerStart;
  const end = isTeiElement(last, "anchor") ? last.outerStart : last.outerEnd;
  return start <= end ? { start, end } : { start: null, end: null };
}

function recordBase(doc, node, index) {
  const id = getXmlId(node);
  const from = attr(node, "from");
  const to = attr(node, "to");
  const range = resolvedRange(doc, from, to);
  return { id, key: id || `${node.localName}:${index}:${from}:${to}`, node, from, to,
    ...range, issues: range.start == null ? ["The source range has missing, ambiguous or reversed endpoints."] : [] };
}

/** Append to a TEI-level container without rewriting its existing children. */
export function appendWenzelsStandOff(doc, name, type, fragment, edits) {
  const standOff = topLevelStandOff(doc);
  const container = children(standOff, name).find((node) => !type || attr(node, "type") === type);
  if (container) { appendChild(doc, container, fragment, edits); return; }
  const block = `<${name}${type ? ` type="${escapeAttr(type)}"` : ""}>${fragment}</${name}>`;
  if (standOff) { appendChild(doc, standOff, block, edits); return; }
  const root = children(doc.root, "TEI")[0];
  if (!root || root.selfClosing) throw new Error("A TEI document element is required.");
  const header = children(root, "teiHeader")[0];
  const at = header ? header.outerEnd : root.contentStart;
  const qualified = qualifyTeiMarkup(`<standOff>${block}</standOff>`, root);
  edits.push({ start: at, end: at, text: qualified });
}

export function readWenzelsComments(doc) {
  const apps = children(topLevelStandOff(doc), "listApp")
    .flatMap((list) => children(list, "app"));
  return apps.map((node, index) => ({ ...recordBase(doc, node, index), type: attr(node, "type"), notes: readNotes(doc, node) }));
}

export function createWenzelsComment(doc, selection, options = {}) {
  const type = options.type || "comment_edition";
  if (!COMMENT_TYPES.has(type)) throw new Error("Choose an editorial or comprehension comment.");
  if (!Array.isArray(options.notes) || !options.notes.some((note) => String(note.text || "").trim())) {
    throw new Error("Enter at least one comment note.");
  }
  const range = exactRange(doc, selection);
  const id = newId(doc, options.id, "wb-comment");
  const from = newId(doc, null, `${id}-from`);
  const to = newId(doc, null, `${id}-to`);
  const edits = [
    { start: range.start, end: range.start, text: qualifyTeiMarkup(`<anchor xml:id="${escapeAttr(from)}"/>`, range.firstContext) },
    { start: range.end, end: range.end, text: qualifyTeiMarkup(`<anchor xml:id="${escapeAttr(to)}"/>`, range.lastContext) },
  ];
  const fragment = `<app xml:id="${escapeAttr(id)}" type="${type}" from="#${escapeAttr(from)}" to="#${escapeAttr(to)}">${options.notes.map(noteXml).join("")}</app>`;
  appendWenzelsStandOff(doc, "listApp", null, fragment, edits);
  return applyEdits(doc, edits);
}

export function updateWenzelsComment(doc, recordOrId, patch = {}) {
  const record = resolveRecord(doc, readWenzelsComments(doc), recordOrId);
  const edits = [];
  if (has(patch, "from") || has(patch, "to")) {
    const from = `#${requireId(has(patch, "from") ? patch.from : record.from)}`;
    const to = `#${requireId(has(patch, "to") ? patch.to : record.to)}`;
    const index = indexFor(doc);
    const first = index.get(from.slice(1));
    const last = index.get(to.slice(1));
    if (!isTeiElement(first, "anchor") || !isTeiElement(last, "anchor")
      || !isReadingContext(first) || !isReadingContext(last) || first.outerEnd >= last.outerStart) {
      throw new Error("Choose existing unique transcription anchors in source order.");
    }
    patchAttribute(doc, record.node, "from", from, edits);
    patchAttribute(doc, record.node, "to", to, edits);
  }
  if (has(patch, "type")) {
    if (patch.type !== record.type) {
      if (!String(patch.type || "").trim()) throw new Error("Enter a comment type.");
      patchAttribute(doc, record.node, "type", patch.type, edits);
    }
  }
  if (has(patch, "notes")) patchNotes(doc, record.node, patch.notes, edits);
  if (edits.length && !record.id) patchAttribute(doc, record.node, "xml:id", newId(doc, null, "wb-comment"), edits);
  return applyEdits(doc, edits);
}

export function removeWenzelsComment(doc, recordOrId) {
  return removeRecord(doc, resolveRecord(doc, readWenzelsComments(doc), recordOrId));
}

export function readBibleVerseMappings(doc) {
  const spans = children(topLevelStandOff(doc), "spanGrp").filter((group) => attr(group, "type") === "bible-verses")
    .flatMap((group) => children(group, "span"));
  return spans.map((node, index) => {
    const ref = children(node, "ref").find((child) => attr(child, "type") === "vulgate");
    const quote = verseQuote(node);
    const notes = readNotes(doc, node).filter((note) => attr(note.node, "type") !== "vulgate");
    return { ...recordBase(doc, node, index), reference: attr(node, "n"), cRef: attr(ref, "cRef"),
      quote: quote ? contentText(doc, quote) : "", note: notes[0]?.text || "",
      notes, resp: attr(node, "resp") };
  });
}

function verseQuote(node) {
  const container = children(node, "note").find((note) => attr(note, "type") === "vulgate");
  return children(container, "quote")[0] || children(node, "quote")[0];
}

function verseQuoteXml(text) {
  return `<note type="vulgate"><quote xml:lang="la">${escapeText(text)}</quote></note>`;
}

function verseReference(value) {
  const reference = String(value || "").trim();
  if (!reference) throw new Error("Enter a Bible verse reference.");
  return reference;
}

export function addBibleVerseMapping(doc, selection, options = {}) {
  const range = wenzelsWordRange(doc, selection);
  const reference = verseReference(options.reference);
  const id = newId(doc, options.id, "wb-verse");
  const responsibility = options.resp ? ` resp="${escapeAttr(options.resp)}"` : "";
  const quote = options.quote ? verseQuoteXml(options.quote) : "";
  const note = options.note ? noteXml({ text: options.note }) : "";
  const fragment = `<span xml:id="${escapeAttr(id)}" from="${escapeAttr(range.from)}" to="${escapeAttr(range.to)}" n="${escapeAttr(reference)}"${responsibility}><ref type="vulgate" cRef="${escapeAttr(options.cRef || reference)}">${escapeText(reference)}</ref>${quote}${note}</span>`;
  const edits = [];
  appendWenzelsStandOff(doc, "spanGrp", "bible-verses", fragment, edits);
  return applyEdits(doc, edits);
}

export function updateBibleVerseMapping(doc, recordOrId, patch = {}) {
  const record = resolveRecord(doc, readBibleVerseMappings(doc), recordOrId);
  const edits = [];
  const ref = children(record.node, "ref").find((child) => attr(child, "type") === "vulgate");
  if (has(patch, "from") || has(patch, "to")) {
    const range = wenzelsWordRange(doc, { from: patch.from || record.from, to: patch.to || record.to });
    patchAttribute(doc, record.node, "from", range.from, edits);
    patchAttribute(doc, record.node, "to", range.to, edits);
  }
  if (has(patch, "reference")) {
    const reference = verseReference(patch.reference);
    patchAttribute(doc, record.node, "n", reference, edits);
    if (ref) patchText(doc, ref, reference, edits);
  }
  if ((has(patch, "cRef") && patch.cRef !== record.cRef)
    || (!ref && has(patch, "reference") && patch.reference !== record.reference)) {
    const canonical = verseReference(patch.cRef || patch.reference || record.reference);
    if (ref) patchAttribute(doc, ref, "cRef", canonical, edits);
    else appendChild(doc, record.node, `<ref type="vulgate" cRef="${escapeAttr(canonical)}">${escapeText(patch.reference || record.reference)}</ref>`, edits);
  }
  if (has(patch, "resp")) patchAttribute(doc, record.node, "resp", patch.resp || null, edits);
  if (has(patch, "quote")) {
    const quote = verseQuote(record.node);
    if (quote) patchText(doc, quote, patch.quote, edits);
    else if (patch.quote) appendChild(doc, record.node, verseQuoteXml(patch.quote), edits);
  }
  if (has(patch, "notes")) patchNotes(doc, record.node, patch.notes, edits);
  else if (has(patch, "note") && (record.notes.length || patch.note)) patchNotes(doc, record.node, [{
    index: record.notes[0]?.index ?? children(record.node, "note").length, text: patch.note,
  }], edits);
  return applyEdits(doc, edits);
}

export function removeBibleVerseMapping(doc, recordOrId) {
  return removeRecord(doc, resolveRecord(doc, readBibleVerseMappings(doc), recordOrId));
}
