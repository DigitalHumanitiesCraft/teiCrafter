// Regenerates the start-page screenshot: the first letter page of the public
// example (o_szd.1079, page 3 after the two envelope sides) in the editor with
// its facsimile, at the size the start page reserves for it.
// Run with `node test/tools/make_landing_screenshot.mjs`; the facsimile comes
// from the GAMS image service, so the run needs network access.
import { copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { createServer } from "vite";

const root = fileURLToPath(new URL("../../", import.meta.url));
const target = `${root}docs/assets/editor-screenshot.png`;
const mirror = `${root}public/assets/editor-screenshot.png`;
const viewport = { width: 1280, height: 800 };

const server = await createServer({
  configFile: `${root}vite.config.js`,
  server: { host: "127.0.0.1", port: 4181, strictPort: false },
  logLevel: "error",
});
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1, colorScheme: "light" });
  const facsimile = page.waitForResponse((r) => /gams/i.test(r.url()) && /^image\//.test(r.headers()["content-type"] ?? ""), { timeout: 60_000 });
  await page.goto(`${base}editor.html#example=szd`);
  await page.locator("#ed-docstrip").filter({ hasText: "o_szd.1079" }).waitFor();
  await facsimile;
  for (const label of ["page 2/5", "page 3/5"]) {
    const pageImage = page.waitForResponse((r) => /gams/i.test(r.url()) && /^image\//.test(r.headers()["content-type"] ?? ""), { timeout: 60_000 });
    await page.locator("#btn-next").click();
    await page.locator("#ed-folio-label").filter({ hasText: label }).waitFor();
    await pageImage;
  }
  await page.waitForLoadState("networkidle");
  // OpenSeadragon fades tiles in after they arrive; no event reports the end of that animation.
  await page.waitForTimeout(1500);
  await page.mouse.move(0, viewport.height - 1);
  await page.screenshot({ path: target });
  copyFileSync(target, mirror);
  console.log(`Wrote ${target} and ${mirror}`);
} finally {
  await browser.close();
  await server.close();
}
