import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseEdition, serialize } from "../../docs/js/editor/edition.js";
import { parseDocument, textOf, textNodes } from "../../docs/js/editor/tei-document.js";
import { resolvedSpanGroups } from "../../docs/js/editor/span-projection.js";
import { isPendingProposal } from "../../docs/js/editor/proposal-provenance.js";
import { check, finish } from "./_assert.mjs";

const folder = process.env.SZD_REFACTOR_TEI;
if (!folder) {
  console.log("SKIP: Set SZD_REFACTOR_TEI to the local complete-object exports.");
  process.exit(0);
}
const files = readdirSync(folder).filter((name) => /^o_szd\.\d+\.xml$/.test(name));
check("the complete ten-object sample is present", files.length === 10);
for (const name of [...files, "synthetic-crossline.xml"]) {
  const raw = readFileSync(join(folder, name), "utf8");
  const payload = JSON.parse(readFileSync(join(folder, name.replace(/\.xml$/, ".research.json")), "utf8"));
  const doc = parseDocument(raw);
  check(`${name}: native edition serializes every original byte`, serialize(parseEdition(raw)) === raw);
  const groups = resolvedSpanGroups(doc);
  check(`${name}: all assertion groups resolve`, groups.length === payload.assertions.length);
  groups.forEach((group, index) => {
    const assertion = payload.assertions[index];
    check(`${name}/${assertion.id}: all segments resolve`, group.ranges.length === assertion.spans.length);
    group.ranges.forEach((range, segment) => {
      const fragment = parseDocument(`<p xmlns="http://www.tei-c.org/ns/1.0">${raw.slice(range.start, range.end)}</p>`);
      const evidence = textNodes(fragment.root).map((node) => textOf(fragment, node)).join("");
      check(`${name}/${assertion.id}/${segment}: native exact evidence`, evidence === assertion.spans[segment].quote);
      check(`${name}/${assertion.id}/${segment}: proposal remains pending`, isPendingProposal(range.span, "#ai"));
    });
  });
}
finish("Complete-object native editor projection passed.");
