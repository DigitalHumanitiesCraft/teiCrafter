/**
 * Proof: XML source editing follows exact page and metadata boundaries.
 *
 * The editor stages only the current page's exact raw span. Replacing that
 * span leaves the header, document scaffold and every other page byte-identical.
 *
 * Run: node test/proofs/source_page_check.mjs
 */

import { check, finish } from "./_assert.mjs";
import {
  elementSourceSlice,
  folioSourceSlice,
  parseEdition,
  spliceFolioSource,
  spliceSourceSlice,
} from "../../docs/js/editor/edition.js";

const raw = `<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <teiHeader><fileDesc><titleStmt><title>Page source proof</title></titleStmt></fileDesc></teiHeader>
  <text><body>
    <p><pb n="1"/>alpha</p>
    <p><pb n="2"/>beta</p>
  </body></text>
</TEI>`;

const state = parseEdition(raw);
check("the fixture projects two folios", state.folios.length === 2);

const first = folioSourceSlice(state, 0);
const second = folioSourceSlice(state, 1);
const metadata = elementSourceSlice(state, "teiHeader");
check("the first source slice starts at its page break", first.value.startsWith('<pb n="1"/>'));
check("the first source slice stops before the second page break",
  first.value.includes("alpha") && !first.value.includes('<pb n="2"/>') && !first.value.includes("beta"));
check("the second source slice contains only the second page reading span",
  second.value.startsWith('<pb n="2"/>') && second.value.includes("beta") && !second.value.includes("alpha"));
check("the metadata slice contains exactly the complete teiHeader",
  metadata.value === "<teiHeader><fileDesc><titleStmt><title>Page source proof</title></titleStmt></fileDesc></teiHeader>");

const edited = spliceFolioSource(state, first, first.value.replace("alpha", "ALPHA"));
check("the selected page edit is present", edited.includes('<pb n="1"/>ALPHA'));
check("the other page is byte-identical", edited.slice(second.start) === raw.slice(second.start));
check("the header and scaffold before the page are byte-identical",
  edited.slice(0, first.start) === raw.slice(0, first.start));
check("an unchanged page slice reproduces the complete document",
  spliceFolioSource(state, first, first.value) === raw);
check("the edited complete document remains parseable as the same two-page edition",
  parseEdition(edited).folios.length === 2);
const metadataReplacement = metadata.value.replace("Page source proof", "Metadata source proof");
const metadataEdited = spliceSourceSlice(state, metadata, metadataReplacement);
check("a metadata edit is confined to teiHeader",
  metadataEdited.slice(metadata.start + metadataReplacement.length) === raw.slice(metadata.end)
  && metadataEdited.includes("Metadata source proof"));
check("a missing element has no editable source slice",
  elementSourceSlice(state, "revisionDesc") === null);

finish("PASS: page and metadata XML edits preserve every byte outside their exact source span.");
