import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { decodeWorkingCopy } from "../../docs/js/editor/working-copy.js";
import { createWenzelsRegistersDocument } from "../../docs/js/editor/wenzels-register-model.js";

const header = '<teiHeader><fileDesc><titleStmt><title>Project transition proof</title></titleStmt><publicationStmt><p>Synthetic test</p></publicationStmt><sourceDesc><p>Synthetic source</p></sourceDesc></fileDesc></teiHeader>';
const codex = `<TEI xmlns="http://www.tei-c.org/ns/1.0" type="wenzelsbibel-transcription">${header}<text><body><p><w xml:id="w1" orig="got" norm="Gott">got</w></p></body></text></TEI>`;
const images = `<TEI xmlns="http://www.tei-c.org/ns/1.0">${header}<text><body><list type="image-annotations" subtype="miniatures"><item xml:id="image1"><title>Initial</title></item></list></body></text></TEI>`;
const registers = createWenzelsRegistersDocument().raw;
const customSchema = '<schema xmlns="http://purl.oclc.org/dsdl/schematron"><pattern id="codex-session"><rule context="*"><assert test="true()">Synthetic schema ownership proof</assert></rule></pattern></schema>';
const pageXml = '<PcGts xmlns="http://schema.primaresearch.org/PAGE/gts/pagecontent/2019-07-15"><Metadata><Creator>Synthetic proof</Creator></Metadata><Page imageFilename="page.png" imageWidth="100" imageHeight="200"><TextRegion id="r"><TextLine id="l"><Word id="w"><TextEquiv><Unicode>Genesis</Unicode></TextEquiv></Word><TextEquiv><Unicode>Genesis</Unicode></TextEquiv></TextLine></TextRegion></Page></PcGts>';
const xmlFile = (name, raw, bom = false) => ({ name, mimeType: "application/xml", buffer: Buffer.from((bom ? "\uFEFF" : "") + raw) });

async function open(page) {
  await page.addInitScript(() => Object.defineProperty(window, "showOpenFilePicker", { value: undefined, configurable: true }));
  await page.goto("/editor.html");
  await page.locator("#btn-load").click();
  const chooser = page.waitForEvent("filechooser");
  await page.locator("#menu-open").click();
  await (await chooser).setFiles(xmlFile("codex.xml", codex, true));
  await expect(page.getByRole("combobox", { name: "Wenzelsbibel workspace" })).toBeVisible();
}

async function resources(page) {
  const details = page.locator("details.ed-wb-resources");
  if (!await details.evaluate((node) => node.open)) await details.locator("summary").click();
  return details;
}

async function attach(page, label, name, raw) {
  await resources(page);
  await page.getByLabel(label, { exact: true }).setInputFiles(xmlFile(name, raw));
  await expect(page.locator("#ed-status")).toContainText(`${name} attached for reference lookup`);
}

async function requestSwitch(page, name) {
  const details = await resources(page);
  await details.locator(".ed-wb-resource").filter({ hasText: name })
    .getByRole("button", { name: "Open for editing", exact: true }).click();
}

async function activate(page, name) {
  await requestSwitch(page, name);
  await expect(page.locator("#ed-docstrip")).toContainText(name);
}

async function copy(page) {
  const requested = page.waitForEvent("download");
  await page.locator("#btn-working-copy").click();
  return decodeWorkingCopy(readFileSync(await (await requested).path(), "utf8"));
}

async function useSchema(page) {
  await page.locator("#ed-val-chip").click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Use session schema..." }).click();
  await (await chooser).setFiles(xmlFile("codex-session.sch", customSchema));
  await expect(page.locator("#ed-val-pop")).toContainText("codex-session.sch");
  await page.locator("#ed-val-chip").click();
}

const entry = (record, name) => record.projectDocuments.documents.find((item) => item.name === name);
const expectCustom = (settings) => expect(settings?.customSchema).toMatchObject({ name: "codex-session.sch", text: customSchema });

async function latestRecovery(page, name) {
  return page.evaluate(async (docName) => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("teicrafter.recovery");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return new Promise((resolve, reject) => {
      const request = db.transaction("sessions").objectStore("sessions").getAll();
      request.onsuccess = () => {
        db.close();
        resolve(request.result.filter((record) => record.docName === docName)
          .sort((left, right) => right.savedAt.localeCompare(left.savedAt))[0] || null);
      };
      request.onerror = () => { db.close(); reject(request.error); };
    });
  }, name);
}

async function expectSeparateSchemas(page, activeName) {
  const saved = await copy(page);
  expect(saved.docName).toBe(activeName);
  expect(saved.schemaSettings?.customSchema).toBeNull();
  expect(entry(saved, activeName).schemaSettings?.customSchema ?? null).toBeNull();
  expectCustom(entry(saved, "codex.xml").schemaSettings);
  await expect.poll(async () => {
    const record = await latestRecovery(page, activeName);
    return record && { active: record.schemaSettings?.customSchema ?? null,
      previous: entry(record, "codex.xml").schemaSettings?.customSchema?.name };
  }).toEqual({ active: null, previous: "codex-session.sch" });
  await page.locator("#ed-val-chip").click();
  await expect(page.locator("#ed-val-pop")).not.toContainText("codex-session.sch");
  await page.locator("#ed-val-chip").click();
}

test("new shared registers and normal companion switches retain independent schema settings", async ({ page }) => {
  await open(page);
  await useSchema(page);
  await attach(page, "Attach Image annotations", "images.xml", images);
  await resources(page);
  await page.getByRole("button", { name: "New shared registers", exact: true }).click();
  await expect(page.locator("#ed-docstrip")).toContainText("registers.xml");
  await expectSeparateSchemas(page, "registers.xml");
  await activate(page, "codex.xml");
  expectCustom((await copy(page)).schemaSettings);
  await activate(page, "images.xml");
  await expectSeparateSchemas(page, "images.xml");
  await activate(page, "codex.xml");
  expectCustom((await copy(page)).schemaSettings);
});

test("a PAGE draft starts with its own default schema while retaining the codex session schema", async ({ page }) => {
  await open(page);
  await useSchema(page);
  await page.getByRole("combobox", { name: "Wenzelsbibel workspace" }).selectOption("import");
  const form = page.getByRole("form", { name: "Import PAGE XML", exact: true });
  await form.getByLabel("Draft title", { exact: true }).fill("Independent PAGE draft");
  await form.getByLabel("PAGE XML files", { exact: true }).setInputFiles(xmlFile("page.xml", pageXml));
  await form.getByRole("button", { name: "Create TEI draft", exact: true }).click();
  await expect(page.locator("#ed-docstrip")).toContainText("Independent PAGE draft.xml");
  await expectSeparateSchemas(page, "Independent PAGE draft.xml");
  expect((await copy(page)).raw).toContain("Genesis");
  await activate(page, "codex.xml");
  expectCustom((await copy(page)).schemaSettings);
});

async function delayNextRecovery(page) {
  await page.evaluate(() => {
    const transaction = IDBDatabase.prototype.transaction;
    window.transitionProbe = { release: null, statuses: [] };
    new MutationObserver(() => window.transitionProbe.statuses.push(document.getElementById("ed-status").textContent))
      .observe(document.getElementById("ed-status"), { childList: true, subtree: true, characterData: true });
    IDBDatabase.prototype.transaction = function (...args) {
      const tx = Reflect.apply(transaction, this, args);
      if (this.name === "teicrafter.recovery" && args[1] === "readwrite") {
        IDBDatabase.prototype.transaction = transaction;
        // Retain the real committed write and delay only its completion delivery.
        Object.defineProperty(tx, "oncomplete", { configurable: true, set(callback) {
          tx.addEventListener("complete", (event) => {
            window.transitionProbe.release = () => { window.transitionProbe.release = null; callback.call(tx, event); };
          }, { once: true });
        } });
      }
      return tx;
    };
  });
}

async function waitForDelayedRecovery(page) {
  await expect.poll(() => page.evaluate(() => typeof window.transitionProbe.release)).toBe("function");
}

async function releaseRecovery(page) {
  await page.evaluate(() => window.transitionProbe.release());
  await expect.poll(() => page.evaluate(() => window.transitionProbe.statuses.join("\n")))
    .toMatch(/(?:changed.*(?:switch|document)|(?:switch|document).*changed)/i);
  await expect(page.locator("#ed-docstrip")).toContainText("codex.xml");
}

test("an applied correction during a recovery wait rejects the stale companion switch", async ({ page }) => {
  await open(page);
  await attach(page, "Attach Image annotations", "images.xml", images);
  await delayNextRecovery(page);
  await requestSwitch(page, "images.xml");
  await waitForDelayedRecovery(page);
  await page.getByRole("textbox", { name: /^Normalized reading/ }).fill("Kept correction");
  await page.locator(".ed-wb-form").getByRole("button", { name: "Apply", exact: true }).click();
  await releaseRecovery(page);
  const expected = codex.replace('norm="Gott"', 'norm="Kept correction"');
  const saved = await copy(page);
  expect(saved.raw).toBe(expected);
  expect(entry(saved, "codex.xml")).toMatchObject({ raw: expected, dirty: true, fileEncoding: { encoding: "UTF-8", bom: true } });
  expect(entry(saved, "images.xml").raw).toBe(images);
  await expect.poll(async () => (await latestRecovery(page, "codex.xml"))?.raw).toBe(expected);
  await activate(page, "images.xml");
  await activate(page, "codex.xml");
  expect((await copy(page)).raw).toBe(expected);
});

test("a new attachment during a recovery wait rejects the stale companion collection", async ({ page }) => {
  await open(page);
  await attach(page, "Attach Image annotations", "images.xml", images);
  await delayNextRecovery(page);
  await requestSwitch(page, "images.xml");
  await waitForDelayedRecovery(page);
  await resources(page);
  await page.getByLabel("Attach Registers", { exact: true }).setInputFiles(xmlFile("extra-registers.xml", registers, true));
  await expect(page.locator(".ed-wb-resource").filter({ hasText: "extra-registers.xml" })).toBeAttached();
  await resources(page);
  await expect(page.locator(".ed-wb-resource").filter({ hasText: "extra-registers.xml" })).toBeVisible();
  await releaseRecovery(page);
  await expect(page.locator("#ed-status")).toContainText("extra-registers.xml attached for reference lookup");
  const saved = await copy(page);
  expect(saved.raw).toBe(codex);
  expect(saved.projectDocuments.documents).toHaveLength(3);
  expect(entry(saved, "extra-registers.xml")).toMatchObject({ raw: registers, fileEncoding: { encoding: "UTF-8", bom: true } });
  await expect.poll(async () => (await latestRecovery(page, "codex.xml"))?.projectDocuments.documents.length).toBe(3);
});

test("a new attachment during PAGE recovery rejects the stale draft transition", async ({ page }) => {
  await open(page);
  await attach(page, "Attach Image annotations", "images.xml", images);
  await page.getByRole("combobox", { name: "Wenzelsbibel workspace" }).selectOption("import");
  const form = page.getByRole("form", { name: "Import PAGE XML", exact: true });
  await form.getByLabel("Draft title", { exact: true }).fill("Interrupted PAGE draft");
  await form.getByLabel("PAGE XML files", { exact: true }).setInputFiles(xmlFile("page.xml", pageXml));
  await expect(form.getByRole("status")).toContainText("page.xml");
  await delayNextRecovery(page);
  await form.getByRole("button", { name: "Create TEI draft", exact: true }).click();
  await waitForDelayedRecovery(page);
  await resources(page);
  await page.getByLabel("Attach Registers", { exact: true }).setInputFiles(xmlFile("extra-registers.xml", registers, true));
  await expect(page.locator(".ed-wb-resource").filter({ hasText: "extra-registers.xml" })).toBeAttached();
  await resources(page);
  await expect(page.locator(".ed-wb-resource").filter({ hasText: "extra-registers.xml" })).toBeVisible();
  await releaseRecovery(page);
  await expect(page.locator("#ed-status")).toContainText("extra-registers.xml attached for reference lookup");
  const saved = await copy(page);
  expect(saved.raw).toBe(codex);
  expect(saved.projectDocuments.documents).toHaveLength(3);
  expect(entry(saved, "Interrupted PAGE draft.xml")).toBeUndefined();
  expect(entry(saved, "images.xml").raw).toBe(images);
  expect(entry(saved, "extra-registers.xml")).toMatchObject({ raw: registers, fileEncoding: { encoding: "UTF-8", bom: true } });
  await expect.poll(async () => (await latestRecovery(page, "codex.xml"))?.projectDocuments.documents.length).toBe(3);
});

test("a delayed session schema read cannot overwrite the next companion's schema", async ({ page }) => {
  await open(page);
  await useSchema(page);
  await attach(page, "Attach Image annotations", "images.xml", images);
  await page.evaluate(() => {
    const read = File.prototype.text;
    window.schemaReadProbe = { release: null };
    File.prototype.text = function () {
      const pending = Reflect.apply(read, this, []);
      if (this.name !== "late-codex.sch") return pending;
      File.prototype.text = read;
      return pending.then((text) => new Promise((resolve) => {
        window.schemaReadProbe.release = async () => {
          window.schemaReadProbe.release = null;
          resolve(text);
          await new Promise((paint) => requestAnimationFrame(paint));
        };
      }));
    };
  });
  await page.locator("#ed-val-chip").click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Use session schema..." }).click();
  await (await chooser).setFiles(xmlFile("late-codex.sch", customSchema));
  await expect.poll(() => page.evaluate(() => typeof window.schemaReadProbe.release)).toBe("function");
  await activate(page, "images.xml");
  expect((await copy(page)).schemaSettings?.customSchema).toBeNull();
  await page.evaluate(() => window.schemaReadProbe.release());
  const saved = await copy(page);
  expect(saved.raw).toBe(images);
  expect(saved.schemaSettings?.customSchema).toBeNull();
  expect(entry(saved, "images.xml").schemaSettings?.customSchema).toBeNull();
  expectCustom(entry(saved, "codex.xml").schemaSettings);
  await page.locator("#ed-val-chip").click();
  await expect(page.locator("#ed-val-pop")).not.toContainText("late-codex.sch");
  await page.locator("#ed-val-chip").click();
  await activate(page, "codex.xml");
  expectCustom((await copy(page)).schemaSettings);
});
