/** Pure keyboard routing for document-level Undo and Redo. */

export function isTextEntryTarget(target) {
  if (!target) return false;
  const tag = String(target.tagName || "").toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if (target.isContentEditable) return true;
  return typeof target.closest === "function" && !!target.closest("[contenteditable='true']");
}

export function historyCommand(event) {
  if (!event || event.defaultPrevented || event.isComposing || event.altKey) return null;
  if (!(event.ctrlKey || event.metaKey) || String(event.key || "").toLowerCase() !== "z") return null;
  if (isTextEntryTarget(event.target)) return null;
  return event.shiftKey ? "redo" : "undo";
}
