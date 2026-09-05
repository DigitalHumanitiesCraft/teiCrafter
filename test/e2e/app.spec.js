import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const fixturePath = fileURLToPath(new URL("./fixtures/browser-smoke.xml", import.meta.url));
const sourceProfileFixtureUrl = new URL("../fixtures-synthetic/source-profiles/", import.meta.url);
const urfehdePath = process.env.UFBAS_TEI || "";
const markupProgressXml = `<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <teiHeader><fileDesc><titleStmt><title>Markup progress</title></titleStmt><publicationStmt><p>Test</p></publicationStmt><sourceDesc><p>Test</p></sourceDesc></fileDesc></teiHeader>
  <text><body>
    <pb n="1"/><p><persName ref="#person-1">Ada</persName> plain text</p>
    <pb n="2"/><p><w xml:id="noted-word">noted</w> text</p>
    <pb n="3"/><p>plain text</p>
  </body></text>
  <standOff><listPerson><person xml:id="person-1"><persName>Ada</persName></person></listPerson><note target="#noted-word">Check this reading.</note></standOff>
</TEI>`;
const noteFreeProgressXml = `<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <teiHeader><fileDesc><titleStmt><title>No notes</title></titleStmt><publicationStmt><p>Test</p></publicationStmt><sourceDesc><p>Test</p></sourceDesc></fileDesc></teiHeader>
  <text><body><pb n="1"/><p>first</p><pb n="2"/><p>second</p></body></text>
</TEI>`;

const sourceProfileCases = [
  {
    file: "dictionary-paginated.xml",
    pager: ["entry 1/2 (apple)", "entry 2/2 (archive)"],
    primary: "Entries",
    units: 2,
    facsimile: "Milestone Surface",
    structures: ["Pages", "Entries", "Facsimile Resource", "Logical Flow", "Header Metadata"],
    channels: [["Pages", 2], ["Entries", 2], ["Facsimile surfaces", 2], ["Document", 1]],
  },
  {
    file: "drama-paginated.xml",
    pager: ["speech turn 1/3 (Before turn 1)", "speech turn 2/3 (The Archivist)"],
    primary: "Speech turns",
    units: 3,
    facsimile: "Milestone Surface",
    structures: [
      "Pages",
      "Speech Turns",
      "Dramatic Context",
      "Facsimile Resource",
      "Logical Flow",
      "Header Metadata",
    ],
    channels: [
      ["Pages", 3],
      ["Speech turns", 3],
      ["Sections", 1],
      ["Facsimile surfaces", 2],
      ["Document", 1],
    ],
  },
  {
    file: "spoken-corpus.xml",
    pager: ["corpus member 1/2 (interview-1)", "corpus member 2/2 (interview-2)"],
    primary: "Corpus members",
    units: 2,
    facsimile: "None",
    structures: ["Corpus Members", "Speech Turns", "Token Analysis", "Logical Flow", "Header Metadata"],
    channels: [["Corpus members", 2], ["Speech turns", 3], ["Document", 1]],
  },
  {
    file: "correspondence.xml",
    pager: ["section 1/1 (letter-1)"],
    primary: "Sections",
    units: 1,
    facsimile: "None",
    structures: ["Correspondence Metadata", "Logical Flow", "Header Metadata"],
    channels: [["Sections", 1], ["Document", 1]],
  },
  {
    file: "critical-edition.xml",
    pager: ["section 1/1 (edition-text)"],
    primary: "Sections",
    units: 1,
    facsimile: "None",
    structures: ["Apparatus", "Logical Flow", "Header Metadata"],
    channels: [["Sections", 1], ["Document", 1]],
  },
  {
    file: "facsimile-only.xml",
    pager: ["surface 1/2 (1)", "surface 2/2 (2)"],
    primary: "Facsimile surfaces",
    units: 2,
    facsimile: "Surface",
    structures: ["Facsimile Resource", "Header Metadata"],
    channels: [["Facsimile surfaces", 2], ["Document", 1]],
    note: "The TEI contains facsimile surfaces but no projected reading text.",
  },
  {
    file: "source-document.xml",
    pager: ["source document 1/1"],
    primary: "Source documents",
    units: 1,
    facsimile: "Source Doc",
    structures: ["Facsimile Resource", "Source Document", "Header Metadata"],
    channels: [["Source documents", 1], ["Facsimile surfaces", 2], ["Document", 1]],
    note: "The TEI contains facsimile surfaces but no projected reading text.",
  },
  {
    file: "mixed-capabilities.xml",
    pager: ["entry 1/1 (record)"],
    primary: "Entries",
    units: 1,
    facsimile: "Milestone Surface",
    structures: [
      "Pages",
      "Entries",
      "Speech Turns",
      "Token Analysis",
      "Correspondence Metadata",
      "Apparatus",
      "Facsimile Resource",
      "Tabular",
      "Logical Flow",
      "Header Metadata",
    ],
    channels: [
      ["Pages", 1],
      ["Entries", 1],
      ["Speech turns", 2],
      ["Table rows", 3],
      ["Sections", 2],
      ["Facsimile surfaces", 1],
      ["Document", 1],
    ],
    note: "Dictionary-entry and speech-turn structures are both present.",
  },
];

async function monitorRuntime(page) {
  const pageErrors = [];
  const cspConsoleErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (
      message.type() === "error"
      && /content security policy|refused to|blocked by csp/i.test(message.text())
    ) {
      cspConsoleErrors.push(message.text());
    }
  });
  await page.addInitScript(() => {
    window.__e2eCspViolations = [];
    document.addEventListener("securitypolicyviolation", (event) => {
      window.__e2eCspViolations.push({
        directive: event.violatedDirective,
        blocked: event.blockedURI,
      });
    });
  });
  return async () => {
    const policyViolations = await page.evaluate(() => window.__e2eCspViolations || []);
    expect(pageErrors, "uncaught browser errors").toEqual([]);
    expect(cspConsoleErrors, "CSP console errors").toEqual([]);
    expect(policyViolations, "securitypolicyviolation events").toEqual([]);
  };
}

async function expectA11ySmoke(page) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const serious = result.violations
    .filter((violation) => violation.impact === "critical" || violation.impact === "serious")
    .flatMap((violation) => violation.nodes
      .map((node) => ({
        id: violation.id,
        impact: violation.impact,
        target: node.target,
      })));
  expect(serious, "serious or critical Axe findings").toEqual([]);
}

async function loadWenzelsbibel(page) {
  await page.route("**/data/editor/wb-codex/codex-2759.xml", (route) => (
    route.fulfill({ status: 404, contentType: "application/xml", body: "" })
  ));
  await page.goto("/index.html");
  await page.getByRole("link", { name: /Wenzelsbibel/ }).click();
  await expect(page).toHaveURL(/editor\.html#example=wb$/);
  await expect(page.locator("#ed-docstrip")).toBeVisible();
  await expect(page.locator("#ed-folio-label")).toContainText("page 1/20");
}

async function loadSyntheticFile(page) {
  await page.addInitScript(() => {
    Object.defineProperty(window, "showOpenFilePicker", {
      value: undefined,
      configurable: true,
    });
  });
  await page.goto("/editor.html");
  await page.locator("#btn-load").click();
  const chooserPromise = page.waitForEvent("filechooser");
  await page.locator("#menu-open").click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: "browser-smoke.xml",
    mimeType: "application/xml",
    buffer: readFileSync(fixturePath),
  });
  await expect(page.locator("#ed-docstrip")).toContainText("browser-smoke.xml");
}

async function openXmlBuffer(page, name, xml) {
  await page.locator("#btn-load").click();
  const chooserPromise = page.waitForEvent("filechooser");
  await page.locator("#menu-open").click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name,
    mimeType: "application/xml",
    buffer: Buffer.from(xml),
  });
  await expect(page.locator("#ed-docstrip")).toContainText(name);
}

async function useSessionSchema(page, name, text) {
  if (await page.locator("#ed-val-pop").getAttribute("hidden") !== null) {
    await page.locator("#ed-val-chip").click();
  }
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Use session schema..." }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name,
    mimeType: "application/xml",
    buffer: Buffer.from(text),
  });
  await expect(page.locator("#ed-val-pop")).toContainText(name);
}

async function downloadedBytes(download) {
  const path = await download.path();
  if (!path) throw new Error("Playwright did not provide a local path for the completed download.");
  return readFileSync(path);
}

async function historyControlState(page) {
  return page.locator("#btn-undo, #btn-redo").evaluateAll((buttons) => buttons.map((button) => ({
    disabled: button.disabled,
    ariaLabel: button.getAttribute("aria-label"),
  })));
}

async function expectInsideViewport(page, locator) {
  const boxes = await locator.evaluateAll((nodes) => nodes.map((node) => {
    const bounds = node.getBoundingClientRect();
    return {
      left: bounds.left,
      top: bounds.top,
      right: bounds.right,
      bottom: bounds.bottom,
    };
  }));
  expect(boxes.length).toBeGreaterThan(0);
  for (const box of boxes) {
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.top).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));
    expect(box.bottom).toBeLessThanOrEqual(await page.evaluate(() => window.innerHeight));
  }
}

async function selectReadingText(page, needle) {
  await page.locator("#ed-reading .ed-w").filter({ hasText: needle }).first()
    .evaluate((span, selectedText) => {
    const walker = document.createTreeWalker(span, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node && !node.data.includes(selectedText)) node = walker.nextNode();
    if (!node) throw new Error(`Could not find ${selectedText} in one rendered text node.`);
    const start = node.data.indexOf(selectedText);
    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, start + selectedText.length);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    span.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, detail: 1 }));
    }, needle);
  await expect(page.locator("#ed-sel-pop")).toBeVisible();
}

async function loadSourceProfileFixture(page, fixture) {
  await page.addInitScript(() => {
    Object.defineProperty(window, "showOpenFilePicker", {
      value: undefined,
      configurable: true,
    });
  });
  await page.goto("/editor.html");
  await page.locator("#btn-load").click();
  const chooserPromise = page.waitForEvent("filechooser");
  await page.locator("#menu-open").click();
  const chooser = await chooserPromise;
  await chooser.setFiles(fileURLToPath(new URL(fixture.file, sourceProfileFixtureUrl)));
  await expect(page.locator("#ed-docstrip")).toContainText(fixture.file);
}

async function sourcePanelSection(panel, name) {
  const heading = panel.getByRole("heading", { name, exact: true });
  await expect(heading).toBeVisible();
  return heading.locator("..");
}

for (const fixture of sourceProfileCases) {
  test(`source profile UI matrix: ${fixture.file}`, async ({ page }) => {
    const expectRuntimeClean = await monitorRuntime(page);
    await loadSourceProfileFixture(page, fixture);

    const pager = page.locator("#ed-folio-label");
    await expect(pager).toHaveText(fixture.pager[0]);
    if (fixture.units > 1) {
      await expect(page.locator("#btn-next")).toBeEnabled();
      await page.locator("#btn-next").click();
      await expect(pager).toHaveText(fixture.pager[1]);
      await expect(page.locator("#btn-prev")).toBeEnabled();
      await page.locator("#btn-prev").click();
      await expect(pager).toHaveText(fixture.pager[0]);
    } else {
      await expect(page.locator("#btn-prev")).toBeDisabled();
      await expect(page.locator("#btn-next")).toBeDisabled();
    }

    await page.getByRole("tab", { name: "Source", exact: true }).click();
    const panel = page.locator("#ed-panel-source");
    await expect(panel).toBeVisible();
    expect(await panel.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);

    const summary = await sourcePanelSection(panel, "Source model");
    const summaryRows = summary.locator(".ed-kv");
    await expect(summaryRows).toHaveCount(3);
    expect(await summaryRows.locator(".ed-kv-value").evaluateAll((nodes) => nodes.every((node) => {
      const bounds = node.getBoundingClientRect();
      const panelBounds = document.querySelector("#ed-panel-source").getBoundingClientRect();
      return bounds.left >= panelBounds.left && bounds.right <= panelBounds.right + 1;
    }))).toBe(true);
    await expect(summaryRows.nth(0).locator("b")).toHaveText("Primary navigation");
    await expect(summaryRows.nth(0)).toContainText(fixture.primary);
    await expect(summaryRows.nth(1).locator("b")).toHaveText("Units");
    await expect(summaryRows.nth(1)).toContainText(String(fixture.units));
    await expect(summaryRows.nth(2).locator("b")).toHaveText("Facsimile model");
    await expect(summaryRows.nth(2)).toContainText(fixture.facsimile);

    const structures = await sourcePanelSection(panel, "Detected structures");
    await expect(structures.locator(".ed-val-chip")).toHaveText(fixture.structures);

    const navigation = await sourcePanelSection(panel, "Available navigation");
    const navigationRows = navigation.locator(".ed-kv");
    await expect(navigationRows).toHaveCount(fixture.channels.length);
    await expect(navigationRows.locator("b")).toHaveText(
      fixture.channels.map(([label]) => label),
    );
    for (let index = 0; index < fixture.channels.length; index++) {
      const [label, count] = fixture.channels[index];
      const suffix = label === fixture.primary ? " (primary)" : "";
      await expect(navigationRows.nth(index)).toContainText(
        `${count} unit${count === 1 ? "" : "s"}${suffix}`,
      );
    }

    const noteHeading = panel.getByRole("heading", { name: "Profile notes", exact: true });
    if (fixture.note) {
      await expect(noteHeading).toBeVisible();
      await expect(noteHeading.locator("..")).toContainText(fixture.note);
    } else {
      await expect(noteHeading).toHaveCount(0);
    }
    await expectRuntimeClean();
  });
}

test("Markup progress filters note-bearing units without changing document state", async ({ page }) => {
  const expectRuntimeClean = await monitorRuntime(page);
  await page.addInitScript(() => {
    Object.defineProperty(window, "showOpenFilePicker", {
      value: undefined,
      configurable: true,
    });
  });
  await page.goto("/editor.html");
  await openXmlBuffer(page, "markup-progress.xml", markupProgressXml);

  await expect(page.locator("#ed-ann-summary")).toHaveText("Markup 2/3");
  await page.locator("#ed-ann-summary").click();
  await expect(page.locator("#ed-ann-filter-all")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#ed-ann-pages .ed-ann-page")).toHaveCount(2);
  const boundedPopover = page.locator(
    "#ed-ann-popover, #ed-ann-filter-all, #ed-ann-filter-notes",
  );
  await expectInsideViewport(page, boundedPopover);
  await page.setViewportSize({ width: 480, height: 720 });
  await expectInsideViewport(page, boundedPopover);
  await page.setViewportSize({ width: 1280, height: 720 });
  await expectInsideViewport(page, boundedPopover);

  await page.locator("#ed-ann-filter-notes").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#ed-ann-filter-notes")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#ed-ann-caption")).toHaveText("1 of 3 pages contain notes.");
  await expect(page.locator("#ed-ann-pages .ed-ann-page")).toHaveCount(1);
  await expect(page.locator("#ed-ann-pages .ed-ann-page")).toHaveAttribute(
    "aria-label",
    "Go to annotated page 2",
  );
  await expect(page.locator("#ed-ann-summary")).toHaveText("Markup 2/3");
  await expect(page.locator(".ed-docstrip-name")).not.toHaveClass(/dirty/);
  await expect(page.locator("#btn-undo")).toBeDisabled();

  await page.locator("#view-xml").click();
  const source = page.locator(".ed-src-ta");
  const originalPageSource = await source.inputValue();
  const historyBeforeStaging = await historyControlState(page);
  await page.locator("#ed-ann-summary").click();
  await expect(page.locator("#ed-ann-filter-notes")).toHaveAttribute("aria-pressed", "true");
  expect(await source.inputValue()).toBe(originalPageSource);

  const stagedPageSource = originalPageSource.replace("plain text", "staged text");
  await source.fill(stagedPageSource);
  await page.getByRole("button", { name: "Go to annotated page 2" }).click();
  await expect(page.locator("#ed-folio-label")).toContainText("page 1/3");
  await expect(page.locator("#ed-status")).toContainText("Apply or cancel the staged XML");
  await expect(page.locator("#ed-reading .ed-note-target")).toHaveCount(0);
  await expect(source).toHaveValue(stagedPageSource);
  expect(await historyControlState(page)).toEqual(historyBeforeStaging);

  await page.getByRole("button", { name: "Cancel" }).click();
  await page.locator("#view-reading").click();
  await page.locator("#ed-ann-summary").click();
  await page.getByRole("button", { name: "Go to annotated page 2" }).click();
  await expect(page.locator("#ed-folio-label")).toContainText("page 2/3");
  let focusedNote = page.locator("#ed-reading .ed-note-target");
  await expect(focusedNote).toHaveCount(1);
  await expect(focusedNote).toHaveClass(/has-note/);
  expect(await focusedNote.evaluate((node) => document.activeElement === node)).toBe(true);
  await page.keyboard.press("Tab");
  await expect(page.locator("#ed-reading .ed-note-target")).toHaveCount(0);

  await page.locator("#btn-prev").click();
  await page.locator("#btn-viewmode").click();
  await expect(page.locator("#btn-viewmode")).toHaveAttribute("aria-pressed", "true");
  await page.locator("#ed-ann-summary").click();
  await page.getByRole("button", { name: "Go to annotated page 2" }).click();
  focusedNote = page.locator("#ed-reading .ed-note-target");
  await expect(focusedNote).toHaveCount(1);
  await expect(focusedNote).toHaveClass(/has-note/);
  await expect(focusedNote).toHaveAttribute("data-folio", "1");
  expect(await focusedNote.evaluate((node) => document.activeElement === node)).toBe(true);
  await page.keyboard.press("Tab");
  await expect(page.locator("#ed-reading .ed-note-target")).toHaveCount(0);
  await expect(page.locator(".ed-docstrip-name")).not.toHaveClass(/dirty/);
  await expect(page.locator("#btn-undo")).toBeDisabled();

  const downloadPromise = page.waitForEvent("download", { timeout: 60_000 });
  await page.locator("#btn-download").click();
  const downloaded = await downloadedBytes(await downloadPromise);
  expect(downloaded.equals(Buffer.from(markupProgressXml))).toBe(true);

  await page.locator("#btn-viewmode").click();
  await page.locator("#btn-prev").click();
  await page.locator("#ed-ann-summary").click();
  await page.evaluate(() => {
    const result = document.querySelector('[aria-label="Go to annotated page 2"]');
    if (!result) throw new Error("Could not find the note-bearing page result.");
    const nativeAnimationFrame = window.requestAnimationFrame.bind(window);
    let queuedCallback = null;
    window.requestAnimationFrame = (callback) => {
      queuedCallback = callback;
      return 1;
    };
    try {
      result.click();
    } finally {
      window.requestAnimationFrame = nativeAnimationFrame;
    }
    if (!queuedCallback) throw new Error("Markup navigation did not queue its focus callback.");
    window.__flushStaleMarkupNavigation = () => queuedCallback(performance.now());
  });
  await openXmlBuffer(page, "replacement.xml", markupProgressXml);
  await expect(page.locator("#ed-ann-filter-all")).toHaveAttribute("aria-pressed", "true");
  await page.locator("#btn-viewmode").click();
  await page.evaluate(() => {
    const flush = window.__flushStaleMarkupNavigation;
    delete window.__flushStaleMarkupNavigation;
    flush();
  });
  await expect(page.locator("#ed-reading .ed-note-target")).toHaveCount(0);
  expect(await page.evaluate(() => document.activeElement?.classList.contains("has-note"))).toBe(false);

  await openXmlBuffer(page, "note-free.xml", noteFreeProgressXml);
  await page.locator("#ed-ann-summary").click();
  await expect(page.locator("#ed-ann-filter-all")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#ed-ann-filter-notes")).toHaveAttribute("aria-pressed", "false");
  await page.locator("#ed-ann-filter-notes").click();
  await expect(page.locator("#ed-ann-pages .ed-ann-empty")).toHaveText(
    "No notes were detected in this document.",
  );

  await page.keyboard.press("Escape");
  await page.locator("#view-xml").click();
  const noteFreeSource = page.locator(".ed-src-ta");
  const inlineNoteSource = (await noteFreeSource.inputValue()).replace(
    "<p>first</p>",
    "<p><note>first</note></p>",
  );
  await noteFreeSource.fill(inlineNoteSource);
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.locator("#ed-ann-summary")).toHaveText("Markup 1/2");
  await page.locator("#ed-ann-summary").click();
  await expect(page.locator("#ed-ann-filter-notes")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#ed-ann-pages .ed-ann-page")).toHaveCount(1);

  const historyAfterEdit = await historyControlState(page);
  expect(historyAfterEdit[0].disabled).toBe(false);
  expect(historyAfterEdit[0].ariaLabel).toMatch(/^Undo /);
  expect(historyAfterEdit[1].disabled).toBe(true);
  await page.locator("#ed-ann-filter-all").click();
  await page.locator("#ed-ann-filter-notes").click();
  expect(await historyControlState(page)).toEqual(historyAfterEdit);

  await page.getByRole("button", { name: "Go to annotated page 1" }).click();
  const focusedInlineNote = page.locator("#ed-reading .ed-note-target");
  await expect(focusedInlineNote).toHaveCount(1);
  await expect(focusedInlineNote).toContainText("first");
  expect(await focusedInlineNote.evaluate((node) => document.activeElement === node)).toBe(true);
  await page.keyboard.press("Tab");
  await expect(page.locator("#ed-reading .ed-note-target")).toHaveCount(0);
  await page.locator("#btn-undo").click();
  await expect(page.locator("#ed-ann-summary")).toHaveText("Markup 0/2");
  await page.locator("#ed-ann-summary").click();
  await expect(page.locator("#ed-ann-filter-notes")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#ed-ann-pages .ed-ann-empty")).toHaveText(
    "No notes were detected in this document.",
  );
  const historyAfterUndo = await historyControlState(page);
  expect(historyAfterUndo[1].disabled).toBe(false);
  expect(historyAfterUndo[1].ariaLabel).toMatch(/^Redo /);
  await page.locator("#ed-ann-filter-all").click();
  await page.locator("#ed-ann-filter-notes").click();
  expect(await historyControlState(page)).toEqual(historyAfterUndo);
  await expectA11ySmoke(page);
  await expectRuntimeClean();
});

test("discontinuous range collector persists two segments as valid TEI stand-off", async ({ page }) => {
  test.setTimeout(90_000);
  const expectRuntimeClean = await monitorRuntime(page);
  await loadSyntheticFile(page);

  await selectReadingText(page, "deterministic");
  await page.getByRole("button", { name: "add another segment", exact: true }).click();
  await expect(page.locator("#ed-status")).toContainText(
    "1 segment collected. Select the next segment and annotate it",
  );

  await selectReadingText(page, "browser");
  await expect(page.locator(".ed-sel-pop-title")).toHaveText("annotate 2 segments");
  await page.getByRole("button", { name: "new person", exact: true }).click();
  await expect(page.locator("#ed-status")).toContainText("Annotated");

  const downloadPromise = page.waitForEvent("download", { timeout: 60_000 });
  await page.locator("#btn-download").click();
  const output = (await downloadedBytes(await downloadPromise)).toString("utf8");
  expect(output).toMatch(/<spanGrp\b[^>]*\btype="entity"/);
  expect(output.match(/<span\b/g) || []).toHaveLength(2);
  expect(output).toContain('ana="#pers_deterministic"');
  expect(output).toContain("deterministic");
  expect(output).toContain("browser");
  await expect(page.locator("#ed-val-chip")).toHaveText("schema and structural checks passed");
  await expectRuntimeClean();
});

test("range collector stays cancellable after an overlapping second selection", async ({ page }) => {
  test.setTimeout(90_000);
  const expectRuntimeClean = await monitorRuntime(page);
  await loadSyntheticFile(page);

  await selectReadingText(page, "deterministic");
  await page.getByRole("button", { name: "add another segment", exact: true }).click();
  expect(await page.evaluate(() => (
    typeof Highlight === "undefined" || CSS.highlights.has("ed-collected")
  ))).toBe(true);

  await selectReadingText(page, "deterministic");
  await expect(page.locator("#ed-status")).toContainText(
    "Collected segments must be separate, non-overlapping reading ranges.",
  );
  await expect(page.getByRole("button", { name: "clear collected segments", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "clear collected segments", exact: true }).click();
  await expect(page.locator("#ed-status")).toHaveText("Collected segments cleared.");
  expect(await page.evaluate(() => (
    typeof Highlight === "undefined" || !CSS.highlights.has("ed-collected")
  ))).toBe(true);

  await selectReadingText(page, "browser");
  await page.getByRole("button", { name: "add another segment", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.locator("#ed-status")).toHaveText("Collected segments cleared.");
  const downloadPromise = page.waitForEvent("download", { timeout: 60_000 });
  await page.locator("#btn-download").click();
  expect((await downloadedBytes(await downloadPromise)).equals(readFileSync(fixturePath))).toBe(true);
  await expectRuntimeClean();
});

test("overlapping entity layers can be inspected, relinked and removed safely", async ({ page }) => {
  test.setTimeout(90_000);
  const expectRuntimeClean = await monitorRuntime(page);
  await loadSyntheticFile(page);

  await selectReadingText(page, "deterministic");
  await page.getByRole("button", { name: "new person", exact: true }).click();
  await expect(page.locator("#ed-status")).toContainText("Annotated");
  await page.keyboard.press("Escape");

  await selectReadingText(page, "deterministic");
  await page.getByRole("button", { name: "new place", exact: true }).click();
  await expect(page.locator("#ed-status")).toContainText("Annotated");

  const annotatedCell = page.locator("#ed-reading .ed-w").filter({ hasText: "deterministic" }).first();
  await annotatedCell.click({ button: "right" });
  await page.getByRole("button", { name: "Edit annotation...", exact: true }).click();
  await expect(page.locator(".ed-sel-pop-title")).toContainText("annotations on");
  await expect(page.getByRole("button", { name: "relink", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "remove annotation", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "edit attributes", exact: true })).toHaveCount(1);

  await page.getByRole("button", { name: "relink", exact: true }).click();
  await page.getByRole("button", { name: "deterministic (person)", exact: true }).click();
  await expect(page.locator("#ed-status")).toContainText("Relinked stand-off annotation");

  await page.locator("#ed-reading .ed-w").filter({ hasText: "deterministic" }).first().click();
  await page.getByRole("button", { name: "remove annotation", exact: true }).click();
  await expect(page.locator("#ed-status")).toContainText("Removed stand-off annotation");

  const downloadPromise = page.waitForEvent("download", { timeout: 60_000 });
  await page.locator("#btn-download").click();
  const output = (await downloadedBytes(await downloadPromise)).toString("utf8");
  expect(output).not.toContain("<spanGrp");
  expect(output).not.toContain("<anchor");
  expect(output).toMatch(/<name\b[^>]*ref="#pers_deterministic"[^>]*>deterministic<\/name>/);
  await expect(page.locator("#ed-val-chip")).toHaveText("schema and structural checks passed");
  await expectRuntimeClean();
});

test("start page and editor workflow stay deterministic", async ({ browserName, page }) => {
  const expectRuntimeClean = await monitorRuntime(page);
  await page.goto("/index.html");
  await expect(page.getByRole("heading", { name: "A browser editor for TEI-XML" })).toBeVisible();
  await expect(page.locator("#examples")).toBeVisible();

  await page.getByRole("link", { name: "About", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "About teiCrafter" })).toBeVisible();
  await page.goBack();
  await loadWenzelsbibel(page);

  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#ed-folio-label")).toContainText("page 2/20");
  await page.locator("#btn-next").click();
  await expect(page.locator("#ed-folio-label")).toContainText("page 3/20");

  await page.keyboard.press("Control+\\");
  await expect(page.locator("#ed-main")).toHaveClass(/right-collapsed/);
  await page.keyboard.press("Control+\\");
  await expect(page.locator("#ed-main")).not.toHaveClass(/right-collapsed/);

  if (browserName === "chromium") {
    await page.locator("#ed-val-chip").click();
    await page.getByRole("button", { name: "Validate schema" }).click();
    await expect(page.locator("#ed-val-pop")).toContainText(/TEI P5 4\.11\.0 \(TEI All\): valid/, {
      timeout: 30_000,
    });
    await page.keyboard.press("Escape");
  }

  await page.locator("#view-xml").click();
  const source = page.locator(".ed-src-ta");
  await expect(source).toBeVisible();
  await page.getByRole("button", { name: "Check XML" }).click();
  await expect(page.locator(".ed-src-result")).toHaveText("well-formed");
  const originalSource = await source.inputValue();
  const stagedSource = originalSource.replace("<pb ", '<pb rend="e2e" ');
  expect(stagedSource).not.toBe(originalSource);
  await source.fill(stagedSource);
  await page.locator("#view-metadata").click();
  await expect(page.locator("#view-xml")).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#ed-status")).toContainText("Apply or cancel the staged XML");
  await page.getByRole("button", { name: "Cancel" }).click();

  await page.locator("#view-metadata").click();
  const metadataInput = page.locator(".ed-meta-form input").first();
  await expect(metadataInput).toBeVisible();
  const title = await metadataInput.inputValue();
  await metadataInput.fill(`${title} E2E`);
  await page.locator("#view-reading").click();
  await expect(page.locator("#view-metadata")).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#ed-status")).toContainText("Apply or reset the staged metadata");
  await page.locator(".ed-meta-root").getByRole("button", { name: "Apply" }).click();
  await expect(page.locator("#ed-status")).toContainText("Metadata fields applied");

  await page.locator("#btn-load").click();
  const exampleDialogPromise = page.waitForEvent("dialog");
  const exampleClick = page.locator('[data-example="zbz"]').click();
  const exampleDialog = await exampleDialogPromise;
  expect(exampleDialog.type()).toBe("confirm");
  await exampleDialog.dismiss();
  await exampleClick;
  await expect(page.locator("#ed-folio-label")).toContainText("page 3/20");

  const navigationDialogPromise = page.waitForEvent("dialog");
  const navigationClick = page.locator(".ed-logo").click();
  const navigationDialog = await navigationDialogPromise;
  expect(navigationDialog.type()).toBe("beforeunload");
  await navigationDialog.dismiss();
  await navigationClick;
  await expect(page).toHaveURL(/editor\.html/);

  await expectA11ySmoke(page);
  await expectRuntimeClean();
  const landingPage = await page.context().newPage();
  await landingPage.goto("/index.html");
  await expectA11ySmoke(landingPage);
  await landingPage.close();
});

test("local OpenSeadragon and uploaded synthetic TEI work without CSP violations", async ({ page }) => {
  const expectRuntimeClean = await monitorRuntime(page);
  await page.addInitScript(() => {
    Object.defineProperty(window, "showOpenFilePicker", {
      value: undefined,
      configurable: true,
    });
  });
  const localRequests = [];
  page.on("response", (response) => {
    if (/openseadragon|min\.js|editor-screenshot\.png/.test(response.url())) {
      localRequests.push({ url: response.url(), status: response.status() });
    }
  });
  await page.goto("/editor.html");
  await page.locator("#btn-load").click();
  const chooserPromise = page.waitForEvent("filechooser");
  await page.locator("#menu-open").click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: "browser-smoke.xml",
    mimeType: "application/xml",
    buffer: readFileSync(fixturePath),
  });

  await expect(page.locator("#ed-docstrip")).toContainText("browser-smoke.xml");
  await expect(page.locator("#ed-folio-label")).toContainText("page 1/1");
  await expect(page.locator("#ed-osd .openseadragon-container")).toBeVisible();
  await expect.poll(() => localRequests.some((request) => request.url.endsWith("/assets/editor-screenshot.png") && request.status === 200)).toBe(true);
  expect(await page.evaluate(() => typeof window.OpenSeadragon)).toBe("function");
  expect(localRequests.some((request) => request.url.includes("/vendor/openseadragon/") && request.status === 200)).toBe(true);

  await page.locator("#view-xml").click();
  const source = page.locator(".ed-src-ta");
  const xml = await source.inputValue();
  await source.fill(xml.replace("deterministic browser", "deterministic edited browser"));
  await source.press("Control+Enter");
  await expect(page.locator("#view-reading")).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#ed-status")).toContainText("applied to the complete document");
  await expect(page.locator("#ed-reading")).toContainText("deterministic edited browser");
  await expect(page.locator("#btn-undo")).toBeEnabled();
  await page.locator("#btn-undo").click();
  await expect(page.locator("#ed-reading")).not.toContainText("deterministic edited browser");
  await expect(page.locator("#btn-redo")).toBeEnabled();
  await page.keyboard.press("Control+Shift+Z");
  await expect(page.locator("#ed-reading")).toContainText("deterministic edited browser");
  await page.keyboard.press("Control+Z");
  await expect(page.locator("#ed-reading")).not.toContainText("deterministic edited browser");
  await expect(page.locator(".ed-docstrip-name")).not.toHaveClass(/dirty/);

  await expectA11ySmoke(page);
  await expectRuntimeClean();
});

test("raw Schematron blocks output for stale, invalid and unavailable results", async ({ page }) => {
  const expectRuntimeClean = await monitorRuntime(page);
  await loadSyntheticFile(page);
  const schematron = `<?xml version="1.0"?>
<schema xmlns="http://purl.oclc.org/dsdl/schematron" queryBinding="xslt1">
  <ns prefix="tei" uri="http://www.tei-c.org/ns/1.0"/>
  <pattern id="current-text">
    <rule context="tei:body//tei:p">
      <assert test="contains(string(.), 'deterministic browser')">The current body must retain the approved phrase.</assert>
    </rule>
  </pattern>
</schema>`;
  await useSessionSchema(page, "current-text.sch", schematron);
  await expect(page.locator("#ed-val-pop")).toContainText(
    "Raw Schematron runs browser XPath 1.0 (xslt/xslt1) for common child/attribute rule contexts",
  );
  await expect(page.locator("#ed-val-pop")).toContainText(
    "advanced match patterns, node-set lets and XPath 2.0+ require compiled XSLT",
  );
  await page.getByRole("button", { name: "Validate schema set" }).click();
  await expect(page.locator("#ed-val-pop")).toContainText("current-text.sch: valid");

  await page.locator("#view-xml").click();
  const source = page.locator(".ed-src-ta");
  await source.fill((await source.inputValue()).replace("deterministic browser", "changed browser"));
  await source.press("Control+Enter");
  await expect(page.locator("#ed-val-chip")).toHaveText("structural checks passed");

  const downloads = [];
  page.on("download", (download) => downloads.push(download.suggestedFilename()));
  await page.locator("#btn-download").click();
  await expect(page.locator("#ed-status")).toContainText(
    "Download blocked for the current revision because every configured schema must return valid",
    { timeout: 30_000 },
  );
  expect(downloads).toEqual([]);
  await expect(page.locator("#ed-val-pop")).toContainText("current-text.sch: invalid");
  await expect(page.locator("#ed-val-pop")).toContainText("The current body must retain the approved phrase.");

  const xpath2 = schematron.replace('queryBinding="xslt1"', 'queryBinding="xslt2"');
  await useSessionSchema(page, "xpath2.sch", xpath2);
  await page.locator("#btn-download").click();
  await expect(page.locator("#ed-status")).toContainText(
    "Download blocked for the current revision because every configured schema must return valid",
    { timeout: 30_000 },
  );
  expect(downloads).toEqual([]);
  await expect(page.locator("#ed-val-pop")).toContainText("xpath2.sch: unavailable");
  await expect(page.locator("#ed-val-pop")).toContainText(
    'queryBinding="xslt2" is unavailable in the browser',
  );

  const nonSvrl = `<?xml version="1.0"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0">
  <xsl:template match="/"><not-a-schematron-report/></xsl:template>
</xsl:stylesheet>`;
  await useSessionSchema(page, "non-svrl.xsl", nonSvrl);
  await expect(page.locator("#ed-val-pop")).toContainText(
    "Compiled Schematron runs through the browser XSLT processor",
  );
  await page.locator("#btn-download").click();
  await expect(page.locator("#ed-status")).toContainText(
    "Download blocked for the current revision because every configured schema must return valid",
    { timeout: 30_000 },
  );
  expect(downloads).toEqual([]);
  await expect(page.locator("#ed-val-pop")).toContainText("non-svrl.xsl: unavailable");
  await expect(page.locator("#ed-val-pop")).toContainText(
    "did not produce an SVRL schematron-output report",
  );
  await expectA11ySmoke(page);
  await expectRuntimeClean();
});

test("Firefox uses capability-gated file input and schema-gated download fallbacks", async ({
  browserName,
  page,
}) => {
  test.skip(browserName !== "firefox", "Firefox-specific fallback coverage.");
  test.setTimeout(90_000);
  const expectRuntimeClean = await monitorRuntime(page);
  await loadSyntheticFile(page);
  expect(await page.evaluate(() => typeof window.showOpenFilePicker)).toBe("undefined");

  const directDownloadPromise = page.waitForEvent("download", { timeout: 60_000 });
  await page.locator("#btn-download").click();
  const directDownload = await directDownloadPromise;
  expect(directDownload.suggestedFilename()).toBe("browser-smoke.xml");
  expect((await downloadedBytes(directDownload)).equals(readFileSync(fixturePath))).toBe(true);
  await expect(page.locator("#ed-val-chip")).toHaveText("schema and structural checks passed");
  await expect(page.locator("#ed-status")).toContainText("Downloaded browser-smoke.xml");

  const saveFallbackPromise = page.waitForEvent("download", { timeout: 60_000 });
  await page.locator("#btn-save").click();
  const saveFallback = await saveFallbackPromise;
  expect(saveFallback.suggestedFilename()).toBe("browser-smoke.xml");
  expect((await downloadedBytes(saveFallback)).equals(readFileSync(fixturePath))).toBe(true);
  await expect(page.locator("#ed-status")).toContainText("Downloaded browser-smoke.xml");
  await expectRuntimeClean();
});

test("real Urfehde book supports the complete paged review workflow", async ({ page }) => {
  test.skip(!urfehdePath, "Set UFBAS_TEI to the local Urfehde TEI source.");
  test.setTimeout(120_000);
  const expectRuntimeClean = await monitorRuntime(page);
  await page.addInitScript(() => {
    Object.defineProperty(window, "showOpenFilePicker", {
      value: undefined,
      configurable: true,
    });
  });
  await page.goto("/editor.html");
  await page.locator("#btn-load").click();
  const chooserPromise = page.waitForEvent("filechooser");
  await page.locator("#menu-open").click();
  const chooser = await chooserPromise;
  await chooser.setFiles(urfehdePath);

  await expect(page.locator("#ed-docstrip")).toContainText("TEI_SOURCE.xml");
  await expect(page.locator("#ed-folio-label")).toContainText("page 1/226");
  await expect(page.locator("#ed-ann-summary")).toContainText("/226");
  expect(await page.locator("#ed-folio-label").evaluate((element) => (
    getComputedStyle(element).whiteSpace === "nowrap"
  ))).toBe(true);

  await page.locator("#view-metadata").click();
  await expect(page.locator(".ed-meta-root")).toBeVisible();
  await expect(page.locator(".ed-meta-form input").first()).toBeVisible();

  await page.locator("#view-xml").click();
  const source = page.locator(".ed-src-ta");
  const firstPageXml = await source.inputValue();
  expect(firstPageXml.length).toBeLessThan(100_000);
  await page.locator("#btn-next").click();
  await expect(page.locator("#ed-folio-label")).toContainText("page 2/226");
  expect(await source.inputValue()).not.toBe(firstPageXml);

  await page.locator("#view-reading").click();
  await page.locator("#ed-review-summary").click();
  await expect(page.locator("#ed-review-summary")).toContainText("Reviewed 1/226");
  await page.keyboard.press("Control+Z");
  await expect(page.locator("#ed-review-summary")).toContainText("Reviewed 0/226");

  await page.locator("#ed-val-chip").click();
  await page.getByRole("button", { name: "Validate schema" }).click();
  await expect(page.locator("#ed-val-pop")).toContainText(
    /TEI P5 4\.11\.0 \(TEI All\): valid/,
    { timeout: 90_000 },
  );

  await expectA11ySmoke(page);
  await expectRuntimeClean();
});
