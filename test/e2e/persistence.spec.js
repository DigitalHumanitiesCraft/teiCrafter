import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const raw = '<TEI xmlns="http://www.tei-c.org/ns/1.0"><teiHeader><fileDesc><titleStmt><title>Persistence test</title></titleStmt><publicationStmt><p>Unpublished</p></publicationStmt><sourceDesc><p>Synthetic</p></sourceDesc></fileDesc></teiHeader><text><body><p>Original text</p></body></text></TEI>';

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => { throw error; });
});

async function open(page, native = false) {
  await page.addInitScript(({ source, native }) => {
    const file = new File([source], "persistence.xml", { type: "application/xml", lastModified: 123 });
    window.saveProbe = { started: false, closed: false, aborted: false, release: null };
    window.showOpenFilePicker = native ? async () => [{
      name: file.name, getFile: async () => file,
      createWritable: async () => ({
        write: async () => {
          window.saveProbe.started = true;
          await new Promise((resolve) => { window.saveProbe.release = resolve; });
        },
        close: async () => { window.saveProbe.closed = true; },
        abort: async () => { window.saveProbe.aborted = true; },
      }),
    }] : undefined;
  }, { source: raw, native });
  await page.goto("/editor.html");
  await page.locator("#btn-load").click();
  if (native) await page.locator("#menu-open").click();
  else {
    const chooser = page.waitForEvent("filechooser");
    await page.locator("#menu-open").click();
    await (await chooser).setFiles({ name: "persistence.xml", mimeType: "application/xml", buffer: Buffer.from(raw) });
  }
  await expect(page.locator("#ed-docstrip")).toContainText("persistence.xml");
}

async function edit(page, text, commit = true) {
  await page.locator(".ed-w").first().focus();
  await page.keyboard.press("F2");
  await page.locator(".ed-line-input").fill(text);
  if (commit) await page.locator(".ed-line-input").press("Enter");
}

async function workingCopy(page) {
  const requested = page.waitForEvent("download");
  await page.locator("#btn-working-copy").click();
  return JSON.parse(readFileSync(await (await requested).path(), "utf8")).record;
}

test("failed inline input blocks Undo and view changes without losing either version", async ({ page }) => {
  await open(page);
  await edit(page, "Committed text");
  await edit(page, "Unfinished text", false);
  // Firefox's text-insertion API strips control characters before input events.
  // Inject the invalid value to exercise the editor's failed-Apply boundary.
  await page.locator(".ed-line-input").evaluate((input) => {
    input.value = "Unfinished\u0001text";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.locator(".ed-line-input").press("Enter");
  await expect(page.locator(".ed-line-input")).toHaveValue("Unfinished\u0001text");
  await page.locator("#btn-undo").click();
  await expect(page.locator("#ed-status")).toContainText("Apply or cancel");
  await page.locator("#view-xml").click();
  await expect(page.locator(".ed-line-input")).toHaveValue("Unfinished\u0001text");
  const copy = await workingCopy(page);
  expect(copy.raw).toContain("Committed text");
  expect(copy.staged.value.core).toBe("Unfinished\u0001text");
  await page.locator(".ed-line-input").press("Escape");
  await page.locator("#btn-undo").click();
  await expect(page.locator(".ed-w").first()).toHaveText("Original text");
});

test("metadata Apply and exact XML Apply share recovery and undo ownership", async ({ page }) => {
  await open(page);
  await page.locator("#view-metadata").click();
  await page.locator(".ed-meta-form input").first().fill("Changed title");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.locator(".ed-meta-form input").first()).toHaveValue("Changed title");
  await page.locator("#view-xml").click();
  const input = page.locator(".ed-src-ta");
  await input.fill((await input.inputValue()).replace("Original text", "Changed text"));
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.locator(".ed-w").first()).toHaveText("Changed text");
  await page.locator("#btn-undo").click();
  await expect(page.locator(".ed-w").first()).toHaveText("Original text");
  const copy = await workingCopy(page);
  expect(copy.raw).toContain("Changed title");
  expect(copy.staged).toBeNull();
});

test("a disposed inline editor cannot clear a later metadata edit", async ({ page }) => {
  await open(page);
  await edit(page, "Cancelled input", false);
  const previous = await page.locator(".ed-line-input").elementHandle();
  await page.locator(".ed-line-input").press("Escape");
  await page.locator("#view-metadata").click();
  await page.locator(".ed-meta-form input").first().fill("Pending title");
  await previous.evaluate((element) => element.dispatchEvent(new Event("blur")));
  await page.locator("#view-reading").click();
  await expect(page.locator(".ed-meta-form input").first()).toHaveValue("Pending title");
  expect((await workingCopy(page)).staged.value).toContainEqual(expect.arrayContaining(["Pending title"]));
});

test("unfinished input during a native write aborts without claiming a save", async ({ page }) => {
  test.setTimeout(60_000);
  await open(page, true);
  await edit(page, "Revision being saved");
  await page.locator("#btn-save").click();
  await expect.poll(() => page.evaluate(() => ({ started: window.saveProbe.started,
    status: document.getElementById("ed-status").textContent })), { timeout: 45_000 }).toMatchObject({ started: true });
  await edit(page, "New unfinished input", false);
  await page.evaluate(() => window.saveProbe.release());
  await expect.poll(() => page.evaluate(() => window.saveProbe.aborted)).toBe(true);
  expect(await page.evaluate(() => window.saveProbe.closed)).toBe(false);
  await expect(page.locator("#ed-status-dot")).toHaveClass(/dirty/);
  await expect(page.locator(".ed-line-input")).toHaveValue("New unfinished input");
});

test("a recovery transaction abort is visible and does not prevent later checkpoints", async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      const request = put.apply(this, args);
      if (this.name === "sessions") {
        this.transaction.abort();
        IDBObjectStore.prototype.put = put;
      }
      return request;
    };
  });
  await page.locator("#view-xml").click();
  await page.locator(".ed-src-ta").fill("<first unfinished");
  await expect(page.locator("#ed-status")).toContainText("Local recovery failed");
  await page.locator(".ed-src-ta").fill("<second unfinished");
  await expect.poll(() => page.evaluate(async () => {
    const db = await new Promise((resolve) => { const request = indexedDB.open("teicrafter.recovery"); request.onsuccess = () => resolve(request.result); });
    return new Promise((resolve) => {
      const request = db.transaction("sessions").objectStore("sessions").getAll();
      request.onsuccess = () => { db.close(); resolve(request.result.some((entry) => entry.staged?.value === "<second unfinished")); };
    });
  })).toBe(true);
});
