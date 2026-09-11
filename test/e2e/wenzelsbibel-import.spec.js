import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const original = '<TEI xmlns="http://www.tei-c.org/ns/1.0" type="wenzelsbibel-transcription"><teiHeader><fileDesc><titleStmt><title>Synthetic Wenzelsbibel import</title></titleStmt><publicationStmt><p>Test</p></publicationStmt><sourceDesc><p>Synthetic source.</p></sourceDesc></fileDesc></teiHeader><text><body><pb n="original"/><p><w xml:id="original-word" orig="got" norm="Gott">got</w></p></body></text></TEI>';
const pageNamespace = "http://schema.primaresearch.org/PAGE/gts/pagecontent/2019-07-15";

function pageXml(label, prefix, image, words, degenerate = false) {
  const name = (local) => `${prefix}${local}`;
  const escapeXml = (text) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
  const wordXml = words.map((word, index) => `<${name("Word")} id="word${index + 1}"><${name("TextEquiv")}><${name("Unicode")}>${escapeXml(word)}</${name("Unicode")}></${name("TextEquiv")}></${name("Word")}>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><${name("PcGts")} ${prefix ? `xmlns:${prefix.slice(0, -1)}` : "xmlns"}="${pageNamespace}"><${name("Metadata")}><${name("Creator")}>Synthetic browser proof</${name("Creator")}><${name("MetadataItem")}><${name("Labels")}><${name("Label")} value="test"/><${name("Property")} key="folio" value="${label}"/></${name("Labels")}></${name("MetadataItem")}></${name("Metadata")}><${name("Page")} imageFilename="${image}" imageWidth="100" imageHeight="200"><${name("TextRegion")} id="region"><${name("Coords")} points="${degenerate ? "10,10 20,20" : "0,0 90,0 90,90"}"/><${name("TextLine")} id="line">${wordXml}<${name("TextEquiv")}><${name("Unicode")}>${escapeXml(words.join(" "))}</${name("Unicode")}></${name("TextEquiv")}></${name("TextLine")}></${name("TextRegion")}></${name("Page")}></${name("PcGts")}>`;
}

const files = [
  { name: "PAGE2.xml", mimeType: "application/xml", buffer: Buffer.from(pageXml("PAGE2", "", "second.png", ["Zweit", "𐍈"])) },
  { name: "PAGE1.xml", mimeType: "application/xml", buffer: Buffer.from(`\uFEFF${pageXml("PAGE1", "pc:", "1234_0001.png", ["Êrst", "&", "ſ"], true)}`) },
];

async function openSynthetic(page) {
  await page.addInitScript(() => {
    Object.defineProperty(window, "showOpenFilePicker", { value: undefined, configurable: true });
  });
  await page.goto("/editor.html");
  await page.locator("#btn-load").click();
  const chooser = page.waitForEvent("filechooser");
  await page.locator("#menu-open").click();
  await (await chooser).setFiles({ name: "synthetic-codex.xml", mimeType: "application/xml", buffer: Buffer.from(original) });
  await expect(page.locator("#ed-docstrip")).toContainText("synthetic-codex.xml");
  await expect(page.getByRole("combobox", { name: "Wenzelsbibel workspace" })).toBeVisible();
}

async function workingCopy(page) {
  const requested = page.waitForEvent("download");
  await page.locator("#btn-working-copy").click();
  const text = readFileSync(await (await requested).path(), "utf8");
  return { text, record: JSON.parse(text).record };
}

async function checkVisibleSummary(page) {
  const details = page.locator("details").filter({ has: page.locator("summary", { hasText: "PAGE import: 2 pages (natural filename order)" }) });
  await expect(details).toBeVisible();
  await details.locator("summary").click();
  await expect(details).toContainText("fewer than three polygon points");
  await expect(details).toContainText("Transkribus-prefixed image filenames are retained");
}

test("PAGE import retains ordered words and source notices through recovery and working-copy reopen", async ({ page, context }) => {
  test.setTimeout(120_000);
  const runtimeErrors = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  await openSynthetic(page);
  await page.getByRole("combobox", { name: "Wenzelsbibel workspace" }).selectOption("import");
  const form = page.getByRole("form", { name: "Import PAGE XML", exact: true });
  await form.getByLabel("Draft title", { exact: true }).fill("Synthetic PAGE draft");
  await form.getByLabel("PAGE XML files", { exact: true }).setInputFiles(files);
  await expect(form.getByRole("status")).toContainText("PAGE2.xml, PAGE1.xml");
  await expect(form.getByRole("combobox", { name: "Page order", exact: true })).toHaveValue("filename");
  await form.getByRole("button", { name: "Create TEI draft", exact: true }).click();
  await expect(page.locator("#ed-docstrip")).toContainText("Synthetic PAGE draft.xml");
  await expect(page.locator("#ed-folio-label")).toContainText("1/2");
  await checkVisibleSummary(page);

  const saved = await workingCopy(page);
  expect(saved.record.raw).not.toBe(original);
  expect(saved.record.raw).toContain('type="wenzelsbibel-transcription"');
  expect(saved.record.raw).toContain('type="page-xml-coordinates"');
  expect(saved.record.raw).toContain("10,10 20,20");
  const parsed = await page.evaluate((raw) => {
    const xml = new DOMParser().parseFromString(raw, "application/xml");
    const nodes = (local) => [...xml.getElementsByTagNameNS("http://www.tei-c.org/ns/1.0", local)];
    return { errors: xml.getElementsByTagName("parsererror").length,
      pages: nodes("pb").map((node) => node.getAttribute("n")),
      words: nodes("w").map((node) => node.textContent),
      images: nodes("graphic").map((node) => node.getAttribute("url")) };
  }, saved.record.raw);
  expect(parsed).toEqual({ errors: 0, pages: ["PAGE1", "PAGE2"], words: ["Êrst", "&", "ſ", "Zweit", "𐍈"], images: ["1234_0001.png", "second.png"] });
  const summary = saved.record.source.importSummary;
  expect(summary).toMatchObject({ format: "page-xml", pages: 2, order: "natural filename order" });
  expect(summary.warnings).toEqual(expect.arrayContaining([
    expect.stringContaining("fewer than three polygon points"),
    expect.stringContaining("Transkribus-prefixed image filenames"),
  ]));

  await page.reload();
  const recovery = page.locator(".ed-recent-row").filter({ hasText: "Synthetic PAGE draft.xml" });
  await expect(recovery.getByRole("button", { name: "Restore", exact: true })).toBeVisible();
  await recovery.getByRole("button", { name: "Restore", exact: true }).click();
  await expect(page.locator("#ed-docstrip")).toContainText("Synthetic PAGE draft.xml");
  await checkVisibleSummary(page);
  const restored = await workingCopy(page);
  expect(restored.record.raw).toBe(saved.record.raw);
  expect(restored.record.source.importSummary).toEqual(summary);

  const reopenedPage = await context.newPage();
  reopenedPage.on("pageerror", (error) => runtimeErrors.push(error.message));
  await reopenedPage.goto("/editor.html");
  const chooser = reopenedPage.waitForEvent("filechooser");
  await reopenedPage.locator("#btn-open-working-copy").click();
  await (await chooser).setFiles({ name: "import.teicrafter.json", mimeType: "application/json", buffer: Buffer.from(saved.text) });
  await expect(reopenedPage.locator("#ed-docstrip")).toContainText("Synthetic PAGE draft.xml");
  await checkVisibleSummary(reopenedPage);
  const reopened = await workingCopy(reopenedPage);
  expect(reopened.record.raw).toBe(saved.record.raw);
  expect(reopened.record.source.importSummary).toEqual(summary);
  await reopenedPage.close();
  expect(runtimeErrors).toEqual([]);
});

test("read-only Wenzelsbibel blocks PAGE draft creation at the form boundary", async ({ page }) => {
  await openSynthetic(page);
  await page.locator("#btn-read-only").click();
  await page.getByRole("combobox", { name: "Wenzelsbibel workspace" }).selectOption("import");
  const form = page.getByRole("form", { name: "Import PAGE XML", exact: true });
  await form.getByLabel("PAGE XML files", { exact: true }).setInputFiles(files);
  await expect(form.getByRole("button", { name: "Create TEI draft", exact: true })).toBeDisabled();
  await form.dispatchEvent("submit");
  const saved = await workingCopy(page);
  expect(saved.record.raw).toBe(original);
  expect(saved.record.source.importSummary).toBeUndefined();
  await expect(page.locator("#ed-docstrip")).toContainText("synthetic-codex.xml");
  await expect(page.getByText("PAGE import: 2 pages (natural filename order)", { exact: true })).toHaveCount(0);
});
