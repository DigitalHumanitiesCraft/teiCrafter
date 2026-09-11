import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { decodeProjectBundle } from "../../docs/js/editor/project-bundle.js";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const header = `<teiHeader><fileDesc><titleStmt><title>Synthetic Wenzelsbibel</title></titleStmt><editionStmt><edition>Test</edition><respStmt><resp>Artists</resp><persName xml:id="artist-a">Artist A</persName></respStmt></editionStmt><publicationStmt><publisher>Test</publisher><idno type="PID">o:wen.synthetic</idno></publicationStmt><sourceDesc><p>Original synthetic source.</p></sourceDesc></fileDesc></teiHeader>`;
const codex = `<TEI xmlns="http://www.tei-c.org/ns/1.0">${header}<facsimile><surface xml:id="surface-1"><zone xml:id="zone-1" type="ImageRegion" ulx="0" uly="0" lrx="10" lry="10"/></surface></facsimile><text><body><div><pb n="1r"/><l><w xml:id="word-1" orig="got" norm="Gott">got</w> <w xml:id="word-2" orig="vnd" norm="und">vnd</w> <w xml:id="word-3" orig="werlt" norm="Welt">werlt</w></l></div></body></text></TEI>`;
const images = `<TEI xmlns="http://www.tei-c.org/ns/1.0">${header}<text><body><list type="image-annotations" subtype="miniatures"><item xml:id="image-1" corresp="#zone-1"><title>Initial A</title><note type="description" subtype="short">Short description</note><note type="description">Full description</note><dimensions><height unit="line">12</height></dimensions><ref type="folio" target="1ra"/><listPerson type="artists"><person corresp="#artist-a"/></listPerson><note type="text-relation" subtype="statistic" corresp="#range(word-1, word-2)">Related text</note></item></list></body></text></TEI>`;
const realCodex = process.env.WB_CODEX || "";
const realImages = process.env.WB_IMAGES || "";

async function open(page, name, xmlOrPath) {
  await page.addInitScript(() => {
    Object.defineProperty(window, "showOpenFilePicker", { value: undefined, configurable: true });
  });
  await page.goto("/editor.html");
  await page.locator("#btn-load").click();
  const chooser = page.waitForEvent("filechooser");
  await page.locator("#menu-open").click();
  await (await chooser).setFiles(xmlOrPath.startsWith("<")
    ? { name, mimeType: "application/xml", buffer: Buffer.from(xmlOrPath) }
    : xmlOrPath);
  await expect(page.locator("#ed-docstrip")).toContainText(name, { timeout: 90_000 });
  await expect(page.getByRole("combobox", { name: "Wenzelsbibel workspace" })).toBeVisible({ timeout: 90_000 });
}

async function workspace(page, section) {
  await page.getByRole("combobox", { name: "Wenzelsbibel workspace" }).selectOption(section);
}

async function workingCopy(page) {
  const requested = page.waitForEvent("download", { timeout: 90_000 });
  await page.locator("#btn-working-copy").click();
  return JSON.parse(readFileSync(await (await requested).path(), "utf8")).record;
}

async function accessibleWorkspace(page, testInfo, name) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations.filter((item) => ["serious", "critical"].includes(item.impact))).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });
}

async function download(page, timeout = 90_000) {
  const requested = page.waitForEvent("download", { timeout });
  await page.locator("#btn-download").click();
  const output = await Promise.race([
    requested,
    page.locator("#ed-status").filter({ hasText: /blocked|failed/ }).waitFor({ state: "visible", timeout })
      .then(async () => { throw new Error(await page.locator("#ed-status").innerText()); }),
  ]);
  return readFileSync(await output.path(), "utf8");
}

test("Wenzelsbibel transcription preserves staged input, exact edits and Undo", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await open(page, "synthetic-codex.xml", codex);
  const normalized = page.getByRole("textbox", { name: /^Normalized reading/ });
  await expect(normalized).toHaveValue("Gott");
  await accessibleWorkspace(page, testInfo, "wenzels-transcription");
  await normalized.fill("GOTT");
  await workspace(page, "commentary");
  await expect(page.getByRole("combobox", { name: "Wenzelsbibel workspace" })).toHaveValue("diplomatic");
  const pending = await workingCopy(page);
  expect(pending.raw).toBe(codex);
  expect(pending.staged.mode).toBe("wenzels");
  expect(pending.staged.value.fields.norm).toBe("GOTT");
  await page.reload();
  await expect(page.getByRole("button", { name: /Restore/ }).first()).toBeVisible();
  await page.getByRole("button", { name: /Restore/ }).first().click();
  await expect(normalized).toHaveValue("GOTT");
  await page.locator(".ed-wb-form").getByRole("button", { name: "Apply", exact: true }).click();
  expect(await download(page)).toBe(codex.replace('norm="Gott"', 'norm="GOTT"'));
  await page.locator("#btn-undo").click();
  expect((await workingCopy(page)).raw).toBe(codex);
  await page.locator("#btn-read-only").click();
  await expect(normalized).toBeDisabled();
});

test("Wenzelsbibel commentary and Bible verses create independent TEI annotations", async ({ page }) => {
  test.setTimeout(120_000);
  await open(page, "synthetic-codex.xml", codex);
  await workspace(page, "commentary");
  await page.getByRole("textbox", { name: "First word ID", exact: true }).fill("word-1");
  await page.getByRole("textbox", { name: "Last word ID", exact: true }).fill("word-2");
  await page.getByRole("textbox", { name: "Comment text", exact: true }).fill("A supplied editorial comment.");
  await page.locator(".ed-wb-form").getByRole("button", { name: "Apply", exact: true }).click();
  const commented = (await workingCopy(page)).raw;
  expect(commented).toContain('type="comment_edition"');
  expect(commented).toContain("A supplied editorial comment.");
  expect(commented).toContain("<anchor");
  await workspace(page, "bible-verse");
  await page.getByRole("textbox", { name: /^Book, chapter and verse/ }).fill("Gen 1:1");
  await page.getByRole("textbox", { name: "First word ID", exact: true }).fill("word-1");
  await page.getByRole("textbox", { name: "Last word ID", exact: true }).fill("word-3");
  await page.getByRole("textbox", { name: /^Latin text/ }).fill("In principio");
  await page.locator(".ed-wb-form").getByRole("button", { name: "Apply", exact: true }).click();
  const output = await download(page);
  expect(output).toContain("Gen 1:1");
  expect(output).toContain("In principio");
  expect(output).toContain("A supplied editorial comment.");
});

test("Wenzelsbibel image edits preserve the source and resolve an attached codex", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  const imageUrl = "https://wenzels.test/synthetic-folio.png";
  const illustratedCodex = codex.replace('<surface xml:id="surface-1">', `<surface xml:id="surface-1"><graphic url="${imageUrl}" width="10px" height="10px"/>`);
  const codexBytes = Buffer.from(`\uFEFF${illustratedCodex}`);
  let imageRequests = 0;
  await page.route(imageUrl, async (route) => {
    imageRequests += 1;
    await route.fulfill({ contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=", "base64") });
  });
  await open(page, "synthetic-images.xml", images);
  await page.getByRole("combobox", { name: "Image annotation", exact: true }).selectOption("image-1");
  await accessibleWorkspace(page, testInfo, "wenzels-image-annotation");
  await page.getByRole("textbox", { name: "Image title", exact: true }).fill("Changed initial");
  await page.locator(".ed-wb-form").getByRole("button", { name: "Apply", exact: true }).click();
  expect(await download(page)).toBe(images.replace("Initial A", "Changed initial"));
  await page.getByText("Linked project documents", { exact: true }).click();
  await page.getByLabel("Attach Codex", { exact: true }).setInputFiles({ name: "synthetic-codex.xml", mimeType: "application/xml", buffer: codexBytes });
  await expect(page.locator("#ed-status")).toContainText("attached for reference lookup");
  await page.getByText("Show miniature facsimile", { exact: true }).click();
  const facsimile = page.getByRole("region", { name: "Miniature facsimile", exact: true });
  await expect(facsimile.locator("canvas").first()).toBeVisible();
  await expect(facsimile.locator('.ed-osd-zone[data-zoneid="zone-1"]')).toHaveCount(1);
  await expect.poll(() => imageRequests).toBeGreaterThan(0);
  await workspace(page, "checks");
  await expect(page.locator(".ed-wb-workspace")).toContainText("0 pointer issues");
  await page.getByText("Linked project documents", { exact: true }).click();
  let replacementPrompt = "";
  page.once("dialog", async (dialog) => {
    replacementPrompt = dialog.message();
    await dialog.accept();
  });
  await page.locator(".ed-wb-resource").filter({ hasText: "synthetic-codex.xml" }).getByRole("button", { name: "Open for editing", exact: true }).click();
  await expect(page.locator("#ed-docstrip")).toContainText("synthetic-codex.xml");
  expect(replacementPrompt).toBe("");
  const linkedCopy = await workingCopy(page);
  expect(linkedCopy.projectDocuments.documents.find((entry) => entry.name === "synthetic-images.xml")).toMatchObject({
    raw: images.replace("Initial A", "Changed initial"), dirty: true,
  });
  expect(Buffer.from(await download(page))).toEqual(codexBytes);
  await workspace(page, "diplomatic");
  await expect(page.getByRole("heading", { name: "Images referring to this word", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Changed initial", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Image annotation", exact: true })).toHaveValue("image-1");
  expect((await workingCopy(page)).raw).toBe(images.replace("Initial A", "Changed initial"));
});

test("Wenzelsbibel shared registers retain persons, places and peoples", async ({ page }) => {
  test.setTimeout(120_000);
  await open(page, "synthetic-codex.xml", codex);
  await page.getByText("Linked project documents", { exact: true }).click();
  await page.getByRole("button", { name: "New shared registers", exact: true }).click();
  await page.getByText("Linked project documents", { exact: true }).click();
  await expect(page.locator(".ed-wb-resource").filter({ hasText: "synthetic-codex.xml" })).toBeVisible();
  for (const [kind, id, name] of [["person", "person-1", "A person"], ["place", "place-1", "A place"], ["people", "people-1", "A people"]]) {
    await page.getByRole("combobox", { name: "Register entry", exact: true }).selectOption("");
    await page.getByRole("combobox", { name: "Register", exact: true }).selectOption(kind);
    await page.getByRole("textbox", { name: "XML ID", exact: true }).fill(id);
    await page.getByRole("textbox", { name: "Name", exact: true }).fill(name);
    await page.locator(".ed-wb-form").getByRole("button", { name: "Apply", exact: true }).click();
  }
  const output = await download(page);
  expect(output).toContain('xml:id="person-1"');
  expect(output).toContain('xml:id="place-1"');
  expect(output).toContain('type="people"');
  expect(output).toContain("A people");
});

test("Wenzelsbibel incomplete image records accept an isolated draft improvement", async ({ page }) => {
  test.setTimeout(120_000);
  const incomplete = images.replace("<title>Initial A</title>", "<title/>")
    .replace("#range(word-1, word-2)", "#range(,)");
  await open(page, "synthetic-incomplete-images.xml", incomplete);
  await page.getByRole("combobox", { name: "Image annotation", exact: true }).selectOption("image-1");
  await page.getByRole("textbox", { name: "Short description", exact: true }).fill("A draft description.");
  await page.locator(".ed-wb-form").getByRole("button", { name: "Apply", exact: true }).click();
  expect(await download(page)).toBe(incomplete.replace("Short description", "A draft description."));
});

test("real Wenzelsbibel image annotations retain all bytes outside a title edit", async ({ page }) => {
  test.skip(!realImages || !existsSync(realImages), "Set WB_IMAGES to the local Bildannotationen.xml source.");
  test.setTimeout(180_000);
  await open(page, "Bildannotationen.xml", realImages);
  await page.getByRole("combobox", { name: "Image annotation", exact: true }).selectOption("miniatures_01");
  const title = page.getByRole("textbox", { name: "Image title", exact: true });
  const previous = await title.inputValue();
  await title.fill("Synthetic browser verification title");
  await page.locator(".ed-wb-form").getByRole("button", { name: "Apply", exact: true }).click();
  expect(await download(page)).toBe(readFileSync(realImages, "utf8").replace(previous, "Synthetic browser verification title"));
  await page.locator("#btn-undo").click();
  expect((await workingCopy(page)).raw).toBe(readFileSync(realImages, "utf8"));
});

test("real Wenzelsbibel codex preserves readings and validates an explicitly repaired copy", async ({ page }, testInfo) => {
  test.skip(!realCodex || !existsSync(realCodex), "Set WB_CODEX to the local codex-2759.xml source.");
  test.setTimeout(420_000);
  const original = readFileSync(realCodex, "utf8");
  const started = performance.now();
  await open(page, "codex-2759.xml", realCodex);
  console.log(`${testInfo.project.name}: real codex loaded in ${Math.round(performance.now() - started)} ms`);
  await expect(page.locator("#ed-folio-label")).toContainText("480");
  const normalized = page.getByRole("textbox", { name: /^Normalized reading/ });
  const previous = await normalized.inputValue();
  await normalized.fill("BROWSER_VERIFIED");
  await page.locator(".ed-wb-form").getByRole("button", { name: "Apply", exact: true }).click();
  const record = await workingCopy(page);
  expect(record.raw).toContain('norm="BROWSER_VERIFIED"');
  expect(record.raw.replace('norm="BROWSER_VERIFIED"', `norm="${previous}"`)).toBe(original);
  testInfo.annotations.push({ type: "real-codex-edit-and-recovery-ms", description: String(Math.round(performance.now() - started)) });
  await page.locator("#btn-undo").click();
  await expect(normalized).toHaveValue(previous, { timeout: 90_000 });
  await workspace(page, "checks");
  const loneChoices = [...original.matchAll(/<choice>(\s*<sic>(?:(?!<\/sic>)[\s\S])*<\/sic>\s*)<\/choice>/g)];
  expect(loneChoices).toHaveLength(1);
  await page.getByRole("button", { name: "Keep sole reading", exact: true }).click();
  await expect(page.getByRole("button", { name: "Keep sole reading", exact: true })).toHaveCount(0, { timeout: 90_000 });
  await page.evaluate(() => {
    window.__realCodexSchemaPhases = [];
    const started = performance.now();
    const chip = document.getElementById("ed-val-chip");
    const observer = new MutationObserver(() => {
      window.__realCodexSchemaPhases.push({ phase: chip.textContent, ms: Math.round(performance.now() - started) });
    });
    observer.observe(chip, { childList: true, subtree: true, characterData: true });
  });
  const validationStarted = performance.now();
  expect(await download(page, 360_000)).toBe(original.replace(loneChoices[0][0], loneChoices[0][1]));
  console.log(`${testInfo.project.name}: real codex validated and downloaded in ${Math.round(performance.now() - validationStarted)} ms`);
  console.log(`${testInfo.project.name}: real codex schema phases ${JSON.stringify(await page.evaluate(() => window.__realCodexSchemaPhases))}`);
  if (realImages && existsSync(realImages)) {
    const details = page.locator("details.ed-wb-resources");
    if (!await details.evaluate((node) => node.open)) await details.locator("summary").click();
    await page.getByLabel("Attach Image annotations", { exact: true }).setInputFiles(realImages);
    await expect(page.locator("#ed-status")).toContainText("attached for reference lookup", { timeout: 90_000 });
    const packageStarted = performance.now();
    const packageDownload = page.waitForEvent("download", { timeout: 90_000 });
    await page.locator("#btn-project-package").click();
    const packed = decodeProjectBundle(readFileSync(await (await packageDownload).path()));
    const digest = (text) => createHash("sha256").update(text).digest("hex");
    expect(packed.documents).toHaveLength(2);
    expect(digest(packed.documents.find((entry) => entry.role === "codex").raw)).toBe(digest(original.replace(loneChoices[0][0], loneChoices[0][1])));
    expect(digest(packed.documents.find((entry) => entry.role === "images").raw)).toBe(digest(readFileSync(realImages, "utf8")));
    const packageMs = Math.round(performance.now() - packageStarted);
    console.log(`${testInfo.project.name}: real codex and image project package after identical validation in ${packageMs} ms`);
    testInfo.annotations.push({ type: "real-project-package-ms", description: String(packageMs) });
  }
  expect(readFileSync(realCodex, "utf8")).toBe(original);
  testInfo.annotations.push({ type: "real-codex-workflow-ms", description: String(Math.round(performance.now() - started)) });
});
