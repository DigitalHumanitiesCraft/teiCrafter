export function nextTabIndex(current, length, key) {
  if (!length) return -1;
  if (key === "Home") return 0;
  if (key === "End") return length - 1;
  if (key === "ArrowRight" || key === "ArrowDown") return (current + 1) % length;
  if (key === "ArrowLeft" || key === "ArrowUp") return (current - 1 + length) % length;
  return current;
}

function availableTabs(tablist) {
  return [...tablist.querySelectorAll('[role="tab"]')].filter((tab) => {
    return !tab.disabled && !tab.hidden && !tab.closest("[hidden]");
  });
}

export function syncTablist(tablist) {
  const tabs = availableTabs(tablist);
  if (!tabs.length) return;
  const selected = tabs.find((tab) => tab.getAttribute("aria-selected") === "true") || tabs[0];
  for (const tab of tabs) tab.tabIndex = tab === selected ? 0 : -1;
}

export function setupTablist(tablist) {
  if (!tablist || tablist.dataset.keyboardTabs === "true") return;
  tablist.dataset.keyboardTabs = "true";
  syncTablist(tablist);
  tablist.addEventListener("click", () => queueMicrotask(() => syncTablist(tablist)));
  tablist.addEventListener("keydown", (event) => {
    if (!new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"]).has(event.key)) return;
    const tabs = availableTabs(tablist);
    const current = tabs.indexOf(document.activeElement);
    if (current < 0) return;
    event.preventDefault();
    event.stopPropagation();
    const next = tabs[nextTabIndex(current, tabs.length, event.key)];
    next.focus();
    next.click();
  });
}
