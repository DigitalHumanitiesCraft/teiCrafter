/**
 * Proof: the start page's editions gallery (docs/data/derivations.json) stays in
 * step with the knowledge base and the published files.
 *
 *   - every entry passes the gallery's own contract (galleryCards);
 *   - every caseAnchor is the anchor of a heading in knowledge/derivation.md;
 *   - every licenceNotice names a file under docs/ that exists;
 *   - an entry whose url is null yields a card without an open link, and every
 *     url that is set names an existing page under docs/.
 *
 * Run: node test/proofs/derivations_check.mjs   (exit 0 = all pass)
 */

import { existsSync, readFileSync } from "node:fs";
import { galleryCards } from "../../docs/js/derivation-gallery.js";
import { check, finish, section } from "./_assert.mjs";

const root = new URL("../../", import.meta.url);
const entries = JSON.parse(readFileSync(new URL("docs/data/derivations.json", root), "utf8"));
const derivation = readFileSync(new URL("knowledge/derivation.md", root), "utf8");

// GitHub's heading anchors: lower case, punctuation other than hyphens dropped, spaces to hyphens.
const anchorOf = (heading) => heading.trim().toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, "").replace(/\s/g, "-");
const anchors = new Set([...derivation.matchAll(/^#{1,6}\s+(.+)$/gm)].map((m) => anchorOf(m[1])));

section("Gallery contract");
let cards = [];
try {
  cards = galleryCards(entries);
  check("every entry passes galleryCards", true);
} catch (error) {
  check(`every entry passes galleryCards (${error.message})`, false);
}
check("the gallery has entries", cards.length > 0);
check("entry ids are unique", new Set(entries.map((e) => e.id)).size === entries.length);
check("the gallery rejects an absolute url", (() => {
  try { galleryCards([{ ...entries[0], url: "https://example.org/" }]); return false; } catch { return true; }
})());

section("Anchors into knowledge/derivation.md");
for (const entry of entries) check(`${entry.id}: #${entry.caseAnchor} is a heading`, anchors.has(entry.caseAnchor));

section("Licence notices and open links");
for (const [index, entry] of entries.entries()) {
  if (entry.licenceNotice) check(`${entry.id}: docs/${entry.licenceNotice} exists`, existsSync(new URL(`docs/${entry.licenceNotice}`, root)));
  if (entry.url === null) check(`${entry.id}: no url, no open link`, cards[index]?.open === null);
  else check(`${entry.id}: docs/${entry.url.split("#")[0]} exists`, existsSync(new URL(`docs/${entry.url.split("#")[0]}`, root)));
}

finish("PASS: the editions gallery matches derivation.md and the published files.");
