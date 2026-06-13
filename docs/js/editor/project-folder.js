/**
 * teiCrafter Editor -- project folder (M2.9).
 *
 * A project folder is granted once via the File System Access directory picker
 * (Chromium-based browsers) and holds TEI files, optional plaintext files and
 * an optional manifest (teicrafter.project.json). Files stay in the visible
 * file system (git-able, readable by other tools); nothing is copied into
 * browser storage. A .txt opens as a deterministic line-level TEI draft; the
 * first save creates the .xml next to the source (finalizeSaveTarget).
 *
 * Contract:
 *   createProjectFolder(ctx) -> {
 *     renderProjectPanel, openProjectFolder, newProject, finalizeSaveTarget,
 *   }
 *   ctx: {
 *     app,                       // shared mutable editor state (projectFolder, docName, saveTarget, fileHandle)
 *     setStatus(msg), setDirty(d),
 *     confirmDiscard() -> bool,  // guard before replacing a dirty document
 *     load(raw, name, handle, project) -> Promise,
 *     showPanel(id), updatePanels(),
 *     teiVocabularyLine() -> string|null,  // the project's TEI scope and load state
 *     getProjectPanelHost() -> Element,  // the project panel's (possibly created) host
 *   }
 */

import { el, clear } from "./dom.js";
import { parseManifest, typeForFile, MANIFEST_FILENAME } from "./project-manifest.js";
import { teiFromPlaintext } from "./plaintext-import.js";
import { requireCtx } from "./ctx.js";

export function createProjectFolder(ctx) {
  requireCtx("createProjectFolder", ctx,
    ["setStatus", "setDirty", "confirmDiscard", "load", "showPanel", "updatePanels",
     "teiVocabularyLine", "getProjectPanelHost"],
    ["app"]);
  const {
    app, setStatus, setDirty, confirmDiscard, load,
    showPanel, updatePanels, teiVocabularyLine, getProjectPanelHost,
  } = ctx;
  // Optional hook: announce a plaintext draft so the shell can show the neutral
  // draft banner and record the Source provenance. Absent in headless callers.
  const onPlaintextDraft = ctx.onPlaintextDraft || (() => {});

  function renderProjectPanel() {
    const host = getProjectPanelHost();
    clear(host);
    const pf = app.projectFolder;
    if (!pf) return;
    host.appendChild(el("div", { class: "ed-proj-head", text: pf.name }));
    const vocab = teiVocabularyLine();
    if (vocab) host.appendChild(el("div", { class: "ed-proj-vocab", text: vocab }));
    if (!pf.files.length) {
      // Onboarding for an adopted but empty project: state the two ways to get a
      // document into the editor, in plain terms. Reuses the project-panel tones.
      host.appendChild(el("p", { class: "ed-proj-empty",
        text: "This project folder has no .xml, .txt or .md files yet." }));
      host.appendChild(el("p", { class: "ed-proj-empty",
        text: "Add a TEI .xml or a plaintext .txt/.md file to the folder on disk, then reopen "
          + "the folder (Load... > Open project folder). A plaintext file opens as a line-level "
          + "draft and the first save writes the .xml next to it. You can also start from text "
          + "now with Load... > Open TEI or text, then save into this folder." }));
      return;
    }
    const list = el("div", { class: "ed-proj-list" });
    for (const f of pf.files) {
      const docType = typeForFile(pf.project, f.name);
      const row = el("button", {
        class: "ed-proj-file" + (f.name === app.docName ? " active" : ""), type: "button",
        title: f.kind === "text"
          ? "Plaintext: opens as a deterministic line-level TEI draft; Save writes the .xml into the project folder"
          : "Open this TEI file",
      });
      row.appendChild(el("span", { class: "ed-proj-file-name", text: f.name }));
      if (docType) row.appendChild(el("span", { class: "ed-proj-file-type", text: docType.label }));
      if (f.kind === "text") row.appendChild(el("span", { class: "ed-proj-file-kind", text: "plaintext" }));
      row.addEventListener("click", () => openProjectFile(f));
      list.appendChild(row);
    }
    host.appendChild(list);
  }

  async function openProjectFile(f) {
    if (!confirmDiscard()) return;
    try {
      const file = await f.handle.getFile();
      const project = app.projectFolder ? app.projectFolder.project : null;
      if (f.kind === "text") {
        // Deterministic transport, no model: the draft exists only in the editor
        // until Save creates the .xml next to the source in the project folder.
        const baseName = f.name.replace(/\.(txt|md)$/i, "");
        const xmlName = baseName + ".xml";
        await load(teiFromPlaintext(await file.text(), baseName), xmlName, null, project);
        app.saveTarget = { dir: app.projectFolder.dir, name: xmlName };
        setDirty(true);
        onPlaintextDraft(f.name);
        setStatus(`Drafted ${xmlName} deterministically from ${f.name} (text carried verbatim). Save writes it into the project folder.`);
      } else {
        await load(await file.text(), f.name, f.handle, project);
      }
      // Stay in the project context: switching to the next file is one click.
      showPanel("project");
    } catch (err) {
      setStatus(`Could not open ${f.name}: ${err.message}`);
    }
  }

  async function adoptProjectFolder(dir) {
    const files = [];
    let manifestText = null;
    for await (const entry of dir.values()) {
      if (entry.kind !== "file") continue;
      if (entry.name === MANIFEST_FILENAME) manifestText = await (await entry.getFile()).text();
      else if (/\.xml$/i.test(entry.name)) files.push({ name: entry.name, kind: "tei", handle: entry });
      else if (/\.(txt|md)$/i.test(entry.name)) files.push({ name: entry.name, kind: "text", handle: entry });
    }
    files.sort((a, b) => a.name.localeCompare(b.name));
    let project = null, note = "";
    if (manifestText !== null) {
      try { project = parseManifest(manifestText); }
      catch (err) { note = ` ${err.message}; the folder opened without project settings.`; }
    }
    app.projectFolder = { dir, name: project ? project.name : dir.name, files, project };
    const teiCount = files.filter((x) => x.kind === "tei").length;
    setStatus(`Project folder "${app.projectFolder.name}": ${files.length} file(s) (${teiCount} TEI, ${files.length - teiCount} plaintext).${note}`);
    if (files.length) await openProjectFile(files[0]);
    else {
      // No openable document: surface the project panel so its onboarding note
      // (how to add a document or start from text) is what the operator sees,
      // not the bare empty reading pane.
      updatePanels();
      showPanel("project");
    }
  }

  async function openProjectFolder() {
    if (!window.showDirectoryPicker) {
      setStatus("Open project folder needs the File System Access API (Chromium-based browsers).");
      return;
    }
    // The discard guard sits in openProjectFile, where a document is replaced.
    let dir;
    try {
      dir = await window.showDirectoryPicker({ mode: "readwrite" });
    } catch (err) {
      if (err && err.name === "AbortError") return;
      setStatus(`Could not open the folder: ${err.message}`);
      return;
    }
    await adoptProjectFolder(dir);
  }

  async function newProject() {
    if (!window.showDirectoryPicker) {
      setStatus("New project needs the File System Access API (Chromium-based browsers).");
      return;
    }
    // Writing the manifest replaces no document; the guard sits in openProjectFile.
    let dir;
    try {
      dir = await window.showDirectoryPicker({ mode: "readwrite" });
    } catch (err) {
      if (err && err.name === "AbortError") return;
      setStatus(`Could not open the folder: ${err.message}`);
      return;
    }
    let exists = false;
    try { await dir.getFileHandle(MANIFEST_FILENAME); exists = true; } catch { /* not a project yet */ }
    if (exists) {
      setStatus("This folder already carries a teicrafter.project.json; opening it as a project.");
      await adoptProjectFolder(dir);
      return;
    }
    const name = window.prompt("Project name:", dir.name);
    if (name === null) return;
    try {
      const handle = await dir.getFileHandle(MANIFEST_FILENAME, { create: true });
      const writable = await handle.createWritable();
      await writable.write(JSON.stringify({ teicrafter: 1, name: name.trim() || dir.name }, null, 2) + "\n");
      await writable.close();
    } catch (err) {
      setStatus(`Could not write the project manifest: ${err.message}`);
      return;
    }
    await adoptProjectFolder(dir);
  }

  /**
   * First-save plumbing for plaintext drafts: when no file handle exists but a
   * saveTarget does, create the .xml in the project folder, adopt the handle
   * and register the new file in the panel list. Does nothing when there is
   * nothing to finalize; on failure it reports and leaves fileHandle null, so
   * the caller's download fallback takes over.
   */
  async function finalizeSaveTarget() {
    if (app.fileHandle || !(app.saveTarget && app.saveTarget.dir)) return;
    try {
      app.fileHandle = await app.saveTarget.dir.getFileHandle(app.saveTarget.name, { create: true });
      app.saveTarget = null;
      if (app.projectFolder) {
        const known = app.projectFolder.files.some((f) => f.name === app.docName);
        if (!known) {
          app.projectFolder.files.push({ name: app.docName, kind: "tei", handle: app.fileHandle });
          app.projectFolder.files.sort((a, b) => a.name.localeCompare(b.name));
        }
      }
    } catch (err) {
      setStatus(`Could not create ${app.saveTarget.name} in the project folder (${err.message}); downloading instead`);
    }
  }

  return { renderProjectPanel, openProjectFolder, newProject, finalizeSaveTarget };
}
