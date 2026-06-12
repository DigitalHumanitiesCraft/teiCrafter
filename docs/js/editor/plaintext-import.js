/**
 * teiCrafter Editor -- deterministic plaintext intake.
 *
 * Turns a plaintext file into minimal line-level TEI so it opens in the same
 * editor: paragraphs split on blank lines, <lb/> marking the break BETWEEN lines
 * (the first line of a paragraph stays bare, the <p> already opens it). This is
 * transport, not
 * interpretation: the text is carried verbatim (XML-escaped only), no model
 * is involved and the same input always yields the same output. It therefore
 * does NOT use the violet AI marking, which is reserved for machine-plausible
 * content a human still has to judge.
 *
 * Page-break markers: a token |N| (N = ASCII digits) becomes <pb n="N"/>;
 * a page break implies a line break, so each segment after a marker starts a
 * new <lb/> line. One conventional space directly bordering the marker is
 * dropped; anything not matching |\d+| stays verbatim text.
 *
 * Pure module: no DOM, no fetch, mutates nothing.
 */

function escapeText(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Escape a string for use inside a double-quoted attribute (e.g. a filename). */
function escapeAttr(s) {
  return escapeText(s).replace(/"/g, "&quot;");
}

const MARKER = /\|(\d+)\|/g;

// xml:id stem for the generated facsimile surfaces; @facs on each <pb> points here.
const SURFACE_ID_PREFIX = "surface_";

/**
 * Render one physical input line into TEI tokens. emitText(seg) escapes a text
 * segment and prefixes <lb/> for every segment except the first one of the
 * paragraph (the caller owns that running state), so <lb/> marks the break
 * between lines, not the start of the first. A marker becomes a <pb> via
 * pbTag(n) (which owns the running page index and the optional @facs). At most
 * one space directly bordering a marker is trimmed.
 */
function renderLine(line, pbTag, emitText) {
  MARKER.lastIndex = 0;
  if (!MARKER.test(line)) return emitText(line);

  let result = "";
  let pos = 0;
  let m;
  MARKER.lastIndex = 0;
  while ((m = MARKER.exec(line)) !== null) {
    let seg = line.slice(pos, m.index);
    if (seg.endsWith(" ")) seg = seg.slice(0, -1);
    if (seg !== "") result += emitText(seg);
    result += pbTag(m[1]);
    pos = m.index + m[0].length;
    if (line[pos] === " ") pos += 1;
  }
  const tail = line.slice(pos);
  if (tail !== "") result += emitText(tail);
  return result;
}

/**
 * Minimal line-level TEI from plaintext. `title` is the document title
 * (typically the file name without extension). Output newlines are LF;
 * input CRLF/CR are treated as line breaks, not content.
 *
 * options.images: page images in page order, e.g. [{ name: "IMG.1.jpg" }, ...].
 * When given, each <pb> in document order binds by position to the image at the
 * same index (the leading page is index 0, each |N| marker the next), gets a
 * @facs pointer, and a matching <facsimile><surface><graphic url> is emitted.
 * Page-break POSITIONS still come only from the text; the images merely attach.
 * A page with no image gets no @facs; surplus images (more images than pages)
 * are dropped here (the on-ramp UI reconciles the counts before calling).
 */
export function teiFromPlaintext(text, title, options = {}) {
  const safeTitle = escapeText(String(title || "Untitled"));
  const images = Array.isArray(options.images)
    ? options.images.filter((im) => im && im.name)
    : [];
  const lines = String(text).split(/\r\n|\r|\n/);

  // Each <pb> claims the next page index; an index within the image count also
  // gets the @facs pointer to its surface. The closure keeps document order
  // correct across the leading page break and every inline marker.
  let pageSeq = 0;
  const pbTag = (n) => {
    const facs = pageSeq < images.length ? ` facs="#${SURFACE_ID_PREFIX}${pageSeq + 1}"` : "";
    pageSeq++;
    return `<pb n="${escapeAttr(String(n))}"${facs}/>`;
  };

  // Group into paragraphs on blank lines (whitespace-only counts as blank).
  const paras = [];
  let current = [];
  for (const line of lines) {
    if (line.trim() === "") {
      if (current.length) { paras.push(current); current = []; }
    } else {
      current.push(line);
    }
  }
  if (current.length) paras.push(current);

  // Emit the leading page break first so it claims page index 0, then the body
  // (whose markers claim the following indices in document order).
  const leadPb = pbTag(1);
  const body = paras.length
    ? paras.map((p) => {
        // <lb/> marks the break between lines: the first text segment of the
        // paragraph stays bare, each later one opens with <lb/>.
        let started = false;
        const emitText = (seg) => { const pre = started ? "<lb/>" : ""; started = true; return pre + escapeText(seg); };
        return "        <p>" + p.map((l) => renderLine(l, pbTag, emitText)).join("\n          ") + "</p>";
      }).join("\n")
    : "        <p/>";

  // Only surfaces that a <pb> actually references (cap at the page count), so no
  // orphan surface is written when more images than pages were handed in.
  const bound = images.slice(0, pageSeq);
  const facsimile = bound.length
    ? "  <facsimile>\n"
      + bound.map((im, i) => `    <surface xml:id="${SURFACE_ID_PREFIX}${i + 1}"><graphic url="${escapeAttr(im.name)}"/></surface>`).join("\n")
      + "\n  </facsimile>\n"
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
