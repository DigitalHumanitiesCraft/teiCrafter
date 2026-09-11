import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { COLD_SCHEMA_OUTPUT_TIMEOUT_MS, SCHEMA_WORKFLOW_TIMEOUT_MS } from "./helpers/schema-output-timing.js";

const source = '<TEI xmlns="http://www.tei-c.org/ns/1.0"><teiHeader><fileDesc><titleStmt><title>Worker validation</title></titleStmt><publicationStmt><p>Unpublished</p></publicationStmt><sourceDesc><p>Synthetic</p></sourceDesc></fileDesc></teiHeader><text><body><p>Exact source.</p></body></text></TEI>';

test("cancelling a single-document output stops validation without a download or page error", async ({ page }) => {
  const downloads = [], errors = [];
  page.on("download", (item) => downloads.push(item));
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => Object.defineProperty(window, "showOpenFilePicker", { configurable: true, value: undefined }));
  await page.goto("/editor.html");
  await load(page, source, "cancel-validation.xml");
  await page.locator("#btn-download").click();
  await expect(page.locator("#ed-val-chip")).toHaveText("Preparing schema...", { timeout: 10_000 });
  await page.locator("#ed-val-chip").click();
  const popover = await page.locator("#ed-val-pop").boundingBox();
  expect(popover.x).toBeGreaterThanOrEqual(8);
  expect(popover.x + popover.width).toBeLessThanOrEqual(page.viewportSize().width - 8);
  await page.getByRole("button", { name: "Cancel validation", exact: true }).click();
  await expect(page.locator("#ed-status")).toContainText("cancelled");
  if (!await page.locator("#ed-val-pop").isVisible()) await page.locator("#ed-val-chip").click();
  await expect(page.getByRole("button", { name: "Validate schema set", exact: true })).toBeEnabled();
  expect(downloads).toHaveLength(0);
  expect(errors).toEqual([]);
});

async function load(page, raw, name) {
  await page.locator("#btn-load").click();
  const chooser = page.waitForEvent("filechooser");
  await page.locator("#menu-open").click();
  await (await chooser).setFiles({ name, mimeType: "application/xml", buffer: Buffer.from(raw) });
  await expect(page.locator("#ed-docstrip")).toContainText(name);
}

test("manual validation can restart after cancellation and authorize the unchanged XML", async ({ page }) => {
  test.setTimeout(SCHEMA_WORKFLOW_TIMEOUT_MS);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => Object.defineProperty(window, "showOpenFilePicker", { configurable: true, value: undefined }));
  await page.goto("/editor.html");
  await load(page, source, "retry-validation.xml");
  await page.locator("#ed-val-chip").click();
  await page.getByRole("button", { name: "Validate schema set", exact: true }).click();
  await expect(page.locator("#ed-val-chip")).toHaveText("Preparing schema...", { timeout: 10_000 });
  await page.getByRole("button", { name: "Cancel validation", exact: true }).click();
  await expect(page.locator("#ed-val-pop")).toContainText("cancelled");
  await page.getByRole("button", { name: "Validate schema set", exact: true }).click();
  await expect(page.locator("#ed-val-chip")).toHaveText("schema and structural checks passed", { timeout: COLD_SCHEMA_OUTPUT_TIMEOUT_MS });
  await page.locator("#ed-val-chip").click();
  const requested = page.waitForEvent("download");
  await page.locator("#btn-download").click();
  expect(readFileSync(await (await requested).path(), "utf8")).toBe(source);
  expect(errors).toEqual([]);
});

test("cold schema compilation keeps the editor responsive and cached validation rejects invalid XML", async ({ page }, testInfo) => {
  test.setTimeout(SCHEMA_WORKFLOW_TIMEOUT_MS);
  const metric = (values) => console.log(JSON.stringify({ metric: "schema-worker", browser: testInfo.project.name, ...values }));
  await page.exposeFunction("reportSchemaPhase", (values) => metric({ event: "phase", ...values }));
  await page.addInitScript(() => Object.defineProperty(window, "showOpenFilePicker", { configurable: true, value: undefined }));
  await page.goto("/editor.html");
  await load(page, source, "worker-valid.xml");
  await page.evaluate(() => {
    window.__schemaHeartbeat = 0;
    window.__schemaHeartbeatTimer = setInterval(() => { window.__schemaHeartbeat++; }, 50);
    window.__schemaScenario = "cold";
    window.__schemaPhaseStart = performance.now();
    window.__schemaLastPhase = null;
    const chip = document.getElementById("ed-val-chip");
    window.__schemaPhaseObserver = new MutationObserver(() => {
      if (!window.__schemaScenario) return;
      const phase = chip.textContent;
      if (phase === window.__schemaLastPhase) return;
      window.__schemaLastPhase = phase;
      void window.reportSchemaPhase({ scenario: window.__schemaScenario, phase,
        elapsedMs: Math.round(performance.now() - window.__schemaPhaseStart) });
    });
    window.__schemaPhaseObserver.observe(chip, { childList: true, subtree: true, characterData: true });
  });
  const started = Date.now();
  const downloaded = page.waitForEvent("download", { timeout: COLD_SCHEMA_OUTPUT_TIMEOUT_MS });
  await page.locator("#btn-download").click();
  await expect(page.locator("#ed-val-chip")).toHaveText("Preparing schema...", { timeout: 10_000 });
  const initial = await page.evaluate(() => window.__schemaHeartbeat);
  await expect.poll(() => page.evaluate(() => window.__schemaHeartbeat), { timeout: 2_000 }).toBeGreaterThan(initial);
  await expect(page.locator("#ed-val-chip")).toHaveText("Preparing schema...");
  const download = await downloaded;
  expect(readFileSync(await download.path(), "utf8")).toBe(source);
  const coldMs = Date.now() - started;
  testInfo.annotations.push({ type: "cold-schema-ms", description: String(coldMs) });
  metric({ event: "complete", scenario: "cold", result: "valid", elapsedMs: coldMs });
  await page.evaluate(() => { window.__schemaScenario = null; });

  const invalid = source.replace("<body>", "<unknown>").replace("</body>", "</unknown>");
  await load(page, invalid, "worker-invalid.xml");
  await page.evaluate(() => {
    window.__schemaScenario = "cached-invalid";
    window.__schemaPhaseStart = performance.now();
    window.__schemaLastPhase = null;
  });
  const cachedStarted = Date.now();
  await page.locator("#btn-download").click();
  await expect(page.locator("#ed-val-chip")).toHaveText("output blocked by schema", { timeout: 10_000 });
  metric({ event: "complete", scenario: "cached-invalid", result: "invalid", elapsedMs: Date.now() - cachedStarted });
  await page.evaluate(() => {
    clearInterval(window.__schemaHeartbeatTimer);
    window.__schemaPhaseObserver.disconnect();
  });
});
