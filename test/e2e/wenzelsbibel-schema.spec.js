import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const schema = readFileSync(new URL("../../docs/schemas/wenzelsbibel-editorial.sch", import.meta.url));
const reviewSchema = Buffer.from(schema.toString().replace('defaultPhase="editing"', 'defaultPhase="review"'));
const source = `<TEI xmlns="http://www.tei-c.org/ns/1.0">
<teiHeader><fileDesc><titleStmt><title>Synthetic image catalogue</title></titleStmt>
<editionStmt><edition>Test edition</edition><respStmt><resp>Painters</resp><persName xml:id="artist-a">Painter A</persName><persName xml:id="artist-b">Painter B</persName></respStmt></editionStmt>
<publicationStmt><p>Synthetic test</p></publicationStmt><sourceDesc><p>Original synthetic fixture</p></sourceDesc></fileDesc></teiHeader>
<text><body><list type="image-annotations"><item xml:id="image-1" corresp="#zone-1">
<title>Initial A</title><note type="description" subtype="short">Short description</note><note type="description">Full description</note>
<dimensions><height unit="line">12</height></dimensions><ref type="folio" target="1ra"/>
<listPerson type="artists"><person corresp="#artist-a #artist-b"/></listPerson>
<listRef><ref type="iconclass-label" corresp="https://iconclass.org/11C"><desc xml:lang="de">Deutscher Begriff</desc><desc xml:lang="en">English label</desc></ref></listRef>
<note type="text-relation" subtype="statistic" corresp="#range(word-1, word-2)">Related text</note>
</item></list></body></text></TEI>`;

async function loadWithSchema(page, xml, review = true) {
  await page.addInitScript(() => {
    Object.defineProperty(window, "showOpenFilePicker", { value: undefined, configurable: true });
  });
  await page.goto("/editor.html");
  await page.locator("#btn-load").click();
  const sourceChooser = page.waitForEvent("filechooser");
  await page.locator("#menu-open").click();
  await (await sourceChooser).setFiles({ name: "synthetic-images.xml", mimeType: "application/xml", buffer: Buffer.from(xml) });
  await expect(page.locator("#ed-docstrip")).toContainText("synthetic-images.xml");
  await page.locator("#ed-val-chip").click();
  const schemaChooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Use session schema..." }).click();
  const name = review ? "wenzelsbibel-editorial-review.sch" : "wenzelsbibel-editorial.sch";
  await (await schemaChooser).setFiles({ name, mimeType: "application/xml", buffer: review ? reviewSchema : schema });
  await expect(page.locator("#ed-val-pop")).toContainText(name);
}

test("Wenzelsbibel review schema accepts complete records with multiple artists", async ({ page }) => {
  await loadWithSchema(page, source);
  const requested = page.waitForEvent("download");
  await page.locator("#btn-download").click();
  const download = await requested;
  expect(readFileSync(await download.path(), "utf8")).toBe(source);
  await expect(page.locator("#ed-val-pop")).toContainText("wenzelsbibel-editorial-review.sch: valid");
});

test("Wenzelsbibel review schema permits records without optional text ranges or Iconclass", async ({ page }) => {
  const optional = source.replace(/<listRef>.*?<\/listRef>/s, "")
    .replace(/<note type="text-relation".*?<\/note>/s, "");
  await loadWithSchema(page, optional);
  await page.getByRole("button", { name: "Validate schema set" }).click();
  await expect(page.locator("#ed-val-pop")).toContainText("wenzelsbibel-editorial-review.sch: valid");
});

test("Wenzelsbibel editing schema preserves incomplete records as downloadable XML", async ({ page }) => {
  const incomplete = source.replace("Short description", "")
    .replace("#artist-a #artist-b", "#unresolved")
    .replace("#range(word-1, word-2)", "#range(,)");
  await loadWithSchema(page, incomplete, false);
  const requested = page.waitForEvent("download");
  await page.locator("#btn-download").click();
  const download = await requested;
  expect(readFileSync(await download.path(), "utf8")).toBe(incomplete);
  await expect(page.locator("#ed-val-pop")).toContainText("wenzelsbibel-editorial.sch: valid");
});

const invalidCases = [
  ["empty title", source.replace("Initial A", " "), "nonempty title"],
  ["empty short description", source.replace("Short description", " "), "nonempty short description"],
  ["empty full description", source.replace("Full description", " "), "nonempty full description"],
  ["empty folio", source.replace('target="1ra"', 'target=""'), "folio target"],
  ["zero height", source.replace(">12</height>", ">0</height>"), "positive height"],
  ["missing attribution", source.replace(/<listPerson.*?<\/listPerson>/s, ""), "artist attribution"],
  ["unresolved second artist", source.replace("#artist-a #artist-b", "#artist-a #missing"), "Every artist pointer"],
  ["foreign artist register", source.replace('<persName xml:id="artist-b">', '<persName xmlns="urn:foreign" xml:id="artist-b">'), "Every artist pointer"],
  ["empty German label", source.replace("Deutscher Begriff", " "), "nonempty German label"],
  ["empty English label", source.replace("English label", " "), "nonempty English label"],
  ["missing range start", source.replace("#range(word-1, word-2)", "#range(,word-2)"), "two nonempty identifiers"],
  ["extra range endpoint", source.replace("#range(word-1, word-2)", "#range(word-1,word-2,word-3)"), "two nonempty identifiers"],
];

for (const [name, xml, diagnostic] of invalidCases) {
  test(`Wenzelsbibel explicit review schema blocks ${name}`, async ({ page }) => {
    await loadWithSchema(page, xml);
    const downloads = [];
    page.on("download", (download) => downloads.push(download));
    await page.locator("#btn-download").click();
    await expect(page.locator("#ed-status")).toContainText("Download blocked for the current revision");
    await expect(page.locator("#ed-val-pop")).toContainText("wenzelsbibel-editorial-review.sch: invalid");
    await expect(page.locator("#ed-val-pop")).toContainText(diagnostic);
    expect(downloads).toEqual([]);
  });
}
