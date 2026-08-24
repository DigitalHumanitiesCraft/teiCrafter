/**
 * Proof: real Hersch inline-GND previews are byte-identical fixed points.
 *
 * The rights-encumbered fixtures stay in the zbz-ocr-tei sibling checkout. If
 * either real source is present, both required milestone carriers must be present;
 * this proof never falls back to a materialized teiCrafter copy.
 *
 * Run: node test/proofs/inline_gnd_real_hersch_check.mjs
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getAttr,
  isReadingContext,
  parseDocument,
  readingRoot,
  walk,
} from "../../docs/js/editor/tei-document.js";
import { readEntities } from "../../docs/js/editor/standoff.js";
import { fromInlineGND, toInlineGND } from "../../docs/js/editor/inline-gnd.js";
import { check, finish, readingText, section } from "./_assert.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const GH = resolve(REPO, "..", "..");
const ZBZ = join(GH, "DHCraft", "zbz-ocr-tei");
const SOURCES = ["1000", "1540"].map((id) => ({
  id,
  path: join(ZBZ, "output", "entity_preview", `${id}_final.xml`),
}));

const present = SOURCES.filter((source) => existsSync(source.path));
if (!present.length) {
  console.log("SKIP: real Hersch entity previews are absent from the sibling checkout");
  process.exit(0);
}

for (const source of SOURCES) {
  check(`real Hersch entity preview ${source.id} is present`, existsSync(source.path));
}

function readingMentions(doc, names) {
  const mentions = [];
  walk(readingRoot(doc), (node) => {
    if (
      node.type === "element" &&
      names.has(node.localName) &&
      isReadingContext(node)
    ) {
      mentions.push(node);
    }
  });
  return mentions;
}

for (const source of SOURCES.filter((candidate) => existsSync(candidate.path))) {
  section(`real Hersch inline-GND fixed point: ${source.id}`);
  const raw = readFileSync(source.path, "utf8");
  const inline = parseDocument(raw);
  const inlineMentions = readingMentions(inline, new Set(["persName", "orgName", "bibl"]));

  check("source carries inline entity mentions", inlineMentions.length > 0);
  check("every inline mention carries ref, source, cert and resp",
    inlineMentions.every((node) =>
      ["ref", "source", "cert", "resp"].every((name) => getAttr(node, name))));

  const reopened = fromInlineGND(inline);
  check("import lifts the inline document into a new register model", reopened !== inline);
  check("reading text is byte-identical after import", readingText(reopened.raw) === readingText(raw));

  const workingMentions = readingMentions(reopened, new Set(["name"]));
  check("every working mention keeps source, cert and resp",
    workingMentions.every((node) =>
      ["source", "cert", "resp"].every((name) => getAttr(node, name))));
  check("every working mention points to the local register",
    workingMentions.every((node) => (getAttr(node, "ref") || "").startsWith("#")));

  const entities = readEntities(reopened);
  check("the recovered register carries entities",
    entities.persons.length + entities.orgs.length + entities.works.length > 0);

  const reexported = toInlineGND(reopened);
  check("import then export is byte-identical to the real source", reexported.raw === raw);
  check("a second import/export cycle remains byte-identical",
    toInlineGND(fromInlineGND(reexported)).raw === raw);
}

finish("PASS: real Hersch 1000 and 1540 preserve inline-GND provenance byte-identically.");
