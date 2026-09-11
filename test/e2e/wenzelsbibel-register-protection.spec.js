import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const header = '<teiHeader><fileDesc><titleStmt><title>Synthetic deletion protection</title></titleStmt><publicationStmt><p>Independent test</p></publicationStmt><sourceDesc><p>Synthetic source</p></sourceDesc></fileDesc></teiHeader>';
const codex = `<TEI xmlns="http://www.tei-c.org/ns/1.0" type="wenzelsbibel-transcription">${header}<text><body><p><w xml:id="w1">Word</w><ref target="registers.xml#people%2Dname other.xml#spare">Supplied references</ref></p></body></text></TEI>`;
const protectedEntry = '<org xml:id="people-1" type="people"><orgName xml:id="people-name">Synthetic people</orgName></org>';
const removableEntry = '<org xml:id="spare" type="people"><orgName>Unreferenced people</orgName></org>';
const registers = `<TEI xmlns="http://www.tei-c.org/ns/1.0" type="wenzelsbibel-registers">${header}<standOff><listOrg type="peoples">${protectedEntry}${removableEntry}</listOrg></standOff><text><body><p/></body></text></TEI>`;

async function copy(page) {
  const download = page.waitForEvent("download");
  await page.locator("#btn-working-copy").click();
  return JSON.parse(readFileSync(await (await download).path(), "utf8")).record;
}

async function resources(page) {
  const details = page.locator("details.ed-wb-resources");
  if (!await details.evaluate((node) => node.open)) await details.locator("summary").click();
  return details;
}

test("register deletion protects encoded companion references to descendant IDs without changing source encoding", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, "showOpenFilePicker", { value: undefined, configurable: true }));
  await page.goto("/editor.html");
  await page.locator("#btn-load").click();
  const chooser = page.waitForEvent("filechooser");
  await page.locator("#menu-open").click();
  await (await chooser).setFiles({ name: "codex.xml", mimeType: "application/xml", buffer: Buffer.from(codex) });
  await expect(page.getByRole("combobox", { name: "Wenzelsbibel workspace" })).toBeVisible();
  await resources(page);
  await page.getByLabel("Attach Registers", { exact: true }).setInputFiles({ name: "registers.xml", mimeType: "application/xml", buffer: Buffer.from(`\uFEFF${registers}`) });
  await expect(page.locator("#ed-status")).toContainText("registers.xml attached for reference lookup");
  const details = await resources(page);
  await details.locator(".ed-wb-resource").filter({ hasText: "registers.xml" }).getByRole("button", { name: "Open for editing", exact: true }).click();
  await expect(page.locator("#ed-docstrip")).toContainText("registers.xml");
  const selection = page.getByRole("combobox", { name: "Register entry", exact: true });
  await selection.selectOption("people-1");
  await page.getByRole("button", { name: "Remove annotation", exact: true }).click();
  await expect(page.locator(".ed-wb-feedback")).toContainText("codex.xml still references this register entry or its contents");
  const untouched = await copy(page);
  expect(untouched.raw).toBe(registers);
  expect(untouched.fileEncoding).toMatchObject({ encoding: "UTF-8", bom: true });
  expect(untouched.projectDocuments.documents.find((entry) => entry.name === "codex.xml").raw).toBe(codex);
  await selection.selectOption("spare");
  await page.getByRole("button", { name: "Remove annotation", exact: true }).click();
  const removed = await copy(page);
  expect(removed.raw).toBe(registers.replace(removableEntry, ""));
  expect(removed.fileEncoding).toMatchObject({ encoding: "UTF-8", bom: true });
  await page.locator("#btn-undo").click();
  expect((await copy(page)).raw).toBe(registers);
});
