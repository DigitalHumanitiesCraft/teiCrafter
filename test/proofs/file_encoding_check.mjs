import assert from "node:assert/strict";
import { decodeXmlBytes, encodeXmlBytes } from "../../docs/js/editor/file-encoding.js";

const utf8 = Buffer.from('<?xml version="1.0" encoding="UTF-8"?>\r\n<TEI>Ä𐍈</TEI>\r\n', "utf8");
const plain = decodeXmlBytes(utf8);
assert.equal(plain.encoding, "UTF-8");
assert.equal(plain.bom, false);
assert.deepEqual(Buffer.from(encodeXmlBytes(plain.text, plain)), utf8);

const withBom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), utf8]);
const decodedBom = decodeXmlBytes(withBom);
assert.equal(decodedBom.bom, true);
assert.deepEqual(Buffer.from(encodeXmlBytes(decodedBom.text, decodedBom)), withBom);

const edited = decodedBom.text.replace("Ä", "Ö");
const editedBytes = encodeXmlBytes(edited, decodedBom);
assert.deepEqual(Buffer.from(editedBytes.subarray(0, 3)), Buffer.from([0xef, 0xbb, 0xbf]));
assert.equal(decodeXmlBytes(editedBytes).text, edited);

assert.throws(() => decodeXmlBytes(Uint8Array.from([0xc3, 0x28])), /not valid UTF-8/);
assert.throws(() => decodeXmlBytes(Uint8Array.from([0xff, 0xfe, 0x3c, 0x00])), /UTF-16LE/);
assert.throws(() => decodeXmlBytes(Uint8Array.from([0xfe, 0xff, 0x00, 0x3c])), /UTF-16BE/);
assert.throws(
  () => decodeXmlBytes(Buffer.from('<?xml version="1.0" encoding="ISO-8859-1"?><x/>')),
  /requires UTF-8/,
);
assert.throws(
  () => encodeXmlBytes('<?xml version="1.0" encoding="UTF-16"?><x/>'),
  /requires UTF-8/,
);

console.log("PASS: UTF-8 bytes, BOM policy, declarations, and invalid encodings are enforced.");
