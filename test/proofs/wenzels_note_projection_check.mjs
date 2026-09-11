import { parseDocument } from "../../docs/js/editor/tei-document.js";
import { parseEdition } from "../../docs/js/editor/edition.js";
import { noteDetailIndex, noteIndex } from "../../docs/js/editor/standoff.js";
import { annotationPageSummary } from "../../docs/js/editor/annotation-progress.js";
import { check, finish, section } from "./_assert.mjs";

const raw = `<tei:TEI xmlns:tei="http://www.tei-c.org/ns/1.0" xmlns:foreign="urn:foreign">
<tei:teiHeader><tei:standOff><tei:listApp><tei:app from="#start" to="#end"><tei:note>Header decoy</tei:note></tei:app></tei:listApp></tei:standOff></tei:teiHeader>
<tei:standOff><tei:note target="#w2">Direct target</tei:note><tei:listApp>
<tei:app type="comment_understandning" from="#start" to="#end"><tei:note xml:lang="de" resp="#editor #other">Deutsch &amp; genau</tei:note><tei:note xml:lang="en" resp="#translator">English <tei:hi>note</tei:hi></tei:note></tei:app>
<tei:app type="translation" from="#middle" to="#end"><tei:note target="#w2">Overlap</tei:note></tei:app>
<tei:app type="unknown" from="#missing" to="#end"><tei:note>Missing boundary</tei:note></tei:app>
<tei:app from="#end" to="#start"><tei:note>Reversed boundary</tei:note></tei:app>
<tei:app from="other.xml#start" to="#end"><tei:note>External boundary</tei:note></tei:app>
<tei:app from="#foreign-start" to="#end"><tei:note>Foreign boundary</tei:note></tei:app>
<tei:app from="#duplicate" to="#end"><tei:note>Duplicate boundary</tei:note></tei:app>
<tei:app from="#empty-from" to="#empty-to"><tei:note>Empty interval</tei:note></tei:app>
<foreign:app from="#start" to="#end"><foreign:note>Foreign app</foreign:note></foreign:app>
</tei:listApp></tei:standOff>
<tei:text><tei:body><tei:pb n="1"/><tei:p><tei:w xml:id="outside">Before</tei:w><tei:anchor xml:id="start"/><tei:w xml:id="w1">First</tei:w><tei:anchor xml:id="middle"/>
<tei:pb n="2"/><tei:w xml:id="w2">Second</tei:w><tei:anchor xml:id="end"/><tei:w xml:id="after">After</tei:w>
<foreign:anchor xml:id="foreign-start"/><tei:anchor xml:id="duplicate"/><tei:anchor xml:id="duplicate"/><tei:anchor xml:id="empty-from"/><tei:anchor xml:id="empty-to"/>
</tei:p></tei:body></tei:text></tei:TEI>`;

section("Apparatus notes project onto exact transcription ranges");
const doc = parseDocument(raw);
const index = noteDetailIndex(doc);
check("all languages annotate the first word", index.get("w1").length === 2
  && index.get("w1")[0].lang === "de" && index.get("w1")[1].lang === "en");
check("legacy types and responsibility token lists are preserved", index.get("w1")[0].type === "comment_understandning"
  && index.get("w1")[0].resp === "#editor #other");
check("note detail exposes the actual note and its containing apparatus entry",
  index.get("w1")[0].el.localName === "note" && index.get("w1")[0].app === index.get("w1")[0].el.parent);
check("overlapping notes and direct targets remain in source order without duplicates",
  index.get("w2").map((detail) => detail.text).join("|") === "Direct target|Deutsch & genau|English note|Overlap");
check("reading words outside the anchors have no marker", !index.has("outside") && !index.has("after"));
check("foreign, missing, duplicate, reversed and external anchors contribute no false marker",
  [...index.values()].flat().every((detail) => !/boundary|Header|Foreign|Empty/.test(detail.text)));
check("projection leaves every source byte unchanged", doc.raw === raw);
check("the text-only note index includes apparatus notes", noteIndex(doc).get("w1").join("|") === "Deutsch & genau|English note");
const state = parseEdition(raw);
const summary = annotationPageSummary(state, noteIndex(state.doc));
check("markup navigation recognizes notes across page breaks", summary.pages.length === 2
  && summary.pages.every((page) => page.kinds.has("notes")));

const partial = parseDocument('<TEI xmlns="http://www.tei-c.org/ns/1.0"><standOff><listApp><app from="#a" to="#b"><note>Partial word</note></app></listApp></standOff><text><body><p><w xml:id="word">be<anchor xml:id="a"/>tween<anchor xml:id="b"/>s</w></p></body></text></TEI>');
check("anchors inside a word still mark that word", noteIndex(partial).get("word")[0] === "Partial word");
const duplicatedWord = parseDocument(raw.replace('xml:id="w2"', 'xml:id="w1"').replace('<tei:note target="#w2">Direct target</tei:note>', "").replace(' target="#w2"', ""));
check("ambiguous word identities receive no ranged projection", !noteIndex(duplicatedWord).has("w1"));

section("Many sparse apparatus intervals");
const entries = [];
const words = [];
for (let number = 0; number < 6000; number++) {
  if (number % 20 === 0) entries.push(`<app type="translation" from="#a${number}" to="#b${number}"><note>Note ${number}</note></app>`);
  words.push(`<anchor xml:id="a${number}"/><w xml:id="w${number}">Word ${number}</w><anchor xml:id="b${number}"/>`);
}
const sparseRaw = `<TEI xmlns="http://www.tei-c.org/ns/1.0"><standOff><listApp>${entries.join("")}</listApp></standOff><text><body><p>${words.join(" ")}</p></body></text></TEI>`;
const sparse = noteIndex(parseDocument(sparseRaw));
check("sparse intervals mark exactly their independently selected words", sparse.size === 300
  && [...sparse.keys()].every((id) => Number(id.slice(1)) % 20 === 0)
  && sparse.get("w5980")[0] === "Note 5980");

finish("wenzels_note_projection_check passed");
