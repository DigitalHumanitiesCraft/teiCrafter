import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const source = '<TEI xmlns="http://www.tei-c.org/ns/1.0"><teiHeader><fileDesc><titleStmt><title>Test</title></titleStmt><publicationStmt><p>Unpublished</p></publicationStmt><sourceDesc><p>Synthetic</p></sourceDesc></fileDesc></teiHeader><text><body><p>un<hi>klar</hi>! <choice><orig>vnd</orig><reg>und</reg></choice></p></body></text></TEI>';

async function open(page, raw = source, name = "safety.xml") {
  await page.addInitScript(() => Object.defineProperty(window, "showOpenFilePicker", { configurable: true, value: undefined }));
  await page.goto("/editor.html");
  await page.locator("#btn-load").click();
  const chooser = page.waitForEvent("filechooser");
  await page.locator("#menu-open").click();
  await (await chooser).setFiles({ name, mimeType: "application/xml", buffer: Buffer.from(raw) });
  await expect(page.locator("#ed-docstrip")).toContainText(name);
}

test("reading adjacency and alternatives match the chosen policy", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await open(page);
  await expect(page.locator(".ed-line-body")).toHaveText("unklar! vnd");
  await page.getByRole("tab", { name: "Normalized", exact: true }).click();
  await expect(page.locator(".ed-line-body")).toHaveText("unklar! und");
  expect(errors).toEqual([]);
});

test("invalid staged XML survives reload and a portable working copy", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await open(page);
  await page.locator("#view-xml").click();
  await page.locator(".ed-src-ta").fill("<unfinished &amp;");
  await page.locator("#btn-save").click();
  await expect(page.locator(".ed-src-ta")).toHaveValue("<unfinished &amp;");
  const downloaded = page.waitForEvent("download");
  await page.locator("#btn-working-copy").click();
  const download = await downloaded;
  const bundle = JSON.parse(readFileSync(await download.path(), "utf8"));
  expect(bundle.record.raw).toBe(source);
  expect(bundle.record.staged.value).toBe("<unfinished &amp;");
  await expect.poll(async () => page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("teicrafter.recovery");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return new Promise((resolve, reject) => {
      const request = db.transaction("sessions").objectStore("sessions").getAll();
      request.onsuccess = () => { db.close(); resolve(request.result.some((record) => record.staged?.value === "<unfinished &amp;")); };
      request.onerror = () => reject(request.error);
    });
  })).toBe(true);
  page.on("dialog", (dialog) => dialog.accept());
  await page.reload();
  await page.getByRole("button", { name: "Restore", exact: true }).click();
  await expect(page.locator(".ed-src-ta")).toHaveValue("<unfinished &amp;");
  expect(errors).toEqual([]);
});

test("a literal text edit is keyboard accessible and restores after reload", async ({ page }) => {
  await open(page);
  await page.locator(".ed-w").first().focus();
  await page.keyboard.press("F2");
  await page.locator(".ed-line-input").fill("literal &amp;");
  await page.locator(".ed-line-input").press("Enter");
  await expect(page.locator(".ed-w").first()).toHaveText("literal &amp;");
  page.on("dialog", (dialog) => dialog.accept());
  await page.waitForTimeout(300);
  await page.reload();
  await page.getByRole("button", { name: "Restore", exact: true }).click();
  await expect(page.locator(".ed-w").first()).toHaveText("literal &amp;");
});

test("working copies retain images and separate recovery sessions", async ({ page }) => {
  await page.goto("/editor.html");
  page.on("dialog", (dialog) => dialog.accept());
  for (const name of ["one.xml", "two.xml"]) {
    const bundle = { format: "teicrafter-working-copy", version: 1, record: {
      raw: source, docName: name,
      images: [{ name: "page.png", type: "image/png", base64: "AH//" }],
    } };
    const chooser = page.waitForEvent("filechooser");
    await page.locator("#btn-open-working-copy").click();
    await (await chooser).setFiles({ name: "copy.teicrafter.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(bundle)) });
    await expect(page.locator("#ed-docstrip")).toContainText(name);
  }
  const requested = page.waitForEvent("download");
  await page.locator("#btn-working-copy").click();
  const saved = JSON.parse(readFileSync(await (await requested).path(), "utf8"));
  expect(saved.record.images).toEqual([{ name: "page.png", type: "image/png", base64: "AH//" }]);
  await page.waitForTimeout(300);
  await page.reload();
  await expect(page.getByRole("button", { name: "Restore", exact: true })).toHaveCount(2);
});

test("staged metadata survives reload without changing committed XML", async ({ page }) => {
  await open(page);
  await page.locator("#view-metadata").click();
  const title = page.locator(".ed-meta-form input").first();
  await title.fill("A literal &amp; title");
  page.on("dialog", (dialog) => dialog.accept());
  await page.waitForTimeout(300);
  await page.reload();
  await page.getByRole("button", { name: "Restore", exact: true }).click();
  await expect(page.locator(".ed-meta-form input").first()).toHaveValue("A literal &amp; title");
  const requested = page.waitForEvent("download");
  await page.locator("#btn-working-copy").click();
  const saved = JSON.parse(readFileSync(await (await requested).path(), "utf8"));
  expect(saved.record.raw).toBe(source);
  expect(saved.record.staged.mode).toBe("metadata-form");
});

test("uncommitted inline input survives reload", async ({ page }) => {
  await open(page);
  await page.locator(".ed-w").first().focus();
  await page.keyboard.press("F2");
  await page.locator(".ed-line-input").fill("unfinished &amp;");
  page.on("dialog", (dialog) => dialog.accept());
  await page.waitForTimeout(300);
  await page.reload();
  await page.getByRole("button", { name: "Restore", exact: true }).click();
  await expect(page.locator(".ed-line-input")).toHaveValue("unfinished &amp;");
});

test("review records retain history and track the reviewed content", async ({ page }) => {
  await open(page);
  await page.locator("#ed-review-summary").click();
  await page.getByRole("textbox", { name: "Reviewer identifier (URI or TEI pointer)" }).fill("https://example.org/editor");
  await page.getByRole("button", { name: "Mark reviewed", exact: true }).click();
  await expect(page.locator("#ed-review-summary")).toHaveText("Reviewed 1/1");
  await page.locator(".ed-w").first().focus();
  await page.keyboard.press("F2");
  await page.locator(".ed-line-input").fill("changed");
  await page.locator(".ed-line-input").press("Enter");
  await expect(page.locator("#ed-review-summary")).toContainText("changed since review");
  await page.locator("#btn-undo").click();
  await expect(page.locator("#ed-review-summary")).toHaveText("Reviewed 1/1");
  await page.locator("#ed-review-summary").click();
  await expect(page.locator("#ed-review-summary")).toHaveText("Reviewed 0/1");
  const requested = page.waitForEvent("download");
  await page.locator("#btn-working-copy").click();
  const saved = JSON.parse(readFileSync(await (await requested).path(), "utf8"));
  expect(saved.record.raw).toContain('subtype="verified"');
  expect(saved.record.raw).toContain('subtype="reopened"');
  expect(saved.record.raw).toContain('who="https://example.org/editor"');
});

test("confirming a proposal preserves its visible and persisted origin", async ({ page }) => {
  await open(page, source.replace('<hi>klar</hi>', '<hi resp="#ai #human" ana="#existing">klar</hi>'));
  await page.locator(".ed-w").filter({ hasText: /^klar$/ }).click();
  await page.getByRole("button", { name: "confirm", exact: true }).click();
  await expect(page.locator(".ed-w").filter({ hasText: /^klar$/ })).toHaveClass(/ed-w-ai-origin/);
  await expect(page.locator(".ed-w").filter({ hasText: /^klar$/ })).toHaveAttribute("title", /AI-origin, accepted/);
  const requested = page.waitForEvent("download");
  await page.locator("#btn-working-copy").click();
  const saved = JSON.parse(readFileSync(await (await requested).path(), "utf8"));
  expect(saved.record.raw).toContain('resp="#ai #human"');
  expect(saved.record.raw).toContain("#existing urn:teicrafter:proposal:accepted:%23ai");
});

test("read only protects every document view and retains edit history", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await open(page);
  await page.locator(".ed-w").first().focus();
  await page.keyboard.press("F2");
  await page.locator(".ed-line-input").fill("corrected");
  await page.locator(".ed-line-input").press("Enter");
  await page.getByRole("button", { name: "Read only", exact: true }).click();
  await expect(page.locator("#btn-read-only")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#btn-undo")).toBeDisabled();
  await expect(page.locator("#ed-review-summary")).toBeDisabled();
  await page.locator(".ed-w").first().dblclick();
  await page.keyboard.press("F2");
  await expect(page.locator(".ed-line-input")).toHaveCount(0);
  await page.locator("#view-xml").click();
  const rawView = await page.locator(".ed-src-ta").inputValue();
  await expect(page.locator(".ed-src-ta")).toHaveJSProperty("readOnly", true);
  await page.locator(".ed-src-ta").press("Enter");
  await expect(page.locator(".ed-src-ta")).toHaveValue(rawView);
  await page.getByRole("button", { name: "Find", exact: true }).click();
  await page.getByRole("textbox", { name: "Find", exact: true }).fill("corrected");
  await expect(page.getByRole("button", { name: "Replace", exact: true })).toBeHidden();
  await page.locator("#view-metadata").click();
  await expect(page.locator(".ed-meta-form input").first()).toHaveJSProperty("readOnly", true);
  await expect(page.getByRole("button", { name: "Apply", exact: true })).toBeHidden();
  const requested = page.waitForEvent("download");
  await page.locator("#btn-working-copy").click();
  const saved = JSON.parse(readFileSync(await (await requested).path(), "utf8"));
  expect(saved.record.raw).toBe(source.replace("<p>un<hi>", "<p>corrected<hi>"));
  await page.getByRole("button", { name: "Edit document", exact: true }).click();
  await page.locator("#btn-undo").click();
  await page.locator("#view-reading").click();
  await expect(page.locator(".ed-line-body")).toHaveText("unklar! vnd");
  expect(errors).toEqual([]);
});

test("read-only switching leaves unfinished XML available for recovery", async ({ page }) => {
  await open(page);
  await page.locator("#view-xml").click();
  await page.locator(".ed-src-ta").fill("<unfinished");
  await page.locator("#btn-read-only").click();
  await expect(page.locator("#btn-read-only")).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".ed-src-ta")).toHaveValue("<unfinished");
  await expect(page.locator("#ed-status")).toContainText("Apply or cancel");
});

test("project folders expose nested files and preserve the plaintext output directory", async ({ page }) => {
  await page.addInitScript((xml) => {
    const store = new Map();
    const file = (name, text) => {
      const handle = { kind: "file", name, async getFile() { return new File([store.get(handle)], name, { lastModified: 1 }); },
        async createWritable() { let pending; return { async write(data) { pending = data; }, async close() { store.set(handle, pending); }, async abort() {} }; } };
      store.set(handle, text);
      return handle;
    };
    const dir = (name, entries) => ({ kind: "directory", name,
      async *values() { yield* entries; },
      async getDirectoryHandle(target) { const found = entries.find((entry) => entry.name === target && entry.kind === "directory"); if (!found) throw new DOMException("Missing", "NotFoundError"); return found; },
      async getFileHandle(target, options = {}) { let found = entries.find((entry) => entry.name === target && entry.kind === "file");
        if (!found && options.create) { found = file(target, ""); entries.push(found); }
        if (!found) throw new DOMException("Missing", "NotFoundError"); return found; },
    });
    const letters = dir("letters", [file("letter.xml", xml), file("transcript.txt", "A fictional letter."), file("transcript.xml", "Occupied source")]);
    const root = dir("Nested project", [letters]);
    window.showDirectoryPicker = async () => root;
    window.projectOutput = async () => ({
      original: await (await (await letters.getFileHandle("transcript.xml")).getFile()).text(),
      created: await (await (await letters.getFileHandle("transcript (1).xml")).getFile()).text(),
      rootNames: await Array.fromAsync(root.values(), (entry) => entry.name),
    });
  }, source);
  await page.goto("/editor.html");
  await page.locator("#btn-load").click();
  await page.locator("#menu-open-project").click();
  await expect(page.locator("#ed-docstrip")).toContainText("letters/letter.xml");
  await expect(page.locator(".ed-proj-directory > summary")).toHaveText("letters");
  await page.getByRole("button", { name: "letters/transcript.txt", exact: true }).click();
  await page.locator("#btn-save").click();
  await expect(page.locator("#ed-status")).toContainText("Saved in place", { timeout: 20000 });
  await expect(page.locator("#ed-docstrip")).toContainText("letters/transcript (1).xml");
  const output = await page.evaluate(() => window.projectOutput());
  expect(output.original).toBe("Occupied source");
  expect(output.created).toContain("A fictional letter.");
  expect(output.rootNames).toEqual(["letters"]);
});

test("a letter starter records supplied facts without inferring a date", async ({ page }) => {
  await page.goto("/editor.html");
  await page.locator("#btn-load").click();
  await page.locator("#menu-new-from-text").click();
  const dialog = page.locator("#onramp-modal");
  await dialog.getByLabel("Document starter", { exact: true }).selectOption("letter");
  await dialog.getByLabel("Name", { exact: true }).fill("Fictional letter");
  await dialog.getByLabel("Sender (optional)", { exact: true }).fill("Writer &amp; Co.");
  await dialog.getByLabel("Recipient (optional)", { exact: true }).fill("A fictional recipient");
  await dialog.getByLabel("Date as written (optional)", { exact: true }).fill("around 1700?");
  await dialog.locator("textarea").fill("Dear friend,\nAn original fictional transcription.");
  await dialog.getByRole("button", { name: "Craft TEI", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator("#ed-docstrip")).toContainText("Fictional letter.xml");
  const requested = page.waitForEvent("download");
  await page.locator("#btn-working-copy").click();
  const saved = JSON.parse(readFileSync(await (await requested).path(), "utf8"));
  expect(saved.record.raw).toContain('<div type="letter">');
  expect(saved.record.raw).toContain("<persName>Writer &amp;amp; Co.</persName>");
  expect(saved.record.raw).toContain("<date>around 1700?</date>");
  expect(saved.record.raw).not.toContain('when="');
  expect(saved.record.raw).not.toContain('resp="#ai"');
});

test("thirty dictionary entries open as independently navigable units", async ({ page }) => {
  await page.goto("/editor.html");
  await page.locator("#btn-load").click();
  await page.locator("#menu-new-from-text").click();
  const dialog = page.locator("#onramp-modal");
  await dialog.getByLabel("Document starter", { exact: true }).selectOption("dictionary");
  await expect(dialog.getByLabel("Sender (optional)", { exact: true })).toBeHidden();
  await dialog.getByLabel("Name", { exact: true }).fill("Fictional glossary");
  await dialog.locator("textarea").fill(Array.from({ length: 30 }, (_, i) => `Fictional term ${i + 1}\nDefinition for an invented term ${i + 1}.`).join("\n\n"));
  await expect(dialog.locator(".onramp-reconcile")).toContainText("30 entries");
  await dialog.getByRole("button", { name: "Craft TEI", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator("#ed-folio-label")).toContainText("1/30");
  await page.locator("#btn-next").click();
  await expect(page.locator("#ed-reading")).toContainText("Fictional term 2");
  const requested = page.waitForEvent("download");
  await page.locator("#btn-working-copy").click();
  const saved = JSON.parse(readFileSync(await (await requested).path(), "utf8"));
  expect((saved.record.raw.match(/<entry xml:id=/g) || []).length).toBe(30);
});

test("accepted register origin remains visible and read-only indices expose no edit actions", async ({ page }) => {
  await open(page, source.replace("<text>", '<standOff><listPerson><person xml:id="person1" resp="#ai #human"><persName>Fictional editor</persName></person></listPerson></standOff><text>'));
  await page.getByRole("tab", { name: "Index", exact: true }).click();
  await page.locator(".ed-idx-confirm").click();
  await expect(page.locator(".ed-idx-origin")).toHaveText("AI-origin, accepted");
  await expect(page.locator(".ed-idx-confirm")).toHaveCount(0);
  await expect(page.locator(".ed-idx-actions")).toHaveCount(1);
  await page.locator("#btn-read-only").click();
  await expect(page.locator(".ed-idx-origin")).toHaveText("AI-origin, accepted");
  await expect(page.locator(".ed-idx-actions")).toHaveCount(0);
  const requested = page.waitForEvent("download");
  await page.locator("#btn-working-copy").click();
  const saved = JSON.parse(readFileSync(await (await requested).path(), "utf8"));
  expect(saved.record.raw).toContain('resp="#ai #human"');
  expect(saved.record.raw).toContain("urn:teicrafter:proposal:accepted:%23ai");
});
