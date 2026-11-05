/**
 * Readable well-formedness errors from the browser's XML parser.
 *
 * DOMParser reports a parse failure as a parsererror element whose text differs
 * by engine: Chromium wraps the reason in "This page contains the following
 * errors ... Below is a rendering of the page", Firefox writes "XML Parsing
 * Error: ... Line Number N, Column M:" followed by the source line. Researchers
 * need the position and the reason, in one form for both engines.
 */

/**
 * @param {string} text textContent of a parsererror element
 * @returns {{ line: number|null, column: number|null, reason: string, message: string }}
 */
export function describeParserError(text) {
  const flat = String(text || "").replace(/\s+/g, " ").trim();
  let line = null;
  let column = null;
  let reason;
  let match = /error on line (\d+) at column (\d+):\s*(.*?)(?:\s*Below is a rendering of the page.*)?$/i.exec(flat);
  if (match) {
    [line, column, reason] = [Number(match[1]), Number(match[2]), match[3]];
  } else if ((match = /XML Parsing Error:\s*(.*?)\s*Location:.*?Line Number (\d+), Column (\d+):/i.exec(flat))) {
    [reason, line, column] = [match[1], Number(match[2]), Number(match[3])];
  } else {
    reason = flat
      .replace(/^This page contains the following errors:\s*/i, "")
      .replace(/\s*Below is a rendering of the page.*$/i, "");
  }
  reason = reason.replace(/[.\s]+$/, "") || "The XML could not be parsed";
  return { line, column, reason, message: line ? `Line ${line}, column ${column}: ${reason}` : reason };
}

/** The first parse error of a text as described above, or null when it is well-formed. */
export function wellFormedError(text) {
  const parsed = new DOMParser().parseFromString(text, "application/xml");
  const error = parsed.getElementsByTagName("parsererror")[0];
  return error ? describeParserError(error.textContent) : null;
}
