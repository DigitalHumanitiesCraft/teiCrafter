import { el } from "./dom.js";

async function json(url, signal) {
  const response = await fetch(url, { credentials: "omit", referrerPolicy: "no-referrer", signal });
  if (!response.ok) throw new Error(`ICONCLASS returned HTTP ${response.status}.`);
  return response.json();
}

export function iconclassNotation(value) {
  let text = String(value || "").trim();
  if (/^https?:/i.test(text)) {
    const url = new URL(text);
    if ((url.hostname !== "iconclass.org" && url.hostname !== "www.iconclass.org") || url.username || url.password || url.port) {
      throw new Error("Use an ICONCLASS notation or iconclass.org URL.");
    }
    text = decodeURIComponent(url.pathname.replace(/^\//, "")).replace(/\.(json|jsonld)$/i, "");
  }
  const hasControl = [...text].some((character) => character.codePointAt(0) < 32 || character.codePointAt(0) === 127);
  if (!text.trim() || hasControl || /[/\\?#]/.test(text)) throw new Error("Enter an ICONCLASS notation.");
  return text;
}

/** Remote requests run only after an explicit lookup or search action. */
export function mountIconclassLookup(host, { onPick, current, readOnly }) {
  const box = el("details", { class: "ed-wb-reference" });
  box.append(el("summary", { text: "Look up ICONCLASS" }));
  const input = el("input", { type: "search", "aria-label": "ICONCLASS notation or search term", placeholder: "11C21 or German search term" });
  const results = el("div", { class: "ed-wb-actions" });
  const message = el("p", { role: "status", class: "ed-wb-note" });
  let request = null;
  async function run(search) {
    request?.abort();
    const controller = new AbortController(); request = controller;
    const fresh = () => request === controller && box.isConnected && current();
    const timer = setTimeout(() => controller.abort(), 15000);
    message.textContent = "Looking up ICONCLASS...";
    try {
      if (readOnly()) throw new Error("The document is read only.");
      if (search) {
        const url = new URL("https://iconclass.org/api/search");
        url.search = new URLSearchParams({ q: input.value, lang: "de", size: "12" }).toString();
        const payload = await json(url, controller.signal);
        if (!fresh()) return;
        results.replaceChildren();
        for (const notation of payload.result || []) results.append(el("button", {
          type: "button", class: "ed-btn", text: String(notation),
          onclick: () => { input.value = String(notation); void run(false); },
        }));
        message.textContent = `${payload.total || 0} matches. Select a notation to load its German and English labels.`;
      } else {
        const notation = iconclassNotation(input.value);
        const payload = await json(`https://iconclass.org/${encodeURIComponent(notation)}.json`, controller.signal);
        if (!fresh()) return;
        if (!payload?.n || !payload.txt) throw new Error("ICONCLASS did not return a notation and labels.");
        if (readOnly()) throw new Error("The document is read only.");
        const returnedNotation = iconclassNotation(payload.n);
        onPick({ corresp: `https://iconclass.org/${encodeURIComponent(returnedNotation)}`, de: payload.txt.de || "", en: payload.txt.en || "", resp: "#ICONCLASS" });
        message.textContent = `Labels for ${returnedNotation} entered in the new ICONCLASS fields. Review and Apply to store them.`;
      }
    } catch (error) {
      if (fresh()) message.textContent = error.name === "AbortError" ? "ICONCLASS lookup timed out. You can enter the URI and labels manually." : error.message;
    } finally { clearTimeout(timer); }
  }
  box.append(input, el("div", { class: "ed-wb-actions" }, [
    el("button", { type: "button", class: "ed-btn", text: "Look up notation", disabled: readOnly(), onclick: () => { void run(false); } }),
    el("button", { type: "button", class: "ed-btn", text: "Search ICONCLASS", disabled: readOnly(), onclick: () => { void run(true); } }),
  ]), message, results);
  host.append(box);
}
