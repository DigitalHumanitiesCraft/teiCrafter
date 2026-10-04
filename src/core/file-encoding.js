/**
 * Decode XML file bytes under teiCrafter's explicit UTF-8 contract.
 *
 * The editor model receives JavaScript strings, so byte-level properties must
 * be captured before parsing. UTF-8 with or without a BOM is accepted. Other
 * BOMs, invalid UTF-8, and conflicting XML declarations are rejected.
 *
 * @param {ArrayBuffer | Uint8Array} input
 * @returns {{ text: string, encoding: "UTF-8", bom: boolean }}
 */
export function decodeXmlBytes(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.length >= 2) {
    if (bytes[0] === 0xff && bytes[1] === 0xfe) {
      throw new TypeError("UTF-16LE XML is unsupported; save the file as UTF-8.");
    }
    if (bytes[0] === 0xfe && bytes[1] === 0xff) {
      throw new TypeError("UTF-16BE XML is unsupported; save the file as UTF-8.");
    }
  }
  const bom = bytes.length >= 3
    && bytes[0] === 0xef
    && bytes[1] === 0xbb
    && bytes[2] === 0xbf;
  const payload = bom ? bytes.subarray(3) : bytes;
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(payload);
  } catch (error) {
    throw new TypeError("The XML file is not valid UTF-8.", { cause: error });
  }
  assertUtf8Declaration(text);
  return { text, encoding: "UTF-8", bom };
}

/**
 * Encode XML text as UTF-8, optionally restoring an input BOM.
 *
 * @param {string} text
 * @param {{ bom?: boolean }} [options]
 * @returns {Uint8Array}
 */
export function encodeXmlBytes(text, { bom = false } = {}) {
  if (typeof text !== "string") throw new TypeError("XML text must be a string.");
  assertUtf8Declaration(text);
  const payload = new TextEncoder().encode(text);
  if (!bom) return payload;
  const bytes = new Uint8Array(payload.length + 3);
  bytes.set([0xef, 0xbb, 0xbf]);
  bytes.set(payload, 3);
  return bytes;
}

/**
 * @param {string} text
 */
function assertUtf8Declaration(text) {
  const declaration = text.match(/^\s*<\?xml\s+([^?]*)\?>/i);
  if (!declaration) return;
  const encoding = declaration[1].match(/\bencoding\s*=\s*(["'])([^"']+)\1/i);
  if (!encoding) return;
  if (!/^utf-?8$/i.test(encoding[2].trim())) {
    throw new TypeError(
      `Unsupported XML declaration encoding "${encoding[2]}"; teiCrafter requires UTF-8.`,
    );
  }
}
