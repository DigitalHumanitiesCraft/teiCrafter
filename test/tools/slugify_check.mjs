/**
 * Proof: slugify (docs/js/editor/standoff.js) turns an arbitrary string into an
 * NCName-safe id fragment, the seed for every generated xml:id (entity ids from a
 * name, split-sibling line ids). It is pure and deterministic, so its contract is
 * provable headlessly. This pins the contract the editor's id generation rests on.
 *
 * The guarantees asserted:
 *   - the output is always an NCName or "" (starts with a letter or underscore;
 *     thereafter letters, digits, '.', '-', '_');
 *   - no run of two or more separators ('.', '-', '_') ever survives in the output;
 *   - a single internal separator (a valid NCName char) is preserved, not collapsed;
 *   - empty, whitespace-only, null and undefined all yield "";
 *   - a leading digit gets an underscore prefix (a digit is not a valid NCName start);
 *   - diacritics fold to their base letters;
 *   - slugify is idempotent: slugify(slugify(x)) === slugify(x).
 *
 * Run: node test/tools/slugify_check.mjs   (exit 0 = all pass)
 */

import { slugify } from "../../docs/js/editor/standoff.js";

let passed = 0, failed = 0;
function check(cond, label) {
  if (cond) { passed++; console.log("  ok    " + label); }
  else { failed++; console.log("  FAIL  " + label); }
}

const NCNAME = /^[A-Za-z_][A-Za-z0-9._-]*$/;
const SEP_RUN = /[._-]{2,}/;

console.log("\nslugify id-fragment contract proof");
console.log("=".repeat(64));

// --- 1. NCName safety on a broad sample --------------------------------------

const sample = [
  "Schuchardt, Hugo", "Victor G. (5)", "Geneve", "St. Gallen", "a--b",
  "  spaced  out  ", "Müller-Lüdenscheidt", "café", "123abc", ".hidden",
  "ART. 49 §3", "co_OCR", "o:wen.1234", "—dash—", "UPPER lower",
];
let allNc = true;
for (const s of sample) {
  const out = slugify(s);
  if (out !== "" && !NCNAME.test(out)) { allNc = false; console.log(`        not NCName: ${JSON.stringify(s)} -> ${JSON.stringify(out)}`); }
}
check(allNc, "every sample output is an NCName or empty");

let noRun = true;
for (const s of sample) {
  if (SEP_RUN.test(slugify(s))) { noRun = false; console.log(`        separator run survived: ${JSON.stringify(s)} -> ${JSON.stringify(slugify(s))}`); }
}
check(noRun, "no run of two or more separators survives in any output");

// --- 2. the regression that motivated the rule: "._" must collapse to "_" -----

check(slugify("Victor G. (5)") === "victor_g_5", 'Victor G. (5) -> "victor_g_5" (the "._" double collapses)');
check(slugify("a--b") === "a_b", 'a--b -> "a_b" (a hyphen run collapses too, not only underscores)');
check(slugify("a__b") === "a_b", "a__b -> a_b (underscore run collapses)");

// --- 3. a single internal separator is a valid NCName char and is preserved ---

check(slugify("o:wen.1234") === "o_wen.1234", 'o:wen.1234 keeps its single dot ("o_wen.1234")');
check(slugify("St. Gallen") === "st._gallen" || slugify("St. Gallen") === "st_gallen",
  "St. Gallen keeps a single dot or one separator, never a double");
check(!SEP_RUN.test(slugify("St. Gallen")), "St. Gallen has no separator run");

// --- 4. empty-ish inputs all yield "" ----------------------------------------

check(slugify("") === "", "empty string -> ''");
check(slugify("   ") === "", "whitespace-only -> ''");
check(slugify(null) === "", "null -> ''");
check(slugify(undefined) === "", "undefined -> ''");
check(slugify("()[]{}") === "", "punctuation-only -> ''");

// --- 5. a leading digit gets the underscore prefix ---------------------------

check(slugify("123abc") === "_123abc", "leading digit gets an underscore prefix");
check(slugify("42") === "_42", "all-digits gets an underscore prefix");
check(/^[A-Za-z_]/.test(slugify("9 lives")), "a number-led phrase starts NCName-legally");

// --- 6. diacritics fold to base letters --------------------------------------

check(slugify("café") === "cafe", "café -> cafe");
check(slugify("Genève") === "geneve", "Genève -> geneve");
check(slugify("Müller") === "muller", "Müller -> muller");

// --- 7. determinism and idempotence ------------------------------------------

check(slugify("Victor G. (5)") === slugify("Victor G. (5)"), "same input yields the same output");
let idem = true;
for (const s of sample) {
  const once = slugify(s);
  if (slugify(once) !== once) { idem = false; console.log(`        not idempotent: ${JSON.stringify(s)} -> ${JSON.stringify(once)} -> ${JSON.stringify(slugify(once))}`); }
}
check(idem, "slugify is idempotent (slugify(slugify(x)) === slugify(x))");

// --- summary -----------------------------------------------------------------

console.log("=".repeat(64));
if (failed === 0) {
  console.log(`PASSED (${passed}/${passed})`);
  console.log("slugify yields NCName-safe, separator-collapsed, idempotent id fragments.");
  process.exit(0);
} else {
  console.log(`FAILED (${passed}/${passed + failed}, ${failed} failing)`);
  process.exit(1);
}
