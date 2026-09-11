import { readFileSync } from "node:fs";
import { parseDocument, firstTeiByLocal } from "../../docs/js/editor/tei-document.js";
import {
  addBibleVerseMapping, createWenzelsComment, readBibleVerseMappings, readWenzelsComments,
  readWenzelsWords, removeBibleVerseMapping, removeWenzelsComment,
  updateBibleVerseMapping, updateWenzelsComment, updateWenzelsWord,
} from "../../docs/js/editor/wenzels-text-model.js";
import {
  addWenzelsRegisterLink, createWenzelsRegisterEntry, createWenzelsRegistersDocument,
  parseWenzelsRegisterTarget, readWenzelsRegisterLinks, readWenzelsRegisters,
  removeWenzelsRegisterEntry, removeWenzelsRegisterLink,
  updateWenzelsRegisterEntry, updateWenzelsRegisterLink,
} from "../../docs/js/editor/wenzels-register-model.js";
import { validateWithSchemas } from "../../docs/js/editor/schema-validation.js";
import { check, finish, section } from "./_assert.mjs";

const header = '<teiHeader><fileDesc><titleStmt><title>Independent test</title></titleStmt><publicationStmt><p>Test</p></publicationStmt><sourceDesc><p>Test</p></sourceDesc></fileDesc></teiHeader>';
const body = '<text><body><p><anchor xml:id="old-start"/><w xml:id="w1" orig="ſich" norm="sich">&#383;ich</w> <w xml:id="w2" norm="Gott"><hi rend="red">got</hi></w><anchor xml:id="old-end"/> <w xml:id="w3">𐀀 &amp; erde</w></p></body></text>';
const originalApp = '<app type="translation" from="#old-start" to="#old-end" cert="low"><note xml:lang="de" resp="#editor #other">A &amp; B</note><note xml:lang="en" resp="#translator">Old note</note><note xml:lang="la"><hi>Mixta</hi> nota</note><witDetail wit="#witness">Unchanged</witDetail></app>';
const raw = `<?xml version="1.0" encoding="UTF-8"?>\r\n<TEI xmlns="http://www.tei-c.org/ns/1.0">${header}<standOff><listApp>${originalApp}</listApp></standOff>${body}</TEI>`;
const doc = parseDocument(raw);
const selection = { from: "w1", to: "w2" };
function refuses(action) { try { action(); return false; } catch { return true; } }
function bodyBytes(candidate) {
  const element = firstTeiByLocal(candidate.root, "text");
  return candidate.raw.slice(element.outerStart, element.outerEnd);
}

section("Source-backed commentary and exact word ranges");
const old = readWenzelsComments(doc)[0];
check("legacy apparatus types remain visible with every language and responsibility", old.type === "translation"
  && old.notes.length === 3 && old.notes[0].resp === "#editor #other" && old.start < old.end);
check("reading is a byte-identical no-op", doc.raw === raw);
check("unchanged bilingual notes keep the exact document instance and entity spelling",
  updateWenzelsComment(doc, old, { type: old.type, notes: old.notes }) === doc);
const revised = updateWenzelsComment(doc, old, { notes: [{ index: 1, text: 'New &amp; note "two"' }] });
const revisedRecord = readWenzelsComments(revised)[0];
check("a deliberate note edit gives a legacy app a stable identifier", !!revisedRecord.id);
check("updating one note preserves the other languages, responsibility lists and unknown children",
  revisedRecord.notes[0].text === "A & B" && revisedRecord.notes[1].resp === "#translator"
    && revisedRecord.notes[1].text === 'New &amp; note "two"'
    && revised.raw.includes('<note xml:lang="la"><hi>Mixta</hi> nota</note>')
    && revised.raw.includes('<witDetail wit="#witness">Unchanged</witDetail>')
    && revised.raw.includes('cert="low"') && bodyBytes(revised) === body);
check("old records cannot mutate a replacement document", refuses(() => updateWenzelsComment(revised, old, { type: "comment_edition" })));
check("mixed note edits require exact XML", refuses(() => updateWenzelsComment(doc, old, { notes: [{ index: 2, text: "Flattened" }] })));
check("mixed note attribute changes preserve embedded XML", updateWenzelsComment(doc, old, {
  notes: [{ index: 2, lang: "de" }],
}).raw.includes('<note xml:lang="de"><hi>Mixta</hi> nota</note>'));
check("unchanged comment endpoints are a source no-op", updateWenzelsComment(doc, old, { from: "old-start", to: "old-end" }) === doc);
check("comment endpoint changes reject word IDs and reversed anchors", refuses(() => updateWenzelsComment(doc, old, { from: "w1" }))
  && refuses(() => updateWenzelsComment(doc, old, { from: "old-end", to: "old-start" })));

const created = createWenzelsComment(doc, selection, { type: "comment_understanding",
  notes: [{ text: "Meaning", lang: "en", resp: "#editor" }, { text: "Bedeutung", lang: "de" }] });
const newComment = readWenzelsComments(created)[1];
const retargeted = updateWenzelsComment(created, readWenzelsComments(created)[0], { from: newComment.from, to: newComment.to });
check("existing comments can be retargeted to exact unique anchors", readWenzelsComments(retargeted)[0].from === newComment.from
  && retargeted.raw.includes('<note xml:lang="la"><hi>Mixta</hi> nota</note>'));
check("new comments use inclusive word boundaries and stable exact anchors", newComment.from.startsWith("#wb-comment")
  && created.raw.slice(newComment.start, newComment.end) === body.match(/<w xml:id="w1"[\s\S]*?<\/w> <w xml:id="w2"[\s\S]*?<\/w>/)[0]);
check("new note order, languages and responsibility remain explicit", newComment.notes.map((note) => note.lang).join(",") === "en,de"
  && newComment.notes[0].resp === "#editor");
check("creating commentary preserves every original apparatus byte", created.raw.includes(originalApp));
const removed = removeWenzelsComment(created, newComment);
check("removing one comment preserves existing comments and source text", readWenzelsComments(removed).length === 1
  && readWenzelsWords(removed).map((word) => word.text).join(" ") === readWenzelsWords(doc).map((word) => word.text).join(" "));
check("reversed or ambiguous word ranges are rejected", refuses(() => createWenzelsComment(doc, { from: "w2", to: "w1" }, { notes: [{ text: "No" }] })));
const entityPosition = raw.indexOf("&#383;");
check("ranges cannot split an XML entity", refuses(() => createWenzelsComment(doc, { start: entityPosition + 2, end: entityPosition + 6 }, { notes: [{ text: "No" }] })));
const astralPosition = raw.indexOf("𐀀");
check("ranges cannot split a surrogate pair", refuses(() => createWenzelsComment(doc, { start: astralPosition + 1, end: astralPosition + 2 }, { notes: [{ text: "No" }] })));
const dup = parseDocument(raw.replace('xml:id="w2"', 'xml:id="w1"'));
check("duplicate word IDs block mappings", refuses(() => addBibleVerseMapping(dup, { from: "w1", to: "w1" }, { reference: "Gen 1:1" })));
check("mixed word normalization changes only the attribute", updateWenzelsWord(doc, "w2", { norm: "Götter" }).raw
  === raw.replace('norm="Gott"', 'norm="Götter"'));
check("word semantic no-ops keep the original lexical form", updateWenzelsWord(doc, "w1", { text: "ſich", dipl: "ſich", norm: "sich" }) === doc);
check("mixed word text cannot be flattened", refuses(() => updateWenzelsWord(doc, "w2", { text: "god" })));
const choices = parseDocument('<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p><w xml:id="choice"><choice><orig>vnd</orig><reg>und</reg></choice></w><w xml:id="empty" orig="" norm="">Text</w></p></body></text></TEI>');
const choiceWords = readWenzelsWords(choices);
check("mixed choice readings disclose one branch per variant", choiceWords[0].dipl === "vnd" && choiceWords[0].norm === "und");
check("explicit empty reading attributes remain empty", choiceWords[1].dipl === "" && choiceWords[1].norm === "");

section("Bible mapping and multilingual notes");
const declaration = '<encodingDesc><refsDecl xml:id="vulgate-scheme"><cRefPattern matchPattern="([A-Za-z]+)\\.([0-9]+)\\.([0-9]+)" replacementPattern="https://example.test/declared-edition/$1/$2/$3"/></refsDecl></encodingDesc>';
const declaredDoc = parseDocument(raw.replace('</teiHeader>', `${declaration}</teiHeader>`));
const verseDoc = addBibleVerseMapping(declaredDoc, selection, { reference: "Gen 1:1", cRef: "Gen.1.1", quote: "In principio", note: "Check verse boundary", resp: "#editor" });
const verse = readBibleVerseMappings(verseDoc)[0];
check("Bible mappings use the original word identifiers and explicit canonical reference",
  verse.from === "#w1" && verse.to === "#w2" && verse.cRef === "Gen.1.1" && verse.reference === "Gen 1:1"
    && verse.quote === "In principio" && bodyBytes(verseDoc) === body);
check("an unchanged verse is an exact no-op", updateBibleVerseMapping(verseDoc, verse, {
  reference: verse.reference, cRef: verse.cRef, quote: verse.quote, note: verse.note, resp: verse.resp,
}) === verseDoc);
const verseChanged = updateBibleVerseMapping(verseDoc, verse, { from: "w2", to: "w3", reference: "Gen 1:2", cRef: "Gen.1.2", quote: "", note: "Boundary checked" });
check("verse endpoints and content can change together without changing source words",
  readBibleVerseMappings(verseChanged)[0].to === "#w3" && bodyBytes(verseChanged) === body
    && readBibleVerseMappings(verseChanged)[0].note === "Boundary checked");
check("removing a verse retains unrelated apparatus", removeBibleVerseMapping(verseDoc, verse).raw.includes(originalApp));
const noLatin = addBibleVerseMapping(doc, selection, { reference: "Gen 1:1" });
check("no Latin text is manufactured", !noLatin.raw.includes("<quote"));
check("free edition references do not invent an undeclared canonical scheme", !noLatin.raw.includes('cRef=')
  && noLatin.raw.includes('<ref type="vulgate">Gen 1:1</ref>'));
check("new canonical references require an explicit header contract", refuses(() => addBibleVerseMapping(doc, selection, { reference: "Gen 1:1", cRef: "Gen.1.1" })));
const incompleteDeclaration = parseDocument(raw.replace('</teiHeader>', '<encodingDesc><refsDecl><p>A vague reference note.</p></refsDecl></encodingDesc></teiHeader>'));
check("a prose note is not treated as a machine-readable canonical reference contract", refuses(() => addBibleVerseMapping(incompleteDeclaration, selection, { reference: "Gen 1:1", cRef: "Gen.1.1" })));
const ambiguousDeclaration = parseDocument(declaredDoc.raw.replace('</encodingDesc>', '<refsDecl><cRefPattern matchPattern="(.+)" replacementPattern="other.xml#$1"/></refsDecl></encodingDesc>'));
check("several unselected canonical schemes are rejected", refuses(() => addBibleVerseMapping(ambiguousDeclaration, selection, { reference: "Gen 1:1", cRef: "Gen.1.1" })));
const legacyVerseDoc = parseDocument(verseDoc.raw.replace(declaration, ''));
const legacyVerse = readBibleVerseMappings(legacyVerseDoc)[0];
check("existing undeclared cRef survives an exact form no-op", updateBibleVerseMapping(legacyVerseDoc, legacyVerse, { reference: legacyVerse.reference, cRef: legacyVerse.cRef }) === legacyVerseDoc);
check("a different field does not rewrite existing undeclared cRef", updateBibleVerseMapping(legacyVerseDoc, legacyVerse, { note: 'Edition inspected' }).raw.includes('cRef="Gen.1.1"'));
check("changing legacy cRef requires its explicit contract", refuses(() => updateBibleVerseMapping(legacyVerseDoc, legacyVerse, { cRef: 'Gen.1.2' })));
check("an explicit clear removes cRef without inventing a fallback", !updateBibleVerseMapping(legacyVerseDoc, legacyVerse, { cRef: '' }).raw.includes('cRef='));
const sparseVerse = readBibleVerseMappings(noLatin)[0];
check("empty optional verse form values do not create new XML", updateBibleVerseMapping(noLatin, sparseVerse, {
  reference: sparseVerse.reference, cRef: sparseVerse.cRef, quote: "", note: "", resp: "",
  from: sparseVerse.from, to: sparseVerse.to,
}) === noLatin);

section("Separate registers, Unicode identities and external references");
let registers = createWenzelsRegistersDocument();
registers = createWenzelsRegisterEntry(registers, { id: "Gott", kind: "person", name: "Gott", authorities: [{ type: "GND", value: "4021649-7" }] });
registers = createWenzelsRegisterEntry(registers, { id: "Paradiesgarten", kind: "place", name: "Paradiesgarten" });
registers = createWenzelsRegisterEntry(registers, { id: "Völker", kind: "people", name: "Völker" });
const records = readWenzelsRegisters(registers);
check("separate registers retain explicit Unicode IDs and kind semantics", records.length === 3
  && records.map((record) => record.id).join(",") === "Gott,Paradiesgarten,Völker"
  && registers.raw.includes('<listOrg type="peoples"><org xml:id="Völker" type="people">'));
check("duplicate register IDs are rejected", refuses(() => createWenzelsRegisterEntry(registers, { id: "Gott", kind: "place", name: "Other" })));
const god = records.find((record) => record.id === "Gott");
check("register no-ops retain source identity", updateWenzelsRegisterEntry(registers, god, { name: "Gott", authorities: god.authorities }) === registers);
const expanded = updateWenzelsRegisterEntry(registers, god, { authorities: [{ type: "Wikidata", value: "Q190" }] });
check("adding an authority preserves the existing identifiers", readWenzelsRegisters(expanded)[0].authorities.length === 2);
const named = updateWenzelsRegisterEntry(registers, "Paradiesgarten", { name: "Paradies & Garten" });
check("literal register values are escaped exactly once", named.raw.includes("Paradies &amp; Garten"));
const linkDoc = addWenzelsRegisterLink(doc, selection, { target: "registers.xml#Gott", registersDoc: registers });
const link = readWenzelsRegisterLinks(linkDoc)[0];
check("register mentions reference a separate document without copying records into the edition",
  link.target === "registers.xml#Gott" && bodyBytes(linkDoc) === body && !linkDoc.raw.includes("<person"));
check("duplicate register links are semantic no-ops", addWenzelsRegisterLink(linkDoc, selection, { target: link.target }) === linkDoc);
check("register link updates preserve source text", bodyBytes(updateWenzelsRegisterLink(linkDoc, link, { target: "registers.xml#Paradiesgarten", registersDoc: registers })) === body);
check("removing a register link leaves the separate register document untouched", readWenzelsRegisterLinks(removeWenzelsRegisterLink(linkDoc, link)).length === 0
  && readWenzelsRegisters(registers).length === 3);
check("missing loaded register targets are rejected", refuses(() => addWenzelsRegisterLink(doc, selection, { target: "registers.xml#Absent", registersDoc: registers })));
for (const target of ["https://example.org/registers.xml#Gott", "../registers.xml#Gott", "/registers.xml#Gott", "registers.xml#two words", "registers.xml#x#y"]) {
  check(`unsafe external pointer is refused: ${target}`, refuses(() => parseWenzelsRegisterTarget(target)));
}
check("register removal keeps other register types", readWenzelsRegisters(removeWenzelsRegisterEntry(registers, "Gott")).length === 2);
const namedTarget = parseDocument(registers.raw.replace('<orgName>Völker</orgName>', '<orgName xml:id="people-name">Völker</orgName>')
  .replace('<p/>', '<p><ref target="#people-name">A reference to the register name.</ref></p>'));
check("register deletion protects referenced descendant identifiers", refuses(() => removeWenzelsRegisterEntry(namedTarget, "Völker")));
const encodedTarget = parseDocument(namedTarget.raw.replace('target="#people-name"', 'target="registers.xml#people%2Dname"'));
check("descendant protection recognizes URI fragments and percent encoding", refuses(() => removeWenzelsRegisterEntry(encodedTarget, "Völker")));

section("Namespace and output schema contracts");
const prefixRaw = raw.replace(/<(\/?)([A-Za-z][\w.-]*)/g, "<$1t:$2").replace('xmlns="http://www.tei-c.org/ns/1.0"', 'xmlns:t="http://www.tei-c.org/ns/1.0"');
const prefixed = createWenzelsComment(parseDocument(prefixRaw), selection, { notes: [{ text: "Prefix-safe" }] });
check("new TEI preserves the document namespace prefix", prefixed.raw.includes("<t:app xml:id=") && prefixed.raw.includes("<t:anchor xml:id="));
const simple = parseDocument(`<TEI xmlns="http://www.tei-c.org/ns/1.0">${header}${body}</TEI>`);
const validComment = createWenzelsComment(simple, selection, { notes: [{ text: "Comment", lang: "en" }] });
const validVerse = addBibleVerseMapping(simple, selection, { reference: "Gen 1:1", quote: "In principio", note: "Comparison" });
const declaredVerse = addBibleVerseMapping(parseDocument(simple.raw.replace('</teiHeader>', `${declaration}</teiHeader>`)), selection, { reference: "Gen 1:1", cRef: "Gen.1.1" });
const validLink = addWenzelsRegisterLink(simple, selection, { target: "registers.xml#Gott" });
const removedLastComment = removeWenzelsComment(validComment, readWenzelsComments(validComment)[0]);
let emptiedRegisters = registers;
for (const id of ["Gott", "Paradiesgarten", "Völker"]) emptiedRegisters = removeWenzelsRegisterEntry(emptiedRegisters, id);
check("removing the last register entries removes empty required lists", !emptiedRegisters.raw.includes("<standOff"));
const schema = readFileSync("docs/schemas/tei-p5-4.11.0/tei_all.rng", "utf8");
for (const [name, candidate] of [["comment", validComment], ["Bible mapping", validVerse], ["declared Bible mapping", declaredVerse], ["registers", registers], ["register link", validLink], ["last comment removal", removedLastComment], ["last register removal", emptiedRegisters]]) {
  const results = await validateWithSchemas(candidate.raw, [{ name: "tei_all.rng", type: "relaxng", text: schema }]);
  check(`${name} output is accepted by TEI All`, results.every((result) => result.status === "valid"), JSON.stringify(results));
}

finish("wenzels_text_model_check passed");
