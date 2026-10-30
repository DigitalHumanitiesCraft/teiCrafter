import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { COLD_SCHEMA_OUTPUT_TIMEOUT_MS, SCHEMA_WORKFLOW_TIMEOUT_MS } from "./helpers/schema-output-timing.js";
import { recoveryRecords } from "./helpers/recovery-records.js";

const raw = '<TEI xmlns="http://www.tei-c.org/ns/1.0"><teiHeader><fileDesc><titleStmt><title>Persistence test</title></titleStmt><publicationStmt><p>Unpublished</p></publicationStmt><sourceDesc><p>Synthetic</p></sourceDesc></fileDesc></teiHeader><text><body><p>Original text</p></body></text></TEI>';

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => { throw error; });
});

async function open(page, native = false, text = raw) {
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
  }, { source: text, native });
  await page.goto("/editor.html");
  await page.locator("#btn-load").click();
  if (native) await page.locator("#menu-open").click();
  else {
    const chooser = page.waitForEvent("filechooser");
    await page.locator("#menu-open").click();
    await (await chooser).setFiles({ name: "persistence.xml", mimeType: "application/xml", buffer: Buffer.from(text) });
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
  test.setTimeout(SCHEMA_WORKFLOW_TIMEOUT_MS);
  await open(page, true);
  await edit(page, "Revision being saved");
  await page.locator("#btn-save").click();
  await expect.poll(() => page.evaluate(() => ({ started: window.saveProbe.started,
    status: document.getElementById("ed-status").textContent })), { timeout: COLD_SCHEMA_OUTPUT_TIMEOUT_MS }).toMatchObject({ started: true });
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

const checkpointOf = async (page) => (await recoveryRecords(page)).find((record) => record.docName === "persistence.xml") || null;

async function restoreAfterReload(page) {
  page.on("dialog", (dialog) => dialog.accept());
  await page.reload();
  await page.getByRole("button", { name: "Restore", exact: true }).click();
  await expect(page.locator("#ed-docstrip")).toContainText("persistence.xml");
}

test("a checkpoint stores the XML once as a Blob and restores it byte-identically", async ({ page }) => {
  const source = raw.replace("<text>", "\r\n<text>").replace("Original text", "Original text ſ \u{1D11E}");
  await open(page, false, source);
  await edit(page, "Edited ſ \u{1D11E}");
  await expect.poll(async () => (await checkpointOf(page))?.raw.includes("Edited ſ \u{1D11E}")).toBe(true);
  const stored = await checkpointOf(page);
  expect(stored.storedAs).toBe("blob:application/xml");
  expect(stored.raw).toContain("\r\n<text>");
  expect(stored.raw).toBe((await workingCopy(page)).raw);
  await restoreAfterReload(page);
  await expect(page.locator(".ed-w").first()).toHaveText("Edited ſ \u{1D11E}");
  expect((await workingCopy(page)).raw).toBe(stored.raw);
});

test("a checkpoint written in the previous string format restores its project documents", async ({ page }) => {
  await page.goto("/editor.html");
  const companion = raw.replace("Original text", "Companion text");
  const active = raw.replace("Original text", "Recovered ſ text");
  await expect.poll(() => page.evaluate(async () => (await indexedDB.databases()).some((db) => db.name === "teicrafter.recovery"))).toBe(true);
  await page.evaluate(async ({ active, companion }) => {
    const entry = (id, name, text, dirty) => ({ id, role: null, name, raw: text, fileEncoding: { encoding: "UTF-8", bom: false }, dirty,
      source: { kind: "tei" }, project: null, projectManifest: null, localSchemas: null, schemaBaseUrl: null,
      schemaSettings: null, readingWitness: null, images: [] });
    const record = {
      id: "previous-format", version: 1, raw: active, docName: "persistence.xml", source: { kind: "tei" },
      fileEncoding: { encoding: "UTF-8", bom: false }, dirty: true, readingWitness: null, project: null, projectManifest: null,
      localSchemas: null, schemaBaseUrl: null, schemaSettings: null, savedAt: new Date().toISOString(), staged: null, images: [],
      projectDocuments: { version: 1, activeId: "a", documents: [entry("a", "persistence.xml", active, true), entry("b", "companion.xml", companion, false)] },
    };
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("teicrafter.recovery");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction("sessions", "readwrite");
      tx.objectStore("sessions").put(record);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, { active, companion });
  await page.reload();
  await page.getByRole("button", { name: "Restore", exact: true }).click();
  await expect(page.locator(".ed-w").first()).toHaveText("Recovered ſ text");
  const copy = await workingCopy(page);
  expect(copy.raw).toBe(active);
  // A working copy, like the checkpoint, carries the active document's text only at top level.
  expect(copy.projectDocuments.documents.map((item) => item.raw ?? copy.raw)).toEqual([active, companion]);
});

test("checkpoints captured during one write keep only the last edit", async ({ page }) => {
  await open(page);
  await page.locator("#view-xml").click();
  const input = page.locator(".ed-src-ta");
  const original = await input.inputValue();
  await page.evaluate(() => {
    window.recoveryPuts = 0;
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === "sessions") window.recoveryPuts++;
      return Reflect.apply(put, this, args);
    };
  });
  // Thirty edits in one task are captured before any of their writes can start.
  await input.evaluate((area, value) => {
    for (let edit = 1; edit <= 30; edit++) {
      area.value = value.replace("Original text", `Edit ${edit}`);
      area.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }, original);
  const last = original.replace("Original text", "Edit 30");
  await expect.poll(async () => (await checkpointOf(page))?.staged?.value).toBe(last);
  expect(await page.evaluate(() => window.recoveryPuts)).toBe(1);
  await restoreAfterReload(page);
  await expect(page.locator(".ed-src-ta")).toHaveValue(last);
});

test("a text with an unpaired surrogate is stored unchanged", async ({ page }) => {
  await open(page);
  await page.locator("#view-xml").click();
  await page.locator(".ed-src-ta").evaluate((area) => {
    area.value = area.value.replace("Original text", "Half \uD834 pair");
    area.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  // Chromium's parser refuses the unpaired surrogate, so Apply keeps it as staged input; Firefox applies it.
  // Either way the checkpoint must hold it unchanged. The comparison runs in the page, because the test
  // transport may itself replace an unpaired surrogate.
  const stored = () => page.evaluate(async () => {
    const db = await new Promise((resolve) => { const request = indexedDB.open("teicrafter.recovery"); request.onsuccess = () => resolve(request.result); });
    const records = await new Promise((resolve) => {
      const request = db.transaction("sessions").objectStore("sessions").getAll();
      request.onsuccess = () => { db.close(); resolve(request.result); };
    });
    const record = records.find((item) => item.docName === "persistence.xml");
    const lone = "Half \uD834 pair";
    if (!record) return null;
    if (typeof record.raw === "string") return record.raw.includes(lone) ? "raw kept as a string" : "raw changed";
    return record.raw instanceof Blob && record.staged?.value?.includes(lone) ? "staged input kept" : "lost";
  });
  await expect.poll(stored).toMatch(/^(raw kept as a string|staged input kept)$/);
  await expect(page.locator("#ed-docstrip")).not.toContainText("no local recovery");
  await restoreAfterReload(page);
  await page.locator("#view-xml").click();
  expect(await page.locator(".ed-src-ta").evaluate((area) => area.value.includes("Half \uD834 pair"))).toBe(true);
});
