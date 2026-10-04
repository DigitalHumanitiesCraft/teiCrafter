/**
 * Well-formedness check through the browser's XML parser. The offset-true
 * tokenizer in tei-document.js is lenient on purpose, so this is the only
 * place that reports a hard XML syntax error with a line and column.
 */
export interface WellFormedResult {
  ok: boolean;
  message: string | null;
  line: number | null;
  column: number | null;
}

const POSITION = /line[^\d]*(\d+)[^\d]+column[^\d]*(\d+)/i;

export function checkWellFormed(raw: string): WellFormedResult {
  const dom = new DOMParser().parseFromString(raw, "application/xml");
  const error = dom.getElementsByTagName("parsererror")[0];
  if (!error) return { ok: true, message: null, line: null, column: null };
  // Browsers phrase the error differently; the text is kept, the position parsed where present.
  const text = (error.textContent || "XML is not well-formed").replace(/\s+/g, " ").trim();
  const match = POSITION.exec(text);
  return {
    ok: false,
    message: text,
    line: match ? Number(match[1]) : null,
    column: match ? Number(match[2]) : null,
  };
}
