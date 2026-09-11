/** Separate Wenzelsbibel authority registers and source-linked mentions. */
import { escapeAttr, escapeText, getXmlId, parseDocument } from "./tei-document.js";
import { appendWenzelsStandOff, wenzelsWordRange } from "./wenzels-text-model.js";
import {
  appendChild, applyEdits, assertUnreferenced, attr, children, contentText, has, idIndex, newId,
  patchAttribute, patchText, removeRecord, requireId, resolveRecord, topLevelStandOff,
} from "./wenzels-xml.js";

const KINDS = {
  person: { list: "listPerson", entry: "person", name: "persName" },
  place: { list: "listPlace", entry: "place", name: "placeName" },
  people: { list: "listOrg", type: "peoples", entry: "org", name: "orgName" },
};

export function createWenzelsRegistersDocument(options = {}) {
  return parseDocument(`<?xml version="1.0" encoding="UTF-8"?>\n<TEI xmlns="http://www.tei-c.org/ns/1.0"><teiHeader><fileDesc><titleStmt><title>${escapeText(options.title || "Wenzelsbibel registers")}</title></titleStmt><publicationStmt><p>Working register.</p></publicationStmt><sourceDesc><p>Editorial register records.</p></sourceDesc></fileDesc></teiHeader><text><body><p/></body></text></TEI>`);
}

export function readWenzelsRegisters(doc) {
  const result = [];
  for (const [kind, definition] of Object.entries(KINDS)) {
    const lists = children(topLevelStandOff(doc), definition.list)
      .filter((list) => !definition.type || attr(list, "type") === definition.type);
    for (const list of lists) {
      for (const node of children(list, definition.entry)) {
        if (kind === "people" && attr(node, "type") !== "people") continue;
        result.push({ id: getXmlId(node), node, kind,
          name: children(node, definition.name)[0] ? contentText(doc, children(node, definition.name)[0]) : "",
          authorities: children(node, "idno").map((idno) => ({ type: attr(idno, "type"), value: contentText(doc, idno), node: idno })),
        });
      }
    }
  }
  return result;
}

function entryName(value) {
  const name = String(value || "").trim();
  if (!name) throw new Error("Enter a register name.");
  return name;
}

function authorityXml(authority) {
  if (!String(authority.type || "").trim() || !String(authority.value || "").trim()) {
    throw new Error("Each authority identifier needs a type and a value.");
  }
  return `<idno type="${escapeAttr(authority.type)}">${escapeText(authority.value)}</idno>`;
}

export function createWenzelsRegisterEntry(doc, options) {
  const definition = KINDS[options?.kind];
  if (!definition) throw new Error("Choose a person, place or people register.");
  const name = entryName(options.name);
  const id = newId(doc, requireId(options.id), "wb-register");
  const type = options.kind === "people" ? ' type="people"' : "";
  const authorities = (options.authorities || []).map(authorityXml).join("");
  const fragment = `<${definition.entry} xml:id="${escapeAttr(id)}"${type}><${definition.name}>${escapeText(name)}</${definition.name}>${authorities}</${definition.entry}>`;
  const edits = [];
  appendWenzelsStandOff(doc, definition.list, definition.type || null, fragment, edits);
  return applyEdits(doc, edits);
}

export function updateWenzelsRegisterEntry(doc, recordOrId, patch = {}) {
  const record = resolveRecord(doc, readWenzelsRegisters(doc), recordOrId);
  const definition = KINDS[record.kind];
  const edits = [];
  if (has(patch, "name")) {
    const name = entryName(patch.name);
    const target = children(record.node, definition.name)[0];
    if (target) patchText(doc, target, name, edits);
    else appendChild(doc, record.node, `<${definition.name}>${escapeText(name)}</${definition.name}>`, edits);
  }
  if (has(patch, "authorities")) {
    if (!Array.isArray(patch.authorities)) throw new Error("Authority identifiers must be an array.");
    for (const authority of patch.authorities) {
      const matches = children(record.node, "idno").filter((node) => attr(node, "type") === authority.type);
      if (matches.length > 1) throw new Error("This authority type has several identifiers. Edit its XML to distinguish them.");
      const target = matches[0];
      if (authority.remove) {
        if (target) {
          assertUnreferenced(doc, target);
          edits.push({ start: target.outerStart, end: target.outerEnd, text: "" });
        }
      } else if (target) patchText(doc, target, authority.value, edits);
      else appendChild(doc, record.node, authorityXml(authority), edits);
    }
  }
  return applyEdits(doc, edits);
}

export function removeWenzelsRegisterEntry(doc, recordOrId) {
  return removeRecord(doc, resolveRecord(doc, readWenzelsRegisters(doc), recordOrId));
}

export function parseWenzelsRegisterTarget(value) {
  const target = String(value || "").trim();
  const match = /^([^#]+)#([^#]+)$/.exec(target);
  if (!match || !/^(?:[\p{L}\p{N}_.-]+\/)*[\p{L}\p{N}_.-]+\.xml$/u.test(match[1])
    || match[1].split("/").some((part) => part === "." || part === "..")) {
    throw new Error("Use a relative XML register path and identifier, such as registers.xml#Gott.");
  }
  return { target, path: match[1], id: requireId(match[2]) };
}

export function readWenzelsRegisterLinks(doc) {
  const groups = children(topLevelStandOff(doc), "spanGrp").filter((group) => attr(group, "type") === "register-links");
  return groups.flatMap((group) => children(group, "span")).map((node, index) => ({
    id: getXmlId(node), key: getXmlId(node) || `register-link:${index}`, node,
    from: attr(node, "from"), to: attr(node, "to"), target: attr(node, "ana"),
  }));
}

function checkedTarget(value, registersDoc) {
  const target = parseWenzelsRegisterTarget(value);
  if (registersDoc) {
    const node = idIndex(registersDoc).get(target.id);
    if (!node || !readWenzelsRegisters(registersDoc).some((record) => record.node === node)) {
      throw new Error("The register target must identify one existing register entry.");
    }
  }
  return target.target;
}

export function addWenzelsRegisterLink(doc, selection, options = {}) {
  const range = wenzelsWordRange(doc, selection);
  const target = checkedTarget(options.target, options.registersDoc);
  if (readWenzelsRegisterLinks(doc).some((link) => link.from === range.from && link.to === range.to && link.target === target)) return doc;
  const id = newId(doc, options.id, "wb-register-link");
  const fragment = `<span xml:id="${escapeAttr(id)}" from="${escapeAttr(range.from)}" to="${escapeAttr(range.to)}" ana="${escapeAttr(target)}"/>`;
  const edits = [];
  appendWenzelsStandOff(doc, "spanGrp", "register-links", fragment, edits);
  return applyEdits(doc, edits);
}

export function updateWenzelsRegisterLink(doc, recordOrId, patch = {}) {
  const record = resolveRecord(doc, readWenzelsRegisterLinks(doc), recordOrId);
  const edits = [];
  if (has(patch, "target")) patchAttribute(doc, record.node, "ana", checkedTarget(patch.target, patch.registersDoc), edits);
  if (has(patch, "from") || has(patch, "to")) {
    const range = wenzelsWordRange(doc, { from: patch.from || record.from, to: patch.to || record.to });
    patchAttribute(doc, record.node, "from", range.from, edits);
    patchAttribute(doc, record.node, "to", range.to, edits);
  }
  return applyEdits(doc, edits);
}

export function removeWenzelsRegisterLink(doc, recordOrId) {
  return removeRecord(doc, resolveRecord(doc, readWenzelsRegisterLinks(doc), recordOrId));
}
