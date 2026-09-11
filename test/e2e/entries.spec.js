import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { COLD_SCHEMA_OUTPUT_TIMEOUT_MS, SCHEMA_WORKFLOW_TIMEOUT_MS } from "./helpers/schema-output-timing.js";

const sources = Object.fromEntries(["dictionary", "articles"].map((kind) => [kind,
  readFileSync(new URL(`../fixtures-synthetic/entries-30-${kind}.xml`, import.meta.url), "utf8"),
]));
const errorsFor = (page) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
};
async function open(page, kind = "dictionary", raw = sources[kind], autoEntries = true) {
  await page.addInitScript(() => { Object.defineProperty(window, "showOpenFilePicker", { value: undefined, configurable: true }); });
  await page.goto("/editor.html");
  await page.locator("#btn-load").click();
  const chooser = page.waitForEvent("filechooser");
  await page.locator("#menu-open").click();
  await (await chooser).setFiles({ name: `entries-${kind}.xml`, mimeType: "application/xml", buffer: Buffer.from(raw) });
  await expect(page.getByRole("tab", { name: "Entries", exact: true })).toBeVisible();
  if (autoEntries) {
    await expect(page.getByRole("tab", { name: "Entries", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("searchbox", { name: "Search entries" })).toBeVisible();
  }
}
async function copy(page) {
  const requested = page.waitForEvent("download");
  await page.locator("#btn-working-copy").click();
  return JSON.parse(readFileSync(await (await requested).path(), "utf8")).record;
}
async function output(page) {
  const requested = page.waitForEvent("download", { timeout: COLD_SCHEMA_OUTPUT_TIMEOUT_MS });
  await page.locator("#btn-download").click();
  return readFileSync(await (await requested).path(), "utf8");
}
async function restore(page, kind = "dictionary") {
  page.once("dialog", (dialog) => dialog.accept());
  await page.goto("/editor.html");
  await page.locator(".ed-recent-row").filter({ hasText: `entries-${kind}.xml` }).getByRole("button", { name: "Restore", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Entries", exact: true })).toHaveAttribute("aria-selected", "true");
}
async function select(page, id) { await page.getByRole("button", { name: `Open entry ${id}`, exact: true }).click(); }

for (const kind of ["dictionary", "articles"]) {
  test(`${kind}: thirty entries support search, completeness, exact editing and validated output`, async ({ page }, testInfo) => {
    test.setTimeout(SCHEMA_WORKFLOW_TIMEOUT_MS);
    const errors = errorsFor(page);
    await open(page, kind);
    await expect(page.getByRole("region", { name: "Entry list", exact: true })).toContainText("30 of 30 entries match");
    await expect(page.getByRole("table", { name: "Entries", exact: true }).locator("tbody tr")).toHaveCount(25);
    await page.getByRole("button", { name: "Next entries", exact: true }).click();
    await expect(page.getByRole("table", { name: "Entries", exact: true }).locator("tbody tr")).toHaveCount(5);
    await page.getByRole("checkbox", { name: "Incomplete entries only", exact: true }).check();
    const incompleteRows = page.getByRole("table", { name: "Entries", exact: true }).locator("tbody tr");
    await expect(incompleteRows).toHaveCount(3);
    expect(await incompleteRows.allTextContents()).toEqual([
      expect.stringContaining("term_10"), expect.stringContaining("term_20"), expect.stringContaining("term_30"),
    ]);
    await page.getByRole("checkbox", { name: "Incomplete entries only", exact: true }).uncheck();
    await page.getByRole("searchbox", { name: "Search entries", exact: true }).fill("fahre");
    await expect(page.getByRole("table", { name: "Entries", exact: true }).locator("tbody tr")).toHaveCount(1);
    await expect(page.getByRole("table", { name: "Entries", exact: true })).toContainText("term_07");
    await page.getByRole("searchbox", { name: "Search entries", exact: true }).fill("");
    await select(page, "term_03");
    await page.getByRole("form", { name: "Entry details", exact: true }).getByRole("button", { name: "Apply entry", exact: true }).click();
    expect((await copy(page)).raw).toBe(sources[kind]);
    await select(page, "term_05");
    await expect(page.getByRole("textbox", { name: kind === "dictionary" ? "Definition" : "Article text", exact: true })).toBeDisabled();
    await select(page, "term_03");
    const accessibility = await new AxeBuilder({ page }).analyze();
    expect(accessibility.violations.filter((item) => ["serious", "critical"].includes(item.impact))).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`entries-${kind}.png`), fullPage: true });
    const headword = page.getByRole("textbox", { name: kind === "dictionary" ? "Headword" : "Article heading", exact: true });
    await headword.fill("Bede & <edited>");
    await page.getByRole("button", { name: "Apply entry", exact: true }).click();
    const expected = sources[kind].replace(kind === "dictionary" ? "<orth>Bede</orth>" : "<head>Bede</head>",
      kind === "dictionary" ? "<orth>Bede &amp; &lt;edited&gt;</orth>" : "<head>Bede &amp; &lt;edited&gt;</head>");
    expect(await output(page)).toBe(expected);
    await page.locator("#btn-undo").click();
    expect((await copy(page)).raw).toBe(sources[kind]);
    await page.locator("#btn-read-only").click();
    await expect(headword).toBeDisabled();
    await expect(page.getByRole("button", { name: "Duplicate entry", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "New entry", exact: true })).toBeDisabled();
    await page.getByRole("searchbox", { name: "Search entries", exact: true }).fill("term_07");
    await expect(page.getByRole("table", { name: "Entries", exact: true }).locator("tbody tr")).toHaveCount(1);
    expect((await copy(page)).raw).toBe(sources[kind]);
    expect(errors).toEqual([]);
  });

  test(`${kind}: duplication rewrites descendant pointers and deletion protects references`, async ({ page }) => {
    const errors = errorsFor(page);
    await open(page, kind);
    await page.getByRole("button", { name: "Preview deletion", exact: true }).click();
    await expect(page.getByRole("region", { name: "Deletion preview", exact: true })).toContainText("Deletion blocked: 1 reference");
    await expect(page.getByRole("button", { name: "Confirm entry deletion", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Duplicate entry", exact: true }).click();
    const duplicated = (await copy(page)).raw;
    expect(duplicated).toContain("xml:id='term_01-copy'");
    expect(duplicated).toContain("xml:id='detail_01-copy'");
    expect(duplicated).toContain("target='#detail_01-copy #term_02'");
    expect(duplicated.match(/<x:data/g)).toHaveLength(2);
    await page.getByRole("button", { name: "Follow #term_02", exact: true }).click();
    await expect(page.getByRole("form", { name: "Entry details", exact: true })).toContainText("term_02");
    await page.getByRole("button", { name: "Follow #term_01", exact: true }).click();
    await expect(page.getByRole("form", { name: "Entry details", exact: true })).toContainText("term_01");
    await select(page, "term_01-copy");
    await page.getByRole("button", { name: "Preview deletion", exact: true }).click();
    await page.getByRole("button", { name: "Confirm entry deletion", exact: true }).click();
    expect((await copy(page)).raw).toBe(sources[kind]);
    await page.locator("#btn-undo").click();
    expect((await copy(page)).raw).toBe(duplicated);
    await page.locator("#btn-redo").click();
    expect((await copy(page)).raw).toBe(sources[kind]);
    expect(errors).toEqual([]);
  });

  test(`${kind}: new entries preserve pending fields and allocate collision-free identifiers`, async ({ page }) => {
    const errors = errorsFor(page);
    await open(page, kind);
    await select(page, "term_03");
    await page.getByRole("button", { name: "New entry", exact: true }).click();
    await page.getByRole("textbox", { name: "New XML ID", exact: true }).fill("detail_01");
    await page.getByRole("textbox", { name: "New headword or heading", exact: true }).fill("New supplied term");
    await page.getByRole("textbox", { name: "New definition or article text", exact: true }).fill("A supplied definition.");
    await page.getByRole("button", { name: "Create entry", exact: true }).click();
    await expect(page.locator("#ed-status")).toContainText("already exists");
    const staged = await copy(page);
    expect(staged.raw).toBe(sources[kind]);
    expect(staged.staged).toMatchObject({ mode: "entries", value: { section: "create", selected: "term_03", kind, fields: { headword: "New supplied term", id: "detail_01" } } });
    await page.locator("#view-xml").click();
    await expect(page.locator("#view-reading")).toHaveAttribute("aria-selected", "true");
    await page.locator("#btn-read-only").click();
    await expect(page.getByRole("textbox", { name: "New headword or heading", exact: true })).toBeEnabled();
    await restore(page, kind);
    await expect(page.getByRole("textbox", { name: "New headword or heading", exact: true })).toHaveValue("New supplied term");
    await page.getByRole("textbox", { name: "New XML ID", exact: true }).fill("");
    await page.getByRole("button", { name: "Create entry", exact: true }).click();
    const created = (await copy(page)).raw;
    expect(created).toContain('xml:id="entry"');
    expect(created).toContain(kind === "dictionary" ? "<orth>New supplied term</orth>" : "<head>New supplied term</head>");
    expect(created).toContain(kind === "dictionary" ? "<def>A supplied definition.</def>" : "<p>A supplied definition.</p>");
    await page.locator("#btn-undo").click();
    expect((await copy(page)).raw).toBe(sources[kind]);
    expect(errors).toEqual([]);
  });
}

test("a scoped batch requires a fresh preview, survives recovery and commits as one Undo step", async ({ page }) => {
  const errors = errorsFor(page);
  await open(page);
  await page.getByRole("button", { name: "Select all matching", exact: true }).click();
  await page.getByRole("button", { name: "Batch edit selected", exact: true }).click();
  await page.getByRole("combobox", { name: "Batch field", exact: true }).selectOption("language");
  await page.getByRole("textbox", { name: "Batch value", exact: true }).fill("de");
  await expect(page.getByRole("button", { name: "Apply batch preview", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Preview batch", exact: true }).click();
  await expect(page.getByRole("region", { name: "Batch preview", exact: true })).toContainText("28 of 30 selected entries will change");
  await expect(page.getByRole("table", { name: "Batch before and after", exact: true }).locator("tbody tr")).toHaveCount(30);
  await page.getByRole("textbox", { name: "Batch value", exact: true }).fill("la");
  await expect(page.getByRole("button", { name: "Apply batch preview", exact: true })).toBeDisabled();
  const pending = await copy(page);
  expect(pending.raw).toBe(sources.dictionary);
  expect(pending.staged.value.targets).toHaveLength(30);
  expect(pending.staged.value.fields).toEqual({ field: "language", value: "la" });
  await page.getByRole("button", { name: "Clear selection", exact: true }).click();
  await expect(page.getByRole("form", { name: "Entry batch edit", exact: true })).toContainText("30 explicitly selected entries");
  await restore(page);
  await expect(page.getByRole("textbox", { name: "Batch value", exact: true })).toHaveValue("la");
  await expect(page.getByRole("button", { name: "Apply batch preview", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Preview batch", exact: true }).click();
  await expect(page.getByRole("region", { name: "Batch preview", exact: true })).toContainText("30 of 30 selected entries will change");
  await page.getByRole("button", { name: "Apply batch preview", exact: true }).click();
  const expected = sources.dictionary.replaceAll("xml:lang='de'", "xml:lang='la'")
    .replace(/<entry xml:id='term_(?!0[12]')[^']+'(?=>)/g, (tag) => tag.replace("<entry", '<entry xml:lang="la"'));
  expect((await copy(page)).raw).toBe(expected);
  await page.locator("#btn-undo").click();
  expect((await copy(page)).raw).toBe(sources.dictionary);
  await page.locator("#btn-redo").click();
  expect((await copy(page)).raw).toBe(expected);
  expect(errors).toEqual([]);
});

test("the entry workspace leaves unfinished XML under the source editor's ownership", async ({ page }) => {
  const errors = errorsFor(page);
  await open(page);
  await select(page, "term_03");
  await page.getByRole("button", { name: "Edit entry XML", exact: true }).click();
  const source = page.locator(".ed-src-ta");
  const originalPage = await source.inputValue();
  expect(originalPage).toContain("Bede");
  const pendingPage = originalPage.replace("Bede", "Bede (XML draft)");
  await source.fill(pendingPage);
  await expect(page.getByRole("textbox", { name: "Headword", exact: true })).toHaveCount(0);
  await page.locator("#view-metadata").click();
  await expect(page.locator("#view-xml")).toHaveAttribute("aria-selected", "true");
  const pending = await copy(page);
  expect(pending.raw).toBe(sources.dictionary);
  expect(pending.staged).toMatchObject({ mode: "page", value: pendingPage });
  await restore(page);
  await expect(source).toHaveValue(pendingPage);
  expect((await copy(page)).staged).toMatchObject({ mode: "page", value: pendingPage });
  expect(errors).toEqual([]);
});

test("ambiguous entry identities cannot be edited or included in an applied batch", async ({ page }) => {
  const errors = errorsFor(page);
  const raw = sources.dictionary.replace("xml:id='term_02'", "xml:id='term_01'");
  await open(page, "dictionary", raw);
  await page.getByRole("button", { name: "Open entry term_01", exact: true }).first().click();
  await expect(page.locator(".ed-entry-workspace")).toContainText("The entry target is missing, ambiguous");
  await expect(page.getByRole("form", { name: "Entry details", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Select all matching", exact: true }).click();
  await page.getByRole("button", { name: "Batch edit selected", exact: true }).click();
  await page.getByRole("combobox", { name: "Batch field", exact: true }).selectOption("language");
  await page.getByRole("textbox", { name: "Batch value", exact: true }).fill("la");
  await page.getByRole("button", { name: "Preview batch", exact: true }).click();
  await expect(page.locator("#ed-status")).toContainText("missing, ambiguous");
  await expect(page.getByRole("button", { name: "Apply batch preview", exact: true })).toBeDisabled();
  expect((await copy(page)).raw).toBe(raw);
  expect(errors).toEqual([]);
});

test("an emptied collection can reopen and requires an explicit encoding for its first new entry", async ({ page }) => {
  const errors = errorsFor(page);
  const loneEntry = "<entry xml:id='last'><form><orth>Last entry</orth></form><sense><def>Last definition.</def></sense></entry>";
  const raw = sources.dictionary.replace(/<body>[\s\S]*<\/body>/, `<body>${loneEntry}</body>`);
  await open(page, "dictionary", raw);
  await page.getByRole("button", { name: "Preview deletion", exact: true }).click();
  await page.getByRole("button", { name: "Confirm entry deletion", exact: true }).click();
  const empty = (await copy(page)).raw;
  expect(empty).toBe(raw.replace(loneEntry, ""));
  await expect(page.getByRole("button", { name: "New entry", exact: true })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await open(page, "dictionary", empty, false);
  await expect(page.getByRole("tab", { name: "Entries", exact: true })).toHaveAttribute("aria-selected", "false");
  await page.getByRole("tab", { name: "Entries", exact: true }).click();
  await page.getByRole("button", { name: "New entry", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "New entry encoding", exact: true })).toHaveValue("");
  await page.getByRole("textbox", { name: "New headword or heading", exact: true }).fill("An explicitly chosen article");
  await page.getByRole("textbox", { name: "New definition or article text", exact: true }).fill("Supplied article text.");
  await page.getByRole("button", { name: "Create entry", exact: true }).click();
  expect((await copy(page)).raw).toBe(empty);
  await page.getByRole("combobox", { name: "New entry encoding", exact: true }).selectOption("articles");
  await page.getByRole("button", { name: "Create entry", exact: true }).click();
  expect((await copy(page)).raw).toBe(empty.replace("<body>", '<body><div type="entry" xml:id="entry"><head>An explicitly chosen article</head><p>Supplied article text.</p></div>'));
  expect(errors).toEqual([]);
});

test("duplicate XML attributes refuse mutations and encoded URI fragments retain reference protection", async ({ page }) => {
  const errors = errorsFor(page);
  const raw = sources.dictionary.replace("xml:id='term_01'", "xml:id='term_01' xml:id='other'")
    .replace("<entry xml:id='term_03'>", "<entry xml:id='term_03' xml:lang='de' xml:lang='en'>");
  await open(page, "dictionary", raw);
  await select(page, "term_01");
  await expect(page.locator(".ed-entry-workspace")).toContainText("The entry target is missing, ambiguous");
  await expect(page.getByRole("form", { name: "Entry details", exact: true })).toHaveCount(0);
  expect((await copy(page)).raw).toBe(raw);
  await select(page, "term_03");
  await page.getByRole("textbox", { name: "Entry language", exact: true }).fill("la");
  await page.getByRole("button", { name: "Apply entry", exact: true }).click();
  await expect(page.locator("#ed-status")).toContainText("attribute target is ambiguous");
  const pending = await copy(page);
  expect(pending.raw).toBe(raw);
  expect(pending.staged.value.fields.language).toBe("la");
  await page.getByRole("form", { name: "Entry details", exact: true }).getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Duplicate entry", exact: true }).click();
  await expect(page.locator("#ed-status")).toContainText("ambiguous duplicate attributes");
  expect((await copy(page)).raw).toBe(raw);
  const encoded = sources.dictionary.replace("target='#detail_01 #term_02'", "target='#detail_%30%31 #term_02'")
    .replace("target='#term_01'", "target='#term_%30%31'");
  await open(page, "dictionary", encoded);
  await page.getByRole("button", { name: "Preview deletion", exact: true }).click();
  await expect(page.getByRole("region", { name: "Deletion preview", exact: true })).toContainText("Deletion blocked: 1 reference");
  await page.getByRole("button", { name: "Duplicate entry", exact: true }).click();
  const cloned = (await copy(page)).raw;
  expect(cloned).toContain("target='#detail_01-copy #term_02'");
  expect(cloned).toContain("target='#detail_%30%31 #term_02'");
  await page.getByRole("button", { name: "Follow #term_02", exact: true }).click();
  await page.getByRole("button", { name: "Follow #term_01", exact: true }).click();
  await expect(page.getByRole("form", { name: "Entry details", exact: true })).toContainText("Dictionary entry: term_01");
  expect(errors).toEqual([]);
});
