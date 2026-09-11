import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const source = '<TEI xmlns="http://www.tei-c.org/ns/1.0"><teiHeader><fileDesc><titleStmt><title>Worker validation</title></titleStmt><publicationStmt><p>Unpublished</p></publicationStmt><sourceDesc><p>Synthetic</p></sourceDesc></fileDesc></teiHeader><text><body><p>Exact source.</p></body></text></TEI>';

async function load(page, raw, name) {
  await page.locator("#btn-load").click();
  const chooser = page.waitForEvent("filechooser");
  await page.locator("#menu-open").click();
  await (await chooser).setFiles({ name, mimeType: "application/xml", buffer: Buffer.from(raw) });
  await expect(page.locator("#ed-docstrip")).toContainText(name);
}

test("cold schema compilation keeps the editor responsive and cached validation rejects invalid XML", async ({ page }, testInfo) => {
  test.setTimeout(130_000);
  await page.addInitScript(() => Object.defineProperty(window, "showOpenFilePicker", { configurable: true, value: undefined }));
  await page.goto("/editor.html");
  await load(page, source, "worker-valid.xml");
  await page.evaluate(() => {
    window.__schemaHeartbeat = 0;
    window.__schemaHeartbeatTimer = setInterval(() => { window.__schemaHeartbeat++; }, 50);
  });
  const started = Date.now();
  const downloaded = page.waitForEvent("download", { timeout: 120_000 });
  await page.locator("#btn-download").click();
  await expect(page.locator("#ed-val-chip")).toHaveText("Preparing schema...", { timeout: 10_000 });
  const initial = await page.evaluate(() => window.__schemaHeartbeat);
  await expect.poll(() => page.evaluate(() => window.__schemaHeartbeat), { timeout: 2_000 }).toBeGreaterThan(initial);
  await expect(page.locator("#ed-val-chip")).toHaveText("Preparing schema...");
  const download = await downloaded;
  expect(readFileSync(await download.path(), "utf8")).toBe(source);
  testInfo.annotations.push({ type: "cold-schema-ms", description: String(Date.now() - started) });

  const invalid = source.replace("<body>", "<unknown>").replace("</body>", "</unknown>");
  await load(page, invalid, "worker-invalid.xml");
  await page.locator("#btn-download").click();
  await expect(page.locator("#ed-val-chip")).toHaveText("output blocked by schema", { timeout: 10_000 });
  await page.evaluate(() => clearInterval(window.__schemaHeartbeatTimer));
});
