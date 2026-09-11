import { existsSync, readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const primaryPath = "/data/editor/wb-codex/codex-2759.xml";
const fallbackPath = "/data/editor/wenzelsbibel-synthetic-codex.xml";
const fallbackSource = readFileSync(new URL("../../docs/data/editor/wenzelsbibel-synthetic-codex.xml", import.meta.url), "utf8");
const priorSource = readFileSync(new URL("./fixtures/browser-smoke.xml", import.meta.url), "utf8");
const htmlResponse = '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Missing example</title></head><body><p>PUBLIC_ROUTE_FALLBACK</p></body></html>';

function watchErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function workingCopy(page) {
  const requested = page.waitForEvent("download");
  await page.locator("#btn-working-copy").click();
  return JSON.parse(readFileSync(await (await requested).path(), "utf8")).record;
}

async function expectSyntheticWorkspace(page, errors) {
  await expect(page.locator("#ed-status")).toContainText("Loaded the synthetic Wenzelsbibel twin");
  await expect(page.locator("#ed-status")).not.toContainText("Loaded the real Wenzelsbibel codex");
  await expect(page.locator("#ed-docstrip")).toContainText("wenzelsbibel-synthetic-codex.xml");
  await expect(page.locator("#ed-folio-label")).toContainText("page 1/20");
  await expect(page.getByRole("combobox", { name: "Wenzelsbibel workspace", exact: true })).toHaveValue("diplomatic");
  expect((await workingCopy(page)).raw).toBe(fallbackSource);
  expect(errors).toEqual([]);
}

async function openPriorSource(page) {
  await page.addInitScript(() => {
    Object.defineProperty(window, "showOpenFilePicker", { value: undefined, configurable: true });
  });
  await page.goto("/editor.html");
  await page.locator("#btn-load").click();
  const chooser = page.waitForEvent("filechooser");
  await page.locator("#menu-open").click();
  await (await chooser).setFiles({ name: "prior-source.xml", mimeType: "application/xml", buffer: Buffer.from(priorSource) });
  await expect(page.locator("#ed-docstrip")).toContainText("prior-source.xml");
}

async function expectRejectedExample(page, errors) {
  await page.locator("#btn-load").click();
  await page.locator('[data-example="wb"]').click();
  await expect(page.locator("#ed-status")).toContainText("Could not load");
  await expect(page.locator("#ed-docstrip")).toContainText("prior-source.xml");
  await expect(page.getByRole("combobox", { name: "Wenzelsbibel workspace", exact: true })).toHaveCount(0);
  expect((await workingCopy(page)).raw).toBe(priorSource);
  expect(errors).toEqual([]);
}

test("the absent public codex returns 404 and opens the synthetic Wenzelsbibel workspace", async ({ page }) => {
  expect(existsSync(new URL(`../../dist${primaryPath}`, import.meta.url))).toBe(false);
  const errors = watchErrors(page);
  const primaryResponse = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith(primaryPath));
  await page.goto("/editor.html#example=wb");
  expect((await primaryResponse).status()).toBe(404);
  await expectSyntheticWorkspace(page, errors);
});

test("an HTML soft 404 with status 200 opens the synthetic Wenzelsbibel workspace", async ({ page }) => {
  const errors = watchErrors(page);
  await page.route(`**${primaryPath}`, (route) => route.fulfill({ status: 200, contentType: "text/html", body: htmlResponse }));
  await page.goto("/editor.html#example=wb");
  await expectSyntheticWorkspace(page, errors);
});

test("HTML labelled as XML cannot replace an already opened TEI document", async ({ page }) => {
  const errors = watchErrors(page);
  await openPriorSource(page);
  await page.route(`**${primaryPath}`, (route) => route.fulfill({ status: 200, contentType: "application/xml", body: htmlResponse }));
  await expectRejectedExample(page, errors);
});

test("a malformed multi-root TEI fallback keeps the previously opened source", async ({ page }) => {
  const errors = watchErrors(page);
  await openPriorSource(page);
  await page.route(`**${primaryPath}`, (route) => route.fulfill({ status: 404, body: "" }));
  await page.route(`**${fallbackPath}`, (route) => route.fulfill({ status: 200, contentType: "application/xml", body: '<TEI xmlns="http://www.tei-c.org/ns/1.0"/><TEI xmlns="http://www.tei-c.org/ns/1.0"/>' }));
  await expectRejectedExample(page, errors);
});

test("the public Wenzelsbibel workspace preserves unfinished XML through recovery", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/editor.html#example=wb");
  await expectSyntheticWorkspace(page, errors);
  await page.locator("#view-xml").click();
  const source = page.locator(".ed-src-ta");
  const originalPage = await source.inputValue();
  const pendingPage = originalPage.replace("<pb ", '<pb rend="example-proof" ');
  expect(pendingPage).not.toBe(originalPage);
  await source.fill(pendingPage);
  await page.locator("#view-metadata").click();
  await expect(page.locator("#view-xml")).toHaveAttribute("aria-selected", "true");
  await expect(source).toHaveValue(pendingPage);
  const pending = await workingCopy(page);
  expect(pending.raw).toBe(fallbackSource);
  expect(pending.staged).toMatchObject({ mode: "page", value: pendingPage });
  page.once("dialog", (dialog) => dialog.accept());
  await page.goto("/editor.html");
  const recovery = page.locator(".ed-recent-row").filter({ hasText: "wenzelsbibel-synthetic-codex.xml" });
  await recovery.getByRole("button", { name: "Restore", exact: true }).click();
  await expect(source).toHaveValue(pendingPage);
  await expect(page.locator("#view-xml")).toHaveAttribute("aria-selected", "true");
  const restored = await workingCopy(page);
  expect(restored.raw).toBe(fallbackSource);
  expect(restored.staged).toMatchObject({ mode: "page", value: pendingPage });
  expect(errors).toEqual([]);
});
