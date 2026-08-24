import { readFileSync } from "node:fs";
import { historyCommand } from "../../docs/js/editor/history-shortcuts.js";
import { check, finish, section } from "./_assert.mjs";

section("Undo and Redo browser wiring");

const target = (tagName, extras = {}) => ({ tagName, ...extras });
check("Ctrl+Z routes to document Undo",
  historyCommand({ key: "z", ctrlKey: true, target: target("DIV") }) === "undo");
check("Cmd+Shift+Z routes to document Redo",
  historyCommand({ key: "Z", metaKey: true, shiftKey: true, target: target("BUTTON") }) === "redo");
check("native input Undo remains inside the focused field",
  historyCommand({ key: "z", ctrlKey: true, target: target("TEXTAREA") }) === null);
check("contenteditable retains its native Undo",
  historyCommand({ key: "z", metaKey: true, target: target("DIV", { isContentEditable: true }) }) === null);
check("plain Z and modified Alt shortcuts are ignored",
  historyCommand({ key: "z", target: target("DIV") }) === null
    && historyCommand({ key: "z", ctrlKey: true, altKey: true, target: target("DIV") }) === null);

const html = readFileSync("docs/editor.html", "utf8");
const app = readFileSync("docs/js/editor/editor-app.js", "utf8");
check("visible toolbar buttons expose labels, disabled state and shortcuts",
  /id="btn-undo"[^>]*disabled[^>]*aria-label="Undo document edit"/.test(html)
    && /id="btn-redo"[^>]*disabled[^>]*aria-label="Redo document edit"/.test(html)
    && html.includes("Control+Shift+Z Meta+Shift+Z"));
check("both buttons and the global shortcut use the single history action",
  app.includes('$("btn-undo").addEventListener("click", () => applyHistory("undo"))')
    && app.includes('$("btn-redo").addEventListener("click", () => applyHistory("redo"))')
    && app.includes("const command = historyCommand(event)"));

finish("history_wiring_check passed");
