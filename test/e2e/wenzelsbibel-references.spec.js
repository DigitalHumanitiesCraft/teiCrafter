import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { COLD_SCHEMA_OUTPUT_TIMEOUT_MS, SCHEMA_WORKFLOW_TIMEOUT_MS } from "./helpers/schema-output-timing.js";

const header = '<teiHeader><fileDesc><titleStmt><title>Synthetic reference test</title></titleStmt><publicationStmt><p>Independent synthetic source.</p></publicationStmt><sourceDesc><p>No historical edition is supplied.</p></sourceDesc></fileDesc></teiHeader>';
const body = '<text><body><p><w xml:id="w1">first</w> <w xml:id="w2">second</w></p></body></text>';
const raw = `<TEI xmlns="http://www.tei-c.org/ns/1.0" type="wenzelsbibel-transcription">${header}${body}</TEI>`;
const declaration = '<encodingDesc><refsDecl xml:id="synthetic-scheme"><cRefPattern matchPattern="([A-Za-z]+)\\.([0-9]+)\\.([0-9]+)" replacementPattern="https://example.test/declared-edition/$1/$2/$3"/></refsDecl></encodingDesc>';

async function open(page, source) {
  await page.addInitScript(() => { Object.defineProperty(window, "showOpenFilePicker", { value: undefined, configurable: true }); });
  await page.goto("/editor.html");
  await page.locator("#btn-load").click();
  const chooser = page.waitForEvent("filechooser");
  await page.locator("#menu-open").click();
  await (await chooser).setFiles({ name: "synthetic-references.xml", mimeType: "application/xml", buffer: Buffer.from(source) });
  await expect(page.locator("#ed-docstrip")).toContainText("synthetic-references.xml");
  await page.getByRole("combobox", { name: "Wenzelsbibel workspace" }).selectOption("bible-verse");
  await page.getByRole("textbox", { name: "Book, chapter and verse", exact: true }).fill("Gen 1:1");
  await page.getByRole("textbox", { name: "First word ID", exact: true }).fill("w1");
  await page.getByRole("textbox", { name: "Last word ID", exact: true }).fill("w2");
}

async function workingCopy(page) {
  const event = page.waitForEvent("download");
  await page.locator("#btn-working-copy").click();
  return JSON.parse(readFileSync(await (await event).path(), "utf8")).record;
}

async function download(page) {
  const event = page.waitForEvent("download", { timeout: COLD_SCHEMA_OUTPUT_TIMEOUT_MS });
  await page.locator("#btn-download").click();
  return readFileSync(await (await event).path(), "utf8");
}

test("free verse references preserve staged input when an undeclared canonical reference is refused", async ({ page }) => {
  test.setTimeout(SCHEMA_WORKFLOW_TIMEOUT_MS);
  await open(page, raw);
  const canonical = page.getByRole("textbox", { name: "Canonical Vulgate reference", exact: true });
  const apply = page.locator(".ed-wb-form").getByRole("button", { name: "Apply", exact: true });
  await canonical.fill("Gen.1.1");
  await apply.click();
  await expect(page.locator(".ed-wb-feedback")).toContainText("requires one unambiguous refsDecl");
  await expect(canonical).toHaveValue("Gen.1.1");
  const pending = await workingCopy(page);
  expect(pending.raw).toBe(raw);
  expect(pending.staged.mode).toBe("wenzels");
  expect(pending.staged.value.fields.cRef).toBe("Gen.1.1");
  await canonical.fill("");
  await apply.click();
  const output = await download(page);
  expect(output).toContain('from="#w1" to="#w2" n="Gen 1:1"');
  expect(output).toContain('<ref type="vulgate">Gen 1:1</ref>');
  expect(output).not.toContain("cRef=");
  expect(output).not.toContain("<quote");
  expect(output).toContain(body);
  await page.locator("#btn-undo").click();
  expect((await workingCopy(page)).raw).toBe(raw);
});

test("an explicitly declared canonical reference remains distinct from the edition label", async ({ page }) => {
  test.setTimeout(SCHEMA_WORKFLOW_TIMEOUT_MS);
  const source = raw.replace("</teiHeader>", `${declaration}</teiHeader>`);
  await open(page, source);
  await page.getByRole("textbox", { name: "Canonical Vulgate reference", exact: true }).fill("Gen.1.1");
  await page.getByRole("textbox", { name: "Comment and reference edition", exact: true }).fill("Synthetic declared edition; no Latin text supplied.");
  await page.locator(".ed-wb-form").getByRole("button", { name: "Apply", exact: true }).click();
  const output = await download(page);
  expect(output).toContain('<ref type="vulgate" cRef="Gen.1.1">Gen 1:1</ref>');
  expect(output).toContain(declaration);
  expect(output).toContain(body);
  expect(output).not.toContain("<quote");
  await page.getByRole("textbox", { name: "Book, chapter and verse", exact: true }).fill("Genesis 1, verse 1");
  await page.locator(".ed-wb-form").getByRole("button", { name: "Apply", exact: true }).click();
  expect((await workingCopy(page)).raw).toBe(output.replaceAll("Gen 1:1", "Genesis 1, verse 1"));
});
