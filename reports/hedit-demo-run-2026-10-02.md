# HEDIT demo protocol run, 2026-10-02

A protocol run of the SZD path that the HEDIT workshop in Heidelberg (5 and 6 October 2026) uses as demo material. It covers conversion, the editor with the output schema gate, and the recorded role proposals of the local mapping view. The run was observed in Microsoft Edge through Playwright against the Vite development server on `127.0.0.1`, at commit `a5f74d2`. No model API was called. Scholarly review of transcriptions and role decisions is outside this report.

## Conversion of o_szd.1079

The Page-JSON of `o_szd.1079` from `szd-htr` `origin/main` was converted with the [reference generator](../test/generators/szd-pagejson-to-tei.mjs). The generator's own proof reported a line-level load with five pages, five folios, five surfaces and a byte-identical round trip. The output is byte-identical to the shipped demo file `docs/data/editor/szd/o_szd.1079.tei.xml`. It differs from `test/fixtures/real/o_szd.1079.tei.xml`, which predates the current converter output.

## Editor path

| Step | Observation |
| --- | --- |
| Built-in example `editor.html#example=szd` | Loads with project Stefan Zweig Digital, type Letter, five pages. The facsimile loads from GAMS. The banner marks the transcription as unreviewed model output. |
| Download of the unchanged document | Passes the output gate against the repository default TEI P5 4.11.0 (TEI All). The downloaded bytes equal the source bytes. The chip changes from "structural checks passed" to "schema and structural checks passed". |
| Open the converted file through Load, Open | Loads into the reading view without the project manifest. |
| Mapping route `szd-mapping.html` | Shows the three content pages of `o_szd.1717` and `o_szd.1701`, eight roles per page, recorded rule and Jev proposals marked as not reviewed. No page errors. |

`npm run verify` and the mapping tests passed in the same state.

## Workshop consequence

The built-in examples are gated to local development (`FEATURES.examples`). On the public deployment at `https://dhcraft.org/teiCrafter/` the Load menu offers no example and `#example=szd` loads nothing, both observed on 2026-10-02. Participants who use the public editor need the file itself, for example from `https://dhcraft.org/teiCrafter/data/editor/szd/o_szd.1079.tei.xml`, which answered HTTP 200, and then open it through Load, Open. The project manifest is not applied on that path. The public mapping route states that the view is available on the local development server, and its dataset is not deployed.

## Recorded role proposals

The proposals are frozen records of the `szd-blind-2026-09-19` experiment. They are shown here against the visible transcription, not against approved reference annotations.

| Page | Role | Rules | Jev | Observation |
| --- | --- | --- | --- | --- |
| o_szd.1717 p1 | Writing place | "16.November 1936" | absent | The rule proposes the date as place. The address "49 Hallam Street, London W.1." at the head of the letter is proposed by neither. |
| o_szd.1717 p1 | Date | absent | unresolved | The date is present and legible. Jev places it under Dateline only. |
| o_szd.1717 p1 | Recipient | "Liebe Frau Meingast!" | same | Both propose the whole salutation instead of the name. |
| o_szd.1717 p1 | Signature, Sender | absent | "StefanZweig" | The span carries the OCR word merge of the transcription. |
| o_szd.1701 p1 | Page function | unresolved | cover | The page is an address side. |
| o_szd.1701 p1 | Sender, Recipient | absent | both "Anna Meingast" | Jev assigns the same name to both roles. The address side names the recipient. |
| o_szd.1701 p2 | Opening salutation, Recipient | "Liebe Frau Meingast, es ist nur na-" | same | The span covers the whole first line, not the salutation. |
| o_szd.1701 p2 | Closing formula, Signature, Sender | absent | "nur etwa 40 Seiten noch. Herzlichst AS" | One line-length span for three roles. The signature is "AS". |

Three patterns recur. Proposals follow line boundaries rather than the span of the role. Date, dateline and writing place are confused with each other. Recipient is read from the salutation. The mapping view handles these cases as designed, because every proposal stays unconfirmed until an editor selects the exact span. For the workshop, `o_szd.1717` page 1 shows all three patterns on one page.

## Not covered

Manual text correction in the reading view was not exercised in this run. The editor-path download, undo and reopen checks of `test/e2e/szd-research-refactor.spec.js` cover it with a supplied research corpus. Firefox was not run.
