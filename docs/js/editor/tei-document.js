/**
 * teiCrafter Editor -- Generic TEI document model (shared, pure, DOM-free).
 *
 * The goal: read ARBITRARY TEI-XML losslessly and make it editable, without any
 * project-specific profile. The raw string is canonical; every edit is an offset
 * splice on it, so untouched markup is byte-preserved. A real (small) XML
 * tokenizer builds a tree with byte offsets for every node and attribute value;
 * `serialize()` returns the raw string, so round-trip is byte-identical by
 * construction (even for markup the tree-builder does not interpret).
 *
 * No DOM, no XMLSerializer (both drift): this runs in the browser (editor-app.js)
 * and in Node (the headless round-trip proofs), so the logic the editor uses is
 * the logic the harness measures.
 *
 * Layer 1 here: tokenize + parse to an offset-true tree + lossless edit ops.
 * Layer 2 here: generic, schema-free TEI recognizers keyed on expanded names.
 * Layer 3 (the editable "cells" = text nodes grouped into lines/folios) lives in
 * edition.js, which is a thin model built on this core.
 */

/**
 * @typedef {Object} Token
 * @property {string} t Token kind (one of the T.* constants).
 * @property {number} start Inclusive byte offset of the token in the raw string.
 * @property {number} end Exclusive byte offset of the token in the raw string.
 * @property {string} [name] Tag name, present for STAG/ETAG/EMPTY tokens.
 */

/**
 * @typedef {Object} Attr
 * @property {string} name Qualified attribute name as written (e.g. "xml:id").
 * @property {string} localName Local part of the attribute name.
 * @property {string|null} prefix Namespace prefix, or null when unprefixed.
 * @property {string|null} namespaceURI Resolved namespace URI; unqualified attributes have none.
 * @property {string} expandedName Clark-notation expanded name.
 * @property {string} value Decoded attribute value.
 * @property {string} rawValue Attribute value exactly as written (still encoded).
 * @property {string} quote The quote character used ('"' or "'").
 * @property {number} valueStart Byte offset of the value's first character.
 * @property {number} valueEnd Byte offset just after the value's last character.
 * @property {number} start Byte offset of the attribute name.
 * @property {number} end Byte offset just after the closing quote.
 */

/**
 * @typedef {Object} TeiNode
 * @property {string} type Node kind ("element", "text", "root", or a token kind).
 * @property {string} [localName] Local-name for elements, "#root" for the root (absent on text/leaf nodes).
 * @property {string} [qname] Qualified element name as written.
 * @property {string|null} [prefix] Namespace prefix, or null when unprefixed.
 * @property {string|null} [namespaceURI] Resolved namespace URI.
 * @property {string} [expandedName] Clark-notation expanded name.
 * @property {Map<string, string|null>} [namespaces] Namespace bindings in scope.
 * @property {Attr[]} [attrs] Parsed attributes (elements only).
 * @property {number} [outerStart] Byte offset where the element/node begins.
 * @property {number|null} [outerEnd] Byte offset just after the element/node ends.
 * @property {number} [stagStart] Byte offset of the start-tag.
 * @property {number} [stagEnd] Byte offset just after the start-tag.
 * @property {number|null} [contentStart] Byte offset of the element content.
 * @property {number|null} [contentEnd] Byte offset just after the element content.
 * @property {number|null} [etagStart] Byte offset of the end-tag.
 * @property {number|null} [etagEnd] Byte offset just after the end-tag.
 * @property {boolean} [selfClosing] True for empty-element tags.
 * @property {number} [start] Byte offset where a text/leaf node begins.
 * @property {number} [end] Byte offset just after a text/leaf node ends.
 * @property {TeiNode|null} parent Parent node, or null for the root.
 * @property {TeiNode[]} [children] Child nodes in document order.
 */

/**
 * @typedef {Object} TeiDocument
 * @property {string} raw The canonical raw XML string.
 * @property {TeiNode} root The offset-true parse tree root.
 * @property {() => string} serialize Returns the raw string (byte-identical).
 */

/**
 * @typedef {Object} Zone
 * @property {string|null} id The zone's xml:id, or null.
 * @property {number|null} ulx Upper-left x coordinate.
 * @property {number|null} uly Upper-left y coordinate.
 * @property {number|null} lrx Lower-right x coordinate.
 * @property {number|null} lry Lower-right y coordinate.
 * @property {string|null} [points] Polygon points string ("x,y x,y ..."), if any.
 */

/**
 * @typedef {Object} TeiSurface
 * @property {string|null} id The surface's xml:id, or null.
 * @property {string|null} n The surface's n attribute, or null.
 * @property {number|null} ulx Upper-left x coordinate.
 * @property {number|null} uly Upper-left y coordinate.
 * @property {number|null} lrx Lower-right x coordinate.
 * @property {number|null} lry Lower-right y coordinate.
 * @property {string|null} graphic Page-image url from a child <graphic>, or null.
 * @property {Zone[]} zones The surface's zones.
 */

// ---- token kinds -----------------------------------------------------------

const T = Object.freeze({
  TEXT: "text",
  STAG: "stag",     // <name ...>
  ETAG: "etag",     // </name>
  EMPTY: "empty",   // <name .../>
  COMMENT: "comment",
  CDATA: "cdata",
  PI: "pi",
  DECL: "decl",     // <?xml ... ?>
  DOCTYPE: "doctype",
});

function localOf(name) {
  const i = name.indexOf(":");
  return i < 0 ? name : name.slice(i + 1);
}
function prefixOf(name) {
  const i = name.indexOf(":");
  return i < 0 ? null : name.slice(0, i);
}

export const TEI_NAMESPACE = "http://www.tei-c.org/ns/1.0";
export const XML_NAMESPACE = "http://www.w3.org/XML/1998/namespace";
export const XMLNS_NAMESPACE = "http://www.w3.org/2000/xmlns/";

/** Clark-notation expanded name for a resolved namespace and local name. */
export function expandedName(namespaceURI, localName) {
  return namespaceURI ? `{${namespaceURI}}${localName}` : localName;
}

function readName(raw, from) {
  // a tag name runs until whitespace, '/', or '>'
  let j = from;
  while (j < raw.length && !/[\s/>]/.test(raw[j])) j++;
  return raw.slice(from, j);
}

// ---- escaping / entities ---------------------------------------------------

// An '&' that already begins a valid entity / character reference (named, decimal,
// or hex). These must NOT be re-escaped, or a round-trip would corrupt existing
// markup (e.g. &nbsp; -> &amp;nbsp;). Every other '&' is a literal and is escaped.
const RE_BARE_AMP = /&(?!#[0-9]+;|#x[0-9a-fA-F]+;|[A-Za-z][A-Za-z0-9._-]*;)/g;

/**
 * Escape literal text for an XML text node, leaving existing entities intact.
 * @param {string} s The text to escape.
 * @returns {string} The escaped text.
 */
export function escapeText(s) {
  return String(s).replace(RE_BARE_AMP, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
/**
 * Escape a value for an XML attribute, leaving existing entities intact.
 * @param {string} s The value to escape.
 * @param {string} [quote] The enclosing quote character ('"' or "'").
 * @returns {string} The escaped attribute value.
 */
export function escapeAttr(s, quote = '"') {
  let out = String(s).replace(RE_BARE_AMP, "&amp;").replace(/</g, "&lt;");
  out = quote === "'" ? out.replace(/'/g, "&apos;") : out.replace(/"/g, "&quot;");
  return out;
}
/**
 * Decode XML entities and character references back to literal text.
 * @param {string} s The encoded text.
 * @returns {string} The decoded text.
 */
export function decodeEntities(s) {
  return String(s)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, "&");
}

// ---- tokenizer -------------------------------------------------------------

/** Scan a raw XML string into a contiguous list of tokens. Concatenating every
 *  token's [start,end) slice reproduces the input exactly.
 * @param {string} raw The raw XML string.
 * @returns {Token[]} The tokens in document order.
 */
export function tokenize(raw) {
  const n = raw.length;
  const toks = [];
  let i = 0;
  while (i < n) {
    if (raw[i] !== "<") {
      let j = raw.indexOf("<", i);
      if (j < 0) j = n;
      toks.push({ t: T.TEXT, start: i, end: j });
      i = j;
      continue;
    }
    // at '<'
    if (raw.startsWith("<!--", i)) {
      let j = raw.indexOf("-->", i);
      j = j < 0 ? n : j + 3;
      toks.push({ t: T.COMMENT, start: i, end: j });
      i = j;
      continue;
    }
    if (raw.startsWith("<![CDATA[", i)) {
      let j = raw.indexOf("]]>", i);
      j = j < 0 ? n : j + 3;
      toks.push({ t: T.CDATA, start: i, end: j });
      i = j;
      continue;
    }
    if (raw.startsWith("<?", i)) {
      let j = raw.indexOf("?>", i);
      j = j < 0 ? n : j + 2;
      const isDecl = /^<\?xml[\s?]/.test(raw.slice(i, i + 6));
      toks.push({ t: isDecl ? T.DECL : T.PI, start: i, end: j });
      i = j;
      continue;
    }
    if (raw.startsWith("<!", i)) {
      // DOCTYPE or markup declaration; respect an internal subset [ ... ]
      let j = i + 2, depth = 0;
      while (j < n) {
        const c = raw[j];
        if (c === "[") depth++;
        else if (c === "]") depth--;
        else if (c === ">" && depth <= 0) { j++; break; }
        j++;
      }
      toks.push({ t: T.DOCTYPE, start: i, end: Math.min(j, n) });
      i = Math.min(j, n);
      continue;
    }
    if (raw.startsWith("</", i)) {
      let j = raw.indexOf(">", i);
      j = j < 0 ? n : j + 1;
      toks.push({ t: T.ETAG, start: i, end: j, name: readName(raw, i + 2) });
      i = j;
      continue;
    }
    // start or empty-element tag: scan to the '>' that is not inside a quote
    {
      let j = i + 1, q = null;
      while (j < n) {
        const c = raw[j];
        if (q) { if (c === q) q = null; }
        else if (c === '"' || c === "'") q = c;
        else if (c === ">") break;
        j++;
      }
      const end = j < n ? j + 1 : n;
      const inner = raw.slice(i, end);
      const empty = /\/\s*>$/.test(inner);
      toks.push({ t: empty ? T.EMPTY : T.STAG, start: i, end, name: readName(raw, i + 1) });
      i = end;
    }
  }
  return toks;
}

// ---- attributes ------------------------------------------------------------

const RE_ATTR = /([^\s=/>]+)\s*=\s*("([^"]*)"|'([^']*)')/g;

function parseAttrs(raw, tagStart, tagEnd) {
  const seg = raw.slice(tagStart, tagEnd);
  const out = [];
  let m;
  RE_ATTR.lastIndex = 0;
  while ((m = RE_ATTR.exec(seg)) !== null) {
    const quote = m[2][0];
    const value = m[3] !== undefined ? m[3] : m[4];
    // offset of the value's first char (just after the opening quote)
    const valueStartRel = m.index + m[0].length - m[2].length + 1;
    const valueStart = tagStart + valueStartRel;
    const prefix = prefixOf(m[1]);
    out.push({
      name: m[1],
      localName: localOf(m[1]),
      prefix,
      namespaceURI: null,
      expandedName: localOf(m[1]),
      value: decodeEntities(value),
      rawValue: value,
      quote,
      valueStart,
      valueEnd: valueStart + value.length,
      start: tagStart + m.index,          // offset of the attribute name
      end: valueStart + value.length + 1, // offset just after the closing quote
    });
  }
  return out;
}

// ---- tree ------------------------------------------------------------------

function mkElement(raw, tk, empty, parent) {
  const attrs = parseAttrs(raw, tk.start, tk.end);
  const namespaces = parent?.namespaces
    ? new Map(parent.namespaces)
    : new Map([["xml", XML_NAMESPACE], ["xmlns", XMLNS_NAMESPACE], ["", null]]);
  for (const attr of attrs) {
    if (attr.name === "xmlns") namespaces.set("", attr.value || null);
    else if (attr.prefix === "xmlns") namespaces.set(attr.localName, attr.value || null);
  }
  const prefix = prefixOf(tk.name);
  const namespaceURI = namespaces.get(prefix || "") || null;
  for (const attr of attrs) {
    if (attr.name === "xmlns" || attr.prefix === "xmlns") attr.namespaceURI = XMLNS_NAMESPACE;
    else if (attr.prefix) attr.namespaceURI = namespaces.get(attr.prefix) || null;
    else attr.namespaceURI = null;
    attr.expandedName = expandedName(attr.namespaceURI, attr.localName);
  }
  return {
    type: "element",
    qname: tk.name,
    localName: localOf(tk.name),
    prefix,
    namespaceURI,
    expandedName: expandedName(namespaceURI, localOf(tk.name)),
    namespaces,
    attrs,
    outerStart: tk.start,
    stagStart: tk.start,
    stagEnd: tk.end,
    contentStart: empty ? null : tk.end,
    contentEnd: null,
    etagStart: null,
    etagEnd: null,
    outerEnd: empty ? tk.end : null,
    selfClosing: !!empty,
    parent: null,
    children: [],
  };
}

/**
 * Parse a raw TEI/XML string into an offset-true tree.
 * Returns a document handle: { raw, root, serialize() }.
 * serialize() is the raw string, so it is lossless regardless of tree fidelity.
 * @param {string} raw The raw TEI/XML string.
 * @returns {TeiDocument} The document handle.
 */
export function parseDocument(raw) {
  const toks = tokenize(raw);
  /** @type {TeiNode} */
  const root = { type: "root", localName: "#root", children: [], parent: null, start: 0, end: raw.length };
  const stack = [root];

  for (const tk of toks) {
    const top = stack[stack.length - 1];
    if (tk.t === T.TEXT) {
      top.children.push({ type: "text", start: tk.start, end: tk.end, parent: top });
    } else if (tk.t === T.COMMENT || tk.t === T.CDATA || tk.t === T.PI || tk.t === T.DECL || tk.t === T.DOCTYPE) {
      top.children.push({ type: tk.t, start: tk.start, end: tk.end, parent: top });
    } else if (tk.t === T.EMPTY) {
      const el = mkElement(raw, tk, true, top);
      el.parent = top;
      top.children.push(el);
    } else if (tk.t === T.STAG) {
      const el = mkElement(raw, tk, false, top);
      el.parent = top;
      top.children.push(el);
      stack.push(el);
    } else if (tk.t === T.ETAG) {
      // close the nearest matching open element (lenient on mismatch)
      let k = stack.length - 1;
      const want = tk.name;
      while (k > 0 && stack[k].qname !== want) k--;
      if (k > 0) {
        const el = stack[k];
        el.contentEnd = tk.start;
        el.etagStart = tk.start;
        el.etagEnd = tk.end;
        el.outerEnd = tk.end;
        stack.length = k; // pop el and anything left open inside it
      }
      // a stray end tag is ignored for the tree but still covered by serialize()
    }
  }
  return { raw, root, serialize: () => raw };
}

// ---- generic navigation / queries -----------------------------------------

/** Depth-first walk; visitor(node, parent) may return false to skip children.
 * @param {TeiNode} node The subtree root to walk.
 * @param {(node: TeiNode) => (boolean|void)} visitor Called per node; return false to skip children.
 * @returns {void}
 */
export function walk(node, visitor) {
  const go = (n) => {
    const cont = visitor(n);
    if (cont === false) return;
    if (n.children) for (const c of n.children) go(c);
  };
  go(node);
}

/** Resolve a QName against the namespace bindings in scope at an element. */
export function resolveQName(el, qname, { attribute = false } = {}) {
  const prefix = prefixOf(String(qname));
  const localName = localOf(String(qname));
  let namespaceURI = null;
  if (prefix === "xml") namespaceURI = XML_NAMESPACE;
  else if (prefix === "xmlns" || qname === "xmlns") namespaceURI = XMLNS_NAMESPACE;
  else if (prefix) namespaceURI = el?.namespaces?.get(prefix) || null;
  else if (!attribute) namespaceURI = el?.namespaces?.get("") || null;
  return { prefix, localName, namespaceURI, expandedName: expandedName(namespaceURI, localName) };
}

/** True when an element has the requested expanded name. */
export function isElementInNamespace(node, namespaceURI, localName) {
  return node?.type === "element"
    && node.namespaceURI === (namespaceURI || null)
    && (localName == null || node.localName === localName);
}

function legacyTeiRoot(node) {
  let top = node?.type === "element" ? node : node?.parent;
  while (top?.parent?.type === "element") top = top.parent;
  return top?.namespaceURI == null && top?.localName === "TEI";
}

/** TEI URI match, with document-scoped compatibility for unnamespaced <TEI>. */
export function isTeiElement(node, localName = null) {
  if (node?.type !== "element" || (localName != null && node.localName !== localName)) return false;
  return node.namespaceURI === TEI_NAMESPACE
    || (node.namespaceURI == null && legacyTeiRoot(node));
}

/** All TEI elements with a local name, in document order. */
export function teiElementsByLocal(node, localName) {
  const out = [];
  walk(node, (candidate) => {
    if (isTeiElement(candidate, localName)) out.push(candidate);
  });
  return out;
}

/** The first TEI element with a local name, or null. */
export function firstTeiByLocal(node, localName) {
  let found = null;
  walk(node, (candidate) => {
    if (found) return false;
    if (isTeiElement(candidate, localName)) { found = candidate; return false; }
  });
  return found;
}

/**
 * Decoded value of an element's attribute, matched by local-name, or null.
 * @param {TeiNode} el The element.
 * @param {string} localName The attribute local-name (e.g. "id" for xml:id).
 * @returns {string|null} The decoded value, or null when absent.
 */
export function getAttr(el, localName) {
  if (!el.attrs) return null;
  const a = el.attrs.find((x) => x.localName === localName);
  return a ? a.value : null;
}
/**
 * The parsed attribute object matched by local-name, or null.
 * @param {TeiNode} el The element.
 * @param {string} localName The attribute local-name.
 * @returns {Attr|null} The attribute object, or null when absent.
 */
export function getAttrObj(el, localName) {
  if (!el.attrs) return null;
  return el.attrs.find((x) => x.localName === localName) || null;
}

/** Attribute object matched by expanded name, or null. */
export function getAttrObjInNamespace(el, namespaceURI, localName) {
  if (!el?.attrs) return null;
  return el.attrs.find(
    (attr) => attr.namespaceURI === (namespaceURI || null) && attr.localName === localName,
  ) || null;
}

/** Decoded attribute value matched by expanded name, or null. */
export function getAttrInNamespace(el, namespaceURI, localName) {
  return getAttrObjInNamespace(el, namespaceURI, localName)?.value ?? null;
}

/** Decoded unqualified attribute value, or null. */
export function getUnqualifiedAttr(el, localName) {
  return getAttrInNamespace(el, null, localName);
}

/** The XML namespace's id value, or null. */
export function getXmlId(el) {
  return getAttrInNamespace(el, XML_NAMESPACE, "id");
}

/** All elements with the given local-name (namespace-agnostic), in document order.
 * @param {TeiNode} node The subtree root to search.
 * @param {string} localName The element local-name.
 * @returns {TeiNode[]} The matching elements.
 */
export function elementsByLocal(node, localName) {
  const out = [];
  walk(node, (n) => {
    if (n.type === "element" && n.localName === localName) out.push(n);
  });
  return out;
}

/** The first descendant element with the given local-name, or null.
 * @param {TeiNode} node The subtree root to search.
 * @param {string} localName The element local-name.
 * @returns {TeiNode|null} The first match, or null.
 */
export function firstByLocal(node, localName) {
  let found = null;
  walk(node, (n) => {
    if (found) return false;
    if (n.type === "element" && n.localName === localName) { found = n; return false; }
  });
  return found;
}

/** Text nodes under a subtree, in document order.
 * @param {TeiNode} node The subtree root.
 * @returns {TeiNode[]} The text nodes.
 */
export function textNodes(node) {
  const out = [];
  walk(node, (n) => {
    if (n.type === "text") out.push(n);
  });
  return out;
}

/** Decoded text for a text node.
 * @param {TeiDocument} doc The document.
 * @param {TeiNode} node The text node.
 * @returns {string} The decoded text.
 */
export function textOf(doc, node) {
  return decodeEntities(doc.raw.slice(node.start, node.end));
}

/**
 * Split a text run into [lead, core, trail] where lead/trail are the edge
 * whitespace (insignificant indentation/newlines) and core is the part a human
 * actually edits or marks. Shared by the cell editor (edition.js) and the
 * textual-critical wrappers (criticism.js) so both preserve edge whitespace the
 * same way. For a word-level <w>text</w> node both edges are empty.
 * @param {string} text The text run.
 * @returns {[string, string, string]} The [lead, core, trail] triple.
 */
export function splitEdge(text) {
  const lead = (text.match(/^\s*/) || [""])[0];
  const trail = (text.match(/\s*$/) || [""])[0];
  return [lead, text.slice(lead.length, text.length - trail.length), trail];
}

/** Nearest ancestor element (exclusive of node) satisfying pred, or null.
 * @param {TeiNode} node The node to start from.
 * @param {(el: TeiNode) => boolean} pred Predicate tested on each ancestor element.
 * @returns {TeiNode|null} The nearest matching ancestor, or null.
 */
export function nearestAncestor(node, pred) {
  let p = node.parent;
  while (p && p.type === "element") {
    if (pred(p)) return p;
    p = p.parent;
  }
  return null;
}
/** Nearest ancestor element (inclusive of parents) carrying @xml:id, or null.
 * @param {TeiNode} node The node to start from.
 * @returns {TeiNode|null} The nearest ancestor with an xml:id, or null.
 */
export function ancestorWithXmlId(node) {
  return nearestAncestor(node, (p) => getXmlId(p) != null);
}
// ---- lossless edit operations ---------------------------------------------

function splice(raw, start, end, replacement) {
  return raw.slice(0, start) + replacement + raw.slice(end);
}

/** Replace a text node's content. Returns a NEW document (re-parsed), so offsets
 *  stay correct. Only that text run is spliced; everything else is byte-identical.
 * @param {TeiDocument} doc The document.
 * @param {TeiNode} node The text node to edit.
 * @param {string} newText The replacement text (unescaped).
 * @returns {TeiDocument} A new document, or the same one on a semantic no-op.
 */
export function editTextNode(doc, node, newText) {
  const rawSlice = doc.raw.slice(node.start, node.end);
  // Semantic no-op: the user's text decodes to exactly what is already there, so
  // re-serializing would only churn entity spellings. Leave the bytes untouched.
  if (decodeEntities(rawSlice) === String(newText)) return doc;
  const escaped = escapeText(newText);
  if (escaped === rawSlice) return doc;
  return parseDocument(splice(doc.raw, node.start, node.end, escaped));
}

/** Replace an attribute value (by its parsed attr object). Returns a NEW document.
 * @param {TeiDocument} doc The document.
 * @param {Attr} attr The parsed attribute object to edit.
 * @param {string} newValue The replacement value (unescaped).
 * @returns {TeiDocument} A new document, or the same one on a semantic no-op.
 */
export function editAttrValue(doc, attr, newValue) {
  // Same semantic-no-op guard as editTextNode, on the attribute path.
  if (decodeEntities(attr.rawValue) === String(newValue)) return doc;
  const escaped = escapeAttr(newValue, attr.quote);
  if (escaped === attr.rawValue) return doc;
  return parseDocument(splice(doc.raw, attr.valueStart, attr.valueEnd, escaped));
}

/** Low-level lossless splice by absolute offsets. Returns a NEW document.
 * @param {TeiDocument} doc The document.
 * @param {number} start Inclusive byte offset to splice from.
 * @param {number} end Exclusive byte offset to splice to.
 * @param {string} replacement The replacement string.
 * @returns {TeiDocument} A new document with the splice applied.
 */
export function spliceDocument(doc, start, end, replacement) {
  return parseDocument(splice(doc.raw, start, end, replacement));
}

/** Qualify element tags introduced around an existing source slice. */
function qualifyAddedMarkup(fragment, prefix) {
  if (!prefix) return fragment;
  return fragment.replace(
    /<(\/?)([A-Za-z_][A-Za-z0-9_.-]*)(?=[\s/>])/g,
    (_match, close, qname) => `<${close}${prefix}:${qname}`,
  );
}

/** Qualify unprefixed TEI tags for the prefix used by an insertion context. */
export function qualifyTeiMarkup(fragment, context) {
  if (!isTeiElement(context)) return null;
  return qualifyAddedMarkup(fragment, context.prefix);
}

/** True when a markup fragment contributes text outside its tags. */
function contributesText(fragment) {
  return fragment.replace(/<[^>]*>/g, "").length > 0;
}

/** True when before/after are matching tag stacks that enclose the inner slice. */
function isWrappingMarkup(before, after) {
  const beforeTags = before.match(/<[^>]+>/g) || [];
  const afterTags = after.match(/<[^>]+>/g) || [];
  if (!beforeTags.length || beforeTags.join("") !== before || afterTags.join("") !== after) return false;
  const qnames = [];
  for (const tag of beforeTags) {
    const match = /^<([A-Za-z_][A-Za-z0-9_.:-]*)(?:\s[^>]*)?>$/.exec(tag);
    if (!match) return false;
    qnames.push(match[1]);
  }
  if (afterTags.length !== qnames.length) return false;
  for (let i = 0; i < afterTags.length; i++) {
    const match = /^<\/([A-Za-z_][A-Za-z0-9_.:-]*)\s*>$/.exec(afterTags[i]);
    if (!match || match[1] !== qnames[qnames.length - 1 - i]) return false;
  }
  return true;
}

/**
 * Wrap a source-contiguous sequence of sibling elements in markup produced by
 * `build(inner)`. Text nodes between the elements stay inside the wrapper;
 * comments, processing instructions, and intervening elements refuse the whole
 * operation. The existing inner bytes must occur exactly once in the build and
 * the added fragments may contain tags only, so reading text cannot change.
 * Newly introduced unprefixed tags inherit the common TEI parent's prefix.
 *
 * @param {TeiDocument} doc The source document.
 * @param {TeiNode[]} elements Ordered direct sibling elements to wrap.
 * @param {(inner: string) => string} build Builds the wrapper around exact source bytes.
 * @returns {TeiDocument} A new document, or the same document when unsafe.
 */
export function wrapSiblingElementRange(doc, elements, build) {
  if (!doc || !Array.isArray(elements) || elements.length < 2 || typeof build !== "function") return doc;
  if (elements.some((element) => !element || element.type !== "element" || element.outerStart == null || element.outerEnd == null)) return doc;
  const parent = elements[0].parent;
  if (!parent || parent.type !== "element" || elements.some((element) => element.parent !== parent)) return doc;
  if (isTeiElement(elements[0]) && !isTeiElement(parent)) return doc;

  const positions = elements.map((element) => parent.children.indexOf(element));
  if (positions.some((position) => position < 0)) return doc;
  for (let i = 1; i < positions.length; i++) if (positions[i] <= positions[i - 1]) return doc;

  let selectedIndex = 0;
  for (const child of parent.children.slice(positions[0], positions[positions.length - 1] + 1)) {
    if (child.type === "text") continue;
    if (child !== elements[selectedIndex]) return doc;
    selectedIndex += 1;
  }
  if (selectedIndex !== elements.length) return doc;

  const start = elements[0].outerStart;
  const end = elements[elements.length - 1].outerEnd;
  const inner = doc.raw.slice(start, end);
  if (!inner) return doc;
  const built = build(inner);
  if (typeof built !== "string") return doc;
  const at = built.indexOf(inner);
  if (at < 0 || built.indexOf(inner, at + inner.length) >= 0) return doc;
  const before = built.slice(0, at);
  const after = built.slice(at + inner.length);
  if (contributesText(before) || contributesText(after) || !isWrappingMarkup(before, after)) return doc;

  const sourcePrefix = parent.prefix;
  const replacement = qualifyAddedMarkup(before, sourcePrefix) + inner
    + qualifyAddedMarkup(after, sourcePrefix);
  if (replacement === inner) return doc;
  return spliceDocument(doc, start, end, replacement);
}

/** Remove an attribute (by local-name) from an element, including the single
 *  separating space before it. Returns a NEW document, or the SAME doc if absent.
 * @param {TeiDocument} doc The document.
 * @param {TeiNode} el The element.
 * @param {string} localName The attribute local-name to remove.
 * @returns {TeiDocument} A new document, or the same one when absent.
 */
export function removeAttr(doc, el, localName) {
  const attr = getAttrObj(el, localName);
  return removeParsedAttr(doc, attr);
}

/** Remove one attribute selected by expanded name. */
export function removeAttrInNamespace(doc, el, namespaceURI, localName) {
  return removeParsedAttr(doc, getAttrObjInNamespace(el, namespaceURI, localName));
}

function removeParsedAttr(doc, attr) {
  if (!attr || attr.start == null) return doc;
  let start = attr.start;
  if (start > 0 && /\s/.test(doc.raw[start - 1])) start -= 1; // eat one leading space
  return parseDocument(splice(doc.raw, start, attr.end, ""));
}

// QName: NCName with one optional prefix colon. Enough to reject injection and
// malformed names, not a full XML 1.0 name check.
const RE_QNAME = /^[A-Za-z_][A-Za-z0-9_.-]*(?::[A-Za-z_][A-Za-z0-9_.-]*)?$/;

/** True if the element carries an attribute with this exact qualified name.
 * @param {TeiNode} el The element.
 * @param {string} qname The exact qualified attribute name.
 * @returns {boolean} True when present.
 */
export function hasAttrQName(el, qname) {
  return !!(el.attrs && el.attrs.some((a) => a.name === qname));
}

/** Add an attribute, inserted directly after the element name. Returns a NEW
 *  document, or the SAME doc when the name is not a valid qualified name or
 *  the element already carries that exact qname. Unlike getAttr/removeAttr
 *  (local-name based), presence is checked by exact qname, so xml:id and id
 *  stay distinct.
 * @param {TeiDocument} doc The document.
 * @param {TeiNode} el The element.
 * @param {string} name The qualified attribute name to add.
 * @param {string} value The attribute value (unescaped).
 * @returns {TeiDocument} A new document, or the same one when invalid or present.
 */
export function addAttr(doc, el, name, value) {
  if (!RE_QNAME.test(String(name)) || hasAttrQName(el, name)) return doc;
  const at = el.stagStart + 1 + el.qname.length;
  const ins = ` ${name}="${escapeAttr(value, '"')}"`;
  return parseDocument(splice(doc.raw, at, at, ins));
}

/**
 * Edit one element's text content and attribute values in a SINGLE re-parse.
 * `text` (string) replaces the element's text content; `set` maps exact qnames to
 * a string (set/add) or null (remove). All edits are computed against doc.raw,
 * applied in one descending pass so earlier offsets stay valid, then parsed once;
 * never re-parse between splices. Returns a NEW document, or the SAME doc when
 * nothing remains to change. Atomic: if any requested part is invalid or
 * unrepresentable (e.g. text on an element that is not a single text child),
 * the whole op is refused and the SAME doc is returned.
 *
 * Attributes resolve by EXACT qname (so xml:id and id stay distinct), unlike
 * getAttrObj which matches local-name. Absent attributes given a string value are
 * concatenated into one insertion just after the element name, in `set` order.
 * @param {TeiDocument} doc The document.
 * @param {TeiNode} el The element to edit.
 * @param {{ text?: string, set?: Object<string, (string|null)> }} [edits] The edits
 *   to apply: `text` replaces the element's single text child; `set` maps exact
 *   qnames to a string (set/add) or null (remove).
 * @returns {TeiDocument} A new document, or the same one when nothing changes or
 *   the op is refused.
 */
export function editTextAndAttrs(doc, el, { text, set } = {}) {
  if (!el || el.type !== "element" || !el.attrs || el.stagStart == null) return doc;

  const wantText = typeof text === "string";
  if (wantText) {
    // Text replacement is only representable when the element wraps exactly one
    // text node; any other shape (children, multiple nodes, empty, self-closing)
    // would need structural editing, so the whole op is refused for atomicity.
    const kids = el.children;
    if (!(kids && kids.length === 1 && kids[0].type === "text")) return doc;
  }

  const byName = new Map();
  for (const a of el.attrs) byName.set(a.name, a);

  const splices = [];      // { start, end, repl } against doc.raw, no overlaps
  let addIns = "";         // concatenated insertion for absent attributes

  if (set && typeof set === "object") {
    for (const qname of Object.keys(set)) {
      const value = set[qname];
      const attr = byName.get(qname);
      if (value === null) {
        // Remove: drop the attribute and one preceding whitespace char if present.
        if (!attr || attr.start == null) continue; // absent: no-op entry
        let start = attr.start;
        if (start > 0 && /\s/.test(doc.raw[start - 1])) start -= 1;
        splices.push({ start, end: attr.end, repl: "" });
      } else if (typeof value === "string") {
        if (!RE_QNAME.test(qname)) return doc; // invalid name refuses the whole op
        if (attr) {
          // Replace value in place; skip the splice when it is a semantic no-op.
          const escaped = escapeAttr(value, attr.quote);
          if (decodeEntities(attr.rawValue) === value || escaped === attr.rawValue) continue;
          splices.push({ start: attr.valueStart, end: attr.valueEnd, repl: escaped });
        } else {
          addIns += ` ${qname}="${escapeAttr(value, '"')}"`;
        }
      }
      // any other value type is ignored
    }
  }

  if (addIns) {
    const at = el.stagStart + 1 + el.qname.length;
    splices.push({ start: at, end: at, repl: addIns });
  }

  if (wantText) {
    const child = el.children[0];
    const rawSlice = doc.raw.slice(child.start, child.end);
    const escaped = escapeText(text);
    // Same semantic no-op guard as editTextNode.
    if (!(decodeEntities(rawSlice) === text || escaped === rawSlice)) {
      splices.push({ start: child.start, end: child.end, repl: escaped });
    }
  }

  if (splices.length === 0) return doc;

  splices.sort((a, b) => b.start - a.start);
  let raw = doc.raw;
  for (const s of splices) raw = splice(raw, s.start, s.end, s.repl);
  return parseDocument(raw);
}

// ---- Layer 2: generic, schema-free TEI recognizers -------------------------

// Milestone elements: empty markers that segment the text without wrapping it.
export const MILESTONE_LOCALS = new Set(["lb", "pb", "cb", "gb", "milestone"]);
// Textual-critical wrappers handled by the editor (M3.6): unclear/del/add wrap
// reading text; gap is the empty marker that stands in for omitted/illegible text.
export const CRITICAL_LOCALS = new Set(["unclear", "del", "add", "gap"]);
const NON_READING_LOCALS = new Set(["teiHeader", "facsimile", "standOff", "fsdecl", "sourceDoc"]);

/** A facsimile pointer value (without the leading '#') from @facs, or null.
 * @param {TeiNode} el The element.
 * @returns {string|null} The pointer target id, or null.
 */
export function facsPointer(el) {
  const v = isTeiElement(el) ? getUnqualifiedAttr(el, "facs") : null;
  return v ? v.replace(/^#/, "") : null;
}

/** Collect surfaces and their zones with numeric coordinates, generically.
 * @param {TeiDocument} doc The document.
 * @returns {{ surfaces: TeiSurface[], byId: Map<string, TeiSurface> }} The surfaces and an id index.
 */
export function readSurfaces(doc) {
  const surfaces = [];
  const byId = new Map();
  for (const s of teiElementsByLocal(doc.root, "surface")) {
    const id = getXmlId(s);
    // A surface may carry a <graphic url="..."> page image; expose its url so the
    // facsimile viewer can show an opened file's image without a hardcoded base.
    const graphicEl = teiElementsByLocal(s, "graphic")[0] || null;
    /** @type {TeiSurface} */
    const surf = {
      id,
      n: getUnqualifiedAttr(s, "n"),
      ulx: num(getUnqualifiedAttr(s, "ulx")), uly: num(getUnqualifiedAttr(s, "uly")),
      lrx: num(getUnqualifiedAttr(s, "lrx")), lry: num(getUnqualifiedAttr(s, "lry")),
      graphic: graphicEl ? getUnqualifiedAttr(graphicEl, "url") : null,
      zones: [],
    };
    for (const z of teiElementsByLocal(s, "zone")) {
      const zone = {
        id: getXmlId(z),
        ulx: num(getUnqualifiedAttr(z, "ulx")), uly: num(getUnqualifiedAttr(z, "uly")),
        lrx: num(getUnqualifiedAttr(z, "lrx")), lry: num(getUnqualifiedAttr(z, "lry")),
        points: getUnqualifiedAttr(z, "points"),
      };
      // Transkribus-style zones (Wenzelsbibel) carry only a @points polygon,
      // no ulx/uly/lrx/lry; derive the bounding box so overlays can place them.
      if (zone.ulx == null && zone.lrx == null && zone.points) applyPointsBbox(zone);
      surf.zones.push(zone);
    }
    surfaces.push(surf);
    if (id) byId.set(id, surf);
  }
  return { surfaces, byId };
}

/** Fill zone.ulx/uly/lrx/lry from its @points polygon ("x,y x,y ..."), in place. */
function applyPointsBbox(zone) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const pair of zone.points.trim().split(/\s+/)) {
    const comma = pair.indexOf(",");
    if (comma < 0) return;
    const x = Number(pair.slice(0, comma));
    const y = Number(pair.slice(comma + 1));
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  if (maxX > minX && maxY > minY) {
    zone.ulx = minX; zone.uly = minY; zone.lrx = maxX; zone.lry = maxY;
  }
}

/** Zones indexed by their own xml:id (for direct @facs -> zone resolution).
 * @param {TeiSurface[]} surfaces The surfaces to index.
 * @returns {Map<string, { surface: TeiSurface, zone: Zone|null }>} The id-to-target index.
 */
export function indexZonesById(surfaces) {
  const map = new Map();
  for (const s of surfaces) {
    if (s.id) map.set(s.id, { surface: s, zone: null });
    for (const z of s.zones) if (z.id) map.set(z.id, { surface: s, zone: z });
  }
  return map;
}

/** The subtree that holds the reading text: <body>, else <text>, else root.
 * @param {TeiDocument} doc The document.
 * @returns {TeiNode} The reading-text subtree root.
 */
export function readingRoot(doc) {
  const documentElement = (doc.root.children || []).find((node) => isTeiElement(node)) || null;
  if (isTeiElement(documentElement, "teiCorpus")) return documentElement;
  if (isTeiElement(documentElement, "TEI")) {
    const text = (documentElement.children || []).find((node) => isTeiElement(node, "text")) || null;
    const body = text && (text.children || []).find((node) => isTeiElement(node, "body"));
    return body || text || documentElement;
  }
  return firstTeiByLocal(doc.root, "body") || firstTeiByLocal(doc.root, "text") || doc.root;
}

/**
 * Is this node inside the readable transcription (no header/facsimile/standOff/
 * sourceDoc/fsdecl ancestor)? Works for any node kind, so the same exclusion gates
 * both text-node cells and element markers (e.g. a <gap/>) consistently.
 * @param {TeiNode} node The node to test.
 * @returns {boolean} True when no non-reading ancestor is present.
 */
export function isReadingContext(node) {
  return nearestAncestor(node, (p) => isTeiElement(p) && NON_READING_LOCALS.has(p.localName)) == null;
}

/** Is this text node part of the readable transcription (not header/facsimile/standOff)?
 * @param {TeiNode} node The node to test.
 * @returns {boolean} True for a reading-context text node.
 */
export function isReadingText(node) {
  return node.type === "text" && isReadingContext(node);
}

function num(v) {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Count elements by local-name across the whole document (namespace-agnostic).
 * @param {TeiDocument} doc The document.
 * @param {string[]} locals The local-names to count.
 * @returns {Object<string, number>} A map from local-name to its count.
 */
export function countLocals(doc, locals) {
  /** @type {Object<string, number>} */
  const out = {};
  for (const l of locals) out[l] = 0;
  walk(doc.root, (n) => {
    if (n.type === "element" && out[n.localName] !== undefined) out[n.localName]++;
  });
  return out;
}
