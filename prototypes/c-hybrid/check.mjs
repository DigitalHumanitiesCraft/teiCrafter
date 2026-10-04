// Browser check for prototype C. Expects the prototype dev server, by default on port 5174:
//   npx vite --config prototypes/vite.config.js --port 5174 --strictPort
// then: node prototypes/c-hybrid/check.mjs (with PORT=5183 for a server on another port)
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { parseDocument, spliceDocument } from "../../src/core/tei-document.js";

const ORIGIN = `http://127.0.0.1:${process.env.PORT ?? "5174"}`;
const BASE = `${ORIGIN}/prototypes/c-hybrid/index.html`;
const here = (name) => fileURLToPath(new URL(name, import.meta.url));
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok, detail }); console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? `  (${detail})` : ""}`); };
const sampleText = (name) => readFileSync(here(`../../public/samples/${name}`), "utf8");
const splice = (text, from, to, insert) => spliceDocument(parseDocument(text), from, to, insert).raw;

// The inline editor is reached through CodeMirror's own lookup, using the module instance the page already loaded.
const pageModule = await (await fetch(`${ORIGIN}/prototypes/c-hybrid/c-hybrid.ts`)).text();
const viewModuleUrl = new URL(pageModule.match(/from "([^"]*@codemirror_view[.]js[^"]*)"/)[1], `${ORIGIN}/prototypes/c-hybrid/`).href;
const editorState = (page) => page.evaluate(async (url) => {
  const { EditorView } = await import(url);
  const view = EditorView.findFromDOM(document.querySelector(".inline-editor .cm-editor"));
  const head = view.state.selection.main.head;
  return { text: view.state.sliceDoc(), after: view.state.sliceDoc(head, head + 12), separator: view.state.lineBreak };
}, viewModuleUrl);
const setEditorText = (page, text) => page.evaluate(async ({ url, text }) => {
  const { EditorView } = await import(url);
  const view = EditorView.findFromDOM(document.querySelector(".inline-editor .cm-editor"));
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
  view.focus();
}, { url: viewModuleUrl, text });

async function axe(page, label) {
  const report = await new AxeBuilder({ page }).analyze();
  // The inline editor's .cm-scroller holds the contenteditable, which axe does not count as its focusable child.
  const violations = report.violations
    .map((v) => ({ ...v, nodes: v.nodes.filter((n) => !(v.id === "scrollable-region-focusable" && n.target.join(" ").endsWith(".cm-scroller"))) }))
    .filter((v) => v.nodes.length > 0);
  check(`axe reports no violations (${label})`, violations.length === 0, violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" ; ")}`).join(", "));
}
async function download(page) {
  const [file] = await Promise.all([page.waitForEvent("download"), page.click("#save")]);
  const chunks = [];
  for await (const chunk of await file.createReadStream()) chunks.push(chunk);
  return Buffer.concat(chunks);
}
const activeInfo = (page) => page.evaluate(() => {
  const a = document.activeElement;
  return { cls: a?.className ?? "", from: a?.dataset?.from ?? null, text: a?.textContent ?? "", width: a?.getBoundingClientRect().width ?? 0 };
});

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
// Without native pickers, Save takes the download path and Open the file input, both observable here.
await context.addInitScript(() => { delete window.showSaveFilePicker; delete window.showOpenFilePicker; });
const page = await context.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));

// ---- ZBZ Hersch, CRLF, line-level
const zbz = sampleText("zbz-hersch-synthetic.xml");
await page.goto(BASE);
await page.waitForSelector(".run");
await page.screenshot({ path: here("screenshot-marks.png") });
await axe(page, "Marks level");

const headerToggle = page.locator(".node[data-name='teiHeader'] > .toggle");
check("teiHeader collapsed to its title", (await headerToggle.getAttribute("aria-expanded")) === "false"
  && (await headerToggle.innerText()).includes("A LETTER ON READING AND PATIENCE"), await headerToggle.innerText());
check("standOff and facsimile collapsed", (await page.locator(".node[data-name='standOff'] > .toggle[aria-expanded='false']").count()) === 1
  && (await page.locator(".node[data-name='facsimile'] > .toggle[aria-expanded='false']").count()) === 1);
check("collapsed content is not rendered", (await page.locator(".mark .mark-name", { hasText: /^titleStmt$/ }).count()) === 0);
check("footer states well-formed", (await page.locator("#wellformed").innerText()) === "well-formed");

const nameNode = page.locator(".node[data-name='name']", { hasText: "Marguerite Vautier" });
const entityBg = await nameNode.locator(".content").evaluate((el) => {
  const probe = document.createElement("span");
  probe.style.background = "var(--color-persName-bg)";
  document.body.append(probe);
  const expected = getComputedStyle(probe).backgroundColor;
  probe.remove();
  return getComputedStyle(el).backgroundColor === expected;
});
check("name with a person ref carries the persName background", entityBg);
check("inline element keeps start and end marks", (await nameNode.locator(":scope > .mark").count()) === 1 && (await nameNode.locator(":scope > .end").count()) === 1);
const attrsHidden = await nameNode.locator(":scope > .mark .mark-attrs").evaluate((el) => el.getBoundingClientRect().width <= 1);
await nameNode.locator(":scope > .mark").hover();
const attrsShown = await nameNode.locator(":scope > .mark .mark-attrs").evaluate((el) => ({ w: el.getBoundingClientRect().width, t: el.textContent }));
check("attributes appear on hover, as written", attrsHidden && attrsShown.w > 10 && attrsShown.t === 'ref="#pers_vautier"', JSON.stringify(attrsShown));
await page.mouse.move(0, 0);

// Keyboard: one tab stop in the document, arrows reach every mark.
await page.focus("#level-reading");
await page.keyboard.press("Tab");
let active = await activeInfo(page);
check("Tab enters the document at its first mark", active.cls === "mark" && active.text.startsWith("?xml"), JSON.stringify(active));
const itemCount = await page.locator("#doc :is(.mark, .toggle)").count();
const visited = new Set([active.from + active.cls]);
for (let i = 1; i < itemCount; i++) {
  await page.keyboard.press("ArrowRight");
  active = await activeInfo(page);
  visited.add(active.from + active.cls);
}
check("ArrowRight visits every mark and toggle", visited.size === itemCount, `${visited.size} of ${itemCount}`);
check("exactly one tab stop in the document", (await page.locator("#doc [tabindex='0']").count()) === 1);
await page.keyboard.press("Home");
await page.keyboard.press("ArrowDown");
await page.keyboard.press("ArrowDown");
active = await activeInfo(page);
check("ArrowDown moves to the next block", active.cls === "mark" && active.text.startsWith("TEI") === false, JSON.stringify(active));

// Level switching by key, with focus in the document.
await page.keyboard.press("2");
check("key 2 selects Reading", (await page.getAttribute("#level-reading", "aria-pressed")) === "true"
  && await page.locator("#doc.level-reading").count() === 1);
const hiddenMark = await page.locator(".node[data-name='name'] > .mark").first().evaluate((el) => el.getBoundingClientRect().width);
check("Reading hides marks", hiddenMark <= 1, String(hiddenMark));
active = await activeInfo(page);
check("the focused mark stays visible at Reading", active.width > 5, JSON.stringify(active));
await page.locator("#doc").evaluate((d) => d.querySelector(".mark[tabindex='0']")?.blur());
await page.screenshot({ path: here("screenshot-reading.png") });
await axe(page, "Reading level");
check("Reading keeps entity backgrounds", await nameNode.locator(".content.ent-persName").isVisible());
await page.locator("#doc .mark[tabindex='0']").focus();
await page.keyboard.press("1");
check("key 1 selects Marks", (await page.getAttribute("#level-marks", "aria-pressed")) === "true");

// Expand the header chip in place by keyboard.
await headerToggle.focus();
await page.keyboard.press("Enter");
check("Enter expands the header in place", (await page.locator(".node[data-name='teiHeader'] > .toggle").getAttribute("aria-expanded")) === "true"
  && (await page.locator(".mark .mark-name", { hasText: /^titleStmt$/ }).count()) === 1);
check("revisionDesc inside the header stays collapsed", (await page.locator(".node[data-name='revisionDesc'] > .toggle[aria-expanded='false']").count()) === 1);
await page.locator(".node[data-name='revisionDesc'] > .toggle").click();
const lineLengths = await page.locator(".node[data-name='change'] .run").evaluate((run) => {
  const text = run.firstChild;
  const range = document.createRange();
  const lines = new Map();
  for (let i = 0; i < text.length; i++) {
    range.setStart(text, i);
    range.setEnd(text, i + 1);
    const r = range.getClientRects()[0];
    if (r) lines.set(Math.round(r.top), (lines.get(Math.round(r.top)) ?? 0) + 1);
  }
  return [...lines.values()];
});
check("free-flowing text stays under 80 characters per line", lineLengths.length > 1 && Math.max(...lineLengths) < 80, `max ${Math.max(...lineLengths)}`);
await page.locator(".node[data-name='teiHeader'] > .toggle").click();

// Text run click opens the enclosing element with the caret at the click.
const run = page.locator(".block[data-name='p'] .run", { hasText: "which is time without a purpose" });
const box = await run.evaluate((el) => {
  const text = el.firstChild;
  const at = text.data.indexOf("purpose");
  const range = document.createRange();
  range.setStart(text, at);
  range.setEnd(text, at + 1);
  const r = range.getBoundingClientRect();
  return { x: r.left + 1, y: r.top + r.height / 2 };
});
await page.mouse.click(box.x, box.y);
await page.waitForSelector(".inline-editor .cm-editor");
let st = await editorState(page);
check("text click opens the enclosing p", st.text.startsWith('<p facs="#facs_1_r_3">') && st.text.endsWith("</p>"));
check("caret lands at the clicked word", st.after.startsWith("purpose"), JSON.stringify(st.after));
check("inline editor splits on the document's CRLF", st.separator === "\r\n");
await page.keyboard.type("XYZ");
check("unapplied edit counts as unsaved", await page.locator("#dirty").isVisible());
await page.keyboard.press("Escape");
active = await activeInfo(page);
check("Escape cancels and returns focus to the mark", (await page.locator(".inline-editor").count()) === 0
  && active.cls === "mark" && active.text.startsWith("p"), JSON.stringify(active));
check("cancel leaves the document unchanged", !(await page.locator("#dirty").isVisible()) && (await run.count()) === 1);

// Inline editor on a name: a failing Apply stays open, a valid Apply splices.
const nameFrom = zbz.indexOf('<name ref="#pers_vautier">');
const nameTo = zbz.indexOf("</name>", nameFrom) + "</name>".length;
await nameNode.locator(":scope > .mark").scrollIntoViewIfNeeded();
await page.locator("#scroller").evaluate((s) => { s.scrollTop += 120; });
await nameNode.locator(":scope > .mark").focus();
const scrollBefore = await page.locator("#scroller").evaluate((s) => s.scrollTop);
await page.keyboard.press("Enter");
await page.waitForSelector(".inline-editor .cm-editor");
st = await editorState(page);
check("Enter on a mark opens its exact source", st.text === zbz.slice(nameFrom, nameTo), JSON.stringify(st.text));
await setEditorText(page, '<persName ref="#pers_vautier">Marguerite Vautier</persname>');
await page.click(".inline-editor button.primary");
const problem = page.locator(".edit-problem");
check("ill-formed Apply keeps the editor open with the reason beside it", (await page.locator(".inline-editor").count()) === 1
  && (await problem.isVisible()) && (await problem.innerText()).includes("not be well-formed"), await problem.innerText());
const replacement = '<persName ref="#pers_vautier">Marguerite Vautier</persName>';
await setEditorText(page, replacement);
await page.keyboard.press("Control+Enter");
await page.waitForSelector(".inline-editor", { state: "detached" });
const persNode = page.locator(".node[data-name='persName']", { hasText: "Marguerite Vautier" });
check("rendered text shows the new element", (await persNode.count()) === 1 && (await persNode.locator(":scope > .mark .mark-name").innerText()) === "persName"
  && (await page.locator(".node[data-name='name']", { hasText: "Marguerite Vautier" }).count()) === 0);
active = await activeInfo(page);
check("focus returns to the mark at the same offset", active.cls === "mark" && Number(active.from) === nameFrom, JSON.stringify(active));
const scrollAfter = await page.locator("#scroller").evaluate((s) => s.scrollTop);
check("scroll position kept after Apply", Math.abs(scrollAfter - scrollBefore) <= 1, `${scrollBefore} -> ${scrollAfter}`);
check("unsaved after Apply", await page.locator("#dirty").isVisible());

// Level changes in between must not touch the raw, which the saved bytes prove.
await page.click("#level-reading");
await page.click("#level-marks");
const expectedZbz = splice(zbz, nameFrom, nameTo, replacement);
const savedZbz = await download(page);
check("saved bytes equal the spliced raw", savedZbz.equals(Buffer.from(expectedZbz, "utf8")), `${savedZbz.length} vs ${Buffer.byteLength(expectedZbz)}`);
check("saved clears unsaved", !(await page.locator("#dirty").isVisible()));

// ---- Wenzelsbibel, CRLF, word-level
const wb = sampleText("wenzelsbibel-synthetic-codex.xml");
await page.selectOption("#sample", "wenzelsbibel-synthetic-codex.xml");
await page.waitForSelector(".node[data-name='w']");
await page.screenshot({ path: here("screenshot-wenzelsbibel.png") });
const firstW = page.locator(".node[data-name='w']").first();
check("w is inline inside l", (await firstW.evaluate((el) => el.tagName)) === "SPAN" && (await firstW.innerText()).includes("dem"));
await firstW.locator(":scope > .mark").click();
await page.waitForSelector(".inline-editor .cm-editor");
const wFrom = wb.indexOf('<w xml:id="w_1_1">');
const wTo = wb.indexOf("</w>", wFrom) + 4;
await setEditorText(page, '<w xml:id="w_1_1">deme</w>');
await page.keyboard.press("Control+Enter");
await page.waitForSelector(".inline-editor", { state: "detached" });
check("Wenzelsbibel word edit renders", (await page.locator(".node[data-name='w']").first().innerText()).includes("deme"));
const firstL = page.locator(".block[data-name='l']").first();
await firstL.locator(":scope > .mark").click();
await page.waitForSelector(".inline-editor .cm-editor");
await page.keyboard.press("Control+End");
await page.keyboard.press("Enter");
await page.keyboard.press("Control+Enter");
await page.waitForSelector(".inline-editor", { state: "detached" });
const savedWb = (await download(page)).toString("utf8");
const afterWord = splice(wb, wFrom, wTo, '<w xml:id="w_1_1">deme</w>');
const lEnd = afterWord.indexOf("</l>") + 4;
const inserted = savedWb.slice(lEnd, savedWb.length - (afterWord.length - lEnd));
check("Wenzelsbibel bytes: word splice plus a CRLF line break, nothing else",
  savedWb.startsWith(afterWord.slice(0, lEnd)) && savedWb.endsWith(afterWord.slice(lEnd)) && /^\r\n[ \t]*$/.test(inserted), JSON.stringify(inserted));
check("no lone LF in the CRLF file", !/[^\r]\n/.test(savedWb));

// ---- SZD, LF
const szd = sampleText("o_szd.1079.tei.xml");
await page.selectOption("#sample", "o_szd.1079.tei.xml");
await page.waitForSelector(".run");
check("SZD header summary uses titleStmt title", (await page.locator(".node[data-name='teiHeader'] > .toggle").innerText()).includes("Brief an Max Fleischer"));
check("SZD lb starts new lines", (await page.locator(".node.lb").count()) > 10);
const szdP = page.locator(".block[data-name='p']", { hasText: "Herrn Max Fleischer" });
await szdP.locator(":scope > .mark").click();
st = await editorState(page);
check("SZD p opens with LF separator and exact source", st.separator === "\n" && szd.includes(st.text) && st.text.startsWith("<p>"));
await page.click(".inline-editor button:not(.primary)");
const savedSzd = await download(page);
check("SZD untouched save is byte-identical", savedSzd.equals(Buffer.from(szd, "utf8")));

// ---- Open, refusal and drop
const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("#open")]);
await chooser.setFiles({ name: "utf16.xml", mimeType: "application/xml", buffer: Buffer.from([0xff, 0xfe, 0x3c, 0x00]) });
await page.waitForFunction(() => document.querySelector("#message").textContent.includes("not opened"));
check("encoding rejection is shown", (await page.locator("#message").innerText()).includes("UTF-16LE"), await page.locator("#message").innerText());
await page.evaluate(() => {
  const data = new DataTransfer();
  data.items.add(new File(['<?xml version="1.0" encoding="UTF-8"?>\n<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p>dropped</p></body></text></TEI>\n'], "dropped.xml", { type: "application/xml" }));
  document.querySelector("#doc").dispatchEvent(new DragEvent("drop", { dataTransfer: data, bubbles: true, cancelable: true }));
});
await page.waitForSelector(".run:has-text('dropped')");
check("dropping a file opens it", (await page.locator("#file-name").innerText()) === "dropped.xml");

// Discard guard after an applied edit.
await page.locator(".block[data-name='p'] > .mark").click();
await setEditorText(page, "<p>dropped and edited</p>");
await page.keyboard.press("Control+Enter");
await page.waitForSelector(".inline-editor", { state: "detached" });
await page.selectOption("#sample", "zbz-hersch-synthetic.xml");
await page.waitForSelector("#discard-dialog[open]");
check("discard dialog guards unsaved work", true);
await page.click("#discard-dialog button[value='discard']");
await page.waitForSelector(".run:has-text('A book asks')");

// ---- Narrow
await page.setViewportSize({ width: 420, height: 800 });
await page.evaluate(() => { document.querySelector("#message").textContent = ""; });
await page.screenshot({ path: here("screenshot-narrow.png") });
const noScroll = () => page.evaluate(() => {
  const s = document.querySelector("#scroller");
  return document.documentElement.scrollWidth <= document.documentElement.clientWidth && s.scrollWidth <= s.clientWidth;
});
check("no horizontal scroll at 420px", await noScroll());
await page.locator(".node[data-name='teiHeader'] > .toggle").click();
await page.locator(".node[data-name='facsimile'] > .toggle").click();
await page.locator(".node[data-name='zone'] > .mark").first().focus();
check("no horizontal scroll at 420px with header, facsimile and attributes open", await noScroll());
await page.locator(".block[data-name='p'] > .mark").first().click();
check("no horizontal scroll at 420px with an inline editor", await noScroll());
await page.keyboard.press("Escape");

check("no console errors", errors.length === 0, errors.join(" | "));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`${failed.length ? "FAILED" : "PASSED"}`);
process.exit(failed.length ? 1 : 0);
