import {
  assertEditableEntities, assertXmlCharacters, escapeAttr, escapeText,
  getAttrInNamespace, getUnqualifiedAttr, parseDocument, textOf, tokenize, walk,
} from "./tei-document.js";
import { draftFilename } from "./starter-profiles.js";

const PAGE_NS = /^https?:\/\/schema\.primaresearch\.org\/PAGE\/gts\/pagecontent\/\d{4}-\d{2}-\d{2}$/u;
const METS_NS = "http://www.loc.gov/METS/";
const XLINK_NS = "http://www.w3.org/1999/xlink";
const attr = getUnqualifiedAttr;
const elements = (node) => (node?.children || []).filter((child) => child.type === "element");
const pageNodes = (node, name) => elements(node).filter((child) => PAGE_NS.test(child.namespaceURI || "") && child.localName === name);
const allNodes = (node, name, namespace) => {
  const found = [];
  walk(node, (child) => {
    if (child.type === "element" && child.localName === name
      && (namespace ? child.namespaceURI === namespace : PAGE_NS.test(child.namespaceURI || ""))) found.push(child);
  });
  return found;
};
const basename = (name) => String(name).replace(/\\/gu, "/").split("/").at(-1);
const idPart = (value) => Array.from(String(value)).map((char) => /[A-Za-z0-9.-]/u.test(char) ? char : `_${char.codePointAt(0).toString(16)}_`).join("");

function strictDocument(raw, label) {
  if (typeof raw !== "string") throw new Error(`${label}: XML text is required.`);
  assertXmlCharacters(raw);
  const stack = [];
  for (const token of tokenize(raw)) {
    if (token.t === "doctype") throw new Error(`${label}: DTDs and external entities are unsupported.`);
    if (token.t === "stag") stack.push(token.name);
    else if (token.t === "etag" && stack.pop() !== token.name) throw new Error(`${label}: XML end tags do not match.`);
    else if (token.t === "text" && raw.slice(token.start, token.end).includes("<")) throw new Error(`${label}: XML contains an incomplete tag.`);
  }
  if (stack.length) throw new Error(`${label}: XML contains an unclosed element.`);
  const doc = parseDocument(raw);
  if (elements(doc.root).length !== 1 || doc.root.children.some((child) => child.type === "text" && raw.slice(child.start, child.end).trim())) {
    throw new Error(`${label}: Exactly one XML document element is required.`);
  }
  walk(doc.root, (node) => {
    if (node.type !== "element") return;
    const names = new Set();
    for (const item of node.attrs || []) {
      if (names.has(item.expandedName)) throw new Error(`${label}: Duplicate XML attribute.`);
      names.add(item.expandedName);
      assertEditableEntities(item.rawValue);
    }
  });
  return doc;
}

function text(doc, node) {
  let value = "";
  walk(node, (child) => {
    if (child.type === "text") {
      assertEditableEntities(doc.raw.slice(child.start, child.end));
      value += textOf(doc, child);
    } else if (child.type === "cdata") value += textOf(doc, child);
  });
  return value;
}

function indexed(nodes, attribute = "index") {
  return nodes.map((node, position) => ({ node, position, order: Number(attr(node, attribute)) }))
    .sort((a, b) => {
      const left = attr(a.node, attribute) === null || !Number.isFinite(a.order) ? a.position : a.order;
      const right = attr(b.node, attribute) === null || !Number.isFinite(b.order) ? b.position : b.order;
      return left - right || a.position - b.position;
    }).map(({ node }) => node);
}
function sourceText(doc, node, warnings, label) {
  const alternatives = indexed(pageNodes(node, "TextEquiv"));
  if (!alternatives.length) return null;
  if (alternatives.length > 1) warnings.add(`${label}: the first indexed TextEquiv reading is imported; source alternatives remain in the PAGE file.`);
  const unicode = pageNodes(alternatives[0], "Unicode");
  if (unicode.length !== 1) throw new Error(`${label}: A TextEquiv requires exactly one Unicode value.`);
  return text(doc, unicode[0]);
}
function customOrder(node) {
  const match = /readingOrder\s*\{[^}]*\bindex\s*:\s*(\d+)\s*;/u.exec(attr(node, "custom") || "");
  return match ? Number(match[1]) : null;
}
function orderedLines(nodes) {
  return nodes.map((node, position) => ({ node, position, order: customOrder(node) }))
    .sort((a, b) => (a.order ?? a.position) - (b.order ?? b.position) || a.position - b.position)
    .map(({ node }) => node);
}
function readingOrder(page, warnings, label) {
  const references = [];
  const visit = (node) => {
    if (node.localName?.startsWith("UnorderedGroup")) warnings.add(`${label}: an unordered PAGE group retains its source order.`);
    const children = node.localName?.startsWith("OrderedGroup") ? indexed(elements(node)) : elements(node);
    for (const child of children) {
      if (!PAGE_NS.test(child.namespaceURI || "")) continue;
      if (["RegionRef", "RegionRefIndexed"].includes(child.localName)) references.push(attr(child, "regionRef"));
      else visit(child);
    }
  };
  for (const root of pageNodes(page, "ReadingOrder")) visit(root);
  return references;
}

/** Read selected PAGE file order from one METS structural map without fetching its links. */
export function pageOrderFromMets(raw) {
  const doc = strictDocument(raw, "METS");
  const root = elements(doc.root)[0];
  if (root.namespaceURI !== METS_NS || root.localName !== "mets") throw new Error("The order file is not METS XML.");
  const files = new Map();
  for (const file of allNodes(root, "file", METS_NS)) {
    const locations = allNodes(file, "FLocat", METS_NS);
    const href = locations.map((location) => getAttrInNamespace(location, XLINK_NS, "href")).find(Boolean);
    if (href && /\.xml$/iu.test(href)) files.set(attr(file, "ID"), href);
  }
  const maps = allNodes(root, "structMap", METS_NS);
  const physical = maps.filter((map) => /^(physical|manuscript)$/iu.test(attr(map, "TYPE") || ""));
  const candidates = physical.length ? physical : maps;
  if (candidates.length !== 1) throw new Error("METS requires one unambiguous physical structural map.");
  const order = [];
  const visit = (node) => {
    for (const child of indexed(elements(node), "ORDER")) {
      if (child.namespaceURI !== METS_NS) continue;
      if (["fptr", "area"].includes(child.localName)) {
        const href = files.get(attr(child, "FILEID"));
        if (href && !order.includes(href)) order.push(href);
      }
      visit(child);
    }
  };
  visit(candidates[0]);
  if (!order.length) throw new Error("METS does not identify any PAGE XML files in its structural map.");
  return order;
}

function orderFiles(files, mets, order) {
  if (new Set(files.map((file) => file.name)).size !== files.length) throw new Error("Selected PAGE filenames must be distinct. Import duplicate basenames as separate drafts.");
  if (mets) {
    const paths = pageOrderFromMets(mets);
    const rank = new Map();
    for (const file of files) {
      const exact = paths.filter((path) => path.replace(/\\/gu, "/") === file.name.replace(/\\/gu, "/"));
      const matching = exact.length ? exact : paths.filter((path) => basename(path) === basename(file.name));
      if (matching.length !== 1) throw new Error(`METS does not resolve ${file.name} unambiguously.`);
      rank.set(file.name, paths.indexOf(matching[0]));
    }
    return [...files].sort((a, b) => rank.get(a.name) - rank.get(b.name));
  }
  if (order === "selection") return [...files];
  if (order !== "filename") throw new Error("Choose filename or selection order.");
  const compare = new Intl.Collator("en", { numeric: true, sensitivity: "variant" });
  return [...files].sort((a, b) => compare.compare(a.name, b.name));
}

function convertPage(file, number, warnings) {
  const doc = strictDocument(file.raw, file.name);
  const root = elements(doc.root)[0];
  if (root.localName !== "PcGts" || !PAGE_NS.test(root.namespaceURI || "")) throw new Error(`${file.name}: This file is not PAGE-XML.`);
  const pages = pageNodes(root, "Page");
  if (pages.length !== 1) throw new Error(`${file.name}: Exactly one PAGE Page is required.`);
  const page = pages[0];
  const width = Number(attr(page, "imageWidth"));
  const height = Number(attr(page, "imageHeight"));
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) throw new Error(`${file.name}: Positive integer image dimensions are required.`);
  const prefix = `page_${idPart(file.name)}_`;
  const surfaceId = `${prefix}surface`;
  const sourceId = `${prefix}source`;
  const ids = new Map();
  const notes = [];
  let generated = 0;
  walk(page, (node) => {
    if (node.type !== "element" || !PAGE_NS.test(node.namespaceURI || "")) return;
    const original = attr(node, "id");
    if (original && ids.has(original)) throw new Error(`${file.name}: Duplicate PAGE ID ${original} prevents unambiguous reading order.`);
    if (original) ids.set(original, `${prefix}id_${idPart(original)}`);
  });
  const nodeIds = new Map();
  const identifier = (node) => {
    if (!nodeIds.has(node)) nodeIds.set(node, ids.get(attr(node, "id")) || `${prefix}generated_${++generated}`);
    return nodeIds.get(node);
  };
  const zone = (node) => {
    const id = identifier(node);
    const original = attr(node, "id");
    const coords = pageNodes(node, "Coords")[0];
    const points = attr(coords, "points");
    if (points && !/^\s*\d+(?:\.\d+)?,\d+(?:\.\d+)?(?:\s+\d+(?:\.\d+)?,\d+(?:\.\d+)?)*\s*$/u.test(points)) throw new Error(`${file.name}: Invalid coordinate polygon on ${original || node.localName}.`);
    const hasPolygon = points && points.trim().split(/\s+/u).length >= 3;
    if (points && !hasPolygon) {
      warnings.add(`${file.name}: ${original || node.localName} has fewer than three polygon points. Its coordinates are retained in a source note and require review.`);
      notes.push(`<note type="page-xml-coordinates" target="#${escapeAttr(id)}">${escapeText(points)}</note>`);
    }
    const custom = attr(node, "custom");
    if (custom) notes.push(`<note type="page-xml-custom" target="#${escapeAttr(id)}">${escapeText(custom)}</note>`);
    const baseline = attr(pageNodes(node, "Baseline")[0], "points");
    if (baseline) notes.push(`<note type="page-xml-baseline" target="#${escapeAttr(id)}">${escapeText(baseline)}</note>`);
    return `<zone xml:id="${escapeAttr(id)}" type="${escapeAttr(node.localName === "TextLine" ? "Line" : node.localName)}"${original ? ` n="${escapeAttr(original)}"` : ""}${attr(node, "type") ? ` subtype="${escapeAttr(attr(node, "type"))}"` : ""}${hasPolygon ? ` points="${escapeAttr(points)}"` : ""}/>`;
  };
  const regions = [];
  walk(page, (node) => { if (node.type === "element" && PAGE_NS.test(node.namespaceURI || "") && /Region$/u.test(node.localName)) regions.push(node); });
  const regionById = new Map(regions.map((region) => [attr(region, "id"), region]));
  const ordered = [];
  const appendRegion = (region) => {
    if (ordered.includes(region)) return;
    ordered.push(region);
    for (const nested of orderedLines(elements(region).filter((node) => PAGE_NS.test(node.namespaceURI || "") && /Region$/u.test(node.localName)))) appendRegion(nested);
  };
  const seenReferences = new Set();
  for (const reference of readingOrder(page, warnings, file.name)) {
    const region = regionById.get(reference);
    if (!region) throw new Error(`${file.name}: ReadingOrder points to missing region ${reference}.`);
    if (seenReferences.has(reference)) throw new Error(`${file.name}: ReadingOrder references ${reference} more than once.`);
    seenReferences.add(reference);
    appendRegion(region);
  }
  for (const region of orderedLines(regions)) appendRegion(region);
  const zones = [];
  const blocks = [];
  let lineCount = 0;
  let wordCount = 0;
  for (const region of ordered) {
    zones.push(zone(region));
    if (region.localName !== "TextRegion") continue;
    const lines = orderedLines(pageNodes(region, "TextLine"));
    if (!lines.length) {
      const value = sourceText(doc, region, warnings, file.name);
      if (value !== null) blocks.push(`<ab facs="#${escapeAttr(identifier(region))}">${escapeText(value)}</ab>`);
      continue;
    }
    const content = [];
    for (const line of lines) {
      zones.push(zone(line));
      lineCount++;
      const lineId = identifier(line);
      const words = orderedLines(pageNodes(line, "Word"));
      const lineValue = sourceText(doc, line, warnings, file.name);
      const wordValues = words.map((word) => sourceText(doc, word, warnings, file.name));
      const joined = wordValues.every((value) => value !== null) ? wordValues.join(" ") : null;
      let reading;
      if (words.length && joined !== null && (lineValue === null || lineValue === joined)) {
        if (lineValue === null) warnings.add(`${file.name}: words without line Unicode are separated by one space; word Unicode remains unchanged.`);
        reading = words.map((word, index) => {
          zones.push(zone(word)); wordCount++;
          return `<w xml:id="${escapeAttr(identifier(word))}_text" facs="#${escapeAttr(identifier(word))}">${escapeText(wordValues[index])}</w>`;
        }).join(" ");
      } else if (lineValue !== null) {
        if (words.length) warnings.add(`${file.name}: word and line readings disagree; the exact line Unicode is retained.`);
        for (const word of words) zones.push(zone(word));
        reading = escapeText(lineValue);
      } else throw new Error(`${file.name}: A text line has neither line Unicode nor complete word Unicode.`);
      content.push(`<lb xml:id="${escapeAttr(lineId)}_lb" facs="#${escapeAttr(lineId)}"/>${reading}`);
    }
    blocks.push(`<ab facs="#${escapeAttr(identifier(region))}">${content.join("")}</ab>`);
  }
  if (!blocks.length) warnings.add(`${file.name}: the page contains no transcribed text.`);
  const image = attr(page, "imageFilename");
  if (!image) throw new Error(`${file.name}: imageFilename is missing.`);
  if (/^\d+_\d+\.[A-Za-z0-9]+$/u.test(basename(image))) warnings.add("Transkribus-prefixed image filenames are retained; configure a resolver or attach matching local images.");
  const metadata = pageNodes(root, "Metadata")[0];
  const properties = metadata ? allNodes(metadata, "Property") : [];
  const folio = properties.find((property) => attr(property, "key") === "folio");
  const label = attr(folio, "value") || String(number);
  const creator = metadata && pageNodes(metadata, "Creator")[0];
  const transkribus = metadata && pageNodes(metadata, "TranskribusMetadata")[0];
  const source = `<bibl xml:id="${escapeAttr(sourceId)}"><title>${escapeText(file.name)}</title>${creator ? `<note type="source-creator">${escapeText(text(doc, creator))}</note>` : ""}${transkribus ? `<note type="source-status">${escapeText(["docId", "pageId", "pageNr", "status"].map((key) => `${key}=${attr(transkribus, key) || ""}`).join("; "))}</note>` : ""}</bibl>`;
  return {
    surface: `<surface xml:id="${escapeAttr(surfaceId)}" n="${escapeAttr(label)}" ulx="0" uly="0" lrx="${width}" lry="${height}"><graphic url="${escapeAttr(image)}" width="${width}px" height="${height}px"/>${zones.join("")}</surface>`,
    body: `<pb xml:id="${escapeAttr(prefix)}pb" n="${escapeAttr(label)}" facs="#${escapeAttr(surfaceId)}"/>${blocks.length ? blocks.join("") : "<ab/>"}`,
    source, notes, summary: { name: file.name, label, image, lines: lineCount, words: wordCount },
  };
}

/** Deterministically create a separate TEI draft from explicitly selected PAGE files. */
export function importPageXml(files, { title = "Imported PAGE transcription", mets = null, order = "filename", teiType = null } = {}) {
  if (!Array.isArray(files) || !files.length) throw new Error("Choose at least one PAGE XML file.");
  if (files.some((file) => !file || typeof file.name !== "string" || !file.name.trim())) throw new Error("Each selected PAGE file requires its source filename.");
  if (teiType !== null && (typeof teiType !== "string" || !/^[A-Za-z][A-Za-z0-9._-]*$/u.test(teiType))) throw new Error("The TEI project type must be one identifier without spaces.");
  const ordered = orderFiles(files, mets, order);
  const warnings = new Set();
  const pages = ordered.map((file, index) => convertPage(file, index + 1, warnings));
  const titleText = String(title).trim() || "Imported PAGE transcription";
  const orderLabel = mets ? "METS structural map" : order === "selection" ? "selected file order" : "natural filename order";
  const notes = pages.flatMap((page) => page.notes);
  const raw = `<?xml version="1.0" encoding="UTF-8"?>\n<TEI xmlns="http://www.tei-c.org/ns/1.0"${teiType ? ` type="${escapeAttr(teiType)}"` : ""}><teiHeader><fileDesc><titleStmt><title>${escapeText(titleText)}</title><respStmt xml:id="page_xml_import"><resp>Deterministic transfer of PAGE text and geometry; imported transcription requires editorial review.</resp><name>teiCrafter PAGE importer</name></respStmt></titleStmt><publicationStmt><p>Unpublished working transcription.</p></publicationStmt><sourceDesc><listBibl>${pages.map((page) => page.source).join("")}</listBibl></sourceDesc></fileDesc><encodingDesc><projectDesc><p>PAGE-XML source transcription, including any HTR output and subsequent source edits, is imported without normalization. Source creator and status are recorded when supplied. Page sequence uses ${escapeText(orderLabel)}. PAGE custom annotations and baselines are retained as source notes; no editorial interpretation is inferred. Original PAGE files remain the source for alternatives and other unmapped metadata.</p></projectDesc></encodingDesc></teiHeader>${notes.length ? `<standOff>${notes.join("")}</standOff>` : ""}<facsimile>${pages.map((page) => page.surface).join("")}</facsimile><text resp="#page_xml_import"><body><div type="page-xml-import">${pages.map((page) => page.body).join("")}</div></body></text></TEI>`;
  return { raw, name: draftFilename(titleText), pages: pages.map((page) => page.summary), warnings: [...warnings], order: orderLabel };
}
