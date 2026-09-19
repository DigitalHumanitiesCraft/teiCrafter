import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const corpus = process.env.SZD_REFACTOR_TEI;
const fixtures = corpus ? readdirSync(corpus).filter((name) => /^o_szd\.\d+\.xml$/.test(name)) : [];

async function openFile(page, name, buffer) {
  await page.locator("#btn-load").click();
  const pending = page.waitForEvent("filechooser");
  await page.locator("#menu-open").click();
  await (await pending).setFiles({ name, mimeType: "application/xml", buffer });
  await expect(page.locator("#ed-docstrip")).toContainText(name);
}

for (const name of fixtures) {
  test(`SZD research draft preserves complete ${name} through editor download and reopen`, async ({ page }) => {
    test.setTimeout(180_000);
    const bytes = readFileSync(join(corpus, name));
    let loadedImages = 0;
    await page.route("https://gams.uni-graz.at/**", async (route) => {
      const match = route.request().url().match(/o:szd\.(\d+)\/IMG\.(\d+)/);
      if (!match) return route.abort();
      const body = readFileSync(join(corpus, "../../../data/szd-sample-10/objects", `o_szd.${match[1]}`, "images", `IMG_${match[2]}.jpg`));
      await route.fulfill({ status: 200, contentType: "image/jpeg", body });
      loadedImages += 1;
    });
    await page.addInitScript(() => Object.defineProperty(window, "showOpenFilePicker", { value: undefined, configurable: true }));
    await page.goto("/editor.html");
    await openFile(page, name, bytes);
    await expect(page.locator("#ed-reading")).toBeVisible();
    await expect.poll(() => loadedImages).toBeGreaterThan(0);
    await page.locator("#view-xml").click();
    const input = page.locator(".ed-src-ta");
    const visible = await input.inputValue();
    expect(visible).toContain("source-text-0");
    await input.fill(visible.replace('n="', 'n="test-'));
    await input.press("Control+Enter");
    await expect(page.locator("#btn-undo")).toBeEnabled();
    const changedPending = page.waitForEvent("download", { timeout: 120_000 });
    await page.locator("#btn-download").click();
    const changedDownload = await changedPending;
    const changedOutput = readFileSync(await changedDownload.path());
    expect(changedOutput.toString("utf8")).toBe(bytes.toString("utf8").replace('n="', 'n="test-'));
    writeFileSync(test.info().outputPath(`${name}.edited.xml`), changedOutput);
    await page.locator("#btn-undo").click();
    await expect(page.locator("#btn-redo")).toBeEnabled();
    const pending = page.waitForEvent("download", { timeout: 120_000 });
    await page.locator("#btn-download").click();
    const download = await pending;
    const output = readFileSync(await download.path());
    expect(output.equals(bytes)).toBe(true);
    writeFileSync(test.info().outputPath(`${name}.editor.xml`), output);
    await openFile(page, `reopened-${name}`, output);
    await page.locator("#view-xml").click();
    expect(await page.locator(".ed-src-ta").inputValue()).toContain("source-text-0");
    await openFile(page, `edited-${name}`, changedOutput);
    await page.locator("#view-xml").click();
    expect(await page.locator(".ed-src-ta").inputValue()).toContain('n="test-1"');
    const reopenedPending = page.waitForEvent("download", { timeout: 120_000 });
    await page.locator("#btn-download").click();
    expect(readFileSync(await (await reopenedPending).path()).equals(changedOutput)).toBe(true);
  });
}

test("SZD research fixture inventory is explicitly supplied", async () => {
  test.skip(!corpus, "Set SZD_REFACTOR_TEI to the complete local research export directory.");
  expect(fixtures).toHaveLength(10);
});
