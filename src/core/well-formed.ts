/**
 * Well-formedness check through the browser's XML parser. The offset-true
 * tokenizer in tei-document.js is lenient on purpose, so this is the only
 * place that reports a hard XML syntax error with a line and column.
 */
export interface WellFormedResult {
  ok: boolean;
  message: string | null;
  /** The parser's own description of the error, without the browser's framing text. */
  reason: string | null;
  line: number | null;
  column: number | null;
}

const POSITION = /line[^\d]*(\d+)[^\d]+column[^\d]*(\d+)/i;
// Chromium wraps the libxml2 message in a page-rendering notice, Firefox in a location block.
const CHROMIUM_REASON = /error on line \d+ at column \d+:\s*(.*?)\s*(?:Below is a rendering|$)/;
const FIREFOX_REASON = /XML Parsing Error:\s*(.*?)\s*Location/;

/** The error description inside a browser's parser message, or the whole message when no known framing matches. */
export function wellFormedReason(message: string | null): string | null {
  if (!message) return null;
  return CHROMIUM_REASON.exec(message)?.[1] ?? FIREFOX_REASON.exec(message)?.[1] ?? message;
}

export function checkWellFormed(raw: string): WellFormedResult {
  const dom = new DOMParser().parseFromString(raw, "application/xml");
  const error = dom.getElementsByTagName("parsererror")[0];
  if (!error) return { ok: true, message: null, reason: null, line: null, column: null };
  // Browsers phrase the error differently; the text is kept, the position parsed where present.
  const text = (error.textContent || "XML is not well-formed").replace(/\s+/g, " ").trim();
  const match = POSITION.exec(text);
  return {
    ok: false,
    message: text,
    reason: wellFormedReason(text),
    line: match ? Number(match[1]) : null,
    column: match ? Number(match[2]) : null,
  };
}
