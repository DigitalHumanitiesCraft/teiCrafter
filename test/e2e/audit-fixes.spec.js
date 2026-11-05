import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { recoveryRecords } from "./helpers/recovery-records.js";
import { COLD_SCHEMA_OUTPUT_TIMEOUT_MS, SCHEMA_WORKFLOW_TIMEOUT_MS } from "./helpers/schema-output-timing.js";

// Workshop audit of the published editor: each test fails on the behaviour the
// audit observed and passes on the corrected one.

const HERSCH = readFileSync(new URL("../../docs/data/editor/zbz-hersch-synthetic.xml", import.meta.url), "utf8");

async function openFile(page, raw = HERSCH, name = "hersch.xml") {
  await page.addInitScript(() => Object.defineProperty(window, "showOpenFilePicker", { configurable: true, value: undefined }));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.goto("/editor.html");
  await page.locator("#btn-load").click();
  const chooser = page.waitForEvent("filechooser");
  await page.locator("#menu-open").click();
  await (await chooser).setFiles({ name, mimeType: "application/xml", buffer: Buffer.from(raw) });
  await expect(page.locator("#ed-docstrip")).toContainText(name);
}

/** Centre of a word inside the first reading span that contains it. */
async function wordPoint(page, word) {
  return page.evaluate((target) => {
    for (const span of document.querySelectorAll("#ed-reading .ed-w")) {
      const walker = document.createTreeWalker(span, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const at = node.data.search(new RegExp(`\\b${target}\\b`));
        if (at < 0) continue;
        const range = document.createRange();
        range.setStart(node, at);
        range.setEnd(node, at + target.length);
        const rect = range.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, id: span.dataset.id, text: span.textContent };
      }
    }
    return null;
  }, word);
}

test("double-clicking a word and typing replaces only that word", async ({ page }) => {
  await openFile(page);
  const point = await wordPoint(page, "malice");
  expect(point).not.toBeNull();
  await page.mouse.dblclick(point.x, point.y);
  const input = page.locator(".ed-line-input");
  await expect(input).toBeFocused();
  await page.keyboard.type("spite");
  await page.keyboard.press("Enter");
  const cell = page.locator(`#ed-reading .ed-w[data-id="${point.id}"]`);
  await expect(cell).toHaveText(point.text.replace(/\bmalice\b/, "spite"));
});

test("F2 opens the line editor with the caret at the end, and Escape returns focus to the text", async ({ page }) => {
  await openFile(page);
  const first = page.locator("#ed-reading .ed-w").first();
  const original = await first.textContent();
  await first.focus();
  await page.keyboard.press("F2");
  const input = page.locator(".ed-line-input");
  await expect(input).toBeFocused();
  const caret = await input.evaluate((node) => [node.selectionStart, node.selectionEnd, node.value.length]);
  expect(caret[0]).toBe(caret[2]);
  expect(caret[1]).toBe(caret[2]);
  await expect(input).toHaveAccessibleName("Edit line text");
  await page.keyboard.press("Escape");
  await expect(first).toHaveText(original);
  expect(await page.evaluate(() => document.activeElement?.closest("#ed-reading") !== null)).toBe(true);
});

test("the example link leaves no hash, so a reload offers recovery of edits", async ({ page }) => {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.goto("/editor.html#example=szd");
  await expect(page.locator("#ed-docstrip")).toContainText("o_szd.1079.tei.xml");
  await expect(page).toHaveURL(/\/editor\.html$/);
  const cell = page.locator("#ed-reading .ed-w").first();
  await cell.focus();
  await page.keyboard.press("F2");
  await page.keyboard.type(" AUDITEDIT");
  await page.keyboard.press("Enter");
  await expect(page.locator("#ed-docstrip")).toContainText("unsaved");
  // The checkpoint write is asynchronous; wait for it before reloading.
  await expect.poll(async () => (await recoveryRecords(page)).some((record) => record.raw.includes("AUDITEDIT"))).toBe(true);
  page.on("dialog", (dialog) => dialog.accept());
  await page.reload();
  await expect(page.getByRole("button", { name: /Restore/ }).first()).toBeVisible();
});

test("an unavailable example deep link explains itself", async ({ page }) => {
  await page.goto("/editor.html#example=nosuchexample");
  await expect(page.locator("#ed-status")).toContainText("is not available on this site");
});

test("a schema-gated download shows its wait and ignores repeated clicks", async ({ page }) => {
  test.setTimeout(SCHEMA_WORKFLOW_TIMEOUT_MS);
  await openFile(page);
  const downloads = [];
  page.on("download", (download) => downloads.push(download));
  const button = page.locator("#btn-download");
  await button.click();
  await expect(button).toHaveAttribute("aria-busy", "true");
  await expect(button).toHaveText("Validating...");
  // A real click reaches an aria-disabled button; Playwright's click would wait for it.
  await button.dispatchEvent("click");
  await button.dispatchEvent("click");
  await expect(page.locator("#ed-status")).toContainText("still being validated");
  await expect(button).toHaveText("Download", { timeout: COLD_SCHEMA_OUTPUT_TIMEOUT_MS });
  await expect(button).not.toHaveAttribute("aria-busy", "true");
  await page.waitForTimeout(500);
  expect(downloads).toHaveLength(1);
});

test("well-formedness errors are readable, live in the source and named at load and output", async ({ page }) => {
  test.setTimeout(SCHEMA_WORKFLOW_TIMEOUT_MS);
  await openFile(page);
  await page.locator("#view-xml").click();
  const source = page.locator(".ed-src-ta");
  await source.evaluate((node) => {
    node.focus();
    const at = node.value.indexOf("</p>");
    node.setRangeText("</px>", at, at + 4, "end");
    node.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const result = page.locator(".ed-src-result");
  await expect(result).toHaveClass(/err/);
  await expect(result).toContainText(/^Line \d+, column \d+: /);
  await expect(result).not.toContainText("This page contains");

  const broken = HERSCH.replace("</head>", "</haed>");
  await openFile(page, broken, "broken.xml");
  await expect(page.locator("#ed-status")).toContainText("The file is not well-formed XML (Line");
  await page.locator("#btn-download").click();
  await expect(page.locator("#ed-status")).toContainText("blocked because the document is not well-formed XML", { timeout: COLD_SCHEMA_OUTPUT_TIMEOUT_MS });
});

test("Propose (AI) without a key names the missing key once, with one period", async ({ page }) => {
  await openFile(page);
  await page.locator("#btn-propose").click();
  const status = page.locator("#ed-status");
  await expect(status).toContainText("Proposal failed: No API key configured");
  await expect(status).not.toContainText("..");
  await expect(status).toContainText('Set a provider and API key in "New from text (LLM)".');
});

test("the Load menu follows the menu-button keyboard pattern and dialogs hand focus back", async ({ page }) => {
  await page.goto("/editor.html");
  const button = page.locator("#btn-load");
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#menu-open")).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("#menu-open")).not.toBeFocused();
  await page.keyboard.press("Home");
  await expect(page.locator("#menu-open")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator("#ed-load-menu")).toBeHidden();
  await expect(button).toBeFocused();

  // New document dialog: opened from the menu by keyboard, closed by Escape.
  await page.keyboard.press("Enter");
  await page.locator("#menu-new-from-text").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#onramp-modal")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#onramp-modal")).toBeHidden();
  await expect(button).toBeFocused();

  // LLM dialog keeps focus inside and returns it on Escape.
  await page.locator("#btn-generate").focus();
  await page.keyboard.press("Enter");
  const dialog = page.locator("#gen-modal");
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.locator("#btn-generate")).toBeFocused();
});

test("the reading-text context menu works from the keyboard", async ({ page }) => {
  await openFile(page);
  const cell = page.locator("#ed-reading .ed-w").first();
  await cell.focus();
  await cell.dispatchEvent("contextmenu", { clientX: 0, clientY: 0 });
  const menu = page.locator("#ed-menu");
  await expect(menu).toHaveAttribute("role", "menu");
  const items = menu.locator(".ed-menu-item:not([disabled])");
  await expect(items.first()).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(items.nth(1)).toBeFocused();
  await expect(menu.getByRole("menuitem", { name: "Split line here" })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(cell).toBeFocused();
});

test("names, states and reflow of editor controls", async ({ page }) => {
  await openFile(page);
  await expect(page.locator("h1")).toHaveText("teiCrafter editor");
  await expect(page.locator("#btn-next")).toHaveAccessibleName("Next page");
  const chip = page.locator("#ed-val-chip");
  await expect(chip).toHaveAttribute("aria-expanded", "false");
  await chip.click();
  await expect(chip).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(chip).toHaveAttribute("aria-expanded", "false");

  await page.getByRole("tab", { name: "Index", exact: true }).click();
  for (const button of await page.locator(".ed-idx-edit, .ed-idx-idtoggle").all()) {
    const visible = (await button.textContent()).trim().toLowerCase();
    expect((await button.evaluate((node) => node.getAttribute("aria-label") || node.textContent)).toLowerCase()).toContain(visible);
  }
  await page.getByRole("tab", { name: "Reading text", exact: true }).click();
  await page.locator("#ed-reading .ed-w").first().focus();
  await page.keyboard.press("F2");
  const axe = await new AxeBuilder({ page }).withRules(["label", "aria-allowed-attr", "page-has-heading-one"]).analyze();
  expect(axe.violations.map((violation) => violation.id)).toEqual([]);
  await page.keyboard.press("Escape");

  await page.locator("#view-xml").click();
  const sourceAxe = await new AxeBuilder({ page }).withRules(["aria-allowed-attr"]).analyze();
  expect(sourceAxe.violations).toEqual([]);

  await page.setViewportSize({ width: 320, height: 640 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
