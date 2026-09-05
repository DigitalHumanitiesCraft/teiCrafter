import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { writeFileSync } from "node:fs";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
await page.goto("http://127.0.0.1:4199/editor.html");
await page.locator("#btn-load").click();
await page.locator("#menu-new-from-text").click();
await page.getByLabel("Document starter", { exact: true }).selectOption("letter");
await page.locator("#onramp-modal textarea").fill("Dear colleague,\nThis is an original fictional letter for testing the editor.\n\nYours,\nA fictional writer");
await page.screenshot({ path: "reports/editor-starter-desktop-2026-09-05.png" });
const observations = [];
for (const width of [1440, 768, 390]) {
  await page.setViewportSize({ width, height: 1000 });
  const result = await new AxeBuilder({ page }).include("#onramp-modal").analyze();
  observations.push({ view: "starter", width, violations: result.violations.filter((item) => ["serious", "critical"].includes(item.impact)).map(({ id, impact, nodes }) => ({ id, impact, targets: nodes.map((node) => node.target) })) });
}
await page.screenshot({ path: "reports/editor-starter-narrow-2026-09-05.png" });
await page.setViewportSize({ width: 1440, height: 1000 });
await page.getByRole("button", { name: "Craft TEI", exact: true }).click();
await page.locator("#onramp-modal").waitFor({ state: "hidden" });
await page.locator("#btn-read-only").click();
await page.screenshot({ path: "reports/editor-reading-desktop-2026-09-05.png" });
const reading = await new AxeBuilder({ page }).analyze();
observations.push({ view: "reading", width: 1440, violations: reading.violations.filter((item) => ["serious", "critical"].includes(item.impact)).map(({ id, impact, nodes }) => ({ id, impact, targets: nodes.map((node) => node.target) })) });
writeFileSync("reports/editor-ui-inspection-2026-09-05.json", JSON.stringify(observations, null, 2) + "\n");
await browser.close();
console.log(JSON.stringify(observations));
