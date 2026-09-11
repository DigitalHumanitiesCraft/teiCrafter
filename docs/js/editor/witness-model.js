import { escapeAttr, escapeText, getAttrInNamespace, getXmlId, isReadingContext, isTeiElement, walk } from "./tei-document.js";
import {
  appendChild, applyEdits, assertCurrent, attr, children, contentText, has, idIndex,
  newId, patchAttribute, patchText, requireId, resolveRecord,
} from "./wenzels-xml.js";

const inventories = new WeakMap();
const apparatusCache = new WeakMap();
const readingNames = new Set(["lem", "rdg"]);
const fragmentNames = new Set(["lacunaStart", "lacunaEnd", "witStart", "witEnd"]);
const pointers = (value) => String(value || "").trim().split(/\s+/).filter(Boolean);
function localId(pointer) {
  if (!pointer.startsWith("#")) return "";
  try { return decodeURIComponent(pointer.slice(1)); } catch { return ""; }
}
function externalBase(node) {
  for (let current = node; current; current = current.parent) {
    if (getAttrInNamespace(current, "http://www.w3.org/XML/1998/namespace", "base")) return true;
  }
  return false;
}
const key = (node) => `offset:${node.outerStart}`;
const scalar = (node) => (node.children || []).every((child) => ["text", "cdata"].includes(child.type));
const isWithin = (node, ancestor) => {
  for (let current = node; current; current = current.parent) if (current === ancestor) return true;
  return false;
};

/** Grouping is structural; rdgGrp does not inherit the @wit attribute in TEI. */
export function apparatusReadings(app) {
  if (apparatusCache.has(app)) return apparatusCache.get(app);
  const readings = [];
  const visit = (node) => {
    for (const child of children(node)) {
      if (readingNames.has(child.localName)) readings.push(child);
      else if (child.localName === "rdgGrp") visit(child);
    }
  };
  visit(app);
  apparatusCache.set(app, readings);
  return readings;
}

/** Retain all XML while exposing explicit witness identities and attestations. */
export function witnessInventory(doc) {
  if (inventories.has(doc)) return inventories.get(doc);
  const ids = idIndex(doc);
  const witnesses = [], lists = [], apparatus = [], references = [];
  walk(doc.root, (node) => {
    if (!isTeiElement(node)) return;
    if (node.localName === "listWit") lists.push({ key: key(node), id: getXmlId(node) || "", node,
      label: contentText(doc, children(node, "head")[0] || { children: [] }).trim() || getXmlId(node) || "Witness list" });
    if (node.localName === "witness") witnesses.push({ key: key(node), id: getXmlId(node) || "", node,
      description: contentText(doc, node), editable: scalar(node), kind: "witness" });
    if (node.localName === "app") apparatus.push({ key: key(node), id: getXmlId(node) || "", node,
      inline: isReadingContext(node) && !!ancestor(node, "text") && !ancestor(node, "listApp"),
      readings: apparatusReadings(node) });
    if (attr(node, "wit")) references.push({ node, targets: pointers(attr(node, "wit")), externalBase: externalBase(node) });
  });
  const targets = new Set(references.flatMap((item) => item.targets));
  for (const target of targets) {
    if (!localId(target)) continue;
    const node = ids.get(localId(target));
    if (node && isTeiElement(node) && ["bibl", "msDesc", "biblStruct"].includes(node.localName)) {
      if (!witnesses.some((item) => item.node === node)) witnesses.push({ key: key(node), id: getXmlId(node), node,
        description: contentText(doc, node), editable: false, kind: node.localName });
    }
  }
  for (const witness of witnesses) {
    witness.unique = !!witness.id && ids.get(witness.id) === witness.node;
    witness.groups = [];
    for (let parent = witness.node.parent; parent; parent = parent.parent) {
      if (isTeiElement(parent) && ["listWit", "witness"].includes(parent.localName) && getXmlId(parent)) witness.groups.push(getXmlId(parent));
    }
    witness.references = references.filter((ref) => ref.targets.some((target) => localId(target) === witness.id
      || witness.groups.includes(localId(target)))).length;
  }
  const unresolved = [...targets].filter((target) => references.some((ref) => ref.externalBase && ref.targets.includes(target))
    || !ids.get(localId(target)) || !["witness", "listWit", "bibl", "biblStruct", "msDesc"].some((name) => isTeiElement(ids.get(localId(target)), name)));
  const result = { witnesses, lists, apparatus, references, unresolved, ids };
  inventories.set(doc, result);
  return result;
}

function ancestor(node, name) {
  for (let current = node.parent; current; current = current.parent) if (isTeiElement(current, name)) return current;
  return null;
}

/** Protect every descendant identity, including URI-fragment references in unknown markup. */
export function witnessReferenceUses(doc, node) {
  assertCurrent(doc, node);
  const ids = new Set();
  walk(node, (child) => { if (child.type === "element" && getXmlId(child)) ids.add(getXmlId(child)); });
  const uses = [];
  walk(doc.root, (candidate) => {
    if (candidate.type !== "element" || isWithin(candidate, node)) return;
    for (const attribute of candidate.attrs || []) for (const token of pointers(attribute.value)) {
      const fragment = token.includes("#") ? token.slice(token.lastIndexOf("#") + 1) : "";
      let decoded = fragment;
      try { decoded = decodeURIComponent(fragment); } catch { /* Keep malformed references visible. */ }
      if (ids.has(decoded)) uses.push({ node: candidate, attribute, target: decoded });
    }
  });
  return uses;
}

function mutableWitness(doc, witnessOrKey) {
  const record = resolveRecord(doc, witnessInventory(doc).witnesses, witnessOrKey);
  if (record.kind !== "witness") throw new Error("This witness uses a bibliographic description. Edit its exact XML.");
  return record;
}

export function updateWitness(doc, witnessOrKey, changes) {
  const record = mutableWitness(doc, witnessOrKey);
  const edits = [];
  if (has(changes, "id") && changes.id !== record.id) {
    const id = newId(doc, requireId(changes.id), "witness");
    if (witnessReferenceUses(doc, record.node).length) throw new Error("This witness is referenced. Its identifier cannot be changed until those references are updated.");
    patchAttribute(doc, record.node, "xml:id", id, edits);
  }
  if (has(changes, "description")) patchText(doc, record.node, changes.description, edits);
  return applyEdits(doc, edits);
}

/** Exact XML editing is checked in the complete namespace and document context. */
export function updateWitnessXml(doc, witnessOrKey, xml, wellFormed) {
  const record = resolveRecord(doc, witnessInventory(doc).witnesses, witnessOrKey);
  const value = String(xml);
  if (value === doc.raw.slice(record.node.outerStart, record.node.outerEnd)) return doc;
  if (typeof wellFormed !== "function") throw new Error("A complete XML well-formedness check is required.");
  const next = applyEdits(doc, [{ start: record.node.outerStart, end: record.node.outerEnd, text: value }]);
  const checked = wellFormed(next.raw);
  if (checked?.ok !== true) throw new Error(checked?.message || "The witness edit is not well-formed XML.");
  let replacement = null;
  walk(next.root, (node) => {
    if (isTeiElement(node, record.node.localName) && node.outerStart === record.node.outerStart) replacement = node;
  });
  if (!replacement || replacement.outerEnd !== record.node.outerStart + value.length) {
    throw new Error(`Replace exactly the selected TEI ${record.node.localName} element, including its opening and closing tags.`);
  }
  const ids = idIndex(next);
  walk(replacement, (node) => {
    const id = node.type === "element" && getXmlId(node);
    if (id && ids.get(id) !== node) throw new Error(`The identifier ${id} is duplicated.`);
  });
  const uses = witnessReferenceUses(doc, record.node);
  if (uses.some((use) => !ids.get(use.target) || use.target === record.id && getXmlId(replacement) !== record.id)) {
    throw new Error("The XML edit removes or changes an identifier referenced outside this witness.");
  }
  return next;
}

export function updateReadingWitnesses(doc, apparatusOrKey, readingOrKey, value) {
  const inventory = witnessInventory(doc);
  const app = resolveRecord(doc, inventory.apparatus, apparatusOrKey);
  const reading = resolveRecord(doc, app.readings.map((node) => ({ key: key(node), id: getXmlId(node) || "", node })), readingOrKey);
  const previous = pointers(attr(reading.node, "wit")), targets = pointers(value);
  if (new Set(previous).size === new Set(targets).size && previous.every((target) => targets.includes(target))) return doc;
  if (new Set(targets).size !== targets.length) throw new Error("List each witness pointer only once.");
  for (const target of targets) {
    if (previous.includes(target)) continue;
    const node = inventory.ids.get(localId(target));
    if (externalBase(reading.node) || !node || !["witness", "listWit", "bibl", "biblStruct", "msDesc"].some((name) => isTeiElement(node, name))) {
      throw new Error(`The new witness pointer ${target} needs a unique local definition without an external XML base. Use exact XML for external references.`);
    }
  }
  const edits = [];
  patchAttribute(doc, reading.node, "wit", targets.length ? targets.join(" ") : null, edits);
  return applyEdits(doc, edits);
}

export function createWitness(doc, { id = "", description = "", listKey = "" } = {}) {
  const inventory = witnessInventory(doc);
  const identifier = newId(doc, requireId(id), "witness");
  if (!String(description).trim()) throw new Error("Enter a witness description.");
  const fragment = `<witness xml:id="${escapeAttr(identifier)}">${escapeText(description)}</witness>`;
  const edits = [];
  if (listKey || inventory.lists.length === 1) {
    const list = resolveRecord(doc, inventory.lists, listKey || inventory.lists[0]);
    appendChild(doc, list.node, fragment, edits);
  } else if (inventory.lists.length) throw new Error("Choose the witness list for this entry.");
  else {
    const tei = children(doc.root, "TEI");
    const source = tei.length === 1 && children(children(children(tei[0], "teiHeader")[0], "fileDesc")[0], "sourceDesc");
    if (!source || source.length !== 1) throw new Error("A unique TEI header sourceDesc is required to create a witness list. Prepare it in XML.");
    const paragraphs = children(source[0]).filter((node) => ["p", "ab"].includes(node.localName));
    appendChild(doc, paragraphs.at(-1) || source[0], `<listWit>${fragment}</listWit>`, edits);
  }
  return applyEdits(doc, edits);
}

export function deleteWitness(doc, witnessOrKey) {
  const record = mutableWitness(doc, witnessOrKey);
  let target = record.node;
  if (witnessReferenceUses(doc, target).length) throw new Error("This witness or its description is referenced and cannot be removed.");
  for (let group = target.parent; group; group = group.parent) {
    if (isTeiElement(group, "listWit") && getXmlId(group)
      && witnessReferenceUses(doc, group).some((use) => use.target === getXmlId(group))) {
      throw new Error("This witness belongs to a referenced witness group and cannot be removed.");
    }
  }
  while (isTeiElement(target.parent, "listWit")) {
    const parent = target.parent;
    if (children(parent).some((child) => child !== target && ["witness", "listWit"].includes(child.localName))) break;
    const metadata = (parent.children || []).some((child) => child !== target
      && (child.type !== "text" || doc.raw.slice(child.start, child.end).trim()));
    if (metadata || (parent.attrs || []).some((attribute) => attribute.namespaceURI !== "http://www.w3.org/2000/xmlns/")) {
      throw new Error("Removing the last witness would leave a list with additional metadata. Edit its exact XML.");
    }
    if (witnessReferenceUses(doc, parent).length) throw new Error("The containing witness list is referenced and cannot be removed.");
    target = parent;
  }
  if (isTeiElement(target.parent, "sourceDesc") && !children(target.parent).some((child) => child !== target)) {
    throw new Error("The source description would be empty. Add a source description in XML before removing its last witness list.");
  }
  return applyEdits(doc, [{ start: target.outerStart, end: target.outerEnd, text: "" }]);
}

/** Missing attribution is not evidence that a witness agrees with the lemma. */
export function resolveWitnessReading(doc, app, witnessId = "") {
  const inventory = witnessInventory(doc);
  const record = app.node ? app : inventory.apparatus.find((item) => item.node === app);
  if (!record) throw new Error("The apparatus entry does not belong to this document.");
  const readings = record.readings;
  let matches;
  if (!witnessId) matches = [readings.find((node) => node.localName === "lem") || readings[0]].filter(Boolean);
  else {
    const witness = inventory.witnesses.find((item) => item.id === witnessId && item.unique);
    if (!witness) return { status: "unknown-witness", branch: null, matches: [], markers: [], message: "The selected witness has no unique local definition." };
    const accepted = new Set([witnessId, ...witness.groups.filter((id) => inventory.ids.get(id))]);
    matches = readings.filter((node) => !externalBase(node) && pointers(attr(node, "wit")).some((target) => accepted.has(localId(target))));
  }
  if (matches.length !== 1) return { status: matches.length ? "ambiguous" : "missing", branch: null, matches, markers: [],
    message: matches.length ? `${matches.length} readings are attributed to this witness. No reading is selected automatically.`
      : "No reading is explicitly attributed to this witness. Agreement with the base text is not assumed." };
  const branch = matches[0];
  const markers = [];
  let material = false;
  walk(branch, (node) => {
    if (isTeiElement(node) && fragmentNames.has(node.localName)) markers.push(node.localName);
    if (isTeiElement(node) && ["gap", "graphic", "g"].includes(node.localName)) material = true;
  });
  const empty = !contentText(doc, branch).trim() && !material;
  const status = empty ? markers.length ? "fragment-boundary" : "omission" : "selected";
  return { status, branch, matches, markers, message: status === "omission" ? "Explicit empty reading (omission)."
    : markers.length ? `Encoded fragment boundaries: ${markers.join(", ")}.`
      : witnessId ? "One explicitly attributed reading." : "Base text: the lemma, or the first reading when no lemma is encoded." };
}

const policyCache = new WeakMap();
export function witnessReadingPolicy(doc, witnessId = "") {
  let byWitness = policyCache.get(doc);
  if (!byWitness) { byWitness = new Map(); policyCache.set(doc, byWitness); }
  if (!byWitness.has(witnessId)) {
    const selections = new Map(witnessInventory(doc).apparatus.map((app) => [app.node, resolveWitnessReading(doc, app, witnessId)]));
    byWitness.set(witnessId, { witnessId, selections });
  }
  return byWitness.get(witnessId);
}
