import assert from "node:assert/strict";
import fs from "node:fs";
import { STARTER_PROFILES, draftFilename, teiFromStarter } from "../../docs/js/editor/starter-profiles.js";
import { parseEdition } from "../../docs/js/editor/edition.js";
import { validateWithSchemas } from "../../docs/js/editor/schema-validation.js";

const schema = { name: "TEI All 4.11.0", type: "relaxng", text: fs.readFileSync("docs/schemas/tei-p5-4.11.0/tei_all.rng", "utf8") };
for (const profile of STARTER_PROFILES) {
  const text = profile.entries ? Array.from({ length: 30 }, (_, i) => `Fictional term ${i + 1}\nDefinition ${i + 1} containing literal &amp; text.`).join("\n\n") : "Dear friend,\nA fictional transcription &amp; literal.\n\n|2| Yours,\nA writer";
  const args = { text, title: "Fictional draft", profile: profile.id, metadata: { sender: "A & B", recipient: "C", date: "around 1700?", place: "Fictional Town", source: "Original synthetic test. No historical attribution." } };
  const raw = teiFromStarter(args);
  assert.equal(raw, teiFromStarter(args), "Creation is deterministic");
  const results = await validateWithSchemas(raw, [schema]);
  assert.equal(results[0].status, "valid", `${profile.id}: ${JSON.stringify(results)}`);
  assert.ok(raw.includes("&amp;amp;"), "Literal entity-looking text survives creation");
  assert.ok(!raw.includes('resp="#ai"'));
  if (profile.id === "dictionary") assert.equal(parseEdition(raw).folios.length, 30);
  if (profile.id === "articles") assert.equal((raw.match(/<div type="entry"/g) || []).length, 30);
  if (profile.id === "letter") {
    assert.ok(raw.includes("<persName>A &amp; B</persName>"));
    assert.ok(raw.includes("<date>around 1700?</date>"));
    assert.ok(!raw.includes('when="'));
  }
}
const unknown = teiFromStarter({ profile: "letter", title: "Unknown", text: "An unattributed letter." });
assert.ok(!unknown.includes("correspDesc"));
assert.throws(() => teiFromStarter({ profile: "dictionary", title: "Entries", text: "Word", images: [{ name: "p.png" }] }), /Remove page images/);
assert.equal(draftFilename("Letter / 1"), "Letter - 1.xml");
assert.equal(draftFilename("CON"), "document-CON.xml");
assert.equal(draftFilename("letter.xml"), "letter.xml");
console.log("starter_profiles_check passed: deterministic templates, literal content, thirty entries, TEI All validation");
