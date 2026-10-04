// Browser check for prototype B. Expects the prototype dev server, by default on port 5174:
//   npx vite --config prototypes/vite.config.js --port 5174 --strictPort
// then: node prototypes/b-focus/check.mjs (with PORT=5182 for a server on another port)
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { parseDocument } from "../../src/core/tei-document.js";

const ORIGIN = `http://127.0.0.1:${process.env.PORT ?? "5174"}`;
const BASE = `${ORIGIN}/prototypes/b-focus/index.html`;
const here = (name) => fileURLToPath(new URL(name, import.meta.url));
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok, detail }); console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? `  (${detail})` : ""}`); };
const sampleBytes = (name) => readFileSync(here(`../../public/samples/${name}`));
const sampleText = (name) => sampleBytes(name).toString("utf8");
const lineOf = (raw, offset) => raw.slice(0, offset).split("\n").length;
const elements = (node, local) => {
  const out = [];
  const walk = (n) => { if (n.type === "element" && n.localName === local) out.push(n); (n.children ?? []).forEach(walk); };
  walk(node);
  return out;
};

// The editor view is reached through CodeMirror's own lookup, using the module instance the page already loaded.
const pageModule = await (await fetch(`${ORIGIN}/prototypes/b-focus/b-focus.ts`)).text();
const viewModuleUrl = new URL(pageModule.match(/from "([^"]*@codemirror_view[.]js[^"]*)"/)[1], `${ORIGIN}/prototypes/b-focus/`).href;
const docText = (page) => page.evaluate(async (url) => {
  const { EditorView } = await import(url);
  return EditorView.findFromDOM(document.querySelector(".cm-editor")).state.sliceDoc();
}, viewModuleUrl);
// Places the cursor at a raw offset of the focused slice; an editor position counts a CRLF as one character.
const setCursor = (page, offset) => page.evaluate(async ({ url, offset }) => {
  const { EditorView } = await import(url);
  const view = EditorView.findFromDOM(document.querySelector(".cm-editor"));
  const raw = view.state.sliceDoc();
  const anchor = offset - (raw.slice(0, offset).split(view.state.lineBreak).length - 1) * (view.state.lineBreak.length - 1);
  view.dispatch({ selection: { anchor } });
  view.focus();
}, { url: viewModuleUrl, offset });
const firstLineNumber = (page) => page.evaluate(() => [...document.querySelectorAll(".cm-lineNumbers .cm-gutterElement")]
  .find((el) => getComputedStyle(el).visibility !== "hidden")?.textContent);
const crumbs = async (page) => (await page.locator("#crumbs li").allInnerTexts()).join(" > ");
const selectedItem = (page) => page.locator("#tree [aria-selected='true'] > .row .label").innerText();
const settle = (page) => page.waitForTimeout(450);
async function download(page) {
  await page.evaluate(() => { window.showSaveFilePicker = undefined; });
  const [file] = await Promise.all([page.waitForEvent("download"), page.click("#save")]);
  const chunks = [];
  for await (const chunk of await file.createReadStream()) chunks.push(chunk);
  return Buffer.concat(chunks);
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1400, height: 900 }, acceptDownloads: true });
const page = await context.newPage();
const errors = [];
const infos = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); if (m.type() === "info") infos.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));

// Load and first view.
const zbz = sampleText("zbz-hersch-synthetic.xml");
const zbzDoc = parseDocument(zbz);
const [pb1, pb2] = elements(zbzDoc.root, "pb");
const div = elements(zbzDoc.root, "div")[0];
await page.goto(BASE);
await page.waitForSelector(".cm-content:has-text('A book asks')");
await page.screenshot({ path: here("screenshot.png") });
const axe = await new AxeBuilder({ page }).analyze();
// axe does not count the contenteditable .cm-content as the focusable child of its scroller; that one finding is excluded.
axe.violations = axe.violations
  .map((v) => ({ ...v, nodes: v.nodes.filter((n) => !(v.id === "scrollable-region-focusable" && n.target.join(" ") === ".cm-scroller")) }))
  .filter((v) => v.nodes.length > 0);
check("axe reports no violations", axe.violations.length === 0, axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" ; ")}`).join(", "));
const fidelity = infos.find((t) => t.startsWith("Byte fidelity self-check for zbz"));
check("byte fidelity self-check reports raw identical", fidelity?.includes("raw identical") ?? false, fidelity);
check("opens focused on page 1", (await selectedItem(page)) === "page 1" && (await docText(page)) === zbz.slice(pb1.outerStart, pb2.outerStart));
check("path from the document to the page", (await crumbs(page)) === "Document > text > body > A LETTER ON READING AND PATIENCE > page 1", await crumbs(page));
check("line numbers are document lines", (await firstLineNumber(page)) === String(lineOf(zbz, pb1.outerStart)), await firstLineNumber(page));
check("footer states well-formed and saved", (await page.locator("#wellformed").innerText()) === "well-formed" && !(await page.locator("#dirty").isVisible()));

// Page 2, an edit and its write-back.
await page.locator("#tree [role=treeitem]", { hasText: /^page 2$/ }).click();
const page2 = zbz.slice(pb2.outerStart, div.contentEnd);
check("page 2 runs to the end of its division", (await docText(page)) === page2);
const at = page2.indexOf("There is a second");
await setCursor(page, at);
await page.keyboard.type("X");
await settle(page);
const target = pb2.outerStart + at;
const docCol = target - zbz.lastIndexOf("\n", target - 1);
check("footer shows document line and column", (await page.locator("#cursor").innerText()) === `${lineOf(zbz, target)}:${docCol + 1}`, await page.locator("#cursor").innerText());
check("footer shows unsaved", await page.locator("#dirty").isVisible());
const edited = `${zbz.slice(0, target)}X${zbz.slice(target)}`;
await page.keyboard.press("Alt+ArrowUp");
check("Alt+Up focuses the parent division", (await selectedItem(page)).includes("A LETTER ON READING") && (await docText(page)) === edited.slice(div.outerStart, div.outerEnd + 1));
check("Alt+Up keeps the cursor where the page began", (await page.locator("#cursor").innerText()) === `${lineOf(zbz, pb2.outerStart)}:${pb2.outerStart - zbz.lastIndexOf("\n", pb2.outerStart - 1)}`, await page.locator("#cursor").innerText());
await page.locator("#crumbs button", { hasText: "Document" }).click();
check("path step Document shows the canonical raw with the edit", (await docText(page)) === edited);
check("canonical raw changed only at the edit", (await docText(page)).length === zbz.length + 1);
const saved = await download(page);
check("Save writes the canonical raw", saved.toString("utf8") === edited && !(await page.locator("#dirty").isVisible()));

// Well-formedness inside and outside the focus.
await page.locator("#tree .label", { hasText: /^body$/ }).click();
await page.keyboard.press("Alt+ArrowUp");
check("Alt+Up from body focuses text", (await selectedItem(page)) === "text");
await page.locator("#tree [role=treeitem]", { hasText: /^page 1$/ }).click();
await setCursor(page, (await docText(page)).indexOf("A book asks"));
await page.keyboard.type("&");
await page.waitForFunction(() => document.querySelector("#wellformed").textContent.startsWith("not well-formed"));
check("error inside the focus is marked at its line", (await page.locator(".cm-problemLine").count()) === 1
  && (await page.locator("#wellformed").innerText()).includes(`(line ${lineOf(edited, edited.indexOf("A book asks"))})`), await page.locator("#wellformed").innerText());
await page.keyboard.press("Backspace");
await page.waitForFunction(() => document.querySelector("#wellformed").textContent === "well-formed");
check("marking clears once repaired", (await page.locator(".cm-problemLine").count()) === 0);
const p1 = await docText(page);
// Inserted as one change, because typing ">" lets the XML mode close the tag on its own.
await page.evaluate(async (url) => {
  const { EditorView } = await import(url);
  const view = EditorView.findFromDOM(document.querySelector(".cm-editor"));
  view.dispatch({ changes: { from: view.state.doc.length, insert: "<foo>" } });
}, viewModuleUrl);
await page.waitForFunction(() => !document.querySelector("#problem-link").hidden);
const link = await page.locator("#problem-link").innerText();
check("error outside the focus is named with its document line", /^Go to line \d+$/.test(link) && (await page.locator(".cm-problemLine").count()) === 0, `${link}; ${await page.locator("#wellformed").innerText()}`);
await page.click("#problem-link");
check("Go to line refocuses where the error is", (await selectedItem(page)) !== "page 1" && (await page.locator(".cm-problemLine").count()) === 1
  && (await page.locator("#cursor").innerText()).startsWith(`${link.replace(/\D/g, "")}:`), `${await selectedItem(page)} ${await page.locator("#cursor").innerText()}`);
await page.locator("#tree [role=treeitem]", { hasText: /^page 1$/ }).click();
const broken = await docText(page);
await setCursor(page, broken.indexOf("<foo>"));
for (let i = 0; i < 5; i++) await page.keyboard.press("Delete");
await page.waitForFunction(() => document.querySelector("#wellformed").textContent === "well-formed");
await page.keyboard.press("Alt+ArrowRight");
check("Alt+Right focuses the next unit", (await selectedItem(page)) === "page 2");
await page.keyboard.press("Alt+ArrowLeft");
check("Alt+Left focuses the previous unit", (await selectedItem(page)) === "page 1");
await page.locator("#crumbs button", { hasText: "Document" }).click();
check("repair leaves the canonical raw as saved", (await docText(page)) === edited && !(await page.locator("#dirty").isVisible()));

// Keyboard-only outline navigation.
await page.focus("#tree [tabindex='0']");
check("one tree item is in the tab order", (await page.locator("#tree [tabindex='0']").count()) === 1);
await page.keyboard.press("Home");
await page.keyboard.press("ArrowDown");
const header = page.locator("#tree [role=treeitem]", { has: page.locator(":scope > .row .label", { hasText: /^teiHeader$/ }) });
check("arrow keys reach teiHeader, collapsed", (await page.evaluate(() => document.getElementById(document.activeElement.getAttribute("aria-labelledby"))?.textContent)) === "teiHeader" && (await header.getAttribute("aria-expanded")) === "false");
await page.keyboard.press("ArrowRight");
check("ArrowRight expands", (await header.getAttribute("aria-expanded")) === "true");
await page.keyboard.press("ArrowRight");
await page.keyboard.press("Enter");
const fileDesc = elements(zbzDoc.root, "fileDesc")[0];
check("Enter focuses the unit and moves to the editor", (await docText(page)) === edited.slice(fileDesc.outerStart, fileDesc.outerEnd)
  && await page.evaluate(() => document.activeElement?.classList.contains("cm-content")));
await page.focus("#tree [tabindex='0']");
await page.keyboard.press("ArrowLeft");
await page.keyboard.press("ArrowLeft");
check("ArrowLeft goes to the parent, then collapses", (await header.getAttribute("aria-expanded")) === "false");
await page.keyboard.press("End");
check("End reaches the last visible item", (await page.evaluate(() => document.activeElement.innerText)) === "page 2");

// The CRLF Wenzelsbibel sample.
const wb = sampleText("wenzelsbibel-synthetic-codex.xml");
await page.selectOption("#sample", "wenzelsbibel-synthetic-codex.xml");
await page.waitForSelector(".cm-content:has-text('anegenge')");
const wbFidelity = infos.find((t) => t.startsWith("Byte fidelity self-check for wenzelsbibel"));
check("Wenzelsbibel self-check reports raw identical", wbFidelity?.includes("raw identical") ?? false, wbFidelity);
check("Wenzelsbibel opens on page 1r", (await selectedItem(page)) === "page 1r");
check("no-op Save returns the file bytes", (await download(page)).equals(sampleBytes("wenzelsbibel-synthetic-codex.xml")));
const wbPage = await docText(page);
await setCursor(page, wbPage.indexOf("</l>"));
await page.keyboard.press("Enter");
await settle(page);
await page.keyboard.press("Alt+ArrowUp");
const wbBody = await docText(page);
const wbBodyNode = elements(parseDocument(wb).root, "body")[0];
const breaks = (t) => t.split("\r\n").length - 1;
check("Enter in a CRLF page inserts CRLF", breaks(wbBody) === breaks(wb.slice(wbBodyNode.outerStart, wbBodyNode.outerEnd)) + 1 && !/[^\r]\n/.test(wbBody));
await page.keyboard.press("Alt+ArrowRight");
check("Alt+Right at the last sibling stays and says so", (await page.locator("#message").innerText()) === "No next unit.", await page.locator("#message").innerText());

// Encoding rejection through a dropped file.
await page.selectOption("#sample", "o_szd.1079.tei.xml");
await page.waitForSelector("#discard-dialog[open]");
await page.click("#discard-dialog button[value='discard']");
await page.waitForFunction(() => document.querySelector("#file-name").textContent === "o_szd.1079.tei.xml");
await page.evaluate(() => {
  const data = new DataTransfer();
  data.items.add(new File([new Uint8Array([0xff, 0xfe, 0x3c, 0x00])], "utf16.xml", { type: "application/xml" }));
  document.querySelector(".cm-content").dispatchEvent(new DragEvent("drop", { dataTransfer: data, bubbles: true, cancelable: true }));
});
await page.waitForFunction(() => document.querySelector("#message").textContent.includes("not opened"));
check("encoding rejection is shown", (await page.locator("#message").innerText()).includes("UTF-16LE"), await page.locator("#message").innerText());

// Narrow layout.
await page.setViewportSize({ width: 420, height: 800 });
await page.selectOption("#sample", "zbz-hersch-synthetic.xml");
await page.waitForSelector(".cm-content:has-text('A book asks')");
await page.screenshot({ path: here("screenshot-narrow.png") });
check("outline hidden behind its toggle at 420px", !(await page.locator("#tree").isVisible()) && await page.locator("#outline-toggle").isVisible());
check("no horizontal document scroll at 420px", await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
await page.focus("#outline-toggle");
await page.keyboard.press("Enter");
check("toggle opens the outline and focuses it", await page.locator("#tree").isVisible() && await page.evaluate(() => document.activeElement?.getAttribute("role") === "treeitem"));
await page.keyboard.press("Escape");
check("Escape closes the outline and returns focus", !(await page.locator("#tree").isVisible()) && await page.evaluate(() => document.activeElement?.id === "outline-toggle"));

check("no console errors", errors.length === 0, errors.join(" | "));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`${failed.length ? "FAILED" : "PASSED"}`);
process.exit(failed.length ? 1 : 0);
