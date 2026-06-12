/**
 * Proof: unsaved-draft recovery (draft-recovery.js) persists ONE draft slot to
 * an injectable storage, byte-faithfully, and degrades safely:
 *   - save/load round-trips raw byte-identically (multibyte + CRLF),
 *   - load on empty storage is null,
 *   - corrupt JSON yields null and clears the slot,
 *   - the size guard refuses raw above 4,000,000 chars (stores nothing),
 *   - clearDraft empties the slot,
 *   - a storage that throws on setItem yields false without throwing.
 *
 * Run: node test/tools/draft_recovery_check.mjs   (exit 0 = all pass)
 */

import {
  saveDraft, loadDraft, clearDraft, DRAFT_KEY, MAX_DRAFT_CHARS,
} from "../../docs/js/editor/draft-recovery.js";

let passed = 0, failed = 0;
function check(cond, label) {
  if (cond) { passed++; console.log("  ok    " + label); }
  else { failed++; console.log("  FAIL  " + label); }
}

// In-memory localStorage stub. setThrows toggles a quota-style failure.
function makeStorage() {
  const map = new Map();
  return {
    setThrows: false,
    setItem(k, v) { if (this.setThrows) throw new Error("quota"); map.set(k, String(v)); },
    getItem(k) { return map.has(k) ? map.get(k) : null; },
    removeItem(k) { map.delete(k); },
    has(k) { return map.has(k); },
  };
}

console.log("\nUnsaved-draft recovery proof");
console.log("=".repeat(60));

// --- 1. round-trip preserves raw byte-identically ----------------------------

const RAW = "Zeile eins\r\nüber Brücken: é中文 😀\r\nletzte";
const s1 = makeStorage();
const okSave = saveDraft(
  { raw: RAW, docName: "brief.xml", sourceName: "brief.txt", savedAt: "2026-06-12T10:00:00.000Z" },
  s1,
);
check(okSave === true, "saveDraft returns true on a normal write");
const rec = loadDraft(s1);
check(rec && rec.raw === RAW, "round-trip: raw is byte-identical (multibyte + CRLF)");
check(rec && rec.docName === "brief.xml" && rec.sourceName === "brief.txt"
  && rec.savedAt === "2026-06-12T10:00:00.000Z", "round-trip: metadata preserved verbatim");
check(s1.has(DRAFT_KEY), "the slot uses the single namespaced key");

// --- 2. load on empty storage is null ----------------------------------------

check(loadDraft(makeStorage()) === null, "loadDraft on empty storage returns null");

// --- 3. corrupt JSON yields null and clears the slot -------------------------

const s3 = makeStorage();
s3.setItem(DRAFT_KEY, "{ not json");
check(loadDraft(s3) === null, "corrupt JSON returns null");
check(!s3.has(DRAFT_KEY), "corrupt JSON is cleared from the slot");

// a well-formed JSON that is not a draft record (no string raw) is also rejected
const s3b = makeStorage();
s3b.setItem(DRAFT_KEY, JSON.stringify({ docName: "x" }));
check(loadDraft(s3b) === null && !s3b.has(DRAFT_KEY),
  "JSON without a string raw is treated as no draft and cleared");

// --- 4. size guard refuses raw above the cap and stores nothing --------------

const s4 = makeStorage();
const big = "x".repeat(MAX_DRAFT_CHARS + 1);
const guarded = saveDraft({ raw: big, docName: "big.xml", sourceName: "big.txt", savedAt: "t" }, s4);
check(guarded === false, "size guard: saveDraft returns false above the cap");
check(!s4.has(DRAFT_KEY), "size guard: nothing is stored");
// exactly at the cap is still accepted
const s4b = makeStorage();
check(saveDraft({ raw: "x".repeat(MAX_DRAFT_CHARS), docName: "d", sourceName: "s", savedAt: "t" }, s4b) === true,
  "size guard: a draft exactly at the cap is accepted");

// --- 5. clearDraft empties the slot ------------------------------------------

const s5 = makeStorage();
saveDraft({ raw: "hi", docName: "d", sourceName: "s", savedAt: "t" }, s5);
clearDraft(s5);
check(!s5.has(DRAFT_KEY) && loadDraft(s5) === null, "clearDraft empties the slot");

// --- 6. a storage that throws on setItem yields false without throwing --------

const s6 = makeStorage();
s6.setThrows = true;
let threw = false;
let res6;
try { res6 = saveDraft({ raw: "hi", docName: "d", sourceName: "s", savedAt: "t" }, s6); }
catch { threw = true; }
check(!threw && res6 === false, "a throwing setItem yields false, never throws");

// --- summary -----------------------------------------------------------------

console.log("=".repeat(60));
if (failed === 0) {
  console.log(`PASSED (${passed}/${passed})`);
  console.log("Unsaved drafts persist to one slot, byte-faithfully, and degrade safely.");
  process.exit(0);
} else {
  console.log(`FAILED (${passed}/${passed + failed}, ${failed} failing)`);
  process.exit(1);
}
