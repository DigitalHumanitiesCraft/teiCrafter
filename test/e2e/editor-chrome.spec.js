import { expect, test } from "@playwright/test";
import { COLD_SCHEMA_OUTPUT_TIMEOUT_MS, SCHEMA_WORKFLOW_TIMEOUT_MS } from "./helpers/schema-output-timing.js";

// The SZD example is committed; its facsimile comes from GAMS, which the tests keep offline.
async function openSzdExample(page) {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.goto("/editor.html#example=szd");
  await expect(page.locator("#ed-docstrip")).toContainText("o_szd.1079.tei.xml");
}

async function applyXmlEdit(page, text) {
  await page.locator("#view-xml").click();
  const source = page.locator(".ed-src-ta");
  await source.evaluate((el, inserted) => {
    el.focus();
    el.setRangeText(inserted, 10, 10, "end");
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, text);
  await source.press("Control+Enter");
  await expect(page.locator("#view-reading")).toHaveAttribute("aria-selected", "true");
}

test("unsaved mark stays visible as a word beside a shortened file name", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openSzdExample(page);
  await applyXmlEdit(page, " ");
  const mark = page.locator("#ed-docstrip .ed-docstrip-state", { hasText: "unsaved" });
  await expect(mark).toBeVisible();
  const geometry = await page.evaluate(() => {
    const strip = document.getElementById("ed-docstrip").getBoundingClientRect();
    const name = document.querySelector(".ed-docstrip-name");
    const state = document.querySelector(".ed-docstrip-state").getBoundingClientRect();
    return { nameShortened: name.scrollWidth > name.clientWidth, inside: state.left >= strip.left && state.right <= strip.right + 0.5 };
  });
  expect(geometry).toEqual({ nameShortened: true, inside: true });
});

test("Ctrl+S saves through the Save action", async ({ page }) => {
  test.setTimeout(SCHEMA_WORKFLOW_TIMEOUT_MS);
  await openSzdExample(page);
  await expect(page.locator("#btn-save")).toHaveAttribute("aria-keyshortcuts", "Control+S Meta+S");
  await applyXmlEdit(page, " ");
  const download = page.waitForEvent("download", { timeout: COLD_SCHEMA_OUTPUT_TIMEOUT_MS });
  await page.locator("#ed-reading").focus();
  await page.keyboard.press("Control+s");
  expect((await download).suggestedFilename()).toBe("o_szd.1079.tei.xml");
  await expect(page.locator("#ed-status")).toContainText("Download requested");
});

test("view-mode toggle names its state in words", async ({ page }) => {
  await openSzdExample(page);
  const toggle = page.locator("#btn-viewmode");
  await expect(toggle).toHaveAttribute("aria-label", "One page at a time. Click for continuous view.");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(toggle).toHaveAttribute("aria-label", /^Continuous view \(all pages\)/);
});

/** Drag-select the longest word on the lowest fully visible reading line and report popover and selection geometry. */
async function selectLowestWord(page) {
  const target = await page.evaluate(() => {
    const host = document.getElementById("ed-reading");
    const box = host.getBoundingClientRect();
    const bottom = Math.min(box.top + host.clientHeight, innerHeight);
    const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
    let best = null;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const word = /\S{4,}/.exec(node.data);
      if (!word) continue;
      const range = document.createRange();
      range.setStart(node, word.index);
      range.setEnd(node, word.index + word[0].length);
      const rect = range.getBoundingClientRect();
      if (rect.height && rect.top > box.top && rect.bottom < bottom - 2 && (!best || rect.bottom > best.bottom)) {
        best = { x: rect.left, y: rect.top, width: rect.width, height: rect.height, bottom: rect.bottom };
      }
    }
    return best;
  });
  expect(target).not.toBeNull();
  await page.mouse.move(target.x + 1, target.y + target.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width - 1, target.y + target.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect(page.locator("#ed-sel-pop")).toBeVisible();
  return page.evaluate(() => {
    const host = document.getElementById("ed-reading");
    const box = host.getBoundingClientRect();
    const pop = document.getElementById("ed-sel-pop").getBoundingClientRect();
    const painted = [...(CSS.highlights?.values() || [])].flatMap((highlight) => [...highlight]);
    const selection = (painted[0] || window.getSelection().getRangeAt(0)).getBoundingClientRect();
    return {
      popTop: pop.top, popBottom: pop.bottom, selectionTop: selection.top, selectionBottom: selection.bottom,
      paneTop: box.top, paneBottom: Math.min(box.top + host.clientHeight, innerHeight),
    };
  });
}

test("selection popover opens above the selection when only the space above holds it", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 800 });
  await openSzdExample(page);
  await page.locator("#btn-viewmode").click();
  await page.keyboard.press("Control+\\");
  await page.locator("#ed-reading").evaluate((host) => { host.scrollTop = host.scrollHeight; });
  const geometry = await selectLowestWord(page);
  expect(geometry.popBottom).toBeLessThanOrEqual(geometry.selectionTop);
  expect(geometry.popTop).toBeGreaterThanOrEqual(geometry.paneTop - 1);
});

test("selection popover stays below and keeps the selection visible when neither side holds it", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 800 });
  await openSzdExample(page);
  const geometry = await selectLowestWord(page);
  expect(geometry.popTop).toBeGreaterThanOrEqual(geometry.selectionBottom);
  expect(geometry.selectionTop).toBeGreaterThanOrEqual(geometry.paneTop - 1);
  expect(geometry.selectionBottom).toBeLessThanOrEqual(geometry.paneBottom);
});

test("a failed recovery checkpoint stays visible in words and the footer shows the whole message", async ({ page }) => {
  await page.addInitScript(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function guardedPut(...args) {
      if (this.name === "sessions") {
        throw new DOMException("The serialized keys and/or value are too large (size=329166366 bytes, max=133169152 bytes).", "UnknownError");
      }
      return put.apply(this, args);
    };
  });
  await page.setViewportSize({ width: 900, height: 800 });
  await openSzdExample(page);
  await applyXmlEdit(page, " ");
  const problem = page.locator("#ed-docstrip .ed-docstrip-state.problem");
  await expect(problem).toHaveText("no local recovery");
  await expect(problem).toHaveAttribute("title", /too large for the browser's recovery storage/);
  const status = page.locator("#ed-status");
  await expect(status).toContainText("Download a working copy to keep your work.");
  await expect(status).not.toContainText("..");
  const footer = await page.evaluate(() => {
    const frame = document.querySelector(".ed-footer").getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(document.getElementById("ed-status"));
    return [...range.getClientRects()].every((rect) => rect.top >= frame.top - 0.5 && rect.bottom <= frame.bottom + 0.5 && rect.right <= innerWidth);
  });
  expect(footer).toBe(true);

  // A later edit fails again; the strip keeps the state whatever the footer line reports.
  await applyXmlEdit(page, " ");
  await expect(problem).toHaveText("no local recovery");
  await expect(page.locator("#ed-docstrip .ed-docstrip-state", { hasText: "unsaved" })).toBeVisible();
});

test("Tab indents in the XML source while Shift+Tab and Escape then Tab leave it", async ({ page }) => {
  await openSzdExample(page);
  await page.locator("#view-xml").click();
  const source = page.locator(".ed-src-ta");
  await source.focus();
  const before = await source.inputValue();
  await page.keyboard.press("Tab");
  await expect(source).toBeFocused();
  expect((await source.inputValue()).length).toBe(before.length + 2);
  await page.keyboard.press("Shift+Tab");
  await expect(source).not.toBeFocused();
  await source.focus();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Tab");
  await expect(source).not.toBeFocused();
  expect((await source.inputValue()).length).toBe(before.length + 2);
  await expect(source).toHaveAccessibleDescription(/Escape, then Tab/);
});
