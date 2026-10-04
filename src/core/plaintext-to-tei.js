/**
 * Deterministic plaintext intake: minimal line-level TEI from a plaintext file
 * so it opens in the same editor. This is transport, not interpretation. The
 * text is carried verbatim (XML-escaped only), no model is involved, and the
 * same input always yields the same output, so the result never carries the
 * model-provenance marking.
 *
 * Pure module: no DOM, no fetch, mutates nothing.
 */

import { escapeAttr, escapeText } from "./tei-document.js";

const MARKER = /\|(\d+)\|/g;

// xml:id stem for the generated facsimile surfaces; @facs on each <pb> points here.
const SURFACE_ID_PREFIX = "surface_";

/**
 * Render one physical input line. `emitText` owns the paragraph state that
 * keeps the first segment bare, so <lb/> marks the break between lines rather
 * than the start of the first. `pbTag` owns the running page index. At most
 * one space directly bordering a marker is dropped, because it is the
 * conventional padding around the marker, not text.
 *
 * @param {string} line
 * @param {(n: string) => string} pbTag
 * @param {(segment: string) => string} emitText
 * @returns {string}
 */
function renderLine(line, pbTag, emitText) {
  MARKER.lastIndex = 0;
  if (!MARKER.test(line)) return emitText(line);

  let result = "";
  let pos = 0;
  let match;
  MARKER.lastIndex = 0;
  while ((match = MARKER.exec(line)) !== null) {
    let segment = line.slice(pos, match.index);
    if (segment.endsWith(" ")) segment = segment.slice(0, -1);
    if (segment !== "") result += emitText(segment);
    result += pbTag(match[1]);
    pos = match.index + match[0].length;
    if (line[pos] === " ") pos += 1;
  }
  const tail = line.slice(pos);
  if (tail !== "") result += emitText(tail);
  return result;
}

/**
 * Minimal line-level TEI from plaintext.
 *
 * - Paragraphs split on blank lines (whitespace-only counts as blank).
 * - Inside a paragraph, <lb/> marks each break between lines.
 * - A token |N| (N = ASCII digits) becomes <pb n="N"/>; a page break implies a
 *   line break. Anything not matching |\d+| stays verbatim text.
 * - A leading <pb n="1"/> opens the body.
 * - Output newlines are LF; input CRLF and CR are line breaks, not content.
 *
 * `options.images` lists page images in page order, e.g. [{ name: "IMG.1.jpg" }].
 * Each <pb> in document order binds by position to the image at the same index
 * (the leading page is index 0, each |N| marker the next), gets @facs, and a
 * matching <facsimile><surface><graphic url> is emitted. Page-break positions
 * come only from the text. A page without an image gets no @facs; surplus
 * images are dropped, the caller reconciles counts beforehand.
 *
 * @param {string} text Plaintext source.
 * @param {string} [title] Document title, typically the file name without extension.
 * @param {{ images?: Array<{ name: string }> }} [options]
 * @returns {string} A complete TEI document.
 */
export function teiFromPlaintext(text, title, options = {}) {
  const safeTitle = escapeText(String(title || "Untitled"));
  const images = Array.isArray(options.images)
    ? options.images.filter((image) => image?.name)
    : [];
  const lines = String(text).split(/\r\n|\r|\n/);

  let pageSeq = 0;
  /** @param {string} n */
  const pbTag = (n) => {
    const facs = pageSeq < images.length ? ` facs="#${SURFACE_ID_PREFIX}${pageSeq + 1}"` : "";
    pageSeq++;
    return `<pb n="${escapeAttr(String(n))}"${facs}/>`;
  };

  /** @type {string[][]} */
  const paras = [];
  /** @type {string[]} */
  let current = [];
  for (const line of lines) {
    if (line.trim() === "") {
      if (current.length) { paras.push(current); current = []; }
    } else {
      current.push(line);
    }
  }
  if (current.length) paras.push(current);

  // The leading page break is emitted first so it claims page index 0 before
  // the body markers claim the following indices in document order.
  const leadPb = pbTag("1");
  const body = paras.length
    ? paras.map((para) => {
        let started = false;
        /** @param {string} segment */
        const emitText = (segment) => {
          const prefix = started ? "<lb/>" : "";
          started = true;
          return prefix + escapeText(segment);
        };
        return `        <p>${para.map((line) => renderLine(line, pbTag, emitText)).join("\n          ")}</p>`;
      }).join("\n")
    : "        <p/>";

  // Only surfaces a <pb> references, so surplus images leave no orphan surface.
  const bound = images.slice(0, pageSeq);
  const facsimile = bound.length
    ? `  <facsimile>\n${
        bound.map((image, i) => `    <surface xml:id="${SURFACE_ID_PREFIX}${i + 1}"><graphic url="${escapeAttr(image.name)}"/></surface>`).join("\n")
      }\n  </facsimile>\n`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <teiHeader>
    <fileDesc>
      <titleStmt>
        <title>${safeTitle}</title>
      </titleStmt>
      <publicationStmt>
        <p>Unpublished draft. Drafted deterministically from plaintext by teiCrafter; the text is carried verbatim, no machine interpretation is involved.</p>
      </publicationStmt>
      <sourceDesc>
        <p>Plaintext file: ${safeTitle}</p>
      </sourceDesc>
    </fileDesc>
  </teiHeader>
${facsimile}  <text>
    <body>
      ${leadPb}
${body}
    </body>
  </text>
</TEI>
`;
}
