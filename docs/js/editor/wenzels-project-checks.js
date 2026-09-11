import { getAttr, getXmlId, isTeiElement, teiElementsByLocal, spliceDocument, textOf, walk } from "./tei-document.js";
import { parseWenzelsRegisterTarget, readWenzelsRegisters, readWenzelsRegisterLinks } from "./wenzels-register-model.js";
import { readImageAnnotations } from "./wenzels-image-model.js";
import { children, contentText, idIndex, requireId } from "./wenzels-xml.js";

export function checkWenzelsRegisters({ registers, codex = null, images = null, name = "registers.xml" }) {
  const entries = readWenzelsRegisters(registers);
  const identities = idIndex(registers);
  const byId = new Map();
  for (const entry of entries) {
    if (!byId.has(entry.id)) byId.set(entry.id, []);
    byId.get(entry.id).push(entry);
  }
  const issues = [];
  const checkPointer = (pointer, context, kind) => {
    let path = "";
    let id;
    try {
      if (pointer.startsWith("#")) id = requireId(pointer);
      else ({ path, id } = parseWenzelsRegisterTarget(pointer));
    } catch {
      issues.push(`${context}: ${pointer} is not a valid register pointer.`);
      return;
    }
    if (path && path !== name) { issues.push(`${context}: ${pointer} refers to an unattached register file.`); return; }
    const matches = byId.get(id) || [];
    if (matches.length !== 1) issues.push(`${context}: ${pointer} has ${matches.length} matching register entries.`);
    else if (identities.get(id) !== matches[0].node) issues.push(`${context}: ${pointer} has an ambiguous XML identifier.`);
    else if (kind && matches[0].kind !== kind) issues.push(`${context}: ${pointer} belongs to ${matches[0].kind}, expected ${kind}.`);
  };
  const check = (value, context, kind = null) => {
    const pointers = String(value || "").trim().split(/\s+/).filter(Boolean);
    if (!pointers.length) { issues.push(`${context}: a register pointer is missing.`); return; }
    for (const pointer of pointers) checkPointer(pointer, context, kind);
  };
  for (const [id, node] of identities) if (node === null) issues.push(`Register document ID ${id} is duplicated.`);
  for (const entry of entries) if (!entry.id) issues.push(`Register entry ${entry.name || "(unnamed)"} has no XML ID.`);
  if (codex) for (const link of readWenzelsRegisterLinks(codex)) check(link.target, `Text link ${link.id || link.key}`);
  if (images) {
    const inventory = readImageAnnotations(images);
    issues.push(...inventory.issues.map((issue) => issue.message));
    const itemNodes = new Map(teiElementsByLocal(images.root, "list").filter((list) => getAttr(list, "type") === "image-annotations")
      .flatMap((list) => children(list, "item")).map((item) => [getXmlId(item), item]));
    for (const item of inventory.items) {
      for (const pointer of item.persons) check(pointer, `Image ${item.id}`, "person");
      const list = children(itemNodes.get(item.id), "listPlace").find((node) => getAttr(node, "type") === "related");
      const places = children(list, "place");
      item.places.forEach((pointer, index) => {
        const place = places[index];
        const descriptive = getAttr(place, "corresp") == null
          && children(place, "desc").some((description) => contentText(images, description).trim());
        if (!pointer && descriptive) return;
        check(pointer, `Image ${item.id}`, "place");
      });
    }
  }
  return issues;
}

export function referencesRegisterId(doc, id, filename) {
  let found = false;
  walk(doc.root, (node) => {
    if (found || node.type !== "element") return;
    found = (node.attrs || []).some((attr) => attr.value.split(/\s+/).some((value) => value === `#${id}` || value === `${filename}#${id}`));
  });
  return found;
}

export function singleBranchChoices(doc) {
  return teiElementsByLocal(doc.root, "choice").filter((node) =>
    (node.children || []).filter((child) => child.type === "element").length === 1);
}

/** Explicit structural repair keeps the only encoded alternative and its exact bytes. */
export function keepSingleChoiceBranch(doc, choice) {
  if (!singleBranchChoices(doc).includes(choice) || choice.attrs.length) throw new Error("Use XML source to review this choice and its attributes.");
  const child = choice.children.find((node) => node.type === "element");
  if (!isTeiElement(child) || !["sic", "corr", "orig", "reg", "abbr", "expan"].includes(child.localName)) throw new Error("This choice needs XML source review.");
  if ((choice.children || []).some((node) => (node.type === "text" || node.type === "cdata") && textOf(doc, node).trim())) throw new Error("This choice contains additional text and needs XML source review.");
  return spliceDocument(doc, choice.outerStart, choice.outerEnd, doc.raw.slice(choice.contentStart, choice.contentEnd));
}

export function choiceLabel(choice) {
  const child = choice.children.find((node) => node.type === "element");
  return getXmlId(choice) || getXmlId(child) || `${child.localName} at source offset ${choice.outerStart}`;
}
