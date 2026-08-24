import { parseEdition } from "../../docs/js/editor/edition.js";
import { unitPositionLabel, unitTerms } from "../../docs/js/editor/unit-labels.js";
import { check, finish, section } from "./_assert.mjs";

section("Source-specific navigation terminology");

const dictionary = parseEdition(`<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body>
<entry xml:id="a"><form><orth>Alpha</orth></form></entry>
<entry xml:id="b"><form><orth>Beta</orth></form></entry>
</body></text></TEI>`);
check("dictionary terminology names entries", unitTerms(dictionary.sourceProfile).plural === "entries");
check("dictionary position keeps the source label", unitPositionLabel(dictionary, 1) === "entry 2/2 (Beta)");

const pages = parseEdition(`<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body>
<pb n="4r"/><p>Text</p><pb n="4v"/><p>More</p>
</body></text></TEI>`);
check("physical terminology names pages", unitTerms(pages.sourceProfile).singular === "page");
check("page position keeps the encoded label", unitPositionLabel(pages, 0) === "page 1/2 (4r)");

finish("unit_labels_check passed");
