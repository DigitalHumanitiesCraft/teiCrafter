/**
 * Proof: the authority lookup service (authority-lookup.js) builds correct query
 * URLs and parses each register's real response shape into a uniform
 * [{ id, label, description }]. The fetch itself is browser-verified; these are
 * the deterministic parts. Sample payloads mirror the real API responses.
 *
 * Run: node test/tools/authority_lookup_check.mjs   (exit 0 = all pass)
 */

import { searchUrl, parseResults, lookup, recordUrl, LOOKUP_AUTHORITIES } from "../../docs/js/services/authority-lookup.js";

let passed = 0, failed = 0;
function check(cond, label) {
  if (cond) { passed++; console.log("  ok    " + label); }
  else { failed++; console.log("  FAIL  " + label); }
}

console.log("\nAuthority lookup proof (M3.3)");
console.log("=".repeat(60));

// --- URL builders ------------------------------------------------------------

check(searchUrl("Wikidata", "Komotau").includes("wbsearchentities") &&
      searchUrl("Wikidata", "Komotau").includes("origin=*") &&
      searchUrl("Wikidata", "Komotau").includes("search=Komotau"),
  "Wikidata URL uses wbsearchentities with origin=* (CORS) and the query");
check(searchUrl("GND", "Stefan Zweig").includes("lobid.org/gnd/search") &&
      searchUrl("GND", "Stefan Zweig").includes("q=Stefan%20Zweig"),
  "GND URL hits lobid.org with the encoded query");
check(searchUrl("GeoNames", "Wien", { username: "demo" }).includes("username=demo") &&
      searchUrl("GeoNames", "Wien", { username: "demo" }).includes("searchJSON"),
  "GeoNames URL uses searchJSON with the username");
check(searchUrl("Wikidata", "   ") === null, "an empty query yields no URL");
check(searchUrl("Nonsense", "x") === null, "an unknown authority yields no URL");

// --- Wikidata parse (wbsearchentities shape) ---------------------------------

const wd = { search: [
  { id: "Q160040", label: "Chomutov", description: "town in the Czech Republic" },
  { id: "Q1", match: { text: "fallback label" } },
  { label: "no id, dropped" },
] };
let r = parseResults("Wikidata", wd);
check(r.length === 2, "Wikidata: items without an id are dropped");
check(r[0].id === "Q160040" && r[0].label === "Chomutov" && /Czech/.test(r[0].description),
  "Wikidata: id, label, description mapped");
check(r[1].label === "fallback label", "Wikidata: falls back to match.text when label is absent");

// --- GND parse (lobid shape) -------------------------------------------------

const gnd = { member: [
  { gndIdentifier: "118549464", preferredName: "Zweig, Stefan", type: ["Person"],
    biographicalOrHistoricalInformation: ["Austrian writer"] },
  { preferredName: "no id, dropped" },
] };
r = parseResults("GND", gnd);
check(r.length === 1 && r[0].id === "118549464" && r[0].label === "Zweig, Stefan",
  "GND: gndIdentifier and preferredName mapped, id-less dropped");
check(/Austrian writer/.test(r[0].description), "GND: biographical info used as description");

// --- GeoNames parse (searchJSON shape) ---------------------------------------

const geo = { geonames: [
  { geonameId: 3074967, name: "Chomutov", adminName1: "Ustecky kraj", countryName: "Czechia" },
  { name: "no id, dropped" },
] };
r = parseResults("GeoNames", geo);
check(r.length === 1 && r[0].id === "3074967" && r[0].label === "Chomutov",
  "GeoNames: numeric geonameId becomes a string id");
check(r[0].description === "Ustecky kraj, Czechia", "GeoNames: admin + country as description");

// --- robustness: malformed input -> [] ---------------------------------------

for (const bad of [null, undefined, {}, { search: "x" }, { member: 3 }, 42, "str"]) {
  if (parseResults("Wikidata", bad).length !== 0 || parseResults("GND", bad).length !== 0) {
    check(false, "malformed -> [] for " + JSON.stringify(bad));
  }
}
check(true, "malformed responses parse to [] without throwing");

// --- GeoNames without a username refuses fast (no fetch) ----------------------

let threw = false;
try { await lookup("GeoNames", "Wien"); } catch (_e) { threw = true; }
check(threw, "GeoNames lookup without a username throws a clear error before fetching");

check(LOOKUP_AUTHORITIES.length === 3, "three registers are offered for lookup");

// --- record URL resolver (verify an attached id) -----------------------------

check(recordUrl("GND", "117037486") === "https://d-nb.info/gnd/117037486",
  "GND id resolves to its d-nb.info record");
check(recordUrl("GND", "4066009-6") === "https://d-nb.info/gnd/4066009-6",
  "GND id keeps its hyphen in the record URL");
check(recordUrl("Wikidata", "Q68483") === "https://www.wikidata.org/wiki/Q68483",
  "Wikidata id resolves to its wiki page");
check(recordUrl("GeoNames", "2761369") === "https://www.geonames.org/2761369",
  "GeoNames id resolves to its geonames.org page");
check(recordUrl("Wikidata", "https://www.wikidata.org/entity/Q71") === "https://www.wikidata.org/entity/Q71",
  "a value that is already an http URI is returned unchanged");
check(recordUrl("GND", "  117037486  ") === "https://d-nb.info/gnd/117037486",
  "the value is trimmed before resolving");
check(recordUrl("GND", "") === null && recordUrl("GND", "   ") === null,
  "an empty value yields no URL");
check(recordUrl("Nonsense", "x") === null,
  "an unknown register yields no URL");

// --- summary -----------------------------------------------------------------

console.log("=".repeat(60));
if (failed === 0) {
  console.log(`PASSED (${passed}/${passed})`);
  console.log("URL building and response parsing are correct and robust.");
  process.exit(0);
} else {
  console.log(`FAILED (${passed}/${passed + failed}, ${failed} failing)`);
  process.exit(1);
}
