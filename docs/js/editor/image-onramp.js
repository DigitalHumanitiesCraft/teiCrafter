/**
 * teiCrafter Editor -- deterministic on-ramp: plaintext + page images.
 *
 * The non-LLM companion to the plaintext draft: the operator pastes (or loads) a
 * text and attaches the page scans, sets their order, and the editor builds the
 * SAME deterministic line-level TEI as teiFromPlaintext, with a <facsimile> whose
 * surfaces bind, in page order, to the attached images. No model, no marking; the
 * text is carried verbatim. Page-break POSITIONS still come only from the text
 * (the leading page and each |N| marker); the images merely attach to them.
 *
 * This module owns the dialog and the thumbnails' object URLs only. On build it
 * hands the ordered images to ctx.build(); the editor creates its own page-image
 * URLs there, so ownership never straddles the two (the dialog revokes its
 * thumbnail URLs on close, build succeeded or not).
 *
 * Contract:
 *   setupImageOnramp(ctx) -> { open }
 *   ctx.build({ text, title, images: [{ file, name, type }] }) -> Promise
 */

import { el, clear } from "./dom.js";

// Image-byte signatures, so a file named without an extension (e.g. "IMG.1")
// still gets a correct, portable filename for the TEI and the saved file.
async function sniffImage(file) {
  let b;
  try { b = new Uint8Array(await file.slice(0, 16).arrayBuffer()); }
  catch { return null; }
  if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return { type: "image/jpeg", ext: "jpg" };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return { type: "image/png", ext: "png" };
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return { type: "image/gif", ext: "gif" };
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46
    && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return { type: "image/webp", ext: "webp" };
  if ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2A && b[3] === 0x00)
    || (b[0] === 0x4D && b[1] === 0x4D && b[2] === 0x00 && b[3] === 0x2A)) return { type: "image/tiff", ext: "tif" };
  return null;
}

const KNOWN_EXT = /\.(jpe?g|png|gif|webp|tiff?)$/i;

/** A portable filename: keep a real image extension, else append the sniffed one. */
function cleanName(file, sniff) {
  if (KNOWN_EXT.test(file.name)) return file.name;
  return sniff ? `${file.name}.${sniff.ext}` : file.name;
}

/** Number of pages the text yields: the leading page plus one per |N| marker. */
function pageCount(text) {
  return (String(text).match(/\|\d+\|/g) || []).length + 1;
}

export function setupImageOnramp(ctx) {
  const { build } = ctx;
  // Ordered page images: { file, name, type, thumbUrl }. The array order IS the
  // page order; index i binds to page i + 1.
  let items = [];
  let root = null;
  const ids = {};

  function ensureDom() {
    if (root) return;
    const card = el("div", { class: "ed-modal-card", role: "dialog", "aria-modal": "true" });

    const head = el("div", { class: "ed-modal-head" }, [
      el("span", { text: "New from text and page images" }),
      (ids.close = el("button", { class: "ed-btn", title: "Close", text: "Close" })),
    ]);

    const nameField = el("label", { class: "ed-field" }, [
      el("span", { text: "Name" }),
      (ids.name = el("input", { type: "text", value: "letter", spellcheck: "false",
        placeholder: "file name without extension" })),
    ]);

    ids.text = el("textarea", { rows: "8",
      placeholder: "Paste the transcription. Insert |2| where page 2 begins, |3| for page 3, and so on; the first page starts automatically." });
    ids.loadTxt = el("button", { class: "ed-btn", type: "button", text: "Load .txt...",
      title: "Fill the text from a .txt or .md file" });
    const textField = el("label", { class: "ed-field" }, [
      el("span", {}, [
        document.createTextNode("Text "),
        ids.loadTxt,
      ]),
      ids.text,
    ]);

    ids.drop = el("div", { class: "onramp-drop", tabindex: "0" }, [
      el("span", { class: "onramp-drop-hint", text: "Drop page images here, in any order, or" }),
      (ids.addBtn = el("button", { class: "ed-btn", type: "button", text: "Add images..." })),
    ]);
    ids.thumbs = el("div", { class: "onramp-thumbs" });
    ids.reconcile = el("div", { class: "onramp-reconcile" });
    const imageField = el("div", { class: "ed-field" }, [
      el("span", { text: "Page images (drag order = page order)" }),
      ids.drop, ids.thumbs, ids.reconcile,
    ]);

    ids.status = el("div", { class: "ed-modal-status" });
    const body = el("div", { class: "ed-modal-body" }, [nameField, textField, imageField, ids.status]);

    ids.cancel = el("button", { class: "ed-btn", text: "Cancel" });
    ids.run = el("button", { class: "ed-btn ed-btn-primary", text: "Craft TEI",
      title: "Craft the starting TEI from the text with the images attached, in page order" });
    const foot = el("div", { class: "ed-modal-foot" }, [ids.cancel, ids.run]);

    card.appendChild(head); card.appendChild(body); card.appendChild(foot);
    root = el("div", { class: "ed-modal", id: "onramp-modal", hidden: true }, [card]);
    document.body.appendChild(root);

    // Hidden file inputs for the two pickers.
    ids.imgInput = el("input", { type: "file", accept: "image/*", multiple: true, style: "display:none" });
    ids.txtInput = el("input", { type: "file", accept: ".txt,.md,text/plain,text/markdown", style: "display:none" });
    document.body.appendChild(ids.imgInput);
    document.body.appendChild(ids.txtInput);

    wire();
  }

  function setStatus(msg, kind) {
    ids.status.textContent = msg || "";
    ids.status.className = "ed-modal-status" + (kind ? " " + kind : "");
  }

  function renderThumbs() {
    clear(ids.thumbs);
    items.forEach((it, i) => {
      const up = el("button", { class: "ed-btn onramp-mini", type: "button", title: "Move earlier", text: "↑" });
      const down = el("button", { class: "ed-btn onramp-mini", type: "button", title: "Move later", text: "↓" });
      const rm = el("button", { class: "ed-btn onramp-mini", type: "button", title: "Remove", text: "×" });
      up.disabled = i === 0;
      down.disabled = i === items.length - 1;
      up.addEventListener("click", () => { move(i, i - 1); });
      down.addEventListener("click", () => { move(i, i + 1); });
      rm.addEventListener("click", () => { remove(i); });
      const thumb = el("div", { class: "onramp-thumb" }, [
        el("div", { class: "onramp-thumb-page", text: `Page ${i + 1}` }),
        el("img", { src: it.thumbUrl, alt: it.name }),
        el("div", { class: "onramp-thumb-name", title: it.name, text: it.name }),
        el("div", { class: "onramp-thumb-ctl" }, [up, down, rm]),
      ]);
      ids.thumbs.appendChild(thumb);
    });
    updateReconcile();
  }

  function updateReconcile() {
    const pages = pageCount(ids.text.value);
    const imgs = items.length;
    if (imgs === 0) {
      ids.reconcile.textContent = `The text has ${pages} page(s). Add ${pages} image(s) to attach one per page.`;
      ids.reconcile.className = "onramp-reconcile";
    } else if (imgs === pages) {
      ids.reconcile.textContent = `${pages} page(s), ${imgs} image(s): one image per page.`;
      ids.reconcile.className = "onramp-reconcile ok";
    } else if (imgs < pages) {
      ids.reconcile.textContent = `${pages} page(s), but only ${imgs} image(s): the last ${pages - imgs} page(s) stay without an image.`;
      ids.reconcile.className = "onramp-reconcile warn";
    } else {
      ids.reconcile.textContent = `${pages} page(s), but ${imgs} image(s): the surplus ${imgs - pages} image(s) will not be attached.`;
      ids.reconcile.className = "onramp-reconcile warn";
    }
  }

  function move(from, to) {
    if (to < 0 || to >= items.length) return;
    const [it] = items.splice(from, 1);
    items.splice(to, 0, it);
    renderThumbs();
  }

  function remove(i) {
    const [it] = items.splice(i, 1);
    if (it) URL.revokeObjectURL(it.thumbUrl);
    renderThumbs();
  }

  function uniqueName(name) {
    const taken = new Set(items.map((x) => x.name));
    if (!taken.has(name)) return name;
    const m = name.match(/^(.*?)(\.[^.]+)?$/);
    const stem = m[1] || name, ext = m[2] || "";
    let k = 2;
    while (taken.has(`${stem}-${k}${ext}`)) k++;
    return `${stem}-${k}${ext}`;
  }

  async function addFiles(fileList) {
    for (const file of Array.from(fileList || [])) {
      if (!file) continue;
      const sniff = await sniffImage(file);
      // Accept anything that is an image by signature, declared MIME, or extension.
      if (!sniff && !(file.type && file.type.startsWith("image/")) && !KNOWN_EXT.test(file.name)) continue;
      const name = uniqueName(cleanName(file, sniff));
      const type = sniff ? sniff.type : (file.type || "");
      items.push({ file, name, type, thumbUrl: URL.createObjectURL(file) });
    }
    renderThumbs();
  }

  function revokeThumbs() {
    for (const it of items) URL.revokeObjectURL(it.thumbUrl);
    items = [];
  }

  function open() {
    ensureDom();
    revokeThumbs();
    ids.name.value = "letter";
    ids.text.value = "";
    setStatus("");
    renderThumbs();
    root.hidden = false;
    ids.text.focus();
  }

  function close() {
    revokeThumbs();
    if (root) root.hidden = true;
    renderThumbs();
  }

  async function run() {
    const text = ids.text.value;
    const title = (ids.name.value || "letter").trim() || "letter";
    if (!text.trim()) { setStatus("Add some text first.", "err"); return; }
    ids.run.disabled = true;
    setStatus("Crafting...", "busy");
    try {
      await build({ text, title, images: items.map(({ file, name, type }) => ({ file, name, type })) });
      close();
    } catch (err) {
      setStatus(`Could not build: ${err && err.message ? err.message : err}`, "err");
    } finally {
      ids.run.disabled = false;
    }
  }

  function wire() {
    ids.close.addEventListener("click", close);
    ids.cancel.addEventListener("click", close);
    ids.run.addEventListener("click", run);
    ids.text.addEventListener("input", updateReconcile);
    ids.addBtn.addEventListener("click", () => ids.imgInput.click());
    ids.imgInput.addEventListener("change", async () => { await addFiles(ids.imgInput.files); ids.imgInput.value = ""; });
    ids.loadTxt.addEventListener("click", () => ids.txtInput.click());
    ids.txtInput.addEventListener("change", async () => {
      const f = ids.txtInput.files && ids.txtInput.files[0];
      if (f) {
        ids.text.value = await f.text();
        const base = f.name.replace(/\.(txt|md)$/i, "");
        if (base) ids.name.value = base;
        updateReconcile();
      }
      ids.txtInput.value = "";
    });
    // Drop zone.
    const stop = (e) => { e.preventDefault(); e.stopPropagation(); };
    ["dragenter", "dragover"].forEach((ev) => ids.drop.addEventListener(ev, (e) => { stop(e); ids.drop.classList.add("over"); }));
    ["dragleave", "drop"].forEach((ev) => ids.drop.addEventListener(ev, (e) => { stop(e); ids.drop.classList.remove("over"); }));
    ids.drop.addEventListener("drop", (e) => { if (e.dataTransfer) addFiles(e.dataTransfer.files); });
    // Backdrop click and Escape close.
    root.addEventListener("click", (e) => { if (e.target === root) close(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && root && !root.hidden) close(); });
  }

  return { open };
}
