/** Conservative vocabulary evidence for UI profiles; separate from validation. */

import {
  getUnqualifiedAttr,
  isElementInNamespace,
  isTeiElement,
  parseDocument,
  textNodes,
  walk,
} from "./tei-document.js";
import { schemaResourceGraph, schemaSourceText } from "./schema-validation.js";

const RNG = "http://relaxng.org/ns/structure/1.0";
const XSD = "http://www.w3.org/2001/XMLSchema";

const CAPABILITY_ELEMENTS = Object.freeze({
  pages: ["pb"],
  "corpus-members": ["teiCorpus"],
  entries: ["entry", "entryFree", "superEntry"],
  "speech-turns": ["u", "sp", "annotationBlock"],
  "dramatic-context": ["castList", "stage", "performance"],
  "token-analysis": ["w", "s", "fs"],
  "correspondence-metadata": ["correspDesc"],
  apparatus: ["app", "listApp"],
  "facsimile-resource": ["facsimile", "surface", "sourceDoc"],
  "source-document": ["sourceDoc"],
  tabular: ["table", "row", "cell"],
  "descriptive-records": ["biblFull", "msDesc"],
  verse: ["lg", "l"],
  "header-metadata": ["teiHeader"],
});

function capabilityAllowance(elements, closed) {
  const names = new Set(elements);
  return Object.fromEntries(Object.entries(CAPABILITY_ELEMENTS).flatMap(([id, candidates]) => {
    if (candidates.some((candidate) => names.has(candidate))) return [[id, true]];
    return closed ? [[id, false]] : [];
  }));
}

function descendants(node, predicate) {
  const out = [];
  walk(node, (candidate) => { if (predicate(candidate)) out.push(candidate); });
  return out;
}

function decodedText(doc, node) {
  return textNodes(node).map((text) => doc.raw.slice(text.start, text.end)).join("").trim();
}

/** Inspect a TEI ODD schemaSpec/moduleRef document. */
export function inspectOdd(raw) {
  const doc = parseDocument(String(raw));
  const modules = new Set();
  const elements = new Set();
  const excludedElements = new Set();
  const classes = new Set();
  const issues = [];
  walk(doc.root, (node) => {
    if (!isTeiElement(node)) return;
    const ident = getUnqualifiedAttr(node, "ident");
    const key = getUnqualifiedAttr(node, "key");
    if (node.localName === "moduleRef") {
      if (key) modules.add(key);
      for (const name of String(getUnqualifiedAttr(node, "include") || "").split(/\s+/).filter(Boolean)) {
        elements.add(name);
      }
      for (const name of String(getUnqualifiedAttr(node, "except") || "").split(/\s+/).filter(Boolean)) {
        excludedElements.add(name);
      }
    } else if (node.localName === "elementSpec" && ident) elements.add(ident);
    else if (node.localName === "elementRef" && key) elements.add(key);
    else if ((node.localName === "classSpec" && ident) || node.localName === "classRef") {
      if (ident || key) classes.add(ident || key);
    }
  });
  if (!modules.size && !elements.size && !classes.size) {
    issues.push({ code: "odd-empty", severity: "warning", message: "No ODD vocabulary declarations were found." });
  }
  return {
    kind: "odd",
    modules: [...modules].sort(),
    elements: [...elements].sort(),
    excludedElements: [...excludedElements].sort(),
    classes: [...classes].sort(),
    capabilities: capabilityAllowance(elements, false),
    completeness: modules.size ? "approximate" : "exact",
    issues,
  };
}

function withoutNegativeAllowances(profile) {
  return {
    ...profile,
    capabilities: Object.fromEntries(Object.entries(profile.capabilities || {})
      .filter(([, allowed]) => allowed === true)),
    completeness: "unknown",
  };
}

function inspectRelaxNgDocuments(rawDocuments, dependenciesResolved = false) {
  const documents = rawDocuments.map((raw) => parseDocument(String(raw)));
  const defines = new Map();
  const issues = [];
  const rng = (node, localName = null) => isElementInNamespace(node, RNG, localName);
  for (const doc of documents) {
    for (const define of descendants(doc.root, (node) => rng(node, "define"))) {
      const name = getUnqualifiedAttr(define, "name");
      if (!name) continue;
      if (!defines.has(name)) defines.set(name, []);
      defines.get(name).push({ doc, node: define });
    }
  }
  const starts = documents.flatMap((doc) => descendants(doc.root, (node) => rng(node, "start"))
    .map((node) => ({ doc, node })));
  const queue = [];
  const collectRefs = (node) => {
    for (const ref of descendants(node, (candidate) => rng(candidate, "ref"))) {
      const name = getUnqualifiedAttr(ref, "name");
      if (name) queue.push(name);
    }
  };
  starts.forEach(({ node }) => collectRefs(node));
  const visited = new Set();
  const elements = new Set();
  const collectElements = (doc, node) => {
    for (const element of descendants(node, (candidate) => rng(candidate, "element"))) {
      const direct = getUnqualifiedAttr(element, "name");
      if (direct) elements.add(direct.replace(/^.*:/, ""));
      for (const name of (element.children || []).filter((child) => rng(child, "name"))) {
        const value = decodedText(doc, name);
        if (value) elements.add(value.replace(/^.*:/, ""));
      }
    }
  };
  starts.forEach(({ doc, node }) => collectElements(doc, node));
  while (queue.length) {
    const name = queue.shift();
    if (visited.has(name)) continue;
    visited.add(name);
    const matching = defines.get(name);
    if (!matching) {
      issues.push({ code: "unresolved-schema-reference", severity: "warning", message: `RNG define "${name}" is unresolved.` });
      continue;
    }
    for (const { doc, node } of matching) {
      collectElements(doc, node);
      collectRefs(node);
    }
  }
  const external = documents.flatMap((doc) => descendants(doc.root,
    (node) => rng(node, "include") || rng(node, "externalRef")));
  if (external.length && !dependenciesResolved) {
    issues.push({ code: "unresolved-schema-import", severity: "warning", message: `${external.length} RNG include/externalRef reference(s) require the loaded schema set.` });
  }
  const openNameClass = documents.some((doc) => descendants(doc.root,
    (node) => rng(node, "anyName") || rng(node, "nsName")).length > 0);
  if (openNameClass) {
    issues.push({ code: "open-schema-name-class", severity: "info", message: "The RNG contains anyName and has an open vocabulary branch." });
  }
  const broad = elements.size > 500;
  if (broad) {
    issues.push({ code: "broad-schema", severity: "info", message: "This broad schema is authoring evidence and does not classify the source." });
  }
  const closed = (dependenciesResolved || external.length === 0)
    && !broad
    && !issues.some((issue) => issue.code === "open-schema-name-class" || issue.code === "unresolved-schema-reference");
  return {
    kind: "relaxng",
    modules: [],
    elements: [...elements].sort(),
    classes: [],
    capabilities: capabilityAllowance(elements, closed),
    completeness: closed ? "reachable" : "unknown",
    issues,
  };
}

/** Inspect element names reachable from an RNG start pattern. */
export function inspectRelaxNg(raw) {
  return inspectRelaxNgDocuments([raw]);
}

/** Inspect global/local XSD element declarations as approximate vocabulary. */
function inspectXsdDocuments(rawDocuments, dependenciesResolved = false) {
  const elements = new Set();
  const issues = [];
  for (const raw of rawDocuments) {
    const doc = parseDocument(String(raw));
    walk(doc.root, (node) => {
      if (!isElementInNamespace(node, XSD)) return;
      if (node.localName === "element") {
        const name = getUnqualifiedAttr(node, "name");
        if (name) elements.add(name.replace(/^.*:/, ""));
      } else if (!dependenciesResolved && ["include", "import", "redefine"].includes(node.localName)) {
        issues.push({ code: "unresolved-schema-import", severity: "warning", message: `XSD ${node.localName} requires the loaded schema set.` });
      }
    });
  }
  return {
    kind: "xsd",
    modules: [],
    elements: [...elements].sort(),
    classes: [],
    capabilities: capabilityAllowance(elements, false),
    completeness: "approximate",
    issues,
  };
}

export function inspectXsd(raw) {
  return inspectXsdDocuments([raw]);
}

export function inspectSchemaProfile(raw, kind) {
  if (kind === "odd") return inspectOdd(raw);
  if (kind === "relaxng") return inspectRelaxNg(raw);
  if (kind === "xsd") return inspectXsd(raw);
  return { kind: kind || "unknown", modules: [], elements: [], classes: [], capabilities: {}, completeness: "unknown", issues: [{ code: "unsupported-schema-profile", severity: "info", message: "This schema type is validation-only." }] };
}

function unknownVocabularyProfile(source, error) {
  return {
    kind: source.type || "unknown",
    modules: [],
    elements: [],
    classes: [],
    capabilities: {},
    completeness: "unknown",
    issues: [{
      code: "schema-profile-unavailable",
      severity: "warning",
      message: `${source.name || "Schema"} could not be inspected: ${error.message}`,
    }],
  };
}

async function inspectVocabularySource(source) {
  try {
    const graph = await schemaResourceGraph(source);
    const documents = [...graph.resources.values()];
    if (source.type === "relaxng") return inspectRelaxNgDocuments(documents, true);
    if (source.type === "xsd") return inspectXsdDocuments(documents, true);
    return inspectSchemaProfile(graph.mainText, source.type);
  } catch (graphError) {
    try {
      const partial = withoutNegativeAllowances(inspectSchemaProfile(
        await schemaSourceText(source),
        source.type,
      ));
      partial.issues = [...partial.issues, {
        code: "schema-profile-partial",
        severity: "warning",
        message: `${source.name || "Schema"} was inspected partially: ${graphError.message}`,
      }];
      return partial;
    } catch (sourceError) {
      return unknownVocabularyProfile(source, sourceError);
    }
  }
}

function conjunctiveCapabilities(profiles) {
  const names = new Set(profiles.flatMap((profile) => Object.keys(profile.capabilities || {})));
  return Object.fromEntries([...names].flatMap((name) => {
    const states = profiles.map((profile) => profile.capabilities?.[name]);
    if (states.some((state) => state === false)) return [[name, false]];
    if (states.length && states.every((state) => state === true)) return [[name, true]];
    return [];
  }));
}

/** Inspect the active ordered schema set without giving profile evidence gate authority. */
export async function inspectSchemaSources(sources) {
  const sourceList = Array.isArray(sources) ? sources : [...(sources || [])];
  const vocabularySources = sourceList.filter((source) => (
    source.type === "relaxng" || source.type === "xsd" || source.type === "odd"
  ));
  const vocabulary = await Promise.all(vocabularySources.map(async (source) => ({
    source,
    profile: source.unavailable
      ? unknownVocabularyProfile(source, new Error(source.unavailable))
      : await inspectVocabularySource(source),
  })));
  const constraints = sourceList.filter((source) => (
    source.type === "schematron" || source.type === "schematron-xsl"
  )).map((source) => ({ name: source.name, type: source.type, available: !source.unavailable }));
  const profiles = vocabulary.map((entry) => entry.profile);
  const issues = vocabulary.flatMap(({ source, profile }) => profile.issues.map((issue) => ({
    ...issue,
    source: source.name,
  })));
  const configurationIssues = sourceList.filter((source) => source.type === "configuration")
    .map((source) => ({
      code: "schema-profile-unavailable",
      severity: "warning",
      message: source.unavailable || `${source.name || "Schema configuration"} is unavailable.`,
      source: source.name,
    }));
  const completeness = profiles.length && profiles.every((profile) => profile.completeness === "reachable")
    ? "reachable"
    : profiles.length && profiles.every((profile) => profile.completeness !== "unknown")
      ? "approximate"
      : "unknown";
  return {
    kind: "schema-set",
    modules: [],
    elements: [],
    classes: [],
    capabilities: conjunctiveCapabilities(profiles),
    completeness,
    constraints,
    sources: sourceList.map((source) => ({ name: source.name, type: source.type })),
    issues: [...issues, ...configurationIssues],
  };
}
