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
 * Layer 2 here: generic, schema-free TEI recognizers keyed on local-name.
 * Layer 3 (the editable "cells" = text nodes grouped into lines/folios) lives in
 * edition.js, which is a thin model built on this core.
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
function readName(raw, from) {
  // a tag name runs until whitespace, '/', or '>'
  let j = from;
  while (j < raw.length && !/[\s/>]/.test(raw[j])) j++;
  return raw.slice(from, j);
}

// ---- escaping / entities ---------------------------------------------------

export function escapeText(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
export function escapeAttr(s, quote = '"') {
  let out = String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  out = quote === "'" ? out.replace(/'/g, "&apos;") : out.replace(/"/g, "&quot;");
  return out;
}
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
 *  token's [start,end) slice reproduces the input exactly. */
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
    out.push({
      name: m[1],
      localName: localOf(m[1]),
      value: decodeEntities(value),
      rawValue: value,
      quote,
      valueStart,
      valueEnd: valueStart + value.length,
    });
  }
  return out;
}

// ---- tree ------------------------------------------------------------------

function mkElement(raw, tk, empty) {
  return {
    type: "element",
    qname: tk.name,
    localName: localOf(tk.name),
    prefix: prefixOf(tk.name),
    attrs: parseAttrs(raw, tk.start, tk.end),
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
 */
export function parseDocument(raw) {
  const toks = tokenize(raw);
  const root = { type: "root", localName: "#root", children: [], parent: null, start: 0, end: raw.length };
  const stack = [root];

  for (const tk of toks) {
    const top = stack[stack.length - 1];
    if (tk.t === T.TEXT) {
      top.children.push({ type: "text", start: tk.start, end: tk.end, parent: top });
    } else if (tk.t === T.COMMENT || tk.t === T.CDATA || tk.t === T.PI || tk.t === T.DECL || tk.t === T.DOCTYPE) {
      top.children.push({ type: tk.t, start: tk.start, end: tk.end, parent: top });
    } else if (tk.t === T.EMPTY) {
      const el = mkElement(raw, tk, true);
      el.parent = top;
      top.children.push(el);
    } else if (tk.t === T.STAG) {
      const el = mkElement(raw, tk, false);
      el.parent = top;
      top.children.push(el);
      stack.push(el);
    } else if (tk.t === T.ETAG) {
      // close the nearest matching open element (lenient on mismatch)
      let k = stack.length - 1;
      const want = localOf(tk.name);
      while (k > 0 && stack[k].localName !== want) k--;
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

/** Depth-first walk; visitor(node, parent) may return false to skip children. */
export function walk(node, visitor) {
  const go = (n) => {
    const cont = visitor(n);
    if (cont === false) return;
    if (n.children) for (const c of n.children) go(c);
  };
  go(node);
}

export function getAttr(el, localName) {
  if (!el.attrs) return null;
  const a = el.attrs.find((x) => x.localName === localName);
  return a ? a.value : null;
}
export function getAttrObj(el, localName) {
  if (!el.attrs) return null;
  return el.attrs.find((x) => x.localName === localName) || null;
}

/** All elements with the given local-name (namespace-agnostic), in document order. */
export function elementsByLocal(node, localName) {
  const out = [];
  walk(node, (n) => {
    if (n.type === "element" && n.localName === localName) out.push(n);
  });
  return out;
}

/** The first descendant element with the given local-name, or null. */
export function firstByLocal(node, localName) {
  let found = null;
  walk(node, (n) => {
    if (found) return false;
    if (n.type === "element" && n.localName === localName) { found = n; return false; }
  });
  return found;
}

/** Text nodes under a subtree, in document order. */
export function textNodes(node) {
  const out = [];
  walk(node, (n) => {
    if (n.type === "text") out.push(n);
  });
  return out;
}

/** Raw slice for any node. */
export function rawOf(doc, node) {
  return doc.raw.slice(node.start, node.end);
}
/** Decoded text for a text node. */
export function textOf(doc, node) {
  return decodeEntities(doc.raw.slice(node.start, node.end));
}

/** Nearest ancestor element (inclusive of parents) carrying @xml:id, or null. */
export function ancestorWithXmlId(node) {
  let p = node.parent;
  while (p && p.type === "element") {
    if (getAttr(p, "id") != null) return p;
    p = p.parent;
  }
  return null;
}
/** True if the node has an ancestor with the given local-name. */
export function hasAncestorLocal(node, localName) {
  let p = node.parent;
  while (p && p.type === "element") {
    if (p.localName === localName) return true;
    p = p.parent;
  }
  return false;
}

// ---- lossless edit operations ---------------------------------------------

function splice(raw, start, end, replacement) {
  return raw.slice(0, start) + replacement + raw.slice(end);
}

/** Replace a text node's content. Returns a NEW document (re-parsed), so offsets
 *  stay correct. Only that text run is spliced; everything else is byte-identical. */
export function editTextNode(doc, node, newText) {
  const escaped = escapeText(newText);
  if (escaped === doc.raw.slice(node.start, node.end)) return doc;
  return parseDocument(splice(doc.raw, node.start, node.end, escaped));
}

/** Replace an attribute value (by its parsed attr object). Returns a NEW document. */
export function editAttrValue(doc, attr, newValue) {
  const escaped = escapeAttr(newValue, attr.quote);
  if (escaped === attr.rawValue) return doc;
  return parseDocument(splice(doc.raw, attr.valueStart, attr.valueEnd, escaped));
}

/** Low-level lossless splice by absolute offsets. Returns a NEW document. */
export function spliceDocument(doc, start, end, replacement) {
  return parseDocument(splice(doc.raw, start, end, replacement));
}

// ---- Layer 2: generic, schema-free TEI recognizers -------------------------

export const MILESTONE_LOCALS = new Set(["lb", "pb", "cb", "gb", "milestone"]);
export const ENTITY_LOCALS = new Set(["persName", "placeName", "orgName", "geogName", "date", "name", "rs"]);
const NON_READING_LOCALS = new Set(["teiHeader", "facsimile", "standOff", "fsdecl", "sourceDoc"]);

export function isMilestone(node) {
  return node.type === "element" && MILESTONE_LOCALS.has(node.localName);
}
export function isEntity(node) {
  return node.type === "element" && ENTITY_LOCALS.has(node.localName);
}
/** A facsimile pointer value (without the leading '#') from @facs, or null. */
export function facsPointer(el) {
  const v = getAttr(el, "facs");
  return v ? v.replace(/^#/, "") : null;
}

/** Collect surfaces and their zones with numeric coordinates, generically. */
export function readSurfaces(doc) {
  const surfaces = [];
  const byId = new Map();
  for (const s of elementsByLocal(doc.root, "surface")) {
    const id = getAttr(s, "id");
    const surf = {
      id,
      n: getAttr(s, "n"),
      ulx: num(getAttr(s, "ulx")), uly: num(getAttr(s, "uly")),
      lrx: num(getAttr(s, "lrx")), lry: num(getAttr(s, "lry")),
      zones: [],
    };
    for (const z of elementsByLocal(s, "zone")) {
      surf.zones.push({
        id: getAttr(z, "id"),
        ulx: num(getAttr(z, "ulx")), uly: num(getAttr(z, "uly")),
        lrx: num(getAttr(z, "lrx")), lry: num(getAttr(z, "lry")),
        points: getAttr(z, "points"),
      });
    }
    surfaces.push(surf);
    if (id) byId.set(id, surf);
  }
  return { surfaces, byId };
}

/** Zones indexed by their own xml:id (for direct @facs -> zone resolution). */
export function indexZonesById(surfaces) {
  const map = new Map();
  for (const s of surfaces) {
    if (s.id) map.set(s.id, { surface: s, zone: null });
    for (const z of s.zones) if (z.id) map.set(z.id, { surface: s, zone: z });
  }
  return map;
}

/** The subtree that holds the reading text: <body>, else <text>, else root. */
export function readingRoot(doc) {
  return firstByLocal(doc.root, "body") || firstByLocal(doc.root, "text") || doc.root;
}

/** Is this text node part of the readable transcription (not header/facsimile/standOff)? */
export function isReadingText(node) {
  if (node.type !== "text") return false;
  let p = node.parent;
  while (p && p.type === "element") {
    if (NON_READING_LOCALS.has(p.localName)) return false;
    p = p.parent;
  }
  return true;
}

function num(v) {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Count elements by local-name across the whole document (namespace-agnostic). */
export function countLocals(doc, locals) {
  const out = {};
  for (const l of locals) out[l] = 0;
  walk(doc.root, (n) => {
    if (n.type === "element" && out[n.localName] !== undefined) out[n.localName]++;
  });
  return out;
}
