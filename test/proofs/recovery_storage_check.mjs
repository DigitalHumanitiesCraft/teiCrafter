/**
 * Proof: the stored form of a recovery checkpoint keeps every XML text exactly.
 *   - a project checkpoint stores each document's text once as an XML Blob, the active
 *     document only at top level, and reading it back returns identical strings,
 *   - a single-document checkpoint round-trips, including CRLF, a leading U+FEFF and
 *     characters outside the Basic Multilingual Plane,
 *   - a checkpoint written in the previous string format is read unchanged,
 *   - a text with an unpaired surrogate stays a string instead of being altered,
 *   - queueing shares the XML strings and copies the remaining state,
 *   - a stored Blob that is not UTF-8 is refused instead of being decoded with replacements.
 *
 * Run: node test/proofs/recovery_storage_check.mjs   (exit 0 = all pass)
 */
import { check, finish, section } from "./_assert.mjs";
import { captureCheckpoint, detachCheckpoint, readCheckpoint, storeCheckpoint, RECOVERY_VERSION } from "../../docs/js/editor/session-recovery.js";
import { captureProjectDocuments, restoreProjectDocuments, snapshotProjectDocument } from "../../docs/js/editor/project-documents.js";

const codex = "﻿<?xml version=\"1.0\" encoding=\"UTF-8\"?>\r\n<TEI xmlns=\"http://www.tei-c.org/ns/1.0\"><text><body>"
  + "<p>anegenge ſ \u{1D11E} 中</p>\r\n</body></text></TEI>\r\n";
const registers = "<TEI xmlns=\"http://www.tei-c.org/ns/1.0\" type=\"wenzelsbibel-registers\">  <standOff/></TEI>\n";

function session(raw, name = "codex.xml") {
  return { state: { doc: { raw } }, docName: name, recoveryId: "recovery", dirty: true, source: { kind: "tei" },
    project: null, fileEncoding: { encoding: "UTF-8", bom: false }, readingWitness: null, pageImages: new Map() };
}

section("\nProject checkpoint");
const app = session(codex);
app.projectDocuments = captureProjectDocuments(app);
app.projectDocuments.documents.push(snapshotProjectDocument(session(registers, "registers.xml")));
const record = captureCheckpoint(app, { mode: "page", folio: 0, value: "unfinished" });
const stored = storeCheckpoint(record);
const [activeEntry, companion] = stored.projectDocuments.documents;
check("the stored record carries the current version", stored.version === RECOVERY_VERSION);
check("the active text is stored once, as an XML Blob", stored.raw instanceof Blob && stored.raw.type === "application/xml"
  && activeEntry.raw === null);
check("the companion text is stored as its own Blob", companion.raw instanceof Blob);
check("the Blob holds the UTF-8 bytes of the text, BOM included",
  stored.raw.size === Buffer.byteLength(codex, "utf8"));
const read = await readCheckpoint(stored);
check("the active text reads back identical", read.raw === codex);
check("the active project entry is reattached from the single stored text",
  read.projectDocuments.documents[0].raw === codex);
check("the companion reads back identical", read.projectDocuments.documents[1].raw === registers);
check("the read project passes the collection checks", restoreProjectDocuments(read.projectDocuments).documents.length === 2);
check("the capture itself is left unchanged", typeof record.raw === "string"
  && record.projectDocuments.documents[0].raw === codex);

section("\nSingle document");
const single = captureCheckpoint(session(codex));
const singleRead = await readCheckpoint(storeCheckpoint(single));
check("a checkpoint without project reads back identical", singleRead.raw === codex && singleRead.projectDocuments === null);

section("\nPrevious string format");
const previous = { ...record, version: 1 };
const previousRead = await readCheckpoint(previous);
check("a version 1 record reads back unchanged", previousRead.raw === codex
  && previousRead.projectDocuments.documents.map((entry) => entry.raw).join("|") === `${codex}|${registers}`);

section("\nUnpaired surrogate");
const broken = `<TEI><p>half \uD834 pair</p></TEI>`;
const brokenStored = storeCheckpoint(captureCheckpoint(session(broken)));
check("a text without a UTF-8 form stays a string", typeof brokenStored.raw === "string");
check("and reads back identical", (await readCheckpoint(brokenStored)).raw === broken);

section("\nQueueing copy");
const detached = detachCheckpoint(record);
record.staged.value = "changed later";
check("the queued copy keeps the captured staged input", detached.staged.value === "unfinished");
check("the queued copy shares the XML strings", detached.raw === codex && detached.projectDocuments.documents[1].raw === registers);

section("\nCorrupt storage");
const corrupt = { ...stored, raw: new Blob([new Uint8Array([0x3c, 0xff, 0x3e])]) };
let refused = false;
try { await readCheckpoint(corrupt); } catch { refused = true; }
check("bytes that are not UTF-8 are refused", refused);

finish("PASS: recovery checkpoints store each XML text once and read it back unchanged.");
