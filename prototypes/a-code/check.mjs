// Browser check for prototype A. Expects the prototype dev server, by default on port 5174:
//   npx vite --config prototypes/vite.config.js --port 5174 --strictPort
// then: node prototypes/a-code/check.mjs (with PORT=5181 for a server on another port)
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { parseDocument } from "../../src/core/tei-document.js";

const ORIGIN = `http://127.0.0.1:${process.env.PORT ?? "5174"}`;
const BASE = `${ORIGIN}/prototypes/a-code/index.html`;
const here = (name) => fileURLToPath(new URL(name, import.meta.url));
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok, detail }); console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? `  (${detail})` : ""}`); };

// The editor view is reached through CodeMirror's own lookup, using the module instances the page already loaded.
const pageModule = await (await fetch(`${ORIGIN}/prototypes/a-code/a-code.ts`)).text();
const moduleUrl = (pattern) => new URL(pageModule.match(new RegExp(`from "([^"]*${pattern}[^"]*)"`))[1], `${ORIGIN}/prototypes/a-code/`).href;
const viewModuleUrl = moduleUrl("@codemirror_view[.]js");
const levelsModuleUrl = moduleUrl("markup-levels");
async function setLevel(page, level) {
  await page.evaluate(async ({ url, levels, level }) => {
    const { EditorView } = await import(url);
    const { setMarkupLevel } = await import(levels);
    setMarkupLevel(EditorView.findFromDOM(document.querySelector(".cm-editor")), level);
  }, { url: viewModuleUrl, levels: levelsModuleUrl, level });
}
async function headText(page, length) {
  return page.evaluate(async ({ url, length }) => {
    const { EditorView } = await import(url);
    const { state } = EditorView.findFromDOM(document.querySelector(".cm-editor"));
    return state.sliceDoc(state.selection.main.head, state.selection.main.head + length);
  }, { url: viewModuleUrl, length });
}
async function docText(page) {
  return page.evaluate(async (url) => {
    const { EditorView } = await import(url);
    return EditorView.findFromDOM(document.querySelector(".cm-editor")).state.sliceDoc();
  }, viewModuleUrl);
}
async function setCursor(page, pos) {
  await page.evaluate(async ({ url, pos }) => {
    const { EditorView } = await import(url);
    const view = EditorView.findFromDOM(document.querySelector(".cm-editor"));
    // Offsets come from the raw text; an editor position counts a CRLF as one character.
    const raw = view.state.sliceDoc();
    const anchor = pos - (raw.slice(0, pos).split(view.state.lineBreak).length - 1) * (view.state.lineBreak.length - 1);
    view.dispatch({ selection: { anchor } });
    view.focus();
  }, { url: viewModuleUrl, pos });
}

// Formatting may change whitespace-only text between structural children and nothing else.
function formatInvariants(before, after) {
  const strip = (s) => s.replace(/\s/g, "");
  const problems = [];
  if (strip(before) !== strip(after)) problems.push("non-whitespace content differs");
  const doc = parseDocument(before);
  const walk = (n) => {
    for (const c of n.children ?? []) {
      if (c.type !== "element") continue;
      const hasText = (c.children ?? []).some((k) => k.type === "text" && !/^[ \t\r\n]*$/.test(before.slice(k.start, k.end)));
      if (hasText) {
        const slice = before.slice(c.outerStart, c.outerEnd);
        if (!after.includes(slice)) problems.push(`mixed element <${c.qname}> at ${c.outerStart} changed`);
      } else walk(c);
    }
  };
  walk(doc.root);
  return problems;
}

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(BASE);
await page.waitForSelector(".cm-content:has-text('A book asks')");
await page.screenshot({ path: here("screenshot.png") });
// axe does not count the contenteditable .cm-content as the focusable child of its scroller; that one finding is
// excluded, every other rule and target stays in force.
const axe = await new AxeBuilder({ page }).analyze();
axe.violations = axe.violations
  .map((v) => ({ ...v, nodes: v.nodes.filter((n) => !(v.id === "scrollable-region-focusable" && n.target.join(" ") === ".cm-scroller")) }))
  .filter((v) => v.nodes.length > 0);
check("axe reports no violations", axe.violations.length === 0, axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" ; ")}`).join(", "));

const sampleText = (name) => readFileSync(here(`../../public/samples/${name}`), "utf8");
check("editor text equals the file text, CRLF kept", (await docText(page)) === sampleText("zbz-hersch-synthetic.xml"));

const header = page.locator(".cm-fold-summary[aria-label='Unfold teiHeader']");
check("teiHeader folded on load with title summary", (await header.count()) === 1
  && (await header.innerText()).includes("A LETTER ON READING AND PATIENCE"), await header.innerText().catch(() => ""));
check("standOff and facsimile folded on load",
  (await page.locator(".cm-fold-summary[aria-label='Unfold standOff']").count()) === 1
  && (await page.locator(".cm-fold-summary[aria-label='Unfold facsimile']").count()) === 1);
check("footer states well-formed and UTF-8", (await page.locator("#wellformed").innerText()) === "well-formed"
  && (await page.locator("#encoding").innerText()) === "UTF-8");

await page.click("#unfold-all");
check("Unfold all reveals header content", await page.locator(".cm-content:has-text('publicationStmt')").count() === 1);
await page.click("#fold-structure");
check("Fold structure folds the header again", (await header.count()) === 1);

const raw = await docText(page);
await setCursor(page, raw.indexOf("A book asks"));
const pathNames = await page.locator("#path button").allInnerTexts();
check("breadcrumb shows path at cursor", pathNames.join(">") === "TEI>text>body>div>p", pathNames.join(" > "));
await setCursor(page, raw.indexOf("A LETTER ON READING AND PATIENCE</title>"));
const pathAfter = await page.locator("#path button").allInnerTexts();
check("breadcrumb updates on cursor move", pathAfter.join(">") === "TEI>text>body>div>head>title", pathAfter.join(" > "));
await setCursor(page, raw.indexOf("A book asks"));
await page.locator("#path button", { hasText: /^div$/ }).click();
const sel = await page.evaluate(async (url) => {
  const { EditorView } = await import(url);
  const v = EditorView.findFromDOM(document.querySelector(".cm-editor"));
  const r = v.state.selection.main;
  return v.state.sliceDoc(r.from, r.to);
}, viewModuleUrl);
check("breadcrumb ancestor selects the full element", sel.startsWith('<div n="1">') && sel.endsWith("</div>"));

await setCursor(page, raw.indexOf("A book asks"));
await page.keyboard.press("Control+Shift+BracketLeft");
check("Ctrl+Shift+[ folds the element at the cursor", (await page.locator(".cm-fold-summary[aria-label='Unfold p']").count()) === 1);
await page.keyboard.press("Control+Shift+BracketRight");
check("Ctrl+Shift+] unfolds it", (await page.locator(".cm-fold-summary[aria-label='Unfold p']").count()) === 0);
await page.keyboard.press("Control+Shift+ArrowUp");
check("Ctrl+Shift+ArrowUp folds the element at the cursor", (await page.locator(".cm-fold-summary[aria-label='Unfold p']").count()) === 1);
await page.keyboard.press("Control+Shift+ArrowDown");
check("Ctrl+Shift+ArrowDown unfolds it", (await page.locator(".cm-fold-summary[aria-label='Unfold p']").count()) === 0);

const contrast = await page.evaluate(() => {
  const lum = (c) => {
    const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map(Number).map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  // Resolve a colour through the canvas so color-mix results come back as sRGB.
  const rgb = (css) => { const c = document.createElement("canvas").getContext("2d"); c.fillStyle = css; c.fillRect(0, 0, 1, 1); return `rgb(${[...c.getImageData(0, 0, 1, 1).data].slice(0, 3).join(",")})`; };
  const tag = document.querySelector("#editor .cm-xml-tag");
  const text = document.querySelector("#editor .cm-xml-text");
  const s = getComputedStyle(document.documentElement);
  return {
    tag: rgb(getComputedStyle(tag).color), text: rgb(getComputedStyle(text).color),
    vsPanel: ratio(rgb(getComputedStyle(tag).color), rgb(s.getPropertyValue("--color-panel"))),
    vsActive: ratio(rgb(getComputedStyle(tag).color), rgb(s.getPropertyValue("--color-secondary"))),
  };
});
await page.keyboard.press("Alt+Shift+KeyD");
const dimmed = await page.evaluate(() => {
  const lum = (c) => {
    const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map(Number).map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const rgb = (css) => { const c = document.createElement("canvas").getContext("2d"); c.fillStyle = css; c.fillRect(0, 0, 1, 1); return `rgb(${[...c.getImageData(0, 0, 1, 1).data].slice(0, 3).join(",")})`; };
  const s = getComputedStyle(document.documentElement);
  const tag = rgb(getComputedStyle(document.querySelector("#editor .cm-xml-tag")).color);
  const text = rgb(getComputedStyle(document.querySelector("#editor .cm-xml-text")).color);
  return {
    pressed: document.querySelector("#dim-markup").getAttribute("aria-pressed"), tag, text,
    vsPanel: ratio(tag, rgb(s.getPropertyValue("--color-panel"))),
    vsActive: ratio(tag, rgb(s.getPropertyValue("--color-secondary"))),
    vsSelection: ratio(tag, rgb(s.getPropertyValue("--color-gold-light"))),
  };
});
check("dim toggle changes markup colour, text unchanged", dimmed.pressed === "true" && dimmed.tag !== contrast.tag && dimmed.text === contrast.text,
  `markup ${contrast.tag} -> ${dimmed.tag}, text ${dimmed.text}`);
check("dimmed markup keeps at least 3:1", dimmed.vsPanel >= 3 && dimmed.vsActive >= 3,
  `panel ${dimmed.vsPanel.toFixed(2)}, active line ${dimmed.vsActive.toFixed(2)}`);
await page.click("#dim-markup");
check("dim button toggles back", (await page.getAttribute("#dim-markup", "aria-pressed")) === "false");

// Format: cursor on the <div n="1"> line, outside any p.
await setCursor(page, raw.indexOf('<div n="1">') + 2);
await page.click("#format-element");
await page.waitForSelector("#format-dialog[open]");
const title = await page.locator("#format-title").innerText();
const before = await page.locator("#format-before").textContent();
const after = await page.locator("#format-after").textContent();
const problems = formatInvariants(before, after);
check("format dialog for the div", title === "Format div", title);
check("format keeps mixed content byte-identical", problems.length === 0, problems.join("; "));
check("format re-indents the div with the file's CRLF", after.startsWith('      <div n="1">\r\n        <pb') && after.endsWith("\r\n      </div>")
  && !/[^\r]\n/.test(after), JSON.stringify(after.slice(0, 40)));
await page.click("#format-dialog button[value='apply']");
const formatted = await docText(page);
check("Apply replaces only the element range", formatted === raw.replace(before, after));
await page.click("#format-element");
check("formatting is idempotent", (await page.locator("#message").innerText()).includes("already formatted")
  && !(await page.locator("#format-dialog").evaluate((d) => d.open)));
check("dirty state shown after edit", await page.locator("#dirty").isVisible());

// Model proposal demo.
check("Propose (demo) rendered for a document with a candidate", await page.locator("#propose").isVisible());
await page.click("#propose");
await page.waitForSelector(".proposal");
check("proposal shows replacement and rationale", (await page.locator(".proposal code").innerText()) === '<persName ref="#pers_vautier">Marguerite Vautier</persName>');
check("Accept receives focus", await page.waitForFunction(() => document.activeElement?.classList.contains("accept"), null, { timeout: 2000 }).then(() => true, () => false));
await page.keyboard.press("Enter");
const accepted = await docText(page);
check("Accept splices the proposal", accepted.includes('<persName ref="#pers_vautier">Marguerite Vautier</persName>') && !accepted.includes('<name ref="#pers_vautier">'));
check("accepted range keeps the model-origin mark", (await page.locator(".cm-proposal-accepted").count()) > 0);
await page.click("#propose");
await page.waitForSelector(".proposal");
await page.waitForFunction(() => document.activeElement?.classList.contains("accept"));
await page.keyboard.press("Tab");
await page.keyboard.press("Enter");
check("Reject removes the proposal without change", (await page.locator(".proposal").count()) === 0 && (await docText(page)) === accepted);

// Reading level: single-line tags hidden behind a marker, entity content tinted, hidden tags protected.
await setLevel(page, "reading");
const readingLine = page.locator(".cm-line", { hasText: "A book asks" });
check("reading level hides tags", (await page.locator(".cm-tag-marker").count()) > 0
  && !(await readingLine.innerText()).includes("<lb"), await readingLine.innerText());
const entity = await page.evaluate(() => {
  const el = document.querySelector("#editor .cm-entity-persName");
  const probe = document.createElement("span");
  probe.style.background = "var(--color-persName-bg)";
  document.body.append(probe);
  const expected = getComputedStyle(probe).backgroundColor;
  probe.remove();
  return el ? { text: el.textContent, ok: getComputedStyle(el).backgroundColor === expected } : null;
});
check("reading level tints persName content", entity?.text === "Marguerite Vautier" && entity.ok, JSON.stringify(entity));
await setCursor(page, accepted.indexOf("<lb", accepted.indexOf("<p ", accepted.indexOf("<body"))));
await page.keyboard.press("ArrowRight");
check("cursor passes a hidden tag in one step", (await headText(page, 11)) === "A book asks", await headText(page, 11));
await page.keyboard.press("Backspace");
check("Backspace does not delete a hidden tag", (await docText(page)) === accepted);
await page.keyboard.type("X");
check("typing next to a hidden tag inserts text outside it", (await docText(page)).includes('n="N001" />XA book asks'));
await page.keyboard.press("Control+z");
await setLevel(page, "source");
check("source level shows every tag again", (await page.locator(".cm-tag-marker").count()) === 0 && (await docText(page)) === accepted);

// Well-formedness marking.
await setCursor(page, accepted.indexOf("A book asks"));
await page.keyboard.type("&");
await page.waitForFunction(() => document.querySelector("#wellformed").textContent.startsWith("not well-formed"));
check("not well-formed is stated in the footer", true, await page.locator("#wellformed").innerText());
check("problem line marked", (await page.locator(".cm-problemLine").count()) === 1 && (await page.locator(".problem-marker").count()) >= 1);
await page.keyboard.press("Backspace");
await page.waitForFunction(() => document.querySelector("#wellformed").textContent === "well-formed");
check("marking clears once fixed", (await page.locator(".cm-problemLine").count()) === 0);

await page.keyboard.press("End");
await page.keyboard.press("Enter");
const withBreak = await docText(page);
check("Enter in a CRLF file inserts CRLF", withBreak.length > accepted.length && !/[^\r]\n/.test(withBreak));
await page.keyboard.press("Control+z");
check("undo restores the text", (await docText(page)) === accepted);

await page.keyboard.press("Control+f");
check("search panel opens", await page.locator(".cm-search").isVisible());
await page.keyboard.press("Escape");

// Discard guard and other samples.
await page.selectOption("#sample", "wenzelsbibel-synthetic-codex.xml");
await page.waitForSelector("#discard-dialog[open]");
await page.click("#discard-dialog button[value='discard']");
await page.waitForSelector(".cm-content:has-text('anegenge')");
check("Wenzelsbibel text equals the file text", (await docText(page)) === sampleText("wenzelsbibel-synthetic-codex.xml"));
check("discard dialog guards unsaved work", true);
check("no proposal button without a listPerson candidate", !(await page.locator("#propose").isVisible()));
await setCursor(page, 0);
await page.click("#format-element");
await page.waitForSelector("#format-dialog[open]");
const wb = await page.locator("#format-before").textContent();
const wbAfter = await page.locator("#format-after").textContent();
const wbProblems = formatInvariants(wb, wbAfter);
check("whole-document format leaves <l> word spacing intact", (await page.locator("#format-title").innerText()) === "Format TEI" && wbProblems.length === 0, wbProblems.slice(0, 3).join("; "));
await page.keyboard.press("Escape");
check("Escape closes the dialog and returns focus", !(await page.locator("#format-dialog").evaluate((d) => d.open))
  && await page.evaluate(() => document.activeElement?.id === "format-element"));

await page.selectOption("#sample", "o_szd.1079.tei.xml");
await page.waitForSelector(".cm-fold-summary[aria-label='Unfold teiHeader']");
check("SZD (LF) text equals the file text", (await docText(page)) === sampleText("o_szd.1079.tei.xml"));
check("SZD header summary uses titleStmt title", (await page.locator(".cm-fold-summary[aria-label='Unfold teiHeader']").innerText()).startsWith("Brief an Max Fleischer"));

await page.setInputFiles("#file-input", { name: "utf16.xml", mimeType: "application/xml", buffer: Buffer.from([0xff, 0xfe, 0x3c, 0x00]) });
await page.waitForFunction(() => document.querySelector("#message").textContent.includes("not opened"));
check("encoding rejection is shown", (await page.locator("#message").innerText()).includes("UTF-16LE"), await page.locator("#message").innerText());

// Drag and drop of a file onto the editor.
await page.evaluate(() => {
  const data = new DataTransfer();
  data.items.add(new File(['<?xml version="1.0" encoding="UTF-8"?>\n<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p>dropped</p></body></text></TEI>\n'], "dropped.xml", { type: "application/xml" }));
  document.querySelector(".cm-content").dispatchEvent(new DragEvent("drop", { dataTransfer: data, bubbles: true, cancelable: true }));
});
await page.waitForSelector(".cm-content:has-text('dropped')");
check("dropping a file opens it", (await page.locator("#file-name").innerText()) === "dropped.xml");

await page.setViewportSize({ width: 420, height: 800 });
await page.selectOption("#sample", "zbz-hersch-synthetic.xml");
await page.waitForSelector(".cm-content:has-text('A book asks')");
await page.evaluate(() => document.querySelector("#message").textContent = "");
await page.screenshot({ path: here("screenshot-narrow.png") });
check("element path is empty at the document start", (await page.locator("#path button").count()) === 0);
check("no horizontal document scroll at 420px", await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));

check("no console errors", errors.length === 0, errors.join(" | "));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`${failed.length ? "FAILED" : "PASSED"}`);
process.exit(failed.length ? 1 : 0);
