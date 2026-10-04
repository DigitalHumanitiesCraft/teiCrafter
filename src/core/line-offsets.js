/**
 * Translation between raw string offsets and editor positions. An editor that
 * splits lines on CRLF counts each CRLF as one position, while the core works
 * on raw string offsets. Pure functions, so the arithmetic is testable in Node.
 */

/**
 * The line separator an editor should split on: CRLF as soon as the raw text
 * contains one, LF otherwise. A file with mixed endings is therefore treated as
 * CRLF, and its lone LFs stay ordinary characters of their line.
 * @param {string} raw The raw text.
 * @returns {"\r\n" | "\n"} The separator.
 */
export function lineSeparatorOf(raw) {
  return raw.includes("\r\n") ? "\r\n" : "\n";
}

/**
 * Editor position for a raw offset. An offset between the CR and the LF of a
 * separator maps to the end of its line, before the separator.
 * @param {string} raw The raw text.
 * @param {string} separator The separator the editor splits on.
 * @param {number} offset Raw offset, 0 to raw.length.
 * @returns {number} Editor position.
 */
export function rawToPos(raw, separator, offset) {
  if (separator.length === 1) return offset;
  let n = 0;
  for (let i = raw.indexOf(separator); i >= 0 && i < offset; i = raw.indexOf(separator, i + separator.length)) n++;
  return offset - n * (separator.length - 1);
}

