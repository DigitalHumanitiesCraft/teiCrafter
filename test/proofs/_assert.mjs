/**
 * Shared assertion helpers for the Node proof suite. The runner skips
 * underscore-prefixed files, so this is a helper, not a proof.
 *
 * Each proof runs as its own process, so a module-level failure counter is safe.
 *
 *   check(label, cond)  print "ok"/"FAIL" and count a failure when cond is false
 *   section(title)      print a section header line
 *   finish(passMsg)     print the summary and exit (0 clean, 1 on any failure)
 *   readingText(raw)    reading text with tags stripped, the splice-strip helper
 *                       several export proofs re-inline to assert body-text fidelity
 */

let failures = 0;

export function check(label, cond) {
  console.log(`  ${cond ? "ok  " : "FAIL"} ${label}`);
  if (!cond) failures++;
}

export function section(title) {
  console.log(title);
}

export function finish(passMsg) {
  console.log("");
  if (failures) {
    console.log(`FAIL: ${failures} check(s) failed.`);
    process.exit(1);
  }
  if (passMsg) console.log(passMsg);
  process.exit(0);
}

export function readingText(raw) {
  const m = /<body>[\s\S]*<\/body>/.exec(raw);
  return (m ? m[0] : raw).replace(/<[^>]*>/g, "");
}
