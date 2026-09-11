import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { decodeWorkingCopy } from "../../docs/js/editor/working-copy.js";
import { decodeProjectBundle } from "../../docs/js/editor/project-bundle.js";
import { createWenzelsRegistersDocument } from "../../docs/js/editor/wenzels-register-model.js";

const header = '<teiHeader><fileDesc><titleStmt><title>Linked project proof</title></titleStmt><publicationStmt><p>Synthetic test</p></publicationStmt><sourceDesc><p>Synthetic source</p></sourceDesc></fileDesc></teiHeader>';
const codex = `<TEI xmlns="http://www.tei-c.org/ns/1.0" type="wenzelsbibel-transcription">${header}<text><body><p><w xml:id="w1" orig="got" norm="Gott">got</w></p></body></text></TEI>`;
const images = `<TEI xmlns="http://www.tei-c.org/ns/1.0">${header}<text><body><list type="image-annotations" subtype="miniatures"><item xml:id="image1"><title>Initial</title></item></list></body></text></TEI>`;
const registers = createWenzelsRegistersDocument().raw;
const file = (name, raw, bom = false) => ({ name, mimeType: "application/xml", buffer: Buffer.from((bom ? "\uFEFF" : "") + raw) });

async function open(page) {
  await page.addInitScript(() => Object.defineProperty(window, "showOpenFilePicker", { value: undefined, configurable: true }));
  await page.goto("/editor.html");
  await page.locator("#btn-load").click();
  const chooser = page.waitForEvent("filechooser");
  await page.locator("#menu-open").click();
  await (await chooser).setFiles(file("codex.xml", codex, true));
  await expect(page.getByRole("combobox", { name: "Wenzelsbibel workspace" })).toBeVisible();
}

async function resources(page) {
  const details = page.locator("details.ed-wb-resources");
  if (!await details.evaluate((node) => node.open)) await details.locator("summary").click();
  return details;
}

async function attach(page, label, name, raw, bom = false) {
  await resources(page);
  await page.getByLabel(label, { exact: true }).setInputFiles(file(name, raw, bom));
  await expect(page.locator("#ed-status")).toContainText(`${name} attached for reference lookup`);
}

async function activate(page, name) {
  const details = await resources(page);
  await details.locator(".ed-wb-resource").filter({ hasText: name }).getByRole("button", { name: "Open for editing", exact: true }).click();
  await expect(page.locator("#ed-docstrip")).toContainText(name);
}

async function copy(page) {
  const download = page.waitForEvent("download");
  await page.locator("#btn-working-copy").click();
  const bytes = readFileSync(await (await download).path());
  return { bytes, record: decodeWorkingCopy(bytes.toString("utf8")) };
}

function expectProject(record, expected) {
  expect(record.projectDocuments.documents).toHaveLength(expected.length);
  for (const [name, raw, bom, dirty] of expected) {
    const entry = record.projectDocuments.documents.find((item) => item.name === name);
    expect(entry).toMatchObject({ name, raw, fileEncoding: { encoding: "UTF-8", bom }, dirty });
    expect(entry.project.id || entry.project.workspace).toBe("wenzelsbibel");
  }
}

test("linked XML changes survive recovery, working copy and one validated project package", async ({ page, context }) => {
  test.setTimeout(240_000);
  const errors = [], dialogs = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("dialog", async (dialog) => { dialogs.push(dialog.message()); await dialog.accept(); });
  await open(page);
  await page.getByRole("textbox", { name: /^Normalized reading/ }).fill("GOTT");
  await page.locator(".ed-wb-form").getByRole("button", { name: "Apply", exact: true }).click();
  await attach(page, "Attach Image annotations", "images.xml", images);
  await attach(page, "Attach Registers", "registers.xml", registers, true);
  await activate(page, "images.xml");
  await page.getByRole("combobox", { name: "Image annotation", exact: true }).selectOption("image1");
  await page.getByRole("textbox", { name: "Image title", exact: true }).fill("Changed initial");
  await page.locator(".ed-wb-form").getByRole("button", { name: "Apply", exact: true }).click();
  await activate(page, "registers.xml");
  await page.getByRole("textbox", { name: "XML ID", exact: true }).fill("Gott");
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Gott");
  await page.locator(".ed-wb-form").getByRole("button", { name: "Apply", exact: true }).click();
  const saved = await copy(page);
  const registerChanged = saved.record.raw;
  const expected = [["codex.xml", codex.replace('norm="Gott"', 'norm="GOTT"'), true, true],
    ["images.xml", images.replace("Initial", "Changed initial"), false, true], ["registers.xml", registerChanged, true, true]];
  expectProject(saved.record, expected);
  expect(dialogs).toEqual([]);

  await page.reload();
  await page.locator(".ed-recent-row").filter({ hasText: "registers.xml" }).getByRole("button", { name: "Restore", exact: true }).first().click();
  await expect(page.locator("#ed-docstrip")).toContainText("registers.xml");
  expectProject((await copy(page)).record, expected);
  await activate(page, "codex.xml");
  await expect(page.getByRole("textbox", { name: /^Normalized reading/ })).toHaveValue("GOTT");

  const reopened = await context.newPage();
  await reopened.goto("/editor.html");
  const workingChooser = reopened.waitForEvent("filechooser");
  await reopened.locator("#btn-open-working-copy").click();
  await (await workingChooser).setFiles({ name: "project.teicrafter.json", mimeType: "application/json", buffer: saved.bytes });
  await expect(reopened.locator("#ed-docstrip")).toContainText("registers.xml");
  expectProject((await copy(reopened)).record, expected);
  const request = reopened.waitForEvent("download", { timeout: 150_000 });
  await reopened.locator("#btn-project-package").click();
  const bundle = readFileSync(await (await request).path());
  expectProject({ projectDocuments: decodeProjectBundle(bundle) }, expected);
  await reopened.close();

  const packagePage = await context.newPage();
  await packagePage.goto("/editor.html");
  await packagePage.locator("#btn-load").click();
  const packageChooser = packagePage.waitForEvent("filechooser");
  await packagePage.locator("#menu-project-package").click();
  await (await packageChooser).setFiles({ name: "teicrafter-project.zip", mimeType: "application/zip", buffer: bundle });
  await expect(packagePage.locator("#ed-docstrip")).toContainText("registers.xml");
  expectProject((await copy(packagePage)).record, expected);
  await packagePage.close();
  expect(errors).toEqual([]);
});

test("an invalid companion blocks the complete project package while working copy retains it", async ({ page }) => {
  test.setTimeout(180_000);
  await open(page);
  const invalid = images.replace("<title>Initial</title>", "<notInTei>Initial</notInTei>");
  await attach(page, "Attach Image annotations", "invalid-images.xml", invalid);
  let downloads = 0;
  page.on("download", () => downloads++);
  await page.locator("#btn-project-package").click();
  await expect(page.locator("#ed-status")).toContainText(/Project export blocked|Project package blocked/, { timeout: 150_000 });
  expect(downloads).toBe(0);
  const saved = await copy(page);
  expect(saved.record.projectDocuments.documents.find((entry) => entry.name === "invalid-images.xml").raw).toBe(invalid);
});

test("failed local storage keeps linked XML in memory and blocks a document switch", async ({ page }) => {
  await page.addInitScript(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === "sessions") throw new DOMException("Synthetic quota refusal", "QuotaExceededError");
      return Reflect.apply(original, this, args);
    };
  });
  await open(page);
  await page.getByRole("textbox", { name: /^Normalized reading/ }).fill("Preserved");
  await page.locator(".ed-wb-form").getByRole("button", { name: "Apply", exact: true }).click();
  await resources(page);
  await page.getByLabel("Attach Image annotations", { exact: true }).setInputFiles(file("images.xml", images));
  await expect(page.locator("#ed-status")).toContainText("Local recovery failed");
  const details = await resources(page);
  await details.locator(".ed-wb-resource").filter({ hasText: "images.xml" }).getByRole("button", { name: "Open for editing", exact: true }).click();
  await expect(page.locator("#ed-status")).toContainText("Local recovery failed");
  await expect(page.locator("#ed-docstrip")).toContainText("codex.xml");
  expectProject((await copy(page)).record, [["codex.xml", codex.replace('norm="Gott"', 'norm="Preserved"'), true, true],
    ["images.xml", images, false, false]]);
});

test("cancelling live project validation never requests a package", async ({ page }) => {
  await open(page);
  let downloads = 0;
  page.on("download", () => downloads++);
  await page.locator("#btn-project-package").click();
  await expect(page.locator("#btn-cancel-project-package")).toBeVisible();
  await page.locator("#btn-cancel-project-package").click();
  await expect(page.locator("#ed-status")).toContainText("Project export cancelled");
  await expect(page.locator("#btn-cancel-project-package")).toBeHidden();
  expect(downloads).toBe(0);
  expect((await copy(page)).record.raw).toBe(codex);
});
