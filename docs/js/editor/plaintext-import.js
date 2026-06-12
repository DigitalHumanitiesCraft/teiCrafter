/**
 * teiCrafter Editor -- deterministic plaintext intake.
 *
 * Turns a plaintext file into minimal line-level TEI so it opens in the same
 * editor: paragraphs split on blank lines, every line prefixed with <lb/>
 * (the Hersch shape the editor already reads). This is transport, not
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

const MARKER = /\|(\d+)\|/g;

/**
 * Render one physical input line into TEI tokens. Without a marker this is
 * exactly "<lb/>" + escaped line (the historical shape). With markers the line
 * splits: each non-empty text segment opens an <lb/> line and each marker
 * becomes <pb n="N"/>. At most one space directly bordering a marker is trimmed.
 */
function renderLine(line) {
  MARKER.lastIndex = 0;
  if (!MARKER.test(line)) return "<lb/>" + escapeText(line);

  let result = "";
  let pos = 0;
  let m;
  MARKER.lastIndex = 0;
  while ((m = MARKER.exec(line)) !== null) {
    let seg = line.slice(pos, m.index);
    if (seg.endsWith(" ")) seg = seg.slice(0, -1);
    if (seg !== "") result += "<lb/>" + escapeText(seg);
    result += '<pb n="' + m[1] + '"/>';
    pos = m.index + m[0].length;
    if (line[pos] === " ") pos += 1;
  }
  const tail = line.slice(pos);
  if (tail !== "") result += "<lb/>" + escapeText(tail);
  return result;
}

/**
 * Minimal line-level TEI from plaintext. `title` is the document title
 * (typically the file name without extension). Output newlines are LF;
 * input CRLF/CR are treated as line breaks, not content.
 */
export function teiFromPlaintext(text, title) {
  const safeTitle = escapeText(String(title || "Untitled"));
  const lines = String(text).split(/\r\n|\r|\n/);

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

  const body = paras.length
    ? paras.map((p) => "        <p>" + p.map(renderLine).join("\n          ") + "</p>").join("\n")
    : "        <p/>";

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
  <text>
    <body>
      <pb n="1"/>
${body}
    </body>
  </text>
</TEI>
`;
}
