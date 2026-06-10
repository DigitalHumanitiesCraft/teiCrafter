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
 * Pure module: no DOM, no fetch, mutates nothing.
 */

function escapeText(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
    ? paras.map((p) => "        <p>" + p.map((l) => "<lb/>" + escapeText(l)).join("\n          ") + "</p>").join("\n")
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
