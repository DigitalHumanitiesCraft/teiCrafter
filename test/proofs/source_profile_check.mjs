import { parseDocument } from "../../docs/js/editor/tei-document.js";
import { folioSourceSlice, parseEdition } from "../../docs/js/editor/edition.js";
import { inventoryDocument } from "../../docs/js/editor/document-inventory.js";
import { resolveSourceProfile } from "../../docs/js/editor/source-profile.js";
import { check, finish, section } from "./_assert.mjs";

const wrap = (header, body, extra = "") => `<TEI xmlns="http://www.tei-c.org/ns/1.0">${header}${extra}<text><body>${body}</body></text></TEI>`;
const header = "<teiHeader><fileDesc><titleStmt><title>T</title></titleStmt><publicationStmt><p>P</p></publicationStmt><sourceDesc><p>S</p></sourceDesc></fileDesc></teiHeader>";
const profile = (raw, project = null, schemaEvidence = null) => {
  const doc = parseDocument(raw);
  return resolveSourceProfile({ doc, inventory: inventoryDocument(doc), project, schemaEvidence });
};

section("Composable TEI source profiles");

const historical = profile(wrap(header, '<pb n="1" facs="https://example.org/scan/1"/><div><p>Record</p></div><pb n="2"/><p>More</p>'));
check("page-broken historical source uses page navigation", historical.navigation.primary.id === "pages");
check("external scan links activate a facsimile resource", historical.facsimile.mode === "source-doc");

const dictionary = profile(wrap(header, '<pb n="1"/><entry xml:id="e1"><form><orth>Wort</orth></form><sense><def>Definition</def></sense></entry>'));
check("dictionary entries take precedence over physical pages", dictionary.navigation.primary.id === "entries");
check("page navigation remains available as a secondary channel", dictionary.navigation.channels.some((channel) => channel.id === "pages"));
const restrictedDictionary = profile(
  wrap(header, '<pb n="1"/><entry xml:id="e1"><form><orth>Wort</orth></form></entry>'),
  null,
  { capabilities: { entries: false, pages: true }, completeness: "reachable" },
);
check("active schema evidence can conservatively disable a structural primary channel",
  restrictedDictionary.navigation.primary.id === "pages"
    && restrictedDictionary.capabilities.find((item) => item.id === "entries").allowed === false);
const dictionaryEdition = parseEdition(wrap(header, '<entry xml:id="e1"><form><orth>one</orth></form></entry><entry xml:id="e2"><form><orth>two</orth></form></entry>'));
check("the editor state partitions a dictionary by entries", dictionaryEdition.folios.length === 2
  && dictionaryEdition.folios[0].unitKind === "entries"
  && dictionaryEdition.folios[1].lines.flatMap((line) => line.cells).some((cell) => cell.text.includes("two")));
check("entry XML staging contains exactly the selected entry", folioSourceSlice(dictionaryEdition, 0).value.includes('xml:id="e1"')
  && !folioSourceSlice(dictionaryEdition, 0).value.includes('xml:id="e2"'));

const drama = profile(wrap(header, '<div type="act"><sp xml:id="s1"><speaker>A</speaker><p>Line</p></sp><sp><speaker>B</speaker><p>Reply</p></sp></div>'));
check("dramatic speech gets turn navigation", drama.navigation.primary.id === "speech-turns");

const corpus = profile(wrap(header, '<u who="#p1"><s><w lemma="go">Go</w><pc>!</pc></s></u>'));
check("linguistic corpus exposes token analysis", corpus.capabilities.find((item) => item.id === "token-analysis").enabled);
check("utterance corpus gets turn navigation", corpus.navigation.primary.id === "speech-turns");
const mixedEdition = parseEdition(wrap(header, "<p>untokenized <w>token</w><pc>!</pc></p>"));
check("mixed documents classify editing units locally", mixedEdition.cells.map((cell) => cell.editingKind).join(",") === "text-run,token,token");
const corpusEdition = parseEdition(`<teiCorpus xmlns="http://www.tei-c.org/ns/1.0">${wrap(header, "<u>first</u>")}${wrap(header, "<u>second</u>")}</teiCorpus>`);
check("teiCorpus navigation retains every member's reading text", corpusEdition.folios.length === 2
  && corpusEdition.folios[0].lines.flatMap((line) => line.cells).some((cell) => cell.text.includes("first"))
  && corpusEdition.folios[1].lines.flatMap((line) => line.cells).some((cell) => cell.text.includes("second")));

const correspondence = profile(wrap(header.replace("</teiHeader>", "<profileDesc><correspDesc><correspAction type=\"sent\"><persName>A</persName></correspAction></correspDesc></profileDesc></teiHeader>"), "<div><p>Letter</p></div>"));
check("correspondence metadata gets its own available panel", correspondence.metadataPanels.find((panel) => panel.id === "correspondence").available);

const critical = profile(wrap(header, "<p>A <app><lem>word</lem><rdg>variant</rdg></app>.</p>"));
check("critical edition exposes apparatus capability", critical.capabilities.find((item) => item.id === "apparatus").enabled);

const scanOnly = profile(`<TEI xmlns="http://www.tei-c.org/ns/1.0">${header}<facsimile><surface xml:id="s1"><graphic url="one.jpg"/></surface><surface xml:id="s2"><graphic url="two.jpg"/></surface></facsimile><text><body/></text></TEI>`);
check("facsimile-only TEI navigates its surfaces", scanOnly.navigation.primary.id === "surfaces" && scanOnly.navigation.primary.units.length === 2);
const scanEdition = parseEdition(`<TEI xmlns="http://www.tei-c.org/ns/1.0">${header}<facsimile><surface xml:id="s1"><graphic url="one.jpg"/></surface><surface xml:id="s2"><graphic url="two.jpg"/></surface></facsimile><text><body/></text></TEI>`);
check("the editor state keeps scan-only surfaces navigable", scanEdition.folios.length === 2 && scanEdition.folios[1].surfaceId === "s2");
check("surface source staging is scoped to the selected surface", folioSourceSlice(scanEdition, 1).value.includes('xml:id="s2"'));

const overrideMiss = profile(wrap(header, "<p>Text</p>"), { uiProfile: { primaryNavigation: "entries" } });
check("unsatisfied manifest override falls back and reports the reason", overrideMiss.navigation.primary.id === "document" && overrideMiss.issues.some((issue) => issue.code === "override-unsatisfied"));

const foreign = profile(wrap(header, '<x:entry xmlns:x="urn:foreign">Not TEI</x:entry><p>Text</p>'));
check("foreign elements do not trigger TEI capabilities", !foreign.capabilities.find((item) => item.id === "entries").present);
check("resolved profile evidence is JSON-serializable", JSON.stringify(dictionary).includes('"anchorRef"'));

finish("source_profile_check passed");
