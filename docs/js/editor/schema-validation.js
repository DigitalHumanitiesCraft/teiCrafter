import { normalizeSchemaSet, schemaDependencyRefs, schemaPathExtension } from "./schema-set.js";

const DEFAULT_RELAXNG_URL = new URL(
  "../../schemas/tei-p5-4.11.0/tei_all.rng",
  import.meta.url,
).href;
const LOCAL_SCHEMA_BASE = "https://teicrafter.invalid/project/";
const SESSION_SCHEMA_BASE = "https://teicrafter.invalid/session/";
const SCHEMATRON_NAMESPACE = "http://purl.oclc.org/dsdl/schematron";
const SVRL_NAMESPACE = "http://purl.oclc.org/dsdl/svrl";

const validatorCache = new Map();
let libxmlRuntimePromise = null;

export const DEFAULT_SCHEMA = Object.freeze({
  name: "TEI P5 4.11.0 (TEI All)",
  type: "relaxng",
  url: DEFAULT_RELAXNG_URL,
});

function pathName(path) {
  return String(path || "").split(/[\\/]/).filter(Boolean).pop() || "schema";
}

function resolveSchemaUrl(path, baseUrl) {
  if (!baseUrl) return path;
  try {
    return new URL(path, baseUrl).href;
  } catch {
    return path;
  }
}

function virtualSchemaUrl(path, base = LOCAL_SCHEMA_BASE) {
  const clean = String(path || "schema").replace(/\\/g, "/").replace(/^\/+/, "");
  return new URL(clean.split("/").map(encodeURIComponent).join("/"), base).href;
}

function localResourceMap(localSchemas) {
  if (!localSchemas) return null;
  const resources = {};
  for (const [path, value] of Object.entries(localSchemas)) {
    resources[virtualSchemaUrl(value.path || path)] = value;
  }
  return resources;
}

function sourceArray(value) {
  if (Array.isArray(value)) return value;
  if (value instanceof Set) return [...value];
  return [];
}

function sourceType(entry) {
  if (entry.type !== "schematron") return entry.type;
  return /\.xsl(?:t)?(?:[?#].*)?$/i.test(entry.path) ? "schematron-xsl" : "schematron";
}

/** Resolve one active schema set. A session upload replaces the project set. */
export function schemaSources(projectSchema, customSchema = null, baseUrl = null, localSchemas = null) {
  if (customSchema) return (Array.isArray(customSchema) || customSchema instanceof Set
    ? [...customSchema]
    : [customSchema]);
  const normalized = normalizeSchemaSet(projectSchema);
  if (!normalized.declared) return [DEFAULT_SCHEMA];

  const sources = normalized.issues.map((message, index) => ({
    name: `Project schema configuration${normalized.issues.length > 1 ? ` ${index + 1}` : ""}`,
    type: "configuration",
    unavailable: message,
  }));
  const resources = localResourceMap(localSchemas);
  for (const entry of normalized.entries) {
    const type = sourceType(entry);
    const local = localSchemas && localSchemas[entry.path];
    if (localSchemas) {
      sources.push({
        name: entry.name || pathName(entry.path),
        type,
        documentUrl: virtualSchemaUrl(local?.path || entry.path),
        resources,
        ...(local || {
          unavailable: `Project-folder schema "${entry.path}" is unavailable: the file was not loaded from the project folder.`,
        }),
      });
    } else {
      sources.push({
        name: entry.name || pathName(entry.path),
        type,
        url: resolveSchemaUrl(entry.path, baseUrl),
      });
    }
  }
  return sources;
}

export async function customSchemaFromFile(file) {
  const name = file && file.name ? file.name : "custom schema";
  const text = await file.text();
  let type = null;
  if (/\.rng$/i.test(name)) type = "relaxng";
  else if (/\.xsd$/i.test(name)) type = "xsd";
  else if (/\.xsl(?:t)?$/i.test(name)) type = "schematron-xsl";
  else if (/\.sch$/i.test(name)) type = "schematron";
  if (!type) {
    throw new Error("Choose a RelaxNG (.rng), XML Schema (.xsd), Schematron (.sch), or compiled Schematron (.xsl) file.");
  }
  return { name, type, text, url: virtualSchemaUrl(name, SESSION_SCHEMA_BASE) };
}

async function fetchedText(url) {
  const response = await fetch(url, { credentials: "omit" });
  if (!response.ok) throw new Error(`Schema request failed (${response.status}) for ${url}.`);
  return response.text();
}

async function sourceText(source) {
  if (source.unavailable) throw new Error(source.unavailable);
  if (typeof source.text === "string") return source.text;
  if (!source.url) throw new Error(`No schema content is available for ${source.name}.`);
  return fetchedText(source.url);
}

/** Read one schema source without compiling it. Vocabulary inspection uses this
 * best-effort seam while output validation remains authoritative and fail closed. */
export async function schemaSourceText(source) {
  return sourceText(source);
}

function diagnostic(message, extra = {}) {
  return { message: String(message || "Schema validation failed.").trim(), line: 0, column: 0, ...extra };
}

function diagnostics(error) {
  const details = Array.isArray(error && error.details) ? error.details : [];
  if (details.length) {
    return details.map((detail) => ({
      message: String(detail.message || "Schema validation failed.").trim(),
      line: Number(detail.line || 0),
      column: Number(detail.col || 0),
    }));
  }
  return [diagnostic(error instanceof Error ? error.message : String(error))];
}

function normalizedResources(resources) {
  if (!resources) return new Map();
  return resources instanceof Map ? new Map(resources) : new Map(Object.entries(resources));
}

export async function schemaResourceGraph(source) {
  const mainText = await sourceText(source);
  const resources = normalizedResources(source.resources);
  const resolved = new Map();
  const visited = new Set();

  async function read(url) {
    const supplied = resources.get(url);
    if (supplied && supplied.unavailable) throw new Error(supplied.unavailable);
    if (typeof supplied === "string") return supplied;
    if (supplied && typeof supplied.text === "string") return supplied.text;
    if (url.startsWith("https://teicrafter.invalid/")) {
      throw new Error(`Schema dependency ${url} was not loaded inside the granted project root. Session uploads contain only the selected file.`);
    }
    return fetchedText(url);
  }

  async function visit(text, url) {
    if (visited.has(url)) return;
    visited.add(url);
    resolved.set(url, text);
    for (const ref of schemaDependencyRefs(text, source.type)) {
      if (ref.missing) {
        throw new Error(`${source.name} has an ${ref.kind} without ${source.type === "xsd" ? "schemaLocation" : "href"}. Browser validation has no XML catalog fallback.`);
      }
      let dependencyUrl;
      try {
        dependencyUrl = new URL(ref.href, url).href;
      } catch {
        throw new Error(`${source.name} contains an unresolved schema dependency "${ref.href}".`);
      }
      if (dependencyUrl === url) continue;
      await visit(await read(dependencyUrl), dependencyUrl);
    }
  }

  const mainUrl = source.documentUrl || source.url || virtualSchemaUrl(source.name, SESSION_SCHEMA_BASE);
  await visit(mainText, mainUrl);
  return { mainText, mainUrl, resources: resolved };
}

async function libxmlRuntime() {
  if (!libxmlRuntimePromise) {
    libxmlRuntimePromise = import("../../vendor/libxml2-wasm/lib/index.mjs").then((runtime) => {
      const provider = new runtime.XmlBufferInputProvider({});
      if (!runtime.xmlRegisterInputProvider(provider)) {
        throw new Error("The browser XML runtime could not register its in-memory schema resolver.");
      }
      return { ...runtime, provider, encoder: new TextEncoder() };
    });
  }
  return libxmlRuntimePromise;
}

async function fingerprint(parts) {
  const body = parts.map((part) => `${String(part).length}:${String(part)}`).join("|");
  if (globalThis.crypto && globalThis.crypto.subtle) {
    const bytes = new TextEncoder().encode(body);
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  return body;
}

async function libxmlValidator(source, graph) {
  const runtime = await libxmlRuntime();
  const resourceParts = [...graph.resources.entries()].sort(([a], [b]) => a.localeCompare(b)).flat();
  const cacheKey = await fingerprint([source.type, graph.mainUrl, ...resourceParts]);
  if (validatorCache.has(cacheKey)) return validatorCache.get(cacheKey);

  for (const [url, text] of graph.resources) {
    runtime.provider.addBuffer(url, runtime.encoder.encode(text));
  }
  const schemaDocument = runtime.XmlDocument.fromString(graph.mainText, { url: graph.mainUrl });
  try {
    const validator = source.type === "xsd"
      ? runtime.XsdValidator.fromDoc(schemaDocument)
      : runtime.RelaxNGValidator.fromDoc(schemaDocument);
    const entry = { validator, XmlDocument: runtime.XmlDocument, schemaDocument };
    validatorCache.set(cacheKey, entry);
    return entry;
  } catch (error) {
    schemaDocument.dispose();
    throw error;
  }
}

async function validateXmlSchema(raw, source) {
  const graph = await schemaResourceGraph(source);
  const entry = await libxmlValidator(source, graph);
  let document;
  try {
    document = entry.XmlDocument.fromString(raw);
    entry.validator.validate(document);
    return { name: source.name, type: source.type, status: "valid", diagnostics: [] };
  } catch (error) {
    return { name: source.name, type: source.type, status: "invalid", diagnostics: diagnostics(error) };
  } finally {
    if (document) document.dispose();
  }
}

function parseXmlInBrowser(text, label) {
  const parsed = new DOMParser().parseFromString(text, "application/xml");
  const errors = [...parsed.getElementsByTagName("parsererror")];
  if (errors.length) {
    throw new Error(`${label} is not well-formed XML: ${errors[0].textContent.replace(/\s+/g, " ").trim().slice(0, 240)}`);
  }
  return parsed;
}

async function validateSchematronXsl(raw, source) {
  if (typeof DOMParser === "undefined" || typeof XSLTProcessor === "undefined") {
    return {
      name: source.name,
      type: source.type,
      status: "unavailable",
      diagnostics: [diagnostic("Compiled Schematron validation requires a browser with XSLTProcessor support.")],
    };
  }
  const xml = parseXmlInBrowser(raw, "The current document");
  const stylesheet = parseXmlInBrowser(await sourceText(source), source.name);
  const processor = new XSLTProcessor();
  processor.importStylesheet(stylesheet);
  const report = processor.transformToDocument(xml);
  if (!report) throw new Error("The browser XSLT processor returned no Schematron report.");
  if (report.documentElement?.namespaceURI !== SVRL_NAMESPACE
    || report.documentElement.localName !== "schematron-output") {
    throw new Error(`${source.name} did not produce an SVRL schematron-output report.`);
  }
  const findings = [
    ...report.getElementsByTagNameNS(SVRL_NAMESPACE, "failed-assert"),
    ...report.getElementsByTagNameNS(SVRL_NAMESPACE, "successful-report"),
  ];
  const messages = findings.map((node) => diagnostic(
    node.textContent.replace(/\s+/g, " ").trim()
      || (node.localName === "successful-report" ? "Schematron report matched." : "Schematron assertion failed."),
    { location: node.getAttribute("location") || "" },
  ));
  return {
    name: source.name,
    type: source.type,
    status: messages.length ? "invalid" : "valid",
    diagnostics: messages,
  };
}

function schematronChildren(parent, localName) {
  return [...(parent && parent.children || [])].filter((node) => (
    node.namespaceURI === SCHEMATRON_NAMESPACE && (!localName || node.localName === localName)
  ));
}

function xpathLiteral(value) {
  const text = String(value);
  if (!text.includes("'")) return `'${text}'`;
  if (!text.includes('"')) return `"${text}"`;
  const parts = text.split("'");
  return `concat(${parts.map((part, index) => `${index ? `,"'",` : ""}'${part}'`).join("")})`;
}

function substituteVariables(expression, variables) {
  let out = "";
  let quote = null;
  for (let index = 0; index < expression.length;) {
    const char = expression[index];
    if (quote) {
      out += char;
      if (char === quote) quote = null;
      index++;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      out += char;
      index++;
      continue;
    }
    if (char !== "$") {
      out += char;
      index++;
      continue;
    }
    const match = /^[A-Za-z_][\w.-]*/.exec(expression.slice(index + 1));
    if (!match) {
      out += char;
      index++;
      continue;
    }
    if (!variables.has(match[0])) throw new Error(`Schematron XPath refers to undefined variable $${match[0]}.`);
    out += variables.get(match[0]);
    index += match[0].length + 1;
  }
  return out;
}

function xpathResolver(namespaces) {
  return (prefix) => prefix === "xml"
    ? "http://www.w3.org/XML/1998/namespace"
    : namespaces.get(prefix) || null;
}

function xpathUnionBranches(expression) {
  const branches = [];
  let start = 0;
  let quote = null;
  let squareDepth = 0;
  let roundDepth = 0;
  for (let index = 0; index < expression.length; index++) {
    const char = expression[index];
    if (quote) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === "'" || char === '"') quote = char;
    else if (char === "[") squareDepth++;
    else if (char === "]") squareDepth--;
    else if (char === "(") roundDepth++;
    else if (char === ")") roundDepth--;
    else if (char === "|" && squareDepth === 0 && roundDepth === 0) {
      branches.push(expression.slice(start, index).trim());
      start = index + 1;
    }
  }
  branches.push(expression.slice(start).trim());
  if (branches.some((branch) => !branch)) {
    throw new Error("Schematron rule context contains an empty union branch.");
  }
  return branches;
}

/** Select nodes as an XSLT-style match context rather than a document-relative XPath. */
function schematronContextSelection(expression) {
  return xpathUnionBranches(expression).map((branch) => {
    if (branch.startsWith("/")) return branch;
    if (/^(?:id|key)\s*\(/.test(branch)) {
      throw new Error("Raw Schematron id() and key() rule contexts require compilation to XSLT.");
    }
    if (/^(?:ancestor|ancestor-or-self|descendant|descendant-or-self|following|following-sibling|namespace|parent|preceding|preceding-sibling|self)::/.test(branch)) {
      throw new Error("Raw Schematron supports child and attribute rule-context axes only; compile this schema to XSLT.");
    }
    return `//${branch}`;
  }).join(" | ");
}

function scalarXPath(document, context, expression, resolver) {
  const result = document.evaluate(expression, context, resolver, 0, null);
  if (result.resultType === 1) {
    return Number.isNaN(result.numberValue) ? "number('NaN')" : String(result.numberValue);
  }
  if (result.resultType === 2) return xpathLiteral(result.stringValue);
  if (result.resultType === 3) return result.booleanValue ? "true()" : "false()";
  throw new Error("Browser raw Schematron supports scalar <let> values only; node-set variables require compilation to XSLT.");
}

function applyLets(document, context, nodes, resolver, inherited = new Map()) {
  const variables = new Map(inherited);
  for (const node of nodes) {
    const name = node.getAttribute("name") || "";
    const value = node.getAttribute("value") || "";
    if (!name || !value) throw new Error("Every Schematron <let> needs non-empty name and value attributes.");
    variables.set(name, scalarXPath(document, context, substituteVariables(value, variables), resolver));
  }
  return variables;
}

function messageText(node, xml, context, resolver, variables) {
  const parts = [];
  for (const child of node.childNodes) {
    if (child.nodeType === 3 || child.nodeType === 4) {
      parts.push(child.nodeValue || "");
    } else if (child.nodeType === 1 && child.namespaceURI === SCHEMATRON_NAMESPACE
      && child.localName === "value-of") {
      const select = substituteVariables(child.getAttribute("select") || ".", variables);
      parts.push(xml.evaluate(`string(${select})`, context, resolver, 2, null).stringValue);
    } else if (child.nodeType === 1 && child.namespaceURI === SCHEMATRON_NAMESPACE
      && child.localName === "name") {
      const select = substituteVariables(child.getAttribute("path") || ".", variables);
      const selected = xml.evaluate(select, context, resolver, 9, null).singleNodeValue;
      parts.push(selected && (selected.localName || selected.nodeName) || "");
    } else if (child.nodeType === 1) {
      parts.push(child.textContent || "");
    }
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function nodePath(node) {
  if (node && node.nodeType === 2) {
    return `${nodePath(node.ownerElement)}/@${node.nodeName}`;
  }
  const parts = [];
  for (let current = node; current && current.nodeType === 1; current = current.parentElement) {
    const siblings = current.parentElement
      ? [...current.parentElement.children].filter((item) => item.localName === current.localName
        && item.namespaceURI === current.namespaceURI)
      : [current];
    parts.unshift(`${current.nodeName}[${siblings.indexOf(current) + 1}]`);
  }
  return `/${parts.join("/")}`;
}

function activeSchematronPatterns(root) {
  const patterns = schematronChildren(root, "pattern");
  if (!patterns.length) throw new Error("Raw Schematron needs at least one pattern.");
  const ids = new Map();
  for (const pattern of patterns) {
    const id = pattern.getAttribute("id") || "";
    if (!id) continue;
    if (ids.has(id)) throw new Error(`Schematron pattern id "${id}" is duplicated.`);
    ids.set(id, pattern);
  }
  const phaseId = root.getAttribute("defaultPhase") || "#ALL";
  if (phaseId === "#ALL") return patterns;
  const phase = schematronChildren(root, "phase").find((item) => item.getAttribute("id") === phaseId);
  if (!phase) throw new Error(`Schematron defaultPhase "${phaseId}" does not name a phase in this schema.`);
  const active = new Set();
  for (const item of schematronChildren(phase, "active")) {
    const id = item.getAttribute("pattern") || "";
    if (!id) throw new Error(`Schematron phase "${phaseId}" has an active entry without a pattern id.`);
    if (!ids.has(id)) throw new Error(`Schematron phase "${phaseId}" refers to unknown pattern "${id}".`);
    active.add(id);
  }
  if (!active.size) throw new Error(`Schematron phase "${phaseId}" activates no patterns.`);
  return patterns.filter((pattern) => active.has(pattern.getAttribute("id")));
}

async function validateRawSchematron(raw, source) {
  if (typeof DOMParser === "undefined" || typeof XPathResult === "undefined") {
    return {
      name: source.name,
      type: source.type,
      status: "unavailable",
      diagnostics: [diagnostic("Raw Schematron validation requires browser DOM XPath 1.0 support.")],
    };
  }
  const xml = parseXmlInBrowser(raw, "The current document");
  const schema = parseXmlInBrowser(await sourceText(source), source.name);
  const root = schema.documentElement;
  if (root.namespaceURI !== SCHEMATRON_NAMESPACE || root.localName !== "schema") {
    throw new Error(`${source.name} is not an ISO Schematron schema.`);
  }
  const queryBinding = (root.getAttribute("queryBinding") || "xslt").toLowerCase();
  if (!["xslt", "xslt1"].includes(queryBinding)) {
    throw new Error(`Raw Schematron queryBinding="${queryBinding}" is unavailable in the browser. Use XPath 1.0 (xslt/xslt1) or upload compiled XSLT.`);
  }
  if (schema.getElementsByTagNameNS(SCHEMATRON_NAMESPACE, "include").length
    || schema.getElementsByTagNameNS(SCHEMATRON_NAMESPACE, "extends").length
    || [...schema.getElementsByTagNameNS(SCHEMATRON_NAMESPACE, "pattern")]
      .some((pattern) => pattern.getAttribute("abstract") === "true" || pattern.hasAttribute("is-a"))) {
    throw new Error("Raw Schematron includes, extends and abstract patterns require ISO-skeleton compilation to XSLT and are unavailable in the browser runtime.");
  }

  const namespaces = new Map();
  for (const declaration of schema.getElementsByTagNameNS(SCHEMATRON_NAMESPACE, "ns")) {
    const prefix = declaration.getAttribute("prefix") || "";
    const uri = declaration.getAttribute("uri") || "";
    if (!prefix || !uri) throw new Error("Every Schematron <ns> needs non-empty prefix and uri attributes.");
    if (namespaces.has(prefix) && namespaces.get(prefix) !== uri) {
      throw new Error(`Schematron namespace prefix "${prefix}" is declared with multiple URIs.`);
    }
    namespaces.set(prefix, uri);
  }
  const resolver = xpathResolver(namespaces);
  const diagnosticsById = new Map();
  for (const item of schema.getElementsByTagNameNS(SCHEMATRON_NAMESPACE, "diagnostic")) {
    const id = item.getAttribute("id") || "";
    if (!id) throw new Error("Every Schematron <diagnostic> needs a non-empty id.");
    if (diagnosticsById.has(id)) throw new Error(`Schematron diagnostic id "${id}" is duplicated.`);
    diagnosticsById.set(id, item);
  }
  const schemaLets = applyLets(xml, xml, schematronChildren(root, "let"), resolver);
  const failures = [];

  for (const pattern of activeSchematronPatterns(root)) {
    const patternLets = applyLets(xml, xml, schematronChildren(pattern, "let"), resolver, schemaLets);
    const rules = schematronChildren(pattern, "rule");
    if (!rules.length) throw new Error("Every active Schematron pattern needs at least one rule.");
    for (const rule of rules) {
      if (rule.getAttribute("abstract") === "true") {
        throw new Error("Abstract Schematron rules require ISO-skeleton compilation to XSLT.");
      }
      const contextExpression = rule.getAttribute("context") || "";
      if (!contextExpression) throw new Error("Every Schematron rule needs a context expression.");
      const context = schematronContextSelection(substituteVariables(contextExpression, patternLets));
      const assertions = schematronChildren(rule).filter((item) => (
        item.localName === "assert" || item.localName === "report"
      ));
      if (!assertions.length) throw new Error("Every Schematron rule needs at least one assert or report.");
      for (const assertion of assertions) {
        if (!assertion.getAttribute("test")) {
          throw new Error(`Schematron <${assertion.localName}> needs a test expression.`);
        }
        const ids = String(assertion.getAttribute("diagnostics") || "").trim().split(/\s+/).filter(Boolean);
        for (const id of ids) {
          if (!diagnosticsById.has(id)) {
            throw new Error(`Schematron assertion refers to unknown diagnostic "${id}".`);
          }
        }
      }
      const matches = xml.evaluate(context, xml, resolver, 7, null);
      for (let index = 0; index < matches.snapshotLength; index++) {
        const contextNode = matches.snapshotItem(index);
        const variables = applyLets(xml, contextNode, schematronChildren(rule, "let"), resolver, patternLets);
        for (const assertion of assertions) {
          const test = assertion.getAttribute("test");
          const result = xml.evaluate(substituteVariables(test, variables), contextNode, resolver, 3, null).booleanValue;
          const failed = assertion.localName === "assert" ? !result : result;
          if (!failed) continue;
          let message = messageText(assertion, xml, contextNode, resolver, variables)
            || (assertion.localName === "assert" ? "Schematron assertion failed." : "Schematron report matched.");
          const ids = String(assertion.getAttribute("diagnostics") || "").trim().split(/\s+/).filter(Boolean);
          for (const id of ids) {
            const item = diagnosticsById.get(id);
            message += ` ${messageText(item, xml, contextNode, resolver, variables)}`;
          }
          failures.push(diagnostic(message, {
            location: nodePath(contextNode),
            role: assertion.getAttribute("role") || "",
          }));
        }
      }
    }
  }
  return {
    name: source.name,
    type: source.type,
    status: failures.length ? "invalid" : "valid",
    diagnostics: failures,
  };
}

export async function validateWithSchemas(raw, sources) {
  const activeSources = sourceArray(sources);
  if (!activeSources.length) {
    return [{
      name: "Schema set",
      type: "configuration",
      status: "unavailable",
      diagnostics: [diagnostic("No schema is configured. Save and Download require at least one available schema.")],
    }];
  }
  const results = [];
  for (const source of activeSources) {
    try {
      if (source.unavailable) throw new Error(source.unavailable);
      if (source.type === "relaxng" || source.type === "xsd") {
        results.push(await validateXmlSchema(raw, source));
      } else if (source.type === "schematron-xsl") {
        results.push(await validateSchematronXsl(raw, source));
      } else if (source.type === "schematron") {
        results.push(await validateRawSchematron(raw, source));
      } else {
        throw new Error(`Schema type "${source.type || "unknown"}" is not supported by the browser runtime.`);
      }
    } catch (error) {
      results.push({
        name: source.name || "schema",
        type: source.type,
        status: "unavailable",
        diagnostics: diagnostics(error),
      });
    }
  }
  return results;
}

export function schemaGate(results) {
  const list = sourceArray(results);
  const invalid = list.filter((result) => result.status === "invalid");
  const unavailable = list.filter((result) => result.status !== "valid" && result.status !== "invalid");
  return { ok: list.length > 0 && !invalid.length && !unavailable.length, invalid, unavailable };
}

/** Exact configuration key used to reject results from another schema set. */
export function schemaSetKey(sources) {
  return JSON.stringify(sourceArray(sources).map((source) => ({
    name: source.name,
    type: source.type,
    url: source.url || null,
    documentUrl: source.documentUrl || null,
    text: typeof source.text === "string" ? source.text : null,
    unavailable: source.unavailable || null,
    resources: source.resources ? [...(source.resources instanceof Map
      ? source.resources.entries()
      : Object.entries(source.resources))].sort(([a], [b]) => a.localeCompare(b)) : null,
  })));
}

/** Factual limits shown beside the schema set and pinned by UI tests. */
export function schemaRuntimeNotes(sources) {
  const types = new Set(sourceArray(sources).map((source) => source.type));
  const notes = [];
  if (types.has("relaxng") || types.has("xsd")) {
    notes.push("RelaxNG include/externalRef and XSD include/import/redefine work when every dependency can be fetched or resolved relative to its containing schema inside the granted project root. Missing dependencies make validation unavailable and block output.");
  }
  if (types.has("schematron")) {
    notes.push("Raw Schematron runs browser XPath 1.0 (xslt/xslt1) for common child/attribute rule contexts, namespaces, phases, scalar lets, asserts and reports. Includes, abstract patterns, advanced match patterns, node-set lets and XPath 2.0+ require compiled XSLT; they are unavailable and block output.");
  }
  if (types.has("schematron-xsl")) {
    notes.push("Compiled Schematron runs through the browser XSLT processor. A browser without XSLTProcessor reports unavailable and blocks output.");
  }
  return notes;
}

export { schemaPathExtension };
